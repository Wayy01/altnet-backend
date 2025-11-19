# Admin Intelect

CMS Dashboard for Ultra B2B product data management. Built with Next.js 14, TypeScript, Tailwind CSS, and shadcn/ui.

## Features

- **Dashboard** - Real-time statistics, low stock alerts, recent sync activity
- **Products Management** - Full CRUD, bulk operations, CSV export, status toggles
- **Brands Management** - List, edit, toggle active/inactive, delete with confirmation
- **Categories** - Hierarchical tree view with status toggles and actions
- **Product Details** - Properties, characteristics, prices, and stock information
- **Sync Management** - Live sync logs with pagination, refresh, and status history
- **Bulk Operations** - Select multiple items to activate/deactivate/delete
- **Export** - Download filtered product data as CSV
- **Notifications** - Toast feedback for all actions
- **Confirmations** - Dialogs for destructive actions
- **Dark/Light Mode** - Full theme support
- **Global Currency Selector** - Switch between MDL, EUR, USD with localStorage persistence
- **Product Variant Selector** - Two-level selector for color and memory variants:
  - Color selection (e.g., Jet Black, Blue Shadow, Silver Shadow)
  - Memory options filtered by selected color (e.g., 256GB, 512GB, 1TB)
  - Parses variant info from product names automatically
  - Stock indicators and pricing per variant

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** components
- **Lucide Icons**
- **bun** package manager

## Prerequisites

- Node.js 18+ or Bun
- Go backend running at `http://localhost:8080`

## Getting Started

1. **Install dependencies**:
   ```bash
   bun install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` to set your API URL if needed.

3. **Start the Go backend**:
   ```bash
   # In the parent directory
   go run cmd/unified-api/main.go
   ```

4. **Start the development server**:
   ```bash
   bun dev
   ```

5. **Open in browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
admin-intelect/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── page.tsx           # Dashboard
│   │   ├── products/          # Products pages
│   │   ├── brands/            # Brands page
│   │   ├── categories/        # Categories page
│   │   ├── sync/              # Sync status page
│   │   └── settings/          # Settings page
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   ├── providers/         # Context providers
│   │   ├── products/          # Product-specific components
│   │   ├── app-sidebar.tsx    # Navigation sidebar
│   │   ├── header.tsx         # Page header with breadcrumbs
│   │   ├── theme-toggle.tsx   # Dark/light mode toggle
│   │   └── variant-selector.tsx # Two-level color/memory variant selector
│   ├── contexts/
│   │   └── currency-context.tsx # Global currency state with localStorage
│   ├── lib/
│   │   ├── api.ts             # API client for Go backend
│   │   └── utils.ts           # Utility functions
│   ├── types/
│   │   └── index.ts           # TypeScript type definitions
│   └── hooks/                 # Custom React hooks
├── .env.local                 # Environment variables
├── .env.example               # Example environment file
└── components.json            # shadcn/ui configuration
```

## API Integration

The dashboard connects to the Go backend API at `http://localhost:8080` (configurable via `NEXT_PUBLIC_API_URL`).

### Core Endpoints

- `GET /api/v1/products` - List products with filters
- `GET /api/v1/products/{id}` - Get product details
- `PUT /api/v1/products/{id}` - Update product
- `DELETE /api/v1/products/{id}` - Soft delete product
- `GET /api/v1/brands` - List brands
- `PUT /api/v1/brands/{id}` - Update brand
- `GET /api/v1/categories` - List categories
- `PUT /api/v1/categories/{id}` - Update category
- `GET /api/v1/search?q=query` - Search products

### Dashboard & Management Endpoints

- `GET /api/v1/dashboard/stats` - Dashboard statistics
- `GET /api/v1/sync/logs` - Sync logs with pagination
- `GET /api/v1/sync/status` - Latest sync status
- `PATCH /api/v1/products/bulk` - Bulk update products
- `DELETE /api/v1/products/bulk` - Bulk delete products
- `GET /api/v1/export/products?format=csv` - Export products

## Development

### Adding shadcn components

```bash
bunx shadcn@latest add [component-name]
```

### Building for production

```bash
bun run build
bun start
```

### Type checking

```bash
bun run lint
```

## Data Models

### Product
- Basic info: code, article, name, description
- Relations: brand, category
- Media: images, barcodes
- Pricing: price_min, price_max
- Inventory: total_stock

### Property
- Technical specifications
- Grouped by group_name
- Filterable flag

### Characteristic
- Product variants/SKUs
- Individual prices (multi-currency)
- Stock levels (warehouse, showroom)

## Recent Updates (Nov 2025)

- ✅ Real-time sync status from backend
- ✅ Product/brand/category editing capabilities
- ✅ Bulk operations (activate/deactivate/delete)
- ✅ CSV export functionality
- ✅ Toast notifications and confirmation dialogs
- ✅ Status toggles for products, brands, categories
- ✅ Low stock alerts on dashboard
- ✅ Global currency selector (MDL, EUR, USD) with localStorage persistence
- ✅ Multi-currency pricing support (price_mdl, price_eur, price_usd)
- ✅ Two-level product variant selector (color + memory) with automatic name parsing

## Future Enhancements

- User authentication
- Advanced filtering and sorting
- Real-time updates via WebSocket
- Image upload and management

## License

MIT
