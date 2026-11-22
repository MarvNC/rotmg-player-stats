function parseHistogramValues(html: string): number[] {
  const rankHistogramMatch = html.match(/renderPlayerRankHistogram\([^,]+,\s*(\[\[[\s\S]*?\]\])\s*\)/);
  if (rankHistogramMatch?.[1]) {
    const pairs = [...rankHistogramMatch[1].matchAll(/\[(\d+),(\d+)\]/g)];
    const values = pairs
      .map((match) => Number.parseInt(match[2] ?? "", 10))
      .filter((value) => Number.isFinite(value) && value >= 0);

    if (values.length > 0) {
      return values;
    }
  }

  const ySeries = [...html.matchAll(/"y"\s*:\s*\[([\d,\s]+)\]/g)]
    .map((match) => match[1])
    .filter((value): value is string => Boolean(value));

  if (ySeries.length === 0) {
    return [];
  }

  const parsedSeries = ySeries
    .map((series) =>
      series
        .split(",")
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isFinite(value) && value >= 0)
    )
    .filter((series) => series.length > 1);

  if (parsedSeries.length === 0) {
    return [];
  }

  parsedSeries.sort((a, b) => b.reduce((sum, value) => sum + value, 0) - a.reduce((sum, value) => sum + value, 0));

  return parsedSeries[0] ?? [];
}

export async function readRealmEyeCount(response: Response): Promise<number> {
  if (response.headers.get("cf-mitigated") === "challenge") {
    throw new Error(`RealmEye returned an access challenge (HTTP ${response.status}); no sample collected`);
  }

  if (!response.ok) {
    throw new Error(`RealmEye request failed with ${response.status}`);
  }

  const html = await response.text();
  // The upstream interstitial can return 200 and contain unrelated script data.
  const hasInterstitialTitle = /<title\b[^>]*>\s*Just a moment(?:\.{3}|…)\s*<\/title\s*>/i.test(html);
  if (hasInterstitialTitle && /This page requires JavaScript/i.test(html)) {
    throw new Error(`RealmEye returned an access interstitial (HTTP ${response.status}); no sample collected`);
  }

  const buckets = parseHistogramValues(html);
  if (buckets.length === 0) {
    throw new Error("Unable to parse RealmEye histogram data");
  }

  return buckets.reduce((sum, value) => sum + value, 0);
}
