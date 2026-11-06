# Rencana

Urutan sesuai saran terakhir; prioritas akhir ditentukan pemilik.

## Wajib sebelum diposting ke publik

Prioritas pertama:

- [x] Penyiapan awal di `/layar`: pilih kota dan isi nama masjid saat pertama dibuka
- [x] Pesan "Klik sekali untuk mengaktifkan suara" di layar TV selama audio masih diblokir
- [x] Tes otomatis logika waktu: fase adzan/iqamah, Jumat, pergantian bulan, zona waktu, layar malam, aturan refresh

Setelah itu:

- [ ] Uji di perangkat TV sungguhan, termasuk dibiarkan menyala beberapa hari
- [ ] Panduan pasang singkat: perangkat yang dipakai, cara layar penuh, yang harus dilakukan setelah listrik mati
- [ ] Keterangan sumber jadwal dan cara melapor kesalahan

## Keandalan

- [x] Koreksi otomatis kalau jam perangkat meleset

## Untuk masjid

- [x] Foto latar layar TV dari foto masjid sendiri
- [ ] Beberapa foto latar yang berganti perlahan
- [ ] Pengumuman dan berita duka dengan tanggal mulai dan selesai
- [ ] Slide gambar (QRIS infaq, poster) dari link, disimpan agar tetap tampil offline
- [ ] Cetak jadwal imsakiyah Ramadhan

## Untuk jamaah

- [ ] Hari besar Islam dan puasa sunnah (tanggal Hijriah diberi keterangan "perkiraan")
- [ ] Notifikasi sistem
- [ ] Arah kiblat

## Teknis

- [ ] Halaman `/bulanan` bisa dipakai offline

## Atur dari HP (sebelum diposting)

Pemilik ingin memposting setelah fitur ini jadi. Rancangan: `docs/RANCANGAN-ATUR-DARI-HP.md`.

- [x] Tahap 1, fondasi: skema terpasang di proyek Supabase, keamanan diuji dari luar, ukuran pengecekan diukur. Hanya paket gratis
- [x] Tahap 2, sambungan: QR di TV, `/atur`, tahan refresh, tambah HP, TV kedua atau pengganti. Belum dicoba dengan kamera HP sungguhan
- [x] Tahap 3, edit mingguan: simpan dari HP, TV mengecek tiap 5 menit, perubahan di TV ikut terkirim, konflik, konfirmasi perubahan waktu
- [x] Tahap 4, foto dari HP: unggah dan hapus dari HP atau TV, TV mengunduh sendiri, foto lama dihapus
- [x] Tahap 5a, kendali: pengelola utama, undangan per orang, persetujuan HP baru, batas 3 HP, reset darurat dengan PIN, pembersihan kunci TV yang hilang
- [x] Tahap 5b, riwayat: pengelola utama mengembalikan salah satu dari 5 versi terakhir (disimpan sebagai versi baru), dan menghapus data masjid beserta fotonya
- [ ] Tahap 6, publik: halaman privasi, batas pemakaian

## Akan dibahas lagi

- Menghemat sinkron jam di Vercel (sekarang 3 panggilan tiap 30 menit per perangkat, batas gratis tercapai di sekitar 230 TV menyala terus).

## Tidak direncanakan

- Suara adzan.
