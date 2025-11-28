package translate

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
	"unicode"
)

// TranslationService wraps the LibreTranslate API client
type TranslationService struct {
	mu         sync.Mutex
	httpClient *http.Client
	baseURL    string
}

// TranslationResult represents the result of a translation
type TranslationResult struct {
	OriginalText   string
	TranslatedText string
	TargetLang     string
	Error          error
}

// libreTranslateRequest represents the request body for LibreTranslate API (single text)
type libreTranslateRequest struct {
	Q      string `json:"q"`
	Source string `json:"source"`
	Target string `json:"target"`
}

// libreTranslateBatchRequest represents the request body for batch translation
type libreTranslateBatchRequest struct {
	Q      []string `json:"q"`
	Source string   `json:"source"`
	Target string   `json:"target"`
}

// libreTranslateResponse represents the response from LibreTranslate API
type libreTranslateResponse struct {
	TranslatedText string `json:"translatedText"`
}

// libreTranslateBatchResponse represents batch response (array of translated texts)
type libreTranslateBatchResponse struct {
	TranslatedText []string `json:"translatedText"`
}

// libreTranslateErrorResponse represents an error response from LibreTranslate API
type libreTranslateErrorResponse struct {
	Error string `json:"error"`
}

// NewTranslationService creates a new translation service with LibreTranslate
// The baseURL should be the LibreTranslate server URL (e.g., http://localhost:5000)
func NewTranslationService(baseURL string) *TranslationService {
	// Create HTTP client with connection pooling for high concurrency
	transport := &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 100,
		MaxConnsPerHost:     100,
		IdleConnTimeout:     90 * time.Second,
	}

	return &TranslationService{
		httpClient: &http.Client{
			Transport: transport,
			Timeout:   45 * time.Second, // Optimal for single text translation
		},
		baseURL: strings.TrimSuffix(baseURL, "/"),
	}
}

// Translate translates text to the target language using LibreTranslate
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

	// Skip translation if source text is already in target language
	// This saves API calls when data is already in Russian (from Ultra API)
	if targetLang == "ru" && IsCyrillic(text) {
		// Source is already Russian, just copy it
		return &TranslationResult{
			OriginalText:   text,
			TranslatedText: text,
			TargetLang:     targetLang,
		}, nil
	}
	// Note: We don't skip Romanian translations because we can't distinguish
	// English from Romanian (both Latin). Always translate for Romanian target.

	// Prepare request body
	reqBody := libreTranslateRequest{
		Q:      text,
		Source: "auto",
		Target: targetLang,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return &TranslationResult{
			OriginalText: text,
			TargetLang:   targetLang,
			Error:        fmt.Errorf("failed to marshal request: %w", err),
		}, err
	}

	// Create HTTP request
	url := s.baseURL + "/translate"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(jsonBody))
	if err != nil {
		return &TranslationResult{
			OriginalText: text,
			TargetLang:   targetLang,
			Error:        fmt.Errorf("failed to create request: %w", err),
		}, err
	}

	req.Header.Set("Content-Type", "application/json")

	// Perform request
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return &TranslationResult{
			OriginalText: text,
			TargetLang:   targetLang,
			Error:        fmt.Errorf("translation request failed: %w", err),
		}, err
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return &TranslationResult{
			OriginalText: text,
			TargetLang:   targetLang,
			Error:        fmt.Errorf("failed to read response: %w", err),
		}, err
	}

	// Check for HTTP errors
	if resp.StatusCode != http.StatusOK {
		var errResp libreTranslateErrorResponse
		if json.Unmarshal(body, &errResp) == nil && errResp.Error != "" {
			return &TranslationResult{
				OriginalText: text,
				TargetLang:   targetLang,
				Error:        fmt.Errorf("translation failed: %s", errResp.Error),
			}, fmt.Errorf("translation failed: %s", errResp.Error)
		}
		return &TranslationResult{
			OriginalText: text,
			TargetLang:   targetLang,
			Error:        fmt.Errorf("translation failed with status %d: %s", resp.StatusCode, string(body)),
		}, fmt.Errorf("translation failed with status %d", resp.StatusCode)
	}

	// Parse successful response
	var result libreTranslateResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return &TranslationResult{
			OriginalText: text,
			TargetLang:   targetLang,
			Error:        fmt.Errorf("failed to parse response: %w", err),
		}, err
	}

	return &TranslationResult{
		OriginalText:   text,
		TranslatedText: result.TranslatedText,
		TargetLang:     targetLang,
	}, nil
}

