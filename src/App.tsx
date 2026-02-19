import { useEffect, useMemo, useState } from "react";
import { Github, LineChart, MonitorCog, Moon, Sun, Table2, X } from "lucide-react";
import { AppSkeleton } from "./components/AppSkeleton";
import { DataTable } from "./components/DataTable";
import { PlayerChart } from "./components/PlayerChart";
import { RangeSelector } from "./components/RangeSelector";
import { SharedRangeSlider } from "./components/SharedRangeSlider";
import { StatsCards } from "./components/StatsCards";
import { useDailyData } from "./hooks/useDailyData";
import type { DateRange } from "./types";
import { filterByRange, resolvePresetRange, type RangePreset } from "./utils/dateRange";
import { buildStats, buildTableRows } from "./utils/metrics";

type Tab = "charts" | "table";
type ExpandedChart = "realmeye" | "realmstock" | "launcher" | null;
type ThemeMode = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

const CHART_COPY = {
  realmeye: {
    title: "RotMG Active Players Over Time",
    subtitle: "Amount of players seen in the past two weeks.",
  },
  realmstock: {
    title: "RotMG Max Online Players Over Time",
    subtitle: "Maximum number of players logged in at any point each day.",
    smoothedSubtitle: "7-day rolling average of daily max live players.",
  },
  launcher: {
    title: "RotMG Launcher Loads Per Day",
    subtitle: "Total number of times the game launcher was opened each day.",
    smoothedSubtitle: "7-day rolling average of total launcher loads per day.",
  },
} as const;

const SITE_URL = "https://rotmg-stats.maarv.dev/";
const GITHUB_PROFILE_URL = "https://github.com/MarvNC";
const GITHUB_REPO_URL = "https://github.com/MarvNC/rotmg-player-stats";

function smoothWeekly(values: Array<number | null>): Array<number | null> {
  const windowDays = 7;
  const smoothed: Array<number | null> = [];

  for (let index = 0; index < values.length; index += 1) {
    const start = Math.max(0, index - windowDays + 1);
    let sum = 0;
    let count = 0;

    for (let cursor = start; cursor <= index; cursor += 1) {
      const value = values[cursor];
      if (value == null) {
        continue;
      }

      sum += value;
      count += 1;
    }

    smoothed.push(count > 0 ? Math.round(sum / count) : null);
  }

  return smoothed;
}

