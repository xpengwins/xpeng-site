# Panduan menu Halaman (admin)

Menu: **Lainnya, Halaman**. Untuk mengatur isi dan susunan Beranda, Model, Pricelist, Kontak, dan Tentang.

1. Pilih halaman di bagian atas.
2. Tiap bagian halaman tampil sebagai kartu.
   - **▲ ▼** memindah bagian naik atau turun.
   - **Sembunyi** menyembunyikan bagian (bisa ditampilkan lagi). Bagian yang memuat judul utama (H1) tidak bisa disembunyikan, demi SEO.
   - **Edit isi** membuka kolom teks dan foto. Ganti teks langsung. Ganti foto lewat daftar foto yang sudah ada di Galeri (unggah foto baru dulu lewat menu Media).
3. Ketuk **Simpan halaman ini**. Situs memperbarui diri sekitar 2 menit.
4. **Kembalikan ke awal** menghapus semua perubahan halaman itu.

Yang tidak bisa diedit di sini (sengaja, agar tidak rusak):
- Harga dan nama varian: ubah lewat menu Model atau Pricelist.
- Angka yang dihitung otomatis (simulasi cicilan).
- Artikel: ubah lewat menu Artikel.

Aturan disimpan di `data/pages.json`. Daftar bagian dibuat otomatis di `data/page-index.json` setiap build. Jika kosong, halaman tampil seperti biasa.
