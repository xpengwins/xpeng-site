# Panduan Posting Otomatis dan Manual ke Sosmed

Fitur ini memposting artikel xpengwins.com ke **Facebook Page, Instagram, Threads** (dan Telegram untuk kirim ulang manual).

- **Otomatis:** artikel yang baru terbit ikut diposting (aktifkan di Admin, menu Lainnya, Sosmed).
- **Manual:** di Admin, menu Lainnya, Sosmed, ketuk **Posting** pada artikel.
- **Telegram:** pengumuman artikel baru sudah otomatis dari fitur laporan yang lama. Tidak perlu diatur ulang.

Platform yang tokennya belum diisi akan **dilewati otomatis**. Jadi aman diaktifkan satu per satu.

> **PENTING:** repo ini publik (GitHub Pages). **Jangan pernah** menaruh token di file repo atau menempelkannya di chat. Token hanya boleh disimpan di **GitHub Secrets** (Langkah 4).

Nama menu di Meta sering berubah. Jika namanya sedikit berbeda, cari yang paling mirip. Langkah 2 dan 3 lebih nyaman di Chrome HP dengan mode **Situs desktop**.

---

## Langkah 1. Siapkan akun (sekali saja)

1. Buat **Facebook Page** XPeng (bukan profil pribadi).
2. Ubah Instagram XPeng menjadi akun **Profesional** (Business atau Creator).
3. **Hubungkan Instagram ke Facebook Page** tadi (Page, Settings, Linked accounts, Instagram).
4. Buka **Threads** dan login dengan akun Instagram yang sama.

## Langkah 2. Buat aplikasi Meta dan ambil token Facebook + Instagram

1. Buka **developers.facebook.com**, login, lalu **My Apps, Create App**. Pilih tipe **Business**.
2. Catat **App ID** dan **App Secret** (Settings, Basic).
3. Buka **developers.facebook.com/tools/explorer** (Graph API Explorer). Pilih aplikasi Anda.
4. Tambahkan izin: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `business_management`.
5. Ketuk **Generate Access Token**, setujui semua, dan pilih Page + akun Instagram XPeng.
6. Tukar menjadi token panjang. Buka alamat ini di browser (ganti huruf besar dengan milik Anda):

   `https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=TOKEN_PENDEK`

   Hasilnya `access_token` panjang. Sebut saja **TOKEN_PANJANG**.
7. Ambil token Page. Buka:

   `https://graph.facebook.com/v25.0/me/accounts?access_token=TOKEN_PANJANG`

   Cari Page XPeng. Salin `id` (= **FB_PAGE_ID**) dan `access_token` (= **FB_PAGE_TOKEN**, token ini tidak kedaluwarsa).
8. Ambil ID Instagram. Buka:

   `https://graph.facebook.com/v25.0/FB_PAGE_ID?fields=instagram_business_account&access_token=FB_PAGE_TOKEN`

   Salin angka di `instagram_business_account.id` (= **IG_USER_ID**).

> Selama aplikasi Meta tetap berstatus **Development** dan Anda adalah admin aplikasinya, posting ke Page milik sendiri bisa jalan tanpa App Review.

## Langkah 3. Token Threads

1. Di aplikasi Meta yang sama, tambahkan use case **Threads API** (izin `threads_basic` dan `threads_content_publish`).
2. Tambahkan akun Threads Anda sebagai **Threads Tester** (App roles, Roles). Terima undangannya di aplikasi Threads.
3. Di pengaturan Threads API gunakan **User Token Generator**, lalu buat token untuk akun Threads XPeng. Catat juga **User ID**-nya (= **THREADS_USER_ID**).
4. Tukar menjadi token panjang (berlaku 60 hari):

   `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=APP_SECRET&access_token=TOKEN_PENDEK`

   Hasilnya adalah **THREADS_TOKEN**.

> **Token Threads kedaluwarsa tiap 60 hari.** Perpanjang sebelum itu (setelah umur token lebih dari 24 jam) dengan membuka:
> `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=THREADS_TOKEN`
> lalu ganti isi secret `THREADS_TOKEN` dengan token baru. Pasang pengingat kalender tiap 50 hari.

## Langkah 4. Simpan ke GitHub Secrets

Repo `xpeng-site`, **Settings, Secrets and variables, Actions, New repository secret**. Buat satu per satu:

| Nama secret | Isi |
|---|---|
| `FB_PAGE_ID` | ID Facebook Page |
| `FB_PAGE_TOKEN` | Token Page |
| `IG_USER_ID` | ID akun Instagram |
| `THREADS_USER_ID` | ID akun Threads |
| `THREADS_TOKEN` | Token Threads |
| `TELEGRAM_BOT_TOKEN` | sudah ada (dipakai laporan) |
| `TELEGRAM_CHAT_ID` | sudah ada (dipakai laporan) |

## Langkah 5. Coba

1. Admin, **Lainnya, Sosmed**, ketuk **Posting** pada satu artikel (pilih satu platform dulu).
2. Tunggu 3 sampai 8 menit. Hasilnya muncul di **Riwayat posting**. Status koneksi di bagian atas halaman juga akan berubah menjadi **Terhubung**.
3. Jika berhasil, aktifkan **Posting otomatis** dan simpan.

## Cara kerja singkat

- Admin menaruh artikel ke antrean (`data/social-queue.json`), lalu workflow GitHub berjalan dan memposting.
- Instagram tidak menerima gambar WebP. Skrip membuat gambar JPG persegi 1080x1080 di folder `social/` dan menghapusnya setelah 7 hari.
- Otomatis hanya memproses artikel yang terbit dalam batas hari di pengaturan (awal: 3 hari) dan maksimal 2 artikel per jam, supaya artikel lama tidak membanjiri akun.
- Jika satu platform gagal 3 kali untuk artikel yang sama, otomatis berhenti mencoba. Posting manual tetap bisa dipakai.

## Masalah umum

| Pesan di Riwayat | Artinya | Tindakan |
|---|---|---|
| `secret ... belum diisi` | Token platform itu belum dipasang | Langkah 4 |
| `kode 190` atau `token kedaluwarsa` | Token habis | Buat token baru (Langkah 2 atau 3), ganti secret |
| `kode 10` atau `kode 200` | Izin kurang | Ulangi Langkah 2 nomor 4 dan 5, pastikan semua izin dicentang |
| `Instagram gagal memproses gambar` | Gambar ditolak | Coba lagi dari Admin, atau pastikan akun Instagram bertipe Profesional |
| `halaman artikel belum tayang` | Situs belum selesai deploy | Otomatis dicoba lagi jam berikutnya |
