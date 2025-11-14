.PHONY: help setup db-create db-migrate db-drop run build test clean

help: ## Show this help message
	@echo "Ultra B2B API Testing Tool - Available Commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

setup: ## Initial setup - install dependencies
	@echo "📦 Installing Go dependencies..."
	go mod download
	go mod tidy
	@echo "✅ Setup complete!"

db-create: ## Create database
	@echo "🗄️  Creating database 'api-testing'..."
	createdb api-testing || echo "Database may already exist"
	@echo "✅ Database created!"

db-migrate: ## Run database migrations
	@echo "🔧 Running migrations..."
	psql api-testing < migrations/001_multi_source_architecture.sql
	@echo "✅ Migrations complete!"

db-drop: ## Drop database (WARNING: deletes all data!)
	@echo "⚠️  Dropping database 'api-testing'..."
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		dropdb api-testing; \
		echo "✅ Database dropped!"; \
	fi

db-reset: db-drop db-create db-migrate ## Reset database (drop, create, migrate)
	@echo "✅ Database reset complete!"

run: ## Run the sync application
	@echo "🚀 Starting Ultra B2B sync..."
	go run cmd/sync/main.go

build: ## Build the binary
	@echo "🔨 Building binary..."
	go build -o bin/ultra-sync cmd/sync/main.go
	@echo "✅ Binary built: bin/ultra-sync"

test: ## Run tests
	@echo "🧪 Running tests..."
	go test -v ./...

clean: ## Clean build artifacts
	@echo "🧹 Cleaning..."
	rm -rf bin/
	go clean
	@echo "✅ Clean complete!"

verify-env: ## Verify .env file exists and has required variables
	@echo "🔍 Verifying environment configuration..."
	@test -f .env || (echo "❌ .env file not found! Copy .env.example to .env" && exit 1)
	@grep -q "ULTRA_API_USERNAME=" .env || (echo "❌ ULTRA_API_USERNAME not set in .env" && exit 1)
	@grep -q "ULTRA_API_PASSWORD=" .env || (echo "❌ ULTRA_API_PASSWORD not set in .env" && exit 1)
	@grep -q "DB_PASSWORD=" .env || (echo "❌ DB_PASSWORD not set in .env" && exit 1)
	@echo "✅ Environment configuration verified!"

status: ## Check sync status from database
	@echo "📊 Recent sync runs:"
	@psql api-testing -c "SELECT started_at, status, duration_seconds, products_with_data, products_with_prices, products_with_stock FROM sync_runs ORDER BY started_at DESC LIMIT 5;"

stats: ## Show database statistics
	@echo "📈 Database Statistics:"
	@psql api-testing -c "SELECT 'Brands' as entity, COUNT(*) FROM brand_sources UNION ALL SELECT 'Categories', COUNT(*) FROM category_sources UNION ALL SELECT 'Products', COUNT(*) FROM product_sources;"

# Convenience targets
install: setup db-create db-migrate verify-env ## Complete installation (setup + db + verify)
	@echo ""
	@echo "✅ Installation complete!"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Edit .env with your Ultra API credentials"
	@echo "  2. Run 'make run' to start syncing"

quick-start: verify-env run ## Quick start (verify + run)

dev: clean build run ## Development cycle (clean, build, run)
