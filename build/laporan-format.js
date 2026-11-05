/* Penyusun tampilan pesan Telegram untuk laporan harian. Hanya mengatur TAMPILAN, tidak mengambil data.
   Uji: node build/laporan-format.js (mencetak contoh pesan) */
const { esc, rp, tgl } = require('./util-agent.js');
const GARIS = '━━━━━━━━━━━━━━━';
const bar = p => { const n = Math.max(0, Math.min(10, Math.round(p / 10))); return '▓'.repeat(n) + '░'.repeat(10 - n); };
const ikon = t => /TIDAK VALID/.test(t) ? '❌' : /^Domain/.test(t) ? '🌐' : /^Sertifikat/.test(t) ? '🔒' : /^Token/.test(t) ? '🔑' : '•';

function susun(d) {
  const { ik, flags, belum, aset, situs, cfg } = d, L = [];
  L.push('📊 <b>LAPORAN HARIAN</b>\n' + esc(d.situsNama) + ' · ' + esc(d.hariNama) + ', ' + esc(d.tanggal));
  if (flags.length) L.push('\n⚠️ <b>PERHATIAN (' + flags.length + ')</b>\n' + flags.map(f => '• ' + esc(f)).join('\n'));
  else L.push('\n✅ <b>' + (belum.length ? 'Tidak ada peringatan dari data yang tersedia' : 'Semua normal, tidak ada yang perlu ditindaklanjuti') + '</b>');
  if (belum.length) L.push('\n🔧 <b>PERLU DIPASANG</b>\n' + belum.map(b => '• ' + esc(b)).join('\n'));

  if (ik.iklan) {
    const a = ik.iklan;
    L.push(GARIS + '\n💰 <b>GOOGLE ADS</b> · kemarin (' + esc(tgl(a.kemarin + 'T12:00:00Z')) + ')\n' +
      'Biaya <b>' + rp(a.biaya) + '</b> · ' + a.klik + ' klik · ' + a.tayang + ' tayang' + (a.klik ? '\nRata-rata ' + rp(a.biaya / a.klik) + ' per klik' : ''));
    L.push('Dana terpakai <b>' + a.persen + '%</b>\n' + bar(a.persen) + '\n' + rp(a.terpakai) + ' dari ' + rp(cfg.danaTotal) +
      '\nSisa <b>' + rp(Math.max(0, a.sisa)) + '</b> untuk ' + a.hariSisa + ' hari (sampai ' + esc(tgl(cfg.akhir + 'T12:00:00Z')) + ')' +
      '\nBatas aman ' + rp(Math.max(0, a.amanPerHari)) + ' per hari · rata-rata 7 hari ' + rp(a.rata7));
  }

  const kual = [];
  if (ik.kualitas) {
    const k = ik.kualitas;
    kual.push('Kemarin: ' + k.klikKemarin + ' klik → ' + k.sesiChatKemarin + ' buka chat → ' + k.aksiKemarin + ' kirim pesan/WA → ' + k.leadKemarin + ' lead');
    kual.push('3 hari: ' + k.klik3 + ' klik · ' + k.aksi3 + ' aksi chat/WA' + (k.klik3 ? ' (' + (k.aksi3 / k.klik3 * 100).toFixed(1) + '%)' : ''));
  } else if (ik.chatInfo) kual.push(ik.chatInfo);
  if (ik.iklan && ik.iklan.invalid != null && ik.iklan.klik >= 5) {
    const p = ik.iklan.invalid / ik.iklan.klik * 100;
    kual.push('Klik tidak valid (Google): ' + ik.iklan.invalid + ' dari ' + ik.iklan.klik + ' (' + p.toFixed(1) + '%)' + (p >= cfg.ambangInvalidPersen ? ' ⚠️' : ' ✅'));
  }
  if (ik.ga4) kual.push('Google Analytics 3 hari: ' + ik.ga4.sesi3 + ' sesi · ' + ik.ga4.terlibatPersen + '% terlibat · rata-rata ' + ik.ga4.durasiDetik + ' detik');
  (ik.catatan || []).forEach(c => kual.push('ℹ️ ' + c));
  if (kual.length) L.push(GARIS + '\n🎯 <b>KUALITAS KLIK</b>\n' + kual.map(esc).join('\n') + (ik.flags.length ? '\n<i>Ini indikasi, bukan bukti. Google umumnya mengembalikan biaya klik tidak valid yang terdeteksi.</i>' : ''));

  L.push(GARIS + '\n🛡 <b>DOMAIN DAN TOKEN</b>\n' + aset.map(t => ikon(t) + ' ' + esc(t)).join('\n'));
  L.push(GARIS + '\n🖥 <b>SITUS</b>\n' + situs.map(t => (/DOWN/.test(t) ? '🔴' : /belum aktif/.test(t) ? '⚪' : '🟢') + ' ' + esc(t)).join('\n'));
  return L.join('\n');
}
module.exports = { susun };

if (require.main === module) {
  const cfg = { danaTotal: 1500000, akhir: '2026-11-30', ambangInvalidPersen: 10 };
  console.log(susun({ situsNama: 'xpengwins.com', hariNama: 'Kamis', tanggal: '5 Nov 2026', cfg,
    flags: ['Klik tidak valid versi Google 10.5% kemarin. Cek laporan "Klik tidak valid" dan ajukan pengembalian biaya bila perlu'], belum: [],
    ik: { flags: ['x'], iklan: { kemarin: '2026-11-04', biaya: 52723, klik: 19, tayang: 221, invalid: 2, terpakai: 103231, sisa: 1396769, persen: 7, hariSisa: 26, amanPerHari: 53722, rata7: 51616 },
      kualitas: { klikKemarin: 19, sesiChatKemarin: 2, aksiKemarin: 0, leadKemarin: 0, klik3: 37, aksi3: 0 }, ga4: { sesi3: 67, terlibatPersen: 51, durasiDetik: 231 },
      catatan: ['Data iklan baru 2 hari: penilaian klik mencurigakan dimulai setelah 3 hari data.'] },
    aset: ['Domain xpengwins.com berakhir 16 Okt 2027 (345 hari lagi)', 'Sertifikat HTTPS berlaku sampai 14 Jan 2027 (70 hari)', 'Token Facebook/Instagram: valid, tanpa tanggal habis', 'Token Threads: valid'],
    situs: ['Status sekarang: normal. 24 jam terakhir: tidak ada gangguan'] }));
}
