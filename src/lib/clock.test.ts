import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/** A fresh copy of the module (it keeps the offset in module state), with a server `serverAhead` ms ahead. */
async function startClock(serverAhead: number, { fail = false, stored }: { fail?: boolean; stored?: number } = {}) {
  const store = new Map<string, string>(stored === undefined ? [] : [["jadwal-shalat:clock-offset", String(stored)]])
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  })
  const fetchMock = vi.fn(async () => {
    if (fail) throw new TypeError("Failed to fetch")
    return { ok: true, json: async () => ({ now: Date.now() + serverAhead }) }
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

  it("follows the server when the device clock is behind", async () => {
    const { clock, store } = await startClock(24_000)
    await vi.waitFor(() => expect(store.has("jadwal-shalat:clock-offset")).toBe(true))
    expect(Math.abs(clock.correctedNow() - Date.now() - 24_000)).toBeLessThan(200)
  })

  it("follows the server when the device clock is ahead", async () => {
    const { clock, store } = await startClock(-300_000)
    await vi.waitFor(() => expect(store.has("jadwal-shalat:clock-offset")).toBe(true))
    expect(Math.abs(clock.correctedNow() - Date.now() + 300_000)).toBeLessThan(200)
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
