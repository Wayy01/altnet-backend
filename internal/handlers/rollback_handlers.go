package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"ultra-api-testing/internal/constants"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
	"ultra-api-testing/internal/sync"
	"ultra-api-testing/internal/ultra"
)

// RollbackHandler contains all rollback-related HTTP handlers
type RollbackHandler struct {
	repo           *repository.Repository
	fetcher        *ultra.Fetcher
	rollbackRepo   *repository.RollbackRepository
	selectiveSync  *sync.SelectiveSync
}

// NewRollbackHandler creates a new RollbackHandler instance
func NewRollbackHandler(
	repo *repository.Repository,
	fetcher *ultra.Fetcher,
	rollbackRepo *repository.RollbackRepository,
	selectiveSync *sync.SelectiveSync,
) *RollbackHandler {
	return &RollbackHandler{
		repo:          repo,
		fetcher:       fetcher,
		rollbackRepo:  rollbackRepo,
		selectiveSync: selectiveSync,
	}
}

// ============================================================================
// ROLLBACK ENDPOINTS
// ============================================================================

// GetRollbackPreview handles GET /api/v1/sync/rollback/preview/{sync_log_id}
func (h *RollbackHandler) GetRollbackPreview(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	syncLogID, err := uuid.Parse(vars["sync_log_id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid sync log ID", err.Error())
		return
	}

	// Get snapshot for this sync log
	snapshot, err := h.rollbackRepo.GetSnapshotBySyncLogID(r.Context(), syncLogID)
	if err != nil {
		respondError(w, http.StatusNotFound, "No snapshot available for rollback", err.Error())
		return
	}

	// Generate preview
	preview, err := h.rollbackRepo.GenerateRollbackPreview(r.Context(), snapshot.ID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to generate rollback preview", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": preview,
	})
}

// ExecuteRollback handles POST /api/v1/sync/rollback
func (h *RollbackHandler) ExecuteRollback(w http.ResponseWriter, r *http.Request) {
	var request models.RollbackRequest

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate request
	if request.SyncLogID == uuid.Nil {
		respondError(w, http.StatusBadRequest, "sync_log_id is required", "")
		return
	}

	if request.ConfirmHash == "" {
		respondError(w, http.StatusBadRequest, "confirm_hash is required for security", "")
		return
	}

	// Validate rollback_type against whitelist
	if !constants.ValidRollbackTypes[request.RollbackType] {
		respondError(w, http.StatusBadRequest, constants.ErrInvalidRollbackType, "Must be one of: full, partial, selective")
		return
	}

	// Execute rollback
	rollback, err := h.rollbackRepo.ExecuteRollback(r.Context(), &request)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to execute rollback", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data":    rollback,
		"message": fmt.Sprintf("Rollback completed. %d entities restored.", rollback.EntitiesRestored),
	})
}

// GetRollbackStatus handles GET /api/v1/sync/rollback/{rollback_id}
func (h *RollbackHandler) GetRollbackStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	rollbackID, err := uuid.Parse(vars["rollback_id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid rollback ID", err.Error())
		return
	}

	rollback, err := h.rollbackRepo.GetRollbackByID(r.Context(), rollbackID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Rollback not found", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": rollback,
	})
}

// ListRollbacks handles GET /api/v1/sync/rollbacks
func (h *RollbackHandler) ListRollbacks(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)

	rollbacks, total, err := h.rollbackRepo.ListRollbacks(r.Context(), limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list rollbacks", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": rollbacks,
		"meta": PaginationMeta{
			Limit:  limit,
			Offset: offset,
			Total:  total,
		},
	})
}

