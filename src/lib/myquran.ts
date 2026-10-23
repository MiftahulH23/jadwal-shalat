import "server-only"

import { cacheLife } from "next/cache"

import { calculateWeek } from "@/lib/astronomy"
import {
  addDays,
  dateAtOffset,
  zoneForRegion,
  type City,
  type DaySchedule,
  type WeekSchedule,
} from "@/lib/prayer"

// Public API by myQuran, sourced from Kemenag RI (Bimas Islam).
const BASE_URL = "https://api.myquran.com/v2/sholat"

type ApiResponse<T> = { status: boolean; data: T; message?: string }

type MonthData = {
  id: number
  lokasi: string
  daerah: string
  jadwal: DaySchedule[]
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { accept: "application/json" } })
  if (!res.ok) throw new Error(`myQuran API ${res.status} for ${path}`)
  const json = (await res.json()) as ApiResponse<T>
  if (!json.status) throw new Error(json.message ?? `myQuran API error for ${path}`)
  return json.data
}

export async function getCities(): Promise<City[]> {
  "use cache"
  cacheLife("weeks")
  const cities = await request<City[]>("/kota/semua")
  return cities.sort((a, b) => a.lokasi.localeCompare(b.lokasi, "id"))
}

async function getMonth(cityId: string, year: number, month: number): Promise<MonthData> {
  "use cache"
  cacheLife("days")
  return request<MonthData>(`/jadwal/${cityId}/${year}/${String(month).padStart(2, "0")}`)
}

export const MAX_DAYS = 62

/**
 * `days` days of prayer times (default 7, max 62) starting from "today" in the
 * city's own time zone. Clients ask for 62 so they only need the API once a month.
 */
export async function getWeekSchedule(cityId: string, days = 7, now = Date.now()): Promise<WeekSchedule> {
  const count = Math.min(MAX_DAYS, Math.max(1, Math.floor(days)))
  // Indonesia spans UTC+7..+9, so the city's window lies within these dates.
  const first = dateAtOffset(now, 7)
  const last = addDays(dateAtOffset(now, 9), count - 1)
  const months = new Set<string>()
  // Every calendar month touched by the window (jump to day 1, then +32 days).
  for (let d = first; d.slice(0, 7) <= last.slice(0, 7); d = addDays(`${d.slice(0, 7)}-01`, 32)) {
    months.add(d.slice(0, 7))
  }

  const results = await Promise.all(
    [...months].map((ym) => {
      const [y, m] = ym.split("-").map(Number)
      return getMonth(cityId, y, m)
    })
  )

  const { lokasi, daerah } = results[0]
  const zone = zoneForRegion(daerah)
  const today = dateAtOffset(now, zone.utcOffset)
  const schedule = results
    .flatMap((r) => r.jadwal)
    .filter((d) => d.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, count)

  return { id: cityId, lokasi, daerah, ...zone, days: schedule, source: "kemenag" }
}

/** A full calendar month, optionally calculated for a GPS point instead of the city. */
export async function getMonthSchedule(
  cityId: string,
  year: number,
  month: number,
  point?: { lat: number; lng: number }
): Promise<WeekSchedule> {
  const data = await getMonth(cityId, year, month)
  const zone = zoneForRegion(data.daerah)
  const days = [...data.jadwal].sort((a, b) => a.date.localeCompare(b.date))
  const base = { id: cityId, lokasi: data.lokasi, daerah: data.daerah, ...zone }
  if (!point || days.length === 0) return { ...base, days, source: "kemenag" }

  const lat = Math.round(point.lat * 1000) / 1000
  const lng = Math.round(point.lng * 1000) / 1000
  const elevation = await getElevation(lat, lng)
  return {
    ...base,
    days: calculateWeek(days[0].date, { lat, lng, elevation }, zone.utcOffset, days.length),
    source: "koordinat",
    elevation,
  }
}

/** Ground elevation in metres (Open-Meteo), needed for sunrise/sunset. 0 on failure. */
async function getElevation(lat: number, lng: number): Promise<number> {
  "use cache"
  cacheLife("max")
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`)
    const json = (await res.json()) as { elevation?: number[] }
    return Math.max(0, json.elevation?.[0] ?? 0)
  } catch {
    return 0
  }
}

/**
 * Same week as the city schedule (zone, dates, region), but with times
 * calculated for an exact point using Kemenag parameters.
 */
export async function getWeekScheduleAt(cityId: string, lat: number, lng: number, days = 7): Promise<WeekSchedule> {
  // ~100 m precision is plenty for prayer times and keeps the cache small.
  const rLat = Math.round(lat * 1000) / 1000
  const rLng = Math.round(lng * 1000) / 1000
  const [week, elevation] = await Promise.all([getWeekSchedule(cityId, days), getElevation(rLat, rLng)])
  const start = week.days[0]?.date
  if (!start) return week

  return {
    ...week,
    days: calculateWeek(start, { lat: rLat, lng: rLng, elevation }, week.utcOffset, week.days.length),
    source: "koordinat",
    elevation,
  }
}
