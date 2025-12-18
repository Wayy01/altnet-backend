package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gosimple/slug"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"ultra-api-testing/internal/models"
)

// Sentinel errors for catalog repository operations
var (
	ErrCatalogSectionNotFound = errors.New("catalog section not found")
	ErrCatalogGroupNotFound   = errors.New("catalog group not found")
	ErrCatalogItemNotFound    = errors.New("catalog item not found")
	ErrDuplicateSectionSlug   = errors.New("catalog section with this slug already exists")
	ErrInvalidColumnPosition  = errors.New("column position must be between 1 and 4")
	ErrInvalidItemType        = errors.New("invalid item type")
	ErrMissingCategoryID      = errors.New("category_id is required for category_link items")
	ErrMissingFilterConfig    = errors.New("filter_config is required for custom_filter items")
)

// CatalogRepository handles catalog database operations
type CatalogRepository struct {
	pool *pgxpool.Pool
}

// NewCatalogRepository creates a new catalog repository
func NewCatalogRepository(pool *pgxpool.Pool) *CatalogRepository {
	return &CatalogRepository{pool: pool}
}

// ============================================================================
// SECTION CRUD OPERATIONS
// ============================================================================

// CreateSection creates a new catalog section
func (r *CatalogRepository) CreateSection(ctx context.Context, input *models.CatalogSectionInput) (*models.CatalogSection, error) {
	// Validate input
	if err := r.validateSectionInput(input); err != nil {
		return nil, err
	}

	// Generate slug if not provided
	sectionSlug := r.generateSlug(input.NameRo, input.Slug)

	// Set defaults
	sortOrder := 0
	if input.SortOrder != nil {
		sortOrder = *input.SortOrder
	}
	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	query := `
		INSERT INTO catalog_sections (name_ro, name_ru, name_en, icon, slug, sort_order, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, name_ro, name_ru, name_en, icon, slug, sort_order, is_active, created_at, updated_at
	`

	section := &models.CatalogSection{}
	err := r.pool.QueryRow(ctx, query,
		strings.TrimSpace(input.NameRo),
		input.NameRu,
		input.NameEn,
		input.Icon,
		sectionSlug,
		sortOrder,
		isActive,
	).Scan(
		&section.ID,
		&section.NameRo,
		&section.NameRu,
		&section.NameEn,
		&section.Icon,
		&section.Slug,
		&section.SortOrder,
		&section.IsActive,
		&section.CreatedAt,
		&section.UpdatedAt,
	)
	if err != nil {
		// Check for unique constraint violation (duplicate slug)
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, ErrDuplicateSectionSlug
		}
		return nil, fmt.Errorf("create catalog section: %w", err)
	}

	return section, nil
}

// GetSection returns a catalog section by ID
func (r *CatalogRepository) GetSection(ctx context.Context, id uuid.UUID) (*models.CatalogSection, error) {
	query := `
		SELECT id, name_ro, name_ru, name_en, icon, slug, sort_order, is_active, created_at, updated_at
		FROM catalog_sections
		WHERE id = $1
	`

	section := &models.CatalogSection{}
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&section.ID,
		&section.NameRo,
		&section.NameRu,
		&section.NameEn,
		&section.Icon,
		&section.Slug,
		&section.SortOrder,
		&section.IsActive,
		&section.CreatedAt,
		&section.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCatalogSectionNotFound
		}
		return nil, fmt.Errorf("get catalog section: %w", err)
	}

	return section, nil
}

// GetSectionBySlug returns a catalog section by slug
func (r *CatalogRepository) GetSectionBySlug(ctx context.Context, slug string) (*models.CatalogSection, error) {
	query := `
		SELECT id, name_ro, name_ru, name_en, icon, slug, sort_order, is_active, created_at, updated_at
		FROM catalog_sections
		WHERE slug = $1
	`

	section := &models.CatalogSection{}
	err := r.pool.QueryRow(ctx, query, slug).Scan(
		&section.ID,
		&section.NameRo,
		&section.NameRu,
		&section.NameEn,
		&section.Icon,
		&section.Slug,
		&section.SortOrder,
		&section.IsActive,
		&section.CreatedAt,
		&section.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCatalogSectionNotFound
		}
		return nil, fmt.Errorf("get catalog section by slug: %w", err)
	}

	return section, nil
}

// UpdateSection updates an existing catalog section
func (r *CatalogRepository) UpdateSection(ctx context.Context, id uuid.UUID, input *models.CatalogSectionInput) (*models.CatalogSection, error) {
	// Validate input
	if err := r.validateSectionInput(input); err != nil {
		return nil, err
	}

	// Generate slug if not provided
	sectionSlug := r.generateSlug(input.NameRo, input.Slug)

	// Set defaults
	sortOrder := 0
	if input.SortOrder != nil {
		sortOrder = *input.SortOrder
	}
	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	query := `
		UPDATE catalog_sections
		SET name_ro = $1, name_ru = $2, name_en = $3, icon = $4, slug = $5, sort_order = $6, is_active = $7, updated_at = NOW()
		WHERE id = $8
		RETURNING id, name_ro, name_ru, name_en, icon, slug, sort_order, is_active, created_at, updated_at
	`

	section := &models.CatalogSection{}
	err := r.pool.QueryRow(ctx, query,
		strings.TrimSpace(input.NameRo),
		input.NameRu,
		input.NameEn,
		input.Icon,
		sectionSlug,
		sortOrder,
		isActive,
		id,
	).Scan(
		&section.ID,
		&section.NameRo,
		&section.NameRu,
		&section.NameEn,
		&section.Icon,
		&section.Slug,
		&section.SortOrder,
		&section.IsActive,
		&section.CreatedAt,
		&section.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCatalogSectionNotFound
		}
		// Check for unique constraint violation
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, ErrDuplicateSectionSlug
		}
		return nil, fmt.Errorf("update catalog section: %w", err)
	}

	return section, nil
}

