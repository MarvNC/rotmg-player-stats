import { useEffect, useMemo, useRef } from "react";
import uPlot from "uplot";
import type { AlignedData, Options } from "uplot";
import type { DateRange } from "../types";

type PlayerChartProps = {
  title: string;
  dates: string[];
  minValues: Array<number | null>;
  maxValues: Array<number | null>;
  range: DateRange;
  syncKey: string;
};

function toUnixDay(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000);
}

function formatDateLabel(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

function formatPlayers(value: number | null): string {
  if (value == null) {
    return "-";
  }

  return Intl.NumberFormat("en-US").format(value);
}

export function PlayerChart({ title, dates, minValues, maxValues, range, syncKey }: PlayerChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);

  const data = useMemo<AlignedData>(() => {
    const x = dates.map(toUnixDay);
    return [x, minValues, maxValues];
  }, [dates, minValues, maxValues]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || data[0].length === 0) {
      return;
    }

    const options: Options = {
      title,
      width: Math.max(host.clientWidth, 320),
      height: 392,
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
          auto: true
        }
      },
      axes: [
        {
          stroke: "#737373",
          grid: {
            show: false
          },
          ticks: {
            stroke: "#262626"
          },
          values: (_, splits) => splits.map((split) => formatDateLabel(Number(split)))
        },
        {
          stroke: "#737373",
          grid: {
            stroke: "#262626",
            width: 1
          },
          ticks: {
            stroke: "#262626"
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
          fill: "rgba(220,40,40,0.24)",
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

            tooltip.innerHTML = `<strong>${formatDateLabel(xValue)}</strong><span>${formatPlayers(yValue)} players</span>`;

            const left = chart.valToPos(xValue, "x");
            const top = chart.valToPos(yValue, "y");
            const clampedLeft = Math.min(Math.max(left + 14, 10), chart.bbox.width - 166);
            const clampedTop = Math.max(Math.min(top - 44, chart.bbox.height - 56), 8);

            tooltip.style.transform = `translate(${clampedLeft}px, ${clampedTop}px)`;
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
        chart.setSize({ width, height: 392 });
      }
    });

    observer.observe(host);

    return () => {
      observer.disconnect();
      chart.destroy();
      chartRef.current = null;
    };
  }, [data, syncKey, title]);

  useEffect(() => {
    if (!chartRef.current || data[0].length === 0) {
      return;
    }

    const min = toUnixDay(range.start);
    const max = toUnixDay(range.end) + 86399;
    chartRef.current.setScale("x", { min, max });
  }, [data, range.end, range.start]);

  if (data[0].length === 0) {
    return (
      <div className="chart-shell">
        <div className="chart-empty">No data for this source in the selected date range.</div>
      </div>
    );
  }

  return (
    <div className="chart-shell">
      <div className="chart-frame">
        <div ref={hostRef} className="uplot-shell" />
        <div ref={tooltipRef} className="uplot-tooltip" />
      </div>
    </div>
  );
}
