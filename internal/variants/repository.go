package variants

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"ultra-api-testing/internal/models"
)

// Repository handles database operations for variant generation
type Repository struct {
	pool *pgxpool.Pool
}

// NewRepository creates a new variant repository
func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// ============================================================================
// JOB OPERATIONS
// ============================================================================

// CreateJob creates a new variant generation job
func (r *Repository) CreateJob(ctx context.Context, totalProducts int) (*models.VariantGenerationJob, error) {
	job := &models.VariantGenerationJob{
		ID:                uuid.New(),
		Status:            models.VariantJobStatusPending,
		TotalProducts:     totalProducts,
		ProcessedProducts: 0,
		GroupsCreated:     0,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	query := `
		INSERT INTO variant_generation_jobs (id, status, total_products, processed_products, groups_created, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	_, err := r.pool.Exec(ctx, query,
		job.ID, job.Status, job.TotalProducts, job.ProcessedProducts, job.GroupsCreated, job.CreatedAt, job.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("creating job: %w", err)
	}

	return job, nil
}

// UpdateJobProgress updates the progress of a job
func (r *Repository) UpdateJobProgress(ctx context.Context, jobID uuid.UUID, processed, groupsCreated int) error {
	query := `
		UPDATE variant_generation_jobs
		SET processed_products = $2, groups_created = $3, updated_at = NOW()
		WHERE id = $1
	`

	_, err := r.pool.Exec(ctx, query, jobID, processed, groupsCreated)
	if err != nil {
		return fmt.Errorf("updating job progress: %w", err)
	}

	return nil
}

// StartJob marks a job as running
func (r *Repository) StartJob(ctx context.Context, jobID uuid.UUID) error {
	query := `
		UPDATE variant_generation_jobs
		SET status = $2, started_at = NOW(), updated_at = NOW()
		WHERE id = $1
	`

	_, err := r.pool.Exec(ctx, query, jobID, models.VariantJobStatusRunning)
	if err != nil {
		return fmt.Errorf("starting job: %w", err)
	}

	return nil
}

// CompleteJob marks a job as completed or failed
func (r *Repository) CompleteJob(ctx context.Context, jobID uuid.UUID, status string, errorMsg *string) error {
	query := `
		UPDATE variant_generation_jobs
		SET status = $2, completed_at = NOW(), error = $3, updated_at = NOW()
		WHERE id = $1
	`

	_, err := r.pool.Exec(ctx, query, jobID, status, errorMsg)
	if err != nil {
		return fmt.Errorf("completing job: %w", err)
	}

	return nil
}

// GetJob retrieves a job by ID
func (r *Repository) GetJob(ctx context.Context, jobID uuid.UUID) (*models.VariantGenerationJob, error) {
	query := `
		SELECT id, status, total_products, processed_products, groups_created,
		       started_at, completed_at, error, created_at, updated_at
		FROM variant_generation_jobs
		WHERE id = $1
	`

	var job models.VariantGenerationJob
	err := r.pool.QueryRow(ctx, query, jobID).Scan(
		&job.ID, &job.Status, &job.TotalProducts, &job.ProcessedProducts, &job.GroupsCreated,
		&job.StartedAt, &job.CompletedAt, &job.Error, &job.CreatedAt, &job.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting job: %w", err)
	}

	return &job, nil
}

// ListJobs retrieves jobs with pagination
func (r *Repository) ListJobs(ctx context.Context, limit, offset int) ([]*models.VariantGenerationJob, int, error) {
	// Get total count
	var total int
	countQuery := `SELECT COUNT(*) FROM variant_generation_jobs`
	if err := r.pool.QueryRow(ctx, countQuery).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting jobs: %w", err)
	}

	// Get jobs
	query := `
		SELECT id, status, total_products, processed_products, groups_created,
		       started_at, completed_at, error, created_at, updated_at
		FROM variant_generation_jobs
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("listing jobs: %w", err)
	}
	defer rows.Close()

	jobs := make([]*models.VariantGenerationJob, 0)
	for rows.Next() {
		var job models.VariantGenerationJob
		if err := rows.Scan(
			&job.ID, &job.Status, &job.TotalProducts, &job.ProcessedProducts, &job.GroupsCreated,
			&job.StartedAt, &job.CompletedAt, &job.Error, &job.CreatedAt, &job.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scanning job: %w", err)
		}
		jobs = append(jobs, &job)
	}

	return jobs, total, nil
}

