"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import { toast } from "sonner"

import type { TvLink } from "@/components/prayer/phone-pairing"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { TV_LINK_KEY } from "@/lib/layar-config"
import { parseLayarData, type LayarData } from "@/lib/layar-data"
import { loadBackground, saveBackground } from "@/lib/background"
import { downloadPhoto, sendPhoto } from "@/lib/layar-photo"
import { checkLayar, fetchLayar } from "@/lib/layar-public"
import { canonical, decideSync, SYNC_JITTER_MS, SYNC_MS } from "@/lib/layar-sync"
import type { City } from "@/lib/prayer"
import type { Settings } from "@/lib/settings"

/** Waits a little after a change on the TV, so several quick edits go out as one save. */
const PUSH_DELAY_MS = 3_000
const RETRY_MS = 60_000
const QUICK_CHECK_MS = 15_000

function readLink(): TvLink | null {
  try {
    return JSON.parse(localStorage.getItem(TV_LINK_KEY) ?? "null")
  } catch {
    return null
  }
}

type Options = {
  settings: Settings
  city: City
  /** Puts data from the server into effect on this TV. */
  apply: (data: LayarData) => void
  /** While true (e.g. Pengaturan is open on the TV), changes from a phone wait, so they don't overwrite the form. */
  paused: boolean
}

/**
 * Keeps a TV that is connected to a phone in step with the server: takes changes made on a phone and
 * sends changes made on the TV. Does nothing for a TV that is not connected. The schedule never waits for it.
 */
export function useLayarSync({ settings, city, apply, paused }: Options) {
  const [link, setLink] = usePersistedState<TvLink | null>(TV_LINK_KEY, null)
  const connected = Boolean(link?.connected)
  const local = useMemo(() => canonical({ settings, city }), [settings, city])

  const latest = useRef({ local, apply, paused })
  useEffect(() => {
    latest.current = { local, apply, paused }
  })
  const busy = useRef(false)

  const sync = useCallback(async () => {
    const current = readLink()
    if (!current?.connected || busy.current) return
    busy.current = true
    // Always on top of what is stored now, so one step does not undo another made in the same round.
    const update = (patch: Partial<TvLink>) => setLink({ ...(readLink() ?? current), ...patch })
    try {
      const check = await checkLayar(current.tvKey)
      if (!check) {
        // The mosque was deleted from a phone: this TV carries on with its own settings.
        update({ connected: false, version: null, synced: null, photo: undefined, photoPending: false })
        toast.info("Layar ini tidak lagi terhubung ke HP", { description: "Pengaturan terakhir tetap dipakai." })
        return
      }

      // The photo travels apart from the settings and is recognised by its path on the server.
      if (!latest.current.paused) {
        try {
          const known = readLink() ?? current
          if (known.photoPending) {
            update({ photo: await sendPhoto(current.tvKey, await loadBackground().catch(() => null)), photoPending: false })
          } else if (known.photo === undefined && !check.photo) {
            // Just connected, and the mosque has no photo yet: this TV's own photo, if any, becomes it.
            const own = await loadBackground().catch(() => null)
            update({ photo: own ? await sendPhoto(current.tvKey, own) : null })
          } else if (known.photo !== check.photo) {
            await saveBackground(check.photo ? await downloadPhoto(check.photo) : null)
            update({ photo: check.photo })
          }
        } catch {
          // Tried again at the next check; the settings below still go through.
        }
      }

      const step = decideSync({ version: current.version, synced: current.synced ?? null }, check.version, latest.current.local)
      const pull = async (lostLocal: boolean) => {
        if (latest.current.paused) return
        const fetched = await fetchLayar(current.tvKey)
        const data = fetched && parseLayarData(fetched.data)
        if (!fetched || !data) return
        // Recorded before applying, so applying is not mistaken for a change made on the TV.
        update({ version: fetched.version, synced: canonical(data) })
        latest.current.apply(data)
        if (lostLocal) {
          toast.warning("Pengaturan diperbarui dari HP", {
            description: "Perubahan yang dibuat di TV ini tidak terkirim karena ada perubahan lebih baru dari HP.",
          })
        } else {
          toast.success("Pengaturan diperbarui dari HP")
        }
      }

      if (step.action === "pull") {
        await pull(step.lostLocal)
        return
      }

      if (step.action === "push" && current.version !== null) {
        const sending = latest.current.local
        const res = await fetch("/api/layar/data", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${current.tvKey}` },
          body: JSON.stringify({ data: JSON.parse(sending!), baseVersion: current.version }),
        })
        if (res.ok) {
          const { version } = await res.json()
          update({ version, synced: sending })
        } else if (res.status === 409) {
          // A phone saved first: its data wins.
          await pull(true)
        }
      }
    } catch {
      // Offline or the server is down: the TV keeps running and tries again later.
    } finally {
      busy.current = false
    }
  }, [setLink])

  // Regular checks, and right away when the screen comes back or the internet returns.
  useEffect(() => {
    if (!connected) return
    let timer: ReturnType<typeof setTimeout>
    const schedule = (ms: number) => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        void sync().finally(() => schedule(SYNC_MS + (Math.random() * 2 - 1) * SYNC_JITTER_MS))
      }, ms)
    }
    schedule(0)
    const now = () => schedule(0)
    const onVisible = () => document.visibilityState === "visible" && now()
    window.addEventListener("online", now)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("online", now)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [connected, sync])

  // A change made on this TV goes out shortly after.
  const synced = link?.synced ?? null
  useEffect(() => {
    if (!connected || paused || local === synced) return
    const timer = setTimeout(() => void sync(), PUSH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [connected, paused, local, synced, sync])

  // A phone change held back while Pengaturan was open follows as soon as it closes.
  const wasPaused = useRef(paused)
  useEffect(() => {
    if (wasPaused.current && !paused && connected) void sync()
    wasPaused.current = paused
  }, [paused, connected, sync])

  // Failed sends are retried while something is still waiting to go out.
  useEffect(() => {
    if (!connected || local === synced) return
    const timer = setInterval(() => void sync(), RETRY_MS)
    return () => clearInterval(timer)
  }, [connected, local, synced, sync])

  /** Checks now, e.g. when someone at the TV presses a key after saving on a phone. At most every 15 seconds. */
  const lastQuick = useRef(0)
  const syncSoon = useCallback(() => {
    if (!connected || Date.now() - lastQuick.current < QUICK_CHECK_MS) return
    lastQuick.current = Date.now()
    void sync()
  }, [connected, sync])

  /** A photo was saved in Pengaturan on this TV: send it, or send it later if that fails. */
  const pushPhoto = useCallback(
    async (photo: Blob | null) => {
      const current = readLink()
      if (!current?.connected) return
      try {
        const path = await sendPhoto(current.tvKey, photo)
        setLink({ ...(readLink() ?? current), photo: path, photoPending: false })
      } catch {
        setLink({ ...(readLink() ?? current), photoPending: true })
        toast.warning("Foto belum terkirim ke server", { description: "Dikirim otomatis saat internet tersambung." })
      }
    },
    [setLink]
  )

  return { connected, syncSoon, pushPhoto }
}
