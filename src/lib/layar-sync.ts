// Keeping a connected TV and the server in step. No React, so it can be tested.

import { parseLayarData, type LayarData } from "@/lib/layar-data"
import { locationLabel, PRAYER_KEYS, TIME_KEYS, TIME_LABELS } from "@/lib/prayer"

/** How often a connected TV asks whether there is something new, give or take JITTER_MS. */
export const SYNC_MS = 5 * 60_000
export const SYNC_JITTER_MS = 30_000

/**
 * One string per meaning, so data from the TV and from the server compare equal when they say the
 * same thing (both are cleaned first; cleaning also fixes the order of the keys).
 */
export function canonical(data: unknown): string | null {
  const clean = parseLayarData(data)
  return clean && JSON.stringify(clean)
}

/** What the TV last agreed on with the server. */
export type SyncedState = { version: number | null; synced: string | null }

export type SyncStep =
  /** Nothing to do. */
  | { action: "idle" }
  /** The server has something newer: take it. lostLocal: a change made on the TV is dropped for it. */
  | { action: "pull"; lostLocal: boolean }
  /** Only the TV changed: send it. */
  | { action: "push" }

/**
 * The server wins when both changed: a TV is rarely edited once a phone manages it, and a phone's
 * change is the deliberate one. The TV says so when its own change is dropped.
 */
export function decideSync(state: SyncedState, remoteVersion: number, local: string | null): SyncStep {
  const changedHere = local !== null && local !== state.synced
  if (state.version === null || remoteVersion > state.version) return { action: "pull", lostLocal: changedHere }
  return changedHere ? { action: "push" } : { action: "idle" }
}

const rtf = new Intl.RelativeTimeFormat("id", { numeric: "auto" })

/** "5 menit yang lalu", "2 jam yang lalu"… */
export function timeAgo(iso: string | null, now: number) {
  if (!iso) return "belum pernah"
  const min = Math.round((now - new Date(iso).getTime()) / 60_000)
  if (min < 1) return "baru saja"
  if (min < 60) return rtf.format(-min, "minute")
  if (min < 48 * 60) return rtf.format(-Math.round(min / 60), "hour")
  return rtf.format(-Math.round(min / 1440), "day")
}

/**
 * When the TV last checked in. The server notes this at most once an hour (to save writes), so within
 * the hour only "dalam 1 jam terakhir" is honest.
 */
export function tvSeenLabel(iso: string | null, now: number) {
  if (!iso) return "belum pernah"
  return now - new Date(iso).getTime() < 60 * 60_000 ? "dalam 1 jam terakhir" : timeAgo(iso, now)
}

const minutes = (n: number) => `${n} menit`
const signed = (n: number) => `${n > 0 ? "+" : ""}${n} menit`

/**
 * Changes that move prayer times on the screen, worded for a confirmation before saving from a phone:
 * a wrong time is the worst mistake this app can make.
 */
export function timeChanges(before: LayarData, after: LayarData): string[] {
  const lines: string[] = []
  const place = (d: LayarData) => locationLabel(d.city)
  if (place(before) !== place(after) || JSON.stringify(before.city.place) !== JSON.stringify(after.city.place)) {
    lines.push(`Lokasi: ${place(before)} → ${place(after)}`)
  }
  for (const key of TIME_KEYS) {
    const a = before.settings.corrections[key]
    const b = after.settings.corrections[key]
    if (a !== b) lines.push(`Koreksi ${TIME_LABELS[key]}: ${signed(a)} → ${signed(b)}`)
  }
  for (const key of PRAYER_KEYS) {
    const a = before.settings.iqamah[key]
    const b = after.settings.iqamah[key]
    if (a !== b) lines.push(`Iqamah ${TIME_LABELS[key]}: ${minutes(a)} → ${minutes(b)}`)
  }
  const ka = before.settings.jumat.khutbahMinutes
  const kb = after.settings.jumat.khutbahMinutes
  if (ka !== kb) lines.push(`Durasi khutbah Jumat: ${minutes(ka)} → ${minutes(kb)}`)
  return lines
}

/** Which parts of the settings differ, named like the tabs of Pengaturan; for the history list. */
export function changedParts(before: LayarData, after: LayarData): string[] {
  const a = before.settings
  const b = after.settings
  const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y)
  const parts: [string, boolean][] = [
    ["Lokasi", !same(before.city, after.city)],
    ["Iqamah", !same(a.iqamah, b.iqamah)],
    ["Koreksi", !same(a.corrections, b.corrections)],
    ["Ramadhan", a.ramadan !== b.ramadan],
    ["Jumat", !same(a.jumat, b.jumat)],
    ["Petugas", !same(a.petugas, b.petugas)],
    ["Pengajian", !same(a.kajian, b.kajian)],
    ["Kas", !same(a.kas, b.kas)],
    [
      "Layar",
      !same(
        [a.mosqueName, a.mosqueAddress, a.runningText, a.prayingMinutes, a.night, a.background, a.showSimulation],
        [b.mosqueName, b.mosqueAddress, b.runningText, b.prayingMinutes, b.night, b.background, b.showSimulation]
      ),
    ],
  ]
  return parts.filter(([, changed]) => changed).map(([name]) => name)
}
