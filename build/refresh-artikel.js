/* PEMBARUAN ARTIKEL YANG AMAN UNTUK SEO, GEO, AEO (jalan tiap Senin pagi, atau manual). FILE BARU.
   Prinsip: tanggal "Diperbarui" hanya boleh berubah kalau isi memang berubah nyata. Mengganti beberapa kata lalu mengubah tanggal
   adalah pembaruan palsu: Google bisa mengabaikan sinyal tanggal situs, dan mesin AI menilai kesegaran dari isi, bukan dari tanggal.
   Jadi skrip ini TIDAK mengubah teks artikel. Ia melakukan dua hal:
     A) PENJAGA: membandingkan isi tiap artikel dengan catatan minggu lalu (data/refresh-log.json).
        Tanggal diperbarui tetapi isi nyaris sama = peringatan "pembaruan kosmetik" ke Telegram.
        Isi berubah banyak tetapi tanggal tidak diisi = pengingat.
     B) PEMILIH: memilih sampai 3 artikel yang paling layak disegarkan (usang, muncul di Google, bulan/tahun lama, skor belum 100,
        hampir halaman 1) lalu mengirim PROMPT EKSEKUSI ke Telegram. Claude yang menerima prompt melakukan pembaruan nyata dan push ke GitHub.
   Jeda: artikel yang diperbarui kurang dari 14 hari lalu atau sudah dikirim dalam 28 hari terakhir dilewati.
   Menulis: data/refresh-log.json dan data/refresh-sent.json saja.
   Uji tanpa kirim: AGENT_DRY=1 node build/refresh-artikel.js */
