/* Mesin penilaian SEO / AEO / GEO untuk artikel. Skor 0-100. */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(require('./md.js')); else root.SEO = f(root.MD); })(this, function (MD) {
  const words = t => (t.toLowerCase().match(/[a-z0-9À-ɏ]+/g) || []);
  const sents = t => t.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 3);
  const trigrams = ws => { const s = new Set(); for (let i = 0; i < ws.length - 2; i++) s.add(ws[i] + ' ' + ws[i + 1] + ' ' + ws[i + 2]); return s; };

  function scoreArticle(a, all) {
    const body = a.body || '', kw = (a.keyword || '').toLowerCase().trim(), title = a.title || '', desc = a.description || '';
    const plain = MD.strip(body), ws = words(plain), n = ws.length, plainL = plain.toLowerCase();
    const kwCount = kw ? (plainL.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length : 0;
    const dens = n ? (kwCount * kw.split(/\s+/).length / n) * 100 : 0;
    const h2 = (body.match(/^##\s+.*$/gm) || []); const h1 = (body.match(/^#\s+.*$/gm) || []);
    const internal = (body.match(/\]\(\/[^)]*\)/g) || []).length;
    const external = (body.match(/\]\(https?:[^)]*\)/g) || []).length;
    const imgs = [...body.matchAll(/!\[([^\]]*)\]\(/g)]; const imgNoAlt = imgs.filter(m => !m[1].trim()).length;
    const faq = MD.faq(body); const first = words(plain.slice(0, 600)).join(' ');
    const ss = sents(plain); const avgS = ss.length ? ws.length / ss.length : 0;
    const paras = body.split(/\n\s*\n/).filter(p => !/^(#|\||[-*]\s|\d+\.)/.test(p.trim()) && p.trim()); const longP = paras.filter(p => words(p).length > 90).length;
    const hasAnswer = /^\*\*(jawaban singkat|ringkasan|intinya)/i.test(body.trim());
    const hasTable = /^\|.*\|\s*$/m.test(body); const hasList = /^([-*]|\d+\.)\s+/m.test(body);
    // keunikan: overlap trigram dengan artikel lain
    let maxOverlap = 0; const tg = trigrams(ws);
    (all || []).forEach(o => { if (o.slug === a.slug) return; const t2 = trigrams(words(MD.strip(o.body || ''))); let c = 0; tg.forEach(x => { if (t2.has(x)) c++; }); const r = tg.size ? c / tg.size : 0; if (r > maxOverlap) maxOverlap = r; });

    const C = []; // [grup, label, poin, maks, saran]
    const add = (g, label, ok, pts, max, tip) => C.push({ group: g, label, pass: ok >= 1, points: Math.round(pts * ok * 10) / 10, max: pts, tip: ok >= 1 ? '' : tip });
    const kwl = kw.toLowerCase();
    add('Judul', 'Panjang judul 30-60 karakter', title.length >= 30 && title.length <= 60 ? 1 : 0, 8, 8, 'Judul sekarang ' + title.length + ' karakter. Buat 30-60.');
    add('Judul', 'Keyword ada di judul', kw && title.toLowerCase().includes(kwl) ? 1 : 0, 8, 8, 'Masukkan keyword utama di awal judul.');
    add('Meta', 'Meta description 120-160 karakter', desc.length >= 120 && desc.length <= 160 ? 1 : 0, 6, 6, 'Deskripsi sekarang ' + desc.length + ' karakter. Buat 120-160.');
    add('Meta', 'Keyword ada di deskripsi', kw && desc.toLowerCase().includes(kwl) ? 1 : 0, 4, 4, 'Masukkan keyword di meta description.');
    add('URL', 'Slug pendek (maks 70) dan mengandung kata kunci', a.slug && a.slug.length <= 70 && kw && kwl.split(' ').some(w => w.length > 3 && a.slug.includes(w)) ? 1 : 0, 4, 4, 'Pakai slug pendek yang memuat keyword.');
    add('Isi', 'Panjang artikel minimal 800 kata', n >= 800 ? 1 : n >= 500 ? 0.5 : 0, 10, 10, 'Sekarang ' + n + ' kata. Target 800+ kata.');
    add('Isi', 'Keyword di 100 kata pertama', kw && first.includes(kwl) ? 1 : 0, 6, 6, 'Sebut keyword di paragraf pembuka.');
    add('Isi', 'Kepadatan keyword 0,5-2,5%', dens >= 0.5 && dens <= 2.5 ? 1 : (dens > 0 && dens < 3.5 ? 0.5 : 0), 6, 6, 'Kepadatan ' + dens.toFixed(2) + '%. Wajar di 0,5-2,5%.');
    add('Struktur', 'Minimal 3 subjudul H2', h2.length >= 3 ? 1 : h2.length ? 0.5 : 0, 6, 6, 'Pecah isi dengan 3+ subjudul (##).');
    add('Struktur', 'Keyword ada di salah satu H2', kw && h2.some(h => h.toLowerCase().includes(kwl.split(' ')[0])) ? 1 : 0, 3, 3, 'Pakai keyword/variasinya di satu H2.');
    add('Struktur', 'Tidak ada H1 ganda di isi (H1 = judul)', h1.length === 0 ? 1 : 0, 3, 3, 'Hapus # di isi, judul otomatis jadi H1.');
    add('Link', 'Minimal 3 internal link', internal >= 3 ? 1 : internal ? 0.5 : 0, 7, 7, 'Tambah link ke model, pricelist, atau artikel lain. Sekarang ' + internal + '.');
    add('Link', 'Minimal 1 link keluar ke sumber terpercaya', external >= 1 ? 1 : 0, 3, 3, 'Tambah 1 link ke sumber resmi.');
    add('Media', 'Gambar utama + alt text', a.image && a.imageAlt ? 1 : 0, 4, 4, 'Isi gambar utama dan teks alt.');
    add('Media', 'Semua gambar di isi punya alt', imgNoAlt === 0 ? 1 : 0, 2, 2, imgNoAlt + ' gambar tanpa alt.');
    add('Keterbacaan', 'Kalimat rata-rata maks 20 kata', avgS && avgS <= 20 ? 1 : avgS <= 26 ? 0.5 : 0, 4, 4, 'Rata-rata ' + avgS.toFixed(1) + ' kata/kalimat. Pendekkan.');
    add('Keterbacaan', 'Tidak ada paragraf lebih dari 90 kata', longP === 0 ? 1 : 0, 3, 3, longP + ' paragraf terlalu panjang.');
    add('AEO', 'Ada jawaban singkat di awal (**Jawaban singkat:**)', hasAnswer ? 1 : 0, 5, 5, 'Awali artikel dengan **Jawaban singkat:** 1-2 kalimat.');
    add('AEO', 'Ada FAQ minimal 3 pertanyaan', faq.length >= 3 ? 1 : faq.length ? 0.5 : 0, 5, 5, 'Tambah bagian "## Pertanyaan yang sering diajukan" dengan ### per pertanyaan.');
    add('GEO', 'Ada list atau tabel (mudah dikutip AI)', hasList || hasTable ? 1 : 0, 3, 3, 'Tambah daftar atau tabel ringkas.');
    add('Orisinal', 'Kemiripan dengan artikel lain di bawah 30%', maxOverlap < 0.3 ? 1 : 0, 5, 5, 'Mirip ' + Math.round(maxOverlap * 100) + '% dengan artikel lain. Tulis ulang.');
    const total = C.reduce((s, c) => s + c.max, 0), got = C.reduce((s, c) => s + c.points, 0);
    const score = Math.round(got / total * 100);
    return { score, grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 65 ? 'C' : 'D', words: n, density: +dens.toFixed(2), internal, external, faq: faq.length, overlap: +(maxOverlap * 100).toFixed(0), checks: C };
  }

  /* Cek teknis halaman HTML hasil build */
  function scorePage(html, url, imgKB) {
    const g = r => (html.match(r) || [])[1] || '';
    const title = g(/<title>([^<]*)<\/title>/), desc = g(/<meta name="description" content="([^"]*)"/);
    const C = []; const add = (label, ok, pts, tip) => C.push({ label, pass: !!ok, max: pts, points: ok ? pts : 0, tip: ok ? '' : tip });
    add('Title 30-60 karakter', title.length >= 30 && title.length <= 62, 15, 'Title ' + title.length + ' karakter');
    add('Meta description 110-160', desc.length >= 110 && desc.length <= 165, 15, 'Description ' + desc.length + ' karakter');
    add('Tepat satu H1', (html.match(/<h1[ >]/g) || []).length === 1, 15, 'Harus tepat 1 H1');
    add('Canonical ada', /rel="canonical"/.test(html), 10, 'Tambah canonical');
    add('Open Graph ada', /og:title/.test(html) && /og:image/.test(html), 10, 'Tambah og:title/og:image');
    add('Structured data (JSON-LD)', /application\/ld\+json/.test(html), 15, 'Tambah schema');
    add('Semua gambar punya alt', !/<img(?![^>]*\balt=)[^>]*>/.test(html), 10, 'Ada gambar tanpa alt');
    add('Viewport mobile', /name="viewport"/.test(html), 5, 'Tambah viewport');
    add('Ukuran gambar wajar (<250KB)', imgKB <= 250, 5, 'Ada gambar besar');
    const total = C.reduce((s, c) => s + c.max, 0), got = C.reduce((s, c) => s + c.points, 0);
    return { url, score: Math.round(got / total * 100), checks: C };
  }
  return { scoreArticle, scorePage, words, sents };
});
