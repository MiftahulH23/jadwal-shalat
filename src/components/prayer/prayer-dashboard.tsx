"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import {
  BellIcon,
  BellOffIcon,
  CalendarDaysIcon,
  CalendarRangeIcon,
  ChevronRightIcon,
  MonitorIcon,
  MoonStarIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { CityPicker } from "@/components/prayer/city-picker"
import { AdzanModal } from "@/components/prayer/adzan-modal"
import { CountdownHero } from "@/components/prayer/countdown-hero"
import { DayTimes } from "@/components/prayer/day-times"
import { IbadahJumatScreen, jumatPeople } from "@/components/prayer/ibadah-jumat-screen"
import { OfflineNotice } from "@/components/prayer/offline-notice"
import { RamadanCard } from "@/components/prayer/ramadan-card"
import { SettingsDialog } from "@/components/prayer/settings-dialog"
import { SimulationPanel } from "@/components/prayer/simulation-panel"
import { ThemeToggle } from "@/components/prayer/theme-toggle"
import { WeekTable } from "@/components/prayer/week-table"
import { useNow } from "@/hooks/use-now"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { useAdzanAlerts } from "@/hooks/use-adzan-alerts"
import { useJumatSimulation } from "@/hooks/use-jumat-simulation"
import { usePhaseBeeps } from "@/hooks/use-phase-beeps"
import { SOUND_KEY, useSchedule } from "@/hooks/use-schedule"
import { playBeeps } from "@/lib/beep"
import { formatClock, formatScheduleDate, ZONE_TIMEZONES } from "@/lib/format"
import type { parseBackup } from "@/lib/backup"
import { isRamadan } from "@/lib/settings"
import { cn } from "@/lib/utils"
import {
  dateAtOffset,
  formatDuration,
  getPrayerPhase,
  isFriday,
  prayerLabel,
} from "@/lib/prayer"

