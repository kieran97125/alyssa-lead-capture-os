// Server/Proxy transport only. No credentials, request URLs or response bodies
// belong in timeout errors. Keep this module free of Node-only APIs.
export const SUPABASE_REQUEST_TIMEOUT_MS = 12_000;

export class SupabaseRequestTimeoutError extends Error {
  // PostgREST must not retry an already aborted read as a network failure.
  readonly name = "AbortError";
  readonly code = "SUPABASE_REQUEST_TIMEOUT";

  constructor() {
    super("Supabase request deadline exceeded.");
  }
}

export function isSupabaseUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { name?: string; code?: string; status?: number };
  return error instanceof SupabaseRequestTimeoutError ||
    value.name === "AbortError" || value.name === "TimeoutError" ||
    value.name === "AuthRetryableFetchError" || value.name === "AuthUnknownError" ||
    value.name === "TypeError" || value.code === "SUPABASE_REQUEST_TIMEOUT" ||
    (typeof value.status === "number" && value.status >= 500);
}

class RequestDeadline {
  private readonly controller = new AbortController();
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly timeoutMs: number) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new RangeError("Request deadline must be positive and finite.");
    }
  }

  get signal() { return this.controller.signal; }

  start() {
    this.signal.throwIfAborted();
    this.timer ??= setTimeout(() => this.abort(new SupabaseRequestTimeoutError()), this.timeoutMs);
  }

  finish() {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  abort(reason: unknown) {
    this.controller.abort(reason);
    this.finish();
  }

  async wait<T>(operation: Promise<T>): Promise<T> {
    // The race also bounds a custom transport that ignores AbortSignal; the
    // controller still cancels native fetch and its response stream.
    let onAbort: (() => void) | undefined;
    const aborted = new Promise<never>((_, reject) => {
      onAbort = () => reject(this.signal.reason);
      if (this.signal.aborted) onAbort();
      else this.signal.addEventListener("abort", onAbort, { once: true });
    });
    try {
      return await Promise.race([operation, aborted]);
    } finally {
      if (onAbort) this.signal.removeEventListener("abort", onAbort);
    }
  }
}

async function fetchWithDeadline(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
  deadline: RequestDeadline,
  fetchImpl: typeof fetch,
  finishOnBodyEnd: boolean,
): Promise<Response> {
  deadline.start();
  const originalSignal = init?.signal !== undefined
    ? init.signal
    : input instanceof Request ? input.signal : undefined;
  const onCallerAbort = () => deadline.abort(originalSignal?.reason);
  const cleanup = () => {
    originalSignal?.removeEventListener("abort", onCallerAbort);
    if (finishOnBodyEnd) deadline.finish();
  };
  if (originalSignal?.aborted) onCallerAbort();
  else originalSignal?.addEventListener("abort", onCallerAbort, { once: true });

  try {
    deadline.signal.throwIfAborted();
    const pendingResponse = fetchImpl(input, { ...init, signal: deadline.signal });
    // A transport resolving after cancellation must not leave a body open.
    void pendingResponse.then((lateResponse) => {
      if (deadline.signal.aborted) void lateResponse.body?.cancel().catch(() => {});
    }, () => {});
    const response = await deadline.wait(pendingResponse);
    if (!response.body || response.status === 0) {
      cleanup();
      return response;
    }

    const reader = response.body.getReader();
    let ended = false;
    let onAbort: () => void;
    const finish = () => {
      deadline.signal.removeEventListener("abort", onAbort);
      cleanup();
    };
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        onAbort = () => {
          if (ended) return;
          ended = true;
          controller.error(deadline.signal.reason);
          void reader.cancel(deadline.signal.reason).catch(() => {});
          finish();
        };
        if (deadline.signal.aborted) onAbort();
        else deadline.signal.addEventListener("abort", onAbort, { once: true });
      },
      async pull(controller) {
        try {
          const chunk = await deadline.wait(reader.read());
          if (ended) return;
          if (chunk.done) {
            ended = true;
            controller.close();
            finish();
          } else controller.enqueue(chunk.value);
        } catch (error) {
          if (ended) return;
          ended = true;
          controller.error(error);
          finish();
        }
      },
      cancel(reason) {
        ended = true;
        deadline.abort(reason);
        finish();
        return reader.cancel(reason);
      },
    });
    const bounded = new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
    // Constructing a Response does not otherwise preserve transport metadata.
    Object.defineProperties(bounded, {
      url: { value: response.url },
      redirected: { value: response.redirected },
      type: { value: response.type },
    });
    return bounded;
  } catch (error) {
    cleanup();
    throw error;
  }
}

export function createSupabaseReadFetch({
  timeoutMs = SUPABASE_REQUEST_TIMEOUT_MS,
  fetchImpl = (...args) => fetch(...args),
}: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}): typeof fetch {
  return (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    // Mutation/RPC semantics are unchanged: no new write timeout or retry.
    if (method !== "GET" && method !== "HEAD") return fetchImpl(input, init);
    return fetchWithDeadline(input, init, new RequestDeadline(timeoutMs), fetchImpl, true);
  };
}

export function createAuthRequestDeadline({
  timeoutMs = SUPABASE_REQUEST_TIMEOUT_MS,
  fetchImpl = (...args) => fetch(...args),
}: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}) {
  const deadline = new RequestDeadline(timeoutMs);
  return {
    get signal() { return deadline.signal; },
    // Auth reads may need a token-refresh POST. All methods share one budget;
    // SDK retries after expiration fail before starting another request.
    fetch: ((input, init) => fetchWithDeadline(input, init, deadline, fetchImpl, false)) as typeof fetch,
    async run<T>(operation: () => Promise<T>): Promise<T> {
      deadline.start();
      try {
        return await deadline.wait(Promise.resolve().then(operation));
      } finally {
        deadline.finish();
      }
    },
  };
}