// GetActiveJob returns any currently running job
func (r *Repository) GetActiveJob(ctx context.Context) (*models.VariantGenerationJob, error) {
	query := `
		SELECT id, status, total_products, processed_products, groups_created,
		       started_at, completed_at, error, created_at, updated_at
		FROM variant_generation_jobs
		WHERE status = $1
		ORDER BY created_at DESC
		LIMIT 1
	`

	var job models.VariantGenerationJob
	err := r.pool.QueryRow(ctx, query, models.VariantJobStatusRunning).Scan(
		&job.ID, &job.Status, &job.TotalProducts, &job.ProcessedProducts, &job.GroupsCreated,
		&job.StartedAt, &job.CompletedAt, &job.Error, &job.CreatedAt, &job.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting active job: %w", err)
	}

	return &job, nil
}

// ============================================================================
// GROUP OPERATIONS
// ============================================================================

// CreateGroup creates a new variant group
func (r *Repository) CreateGroup(ctx context.Context, baseName, baseNameNormalized string) (*models.ProductVariantGroup, error) {
	group := &models.ProductVariantGroup{
		ID:                 uuid.New(),
		BaseName:           baseName,
		BaseNameNormalized: baseNameNormalized,
		MemberCount:        0,
		CreatedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}

	query := `
		INSERT INTO product_variant_groups (id, base_name, base_name_normalized, member_count, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`

	_, err := r.pool.Exec(ctx, query,
		group.ID, group.BaseName, group.BaseNameNormalized, group.MemberCount, group.CreatedAt, group.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("creating group: %w", err)
	}

	return group, nil
}

// AddMemberToGroup adds a product to a variant group
func (r *Repository) AddMemberToGroup(ctx context.Context, groupID, productID uuid.UUID) error {
	query := `
		INSERT INTO product_variant_group_members (id, group_id, product_id, created_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (product_id) DO NOTHING
	`

	_, err := r.pool.Exec(ctx, query, uuid.New(), groupID, productID)
	if err != nil {
		return fmt.Errorf("adding member to group: %w", err)
	}

	return nil
}

// AddVariantProperty adds a variant property to a group
func (r *Repository) AddVariantProperty(ctx context.Context, groupID uuid.UUID, prop *models.VariantPropertyResult) error {
	valuesJSON, err := json.Marshal(prop.Values)
	if err != nil {
		return fmt.Errorf("marshaling property values: %w", err)
	}

	query := `
		INSERT INTO variant_properties (id, group_id, property_name, property_values, parent_property, parent_value, product_count, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
	`

	_, err = r.pool.Exec(ctx, query,
		uuid.New(), groupID, prop.PropertyName, valuesJSON, prop.ParentProperty, prop.ParentValue, prop.ProductCount,
	)
	if err != nil {
		return fmt.Errorf("adding variant property: %w", err)
	}

	return nil
}

// GetGroup retrieves a group by ID with members and properties
func (r *Repository) GetGroup(ctx context.Context, groupID uuid.UUID) (*models.VariantGroupWithDetails, error) {
	// Get the group
	groupQuery := `
		SELECT id, base_name, base_name_normalized, member_count, created_at, updated_at
		FROM product_variant_groups
		WHERE id = $1
	`

	var group models.ProductVariantGroup
	err := r.pool.QueryRow(ctx, groupQuery, groupID).Scan(
		&group.ID, &group.BaseName, &group.BaseNameNormalized, &group.MemberCount, &group.CreatedAt, &group.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting group: %w", err)
	}

	// Get members with product details
	membersQuery := `
		SELECT p.id, p.name, p.article, p.main_image_url, p.price_min, p.is_in_stock,
		       b.name as brand_name, c.name as category_name
		FROM product_variant_group_members m
		JOIN products p ON m.product_id = p.id
		LEFT JOIN brands b ON p.brand_id = b.id
		LEFT JOIN categories c ON p.category_id = c.id
		WHERE m.group_id = $1
		ORDER BY p.name
	`

	memberRows, err := r.pool.Query(ctx, membersQuery, groupID)
	if err != nil {
		return nil, fmt.Errorf("getting group members: %w", err)
	}
	defer memberRows.Close()

	members := make([]*models.ProductMemberInfo, 0)
	for memberRows.Next() {
		var member models.ProductMemberInfo
		if err := memberRows.Scan(
			&member.ID, &member.Name, &member.Article, &member.MainImageURL, &member.PriceMin, &member.IsInStock,
			&member.BrandName, &member.CategoryName,
		); err != nil {
			return nil, fmt.Errorf("scanning member: %w", err)
		}
		members = append(members, &member)
	}

	// Get variant properties
	propsQuery := `
		SELECT id, group_id, property_name, property_values, parent_property, parent_value, product_count, created_at
		FROM variant_properties
		WHERE group_id = $1
		ORDER BY property_name
	`

	propRows, err := r.pool.Query(ctx, propsQuery, groupID)
	if err != nil {
		return nil, fmt.Errorf("getting variant properties: %w", err)
	}
	defer propRows.Close()

	properties := make([]*models.VariantProperty, 0)
	for propRows.Next() {
		var prop models.VariantProperty
		var valuesJSON []byte
		if err := propRows.Scan(
			&prop.ID, &prop.GroupID, &prop.PropertyName, &valuesJSON, &prop.ParentProperty, &prop.ParentValue, &prop.ProductCount, &prop.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning property: %w", err)
		}
		if err := json.Unmarshal(valuesJSON, &prop.PropertyValues); err != nil {
			return nil, fmt.Errorf("unmarshaling property values: %w", err)
		}
		properties = append(properties, &prop)
	}

	return &models.VariantGroupWithDetails{
		ProductVariantGroup: &group,
		Members:             members,
		Properties:          properties,
	}, nil
}

