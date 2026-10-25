/* AGENT 6: riset topik tren sesuai niche (XPeng, mobil listrik + sedikit otomotif umum). FILE BARU.
   Hasilnya hanya SARAN untuk halaman admin (admin/saran.html). Tidak menulis artikel, tidak mengubah sistem lain.
   Sumber gratis tanpa kunci API:
     1) Google News RSS     -> berita 14 hari terakhir (topik "ramai" = banyak media membahas)
     2) Google Trends RSS   -> pencarian yang sedang naik di Indonesia, disaring hanya yang nyambung
     3) Google Autocomplete -> pertanyaan dan kata kunci panjang yang benar-benar diketik orang
   KOMPOSISI 70:30  -> 70% niche inti (XPeng, mobil listrik, SPKLU, baterai, pajak EV, pesaing EV)
                       30% niche luas (otomotif umum: merawat mobil, asuransi, kredit, hybrid, mudik, BBM)
   JADWAL: otomatis 1x seminggu (hari Senin WIB, pada run pertama hari itu) tanpa diperintah.
           Run pertama kali (belum ada data) juga langsung jalan. Paksa: RISET_FORCE=1.
   ATURAN KONTEN: hanya mengumpulkan IDE + tautan sumber (judul pendek). Isi berita TIDAK disalin.
   Artikel ditulis ulang orisinal dari data resmi. Harga hanya dari pricelist resmi.
   Aman: sumber yang gagal dilewati, error tidak menggagalkan workflow, tanpa secret tetap jalan.
   Uji tanpa internet: RISET_FIXTURE=folder_contoh node build/riset-tren.js  (RISET_DRY=1 = tanpa menulis file) */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), D = f => path.join(ROOT, 'data', f);
