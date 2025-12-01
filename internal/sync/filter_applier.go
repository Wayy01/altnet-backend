package sync

import (
	"context"
	"fmt"
	"reflect"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
)

// ErrInvalidFieldName is returned when a field name is not in the allowlist
var ErrInvalidFieldName = fmt.Errorf("invalid field name")

// allowedFieldsByEntity defines the whitelist of allowed database column names per entity type.
// This prevents SQL injection by ensuring only known columns can be used in queries.
var allowedFieldsByEntity = map[models.FilterEntityType]map[string]bool{
	models.FilterEntityProducts: {
		"id": true, "ultra_id": true, "code": true, "article": true, "name": true, "slug": true,
		"brand_id": true, "category_id": true, "parent_id": true, "source_id": true,
		"price_min": true, "price_max": true, "price_mdl": true, "price_eur": true, "price_usd": true,
		"total_stock": true, "is_in_stock": true, "is_active": true, "is_service": true,
		"description": true, "main_image_url": true, "warranty": true, "is_group": true,
		"created_at": true, "updated_at": true,
	},
	models.FilterEntityBrands: {
		"id": true, "ultra_id": true, "code": true, "name": true, "slug": true,
		"logo_url": true, "is_active": true, "product_count": true,
		"created_at": true, "updated_at": true,
	},
	models.FilterEntityCategories: {
		"id": true, "ultra_id": true, "code": true, "name": true, "slug": true,
		"parent_id": true, "sort_order": true, "image_url": true, "is_active": true, "product_count": true,
		"created_at": true, "updated_at": true,
	},
}

// fieldNameRegex validates that field names only contain safe characters
var fieldNameRegex = regexp.MustCompile(`^[a-z][a-z0-9_]*$`)

// ValidateFieldName checks if a field name is allowed for the given entity type.
// Returns an error if the field is not in the allowlist or contains invalid characters.
func ValidateFieldName(entityType models.FilterEntityType, fieldName string) error {
	// First check the field name format (only lowercase letters, numbers, underscores)
	if !fieldNameRegex.MatchString(fieldName) {
		return fmt.Errorf("%w: field name contains invalid characters: %s", ErrInvalidFieldName, fieldName)
	}

	// Check if entity type has an allowlist
	allowedFields, ok := allowedFieldsByEntity[entityType]
	if !ok {
		return fmt.Errorf("%w: unknown entity type: %s", ErrInvalidFieldName, entityType)
	}

	// Check if field is in the allowlist
	if !allowedFields[fieldName] {
		return fmt.Errorf("%w: field '%s' is not allowed for entity type '%s'", ErrInvalidFieldName, fieldName, entityType)
	}

	return nil
}

// ValidateFilterConditions validates all conditions in a filter have allowed field names
func ValidateFilterConditions(entityType models.FilterEntityType, conditions []models.FilterCondition) error {
	for i, cond := range conditions {
		if err := ValidateFieldName(entityType, cond.Field); err != nil {
			return fmt.Errorf("condition %d: %w", i, err)
		}
	}
	return nil
}

// FilterApplier applies sync entity filters to data
type FilterApplier struct {
	filterRepo *repository.FilterRepository
}

// NewFilterApplier creates a new filter applier
func NewFilterApplier(filterRepo *repository.FilterRepository) *FilterApplier {
	return &FilterApplier{
		filterRepo: filterRepo,
	}
}

// ApplyFiltersResult holds the result of applying filters
type ApplyFiltersResult struct {
	OriginalCount   int              `json:"original_count"`
	FilteredCount   int              `json:"filtered_count"`
	ExcludedCount   int              `json:"excluded_count"`
	FiltersApplied  int              `json:"filters_applied"`
	ExecutionTimeMs int64            `json:"execution_time_ms"`
	FilterDetails   []FilterDetail   `json:"filter_details,omitempty"`
}

// FilterDetail provides details about a single filter application
type FilterDetail struct {
	FilterID       uuid.UUID `json:"filter_id"`
	FilterName     string    `json:"filter_name"`
	FilterType     string    `json:"filter_type"`
	MatchedCount   int       `json:"matched_count"`
}

