#!/usr/bin/env node
/* Generator situs statis XPeng: data/*.json -> halaman HTML + sitemap + robots + llms.txt + laporan SEO */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const MD = require('../shared/md.js'), SEO = require('../shared/seo.js');
const J = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));
const site = J('site.json'), models = J('models.json'), keywords = J('keywords.json');
const JO = (f, d) => { try { return J(f); } catch (e) { return d; } };
/* penyusun halaman: aturan dari admin (data/pages.json); kosong = halaman tidak berubah */
const PL = require('./pages-layout.js'), PAGES_CFG = JO('pages.json', {}) || {}, PAGE_INDEX = {};
const EDITABLE = p => p === '/' || /^\/(model|pricelist|kontak|tentang)\//.test(p);
/* jadwal publish: artikel berstatus 'scheduled' yang waktunya sudah lewat otomatis menjadi 'published' */
const rawArticles = J('articles.json'); let flipped = false;
rawArticles.forEach(a => { if (a.status === 'scheduled' && a.publishAt && Date.parse(a.publishAt) <= Date.now()) { a.status = 'published'; a.date = a.publishAt.slice(0, 10); delete a.publishAt; flipped = true; console.log('Terbit sesuai jadwal:', a.title); } });
if (flipped) fs.writeFileSync(path.join(ROOT, 'data', 'articles.json'), JSON.stringify(rawArticles, null, 1));
const articles = rawArticles.filter(a => a.status === 'published').sort((a, b) => b.date.localeCompare(a.date));
const allArticles = rawArticles;
const leasing = JO('leasing.json', []).filter(x => x && x.name);
const about = Object.assign({ intro: [], photos: [], history: [], services: [], hours: [], mapsQuery: '', mapsEmbed: '' }, JO('about.json', {}));
const E = MD.esc, rp = n => 'Rp' + Number(n).toLocaleString('id-ID');
let BASE = ''; try { BASE = new URL(site.baseUrl).pathname.replace(/\/$/, ''); } catch (e) {}
const ORIGIN = (() => { try { return new URL(site.baseUrl).origin; } catch (e) { return ''; } })();
const u = p => /^(https?:|#|mailto:|tel:|data:)/.test(p) ? p : BASE + (p.startsWith('/') ? p : '/' + p);
const abs = p => ORIGIN + u(p);
/* versi aset: berubah otomatis saat CSS/JS berubah, supaya browser tidak memakai cache lama */
const ASSET_V = (() => { try { const h = require('crypto').createHash('md5'); ['assets/css/style.css', 'assets/js/app.js'].forEach(f => h.update(fs.readFileSync(path.join(ROOT, f)))); return h.digest('hex').slice(0, 8); } catch (e) { return '1'; } })();
const wa = (t) => 'https://wa.me/' + site.whatsapp + '?text=' + encodeURIComponent(t);
const minPrice = Math.min(...models.flatMap(m => m.variants.map(v => v.price)));
/* ---------- ikon, peta, leasing ---------- */
const SV = (d, extra = '') => `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true" focusable="false" ${extra}>${d}</svg>`;
const IC = {
  wa: SV('<path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.1-1.3A10 10 0 1 0 12 2zm0 1.9a8.1 8.1 0 1 1-4.3 15l-.3-.2-3 .8.8-2.9-.2-.3A8.1 8.1 0 0 1 12 3.900zM8.700 7.500c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.400s1 2.700 1.200 2.900c.1.200 2 3.100 4.900 4.300 2.400 1 2.900.8 3.400.7.500-.1 1.700-.7 1.900-1.400.2-.7.2-1.200.2-1.400-.1-.1-.3-.2-.6-.4l-2-.9c-.3-.1-.5-.1-.7.100-.2.300-.8 1-.9 1.100-.2.200-.3.200-.6.100a6.900 6.900 0 0 1-3.400-3c-.3-.5.2-.5.7-1.500.1-.2 0-.4 0-.5l-.9-2.200c-.2-.6-.5-.5-.7-.5z"/>'),
  phone: SV('<path d="M6.6 10.800c1.400 2.800 3.800 5.100 6.600 6.600l2.200-2.200c.3-.3.700-.4 1-.2 1.100.4 2.300.6 3.600.6.600 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.500c.6 0 1 .4 1 1 0 1.300.2 2.500.6 3.600.1.300 0 .700-.3 1z"/>'),
  mail: SV('<path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5z"/>'),
  pin: SV('<path d="M12 2a7 7 0 0 0-7 7c0 5.300 7 13 7 13s7-7.700 7-13a7 7 0 0 0-7-7zm0 9.500a2.500 2.500 0 1 1 0-5 2.500 2.500 0 0 1 0 5z"/>'),
  clock: SV('<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.5-13H11v6l5.200 3.200.8-1.200-4.500-2.700z"/>'),
  instagram: SV('<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.500" cy="6.500" r="1.300"/>'),
  tiktok: SV('<path d="M16 3c.3 2.200 1.700 3.800 4 4v3a7 7 0 0 1-4-1.300V15a6 6 0 1 1-6-6c.3 0 .7 0 1 .1v3.200a3 3 0 1 0 2 2.800V3z"/>'),
  youtube: SV('<rect x="2" y="5" width="20" height="14" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="m10 9 5 3-5 3z"/>'),
  facebook: SV('<path d="M14 8V6.500c0-.7.300-1 1-1h2V2h-3c-3 0-4.500 1.800-4.500 4.500V8H7v3.500h2.500V22H14V11.500h2.800L17.300 8z"/>'),
  arrow: SV('<path d="M5 12h12m-5-5 5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>')
};
const SOCIALS = [['instagram', 'Instagram', site.instagram], ['tiktok', 'TikTok', site.tiktok], ['youtube', 'YouTube', site.youtube], ['facebook', 'Facebook', site.facebook]].filter(x => x[2]);
const socialRow = () => SOCIALS.length ? `<ul class="soc">${SOCIALS.map(x => `<li><a href="${E(x[2])}" target="_blank" rel="noopener me" aria-label="${x[1]} ${E(site.dealer)}">${IC[x[0]]}<span>${x[1]}</span></a></li>`).join('')}</ul>` : '';
const telHref = 'tel:+' + String(site.whatsapp).replace(/\D/g, '');
const mapQ = String(about.mapsQuery || site.address || '').trim();
const mapEmbedSrc = (() => { const e = String(about.mapsEmbed || ''); const m = e.match(/src="([^"]+)"/); const v = (m ? m[1] : e).trim(); return /^https:\/\//.test(v) ? v : (mapQ ? 'https://www.google.com/maps?q=' + encodeURIComponent(mapQ) + '&output=embed' : ''); })();
const mapLink = mapQ ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(mapQ) : '';
const mapBox = () => mapEmbedSrc ? `<div class="mapbox"><iframe src="${E(mapEmbedSrc)}" title="Peta lokasi ${E(site.dealer)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>` : '';
const leasingItem = l => `<li class="lg">${l.logo ? `<img src="${u(l.logo)}" alt="${E(l.name)}" height="40" loading="lazy">` : `<span>${E(l.name)}</span>`}</li>`;
const leasingSection = () => { if (!leasing.length) return ''; let row = [...leasing]; while (row.length < 8) row = row.concat(leasing); const set = row.map(leasingItem).join(''); return `<section class="section leasing" aria-label="Partner leasing"><div class="wrap"><span class="eyebrow">Pembiayaan</span><h2>Cicilan mudah lewat partner leasing</h2><p class="muted">Pilih skema cicilan yang sesuai. Konsultan kami membantu simulasi dan pengajuan. Persetujuan pembiayaan mengikuti ketentuan masing-masing leasing.</p></div><div class="marq" style="--d:${Math.max(28, row.length * 4)}s"><ul class="mtrack">${set}</ul><ul class="mtrack" aria-hidden="true">${set}</ul></div></section>`; };
const out = {}; // path -> html
const staticFiles = {};

function jsonld(o) { return '<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, '\\u003c') + '</script>'; }
const orgLd = () => ({ '@context': 'https://schema.org', '@type': 'AutoDealer', name: site.dealer, brand: { '@type': 'Brand', name: 'XPeng' }, url: abs('/'), logo: abs('assets/img/logo.svg'), telephone: site.phone, address: { '@type': 'PostalAddress', streetAddress: site.address, addressCountry: 'ID' }, sameAs: [site.instagram, site.tiktok, site.youtube, site.facebook].filter(Boolean), email: site.email || undefined, hasMap: mapLink || undefined });
const crumbs = list => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: list.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: abs(c[1]) })) });
const faqLd = f => f && f.length ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: f.map(x => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) } : null;

