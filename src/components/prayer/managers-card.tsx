"use client"

import { useCallback, useEffect, useState } from "react"
import { KeyRoundIcon, LoaderCircleIcon, Share2Icon, UserPlusIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { editUrl, newKey } from "@/lib/layar-data"
import { timeAgo } from "@/lib/layar-sync"

type Phone = { id: string; role: "admin" | "editor" | "pending"; label: string | null; addedAt: string; self: boolean }

const ROLE_LABEL: Record<Phone["role"], string> = {
  admin: "Pengelola utama",
  editor: "Pengurus",
  pending: "Menunggu persetujuan",
}
const MAX_PHONES = 3

async function call(method: string, url: string, key: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${key}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? "Gagal. Coba lagi.")
  return data
}

/** For a main manager: the mosque's phones, invitations and the emergency PIN. */
export function ManagersCard({
  linkKey,
  mosque,
  hasPin,
  onPinSet,
}: {
  linkKey: string
  mosque: string
  hasPin: boolean
  onPinSet: () => void
}) {
  const [phones, setPhones] = useState<Phone[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [inviteName, setInviteName] = useState("")
  const [invited, setInvited] = useState<{ name: string; url: string } | null>(null)
  const [pin, setPin] = useState("")
  const [loadedAt, setLoadedAt] = useState(0)

  const load = useCallback(() => {
    call("GET", "/api/layar/hp", linkKey)
      .then((list: Phone[]) => {
        setPhones(list)
        setLoadedAt(Date.now())
      })
      .catch(() => {})
  }, [linkKey])

  // Requests from phones that scanned the TV show up without reloading.
  useEffect(() => {
    load()
    const timer = setInterval(load, 30_000)
    const onVisible = () => document.visibilityState === "visible" && load()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [load])

  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true)
    try {
      await work()
      toast.success(done)
      load()
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const act = (phone: Phone, action: "setujui" | "cabut" | "jadikan_admin" | "jadikan_pengurus", done: string) => {
    if (action === "cabut" && !window.confirm(`Cabut ${phone.label || "HP ini"}? HP itu tidak bisa mengatur layar lagi.`)) return
    void run(() => call("PATCH", "/api/layar/hp", linkKey, { id: phone.id, action }), done)
  }

  const invite = () => {
    const key = newKey()
    const name = inviteName.trim()
    void run(async () => {
      await call("POST", "/api/layar/hp", linkKey, { newKey: key, label: name })
      setInvited({ name, url: editUrl(window.location.origin, key) })
      setInviteName("")
    }, "Undangan dibuat")
  }

  const share = async (url: string, name: string) => {
    try {
      if (navigator.share) await navigator.share({ title: `Atur layar ${mosque || "masjid"}`, url })
      else {
        await navigator.clipboard.writeText(url)
        toast.success(`Link untuk ${name || "pengurus"} disalin`)
      }
    } catch {
      // Sharing cancelled.
    }
  }

  const active = phones?.filter((p) => p.role !== "pending").length ?? 0

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5">
      <div>
        <p className="font-semibold">HP pengelola</p>
        <p className="text-sm text-muted-foreground">
          Anda pengelola utama. Paling banyak {MAX_PHONES} HP, termasuk HP ini.
        </p>
      </div>

      {!phones ? (
        <LoaderCircleIcon className="size-5 animate-spin text-primary" />
      ) : (
        <ul className="space-y-2">
          {phones.map((phone) => (
            <li key={phone.id} className="rounded-xl border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{phone.label || (phone.self ? "HP ini" : "Tanpa nama")}</span>
                {phone.self && phone.label && <span className="text-xs text-muted-foreground">(HP ini)</span>}
                <Badge variant={phone.role === "pending" ? "default" : "secondary"}>{ROLE_LABEL[phone.role]}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">Ditambahkan {timeAgo(phone.addedAt, loadedAt)}</p>
              {!phone.self && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {phone.role === "pending" && (
                    <Button size="sm" disabled={busy || active >= MAX_PHONES} onClick={() => act(phone, "setujui", "HP disetujui")}>
                      Setujui
                    </Button>
                  )}
                  {phone.role === "editor" && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => act(phone, "jadikan_admin", "Dijadikan pengelola cadangan")}>
                      Jadikan pengelola cadangan
                    </Button>
                  )}
                  {phone.role === "admin" && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => act(phone, "jadikan_pengurus", "Dijadikan pengurus")}>
                      Jadikan pengurus
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={busy}
                    onClick={() => act(phone, "cabut", phone.role === "pending" ? "Permintaan ditolak" : "HP dicabut")}
                  >
                    {phone.role === "pending" ? "Tolak" : "Cabut"}
                  </Button>
                </div>
              )}
              {phone.role === "pending" && active >= MAX_PHONES && (
                <p className="mt-2 text-xs text-muted-foreground">Sudah {MAX_PHONES} HP. Cabut salah satu dulu untuk menyetujui.</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {active < MAX_PHONES && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            invite()
          }}
        >
          <p className="text-sm font-medium">Undang pengurus</p>
          <div className="flex gap-2">
            <Input value={inviteName} maxLength={40} onChange={(e) => setInviteName(e.target.value)} placeholder="Nama, contoh: Pak Hasan" />
            <Button type="submit" className="shrink-0 gap-2" disabled={busy || !inviteName.trim()}>
              <UserPlusIcon /> Undang
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Setiap pengurus mendapat link sendiri, jadi bisa dicabut satu per satu.</p>
        </form>
      )}

      <form
        className="space-y-2 border-t pt-4"
        onSubmit={(e) => {
          e.preventDefault()
          void run(async () => {
            await call("PUT", "/api/layar/pin", linkKey, { pin })
            setPin("")
            onPinSet()
          }, "PIN darurat disimpan")
        }}
      >
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <KeyRoundIcon className="size-4 text-primary" /> PIN darurat {hasPin ? "(sudah dibuat)" : "(belum dibuat)"}
        </p>
        <p className="text-xs text-muted-foreground">
          Dipakai di TV kalau semua HP pengelola utama hilang. Catat dan simpan di tempat aman, jangan dibagikan.
        </p>
        <div className="flex gap-2">
          <Input
            value={pin}
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="6 angka"
            aria-label="PIN darurat"
          />
          <Button type="submit" variant="outline" className="shrink-0" disabled={busy || pin.length !== 6}>
            {hasPin ? "Ganti PIN" : "Simpan PIN"}
          </Button>
        </div>
      </form>

      <Dialog open={invited !== null} onOpenChange={(open) => !open && setInvited(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kirim link ini ke {invited?.name || "pengurus"}</DialogTitle>
            <DialogDescription>
              Link ini hanya untuk satu orang. Siapa pun yang memegangnya bisa mengatur layar, jadi kirim langsung ke orangnya.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-lg bg-muted p-3 font-mono text-xs break-all">{invited?.url}</p>
          <DialogFooter>
            <Button className="gap-2" onClick={() => invited && void share(invited.url, invited.name)}>
              <Share2Icon /> Bagikan link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
