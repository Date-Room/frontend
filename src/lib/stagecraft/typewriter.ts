/**
 * Typewriter — text that types itself in, forcing a reading pace so the
 * pause after the last character lands as a beat. Reduced-motion users get
 * the full text immediately.
 */
import { useEffect, useState } from "react";
import { prefersReducedMotion } from "./cinematic";

export function useTypewriter(
  text: string,
  active: boolean,
  speedMs = 24,
): { shown: string; complete: boolean } {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active) {
      setCount(0);
      return;
    }
    if (prefersReducedMotion()) {
      setCount(text.length);
      return;
    }
    setCount(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= text.length) window.clearInterval(id);
    }, speedMs);
    return () => window.clearInterval(id);
  }, [text, active, speedMs]);

  return { shown: text.slice(0, count), complete: count >= text.length };
}
