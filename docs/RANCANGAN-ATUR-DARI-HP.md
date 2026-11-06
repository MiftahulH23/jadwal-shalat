# Rancangan: mengatur layar TV dari HP

Status: **sedang dikerjakan, tahap 1 sampai 4 dan kendali (5a) selesai.** Model pengelola utama menggantikan "Putuskan semua HP" di TV; aturannya ada di `docs/DOMAIN.md`. Pemilik menyetujui Supabase dan ingin memposting setelah fitur ini jadi. SQL terbaru ada di `supabase/migrations/`, dengan tes di `supabase/layar.test.ts`. Kalau berbeda dengan draf di dokumen ini, yang berlaku file migrasi.

## Masalah

Mengatur TV itu ribet, terutama tanpa keyboard dan mouse atau kalau TV dipasang tinggi. Padahal data seperti ustadz pengajian dan kas berubah tiap minggu.

## Tujuan

- Pindai QR **sekali**, setelah itu edit dari HP kapan saja, dari mana saja, tanpa menyentuh TV.
- Tanpa akun untuk pengguna.
- Beberapa pengurus dan beberapa TV bisa memakai data masjid yang sama.
- Foto latar bisa diganti dari HP.

## Bukan tujuan

- Perubahan tampil seketika. Cukup paling lama 5 menit.
- Hak akses bertingkat antar pengurus.
- Mengedit tanpa internet dari HP.

## Prinsip yang tidak boleh dilanggar

1. **Jadwal shalat tidak pernah bergantung pada Supabase.** TV tetap membaca data dari browsernya sendiri. Kalau Supabase mati atau dijeda, yang berhenti hanya edit dari HP.
2. **Fitur ini pilihan.** TV yang tidak dihubungkan bekerja seperti sekarang dan tidak mengirim apa pun ke server.
3. **Mengatur langsung di TV tetap bisa**, baik sudah terhubung maupun belum.
4. **Server tidak menyimpan kunci asli**, hanya hash-nya. Kebocoran database tidak memberi akses edit.

## Alur pengguna

### Pertama kali, TV baru

1. `/layar` menampilkan layar penyiapan dengan dua pilihan: **Atur dari HP** (ada QR) dan **Atur di TV ini** (formulir yang sudah ada).
2. Pengurus memindai QR. `/atur` terbuka di HP dan meminta kota dan nama masjid. Kota wajib, sama seperti penyiapan di TV.
3. Pengurus menekan **Simpan**. TV menampilkan "HP terhubung" dan langsung menampilkan jadwal.
4. HP menawarkan **Tambahkan ke layar utama** dan menyimpan link rahasianya.

Selama kota belum dipilih dari HP, TV tetap di layar penyiapan, supaya waktu kota bawaan tidak pernah tampil.

### TV lama yang sudah berisi data

Pengaturan > Layar > **Atur dari HP** menampilkan QR. Data TV saat ini ikut dikirim, jadi HP membuka data yang sudah ada dan tidak perlu mengisi ulang.

### Edit mingguan

1. Buka link dari layar utama HP, ganti ustadz atau kas, lalu tekan **Simpan**.
2. HP menampilkan "Tersimpan. TV berubah paling lama 5 menit lagi" dan waktu terakhir TV terhubung.
3. TV mengambil perubahan sendiri.

### Menambah pengurus lain

HP pengurus pertama menekan **Bagikan ke pengurus lain**, lalu link dikirim lewat WhatsApp. Layar menjelaskan bahwa siapa pun yang memegang link bisa mengubah tulisan di layar masjid.

### Menambah TV kedua atau mengganti TV

TV baru menampilkan QR, HP yang sudah terhubung memindainya, lalu memilih **Hubungkan ke Masjid X**. TV itu mengambil seluruh data dan fotonya. Peringatan muncul kalau TV itu sudah punya data yang akan tertimpa.

### Link bocor atau HP hilang

