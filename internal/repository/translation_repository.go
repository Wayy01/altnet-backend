package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"ultra-api-testing/internal/models"
)

// TranslationRepository handles translation-related database operations
type TranslationRepository struct {
	pool *pgxpool.Pool
}

// NewTranslationRepository creates a new translation repository
func NewTranslationRepository(pool *pgxpool.Pool) *TranslationRepository {
	return &TranslationRepository{pool: pool}
}

// ============================================================================
// TRANSLATION JOB OPERATIONS
// ============================================================================

// CreateTranslationJob creates a new translation job
func (r *TranslationRepository) CreateTranslationJob(ctx context.Context, job *models.TranslationJob) error {
	query := `
		INSERT INTO translation_jobs (
			id, entity_type, target_language, status, total_items,
			translated_items, failed_items, skipped_items, error_message,
			started_at, completed_at, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
		)
	`
	_, err := r.pool.Exec(ctx, query,
		job.ID, job.EntityType, job.TargetLanguage, job.Status, job.TotalItems,
		job.TranslatedItems, job.FailedItems, job.SkippedItems, job.ErrorMessage,
		job.StartedAt, job.CompletedAt, job.CreatedAt, job.UpdatedAt,
	)
	return err
}

// UpdateTranslationJob updates an existing translation job
func (r *TranslationRepository) UpdateTranslationJob(ctx context.Context, job *models.TranslationJob) error {
	query := `
		UPDATE translation_jobs SET
			status = $2,
			total_items = $3,
			translated_items = $4,
			failed_items = $5,
			skipped_items = $6,
			error_message = $7,
			started_at = $8,
			completed_at = $9,
			updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.pool.Exec(ctx, query,
		job.ID, job.Status, job.TotalItems, job.TranslatedItems,
		job.FailedItems, job.SkippedItems, job.ErrorMessage,
		job.StartedAt, job.CompletedAt,
	)
	return err
}

// GetTranslationJob retrieves a translation job by ID
func (r *TranslationRepository) GetTranslationJob(ctx context.Context, id uuid.UUID) (*models.TranslationJob, error) {
	query := `
		SELECT id, entity_type, target_language, status, total_items,
			   translated_items, failed_items, skipped_items, error_message,
			   started_at, completed_at, created_at, updated_at
		FROM translation_jobs
		WHERE id = $1
	`
	job := &models.TranslationJob{}
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&job.ID, &job.EntityType, &job.TargetLanguage, &job.Status, &job.TotalItems,
		&job.TranslatedItems, &job.FailedItems, &job.SkippedItems, &job.ErrorMessage,
		&job.StartedAt, &job.CompletedAt, &job.CreatedAt, &job.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return job, nil
}

// ListTranslationJobs lists translation jobs with pagination
func (r *TranslationRepository) ListTranslationJobs(ctx context.Context, limit, offset int, entityType, targetLang, status string) ([]*models.TranslationJob, int, error) {
	// Build WHERE clause
	whereClause := "TRUE"
	args := make([]interface{}, 0)
	argPos := 1

	if entityType != "" {
		whereClause += fmt.Sprintf(" AND entity_type = $%d", argPos)
		args = append(args, entityType)
		argPos++
	}
	if targetLang != "" {
		whereClause += fmt.Sprintf(" AND target_language = $%d", argPos)
		args = append(args, targetLang)
		argPos++
	}
	if status != "" {
		whereClause += fmt.Sprintf(" AND status = $%d", argPos)
		args = append(args, status)
		argPos++
	}

	// Count query
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM translation_jobs WHERE %s", whereClause)
	var total int
	err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Data query
	args = append(args, limit, offset)
	query := fmt.Sprintf(`
		SELECT id, entity_type, target_language, status, total_items,
			   translated_items, failed_items, skipped_items, error_message,
			   started_at, completed_at, created_at, updated_at
		FROM translation_jobs
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argPos, argPos+1)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	jobs := make([]*models.TranslationJob, 0)
	for rows.Next() {
		job := &models.TranslationJob{}
		err := rows.Scan(
			&job.ID, &job.EntityType, &job.TargetLanguage, &job.Status, &job.TotalItems,
			&job.TranslatedItems, &job.FailedItems, &job.SkippedItems, &job.ErrorMessage,
			&job.StartedAt, &job.CompletedAt, &job.CreatedAt, &job.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		jobs = append(jobs, job)
	}

	return jobs, total, nil
}

