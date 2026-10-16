# Panduan Cepat: Pasang Website XPeng dari HP (±20 menit)

Semua dikerjakan dari browser HP. Tidak perlu komputer.

## Tahap 1. Siapkan GitHub (sekali saja)
1. Buka github.com, login, tekan **+** > **New repository**.
2. Nama: `xpeng-site`. Pilih **Public**. Tekan **Create repository**.
3. **Pasang robot (sekali saja, 2 menit)**: di repo tekan **Add file** > **Create new file**. Pada kolom nama ketik `.github/workflows/build.yml` (ketik `/` agar terbentuk folder). Tempel seluruh isi file `build.yml` yang ada di paket ini, lalu **Commit changes**.
4. **Upload ZIP project**: tekan **Add file** > **Upload files**, pilih `xpeng-site.zip`, **Commit changes**. Robot GitHub otomatis mengekstrak ZIP ke seluruh repo, mengecilkan gambar, membangun website, lalu menghapus ZIP-nya. Pantau di tab **Actions** (centang hijau = selesai, ±2 menit).
   - Catatan: GitHub tidak mengizinkan robot mengubah folder `.github`, itu sebabnya langkah 3 dikerjakan manual.
5. Setelah ini, semua upload (foto, ZIP) cukup lewat menu Admin.

## Tahap 2. Aktifkan website (GitHub Pages)
1. Repo > **Settings** > **Pages**.
2. Source: **Deploy from a branch**. Branch: **main**, folder **/ (root)**. Simpan.
3. Tunggu 1-2 menit. Alamat web: `https://USERNAME.github.io/xpeng-site/`.

## Tahap 3. Izinkan Actions menulis
1. Repo > **Settings** > **Actions** > **General**.
2. Bagian *Workflow permissions*: pilih **Read and write permissions**. Simpan.

## Tahap 4. Buat token untuk Admin
1. GitHub > foto profil > **Settings** > **Developer settings** > **Personal access tokens** > **Fine-grained tokens** > **Generate new token**.
2. Repository access: **Only select repositories** > pilih `xpeng-site`.
3. Permissions: **Contents: Read and write** dan **Actions: Read and write**.
4. Generate, salin token (tampil sekali). Simpan di tempat aman. Jangan dibagikan.

## Tahap 5. Masuk Admin
1. Buka `https://USERNAME.github.io/xpeng-site/admin/`.
2. Isi username, nama repo `xpeng-site`, branch `main`, token. Buat PIN 4+ angka (disarankan).
3. Tambahkan ke layar utama HP (menu browser > Add to Home screen).

## Tahap 6. Isi data awal (wajib)
Admin > **Lainnya** > **Pengaturan**:
- Nama dealer, WhatsApp (format 62812xxxx), alamat, telepon.
- **URL website**: ganti `USERNAME` dengan username GitHub Anda (atau domain sendiri nanti).
Simpan. Tunggu 1-2 menit, website ter-update otomatis.

## Tahap 7. Mulai konten
- **Model**: edit teks, warna, galeri.
- **Pricelist**: ubah harga dan periode.
- **Media**: upload foto asli (otomatis jadi WebP ringan).
- **Artikel**: tulis, cek skor SEO minimal 80, lalu ubah status ke `published`.
- **SEO**: pantau skor dan perbaiki yang bertanda ❌.

## Setelah punya domain
Ganti `URL website` di Pengaturan. Di repo Settings > Pages isi Custom domain. Lalu daftarkan sitemap di Google Search Console: `https://domain-anda/sitemap.xml`.
