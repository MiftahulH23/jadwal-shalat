"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { usePersistedState } from "@/hooks/use-persisted-state"
import { loadOfflineSchedule, needsRefresh, OFFLINE_DAYS, readCache, saveSchedule } from "@/lib/offline"
import { addDays, dateAtOffset, toEpoch, type City, type WeekSchedule } from "@/lib/prayer"
import { applyCorrections, normalizeSettings, SETTINGS_KEY, type Settings } from "@/lib/settings"

export const DEFAULT_CITY: City = { id: "1301", lokasi: "KOTA JAKARTA" }
export const CITY_KEY = "jadwal-shalat:city"
export const SOUND_KEY = "jadwal-shalat:sound"

/** Identifies a selection: the city alone, or the city plus a GPS point. */
export const keyOf = (c: City) => (c.place ? `${c.id}@${c.place.lat},${c.place.lng}` : c.id)

/** Query string for schedule endpoints (adds the GPS point when present). */
export const placeQuery = (c: City) => (c.place ? `lat=${c.place.lat}&lng=${c.place.lng}` : "")

export function useSettings() {
  const [raw, setRaw] = usePersistedState<Partial<Settings> | null>(SETTINGS_KEY, null)
  const settings = useMemo(() => normalizeSettings(raw), [raw])
  const setSettings = useCallback((next: Settings) => setRaw(normalizeSettings(next)), [setRaw])
  return [settings, setSettings] as const
}


/** Set while showing data without a live connection to the schedule source. */
export type OfflineStatus = {
  /** When the stored copy was downloaded (absent when calculated locally). */
  savedAt?: number
  calculated: boolean
}

const RETRY_MS = 2 * 60_000

/**
 * The selected location, its 7-day schedule (with the user's corrections applied)
 * and settings. Offline-first: about two months are stored on the device and the
 * API is contacted only once a month; also works with no connection at all.
 */
export function useSchedule() {
  const [city, setStoredCity, cityReady] = usePersistedState<City>(CITY_KEY, DEFAULT_CITY)
  const [settings, setSettings] = useSettings()
  const [rawWeek, setRawWeek] = useState<WeekSchedule | null>(null)
  const [today, setToday] = useState<string | null>(null)
  const [offline, setOffline] = useState<OfflineStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  // Set to bypass the stored copy on the next load (manual retry, back online).
  const forceFetch = useRef(false)

  const locationKey = keyOf(city)
  const query = placeQuery(city)

  useEffect(() => {
    if (!cityReady) return
    const controller = new AbortController()
    const force = forceFetch.current
    forceFetch.current = false

    const show = (data: WeekSchedule, status: OfflineStatus | null, downloadedAt?: number) => {
      setError(null)
      setOffline(status)
      setSavedAt(downloadedAt ?? null)
      setRawWeek(data)
      setToday(dateAtOffset(Date.now(), data.utcOffset))
    }

    const load = async () => {
      // Offline-first: the stored copy is used as is, and the API is only
      // contacted once a month (or when it runs low, or on an explicit retry).
      const cached = readCache(locationKey)
      if (cached && !force && !needsRefresh(cached)) {
        await Promise.resolve() // keep state updates out of the effect's synchronous body
        show(cached.data, null, cached.savedAt)
        return
      }

      try {
        const params = [`hari=${OFFLINE_DAYS}`, query].filter(Boolean).join("&")
        const res = await fetch(`/api/jadwal/${city.id}?${params}`, { signal: controller.signal })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Gagal memuat jadwal")
        saveSchedule(locationKey, data as WeekSchedule)
        show(data as WeekSchedule, null, Date.now())
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        // No connection (or the source is down): fall back to what's on the device.
        const fallback = loadOfflineSchedule(city, locationKey)
        if (fallback) {
          show(fallback.data, { savedAt: fallback.savedAt, calculated: fallback.calculated }, fallback.savedAt)
        } else {
          const message = (err as Error).message
          setError(message === "Failed to fetch" ? "Tidak ada koneksi internet" : message)
        }
      }
    }

    void load()
    return () => controller.abort()
    // `city` is fully described by city.id + query (= locationKey).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city.id, query, cityReady, reloadKey])

  // While offline (or failing), retry periodically and as soon as the browser is back online.
  useEffect(() => {
    if (!offline && !error) return
    const retry = () => {
      forceFetch.current = true
      setReloadKey((k) => k + 1)
    }
    const timer = setInterval(retry, RETRY_MS)
    window.addEventListener("online", retry)
    return () => {
      clearInterval(timer)
      window.removeEventListener("online", retry)
    }
  }, [offline, error])

  // Just after the city's local midnight: move "today" forward and refresh.
  useEffect(() => {
    if (!rawWeek) return
    const tomorrow = addDays(dateAtOffset(Date.now(), rawWeek.utcOffset), 1)
    const delay = toEpoch(tomorrow, "00:00", rawWeek.utcOffset) - Date.now() + 2_000
    const timer = setTimeout(() => {
      setToday(tomorrow)
      setReloadKey((k) => k + 1)
    }, delay)
    return () => clearTimeout(timer)
  }, [rawWeek, today])

  // The UI works with 7 days from today; the rest is kept for offline use.
  const week = useMemo(() => {
    if (!rawWeek || !today) return null
    const days = rawWeek.days.filter((d) => d.date >= today).slice(0, 7)
    return days.length ? applyCorrections({ ...rawWeek, days }, settings.corrections) : null
  }, [rawWeek, today, settings.corrections])

  const setCity = useCallback(
    (next: City) => {
      if (keyOf(next) === locationKey) return
      setRawWeek(null)
      setOffline(null)
      setError(null)
      setStoredCity(next)
    },
    [locationKey, setStoredCity]
  )

  const reload = useCallback(() => {
    forceFetch.current = true
    setError(null)
    setReloadKey((k) => k + 1)
  }, [])

  return { city, setCity, cityReady, locationKey, week, offline, savedAt, error, reload, settings, setSettings }
}
