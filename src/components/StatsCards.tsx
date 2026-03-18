import { useEffect, useState } from "react";
import type { StatsSummary } from "../utils/metrics";
import { ArrowDown, Trophy, Users } from "lucide-react";

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
    return "-";
  }

  return Intl.NumberFormat("en-US").format(value);
}

function formatRelativeLastUpdated(value: string | null, nowTimestamp: number): string {
  if (value == null) {
    return "-";
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "-";
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
    return "-";
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "-";
  }

  return localDateTimeFormatter.format(new Date(timestamp));
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
    <section className="flex flex-col gap-8" aria-label="Summary statistics">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div className="animate-[fade-in-up_400ms_ease_both]">
          <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-xs uppercase tracking-widest mb-2">
            <Users size={14} aria-hidden="true" className="text-[var(--color-brand-red)]" />
            <span>Current RealmEye Count</span>
          </div>
          <div
            className="text-[3.5rem] md:text-[4.5rem] leading-none font-bold tabular-nums text-[var(--color-text-main)]"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            {formatNumber(stats.currentRealmeye)}
          </div>
        </div>

        <div className="text-[var(--color-text-muted)] text-sm animate-[fade-in-up_400ms_ease_100ms_both]">
          <span className="tabular-nums">{formatRelativeLastUpdated(stats.lastUpdatedAt, nowTimestamp)}</span>
          <span className="mx-2">·</span>
          <span className="tabular-nums">{formatLocalLastUpdated(stats.lastUpdatedAt)} local time</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border border-[var(--color-surface-2)] rounded-xl bg-[var(--color-surface-1)] p-4 transition-all duration-130 hover:border-[rgba(220,40,40,0.38)] animate-[fade-in-up_400ms_ease_150ms_both]">
          <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-xs uppercase tracking-widest mb-3">
            <Trophy size={14} aria-hidden="true" className="text-[var(--color-brand-red)]" />
            <span>All-Time Peak</span>
          </div>
          <div
            className="text-[1.75rem] leading-none font-semibold tabular-nums text-[var(--color-text-main)] mb-2"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            {formatNumber(stats.allTimePeak.value)}
          </div>
          <div className="text-[var(--color-text-muted)] text-sm tabular-nums">{stats.allTimePeak.date ?? "-"}</div>
        </div>

        <div className="border border-[var(--color-surface-2)] rounded-xl bg-[var(--color-surface-1)] p-4 transition-all duration-130 hover:border-[rgba(220,40,40,0.38)] animate-[fade-in-up_400ms_ease_200ms_both]">
          <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-xs uppercase tracking-widest mb-3">
            <ArrowDown size={14} aria-hidden="true" className="text-[var(--color-brand-red)]" />
            <span>All-Time Low</span>
          </div>
          <div
            className="text-[1.75rem] leading-none font-semibold tabular-nums text-[var(--color-text-main)] mb-2"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            {formatNumber(stats.allTimeLow.value)}
          </div>
          <div className="text-[var(--color-text-muted)] text-sm tabular-nums">{stats.allTimeLow.date ?? "-"}</div>
        </div>
      </div>
    </section>
  );
}
