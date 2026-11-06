"use client"

import { InfoIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Row, Stepper } from "@/components/prayer/settings-fields"
import {
  JumatScheduleSection,
  KajianSection,
  KasSection,
  NightSection,
  PetugasSection,
  SimulationToggle,
} from "@/components/prayer/settings-sections"
import { cn } from "@/lib/utils"
import { PRAYER_KEYS, TIME_KEYS, TIME_LABELS } from "@/lib/prayer"
import { splitRunningText, type RamadanMode, type Settings } from "@/lib/settings"

const RAMADAN_OPTIONS: { value: RamadanMode; label: string }[] = [
  { value: "auto", label: "Otomatis" },
  { value: "on", label: "Selalu aktif" },
  { value: "off", label: "Nonaktif" },
]

type Props = {
  draft: Settings
  setDraft: (settings: Settings) => void
  /** Whether today counts as Ramadan, shown next to the "auto" option. */
  ramadanNow: boolean
  /** Today in the city (YYYY-MM-DD), to list the coming Fridays. */
  today: string
  /** The automatic location, shown when the address is left empty. */
  locationFallback: string
  /** The background photo section, where photos can be chosen. */
  photo?: React.ReactNode
  /** Show the switch for the simulation buttons (on the TV only). */
  simulation?: boolean
  /** Content of the Cadangan tab; no tab without it. */
  backup?: React.ReactNode
}

