#!/usr/bin/env node
/* Generator situs statis XPeng: data/*.json -> halaman HTML + sitemap + robots + llms.txt + laporan SEO */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const MD = require('../shared/md.js'), SEO = require('../shared/seo.js');
const J = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));
const site = J('site.json'), models = J('models.json'), keywords = J('keywords.json');
const articles = J('articles.json').filter(a => a.status === 'published').sort((a, b) => b.date.localeCompare(a.date));
const allArticles = J('articles.json');
const E = MD.esc, rp = n => 'Rp' + Number(n).toLocaleString('id-ID');
let BASE = ''; try { BASE = new URL(site.baseUrl).pathname.replace(/\/$/, ''); } catch (e) {}
const ORIGIN = (() => { try { return new URL(site.baseUrl).origin; } catch (e) { return ''; } })();
const u = p => /^(https?:|#|mailto:|tel:|data:)/.test(p) ? p : BASE + (p.startsWith('/') ? p : '/' + p);
const abs = p => ORIGIN + u(p);
const wa = (t) => 'https://wa.me/' + site.whatsapp + '?text=' + encodeURIComponent(t);
const minPrice = Math.min(...models.flatMap(m => m.variants.map(v => v.price)));
const out = {}; // path -> html
const staticFiles = {};

function jsonld(o) { return '<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, '\\u003c') + '</script>'; }
const orgLd = () => ({ '@context': 'https://schema.org', '@type': 'AutoDealer', name: site.dealer, brand: { '@type': 'Brand', name: 'XPeng' }, url: abs('/'), logo: abs('assets/img/logo.svg'), telephone: site.phone, address: { '@type': 'PostalAddress', streetAddress: site.address, addressCountry: 'ID' }, sameAs: [site.instagram, site.tiktok, site.youtube].filter(Boolean) });
const crumbs = list => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: list.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: abs(c[1]) })) });
const faqLd = f => f && f.length ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: f.map(x => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) } : null;

