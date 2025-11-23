package constants

import "time"

// ============================================================================
// ADVANCED SYNC CONSTANTS
// ============================================================================

// Rollback Configuration
const (
	// MaxBatchSize is the maximum number of entities to process in a single batch
	MaxBatchSize = 1000

	// DefaultSnapshotLimit is the default number of products to capture in snapshot
	DefaultSnapshotLimit = 10000

	// SnapshotDefaultExpiration is the default expiration time for snapshots
	SnapshotDefaultExpiration = 7 * 24 * time.Hour

	// EstimatedTimePerEntity is the estimated processing time per entity in milliseconds
	EstimatedTimePerEntity = 10 * time.Millisecond

	// HashLength is the minimum length for security confirmation hashes
	HashLength = 16

	// MaxDetailLimit is the maximum number of diff details to return
	MaxDetailLimit = 1000

	// DefaultDetailLimit is the default number of diff details to return
	DefaultDetailLimit = 100

	// ComparisonSampleSize is the default sample size for product comparison
	ComparisonSampleSize = 1000

	// SnapshotExpiryWarningThreshold is when to warn about expiring snapshots
	SnapshotExpiryWarningThreshold = 24 * time.Hour

	// SnapshotAgeWarningThreshold is when to warn about old snapshots
	SnapshotAgeWarningThreshold = 7 * 24 * time.Hour

	// LargeRollbackThreshold is the entity count threshold for large rollback warning
	LargeRollbackThreshold = 10000

	// SimilarConflictLimit is the limit for resolving similar conflicts at once
	SimilarConflictLimit = 100

	// MaxPaginationLimit is the maximum allowed pagination limit
	MaxPaginationLimit = 1000

	// DefaultPaginationLimit is the default pagination limit
	DefaultPaginationLimit = 50

	// ConflictRuleCacheTTL is the TTL for conflict rule cache
	ConflictRuleCacheTTL = 5 * time.Minute

	// HashTimeWindow is the time window in hours for hash validation
	HashTimeWindow = 1 * time.Hour
)

// Valid entity types for snapshots and rollback
var ValidEntityTypes = map[string]bool{
	"brand":          true,
	"category":       true,
	"product":        true,
	"property":       true,
	"characteristic": true,
}

// Valid rollback types
var ValidRollbackTypes = map[string]bool{
	"full":      true,
	"partial":   true,
	"selective": true,
}

// Valid resolution strategies
var ValidResolutionStrategies = map[string]bool{
	"local_wins":  true,
	"remote_wins": true,
	"merge":       true,
	"manual":      true,
	"skip":        true,
}

// Valid conflict types
var ValidConflictTypes = map[string]bool{
	"concurrent_modification": true,
	"deleted_upstream":        true,
	"validation_error":        true,
}

// Environment variable names
const (
	EnvRollbackSecretKey = "ROLLBACK_SECRET_KEY"
)

// Error messages
const (
	ErrInvalidEntityType       = "invalid entity type: must be one of brand, category, product, property, characteristic"
	ErrInvalidRollbackType     = "invalid rollback type: must be one of full, partial, selective"
	ErrInvalidResolutionStrategy = "invalid resolution strategy: must be one of local_wins, remote_wins, merge, manual, skip"
	ErrInvalidConflictType     = "invalid conflict type: must be one of concurrent_modification, deleted_upstream, validation_error"
	ErrMissingSecretKey        = "ROLLBACK_SECRET_KEY environment variable not set"
)
