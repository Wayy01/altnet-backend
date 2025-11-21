package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"ultra-api-testing/internal/constants"
	"ultra-api-testing/internal/models"
)

// ConflictRepository handles conflict detection and resolution
type ConflictRepository struct {
	pool       *pgxpool.Pool
	ruleCache  map[string]*cachedRule // Cache for conflict rules
	cacheMutex sync.RWMutex           // Mutex for thread-safe cache access
}

// cachedRule represents a cached conflict resolution rule with expiration
type cachedRule struct {
	rule      *models.SyncConflictRule
	expiresAt time.Time
}

// NewConflictRepository creates a new conflict repository
func NewConflictRepository(pool *pgxpool.Pool) *ConflictRepository {
	return &ConflictRepository{
		pool:      pool,
		ruleCache: make(map[string]*cachedRule),
	}
}

// ============================================================================
// CONFLICT DETECTION
// ============================================================================

// DetectConflict detects if there's a conflict for an entity
func (r *ConflictRepository) DetectConflict(ctx context.Context, syncLogID uuid.UUID, step models.SyncStep, entityType string, entityUltraID string, localData, remoteData map[string]interface{}) (*models.SyncConflict, error) {
	// Get entity ID from local data
	var entityID uuid.UUID
	if id, ok := localData["id"].(uuid.UUID); ok {
		entityID = id
	} else if idStr, ok := localData["id"].(string); ok {
		var err error
		entityID, err = uuid.Parse(idStr)
		if err != nil {
			return nil, fmt.Errorf("invalid entity ID: %w", err)
		}
	} else {
		// Explicit check for missing or invalid ID
		return nil, fmt.Errorf("entity ID is missing or invalid in local data")
	}

	// Check for concurrent modification
	conflictType := "concurrent_modification"

	// Get timestamps if available
	var localModifiedAt, remoteModifiedAt *time.Time
	if localMod, ok := localData["updated_at"].(time.Time); ok {
		localModifiedAt = &localMod
	}
	if remoteMod, ok := remoteData["updated_at"].(time.Time); ok {
		remoteModifiedAt = &remoteMod
	}

	// Create conflict record
	conflict := &models.SyncConflict{
		ID:                uuid.New(),
		SyncLogID:         syncLogID,
		Step:              step,
		EntityType:        entityType,
		EntityID:          entityID,
		EntityUltraID:     entityUltraID,
		ConflictType:      conflictType,
		LocalData:         localData,
		RemoteData:        remoteData,
		LocalModifiedAt:   localModifiedAt,
		RemoteModifiedAt:  remoteModifiedAt,
		ResolutionApplied: false,
		CreatedAt:         time.Now(),
		Metadata:          make(map[string]interface{}),
	}

	// Try to find applicable resolution rule (with caching)
	rule, err := r.FindApplicableRule(ctx, entityType, conflictType)
	if err == nil && rule != nil {
		conflict.ResolutionStrategy = rule.ResolutionStrategy
	}

	// Record conflict
	if err := r.RecordConflict(ctx, conflict); err != nil {
		return nil, err
	}

	return conflict, nil
}

