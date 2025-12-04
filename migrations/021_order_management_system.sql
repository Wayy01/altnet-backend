-- Migration: 021_order_management_system.sql
-- Description: Creates tables for order management system (stores, orders, order_items)
-- Date: 2025-12-04

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');
CREATE TYPE payment_method AS ENUM ('card', 'bank_transfer', 'cash');
CREATE TYPE delivery_type AS ENUM ('pickup', 'delivery');

-- ============================================================================
-- STORES TABLE (Pickup Locations)
-- ============================================================================
-- Stores represent physical pickup locations for orders

CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    google_maps_url VARCHAR(500),
    images JSONB DEFAULT '[]'::jsonb,
    videos JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying active stores
CREATE INDEX idx_stores_is_active ON stores(is_active) WHERE is_active = true;

-- Index for name search
CREATE INDEX idx_stores_name ON stores(name);

-- ============================================================================
-- ORDER NUMBER SEQUENCE
-- ============================================================================
-- Sequence for generating unique order numbers within a day

CREATE SEQUENCE order_daily_seq START 1;

-- Function to generate order number in format: ORD-YYYYMMDD-XXXX
-- Counts orders created today to ensure daily reset without manual intervention
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR AS $$
DECLARE
    today_str VARCHAR;
    seq_val INT;
    order_num VARCHAR;
BEGIN
    today_str := TO_CHAR(NOW(), 'YYYYMMDD');

    -- Count orders created today and add 1
    SELECT COALESCE(MAX(
        CAST(SPLIT_PART(order_number, '-', 3) AS INT)
    ), 0) + 1
    INTO seq_val
    FROM orders
    WHERE order_number LIKE 'ORD-' || today_str || '-%';

    order_num := 'ORD-' || today_str || '-' || LPAD(seq_val::TEXT, 4, '0');
    RETURN order_num;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================
-- Main orders table storing customer orders

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(20) NOT NULL UNIQUE DEFAULT generate_order_number(),

    -- Customer information
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    email VARCHAR(255),

    -- Delivery information
    delivery_type delivery_type NOT NULL,
    delivery_address TEXT,
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,

    -- Payment information
    payment_method payment_method NOT NULL,

    -- Order totals
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'MDL',

    -- Status
    status order_status NOT NULL DEFAULT 'pending',

    -- Notes
    notes TEXT,

    -- Future Google Auth user fields (optional)
    user_id VARCHAR(255),
    user_name VARCHAR(255),
    user_pfp VARCHAR(500),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraint: If delivery type is 'delivery', delivery_address must be provided
    -- If delivery type is 'pickup', store_id must be provided
    CONSTRAINT chk_orders_delivery_info CHECK (
        (delivery_type = 'delivery' AND delivery_address IS NOT NULL) OR
        (delivery_type = 'pickup' AND store_id IS NOT NULL)
    )
);

-- Index for order number lookups (for public tracking)
CREATE INDEX idx_orders_order_number ON orders(order_number);

-- Index for status filtering
CREATE INDEX idx_orders_status ON orders(status);

-- Index for customer phone lookup
CREATE INDEX idx_orders_phone_number ON orders(phone_number);

-- Index for date range queries
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Index for store lookups
CREATE INDEX idx_orders_store_id ON orders(store_id) WHERE store_id IS NOT NULL;

-- Index for user lookups (future Google Auth)
CREATE INDEX idx_orders_user_id ON orders(user_id) WHERE user_id IS NOT NULL;

-- ============================================================================
-- ORDER ITEMS TABLE
-- ============================================================================
-- Individual items within an order (product snapshots)

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,

    -- Product snapshot (preserved at time of order)
    product_name VARCHAR(500) NOT NULL,
    product_sku VARCHAR(100),
    product_image VARCHAR(500),

    -- Quantity and pricing
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
    total_price DECIMAL(12,2) NOT NULL CHECK (total_price >= 0),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure total_price = quantity * unit_price
    CONSTRAINT chk_order_items_total CHECK (
        total_price = quantity * unit_price
    )
);

-- Index for order lookups
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- Index for product lookups (analytics)
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- ============================================================================
-- UPDATE TRIGGERS FOR updated_at
-- ============================================================================

-- Stores updated_at trigger
CREATE OR REPLACE FUNCTION update_stores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_stores_updated_at ON stores;
CREATE TRIGGER trigger_update_stores_updated_at
    BEFORE UPDATE ON stores
    FOR EACH ROW EXECUTE FUNCTION update_stores_updated_at();

-- Orders updated_at trigger
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_orders_updated_at ON orders;
CREATE TRIGGER trigger_update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_orders_updated_at();

-- ============================================================================
-- TRIGGER TO UPDATE ORDER TOTAL
-- ============================================================================
-- Automatically update order total when items change

CREATE OR REPLACE FUNCTION update_order_total()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE orders
        SET total_amount = COALESCE((
            SELECT SUM(total_price)
            FROM order_items
            WHERE order_id = OLD.order_id
        ), 0)
        WHERE id = OLD.order_id;
        RETURN OLD;
    ELSE
        UPDATE orders
        SET total_amount = COALESCE((
            SELECT SUM(total_price)
            FROM order_items
            WHERE order_id = NEW.order_id
        ), 0)
        WHERE id = NEW.order_id;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_order_total ON order_items;
CREATE TRIGGER trigger_update_order_total
    AFTER INSERT OR UPDATE OR DELETE ON order_items
    FOR EACH ROW EXECUTE FUNCTION update_order_total();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE stores IS 'Physical pickup locations for orders';
COMMENT ON TABLE orders IS 'Customer orders with delivery/pickup and payment information';
COMMENT ON TABLE order_items IS 'Individual products within an order with snapshot data';

COMMENT ON COLUMN stores.images IS 'JSONB array of image URLs for the store';
COMMENT ON COLUMN stores.videos IS 'JSONB array of video URLs for the store';

COMMENT ON COLUMN orders.order_number IS 'Human-readable order number (ORD-YYYYMMDD-XXXX)';
COMMENT ON COLUMN orders.delivery_type IS 'pickup or delivery';
COMMENT ON COLUMN orders.payment_method IS 'card, bank_transfer, or cash';
COMMENT ON COLUMN orders.status IS 'Order lifecycle status';
COMMENT ON COLUMN orders.user_id IS 'Future Google Auth user ID';
COMMENT ON COLUMN orders.user_name IS 'Future Google Auth username';
COMMENT ON COLUMN orders.user_pfp IS 'Future Google Auth profile picture URL';

COMMENT ON COLUMN order_items.product_name IS 'Snapshot of product name at time of order';
COMMENT ON COLUMN order_items.product_sku IS 'Snapshot of product SKU/article at time of order';
COMMENT ON COLUMN order_items.product_image IS 'Snapshot of product main image at time of order';
COMMENT ON COLUMN order_items.unit_price IS 'Price per unit at time of order';
