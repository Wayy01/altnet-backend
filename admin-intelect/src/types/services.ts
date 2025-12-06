// ============================================================================
// SERVICE PACKAGES TYPES
// ============================================================================

// Service order status
export type ServiceOrderStatus = 'pending' | 'contacted' | 'approved' | 'rejected' | 'completed';

// Service package type (category like Internet, TV, etc.)
export interface ServicePackageType {
  id: string;
  name: string;        // Base name (English)
  name_ru?: string | null;
  name_ro?: string | null;
  slug: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Service package
export interface ServicePackage {
  id: string;
  type_id?: string | null;
  type_name?: string | null;
  name: string;        // Base name (English)
  name_ru?: string | null;
  name_ro?: string | null;
  price: number;
  network_speed?: string | null;
  benefits: string[];
  special_benefits: string[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Service order
export interface ServiceOrder {
  id: string;
  package_id?: string | null;
  package_name?: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  customer_address?: string | null;
  status: ServiceOrderStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// Input types for creating/updating
export interface ServicePackageTypeInput {
  name: string;        // Required base name (English)
  name_ru?: string | null;
  name_ro?: string | null;
  slug?: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface ServicePackageInput {
  type_id?: string | null;
  name: string;        // Required base name (English)
  name_ru?: string | null;
  name_ro?: string | null;
  price: number;
  network_speed?: string | null;
  benefits?: string[];
  special_benefits?: string[];
  sort_order?: number;
  is_active?: boolean;
}

export interface CreateServiceOrderInput {
  package_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  customer_address?: string | null;
}

export interface UpdateServiceOrderInput {
  status?: ServiceOrderStatus;
  notes?: string | null;
}

// Filter types
export interface ServicePackageTypeFilters {
  search?: string;
  active_only?: boolean;
}

export interface ServicePackageFilters {
  type_id?: string;
  search?: string;
  active_only?: boolean;
}

export interface ServiceOrderFilters {
  status?: ServiceOrderStatus;
  package_id?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
}

// API responses
export interface ServicePackageTypesResponse {
  data: ServicePackageType[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface ServicePackagesResponse {
  data: ServicePackage[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface ServiceOrdersResponse {
  data: ServiceOrder[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface ServiceOrderStats {
  total_orders: number;
  pending_orders: number;
  contacted_orders: number;
  approved_orders: number;
  rejected_orders: number;
  completed_orders: number;
  today_orders: number;
}
