import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(relativePath, stubs = {}) {
  const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } });
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", compiled.outputText)(
    (name) => Object.hasOwn(stubs, name) ? stubs[name] : require(name), loadedModule, loadedModule.exports,
  );
  return loadedModule.exports;
}
const deadlines = load("src/lib/supabase/requestDeadline.ts");
const { createSupabaseReadFetch, createAuthRequestDeadline, isSupabaseUnavailableError } = deadlines;
const timeoutMs = 50;
const never = () => new Promise(() => {});
const timedOut = (error) => error.name === "AbortError" && error.code === "SUPABASE_REQUEST_TIMEOUT";

test("successful GET preserves request options, JSON, HTTP and response metadata", async () => {
  const abort = new AbortController();
  const source = new Response('{"ok":true}', { status: 206, statusText: "Partial Content", headers: { "x-check": "yes" } });
  Object.defineProperties(source, { url: { value: "https://synthetic.invalid/final" }, redirected: { value: true } });
  let actual;
  const bounded = createSupabaseReadFetch({ timeoutMs, fetchImpl: async (input, init) => {
    actual = { input, init }; return source;
  } });
  const init = { method: "GET", headers: { apikey: "synthetic" }, cache: "no-store", signal: abort.signal };
  const response = await bounded("https://synthetic.invalid/read", init);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.status, 206);
  assert.equal(response.statusText, "Partial Content");
  assert.equal(response.headers.get("x-check"), "yes");
  assert.equal(response.url, source.url);
  assert.equal(response.redirected, true);
  assert.equal(response.type, source.type);
  assert.deepEqual(actual.init.headers, init.headers);
  assert.equal(actual.init.cache, "no-store");
  await delay(timeoutMs + 10);
  assert.equal(actual.init.signal.aborted, false, "completed bodies clear their timer");
  assert.equal(abort.signal.aborted, false, "do not abort caller-owned signals");
});

test("stalled headers time out and abort transport, even if transport ignores cancellation", async () => {
  let signal;
  let calls = 0;
  const bounded = createSupabaseReadFetch({ timeoutMs, fetchImpl: (_input, init) => {
    calls++; signal = init.signal; return never();
  } });
  await assert.rejects(bounded("https://synthetic.invalid/read"), timedOut);
  assert.equal(signal.aborted, true);
  assert.equal(calls, 1);
});

test("late headers have their body cancelled after deadline", async () => {
  let resolve;
  let cancelled = false;
  const bounded = createSupabaseReadFetch({ timeoutMs, fetchImpl: () => new Promise((done) => { resolve = done; }) });
  await assert.rejects(bounded("https://synthetic.invalid/read"), timedOut);
  resolve(new Response(new ReadableStream({ cancel() { cancelled = true; } })));
  await delay(0);
  assert.equal(cancelled, true);
});

test("a stalled response body shares the header deadline and cancels its upstream reader", async () => {
  let cancelled;
  let signal;
  const bounded = createSupabaseReadFetch({ timeoutMs, fetchImpl: async (_input, init) => {
    signal = init.signal;
    return new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('{"unfinished":')); },
      cancel(reason) { cancelled = reason; },
    }));
  } });
  const response = await bounded("https://synthetic.invalid/read");
  await assert.rejects(response.json(), timedOut);
  assert.equal(signal.aborted, true);
  assert.ok(timedOut(cancelled));
});

test("caller cancellation is preserved before headers and during body reads", async () => {
  for (const duringBody of [false, true]) {
    const caller = new AbortController();
    const reason = new Error("Synthetic caller cancelled");
    let forwarded;
    let cancelled;
    const bounded = createSupabaseReadFetch({ timeoutMs: 1_000, fetchImpl: (_input, init) => {
      forwarded = init.signal;
      return duringBody ? Promise.resolve(new Response(new ReadableStream({ cancel(value) { cancelled = value; } }))) : never();
    } });
    const operation = bounded(new Request("https://synthetic.invalid/read", { signal: caller.signal }));
    const result = duringBody ? (await operation).text() : operation;
    caller.abort(reason);
    await assert.rejects(result, (error) => error === reason);
    assert.equal(forwarded.reason, reason);
    if (duringBody) assert.equal(cancelled, reason);
  }
});

test("explicit init signal overrides Request signal; pre-aborted calls never start", async () => {
  const ignored = AbortSignal.abort(new Error("overridden"));
  const active = new AbortController();
  let calls = 0;
  const bounded = createSupabaseReadFetch({ timeoutMs, fetchImpl: async () => { calls++; return new Response("ok"); } });
  assert.equal(await (await bounded(new Request("https://synthetic.invalid/read", { signal: ignored }), { signal: active.signal })).text(), "ok");
  await assert.rejects(bounded("https://synthetic.invalid/read", { signal: ignored }), (error) => error === ignored.reason);
  assert.equal(calls, 1);
});

