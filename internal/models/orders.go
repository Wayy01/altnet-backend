package models

import (
	"time"

	"github.com/google/uuid"
)

// ============================================================================
// ORDER MANAGEMENT CONSTANTS
// ============================================================================

// Order status constants
const (
	OrderStatusPending    = "pending"
	OrderStatusConfirmed  = "confirmed"
	OrderStatusProcessing = "processing"
	OrderStatusShipped    = "shipped"
	OrderStatusDelivered  = "delivered"
	OrderStatusCancelled  = "cancelled"
)

// Payment method constants
const (
	PaymentMethodCard         = "card"
	PaymentMethodBankTransfer = "bank_transfer"
	PaymentMethodCash         = "cash"
)

// Delivery type constants
const (
	DeliveryTypePickup   = "pickup"
	DeliveryTypeDelivery = "delivery"
)

// ValidOrderStatuses for validation
var ValidOrderStatuses = []string{
	OrderStatusPending,
	OrderStatusConfirmed,
	OrderStatusProcessing,
	OrderStatusShipped,
	OrderStatusDelivered,
	OrderStatusCancelled,
}

// ValidPaymentMethods for validation
var ValidPaymentMethods = []string{
	PaymentMethodCard,
	PaymentMethodBankTransfer,
	PaymentMethodCash,
}

// ValidDeliveryTypes for validation
var ValidDeliveryTypes = []string{
	DeliveryTypePickup,
	DeliveryTypeDelivery,
}

// AllowedStatusTransitions defines valid status transitions
var AllowedStatusTransitions = map[string][]string{
	OrderStatusPending:    {OrderStatusConfirmed, OrderStatusCancelled},
	OrderStatusConfirmed:  {OrderStatusProcessing, OrderStatusCancelled},
	OrderStatusProcessing: {OrderStatusShipped, OrderStatusCancelled},
	OrderStatusShipped:    {OrderStatusDelivered},
	OrderStatusDelivered:  {}, // Terminal state
	OrderStatusCancelled:  {OrderStatusPending}, // Can revert to pending
}

// ============================================================================
// STORES
// ============================================================================

