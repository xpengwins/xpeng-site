/* Posting artikel ke Facebook Page, Instagram, Threads (dan Telegram untuk kirim ulang manual).
   - Otomatis: artikel yang baru terbit (jika data/social.json "auto" = true).
   - Manual: antrean dari admin (data/social-queue.json).
   Aman: platform tanpa secret dilewati. Token tidak pernah dicetak. Error tidak menggagalkan workflow.
   Uji tanpa kirim apa pun: SOCIAL_DRY=1 node build/social.js */
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), D = f => path.join(ROOT, 'data', f);
const E = process.env, DRY = E.SOCIAL_DRY === '1', CI = !!E.GITHUB_ACTIONS;
const GRAPH = E.GRAPH_BASE || 'https://graph.facebook.com/' + (E.GRAPH_VERSION || 'v25.0'), THR = E.THREADS_BASE || 'https://graph.threads.net/v1.0', TGAPI = E.TG_BASE || 'https://api.telegram.org';
const FB = { id: E.FB_PAGE_ID, tok: E.FB_PAGE_TOKEN };
const IG = { id: E.IG_USER_ID, tok: E.IG_TOKEN || E.FB_PAGE_TOKEN };
const TH = { id: E.THREADS_USER_ID, tok: E.THREADS_TOKEN };
const TG = { tok: E.TELEGRAM_BOT_TOKEN, chat: E.TELEGRAM_CHAT_ID };
const READY = { facebook: !!(FB.id && FB.tok), instagram: !!(IG.id && IG.tok), threads: !!(TH.id && TH.tok), telegram: !!(TG.tok && TG.chat) };
const ALL = ['facebook', 'instagram', 'threads', 'telegram'], AUTO = ['facebook', 'instagram', 'threads'];
const NAME = { facebook: 'Facebook', instagram: 'Instagram', threads: 'Threads', telegram: 'Telegram' };

const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(D(f), 'utf8')); } catch (e) { return d; } };
const wr = (f, o) => fs.writeFileSync(D(f), JSON.stringify(o, null, 1));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const SECRETS = [FB.tok, IG.tok, TH.tok, TG.tok].filter(Boolean);
const scrub = m => SECRETS.reduce((s, t) => s.split(t).join('***'), String(m));

