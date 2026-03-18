import { useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronUp, Table2 } from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { DateRange } from "../types";
import type { TableRow } from "../utils/metrics";
import { SharedRangeSlider } from "./SharedRangeSlider";

type DataTableProps = {
  rows: TableRow[];
  onResetRange?: () => void;
  // Range slider props
  allDates: string[];
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
};

/** Per-column tooltip descriptions */
const COLUMN_TOOLTIPS: Record<string, string> = {
  date: "Calendar date (UTC) for this row of data.",
  realmeye_max:
    "Peak concurrent players seen via RealmEye scraping in this 24-hour window. RealmEye counts players visible on the leaderboard in the last two weeks.",
  realmstock_max: "Maximum number of players logged in at any single point during this day, sourced from RealmStock.",
  launcher_loads:
    "Total number of times the game launcher was opened on this day, derived from cumulative launcher view counts.",
  realmeye_delta: "Day-over-day change in RealmEye peak players. Positive = more active players than the previous day.",
  realmstock_delta: "Day-over-day change in RealmStock max online. Positive = higher peak than the previous day.",
  launcher_delta: "Day-over-day change in launcher loads. Positive = more launcher opens than the previous day.",
};

type TooltipState = { text: string; x: number; y: number } | null;

function numberFormatter(value: number | null): string {
  if (value == null) {
    return "-";
  }

  return Intl.NumberFormat("en-US").format(value);
}

