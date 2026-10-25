# Panduan Agent Pantau xpengwins.com

Semua file di paket ini **baru**. Tidak ada file lama yang diubah atau ditimpa.

## Peta agent: apa yang sudah ada, apa yang baru

| Agent | Sudah ada sebelumnya (tidak disentuh) | Baru di paket ini |
|---|---|---|
| 1. Konten & SEO | Skor SEO otomatis (`shared/seo.js`), laporan `seo-report.json`, terbit terjadwal (`build.js`) | `build/agent-brief.js`: daftar tugas konten dari data nyata (judul yang perlu diperbaiki, hampir halaman 1, ide artikel dari pencarian asli) |
| 2. Traffic & sosmed | Tarik Search Console (`gsc.js`), laporan Telegram + Sheets (`notify.js`) | `build/monitor-sosmed.js`: interaksi FB/IG/Threads, sinyal kebijakan, posting terlalu rapat. Juga ringkasan mingguan di `agent-brief.js` |
| 3. Kecepatan & error | Cek link rusak dan ukuran gambar saat build | `build/monitor-speed.js`: cek semua URL (404/500/lambat) + PageSpeed mobile halaman kunci, deteksi pelambatan |
| 4. Distribusi | Posting FB, IG, Threads, Telegram otomatis + antrean admin (`social.js`) | Tidak ada. Sudah lengkap, jadi tidak dibuat ulang |
| 5. Chat & follow up | Belum ada | Menyusul (sesuai urutan) |
| 6. Saran topik (riset tren) | Belum ada | `build/riset-tren.js` + halaman `admin/saran.html`: saran topik 70:30 (inti : luas), diperbarui otomatis tiap Senin |

## Pasang (3 langkah, bisa dari HP)

1. Di GitHub repo `xpeng-site`: **Add file, Upload files**, unggah `agent-pantau-xpeng.zip` ke folder utama. Sistem lama otomatis mengekstraknya (sama seperti yang sudah biasa Anda pakai).
2. **Add file, Create new file**. Nama file: `.github/workflows/monitor.yml`. Tempel isi file `monitor.yml`. Commit.
3. Buka tab **Actions**, pilih **Agent pantau**, **Run workflow**. Isi `kirim_ringkasan` = `yes` untuk tes. Tunggu sekitar 3 menit, cek Telegram.

Secret yang dipakai sudah ada semua (TELEGRAM_*, FB_*, IG_*, THREADS_*). Satu yang **opsional**: `PSI_KEY` (kunci gratis PageSpeed dari Google Cloud). Tanpa kunci tetap jalan, tapi kadang kena batas kuota.

## Jadwal

- Otomatis 2x sehari: 09:30 dan 21:30 WIB.
- Ringkasan mingguan masuk Telegram tiap Senin pagi.
- Peringatan hanya dikirim untuk masalah **baru**. Masalah yang sama tidak dikirim berulang.

## Cara membaca peringatan

| Ikon | Arti | Tindakan |
|---|---|---|
| ❌ | Halaman error (404/500) atau tidak bisa dibuka | Perbaiki halaman atau sitemap |
| 🔴 / 🟠 | Skor mobile rendah, LCP lambat, layout bergeser, klik tertahan | Kompres gambar, kurangi skrip |
| 📉 | Skor turun dibanding sebelumnya, atau interaksi/jangkauan sosmed turun tajam | Cek perubahan terakhir, cek status akun |
| 🚫 | Sinyal kebijakan (kode error terkait spam/pembatasan) | Buka Meta Business Suite, Kualitas Akun |
| 🔑 | Token rusak atau hampir kedaluwarsa | Perpanjang token (lihat `docs/panduan-posting-sosmed.md`) |
| ⚠️ | Posting terlalu rapat atau terlalu banyak per hari | Beri jeda, kurangi frekuensi |
| ⏳ | Kuota posting hampir habis | Tunda posting berikutnya |

## Batas yang perlu Anda tahu

