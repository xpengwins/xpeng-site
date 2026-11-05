/* AGENT HARIAN (jalan tiap hari sekitar 06.00 WIB, lihat .github/workflows/harian.yml). FILE BARU.
   Isi laporan Telegram:
     1. Biaya Google Ads kemarin, dana terpakai dan sisa, batas aman per hari, proyeksi dana habis
     2. Kualitas klik: klik iklan dibanding sesi iklan dan aksi chat/WhatsApp (indikasi klik mencurigakan)
     3. Domain, sertifikat HTTPS, token Facebook/Instagram/Threads, kesehatan data Google
     4. Ringkasan alarm situs (dari build/uptime.js)
   Sumber data iklan: tab "Iklan Harian" di Google Sheet, diisi oleh tools/google-ads-harian.gs (skrip di akun Google Ads).
   Sumber data chat: tab "Chat WA" (dari tools/chat-wa-notifikasi.gs).
   Menulis: data/harian.json saja. Tidak mengubah data lain. Error tidak pernah menggagalkan workflow.
   Uji tanpa kirim: AGENT_DRY=1 node build/agent-harian.js */
const fs = require('fs'), tls = require('tls');
const U = require('./util-agent.js');
const { E, rd, wr, esc, clean, wib, ymd, addDays, daysBetween, rp, tgl, jam, tg, googleToken, sheetValues, cellDate, cellNum, median } = U;
const cfg = Object.assign({ danaTotal: 1500000, mulai: '2026-11-03', akhir: '2026-11-30', domain: '', tabIklan: 'Iklan Harian', tabChat: 'Chat WA', minKlikTanpaAksi: 10, ambangInvalidPersen: 10, lonjakanKali: 2.5, batasBorosKali: 1.25 }, rd('iklan-config.json', {}));
const T = n => 'timeout' in AbortSignal ? AbortSignal.timeout(n) : undefined;

