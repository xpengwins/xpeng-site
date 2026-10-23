/* Admin XPeng - berjalan 100% di browser HP. Data disimpan ke GitHub lewat API. */
(function () {
'use strict';
const $ = (s, r) => (r || document).querySelector(s), app = $('#app');
const E = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const S = { cfg: null, d: {}, sha: {}, tab: 'home', art: null, report: null };
const NAMES = ['site', 'models', 'articles', 'keywords', 'backlinks', 'leasing', 'about'];
const today = () => new Date().toISOString().slice(0, 10);
const rp = n => 'Rp' + Number(n || 0).toLocaleString('id-ID');
function toast(m, bad) { const t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), bad ? 5000 : 2400); }
const b64 = s => { const b = new TextEncoder().encode(s); let r = ''; b.forEach(x => r += String.fromCharCode(x)); return btoa(r); };
const unb64 = s => { const r = atob(s.replace(/\n/g, '')); const b = new Uint8Array(r.length); for (let i = 0; i < r.length; i++) b[i] = r.charCodeAt(i); return new TextDecoder().decode(b); };
const bufb64 = buf => { let r = '', b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) r += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(r); };

/* ---------- penyimpanan token (opsional PIN, dienkripsi AES-GCM) ---------- */
const enc = new TextEncoder();
async function key(pin, salt) { const k = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']); return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }
async function seal(obj, pin) { const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)); const c = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(pin, salt), enc.encode(JSON.stringify(obj))); return JSON.stringify({ s: bufb64(salt), i: bufb64(iv), c: bufb64(c) }); }
async function unseal(str, pin) { const o = JSON.parse(str), f = x => Uint8Array.from(atob(x), c => c.charCodeAt(0)); const p = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: f(o.i) }, await key(pin, f(o.s)), f(o.c)); return JSON.parse(new TextDecoder().decode(p)); }

/* ---------- GitHub API ---------- */
async function gh(path, opt = {}) {
  const c = S.cfg, r = await fetch('https://api.github.com/repos/' + c.owner + '/' + c.repo + (path ? '/' + path : ''), { ...opt, headers: { Authorization: 'Bearer ' + c.token, Accept: 'application/vnd.github+json', ...(opt.body ? { 'Content-Type': 'application/json' } : {}), ...(opt.headers || {}) } });
  if (!r.ok) { let m = ''; try { m = (await r.json()).message; } catch (e) {} const err = new Error('GitHub ' + r.status + ': ' + m); err.status = r.status; throw err; }
  return r.status === 204 ? null : r.json();
}
const enc2 = p => p.split('/').map(encodeURIComponent).join('/');
async function getFile(p) { const j = await gh('contents/' + enc2(p) + '?ref=' + S.cfg.branch); S.sha[p] = j.sha; return j; }
async function putFile(p, content64, msg, retry) {
  let sha = S.sha[p]; if (!sha) { try { sha = (await getFile(p)).sha; } catch (e) { if (e.status !== 404) throw e; } }
  try { const j = await gh('contents/' + enc2(p), { method: 'PUT', body: JSON.stringify({ message: msg || 'Update ' + p + ' via admin', content: content64, branch: S.cfg.branch, sha }) }); S.sha[p] = j.content.sha; return j; }
  catch (e) { if ((e.status === 409 || e.status === 422) && !retry) { delete S.sha[p]; return putFile(p, content64, msg, true); } throw e; }
}
async function delFile(p) { const j = await getFile(p); return gh('contents/' + enc2(p), { method: 'DELETE', body: JSON.stringify({ message: 'Hapus ' + p, sha: j.sha, branch: S.cfg.branch }) }); }
async function listDir(p) { try { return await gh('contents/' + enc2(p) + '?ref=' + S.cfg.branch); } catch (e) { if (e.status === 404) return []; throw e; } }
async function loadData() { for (const n of NAMES) { try { const j = await getFile('data/' + n + '.json'); S.d[n] = JSON.parse(unb64(j.content)); } catch (e) { S.d[n] = (n === 'site' || n === 'about') ? {} : []; } } }
async function save(n, msg) { const btn = document.activeElement; try { await putFile('data/' + n + '.json', b64(JSON.stringify(S.d[n], null, 1)), msg || 'Update ' + n + ' via admin'); toast('Tersimpan. Website update otomatis ±1-2 menit.'); } catch (e) { toast('Gagal simpan: ' + e.message, true); throw e; } }

