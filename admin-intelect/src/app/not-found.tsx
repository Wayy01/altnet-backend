import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <FileQuestion className="h-16 w-16 text-muted-foreground" />
      <h2 className="mt-4 text-2xl font-bold">Page Not Found</h2>
      <p className="mt-2 text-muted-foreground">
        The page you are looking for does not exist.
      </p>
      <Button asChild className="mt-4">
        <Link href="/">Return to Dashboard</Link>
      </Button>
    </div>
  );
}