// DeleteSection deletes a catalog section by ID (cascades to groups and items)
func (r *CatalogRepository) DeleteSection(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM catalog_sections WHERE id = $1`

	cmdTag, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete catalog section: %w", err)
	}

	if cmdTag.RowsAffected() == 0 {
		return ErrCatalogSectionNotFound
	}

	return nil
}

// ListSections returns all catalog sections, optionally filtering by active status
func (r *CatalogRepository) ListSections(ctx context.Context, activeOnly bool) ([]*models.CatalogSection, error) {
	query := `
		SELECT id, name_ro, name_ru, name_en, icon, slug, sort_order, is_active, created_at, updated_at
		FROM catalog_sections
	`

	if activeOnly {
		query += " WHERE is_active = true"
	}

	query += " ORDER BY sort_order ASC, created_at ASC"

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query catalog sections: %w", err)
	}
	defer rows.Close()

	var sections []*models.CatalogSection
	for rows.Next() {
		section := &models.CatalogSection{}
		if err := rows.Scan(
			&section.ID,
			&section.NameRo,
			&section.NameRu,
			&section.NameEn,
			&section.Icon,
			&section.Slug,
			&section.SortOrder,
			&section.IsActive,
			&section.CreatedAt,
			&section.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan catalog section: %w", err)
		}
		sections = append(sections, section)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate catalog sections: %w", err)
	}

	return sections, nil
}

// ReorderSections updates the sort_order of multiple sections
func (r *CatalogRepository) ReorderSections(ctx context.Context, orders []models.CatalogReorderRequest) error {
	if len(orders) == 0 {
		return nil
	}

	// Use a transaction for atomicity
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	query := `UPDATE catalog_sections SET sort_order = $1, updated_at = NOW() WHERE id = $2`

	batch := &pgx.Batch{}
	for _, order := range orders {
		batch.Queue(query, order.SortOrder, order.ID)
	}

	br := tx.SendBatch(ctx, batch)

	// Execute all updates
	for range orders {
		if _, err := br.Exec(); err != nil {
			br.Close()
			return fmt.Errorf("reorder catalog sections: %w", err)
		}
	}

	// Close batch results before commit (required by pgx)
	if err := br.Close(); err != nil {
		return fmt.Errorf("close batch results: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

// CloneSection creates a deep copy of a section with all its groups and items
func (r *CatalogRepository) CloneSection(ctx context.Context, id uuid.UUID) (*models.CatalogSection, error) {
	// Use a transaction for atomicity
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Get the original section
	originalSection, err := r.getSectionTx(ctx, tx, id)
	if err != nil {
		return nil, err
	}

	// Clone the section with a new slug
	clonedSlug := r.generateUniqueSlugTx(ctx, tx, originalSection.Slug+"-copy")

	cloneQuery := `
		INSERT INTO catalog_sections (name_ro, name_ru, name_en, icon, slug, sort_order, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, name_ro, name_ru, name_en, icon, slug, sort_order, is_active, created_at, updated_at
	`

	clonedSection := &models.CatalogSection{}
	err = tx.QueryRow(ctx, cloneQuery,
		originalSection.NameRo+" (Copy)",
		originalSection.NameRu,
		originalSection.NameEn,
		originalSection.Icon,
		clonedSlug,
		originalSection.SortOrder,
		originalSection.IsActive,
	).Scan(
		&clonedSection.ID,
		&clonedSection.NameRo,
		&clonedSection.NameRu,
		&clonedSection.NameEn,
		&clonedSection.Icon,
		&clonedSection.Slug,
		&clonedSection.SortOrder,
		&clonedSection.IsActive,
		&clonedSection.CreatedAt,
		&clonedSection.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("clone catalog section: %w", err)
	}

	// Clone all groups
	groupsQuery := `
		SELECT id, name_ro, name_ru, name_en, column_position, sort_order, filter_config, is_active
		FROM catalog_groups
		WHERE section_id = $1
		ORDER BY column_position, sort_order
	`

	groupRows, err := tx.Query(ctx, groupsQuery, id)
	if err != nil {
		return nil, fmt.Errorf("query groups for cloning: %w", err)
	}
	defer groupRows.Close()

	// Map old group IDs to new group IDs
	groupIDMap := make(map[uuid.UUID]uuid.UUID)

	for groupRows.Next() {
		var oldGroupID uuid.UUID
		var nameRo string
		var nameRu, nameEn *string
		var columnPosition, sortOrder int
		var filterConfig *models.CatalogFilterConfig
		var isActive bool

		if err := groupRows.Scan(&oldGroupID, &nameRo, &nameRu, &nameEn, &columnPosition, &sortOrder, &filterConfig, &isActive); err != nil {
			return nil, fmt.Errorf("scan group for cloning: %w", err)
		}

		// Insert cloned group
		cloneGroupQuery := `
			INSERT INTO catalog_groups (section_id, name_ro, name_ru, name_en, column_position, sort_order, filter_config, is_active)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING id
		`

		var newGroupID uuid.UUID
		err = tx.QueryRow(ctx, cloneGroupQuery,
			clonedSection.ID,
			nameRo,
			nameRu,
			nameEn,
			columnPosition,
			sortOrder,
			filterConfig,
			isActive,
		).Scan(&newGroupID)
		if err != nil {
			return nil, fmt.Errorf("clone catalog group: %w", err)
		}

		groupIDMap[oldGroupID] = newGroupID
	}

	if err := groupRows.Err(); err != nil {
		return nil, fmt.Errorf("iterate groups for cloning: %w", err)
	}

	// Clone all items for each group
	for oldGroupID, newGroupID := range groupIDMap {
		if err := r.cloneItemsForGroup(ctx, tx, oldGroupID, newGroupID); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}

	return clonedSection, nil
}

// ============================================================================
// GROUP CRUD OPERATIONS
// ============================================================================

// CreateGroup creates a new catalog group
func (r *CatalogRepository) CreateGroup(ctx context.Context, input *models.CatalogGroupInput) (*models.CatalogGroup, error) {
	// Validate input
	if err := r.validateGroupInput(input); err != nil {
		return nil, err
	}

	// Set defaults
	columnPosition := 1
	if input.ColumnPosition != nil {
		columnPosition = *input.ColumnPosition
	}
	sortOrder := 0
	if input.SortOrder != nil {
		sortOrder = *input.SortOrder
	}
	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	query := `
		INSERT INTO catalog_groups (section_id, name_ro, name_ru, name_en, column_position, sort_order, filter_config, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, section_id, name_ro, name_ru, name_en, column_position, sort_order, filter_config, is_active, created_at, updated_at
	`

	group := &models.CatalogGroup{}
	err := r.pool.QueryRow(ctx, query,
		input.SectionID,
		strings.TrimSpace(input.NameRo),
		input.NameRu,
		input.NameEn,
		columnPosition,
		sortOrder,
		input.FilterConfig,
		isActive,
	).Scan(
		&group.ID,
		&group.SectionID,
		&group.NameRo,
		&group.NameRu,
		&group.NameEn,
		&group.ColumnPosition,
		&group.SortOrder,
		&group.FilterConfig,
		&group.IsActive,
		&group.CreatedAt,
		&group.UpdatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			return nil, ErrCatalogSectionNotFound
		}
		return nil, fmt.Errorf("create catalog group: %w", err)
	}

	return group, nil
}

// GetGroup returns a catalog group by ID
func (r *CatalogRepository) GetGroup(ctx context.Context, id uuid.UUID) (*models.CatalogGroup, error) {
	query := `
		SELECT id, section_id, name_ro, name_ru, name_en, column_position, sort_order, filter_config, is_active, created_at, updated_at
		FROM catalog_groups
		WHERE id = $1
	`

	group := &models.CatalogGroup{}
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&group.ID,
		&group.SectionID,
		&group.NameRo,
		&group.NameRu,
		&group.NameEn,
		&group.ColumnPosition,
		&group.SortOrder,
		&group.FilterConfig,
		&group.IsActive,
		&group.CreatedAt,
		&group.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCatalogGroupNotFound
		}
		return nil, fmt.Errorf("get catalog group: %w", err)
	}

	return group, nil
}

// UpdateGroup updates an existing catalog group
func (r *CatalogRepository) UpdateGroup(ctx context.Context, id uuid.UUID, input *models.CatalogGroupInput) (*models.CatalogGroup, error) {
	// Validate input
	if err := r.validateGroupInput(input); err != nil {
		return nil, err
	}

	// Set defaults
	columnPosition := 1
	if input.ColumnPosition != nil {
		columnPosition = *input.ColumnPosition
	}
	sortOrder := 0
	if input.SortOrder != nil {
		sortOrder = *input.SortOrder
	}
	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	query := `
		UPDATE catalog_groups
		SET section_id = $1, name_ro = $2, name_ru = $3, name_en = $4, column_position = $5, sort_order = $6, filter_config = $7, is_active = $8, updated_at = NOW()
		WHERE id = $9
		RETURNING id, section_id, name_ro, name_ru, name_en, column_position, sort_order, filter_config, is_active, created_at, updated_at
	`

	group := &models.CatalogGroup{}
	err := r.pool.QueryRow(ctx, query,
		input.SectionID,
		strings.TrimSpace(input.NameRo),
		input.NameRu,
		input.NameEn,
		columnPosition,
		sortOrder,
		input.FilterConfig,
		isActive,
		id,
	).Scan(
		&group.ID,
		&group.SectionID,
		&group.NameRo,
		&group.NameRu,
		&group.NameEn,
		&group.ColumnPosition,
		&group.SortOrder,
		&group.FilterConfig,
		&group.IsActive,
		&group.CreatedAt,
		&group.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCatalogGroupNotFound
		}
		return nil, fmt.Errorf("update catalog group: %w", err)
	}

	return group, nil
}

// DeleteGroup deletes a catalog group by ID (cascades to items)
func (r *CatalogRepository) DeleteGroup(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM catalog_groups WHERE id = $1`

	cmdTag, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete catalog group: %w", err)
	}

	if cmdTag.RowsAffected() == 0 {
		return ErrCatalogGroupNotFound
	}

	return nil
}

// ListGroupsBySection returns all groups for a given section
func (r *CatalogRepository) ListGroupsBySection(ctx context.Context, sectionID uuid.UUID) ([]*models.CatalogGroup, error) {
	query := `
		SELECT id, section_id, name_ro, name_ru, name_en, column_position, sort_order, filter_config, is_active, created_at, updated_at
		FROM catalog_groups
		WHERE section_id = $1
		ORDER BY column_position ASC, sort_order ASC
	`

	rows, err := r.pool.Query(ctx, query, sectionID)
	if err != nil {
		return nil, fmt.Errorf("query catalog groups: %w", err)
	}
	defer rows.Close()

	var groups []*models.CatalogGroup
	for rows.Next() {
		group := &models.CatalogGroup{}
		if err := rows.Scan(
			&group.ID,
			&group.SectionID,
			&group.NameRo,
			&group.NameRu,
			&group.NameEn,
			&group.ColumnPosition,
			&group.SortOrder,
			&group.FilterConfig,
			&group.IsActive,
			&group.CreatedAt,
			&group.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan catalog group: %w", err)
		}
		groups = append(groups, group)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate catalog groups: %w", err)
	}

	return groups, nil
}

// ReorderGroups updates the sort_order of multiple groups
func (r *CatalogRepository) ReorderGroups(ctx context.Context, orders []models.CatalogReorderRequest) error {
	if len(orders) == 0 {
		return nil
	}

	// Use a transaction for atomicity
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	query := `UPDATE catalog_groups SET sort_order = $1, updated_at = NOW() WHERE id = $2`

	batch := &pgx.Batch{}
	for _, order := range orders {
		batch.Queue(query, order.SortOrder, order.ID)
	}

	br := tx.SendBatch(ctx, batch)

	// Execute all updates
	for range orders {
		if _, err := br.Exec(); err != nil {
			br.Close()
			return fmt.Errorf("reorder catalog groups: %w", err)
		}
	}

	// Close batch results before commit (required by pgx)
	if err := br.Close(); err != nil {
		return fmt.Errorf("close batch results: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

// ============================================================================
// ITEM CRUD OPERATIONS
// ============================================================================

// CreateItem creates a new catalog item
func (r *CatalogRepository) CreateItem(ctx context.Context, input *models.CatalogItemInput) (*models.CatalogItem, error) {
	// Validate input
	if err := r.validateItemInput(input); err != nil {
		return nil, err
	}

	// Set defaults
	sortOrder := 0
	if input.SortOrder != nil {
		sortOrder = *input.SortOrder
	}
	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	query := `
		INSERT INTO catalog_items (group_id, name_ro, name_ru, name_en, sort_order, item_type, category_id, filter_config, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, group_id, name_ro, name_ru, name_en, sort_order, item_type, category_id, filter_config, is_active, created_at, updated_at
	`

	item := &models.CatalogItem{}
	err := r.pool.QueryRow(ctx, query,
		input.GroupID,
		strings.TrimSpace(input.NameRo),
		input.NameRu,
		input.NameEn,
		sortOrder,
		input.ItemType,
		input.CategoryID,
		input.FilterConfig,
		isActive,
	).Scan(
		&item.ID,
		&item.GroupID,
		&item.NameRo,
		&item.NameRu,
		&item.NameEn,
		&item.SortOrder,
		&item.ItemType,
		&item.CategoryID,
		&item.FilterConfig,
		&item.IsActive,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			// Check which FK constraint failed based on constraint name
			if strings.Contains(pgErr.ConstraintName, "group") {
				return nil, ErrCatalogGroupNotFound
			}
			// Category FK violation - return a more specific error
			return nil, fmt.Errorf("category not found")
		}
		return nil, fmt.Errorf("create catalog item: %w", err)
	}

	return item, nil
}

// GetItem returns a catalog item by ID
func (r *CatalogRepository) GetItem(ctx context.Context, id uuid.UUID) (*models.CatalogItem, error) {
	query := `
		SELECT id, group_id, name_ro, name_ru, name_en, sort_order, item_type, category_id, filter_config, is_active, created_at, updated_at
		FROM catalog_items
		WHERE id = $1
	`

	item := &models.CatalogItem{}
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&item.ID,
		&item.GroupID,
		&item.NameRo,
		&item.NameRu,
		&item.NameEn,
		&item.SortOrder,
		&item.ItemType,
		&item.CategoryID,
		&item.FilterConfig,
		&item.IsActive,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCatalogItemNotFound
		}
		return nil, fmt.Errorf("get catalog item: %w", err)
	}

	return item, nil
}

// UpdateItem updates an existing catalog item
func (r *CatalogRepository) UpdateItem(ctx context.Context, id uuid.UUID, input *models.CatalogItemInput) (*models.CatalogItem, error) {
	// Validate input
	if err := r.validateItemInput(input); err != nil {
		return nil, err
	}

	// Set defaults
	sortOrder := 0
	if input.SortOrder != nil {
		sortOrder = *input.SortOrder
	}
	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	query := `
		UPDATE catalog_items
		SET group_id = $1, name_ro = $2, name_ru = $3, name_en = $4, sort_order = $5, item_type = $6, category_id = $7, filter_config = $8, is_active = $9, updated_at = NOW()
		WHERE id = $10
		RETURNING id, group_id, name_ro, name_ru, name_en, sort_order, item_type, category_id, filter_config, is_active, created_at, updated_at
	`

	item := &models.CatalogItem{}
	err := r.pool.QueryRow(ctx, query,
		input.GroupID,
		strings.TrimSpace(input.NameRo),
		input.NameRu,
		input.NameEn,
		sortOrder,
		input.ItemType,
		input.CategoryID,
		input.FilterConfig,
		isActive,
		id,
	).Scan(
		&item.ID,
		&item.GroupID,
		&item.NameRo,
		&item.NameRu,
		&item.NameEn,
		&item.SortOrder,
		&item.ItemType,
		&item.CategoryID,
		&item.FilterConfig,
		&item.IsActive,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCatalogItemNotFound
		}
		return nil, fmt.Errorf("update catalog item: %w", err)
	}

	return item, nil
}

