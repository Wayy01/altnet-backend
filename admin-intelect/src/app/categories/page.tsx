import { Suspense } from "react";
import Link from "next/link";
import { FolderTree, ChevronRight, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { api } from "@/lib/api";
import { Category } from "@/types";

// Build tree structure from flat categories
function buildCategoryTree(categories: Category[]): Category[] {
  const categoryMap = new Map<string, Category>();
  const roots: Category[] = [];

  // First pass: create map
  categories.forEach((cat) => {
    categoryMap.set(cat.id, { ...cat, children: [] });
  });

  // Second pass: build tree
  categories.forEach((cat) => {
    const category = categoryMap.get(cat.id)!;
    if (cat.parent_id && categoryMap.has(cat.parent_id)) {
      const parent = categoryMap.get(cat.parent_id)!;
      parent.children = parent.children || [];
      parent.children.push(category);
    } else {
      roots.push(category);
    }
  });

  // Sort by sort_order
  const sortCategories = (cats: Category[]): Category[] => {
    return cats
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((cat) => ({
        ...cat,
        children: cat.children ? sortCategories(cat.children) : [],
      }));
  };

  return sortCategories(roots);
}

// Recursive category item component
function CategoryItem({
  category,
  level = 0,
}: {
  category: Category;
  level?: number;
}) {
  const hasChildren = category.children && category.children.length > 0;

  if (hasChildren) {
    return (
      <Collapsible defaultOpen={level < 1}>
        <div
          className="flex items-center gap-2 rounded-md p-2 hover:bg-muted"
          style={{ paddingLeft: `${level * 20 + 8}px` }}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
              <ChevronRight className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-90" />
            </Button>
          </CollapsibleTrigger>
          <FolderTree className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 font-medium">{category.name}</span>
          <Badge variant="secondary">{category.product_count}</Badge>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/products?category_id=${category.id}`}>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
        <CollapsibleContent>
          {category.children!.map((child) => (
            <CategoryItem key={child.id} category={child} level={level + 1} />
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div
      className="flex items-center gap-2 rounded-md p-2 hover:bg-muted"
      style={{ paddingLeft: `${level * 20 + 32}px` }}
    >
      <FolderTree className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1">{category.name}</span>
      <Badge variant="secondary">{category.product_count}</Badge>
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/products?category_id=${category.id}`}>
          <ExternalLink className="h-3 w-3" />
        </Link>
      </Button>
    </div>
  );
}

async function CategoriesContent() {
  try {
    const categoriesData = await api.getCategories();
    const categoryTree = buildCategoryTree(categoriesData.data);

    // Calculate stats
    const totalProducts = categoriesData.data.reduce(
      (sum, cat) => sum + cat.product_count,
      0
    );
    const categoriesWithProducts = categoriesData.data.filter(
      (cat) => cat.product_count > 0
    ).length;

    return (
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Total Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {categoriesData.total.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Root Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categoryTree.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                With Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categoriesWithProducts}</div>
            </CardContent>
          </Card>
        </div>

        {/* Category Tree */}
        <Card>
          <CardHeader>
            <CardTitle>Category Hierarchy</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-y-auto p-4">
              {categoryTree.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8">
                  <FolderTree className="h-8 w-8 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    No categories found
                  </span>
                </div>
              ) : (
                categoryTree.map((category) => (
                  <CategoryItem key={category.id} category={category} />
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">
          Failed to load categories. Make sure the Go backend API is running.
        </p>
      </div>
    );
  }
}

export default async function CategoriesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
        <p className="text-muted-foreground">
          View the hierarchical category structure
        </p>
      </div>

      <Suspense fallback={<CategoriesPageSkeleton />}>
        <CategoriesContent />
      </Suspense>
    </div>
  );
}

function CategoriesPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
