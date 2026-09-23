import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download, Expand, ExternalLink } from "lucide-react";
import { toBlob } from "html-to-image";
import uPlot from "uplot";
import type { AlignedData, Options } from "uplot";
import type { DateRange } from "../types";
import type { HistoryEvent } from "../data/historyEvents";

export type ChartAnnotation = {
  start: string;
  /** Exclusive end: tracking resumed on this date. */
  end: string;
  label: string;
  description: string;
};

const NO_ANNOTATIONS: ChartAnnotation[] = [];
const NO_EVENTS: HistoryEvent[] = [];

type EventGroup = {
  key: string;
  x: number;
  events: HistoryEvent[];
};

type TimelineItem = {
  key: string;
  x: number;
  endX: number;
  events?: HistoryEvent[];
  annotation?: ChartAnnotation;
};

const TIMELINE_HOVER_RADIUS = 18;

function groupEvents(chart: uPlot, events: HistoryEvent[], firstDate: string, lastDate: string): EventGroup[] {
  const min = chart.scales.x.min;
  const max = chart.scales.x.max;
  if (min == null || max == null) return [];

  const pixelRatio = chart.ctx.canvas.width / chart.width;
  const plotLeft = chart.bbox.left / pixelRatio;
  const groups: EventGroup[] = [];
  for (const event of events) {
    if (event.end) continue;
    if (event.date < firstDate || event.date > lastDate) continue;
    const day = toUnixDay(event.date);
    if (day < min || day > max) continue;

    const x = plotLeft + chart.valToPos(day, "x");
    const previous = groups[groups.length - 1];
    if (previous && x - previous.x < 28) {
      previous.events.push(event);
      previous.x = (previous.x * (previous.events.length - 1) + x) / previous.events.length;
      previous.key += `-${event.date}`;
    } else {
      groups.push({ key: event.date, x, events: [event] });
    }
  }
  return groups;
}

function timelineItems(
  chart: uPlot,
  events: HistoryEvent[],
  annotations: ChartAnnotation[],
  firstDate: string,
  lastDate: string
): TimelineItem[] {
  const min = Math.max(chart.scales.x.min ?? 0, toUnixDay(firstDate));
  const max = Math.min(chart.scales.x.max ?? 0, toUnixDay(lastDate) + 86399);
  if (min >= max) return [];

  const pixelRatio = chart.ctx.canvas.width / chart.width;
  const plotLeft = chart.bbox.left / pixelRatio;
  const xFor = (value: number) => plotLeft + chart.valToPos(value, "x");
  const items: TimelineItem[] = groupEvents(chart, events, firstDate, lastDate).map((group) => ({
    key: `point-${group.key}`,
    x: group.x,
    endX: group.x,
    events: group.events,
  }));

  for (const event of events) {
    if (!event.end) continue;
    const start = toUnixDay(event.date);
    const end = toUnixDay(event.end) + 86400;
    if (end <= min || start >= max) continue;
    items.push({
      key: `period-${event.date}`,
      x: xFor(Math.max(start, min)),
      endX: xFor(Math.min(end, max)),
      events: [event],
    });
  }

  for (const annotation of annotations) {
    const start = toUnixDay(annotation.start);
    const end = toUnixDay(annotation.end);
    if (end <= min || start >= max) continue;
    items.push({
      key: `annotation-${annotation.start}`,
      x: xFor(Math.max(start, min)),
      endX: xFor(Math.min(end, max)),
      annotation,
    });
  }

  return items.sort((a, b) => a.x - b.x || a.endX - b.endX);
}

function itemsNearX(items: TimelineItem[], x: number): TimelineItem[] {
  return items.filter((item) => {
    const distance = x < item.x ? item.x - x : x > item.endX ? x - item.endX : 0;
    return distance <= TIMELINE_HOVER_RADIUS;
  });
}

function sameKeys(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

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
  annotations?: ChartAnnotation[];
  events?: HistoryEvent[];
};

function toUnixDay(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000);
}

