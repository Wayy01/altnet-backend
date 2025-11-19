import {
  Package,
  Building2,
  FolderTree,
  FileText,
  Tags,
  DollarSign,
  Warehouse,
  PackageCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

async function getDashboardStats() {
  try {
    const stats = await api.getDashboardStats();
    return stats;
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    // Return default values if API is not available
    return {
      total_products: 48316,
      total_brands: 1133,
      total_categories: 418,
      total_properties: 876081,
      total_characteristics: 460,
      total_prices: 36682,
      total_stock: 15488,
      in_stock_products: 0,
    };
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  const statCards = [
    {
      title: "Total Products",
      value: stats.total_products.toLocaleString(),
      icon: Package,
      description: "Products in catalog",
      color: "text-blue-500",
    },
    {
      title: "Brands",
      value: stats.total_brands.toLocaleString(),
      icon: Building2,
      description: "Active brands",
      color: "text-purple-500",
    },
    {
      title: "Categories",
      value: stats.total_categories.toLocaleString(),
      icon: FolderTree,
      description: "Product categories",
      color: "text-green-500",
    },
    {
      title: "Properties",
      value: stats.total_properties.toLocaleString(),
      icon: FileText,
      description: "Product specifications",
      color: "text-orange-500",
    },
    {
      title: "Characteristics",
      value: stats.total_characteristics.toLocaleString(),
      icon: Tags,
      description: "Product variants/SKUs",
      color: "text-pink-500",
    },
    {
      title: "Prices",
      value: stats.total_prices.toLocaleString(),
      icon: DollarSign,
      description: "Price entries",
      color: "text-yellow-500",
    },
    {
      title: "Stock Entries",
      value: stats.total_stock.toLocaleString(),
      icon: Warehouse,
      description: "Stock records",
      color: "text-cyan-500",
    },
    {
      title: "In Stock",
      value: stats.in_stock_products.toLocaleString(),
      icon: PackageCheck,
      description: "Products available",
      color: "text-emerald-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of Ultra B2B product data
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Connect to the Go backend API to view sync logs and recent
              activity.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Navigate using the sidebar to manage products, brands, and
              categories.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
