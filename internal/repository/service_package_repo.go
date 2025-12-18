package repository

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/google/uuid"
	"github.com/gosimple/slug"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"ultra-api-testing/internal/models"
)

// Sentinel errors for service package repository operations
var (
	ErrServicePackageTypeNotFound    = errors.New("service package type not found")
	ErrServicePackageNotFound        = errors.New("service package not found")
	ErrServiceOrderNotFound          = errors.New("service order not found")
	ErrServicePackageTypeHasPackages = errors.New("cannot delete service package type: it has associated packages")
	ErrServicePackageHasOrders       = errors.New("cannot delete service package: it has associated orders")
	ErrInvalidServiceOrderInput      = errors.New("invalid service order input")
)

// Validation regex patterns
var (
	serviceEmailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	servicePhoneRegex = regexp.MustCompile(`^\+?[0-9\s\-\(\)]{7,20}$`)
)

// ============================================================================
// SERVICE PACKAGE TYPE REPOSITORY
// ============================================================================

type ServicePackageTypeRepository struct {
	pool *pgxpool.Pool
}

func NewServicePackageTypeRepository(pool *pgxpool.Pool) *ServicePackageTypeRepository {
	return &ServicePackageTypeRepository{pool: pool}
}

func (r *ServicePackageTypeRepository) Create(ctx context.Context, input *models.ServicePackageTypeInput) (*models.ServicePackageType, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, fmt.Errorf("service package type name cannot be empty")
	}

	// Apply multi-lang auto-fill
	_, nameRu, nameRo := models.ApplyMultiLangAutoFill(name, input.NameRu, input.NameRo)

	// Generate slug
	typeSlug := slug.Make(name)
	if input.Slug != nil && strings.TrimSpace(*input.Slug) != "" {
		typeSlug = slug.Make(*input.Slug)
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
		INSERT INTO service_package_types (name, name_ru, name_ro, slug, sort_order, is_active)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, name, name_ru, name_ro, slug, sort_order, is_active, created_at, updated_at
	`

	packageType := &models.ServicePackageType{}
	err := r.pool.QueryRow(ctx, query, name, nameRu, nameRo, typeSlug, sortOrder, isActive).Scan(
		&packageType.ID, &packageType.Name, &packageType.NameRu, &packageType.NameRo,
		&packageType.Slug, &packageType.SortOrder, &packageType.IsActive,
		&packageType.CreatedAt, &packageType.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create service package type: %w", err)
	}

	return packageType, nil
}

func (r *ServicePackageTypeRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.ServicePackageType, error) {
	query := `
		SELECT id, name, name_ru, name_ro, slug, sort_order, is_active, created_at, updated_at
		FROM service_package_types WHERE id = $1
	`

	packageType := &models.ServicePackageType{}
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&packageType.ID, &packageType.Name, &packageType.NameRu, &packageType.NameRo,
		&packageType.Slug, &packageType.SortOrder, &packageType.IsActive,
		&packageType.CreatedAt, &packageType.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrServicePackageTypeNotFound
		}
		return nil, fmt.Errorf("get service package type: %w", err)
	}

	return packageType, nil
}

// GetBySlug retrieves a service package type by its slug
func (r *ServicePackageTypeRepository) GetBySlug(ctx context.Context, slug string) (*models.ServicePackageType, error) {
	query := `
		SELECT id, name, name_ru, name_ro, slug, sort_order, is_active, created_at, updated_at
		FROM service_package_types WHERE slug = $1 AND is_active = true
	`

	packageType := &models.ServicePackageType{}
	err := r.pool.QueryRow(ctx, query, slug).Scan(
		&packageType.ID, &packageType.Name, &packageType.NameRu, &packageType.NameRo,
		&packageType.Slug, &packageType.SortOrder, &packageType.IsActive,
		&packageType.CreatedAt, &packageType.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrServicePackageTypeNotFound
		}
		return nil, fmt.Errorf("get service package type by slug: %w", err)
	}

	return packageType, nil
}

// GetIDBySlug retrieves just the ID of a service package type by its slug
func (r *ServicePackageTypeRepository) GetIDBySlug(ctx context.Context, slug string) (*uuid.UUID, error) {
	query := `SELECT id FROM service_package_types WHERE slug = $1 AND is_active = true`
	var id uuid.UUID
	err := r.pool.QueryRow(ctx, query, slug).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrServicePackageTypeNotFound
		}
		return nil, fmt.Errorf("get service package type id by slug: %w", err)
	}
	return &id, nil
}

func (r *ServicePackageTypeRepository) List(ctx context.Context, filters *models.ServicePackageTypeFilters, limit, offset int) ([]*models.ServicePackageType, error) {
	query := `SELECT id, name, name_ru, name_ro, slug, sort_order, is_active, created_at, updated_at FROM service_package_types`

	var conditions []string
	var args []interface{}
	argNum := 1

	if filters != nil {
		if filters.Search != "" {
			conditions = append(conditions, fmt.Sprintf("(name ILIKE $%d OR name_ru ILIKE $%d OR name_ro ILIKE $%d)", argNum, argNum, argNum))
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
	query += " ORDER BY sort_order, name"
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argNum, argNum+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query service package types: %w", err)
	}
	defer rows.Close()

	var types []*models.ServicePackageType
	for rows.Next() {
		pt := &models.ServicePackageType{}
		if err := rows.Scan(&pt.ID, &pt.Name, &pt.NameRu, &pt.NameRo, &pt.Slug, &pt.SortOrder, &pt.IsActive, &pt.CreatedAt, &pt.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan service package type: %w", err)
		}
		types = append(types, pt)
	}

	return types, nil
}

func (r *ServicePackageTypeRepository) Count(ctx context.Context, filters *models.ServicePackageTypeFilters) (int, error) {
	query := `SELECT COUNT(*) FROM service_package_types`
	var conditions []string
	var args []interface{}
	argNum := 1

	if filters != nil {
		if filters.Search != "" {
			conditions = append(conditions, fmt.Sprintf("(name ILIKE $%d OR name_ru ILIKE $%d OR name_ro ILIKE $%d)", argNum, argNum, argNum))
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
		return 0, fmt.Errorf("count service package types: %w", err)
	}
	return count, nil
}

func (r *ServicePackageTypeRepository) Update(ctx context.Context, id uuid.UUID, input *models.ServicePackageTypeInput) (*models.ServicePackageType, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, fmt.Errorf("service package type name cannot be empty")
	}

	_, nameRu, nameRo := models.ApplyMultiLangAutoFill(name, input.NameRu, input.NameRo)

	typeSlug := slug.Make(name)
	if input.Slug != nil && strings.TrimSpace(*input.Slug) != "" {
		typeSlug = slug.Make(*input.Slug)
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
		UPDATE service_package_types
		SET name = $1, name_ru = $2, name_ro = $3, slug = $4, sort_order = $5, is_active = $6, updated_at = NOW()
		WHERE id = $7
		RETURNING id, name, name_ru, name_ro, slug, sort_order, is_active, created_at, updated_at
	`

	packageType := &models.ServicePackageType{}
	err := r.pool.QueryRow(ctx, query, name, nameRu, nameRo, typeSlug, sortOrder, isActive, id).Scan(
		&packageType.ID, &packageType.Name, &packageType.NameRu, &packageType.NameRo,
		&packageType.Slug, &packageType.SortOrder, &packageType.IsActive,
		&packageType.CreatedAt, &packageType.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrServicePackageTypeNotFound
		}
		return nil, fmt.Errorf("update service package type: %w", err)
	}

	return packageType, nil
}

