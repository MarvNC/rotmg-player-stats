import { useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { CalendarDays, SlidersHorizontal } from "lucide-react";
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
  const sliderRef = useRef<HTMLDivElement>(null);

  const bounds = useMemo(() => {
    if (dates.length <= 1) {
      return {
        start: 0,
        end: 0,
        startPercent: 0,
        endPercent: 100,
      };
    }

    const start = Math.min(findStartIndex(dates, range.start), dates.length - 2);
    const end = Math.min(dates.length - 1, Math.max(start + 1, findEndIndex(dates, range.end)));

    const denominator = dates.length - 1;

    return {
      start,
      end,
      startPercent: (start / denominator) * 100,
      endPercent: (end / denominator) * 100,
    };
  }, [dates, range.end, range.start]);

  if (dates.length < 2) {
    return null;
  }

  const onStartChange = (nextStartRaw: number) => {
    const nextStart = Math.min(nextStartRaw, bounds.end - 1);
    onChange({
      start: dates[nextStart] ?? dates[0],
      end: dates[bounds.end] ?? dates[dates.length - 1],
    });
  };

  const onEndChange = (nextEndRaw: number) => {
    const nextEnd = Math.max(nextEndRaw, bounds.start + 1);
    onChange({
      start: dates[bounds.start] ?? dates[0],
      end: dates[nextEnd] ?? dates[dates.length - 1],
    });
  };

  const onTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const wrap = sliderRef.current;
    if (!wrap) {
      return;
    }

    event.preventDefault();

    const totalSteps = dates.length - 1;
    const currentWindow = bounds.end - bounds.start;
    const maxStart = totalSteps - currentWindow;

    if (totalSteps <= 0 || maxStart < 0) {
      return;
    }

    const startX = event.clientX;
    const baseStart = bounds.start;
    const width = Math.max(wrap.clientWidth, 1);

    const updateFromClientX = (clientX: number) => {
      const deltaPx = clientX - startX;
      const deltaStep = Math.round((deltaPx / width) * totalSteps);
      const nextStart = Math.min(Math.max(baseStart + deltaStep, 0), maxStart);
      const nextEnd = nextStart + currentWindow;

      onChange({
        start: dates[nextStart] ?? dates[0],
        end: dates[nextEnd] ?? dates[dates.length - 1],
      });
    };

    const handleMove = (moveEvent: PointerEvent) => {
      updateFromClientX(moveEvent.clientX);
    };

    const handleStop = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleStop);
      window.removeEventListener("pointercancel", handleStop);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleStop);
    window.addEventListener("pointercancel", handleStop);
  };

  return (
    <section aria-label="Global chart range slider">
      <div className="flex justify-between items-baseline gap-3 mb-3">
        <h3 className="m-0 inline-flex items-center gap-2 text-[0.9rem] uppercase tracking-widest text-[var(--color-text-muted)]">
          <SlidersHorizontal size={14} aria-hidden="true" className="text-[var(--color-brand-red)]" />
          Global Time Range
        </h3>
        <p className="m-0 inline-flex gap-2 items-center text-[0.82rem] text-[var(--color-text-muted)]">
          <CalendarDays size={14} aria-hidden="true" className="text-[var(--color-brand-red)]" />
          <span className="tabular-nums" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            {dates[bounds.start]}
          </span>
          <span>to</span>
          <span className="tabular-nums" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            {dates[bounds.end]}
          </span>
        </p>
      </div>

      <div className="relative h-[34px]" ref={sliderRef}>
        <div
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-[var(--color-timeline-track-bg)] border border-[var(--color-timeline-track-border)]"
          aria-hidden="true"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full cursor-grab active:cursor-grabbing touch-none"
          style={{
            left: `${bounds.startPercent}%`,
            width: `${bounds.endPercent - bounds.startPercent}%`,
            background: "linear-gradient(90deg, rgba(220, 40, 40, 0.35), rgba(220, 40, 40, 0.8))",
          }}
          onPointerDown={onTrackPointerDown}
          aria-hidden="true"
        />

        <input
          type="range"
          className="timeline-thumb absolute inset-0 w-full m-0 pointer-events-none bg-transparent appearance-none"
          min={0}
          max={dates.length - 1}
          value={bounds.start}
          onChange={(event) => onStartChange(Number.parseInt(event.target.value, 10))}
          aria-label="Range start"
        />

        <input
          type="range"
          className="timeline-thumb absolute inset-0 w-full m-0 pointer-events-none bg-transparent appearance-none"
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
