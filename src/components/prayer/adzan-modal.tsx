"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "motion/react"
import { BellRingIcon, ClockIcon, MapPinIcon, MoonStarIcon, SparkleIcon, UsersIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useHydrated } from "@/hooks/use-persisted-state"
import { cn } from "@/lib/utils"
import { arabicLabel, formatDuration, prayerLabel, type PrayerKey } from "@/lib/prayer"

export type AdzanAlert = {
  /** "adzan" = prayer time has started; "iqamah" = iqamah is now. */
  kind: "adzan" | "iqamah"
  key: PrayerKey
  date: string
  /** Time of this event, "HH:mm" local. */
  time: string
  zone: string
  location: string
  /** adzan: when iqamah starts. */
  iqamahAt?: number
  /** iqamah: the following prayer. */
  next?: { name: string; time: string }
  /** Set on Fridays: khutbah comes before iqamah. */
  jumat?: { khatib: string; imam: string }
}

const COPY = {
  adzan: {
    arabic: "اللهُ أَكْبَرُ",
    eyebrow: "Telah masuk waktu shalat",
    timeLabel: "Waktu adzan",
    cta: "Baik, saya bersiap",
  },
  iqamah: {
    arabic: "قَدْ قَامَتِ الصَّلَاةُ",
    eyebrow: "Waktunya iqamah shalat",
    timeLabel: "Waktu iqamah",
    cta: "Mari menunaikan shalat",
  },
} as const

const DURATION = 5_000
const PARTICLES = 14

type Props = {
  alert: AdzanAlert | null
  now: number | null
  onClose: () => void
  /** Enlarges the pop-up, e.g. for the mosque TV display. */
  scale?: number
}

export function AdzanModal({ alert, now, onClose, scale = 1 }: Props) {
  // Portal target only exists in the browser.
  const hydrated = useHydrated()
  if (!hydrated) return null

  return createPortal(
    <AnimatePresence>
      {alert && <AdzanCard key={`${alert.kind}-${alert.key}-${alert.date}`} alert={alert} now={now} onClose={onClose} scale={scale} />}
    </AnimatePresence>,
    document.body
  )
}

