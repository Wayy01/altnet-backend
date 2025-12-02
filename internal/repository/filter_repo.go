package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"ultra-api-testing/internal/models"
)

// filterAllowedFields defines the whitelist of allowed database column names per entity type.
// This prevents SQL injection by ensuring only known columns can be used in filter queries.
var filterAllowedFields = map[models.FilterEntityType]map[string]bool{
	models.FilterEntityProducts: {
		"id": true, "ultra_id": true, "code": true, "article": true, "name": true, "slug": true,
		"brand_id": true, "category_id": true, "parent_id": true, "source_id": true,
		"price_min": true, "price_max": true, "price_mdl": true, "price_eur": true, "price_usd": true,
		"total_stock": true, "is_in_stock": true, "is_active": true, "is_service": true,
		"description": true, "main_image_url": true, "warranty": true,
		"created_at": true, "updated_at": true,
	},
	models.FilterEntityBrands: {
		"id": true, "ultra_id": true, "code": true, "name": true, "slug": true,
		"logo_url": true, "is_active": true, "product_count": true,
		"created_at": true, "updated_at": true,
	},
	models.FilterEntityCategories: {
		"id": true, "ultra_id": true, "code": true, "name": true, "slug": true,
		"parent_id": true, "sort_order": true, "image_url": true, "is_active": true, "product_count": true,
		"created_at": true, "updated_at": true,
	},
}

// filterFieldNameRegex validates that field names only contain safe characters
var filterFieldNameRegex = regexp.MustCompile(`^[a-z][a-z0-9_]*$`)

// validateFilterFieldName checks if a field name is allowed for the given entity type in filter queries.
func validateFilterFieldName(entityType models.FilterEntityType, fieldName string) error {
	// First check the field name format (only lowercase letters, numbers, underscores)
	if !filterFieldNameRegex.MatchString(fieldName) {
		return fmt.Errorf("field name contains invalid characters: %s", fieldName)
	}

	// Check if entity type has an allowlist
	allowedFields, ok := filterAllowedFields[entityType]
	if !ok {
		return fmt.Errorf("unknown entity type: %s", entityType)
	}

	// Check if field is in the allowlist
	if !allowedFields[fieldName] {
		return fmt.Errorf("field '%s' is not allowed for entity type '%s'", fieldName, entityType)
	}

	return nil
}

// Sentinel errors for filter repository operations
var (
	ErrFilterNotFound = errors.New("filter not found")
)

// FilterRepository handles sync entity filter database operations
type FilterRepository struct {
	pool *pgxpool.Pool
}

// NewFilterRepository creates a new filter repository
func NewFilterRepository(pool *pgxpool.Pool) *FilterRepository {
	return &FilterRepository{pool: pool}
}

// filterCriteriaJSON represents the JSONB structure stored in database
type filterCriteriaJSON struct {
	Conditions []models.FilterCondition `json:"conditions"`
	Logic      models.FilterLogic       `json:"logic"`
	Name       string                   `json:"name,omitempty"`
	Description string                  `json:"description,omitempty"`
	IsActive   bool                     `json:"is_active"`
	Priority   int                      `json:"priority"`
}

// CreateFilter creates a new sync entity filter
func (r *FilterRepository) CreateFilter(ctx context.Context, req *models.FilterCreateRequest) (*models.SyncEntityFilterEnhanced, error) {
	// Validate request
	if err := req.Validate(); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	// Build filter criteria JSONB
	criteria := filterCriteriaJSON{
		Conditions:  req.Conditions,
		Logic:       req.Logic,
		Name:        req.Name,
		Description: req.Description,
		IsActive:    true,
		Priority:    req.Priority,
	}

	criteriaJSON, err := json.Marshal(criteria)
	if err != nil {
		return nil, fmt.Errorf("marshal filter criteria: %w", err)
	}

	query := `
		INSERT INTO sync_entity_filters (
			configuration_id, entity_type, filter_type, filter_criteria
		) VALUES ($1, $2, $3, $4)
		RETURNING id, configuration_id, entity_type, filter_type, filter_criteria, created_at
	`

	filter := &models.SyncEntityFilterEnhanced{}
	var configID *uuid.UUID
	var criteriaBytes []byte

	err = r.pool.QueryRow(ctx, query,
		req.ConfigurationID,
		string(req.EntityType),
		string(req.FilterType),
		criteriaJSON,
	).Scan(
		&filter.ID,
		&configID,
		&filter.EntityType,
		&filter.FilterType,
		&criteriaBytes,
		&filter.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create filter: %w", err)
	}

	filter.ConfigurationID = configID
	filter.UpdatedAt = filter.CreatedAt

	// Parse criteria back
	if err := r.parseCriteria(criteriaBytes, filter); err != nil {
		return nil, fmt.Errorf("parse filter criteria: %w", err)
	}

	return filter, nil
}

