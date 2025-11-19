import { Suspense } from "react";
import { ProductsTable } from "@/components/products/products-table";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

interface ProductsPageProps {
  searchParams: Promise<{
    search?: string;
    brand_id?: string;
    category_id?: string;
    in_stock?: string;
    min_price?: string;
    max_price?: string;
    limit?: string;
    offset?: string;
  }>;
}

async function ProductsContent({
  searchParams,
}: {
  searchParams: ProductsPageProps["searchParams"];
}) {
  const params = await searchParams;
  const limit = parseInt(params.limit || "50", 10);
  const offset = parseInt(params.offset || "0", 10);

  try {
    // Fetch products with filters
    let productsData;
    if (params.search) {
      productsData = await api.searchProducts(params.search, limit, offset);
    } else {
      productsData = await api.getProducts(
        {
          brand_id: params.brand_id,
          category_id: params.category_id,
          in_stock: params.in_stock === "true",
          min_price: params.min_price
            ? parseFloat(params.min_price)
            : undefined,
          max_price: params.max_price
            ? parseFloat(params.max_price)
            : undefined,
        },
        limit,
        offset
      );
    }

    // Fetch brands and categories for filters
    const [brandsData, categoriesData] = await Promise.all([
      api.getBrands(100, 0),
      api.getCategories(),
    ]);

    return (
      <ProductsTable
        products={productsData.data}
        brands={brandsData.data}
        categories={categoriesData.data}
        total={productsData.total}
        limit={limit}
        offset={offset}
      />
    );
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">
          Failed to load products. Make sure the Go backend API is running at
          http://localhost:8080
        </p>
      </div>
    );
  }
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        <p className="text-muted-foreground">
          Manage and view all products in the catalog
        </p>
      </div>

      <Suspense fallback={<ProductsPageSkeleton />}>
        <ProductsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function ProductsPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <Skeleton className="h-10 w-[300px]" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-[180px]" />
          <Skeleton className="h-10 w-[180px]" />
        </div>
      </div>
      <Skeleton className="h-[600px] w-full" />
    </div>
  );
}
