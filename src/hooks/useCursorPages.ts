/**
 * Real pages over a cursor-paginated endpoint. Cursor pagination stays fast
 * at scale (no OFFSET), and pages come from keeping the cursors we have
 * already seen: Next pushes the current cursor, Prev pops. "Showing a to b of
 * N" uses `total` when the endpoint returns one. Changing the query (search,
 * filter, per page) resets to the first page.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

export type CursorPage<T> = { items: T[]; next_cursor: string | null; total?: number | null };

export function useCursorPages<T>(opts: {
  queryKey: unknown[];
  fetchPage: (cursor: string | undefined, limit: number) => Promise<CursorPage<T>>;
  perPage?: number;
  refetchInterval?: number;
}) {
  const [perPage, setPerPage] = useState(opts.perPage ?? 25);
  // cursors[i] is the cursor that yields page i+2; page 1 has no cursor.
  const [stack, setStack] = useState<string[]>([]);
  const cursor = stack[stack.length - 1];
  const keyString = JSON.stringify(opts.queryKey);

  // A new query (search, filter) means page 1 again.
  useEffect(() => {
    setStack([]);
  }, [keyString, perPage]);

  const q = useQuery({
    queryKey: [...opts.queryKey, { cursor, perPage }],
    queryFn: () => opts.fetchPage(cursor, perPage),
    placeholderData: (prev) => prev,
    refetchInterval: opts.refetchInterval,
  });

  const page = stack.length + 1;
  const items = useMemo(() => q.data?.items ?? [], [q.data?.items]);
  const total = q.data?.total ?? null;
  const from = items.length ? (page - 1) * perPage + 1 : 0;
  const to = (page - 1) * perPage + items.length;
  const hasNext = Boolean(q.data?.next_cursor);
  const hasPrev = stack.length > 0;

  const next = useCallback(() => {
    const c = q.data?.next_cursor;
    if (c) setStack((s) => [...s, c]);
  }, [q.data?.next_cursor]);
  const prev = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const reset = useCallback(() => setStack([]), []);

  return useMemo(
    () => ({ items, page, perPage, setPerPage, from, to, total, hasNext, hasPrev, next, prev, reset, isLoading: q.isLoading, isFetching: q.isFetching, refetch: q.refetch }),
    [items, page, perPage, from, to, total, hasNext, hasPrev, next, prev, reset, q.isLoading, q.isFetching, q.refetch],
  );
}
