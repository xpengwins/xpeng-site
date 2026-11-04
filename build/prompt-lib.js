/* Pembuat PROMPT EKSEKUSI untuk Claude (dikirim lewat Telegram). FILE BARU.
   Prompt dibuat mandiri: Claude yang menerimanya tahu repo, file, langkah, aturan konten project, dan WAJIB commit + push sendiri.
   Dipakai oleh build/near-page1.js dan build/refresh-artikel.js.
   Panjang dijaga di bawah batas pesan Telegram (4096 karakter) karena prompt dikirim dalam satu blok yang bisa disalin. */
const REPO = 'xpengwins/xpeng-site';
const SKOR = slug => `node -e "const S=require('./shared/seo.js'),a=require('./data/articles.json'),x=a.find(i=>i.slug==='${slug}');console.log(S.scoreArticle(x,a).score)"`;
const kwLines = (kws, n) => kws.slice(0, n || 4).map(k => '- "' + k.q + '" posisi ' + k.pos + ', tayang ' + k.impr + ', klik ' + k.clicks).join('\n');
const ATURAN = `Aturan:
- Konten orisinal, tidak menyalin sumber. Riset dulu. Bahasa Indonesia yang mudah diikuti. Emoji seminimal mungkin.
- Harga dan angka hanya dari data/models.json (pricelist resmi). Jangan mengarang angka; bila ragu tulis "hubungi kami untuk konfirmasi".
- Ubah hanya file yang disebut di atas. Jangan menimpa sistem lain.
- Pastikan JSON tetap valid dan formatnya sama (JSON.stringify(data,null,1), tanpa baris kosong di akhir).`;
const buka = (judul, target, file) => `PERINTAH EKSEKUSI: ${judul}

Repo GitHub: ${REPO}, branch main. Kerjakan sampai selesai dan push sendiri ke main tanpa minta konfirmasi lagi. Jika kamu tidak punya akses push ke repo ini, berhenti dan beri tahu saya (jangan membuat salinan di tempat lain).

Target: ${target}
File yang boleh diubah: ${file}`;
const tutup = pesan => `

Commit hanya file itu dengan pesan: "${pesan}" lalu push ke main. Workflow build berjalan otomatis setelah push.
Balas ringkas (maks 6 baris): apa yang diubah, skor SEO sebelum dan sesudah, tautan halaman.`;
/* jaga batas Telegram: bila terlalu panjang, kurangi daftar kata kunci */
const muat = (bikin, kws) => { let n = 4, p = bikin(n); while (p.length > 3300 && n > 1) { n--; p = bikin(n); } return p; };

