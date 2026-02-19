import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Download, Expand } from "lucide-react";
import { toBlob } from "html-to-image";
import uPlot from "uplot";
import type { AlignedData, Options } from "uplot";
import type { DateRange } from "../types";

type PlayerChartProps = {
  title: string;
  subtitle?: string;
  shareUrl?: string;
  dates: string[];
  maxValues: Array<number | null>;
  tooltipValueLabel?: string;
  theme: "light" | "dark";
  range: DateRange;
  syncKey: string;
  height?: number;
  minHeightRatio?: number;
  showTitle?: boolean;
  onPopOut?: () => void;
  enableExport?: boolean;
  headerControls?: ReactNode;
  isYAxisBaselineZero?: boolean;
};

function toUnixDay(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000);
}

function formatDateLabel(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

function formatAxisDateLabel(unixSeconds: number, rangeDays: number): string {
  const date = new Date(unixSeconds * 1000);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();

  if (rangeDays > 365 * 3) {
    return `${year}`;
  }

  if (rangeDays > 365) {
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  if (rangeDays > 120) {
    return `${month}/${day}`;
  }

  return `${month}/${day}`;
}

function formatPlayers(value: number | null): string {
  if (value == null) {
    return "-";
  }

  return Intl.NumberFormat("en-US").format(value);
}

function formatShareUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function toExportFileName(title: string): string {
  const normalized = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${normalized || "chart"}.png`;
}

function shouldIncludeExportNode(node: Node): boolean {
  if (!(node instanceof Element)) {
    return true;
  }

  return node.closest('[data-export-exclude="true"]') == null;
}

export function PlayerChart({
  title,
  subtitle,
  shareUrl,
  dates,
  maxValues,
  tooltipValueLabel = "players",
  theme,
  range,
  syncKey,
  height = 392,
  minHeightRatio,
  showTitle = true,
  onPopOut,
  enableExport = false,
  headerControls,
  isYAxisBaselineZero = false,
}: PlayerChartProps) {
  const chartShellRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);
  const [chartHeight, setChartHeight] = useState(height);
  const [isExporting, setIsExporting] = useState(false);

  const resolveHeight = useCallback(
    (width: number) => {
      if (minHeightRatio == null) {
        return height;
      }

      return Math.max(height, Math.floor(width * minHeightRatio));
    },
    [height, minHeightRatio]
  );

  const frameHeight = chartHeight + 18;

  const data = useMemo<AlignedData>(() => {
    const x = dates.map(toUnixDay);
    return [x, maxValues];
  }, [dates, maxValues]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || data[0].length === 0) {
      return;
    }

    const initialWidth = Math.max(host.clientWidth, 320);
    const initialHeight = resolveHeight(initialWidth);

    setChartHeight(initialHeight);

    const options: Options = {
      width: initialWidth,
      height: initialHeight,
      padding: [20, 10, 10, 10],
      legend: {
        show: false,
      },
      focus: {
        alpha: 0.3,
      },
      scales: {
        x: {
          time: true,
        },
        y: {
          auto: true,
          range: isYAxisBaselineZero
            ? (_: uPlot, _dataMin: number, dataMax: number): [number, number] => [0, Math.max(dataMax, 1)]
            : undefined,
        },
      },
      axes: [
        {
          stroke: theme === "dark" ? "#737373" : "#6b7280",
          space: 90,
          grid: {
            show: false,
          },
          ticks: {
            stroke: theme === "dark" ? "#262626" : "#e2e8f0",
          },
          values: (u, splits) => {
            const xMin = u.scales.x.min ?? Number(splits[0] ?? 0);
            const xMax = u.scales.x.max ?? Number(splits[splits.length - 1] ?? 0);
            const rangeDays = Math.max(1, (xMax - xMin) / 86400);
            const targetLabelWidth = rangeDays > 365 * 3 ? 42 : rangeDays > 365 ? 80 : 58;
            const maxLabels = Math.max(2, Math.floor(u.bbox.width / targetLabelWidth));
            const step = Math.max(1, Math.ceil(splits.length / maxLabels));

            return splits.map((split, index) =>
              index === 0 || index === splits.length - 1 || index % step === 0
                ? formatAxisDateLabel(Number(split), rangeDays)
                : ""
            );
          },
        },
        {
          stroke: theme === "dark" ? "#737373" : "#6b7280",
          grid: {
            stroke: theme === "dark" ? "#262626" : "#e2e8f0",
            width: 1,
          },
          ticks: {
            stroke: theme === "dark" ? "#262626" : "#e2e8f0",
          },
          values: (_, splits) =>
            splits.map((split) =>
              Intl.NumberFormat("en-US", {
                notation: "compact",
                maximumFractionDigits: 1,
              }).format(Number(split))
            ),
        },
      ],
      cursor: {
        lock: false,
        points: {
          show: false,
        },
        drag: {
          x: false,
          y: false,
          setScale: false,
        },
        sync: {
          key: syncKey,
          setSeries: false,
        },
      },
      series: [
        {
          label: "Date",
        },
        {
          label: "Daily value",
          stroke: "#dc2828",
          width: 3,
          fill: theme === "dark" ? "rgba(220,40,40,0.24)" : "rgba(220,40,40,0.2)",
          spanGaps: true,
          points: {
            show: false,
          },
        },
      ],
      hooks: {
        setCursor: [
          (chart) => {
            const tooltip = tooltipRef.current;
            if (!tooltip) {
              return;
            }

            const index = chart.cursor.idx;
            if (index == null) {
              tooltip.style.opacity = "0";
              return;
            }

            const xSeries = chart.data[0] as number[];
            const maxSeries = chart.data[1] as Array<number | null>;

            const xValue = xSeries[index];
            const yValue = maxSeries[index] ?? null;

            if (xValue == null || yValue == null) {
              tooltip.style.opacity = "0";
              return;
            }

            tooltip.innerHTML = `<strong>${formatDateLabel(xValue)}</strong><span>${formatPlayers(yValue)} ${tooltipValueLabel}</span>`;

            const cursorLeft = chart.cursor.left;
            const cursorTop = chart.cursor.top;

            if (cursorLeft == null || cursorTop == null || cursorLeft < 0 || cursorTop < 0) {
              tooltip.style.opacity = "0";
              return;
            }

            const bounds = tooltip.offsetParent as HTMLElement | null;
            if (!bounds) {
              tooltip.style.opacity = "0";
              return;
            }

            const pad = 8;
            const gap = 12;
            const boundsRect = bounds.getBoundingClientRect();
            const overRect = chart.over.getBoundingClientRect();
            const tooltipWidth = tooltip.offsetWidth;
            const tooltipHeight = tooltip.offsetHeight;
            const maxLeft = Math.max(pad, bounds.clientWidth - tooltipWidth - pad);
            const maxTop = Math.max(pad, bounds.clientHeight - tooltipHeight - pad);

            const anchorLeft = overRect.left - boundsRect.left + cursorLeft;
            const anchorTop = overRect.top - boundsRect.top + cursorTop;

            const rightLeft = anchorLeft + gap;
            const leftLeft = anchorLeft - tooltipWidth - gap;

            const tooltipLeft =
              rightLeft + tooltipWidth <= bounds.clientWidth - pad
                ? rightLeft
                : leftLeft >= pad
                  ? leftLeft
                  : Math.min(Math.max(rightLeft, pad), maxLeft);

            const aboveTop = anchorTop - tooltipHeight - gap;
            const belowTop = anchorTop + gap;

            const tooltipTop =
              aboveTop >= pad ? aboveTop : belowTop <= maxTop ? belowTop : Math.min(Math.max(aboveTop, pad), maxTop);

            tooltip.style.transform = `translate(${Math.round(tooltipLeft)}px, ${Math.round(tooltipTop)}px)`;
            tooltip.style.opacity = "1";
          },
        ],
      },
    };

    const chart = new uPlot(options, data, host);
    chartRef.current = chart;

    const observer = new ResizeObserver((entries) => {
      const width = Math.floor(entries[0]?.contentRect.width ?? host.clientWidth);
      if (width > 0) {
        const nextHeight = resolveHeight(width);
        setChartHeight((current) => (current === nextHeight ? current : nextHeight));
        chart.setSize({ width, height: nextHeight });
      }
    });

    observer.observe(host);

    return () => {
      observer.disconnect();
      chart.destroy();
      chartRef.current = null;
    };
  }, [data, isYAxisBaselineZero, resolveHeight, syncKey, theme, tooltipValueLabel]);

  useEffect(() => {
    if (!chartRef.current || data[0].length === 0) {
      return;
    }

    const min = toUnixDay(range.start);
    const max = toUnixDay(range.end) + 86399;
    chartRef.current.setScale("x", { min, max });
  }, [data, range.end, range.start]);

  const exportChartAsPng = async () => {
    const chartShell = chartShellRef.current;
    if (!chartShell || isExporting) {
      return;
    }

    setIsExporting(true);

    try {
      const blob = await toBlob(chartShell, {
        cacheBust: true,
        pixelRatio: window.devicePixelRatio || 1,
        filter: (node) => shouldIncludeExportNode(node),
      });

      if (!blob) {
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = toExportFileName(title);
      link.click();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setIsExporting(false);
    }
  };

  if (data[0].length === 0) {
    return (
      <div className="border border-[var(--color-surface-2)] rounded-xl bg-[var(--color-surface-1)] p-2.5 animate-[card-enter_340ms_ease_both]">
        <div className="min-h-[220px] grid place-items-center text-center text-[var(--color-text-muted)] text-[0.9rem]">
          No data for this source in the selected date range.
        </div>
      </div>
    );
  }

  return (
    <div
      ref={chartShellRef}
      className="border border-[var(--color-surface-2)] rounded-xl bg-[var(--color-surface-1)] p-2.5 animate-[card-enter_340ms_ease_both]"
    >
      {(title || subtitle || shareUrl) && showTitle ? (
        <div className="block m-1 mb-2.5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3">
            <div className="min-h-[30px] flex items-start">
              {shareUrl ? (
                <span
                  className="text-[var(--color-text-muted)] text-[0.75rem] no-underline hover:text-[var(--color-text-main)] tabular-nums"
                  aria-label="Share URL"
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                >
                  {formatShareUrl(shareUrl)}
                </span>
              ) : null}
            </div>

            <div className="grid gap-1 justify-items-center">
              {title ? (
                <h2 className="m-0 text-[1.02rem] font-bold tracking-wide text-[var(--color-text-main)] text-center">
                  {title}
                </h2>
              ) : null}
              {subtitle ? (
                <p className="m-0 text-[var(--color-text-muted)] text-[0.82rem] leading-snug max-w-[78ch] text-center">
                  {subtitle}
                </p>
              ) : null}
            </div>

            <div className="min-h-[30px] flex justify-end items-start gap-2 flex-wrap">
              {headerControls}
              {enableExport ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[rgba(220,40,40,0.45)] rounded bg-[var(--color-chart-button-bg)] text-[var(--color-text-main)] text-[0.76rem] font-semibold tracking-wide cursor-pointer transition-all duration-140 self-start hover:border-[rgba(220,40,40,0.8)] hover:bg-[rgba(220,40,40,0.2)]"
                  data-export-exclude="true"
                  onClick={() => {
                    void exportChartAsPng();
                  }}
                  aria-label={`Export ${title} as PNG`}
                  disabled={isExporting}
                >
                  <Download size={13} aria-hidden="true" />
                  {isExporting ? "Exporting..." : "Export PNG"}
                </button>
              ) : null}
              {onPopOut ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[rgba(220,40,40,0.45)] rounded bg-[var(--color-chart-button-bg)] text-[var(--color-text-main)] text-[0.76rem] font-semibold tracking-wide cursor-pointer transition-all duration-140 self-start hover:border-[rgba(220,40,40,0.8)] hover:bg-[rgba(220,40,40,0.2)]"
                  data-export-exclude="true"
                  onClick={onPopOut}
                  aria-label={`Open ${title} in modal`}
                >
                  <Expand size={13} aria-hidden="true" />
                  Expand
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <div
        className="border border-[var(--color-chart-shell-border)] rounded-[10px] overflow-hidden relative pt-2.5 bg-gradient-to-b from-[var(--color-chart-frame-start)] to-[var(--color-chart-frame-end)]"
        style={{ height: `${frameHeight}px` }}
      >
        <div ref={hostRef} className="w-full h-full" />
        <div ref={tooltipRef} className="uplot-tooltip" />
      </div>
    </div>
  );
}
