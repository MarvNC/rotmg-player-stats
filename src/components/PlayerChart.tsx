import { useEffect, useMemo, useRef, useState } from "react";
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
  minValues: Array<number | null>;
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
  minValues,
  maxValues,
  tooltipValueLabel = "players",
  theme,
  range,
  syncKey,
  height = 392,
  minHeightRatio,
  showTitle = true,
  onPopOut,
  enableExport = false
}: PlayerChartProps) {
  const chartShellRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);
  const [chartHeight, setChartHeight] = useState(height);
  const [isExporting, setIsExporting] = useState(false);

  const resolveHeight = (width: number) => {
    if (minHeightRatio == null) {
      return height;
    }

    return Math.max(height, Math.floor(width * minHeightRatio));
  };

  const frameHeight = chartHeight + 18;

  const data = useMemo<AlignedData>(() => {
    const x = dates.map(toUnixDay);
    return [x, minValues, maxValues];
  }, [dates, minValues, maxValues]);

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
        show: false
      },
      focus: {
        alpha: 0.3
      },
      scales: {
        x: {
          time: true
        },
        y: {
          auto: true,
          range: (_, _min, max) => [0, max == null || max <= 0 ? 1 : max]
        }
      },
      axes: [
        {
          stroke: theme === "dark" ? "#737373" : "#6b7280",
          space: 90,
          grid: {
            show: false
          },
          ticks: {
            stroke: theme === "dark" ? "#262626" : "#e2e8f0"
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
          }
        },
        {
          stroke: theme === "dark" ? "#737373" : "#6b7280",
          grid: {
            stroke: theme === "dark" ? "#262626" : "#e2e8f0",
            width: 1
          },
          ticks: {
            stroke: theme === "dark" ? "#262626" : "#e2e8f0"
          },
          values: (_, splits) =>
            splits.map((split) =>
              Intl.NumberFormat("en-US", {
                notation: "compact",
                maximumFractionDigits: 1
              }).format(Number(split))
            )
        }
      ],
      cursor: {
        lock: false,
        points: {
          show: false
        },
        drag: {
          x: false,
          y: false,
          setScale: false
        },
        sync: {
          key: syncKey,
          setSeries: false
        }
      },
      series: [
        {
          label: "Date"
        },
        {
          label: "Daily min",
          stroke: "rgba(220,40,40,0)",
          fill: "rgba(220,40,40,0)",
          spanGaps: true,
          points: {
            show: false
          }
        },
        {
          label: "Daily max",
          stroke: "#dc2828",
          width: 3,
          fill: theme === "dark" ? "rgba(220,40,40,0.24)" : "rgba(220,40,40,0.2)",
          spanGaps: true,
          points: {
            show: false
          }
        }
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
            const maxSeries = chart.data[2] as Array<number | null>;

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
              aboveTop >= pad
                ? aboveTop
                : belowTop <= maxTop
                  ? belowTop
                  : Math.min(Math.max(aboveTop, pad), maxTop);

            tooltip.style.transform = `translate(${Math.round(tooltipLeft)}px, ${Math.round(tooltipTop)}px)`;
            tooltip.style.opacity = "1";
          }
        ]
      }
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
  }, [data, height, minHeightRatio, syncKey, theme, tooltipValueLabel]);

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
        filter: (node) => shouldIncludeExportNode(node)
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
      <div className="chart-shell">
        <div className="chart-empty">No data for this source in the selected date range.</div>
      </div>
    );
  }

  return (
    <div ref={chartShellRef} className="chart-shell">
      {(title || subtitle || shareUrl) && showTitle ? (
        <div className="chart-heading">
          <div className="chart-heading-grid">
            <div className="chart-heading-side chart-heading-side-left">
              {shareUrl ? (
                <span className="chart-share-url mono" aria-label="Share URL">
                  {formatShareUrl(shareUrl)}
                </span>
              ) : null}
            </div>

            <div className="chart-heading-center">
              {title ? <h2 className="chart-title">{title}</h2> : null}
              {subtitle ? <p className="chart-subtitle">{subtitle}</p> : null}
            </div>

            <div className="chart-heading-side chart-heading-side-right">
              {enableExport ? (
                <button
                  type="button"
                  className="chart-popout-button"
                  data-export-exclude="true"
                  onClick={exportChartAsPng}
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
                  className="chart-popout-button"
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
      <div className="chart-frame" style={{ height: `${frameHeight}px` }}>
        <div ref={hostRef} className="uplot-shell" />
        <div ref={tooltipRef} className="uplot-tooltip" />
      </div>
    </div>
  );
}
