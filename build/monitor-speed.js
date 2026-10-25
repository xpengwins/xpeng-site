/* AGENT 3: pantau kecepatan dan error situs. FILE BARU, tidak mengubah sistem lain.
   Yang dikerjakan:
   1) Cek status + waktu respon semua URL di sitemap (error 4xx/5xx, timeout, lambat).
   2) Ukur PageSpeed Insights (mobile) untuk halaman kunci: skor, LCP, CLS, TBT.
   3) Bandingkan dengan catatan sebelumnya, kirim peringatan Telegram hanya jika ada masalah BARU.
   Hasil disimpan di data/speed-log.json (30 hari terakhir).
   Aman: tanpa secret tetap jalan (Telegram dilewati), error tidak pernah menggagalkan workflow.
   Uji tanpa internet/kirim: SPEED_DRY=1 node build/monitor-speed.js */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), D = f => path.join(ROOT, 'data', f);
const E = process.env, DRY = E.SPEED_DRY === '1';
const TG = { tok: E.TELEGRAM_BOT_TOKEN, chat: E.TELEGRAM_CHAT_ID }, PSI_KEY = E.PSI_KEY || '';
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(D(f), 'utf8')); } catch (e) { return d; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const scrub = m => [TG.tok, PSI_KEY].filter(Boolean).reduce((s, t) => s.split(t).join('***'), String(m));
const T = { slowMs: 3000, perfWarn: 80, perfBad: 50, lcpWarn: 2500, lcpBad: 4000, cls: 0.1, tbt: 200, drop: 10 };

async function timed(url) {
  const t0 = Date.now();
  try {
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'spd=' + t0, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'xpeng-monitor/1.0' } });
    await r.arrayBuffer();
    return { status: r.status, ms: Date.now() - t0 };
  } catch (e) { return { status: 0, ms: Date.now() - t0, err: scrub(e.message).slice(0, 80) }; }
}
async function check(url) {
  let r = await timed(url);
  /* coba sekali lagi bila gagal/lambat, supaya gangguan sesaat tidak dianggap masalah */
  if (r.status === 0 || r.status >= 500 || r.ms > T.slowMs) {
    await sleep(3000); const r2 = await timed(url);
    if (r2.status && r2.status < 400 && (r.status === 0 || r.status >= 400 || r2.ms < r.ms)) r = r2;
  }
  return r;
}
async function psi(url) {
  const q = (E.PSI_BASE || 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed') + '?strategy=mobile&category=performance&url=' + encodeURIComponent(url) + (PSI_KEY ? '&key=' + encodeURIComponent(PSI_KEY) : '');
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(q, { signal: AbortSignal.timeout(90000) });
      const j = await r.json();
      if (r.status === 429 || (j.error && /quota|rate/i.test(j.error.message || ''))) { await sleep(20000 * (i + 1)); continue; }
      if (!r.ok) throw new Error('PSI ' + r.status + ' ' + ((j.error && j.error.message) || '').slice(0, 80));
      const lh = j.lighthouseResult || {}, a = lh.audits || {}, n = k => a[k] && typeof a[k].numericValue === 'number' ? a[k].numericValue : null;
      const field = j.loadingExperience && j.loadingExperience.overall_category ? j.loadingExperience.overall_category : null;
      return { score: lh.categories && lh.categories.performance ? Math.round(lh.categories.performance.score * 100) : null, lcp: n('largest-contentful-paint') && Math.round(n('largest-contentful-paint')), cls: n('cumulative-layout-shift') != null ? +n('cumulative-layout-shift').toFixed(3) : null, tbt: n('total-blocking-time') != null ? Math.round(n('total-blocking-time')) : null, field };
    } catch (e) { if (i === 2) return { err: scrub(e.message).slice(0, 100) }; await sleep(8000); }
  }
  return { err: 'PSI kena batas kuota, coba lagi nanti (isi secret PSI_KEY agar stabil)' };
}
async function tgSend(text) {
  const r = await fetch((E.TG_BASE || 'https://api.telegram.org') + '/bot' + TG.tok + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TG.chat, text: text.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true }) });
  if (!r.ok) throw new Error('Telegram ' + r.status);
}
async function pool(items, n, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } })); return out; }

