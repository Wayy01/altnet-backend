package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"ultra-api-testing/internal/constants"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
	"ultra-api-testing/internal/sync"
	"ultra-api-testing/internal/ultra"
)

// Phase4Handler contains all Phase 4 HTTP handlers
type Phase4Handler struct {
	repo               *repository.Repository
	fetcher            *ultra.Fetcher
	rollbackRepo       *repository.RollbackRepository
	comparisonRepo     *repository.ComparisonRepository
	conflictRepo       *repository.ConflictRepository
	syncConfigRepo     *repository.SyncConfigRepository
	selectiveSync      *sync.SelectiveSync
}

// NewPhase4Handler creates a new Phase4Handler instance
func NewPhase4Handler(
	repo *repository.Repository,
	fetcher *ultra.Fetcher,
	rollbackRepo *repository.RollbackRepository,
	comparisonRepo *repository.ComparisonRepository,
	conflictRepo *repository.ConflictRepository,
	syncConfigRepo *repository.SyncConfigRepository,
	selectiveSync *sync.SelectiveSync,
) *Phase4Handler {
	return &Phase4Handler{
		repo:           repo,
		fetcher:        fetcher,
		rollbackRepo:   rollbackRepo,
		comparisonRepo: comparisonRepo,
		conflictRepo:   conflictRepo,
		syncConfigRepo: syncConfigRepo,
		selectiveSync:  selectiveSync,
	}
}

// ============================================================================
// ROLLBACK ENDPOINTS
// ============================================================================

// GetRollbackPreview handles GET /api/v1/sync/rollback/preview/{sync_log_id}
func (h *Phase4Handler) GetRollbackPreview(w http.ResponseWriter, r *http.Request) {
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
func (h *Phase4Handler) ExecuteRollback(w http.ResponseWriter, r *http.Request) {
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
func (h *Phase4Handler) GetRollbackStatus(w http.ResponseWriter, r *http.Request) {
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
func (h *Phase4Handler) ListRollbacks(w http.ResponseWriter, r *http.Request) {
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

// ============================================================================
// COMPARISON & DIFF ENDPOINTS
// ============================================================================

// CompareSync handles POST /api/v1/sync/compare
func (h *Phase4Handler) CompareSync(w http.ResponseWriter, r *http.Request) {
	var request models.ComparisonRequest

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate request
	if len(request.SelectedSteps) == 0 {
		respondError(w, http.StatusBadRequest, "At least one step must be selected", "")
		return
	}

	// Execute comparison
	comparisons, err := h.comparisonRepo.CompareSync(r.Context(), &request)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to compare sync", err.Error())
		return
	}

	// Calculate totals
	totalToInsert := 0
	totalToUpdate := 0
	totalUnchanged := 0
	totalConflicts := 0

	for _, comp := range comparisons {
		totalToInsert += comp.ToInsert
		totalToUpdate += comp.ToUpdate
		totalUnchanged += comp.Unchanged
		totalConflicts += comp.Conflicts
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": comparisons,
		"summary": map[string]interface{}{
			"total_to_insert":  totalToInsert,
			"total_to_update":  totalToUpdate,
			"total_unchanged":  totalUnchanged,
			"total_conflicts":  totalConflicts,
			"estimated_changes": totalToInsert + totalToUpdate,
		},
	})
}

// ============================================================================
// CONFLICT RESOLUTION ENDPOINTS
// ============================================================================

// ListConflicts handles GET /api/v1/sync/conflicts
func (h *Phase4Handler) ListConflicts(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)

	// Parse filters
	var syncLogID *uuid.UUID
	if syncLogIDStr := r.URL.Query().Get("sync_log_id"); syncLogIDStr != "" {
		id, err := uuid.Parse(syncLogIDStr)
		if err != nil {
			respondError(w, http.StatusBadRequest, "Invalid sync_log_id", err.Error())
			return
		}
		syncLogID = &id
	}

	unresolvedOnly := r.URL.Query().Get("unresolved") == "true"

	conflicts, total, err := h.conflictRepo.ListConflicts(r.Context(), syncLogID, unresolvedOnly, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list conflicts", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": conflicts,
		"meta": PaginationMeta{
			Limit:  limit,
			Offset: offset,
			Total:  total,
		},
	})
}

// GetConflict handles GET /api/v1/sync/conflicts/{id}
func (h *Phase4Handler) GetConflict(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	conflictID, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid conflict ID", err.Error())
		return
	}

	conflict, err := h.conflictRepo.GetConflictByID(r.Context(), conflictID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Conflict not found", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": conflict,
	})
}

