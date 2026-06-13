import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type LiveRoomTab = {
  id: string;
  label: string;
  icon: string;
};

type Props = {
  tabs: LiveRoomTab[];
  activeId: string;
  onChange: (id: string) => void;
  /** Insert a divider before this tab id (e.g. first activity after walls). */
  dividerBeforeId?: string | null;
};

export function LiveRoomTabBar({ tabs, activeId, onChange, dividerBeforeId }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollHints = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollHints();
    el.addEventListener("scroll", updateScrollHints, { passive: true });
    const ro = new ResizeObserver(updateScrollHints);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollHints);
      ro.disconnect();
    };
  }, [tabs, updateScrollHints]);

  useEffect(() => {
    const el = scrollRef.current?.querySelector(`[data-tab-id="${activeId}"]`);
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeId]);

  function scrollBy(delta: number) {
    scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  }

  return (
    <div className="live-room-tab-bar">
      {canScrollLeft && (
        <button
          type="button"
          aria-label="Scroll tabs left"
          onClick={() => scrollBy(-160)}
          className="live-room-tab-chevron live-room-tab-chevron-left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      <div
        className={cn("live-room-tab-fade live-room-tab-fade-left", canScrollLeft && "is-visible")}
        aria-hidden
      />

      <div ref={scrollRef} className="live-room-tab-scroll">
        <div className="live-room-tab-track">
          {tabs.map((t) => (
            <span key={t.id} className="live-room-tab-item">
              {dividerBeforeId === t.id && (
                <span className="live-room-tab-divider" aria-hidden />
              )}
              <button
                type="button"
                data-tab-id={t.id}
                data-active={activeId === t.id}
                onClick={() => onChange(t.id)}
                className="live-room-tab"
                title={t.label}
              >
                <span className="live-room-tab-icon" aria-hidden>
                  {t.icon}
                </span>
                <span className="live-room-tab-label">{t.label}</span>
              </button>
            </span>
          ))}
        </div>
      </div>

      <div
        className={cn("live-room-tab-fade live-room-tab-fade-right", canScrollRight && "is-visible")}
        aria-hidden
      />

      {canScrollRight && (
        <button
          type="button"
          aria-label="Scroll tabs right"
          onClick={() => scrollBy(160)}
          className="live-room-tab-chevron live-room-tab-chevron-right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {canScrollRight && (
        <span className="live-room-tab-more-hint" aria-hidden>
          More
        </span>
      )}
    </div>
  );
}
