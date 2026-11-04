/* Pembantu bersama untuk agent harian, mingguan, dan alarm situs. FILE BARU.
   Isi: baca/tulis data, kirim Telegram, login Google (Sheets), format tanggal dan rupiah.
   Mode uji: AGENT_DRY=1 = tidak kirim apa pun, hanya cetak ke layar. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..'), D = f => path.join(ROOT, 'data', f);
const E = process.env;
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(D(f), 'utf8')); } catch (e) { return d; } };
const wr = (f, o) => fs.writeFileSync(D(f), JSON.stringify(o, null, 1));
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/* hapus semua rahasia dari teks error sebelum dicetak */
const clean = s => { let t = String(s == null ? '' : s); [E.TELEGRAM_BOT_TOKEN, E.FB_PAGE_TOKEN, E.THREADS_TOKEN, E.GSC_KEY].filter(Boolean).forEach(k => { t = t.split(k).join('***'); }); return t; };
const wib = (d) => new Date((d ? d.getTime() : Date.now()) + 7 * 36e5);          // jam dinding WIB, baca dengan getUTC*
const ymd = d => d.toISOString().slice(0, 10);
const addDays = (s, n) => ymd(new Date(Date.parse(s + 'T00:00:00Z') + n * 864e5));
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
const rp = n => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');
const tgl = d => { try { return new Date(d).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return String(d); } };
const jam = d => { try { return new Date(d).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' WIB'; } catch (e) { return String(d); } };
const b64u = b => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* kirim ke Telegram; teks panjang dipecah di baris baru (maks 4000 karakter). true = terkirim */
async function tg(text) {
  if (E.AGENT_DRY === '1' || !E.TELEGRAM_BOT_TOKEN || !E.TELEGRAM_CHAT_ID) { console.log('--- Telegram (tidak dikirim) ---\n' + text + '\n--------------------------------'); return false; }
  const parts = []; let rest = String(text);
  while (rest.length > 4000) { let cut = rest.lastIndexOf('\n', 4000); if (cut < 1000) cut = 4000; parts.push(rest.slice(0, cut)); rest = rest.slice(cut); }
  parts.push(rest);
  for (const p of parts) {
    const r = await fetch((E.TG_BASE || 'https://api.telegram.org') + '/bot' + E.TELEGRAM_BOT_TOKEN + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: E.TELEGRAM_CHAT_ID, text: p, parse_mode: 'HTML', disable_web_page_preview: true }) });
    if (!r.ok) { console.log('Telegram gagal: HTTP ' + r.status); return false; }
    await sleep(400);
  }
  return true;
}

/* login Google dengan kunci akun layanan yang sama dengan Search Console / Sheets (secret GSC_KEY) */
async function googleToken(scope) {
  const key = JSON.parse(E.GSC_KEY), t = Math.floor(Date.now() / 1000);
  const h = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' })), c = b64u(JSON.stringify({ iss: key.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: t, exp: t + 3000 }));
  const sig = b64u(crypto.sign('RSA-SHA256', Buffer.from(h + '.' + c), key.private_key));
  const r = await fetch(E.TOKEN_URL || 'https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + h + '.' + c + '.' + sig });
  const j = await r.json(); if (!j.access_token) throw new Error('login Google gagal: ' + (j.error_description || j.error));
  return j.access_token;
}
/* baca satu tab Google Sheets; tanggal dikembalikan sebagai angka serial, angka sebagai angka */
async function sheetValues(sheetId, tab, tok) {
  const url = (E.SHEETS_BASE || 'https://sheets.googleapis.com') + '/v4/spreadsheets/' + sheetId + '/values/' + encodeURIComponent(tab) + '?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER';
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + tok } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const m = (j.error && j.error.message) || ''; const e = new Error(r.status === 400 && /range|parse/i.test(m) ? 'tab "' + tab + '" tidak ditemukan' : 'Sheets ' + r.status + ' ' + m); e.kode = r.status; throw e; }
  return j.values || [];
}
/* tanggal dari sel Sheets: angka serial (WIB) atau teks "2026-11-04..." */
const cellDate = v => typeof v === 'number' ? ymd(new Date(Math.round((v - 25569) * 864e5))) : (/^\d{4}-\d{2}-\d{2}/.test(String(v || '')) ? String(v).slice(0, 10) : '');
const cellNum = v => typeof v === 'number' ? v : (Number(String(v == null ? '' : v).replace(/[^0-9.-]/g, '')) || 0);
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
const baseUrl = () => { const s = rd('site.json', {}); let b = String(s.baseUrl || '').replace(/\/$/, ''); if (!b) { try { b = 'https://' + fs.readFileSync(path.join(ROOT, 'CNAME'), 'utf8').trim(); } catch (e) {} } return b; };

module.exports = { ROOT, D, E, rd, wr, esc, clean, wib, ymd, addDays, daysBetween, rp, tgl, jam, tg, googleToken, sheetValues, cellDate, cellNum, median, baseUrl, sleep };
