"use client"

import { useEffect, useState } from "react"

import { loadBackground, subscribeBackground } from "@/lib/background"

/** Object URL of the stored background photo, or null when there is none. */
export function useBackgroundPhoto() {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let current: string | null = null
    const load = async () => {
      // Storage may be blocked (private window); the display then uses its normal backdrop.
      const blob = await loadBackground().catch(() => null)
      if (!active) return
      const next = blob ? URL.createObjectURL(blob) : null
      setUrl(next)
      if (current) URL.revokeObjectURL(current)
      current = next
    }
    void load()
    const unsubscribe = subscribeBackground(() => void load())
    return () => {
      active = false
      unsubscribe()
      if (current) URL.revokeObjectURL(current)
    }
  }, [])

  return url
}
