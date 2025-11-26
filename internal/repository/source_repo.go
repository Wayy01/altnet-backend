package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"ultra-api-testing/internal/models"
)

// Sentinel errors for source repository operations
var (
	ErrSourceNotFound     = errors.New("source not found")
	ErrSourceNotDeletable = errors.New("source is not deletable")
	ErrSourceIsDefault    = errors.New("cannot delete the default source")
	ErrSourceInUse        = errors.New("source is being used by products")
	ErrDuplicateSource    = errors.New("source with this name already exists")
)

// SourceRepository handles product source database operations
type SourceRepository struct {
	pool *pgxpool.Pool
}

// NewSourceRepository creates a new source repository
func NewSourceRepository(pool *pgxpool.Pool) *SourceRepository {
	return &SourceRepository{pool: pool}
}

// ListSources returns all product sources
func (r *SourceRepository) ListSources(ctx context.Context) ([]*models.ProductSource, error) {
	query := `
		SELECT id, name, description, is_default, is_deletable, created_at, updated_at
		FROM product_sources
		ORDER BY is_default DESC, name ASC
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query sources: %w", err)
	}
	defer rows.Close()

	var sources []*models.ProductSource
	for rows.Next() {
		source := &models.ProductSource{}
		if err := rows.Scan(
			&source.ID,
			&source.Name,
			&source.Description,
			&source.IsDefault,
			&source.IsDeletable,
			&source.CreatedAt,
			&source.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan source: %w", err)
		}
		sources = append(sources, source)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate sources: %w", err)
	}

	return sources, nil
}

// GetSource returns a product source by ID
func (r *SourceRepository) GetSource(ctx context.Context, id uuid.UUID) (*models.ProductSource, error) {
	query := `
		SELECT id, name, description, is_default, is_deletable, created_at, updated_at
		FROM product_sources
		WHERE id = $1
	`

	source := &models.ProductSource{}
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&source.ID,
		&source.Name,
		&source.Description,
		&source.IsDefault,
		&source.IsDeletable,
		&source.CreatedAt,
		&source.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSourceNotFound
		}
		return nil, fmt.Errorf("get source: %w", err)
	}

	return source, nil
}

// GetDefaultSource returns the default product source (Ultra)
func (r *SourceRepository) GetDefaultSource(ctx context.Context) (*models.ProductSource, error) {
	query := `
		SELECT id, name, description, is_default, is_deletable, created_at, updated_at
		FROM product_sources
		WHERE is_default = TRUE
		LIMIT 1
	`

	source := &models.ProductSource{}
	err := r.pool.QueryRow(ctx, query).Scan(
		&source.ID,
		&source.Name,
		&source.Description,
		&source.IsDefault,
		&source.IsDeletable,
		&source.CreatedAt,
		&source.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get default source: %w", err)
	}

	return source, nil
}

// GetSourceByName returns a product source by name
func (r *SourceRepository) GetSourceByName(ctx context.Context, name string) (*models.ProductSource, error) {
	query := `
		SELECT id, name, description, is_default, is_deletable, created_at, updated_at
		FROM product_sources
		WHERE name = $1
	`

	source := &models.ProductSource{}
	err := r.pool.QueryRow(ctx, query, name).Scan(
		&source.ID,
		&source.Name,
		&source.Description,
		&source.IsDefault,
		&source.IsDeletable,
		&source.CreatedAt,
		&source.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get source by name: %w", err)
	}

	return source, nil
}

// CreateSourceRequest represents the request for creating a product source
type CreateSourceRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
}

// CreateSource creates a new product source
func (r *SourceRepository) CreateSource(ctx context.Context, req *CreateSourceRequest) (*models.ProductSource, error) {
	// Validate and sanitize input
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, fmt.Errorf("source name cannot be empty")
	}
	if len(name) > 255 {
		return nil, fmt.Errorf("source name cannot exceed 255 characters")
	}

	query := `
		INSERT INTO product_sources (name, description, is_default, is_deletable)
		VALUES ($1, $2, FALSE, TRUE)
		RETURNING id, name, description, is_default, is_deletable, created_at, updated_at
	`

	source := &models.ProductSource{}
	err := r.pool.QueryRow(ctx, query, name, req.Description).Scan(
		&source.ID,
		&source.Name,
		&source.Description,
		&source.IsDefault,
		&source.IsDeletable,
		&source.CreatedAt,
		&source.UpdatedAt,
	)
	if err != nil {
		// Check for unique constraint violation (duplicate name)
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" { // unique_violation
			return nil, ErrDuplicateSource
		}
		return nil, fmt.Errorf("create source: %w", err)
	}

	return source, nil
}

// DeleteSource deletes a product source by ID
// Returns error if source is not deletable (is_default or is_deletable=false)
// This operation is wrapped in a transaction to ensure consistency
func (r *SourceRepository) DeleteSource(ctx context.Context, id uuid.UUID) error {
	// Begin transaction with RepeatableRead isolation level
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead})
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx) // Rollback if we don't commit

	// Check if the source exists and is deletable
	var isDeletable bool
	var isDefault bool
	checkQuery := `
		SELECT is_deletable, is_default
		FROM product_sources
		WHERE id = $1
	`
	err = tx.QueryRow(ctx, checkQuery, id).Scan(&isDeletable, &isDefault)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrSourceNotFound
		}
		return fmt.Errorf("check source: %w", err)
	}

	if isDefault {
		return ErrSourceIsDefault
	}

	if !isDeletable {
		return ErrSourceNotDeletable
	}

	// Check if any products are using this source
	var productCount int
	countQuery := `SELECT COUNT(*) FROM products WHERE source_id = $1`
	err = tx.QueryRow(ctx, countQuery, id).Scan(&productCount)
	if err != nil {
		return fmt.Errorf("count products with source: %w", err)
	}

	if productCount > 0 {
		return fmt.Errorf("%w: %d products are using it", ErrSourceInUse, productCount)
	}

	// Delete the source
	deleteQuery := `DELETE FROM product_sources WHERE id = $1`
	cmdTag, err := tx.Exec(ctx, deleteQuery, id)
	if err != nil {
		return fmt.Errorf("delete source: %w", err)
	}

	if cmdTag.RowsAffected() == 0 {
		return ErrSourceNotFound
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

// GetSourceProductCount returns the number of products for a given source
func (r *SourceRepository) GetSourceProductCount(ctx context.Context, sourceID uuid.UUID) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM products WHERE source_id = $1`, sourceID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count products: %w", err)
	}
	return count, nil
}
