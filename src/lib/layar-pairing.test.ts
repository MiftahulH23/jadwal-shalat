import { describe, expect, it } from "vitest"

import { isKey, newKey, newPairToken, pairUrl, parseLayarData, parseLayarSnapshot, readAturHash } from "@/lib/layar-data"
import { planQr, qrOutcome, type StoredQr } from "@/lib/layar-pairing"
import { DEFAULT_SETTINGS } from "@/lib/settings"

const MIN = 60_000
const T0 = Date.UTC(2026, 10, 6, 3, 0)
const qr = (firstShownAt: number, expiresAt: number): StoredQr => ({ pair: "p".repeat(22), firstShownAt, expiresAt })

describe("reusing a QR code after the TV reloads", () => {
  it("shows the same QR code while it is still valid", () => {
    expect(planQr(qr(T0, T0 + 15 * MIN), T0 + 5 * MIN)).toEqual({ action: "reuse" })
  })

  it("renews one that is about to expire, keeping the session", () => {
    expect(planQr(qr(T0, T0 + 15 * MIN), T0 + 14.5 * MIN)).toEqual({ action: "renew", firstShownAt: T0 })
  })

  it("renews an expired one within the hour", () => {
    expect(planQr(qr(T0, T0 + 45 * MIN), T0 + 46 * MIN)).toEqual({ action: "renew", firstShownAt: T0 })
  })

  it("stops after an hour of QR codes nobody scanned", () => {
    expect(planQr(qr(T0, T0 + 60 * MIN), T0 + 60 * MIN)).toEqual({ action: "stop" })
  })

  it("starts over when someone asks again", () => {
    expect(planQr(qr(T0, T0 + 60 * MIN), T0 + 61 * MIN, { restart: true })).toEqual({ action: "renew", firstShownAt: T0 + 61 * MIN })
  })

  it("starts over when no QR code was shown for a while, e.g. the next day", () => {
    expect(planQr(qr(T0, T0 + 60 * MIN), T0 + 24 * 60 * MIN)).toEqual({ action: "renew", firstShownAt: T0 + 24 * 60 * MIN })
  })

  it("asks for the first one", () => {
    expect(planQr(null, T0)).toEqual({ action: "renew", firstShownAt: T0 })
  })
})

describe("telling that the QR code was scanned", () => {
  const shown = qr(T0, T0 + 15 * MIN)

  it("a new TV: when its key starts to belong to a mosque", () => {
    expect(qrOutcome({ connected: false }, false, shown, T0 + MIN)).toBe("waiting")
    expect(qrOutcome({ connected: true, waiting: false }, false, shown, T0 + MIN)).toBe("used")
  })

  it("a new TV: expired when nobody scanned it in time", () => {
    expect(qrOutcome({ connected: false }, false, shown, T0 + 15 * MIN)).toBe("expired")
  })

  it("a connected TV: when its QR code stops waiting before expiring", () => {
    expect(qrOutcome({ connected: true, waiting: true }, true, shown, T0 + MIN)).toBe("waiting")
    expect(qrOutcome({ connected: true, waiting: false }, true, shown, T0 + MIN)).toBe("used")
    expect(qrOutcome({ connected: true, waiting: false }, true, shown, T0 + 15 * MIN)).toBe("expired")
  })
})

describe("keys and links", () => {
  it("makes long random keys and shorter QR tokens, both URL-safe", () => {
    const key = newKey()
    const pair = newPairToken()
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(pair).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(newKey()).not.toBe(key)
    expect(isKey(key) && isKey(pair)).toBe(true)
  })

  it("rejects anything else as a key", () => {
    for (const bad of ["", "pendek", "a".repeat(65), "ada spasi di dalam kunci ini", "<script>alert(1)</script>xxxx", 42, null]) {
      expect(isKey(bad)).toBe(false)
    }
  })

  it("puts the token in the fragment, never in the path or query", () => {
    expect(pairUrl("https://contoh.id", "abc")).toBe("https://contoh.id/atur#p=abc")
  })

  it("reads a scanned QR code or a phone's link", () => {
    const pair = newPairToken()
    const key = newKey()
    expect(readAturHash(`#p=${pair}`)).toEqual({ pair })
    expect(readAturHash(`#k=${key}`)).toEqual({ key })
    expect(readAturHash("#k=rusak")).toBeNull()
    expect(readAturHash("")).toBeNull()
  })
})

describe("shared data", () => {
  const city = { id: "0412", lokasi: "KOTA PEKANBARU" }

  it("needs a city", () => {
    expect(parseLayarData({ settings: {} })).toBeNull()
    expect(parseLayarData({ settings: {}, city })).toEqual({ settings: DEFAULT_SETTINGS, city })
  })

  it("cleans the settings like a backup", () => {
    const result = parseLayarData({ settings: { iqamah: { subuh: 999 }, mosqueName: "x".repeat(200) }, city })
    expect(result?.settings.iqamah.subuh).toBe(60)
    expect(result?.settings.mosqueName).toHaveLength(80)
  })

  it("rejects a bad city and anything that is not data", () => {
    expect(parseLayarData({ settings: {}, city: { id: "../../etc", lokasi: "x" } })).toBeNull()
    for (const bad of [null, "teks", [], { city }]) expect(parseLayarSnapshot(bad)).toBeNull()
  })

  it("accepts a TV's data without a city as a snapshot", () => {
    expect(parseLayarSnapshot({ settings: { mosqueName: "Masjid A" } })).toEqual({
      settings: { ...DEFAULT_SETTINGS, mosqueName: "Masjid A" },
    })
  })
})
