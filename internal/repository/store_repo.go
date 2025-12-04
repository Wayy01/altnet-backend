package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"ultra-api-testing/internal/models"
)

// Sentinel errors for store repository operations
var (
	ErrStoreNotFound = errors.New("store not found")
)

// StoreRepository handles store database operations
type StoreRepository struct {
	pool *pgxpool.Pool
}

// NewStoreRepository creates a new store repository
func NewStoreRepository(pool *pgxpool.Pool) *StoreRepository {
	return &StoreRepository{pool: pool}
}

// CreateStore creates a new store
func (r *StoreRepository) CreateStore(ctx context.Context, input *models.StoreInput) (*models.Store, error) {
	// Validate input
	if err := r.validateStoreInput(input); err != nil {
		return nil, err
	}

	query := `
		INSERT INTO stores (name, address, google_maps_url, images, videos, is_active)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, name, address, google_maps_url, images, videos, is_active, created_at, updated_at
	`

	// Set defaults
	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	// Ensure JSONB arrays are not nil
	images := input.Images
	if images == nil {
		images = models.JSONBArray{}
	}
	videos := input.Videos
	if videos == nil {
		videos = models.JSONBArray{}
	}

	store := &models.Store{}
	err := r.pool.QueryRow(ctx, query,
		strings.TrimSpace(input.Name),
		strings.TrimSpace(input.Address),
		input.GoogleMapsURL,
		images,
		videos,
		isActive,
	).Scan(
		&store.ID,
		&store.Name,
		&store.Address,
		&store.GoogleMapsURL,
		&store.Images,
		&store.Videos,
		&store.IsActive,
		&store.CreatedAt,
		&store.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create store: %w", err)
	}

	return store, nil
}

// GetStore returns a store by ID
func (r *StoreRepository) GetStore(ctx context.Context, id uuid.UUID) (*models.Store, error) {
	query := `
		SELECT id, name, address, google_maps_url, images, videos, is_active, created_at, updated_at
		FROM stores
		WHERE id = $1
	`

	store := &models.Store{}
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&store.ID,
		&store.Name,
		&store.Address,
		&store.GoogleMapsURL,
		&store.Images,
		&store.Videos,
		&store.IsActive,
		&store.CreatedAt,
		&store.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrStoreNotFound
		}
		return nil, fmt.Errorf("get store: %w", err)
	}

	return store, nil
}

// UpdateStore updates an existing store
func (r *StoreRepository) UpdateStore(ctx context.Context, id uuid.UUID, input *models.StoreInput) (*models.Store, error) {
	// Validate input
	if err := r.validateStoreInput(input); err != nil {
		return nil, err
	}

	query := `
		UPDATE stores
		SET name = $1, address = $2, google_maps_url = $3, images = $4, videos = $5, is_active = $6, updated_at = NOW()
		WHERE id = $7
		RETURNING id, name, address, google_maps_url, images, videos, is_active, created_at, updated_at
	`

	// Set defaults
	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	// Ensure JSONB arrays are not nil
	images := input.Images
	if images == nil {
		images = models.JSONBArray{}
	}
	videos := input.Videos
	if videos == nil {
		videos = models.JSONBArray{}
	}

	store := &models.Store{}
	err := r.pool.QueryRow(ctx, query,
		strings.TrimSpace(input.Name),
		strings.TrimSpace(input.Address),
		input.GoogleMapsURL,
		images,
		videos,
		isActive,
		id,
	).Scan(
		&store.ID,
		&store.Name,
		&store.Address,
		&store.GoogleMapsURL,
		&store.Images,
		&store.Videos,
		&store.IsActive,
		&store.CreatedAt,
		&store.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrStoreNotFound
		}
		return nil, fmt.Errorf("update store: %w", err)
	}

	return store, nil
}

// DeleteStore deletes a store by ID
func (r *StoreRepository) DeleteStore(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM stores WHERE id = $1`

	cmdTag, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete store: %w", err)
	}

	if cmdTag.RowsAffected() == 0 {
		return ErrStoreNotFound
	}

	return nil
}

// ListStores returns stores with pagination and filters
func (r *StoreRepository) ListStores(ctx context.Context, filters *models.StoreFilters, limit, offset int) ([]*models.Store, error) {
	query := `
		SELECT id, name, address, google_maps_url, images, videos, is_active, created_at, updated_at
		FROM stores
	`

	var conditions []string
	var args []interface{}
	argNum := 1

	if filters != nil {
		if filters.Search != "" {
			conditions = append(conditions, fmt.Sprintf("(name ILIKE $%d OR address ILIKE $%d)", argNum, argNum))
			args = append(args, "%"+filters.Search+"%")
			argNum++
		}
		if filters.ActiveOnly {
			conditions = append(conditions, fmt.Sprintf("is_active = $%d", argNum))
			args = append(args, true)
			argNum++
		}
	}

	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	query += " ORDER BY created_at DESC"

	// Add pagination
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argNum, argNum+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query stores: %w", err)
	}
	defer rows.Close()

	var stores []*models.Store
	for rows.Next() {
		store := &models.Store{}
		if err := rows.Scan(
			&store.ID,
			&store.Name,
			&store.Address,
			&store.GoogleMapsURL,
			&store.Images,
			&store.Videos,
			&store.IsActive,
			&store.CreatedAt,
			&store.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan store: %w", err)
		}
		stores = append(stores, store)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate stores: %w", err)
	}

	return stores, nil
}

// CountStores returns the total count of stores with filters
func (r *StoreRepository) CountStores(ctx context.Context, filters *models.StoreFilters) (int, error) {
	query := `SELECT COUNT(*) FROM stores`

	var conditions []string
	var args []interface{}
	argNum := 1

	if filters != nil {
		if filters.Search != "" {
			conditions = append(conditions, fmt.Sprintf("(name ILIKE $%d OR address ILIKE $%d)", argNum, argNum))
			args = append(args, "%"+filters.Search+"%")
			argNum++
		}
		if filters.ActiveOnly {
			conditions = append(conditions, fmt.Sprintf("is_active = $%d", argNum))
			args = append(args, true)
			argNum++
		}
	}

	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	var count int
	err := r.pool.QueryRow(ctx, query, args...).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count stores: %w", err)
	}

	return count, nil
}

// ToggleStoreActive toggles the is_active flag of a store
func (r *StoreRepository) ToggleStoreActive(ctx context.Context, id uuid.UUID) (*models.Store, error) {
	query := `
		UPDATE stores
		SET is_active = NOT is_active, updated_at = NOW()
		WHERE id = $1
		RETURNING id, name, address, google_maps_url, images, videos, is_active, created_at, updated_at
	`

	store := &models.Store{}
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&store.ID,
		&store.Name,
		&store.Address,
		&store.GoogleMapsURL,
		&store.Images,
		&store.Videos,
		&store.IsActive,
		&store.CreatedAt,
		&store.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrStoreNotFound
		}
		return nil, fmt.Errorf("toggle store active: %w", err)
	}

	return store, nil
}

// validateStoreInput validates store input data
func (r *StoreRepository) validateStoreInput(input *models.StoreInput) error {
	// Validate name
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return fmt.Errorf("store name cannot be empty")
	}
	if len(name) > 255 {
		return fmt.Errorf("store name cannot exceed 255 characters")
	}

	// Validate address
	address := strings.TrimSpace(input.Address)
	if address == "" {
		return fmt.Errorf("store address cannot be empty")
	}

	return nil
}
