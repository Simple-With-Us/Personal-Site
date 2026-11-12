import { createRouter } from "@tanstack/react-router";
import { NotFound } from "./components/not-found";
import { routeTree } from "./routeTree.gen";
import { AppErrorComponent } from "./lib/error-component";

export function getRouter() {
  const router = createRouter({
    routeTree,
    defaultPreload: "intent",
    defaultErrorComponent: AppErrorComponent,
    defaultNotFoundComponent: NotFound,
    scrollRestoration: true,
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