// DeleteItem deletes a catalog item by ID
func (r *CatalogRepository) DeleteItem(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM catalog_items WHERE id = $1`

	cmdTag, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete catalog item: %w", err)
	}

	if cmdTag.RowsAffected() == 0 {
		return ErrCatalogItemNotFound
	}

	return nil
}

// ListItemsByGroup returns all items for a given group
func (r *CatalogRepository) ListItemsByGroup(ctx context.Context, groupID uuid.UUID) ([]*models.CatalogItem, error) {
	query := `
		SELECT id, group_id, name_ro, name_ru, name_en, sort_order, item_type, category_id, filter_config, is_active, created_at, updated_at
		FROM catalog_items
		WHERE group_id = $1
		ORDER BY sort_order ASC
	`

	rows, err := r.pool.Query(ctx, query, groupID)
	if err != nil {
		return nil, fmt.Errorf("query catalog items: %w", err)
	}
	defer rows.Close()

	var items []*models.CatalogItem
	for rows.Next() {
		item := &models.CatalogItem{}
		if err := rows.Scan(
			&item.ID,
			&item.GroupID,
			&item.NameRo,
			&item.NameRu,
			&item.NameEn,
			&item.SortOrder,
			&item.ItemType,
			&item.CategoryID,
			&item.FilterConfig,
			&item.IsActive,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan catalog item: %w", err)
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate catalog items: %w", err)
	}

	return items, nil
}

// ReorderItems updates the sort_order of multiple items
func (r *CatalogRepository) ReorderItems(ctx context.Context, orders []models.CatalogReorderRequest) error {
	if len(orders) == 0 {
		return nil
	}

	// Use a transaction for atomicity
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	query := `UPDATE catalog_items SET sort_order = $1, updated_at = NOW() WHERE id = $2`

	batch := &pgx.Batch{}
	for _, order := range orders {
		batch.Queue(query, order.SortOrder, order.ID)
	}

	br := tx.SendBatch(ctx, batch)

	// Execute all updates
	for range orders {
		if _, err := br.Exec(); err != nil {
			br.Close()
			return fmt.Errorf("reorder catalog items: %w", err)
		}
	}

	// Close batch results before commit (required by pgx)
	if err := br.Close(); err != nil {
		return fmt.Errorf("close batch results: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

// ============================================================================
// PUBLIC/NESTED QUERIES
// ============================================================================

// GetFullCatalog returns the complete catalog hierarchy (sections -> groups -> items), active only
func (r *CatalogRepository) GetFullCatalog(ctx context.Context) ([]*models.CatalogSectionWithGroups, error) {
	// Efficient approach: Use a single query with JOINs and construct hierarchy in Go
	// This avoids N+1 query problems

	query := `
		SELECT
			s.id, s.name_ro, s.name_ru, s.name_en, s.icon, s.slug, s.sort_order, s.is_active, s.created_at, s.updated_at,
			g.id, g.section_id, g.name_ro, g.name_ru, g.name_en, g.column_position, g.sort_order, g.filter_config, g.is_active, g.created_at, g.updated_at,
			i.id, i.group_id, i.name_ro, i.name_ru, i.name_en, i.sort_order, i.item_type, i.category_id, i.filter_config, i.is_active, i.created_at, i.updated_at
		FROM catalog_sections s
		LEFT JOIN catalog_groups g ON g.section_id = s.id AND g.is_active = true
		LEFT JOIN catalog_items i ON i.group_id = g.id AND i.is_active = true
		WHERE s.is_active = true
		ORDER BY s.sort_order ASC, g.column_position ASC, g.sort_order ASC, i.sort_order ASC
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query full catalog: %w", err)
	}
	defer rows.Close()

	// Build the hierarchy
	sectionMap := make(map[uuid.UUID]*models.CatalogSectionWithGroups)
	groupMap := make(map[uuid.UUID]*models.CatalogGroupWithItems)
	var sectionOrder []uuid.UUID

	for rows.Next() {
		var section models.CatalogSection

		// Nullable group fields (from LEFT JOIN - can be NULL when section has no groups)
		var groupID, groupSectionID pgtype.UUID
		var groupNameRo, groupNameRu, groupNameEn pgtype.Text
		var groupColumnPosition, groupSortOrder pgtype.Int4
		var groupFilterConfig *models.CatalogFilterConfig
		var groupIsActive pgtype.Bool
		var groupCreatedAt, groupUpdatedAt pgtype.Timestamptz

		// Nullable item fields (from LEFT JOIN - can be NULL when group has no items)
		var itemID, itemGroupID pgtype.UUID
		var itemNameRo, itemNameRu, itemNameEn pgtype.Text
		var itemSortOrder pgtype.Int4
		var itemType pgtype.Text
		var itemCategoryID pgtype.UUID
		var itemFilterConfig *models.CatalogFilterConfig
		var itemIsActive pgtype.Bool
		var itemCreatedAt, itemUpdatedAt pgtype.Timestamptz

		err := rows.Scan(
			// Section fields (always present from main table)
			&section.ID, &section.NameRo, &section.NameRu, &section.NameEn, &section.Icon, &section.Slug, &section.SortOrder, &section.IsActive, &section.CreatedAt, &section.UpdatedAt,
			// Group fields (nullable from LEFT JOIN)
			&groupID, &groupSectionID, &groupNameRo, &groupNameRu, &groupNameEn, &groupColumnPosition, &groupSortOrder, &groupFilterConfig, &groupIsActive, &groupCreatedAt, &groupUpdatedAt,
			// Item fields (nullable from LEFT JOIN)
			&itemID, &itemGroupID, &itemNameRo, &itemNameRu, &itemNameEn, &itemSortOrder, &itemType, &itemCategoryID, &itemFilterConfig, &itemIsActive, &itemCreatedAt, &itemUpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan full catalog row: %w", err)
		}

		// Add section if not already in map
		if _, exists := sectionMap[section.ID]; !exists {
			sectionMap[section.ID] = &models.CatalogSectionWithGroups{
				CatalogSection: section,
				Groups:         []models.CatalogGroupWithItems{},
			}
			sectionOrder = append(sectionOrder, section.ID)
		}

		// Add group if exists and not already in map
		if groupID.Valid {
			gid, _ := uuid.FromBytes(groupID.Bytes[:])
			gsid, _ := uuid.FromBytes(groupSectionID.Bytes[:])
			group := models.CatalogGroup{
				ID:             gid,
				SectionID:      gsid,
				NameRo:         groupNameRo.String,
				NameRu:         pgtypeTextToPtr(groupNameRu),
				NameEn:         pgtypeTextToPtr(groupNameEn),
				ColumnPosition: int(groupColumnPosition.Int32),
				SortOrder:      int(groupSortOrder.Int32),
				FilterConfig:   groupFilterConfig,
				IsActive:       groupIsActive.Bool,
				CreatedAt:      groupCreatedAt.Time,
				UpdatedAt:      groupUpdatedAt.Time,
			}
			if _, exists := groupMap[group.ID]; !exists {
				groupMap[group.ID] = &models.CatalogGroupWithItems{
					CatalogGroup: group,
					Items:        []models.CatalogItemWithCategory{},
				}
				sectionMap[section.ID].Groups = append(sectionMap[section.ID].Groups, *groupMap[group.ID])
			}

			// Add item if exists
			if itemID.Valid {
				iid, _ := uuid.FromBytes(itemID.Bytes[:])
				igid, _ := uuid.FromBytes(itemGroupID.Bytes[:])
				item := models.CatalogItem{
					ID:           iid,
					GroupID:      igid,
					NameRo:       itemNameRo.String,
					NameRu:       pgtypeTextToPtr(itemNameRu),
					NameEn:       pgtypeTextToPtr(itemNameEn),
					SortOrder:    int(itemSortOrder.Int32),
					ItemType:     itemType.String,
					CategoryID:   pgtypeUUIDToPtr(itemCategoryID),
					FilterConfig: itemFilterConfig,
					IsActive:     itemIsActive.Bool,
					CreatedAt:    itemCreatedAt.Time,
					UpdatedAt:    itemUpdatedAt.Time,
				}
				// Find the group in the section and add the item
				for i := range sectionMap[section.ID].Groups {
					if sectionMap[section.ID].Groups[i].ID == group.ID {
						sectionMap[section.ID].Groups[i].Items = append(sectionMap[section.ID].Groups[i].Items, models.CatalogItemWithCategory{
							CatalogItem: item,
						})
						break
					}
				}
			}
		}
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate full catalog: %w", err)
	}

	// Convert map to ordered slice
	var result []*models.CatalogSectionWithGroups
	for _, sectionID := range sectionOrder {
		result = append(result, sectionMap[sectionID])
	}

	return result, nil
}

