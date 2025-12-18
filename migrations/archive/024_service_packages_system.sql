-- Migration: 024_service_packages_system.sql
-- Description: Creates tables for service packages and service orders system
-- Date: 2025-12-04

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE service_order_status AS ENUM ('pending', 'contacted', 'approved', 'rejected', 'completed');

-- ============================================================================
-- SERVICE PACKAGE TYPES TABLE
-- ============================================================================
-- Categories/types for service packages (e.g., Internet, TV, Phone)

CREATE TABLE service_package_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    name_ru VARCHAR(255),
    name_ro VARCHAR(255),
    slug VARCHAR(255) UNIQUE NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for slug lookups
CREATE INDEX idx_service_package_types_slug ON service_package_types(slug);

-- Index for ordering
CREATE INDEX idx_service_package_types_sort_order ON service_package_types(sort_order);

-- Index for active types
CREATE INDEX idx_service_package_types_is_active ON service_package_types(is_active) WHERE is_active = true;

-- ============================================================================
-- SERVICE PACKAGES TABLE
-- ============================================================================
-- Individual service packages with pricing and benefits

CREATE TABLE service_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    name_ru VARCHAR(255),
    name_ro VARCHAR(255),
    price DECIMAL(10,2) NOT NULL,
    network_speed TEXT,
    special_benefits JSONB DEFAULT '[]'::jsonb,
    benefits JSONB DEFAULT '[]'::jsonb,
    type_id UUID REFERENCES service_package_types(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for type lookups
CREATE INDEX idx_service_packages_type_id ON service_packages(type_id);

-- Index for active packages
CREATE INDEX idx_service_packages_is_active ON service_packages(is_active) WHERE is_active = true;

-- Index for ordering
CREATE INDEX idx_service_packages_sort_order ON service_packages(sort_order);

-- ============================================================================
-- SERVICE ORDERS TABLE
-- ============================================================================
-- Customer orders/inquiries for service packages

CREATE TABLE service_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID REFERENCES service_packages(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_email VARCHAR(255),
    customer_address TEXT,
    status service_order_status DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for status filtering
CREATE INDEX idx_service_orders_status ON service_orders(status);

-- Index for package lookups
CREATE INDEX idx_service_orders_package_id ON service_orders(package_id);

-- Index for date range queries
CREATE INDEX idx_service_orders_created_at ON service_orders(created_at DESC);

-- ============================================================================
-- UPDATE TRIGGERS FOR updated_at
-- ============================================================================

-- Service package types updated_at trigger
CREATE OR REPLACE FUNCTION update_service_package_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_service_package_types_updated_at ON service_package_types;
CREATE TRIGGER trigger_update_service_package_types_updated_at
    BEFORE UPDATE ON service_package_types
    FOR EACH ROW EXECUTE FUNCTION update_service_package_types_updated_at();

-- Service packages updated_at trigger
CREATE OR REPLACE FUNCTION update_service_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_service_packages_updated_at ON service_packages;
CREATE TRIGGER trigger_update_service_packages_updated_at
    BEFORE UPDATE ON service_packages
    FOR EACH ROW EXECUTE FUNCTION update_service_packages_updated_at();

-- Service orders updated_at trigger
CREATE OR REPLACE FUNCTION update_service_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_service_orders_updated_at ON service_orders;
CREATE TRIGGER trigger_update_service_orders_updated_at
    BEFORE UPDATE ON service_orders
    FOR EACH ROW EXECUTE FUNCTION update_service_orders_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE service_package_types IS 'Categories/types for service packages (e.g., Internet, TV, Phone)';
COMMENT ON TABLE service_packages IS 'Individual service packages with pricing, speed, and benefits';
COMMENT ON TABLE service_orders IS 'Customer orders/inquiries for service packages';

COMMENT ON COLUMN service_package_types.slug IS 'URL-friendly unique identifier for the package type';
COMMENT ON COLUMN service_package_types.sort_order IS 'Display order for sorting package types';

COMMENT ON COLUMN service_packages.price IS 'Monthly price for the service package';
COMMENT ON COLUMN service_packages.network_speed IS 'Network speed description (e.g., "100 Mbps")';
COMMENT ON COLUMN service_packages.special_benefits IS 'JSONB array of special/highlighted benefits';
COMMENT ON COLUMN service_packages.benefits IS 'JSONB array of standard benefits included in the package';
COMMENT ON COLUMN service_packages.type_id IS 'Reference to the service package type/category';
COMMENT ON COLUMN service_packages.sort_order IS 'Display order for sorting packages within a type';

COMMENT ON COLUMN service_orders.package_id IS 'Reference to the ordered service package';
COMMENT ON COLUMN service_orders.customer_name IS 'Full name of the customer';
COMMENT ON COLUMN service_orders.customer_phone IS 'Contact phone number of the customer';
COMMENT ON COLUMN service_orders.customer_email IS 'Email address of the customer (optional)';
COMMENT ON COLUMN service_orders.customer_address IS 'Service installation address';
COMMENT ON COLUMN service_orders.status IS 'Order status: pending, contacted, approved, rejected, completed';
COMMENT ON COLUMN service_orders.notes IS 'Admin notes about the order';