function layout({ title, desc, path: p, h1, body, ld = [], image, type = 'website', noindex }) {
  const img = abs(image || 'assets/img/g6-black-depan.webp');
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${E(title)}</title><meta name="description" content="${E(desc)}">
<link rel="canonical" href="${abs(p)}"><meta name="robots" content="${noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large'}">
<meta name="theme-color" content="#0a0b0d"><link rel="icon" href="${u('assets/img/favicon.svg')}" type="image/svg+xml"><link rel="manifest" href="${u('manifest.webmanifest')}">
<meta property="og:type" content="${type}"><meta property="og:title" content="${E(title)}"><meta property="og:description" content="${E(desc)}"><meta property="og:image" content="${img}"><meta property="og:url" content="${abs(p)}"><meta property="og:locale" content="id_ID"><meta property="og:site_name" content="${E(site.name)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="${u('assets/css/style.css')}">
${jsonld(orgLd())}${ld.filter(Boolean).map(jsonld).join('')}
</head><body data-base="${BASE}" data-wa="${site.whatsapp}">
<a class="skip" href="#main">Lewati ke konten</a>
<header class="site"><div class="wrap bar"><a class="brand" href="${u('/')}" aria-label="${E(site.name)} beranda"><img src="${u('assets/img/icon-white.svg')}" alt="" width="40" height="22"><span>XPENG</span></a>
<nav id="nav" aria-label="Menu utama"><a href="${u('/model/')}">Model</a><a href="${u('/pricelist/')}">Pricelist</a><a href="${u('/artikel/')}">Artikel</a><a href="${u('/kontak/')}">Test Drive</a></nav>
<a class="btn sm" href="${wa('Halo, saya tertarik dengan XPeng. Boleh minta info?')}" rel="noopener">WhatsApp</a><button class="burger" id="burger" aria-label="Buka menu" aria-expanded="false"><i></i><i></i></button></div></header>
<main id="main">${body}</main>
<footer class="site"><div class="wrap fgrid"><div><img src="${u('assets/img/logo-white.svg')}" alt="XPeng" width="120" height="84" loading="lazy"><p>${E(site.tagline)}</p></div>
<div><h2>Model</h2>${models.map(m => `<a href="${u('/model/' + m.slug + '/')}">${E(m.name)}</a>`).join('')}</div>
<div><h2>Informasi</h2><a href="${u('/pricelist/')}">Pricelist ${E(site.pricelistUpdate)}</a><a href="${u('/artikel/')}">Artikel</a><a href="${u('/kontak/')}">Test Drive</a></div>
<div><h2>Hubungi</h2><p>${E(site.dealer)}<br>${E(site.address)}<br>${E(site.phone)}</p></div></div>
<div class="wrap legal">© ${new Date().getFullYear()} ${E(site.dealer)}. Harga dan spesifikasi dapat berubah tanpa pemberitahuan. XPeng adalah merek dagang pemiliknya.</div></footer>
<a class="wafab" href="${wa('Halo, saya mau tanya XPeng')}" rel="noopener" aria-label="Chat WhatsApp"><svg viewBox="0 0 32 32" width="26" height="26" fill="#fff"><path d="M16 3a13 13 0 0 0-11 19.8L3 29l6.4-2A13 13 0 1 0 16 3zm0 2.3A10.7 10.7 0 1 1 9.5 24l-.4-.3-3.6 1.1 1.2-3.5-.3-.4A10.7 10.7 0 0 1 16 5.3zm-4 5.4c-.3 0-.7.1-1 .5-.4.4-1.3 1.2-1.3 3s1.3 3.5 1.5 3.7c.2.3 2.6 4.1 6.400 5.600 3.200 1.200 3.800.9 4.500.9.700-.1 2.200-.9 2.500-1.800.3-.9.3-1.600.2-1.800-.1-.2-.4-.3-.8-.5l-2.600-1.200c-.3-.1-.6-.2-.9.200-.3.400-1 1.200-1.200 1.400-.2.200-.4.300-.8.100a8.900 8.900 0 0 1-4.400-3.800c-.3-.6.300-.6 1-1.900.1-.2.100-.4 0-.6l-1.200-2.900c-.3-.7-.6-.6-.9-.6z"/></svg></a>
<script src="${u('assets/js/app.js')}" defer></script></body></html>`;
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
const fixLinks = h => h.replace(/(href|src)="(\/(?!\/)[^"]*)"/g, (m, a, v) => (BASE && (v === BASE || v.startsWith(BASE + '/'))) ? m : a + '="' + BASE + v + '"').replace(/src="assets\//g, 'src="' + BASE + '/assets/');

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
<section class="section dark" id="cfg"><div class="wrap"><span class="eyebrow">Interaktif</span><h2>Atur mobil dan hitung cicilan</h2><div class="cfg" data-models='${JSON.stringify(models.map(m => ({ n: m.name, c: m.colors, v: m.variants, s: m.slug }))).replace(/'/g, '&#39;')}'>
<div class="stage"><div class="tabs" role="tablist">${cfgModels}</div><img id="cfgimg" src="${u(m0.colors[0].image)}" alt="${E(m0.name)} warna ${E(m0.colors[0].name)}" width="1200" height="800"><div class="swatches" id="sw"></div><p id="colname" class="muted"></p></div>
<div class="panel"><label>Varian<select id="var"></select></label><div class="big" id="harga"></div>
<label>Uang muka: <b id="dpv">30%</b><input type="range" id="dp" min="20" max="70" step="5" value="30"></label>
<label>Tenor: <b id="tnv">5 tahun</b><input type="range" id="tn" min="1" max="7" step="1" value="5"></label>
<label>Bunga per tahun: <b id="bgv">5%</b><input type="range" id="bg" min="0" max="12" step="0.5" value="5"></label>
<div class="res"><span>Estimasi cicilan per bulan</span><strong id="cic"></strong><small>Simulasi saja, bunga anuitas. Skema leasing resmi bisa berbeda.</small></div>
<a class="btn" id="cfgwa" href="#" rel="noopener">Minta penawaran via WhatsApp</a></div></div></div></section>
<section class="section"><div class="wrap"><span class="eyebrow">Galeri</span><h2>Lihat langsung detailnya</h2><div class="car" id="gal"><div class="track g">${[...m0.gallery.slice(0, 5), ...m1.gallery.slice(0, 5)].map((g, i) => `<figure>${picture(g, 'Galeri XPeng foto ' + (i + 1), '', 900, 600)}</figure>`).join('')}</div></div></div></section>
<section class="section dark"><div class="wrap two"><div><span class="eyebrow">Pricelist ${E(site.pricelistUpdate)}</span><h2>Harga XPeng terbaru</h2><table class="ptbl"><tbody>${models.flatMap(m => m.variants.map(v => `<tr><th>${E(v.name)}</th><td>${rp(v.price)}</td></tr>`)).join('')}</tbody></table><a class="btn" href="${u('/pricelist/')}">Lihat pricelist lengkap</a></div>${leadForm}</div></section>
${articles.length ? `<section class="section"><div class="wrap"><span class="eyebrow">Artikel</span><h2>Panduan memilih mobil listrik</h2><div class="agrid">${articles.slice(0, 3).map(artCard).join('')}</div></div></section>` : ''}
<section class="section"><div class="wrap narrow">${faqBlock(HOME_FAQ)}</div></section>`;
  return layout({ title: `XPeng Indonesia | Harga X9 & G6 ${site.pricelistUpdate}`.slice(0, 62), desc: site.description, path: '/', body, image: m0.hero, ld: [faqLd(HOME_FAQ), { '@context': 'https://schema.org', '@type': 'WebSite', name: site.name, url: abs('/') }] });
}
const HOME_FAQ = [
  { q: 'Berapa harga XPeng di Indonesia?', a: `Per ${site.pricelistUpdate}: ${models.flatMap(m => m.variants.map(v => v.name + ' ' + rp(v.price))).join(', ')}.` },
  { q: 'Model XPeng apa saja yang tersedia?', a: 'Saat ini tersedia XPeng X9 (MPV listrik 7 kursi) dan XPeng G6 (SUV coupe listrik).' },
  { q: 'Bagaimana cara test drive XPeng?', a: 'Isi formulir test drive atau hubungi kami lewat WhatsApp, lalu konsultan akan mengatur jadwal.' }
];

