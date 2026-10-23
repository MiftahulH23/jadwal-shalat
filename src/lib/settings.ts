// User settings, stored per device in localStorage (no database needed).

import { PRAYER_KEYS, TIME_KEYS, type PrayerKey, type TimeKey, type WeekSchedule } from "@/lib/prayer"

export type RamadanMode = "auto" | "on" | "off"

export type Settings = {
  /** Minutes between adzan and iqamah, per prayer. */
  iqamah: Record<PrayerKey, number>
  /** Minutes added to (or subtracted from) each published time. */
  corrections: Record<TimeKey, number>
  ramadan: RamadanMode
  /** Mosque display: name shown on the screen. */
  mosqueName: string
  /** Mosque display: address under the name; empty = the selected city / GPS location. */
  mosqueAddress: string
  /** Mosque display: scrolling announcement text. */
  runningText: string
  /** Mosque display: minutes the "shalat sedang berlangsung" screen stays after iqamah. */
  prayingMinutes: number
  /** Friday: khutbah replaces the iqamah wait after the Jumat adzan. */
  jumat: { khutbahMinutes: number; khatib: string; imam: string }
}

export const DEFAULT_SETTINGS: Settings = {
  iqamah: { subuh: 10, dzuhur: 10, ashar: 10, maghrib: 10, isya: 10 },
  corrections: { imsak: 0, subuh: 0, terbit: 0, dhuha: 0, dzuhur: 0, ashar: 0, maghrib: 0, isya: 0 },
  ramadan: "auto",
  mosqueName: "",
  mosqueAddress: "",
  runningText: "",
  prayingMinutes: 10,
  jumat: { khutbahMinutes: 30, khatib: "", imam: "" },
}

export const SETTINGS_KEY = "jadwal-shalat:settings"

const clamp = (n: unknown, min: number, max: number, fallback: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback

const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "")

/** Fills gaps and clamps values, so older or hand-edited data stays safe to use. */
export function normalizeSettings(raw: Partial<Settings> | null | undefined): Settings {
  const d = DEFAULT_SETTINGS
  return {
    iqamah: Object.fromEntries(
      PRAYER_KEYS.map((k) => [k, clamp(raw?.iqamah?.[k], 0, 60, d.iqamah[k])])
    ) as Settings["iqamah"],
    corrections: Object.fromEntries(
      TIME_KEYS.map((k) => [k, clamp(raw?.corrections?.[k], -30, 30, d.corrections[k])])
    ) as Settings["corrections"],
    ramadan: raw?.ramadan === "on" || raw?.ramadan === "off" ? raw.ramadan : "auto",
    mosqueName: typeof raw?.mosqueName === "string" ? raw.mosqueName.slice(0, 80) : d.mosqueName,
    mosqueAddress: text(raw?.mosqueAddress, 120),
    runningText: typeof raw?.runningText === "string" ? raw.runningText.slice(0, 500) : d.runningText,
    prayingMinutes: clamp(raw?.prayingMinutes, 0, 60, d.prayingMinutes),
    jumat: {
      khutbahMinutes: clamp(raw?.jumat?.khutbahMinutes, 5, 90, d.jumat.khutbahMinutes),
      khatib: text(raw?.jumat?.khatib, 80),
      imam: text(raw?.jumat?.imam, 80),
    },
  }
}

export function shiftTime(time: string, minutes: number) {
  if (!minutes) return time
  const [h, m] = time.split(":").map(Number)
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

/** Applies per-time corrections to every day of a schedule. */
export function applyCorrections<T extends Pick<WeekSchedule, "days">>(schedule: T, corrections: Settings["corrections"]): T {
  if (TIME_KEYS.every((k) => !corrections[k])) return schedule
  return {
    ...schedule,
    days: schedule.days.map((day) => {
      const next = { ...day }
      for (const k of TIME_KEYS) next[k] = shiftTime(day[k], corrections[k])
      return next
    }),
  }
}

/** Whether today is in Ramadan (Umm al-Qura calendar), honouring the manual override. */
export function isRamadan(mode: RamadanMode, epoch: number, timeZone: string) {
  if (mode !== "auto") return mode === "on"
  const month = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { month: "numeric", timeZone }).format(epoch)
  return Number(month) === 9
}

/** Running text is written as sentences separated by ";" — returns the non-empty sentences. */
export function splitRunningText(text: string) {
  return text
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
}