func (r *ServicePackageTypeRepository) Delete(ctx context.Context, id uuid.UUID) error {
	var count int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM service_packages WHERE type_id = $1`, id).Scan(&count)
	if err != nil {
		return fmt.Errorf("check service package references: %w", err)
	}
	if count > 0 {
		return ErrServicePackageTypeHasPackages
	}

	cmdTag, err := r.pool.Exec(ctx, `DELETE FROM service_package_types WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete service package type: %w", err)
	}
	if cmdTag.RowsAffected() == 0 {
		return ErrServicePackageTypeNotFound
	}
	return nil
}

// ============================================================================
// SERVICE PACKAGE REPOSITORY
// ============================================================================

type ServicePackageRepository struct {
	pool *pgxpool.Pool
}

func NewServicePackageRepository(pool *pgxpool.Pool) *ServicePackageRepository {
	return &ServicePackageRepository{pool: pool}
}

func (r *ServicePackageRepository) Create(ctx context.Context, input *models.ServicePackageInput) (*models.ServicePackage, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, fmt.Errorf("service package name cannot be empty")
	}

	_, nameRu, nameRo := models.ApplyMultiLangAutoFill(name, input.NameRu, input.NameRo)

	sortOrder := 0
	if input.SortOrder != nil {
		sortOrder = *input.SortOrder
	}
	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}
	benefits := input.Benefits
	if benefits == nil {
		benefits = models.JSONBArray{}
	}
	specialBenefits := input.SpecialBenefits
	if specialBenefits == nil {
		specialBenefits = models.JSONBArray{}
	}

	query := `
		INSERT INTO service_packages (type_id, name, name_ru, name_ro, price, network_speed, benefits, special_benefits, sort_order, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, type_id, name, name_ru, name_ro, price, network_speed, benefits, special_benefits, sort_order, is_active, created_at, updated_at
	`

	pkg := &models.ServicePackage{}
	err := r.pool.QueryRow(ctx, query, input.TypeID, name, nameRu, nameRo, input.Price, input.NetworkSpeed, benefits, specialBenefits, sortOrder, isActive).Scan(
		&pkg.ID, &pkg.TypeID, &pkg.Name, &pkg.NameRu, &pkg.NameRo,
		&pkg.Price, &pkg.NetworkSpeed, &pkg.Benefits, &pkg.SpecialBenefits,
		&pkg.SortOrder, &pkg.IsActive, &pkg.CreatedAt, &pkg.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create service package: %w", err)
	}

	return pkg, nil
}

