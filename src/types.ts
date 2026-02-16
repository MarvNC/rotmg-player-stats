export type DailyPoint = {
  date: string;
  realmeye_max: number | null;
  realmeye_min: number | null;
  realmstock_max: number | null;
  realmstock_min: number | null;
  launcher_loads: number | null;
};

export type DateRange = {
  start: string;
  end: string;
};
