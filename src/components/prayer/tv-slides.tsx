"use client"

import { BookOpenIcon, UsersIcon, WalletIcon, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { PRAYER_KEYS, prayerLabel } from "@/lib/prayer"
import {
  formatRupiah,
  isKajianToday,
  kajianDayLabel,
  kasBalance,
  sortKajian,
  type JumatOfficers,
  type Settings,
} from "@/lib/settings"

export type TvSlide = "kas" | "petugas" | "kajian"

const MAX_KAJIAN_ON_SLIDE = 4

/** Info slides that have content to show, in rotation order. */
export function availableSlides(settings: Settings): TvSlide[] {
  const slides: TvSlide[] = []
  if (settings.kas.enabled) slides.push("kas")
  if (PRAYER_KEYS.some((k) => settings.petugas[k].imam || settings.petugas[k].muadzin)) slides.push("petugas")
  if (settings.kajian.length) slides.push("kajian")
  return slides
}

/** Heights use cqh (the middle area of the mosque display is a size container), so slides always fit above the time board. */
function SlideFrame({ icon: Icon, title, subtitle, children }: { icon: LucideIcon; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="w-[min(90vw,330cqh)]">
      <div className="mb-[2.9cqh] flex items-end justify-between gap-[2vw]">
        <p className="flex items-center gap-[1vw] text-[min(2.6vw,7cqh)] font-bold">
          <Icon className="size-[1.1em] text-amber-300" /> {title}
        </p>
        {subtitle && <p className="text-[min(1.8vw,4.8cqh)] text-emerald-100/70">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

const cell = "rounded-[1vw] border border-white/10 bg-white/[0.05] px-[1.5vw] py-[1.9cqh]"

export function KasSlide({ kas }: { kas: Settings["kas"] }) {
  const rows = [
    { label: "Saldo sebelumnya", value: kas.lastBalance, tone: "" },
    { label: "Pemasukan", value: kas.income, tone: "text-emerald-300" },
    { label: "Pengeluaran", value: kas.expense, tone: "text-rose-300" },
  ]
  return (
    <SlideFrame icon={WalletIcon} title="Laporan Kas Masjid" subtitle={kas.period}>
      <div className="grid grid-cols-3 gap-[1vw]">
        {rows.map((r) => (
          <div key={r.label} className={cell}>
            <p className="text-[min(1.7vw,4.6cqh)] text-white/60">{r.label}</p>
            <p className={cn("font-mono text-[min(2.6vw,7cqh)] font-semibold tabular-nums", r.tone)}>
              {r.label === "Pengeluaran" && r.value ? "−" : ""}
              {formatRupiah(r.value)}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-[1.9cqh] flex items-center justify-between rounded-[1vw] border border-amber-300/40 bg-amber-400/15 px-[2vw] py-[2.2cqh]">
        <p className="text-[min(2.4vw,6.4cqh)] font-semibold">Saldo akhir</p>
        <p className="font-mono text-[min(4.2vw,11.2cqh)] font-bold text-amber-200 tabular-nums">{formatRupiah(kasBalance(kas))}</p>
      </div>
    </SlideFrame>
  )
}

export function PetugasSlide({
  petugas,
  date,
  jumat,
}: {
  petugas: Settings["petugas"]
  date: string
  /** Officers of today's Jumat, when today is Friday. */
  jumat?: JumatOfficers
}) {
  return (
    <SlideFrame icon={UsersIcon} title="Petugas Shalat Hari Ini">
      <div className="grid grid-cols-5 gap-[1vw]">
        {PRAYER_KEYS.map((key) => {
          const isJumatSlot = key === "dzuhur" && jumat
          const imam = isJumatSlot ? jumat.imam : petugas[key].imam
          const second = isJumatSlot ? { label: "Khatib", name: jumat.khatib } : { label: "Muadzin", name: petugas[key].muadzin }
          return (
            <div key={key} className={cn(cell, "text-center")}>
              <p className="text-[min(2.2vw,6.1cqh)] font-bold text-amber-200">{prayerLabel(key, date)}</p>
              <p className="mt-[1.9cqh] text-[min(1.4vw,3.8cqh)] text-white/50">Imam</p>
              <p className="line-clamp-2 text-[min(1.8vw,4.8cqh)] leading-tight font-medium">{imam || "–"}</p>
              <p className="mt-[1.6cqh] text-[min(1.4vw,3.8cqh)] text-white/50">{second.label}</p>
              <p className="line-clamp-2 text-[min(1.8vw,4.8cqh)] leading-tight font-medium">{second.name || "–"}</p>
            </div>
          )
        })}
      </div>
    </SlideFrame>
  )
}

export function KajianSlide({ kajian, weekday }: { kajian: Settings["kajian"]; weekday: number }) {
  // Two rows fit between the header and the time board; today's sessions come first.
  const sorted = sortKajian(kajian, weekday)
  const list = sorted.slice(0, MAX_KAJIAN_ON_SLIDE)
  const more = sorted.length - list.length
  return (
    <SlideFrame
      icon={BookOpenIcon}
      title="Jadwal Pengajian"
      subtitle={more > 0 ? `+${more} pengajian lainnya` : undefined}
    >
      <div className="grid grid-cols-2 gap-[1vw]">
        {list.map((k, i) => {
          const today = isKajianToday(k, weekday)
          // A lone last item (1, 3 … entries) spans both columns instead of leaving a gap.
          const wide = list.length % 2 === 1 && i === list.length - 1
          return (
            <div key={k.id} className={cn(cell, wide && "col-span-2", today && "border-amber-300/50 bg-amber-400/15")}>
              <div className="flex items-center justify-between gap-[1vw]">
                <p className="text-[min(1.5vw,4cqh)] font-semibold text-amber-200">
                  {kajianDayLabel(k.day)}
                  {k.time && ` · ${k.time}`}
                </p>
                {today && (
                  <span className="rounded-full bg-amber-400 px-[0.8vw] py-[0.3cqh] text-[min(1.2vw,3.2cqh)] font-bold text-emerald-950">
                    HARI INI
                  </span>
                )}
              </div>
              <p className="mt-[0.6cqh] truncate text-[min(1.9vw,5.1cqh)] font-bold">{k.title || "Kajian"}</p>
              {k.ustadz && <p className="truncate text-[min(1.5vw,4.2cqh)] text-white/70">{k.ustadz}</p>}
            </div>
          )
        })}
      </div>
    </SlideFrame>
  )
}
