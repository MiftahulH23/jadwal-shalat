"use client"

import { useEffect, useState } from "react"

import { correctedNow, startClockSync } from "@/lib/clock"

/** Current corrected timestamp, re-rendered on every second boundary. `null` until mounted. */
export function useNow() {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const t = correctedNow()
      setNow(t)
      timer = setTimeout(tick, 1000 - (t % 1000) + 5)
    }
    startClockSync()
    tick()
    return () => clearTimeout(timer)
  }, [])

  return now
}