// GetSectionWithChildren returns a section with all its groups and items by slug
func (r *CatalogRepository) GetSectionWithChildren(ctx context.Context, slug string) (*models.CatalogSectionWithGroups, error) {
	// Get the section first
	section, err := r.GetSectionBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}

	// Use a single JOIN query to get all groups and items (avoids N+1 problem)
	query := `
		SELECT
			g.id, g.section_id, g.name_ro, g.name_ru, g.name_en, g.column_position, g.sort_order, g.filter_config, g.is_active, g.created_at, g.updated_at,
			i.id, i.group_id, i.name_ro, i.name_ru, i.name_en, i.sort_order, i.item_type, i.category_id, i.filter_config, i.is_active, i.created_at, i.updated_at
		FROM catalog_groups g
		LEFT JOIN catalog_items i ON i.group_id = g.id
		WHERE g.section_id = $1
		ORDER BY g.column_position ASC, g.sort_order ASC, i.sort_order ASC
	`

	rows, err := r.pool.Query(ctx, query, section.ID)
	if err != nil {
		return nil, fmt.Errorf("query groups and items: %w", err)
	}
	defer rows.Close()

	// Build hierarchy in Go
	groupMap := make(map[uuid.UUID]*models.CatalogGroupWithItems)
	var groupOrder []uuid.UUID

	for rows.Next() {
		var group models.CatalogGroup
		var item models.CatalogItem
		var itemID *uuid.UUID

		err := rows.Scan(
			&group.ID, &group.SectionID, &group.NameRo, &group.NameRu, &group.NameEn, &group.ColumnPosition, &group.SortOrder, &group.FilterConfig, &group.IsActive, &group.CreatedAt, &group.UpdatedAt,
			&itemID, &item.GroupID, &item.NameRo, &item.NameRu, &item.NameEn, &item.SortOrder, &item.ItemType, &item.CategoryID, &item.FilterConfig, &item.IsActive, &item.CreatedAt, &item.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan group and item row: %w", err)
		}

		// Add group if not already in map
		if _, exists := groupMap[group.ID]; !exists {
			groupMap[group.ID] = &models.CatalogGroupWithItems{
				CatalogGroup: group,
				Items:        []models.CatalogItemWithCategory{},
			}
			groupOrder = append(groupOrder, group.ID)
		}

		// Add item if exists
		if itemID != nil {
			item.ID = *itemID
			groupMap[group.ID].Items = append(groupMap[group.ID].Items, models.CatalogItemWithCategory{
				CatalogItem: item,
			})
		}
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate groups and items: %w", err)
	}

	// Build the result with nested structure
	result := &models.CatalogSectionWithGroups{
		CatalogSection: *section,
		Groups:         []models.CatalogGroupWithItems{},
	}

	for _, groupID := range groupOrder {
		result.Groups = append(result.Groups, *groupMap[groupID])
	}

	return result, nil
}