func (r *ServicePackageRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.ServicePackage, error) {
	query := `
		SELECT sp.id, sp.type_id, sp.name, sp.name_ru, sp.name_ro, sp.price, sp.network_speed,
		       sp.benefits, sp.special_benefits, sp.sort_order, sp.is_active, sp.created_at, sp.updated_at,
		       spt.name as type_name
		FROM service_packages sp
		LEFT JOIN service_package_types spt ON spt.id = sp.type_id
		WHERE sp.id = $1
	`

	pkg := &models.ServicePackage{}
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&pkg.ID, &pkg.TypeID, &pkg.Name, &pkg.NameRu, &pkg.NameRo,
		&pkg.Price, &pkg.NetworkSpeed, &pkg.Benefits, &pkg.SpecialBenefits,
		&pkg.SortOrder, &pkg.IsActive, &pkg.CreatedAt, &pkg.UpdatedAt,
		&pkg.TypeName,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrServicePackageNotFound
		}
		return nil, fmt.Errorf("get service package: %w", err)
	}

	return pkg, nil
}

func (r *ServicePackageRepository) List(ctx context.Context, filters *models.ServicePackageFilters, limit, offset int) ([]*models.ServicePackage, error) {
	query := `
		SELECT sp.id, sp.type_id, sp.name, sp.name_ru, sp.name_ro, sp.price, sp.network_speed,
		       sp.benefits, sp.special_benefits, sp.sort_order, sp.is_active, sp.created_at, sp.updated_at,
		       spt.name as type_name
		FROM service_packages sp
		LEFT JOIN service_package_types spt ON spt.id = sp.type_id
	`

	var conditions []string
	var args []interface{}
	argNum := 1

	if filters != nil {
		if filters.TypeID != nil {
			conditions = append(conditions, fmt.Sprintf("sp.type_id = $%d", argNum))
			args = append(args, *filters.TypeID)
			argNum++
		}
		if filters.Search != "" {
			conditions = append(conditions, fmt.Sprintf("(sp.name ILIKE $%d OR sp.name_ru ILIKE $%d OR sp.name_ro ILIKE $%d)", argNum, argNum, argNum))
			args = append(args, "%"+filters.Search+"%")
			argNum++
		}
		if filters.ActiveOnly {
			conditions = append(conditions, fmt.Sprintf("sp.is_active = $%d", argNum))
			args = append(args, true)
			argNum++
		}
	}

	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}
	query += " ORDER BY sp.sort_order, sp.name"
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argNum, argNum+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query service packages: %w", err)
	}
	defer rows.Close()

	var packages []*models.ServicePackage
	for rows.Next() {
		pkg := &models.ServicePackage{}
		if err := rows.Scan(
			&pkg.ID, &pkg.TypeID, &pkg.Name, &pkg.NameRu, &pkg.NameRo,
			&pkg.Price, &pkg.NetworkSpeed, &pkg.Benefits, &pkg.SpecialBenefits,
			&pkg.SortOrder, &pkg.IsActive, &pkg.CreatedAt, &pkg.UpdatedAt,
			&pkg.TypeName,
		); err != nil {
			return nil, fmt.Errorf("scan service package: %w", err)
		}
		packages = append(packages, pkg)
	}

	return packages, nil
}

