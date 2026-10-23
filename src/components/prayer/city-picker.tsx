"use client"

import { useState } from "react"
import { ChevronsUpDownIcon, LoaderCircleIcon, LocateFixedIcon, MapPinIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { isInIndonesia, prettyCity, type City } from "@/lib/prayer"

type GeocodeResult = {
  countryCode?: string
  city?: string
  locality?: string
  localityInfo?: { administrative?: { adminLevel?: number; name: string; description?: string }[] }
}

// Jakarta, Bandung, Malang, Surabaya, Yogyakarta, Semarang, Medan, Makassar, Denpasar, Palembang
const POPULAR_IDS = ["1301", "1219", "1634", "1638", "1505", "1433", "0228", "2622", "1709", "0816"]

type Props = {
  value: City
  onChange: (city: City) => void
}

/** Strip administrative prefixes so "KOTA BANDUNG" can be matched with "Bandung". */
const baseName = (name: string) =>
  name
    .toUpperCase()
    .replace(/^(KOTA|KAB\.?|KABUPATEN)\s+/, "")
    .trim()

export function CityPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next || cities.length > 0 || loading) return
    setLoading(true)
    fetch("/api/kota")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: City[]) => setCities(data))
      .catch(() => toast.error("Gagal memuat daftar kota. Coba lagi nanti."))
      .finally(() => setLoading(false))
  }

  const select = (city: City) => {
    onChange(city)
    setOpen(false)
  }

  const locate = () => {
    if (!navigator.geolocation) {
      toast.error("Browser tidak mendukung deteksi lokasi.")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=id`
          )
          const geo = (await res.json()) as GeocodeResult
          if (geo.countryCode !== "ID" || !isInIndonesia(coords.latitude, coords.longitude)) {
            toast.warning("Lokasi Anda di luar Indonesia. Silakan pilih kota secara manual.")
            return
          }
          const list = cities.length ? cities : ((await (await fetch("/api/kota")).json()) as City[])
          const admin = geo.localityInfo?.administrative ?? []
          // adminLevel 5 = kota/kabupaten, 6 = kecamatan.
          const regency = admin.find((a) => a.adminLevel === 5)
          const kecamatan = admin.find((a) => a.adminLevel === 6)?.name ?? geo.locality ?? ""
          const isKabupaten = /kabupaten/i.test(regency?.description ?? "")

          const names = [regency?.name, geo.city, geo.locality].filter(Boolean).map((n) => baseName(n!))
          const candidates = list.filter((c) => names.includes(baseName(c.lokasi)))
          const match =
            candidates.find((c) => c.lokasi.startsWith(isKabupaten ? "KAB" : "KOTA")) ?? candidates[0]
          if (!match) {
            toast.warning(`"${regency?.name ?? geo.city}" tidak ditemukan. Silakan pilih manual.`)
            return
          }
          select({
            ...match,
            place: {
              // ~10 m precision; no need to keep the exact position.
              lat: Math.round(coords.latitude * 10_000) / 10_000,
              lng: Math.round(coords.longitude * 10_000) / 10_000,
              kecamatan,
            },
          })
          toast.success(
            kecamatan
              ? `Lokasi terdeteksi: Kec. ${kecamatan}, ${prettyCity(match.lokasi)}`
              : `Lokasi terdeteksi: ${prettyCity(match.lokasi)}`,
            { description: "Jadwal dihitung dari titik lokasi Anda (metode Kemenag)." }
          )
        } catch {
          toast.error("Gagal mendeteksi kota dari lokasi Anda.")
        } finally {
          setLocating(false)
        }
      },
      () => {
        setLocating(false)
        toast.error("Izin lokasi ditolak atau tidak tersedia.")
      },
      { timeout: 10_000, maximumAge: 600_000 }
    )
  }

  const popular = POPULAR_IDS.map((id) => cities.find((c) => c.id === id)).filter(
    (c): c is City => Boolean(c)
  )

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className="h-10 max-w-[60vw] justify-between gap-2 rounded-full bg-card/60 px-4 backdrop-blur sm:max-w-none"
            aria-label="Pilih kota"
          />
        }
      >
        {value.place ? <LocateFixedIcon className="text-primary" /> : <MapPinIcon className="text-primary" />}
        <span className="truncate font-medium">
          {value.place?.kecamatan ? `${value.place.kecamatan}, ` : ""}
          {prettyCity(value.lokasi)}
        </span>
        <ChevronsUpDownIcon className="opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-0" align="end">
        <Command>
          <CommandInput placeholder="Cari kota / kabupaten..." />
          <div className="px-1 pt-1">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-primary"
              onClick={locate}
              disabled={locating}
            >
              {locating ? <LoaderCircleIcon className="animate-spin" /> : <LocateFixedIcon />}
              {value.place ? "Perbarui lokasi saya" : "Gunakan lokasi saya"}
            </Button>
            <p className="px-2.5 pb-1 text-xs text-muted-foreground">
              {value.place
                ? `Aktif: Kec. ${value.place.kecamatan || "-"}, ${prettyCity(value.lokasi)}. Pilih kota di bawah untuk kembali ke jadwal resmi kota.`
                : "Jadwal dihitung tepat sampai kecamatan Anda."}
            </p>
          </div>
          <CommandList className="max-h-80">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <LoaderCircleIcon className="size-4 animate-spin" /> Memuat daftar kota...
              </div>
            ) : (
              <>
                <CommandEmpty>Kota tidak ditemukan.</CommandEmpty>
                {popular.length > 0 && (
                  <>
                    <CommandGroup heading="Kota populer">
                      {popular.map((city) => (
                        <CommandItem
                          key={`p-${city.id}`}
                          value={`populer ${city.lokasi}`}
                          data-checked={city.id === value.id && !value.place}
                          onSelect={() => select(city)}
                        >
                          {prettyCity(city.lokasi)}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandSeparator />
                  </>
                )}
                <CommandGroup heading={`Semua wilayah (${cities.length})`}>
                  {cities.map((city) => (
                    <CommandItem
                      key={city.id}
                      value={city.lokasi}
                      data-checked={city.id === value.id && !value.place}
                      onSelect={() => select(city)}
                    >
                      {prettyCity(city.lokasi)}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
