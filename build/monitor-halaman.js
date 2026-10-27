/* AGENT 7: pantau kesehatan halaman dan artikel (rusak / bermasalah untuk SEO). FILE BARU, tidak mengubah sistem lain.
   Membuka SEMUA halaman di sitemap seperti pengunjung/Google, lalu memeriksa:
     ❌ langsung merusak SEO : halaman noindex tak sengaja, canonical salah, judul/H1 hilang, JSON-LD rusak,
                              link internal rusak (404), robots.txt memblokir seluruh situs
     🟠 perlu diperbaiki      : gambar rusak, link luar mati (404/410), dialihkan (redirect), deskripsi hilang,
                              judul kembar, H1 ganda, isi terlalu tipis, konten campur http, artikel yatim (tanpa link masuk)
   Status halaman 404/500 dan kecepatan dilaporkan Agent 3 (monitor-speed.js); di sini hanya dicatat, tidak dikirim ganda.
   Hasil: data/health-log.json. Telegram hanya untuk masalah BARU, plus kabar saat masalah sudah pulih.
   Aman: tanpa secret tetap jalan, error tidak menggagalkan workflow, link luar yang memblokir bot tidak dianggap rusak.
   Uji: HEALTH_DRY=1 node build/monitor-halaman.js (tanpa jaringan) */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), D = f => path.join(ROOT, 'data', f);