Di TV: Pengaturan > Layar > **Putuskan semua HP**. Semua link HP mati dan pengurus memindai QR baru. Hanya TV yang punya tombol ini, supaya pemegang link yang bocor tidak bisa mengeluarkan pengurus lain.

### Memutuskan TV dan menghapus data

Di HP: **Hapus data masjid dari server**. Pengaturan di TV tetap ada dan TV kembali bekerja sendiri.

## Kalau browser TV ter-refresh

| Keadaan saat refresh | Yang terjadi |
|---|---|
| QR sedang tampil dan masih berlaku | **QR sama muncul lagi**, karena token dan kedaluwarsanya disimpan di localStorage TV |
| QR sudah kedaluwarsa saat halaman terbuka lagi | TV otomatis membuat QR baru |
| HP selesai memindai tepat saat TV refresh | TV mendapati dirinya sudah terhubung saat pengecekan pertama setelah terbuka, lalu lanjut |
| TV sudah terhubung | QR tidak muncul lagi. Kunci TV ada di localStorage, jadi TV langsung menampilkan jadwal dan mengecek perubahan |
| Link HP yang sudah terhubung | **Tidak terpengaruh sama sekali.** Link HP tidak berasal dari QR yang sedang tampil, jadi tetap hidup walaupun QR berganti |

QR hanya sekali pakai dan berlaku 15 menit. Memindai QR lama menampilkan "QR ini sudah tidak berlaku, pindai QR yang tampil di TV".

Di layar penyiapan awal, QR diperbarui otomatis saat habis, paling lama selama 1 jam. Setelah itu pengecekan berhenti dan muncul tombol **Tampilkan QR baru**, supaya TV yang ditinggalkan tidak terus memanggil server.

**Yang bisa memutus TV hanya hilangnya data browser**, misalnya riwayat browser dihapus, profil browser direset, atau TV diganti. Jadwal lalu kembali ke layar penyiapan, dan pengurus memindai QR baru lalu memilih **Hubungkan ke Masjid X**. Tidak ada data yang hilang, karena salinannya ada di server. Foto juga diunduh lagi.

## Arsitektur

```
HP (/atur)                     TV (/layar)
  |                              |   |
  | simpan, foto, sambung        |   | cek perubahan tiap 5 menit, ambil data
  v                              |   v
Vercel: /api/layar/*  <----------+   Supabase RPC (kunci publishable)
  | validasi, batas, kunci rahasia   |
  v                                  v
Supabase: database + penyimpanan foto
```

- **Membaca** langsung ke Supabase, supaya tidak memakai jatah Vercel.
- **Menulis** lewat Vercel, supaya pemeriksaan isi memakai kode yang sama (`normalizeSettings`, `parseCity`) dan kunci rahasia tetap di server.
- Pengecekan TV memakai `fetch` biasa, tanpa `supabase-js`, supaya tetap ringan di browser TV lama.
- Tanpa Realtime di versi pertama. Batas gratisnya 200 koneksi, sedangkan TV menyala terus.

## Data

Tabel diletakkan di skema `layar`, yang tidak dibuka lewat API. Akses hanya melalui fungsi di `public`. SQL di bawah masih draf dan belum pernah dijalankan.

```sql
create schema layar;

create table layar.displays (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,               -- { settings, city }
  version integer not null default 1,
  photo_path text,                   -- nama acak di bucket; null = tanpa foto
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tv_seen_at timestamptz             -- diperbarui paling sering sekali per jam
);

create table layar.keys (
  key_hash bytea primary key,        -- sha256 dari kunci
  display_id uuid not null references layar.displays on delete cascade,
  role text not null check (role in ('tv', 'phone')),
  created_at timestamptz not null default now()
);

create table layar.pairings (
  pair_hash bytea primary key,       -- sha256 dari token di QR
  tv_key_hash bytea not null,        -- kunci yang dibuat TV sendiri
  snapshot jsonb,                    -- data TV saat ini, kalau ada
  expires_at timestamptz not null
);

create table layar.revisions (       -- 5 versi terakhir per masjid
  display_id uuid not null references layar.displays on delete cascade,
  version integer not null,
  data jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (display_id, version)
);

create table layar.rate_limits (
  ip_hash bytea not null,            -- hash IP dengan garam rahasia
  action text not null,
  window_start timestamptz not null,
  count integer not null default 1,
  primary key (ip_hash, action, window_start)
);
```