const crypto = require('crypto');
const U = require('./util-agent.js'), P = require('./prompt-lib.js'), SEO = require('../shared/seo.js');
const { E, rd, wr, esc, clean, wib, ymd, tg } = U;
const N = +E.REFRESH_N || 3, DRY = E.AGENT_DRY === '1';
const BULAN = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
const h8 = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);
const kalimat = body => String(body || '').replace(/[#*>`|_\[\]()-]/g, ' ').split(/(?<=[.!?])\s+|\n+/).map(s => s.toLowerCase().replace(/\s+/g, ' ').trim()).filter(s => s.length > 20).map(h8);
const jumlahKata = b => (String(b || '').match(/\S+/g) || []).length;
const h2 = b => (String(b || '').match(/^#{2,3} /gm) || []).length;
const umurHari = iso => (Date.now() - Date.parse(iso)) / 864e5;

(async () => {
  try {
    const arts = rd('articles.json', []), pub = arts.filter(a => a.status === 'published');
    const log = rd('refresh-log.json', null), baseline = !log, L0 = log || { dibuat: new Date().toISOString(), art: {} };
    const kosmetik = [], lupaTanggal = [];

    /* ---- A) PENJAGA ---- */
    pub.forEach(a => {
      const now = { updated: a.updated || '', words: jumlahKata(a.body), h2: h2(a.body), hashes: kalimat(a.body) }, was = L0.art[a.slug];
      if (was) {
        const A = new Set(was.hashes), B = new Set(now.hashes); let inter = 0; A.forEach(x => { if (B.has(x)) inter++; });
        const uni = A.size + B.size - inter, ubah = uni ? 1 - inter / uni : 0;
        const nyata = ubah >= 0.10 || Math.abs(now.words - was.words) >= 100 || now.h2 > was.h2;
        if (now.updated !== was.updated && !nyata) kosmetik.push({ a, ubah: Math.round(ubah * 100), selisihKata: now.words - was.words });
        if (now.updated === was.updated && nyata && ubah >= 0.10) lupaTanggal.push({ a, ubah: Math.round(ubah * 100) });
      }
      L0.art[a.slug] = now;
    });
    Object.keys(L0.art).forEach(s => { if (!pub.find(a => a.slug === s)) delete L0.art[s]; });
    if (!DRY) wr('refresh-log.json', L0);
    if (!baseline && (kosmetik.length || lupaTanggal.length)) {
      const T = ['<b>Penjaga pembaruan artikel</b>'];
      if (kosmetik.length) T.push('\n⚠ Tanggal "Diperbarui" berubah tetapi isi hampir sama (pembaruan kosmetik, berisiko dianggap pembaruan palsu oleh mesin pencari):\n' + kosmetik.map(k => '- ' + esc(k.a.slug) + ' (isi berubah ' + k.ubah + '%, selisih ' + k.selisihKata + ' kata)').join('\n') + '\nSaran: tambah isi nyata (data baru, FAQ, bagian baru) atau kembalikan tanggalnya.');
      if (lupaTanggal.length) T.push('\nIsi berubah cukup banyak tetapi tanggal "Diperbarui" belum diisi:\n' + lupaTanggal.map(k => '- ' + esc(k.a.slug) + ' (isi berubah ' + k.ubah + '%)').join('\n') + '\nIsi field "updated" agar tampilan dan JSON-LD dateModified jujur.');
      await tg(T.join('\n'));
    }
    if (baseline) console.log('Pembaruan artikel: catatan awal dibuat untuk ' + pub.length + ' artikel (penjaga aktif mulai minggu depan).');

    /* ---- B) PEMILIH ---- */
    const g = rd('gsc.json', null), gimpr = {}; if (g && g.rows) g.rows.forEach(r => { gimpr[r.p] = (gimpr[r.p] || 0) + r.impr; });
    const near = {}; (rd('near-page1.json', { halaman: [] }).halaman || []).forEach(x => { near[x.page] = x; });
    const sent = rd('refresh-sent.json', {}), nearSent = rd('near-page1-sent.json', {});
    const now = wib(), nowIdx = now.getUTCFullYear() * 12 + now.getUTCMonth(), thisYear = now.getUTCFullYear();
    const cands = [];
    pub.forEach(a => {
      const page = '/artikel/' + a.slug + '/', umur = Math.floor(umurHari(a.updated || a.date + 'T00:00:00+07:00')), alasan = []; let skor = 0;
      if (umur < 14) return; if (sent[a.slug] && umurHari(sent[a.slug].at) < 28) return;
      if (nearSent[page] && umurHari(nearSent[page].at) < 7) return;           // minggu ini sudah dapat prompt "hampir halaman 1"
      const teks = (a.title + ' ' + (a.keyword || '') + ' ' + a.body), topikHarga = /harga|cicilan|promo|pricelist|pajak|biaya/i.test(a.title + ' ' + (a.keyword || ''));
      const pakaiBulan = [...teks.matchAll(new RegExp('(' + BULAN.join('|') + ')\\s+(20\\d\\d)', 'gi'))].map(m => +m[2] * 12 + BULAN.indexOf(m[1].toLowerCase())), tua = pakaiBulan.filter(i => i <= nowIdx - 2);
      if (topikHarga && tua.length) { skor += 3; const i = Math.min(...tua); alasan.push('menyebut ' + BULAN[i % 12] + ' ' + Math.floor(i / 12) + ' pada topik harga/promo'); }
      else if (topikHarga && new RegExp('\\b' + (thisYear - 1) + '\\b').test(teks)) { skor += 2; alasan.push('menyebut tahun ' + (thisYear - 1) + ' pada topik harga/promo'); }
      if (umur >= 60) { skor += 2; alasan.push(umur + ' hari tidak diperbarui'); } else if (umur >= 30) { skor += 1; alasan.push(umur + ' hari tidak diperbarui'); }
      if (gimpr[page]) { skor += 1 + Math.min(3, Math.floor(gimpr[page] / 5)); alasan.push('sudah muncul di Google (' + gimpr[page] + ' tayang)'); }
      if (near[page]) { skor += 2; alasan.push('hampir halaman 1 (posisi ' + near[page].terbaik + ')'); }
      let r = null; try { r = SEO.scoreArticle(a, arts); } catch (e) {}
      if (r && r.score < 100) { skor += 1; alasan.push('skor SEO ' + r.score); }
      if (skor >= 2) cands.push({ slug: a.slug, url: U.baseUrl() + page, keyword: a.keyword, alasan, umur, skor, skorAwal: r ? r.score : '-', kata: r ? r.words : jumlahKata(a.body) });
    });
    cands.sort((x, y) => y.skor - x.skor || y.umur - x.umur);
    const pilih = cands.slice(0, N);
    const L = ['<b>Pembaruan artikel minggu ini</b>', 'Prinsip: hanya pembaruan nyata (fakta, data, FAQ, bagian baru). Tanggal "Diperbarui" baru boleh berubah bila isi memang berubah.'];
    if (!pilih.length) L.push('\nTidak ada artikel yang perlu disegarkan minggu ini.');
    else L.push('\nKandidat (' + cands.length + ' artikel layak, ' + pilih.length + ' teratas dikirim dengan prompt):\n' + pilih.map((c, i) => (i + 1) + '. ' + esc(c.slug) + '\n   ' + c.alasan.map(esc).join('; ')).join('\n'));
    await tg(L.join('\n'));
    let i = 0;
    for (const c of pilih) {
      i++; const ok = await tg('<b>Prompt ' + i + ' dari ' + pilih.length + ': ' + esc(c.slug) + '</b>\n<pre>' + esc(P.promptSegarkan(c)) + '</pre>');
      if (ok) sent[c.slug] = { at: new Date().toISOString(), skor: c.skor };
    }
    if (!DRY && pilih.length) wr('refresh-sent.json', sent);
    console.log('Pembaruan artikel: ' + cands.length + ' kandidat, ' + pilih.length + ' prompt, kosmetik=' + kosmetik.length + ', lupa tanggal=' + lupaTanggal.length);
  } catch (e) { console.log('Pembaruan artikel: dilewati karena error: ' + clean(e.message)); }
})();
