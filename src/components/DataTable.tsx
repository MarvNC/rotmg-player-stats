import { useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronUp, Download, Search, Table2 } from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { TableRow } from "../utils/metrics";

type DataTableProps = {
  rows: TableRow[];
  onResetRange?: () => void;
};

const CSV_HEADERS = [
  "date",
  "realmeye_max",
  "realmstock_max",
  "launcher_loads",
  "realmeye_delta",
  "realmstock_delta",
  "launcher_delta",
] as const;

function numberFormatter(value: number | null): string {
  if (value == null) {
    return "-";
  }

  return Intl.NumberFormat("en-US").format(value);
}

function escapeCsv(value: string): string {
  if (!/[",\n]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}

export function DataTable({ rows, onResetRange }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const viewportRef = useRef<HTMLDivElement>(null);

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

          const className =
            value >= 0
              ? "inline-block rounded-full px-1.5 py-0.5 text-[0.72rem] text-[#052e16] bg-[#34d399]"
              : "inline-block rounded-full px-1.5 py-0.5 text-[0.72rem] text-[#fef2f2] bg-[#b91c1c]";
          return (
            <span className={className} style={{ fontFamily: '"JetBrains Mono", monospace' }}>
              {value >= 0 ? "+" : ""}
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

          const className =
            value >= 0
              ? "inline-block rounded-full px-1.5 py-0.5 text-[0.72rem] text-[#052e16] bg-[#34d399]"
              : "inline-block rounded-full px-1.5 py-0.5 text-[0.72rem] text-[#fef2f2] bg-[#b91c1c]";
          return (
            <span className={className} style={{ fontFamily: '"JetBrains Mono", monospace' }}>
              {value >= 0 ? "+" : ""}
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

          const className =
            value >= 0
              ? "inline-block rounded-full px-1.5 py-0.5 text-[0.72rem] text-[#052e16] bg-[#34d399]"
              : "inline-block rounded-full px-1.5 py-0.5 text-[0.72rem] text-[#fef2f2] bg-[#b91c1c]";
          return (
            <span className={className} style={{ fontFamily: '"JetBrains Mono", monospace' }}>
              {value >= 0 ? "+" : ""}
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
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, columnId, filterValue) => {
      const search = String(filterValue).trim().toLowerCase();
      if (!search) {
        return true;
      }

      const rawValue = row.getValue(columnId);
      const normalizedValue =
        typeof rawValue === "string" || typeof rawValue === "number" || typeof rawValue === "boolean"
          ? String(rawValue)
          : "";
      return normalizedValue.toLowerCase().includes(search);
    },
  });

  const tableRows = table.getRowModel().rows;

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => 46,
    overscan: 10,
  });

  const onExport = () => {
    const lines = [CSV_HEADERS.join(",")];

    for (const row of tableRows) {
      const values = CSV_HEADERS.map((key) => {
        const raw = row.original[key];
        if (raw == null) {
          return "";
        }

        return escapeCsv(String(raw));
      });

      lines.push(values.join(","));
    }

    const csvBlob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(csvBlob);
    link.download = "rotmg-daily-data.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <section
      className="border border-[var(--color-surface-2)] rounded-xl bg-[var(--color-surface-1)] p-3"
      aria-label="Daily data table"
    >
      <div className="flex justify-between items-center mb-2.5 gap-3">
        <h2 className="m-0 text-base inline-flex items-center gap-2">
          <Table2 size={16} aria-hidden="true" className="text-[var(--color-brand-red)]" />
          Daily Data
        </h2>

        <div className="flex items-center gap-2.5">
          <label
            className="inline-flex items-center gap-2 px-2.5 py-2 border border-[var(--color-surface-2)] rounded bg-[var(--color-surface-2)] min-w-[220px] focus-within:border-[var(--color-brand-red)] focus-within:shadow-[0_0_0_2px_rgba(220,40,40,0.4)]"
            htmlFor="table-search-input"
          >
            <span className="text-[var(--color-text-muted)] inline-flex items-center" aria-hidden="true">
              <Search size={14} />
            </span>
            <input
              id="table-search-input"
              type="search"
              className="w-full border-0 outline-0 bg-transparent text-[var(--color-text-main)] text-[0.88rem] placeholder:text-[var(--color-text-muted)]"
              style={{ fontFamily: "Sora, sans-serif" }}
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Search rows"
            />
          </label>

          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-[var(--color-surface-2)] rounded bg-transparent text-[var(--color-text-main)] font-semibold cursor-pointer transition-colors duration-130 hover:bg-[var(--color-surface-2)]"
            onClick={onExport}
          >
            <Download size={14} aria-hidden="true" />
            Export CSV
          </button>
        </div>
      </div>

      <div
        className="h-[64vh] min-h-[420px] border border-[var(--color-border-subtle)] rounded-[10px] overflow-hidden bg-[var(--color-data-grid-bg)] data-grid"
        style={{ "--table-columns": "120px repeat(6, minmax(0, 1fr))" } as CSSProperties}
      >
        <div
          className="grid sticky top-0 z-[3] bg-[var(--color-surface-2)] border-b border-[rgba(255,255,255,0.08)]"
          style={{ gridTemplateColumns: "var(--table-columns)" }}
          role="row"
        >
          {table.getFlatHeaders().map((header) => {
            const sortState = header.column.getIsSorted();

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
                  <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
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
    </section>
  );
}
