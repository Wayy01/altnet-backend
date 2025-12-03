package models

import (
	"time"

	"github.com/google/uuid"
)

// ============================================================================
// PROMOTIONS AND DISCOUNTS
// ============================================================================

// Discount type constants
const (
	DiscountTypePercentage  = "percentage"
	DiscountTypeFixedAmount = "fixed_amount"
)

// Promotion represents a promotional discount campaign
type Promotion struct {
	ID            uuid.UUID  `json:"id"`
	Name          string     `json:"name"`
	Description   *string    `json:"description"`
	DiscountType  string     `json:"discount_type"` // 'percentage' or 'fixed_amount'
	DiscountValue float64    `json:"discount_value"`
	StartDate     time.Time  `json:"start_date"`
	EndDate       time.Time  `json:"end_date"`
	IsActive      bool       `json:"is_active"`
	Priority      int        `json:"priority"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	ProductCount  int        `json:"product_count,omitempty"` // Number of products in promotion
}

// ProductPromotion represents the junction table between products and promotions
type ProductPromotion struct {
	ID          uuid.UUID `json:"id"`
	ProductID   uuid.UUID `json:"product_id"`
	PromotionID uuid.UUID `json:"promotion_id"`
	CreatedAt   time.Time `json:"created_at"`
}

// PromotionInput represents the request body for creating/updating a promotion
type PromotionInput struct {
	Name          string    `json:"name"`
	Description   *string   `json:"description"`
	DiscountType  string    `json:"discount_type"` // 'percentage' or 'fixed_amount'
	DiscountValue float64   `json:"discount_value"`
	StartDate     time.Time `json:"start_date"`
	EndDate       time.Time `json:"end_date"`
	IsActive      bool      `json:"is_active"`
	Priority      int       `json:"priority"`
}

// PromotionFilters represents query parameters for filtering promotions
type PromotionFilters struct {
	Search   string // Search in name/description
	IsActive *bool  // Filter by active status
}

// AddProductsRequest represents the request to add products to a promotion
type AddProductsRequest struct {
	ProductIDs []uuid.UUID `json:"product_ids"`
}

// RemoveProductsRequest represents the request to remove products from a promotion
type RemoveProductsRequest struct {
	ProductIDs []uuid.UUID `json:"product_ids"`
}

// BulkAddProductsRequest represents the request to add products by filter criteria
type BulkAddProductsRequest struct {
	BrandID    *uuid.UUID `json:"brand_id"`
	CategoryID *uuid.UUID `json:"category_id"`
	MinPrice   *float64   `json:"min_price"`
	MaxPrice   *float64   `json:"max_price"`
	InStock    *bool      `json:"in_stock"`
}

// PromotionWithStats includes promotion with product count
type PromotionWithStats struct {
	*Promotion
	ActiveProductCount int `json:"active_product_count"` // Count of products that are active
}
