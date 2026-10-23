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
  jumat: {
    khutbahMinutes: number
    /** Defaults, used for any Friday without its own entry in `schedule`. */
    khatib: string
    imam: string
    /** Per-Friday officers, keyed by date (YYYY-MM-DD). */
    schedule: Record<string, JumatOfficers>
  }
  /** Imam and muadzin for each daily prayer, shown on the mosque display. */
  petugas: Record<PrayerKey, { imam: string; muadzin: string }>
  /** Mosque cash report shown on the mosque display. Amounts in rupiah. */
  kas: { enabled: boolean; period: string; lastBalance: number; income: number; expense: number }
  /** Mosque display: dim the screen at night, between Isya and Subuh. */
  night: { enabled: boolean; afterIsya: number; beforeSubuh: number }
  /** Recurring study sessions (pengajian / kajian). */
  kajian: Kajian[]
}

/** day: 0 = Ahad … 6 = Sabtu, -1 = setiap hari. */
export type Kajian = { id: string; title: string; ustadz: string; day: number; time: string }

export const DAY_NAMES = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
export const kajianDayLabel = (day: number) => (day < 0 ? "Setiap hari" : DAY_NAMES[day])

export const MAX_KAJIAN = 12

export type JumatOfficers = { khatib: string; imam: string }


export const DEFAULT_SETTINGS: Settings = {
  iqamah: { subuh: 10, dzuhur: 10, ashar: 10, maghrib: 10, isya: 10 },
  corrections: { imsak: 0, subuh: 0, terbit: 0, dhuha: 0, dzuhur: 0, ashar: 0, maghrib: 0, isya: 0 },
  ramadan: "auto",
  mosqueName: "",
  mosqueAddress: "",
  runningText: "",
  prayingMinutes: 10,
  jumat: { khutbahMinutes: 30, khatib: "", imam: "", schedule: {} },
  petugas: {
    subuh: { imam: "", muadzin: "" },
    dzuhur: { imam: "", muadzin: "" },
    ashar: { imam: "", muadzin: "" },
    maghrib: { imam: "", muadzin: "" },
    isya: { imam: "", muadzin: "" },
  },
  kas: { enabled: false, period: "", lastBalance: 0, income: 0, expense: 0 },
  night: { enabled: true, afterIsya: 60, beforeSubuh: 60 },
  kajian: [],
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
      schedule: normalizeJumatSchedule(raw?.jumat?.schedule),
    },
    petugas: Object.fromEntries(
      PRAYER_KEYS.map((k) => [k, { imam: text(raw?.petugas?.[k]?.imam, 60), muadzin: text(raw?.petugas?.[k]?.muadzin, 60) }])
    ) as Settings["petugas"],
    kas: {
      enabled: raw?.kas?.enabled === true,
      period: text(raw?.kas?.period, 60),
      lastBalance: clamp(raw?.kas?.lastBalance, -MAX_RUPIAH, MAX_RUPIAH, 0),
      income: clamp(raw?.kas?.income, 0, MAX_RUPIAH, 0),
      expense: clamp(raw?.kas?.expense, 0, MAX_RUPIAH, 0),
    },
    night: {
      enabled: raw?.night?.enabled !== false,
      afterIsya: clamp(raw?.night?.afterIsya, 0, 360, d.night.afterIsya),
      beforeSubuh: clamp(raw?.night?.beforeSubuh, 0, 360, d.night.beforeSubuh),
    },
    kajian: (Array.isArray(raw?.kajian) ? raw.kajian : [])
      .slice(0, MAX_KAJIAN)
      .map((k, i) => ({
        id: text(k?.id, 40) || `k${i}`,
        title: text(k?.title, 80),
        ustadz: text(k?.ustadz, 80),
        day: clamp(k?.day, -1, 6, -1),
        time: text(k?.time, 40),
      }))
      .filter((k) => k.title || k.ustadz),
  }
}

/** Kajian sorted for display: today's first (then by weekday from today). */
export function sortKajian(list: Kajian[], todayWeekday: number) {
  const rank = (k: Kajian) => (k.day < 0 ? 0 : (k.day - todayWeekday + 7) % 7)
  return [...list].sort((a, b) => rank(a) - rank(b))
}

export const isKajianToday = (k: Kajian, todayWeekday: number) => k.day < 0 || k.day === todayWeekday

const MAX_RUPIAH = 1e13

/** Keeps valid, non-empty Friday entries (at most 26, about half a year). */
function normalizeJumatSchedule(raw: unknown): Settings["jumat"]["schedule"] {
  if (!raw || typeof raw !== "object") return {}
  const entries = Object.entries(raw as Record<string, Partial<JumatOfficers>>)
    .filter(([date]) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .map(([date, o]) => [date, { khatib: text(o?.khatib, 80), imam: text(o?.imam, 80) }] as const)
    .filter(([, o]) => o.khatib || o.imam)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 26)
  return Object.fromEntries(entries)
}

/** Officers for a given Friday: its own entry where filled in, otherwise the defaults. */
export function jumatOfficers(settings: Settings, date: string): JumatOfficers {
  const own = settings.jumat.schedule[date]
  return { khatib: own?.khatib || settings.jumat.khatib, imam: own?.imam || settings.jumat.imam }
}

/** Closing balance of the cash report. */
export const kasBalance = (kas: Settings["kas"]) => kas.lastBalance + kas.income - kas.expense

export const formatRupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n)

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
