# Manual Book Website XPeng Premium

Versi 1.0 | Untuk admin dan tim marketing

## 1. Gambaran sistem
| Bagian | Fungsi | Teknologi |
|---|---|---|
| Website publik | Halaman beranda, model, pricelist, artikel, test drive | HTML statis (sangat cepat) |
| Admin | Mengatur semua isi website dari HP | Halaman web + GitHub API |
| Penyimpanan | Semua data (JSON) dan foto | Repository GitHub |
| Robot build | Membuat halaman, sitemap, skor SEO, ekstrak ZIP, kompres gambar, backup | GitHub Actions |

Alurnya: Anda simpan di Admin → data masuk ke GitHub → robot membangun ulang website → website live (±1-2 menit).

Keunggulan: tidak ada server yang harus dirawat, biaya hosting nol, skor kecepatan tinggi, HP cukup untuk semua pekerjaan.

## 2. Struktur folder
- `data/` isi website: site, models, articles, keywords, backlinks, laporan SEO.
- `assets/img/` foto (WebP), logo SVG, favicon.
- `shared/` mesin Markdown dan penilai SEO.
- `build/` generator halaman, optimasi gambar, backup.
- `admin/` panel admin.
- `upload/` tempat ZIP diunggah (otomatis diekstrak lalu dihapus).
- `backup/` salinan data harian.
- `.github/workflows/build.yml` robot otomatis.

## 3. Menu Admin
**Beranda** ringkasan skor SEO dan jalan pintas.
**Artikel** tulis dan edit artikel dengan skor SEO langsung, saran internal link, pratinjau.
**Model** edit data mobil: varian, warna, galeri, spesifikasi, FAQ.
**SEO** laporan skor, peringkat artikel, cek teknis, keyword, riwayat.
**Lainnya**: Pricelist, Keyword, Backlink, Media & Zip, Backup, Pengaturan, Keluar.

## 4. Menulis artikel standar SEO
Aturan konten (wajib): riset dulu, tulis sendiri dengan kata-kata sendiri, tidak menyalin, cek skor sebelum terbit.

Checklist yang dinilai otomatis (skor 0-100, target minimal 80):
1. Judul 30-60 karakter dan memuat keyword utama.
2. Meta description 120-160 karakter dan memuat keyword.
3. Slug pendek dan memuat kata kunci.
4. Isi minimal 800 kata, keyword muncul di 100 kata pertama, kepadatan 0,5-2,5%.
5. Minimal 3 subjudul H2, tidak ada H1 tambahan di isi.
6. Minimal 3 internal link dan 1 link keluar ke sumber tepercaya.
7. Gambar utama dan semua gambar punya alt text.
8. Kalimat pendek (rata-rata maks 20 kata), paragraf tidak lebih dari 90 kata.
9. **AEO**: awali dengan `**Jawaban singkat:**` dan tambahkan FAQ minimal 3 pertanyaan.
10. **GEO**: pakai daftar atau tabel agar mudah dikutip mesin AI.
11. Orisinal: kemiripan dengan artikel lain di bawah 30%.

Rumus penulisan cepat:
- Paragraf 1: jawaban singkat + keyword.
- 3-5 subjudul H2 berisi jawaban rinci, daftar, tabel.
- Bagian "Pertanyaan yang sering diajukan" dengan `###` untuk tiap pertanyaan.
- Ajakan test drive (otomatis ditambahkan kotak WhatsApp).

Catatan jujur: skor ini mengukur kualitas on-page. Posisi Google tergantung persaingan, usia domain, dan backlink. Keyword hard butuh waktu berbulan-bulan.

## 5. Strategi keyword
- **Low** (pertanyaan spesifik): kerjakan dulu, cepat terindeks, membangun otoritas.
- **Medium** (harga model, varian): halaman model dan pricelist.
- **Hard** (merek, kategori): didukung banyak artikel + backlink bertahap.
Satu keyword utama per artikel. Hindari dua artikel bersaing untuk keyword yang sama.

Ranking asli: pakai Google Search Console (gratis), salin posisi ke menu Keyword. Admin mencatat tren naik/turun.

## 6. Internal link
- Saat menulis, tekan tombol saran link di bawah editor.
- Saat build, robot menambah maksimal 3 link otomatis dari daftar keyword ke halaman tujuannya (sekali per halaman).
- Pastikan setiap artikel menaut ke minimal 1 halaman model dan pricelist.

## 7. Backlink aman
Gunakan situs milik sendiri (geelywins.co, LapakMu.store, dan 2 domain baru):
- Tulis konten unik dan relevan di tiap situs, jangan menyalin teks yang sama.
- Satu link per artikel. Anchor bervariasi (brand, URL, umum, sebagian keyword). Maksimal 20% keyword persis.
- Naik bertahap, 2-4 link per minggu.
- Jangan beli link dan jangan jaringan situs kosong.
- Tambahan alami: Google Business Profile, YouTube, Instagram, direktori otomotif, liputan media.
Menu Backlink membantu mencatat rencana dan memperingatkan anchor yang terlalu seragam.

## 8. Kecepatan dan gambar
- Semua gambar dikonversi ke WebP maksimal 1600 px dan di bawah ±250 KB, saat upload lewat Admin dan oleh robot untuk ZIP.
- Tanpa font dan library berat. Gambar di bawah layar dimuat belakangan (lazy).
- Halaman awal tidak memakai framework, sehingga cepat di HP.

