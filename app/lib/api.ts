"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
};

/** fetch() wrapper: JSON in/out, throws with the server's message, bounces to /login on 401. */
export async function api<T = unknown>(url: string, opts: ApiOptions = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method || "GET",
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });

  let json: { success?: boolean; message?: string; data?: T } = {};
  try {
    json = await res.json();
  } catch {
    // non-JSON response
  }

  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
  }
  if (!res.ok || json.success === false) {
    throw new Error(json.message || "Something went wrong. Please try again.");
  }
  return json.data as T;
}

/**
 * Today's date as a string that changes when the calendar day changes — while the app
 * stays open past midnight or comes back from the background. Use it as a memo
 * dependency so "today" ranges roll over by themselves.
 */
export function useDayKey() {
  const [key, setKey] = useState(() => new Date().toDateString());
  useEffect(() => {
    const check = () => setKey(new Date().toDateString());
    const timer = setInterval(check, 30_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return key;
}

// Last response per URL for this browser tab. Pages show it instantly when you come
// back to them, then refresh in the background (stale-while-revalidate).
const responseCache = new Map<string, unknown>();

/** Put fresh data for a URL in the cache, e.g. the saved record after an edit. */
export function primeApiCache(url: string, data: unknown) {
  responseCache.set(url, data);
}

/** Forget cached responses — call on logout so the next user never sees them. */
export function clearApiCache() {
  responseCache.clear();
}

/**
 * Loads `url` (pass null to skip). Shows the cached copy straight away if this URL was
 * loaded before, keeps previous data visible while reloading, and always revalidates.
 */
export function useApi<T>(url: string | null) {
  const [data, setDataState] = useState<T | undefined>(() => (url ? (responseCache.get(url) as T | undefined) : undefined));
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(!!url);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    const id = ++reqId.current;
    if (responseCache.has(url)) setDataState(responseCache.get(url) as T);
    setLoading(true);
    setError("");
    try {
      const result = await api<T>(url);
      responseCache.set(url, result);
      if (id === reqId.current) setDataState(result);
    } catch (e) {
      if (id === reqId.current) setError((e as Error).message);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    load();
  }, [load]);

  // Local edits (optimistic updates) also update the cached copy
  const setData = useCallback(
    (next: T | undefined | ((prev: T | undefined) => T | undefined)) =>
      setDataState((prev) => {
        const value = typeof next === "function" ? (next as (p: T | undefined) => T | undefined)(prev) : next;
        if (url) responseCache.set(url, value);
        return value;
      }),
    [url]
  );

  return { data, setData, error, loading, reload: load };
}
