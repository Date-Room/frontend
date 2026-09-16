import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
  alpha: number;
};

/**
 * Romantic particle field — inspired by organic swarm simulators like
 * [Casberry particles](https://particles.casberry.in/): warm embers, soft
 * constellation links, gentle cursor gravity. Canvas 2D keeps it lightweight.
 */
export function LandingParticleCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: -9999, y: -9999, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let particles: Particle[] = [];
    let raf = 0;

    const count = reduced ? 36 : 110;

    function spawn(): Particle[] {
      return Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35 - 0.12,
        r: Math.random() * 2.2 + 0.6,
        hue: 22 + Math.random() * 38,
        alpha: 0.25 + Math.random() * 0.55,
      }));
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = spawn();
    }

    function tick() {
      ctx.clearRect(0, 0, w, h);
      const { x: px, y: py, active } = pointerRef.current;

      for (const p of particles) {
        if (!reduced) {
          p.x += p.vx;
          p.y += p.vy;
          p.vx += Math.sin((p.y + p.x) * 0.008) * 0.008;
          p.vy += Math.cos((p.x - p.y) * 0.007) * 0.006;

          if (active) {
            const dx = px - p.x;
            const dy = py - p.y;
            const dist = Math.hypot(dx, dy) || 1;
            if (dist < 180) {
              const force = (180 - dist) / 18000;
              p.vx += (dx / dist) * force;
              p.vy += (dy / dist) * force;
            }
          }

          if (p.x < -20) p.x = w + 20;
          if (p.x > w + 20) p.x = -20;
          if (p.y < -20) p.y = h + 20;
          if (p.y > h + 20) p.y = -20;

          p.vx *= 0.992;
          p.vy *= 0.992;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 78%, 68%, ${p.alpha})`;
        ctx.fill();
      }

      const linkDist = reduced ? 0 : 95;
      if (linkDist > 0) {
        for (let i = 0; i < particles.length; i += 1) {
          for (let j = i + 1; j < particles.length; j += 1) {
            const a = particles[i];
            const b = particles[j];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d < linkDist) {
              const alpha = (1 - d / linkDist) * 0.14;
              ctx.strokeStyle = `hsla(32, 70%, 62%, ${alpha})`;
              ctx.lineWidth = 0.6;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }
        }
      }

      raf = window.requestAnimationFrame(tick);
    }

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };
    const onLeave = () => {
      pointerRef.current.active = false;
    };

    resize();
    tick();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("pointer-events-auto absolute inset-0 h-full w-full", className)}
    />
  );
}