const E = process.env, DRY = E.RISET_DRY === '1', FIX = E.RISET_FIXTURE || '', FORCE = E.RISET_FORCE === '1';
const TG = { tok: E.TELEGRAM_BOT_TOKEN, chat: E.TELEGRAM_CHAT_ID };
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(D(f), 'utf8')); } catch (e) { return d; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const scrub = m => [TG.tok].filter(Boolean).reduce((s, t) => s.split(t).join('***'), String(m));

/* ---- pengaturan (bisa ditimpa lewat data/riset-tren-config.json bila file itu dibuat) ---- */
const CFG = Object.assign({
  /* niche INTI */
  coreWords: ['xpeng', 'mobil listrik', 'kendaraan listrik', 'motor listrik', 'ev', 'spklu', 'baterai', 'charging', 'pengisian daya', 'byd', 'denza', 'ioniq', 'tesla', 'zeekr', 'vinfast', 'v2l', '800v'],
  coreNews: ['xpeng indonesia', 'xpeng x9', 'xpeng g6', 'mobil listrik', 'spklu', 'pajak mobil listrik', 'baterai mobil listrik', 'mobil listrik keluarga', 'denza d9', 'byd indonesia'],
  coreSeeds: ['xpeng x9', 'xpeng g6', 'harga xpeng', 'mobil listrik', 'spklu', 'mobil listrik 7 seater'],
  coreMods: ['apakah', 'berapa', 'cara', 'vs', 'kelebihan', 'kekurangan', 'bisa', 'kenapa', 'biaya', 'pajak', 'cicilan', 'garansi', 'servis'],
  /* niche LUAS (otomotif umum yang masih dekat dengan calon pembeli mobil) */
  broadWords: ['mobil', 'kendaraan', 'otomotif', 'berkendara', 'bbm', 'hybrid', 'suv', 'mpv', 'sedan', 'mudik', 'nataru', 'asuransi', 'kredit', 'leasing', 'servis', 'ban ', 'aki ', 'stnk', 'pajak kendaraan', 'wuling', 'chery', 'geely', 'hyundai', 'toyota', 'honda', 'mitsubishi'],
  broadNews: ['tips merawat mobil', 'asuransi mobil', 'kredit mobil bunga', 'mobil hybrid', 'mobil keluarga 7 seater', 'tips mudik mobil', 'bbm subsidi mobil', 'tren otomotif indonesia'],
  broadSeeds: ['tips merawat mobil', 'asuransi mobil', 'kredit mobil', 'mobil hybrid', 'mobil keluarga'],
  broadMods: ['apakah', 'berapa', 'cara', 'biaya', 'tips'],
  ratio: { inti: 70, luas: 30 }, top: 20, maxAgeDays: 14,
  weekly: true,        /* true = hanya update tiap Senin WIB. false = tiap run. */
  hotAlert: false      /* true = kirim Telegram untuk topik panas. Default mati (admin saja). */
}, rd('riset-tren-config.json', {}));
const SENSITIF = /kecelakaan|tewas|korban|kebakaran|terbakar|meledak|recall|penipuan|gugat|skandal|bangkrut|phk|banjir/i;
const STOP = new Set(['yang', 'dan', 'di', 'ke', 'untuk', 'dengan', 'dari', 'ini', 'itu', 'apa', 'ada', 'akan', 'pada', 'atau', 'oleh', 'dalam', 'jadi', 'bisa', 'tahun', 'xpeng', 'mobil', 'listrik', 'harga']);
const toks = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && w.length > 1 && !STOP.has(w));
const overlap = (a, b) => { const A = new Set(a); if (!A.size) return 0; return a.filter(w => b.has(w)).length / A.size; };
const mkRe = list => list.map(w => w.length <= 3 ? new RegExp('(^|[^a-z0-9])' + w + '([^a-z0-9]|$)', 'i') : new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
const CORE_RE = mkRe(CFG.coreWords), BROAD_RE = mkRe(CFG.broadWords);
/* kelompok teks: 'inti' / 'luas' / null (di luar niche) */
const grp = s => { const t = String(s); if (CORE_RE.some(r => r.test(t))) return 'inti'; if (BROAD_RE.some(r => r.test(t))) return 'luas'; return null; };
const decode = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
const tag = (x, n) => { const m = x.match(new RegExp('<' + n + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + n + '>', 'i')); return m ? decode(m[1]) : ''; };

async function getText(url, kind) {
  if (FIX) { const f = { news: 'news.xml', trends: 'trends.xml', suggest: 'suggest.json' }[kind]; return fs.readFileSync(path.join(FIX, f), 'utf8'); }
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(25000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; xpeng-riset/1.0)', 'Accept-Language': 'id-ID,id;q=0.9' } });
      if (r.ok) return await r.text();
      if (r.status === 429) await sleep(5000 * (i + 1));
    } catch (e) { await sleep(2000); }
  }
  throw new Error('gagal ambil ' + kind);
}
async function tgSend(text) {
  const r = await fetch((E.TG_BASE || 'https://api.telegram.org') + '/bot' + TG.tok + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TG.chat, text: text.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true }) });
  if (!r.ok) throw new Error('Telegram ' + r.status);
}

/* ---- 1) berita ---- */
async function newsItems() {
  const out = [], seen = new Set(), now = Date.now();
  for (const q of [...CFG.coreNews, ...CFG.broadNews]) {
    try {
      const xml = await getText('https://news.google.com/rss/search?q=' + encodeURIComponent(q + ' when:14d') + '&hl=id&gl=ID&ceid=ID:id', 'news');
      for (const it of xml.split(/<item>/i).slice(1)) {
        let title = tag(it, 'title'), src = tag(it, 'source'), link = tag(it, 'link'), at = Date.parse(tag(it, 'pubDate'));
        if (src && title.endsWith(' - ' + src)) title = title.slice(0, -(src.length + 3));
        const g = grp(title);
        if (!title || !isFinite(at) || now - at > CFG.maxAgeDays * 864e5 || !g) continue;
        const k = title.toLowerCase().slice(0, 70); if (seen.has(k)) continue; seen.add(k);
        out.push({ title, src: src || 'media', link, at, q, g });
      }
    } catch (e) { console.log('Riset: berita "' + q + '" gagal'); }
    if (!FIX) await sleep(700);
  }
  return out;
}
/* kelompokkan berita yang membahas hal yang sama (kata kunci banyak yang sama) */
function cluster(items) {
  const cl = [];
  items.forEach(it => {
    const t = new Set(toks(it.title)); let best = null, bs = 0;
    cl.forEach(c => { const s = overlap([...t], c.tokens); if (s > bs) { bs = s; best = c; } });
    if (best && bs >= 0.5) { best.items.push(it); t.forEach(w => best.tokens.add(w)); } else cl.push({ tokens: t, items: [it] });
  });
  return cl;
}