// ResolveConflicts handles POST /api/v1/sync/conflicts/resolve
func (h *Phase4Handler) ResolveConflicts(w http.ResponseWriter, r *http.Request) {
	var request models.ConflictResolutionRequest

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate request
	if len(request.ConflictIDs) == 0 {
		respondError(w, http.StatusBadRequest, "At least one conflict ID must be provided", "")
		return
	}

	if request.ResolutionStrategy == "" {
		respondError(w, http.StatusBadRequest, "resolution_strategy is required", "")
		return
	}

	// Validate strategy
	validStrategies := map[string]bool{
		"local_wins":  true,
		"remote_wins": true,
		"merge":       true,
		"manual":      true,
	}

	if !validStrategies[request.ResolutionStrategy] {
		respondError(w, http.StatusBadRequest, "Invalid resolution_strategy", "Must be one of: local_wins, remote_wins, merge, manual")
		return
	}

	// Resolve conflicts
	resolved, err := h.conflictRepo.ResolveConflicts(r.Context(), &request)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to resolve conflicts", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": fmt.Sprintf("Successfully resolved %d conflict(s)", resolved),
		"resolved_count": resolved,
	})
}

// ============================================================================
// CONFLICT RULE ENDPOINTS
// ============================================================================

// ListConflictRules handles GET /api/v1/sync/conflict-rules
func (h *Phase4Handler) ListConflictRules(w http.ResponseWriter, r *http.Request) {
	activeOnly := r.URL.Query().Get("active") == "true"

	rules, err := h.conflictRepo.ListConflictRules(r.Context(), activeOnly)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list conflict rules", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": rules,
	})
}

// CreateConflictRule handles POST /api/v1/sync/conflict-rules
func (h *Phase4Handler) CreateConflictRule(w http.ResponseWriter, r *http.Request) {
	var rule models.SyncConflictRule

	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate required fields
	if rule.Name == "" {
		respondError(w, http.StatusBadRequest, "name is required", "")
		return
	}

	if rule.EntityType == "" {
		respondError(w, http.StatusBadRequest, "entity_type is required", "")
		return
	}

	if rule.ConflictType == "" {
		respondError(w, http.StatusBadRequest, "conflict_type is required", "")
		return
	}

	if rule.ResolutionStrategy == "" {
		respondError(w, http.StatusBadRequest, "resolution_strategy is required", "")
		return
	}

	// Create rule
	if err := h.conflictRepo.CreateConflictRule(r.Context(), &rule); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create conflict rule", err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"data":    rule,
		"message": "Conflict rule created successfully",
	})
}

// UpdateConflictRule handles PUT /api/v1/sync/conflict-rules/{id}
func (h *Phase4Handler) UpdateConflictRule(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	ruleID, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid rule ID", err.Error())
		return
	}

	var rule models.SyncConflictRule

	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	rule.ID = ruleID

	// Update rule
	if err := h.conflictRepo.UpdateConflictRule(r.Context(), &rule); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update conflict rule", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data":    rule,
		"message": "Conflict rule updated successfully",
	})
}

// DeleteConflictRule handles DELETE /api/v1/sync/conflict-rules/{id}
func (h *Phase4Handler) DeleteConflictRule(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	ruleID, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid rule ID", err.Error())
		return
	}

	if err := h.conflictRepo.DeleteConflictRule(r.Context(), ruleID); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete conflict rule", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Conflict rule deleted successfully",
	})
}

// ============================================================================
// ENHANCED SYNC WITH SNAPSHOT
// ============================================================================

// ExecuteSelectiveSyncWithSnapshot handles POST /api/v1/sync/selective-enhanced
// This is an enhanced version that creates a snapshot before syncing
func (h *Phase4Handler) ExecuteSelectiveSyncWithSnapshot(w http.ResponseWriter, r *http.Request) {
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
		"message": fmt.Sprintf("Sync completed in %v with %d changes", result.Duration.Round(time.Second), result.TotalChanges),
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("Error encoding JSON response: %v", err)
	}
}

func respondError(w http.ResponseWriter, status int, message string, details string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	response := ErrorResponse{
		Error:   message,
		Details: details,
	}
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Error encoding error response: %v", err)
	}
}

func parsePagination(r *http.Request) (int, int) {
	limit := constants.DefaultPaginationLimit
	offset := 0

	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
			if limit > constants.MaxPaginationLimit {
				limit = constants.MaxPaginationLimit // Maximum limit
			}
		}
	}

	if offsetStr := r.URL.Query().Get("offset"); offsetStr != "" {
		if parsedOffset, err := strconv.Atoi(offsetStr); err == nil && parsedOffset >= 0 {
			offset = parsedOffset
		}
	}

	return limit, offset
}
