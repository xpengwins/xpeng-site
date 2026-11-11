/* Terjemahan Inggris untuk halaman utama (Home, Model, Pricelist, Promo, Kontak, Tentang) -> /en/...
   Cara kerja: halaman Indonesia dibuat seperti biasa, lalu teksnya diganti memakai kamus data/i18n-en.json
   (kunci = teks Indonesia persis, nilai = teks Inggris). Teks yang belum ada di kamus tetap Indonesia dan
   dicatat di data/i18n-en-missing.json supaya mudah dilengkapi. Artikel tidak ikut diterjemahkan. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8')); } catch (e) { return d; } };
const DICT = rd('i18n-en.json', {}), TXT = DICT.text || {}, JSD = DICT.js || {};
const MONTH = { Januari: 'January', Februari: 'February', Maret: 'March', April: 'April', Mei: 'May', Juni: 'June', Juli: 'July', Agustus: 'August', September: 'September', Oktober: 'October', November: 'November', Desember: 'December' };
const ent = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&nbsp;': ' ', '&middot;': '·', '&times;': '×', '&rsquo;': '’', '&lsquo;': '‘', '&hellip;': '…' };
const dec = s => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, m => ent[m] || (/^&#x/i.test(m) ? String.fromCodePoint(parseInt(m.slice(3, -1), 16)) : /^&#/.test(m) ? String.fromCodePoint(parseInt(m.slice(2, -1), 10)) : m));
const enc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const encA = s => enc(s).replace(/"/g, '&quot;');
const norm = s => dec(s).replace(/\s+/g, ' ').trim();
const missing = new Map();
const hasLetters = s => /[A-Za-z]{3,}/.test(s);

/* aturan angka dan tanggal yang berlaku di semua halaman */
function rules(s) {
  s = s.replace(/Rp\s?(\d{1,3}(?:\.\d{3})+)/g, (m, n) => 'IDR ' + n.replace(/\./g, ','));
  s = s.replace(/Rp\s?(\d+(?:,\d+)?)\s*(juta|miliar|jt|M)\b/g, (m, n, w) => 'IDR ' + n.replace(',', '.') + ' ' + ({ juta: 'million', jt: 'million', miliar: 'billion', M: 'billion' })[w]);
  s = s.replace(new RegExp('\\b(\\d{1,2}) (' + Object.keys(MONTH).join('|') + ') (\\d{4})\\b', 'g'), (m, d, mo, y) => mo === 'Mei' && false ? m : d + ' ' + MONTH[mo] + ' ' + y);
  s = s.replace(new RegExp('\\b(' + Object.keys(MONTH).join('|') + ') (\\d{4})\\b', 'g'), (m, mo, y) => MONTH[mo] + ' ' + y);
  return s;
}
function tr(raw, where) {
  const k = norm(raw);
  if (!k) return null;
  if (!hasLetters(k)) { const r = rules(k); return r !== k ? r : null; }
  let v = TXT[k];
  if (v == null) {
    /* kalimat dengan harga: kunci kamus memakai {P1}, {P2} sebagai pengganti angka Rp */
    const ps = []; const k2 = k.replace(/Rp\s?\d[\d.,]*(?:\s?(?:juta|miliar))?/g, m => { ps.push(m); return '{P' + ps.length + '}'; });
    if (ps.length && TXT[k2] != null) return rules(TXT[k2].replace(/\{P(\d)\}/g, (m, i) => ps[i - 1] || m));
    if (k.length <= 45) { const r = rules(k); if (r !== k) return r; }
    if (!/^[A-Z0-9 .+\-\/&'’]+$/.test(k)) missing.set(k, (missing.get(k) || 0) + 1);
    return null;
  }
  return rules(v);
}
const ATTR = /\b(alt|title|aria-label|placeholder|content|data-salam|data-ph|data-t)="([^"]*)"/g;

function walkLd(v, urlMap) {
  if (typeof v === 'string') { if (urlMap[v]) return urlMap[v]; const t = TXT[norm(v)]; return t != null ? t : v; }
  if (Array.isArray(v)) return v.map(x => walkLd(x, urlMap));
  if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = (k === '@type' || k === '@context') ? v[k] : walkLd(v[k], urlMap); return o; }
  return v;
}

/* html: halaman Indonesia. opts: { canonical, urlMap, rewrite(href), jsFile } */
function toEn(html, opts) {
  const keep = [];
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/g, m => {
    let out = m;
    if (/type="application\/ld\+json"/.test(m)) {
      try { const j = JSON.parse(m.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '').replace(/\\u003c/g, '<')); out = '<script type="application/ld+json">' + JSON.stringify(walkLd(j, opts.urlMap || {})).replace(/</g, '\\u003c') + '</script>'; } catch (e) { /* biarkan */ }
    }
    keep.push(out); return '\u0000' + (keep.length - 1) + '\u0000';
  });
  html = html.replace(ATTR, (m, a, v) => {
    if (a === 'content' && /^(width=|#|index|noindex|summary|website|article|product|id_ID|en_US)/.test(v)) return m;
    if (/^(https?:|\/|#|mailto:|tel:)/.test(v)) return m;
    const t = tr(v); return t == null ? m : a + '="' + encA(t) + '"';
  });
  html = html.replace(/<title>([^<]*)<\/title>/, (m, t) => { const x = tr(t); keep.push('<title>' + (x == null ? t : enc(x)) + '</title>'); return '\u0000' + (keep.length - 1) + '\u0000'; });
  html = html.replace(/>([^<>\u0000]+)</g, (m, t) => {
    const x = tr(t); if (x == null) return m;
    const lead = (t.match(/^\s*/) || [''])[0], trail = (t.match(/\s*$/) || [''])[0];
    return '>' + lead + enc(x) + trail + '<';
  });
  html = html.replace(/\u0000(\d+)\u0000/g, (m, i) => keep[+i]);
  return html;
}
/* teks yang dibuat JavaScript (obrolan, simulasi cicilan, pratinjau foto): salin app.js dengan literal diganti */
function jsEn(src) {
  let miss = [];
  Object.keys(JSD).sort((a, b) => b.length - a.length).forEach(k => { if (src.indexOf(k) < 0) { miss.push(k); return; } src = src.split(k).join(JSD[k]); });
  return { src, miss };
}
function saveMissing() {
  const arr = [...missing.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => k);
  const f = path.join(ROOT, 'data', 'i18n-en-missing.json'), s = JSON.stringify(arr, null, 1);
  let old = ''; try { old = fs.readFileSync(f, 'utf8'); } catch (e) {}
  if (old !== s) fs.writeFileSync(f, s);
  return arr.length;
}
module.exports = { toEn, jsEn, saveMissing, encA, enc, dec };