/* ---- 2) tren harian ---- */
async function trendItems() {
  try {
    const xml = await getText('https://trends.google.com/trending/rss?geo=ID', 'trends');
    return xml.split(/<item>/i).slice(1).map(it => {
      const title = tag(it, 'title'), tr = tag(it, 'ht:approx_traffic'), news = [...it.matchAll(/<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>/gi)].map(m => decode(m[1])), links = [...it.matchAll(/<ht:news_item_url>([\s\S]*?)<\/ht:news_item_url>/gi)].map(m => decode(m[1]));
      const own = grp(title), viaNews = news.map(grp).find(Boolean) || null;
      return { title, traffic: parseInt(String(tr).replace(/\D/g, ''), 10) || 0, news, link: links[0] || '', g: own || viaNews, tipis: !own };
    }).filter(t => t.title && t.g);
  } catch (e) { console.log('Riset: Google Trends gagal'); return []; }
}

/* ---- 3) pertanyaan nyata dari autocomplete ---- */
async function suggestItems() {
  const out = [], seen = new Set(), qs = [];
  [[CFG.coreSeeds, CFG.coreMods], [CFG.broadSeeds, CFG.broadMods]].forEach(([seeds, mods]) => seeds.forEach(s => { qs.push({ q: s, seed: s, mod: '' }); mods.forEach(m => qs.push({ q: s + ' ' + m, seed: s, mod: m })); }));
  let fails = 0;
  for (const x of qs) {
    if (fails >= 6) { console.log('Riset: autocomplete berhenti (terlalu banyak gagal)'); break; }
    try {
      const j = JSON.parse(await getText('https://suggestqueries.google.com/complete/search?client=firefox&hl=id&gl=id&q=' + encodeURIComponent(x.q), 'suggest'));
      (j[1] || []).forEach((p, rank) => { const k = String(p).toLowerCase().trim(), g = grp(k); if (!k || seen.has(k) || k === x.q || !g) return; seen.add(k); out.push({ phrase: k, rank, seed: x.seed, mod: x.mod, g }); });
    } catch (e) { fails++; }
    if (FIX) break;
    await sleep(250);
  }
  return out;
}

