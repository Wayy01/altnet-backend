# Public API Documentation

This document describes the public API endpoints designed for frontend applications. These endpoints support **slug-based lookups**, **automatic promotions calculation**, and **discounted pricing**.

## Base URL

```
http://localhost:8080/api/v1/public
```

## Authentication

**No authentication required** - All public endpoints are accessible without JWT tokens.

---

## Products

### List Products

Fetch a paginated list of active products with optional filtering.

**Endpoint:** `GET /api/v1/public/products`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `brand` | string | Filter by brand (UUID or slug) |
| `brand_id` | UUID | Filter by brand UUID (backward compatible) |
| `category` | string | Filter by category (UUID or slug) |
| `category_id` | UUID | Filter by category UUID (backward compatible) |
| `search` | string | Search in name, description, code |
| `min_price` | float | Minimum price (MDL) |
| `max_price` | float | Maximum price (MDL) |
| `in_stock` | boolean | Only show in-stock products (`true`) |
| `sort_by` | string | Sort order: `name_asc`, `name_desc`, `price_high`, `price_low` |
| `properties[Name]` | string | Filter by property value (only `is_filter=true` properties) |
| `limit` | int | Page size (default: 50, max: 100) |
| `offset` | int | Pagination offset |

**Example Request:**

```bash
# Filter by brand slug and category slug
curl "http://localhost:8080/api/v1/public/products?brand=samsung&category=smartphones&in_stock=true"

# Filter with price range
curl "http://localhost:8080/api/v1/public/products?min_price=1000&max_price=5000&sort_by=price_low"

# Search products
curl "http://localhost:8080/api/v1/public/products?search=galaxy&brand=samsung"

# Filter by properties (must be marked as filterable)
curl "http://localhost:8080/api/v1/public/products?properties[Color]=Black&properties[RAM]=8GB"

# Combine all filters
curl "http://localhost:8080/api/v1/public/products?brand=samsung&category=smartphones&properties[Color]=Black&in_stock=true&sort_by=price_low"
```

**Example Response:**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "ultra_id": "123456",
      "name": "Samsung Galaxy S24 Ultra",
      "slug": "samsung-galaxy-s24-ultra",
      "description": "Flagship smartphone with AI features",
      "brand_id": "770e8400-e29b-41d4-a716-446655440002",
      "brand_name": "Samsung",
      "category_id": "880e8400-e29b-41d4-a716-446655440003",
      "category_name": "Smartphones",
      "main_image_url": "https://example.com/images/s24-ultra.jpg",
      "images": ["https://example.com/images/s24-ultra-1.jpg"],
      "price_mdl": 25999.00,
      "price_eur": 1299.00,
      "price_usd": 1399.00,
      "total_stock": 50,
      "is_in_stock": true,
      "is_active": true,
      "manual_discount_percent": null,
      "effective_discount_percent": 15.0,
      "discounted_price_mdl": 22099.15,
      "discounted_price_eur": 1104.15,
      "discounted_price_usd": 1189.15,
      "active_promotions": [
        {
          "id": "660e8400-e29b-41d4-a716-446655440001",
          "name": "Holiday Sale",
          "description": "15% off all Samsung products",
          "discount_type": "percentage",
          "discount_value": 15.0,
          "start_date": "2025-12-01T00:00:00Z",
          "end_date": "2025-12-31T23:59:59Z",
          "is_active": true,
          "priority": 10
        }
      ],
      "name_ru": "Samsung Galaxy S24 Ultra",
      "name_ro": "Samsung Galaxy S24 Ultra",
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "total": 245,
    "limit": 50,
    "offset": 0
  }
}
```

---

### Get Product by ID or Slug

Fetch a single product with full details including brand, category, and properties.

**Endpoint:** `GET /api/v1/public/products/{identifier}`

- `{identifier}` can be a **UUID** or a **slug**

**Example Requests:**

```bash
# By slug (SEO-friendly)
curl "http://localhost:8080/api/v1/public/products/samsung-galaxy-s24-ultra"

