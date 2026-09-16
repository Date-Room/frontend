import { describe, it, expect, vi, afterEach } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { pagerLabel } from "@/components/admin/Pager";
import { useCursorPages } from "@/hooks/useCursorPages";

afterEach(cleanup);

describe("pagerLabel", () => {
  it("reads naturally with and without a total", () => {
    expect(pagerLabel(1, 25, 138, "users")).toBe("Showing 1 to 25 of 138");
    expect(pagerLabel(26, 40, null)).toBe("Showing 26 to 40");
    expect(pagerLabel(0, 0, 0, "users")).toBe("No users");
  });
});

describe("useCursorPages", () => {
  it("walks forward and back on cursors and resets when the query changes", async () => {
    const calls: Array<[string | undefined, number]> = [];
    const fetchPage = vi.fn(async (cursor: string | undefined, limit: number) => {
      calls.push([cursor, limit]);
      const start = cursor === "c2" ? 26 : cursor === "c3" ? 51 : 1;
      const items = Array.from({ length: Math.min(limit, 138 - start + 1) }, (_, i) => start + i);
      const next = start === 1 ? "c2" : start === 26 ? "c3" : null;
      return { items, next_cursor: next, total: 138 };
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useCursorPages<number>({ queryKey: ["t"], fetchPage }), { wrapper });
    await waitFor(() => expect(result.current.items.length).toBe(25));
    expect([result.current.from, result.current.to, result.current.total]).toEqual([1, 25, 138]);
    expect(result.current.hasPrev).toBe(false);

    act(() => result.current.next());
    await waitFor(() => expect(result.current.from).toBe(26));
    expect(calls[calls.length - 1]).toEqual(["c2", 25]);
    expect(result.current.hasPrev).toBe(true);

    act(() => result.current.prev());
    await waitFor(() => expect(result.current.from).toBe(1));

    act(() => result.current.setPerPage(50));
    await waitFor(() => expect(result.current.to).toBe(50));
    expect(result.current.page).toBe(1); // reset to the first page
  });
});
