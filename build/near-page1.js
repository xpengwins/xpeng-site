/* LAPORAN "HAMPIR HALAMAN 1" + PROMPT EKSEKUSI KE TELEGRAM (jalan tiap Senin pagi, atau manual). FILE BARU.
   Sumber: data/gsc.json (Search Console). Rentang: posisi 8 sampai 20 (bawah halaman 1 dan halaman 2).
   Halaman diurutkan dari tayang terbanyak. Tiap halaman artikel/model terpilih mendapat 1 pesan Telegram berisi prompt siap tempel ke Claude;
   Claude yang menerimanya langsung mengubah file dan push ke GitHub.
   Aturan agar tidak berulang: halaman yang prompt-nya sudah dikirim dalam 14 hari tidak dikirim lagi (kecuali NEAR_FORCE=1);
   artikel yang baru diperbarui dalam 10 hari dilewati (beri waktu Google).
   Menulis: data/near-page1.json (laporan lengkap) dan data/near-page1-sent.json. Tidak mengubah data lain.
   Uji tanpa kirim: AGENT_DRY=1 node build/near-page1.js */
const U = require('./util-agent.js'), P = require('./prompt-lib.js'), SEO = require('../shared/seo.js');
const { E, rd, wr, esc, clean, wib, ymd, tgl, tg } = U;
const N = +E.NEAR_N || 3, FORCE = E.NEAR_FORCE === '1', DRY = E.AGENT_DRY === '1';

(async () => {
  try {
    const g = rd('gsc.json', null);
    if (!g || !g.rows) return console.log('Hampir halaman 1: data/gsc.json belum ada, dilewati.');
    const arts = rd('articles.json', []), models = rd('models.json', []), sent = rd('near-page1-sent.json', {}), hari = ymd(wib());
    const bad = q => /["“”]/.test(q) || q.length > 70;                       // sisa operator pencarian atau kalimat prompt AI panjang: bukan kata kunci nyata
    const by = {};
    g.rows.filter(r => r.pos >= 8 && r.pos <= 20 && !bad(r.q)).forEach(r => { (by[r.p] = by[r.p] || []).push({ q: r.q, pos: r.pos, impr: r.impr, clicks: r.clicks }); });
    const cands = Object.entries(by).map(([p, kws]) => {
      kws.sort((a, b) => b.impr - a.impr || a.pos - b.pos);
      const impr = kws.reduce((s, k) => s + k.impr, 0), best = Math.min(...kws.map(k => k.pos));
      let tipe = 'halaman', slug = '', judul = p, extra = {};
      let m;
      if ((m = p.match(/^\/artikel\/([^/]+)\/$/))) { const a = arts.find(x => x.slug === m[1]); if (a && a.status === 'published') { tipe = 'artikel'; slug = a.slug; judul = a.title; let r = null; try { r = SEO.scoreArticle(a, arts); } catch (e) {} extra = { keyword: a.keyword, skorAwal: r && r.score, kata: r && r.words, updated: a.updated || a.date }; } }
      else if ((m = p.match(/^\/model\/([^/]+)\/$/))) { const x = models.find(y => y.slug === m[1]); if (x) { tipe = 'model'; slug = x.slug; judul = x.name; } }
      return Object.assign({ page: p, tipe, slug, judul, kws, impr, best }, extra);
    }).sort((a, b) => b.impr - a.impr || a.best - b.best);

    const baruDiubah = c => c.updated && (Date.now() - Date.parse(c.updated)) / 864e5 < 10;
    const sudahKirim = c => !FORCE && sent[c.page] && (Date.now() - Date.parse(sent[c.page].at)) / 864e5 < 14;
    const pilih = cands.filter(c => (c.tipe === 'artikel' || c.tipe === 'model') && !baruDiubah(c) && !sudahKirim(c)).slice(0, N);
    const periode = g.period[0] + ' s/d ' + g.period[1];
    if (!DRY) wr('near-page1.json', { generated: new Date().toISOString(), periode: g.period, rentang: '8-20', total: cands.length, halaman: cands.map(c => ({ page: c.page, tipe: c.tipe, impr: c.impr, terbaik: c.best, kata: c.kws.slice(0, 6) })) });

    const L = ['<b>Hampir halaman 1: laporan mingguan</b>', 'Data Search Console ' + esc(periode) + '. Rentang posisi 8 sampai 20 (bawah halaman 1 dan halaman 2).'];
    if (!cands.length) L.push('\nBelum ada kata kunci di rentang ini. Biasanya muncul setelah situs lebih lama dikenal Google.');
    else {
      L.push('\n' + cands.length + ' halaman, urut dari tayang terbanyak:');
      cands.slice(0, 10).forEach((c, i) => L.push((i + 1) + '. ' + esc(c.page) + ' (' + c.impr + ' tayang)\n   ' + c.kws.slice(0, 3).map(k => '"' + esc(k.q) + '" pos ' + k.pos).join(', ') + (baruDiubah(c) ? '\n   baru diperbarui, tunggu Google memproses' : '') + (c.tipe === 'halaman' ? '\n   halaman statis: ubah lewat Admin > Halaman' : '')));
      const kecil = cands.reduce((s, c) => s + c.impr, 0) < 30;
      if (kecil) L.push('\nCatatan: datanya masih tipis (kurang dari 30 tayang seluruhnya). Perkuat dulu halaman teratas saja, jangan mengubah banyak halaman sekaligus agar efeknya terlihat jelas.');
      L.push('\n' + (pilih.length ? 'Prompt eksekusi untuk ' + pilih.length + ' halaman teratas dikirim di pesan berikutnya. Salin satu pesan, tempel ke Claude, dan Claude akan mengubah file lalu push langsung ke GitHub.' : 'Tidak ada prompt baru minggu ini (sudah dikirim dalam 14 hari terakhir atau baru diperbarui).'));
    }
    await tg(L.join('\n'));

    let i = 0;
    for (const c of pilih) {
      i++;
      const pr = P.promptPerkuat({ tipe: c.tipe, slug: c.slug, url: U.baseUrl() + c.page, keyword: c.keyword, kws: c.kws, gsc: periode, skorAwal: c.skorAwal, kata: c.kata });
      const ok = await tg('<b>Prompt ' + i + ' dari ' + pilih.length + ': ' + esc(c.page) + '</b>\n<pre>' + esc(pr) + '</pre>');
      if (ok || DRY) sent[c.page] = { at: new Date().toISOString(), pos: c.best };
    }
    if (!DRY && pilih.length) wr('near-page1-sent.json', sent);
    console.log('Hampir halaman 1: ' + cands.length + ' halaman, ' + pilih.length + ' prompt.');
  } catch (e) { console.log('Hampir halaman 1: dilewati karena error: ' + clean(e.message)); }
})();
