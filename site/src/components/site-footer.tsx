import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { site } from "@/lib/site";
import { SocialIcon } from "@/components/social-icons";

export function SiteFooter() {
  return (
    <footer className="bg-bg/70 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-4 py-10 sm:px-6 sm:gap-8 sm:py-12">
        <div className="mx-auto w-[70%]">
          <div className="grid w-full grid-cols-5 gap-[clamp(0.3rem,1.2vw,0.55rem)] sm:grid-cols-10 sm:gap-[clamp(0.3rem,1vw,0.65rem)]">
            {site.social.filter((s) => s.id !== "simplewithus").map((s) => (
              <a
                key={s.id}
                href={s.href}
                target={s.id === "email" ? undefined : "_blank"}
                rel={s.id === "email" ? undefined : "noopener noreferrer"}
                aria-label={s.label}
                className="relative flex aspect-square w-full min-w-0 items-center justify-center rounded-[var(--radius-sm)] border border-border bg-bg-elevated/85 text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
              >
                <span className="pointer-events-none absolute inset-[18%] flex items-center justify-center [&_svg]:!h-full [&_svg]:!w-full [&_img]:!h-full [&_img]:!w-full">
                  <SocialIcon id={s.id} className="!size-full" />
                </span>
              </a>
            ))}
          </div>
        </div>

        <a
          href={site.catalog.root}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Browse the Simple With Us app catalog"
          className="rounded-[var(--radius-sm)] px-3 py-2 transition-opacity hover:opacity-75"
        >
          <img
            src="/brand/simple-with-us-wide.png"
            alt="Simple With Us"
            width={1920}
            height={200}
            className="h-auto w-[260px] max-w-full"
            loading="lazy"
            decoding="async"
          />
        </a>

        <div className="flex flex-col items-center gap-3">
          <p className="inline-flex items-center gap-2 text-base font-medium tracking-tight text-fg-muted sm:text-lg">
            <MapPin className="size-4 shrink-0 sm:size-5" aria-hidden />
            {site.location}
          </p>
          <Link
            to="/terms-of-service"
            className="text-[11px] text-fg-subtle/70 transition-colors hover:text-fg-subtle"
          >
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  );
}