**Yang ikut disinkronkan:** `settings` dan `city`. **Tetap per perangkat:** ikon suara (`jadwal-shalat:sound`), tema, jadwal tersimpan, dan selisih jam.

**Yang disimpan di TV:** kunci baru `jadwal-shalat:layar` berisi `{ displayId, tvKey, version, photoPath, pending }`, serta `pairing` selama QR tampil.

### Fungsi untuk TV

```sql
create function public.layar_cek(p_key text)
returns table (version integer, photo_path text)
language plpgsql security definer set search_path = ''
as $$
declare d uuid;
begin
  select k.display_id into d from layar.keys k
    where k.key_hash = sha256(convert_to(p_key, 'UTF8'));
  if d is null then return; end if;
  update layar.displays s set tv_seen_at = now()
    where s.id = d and (s.tv_seen_at is null or s.tv_seen_at < now() - interval '1 hour');
  return query select s.version, s.photo_path from layar.displays s where s.id = d;
end $$;

revoke all on function public.layar_cek(text) from public, anon, authenticated;
grant execute on function public.layar_cek(text) to anon;
```

`layar_ambil(p_key)` dibuat sama dan mengembalikan `data`. Fungsi tulis hanya diberikan ke `service_role`.

## API di Vercel

| Rute | Dipanggil oleh | Isi |
|---|---|---|
| `POST /api/layar/sambung` | TV | Membuat QR: hash token, hash kunci TV, data TV saat ini |
| `POST /api/layar/klaim` | HP | Memakai QR: masjid baru atau masjid yang ada, plus kunci HP |
| `GET /api/layar/data` | HP | Data terbaru, versi, dan waktu terakhir TV terhubung |
| `PUT /api/layar/data` | HP, TV | Simpan dengan `baseVersion`; membalas 409 kalau data sudah berubah |
| `PUT /api/layar/foto` | HP, TV | Foto JPEG, paling besar 4 MB |
| `DELETE /api/layar/foto` | HP, TV | Hapus foto |
| `POST /api/layar/putuskan` | TV | Menghapus semua kunci HP |
| `DELETE /api/layar` | HP | Menghapus masjid, kunci, riwayat, dan foto |

Kunci dikirim lewat header `Authorization`, bukan di alamat URL.

## Keamanan

| Risiko | Pencegahan |
|---|---|
| Kunci publishable terlihat di browser | Memang aman menurut Supabase, asalkan tabel tidak terbuka: tabel di skema tertutup, RLS aktif tanpa policy, hanya dua fungsi baca yang diberikan ke `anon` |
| Fungsi `security definer` disalahgunakan | `search_path = ''`, pencabutan hak bawaan, hanya mengembalikan data milik kunci itu. Jalankan Security Advisor Supabase sebelum rilis |
| Kunci rahasia bocor | Hanya di variabel lingkungan Vercel, bukan `NEXT_PUBLIC_`. File `supabase-server.ts` memakai `server-only` |
| Menebak kunci | Kunci 256 bit acak dari `crypto.getRandomValues`, dibuat di perangkat |
| Jamaah memindai QR di layar masjid | QR hanya tampil saat penyiapan atau diminta lewat Pengaturan, sekali pakai, 15 menit, dan tertutup begitu ada yang memakainya |
| Link bocor lewat log | Link memakai fragmen: `/atur#k=...`. Bagian setelah `#` tidak dikirim ke server |
| Link bocor lewat grup WhatsApp | **Putuskan semua HP** di TV, dan riwayat 5 versi untuk mengembalikan isi |
| Isi berbahaya | Dibersihkan `normalizeSettings` di server dan di TV. React sudah meng-escape teks |
| File berbahaya sebagai foto | Server memeriksa bahwa isi file benar-benar JPEG (byte awal `FF D8 FF`). Bucket hanya menerima `image/jpeg`, maksimum 4 MB |
| Pendaftaran massal | Maksimum 10 QR dan 5 masjid baru per IP per jam, data maksimum 64 KB, QR kedaluwarsa dihapus |
| Penyalahgunaan besar-besaran | `LAYAR_SYNC_ENABLED=false` mematikan pendaftaran dan penyimpanan baru tanpa mengganggu jadwal |