function layout({ title, desc, path: p, h1, body, ld = [], image, type = 'website', noindex }) {
  const img = abs(image || 'assets/img/g6-black-depan.webp');
  if (EDITABLE(p)) { try { const r = PL.process(p, body, PAGES_CFG[p] || {}, { esc: E, u }); body = r.html; PAGE_INDEX[p] = { label: title, sections: r.sections }; } catch (e) { console.log('Penyusun halaman dilewati untuk ' + p + ': ' + e.message); } }
  /* kecepatan: iframe berat (video YouTube, Google Maps) tidak dimuat saat halaman dibuka. src dipindah ke data-src,
     lalu app.js mengisinya kembali hanya setelah halaman selesai dimuat dan iframe mendekati layar. */
  body = body.replace(/<iframe\b([^>]*?)\ssrc="(https:\/\/(?:www\.youtube-nocookie\.com|www\.youtube\.com|www\.google\.com\/maps|maps\.google\.com)[^"]*)"([^>]*)>/g, (m, a, s, b) => '<iframe' + (a + b).replace(/\sloading="lazy"/g, '') + ' data-src="' + s + '">');
  /* gambar utama halaman (fetchpriority=high) di-preload; dibaca dari hasil akhir supaya ikut berubah jika fotonya diganti dari admin */
  const pm = body.match(/<img\b[^>]*\bsrc="([^"]+)"[^>]*\bfetchpriority="high"/), preload = pm ? `<link rel="preload" as="image" href="${pm[1]}" fetchpriority="high">\n` : '';
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${E(title)}</title><meta name="description" content="${E(desc)}">
<link rel="canonical" href="${abs(p)}"><meta name="robots" content="${noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large'}">
<meta name="theme-color" content="#0a0b0d"><link rel="icon" href="${u('assets/img/favicon.svg')}" type="image/svg+xml"><link rel="manifest" href="${u('manifest.webmanifest')}">
<meta property="og:type" content="${type}"><meta property="og:title" content="${E(title)}"><meta property="og:description" content="${E(desc)}"><meta property="og:image" content="${img}"><meta property="og:url" content="${abs(p)}"><meta property="og:locale" content="id_ID"><meta property="og:site_name" content="${E(site.name)}">
<meta name="twitter:card" content="summary_large_image">
${preload}<link rel="stylesheet" href="${u('assets/css/style.css')}?v=${ASSET_V}">
${jsonld(orgLd())}${ld.filter(Boolean).map(jsonld).join('')}
${/^G-[A-Z0-9]{6,14}$/.test(site.ga4 || '') && !noindex ? `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${site.ga4}');addEventListener('load',function(){setTimeout(function(){var s=document.createElement('script');s.async=1;s.src='https://www.googletagmanager.com/gtag/js?id=${site.ga4}';document.head.appendChild(s)},300)});</script>` : ''}
</head><body data-base="${BASE}" data-wa="${site.whatsapp}">
<a class="skip" href="#main">Lewati ke konten</a>
<header class="site"><div class="wrap bar"><a class="brand" href="${u('/')}" aria-label="${E(site.name)} beranda"><img src="${u('assets/img/icon-white.svg')}" alt="" width="40" height="22"><span>XPENG</span></a>
<nav id="nav" aria-label="Menu utama"><a href="${u('/model/')}">Model</a><a href="${u('/pricelist/')}">Pricelist</a><a href="${u('/artikel/')}">Artikel</a><a href="${u('/tentang/')}">Tentang</a><a href="${u('/kontak/')}">Kontak</a></nav>
<a class="btn sm" href="${wa('Halo, saya tertarik dengan XPeng. Boleh minta info?')}" rel="noopener">WhatsApp</a><button class="burger" id="burger" aria-label="Buka menu" aria-expanded="false"><i></i><i></i></button></div></header>
<main id="main">${body}</main>
<footer class="site"><div class="wrap fgrid"><div><img src="${u('assets/img/logo-white.svg')}" alt="XPeng" width="120" height="84" loading="lazy"><p>${E(site.tagline)}</p></div>
<div><h2>Model</h2>${models.map(m => `<a href="${u('/model/' + m.slug + '/')}">${E(m.name)}</a>`).join('')}</div>
<div><h2>Informasi</h2><a href="${u('/pricelist/')}">Pricelist ${E(site.pricelistUpdate)}</a><a href="${u('/artikel/')}">Artikel</a><a href="${u('/tentang/')}">Tentang kami</a><a href="${u('/kontak/')}">Kontak dan Test Drive</a></div>
<div><h2>Hubungi</h2><p>${E(site.dealer)}<br>${E(site.address)}<br><a href="${telHref}">${E(site.phone)}</a></p>${socialRow()}</div></div>
<div class="wrap legal">© ${new Date().getFullYear()} ${E(site.dealer)}. Harga dan spesifikasi dapat berubah tanpa pemberitahuan. XPeng adalah merek dagang pemiliknya.</div></footer>
<a class="wafab" href="${wa('Halo, saya mau tanya XPeng')}" rel="noopener" aria-label="Chat WhatsApp"><svg viewBox="0 0 32 32" width="26" height="26" fill="#fff"><path d="M16 3a13 13 0 0 0-11 19.8L3 29l6.4-2A13 13 0 1 0 16 3zm0 2.3A10.7 10.7 0 1 1 9.5 24l-.4-.3-3.6 1.1 1.2-3.5-.3-.4A10.7 10.7 0 0 1 16 5.3zm-4 5.4c-.3 0-.7.1-1 .5-.4.4-1.3 1.2-1.3 3s1.3 3.5 1.5 3.7c.2.3 2.6 4.1 6.400 5.600 3.200 1.200 3.800.9 4.500.9.700-.1 2.200-.9 2.500-1.800.3-.9.3-1.600.2-1.800-.1-.2-.4-.3-.8-.5l-2.600-1.200c-.3-.1-.6-.2-.9.200-.3.400-1 1.200-1.200 1.400-.2.200-.4.300-.8.100a8.900 8.900 0 0 1-4.400-3.800c-.3-.6.300-.6 1-1.900.1-.2.100-.4 0-.6l-1.200-2.900c-.3-.7-.6-.6-.9-.6z"/></svg></a>
<script src="${u('assets/js/app.js')}?v=${ASSET_V}" defer></script></body></html>`;
}

/* ---------- komponen ---------- */
const picture = (src, alt, cls = '', w = 1200, h = 800, lazy = true) => `<img class="${cls}" src="${u(src)}" alt="${E(alt)}" width="${w}" height="${h}" ${lazy ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">`;
const modelCard = m => `<article class="mcard"><a href="${u('/model/' + m.slug + '/')}">${picture(m.hero, m.name + ' - ' + m.type, 'mimg', 960, 640)}<div class="mbody"><span class="eyebrow">${E(m.type)}</span><h3>${E(m.name)}</h3><p>${E(m.tagline)}</p><strong class="mprice">Mulai ${rp(Math.min(...m.variants.map(v => v.price)))}</strong><span class="more">Lihat model →</span></div></a></article>`;
const artCard = a => `<article class="acard"><a href="${u('/artikel/' + a.slug + '/')}">${a.image ? picture(a.image, a.imageAlt || a.title, '', 600, 400) : '<div class="noimg"></div>'}<div><span class="eyebrow">${E(a.category || 'Artikel')}</span><h3>${E(a.title)}</h3><p>${E(a.description)}</p></div></a></article>`;
const faqBlock = f => f && f.length ? `<section class="faq"><h2>Pertanyaan yang sering diajukan</h2>${f.map(x => `<details><summary>${E(x.q)}</summary><p>${E(x.a)}</p></details>`).join('')}</section>` : '';
const leadForm = `<form class="lead" id="lead" novalidate><h3>Jadwalkan test drive</h3><label>Nama<input name="nama" required autocomplete="name"></label><label>Model<select name="model">${models.map(m => `<option>${E(m.name)}</option>`).join('')}</select></label><label>Rencana pembelian<select name="rencana"><option>Secepatnya</option><option>1-3 bulan</option><option>Masih membandingkan</option></select></label><button class="btn" type="submit">Kirim lewat WhatsApp</button><small>Data Anda hanya dikirim ke WhatsApp dealer.</small></form>`;

/* ---------- artikel: auto internal link ---------- */
function autoLink(html, selfPath) {
  const targets = keywords.filter(k => k.page && k.page !== selfPath && k.kw).sort((a, b) => b.kw.length - a.kw.length);
  let used = 0; const done = new Set();
  const has = html;
  return html.replace(/<(p|li)>([\s\S]*?)<\/\1>/g, (m, tag, inner) => {
    if (used >= 3) return m;
    const parts = inner.split(/(<a [^>]*>[\s\S]*?<\/a>|<[^>]+>)/);
    for (const k of targets) {
      if (used >= 3 || done.has(k.page) || has.includes('href="' + u(k.page) + '"')) continue;
      const re = new RegExp('\\b(' + k.kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')\\b', 'i');
      for (let i = 0; i < parts.length; i++) { if (parts[i].startsWith('<')) continue; if (re.test(parts[i])) { parts[i] = parts[i].replace(re, '<a href="' + u(k.page) + '">$1</a>'); used++; done.add(k.page); break; } }
    }
    return '<' + tag + '>' + parts.join('') + '</' + tag + '>';
  });
}
const fixLinks = h => h.replace(/(href|src)="(\/(?!\/)[^"]*)"/g, (m, a, v) => (BASE && (v === BASE || v.startsWith(BASE + '/'))) ? m : a + '="' + BASE + v + '"').replace(/src="assets\//g, 'src="' + BASE + '/assets/').replace(/poster="assets\//g, 'poster="' + BASE + '/assets/');

