-- Migration: 022_order_comments.sql
-- Description: Adds order comments table for admin notes

CREATE TABLE order_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    admin_id VARCHAR(255) NOT NULL,
    admin_name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for order lookups
CREATE INDEX idx_order_comments_order_id ON order_comments(order_id);

-- Index for date ordering
CREATE INDEX idx_order_comments_created_at ON order_comments(created_at DESC);

COMMENT ON TABLE order_comments IS 'Admin comments on orders';
COMMENT ON COLUMN order_comments.admin_id IS 'ID of the admin who created the comment';
COMMENT ON COLUMN order_comments.admin_name IS 'Display name of the admin';
