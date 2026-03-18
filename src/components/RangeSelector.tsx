import type { RangePreset } from "../utils/dateRange";
import { CalendarRange } from "lucide-react";

type RangeSelectorProps = {
  active: RangePreset;
  onSelect: (preset: RangePreset) => void;
};

const PRESETS: RangePreset[] = ["1M", "6M", "1Y", "2Y", "ALL"];

export function RangeSelector({ active, onSelect }: RangeSelectorProps) {
  return (
    <div
      className="inline-flex gap-1 p-1 border border-[var(--color-surface-2)] rounded-full bg-[var(--color-surface-1)]"
      role="group"
      aria-label="Date range presets"
    >
      <span className="inline-flex items-center text-[var(--color-text-muted)] px-1.5" aria-hidden="true">
        <CalendarRange size={14} />
      </span>

      {PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          className={`px-2.5 py-1 text-[0.85rem] font-medium tracking-wide cursor-pointer transition-all duration-130 rounded-full ${
            active === preset
              ? "bg-[var(--color-surface-2)] text-[var(--color-text-main)]"
              : "bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"
          }`}
          onClick={() => onSelect(preset)}
        >
          {preset}
        </button>
      ))}
    </div>
  );
}