/* ---------- login ---------- */
async function boot() {
  const raw = localStorage.getItem('xp_cfg');
  if (!raw) return loginView();
  if (raw.charAt(0) === '{' && raw.indexOf('"c"') > 0) return pinView(raw);
  S.cfg = JSON.parse(raw); start();
}
function loginView(err, keep) {
  keep = keep || {};
  app.innerHTML = `<div id="login"><div class="card"><h2>Masuk Admin XPeng</h2><p class="muted">Data tersimpan di GitHub Anda. Token hanya disimpan di HP ini.</p>${err ? `<p class="pill bad">${E(err)}</p>` : ''}
<label>Username GitHub<input id="o" autocapitalize="none" placeholder="contoh: wins" value="${E(keep.owner || '')}"></label><label>Nama repository<input id="r" autocapitalize="none" placeholder="xpeng-site" value="${E(keep.repo || '')}"></label><label>Branch<input id="b" value="${E(keep.branch || 'main')}"></label>
<label>GitHub Token (fine-grained, izin Contents + Actions: Read and write)<input id="t" type="password" autocapitalize="none" autocomplete="off" value="${E(keep.token || '')}"></label><label>PIN pengaman (opsional, 4+ angka, token dienkripsi)<input id="p" type="password" inputmode="numeric"></label>
<button id="go" style="width:100%">Masuk</button><button id="dg" class="s" style="width:100%;margin-top:10px">Tes koneksi</button><pre id="dgo" class="muted" style="white-space:pre-wrap;margin-top:10px;font-size:.78rem"></pre></div></div>`;
  $('#dg').onclick = async () => {
    const clean = x => x.replace(/[^\x21-\x7E]/g, ''), tok = clean($('#t').value), o = clean($('#o').value), r = clean($('#r').value), out = $('#dgo'); out.textContent = 'Menguji…\n';
    const T = async (name, url, headers) => { try { const x = await fetch(url, { headers }); out.textContent += '✅ ' + name + ' → HTTP ' + x.status + '\n'; return x.status; } catch (e) { out.textContent += '❌ ' + name + ' → ' + e.name + ': ' + e.message + '\n'; return 0; } };
    out.textContent += 'Online: ' + navigator.onLine + ' | token ' + tok.length + ' karakter, awal "' + tok.slice(0, 11) + '"\n';
    await T('1. tanpa header', 'https://api.github.com/zen', {});
    await T('2. header Accept saja', 'https://api.github.com/zen', { Accept: 'application/vnd.github+json' });
    const a = await T('3. Authorization palsu (harus 401 jika preflight lolos)', 'https://api.github.com/user', { Authorization: 'Bearer test' });
    if (tok) { await T('4. token Anda → /user (Bearer)', 'https://api.github.com/user', { Authorization: 'Bearer ' + tok }); await T('5. token Anda → /user (token)', 'https://api.github.com/user', { Authorization: 'token ' + tok }); if (o && r) await T('6. token Anda → repo', 'https://api.github.com/repos/' + o + '/' + r, { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json' }); }
    out.textContent += a === 401 ? '\nKESIMPULAN: koneksi dan CORS normal.' : a === 0 ? '\nKESIMPULAN: permintaan dengan header Authorization diblokir di HP/jaringan ini (baris 3 gagal). Coba browser lain, jaringan lain, atau matikan VPN/pemblokir.' : '\nKode ' + a + ' tidak biasa, kirim hasil ini ke Claude.';
  };
  $('#go').onclick = async () => {
    const clean = x => x.replace(/[^\x21-\x7E]/g, '');
    const cfg = { owner: clean($('#o').value), repo: clean($('#r').value), branch: clean($('#b').value) || 'main', token: clean($('#t').value) }, pin = $('#p').value;
    if (!cfg.owner || !cfg.repo || !cfg.token) return loginView('Lengkapi semua kolom.', cfg);
    S.cfg = cfg;
    if (!navigator.onLine) return loginView('HP sedang offline.', cfg);
    try { await gh(''); }
    catch (e) {
      if (e.status === 401) return loginView('Token salah atau kedaluwarsa (401).', cfg);
      if (e.status === 404) return loginView('Repo tidak ditemukan (404). Cek username/nama repo, dan token harus punya akses ke repo ini.', cfg);
      if (e.status) return loginView('Gagal masuk: ' + e.message, cfg);
      let net = 'tidak bisa dihubungi';
      try { const r = await fetch('https://api.github.com/zen'); net = r.ok ? 'bisa dihubungi tanpa token (berarti ada yang memblokir header token: matikan ad-block/VPN/Data Saver)' : 'membalas ' + r.status; } catch (e2) { net = 'diblokir/tidak terjangkau. Matikan VPN, DNS pribadi, ad-block, atau coba pindah Wi-Fi/data seluler'; }
      return loginView('Gagal terhubung: api.github.com ' + net + '.', cfg);
    }
    localStorage.setItem('xp_cfg', pin.length >= 4 ? await seal(cfg, pin) : JSON.stringify(cfg)); start();
  };
}
function pinView(raw) {
  app.innerHTML = `<div id="login"><div class="card"><h2>Masukkan PIN</h2><input id="p" type="password" inputmode="numeric" autofocus><div class="row" style="margin-top:12px"><button id="ok">Buka</button><button class="s" id="rs">Reset login</button></div></div></div>`;
  $('#ok').onclick = async () => { try { S.cfg = await unseal(raw, $('#p').value); start(); } catch (e) { toast('PIN salah', true); } };
  $('#rs').onclick = () => { localStorage.removeItem('xp_cfg'); loginView(); };
}
async function start() {
  app.innerHTML = '<main><p class="muted">Memuat data dari GitHub…</p></main>';
  try { await loadData(); } catch (e) { return loginView('Gagal memuat: ' + e.message, S.cfg); }
  shell(); go('home');
}

/* ---------- kerangka ---------- */
const TABS = [['home', '🏠', 'Beranda'], ['articles', '✍️', 'Artikel'], ['models', '🚗', 'Model'], ['seo', '📈', 'SEO'], ['more', '⋯', 'Lainnya']];
const MORE = [['prices', '💰', 'Pricelist'], ['leasing', '🏦', 'Leasing'], ['about', '🏢', 'Tentang & lokasi'], ['laporan', '📤', 'Export Laporan'], ['social', '📣', 'Sosmed'], ['ranking', '📊', 'Ranking Google'], ['keywords', '🔑', 'Keyword'], ['backlinks', '🔗', 'Backlink'], ['media', '🖼️', 'Media & Zip'], ['backup', '💾', 'Backup'], ['settings', '⚙️', 'Pengaturan'], ['logout', '🚪', 'Keluar']];
function shell() {
  app.innerHTML = `<header><img src="../assets/img/icon-white.svg" alt=""><b>XPENG ADMIN</b><span class="muted" style="margin-left:auto">${E(S.cfg.owner)}/${E(S.cfg.repo)}</span></header><main id="v"></main>
<div class="menu" id="menu">${MORE.map(m => `<button data-t="${m[0]}"><span>${m[1]}</span>${m[2]}</button>`).join('')}</div>
<nav class="bot">${TABS.map(t => `<button data-t="${t[0]}"><span>${t[1]}</span>${t[2]}</button>`).join('')}</nav>`;
  app.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { const t = b.dataset.t; if (t === 'more') return $('#menu').classList.toggle('open'); go(t); });
}
function go(t) {
  if (t === 'logout') { localStorage.removeItem('xp_cfg'); S.cfg = null; return loginView(); }
  S.tab = t; $('#menu').classList.remove('open'); app.querySelectorAll('nav.bot button').forEach(b => b.classList.toggle('on', b.dataset.t === t || (t !== 'home' && !TABS.some(x => x[0] === t) && b.dataset.t === 'more')));
  window.scrollTo(0, 0); const v = $('#v'); watch(); (VIEWS[t] || VIEWS.home)(v);
}
const sc = (n) => `<span class="score ${n >= 90 ? 'A' : n >= 80 ? 'B' : n >= 65 ? 'C' : 'D'}">${n}</span>`;
const checks = cs => cs.map(c => `<div class="chk"><i>${c.pass ? '✅' : '❌'}</i><div>${E(c.label)}${c.tip ? `<div class="t">${E(c.tip)}</div>` : ''}</div></div>`).join('');
async function build() { try { await gh('actions/workflows/build.yml/dispatches', { method: 'POST', body: JSON.stringify({ ref: S.cfg.branch }) }); toast('Build dijalankan. Tunggu ±1-2 menit lalu buka menu SEO.'); } catch (e) { toast('Gagal: ' + e.message + ' (pastikan token punya izin Actions)', true); } }
async function loadReport() { try { const j = await getFile('data/seo-report.json'); S.report = JSON.parse(unb64(j.content)); } catch (e) { S.report = null; } return S.report; }

/* ---------- VIEWS ---------- */

/* ---------- collapse otomatis + pagination otomatis ---------- */
S.cl = S.cl || {}; S.pg = S.pg || {};
const PER = 10;
function autoCollapse(v) {
  if (!v) return;
  v.querySelectorAll('.card').forEach(c => {
    if (c.tagName === 'DETAILS' || c.parentElement.closest('.card,details.cl')) return;
    const h = c.firstElementChild; if (!h || h.tagName !== 'H3') return;
    const len = c.textContent.length, hasTbl = !!c.querySelector('table'); if (len < 260 && !hasTbl && !c.querySelector('input,select,textarea,button')) return;
    const key = (S.tab || '') + '|' + h.textContent.trim().slice(0, 40);
    const d = document.createElement('details'); d.className = c.className + ' cl'; d.dataset.k = key; if (c.getAttribute('style')) d.setAttribute('style', c.getAttribute('style'));
    const sm = document.createElement('summary'), b = document.createElement('b'); b.textContent = h.textContent; sm.appendChild(b);
    const body = document.createElement('div'); body.className = 'clb'; h.remove(); while (c.firstChild) body.appendChild(c.firstChild);
    d.appendChild(sm); d.appendChild(body); d.open = S.cl[key] !== undefined ? S.cl[key] : (len < 1400 || !!body.querySelector('input,select,textarea'));
    d.addEventListener('toggle', () => { S.cl[key] = d.open; });
    c.replaceWith(d);
  });
  const ds = v.querySelectorAll('details.cl');
  if (ds.length >= 3 && !v.querySelector('.cltool')) { const t = document.createElement('div'); t.className = 'cltool'; t.innerHTML = '<button class="s sm" data-o="1">Buka semua</button><button class="s sm" data-o="0">Tutup semua</button>'; t.querySelectorAll('button').forEach(b => b.onclick = () => v.querySelectorAll('details.cl').forEach(d => { d.open = b.dataset.o === '1'; })); const h2 = v.querySelector('h2'); if (h2) h2.after(t); else v.prepend(t); }
}
function paginate(v) {
  if (!v) return; let n = 0;
  const targets = [...v.querySelectorAll('table')].filter(t => !t.closest('.prev')).map(t => ({ el: t, rows: () => [...(t.tBodies[0] ? t.tBodies[0].rows : [])], host: t.closest('.tw') || t }))
    .concat([...v.querySelectorAll('[data-pgl]')].map(el => ({ el, rows: () => [...el.children], host: el, per: +el.dataset.pgl || PER })));
  targets.forEach(t => {
    const key = (S.tab || '') + '#' + (n++), per = t.per || PER, rows = t.rows().filter(r => !r.dataset.hide), pages = Math.max(1, Math.ceil(rows.length / per));
    let bar = t.host.nextElementSibling && t.host.nextElementSibling.classList.contains('pgr') && t.host.nextElementSibling.dataset.k === key ? t.host.nextElementSibling : null;
    t.rows().forEach(r => { if (r.dataset.hide) r.style.display = 'none'; });
    if (rows.length <= per) { if (bar) bar.remove(); rows.forEach(r => { r.style.display = ''; }); return; }
    let p = Math.min(Math.max(S.pg[key] || 1, 1), pages); S.pg[key] = p;
    rows.forEach((r, i) => { r.style.display = i >= (p - 1) * per && i < p * per ? '' : 'none'; });
    if (!bar) { bar = document.createElement('div'); bar.className = 'pgr'; bar.dataset.k = key; bar.innerHTML = '<button class="s sm" data-d="-1">‹ Sebelumnya</button><span></span><button class="s sm" data-d="1">Berikutnya ›</button>'; bar.querySelectorAll('button').forEach(b => b.onclick = () => { S.pg[key] = (S.pg[key] || 1) + +b.dataset.d; paginate($('#v')); }); t.host.after(bar); }
    bar.querySelector('span').textContent = 'Hal ' + p + ' / ' + pages + ' • ' + rows.length + ' data';
    bar.querySelector('[data-d="-1"]').disabled = p <= 1; bar.querySelector('[data-d="1"]').disabled = p >= pages;
  });
}
function enhance() { const v = $('#v'); if (!v) return; if (S.obs) S.obs.disconnect(); try { autoCollapse(v); paginate(v); } catch (e) { console.error(e); } if (S.obs) S.obs.observe(v, { childList: true, subtree: true }); }
function watch() { if (S.obs) S.obs.disconnect(); S.obs = new MutationObserver(() => { clearTimeout(S.ot); S.ot = setTimeout(enhance, 40); }); S.obs.observe($('#v'), { childList: true, subtree: true }); setTimeout(enhance, 60); }
function copyText(t) { try { if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t).then(() => toast('Link disalin'), () => fb()); } catch (e) {} return fb(); function fb() { const x = document.createElement('textarea'); x.value = t; x.style.position = 'fixed'; x.style.opacity = '0'; document.body.appendChild(x); x.select(); try { document.execCommand('copy'); toast('Link disalin'); } catch (e) { toast('Gagal menyalin. Salin manual: ' + t, true); } x.remove(); } }
const liveUrl = a => ((S.d.site.baseUrl || '').replace(/\/$/, '')) + '/artikel/' + a.slug + '/';

const VIEWS = {};
VIEWS.home = async v => {
  const a = S.d.articles, pub = a.filter(x => x.status === 'published').length, sch = a.filter(x => x.status === 'scheduled').length, rdy = a.filter(x => x.status === 'ready').length;
  v.innerHTML = `<h2>Beranda</h2><div class="grid"><div class="card"><div class="muted">Model</div><div class="score">${S.d.models.length}</div></div><div class="card"><div class="muted">Artikel terbit</div><div class="score">${pub}</div><div class="muted">${a.length - pub - sch - rdy} draft • ${rdy} siap • ${sch} terjadwal</div></div><div class="card"><div class="muted">Keyword</div><div class="score">${S.d.keywords.length}</div></div></div>
<div class="card"><h3>Skor SEO situs</h3><div id="hs" class="muted">Memuat…</div><div class="row" style="margin-top:12px"><button id="b1">Jalankan build & cek ulang</button><button class="s" data-go="seo">Lihat laporan</button></div></div>
<div class="card"><h3>Kabar ke Bing (IndexNow)</h3><div id="inx" class="muted">Memuat…</div></div>
<div class="card"><h3>Proses GitHub Actions</h3><div id="runbox"></div></div>
<div class="card"><h3>Mulai cepat</h3><div class="row"><button class="s" data-go="articles">Tulis artikel</button><button class="s" data-go="prices">Ubah harga</button><button class="s" data-go="media">Upload foto/zip</button><button class="s" data-go="backup">Backup</button></div></div>
<div class="card"><h3>Langkah awal wajib</h3><p class="muted">1) Pengaturan: isi nama dealer, nomor WhatsApp, alamat, dan baseUrl. 2) Upload foto asli di Media. 3) Cek skor SEO artikel sebelum terbit.</p></div>`;
  v.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go)); $('#b1').onclick = build; runsWidget($('#runbox'));
  indexnowBox($('#inx'));
  const r = await loadReport(); $('#hs').innerHTML = r ? `<div class="row"><div>${sc(r.site.total)}<div class="muted">Total</div></div><div>${sc(r.site.pageScore)}<div class="muted">Halaman</div></div><div>${sc(r.site.articleScore)}<div class="muted">Artikel</div></div><div>${sc(r.site.techScore)}<div class="muted">Teknis</div></div></div>` : 'Belum ada laporan. Jalankan build.';
};


/* ---------- upload foto di tempat (tanpa salin alamat) ---------- */
S.local = {};
async function uploadImg(f, max) {
  if (!S.media) { try { S.media = (await listDir('assets/img')).filter(x => x.type === 'file').map(x => x.name); } catch (e) { S.media = []; } }
  const svg = f.type === 'image/svg+xml' || /\.svg$/i.test(f.name), ext = svg ? '.svg' : '.webp';
  const blob = svg ? f : await toWebp(f, max || 1600); let name = slugName(f.name) + ext;
  if (S.media.includes(name)) name = slugName(f.name) + '-' + Date.now().toString(36).slice(-4) + ext;
  await putFile('assets/img/' + name, bufb64(await blob.arrayBuffer()), 'Upload foto ' + name);
  S.media.push(name); S.local['assets/img/' + name] = URL.createObjectURL(blob); return 'assets/img/' + name;
}
function pickUp(multi, done, max) {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = !!multi; i.style.display = 'none'; document.body.appendChild(i);
  i.onchange = async () => { const fs = [...i.files], out = []; let n = 0; i.remove();
    for (const f of fs) { toast('Mengunggah ' + (++n) + '/' + fs.length + ': ' + f.name); try { out.push(await uploadImg(f, max)); } catch (e) { toast(f.name + ': ' + e.message, true); } }
    if (out.length) { done(out); toast('✓ ' + out.length + ' foto terunggah. Tekan Simpan agar tampil di website.'); } };
  i.click();
}
const thumb = p => p ? `<img class="pv" alt="" src="${E(S.local[p] || '../' + p)}" onerror="this.style.display='none'">` : '';