// UpdateFilter updates an existing filter
func (r *FilterRepository) UpdateFilter(ctx context.Context, id uuid.UUID, req *models.FilterUpdateRequest) (*models.SyncEntityFilterEnhanced, error) {
	// Validate request
	if err := req.Validate(); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	// Get existing filter first
	existing, err := r.GetFilter(ctx, id)
	if err != nil {
		return nil, err
	}

	// Build updated values
	entityType := existing.EntityType
	filterType := existing.FilterType
	configID := existing.ConfigurationID
	conditions := existing.Conditions
	logic := existing.Logic
	name := existing.Name
	description := existing.Description
	isActive := existing.IsActive
	priority := existing.Priority

	if req.EntityType != nil {
		entityType = *req.EntityType
	}
	if req.FilterType != nil {
		filterType = *req.FilterType
	}
	if req.ConfigurationID != nil {
		configID = req.ConfigurationID
	}
	if req.Conditions != nil {
		conditions = req.Conditions
	}
	if req.Logic != nil {
		logic = *req.Logic
	}
	if req.Name != nil {
		name = *req.Name
	}
	if req.Description != nil {
		description = *req.Description
	}
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	if req.Priority != nil {
		priority = *req.Priority
	}

	// Build filter criteria JSONB
	criteria := filterCriteriaJSON{
		Conditions:  conditions,
		Logic:       logic,
		Name:        name,
		Description: description,
		IsActive:    isActive,
		Priority:    priority,
	}

	criteriaJSON, err := json.Marshal(criteria)
	if err != nil {
		return nil, fmt.Errorf("marshal filter criteria: %w", err)
	}

	query := `
		UPDATE sync_entity_filters
		SET configuration_id = $1, entity_type = $2, filter_type = $3, filter_criteria = $4
		WHERE id = $5
		RETURNING id, configuration_id, entity_type, filter_type, filter_criteria, created_at
	`

	filter := &models.SyncEntityFilterEnhanced{}
	var returnedConfigID *uuid.UUID
	var criteriaBytes []byte

	err = r.pool.QueryRow(ctx, query,
		configID,
		string(entityType),
		string(filterType),
		criteriaJSON,
		id,
	).Scan(
		&filter.ID,
		&returnedConfigID,
		&filter.EntityType,
		&filter.FilterType,
		&criteriaBytes,
		&filter.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrFilterNotFound
		}
		return nil, fmt.Errorf("update filter: %w", err)
	}

	filter.ConfigurationID = returnedConfigID
	filter.UpdatedAt = time.Now()

	// Parse criteria back
	if err := r.parseCriteria(criteriaBytes, filter); err != nil {
		return nil, fmt.Errorf("parse filter criteria: %w", err)
	}

	return filter, nil
}

// DeleteFilter deletes a filter by ID
func (r *FilterRepository) DeleteFilter(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM sync_entity_filters WHERE id = $1`

	cmdTag, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete filter: %w", err)
	}

	if cmdTag.RowsAffected() == 0 {
		return ErrFilterNotFound
	}

	return nil
}

// ListFilters retrieves all filters with pagination
func (r *FilterRepository) ListFilters(ctx context.Context, limit, offset int) ([]*models.SyncEntityFilterEnhanced, int, error) {
	// Get total count
	var total int
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM sync_entity_filters").Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count filters: %w", err)
	}

	query := `
		SELECT id, configuration_id, entity_type, filter_type, filter_criteria, created_at
		FROM sync_entity_filters
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("query filters: %w", err)
	}
	defer rows.Close()

	filters := make([]*models.SyncEntityFilterEnhanced, 0)
	for rows.Next() {
		filter := &models.SyncEntityFilterEnhanced{}
		var configID *uuid.UUID
		var criteriaBytes []byte

		err := rows.Scan(
			&filter.ID,
			&configID,
			&filter.EntityType,
			&filter.FilterType,
			&criteriaBytes,
			&filter.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan filter: %w", err)
		}

		filter.ConfigurationID = configID
		filter.UpdatedAt = filter.CreatedAt

		// Parse criteria
		if err := r.parseCriteria(criteriaBytes, filter); err != nil {
			return nil, 0, fmt.Errorf("parse filter criteria: %w", err)
		}

		filters = append(filters, filter)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate filters: %w", err)
	}

	return filters, total, nil
}

