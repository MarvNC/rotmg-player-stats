import { describe, expect, it } from "vitest";
import { readRealmEyeCount } from "../scripts/lib/realmeye";

describe("RealmEye scraper responses", () => {
  it.each(['renderPlayerRankHistogram("rank", [[0,12],[1,34]])', '{"y":[12,34]}'])(
    "reads valid histogram markup: %s",
    async (html) => {
      await expect(readRealmEyeCount(new Response(html))).resolves.toBe(46);
    }
  );

  it("does not read unrelated series from a successful HTTP interstitial", async () => {
    const html = '<title>Just a moment...</title><p>This page requires JavaScript.</p><script>{"y":[1,2]}</script>';
    await expect(readRealmEyeCount(new Response(html))).rejects.toThrow("access interstitial (HTTP 200)");
  });

  it("recognizes a challenge explicitly identified by the response", async () => {
    const response = new Response(null, { status: 403, headers: { "cf-mitigated": "challenge" } });
    await expect(readRealmEyeCount(response)).rejects.toThrow("access challenge (HTTP 403)");
  });

  it("keeps ordinary HTTP errors and parsing failures distinct", async () => {
    await expect(readRealmEyeCount(new Response(null, { status: 503 }))).rejects.toThrow("request failed with 503");
    await expect(readRealmEyeCount(new Response("<title>Players by rank</title>"))).rejects.toThrow(
      "Unable to parse RealmEye histogram data"
    );
  });
});
