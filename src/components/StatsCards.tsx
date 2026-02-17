import { ArrowDown, Clock3, Trophy, Users } from "lucide-react";

import type { StatsSummary } from "../utils/metrics";

type StatsCardsProps = {
  stats: StatsSummary;
};

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function formatNumber(value: number | null): string {
  if (value == null) {
    return "-";
  }

  return Intl.NumberFormat("en-US").format(value);
}

function formatRelativeLastUpdated(value: string | null): string {
  if (value == null) {
    return "-";
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "-";
  }

  const now = new Date();
  const todayUtcTimestamp = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const dayDelta = Math.round((timestamp - todayUtcTimestamp) / millisecondsPerDay);

  return relativeTimeFormatter.format(dayDelta, "day");
}

export function StatsCards({ stats }: StatsCardsProps) {
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
        <p className="stat-value">{formatRelativeLastUpdated(stats.lastUpdatedDate)}</p>
        <p className="stat-meta">{stats.lastUpdatedDate ?? "-"} UTC</p>
      </article>
    </section>
  );
}
