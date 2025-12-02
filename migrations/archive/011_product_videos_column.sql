-- Migration 011: Add videos column for product video storage
-- This migration adds support for storing video URLs/metadata for products

-- Add videos column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS videos JSONB DEFAULT '[]';

-- Create GIN index for efficient JSONB queries on videos
CREATE INDEX IF NOT EXISTS idx_products_videos ON products USING GIN (videos);

-- Add comment documenting the expected structure
COMMENT ON COLUMN products.videos IS 'JSONB array of video objects: [{uuid, url, title, description, thumbnail_url}]';