function AdzanCard({
  alert,
  now,
  onClose,
  scale,
}: {
  alert: AdzanAlert
  now: number | null
  onClose: () => void
  scale: number
}) {
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const elapsed = useRef(0)

  // Auto-close timer that pauses while the pointer or focus is on the card.
  useEffect(() => {
    if (paused) return
    let frame = 0
    let last = performance.now()
    const tick = (t: number) => {
      elapsed.current += t - last
      last = t
      setProgress(Math.min(1, elapsed.current / DURATION))
      if (elapsed.current >= DURATION) onClose()
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [paused, onClose])

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const name = prayerLabel(alert.key, alert.date)
  const copy = COPY[alert.kind]
  const isIqamah = alert.kind === "iqamah"
  const untilIqamah = now && alert.iqamahAt ? alert.iqamahAt - now : 0

  return (
    <div className="fixed inset-0 z-100 grid place-items-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <motion.div
        role="alertdialog"
        // `zoom` scales layout too; shrink max height to match so it still fits the screen.
        style={scale !== 1 ? { zoom: scale, maxHeight: `calc((100dvh - 2rem) / ${scale})` } : undefined}
        aria-modal="true"
        aria-labelledby="adzan-title"
        aria-describedby="adzan-desc"
        initial={{ opacity: 0, scale: 0.8, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        onPointerEnter={(e) => e.pointerType === "mouse" && setPaused(true)}
        onPointerLeave={() => setPaused(false)}
        className={cn(
          "relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-x-hidden overflow-y-auto rounded-[2rem] bg-linear-to-b text-center text-white shadow-2xl ring-1 shadow-emerald-950/60 ring-white/15",
          isIqamah ? "from-amber-700 via-emerald-900 to-teal-950" : "from-emerald-700 via-emerald-900 to-teal-950"
        )}
      >
        <div className="bg-geometric-light pointer-events-none absolute inset-0 opacity-[0.08]" />
        <div className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-amber-300/25 blur-3xl" />

        <Button
          ref={closeRef}
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute top-3 right-3 z-10 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
        >
          <XIcon />
        </Button>

        <div className="relative px-6 pt-10 pb-7 sm:px-10">
          {/* Emblem with ripples and a burst of sparkles */}
          <div className="relative mx-auto grid size-28 place-items-center">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="absolute inset-0 rounded-full border border-amber-200/50"
                initial={{ scale: 0.8, opacity: 0.8 }}
                animate={{ scale: 2.1, opacity: 0 }}
                transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
              />
            ))}
            {Array.from({ length: PARTICLES }, (_, i) => {
              const angle = (i / PARTICLES) * Math.PI * 2
              const dist = 90 + (i % 3) * 22
              return (
                <motion.span
                  key={`p-${i}`}
                  className="absolute text-amber-200"
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                  animate={{
                    x: Math.cos(angle) * dist,
                    y: Math.sin(angle) * dist,
                    opacity: [0, 1, 0],
                    scale: [0.4, 1, 0.6],
                    rotate: 180,
                  }}
                  transition={{ duration: 1.6, delay: 0.25 + (i % 4) * 0.05, ease: "easeOut" }}
                >
                  <SparkleIcon className="size-3 fill-current" />
                </motion.span>
              )
            })}
            <motion.div
              initial={{ rotate: -30, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
              className="relative grid size-24 place-items-center rounded-full bg-linear-to-br from-amber-200 to-amber-500 text-emerald-950 shadow-[0_0_50px_-5px] shadow-amber-300/70"
            >
              {isIqamah ? (
                <UsersIcon className="size-11" strokeWidth={1.75} />
              ) : (
                <MoonStarIcon className="size-11" strokeWidth={1.75} />
              )}
            </motion.div>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="font-arabic mt-6 text-3xl text-amber-100"
            lang="ar"
          >
            {copy.arabic}
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mt-1 text-sm font-medium tracking-[0.2em] text-emerald-100/80 uppercase"
          >
            {copy.eyebrow}
            {alert.jumat && " Jumat"}
          </motion.p>

          <motion.h2
            id="adzan-title"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.45, type: "spring", stiffness: 220, damping: 16 }}
            className="mt-2 bg-linear-to-b from-white to-amber-100 bg-clip-text text-5xl font-extrabold sm:text-6xl tracking-tight text-transparent"
          >
            {name}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
            className="font-arabic text-2xl text-amber-100/90"
            lang="ar"
          >
            {arabicLabel(alert.key, alert.date)}
          </motion.p>

          <motion.div
            id="adzan-desc"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="mt-6 grid grid-cols-2 gap-3"
          >
            <div className="flex flex-col justify-center rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
              <p className="text-xs text-emerald-100/70">{copy.timeLabel}</p>
              <p className="font-mono text-2xl font-semibold tabular-nums">
                {alert.time} <span className="text-sm font-normal text-white/70">{alert.zone}</span>
              </p>
            </div>
            {isIqamah ? (
              <div className="flex flex-col justify-center rounded-2xl bg-amber-300/15 p-3 ring-1 ring-amber-200/25">
                <p className="flex items-center justify-center gap-1 text-xs text-amber-100/80">
                  <ClockIcon className="size-3" /> Berikutnya
                </p>
                <p className="text-sm leading-tight font-semibold text-amber-50">{alert.next?.name ?? "-"}</p>
                <p className="font-mono text-2xl leading-tight font-semibold text-amber-100 tabular-nums">
                  {alert.next?.time ?? "-"}
                </p>
              </div>
            ) : (
              <div className="flex flex-col justify-center rounded-2xl bg-amber-300/15 p-3 ring-1 ring-amber-200/25">
                <p className="flex items-center justify-center gap-1 text-xs text-amber-100/80">
                  <BellRingIcon className="size-3" /> {alert.jumat ? "Khutbah · iqamah dalam" : "Iqamah dalam"}
                </p>
                <p className="font-mono text-2xl font-semibold text-amber-100 tabular-nums">
                  {formatDuration(untilIqamah)}
                </p>
              </div>
            )}
          </motion.div>

          {isIqamah && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75 }}
              className="mt-4 rounded-2xl bg-white/5 px-4 py-3 text-sm text-emerald-50/90 ring-1 ring-white/10"
            >
              Luruskan dan rapatkan shaf, karena lurusnya shaf termasuk kesempurnaan shalat.
            </motion.p>
          )}

          {!isIqamah && alert.jumat && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75 }}
              className="mt-4 rounded-2xl bg-white/5 px-4 py-3 text-sm text-emerald-50/90 ring-1 ring-white/10"
            >
              Khutbah Jumat akan dimulai. Mohon tidak berbicara selama khatib berkhutbah.
            </motion.p>
          )}

          {alert.jumat && (alert.jumat.khatib || alert.jumat.imam) && (
            <p className="mt-3 text-sm text-amber-100/90">
              {[alert.jumat.khatib && `Khatib: ${alert.jumat.khatib}`, alert.jumat.imam && `Imam: ${alert.jumat.imam}`]
                .filter(Boolean)
                .join("  ·  ")}
            </p>
          )}

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-white/70">
            <MapPinIcon className="size-3.5" />
            {alert.location}
          </p>

          <Button
            onClick={onClose}
            className="mt-6 h-11 w-full rounded-full bg-amber-300 font-semibold text-emerald-950 hover:bg-amber-200"
          >
            {copy.cta}
          </Button>
          <p className="mt-2 h-4 text-[11px] text-white/50">
            {paused ? "Dijeda, arahkan kursor keluar untuk melanjutkan" : "Tertutup otomatis"}
          </p>
        </div>

        {/* Auto-close progress */}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
          <div
            className="h-full origin-left bg-amber-300"
            style={{ transform: `scaleX(${1 - progress})` }}
          />
        </div>
      </motion.div>
    </div>
  )
}
