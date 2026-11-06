// What is shared between a TV and its phones, and how keys and QR codes are made and read.
// Safe for client and server: the server checks everything it receives with the same code.

import { parseCity } from "@/lib/backup"
import type { City } from "@/lib/prayer"
import { normalizeSettings, type Settings } from "@/lib/settings"

/** A mosque's shared data. Sound, theme, the stored schedule and the clock offset stay per device. */
export type LayarData = { settings: Settings; city: City }

/** The TV's data sent with a QR code; a new TV may not have chosen a city yet. */
export type LayarSnapshot = { settings: Settings; city?: City }

/** Accepts only well-formed data, cleaned the same way as a backup. */
export function parseLayarData(raw: unknown): LayarData | null {
  const snapshot = parseLayarSnapshot(raw)
  return snapshot?.city ? { settings: snapshot.settings, city: snapshot.city } : null
}

export function parseLayarSnapshot(raw: unknown): LayarSnapshot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const data = raw as { settings?: unknown; city?: unknown }
  if (!data.settings || typeof data.settings !== "object") return null
  const city = parseCity(data.city)
  return { settings: normalizeSettings(data.settings as Partial<Settings>), ...(city && { city }) }
}

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

/** A random key (256 bits) for a TV or a phone. Made on the device; the server only ever stores its hash. */
export const newKey = () => toBase64Url(crypto.getRandomValues(new Uint8Array(32)))

/** A QR token: shorter (128 bits), so the code stays easy to scan from a distance. Used once, for 15 minutes. */
export const newPairToken = () => toBase64Url(crypto.getRandomValues(new Uint8Array(16)))

export const isKey = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{22,64}$/.test(value)

/** The link in a QR code. A fragment (#), so the token never reaches server logs. */
export const pairUrl = (origin: string, pair: string) => `${origin}/atur#p=${pair}`

/** The phone's own link to its mosque. */
export const editUrl = (origin: string, key: string) => `${origin}/atur#k=${key}`

/** Reads "#p=…" (a scanned QR code) or "#k=…" (a phone's link). */
export function readAturHash(hash: string): { pair: string } | { key: string } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""))
  const pair = params.get("p")
  if (isKey(pair)) return { pair }
  const key = params.get("k")
  if (isKey(key)) return { key }
  return null
}