// ApplyFilters applies all active filters for an entity type to a list of entities
// Returns entities that should be included after filtering
func (fa *FilterApplier) ApplyFilters(ctx context.Context, entityType models.FilterEntityType, entities interface{}) (interface{}, *ApplyFiltersResult, error) {
	startTime := time.Now()

	// Get active filters for this entity type
	filters, err := fa.filterRepo.GetActiveFiltersByEntityType(ctx, entityType)
	if err != nil {
		return nil, nil, fmt.Errorf("get active filters: %w", err)
	}

	// If no filters, return original entities
	if len(filters) == 0 {
		count := getSliceLength(entities)
		return entities, &ApplyFiltersResult{
			OriginalCount:   count,
			FilteredCount:   count,
			ExcludedCount:   0,
			FiltersApplied:  0,
			ExecutionTimeMs: time.Since(startTime).Milliseconds(),
		}, nil
	}

	originalCount := getSliceLength(entities)
	result := &ApplyFiltersResult{
		OriginalCount:  originalCount,
		FilterDetails:  make([]FilterDetail, 0),
	}

	// Apply each filter in order of priority
	currentEntities := entities
	for _, filter := range filters {
		filtered, matchedCount, err := fa.applySingleFilter(filter, currentEntities)
		if err != nil {
			return nil, nil, fmt.Errorf("apply filter %s: %w", filter.ID, err)
		}

		detail := FilterDetail{
			FilterID:     filter.ID,
			FilterName:   filter.Name,
			FilterType:   string(filter.FilterType),
			MatchedCount: matchedCount,
		}
		result.FilterDetails = append(result.FilterDetails, detail)

		currentEntities = filtered
	}

	result.FilteredCount = getSliceLength(currentEntities)
	result.ExcludedCount = result.OriginalCount - result.FilteredCount
	result.FiltersApplied = len(filters)
	result.ExecutionTimeMs = time.Since(startTime).Milliseconds()

	return currentEntities, result, nil
}

// applySingleFilter applies a single filter to entities
func (fa *FilterApplier) applySingleFilter(filter *models.SyncEntityFilterEnhanced, entities interface{}) (interface{}, int, error) {
	sliceVal := reflect.ValueOf(entities)
	if sliceVal.Kind() != reflect.Slice {
		return nil, 0, fmt.Errorf("entities must be a slice")
	}

	resultSlice := reflect.MakeSlice(sliceVal.Type(), 0, sliceVal.Len())
	matchedCount := 0

	for i := 0; i < sliceVal.Len(); i++ {
		entity := sliceVal.Index(i)
		matches := fa.entityMatchesFilter(entity, filter)

		if matches {
			matchedCount++
		}

		// For include filters: keep if matches
		// For exclude filters: keep if NOT matches
		shouldInclude := false
		if filter.FilterType == models.FilterTypeInclude {
			shouldInclude = matches
		} else {
			shouldInclude = !matches
		}

		if shouldInclude {
			resultSlice = reflect.Append(resultSlice, entity)
		}
	}

	return resultSlice.Interface(), matchedCount, nil
}

// entityMatchesFilter checks if an entity matches the filter conditions
func (fa *FilterApplier) entityMatchesFilter(entityVal reflect.Value, filter *models.SyncEntityFilterEnhanced) bool {
	if entityVal.Kind() == reflect.Ptr {
		entityVal = entityVal.Elem()
	}

	if len(filter.Conditions) == 0 {
		return true
	}

	results := make([]bool, len(filter.Conditions))
	for i, cond := range filter.Conditions {
		results[i] = fa.checkCondition(entityVal, cond)
	}

	// Apply logic (AND/OR)
	if filter.Logic == models.LogicAND {
		for _, r := range results {
			if !r {
				return false
			}
		}
		return true
	}

	// OR logic
	for _, r := range results {
		if r {
			return true
		}
	}
	return false
}

// checkCondition checks if an entity satisfies a single condition
func (fa *FilterApplier) checkCondition(entityVal reflect.Value, cond models.FilterCondition) bool {
	// Get field value using reflection
	fieldVal := fa.getFieldValue(entityVal, cond.Field)
	if !fieldVal.IsValid() {
		// Field not found - only match for is_null operator
		return cond.Operator == models.OpIsNull
	}

	// Handle nil/zero values
	isNil := fa.isNilOrZero(fieldVal)

	switch cond.Operator {
	case models.OpIsNull:
		return isNil

	case models.OpIsNotNull:
		return !isNil

	case models.OpEquals:
		return fa.compareEquals(fieldVal, cond.Value)

	case models.OpNotEquals:
		return !fa.compareEquals(fieldVal, cond.Value)

	case models.OpContains:
		return fa.compareContains(fieldVal, cond.Value)

	case models.OpNotContains:
		return !fa.compareContains(fieldVal, cond.Value)

	case models.OpGreaterThan:
		return fa.compareGreater(fieldVal, cond.Value)

	case models.OpLessThan:
		return fa.compareLess(fieldVal, cond.Value)

	case models.OpIn:
		return fa.compareIn(fieldVal, cond.Value)

	case models.OpNotIn:
		return !fa.compareIn(fieldVal, cond.Value)

	default:
		return false
	}
}

