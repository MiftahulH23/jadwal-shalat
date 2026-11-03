"use client"

import { useState } from "react"
import Link from "next/link"
import { MoonStarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CityPicker } from "@/components/prayer/city-picker"
import type { City } from "@/lib/prayer"

/** First visit to the mosque display: the location must be chosen before any times are shown. */
export function LayarSetup({ onDone }: { onDone: (city: City, mosqueName: string) => void }) {
  const [city, setCity] = useState<City | null>(null)
  const [name, setName] = useState("")

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-y-auto bg-[#04110f] p-6 text-white">
      <div className="bg-geometric-light pointer-events-none absolute inset-0 opacity-[0.05]" />
      <form
        className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8"
        onSubmit={(e) => {
          e.preventDefault()
          if (city) onDone(city, name.trim())
        }}
      >
        <span className="grid size-14 place-items-center rounded-2xl bg-linear-to-br from-amber-200 to-amber-500 text-emerald-950">
          <MoonStarIcon className="size-7" />
        </span>
        <h1 className="mt-5 text-3xl font-bold">Siapkan layar masjid</h1>
        <p className="mt-2 text-lg text-emerald-100/80">Pilih lokasi masjid agar waktu shalat yang tampil sesuai.</p>

        <div className="mt-7 space-y-2">
          <p className="text-base font-semibold">Kota atau kabupaten</p>
          <CityPicker
            value={city}
            onChange={setCity}
            className="h-12 w-full max-w-none border-white/20 bg-white/5 text-base text-white hover:bg-white/10 hover:text-white sm:max-w-none dark:bg-white/5 dark:hover:bg-white/10"
          />
        </div>

        <label className="mt-5 block space-y-2">
          <span className="text-base font-semibold">
            Nama masjid <span className="font-normal text-white/60">(boleh diisi nanti)</span>
          </span>
          <Input
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Masjid Al-Ikhlas"
            className="h-12 border-white/20 bg-white/5 text-base text-white placeholder:text-white/40 md:text-base dark:bg-white/5"
          />
        </label>

        <Button type="submit" disabled={!city} className="mt-7 h-12 w-full rounded-full text-base">
          {city ? "Tampilkan jadwal" : "Pilih kota dulu"}
        </Button>

        <p className="mt-5 text-sm text-white/60">
          Iqamah, foto latar, dan lainnya bisa diatur nanti lewat tombol Pengaturan. Punya file cadangan? Pulihkan juga
          di sana.
        </p>
        <Button
          variant="ghost"
          className="mt-3 -ml-2 text-white/70 hover:bg-white/10 hover:text-white"
          render={<Link href="/" />}
          nativeButton={false}
        >
          Kembali ke halaman utama
        </Button>
      </form>
    </div>
  )
}
