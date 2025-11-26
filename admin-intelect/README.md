# Admin Intelect

CMS Dashboard for Ultra B2B product data management. Built with Next.js 14, TypeScript, and shadcn/ui.

## Features

- **Dashboard** - Statistics, low stock alerts, recent sync activity
- **Products** - Full CRUD, bulk operations, CSV export
- **Brands** - Search across 1,133 brands, edit, toggle status
- **Categories** - Hierarchical tree view with status management
- **Properties** - 3-level hierarchy (Groups → Names → Values)
- **Groupings** - Product variant relationships (Parent → Variants)
- **Sync** - Live monitoring with SSE streaming, configs, change history
- **Multi-Currency** - MDL, EUR, USD with global selector
- **Dark/Light Mode** - Full theme support

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Bun

## Quick Start

```bash
# Prerequisites: Go backend running at localhost:8080

# Install
bun install

# Configure (optional)
cp .env.example .env.local

# Run
bun dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                    # Pages (dashboard, products, brands, etc.)
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── app-sidebar.tsx     # Navigation
│   └── header.tsx          # Page header
├── contexts/
│   └── currency-context.tsx # Global currency state
├── lib/
│   ├── api.ts              # API client
│   └── utils.ts            # Utilities
└── types/                  # TypeScript definitions
```

## Pages

- `/` - Dashboard with stats
- `/products` - Product management
- `/brands` - Brand management
- `/categories` - Category hierarchy
- `/properties` - Property hierarchy
- `/groupings` - Product groupings
- `/sync` - Sync overview
- `/sync/selective` - Selective sync
- `/sync/configs` - Sync configurations
- `/sync/changes` - Change history
- `/sync/monitor` - Real-time monitor
- `/settings` - Settings

## Development

```bash
# Add shadcn component
bunx shadcn@latest add [component]

# Build
bun run build

# Lint
bun run lint
```

## License

MIT