// GetFilter retrieves a single filter by ID
func (r *FilterRepository) GetFilter(ctx context.Context, id uuid.UUID) (*models.SyncEntityFilterEnhanced, error) {
	query := `
		SELECT id, configuration_id, entity_type, filter_type, filter_criteria, created_at
		FROM sync_entity_filters
		WHERE id = $1
	`

	filter := &models.SyncEntityFilterEnhanced{}
	var configID *uuid.UUID
	var criteriaBytes []byte

	err := r.pool.QueryRow(ctx, query, id).Scan(
		&filter.ID,
		&configID,
		&filter.EntityType,
		&filter.FilterType,
		&criteriaBytes,
		&filter.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrFilterNotFound
		}
		return nil, fmt.Errorf("get filter: %w", err)
	}

	filter.ConfigurationID = configID
	filter.UpdatedAt = filter.CreatedAt

	// Parse criteria
	if err := r.parseCriteria(criteriaBytes, filter); err != nil {
		return nil, fmt.Errorf("parse filter criteria: %w", err)
	}

	return filter, nil
}

// GetActiveFilters retrieves all active filters
func (r *FilterRepository) GetActiveFilters(ctx context.Context) ([]*models.SyncEntityFilterEnhanced, error) {
	query := `
		SELECT id, configuration_id, entity_type, filter_type, filter_criteria, created_at
		FROM sync_entity_filters
		WHERE filter_criteria->>'is_active' = 'true'
		ORDER BY (filter_criteria->>'priority')::int DESC, created_at DESC
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query active filters: %w", err)
	}
	defer rows.Close()

	filters := make([]*models.SyncEntityFilterEnhanced, 0)
	for rows.Next() {
		filter := &models.SyncEntityFilterEnhanced{}
		var configID *uuid.UUID
		var criteriaBytes []byte

		err := rows.Scan(
			&filter.ID,
			&configID,
			&filter.EntityType,
			&filter.FilterType,
			&criteriaBytes,
			&filter.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan filter: %w", err)
		}

		filter.ConfigurationID = configID
		filter.UpdatedAt = filter.CreatedAt

		// Parse criteria
		if err := r.parseCriteria(criteriaBytes, filter); err != nil {
			return nil, fmt.Errorf("parse filter criteria: %w", err)
		}

		filters = append(filters, filter)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate active filters: %w", err)
	}

	return filters, nil
}

// GetFiltersByEntityType retrieves all filters for a specific entity type
func (r *FilterRepository) GetFiltersByEntityType(ctx context.Context, entityType models.FilterEntityType) ([]*models.SyncEntityFilterEnhanced, error) {
	query := `
		SELECT id, configuration_id, entity_type, filter_type, filter_criteria, created_at
		FROM sync_entity_filters
		WHERE entity_type = $1
		ORDER BY (filter_criteria->>'priority')::int DESC, created_at DESC
	`

	rows, err := r.pool.Query(ctx, query, string(entityType))
	if err != nil {
		return nil, fmt.Errorf("query filters by entity type: %w", err)
	}
	defer rows.Close()

	filters := make([]*models.SyncEntityFilterEnhanced, 0)
	for rows.Next() {
		filter := &models.SyncEntityFilterEnhanced{}
		var configID *uuid.UUID
		var criteriaBytes []byte

		err := rows.Scan(
			&filter.ID,
			&configID,
			&filter.EntityType,
			&filter.FilterType,
			&criteriaBytes,
			&filter.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan filter: %w", err)
		}

		filter.ConfigurationID = configID
		filter.UpdatedAt = filter.CreatedAt

		// Parse criteria
		if err := r.parseCriteria(criteriaBytes, filter); err != nil {
			return nil, fmt.Errorf("parse filter criteria: %w", err)
		}

		filters = append(filters, filter)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate filters: %w", err)
	}

	return filters, nil
}

// ToggleFilter enables or disables a filter
func (r *FilterRepository) ToggleFilter(ctx context.Context, id uuid.UUID) (*models.SyncEntityFilterEnhanced, error) {
	// Get existing filter first
	existing, err := r.GetFilter(ctx, id)
	if err != nil {
		return nil, err
	}

	// Toggle is_active
	newIsActive := !existing.IsActive

	// Build updated criteria
	criteria := filterCriteriaJSON{
		Conditions:  existing.Conditions,
		Logic:       existing.Logic,
		Name:        existing.Name,
		Description: existing.Description,
		IsActive:    newIsActive,
		Priority:    existing.Priority,
	}

	criteriaJSON, err := json.Marshal(criteria)
	if err != nil {
		return nil, fmt.Errorf("marshal filter criteria: %w", err)
	}

	query := `
		UPDATE sync_entity_filters
		SET filter_criteria = $1
		WHERE id = $2
		RETURNING id, configuration_id, entity_type, filter_type, filter_criteria, created_at
	`

	filter := &models.SyncEntityFilterEnhanced{}
	var configID *uuid.UUID
	var criteriaBytes []byte

	err = r.pool.QueryRow(ctx, query, criteriaJSON, id).Scan(
		&filter.ID,
		&configID,
		&filter.EntityType,
		&filter.FilterType,
		&criteriaBytes,
		&filter.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrFilterNotFound
		}
		return nil, fmt.Errorf("toggle filter: %w", err)
	}

	filter.ConfigurationID = configID
	filter.UpdatedAt = time.Now()

	// Parse criteria back
	if err := r.parseCriteria(criteriaBytes, filter); err != nil {
		return nil, fmt.Errorf("parse filter criteria: %w", err)
	}

	return filter, nil
}

// TestFilter tests a filter and returns matching entity count
func (r *FilterRepository) TestFilter(ctx context.Context, id uuid.UUID) (*models.FilterTestResult, error) {
	startTime := time.Now()

	// Get the filter
	filter, err := r.GetFilter(ctx, id)
	if err != nil {
		return nil, err
	}

	// Determine table name based on entity type
	tableName := ""
	switch filter.EntityType {
	case models.FilterEntityProducts:
		tableName = "products"
	case models.FilterEntityBrands:
		tableName = "brands"
	case models.FilterEntityCategories:
		tableName = "categories"
	default:
		return nil, fmt.Errorf("unsupported entity type: %s", filter.EntityType)
	}

	// Get total count
	var totalCount int
	err = r.pool.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s", tableName)).Scan(&totalCount)
	if err != nil {
		return nil, fmt.Errorf("count total entities: %w", err)
	}

	// Build WHERE clause from filter conditions (with field validation)
	whereClause, args, err := buildWhereClause(filter.EntityType, filter.Conditions, filter.Logic)
	if err != nil {
		return nil, fmt.Errorf("build where clause: %w", err)
	}

	// Get matching count
	var matchingCount int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s", tableName)
	if whereClause != "" {
		countQuery += " WHERE " + whereClause
	}

	err = r.pool.QueryRow(ctx, countQuery, args...).Scan(&matchingCount)
	if err != nil {
		return nil, fmt.Errorf("count matching entities: %w", err)
	}

	// Get sample entity IDs (up to 10)
	sampleQuery := fmt.Sprintf("SELECT id::text FROM %s", tableName)
	if whereClause != "" {
		sampleQuery += " WHERE " + whereClause
	}
	sampleQuery += " LIMIT 10"

	rows, err := r.pool.Query(ctx, sampleQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("query sample entities: %w", err)
	}
	defer rows.Close()

	sampleIDs := make([]string, 0)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scan sample id: %w", err)
		}
		sampleIDs = append(sampleIDs, id)
	}

	executionTime := time.Since(startTime).Milliseconds()

	// Calculate match percentage
	var matchPercentage float64
	if totalCount > 0 {
		matchPercentage = float64(matchingCount) / float64(totalCount) * 100
	}

	// Build the generated query for debugging
	generatedQuery := countQuery

	return &models.FilterTestResult{
		FilterID:        filter.ID,
		EntityType:      string(filter.EntityType),
		FilterType:      string(filter.FilterType),
		MatchingCount:   matchingCount,
		TotalCount:      totalCount,
		MatchPercentage: matchPercentage,
		SampleEntityIDs: sampleIDs,
		ExecutionTimeMs: executionTime,
		QueryGenerated:  generatedQuery,
	}, nil
}

// GetActiveFiltersByEntityType retrieves all active filters for a specific entity type
func (r *FilterRepository) GetActiveFiltersByEntityType(ctx context.Context, entityType models.FilterEntityType) ([]*models.SyncEntityFilterEnhanced, error) {
	query := `
		SELECT id, configuration_id, entity_type, filter_type, filter_criteria, created_at
		FROM sync_entity_filters
		WHERE entity_type = $1 AND filter_criteria->>'is_active' = 'true'
		ORDER BY (filter_criteria->>'priority')::int DESC, created_at DESC
	`

	rows, err := r.pool.Query(ctx, query, string(entityType))
	if err != nil {
		return nil, fmt.Errorf("query active filters by entity type: %w", err)
	}
	defer rows.Close()

	filters := make([]*models.SyncEntityFilterEnhanced, 0)
	for rows.Next() {
		filter := &models.SyncEntityFilterEnhanced{}
		var configID *uuid.UUID
		var criteriaBytes []byte

		err := rows.Scan(
			&filter.ID,
			&configID,
			&filter.EntityType,
			&filter.FilterType,
			&criteriaBytes,
			&filter.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan filter: %w", err)
		}

		filter.ConfigurationID = configID
		filter.UpdatedAt = filter.CreatedAt

		// Parse criteria
		if err := r.parseCriteria(criteriaBytes, filter); err != nil {
			return nil, fmt.Errorf("parse filter criteria: %w", err)
		}

		filters = append(filters, filter)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate filters: %w", err)
	}

	return filters, nil
}

// parseCriteria parses the filter criteria JSONB into the enhanced filter struct
func (r *FilterRepository) parseCriteria(criteriaBytes []byte, filter *models.SyncEntityFilterEnhanced) error {
	if len(criteriaBytes) == 0 {
		return nil
	}

	var criteria filterCriteriaJSON
	if err := json.Unmarshal(criteriaBytes, &criteria); err != nil {
		return fmt.Errorf("unmarshal criteria: %w", err)
	}

	filter.Conditions = criteria.Conditions
	filter.Logic = criteria.Logic
	filter.Name = criteria.Name
	filter.Description = criteria.Description
	filter.IsActive = criteria.IsActive
	filter.Priority = criteria.Priority

	return nil
}

// buildWhereClause builds a SQL WHERE clause from filter conditions.
// Validates all field names against the allowed list for the entity type.
func buildWhereClause(entityType models.FilterEntityType, conditions []models.FilterCondition, logic models.FilterLogic) (string, []interface{}, error) {
	if len(conditions) == 0 {
		return "", nil, nil
	}

	// Validate all field names before building query
	for i, cond := range conditions {
		if err := validateFilterFieldName(entityType, cond.Field); err != nil {
			return "", nil, fmt.Errorf("condition %d: %w", i, err)
		}
	}

	clauses := make([]string, 0, len(conditions))
	args := make([]interface{}, 0, len(conditions))
	argNum := 1

	for _, cond := range conditions {
		clause, arg := buildConditionClause(cond, &argNum)
		if clause != "" {
			clauses = append(clauses, clause)
			if arg != nil {
				args = append(args, arg)
			}
		}
	}

	if len(clauses) == 0 {
		return "", nil, nil
	}

	logicStr := " AND "
	if logic == models.LogicOR {
		logicStr = " OR "
	}

	whereClause := ""
	for i, clause := range clauses {
		if i > 0 {
			whereClause += logicStr
		}
		whereClause += clause
	}

	return whereClause, args, nil
}

// buildConditionClause builds a single SQL condition clause
func buildConditionClause(cond models.FilterCondition, argNum *int) (string, interface{}) {
	field := cond.Field

	switch cond.Operator {
	case models.OpEquals:
		clause := fmt.Sprintf("%s = $%d", field, *argNum)
		*argNum++
		return clause, cond.Value

	case models.OpNotEquals:
		clause := fmt.Sprintf("%s != $%d", field, *argNum)
		*argNum++
		return clause, cond.Value

	case models.OpContains:
		clause := fmt.Sprintf("%s ILIKE $%d", field, *argNum)
		*argNum++
		return clause, fmt.Sprintf("%%%v%%", cond.Value)

	case models.OpNotContains:
		clause := fmt.Sprintf("%s NOT ILIKE $%d", field, *argNum)
		*argNum++
		return clause, fmt.Sprintf("%%%v%%", cond.Value)

	case models.OpGreaterThan:
		clause := fmt.Sprintf("%s > $%d", field, *argNum)
		*argNum++
		return clause, cond.Value

	case models.OpLessThan:
		clause := fmt.Sprintf("%s < $%d", field, *argNum)
		*argNum++
		return clause, cond.Value

	case models.OpIn:
		// Value should be a slice
		clause := fmt.Sprintf("%s = ANY($%d)", field, *argNum)
		*argNum++
		return clause, cond.Value

	case models.OpNotIn:
		// Value should be a slice
		clause := fmt.Sprintf("NOT (%s = ANY($%d))", field, *argNum)
		*argNum++
		return clause, cond.Value

	case models.OpIsNull:
		return fmt.Sprintf("%s IS NULL", field), nil

	case models.OpIsNotNull:
		return fmt.Sprintf("%s IS NOT NULL", field), nil

	default:
		return "", nil
	}
}