# By UUID
curl "http://localhost:8080/api/v1/public/products/550e8400-e29b-41d4-a716-446655440000"
```

**Example Response:**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "ultra_id": "123456",
    "name": "Samsung Galaxy S24 Ultra",
    "slug": "samsung-galaxy-s24-ultra",
    "description": "Flagship smartphone with AI features and S Pen support",
    "brand_id": "770e8400-e29b-41d4-a716-446655440002",
    "brand_name": "Samsung",
    "category_id": "880e8400-e29b-41d4-a716-446655440003",
    "category_name": "Smartphones",
    "main_image_url": "https://example.com/images/s24-ultra.jpg",
    "images": [
      "https://example.com/images/s24-ultra-1.jpg",
      "https://example.com/images/s24-ultra-2.jpg"
    ],
    "warranty": "24 months",
    "barcodes": ["8806094837261"],
    "price_mdl": 25999.00,
    "price_eur": 1299.00,
    "price_usd": 1399.00,
    "total_stock": 50,
    "is_in_stock": true,
    "is_active": true,
    "name_ru": "Samsung Galaxy S24 Ultra",
    "name_ro": "Samsung Galaxy S24 Ultra",
    "description_ru": "Флагманский смартфон с функциями ИИ",
    "description_ro": "Smartphone flagship cu funcții AI",
    "manual_discount_percent": null,
    "effective_discount_percent": 15.0,
    "discounted_price_mdl": 22099.15,
    "discounted_price_eur": 1104.15,
    "discounted_price_usd": 1189.15,
    "active_promotions": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "name": "Holiday Sale",
        "description": "15% off all Samsung products",
        "discount_type": "percentage",
        "discount_value": 15.0,
        "start_date": "2025-12-01T00:00:00Z",
        "end_date": "2025-12-31T23:59:59Z",
        "is_active": true,
        "priority": 10
      }
    ],
    "brand": {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "name": "Samsung",
      "slug": "samsung",
      "logo_url": "https://example.com/logos/samsung.png"
    },
    "category": {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "name": "Smartphones",
      "slug": "smartphones",
      "parent_id": "990e8400-e29b-41d4-a716-446655440004",
      "name_ru": "Смартфоны",
      "name_ro": "Smartphone-uri"
    },
    "properties": [
      {
        "id": "aa0e8400-e29b-41d4-a716-446655440005",
        "property_name": "Display Size",
        "value": "6.8 inches",
        "group_name": "Display",
        "is_filter": true
      },
      {
        "id": "bb0e8400-e29b-41d4-a716-446655440006",
        "property_name": "RAM",
        "value": "12 GB",
        "group_name": "Memory",
        "is_filter": true
      }
    ],
    "property_count": 25,
    "created_at": "2025-01-15T10:30:00Z",
    "updated_at": "2025-01-15T10:30:00Z"
  }
}
```

---

## Brands

### List Brands

Fetch all active brands.

**Endpoint:** `GET /api/v1/public/brands`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search by brand name |
| `has_products` | string | Filter brands with/without products (`true`/`false`) |
| `sort_by` | string | Sort: `name_asc`, `name_desc`, `products_asc`, `products_desc` |
| `limit` | int | Page size (default: 50, max: 100) |
| `offset` | int | Pagination offset |

**Example Request:**

```bash
curl "http://localhost:8080/api/v1/public/brands?has_products=true&sort_by=name_asc"
```

**Example Response:**

```json
{
  "data": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "ultra_id": "B001",
      "name": "Samsung",
      "slug": "samsung",
      "logo_url": "https://example.com/logos/samsung.png",
      "is_active": true,
      "product_count": 245,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-15T00:00:00Z"
    },
    {
      "id": "cc0e8400-e29b-41d4-a716-446655440007",
      "ultra_id": "B002",
      "name": "Apple",
      "slug": "apple",
      "logo_url": "https://example.com/logos/apple.png",
      "is_active": true,
      "product_count": 189,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-15T00:00:00Z"
    }
  ],
  "meta": {
    "total": 150,
    "limit": 50,
    "offset": 0
  }
}
```

---

### Get Brand by ID or Slug

**Endpoint:** `GET /api/v1/public/brands/{identifier}`

**Example Requests:**

