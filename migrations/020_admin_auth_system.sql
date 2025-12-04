-- Migration: 020_admin_auth_system.sql
-- Description: Creates admin authentication system for Ultra B2B admin dashboard
-- Date: 2025-12-04

-- ============================================================================
-- ADMIN USERS TABLE
-- ============================================================================
-- Stores admin user credentials for dashboard authentication

CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster username lookups during authentication
CREATE INDEX idx_admin_users_username ON admin_users(username);

-- Comment on table and columns for documentation
COMMENT ON TABLE admin_users IS 'Admin users for dashboard authentication';
COMMENT ON COLUMN admin_users.username IS 'Unique username for login';
COMMENT ON COLUMN admin_users.password_hash IS 'Bcrypt password hash (cost factor 12)';

-- ============================================================================
-- INITIAL ADMIN USER
-- ============================================================================
-- Insert initial admin user: Wayy01 / Wayy1002001!
-- Password hash generated with bcrypt cost factor 12

INSERT INTO admin_users (username, password_hash)
VALUES (
    'Wayy01',
    '$2a$12$ItZxnbpd2YSa57CyR82a..hGlHq.hdxnKZ9LJhVAQySiIX6RPOUMm'
);

-- Note: The password hash above is for 'Wayy1002001!' with bcrypt cost 12
-- Generated using: bcrypt.GenerateFromPassword([]byte("Wayy1002001!"), 12)
