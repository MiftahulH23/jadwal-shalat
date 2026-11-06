"use client"

import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { CheckCircle2Icon, LoaderCircleIcon, MonitorIcon, MoonStarIcon, Share2Icon, TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SettingsTabs } from "@/components/prayer/settings-tabs"
import { CityPicker } from "@/components/prayer/city-picker"
import { useHydrated, usePersistedState } from "@/hooks/use-persisted-state"
import { PHONE_LINKS_KEY } from "@/lib/layar-config"
import { editUrl, newKey, readAturHash, type LayarData, type LayarSnapshot } from "@/lib/layar-data"
import { dateAtOffset, locationLabel, type City } from "@/lib/prayer"
import { canonical, timeChanges } from "@/lib/layar-sync"
import { DEFAULT_SETTINGS, isRamadan, normalizeSettings, type Settings } from "@/lib/settings"

/** A mosque this phone can manage. Only on this phone: the server keeps just a hash of the key. */
type PhoneLink = { key: string; name: string; city: string; addedAt: number }

const subscribeHash = (listener: () => void) => {
  window.addEventListener("hashchange", listener)
  return () => window.removeEventListener("hashchange", listener)
}

/** Goes to a mosque's page without leaving the used QR code in the history. */
const openLink = (key: string) => window.location.replace(`#k=${key}`)

function useLinks() {
  const [links, setLinks] = usePersistedState<PhoneLink[]>(PHONE_LINKS_KEY, [])
  const save = (link: Omit<PhoneLink, "addedAt">) => {
    const existing = links.find((l) => l.key === link.key)
    setLinks([{ ...link, addedAt: existing?.addedAt ?? Date.now() }, ...links.filter((l) => l.key !== link.key)])
  }
  const remove = (key: string) => setLinks(links.filter((l) => l.key !== key))
  return { links, save, remove }
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

export function AturPage() {
  const hydrated = useHydrated()
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => "")
  const target = readAturHash(hash)

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-linear-to-br from-amber-200 to-amber-500 text-emerald-950">
          <MoonStarIcon className="size-6" />
        </span>
        <div>
          <h1 className="text-xl font-bold">Atur layar masjid</h1>
          <p className="text-sm text-muted-foreground">Dari HP, tanpa akun.</p>
        </div>
      </div>

      {!hydrated ? (
        <Spinner />
      ) : target && "pair" in target ? (
        <PairFlow key={target.pair} pair={target.pair} />
      ) : target && "key" in target ? (
        <MosqueView key={target.key} linkKey={target.key} />
      ) : (
        <LinkList />
      )}
    </main>
  )
}

const Spinner = () => (
  <div className="grid place-items-center py-16">
    <LoaderCircleIcon className="size-8 animate-spin text-primary" />
  </div>
)

function Notice({ title, children, tone = "warn" }: { title: string; children?: React.ReactNode; tone?: "warn" | "ok" }) {
  const Icon = tone === "ok" ? CheckCircle2Icon : TriangleAlertIcon
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="flex items-center gap-2 font-semibold">
        <Icon className={tone === "ok" ? "size-5 text-primary" : "size-5 text-amber-500"} /> {title}
      </p>
      {children && <div className="mt-2 space-y-3 text-sm text-muted-foreground">{children}</div>}
    </div>
  )
}

