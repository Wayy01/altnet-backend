package middleware

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// RateLimiter implements a token bucket rate limiter
type RateLimiter struct {
	mu       sync.RWMutex
	clients  map[string]*clientLimit
	rate     int           // requests per interval
	interval time.Duration // time window
	cleanup  time.Duration // cleanup old entries interval
}

type clientLimit struct {
	tokens    int
	lastReset time.Time
}

// NewRateLimiter creates a new rate limiter
// rate: maximum requests allowed
// interval: time window for the rate limit
func NewRateLimiter(rate int, interval time.Duration) *RateLimiter {
	rl := &RateLimiter{
		clients:  make(map[string]*clientLimit),
		rate:     rate,
		interval: interval,
		cleanup:  5 * time.Minute,
	}

	// Start cleanup goroutine to prevent memory leaks
	go rl.cleanupLoop()

	return rl
}

// cleanupLoop removes stale client entries
func (rl *RateLimiter) cleanupLoop() {
	ticker := time.NewTicker(rl.cleanup)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for ip, client := range rl.clients {
			// Remove entries older than 2x the interval
			if now.Sub(client.lastReset) > 2*rl.interval {
				delete(rl.clients, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// Allow checks if a request from the given IP should be allowed
func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	client, exists := rl.clients[ip]

	if !exists {
		rl.clients[ip] = &clientLimit{
			tokens:    rl.rate - 1, // Use one token
			lastReset: now,
		}
		return true
	}

	// Check if we need to reset the bucket
	if now.Sub(client.lastReset) >= rl.interval {
		client.tokens = rl.rate - 1 // Reset and use one token
		client.lastReset = now
		return true
	}

	// Check if we have tokens left
	if client.tokens > 0 {
		client.tokens--
		return true
	}

	return false
}

// RemainingTokens returns the number of remaining requests for an IP
func (rl *RateLimiter) RemainingTokens(ip string) int {
	rl.mu.RLock()
	defer rl.mu.RUnlock()

	client, exists := rl.clients[ip]
	if !exists {
		return rl.rate
	}

	// Check if bucket should be reset
	if time.Since(client.lastReset) >= rl.interval {
		return rl.rate
	}

	return client.tokens
}

// getClientIP extracts the real client IP from the request
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header (set by proxies/load balancers)
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		// Take the first IP in the chain
		ips := strings.Split(xff, ",")
		if len(ips) > 0 {
			ip := strings.TrimSpace(ips[0])
			if ip != "" {
				return ip
			}
		}
	}

	// Check X-Real-IP header
	xri := r.Header.Get("X-Real-IP")
	if xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

// Middleware creates an HTTP middleware for rate limiting
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := getClientIP(r)

		if !rl.Allow(ip) {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", rl.interval.String())
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error": "Rate limit exceeded", "message": "Too many requests. Please try again later."}`))
			return
		}

		// Add rate limit headers
		remaining := rl.RemainingTokens(ip)
		w.Header().Set("X-RateLimit-Limit", string(rune(rl.rate)))
		w.Header().Set("X-RateLimit-Remaining", string(rune(remaining)))

		next.ServeHTTP(w, r)
	})
}

// LoginRateLimiter creates a stricter rate limiter for login endpoints
// 5 attempts per 15 minutes per IP
func LoginRateLimiter() *RateLimiter {
	return NewRateLimiter(5, 15*time.Minute)
}

// APIRateLimiter creates a general rate limiter for API endpoints
// 100 requests per minute per IP
func APIRateLimiter() *RateLimiter {
	return NewRateLimiter(100, 1*time.Minute)
}

// UploadRateLimiter creates a rate limiter for upload endpoints
// 20 uploads per minute per IP
func UploadRateLimiter() *RateLimiter {
	return NewRateLimiter(20, 1*time.Minute)
}
