"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import {
  ArrowLeftIcon,
  BellRingIcon,
  ClockIcon,
  ExpandIcon,
  LandmarkIcon,
  MoonStarIcon,
  ShrinkIcon,
  SmartphoneIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { AdzanModal } from "@/components/prayer/adzan-modal"
import { IbadahJumatScreen, jumatPeople } from "@/components/prayer/ibadah-jumat-screen"
import { OfflineNotice } from "@/components/prayer/offline-notice"
import { SettingsDialog } from "@/components/prayer/settings-dialog"
import { useAdzanAlerts } from "@/hooks/use-adzan-alerts"
import { useJumatSimulation } from "@/hooks/use-jumat-simulation"
import { useNow } from "@/hooks/use-now"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { usePhaseBeeps } from "@/hooks/use-phase-beeps"
import { SOUND_KEY, useSchedule } from "@/hooks/use-schedule"
import { playBeeps } from "@/lib/beep"
import { formatClock, formatHijri, formatLongDate, ZONE_TIMEZONES } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  arabicLabel,
  dateAtOffset,
  formatDuration,
  getPrayerPhase,
  isJumat,
  prayerLabel,
  locationLabel,
  type TimeKey,
} from "@/lib/prayer"
import { getRamadanState } from "@/lib/ramadan"
import type { parseBackup } from "@/lib/backup"
import { isRamadan, splitRunningText } from "@/lib/settings"

const BOARD_KEYS: TimeKey[] = ["imsak", "subuh", "terbit", "dzuhur", "ashar", "maghrib", "isya"]
const DEFAULT_RUNNING_TEXT =
  "Luruskan dan rapatkan shaf, karena lurusnya shaf termasuk kesempurnaan shalat; Mohon nonaktifkan atau senyapkan telepon genggam selama berada di masjid"

/** Keeps the screen awake while the display is open (where supported). */
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    const request = async () => {
      try {
        lock = (await navigator.wakeLock?.request("screen")) ?? null
      } catch {
        // Not supported or denied (e.g. low battery); the display still works.
      }
    }
    const onVisible = () => document.visibilityState === "visible" && void request()
    void request()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      void lock?.release().catch(() => {})
    }
  }, [])
}

/**
 * Endless right-to-left running text. Moved with requestAnimationFrame, writing the
 * transform directly, so it doesn't depend on global CSS or on React re-renders.
 */
function RunningText({ items }: { items: string[] }) {
  const ref = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const speed = 110 // px per second, comfortable reading speed
    const start = performance.now()
    let frame = 0
    const tick = (t: number) => {
      // Measured every frame so resizes and font loading are picked up.
      const viewport = el.parentElement?.clientWidth ?? window.innerWidth
      const distance = viewport + el.scrollWidth
      const x = viewport - ((((t - start) / 1000) * speed) % distance)
      el.style.transform = `translateX(${x}px)`
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [items])

  return (
    <p
      ref={ref}
      className="w-max text-[min(2vw,3.4vh)] whitespace-nowrap text-amber-100 will-change-transform"
      style={{ transform: "translateX(100vw)" }}
    >
      {items.map((item, i) => (
        <span key={i}>
          {i > 0 && (
            // Divider between sentences (written with ";" in Pengaturan > Layar).
            <span aria-hidden className="mx-[2.5vw] inline-block align-middle text-[0.8em] text-amber-300/70">
              ✦
            </span>
          )}
          {item}
        </span>
      ))}
    </p>
  )
}

