import { Component, type ReactNode } from "react";

/**
 * Isolates a single activity so a crash inside it (Watch, DJ, a video tile…)
 * shows a small inline message instead of unmounting the whole room — which
 * would tear down the LiveKit call and drop BOTH people out. Resets when
 * `resetKey` changes (e.g. switching activities) so a recovered activity works
 * again without a reload.
 */
export class ActivityBoundary extends Component<
  { children: ReactNode; label?: string; resetKey?: string | number },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("[ActivityBoundary]", this.props.label, error);
  }

  componentDidUpdate(prev: { resetKey?: string | number }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="font-serif text-xl italic text-cream">Something hiccuped</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            {this.props.label ? `${this.props.label} ran into a problem.` : "This activity ran into a problem."}{" "}
            The call is still connected.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="mt-1 rounded-full px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            style={{ backgroundColor: "var(--room-accent)" }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Surfaces a room-render crash on screen (instead of blanking) so we can see
 *  the actual error + stack. */
export class RoomErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("[RoomErrorBoundary]", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 z-[999] overflow-auto bg-background p-6 text-cream">
          <p className="font-serif text-lg text-rose">Room crashed</p>
          <p className="mt-2 text-sm font-semibold">{this.state.error.message}</p>
          <pre className="mt-4 max-w-full whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground">
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
