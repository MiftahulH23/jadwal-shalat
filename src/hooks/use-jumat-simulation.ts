"use client"

import { useCallback, useState } from "react"

const SCREEN_MS = 15_000

type Options = {
  now: number | null
  khutbahMinutes: number
  /** From useAdzanAlerts. */
  simulate: (kind: "adzan" | "iqamah", options?: { jumat?: boolean }) => void
  close: () => void
}

/**
 * Jumat simulation: the Jumat adzan pop-up first, then — as soon as it closes —
 * the "Ibadah Shalat Jumat" screen for a short while (or until clicked).
 */
export function useJumatSimulation({ now, khutbahMinutes, simulate, close }: Options) {
  const [sim, setSim] = useState<{ iqamahAt: number; screenUntil?: number } | null>(null)

  const simulateJumat = () => {
    if (!now) return
    simulate("adzan", { jumat: true })
    setSim({ iqamahAt: now + khutbahMinutes * 60_000 })
  }

  // Wraps the pop-up's close: closing the simulated Jumat pop-up reveals the screen.
  const closeAlert = useCallback(() => {
    close()
    setSim((s) => (s && !s.screenUntil ? { ...s, screenUntil: Date.now() + SCREEN_MS } : s))
  }, [close])

  const dismiss = useCallback(() => setSim(null), [])

  const screen = sim?.screenUntil && now && now < sim.screenUntil ? { iqamahAt: sim.iqamahAt } : null

  return { simulateJumat, closeAlert, screen, dismiss }
}
