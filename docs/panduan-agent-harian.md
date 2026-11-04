# Panduan Agent Harian, Mingguan, dan Alarm Situs (xpengwins.com)

Hampir semua file di paket ini **baru**. Hanya 2 file lama yang diubah, masing-masing sedikit (lihat bagian 7).

## 1. Apa yang dikerjakan

| Kapan | Apa | File |
|---|---|---|
| Tiap hari, tiba sekitar 06.00 WIB | Biaya Google Ads, sisa dana, klik mencurigakan, domain, sertifikat HTTPS, token sosmed, ringkasan alarm | `build/agent-harian.js`, `harian.yml` |
| Tiap 15 menit | Cek situs hidup. Telegram hanya saat down, pulih, atau masih down (pengingat 3 jam) | `build/uptime.js`, `uptime.yml` |
| Tiap Senin pagi | Rolling gambar dan video beranda | `build/rolling-media.js`, `build/rolling-lib.js`, `data/rolling.json` |
| Tiap Senin pagi | Laporan "Hampir halaman 1" + prompt eksekusi ke Telegram | `build/near-page1.js`, `build/prompt-lib.js` |
| Tiap Senin pagi | Penjaga update artikel + 3 artikel yang layak disegarkan beserta prompt | `build/refresh-artikel.js` |

Catatan jadwal: GitHub sering menjalankan jadwal terlambat (di repo ini 30 sampai 80 menit). Karena itu harian dijadwalkan 05.10 WIB dan mingguan Senin 05.20 WIB, supaya pesan tiba sekitar 06.00.

## 2. Cara pasang (urut, semua bisa dari HP)

1. Upload `agent-baru.zip` ke halaman utama repo (Add file > Upload files). Workflow build yang sudah ada mengekstraknya otomatis.
2. Buat 3 file workflow lewat **Add file > Create new file**. Nama file ditulis lengkap dengan folder, lalu tempel isinya:
   `.github/workflows/harian.yml`, `.github/workflows/uptime.yml`, `.github/workflows/mingguan.yml`
3. Pasang skrip Google Ads (untuk biaya iklan): ikuti petunjuk di kepala file `tools/google-ads-harian.gs`. Skrip hanya membaca data iklan dan menulis ke Google Sheet.
4. Secrets: tidak perlu menambah apa pun bila `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SHEET_ID`, `GSC_KEY`, `GA4_PROPERTY_ID` sudah ada. Opsional: `CHAT_SHEET_ID` bila tab "Chat WA" berada di Google Sheet yang berbeda dari `SHEET_ID`.
5. Tes: tab **Actions** > pilih "Agent harian" > **Run workflow**. Pesan masuk ke Telegram dalam 1 sampai 2 menit.
6. Cek zona waktu Google Sheet: File > Setelan > Zona waktu = Jakarta (agar tanggal tab "Chat WA" cocok).

Bagian yang belum terpasang tidak membuat error. Laporan menulis "Perlu dipasang" dan tetap mengirim bagian lainnya.

## 3. Laporan harian: yang dicek dan batasnya

| Bagian | Peringatan muncul bila | Ubah di |
|---|---|---|
| Dana iklan | sisa dana habis, atau laju sekarang menghabiskan dana 3 hari atau lebih sebelum akhir bulan, atau biaya kemarin lebih dari 1,25x batas aman per hari | `data/iklan-config.json` |
| Klik mencurigakan | 10 klik atau lebih dalam 3 hari dengan 0 aksi chat/WhatsApp; rasio aksi di bawah 2% (30 klik ke atas); lonjakan klik lebih dari 2,5x biasanya; klik tidak valid versi Google 10% ke atas; sesi iklan di Google Analytics kurang dari separuh klik; kurang dari 25% pengunjung iklan bertahan lebih dari 10 detik | `data/iklan-config.json` |
| Domain | berakhir dalam 60 hari | `domain` di `data/iklan-config.json` |
| Sertifikat HTTPS dan token Facebook/Instagram | habis dalam 14 hari atau token tidak valid | tetap |
| Data Search Console | tidak diperbarui 3 hari atau lebih | tetap |

Ini **indikasi, bukan bukti**. Google biasanya mengembalikan biaya klik tidak valid yang terdeteksi. Bila peringatan "klik mencurigakan" muncul berulang, cek laporan klik tidak valid di Google Ads dan pertimbangkan mengecualikan IP atau mempersempit jadwal tayang.

Sebelum dipakai, cek `data/iklan-config.json`: `danaTotal` (1.500.000), `mulai` (3 Nov 2026, tanggal biaya mulai dihitung terhadap dana itu), `akhir` (30 Nov 2026). Samakan `MULAI` di skrip Google Ads.

## 4. Rolling gambar dan video: aman untuk SEO?

Aman karena yang berputar hanya pilihan di **beranda**, berdasarkan nomor minggu:
- Video beranda bergantian di antara 3 video di `data/rolling.json` (tiap Senin WIB).
- Galeri beranda menampilkan jendela 5 foto per model yang bergeser tiap minggu.

