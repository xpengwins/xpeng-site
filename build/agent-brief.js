/* AGENT 1 + AGENT 2 (bagian web): ringkasan peluang konten dan traffic dari data yang SUDAH ada. FILE BARU.
   Membaca: data/riset-tren.json (Agent 6), data/gsc.json (Search Console), data/articles.json, data/keywords.json, data/seo-report.json,
            data/speed-log.json, data/sosmed-stats.json (jika ada).
   Menghasilkan: data/agent-brief.json = daftar tugas berurutan untuk konten dan SEO:
     A) judul/deskripsi yang perlu diperbaiki (tayang ada, klik nol)
     B) halaman yang hampir halaman 1 (posisi 8 sampai 30), perlu diperkuat
     C) pencarian nyata yang belum punya artikel (ide artikel baru dari data, bukan tebakan)
     D) artikel dengan skor SEO di bawah 100 + artikel menunggu terbit
   Dikirim ke Telegram tiap Senin pagi (WIB) atau saat BRIEF_FORCE=1.
   TIDAK menulis artikel dan TIDAK mengubah data lain. Artikel baru ditulis lewat Claude, lalu Anda setujui.
   Uji: node build/agent-brief.js (tanpa kirim: BRIEF_DRY=1) */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), D = f => path.join(ROOT, 'data', f);
const E = process.env, DRY = E.BRIEF_DRY === '1', FORCE = E.BRIEF_FORCE === '1';
const TG = { tok: E.TELEGRAM_BOT_TOKEN, chat: E.TELEGRAM_CHAT_ID };
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(D(f), 'utf8')); } catch (e) { return d; } };
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const STOP = new Set(['yang', 'dan', 'di', 'ke', 'untuk', 'dengan', 'dari', 'xpeng', 'mobil', 'listrik', 'harga']);
const toks = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w));
const pct = (a, b) => b ? Math.round((a - b) / b * 100) : null;

