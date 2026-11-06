import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { offsetFromDates, type DateSample } from "@/lib/clock"

/** What a server whose clock is `serverAhead` ms ahead would answer, read halfway through the round trip. */
function reading(serverAhead: number, sentAt: number, roundTrip: number): DateSample {
  const serverMs = sentAt + roundTrip / 2 + serverAhead
  return { sentAt, receivedAt: sentAt + roundTrip, serverSecond: Math.floor(serverMs / 1000) * 1000 }
}

const T = Date.UTC(2026, 10, 6, 9, 0, 0)

describe("offset from whole-second Date headers", () => {
  it.each([24_000, -300_000, 0, 1_234, -7_777])("finds a server %i ms away to within half a second from one reading", (ahead) => {
    const estimate = offsetFromDates([reading(ahead, T + 123, 80)])!
    expect(Math.abs(estimate - ahead)).toBeLessThanOrEqual(540)
  })

  it.each([24_000, -300_000, 1_234, -7_777, 499, 501])("narrows a server %i ms away to within a quarter second from four spread readings", (ahead) => {
    const samples = [0, 1, 2, 3].map((i) => reading(ahead, T + 37 + i * 410, 60))
    const estimate = offsetFromDates(samples)!
    expect(Math.abs(estimate - ahead)).toBeLessThanOrEqual(250)
  })

  it("ignores readings with slow round trips", () => {
    const good = reading(10_000, T, 80)
    const slow = { ...reading(10_000, T + 500, 5_000), serverSecond: 0 }
    expect(Math.abs(offsetFromDates([good, slow])! - 10_000)).toBeLessThanOrEqual(540)
    expect(offsetFromDates([slow])).toBeNull()
  })

  it("falls back to the quickest reading when readings disagree", () => {
    const a = reading(10_000, T, 50)
    const b = reading(60_000, T + 400, 200)
    expect(Math.abs(offsetFromDates([a, b])! - 10_000)).toBeLessThanOrEqual(540)
  })

  it("has nothing to say without readings", () => {
    expect(offsetFromDates([])).toBeNull()
  })
})

/** A fresh copy of the module (it keeps the offset in module state), with a server `serverAhead` ms ahead. */
async function startClock(serverAhead: number, { fail = false, stored }: { fail?: boolean; stored?: number } = {}) {
  const store = new Map<string, string>(stored === undefined ? [] : [["jadwal-shalat:clock-offset", String(stored)]])
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  })
  const fetchMock = vi.fn(async () => {
    if (fail) throw new TypeError("Failed to fetch")
    return { ok: true, headers: new Headers({ date: new Date(Date.now() + serverAhead).toUTCString() }) }
  })
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("window", { addEventListener: () => {} })
  vi.stubGlobal("document", { addEventListener: () => {}, visibilityState: "visible" })
  vi.stubGlobal("setInterval", () => 0)
  vi.resetModules()
  const clock = await import("@/lib/clock")
  clock.startClockSync()
  return { clock, fetchMock, store }
}

describe("clock correction", () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllGlobals())

  it("reads the server time from a static file, with no function call", async () => {
    const { fetchMock, store } = await startClock(24_000)
    await vi.waitFor(() => expect(store.has("jadwal-shalat:clock-offset")).toBe(true), { timeout: 3000 })
    expect(fetchMock).toHaveBeenCalledWith("/waktu.txt", { method: "HEAD", cache: "no-store" })
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it("follows the server when the device clock is behind", async () => {
    const { clock, store } = await startClock(24_000)
    await vi.waitFor(() => expect(store.has("jadwal-shalat:clock-offset")).toBe(true), { timeout: 3000 })
    expect(Math.abs(clock.correctedNow() - Date.now() - 24_000)).toBeLessThan(1000)
  })

  it("follows the server when the device clock is ahead", async () => {
    const { clock, store } = await startClock(-300_000)
    await vi.waitFor(() => expect(store.has("jadwal-shalat:clock-offset")).toBe(true), { timeout: 3000 })
    expect(Math.abs(clock.correctedNow() - Date.now() + 300_000)).toBeLessThan(1000)
  })

  it("keeps the stored correction while offline", async () => {
    const { clock, fetchMock } = await startClock(0, { fail: true, stored: 5_000 })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(Math.abs(clock.correctedNow() - Date.now() - 5_000)).toBeLessThan(200)
  })

  it("uses the device clock as is when it has never synced", async () => {
    const { clock, fetchMock } = await startClock(0, { fail: true })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(Math.abs(clock.correctedNow() - Date.now())).toBeLessThan(200)
  })
})