```bash
# By slug
curl "http://localhost:8080/api/v1/public/brands/samsung"

# By UUID
curl "http://localhost:8080/api/v1/public/brands/770e8400-e29b-41d4-a716-446655440002"
```

**Example Response:**

```json
{
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "ultra_id": "B001",
    "name": "Samsung",
    "slug": "samsung",
    "logo_url": "https://example.com/logos/samsung.png",
    "is_active": true,
    "product_count": 245,
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-15T00:00:00Z"
  }
}
```

---

### Get Brand Products

Fetch products for a specific brand.

**Endpoint:** `GET /api/v1/public/brands/{identifier}/products`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search products |
| `in_stock` | boolean | Only in-stock (`true`) |
| `sort_by` | string | Sort order |
| `properties[Name]` | string | Filter by property value |
| `limit` | int | Page size |
| `offset` | int | Pagination offset |

**Example Request:**

```bash
# Get Samsung products in stock
curl "http://localhost:8080/api/v1/public/brands/samsung/products?in_stock=true&limit=20"

# Get Samsung products with specific color
curl "http://localhost:8080/api/v1/public/brands/samsung/products?properties[Color]=Black"
```

---

## Categories

### List Categories

Fetch categories (hierarchical tree by default).

**Endpoint:** `GET /api/v1/public/categories`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `parent_id` | UUID | Filter by parent category (root categories if omitted) |
| `limit` | int | Page size (default: 50) |
| `offset` | int | Pagination offset |

**Example Request:**

```bash
# Get root categories
curl "http://localhost:8080/api/v1/public/categories"

# Get subcategories of a category
curl "http://localhost:8080/api/v1/public/categories?parent_id=880e8400-e29b-41d4-a716-446655440003"
```

**Example Response:**

```json
{
  "data": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "ultra_id": "C001",
      "name": "Electronics",
      "slug": "electronics",
      "parent_id": null,
      "sort_order": 1,
      "image_url": "https://example.com/categories/electronics.jpg",
      "product_count": 1500,
      "is_active": true,
      "name_ru": "Электроника",
      "name_ro": "Electronice",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-15T00:00:00Z"
    },
    {
      "id": "dd0e8400-e29b-41d4-a716-446655440008",
      "ultra_id": "C002",
      "name": "Home & Garden",
      "slug": "home-garden",
      "parent_id": null,
      "sort_order": 2,
      "image_url": "https://example.com/categories/home.jpg",
      "product_count": 850,
      "is_active": true,
      "name_ru": "Дом и сад",
      "name_ro": "Casa si gradina",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-15T00:00:00Z"
    }
  ],
  "meta": {
    "total": 25,
    "limit": 50,
    "offset": 0
  }
}
```

---

### Get Category by ID or Slug

**Endpoint:** `GET /api/v1/public/categories/{identifier}`

Returns category with its subcategories.

**Example Request:**

```bash
curl "http://localhost:8080/api/v1/public/categories/smartphones"
```

**Example Response:**

```json
{
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "name": "Smartphones",
    "slug": "smartphones",
    "parent_id": "ee0e8400-e29b-41d4-a716-446655440009",
    "sort_order": 1,
    "image_url": "https://example.com/categories/smartphones.jpg",
    "product_count": 450,
    "name_ru": "Смартфоны",
    "name_ro": "Smartphone-uri",
    "subcategories": [
      {
        "id": "ff0e8400-e29b-41d4-a716-446655440010",
        "name": "Android Phones",
        "slug": "android-phones",
        "parent_id": "880e8400-e29b-41d4-a716-446655440003",
        "product_count": 320,
        "is_active": true
      },
      {
        "id": "110e8400-e29b-41d4-a716-446655440011",
        "name": "iPhones",
        "slug": "iphones",
        "parent_id": "880e8400-e29b-41d4-a716-446655440003",
        "product_count": 130,
        "is_active": true
      }
    ]
  }
}
```

---

### Get Category Products

Fetch products in a specific category.

**Endpoint:** `GET /api/v1/public/categories/{identifier}/products`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `brand` | string | Filter by brand (UUID or slug) |
| `search` | string | Search products |
| `in_stock` | boolean | Only in-stock (`true`) |
| `sort_by` | string | Sort order |
| `properties[Name]` | string | Filter by property value |
| `limit` | int | Page size |
| `offset` | int | Pagination offset |