// ExecuteSelectiveSyncWithSnapshot handles POST /api/v1/sync/selective-enhanced
// This is an enhanced version that creates a snapshot before syncing
func (h *RollbackHandler) ExecuteSelectiveSyncWithSnapshot(w http.ResponseWriter, r *http.Request) {
	var request models.SelectiveSyncRequest

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate request
	if len(request.SelectedSteps) == 0 {
		respondError(w, http.StatusBadRequest, "At least one step must be selected", "")
		return
	}

	ctx := r.Context()

	// Create temporary sync log to associate snapshot
	tempSyncLogID := uuid.New()

	// Track warnings during snapshot creation
	warnings := make([]string, 0)
	var snapshot *models.SyncSnapshot
	rollbackAvailable := false

	// Create snapshot before sync
	log.Printf("Creating pre-sync snapshot for sync %s", tempSyncLogID)

	// Set snapshot expiration (7 days by default)
	expiresIn := constants.SnapshotDefaultExpiration
	var err error
	snapshot, err = h.rollbackRepo.CreateSnapshot(ctx, tempSyncLogID, "pre_sync", nil, &expiresIn)
	if err != nil {
		warnings = append(warnings, fmt.Sprintf("Failed to create snapshot: %v - rollback will not be available", err))
		log.Printf("Warning: Failed to create snapshot: %v", err)
		// Continue with sync even if snapshot fails
	} else {
		// Capture entity snapshots for selected steps with batch processing
		for _, step := range request.SelectedSteps {
			var entityType string
			var entityIDs []uuid.UUID

			switch step {
			case models.SyncStepBrands:
				entityType = "brand"
				brands, err := h.repo.GetAllBrands(ctx)
				if err != nil {
					warnings = append(warnings, fmt.Sprintf("Failed to fetch brands for snapshot: %v", err))
					continue
				}
				for _, b := range brands {
					entityIDs = append(entityIDs, b.ID)
				}

			case models.SyncStepCategories:
				entityType = "category"
				categories, err := h.repo.GetAllCategories(ctx)
				if err != nil {
					warnings = append(warnings, fmt.Sprintf("Failed to fetch categories for snapshot: %v", err))
					continue
				}
				for _, c := range categories {
					entityIDs = append(entityIDs, c.ID)
				}

			case models.SyncStepProducts:
				entityType = "product"
				// Implement proper pagination for large datasets
				limit := constants.DefaultSnapshotLimit
				products, err := h.repo.ListProducts(ctx, nil, limit, 0)
				if err != nil {
					warnings = append(warnings, fmt.Sprintf("Failed to fetch products for snapshot: %v", err))
					continue
				}
				for _, p := range products {
					entityIDs = append(entityIDs, p.ID)
				}
				if len(products) == limit {
					warnings = append(warnings, fmt.Sprintf("Snapshot limited to %d products - full rollback may not be possible", limit))
				}
			}

			if len(entityIDs) > 0 {
				if err := h.rollbackRepo.CaptureEntitySnapshot(ctx, snapshot.ID, entityType, entityIDs); err != nil {
					warnings = append(warnings, fmt.Sprintf("Failed to capture %s snapshot: %v", entityType, err))
					log.Printf("Warning: Failed to capture %s snapshot: %v", entityType, err)
				} else {
					log.Printf("Captured snapshot for %d %s entities", len(entityIDs), entityType)
				}
			}
		}

		// Snapshot creation succeeded if we get here
		rollbackAvailable = true
	}

	// Execute selective sync
	result, err := h.selectiveSync.ExecuteSelectiveSync(ctx, &request)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to execute sync", err.Error())
		return
	}

	response := map[string]interface{}{
		"data": map[string]interface{}{
			"sync_log_id":        result.SyncLogID,
			"duration_seconds":   result.Duration.Seconds(),
			"total_changes":      result.TotalChanges,
			"step_results":       result.StepResults,
			"errors":             result.Errors,
			"rollback_available": rollbackAvailable,
		},
		"message": fmt.Sprintf("Sync completed in %v with %d changes", result.Duration.Round(1000000000), result.TotalChanges),
	}

	// Add snapshot info if available
	if snapshot != nil {
		response["data"].(map[string]interface{})["snapshot_id"] = snapshot.ID
	}

	// Include warnings if any
	if len(warnings) > 0 {
		response["warnings"] = warnings
	}

	respondJSON(w, http.StatusOK, response)
}
