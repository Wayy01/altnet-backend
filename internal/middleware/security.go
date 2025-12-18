package middleware

import (
	"net/http"
	"strings"
)

// AllowedOrigins contains the whitelist of allowed CORS origins
var AllowedOrigins = map[string]bool{
	"http://localhost:3000":  true,
	"http://localhost:3001":  true,
	"http://127.0.0.1:3000":  true,
	"http://127.0.0.1:3001":  true,
	"https://localhost:3000": true,
	// Add your production domains here:
	// "https://admin.yourdomain.com": true,
	// "https://yourdomain.com": true,
}

// SecurityHeaders adds security headers to all responses
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Prevent MIME type sniffing
		w.Header().Set("X-Content-Type-Options", "nosniff")

		// Prevent clickjacking
		w.Header().Set("X-Frame-Options", "DENY")

		// XSS protection (legacy, but still useful for older browsers)
		w.Header().Set("X-XSS-Protection", "1; mode=block")

		// Referrer policy
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// Permissions policy (formerly Feature-Policy)
		w.Header().Set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")

		// Content Security Policy - adjust as needed for your frontend
		// This is a restrictive default; you may need to relax it
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'")

		// HSTS - only enable if you're serving over HTTPS
		// Uncomment for production with HTTPS:
		// w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")

		next.ServeHTTP(w, r)
	})
}

// SecureCORS handles CORS with origin validation instead of wildcard
func SecureCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		// Check if origin is allowed
		if origin != "" && isAllowedOrigin(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		w.Header().Set("Access-Control-Max-Age", "86400")

		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// isAllowedOrigin checks if the origin is in the whitelist
func isAllowedOrigin(origin string) bool {
	// Check exact match
	if AllowedOrigins[origin] {
		return true
	}

	// Also allow same-origin requests (no Origin header)
	if origin == "" {
		return true
	}

	// Check for development localhost with any port
	if strings.HasPrefix(origin, "http://localhost:") ||
		strings.HasPrefix(origin, "http://127.0.0.1:") {
		return true
	}

	return false
}

// AddAllowedOrigin dynamically adds an origin to the whitelist
func AddAllowedOrigin(origin string) {
	AllowedOrigins[origin] = true
}