(async () => {
  try {
    const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    if (!urls.length) return console.log('Kecepatan: sitemap kosong, dilewati.');
    const origin = new URL(urls[0]).origin, pth = u => u.replace(origin, '') || '/';
    const arts = rd('articles.json', []).filter(a => a.status === 'published').sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const key = ['/', '/model/xpeng-x9/', '/model/xpeng-g6/', '/pricelist/', '/kontak/'];
    if (arts[0]) key.push('/artikel/' + arts[0].slug + '/');
    const keyUrls = key.map(p => origin + p).filter(u => urls.includes(u));
    const log = rd('speed-log.json', { history: [] });
    const today = new Date().toISOString().slice(0, 10), prev = [...log.history].reverse().find(h => h.date !== today) || null;
    const issues = [];

    if (DRY) { console.log('Kecepatan (DRY): ' + urls.length + ' URL, halaman kunci:', keyUrls.map(pth).join(' ')); return; }

    // 1) semua URL: status + waktu respon
    const extra = [origin + '/robots.txt', origin + '/sitemap.xml'];
    const res = await pool([...urls, ...extra], 4, async u => ({ path: pth(u), ...(await check(u)) }));
    const errs = res.filter(r => r.status === 0 || r.status >= 400), slow = res.filter(r => r.status && r.status < 400 && r.ms > T.slowMs);
    errs.forEach(r => issues.push({ k: 'error:' + r.path, t: '❌ ' + r.path + ' → ' + (r.status || 'tidak bisa dibuka (' + (r.err || 'timeout') + ')') }));
    slow.forEach(r => issues.push({ k: 'slow:' + r.path, t: '🐢 ' + r.path + ' lambat (' + (r.ms / 1000).toFixed(1) + ' detik)' }));
    const avgMs = Math.round(res.filter(r => r.status && r.status < 400).reduce((s, r) => s + r.ms, 0) / Math.max(1, res.filter(r => r.status && r.status < 400).length));

    // 2) PageSpeed halaman kunci (satu per satu agar tidak kena batas)
    const pages = {};
    for (const u of keyUrls) {
      const p = pth(u), m = await psi(u); pages[p] = m;
      if (m.err) { console.log('PSI ' + p + ': ' + m.err); await sleep(4000); continue; }
      const before = prev && prev.pages && prev.pages[p] && prev.pages[p].score;
      const bad = [];   /* satu baris per halaman supaya laporan ringkas */
      let red = false;
      if (m.score != null && m.score < T.perfWarn) { bad.push('skor ' + m.score); if (m.score < T.perfBad) red = true; }
      if (m.lcp != null && m.lcp > T.lcpWarn) { bad.push('LCP ' + (m.lcp / 1000).toFixed(1) + ' dtk'); if (m.lcp > T.lcpBad) red = true; }
      if (m.cls != null && m.cls > T.cls) bad.push('CLS ' + m.cls);
      if (m.tbt != null && m.tbt > T.tbt) bad.push('TBT ' + m.tbt + ' ms');
      if (bad.length) issues.push({ k: 'perf:' + p, t: (red ? '🔴 ' : '🟠 ') + p + ': ' + bad.join(', ') });
      if (m.score != null && before != null && before - m.score >= T.drop) issues.push({ k: 'drop:' + p, t: '📉 ' + p + ' turun ' + before + ' → ' + m.score + ' sejak pengecekan sebelumnya (melambat)' });
      await sleep(4000);
    }

    const entry = { date: today, at: new Date().toISOString(), urls: urls.length, errors: errs.length, slow: slow.length, avgMs, pages, issues: issues.map(i => i.k) };
    log.history = log.history.filter(h => h.date !== today).concat(entry).slice(-30);
    log.generated = entry.at; log.latest = { ...entry, issueText: issues.map(i => i.t) };

    // 3) peringatan: hanya jika ada masalah BARU dibanding peringatan terakhir (anti-spam)
    const sig = issues.map(i => i.k).sort().join('|'), fresh = issues.filter(i => !(log.alertKeys || []).includes(i.k));
    if (issues.length && fresh.length && TG.tok && TG.chat) {
      try {
        await tgSend('⚡ <b>Pantau kecepatan xpengwins.com</b>\n\nDitemukan ' + issues.length + ' masalah (' + fresh.length + ' baru):\n' + issues.slice(0, 15).map(i => esc(i.t)).join('\n') + '\n\nRata-rata respon server: ' + avgMs + ' ms. Data lengkap: data/speed-log.json');
        log.alertKeys = issues.map(i => i.k); log.alertSig = sig;
      } catch (e) { console.log('Kecepatan: Telegram gagal: ' + scrub(e.message)); }
    } else if (!issues.length) { log.alertKeys = []; log.alertSig = ''; }
    fs.writeFileSync(D('speed-log.json'), JSON.stringify(log, null, 1));
    console.log('Kecepatan: ' + urls.length + ' URL dicek, ' + errs.length + ' error, ' + slow.length + ' lambat, ' + issues.length + ' masalah total.');
  } catch (e) { console.log('Kecepatan: gagal (diabaikan): ' + scrub(e.message)); }
})();
