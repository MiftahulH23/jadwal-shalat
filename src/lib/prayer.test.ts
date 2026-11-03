import { describe, expect, it } from "vitest"

import { addDays, dateAtOffset, getPrayerPhase, isFriday, isJumat, prayerLabel, toEpoch, zoneForRegion } from "@/lib/prayer"
import { at, makeWeek, wib } from "@/lib/test-week"

const IQAMAH = { subuh: 10, dzuhur: 10, ashar: 10, maghrib: 10, isya: 10 }
// 2026-11-03 is a Tuesday, 2026-11-06 a Friday.
const TUE = "2026-11-03"
const WED = "2026-11-04"
const FRI = "2026-11-06"

describe("test environment", () => {
  it("runs outside Indonesia's time zones", () => {
    expect([-420, -480, -540]).not.toContain(new Date(wib(TUE, "12:00")).getTimezoneOffset())
  })
})

describe("adzan and iqamah phases", () => {
  const week = makeWeek([TUE, WED])

  it("counts down to the next adzan", () => {
    expect(getPrayerPhase(week, wib(TUE, "10:00"), IQAMAH)).toEqual({
      kind: "waiting",
      key: "dzuhur",
      date: TUE,
      start: wib(TUE, "04:40"),
      end: wib(TUE, "12:00"),
      prev: { key: "subuh", date: TUE, at: wib(TUE, "04:30") },
    })
  })

  it("is still waiting one second before adzan", () => {
    expect(getPrayerPhase(week, wib(TUE, "11:59:59"), IQAMAH)?.kind).toBe("waiting")
  })

  it("switches to iqamah exactly at adzan", () => {
    expect(getPrayerPhase(week, wib(TUE, "12:00"), IQAMAH)).toEqual({
      kind: "iqamah",
      key: "dzuhur",
      date: TUE,
      start: wib(TUE, "12:00"),
      end: wib(TUE, "12:10"),
    })
  })

  it("moves on to the next prayer exactly when iqamah ends", () => {
    expect(getPrayerPhase(week, wib(TUE, "12:09:59"), IQAMAH)?.kind).toBe("iqamah")
    expect(getPrayerPhase(week, wib(TUE, "12:10"), IQAMAH)).toMatchObject({
      kind: "waiting",
      key: "ashar",
      start: wib(TUE, "12:10"),
      prev: { key: "dzuhur" },
    })
  })

  it("uses each prayer's own iqamah wait", () => {
    expect(getPrayerPhase(week, wib(TUE, "18:14"), { ...IQAMAH, maghrib: 15 })).toMatchObject({
      kind: "iqamah",
      key: "maghrib",
      end: wib(TUE, "18:15"),
    })
  })

  it("skips the iqamah phase when its wait is 0", () => {
    expect(getPrayerPhase(week, wib(TUE, "12:00"), { ...IQAMAH, dzuhur: 0 })).toMatchObject({
      kind: "waiting",
      key: "ashar",
      start: wib(TUE, "12:00"),
    })
  })

  it("goes to tomorrow's Subuh after Isya", () => {
    expect(getPrayerPhase(week, wib(TUE, "21:00"), IQAMAH)).toMatchObject({
      kind: "waiting",
      key: "subuh",
      date: WED,
      end: wib(WED, "04:30"),
      prev: { key: "isya", date: TUE },
    })
  })

  it("starts the wait at local midnight before the first known prayer", () => {
    const phase = getPrayerPhase(week, wib(TUE, "02:00"), IQAMAH)
    expect(phase).toMatchObject({ kind: "waiting", key: "subuh", date: TUE, start: wib(TUE, "00:00") })
    expect(phase).toHaveProperty("prev", undefined)
  })

  it("has no phase once the schedule has run out", () => {
    expect(getPrayerPhase(week, wib(WED, "19:10"), IQAMAH)).toBeNull()
  })
})

