// When the TV may reuse, renew or must stop asking for QR codes. No React, so it can be tested.

import { QR_RENEW_FOR_MS } from "@/lib/layar-config"

/** A QR code the TV is showing, kept in localStorage so a reload shows the same one. */
export type StoredQr = { pair: string; expiresAt: number; firstShownAt: number }

/** Below this, a stored QR code is not worth showing: it would expire while being scanned. */
const MIN_LEFT_MS = 60_000

export type QrPlan =
  | { action: "reuse" }
  /** Ask for a new QR code; firstShownAt is kept within one session of showing QR codes. */
  | { action: "renew"; firstShownAt: number }
  /** The TV has been showing QR codes for an hour: stop until someone asks again. */
  | { action: "stop" }

/**
 * Decides what to do with the stored QR code. A session of showing QR codes ends when none was
 * shown for a while (more than one QR lifetime), so leaving the screen and coming back later starts over.
 */
export function planQr(stored: StoredQr | null, now: number, { restart = false } = {}): QrPlan {
  if (!restart && stored && stored.expiresAt - now > MIN_LEFT_MS) return { action: "reuse" }
  const lifetime = stored ? stored.expiresAt - stored.firstShownAt : 0
  const sessionOver = !stored || restart || now - stored.expiresAt > Math.max(lifetime, 15 * 60_000)
  if (sessionOver) return { action: "renew", firstShownAt: now }
  if (now - stored.firstShownAt >= QR_RENEW_FOR_MS) return { action: "stop" }
  return { action: "renew", firstShownAt: stored.firstShownAt }
}

/** What the TV's check says about its QR code. */
export type QrCheck =
  /** The key belongs to a mosque and no QR code is waiting any more: it was used (or has expired). */
  | { connected: true; waiting: boolean }
  /** Not connected yet. */
  | { connected: false }

export type QrOutcome = "waiting" | "used" | "expired"

/**
 * Whether the QR code was scanned. A new TV learns it when its key starts to belong to a mosque;
 * a connected TV when its QR code stops waiting before it expired.
 */
export function qrOutcome(check: QrCheck, wasConnected: boolean, qr: StoredQr, now: number): QrOutcome {
  if (!check.connected) return now >= qr.expiresAt ? "expired" : "waiting"
  if (!wasConnected) return "used"
  if (check.waiting) return "waiting"
  return now < qr.expiresAt ? "used" : "expired"
}
