import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "An unexpected error occurred.\u00A0 Try reloading the page.";

  useEffect(() => {
    void import("@/lib/sentry/sentry").then((mod) => {
      mod.reportVisibleError(error);
    });
  }, [error]);

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-3 bg-bg px-6 py-16 text-center text-fg">
      <span className="text-red-600" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-md text-base leading-relaxed break-words text-fg-muted">
        {message || "An unexpected error occurred.\u00A0 Try reloading the page."}
      </p>
      <a
        href="/"
        className="mt-4 inline-flex h-11 items-center justify-center rounded-[var(--radius-sm)] bg-accent px-6 text-sm font-medium text-accent-fg"
      >
        Back to Home
      </a>
    </main>
  );
}
