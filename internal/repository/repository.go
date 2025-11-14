package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"ultra-api-testing/internal/models"
)

type Repository struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// ============================================================================
// DATA SOURCES
// ============================================================================

func (r *Repository) GetSourceByCode(ctx context.Context, code string) (*models.DataSource, error) {
	query := `
		SELECT id, source_code, source_name, source_type,
		       COALESCE(config::text, '{}')::jsonb as config,
		       COALESCE(field_mappings::text, '{}')::jsonb as field_mappings,
		       COALESCE(capabilities::text, '{}')::jsonb as capabilities,
		       priority, is_active, is_primary, last_sync_at,
		       last_sync_status, sync_interval_minutes, created_at, updated_at, created_by
		FROM data_sources
		WHERE source_code = $1
	`

	var ds models.DataSource
	var configBytes, fieldMappingsBytes, capabilitiesBytes []byte

	err := r.pool.QueryRow(ctx, query, code).Scan(
		&ds.ID, &ds.SourceCode, &ds.SourceName, &ds.SourceType,
		&configBytes, &fieldMappingsBytes, &capabilitiesBytes,
		&ds.Priority, &ds.IsActive, &ds.IsPrimary, &ds.LastSyncAt,
		&ds.LastSyncStatus, &ds.SyncIntervalMinutes,
		&ds.CreatedAt, &ds.UpdatedAt, &ds.CreatedBy,
	)
	if err != nil {
		return nil, err
	}

	// Unmarshal JSONB fields
	if err := ds.Config.Scan(configBytes); err != nil {
		return nil, fmt.Errorf("scan config: %w", err)
	}
	if err := ds.FieldMappings.Scan(fieldMappingsBytes); err != nil {
		return nil, fmt.Errorf("scan field_mappings: %w", err)
	}
	if err := ds.Capabilities.Scan(capabilitiesBytes); err != nil {
		return nil, fmt.Errorf("scan capabilities: %w", err)
	}

	return &ds, nil
}

// ============================================================================
// BRAND SOURCES
// ============================================================================

