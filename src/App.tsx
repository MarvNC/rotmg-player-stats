import { useEffect, useMemo, useState } from "react";
import { LineChart, MonitorCog, Moon, Sun, Table2, X } from "lucide-react";
import compactData from "./data/daily.json";
import { DataTable } from "./components/DataTable";
import { PlayerChart } from "./components/PlayerChart";
import { RangeSelector } from "./components/RangeSelector";
import { SharedRangeSlider } from "./components/SharedRangeSlider";
import { StatsCards } from "./components/StatsCards";
import type { CompactDaily, DateRange } from "./types";
import { filterByRange, resolvePresetRange, type RangePreset } from "./utils/dateRange";
import { decodeDailyData } from "./utils/decodeDailyData";
import { buildStats, buildTableRows } from "./utils/metrics";

type Tab = "charts" | "table";
type ExpandedChart = "realmeye" | "realmstock" | "launcher" | null;
type ThemeMode = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

const CHART_COPY = {
  realmeye: {
    title: "RealmEye Active Players Over Time",
    subtitle: "Amount of players seen in the past two weeks, based on RealmEye data."
  },
  realmstock: {
    title: "RotMG Max Live Players Over Time",
    subtitle: "Maximum number of players logged in at any point each day, based on RealmStock data."
  },
  launcher: {
    title: "Launcher Loads Per Day",
    subtitle: "Total number of times the game launcher was opened each day."
  }
} as const;

const SITE_URL = "https://rotmg-stats.maarv.dev/";

const data = decodeDailyData(compactData as CompactDaily).sort((a, b) => a.date.localeCompare(b.date));
const allDates = data.map((item) => item.date);

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("charts");
  const [preset, setPreset] = useState<RangePreset>("ALL");
  const [range, setRange] = useState<DateRange>(() => resolvePresetRange(data, "ALL"));
  const [expandedChart, setExpandedChart] = useState<ExpandedChart>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "system";
    }

    const stored = window.localStorage.getItem("rotmg-theme-mode");
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  });
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (typeof window === "undefined") {
      return "dark";
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const nextTheme: ResolvedTheme =
        themeMode === "system" ? (mediaQuery.matches ? "dark" : "light") : themeMode;

      document.documentElement.dataset.theme = nextTheme;
      setResolvedTheme(nextTheme);
    };

    applyTheme();

    const onSchemeChange = () => {
      if (themeMode === "system") {
        applyTheme();
      }
    };

    mediaQuery.addEventListener("change", onSchemeChange);

    return () => {
      mediaQuery.removeEventListener("change", onSchemeChange);
    };
  }, [themeMode]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("rotmg-theme-mode", themeMode);
    }
  }, [themeMode]);

  const themeButton =
    themeMode === "system"
      ? { Icon: MonitorCog, label: "System" }
      : themeMode === "light"
        ? { Icon: Sun, label: "Light" }
        : { Icon: Moon, label: "Dark" };

  const cycleThemeMode = () => {
    setThemeMode((current) => (current === "system" ? "light" : current === "light" ? "dark" : "system"));
  };

  const expandedChartTitle =
    expandedChart === "realmeye"
      ? CHART_COPY.realmeye.title
    : expandedChart === "realmstock"
        ? CHART_COPY.realmstock.title
        : expandedChart === "launcher"
          ? CHART_COPY.launcher.title
          : null;

  const expandedChartSubtitle =
    expandedChart === "realmeye"
      ? CHART_COPY.realmeye.subtitle
      : expandedChart === "realmstock"
        ? CHART_COPY.realmstock.subtitle
        : expandedChart === "launcher"
          ? CHART_COPY.launcher.subtitle
          : null;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <img className="brand-icon" src="/image.png" width={40} height={40} alt="RotMG Player Stats logo" />
            <h1>RotMG Player Stats</h1>
          </div>

          <button
            type="button"
            className="theme-mode-button"
            onClick={cycleThemeMode}
            aria-label={`Theme mode: ${themeButton.label}. Click to switch mode.`}
            title={`Theme: ${themeButton.label}`}
          >
            <themeButton.Icon size={16} strokeWidth={2} aria-hidden="true" />
            <span>{themeButton.label}</span>
          </button>
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
              <LineChart size={15} aria-hidden="true" />
              Charts
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "table"}
              className={`tab-button${activeTab === "table" ? " active" : ""}`}
              onClick={() => setActiveTab("table")}
            >
              <Table2 size={15} aria-hidden="true" />
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
              title={CHART_COPY.realmeye.title}
              subtitle={CHART_COPY.realmeye.subtitle}
              shareUrl={SITE_URL}
              dates={realmeyeDates}
              minValues={realmeyeMin}
              maxValues={realmeyeMax}
              theme={resolvedTheme}
              range={range}
              syncKey="rotmg-sync"
              onPopOut={() => setExpandedChart("realmeye")}
            />

            <PlayerChart
              title={CHART_COPY.realmstock.title}
              subtitle={CHART_COPY.realmstock.subtitle}
              shareUrl={SITE_URL}
              dates={realmstockDates}
              minValues={realmstockMin}
              maxValues={realmstockMax}
              tooltipValueLabel="players online"
              theme={resolvedTheme}
              range={range}
              syncKey="rotmg-sync"
              onPopOut={() => setExpandedChart("realmstock")}
            />

            <PlayerChart
              title={CHART_COPY.launcher.title}
              subtitle={CHART_COPY.launcher.subtitle}
              shareUrl={SITE_URL}
              dates={launcherDates}
              minValues={launcherLoads}
              maxValues={launcherLoads}
              tooltipValueLabel="loads"
              theme={resolvedTheme}
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
                  <X size={14} aria-hidden="true" />
                  Close
                </button>
              </div>

              <SharedRangeSlider
                dates={allDates}
                range={range}
                onChange={(nextRange) => {
                  setPreset("ALL");
                  setRange(nextRange);
                }}
              />

              <PlayerChart
                title={expandedChartTitle}
                subtitle={expandedChartSubtitle ?? undefined}
                shareUrl={SITE_URL}
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
                tooltipValueLabel={
                  expandedChart === "realmstock"
                    ? "players online"
                    : expandedChart === "launcher"
                      ? "loads"
                      : "players"
                }
                theme={resolvedTheme}
                range={range}
                syncKey="rotmg-modal-sync"
                height={460}
                minHeightRatio={0.5}
                enableExport
              />
            </div>
          </div>
        ) : null}
      </main>

      <footer className="app-footer">
        <p>
          Built by{" "}
          <a
            href="https://github.com/MarvNC/rotmg-player-stats"
            target="_blank"
            rel="noopener noreferrer"
          >
            MarvNC
          </a>
        </p>
        <p>
          Data from{" "}
          <a
            href="https://www.realmeye.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Realmeye
          </a>
          {" and "}
          <a
            href="https://realmstock.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
           Realmstock
          </a>
        </p>
        <p>
          Website: {" "}
          <a
            href="https://rotmg-stats.maarv.dev/"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://rotmg-stats.maarv.dev/
          </a>
        </p>
      </footer>
    </div>
  );
}