const E = process.env, DRY = E.HEALTH_DRY === '1';
const TG = { tok: E.TELEGRAM_BOT_TOKEN, chat: E.TELEGRAM_CHAT_ID };
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(D(f), 'utf8')); } catch (e) { return d; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const scrub = m => [TG.tok].filter(Boolean).reduce((s, t) => s.split(t).join('***'), String(m));
const dec = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
const CFG = { thinWords: 150, extCap: 60, extCacheDays: 3, conc: 4, skipExt: /(^|\.)(instagram\.com|facebook\.com|fb\.com|tiktok\.com|youtube\.com|youtu\.be|wa\.me|whatsapp\.com|linkedin\.com|x\.com|twitter\.com|threads\.net|maps\.google\.com|google\.com|goo\.gl|g\.co|t\.me)$/i, ...(rd('health-config.json', {}) || {}) };

async function pool(items, n, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch (e) { out[k] = { err: scrub(e.message) }; } } })); return out; }
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; xpeng-health/1.0)' };
async function status(url, method) {
  try {
    const r = await fetch(url, { method: method || 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(15000), headers: UA });
    if (method !== 'GET' && (r.status === 405 || r.status === 403 || r.status === 400 || r.status === 501)) return status(url, 'GET');
    return { s: r.status };
  } catch (e) { return { s: 0, err: scrub(e.cause && e.cause.code || e.message).slice(0, 60) }; }
}
async function getPage(url) {
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: UA });
    const html = /text\/html|xml/.test(r.headers.get('content-type') || '') ? await r.text() : '';
    return { s: r.status, final: r.url, html, xrobots: r.headers.get('x-robots-tag') || '' };
  } catch (e) { return { s: 0, html: '', err: scrub(e.cause && e.cause.code || e.message).slice(0, 60) }; }
}
const norm = (u, origin) => { try { const x = new URL(u, origin); x.hash = ''; x.search = ''; let p = x.origin + x.pathname; return p; } catch (e) { return ''; } };
const trail = u => u.replace(/\/index\.html$/, '/');
const visibleWords = h => (h.replace(/<(script|style|svg|noscript)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').match(/[A-Za-zÀ-ÿ0-9]{2,}/g) || []).length;

function analyse(url, pg, origin) {
  const h = pg.html, iss = [], P = url.replace(origin, '') || '/';
  const add = (k, sev, t) => iss.push({ k: k + ':' + P, sev, page: P, t });
  if (pg.s === 200 && trail(norm(pg.final, origin)) !== trail(norm(url, origin))) add('redirect', 'warn', '🟠 ' + P + ' dialihkan ke ' + pg.final.replace(origin, ''));
  if (pg.s !== 200) return { iss, links: [], imgs: [], title: '' };
  const meta = n => { const m = h.match(new RegExp('<meta[^>]+name=["\']' + n + '["\'][^>]*>', 'i')); return m ? (m[0].match(/content=["']([^"']*)["']/i) || [])[1] || '' : null; };
  const robots = (meta('robots') || '') + ' ' + pg.xrobots;
  if (/noindex/i.test(robots)) add('noindex', 'bad', '❌ ' + P + ' diblokir noindex (Google tidak akan memuatnya)');
  const can = (h.match(/<link[^>]+rel=["']canonical["'][^>]*>/i) || [''])[0], cu = (can.match(/href=["']([^"']+)["']/i) || [])[1];
  if (!cu) add('canonical', 'warn', '🟠 ' + P + ' tidak punya canonical');
  else if (trail(norm(cu, origin)) !== trail(norm(url, origin))) add('canonical', 'bad', '❌ ' + P + ' canonical mengarah ke halaman lain (' + cu.replace(origin, '') + ')');
  const title = dec(((h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').trim());
  if (!title) add('title', 'bad', '❌ ' + P + ' tidak punya judul (title)');
  const desc = meta('description'); if (desc == null || !desc.trim()) add('desc', 'warn', '🟠 ' + P + ' tidak punya meta description');
  const h1 = (h.match(/<h1\b/gi) || []).length; if (h1 === 0) add('h1', 'bad', '❌ ' + P + ' tidak punya H1'); else if (h1 > 1) add('h1', 'warn', '🟠 ' + P + ' punya ' + h1 + ' H1 (sebaiknya 1)');
  const body = (h.match(/<main[\s\S]*<\/main>/i) || [h])[0];
  if (/^\/artikel\/.+/.test(P) && visibleWords(body) < CFG.thinWords) add('thin', 'warn', '🟠 ' + P + ' isinya terlalu tipis (' + visibleWords(body) + ' kata)');
  for (const m of h.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) { try { JSON.parse(m[1]); } catch (e) { add('jsonld', 'bad', '❌ ' + P + ' data terstruktur (JSON-LD) rusak, rich result tidak akan muncul'); break; } }
  if (/(src|href)=["']http:\/\/(?!localhost)/i.test(h.replace(/<a\b[^>]*>/gi, m => m.replace(/href=/i, 'data-h=')))) add('mixed', 'warn', '🟠 ' + P + ' memuat sumber http:// (tidak aman)');
  const links = [...h.matchAll(/<a\b[^>]*\shref=["']([^"'#][^"']*)["']/gi)].map(m => dec(m[1])).filter(x => !/^(mailto:|tel:|javascript:|sms:|whatsapp:)/i.test(x));
  const imgs = [...h.matchAll(/<img\b[^>]*\ssrc=["']([^"']+)["']/gi)].map(m => dec(m[1])).concat([...h.matchAll(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/gi)].map(m => dec(m[1])));
  return { iss, links, imgs, title };
}

(async () => {
  try {
    const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    if (!urls.length) return console.log('Halaman: sitemap kosong, dilewati.');
    const origin = new URL(urls[0]).origin;
    if (DRY) return console.log('Halaman (DRY): ' + urls.length + ' halaman akan diperiksa di ' + origin);
    const log = rd('health-log.json', { history: [], ext: {} }); log.ext = log.ext || {};
    const today = new Date().toISOString().slice(0, 10);
    const issues = [];

    /* 1) buka semua halaman */
    const pages = await pool(urls, CFG.conc, async u => ({ u, ...(await getPage(u)) }));
    const statusBad = pages.filter(p => p.s !== 200);
    const info = [], inbound = {}, imgSet = new Set(), intSet = new Set(), extSet = new Set(), where = {};
    const titles = {};
    pages.forEach(pg => {
      const a = analyse(pg.u, pg, origin); a.iss.forEach(i => issues.push(i)); info.push({ pg, a });
      if (pg.s === 200) { const P = pg.u.replace(origin, '') || '/'; if (a.title) (titles[a.title.toLowerCase()] = titles[a.title.toLowerCase()] || []).push(P);
        a.links.forEach(l => { const n = norm(l, pg.u); if (!n) return; if (n.startsWith(origin)) { intSet.add(n); (where['l:' + n] = where['l:' + n] || new Set()).add(P); if (n !== norm(pg.u, origin)) inbound[trail(n)] = (inbound[trail(n)] || 0) + 1; } else if (/^https?:/i.test(l)) { extSet.add(l.split('#')[0]); (where['e:' + l.split('#')[0]] = where['e:' + l.split('#')[0]] || new Set()).add(P); } });
        a.imgs.forEach(i => { const n = /^https?:/i.test(i) || i.startsWith('/') ? norm(i, pg.u) : norm(i, pg.u); if (n && n.startsWith(origin)) { imgSet.add(n); (where['i:' + n] = where['i:' + n] || new Set()).add(P); } }); }
    });
    Object.entries(titles).forEach(([t, ps]) => { if (ps.length > 1) ps.forEach(P => issues.push({ k: 'dupTitle:' + P, sev: 'warn', page: P, t: '🟠 ' + P + ' judulnya sama dengan ' + ps.filter(x => x !== P).slice(0, 2).join(', ') })); });
    /* artikel yatim: ada di sitemap tapi tidak ada link masuk dari halaman lain */
    urls.map(u => u.replace(origin, '')).filter(P => /^\/artikel\/.+/.test(P)).forEach(P => { if (!inbound[trail(origin + P)]) issues.push({ k: 'orphan:' + P, sev: 'warn', page: P, t: '🟠 ' + P + ' tidak punya link masuk dari halaman lain (artikel yatim)' }); });

    /* 2) link internal dan gambar */
    const pageSet = new Set(urls.map(u => trail(norm(u, origin))));
    const internal = [...intSet].filter(n => !pageSet.has(trail(n)));
    const intRes = await pool(internal, CFG.conc, async n => ({ n, ...(await status(n)) }));
    intRes.forEach(r => { if (r.s === 404 || r.s === 410) issues.push({ k: 'link:' + r.n.replace(origin, ''), sev: 'bad', page: [...(where['l:' + r.n] || [])][0] || '', t: '❌ Link internal rusak ' + r.n.replace(origin, '') + ' (dipakai di ' + [...(where['l:' + r.n] || [])].slice(0, 3).join(', ') + ')' }); });
    const imgRes = await pool([...imgSet], CFG.conc, async n => ({ n, ...(await status(n)) }));
    imgRes.forEach(r => { if (r.s === 404 || r.s === 410) issues.push({ k: 'img:' + r.n.replace(origin, ''), sev: 'warn', page: [...(where['i:' + r.n] || [])][0] || '', t: '🟠 Gambar rusak ' + r.n.replace(origin, '') + ' (dipakai di ' + [...(where['i:' + r.n] || [])].slice(0, 3).join(', ') + ')' }); });

    /* 3) link luar: hanya 404/410/domain mati dianggap rusak; situs yang memblokir bot diabaikan */
    const now = Date.now(), fresh = c => c && now - c.at < CFG.extCacheDays * 864e5;
    const exts = [...extSet].filter(l => { try { return !CFG.skipExt.test(new URL(l).hostname); } catch (e) { return false; } });
    const todo = exts.filter(l => !fresh(log.ext[l])).slice(0, CFG.extCap);
    /* kontrol jaringan: bila situs pembanding juga tidak terbuka, berarti jaringan runner bermasalah, jangan menilai link luar */
    const net = await status('https://www.google.com/generate_204', 'GET'), netOk = net.s > 0;
    const isDead = r => r.s === 404 || r.s === 410 || /ENOTFOUND/.test(r.err || '');
    const extRes = netOk ? await pool(todo, CFG.conc, async l => { let r = await status(l); if (isDead(r)) { await sleep(3000); const r2 = await status(l, 'GET'); r = r2; } return { l, ...r }; }) : [];
    if (!netOk) console.log('Halaman: jaringan runner tidak bisa menjangkau internet, link luar dilewati.');
    extRes.forEach(r => { log.ext[r.l] = { s: r.s, err: r.err || '', at: now }; });
    Object.keys(log.ext).forEach(l => { if (!extSet.has(l) || now - log.ext[l].at > 14 * 864e5) delete log.ext[l]; });
    exts.forEach(l => { const c = log.ext[l]; if (netOk && c && (c.s === 404 || c.s === 410 || /ENOTFOUND|EAI_AGAIN/.test(c.err))) issues.push({ k: 'ext:' + l, sev: 'warn', page: [...(where['e:' + l] || [])][0] || '', t: '🟠 Link luar mati ' + l.replace(/^https?:\/\//, '').slice(0, 70) + ' (di ' + [...(where['e:' + l] || [])].slice(0, 3).join(', ') + ')' }); });

    /* 4) robots.txt */
    const rb = await getPage(origin + '/robots.txt');
    if (rb.s === 200 && /User-agent:\s*\*[\s\S]*?\n\s*Disallow:\s*\/\s*(\n|$)/i.test(rb.html)) issues.push({ k: 'robots:all', sev: 'bad', page: '/robots.txt', t: '❌ robots.txt memblokir seluruh situs (Disallow: /)' });

    const bad = issues.filter(i => i.sev === 'bad').length, warn = issues.length - bad;
    const entry = { date: today, at: new Date().toISOString(), pages: urls.length, ok: pages.filter(p => p.s === 200).length, statusBad: statusBad.map(p => p.u.replace(origin, '') + ' → ' + (p.s || p.err || 'gagal')), bad, warn };
    log.history = (log.history || []).filter(h => h.date !== today).concat(entry).slice(-30);
    log.generated = entry.at; log.latest = { ...entry, issues: issues.slice(0, 120).map(i => ({ k: i.k, sev: i.sev, page: i.page, t: i.t })) };

    /* 5) peringatan: hanya masalah BARU; kabari juga bila ada yang sudah pulih */
    const prevKeys = log.alertKeys || [], keys = issues.map(i => i.k), fresh2 = issues.filter(i => !prevKeys.includes(i.k)), healed = prevKeys.filter(k => !keys.includes(k));
    let sent = false;
    if (TG.tok && TG.chat && (fresh2.length || (healed.length && !issues.length))) {
      const L = [];
      if (fresh2.length) { L.push('🩺 <b>Cek kesehatan halaman xpengwins.com</b>\n\n' + issues.length + ' masalah (' + fresh2.length + ' baru, ❌ ' + bad + ' berat, 🟠 ' + warn + ' ringan):'); fresh2.sort((a, b) => (a.sev === 'bad' ? 0 : 1) - (b.sev === 'bad' ? 0 : 1)).slice(0, 14).forEach(i => L.push(esc(i.t))); if (fresh2.length > 14) L.push('…dan ' + (fresh2.length - 14) + ' lainnya (lihat data/health-log.json)'); L.push('\n❌ = berpengaruh langsung ke SEO, perbaiki dulu. 🟠 = perlu dirapikan.'); }
      else L.push('✅ <b>Cek kesehatan halaman xpengwins.com</b>\n\nSemua masalah sebelumnya sudah pulih. ' + urls.length + ' halaman sehat.');
      try { const r = await fetch((E.TG_BASE || 'https://api.telegram.org') + '/bot' + TG.tok + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TG.chat, text: L.join('\n').slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true }) }); if (r.ok) { log.alertKeys = keys; sent = true; } else console.log('Halaman: Telegram ' + r.status); } catch (e) { console.log('Halaman: Telegram gagal: ' + scrub(e.message)); }
    }
    if (!sent) log.alertKeys = prevKeys.filter(k => keys.includes(k));
    fs.writeFileSync(D('health-log.json'), JSON.stringify(log, null, 1));
    console.log('Halaman: ' + urls.length + ' halaman, ' + entry.ok + ' terbuka, ' + bad + ' masalah berat, ' + warn + ' masalah ringan' + (statusBad.length ? ', ' + statusBad.length + ' halaman error (dilaporkan Agent 3)' : '') + '.');
  } catch (e) { console.log('Halaman: gagal (diabaikan): ' + scrub(e.message)); }
})();
