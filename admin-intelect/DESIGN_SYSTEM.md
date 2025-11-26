# Intelect Admin Dashboard Design System

A comprehensive guide to creating premium, polished interfaces in the Intelect Admin Dashboard. This document establishes patterns and standards for consistency across all pages.

## Table of Contents

1. [Design Principles](#design-principles)
2. [Layout Patterns](#layout-patterns)
3. [Typography](#typography)
4. [Color Usage](#color-usage)
5. [Spacing System](#spacing-system)
6. [Component Styling Standards](#component-styling-standards)
7. [Animation Guidelines](#animation-guidelines)
8. [Filter UI Patterns](#filter-ui-patterns)
9. [Pagination Standards](#pagination-standards)
10. [Loading States](#loading-states)
11. [Empty States](#empty-states)
12. [Code Examples](#code-examples)

---

## Design Principles

### Core Philosophy

1. **Subtle Sophistication**: Premium design is never loud. Use refined animations, elegant transitions, and tasteful effects that enhance rather than distract.

2. **Purposeful Motion**: Every animation serves a purpose - providing feedback, guiding attention, or improving comprehension. Motion should feel natural.

3. **Attention to Detail**: The premium feel comes from obsessive attention to spacing, alignment, typography, shadows, and visual hierarchy.

4. **Performance First**: Beautiful interfaces must be performant. Use CSS transforms and opacity for animations, ensure 60fps interactions.

### Visual Hierarchy

- Use font weight and size to establish importance
- Apply subtle shadows for depth and elevation
- Employ color strategically for status and actions
- Create visual rhythm with consistent spacing

---

## Layout Patterns

### Standard Page Structure

```tsx
<div className="space-y-6">
  {/* Page Header */}
  <div>
    <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
    <p className="text-muted-foreground">{description}</p>
  </div>

  {/* Content Area */}
  <div className="space-y-4">
    {/* Stats Bar */}
    {/* Filter Bar */}
    {/* Active Filters */}
    {/* Bulk Actions (conditional) */}
    {/* Main Content (table/grid) */}
    {/* Pagination */}
  </div>
</div>
```

### Spacing Values

| Gap | Value | Use Case |
|-----|-------|----------|
| `space-y-6` | 1.5rem | Between major page sections |
| `space-y-4` | 1rem | Between content sections |
| `gap-4` | 1rem | Filter dropdowns, form elements |
| `gap-3` | 0.75rem | Stats indicators, filter chips |
| `gap-2` | 0.5rem | Icon + label pairs, button groups |
| `gap-1.5` | 0.375rem | Tight element groups |

### Container Styling

```tsx
// Standard card container
className="rounded-xl border bg-card shadow-sm"

// Elevated filter bar
className="flex flex-wrap items-center gap-3 p-4 rounded-xl border bg-card/50 shadow-sm"

// Table container
className="rounded-xl border bg-card shadow-sm overflow-hidden"
```

---

## Typography

### Headings

```tsx
// Page title
<h1 className="text-3xl font-bold tracking-tight">Page Title</h1>

// Page description
<p className="text-muted-foreground">Description text here</p>

// Section headers
<h2 className="text-xl font-semibold">Section Title</h2>

// Card headers
<h3 className="text-lg font-medium">Card Title</h3>
```

### Body Text

```tsx
// Primary text
<span className="text-sm font-medium">Primary content</span>

// Secondary text
<span className="text-sm text-muted-foreground">Secondary content</span>

// Small labels
<span className="text-xs font-medium text-muted-foreground">Label</span>

// Tiny annotations
<span className="text-[10px] text-muted-foreground">(annotation)</span>

// Monospace (codes, IDs)
<span className="font-mono text-sm text-muted-foreground">ABC123</span>

// Tabular numbers (prices, counts)
<span className="text-sm font-semibold tabular-nums">1,234</span>
```

---

## Color Usage

### Semantic Colors

| Purpose | Class | Use Case |
|---------|-------|----------|
| Primary action | `text-primary`, `bg-primary` | Links, active states, CTAs |
| Success/positive | `bg-primary/10 text-primary border-primary/20` | In stock, active items |
| Warning/attention | `bg-destructive/10 text-destructive border-destructive/20` | Out of stock, warnings |
| Muted/neutral | `bg-muted/50`, `text-muted-foreground` | Disabled, secondary info |

### Hover States

```tsx
// Primary hover
className="hover:bg-primary/10 hover:text-primary hover:border-primary/30"

// Destructive hover
className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"

// Subtle hover
className="hover:bg-muted hover:shadow-sm hover:-translate-y-0.5"
```

### Status Indicators

```tsx
// Success variant (in stock, active)
<Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
  In Stock
</Badge>

// Warning variant (out of stock)
<Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20">
  Out of Stock
</Badge>

// Neutral variant (no data)
<Badge variant="outline" className="font-normal text-muted-foreground">
  No price
</Badge>
```

---

## Spacing System

### Padding

| Class | Value | Use Case |
|-------|-------|----------|
| `p-4` | 1rem | Container padding, filter bars |
| `p-3` | 0.75rem | Bulk action bars |
| `px-3 py-2` | 0.75rem / 0.5rem | Stats indicators |
| `px-2.5 py-1` | 0.625rem / 0.25rem | Filter chips |
| `p-1.5` | 0.375rem | Icon containers |
| `p-0.5` | 0.125rem | Tiny button padding |

### Margins

```tsx
// Auto margin for flex alignment
className="ml-auto"

// Icon spacing
className="mr-1.5" // Before text
className="ml-1"   // After text
```

---

## Component Styling Standards

### Stats Bar

```tsx
interface StatIndicator {
  label: string;
  value: number | string;
  suffix?: string;
  icon?: React.ReactNode;
  variant?: "default" | "success" | "warning" | "muted";
}

// Stats container
<div className="flex flex-wrap items-center gap-3">
  {statsIndicators.map((stat, index) => (
    <div
      key={stat.label}
      className={`
        inline-flex items-center gap-2 px-3 py-2 rounded-lg border
        transition-all duration-200 ease-out
        hover:shadow-sm hover:border-border/80 hover:-translate-y-0.5
        ${stat.variant === "success" ? "bg-primary/5 border-primary/20 hover:bg-primary/10" : ""}
        ${stat.variant === "warning" ? "bg-destructive/5 border-destructive/20 hover:bg-destructive/10" : ""}
        ${stat.variant === "default" || stat.variant === "muted" ? "bg-muted/50" : ""}
      `}
    >
      {stat.icon && <span className="text-muted-foreground">{stat.icon}</span>}
      <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
      <span className="text-sm font-semibold tabular-nums">{stat.value}</span>
      {stat.suffix && (
        <span className="text-[10px] text-muted-foreground">({stat.suffix})</span>
      )}
    </div>
  ))}
</div>
```

### Tables

```tsx
// Table container
<div className="rounded-xl border bg-card shadow-sm overflow-hidden">
  <Table>
    <TableHeader>
      <TableRow className="bg-muted/30 hover:bg-muted/30">
        {/* Sortable column header */}
        <TableHead>
          <button
            onClick={() => handleColumnSort("field")}
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group"
          >
            Column Name
            <span className={`
              transition-all duration-200
              ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-50"}
            `}>
              {direction === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
            </span>
          </button>
        </TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {items.map((item, index) => (
        <TableRow
          key={item.id}
          className={`
            transition-all duration-200
            ${isSelected ? "bg-primary/5" : ""}
            ${rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
          `}
          style={{
            transitionDelay: rowsVisible ? `${Math.min(index * 20, 400)}ms` : "0ms",
          }}
        >
          {/* Cell content */}
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

### Buttons

```tsx
// Primary action button
<Button className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5">
  <Icon className="h-4 w-4 mr-1.5" />
  Action
</Button>

// Outline button with primary hover
<Button
  variant="outline"
  className="transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
>
  <Power className="h-4 w-4 mr-1.5" />
  Activate
</Button>

// Outline button with destructive hover
<Button
  variant="outline"
  className="transition-all duration-200 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
>
  <PowerOff className="h-4 w-4 mr-1.5" />
  Deactivate
</Button>

// Icon button
<Button
  variant="ghost"
  size="icon"
  className="h-8 w-8 transition-all duration-200 hover:bg-muted"
>
  <MoreHorizontal className="h-4 w-4" />
</Button>
```

### Form Inputs

```tsx
// Search input with icon
<div className="relative">
  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
  <Input
    placeholder="Search..."
    className="w-[250px] pl-9 pr-8 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
  />
  {/* Clear button (conditional) */}
  {value && (
    <button
      onClick={handleClear}
      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted transition-colors"
    >
      <X className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  )}
</div>

// Select with icon
<Select value={value} onValueChange={onChange}>
  <SelectTrigger className="w-[180px] transition-all duration-200 hover:border-primary/50">
    <Icon className="h-4 w-4 mr-1 text-muted-foreground" />
    <SelectValue placeholder="Select..." />
  </SelectTrigger>
  <SelectContent className="max-h-[300px]">
    <SelectItem value="all">All items</SelectItem>
    {/* Options */}
  </SelectContent>
</Select>
```

### Switch Toggle

```tsx
<Switch
  checked={isActive}
  onCheckedChange={handleToggle}
  disabled={isProcessing}
  className="data-[state=checked]:bg-primary transition-all duration-200 hover:opacity-80"
/>
```

### Checkbox

```tsx
<Checkbox
  checked={isSelected}
  onCheckedChange={handleSelect}
  aria-label="Select item"
  className="transition-transform duration-200 hover:scale-110"
/>
```

---

## Animation Guidelines

### Timing Standards

| Duration | Use Case |
|----------|----------|
| `duration-150` | Micro-interactions (hover, focus) |
| `duration-200` | Standard transitions (state changes) |
| `duration-300` | Content reveals, page transitions |
| `duration-500` | Complex animations (modals, overlays) |

### Easing Functions

```tsx
// Default easing
className="ease-out"      // For entrances
className="ease-in"       // For exits
className="ease-in-out"   // For symmetric animations
```

### Staggered Animations

```tsx
// Row reveal animation
const [rowsVisible, setRowsVisible] = useState(false);

// Trigger after data loads
setTimeout(() => setRowsVisible(true), 50);

// Apply to rows
<TableRow
  className={`
    transition-all duration-200
    ${rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
  `}
  style={{
    transitionDelay: rowsVisible ? `${Math.min(index * 20, 400)}ms` : "0ms",
  }}
>
```

### Hover Effects

```tsx
// Subtle lift effect
className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"

// Scale on hover (for small elements)
className="transition-transform duration-200 hover:scale-110"

// Color transition
className="transition-colors hover:text-primary"

// Background transition
className="transition-colors hover:bg-muted"
```

### Entrance Animations (Tailwind CSS)

```tsx
// Fade in from top
className="animate-in fade-in-0 slide-in-from-top-2 duration-200"

// Fade in from left (staggered)
className="animate-in fade-in-0 slide-in-from-left-2"
style={{ animationDelay: `${index * 50}ms` }}
```

---

## Filter UI Patterns

### Filter Bar Structure

```tsx
<div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border bg-card/50 shadow-sm">
  {/* Search */}
  <div className="relative">
    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    <Input className="w-[250px] pl-9" />
  </div>

  {/* Separator */}
  <div className="h-6 w-px bg-border" />

  {/* Filter Dropdowns */}
  <Select>...</Select>
  <Select>...</Select>
  <Select>...</Select>
</div>
```

### Active Filter Chips

```tsx
interface ActiveFilter {
  key: string;
  label: string;
  value: string;
  displayValue: string;
}

// Build active filters
const activeFilters = useMemo((): ActiveFilter[] => {
  const filters: ActiveFilter[] = [];
  if (searchQuery) {
    filters.push({
      key: "search",
      label: "Search",
      value: searchQuery,
      displayValue: `"${searchQuery}"`,
    });
  }
  // Add other filters...
  return filters;
}, [searchQuery, /* other dependencies */]);

// Render chips
{activeFilters.length > 0 && (
  <div className="flex flex-wrap items-center gap-2 animate-in fade-in-0 slide-in-from-top-2 duration-200">
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <SlidersHorizontal className="h-4 w-4" />
      <span className="font-medium">
        {activeFilters.length} active filter{activeFilters.length !== 1 ? "s" : ""}:
      </span>
    </div>

    {activeFilters.map((filter, index) => (
      <Badge
        key={filter.key}
        variant="secondary"
        className="
          pl-2.5 pr-1.5 py-1 gap-1.5
          bg-primary/10 text-primary border-primary/20
          hover:bg-primary/15 transition-all duration-200
          animate-in fade-in-0 slide-in-from-left-2
        "
        style={{ animationDelay: `${index * 50}ms` }}
      >
        <span className="text-xs font-normal text-primary/70">{filter.label}:</span>
        <span className="text-xs font-medium max-w-[150px] truncate">{filter.displayValue}</span>
        <button
          onClick={() => handleRemoveFilter(filter.key)}
          className="ml-0.5 p-0.5 rounded-full hover:bg-primary/20 transition-colors"
          aria-label={`Remove ${filter.label} filter`}
        >
          <X className="h-3 w-3" />
        </button>
      </Badge>
    ))}

    <Button
      variant="ghost"
      size="sm"
      onClick={handleClearFilters}
      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
    >
      Clear all
    </Button>
  </div>
)}
```

---

## Pagination Standards

### Enhanced Pagination Component

```tsx
<div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
  {/* Left side: Info + Page size */}
  <div className="flex items-center gap-4 text-sm text-muted-foreground">
    <p>
      Showing <span className="font-medium text-foreground">{showing}</span> of{" "}
      <span className="font-medium text-foreground">{total}</span> items
    </p>
    <div className="h-4 w-px bg-border" />
    <div className="flex items-center gap-2">
      <span>Rows per page:</span>
      <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
        <SelectTrigger className="w-[70px] h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="25">25</SelectItem>
          <SelectItem value="50">50</SelectItem>
          <SelectItem value="100">100</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>

  {/* Right side: Navigation */}
  {totalPages > 1 && (
    <div className="flex items-center gap-2">
      {/* First Page */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => handlePageChange(1)}
        disabled={currentPage === 1}
        className="h-8 w-8 transition-all duration-200 hover:bg-muted"
        title="First page"
      >
        <ChevronsLeft className="h-4 w-4" />
      </Button>

      {/* Previous Page */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="transition-all duration-200 hover:bg-muted"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Previous
      </Button>

      {/* Jump to Page */}
      <div className="flex items-center gap-2 px-2">
        <span className="text-sm text-muted-foreground">Page</span>
        <Input
          type="number"
          min={1}
          max={totalPages}
          value={jumpToPage}
          onChange={(e) => setJumpToPage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleJumpToPage()}
          onBlur={handleJumpToPage}
          placeholder={currentPage.toString()}
          className="w-14 h-8 text-center tabular-nums"
        />
        <span className="text-sm text-muted-foreground">of {totalPages}</span>
      </div>

      {/* Next Page */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="transition-all duration-200 hover:bg-muted"
      >
        Next
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>

      {/* Last Page */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => handlePageChange(totalPages)}
        disabled={currentPage === totalPages}
        className="h-8 w-8 transition-all duration-200 hover:bg-muted"
        title="Last page"
      >
        <ChevronsRight className="h-4 w-4" />
      </Button>
    </div>
  )}
</div>
```

---

## Loading States

### Page Skeleton

```tsx
function PageSkeleton() {
  return (
    <div className="space-y-4">
      {/* Stats Skeleton */}
      <div className="flex flex-wrap items-center gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-10 w-32 rounded-lg"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
        <Skeleton className="h-9 w-28 ml-auto rounded-md" />
      </div>

      {/* Filters Skeleton */}
      <div className="flex flex-wrap gap-3 p-4 rounded-xl border bg-card/50">
        <Skeleton className="h-10 w-[250px] rounded-md" />
        <Skeleton className="h-10 w-[180px] rounded-md" />
        <Skeleton className="h-10 w-[180px] rounded-md" />
      </div>

      {/* Table Skeleton */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 p-4 bg-muted/30 border-b">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>

        {/* Rows with staggered opacity */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 border-b last:border-b-0 animate-pulse"
            style={{
              animationDelay: `${i * 50}ms`,
              opacity: 1 - (i * 0.05),
            }}
          >
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>

      {/* Pagination Skeleton */}
      <div className="flex items-center justify-between px-2">
        <Skeleton className="h-4 w-48" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>
    </div>
  );
}
```

### Inline Loading States

```tsx
// Search loading
{isSearching && (
  <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
)}

// Button loading
<Button disabled={isProcessing}>
  {isProcessing ? (
    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
  ) : (
    <Icon className="h-4 w-4 mr-1.5" />
  )}
  Action
</Button>
```

---

## Empty States

### Standard Empty State

```tsx
<TableRow>
  <TableCell colSpan={columnCount} className="h-48">
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div className="p-4 rounded-full bg-muted/50">
        <Package className="h-10 w-10 text-muted-foreground/50" />
      </div>
      <div className="text-center">
        <p className="font-medium text-foreground">No items found</p>
        <p className="text-sm text-muted-foreground mt-1">
          {hasActiveFilters
            ? "Try adjusting your filters to find what you're looking for"
            : "Get started by adding your first item"
          }
        </p>
      </div>
      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearFilters}
          className="mt-2 transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
        >
          <X className="h-4 w-4 mr-1.5" />
          Clear all filters
        </Button>
      )}
    </div>
  </TableCell>
</TableRow>
```

### Error State

```tsx
<div className="flex flex-col items-center justify-center py-12 rounded-xl border bg-card shadow-sm">
  <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
  <p className="text-muted-foreground">{errorMessage}</p>
  <Button
    variant="outline"
    className="mt-4"
    onClick={() => window.location.reload()}
  >
    Try Again
  </Button>
</div>
```

---

## Code Examples

### Complete Filter Bar Implementation

```tsx
// Filter bar with all standard elements
<div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border bg-card/50 shadow-sm">
  {/* Search Input */}
  <div className="relative">
    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    <Input
      ref={searchInputRef}
      name="search"
      placeholder="Search items..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="w-[250px] pl-9 pr-8 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
    />
    {isSearching && (
      <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
    )}
    {searchQuery && !isSearching && (
      <button
        onClick={handleClearSearch}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted transition-colors"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    )}
  </div>

  <div className="h-6 w-px bg-border" />

  {/* Filter Dropdowns */}
  <div className="flex items-center gap-2">
    <Tag className="h-4 w-4 text-muted-foreground" />
    <Select value={filter || "all"} onValueChange={handleFilterChange}>
      <SelectTrigger className="w-[180px] transition-all duration-200 hover:border-primary/50">
        <SelectValue placeholder="Filter by..." />
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        <SelectItem value="all">All items</SelectItem>
        {options.map(option => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  {/* Sort Dropdown */}
  <Select value={sortBy} onValueChange={handleSortChange}>
    <SelectTrigger className="w-[160px] transition-all duration-200 hover:border-primary/50">
      <ArrowUpDown className="h-4 w-4 mr-1 text-muted-foreground" />
      <SelectValue placeholder="Sort by" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="name_asc">Name A-Z</SelectItem>
      <SelectItem value="name_desc">Name Z-A</SelectItem>
      <SelectItem value="date_desc">Newest First</SelectItem>
      <SelectItem value="date_asc">Oldest First</SelectItem>
    </SelectContent>
  </Select>
</div>
```

### Complete Bulk Actions Bar

```tsx
{isSomeSelected && (
  <div className="flex items-center gap-4 p-3 bg-primary/5 rounded-xl border border-primary/20 animate-in fade-in-0 slide-in-from-top-2 duration-200">
    <div className="flex items-center gap-2">
      <div className="p-1.5 rounded-md bg-primary/10">
        <CheckSquare className="h-4 w-4 text-primary" />
      </div>
      <span className="text-sm font-medium text-foreground">
        {selectAllMode
          ? `All ${total} matching items selected`
          : `${selectedIds.size} item${selectedIds.size !== 1 ? "s" : ""} selected`
        }
      </span>
    </div>

    {isAllOnPageSelected && !selectAllMode && total > items.length && (
      <Button
        variant="link"
        size="sm"
        className="text-primary p-0 h-auto"
        onClick={handleSelectAllMatching}
      >
        Select all {total} matching items
      </Button>
    )}

    <div className="flex items-center gap-2 ml-auto">
      <Button
        variant="outline"
        size="sm"
        onClick={handleBulkAction}
        disabled={isProcessing}
        className="transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
      >
        <Power className="h-4 w-4 mr-1.5" />
        Action
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClearSelection}
        disabled={isProcessing}
      >
        <X className="h-4 w-4 mr-1" />
        Clear
      </Button>
    </div>
  </div>
)}
```

---

## Best Practices Checklist

Before shipping any page, verify:

- [ ] Animations run smoothly at 60fps
- [ ] Hover/focus states are clearly visible
- [ ] Loading states provide appropriate feedback
- [ ] Colors maintain sufficient contrast (WCAG AA)
- [ ] Interactive elements are at least 44x44px for touch
- [ ] Transitions respect reduced-motion preferences
- [ ] Component works on mobile and desktop
- [ ] Visual hierarchy is clear and intentional
- [ ] Code follows TypeScript best practices
- [ ] Implementation aligns with project patterns

---

## Import Template

Standard imports for enhanced pages:

```tsx
import { useState, useEffect, useCallback, useTransition, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Package,
  Trash2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  X,
  Power,
  PowerOff,
  Download,
  Search,
  SlidersHorizontal,
  // Add domain-specific icons
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01 | Initial design system documentation |

---

*This design system is maintained by the Intelect development team. For questions or suggestions, please open an issue in the repository.*