// cloneItemsForGroup clones all items from one group to another within a transaction
func (r *CatalogRepository) cloneItemsForGroup(ctx context.Context, tx pgx.Tx, oldGroupID, newGroupID uuid.UUID) error {
	itemsQuery := `
		SELECT name_ro, name_ru, name_en, sort_order, item_type, category_id, filter_config, is_active
		FROM catalog_items
		WHERE group_id = $1
		ORDER BY sort_order
	`

	itemRows, err := tx.Query(ctx, itemsQuery, oldGroupID)
	if err != nil {
		return fmt.Errorf("query items for cloning: %w", err)
	}
	defer itemRows.Close()

	for itemRows.Next() {
		var nameRo string
		var nameRu, nameEn *string
		var sortOrder int
		var itemType string
		var categoryID *uuid.UUID
		var filterConfig *models.CatalogFilterConfig
		var isActive bool

		if err := itemRows.Scan(&nameRo, &nameRu, &nameEn, &sortOrder, &itemType, &categoryID, &filterConfig, &isActive); err != nil {
			return fmt.Errorf("scan item for cloning: %w", err)
		}

		// Insert cloned item
		cloneItemQuery := `
			INSERT INTO catalog_items (group_id, name_ro, name_ru, name_en, sort_order, item_type, category_id, filter_config, is_active)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`

		_, err = tx.Exec(ctx, cloneItemQuery,
			newGroupID,
			nameRo,
			nameRu,
			nameEn,
			sortOrder,
			itemType,
			categoryID,
			filterConfig,
			isActive,
		)
		if err != nil {
			return fmt.Errorf("clone catalog item: %w", err)
		}
	}

	return itemRows.Err()
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

// validateSectionInput validates section input data
func (r *CatalogRepository) validateSectionInput(input *models.CatalogSectionInput) error {
	nameRo := strings.TrimSpace(input.NameRo)
	if nameRo == "" {
		return fmt.Errorf("name_ro cannot be empty")
	}
	if len(nameRo) > 255 {
		return fmt.Errorf("name_ro cannot exceed 255 characters")
	}
	return nil
}

// validateGroupInput validates group input data
func (r *CatalogRepository) validateGroupInput(input *models.CatalogGroupInput) error {
	nameRo := strings.TrimSpace(input.NameRo)
	if nameRo == "" {
		return fmt.Errorf("name_ro cannot be empty")
	}
	if len(nameRo) > 255 {
		return fmt.Errorf("name_ro cannot exceed 255 characters")
	}

	// Validate column position
	if input.ColumnPosition != nil {
		if *input.ColumnPosition < 1 || *input.ColumnPosition > 4 {
			return ErrInvalidColumnPosition
		}
	}

	return nil
}

// validateItemInput validates item input data
func (r *CatalogRepository) validateItemInput(input *models.CatalogItemInput) error {
	nameRo := strings.TrimSpace(input.NameRo)
	if nameRo == "" {
		return fmt.Errorf("name_ro cannot be empty")
	}
	if len(nameRo) > 255 {
		return fmt.Errorf("name_ro cannot exceed 255 characters")
	}

	// Validate item type
	if input.ItemType != models.ItemTypeCategoryLink && input.ItemType != models.ItemTypeCustomFilter {
		return ErrInvalidItemType
	}

	// Validate type-specific requirements
	if input.ItemType == models.ItemTypeCategoryLink {
		if input.CategoryID == nil {
			return ErrMissingCategoryID
		}
	} else if input.ItemType == models.ItemTypeCustomFilter {
		if input.FilterConfig == nil {
			return ErrMissingFilterConfig
		}
	}

	return nil
}

// ============================================================================
// UTILITY HELPERS
// ============================================================================

// generateSlug generates a URL-friendly slug from a name
func (r *CatalogRepository) generateSlug(name string, providedSlug *string) string {
	if providedSlug != nil && strings.TrimSpace(*providedSlug) != "" {
		return slug.Make(strings.TrimSpace(*providedSlug))
	}
	return slug.Make(name)
}

// getSectionTx gets a section within a transaction
func (r *CatalogRepository) getSectionTx(ctx context.Context, tx pgx.Tx, id uuid.UUID) (*models.CatalogSection, error) {
	query := `
		SELECT id, name_ro, name_ru, name_en, icon, slug, sort_order, is_active, created_at, updated_at
		FROM catalog_sections
		WHERE id = $1
	`

	section := &models.CatalogSection{}
	err := tx.QueryRow(ctx, query, id).Scan(
		&section.ID,
		&section.NameRo,
		&section.NameRu,
		&section.NameEn,
		&section.Icon,
		&section.Slug,
		&section.SortOrder,
		&section.IsActive,
		&section.CreatedAt,
		&section.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCatalogSectionNotFound
		}
		return nil, fmt.Errorf("get catalog section in transaction: %w", err)
	}

	return section, nil
}

