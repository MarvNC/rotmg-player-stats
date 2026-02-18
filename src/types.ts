export type DailyPoint = {
  date: string;
  realmeye_max: number | null;
  realmstock_max: number | null;
  launcher_loads: number | null;
};

export type CompactDaily = {
  u?: string;
  d: string[];
  a: Array<number | null>;
  c: Array<number | null>;
  f: Array<number | null>;
};

export type DateRange = {
  start: string;
  end: string;
};
