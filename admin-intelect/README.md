# Admin Intelect

CMS Dashboard for Ultra B2B product data management. Built with Next.js 14, TypeScript, Tailwind CSS, and shadcn/ui.

## Features

- **Dashboard** - Overview statistics of products, brands, categories, and more
- **Products Management** - List, search, filter, and view product details
- **Brands Management** - View all brands with logos and product counts
- **Categories** - Hierarchical tree view of product categories
- **Product Details** - Properties, characteristics, prices, and stock information
- **Sync Status** - View synchronization history (placeholder)
- **Dark/Light Mode** - Full theme support

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
│   │   └── theme-toggle.tsx   # Dark/light mode toggle
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

### Available Endpoints

- `GET /api/v1/products` - List products with filters
- `GET /api/v1/products/{id}` - Get product details
- `GET /api/v1/products/{id}/properties` - Get product properties
- `GET /api/v1/products/{id}/characteristics` - Get product variants
- `GET /api/v1/brands` - List brands
- `GET /api/v1/categories` - List categories
- `GET /api/v1/search?q=query` - Search products

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

## Future Enhancements

- Real-time sync status from backend
- Product editing capabilities
- Bulk operations
- Advanced filtering and sorting
- Export functionality
- User authentication

## License

MIT