Bucket foto bersifat publik dengan nama file acak, karena foto masjid bukan data rahasia dan cara ini tidak memakai jatah Vercel saat diunduh. Foto lama dihapus saat diganti.

Isi tidak dienkripsi dari ujung ke ujung, karena server perlu memeriksa isi dan pengurus bisa terkunci selamanya kalau kuncinya hilang. Akibatnya pemilik proyek bisa membaca data kas, dan ini ditulis terbuka di halaman privasi.

## Aturan sinkron di TV

Dikerjakan di `hooks/use-layar-sync.ts`. Logikanya ditaruh di `lib/layar-sync.ts` supaya bisa dites.

**Kapan mengecek**
- Saat halaman dibuka, saat tab aktif lagi, saat internet kembali, dan tiap 5 menit.
- Jeda diacak ±30 detik, supaya tidak semua TV memanggil bersamaan.

**Saat ada versi baru**
1. Ambil data, bersihkan dengan `normalizeSettings` dan `parseCity`. Kalau hasilnya tidak valid, data lama tetap dipakai.
2. Kalau jendela Pengaturan sedang terbuka di TV, tunda sampai ditutup, supaya isian tidak tertimpa.
3. Simpan, lalu tampilkan "Pengaturan diperbarui" sebentar.
4. Kalau `photoPath` berubah, unduh foto dulu. Foto lama diganti setelah unduhan berhasil.

**Saat mengubah dari TV**
- Dikirim dengan `baseVersion`. Kalau offline, disimpan lokal dengan penanda `pending` dan dikirim saat online.
- Kalau ada perubahan dari HP sementara `pending`, TV memakai data HP dan memberi tahu perubahan di TV tidak terkirim. Perubahan dari TV saat offline dianggap kalah, karena TV jarang diubah setelah terhubung.

**Saat kunci TV tidak berlaku lagi**
- `layar_cek` mengembalikan kosong karena masjid dihapus. TV berhenti mengecek, menghapus kunci, dan tetap memakai pengaturan terakhirnya.
- Kegagalan jaringan **tidak** dianggap kunci tidak berlaku.

**Dua orang mengedit bersamaan**
- Penyimpanan kedua ditolak (409). HP menampilkan "Ada perubahan baru dari pengurus lain" dengan pilihan **Muat data terbaru** atau **Timpa dengan milik saya**.

**Perubahan yang memengaruhi waktu shalat**
- Mengganti kota, koreksi waktu, atau jeda iqamah dari HP meminta konfirmasi dengan ringkasan, misalnya "Kota: Jakarta → Pekanbaru". Salah waktu adalah kesalahan paling fatal.

## Tampilan

**TV**
- Layar penyiapan: QR besar di sisi kiri, formulir di TV sisi kanan.
- Pengaturan > Layar: status "Terhubung ke HP", **Atur dari HP**, dan **Putuskan semua HP**. Bisa dioperasikan dengan remote.

**HP (`/atur`)**
- Halaman penuh, memakai ulang isi tab dari `settings-sections.tsx`, bukan dialog.
- Tombol Simpan menempel di bawah dan peringatan belum disimpan yang sudah ada tetap berlaku.
- Status di atas: nama masjid, "TV terakhir terhubung 2 jam lalu".
- Kalau link tidak berlaku: "Akses sudah dicabut. Pindai QR baru di TV".
- Halaman tidak diindeks mesin pencari (`noindex`).