function modelPage(m) {
  const p = '/model/' + m.slug + '/';
  const body = `<section class="mhero">${picture(m.hero, m.name + ' ' + m.type, 'bg', 1280, 960, false)}<div class="shade"></div><div class="wrap cap"><nav class="crumb" aria-label="Breadcrumb"><a href="${u('/')}">Beranda</a> › <a href="${u('/model/')}">Model</a> › ${E(m.name)}</nav><span class="eyebrow">${E(m.type)}</span><h1>${E(m.name)}</h1><p>${E(m.tagline)}</p><div class="cta"><a class="btn" href="${wa('Halo, saya tertarik ' + m.name)}" rel="noopener">Tanya harga</a><a class="btn ghost" href="${u('/kontak/')}">Test Drive</a></div></div></section>
<section class="section"><div class="wrap two"><div><h2>Keunggulan ${E(m.name)}</h2><ul class="check">${m.highlights.map(h => `<li>${E(h)}</li>`).join('')}</ul><h2>Harga ${E(m.name)} ${E(site.pricelistUpdate)}</h2><table class="ptbl"><tbody>${m.variants.map(v => `<tr><th>${E(v.name)}</th><td>${rp(v.price)}</td></tr>`).join('')}</tbody></table></div>
<div><h2>Spesifikasi ringkas</h2><table class="ptbl spec"><tbody>${m.specs.map(s => `<tr><th>${E(s.k)}</th><td>${E(s.v)}</td></tr>`).join('')}</tbody></table></div></div></section>
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
  const body = `<section class="pagehead"><div class="wrap"><nav class="crumb"><a href="${u('/')}">Beranda</a> › Pricelist</nav><h1>Pricelist XPeng ${E(site.pricelistUpdate)}</h1><p>Harga resmi dealer, update ${E(site.pricelistUpdate)}. Hubungi kami untuk konfirmasi dan promo terbaru.</p></div></section>
<section class="section"><div class="wrap two"><div><div class="tbl"><table class="ptbl full"><thead><tr><th>Varian</th><th>Harga</th><th></th></tr></thead><tbody>${rows.map(r => `<tr><th><a href="${u('/model/' + r.m.slug + '/')}">${E(r.v.name)}</a></th><td>${rp(r.v.price)}</td><td><a class="btn sm" href="${wa('Halo, saya mau penawaran ' + r.v.name)}" rel="noopener">Tanya</a></td></tr>`).join('')}</tbody></table></div>
<p class="muted">Harga dapat berubah. Tanyakan rincian OTR sesuai kota Anda.</p>${picture('assets/img/pricelist-juli-2026.webp', 'Pricelist XPeng X9 dan G6 update Juli 2026', 'plimg', 540, 656)}</div>${leadForm}</div></section>
<section class="section"><div class="wrap narrow">${faqBlock(HOME_FAQ)}</div></section>`;
  return layout({ title: `Pricelist XPeng ${site.pricelistUpdate} | X9 dan G6`, desc: `Pricelist XPeng ${site.pricelistUpdate}: ${rows.map(r => r.v.name.replace('XPeng ', '').replace('New ', '') + ' ' + rp(r.v.price)).join(', ')}.`.slice(0, 160), path: '/pricelist/', body, image: 'assets/img/pricelist-juli-2026.webp', ld: [crumbs([['Beranda', '/'], ['Pricelist', '/pricelist/']]), faqLd(HOME_FAQ)] });
}

function contact() {
  const body = `<section class="pagehead"><div class="wrap"><nav class="crumb"><a href="${u('/')}">Beranda</a> › Test Drive</nav><h1>Test Drive XPeng</h1><p>Coba langsung XPeng X9 atau G6. Isi formulir, kami hubungi lewat WhatsApp.</p></div></section><section class="section"><div class="wrap two">${leadForm}<div><h2>Hubungi dealer</h2><p>${E(site.dealer)}<br>${E(site.address)}<br>${E(site.phone)}</p><a class="btn" href="${wa('Halo, saya mau test drive XPeng')}" rel="noopener">Chat WhatsApp</a></div></div></section>`;
  return layout({ title: 'Test Drive XPeng X9 dan G6 | Jadwalkan Sekarang', desc: 'Jadwalkan test drive XPeng X9 atau G6 di showroom. Isi formulir singkat dan konsultan kami menghubungi lewat WhatsApp.', path: '/kontak/', body, ld: [crumbs([['Beranda', '/'], ['Test Drive', '/kontak/']])] });
}

function articleIndex() {
  const body = `<section class="pagehead"><div class="wrap"><nav class="crumb"><a href="${u('/')}">Beranda</a> › Artikel</nav><h1>Artikel dan Panduan Mobil Listrik</h1><p>Tips memilih, merawat, dan mengisi daya mobil listrik premium.</p></div></section><section class="section"><div class="wrap agrid">${articles.length ? articles.map(artCard).join('') : '<p>Belum ada artikel.</p>'}</div></section>`;
  return layout({ title: 'Artikel Mobil Listrik XPeng | Panduan dan Tips', desc: 'Panduan memilih mobil listrik, harga XPeng, dan tips charging dari tim dealer XPeng. Ditulis orisinal dan diperbarui rutin.', path: '/artikel/', body, ld: [crumbs([['Beranda', '/'], ['Artikel', '/artikel/']])] });
}

function articlePage(a) {
  const p = '/artikel/' + a.slug + '/';
  let html = MD.render(a.body); html = autoLink(html, p); html = fixLinks(html);
  const toc = [...a.body.matchAll(/^##\s+(.*)$/gm)].map(m => `<li><a href="#${MD.slug(m[1])}">${E(m[1])}</a></li>`).join('');
  const rel = articles.filter(x => x.slug !== a.slug).slice(0, 2);
  const body = `<article class="art"><header class="wrap narrow"><nav class="crumb"><a href="${u('/')}">Beranda</a> › <a href="${u('/artikel/')}">Artikel</a></nav><span class="eyebrow">${E(a.category || 'Artikel')}</span><h1>${E(a.title)}</h1><p class="muted">Diperbarui <time datetime="${a.date}">${a.date}</time> • Ditulis oleh tim ${E(site.dealer)}</p></header>
${a.image ? `<div class="wrap narrow">${picture(a.image, a.imageAlt, 'artimg', 800, 500, false)}</div>` : ''}
<div class="wrap narrow prose">${toc ? `<nav class="toc" aria-label="Daftar isi"><b>Daftar isi</b><ol>${toc}</ol></nav>` : ''}${html}
<div class="cta-box"><h2>Tertarik dengan XPeng?</h2><p>Konsultasi gratis harga, cicilan, dan jadwal test drive.</p><a class="btn" href="${wa('Halo, saya baca artikel: ' + a.title)}" rel="noopener">Chat WhatsApp</a></div></div>
${rel.length ? `<div class="wrap"><h2>Baca juga</h2><div class="agrid">${rel.map(artCard).join('')}</div></div>` : ''}</article>`;
  const ld = [crumbs([['Beranda', '/'], ['Artikel', '/artikel/'], [a.title, p]]), { '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description: a.description, image: a.image ? [abs(a.image)] : undefined, datePublished: a.date, dateModified: a.date, author: { '@type': 'Organization', name: site.dealer }, publisher: { '@type': 'Organization', name: site.dealer, logo: { '@type': 'ImageObject', url: abs('assets/img/logo.svg') } }, mainEntityOfPage: abs(p) }, faqLd(MD.faq(a.body))];
  return layout({ title: a.title, desc: a.description, path: p, body, image: a.image, type: 'article', ld });
}

function notFound() {
  return layout({ title: 'Halaman tidak ditemukan | XPeng', desc: 'Halaman yang Anda cari tidak ditemukan. Kembali ke beranda XPeng.', path: '/404.html', noindex: true, body: `<section class="pagehead"><div class="wrap"><h1>Halaman tidak ditemukan</h1><p>Coba kembali ke <a href="${u('/')}">beranda</a> atau lihat <a href="${u('/model/')}">model kami</a>.</p></div></section>` });
}

/* ---------- jalankan ---------- */
out['index.html'] = home(); out['model/index.html'] = modelIndex(); out['pricelist/index.html'] = pricelist(); out['kontak/index.html'] = contact();
out['artikel/index.html'] = articleIndex(); out['404.html'] = notFound();
models.forEach(m => out['model/' + m.slug + '/index.html'] = modelPage(m));
articles.forEach(a => out['artikel/' + a.slug + '/index.html'] = articlePage(a));
// bersihkan folder hasil lama
['model', 'artikel', 'pricelist', 'kontak'].forEach(d => fs.rmSync(path.join(ROOT, d), { recursive: true, force: true }));
Object.entries(out).forEach(([f, h]) => { const fp = path.join(ROOT, f); fs.mkdirSync(path.dirname(fp), { recursive: true }); fs.writeFileSync(fp, h); });

const today = new Date().toISOString().slice(0, 10);
const urls = [['/', 1.0], ['/model/', .9], ['/pricelist/', .9], ['/artikel/', .7], ['/kontak/', .8], ...models.map(m => ['/model/' + m.slug + '/', .9]), ...articles.map(a => ['/artikel/' + a.slug + '/', .7])];
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([p, pr]) => `<url><loc>${abs(p)}</loc><lastmod>${today}</lastmod><priority>${pr}</priority></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: ${BASE}/admin/\n\nUser-agent: GPTBot\nAllow: /\nUser-agent: ClaudeBot\nAllow: /\nUser-agent: PerplexityBot\nAllow: /\nUser-agent: Google-Extended\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`);
fs.writeFileSync(path.join(ROOT, 'llms.txt'), `# ${site.name}\n> ${site.description}\n\n## Model\n${models.map(m => `- [${m.name}](${abs('/model/' + m.slug + '/')}): ${m.tagline} Harga mulai ${rp(Math.min(...m.variants.map(v => v.price)))}`).join('\n')}\n\n## Harga\n- [Pricelist ${site.pricelistUpdate}](${abs('/pricelist/')}): ${models.flatMap(m => m.variants.map(v => v.name + ' ' + rp(v.price))).join('; ')}\n\n## Artikel\n${articles.map(a => `- [${a.title}](${abs('/artikel/' + a.slug + '/')}): ${a.description}`).join('\n')}\n`);
fs.writeFileSync(path.join(ROOT, 'manifest.webmanifest'), JSON.stringify({ name: site.name, short_name: 'XPeng', start_url: u('/'), display: 'standalone', background_color: '#0a0b0d', theme_color: '#0a0b0d', icons: [{ src: u('assets/img/favicon.svg'), sizes: 'any', type: 'image/svg+xml' }] }));
fs.writeFileSync(path.join(ROOT, '.nojekyll'), '');

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
fs.writeFileSync(path.join(ROOT, 'data/seo-report.json'), JSON.stringify(report, null, 1));
let hist = []; try { hist = J('seo-history.json'); } catch (e) {}
hist = hist.filter(h => h.date !== today); hist.push({ date: today, total: report.site.total, page: report.site.pageScore, article: report.site.articleScore, tech: report.site.techScore }); fs.writeFileSync(path.join(ROOT, 'data/seo-history.json'), JSON.stringify(hist.slice(-120)));
console.log('Build selesai:', Object.keys(out).length, 'halaman | Skor total', report.site.total, '| halaman', report.site.pageScore, '| artikel', report.site.articleScore, '| teknis', report.site.techScore);