func (r *ServicePackageRepository) Count(ctx context.Context, filters *models.ServicePackageFilters) (int, error) {
	query := `SELECT COUNT(*) FROM service_packages sp`
	var conditions []string
	var args []interface{}
	argNum := 1

	if filters != nil {
		if filters.TypeID != nil {
			conditions = append(conditions, fmt.Sprintf("sp.type_id = $%d", argNum))
			args = append(args, *filters.TypeID)
			argNum++
		}
		if filters.Search != "" {
			conditions = append(conditions, fmt.Sprintf("(sp.name ILIKE $%d OR sp.name_ru ILIKE $%d OR sp.name_ro ILIKE $%d)", argNum, argNum, argNum))
			args = append(args, "%"+filters.Search+"%")
			argNum++
		}
		if filters.ActiveOnly {
			conditions = append(conditions, fmt.Sprintf("sp.is_active = $%d", argNum))
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
		return 0, fmt.Errorf("count service packages: %w", err)
	}
	return count, nil
}

func (r *ServicePackageRepository) Update(ctx context.Context, id uuid.UUID, input *models.ServicePackageInput) (*models.ServicePackage, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, fmt.Errorf("service package name cannot be empty")
	}

	_, nameRu, nameRo := models.ApplyMultiLangAutoFill(name, input.NameRu, input.NameRo)

	sortOrder := 0
	if input.SortOrder != nil {
		sortOrder = *input.SortOrder
	}
	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}
	benefits := input.Benefits
	if benefits == nil {
		benefits = models.JSONBArray{}
	}
	specialBenefits := input.SpecialBenefits
	if specialBenefits == nil {
		specialBenefits = models.JSONBArray{}
	}

	query := `
		UPDATE service_packages
		SET type_id = $1, name = $2, name_ru = $3, name_ro = $4, price = $5, network_speed = $6,
		    benefits = $7, special_benefits = $8, sort_order = $9, is_active = $10, updated_at = NOW()
		WHERE id = $11
		RETURNING id, type_id, name, name_ru, name_ro, price, network_speed, benefits, special_benefits, sort_order, is_active, created_at, updated_at
	`

	pkg := &models.ServicePackage{}
	err := r.pool.QueryRow(ctx, query, input.TypeID, name, nameRu, nameRo, input.Price, input.NetworkSpeed, benefits, specialBenefits, sortOrder, isActive, id).Scan(
		&pkg.ID, &pkg.TypeID, &pkg.Name, &pkg.NameRu, &pkg.NameRo,
		&pkg.Price, &pkg.NetworkSpeed, &pkg.Benefits, &pkg.SpecialBenefits,
		&pkg.SortOrder, &pkg.IsActive, &pkg.CreatedAt, &pkg.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrServicePackageNotFound
		}
		return nil, fmt.Errorf("update service package: %w", err)
	}

	return pkg, nil
}

func (r *ServicePackageRepository) Delete(ctx context.Context, id uuid.UUID) error {
	var count int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM service_orders WHERE package_id = $1`, id).Scan(&count)
	if err != nil {
		return fmt.Errorf("check service order references: %w", err)
	}
	if count > 0 {
		return ErrServicePackageHasOrders
	}

	cmdTag, err := r.pool.Exec(ctx, `DELETE FROM service_packages WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete service package: %w", err)
	}
	if cmdTag.RowsAffected() == 0 {
		return ErrServicePackageNotFound
	}
	return nil
}

// ============================================================================
// SERVICE ORDER REPOSITORY
// ============================================================================

type ServiceOrderRepository struct {
	pool *pgxpool.Pool
}

func NewServiceOrderRepository(pool *pgxpool.Pool) *ServiceOrderRepository {
	return &ServiceOrderRepository{pool: pool}
}