// getFieldValue gets a field value from a struct by name (case-insensitive, supports snake_case)
func (fa *FilterApplier) getFieldValue(entityVal reflect.Value, fieldName string) reflect.Value {
	if entityVal.Kind() != reflect.Struct {
		return reflect.Value{}
	}

	// Try exact match first
	field := entityVal.FieldByName(fieldName)
	if field.IsValid() {
		return field
	}

	// Try case-insensitive match and snake_case conversion
	fieldNameLower := strings.ToLower(fieldName)
	fieldNameCamel := snakeToCamel(fieldName)

	entityType := entityVal.Type()
	for i := 0; i < entityType.NumField(); i++ {
		structField := entityType.Field(i)

		// Check JSON tag
		jsonTag := structField.Tag.Get("json")
		if jsonTag != "" {
			tagName := strings.Split(jsonTag, ",")[0]
			if strings.ToLower(tagName) == fieldNameLower {
				return entityVal.Field(i)
			}
		}

		// Check field name (case-insensitive)
		if strings.ToLower(structField.Name) == fieldNameLower {
			return entityVal.Field(i)
		}

		// Check camelCase conversion
		if structField.Name == fieldNameCamel {
			return entityVal.Field(i)
		}
	}

	return reflect.Value{}
}

// isNilOrZero checks if a value is nil or zero
func (fa *FilterApplier) isNilOrZero(val reflect.Value) bool {
	if !val.IsValid() {
		return true
	}

	switch val.Kind() {
	case reflect.Ptr, reflect.Interface, reflect.Slice, reflect.Map, reflect.Chan:
		return val.IsNil()
	default:
		return val.IsZero()
	}
}

// compareEquals compares a field value for equality
func (fa *FilterApplier) compareEquals(fieldVal reflect.Value, value interface{}) bool {
	if fa.isNilOrZero(fieldVal) {
		return value == nil
	}

	// Dereference pointers
	if fieldVal.Kind() == reflect.Ptr {
		fieldVal = fieldVal.Elem()
	}

	fieldInterface := fieldVal.Interface()

	// Handle UUID comparison
	if fieldUUID, ok := fieldInterface.(uuid.UUID); ok {
		switch v := value.(type) {
		case string:
			compareUUID, err := uuid.Parse(v)
			if err != nil {
				return false
			}
			return fieldUUID == compareUUID
		case uuid.UUID:
			return fieldUUID == v
		}
	}

	// Handle string comparison
	if fieldVal.Kind() == reflect.String {
		return fieldVal.String() == fmt.Sprintf("%v", value)
	}

	// Handle numeric comparison
	if fa.isNumeric(fieldVal) {
		return fa.compareNumericEquals(fieldVal, value)
	}

	// Handle bool comparison
	if fieldVal.Kind() == reflect.Bool {
		if vBool, ok := value.(bool); ok {
			return fieldVal.Bool() == vBool
		}
		// Handle string "true"/"false"
		if vStr, ok := value.(string); ok {
			return (fieldVal.Bool() && vStr == "true") || (!fieldVal.Bool() && vStr == "false")
		}
	}

	// Default: use reflection DeepEqual
	return reflect.DeepEqual(fieldInterface, value)
}

// compareContains checks if a string field contains a substring
func (fa *FilterApplier) compareContains(fieldVal reflect.Value, value interface{}) bool {
	if fa.isNilOrZero(fieldVal) {
		return false
	}

	if fieldVal.Kind() == reflect.Ptr {
		fieldVal = fieldVal.Elem()
	}

	if fieldVal.Kind() != reflect.String {
		return false
	}

	searchStr := fmt.Sprintf("%v", value)
	return strings.Contains(strings.ToLower(fieldVal.String()), strings.ToLower(searchStr))
}

// compareGreater checks if a numeric field is greater than a value
func (fa *FilterApplier) compareGreater(fieldVal reflect.Value, value interface{}) bool {
	if fa.isNilOrZero(fieldVal) {
		return false
	}

	if fieldVal.Kind() == reflect.Ptr {
		fieldVal = fieldVal.Elem()
	}

	fieldFloat := fa.toFloat64(fieldVal)
	valueFloat := fa.interfaceToFloat64(value)

	return fieldFloat > valueFloat
}