// ListGroups retrieves groups with pagination and optional search
func (r *Repository) ListGroups(ctx context.Context, limit, offset int, search string) ([]*models.ProductVariantGroup, int, error) {
	var args []interface{}
	var whereClause string
	argIndex := 1

	if search != "" {
		whereClause = fmt.Sprintf(" WHERE base_name ILIKE $%d", argIndex)
		args = append(args, "%"+search+"%")
		argIndex++
	}

	// Get total count
	countQuery := "SELECT COUNT(*) FROM product_variant_groups" + whereClause
	var total int
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting groups: %w", err)
	}

	// Get groups
	query := fmt.Sprintf(`
		SELECT id, base_name, base_name_normalized, member_count, created_at, updated_at
		FROM product_variant_groups
		%s
		ORDER BY member_count DESC, base_name
		LIMIT $%d OFFSET $%d
	`, whereClause, argIndex, argIndex+1)

	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("listing groups: %w", err)
	}
	defer rows.Close()

	groups := make([]*models.ProductVariantGroup, 0)
	for rows.Next() {
		var group models.ProductVariantGroup
		if err := rows.Scan(
			&group.ID, &group.BaseName, &group.BaseNameNormalized, &group.MemberCount, &group.CreatedAt, &group.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scanning group: %w", err)
		}
		groups = append(groups, &group)
	}

	return groups, total, nil
}

