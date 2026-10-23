"use client"

import { useEffect, useRef } from "react"

import { playBeeps, unlockAudioOnGesture } from "@/lib/beep"
import type { PrayerPhase } from "@/lib/prayer"

/** Beeps when adzan time arrives and again when iqamah arrives. */
export function usePhaseBeeps(phase: PrayerPhase | null, locationKey: string, enabled: boolean) {
  useEffect(() => unlockAudioOnGesture(), [])

  const last = useRef<string | null>(null)
  useEffect(() => {
    if (!phase) return
    const id = `${locationKey}|${phase.kind}|${phase.key}|${phase.date}`
    const prev = last.current
    last.current = id
    // Only real transitions, not the first render or a location switch.
    if (!prev || prev.split("|")[0] !== locationKey || prev === id || !enabled) return
    // Entering "iqamah" phase = adzan time; entering "waiting" = iqamah time.
    playBeeps(phase.kind === "iqamah" ? "adzan" : "iqamah")
  }, [phase, locationKey, enabled])
}