Yang sengaja **tidak** berputar: gambar artikel, galeri halaman model, nama file, dan teks alt. Alamat gambar yang sudah dikenal Google tetap sama, jadi tidak ada gambar rusak dan tidak ada kehilangan di Google Gambar. Beranda memakai video dan galeri di bawah layar awal, jadi kecepatan muat halaman (LCP) tidak terpengaruh. Matikan dengan `"aktif": false` di `data/rolling.json`. Tambah video baru dengan menambah baris di `pool` setelah diunggah lewat `upload/video/`.

## 5. Update artikel yang sudah tayang

**Mengganti beberapa kata lalu mengubah tanggal tidak dianjurkan.** Tanggal "Diperbarui" tampil di halaman dan di JSON-LD (`dateModified`). Google hanya mempercayai tanggal bila isi benar-benar berubah, dan mesin AI (GEO/AEO) menilai kesegaran dari isi: angka, tanggal data, fakta, jawaban singkat. Pembaruan kosmetik justru bisa membuat sinyal tanggal situs diabaikan.

Cara yang aman dan sudah dipasang:
1. Tiap Senin skrip memilih sampai 3 artikel yang paling layak disegarkan (menyebut bulan/tahun lama pada topik harga, lama tidak diperbarui, sudah muncul di Google, skor SEO belum 100, hampir halaman 1).
2. Prompt eksekusi dikirim ke Telegram. Claude memeriksa fakta, menambah bagian atau FAQ baru, tanggal data yang jelas, lalu mengisi `updated` **hanya bila isi berubah nyata**. Bila tidak ada yang perlu diubah, Claude tidak mengubah apa pun.
3. **Penjaga**: tiap Senin skrip membandingkan isi dengan catatan minggu lalu. Tanggal berubah tetapi isi hampir sama = peringatan "pembaruan kosmetik". Isi berubah banyak tetapi tanggal belum diisi = pengingat.
4. Jeda: artikel yang diperbarui kurang dari 14 hari atau sudah dikirim dalam 28 hari tidak dipilih lagi. Slug (URL) tidak pernah diubah.

Dengan kecepatan 3 artikel per minggu, 41 artikel tayang kebagian giliran sekitar tiap 3 bulan, dengan prioritas yang paling berdampak lebih dulu.

## 6. Laporan "Hampir halaman 1" dan prompt Telegram

- Rentang posisi 8 sampai 20 dari `data/gsc.json`. Kata kunci berisi tanda kutip atau lebih dari 70 karakter diabaikan (sisa operator pencarian).
- Pesan pertama berisi ringkasan 10 halaman teratas. Pesan berikutnya (default 3) masing-masing berisi satu **prompt dalam blok yang bisa disalin** (ketuk blok di Telegram).
- Cara pakai: salin satu prompt, tempel ke Claude. Claude mengubah `data/articles.json` atau `data/models.json`, menghitung skor SEO, commit, dan **push ke main**, lalu workflow build jalan otomatis.
- Claude harus punya akses tulis ke repo `xpengwins/xpeng-site`. Bila tidak ada, prompt menyuruh Claude berhenti dan memberi tahu, tanpa membuat salinan.
- Halaman yang sudah dikirim dalam 14 hari tidak dikirim ulang (paksa lewat Run workflow > kirim_ulang = yes). Halaman yang baru diperbarui dalam 10 hari dilewati.
- Data Search Console masih tipis (333 tayang dalam 28 hari). Kerjakan dari halaman teratas saja, jangan sekaligus banyak, agar efeknya terlihat.

## 7. File lama yang diubah (kecil)

1. `build/agent-brief.js`: jendela kirim ringkasan Senin diperlebar dari 06.00 sampai 09.59 menjadi 06.00 sampai tengah malam WIB. Jadwal GitHub sering terlambat, sehingga ringkasan 26 Okt dan 2 Nov kemungkinan terlewat. Kiriman dobel tetap dicegah oleh catatan mingguan.
2. `build/build.js`: (a) memakai `data/rolling.json` untuk video dan galeri beranda, (b) `lastmod` di sitemap untuk artikel kini memakai tanggal update nyata (sebelumnya semua halaman memakai tanggal build, yang membuat Google cenderung mengabaikan lastmod). Halaman lain tidak berubah. Dibandingkan dengan build lama, hanya `index.html` dan `sitemap.xml` yang berbeda.

## 8. Bila ada masalah

- Tidak ada pesan harian: tab Actions > "Agent harian" > buka log. Tiap bagian menulis alasan bila dilewati.
- Tab "Iklan Harian" kosong: jalankan skrip di Google Ads sekali secara manual dan cek Log.
- Alarm situs terlalu sering: itu hanya terkirim setelah 3 percobaan gagal berturut-turut. Cek `data/uptime-state.json` untuk riwayat gangguan.
