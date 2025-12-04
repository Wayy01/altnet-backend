package auth

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
)

// contextKey is a custom type for context keys to avoid collisions
type contextKey string

const (
	// UserIDKey is the context key for user ID
	UserIDKey contextKey = "user_id"
	// UsernameKey is the context key for username
	UsernameKey contextKey = "username"
)

// RequireAuth is middleware that validates JWT tokens and requires authentication
func RequireAuth(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract token from Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				respondUnauthorized(w, "Missing authorization header")
				return
			}

			// Check for Bearer token format
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || parts[0] != "Bearer" {
				respondUnauthorized(w, "Invalid authorization header format")
				return
			}

			tokenString := parts[1]

			// Validate token
			claims, err := ValidateToken(tokenString, jwtSecret)
			if err != nil {
				log.Printf("Token validation failed: %v", err)
				respondUnauthorized(w, "Invalid or expired token")
				return
			}

			// Add user info to request context
			ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
			ctx = context.WithValue(ctx, UsernameKey, claims.Username)

			// Call next handler with enriched context
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// respondUnauthorized sends a 401 Unauthorized response
func respondUnauthorized(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	response := map[string]string{
		"error": message,
	}
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Error encoding unauthorized response: %v", err)
	}
}