/* ---------- 1 dan 2: iklan dan kualitas klik ---------- */
async function bagianIklan(hari, kemarin) {
  const out = { ok: false, flags: [], baris: [], belum: [] };
  const sheet = E.SHEET_ID, chatSheet = E.CHAT_SHEET_ID || E.SHEET_ID;
  if (!E.GSC_KEY || !sheet) { out.belum.push('Laporan iklan belum aktif: secret GSC_KEY dan SHEET_ID belum terisi di GitHub'); return out; }
  let tok; try { tok = await googleToken('https://www.googleapis.com/auth/spreadsheets.readonly'); } catch (e) { out.baris.push('Login Google gagal: ' + clean(e.message)); out.flags.push('Login Google ke Sheets gagal, cek kunci GSC_KEY'); return out; }

  /* data iklan */
  let ads = [];
  try {
    const v = await sheetValues(sheet, cfg.tabIklan, tok), h = (v[0] || []).map(x => String(x).trim().toLowerCase()), ix = n => h.indexOf(n);
    const iT = ix('tanggal'), iK = ix('kampanye'), iB = ix('biaya'), iC = ix('klik'), iI = ix('tayang'), iV = ix('klik tidak valid'), iQ = ix('konversi');
    if (iT < 0 || iB < 0 || iC < 0) throw new Error('kolom Tanggal/Biaya/Klik tidak ditemukan di tab "' + cfg.tabIklan + '"');
    ads = v.slice(1).map(r => ({ d: cellDate(r[iT]), k: String(r[iK] || ''), biaya: cellNum(r[iB]), klik: cellNum(r[iC]), tayang: iI < 0 ? 0 : cellNum(r[iI]), invalid: iV < 0 ? null : cellNum(r[iV]), konv: iQ < 0 ? 0 : cellNum(r[iQ]) })).filter(r => r.d);
  } catch (e) {
    out.belum.push('Data iklan belum bisa dibaca (' + clean(e.message) + '). Pasang skrip tools/google-ads-harian.gs di Google Ads, lihat docs/panduan-agent-harian.md'); return out;
  }
  const sum = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
  const dihitung = ads.filter(r => r.d >= cfg.mulai && r.d <= kemarin);
  const tglAds = ads.map(r => r.d).sort().pop() || '';
  const kmr = ads.filter(r => r.d === kemarin);
  if (!tglAds || tglAds < kemarin) { out.flags.push('Data iklan terakhir tanggal ' + (tglAds || '-') + ', belum sampai kemarin (' + kemarin + '). Cek jadwal skrip di Google Ads'); }
  const biayaKmr = sum(kmr, r => r.biaya), klikKmr = sum(kmr, r => r.klik), tayKmr = sum(kmr, r => r.tayang), invKmr = kmr.some(r => r.invalid == null) ? null : sum(kmr, r => r.invalid);
  const terpakai = sum(dihitung, r => r.biaya), sisa = cfg.danaTotal - terpakai, persen = Math.round(terpakai / cfg.danaTotal * 100);
  const hariSisa = Math.max(1, daysBetween(hari, cfg.akhir) + 1), aman = sisa / hariSisa;
  const dayCost = {}; dihitung.forEach(r => { dayCost[r.d] = (dayCost[r.d] || 0) + r.biaya; });
  const hari7 = [...Array(7)].map((_, i) => addDays(kemarin, -i)).filter(d => d >= cfg.mulai), rata7 = hari7.length ? hari7.reduce((s, d) => s + (dayCost[d] || 0), 0) / hari7.length : 0;
  out.iklan = { kemarin, biaya: Math.round(biayaKmr), klik: klikKmr, tayang: tayKmr, invalid: invKmr, terpakai: Math.round(terpakai), sisa: Math.round(sisa), persen, hariSisa, amanPerHari: Math.round(aman), rata7: Math.round(rata7) };
  out.baris.push('Kemarin (' + kemarin + '): biaya ' + rp(biayaKmr) + ', ' + klikKmr + ' klik, ' + tayKmr + ' tayang' + (klikKmr ? ', rata-rata ' + rp(biayaKmr / klikKmr) + ' per klik' : ''));
  out.baris.push('Dana terpakai ' + rp(terpakai) + ' dari ' + rp(cfg.danaTotal) + ' (' + persen + '%), sisa ' + rp(Math.max(0, sisa)) + ' untuk ' + hariSisa + ' hari (sampai ' + tgl(cfg.akhir + 'T12:00:00Z') + ')');
  out.baris.push('Batas aman ' + rp(Math.max(0, aman)) + ' per hari. Rata-rata 7 hari terakhir ' + rp(rata7) + ' per hari');
  if (sisa <= 0) out.flags.push('Dana iklan HABIS (terpakai ' + rp(terpakai) + '). Matikan atau tambah dana');
  else {
    if (rata7 > 0) { const harinya = Math.floor(sisa / rata7); if (harinya < hariSisa - 2) out.flags.push('Dengan laju sekarang dana habis sekitar ' + tgl(addDays(hari, harinya) + 'T12:00:00Z') + ', ' + (hariSisa - harinya) + ' hari sebelum akhir. Turunkan anggaran harian ke sekitar ' + rp(aman)); }
    if (biayaKmr > aman * cfg.batasBorosKali && biayaKmr > 0) out.flags.push('Biaya kemarin ' + rp(biayaKmr) + ' di atas batas aman ' + rp(aman) + ' per hari');
  }
  out.ok = true;

  /* kualitas klik */
  const hari3 = [kemarin, addDays(kemarin, -1), addDays(kemarin, -2)];
  let chat = null;
  try {
    const v = await sheetValues(chatSheet, cfg.tabChat, tok), h = (v[0] || []).map(x => String(x).trim().toLowerCase()), ix = n => h.indexOf(n);
    const iW = ix('waktu'), iKj = ix('kejadian'), iS = ix('sesi'), iG = ix('gclid');
    if (iW < 0 || iS < 0 || iG < 0) throw new Error('kolom Waktu/Sesi/GCLID tidak ada');
    chat = {};
    v.slice(1).forEach(r => {
      const d = cellDate(r[iW]); if (!d || String(r[iG] || '').toLowerCase() !== 'ya') return;
      const o = chat[d] = chat[d] || { sesi: new Set(), aksi: new Set(), lead: new Set() }, sid = String(r[iS] || ''), kj = String(r[iKj] || '');
      o.sesi.add(sid); if (/^(Kirim pesan|Lanjut ke WhatsApp|Form test drive|LEAD)/i.test(kj)) o.aksi.add(sid); if (/^LEAD/i.test(kj)) o.lead.add(sid);
    });
  } catch (e) { out.chatError = clean(e.message); }
  if (chat) {
    const c = d => chat[d] || { sesi: new Set(), aksi: new Set(), lead: new Set() };
    const klik3 = sum(ads.filter(r => hari3.includes(r.d)), r => r.klik), aksi3 = hari3.reduce((s, d) => s + c(d).aksi.size, 0), sesi3 = hari3.reduce((s, d) => s + c(d).sesi.size, 0);
    out.kualitas = { klikKemarin: klikKmr, sesiChatKemarin: c(kemarin).sesi.size, aksiKemarin: c(kemarin).aksi.size, leadKemarin: c(kemarin).lead.size, klik3, aksi3 };
    out.kualitasBaris = ['Kemarin: ' + klikKmr + ' klik iklan, ' + c(kemarin).sesi.size + ' pengunjung iklan yang membuka chat, ' + c(kemarin).aksi.size + ' yang mengirim pesan/lanjut ke WhatsApp (' + c(kemarin).lead.size + ' lead isi nama dan nomor)', '3 hari terakhir: ' + klik3 + ' klik, ' + aksi3 + ' aksi chat/WhatsApp' + (klik3 ? ' (' + (aksi3 / klik3 * 100).toFixed(1) + '% dari klik)' : '')];
    const hariData = hari3.filter(d => d >= cfg.mulai).length;   // jumlah hari yang benar-benar punya data iklan
    if (hariData < 3) out.kualitasBaris.push('Data iklan baru ' + hariData + ' hari: penilaian klik mencurigakan dimulai setelah 3 hari data (konversi di Google Ads dan aksi chat bisa berbeda cara hitung).');
    else if (klik3 >= cfg.minKlikTanpaAksi && aksi3 === 0) out.flags.push('Klik mencurigakan: ' + klik3 + ' klik iklan dalam 3 hari, tetapi 0 aksi chat/WhatsApp dari pengunjung iklan');
    else if (klik3 >= 30 && aksi3 / klik3 < 0.02) out.flags.push('Rasio aksi rendah: hanya ' + aksi3 + ' aksi dari ' + klik3 + ' klik (' + (aksi3 / klik3 * 100).toFixed(1) + '%)');
  } else out.kualitasBaris = ['Data chat belum bisa dibaca' + (out.chatError ? ' (' + out.chatError + ')' : '') + '. Jika tab "' + cfg.tabChat + '" ada di Sheet lain, isi secret CHAT_SHEET_ID.'];
  if (invKmr != null && klikKmr >= 5) { const p = invKmr / klikKmr * 100; out.kualitasBaris.push('Klik tidak valid versi Google kemarin: ' + invKmr + ' (' + p.toFixed(1) + '%)'); if (p >= cfg.ambangInvalidPersen) out.flags.push('Klik tidak valid versi Google ' + p.toFixed(1) + '% kemarin. Cek laporan "Klik tidak valid" dan ajukan pengembalian biaya bila perlu'); }
  const prev = ads.filter(r => r.d < kemarin && r.d >= addDays(kemarin, -7)), prevByDay = {}; prev.forEach(r => { prevByDay[r.d] = (prevByDay[r.d] || 0) + r.klik; });
  const med = median(Object.values(prevByDay).filter(x => x > 0));
  if (klikKmr >= 8 && med > 0 && klikKmr > med * cfg.lonjakanKali) out.flags.push('Lonjakan klik: ' + klikKmr + ' kemarin, biasanya sekitar ' + Math.round(med) + ' per hari');
  /* silang periksa dengan Google Analytics 4: sesi dari iklan (medium cpc) selama 3 hari terakhir */
  if (E.GA4_PROPERTY_ID) {
    try {
      const ga = await ga4Iklan(addDays(kemarin, -2), kemarin), klik3b = sum(ads.filter(r => hari3.includes(r.d)), r => r.klik);
      if (ga) {
        const terlibat = ga.sesi ? Math.round(ga.terlibat / ga.sesi * 100) : 0;
        out.ga4 = { sesi3: ga.sesi, terlibatPersen: terlibat, durasiDetik: ga.durasi };
        (out.kualitasBaris = out.kualitasBaris || []).push('Google Analytics, sesi dari iklan 3 hari: ' + ga.sesi + ' sesi, ' + terlibat + '% terlibat (bertahan lebih dari 10 detik atau lebih dari 1 halaman), rata-rata ' + ga.durasi + ' detik');
        if (klik3b >= 15 && ga.sesi < klik3b * 0.5) out.flags.push('Klik iklan ' + klik3b + ' tetapi Google Analytics hanya mencatat ' + ga.sesi + ' sesi dari iklan (selisih wajar sampai 30%). Klik tidak sampai ke situs, klik tidak sengaja, atau situs lambat dibuka');
        if (ga.sesi >= 15 && terlibat < 25) out.flags.push('Hanya ' + terlibat + '% pengunjung iklan yang bertahan lebih dari 10 detik. Pola ini umum pada klik tidak sengaja atau bot, atau halaman tujuan kurang cocok dengan iklan');
      }
    } catch (e) { (out.kualitasBaris = out.kualitasBaris || []).push('Google Analytics belum bisa dibaca: ' + clean(e.message).slice(0, 80)); }
  }
  /* riwayat ringkas */
  out.riwayat = Object.keys(dayCost).sort().slice(-14).map(d => ({ d, biaya: Math.round(dayCost[d]), klik: sum(ads.filter(r => r.d === d), r => r.klik), aksi: chat ? c2(chat, d) : null }));
  return out;
}
const c2 = (chat, d) => chat[d] ? chat[d].aksi.size : 0;
async function ga4Iklan(dari, sampai) {
  const tok = await googleToken('https://www.googleapis.com/auth/analytics.readonly');
  const r = await fetch((E.GA_BASE || 'https://analyticsdata.googleapis.com/v1beta') + '/properties/' + E.GA4_PROPERTY_ID + ':runReport', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ dateRanges: [{ startDate: dari, endDate: sampai }], metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }, { name: 'averageSessionDuration' }], dimensionFilter: { filter: { fieldName: 'sessionMedium', stringFilter: { matchType: 'EXACT', value: 'cpc' } } } }) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error('GA4 ' + r.status + ' ' + ((j.error && j.error.message) || ''));
  const m = (j.rows && j.rows[0] && j.rows[0].metricValues) || []; if (!m.length) return { sesi: 0, terlibat: 0, durasi: 0 };
  return { sesi: +m[0].value || 0, terlibat: +m[1].value || 0, durasi: Math.round(+m[2].value || 0) };
}

