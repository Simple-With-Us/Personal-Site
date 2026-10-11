import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { useState } from "react";
import { CreatedWithGrokBanner } from "@/components/created-with-grok-banner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TopoBackground } from "@/components/topo-background";
import { SentryInit } from "@/lib/sentry/SentryInit";
import { AppErrorComponent } from "@/lib/error-component";
import { site } from "@/lib/site";
import appCss from "@/styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        name: "description",
        content: site.tagline,
      },
      {
        name: "keywords",
        content:
          "Jay Wedgeworth, John Wedgeworth, jays.services, jaywedgeworth.com, Socratic Trade, Congress.Trade, Usage Monitor, DealDex, ContactLogo, AI fleet, Houston, photogrammetry, Spaceport3D",
      },
      { property: "og:title", content: site.name },
      { property: "og:description", content: site.tagline },
      { property: "og:image", content: site.ogImage },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: site.name },
      { name: "twitter:description", content: site.tagline },
      { name: "twitter:image", content: site.ogImage },
      { title: site.name },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "canonical", href: `https://${site.domain}/` },
      {
        rel: "icon",
        href: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23141417'/%3E%3Ctext x='16' y='22' text-anchor='middle' font-family='Lato,system-ui' font-size='16' font-weight='600' fill='%23fafafa'%3EJ%3C/text%3E%3C/svg%3E",
      },
    ],
  }),
  errorComponent: AppErrorComponent,
  component: RootComponent,
});

function RootComponent() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <SentryInit />
        <CreatedWithGrokBanner />
        <TopoBackground />
        <div className="relative z-10">
          <SiteHeader />
          <Outlet />
          <SiteFooter />
        </div>
      </QueryClientProvider>
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-dvh bg-bg font-sans text-fg antialiased">
        {children}
        <Analytics />
        <SpeedInsights />
        <Scripts />
      </body>
    </html>
  );
}