- Meta **tidak** punya API yang berkata "akun Anda dilemahkan". Agent ini membaca **sinyal** (kode error, kuota, pola posting, penurunan interaksi). Itu peringatan dini, bukan vonis. Status resmi tetap di Meta Business Suite.
- Penurunan interaksi baru dihitung jika rata-rata sebelumnya minimal 3 per post. Akun baru yang interaksinya masih kecil tidak akan memicu alarm palsu.
- Data Search Console masih sangat kecil (situs baru), jadi saran di ringkasan mingguan baru bermakna setelah beberapa minggu.
- Skor PageSpeed bisa naik turun beberapa poin tiap pengukuran. Peringatan "turun" baru muncul jika selisih 10 poin atau lebih.

## Alur Agent 1 (menulis artikel)

1. Ringkasan mingguan memberi daftar tugas (perbaiki judul, perkuat halaman, ide artikel).
2. Anda kirim daftar itu ke Claude di project ini. Claude riset, tulis ulang orisinal 800+ kata, cek skor, cek harga ke pricelist resmi.
3. Draf masuk Admin berstatus **Siap publish**. Anda yang menyetujui terbit.

## Agent 6: Saran Topik (riset tren niche)

**Hanya saran.** Agent ini tidak menulis atau menerbitkan artikel. Hasilnya muncul di halaman admin **Saran Topik** dan diperbarui **otomatis tiap Senin pagi**, tanpa perlu diperintah.

**Buka:** `https://xpengwins.com/admin/saran.html` (juga ada tombol "Kembali ke Admin" di halaman itu). Tautannya ikut dikirim di ringkasan Telegram hari Senin.

**Komposisi 70:30:** 70% niche inti (XPeng, mobil listrik, SPKLU, baterai, pajak EV, pesaing EV) dan 30% niche luas (otomotif umum: merawat mobil, asuransi, kredit, hybrid, mudik, BBM). Topik luas selalu diberi saran menautkan ke halaman model XPeng agar pembaca mengalir ke pricelist dan test drive. Jika topik inti minggu itu kurang, sisanya diisi topik luas dan komposisi aktual tampil di halaman.

**Sumber (gratis, tanpa kunci):** Google News RSS, Google Trends RSS (Indonesia), Google Autocomplete.

**Yang dilakukan:**
1. Ambil berita 14 hari terakhir. Berita yang dibahas banyak media dijadikan satu topik.
2. Ambil topik naik di Google Trends yang nyambung ke niche. Yang nyambung tipis diberi tanda dan nilainya dikurangi.
3. Ambil pertanyaan nyata (apakah, berapa, cara, vs, biaya, garansi) yang diketik orang. Cocok untuk Jawaban singkat dan FAQ.
4. Buang topik yang sudah ada artikelnya. Yang mirip artikel lama diberi tanda "mirip artikel lama" supaya artikel itu diperbarui, bukan dibuat ganda.
5. Simpan 20 ide teratas di `data/riset-tren.json`, lengkap dengan alasan, saran sudut, catatan risiko, dan tautan sumber.

**Cara pakai di halaman Saran Topik:** pilih filter (inti, luas, berita, tren, pertanyaan, baru), ketuk **Salin perintah ke Claude**, lalu tempel ke chat project ini. Claude akan riset sumber resmi dan menulis artikel orisinal.

**Perbarui sekarang (tanpa menunggu Senin):** GitHub, tab Actions, **Agent pantau**, Run workflow, isi `riset_sekarang` = `yes`. Run pertama kali (belum ada data) otomatis langsung jalan.

**Aturan konten (penting):** agent ini hanya mengumpulkan IDE dan tautan. Judul dan isi berita **tidak disalin**. Artikel ditulis ulang orisinal dari data resmi. Topik berbau harga/angka wajib pakai pricelist atau sumber resmi. Topik sensitif (kebakaran, kecelakaan, banjir) ditandai agar ditulis netral.

**Mengubah niche atau komposisi:** buat file `data/riset-tren-config.json` berisi hanya bagian yang ingin diganti, misalnya `{"ratio": {"inti": 80, "luas": 20}, "top": 20}`. Mau notifikasi Telegram untuk topik panas? Isi `{"hotAlert": true}`.

**Catatan jujur:** Google tidak menyediakan API resmi untuk Trends. RSS dan Autocomplete yang dipakai gratis tetapi bisa berubah atau dibatasi sewaktu-waktu. Jika satu sumber gagal, sumber lain tetap jalan. Jika semua gagal, data lama dipertahankan dan tidak ada yang rusak. Halaman admin lama (`admin/app.js`) **tidak diubah**: Saran Topik adalah halaman terpisah.
