/** A bounded, fail-closed read of one operational scope. No customer values in errors. */
export const COMPLETE_READ_PAGE_SIZE = 500;
export const COMPLETE_READ_MAX_ROWS = 25_000;
export const COMPLETE_READ_TIMEOUT_MS = 20_000;

export class CompleteReadError extends Error {
  readonly code = "INCOMPLETE_OPERATIONAL_READ";

  constructor(readonly reason: "deadline" | "capacity" | "changed" | "incomplete" | "query") {
    super("資料未能完整讀取，請重新整理再試；如持續出現，請縮窄日期或品牌範圍。");
    this.name = "CompleteReadError";
  }
}

export type CompleteReadScope = {
  signal: AbortSignal;
  /** Excludes rows inserted after this read began, keeping keyset pages stable. */
  startedAt: string;
};

export async function withCompleteReadScope<T>(
  operation: (scope: CompleteReadScope) => Promise<T>,
  timeoutMs = COMPLETE_READ_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new CompleteReadError("deadline");
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => operation({
        signal: controller.signal,
        startedAt: new Date().toISOString(),
      })),
      deadline,
    ]);
  } catch (error) {
    controller.abort(error);
    throw error instanceof CompleteReadError ? error : new CompleteReadError("query");
  } finally {
    clearTimeout(timer);
  }
}

export type CompleteReadCursor = { id: string; created_at: string };
export type CompleteReadPage<T> = {
  data: T[] | null;
  error: unknown;
  count: number | null;
};

/** Date.parse alone discards PostgreSQL microseconds and can invent an ID tie. */
export function compareReadTimestamps(left: string, right: string) {
  const micros = (value: string) => {
    const match = value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/);
    const milliseconds = match ? Date.parse(`${match[1]}${match[3]}`) : NaN;
    if (!match || !Number.isFinite(milliseconds)) throw new CompleteReadError("incomplete");
    return BigInt(milliseconds) * BigInt(1000) + BigInt((match[2] ?? "").padEnd(6, "0"));
  };
  const a = micros(left), b = micros(right);
  return a === b ? 0 : a < b ? -1 : 1;
}

/**
 * Every page is ordered created_at DESC, id DESC. An exact remaining count
 * detects provider caps, deleted/moved records and incomplete hydration rather
 * than silently presenting subset totals. This is not a database snapshot;
 * callers retry if the scope changes while it is being read.
 */
export async function readCompletePages<T extends CompleteReadCursor>(
  scope: CompleteReadScope,
  readPage: (cursor: CompleteReadCursor | null, size: number) => PromiseLike<CompleteReadPage<T>>,
  options: { maxRows?: number } = {},
): Promise<T[]> {
  const maxRows = options.maxRows ?? COMPLETE_READ_MAX_ROWS;
  if (!Number.isSafeInteger(maxRows) || maxRows < 0) throw new CompleteReadError("capacity");
  const rows: T[] = [];
  const seen = new Set<string>();
  let expectedTotal: number | null = null;
  let cursor: CompleteReadCursor | null = null;

  for (;;) {
    scope.signal.throwIfAborted();
    const size = Math.min(COMPLETE_READ_PAGE_SIZE, Math.max(1, maxRows - rows.length));
    const result = await readPage(cursor, size);
    scope.signal.throwIfAborted();
    if (result.error) throw new CompleteReadError("query");
    if (!Number.isSafeInteger(result.count) || (result.count as number) < 0) {
      throw new CompleteReadError("incomplete");
    }
    const remaining = result.count as number;
    if (expectedTotal === null) {
      expectedTotal = remaining;
      if (remaining > maxRows) throw new CompleteReadError("capacity");
    } else if (remaining !== expectedTotal - rows.length) {
      throw new CompleteReadError("changed");
    }
    const page = result.data ?? [];
    const wanted = Math.min(size, remaining);
    if (page.length !== wanted) throw new CompleteReadError("incomplete");
    for (const row of page) {
      if (!row.id || !row.created_at || seen.has(row.id)) {
        throw new CompleteReadError("incomplete");
      }
      const timeOrder = compareReadTimestamps(row.created_at, cursor?.created_at ?? row.created_at);
      if (cursor && (timeOrder > 0 || (timeOrder === 0 && row.id >= cursor.id))) {
        throw new CompleteReadError("incomplete");
      }
      seen.add(row.id);
      rows.push(row);
      cursor = row;
    }
    if (rows.length === expectedTotal) return rows;
    if (rows.length >= maxRows) throw new CompleteReadError("capacity");
  }
}

export function completeReadCursorFilter(cursor: CompleteReadCursor) {
  // Both values originate in trusted database rows. Only ISO timestamps and
  // UUIDs/opaque safe IDs may become PostgREST filter syntax.
  if (!/^[0-9T:.+\-Z]+$/.test(cursor.created_at) || !/^[A-Za-z0-9_-]+$/.test(cursor.id)) {
    throw new CompleteReadError("incomplete");
  }
  return `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`;
}

export function readIdChunks(values: string[], size = 100) {
  const unique = Array.from(new Set(values.filter(Boolean)));
  return Array.from({ length: Math.ceil(unique.length / size) }, (_, index) =>
    unique.slice(index * size, (index + 1) * size));
}