func (r *Repository) UpsertBrandSources(ctx context.Context, brands []*models.BrandSource) error {
	if len(brands) == 0 {
		return nil
	}

	query := `
		INSERT INTO brand_sources (
			source_id, external_id, source_data, name, code, logo_url, is_active,
			first_seen_at, last_seen_at, sync_version
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, 1
		)
		ON CONFLICT (source_id, external_id) DO UPDATE SET
			source_data = EXCLUDED.source_data,
			name = EXCLUDED.name,
			code = EXCLUDED.code,
			logo_url = EXCLUDED.logo_url,
			is_active = EXCLUDED.is_active,
			last_seen_at = EXCLUDED.last_seen_at,
			sync_version = brand_sources.sync_version + 1,
			updated_at = NOW()
	`

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	now := time.Now()
	for _, brand := range brands {
		_, err := tx.Exec(ctx, query,
			brand.SourceID,
			brand.ExternalID,
			brand.SourceData,
			brand.Name,
			brand.Code,
			brand.LogoURL,
			brand.IsActive,
			now,
			now,
		)
		if err != nil {
			return fmt.Errorf("insert brand %s: %w", brand.ExternalID, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

// ============================================================================
// CATEGORY SOURCES
// ============================================================================

func (r *Repository) UpsertCategorySources(ctx context.Context, categories []*models.CategorySource) error {
	if len(categories) == 0 {
		return nil
	}

	query := `
		INSERT INTO category_sources (
			source_id, external_id, parent_external_id, source_data, name, code,
			sort_order, is_active, product_count, first_seen_at, last_seen_at,
			sync_version
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1
		)
		ON CONFLICT (source_id, external_id) DO UPDATE SET
			parent_external_id = EXCLUDED.parent_external_id,
			source_data = EXCLUDED.source_data,
			name = EXCLUDED.name,
			code = EXCLUDED.code,
			sort_order = EXCLUDED.sort_order,
			is_active = EXCLUDED.is_active,
			product_count = EXCLUDED.product_count,
			last_seen_at = EXCLUDED.last_seen_at,
			sync_version = category_sources.sync_version + 1,
			updated_at = NOW()
	`

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	now := time.Now()
	for _, category := range categories {
		_, err := tx.Exec(ctx, query,
			category.SourceID,
			category.ExternalID,
			category.ParentExternalID,
			category.SourceData,
			category.Name,
			category.Code,
			category.SortOrder,
			category.IsActive,
			category.ProductCount,
			now,
			now,
		)
		if err != nil {
			return fmt.Errorf("insert category %s: %w", category.ExternalID, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

// ============================================================================
// PRODUCT SOURCES
// ============================================================================

func (r *Repository) UpsertProductSources(ctx context.Context, products []*models.ProductSource) error {
	if len(products) == 0 {
		return nil
	}

	query := `
		INSERT INTO product_sources (
			source_id, external_id, brand_external_id, category_external_id,
			parent_external_id, source_data, name, code, description, is_active,
			prices, stock, images, characteristics, properties, barcodes,
			first_seen_at, last_seen_at, sync_version
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 1
		)
		ON CONFLICT (source_id, external_id) DO UPDATE SET
			brand_external_id = EXCLUDED.brand_external_id,
			category_external_id = EXCLUDED.category_external_id,
			parent_external_id = EXCLUDED.parent_external_id,
			source_data = EXCLUDED.source_data,
			name = EXCLUDED.name,
			code = EXCLUDED.code,
			description = EXCLUDED.description,
			is_active = EXCLUDED.is_active,
			prices = EXCLUDED.prices,
			stock = EXCLUDED.stock,
			images = EXCLUDED.images,
			characteristics = EXCLUDED.characteristics,
			properties = EXCLUDED.properties,
			barcodes = EXCLUDED.barcodes,
			last_seen_at = EXCLUDED.last_seen_at,
			sync_version = product_sources.sync_version + 1,
			updated_at = NOW()
	`

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	now := time.Now()
	for _, product := range products {
		_, err := tx.Exec(ctx, query,
			product.SourceID,
			product.ExternalID,
			product.BrandExternalID,
			product.CategoryExternalID,
			product.ParentExternalID,
			product.SourceData,
			product.Name,
			product.Code,
			product.Description,
			product.IsActive,
			product.Prices,
			product.Stock,
			product.Images,
			product.Characteristics,
			product.Properties,
			product.Barcodes,
			now,
			now,
		)
		if err != nil {
			return fmt.Errorf("insert product %s: %w", product.ExternalID, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

// ============================================================================
// SYNC RUNS
// ============================================================================

func (r *Repository) CreateSyncRun(ctx context.Context, sourceID uuid.UUID, syncType string) (*models.SyncRun, error) {
	query := `
		INSERT INTO sync_runs (
			source_id, sync_type, started_at, status, triggered_by
		) VALUES (
			$1, $2, $3, 'running', 'manual'
		)
		RETURNING id, started_at
	`

	var syncRun models.SyncRun
	syncRun.SourceID = sourceID
	syncRun.SyncType = syncType
	syncRun.Status = "running"

	err := r.pool.QueryRow(ctx, query, sourceID, syncType, time.Now()).Scan(
		&syncRun.ID,
		&syncRun.StartedAt,
	)
	if err != nil {
		return nil, err
	}

	return &syncRun, nil
}

func (r *Repository) UpdateSyncRun(ctx context.Context, syncRun *models.SyncRun) error {
	query := `
		UPDATE sync_runs SET
			finished_at = $2,
			duration_seconds = $3,
			status = $4,
			records_fetched = $5,
			records_created = $6,
			records_updated = $7,
			records_failed = $8,
			brands_with_data = $9,
			categories_with_data = $10,
			products_with_data = $11,
			products_with_prices = $12,
			products_with_stock = $13,
			products_with_images = $14,
			sync_details = $15,
			error_message = $16,
			error_details = $17
		WHERE id = $1
	`

	_, err := r.pool.Exec(ctx, query,
		syncRun.ID,
		syncRun.FinishedAt,
		syncRun.DurationSeconds,
		syncRun.Status,
		syncRun.RecordsFetched,
		syncRun.RecordsCreated,
		syncRun.RecordsUpdated,
		syncRun.RecordsFailed,
		syncRun.BrandsWithData,
		syncRun.CategoriesWithData,
		syncRun.ProductsWithData,
		syncRun.ProductsWithPrices,
		syncRun.ProductsWithStock,
		syncRun.ProductsWithImages,
		syncRun.SyncDetails,
		syncRun.ErrorMessage,
		syncRun.ErrorDetails,
	)

	return err
}

// Helper: Update prices in product_sources
func (r *Repository) UpdateProductPrices(ctx context.Context, sourceID uuid.UUID, priceMap map[string][]map[string]interface{}) error {
	query := `
		UPDATE product_sources
		SET prices = $1, updated_at = NOW()
		WHERE source_id = $2 AND external_id = $3
	`

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for externalID, prices := range priceMap {
		pricesJSON := models.JSONB{"prices": prices}
		_, err := tx.Exec(ctx, query, pricesJSON, sourceID, externalID)
		if err != nil {
			return fmt.Errorf("update prices for %s: %w", externalID, err)
		}
	}

	return tx.Commit(ctx)
}

// Helper: Update stock in product_sources
func (r *Repository) UpdateProductStock(ctx context.Context, sourceID uuid.UUID, stockMap map[string]map[string]interface{}) error {
	query := `
		UPDATE product_sources
		SET stock = $1, updated_at = NOW()
		WHERE source_id = $2 AND external_id = $3
	`

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for externalID, stock := range stockMap {
		stockJSON := models.JSONB(stock)
		_, err := tx.Exec(ctx, query, stockJSON, sourceID, externalID)
		if err != nil {
			return fmt.Errorf("update stock for %s: %w", externalID, err)
		}
	}

	return tx.Commit(ctx)
}
