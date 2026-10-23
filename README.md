# Jadwal Shalat

Website jadwal shalat untuk seluruh kota/kabupaten di Indonesia: hitung mundur shalat & iqamah, pop-up adzan/iqamah, mode layar masjid, mode Ramadhan, dan jadwal bulanan yang bisa dicetak/diunduh.

Dibangun dengan Next.js (App Router), React, TypeScript, Tailwind CSS, dan shadcn/ui. **Tanpa database**: jadwal diambil dari API publik, pengaturan disimpan di localStorage browser (per perangkat).

## Menjalankan

Butuh Node.js 22.23.2+ (disarankan Node 24 LTS, lihat `.nvmrc`).

```bash
npm install
npm run dev
```

Buka http://localhost:3000.

## Halaman

- `/`: jadwal sepekan, hitung mundur, pop-up adzan/iqamah, mode Ramadhan, mode Jumat (khutbah)
- `/layar`: mode layar masjid/TV (layar penuh, layar tetap menyala, teks berjalan, layar "shalat sedang berlangsung")
- `/bulanan`: jadwal sebulan, cetak, unduh PDF/CSV

## Offline

Jadwal ±2 bulan (62 hari) diunduh sekaligus dan disimpan di perangkat, jadi API hanya dihubungi **sekali tiap awal bulan** (atau saat ganti lokasi). Tanpa internet, aplikasi memakai jadwal tersimpan; untuk lokasi GPS jadwal bisa dihitung sendiri. Service worker (`public/sw.js`, aktif di build produksi) membuat halaman tetap bisa dibuka walau di-reload saat offline.

## Struktur singkat

- `src/lib/prayer.ts`: tipe data, zona waktu (WIB/WITA/WIT), logika fase hitung mundur/iqamah
- `src/lib/settings.ts`: pengaturan (iqamah per shalat, koreksi waktu, Ramadhan, layar masjid)
- `src/lib/myquran.ts`: pengambilan data dari API myQuran (sumber Kemenag RI), dengan cache
- `src/lib/astronomy.ts`: hitung jadwal dari koordinat GPS (parameter Kemenag) untuk "Gunakan lokasi saya"
- `src/lib/beep.ts`: suara bip pengingat (Web Audio, tanpa file audio)
- `src/lib/export.ts`: unduh PDF/CSV di sisi browser
- `src/lib/offline.ts`: penyimpanan jadwal offline & aturan pembaruan bulanan
- `src/lib/backup.ts`: ekspor/impor pengaturan (file atau kode)
- `src/app/api/jadwal/[id]`: jadwal 7 hari; `src/app/api/jadwal/[id]/bulan`: jadwal sebulan; `src/app/api/kota`: daftar kota
- `src/components/prayer/*`: komponen UI

## Catatan keamanan dependency

`npm audit --omit=dev` bersih. Sisa peringatan `braces` hanya ada di alat pengembangan (ESLint, CLI shadcn) dan belum ada versi perbaikan dari pembuatnya.
