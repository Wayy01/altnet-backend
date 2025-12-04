/**
 * Orders Type Definitions
 *
 * This file contains all TypeScript interfaces for the order management system.
 */

/**
 * Order status type union
 */
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

/**
 * Payment method type union
 */
export type PaymentMethod = 'card' | 'bank_transfer' | 'cash';

/**
 * Delivery type type union
 */
export type DeliveryType = 'pickup' | 'delivery';

/**
 * Order item with product snapshot
 */
export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_sku: string | null;
  product_image: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

/**
 * Main order entity
 */
export interface Order {
  id: string;
  order_number: string;
  full_name: string;
  phone_number: string;
  email: string | null;
  delivery_type: DeliveryType;
  delivery_address: string | null;
  store_id: string | null;
  store_name?: string;
  payment_method: PaymentMethod;
  total_amount: number;
  currency: string;
  status: OrderStatus;
  notes: string | null;
  user_id: string | null;
  user_name: string | null;
  user_pfp: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Order with items (full detail view)
 */
export interface OrderWithItems extends Order {
  items: OrderItem[];
}

/**
 * Input for creating a new order
 */
export interface CreateOrderInput {
  full_name: string;
  phone_number: string;
  email?: string | null;
  delivery_type: DeliveryType;
  delivery_address?: string | null;
  store_id?: string | null;
  payment_method: PaymentMethod;
  notes?: string | null;
  items: {
    product_id: string;
    quantity: number;
  }[];
}

/**
 * Input for updating an existing order
 */
export interface UpdateOrderInput {
  full_name?: string;
  phone_number?: string;
  email?: string | null;
  delivery_type?: DeliveryType;
  delivery_address?: string | null;
  store_id?: string | null;
  payment_method?: PaymentMethod;
  status?: OrderStatus;
  notes?: string | null;
}

/**
 * Filters for listing orders
 */
export interface OrderFilters {
  search?: string;
  status?: OrderStatus;
  payment_method?: PaymentMethod;
  delivery_type?: DeliveryType;
  store_id?: string;
  date_from?: string;
  date_to?: string;
}

/**
 * Response for listing orders
 */
export interface OrdersListResponse {
  data: Order[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * Order statistics
 */
export interface OrderStats {
  total_orders: number;
  pending_orders: number;
  confirmed_orders: number;
  processing_orders: number;
  shipped_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  total_revenue: number;
  average_order_value: number;
  today_orders: number;
  today_revenue: number;
}

/**
 * Response for getting a single order
 */
export interface OrderDetailResponse {
  data: OrderWithItems;
}

/**
 * Order comment from admin
 */
export interface OrderComment {
  id: string;
  order_id: string;
  admin_id: string;
  admin_name: string;
  content: string;
  created_at: string;
}

/**
 * Input for creating an order comment
 */
export interface CreateOrderCommentInput {
  content: string;
}
