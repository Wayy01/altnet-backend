package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
	"ultra-api-testing/internal/models"
)

// Sentinel errors for admin user repository operations
var (
	ErrAdminUserNotFound      = errors.New("admin user not found")
	ErrInvalidCredentials     = errors.New("invalid credentials")
	ErrDuplicateAdminUsername = errors.New("username already exists")
)

const (
	// BcryptCost is the cost factor for bcrypt password hashing
	BcryptCost = 12
)

// AdminUserRepository handles admin user database operations
type AdminUserRepository struct {
	pool *pgxpool.Pool
}

// NewAdminUserRepository creates a new admin user repository
func NewAdminUserRepository(pool *pgxpool.Pool) *AdminUserRepository {
	return &AdminUserRepository{pool: pool}
}

// GetByUsername returns an admin user by username
func (r *AdminUserRepository) GetByUsername(ctx context.Context, username string) (*models.AdminUser, error) {
	query := `
		SELECT id, username, password_hash, created_at, updated_at
		FROM admin_users
		WHERE username = $1
	`

	user := &models.AdminUser{}
	err := r.pool.QueryRow(ctx, query, username).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAdminUserNotFound
		}
		return nil, fmt.Errorf("get admin user by username: %w", err)
	}

	return user, nil
}

// GetByID returns an admin user by ID
func (r *AdminUserRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.AdminUser, error) {
	query := `
		SELECT id, username, password_hash, created_at, updated_at
		FROM admin_users
		WHERE id = $1
	`

	user := &models.AdminUser{}
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAdminUserNotFound
		}
		return nil, fmt.Errorf("get admin user by id: %w", err)
	}

	return user, nil
}

// CreateAdminUserRequest represents the request for creating an admin user
type CreateAdminUserRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// Create creates a new admin user with hashed password
func (r *AdminUserRepository) Create(ctx context.Context, req *CreateAdminUserRequest) (*models.AdminUser, error) {
	// Validate input
	if req.Username == "" {
		return nil, fmt.Errorf("username cannot be empty")
	}
	if req.Password == "" {
		return nil, fmt.Errorf("password cannot be empty")
	}

	// Hash password using bcrypt with cost factor 12
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), BcryptCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	query := `
		INSERT INTO admin_users (username, password_hash)
		VALUES ($1, $2)
		RETURNING id, username, password_hash, created_at, updated_at
	`

	user := &models.AdminUser{}
	err = r.pool.QueryRow(ctx, query, req.Username, string(passwordHash)).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		// Check for unique constraint violation
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, ErrDuplicateAdminUsername
		}
		return nil, fmt.Errorf("create admin user: %w", err)
	}

	return user, nil
}

// ValidatePassword validates a password against a user's stored hash
func (r *AdminUserRepository) ValidatePassword(user *models.AdminUser, password string) error {
	err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
	if err != nil {
		if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
			return ErrInvalidCredentials
		}
		return fmt.Errorf("compare password: %w", err)
	}
	return nil
}

// Authenticate validates credentials and returns the user if valid
// This method does NOT reveal whether the username exists for security reasons
func (r *AdminUserRepository) Authenticate(ctx context.Context, username, password string) (*models.AdminUser, error) {
	user, err := r.GetByUsername(ctx, username)
	if err != nil {
		// Don't reveal whether user exists - return generic error
		if errors.Is(err, ErrAdminUserNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, fmt.Errorf("authenticate user: %w", err)
	}

	// Validate password
	if err := r.ValidatePassword(user, password); err != nil {
		return nil, err
	}

	return user, nil
}

// List returns all admin users
func (r *AdminUserRepository) List(ctx context.Context) ([]*models.AdminUser, error) {
	query := `
		SELECT id, username, password_hash, created_at, updated_at
		FROM admin_users
		ORDER BY created_at DESC
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list admin users: %w", err)
	}
	defer rows.Close()

	var users []*models.AdminUser
	for rows.Next() {
		user := &models.AdminUser{}
		if err := rows.Scan(
			&user.ID,
			&user.Username,
			&user.PasswordHash,
			&user.CreatedAt,
			&user.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan admin user: %w", err)
		}
		users = append(users, user)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate admin users: %w", err)
	}

	return users, nil
}

// Delete removes an admin user by username
func (r *AdminUserRepository) Delete(ctx context.Context, username string) error {
	query := `DELETE FROM admin_users WHERE username = $1`

	result, err := r.pool.Exec(ctx, query, username)
	if err != nil {
		return fmt.Errorf("delete admin user: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrAdminUserNotFound
	}

	return nil
}

// DeleteByID removes an admin user by ID
func (r *AdminUserRepository) DeleteByID(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM admin_users WHERE id = $1`

	result, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete admin user by id: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrAdminUserNotFound
	}

	return nil
}