// RecordConflict records a conflict in the database
func (r *ConflictRepository) RecordConflict(ctx context.Context, conflict *models.SyncConflict) error {
	localDataJSON, err := json.Marshal(conflict.LocalData)
	if err != nil {
		return fmt.Errorf("failed to marshal local data: %w", err)
	}

	remoteDataJSON, err := json.Marshal(conflict.RemoteData)
	if err != nil {
		return fmt.Errorf("failed to marshal remote data: %w", err)
	}

	metadataJSON, err := json.Marshal(conflict.Metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	var resolvedDataJSON []byte
	if conflict.ResolvedData != nil {
		resolvedDataJSON, err = json.Marshal(conflict.ResolvedData)
		if err != nil {
			return fmt.Errorf("failed to marshal resolved data: %w", err)
		}
	}

	query := `
		INSERT INTO sync_conflicts (
			id, sync_log_id, step, entity_type, entity_id, entity_ultra_id,
			conflict_type, local_data, remote_data, local_modified_at, remote_modified_at,
			resolution_strategy, resolution_applied, resolved_at, resolved_by, resolved_data,
			created_at, metadata
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
		RETURNING id, created_at
	`

	err = r.pool.QueryRow(ctx, query,
		conflict.ID,
		conflict.SyncLogID,
		string(conflict.Step),
		conflict.EntityType,
		conflict.EntityID,
		conflict.EntityUltraID,
		conflict.ConflictType,
		localDataJSON,
		remoteDataJSON,
		conflict.LocalModifiedAt,
		conflict.RemoteModifiedAt,
		conflict.ResolutionStrategy,
		conflict.ResolutionApplied,
		conflict.ResolvedAt,
		conflict.ResolvedBy,
		resolvedDataJSON,
		conflict.CreatedAt,
		metadataJSON,
	).Scan(&conflict.ID, &conflict.CreatedAt)

	if err != nil {
		return fmt.Errorf("failed to record conflict: %w", err)
	}

	return nil
}

// ============================================================================
// CONFLICT RESOLUTION
// ============================================================================

// ResolveConflict resolves a conflict using a specified strategy
func (r *ConflictRepository) ResolveConflict(ctx context.Context, conflictID uuid.UUID, strategy string, customResolution map[string]interface{}, resolvedBy string) error {
	// Get conflict
	conflict, err := r.GetConflictByID(ctx, conflictID)
	if err != nil {
		return err
	}

	if conflict.ResolutionApplied {
		return fmt.Errorf("conflict already resolved")
	}

	// Apply resolution strategy
	var resolvedData map[string]interface{}

	switch strategy {
	case "local_wins":
		resolvedData = conflict.LocalData
	case "remote_wins":
		resolvedData = conflict.RemoteData
	case "merge":
		resolvedData = r.mergeData(conflict.LocalData, conflict.RemoteData)
	case "manual":
		if customResolution == nil {
			return fmt.Errorf("custom resolution required for manual strategy")
		}
		resolvedData = customResolution
	default:
		return fmt.Errorf("unknown resolution strategy: %s", strategy)
	}

	// Update conflict record
	resolvedAt := time.Now()
	resolvedDataJSON, err := json.Marshal(resolvedData)
	if err != nil {
		return fmt.Errorf("failed to marshal resolved data: %w", err)
	}

	query := `
		UPDATE sync_conflicts
		SET resolution_strategy = $2,
			resolution_applied = true,
			resolved_at = $3,
			resolved_by = $4,
			resolved_data = $5
		WHERE id = $1
	`

	_, err = r.pool.Exec(ctx, query,
		conflictID,
		strategy,
		resolvedAt,
		resolvedBy,
		resolvedDataJSON,
	)

	if err != nil {
		return fmt.Errorf("failed to update conflict: %w", err)
	}

	// Apply the resolution to the actual entity
	if err := r.applyResolution(ctx, conflict.EntityType, conflict.EntityID, resolvedData); err != nil {
		log.Printf("Warning: failed to apply resolution to entity: %v", err)
		return fmt.Errorf("resolution recorded but failed to apply: %w", err)
	}

	return nil
}

// ResolveConflicts resolves multiple conflicts at once
func (r *ConflictRepository) ResolveConflicts(ctx context.Context, request *models.ConflictResolutionRequest) (int, error) {
	resolved := 0

	for _, conflictID := range request.ConflictIDs {
		err := r.ResolveConflict(ctx, conflictID, request.ResolutionStrategy, request.CustomResolution, request.ResolvedBy)
		if err != nil {
			log.Printf("Failed to resolve conflict %s: %v", conflictID, err)
			continue
		}
		resolved++
	}

	// If ApplyToSimilar is true, find and resolve similar conflicts
	if request.ApplyToSimilar && len(request.ConflictIDs) > 0 {
		// Get first conflict as reference
		refConflict, err := r.GetConflictByID(ctx, request.ConflictIDs[0])
		if err == nil {
			similarCount, err := r.resolveSimilarConflicts(ctx, refConflict, request.ResolutionStrategy, request.ResolvedBy)
			if err != nil {
				log.Printf("Failed to resolve similar conflicts: %v", err)
			} else {
				resolved += similarCount
			}
		}
	}

	return resolved, nil
}

// resolveSimilarConflicts finds and resolves conflicts similar to the reference
func (r *ConflictRepository) resolveSimilarConflicts(ctx context.Context, refConflict *models.SyncConflict, strategy string, resolvedBy string) (int, error) {
	// Find unresolved conflicts of the same type and entity type
	query := `
		SELECT id
		FROM sync_conflicts
		WHERE entity_type = $1
		  AND conflict_type = $2
		  AND resolution_applied = false
		  AND id != $3
		LIMIT $4
	`

	rows, err := r.pool.Query(ctx, query, refConflict.EntityType, refConflict.ConflictType, refConflict.ID, constants.SimilarConflictLimit)
	if err != nil {
		return 0, fmt.Errorf("failed to find similar conflicts: %w", err)
	}
	defer rows.Close()

	conflictIDs := make([]uuid.UUID, 0)
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return 0, fmt.Errorf("failed to scan conflict ID: %w", err)
		}
		conflictIDs = append(conflictIDs, id)
	}

	// Resolve each similar conflict
	resolved := 0
	for _, id := range conflictIDs {
		if err := r.ResolveConflict(ctx, id, strategy, nil, resolvedBy); err != nil {
			log.Printf("Failed to resolve similar conflict %s: %v", id, err)
			continue
		}
		resolved++
	}

	return resolved, nil
}

