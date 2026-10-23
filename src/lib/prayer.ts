// Shared types and time helpers for prayer schedules (safe for client and server).

/** Default minutes between adzan and iqamah (adjustable per prayer in settings). */
export const IQAMAH_MINUTES = 10

/** A precise point (from GPS) inside a city, labelled with its kecamatan. */
export type Place = { lat: number; lng: number; kecamatan: string }

/** Selected location: a Kemenag city, optionally narrowed down to a GPS point. */
export type City = { id: string; lokasi: string; place?: Place }

export type DaySchedule = {
  date: string // YYYY-MM-DD
  tanggal: string
  imsak: string
  subuh: string
  terbit: string
  dhuha: string
  dzuhur: string
  ashar: string
  maghrib: string
  isya: string
}

export type WeekSchedule = {
  id: string
  lokasi: string
  daerah: string
  utcOffset: number
  zone: "WIB" | "WITA" | "WIT"
  days: DaySchedule[]
  /** "kemenag" = official city schedule; "koordinat" = calculated for a GPS point. */
  source: "kemenag" | "koordinat"
  elevation?: number
}

/** Rough bounding box of Indonesia, used to validate coordinates. */
export function isInIndonesia(lat: number, lng: number) {
  return lat >= -11.5 && lat <= 6.5 && lng >= 94.5 && lng <= 141.5
}

export type TimeKey = Exclude<keyof DaySchedule, "date" | "tanggal">

export const TIME_KEYS: TimeKey[] = [
  "imsak",
  "subuh",
  "terbit",
  "dhuha",
  "dzuhur",
  "ashar",
  "maghrib",
  "isya",
]

/** The five obligatory prayers that get a countdown and iqamah. */
export const PRAYER_KEYS = ["subuh", "dzuhur", "ashar", "maghrib", "isya"] as const
export type PrayerKey = (typeof PRAYER_KEYS)[number]

const DEFAULT_IQAMAH = Object.fromEntries(PRAYER_KEYS.map((k) => [k, IQAMAH_MINUTES])) as Record<
  PrayerKey,
  number
>

export const TIME_LABELS: Record<TimeKey, string> = {
  imsak: "Imsak",
  subuh: "Subuh",
  terbit: "Terbit",
  dhuha: "Dhuha",
  dzuhur: "Dzuhur",
  ashar: "Ashar",
  maghrib: "Maghrib",
  isya: "Isya",
}

export const ARABIC_LABELS: Record<TimeKey, string> = {
  imsak: "إمساك",
  subuh: "الفجر",
  terbit: "الشروق",
  dhuha: "الضحى",
  dzuhur: "الظهر",
  ashar: "العصر",
  maghrib: "المغرب",
  isya: "العشاء",
}

const WIT_REGIONS = ["PAPUA", "MALUKU"]
const WITA_REGIONS = [
  "BALI",
  "NUSA TENGGARA",
  "SULAWESI",
  "GORONTALO",
  "KALIMANTAN SELATAN",
  "KALIMANTAN TIMUR",
  "KALIMANTAN UTARA",
]

/** Kemenag times are local to the city, so map the province to its UTC offset. */
export function zoneForRegion(daerah: string): Pick<WeekSchedule, "utcOffset" | "zone"> {
  const region = daerah.toUpperCase()
  if (WIT_REGIONS.some((r) => region.includes(r))) return { utcOffset: 9, zone: "WIT" }
  if (WITA_REGIONS.some((r) => region.includes(r))) return { utcOffset: 8, zone: "WITA" }
  return { utcOffset: 7, zone: "WIB" }
}

/** Calendar date (YYYY-MM-DD) at the given UTC offset. */
export function dateAtOffset(epoch: number, utcOffset: number) {
  return new Date(epoch + utcOffset * 3_600_000).toISOString().slice(0, 10)
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Converts a local "HH:mm" on a given date into an absolute timestamp. */
export function toEpoch(date: string, time: string, utcOffset: number) {
  const [y, m, d] = date.split("-").map(Number)
  const [h, min] = time.split(":").map(Number)
  return Date.UTC(y, m - 1, d, h, min) - utcOffset * 3_600_000
}

export function isFriday(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay() === 5
}

/** Friday Dzuhur is replaced by Jumat prayer (with khutbah before iqamah). */
export function isJumat(key: TimeKey, date: string) {
  return key === "dzuhur" && isFriday(date)
}

export function prayerLabel(key: TimeKey, date: string) {
  return isJumat(key, date) ? "Jumat" : TIME_LABELS[key]
}

export function arabicLabel(key: TimeKey, date: string) {
  return isJumat(key, date) ? "الجمعة" : ARABIC_LABELS[key]
}

export type PrayerPhase =
  | {
      kind: "iqamah"
      key: PrayerKey
      date: string
      start: number
      end: number
    }
  | {
      kind: "waiting"
      key: PrayerKey
      date: string
      start: number // when the wait began (end of previous iqamah)
      end: number // adzan time of the upcoming prayer
      /** The prayer whose iqamah ended at `start`, if known. */
      prev?: { key: PrayerKey; date: string; at: number }
    }

/**
 * Works out what the clock should count down to right now:
 * the iqamah of a prayer that just started, or the next prayer.
 */
export function getPrayerPhase(
  week: WeekSchedule,
  now: number,
  iqamahMinutes: Record<PrayerKey, number> = DEFAULT_IQAMAH,
  /** On Fridays the Jumat khutbah takes the place of the iqamah wait. */
  khutbahMinutes?: number
): PrayerPhase | null {
  const events = week.days.flatMap((day) =>
    PRAYER_KEYS.map((key) => ({
      key,
      date: day.date,
      at: toEpoch(day.date, day[key], week.utcOffset),
      iqamah:
        (khutbahMinutes !== undefined && isJumat(key, day.date) ? khutbahMinutes : iqamahMinutes[key]) * 60_000,
    }))
  )

  for (let i = 0; i < events.length; i++) {
    const ev = events[i]
    const iqamah = ev.iqamah
    if (now < ev.at) {
      const prev = events[i - 1]
      // Before the first known prayer, assume the wait started at local midnight.
      const start = prev ? prev.at + prev.iqamah : toEpoch(ev.date, "00:00", week.utcOffset)
      return {
        kind: "waiting",
        key: ev.key,
        date: ev.date,
        start,
        end: ev.at,
        prev: prev && { key: prev.key, date: prev.date, at: prev.at },
      }
    }
    if (now < ev.at + iqamah) {
      return { kind: "iqamah", key: ev.key, date: ev.date, start: ev.at, end: ev.at + iqamah }
    }
  }
  return null
}

export function splitDuration(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}

export const pad = (n: number) => n.toString().padStart(2, "0")

export function formatDuration(ms: number) {
  const { hours, minutes, seconds } = splitDuration(ms)
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

/** "KAB. BANDUNG BARAT" -> "Kab. Bandung Barat", keeping acronyms like "DKI". */
export function prettyCity(name: string) {
  return name
    .toLowerCase()
    .replace(/(^|[\s.(-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/\b(Dki|Di)\b/g, (m) => m.toUpperCase())
}

/** Automatic location label: "Kec. X, Kota Y" for a GPS point, otherwise the city (and province). */
export function locationLabel(city: City, region?: Pick<WeekSchedule, "lokasi" | "daerah"> | null) {
  const lokasi = prettyCity(region?.lokasi ?? city.lokasi)
  if (city.place?.kecamatan) return `Kec. ${city.place.kecamatan}, ${lokasi}`
  return region?.daerah ? `${lokasi}, ${prettyCity(region.daerah)}` : lokasi
}