func (r *ServiceOrderRepository) Create(ctx context.Context, input *models.CreateServiceOrderInput) (*models.ServiceOrder, error) {
	customerName := strings.TrimSpace(input.CustomerName)
	customerPhone := strings.TrimSpace(input.CustomerPhone)

	if customerName == "" {
		return nil, fmt.Errorf("%w: customer_name is required", ErrInvalidServiceOrderInput)
	}
	if customerPhone == "" {
		return nil, fmt.Errorf("%w: customer_phone is required", ErrInvalidServiceOrderInput)
	}

	if input.CustomerEmail != nil && *input.CustomerEmail != "" {
		if !serviceEmailRegex.MatchString(*input.CustomerEmail) {
			return nil, fmt.Errorf("%w: invalid email format", ErrInvalidServiceOrderInput)
		}
	}

	query := `
		INSERT INTO service_orders (package_id, customer_name, customer_phone, customer_email, customer_address, status)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, package_id, customer_name, customer_phone, customer_email, customer_address, status, notes, created_at, updated_at
	`

	order := &models.ServiceOrder{}
	err := r.pool.QueryRow(ctx, query, input.PackageID, customerName, customerPhone, input.CustomerEmail, input.CustomerAddress, models.ServiceOrderStatusPending).Scan(
		&order.ID, &order.PackageID, &order.CustomerName, &order.CustomerPhone,
		&order.CustomerEmail, &order.CustomerAddress, &order.Status, &order.Notes,
		&order.CreatedAt, &order.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create service order: %w", err)
	}

	return order, nil
}

func (r *ServiceOrderRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.ServiceOrder, error) {
	query := `
		SELECT so.id, so.package_id, so.customer_name, so.customer_phone, so.customer_email,
		       so.customer_address, so.status, so.notes, so.created_at, so.updated_at,
		       sp.name as package_name
		FROM service_orders so
		LEFT JOIN service_packages sp ON sp.id = so.package_id
		WHERE so.id = $1
	`

	order := &models.ServiceOrder{}
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&order.ID, &order.PackageID, &order.CustomerName, &order.CustomerPhone,
		&order.CustomerEmail, &order.CustomerAddress, &order.Status, &order.Notes,
		&order.CreatedAt, &order.UpdatedAt, &order.PackageName,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrServiceOrderNotFound
		}
		return nil, fmt.Errorf("get service order: %w", err)
	}

	return order, nil
}

func (r *ServiceOrderRepository) List(ctx context.Context, filters *models.ServiceOrderFilters, limit, offset int) ([]*models.ServiceOrder, error) {
	query := `
		SELECT so.id, so.package_id, so.customer_name, so.customer_phone, so.customer_email,
		       so.customer_address, so.status, so.notes, so.created_at, so.updated_at,
		       sp.name as package_name
		FROM service_orders so
		LEFT JOIN service_packages sp ON sp.id = so.package_id
	`

	var conditions []string
	var args []interface{}
	argNum := 1

	if filters != nil {
		if filters.PackageID != nil {
			conditions = append(conditions, fmt.Sprintf("so.package_id = $%d", argNum))
			args = append(args, *filters.PackageID)
			argNum++
		}
		if filters.Status != nil {
			conditions = append(conditions, fmt.Sprintf("so.status = $%d", argNum))
			args = append(args, *filters.Status)
			argNum++
		}
		if filters.Search != "" {
			conditions = append(conditions, fmt.Sprintf("(so.customer_name ILIKE $%d OR so.customer_phone ILIKE $%d OR so.customer_email ILIKE $%d)", argNum, argNum, argNum))
			args = append(args, "%"+filters.Search+"%")
			argNum++
		}
		if filters.DateFrom != nil {
			conditions = append(conditions, fmt.Sprintf("so.created_at >= $%d", argNum))
			args = append(args, *filters.DateFrom)
			argNum++
		}
		if filters.DateTo != nil {
			conditions = append(conditions, fmt.Sprintf("so.created_at <= $%d", argNum))
			args = append(args, *filters.DateTo)
			argNum++
		}
	}

	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}
	query += " ORDER BY so.created_at DESC"
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argNum, argNum+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query service orders: %w", err)
	}
	defer rows.Close()

	var orders []*models.ServiceOrder
	for rows.Next() {
		order := &models.ServiceOrder{}
		if err := rows.Scan(
			&order.ID, &order.PackageID, &order.CustomerName, &order.CustomerPhone,
			&order.CustomerEmail, &order.CustomerAddress, &order.Status, &order.Notes,
			&order.CreatedAt, &order.UpdatedAt, &order.PackageName,
		); err != nil {
			return nil, fmt.Errorf("scan service order: %w", err)
		}
		orders = append(orders, order)
	}

	return orders, nil
}

