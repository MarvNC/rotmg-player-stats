import { useEffect, useState } from "react";
import type { LucideProps } from "lucide-react";
import type { DayComparison, StatsSummary } from "../utils/metrics";
import { ArrowDown, ArrowDownRight, ArrowUpRight, Minus, Rocket, Trophy, Users } from "lucide-react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";

type StatsCardsProps = {
  stats: StatsSummary;
};

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const localDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "long",
});

function formatNumber(value: number | null): string {
  if (value == null) {
    return "—";
  }

  return Intl.NumberFormat("en-US").format(value);
}

function formatRelativeLastUpdated(value: string | null, nowTimestamp: number): string {
  if (value == null) {
    return "—";
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "—";
  }

  const deltaInSeconds = Math.round((timestamp - nowTimestamp) / 1000);
  const absoluteSeconds = Math.abs(deltaInSeconds);

  if (absoluteSeconds < 60) {
    return relativeTimeFormatter.format(deltaInSeconds, "second");
  }

  const deltaInMinutes = Math.round(deltaInSeconds / 60);
  if (absoluteSeconds < 60 * 60) {
    return relativeTimeFormatter.format(deltaInMinutes, "minute");
  }

  const deltaInHours = Math.round(deltaInSeconds / (60 * 60));
  if (absoluteSeconds < 24 * 60 * 60) {
    return relativeTimeFormatter.format(deltaInHours, "hour");
  }

  const deltaInDays = Math.round(deltaInSeconds / (24 * 60 * 60));
  if (absoluteSeconds < 30 * 24 * 60 * 60) {
    return relativeTimeFormatter.format(deltaInDays, "day");
  }

  const deltaInMonths = Math.round(deltaInDays / 30);
  if (absoluteSeconds < 365 * 24 * 60 * 60) {
    return relativeTimeFormatter.format(deltaInMonths, "month");
  }

  const deltaInYears = Math.round(deltaInDays / 365);

  return relativeTimeFormatter.format(deltaInYears, "year");
}

function formatLocalLastUpdated(value: string | null): string {
  if (value == null) {
    return "—";
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "—";
  }

  return localDateTimeFormatter.format(new Date(timestamp));
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[0.75rem] font-semibold tabular-nums text-[var(--color-text-muted)]"
        style={{ fontFamily: '"JetBrains Mono", monospace' }}
        aria-label="No comparison available"
      >
        <Minus size={11} aria-hidden="true" />
        <span>vs yesterday</span>
      </span>
    );
  }

  const isPositive = delta >= 0;
  const sign = isPositive ? "+" : "";
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
  const colorClass = isPositive ? "text-[var(--color-emerald)]" : "text-[var(--color-brand-red)]";

  return (
    <span
      className={`inline-flex items-center gap-1 text-[0.75rem] font-semibold tabular-nums ${colorClass}`}
      style={{ fontFamily: '"JetBrains Mono", monospace' }}
      aria-label={`${sign}${Intl.NumberFormat("en-US").format(delta)} compared to yesterday`}
    >
      <Icon size={11} aria-hidden="true" />
      <span>
        {sign}
        {Intl.NumberFormat("en-US").format(delta)} vs yesterday
      </span>
    </span>
  );
}

type LucideIcon = ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;

function PrimaryMetricCard({
  label,
  icon: Icon,
  comparison,
  unit,
  animDelay = "0ms",
}: {
  label: string;
  icon: LucideIcon;
  comparison: DayComparison;
  unit?: string;
  animDelay?: string;
}) {
  return (
    <article
      className="border border-[var(--color-surface-2)] rounded-xl bg-[var(--color-surface-1)] p-5 transition-all duration-130 hover:border-[rgba(220,40,40,0.38)] grid gap-3"
      style={{ animationDelay: animDelay }}
      aria-label={label}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-xs uppercase tracking-widest">
          <Icon size={13} aria-hidden="true" className="text-[var(--color-brand-red)]" />
          <span>{label}</span>
        </div>
        {unit != null ? (
          <span className="text-[0.7rem] text-[var(--color-text-muted)] uppercase tracking-wider">{unit}</span>
        ) : null}
      </div>

      <div
        className="text-[2.5rem] leading-none font-bold tabular-nums text-[var(--color-text-main)]"
        style={{ fontFamily: '"JetBrains Mono", monospace' }}
        aria-label={`Current value: ${formatNumber(comparison.current)}`}
      >
        {formatNumber(comparison.current)}
      </div>

      <DeltaBadge delta={comparison.delta} />
    </article>
  );
}