// compareLess checks if a numeric field is less than a value
func (fa *FilterApplier) compareLess(fieldVal reflect.Value, value interface{}) bool {
	if fa.isNilOrZero(fieldVal) {
		return false
	}

	if fieldVal.Kind() == reflect.Ptr {
		fieldVal = fieldVal.Elem()
	}

	fieldFloat := fa.toFloat64(fieldVal)
	valueFloat := fa.interfaceToFloat64(value)

	return fieldFloat < valueFloat
}

// compareIn checks if a field value is in a list
func (fa *FilterApplier) compareIn(fieldVal reflect.Value, value interface{}) bool {
	if fa.isNilOrZero(fieldVal) {
		return false
	}

	if fieldVal.Kind() == reflect.Ptr {
		fieldVal = fieldVal.Elem()
	}

	// Value should be a slice/array
	valueVal := reflect.ValueOf(value)
	if valueVal.Kind() != reflect.Slice && valueVal.Kind() != reflect.Array {
		// Try single value comparison
		return fa.compareEquals(fieldVal, value)
	}

	for i := 0; i < valueVal.Len(); i++ {
		if fa.compareEquals(fieldVal, valueVal.Index(i).Interface()) {
			return true
		}
	}

	return false
}

// isNumeric checks if a value is numeric
func (fa *FilterApplier) isNumeric(val reflect.Value) bool {
	switch val.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64,
		reflect.Float32, reflect.Float64:
		return true
	default:
		return false
	}
}

// compareNumericEquals compares numeric values for equality
func (fa *FilterApplier) compareNumericEquals(fieldVal reflect.Value, value interface{}) bool {
	fieldFloat := fa.toFloat64(fieldVal)
	valueFloat := fa.interfaceToFloat64(value)
	return fieldFloat == valueFloat
}

// toFloat64 converts a reflect.Value to float64
func (fa *FilterApplier) toFloat64(val reflect.Value) float64 {
	switch val.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return float64(val.Int())
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return float64(val.Uint())
	case reflect.Float32, reflect.Float64:
		return val.Float()
	default:
		return 0
	}
}

// interfaceToFloat64 converts an interface{} to float64
func (fa *FilterApplier) interfaceToFloat64(v interface{}) float64 {
	switch val := v.(type) {
	case int:
		return float64(val)
	case int8:
		return float64(val)
	case int16:
		return float64(val)
	case int32:
		return float64(val)
	case int64:
		return float64(val)
	case uint:
		return float64(val)
	case uint8:
		return float64(val)
	case uint16:
		return float64(val)
	case uint32:
		return float64(val)
	case uint64:
		return float64(val)
	case float32:
		return float64(val)
	case float64:
		return val
	case string:
		// Try to parse as float
		var f float64
		fmt.Sscanf(val, "%f", &f)
		return f
	default:
		return 0
	}
}

// BuildFilterQuery builds a SQL WHERE clause from a filter
// Returns the WHERE clause (without the WHERE keyword) and the arguments.
// Returns an error if any field name is not in the allowed list for the entity type.
func BuildFilterQuery(filter *models.SyncEntityFilterEnhanced) (string, []interface{}, error) {
	if len(filter.Conditions) == 0 {
		return "", nil, nil
	}

	// Validate all field names before building query
	if err := ValidateFilterConditions(filter.EntityType, filter.Conditions); err != nil {
		return "", nil, fmt.Errorf("field validation failed: %w", err)
	}

	clauses := make([]string, 0, len(filter.Conditions))
	args := make([]interface{}, 0, len(filter.Conditions))
	argNum := 1

	for _, cond := range filter.Conditions {
		clause, arg := buildSingleConditionSQL(cond, &argNum)
		if clause != "" {
			clauses = append(clauses, clause)
			if arg != nil {
				args = append(args, arg)
			}
		}
	}

	if len(clauses) == 0 {
		return "", nil, nil
	}

	logicStr := " AND "
	if filter.Logic == models.LogicOR {
		logicStr = " OR "
	}

	whereClause := "(" + strings.Join(clauses, logicStr) + ")"

	// For exclude filters, negate the entire condition
	if filter.FilterType == models.FilterTypeExclude {
		whereClause = "NOT " + whereClause
	}

	return whereClause, args, nil
}

