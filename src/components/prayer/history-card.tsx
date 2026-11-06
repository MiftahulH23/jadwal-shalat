"use client"

import { useEffect, useState } from "react"
import { HistoryIcon, LoaderCircleIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { LayarData } from "@/lib/layar-data"
import { changedParts, timeAgo } from "@/lib/layar-sync"

type Revision = { version: number; savedAt: string; current: boolean; data: LayarData | null }

/** For a main manager: the last five versions, any of which can be brought back. */
export function HistoryCard({ linkKey, refreshKey, onRestored }: { linkKey: string; refreshKey: number; onRestored: () => void }) {
  const [list, setList] = useState<Revision[] | null>(null)
  const [loadedAt, setLoadedAt] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/layar/riwayat", { headers: { Authorization: `Bearer ${linkKey}` }, cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: Revision[]) => {
        if (cancelled) return
        setList(rows)
        setLoadedAt(Date.now())
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [linkKey, refreshKey])

  const restore = async (revision: Revision) => {
    if (!window.confirm("Kembalikan pengaturan ke versi ini? Pengaturan sekarang tetap tersimpan di riwayat.")) return
    setBusy(true)
    try {
      const res = await fetch("/api/layar/riwayat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${linkKey}` },
        body: JSON.stringify({ version: revision.version }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? "Gagal mengembalikan.")
      toast.success("Pengaturan dikembalikan", { description: "TV berubah paling lama 5 menit lagi." })
      onRestored()
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-5">
      <div>
        <p className="flex items-center gap-1.5 font-semibold">
          <HistoryIcon className="size-4 text-primary" /> Riwayat perubahan
        </p>
        <p className="text-sm text-muted-foreground">
          Lima simpanan terakhir. Salah ubah atau ada yang iseng? Kembalikan ke versi sebelumnya.
        </p>
      </div>
      {!list ? (
        <LoaderCircleIcon className="size-5 animate-spin text-primary" />
      ) : (
        <ul className="space-y-2">
          {list.map((revision, i) => {
            const older = list[i + 1]
            const parts = older?.data && revision.data ? changedParts(older.data, revision.data) : []
            return (
              <li key={revision.version} className="flex items-center gap-3 rounded-xl border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{timeAgo(revision.savedAt, loadedAt)}</p>
                  <p className="text-xs text-muted-foreground">
                    {older ? (parts.length ? `Diubah: ${parts.join(", ")}` : "Tanpa perubahan isi") : "Versi tertua yang tersimpan"}
                  </p>
                </div>
                {revision.current ? (
                  <span className="shrink-0 text-xs font-medium text-primary">Sedang dipakai</span>
                ) : (
                  <Button size="sm" variant="outline" className="shrink-0" disabled={busy} onClick={() => void restore(revision)}>
                    Kembalikan
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** For a main manager: removes the mosque from the server. The TV keeps its last settings. */
export function DeleteMosque({ linkKey, onDeleted }: { linkKey: string; onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)

  const remove = async () => {
    setBusy(true)
    try {
      const res = await fetch("/api/layar/data", { method: "DELETE", headers: { Authorization: `Bearer ${linkKey}` } })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? "Gagal menghapus.")
      setOpen(false)
      toast.success("Data masjid dihapus dari server")
      onDeleted()
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-destructive/30 bg-card p-5">
      <p className="font-semibold">Hapus data masjid</p>
      <p className="text-sm text-muted-foreground">
        Semua data masjid ini dihapus dari server, termasuk foto dan riwayat. TV tetap menampilkan jadwal dengan pengaturan
        terakhirnya, tetapi tidak bisa diatur dari HP lagi.
      </p>
      <Button variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
        <Trash2Icon /> Hapus data masjid
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus data masjid dari server?</DialogTitle>
            <DialogDescription>Tidak bisa dibatalkan. Ketik HAPUS untuk melanjutkan.</DialogDescription>
          </DialogHeader>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="HAPUS" aria-label="Ketik HAPUS" />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" disabled={busy || typed.trim().toUpperCase() !== "HAPUS"} onClick={() => void remove()}>
              {busy && <LoaderCircleIcon className="animate-spin" />} Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
