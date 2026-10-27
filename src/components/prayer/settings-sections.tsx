"use client"

import { MoonIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Field, Row, RupiahInput, Stepper } from "@/components/prayer/settings-fields"
import { formatScheduleDate } from "@/lib/format"
import { addDays, PRAYER_KEYS, TIME_LABELS } from "@/lib/prayer"
import {
  DAY_NAMES,
  formatRupiah,
  kasBalance,
  MAX_KAJIAN,
  type Kajian,
  type Settings,
} from "@/lib/settings"

type SectionProps = {
  draft: Settings
  setDraft: (next: Settings) => void
}

/** Imam & muadzin per daily prayer. */
export function PetugasSection({ draft, setDraft }: SectionProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Imam dan muadzin tiap waktu shalat. Tampil di layar masjid saat menuju shalat tersebut. Boleh dikosongkan.
      </p>
      {PRAYER_KEYS.map((key) => (
        <div key={key} className="rounded-xl border bg-card/60 p-3">
          <p className="mb-2 text-sm font-medium">{TIME_LABELS[key]}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={draft.petugas[key].imam}
              maxLength={60}
              placeholder="Imam"
              aria-label={`Imam ${TIME_LABELS[key]}`}
              onChange={(e) =>
                setDraft({ ...draft, petugas: { ...draft.petugas, [key]: { ...draft.petugas[key], imam: e.target.value } } })
              }
            />
            <Input
              value={draft.petugas[key].muadzin}
              maxLength={60}
              placeholder="Muadzin"
              aria-label={`Muadzin ${TIME_LABELS[key]}`}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  petugas: { ...draft.petugas, [key]: { ...draft.petugas[key], muadzin: e.target.value } },
                })
              }
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/** The next Fridays from `today` (YYYY-MM-DD), including today if it is one. */
function upcomingFridays(today: string, count: number) {
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay()
  const first = addDays(today, (5 - weekday + 7) % 7)
  return Array.from({ length: count }, (_, i) => addDays(first, i * 7))
}

/** Khatib & imam for each upcoming Friday; empty fields fall back to the defaults. */
export function JumatScheduleSection({ draft, setDraft, today }: SectionProps & { today: string }) {
  const setEntry = (date: string, field: "khatib" | "imam", value: string) => {
    const current = draft.jumat.schedule[date] ?? { khatib: "", imam: "" }
    setDraft({
      ...draft,
      jumat: { ...draft.jumat, schedule: { ...draft.jumat.schedule, [date]: { ...current, [field]: value } } },
    })
  }

  // The schedule is still loading, so "today" is not known yet.
  if (!today) return null

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Jadwal per Jumat</p>
      <p className="text-xs text-muted-foreground">
        Isi bila petugas berganti tiap pekan. Yang dikosongkan memakai nama bawaan di atas.
      </p>
      {upcomingFridays(today, 6).map((date) => (
        <div key={date} className="rounded-xl border bg-card/60 p-3">
          <p className="mb-2 text-sm font-medium">
            {formatScheduleDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={draft.jumat.schedule[date]?.khatib ?? ""}
              maxLength={80}
              placeholder={draft.jumat.khatib ? `Khatib (bawaan: ${draft.jumat.khatib})` : "Khatib"}
              aria-label={`Khatib ${date}`}
              onChange={(e) => setEntry(date, "khatib", e.target.value)}
            />
            <Input
              value={draft.jumat.schedule[date]?.imam ?? ""}
              maxLength={80}
              placeholder={draft.jumat.imam ? `Imam (bawaan: ${draft.jumat.imam})` : "Imam"}
              aria-label={`Imam ${date}`}
              onChange={(e) => setEntry(date, "imam", e.target.value)}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Recurring pengajian / kajian: topic, ustadz, day and time. */
export function KajianSection({ draft, setDraft }: SectionProps) {
  const update = (id: string, patch: Partial<Kajian>) =>
    setDraft({ ...draft, kajian: draft.kajian.map((k) => (k.id === id ? { ...k, ...patch } : k)) })
  const remove = (id: string) => setDraft({ ...draft, kajian: draft.kajian.filter((k) => k.id !== id) })
  const add = () =>
    setDraft({
      ...draft,
      kajian: [
        ...draft.kajian,
        { id: Math.random().toString(36).slice(2, 10), title: "", ustadz: "", day: 0, time: "Ba'da Maghrib" },
      ],
    })

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Jadwal pengajian rutin. Tampil di halaman utama dan bergantian di layar masjid; pengajian hari ini ditandai.
      </p>
      {draft.kajian.map((k, i) => (
        <div key={k.id} className="space-y-2 rounded-xl border bg-card/60 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Pengajian {i + 1}</p>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              aria-label={`Hapus pengajian ${i + 1}`}
              onClick={() => remove(k.id)}
            >
              <Trash2Icon />
            </Button>
          </div>
          <Input
            value={k.title}
            maxLength={80}
            placeholder="Nama/tema kajian, mis. Kajian Tafsir Al-Qur'an"
            aria-label="Tema kajian"
            onChange={(e) => update(k.id, { title: e.target.value })}
          />
          <Input
            value={k.ustadz}
            maxLength={80}
            placeholder="Ustadz / pemateri"
            aria-label="Ustadz"
            onChange={(e) => update(k.id, { ustadz: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={k.day}
              aria-label="Hari"
              onChange={(e) => update(k.id, { day: Number(e.target.value) })}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground"
            >
              <option value={-1}>Setiap hari</option>
              {DAY_NAMES.map((name, day) => (
                <option key={day} value={day}>
                  {name}
                </option>
              ))}
            </select>
            <Input
              value={k.time}
              maxLength={40}
              placeholder="Waktu, mis. Ba'da Maghrib / 19.30"
              aria-label="Waktu"
              onChange={(e) => update(k.id, { time: e.target.value })}
            />
          </div>
        </div>
      ))}
      <Button variant="outline" className="w-full gap-2" onClick={add} disabled={draft.kajian.length >= MAX_KAJIAN}>
        <PlusIcon /> Tambah pengajian
      </Button>
      {draft.kajian.length >= MAX_KAJIAN && (
        <p className="text-xs text-muted-foreground">Maksimal {MAX_KAJIAN} jadwal pengajian.</p>
      )}
    </div>
  )
}

/** Cash report: last balance, income and expense; closing balance is calculated. */
export function KasSection({ draft, setDraft }: SectionProps) {
  const k = draft.kas
  const hasData = Boolean(k.period || k.lastBalance || k.income || k.expense)
  const set = (patch: Partial<Settings["kas"]>) => {
    // Filling in the report for the first time switches it on, so it isn't left hidden by accident.
    const firstFill = !k.enabled && !hasData && patch.enabled === undefined
    setDraft({ ...draft, kas: { ...k, ...patch, ...(firstFill && { enabled: true }) } })
  }
  return (
    <div className="space-y-3">
      <Row
        label="Tampilkan di layar masjid"
        hint="Muncul setelah 30 detik hitung mundur, bergantian dengan slide lain, selama shalat berikutnya masih lebih dari 15 menit lagi"
      >
        <Switch checked={k.enabled} onCheckedChange={(enabled) => set({ enabled })} aria-label="Tampilkan info kas" />
      </Row>
      {hasData && !k.enabled && (
        <p className="rounded-lg bg-gold/10 px-3 py-2 text-xs text-gold">
          Laporan kas sudah diisi tetapi belum ditampilkan. Aktifkan tombol di atas agar muncul di layar masjid.
        </p>
      )}
      <Field label="Periode">
        <Input
          value={draft.kas.period}
          maxLength={60}
          placeholder="Contoh: Pekan 17–23 Oktober 2026"
          onChange={(e) => set({ period: e.target.value })}
        />
      </Field>
      <Field label="Saldo sebelumnya">
        <RupiahInput value={draft.kas.lastBalance} allowNegative onChange={(lastBalance) => set({ lastBalance })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Pemasukan">
          <RupiahInput value={draft.kas.income} onChange={(income) => set({ income })} />
        </Field>
        <Field label="Pengeluaran">
          <RupiahInput value={draft.kas.expense} onChange={(expense) => set({ expense })} />
        </Field>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2.5">
        <span className="text-sm font-medium">Saldo akhir</span>
        <span className="font-mono text-base font-semibold tabular-nums">{formatRupiah(kasBalance(draft.kas))}</span>
      </div>
    </div>
  )
}

/** Dim the mosque display at night (between Isya and Subuh). */
export function SimulationToggle({ draft, setDraft }: SectionProps) {
  return (
    <Row label="Alat simulasi pop-up" hint="Tampilkan tombol simulasi adzan, iqamah, dan Jumat (untuk pengurus menguji tampilan)">
      <Switch
        checked={draft.showSimulation}
        onCheckedChange={(showSimulation) => setDraft({ ...draft, showSimulation })}
        aria-label="Alat simulasi pop-up"
      />
    </Row>
  )
}

export function NightSection({ draft, setDraft }: SectionProps) {
  const set = (patch: Partial<Settings["night"]>) => setDraft({ ...draft, night: { ...draft.night, ...patch } })
  return (
    <div className="space-y-2 rounded-xl border bg-card/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <MoonIcon className="size-4 text-primary" /> Layar redup malam
          </p>
          <p className="text-xs text-muted-foreground">
            Layar gelap dengan jam kecil. Gerakkan mouse untuk menyalakan sebentar. Saat Ramadhan menyala lebih awal
            untuk sahur.
          </p>
        </div>
        <Switch checked={draft.night.enabled} onCheckedChange={(enabled) => set({ enabled })} aria-label="Layar redup malam" />
      </div>
      {draft.night.enabled && (
        <>
          <Row label="Mulai" hint="Setelah waktu Isya">
            <Stepper value={draft.night.afterIsya} min={0} max={360} step={15} suffix="mnt" onChange={(afterIsya) => set({ afterIsya })} />
          </Row>
          <Row label="Selesai" hint="Sebelum waktu Subuh">
            <Stepper value={draft.night.beforeSubuh} min={0} max={360} step={15} suffix="mnt" onChange={(beforeSubuh) => set({ beforeSubuh })} />
          </Row>
        </>
      )}
    </div>
  )
}
