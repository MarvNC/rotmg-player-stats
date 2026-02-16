import { useEffect, useMemo, useState } from "react";
import dailyData from "./data/daily.json";
import { DataTable } from "./components/DataTable";
import { PlayerChart } from "./components/PlayerChart";
import { RangeSelector } from "./components/RangeSelector";
import { SharedRangeSlider } from "./components/SharedRangeSlider";
import { StatsCards } from "./components/StatsCards";
import type { DailyPoint, DateRange } from "./types";
import { filterByRange, resolvePresetRange, type RangePreset } from "./utils/dateRange";
import { buildStats, buildTableRows } from "./utils/metrics";

type Tab = "charts" | "table";
type ExpandedChart = "realmeye" | "realmstock" | "launcher" | null;

const data = (dailyData as DailyPoint[]).slice().sort((a, b) => a.date.localeCompare(b.date));
const allDates = data.map((item) => item.date);

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("charts");
  const [preset, setPreset] = useState<RangePreset>("ALL");
  const [range, setRange] = useState<DateRange>(() => resolvePresetRange(data, "ALL"));
  const [expandedChart, setExpandedChart] = useState<ExpandedChart>(null);

  const filtered = useMemo(() => filterByRange(data, range), [range]);
  const stats = useMemo(() => buildStats(data), []);

  const tableRows = useMemo(() => buildTableRows(filtered), [filtered]);

  const realmeyeSeries = useMemo(
    () => filtered.filter((item) => item.realmeye_min != null && item.realmeye_max != null),
    [filtered]
  );

  const realmstockSeries = useMemo(
    () => filtered.filter((item) => item.realmstock_min != null && item.realmstock_max != null),
    [filtered]
  );

  const realmeyeDates = useMemo(() => realmeyeSeries.map((item) => item.date), [realmeyeSeries]);
  const realmeyeMin = useMemo(() => realmeyeSeries.map((item) => item.realmeye_min), [realmeyeSeries]);
  const realmeyeMax = useMemo(() => realmeyeSeries.map((item) => item.realmeye_max), [realmeyeSeries]);

  const realmstockDates = useMemo(() => realmstockSeries.map((item) => item.date), [realmstockSeries]);
  const realmstockMin = useMemo(() => realmstockSeries.map((item) => item.realmstock_min), [realmstockSeries]);
  const realmstockMax = useMemo(() => realmstockSeries.map((item) => item.realmstock_max), [realmstockSeries]);

  const launcherSeries = useMemo(
    () => filtered.filter((item) => item.launcher_loads != null),
    [filtered]
  );

  const launcherDates = useMemo(() => launcherSeries.map((item) => item.date), [launcherSeries]);
  const launcherLoads = useMemo(() => launcherSeries.map((item) => item.launcher_loads), [launcherSeries]);

  useEffect(() => {
    if (expandedChart == null) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpandedChart(null);
      }
    };

    document.body.classList.add("modal-open");
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [expandedChart]);

  const expandedChartTitle =
    expandedChart === "realmeye"
      ? "RealmEye Active Players Over Time"
      : expandedChart === "realmstock"
        ? "RealmStock Live Players Over Time"
        : expandedChart === "launcher"
          ? "Launcher Loads Per Day"
        : null;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <h1>ROTMG Player Tracker</h1>
          <p>Daily player trends from RealmEye and RealmStock</p>
        </div>
      </header>

      <main className="page-container">
        <StatsCards stats={stats} />

        <section className="panel controls-panel">
          <div className="tabs" role="tablist" aria-label="View switcher">
            <button
              role="tab"
              aria-selected={activeTab === "charts"}
              className={`tab-button${activeTab === "charts" ? " active" : ""}`}
              onClick={() => setActiveTab("charts")}
            >
              Charts
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "table"}
              className={`tab-button${activeTab === "table" ? " active" : ""}`}
              onClick={() => setActiveTab("table")}
            >
              Data Table
            </button>
          </div>

          <RangeSelector
            active={preset}
            onSelect={(nextPreset) => {
              setPreset(nextPreset);
              setRange(resolvePresetRange(data, nextPreset));
            }}
          />
        </section>

        {activeTab === "charts" ? (
          <section className="charts-stack">
            <SharedRangeSlider
              dates={allDates}
              range={range}
              onChange={(nextRange) => {
                setPreset("ALL");
                setRange(nextRange);
              }}
            />

            <PlayerChart
              title="RealmEye Active Players Over Time"
              dates={realmeyeDates}
              minValues={realmeyeMin}
              maxValues={realmeyeMax}
              range={range}
              syncKey="rotmg-sync"
              onPopOut={() => setExpandedChart("realmeye")}
            />

            <PlayerChart
              title="RealmStock Live Players Over Time"
              dates={realmstockDates}
              minValues={realmstockMin}
              maxValues={realmstockMax}
              range={range}
              syncKey="rotmg-sync"
              onPopOut={() => setExpandedChart("realmstock")}
            />

            <PlayerChart
              title="Launcher Loads Per Day"
              dates={launcherDates}
              minValues={launcherLoads}
              maxValues={launcherLoads}
              range={range}
              syncKey="rotmg-sync"
              onPopOut={() => setExpandedChart("launcher")}
            />
          </section>
        ) : (
          <DataTable rows={tableRows} />
        )}

        {expandedChart != null && expandedChartTitle != null ? (
          <div
            className="chart-modal-backdrop"
            role="presentation"
            onClick={() => setExpandedChart(null)}
          >
            <div
              className="chart-modal"
              role="dialog"
              aria-modal="true"
              aria-label={`${expandedChartTitle} expanded view`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="chart-modal-header">
                <button
                  type="button"
                  className="outline-button"
                  onClick={() => setExpandedChart(null)}
                >
                  Close
                </button>
              </div>

                <PlayerChart
                  title={expandedChartTitle}
                  dates={
                    expandedChart === "realmeye"
                      ? realmeyeDates
                      : expandedChart === "realmstock"
                        ? realmstockDates
                        : launcherDates
                  }
                  minValues={
                    expandedChart === "realmeye"
                      ? realmeyeMin
                      : expandedChart === "realmstock"
                        ? realmstockMin
                        : launcherLoads
                  }
                  maxValues={
                    expandedChart === "realmeye"
                      ? realmeyeMax
                      : expandedChart === "realmstock"
                        ? realmstockMax
                        : launcherLoads
                  }
                  range={range}
                  syncKey="rotmg-modal-sync"
                  height={460}
                minHeightRatio={0.5}
              />
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