// Store represents a physical pickup location
type Store struct {
	ID            uuid.UUID  `json:"id"`
	Name          string     `json:"name"`
	Address       string     `json:"address"`
	GoogleMapsURL *string    `json:"google_maps_url"`
	Images        JSONBArray `json:"images"`
	Videos        JSONBArray `json:"videos"`
	IsActive      bool       `json:"is_active"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// StoreInput represents the request body for creating/updating a store
type StoreInput struct {
	Name          string     `json:"name"`
	Address       string     `json:"address"`
	GoogleMapsURL *string    `json:"google_maps_url"`
	Images        JSONBArray `json:"images"`
	Videos        JSONBArray `json:"videos"`
	IsActive      *bool      `json:"is_active"`
}

// StoreFilters represents query parameters for filtering stores
type StoreFilters struct {
	Search     string // Search in name/address
	ActiveOnly bool   // Filter only active stores
}

// ============================================================================
// ORDERS
// ============================================================================

// Order represents a customer order
type Order struct {
	ID              uuid.UUID  `json:"id"`
	OrderNumber     string     `json:"order_number"`
	FullName        string     `json:"full_name"`
	PhoneNumber     string     `json:"phone_number"`
	Email           *string    `json:"email"`
	DeliveryType    string     `json:"delivery_type"`
	DeliveryAddress *string    `json:"delivery_address"`
	StoreID         *uuid.UUID `json:"store_id"`
	StoreName       *string    `json:"store_name,omitempty"` // Denormalized for display
	PaymentMethod   string     `json:"payment_method"`
	TotalAmount     float64    `json:"total_amount"`
	Currency        string     `json:"currency"`
	Status          string     `json:"status"`
	Notes           *string    `json:"notes"`
	UserID          *string    `json:"user_id"`
	UserName        *string    `json:"user_name"`
	UserPfp         *string    `json:"user_pfp"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// OrderWithItems represents an order with its items
type OrderWithItems struct {
	*Order
	Items []*OrderItem `json:"items"`
}

// OrderItem represents an individual item in an order
type OrderItem struct {
	ID           uuid.UUID `json:"id"`
	OrderID      uuid.UUID `json:"order_id"`
	ProductID    uuid.UUID `json:"product_id"`
	ProductName  string    `json:"product_name"`
	ProductSKU   *string   `json:"product_sku"`
	ProductImage *string   `json:"product_image"`
	Quantity     int       `json:"quantity"`
	UnitPrice    float64   `json:"unit_price"`
	TotalPrice   float64   `json:"total_price"`
	CreatedAt    time.Time `json:"created_at"`
}

// CreateOrderInput represents the request body for creating an order
type CreateOrderInput struct {
	FullName        string            `json:"full_name"`
	PhoneNumber     string            `json:"phone_number"`
	Email           *string           `json:"email"`
	DeliveryType    string            `json:"delivery_type"`
	DeliveryAddress *string           `json:"delivery_address"`
	StoreID         *uuid.UUID        `json:"store_id"`
	PaymentMethod   string            `json:"payment_method"`
	Notes           *string           `json:"notes"`
	UserID          *string           `json:"user_id"`
	UserName        *string           `json:"user_name"`
	UserPfp         *string           `json:"user_pfp"`
	Items           []CreateOrderItem `json:"items"`
}

// CreateOrderItem represents an item in order creation request
type CreateOrderItem struct {
	ProductID uuid.UUID `json:"product_id"`
	Quantity  int       `json:"quantity"`
}

// UpdateOrderInput represents the request body for updating an order
type UpdateOrderInput struct {
	FullName        *string    `json:"full_name"`
	PhoneNumber     *string    `json:"phone_number"`
	Email           *string    `json:"email"`
	DeliveryType    *string    `json:"delivery_type"`
	DeliveryAddress *string    `json:"delivery_address"`
	StoreID         *uuid.UUID `json:"store_id"`
	PaymentMethod   *string    `json:"payment_method"`
	Notes           *string    `json:"notes"`
}

// UpdateOrderStatusInput represents the request body for updating order status
type UpdateOrderStatusInput struct {
	Status string `json:"status"`
}

// OrderFilters represents query parameters for filtering orders
type OrderFilters struct {
	Search        string     // Search in order_number, full_name, phone_number
	Status        *string    // Filter by status
	PaymentMethod *string    // Filter by payment method
	DeliveryType  *string    // Filter by delivery type
	StoreID       *uuid.UUID // Filter by store
	DateFrom      *time.Time // Filter by date range
	DateTo        *time.Time
	UserID        *string // Filter by user (future Google Auth)
}

// OrderStats represents order statistics
type OrderStats struct {
	TotalOrders       int     `json:"total_orders"`
	PendingOrders     int     `json:"pending_orders"`
	ConfirmedOrders   int     `json:"confirmed_orders"`
	ProcessingOrders  int     `json:"processing_orders"`
	ShippedOrders     int     `json:"shipped_orders"`
	DeliveredOrders   int     `json:"delivered_orders"`
	CancelledOrders   int     `json:"cancelled_orders"`
	TotalRevenue      float64 `json:"total_revenue"`
	AverageOrderValue float64 `json:"average_order_value"`
	TodayOrders       int     `json:"today_orders"`
	TodayRevenue      float64 `json:"today_revenue"`
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// IsValidOrderStatus checks if a status is valid
func IsValidOrderStatus(status string) bool {
	for _, s := range ValidOrderStatuses {
		if s == status {
			return true
		}
	}
	return false
}

// IsValidPaymentMethod checks if a payment method is valid
func IsValidPaymentMethod(method string) bool {
	for _, m := range ValidPaymentMethods {
		if m == method {
			return true
		}
	}
	return false
}

// IsValidDeliveryType checks if a delivery type is valid
func IsValidDeliveryType(dtype string) bool {
	for _, d := range ValidDeliveryTypes {
		if d == dtype {
			return true
		}
	}
	return false
}

// CanTransitionTo checks if an order can transition from current status to new status
func CanTransitionTo(currentStatus, newStatus string) bool {
	allowedTransitions, exists := AllowedStatusTransitions[currentStatus]
	if !exists {
		return false
	}
	for _, s := range allowedTransitions {
		if s == newStatus {
			return true
		}
	}
	return false
}

// ============================================================================
// ORDER COMMENTS
// ============================================================================

// OrderComment represents an admin comment on an order
type OrderComment struct {
	ID        uuid.UUID `json:"id"`
	OrderID   uuid.UUID `json:"order_id"`
	AdminID   string    `json:"admin_id"`
	AdminName string    `json:"admin_name"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

// CreateOrderCommentInput represents the request body for creating a comment
type CreateOrderCommentInput struct {
	Content string `json:"content"`
}
