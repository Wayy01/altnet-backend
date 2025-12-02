# Database Migrations

## Structure

```
migrations/
├── 000_initial_schema.sql      # Complete schema for fresh installs
├── 015_cleanup_removed_features.sql  # Cleanup for existing databases
├── README.md
└── archive/                    # Historical migrations (reference only)
```

## For Fresh Installations

Run `000_initial_schema.sql` to set up the complete database schema.

```bash
psql -U postgres -d ultra-data -f migrations/000_initial_schema.sql
```

## For Existing Databases

If you have an existing database from before December 2025, run the cleanup migration to remove deprecated tables:

```bash
psql -U postgres -d ultra-data -f migrations/015_cleanup_removed_features.sql
```

This removes:
- Rollback system tables (`sync_snapshots`, `sync_snapshot_data`, `sync_rollbacks`)
- Conflict resolution tables (`sync_conflicts`, `sync_conflict_rules`)
- Notification tables (`sync_notifications`)
- Related columns from `sync_logs`

## Archive

The `archive/` folder contains the original incremental migrations for reference. These should not be run on new installations - use `000_initial_schema.sql` instead.

**Archived migrations include cleanup migration `015_cleanup_removed_features.sql` which removes:**
- Rollback tables (`sync_snapshots`, `sync_snapshot_data`, `sync_rollbacks`)
- Conflict tables (`sync_conflicts`, `sync_conflict_rules`)
- Notification table (`sync_notifications`)
- Legacy tables (`data_sources`, `entity_matches`, `sync_runs`)

## Schema Overview

### Core Tables
- `brands` - Product brands
- `categories` - Product categories (hierarchical)
- `products` - Product catalog
- `properties` - Product specifications
- `characteristics` - Product variants/SKUs
- `product_sources` - Product origin tracking
- `exchange_rates` - Currency rates

### Sync System
- `sync_logs` - Sync operation logs
- `sync_step_details` - Per-step metrics
- `sync_configurations` - Saved sync configs
- `sync_changes` - Field-level change tracking
- `sync_schedules` - Scheduled sync jobs
- `sync_schedule_runs` - Schedule execution history
- `sync_entity_filters` - Entity filtering rules
- `entity_sync_tracking` - Incremental sync tracking
- `sync_performance_metrics` - Performance data
- `sync_log_entries` - Real-time log entries
- `sync_progress_snapshots` - Progress tracking
- `sync_api_requests` - API request logging

### Translation System
- `translation_jobs` - Translation job tracking
- `translation_logs` - Translation operation logs

---
Last updated: December 2, 2025