**Example Request:**

```bash
# Get all smartphone products
curl "http://localhost:8080/api/v1/public/categories/smartphones/products"

# Get Samsung smartphones only
curl "http://localhost:8080/api/v1/public/categories/smartphones/products?brand=samsung&in_stock=true"

# Get smartphones with specific RAM and storage
curl "http://localhost:8080/api/v1/public/categories/smartphones/products?properties[RAM]=8GB&properties[Storage]=256GB"

# Combine brand and property filters
curl "http://localhost:8080/api/v1/public/categories/smartphones/products?brand=samsung&properties[Color]=Black&in_stock=true"
```

---

## Filterable Properties

### Get Filterable Properties

Returns all properties that can be used for filtering products (`is_filter=true`), along with their possible values and product counts.

**Endpoint:** `GET /api/v1/public/properties/filters`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | Filter by category (UUID or slug) to get relevant properties |

**Example Request:**

```bash
# Get all filterable properties
curl "http://localhost:8080/api/v1/public/properties/filters"

# Get filterable properties for a specific category
curl "http://localhost:8080/api/v1/public/properties/filters?category=smartphones"
```

**Example Response:**

```json
{
  "data": [
    {
      "property_name": "Color",
      "property_name_ru": "Цвет",
      "property_name_ro": "Culoare",
      "values": ["Black", "Blue", "Gold", "Silver", "White"],
      "product_count": 450
    },
    {
      "property_name": "RAM",
      "property_name_ru": "Оперативная память",
      "property_name_ro": "Memorie RAM",
      "values": ["4GB", "6GB", "8GB", "12GB", "16GB"],
      "product_count": 380
    },
    {
      "property_name": "Storage",
      "property_name_ru": "Память",
      "property_name_ro": "Stocare",
      "values": ["64GB", "128GB", "256GB", "512GB", "1TB"],
      "product_count": 420
    }
  ],
  "meta": {
    "total": 3
  }
}
```

### Property Filtering Notes

- Only properties with `is_filter=true` can be used for filtering
- Multiple property filters use AND logic (all must match)
- Property names are case-sensitive
- Use the filterable properties endpoint to discover available filters

---

## Service Types & Packages

### List Service Types

Fetch all active service types (e.g., Internet, TV, Mobile).

**Endpoint:** `GET /api/v1/public/service-types`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search by name |
| `limit` | int | Page size (default: 50) |
| `offset` | int | Pagination offset |

**Example Request:**

```bash
curl "http://localhost:8080/api/v1/public/service-types"
```

**Example Response:**

```json
{
  "data": [
    {
      "id": "aa0e8400-e29b-41d4-a716-446655440001",
      "name": "Internet",
      "name_ru": "Интернет",
      "name_ro": "Internet",
      "slug": "internet",
      "sort_order": 1,
      "is_active": true,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-15T00:00:00Z"
    },
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440002",
      "name": "Television",
      "name_ru": "Телевидение",
      "name_ro": "Televiziune",
      "slug": "television",
      "sort_order": 2,
      "is_active": true,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-15T00:00:00Z"
    }
  ],
  "meta": {
    "total": 4,
    "limit": 50,
    "offset": 0
  }
}
```

---

### Get Service Type by ID or Slug

**Endpoint:** `GET /api/v1/public/service-types/{identifier}`

**Example Requests:**

```bash
# By slug
curl "http://localhost:8080/api/v1/public/service-types/internet"

# By UUID
curl "http://localhost:8080/api/v1/public/service-types/aa0e8400-e29b-41d4-a716-446655440001"
```

**Example Response:**

```json
{
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440001",
    "name": "Internet",
    "name_ru": "Интернет",
    "name_ro": "Internet",
    "slug": "internet",
    "sort_order": 1,
    "is_active": true,
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-15T00:00:00Z"
  }
}
```

---

### Get Packages by Service Type

Fetch packages for a specific service type.

**Endpoint:** `GET /api/v1/public/service-types/{identifier}/packages`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | int | Page size (default: 50) |
| `offset` | int | Pagination offset |

