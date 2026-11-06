"use client"

import { useEffect, useRef, useState } from "react"
import { LoaderCircleIcon, RefreshCwIcon, SmartphoneIcon, WifiOffIcon } from "lucide-react"
import QRCode from "qrcode"

import { Button } from "@/components/ui/button"
import { useNow } from "@/hooks/use-now"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { correctedNow } from "@/lib/clock"
import { QR_POLL_MS, TV_LINK_KEY, TV_QR_KEY } from "@/lib/layar-config"
import { newKey, newPairToken, pairUrl, parseLayarData, type LayarData, type LayarSnapshot } from "@/lib/layar-data"
import { planQr, qrOutcome, type StoredQr } from "@/lib/layar-pairing"
import { checkLayar, fetchLayar } from "@/lib/layar-public"
import { canonical } from "@/lib/layar-sync"
import { formatDuration } from "@/lib/prayer"
import { cn } from "@/lib/utils"

/** This TV's own key (kept for good) and whether it belongs to a mosque. */
export type TvLink = {
  tvKey: string
  connected: boolean
  version: number | null
  /** The data last agreed on with the server (see lib/layar-sync.ts). */
  synced?: string | null
  /** The photo last agreed on: its path on the server, null for none, undefined when not known yet. */
  photo?: string | null
  /** A photo saved on this TV still has to go to the server. */
  photoPending?: boolean
}

const RETRY_MS = 15_000

type Status =
  | { kind: "loading" }
  | { kind: "showing" }
  | { kind: "stopped" }
  | { kind: "error"; message: string }

function readStored<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as T | null
  } catch {
    return null
  }
}

type Props = {
  /** The TV's current data, offered to the phone so nothing has to be typed again. */
  snapshot: LayarSnapshot | null
  /** A new TV was connected: the mosque's data to use from now on. */
  onConnected: (data: LayarData) => void
  /** A TV that was already connected got another phone. */
  onPhoneAdded?: () => void
  className?: string
}

/**
 * The QR code a phone scans to manage this TV. Survives reloads: the same QR code comes back while it
 * is valid. Renewed automatically for up to an hour, then waits for someone to ask again.
 */
export function PhonePairing({ snapshot, onConnected, onPhoneAdded, className }: Props) {
  const now = useNow()
  const [qr, setQr] = usePersistedState<StoredQr | null>(TV_QR_KEY, null)
  const [, setLink] = usePersistedState<TvLink | null>(TV_LINK_KEY, null)
  const [status, setStatus] = useState<Status>({ kind: "loading" })
  const [image, setImage] = useState<string | null>(null)
  const [restart, setRestart] = useState(0)

  // Read inside the loop, so it always uses the latest without restarting it.
  const latest = useRef({ snapshot, onConnected, onPhoneAdded })
  useEffect(() => {
    latest.current = { snapshot, onConnected, onPhoneAdded }
  })

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let restartNow = restart > 0
    const later = (ms: number) => {
      if (!cancelled) timer = setTimeout(() => void tick(), ms)
    }

    const tick = async () => {
      try {
        let link = readStored<TvLink>(TV_LINK_KEY)
        if (!link?.tvKey) {
          link = { tvKey: newKey(), connected: false, version: null }
          setLink(link)
        }

        let current = readStored<StoredQr>(TV_QR_KEY)
        const plan = planQr(current, correctedNow(), { restart: restartNow })
        restartNow = false
        if (plan.action === "stop") {
          setStatus({ kind: "stopped" })
          return
        }
        if (plan.action === "renew") {
          const pair = newPairToken()
          const res = await fetch("/api/layar/sambung", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pair, tvKey: link.tvKey, snapshot: latest.current.snapshot }),
          })
          const body = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(body.error ?? "Gagal membuat QR.")
          current = { pair, expiresAt: body.expiresAt, firstShownAt: plan.firstShownAt }
          setQr(current)
        }
        if (cancelled || !current) return
        setStatus({ kind: "showing" })

        const check = await checkLayar(link.tvKey)
        if (cancelled) return
        if (!check && link.connected) {
          // The mosque was deleted: this TV is on its own again.
          link = { ...link, connected: false, version: null, synced: null, photo: undefined, photoPending: false }
          setLink(link)
        }
        const outcome = qrOutcome(check ? { connected: true, waiting: check.qrWaiting } : { connected: false }, link.connected, current, correctedNow())

        if (outcome === "used") {
          if (!link.connected) {
            const fetched = await fetchLayar(link.tvKey)
            const data = fetched && parseLayarData(fetched.data)
            if (!fetched || !data) throw new Error("Data dari HP tidak bisa dibaca.")
            setLink({ ...link, connected: true, version: fetched.version, synced: canonical(data) })
            setQr(null)
            latest.current.onConnected(data)
          } else {
            setQr(null)
            latest.current.onPhoneAdded?.()
          }
          return
        }
        later(outcome === "expired" ? 0 : QR_POLL_MS)
      } catch (error) {
        if (cancelled) return
        const offline = error instanceof TypeError
        setStatus({ kind: "error", message: offline ? "Tidak ada koneksi internet." : (error as Error).message })
        later(RETRY_MS)
      }
    }

    void tick()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [restart, setLink, setQr])

  const url = qr && typeof window !== "undefined" ? pairUrl(window.location.origin, qr.pair) : null
  useEffect(() => {
    if (!url) return
    let cancelled = false
    void QRCode.toDataURL(url, { margin: 1, width: 640, errorCorrectionLevel: "M" }).then((data) => {
      if (!cancelled) setImage(data)
    })
    return () => {
      cancelled = true
    }
  }, [url])

  const left = qr && now ? qr.expiresAt - now : 0
  const showQr = status.kind === "showing" && image && left > 0

  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      <p className="flex items-center gap-2 text-lg font-semibold">
        <SmartphoneIcon className="size-5 text-amber-300" /> Atur dari HP
      </p>
      <p className="mt-1 max-w-sm text-sm text-white/70">
        Pindai dengan kamera HP. Setelah itu pengaturan bisa diubah dari HP kapan saja, tanpa menyentuh TV.
      </p>

      <div className="mt-4 grid aspect-square w-full max-w-[min(20rem,42vh)] place-items-center rounded-2xl bg-white p-3">
        {showQr ? (
          // eslint-disable-next-line @next/next/no-img-element -- a generated data URL, nothing to optimise
          <img src={image} alt="QR untuk mengatur layar ini dari HP" className="size-full [image-rendering:pixelated]" />
        ) : status.kind === "stopped" ? (
          <div className="space-y-3 px-4 text-sm text-emerald-950">
            <p>QR disembunyikan karena tidak ada yang memindai selama satu jam.</p>
            <Button onClick={() => setRestart((n) => n + 1)} className="gap-2">
              <RefreshCwIcon /> Tampilkan QR baru
            </Button>
          </div>
        ) : status.kind === "error" ? (
          <div className="space-y-2 px-4 text-sm text-emerald-950">
            <WifiOffIcon className="mx-auto size-8 text-amber-600" />
            <p>{status.message}</p>
            <p className="text-emerald-950/60">Mencoba lagi otomatis.</p>
          </div>
        ) : (
          <LoaderCircleIcon className="size-8 animate-spin text-emerald-900" />
        )}
      </div>

      <p className="mt-3 h-5 text-sm text-white/60 tabular-nums">
        {showQr && `QR berganti otomatis dalam ${formatDuration(left)}`}
      </p>
    </div>
  )
}