// GetActiveTranslationJob returns an active job for the given entity type and language
func (r *TranslationRepository) GetActiveTranslationJob(ctx context.Context, entityType, targetLang string) (*models.TranslationJob, error) {
	query := `
		SELECT id, entity_type, target_language, status, total_items,
			   translated_items, failed_items, skipped_items, error_message,
			   started_at, completed_at, created_at, updated_at
		FROM translation_jobs
		WHERE entity_type = $1 AND target_language = $2 AND status IN ('pending', 'running')
		ORDER BY created_at DESC
		LIMIT 1
	`
	job := &models.TranslationJob{}
	err := r.pool.QueryRow(ctx, query, entityType, targetLang).Scan(
		&job.ID, &job.EntityType, &job.TargetLanguage, &job.Status, &job.TotalItems,
		&job.TranslatedItems, &job.FailedItems, &job.SkippedItems, &job.ErrorMessage,
		&job.StartedAt, &job.CompletedAt, &job.CreatedAt, &job.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return job, nil
}

// ============================================================================
// TRANSLATION LOG OPERATIONS
// ============================================================================

// CreateTranslationLog creates a new translation log entry
func (r *TranslationRepository) CreateTranslationLog(ctx context.Context, log *models.TranslationLog) error {
	query := `
		INSERT INTO translation_logs (
			id, job_id, entity_type, entity_id, field_name,
			original_value, source_text, translated_text, target_language,
			status, error_message, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
		)
	`
	_, err := r.pool.Exec(ctx, query,
		log.ID, log.JobID, log.EntityType, log.EntityID, log.FieldName,
		log.OriginalValue, log.SourceText, log.TranslatedText, log.TargetLanguage,
		log.Status, log.ErrorMessage, log.CreatedAt,
	)
	return err
}

// BulkCreateTranslationLogs creates multiple log entries at once
func (r *TranslationRepository) BulkCreateTranslationLogs(ctx context.Context, logs []*models.TranslationLog) error {
	if len(logs) == 0 {
		return nil
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, log := range logs {
		query := `
			INSERT INTO translation_logs (
				id, job_id, entity_type, entity_id, field_name,
				original_value, source_text, translated_text, target_language,
				status, error_message, created_at
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
			)
		`
		_, err := tx.Exec(ctx, query,
			log.ID, log.JobID, log.EntityType, log.EntityID, log.FieldName,
			log.OriginalValue, log.SourceText, log.TranslatedText, log.TargetLanguage,
			log.Status, log.ErrorMessage, log.CreatedAt,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// GetTranslationLogs retrieves logs for a specific job
func (r *TranslationRepository) GetTranslationLogs(ctx context.Context, jobID uuid.UUID, limit, offset int) ([]*models.TranslationLog, int, error) {
	// Count query
	var total int
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM translation_logs WHERE job_id = $1", jobID).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Data query
	query := `
		SELECT id, job_id, entity_type, entity_id, field_name,
			   original_value, source_text, translated_text, target_language,
			   status, error_message, created_at
		FROM translation_logs
		WHERE job_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`
	rows, err := r.pool.Query(ctx, query, jobID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	logs := make([]*models.TranslationLog, 0)
	for rows.Next() {
		log := &models.TranslationLog{}
		err := rows.Scan(
			&log.ID, &log.JobID, &log.EntityType, &log.EntityID, &log.FieldName,
			&log.OriginalValue, &log.SourceText, &log.TranslatedText, &log.TargetLanguage,
			&log.Status, &log.ErrorMessage, &log.CreatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		logs = append(logs, log)
	}

	return logs, total, nil
}

// ============================================================================
// TRANSLATION STATISTICS
// ============================================================================

// GetTranslationStats returns translation statistics
func (r *TranslationRepository) GetTranslationStats(ctx context.Context) (*models.TranslationStats, error) {
	stats := &models.TranslationStats{}

	// Product stats
	err := r.pool.QueryRow(ctx, `
		SELECT
			COUNT(*) as total,
			COUNT(name_ru) as translated_ru,
			COUNT(name_ro) as translated_ro,
			COUNT(*) - COUNT(name_ru) as pending_ru,
			COUNT(*) - COUNT(name_ro) as pending_ro
		FROM products
	`).Scan(
		&stats.Products.Total,
		&stats.Products.TranslatedRU,
		&stats.Products.TranslatedRO,
		&stats.Products.PendingRU,
		&stats.Products.PendingRO,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get product stats: %w", err)
	}

	// Category stats
	err = r.pool.QueryRow(ctx, `
		SELECT
			COUNT(*) as total,
			COUNT(name_ru) as translated_ru,
			COUNT(name_ro) as translated_ro,
			COUNT(*) - COUNT(name_ru) as pending_ru,
			COUNT(*) - COUNT(name_ro) as pending_ro
		FROM categories
	`).Scan(
		&stats.Categories.Total,
		&stats.Categories.TranslatedRU,
		&stats.Categories.TranslatedRO,
		&stats.Categories.PendingRU,
		&stats.Categories.PendingRO,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get category stats: %w", err)
	}

	// Property stats - from lookup tables for fast queries
	err = r.pool.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM property_group_translations) as total_groups,
			(SELECT COUNT(*) FROM property_name_translations) as total_names,
			(SELECT COUNT(*) FROM property_group_translations WHERE name_ru IS NOT NULL) as groups_translated_ru,
			(SELECT COUNT(*) FROM property_group_translations WHERE name_ro IS NOT NULL) as groups_translated_ro,
			(SELECT COUNT(*) FROM property_name_translations WHERE name_ru IS NOT NULL) as names_translated_ru,
			(SELECT COUNT(*) FROM property_name_translations WHERE name_ro IS NOT NULL) as names_translated_ro
	`).Scan(
		&stats.Properties.TotalGroups,
		&stats.Properties.TotalNames,
		&stats.Properties.GroupsTranslatedRU,
		&stats.Properties.GroupsTranslatedRO,
		&stats.Properties.NamesTranslatedRU,
		&stats.Properties.NamesTranslatedRO,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get property stats: %w", err)
	}

	// Calculate pending
	stats.Properties.GroupsPendingRU = stats.Properties.TotalGroups - stats.Properties.GroupsTranslatedRU
	stats.Properties.GroupsPendingRO = stats.Properties.TotalGroups - stats.Properties.GroupsTranslatedRO
	stats.Properties.NamesPendingRU = stats.Properties.TotalNames - stats.Properties.NamesTranslatedRU
	stats.Properties.NamesPendingRO = stats.Properties.TotalNames - stats.Properties.NamesTranslatedRO

	return stats, nil
}

// ============================================================================
// PRODUCT TRANSLATION OPERATIONS
// ============================================================================

// GetUntranslatedProducts returns products that need translation
func (r *TranslationRepository) GetUntranslatedProducts(ctx context.Context, targetLang string, limit int) ([]*models.Product, error) {
	var query string
	if targetLang == "ru" {
		query = `
			SELECT id, name, description
			FROM products
			WHERE name_ru IS NULL
			ORDER BY id
			LIMIT $1
		`
	} else {
		query = `
			SELECT id, name, description
			FROM products
			WHERE name_ro IS NULL
			ORDER BY id
			LIMIT $1
		`
	}

	rows, err := r.pool.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	products := make([]*models.Product, 0)
	for rows.Next() {
		p := &models.Product{}
		err := rows.Scan(&p.ID, &p.Name, &p.Description)
		if err != nil {
			return nil, err
		}
		products = append(products, p)
	}

	return products, nil
}

// UpdateProductTranslation updates product translation fields
func (r *TranslationRepository) UpdateProductTranslation(ctx context.Context, id uuid.UUID, nameTranslated, descTranslated *string, targetLang string) error {
	var query string
	if targetLang == "ru" {
		query = `UPDATE products SET name_ru = $2, description_ru = $3, updated_at = NOW() WHERE id = $1`
	} else {
		query = `UPDATE products SET name_ro = $2, description_ro = $3, updated_at = NOW() WHERE id = $1`
	}
	_, err := r.pool.Exec(ctx, query, id, nameTranslated, descTranslated)
	return err
}

// ============================================================================
// CATEGORY TRANSLATION OPERATIONS
// ============================================================================

// GetUntranslatedCategories returns categories that need translation
func (r *TranslationRepository) GetUntranslatedCategories(ctx context.Context, targetLang string, limit int) ([]*models.Category, error) {
	var query string
	if targetLang == "ru" {
		query = `
			SELECT id, name
			FROM categories
			WHERE name_ru IS NULL
			ORDER BY id
			LIMIT $1
		`
	} else {
		query = `
			SELECT id, name
			FROM categories
			WHERE name_ro IS NULL
			ORDER BY id
			LIMIT $1
		`
	}

	rows, err := r.pool.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := make([]*models.Category, 0)
	for rows.Next() {
		c := &models.Category{}
		err := rows.Scan(&c.ID, &c.Name)
		if err != nil {
			return nil, err
		}
		categories = append(categories, c)
	}

	return categories, nil
}

// UpdateCategoryTranslation updates category translation fields
func (r *TranslationRepository) UpdateCategoryTranslation(ctx context.Context, id uuid.UUID, nameTranslated *string, targetLang string) error {
	var query string
	if targetLang == "ru" {
		query = `UPDATE categories SET name_ru = $2, updated_at = NOW() WHERE id = $1`
	} else {
		query = `UPDATE categories SET name_ro = $2, updated_at = NOW() WHERE id = $1`
	}
	_, err := r.pool.Exec(ctx, query, id, nameTranslated)
	return err
}

// ============================================================================
// PROPERTY TRANSLATION OPERATIONS (UNIQUE VALUES)
// ============================================================================

// GetUntranslatedPropertyGroups returns unique group names that need translation
// Uses the property_group_translations lookup table for fast queries
func (r *TranslationRepository) GetUntranslatedPropertyGroups(ctx context.Context, targetLang string, limit int) ([]string, error) {
	var query string
	if targetLang == "ru" {
		query = `
			SELECT group_name
			FROM property_group_translations
			WHERE name_ru IS NULL
			ORDER BY group_name
			LIMIT $1
		`
	} else {
		query = `
			SELECT group_name
			FROM property_group_translations
			WHERE name_ro IS NULL
			ORDER BY group_name
			LIMIT $1
		`
	}

	rows, err := r.pool.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	groups := make([]string, 0)
	for rows.Next() {
		var group string
		err := rows.Scan(&group)
		if err != nil {
			return nil, err
		}
		groups = append(groups, group)
	}

	return groups, nil
}

// GetUntranslatedPropertyNames returns unique property names that need translation
// Uses the property_name_translations lookup table for fast queries
func (r *TranslationRepository) GetUntranslatedPropertyNames(ctx context.Context, targetLang string, limit int) ([]string, error) {
	var query string
	if targetLang == "ru" {
		query = `
			SELECT property_name
			FROM property_name_translations
			WHERE name_ru IS NULL
			ORDER BY property_name
			LIMIT $1
		`
	} else {
		query = `
			SELECT property_name
			FROM property_name_translations
			WHERE name_ro IS NULL
			ORDER BY property_name
			LIMIT $1
		`
	}

	rows, err := r.pool.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	names := make([]string, 0)
	for rows.Next() {
		var name string
		err := rows.Scan(&name)
		if err != nil {
			return nil, err
		}
		names = append(names, name)
	}

	return names, nil
}

// UpdatePropertyGroupTranslation updates the translation in the lookup table (1 row)
func (r *TranslationRepository) UpdatePropertyGroupTranslation(ctx context.Context, groupName string, translated *string, targetLang string) error {
	var query string
	if targetLang == "ru" {
		query = `UPDATE property_group_translations SET name_ru = $2, updated_at = NOW() WHERE group_name = $1`
	} else {
		query = `UPDATE property_group_translations SET name_ro = $2, updated_at = NOW() WHERE group_name = $1`
	}
	_, err := r.pool.Exec(ctx, query, groupName, translated)
	return err
}

// UpdatePropertyNameTranslation updates the translation in the lookup table (1 row)
func (r *TranslationRepository) UpdatePropertyNameTranslation(ctx context.Context, propertyName string, translated *string, targetLang string) error {
	var query string
	if targetLang == "ru" {
		query = `UPDATE property_name_translations SET name_ru = $2, updated_at = NOW() WHERE property_name = $1`
	} else {
		query = `UPDATE property_name_translations SET name_ro = $2, updated_at = NOW() WHERE property_name = $1`
	}
	_, err := r.pool.Exec(ctx, query, propertyName, translated)
	return err
}

// ============================================================================
// COUNTS FOR JOB CREATION
// ============================================================================

// GetUntranslatedProductCount returns count of products needing translation
func (r *TranslationRepository) GetUntranslatedProductCount(ctx context.Context, targetLang string) (int, error) {
	var query string
	if targetLang == "ru" {
		query = `SELECT COUNT(*) FROM products WHERE name_ru IS NULL`
	} else {
		query = `SELECT COUNT(*) FROM products WHERE name_ro IS NULL`
	}
	var count int
	err := r.pool.QueryRow(ctx, query).Scan(&count)
	return count, err
}

// GetUntranslatedCategoryCount returns count of categories needing translation
func (r *TranslationRepository) GetUntranslatedCategoryCount(ctx context.Context, targetLang string) (int, error) {
	var query string
	if targetLang == "ru" {
		query = `SELECT COUNT(*) FROM categories WHERE name_ru IS NULL`
	} else {
		query = `SELECT COUNT(*) FROM categories WHERE name_ro IS NULL`
	}
	var count int
	err := r.pool.QueryRow(ctx, query).Scan(&count)
	return count, err
}

// GetUntranslatedPropertyCount returns count of unique property groups and names needing translation
// Uses the lookup tables for fast counts
func (r *TranslationRepository) GetUntranslatedPropertyCount(ctx context.Context, targetLang string) (int, error) {
	var query string
	if targetLang == "ru" {
		query = `
			SELECT
				(SELECT COUNT(*) FROM property_group_translations WHERE name_ru IS NULL) +
				(SELECT COUNT(*) FROM property_name_translations WHERE name_ru IS NULL)
		`
	} else {
		query = `
			SELECT
				(SELECT COUNT(*) FROM property_group_translations WHERE name_ro IS NULL) +
				(SELECT COUNT(*) FROM property_name_translations WHERE name_ro IS NULL)
		`
	}
	var count int
	err := r.pool.QueryRow(ctx, query).Scan(&count)
	return count, err
}

// ============================================================================
// PROPERTY TRANSLATION PROPAGATION
// ============================================================================

// PropagatePropertyTranslations copies translations from lookup tables to main properties table
// This should be called after a property translation job completes
func (r *TranslationRepository) PropagatePropertyTranslations(ctx context.Context, targetLang string) (int64, int64, error) {
	var nameQuery, groupQuery string

	if targetLang == "ru" {
		nameQuery = `
			UPDATE properties p
			SET property_name_ru = pnt.name_ru
			FROM property_name_translations pnt
			WHERE p.property_name = pnt.property_name
			  AND pnt.name_ru IS NOT NULL
			  AND (p.property_name_ru IS NULL OR p.property_name_ru != pnt.name_ru)
		`
		groupQuery = `
			UPDATE properties p
			SET group_name_ru = pgt.name_ru
			FROM property_group_translations pgt
			WHERE p.group_name = pgt.group_name
			  AND pgt.name_ru IS NOT NULL
			  AND (p.group_name_ru IS NULL OR p.group_name_ru != pgt.name_ru)
		`
	} else {
		nameQuery = `
			UPDATE properties p
			SET property_name_ro = pnt.name_ro
			FROM property_name_translations pnt
			WHERE p.property_name = pnt.property_name
			  AND pnt.name_ro IS NOT NULL
			  AND (p.property_name_ro IS NULL OR p.property_name_ro != pnt.name_ro)
		`
		groupQuery = `
			UPDATE properties p
			SET group_name_ro = pgt.name_ro
			FROM property_group_translations pgt
			WHERE p.group_name = pgt.group_name
			  AND pgt.name_ro IS NOT NULL
			  AND (p.group_name_ro IS NULL OR p.group_name_ro != pgt.name_ro)
		`
	}

	// Propagate property names
	nameResult, err := r.pool.Exec(ctx, nameQuery)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to propagate property names: %w", err)
	}
	namesUpdated := nameResult.RowsAffected()

	// Propagate group names
	groupResult, err := r.pool.Exec(ctx, groupQuery)
	if err != nil {
		return namesUpdated, 0, fmt.Errorf("failed to propagate group names: %w", err)
	}
	groupsUpdated := groupResult.RowsAffected()

	return namesUpdated, groupsUpdated, nil
}
