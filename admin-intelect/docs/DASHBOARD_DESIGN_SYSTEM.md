# Dashboard Design System

**Ultra B2B Admin Dashboard - Premium Design Documentation**

This document provides a comprehensive overview of the design patterns, visual hierarchy, animation systems, and implementation guidelines used in the Ultra B2B admin dashboard. Following these patterns ensures consistency, premium aesthetics, and exceptional user experience across all pages.

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Translation System](#translation-system)
3. [Layout Structure](#layout-structure)
4. [Color Hierarchy System](#color-hierarchy-system)
5. [Component Patterns](#component-patterns)
6. [Typography System](#typography-system)
7. [Spacing & Rhythm](#spacing--rhythm)
8. [Animation & Transitions](#animation--transitions)
9. [Interactive States](#interactive-states)
10. [Responsive Design](#responsive-design)
11. [Code Examples](#code-examples)

---

## Design Philosophy

The dashboard design follows three core principles:

### 1. **Subtle Sophistication**
- Premium design is never loud or garish
- Refined animations and elegant transitions
- Tasteful effects that enhance rather than distract

### 2. **Visual Hierarchy Through Color**
- 4-tier color system to communicate importance
- Strategic use of gradients only for hero elements
- Consistent application of variant patterns

### 3. **Performance First**
- Hardware-accelerated animations (transform, opacity)
- Staggered entrance animations with precise timing
- Respect for `prefers-reduced-motion`

---

## Translation System

**Critical Rule: NO HARDCODED TEXT**

All user-facing text in the dashboard MUST use translation keys. This ensures the application can be localized to multiple languages (currently supporting English, Russian, and Romanian).

### Core Principles

1. **Zero Hardcoded Strings**: Every piece of user-facing text must use translation functions
2. **Complete Coverage**: All languages must have identical key structures
3. **Meaningful Keys**: Use descriptive, hierarchical translation keys
4. **Consistency**: Follow existing patterns when adding new keys

### Translation File Structure

Translation files are organized by page/feature under `/admin-intelect/src/locales/{lang}/{feature}.json`:

```
src/locales/
├── en/
│   ├── common.json       # Shared translations (buttons, actions, pagination)
│   ├── products.json     # Products page
│   ├── brands.json       # Brands page
│   ├── categories.json   # Categories page
│   ├── properties.json   # Properties page
│   ├── sync.json         # Sync pages
│   ├── translate.json    # Translation jobs
│   ├── dashboard.json    # Dashboard
│   ├── navigation.json   # Navigation items
│   └── settings.json     # Settings
├── ru/ (same structure)
└── ro/ (same structure)
```

### Using Translations in Components

**Import and Setup:**
```tsx
import { useTranslation } from "@/contexts/language-context";

export default function MyPage() {
  const { t } = useTranslation("products");  // Namespace: "products"
  const { t: tCommon } = useTranslation("common");  // For shared translations

  return (
    <div>
      <h1>{t("page.title")}</h1>
      <p>{t("page.description")}</p>
      <Button>{tCommon("actions.save")}</Button>
    </div>
  );
}
```

**With Interpolation (Dynamic Values):**
```tsx
// Translation key: "Selected {{count}} products"
<p>{t("bulk.selectedPlural", { count: selectedIds.size })}</p>

// Translation key: "Editing \"{{name}}\""
<h2>{t("page.editingProduct", { name: product.name })}</h2>
```

**Conditional Translations (Singular/Plural):**
```tsx
// Use separate keys for singular and plural
<span>
  {selectedIds.size === 1
    ? t("bulk.selected", { count: selectedIds.size })
    : t("bulk.selectedPlural", { count: selectedIds.size })
  }
</span>

// Or use ternary for simple cases
<span>
  {activeFilters.length} {activeFilters.length === 1 ? t("filters.activeFilter") : t("filters.activeFilters")}
</span>
```

### Translation Key Naming Conventions

**Hierarchical Structure:**
```json
{
  "page": {
    "title": "Products",
    "description": "Manage and view all products"
  },
  "stats": {
    "total": "Total",
    "inStock": "In Stock"
  },
  "table": {
    "name": "Name",
    "code": "Code"
  },
  "filters": {
    "searchProducts": "Search products...",
    "allBrands": "All brands"
  },
  "actions": {
    "save": "Save",
    "delete": "Delete"
  },
  "toast": {
    "created": "Product created successfully",
    "deleted": "Product deleted successfully"
  }
}
```

**Key Categories:**

| Category | Purpose | Example Keys |
|----------|---------|--------------|
| `page` | Page titles, descriptions, headers | `page.title`, `page.description` |
| `stats` | Statistical labels and metrics | `stats.total`, `stats.inStock` |
| `table` | Table column headers | `table.name`, `table.price` |
| `filters` | Filter labels and options | `filters.allBrands`, `filters.inStock` |
| `actions` | Button labels and action text | `actions.save`, `actions.delete` |
| `toast` | Success/error notifications | `toast.created`, `toast.deleteFailed` |
| `empty` | Empty state messages | `empty.title`, `empty.description` |
| `bulk` | Bulk action messages | `bulk.selected`, `bulk.allMatching` |
| `badges` | Badge and status labels | `badges.noPrice`, `badges.outOfStock` |
| `dialogs` | Dialog titles and descriptions | `dialogs.deleteTitle` |
| `form` | Form field labels and hints | `form.productName`, `form.nameHint` |

### Adding New Translation Keys

**Step 1: Identify the Text**
- Review your component for any hardcoded strings
- Look for: headers, labels, placeholders, button text, messages, tooltips

**Step 2: Choose Appropriate Namespace**
- Use `common.json` for shared text (buttons like "Save", "Cancel", "Delete")
- Use feature-specific files for feature text (e.g., `products.json` for product-specific text)

**Step 3: Add Keys to ALL Language Files**

You MUST add keys to all three language files simultaneously:

```bash
# English
/admin-intelect/src/locales/en/products.json

# Russian
/admin-intelect/src/locales/ru/products.json

# Romanian
/admin-intelect/src/locales/ro/products.json
```

**Example: Adding Filter Section Headers**

**English (`en/products.json`):**
```json
{
  "filters": {
    "catalogFilters": "Catalog Filters",
    "attributesSorting": "Attributes & Sorting"
  }
}
```

**Russian (`ru/products.json`):**
```json
{
  "filters": {
    "catalogFilters": "Фильтры каталога",
    "attributesSorting": "Атрибуты и сортировка"
  }
}
```

**Romanian (`ro/products.json`):**
```json
{
  "filters": {
    "catalogFilters": "Filtre catalog",
    "attributesSorting": "Atribute si sortare"
  }
}
```

**Step 4: Replace Hardcoded Text**

Before:
```tsx
<h4 className="text-xs font-semibold">
  Catalog Filters
</h4>
```

After:
```tsx
<h4 className="text-xs font-semibold">
  {t("filters.catalogFilters")}
</h4>
```

### Common Translation Patterns

**Section Headers:**
```tsx
<h3 className="font-semibold text-sm">{t("section.recentSyncs")}</h3>
```

**Filter Dropdowns:**
```tsx
<Select>
  <SelectItem value="all">{t("filters.allBrands")}</SelectItem>
  <SelectItem value="with_price">{t("filters.withPrice")}</SelectItem>
</Select>
```

**Action Buttons:**
```tsx
<Button>{tCommon("actions.save")}</Button>
<Button variant="destructive">{tCommon("actions.delete")}</Button>
```

**Empty States:**
```tsx
<p className="text-sm font-semibold">{t("empty.title")}</p>
<p className="text-xs text-muted-foreground">{t("empty.description")}</p>
```

**Toast Notifications:**
```tsx
toast.success(t("toast.created"));
toast.error(t("toast.deleteFailed"));
```

**Placeholders:**
```tsx
<Input placeholder={t("filters.searchProducts")} />
```

**Table Headers:**
```tsx
<TableHead>{t("table.name")}</TableHead>
<TableHead>{t("table.price")}</TableHead>
```

### Translation Quality Checklist

Before committing code with new translations, verify:

- [ ] All user-facing text uses translation keys (zero hardcoded strings)
- [ ] Translation keys exist in ALL three language files (en, ru, ro)
- [ ] Keys follow the established hierarchical naming convention
- [ ] Russian translations are grammatically correct and natural
- [ ] Romanian translations are grammatically correct and natural
- [ ] Interpolation variables are correctly defined (e.g., `{{count}}`, `{{name}}`)
- [ ] Singular/plural forms are handled correctly
- [ ] Translations maintain consistent tone and terminology
- [ ] Keys are organized in the appropriate section (page, filters, actions, etc.)
- [ ] No duplicate keys exist in the JSON files

### Finding Hardcoded Text (Code Review Patterns)

**Common locations to check:**

```tsx
// ❌ BAD - Hardcoded text
<h1>Products</h1>
<Button>Export CSV</Button>
<p>No products found</p>
placeholder="Search products..."

// ✅ GOOD - Using translations
<h1>{t("page.title")}</h1>
<Button>{t("actions.exportCSV")}</Button>
<p>{t("empty.title")}</p>
placeholder={t("filters.searchProducts")}
```

**Search patterns to find hardcoded text:**
- String literals in JSX: `>Text<`, `="Text"`
- Common English words: "Search", "Filter", "Export", "Save", "Delete", "Edit"
- Section headers in UPPERCASE or Title Case
- Placeholder text with ellipsis: "Search...", "Select..."
- Error/success messages: "successfully", "failed", "error"

### Translation File Management

**File Size:**
- Keep feature-specific files focused (products.json for products page only)
- Move shared translations to common.json
- Split large files if they exceed 500 lines

**Key Organization:**
- Alphabetize top-level sections for easier navigation
- Group related keys together
- Use consistent indentation (2 spaces)

**Version Control:**
- Always update all three language files in the same commit
- Include translation changes in pull request descriptions
- Review translations with native speakers when possible

### Localized Values (Database Content)

For content that comes from the database (product names, descriptions, categories), use the `useLocalizedValue` hook:

```tsx
import { useLocalizedValue } from "@/contexts/language-context";

const { localize } = useLocalizedValue();

// Automatically selects name_ru, name_ro, or name based on current language
<p>{localize(product, "name")}</p>
<p>{localize(category, "description")}</p>
```

### Translation Migration Guide

**For existing pages without translations:**

1. **Audit the page** - List all hardcoded text
2. **Plan key structure** - Organize keys by category (page, filters, actions, etc.)
3. **Add to all three files** - Create identical key structures in en/ru/ro
4. **Translate** - Provide accurate Russian and Romanian translations
5. **Replace in code** - Update all hardcoded text to use `t()` function
6. **Test all languages** - Verify UI in English, Russian, and Romanian
7. **Review** - Check for missing keys or untranslated text

### Common Mistakes to Avoid

1. **Forgetting a language file** - Always update en, ru, AND ro
2. **Hardcoding plurals** - Use separate keys for singular/plural forms
3. **String concatenation** - Use interpolation instead: `t("key", { value })`
4. **Mixing namespaces** - Don't put product-specific keys in common.json
5. **Inconsistent keys** - Follow existing naming patterns
6. **Missing interpolation variables** - Define all `{{variables}}` used in translations
7. **Not testing** - Always verify translations render correctly in all languages
8. **Using generic keys** - Use descriptive keys: `filters.catalogFilters` not `header1`

### Resources

**Translation Context Location:**
```
/admin-intelect/src/contexts/language-context.tsx
```

**Translation Files Location:**
```
/admin-intelect/src/locales/{en|ru|ro}/{feature}.json
```

**Supported Languages:**
- `en` - English (default)
- `ru` - Russian (Русский)
- `ro` - Romanian (Română)

---

## Layout Structure

### Grid System

The dashboard uses a responsive grid that adapts across breakpoints:

```tsx
// Main stat cards grid
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {/* Cards */}
</div>

// Three-column section grid
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {/* Sections */}
</div>

// Price distribution grid
<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
  {/* Price cards */}
</div>
```

**Breakpoint Behavior:**
- **Mobile (default)**: 1 column, full width
- **md (768px+)**: 2 columns
- **lg (1024px+)**: 3-4 columns depending on content

**Gap Values:**
- Primary sections: `gap-4` (1rem / 16px)
- Nested grids: `gap-3` (0.75rem / 12px)
- Tight groupings: `gap-2` (0.5rem / 8px)

### Section Hierarchy

**Page Structure:**
```
1. Page Header (h1 + description + actions)
2. Stat Cards Grid (9 cards in 4-tier hierarchy)
3. Three-Column Section (Recent Syncs | Alerts | Categories)
4. Price Distribution Widget
```

**Spacing Between Sections:**
- Use `space-y-4` for vertical spacing between major sections
- Each section is self-contained with consistent padding

---

## Color Hierarchy System

The dashboard implements a **4-tier color hierarchy** to communicate information priority at a glance. This system is crucial for creating visual order and guiding user attention.

### Theme Color Variables

From `globals.css`:

```css
/* Light Mode */
--primary: 222 75% 17%       /* Deep navy blue */
--chart-3: 222 45% 50%       /* Medium blue */
--chart-5: 200 60% 45%       /* Teal accent */
--muted: 222 20% 96%         /* Light gray background */
--destructive: 0 84.2% 60.2% /* Alert red */
--border: 222 20% 90%        /* Default border */

/* Dark Mode */
--primary: 222 75% 45%       /* Brighter blue */
--chart-3: 200 70% 50%       /* Cyan */
--muted: 222 30% 15%         /* Dark background */
--destructive: 0 62.8% 30.6% /* Darker red */
```

### Tier 1: Hero Metrics (Primary)

**Purpose**: Most important, business-critical metrics
**Visual Treatment**: Bold primary color with gradient background
**Usage**: Total Products, Brands, Variant Groups

**Styling Pattern:**
```tsx
variant="hero"

// Applied styles:
borderColor: "border-primary/20"
hoverBorderColor: "hover:border-primary/40"
iconBgColor: "bg-primary/10"
iconColor: "text-primary"
gradientBg: "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent"
```

**CSS Classes:**
- Border: `border-primary/20`
- Hover: `hover:border-primary/40`
- Gradient: `bg-gradient-to-br from-primary/10 via-primary/5 to-transparent`
- Icon background: `bg-primary/10`
- Icon color: `text-primary`

### Tier 2: Important Metrics (Chart-3)

**Purpose**: High-priority operational metrics
**Visual Treatment**: Accent color without gradient
**Usage**: Categories, In Stock

**Styling Pattern:**
```tsx
variant="important"

// Applied styles:
borderColor: "border-chart-3/20"
hoverBorderColor: "hover:border-chart-3/40"
iconBgColor: "bg-chart-3/10"
iconColor: "text-chart-3"
```

**CSS Classes:**
- Border: `border-chart-3/20`
- Hover: `hover:border-chart-3/40`
- Icon background: `bg-chart-3/10`
- Icon color: `text-chart-3`

### Tier 3: Contextual Metrics (Muted)

**Purpose**: Supporting information, reference data
**Visual Treatment**: Neutral, subdued appearance
**Usage**: Properties, Prices, Stock Entries

**Styling Pattern:**
```tsx
variant="contextual"

// Applied styles:
borderColor: "border-border"
hoverBorderColor: "hover:border-border"
iconBgColor: "bg-muted"
iconColor: "text-muted-foreground"
```

**CSS Classes:**
- Border: `border-border`
- Hover: `hover:border-border` (subtle)
- Icon background: `bg-muted`
- Icon color: `text-muted-foreground`

### Tier 4: Alert Metrics (Destructive)

**Purpose**: Warnings, issues requiring attention
**Visual Treatment**: Red/destructive color scheme
**Usage**: Low Stock Alerts

**Styling Pattern:**
```tsx
variant="alert"

// Applied styles:
borderColor: "border-destructive/20"
hoverBorderColor: "hover:border-destructive/40"
iconBgColor: "bg-destructive/10"
iconColor: "text-destructive"
```

**CSS Classes:**
- Border: `border-destructive/20`
- Hover: `hover:border-destructive/40`
- Icon background: `bg-destructive/10`
- Icon color: `text-destructive`

---

## Component Patterns

### StatCard Component

The `StatCard` is the primary dashboard component, featuring premium hover effects and the 4-tier color system.

**File**: `/admin-intelect/src/components/dashboard/stat-card.tsx`

**Props Interface:**
```tsx
interface StatCardProps {
  title: string;              // Card title
  value: string | number;     // Main metric value
  description: string;        // Supporting text
  icon: LucideIcon;           // Icon component
  variant?: StatCardVariant;  // "hero" | "important" | "contextual" | "alert"
  link?: string;              // Optional click target
  badge?: {                   // Optional badge
    label: string;
    variant?: "default" | "destructive" | "secondary" | "outline";
  };
  trend?: {                   // Optional trend indicator
    value: number;
    isPositive: boolean;
  };
  className?: string;
  animationDelay?: number;    // Stagger animation delay in ms
  isVisible?: boolean;        // Controls entrance animation
}
```

**Key Features:**
1. **Gradient Background** (hero variant only)
2. **Icon Scaling** on hover: `group-hover:scale-110`
3. **Card Elevation** on hover: `hover:shadow-lg hover:-translate-y-1 hover:scale-[1.02]`
4. **Staggered Entrance**: Controlled by `animationDelay` and `isVisible`

**Usage Example:**
```tsx
<StatCard
  title="Total Products"
  value="47,234"
  description="Products in catalog"
  icon={Package}
  variant="hero"
  link="/products"
  animationDelay={0}
  isVisible={true}
/>
```

### Card Section Pattern

Standard pattern for dashboard sections (Recent Syncs, Alerts, Categories):

**Structure:**
```tsx
<div className="rounded-xl border bg-card shadow-sm overflow-hidden transition-all duration-300">
  {/* Header */}
  <div className="p-4 border-b">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-sm">Section Title</h3>
      </div>
      <Button variant="ghost" size="sm" asChild>
        <Link href="/path">View All</Link>
      </Button>
    </div>
  </div>

  {/* Content */}
  <div className="p-3">
    {/* Section content */}
  </div>
</div>
```

**Visual Elements:**
- **Border Radius**: `rounded-xl` (0.75rem)
- **Border**: `border` (default theme border)
- **Background**: `bg-card` (theme-aware)
- **Shadow**: `shadow-sm` (subtle elevation)
- **Header Padding**: `p-4`
- **Content Padding**: `p-3`
- **Header Border**: `border-b` (separator)

### Empty State Pattern

Consistent empty state design across all sections:

```tsx
<div className="flex flex-col items-center justify-center py-6">
  <div className="p-2.5 rounded-full bg-muted/50 mb-2">
    <Icon className="h-5 w-5 text-muted-foreground/50" />
  </div>
  <p className="text-xs text-muted-foreground">
    No data available.
  </p>
</div>
```

**Key Elements:**
- **Vertical Padding**: `py-6`
- **Icon Container**: `p-2.5 rounded-full bg-muted/50`
- **Icon Size**: `h-5 w-5`
- **Icon Color**: `text-muted-foreground/50` (extra muted)
- **Text Size**: `text-xs`

---

## Typography System

### Font Hierarchy

The dashboard uses a clear typographic scale:

| Element | Class | Size | Weight | Color |
|---------|-------|------|--------|-------|
| Page Title | `text-3xl font-bold tracking-tight` | 1.875rem (30px) | 700 | `text-foreground` |
| Page Description | `text-sm text-muted-foreground` | 0.875rem (14px) | 400 | `text-muted-foreground` |
| Section Title | `font-semibold text-sm` | 0.875rem (14px) | 600 | `text-foreground` |
| Stat Value | `text-2xl font-bold tabular-nums tracking-tight` | 1.5rem (24px) | 700 | `text-foreground` |
| Stat Label | `text-sm font-medium text-muted-foreground` | 0.875rem (14px) | 500 | `text-muted-foreground` |
| Stat Description | `text-xs text-muted-foreground leading-relaxed` | 0.75rem (12px) | 400 | `text-muted-foreground` |
| Body Text | `text-xs` | 0.75rem (12px) | 400 | `text-foreground` |
| Metadata | `text-xs text-muted-foreground` | 0.75rem (12px) | 400 | `text-muted-foreground` |

### Font Features

**Tabular Numbers**: Always use `tabular-nums` for numeric values to ensure consistent width:
```tsx
<span className="text-2xl font-bold tabular-nums">47,234</span>
```

**Tracking**: Use `tracking-tight` for large headings to improve readability:
```tsx
<h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
```

**Line Clamp**: Truncate long text with ellipsis:
```tsx
<p className="text-xs line-clamp-1">Long product name...</p>
```

---

## Spacing & Rhythm

### Padding Scale

Consistent padding throughout the dashboard:

| Class | Value | Usage |
|-------|-------|-------|
| `p-5` | 1.25rem (20px) | StatCard content |
| `p-4` | 1rem (16px) | Section headers |
| `p-3` | 0.75rem (12px) | Section content, nested cards |
| `p-2.5` | 0.625rem (10px) | List items, small cards |
| `p-2` | 0.5rem (8px) | Icon containers |
| `p-1.5` | 0.375rem (6px) | Small icon containers |

### Gap Scale

Spacing between elements:

| Class | Value | Usage |
|-------|-------|-------|
| `gap-4` | 1rem (16px) | Main grid, section spacing |
| `gap-3` | 0.75rem (12px) | Sub-grids, card groups |
| `gap-2.5` | 0.625rem (10px) | List items |
| `gap-2` | 0.5rem (8px) | Icon + text pairs |
| `gap-1.5` | 0.375rem (6px) | Tight groupings |

### Margin Patterns

**Bottom Margin** (spacing within cards):
- Title/Label: `mb-2.5` (10px)
- Value: `mb-1.5` (6px)
- Icon: `mb-2` (8px)

**Right Margin** (inline elements):
- Icon before text: `mr-2` (8px)
- Small icon before text: `mr-1` (4px)

---

## Animation & Transitions

### Entrance Animations

The dashboard uses staggered entrance animations for a premium feel:

**Stagger Timing:**
```tsx
// StatCards: 30ms delay per card, max 300ms
animationDelay={Math.min(index * 30, 300)}

// Sections: Fixed delays
Recent Syncs: 350ms
Low Stock: 400ms
Top Categories: 450ms
Price Distribution: 500ms
```

**Animation Classes:**
```tsx
className={`
  transition-all duration-300
  ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
`}
style={{ transitionDelay: isVisible ? `${delay}ms` : "0ms" }}
```

### Hover Transitions

**StatCard Hover** (when clickable):
```tsx
className="hover:shadow-lg hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 ease-out"
```

**Button Hover**:
```tsx
className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
```

**Card Item Hover**:
```tsx
className="transition-all duration-200 hover:bg-muted/50"
```

**Icon Hover** (within StatCard):
```tsx
className="transition-all duration-300 group-hover:scale-110"
```

### Transition Durations

| Duration | Usage |
|----------|-------|
| `150ms` | Fast interactions (button press, checkbox) |
| `200ms` | Standard interactions (hover states) |
| `300ms` | Smooth transitions (card entrance, scale) |
| `500ms` | Slow animations (drawer open, modal) |

### Performance Optimization

**Always use transform and opacity** for smooth 60fps animations:
```tsx
// GOOD (GPU-accelerated)
className="transition-all duration-300 hover:translate-y-0 hover:opacity-100"

// BAD (causes reflow)
className="transition-all duration-300 hover:margin-top-0 hover:display-block"
```

**Accessibility: Reduced Motion**
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
```

---

## Interactive States

### Focus States

All interactive elements must have visible focus states for keyboard navigation:

**Button Focus**:
```tsx
className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
```

**Link Focus**:
```tsx
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
```

### Hover States

**StatCard with Link**:
- Border: Increases opacity from `/20` to `/40`
- Shadow: `shadow-sm` → `shadow-lg`
- Transform: `-translate-y-1 scale-[1.02]`
- Icon: `scale-110`

**Button Variants**:

**Outline Button**:
```tsx
className="hover:bg-accent hover:text-accent-foreground"
```

**Destructive Action** (Alerts button):
```tsx
className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
```

**Primary Action**:
```tsx
className="hover:bg-primary/10 hover:text-primary"
```

### Active States

**Card Item Active** (when clicked):
```tsx
className="active:scale-[0.98] transition-transform"
```

### Disabled States

**Disabled Button**:
```tsx
className="disabled:opacity-50 disabled:pointer-events-none"
```

---

## Responsive Design

### Breakpoint Strategy

The dashboard follows a **mobile-first** approach:

**Breakpoints:**
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

### Layout Adjustments

**Header Section**:
```tsx
// Mobile: Stack vertically
// md+: Horizontal layout
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
```

**Stat Cards Grid**:
```tsx
// Mobile: 1 column
// md: 2 columns
// lg: 3 columns
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
```

**Price Distribution**:
```tsx
// Mobile: 1 column
// md: 2 columns
// lg: 4 columns
<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
```

### Touch-Friendly Interactions

**Minimum Touch Target**: 44x44px (per WCAG AA)

**Button Sizes**:
```tsx
// Small: h-7 (28px) - Desktop only
// Default: h-9 (36px)
// Large: h-10 (40px) - Recommended for touch
```

### Text Truncation

**Single Line**:
```tsx
<p className="text-xs line-clamp-1">Long text...</p>
```

**Multiple Lines**:
```tsx
<p className="text-sm line-clamp-2">Longer description...</p>
```

---

## Code Examples

### Complete StatCard Implementation

```tsx
import { StatCard } from "@/components/dashboard/stat-card";
import { Package } from "lucide-react";

<StatCard
  title={t("stats.totalProducts")}
  value={(stats.total_products ?? 0).toLocaleString()}
  icon={Package}
  description={t("descriptions.productsInCatalog")}
  variant="hero"
  link="/products"
  animationDelay={0}
  isVisible={cardsVisible}
/>
```

### Section with Header and Actions

```tsx
<div className="rounded-xl border bg-card shadow-sm overflow-hidden">
  <div className="p-4 border-b">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-muted">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-sm">{t("cards.recentSyncs")}</h3>
      </div>
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="text-xs transition-all duration-200 hover:bg-primary/10 hover:text-primary h-7"
      >
        <Link href="/sync">
          {tCommon("actions.viewAll")}
          <ExternalLink className="ml-1 h-3 w-3" />
        </Link>
      </Button>
    </div>
  </div>
  <div className="p-3">
    {/* Content */}
  </div>
</div>
```

### List Item with Hover Effect

```tsx
<Link
  href={`/products/${product.id}`}
  className="flex items-center justify-between p-2.5 rounded-lg border transition-all duration-200 hover:bg-muted/50"
>
  <div className="min-w-0 flex-1">
    <p className="text-xs font-medium line-clamp-1">
      {product.name}
    </p>
    <p className="text-xs text-muted-foreground">
      {product.code}
    </p>
  </div>
  <Badge variant="secondary" className="ml-2 shrink-0 text-xs">
    {product.stock}
  </Badge>
</Link>
```

### Empty State

```tsx
{items.length === 0 ? (
  <div className="flex flex-col items-center justify-center py-6">
    <div className="p-2.5 rounded-full bg-muted/50 mb-2">
      <Icon className="h-5 w-5 text-muted-foreground/50" />
    </div>
    <p className="text-xs text-muted-foreground">
      {t("messages.noData")}
    </p>
  </div>
) : (
  <div className="space-y-2">
    {/* List items */}
  </div>
)}
```

### Badge Variants

```tsx
// Success/Healthy
<Badge
  variant="default"
  className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
>
  Healthy
</Badge>

// Error/Alert
<Badge
  variant="destructive"
  className="bg-destructive/10 text-destructive border-destructive/20"
>
  {alertCount}
</Badge>

// Neutral
<Badge variant="secondary" className="text-xs">
  {count}
</Badge>
```

### Staggered Animation Setup

```tsx
const [cardsVisible, setCardsVisible] = useState(false);

useEffect(() => {
  // Trigger animation after data loads
  setTimeout(() => setCardsVisible(true), 50);
}, [data]);

// In render:
<div
  className={`
    transition-all duration-300
    ${cardsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
  `}
  style={{ transitionDelay: cardsVisible ? `${350}ms` : "0ms" }}
>
  {/* Content */}
</div>
```

---

## Design Principles Summary

### Do's

1. **Use the 4-tier color hierarchy** to communicate importance
2. **Apply staggered animations** for entrance effects (30ms per item)
3. **Use tabular-nums** for all numeric values
4. **Provide empty states** for all dynamic content sections
5. **Use consistent padding** (p-5 for cards, p-4 for headers, p-3 for content)
6. **Apply hover effects** to all interactive elements
7. **Use rounded-xl** for card borders (12px radius)
8. **Include focus states** for keyboard navigation
9. **Keep transitions under 500ms** for responsiveness
10. **Test in both light and dark modes**

### Don'ts

1. **Don't hardcode text** - ALWAYS use translation functions (`t()`) for ALL user-facing text
2. **Don't forget all language files** - Update en, ru, AND ro simultaneously
3. **Don't use gradients** outside of hero variant cards
4. **Don't animate layout properties** (use transform/opacity only)
5. **Don't mix gap scales** within the same section (stick to gap-4 or gap-3)
6. **Don't skip loading states** - provide skeleton loaders
7. **Don't use arbitrary colors** - stick to theme tokens
8. **Don't forget reduced-motion** preferences
9. **Don't make touch targets smaller than 44x44px**
10. **Don't use border-radius less than 0.5rem** for consistency
11. **Don't add animations without purpose**

---

## Performance Checklist

- [ ] All animations use `transform` and `opacity` only
- [ ] Stagger delays are capped at 500ms
- [ ] Images are optimized and lazy-loaded
- [ ] Translation strings are pre-loaded
- [ ] API calls are cached where appropriate
- [ ] Skeleton loaders shown during data fetch
- [ ] Reduced-motion preference is respected
- [ ] Component re-renders are minimized
- [ ] Large lists use virtualization (if >100 items)
- [ ] Fonts are loaded with `font-display: swap`

---

## Accessibility Checklist

- [ ] Focus states are visible on all interactive elements
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] Touch targets are at least 44x44px
- [ ] Animations respect `prefers-reduced-motion`
- [ ] Alt text provided for all images
- [ ] Semantic HTML used (h1, h2, nav, etc.)
- [ ] ARIA labels for icon-only buttons
- [ ] Keyboard navigation works throughout
- [ ] Screen reader announcements for dynamic content
- [ ] Error messages are descriptive and actionable

---

## Conclusion

This design system creates a cohesive, premium dashboard experience through:

- **Visual hierarchy** via the 4-tier color system
- **Smooth interactions** with hardware-accelerated animations
- **Consistent patterns** for cards, sections, and empty states
- **Responsive layouts** that work across all devices
- **Performance optimization** for 60fps interactions

By following these guidelines, developers can create new pages and components that seamlessly integrate with the existing dashboard, maintaining the high-quality aesthetic and user experience that defines the Ultra B2B admin interface.

---

**Version**: 1.0
**Last Updated**: 2025-12-03
**Maintained By**: Ultra B2B Development Team