/* c = { tipe:'artikel'|'model', slug, url, keyword, kws:[{q,pos,impr,clicks}], gsc, skorAwal, kata } */
function promptPerkuat(c) {
  const msg = 'Perkuat ' + (c.tipe === 'model' ? 'halaman model: ' : 'artikel: ') + c.slug + ' (' + ((c.kws[0] || {}).q || '').slice(0, 50) + ')';
  if (c.tipe === 'model') return muat(n => buka('PERKUAT HALAMAN MODEL (hampir halaman 1 Google)', c.url, 'data/models.json (hanya model dengan slug "' + c.slug + '")') + `

Data Search Console (${c.gsc}):
${kwLines(c.kws, n)}

Langkah:
1. Baca model "${c.slug}" di data/models.json (faq, highlights, metaTitle, metaDescription, detail).
2. Riset singkat di web untuk kata kunci di atas: apa yang dicari orang dan pertanyaan nyatanya.
3. Tambah 3-5 FAQ baru di "faq" ({"q","a"}, jawaban 2-3 kalimat, tanpa duplikat) yang menjawab kata kunci di atas. Periksa metaTitle (30-65 karakter, kata kunci di depan) dan metaDescription (120-160 karakter); ubah hanya bila kurang.
4. Jangan ubah harga, varian, slug, gambar, atau spesifikasi, kecuali menemukan kesalahan dan punya sumber resmi (mis. brosur).

` + ATURAN + tutup(msg));
  return muat(n => buka('PERKUAT ARTIKEL (hampir halaman 1 Google)', c.url, 'data/articles.json (hanya artikel dengan "slug": "' + c.slug + '")') + `

Data Search Console (${c.gsc}):
${kwLines(c.kws, n)}
Kata kunci artikel sekarang: "${c.keyword || '-'}"${c.skorAwal != null ? ' | skor SEO ' + c.skorAwal + ', ' + c.kata + ' kata' : ''}

Langkah:
1. Baca artikel itu dan 3 artikel terkait di data/articles.json (untuk tautan internal). Catat skor awal: ${SKOR(c.slug)}
2. Riset singkat di web untuk kata kunci di atas: apa yang dicari orang, data terbaru, pertanyaan nyata.
3. Perkuat "body": (a) awali dengan "**Jawaban singkat:**" 40-60 kata yang langsung menjawab kata kunci utama (untuk AEO dan kutipan mesin AI); (b) tambah atau lengkapi H2 yang menjawab tiap kata kunci di atas, muncul alami, tidak dijejalkan; (c) tambah 3-5 FAQ (### pertanyaan + jawaban 2-3 kalimat) di bagian "Pertanyaan yang sering diajukan", tanpa duplikat; (d) tambah 2-3 tautan internal dengan anchor deskriptif; (e) perbarui angka atau tanggal yang usang. Jangan hapus bagian yang masih benar; jumlah kata harus naik.
4. Judul (30-60 karakter, kata kunci di depan) dan description (120-160 karakter): ubah hanya bila kurang.
5. Isi "updated" dengan waktu sekarang (ISO) karena isi memang berubah. Jangan ubah slug, status, date, publishAt, image.
6. Hitung ulang skor dengan perintah yang sama. Target 100, minimal 90, tidak boleh lebih rendah dari skor awal.

` + ATURAN + tutup(msg));
}

/* c = { slug, url, keyword, alasan:[...], umur, skorAwal, kata } */
function promptSegarkan(c) {
  return buka('SEGARKAN ARTIKEL (pembaruan isi yang nyata)', c.url, 'data/articles.json (hanya artikel dengan "slug": "' + c.slug + '")') + `

Alasan dipilih: ${c.alasan.join('; ')}.
Kata kunci: "${c.keyword || '-'}" | terakhir diperbarui ${c.umur} hari lalu | skor SEO ${c.skorAwal}, ${c.kata} kata.

Tujuan: isi benar-benar lebih baru dan lebih berguna, bukan sekadar mengganti beberapa kata.
1. Baca artikel di data/articles.json. Catat skor awal: ${SKOR(c.slug)}
2. Periksa tiap fakta: harga (cocokkan dengan data/models.json), promo (data/promo.json; yang lewat tanggal "until" jangan disebut aktif), nama model, fitur, tanggal, "tahun ini". Riset singkat di web untuk perkembangan terbaru topik ini.
3. Perbarui yang usang dan tambahkan informasi baru yang berguna: minimal 1 bagian baru atau 2 FAQ baru, data atau contoh terkini, tautan internal yang kurang. Tulis dengan kata sendiri.
4. Bila ada bulan atau tahun lama di judul, boleh perbarui judulnya, tetapi JANGAN ubah slug (URL harus tetap).
5. Tambahkan keterangan tanggal data yang jelas, mis. "Harga per <bulan tahun>", agar mesin pencari dan AI tahu informasinya segar.
6. ATURAN KERAS: isi "updated" dengan waktu sekarang (ISO) HANYA bila isi berubah nyata (kira-kira 10% teks atau ada bagian baru). Jika setelah diperiksa tidak ada yang perlu diperbarui, JANGAN ubah file dan jangan push; cukup balas "tidak perlu diperbarui" beserta alasannya.
7. Hitung ulang skor dengan perintah yang sama; tidak boleh turun.

` + ATURAN + tutup('Segarkan artikel: ' + c.slug);
}
module.exports = { promptPerkuat, promptSegarkan, REPO };