/** The mosques this phone already manages. */
function LinkList() {
  const { links } = useLinks()
  if (!links.length) {
    return (
      <Notice title="Belum ada masjid di HP ini">
        <p>
          Buka layar masjid (<span className="font-mono">/layar</span>) di TV, pilih <strong>Atur dari HP</strong>, lalu
          pindai QR yang tampil dengan kamera HP ini.
        </p>
        <Button variant="outline" render={<Link href="/" />} nativeButton={false}>
          Ke halaman utama
        </Button>
      </Notice>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Masjid yang bisa diatur dari HP ini:</p>
      {links.map((link) => (
        <button
          key={link.key}
          onClick={() => openLink(link.key)}
          className="flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left hover:bg-accent"
        >
          <MonitorIcon className="size-5 shrink-0 text-primary" />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{link.name || "Masjid tanpa nama"}</span>
            <span className="block truncate text-sm text-muted-foreground">{link.city}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

type QrInfo = { connected: boolean; name: string | null; snapshot: LayarSnapshot | null }

/** After scanning a TV's QR code. */
function PairFlow({ pair }: { pair: string }) {
  const { links, save } = useLinks()
  const [info, setInfo] = useState<QrInfo | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [city, setCity] = useState<City | null>(null)
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    postJson("/api/layar/qr", { pair })
      .then(({ ok, data }) => {
        if (cancelled) return
        if (ok) setInfo(data as QrInfo)
        else setProblem(data.error ?? "QR tidak bisa dibaca.")
      })
      .catch(() => !cancelled && setProblem("Tidak ada koneksi internet. Coba muat ulang halaman ini."))
    return () => {
      cancelled = true
    }
  }, [pair])

  if (problem) {
    return (
      <Notice title={problem}>
        <p>QR di TV hanya bisa dipakai sekali dan berganti tiap 15 menit. Pindai QR yang sedang tampil di TV.</p>
      </Notice>
    )
  }
  if (!info) return <Spinner />

  const claim = async (phoneKey: string, data: LayarData | null, label: { name: string; city: string }) => {
    setBusy(true)
    try {
      const res = await postJson("/api/layar/klaim", { pair, phoneKey, data })
      if (!res.ok) {
        toast.error(res.data.error ?? "Gagal menghubungkan.")
        if (res.status === 410) setProblem(res.data.error)
        return
      }
      save({ key: phoneKey, ...label })
      toast.success("Terhubung", { description: "TV akan berubah dalam beberapa detik." })
      openLink(phoneKey)
    } catch {
      toast.error("Tidak ada koneksi internet.")
    } finally {
      setBusy(false)
    }
  }

  // The TV already belongs to a mosque: this phone joins as another manager.
  if (info.connected) {
    return (
      <Notice title={`TV ini milik ${info.name || "sebuah masjid"}`} tone="ok">
        <p>Bergabung untuk ikut mengatur layar masjid ini dari HP Anda.</p>
        <Button disabled={busy} onClick={() => void claim(newKey(), null, { name: info.name ?? "", city: "" })}>
          {busy && <LoaderCircleIcon className="animate-spin" />} Gabung sebagai pengurus
        </Button>
      </Notice>
    )
  }

  const snapshot = info.snapshot
  const chosenCity = city ?? snapshot?.city ?? null
  const chosenName = name ?? snapshot?.settings.mosqueName ?? ""

  return (
    <div className="space-y-4">
      <form
        className="space-y-4 rounded-2xl border bg-card p-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (!chosenCity) return
          const settings = { ...(snapshot?.settings ?? DEFAULT_SETTINGS), mosqueName: chosenName.trim() }
          void claim(newKey(), { settings, city: chosenCity }, { name: settings.mosqueName, city: locationLabel(chosenCity) })
        }}
      >
        <div>
          <p className="font-semibold">Hubungkan TV ke HP ini</p>
          <p className="text-sm text-muted-foreground">
            {snapshot?.city
              ? "Pengaturan yang sudah ada di TV ikut tersimpan. Periksa lalu simpan."
              : "Pilih lokasi masjid agar waktu shalat di TV sesuai."}
          </p>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Kota atau kabupaten</p>
          <CityPicker value={chosenCity} onChange={setCity} className="w-full max-w-none sm:max-w-none" />
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Nama masjid</span>
          <Input value={chosenName} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Masjid Al-Ikhlas" />
        </label>
        <Button type="submit" className="w-full" disabled={!chosenCity || busy}>
          {busy && <LoaderCircleIcon className="animate-spin" />}
          {chosenCity ? "Simpan dan hubungkan" : "Pilih kota dulu"}
        </Button>
      </form>

      {links.length > 0 && (
        <div className="space-y-2 rounded-2xl border bg-card p-5">
          <p className="font-semibold">Atau pakai data masjid yang sudah ada</p>
          <p className="text-sm text-muted-foreground">Cocok untuk TV kedua atau TV pengganti. Pengaturan di TV ini akan diganti.</p>
          {links.map((link) => (
            <Button
              key={link.key}
              variant="outline"
              className="w-full justify-start"
              disabled={busy}
              onClick={() => void claim(link.key, null, { name: link.name, city: link.city })}
            >
              <MonitorIcon /> Hubungkan ke {link.name || "masjid tanpa nama"}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

type MosqueInfo = { version: number; data: LayarData | null; updatedAt: string; tvSeenAt: string | null }

const ago = (iso: string | null) => {
  if (!iso) return "belum pernah"
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  const rtf = new Intl.RelativeTimeFormat("id", { numeric: "auto" })
  if (minutes < 60) return minutes < 1 ? "baru saja" : rtf.format(-minutes, "minute")
  if (minutes < 48 * 60) return rtf.format(-Math.round(minutes / 60), "hour")
  return rtf.format(-Math.round(minutes / 1440), "day")
}

/** A mosque this phone manages: its status, its settings, and sharing with other managers. */
function MosqueView({ linkKey }: { linkKey: string }) {
  const { save, remove } = useLinks()
  const [info, setInfo] = useState<MosqueInfo | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/layar/data", { headers: { Authorization: `Bearer ${linkKey}` }, cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (cancelled) return
        if (res.ok) setInfo(body as MosqueInfo)
        else setProblem(body.error ?? "Data tidak bisa dimuat.")
        if (res.status === 401) remove(linkKey)
      })
      .catch(() => !cancelled && setProblem("Tidak ada koneksi internet. Coba muat ulang halaman ini."))
    return () => {
      cancelled = true
    }
    // Load once per link; remove() changes with every render of the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkKey])

  // Keep the list of mosques on this phone up to date, e.g. for a link someone shared.
  const name = info?.data?.settings.mosqueName ?? ""
  const city = info?.data ? locationLabel(info.data.city) : ""
  useEffect(() => {
    if (info?.data) save({ key: linkKey, name, city })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, linkKey])

  if (problem) {
    return (
      <Notice title={problem}>
        <p>Minta link baru dari pengurus lain, atau pindai QR di TV lewat tombol Atur dari HP.</p>
      </Notice>
    )
  }
  if (!info) return <Spinner />
  if (!info.data) return <Notice title="Data masjid ini tidak bisa dibaca." />

  const share = async () => {
    const url = editUrl(window.location.origin, linkKey)
    try {
      if (navigator.share) await navigator.share({ title: `Atur layar ${name || "masjid"}`, url })
      else {
        await navigator.clipboard.writeText(url)
        toast.success("Link disalin")
      }
    } catch {
      // Sharing cancelled.
    }
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="rounded-2xl border bg-card p-5">
        <p className="text-lg font-semibold">{name || "Masjid tanpa nama"}</p>
        <p className="text-sm text-muted-foreground">{city}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-muted/60 p-3">
            <dt className="text-muted-foreground">TV terakhir terhubung</dt>
            <dd className="font-medium">{ago(info.tvSeenAt)}</dd>
          </div>
          <div className="rounded-xl bg-muted/60 p-3">
            <dt className="text-muted-foreground">Terakhir diubah</dt>
            <dd className="font-medium">{ago(info.updatedAt)}</dd>
          </div>
        </dl>
      </div>

      <MosqueEditor
        linkKey={linkKey}
        version={info.version}
        data={info.data}
        onSaved={(version, data) => setInfo({ ...info, version, data, updatedAt: new Date().toISOString() })}
        onLost={setProblem}
      />

      <div className="rounded-2xl border bg-card p-5">
        <p className="font-semibold">Pengurus lain</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Siapa pun yang memegang link ini bisa mengubah tulisan di layar masjid. Bagikan hanya ke pengurus. Kalau link
          tersebar, putuskan semua HP dari pengaturan di TV.
        </p>
        <Button variant="outline" className="mt-3 gap-2" onClick={() => void share()}>
          <Share2Icon /> Bagikan ke pengurus lain
        </Button>
      </div>
    </div>
  )
}

type Saved = { version: number; data: LayarData }

/** The mosque's settings, edited on the phone and saved to the server; the TV picks them up within minutes. */
function MosqueEditor({
  linkKey,
  version,
  data,
  onSaved,
  onLost,
}: {
  linkKey: string
  version: number
  data: LayarData
  onSaved: (version: number, data: LayarData) => void
  onLost: (message: string) => void
}) {
  const [draft, setDraft] = useState<Settings>(data.settings)
  const [city, setCity] = useState<City>(data.city)
  const [base, setBase] = useState<Saved>({ version, data })
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<string[] | null>(null)
  const [conflict, setConflict] = useState<Saved | null>(null)

  const edited: LayarData = useMemo(() => ({ settings: normalizeSettings(draft), city }), [draft, city])
  const unsaved = canonical(edited) !== canonical(base.data)

  useEffect(() => {
    if (!unsaved) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [unsaved])

  const send = async (baseVersion: number, force: boolean) => {
    setConfirm(null)
    setBusy(true)
    try {
      const res = await fetch("/api/layar/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${linkKey}` },
        body: JSON.stringify({ data: edited, baseVersion, force }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        setBase({ version: body.version, data: edited })
        setConflict(null)
        onSaved(body.version, edited)
        toast.success("Tersimpan", { description: "TV berubah paling lama 5 menit lagi." })
      } else if (res.status === 409 && body.current?.data) {
        setConflict({ version: body.current.version, data: body.current.data })
      } else if (res.status === 401) {
        onLost(body.error ?? "Akses link ini sudah dicabut.")
      } else {
        toast.error(body.error ?? "Gagal menyimpan. Coba lagi.")
      }
    } catch {
      toast.error("Tidak ada koneksi internet. Perubahan belum tersimpan.")
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    // Anything that moves prayer times is confirmed first: a wrong time is the worst mistake here.
    const changes = timeChanges(base.data, edited)
    if (changes.length) setConfirm(changes)
    else void send(base.version, false)
  }

  const reset = (to: Saved) => {
    setBase(to)
    setDraft(to.data.settings)
    setCity(to.data.city)
    setConflict(null)
  }

  const [now] = useState(() => Date.now())
  return (
    <>
      <div className="space-y-1.5 rounded-2xl border bg-card p-5">
        <p className="font-semibold">Lokasi masjid</p>
        <p className="text-sm text-muted-foreground">Menentukan waktu shalat di TV.</p>
        <CityPicker value={city} onChange={setCity} className="w-full max-w-none sm:max-w-none" />
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <SettingsTabs
          draft={draft}
          setDraft={setDraft}
          ramadanNow={isRamadan("auto", now, "Asia/Jakarta")}
          today={dateAtOffset(now, 7)}
          locationFallback={locationLabel(city)}
          photo={<p className="text-xs text-muted-foreground">Foto latar masih diatur langsung di TV.</p>}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            {unsaved ? "Ada perubahan yang belum disimpan" : "Semua perubahan sudah tersimpan"}
          </p>
          {unsaved && (
            <Button variant="ghost" disabled={busy} onClick={() => reset(base)}>
              Batalkan
            </Button>
          )}
          <Button disabled={!unsaved || busy} onClick={save}>
            {busy && <LoaderCircleIcon className="animate-spin" />} Simpan
          </Button>
        </div>
      </div>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Waktu shalat di TV akan berubah</DialogTitle>
            <DialogDescription>Periksa sekali lagi sebelum menyimpan.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-1.5 text-sm">
            {confirm?.map((line) => (
              <li key={line} className="rounded-lg bg-muted/60 px-3 py-2">
                {line}
              </li>
            ))}
          </ul>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Periksa lagi
            </Button>
            <Button onClick={() => void send(base.version, false)}>Ya, simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={conflict !== null} onOpenChange={(open) => !open && setConflict(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ada perubahan dari pengurus lain</DialogTitle>
            <DialogDescription>
              Seseorang menyimpan pengaturan masjid ini setelah halaman ini dibuka. Pilih data yang dipakai.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => conflict && reset(conflict)}>
              Muat data terbaru
            </Button>
            <Button variant="destructive" onClick={() => conflict && void send(conflict.version, true)}>
              Timpa dengan milik saya
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
