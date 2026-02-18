import { useCallback, useEffect, useState } from "react";
import type { CompactDaily, DailyPoint } from "../types";
import { decodeDailyData } from "../utils/decodeDailyData";

const DEFAULT_DAILY_DATA_URL = "https://raw.githubusercontent.com/MarvNC/rotmg-player-stats/data/daily.json";

type UseDailyDataResult = {
  data: DailyPoint[];
  isLoading: boolean;
  error: string | null;
  retry: () => void;
};

function resolveDailyDataUrl(): string {
  const configured: unknown = import.meta.env.VITE_DAILY_DATA_URL;
  return typeof configured === "string" && configured.trim().length > 0 ? configured : DEFAULT_DAILY_DATA_URL;
}

export function useDailyData(): UseDailyDataResult {
  const [data, setData] = useState<DailyPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);

  const retry = useCallback(() => {
    setRequestKey((current) => current + 1);
  }, []);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadDailyData(): Promise<void> {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(resolveDailyDataUrl(), {
          cache: "no-store",
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Daily data request failed (${response.status}).`);
        }

        const compactData = (await response.json()) as CompactDaily;
        const decodedData = decodeDailyData(compactData).sort((a, b) => a.date.localeCompare(b.date));

        setData(decodedData);
      } catch (errorValue) {
        if (abortController.signal.aborted) {
          return;
        }

        const message = errorValue instanceof Error ? errorValue.message : "Failed to load daily data.";
        setError(message);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadDailyData();

    return () => {
      abortController.abort();
    };
  }, [requestKey]);

  return { data, isLoading, error, retry };
}
