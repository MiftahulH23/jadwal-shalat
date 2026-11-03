import { describe, expect, it } from "vitest"

import { calculateDay } from "@/lib/astronomy"
import { TIME_KEYS, type DaySchedule } from "@/lib/prayer"

// Published Kemenag schedules, downloaded from the myQuran API on 2026-11-03.
const KEMENAG: { city: string; lat: number; lng: number; utcOffset: number; day: Omit<DaySchedule, "tanggal"> }[] = [
  {
    city: "Jakarta, November",
    lat: -6.1754,
    lng: 106.8272,
    utcOffset: 7,
    day: { date: "2026-11-03", imsak: "03:58", subuh: "04:08", terbit: "05:23", dhuha: "05:51", dzuhur: "11:40", ashar: "14:56", maghrib: "17:50", isya: "19:01" },
  },
  {
    city: "Jakarta, Juni",
    lat: -6.1754,
    lng: 106.8272,
    utcOffset: 7,
    day: { date: "2026-06-15", imsak: "04:29", subuh: "04:39", terbit: "05:57", dhuha: "06:26", dzuhur: "11:57", ashar: "15:18", maghrib: "17:49", isya: "19:04" },
  },
  {
    city: "Makassar, November",
    lat: -5.1477,
    lng: 119.4327,
    utcOffset: 8,
    day: { date: "2026-11-15", imsak: "04:07", subuh: "04:17", terbit: "05:33", dhuha: "06:02", dzuhur: "11:50", ashar: "15:11", maghrib: "18:01", isya: "19:13" },
  },
  {
    city: "Makassar, Juni",
    lat: -5.1477,
    lng: 119.4327,
    utcOffset: 8,
    day: { date: "2026-06-15", imsak: "04:37", subuh: "04:47", terbit: "06:05", dhuha: "06:34", dzuhur: "12:06", ashar: "15:28", maghrib: "18:01", isya: "19:15" },
  },
]

const minutes = (time: string) => {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

describe("times calculated from coordinates", () => {
  it.each(KEMENAG)("match Kemenag within a minute: $city", ({ lat, lng, utcOffset, day }) => {
    const result = calculateDay(day.date, { lat, lng, elevation: 10 }, utcOffset)
    const off = Object.fromEntries(
      TIME_KEYS.map((key) => [key, minutes(result[key]) - minutes(day[key])] as const).filter(([, diff]) => Math.abs(diff) > 1)
    )
    expect(off).toEqual({})
  })

  it("puts imsak 10 minutes before Subuh", () => {
    const { imsak, subuh } = calculateDay("2026-11-03", { lat: -6.1754, lng: 106.8272, elevation: 10 }, 7)
    expect(minutes(subuh) - minutes(imsak)).toBe(10)
  })

  it("sets the sun earlier at sea level than on a mountain", () => {
    const low = calculateDay("2026-11-03", { lat: -6.9, lng: 107.6, elevation: 0 }, 7)
    const high = calculateDay("2026-11-03", { lat: -6.9, lng: 107.6, elevation: 2000 }, 7)
    expect(minutes(high.maghrib)).toBeGreaterThan(minutes(low.maghrib))
    expect(minutes(high.terbit)).toBeLessThan(minutes(low.terbit))
  })
})
