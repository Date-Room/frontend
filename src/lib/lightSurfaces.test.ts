import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Recessed fills (`bg-secondary/60`, `bg-muted/40`) carry alphas chosen
 * against a near-black page, where blending keeps a surface dark. Over 96%
 * paper the same alpha blends the surface INTO the page — which is how the
 * search inputs ended up with no contrast at all. index.css drops the alpha
 * for these in light mode, and this keeps the two in sync: add a new alpha
 * variant at a call site and you have to add its override too.
 *
 * Scrims (`bg-background/NN`) and card panels are deliberately excluded — a
 * modal dimmer has to dim, and a panel separates with its border.
 */

const root = resolve(process.cwd(), "src");
const css = readFileSync(join(root, "index.css"), "utf8");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(tsx|ts)$/.test(p) && !/\.test\.tsx?$/.test(p) ? [p] : [];
  });
}

/**
 * The light palette spans two `:root[data-theme="light"]` blocks (the main
 * tokens, then the fill trio). `.theme-admin` follows them and defines some
 * of the SAME token names for its own always-dark scope, so the window has
 * to stop there or a drifting token could be read from the wrong theme.
 */
function lightTokens(): string {
  const start = css.indexOf(':root[data-theme="light"] {');
  expect(start).toBeGreaterThan(-1);
  const end = css.indexOf(".theme-admin", start);
  return css.slice(start, end === -1 ? undefined : end);
}

describe("light-mode recessed fills", () => {
  it("every bg-secondary/NN and bg-muted/NN in use is solid on paper", () => {
    const used = new Set<string>();
    for (const file of sources(root)) {
      // Skip the admin portal: it has its own always-dark theme scope.
      if (file.includes("/admin")) continue;
      for (const m of readFileSync(file, "utf8").matchAll(/bg-(secondary|muted)\/(\d+)/g)) {
        used.add(`${m[1]}/${m[2]}`);
      }
    }
    expect(used.size).toBeGreaterThan(3);
    const missing = [...used].filter((cls) => {
      const [fam, alpha] = cls.split("/");
      return !css.includes(`:root[data-theme="light"] .bg-${fam}\\/${alpha} {`);
    });
    expect(missing, `no light-mode override for: ${missing.join(", ")}`).toEqual([]);
  });

  it("keeps the recessed tokens below the page, not level with it", () => {
    const lightBlock = lightTokens();
    const lightness = (token: string) =>
      Number(new RegExp(`--${token}: *[\\d.]+ +[\\d.]+% +([\\d.]+)%`).exec(lightBlock)?.[1]);
    const page = lightness("background");
    expect(page).toBeGreaterThan(90);
    // A recessed surface the eye can actually separate from the page. The
    // search field has `border-transparent`, so the fill is the only thing
    // doing it — 4 points read as the page itself.
    expect(page - lightness("secondary")).toBeGreaterThanOrEqual(7);
    expect(page - lightness("muted")).toBeGreaterThanOrEqual(9);
    // And an edge that reads as a line.
    expect(page - lightness("border")).toBeGreaterThanOrEqual(12);
  });
  /**
   * Two pairs in the light palette sit close to the WCAG floor and are easy
   * to break while tuning: the placeholder inside a recessed field, and the
   * white label on the accent fill. Both were measured at ~4.8:1 when the
   * palette was set, so a nudge in the wrong direction is a regression, not
   * a judgement call.
   */
  it("keeps the near-the-floor light pairs above 4.5:1", () => {
    const lightBlock = lightTokens();
    const hsl = (token: string) => {
      const m = new RegExp(`--${token}: *([\\d.]+) +([\\d.]+)% +([\\d.]+)%`).exec(lightBlock);
      if (!m) throw new Error(`missing light token --${token}`);
      const [h, s, l] = [Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100];
      const a = s * Math.min(l, 1 - l);
      const k = (n: number) => (n + h / 30) % 12;
      const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return [f(0), f(8), f(4)];
    };
    const luminance = (c: number[]) => {
      const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: number[], b: number[]) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    expect(ratio(hsl("muted-foreground"), hsl("secondary"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(hsl("on-fill"), hsl("primary-fill"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(hsl("foreground"), hsl("background"))).toBeGreaterThanOrEqual(7);
  });
});
