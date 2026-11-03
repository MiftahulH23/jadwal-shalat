import { describe, expect, it } from "vitest"

import {
  applyCorrections,
  DEFAULT_SETTINGS,
  isRamadan,
  jumatOfficers,
  normalizeSettings,
  shiftTime,
} from "@/lib/settings"
import { makeWeek } from "@/lib/test-week"

describe("time corrections", () => {
  it("shifts a time forward and back", () => {
    expect(shiftTime("12:00", 2)).toBe("12:02")
    expect(shiftTime("12:00", -2)).toBe("11:58")
    expect(shiftTime("12:00", 0)).toBe("12:00")
  })

  it("carries over hours and midnight", () => {
    expect(shiftTime("11:59", 2)).toBe("12:01")
    expect(shiftTime("23:59", 2)).toBe("00:01")
    expect(shiftTime("00:01", -2)).toBe("23:59")
  })

  it("changes only the corrected time, on every day", () => {
    const week = makeWeek(["2026-11-03", "2026-11-04"])
    const result = applyCorrections(week, { ...DEFAULT_SETTINGS.corrections, maghrib: 3 })
    expect(result.days.map((d) => d.maghrib)).toEqual(["18:03", "18:03"])
    expect(result.days.map((d) => d.isya)).toEqual(["19:00", "19:00"])
  })
})

describe("saved settings", () => {
  it("falls back to the defaults for missing data", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS)
  })

  it("keeps time settings within their limits", () => {
    const result = normalizeSettings({
      iqamah: { subuh: 999, dzuhur: -5, ashar: 7, maghrib: 10, isya: 10 },
      corrections: { ...DEFAULT_SETTINGS.corrections, subuh: 99, isya: -99 },
      jumat: { khutbahMinutes: 1, khatib: "", imam: "", schedule: {} },
    })
    expect(result.iqamah).toMatchObject({ subuh: 60, dzuhur: 0, ashar: 7 })
    expect(result.corrections).toMatchObject({ subuh: 30, isya: -30 })
    expect(result.jumat.khutbahMinutes).toBe(5)
  })

  it("ignores values of the wrong type", () => {
    const raw = { iqamah: { subuh: "lima" }, prayingMinutes: null } as unknown as Parameters<typeof normalizeSettings>[0]
    const result = normalizeSettings(raw)
    expect(result.iqamah.subuh).toBe(10)
    expect(result.prayingMinutes).toBe(10)
  })
})

describe("Jumat officers", () => {
  const settings = normalizeSettings({
    jumat: {
      khutbahMinutes: 30,
      khatib: "Ustadz Bawaan",
      imam: "Imam Bawaan",
      schedule: { "2026-11-06": { khatib: "Ustadz Khusus", imam: "" } },
    },
  })

  it("uses a Friday's own entry and fills the blanks with the defaults", () => {
    expect(jumatOfficers(settings, "2026-11-06")).toEqual({ khatib: "Ustadz Khusus", imam: "Imam Bawaan" })
  })

  it("uses the defaults on other Fridays", () => {
    expect(jumatOfficers(settings, "2026-11-13")).toEqual({ khatib: "Ustadz Bawaan", imam: "Imam Bawaan" })
  })
})

describe("Ramadan", () => {
  const during = new Date("2026-03-01T12:00:00+07:00").getTime()
  const outside = new Date("2026-11-03T12:00:00+07:00").getTime()

  it("follows the Umm al-Qura calendar in automatic mode", () => {
    expect(isRamadan("auto", during, "Asia/Jakarta")).toBe(true)
    expect(isRamadan("auto", outside, "Asia/Jakarta")).toBe(false)
  })

  it("can be forced on or off", () => {
    expect(isRamadan("on", outside, "Asia/Jakarta")).toBe(true)
    expect(isRamadan("off", during, "Asia/Jakarta")).toBe(false)
  })
})
