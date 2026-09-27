import { ArrowRight, ExternalLink } from "lucide-react";
import { useState } from "react";
import { site } from "@/lib/site";
import { FleetActivity } from "@/components/fleet-activity";
import { HeroNameAnchor } from "@/components/morphing-name";
import { SocialIcon } from "@/components/social-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

function renderBlurbWithLinks(text: string): React.ReactNode {
  const domainRegex = /\b((?:[a-zA-Z0-9-]+\.)+(?:com|net|org|codes|services|trade|io|app|dev))\b/gi;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = domainRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(withDoubleSpaces(text.slice(lastIndex, match.index)));
    }
    const domain = match[1]!;
    const href = domain.startsWith("http") ? domain : `https://${domain.toLowerCase()}`;
    nodes.push(
      <a
        key={`${match.index}-${domain}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-[#2563eb] no-underline transition-colors hover:text-[#1d4ed8]"
      >
        {domain}
      </a>,
    );
    lastIndex = match.index + domain.length;
  }

  if (lastIndex < text.length) {
    nodes.push(withDoubleSpaces(text.slice(lastIndex)));
  }

  return nodes;
}

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
              href="https://sketchfab.com/Spaceport3D"
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
          <SectionLabel>Selected work</SectionLabel>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            Public projects
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">
            {withDoubleSpaces(
              "A few products and tools I build.  Open a live project or read its public source, then check Simple With Us for current platform availability.",
            )}
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {site.projects.map((p) => (
              <div
                key={p.key}
                className={cn(
                  "group flex flex-col rounded-[var(--radius-lg)] border border-border bg-bg-elevated/90 p-5 shadow-[var(--shadow-soft)] backdrop-blur-[2px]",
                  "transition-[border-color,transform] duration-200 ease-out hover:border-border-strong",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {"icon" in p && p.icon ? (
                      <img
                        src={p.icon}
                        alt=""
                        width={44}
                        height={44}
                        className="size-11 shrink-0 rounded-[var(--radius-sm)] border border-border bg-bg object-cover shadow-[var(--shadow-soft)]"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-border bg-bg-subtle text-xs font-semibold tracking-wide text-fg-muted">
                        {p.acronym ?? p.key.slice(0, 3).toUpperCase()}
                      </span>
                    )}
                    <h3 className="text-lg font-medium tracking-tight text-fg">{p.name}</h3>
                  </div>
                  <a
                    href={p.primaryHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${p.primaryLabel} ${p.name}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-subtle/80 px-2.5 py-1 text-xs font-medium text-fg-muted shadow-xs transition-all duration-150 hover:border-border-strong hover:bg-bg-elevated hover:text-fg group/btn"
                  >
                    <span>{p.primaryLabel}</span>
                    <ArrowRight
                      className="size-3.5 transition-transform group-hover/btn:translate-x-0.5"
                      aria-hidden
                    />
                  </a>
                </div>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-fg-muted">
                  {renderBlurbWithLinks(p.blurb)}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {p.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-border px-2.5 py-0.5 text-xs text-fg-subtle"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
                  <a
                    href={p.primaryHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-subtle px-3 py-1.5 text-xs font-semibold text-fg transition-colors hover:border-border-strong hover:bg-bg-elevated"
                  >
                    {p.primaryLabel}
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                  <a
                    href={p.sourceHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:text-fg"
                  >
                    <SocialIcon id="github" className="size-3.5" />
                    Source
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="apps" className="scroll-mt-20">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="flex flex-col gap-1">
            <SectionLabel>Availability</SectionLabel>
            <h2 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              Find the current release
            </h2>
            <p className="mt-1 text-sm text-fg-muted">
              {withDoubleSpaces(
                "Platform availability and beta links can change.  Simple With Us keeps the current app pages, supported platforms, and next actions together.",
              )}
            </p>
          </div>

          <a
            href={site.catalog.root}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90"
          >
            Open Simple With Us
            <ExternalLink className="size-3.5" aria-hidden />
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
                  href="https://sketchfab.com/Spaceport3D"
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
