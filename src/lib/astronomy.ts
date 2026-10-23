// Prayer-time calculation from coordinates, tuned to match Kemenag RI schedules
// (Subuh -20°, Isya -18°, Ashar Syafi'i, altitude-dependent horizon, 2 min ihtiyat).

import { addDays, type DaySchedule } from "@/lib/prayer"

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

/** Sun declination (deg) and equation of time (minutes) for a Julian day. */
function sunPosition(jd: number) {
  const t = (jd - 2451545) / 36525
  const l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t)
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
  const c =
    Math.sin(rad(m)) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(rad(2 * m)) * (0.019993 - 0.000101 * t) +
    Math.sin(rad(3 * m)) * 0.000289
  const omega = 125.04 - 1934.136 * t
  const lambda = l0 + c - 0.00569 - 0.00478 * Math.sin(rad(omega))
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
  const eps = eps0 + 0.00256 * Math.cos(rad(omega))
  const declination = deg(Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lambda))))

  const y = Math.tan(rad(eps / 2)) ** 2
  const eqTime =
    4 *
    deg(
      y * Math.sin(2 * rad(l0)) -
        2 * e * Math.sin(rad(m)) +
        4 * e * y * Math.sin(rad(m)) * Math.cos(2 * rad(l0)) -
        0.5 * y * y * Math.sin(4 * rad(l0)) -
        1.25 * e * e * Math.sin(2 * rad(m))
    )
  return { declination, eqTime }
}

function julianDay(date: string) {
  const [y0, m0, d] = date.split("-").map(Number)
  const y = m0 <= 2 ? y0 - 1 : y0
  const m = m0 <= 2 ? m0 + 12 : m0
  const a = Math.floor(y / 100)
  const b = 2 - a + Math.floor(a / 4)
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5
}

type Ctx = { jd0: number; lat: number; lng: number; utcOffset: number }

/** Local clock hours of solar transit, evaluated near `hours`. */
function transitAt(ctx: Ctx, hours: number) {
  const { eqTime, declination } = sunPosition(ctx.jd0 + (hours - ctx.utcOffset) / 24)
  return { transit: 12 + ctx.utcOffset - ctx.lng / 15 - eqTime / 60, declination }
}

/** Local clock hours when the sun reaches `altitude` (deg), refined twice. */
function timeAtAltitude(ctx: Ctx, altitude: number | ((dec: number) => number), afterNoon: boolean) {
  let hours = afterNoon ? 15 : 6
  for (let i = 0; i < 3; i++) {
    const { transit, declination } = transitAt(ctx, hours)
    const alt = typeof altitude === "function" ? altitude(declination) : altitude
    const cosH =
      (Math.sin(rad(alt)) - Math.sin(rad(ctx.lat)) * Math.sin(rad(declination))) /
      (Math.cos(rad(ctx.lat)) * Math.cos(rad(declination)))
    const h = deg(Math.acos(Math.min(1, Math.max(-1, cosH)))) / 15
    hours = afterNoon ? transit + h : transit - h
  }
  return hours
}

/** Rounds local hours (+ ihtiyat minutes) to "HH:mm", up or down to the minute. */
function clock(hours: number, ihtiyatMin: number, round: "up" | "down") {
  const raw = hours * 60 + ihtiyatMin
  const total = round === "up" ? Math.ceil(raw - 1e-9) : Math.floor(raw + 1e-9)
  const h = Math.floor(total / 60) % 24
  return `${String(h).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]

export type Location = { lat: number; lng: number; elevation: number }

export function calculateDay(date: string, loc: Location, utcOffset: number): DaySchedule {
  const ctx: Ctx = { jd0: julianDay(date), lat: loc.lat, lng: loc.lng, utcOffset }
  // Horizon: refraction + semidiameter, plus dip of the horizon for the observer's height.
  const horizon = -(0.8333 + 0.0347 * Math.sqrt(Math.max(0, loc.elevation)))
  const asrAltitude = (dec: number) => deg(Math.atan(1 / (1 + Math.tan(rad(Math.abs(loc.lat - dec))))))

  const fajr = timeAtAltitude(ctx, -20, false)
  const sunrise = timeAtAltitude(ctx, horizon, false)
  const dhuha = timeAtAltitude(ctx, 4.5, false)
  const { transit } = transitAt(ctx, 12)
  const asr = timeAtAltitude(ctx, asrAltitude, true)
  const sunset = timeAtAltitude(ctx, horizon, true)
  const isha = timeAtAltitude(ctx, -18, true)

  const subuh = clock(fajr, 2, "up")
  const [sh, sm] = subuh.split(":").map(Number)
  const [y, m, d] = date.split("-")

  return {
    date,
    tanggal: `${DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()]}, ${d}/${m}/${y}`,
    imsak: clock(sh + (sm - 10) / 60, 0, "up"),
    subuh,
    terbit: clock(sunrise, -2, "down"),
    dhuha: clock(dhuha, 2, "up"),
    dzuhur: clock(transit, 3, "up"),
    ashar: clock(asr, 2, "up"),
    maghrib: clock(sunset, 2, "up"),
    isya: clock(isha, 2, "up"),
  }
}

export function calculateWeek(start: string, loc: Location, utcOffset: number, days = 7) {
  return Array.from({ length: days }, (_, i) => calculateDay(addDays(start, i), loc, utcOffset))
}
