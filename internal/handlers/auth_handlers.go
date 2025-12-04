package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
	"ultra-api-testing/internal/auth"
	"ultra-api-testing/internal/repository"
)

// AuthHandler handles authentication endpoints
type AuthHandler struct {
	adminUserRepo *repository.AdminUserRepository
	jwtSecret     string
	jwtExpiration time.Duration
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(adminUserRepo *repository.AdminUserRepository, jwtSecret string, jwtExpiration time.Duration) *AuthHandler {
	return &AuthHandler{
		adminUserRepo: adminUserRepo,
		jwtSecret:     jwtSecret,
		jwtExpiration: jwtExpiration,
	}
}

// LoginRequest represents the login request payload
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LoginResponse represents the login response payload
type LoginResponse struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
	User      UserInfo  `json:"user"`
}

// UserInfo represents user information in responses
type UserInfo struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

// Login handles POST /api/v1/auth/login
// @Summary Login with credentials
// @Description Authenticates a user and returns a JWT token
// @Tags Auth
// @Accept json
// @Produce json
// @Param credentials body LoginRequest true "Login credentials"
// @Success 200 {object} LoginResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/auth/login [post]
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate required fields
	if req.Username == "" || req.Password == "" {
		respondError(w, http.StatusBadRequest, "Validation failed", "username and password are required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// Authenticate user
	user, err := h.adminUserRepo.Authenticate(ctx, req.Username, req.Password)
	if err != nil {
		if errors.Is(err, repository.ErrInvalidCredentials) {
			// Generic error message - don't reveal whether username exists
			respondError(w, http.StatusUnauthorized, "Authentication failed", "Invalid username or password")
			return
		}
		respondError(w, http.StatusInternalServerError, "Authentication failed", "An error occurred during authentication")
		return
	}

	// Generate JWT token
	token, err := auth.GenerateToken(user.ID, user.Username, h.jwtSecret, h.jwtExpiration)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Token generation failed", err.Error())
		return
	}

	// Calculate expiration time
	expiresAt := time.Now().Add(h.jwtExpiration)

	// Return token and user info
	respondJSON(w, http.StatusOK, LoginResponse{
		Token:     token,
		ExpiresAt: expiresAt,
		User: UserInfo{
			ID:       user.ID.String(),
			Username: user.Username,
		},
	})
}

// Logout handles POST /api/v1/auth/logout
// @Summary Logout (client-side)
// @Description Logout endpoint - token invalidation is handled client-side
// @Tags Auth
// @Produce json
// @Success 200 {object} map[string]string
// @Router /api/v1/auth/logout [post]
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	// JWT tokens are stateless, so logout is handled client-side by removing the token
	// This endpoint exists for consistency and can be used for logging/analytics
	respondJSON(w, http.StatusOK, map[string]string{
		"message": "Logged out successfully",
	})
}

// GetCurrentUser handles GET /api/v1/auth/me
// @Summary Get current user info
// @Description Returns information about the currently authenticated user
// @Tags Auth
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/auth/me [get]
func (h *AuthHandler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	// Extract user ID from context (set by RequireAuth middleware)
	userIDValue := r.Context().Value(auth.UserIDKey)
	if userIDValue == nil {
		respondError(w, http.StatusUnauthorized, "Unauthorized", "User ID not found in context")
		return
	}

	userID, ok := userIDValue.(uuid.UUID)
	if !ok {
		respondError(w, http.StatusUnauthorized, "Unauthorized", "Invalid user ID in context")
		return
	}

	usernameValue := r.Context().Value(auth.UsernameKey)
	if usernameValue == nil {
		respondError(w, http.StatusUnauthorized, "Unauthorized", "Username not found in context")
		return
	}

	username, ok := usernameValue.(string)
	if !ok {
		respondError(w, http.StatusUnauthorized, "Unauthorized", "Invalid username in context")
		return
	}

	// Return user info
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": UserInfo{
			ID:       userID.String(),
			Username: username,
		},
	})
}
