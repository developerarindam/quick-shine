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

/** Loads `url` (pass null to skip). Keeps previous data visible while reloading. */
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(!!url);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    const id = ++reqId.current;
    setLoading(true);
    setError("");
    try {
      const result = await api<T>(url);
      if (id === reqId.current) setData(result);
    } catch (e) {
      if (id === reqId.current) setError((e as Error).message);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, setData, error, loading, reload: load };
}