func (r *ServiceOrderRepository) Count(ctx context.Context, filters *models.ServiceOrderFilters) (int, error) {
	query := `SELECT COUNT(*) FROM service_orders so`
	var conditions []string
	var args []interface{}
	argNum := 1

	if filters != nil {
		if filters.PackageID != nil {
			conditions = append(conditions, fmt.Sprintf("so.package_id = $%d", argNum))
			args = append(args, *filters.PackageID)
			argNum++
		}
		if filters.Status != nil {
			conditions = append(conditions, fmt.Sprintf("so.status = $%d", argNum))
			args = append(args, *filters.Status)
			argNum++
		}
		if filters.Search != "" {
			conditions = append(conditions, fmt.Sprintf("(so.customer_name ILIKE $%d OR so.customer_phone ILIKE $%d OR so.customer_email ILIKE $%d)", argNum, argNum, argNum))
			args = append(args, "%"+filters.Search+"%")
			argNum++
		}
	}

	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	var count int
	err := r.pool.QueryRow(ctx, query, args...).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count service orders: %w", err)
	}
	return count, nil
}

func (r *ServiceOrderRepository) Update(ctx context.Context, id uuid.UUID, input *models.UpdateServiceOrderInput) (*models.ServiceOrder, error) {
	var setClauses []string
	var args []interface{}
	argNum := 1

	if input.Status != nil {
		if !models.IsValidServiceOrderStatus(*input.Status) {
			return nil, fmt.Errorf("invalid service order status: %s", *input.Status)
		}
		setClauses = append(setClauses, fmt.Sprintf("status = $%d", argNum))
		args = append(args, *input.Status)
		argNum++
	}

	if input.Notes != nil {
		setClauses = append(setClauses, fmt.Sprintf("notes = $%d", argNum))
		args = append(args, *input.Notes)
		argNum++
	}

	if len(setClauses) == 0 {
		return r.GetByID(ctx, id)
	}

	setClauses = append(setClauses, "updated_at = NOW()")

	query := fmt.Sprintf(`
		UPDATE service_orders SET %s WHERE id = $%d
		RETURNING id, package_id, customer_name, customer_phone, customer_email, customer_address, status, notes, created_at, updated_at
	`, strings.Join(setClauses, ", "), argNum)
	args = append(args, id)

	order := &models.ServiceOrder{}
	err := r.pool.QueryRow(ctx, query, args...).Scan(
		&order.ID, &order.PackageID, &order.CustomerName, &order.CustomerPhone,
		&order.CustomerEmail, &order.CustomerAddress, &order.Status, &order.Notes,
		&order.CreatedAt, &order.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrServiceOrderNotFound
		}
		return nil, fmt.Errorf("update service order: %w", err)
	}

	return order, nil
}

func (r *ServiceOrderRepository) Delete(ctx context.Context, id uuid.UUID) error {
	cmdTag, err := r.pool.Exec(ctx, `DELETE FROM service_orders WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete service order: %w", err)
	}
	if cmdTag.RowsAffected() == 0 {
		return ErrServiceOrderNotFound
	}
	return nil
}

func (r *ServiceOrderRepository) GetStats(ctx context.Context) (*models.ServiceOrderStats, error) {
	query := `
		SELECT
			COUNT(*) as total_orders,
			COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
			COUNT(*) FILTER (WHERE status = 'contacted') as contacted_orders,
			COUNT(*) FILTER (WHERE status = 'approved') as approved_orders,
			COUNT(*) FILTER (WHERE status = 'rejected') as rejected_orders,
			COUNT(*) FILTER (WHERE status = 'completed') as completed_orders,
			COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as today_orders
		FROM service_orders
	`

	stats := &models.ServiceOrderStats{}
	err := r.pool.QueryRow(ctx, query).Scan(
		&stats.TotalOrders, &stats.PendingOrders, &stats.ContactedOrders,
		&stats.ApprovedOrders, &stats.RejectedOrders, &stats.CompletedOrders,
		&stats.TodayOrders,
	)
	if err != nil {
		return nil, fmt.Errorf("get service order stats: %w", err)
	}

	return stats, nil
}