// TranslateBatch translates multiple texts in a single API call using LibreTranslate's batch support
// This is much faster than translating one at a time
func (s *TranslationService) TranslateBatch(ctx context.Context, texts []string, targetLang string) ([]*TranslationResult, error) {
	if len(texts) == 0 {
		return []*TranslationResult{}, nil
	}

	// Check context cancellation
	select {
	case <-ctx.Done():
		results := make([]*TranslationResult, len(texts))
		for i, text := range texts {
			results[i] = &TranslationResult{
				OriginalText: text,
				TargetLang:   targetLang,
				Error:        ctx.Err(),
			}
		}
		return results, ctx.Err()
	default:
	}

	// Filter out empty texts and track their indices
	var nonEmptyTexts []string
	nonEmptyIndices := make([]int, 0, len(texts))
	results := make([]*TranslationResult, len(texts))

	for i, text := range texts {
		if strings.TrimSpace(text) == "" {
			// Empty text - just copy it
			results[i] = &TranslationResult{
				OriginalText:   text,
				TranslatedText: text,
				TargetLang:     targetLang,
			}
		} else {
			nonEmptyTexts = append(nonEmptyTexts, text)
			nonEmptyIndices = append(nonEmptyIndices, i)
		}
	}

	// If all texts were empty, return early
	if len(nonEmptyTexts) == 0 {
		return results, nil
	}

	// Prepare batch request
	reqBody := libreTranslateBatchRequest{
		Q:      nonEmptyTexts,
		Source: "auto",
		Target: targetLang,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		for _, idx := range nonEmptyIndices {
			results[idx] = &TranslationResult{
				OriginalText: texts[idx],
				TargetLang:   targetLang,
				Error:        fmt.Errorf("failed to marshal request: %w", err),
			}
		}
		return results, err
	}

	// Create HTTP request
	url := s.baseURL + "/translate"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(jsonBody))
	if err != nil {
		for _, idx := range nonEmptyIndices {
			results[idx] = &TranslationResult{
				OriginalText: texts[idx],
				TargetLang:   targetLang,
				Error:        fmt.Errorf("failed to create request: %w", err),
			}
		}
		return results, err
	}

	req.Header.Set("Content-Type", "application/json")

	// Perform request
	resp, err := s.httpClient.Do(req)
	if err != nil {
		for _, idx := range nonEmptyIndices {
			results[idx] = &TranslationResult{
				OriginalText: texts[idx],
				TargetLang:   targetLang,
				Error:        fmt.Errorf("translation request failed: %w", err),
			}
		}
		return results, err
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		for _, idx := range nonEmptyIndices {
			results[idx] = &TranslationResult{
				OriginalText: texts[idx],
				TargetLang:   targetLang,
				Error:        fmt.Errorf("failed to read response: %w", err),
			}
		}
		return results, err
	}

	// Check for HTTP errors
	if resp.StatusCode != http.StatusOK {
		var errResp libreTranslateErrorResponse
		errMsg := fmt.Sprintf("translation failed with status %d", resp.StatusCode)
		if json.Unmarshal(body, &errResp) == nil && errResp.Error != "" {
			errMsg = fmt.Sprintf("translation failed: %s", errResp.Error)
		}
		for _, idx := range nonEmptyIndices {
			results[idx] = &TranslationResult{
				OriginalText: texts[idx],
				TargetLang:   targetLang,
				Error:        fmt.Errorf(errMsg),
			}
		}
		return results, fmt.Errorf(errMsg)
	}

	// Parse batch response - LibreTranslate returns array when given array input
	var batchResult libreTranslateBatchResponse
	if err := json.Unmarshal(body, &batchResult); err != nil {
		// Try parsing as single response (in case only one text was sent)
		var singleResult libreTranslateResponse
		if err2 := json.Unmarshal(body, &singleResult); err2 == nil && singleResult.TranslatedText != "" {
			// Single response
			if len(nonEmptyIndices) > 0 {
				results[nonEmptyIndices[0]] = &TranslationResult{
					OriginalText:   nonEmptyTexts[0],
					TranslatedText: singleResult.TranslatedText,
					TargetLang:     targetLang,
				}
			}
			return results, nil
		}
		for _, idx := range nonEmptyIndices {
			results[idx] = &TranslationResult{
				OriginalText: texts[idx],
				TargetLang:   targetLang,
				Error:        fmt.Errorf("failed to parse response: %w", err),
			}
		}
		return results, err
	}

	// Map translated texts back to results
	for i, translatedText := range batchResult.TranslatedText {
		if i < len(nonEmptyIndices) {
			idx := nonEmptyIndices[i]
			results[idx] = &TranslationResult{
				OriginalText:   nonEmptyTexts[i],
				TranslatedText: translatedText,
				TargetLang:     targetLang,
			}
		}
	}

	// Fill in any remaining (shouldn't happen but just in case)
	for _, idx := range nonEmptyIndices {
		if results[idx] == nil {
			results[idx] = &TranslationResult{
				OriginalText: texts[idx],
				TargetLang:   targetLang,
				Error:        fmt.Errorf("no translation result received"),
			}
		}
	}

	return results, nil
}

