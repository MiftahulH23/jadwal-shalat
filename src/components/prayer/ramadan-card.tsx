"use client"

import { motion } from "motion/react"
import { MoonIcon, SunsetIcon, UtensilsCrossedIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatHijri, ZONE_TIMEZONES } from "@/lib/format"
import { formatDuration, type WeekSchedule } from "@/lib/prayer"
import { getRamadanState } from "@/lib/ramadan"

type Props = { week: WeekSchedule; now: number; today: string }

export function RamadanCard({ week, now, today }: Props) {
  const state = getRamadanState(week, now, today)
  if (!state) return null
  const tz = ZONE_TIMEZONES[week.zone]
  const { imsak, berbuka, stage, progress } = state

  const tiles = [
    {
      label: "Batas sahur (Imsak)",
      icon: UtensilsCrossedIcon,
      time: imsak.time,
      remaining: imsak.at - now,
      active: stage === "sahur" || stage === "berbuka",
    },
    {
      label: "Waktu berbuka (Maghrib)",
      icon: SunsetIcon,
      time: berbuka.time,
      remaining: berbuka.at - now,
      active: stage === "fasting",
    },
  ]

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border border-gold/30 bg-linear-to-br from-amber-50 via-card to-emerald-50 p-5 shadow-sm sm:p-7 dark:from-amber-950/40 dark:via-card dark:to-emerald-950/40"
    >
      <MoonIcon className="absolute -top-6 -right-6 size-32 rotate-12 fill-gold/10 text-gold/20" />
      <div className="relative flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold tracking-wide text-gold uppercase">Mode Ramadhan</p>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{formatHijri(now, tz)}</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {stage === "fasting"
            ? "Sedang berpuasa, semoga dimudahkan."
            : stage === "berbuka"
              ? "Selamat berbuka puasa."
              : "Waktunya sahur, jangan sampai terlewat."}
        </p>
      </div>

      <div className="relative mt-5 grid gap-3 sm:grid-cols-2">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className={cn(
              "rounded-2xl border bg-card/80 p-4 backdrop-blur transition-shadow",
              tile.active && "border-gold/50 shadow-md ring-2 shadow-gold/10 ring-gold/30"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                <tile.icon className="size-4 text-gold" /> {tile.label}
              </span>
              <span className="font-mono text-sm text-muted-foreground tabular-nums">{tile.time}</span>
            </div>
            <p className="mt-2 font-mono text-4xl font-semibold tracking-tight tabular-nums">
              {formatDuration(tile.remaining)}
            </p>
            <p className="text-xs text-muted-foreground">lagi</p>
          </div>
        ))}
      </div>

      <div className="relative mt-5">
        <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
          <span>Imsak</span>
          <span>Progres puasa hari ini · {Math.round(progress * 100)}%</span>
          <span>Maghrib</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-linear-to-r from-emerald-500 to-amber-400"
            initial={false}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.8 }}
          />
        </div>
      </div>

      <p className="font-arabic relative mt-5 text-center text-lg leading-loose" lang="ar">
        ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوقُ وَثَبَتَ الْأَجْرُ إِنْ شَاءَ اللَّهُ
      </p>
      <p className="relative text-center text-xs text-muted-foreground">
        Doa berbuka: &quot;Telah hilang dahaga, urat-urat telah basah, dan pahala telah ditetapkan, insya Allah.&quot;
      </p>
    </motion.section>
  )
}
