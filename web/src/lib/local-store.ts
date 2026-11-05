import { useSyncExternalStore } from "react";
import type { z } from "zod";

// A value kept in the browser's localStorage under one key, readable from React.
//
// - Every read is checked with a zod schema, so a broken or outdated value can't
//   crash the app: it falls back to `fallback` instead.
// - React components read it with `use()`, which re-renders them when the value
//   changes — in this tab, or in another tab of the same site (the "storage" event).
// - On the server there is no localStorage; `use()` returns `fallback` there.
//
// Browser only (localStorage, window). Used by settings.ts and letters.ts.
export type LocalStore<T> = {
  get: () => T;
  set: (value: T) => void;
  update: (change: (current: T) => T) => void;
  subscribe: (onChange: () => void) => () => void;
  use: () => T;
};

export function createLocalStore<T>(key: string, schema: z.ZodType<T>, fallback: T): LocalStore<T> {
  // The last raw string we parsed and its result. useSyncExternalStore needs the
  // same object back while nothing changed, or it re-renders forever.
  let cache: { raw: string | null; value: T } | null = null;
  // If writing fails (private mode, storage full), keep the value for this visit.
  let memory: string | null = null;
  const listeners = new Set<() => void>();

  const readRaw = (): string | null => {
    try {
      return localStorage.getItem(key) ?? memory;
    } catch {
      return memory;
    }
  };

  const get = (): T => {
    const raw = readRaw();
    if (cache && cache.raw === raw) return cache.value;
    let value = fallback;
    if (raw) {
      try {
        const parsed = schema.safeParse(JSON.parse(raw));
        if (parsed.success) value = parsed.data;
      } catch {
        // not JSON: use the fallback
      }
    }
    cache = { raw, value };
    return value;
  };

  const set = (value: T) => {
    const raw = JSON.stringify(value);
    memory = raw;
    try {
      localStorage.setItem(key, raw);
    } catch {
      // kept in memory only
    }
    cache = { raw, value };
    listeners.forEach((l) => l());
  };

  const subscribe = (onChange: () => void) => {
    listeners.add(onChange);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key || e.key === null) onChange();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(onChange);
      window.removeEventListener("storage", onStorage);
    };
  };

  return {
    get,
    set,
    update: (change) => set(change(get())),
    subscribe,
    use: () => useSyncExternalStore(subscribe, get, () => fallback),
  };
}
