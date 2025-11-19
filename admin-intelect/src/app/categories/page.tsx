"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FolderTree, ChevronRight, ExternalLink, Trash2, MoreHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { Category } from "@/types";
import { ConfirmDialog } from "@/components/confirm-dialog";

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
  onToggleActive,
  onDelete,
  isProcessing,
}: {
  category: Category;
  level?: number;
  onToggleActive: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
  isProcessing: boolean;
}) {
  const hasChildren = category.children && category.children.length > 0;

  const content = (
    <div
      className="flex items-center gap-2 rounded-md p-2 hover:bg-muted"
      style={{ paddingLeft: `${level * 20 + (hasChildren ? 8 : 32)}px` }}
    >
      {hasChildren && (
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
            <ChevronRight className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-90" />
          </Button>
        </CollapsibleTrigger>
      )}
      <FolderTree className="h-4 w-4 text-muted-foreground" />
      <span className={`flex-1 ${hasChildren ? "font-medium" : ""}`}>
        {category.name}
      </span>
      <Badge variant="secondary">{category.product_count}</Badge>
      <Switch
        checked={category.is_active}
        onCheckedChange={(checked) => onToggleActive(category.id, checked)}
        disabled={isProcessing}
        className="mr-2"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/products?category_id=${category.id}`}>
              <ExternalLink className="mr-2 h-4 w-4" />
              View Products
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => onDelete(category.id)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  if (hasChildren) {
    return (
      <Collapsible defaultOpen={level < 1}>
        {content}
        <CollapsibleContent>
          {category.children!.map((child) => (
            <CategoryItem
              key={child.id}
              category={child}
              level={level + 1}
              onToggleActive={onToggleActive}
              onDelete={onDelete}
              isProcessing={isProcessing}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return content;
}

export default function CategoriesPage() {
  const [isPending, startTransition] = useTransition();

  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setIsLoading(true);
      const categoriesData = await api.getCategories();
      setCategories(categoriesData.data);
      setTotal(categoriesData.total);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
      setError("Failed to load categories. Make sure the Go backend API is running.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const categoryTree = buildCategoryTree(categories);

  // Calculate stats
  const totalProducts = categories.reduce(
    (sum, cat) => sum + cat.product_count,
    0
  );
  const categoriesWithProducts = categories.filter(
    (cat) => cat.product_count > 0
  ).length;

  const handleToggleActive = async (categoryId: string, isActive: boolean) => {
    setIsProcessing(true);
    try {
      await api.updateCategory(categoryId, { is_active: isActive });
      toast.success(`Category ${isActive ? "activated" : "deactivated"}`);
      startTransition(() => {
        fetchCategories();
      });
    } catch (error) {
      console.error("Failed to update category:", error);
      toast.error("Failed to update category status");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategoryId) return;

    setIsProcessing(true);
    try {
      await api.deleteCategory(deleteCategoryId);
      toast.success("Category deleted successfully");
      setShowDeleteDialog(false);
      setDeleteCategoryId(null);
      startTransition(() => {
        fetchCategories();
      });
    } catch (error) {
      console.error("Failed to delete category:", error);
      toast.error("Failed to delete category");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteClick = (categoryId: string) => {
    setDeleteCategoryId(categoryId);
    setShowDeleteDialog(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground">
            View the hierarchical category structure
          </p>
        </div>
        <CategoriesPageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground">
            View the hierarchical category structure
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
        <p className="text-muted-foreground">
          View the hierarchical category structure
        </p>
      </div>

      <div className="space-y-4">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Total Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {total.toLocaleString()}
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

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Total Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProducts.toLocaleString()}</div>
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
                  <CategoryItem
                    key={category.id}
                    category={category}
                    onToggleActive={handleToggleActive}
                    onDelete={handleDeleteClick}
                    isProcessing={isProcessing || isPending}
                  />
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Category Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Category"
        description="Are you sure you want to delete this category? This action cannot be undone and may affect child categories and associated products."
        confirmLabel="Delete"
        onConfirm={handleDeleteCategory}
        variant="destructive"
        isLoading={isProcessing}
      />
    </div>
  );
}

function CategoriesPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
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
