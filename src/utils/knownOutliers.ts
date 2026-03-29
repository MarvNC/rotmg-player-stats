/**
 * Dates where launcher loads data is known to be invalid (e.g. imgur API
 * outages that left the view counter static). Values on these dates are
 * suppressed client-side to avoid distorting graphs.
 */
export const LAUNCHER_EXCLUDED_DATES = new Set<string>([
  "2026-03-23", // imgur API outage – static/stuck view counter
  "2026-03-24", // imgur API outage – static/stuck view counter
]);

/**
 * Dates where realmstock live player data is known to be an extreme outlier.
 * Values on these dates are suppressed client-side to avoid distorting graphs.
 */
export const REALMSTOCK_EXCLUDED_DATES = new Set<string>([
  "2025-02-12", // anomalous low (281 vs ~3200 on adjacent days)
]);
