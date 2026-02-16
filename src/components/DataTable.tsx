import { useMemo, useRef, useState, type CSSProperties } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { TableRow } from "../utils/metrics";

type DataTableProps = {
  rows: TableRow[];
};

const CSV_HEADERS = [
  "date",
  "realmeye_max",
  "realmeye_min",
  "realmstock_max",
  "realmstock_min",
  "realmeye_delta",
  "launcher_loads",
  "launcher_delta"
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

  return `"${value.replaceAll("\"", "\"\"")}"`;
}

export function DataTable({ rows }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const viewportRef = useRef<HTMLDivElement>(null);

  const columns = useMemo<ColumnDef<TableRow>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        cell: (info) => <span className="table-date mono">{info.getValue<string>()}</span>
      },
      {
        accessorKey: "realmeye_max",
        header: "RealmEye Max",
        cell: (info) => <span className="table-number mono">{numberFormatter(info.getValue<number | null>())}</span>
      },
      {
        accessorKey: "realmeye_min",
        header: "RealmEye Min",
        cell: (info) => <span className="table-number mono">{numberFormatter(info.getValue<number | null>())}</span>
      },
      {
        accessorKey: "realmstock_max",
        header: "RealmStock Max",
        cell: (info) => <span className="table-number mono">{numberFormatter(info.getValue<number | null>())}</span>
      },
      {
        accessorKey: "realmstock_min",
        header: "RealmStock Min",
        cell: (info) => <span className="table-number mono">{numberFormatter(info.getValue<number | null>())}</span>
      },
      {
        accessorKey: "realmeye_delta",
        header: "RealmEye Delta",
        cell: (info) => {
          const value = info.getValue<number | null>();
          if (value == null) {
            return <span className="table-number mono">-</span>;
          }

          const className = value >= 0 ? "delta-pill positive" : "delta-pill negative";
          return (
            <span className={className}>
              {value >= 0 ? "+" : ""}
              {numberFormatter(value)}
            </span>
          );
        }
      },
      {
        accessorKey: "launcher_loads",
        header: "Launcher Loads",
        cell: (info) => <span className="table-number mono">{numberFormatter(info.getValue<number | null>())}</span>
      },
      {
        accessorKey: "launcher_delta",
        header: "Launcher Delta",
        cell: (info) => {
          const value = info.getValue<number | null>();
          if (value == null) {
            return <span className="table-number mono">-</span>;
          }

          const className = value >= 0 ? "delta-pill positive" : "delta-pill negative";
          return (
            <span className={className}>
              {value >= 0 ? "+" : ""}
              {numberFormatter(value)}
            </span>
          );
        }
      }
    ],
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      globalFilter
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
      return String(rawValue ?? "").toLowerCase().includes(search);
    }
  });

  const tableRows = table.getRowModel().rows;

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => 46,
    overscan: 10
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
    <section className="table-section" aria-label="Daily data table">
      <div className="table-toolbar">
        <h2>Daily Data</h2>

        <div className="table-actions">
          <label className="table-search" htmlFor="table-search-input">
            <span className="table-search-icon" aria-hidden="true">
              {">>"}
            </span>
            <input
              id="table-search-input"
              type="search"
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Search rows"
            />
          </label>

          <button type="button" className="outline-button" onClick={onExport}>
            Export CSV
          </button>
        </div>
      </div>

      <div
        className="data-grid"
        style={{ "--table-columns": "130px 150px 150px 160px 160px 160px 160px 160px" } as CSSProperties}
      >
        <div className="data-grid-row data-grid-header" role="row">
          {table.getFlatHeaders().map((header) => {
            const sortState = header.column.getIsSorted();

            return (
              <div className="data-grid-cell" key={header.id} role="columnheader">
                <button
                  type="button"
                  className={`header-sort${sortState ? " sorted" : ""}`}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                  <span className={`sort-indicator${sortState ? " active" : ""}`}>
                    {sortState === "asc" ? "^" : sortState === "desc" ? "v" : "^v"}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <div ref={viewportRef} className="data-grid-viewport" role="rowgroup">
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = tableRows[virtualRow.index];

              return (
                <div
                  key={row.id}
                  className={`data-grid-row data-grid-body-row${virtualRow.index % 2 === 0 ? " even" : " odd"}`}
                  role="row"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      role="cell"
                      className={`data-grid-cell${cell.column.id === "date" ? "" : " is-number"}`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="table-footnote">Showing {tableRows.length.toLocaleString()} daily rows</p>
    </section>
  );
}
