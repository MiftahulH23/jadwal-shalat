"use client"

import { motion } from "motion/react"
import {
  CloudSunIcon,
  MoonIcon,
  MoonStarIcon,
  SunDimIcon,
  SunIcon,
  SunriseIcon,
  SunsetIcon,
  UtensilsCrossedIcon,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  arabicLabel,
  PRAYER_KEYS,
  TIME_KEYS,
  isJumat,
  prayerLabel,
  type DaySchedule,
  type PrayerPhase,
  type TimeKey,
} from "@/lib/prayer"

const ICONS: Record<TimeKey, LucideIcon> = {
  imsak: UtensilsCrossedIcon,
  subuh: MoonStarIcon,
  terbit: SunriseIcon,
  dhuha: SunDimIcon,
  dzuhur: SunIcon,
  ashar: CloudSunIcon,
  maghrib: SunsetIcon,
  isya: MoonIcon,
}

type Props = {
  day: DaySchedule
  isToday: boolean
  phase: PrayerPhase | null
  /** Local "HH:mm" in the city, only meaningful when `isToday`. */
  localTime: string
}

export function DayTimes({ day, isToday, phase, localTime }: Props) {
  const activeKey = isToday && phase?.date === day.date ? phase.key : null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {TIME_KEYS.map((key, i) => {
        const Icon = ICONS[key]
        const isPrayer = (PRAYER_KEYS as readonly string[]).includes(key)
        const isActive = key === activeKey
        const isIqamah = isActive && phase?.kind === "iqamah"
        const passed = isToday && !isActive && day[key] <= localTime

        return (
          <motion.div
            key={`${day.date}-${key}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.35 }}
            whileHover={{ y: -4 }}
            className={cn(
              "group relative overflow-hidden rounded-2xl border bg-card p-4 shadow-sm backdrop-blur transition-shadow hover:shadow-lg",
              !isPrayer && "bg-card/50",
              passed && "opacity-55",
              isActive &&
                (isIqamah
                  ? "border-gold/60 shadow-lg ring-2 shadow-gold/20 ring-gold/50"
                  : "border-primary/50 shadow-lg ring-2 shadow-primary/20 ring-primary/40")
            )}
          >
            {isActive && (
              <span
                className={cn(
                  "absolute top-3 right-3 flex size-2.5",
                  isIqamah ? "text-gold" : "text-primary"
                )}
              >
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-current" />
              </span>
            )}
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-xl transition-transform group-hover:scale-110 group-hover:rotate-6",
                  isPrayer ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  isIqamah && "bg-gold/15 text-gold"
                )}
              >
                <Icon className="size-4.5" />
              </span>
              <div className="leading-tight">
                <p className="font-semibold">{prayerLabel(key, day.date)}</p>
                <p className="font-arabic text-sm text-muted-foreground">{arabicLabel(key, day.date)}</p>
              </div>
            </div>
            <p className="mt-3 font-mono text-3xl font-semibold tracking-tight tabular-nums">{day[key]}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isActive
                ? isIqamah
                  ? isJumat(key, day.date)
                    ? "Ibadah shalat Jumat berlangsung"
                    : "Sedang menunggu iqamah"
                  : "Shalat berikutnya"
                : passed
                  ? "Sudah lewat"
                  : isPrayer
                    ? "Shalat wajib"
                    : "Waktu penanda"}
            </p>
          </motion.div>
        )
      })}
    </div>
  )
}
