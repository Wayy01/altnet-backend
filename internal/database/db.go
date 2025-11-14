package database

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"ultra-api-testing/internal/config"
)

type DB struct {
	Pool *pgxpool.Pool
}

func New(ctx context.Context, cfg *config.Config) (*DB, error) {
	poolConfig, err := pgxpool.ParseConfig(cfg.GetDSN())
	if err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	// Connection pool settings
	poolConfig.MaxConns = 25
	poolConfig.MinConns = 5
	poolConfig.MaxConnLifetime = 1 * time.Hour
	poolConfig.MaxConnIdleTime = 30 * time.Minute
	poolConfig.HealthCheckPeriod = 1 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	// Test connection
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return &DB{Pool: pool}, nil
}

func (db *DB) Close() {
	if db.Pool != nil {
		db.Pool.Close()
	}
}

// Health checks if database connection is healthy
func (db *DB) Health(ctx context.Context) error {
	return db.Pool.Ping(ctx)
}
