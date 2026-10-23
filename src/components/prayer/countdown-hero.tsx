"use client"

import { useId } from "react"

import { AnimatePresence, motion } from "motion/react"
import { BellRingIcon, ClockIcon, LocateFixedIcon, MapPinIcon, MoonIcon, SparklesIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatClock, formatHijri, formatLongDate, ZONE_TIMEZONES } from "@/lib/format"
import {
  arabicLabel,
  isJumat,
  pad,
  prayerLabel,
  prettyCity,
  splitDuration,
  type PrayerPhase,
  type WeekSchedule,
} from "@/lib/prayer"

type Props = {
  week: WeekSchedule
  now: number
  phase: PrayerPhase | null
  /** Set when the schedule is calculated for the user's GPS location. */
  kecamatan?: string
}

/** Slides each changed character in from above, like a flip clock. */
function RollingText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn("inline-flex overflow-hidden tabular-nums", className)} aria-hidden>
      {text.split("").map((char, i) => (
        // Re-keying on the character remounts it, replaying the enter animation.
        <span
          key={`${i}-${char}`}
          className="inline-block animate-in duration-300 ease-out fade-in slide-in-from-top-3"
        >
          {char}
        </span>
      ))}
    </span>
  )
}

function ProgressRing({ progress, iqamah }: { progress: number; iqamah: boolean }) {
  const glowId = useId()
  const r = 44
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90 overflow-visible" aria-hidden>
      <defs>
        {/* Glow filter with an explicit region so the blur is never clipped to a box. */}
        <filter id={glowId} filterUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="120">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="50" cy="50" r={r} fill="none" strokeWidth="3" className="stroke-white/10" />
      <motion.circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={false}
        animate={{ strokeDashoffset: c * (1 - progress) }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        filter={`url(#${glowId})`}
        className={cn("transition-[stroke] duration-1000", iqamah ? "stroke-gold" : "stroke-emerald-300")}
      />
    </svg>
  )
}

export function CountdownHero({ week, now, phase, kecamatan }: Props) {
  const tz = ZONE_TIMEZONES[week.zone]
  const isIqamah = phase?.kind === "iqamah"
  const khutbah = isIqamah && isJumat(phase.key, phase.date)
  const remaining = phase ? phase.end - now : 0
  const progress = phase ? Math.min(1, Math.max(0, (now - phase.start) / (phase.end - phase.start))) : 0
  const { hours, minutes, seconds } = splitDuration(remaining)
  const name = phase ? prayerLabel(phase.key, phase.date) : ""
  const targetTime = phase
    ? formatClock(phase.end, tz).slice(0, 5)
    : ""

  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-3xl text-white shadow-2xl ring-1 ring-white/10 transition-colors duration-1000",
        isIqamah
          ? "bg-linear-to-br from-amber-700 via-emerald-900 to-teal-950 shadow-amber-900/30"
          : "bg-linear-to-br from-emerald-700 via-emerald-900 to-teal-950 shadow-emerald-900/30"
      )}
    >
      {/* Decorative layers */}
      <div className="bg-geometric-light absolute inset-0 -z-10 opacity-[0.07]" />
      <div className="absolute -top-24 -right-24 -z-10 size-72 rounded-full bg-emerald-400/20 blur-3xl" />
      <div
        className={cn(
          "absolute -bottom-32 -left-20 -z-10 size-80 rounded-full blur-3xl transition-colors duration-1000",
          isIqamah ? "bg-amber-400/30" : "bg-teal-400/15"
        )}
      />
      <MoonIcon className="animate-float-slow absolute top-6 right-8 -z-10 size-16 fill-amber-200/80 text-amber-200/80 sm:size-20" />
      {[
        "top-10 left-[45%]",
        "top-24 right-40",
        "bottom-16 left-[30%]",
        "top-1/2 right-16",
        "bottom-8 right-1/3",
      ].map((pos, i) => (
        <SparklesIcon
          key={pos}
          className={cn("animate-twinkle absolute -z-10 size-3 text-amber-100", pos)}
          style={{ animationDelay: `${i * 0.6}s` }}
        />
      ))}

      <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
        {/* Clock & date */}
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="gap-1.5 border-white/15 bg-white/10 px-3 py-1 text-white backdrop-blur">
              {kecamatan ? <LocateFixedIcon className="size-3.5" /> : <MapPinIcon className="size-3.5" />}
              {kecamatan ? `Kec. ${kecamatan}, ` : ""}
              {prettyCity(week.lokasi)}
            </Badge>
            <Badge className="border-white/15 bg-white/10 px-3 py-1 text-white/80 backdrop-blur">
              {prettyCity(week.daerah)} · {week.zone}
            </Badge>
            {week.source === "koordinat" && (
              <Badge className="border-amber-200/30 bg-amber-300/15 px-3 py-1 text-amber-100 backdrop-blur">
                Titik GPS{week.elevation ? ` · ${Math.round(week.elevation)} mdpl` : ""}
              </Badge>
            )}
          </div>

          <div>
            <p className="text-sm font-medium tracking-wide text-emerald-100/70 uppercase">Waktu setempat</p>
            <p className="font-mono text-5xl font-semibold tracking-tight sm:text-7xl">
              <RollingText text={formatClock(now, tz)} />
              <span className="sr-only">{formatClock(now, tz)}</span>
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-lg font-semibold sm:text-xl">{formatLongDate(now, tz)}</p>
            <p className="text-amber-100/90">{formatHijri(now, tz)}</p>
          </div>
        </div>

        {/* Countdown */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative grid size-64 place-items-center sm:size-72">
            <ProgressRing progress={progress} iqamah={isIqamah} />
            <div className="absolute inset-7 rounded-full bg-black/15 ring-1 ring-white/10" />
            <AnimatePresence mode="wait">
              {phase && (
                <motion.div
                  key={`${phase.kind}-${phase.key}-${phase.date}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4 }}
                  className="relative flex flex-col items-center text-center"
                  aria-live="polite"
                >
                  <span
                    className={cn(
                      "mb-1 inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold tracking-wider uppercase",
                      isIqamah ? "animate-pulse bg-gold text-gold-foreground" : "bg-white/15 text-emerald-50"
                    )}
                  >
                    {isIqamah ? <BellRingIcon className="size-3" /> : <ClockIcon className="size-3" />}
                    {khutbah ? "Ibadah Shalat Jumat" : isIqamah ? "Menuju iqamah" : "Shalat berikutnya"}
                  </span>
                  <span className="font-arabic text-2xl leading-tight text-amber-100">
                    {arabicLabel(phase.key, phase.date)}
                  </span>
                  <span className="text-2xl font-bold">{name}</span>
                  <span className="mt-2 font-mono text-4xl font-semibold tracking-tight sm:text-5xl">
                    <RollingText
                      text={hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`}
                    />
                  </span>
                  <span className="mt-1 text-xs text-white/70">
                    {isIqamah ? `${khutbah ? "Perkiraan iqamah" : "Iqamah"} pukul ${targetTime}` : `Adzan pukul ${targetTime}`}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={isIqamah ? "iqamah" : "waiting"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="max-w-xs text-center text-sm text-white/80"
            >
              {isIqamah
                ? khutbah
                  ? "Ibadah shalat Jumat sedang berlangsung. Mohon tidak berbicara selama khutbah dan senyapkan telepon genggam."
                  : `Waktu ${name} telah tiba. Bersiaplah, iqamah ${Math.round((phase.end - phase.start) / 60_000)} menit setelah adzan.`
                : "Jagalah shalat lima waktu, sesungguhnya shalat itu tiang agama."}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
