/**
 * Notifikasi Chat WhatsApp website xpengwins.com -> Telegram + Google Sheet
 * Pasang di Google Sheet: Ekstensi > Apps Script, tempel seluruh isi file ini.
 * Isi Script Properties (Setelan proyek > Properti skrip):
 *   TG_TOKEN = token bot dari @BotFather
 *   TG_CHAT  = chat ID Telegram Anda (jalankan cariChatId setelah mengirim pesan ke bot)
 * Lalu Terapkan > Deployment baru > Aplikasi web, Jalankan sebagai: Saya, Akses: Siapa saja.
 * Salin URL /exec ke admin website: Pengaturan > "Chat WhatsApp: URL Apps Script".
 */
var SHEET = 'Chat WA';
var HEAD = ['Waktu', 'Kejadian', 'Sesi', 'Halaman', 'Judul halaman', 'Sumber', 'Kampanye', 'Kata kunci', 'GCLID', 'Perangkat', 'Nama', 'Nomor WA', 'Pesan', 'Referrer'];
var NAMA = { open: 'Buka chat', typing: 'Sedang mengetik', send: 'Kirim pesan', lead: 'LEAD (isi nama + nomor)', wa: 'Lanjut ke WhatsApp', form: 'Form test drive' };
var JEDA = { open: 60, typing: 600, send: 20, lead: 20, wa: 20, form: 20 }; // detik, anti dobel per sesi

function doPost(e) {
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!NAMA[d.t] || !d.sid) return out('abaikan');
    var cut = function (v, n) { return String(v == null ? '' : v).slice(0, n || 300); };
    var cache = CacheService.getScriptCache(), key = 'k_' + cut(d.sid, 40) + '_' + d.t;
    if (cache.get(key)) return out('dobel');
    cache.put(key, '1', JEDA[d.t]);
    var hit = Number(cache.get('jam') || 0); if (hit > 500) return out('batas'); cache.put('jam', String(hit + 1), 3600);
    var sh = sheet_();
    sh.appendRow([new Date(), NAMA[d.t], cut(d.sid, 40), cut(d.page), cut(d.title), cut(d.src, 80), cut(d.camp, 120), cut(d.term, 120), d.gclid ? 'ya' : '', cut(d.dev, 20), cut(d.nama, 60), cut(d.hp, 20) ? "'" + cut(d.hp, 20) : '', cut(d.msg || d.draft, 500), cut(d.ref)]);
    tg_(d, cut);
    return out('ok');
  } catch (err) { return out('error'); }
}
function doGet() { return out('Chat WA aktif'); }
function out(t) { return ContentService.createTextOutput(t); }
function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(SHEET);
  if (!sh) { sh = ss.insertSheet(SHEET); sh.appendRow(HEAD); sh.setFrozenRows(1); sh.getRange(1, 1, 1, HEAD.length).setFontWeight('bold'); }
  return sh;
}
function esc_(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function tg_(d, cut) {
  var P = PropertiesService.getScriptProperties(), tok = P.getProperty('TG_TOKEN'), chat = P.getProperty('TG_CHAT');
  if (!tok || !chat) return;
  var asal = esc_(cut(d.src, 80)) + (d.camp ? ' / ' + esc_(cut(d.camp, 120)) : '') + (d.term ? ' / kata kunci: ' + esc_(cut(d.term, 120)) : '');
  var l = ['<b>' + esc_(NAMA[d.t]) + '</b>', 'Halaman: ' + esc_(cut(d.page)), 'Sumber: ' + asal, 'Perangkat: ' + esc_(cut(d.dev, 20)) + ' | sesi ' + esc_(cut(d.sid, 12))];
  if (d.t === 'typing') l.push('Pengunjung mulai mengetik, pesan belum dikirim.');
  if (d.msg) l.push('Pesan: ' + esc_(cut(d.msg, 500)));
  if (d.nama) l.push('Nama: ' + esc_(cut(d.nama, 60)));
  if (d.hp) l.push('Nomor: +' + esc_(cut(d.hp, 20)) + '\nChat duluan: https://wa.me/' + encodeURIComponent(cut(d.hp, 20)));
  if (d.t === 'wa') l.push('Mode: ' + (d.mode === 'lead' ? 'setelah isi data' : 'langsung tanpa isi data'));
  UrlFetchApp.fetch('https://api.telegram.org/bot' + tok + '/sendMessage', { method: 'post', muteHttpExceptions: true, payload: { chat_id: chat, text: l.join('\n'), parse_mode: 'HTML', disable_web_page_preview: 'true' } });
}
/* Jalankan sekali setelah Anda mengirim pesan apa saja ke bot Telegram: chat ID muncul di Log eksekusi */
function cariChatId() {
  var tok = PropertiesService.getScriptProperties().getProperty('TG_TOKEN');
  var r = JSON.parse(UrlFetchApp.fetch('https://api.telegram.org/bot' + tok + '/getUpdates').getContentText());
  (r.result || []).forEach(function (u) { var m = u.message || u.channel_post; if (m) Logger.log('Chat ID: ' + m.chat.id + ' (' + (m.chat.title || m.chat.first_name || '') + ')'); });
}
/* Uji kirim notifikasi + tulis ke Sheet tanpa website */
function tesNotifikasi() {
  doPost({ postData: { contents: JSON.stringify({ t: 'lead', sid: 'tes' + Date.now(), page: '/model/xpeng-x9/', title: 'Tes', src: 'Iklan Google', camp: 'tes', dev: 'HP', nama: 'Tes', hp: '6281234567890', msg: 'Halo, ini tes' }) } });
}