export default function App() {
  const { data, lastUpdatedAt, isLoading, error, retry } = useDailyData();
  const [activeTab, setActiveTab] = useState<Tab>("charts");
  const [preset, setPreset] = useState<RangePreset>("2Y");
  const [range, setRange] = useState<DateRange>(() => resolvePresetRange([], "2Y"));
  const [hasRangeOverride, setHasRangeOverride] = useState(false);
  const [expandedChart, setExpandedChart] = useState<ExpandedChart>(null);
  const [isRealmeyeYAxisZeroOn, setIsRealmeyeYAxisZeroOn] = useState(false);
  const [isRealmstockYAxisZeroOn, setIsRealmstockYAxisZeroOn] = useState(false);
  const [isLauncherYAxisZeroOn, setIsLauncherYAxisZeroOn] = useState(false);
  const [isRealmstockWeeklySmoothOn, setIsRealmstockWeeklySmoothOn] = useState(true);
  const [isLauncherWeeklySmoothOn, setIsLauncherWeeklySmoothOn] = useState(true);
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

  const allDates = useMemo(() => data.map((item) => item.date), [data]);
  const effectiveRange = useMemo(() => {
    if (data.length === 0) {
      return range;
    }

    return hasRangeOverride ? range : resolvePresetRange(data, preset);
  }, [data, hasRangeOverride, preset, range]);

  const filtered = useMemo(() => filterByRange(data, effectiveRange), [data, effectiveRange]);
  const stats = useMemo(() => buildStats(data, lastUpdatedAt), [data, lastUpdatedAt]);

  const tableRows = useMemo(() => buildTableRows(filtered), [filtered]);

  const realmeyeSeries = useMemo(() => filtered.filter((item) => item.realmeye_max != null), [filtered]);

  const realmstockSeries = useMemo(() => filtered.filter((item) => item.realmstock_max != null), [filtered]);

  const realmeyeDates = useMemo(() => realmeyeSeries.map((item) => item.date), [realmeyeSeries]);
  const realmeyeMax = useMemo(() => realmeyeSeries.map((item) => item.realmeye_max), [realmeyeSeries]);

  const realmstockDates = useMemo(() => realmstockSeries.map((item) => item.date), [realmstockSeries]);
  const realmstockMax = useMemo(() => realmstockSeries.map((item) => item.realmstock_max), [realmstockSeries]);
  const realmstockSmoothedMax = useMemo(() => smoothWeekly(realmstockMax), [realmstockMax]);

  const launcherSeries = useMemo(() => filtered.filter((item) => item.launcher_loads != null), [filtered]);

  const launcherDates = useMemo(() => launcherSeries.map((item) => item.date), [launcherSeries]);
  const launcherLoads = useMemo(() => launcherSeries.map((item) => item.launcher_loads), [launcherSeries]);
  const launcherSmoothedLoads = useMemo(() => smoothWeekly(launcherLoads), [launcherLoads]);

  const realmstockSubtitle = isRealmstockWeeklySmoothOn
    ? CHART_COPY.realmstock.smoothedSubtitle
    : CHART_COPY.realmstock.subtitle;
  const launcherSubtitle = isLauncherWeeklySmoothOn
    ? CHART_COPY.launcher.smoothedSubtitle
    : CHART_COPY.launcher.subtitle;

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
      const nextTheme: ResolvedTheme = themeMode === "system" ? (mediaQuery.matches ? "dark" : "light") : themeMode;

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

  const renderWeeklySmoothingToggle = (chartTitle: string, isActive: boolean, onToggle: () => void) => (
    <button
      type="button"
      className={`inline-flex items-center justify-center min-h-[30px] px-3 py-1.5 text-[0.74rem] font-bold tracking-wide cursor-pointer transition-all duration-130 border rounded-full ${
        isActive
          ? "bg-[var(--color-pill-active-bg)] border-[var(--color-pill-active-border)] text-white"
          : "bg-[color-mix(in_srgb,var(--color-surface-1)_74%,#000000_26%)] border-[var(--color-surface-2)] text-[var(--color-text-main)] hover:border-[rgba(220,40,40,0.6)] hover:bg-[color-mix(in_srgb,var(--color-surface-1)_50%,rgba(220,40,40,0.26)_50%)]"
      }`}
      data-export-exclude="true"
      onClick={onToggle}
      aria-label={`Weekly smoothing ${isActive ? "on" : "off"} for ${chartTitle}`}
      aria-pressed={isActive}
    >
      Weekly Smoothing
    </button>
  );

  const renderYAxisBaselineToggle = (chartTitle: string, isActive: boolean, onToggle: () => void) => (
    <button
      type="button"
      className={`inline-flex items-center justify-center min-h-[30px] px-3 py-1.5 text-[0.74rem] font-bold tracking-wide cursor-pointer transition-all duration-130 border rounded-full ${
        isActive
          ? "bg-[var(--color-pill-active-bg)] border-[var(--color-pill-active-border)] text-white"
          : "bg-[color-mix(in_srgb,var(--color-surface-1)_74%,#000000_26%)] border-[var(--color-surface-2)] text-[var(--color-text-main)] hover:border-[rgba(220,40,40,0.6)] hover:bg-[color-mix(in_srgb,var(--color-surface-1)_50%,rgba(220,40,40,0.26)_50%)]"
      }`}
      data-export-exclude="true"
      onClick={onToggle}
      aria-label={`Y-axis baseline at zero ${isActive ? "on" : "off"} for ${chartTitle}`}
      aria-pressed={isActive}
    >
      Y Min = 0
    </button>
  );

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
        ? realmstockSubtitle
        : expandedChart === "launcher"
          ? launcherSubtitle
          : null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-[var(--color-topbar-border)] bg-[var(--color-topbar-bg)] backdrop-blur-xl">
        <div className="w-[min(1280px,94vw)] mx-auto py-4 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-3">
            <img
              className="w-10 h-10 rounded-[10px] border border-[rgba(220,40,40,0.4)] shadow-[0_8px_18px_rgba(0,0,0,0.35)]"
              src="/image.png"
              width={40}
              height={40}
              alt="RotMG Player Stats logo"
            />
            <h1
              className="m-0 font-normal text-[clamp(1.35rem,2.4vw,2rem)] tracking-wide"
              style={{ fontFamily: '"Russo One", sans-serif' }}
            >
              RotMG Player Stats
            </h1>
          </div>

          <div className="inline-flex items-center gap-2">
            <a
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-[var(--color-surface-2)] bg-[var(--color-panel-highlight)] text-[var(--color-text-main)] text-[0.9rem] font-semibold no-underline transition-all duration-130 hover:border-[rgba(220,40,40,0.5)] hover:bg-[rgba(220,40,40,0.14)] hover:no-underline"
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open GitHub repository"
            >
              <Github size={16} strokeWidth={2} aria-hidden="true" className="text-[var(--color-brand-red)]" />
              <span>GitHub</span>
            </a>

            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-[var(--color-surface-2)] bg-[var(--color-panel-highlight)] text-[var(--color-text-main)] font-semibold cursor-pointer transition-all duration-130 hover:border-[rgba(220,40,40,0.5)] hover:bg-[rgba(220,40,40,0.14)]"
              onClick={cycleThemeMode}
              aria-label={`Theme mode: ${themeButton.label}. Click to switch mode.`}
              title={`Theme: ${themeButton.label}`}
            >
              <themeButton.Icon
                size={16}
                strokeWidth={2}
                aria-hidden="true"
                className="text-[var(--color-brand-red)]"
              />
              <span>{themeButton.label}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="w-[min(1280px,94vw)] mx-auto my-6 mb-12 grid gap-4">
        {isLoading ? (
          <AppSkeleton />
        ) : error != null ? (
          <section
            className="border border-[var(--color-surface-2)] rounded-xl bg-[var(--color-surface-1)] p-4 grid gap-2.5 justify-items-start"
            role="alert"
            aria-live="assertive"
          >
            <h2 className="m-0 text-[1.05rem]">Data unavailable</h2>
            <p className="m-0 text-[var(--color-text-muted)] text-[0.9rem]">{error}</p>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-[var(--color-surface-2)] rounded text-[var(--color-text-main)] font-semibold cursor-pointer transition-colors duration-130 hover:bg-[var(--color-surface-2)]"
              onClick={retry}
            >
              Retry
            </button>
          </section>
        ) : (
          <>
            <StatsCards stats={stats} />

            <section className="border border-[var(--color-surface-2)] rounded-xl bg-[var(--color-surface-1)] p-3 flex flex-wrap justify-between items-center gap-3">
              <div className="inline-flex gap-2" role="tablist" aria-label="View switcher">
                <button
                  role="tab"
                  aria-selected={activeTab === "charts"}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border font-semibold tracking-wide cursor-pointer transition-all duration-130 ${
                    activeTab === "charts"
                      ? "bg-[var(--color-pill-active-bg)] border-[var(--color-pill-active-border)] text-white"
                      : "border-[var(--color-surface-2)] bg-[var(--color-panel-highlight)] text-[var(--color-text-main)] hover:border-[rgba(220,40,40,0.3)] hover:bg-[rgba(220,40,40,0.16)]"
                  }`}
                  onClick={() => setActiveTab("charts")}
                >
                  <LineChart size={15} aria-hidden="true" />
                  Charts
                </button>
                <button
                  role="tab"
                  aria-selected={activeTab === "table"}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border font-semibold tracking-wide cursor-pointer transition-all duration-130 ${
                    activeTab === "table"
                      ? "bg-[var(--color-pill-active-bg)] border-[var(--color-pill-active-border)] text-white"
                      : "border-[var(--color-surface-2)] bg-[var(--color-panel-highlight)] text-[var(--color-text-main)] hover:border-[rgba(220,40,40,0.3)] hover:bg-[rgba(220,40,40,0.16)]"
                  }`}
                  onClick={() => setActiveTab("table")}
                >
                  <Table2 size={15} aria-hidden="true" />
                  Data Table
                </button>
              </div>

              <RangeSelector
                active={preset}
                onSelect={(nextPreset) => {
                  setHasRangeOverride(true);
                  setPreset(nextPreset);
                  setRange(resolvePresetRange(data, nextPreset));
                }}
              />
            </section>

            {activeTab === "charts" ? (
              <section className="grid gap-4">
                <SharedRangeSlider
                  dates={allDates}
                  range={effectiveRange}
                  onChange={(nextRange) => {
                    setHasRangeOverride(true);
                    setPreset("ALL");
                    setRange(nextRange);
                  }}
                />

                <PlayerChart
                  title={CHART_COPY.realmeye.title}
                  subtitle={CHART_COPY.realmeye.subtitle}
                  shareUrl={SITE_URL}
                  dates={realmeyeDates}
                  maxValues={realmeyeMax}
                  theme={resolvedTheme}
                  range={effectiveRange}
                  syncKey="rotmg-sync"
                  isYAxisBaselineZero={isRealmeyeYAxisZeroOn}
                  headerControls={renderYAxisBaselineToggle(CHART_COPY.realmeye.title, isRealmeyeYAxisZeroOn, () =>
                    setIsRealmeyeYAxisZeroOn((current) => !current)
                  )}
                  onPopOut={() => setExpandedChart("realmeye")}
                />

                <PlayerChart
                  title={CHART_COPY.realmstock.title}
                  subtitle={realmstockSubtitle}
                  shareUrl={SITE_URL}
                  dates={realmstockDates}
                  maxValues={isRealmstockWeeklySmoothOn ? realmstockSmoothedMax : realmstockMax}
                  tooltipValueLabel="players online"
                  theme={resolvedTheme}
                  range={effectiveRange}
                  syncKey="rotmg-sync"
                  isYAxisBaselineZero={isRealmstockYAxisZeroOn}
                  headerControls={
                    <>
                      {renderYAxisBaselineToggle(CHART_COPY.realmstock.title, isRealmstockYAxisZeroOn, () =>
                        setIsRealmstockYAxisZeroOn((current) => !current)
                      )}
                      {renderWeeklySmoothingToggle(CHART_COPY.realmstock.title, isRealmstockWeeklySmoothOn, () =>
                        setIsRealmstockWeeklySmoothOn((current) => !current)
                      )}
                    </>
                  }
                  onPopOut={() => setExpandedChart("realmstock")}
                />

                <PlayerChart
                  title={CHART_COPY.launcher.title}
                  subtitle={launcherSubtitle}
                  shareUrl={SITE_URL}
                  dates={launcherDates}
                  maxValues={isLauncherWeeklySmoothOn ? launcherSmoothedLoads : launcherLoads}
                  tooltipValueLabel="loads"
                  theme={resolvedTheme}
                  range={effectiveRange}
                  syncKey="rotmg-sync"
                  isYAxisBaselineZero={isLauncherYAxisZeroOn}
                  headerControls={
                    <>
                      {renderYAxisBaselineToggle(CHART_COPY.launcher.title, isLauncherYAxisZeroOn, () =>
                        setIsLauncherYAxisZeroOn((current) => !current)
                      )}
                      {renderWeeklySmoothingToggle(CHART_COPY.launcher.title, isLauncherWeeklySmoothOn, () =>
                        setIsLauncherWeeklySmoothOn((current) => !current)
                      )}
                    </>
                  }
                  onPopOut={() => setExpandedChart("launcher")}
                />
              </section>
            ) : (
              <DataTable rows={tableRows} />
            )}

            {expandedChart != null && expandedChartTitle != null ? (
              <div
                className="fixed inset-0 z-[120] grid place-items-center p-5 bg-[var(--color-modal-backdrop)] backdrop-blur-sm"
                role="presentation"
                onClick={() => setExpandedChart(null)}
              >
                <div
                  className="w-[90vw] max-h-full overflow-auto border border-[rgba(220,40,40,0.35)] rounded-xl bg-gradient-to-b from-[var(--color-modal-surface-start)] to-[var(--color-modal-surface-end)] shadow-[0_24px_48px_rgba(0,0,0,0.5)] p-2.5"
                  role="dialog"
                  aria-modal="true"
                  aria-label={`${expandedChartTitle} expanded view`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center justify-end gap-2.5 mb-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-3 py-2 border border-[var(--color-surface-2)] rounded text-[var(--color-text-main)] font-semibold cursor-pointer transition-colors duration-130 hover:bg-[var(--color-surface-2)]"
                      onClick={() => setExpandedChart(null)}
                    >
                      <X size={14} aria-hidden="true" />
                      Close
                    </button>
                  </div>

                  <SharedRangeSlider
                    dates={allDates}
                    range={effectiveRange}
                    onChange={(nextRange) => {
                      setHasRangeOverride(true);
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
                    maxValues={
                      expandedChart === "realmeye"
                        ? realmeyeMax
                        : expandedChart === "realmstock"
                          ? isRealmstockWeeklySmoothOn
                            ? realmstockSmoothedMax
                            : realmstockMax
                          : isLauncherWeeklySmoothOn
                            ? launcherSmoothedLoads
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
                    range={effectiveRange}
                    syncKey="rotmg-modal-sync"
                    height={460}
                    minHeightRatio={0.5}
                    enableExport
                    isYAxisBaselineZero={
                      expandedChart === "realmeye"
                        ? isRealmeyeYAxisZeroOn
                        : expandedChart === "realmstock"
                          ? isRealmstockYAxisZeroOn
                          : isLauncherYAxisZeroOn
                    }
                    headerControls={
                      expandedChart === "realmeye" ? (
                        renderYAxisBaselineToggle(CHART_COPY.realmeye.title, isRealmeyeYAxisZeroOn, () =>
                          setIsRealmeyeYAxisZeroOn((current) => !current)
                        )
                      ) : expandedChart === "realmstock" ? (
                        <>
                          {renderYAxisBaselineToggle(CHART_COPY.realmstock.title, isRealmstockYAxisZeroOn, () =>
                            setIsRealmstockYAxisZeroOn((current) => !current)
                          )}
                          {renderWeeklySmoothingToggle(CHART_COPY.realmstock.title, isRealmstockWeeklySmoothOn, () =>
                            setIsRealmstockWeeklySmoothOn((current) => !current)
                          )}
                        </>
                      ) : (
                        <>
                          {renderYAxisBaselineToggle(CHART_COPY.launcher.title, isLauncherYAxisZeroOn, () =>
                            setIsLauncherYAxisZeroOn((current) => !current)
                          )}
                          {renderWeeklySmoothingToggle(CHART_COPY.launcher.title, isLauncherWeeklySmoothOn, () =>
                            setIsLauncherWeeklySmoothOn((current) => !current)
                          )}
                        </>
                      )
                    }
                  />
                </div>
              </div>
            ) : null}
          </>
        )}
      </main>

      <footer className="text-center py-8 px-4 text-[var(--color-text-muted)] text-[0.85rem] border-t border-[var(--color-surface-2)] mt-auto bg-[var(--color-footer-bg)]">
        <p className="my-1.5">
          Built by{" "}
          <a
            href={GITHUB_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-text-main)] no-underline transition-colors duration-130 hover:text-[var(--color-brand-red)] hover:underline"
          >
            MarvNC
          </a>
        </p>
      </footer>
    </div>
  );
}
