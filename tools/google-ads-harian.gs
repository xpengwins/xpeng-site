/**
 * Skrip Google Ads: tulis biaya, klik, tayang, klik tidak valid, dan konversi per hari per kampanye
 * ke Google Sheet (tab "Iklan Harian"). Data ini dibaca oleh agent harian di GitHub (build/agent-harian.js).
 *
 * Cara pasang (sekali saja), di akun Google Ads xpengwins@gmail.com:
 *   1. Alat (Tools) > Aksi massal (Bulk actions) > Skrip (Scripts) > tombol +  > Skrip baru
 *   2. Hapus isi bawaan, tempel seluruh isi file ini
 *   3. Isi SHEET_ID di bawah (sama dengan secret SHEET_ID di GitHub; itu bagian panjang di URL Google Sheet: .../d/INI/edit)
 *   4. Klik Otorisasi (izinkan akses Google Sheets), lalu Pratinjau/Jalankan sekali dan cek tab "Iklan Harian" terisi
 *   5. Jadwalkan: Frekuensi = Harian, jam 04.00 (akun harus berzona waktu Jakarta agar tanggalnya cocok)
 *
 * Aman: skrip hanya MEMBACA data iklan dan menulis ke Sheet. Tidak mengubah kampanye, anggaran, atau iklan.
 * Kolom yang ditulis: Tanggal | Kampanye | Biaya | Klik | Tayang | Klik tidak valid | Konversi | Diperbarui
 */
var SHEET_ID = 'ISI_ID_GOOGLE_SHEET';   // wajib diisi
var TAB = 'Iklan Harian';
var MULAI = '2026-11-03';               // tanggal pertama yang dicatat (samakan dengan "mulai" di data/iklan-config.json)

function main() {
  var tz = AdsApp.currentAccount().getTimeZone();
  var kemarin = Utilities.formatDate(new Date(new Date().getTime() - 24 * 3600 * 1000), tz, 'yyyy-MM-dd');
  if (SHEET_ID === 'ISI_ID_GOOGLE_SHEET') throw new Error('Isi SHEET_ID dulu di bagian atas skrip.');
  if (kemarin < MULAI) { Logger.log('Belum ada data yang perlu dicatat (kemarin ' + kemarin + ' sebelum MULAI ' + MULAI + ').'); return; }

  var dasar = 'SELECT segments.date, campaign.name, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions';
  var dari = " FROM campaign WHERE segments.date BETWEEN '" + MULAI + "' AND '" + kemarin + "'";
  var rows = [], punyaInvalid = true, it;
  try { it = AdsApp.search(dasar + ', metrics.invalid_clicks' + dari); }
  catch (e) { punyaInvalid = false; it = AdsApp.search(dasar + dari); }   // cadangan bila kolom klik tidak valid tidak tersedia

  while (it.hasNext()) {
    var r = it.next();
    rows.push([
      r.segments.date,
      r.campaign.name,
      Math.round(Number(r.metrics.costMicros) / 1000000),
      Number(r.metrics.clicks),
      Number(r.metrics.impressions),
      punyaInvalid ? Number(r.metrics.invalidClicks) : '',
      Number(r.metrics.conversions),
      Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm')
    ]);
  }
  rows.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });

  var ss = SpreadsheetApp.openById(SHEET_ID), sh = ss.getSheetByName(TAB) || ss.insertSheet(TAB);
  var head = ['Tanggal', 'Kampanye', 'Biaya', 'Klik', 'Tayang', 'Klik tidak valid', 'Konversi', 'Diperbarui'];
  sh.clearContents();
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
  if (rows.length) {
    sh.getRange(2, 1, rows.length, 1).setNumberFormat('@');          // tanggal tetap berupa teks yyyy-MM-dd
    sh.getRange(2, 1, rows.length, head.length).setValues(rows);
  }
  sh.setFrozenRows(1);
  Logger.log('Selesai: ' + rows.length + ' baris ditulis ke tab "' + TAB + '" (' + MULAI + ' s/d ' + kemarin + ').');
}
