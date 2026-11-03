import { describe, expect, it } from "vitest"

import { getRamadanState } from "@/lib/ramadan"
import { makeWeek, wib } from "@/lib/test-week"

const TODAY = "2026-03-01"
const TOMORROW = "2026-03-02"
const week = makeWeek([TODAY, TOMORROW])

describe("Ramadan countdowns", () => {
  it("before imsak, counts to today's imsak and iftar", () => {
    expect(getRamadanState(week, wib(TODAY, "03:00"), TODAY)).toMatchObject({
      stage: "sahur",
      imsak: { at: wib(TODAY, "04:20") },
      berbuka: { at: wib(TODAY, "18:00") },
      progress: 0,
    })
  })

  it("while fasting, counts to tomorrow's imsak and today's iftar", () => {
    const state = getRamadanState(week, wib(TODAY, "12:00"), TODAY)
    expect(state).toMatchObject({
      stage: "fasting",
      imsak: { at: wib(TOMORROW, "04:20") },
      berbuka: { at: wib(TODAY, "18:00") },
    })
    expect(state?.progress).toBeGreaterThan(0)
    expect(state?.progress).toBeLessThan(1)
  })

  it("after iftar, counts to tomorrow's imsak and iftar", () => {
    expect(getRamadanState(week, wib(TODAY, "18:00"), TODAY)).toMatchObject({
      stage: "berbuka",
      imsak: { at: wib(TOMORROW, "04:20") },
      berbuka: { at: wib(TOMORROW, "18:00") },
      progress: 1,
    })
  })

  it("has nothing to show for a day outside the schedule", () => {
    expect(getRamadanState(week, wib("2026-03-05", "12:00"), "2026-03-05")).toBeNull()
  })
})
