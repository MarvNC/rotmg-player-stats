export type DailyPoint = {
  date: string;
  realmeye_max: number | null;
  realmstock_max: number | null;
  launcher_loads: number | null;
};

/** Latest raw scrape values, published alongside the daily array each run. */
export type Snapshot = {
  /** ISO 8601 UTC timestamp of the scrape that produced this snapshot */
  t: string;
  /** Latest realmeye active player count */
  a: number | null;
  /** Latest realmstock live player count */
  c: number | null;
  /** Launcher loads over the 24h window ending at the snapshot timestamp */
  f: number | null;
};

export type CompactDaily = {
  u?: string;
  d: string[];
  a: Array<number | null>;
  c: Array<number | null>;
  f: Array<number | null>;
  /** Current snapshot — present from the first aggregate run that includes it */
  s?: Snapshot;
};

export type DateRange = {
  start: string;
  end: string;
};