// TranslateBatchWithRetry translates multiple texts with retry logic
func (s *TranslationService) TranslateBatchWithRetry(ctx context.Context, texts []string, targetLang string, maxRetries int) ([]*TranslationResult, error) {
	var lastErr error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		results, err := s.TranslateBatch(ctx, texts, targetLang)
		if err == nil {
			return results, nil
		}
		lastErr = err

		// Check if context is cancelled
		if ctx.Err() != nil {
			return results, ctx.Err()
		}

		// Exponential backoff
		if attempt < maxRetries {
			backoff := time.Duration(1<<uint(attempt)) * time.Second
			select {
			case <-ctx.Done():
				return results, ctx.Err()
			case <-time.After(backoff):
			}
		}
	}
	// Return empty results with error
	results := make([]*TranslationResult, len(texts))
	for i, text := range texts {
		results[i] = &TranslationResult{
			OriginalText: text,
			TargetLang:   targetLang,
			Error:        lastErr,
		}
	}
	return results, lastErr
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

// HealthCheck verifies that the LibreTranslate server is running and accessible
func (s *TranslationService) HealthCheck(ctx context.Context) error {
	// Try to get the languages endpoint which is lightweight
	url := s.baseURL + "/languages"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("failed to create health check request: %w", err)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("LibreTranslate health check failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("LibreTranslate returned status %d", resp.StatusCode)
	}

	return nil
}

// Close cleans up the translation service
func (s *TranslationService) Close() {
	// Close idle connections
	s.httpClient.CloseIdleConnections()
}

// IsCyrillic checks if the text is predominantly Cyrillic (Russian/Ukrainian/etc)
func IsCyrillic(text string) bool {
	if text == "" {
		return false
	}
	cyrillicCount := 0
	latinCount := 0
	for _, r := range text {
		if unicode.Is(unicode.Cyrillic, r) {
			cyrillicCount++
		} else if unicode.Is(unicode.Latin, r) {
			latinCount++
		}
	}
	// Text is Cyrillic if it has more Cyrillic than Latin characters
	return cyrillicCount > latinCount && cyrillicCount > 0
}

// IsLatin checks if the text is predominantly Latin-based
func IsLatin(text string) bool {
	if text == "" {
		return false
	}
	latinCount := 0
	cyrillicCount := 0
	for _, r := range text {
		if unicode.Is(unicode.Latin, r) {
			latinCount++
		} else if unicode.Is(unicode.Cyrillic, r) {
			cyrillicCount++
		}
	}
	return latinCount > cyrillicCount && latinCount > 0
}