/** Shows on-screen controls while the mouse moves, hides them after a few seconds. */
function useIdleControls(delay = 3_000) {
  const [visible, setVisible] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const poke = useCallback(() => {
    setVisible(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setVisible(false), delay)
  }, [delay])
  useEffect(() => {
    timer.current = setTimeout(() => setVisible(false), delay)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [delay])
  return [visible, poke] as const
}

export function MosqueDisplay() {
  const now = useNow()
  const { city, setCity, locationKey, week, offline, error, settings, setSettings } = useSchedule()
  const [soundOn, setSoundOn] = usePersistedState(SOUND_KEY, true)
  const [controlsVisible, pokeControls] = useIdleControls()
  const [fullscreen, setFullscreen] = useState(false)

  useWakeLock()

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.().catch(() => {})
  }

  const phase = useMemo(
    () => (week && now ? getPrayerPhase(week, now, settings.iqamah, settings.jumat.khutbahMinutes) : null),
    [week, now, settings.iqamah, settings.jumat.khutbahMinutes]
  )
  usePhaseBeeps(phase, locationKey, soundOn)
  // Sentences are separated with ";" in Pengaturan > Layar.
  const runningItems = useMemo(
    () => splitRunningText(settings.runningText.trim() || DEFAULT_RUNNING_TEXT),
    [settings.runningText]
  )

  const restoreBackup = (backup: ReturnType<typeof parseBackup>) => {
    setSettings(backup.settings)
    if (backup.city) setCity(backup.city)
    if (backup.soundOn !== undefined) setSoundOn(backup.soundOn)
  }
  const { alert, close: closeAlert, simulate } = useAdzanAlerts({
    week,
    now,
    phase,
    city,
    locationKey,
    settings,
    soundOn,
    quietJumatIqamah: true,
    locationOverride: settings.mosqueAddress.trim(),
  })
  const { simulateJumat, closeAlert: closeAlertWithJumat, screen: jumatPreview, dismiss: dismissJumatPreview } =
    useJumatSimulation({ now, khutbahMinutes: settings.jumat.khutbahMinutes, simulate, close: closeAlert })

  if (error) {
    return (
      <div className="grid h-dvh place-items-center bg-[#04110f] p-8 text-center text-white">
        <div>
          <p className="text-3xl font-bold">Jadwal tidak dapat dimuat</p>
          <p className="mt-2 text-white/60">{error}. Mencoba lagi otomatis setiap 2 menit dan saat internet kembali.</p>
        </div>
      </div>
    )
  }

  if (!week || !now || !phase) {
    return (
      <div className="grid h-dvh place-items-center bg-[#04110f] text-white">
        <MoonStarIcon className="size-16 animate-pulse text-amber-200" />
      </div>
    )
  }

  const tz = ZONE_TIMEZONES[week.zone]
  const today = dateAtOffset(now, week.utcOffset)
  const day = week.days.find((d) => d.date === today) ?? week.days[0]
  const clock = formatClock(now, tz)
  const name = prayerLabel(phase.key, phase.date)

  // After iqamah, show a quiet "prayer in progress" screen for a while.
  const praying =
    phase.kind === "waiting" && phase.prev && now - phase.start < settings.prayingMinutes * 60_000 ? phase.prev : null
  const ramadan = isRamadan(settings.ramadan, now, tz) ? getRamadanState(week, now, today) : null
  // The mosque address from settings, or the selected city / GPS location.
  const location = settings.mosqueAddress.trim() || locationLabel(city, week)

  const isIqamah = phase.kind === "iqamah"
  // On Friday, the time between the Jumat adzan and iqamah is the khutbah.
  const khutbah = isIqamah && isJumat(phase.key, phase.date)
  // Friday: one continuous "Ibadah Shalat Jumat" screen from the adzan, through khutbah, until the prayer ends.
  const jumatPraying = Boolean(praying && isJumat(praying.key, praying.date))
  const people = jumatPeople(settings.jumat)
  // Scale the pop-up with the screen (designed for ~720px tall), e.g. 1.4x on a 1080p TV.
  const popupScale = Math.min(1.8, Math.max(1, (window.innerHeight - 40) / 720))

  return (
    <div
      onPointerMove={pokeControls}
      className={cn(
        "relative flex h-dvh flex-col overflow-hidden bg-[#04110f] text-white select-none",
        !controlsVisible && "cursor-none"
      )}
    >
      {/* Backdrop */}
      <div className="bg-geometric-light pointer-events-none absolute inset-0 opacity-[0.05]" />
      <div
        className={cn(
          "pointer-events-none absolute -top-1/3 left-1/2 aspect-square w-[80vw] -translate-x-1/2 rounded-full blur-3xl transition-colors duration-1000",
          isIqamah ? "bg-amber-500/20" : "bg-emerald-500/15"
        )}
      />

      {/* Header: mosque name + clock */}
      <header className="relative flex items-start justify-between gap-[2vw] px-[3vw] pt-[2.5vh]">
        <div className="flex min-w-0 items-center gap-[1.2vw]">
          <span className="grid aspect-square w-[min(6vw,9vh)] shrink-0 place-items-center rounded-[1.2vw] bg-linear-to-br from-amber-200 to-amber-500 text-emerald-950">
            <MoonStarIcon className="size-1/2" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[min(3.2vw,5.5vh)] leading-tight font-bold">
              {settings.mosqueName || "Jadwal Shalat"}
            </p>
            <p className="truncate text-[min(1.6vw,2.8vh)] text-emerald-100/70">
              {location} · {week.zone}
            </p>
            {offline && (
              <div className="mt-[0.8vh]">
                <OfflineNotice status={offline} variant="tv" />
              </div>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-[min(6.5vw,11vh)] leading-none font-bold tabular-nums">
            {clock.slice(0, 5)}
            <span className="text-[0.5em] text-emerald-200/70">:{clock.slice(6)}</span>
          </p>
          <p className="mt-[0.6vh] text-[min(1.6vw,2.8vh)] font-medium">{formatLongDate(now, tz)}</p>
          <p className="text-[min(1.5vw,2.6vh)] text-amber-200/90">{formatHijri(now, tz)}</p>
        </div>
      </header>

      {/* Main state */}
      <main className="relative grid flex-1 place-items-center px-[3vw]">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${phase.kind}-${phase.key}-${phase.date}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <p
              className={cn(
                "inline-flex items-center gap-[0.6vw] rounded-full px-[1.5vw] py-[0.6vh] text-[min(1.8vw,3.2vh)] font-semibold tracking-[0.2em] uppercase",
                isIqamah ? "bg-amber-400 text-emerald-950" : "bg-white/10 text-emerald-100"
              )}
            >
              {isIqamah ? <BellRingIcon className="size-[1em]" /> : <ClockIcon className="size-[1em]" />}
              {isIqamah ? `Menuju iqamah ${name}` : `Menuju waktu ${name}`}
            </p>
            <p className="font-arabic mt-[1vh] text-[min(4vw,7vh)] leading-tight text-amber-100" lang="ar">
              {arabicLabel(phase.key, phase.date)}
            </p>
            <p
              className={cn(
                "font-mono text-[min(15vw,26vh)] leading-none font-bold tracking-tight tabular-nums",
                isIqamah && "text-amber-200"
              )}
            >
              {formatDuration(phase.end - now)}
            </p>
            <p className="mt-[1.5vh] text-[min(2vw,3.4vh)] text-white/75">
              {isIqamah
                ? "Luruskan dan rapatkan shaf"
                : `Adzan ${name} pukul ${formatClock(phase.end, tz).slice(0, 5)}`}
            </p>
            {people && isJumat(phase.key, phase.date) && (
              <p className="mt-[1vh] text-[min(1.9vw,3.2vh)] text-amber-100">{people}</p>
            )}
            {ramadan && (
              <p className="mt-[1.5vh] text-[min(1.8vw,3vh)] text-amber-200">
                Ramadhan · Imsak {ramadan.imsak.time} ({formatDuration(ramadan.imsak.at - now)}) · Berbuka{" "}
                {ramadan.berbuka.time} ({formatDuration(ramadan.berbuka.at - now)})
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Board of today's times */}
      <section className="relative grid grid-cols-7 gap-[0.8vw] px-[3vw] pb-[2vh]">
        {BOARD_KEYS.map((key) => {
          const active = key === phase.key && phase.date === day.date
          return (
            <div
              key={key}
              className={cn(
                "rounded-[1.2vw] border px-[0.8vw] py-[1.6vh] text-center transition-colors duration-700",
                active
                  ? isIqamah
                    ? "border-amber-300/60 bg-amber-400/20"
                    : "border-emerald-300/50 bg-emerald-400/15"
                  : "border-white/10 bg-white/[0.04]"
              )}
            >
              <p className="text-[min(1.7vw,3vh)] font-semibold text-emerald-50/90">{prayerLabel(key, day.date)}</p>
              <p className="font-mono text-[min(3.6vw,6.2vh)] leading-tight font-bold tabular-nums">{day[key]}</p>
            </div>
          )
        })}
      </section>

      {/* Running text */}
      <footer className="relative overflow-hidden border-t border-white/10 bg-emerald-950/80 py-[1.4vh]">
        <RunningText items={runningItems} />
      </footer>

      {/* Friday: "Ibadah Shalat Jumat" replaces the iqamah countdown and the prayer screen */}
      <IbadahJumatScreen
        show={khutbah || jumatPraying || Boolean(jumatPreview)}
        clock={clock.slice(0, 5)}
        iqamahTime={
          jumatPreview
            ? formatClock(jumatPreview.iqamahAt, tz).slice(0, 5)
            : khutbah
              ? formatClock(phase.end, tz).slice(0, 5)
              : undefined
        }
        people={people}
        preview={Boolean(jumatPreview)}
        onClose={dismissJumatPreview}
        className="absolute inset-0 z-20"
      />

      {/* Prayer in progress */}
      <AnimatePresence>
        {praying && !jumatPraying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 z-20 grid place-items-center bg-black text-center"
          >
            <div>
              <p className="font-arabic text-[min(5vw,8vh)] text-amber-100/80" lang="ar">
                {arabicLabel(praying.key, praying.date)}
              </p>
              <p className="text-[min(4vw,7vh)] font-bold text-white/85">
                Shalat {prayerLabel(praying.key, praying.date)} sedang berlangsung
              </p>
              <p className="mt-[3vh] inline-flex items-center gap-[0.8vw] text-[min(2vw,3.4vh)] text-white/50">
                <SmartphoneIcon className="size-[1.2em]" /> Mohon senyapkan telepon genggam
              </p>
              <p className="mt-[4vh] font-mono text-[min(3vw,5vh)] text-white/30 tabular-nums">{clock.slice(0, 5)}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* On-screen controls (auto-hide) */}
      <div
        className={cn(
          "absolute top-4 left-1/2 z-30 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-3xl border border-white/10 bg-black/60 p-1.5 backdrop-blur transition-opacity duration-500",
          controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <Button variant="ghost" className="gap-2 rounded-full text-white hover:bg-white/10 hover:text-white" render={<Link href="/" />} nativeButton={false}>
          <ArrowLeftIcon /> Keluar
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-white hover:bg-white/10 hover:text-white"
          aria-label={soundOn ? "Matikan suara" : "Nyalakan suara"}
          onClick={() => {
            setSoundOn(!soundOn)
            if (!soundOn) playBeeps("test")
          }}
        >
          {soundOn ? <Volume2Icon /> : <VolumeXIcon />}
        </Button>
        <SettingsDialog
          settings={settings}
          onSave={setSettings}
          ramadanNow={isRamadan("auto", now, tz)}
          backup={{ city, soundOn }}
          onRestore={restoreBackup}
        />
        <span className="mx-1 h-6 w-px bg-white/15" />
        <Button
          variant="ghost"
          className="gap-2 rounded-full text-emerald-200 hover:bg-emerald-400/15 hover:text-emerald-100"
          onClick={() => simulate("adzan")}
        >
          <MoonStarIcon /> Simulasi adzan
        </Button>
        <Button
          variant="ghost"
          className="gap-2 rounded-full text-amber-200 hover:bg-amber-400/15 hover:text-amber-100"
          onClick={() => simulate("iqamah")}
        >
          <BellRingIcon /> Simulasi iqamah
        </Button>
        <Button
          variant="ghost"
          className="gap-2 rounded-full text-teal-200 hover:bg-teal-400/15 hover:text-teal-100"
          onClick={simulateJumat}
        >
          <LandmarkIcon /> Simulasi Jumat
        </Button>
        <span className="mx-1 h-6 w-px bg-white/15" />
        <Button
          variant="ghost"
          className="gap-2 rounded-full text-white hover:bg-white/10 hover:text-white"
          onClick={toggleFullscreen}
        >
          {fullscreen ? <ShrinkIcon /> : <ExpandIcon />} {fullscreen ? "Keluar layar penuh" : "Layar penuh"}
        </Button>
      </div>

      {/* Adzan / iqamah pop-up, enlarged for TV screens */}
      <AdzanModal alert={alert} now={now} onClose={closeAlertWithJumat} scale={popupScale} />
    </div>
  )
}
