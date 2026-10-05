"use client";

import { useSyncExternalStore } from "react";

// Lists keep their filters in the URL. They also remember that URL here, so detail
// pages can link "back" to the exact filtered list instead of the default view.

export const LIST_KEYS = {
  jobs: "qs:list:jobs",
} as const;

export function rememberListUrl(key: string, url: string) {
  try {
    sessionStorage.setItem(key, url);
  } catch {
    // storage unavailable (private mode) — back links fall back to the default list
  }
}

const noopSubscribe = () => () => {};

/** The last URL of a list (with its filters), or `fallback` if none / on the server. */
export function useListBackHref(key: string, fallback: string) {
  return useSyncExternalStore(
    noopSubscribe,
    () => {
      try {
        return sessionStorage.getItem(key) || fallback;
      } catch {
        return fallback;
      }
    },
    () => fallback
  );
}
