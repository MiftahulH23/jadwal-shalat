import type { WeekSchedule } from "@/lib/prayer"

export const ZONE_TIMEZONES: Record<WeekSchedule["zone"], string> = {
  WIB: "Asia/Jakarta",
  WITA: "Asia/Makassar",
  WIT: "Asia/Jayapura",
}

export function formatClock(epoch: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(epoch)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00"
  return `${get("hour")}:${get("minute")}:${get("second")}`
}

export function formatLongDate(epoch: number, timeZone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(epoch)
}

export function formatHijri(epoch: number, timeZone: string) {
  return new Intl.DateTimeFormat("id-ID-u-ca-islamic-umalqura", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(epoch)
}

/** Formats a schedule date string (YYYY-MM-DD) without timezone drift. */
export function formatScheduleDate(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("id-ID", { ...options, timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`)
  )
}

/** Hijri date (Umm al-Qura) for a schedule date string, e.g. "11 Jumadilawal 1448 H". */
export function hijriForDate(date: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) {
  return new Intl.DateTimeFormat("id-ID-u-ca-islamic-umalqura", { ...options, timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`)
  )
}
