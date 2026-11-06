import { describe, expect, it } from "vitest"

import type { LayarData } from "@/lib/layar-data"
import { canonical, changedParts, decideSync, timeAgo, timeChanges, tvSeenLabel } from "@/lib/layar-sync"
import { DEFAULT_SETTINGS } from "@/lib/settings"

const JAKARTA = { id: "1301", lokasi: "KOTA JAKARTA" }
const data = (mosqueName: string, city = JAKARTA): LayarData => ({ settings: { ...DEFAULT_SETTINGS, mosqueName }, city })
const A = canonical(data("A"))!
const B = canonical(data("B"))!

describe("comparing data", () => {
  it("treats the same meaning as equal, whatever the key order or extra fields", () => {
    const shuffled = { city: { lokasi: "KOTA JAKARTA", id: "1301", extra: 1 }, settings: { mosqueName: "A" } }
    expect(canonical(shuffled)).toBe(A)
  })

  it("tells different data apart, and refuses broken data", () => {
    expect(A).not.toBe(B)
    expect(canonical({ settings: {} })).toBeNull()
  })
})

describe("what a connected TV does at each check", () => {
  it("does nothing when neither side changed", () => {
    expect(decideSync({ version: 3, synced: A }, 3, A)).toEqual({ action: "idle" })
  })

  it("takes a newer version from the server", () => {
    expect(decideSync({ version: 3, synced: A }, 4, A)).toEqual({ action: "pull", lostLocal: false })
  })

  it("sends a change made on the TV", () => {
    expect(decideSync({ version: 3, synced: A }, 3, B)).toEqual({ action: "push" })
  })

  it("lets the server win when both changed, and says the TV's change was dropped", () => {
    expect(decideSync({ version: 3, synced: A }, 4, B)).toEqual({ action: "pull", lostLocal: true })
  })

  it("takes the server's data when it never synced before", () => {
    expect(decideSync({ version: null, synced: null }, 1, A)).toEqual({ action: "pull", lostLocal: true })
  })
})

describe("changes that move prayer times", () => {
  it("lists nothing for other changes, like the name or the cash report", () => {
    const after = { ...data("Baru"), settings: { ...data("Baru").settings, kas: { ...DEFAULT_SETTINGS.kas, income: 5 } } }
    expect(timeChanges(data("A"), after)).toEqual([])
  })

  it("lists a new location", () => {
    expect(timeChanges(data("A"), data("A", { id: "0412", lokasi: "KOTA PEKANBARU" }))).toEqual([
      "Lokasi: Kota Jakarta → Kota Pekanbaru",
    ])
  })

  it("lists corrections, iqamah waits and the khutbah", () => {
    const before = data("A")
    const after: LayarData = {
      ...before,
      settings: {
        ...before.settings,
        corrections: { ...before.settings.corrections, maghrib: 2, subuh: -1 },
        iqamah: { ...before.settings.iqamah, isya: 15 },
        jumat: { ...before.settings.jumat, khutbahMinutes: 40 },
      },
    }
    expect(timeChanges(before, after)).toEqual([
      "Koreksi Subuh: 0 menit → -1 menit",
      "Koreksi Maghrib: 0 menit → +2 menit",
      "Iqamah Isya: 10 menit → 15 menit",
      "Durasi khutbah Jumat: 30 menit → 40 menit",
    ])
  })

  it("notices a GPS point moving inside the same city", () => {
    const here = { ...JAKARTA, place: { lat: -6.2, lng: 106.8, kecamatan: "Menteng" } }
    const there = { ...JAKARTA, place: { lat: -6.3, lng: 106.9, kecamatan: "Menteng" } }
    expect(timeChanges(data("A", here), data("A", there))).toHaveLength(1)
  })
})

describe("when the TV last checked in", () => {
  const now = Date.UTC(2026, 10, 6, 8, 0)
  const before = (min: number) => new Date(now - min * 60_000).toISOString()

  it("says within the last hour, since the server notes it only once an hour", () => {
    expect(tvSeenLabel(before(0), now)).toBe("dalam 1 jam terakhir")
    expect(tvSeenLabel(before(59), now)).toBe("dalam 1 jam terakhir")
  })

  it("says how long ago after that, and when it never did", () => {
    expect(tvSeenLabel(before(180), now)).toBe("3 jam yang lalu")
    expect(tvSeenLabel(before(3 * 1440), now)).toBe("3 hari yang lalu")
    expect(tvSeenLabel(null, now)).toBe("belum pernah")
  })

  it("words other times plainly", () => {
    expect(timeAgo(before(0), now)).toBe("baru saja")
    expect(timeAgo(before(5), now)).toBe("5 menit yang lalu")
  })
})

describe("what changed between two versions", () => {
  it("names the parts like the tabs of Pengaturan", () => {
    const before = data("A")
    const after: LayarData = {
      city: { id: "0412", lokasi: "KOTA PEKANBARU" },
      settings: { ...before.settings, mosqueName: "B", kas: { ...before.settings.kas, income: 1000 } },
    }
    expect(changedParts(before, after)).toEqual(["Lokasi", "Kas", "Layar"])
  })

  it("names nothing when nothing changed", () => {
    expect(changedParts(data("A"), data("A"))).toEqual([])
  })
})