QR dibuat di browser dengan paket `qrcode`, bukan layanan luar.

## Kalau terjadi gangguan

| Kejadian | Akibat di TV | Akibat di HP |
|---|---|---|
| Internet masjid mati | Jadwal jalan, perubahan menyusul | Tetap bisa menyimpan, status "TV terakhir terhubung" menua |
| Supabase mati atau dijeda | Jadwal jalan | Pesan gagal menyimpan, isian tidak hilang |
| Vercel mati | Jadwal jalan dari service worker | Tidak bisa menyimpan |
| TV mati berhari-hari | Mengambil versi terbaru saat menyala | Pesan bahwa TV sudah lama tidak terhubung |
| Riwayat HP terhapus | Tidak terpengaruh | Pakai link dari pengurus lain, atau pindai QR baru |
| Data browser TV terhapus | Kembali ke penyiapan | Pindai QR, pilih **Hubungkan ke Masjid X** |
| Batas gratis Supabase habis | Jadwal jalan | Tidak bisa menyimpan sampai masalah kuota selesai |

## Biaya

**Syarat pemilik: hanya memakai paket gratis.** Akibatnya:
- Tidak memakai Realtime, branching, atau fitur berbayar lain.
- Kalau mendekati batas, pendaftaran masjid baru ditutup dengan `LAYAR_SYNC_ENABLED=false`. Masjid dan jadwal yang ada tetap jalan.
- Sebelum naik paket, tanggung jawab biayanya dibahas dulu dengan pemilik.

Pengecekan diukur di proyek sungguhan pada 2026-11-03: sekitar 925 byte diterima (25 isi, sekitar 900 header) dan sekitar 275 byte dikirim. Dokumentasi yang dibaca belum memastikan apakah header dihitung sebagai data keluar, jadi angka di bawah memakai perkiraan terburuk.

| Batas gratis Supabase | Pemakaian | Cukup untuk |
|---|---|---|
| Data keluar 5 GB per bulan | Sekitar 8 MB per TV per bulan (8.640 cek × sekitar 925 byte) | Sekitar 500–600 TV menyala terus |
| Database 500 MB | Sekitar 50 KB per masjid dengan riwayatnya | Sekitar 10.000 masjid |
| Penyimpanan 1 GB | Sekitar 0,3–1 MB per foto | Sekitar 1.000–3.000 masjid berfoto |

Sebagai pembanding, paket Pro mulai $25 per bulan, sudah termasuk 250 GB data keluar dan 100 GB penyimpanan.

Proyek gratis dijeda kalau tidak aktif seminggu. Pengecekan TV seharusnya cukup menjaganya tetap aktif, meski Supabase tidak menjaminnya. Pengujian tahap awal yang belum ada TV aktif perlu tugas terjadwal terpisah.

**Batas yang lebih dulu tercapai adalah sinkron jam di Vercel**, sekitar 230 TV menyala terus. Ini perlu dihemat secara terpisah. Lihat `docs/ROADMAP.md`.

## Privasi

Sebelum rilis perlu halaman `/privasi` yang menjelaskan:
- Data yang disimpan: nama masjid, alamat, nama petugas, kas, foto, dan lokasi kalau memakai GPS.
- Hanya berlaku kalau pengguna memilih menghubungkan HP.
- Cara menghapus: **Hapus data masjid dari server**.
- Dihapus otomatis kalau TV dan HP tidak aktif selama 12 bulan.

Nama petugas termasuk data pribadi. Sebaiknya pemilik memeriksa kewajibannya menurut UU Pelindungan Data Pribadi sebelum rilis, karena rancangan ini bukan nasihat hukum.

## Perubahan kode

**File baru**
- `supabase/migrations/*.sql`: skema, fungsi, bucket
- `src/lib/layar-sync.ts`: aturan sinkron tanpa React, beserta tesnya
- `src/lib/layar-keys.ts`: membuat kunci dan token
- `src/lib/supabase-server.ts`: klien server, memakai `server-only`
- `src/hooks/use-layar-sync.ts`
- `src/app/atur/page.tsx`, `src/app/privasi/page.tsx`
- `src/app/api/layar/**`
- `src/components/prayer/atur-page.tsx`, `pairing-qr.tsx`

