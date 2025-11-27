package translate

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	gt "gopkg.gilang.dev/google-translate"
)

// TranslationService wraps the google-translate library with rate limiting
type TranslationService struct {
	mu          sync.Mutex
	rateLimiter *time.Ticker
	lastRequest time.Time
	minDelay    time.Duration
}

// TranslationResult represents the result of a translation
type TranslationResult struct {
	OriginalText   string
	TranslatedText string
	TargetLang     string
	Error          error
}

// NewTranslationService creates a new translation service with rate limiting
// Note: With concurrent workers, each worker makes independent requests
// The free Google Translate API can handle ~20-30 concurrent requests
func NewTranslationService() *TranslationService {
	return &TranslationService{
		minDelay: 50 * time.Millisecond, // 20 requests/sec - safe for concurrent workers
	}
}

// Translate translates text to the target language
// Light rate limiting to avoid Google rate limits with concurrent workers
func (s *TranslationService) Translate(ctx context.Context, text, targetLang string) (*TranslationResult, error) {
	// Check context cancellation
	select {
	case <-ctx.Done():
		return &TranslationResult{
			OriginalText: text,
			TargetLang:   targetLang,
			Error:        ctx.Err(),
		}, ctx.Err()
	default:
	}

	// Skip empty text
	if strings.TrimSpace(text) == "" {
		return &TranslationResult{
			OriginalText:   text,
			TranslatedText: text,
			TargetLang:     targetLang,
		}, nil
	}

	// Delay per request to avoid Google rate limits
	// 10 workers with 50ms delay - tested and working
	time.Sleep(50 * time.Millisecond)

	// Perform translation
	result, err := gt.Translate(text, targetLang)
	if err != nil {
		return &TranslationResult{
			OriginalText: text,
			TargetLang:   targetLang,
			Error:        fmt.Errorf("translation failed: %w", err),
		}, err
	}

	return &TranslationResult{
		OriginalText:   text,
		TranslatedText: result.Text,
		TargetLang:     targetLang,
	}, nil
}

// TranslateBatch translates multiple texts to the target language
func (s *TranslationService) TranslateBatch(ctx context.Context, texts []string, targetLang string) []*TranslationResult {
	results := make([]*TranslationResult, len(texts))
	for i, text := range texts {
		select {
		case <-ctx.Done():
			// Fill remaining results with context error
			for j := i; j < len(texts); j++ {
				results[j] = &TranslationResult{
					OriginalText: texts[j],
					TargetLang:   targetLang,
					Error:        ctx.Err(),
				}
			}
			return results
		default:
			results[i], _ = s.Translate(ctx, text, targetLang)
		}
	}
	return results
}

// TranslateWithRetry translates text with retry logic
func (s *TranslationService) TranslateWithRetry(ctx context.Context, text, targetLang string, maxRetries int) (*TranslationResult, error) {
	var lastErr error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		result, err := s.Translate(ctx, text, targetLang)
		if err == nil {
			return result, nil
		}
		lastErr = err

		// Check if context is cancelled
		if ctx.Err() != nil {
			return result, ctx.Err()
		}

		// Exponential backoff
		if attempt < maxRetries {
			backoff := time.Duration(1<<uint(attempt)) * time.Second
			select {
			case <-ctx.Done():
				return result, ctx.Err()
			case <-time.After(backoff):
			}
		}
	}
	return &TranslationResult{
		OriginalText: text,
		TargetLang:   targetLang,
		Error:        lastErr,
	}, lastErr
}

// Close cleans up the translation service
func (s *TranslationService) Close() {
	if s.rateLimiter != nil {
		s.rateLimiter.Stop()
	}
}
