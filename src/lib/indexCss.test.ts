import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Read from disk, not via Vite's `?raw`: this config processes CSS imports,
// so `?raw` hands back an empty string and every assertion below passes
// vacuously. The non-empty check at the top is the tripwire for that.
const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

/**
 * index.css is one global stylesheet, so a repeated @keyframes name is a
 * silent hijack: the last definition wins and re-animates every earlier
 * user of that name. It cost us a live game — a points popup named
 * `dr-guac-pop` took over the Guacamole ingredient card's pop-in and ended
 * it at opacity 0, so ingredients flashed for 0.22s and vanished.
 */
describe("index.css", () => {
  it("actually read the stylesheet", () => {
    expect(css.length).toBeGreaterThan(1000);
  });

  it("never defines the same @keyframes name twice", () => {
    const names = [...css.matchAll(/@keyframes\s+([A-Za-z0-9_-]+)/g)].map((m) => m[1]);
    const dupes = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
    expect(dupes, `duplicate @keyframes: ${dupes.join(", ")}`).toEqual([]);
  });

  it("every animation: <name> has a matching @keyframes", () => {
    const defined = new Set(
      [...css.matchAll(/@keyframes\s+([A-Za-z0-9_-]+)/g)].map((m) => m[1]),
    );
    // `animation: <name> <duration> …` — our shorthand always leads with the
    // name, so the first token is what we check.
    const used = [...css.matchAll(/animation:\s*([A-Za-z][A-Za-z0-9_-]*)\s+[\d.]+m?s/g)]
      .map((m) => m[1])
      .filter((n) => n !== "none");
    const missing = [...new Set(used.filter((n) => !defined.has(n)))];
    expect(missing, `animations with no keyframes: ${missing.join(", ")}`).toEqual([]);
  });
  /**
   * `text-cream` is the app's primary ink and is declared as a literal
   * near-white, not a token — so without a light-mode override it is
   * invisible on paper. Same shape of problem for the amber and rose
   * literals, which land near 2:1 on the light ground.
   */
  it("overrides every hardcoded ink literal for light mode", () => {
    const literals = [...css.matchAll(/^\.(text-[a-z]+) \{ color: #/gm)].map((m) => m[1]);
    expect(literals.length).toBeGreaterThan(0);
    for (const cls of literals) {
      expect(
        css.includes(`:root[data-theme="light"] .${cls} {`),
        `${cls} is a baked hex with no light-mode override`,
      ).toBe(true);
    }
  });
  /**
   * Light mode runs one weight notch heavier (see the stylesheet's note).
   * Overriding utilities is only safe while nothing carries two different
   * weights in one class string, so the bump stays pinned to weights the
   * @import actually loads.
   */
  it("bumps light-mode weights onto loaded DM Sans weights", () => {
    const loaded = new Set(
      [...css.matchAll(/DM\+Sans:[^')]*/g)]
        .flatMap((m) => [...m[0].matchAll(/9\.\.40,(\d{3})/g)])
        .map((m) => m[1]),
    );
    expect(loaded.size).toBeGreaterThan(2);
    const bumps = [
      ...css.matchAll(/:root\[data-theme="light"\] (?:body|\.font-[a-z]+) \{ font-weight: (\d{3}); \}/g),
    ].map((m) => m[1]);
    expect(bumps.length).toBeGreaterThan(3);
    for (const w of bumps) {
      expect(loaded.has(w), `weight ${w} is bumped to but never loaded`).toBe(true);
    }
  });
});
