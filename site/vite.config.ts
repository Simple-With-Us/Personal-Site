import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

function sentryRelease(): string {
  return (
    (process.env.SENTRY_RELEASE || "").trim() ||
    (process.env.VERCEL_GIT_COMMIT_SHA || "").trim() ||
    "unknown"
  );
}

function sentryEnvironment(): string {
  return (
    (process.env.SENTRY_ENVIRONMENT || "").trim() ||
    (process.env.VERCEL_ENV || "").trim() ||
    (process.env.NODE_ENV || "").trim() ||
    "development"
  );
}

function sentryPublicDefine(): Record<string, string> {
  // Never throw here.  A missing DSN must not fail `vite build` — the
  // browser init stays dark until Jay attaches SENTRY_DSN on Vercel.
  // Never put SENTRY_AUTH_TOKEN here.
  return {
    "import.meta.env.SENTRY_DSN": JSON.stringify((process.env.SENTRY_DSN || "").trim()),
    "import.meta.env.SENTRY_ENVIRONMENT": JSON.stringify(sentryEnvironment()),
    "import.meta.env.SENTRY_RELEASE": JSON.stringify(sentryRelease()),
  };
}

/**
 * Source-map upload to the `personal-site` Sentry project so events carry
 * a release (VERCEL_GIT_COMMIT_SHA) that lines up with uploaded maps.
 * Skipped entirely when SENTRY_AUTH_TOKEN is unset, so local and tokenless
 * builds never fail on upload.
 */
function sentrySourceMapsPlugin(): Plugin[] {
  const authToken = (process.env.SENTRY_AUTH_TOKEN || "").trim();
  if (!authToken) {
    if (process.env.VERCEL_ENV === "production") {
      console.warn("Sentry source-map upload skipped: SENTRY_AUTH_TOKEN is unset.");
    }
    return [];
  }
  return [
    sentryVitePlugin({
      org: (process.env.SENTRY_ORG || "").trim() || "simple-with-us",
      project: (process.env.SENTRY_PROJECT || "").trim() || "personal-site",
      authToken,
      release: { name: sentryRelease() },
      telemetry: false,
    }) as unknown as Plugin,
  ];
}

/**
 * Finish PGLite bootstrap during dev-server setup (before traffic). Vite awaits
 * async `configureServer` hooks. Production: `src/lib/db` kicks `ensureDbReady`
 * on import.
 */
function pgliteBootstrapPlugin(): Plugin {
  return {
    name: "app-builder:pglite-bootstrap",
    apply: "serve",
    async configureServer(server) {
      try {
        const mod = (await server.ssrLoadModule("/src/lib/db.ts")) as {
          ensureDbReady?: () => Promise<void>;
        };
        if (typeof mod.ensureDbReady === "function") {
          await mod.ensureDbReady();
        }
      } catch (err) {
        console.error("[app-builder] DB bootstrap failed:", err);
        throw err;
      }
    },
  };
}

/**
 * Live-preview OAuth popup — handled HERE so the agent never has to create a
 * `/auth/popup` route (and cannot break it by scaffolding a React page that
 * paints the full app shell in the popup).
 *
 * `signIn` (client.ts) opens `/auth/popup?providerId=…` in a top-level window.
 * This middleware runs before TanStack Start, calls `handleAuthPopupRequest`,
 * and returns the 302 / completion HTML. Deployed apps do not use the popup
 * (full-page OAuth redirect), so `apply: "serve"` is enough.
 */
function authPopupPlugin(): Plugin {
  return {
    name: "app-builder:auth-popup",
    apply: "serve",
    configureServer(server) {
      // Register immediately (not in a returned post-hook) so we run BEFORE
      // TanStack Start / the SPA HTML fallback. A model-authored
      // `src/routes/auth/popup.tsx` React page must never win this path.
      server.middlewares.use(async (req, res, next) => {
        try {
          const rawUrl = req.url ?? "";
          const pathOnly = rawUrl.split("?", 1)[0] ?? "";
          if (pathOnly !== "/auth/popup") {
            next();
            return;
          }
          if ((req.method ?? "GET").toUpperCase() !== "GET") {
            res.statusCode = 405;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("Method Not Allowed");
            return;
          }

          const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:8080");
          const proto = String(
            req.headers["x-forwarded-proto"] ??
              ((req.socket as { encrypted?: boolean } | undefined)?.encrypted ? "https" : "http"),
          );
          const requestHeaders = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (value === undefined) continue;
            if (Array.isArray(value)) {
              for (const v of value) requestHeaders.append(key, v);
            } else {
              requestHeaders.set(key, value);
            }
          }
          // Ensure Host is the public preview host so Better Auth's dynamic
          // baseURL / redirect_uri match the popup origin.
          if (!requestHeaders.has("host")) requestHeaders.set("host", host);

          const request = new Request(`${proto}://${host}${rawUrl}`, {
            method: "GET",
            headers: requestHeaders,
          });

          const mod = (await server.ssrLoadModule("/src/lib/auth/popup.server.ts")) as {
            handleAuthPopupRequest: (req: Request) => Promise<Response>;
          };
          const response = await mod.handleAuthPopupRequest(request);

          res.statusCode = response.status;
          // Preserve multiple Set-Cookie headers (OAuth state + session).
          const setCookies =
            typeof response.headers.getSetCookie === "function"
              ? response.headers.getSetCookie()
              : [];
          response.headers.forEach((value, key) => {
            if (key.toLowerCase() === "set-cookie") return;
            res.setHeader(key, value);
          });
          for (const cookie of setCookies) {
            res.appendHeader("set-cookie", cookie);
          }
          const body = Buffer.from(await response.arrayBuffer());
          res.end(body);
        } catch (err) {
          console.error("[app-builder] /auth/popup handler failed:", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("auth popup failed");
          }
        }
      });
    },
  };
}

// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
// Keep `nitro` gated to `build` (the Vercel deploy target): enabled in dev it
// opens a second dev-server port, which breaks the single-port preview.
// The dev server starts once `src/router.tsx` and `src/routes/` exist — see
// AGENTS.md § "First scaffold".
export default defineConfig(({ command }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
  },
  resolve: { tsconfigPaths: true },
  define: sentryPublicDefine(),
  build: {
    // Hidden maps: uploaded to Sentry, never referenced by the bundle.
    sourcemap: "hidden",
  },
  ssr: {
    external: ["dd-trace"],
  },
  optimizeDeps: {
    exclude: ["dd-trace"],
  },
  plugins: [
    pgliteBootstrapPlugin(),
    // Before tanstackStart so /auth/popup never falls through to the SPA.
    authPopupPlugin(),
    tailwindcss(),
    tanstackStart(),
    ...(command === "build"
      ? [
          nitro({
            preset: "vercel",
            // Native APM tracer must stay external to the Nitro bundle.
            externals: { external: ["dd-trace"] },
          } as Parameters<typeof nitro>[0]),
        ]
      : []),
    viteReact(),
    // After the framework plugins so transformed chunks carry maps.
    ...sentrySourceMapsPlugin(),
  ],
}));