/* ---------- ZIP ke root repo + status GitHub Actions ---------- */
async function zipNames(file) {
  const tail = await file.slice(Math.max(0, file.size - 70000)).arrayBuffer(), dv = new DataView(tail); let e = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('Bukan file ZIP yang valid');
  const size = dv.getUint32(e + 12, true), off = dv.getUint32(e + 16, true);
  if (off === 0xFFFFFFFF) return null;
  const cd = await file.slice(off, off + size).arrayBuffer(), cv = new DataView(cd), u8 = new Uint8Array(cd), names = []; let p = 0;
  while (p + 46 <= cd.byteLength && cv.getUint32(p, true) === 0x02014b50) { const nl = cv.getUint16(p + 28, true), el = cv.getUint16(p + 30, true), cl = cv.getUint16(p + 32, true); names.push(new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl))); p += 46 + nl + el + cl; }
  return names;
}
const KNOWN_DIRS = ['assets', 'data', 'admin', 'build', 'shared', 'docs', 'backup', 'upload', 'model', 'artikel', 'kontak', 'pricelist', 'tentang'];
function zipReport(names) {
  const files = names.filter(n => !n.endsWith('/') && !/^__MACOSX\//.test(n) && !/\.DS_Store$/.test(n) && !/(^|\/)\.git(hub)?\//.test(n));
  const tops = {}; files.forEach(n => { const t = n.includes('/') ? n.split('/')[0] : '(root)'; tops[t] = (tops[t] || 0) + 1; });
  const keys = Object.keys(tops), warn = [];
  if (files.some(n => n.startsWith('/') || n.includes('..'))) warn.push('❌ ZIP berisi path tidak aman. Dibatalkan.');
  if (keys.length === 1 && keys[0] !== '(root)' && !KNOWN_DIRS.includes(keys[0])) warn.push('ℹ️ ZIP dibungkus folder "' + keys[0] + '/". Folder pembungkus akan dibuang otomatis (butuh build.yml terbaru).');
  if (files.some(n => /^data\//.test(n))) warn.push('⚠️ ZIP berisi folder data/ (artikel, model, harga, dll). Isinya akan MENIMPA data yang ada.');
  if (files.some(n => /^(admin|build|shared)\//.test(n))) warn.push('⚠️ ZIP berisi file sistem (admin/build/shared). Pastikan ini patch resmi.');
  return { count: files.length, tops, warn, bad: warn.some(w => w.startsWith('❌')) };
}
const RUN_ICON = r => r.status !== 'completed' ? '⏳' : ({ success: '✅', failure: '❌', cancelled: '⏹️', skipped: '⏭️' }[r.conclusion] || '❔');
const RUN_EVT = { push: 'otomatis (ada perubahan)', schedule: 'terjadwal (tiap jam)', workflow_dispatch: 'dijalankan manual' };
function runsWidget(box) {
  box.innerHTML = `<div class="row"><button id="runb">▶ Jalankan workflow sekarang</button><button class="s" id="runr">↻ Segarkan</button></div><div id="runl" class="muted" style="margin-top:10px">Memuat…</div>`;
  let timer = null;
  const load = async () => {
    clearTimeout(timer); const L = $('#runl'); if (!L || !document.body.contains(box)) return;
    try {
      const j = await gh('actions/runs?per_page=12'), all = j.workflow_runs || [], mine = all.filter(r => (r.path || '').endsWith('build.yml')), rs = (mine.length ? mine : all).slice(0, 5);
      L.innerHTML = rs.map(r => { const sec = r.status === 'completed' ? Math.max(0, Math.round((Date.parse(r.updated_at) - Date.parse(r.run_started_at || r.created_at)) / 1000)) : null; return `<div class="chk"><i>${RUN_ICON(r)}</i><div>${r.status === 'completed' ? (r.conclusion === 'success' ? 'Berhasil' : r.conclusion === 'failure' ? 'GAGAL' : r.conclusion) : (r.status === 'queued' ? 'Antre…' : 'Sedang berjalan…')} • ${RUN_EVT[r.event] || r.event}<div class="t">${fmtDT(r.created_at)}${sec != null ? ' • ' + sec + ' detik' : ''} • <a href="${E(r.html_url)}" target="_blank" rel="noopener" style="color:var(--ac)">Detail</a></div></div></div>`; }).join('') || 'Belum ada proses.';
      if (rs[0] && rs[0].status === 'completed' && rs[0].conclusion === 'failure') L.innerHTML += '<p class="muted">Proses terakhir gagal. Buka Detail, ketuk langkah bertanda merah, lalu kirim tangkapan layarnya.</p>';
      if (rs.some(r => r.status !== 'completed')) timer = setTimeout(load, 8000);
    } catch (e) { L.textContent = 'Gagal memuat status: ' + e.message + ' (token perlu izin Actions: Read and write)'; }
  };
  $('#runr').onclick = load;
  $('#runb').onclick = async () => { try { await gh('actions/workflows/build.yml/dispatches', { method: 'POST', body: JSON.stringify({ ref: S.cfg.branch }) }); toast('Workflow dijalankan. Status diperbarui otomatis.'); setTimeout(load, 2500); } catch (e) { toast('Gagal: ' + e.message + ' (token perlu izin Actions: Read and write)', true); } };
  load(); return load;
}

/* --- Artikel --- */
const ST = { draft: ['Draft', 'warn'], ready: ['Siap publish', 'rdy'], scheduled: ['Terjadwal', 'sch'], published: ['Terbit', 'ok'] };
const fmtDT = iso => { try { return new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB'; } catch (e) { return iso || ''; } };
let AF = 'all';
VIEWS.articles = v => {
  const A = S.d.articles, cnt = k => k === 'all' ? A.length : A.filter(a => a.status === k).length;
  const sched = A.filter(a => a.status === 'scheduled' && a.publishAt).sort((x, y) => Date.parse(x.publishAt) - Date.parse(y.publishAt));
  const rows = A.map((a, i) => ({ a, i })).filter(x => AF === 'all' || x.a.status === AF);
  v.innerHTML = `<h2>Artikel</h2><div class="row"><button id="new">+ Artikel baru</button><button class="s" id="ideas">Ide artikel dari keyword</button><button class="s" data-go="laporan">Export Laporan</button></div>
<div class="fl" id="flt">${[['all', 'Semua'], ['draft', 'Draft'], ['ready', 'Siap publish'], ['scheduled', 'Terjadwal'], ['published', 'Terbit']].map(f => `<button class="s sm${AF === f[0] ? ' on' : ''}" data-f="${f[0]}">${f[1]} (${cnt(f[0])})</button>`).join('')}</div>
${sched.length ? `<div class="card"><h3>🕒 Jadwal publish</h3>${sched.map(a => `<div class="chk"><i>•</i><div>${E(a.title)}<div class="t">${fmtDT(a.publishAt)}</div></div></div>`).join('')}<p class="muted" style="margin-top:8px">Terbit otomatis pada build pertama setelah waktunya tiba.</p></div>` : ''}
<div id="ideaBox"></div><div class="card tw" style="margin-top:14px"><table><thead><tr><th>Judul</th><th>Skor</th><th></th></tr></thead><tbody>${rows.map(({ a, i }) => { const r = SEO.scoreArticle(a, A), st = ST[a.status] || [a.status, 'warn']; return `<tr><td>${E(a.title)}<div class="muted">${E(a.keyword || '-')} • <span class="pill ${st[1]}">${st[0]}</span>${a.status === 'scheduled' && a.publishAt ? ' • ' + fmtDT(a.publishAt) : ''}</div></td><td>${sc(r.score)}</td><td><button class="sm s" data-e="${i}">Edit</button>${a.status === 'published' ? ` <button class="sm s" data-cp="${i}">Salin link</button>` : ''}${a.status === 'ready' ? ` <button class="sm" data-p="${i}">Terbitkan</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan=3>Tidak ada artikel di kategori ini</td></tr>'}</tbody></table></div>`;
  v.querySelectorAll('[data-cp]').forEach(b => b.onclick = () => copyText(liveUrl(A[+b.dataset.cp])));
  v.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { AF = b.dataset.f; VIEWS.articles(v); });
  v.querySelectorAll('[data-p]').forEach(b => b.onclick = async () => { const a = A[+b.dataset.p], r = SEO.scoreArticle(a, A); if (r.score < 80 && !confirm('Skor SEO ' + r.score + ' (di bawah 80). Tetap terbitkan?')) return; if (!confirm('Terbitkan "' + a.title + '" sekarang?')) return; a.status = 'published'; a.date = today(); delete a.publishAt; await save('articles', 'Terbitkan: ' + a.title); VIEWS.articles(v); });
  v.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  $('#new').onclick = () => editArticle(v, { title: '', slug: '', keyword: '', description: '', image: '', imageAlt: '', date: today(), status: 'draft', category: 'Tips EV', body: '**Jawaban singkat:** \n\n## \n\n## \n\n## Pertanyaan yang sering diajukan\n\n### \n\n### \n\n### \n' }, -1);
  v.querySelectorAll('[data-e]').forEach(b => b.onclick = () => editArticle(v, JSON.parse(JSON.stringify(A[b.dataset.e])), +b.dataset.e));
  $('#ideas').onclick = () => {
    const T = { hard: ['Panduan lengkap {k}: yang harus Anda tahu', '{k}: perbandingan dan rekomendasi {y}'], medium: ['{k}: harga, spesifikasi, dan pilihan varian', 'Kelebihan dan kekurangan {k} menurut pengguna'], low: ['Cara mudah {k} untuk pemula', '{k}: pertanyaan yang sering diajukan'] };
    const used = new Set(A.map(a => (a.keyword || '').toLowerCase()));
    const rows = S.d.keywords.filter(k => !used.has(k.kw.toLowerCase())).slice(0, 12).map(k => (T[k.tier] || T.low).map(t => t.replace('{k}', k.kw).replace('{y}', new Date().getFullYear())).map(t => `<tr><td>${E(t)}</td><td><span class="pill">${k.tier}</span></td><td>${E(k.kw)}</td></tr>`).join('')).join('');
    $('#ideaBox').innerHTML = `<div class="card tw"><h3>Ide judul (keyword yang belum punya artikel)</h3><table><thead><tr><th>Judul</th><th>Tier</th><th>Keyword</th></tr></thead><tbody>${rows || '<tr><td colspan=3>Semua keyword sudah punya artikel.</td></tr>'}</tbody></table><p class="muted">Sebelum menulis: riset 3-5 hasil teratas Google untuk keyword itu, catat pertanyaan yang belum terjawab, lalu tulis dengan kata-kata sendiri. Jangan menyalin.</p></div>`;
  };
};
function editArticle(v, a, idx) {
  const all = () => S.d.articles.filter((_, i) => i !== idx).concat([a]);
  const imgs = (S.media || []).map(m => `<option value="assets/img/${E(m)}">${E(m)}</option>`).join('');
  v.innerHTML = `<h2>${idx < 0 ? 'Artikel baru' : 'Edit artikel'}</h2>
<div class="card"><h3>Data dan isi artikel</h3><label>Judul (30-60 karakter)<input id="f_title" value="${E(a.title)}"></label><div class="muted" id="c_title"></div>
<div class="grid"><label>Keyword utama<input id="f_keyword" value="${E(a.keyword)}"></label><label>Slug URL<input id="f_slug" value="${E(a.slug)}"></label></div>
<label>Meta description (120-160 karakter)<textarea id="f_description" style="min-height:70px;font-family:inherit">${E(a.description)}</textarea></label><div class="muted" id="c_desc"></div>
<div class="grid"><label>Kategori<input id="f_category" value="${E(a.category || '')}"></label><label>Tanggal<input id="f_date" type="date" value="${E(a.date)}"></label><label>Status<select id="f_status"><option value="draft"${a.status === 'draft' ? ' selected' : ''}>Draft (belum selesai)</option><option value="ready"${a.status === 'ready' ? ' selected' : ''}>Siap publish (menunggu)</option><option value="scheduled"${a.status === 'scheduled' ? ' selected' : ''}>Terjadwal (terbit otomatis)</option><option value="published"${a.status === 'published' ? ' selected' : ''}>Terbit sekarang</option></select></label></div>
<div id="schedBox" style="display:none"><label>Tanggal dan jam terbit (WIB)<input id="f_publishAt" type="datetime-local" value="${E(a.publishAt ? a.publishAt.slice(0, 16) : '')}"></label><div class="muted" style="margin:-6px 0 12px">Artikel terbit otomatis oleh build berikutnya setelah waktu ini. Jam terbit tepat butuh build.yml terbaru (build tiap jam); tanpa itu terbit paling lambat 03:00 WIB.</div></div>
<div class="grid"><label>Gambar utama<input id="f_image" value="${E(a.image)}" list="imgl"></label><label>Teks alt gambar<input id="f_imageAlt" value="${E(a.imageAlt)}"></label></div><div class="row"><button class="s sm" id="upmain">📷 Upload gambar utama</button></div><div id="pvmain">${thumb(a.image)}</div><datalist id="imgl">${imgs}</datalist>
<label>Isi artikel (Markdown). Awali dengan <b>**Jawaban singkat:**</b>, pakai ## untuk subjudul, ### untuk FAQ</label>
<div class="row" style="margin-bottom:8px"><button class="s sm" data-ins="## ">H2</button><button class="s sm" data-ins="### ">H3</button><button class="s sm" data-ins="**tebal**">Tebal</button><button class="s sm" data-ins="- ">Daftar</button><button class="s sm" data-ins="[teks](/model/xpeng-x9/)">Link</button><button class="s sm" id="upbody">📷 Foto</button><button class="s sm" id="tbl">Tabel</button></div>
<textarea id="f_body" style="min-height:340px">${E(a.body)}</textarea>
<div class="card" style="background:#0d0f13"><h3>Saran internal link</h3><div id="sug" class="row"></div></div>
<div class="row"><button id="sv">Simpan</button><button class="s" id="pv">Pratinjau</button><button class="s" id="bk">Kembali</button>${idx >= 0 ? '<button class="d" id="dl">Hapus</button>' : ''}</div></div>
<div class="card"><h3>Skor SEO / AEO / GEO</h3><div class="row"><div id="scr"></div><div style="flex:3" class="muted" id="sum"></div></div><div id="chk"></div></div><div id="pvbox"></div>`;
  const F = id => $('#f_' + id), ta = F('body');
  const read = () => { ['title', 'keyword', 'slug', 'description', 'category', 'date', 'status', 'image', 'imageAlt', 'body'].forEach(k => a[k] = F(k).value); { const pv = F('publishAt').value; if (a.status === 'scheduled' && pv) a.publishAt = pv + ':00+07:00'; else delete a.publishAt; } a.slug = (a.slug || MD.slug(a.title)).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'); };
  const upd = () => { read(); $('#schedBox').style.display = a.status === 'scheduled' ? '' : 'none'; const r = SEO.scoreArticle(a, all()); $('#scr').innerHTML = sc(r.score) + ` <b>${r.grade}</b>`; $('#sum').innerHTML = `${r.words} kata • kepadatan keyword ${r.density}% • internal link ${r.internal} • FAQ ${r.faq} • kemiripan ${r.overlap}%`; $('#chk').innerHTML = checks(r.checks);
    $('#c_title').textContent = a.title.length + ' karakter'; $('#c_desc').textContent = a.description.length + ' karakter';
    const t = [['/', 'Beranda'], ['/pricelist/', 'Pricelist'], ['/kontak/', 'Test Drive'], ...S.d.models.map(m => ['/model/' + m.slug + '/', m.name]), ...S.d.articles.filter(x => x.slug !== a.slug && x.status === 'published').map(x => ['/artikel/' + x.slug + '/', x.title])];
    $('#sug').innerHTML = t.filter(x => !a.body.includes('](' + x[0] + ')')).map(x => `<button class="s sm" data-lk="${E(x[0])}" data-tx="${E(x[1])}">+ ${E(x[1].slice(0, 28))}</button>`).join(''); v.querySelectorAll('[data-lk]').forEach(b => b.onclick = () => ins(`[${b.dataset.tx}](${b.dataset.lk})`)); };
  function ins(t) { const s = ta.selectionStart, e = ta.selectionEnd; ta.value = ta.value.slice(0, s) + t + ta.value.slice(e); ta.focus(); ta.selectionStart = ta.selectionEnd = s + t.length; upd(); }
  v.querySelectorAll('[data-ins]').forEach(b => b.onclick = () => ins(b.dataset.ins)); $('#tbl').onclick = () => ins('\n| Kolom 1 | Kolom 2 |\n|---|---|\n| isi | isi |\n');
  v.querySelectorAll('input,textarea,select').forEach(x => x.oninput = upd); upd();
  F('status').addEventListener('change', () => { if (F('status').value === 'scheduled' && !F('publishAt').value) { F('publishAt').value = new Date(Date.now() + 864e5 + 252e5).toISOString().slice(0, 10) + 'T08:00'; upd(); } });
  $('#upmain').onclick = () => pickUp(false, ps => { F('image').value = ps[0]; if (!F('imageAlt').value) F('imageAlt').value = F('keyword').value || F('title').value; $('#pvmain').innerHTML = thumb(ps[0]); upd(); });
  $('#upbody').onclick = () => { const alt = prompt('Teks alt (deskripsi singkat foto, untuk SEO):', F('keyword').value || ''); if (alt === null) return; pickUp(true, ps => ins(ps.map(p => '\n![' + alt + '](' + p + ')\n').join(''))); };
  F('image').addEventListener('input', () => { $('#pvmain').innerHTML = thumb(F('image').value); });
  $('#pv').onclick = () => { read(); $('#pvbox').innerHTML = `<div class="card"><h3>Pratinjau</h3><div class="prev"><h1 style="font-size:1.5rem">${E(a.title)}</h1>${MD.render(a.body)}</div></div>`; };
  $('#bk').onclick = () => go('articles');
  $('#sv').onclick = async () => { read(); if (!a.title) return toast('Judul wajib diisi', true); const r = SEO.scoreArticle(a, all()); if (a.status === 'scheduled') { if (!a.publishAt) return toast('Isi tanggal dan jam terbit', true); if (Date.parse(a.publishAt) <= Date.now() && !confirm('Waktu terbit sudah lewat. Artikel langsung terbit pada build berikutnya. Lanjut?')) return; }
    if (['ready', 'scheduled', 'published'].includes(a.status) && r.score < 80 && !confirm('Skor SEO ' + r.score + ' (di bawah 80). Tetap lanjut?')) return; if (idx < 0) { S.d.articles.push(a); idx = S.d.articles.length - 1; } else S.d.articles[idx] = a; await save('articles', 'Artikel: ' + a.title); };
  if ($('#dl')) $('#dl').onclick = async () => { if (!confirm('Hapus artikel ini?')) return; S.d.articles.splice(idx, 1); await save('articles', 'Hapus artikel'); go('articles'); };
  if (!S.media) listDir('assets/img').then(l => { S.media = l.filter(x => x.type === 'file').map(x => x.name); const dl = $('#imgl'); if (dl) dl.innerHTML = S.media.map(m => `<option value="assets/img/${E(m)}">`).join(''); });
}

/* --- Model --- */
const lines = s => s.split('\n').map(x => x.trim()).filter(Boolean);
VIEWS.models = v => {
  v.innerHTML = `<h2>Model mobil</h2><button id="nm">+ Model baru</button><div style="margin-top:14px">${S.d.models.map((m, i) => `<div class="card"><b>${E(m.name)}</b><div class="muted">${E(m.type)} • ${m.variants.length} varian</div><div class="row" style="margin-top:8px"><button class="s sm" data-e="${i}">Edit</button><button class="d sm" data-d="${i}">Hapus</button></div></div>`).join('')}</div>`;
  v.querySelectorAll('[data-e]').forEach(b => b.onclick = () => editModel(v, +b.dataset.e));
  v.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => { if (confirm('Hapus model ini?')) { S.d.models.splice(+b.dataset.d, 1); await save('models', 'Hapus model'); go('models'); } });
  $('#nm').onclick = () => { S.d.models.push({ slug: 'model-baru', name: 'Model Baru', type: '', tagline: '', hero: 'assets/img/placeholder.svg', gallery: [], colors: [{ name: 'Putih', hex: '#f4f4f2', image: 'assets/img/placeholder.svg' }], variants: [{ name: 'Varian 1', price: 0 }], highlights: [], specs: [], faq: [], metaTitle: '', metaDescription: '' }); editModel(v, S.d.models.length - 1); };
};
function editModel(v, i) {
  const m = S.d.models[i];
  v.innerHTML = `<h2>Edit ${E(m.name)}</h2><div class="card"><div class="grid"><label>Nama<input id="m_name" value="${E(m.name)}"></label><label>Slug URL<input id="m_slug" value="${E(m.slug)}"></label></div><label>Jenis<input id="m_type" value="${E(m.type)}"></label><label>Tagline<input id="m_tagline" value="${E(m.tagline)}"></label><label>Gambar hero<input id="m_hero" value="${E(m.hero)}"></label><div class="row"><button class="s sm" id="up_hero">📷 Upload foto hero</button></div><div id="pv_hero">${thumb(m.hero)}</div>
<label>Meta title (30-60)<input id="m_metaTitle" value="${E(m.metaTitle)}"></label><label>Meta description (120-160)<textarea id="m_metaDescription" style="min-height:70px;font-family:inherit">${E(m.metaDescription)}</textarea></label>
<label>Varian dan harga (format: Nama|harga angka, satu per baris)<textarea id="m_variants">${E(m.variants.map(x => x.name + '|' + x.price).join('\n'))}</textarea></label>
<h3>Warna mobil</h3><div id="cols"></div><button class="s sm" id="addcol">+ Tambah warna</button>
<h3 style="margin-top:16px">Galeri foto</h3><div class="row"><button class="s sm" id="up_gal">📷 Upload foto galeri (bisa banyak)</button></div><div class="pvs" id="pv_gal"></div>
<label>Daftar path galeri (otomatis terisi, boleh diedit/urutkan)<textarea id="m_gallery">${E(m.gallery.join('\n'))}</textarea></label>
<label>Keunggulan (satu per baris)<textarea id="m_highlights" style="font-family:inherit">${E(m.highlights.join('\n'))}</textarea></label>
<label>Spesifikasi (Nama: nilai)<textarea id="m_specs" style="font-family:inherit">${E(m.specs.map(x => x.k + ': ' + x.v).join('\n'))}</textarea></label>
<label>FAQ (Pertanyaan?|Jawaban)<textarea id="m_faq" style="font-family:inherit">${E(m.faq.map(x => x.q + '|' + x.a).join('\n'))}</textarea></label>
<div class="row"><button id="sv">Simpan</button><button class="s" id="bk">Kembali</button></div></div>`;
  const cols = m.colors.map(c => ({ ...c }));
  const drawCols = () => { $('#cols').innerHTML = cols.map((c, k) => `<div class="crow"><div class="grid"><label>Nama warna<input data-c="${k}" data-f="name" value="${E(c.name)}"></label><label>Warna<input type="color" data-c="${k}" data-f="hex" value="${E(/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : '#999999')}"></label></div><label>Foto untuk warna ini<input data-c="${k}" data-f="image" value="${E(c.image)}"></label><div class="row"><button class="s sm" data-cu="${k}">📷 Upload foto warna</button><button class="d sm" data-cx="${k}">Hapus</button></div>${thumb(c.image)}</div>`).join('');
    $('#cols').querySelectorAll('[data-c]').forEach(i => i.oninput = () => { cols[i.dataset.c][i.dataset.f] = i.value; });
    $('#cols').querySelectorAll('[data-cu]').forEach(b => b.onclick = () => pickUp(false, ps => { cols[b.dataset.cu].image = ps[0]; drawCols(); }));
    $('#cols').querySelectorAll('[data-cx]').forEach(b => b.onclick = () => { cols.splice(+b.dataset.cx, 1); drawCols(); }); };
  drawCols(); $('#addcol').onclick = () => { cols.push({ name: 'Warna baru', hex: '#999999', image: m.hero }); drawCols(); };
  const drawGal = () => { $('#pv_gal').innerHTML = lines($('#m_gallery').value).map(p => `<img alt="" src="${E(S.local[p] || '../' + p)}" onerror="this.style.display='none'">`).join(''); };
  $('#m_gallery').oninput = drawGal; drawGal();
  $('#up_gal').onclick = () => pickUp(true, ps => { const t = $('#m_gallery'); t.value = (t.value.trim() ? t.value.trim() + '\n' : '') + ps.join('\n'); drawGal(); });
  $('#up_hero').onclick = () => pickUp(false, ps => { $('#m_hero').value = ps[0]; $('#pv_hero').innerHTML = thumb(ps[0]); });
  $('#m_hero').oninput = () => { $('#pv_hero').innerHTML = thumb($('#m_hero').value); };
  $('#bk').onclick = () => go('models');
  $('#sv').onclick = async () => { const g = id => $('#m_' + id).value; Object.assign(m, { name: g('name'), slug: g('slug').toLowerCase().replace(/[^a-z0-9-]/g, '-'), type: g('type'), tagline: g('tagline'), hero: g('hero'), metaTitle: g('metaTitle'), metaDescription: g('metaDescription'),
    variants: lines(g('variants')).map(l => { const p = l.split('|'); return { name: p[0].trim(), price: parseInt(String(p[1] || '0').replace(/\D/g, '')) || 0 }; }), colors: cols.filter(c => c.name.trim()).map(c => ({ name: c.name.trim(), hex: c.hex || '#999999', image: c.image || g('hero') })),
    gallery: lines(g('gallery')), highlights: lines(g('highlights')), specs: lines(g('specs')).map(l => { const k = l.indexOf(':'); return { k: l.slice(0, k).trim(), v: l.slice(k + 1).trim() }; }), faq: lines(g('faq')).map(l => { const p = l.split('|'); return { q: p[0].trim(), a: (p[1] || '').trim() }; }) }); await save('models', 'Model: ' + m.name); };
}

/* --- Leasing (marquee logo) --- */
VIEWS.leasing = v => {
  const L = S.d.leasing;
  const draw = () => {
    v.innerHTML = `<h2>Partner leasing</h2><div class="card"><p class="muted">Logo tampil sebagai marquee berjalan di halaman Model, Pricelist, dan Beranda (bagian varian dan cicilan). Upload logo (PNG, JPG, WebP, atau SVG). Tanpa logo, nama tampil sebagai teks. Hanya isi leasing yang benar-benar bekerja sama dengan dealer.</p><div class="row"><button id="addl">+ Tambah leasing</button><button id="sv">Simpan</button></div></div>
${L.map((l, i) => `<div class="card"><label>Nama leasing<input data-i="${i}" data-f="name" value="${E(l.name || '')}"></label><label>Logo (path, terisi otomatis saat upload)<input data-i="${i}" data-f="logo" value="${E(l.logo || '')}"></label>${l.logo ? `<div style="background:#f2f4f7;border-radius:10px;padding:10px;display:inline-block;margin-bottom:10px"><img alt="" style="height:44px;width:auto;max-width:160px" src="${E(S.local[l.logo] || '../' + l.logo)}" onerror="this.style.display='none'"></div>` : ''}<div class="row"><button class="s sm" data-u="${i}">📷 Upload logo</button><button class="s sm" data-up="${i}">↑</button><button class="s sm" data-dn="${i}">↓</button><button class="d sm" data-x="${i}">Hapus</button></div></div>`).join('') || '<div class="card muted">Belum ada leasing. Tekan "+ Tambah leasing".</div>'}`;
    const sync = () => v.querySelectorAll('[data-f]').forEach(i => L[i.dataset.i][i.dataset.f] = i.value);
    $('#addl').onclick = () => { sync(); L.push({ name: 'Nama leasing', logo: '' }); draw(); };
    $('#sv').onclick = async () => { sync(); S.d.leasing = L.filter(x => (x.name || '').trim()); await save('leasing', 'Update partner leasing'); };
    v.querySelectorAll('[data-u]').forEach(b => b.onclick = () => { sync(); pickUp(false, ps => { L[+b.dataset.u].logo = ps[0]; draw(); }, 600); });
    v.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { sync(); if (confirm('Hapus leasing ini?')) { L.splice(+b.dataset.x, 1); draw(); } });
    v.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { sync(); const i = +b.dataset.up; if (i > 0) { [L[i - 1], L[i]] = [L[i], L[i - 1]]; draw(); } });
    v.querySelectorAll('[data-dn]').forEach(b => b.onclick = () => { sync(); const i = +b.dataset.dn; if (i < L.length - 1) { [L[i + 1], L[i]] = [L[i], L[i + 1]]; draw(); } });
  };
  draw();
};

/* --- Tentang & lokasi --- */
VIEWS.about = v => {
  const A = S.d.about = Object.assign({ intro: [], photos: [], services: [], history: [], hours: [], mapsQuery: '', mapsEmbed: '' }, S.d.about);
  const draw = () => {
    v.innerHTML = `<h2>Tentang & lokasi</h2><div class="card"><p class="muted">Isi halaman <b>Tentang</b> dan blok lokasi di halaman <b>Kontak</b>. Nomor WhatsApp, telepon, email, alamat, dan sosmed diubah di menu <b>Pengaturan</b>.</p></div>
<div class="card"><h3>Profil dealer</h3><label>Teks profil (pisahkan paragraf dengan baris kosong)<textarea id="a_intro" style="min-height:170px;font-family:inherit">${E(A.intro.join('\n\n'))}</textarea></label><label>Layanan (satu per baris)<textarea id="a_services" style="font-family:inherit">${E(A.services.join('\n'))}</textarea></label><label>Jam operasional (satu per baris, contoh: Senin - Sabtu: 09.00 - 18.00)<textarea id="a_hours" style="font-family:inherit">${E(A.hours.join('\n'))}</textarea></label></div>
<div class="card"><h3>Foto dealer</h3><p class="muted">Foto pertama menjadi latar halaman Tentang. Tulis teks alt singkat untuk SEO.</p><div class="row"><button class="s sm" id="a_up">📷 Upload foto dealer (bisa banyak)</button></div>
${A.photos.map((ph, i) => `<div class="card" style="margin-top:10px"><img alt="" class="pv" style="height:90px" src="${E(S.local[ph.src] || '../' + ph.src)}" onerror="this.style.display='none'"><label>Teks alt<input data-pi="${i}" value="${E(ph.alt || '')}"></label><div class="row"><button class="s sm" data-pu="${i}">↑</button><button class="s sm" data-pd="${i}">↓</button><button class="d sm" data-px="${i}">Hapus</button></div></div>`).join('')}</div>
<div class="card"><h3>Sejarah perusahaan</h3>${A.history.map((h, i) => `<div class="card"><div class="grid"><label>Tahun<input data-hi="${i}" data-hf="year" value="${E(h.year || '')}"></label><label>Judul<input data-hi="${i}" data-hf="title" value="${E(h.title || '')}"></label></div><label>Cerita<textarea data-hi="${i}" data-hf="text" style="font-family:inherit">${E(h.text || '')}</textarea></label><div class="row"><button class="s sm" data-hu="${i}">↑</button><button class="s sm" data-hd="${i}">↓</button><button class="d sm" data-hx="${i}">Hapus</button></div></div>`).join('')}<button class="s sm" id="a_hadd">+ Tambah tonggak sejarah</button></div>
<div class="card"><h3>Google Maps</h3><label>Lokasi untuk peta (kosongkan = pakai alamat di Pengaturan)<input id="a_mq" value="${E(A.mapsQuery || '')}" placeholder="Nama dealer, kota"></label><label>Embed Google Maps (opsional, tempel kode iframe atau link embed dari Google Maps > Bagikan > Sematkan peta)<textarea id="a_me" style="min-height:80px">${E(A.mapsEmbed || '')}</textarea></label></div>
<button id="a_sv" style="width:100%">Simpan Tentang & lokasi</button>`;
    const lines2 = t => t.split('\n').map(x => x.trim()).filter(Boolean);
    const sync = () => { A.intro = $('#a_intro').value.split(/\n\s*\n/).map(x => x.replace(/\n/g, ' ').trim()).filter(Boolean); A.services = lines2($('#a_services').value); A.hours = lines2($('#a_hours').value); A.mapsQuery = $('#a_mq').value.trim(); A.mapsEmbed = $('#a_me').value.trim();
      v.querySelectorAll('[data-pi]').forEach(i => A.photos[i.dataset.pi].alt = i.value); v.querySelectorAll('[data-hi]').forEach(i => A.history[i.dataset.hi][i.dataset.hf] = i.value); };
    const mv = (arr, i, d) => { const j = i + d; if (j >= 0 && j < arr.length) { [arr[i], arr[j]] = [arr[j], arr[i]]; } };
    $('#a_up').onclick = () => { sync(); pickUp(true, ps => { ps.forEach(p => A.photos.push({ src: p, alt: 'Showroom ' + (S.d.site.dealer || 'dealer XPeng') })); draw(); }); };
    v.querySelectorAll('[data-px]').forEach(b => b.onclick = () => { sync(); A.photos.splice(+b.dataset.px, 1); draw(); });
    v.querySelectorAll('[data-pu]').forEach(b => b.onclick = () => { sync(); mv(A.photos, +b.dataset.pu, -1); draw(); });
    v.querySelectorAll('[data-pd]').forEach(b => b.onclick = () => { sync(); mv(A.photos, +b.dataset.pd, 1); draw(); });
    $('#a_hadd').onclick = () => { sync(); A.history.push({ year: '', title: '', text: '' }); draw(); };
    v.querySelectorAll('[data-hx]').forEach(b => b.onclick = () => { sync(); A.history.splice(+b.dataset.hx, 1); draw(); });
    v.querySelectorAll('[data-hu]').forEach(b => b.onclick = () => { sync(); mv(A.history, +b.dataset.hu, -1); draw(); });
    v.querySelectorAll('[data-hd]').forEach(b => b.onclick = () => { sync(); mv(A.history, +b.dataset.hd, 1); draw(); });
    $('#a_sv').onclick = async () => { sync(); A.history = A.history.filter(h => (h.year || h.title || h.text)); await save('about', 'Update halaman Tentang'); };
  };
  draw();
};

/* --- Pricelist --- */
VIEWS.prices = v => {
  v.innerHTML = `<h2>Pricelist</h2><div class="card"><label>Periode update (tampil di website)<input id="pu" value="${E(S.d.site.pricelistUpdate || '')}"></label>${S.d.models.map((m, mi) => `<h3>${E(m.name)}</h3>${m.variants.map((x, vi) => `<label>${E(x.name)}<input data-m="${mi}" data-v="${vi}" inputmode="numeric" value="${x.price}"></label>`).join('')}`).join('')}<button id="sv">Simpan pricelist</button><p class="muted">Isi angka tanpa titik, contoh 679000000.</p></div>`;
  $('#sv').onclick = async () => { v.querySelectorAll('[data-m]').forEach(i => S.d.models[i.dataset.m].variants[i.dataset.v].price = parseInt(i.value.replace(/\D/g, '')) || 0); S.d.site.pricelistUpdate = $('#pu').value; await save('models', 'Update pricelist'); await save('site', 'Periode pricelist'); };
};

/* --- Keyword & ranking --- */
VIEWS.keywords = v => {
  const K = S.d.keywords; const trend = k => { const h = k.history || []; if (h.length < 2) return ''; const d = h[h.length - 2].pos - h[h.length - 1].pos; return d > 0 ? ' ▲' + d : d < 0 ? ' ▼' + -d : ' ='; };
  v.innerHTML = `<h2>Keyword & ranking</h2><div class="card"><p class="muted">Ranking asli Google hanya bisa dilihat dari <b>Google Search Console</b> (gratis). Salin posisi rata-rata ke kolom Posisi di bawah, lalu tren tercatat otomatis.</p><a class="btn s" style="background:#262b34;color:#fff" target="_blank" rel="noopener" href="https://search.google.com/search-console">Buka Search Console</a></div>
<div class="card tw"><table><thead><tr><th>Keyword</th><th>Tier</th><th>Halaman</th><th>Posisi</th><th></th></tr></thead><tbody>${K.map((k, i) => `<tr><td><input data-i="${i}" data-f="kw" value="${E(k.kw)}"></td><td><select data-i="${i}" data-f="tier">${['hard', 'medium', 'low'].map(t => `<option${k.tier === t ? ' selected' : ''}>${t}</option>`).join('')}</select></td><td><input data-i="${i}" data-f="page" value="${E(k.page)}"></td><td><input style="width:70px" inputmode="decimal" data-i="${i}" data-f="position" value="${k.position == null ? '' : k.position}"><div class="muted">${trend(k)}</div></td><td><button class="d sm" data-x="${i}">✕</button></td></tr>`).join('')}</tbody></table></div>
<div class="row"><button class="s" id="add">+ Keyword</button><button id="sv">Simpan</button></div>
<div class="card"><h3>Panduan prioritas</h3><p class="muted"><b>Hard</b>: volume besar, saingan berat (target jangka panjang, butuh banyak artikel pendukung + backlink). <b>Medium</b>: halaman model dan harga. <b>Low</b>: pertanyaan spesifik, cepat naik, kerjakan duluan untuk membangun otoritas.</p></div>`;
  $('#add').onclick = () => { K.push({ kw: 'keyword baru', tier: 'low', page: '/', position: null }); VIEWS.keywords(v); };
  v.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { K.splice(+b.dataset.x, 1); VIEWS.keywords(v); });
  $('#sv').onclick = async () => { v.querySelectorAll('[data-f]').forEach(i => { const k = K[i.dataset.i], f = i.dataset.f; if (f === 'position') { const p = i.value === '' ? null : parseFloat(i.value); if (p !== k.position && p != null) (k.history = k.history || []).push({ date: today(), pos: p }); k.position = p; } else k[f] = i.value; }); await save('keywords', 'Update keyword'); };
};


/* --- Export Laporan: sudah / belum publish --- */
let LF = 'all';
VIEWS.laporan = async v => {
  const A = S.d.articles, base = (S.d.site.baseUrl || '').replace(/\/$/, '');
  const grp = { published: [], scheduled: [], ready: [], draft: [] }; A.forEach(a => (grp[a.status] || grp.draft).push(a));
  const unp = A.filter(a => a.status !== 'published'), pub = grp.published;
  const rows = (LF === 'pub' ? pub : LF === 'unp' ? unp : A).map(a => ({ a, r: SEO.scoreArticle(a, A) }));
  let nt = null; try { nt = JSON.parse(unb64((await getFile('data/notified.json')).content)); } catch (e) {}
  const st = a => (ST[a.status] || [a.status])[0], when = a => a.status === 'scheduled' && a.publishAt ? fmtDT(a.publishAt) : (a.status === 'published' ? a.date : '-');
  v.innerHTML = `<h2>Export Laporan</h2><div class="grid"><div class="card"><div class="muted">Sudah publish</div><div class="score A">${pub.length}</div></div><div class="card"><div class="muted">Belum publish</div><div class="score C">${unp.length}</div><div class="muted">${grp.scheduled.length} terjadwal • ${grp.ready.length} siap • ${grp.draft.length} draft</div></div></div>
<div class="fl">${[['all', 'Semua (' + A.length + ')'], ['pub', 'Sudah publish (' + pub.length + ')'], ['unp', 'Belum publish (' + unp.length + ')']].map(f => `<button class="s sm${LF === f[0] ? ' on' : ''}" data-lf="${f[0]}">${f[1]}</button>`).join('')}</div>
<div class="row"><button id="csv">⬇ Export CSV</button><button class="s" id="cpall">Salin ringkasan teks</button></div>
<div class="card"><h3>Telegram dan Google Sheets (otomatis)</h3><p class="muted">Tiap artikel terbit, laporan dikirim ke Telegram dan dicatat di Google Sheets oleh GitHub Actions. ${nt && nt.lastSent ? 'Terakhir terkirim: <b>' + fmtDT(nt.lastSent) + '</b>.' : 'Belum ada kiriman tercatat.'} ${nt && nt.sheetUrl ? `<a href="${E(nt.sheetUrl)}" target="_blank" rel="noopener" style="color:var(--ac)">Buka Google Sheets</a>` : ''}</p><div class="row"><button class="s" id="sendrep">Kirim laporan lengkap sekarang</button></div><p class="muted" style="margin-top:8px">Butuh pengaturan sekali saja (lihat PANDUAN_TELEGRAM_SHEETS.md). Tombol ini menjalankan build, lalu laporan lengkap masuk ke Telegram dan Sheets dalam ±2 menit.</p></div>
<div class="card tw"><table><thead><tr><th>Artikel</th><th>Status</th><th>Skor</th><th></th></tr></thead><tbody>${rows.map(({ a, r }, i) => `<tr><td>${E(a.title)}<div class="muted">${E(a.keyword || '-')} • ${E(when(a))}</div></td><td><span class="pill ${(ST[a.status] || ['', 'warn'])[1]}">${st(a)}</span></td><td>${sc(r.score)}</td><td><button class="sm s" data-cl="${E(a.slug)}">Salin link</button></td></tr>`).join('') || '<tr><td colspan=4>Tidak ada data</td></tr>'}</tbody></table></div>`;
  v.querySelectorAll('[data-lf]').forEach(b => b.onclick = () => { LF = b.dataset.lf; S.pg[S.tab + '#0'] = 1; VIEWS.laporan(v); });
  v.querySelectorAll('[data-cl]').forEach(b => b.onclick = () => copyText(base + '/artikel/' + b.dataset.cl + '/'));
  const csvq = x => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"';
  $('#csv').onclick = () => { const head = ['Judul', 'Keyword', 'Status', 'Tanggal/Jadwal', 'Skor SEO', 'Link']; const lines = [head.map(csvq).join(',')].concat(rows.map(({ a, r }) => [a.title, a.keyword, st(a), when(a), r.score, base + '/artikel/' + a.slug + '/'].map(csvq).join(','))); const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }); const l = document.createElement('a'); l.href = URL.createObjectURL(blob); l.download = 'laporan-artikel-' + today() + (LF === 'pub' ? '-publish' : LF === 'unp' ? '-belum-publish' : '') + '.csv'; document.body.appendChild(l); l.click(); l.remove(); toast('CSV diunduh'); };
  $('#cpall').onclick = () => { const f = (t, a) => a.length ? t + ' (' + a.length + ')\n' + a.map((x, i) => (i + 1) + '. ' + x.title + (x.status === 'scheduled' && x.publishAt ? ' [' + fmtDT(x.publishAt) + ']' : '') + (x.status === 'published' ? '\n   ' + base + '/artikel/' + x.slug + '/' : '')).join('\n') + '\n\n' : ''; copyText('LAPORAN ARTIKEL XPENG ' + today() + '\n\n' + f('SUDAH PUBLISH', pub) + f('TERJADWAL', grp.scheduled) + f('SIAP PUBLISH', grp.ready) + f('DRAFT', grp.draft)); };
  $('#sendrep').onclick = async () => { try { await gh('actions/workflows/build.yml/dispatches', { method: 'POST', body: JSON.stringify({ ref: S.cfg.branch, inputs: { report: 'yes' } }) }); toast('Laporan dijalankan. Cek Telegram dalam ±2 menit.'); } catch (e) { toast('Gagal: ' + e.message + ' (pastikan build.yml terbaru sudah ditempel)', true); } };
};

/* --- Laporan SEO --- */
VIEWS.seo = async v => {
  v.innerHTML = '<h2>Laporan SEO</h2><p class="muted">Memuat…</p>'; const r = await loadReport(); let hist = []; try { hist = JSON.parse(unb64((await getFile('data/seo-history.json')).content)); } catch (e) {}
  if (!r || !r.generated) { v.innerHTML = '<h2>Laporan SEO</h2><div class="card"><p>Belum ada laporan.</p><button id="b">Jalankan build</button></div>'; $('#b').onclick = build; return; }
  const live = S.d.articles.map(a => ({ a, r: SEO.scoreArticle(a, S.d.articles) })).sort((x, y) => y.r.score - x.r.score);
  v.innerHTML = `<h2>Laporan SEO</h2><div class="card"><div class="row"><div>${sc(r.site.total)}<div class="muted">Skor total</div></div><div>${sc(r.site.pageScore)}<div class="muted">Halaman</div></div><div>${sc(r.site.articleScore)}<div class="muted">Artikel</div></div><div>${sc(r.site.techScore)}<div class="muted">Teknis</div></div></div><p class="muted">Dibuat ${new Date(r.generated).toLocaleString('id-ID')}</p><button id="b">Jalankan build & perbarui</button></div>
<div class="card"><h3>Peringkat artikel (skor SEO)</h3><div class="tw"><table><thead><tr><th>#</th><th>Artikel</th><th>Skor</th></tr></thead><tbody>${live.map((x, i) => `<tr><td>${i + 1}</td><td>${E(x.a.title)}<div class="muted">${x.r.words} kata • ${E(x.a.status)}</div><details><summary class="muted">Perbaikan</summary>${checks(x.r.checks.filter(c => !c.pass))}</details></td><td>${sc(x.r.score)}</td></tr>`).join('')}</tbody></table></div></div>
<div class="card"><h3>Cek teknis</h3>${checks(r.tech)}${r.broken.length ? `<p class="pill bad">Link rusak: ${r.broken.map(b => E(b.to)).join(', ')}</p>` : ''}</div>
<div class="card"><h3>Skor tiap halaman</h3><div class="tw"><table><tbody>${r.pages.sort((a, b) => a.score - b.score).map(p => `<tr><td>${E(p.url)}${p.score < 100 ? `<details><summary class="muted">Perbaikan</summary>${checks(p.checks.filter(c => !c.pass))}</details>` : ''}</td><td>${sc(p.score)}</td></tr>`).join('')}</tbody></table></div></div>
<div class="card"><h3>Keyword: on-page & ranking</h3><div class="tw"><table><thead><tr><th>Keyword</th><th>Judul</th><th>H1</th><th>Muncul</th><th>Posisi</th></tr></thead><tbody>${r.keywords.map(k => `<tr><td>${E(k.kw)}<div class="muted">${k.tier}</div></td><td>${k.onpage.inTitle ? '✅' : '❌'}</td><td>${k.onpage.inH1 ? '✅' : '❌'}</td><td>${k.onpage.count}x</td><td>${k.position == null ? '-' : k.position}</td></tr>`).join('')}</tbody></table></div></div>
<div class="card"><h3>Riwayat skor</h3>${hist.length ? hist.slice(-14).map(h => `<div class="row" style="margin-bottom:6px"><span class="muted" style="flex:0 0 84px">${h.date}</span><div class="bar" style="flex:4"><i style="width:${h.total}%"></i></div><b style="flex:0 0 30px">${h.total}</b></div>`).join('') : '<p class="muted">Belum ada riwayat.</p>'}</div>`;
  $('#b').onclick = build;
};


/* ---------- status IndexNow (Bing) ---------- */
async function indexnowBox(el) {
  let m = null; try { m = JSON.parse(unb64((await getFile('data/indexnow-sent.json')).content)); } catch (e) {}
  if (!m) { el.innerHTML = 'Belum aktif. Upload indexnow-setup.zip dan tempel build.yml baru.'; return; }
  const rows = Object.entries(m).sort((x, y) => y[1].localeCompare(x[1])), n = rows.length;
  el.innerHTML = n ? `<div class="row"><div><div class="score A">${n}</div><div class="muted">URL terkirim</div></div><div><b>${new Date(rows[0][1]).toLocaleString('id-ID')}</b><div class="muted">Terakhir dikirim</div></div></div><details style="margin-top:10px"><summary class="muted">5 URL terakhir</summary>${rows.slice(0, 5).map(r => `<div class="muted" style="word-break:break-all">${E(r[0])}</div>`).join('')}</details><div class="row" style="margin-top:12px"><button class="s" id="inr">Kirim ulang semua</button></div><p class="muted" style="margin-top:8px">Terkirim otomatis setelah tiap build. Bila 0, cek langkah IndexNow di tab Actions.</p>` : '<p>Belum ada URL terkirim. Akan terkirim otomatis setelah build berikutnya, jika domain sudah xpengwins.com.</p>';
  const b = el.querySelector('#inr'); if (b) b.onclick = async () => { if (!confirm('Kirim ulang semua URL sitemap ke Bing pada build berikutnya?')) return; try { await putFile('data/indexnow-sent.json', b64('{}'), 'IndexNow: reset daftar kirim'); toast('Daftar direset, menjalankan build…'); build(); } catch (e) { toast(e.message, true); } };
}


/* --- Ranking Google (Search Console otomatis) --- */
VIEWS.ranking = async v => {
  v.innerHTML = '<h2>Ranking Google</h2><p class="muted">Memuat…</p>'; let g = null;
  try { g = JSON.parse(unb64((await getFile('data/gsc.json')).content)); } catch (e) {}
  if (!g) { v.innerHTML = '<h2>Ranking Google</h2><div class="card"><p>Belum ada data. Data ditarik otomatis sekali sehari setelah kunci Search Console (GSC_KEY) dipasang dan situs mulai muncul di Google.</p><button id="b">Jalankan build sekarang</button></div>'; $('#b').onclick = build; return; }
  const by = {}; g.rows.forEach(r => { (by[r.q] = by[r.q] || []).push(r); });
  const L = Object.entries(by).map(([q, a]) => { const impr = a.reduce((s, x) => s + x.impr, 0), clicks = a.reduce((s, x) => s + x.clicks, 0), pos = a.reduce((s, x) => s + x.pos * x.impr, 0) / (impr || 1), top = a.slice().sort((x, y) => y.impr - x.impr)[0]; return { q, impr, clicks, pos: +pos.toFixed(1), p: top.p, pages: a.length }; }).sort((x, y) => y.impr - x.impr);
  const d = (n, p, lowGood) => { const x = +(n - p).toFixed(1); if (!x) return ''; const good = lowGood ? x < 0 : x > 0; return ` (${x > 0 ? '+' : ''}${x}, ${good ? 'membaik' : 'menurun'})`; };
  const t = g.totals, pt = g.prevTotals, badge = p => `<span class="pill ${p <= 10 ? 'ok' : p <= 20 ? 'warn' : 'bad'}" style="font-size:1rem;padding:6px 12px">${p}</span>`;
  const near = L.filter(x => x.pos > 10 && x.pos <= 20), low = L.filter(x => x.impr >= 20 && x.clicks / x.impr < 0.02), dup = L.filter(x => x.pages > 1);
  const blk = (title, a, none) => `<h3>${title}</h3>${a.length ? a.slice(0, 10).map(x => `<div class="chk"><div style="flex:1"><b>${E(x.q)}</b><div class="muted">${E(x.p)} | tayang ${x.impr}, klik ${x.clicks}</div></div>${badge(x.pos)}</div>`).join('') : `<p class="muted">${none}</p>`}`;
  const list = a => a.map(x => `<div class="chk" data-q="${E(x.q.toLowerCase())}"><div style="flex:1"><b>${E(x.q)}</b><div class="muted">${E(x.p)} | tayang ${x.impr}, klik ${x.clicks}</div></div>${badge(x.pos)}</div>`).join('');
  v.innerHTML = `<h2>Ranking Google</h2><div class="card"><p class="muted">Periode ${g.period[0]} s/d ${g.period[1]}, dibanding 28 hari sebelumnya. Data Google tertunda ±3 hari. Diperbarui ${new Date(g.generated).toLocaleString('id-ID')}.</p>
<div class="chk"><b>Klik dari Google: ${t.clicks}${d(t.clicks, pt.clicks)}</b></div><div class="chk"><b>Tayang di hasil pencarian: ${t.impr}${d(t.impr, pt.impr)}</b></div><div class="chk"><div><b>Posisi rata-rata: ${t.pos}${d(t.pos, pt.pos, true)}</b><div class="muted">Makin kecil makin bagus (1 = paling atas).</div></div></div>
${blk('Hampir halaman 1: perkuat halaman ini', near, 'Belum ada. Biasanya muncul setelah situs lebih lama dikenal Google.')}${blk('Sering muncul tapi jarang diklik: perbaiki judul dan deskripsi', low, 'Belum ada.')}${blk('Dua halaman bersaing untuk kata yang sama', dup, 'Tidak ada. Bagus.')}
<h3>Semua kata kunci dan peringkatnya (${L.length})</h3><p class="muted">Posisi 1-10 hijau (halaman 1 Google), 11-20 kuning (halaman 2), di atas 20 merah.</p><input id="gq" placeholder="Cari kata kunci..." style="margin:8px 0"><div id="gl" data-pgl="15">${list(L)}</div></div>`;
  $('#gq').oninput = e => { const q = e.target.value.toLowerCase(); v.querySelectorAll('#gl [data-q]').forEach(r => { if (r.dataset.q.includes(q)) delete r.dataset.hide; else r.dataset.hide = '1'; }); S.pg[S.tab + '#' + [...v.querySelectorAll('table,[data-pgl]')].indexOf($('#gl'))] = 1; enhance(); };
};

/* --- Backlink aman --- */
VIEWS.backlinks = v => {
  const B = S.d.backlinks, sites = (S.d.site.backlinkSites || []);
  const tot = B.length, exact = B.filter(b => b.type === 'exact').length, pe = tot ? Math.round(exact / tot * 100) : 0;
  const base = (S.d.site.baseUrl || '').replace(/\/$/, '');
  v.innerHTML = `<h2>Backlink aman</h2>
<div class="card"><h3>Situs milik Anda</h3>${sites.map(s => `<div class="chk"><i>🌐</i><div>${E(s.name)} <span class="pill ${s.url ? 'ok' : 'warn'}">${E(s.status)}</span><div class="t">${E(s.url || 'domain belum diisi (Pengaturan)')}</div></div></div>`).join('')}</div>
<div class="card"><h3>Aturan aman (hindari penalti Google)</h3><div class="chk"><i>1</i><div>Konten di situs Anda yang menaut ke XPeng harus <b>unik dan relevan</b> (otomotif/EV), bukan salinan.</div></div><div class="chk"><i>2</i><div>Variasikan anchor: 50% nama brand/URL polos, 30% frasa umum, maksimal 20% keyword persis.</div></div><div class="chk"><i>3</i><div>Maksimal 1 link per artikel per situs. Naikkan bertahap: 2-4 link baru per minggu.</div></div><div class="chk"><i>4</i><div>Jangan beli link, jangan tukar link massal, jangan jaringan situs kosong (PBN).</div></div><div class="chk"><i>5</i><div>Tambahkan sumber alami: Google Business Profile, profil sosial, direktori otomotif, YouTube, siaran pers, liputan media.</div></div></div>
<div class="card"><h3>Perencana backlink</h3><div class="grid"><label>Dari situs<select id="bs">${sites.map(s => `<option>${E(s.name)}</option>`).join('')}</select></label><label>Ke halaman<select id="bt"><option value="/">Beranda</option><option value="/pricelist/">Pricelist</option>${S.d.models.map(m => `<option value="/model/${E(m.slug)}/">${E(m.name)}</option>`).join('')}${S.d.articles.filter(a => a.status === 'published').map(a => `<option value="/artikel/${E(a.slug)}/">${E(a.title.slice(0, 40))}</option>`).join('')}</select></label><label>Jenis anchor<select id="ba"><option value="brand">Brand (XPeng Indonesia)</option><option value="url">URL polos</option><option value="generic">Umum (baca selengkapnya)</option><option value="partial">Sebagian keyword</option><option value="exact">Keyword persis</option></select></label></div>
<label>Teks anchor<input id="bx" placeholder="mis. pricelist XPeng terbaru"></label><div class="row"><button id="bg">Buat kode link</button><button class="s" id="bp">Catat rencana</button></div><textarea id="bc" readonly style="min-height:60px"></textarea></div>
<div class="card"><h3>Distribusi anchor (${tot} rencana)</h3><div class="bar"><i style="width:${pe}%;background:${pe > 20 ? '#ff6b6b' : '#2ee6b6'}"></i></div><p class="muted">Keyword persis: ${pe}% ${pe > 20 ? '— terlalu tinggi, ganti sebagian ke brand/umum.' : '— aman.'}</p>
<div class="tw"><table><tbody>${B.map((b, i) => `<tr><td>${E(b.site)} → ${E(b.target)}<div class="muted">${E(b.type)} • "${E(b.anchor)}" • ${E(b.date)}</div></td><td><select data-s="${i}">${['rencana', 'terbit', 'dicek'].map(s => `<option${b.status === s ? ' selected' : ''}>${s}</option>`).join('')}</select></td><td><button class="d sm" data-x="${i}">✕</button></td></tr>`).join('')}</tbody></table></div><button class="s" id="sv">Simpan status</button></div>`;
  const mk = () => { const t = $('#bt').value, ty = $('#ba').value; const url = base + t; const tx = $('#bx').value || (ty === 'url' ? url : 'XPeng Indonesia'); const code = `<a href="${url}" rel="noopener">${tx}</a>`; $('#bc').value = code; return { url, tx, ty }; };
  $('#bg').onclick = mk;
  $('#bp').onclick = async () => { const r = mk(); B.push({ site: $('#bs').value, target: $('#bt').value, anchor: r.tx, type: r.ty, date: today(), status: 'rencana' }); await save('backlinks', 'Rencana backlink'); VIEWS.backlinks(v); };
  v.querySelectorAll('[data-x]').forEach(b => b.onclick = async () => { B.splice(+b.dataset.x, 1); await save('backlinks'); VIEWS.backlinks(v); });
  $('#sv').onclick = async () => { v.querySelectorAll('[data-s]').forEach(s => B[s.dataset.s].status = s.value); await save('backlinks', 'Status backlink'); };
};

/* --- Media & Zip --- */
async function toWebp(file, max = 1600, q = .78) {
  const bmp = await createImageBitmap(file), sc = Math.min(1, max / bmp.width), c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/webp', q)); return blob;
}
const slugName = n => n.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'foto';
VIEWS.media = async v => {
  v.innerHTML = `<h2>Media & upload ke GitHub</h2>
<div class="card"><h3>📦 Upload ZIP ke repo (diekstrak otomatis)</h3><p class="muted">ZIP dikirim ke bagian depan (root) repo, lalu GitHub Actions mengekstraknya ke dalam repo dengan susunan folder yang sama seperti di dalam ZIP, misalnya <b>assets/img/foto.webp</b>. File bernama sama akan ditimpa. Gambar JPG/PNG otomatis dikecilkan ke WebP.</p><input type="file" id="rzf" accept=".zip"><div id="rzp" class="muted" style="margin:8px 0"></div><button id="rzu">Upload ZIP dan ekstrak</button><div id="rzs" class="muted"></div></div>
<div class="card"><h3>⚙️ Proses GitHub Actions (build.yml)</h3><div id="runbox2"></div></div>
<div class="card"><h3>Upload foto (otomatis dikecilkan ke WebP)</h3><input type="file" id="fi" accept="image/*" multiple><label style="margin-top:10px">Lebar maksimal (px)<select id="mx"><option>1200</option><option selected>1600</option><option>1920</option></select></label><button id="up">Upload foto</button><div id="st" class="muted"></div></div>
<div class="card"><h3>ZIP ke folder tertentu (lanjutan)</h3><p class="muted">ZIP akan diekstrak otomatis oleh GitHub (menu Actions), gambar otomatis dikecilkan. Pilihan lokasi di dalam ZIP: <b>assets/img/</b> bila ZIP berisi foto.</p><label>Lokasi tujuan ekstrak<input id="zd" value="assets/img"></label><input type="file" id="zf" accept=".zip"><div class="row" style="margin-top:10px"><button id="zu">Upload ZIP (ekstrak oleh GitHub)</button></div><div id="zs" class="muted"></div></div>
<div class="card"><h3>Upload file apa saja ke repo</h3><label>Folder tujuan<input id="pd" value="assets/files"></label><input type="file" id="pf" multiple><button id="pu" style="margin-top:10px">Upload</button></div>
<div class="card"><h3>Galeri (<span id="cnt">0</span>)</h3><div class="thumbs" id="th" data-pgl="12"></div></div>`;
  const runs = runsWidget($('#runbox2')); let zrep = null;
  $('#rzf').onchange = async () => { const f = $('#rzf').files[0], P = $('#rzp'); zrep = null; P.innerHTML = ''; if (!f) return; try { const names = await zipNames(f); if (!names) { P.textContent = 'ZIP besar: daftar isi tidak bisa ditampilkan, tetap bisa diupload.'; return; } zrep = zipReport(names); P.innerHTML = `<b>${zrep.count} file</b> • folder: ${E(Object.entries(zrep.tops).map(([k, n]) => k + ' (' + n + ')').join(', '))}${zrep.warn.map(w => `<div>${E(w)}</div>`).join('')}`; } catch (e) { P.textContent = e.message; } };
  $('#rzu').onclick = async () => { const f = $('#rzf').files[0]; if (!f) return toast('Pilih file ZIP dulu', true); if (f.size > 70 * 1024 * 1024) return toast('ZIP maksimal ±70MB. Pecah jadi beberapa ZIP.', true);
    if (zrep && zrep.bad) return toast('ZIP tidak aman, dibatalkan', true);
    if (zrep && zrep.warn.some(w => w.startsWith('⚠️')) && !confirm(zrep.warn.filter(w => w.startsWith('⚠️')).join('\n\n') + '\n\nLanjut upload?')) return;
    const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14), name = slugName(f.name) + '-' + stamp + '.zip', btn = $('#rzu'); btn.disabled = true;
    try { $('#rzs').textContent = 'Mengunggah ' + Math.round(f.size / 1024) + ' KB…'; await putFile(name, bufb64(await f.arrayBuffer()), 'Upload ZIP ' + f.name); $('#rzs').textContent = '✓ ZIP terkirim ke root repo. GitHub sedang mengekstrak (±1-2 menit). Pantau di kartu Proses GitHub Actions di atas.'; toast('ZIP terkirim'); setTimeout(runs, 3000); }
    catch (e) { toast(e.message, true); $('#rzs').textContent = 'Gagal: ' + e.message; } btn.disabled = false; };
  const up = $('#up'); up.onclick = async () => { const fs = [...$('#fi').files]; if (!fs.length) return toast('Pilih foto dulu', true); up.disabled = true; let n = 0;
    for (const f of fs) { try { $('#st').textContent = `Proses ${++n}/${fs.length}: ${f.name}`; const blob = await toWebp(f, +$('#mx').value), name = slugName(f.name) + '.webp'; await putFile('assets/img/' + name, bufb64(await blob.arrayBuffer()), 'Upload foto ' + name); $('#st').textContent = `✓ ${name} (${Math.round(blob.size / 1024)}KB dari ${Math.round(f.size / 1024)}KB)`; } catch (e) { toast(f.name + ': ' + e.message, true); } }
    up.disabled = false; S.media = null; VIEWS.media(v); toast('Upload selesai'); };
  $('#zu').onclick = async () => { const f = $('#zf').files[0]; if (!f) return toast('Pilih file ZIP', true); if (f.size > 70 * 1024 * 1024) return toast('ZIP maksimal ±70MB. Pecah jadi beberapa ZIP.', true);
    try { $('#zs').textContent = 'Mengunggah…'; const dest = $('#zd').value.replace(/^\/|\/$/g, ''); await putFile('upload/' + dest.replace(/\//g, '__') + '--' + f.name.replace(/[^\w.-]/g, '_'), bufb64(await f.arrayBuffer()), 'Upload ZIP ' + f.name); $('#zs').textContent = '✓ ZIP terkirim. GitHub Actions akan mengekstrak ke ' + dest + ' dalam ±1-2 menit lalu menghapus ZIP-nya.'; } catch (e) { toast(e.message, true); } };
  $('#pu').onclick = async () => { const d = $('#pd').value.replace(/^\/|\/$/g, ''); for (const f of [...$('#pf').files]) { try { await putFile(d + '/' + f.name.replace(/[^\w.-]/g, '_'), bufb64(await f.arrayBuffer()), 'Upload ' + f.name); toast('✓ ' + f.name); } catch (e) { toast(e.message, true); } } };
  const l = await listDir('assets/img'); const imgs = l.filter(x => x.type === 'file' && /\.(webp|jpe?g|png|svg)$/i.test(x.name)); S.media = imgs.map(x => x.name); $('#cnt').textContent = imgs.length;
  $('#th').innerHTML = imgs.map(x => `<figure><img loading="lazy" src="${E(x.download_url)}" alt=""><figcaption>${E(x.name)} • ${Math.round(x.size / 1024)}KB<br><button class="d sm" data-x="${E(x.path)}">hapus</button></figcaption></figure>`).join('');
  v.querySelectorAll('[data-x]').forEach(b => b.onclick = async () => { if (confirm('Hapus ' + b.dataset.x + '?')) { try { await delFile(b.dataset.x); VIEWS.media(v); } catch (e) { toast(e.message, true); } } });
};

/* --- Backup --- */
VIEWS.backup = async v => {
  v.innerHTML = `<h2>Backup data</h2><div class="card"><p class="muted">Backup otomatis berjalan tiap malam di GitHub (folder backup/). Anda juga bisa membuat dan memulihkan secara manual di sini.</p><div class="row"><button id="dl">Unduh backup (JSON)</button><button class="s" id="gh">Simpan salinan ke GitHub</button></div></div>
<div class="card"><h3>Pulihkan dari file backup</h3><input type="file" id="rf" accept=".json"><button class="d" id="rs" style="margin-top:10px">Pulihkan</button><p class="muted">Menimpa semua data (model, artikel, keyword, pengaturan).</p></div><div class="card"><h3>Salinan di GitHub</h3><div id="bl" class="muted">Memuat…</div></div>`;
  const bundle = () => JSON.stringify({ app: 'xpeng-site', date: new Date().toISOString(), data: S.d }, null, 1);
  $('#dl').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bundle()], { type: 'application/json' })); a.download = 'backup-xpeng-' + today() + '.json'; a.click(); };
  $('#gh').onclick = async () => { try { await putFile('backup/manual-' + today() + '.json', b64(bundle()), 'Backup manual ' + today()); toast('Backup tersimpan di GitHub'); VIEWS.backup(v); } catch (e) { toast(e.message, true); } };
  $('#rs').onclick = async () => { const f = $('#rf').files[0]; if (!f) return toast('Pilih file', true); if (!confirm('Timpa semua data dengan file ini?')) return; try { const j = JSON.parse(await f.text()); if (j.app !== 'xpeng-site') throw new Error('Bukan file backup XPeng'); for (const n of NAMES) if (j.data[n] !== undefined) { S.d[n] = j.data[n]; await save(n, 'Pulihkan backup'); } toast('Data dipulihkan'); } catch (e) { toast(e.message, true); } };
  const l = await listDir('backup'); $('#bl').innerHTML = l.filter(x => x.type === 'file').reverse().slice(0, 15).map(x => `<div class="chk"><i>💾</i><div>${E(x.name)}<div class="t">${Math.round(x.size / 1024)}KB</div></div></div>`).join('') || 'Belum ada.';
};

/* --- Pengaturan --- */
VIEWS.settings = v => {
  const s = S.d.site; const F = [['name', 'Nama website'], ['dealer', 'Nama dealer'], ['whatsapp', 'WhatsApp (format 62812...)'], ['phone', 'Telepon tampil'], ['address', 'Alamat showroom'], ['email', 'Email'], ['baseUrl', 'URL website (https://...)'], ['tagline', 'Tagline'], ['description', 'Deskripsi website (120-160 karakter)'], ['instagram', 'URL Instagram'], ['tiktok', 'URL TikTok'], ['youtube', 'URL YouTube'], ['facebook', 'URL Facebook']];
  v.innerHTML = `<h2>Pengaturan</h2><div class="card">${F.map(f => `<label>${f[1]}<input data-k="${f[0]}" value="${E(s[f[0]] || '')}"></label>`).join('')}<h3>Situs backlink milik Anda (Nama|URL|status, per baris)</h3><textarea id="bls">${E((s.backlinkSites || []).map(x => [x.name, x.url, x.status].join('|')).join('\n'))}</textarea><button id="sv" style="margin-top:12px">Simpan pengaturan</button></div>`;
  $('#sv').onclick = async () => { v.querySelectorAll('[data-k]').forEach(i => s[i.dataset.k] = i.value.trim()); s.whatsapp = s.whatsapp.replace(/\D/g, ''); s.backlinkSites = lines($('#bls').value).map(l => { const p = l.split('|'); return { name: p[0], url: p[1] || '', status: p[2] || 'aktif' }; }); s.github = { owner: S.cfg.owner, repo: S.cfg.repo, branch: S.cfg.branch }; await save('site', 'Pengaturan'); };
};

/* --- Sosmed: posting otomatis dan manual ke Facebook, Instagram, Threads, Telegram --- */
const SOC = { facebook: ['Facebook', '📘'], instagram: ['Instagram', '📸'], threads: ['Threads', '🧵'], telegram: ['Telegram', '✈️'] };
async function rj(n, d) { try { const j = await getFile('data/' + n + '.json'); return JSON.parse(unb64(j.content)); } catch (e) { return d; } }
VIEWS.social = async v => {
  v.innerHTML = '<h2>Sosmed</h2><p class="muted">Memuat…</p>';
  const [c0, posted, log, status, queue] = await Promise.all([rj('social', {}), rj('social-posted', {}), rj('social-log', []), rj('social-status', {}), rj('social-queue', [])]);
  const cfg = { auto: false, maxAgeDays: 3, maxPerRun: 2, hashtags: '#XPeng #MobilListrik #XPengIndonesia', ...c0 }; cfg.platforms = { facebook: true, instagram: true, threads: true, ...(c0.platforms || {}) };
  const ready = status.ready || null, ttl = s => { const a = (S.d.articles || []).find(x => x.slug === s); return a ? a.title : s; };
  const pub = (S.d.articles || []).filter(a => a.status === 'published').sort((x, y) => (x.date < y.date ? 1 : -1));
  const guide = 'https://github.com/' + S.cfg.owner + '/' + S.cfg.repo + '/blob/' + S.cfg.branch + '/docs/panduan-posting-sosmed.md';
  const cb = (id, label, on, extra) => `<label style="display:flex;gap:8px;align-items:center;margin:0 0 6px;color:var(--tx)"><input type="checkbox" ${id} ${on ? 'checked' : ''} style="width:20px;min-height:20px;flex:none">${label}${extra || ''}</label>`;
  const row = a => { const r = posted[a.slug] || {}; return `<div class="chk" style="align-items:center"><div style="flex:1"><b style="font-weight:500">${E(a.title)}</b><div class="t">${Object.keys(SOC).map(p => r[p] ? `<span class="pill ok" title="${E(fmtDT(r[p].at))}">${SOC[p][1]} ✓</span>` : `<span class="pill">${SOC[p][1]} –</span>`).join(' ')}</div></div><button class="sm" data-post="${E(a.slug)}">📣 Posting</button></div>`; };
  let lim = 10;
  const draw = () => {
    v.innerHTML = `<h2>Sosmed</h2>
<div class="card"><h3>Status koneksi</h3>${ready ? Object.keys(SOC).map(p => `<div class="chk"><i>${SOC[p][1]}</i><div>${SOC[p][0]} <span class="pill ${ready[p] ? 'ok' : 'warn'}">${ready[p] ? 'Terhubung' : 'Belum diisi'}</span>${ready[p] ? '' : '<div class="t">Token belum dipasang di GitHub Secrets.</div>'}</div></div>`).join('') : '<p class="muted">Belum dicek. Jalankan workflow sekali (tombol di bawah) lalu buka halaman ini lagi.</p>'}
<p class="muted" style="margin-top:10px">Telegram: pengumuman artikel baru sudah otomatis lewat laporan. Tombol di bawah hanya untuk kirim ulang.</p><a class="btn s sm" href="${E(guide)}" target="_blank" rel="noopener" style="margin-top:6px">📖 Panduan memasang token</a></div>
<div class="card"><h3>Posting otomatis</h3><label>Saat artikel baru terbit<select id="sc-auto"><option value="0"${cfg.auto ? '' : ' selected'}>Mati (hanya manual)</option><option value="1"${cfg.auto ? ' selected' : ''}>Aktif (posting otomatis)</option></select></label>
${['facebook', 'instagram', 'threads'].map(p => cb('data-ap="' + p + '"', SOC[p][1] + ' ' + SOC[p][0], cfg.platforms[p])).join('')}
<div class="grid" style="margin-top:10px"><label>Hanya artikel terbit dalam (hari)<input id="sc-age" type="number" min="1" max="14" value="${cfg.maxAgeDays}"></label><label>Maks. artikel per jam<input id="sc-max" type="number" min="1" max="5" value="${cfg.maxPerRun}"></label></div>
<label>Hashtag<input id="sc-tags" value="${E(cfg.hashtags)}"></label><button id="sc-save">Simpan pengaturan</button><p class="muted" style="margin-top:8px">Platform yang tokennya belum diisi dilewati otomatis. Artikel lama tidak ikut diposting (hanya yang terbit dalam batas hari di atas).</p></div>
<div class="card"><h3>Posting manual</h3><p class="muted">Pilih platform, lalu ketuk Posting pada artikel. Hasil muncul di Riwayat ±3–8 menit.</p>
<div style="margin:8px 0 12px">${Object.keys(SOC).map(p => cb('data-p="' + p + '"', SOC[p][1] + ' ' + SOC[p][0], p !== 'telegram')).join('')}</div>
${queue.length ? `<p class="pill warn">Antrean: ${queue.length} artikel menunggu workflow</p>` : ''}
${pub.slice(0, lim).map(row).join('') || '<p class="muted">Belum ada artikel terbit.</p>'}${pub.length > lim ? '<button class="s" id="more" style="width:100%;margin-top:10px">Tampilkan lebih banyak</button>' : ''}</div>
<div class="card"><h3>Proses workflow</h3><div id="runbox"></div></div>
<div class="card"><h3>Riwayat posting</h3>${log.length ? log.slice(0, 15).map(l => `<div class="chk"><i>${l.ok ? '✅' : '❌'}</i><div>${E((SOC[l.platform] || [l.platform])[0])} • ${E(ttl(l.slug))}<div class="t">${E(fmtDT(l.at))}${l.msg ? ' • ' + E(l.msg) : ''}</div></div></div>`).join('') : '<p class="muted">Belum ada riwayat.</p>'}</div>`;
    runsWidget($('#runbox'));
    $('#sc-save').onclick = async () => {
      const c = { auto: $('#sc-auto').value === '1', platforms: {}, maxAgeDays: Math.max(1, Math.min(14, +$('#sc-age').value || 3)), maxPerRun: Math.max(1, Math.min(5, +$('#sc-max').value || 2)), hashtags: $('#sc-tags').value.trim() };
      v.querySelectorAll('[data-ap]').forEach(i => c.platforms[i.dataset.ap] = i.checked);
      try { await putFile('data/social.json', b64(JSON.stringify(c, null, 1)), 'Pengaturan sosmed via admin'); Object.assign(cfg, c); toast('Pengaturan tersimpan.'); } catch (e) { toast('Gagal simpan: ' + e.message, true); }
    };
    if ($('#more')) $('#more').onclick = () => { lim += 10; draw(); };
    v.querySelectorAll('[data-post]').forEach(b => b.onclick = async () => {
      const slug = b.dataset.post, plats = [...v.querySelectorAll('[data-p]:checked')].map(i => i.dataset.p);
      if (!plats.length) return toast('Pilih minimal satu platform.', true);
      const done = plats.filter(p => posted[slug] && posted[slug][p]);
      if (done.length && !confirm('Sudah pernah diposting ke ' + done.map(p => SOC[p][0]).join(', ') + '. Posting ulang?')) return;
      b.disabled = true;
      try {
        const q = await rj('social-queue', []); q.push({ slug, platforms: plats, force: done.length > 0, at: new Date().toISOString() });
        await putFile('data/social-queue.json', b64(JSON.stringify(q, null, 1)), 'Antrean posting sosmed: ' + slug);
        toast('Masuk antrean. Workflow berjalan otomatis, cek Riwayat ±3–8 menit.'); queue.push({ slug }); draw(); return;
      } catch (e) { toast('Gagal: ' + e.message + ' (token perlu izin Contents: Read and write)', true); }
      b.disabled = false;
    });
  };
  draw();
};

boot();
})();
