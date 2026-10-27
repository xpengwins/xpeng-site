# Panduan Agent 8: pantau pengunjung website

Agent ini membaca Google Analytics 4 (resmi dan gratis) lalu menampilkan jumlah pengunjung di **Admin, Beranda, kartu "Pengunjung website"** dan mengirim ringkasan harian ke Telegram (run malam 21.30 WIB). Peringatan juga dikirim jika pengunjung turun tajam.

Yang ditampilkan: pengunjung hari ini, kemarin, 7 hari, 30 hari, grafik harian, halaman terpopuler, sumber pengunjung (Google, langsung, sosmed), dan klik penting (WhatsApp, test drive, telepon, email, brosur).

## Pasang (sekali saja, bisa dari HP, sekitar 10 menit)

1. **Aktifkan API.** Buka `console.cloud.google.com`, pilih proyek yang sama dengan kunci Search Console Anda. Ketuk menu, **APIs & Services**, **Library**, cari **Google Analytics Data API**, ketuk **Enable**.
2. **Salin email akun layanan.** Di Google Cloud: **IAM & Admin**, **Service Accounts**. Salin email berbentuk `nama@proyek.iam.gserviceaccount.com`. Itu akun yang sama dengan yang Anda tambahkan di Search Console.
3. **Beri akses di Google Analytics.** Buka `analytics.google.com`, **Admin** (ikon roda gigi), kolom **Property**, **Property access management**, ketuk **+**, **Add users**. Tempel email tadi, pilih peran **Viewer**, lalu **Add**.
4. **Salin Property ID.** Di **Admin**, **Property settings**, salin angka **Property ID** (angka saja, contoh `412345678`). Ini bukan kode `G-...`.
5. **Simpan di GitHub.** Repo `xpeng-site`, **Settings**, **Secrets and variables**, **Actions**, **New repository secret**. Name: `GA4_PROPERTY_ID`. Secret: angka tadi.
6. **Tes.** **Actions**, **Agent pantau**, **Run workflow**. Setelah selesai, buka Admin Beranda. Kartu Pengunjung terisi.

Jika gagal, buka langkah "Agent 8" di log run. Pesannya menjelaskan penyebabnya (misalnya akun belum jadi Viewer, atau API belum aktif).

## Catatan jujur

- Angka berasal dari Google Analytics. Pengunjung yang menolak atau memblokir pelacakan tidak terhitung, jadi angka ini sedikit lebih kecil dari pengunjung sebenarnya.
- Data hari ini bisa naik beberapa jam ke depan karena GA4 menunda pemrosesan.
- GA4 baru menghitung sejak kode pelacakan terpasang. Situs ini sudah memasang kode GA4.
- Ini jumlah pengunjung website. Jangkauan sosmed dan Search Console tetap di agent lainnya.

## Mengubah pengaturan

Buat `data/traffic-config.json`, contoh: `{"daily": false}` untuk mematikan ringkasan harian, `{"dropAlertPct": 40}` untuk peringatan turun lebih sensitif.