/* ---------- video beranda (opsional): isi site.heroVideo di Admin > Pengaturan; kosong = tidak tampil ---------- */
function heroVideoSection() {
  const raw = String(site.heroVideo || '').trim(); if (!raw) return '';
  let md = '';
  const yt = raw.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{11})/) || raw.match(/^([A-Za-z0-9_-]{11})$/);
  if (yt) md = '{{youtube:' + yt[1] + '}}'; else if (/^[\w./-]+\.(mp4|webm)$/i.test(raw)) md = '{{video:' + raw.replace(/^\//, '') + '}}';
  const vh = md ? MD.render(md) : ''; if (!vh) { console.log('PERINGATAN: Video beranda tidak valid, tidak ditampilkan: ' + raw); return ''; }
  if (/<video /.test(vh) && !fs.existsSync(path.join(ROOT, raw.replace(/^\//, '')))) console.log('PERINGATAN: file video beranda belum ada di repo (mungkin masih dikompres): ' + raw);
  return `<section class="section" id="video-beranda"><div class="wrap"><span class="eyebrow">Video</span><h2>${E(site.heroVideoJudul || 'Rasakan XPeng dalam gerak')}</h2>${site.heroVideoTeks ? `<p class="muted">${E(site.heroVideoTeks)}</p>` : ''}${vh}</div></section>`;
}

/* ---------- halaman ---------- */
function home() {
  const m0 = models[0], m1 = models[1];
  const slides = models.map((m, i) => `<div class="slide${i === 0 ? ' on' : ''}" role="group" aria-label="${E(m.name)}">${picture(m.hero, m.name, 'bg', 1280, 960, i > 0)}<div class="shade"></div><div class="wrap cap"><span class="eyebrow">${E(m.type)}</span>${i === 0 ? `<h1>${E(m.name)}<br><em>${E(site.tagline)}</em></h1>` : `<h2 class="h1">${E(m.name)}<br><em>${E(m.tagline)}</em></h2>`}<p>Mulai ${rp(Math.min(...m.variants.map(v => v.price)))} • Pricelist ${E(site.pricelistUpdate)}</p><div class="cta"><a class="btn" href="${u('/model/' + m.slug + '/')}">Lihat ${E(m.name)}</a><a class="btn ghost" href="${u('/kontak/')}">Test Drive</a></div></div></div>`).join('');
  const cfgModels = models.map((m, i) => `<button class="tab${i === 0 ? ' on' : ''}" data-m="${i}">${E(m.name)}</button>`).join('');
  const body = `
<section class="hero" id="hero" aria-roledescription="carousel" aria-label="Model unggulan"><div class="slides">${slides}</div>
<div class="dots" id="dots">${models.map((m, i) => `<button class="${i === 0 ? 'on' : ''}" aria-label="Slide ${i + 1}"></button>`).join('')}</div><button class="arr prev" aria-label="Sebelumnya">‹</button><button class="arr next" aria-label="Berikutnya">›</button></section>
<section class="band"><div class="wrap stats"><div><b>800V</b><span>Platform pengisian cepat</span></div><div><b>8 th</b><span>Garansi baterai dan kendaraan</span></div><div><b>7 &amp; 5</b><span>Pilihan kursi: X9 dan G6</span></div><div><b>${rp(minPrice).replace('Rp', 'Rp ')}</b><span>Harga mulai dari</span></div></div></section>
<section class="section"><div class="wrap"><span class="eyebrow">Model</span><h2>Pilih XPeng sesuai gaya hidup Anda</h2>
<div class="car" id="car"><div class="track">${models.map(modelCard).join('')}</div></div></div></section>
${(vh => vh ? vh + '\n' : '')(heroVideoSection())}<section class="section dark" id="cfg"><div class="wrap"><span class="eyebrow">Interaktif</span><h2>Atur mobil dan hitung cicilan</h2><div class="cfg" data-models='${JSON.stringify(models.map(m => ({ n: m.name, c: m.colors, v: m.variants, s: m.slug }))).replace(/'/g, '&#39;')}'>
<div class="stage"><div class="tabs" role="tablist">${cfgModels}</div><img id="cfgimg" src="${u(m0.colors[0].image)}" alt="${E(m0.name)} warna ${E(m0.colors[0].name)}" width="1200" height="800"><div class="swatches" id="sw"></div><p id="colname" class="muted"></p></div>
<div class="panel"><label>Varian<select id="var"></select></label><div class="big" id="harga"></div>
<label>Uang muka: <b id="dpv">30%</b><input type="range" id="dp" min="20" max="70" step="5" value="30"></label>
<label>Tenor: <b id="tnv">5 tahun</b><input type="range" id="tn" min="1" max="7" step="1" value="5"></label>
<label>Bunga per tahun: <b id="bgv">5%</b><input type="range" id="bg" min="0" max="12" step="0.5" value="5"></label>
<div class="res"><span>Estimasi cicilan per bulan</span><strong id="cic"></strong><small>Simulasi saja, bunga anuitas. Skema leasing resmi bisa berbeda.</small></div>
<a class="btn" id="cfgwa" href="#" rel="noopener">Minta penawaran via WhatsApp</a></div></div></div></section>
${leasingSection()}
<section class="section"><div class="wrap"><span class="eyebrow">Galeri</span><h2>Lihat langsung detailnya</h2><div class="car" id="gal"><div class="track g">${[...m0.gallery.slice(0, 5), ...m1.gallery.slice(0, 5)].map((g, i) => `<figure>${picture(g, 'Galeri XPeng foto ' + (i + 1), '', 900, 600)}</figure>`).join('')}</div></div></div></section>
<section class="section dark"><div class="wrap two"><div><span class="eyebrow">Pricelist ${E(site.pricelistUpdate)}</span><h2>Harga XPeng terbaru</h2><table class="ptbl"><tbody>${models.flatMap(m => m.variants.map(v => `<tr><th>${E(v.name)}</th><td>${rp(v.price)}</td></tr>`)).join('')}</tbody></table><a class="btn" href="${u('/pricelist/')}">Lihat pricelist lengkap</a></div>${leadForm}</div></section>
${articles.length ? `<section class="section"><div class="wrap"><span class="eyebrow">Artikel</span><h2>Panduan memilih mobil listrik</h2><div class="agrid">${articles.slice(0, 3).map(artCard).join('')}</div></div></section>` : ''}
<section class="section"><div class="wrap narrow">${faqBlock(HOME_FAQ)}</div></section>`;
  return layout({ title: `XPeng Indonesia | Harga X9 & G6 ${site.pricelistUpdate}`.slice(0, 62), desc: site.description, path: '/', body, image: m0.hero, ld: [faqLd(HOME_FAQ), { '@context': 'https://schema.org', '@type': 'WebSite', name: site.name, url: abs('/') }] });
}
const HOME_FAQ = [
  { q: 'Berapa harga XPeng di Indonesia?', a: `Saat ini: ${models.flatMap(m => m.variants.map(v => v.name + ' ' + rp(v.price))).join(', ')}.` },
  { q: 'Model XPeng apa saja yang tersedia?', a: 'Saat ini tersedia XPeng X9 (MPV listrik 7 kursi) dan XPeng G6 (SUV coupe listrik).' },
  { q: 'Bagaimana cara test drive XPeng?', a: 'Isi formulir test drive atau hubungi kami lewat WhatsApp, lalu konsultan akan mengatur jadwal.' }
];

function modelPage(m) {
  const p = '/model/' + m.slug + '/';
  const body = `<section class="mhero">${picture(m.hero, m.name + ' ' + m.type, 'bg', 1280, 960, false)}<div class="shade"></div><div class="wrap cap"><nav class="crumb" aria-label="Breadcrumb"><a href="${u('/')}">Beranda</a> › <a href="${u('/model/')}">Model</a> › ${E(m.name)}</nav><span class="eyebrow">${E(m.type)}</span><h1>${E(m.name)}</h1><p>${E(m.tagline)}</p><div class="cta"><a class="btn" href="${wa('Halo, saya tertarik ' + m.name)}" rel="noopener">Tanya harga</a><a class="btn ghost" href="${u('/kontak/')}">Test Drive</a></div></div></section>
<section class="section"><div class="wrap two"><div><h2>Keunggulan ${E(m.name)}</h2><ul class="check">${m.highlights.map(h => `<li>${E(h)}</li>`).join('')}</ul><h2>Harga ${E(m.name)} ${E(site.pricelistUpdate)}</h2><table class="ptbl"><tbody>${m.variants.map(v => `<tr><th>${E(v.name)}</th><td>${rp(v.price)}</td></tr>`).join('')}</tbody></table></div>
<div><h2>Spesifikasi ringkas</h2><table class="ptbl spec"><tbody>${m.specs.map(s => `<tr><th>${E(s.k)}</th><td>${E(s.v)}</td></tr>`).join('')}</tbody></table></div></div></section>
${leasingSection()}
<section class="section dark"><div class="wrap"><h2>Galeri ${E(m.name)}</h2><div class="car"><div class="track g">${m.gallery.map((g, i) => `<figure>${picture(g, m.name + ' foto ' + (i + 1), '', 900, 600)}</figure>`).join('')}</div></div></div></section>
<section class="section"><div class="wrap two"><div>${faqBlock(m.faq)}</div>${leadForm}</div></section>`;
  const ld = [crumbs([['Beranda', '/'], ['Model', '/model/'], [m.name, p]]), faqLd(m.faq), { '@context': 'https://schema.org', '@type': 'Product', name: m.name, brand: { '@type': 'Brand', name: 'XPeng' }, image: m.gallery.slice(0, 4).map(abs), description: m.metaDescription, offers: m.variants.map(v => ({ '@type': 'Offer', name: v.name, price: v.price, priceCurrency: 'IDR', availability: 'https://schema.org/InStock', url: abs(p) })) }];
  return layout({ title: m.metaTitle, desc: m.metaDescription, path: p, body, image: m.hero, ld });
}

function modelIndex() {
  const body = `<section class="pagehead"><div class="wrap"><nav class="crumb"><a href="${u('/')}">Beranda</a> › Model</nav><h1>Model XPeng di Indonesia</h1><p>Pilih antara MPV listrik 7 kursi XPeng X9 dan SUV coupe XPeng G6.</p></div></section><section class="section"><div class="wrap agrid two-up">${models.map(modelCard).join('')}</div></section>`;
  return layout({ title: 'Model XPeng: X9 dan G6 Mobil Listrik Premium', desc: 'Daftar model XPeng di Indonesia lengkap dengan harga, spesifikasi, dan foto. Bandingkan XPeng X9 dan XPeng G6.', path: '/model/', body, ld: [crumbs([['Beranda', '/'], ['Model', '/model/']])] });
}

function pricelist() {
  const rows = models.flatMap(m => m.variants.map(v => ({ m, v })));
  const body = `<section class="pagehead"><div class="wrap"><nav class="crumb"><a href="${u('/')}">Beranda</a> › Pricelist</nav><h1>Pricelist XPeng ${E(site.pricelistUpdate)}</h1><p>Harga resmi dealer, selalu diperbarui. Hubungi kami untuk konfirmasi dan promo terbaru.</p></div></section>
<section class="section"><div class="wrap two"><div><div class="tbl"><table class="ptbl full"><thead><tr><th>Varian</th><th>Harga</th><th></th></tr></thead><tbody>${rows.map(r => `<tr><th><a href="${u('/model/' + r.m.slug + '/')}">${E(r.v.name)}</a></th><td>${rp(r.v.price)}</td><td><a class="btn sm" href="${wa('Halo, saya mau penawaran ' + r.v.name)}" rel="noopener">Tanya</a></td></tr>`).join('')}</tbody></table></div>
<p class="muted">Harga dapat berubah. Tanyakan rincian OTR sesuai kota Anda.</p>${picture('assets/img/pricelist-juli-2026.webp', 'Pricelist XPeng X9 dan G6 terbaru', 'plimg', 540, 656)}</div>${leadForm}</div></section>
${leasingSection()}
<section class="section"><div class="wrap narrow">${faqBlock(HOME_FAQ)}</div></section>`;
  return layout({ title: `Pricelist XPeng ${site.pricelistUpdate} | X9 dan G6`, desc: `Pricelist XPeng ${site.pricelistUpdate}: ${rows.map(r => r.v.name.replace('XPeng ', '').replace('New ', '') + ' ' + rp(r.v.price)).join(', ')}.`.slice(0, 160), path: '/pricelist/', body, image: 'assets/img/pricelist-juli-2026.webp', ld: [crumbs([['Beranda', '/'], ['Pricelist', '/pricelist/']]), faqLd(HOME_FAQ)] });
}

function contact() {
  const chips = [['Tanya harga XPeng X9', 'Halo, saya mau tanya harga XPeng X9'], ['Tanya harga XPeng G6', 'Halo, saya mau tanya harga XPeng G6'], ['Simulasi cicilan', 'Halo, saya mau simulasi cicilan XPeng'], ['Booking test drive', 'Halo, saya mau booking test drive XPeng']];
  const cards = [
    `<a class="ccard main" href="${wa('Halo, saya mau tanya XPeng')}" rel="noopener"><span class="cic">${IC.wa}</span><b>WhatsApp</b><span class="cv">${E(site.phone)}</span><small>Cara tercepat: tanya harga, promo, dan jadwal test drive.</small><span class="go">Chat sekarang ${IC.arrow}</span></a>`,
    site.phone ? `<a class="ccard" href="${telHref}"><span class="cic">${IC.phone}</span><b>Telepon</b><span class="cv">${E(site.phone)}</span><small>Ketuk untuk menelepon langsung.</small><span class="go">Telepon ${IC.arrow}</span></a>` : '',
    site.email ? `<a class="ccard" href="mailto:${E(site.email)}"><span class="cic">${IC.mail}</span><b>Email</b><span class="cv">${E(site.email)}</span><small>Untuk penawaran resmi dan kerja sama.</small><span class="go">Kirim email ${IC.arrow}</span></a>` : '',
    site.address ? `<a class="ccard" href="${E(mapLink)}" target="_blank" rel="noopener"><span class="cic">${IC.pin}</span><b>Showroom</b><span class="cv">${E(site.address)}</span><small>Ketuk untuk membuka rute di Google Maps.</small><span class="go">Buka peta ${IC.arrow}</span></a>` : ''
  ].filter(Boolean).join('');
  const hours = about.hours.length ? `<div class="hours"><h3>${IC.clock} Jam operasional</h3><ul>${about.hours.map(h => `<li>${E(h)}</li>`).join('')}</ul></div>` : '';
  const body = `<section class="chero"><i class="orb o1"></i><i class="orb o2"></i><div class="wrap"><nav class="crumb"><a href="${u('/')}">Beranda</a> › Kontak</nav><span class="eyebrow">Hubungi kami</span><h1>Kontak dan Test Drive XPeng<em>Ngobrol santai soal XPeng impian Anda. Konsultan kami siap membantu lewat WhatsApp.</em></h1>
<div class="chips" role="list">${chips.map(c => `<a role="listitem" href="${wa(c[1])}" rel="noopener">${E(c[0])}</a>`).join('')}</div></div></section>
<section class="section"><div class="wrap"><div class="cgrid">${cards}</div>${SOCIALS.length ? `<div class="socbox"><h2>Ikuti kami</h2><p class="muted">Promo, konten model baru, dan kabar terbaru XPeng.</p>${socialRow()}</div>` : ''}</div></section>
<section class="section dark" id="testdrive"><div class="wrap two">${leadForm}<div><span class="eyebrow">Mudah dan cepat</span><h2>Test drive dalam 3 langkah</h2><ol class="steps"><li><b>Isi formulir</b><span>Nama, model, dan rencana pembelian Anda.</span></li><li><b>Chat WhatsApp</b><span>Formulir otomatis terkirim ke konsultan kami.</span></li><li><b>Jadwal disepakati</b><span>Datang ke showroom dan coba langsung mobilnya.</span></li></ol>${hours}</div></div></section>
<section class="section"><div class="wrap two loc"><div><span class="eyebrow">Lokasi</span><h2>Kunjungi showroom kami</h2><p>${E(site.dealer)}<br>${E(site.address)}</p><div class="cta"><a class="btn" href="${E(mapLink)}" target="_blank" rel="noopener">Buka di Google Maps</a><a class="btn ghost" href="${u('/tentang/')}">Tentang kami</a></div></div>${mapBox()}</div></section>`;
  return layout({ title: 'Kontak dan Test Drive XPeng X9 G6 | Hubungi Kami'.slice(0, 62), desc: `Hubungi ${site.dealer} lewat WhatsApp, telepon, atau email. Jadwalkan test drive XPeng X9 dan G6, lihat lokasi showroom, dan ikuti media sosial kami.`.slice(0, 160), path: '/kontak/', body, ld: [crumbs([['Beranda', '/'], ['Kontak', '/kontak/']]), { '@context': 'https://schema.org', '@type': 'ContactPage', name: 'Kontak ' + site.dealer, url: abs('/kontak/') }] });
}

function aboutPage() {
  const first = about.photos[0];
  const intro = about.intro.length ? about.intro : [`${site.dealer} adalah dealer resmi XPeng. Kami membantu Anda mengenal XPeng X9 dan G6, mulai dari konsultasi harga, simulasi cicilan, sampai test drive.`];
  const services = about.services.length ? about.services : ['Konsultasi model dan pricelist terbaru', 'Test drive XPeng X9 dan G6', 'Simulasi cicilan dan pengajuan leasing', 'Pendampingan sampai serah terima'];
  const body = `<section class="pagehead abouthero">${first ? picture(first.src, first.alt || 'Showroom ' + site.dealer, 'bg', 1280, 720, false) : ''}<div class="shade"></div><div class="wrap"><nav class="crumb"><a href="${u('/')}">Beranda</a> › Tentang</nav><span class="eyebrow">Tentang kami</span><h1>Tentang ${E(site.dealer)}<em>${E(intro[0])}</em></h1><div class="cta"><a class="btn" href="${u('/kontak/')}">Hubungi kami</a><a class="btn ghost" href="#lokasi">Lihat lokasi</a></div></div></section>
${intro.length > 1 || services.length ? `<section class="section"><div class="wrap two"><div><span class="eyebrow">Profil</span><h2>Mengenal kami lebih dekat</h2>${intro.slice(1).map(t => `<p>${E(t)}</p>`).join('') || `<p>${E(intro[0])}</p>`}</div><div class="svcbox"><h3>Layanan kami</h3><ul class="check">${services.map(x => `<li>${E(x)}</li>`).join('')}</ul></div></div></section>` : ''}
${about.photos.length ? `<section class="section dark"><div class="wrap"><span class="eyebrow">Showroom</span><h2>Foto dealer kami</h2><div class="car"><div class="track g">${about.photos.map((ph, i) => `<figure>${picture(ph.src, ph.alt || 'Showroom ' + site.dealer + ' foto ' + (i + 1), '', 900, 600)}</figure>`).join('')}</div></div></div></section>` : ''}
${about.history.length ? `<section class="section"><div class="wrap narrow"><span class="eyebrow">Sejarah</span><h2>Perjalanan perusahaan</h2><ol class="tl">${about.history.map(h => `<li><time>${E(h.year)}</time><div><h3>${E(h.title)}</h3><p>${E(h.text)}</p></div></li>`).join('')}</ol></div></section>` : ''}
<section class="section${about.history.length ? ' dark' : ''}" id="lokasi"><div class="wrap two loc"><div><span class="eyebrow">Lokasi</span><h2>Alamat showroom</h2><p>${E(site.dealer)}<br>${E(site.address)}</p>${about.hours.length ? `<div class="hours"><h3>${IC.clock} Jam operasional</h3><ul>${about.hours.map(h => `<li>${E(h)}</li>`).join('')}</ul></div>` : ''}<div class="cta"><a class="btn" href="${E(mapLink)}" target="_blank" rel="noopener">Buka di Google Maps</a><a class="btn ghost" href="${wa('Halo, saya mau berkunjung ke showroom XPeng')}" rel="noopener">Tanya lewat WhatsApp</a></div></div>${mapBox()}</div></section>`;
  const ld = [crumbs([['Beranda', '/'], ['Tentang', '/tentang/']]), { '@context': 'https://schema.org', '@type': 'AboutPage', name: 'Tentang ' + site.dealer, url: abs('/tentang/') }];
  return layout({ title: 'Tentang Kami | Lokasi dan Profil Dealer XPeng', desc: `Profil ${site.dealer}, dealer XPeng resmi: alamat showroom, peta Google Maps, jam operasional, dan sejarah perusahaan. Hubungi kami untuk test drive.`.slice(0, 160), path: '/tentang/', body, image: first && first.src, ld });
}

function articleIndex() {
  const body = `<section class="pagehead"><div class="wrap"><nav class="crumb"><a href="${u('/')}">Beranda</a> › Artikel</nav><h1>Artikel dan Panduan Mobil Listrik</h1><p>Tips memilih, merawat, dan mengisi daya mobil listrik premium.</p></div></section><section class="section"><div class="wrap agrid">${articles.length ? articles.map(artCard).join('') : '<p>Belum ada artikel.</p>'}</div></section>`;
  return layout({ title: 'Artikel Mobil Listrik XPeng | Panduan dan Tips', desc: 'Panduan memilih mobil listrik, harga XPeng, dan tips charging dari tim dealer XPeng. Ditulis orisinal dan diperbarui rutin.', path: '/artikel/', body, ld: [crumbs([['Beranda', '/'], ['Artikel', '/artikel/']])] });
}

function articlePage(a) {
  const p = '/artikel/' + a.slug + '/';
  let html = MD.render(a.body); html = autoLink(html, p); html = fixLinks(html);
  /* tautan ke artikel yang belum terbit diubah jadi teks biasa, supaya tidak ada link 404 saat artikel terbit bertahap */
  const live = new Set(articles.map(x => x.slug));
  html = html.replace(/<a href="[^"]*\/artikel\/([a-z0-9-]+)\/">([\s\S]*?)<\/a>/g, (m, sl, t) => live.has(sl) ? m : t);
  [...a.body.matchAll(/\{\{\s*video\s*:\s*([^\s}|]+)/gi)].forEach(m => { if (!fs.existsSync(path.join(ROOT, m[1]))) console.log('PERINGATAN: video belum ada di repo (mungkin masih dikompres): ' + m[1] + ' <- ' + a.slug); });
  const ctaLine = (t, b) => `<aside class="cta-inline" data-cta="${b}"><p><b>${t}</b></p><a class="btn sm" href="${wa('Halo, saya baca artikel: ' + a.title)}" rel="noopener">Chat WhatsApp</a> <a class="btn sm ghost" href="${u('/kontak/#testdrive')}">Booking test drive</a></aside>`;
  const ctaTop = ctaLine('Mau tahu harga dan promo XPeng terbaru?', 'atas');
  let htmlMid = html; { const hs = [...html.matchAll(/<h2[ >]/g)]; if (hs.length >= 4) { const i = hs[Math.floor(hs.length / 2)].index; htmlMid = html.slice(0, i) + ctaLine('Tertarik? Konsultasi gratis, tanpa kewajiban beli.', 'tengah') + html.slice(i); } }
  const toc = [...a.body.matchAll(/^##\s+(.*)$/gm)].map(m => `<li><a href="#${MD.slug(m[1])}">${E(m[1])}</a></li>`).join('');
  const rel = articles.filter(x => x.slug !== a.slug).slice(0, 2);
  const body = `<article class="art"><header class="wrap narrow"><nav class="crumb"><a href="${u('/')}">Beranda</a> › <a href="${u('/artikel/')}">Artikel</a></nav><span class="eyebrow">${E(a.category || 'Artikel')}</span><h1>${E(a.title)}</h1><p class="muted">Diperbarui <time datetime="${(a.updated || a.date).slice(0, 10)}">${(a.updated || a.date).slice(0, 10)}</time> • Ditulis oleh tim ${E(site.dealer)}</p></header>
${a.image ? `<div class="wrap narrow">${picture(a.image, a.imageAlt, 'artimg', 800, 500, false)}</div>` : ''}
<div class="wrap narrow prose">${toc ? `<nav class="toc" aria-label="Daftar isi"><b>Daftar isi</b><ol>${toc}</ol></nav>` : ''}${ctaTop}${htmlMid}
<div class="cta-box" data-cta="bawah"><h2>Tertarik dengan XPeng?</h2><p>Konsultasi gratis harga, cicilan, dan jadwal test drive.</p><a class="btn" href="${wa('Halo, saya baca artikel: ' + a.title)}" rel="noopener">Chat WhatsApp</a></div></div>
${rel.length ? `<div class="wrap"><h2>Baca juga</h2><div class="agrid">${rel.map(artCard).join('')}</div></div>` : ''}</article>`;
  const ld = [crumbs([['Beranda', '/'], ['Artikel', '/artikel/'], [a.title, p]]), { '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description: a.description, image: a.image ? [abs(a.image)] : undefined, datePublished: a.date, dateModified: (a.updated || a.date).slice(0, 10), author: { '@type': 'Organization', name: site.dealer }, publisher: { '@type': 'Organization', name: site.dealer, logo: { '@type': 'ImageObject', url: abs('assets/img/logo.svg') } }, mainEntityOfPage: abs(p) }, faqLd(MD.faq(a.body))];
  return layout({ title: a.title, desc: a.description, path: p, body, image: a.image, type: 'article', ld });
}

function notFound() {
  return layout({ title: 'Halaman tidak ditemukan | XPeng', desc: 'Halaman yang Anda cari tidak ditemukan. Kembali ke beranda XPeng.', path: '/404.html', noindex: true, body: `<section class="pagehead"><div class="wrap"><h1>Halaman tidak ditemukan</h1><p>Coba kembali ke <a href="${u('/')}">beranda</a> atau lihat <a href="${u('/model/')}">model kami</a>.</p></div></section>` });
}

/* ---------- jalankan ---------- */
out['index.html'] = home(); out['model/index.html'] = modelIndex(); out['pricelist/index.html'] = pricelist(); out['kontak/index.html'] = contact(); out['tentang/index.html'] = aboutPage();
out['artikel/index.html'] = articleIndex(); out['404.html'] = notFound();
models.forEach(m => out['model/' + m.slug + '/index.html'] = modelPage(m));
articles.forEach(a => out['artikel/' + a.slug + '/index.html'] = articlePage(a));
// bersihkan folder hasil lama
['model', 'artikel', 'pricelist', 'kontak', 'tentang'].forEach(d => fs.rmSync(path.join(ROOT, d), { recursive: true, force: true }));
Object.entries(out).forEach(([f, h]) => { const fp = path.join(ROOT, f); fs.mkdirSync(path.dirname(fp), { recursive: true }); fs.writeFileSync(fp, h); });

const today = new Date().toISOString().slice(0, 10);
const urls = [['/', 1.0], ['/model/', .9], ['/pricelist/', .9], ['/artikel/', .7], ['/kontak/', .8], ['/tentang/', .7], ...models.map(m => ['/model/' + m.slug + '/', .9]), ...articles.map(a => ['/artikel/' + a.slug + '/', .7])];
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([p, pr]) => `<url><loc>${abs(p)}</loc><lastmod>${today}</lastmod><priority>${pr}</priority></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: ${BASE}/admin/\n\nUser-agent: GPTBot\nAllow: /\nUser-agent: ClaudeBot\nAllow: /\nUser-agent: PerplexityBot\nAllow: /\nUser-agent: Google-Extended\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`);
fs.writeFileSync(path.join(ROOT, 'llms.txt'), `# ${site.name}\n> ${site.description}\n\n## Model\n${models.map(m => `- [${m.name}](${abs('/model/' + m.slug + '/')}): ${m.tagline} Harga mulai ${rp(Math.min(...m.variants.map(v => v.price)))}`).join('\n')}\n\n## Harga\n- [Pricelist ${site.pricelistUpdate}](${abs('/pricelist/')}): ${models.flatMap(m => m.variants.map(v => v.name + ' ' + rp(v.price))).join('; ')}\n\n## Halaman\n- [Tentang kami](${abs('/tentang/')}): profil, lokasi, dan sejarah dealer\n- [Kontak dan test drive](${abs('/kontak/')}): WhatsApp, telepon, email, media sosial\n\n## Artikel\n${articles.map(a => `- [${a.title}](${abs('/artikel/' + a.slug + '/')}): ${a.description}`).join('\n')}\n`);
fs.writeFileSync(path.join(ROOT, 'manifest.webmanifest'), JSON.stringify({ name: site.name, short_name: 'XPeng', start_url: u('/'), display: 'standalone', background_color: '#0a0b0d', theme_color: '#0a0b0d', icons: [{ src: u('assets/img/favicon.svg'), sizes: 'any', type: 'image/svg+xml' }] }));
fs.writeFileSync(path.join(ROOT, '.nojekyll'), '');
{ const px = JSON.stringify(PAGE_INDEX, null, 1), pf = path.join(ROOT, 'data/page-index.json'); let old = ''; try { old = fs.readFileSync(pf, 'utf8'); } catch (e) {} if (old !== px) fs.writeFileSync(pf, px); }

/* ---------- laporan SEO ---------- */
const imgKB = html => { let mx = 0; for (const m of html.matchAll(/src="[^"]*?(assets\/img\/[^"]+)"/g)) { try { mx = Math.max(mx, fs.statSync(path.join(ROOT, m[1])).size / 1024); } catch (e) {} } return Math.round(mx); };
const pages = Object.entries(out).filter(([f]) => f !== '404.html').map(([f, h]) => { const r = SEO.scorePage(h, '/' + f.replace('index.html', ''), imgKB(h)); return r; });
const arts = allArticles.map(a => { const r = SEO.scoreArticle(a, allArticles); return { slug: a.slug, title: a.title, status: a.status, keyword: a.keyword, ...r }; });
const files = Object.keys(out); const broken = [];
Object.entries(out).forEach(([f, h]) => { for (const m of h.matchAll(/href="(\/[^"#?]*)"/g)) { let t = m[1].replace(BASE, '') || '/'; if (/\.(svg|xml|txt|webmanifest|webp)$/.test(t)) continue; if (t === '/admin/') continue; const key = t.replace(/^\//, '') + (t.endsWith('/') || t === '/' ? 'index.html' : ''); if (!out[key] && !fs.existsSync(path.join(ROOT, key))) broken.push({ from: f, to: t }); } });
const kwRows = keywords.map(k => { const html = Object.entries(out).find(([f]) => '/' + f.replace('index.html', '') === k.page); const t = html ? html[1].toLowerCase() : ''; const kw = k.kw.toLowerCase(); const inTitle = (t.match(/<title>([^<]*)/) || [])[1]?.includes(kw); const inH1 = (t.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]?.replace(/<[^>]+>/g, '').includes(kw); const count = t.split(kw).length - 1; return { ...k, onpage: { inTitle: !!inTitle, inH1: !!inH1, count } }; });
const bigImgs = []; (function walk(d) { fs.readdirSync(d).forEach(f => { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(jpe?g|png|webp)$/i.test(f) && fs.statSync(p).size > 250 * 1024) bigImgs.push(path.relative(ROOT, p) + ' (' + Math.round(fs.statSync(p).size / 1024) + 'KB)'); }); })(path.join(ROOT, 'assets/img'));
const avg = a => a.length ? Math.round(a.reduce((s, x) => s + x.score, 0) / a.length) : 0;
const tech = [
  { label: 'Sitemap.xml tersedia', pass: true }, { label: 'robots.txt tersedia', pass: true }, { label: 'llms.txt untuk mesin AI (GEO)', pass: true },
  { label: 'Domain utama sudah diganti (bukan USERNAME)', pass: !/USERNAME/.test(site.baseUrl), tip: 'Ubah baseUrl di Admin > Pengaturan' },
  { label: 'Tidak ada link internal rusak', pass: broken.length === 0, tip: broken.length + ' link rusak' },
  { label: 'Semua gambar di bawah 250KB', pass: bigImgs.length === 0, tip: bigImgs.join(', ') },
  { label: 'Nomor WhatsApp sudah diisi benar', pass: site.whatsapp !== '6281234567890', tip: 'Isi nomor WA asli di Admin' }
];
const report = { generated: new Date().toISOString(), site: { pageScore: avg(pages), articleScore: avg(arts.filter(a => a.status === 'published')), techScore: Math.round(tech.filter(t => t.pass).length / tech.length * 100), pages: pages.length }, tech, broken, pages, articles: arts, keywords: kwRows };
report.site.total = Math.round(report.site.pageScore * .4 + report.site.articleScore * .35 + report.site.techScore * .25);
const prevRep = JO('seo-report.json', null); const strip = r => JSON.stringify(Object.assign({}, r, { generated: 0 }));
if (!prevRep || strip(prevRep) !== strip(report)) fs.writeFileSync(path.join(ROOT, 'data/seo-report.json'), JSON.stringify(report, null, 1));
let hist = []; try { hist = J('seo-history.json'); } catch (e) {}
hist = hist.filter(h => h.date !== today); hist.push({ date: today, total: report.site.total, page: report.site.pageScore, article: report.site.articleScore, tech: report.site.techScore }); fs.writeFileSync(path.join(ROOT, 'data/seo-history.json'), JSON.stringify(hist.slice(-120)));
console.log('Build selesai:', Object.keys(out).length, 'halaman | Skor total', report.site.total, '| halaman', report.site.pageScore, '| artikel', report.site.articleScore, '| teknis', report.site.techScore);