test("consumer stream cancellation cancels the original body and fetch signal", async () => {
  let signal;
  let cancelled;
  const bounded = createSupabaseReadFetch({ timeoutMs, fetchImpl: async (_input, init) => {
    signal = init.signal;
    return new Response(new ReadableStream({ cancel(reason) { cancelled = reason; } }));
  } });
  const response = await bounded("https://synthetic.invalid/read");
  await response.body.cancel("consumer finished");
  assert.equal(cancelled, "consumer finished");
  assert.equal(signal.aborted, true);
});

test("HEAD completes at headers and admin writes remain exact pass-through", async () => {
  let headSignal;
  const head = createSupabaseReadFetch({ timeoutMs, fetchImpl: async (_input, init) => { headSignal = init.signal; return new Response(null, { status: 204 }); } });
  assert.equal((await head("https://synthetic.invalid/read", { method: "HEAD" })).status, 204);
  for (const method of ["POST", "PATCH", "PUT", "DELETE", "OPTIONS"]) {
    const input = new Request("https://synthetic.invalid/write", { method });
    const init = { headers: { "x-synthetic": "yes" }, signal: new AbortController().signal };
    const response = new Response("unchanged");
    const bounded = createSupabaseReadFetch({ timeoutMs, fetchImpl: async (actualInput, actualInit) => {
      assert.equal(actualInput, input); assert.equal(actualInit, init); return response;
    } });
    assert.equal(await bounded(input, init), response);
    assert.equal(init.signal.aborted, false);
  }
  await delay(timeoutMs + 10);
  assert.equal(headSignal.aborted, false);
});

test("installed PostgREST SDK does not retry deadline-aborted reads", async () => {
  let calls = 0;
  const client = createClient("https://synthetic.invalid", "synthetic-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: createSupabaseReadFetch({ timeoutMs, fetchImpl: () => { calls++; return never(); } }) },
  });
  const result = await client.from("synthetic_table").select("id");
  assert.match(result.error.message, /deadline exceeded/);
  assert.equal(calls, 1);
});

test("auth operation deadline covers token refresh POST and blocks subsequent SDK attempts", async () => {
  let calls = 0;
  let signal;
  const boundary = createAuthRequestDeadline({ timeoutMs, fetchImpl: async (_input, init) => {
    calls++; signal = init.signal;
    if (init.method === "POST") return never();
    return new Response('{"ok":true}');
  } });
  await assert.rejects(boundary.run(async () => {
    await (await boundary.fetch("https://synthetic.invalid/auth/v1/user")).json();
    return boundary.fetch("https://synthetic.invalid/auth/v1/token", { method: "POST", body: "synthetic" });
  }), timedOut);
  assert.equal(signal.aborted, true);
  await assert.rejects(boundary.fetch("https://synthetic.invalid/auth/v1/token", { method: "POST" }), timedOut);
  assert.equal(calls, 2, "an SDK retry after deadline cannot dispatch another request");
});

test("auth getClaims lifecycle is bounded even before a transport call starts", async () => {
  const boundary = createAuthRequestDeadline({ timeoutMs, fetchImpl: async () => { throw new Error("must not fetch"); } });
  await assert.rejects(boundary.run(never), timedOut);
  assert.equal(boundary.signal.aborted, true);
});

test("Proxy and server auth refuse late cookie writes after timeout", async () => {
  for (const kind of ["Proxy", "Server"]) {
    let options;
    let writes = 0;
    const cookieStore = { getAll: () => [], set: () => { writes++; } };
    const auth = { getClaims: never };
    const stubs = {
      "server-only": {},
      "@supabase/ssr": { createServerClient: (_url, _key, value) => { options = value; return { auth }; } },
      "@/lib/supabase/authConfig": { getSupabasePublicAuthConfig: () => ({ ready: true, url: "https://synthetic.invalid", key: "synthetic" }) },
      "@/lib/supabase/requestDeadline": { ...deadlines, createAuthRequestDeadline: () => createAuthRequestDeadline({ timeoutMs }) },
      "next/headers": { cookies: async () => cookieStore },
      "next/server": { NextResponse: { next: () => ({ cookies: cookieStore }) } },
    };
    const authModule = load(`src/lib/supabase/auth${kind}.ts`, stubs);
    if (kind === "Proxy") {
      const result = await authModule.refreshSupabaseAuth({ cookies: cookieStore });
      assert.equal(result.identity, null);
      assert.equal(result.unavailable, true);
    } else {
      const client = await authModule.createSupabaseServerAuthClient();
      await assert.rejects(client.authDeadline.run(() => client.auth.getClaims()), timedOut);
    }
    options.cookies.setAll([{ name: "synthetic-cookie", value: "late" }]);
    assert.equal(writes, 0);
  }
});

test("outage classification does not turn invalid/expired sessions into verified access", () => {
  assert.equal(isSupabaseUnavailableError({ name: "AuthRetryableFetchError", status: 0 }), true);
  assert.equal(isSupabaseUnavailableError({ status: 503 }), true);
  assert.equal(isSupabaseUnavailableError({ name: "AuthApiError", status: 401 }), false);
  assert.equal(isSupabaseUnavailableError(null), false);
});
