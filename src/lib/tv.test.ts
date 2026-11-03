import { describe, expect, it } from "vitest"

import { getPrayerPhase, type PrayerPhase } from "@/lib/prayer"
import { makeWeek, wib } from "@/lib/test-week"
import { currentSlide, isNightTime, needsLayarSetup, prayingNow } from "@/lib/tv"

const IQAMAH = { subuh: 10, dzuhur: 10, ashar: 10, maghrib: 10, isya: 10 }
const TUE = "2026-11-03"
const WED = "2026-11-04"
const week = makeWeek([TUE, WED])
const phaseAt = (now: number) => getPrayerPhase(week, now, IQAMAH) as PrayerPhase

describe("first-run setup", () => {
  const jakarta = { id: "1301", lokasi: "KOTA JAKARTA" }

  it("is needed on a new display", () => {
    expect(needsLayarSetup(null, { mosqueName: "" })).toBe(true)
    expect(needsLayarSetup(null, { mosqueName: "   " })).toBe(true)
  })

  it("is not needed once a city was chosen", () => {
    expect(needsLayarSetup(jakarta, { mosqueName: "" })).toBe(false)
  })

  it("never interrupts a display already in use", () => {
    expect(needsLayarSetup(null, { mosqueName: "Masjid Al-Ikhlas" })).toBe(false)
  })
})

describe("prayer in progress screen", () => {
  const show = (time: string, minutes = 10) => {
    const now = wib(TUE, time)
    return prayingNow(phaseAt(now), now, minutes)
  }

  it("shows from iqamah for the set number of minutes", () => {
    expect(show("12:10")?.key).toBe("dzuhur")
    expect(show("12:19:59")?.key).toBe("dzuhur")
    expect(show("12:20")).toBeNull()
  })

  it("does not show during the iqamah wait", () => {
    expect(show("12:05")).toBeNull()
  })

  it("can be turned off with 0 minutes", () => {
    expect(show("12:10", 0)).toBeNull()
  })

  it("does not show before the first known prayer", () => {
    expect(show("00:05")).toBeNull()
  })
})

describe("info slides", () => {
  const slides = ["kas", "petugas"]
  const cycle = 30_000 + 12_000 * slides.length
  // A moment in the wait for Dzuhur (from 04:40), at the start of a cycle.
  const base = wib(TUE, "08:00") - (wib(TUE, "08:00") % cycle)
  const slideAt = (ms: number) => currentSlide(slides, phaseAt(base + ms), base + ms, false)

  it("shows the countdown for 30 seconds, then each slide for 12", () => {
    expect(slideAt(0)).toBeNull()
    expect(slideAt(29_999)).toBeNull()
    expect(slideAt(30_000)).toBe("kas")
    expect(slideAt(41_999)).toBe("kas")
    expect(slideAt(42_000)).toBe("petugas")
    expect(slideAt(53_999)).toBe("petugas")
    expect(slideAt(54_000)).toBeNull()
  })

  it("shows nothing without slides", () => {
    expect(currentSlide([], phaseAt(base + 30_000), base + 30_000, false)).toBeNull()
  })

  it("stops when the next adzan is 15 minutes away or less", () => {
    const now = base + 30_000
    const waiting = (msLeft: number): PrayerPhase => ({ kind: "waiting", key: "dzuhur", date: TUE, start: 0, end: now + msLeft })
    expect(currentSlide(slides, waiting(15 * 60_000 + 1), now, false)).toBe("kas")
    expect(currentSlide(slides, waiting(15 * 60_000), now, false)).toBeNull()
  })

  it("stops during iqamah and while a prayer is in progress", () => {
    const iqamah = wib(TUE, "12:05")
    expect(currentSlide(["a"], phaseAt(iqamah), iqamah - (iqamah % 42_000) + 30_000, false)).toBeNull()
    expect(currentSlide(slides, phaseAt(base + 30_000), base + 30_000, true)).toBeNull()
  })
})

describe("night screen", () => {
  const night = { enabled: true, afterIsya: 60, beforeSubuh: 60 }
  const isNight = (date: string, time: string, ramadan = false, options = night) => {
    const now = wib(date, time)
    return isNightTime(week, phaseAt(now), now, options, ramadan)
  }

  it("starts the set time after Isya", () => {
    expect(isNight(TUE, "19:59:59")).toBe(false)
    expect(isNight(TUE, "20:00")).toBe(true)
  })

  it("stays on past midnight and ends the set time before Subuh", () => {
    expect(isNight(WED, "00:30")).toBe(true)
    expect(isNight(WED, "03:29:59")).toBe(true)
    expect(isNight(WED, "03:30")).toBe(false)
  })

  it("works just after midnight, when the schedule starts today", () => {
    expect(isNight(TUE, "01:00")).toBe(true)
    expect(isNight(TUE, "03:30")).toBe(false)
  })

  it("stays awake during the day and the Isya iqamah", () => {
    expect(isNight(TUE, "13:00")).toBe(false)
    expect(isNight(TUE, "19:05")).toBe(false)
  })

  it("can be turned off", () => {
    expect(isNight(TUE, "22:00", false, { ...night, enabled: false })).toBe(false)
  })

  it("wakes at least 150 minutes before Subuh in Ramadan, for sahur", () => {
    expect(isNight(WED, "01:59:59", true)).toBe(true)
    expect(isNight(WED, "02:00", true)).toBe(false)
  })

  it("keeps a longer setting in Ramadan", () => {
    expect(isNight(WED, "01:29:59", true, { ...night, beforeSubuh: 180 })).toBe(true)
    expect(isNight(WED, "01:30", true, { ...night, beforeSubuh: 180 })).toBe(false)
  })
})