## 9. Upload ZIP ke GitHub
1. Admin > Lainnya > Media & Zip > Upload file ZIP.
2. Pilih lokasi tujuan (default `assets/img`), pilih ZIP, tekan upload.
3. Robot mengekstrak, mengecilkan gambar, menghapus ZIP, lalu membangun ulang situs.
Batas: ±70 MB per ZIP. Tujuan hanya boleh folder `assets` atau `files` (untuk keamanan).
ZIP yang diunggah manual langsung ke folder `upload/` lewat web GitHub juga diekstrak otomatis (nama file: `assets__img--nama.zip` untuk tujuan `assets/img`).

ZIP project pertama: unggah `xpeng-site.zip` ke root repo lewat web GitHub. Robot mengekstraknya otomatis (file `.github/workflows/build.yml` ditempel manual sekali).

## 10. Backup dan pemulihan
- Otomatis: tiap malam pukul 03:00 WIB, 14 salinan terakhir di `backup/`.
- Manual: Admin > Backup > Unduh atau Simpan ke GitHub.
- Pulihkan: unggah file backup JSON di menu Backup.
- Semua riwayat perubahan juga tersimpan di GitHub (Commits), bisa dikembalikan.

## 11. Keamanan
- Token GitHub hanya disimpan di HP Anda. Aktifkan PIN agar token terenkripsi.
- Beri token izin hanya ke repo ini. Atur masa berlaku (misal 90 hari).
- Halaman admin tidak diindeks Google (noindex dan robots.txt).
- Jangan bagikan token. Jika HP hilang, hapus token di GitHub Settings.

## 12. Pemecahan masalah
| Masalah | Solusi |
|---|---|
| Website belum berubah | Tunggu 2 menit, cek tab Actions di repo apakah ada tanda merah |
| Gagal masuk Admin | Cek username, nama repo, token, dan izin Contents |
| Tombol build gagal | Token perlu izin Actions: Read and write |
| Skor teknis rendah | Isi URL website dan nomor WhatsApp di Pengaturan |
| Gambar terlalu besar | Upload lewat Admin atau tunggu robot mengecilkan |
| Link rusak di laporan | Cek path di Model/Artikel, perbaiki lalu simpan |

## 13. Catatan penting
- Spesifikasi di data awal berasal dari berita dan harus dicocokkan dengan brosur resmi sebelum tayang. Khususnya New X9 Pro/Pro+.
- Harga mengikuti pricelist Juli 2026 dari Anda.
- Nama XPeng dan logonya milik pemegang mereknya. Pastikan dealer mengikuti pedoman identitas merek resmi.

---

## Tambahan: jadwal publish, leasing, Tentang, Kontak

### Status artikel dan jadwal publish
Menu **Artikel** punya 4 status:
- **Draft**: masih ditulis, tidak tampil di website.
- **Siap publish**: sudah selesai, menunggu. Tombol **Terbitkan** di daftar artikel menerbitkannya seketika.
- **Terjadwal**: isi tanggal dan jam (WIB). Artikel terbit otomatis pada build pertama setelah waktunya tiba.
- **Terbit**: tampil di website.

Gunakan filter di atas daftar (Semua, Draft, Siap, Terjadwal, Terbit). Kartu **Jadwal publish** menampilkan urutan artikel yang akan terbit.
Catatan: build berjalan tiap jam (cron di build.yml), jadi jam terbit akurat dalam kisaran 1 jam. Bila build.yml belum diperbarui, artikel terjadwal terbit paling lambat 03:00 WIB berikutnya.
Artikel dengan skor SEO di bawah 80 akan diberi peringatan sebelum disimpan sebagai siap, terjadwal, atau terbit.

### Partner leasing (marquee)
Menu **Lainnya > Leasing**: tambah nama leasing, upload logo (PNG, JPG, WebP, SVG), atur urutan dengan tombol panah, lalu Simpan. Logo tampil berjalan otomatis di halaman Model, Pricelist, dan Beranda. Bila daftar kosong, bagian ini tidak tampil. Isi hanya leasing yang benar-benar bekerja sama dengan dealer.

### Halaman Tentang
Menu **Lainnya > Tentang & lokasi**: teks profil, layanan, jam operasional, foto dealer (upload langsung), sejarah perusahaan (tahun, judul, cerita), dan Google Maps. Peta otomatis memakai alamat di Pengaturan. Untuk titik yang lebih tepat, buka Google Maps > Bagikan > Sematkan peta > salin kode iframe, lalu tempel di kolom Embed.

### Halaman Kontak
Data diambil dari **Pengaturan**: nomor WhatsApp, telepon, email, alamat, serta URL Instagram, TikTok, YouTube, dan Facebook. Ikon sosmed hanya tampil bila URL-nya diisi.

### Memperbarui build.yml (sekali saja)
Ganti isi `.github/workflows/build.yml` di GitHub dengan file build.yml terbaru (build tiap jam), karena file workflow tidak bisa diperbarui lewat ZIP.

### Upload ZIP ke repo dan proses GitHub Actions (v6)
Menu **Lainnya > Media & Zip**, kartu **Upload ZIP ke repo**: pilih ZIP, admin menampilkan isinya dan memberi peringatan bila ZIP berisi folder data/ atau file sistem. ZIP dikirim ke bagian depan (root) repo, lalu GitHub Actions mengekstraknya ke dalam repo dengan susunan folder yang sama seperti di ZIP (contoh: assets/img/foto.webp). Folder pembungkus tunggal (misalnya "xpeng-site/") dibuang otomatis. File bernama sama ditimpa. Folder .github tidak pernah diubah.
Kartu **Proses GitHub Actions** (juga ada di Beranda) menampilkan 5 proses terakhir (berhasil, gagal, berjalan) dan tombol **Jalankan workflow sekarang**. Bila gagal, buka Detail dan kirim tangkapan layar langkah yang bertanda merah.
Penting: pembuangan folder pembungkus butuh build.yml terbaru (tempel ulang sekali di GitHub).