**Example Request:**

```bash
# By slug
curl "http://localhost:8080/api/v1/public/service-types/internet/packages"
```

**Example Response:**

```json
{
  "data": [
    {
      "id": "cc0e8400-e29b-41d4-a716-446655440003",
      "type_id": "aa0e8400-e29b-41d4-a716-446655440001",
      "name": "Basic Internet",
      "name_ru": "Базовый интернет",
      "name_ro": "Internet de bază",
      "price": 199.00,
      "network_speed": "50 Mbps",
      "benefits": ["Unlimited data", "WiFi router included"],
      "special_benefits": ["Free installation"],
      "sort_order": 1,
      "is_active": true,
      "type_name": "Internet",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-15T00:00:00Z"
    },
    {
      "id": "dd0e8400-e29b-41d4-a716-446655440004",
      "type_id": "aa0e8400-e29b-41d4-a716-446655440001",
      "name": "Premium Internet",
      "name_ru": "Премиум интернет",
      "name_ro": "Internet premium",
      "price": 399.00,
      "network_speed": "200 Mbps",
      "benefits": ["Unlimited data", "WiFi 6 router", "Priority support"],
      "special_benefits": ["Free installation", "First month free"],
      "sort_order": 2,
      "is_active": true,
      "type_name": "Internet",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-15T00:00:00Z"
    }
  ],
  "meta": {
    "total": 3,
    "limit": 50,
    "offset": 0
  }
}
```

---

### List All Service Packages

Fetch all active service packages with optional type filtering.

**Endpoint:** `GET /api/v1/public/service-packages`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Filter by type (UUID or slug) |
| `search` | string | Search by name |
| `limit` | int | Page size (default: 50) |
| `offset` | int | Pagination offset |

**Example Request:**

```bash
# Get all packages
curl "http://localhost:8080/api/v1/public/service-packages"

# Filter by type slug
curl "http://localhost:8080/api/v1/public/service-packages?type=internet"
```

---

### Get Service Package by ID

**Endpoint:** `GET /api/v1/public/service-packages/{id}`

**Example Request:**

```bash
curl "http://localhost:8080/api/v1/public/service-packages/cc0e8400-e29b-41d4-a716-446655440003"
```

**Example Response:**

```json
{
  "data": {
    "id": "cc0e8400-e29b-41d4-a716-446655440003",
    "type_id": "aa0e8400-e29b-41d4-a716-446655440001",
    "name": "Basic Internet",
    "name_ru": "Базовый интернет",
    "name_ro": "Internet de bază",
    "price": 199.00,
    "network_speed": "50 Mbps",
    "benefits": ["Unlimited data", "WiFi router included"],
    "special_benefits": ["Free installation"],
    "sort_order": 1,
    "is_active": true,
    "type_name": "Internet",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-15T00:00:00Z"
  }
}
```

---

## Promotions & Pricing

### How Discounts Work

Products can have discounts from two sources:

1. **Manual Discount** (`manual_discount_percent`) - Set directly on the product
2. **Promotion Discount** - From active promotions linked to the product

The **effective discount** is the maximum of these two values.

### Promotion Types

| Type | Description |
|------|-------------|
| `percentage` | Percentage off (e.g., 15% = 15.0) |
| `fixed_amount` | Fixed amount off in MDL |

### Discounted Price Calculation

```
discounted_price = original_price * (1 - effective_discount_percent / 100)
```

### Response Fields

| Field | Description |
|-------|-------------|
| `price_mdl` | Original price in MDL |
| `price_eur` | Original price in EUR |
| `price_usd` | Original price in USD |
| `manual_discount_percent` | Manual discount (if set) |
| `effective_discount_percent` | Final discount applied |
| `discounted_price_mdl` | Final price in MDL |
| `discounted_price_eur` | Final price in EUR |
| `discounted_price_usd` | Final price in USD |
| `active_promotions` | Array of active promotions |

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "details": "Additional details about the error"
}
```

### Common HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found - Resource doesn't exist or is inactive |
| 500 | Internal Server Error |

### Example Error Response

```json
{
  "error": "Product not found",
  "details": "no rows in result set"
}
```

---

## Frontend Integration Examples

### React/Next.js

```typescript
// Fetch product by slug
const fetchProduct = async (slug: string) => {
  const response = await fetch(`/api/v1/public/products/${slug}`);
  const { data } = await response.json();
  return data;
};