// generateUniqueSlugTx generates a unique slug within a transaction
func (r *CatalogRepository) generateUniqueSlugTx(ctx context.Context, tx pgx.Tx, baseSlug string) string {
	candidate := slug.Make(baseSlug)
	counter := 1

	for {
		// Check if slug exists
		var exists bool
		err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM catalog_sections WHERE slug = $1)`, candidate).Scan(&exists)
		if err != nil || !exists {
			return candidate
		}

		// Try next candidate
		candidate = fmt.Sprintf("%s-%d", slug.Make(baseSlug), counter)
		counter++

		// Safety limit to prevent infinite loop
		if counter > 1000 {
			return fmt.Sprintf("%s-%d", slug.Make(baseSlug), time.Now().Unix())
		}
	}
}

// ============================================================================
// PGTYPE CONVERSION HELPERS (for nullable LEFT JOIN columns)
// ============================================================================

// pgtypeTextToPtr converts pgtype.Text to *string
func pgtypeTextToPtr(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	return &t.String
}

// pgtypeUUIDToPtr converts pgtype.UUID to *uuid.UUID
func pgtypeUUIDToPtr(u pgtype.UUID) *uuid.UUID {
	if !u.Valid {
		return nil
	}
	id, _ := uuid.FromBytes(u.Bytes[:])
	return &id
}

// ============================================================================
// CATALOG ITEM FILTERED PRODUCTS
// ============================================================================

// CatalogItemProduct represents a product returned from catalog item filter
type CatalogItemProduct struct {
	ID            uuid.UUID          `json:"id"`
	UltraID       *string            `json:"ultra_id,omitempty"`
	Code          *string            `json:"code,omitempty"`
	Article       *string            `json:"article,omitempty"`
	Name          string             `json:"name"`
	Slug          string             `json:"slug"`
	Description   *string            `json:"description,omitempty"`
	NameRu        *string            `json:"name_ru,omitempty"`
	NameRo        *string            `json:"name_ro,omitempty"`
	BrandID       *uuid.UUID         `json:"brand_id,omitempty"`
	BrandName     *string            `json:"brand_name,omitempty"`
	CategoryID    *uuid.UUID         `json:"category_id,omitempty"`
	CategoryName  *string            `json:"category_name,omitempty"`
	MainImageURL  *string            `json:"main_image_url,omitempty"`
	Images        models.JSONBArray  `json:"images,omitempty"`
	PriceMDL      *float64           `json:"price_mdl,omitempty"`
	PriceEUR      *float64           `json:"price_eur,omitempty"`
	PriceUSD      *float64           `json:"price_usd,omitempty"`
	TotalStock    int                `json:"total_stock"`
	IsInStock     bool               `json:"is_in_stock"`
	IsActive      bool               `json:"is_active"`
	IsService     bool               `json:"is_service"`
	CreatedAt     time.Time          `json:"created_at"`
	UpdatedAt     time.Time          `json:"updated_at"`
}

// GetItemProducts returns products filtered by a catalog item's filter_config
func (r *CatalogRepository) GetItemProducts(ctx context.Context, itemID uuid.UUID, limit, offset int) ([]*CatalogItemProduct, int, error) {
	// First, get the catalog item and validate it's a custom_filter type
	itemQuery := `
		SELECT item_type, filter_config
		FROM catalog_items
		WHERE id = $1
	`

	var itemType string
	var filterConfig *models.CatalogFilterConfig
	err := r.pool.QueryRow(ctx, itemQuery, itemID).Scan(&itemType, &filterConfig)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, 0, ErrCatalogItemNotFound
		}
		return nil, 0, fmt.Errorf("get catalog item: %w", err)
	}

	// Validate item type
	if itemType != models.ItemTypeCustomFilter {
		return nil, 0, fmt.Errorf("catalog item is not of type custom_filter")
	}

	// Build product query with filters
	query := `
		SELECT
			p.id, p.ultra_id, p.code, p.article, p.name, p.slug, p.description,
			p.name_ru, p.name_ro,
			p.brand_id, b.name as brand_name,
			p.category_id, c.name as category_name,
			p.main_image_url, p.images,
			p.price_mdl, p.price_eur, p.price_usd,
			p.total_stock, p.is_in_stock, p.is_active, p.is_service,
			p.created_at, p.updated_at
		FROM products p
		LEFT JOIN brands b ON p.brand_id = b.id
		LEFT JOIN categories c ON p.category_id = c.id
		WHERE 1=1
	`

	countQuery := `
		SELECT COUNT(*)
		FROM products p
		WHERE 1=1
	`

	args := make([]interface{}, 0)
	argPos := 1

	// Apply filter_config criteria
	filterClause := ""
	if filterConfig != nil {
		// Category filter
		if len(filterConfig.CategoryIDs) > 0 {
			filterClause += fmt.Sprintf(" AND p.category_id = ANY($%d)", argPos)
			args = append(args, filterConfig.CategoryIDs)
			argPos++
		}

		// Brand filter
		if len(filterConfig.BrandIDs) > 0 {
			filterClause += fmt.Sprintf(" AND p.brand_id = ANY($%d)", argPos)
			args = append(args, filterConfig.BrandIDs)
			argPos++
		}

		// Min price filter
		if filterConfig.PriceMin != nil {
			filterClause += fmt.Sprintf(" AND p.price_mdl >= $%d", argPos)
			args = append(args, *filterConfig.PriceMin)
			argPos++
		}

		// Max price filter
		if filterConfig.PriceMax != nil {
			filterClause += fmt.Sprintf(" AND p.price_mdl <= $%d", argPos)
			args = append(args, *filterConfig.PriceMax)
			argPos++
		}

		// In stock only filter
		if filterConfig.InStockOnly {
			filterClause += " AND p.total_stock > 0 AND p.is_in_stock = true"
		}
	}

	// Always filter to active products only for public API
	filterClause += " AND p.is_active = true"

	query += filterClause
	countQuery += filterClause

	// Get total count
	var totalCount int
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&totalCount); err != nil {
		return nil, 0, fmt.Errorf("count filtered products: %w", err)
	}

	// Add ordering and pagination
	query += fmt.Sprintf(" ORDER BY p.name ASC LIMIT $%d OFFSET $%d", argPos, argPos+1)
	args = append(args, limit, offset)

	// Execute query
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query filtered products: %w", err)
	}
	defer rows.Close()

	products := make([]*CatalogItemProduct, 0)
	for rows.Next() {
		product := &CatalogItemProduct{}
		err := rows.Scan(
			&product.ID,
			&product.UltraID,
			&product.Code,
			&product.Article,
			&product.Name,
			&product.Slug,
			&product.Description,
			&product.NameRu,
			&product.NameRo,
			&product.BrandID,
			&product.BrandName,
			&product.CategoryID,
			&product.CategoryName,
			&product.MainImageURL,
			&product.Images,
			&product.PriceMDL,
			&product.PriceEUR,
			&product.PriceUSD,
			&product.TotalStock,
			&product.IsInStock,
			&product.IsActive,
			&product.IsService,
			&product.CreatedAt,
			&product.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan product: %w", err)
		}
		products = append(products, product)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate products: %w", err)
	}

	return products, totalCount, nil
}
