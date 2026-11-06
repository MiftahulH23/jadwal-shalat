"use client"

import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { CheckCircle2Icon, LoaderCircleIcon, MonitorIcon, MoonStarIcon, TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ManagersCard } from "@/components/prayer/managers-card"
import { BackgroundSection, type PhotoChange } from "@/components/prayer/settings-sections"
import { SettingsTabs } from "@/components/prayer/settings-tabs"
import { CityPicker } from "@/components/prayer/city-picker"
import { useHydrated, usePersistedState } from "@/hooks/use-persisted-state"
import { PHONE_LINKS_KEY, photoUrl } from "@/lib/layar-config"
import { sendPhoto } from "@/lib/layar-photo"
import { newKey, readAturHash, type LayarData, type LayarSnapshot } from "@/lib/layar-data"
import { dateAtOffset, locationLabel, type City } from "@/lib/prayer"
import { canonical, timeAgo, timeChanges, tvSeenLabel } from "@/lib/layar-sync"
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

type QrInfo = { connected: boolean; name: string | null; hasManager: boolean; full: boolean; snapshot: LayarSnapshot | null }

/** After scanning a TV's QR code. */
function PairFlow({ pair }: { pair: string }) {
  const { links, save } = useLinks()
  const [info, setInfo] = useState<QrInfo | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [city, setCity] = useState<City | null>(null)
  const [name, setName] = useState<string | null>(null)
  const [who, setWho] = useState("")

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
      const res = await postJson("/api/layar/klaim", { pair, phoneKey, data, label: who.trim() || null })
      if (!res.ok) {
        toast.error(res.data.error ?? "Gagal menghubungkan.")
        if (res.status === 410) setProblem(res.data.error)
        return
      }
      save({ key: phoneKey, ...label })
      if (res.data.role === "pending") toast.success("Permintaan terkirim", { description: "Tunggu disetujui pengelola utama." })
      else toast.success("Terhubung", { description: "TV akan berubah dalam beberapa detik." })
      openLink(phoneKey)
    } catch {
      toast.error("Tidak ada koneksi internet.")
    } finally {
      setBusy(false)
    }
  }

  const whoField = (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">Nama Anda</span>
      <Input value={who} maxLength={40} onChange={(e) => setWho(e.target.value)} placeholder="Contoh: Pak Ahmad" />
      <span className="block text-xs text-muted-foreground">Supaya pengelola tahu HP ini milik siapa.</span>
    </label>
  )
  const mosque = info.name || "masjid ini"

  // The TV already belongs to a mosque: this phone asks to join, or (after a reset) takes over.
  if (info.connected) {
    if (info.hasManager && info.full) {
      return (
        <Notice title={`Sudah 3 HP mengatur ${mosque}`}>
          <p>Minta pengelola utama mencabut salah satu HP dulu, lalu pindai QR di TV lagi.</p>
        </Notice>
      )
    }
    return (
      <form
        className="space-y-4 rounded-2xl border bg-card p-5"
        onSubmit={(e) => {
          e.preventDefault()
          void claim(newKey(), null, { name: info.name ?? "", city: "" })
        }}
      >
        <div>
          <p className="font-semibold">{info.hasManager ? `Minta akses ke ${mosque}` : `Jadi pengelola utama ${mosque}`}</p>
          <p className="text-sm text-muted-foreground">
            {info.hasManager
              ? "Pengelola utama masjid ini perlu menyetujui HP Anda dulu."
              : "Layar ini baru direset dengan PIN darurat. HP pertama yang memindai menjadi pengelola utama."}
          </p>
        </div>
        {whoField}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <LoaderCircleIcon className="animate-spin" />} {info.hasManager ? "Minta akses" : "Jadi pengelola utama"}
        </Button>
      </form>
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
        {whoField}
        <p className="text-xs text-muted-foreground">HP ini menjadi pengelola utama: bisa mengundang hingga 2 pengurus lain.</p>
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

type Role = "admin" | "editor" | "pending"
type MosqueInfo = {
  role: Role
  version: number
  data: LayarData | null
  updatedAt: string
  tvSeenAt: string | null
  hasPin: boolean | null
  /** Path of the background photo on the server. */
  photo: string | null
}

/** How often the phone page refreshes the status while it is open. */
const STATUS_REFRESH_MS = 60_000

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

  // The status changes while the page is open (the TV checks in), so it is refreshed now and then.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return
      fetch("/api/layar/data", { headers: { Authorization: `Bearer ${linkKey}` }, cache: "no-store" })
        .then((res) => {
          if (res.status === 401) setProblem("Akses HP ini sudah dicabut oleh pengelola utama.")
          return res.ok ? res.json() : null
        })
        .then((body: MosqueInfo | null) => {
          setNow(Date.now())
          // Only the status: the form keeps what is being typed.
          // A role change (approved, made main manager) loads everything; otherwise just the status.
          if (body) {
            setInfo((prev) =>
              !prev || prev.role !== body.role
                ? body
                : { ...prev, tvSeenAt: body.tvSeenAt, updatedAt: body.updatedAt, hasPin: body.hasPin, photo: body.photo }
            )
          }
        })
        .catch(() => {})
    }
    const timer = setInterval(refresh, STATUS_REFRESH_MS)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", refresh)
    }
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
  if (info.role === "pending") {
    return (
      <Notice title="Menunggu persetujuan pengelola utama" tone="ok">
        <p>Minta pengelola utama masjid membuka halaman Atur dari HP-nya lalu menyetujui HP ini.</p>
        <p>Halaman ini berubah sendiri setelah disetujui.</p>
      </Notice>
    )
  }
  if (!info.data) return <Notice title="Data masjid ini tidak bisa dibaca." />

  return (
    <div className="space-y-4 pb-24">
      <div className="rounded-2xl border bg-card p-5">
        <p className="text-lg font-semibold">{name || "Masjid tanpa nama"}</p>
        <p className="text-sm text-muted-foreground">{city}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-muted/60 p-3">
            <dt className="text-muted-foreground">TV terakhir terhubung</dt>
            <dd className="font-medium">{tvSeenLabel(info.tvSeenAt, now)}</dd>
          </div>
          <div className="rounded-xl bg-muted/60 p-3">
            <dt className="text-muted-foreground">Terakhir diubah</dt>
            <dd className="font-medium">{timeAgo(info.updatedAt, now)}</dd>
          </div>
        </dl>
      </div>

      <MosqueEditor
        linkKey={linkKey}
        version={info.version}
        data={info.data}
        photo={info.photo}
        onSaved={(version, data) => setInfo((prev) => prev && { ...prev, version, data, updatedAt: new Date().toISOString() })}
        onPhotoSaved={(photo) => setInfo((prev) => prev && { ...prev, photo, updatedAt: new Date().toISOString() })}
        onLost={setProblem}
      />

      {info.role === "admin" ? (
        <ManagersCard linkKey={linkKey} mosque={name} hasPin={Boolean(info.hasPin)} onPinSet={() => setInfo({ ...info, hasPin: true })} />
      ) : (
        <Notice title="Anda pengurus masjid ini" tone="ok">
          <p>Undangan dan pencabutan HP diatur oleh pengelola utama.</p>
        </Notice>
      )}
    </div>
  )
}

