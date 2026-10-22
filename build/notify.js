/* Laporan artikel terbit: kirim ke Telegram + simpan ke Google Sheets.
   Aman: tanpa secret = dilewati; error tidak pernah menggagalkan workflow. Token tidak pernah dicetak. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..'), D = f => path.join(ROOT, 'data', f);
const SEO = require('../shared/seo.js');
const TG = process.env.TELEGRAM_BOT_TOKEN, CHAT = process.env.TELEGRAM_CHAT_ID, SHEET = process.env.SHEET_ID, GKEY = process.env.GSC_KEY;
const FULL = (process.env.REPORT_ALL || '').toLowerCase() === 'yes';
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(D(f), 'utf8')); } catch (e) { return d; } };
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const b64u = b => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const wib = iso => { try { return new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB'; } catch (e) { return iso || '-'; } };
const ST = { published: 'Sudah publish', scheduled: 'Terjadwal', ready: 'Siap publish', draft: 'Draft' };

async function tgSend(text) {
  const r = await fetch('https://api.telegram.org/bot' + TG + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: CHAT, text: text.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true }) });
  if (!r.ok) throw new Error('Telegram ' + r.status);
}
async function gToken() {
  const key = JSON.parse(GKEY), t = Math.floor(Date.now() / 1000), h = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const c = b64u(JSON.stringify({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: t, exp: t + 3000 }));
  const sig = b64u(crypto.sign('RSA-SHA256', Buffer.from(h + '.' + c), key.private_key));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + h + '.' + c + '.' + sig });
  const j = await r.json(); if (!j.access_token) throw new Error('login Google gagal: ' + (j.error_description || j.error)); return j.access_token;
}
async function sheets(tok, path, opt) {
  const r = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + SHEET + path, { ...opt, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' } });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error('Sheets ' + r.status + ' ' + ((j.error && j.error.message) || '')); return j;
}
async function ensureTabs(tok, names) {
  const meta = await sheets(tok, '?fields=sheets.properties.title'), have = (meta.sheets || []).map(s => s.properties.title), need = names.filter(n => !have.includes(n));
  if (need.length) await sheets(tok, ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: need.map(title => ({ addSheet: { properties: { title } } })) }) });
}

(async () => {
  try {
    const arts = rd('articles.json', []), site = rd('site.json', {}), sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    const origin = (sm.match(/<loc>(https?:\/\/[^/<]+)/) || [])[1] || (site.baseUrl || '').replace(/\/$/, '');
    const link = a => origin + '/artikel/' + a.slug + '/';
    const st = rd('notified.json', null), first = !st, S0 = st || { items: {} }; S0.items = S0.items || {};
    const pub = arts.filter(a => a.status === 'published'), sch = arts.filter(a => a.status === 'scheduled' && a.publishAt).sort((x, y) => Date.parse(x.publishAt) - Date.parse(y.publishAt));
    const now = new Date().toISOString();
    let fresh = pub.filter(a => !S0.items[a.slug]);
    if (first && !FULL) { pub.forEach(a => { S0.items[a.slug] = now; }); S0.created = now; fs.writeFileSync(D('notified.json'), JSON.stringify(S0, null, 1)); return console.log('Laporan: baseline dibuat untuk ' + pub.length + ' artikel yang sudah terbit (tidak dikirim ulang).'); }
    if (!fresh.length && !FULL) return console.log('Laporan: tidak ada artikel baru terbit.');
    const score = a => { try { return SEO.scoreArticle(a, arts).score; } catch (e) { return '-'; } };
    const nextTxt = () => sch.length ? '\n\n⏭ Berikutnya: ' + esc(sch[0].title) + ' (' + wib(sch[0].publishAt) + ')\nTerjadwal: ' + sch.length + ' artikel' : '';
    // ---- Telegram ----
    let sentTG = false;
    if (TG && CHAT) {
      try {
        if (fresh.length) {
          if (fresh.length <= 5) for (const a of fresh) await tgSend('✅ <b>Artikel terbit</b>\n\n<b>' + esc(a.title) + '</b>\nKeyword: ' + esc(a.keyword || '-') + '\nSkor SEO: ' + score(a) + '\nTanggal: ' + esc(a.date || '-') + '\n\n' + esc(link(a)) + '\n\nTotal terbit: ' + pub.length + ' dari ' + arts.length + ' artikel' + nextTxt());
          else await tgSend('✅ <b>' + fresh.length + ' artikel terbit</b>\n\n' + fresh.map((a, i) => (i + 1) + '. ' + esc(a.title) + '\n' + esc(link(a))).join('\n') + '\n\nTotal terbit: ' + pub.length + ' dari ' + arts.length);
        }
        if (FULL) {
          const g = k => arts.filter(a => a.status === k);
          await tgSend('📊 <b>Laporan artikel ' + esc(site.name || 'XPeng') + '</b>\n' + wib(now) + '\n\nSudah publish: ' + g('published').length + '\nTerjadwal: ' + g('scheduled').length + '\nSiap publish: ' + g('ready').length + '\nDraft: ' + g('draft').length + '\n\n<b>Terjadwal berikutnya</b>\n' + (sch.slice(0, 10).map((a, i) => (i + 1) + '. ' + esc(a.title) + ' (' + wib(a.publishAt) + ')').join('\n') || '-') + '\n\n<b>Belum jadwal</b>\n' + (arts.filter(a => a.status === 'ready' || a.status === 'draft').slice(0, 10).map((a, i) => (i + 1) + '. ' + esc(a.title) + ' [' + ST[a.status] + ']').join('\n') || '-'));
        }
        sentTG = true; console.log('Laporan: Telegram terkirim.');
      } catch (e) { console.log('Laporan: Telegram gagal: ' + e.message); }
    } else console.log('Laporan: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum diisi, Telegram dilewati.');
    // ---- Google Sheets ----
    let sentSheet = false;
    if (SHEET && GKEY) {
      try {
        const tok = await gToken(); await ensureTabs(tok, ['Status Artikel', 'Log Terbit']);
        const head = [['Judul', 'Keyword', 'Status', 'Tanggal terbit / jadwal', 'Skor SEO', 'Link', 'Diperbarui']];
        const rows = arts.map(a => [a.title, a.keyword || '', ST[a.status] || a.status, a.status === 'scheduled' && a.publishAt ? wib(a.publishAt) : (a.date || ''), score(a), link(a), wib(now)]);
        await sheets(tok, '/values/' + encodeURIComponent('Status Artikel!A:G') + ':clear', { method: 'POST', body: '{}' });
        await sheets(tok, '/values/' + encodeURIComponent('Status Artikel!A1') + '?valueInputOption=RAW', { method: 'PUT', body: JSON.stringify({ values: head.concat(rows) }) });
        if (fresh.length) await sheets(tok, '/values/' + encodeURIComponent('Log Terbit!A1') + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { method: 'POST', body: JSON.stringify({ values: fresh.map(a => [wib(now), a.title, a.keyword || '', score(a), link(a)]) }) });
        S0.sheetUrl = 'https://docs.google.com/spreadsheets/d/' + SHEET + '/edit'; sentSheet = true; console.log('Laporan: Google Sheets tersimpan.');
      } catch (e) { console.log('Laporan: Sheets gagal: ' + e.message); }
    } else console.log('Laporan: SHEET_ID / GSC_KEY belum diisi, Google Sheets dilewati.');
    // tandai sudah dilaporkan hanya jika salah satu tujuan berhasil (kalau semua gagal, dicoba lagi jam berikutnya)
    if (sentTG || sentSheet) { fresh.forEach(a => { S0.items[a.slug] = now; }); if (sentTG || sentSheet) S0.lastSent = now; fs.writeFileSync(D('notified.json'), JSON.stringify(S0, null, 1)); }
  } catch (e) { console.log('Laporan: dilewati karena error: ' + e.message); }
})();