/* ---------- 3: domain, sertifikat, token ---------- */
async function domainHabis(domain) {
  for (const u of ['https://rdap.verisign.com/com/v1/domain/', 'https://rdap.org/domain/']) {
    try { const r = await fetch(u + domain, { headers: { accept: 'application/rdap+json' }, signal: T(15000) }); if (!r.ok) continue; const j = await r.json(), ev = (j.events || []).find(e => /expiration/i.test(e.eventAction)); if (ev && ev.eventDate) return new Date(ev.eventDate); } catch (e) {}
  }
  return null;
}
const sertifikatHabis = host => new Promise(res => { try { const s = tls.connect({ host, port: 443, servername: host }, () => { const c = s.getPeerCertificate(); s.end(); res(c && c.valid_to ? new Date(c.valid_to) : null); }); s.setTimeout(10000, () => { s.destroy(); res(null); }); s.on('error', () => res(null)); } catch (e) { res(null); } });
async function cekToken() {
  const hasil = [], j = async u => { const r = await fetch(u, { signal: T(15000) }); return { ok: r.ok, j: await r.json().catch(() => ({})) }; };
  if (E.FB_PAGE_TOKEN) { try { const { j: x } = await j('https://graph.facebook.com/debug_token?input_token=' + encodeURIComponent(E.FB_PAGE_TOKEN) + '&access_token=' + encodeURIComponent(E.FB_PAGE_TOKEN)), d = x.data; hasil.push(d ? { nama: 'Facebook/Instagram', valid: d.is_valid !== false, selamanya: d.expires_at === 0, habis: d.expires_at ? new Date(d.expires_at * 1000) : null } : { nama: 'Facebook/Instagram', valid: false, ket: String((x.error && x.error.message) || 'ditolak').slice(0, 90) }); } catch (e) { hasil.push({ nama: 'Facebook/Instagram', tidakBisa: true }); } }
  if (E.THREADS_TOKEN) { try { const { ok, j: x } = await j('https://graph.threads.net/v1.0/me?fields=id&access_token=' + encodeURIComponent(E.THREADS_TOKEN)); hasil.push({ nama: 'Threads', valid: ok && !!x.id, ket: ok ? '' : String((x.error && x.error.message) || 'ditolak').slice(0, 90) }); } catch (e) { hasil.push({ nama: 'Threads', tidakBisa: true }); } }
  return hasil;
}
async function bagianAset() {
  const flags = [], baris = [], now = Date.now(), hr = d => Math.floor((d.getTime() - now) / 864e5);
  const host = (U.baseUrl().replace(/^https?:\/\//, '') || '').replace(/\/.*/, ''), domain = cfg.domain || host.replace(/^www\./, '');
  const [hab, cert, tok] = await Promise.all([domain ? domainHabis(domain) : null, host ? sertifikatHabis(host) : null, cekToken()]);
  const aset = { domain, domainHabis: hab && hab.toISOString(), sertifikatHabis: cert && cert.toISOString(), token: tok.map(t => ({ nama: t.nama, valid: t.valid, habis: t.habis && t.habis.toISOString() })) };
  if (hab) { const n = hr(hab); baris.push('Domain ' + domain + ' berakhir ' + tgl(hab) + ' (' + n + ' hari lagi)'); if (n <= 60) flags.push('Domain ' + domain + ' berakhir ' + n + ' hari lagi (' + tgl(hab) + '). Perpanjang sekarang'); } else baris.push('Domain ' + (domain || '-') + ': tanggal berakhir belum bisa dibaca otomatis, cek di registrar');
  if (cert) { const n = hr(cert); baris.push('Sertifikat HTTPS berlaku sampai ' + tgl(cert) + ' (' + n + ' hari)'); if (n <= 14) flags.push('Sertifikat HTTPS tinggal ' + n + ' hari. Cek pengaturan HTTPS di GitHub Pages'); }
  tok.forEach(t => {
    if (t.tidakBisa) { baris.push('Token ' + t.nama + ': belum bisa dicek (jaringan)'); return; }
    if (!t.valid) { baris.push('Token ' + t.nama + ': TIDAK VALID' + (t.ket ? ' (' + t.ket + ')' : '')); flags.push('Token ' + t.nama + ' tidak valid, posting otomatis akan gagal. Buat token baru dan perbarui secret di GitHub'); return; }
    if (t.habis) { const n = hr(t.habis); baris.push('Token ' + t.nama + ': berlaku sampai ' + tgl(t.habis) + ' (' + n + ' hari)'); if (n <= 14) flags.push('Token ' + t.nama + ' habis ' + n + ' hari lagi. Perpanjang sebelum ' + tgl(t.habis)); }
    else baris.push('Token ' + t.nama + ': valid' + (t.selamanya ? ', tanpa tanggal habis' : ''));
  });
  /* kesehatan data Google */
  const g = rd('gsc.json', null);
  if (g && g.generated) { const umur = Math.floor((now - Date.parse(g.generated)) / 864e5); if (umur >= 3) flags.push('Data Search Console tidak diperbarui ' + umur + ' hari. Cek GSC_KEY dan izin akun layanan'); }
  return { flags, baris, aset };
}

/* ---------- 4: ringkasan situs ---------- */
function bagianSitus() {
  const u = rd('uptime-state.json', null); if (!u) return { baris: ['Alarm situs belum aktif (pasang uptime.yml).'], flags: [] };
  const sejak = Date.now() - 864e5; let down = 0, n = 0;
  (u.incidents || []).forEach(i => { const a = Math.max(Date.parse(i.from), sejak), b = i.to ? Date.parse(i.to) : Date.now(); if (b > a) { down += b - a; n++; } });
  const menit = Math.round(down / 6e4), pct = (100 - down / 864e5 * 100).toFixed(2);
  const flags = u.status === 'down' ? ['Situs SEDANG DOWN sejak ' + jam(u.since)] : [];
  return { baris: ['Status sekarang: ' + (u.status === 'up' ? 'normal' : 'DOWN') + '. 24 jam terakhir: ' + (n ? n + ' gangguan, total ' + menit + ' menit (' + pct + '% aktif)' : 'tidak ada gangguan')], flags };
}

(async () => {
  try {
    const now = wib(), hari = ymd(now), kemarin = U.addDays(hari, -1);
    const [ik, as] = await Promise.all([bagianIklan(hari, kemarin), bagianAset()]), st = bagianSitus();
    const flags = [...ik.flags, ...as.flags, ...st.flags], L = [];
    const hariNama = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][now.getUTCDay()];
    L.push('<b>Laporan harian xpengwins.com</b>\n' + hariNama + ', ' + tgl(hari + 'T12:00:00Z'));
    if (flags.length) L.push('\n<b>PERHATIAN (' + flags.length + ')</b>\n' + flags.map(f => '⚠ ' + esc(f)).join('\n'));
    else L.push('\n' + (ik.belum.length ? 'Tidak ada peringatan dari data yang tersedia.' : 'Semua normal, tidak ada yang perlu ditindaklanjuti.'));
    if (ik.belum.length) L.push('\n<b>Perlu dipasang</b>\n' + ik.belum.map(esc).join('\n'));
    if (ik.baris.length) L.push('\n<b>Google Ads</b>\n' + ik.baris.map(esc).join('\n'));
    if (ik.kualitasBaris) L.push('\n<b>Kualitas klik</b>\n' + ik.kualitasBaris.map(esc).join('\n') + (ik.flags.length ? '\nIni indikasi, bukan bukti. Google umumnya mengembalikan biaya klik tidak valid yang terdeteksi.' : ''));
    L.push('\n<b>Domain dan token</b>\n' + as.baris.map(esc).join('\n'));
    L.push('\n<b>Situs</b>\n' + st.baris.map(esc).join('\n'));
    const msg = L.join('\n');

    /* simpan ringkasan (riwayat 60 hari) */
    const old = rd('harian.json', { riwayat: [] }), rw = (old.riwayat || []).filter(x => x.d !== kemarin);
    if (ik.iklan) rw.push({ d: kemarin, biaya: ik.iklan.biaya, klik: ik.iklan.klik, aksi: ik.kualitas ? ik.kualitas.aksiKemarin : null, lead: ik.kualitas ? ik.kualitas.leadKemarin : null });
    if (E.AGENT_DRY !== '1') wr('harian.json', { generated: new Date().toISOString(), iklan: ik.iklan || null, kualitas: ik.kualitas || null, peringatan: flags, aset: as.aset, riwayat: rw.slice(-60) });
    await tg(msg);
    console.log('Harian: selesai, ' + flags.length + ' peringatan.');
  } catch (e) { console.log('Harian: dilewati karena error: ' + clean(e.message)); }
})();
