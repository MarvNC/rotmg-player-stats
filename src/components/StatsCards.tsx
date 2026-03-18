import { useEffect, useState } from "react";
import type { DayComparison, StatsSummary } from "../utils/metrics";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

type StatsCardsProps = {
  stats: StatsSummary;
};

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function formatNumber(value: number | null): string {
  if (value == null) return "—";
  return Intl.NumberFormat("en-US").format(value);
}

function formatRelativeLastUpdated(value: string | null, nowTimestamp: number): string {
  if (value == null) return "—";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "—";

  const deltaInSeconds = Math.round((timestamp - nowTimestamp) / 1000);
  const abs = Math.abs(deltaInSeconds);

  if (abs < 60) return relativeTimeFormatter.format(deltaInSeconds, "second");
  const mins = Math.round(deltaInSeconds / 60);
  if (abs < 3600) return relativeTimeFormatter.format(mins, "minute");
  const hrs = Math.round(deltaInSeconds / 3600);
  if (abs < 86400) return relativeTimeFormatter.format(hrs, "hour");
  const days = Math.round(deltaInSeconds / 86400);
  if (abs < 2592000) return relativeTimeFormatter.format(days, "day");
  const months = Math.round(days / 30);
  if (abs < 31536000) return relativeTimeFormatter.format(months, "month");
  return relativeTimeFormatter.format(Math.round(days / 365), "year");
}

function isDataFresh(value: string | null, nowTimestamp: number): boolean {
  if (value == null) return false;
  const ts = Date.parse(value);
  return !Number.isNaN(ts) && nowTimestamp - ts < 15 * 60 * 1000;
}

/** Inline delta: "+1,234" or "−1,234" in emerald or red. No pill, no badge. */
function InlineDelta({ delta }: { delta: number | null }) {
  if (delta == null) return null;

  const isPositive = delta >= 0;
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
  const formatted = Intl.NumberFormat("en-US").format(Math.abs(delta));

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[0.72rem] font-semibold tabular-nums ${
        isPositive ? "text-[var(--color-emerald)]" : "text-[var(--color-brand-red)]"
      }`}
      style={{ fontFamily: '"JetBrains Mono", monospace' }}
      aria-label={`${isPositive ? "+" : "−"}${formatted} vs yesterday`}
    >
      <Icon size={10} strokeWidth={2.5} aria-hidden="true" />
      {isPositive ? "+" : "−"}
      {formatted}
    </span>
  );
}

/** A single metric datum: label + number + optional inline delta. No card. */
function Datum({
  label,
  comparison,
  tier,
}: {
  label: string;
  comparison: DayComparison;
  tier: "primary" | "secondary";
}) {
  const isPrimary = tier === "primary";

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span
        className="text-[0.72rem] uppercase tracking-[0.14em] text-[var(--color-text-muted)] whitespace-nowrap leading-none"
        style={{ fontFamily: '"Sora", sans-serif' }}
      >
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span
          className={`leading-none font-bold tabular-nums ${
            isPrimary
              ? "text-[1.35rem] text-[var(--color-text-main)]"
              : "text-[1.1rem] text-[var(--color-text-main)] opacity-75"
          }`}
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          {formatNumber(comparison.current)}
        </span>
        <InlineDelta delta={comparison.delta} />
      </div>
    </div>
  );
}

/** Archival datum: just label + value + date, no delta, rendered smaller. */
function ArchivalDatum({ label, value, date }: { label: string; value: number | null; date: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span
        className="text-[0.7rem] uppercase tracking-[0.14em] text-[var(--color-text-muted)] opacity-70 whitespace-nowrap leading-none"
        style={{ fontFamily: '"Sora", sans-serif' }}
      >
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-[1.05rem] leading-none font-semibold tabular-nums text-[var(--color-text-muted)]"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          {formatNumber(value)}
        </span>
        {date != null && (
          <span
            className="text-[0.7rem] text-[var(--color-text-muted)] opacity-60 tabular-nums whitespace-nowrap"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            {date}
          </span>
        )}
      </div>
    </div>
  );
}

export function StatsCards({ stats }: StatsCardsProps) {
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowTimestamp(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const fresh = isDataFresh(stats.lastUpdatedAt, nowTimestamp);
  const relativeTime = formatRelativeLastUpdated(stats.lastUpdatedAt, nowTimestamp);

  return (
    <section
      className="border-b border-[var(--color-surface-2)] pb-5 animate-[card-enter_400ms_cubic-bezier(0.22,1,0.36,1)_both]"
      aria-label="Summary statistics"
    >
      {/* ── Primary strip ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        {/* Hero: RealmEye active count — largest, red, no box */}
        <div className="flex flex-col gap-0.5">
          <span
            className="text-[0.72rem] uppercase tracking-[0.14em] text-[var(--color-text-muted)] whitespace-nowrap leading-none"
            style={{ fontFamily: '"Sora", sans-serif' }}
          >
            Active Players · RealmEye
          </span>
          <span
            className="text-[2.6rem] leading-none font-bold tabular-nums text-[var(--color-brand-red)]"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
            aria-label={`RealmEye active players: ${formatNumber(stats.currentRealmeye)}`}
          >
            {formatNumber(stats.currentRealmeye)}
          </span>
        </div>

        {/* Vertical rule — hidden on tiny screens */}
        <span className="hidden sm:block self-stretch w-px bg-[var(--color-surface-2)]" aria-hidden="true" />

        {/* Tier-2 metrics: RealmStock + Launcher */}
        <Datum label="Online Now · RealmStock" comparison={stats.currentRealmstock} tier="primary" />
        <Datum label="Launcher Loads · 24h" comparison={stats.launcherLoads24h} tier="primary" />

        {/* Push freshness to the far right on wide screens */}
        <div className="flex items-center gap-1.5 ml-auto shrink-0 pb-0.5">
          {fresh ? (
            <span className="relative flex h-1.5 w-1.5" aria-label="Data is live">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-emerald)] opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-emerald)]" />
            </span>
          ) : (
            <span
              className="h-1.5 w-1.5 rounded-full bg-[var(--color-text-muted)] opacity-40"
              aria-label="Data may be stale"
            />
          )}
          <span
            className="text-[0.7rem] uppercase tracking-[0.1em] text-[var(--color-text-muted)] tabular-nums whitespace-nowrap"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            {relativeTime}
          </span>
        </div>
      </div>

      {/* ── Archival strip (all-time records) ─────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3">
        <ArchivalDatum label="All-Time Peak" value={stats.allTimePeak.value} date={stats.allTimePeak.date} />
        <span className="text-[var(--color-surface-2)] text-xs select-none" aria-hidden="true">
          ·
        </span>
        <ArchivalDatum label="All-Time Low" value={stats.allTimeLow.value} date={stats.allTimeLow.date} />
      </div>
    </section>
  );
}
