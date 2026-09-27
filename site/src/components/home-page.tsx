import { ArrowUpRight, ExternalLink } from "lucide-react";
import { useState } from "react";
import { site } from "@/lib/site";
import { FleetActivity } from "@/components/fleet-activity";
import { HeroNameAnchor } from "@/components/morphing-name";
import { SocialIcon } from "@/components/social-icons";
import { Button } from "@/components/ui/button";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-[0.14em] text-fg-subtle">
      {children}
    </p>
  );
}

function withDoubleSpaces(text: string): string {
  return text.replace(/\. {1,2}/g, ".\u00A0\u00A0");
}

const projectCategories = ["Coding", "Financial", "Utility"] as const;

function SketchfabMedia() {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="relative aspect-video w-full bg-bg-subtle">
      {isLoaded ? (
        <iframe
          title="Spaceport3D on Sketchfab"
          src={site.media.sketchfab}
          className="absolute inset-0 h-full w-full border-0"
          allow="fullscreen; xr-spatial-tracking"
          allowFullScreen
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-fg-muted">Interactive 3D model</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setIsLoaded(true)}
              className="rounded-[var(--radius-sm)] bg-accent px-3 py-2 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90"
            >
              Load model
            </button>
            <a
              href={site.media.sketchfabModel}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-link hover:underline"
            >
              Open model
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export function HomePage() {
  return (
    <main>
      <section>
        <div className="mx-auto flex min-h-[7.5rem] max-w-5xl items-center px-4 py-8 sm:min-h-[8.5rem] sm:px-6 sm:py-10">
          <div className="w-full max-w-2xl">
            <HeroNameAnchor />
            <p className="max-w-xl text-base leading-relaxed text-fg-muted sm:text-lg">
              {withDoubleSpaces(site.tagline)}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild>
                <a
                  href={site.catalog.root}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Explore all apps
                </a>
              </Button>
              <Button asChild variant="secondary">
                <a href="#activity">View Daily Activities</a>
              </Button>
              <Button asChild variant="secondary">
                <a href={`mailto:${site.email}`}>Contact</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="scroll-mt-20">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionLabel>About</SectionLabel>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-fg-muted">
            {site.about.map((p) => (
              <p key={p.slice(0, 40)}>{withDoubleSpaces(p)}</p>
            ))}
          </div>
        </div>
      </section>

      <section id="work" className="scroll-mt-20">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionLabel>Work</SectionLabel>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            Apps and tools
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">
            Software I build for coding, financial research, and everyday tasks.
          </p>
          <div className="mt-10 space-y-10">
            {projectCategories.map((category) => (
              <div key={category}>
                <h3 className="mb-4 border-b border-border pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-fg-subtle">
                  {category}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {site.projects.filter((p) => p.category === category).map((p) => (
                    <article
                      key={p.key}
                      className="flex flex-col rounded-[var(--radius-lg)] border border-border bg-bg-elevated/90 shadow-[var(--shadow-soft)] transition-colors hover:border-border-strong"
                    >
                      <a
                        href={p.primaryHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${p.primaryLabel}: ${p.name}`}
                        className="group block flex-1 rounded-t-[var(--radius-lg)] p-5 focus-visible:outline-offset-[-3px]"
                      >
                        <div className="flex items-center gap-3">
                          {p.editions ? (
                            <span className="flex shrink-0 gap-1" aria-hidden>
                              {p.editions.map((edition) => (
                                <img
                                  key={edition.name}
                                  src={edition.icon}
                                  alt=""
                                  width={40}
                                  height={40}
                                  className="size-10 rounded-[var(--radius-sm)] border border-border bg-bg object-cover"
                                  loading="lazy"
                                  decoding="async"
                                />
                              ))}
                            </span>
                          ) : p.icon ? (
                            <img
                              src={p.icon}
                              alt=""
                              width={48}
                              height={48}
                              className="size-12 shrink-0 rounded-[var(--radius-sm)] border border-border bg-bg object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[#1b2e43] bg-[#182b40] px-0.5 text-[7px] font-bold tracking-[0.04em] text-white">
                              {p.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                          <h4 className="min-w-0 flex-1 text-base font-semibold tracking-tight text-fg sm:text-lg">
                            {p.name}
                          </h4>
                          <ArrowUpRight className="size-4 shrink-0 text-fg-subtle transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-fg-muted">
                          {withDoubleSpaces(p.blurb)}
                        </p>
                        <span className="mt-4 inline-block text-xs font-semibold text-link">
                          {p.primaryLabel}
                        </span>
                      </a>
                      {p.editions ? (
                        <div className="grid grid-cols-2 gap-2 px-5 pb-4">
                          {p.editions.map((edition) => (
                            <a
                              key={edition.name}
                              href={edition.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`View Usage Monitor ${edition.name} edition`}
                              className="flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] border border-border bg-bg-subtle px-2.5 py-2 text-xs font-medium text-fg transition-colors hover:border-border-strong hover:bg-bg-elevated"
                            >
                              <img src={edition.icon} alt="" width={32} height={32} className="size-8 shrink-0 rounded-[5px] object-cover" loading="lazy" decoding="async" />
                              {edition.name} edition
                            </a>
                          ))}
                        </div>
                      ) : null}
                      {p.sourceHref ? (
                        <div className="border-t border-border/70 px-5 py-2.5">
                          <a
                            href={p.sourceHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-8 items-center gap-2 text-xs font-medium text-fg-muted transition-colors hover:text-fg"
                          >
                            <SocialIcon id="github" className="size-3.5" />
                            Public source
                          </a>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="apps" className="scroll-mt-20">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="flex flex-col gap-1">
            <SectionLabel>App catalog</SectionLabel>
            <h2 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              Explore the apps
            </h2>
            <p className="mt-1 text-sm text-fg-muted">
              Find product pages and current public links in the Simple With Us catalog.
            </p>
          </div>

          <a
            href={site.catalog.root}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-6 flex max-w-xl items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-border bg-bg-elevated p-5 shadow-[var(--shadow-soft)] transition-colors hover:border-border-strong"
          >
            <span className="flex min-w-0 flex-col gap-3">
              <img
                src="/brand/simple-with-us-wide.png"
                alt="Simple With Us"
                width={1920}
                height={200}
                className="h-auto w-full max-w-[400px]"
                loading="lazy"
                decoding="async"
              />
              <span className="text-sm text-fg-muted">Browse the full catalog</span>
            </span>
            <ExternalLink className="size-4 shrink-0 text-fg-subtle transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
          </a>
        </div>
      </section>

      <section id="media" className="scroll-mt-20">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionLabel>Media</SectionLabel>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-bg-elevated/90 shadow-[var(--shadow-soft)] backdrop-blur-[2px]">
              <SketchfabMedia />
              <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                <p className="text-sm text-fg-muted">Sketchfab · Spaceport3D</p>
                <a
                  href={site.media.sketchfabModel}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-link hover:underline"
                >
                  Open model
                </a>
              </div>
            </div>
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-bg-elevated/90 shadow-[var(--shadow-soft)] backdrop-blur-[2px]">
              <div className="relative aspect-video w-full bg-bg-subtle">
                <iframe
                  title="Spaceport3D on YouTube"
                  src={site.media.youtube}
                  className="absolute inset-0 h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                <p className="text-sm text-fg-muted">YouTube · Spaceport3D</p>
                <a
                  href="https://www.youtube.com/spaceport3d"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-link hover:underline"
                >
                  Channel
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <FleetActivity />
    </main>
  );
}