// mergeData merges local and remote data (remote wins on conflicts)
func (r *ConflictRepository) mergeData(localData, remoteData map[string]interface{}) map[string]interface{} {
	merged := make(map[string]interface{})

	// Start with local data
	for k, v := range localData {
		merged[k] = v
	}

	// Override with remote data (remote wins)
	for k, v := range remoteData {
		merged[k] = v
	}

	return merged
}

// applyResolution applies the resolved data to the actual entity
func (r *ConflictRepository) applyResolution(ctx context.Context, entityType string, entityID uuid.UUID, resolvedData map[string]interface{}) error {
	// This is a simplified version - in production, you'd want more sophisticated logic
	switch entityType {
	case "brand":
		query := `
			UPDATE brands
			SET name = COALESCE($2, name),
				logo_url = COALESCE($3, logo_url),
				is_active = COALESCE($4, is_active),
				updated_at = NOW()
			WHERE id = $1
		`
		_, err := r.pool.Exec(ctx, query,
			entityID,
			resolvedData["name"],
			resolvedData["logo_url"],
			resolvedData["is_active"],
		)
		return err

	case "category":
		query := `
			UPDATE categories
			SET name = COALESCE($2, name),
				sort_order = COALESCE($3, sort_order),
				is_active = COALESCE($4, is_active),
				updated_at = NOW()
			WHERE id = $1
		`
		_, err := r.pool.Exec(ctx, query,
			entityID,
			resolvedData["name"],
			resolvedData["sort_order"],
			resolvedData["is_active"],
		)
		return err

	case "product":
		query := `
			UPDATE products
			SET name = COALESCE($2, name),
				description = COALESCE($3, description),
				is_active = COALESCE($4, is_active),
				updated_at = NOW()
			WHERE id = $1
		`
		_, err := r.pool.Exec(ctx, query,
			entityID,
			resolvedData["name"],
			resolvedData["description"],
			resolvedData["is_active"],
		)
		return err

	default:
		return fmt.Errorf("unsupported entity type for resolution: %s", entityType)
	}
}

// ============================================================================
// CONFLICT RULES
// ============================================================================

// FindApplicableRule finds the best matching rule for a conflict (with caching)
func (r *ConflictRepository) FindApplicableRule(ctx context.Context, entityType, conflictType string) (*models.SyncConflictRule, error) {
	// Create cache key
	cacheKey := entityType + ":" + conflictType

	// Check cache first (with read lock for thread safety)
	r.cacheMutex.RLock()
	cached, ok := r.ruleCache[cacheKey]
	r.cacheMutex.RUnlock()

	if ok {
		if time.Now().Before(cached.expiresAt) {
			return cached.rule, nil
		}
		// Cache expired, delete it (with write lock)
		r.cacheMutex.Lock()
		delete(r.ruleCache, cacheKey)
		r.cacheMutex.Unlock()
	}

	query := `
		SELECT id, name, entity_type, conflict_type, priority, conditions,
			   resolution_strategy, merge_strategy, is_active, created_by,
			   created_at, updated_at
		FROM sync_conflict_rules
		WHERE entity_type = $1
		  AND conflict_type = $2
		  AND is_active = true
		ORDER BY priority DESC
		LIMIT 1
	`

	var rule models.SyncConflictRule
	var conditionsJSON, mergeStrategyJSON []byte

	err := r.pool.QueryRow(ctx, query, entityType, conflictType).Scan(
		&rule.ID,
		&rule.Name,
		&rule.EntityType,
		&rule.ConflictType,
		&rule.Priority,
		&conditionsJSON,
		&rule.ResolutionStrategy,
		&mergeStrategyJSON,
		&rule.IsActive,
		&rule.CreatedBy,
		&rule.CreatedAt,
		&rule.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil // No rule found, not an error
		}
		return nil, fmt.Errorf("failed to find applicable rule: %w", err)
	}

	if len(conditionsJSON) > 0 {
		if err := json.Unmarshal(conditionsJSON, &rule.Conditions); err != nil {
			return nil, fmt.Errorf("failed to unmarshal conditions: %w", err)
		}
	}

	if len(mergeStrategyJSON) > 0 {
		if err := json.Unmarshal(mergeStrategyJSON, &rule.MergeStrategy); err != nil {
			return nil, fmt.Errorf("failed to unmarshal merge strategy: %w", err)
		}
	}

	// Cache the rule (with write lock for thread safety)
	r.cacheMutex.Lock()
	r.ruleCache[cacheKey] = &cachedRule{
		rule:      &rule,
		expiresAt: time.Now().Add(constants.ConflictRuleCacheTTL),
	}
	r.cacheMutex.Unlock()

	return &rule, nil
}

