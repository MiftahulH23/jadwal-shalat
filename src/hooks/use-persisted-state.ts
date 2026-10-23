"use client"

import { useCallback, useMemo, useSyncExternalStore } from "react"

const listeners = new Set<() => void>()
// Fallback when localStorage is blocked, so the state still updates in-session.
const memory = new Map<string, string>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

function read(key: string) {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? null
  } catch {
    return memory.get(key) ?? null
  }
}

const noopSubscribe = () => () => {}

/** True once rendering on the client (false during SSR and hydration). */
export function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )
}

/**
 * useState backed by localStorage. Returns `ready` = false during SSR/hydration,
 * when only the initial value is known.
 */
export function usePersistedState<T>(key: string, initial: T) {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null
  )
  const ready = useHydrated()

  const value = useMemo(() => {
    if (raw === null) return initial
    try {
      return JSON.parse(raw) as T
    } catch {
      return initial
    }
    // `initial` is a default only; changes to it should not re-parse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw])

  const update = useCallback(
    (next: T) => {
      try {
        memory.set(key, JSON.stringify(next))
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // Ignore quota / private-mode errors.
      }
      listeners.forEach((l) => l())
    },
    [key]
  )

  return [value, update, ready] as const
}
