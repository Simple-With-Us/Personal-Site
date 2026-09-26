import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { site } from "@/lib/site";
import { SocialIcon } from "@/components/social-icons";
import { MorphingNavBrand } from "@/components/morphing-name";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/#about", label: "About" },
  { href: "/#work", label: "Work" },
  { href: "/#apps", label: "Apps" },
  { href: "/#activity", label: "Activity" },
] as const;

type OpenMenu = "none" | "sections" | "links";

export function SiteHeader({ className }: { className?: string }) {
  const [open, setOpen] = useState<OpenMenu>("none");
  const sectionsId = useId();
  const linksId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open === "none") return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen("none");
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen("none");
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    const close = () => setOpen("none");
    window.addEventListener("hashchange", close);
    return () => window.removeEventListener("hashchange", close);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border/80 bg-bg/80 backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:min-h-[4.25rem] sm:gap-4 sm:px-6 sm:py-3.5">
        <MorphingNavBrand />

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1" ref={rootRef}>
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-[var(--radius-sm)] px-2.5 py-2 text-sm text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg sm:px-3"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="relative sm:hidden">
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center rounded-[var(--radius-sm)] p-2.5 text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg",
                open === "sections" && "bg-bg-subtle text-fg",
              )}
              aria-expanded={open === "sections"}
              aria-controls={sectionsId}
              aria-haspopup="menu"
              aria-label={open === "sections" ? "Close menu" : "Open menu"}
              onClick={() =>
                setOpen((v) => (v === "sections" ? "none" : "sections"))
              }
            >
              {open === "sections" ? (
                <X className="size-5" aria-hidden />
              ) : (
                <Menu className="size-5" aria-hidden />
              )}
            </button>

            {open === "sections" ? (
              <div
                id={sectionsId}
                role="menu"
                aria-label="Site menu"
                className="absolute right-0 top-[calc(100%+0.35rem)] z-50 w-56 overflow-hidden rounded-[var(--radius-md)] border border-border bg-bg-elevated/95 py-1 shadow-[var(--shadow-soft)] backdrop-blur-sm"
              >
                {nav.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    className="block px-3 py-2.5 text-base font-medium tracking-tight text-fg transition-colors hover:bg-bg-subtle"
                    onClick={() => setOpen("none")}
                  >
                    {item.label}
                  </a>
                ))}
                <div className="my-1 border-t border-border" />
                {site.social.map((s) => (
                  <a
                    key={s.id}
                    href={s.href}
                    role="menuitem"
                    target={s.id === "email" ? undefined : "_blank"}
                    rel={s.id === "email" ? undefined : "noopener noreferrer"}
                    className="flex items-center gap-3 px-3 py-2 text-fg transition-colors hover:bg-bg-subtle"
                    onClick={() => setOpen("none")}
                  >
                    <span className="inline-flex size-5 shrink-0 items-center justify-center text-fg-muted">
                      <SocialIcon id={s.id} />
                    </span>
                    <span className="text-[13px] font-medium tracking-tight">{s.label}</span>
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div className="relative hidden sm:block">
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2.5 py-2 text-sm text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg sm:px-3",
                open === "links" && "bg-bg-subtle text-fg",
              )}
              aria-expanded={open === "links"}
              aria-controls={linksId}
              aria-haspopup="menu"
              onClick={() => setOpen((v) => (v === "links" ? "none" : "links"))}
            >
              Links
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform",
                  open === "links" && "rotate-180",
                )}
                aria-hidden
              />
            </button>

            {open === "links" ? (
              <div
                id={linksId}
                role="menu"
                aria-label="Social links"
                className="absolute right-0 top-[calc(100%+0.35rem)] z-50 w-56 overflow-hidden rounded-[var(--radius-md)] border border-border bg-bg-elevated/95 py-1 shadow-[var(--shadow-soft)] backdrop-blur-sm"
              >
                {site.social.map((s) => (
                  <a
                    key={s.id}
                    href={s.href}
                    role="menuitem"
                    target={s.id === "email" ? undefined : "_blank"}
                    rel={s.id === "email" ? undefined : "noopener noreferrer"}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm text-fg transition-colors hover:bg-bg-subtle"
                    onClick={() => setOpen("none")}
                  >
                    <span className="inline-flex size-5 shrink-0 items-center justify-center text-fg-muted">
                      <SocialIcon id={s.id} />
                    </span>
                    <span className="font-medium tracking-tight">{s.label}</span>
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