// CreateConflictRule creates a new conflict resolution rule
func (r *ConflictRepository) CreateConflictRule(ctx context.Context, rule *models.SyncConflictRule) error {
	if rule.ID == uuid.Nil {
		rule.ID = uuid.New()
	}

	now := time.Now()
	rule.CreatedAt = now
	rule.UpdatedAt = now

	conditionsJSON, err := json.Marshal(rule.Conditions)
	if err != nil {
		return fmt.Errorf("failed to marshal conditions: %w", err)
	}

	mergeStrategyJSON, err := json.Marshal(rule.MergeStrategy)
	if err != nil {
		return fmt.Errorf("failed to marshal merge strategy: %w", err)
	}

	query := `
		INSERT INTO sync_conflict_rules (
			id, name, entity_type, conflict_type, priority, conditions,
			resolution_strategy, merge_strategy, is_active, created_by,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id
	`

	err = r.pool.QueryRow(ctx, query,
		rule.ID,
		rule.Name,
		rule.EntityType,
		rule.ConflictType,
		rule.Priority,
		conditionsJSON,
		rule.ResolutionStrategy,
		mergeStrategyJSON,
		rule.IsActive,
		rule.CreatedBy,
		rule.CreatedAt,
		rule.UpdatedAt,
	).Scan(&rule.ID)

	if err != nil {
		return fmt.Errorf("failed to create conflict rule: %w", err)
	}

	return nil
}

// UpdateConflictRule updates an existing conflict resolution rule
func (r *ConflictRepository) UpdateConflictRule(ctx context.Context, rule *models.SyncConflictRule) error {
	rule.UpdatedAt = time.Now()

	conditionsJSON, err := json.Marshal(rule.Conditions)
	if err != nil {
		return fmt.Errorf("failed to marshal conditions: %w", err)
	}

	mergeStrategyJSON, err := json.Marshal(rule.MergeStrategy)
	if err != nil {
		return fmt.Errorf("failed to marshal merge strategy: %w", err)
	}

	query := `
		UPDATE sync_conflict_rules
		SET name = $2,
			priority = $3,
			conditions = $4,
			resolution_strategy = $5,
			merge_strategy = $6,
			is_active = $7,
			updated_at = $8
		WHERE id = $1
	`

	result, err := r.pool.Exec(ctx, query,
		rule.ID,
		rule.Name,
		rule.Priority,
		conditionsJSON,
		rule.ResolutionStrategy,
		mergeStrategyJSON,
		rule.IsActive,
		rule.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to update conflict rule: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("conflict rule not found: %s", rule.ID)
	}

	// Invalidate cache for this rule after successful update
	cacheKey := rule.EntityType + ":" + rule.ConflictType
	r.cacheMutex.Lock()
	delete(r.ruleCache, cacheKey)
	r.cacheMutex.Unlock()

	return nil
}