// DeleteGroup deletes a group and its members/properties (cascade)
func (r *Repository) DeleteGroup(ctx context.Context, groupID uuid.UUID) error {
	query := `DELETE FROM product_variant_groups WHERE id = $1`
	result, err := r.pool.Exec(ctx, query, groupID)
	if err != nil {
		return fmt.Errorf("deleting group: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("group not found")
	}

	return nil
}

// ClearAllGroups removes all groups, members, and properties
func (r *Repository) ClearAllGroups(ctx context.Context) error {
	// Due to CASCADE, deleting groups will delete members and properties
	query := `DELETE FROM product_variant_groups`
	_, err := r.pool.Exec(ctx, query)
	if err != nil {
		return fmt.Errorf("clearing all groups: %w", err)
	}

	return nil
}

// GetGroupByNormalizedName finds a group by its normalized base name
func (r *Repository) GetGroupByNormalizedName(ctx context.Context, nameNorm string) (*models.ProductVariantGroup, error) {
	query := `
		SELECT id, base_name, base_name_normalized, member_count, created_at, updated_at
		FROM product_variant_groups
		WHERE base_name_normalized = $1
	`

	var group models.ProductVariantGroup
	err := r.pool.QueryRow(ctx, query, nameNorm).Scan(
		&group.ID, &group.BaseName, &group.BaseNameNormalized, &group.MemberCount, &group.CreatedAt, &group.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting group by name: %w", err)
	}

	return &group, nil
}

// ============================================================================
// PRODUCT QUERIES
// ============================================================================

// GetProductsForGeneration retrieves all active products for variant generation
func (r *Repository) GetProductsForGeneration(ctx context.Context) ([]*models.Product, error) {
	query := `
		SELECT id, ultra_id, code, article, name, slug, description, brand_id, category_id, parent_id, source_id,
		       main_image_url, images, videos, warranty, barcodes, price_min, price_max, total_stock, is_in_stock,
		       is_active, is_service, created_at, updated_at, prices, price_mdl, price_eur, price_usd,
		       name_ru, name_ro, description_ru, description_ro
		FROM products
		WHERE is_active = true
		ORDER BY name
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("querying products: %w", err)
	}
	defer rows.Close()

	products := make([]*models.Product, 0)
	for rows.Next() {
		var p models.Product
		if err := rows.Scan(
			&p.ID, &p.UltraID, &p.Code, &p.Article, &p.Name, &p.Slug, &p.Description, &p.BrandID, &p.CategoryID,
			&p.ParentID, &p.SourceID, &p.MainImageURL, &p.Images, &p.Videos, &p.Warranty, &p.Barcodes,
			&p.PriceMin, &p.PriceMax, &p.TotalStock, &p.IsInStock, &p.IsActive, &p.IsService,
			&p.CreatedAt, &p.UpdatedAt, &p.Prices, &p.PriceMDL, &p.PriceEUR, &p.PriceUSD,
			&p.NameRU, &p.NameRO, &p.DescriptionRU, &p.DescriptionRO,
		); err != nil {
			return nil, fmt.Errorf("scanning product: %w", err)
		}
		products = append(products, &p)
	}

	return products, nil
}

// GetProductsForGenerationBatch retrieves products in batches for memory efficiency
func (r *Repository) GetProductsForGenerationBatch(ctx context.Context, limit, offset int) ([]*models.Product, int, error) {
	// Get total count
	var total int
	countQuery := `SELECT COUNT(*) FROM products WHERE is_active = true`
	if err := r.pool.QueryRow(ctx, countQuery).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting products: %w", err)
	}

	query := `
		SELECT id, ultra_id, code, article, name, slug, description, brand_id, category_id, parent_id, source_id,
		       main_image_url, images, videos, warranty, barcodes, price_min, price_max, total_stock, is_in_stock,
		       is_active, is_service, created_at, updated_at, prices, price_mdl, price_eur, price_usd,
		       name_ru, name_ro, description_ru, description_ro
		FROM products
		WHERE is_active = true
		ORDER BY name
		LIMIT $1 OFFSET $2
	`

	rows, err := r.pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("querying products batch: %w", err)
	}
	defer rows.Close()

	products := make([]*models.Product, 0)
	for rows.Next() {
		var p models.Product
		if err := rows.Scan(
			&p.ID, &p.UltraID, &p.Code, &p.Article, &p.Name, &p.Slug, &p.Description, &p.BrandID, &p.CategoryID,
			&p.ParentID, &p.SourceID, &p.MainImageURL, &p.Images, &p.Videos, &p.Warranty, &p.Barcodes,
			&p.PriceMin, &p.PriceMax, &p.TotalStock, &p.IsInStock, &p.IsActive, &p.IsService,
			&p.CreatedAt, &p.UpdatedAt, &p.Prices, &p.PriceMDL, &p.PriceEUR, &p.PriceUSD,
			&p.NameRU, &p.NameRO, &p.DescriptionRU, &p.DescriptionRO,
		); err != nil {
			return nil, 0, fmt.Errorf("scanning product: %w", err)
		}
		products = append(products, &p)
	}

	return products, total, nil
}

// GetPropertiesForProducts retrieves properties for a list of products
func (r *Repository) GetPropertiesForProducts(ctx context.Context, productIDs []uuid.UUID) (map[uuid.UUID][]*models.Property, error) {
	if len(productIDs) == 0 {
		return make(map[uuid.UUID][]*models.Property), nil
	}

	// Build placeholders for IN clause
	placeholders := make([]string, len(productIDs))
	args := make([]interface{}, len(productIDs))
	for i, id := range productIDs {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = id
	}

	query := fmt.Sprintf(`
		SELECT id, product_id, property_uuid, property_name, property_code, value, value_type,
		       group_uuid, group_name, sort_order, is_filter, is_modification, created_at, updated_at,
		       property_name_ru, property_name_ro, group_name_ru, group_name_ro
		FROM properties
		WHERE product_id IN (%s)
		ORDER BY product_id, sort_order
	`, strings.Join(placeholders, ","))

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("querying properties: %w", err)
	}
	defer rows.Close()

	result := make(map[uuid.UUID][]*models.Property)
	for rows.Next() {
		var p models.Property
		if err := rows.Scan(
			&p.ID, &p.ProductID, &p.PropertyUUID, &p.PropertyName, &p.PropertyCode, &p.Value, &p.ValueType,
			&p.GroupUUID, &p.GroupName, &p.SortOrder, &p.IsFilter, &p.IsModification, &p.CreatedAt, &p.UpdatedAt,
			&p.PropertyNameRU, &p.PropertyNameRO, &p.GroupNameRU, &p.GroupNameRO,
		); err != nil {
			return nil, fmt.Errorf("scanning property: %w", err)
		}
		result[p.ProductID] = append(result[p.ProductID], &p)
	}

	return result, nil
}

// GetMemberProductIDs retrieves product IDs for a group
func (r *Repository) GetMemberProductIDs(ctx context.Context, groupID uuid.UUID) ([]uuid.UUID, error) {
	query := `
		SELECT product_id
		FROM product_variant_group_members
		WHERE group_id = $1
	`

	rows, err := r.pool.Query(ctx, query, groupID)
	if err != nil {
		return nil, fmt.Errorf("querying member product IDs: %w", err)
	}
	defer rows.Close()

	ids := make([]uuid.UUID, 0)
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scanning product ID: %w", err)
		}
		ids = append(ids, id)
	}

	return ids, nil
}

// GetMemberProducts retrieves full product objects for a group
func (r *Repository) GetMemberProducts(ctx context.Context, groupID uuid.UUID) ([]*models.Product, error) {
	query := `
		SELECT p.id, p.ultra_id, p.code, p.article, p.name, p.slug, p.description, p.brand_id, p.category_id,
		       p.parent_id, p.source_id, p.main_image_url, p.images, p.videos, p.warranty, p.barcodes,
		       p.price_min, p.price_max, p.total_stock, p.is_in_stock, p.is_active, p.is_service,
		       p.created_at, p.updated_at, p.prices, p.price_mdl, p.price_eur, p.price_usd,
		       p.name_ru, p.name_ro, p.description_ru, p.description_ro
		FROM products p
		JOIN product_variant_group_members m ON p.id = m.product_id
		WHERE m.group_id = $1
		ORDER BY p.name
	`

	rows, err := r.pool.Query(ctx, query, groupID)
	if err != nil {
		return nil, fmt.Errorf("querying member products: %w", err)
	}
	defer rows.Close()

	products := make([]*models.Product, 0)
	for rows.Next() {
		var p models.Product
		if err := rows.Scan(
			&p.ID, &p.UltraID, &p.Code, &p.Article, &p.Name, &p.Slug, &p.Description, &p.BrandID, &p.CategoryID,
			&p.ParentID, &p.SourceID, &p.MainImageURL, &p.Images, &p.Videos, &p.Warranty, &p.Barcodes,
			&p.PriceMin, &p.PriceMax, &p.TotalStock, &p.IsInStock, &p.IsActive, &p.IsService,
			&p.CreatedAt, &p.UpdatedAt, &p.Prices, &p.PriceMDL, &p.PriceEUR, &p.PriceUSD,
			&p.NameRU, &p.NameRO, &p.DescriptionRU, &p.DescriptionRO,
		); err != nil {
			return nil, fmt.Errorf("scanning member product: %w", err)
		}
		products = append(products, &p)
	}

	return products, nil
}

// ============================================================================
// STATISTICS
// ============================================================================

// GetStats returns variant generation statistics
func (r *Repository) GetStats(ctx context.Context) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Count groups
	var groupCount int
	if err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM product_variant_groups").Scan(&groupCount); err != nil {
		return nil, fmt.Errorf("counting groups: %w", err)
	}
	stats["total_groups"] = groupCount

	// Count products in groups
	var memberCount int
	if err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM product_variant_group_members").Scan(&memberCount); err != nil {
		return nil, fmt.Errorf("counting members: %w", err)
	}
	stats["total_products_in_groups"] = memberCount

	// Count variant properties
	var propCount int
	if err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM variant_properties").Scan(&propCount); err != nil {
		return nil, fmt.Errorf("counting properties: %w", err)
	}
	stats["total_variant_properties"] = propCount

	// Average members per group
	if groupCount > 0 {
		stats["avg_members_per_group"] = float64(memberCount) / float64(groupCount)
	} else {
		stats["avg_members_per_group"] = 0.0
	}

	// Get latest job
	latestJob, err := r.getLatestJob(ctx)
	if err != nil {
		return nil, err
	}
	if latestJob != nil {
		stats["latest_job"] = latestJob
	}

	return stats, nil
}

func (r *Repository) getLatestJob(ctx context.Context) (*models.VariantGenerationJob, error) {
	query := `
		SELECT id, status, total_products, processed_products, groups_created,
		       started_at, completed_at, error, created_at, updated_at
		FROM variant_generation_jobs
		ORDER BY created_at DESC
		LIMIT 1
	`

	var job models.VariantGenerationJob
	err := r.pool.QueryRow(ctx, query).Scan(
		&job.ID, &job.Status, &job.TotalProducts, &job.ProcessedProducts, &job.GroupsCreated,
		&job.StartedAt, &job.CompletedAt, &job.Error, &job.CreatedAt, &job.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting latest job: %w", err)
	}

	return &job, nil
}