(async () => {
  try {
    const prev = rd('riset-tren.json', {}), wib = new Date(Date.now() + 7 * 36e5), wk = wib.toISOString().slice(0, 10);
    /* jadwal mingguan: Senin WIB, sekali per minggu. Tanpa data sebelumnya = langsung jalan. */
    if (CFG.weekly && !FORCE && prev.ide && prev.ide.length) {
      const due = wib.getUTCDay() === 1 && prev.week !== wk;
      if (!due) return console.log('Riset: belum waktunya (update tiap Senin WIB, terakhir ' + String(prev.generated || '-').slice(0, 10) + ').');
    }
    const arts = rd('articles.json', []), gsc = rd('gsc.json', { rows: [] });
    const have = arts.map(a => new Set(toks((a.keyword || '') + ' ' + (a.title || ''))));
    const covered = t => have.some(s => overlap(t, s) >= 0.7);
    const similar = t => { let best = { s: 0, slug: '' }; have.forEach((set, i) => { const shared = t.filter(w => set.has(w)).length, v = shared >= 2 ? overlap(t, set) : 0; if (v > best.s) best = { s: v, slug: arts[i].slug }; }); return best; };
    const now = Date.now(), cand = [], today = new Date().toISOString().slice(0, 10);

    const [news, trends, sug] = await Promise.all([newsItems(), trendItems(), suggestItems()]);
    console.log('Riset: berita ' + news.length + ', tren niche ' + trends.length + ', saran pencarian ' + sug.length);
    if (!news.length && !trends.length && !sug.length) { console.log('Riset: tidak ada data dari sumber, file lama dipertahankan.'); return; }

    cluster(news).forEach(c => {
      const srcs = new Set(c.items.map(i => i.src)), newest = Math.max(...c.items.map(i => i.at)), ageD = (now - newest) / 864e5;
      const rep = c.items.slice().sort((a, b) => b.at - a.at)[0], g = c.items.some(i => i.g === 'inti') ? 'inti' : 'luas';
      const score = Math.min(srcs.size, 6) * 10 + (ageD <= 2 ? 15 : ageD <= 7 ? 8 : 0) + 5 + (/xpeng/i.test(rep.title) ? 15 : 0);
      cand.push({ jenis: 'berita', kelompok: g, topik: rep.title, skor: score, alasan: srcs.size + ' media membahas dalam ' + CFG.maxAgeDays + ' hari, terbaru ' + (ageD < 1 ? 'hari ini' : Math.round(ageD) + ' hari lalu'), umurHari: +ageD.toFixed(1), jumlahMedia: srcs.size, sumber: c.items.slice(0, 4).map(i => ({ judul: i.title.slice(0, 90), media: i.src, link: i.link, tanggal: new Date(i.at).toISOString().slice(0, 10) })), _t: toks(rep.title) });
    });
    trends.forEach(t => cand.push({ tipis: t.tipis, jenis: 'tren', kelompok: t.g, topik: t.title, skor: 40 + Math.round(Math.log10(Math.max(t.traffic, 10)) * 5) + (/xpeng/i.test(t.title) ? 15 : 0), alasan: 'sedang naik di Google Trends Indonesia' + (t.traffic ? ' (sekitar ' + t.traffic + '+ pencarian)' : ''), sumber: [{ judul: (t.news[0] || t.title).slice(0, 90), media: 'Google Trends', link: t.link, tanggal: today }], _t: toks(t.title) }));
    sug.forEach(s => cand.push({ jenis: 'pencarian', kelompok: s.g, topik: s.phrase, skor: 30 - Math.min(s.rank, 8) * 2 + (s.mod ? 6 : 0) + (/\b(apakah|berapa|cara|kenapa|bisa)\b/.test(s.phrase) ? 10 : 0), alasan: 'diketik orang di kolom pencarian Google (berpotensi jadi FAQ/jawaban singkat)', sumber: [{ judul: 'saran pencarian Google untuk "' + s.seed + (s.mod ? ' ' + s.mod : '') + '"', media: 'Google Autocomplete', link: '', tanggal: today }], _t: toks(s.phrase) }));

    /* buang yang sudah punya artikel, gabungkan yang mirip, tandai catatan risiko */
    const gscQ = new Set((gsc.rows || []).map(r => r.q.toLowerCase())), old = new Set((prev.ide || []).map(x => x.topik.toLowerCase()));
    const picked = [];
    cand.filter(c => c._t.length && !covered(c._t)).sort((a, b) => b.skor - a.skor).forEach(c => {
      if (picked.some(p => overlap(c._t, new Set(p._t)) >= 0.6)) return;
      c.sudahAdaDiSearchConsole = [...gscQ].some(q => overlap(c._t, new Set(toks(q))) >= 0.7);
      c.baru = !old.has(c.topik.toLowerCase());
      const r = [], sm = similar(c._t);
      if (sm.s >= 0.5) { c.skor -= 15; c.miripArtikel = sm.slug; r.push('Mirip artikel yang sudah ada (' + sm.slug + '). Perbarui artikel itu, jangan buat duplikat agar tidak saling bersaing di Google.'); }
      if (c.tipis) { c.skor -= 20; r.push('Relevansi tipis: topik ini nyambung ke niche hanya lewat berita terkait. Pakai hanya jika ada sudut yang jelas untuk calon pembeli.'); }
      if (SENSITIF.test(c.topik)) r.push('Topik sensitif: tulis netral, jangan menyudutkan merek, rujuk sumber resmi.');
      if (/harga|rp\s?\d|cicil|dp\b|bunga|premi/i.test(c.topik)) r.push('Ada unsur harga/angka: pakai pricelist atau sumber resmi, jangan angka dari berita.');
      if (/vs|banding|lebih baik|terbaik/i.test(c.topik)) r.push('Klaim perbandingan wajib bersumber dan tulis standar pengujian (NEDC/WLTP).');
      if (c.jenis === 'berita') r.push('Berita hanya pemicu ide. Tulis ulang orisinal dari data resmi, jangan salin judul atau isi.');
      c.risiko = r;
      const dasar = c.jenis === 'pencarian' ? 'Jawab langsung di Jawaban singkat, perluas jadi FAQ dan artikel panduan.' : c.jenis === 'tren' ? 'Terbitkan cepat (topik naik) dengan sudut yang membantu calon pembeli.' : 'Jelaskan dampaknya bagi calon pembeli, tambah tabel atau perbandingan, sebut tanggal data.';
      c.saranSudut = dasar + (c.kelompok === 'luas' ? ' Topik luas: tautkan ke halaman model XPeng yang relevan lewat link internal agar pembaca mengalir ke pricelist dan test drive.' : ' Hubungkan ke model XPeng yang relevan.');
      picked.push(c);
    });

    /* komposisi 70:30 (target kuota per kelompok; kekurangan diisi dari kelompok lain) */
    const sum = (CFG.ratio.inti + CFG.ratio.luas) || 100, nLuas = Math.round(CFG.top * CFG.ratio.luas / sum), nInti = CFG.top - nLuas;
    picked.sort((a, b) => b.skor - a.skor);
    const inti = picked.filter(x => x.kelompok === 'inti'), luas = picked.filter(x => x.kelompok === 'luas');
    let selInti = inti.slice(0, nInti), selLuas = luas.slice(0, nLuas);
    if (selInti.length < nInti) selLuas = luas.slice(0, nLuas + (nInti - selInti.length));
    if (selLuas.length < nLuas) selInti = inti.slice(0, nInti + (nLuas - selLuas.length));
    const ide = selInti.concat(selLuas).sort((a, b) => b.skor - a.skor).map(({ _t, tipis, ...x }) => x);

    const out = { generated: new Date().toISOString(), week: wk, sumber: { berita: news.length, tren: trends.length, pencarian: sug.length }, komposisi: { target: CFG.ratio.inti + ':' + CFG.ratio.luas, inti: ide.filter(x => x.kelompok === 'inti').length, luas: ide.filter(x => x.kelompok === 'luas').length }, catatan: 'Ini kumpulan IDE (saran). Riset ulang dan tulis orisinal sebelum terbit. Jangan salin judul/isi berita.', ide, alertTopik: prev.alertTopik || [] };

    if (CFG.hotAlert && !DRY && TG.tok && TG.chat) {
      const hot = ide.filter(x => x.jenis === 'berita' && x.jumlahMedia >= 4 && x.umurHari <= 2 && !out.alertTopik.includes(x.topik)).slice(0, 2);
      if (hot.length) { try { await tgSend('🔥 <b>Topik panas di niche XPeng</b>\n\n' + hot.map(h => '• ' + esc(h.topik) + '\n  ' + esc(h.alasan)).join('\n\n')); out.alertTopik = out.alertTopik.concat(hot.map(h => h.topik)).slice(-60); } catch (e) { console.log('Riset: Telegram gagal: ' + scrub(e.message)); } }
    }
    if (!DRY) fs.writeFileSync(D('riset-tren.json'), JSON.stringify(out, null, 1));
    console.log('Riset: ' + ide.length + ' ide, komposisi inti ' + out.komposisi.inti + ' : luas ' + out.komposisi.luas + ' (target ' + out.komposisi.target + '), ' + ide.filter(x => x.baru).length + ' baru.');
  } catch (e) { console.log('Riset: gagal (diabaikan): ' + scrub(e.message)); }
})();
