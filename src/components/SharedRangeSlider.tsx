import { useMemo } from "react";
import type { DateRange } from "../types";

type SharedRangeSliderProps = {
  dates: string[];
  range: DateRange;
  onChange: (nextRange: DateRange) => void;
};

function findStartIndex(dates: string[], target: string): number {
  const index = dates.findIndex((date) => date >= target);
  return index === -1 ? dates.length - 1 : index;
}

function findEndIndex(dates: string[], target: string): number {
  for (let index = dates.length - 1; index >= 0; index -= 1) {
    if (dates[index] <= target) {
      return index;
    }
  }

  return 0;
}

export function SharedRangeSlider({ dates, range, onChange }: SharedRangeSliderProps) {
  const bounds = useMemo(() => {
    if (dates.length <= 1) {
      return {
        start: 0,
        end: 0,
        startPercent: 0,
        endPercent: 100
      };
    }

    const start = Math.min(findStartIndex(dates, range.start), dates.length - 2);
    const end = Math.min(dates.length - 1, Math.max(start + 1, findEndIndex(dates, range.end)));

    const denominator = dates.length - 1;

    return {
      start,
      end,
      startPercent: (start / denominator) * 100,
      endPercent: (end / denominator) * 100
    };
  }, [dates, range.end, range.start]);

  if (dates.length < 2) {
    return null;
  }

  const onStartChange = (nextStartRaw: number) => {
    const nextStart = Math.min(nextStartRaw, bounds.end - 1);
    onChange({
      start: dates[nextStart] ?? dates[0],
      end: dates[bounds.end] ?? dates[dates.length - 1]
    });
  };

  const onEndChange = (nextEndRaw: number) => {
    const nextEnd = Math.max(nextEndRaw, bounds.start + 1);
    onChange({
      start: dates[bounds.start] ?? dates[0],
      end: dates[nextEnd] ?? dates[dates.length - 1]
    });
  };

  return (
    <section className="panel timeline-panel" aria-label="Global chart range slider">
      <div className="timeline-header">
        <h3>Global Time Range</h3>
        <p>
          <span className="mono">{dates[bounds.start]}</span>
          <span>to</span>
          <span className="mono">{dates[bounds.end]}</span>
        </p>
      </div>

      <div className="timeline-slider-wrap">
        <div className="timeline-track" aria-hidden="true" />
        <div
          className="timeline-track-active"
          style={{ left: `${bounds.startPercent}%`, width: `${bounds.endPercent - bounds.startPercent}%` }}
          aria-hidden="true"
        />

        <input
          type="range"
          className="timeline-thumb"
          min={0}
          max={dates.length - 1}
          value={bounds.start}
          onChange={(event) => onStartChange(Number.parseInt(event.target.value, 10))}
          aria-label="Range start"
        />

        <input
          type="range"
          className="timeline-thumb"
          min={0}
          max={dates.length - 1}
          value={bounds.end}
          onChange={(event) => onEndChange(Number.parseInt(event.target.value, 10))}
          aria-label="Range end"
        />
      </div>
    </section>
  );
}
