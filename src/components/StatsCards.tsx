import { useEffect, useState } from "react";
import type { StatsSummary } from "../utils/metrics";
import { ArrowDown, Clock3, Trophy, Users } from "lucide-react";

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
    <section className="stats-grid" aria-label="Summary statistics">
      <article className="stat-card">
        <p className="stat-label with-icon">
          <Users size={14} aria-hidden="true" />
          Current RealmEye Count
        </p>
        <p className="stat-value mono">{formatNumber(stats.currentRealmeye)}</p>
      </article>

      <article className="stat-card">
        <p className="stat-label with-icon">
          <Trophy size={14} aria-hidden="true" />
          All-Time Peak
        </p>
        <p className="stat-value mono">{formatNumber(stats.allTimePeak.value)}</p>
        <p className="stat-meta">{stats.allTimePeak.date ?? "-"}</p>
      </article>

      <article className="stat-card">
        <p className="stat-label with-icon">
          <ArrowDown size={14} aria-hidden="true" />
          All-Time Low
        </p>
        <p className="stat-value mono">{formatNumber(stats.allTimeLow.value)}</p>
        <p className="stat-meta">{stats.allTimeLow.date ?? "-"}</p>
      </article>

      <article className="stat-card">
        <p className="stat-label with-icon">
          <Clock3 size={14} aria-hidden="true" />
          Last Updated
        </p>
        <p className="stat-value">{formatRelativeLastUpdated(stats.lastUpdatedAt, nowTimestamp)}</p>
        <p className="stat-meta">{formatLocalLastUpdated(stats.lastUpdatedAt)} local time</p>
      </article>
    </section>
  );
}
