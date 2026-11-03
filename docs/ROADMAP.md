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

## Akan dibahas lagi

- Mengatur TV dari HP: pindai QR sekali, lalu edit dari link rahasia dan TV mengambil perubahannya sendiri. Butuh database kecil tanpa akun (misalnya Upstash Redis), jadi menunggu keputusan pemilik.

## Tidak direncanakan

- Suara adzan.