describe("Friday", () => {
  const week = makeWeek(["2026-11-05", FRI])

  it("recognises Friday Dzuhur as Jumat, and no other prayer or day", () => {
    expect(isFriday(FRI)).toBe(true)
    expect(isFriday("2026-11-05")).toBe(false)
    expect(isJumat("dzuhur", FRI)).toBe(true)
    expect(isJumat("ashar", FRI)).toBe(false)
    expect(isJumat("dzuhur", "2026-11-05")).toBe(false)
    expect(prayerLabel("dzuhur", FRI)).toBe("Jumat")
    expect(prayerLabel("dzuhur", "2026-11-05")).toBe("Dzuhur")
  })

  it("waits for the khutbah instead of the iqamah wait", () => {
    expect(getPrayerPhase(week, wib(FRI, "12:29:59"), IQAMAH, 30)).toMatchObject({
      kind: "iqamah",
      key: "dzuhur",
      end: wib(FRI, "12:30"),
    })
    expect(getPrayerPhase(week, wib(FRI, "12:30"), IQAMAH, 30)).toMatchObject({ kind: "waiting", key: "ashar" })
  })

  it("keeps the normal wait on other days and other prayers", () => {
    expect(getPrayerPhase(week, wib("2026-11-05", "12:10"), IQAMAH, 30)?.key).toBe("ashar")
    expect(getPrayerPhase(week, wib(FRI, "15:10"), IQAMAH, 30)?.key).toBe("maghrib")
  })
})

describe("crossing into the next month", () => {
  it("goes from the end of a month to the first Subuh of the next", () => {
    const week = makeWeek(["2026-10-31", "2026-11-01"])
    expect(getPrayerPhase(week, wib("2026-10-31", "22:00"), IQAMAH)).toMatchObject({
      key: "subuh",
      date: "2026-11-01",
      end: wib("2026-11-01", "04:30"),
    })
  })

  it("goes across the new year", () => {
    const week = makeWeek(["2026-12-31", "2027-01-01"])
    expect(getPrayerPhase(week, wib("2026-12-31", "22:00"), IQAMAH)).toMatchObject({
      key: "subuh",
      date: "2027-01-01",
      end: wib("2027-01-01", "04:30"),
    })
  })

  it("adds days across months, years and leap days", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01")
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31")
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29")
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01")
  })
})

describe("time zones", () => {
  it.each([
    ["DKI JAKARTA", 7, "WIB"],
    ["RIAU", 7, "WIB"],
    ["KALIMANTAN BARAT", 7, "WIB"],
    ["KALIMANTAN TENGAH", 7, "WIB"],
    ["BALI", 8, "WITA"],
    ["NUSA TENGGARA TIMUR", 8, "WITA"],
    ["SULAWESI SELATAN", 8, "WITA"],
    ["GORONTALO", 8, "WITA"],
    ["KALIMANTAN SELATAN", 8, "WITA"],
    ["KALIMANTAN TIMUR", 8, "WITA"],
    ["KALIMANTAN UTARA", 8, "WITA"],
    ["PAPUA BARAT", 9, "WIT"],
    ["MALUKU UTARA", 9, "WIT"],
  ])("%s is %i (%s)", (daerah, utcOffset, zone) => {
    expect(zoneForRegion(daerah)).toEqual({ utcOffset, zone })
  })

  it("reads a schedule's clock time in the city's zone, not the device's", () => {
    expect(toEpoch(TUE, "12:00", 7)).toBe(at(TUE, "12:00", "+07:00"))
    expect(toEpoch(TUE, "12:00", 8)).toBe(at(TUE, "12:00", "+08:00"))
    expect(toEpoch(TUE, "12:00", 9)).toBe(at(TUE, "12:00", "+09:00"))
  })

  it("starts the new day at the city's midnight", () => {
    expect(dateAtOffset(at(TUE, "23:59:59"), 7)).toBe(TUE)
    expect(dateAtOffset(at(WED, "00:00"), 7)).toBe(WED)
    // The same instant is already tomorrow further east.
    expect(dateAtOffset(at(TUE, "23:00"), 8)).toBe(WED)
    expect(dateAtOffset(at(TUE, "22:00"), 9)).toBe(WED)
  })

  it("counts down to the right instant in WITA and WIT", () => {
    const wita = makeWeek([TUE], { utcOffset: 8, zone: "WITA" })
    expect(getPrayerPhase(wita, at(TUE, "11:00", "+08:00"), IQAMAH)).toMatchObject({
      key: "dzuhur",
      end: at(TUE, "12:00", "+08:00"),
    })
    const wit = makeWeek([TUE], { utcOffset: 9, zone: "WIT" })
    expect(getPrayerPhase(wit, at(TUE, "11:00", "+09:00"), IQAMAH)).toMatchObject({
      key: "dzuhur",
      end: at(TUE, "12:00", "+09:00"),
    })
  })
})