type Saved = { version: number; data: LayarData }

/** The mosque's settings, edited on the phone and saved to the server; the TV picks them up within minutes. */
function MosqueEditor({
  linkKey,
  version,
  data,
  photo,
  onSaved,
  onPhotoSaved,
  onLost,
}: {
  linkKey: string
  version: number
  data: LayarData
  photo: string | null
  onSaved: (version: number, data: LayarData) => void
  onPhotoSaved: (photo: string | null) => void
  onLost: (message: string) => void
}) {
  const [draft, setDraft] = useState<Settings>(data.settings)
  const [city, setCity] = useState<City>(data.city)
  const [base, setBase] = useState<Saved>({ version, data })
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<string[] | null>(null)
  const [conflict, setConflict] = useState<Saved | null>(null)
  const [photoChange, setPhotoChange] = useState<PhotoChange>(undefined)
  const changePhoto = (next: PhotoChange) => {
    if (photoChange) URL.revokeObjectURL(photoChange.url)
    setPhotoChange(next)
  }

  const edited: LayarData = useMemo(() => ({ settings: normalizeSettings(draft), city }), [draft, city])
  const settingsUnsaved = canonical(edited) !== canonical(base.data)
  const unsaved = settingsUnsaved || photoChange !== undefined

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
      // The photo goes first: it is the slow part, and settings that refer to it (position, darkness) follow.
      if (photoChange !== undefined) {
        try {
          onPhotoSaved(await sendPhoto(linkKey, photoChange?.blob ?? null))
          changePhoto(undefined)
        } catch (error) {
          toast.error((error as Error).message)
          return
        }
      }
      if (!settingsUnsaved) {
        toast.success("Tersimpan", { description: "TV berubah paling lama 5 menit lagi." })
        return
      }
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
          photo={
            <BackgroundSection
              draft={draft}
              setDraft={setDraft}
              change={photoChange}
              onChange={changePhoto}
              current={photo ? photoUrl(photo) : null}
              note="Foto dikirim ke server dan tampil di semua TV masjid ini."
            />
          }
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            {unsaved ? "Ada perubahan yang belum disimpan" : "Semua perubahan sudah tersimpan"}
          </p>
          {unsaved && (
            <Button variant="ghost" disabled={busy} onClick={() => {
                reset(base)
                changePhoto(undefined)
              }}>
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
