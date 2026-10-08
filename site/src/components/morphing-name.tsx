import { useLayoutEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Large name sits in the top-left of the header, then shrinks to compact
 * brand size as the user scrolls down. No separate hero float.
 */
export function MorphingNavBrand({ className }: { className?: string }) {
  const isHome = useRouterState({
    select: (s) => s.location.pathname === "/" || s.location.pathname === "",
  });
  const [progress, setProgress] = useState(isHome ? 0 : 1);
  const prefersReduced = useRef(false);

  useLayoutEffect(() => {
    prefersReduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Off the homepage the rendered size is derived (`t` is 1).  Setting
    // progress here would be a synchronous setState in the effect.
    if (!isHome) {
      return;
    }

    const RANGE = 140;

    const onScroll = () => {
      if (prefersReduced.current) {
        setProgress(window.scrollY > 16 ? 1 : 0);
        return;
      }
      const raw = clamp(window.scrollY / RANGE, 0, 1);
      setProgress(easeOutCubic(raw));
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  const largeRem = 2.05;
  const largeRemSm = 2.35;
  const smallRem = 1;
  const t = isHome ? progress : 1;
  const sizeRem = largeRem + (smallRem - largeRem) * t;
  const sizeRemSm = largeRemSm + (smallRem - largeRemSm) * t;
  const tracking = -0.03 + 0.03 * t;

  return (
    <Link
      id="nav-name"
      to="/"
      className={cn(
        "relative z-[51] font-medium text-fg transition-[opacity] duration-150 hover:opacity-80",
        // Extra bottom padding so Lato descenders (g) are not clipped
        "inline-flex max-w-[min(70vw,20rem)] items-center pb-[0.18em] leading-[1.15] sm:max-w-none",
        className,
      )}
      style={
        {
          fontSize: `clamp(1rem, ${sizeRem}rem, ${sizeRemSm}rem)`,
          letterSpacing: `${tracking}em`,
          ["--nav-name-size" as string]: `${sizeRem}rem`,
        } as React.CSSProperties
      }
      aria-label={site.name}
    >
      <span
        className="block overflow-visible sm:whitespace-nowrap"
        style={{
          fontSize: "inherit",
          letterSpacing: "inherit",
          lineHeight: 1.15,
          paddingBottom: "0.12em",
        }}
      >
        {site.name}
      </span>
      <style>{`
        @media (min-width: 640px) {
          #nav-name {
            font-size: ${sizeRemSm}rem !important;
          }
        }
      `}</style>
    </Link>
  );
}

export function HeroNameAnchor({ className }: { className?: string }) {
  return (
    <h1 id="hero-name" className={cn("sr-only", className)}>
      {site.name}
    </h1>
  );
}
