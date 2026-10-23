// Backup / restore of everything stored on this device, as a file or a short code.

import { isInIndonesia, type City } from "@/lib/prayer"
import { normalizeSettings, type Settings } from "@/lib/settings"

const APP_ID = "jadwal-shalat"
const VERSION = 1

export type Backup = {
  settings: Settings
  city: City
  soundOn: boolean
}

type BackupFile = Backup & { app: string; version: number; exportedAt: string }

export function toBackupJson(backup: Backup) {
  const file: BackupFile = { app: APP_ID, version: VERSION, exportedAt: new Date().toISOString(), ...backup }
  return JSON.stringify(file, null, 2)
}

/** Compact, copy-pasteable code (base64 of the JSON, UTF-8 safe). */
export function toBackupCode(backup: Backup) {
  const bytes = new TextEncoder().encode(JSON.stringify({ app: APP_ID, version: VERSION, ...backup }))
  let binary = ""
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return `JS1-${btoa(binary)}`
}

function parseCity(raw: unknown): City | null {
  if (!raw || typeof raw !== "object") return null
  const c = raw as Partial<City>
  if (typeof c.id !== "string" || !/^\d{4}$/.test(c.id) || typeof c.lokasi !== "string") return null
  const place =
    c.place &&
    typeof c.place.lat === "number" &&
    typeof c.place.lng === "number" &&
    isInIndonesia(c.place.lat, c.place.lng)
      ? { lat: c.place.lat, lng: c.place.lng, kecamatan: String(c.place.kecamatan ?? "").slice(0, 80) }
      : undefined
  return { id: c.id, lokasi: c.lokasi.slice(0, 80), ...(place && { place }) }
}

/** Accepts either a backup file's JSON or a backup code. Throws a readable error. */
export function parseBackup(input: string): Partial<Backup> & { settings: Settings } {
  const text = input.trim()
  let json: string
  if (text.startsWith("JS1-")) {
    try {
      const binary = atob(text.slice(4))
      json = new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)))
    } catch {
      throw new Error("Kode cadangan tidak valid atau terpotong.")
    }
  } else {
    json = text
  }

  let data: Partial<BackupFile>
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error("Format tidak dikenali. Gunakan file .json atau kode yang diawali JS1-.")
  }
  if (data?.app !== APP_ID) throw new Error("Ini bukan cadangan dari aplikasi Jadwal Shalat.")

  return {
    settings: normalizeSettings(data.settings),
    city: parseCity(data.city) ?? undefined,
    soundOn: typeof data.soundOn === "boolean" ? data.soundOn : undefined,
  }
}