// buildSingleConditionSQL builds SQL for a single condition
func buildSingleConditionSQL(cond models.FilterCondition, argNum *int) (string, interface{}) {
	field := cond.Field

	switch cond.Operator {
	case models.OpEquals:
		clause := fmt.Sprintf("%s = $%d", field, *argNum)
		*argNum++
		return clause, cond.Value

	case models.OpNotEquals:
		clause := fmt.Sprintf("%s != $%d", field, *argNum)
		*argNum++
		return clause, cond.Value

	case models.OpContains:
		clause := fmt.Sprintf("%s ILIKE $%d", field, *argNum)
		*argNum++
		return clause, fmt.Sprintf("%%%v%%", cond.Value)

	case models.OpNotContains:
		clause := fmt.Sprintf("%s NOT ILIKE $%d", field, *argNum)
		*argNum++
		return clause, fmt.Sprintf("%%%v%%", cond.Value)

	case models.OpGreaterThan:
		clause := fmt.Sprintf("%s > $%d", field, *argNum)
		*argNum++
		return clause, cond.Value

	case models.OpLessThan:
		clause := fmt.Sprintf("%s < $%d", field, *argNum)
		*argNum++
		return clause, cond.Value

	case models.OpIn:
		clause := fmt.Sprintf("%s = ANY($%d)", field, *argNum)
		*argNum++
		return clause, cond.Value

	case models.OpNotIn:
		clause := fmt.Sprintf("NOT (%s = ANY($%d))", field, *argNum)
		*argNum++
		return clause, cond.Value

	case models.OpIsNull:
		return fmt.Sprintf("%s IS NULL", field), nil

	case models.OpIsNotNull:
		return fmt.Sprintf("%s IS NOT NULL", field), nil

	default:
		return "", nil
	}
}

// BuildCombinedFilterQuery builds a combined SQL WHERE clause from multiple filters.
// Returns an error if any field name is not in the allowed list for its entity type.
func BuildCombinedFilterQuery(filters []*models.SyncEntityFilterEnhanced) (string, []interface{}, error) {
	if len(filters) == 0 {
		return "", nil, nil
	}

	allClauses := make([]string, 0)
	allArgs := make([]interface{}, 0)
	argOffset := 1

	for _, filter := range filters {
		clause, args, err := buildFilterQueryWithOffset(filter, &argOffset)
		if err != nil {
			return "", nil, err
		}
		if clause != "" {
			allClauses = append(allClauses, clause)
			allArgs = append(allArgs, args...)
		}
	}

	if len(allClauses) == 0 {
		return "", nil, nil
	}

	// Combine all filters with AND (all filter conditions must be satisfied)
	return strings.Join(allClauses, " AND "), allArgs, nil
}

// buildFilterQueryWithOffset builds a filter query with a specific argument offset.
// Returns an error if any field name is not in the allowed list for the entity type.
func buildFilterQueryWithOffset(filter *models.SyncEntityFilterEnhanced, argOffset *int) (string, []interface{}, error) {
	if len(filter.Conditions) == 0 {
		return "", nil, nil
	}

	// Validate all field names before building query
	if err := ValidateFilterConditions(filter.EntityType, filter.Conditions); err != nil {
		return "", nil, fmt.Errorf("field validation failed: %w", err)
	}

	clauses := make([]string, 0, len(filter.Conditions))
	args := make([]interface{}, 0, len(filter.Conditions))

	for _, cond := range filter.Conditions {
		clause, arg := buildSingleConditionSQL(cond, argOffset)
		if clause != "" {
			clauses = append(clauses, clause)
			if arg != nil {
				args = append(args, arg)
			}
		}
	}

	if len(clauses) == 0 {
		return "", nil, nil
	}

	logicStr := " AND "
	if filter.Logic == models.LogicOR {
		logicStr = " OR "
	}

	whereClause := "(" + strings.Join(clauses, logicStr) + ")"

	// For exclude filters, negate the entire condition
	if filter.FilterType == models.FilterTypeExclude {
		whereClause = "NOT " + whereClause
	}

	return whereClause, args, nil
}

// Helper functions

// getSliceLength returns the length of a slice using reflection
func getSliceLength(slice interface{}) int {
	val := reflect.ValueOf(slice)
	if val.Kind() != reflect.Slice {
		return 0
	}
	return val.Len()
}

// snakeToCamel converts snake_case to CamelCase
func snakeToCamel(s string) string {
	parts := strings.Split(s, "_")
	for i := range parts {
		if len(parts[i]) > 0 {
			parts[i] = strings.ToUpper(parts[i][:1]) + parts[i][1:]
		}
	}
	return strings.Join(parts, "")
}