**File yang berubah**
- `lib/backup.ts`: mengekspor `parseCity`
- `layar-setup.tsx`: pilihan QR
- `mosque-display.tsx`: memasang sinkron dan menunda saat Pengaturan terbuka
- `settings-sections.tsx`: bagian Atur dari HP; isi tab bisa dipakai di luar dialog
- `settings-dialog.tsx`: memberi tahu saat terbuka
- `lib/background.ts`: mengambil foto dari alamat dan memperkecil sampai di bawah 4 MB
- `public/sw.js`: memastikan `/atur` dan `/api/layar` tidak disimpan cache
- Dokumen: `DECISIONS.md`, `ARCHITECTURE.md`, `DOMAIN.md`, `VERIFY.md`, `ROADMAP.md`

Variabel lingkungan: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `LAYAR_IP_SALT`, `LAYAR_SYNC_ENABLED`. Kunci `anon` lama tidak dipakai, karena Supabase sedang menghentikannya.

## Tahapan

1. **Fondasi:** proyek Supabase, skema, fungsi, uji keamanan, dan ukur ukuran respons cek yang sebenarnya.
2. **Sambungan:** QR di TV, `/atur`, klaim, tahan refresh.
3. **Edit mingguan:** simpan, cek, terapkan di TV, konflik, konfirmasi perubahan waktu.
4. **Foto:** unggah dari HP, unduh di TV.
5. **Kendali dan riwayat:** putuskan HP, tambah TV, hapus data, kembalikan versi.
6. **Publik:** halaman privasi, batas pemakaian, panduan pasang, uji di TV sungguhan.

Setiap tahap bisa di-deploy sendiri-sendiri di belakang `LAYAR_SYNC_ENABLED`.

## Pengujian

**Otomatis (Vitest)**
- Aturan versi, `pending`, kunci tidak berlaku versus jaringan gagal, penundaan saat Pengaturan terbuka.
- Data rusak dari server tidak menimpa data TV.
- QR dipakai ulang setelah refresh dan diperbarui saat kedaluwarsa.

**Keamanan (melawan proyek uji Supabase)**
- Kunci publishable tidak bisa membaca atau menulis tabel, dan tidak bisa memanggil fungsi tulis.
- Kunci masjid A tidak bisa membaca atau mengubah masjid B.
- Kunci HP tidak bisa memutuskan HP lain.

**Browser (Puppeteer, dua halaman: TV dan HP)**
- TV dimuat ulang di setiap langkah sambungan.
- TV offline saat HP menyimpan, lalu online.
- Dua HP menyimpan bersamaan.
- Supabase tidak terjangkau: jadwal, pop-up, dan bip tetap jalan.

**Manual**
- TV sungguhan dan remote: membuka Pengaturan, memindai QR dari jarak sebenarnya.
- HP Android dan iPhone: link tetap terbuka setelah ditambahkan ke layar utama. iPhone bisa memisahkan penyimpanan layar utama dari Safari, jadi perlu dicoba.
- Dibiarkan menyala beberapa hari.

## Keputusan yang masih terbuka

1. **Alamat website:** link HP dan QR terikat ke alamat, jadi domain sebaiknya ditetapkan **sebelum** fitur ini dipakai orang. Mengganti alamat setelahnya mematikan link yang sudah dibagikan.
2. **Data kas:** ikut disimpan di server seperti pengaturan lain, atau tetap hanya di TV. Saran: ikut disimpan, karena mengedit kas dari HP adalah salah satu alasan utama fitur ini.
3. **Jangka waktu penghapusan otomatis:** usulan 12 bulan tidak aktif.
4. **Kode ringkas sebagai cadangan QR:** untuk HP yang kameranya sulit memindai. Saran: ditambahkan, misalnya 8 huruf, dengan batas percobaan.
