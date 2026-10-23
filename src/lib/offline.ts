// Offline-first schedules: about two months are downloaded at once and kept on the
// device, so the API is only needed once a month. GPS locations can also be
// calculated locally when the stored copy runs out.

import { calculateWeek } from "@/lib/astronomy"
import { dateAtOffset, type City, type WeekSchedule } from "@/lib/prayer"

const CACHE_KEY = "jadwal-shalat:cache"

/** Days requested per download: the rest of this month plus (at least) all of next month. */
export const OFFLINE_DAYS = 62

/** The UI shows a week, so refresh before fewer days than this remain. */
const MIN_DAYS_LEFT = 8

export type CachedSchedule = { locationKey: string; savedAt: number; data: WeekSchedule }

export function saveSchedule(locationKey: string, data: WeekSchedule) {
  try {
    const entry: CachedSchedule = { locationKey, savedAt: Date.now(), data }
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {
    // Storage full or blocked: offline fallback just won't be available.
  }
}

export function readCache(locationKey: string): CachedSchedule | null {
  try {
    const entry = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as CachedSchedule | null
    return entry?.locationKey === locationKey && Array.isArray(entry.data?.days) ? entry : null
  } catch {
    return null
  }
}

/**
 * Whether to contact the API: only once per calendar month (to pick up any updates),
 * or earlier if the stored copy is about to run out.
 */
export function needsRefresh(cached: CachedSchedule, now = Date.now()) {
  const { utcOffset, days } = cached.data
  const today = dateAtOffset(now, utcOffset)
  const savedMonth = dateAtOffset(cached.savedAt, utcOffset).slice(0, 7)
  const daysLeft = days.filter((d) => d.date >= today).length
  return savedMonth !== today.slice(0, 7) || daysLeft < MIN_DAYS_LEFT
}

/** Rough zone from longitude, only used when nothing was ever downloaded. */
function guessZone(lng: number): Pick<WeekSchedule, "utcOffset" | "zone"> {
  if (lng >= 125) return { utcOffset: 9, zone: "WIT" }
  if (lng >= 114.5) return { utcOffset: 8, zone: "WITA" }
  return { utcOffset: 7, zone: "WIB" }
}

export type OfflineSchedule = {
  data: WeekSchedule
  /** When the stored copy was downloaded (absent when calculated locally). */
  savedAt?: number
  calculated: boolean
}

/**
 * Best available schedule without network: the stored copy while it still covers
 * today, otherwise (for GPS locations) a locally calculated one.
 */
export function loadOfflineSchedule(city: City, locationKey: string, now = Date.now()): OfflineSchedule | null {
  const cached = readCache(locationKey)
  if (cached) {
    const today = dateAtOffset(now, cached.data.utcOffset)
    if (cached.data.days.some((d) => d.date >= today)) {
      return { data: cached.data, savedAt: cached.savedAt, calculated: false }
    }
  }

  if (!city.place) return null
  const zone = cached ? { utcOffset: cached.data.utcOffset, zone: cached.data.zone } : guessZone(city.place.lng)
  const today = dateAtOffset(now, zone.utcOffset)
  const elevation = cached?.data.elevation ?? 0
  return {
    calculated: true,
    data: {
      id: city.id,
      lokasi: city.lokasi,
      daerah: cached?.data.daerah ?? "",
      ...zone,
      days: calculateWeek(today, { ...city.place, elevation }, zone.utcOffset, OFFLINE_DAYS),
      source: "koordinat",
      elevation,
    },
  }
}
