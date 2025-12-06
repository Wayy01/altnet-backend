package models

import (
	"time"

	"github.com/google/uuid"
)

// ============================================================================
// SERVICE PACKAGE TYPES
// ============================================================================

// ServicePackageType represents a category/type of service packages
type ServicePackageType struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`      // Base name (English)
	NameRu    *string   `json:"name_ru"`   // Russian translation
	NameRo    *string   `json:"name_ro"`   // Romanian translation
	Slug      string    `json:"slug"`
	SortOrder int       `json:"sort_order"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ServicePackageTypeInput represents input for creating/updating a service package type
type ServicePackageTypeInput struct {
	Name      string  `json:"name"`
	NameRu    *string `json:"name_ru"`
	NameRo    *string `json:"name_ro"`
	Slug      *string `json:"slug"`
	SortOrder *int    `json:"sort_order"`
	IsActive  *bool   `json:"is_active"`
}

// ServicePackageTypeFilters represents query parameters for filtering service package types
type ServicePackageTypeFilters struct {
	Search     string
	ActiveOnly bool
}

// ============================================================================
// SERVICE PACKAGES
// ============================================================================

// ServicePackage represents a service package offering
type ServicePackage struct {
	ID              uuid.UUID  `json:"id"`
	TypeID          *uuid.UUID `json:"type_id"`
	TypeName        *string    `json:"type_name,omitempty"` // Denormalized for display
	Name            string     `json:"name"`                // Base name (English)
	NameRu          *string    `json:"name_ru"`             // Russian translation
	NameRo          *string    `json:"name_ro"`             // Romanian translation
	Price           float64    `json:"price"`
	NetworkSpeed    *string    `json:"network_speed"`
	Benefits        JSONBArray `json:"benefits"`         // Array of benefit strings
	SpecialBenefits JSONBArray `json:"special_benefits"` // Array of highlighted benefits
	SortOrder       int        `json:"sort_order"`
	IsActive        bool       `json:"is_active"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// ServicePackageInput represents input for creating/updating a service package
type ServicePackageInput struct {
	TypeID          *uuid.UUID `json:"type_id"`
	Name            string     `json:"name"`
	NameRu          *string    `json:"name_ru"`
	NameRo          *string    `json:"name_ro"`
	Price           float64    `json:"price"`
	NetworkSpeed    *string    `json:"network_speed"`
	Benefits        JSONBArray `json:"benefits"`
	SpecialBenefits JSONBArray `json:"special_benefits"`
	SortOrder       *int       `json:"sort_order"`
	IsActive        *bool      `json:"is_active"`
}

// ServicePackageFilters represents query parameters for filtering service packages
type ServicePackageFilters struct {
	TypeID     *uuid.UUID
	Search     string
	ActiveOnly bool
}

// ============================================================================
// SERVICE ORDERS
// ============================================================================

// ServiceOrderStatus represents the status of a service order
type ServiceOrderStatus string

const (
	ServiceOrderStatusPending   ServiceOrderStatus = "pending"
	ServiceOrderStatusContacted ServiceOrderStatus = "contacted"
	ServiceOrderStatusApproved  ServiceOrderStatus = "approved"
	ServiceOrderStatusRejected  ServiceOrderStatus = "rejected"
	ServiceOrderStatusCompleted ServiceOrderStatus = "completed"
)

// ValidServiceOrderStatuses for validation
var ValidServiceOrderStatuses = []ServiceOrderStatus{
	ServiceOrderStatusPending,
	ServiceOrderStatusContacted,
	ServiceOrderStatusApproved,
	ServiceOrderStatusRejected,
	ServiceOrderStatusCompleted,
}

// ServiceOrder represents a customer order for a service package
type ServiceOrder struct {
	ID              uuid.UUID          `json:"id"`
	PackageID       *uuid.UUID         `json:"package_id"`
	PackageName     *string            `json:"package_name,omitempty"` // Denormalized for display
	CustomerName    string             `json:"customer_name"`
	CustomerPhone   string             `json:"customer_phone"`
	CustomerEmail   *string            `json:"customer_email"`
	CustomerAddress *string            `json:"customer_address"`
	Status          ServiceOrderStatus `json:"status"`
	Notes           *string            `json:"notes"` // Admin notes
	CreatedAt       time.Time          `json:"created_at"`
	UpdatedAt       time.Time          `json:"updated_at"`
}

// CreateServiceOrderInput represents input for creating a service order (public)
type CreateServiceOrderInput struct {
	PackageID       uuid.UUID `json:"package_id"`
	CustomerName    string    `json:"customer_name"`
	CustomerPhone   string    `json:"customer_phone"`
	CustomerEmail   *string   `json:"customer_email"`
	CustomerAddress *string   `json:"customer_address"`
}

// UpdateServiceOrderInput represents input for updating a service order (admin)
type UpdateServiceOrderInput struct {
	Status *ServiceOrderStatus `json:"status"`
	Notes  *string             `json:"notes"`
}

// ServiceOrderFilters represents query parameters for filtering service orders
type ServiceOrderFilters struct {
	PackageID *uuid.UUID
	Status    *ServiceOrderStatus
	Search    string // Search in customer_name, customer_phone, customer_email
	DateFrom  *time.Time
	DateTo    *time.Time
}

// ServiceOrderStats represents statistics for service orders
type ServiceOrderStats struct {
	TotalOrders     int `json:"total_orders"`
	PendingOrders   int `json:"pending_orders"`
	ContactedOrders int `json:"contacted_orders"`
	ApprovedOrders  int `json:"approved_orders"`
	RejectedOrders  int `json:"rejected_orders"`
	CompletedOrders int `json:"completed_orders"`
	TodayOrders     int `json:"today_orders"`
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// IsValidServiceOrderStatus checks if a status is valid
func IsValidServiceOrderStatus(status ServiceOrderStatus) bool {
	for _, s := range ValidServiceOrderStatuses {
		if s == status {
			return true
		}
	}
	return false
}

// ApplyMultiLangAutoFill copies multi-language fields when one is empty
// Base name is required; if name_ru/name_ro are empty, copy from name
func ApplyMultiLangAutoFill(name string, nameRu *string, nameRo *string) (string, *string, *string) {
	// If Russian is empty, copy from base name
	if (nameRu == nil || *nameRu == "") && name != "" {
		nameRu = &name
	}

	// If Romanian is empty, copy from base name
	if (nameRo == nil || *nameRo == "") && name != "" {
		nameRo = &name
	}

	return name, nameRu, nameRo
}