export function DataTable({ rows, onResetRange, allDates, range, onRangeChange }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [activeTooltip, setActiveTooltip] = useState<TooltipState>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const showTooltip = (text: string) => (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setActiveTooltip({ text, x: rect.left + rect.width / 2, y: rect.top - 8 });
  };
  const hideTooltip = () => setActiveTooltip(null);

  const columns = useMemo<ColumnDef<TableRow>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        cell: (info) => (
          <span className="tabular-nums" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            {info.getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: "realmeye_max",
        header: "RealmEye Max",
        cell: (info) => (
          <span className="tabular-nums" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            {numberFormatter(info.getValue<number | null>())}
          </span>
        ),
      },
      {
        accessorKey: "realmstock_max",
        header: "RealmStock Max",
        cell: (info) => (
          <span className="tabular-nums" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            {numberFormatter(info.getValue<number | null>())}
          </span>
        ),
      },
      {
        accessorKey: "launcher_loads",
        header: "Launcher Loads",
        cell: (info) => (
          <span className="tabular-nums" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            {numberFormatter(info.getValue<number | null>())}
          </span>
        ),
      },
      {
        accessorKey: "realmeye_delta",
        header: "RealmEye Delta",
        cell: (info) => {
          const value = info.getValue<number | null>();
          if (value == null) {
            return (
              <span className="tabular-nums" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                -
              </span>
            );
          }

          const isPositive = value >= 0;
          const color = isPositive ? "var(--color-emerald)" : "var(--color-brand-red)";
          return (
            <span className="tabular-nums font-medium" style={{ fontFamily: '"JetBrains Mono", monospace', color }}>
              {isPositive ? "+" : ""}
              {numberFormatter(value)}
            </span>
          );
        },
      },
      {
        accessorKey: "realmstock_delta",
        header: "RealmStock Delta",
        cell: (info) => {
          const value = info.getValue<number | null>();
          if (value == null) {
            return (
              <span className="tabular-nums" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                -
              </span>
            );
          }

          const isPositive = value >= 0;
          const color = isPositive ? "var(--color-emerald)" : "var(--color-brand-red)";
          return (
            <span className="tabular-nums font-medium" style={{ fontFamily: '"JetBrains Mono", monospace', color }}>
              {isPositive ? "+" : ""}
              {numberFormatter(value)}
            </span>
          );
        },
      },
      {
        accessorKey: "launcher_delta",
        header: "Launcher Delta",
        cell: (info) => {
          const value = info.getValue<number | null>();
          if (value == null) {
            return (
              <span className="tabular-nums" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                -
              </span>
            );
          }

          const isPositive = value >= 0;
          const color = isPositive ? "var(--color-emerald)" : "var(--color-brand-red)";
          return (
            <span className="tabular-nums font-medium" style={{ fontFamily: '"JetBrains Mono", monospace', color }}>
              {isPositive ? "+" : ""}
              {numberFormatter(value)}
            </span>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const tableRows = table.getRowModel().rows;

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => 46,
    overscan: 10,
  });

  return (
    <section
      className="border border-[var(--color-surface-2)] rounded-xl bg-[var(--color-surface-1)] p-3"
      aria-label="Daily data table"
    >
      {/* Range slider */}
      <div className="mb-3">
        <SharedRangeSlider dates={allDates} range={range} onChange={onRangeChange} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center mb-2.5 gap-2">
        <Table2 size={15} aria-hidden="true" className="text-[var(--color-brand-red)]" />
        <h2 className="m-0 text-base">Daily Data</h2>
        <span className="ml-auto text-[0.78rem] text-[var(--color-text-muted)]">
          {tableRows.length.toLocaleString()} rows
        </span>
      </div>

      {/* Grid */}
      <div
        className="h-[64vh] min-h-[420px] border border-[var(--color-border-subtle)] rounded-[10px] overflow-hidden bg-[var(--color-data-grid-bg)] data-grid"
        style={{ "--table-columns": "120px repeat(6, minmax(0, 1fr))" } as CSSProperties}
      >
        {/* Sticky header row */}
        <div
          className="grid sticky top-0 z-[3] bg-[var(--color-surface-2)] border-b border-[rgba(255,255,255,0.08)]"
          style={{ gridTemplateColumns: "var(--table-columns)" }}
          role="row"
        >
          {table.getFlatHeaders().map((header) => {
            const sortState = header.column.getIsSorted();
            const tooltipText = COLUMN_TOOLTIPS[header.column.id];

            return (
              <div
                className="px-2 py-2.5 border-b border-[rgba(255,255,255,0.05)] border-r border-r-[rgba(255,255,255,0.06)] text-[0.84rem] text-[var(--color-text-main)] last:border-r-0"
                key={header.id}
                role="columnheader"
              >
                <button
                  type="button"
                  className={`w-full flex items-center justify-between gap-1.5 border-0 bg-transparent text-[var(--color-text-main)] text-[0.74rem] font-semibold uppercase tracking-widest cursor-pointer py-3 ${sortState ? "sorted" : ""}`}
                  style={{ fontFamily: "Sora, sans-serif" }}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <span className="flex items-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {tooltipText && (
                      <span
                        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-[var(--color-text-muted)] text-[var(--color-text-muted)] text-[0.6rem] font-bold leading-none cursor-help select-none transition-colors duration-120 hover:border-[var(--color-brand-red)] hover:text-[var(--color-brand-red)]"
                        onMouseEnter={showTooltip(tooltipText)}
                        onMouseLeave={hideTooltip}
                        aria-label={tooltipText}
                      >
                        ?
                      </span>
                    )}
                  </span>
                  <span
                    className={`inline-flex items-center justify-center w-4 h-4 text-[var(--color-text-muted)] transition-opacity duration-120 ${sortState ? "opacity-100 !text-[var(--color-brand-red)]" : "opacity-0 hover:opacity-100"}`}
                  >
                    {sortState === "asc" ? (
                      <ChevronUp size={14} />
                    ) : sortState === "desc" ? (
                      <ChevronDown size={14} />
                    ) : (
                      <span className="inline-flex flex-col items-center leading-none">
                        <ChevronUp size={10} className="-mb-0.5" />
                        <ChevronDown size={10} className="-mt-0.5" />
                      </span>
                    )}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Virtualised rows */}
        <div
          ref={viewportRef}
          className="h-[calc(64vh-46px)] min-h-[374px] overflow-auto scrollbar-gutter-stable data-grid-viewport"
          role="rowgroup"
        >
          {tableRows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
              <p className="text-[var(--color-text-muted)] text-[0.88rem]">
                No data for this source in the selected date range.
              </p>
              {onResetRange && (
                <button
                  type="button"
                  onClick={onResetRange}
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-[var(--color-surface-2)] rounded bg-[var(--color-surface-2)] text-[var(--color-text-main)] font-semibold cursor-pointer transition-colors duration-130 hover:bg-[var(--color-surface-1)] hover:border-[var(--color-brand-red)]"
                >
                  Reset range
                </button>
              )}
            </div>
          ) : (
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = tableRows[virtualRow.index];

                return (
                  <div
                    key={row.id}
                    className={`grid hover:bg-[rgba(220,40,40,0.09)] ${virtualRow.index % 2 === 0 ? "bg-[var(--color-panel-highlight)]" : ""}`}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                      gridTemplateColumns: "var(--table-columns)",
                    }}
                    role="row"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <div
                        key={cell.id}
                        role="cell"
                        className={`px-2 py-2.5 border-b border-[rgba(255,255,255,0.05)] border-r border-r-[rgba(255,255,255,0.06)] text-[0.84rem] text-[var(--color-text-main)] last:border-r-0 ${cell.column.id === "date" ? "" : "text-right"}`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <p className="my-2.5 mx-0.5 text-[0.78rem] text-[var(--color-text-muted)]">
        Showing {tableRows.length.toLocaleString()} daily rows
      </p>

      {/* Fixed-position tooltip — renders above any overflow:hidden ancestor */}
      {activeTooltip && (
        <div
          style={{
            position: "fixed",
            left: activeTooltip.x,
            top: activeTooltip.y,
            transform: "translateX(-50%) translateY(-100%)",
            zIndex: 9999,
            pointerEvents: "none",
            fontFamily: "Sora, sans-serif",
          }}
          className="max-w-[220px] px-2.5 py-2 rounded-md border border-[var(--color-surface-2)] bg-[var(--color-surface-1)] text-[var(--color-text-main)] text-[0.75rem] leading-relaxed shadow-[0_4px_20px_rgba(0,0,0,0.6)]"
        >
          {activeTooltip.text}
        </div>
      )}
    </section>
  );
}
