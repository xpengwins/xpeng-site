/* Penyusun halaman (FILE BARU): edit teks/foto + atur urutan dan tampil/sembunyi bagian halaman.
   Dipakai build.js. Kalau data/pages.json kosong, HTML halaman TIDAK diubah sama sekali.
   Cara kerja: HTML halaman dipecah jadi bagian (<section> tingkat atas). Tiap bagian punya kunci tetap.
   Aturan dari admin (data/pages.json) diterapkan: urutan, sembunyi, ganti teks, ganti foto.
   Daftar bagian + teks + foto ditulis ke data/page-index.json supaya admin bisa menampilkannya. */

const VOID = new Set(['br', 'img', 'input', 'hr', 'meta', 'link', 'source', 'wbr']);
const dec = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
const slug = s => dec(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const attr = (tag, n) => { const m = tag.match(new RegExp('\\s' + n + '\\s*=\\s*"([^"]*)"', 'i')); return m ? m[1] : null; };
const SKIP_PARENT = new Set(['table', 'thead', 'tbody', 'tr', 'th', 'td', 'select', 'option', 'textarea']);
const DYNAMIC_TAGS = new Set(['b', 'strong', 'span', 'small', 'div', 'output', 'em', 'p']);

function tokenize(html) {
  const re = /<!--[\s\S]*?-->|<(script|style|svg|noscript)\b[\s\S]*?<\/\1\s*>|<\/?[a-zA-Z][^>]*>|[^<]+|</g, out = []; let m;
  while ((m = re.exec(html))) {
    const s = m[0];
    if (s.startsWith('<!--') || m[1]) out.push({ k: 'raw', s });
    else if (s[0] === '<' && s.length > 1) out.push({ k: 'tag', s });
    else out.push({ k: 'text', s });
  }
  return out;
}

/* pecah jadi blok tingkat atas: section (termasuk bersarang) atau blok lain */
function split(html) {
  const toks = tokenize(html), blocks = []; let cur = null, other = '', depth = 0;
  const flushOther = () => { if (other.trim()) blocks.push({ type: 'other', s: other }); other = ''; };
  for (const t of toks) {
    const isOpen = t.k === 'tag' && /^<section\b/i.test(t.s), isClose = t.k === 'tag' && /^<\/section\s*>/i.test(t.s);
    if (depth === 0) {
      if (isOpen) { flushOther(); cur = { type: 'section', s: t.s }; depth = 1; } else other += t.s;
      continue;
    }
    cur.s += t.s;
    if (isOpen) depth++; else if (isClose && --depth === 0) { blocks.push(cur); cur = null; }
  }
  if (cur) blocks.push(cur);   /* section tidak tertutup: tetap dipertahankan */
  flushOther();
  return blocks;
}

/* analisis satu blok: kunci, judul, teks yang bisa diedit, foto */
function analyse(block) {
  const toks = tokenize(block.s), stack = [], texts = [], imgs = []; let firstHeading = '', eyebrow = '', hasH1 = false, openTag = '';
  for (const t of toks) {
    if (t.k === 'tag') {
      const name = (t.s.match(/^<\/?([a-zA-Z0-9]+)/) || [])[1].toLowerCase();
      if (t.s[1] === '/') { const i = stack.map(x => x.n).lastIndexOf(name); if (i >= 0) stack.length = i; continue; }
      if (!openTag) openTag = t.s;
      if (name === 'h1') hasH1 = true;
      if (name === 'img' && !attr(t.s, 'id')) imgs.push({ src: dec(attr(t.s, 'src') || ''), alt: dec(attr(t.s, 'alt') || '') });   /* foto ber-id diatur JavaScript, tidak diedit */
      if (!VOID.has(name) && !/\/>$/.test(t.s)) stack.push({ n: name, id: attr(t.s, 'id'), cls: attr(t.s, 'class') || '' });
      continue;
    }
    if (t.k !== 'text') continue;
    const core = t.s.trim(); if (core.length < 2 || !/[A-Za-z0-9]/.test(core)) continue;
    const par = stack[stack.length - 1] || {};
    if (stack.some(x => SKIP_PARENT.has(x.n))) continue;
    if (par.id && DYNAMIC_TAGS.has(par.n)) continue;
    if (/\bRp\s?\d/.test(core)) continue;
    const text = dec(core);
    if (!firstHeading && /^h[12]$/.test(par.n)) firstHeading = text;
    if (!eyebrow && /\beyebrow\b/.test(par.cls)) eyebrow = text;
    texts.push({ raw: core, text, tag: par.n || '' });
  }
  const id = openTag ? attr(openTag, 'id') : null;
  return { id, firstHeading, eyebrow, hasH1, texts, imgs };
}

function process(pagePath, html, cfg, opt) {
  cfg = cfg || {}; opt = opt || {};
  const esc = opt.esc || (s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
  const U = opt.u || (p => p);
  const blocks = split(html), used = new Set();
  const secs = blocks.map((b, i) => {
    const a = analyse(b); let key = a.id || (a.firstHeading && slug(a.firstHeading)) || (a.eyebrow && slug(a.eyebrow)) || (b.type === 'other' ? 'blok-' + (i + 1) : 'bagian-' + (i + 1));
    if (!key) key = 'bagian-' + (i + 1);
    let k = key, n = 2; while (used.has(k)) k = key + '-' + n++; used.add(k);
    const seen = new Set(), texts = a.texts.filter(x => !seen.has(x.text) && seen.add(x.text));
    return { key: k, block: b, a, texts };
  });
  const sections = secs.map(s => ({ key: s.key, title: s.a.firstHeading || s.a.eyebrow || s.texts.slice(0, 3).map(x => x.text).join(' · ').slice(0, 60) || s.key, hasH1: s.a.hasH1, texts: s.texts.map(x => ({ t: x.text, tag: x.tag })), imgs: s.a.imgs.map(x => ({ src: x.src, alt: x.alt })) }));

  const order = Array.isArray(cfg.order) ? cfg.order : [], hidden = new Set(Array.isArray(cfg.hidden) ? cfg.hidden : []);
  const hasText = cfg.text && Object.keys(cfg.text).length, hasImg = cfg.img && Object.keys(cfg.img).length;
  if (!order.length && !hidden.size && !hasText && !hasImg) return { html, sections };

  const byKey = new Map(secs.map(s => [s.key, s]));
  const seq = []; order.forEach(k => { if (byKey.has(k) && !seq.includes(k)) seq.push(k); });
  secs.forEach(s => { if (!seq.includes(s.key)) seq.push(s.key); });
  const parts = seq.map(k => {
    const s = byKey.get(k);
    if (hidden.has(k) && !s.a.hasH1) return '';          /* bagian dengan judul utama (H1) tidak boleh disembunyikan */
    let h = s.block.s;
    const tx = cfg.text && cfg.text[k], im = cfg.img && cfg.img[k];
    if (tx || im) {
      let imgN = -1;
      h = tokenize(h).map(t => {
        if (t.k === 'text' && tx) {
          const core = t.s.trim(); if (!core) return t.s;
          const v = tx[dec(core)];
          if (typeof v === 'string' && v.trim()) return t.s.replace(core, () => esc(v.trim()));
        }
        if (t.k === 'tag' && im && /^<img\b/i.test(t.s)) {
          if (attr(t.s, 'id')) return t.s;
          imgN++; const o = im[String(imgN)];
          if (o && typeof o === 'object') {
            let tag = t.s;
            if (o.src && /^[A-Za-z0-9_\-./]+$/.test(o.src)) tag = tag.replace(/(\ssrc\s*=\s*)"[^"]*"/i, (m, p) => p + '"' + esc(U(o.src.replace(/^\//, ''))) + '"');
            if (typeof o.alt === 'string' && o.alt.trim()) tag = tag.replace(/(\salt\s*=\s*)"[^"]*"/i, (m, p) => p + '"' + esc(o.alt.trim()) + '"');
            return tag;
          }
        }
        return t.s;
      }).join('');
    }
    return h;
  });
  return { html: parts.filter(Boolean).join('\n'), sections };
}

module.exports = { process, split, analyse, tokenize, dec };