/** The settings themselves, shared by the dialog on the TV and home page and by the phone page. */
export function SettingsTabs({ draft, setDraft, ramadanNow, today, locationFallback, photo, simulation, backup }: Props) {
  return (
    <Tabs defaultValue="iqamah" className="gap-4">
      <TabsList className="grid w-full grid-cols-3 group-data-horizontal/tabs:h-auto sm:grid-cols-5">
        <TabsTrigger value="iqamah">Iqamah</TabsTrigger>
        <TabsTrigger value="koreksi">Koreksi</TabsTrigger>
        <TabsTrigger value="ramadhan">Ramadhan</TabsTrigger>
        <TabsTrigger value="jumat">Jumat</TabsTrigger>
        <TabsTrigger value="petugas">Petugas</TabsTrigger>
        <TabsTrigger value="kajian">Pengajian</TabsTrigger>
        <TabsTrigger value="kas">Kas</TabsTrigger>
        <TabsTrigger value="layar">Layar</TabsTrigger>
        {backup && <TabsTrigger value="cadangan">Cadangan</TabsTrigger>}
      </TabsList>

      <TabsContent value="iqamah" className="space-y-2">
        <p className="text-xs text-muted-foreground">Jeda dari adzan sampai iqamah untuk tiap shalat.</p>
        {PRAYER_KEYS.map((key) => (
          <Row key={key} label={TIME_LABELS[key]}>
            <Stepper
              value={draft.iqamah[key]}
              min={0}
              max={60}
              suffix="mnt"
              onChange={(v) => setDraft({ ...draft, iqamah: { ...draft.iqamah, [key]: v } })}
            />
          </Row>
        ))}
      </TabsContent>

      <TabsContent value="koreksi" className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Geser waktu jadwal (±30 menit), misalnya menyesuaikan dengan jadwal masjid setempat.
        </p>
        {TIME_KEYS.map((key) => (
          <Row key={key} label={TIME_LABELS[key]}>
            <Stepper
              signed
              value={draft.corrections[key]}
              min={-30}
              max={30}
              suffix="mnt"
              onChange={(v) => setDraft({ ...draft, corrections: { ...draft.corrections, [key]: v } })}
            />
          </Row>
        ))}
      </TabsContent>

      <TabsContent value="ramadhan" className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Menampilkan hitung mundur sahur (imsak) dan berbuka (maghrib). Mode otomatis mengikuti kalender Hijriah
          Umm al-Qura; pilih &quot;Selalu aktif&quot; atau &quot;Nonaktif&quot; jika awal Ramadhan versi pemerintah berbeda.
        </p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Mode Ramadhan">
          {RAMADAN_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="radio"
              aria-checked={draft.ramadan === opt.value}
              onClick={() => setDraft({ ...draft, ramadan: opt.value })}
              className={cn(
                "rounded-xl border px-3 py-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                draft.ramadan === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "bg-card/60 hover:bg-accent"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Status otomatis hari ini: <span className="font-medium text-foreground">{ramadanNow ? "Ramadhan" : "bukan Ramadhan"}</span>
        </p>
      </TabsContent>

      <TabsContent value="jumat" className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Pada hari Jumat, setelah adzan Jumat layar masjid menampilkan &quot;Ibadah Shalat Jumat sedang
          berlangsung&quot; selama khutbah sampai shalat selesai.
        </p>
        <Row label="Durasi khutbah" hint="Dari adzan Jumat sampai iqamah">
          <Stepper
            value={draft.jumat.khutbahMinutes}
            min={5}
            max={90}
            suffix="mnt"
            onChange={(v) => setDraft({ ...draft, jumat: { ...draft.jumat, khutbahMinutes: v } })}
          />
        </Row>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Khatib bawaan (opsional)</span>
          <Input
            value={draft.jumat.khatib}
            maxLength={80}
            placeholder="Contoh: Ustadz Ahmad Fauzi, Lc."
            onChange={(e) => setDraft({ ...draft, jumat: { ...draft.jumat, khatib: e.target.value } })}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Imam Jumat bawaan (opsional)</span>
          <Input
            value={draft.jumat.imam}
            maxLength={80}
            placeholder="Contoh: Ustadz Hasan"
            onChange={(e) => setDraft({ ...draft, jumat: { ...draft.jumat, imam: e.target.value } })}
          />
        </label>
        <JumatScheduleSection draft={draft} setDraft={setDraft} today={today} />
      </TabsContent>

      <TabsContent value="petugas">
        <PetugasSection draft={draft} setDraft={setDraft} />
      </TabsContent>

      <TabsContent value="kajian">
        <KajianSection draft={draft} setDraft={setDraft} />
      </TabsContent>

      <TabsContent value="kas">
        <KasSection draft={draft} setDraft={setDraft} />
      </TabsContent>

      <TabsContent value="layar" className="space-y-3">
        <p className="text-xs text-muted-foreground">Untuk tampilan layar masjid / TV.</p>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Nama masjid / musala</span>
          <Input
            value={draft.mosqueName}
            maxLength={80}
            placeholder="Contoh: Masjid Al-Ikhlas"
            onChange={(e) => setDraft({ ...draft, mosqueName: e.target.value })}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Alamat / lokasi (opsional)</span>
          <Input
            value={draft.mosqueAddress}
            maxLength={120}
            placeholder="Contoh: Jl. Yos Sudarso No. 12, Kel. Umban Sari, Kec. Rumbai"
            onChange={(e) => setDraft({ ...draft, mosqueAddress: e.target.value })}
          />
          <span className="block text-xs text-muted-foreground">
            Kosongkan untuk memakai lokasi otomatis:{" "}
            <span className="font-medium text-foreground">{locationFallback}</span>
          </span>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Teks berjalan</span>
          <Textarea
            value={draft.runningText}
            maxLength={500}
            rows={3}
            className="max-h-48 wrap-anywhere"
            placeholder="Contoh: Kajian rutin setiap Ahad ba'da Maghrib; Mohon matikan HP saat shalat; Infaq dapat disalurkan melalui pengurus masjid"
            onChange={(e) => setDraft({ ...draft, runningText: e.target.value })}
          />
          <span className="flex items-start gap-1.5 rounded-lg bg-primary/8 px-2.5 py-2 text-xs text-muted-foreground">
            <InfoIcon className="mt-px size-3.5 shrink-0 text-primary" />
            <span>
              Pisahkan setiap kalimat dengan tanda titik koma{" "}
              <kbd className="rounded border bg-background px-1 font-mono text-foreground">;</kbd>. Di layar, antar
              kalimat akan diberi pembatas <span className="text-gold">✦</span>. Kosongkan untuk memakai teks bawaan.
            </span>
          </span>
        </label>
        {splitRunningText(draft.runningText).length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Pratinjau ({splitRunningText(draft.runningText).length} kalimat)
            </p>
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-emerald-950 p-2.5 text-xs text-amber-100">
              {splitRunningText(draft.runningText).map((item, i) => (
                <span key={i} className="flex min-w-0 items-center gap-1.5">
                  {i > 0 && <span className="text-amber-300/70">✦</span>}
                  <span className="min-w-0 rounded-md bg-white/10 px-2 py-0.5 wrap-anywhere">{item}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {photo}
        <NightSection draft={draft} setDraft={setDraft} />
        <Row label={`Layar "sedang shalat"`} hint="Lama tampil setelah iqamah (0 = tidak)">
          <Stepper
            value={draft.prayingMinutes}
            min={0}
            max={60}
            suffix="mnt"
            onChange={(v) => setDraft({ ...draft, prayingMinutes: v })}
          />
        </Row>
        {simulation && <SimulationToggle draft={draft} setDraft={setDraft} />}
      </TabsContent>
      {backup && <TabsContent value="cadangan">{backup}</TabsContent>}
    </Tabs>
  )
}
