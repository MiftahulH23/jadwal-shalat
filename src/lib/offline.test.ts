import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { loadOfflineSchedule, needsRefresh, readCache, saveSchedule, type CachedSchedule } from "@/lib/offline"
import { addDays } from "@/lib/prayer"
import { makeWeek, wib } from "@/lib/test-week"

const daysFrom = (start: string, count: number) => Array.from({ length: count }, (_, i) => addDays(start, i))

const cached = (savedAt: number, start: string, count: number): CachedSchedule => ({
  locationKey: "1301",
  savedAt,
  data: makeWeek(daysFrom(start, count)),
})

describe("when to contact the schedule API", () => {
  const savedAt = wib("2026-11-03", "08:00")

  it("does not refresh in the same month while enough days remain", () => {
    expect(needsRefresh(cached(savedAt, "2026-11-03", 62), wib("2026-11-30", "20:00"))).toBe(false)
  })

  it("refreshes once the calendar month changes", () => {
    expect(needsRefresh(cached(savedAt, "2026-11-03", 62), wib("2026-12-01", "00:00"))).toBe(true)
  })

  it("refreshes when fewer than 8 days remain", () => {
    const entry = cached(savedAt, "2026-11-03", 10)
    expect(needsRefresh(entry, wib("2026-11-05", "08:00"))).toBe(false) // 8 days left
    expect(needsRefresh(entry, wib("2026-11-06", "08:00"))).toBe(true) // 7 days left
  })

  it("decides the month in the city's zone", () => {
    // Saved at 00:30 WIB on 1 December: still November in UTC, already December in the city.
    expect(needsRefresh(cached(wib("2026-12-01", "00:30"), "2026-12-01", 62), wib("2026-12-02", "08:00"))).toBe(false)
  })
})

describe("stored schedule", () => {
  const jakarta = { id: "1301", lokasi: "KOTA JAKARTA" }
  const gps = { ...jakarta, place: { lat: -6.2, lng: 106.8, kecamatan: "Menteng" } }

  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it("is only used for the location it was saved for", () => {
    saveSchedule("1301", makeWeek(["2026-11-03"]))
    expect(readCache("1301")?.data.days).toHaveLength(1)
    expect(readCache("1219")).toBeNull()
  })

  it("is used offline while it still covers today", () => {
    saveSchedule("1301", makeWeek(daysFrom("2026-11-03", 3)))
    expect(loadOfflineSchedule(jakarta, "1301", wib("2026-11-05", "08:00"))).toMatchObject({ calculated: false })
  })

  it("leaves a city with nothing once it has run out", () => {
    saveSchedule("1301", makeWeek(daysFrom("2026-11-03", 3)))
    expect(loadOfflineSchedule(jakarta, "1301", wib("2026-11-06", "08:00"))).toBeNull()
  })

  it("calculates a GPS location once it has run out, starting today", () => {
    saveSchedule("1301@-6.2,106.8", makeWeek(daysFrom("2026-11-03", 3)))
    const result = loadOfflineSchedule(gps, "1301@-6.2,106.8", wib("2026-11-06", "08:00"))
    expect(result).toMatchObject({ calculated: true, data: { source: "koordinat", zone: "WIB", utcOffset: 7 } })
    expect(result?.data.days[0].date).toBe("2026-11-06")
  })

  it("guesses the zone from the longitude when nothing was ever stored", () => {
    const zoneOf = (lng: number) =>
      loadOfflineSchedule({ ...jakarta, place: { lat: -2, lng, kecamatan: "" } }, "gps", wib("2026-11-06", "08:00"))?.data.zone
    expect(zoneOf(106.8)).toBe("WIB")
    expect(zoneOf(119.4)).toBe("WITA")
    expect(zoneOf(140.7)).toBe("WIT")
  })
})
