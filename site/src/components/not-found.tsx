import { Link, type NotFoundRouteProps } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function NotFound(_props: NotFoundRouteProps) {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-xl flex-col justify-center px-4 py-16 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-fg-subtle">
        404
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fg">
        Page Not Found
      </h1>
      <p className="mt-3 max-w-md text-base leading-relaxed text-fg-muted">
        That address is not on this site.
      </p>
      <div className="mt-6">
        <Button asChild size="lg">
          <Link to="/">Back to Home</Link>
        </Button>
      </div>
    </main>
  );
}
