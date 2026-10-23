"use client"

import { useEffect, useState } from "react"

/** Current timestamp, re-rendered on every second boundary. `null` until mounted. */
export function useNow() {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const t = Date.now()
      setNow(t)
      timer = setTimeout(tick, 1000 - (t % 1000) + 5)
    }
    tick()
    return () => clearTimeout(timer)
  }, [])

  return now
}
