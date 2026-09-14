import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * index.css is one global stylesheet, so a repeated @keyframes name is a
 * silent hijack: the last definition wins and re-animates every earlier
 * user of that name. It cost us a live game — a points popup named
 * `dr-guac-pop` took over the Guacamole ingredient card's pop-in and ended
 * it at opacity 0, so ingredients flashed for 0.22s and vanished.
 */
describe("index.css", () => {
  it("never defines the same @keyframes name twice", () => {
    const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
    const names = [...css.matchAll(/@keyframes\s+([A-Za-z0-9_-]+)/g)].map((m) => m[1]);
    const dupes = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
    expect(dupes, `duplicate @keyframes: ${dupes.join(", ")}`).toEqual([]);
  });

  it("every animation: <name> has a matching @keyframes", () => {
    const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
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
});