// DeleteConflictRule deletes a conflict resolution rule
func (r *ConflictRepository) DeleteConflictRule(ctx context.Context, ruleID uuid.UUID) error {
	// First, get the rule to extract entity_type and conflict_type for cache invalidation
	var entityType, conflictType string
	selectQuery := `SELECT entity_type, conflict_type FROM sync_conflict_rules WHERE id = $1`
	err := r.pool.QueryRow(ctx, selectQuery, ruleID).Scan(&entityType, &conflictType)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fmt.Errorf("conflict rule not found: %s", ruleID)
		}
		return fmt.Errorf("failed to fetch rule for deletion: %w", err)
	}

	// Delete the rule
	query := `DELETE FROM sync_conflict_rules WHERE id = $1`
	result, err := r.pool.Exec(ctx, query, ruleID)
	if err != nil {
		return fmt.Errorf("failed to delete conflict rule: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("conflict rule not found: %s", ruleID)
	}

	// Invalidate cache for this rule after successful deletion
	cacheKey := entityType + ":" + conflictType
	r.cacheMutex.Lock()
	delete(r.ruleCache, cacheKey)
	r.cacheMutex.Unlock()

	return nil
}

// ListConflictRules lists all conflict resolution rules
func (r *ConflictRepository) ListConflictRules(ctx context.Context, activeOnly bool) ([]models.SyncConflictRule, error) {
	query := `
		SELECT id, name, entity_type, conflict_type, priority, conditions,
			   resolution_strategy, merge_strategy, is_active, created_by,
			   created_at, updated_at
		FROM sync_conflict_rules
	`

	if activeOnly {
		query += ` WHERE is_active = true`
	}

	query += ` ORDER BY priority DESC, created_at DESC`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list conflict rules: %w", err)
	}
	defer rows.Close()

	rules := make([]models.SyncConflictRule, 0)

	for rows.Next() {
		var rule models.SyncConflictRule
		var conditionsJSON, mergeStrategyJSON []byte

		err := rows.Scan(
			&rule.ID,
			&rule.Name,
			&rule.EntityType,
			&rule.ConflictType,
			&rule.Priority,
			&conditionsJSON,
			&rule.ResolutionStrategy,
			&mergeStrategyJSON,
			&rule.IsActive,
			&rule.CreatedBy,
			&rule.CreatedAt,
			&rule.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan conflict rule: %w", err)
		}

		if len(conditionsJSON) > 0 {
			if err := json.Unmarshal(conditionsJSON, &rule.Conditions); err != nil {
				return nil, fmt.Errorf("failed to unmarshal conditions: %w", err)
			}
		}

		if len(mergeStrategyJSON) > 0 {
			if err := json.Unmarshal(mergeStrategyJSON, &rule.MergeStrategy); err != nil {
				return nil, fmt.Errorf("failed to unmarshal merge strategy: %w", err)
			}
		}

		rules = append(rules, rule)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating conflict rules: %w", err)
	}

	return rules, nil
}

// ============================================================================
// CONFLICT QUERIES
// ============================================================================

// GetConflictByID retrieves a conflict by ID
func (r *ConflictRepository) GetConflictByID(ctx context.Context, conflictID uuid.UUID) (*models.SyncConflict, error) {
	query := `
		SELECT id, sync_log_id, step, entity_type, entity_id, entity_ultra_id,
			   conflict_type, local_data, remote_data, local_modified_at, remote_modified_at,
			   resolution_strategy, resolution_applied, resolved_at, resolved_by, resolved_data,
			   created_at, metadata
		FROM sync_conflicts
		WHERE id = $1
	`

	var conflict models.SyncConflict
	var stepStr string
	var localDataJSON, remoteDataJSON, resolvedDataJSON, metadataJSON []byte

	err := r.pool.QueryRow(ctx, query, conflictID).Scan(
		&conflict.ID,
		&conflict.SyncLogID,
		&stepStr,
		&conflict.EntityType,
		&conflict.EntityID,
		&conflict.EntityUltraID,
		&conflict.ConflictType,
		&localDataJSON,
		&remoteDataJSON,
		&conflict.LocalModifiedAt,
		&conflict.RemoteModifiedAt,
		&conflict.ResolutionStrategy,
		&conflict.ResolutionApplied,
		&conflict.ResolvedAt,
		&conflict.ResolvedBy,
		&resolvedDataJSON,
		&conflict.CreatedAt,
		&metadataJSON,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("conflict not found: %s", conflictID)
		}
		return nil, fmt.Errorf("failed to get conflict: %w", err)
	}

	conflict.Step = models.SyncStep(stepStr)

	if err := json.Unmarshal(localDataJSON, &conflict.LocalData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal local data: %w", err)
	}

	if err := json.Unmarshal(remoteDataJSON, &conflict.RemoteData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal remote data: %w", err)
	}

	if len(resolvedDataJSON) > 0 {
		if err := json.Unmarshal(resolvedDataJSON, &conflict.ResolvedData); err != nil {
			return nil, fmt.Errorf("failed to unmarshal resolved data: %w", err)
		}
	}

	if len(metadataJSON) > 0 {
		if err := json.Unmarshal(metadataJSON, &conflict.Metadata); err != nil {
			return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
		}
	}

	return &conflict, nil
}

