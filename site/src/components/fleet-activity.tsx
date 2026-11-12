import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, GitMerge, CircleDot, CircleCheck, ListTodo } from "lucide-react";
import {
  DIGEST_URL,
  parseFleetDigest,
  repoLabel,
  type DigestDay,
  type DigestItem,
  type DigestSection,
  type RepoCode,
} from "@/lib/fleet-digest";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

const PARSE_MAX_DAYS = 60;
const PRIVATE_DESTINATION = /(?:fleet-ops|mac\.jays\.services|board\.jays\.services|control\.jays\.services)/i;

function isPublicItem(item: DigestItem): boolean {
  return item.repo !== "OPS" && !PRIVATE_DESTINATION.test(item.title) &&
    !(item.href && PRIVATE_DESTINATION.test(item.href));
}

/** Remove private rows before choosing a date or computing pagination bounds. */
export function publicDigestDays(days: DigestDay[]): DigestDay[] {
  return days.flatMap((day) => {
    const sections = day.sections
      .filter((section) => section.kind !== "effort")
      .map((section) => ({ ...section, items: section.items.filter(isPublicItem) }))
      .filter((section) => section.items.length > 0);
    return sections.length > 0 ? [{ ...day, sections }] : [];
  });
}

function formatDayLabel(raw: string): string {
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  return raw;
}

function repoClass(code: RepoCode): string {
  switch (code) {
    case "ST":
      return "bg-repo-st text-fg";
    case "CT":
      return "bg-repo-ct text-fg";
    case "UM":
      return "bg-repo-um text-fg";
    case "shared":
      return "bg-repo-shared text-fg";
    case "fleet":
      return "bg-repo-fleet text-fg";
    default:
      return "bg-bg-subtle text-fg-muted";
  }
}

function RepoBadge({ code }: { code: RepoCode }) {
  const icon =
    code in site.appIcons
      ? site.appIcons[code as keyof typeof site.appIcons]
      : undefined;

  if (icon) {
    return (
      <span
        className="inline-flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-xs)] border border-border bg-bg-elevated"
        title={repoLabel(code)}
      >
        <img
          src={icon}
          alt={repoLabel(code)}
          width={24}
          height={24}
          className="size-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-[var(--radius-xs)] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
        repoClass(code),
      )}
      title={repoLabel(code)}
    >
      {code === "other" ? "·" : code}
    </span>
  );
}

function visitorSectionLabel(kind: DigestSection["kind"], fallback: string): string {
  switch (kind) {
    case "prs":
      return "Merged Pull Requests";
    case "opened":
      return "Issues Opened";
    case "closed":
      return "Issues Closed";
    case "effort":
      return fallback;
    default: {
      const unreachable: never = kind;
      return unreachable;
    }
  }
}

function SectionIcon({ kind }: { kind: DigestSection["kind"] }) {
  const cls = "size-3.5 shrink-0 text-fg-subtle";
  switch (kind) {
    case "prs":
      return <GitMerge className={cls} aria-hidden />;
    case "opened":
      return <CircleDot className={cls} aria-hidden />;
    case "closed":
      return <CircleCheck className={cls} aria-hidden />;
    case "effort":
      return <ListTodo className={cls} aria-hidden />;
    default: {
      const unreachable: never = kind;
      return unreachable;
    }
  }
}

function ItemRow({ item }: { item: DigestItem }) {
  const body = (
    <>
      <RepoBadge code={item.repo} />
      <span className="min-w-0 flex-1 text-sm text-fg/95">{item.title}</span>
    </>
  );

  if (item.href) {
    return (
      <li>
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-start gap-2 rounded-[var(--radius-sm)] px-2 py-2.5 transition-colors hover:bg-bg-subtle"
        >
          {body}
        </a>
      </li>
    );
  }

  return (
    <li className="flex min-h-11 items-start gap-2 rounded-[var(--radius-sm)] px-2 py-2.5">
      {body}
    </li>
  );
}