/* ---------- panggilan API ---------- */
async function api(url, params, method) {
  const qs = new URLSearchParams(params);
  const r = method === 'GET' ? await fetch(url + '?' + qs) : await fetch(url, { method: 'POST', body: qs });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error || j.ok === false) {
    const e = j.error || {};
    throw new Error((e.error_user_msg || e.message || j.description || 'HTTP ' + r.status) + (e.code ? ' (kode ' + e.code + ')' : ''));
  }
  return j;
}
async function waitLive(url, isImg) {
  if (DRY) return true;
  const end = Date.now() + 6 * 60 * 1000;
  while (Date.now() < end) {
    try {
      const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now());
      if (r.ok && (!isImg || /image\//.test(r.headers.get('content-type') || ''))) return true;
    } catch (e) { /* coba lagi */ }
    await sleep(12000);
  }
  return false;
}
function gitPush(msg) {
  if (!CI || DRY) return;
  try {
    execSync('git add -A social && (git diff --cached --quiet || (git commit -m "' + msg + '" && git pull --rebase -q && git push))', { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash' });
  } catch (e) { console.log('Sosmed: git push gambar gagal: ' + scrub(e.message).split('\n')[0]); }
}

/* ---------- teks per platform ---------- */
function texts(a, url, cfg) {
  const tags = (cfg.hashtags || '#XPeng #MobilListrik').trim(), desc = (a.description || '').trim();
  const fb = a.title + '\n\n' + desc + '\n\nBaca selengkapnya: ' + url + '\n\n' + tags;
  const ig = a.title + '\n\n' + desc + '\n\nArtikel lengkap: buka link di bio.\n\n' + tags;
  const th = d => a.title + '\n\n' + d + '\n\n' + url + '\n' + tags;
  let d = desc, t = th(d);
  if (t.length > 490) { const over = t.length - 490; d = desc.slice(0, Math.max(0, desc.length - over - 1)).replace(/\s+\S*$/, '') + '…'; t = th(d); }
  const tg = '📣 <b>' + esc(a.title) + '</b>\n\n' + esc(desc) + '\n\n' + esc(url);
  return { fb: fb.slice(0, 5000), ig: ig.slice(0, 2200), th: t.slice(0, 500), tg };
}

/* ---------- gambar JPG persegi untuk Instagram/Threads/Facebook (WebP tidak diterima Instagram) ---------- */
async function makeJpg(a, origin) {
  const out = path.join(ROOT, 'social', a.slug + '.jpg'), url = origin + '/social/' + a.slug + '.jpg';
  if (fs.existsSync(out)) return { url, fresh: false };
  let sharp; try { sharp = require('sharp'); } catch (e) { throw new Error('sharp tidak terpasang'); }
  const rel = String(a.image || 'assets/img/g6-black-depan.webp').replace(/^\//, ''), src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) throw new Error('gambar artikel tidak ditemukan: ' + rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(src, { failOn: 'none' }).rotate().resize(1080, 1080, { fit: 'cover', position: sharp.strategy.attention }).flatten({ background: '#0a0b0d' }).jpeg({ quality: 86, mozjpeg: true }).toFile(out);
  return { url, fresh: true };
}

/* ---------- pengirim per platform ---------- */
const SEND = {
  facebook: async (a, c) => { const r = await api(GRAPH + '/' + FB.id + '/photos', { url: c.img, caption: c.t.fb, access_token: FB.tok }); return r.post_id || r.id; },
  instagram: async (a, c) => {
    const m = await api(GRAPH + '/' + IG.id + '/media', { image_url: c.img, caption: c.t.ig, access_token: IG.tok });
    for (let i = 0; ; i++) {
      const s = await api(GRAPH + '/' + m.id, { fields: 'status_code', access_token: IG.tok }, 'GET');
      if (s.status_code === 'FINISHED') break;
      if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error('Instagram gagal memproses gambar (' + s.status_code + ')');
      if (i >= 20) throw new Error('Instagram terlalu lama memproses gambar');
      await sleep(5000);
    }
    return (await api(GRAPH + '/' + IG.id + '/media_publish', { creation_id: m.id, access_token: IG.tok })).id;
  },
  threads: async (a, c) => {
    const m = await api(THR + '/' + TH.id + '/threads', { media_type: 'IMAGE', image_url: c.img, text: c.t.th, access_token: TH.tok });
    await sleep(10000);
    for (let i = 0; ; i++) {
      const s = await api(THR + '/' + m.id, { fields: 'status,error_message', access_token: TH.tok }, 'GET');
      if (s.status === 'FINISHED') break;
      if (s.status === 'ERROR' || s.status === 'EXPIRED') throw new Error('Threads gagal memproses (' + (s.error_message || s.status) + ')');
      if (i >= 12) throw new Error('Threads terlalu lama memproses');
      await sleep(5000);
    }
    return (await api(THR + '/' + TH.id + '/threads_publish', { creation_id: m.id, access_token: TH.tok })).id;
  },
  telegram: async (a, c) => { const r = await api(TGAPI + '/bot' + TG.tok + '/sendMessage', { chat_id: TG.chat, text: c.t.tg.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: 'false' }); return String(r.result && r.result.message_id || ''); }
};

(async () => {
  try {
    const cfg = { auto: false, maxAgeDays: 3, maxPerRun: 2, hashtags: '#XPeng #MobilListrik #XPengIndonesia', ...rd('social.json', {}) };
    cfg.platforms = { facebook: true, instagram: true, threads: true, ...(cfg.platforms || {}) };
    const site = rd('site.json', {}), arts = rd('articles.json', []), posted = rd('social-posted.json', {}), queue = rd('social-queue.json', []);
    let log = rd('social-log.json', []);
    const origin = (site.baseUrl || '').replace(/\/$/, '');
    if (!origin) return console.log('Sosmed: baseUrl di data/site.json kosong, dilewati.');

    // status koneksi untuk ditampilkan di admin (ditulis hanya jika berubah)
    const st = rd('social-status.json', {});
    if (JSON.stringify(st.ready || {}) !== JSON.stringify(READY)) { wr('social-status.json', { at: new Date().toISOString(), ready: READY }); }

    const note = (slug, plat, ok, msg) => { log.unshift({ at: new Date().toISOString(), slug, platform: plat, ok, msg: scrub(msg).slice(0, 220) }); log = log.slice(0, 60); console.log('Sosmed: ' + (ok ? '✅' : '❌') + ' ' + NAME[plat] + ' — ' + slug + (ok ? '' : ': ' + scrub(msg).slice(0, 160))); };

    // ---- susun pekerjaan ----
    const jobs = [], byslug = s => jobs.find(j => j.a.slug === s);
    for (const q of queue) {
      const a = arts.find(x => x.slug === q.slug);
      const want = (q.platforms || []).filter(p => ALL.includes(p));
      if (!a || a.status !== 'published') { note(q.slug, want[0] || 'facebook', false, 'artikel belum terbit atau tidak ditemukan'); continue; }
      let j = byslug(a.slug); if (!j) { j = { a, plats: new Set(), force: false, manual: true }; jobs.push(j); }
      want.forEach(p => j.plats.add(p)); if (q.force) j.force = true;
    }
    if (cfg.auto) {
      const cutoff = Date.now() - (cfg.maxAgeDays || 3) * 864e5;
      const cands = arts.filter(a => a.status === 'published' && Date.parse(a.date) >= cutoff).sort((x, y) => (x.date < y.date ? -1 : 1));
      let n = 0;
      for (const a of cands) {
        const rec = posted[a.slug] || {}, fails = rec._f || {};
        const plats = AUTO.filter(p => cfg.platforms[p] && READY[p] && !rec[p] && (fails[p] || 0) < 3);
        if (!plats.length) continue;
        const ex = byslug(a.slug);
        if (ex) { plats.forEach(p => ex.plats.add(p)); continue; }
        if (n >= (cfg.maxPerRun || 2)) break;
        jobs.push({ a, plats: new Set(plats), force: false, manual: false }); n++;
      }
    }
    if (!jobs.length) { if (queue.length) { wr('social-queue.json', []); wr('social-log.json', log); } return console.log('Sosmed: tidak ada yang perlu diposting.'); }

    // ---- siapkan gambar (satu kali commit) ----
    const need = jobs.filter(j => [...j.plats].some(p => p !== 'telegram'));
    const imgs = {}; let fresh = false;
    for (const j of need) { try { const r = await makeJpg(j.a, origin); imgs[j.a.slug] = r.url; fresh = fresh || r.fresh; } catch (e) { imgs[j.a.slug] = null; note(j.a.slug, 'facebook', false, 'gagal buat gambar: ' + e.message); } }
    if (fresh) gitPush('Gambar sosmed');

    // ---- kirim ----
    for (const j of jobs) {
      const a = j.a, rec = (posted[a.slug] = posted[a.slug] || {}), link = origin + '/artikel/' + a.slug + '/';
      const live = await waitLive(link, false);
      if (!live) { [...j.plats].forEach(p => note(a.slug, p, false, 'halaman artikel belum tayang setelah 6 menit; dicoba lagi otomatis jam berikutnya')); continue; }
      const img = imgs[a.slug], t = texts(a, link, cfg);
      if (img && [...j.plats].some(p => p !== 'telegram') && !(await waitLive(img, true))) { [...j.plats].filter(p => p !== 'telegram').forEach(p => note(a.slug, p, false, 'gambar JPG belum tayang di situs setelah 6 menit')); j.plats = new Set(['telegram'].filter(p => j.plats.has(p))); }
      for (const p of j.plats) {
        if (rec[p] && !j.force) { note(a.slug, p, true, 'sudah pernah diposting, dilewati'); continue; }
        if (!READY[p]) { note(a.slug, p, false, 'secret ' + NAME[p] + ' belum diisi di GitHub'); continue; }
        if (p !== 'telegram' && !img) { note(a.slug, p, false, 'tidak ada gambar JPG'); continue; }
        try {
          if (DRY) { console.log('[DRY] ' + p + ' <- ' + a.slug + '\n' + (p === 'facebook' ? t.fb : p === 'instagram' ? t.ig : p === 'threads' ? t.th : t.tg) + '\n'); continue; }
          const id = await SEND[p](a, { img, t });
          rec[p] = { id: String(id || ''), at: new Date().toISOString() }; if (rec._f) delete rec._f[p];
          note(a.slug, p, true, 'terkirim');
        } catch (e) {
          if (!j.manual) { rec._f = rec._f || {}; rec._f[p] = (rec._f[p] || 0) + 1; }
          note(a.slug, p, false, e.message + (/\b190\b|expired|token/i.test(e.message) ? ' — token kemungkinan kedaluwarsa, buat ulang dan isi lagi di GitHub Secrets' : ''));
        }
        if (!DRY) { wr('social-posted.json', posted); wr('social-log.json', log); }
        await sleep(3000);
      }
    }
    if (!DRY) {
      wr('social-posted.json', posted); wr('social-log.json', log); wr('social-queue.json', []);
      // hapus gambar JPG lama (sudah tidak dibutuhkan setelah diposting > 7 hari)
      try { for (const f of fs.readdirSync(path.join(ROOT, 'social'))) { const s = f.replace(/\.jpg$/, ''), r = posted[s]; if (!r) continue; const ts = Object.values(r).filter(x => x && x.at).map(x => Date.parse(x.at)); if (ts.length && Date.now() - Math.max(...ts) > 7 * 864e5) fs.unlinkSync(path.join(ROOT, 'social', f)); } } catch (e) { /* folder belum ada */ }
    }
  } catch (e) { console.log('Sosmed: dilewati karena error: ' + scrub(e.message)); }
})();
