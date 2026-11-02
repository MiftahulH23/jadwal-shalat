# Verifikasi

## Perintah

```bash
npm run check   # tsc + eslint, jalankan setelah setiap perubahan kode
npm run build   # sebelum memakai `next start`
```

Belum ada tes otomatis (lihat `docs/ROADMAP.md`).

## Screenshot dan pengukuran: `npm run shot`

Jangan menulis skrip Puppeteer baru untuk hal yang sudah bisa dilakukan alat ini. Butuh server yang berjalan:

```bash
npm run build && (npx next start -p 3123 > /dev/null 2>&1 &)
for i in $(seq 1 30); do curl -s -o /dev/null localhost:3123 && break; sleep 1; done
```

Contoh:

```bash
# Layar TV saat khutbah, ukuran layar pengguna (ganti tanggal dengan hari Jumat terdekat)
npm run shot -- --page layar --size 1763x844 --at YYYY-MM-DDT12:15:00+07:00 \
  --settings '{"jumat":{"khutbahMinutes":30,"khatib":"Ustadz A","imam":"Ustadz B"}}' --out jumat.png

# Slide tertentu: siklus = 30 + 12 × jumlah slide (detik), offset = detik di dalam siklus
npm run shot -- --page layar --at YYYY-MM-DDT13:00:00+07:00 --cycle 66 --offset 36 --settings kas.json

# Klik tombol lalu screenshot, lebar HP
npm run shot -- --size 390x844 --mobile --settings '{"showSimulation":true}' --click "Masuk waktu iqamah"

# Jam perangkat meleset 5 menit (menguji koreksi jam); pakai tanda sama dengan untuk nilai negatif
npm run shot -- --page layar --skew=-300
```

Opsi lain: `--photo <file>` (foto latar, disimpan apa adanya tanpa kompresi), `--base <url>` (default `http://localhost:3123`, bisa produksi), `--wait <ms>`, `--browser <path>`. `--settings` menerima JSON atau path file. `--at` mematikan koreksi jam agar jam palsunya tidak dibatalkan. Keluaran JSON: `realClockWIB`, `shownClock`, `clockOffsetMs`, `pageOverflow`, `middle` (apakah isi bagian tengah TV muat), `dialog` (apakah pop-up muat), `text`.

Ukuran layar yang sudah pernah bermasalah: TV 1763×844, 1920×1080, 1366×768, 1280×720; HP 390×844, 375×667.

## Jebakan yang sudah pernah terjadi

**Lingkungan**
- Windows, tidak ada Python. Shell Bash tersedia.
- Jangan membuat skrip `node -e "..."` dengan backtick atau backslash lewat Bash: isinya rusak. Pakai alat Edit.
- Perintah tanpa input seperti `cat > file` membuat proses menggantung.
- Git Bash mengubah argumen berawalan `/` menjadi path Windows (`/layar` menjadi `C:/Program Files/Git/layar`).
- `next dev` tidak bisa jalan dua kali di folder yang sama. Pengguna sering memakai port 3000; pakai `next start -p 3123` untuk tes.
- Server dev yang lama bisa menyajikan CSS usang. Kalau tampilan aneh, bandingkan dengan build produksi.
- Service worker hanya aktif di produksi.
- Server `next start` lama yang masih hidup setelah build ulang menyajikan 404 untuk rute baru dan halaman kosong. Gejala lain: file `_next/static` membalas 500 dan halaman tampil tanpa CSS. `Get-NetTCPConnection` bisa tidak menemukannya, jadi cari lewat PowerShell: `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match '3123' }`, lalu hentikan prosesnya.
- Di localhost, server memakai jam komputer yang sama, jadi koreksi jam selalu mendekati 0. Pakai `--skew` atau uji di produksi.

**Pengujian**
- `--at` hanya berlaku untuk 60 hari ke depan, karena server mengirim jadwal mulai hari ini sebenarnya.
- Slide TV berganti mengikuti jam, jadi ukuran yang diambil bisa saja milik slide, bukan hitung mundur. Pakai `--cycle` dan `--offset`.
- Pengaturan tersimpan per alamat. Data di localhost tidak ada di produksi, dan sebaliknya. Periksa ini dulu sebelum menganggapnya bug.
- Kursor di atas pop-up menjeda penutupan otomatis.
- Rute baru butuh `npx next typegen` sebelum `tsc`.

**React dan UI**
- ESLint melarang `setState` sinkron di effect dan fungsi tak murni (`Date.now()`) saat render. Pakai event handler, callback timer, atau nilai `now` dari `useNow`.
- Komponen shadcn memakai Base UI: gunakan prop `render`, bukan `asChild`.
- `TabsList` mengunci tinggi lewat `group-data-horizontal/tabs:h-8`; `h-auto` biasa tidak cukup.
- Teks panjang tanpa spasi melebarkan Textarea dan item grid: pakai `wrap-anywhere` atau `min-w-0`.
- Kontrol bawaan browser butuh `color-scheme: dark` agar terbaca di mode gelap.