function DayBody({ day }: { day: DigestDay }) {
  return (
    <div className="grid gap-4">
      {day.sections.map((section) => (
        <div key={section.label}>
          <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-fg-muted">
            <SectionIcon kind={section.kind} />
            {visitorSectionLabel(section.kind, section.label)}
            <span className="font-normal text-fg-subtle">
              · {section.items.length}
            </span>
          </div>
          <ul className="divide-y divide-border/60">
            {section.items.slice(0, 12).map((item, i) => (
              <ItemRow key={`${section.kind}-${i}-${item.title.slice(0, 40)}`} item={item} />
            ))}
          </ul>
          {section.items.length > 12 ? (
            <p className="mt-1 px-2 text-xs text-fg-subtle">
              {section.items.length - 12} more on the full activity page
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

async function loadDigest() {
  const res = await fetch(DIGEST_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Digest fetch failed (${res.status})`);
  const md = await res.text();
  return parseFleetDigest(md, DIGEST_URL, PARSE_MAX_DAYS);
}

export function FleetActivity() {
  const [dayIndex, setDayIndex] = useState(0);

  const q = useQuery({
    queryKey: ["fleet-digest"],
    queryFn: loadDigest,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const allDays = useMemo(() => publicDigestDays(q.data?.days ?? []), [q.data]);
  const day = allDays[dayIndex] ?? null;
  const canPrev = dayIndex < allDays.length - 1;
  const canNext = dayIndex > 0;

  const label = useMemo(
    () => (day ? formatDayLabel(day.date) : ""),
    [day],
  );

  return (
    <section id="activity" className="scroll-mt-20 bg-transparent">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mb-8 sm:mb-10">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-fg-subtle">
            Activity
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            Recent activity
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">
            A public log of recent changes.
          </p>
        </div>

        {q.isLoading ? (
          <div
            className="flex h-64 flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-border bg-bg-elevated/90"
            aria-busy="true"
            aria-live="polite"
          >
            <div className="h-2 w-40 animate-pulse rounded-full bg-bg-subtle" />
            <p className="text-sm text-fg-muted">Loading activity.</p>
          </div>
        ) : null}

        {q.isError ? (
          <div className="rounded-[var(--radius-lg)] border border-border bg-bg-elevated/90 p-6 text-sm text-fg-muted">
            <p>Could not load recent activity.</p>
            <a
              href={site.fleet.html}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-link hover:underline"
            >
              Open Full Activity
            </a>
          </div>
        ) : null}

        {day ? (
          <article className="rounded-[var(--radius-lg)] border border-border bg-bg-elevated/92 p-4 shadow-[var(--shadow-soft)] backdrop-blur-[2px] sm:p-5">
            <header className="mb-5">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  className={cn(
                    "inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-border text-fg transition-colors",
                    canPrev
                      ? "hover:bg-bg-subtle hover:border-border-strong"
                      : "cursor-not-allowed opacity-35",
                  )}
                  aria-label="Previous day"
                  disabled={!canPrev}
                  onClick={() => setDayIndex((i) => Math.min(i + 1, allDays.length - 1))}
                >
                  <ChevronLeft className="size-5" aria-hidden />
                </button>

                <h3 className="min-w-0 flex-1 text-center text-lg font-bold tracking-tight text-fg sm:text-xl">
                  {label}
                </h3>

                <button
                  type="button"
                  className={cn(
                    "inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-border text-fg transition-colors",
                    canNext
                      ? "hover:bg-bg-subtle hover:border-border-strong"
                      : "cursor-not-allowed opacity-35",
                  )}
                  aria-label="Next day"
                  disabled={!canNext}
                  onClick={() => setDayIndex((i) => Math.max(i - 1, 0))}
                >
                  <ChevronRight className="size-5" aria-hidden />
                </button>
              </div>
              <div className="mt-1 flex justify-center">
                <a
                  href={site.fleet.html}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-link hover:underline"
                >
                  See Full Activity
                </a>
              </div>
            </header>

            <DayBody day={day} />
          </article>
        ) : null}

        {!q.isLoading && !q.isError && allDays.length === 0 ? (
          <p className="text-sm text-fg-muted">No activity to show yet.</p>
        ) : null}
      </div>
    </section>
  );
}