function formatAnnotationDate(date: string, includeYear: boolean): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
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
  annotations = NO_ANNOTATIONS,
  events = NO_EVENTS,
}: PlayerChartProps) {
  const chartShellRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);
  const isPlotPointerInsideRef = useRef(false);
  const [chartHeight, setChartHeight] = useState(height);
  const [isExporting, setIsExporting] = useState(false);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [selectedEventKeys, setSelectedEventKeys] = useState<string[]>([]);

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
  const selectedItems = items.filter((item) => selectedEventKeys.includes(item.key));
  const selectedEventIndex = selectedItems.length > 0 ? items.indexOf(selectedItems[0]) : -1;

  const selectEventAtPointer = (clientX: number, rail: HTMLDivElement) => {
    const x = clientX - rail.getBoundingClientRect().left;
    const keys = itemsNearX(items, x).map((item) => item.key);
    setSelectedEventKeys((current) => sameKeys(current, keys) ? current : keys);
  };

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

    const chartStyle = getComputedStyle(host);
    const annotationFill = chartStyle.getPropertyValue("--chart-annotation-fill").trim();
    const annotationStroke = chartStyle.getPropertyValue("--chart-annotation-stroke").trim();
    const eventStroke = chartStyle.getPropertyValue("--chart-event-stroke").trim();
    const eventBand = chartStyle.getPropertyValue("--chart-event-band").trim();

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
        drawAxes: [
          (chart) => {
            const { left, top, width, height: plotHeight } = chart.bbox;
            const min = chart.scales.x.min;
            const max = chart.scales.x.max;
            if (min == null || max == null) return;

            const ctx = chart.ctx;
            const pixelRatio = ctx.canvas.width / chart.width;
            ctx.save();
            ctx.beginPath();
            ctx.rect(left, top, width, plotHeight);
            ctx.clip();

            ctx.fillStyle = eventBand;
            for (const event of events) {
              if (!event.end) continue;
              const start = toUnixDay(event.date);
              const end = toUnixDay(event.end) + 86400;
              if (end <= min || start >= max) continue;
              const xStart = chart.valToPos(Math.max(start, min), "x", true);
              const xEnd = chart.valToPos(Math.min(end, max), "x", true);
              ctx.fillRect(xStart, top, xEnd - xStart, plotHeight);
            }

            ctx.fillStyle = annotationFill;
            ctx.strokeStyle = annotationStroke;
            ctx.lineWidth = pixelRatio;
            ctx.setLineDash([3 * pixelRatio, 4 * pixelRatio]);

            for (const annotation of annotations) {
              const start = toUnixDay(annotation.start);
              const end = toUnixDay(annotation.end);
              if (end <= min || start > max) continue;

              const xStart = chart.valToPos(Math.max(start, min), "x", true);
              const xEnd = chart.valToPos(Math.min(end, max), "x", true);
              ctx.fillRect(xStart, top, xEnd - xStart, plotHeight);

              for (const boundary of [start, end]) {
                if (boundary < min || boundary > max) continue;
                const x = chart.valToPos(boundary, "x", true);
                ctx.beginPath();
                ctx.moveTo(x, top);
                ctx.lineTo(x, top + plotHeight);
                ctx.stroke();
              }
            }
            ctx.strokeStyle = eventStroke;
            ctx.setLineDash([2 * pixelRatio, 5 * pixelRatio]);
            for (const group of groupEvents(chart, events, dates[0], dates[dates.length - 1])) {
              const x = group.x * pixelRatio;
              ctx.beginPath();
              ctx.moveTo(x, top);
              ctx.lineTo(x, top + plotHeight);
              ctx.stroke();
            }
            ctx.restore();
          },
        ],
        setCursor: [
          (chart) => {
            const tooltip = tooltipRef.current;
            if (!tooltip) {
              return;
            }

            // uPlot sync calls this hook for the other charts too. Only the chart
            // under the pointer may open details or change its layout.
            if (!isPlotPointerInsideRef.current) {
              tooltip.style.opacity = "0";
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

            if (xValue == null) {
              tooltip.style.opacity = "0";
              return;
            }

            tooltip.innerHTML = `<strong>${formatDateLabel(xValue)}</strong><span>${yValue == null ? "No data for this date" : `${formatPlayers(yValue)} ${tooltipValueLabel}`}</span>`;
            const cursorLeft = chart.cursor.left;
            const cursorTop = chart.cursor.top;
            if (cursorLeft == null || cursorTop == null || cursorLeft < 0 || cursorTop < 0) {
              tooltip.style.opacity = "0";
              return;
            }

            const pixelRatio = chart.ctx.canvas.width / chart.width;
            const plotLeft = chart.bbox.left / pixelRatio;
            const hoveredItems = itemsNearX(
              timelineItems(chart, events, annotations, dates[0], dates[dates.length - 1]),
              plotLeft + cursorLeft
            );
            const hoveredKeys = hoveredItems.map((item) => item.key);
            setSelectedEventKeys((current) => sameKeys(current, hoveredKeys) ? current : hoveredKeys);

            for (const hoveredItem of hoveredItems) {
              if (hoveredItem.annotation) {
                const note = document.createElement("p");
                note.className = "uplot-tooltip-note";
                const label = document.createElement("strong");
                label.textContent = hoveredItem.annotation.label;
                note.append(label, document.createTextNode(hoveredItem.annotation.description));
                tooltip.appendChild(note);
              }

              if (hoveredItem.events) {
                const note = document.createElement("p");
                note.className = "uplot-tooltip-history";
                const label = document.createElement("span");
                const event = hoveredItem.events[0];
                label.textContent = event.end
                  ? `${formatAnnotationDate(event.date, true)} – ${formatAnnotationDate(event.end, true)}`
                  : formatAnnotationDate(event.date, true);
                const title = document.createElement("strong");
                title.textContent = hoveredItem.events.map((item) => item.title).join(" · ");
                note.append(label, title);
                tooltip.appendChild(note);
              }
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

    const refreshTimeline = () => {
      setItems(timelineItems(chart, events, annotations, dates[0], dates[dates.length - 1]));
    };

    const observer = new ResizeObserver((entries) => {
      const width = Math.floor(entries[0]?.contentRect.width ?? host.clientWidth);
      if (width > 0) {
        const nextHeight = resolveHeight(width);
        setChartHeight((current) => (current === nextHeight ? current : nextHeight));
        chart.setSize({ width, height: nextHeight });
        refreshTimeline();
      }
    });

    observer.observe(host);

    return () => {
      observer.disconnect();
      chart.destroy();
      chartRef.current = null;
    };
  }, [annotations, data, dates, events, isYAxisBaselineZero, resolveHeight, syncKey, theme, tooltipValueLabel]);

  useEffect(() => {
    if (!chartRef.current || data[0].length === 0) {
      return;
    }

    const min = toUnixDay(range.start);
    const max = toUnixDay(range.end) + 86399;
    chartRef.current.setScale("x", { min, max });
    setItems(timelineItems(chartRef.current, events, annotations, dates[0], dates[dates.length - 1]));
  }, [annotations, data, dates, events, range.end, range.start]);

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
        <div className="min-h-[220px] grid place-items-center text-center">
          <div className="text-[var(--color-text-muted)] text-[0.9rem]">
            <p className="m-0 mb-3">No data for this source in the selected date range.</p>
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("resetDateRange"));
              }}
              className="px-4 py-2 text-[0.85rem] font-semibold text-[var(--color-brand-red)] bg-transparent border border-[rgba(220,40,40,0.45)] rounded-lg cursor-pointer transition-all duration-130 hover:border-[rgba(220,40,40,0.8)] hover:bg-[rgba(220,40,40,0.14)]"
            >
              Reset range
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={chartShellRef}
      className="border border-[var(--color-surface-2)] rounded-xl bg-[var(--color-surface-1)] p-2.5 animate-[card-enter_340ms_ease_both]"
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setSelectedEventKeys([]);
      }}
    >
      {(title || subtitle || shareUrl) && showTitle ? (
        <div className="block m-1 mb-2.5">
          <div className="chart-heading">
            {/* Left: share URL watermark */}
            <div className="min-h-[30px] flex items-start">
              {shareUrl ? (
                <span
                  className="text-[var(--color-text-muted)] text-[0.75rem] tabular-nums select-none"
                  aria-label="Share URL"
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                >
                  {formatShareUrl(shareUrl)}
                </span>
              ) : null}
            </div>

            {/* Center: title + subtitle */}
            <div className="chart-heading-copy grid gap-1 justify-items-center">
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

            {/* Right: action buttons */}
            <div className="chart-heading-actions min-h-[30px] flex justify-end items-start gap-2 flex-wrap">
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
        onPointerEnter={() => { isPlotPointerInsideRef.current = true; }}
        onPointerDown={() => { isPlotPointerInsideRef.current = true; }}
        onPointerLeave={() => {
          isPlotPointerInsideRef.current = false;
          if (tooltipRef.current) tooltipRef.current.style.opacity = "0";
        }}
      >
        <div ref={hostRef} className="w-full h-full" />
        <div ref={tooltipRef} className="uplot-tooltip" />
      </div>
      {items.length > 0 ? (
        <section className="chart-history" aria-label="RotMG timeline">
          <div className="chart-history-heading">
            <strong>Timeline</strong>
            <span>Hover or drag near a marker for details</span>
          </div>
          <div
            className="chart-history-rail"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              selectEventAtPointer(event.clientX, event.currentTarget);
            }}
            onPointerMove={(event) => {
              if (event.pointerType === "mouse" || event.buttons > 0) {
                selectEventAtPointer(event.clientX, event.currentTarget);
              }
            }}
          >
            {items.filter((item) => item.endX > item.x).map((item) => (
              <button
                key={item.key}
                type="button"
                className={`chart-history-span${item.annotation ? " chart-history-span-annotation" : ""}`}
                style={{ left: `${item.x}px`, width: `${Math.max(6, item.endX - item.x)}px` }}
                aria-label={item.annotation
                  ? `${item.annotation.label}: ${item.annotation.start} to ${item.annotation.end}`
                  : `${item.events?.[0].title}: ${item.events?.[0].date} to ${item.events?.[0].end}`}
                aria-pressed={selectedEventKeys.includes(item.key)}
                onFocus={(event) => {
                  if (event.currentTarget.matches(":focus-visible")) setSelectedEventKeys([item.key]);
                }}
                onClick={(event) => {
                  if (event.detail === 0) setSelectedEventKeys([item.key]);
                }}
              />
            ))}
            {items.filter((item) => item.x === item.endX).map((item) => (
              <button
                key={item.key}
                type="button"
                className="chart-history-marker"
                style={{ left: `${item.x}px` }}
                aria-label={
                  item.events?.length === 1
                    ? `${item.events[0].date}: ${item.events[0].title}`
                    : `${item.events?.length} events: ${item.events?.map((event) => event.title).join(", ")}`
                }
                aria-pressed={selectedEventKeys.includes(item.key)}
                onFocus={(event) => {
                  if (event.currentTarget.matches(":focus-visible")) setSelectedEventKeys([item.key]);
                }}
                onClick={(event) => {
                  if (event.detail === 0) setSelectedEventKeys([item.key]);
                }}
              >
                <span className="chart-history-marker-symbol" aria-hidden="true" />
                {(item.events?.length ?? 0) > 1 ? <span className="chart-history-marker-count">{item.events?.length}</span> : null}
              </button>
            ))}
          </div>
          {selectedItems.length > 0 ? (
            <div className="chart-history-detail">
              <div className="chart-history-navigation" aria-label="Browse history events">
                <button
                  type="button"
                  onClick={() => setSelectedEventKeys([items[selectedEventIndex - 1].key])}
                  disabled={selectedEventIndex <= 0}
                  aria-label="Previous history event"
                ><ChevronLeft size={16} aria-hidden="true" /></button>
                <span>{selectedItems.length > 1 ? `${selectedItems.length} here` : `${selectedEventIndex + 1} of ${items.length}`}</span>
                <button
                  type="button"
                  onClick={() => setSelectedEventKeys([items[selectedEventIndex + 1].key])}
                  disabled={selectedEventIndex >= items.length - 1}
                  aria-label="Next history event"
                ><ChevronRight size={16} aria-hidden="true" /></button>
              </div>
              {selectedItems.map((selectedItem) => (
                <div className="chart-history-selection" key={selectedItem.key}>
                  {selectedItem.annotation ? (
                    <div className="chart-history-entry">
                      <time dateTime={selectedItem.annotation.start}>
                        {formatAnnotationDate(selectedItem.annotation.start, true)} – {formatAnnotationDate(selectedItem.annotation.end, true)}
                      </time>
                      <strong>{selectedItem.annotation.label}</strong>
                      <p>{selectedItem.annotation.description}</p>
                    </div>
                  ) : null}
                  {selectedItem.events?.map((event) => (
                    <div className="chart-history-entry" key={`${event.date}-${event.title}`}>
                      <time dateTime={event.date}>
                        {formatAnnotationDate(event.date, true)}
                        {event.end ? ` – ${formatAnnotationDate(event.end, true)}` : ""}
                      </time>
                      <strong>{event.title}</strong>
                      <p>{event.description}</p>
                      <div className="chart-history-sources">
                        {event.sources.map((source) => (
                          <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">
                            {source.label} <ExternalLink size={12} aria-hidden="true" />
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
