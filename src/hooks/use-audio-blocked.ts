"use client"

import { useSyncExternalStore } from "react"

import { isAudioBlocked, subscribeAudioState } from "@/lib/beep"

/** True while the browser is holding back sound until someone clicks or presses a key. */
export function useAudioBlocked() {
  return useSyncExternalStore(subscribeAudioState, isAudioBlocked, () => false)
}