(async () => {
  try {
    const g = rd('gsc.json', null), arts = rd('articles.json', []), kws = rd('keywords.json', []), seo = rd('seo-report.json', {}), speed = rd('speed-log.json', {}), sos = rd('sosmed-stats.json', {});
    const brief = { generated: new Date().toISOString(), traffic: null, A_perbaiki_judul: [], B_dorong_ke_halaman_1: [], C_ide_artikel_dari_data: [], D_kualitas: {}, kesehatan: {} };

    if (g && g.rows) {
      const t = g.totals, p = g.prevTotals;
      brief.traffic = { periode: g.period, klik: t.clicks, tayang: t.impr, posisi: t.pos, perubahanKlik: p.clicks ? pct(t.clicks, p.clicks) : null, perubahanTayang: p.impr ? pct(t.impr, p.impr) : null, catatan: p.impr ? '' : 'Periode pembanding masih kosong (situs baru), persen perubahan belum bermakna.' };
      const byPage = {};
      g.rows.forEach(r => { const o = byPage[r.p] = byPage[r.p] || { page: r.p, clicks: 0, impr: 0, posW: 0, top: null }; o.clicks += r.clicks; o.impr += r.impr; o.posW += r.pos * r.impr; if (!o.top || r.impr > o.top.impr) o.top = r; });
      Object.values(byPage).forEach(o => { o.pos = o.impr ? +(o.posW / o.impr).toFixed(1) : 0; o.ctr = o.impr ? +(o.clicks / o.impr * 100).toFixed(1) : 0; });
      brief.A_perbaiki_judul = Object.values(byPage).filter(o => o.impr >= 3 && o.clicks === 0 && o.pos <= 20).sort((a, b) => b.impr - a.impr).slice(0, 8).map(o => ({ halaman: o.page, tayang: o.impr, posisi: o.pos, kataKunci: o.top.q, saran: 'Tulis ulang judul (30-60 karakter, keyword di depan) dan meta description yang menjawab maksud pencarian.' }));
      brief.B_dorong_ke_halaman_1 = g.rows.filter(r => r.pos >= 8 && r.pos <= 30 && r.impr >= 2).sort((a, b) => b.impr - a.impr).slice(0, 8).map(r => ({ kataKunci: r.q, halaman: r.p, tayang: r.impr, posisi: r.pos, saran: 'Perkaya bagian yang menjawab kata kunci ini, tambah link internal dari 2 sampai 3 artikel terkait.' }));
      /* ide artikel baru: pencarian nyata yang kata-katanya tidak dicakup keyword artikel mana pun */
      const kwSets = arts.map(a => new Set(toks(a.keyword + ' ' + a.title)));
      const seen = new Set();
      brief.C_ide_artikel_dari_data = g.rows.filter(r => r.impr >= 1 && toks(r.q).length >= 2).map(r => { const tk = toks(r.q); const best = Math.max(0, ...kwSets.map(s => tk.filter(w => s.has(w)).length / tk.length)); return { r, best }; })
        .filter(x => x.best < 0.6 && !seen.has(x.r.q) && seen.add(x.r.q)).sort((a, b) => b.r.impr - a.r.impr).slice(0, 8)
        .map(x => ({ kataKunci: x.r.q, tayang: x.r.impr, posisi: x.r.pos, halamanSaatIni: x.r.p, saran: 'Belum ada artikel yang membahas ini. Riset dulu, tulis orisinal, cek harga dari pricelist resmi.' }));
    } else brief.traffic = { catatan: 'data/gsc.json belum ada (secret GSC_KEY belum terisi atau belum ditarik).' };

    const riset = rd('riset-tren.json', null);
    brief.E_riset_tren = riset && riset.ide ? riset.ide.filter(x => !x.miripArtikel).slice(0, 8).map(x => ({ topik: x.topik, jenis: x.jenis, skor: x.skor, alasan: x.alasan, saranSudut: x.saranSudut, risiko: x.risiko })) : 'belum ada data (riset-tren belum jalan)';
    const scored = (seo.articles || []), low = scored.filter(a => a.status === 'published' && a.score < 100).map(a => ({ slug: a.slug, skor: a.score, saran: (a.checks || []).filter(c => !c.pass).map(c => c.tip || c.label).slice(0, 3) }));
    const sched = arts.filter(a => a.status === 'scheduled' && a.publishAt).sort((a, b) => Date.parse(a.publishAt) - Date.parse(b.publishAt));
    brief.D_kualitas = { skorSitus: seo.site && seo.site.total, artikelDibawah100: low, terbit: arts.filter(a => a.status === 'published').length, terjadwal: sched.length, terbitBerikutnya: sched[0] ? sched[0].publishAt : null, terjadwalHabis: sched.length ? sched[sched.length - 1].publishAt : null, linkRusak: (seo.broken || []).length };
    brief.kesehatan = { kecepatan: speed.latest ? { error: speed.latest.errors, lambat: speed.latest.slow, masalah: speed.latest.issueText || [] } : 'belum ada data (monitor-speed belum jalan)', sosmed: sos.issues ? sos.issues : 'belum ada data (monitor-sosmed belum jalan)' };

    if (!DRY) fs.writeFileSync(D('agent-brief.json'), JSON.stringify(brief, null, 1));
    console.log('Brief: A=' + brief.A_perbaiki_judul.length + ' B=' + brief.B_dorong_ke_halaman_1.length + ' C=' + brief.C_ide_artikel_dari_data.length + ' | artikel di bawah 100: ' + low.length + ' | terjadwal: ' + sched.length);

    /* kirim Telegram: Senin 06:00-09:59 WIB (build jalan tiap jam, kirim sekali per minggu) */
    const wib = new Date(Date.now() + 7 * 36e5), isMon = wib.getUTCDay() === 1 && wib.getUTCHours() >= 6 && wib.getUTCHours() < 10, wk = wib.toISOString().slice(0, 10);
    const state = rd('agent-brief-sent.json', {});
    if (!DRY && TG.tok && TG.chat && (FORCE || (isMon && state.week !== wk))) {
      const tr = brief.traffic || {}, L = [];
      L.push('📊 <b>Ringkasan mingguan xpengwins.com</b>');
      if (tr.klik != null) L.push('\nSearch Console (' + (tr.periode || []).join(' s/d ') + '): ' + tr.klik + ' klik, ' + tr.tayang + ' tayang, posisi rata-rata ' + tr.posisi + (tr.catatan ? '\n<i>' + esc(tr.catatan) + '</i>' : ''));
      else L.push('\n' + esc(tr.catatan || ''));
      if (brief.A_perbaiki_judul.length) L.push('\n✏️ <b>Perbaiki judul/deskripsi</b> (tayang ada, klik nol):\n' + brief.A_perbaiki_judul.slice(0, 4).map(x => '• ' + esc(x.halaman) + ' (' + x.tayang + ' tayang, posisi ' + x.posisi + ')').join('\n'));
      if (brief.B_dorong_ke_halaman_1.length) L.push('\n🚀 <b>Hampir halaman 1</b>:\n' + brief.B_dorong_ke_halaman_1.slice(0, 4).map(x => '• ' + esc(x.kataKunci) + ' (posisi ' + x.posisi + ')').join('\n'));
      if (brief.C_ide_artikel_dari_data.length) L.push('\n💡 <b>Ide artikel dari pencarian nyata</b>:\n' + brief.C_ide_artikel_dari_data.slice(0, 4).map(x => '• ' + esc(x.kataKunci)).join('\n'));
      if (Array.isArray(brief.E_riset_tren) && brief.E_riset_tren.length) { const base = String((rd('site.json', {}).baseUrl) || '').replace(/\/$/, ''); L.push('\n🔥 <b>Saran topik (riset, 70% niche inti : 30% luas)</b>:\n' + brief.E_riset_tren.slice(0, 5).map(x => '• ' + esc(x.topik) + ' [' + x.jenis + ']').join('\n') + (base ? '\nDaftar lengkap: ' + esc(base) + '/admin/saran.html' : '')); }
      L.push('\n📝 Artikel terbit ' + brief.D_kualitas.terbit + ', terjadwal ' + brief.D_kualitas.terjadwal + (brief.D_kualitas.terjadwalHabis ? ' (jadwal habis ' + brief.D_kualitas.terjadwalHabis.slice(0, 10) + ')' : '') + '. Skor SEO situs ' + brief.D_kualitas.skorSitus + '.');
      try {
        const r = await fetch((E.TG_BASE || 'https://api.telegram.org') + '/bot' + TG.tok + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TG.chat, text: L.join('\n').slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true }) });
        if (r.ok) fs.writeFileSync(D('agent-brief-sent.json'), JSON.stringify({ week: wk, at: new Date().toISOString() })); else console.log('Brief: Telegram ' + r.status);
      } catch (e) { console.log('Brief: Telegram gagal'); }
    }
  } catch (e) { console.log('Brief: gagal (diabaikan): ' + String(e.message).split(TG.tok || '\u0000').join('***')); }
})();
