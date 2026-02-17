import type { RangePreset } from "../utils/dateRange";
import { CalendarRange } from "lucide-react";

type RangeSelectorProps = {
  active: RangePreset;
  onSelect: (preset: RangePreset) => void;
};

const PRESETS: RangePreset[] = ["1M", "6M", "1Y", "2Y", "ALL"];

export function RangeSelector({ active, onSelect }: RangeSelectorProps) {
  return (
    <div className="range-selector" role="group" aria-label="Date range presets">
      <span className="range-selector-icon" aria-hidden="true">
        <CalendarRange size={15} />
      </span>

      {PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          className={`range-pill${active === preset ? " active" : ""}`}
          onClick={() => onSelect(preset)}
        >
          {preset}
        </button>
      ))}
    </div>
  );
}
