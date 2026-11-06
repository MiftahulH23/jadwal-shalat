"use client"

import { useEffect, useRef, useState } from "react"
import { ImageIcon, ImagePlusIcon, MoonIcon, MoveIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Field, Row, RupiahInput, Stepper } from "@/components/prayer/settings-fields"
import { useBackgroundPhoto } from "@/hooks/use-background-photo"
import { compressPhoto } from "@/lib/background"
import { formatScheduleDate } from "@/lib/format"
import { addDays, PRAYER_KEYS, TIME_LABELS } from "@/lib/prayer"
import {
  DAY_NAMES,
  formatRupiah,
  kasBalance,
  MAX_KAJIAN,
  MAX_PHOTO_DARKNESS,
  MIN_PHOTO_DARKNESS,
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

/** A photo waiting for "Simpan": a new one, null to remove the current one, undefined for no change. */
export type PhotoChange = { blob: Blob; url: string } | null | undefined

const clampPercent = (n: number) => Math.min(100, Math.max(0, n))

/** Preview of the mosque display; drag the photo, or use the arrow keys, to choose the part shown. */
function PhotoPreview({
  photo,
  background,
  onMove,
}: {
  photo: string
  background: Settings["background"]
  onMove: (position: { x: number; y: number }) => void
}) {
  const [natural, setNatural] = useState<{ url: string; w: number; h: number } | null>(null)
  const drag = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const image = new Image()
    image.onload = () => setNatural({ url: photo, w: image.naturalWidth, h: image.naturalHeight })
    image.src = photo
  }, [photo])

  /** How far the photo sticks out of the preview, in px; dragging by this much crosses the whole range. */
  const overflow = () => {
    const box = ref.current?.getBoundingClientRect()
    if (!box || natural?.url !== photo) return { x: 0, y: 0 }
    const scale = Math.max(box.width / natural.w, box.height / natural.h)
    return { x: natural.w * scale - box.width, y: natural.h * scale - box.height }
  }

  return (
    <div
      ref={ref}
      role="group"
      tabIndex={0}
      aria-label="Pratinjau foto latar. Geser foto atau tekan tombol panah untuk memilih bagian yang ditampilkan"
      className="relative grid aspect-video cursor-grab touch-none place-items-center overflow-hidden rounded-lg bg-cover text-white outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
      style={{ backgroundImage: `url("${photo}")`, backgroundPosition: `${background.x}% ${background.y}%` }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { pointerX: e.clientX, pointerY: e.clientY, x: background.x, y: background.y }
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        const room = overflow()
        // The photo follows the pointer: moving it right reveals more of its left side.
        onMove({
          x: room.x > 0 ? clampPercent(drag.current.x - ((e.clientX - drag.current.pointerX) / room.x) * 100) : background.x,
          y: room.y > 0 ? clampPercent(drag.current.y - ((e.clientY - drag.current.pointerY) / room.y) * 100) : background.y,
        })
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onKeyDown={(e) => {
        const step = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }[e.key]
        if (!step) return
        e.preventDefault()
        onMove({ x: clampPercent(background.x + step[0]), y: clampPercent(background.y + step[1]) })
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: background.darkness / 100 }} />
      <p className="pointer-events-none relative font-mono text-3xl font-bold tabular-nums [text-shadow:0_1px_8px_rgb(0_0_0/0.8)]">12:34:56</p>
      <span className="pointer-events-none absolute bottom-2 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs whitespace-nowrap">
        <MoveIcon className="size-3" /> Geser foto untuk mengatur posisi
      </span>
    </div>
  )
}

/** Background photo of the mosque display, with a live preview. */
export function BackgroundSection({
  draft,
  setDraft,
  change,
  onChange,
  current,
  note = "Foto tersimpan di browser ini saja, tidak diunggah. Simpan foto aslinya, dan pasang lagi di perangkat lain atau pindahkan lewat file cadangan.",
}: SectionProps & {
  change: PhotoChange
  onChange: (next: PhotoChange) => void
  /** The current photo when it is not the one in this browser (e.g. on the server, for a phone). */
  current?: string | null
  note?: string
}) {
  const local = useBackgroundPhoto()
  const stored = current === undefined ? local : current
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const photo = change === undefined ? stored : (change?.url ?? null)
  const set = (patch: Partial<Settings["background"]>) =>
    setDraft({ ...draft, background: { ...draft.background, ...patch } })

  const choose = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const blob = await compressPhoto(file)
      onChange({ blob, url: URL.createObjectURL(blob) })
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-2 rounded-xl border bg-card/60 p-3">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <ImageIcon className="size-4 text-primary" /> Foto latar layar masjid
        </p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>

      {photo && <PhotoPreview photo={photo} background={draft.background} onMove={set} />}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Pilih foto latar"
        onChange={(e) => void choose(e.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="flex-1 gap-2" disabled={busy} onClick={() => inputRef.current?.click()}>
          <ImagePlusIcon /> {busy ? "Memproses foto…" : photo ? "Ganti foto" : "Pilih foto"}
        </Button>
        {photo && (
          <Button variant="outline" disabled={busy} onClick={() => set({ x: 50, y: 50 })}>
            Ke tengah
          </Button>
        )}
        {photo && (
          <Button variant="outline" className="gap-2" disabled={busy} onClick={() => onChange(null)}>
            <Trash2Icon /> Hapus
          </Button>
        )}
      </div>

      {photo && (
        <Row label="Tingkat gelap" hint="Makin gelap, jadwal makin mudah dibaca">
          <Stepper
            value={draft.background.darkness}
            min={MIN_PHOTO_DARKNESS}
            max={MAX_PHOTO_DARKNESS}
            step={5}
            suffix="%"
            onChange={(darkness) => set({ darkness })}
          />
        </Row>
      )}
    </div>
  )
}

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

/** Dim the mosque display at night (between Isya and Subuh). */
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
