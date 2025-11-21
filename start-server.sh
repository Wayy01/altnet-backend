#!/bin/bash

# Ultra API Server Startup Script
# Ensures only ONE instance runs

echo "Stopping any existing servers..."
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 1

echo "Starting Ultra API server on port 8080..."
cd "$(dirname "$0")"
go run cmd/unified-api/main.go