// Fetch products with filters including properties
const fetchProducts = async (filters: {
  brand?: string;
  category?: string;
  inStock?: boolean;
  properties?: Record<string, string>;
  page?: number;
}) => {
  const params = new URLSearchParams();
  if (filters.brand) params.append('brand', filters.brand);
  if (filters.category) params.append('category', filters.category);
  if (filters.inStock) params.append('in_stock', 'true');

  // Add property filters
  if (filters.properties) {
    Object.entries(filters.properties).forEach(([name, value]) => {
      params.append(`properties[${name}]`, value);
    });
  }

  params.append('limit', '20');
  params.append('offset', String((filters.page || 0) * 20));

  const response = await fetch(`/api/v1/public/products?${params}`);
  return response.json();
};

// Fetch filterable properties for a category
const fetchFilterableProperties = async (category?: string) => {
  const params = new URLSearchParams();
  if (category) params.append('category', category);

  const response = await fetch(`/api/v1/public/properties/filters?${params}`);
  const { data } = await response.json();
  return data;
};

// Fetch service types and packages
const fetchServiceTypes = async () => {
  const response = await fetch('/api/v1/public/service-types');
  const { data } = await response.json();
  return data;
};

const fetchPackagesByType = async (typeSlug: string) => {
  const response = await fetch(`/api/v1/public/service-types/${typeSlug}/packages`);
  const { data } = await response.json();
  return data;
};

// Example usage
const product = await fetchProduct('samsung-galaxy-s24-ultra');
const products = await fetchProducts({
  brand: 'samsung',
  category: 'smartphones',
  inStock: true,
  properties: { Color: 'Black', RAM: '8GB' }
});
const filters = await fetchFilterableProperties('smartphones');
const serviceTypes = await fetchServiceTypes();
const internetPackages = await fetchPackagesByType('internet');
```

### URL Structure for SEO

```
/products/{slug}                      -> GET /api/v1/public/products/{slug}
/brands/{slug}                        -> GET /api/v1/public/brands/{slug}
/brands/{slug}/products               -> GET /api/v1/public/brands/{slug}/products
/categories/{slug}                    -> GET /api/v1/public/categories/{slug}
/categories/{slug}/products           -> GET /api/v1/public/categories/{slug}/products
/services/{type-slug}                 -> GET /api/v1/public/service-types/{type-slug}
/services/{type-slug}/packages        -> GET /api/v1/public/service-types/{type-slug}/packages
```

---

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/public/products` | List products with filters |
| GET | `/api/v1/public/products/{id\|slug}` | Get product details |
| GET | `/api/v1/public/brands` | List brands |
| GET | `/api/v1/public/brands/{id\|slug}` | Get brand |
| GET | `/api/v1/public/brands/{id\|slug}/products` | Brand's products |
| GET | `/api/v1/public/categories` | Category tree |
| GET | `/api/v1/public/categories/{id\|slug}` | Get category |
| GET | `/api/v1/public/categories/{id\|slug}/products` | Category's products |
| GET | `/api/v1/public/properties/filters` | Filterable properties |
| GET | `/api/v1/public/service-types` | List service types |
| GET | `/api/v1/public/service-types/{id\|slug}` | Get service type |
| GET | `/api/v1/public/service-types/{id\|slug}/packages` | Type's packages |
| GET | `/api/v1/public/service-packages` | List all packages |
| GET | `/api/v1/public/service-packages/{id}` | Get package |

---

## Notes

- All public endpoints return **active items only**
- Inactive products, brands, categories, service types, or packages return 404
- Promotions are automatically calculated and included in product responses
- Slug detection: if identifier parses as UUID, it's treated as ID; otherwise as slug
- Property filters: use `properties[Name]=Value` format, only works with `is_filter=true` properties
- Multiple property filters use AND logic (all must match)
- Pagination defaults: `limit=50`, `offset=0`, max `limit=100`
- Service types support slug lookup, service packages use UUID only