export function PrayerDashboard() {
  const now = useNow()
  const { city, setCity, locationKey, week, offline, savedAt, error, reload, settings, setSettings } = useSchedule()
  const [soundOn, setSoundOn] = usePersistedState(SOUND_KEY, true)
  const [selected, setSelected] = useState<string | null>(null)
  const place = city.place

  const today = week && now ? dateAtOffset(now, week.utcOffset) : null
  const tz = week ? ZONE_TIMEZONES[week.zone] : "Asia/Jakarta"
  const ramadan = now ? isRamadan(settings.ramadan, now, tz) : false
  const ramadanAuto = now ? isRamadan("auto", now, tz) : false

  const phase = useMemo(
    () => (week && now ? getPrayerPhase(week, now, settings.iqamah, settings.jumat.khutbahMinutes) : null),
    [week, now, settings.iqamah, settings.jumat.khutbahMinutes]
  )

  usePhaseBeeps(phase, locationKey, soundOn)

  const restoreBackup = (backup: ReturnType<typeof parseBackup>) => {
    setSettings(backup.settings)
    if (backup.city) setCity(backup.city)
    if (backup.soundOn !== undefined) setSoundOn(backup.soundOn)
  }

  // Lets the user see each pop-up without waiting for the real prayer time.
  const { alert, close: closeAlert, simulate: showPreview } = useAdzanAlerts({
    week,
    now,
    phase,
    city,
    locationKey,
    settings,
    soundOn,
  })
  // Jumat simulation: pop-up first, then the full "Ibadah Shalat Jumat" screen.
  const { simulateJumat, closeAlert: closeAlertWithJumat, screen: jumatPreview, dismiss: dismissJumatPreview } =
    useJumatSimulation({ now, khutbahMinutes: settings.jumat.khutbahMinutes, simulate: showPreview, close: closeAlert })

  // Mirror the countdown in the browser tab title.
  useEffect(() => {
    if (!phase || !now) return
    const name = prayerLabel(phase.key, phase.date)
    const label = phase.kind === "iqamah" ? `Iqamah ${name}` : name
    document.title = `${formatDuration(phase.end - now)} · ${label} | Jadwal Shalat`
  }, [phase, now])

  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    if (next) playBeeps("test")
    toast(next ? "Suara pengingat diaktifkan" : "Suara pengingat dimatikan")
  }

  const selectedDay = week?.days.find((d) => d.date === selected) ?? week?.days[0]
  const localTime = week && now ? formatClock(now, tz).slice(0, 5) : "00:00"

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      {/* Page backdrop */}
      <div className="bg-geometric pointer-events-none fixed inset-0 -z-10 opacity-[0.035] dark:invert" />
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[40rem] bg-radial-[ellipse_at_top] from-primary/15 to-transparent" />

      <header className="sticky top-0 z-40 border-b border-transparent bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-2xl bg-linear-to-br from-emerald-500 to-teal-700 text-white shadow-lg shadow-emerald-700/30">
              <MoonStarIcon className="size-5" />
            </span>
            <div className="hidden leading-tight sm:block">
              <p className="font-bold">Jadwal Shalat</p>
              <p className="text-xs text-muted-foreground">Seluruh kota di Indonesia</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CityPicker value={city} onChange={setCity} />
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                      "size-10 rounded-full bg-card/60 backdrop-blur",
                      soundOn && "border-primary/40 text-primary"
                    )}
                    aria-label={soundOn ? "Matikan suara" : "Nyalakan suara"}
                    aria-pressed={soundOn}
                    onClick={toggleSound}
                  />
                }
              >
                {soundOn ? <BellIcon /> : <BellOffIcon />}
              </TooltipTrigger>
              <TooltipContent>{soundOn ? "Suara pengingat aktif" : "Suara pengingat mati"}</TooltipContent>
            </Tooltip>
            <SettingsDialog
          settings={settings}
          onSave={setSettings}
          ramadanNow={ramadanAuto}
          backup={{ city, soundOn }}
          onRestore={restoreBackup}
        />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 pt-6 pb-16 sm:px-6">
        {error ? (
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-destructive/30 bg-destructive/5 p-10 text-center">
            <TriangleAlertIcon className="size-10 text-destructive" />
            <div>
              <p className="text-lg font-semibold">Jadwal tidak dapat dimuat</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button onClick={reload} className="gap-2">
              <RefreshCwIcon /> Coba lagi
            </Button>
          </div>
        ) : !week || !now || !selectedDay || !today ? (
          <LoadingState />
        ) : (
          <>
            {offline && <OfflineNotice status={offline} />}

            <CountdownHero week={week} now={now} phase={phase} kecamatan={place?.kecamatan} />

            {ramadan && <RamadanCard week={week} now={now} today={today} />}

            <div className="grid gap-3 sm:grid-cols-2">
              <QuickLink
                href="/layar"
                icon={MonitorIcon}
                title="Mode layar masjid"
                subtitle="Tampilan layar penuh untuk TV / monitor masjid"
              />
              <QuickLink
                href="/bulanan"
                icon={CalendarRangeIcon}
                title="Jadwal sebulan"
                subtitle="Lihat, cetak, atau unduh PDF / CSV"
              />
            </div>

            <section className="space-y-4">
              <SectionTitle
                icon={CalendarDaysIcon}
                title={selectedDay.date === today ? "Jadwal hari ini" : "Jadwal harian"}
                subtitle={formatScheduleDate(selectedDay.date, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              />
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist">
                {week.days.map((day) => {
                  const active = day.date === selectedDay.date
                  return (
                    <button
                      key={day.date}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setSelected(day.date)}
                      className={cn(
                        "relative flex min-w-16 shrink-0 flex-col items-center rounded-2xl border px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        active ? "border-transparent text-primary-foreground" : "bg-card hover:bg-accent"
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="day-pill"
                          className="absolute inset-0 -z-0 rounded-2xl bg-primary shadow-md shadow-primary/30"
                          transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        />
                      )}
                      <span className="relative text-xs opacity-80">
                        {day.date === today ? "Hari ini" : formatScheduleDate(day.date, { weekday: "short" })}
                      </span>
                      <span className="relative text-lg font-bold">
                        {formatScheduleDate(day.date, { day: "numeric" })}
                      </span>
                      {isFriday(day.date) && (
                        <span
                          className={cn(
                            "relative size-1.5 rounded-full",
                            active ? "bg-primary-foreground" : "bg-gold"
                          )}
                        />
                      )}
                    </button>
                  )
                })}
              </div>
              <DayTimes
                day={selectedDay}
                isToday={selectedDay.date === today}
                phase={phase}
                localTime={localTime}
              />
            </section>

            <section className="space-y-4">
              <SectionTitle
                icon={CalendarRangeIcon}
                title="Jadwal sepekan"
                subtitle="Klik baris untuk melihat detail harian"
              />
              <WeekTable
                days={week.days}
                today={today}
                selected={selectedDay.date}
                onSelect={(date) => {
                  setSelected(date)
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }}
              />
            </section>
          </>
        )}
      </main>

      <footer className="border-t bg-background/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-center text-xs text-muted-foreground sm:flex-row sm:px-6 sm:text-left">
          <p>
            Data jadwal: Kemenag RI melalui{" "}
            <a href="https://api.myquran.com" target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
              API myQuran
            </a>

            {week?.source === "koordinat" && " (mode lokasi: dihitung dari titik GPS dengan parameter Kemenag)"}. Jeda
            iqamah dan koreksi waktu dapat diatur di menu Pengaturan.
            {savedAt && (
              <span className="mt-1 block">
                Jadwal ~2 bulan tersimpan di perangkat ini (diunduh{" "}
                {new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(savedAt)}
                ), sehingga tetap berjalan tanpa internet. Diperbarui otomatis sekali tiap awal bulan.
              </span>
            )}
          </p>
          <p className="font-arabic text-base">إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا</p>
        </div>
      </footer>

      <AdzanModal alert={alert} now={now} onClose={closeAlertWithJumat} />
      <IbadahJumatScreen
        show={Boolean(jumatPreview)}
        clock={now ? formatClock(now, tz).slice(0, 5) : ""}
        iqamahTime={jumatPreview ? formatClock(jumatPreview.iqamahAt, tz).slice(0, 5) : undefined}
        people={jumatPeople(settings.jumat)}
        preview
        onClose={dismissJumatPreview}
        className="fixed inset-0 z-90"
      />
      {/* Temporary: remove this line (and simulation-panel.tsx) when no longer needed. */}
      {phase && (
        <SimulationPanel onSimulate={(kind, options) => (options?.jumat ? simulateJumat() : showPreview(kind))} />
      )}
    </div>
  )
}

function QuickLink({
  href,
  icon: Icon,
  title,
  subtitle,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm backdrop-blur transition-all outline-none hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110 group-hover:-rotate-6">
        <Icon className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block truncate text-sm text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRightIcon className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
    </Link>
  )
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div>
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-10" aria-busy="true" aria-label="Memuat jadwal">
      <Skeleton className="h-[34rem] rounded-3xl lg:h-96" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  )
}