// ListConflicts lists conflicts with filtering and pagination
func (r *ConflictRepository) ListConflicts(ctx context.Context, syncLogID *uuid.UUID, unresolvedOnly bool, limit, offset int) ([]models.SyncConflict, int, error) {
	// Build query using parameterized queries (no string concatenation)
	countQuery := "SELECT COUNT(*) FROM sync_conflicts WHERE 1=1"
	listQuery := `
		SELECT id, sync_log_id, step, entity_type, entity_id, entity_ultra_id,
			   conflict_type, local_data, remote_data, local_modified_at, remote_modified_at,
			   resolution_strategy, resolution_applied, resolved_at, resolved_by, resolved_data,
			   created_at, metadata
		FROM sync_conflicts
		WHERE 1=1
	`

	args := make([]interface{}, 0)
	argPos := 1

	if syncLogID != nil {
		countQuery += " AND sync_log_id = $" + strconv.Itoa(argPos)
		listQuery += " AND sync_log_id = $" + strconv.Itoa(argPos)
		args = append(args, *syncLogID)
		argPos++
	}

	if unresolvedOnly {
		countQuery += " AND resolution_applied = false"
		listQuery += " AND resolution_applied = false"
	}

	listQuery += " ORDER BY created_at DESC LIMIT $" + strconv.Itoa(argPos) + " OFFSET $" + strconv.Itoa(argPos+1)
	args = append(args, limit, offset)

	// Get total count
	var total int
	countArgs := args[:len(args)-2] // Exclude limit and offset
	if len(countArgs) == 0 {
		err := r.pool.QueryRow(ctx, countQuery).Scan(&total)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to count conflicts: %w", err)
		}
	} else {
		err := r.pool.QueryRow(ctx, countQuery, countArgs...).Scan(&total)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to count conflicts: %w", err)
		}
	}

	// Get conflicts
	rows, err := r.pool.Query(ctx, listQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list conflicts: %w", err)
	}
	defer rows.Close()

	conflicts := make([]models.SyncConflict, 0)

	for rows.Next() {
		var conflict models.SyncConflict
		var stepStr string
		var localDataJSON, remoteDataJSON, resolvedDataJSON, metadataJSON []byte

		err := rows.Scan(
			&conflict.ID,
			&conflict.SyncLogID,
			&stepStr,
			&conflict.EntityType,
			&conflict.EntityID,
			&conflict.EntityUltraID,
			&conflict.ConflictType,
			&localDataJSON,
			&remoteDataJSON,
			&conflict.LocalModifiedAt,
			&conflict.RemoteModifiedAt,
			&conflict.ResolutionStrategy,
			&conflict.ResolutionApplied,
			&conflict.ResolvedAt,
			&conflict.ResolvedBy,
			&resolvedDataJSON,
			&conflict.CreatedAt,
			&metadataJSON,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan conflict: %w", err)
		}

		conflict.Step = models.SyncStep(stepStr)

		if err := json.Unmarshal(localDataJSON, &conflict.LocalData); err != nil {
			return nil, 0, fmt.Errorf("failed to unmarshal local data: %w", err)
		}

		if err := json.Unmarshal(remoteDataJSON, &conflict.RemoteData); err != nil {
			return nil, 0, fmt.Errorf("failed to unmarshal remote data: %w", err)
		}

		if len(resolvedDataJSON) > 0 {
			if err := json.Unmarshal(resolvedDataJSON, &conflict.ResolvedData); err != nil {
				return nil, 0, fmt.Errorf("failed to unmarshal resolved data: %w", err)
			}
		}

		if len(metadataJSON) > 0 {
			if err := json.Unmarshal(metadataJSON, &conflict.Metadata); err != nil {
				return nil, 0, fmt.Errorf("failed to unmarshal metadata: %w", err)
			}
		}

		conflicts = append(conflicts, conflict)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating conflicts: %w", err)
	}

	return conflicts, total, nil
}