export function StatsCards({ stats }: StatsCardsProps) {
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowTimestamp(Date.now());
    }, 30 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <section className="grid gap-5" aria-label="Summary statistics">
      {/* Top row: current realmeye (hero) + update timestamp */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 animate-[fade-in-up_400ms_ease_both]">
        <div>
          <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-xs uppercase tracking-widest mb-2">
            <Users size={13} aria-hidden="true" className="text-[var(--color-brand-red)]" />
            <span>Active Players (RealmEye)</span>
          </div>
          <div
            className="text-[3.5rem] md:text-[4.5rem] leading-none font-bold tabular-nums text-[var(--color-text-main)]"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
            aria-label={`Current RealmEye count: ${formatNumber(stats.currentRealmeye)}`}
          >
            {formatNumber(stats.currentRealmeye)}
          </div>
        </div>

        <div className="text-[var(--color-text-muted)] text-sm">
          <span className="tabular-nums">{formatRelativeLastUpdated(stats.lastUpdatedAt, nowTimestamp)}</span>
          <span className="mx-2">·</span>
          <span className="tabular-nums">{formatLocalLastUpdated(stats.lastUpdatedAt)} local time</span>
        </div>
      </div>

      {/* Primary metric cards: live players + launcher loads, with yesterday delta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-[fade-in-up_400ms_ease_80ms_both]">
        <PrimaryMetricCard
          label="Current Players (RealmStock)"
          icon={Users}
          comparison={stats.currentRealmstock}
          animDelay="80ms"
        />
        <PrimaryMetricCard
          label="Launcher Loads (Past 24h)"
          icon={Rocket}
          comparison={stats.launcherLoads24h}
          unit="loads / day"
          animDelay="130ms"
        />
      </div>

      {/* Secondary cards: all-time records */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-[fade-in-up_400ms_ease_180ms_both]">
        <article
          className="border border-[var(--color-surface-2)] rounded-xl bg-[var(--color-surface-1)] p-4 transition-all duration-130 hover:border-[rgba(220,40,40,0.38)]"
          aria-label="All-time peak player count"
        >
          <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-xs uppercase tracking-widest mb-3">
            <Trophy size={13} aria-hidden="true" className="text-[var(--color-brand-red)]" />
            <span>All-Time Peak</span>
          </div>
          <div
            className="text-[1.75rem] leading-none font-semibold tabular-nums text-[var(--color-text-main)] mb-2"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            {formatNumber(stats.allTimePeak.value)}
          </div>
          <div className="text-[var(--color-text-muted)] text-sm tabular-nums">{stats.allTimePeak.date ?? "—"}</div>
        </article>

        <article
          className="border border-[var(--color-surface-2)] rounded-xl bg-[var(--color-surface-1)] p-4 transition-all duration-130 hover:border-[rgba(220,40,40,0.38)]"
          aria-label="All-time low player count"
        >
          <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-xs uppercase tracking-widest mb-3">
            <ArrowDown size={13} aria-hidden="true" className="text-[var(--color-brand-red)]" />
            <span>All-Time Low</span>
          </div>
          <div
            className="text-[1.75rem] leading-none font-semibold tabular-nums text-[var(--color-text-main)] mb-2"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            {formatNumber(stats.allTimeLow.value)}
          </div>
          <div className="text-[var(--color-text-muted)] text-sm tabular-nums">{stats.allTimeLow.date ?? "—"}</div>
        </article>
      </div>
    </section>
  );
}
