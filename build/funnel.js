/* Tahap funnel artikel: TOFU (kenalan), MOFU (menimbang), BOFU (siap beli).
   Dipakai oleh posting sosmed (build/social.js) dan riset ide (build/riset-tren.js).
   Jika artikel punya field "funnel" (tofu/mofu/bofu), field itu yang dipakai. Jika tidak, ditebak dari kata di judul/slug/kata kunci. */
const MOFU = /\bvs\b|banding|terbaik|kelebihan|kekurangan|ulasan|review|spesifikasi|dimensi|jarak tempuh|garansi|interior|cocok|pilih|keluarga|mudik|alternatif|rekomendasi|seater|zero gravity|layar|suspensi|chip|vla|charging 5c|warna/;
const BOFU = /harga|pricelist|promo|prebook|cicil|kredit|simulasi|test drive|beli|diskon|stok|indent|\bdp\b|leasing|booking|bengkel rekanan/;
const INFO = {
  tofu: { label: 'TOFU', nama: 'Kenalan (awareness)', tujuan: 'Pembaca baru yang baru cari tahu soal mobil listrik. Edukasi dulu, jangan menjual keras.', cta: 'Arahkan ke 1-2 artikel MOFU yang relevan (perbandingan atau spesifikasi). CTA lembut: baca lanjut.' },
  mofu: { label: 'MOFU', nama: 'Menimbang (consideration)', tujuan: 'Pembaca yang sudah tahu dan sedang membandingkan pilihan. Beri data, tabel, dan alasan jujur.', cta: 'Arahkan ke halaman model dan 1 artikel BOFU (harga, promo, cicilan). CTA: tanya konsultan.' },
  bofu: { label: 'BOFU', nama: 'Siap beli (decision)', tujuan: 'Pembaca yang hampir memutuskan. Jawab harga, promo, cicilan, dan langkah berikutnya dengan jelas.', cta: 'Arahkan ke WhatsApp, test drive, atau prebook. Tulis tanggal data dan syarat promo.' }
};
function stage(a) {
  const f = String(a && a.funnel || '').toLowerCase();
  if (INFO[f]) return f;
  const t = ((a.slug || '') + ' ' + (a.title || a.topik || '') + ' ' + (a.keyword || '')).toLowerCase().replace(/-/g, ' ');
  if (MOFU.test(t) && !/prebook|promo|cicil|kredit|test drive/.test(t)) return 'mofu';
  if (BOFU.test(t)) return 'bofu';
  if (MOFU.test(t)) return 'mofu';
  return 'tofu';
}
module.exports = { stage, INFO };
