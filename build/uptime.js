/* ALARM SITUS MATI (jalan tiap 15 menit, lihat .github/workflows/uptime.yml). FILE BARU.
   Mengecek beranda, sitemap, dan satu halaman model. Gagal dianggap sungguhan hanya jika 3 percobaan berturut-turut gagal
   (jeda 10 detik), supaya gangguan sekejap tidak memicu alarm palsu.
   Telegram dikirim hanya saat: situs mulai down, situs pulih (dengan lama gangguan), atau masih down (pengingat tiap 3 jam).
   Menulis data/uptime-state.json hanya saat ada perubahan, jadi tidak membanjiri riwayat commit.
   Uji tanpa kirim: AGENT_DRY=1 node build/uptime.js */
const U = require('./util-agent.js');
const { E, rd, wr, esc, clean, jam, tg, baseUrl, sleep } = U;
const T = n => 'timeout' in AbortSignal ? AbortSignal.timeout(n) : undefined;

async function cek(url, mustHave) {
  let last = null;
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    try {
      const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'uptime=' + Date.now(), { signal: T(15000), headers: { 'User-Agent': 'xpeng-uptime-check', 'Cache-Control': 'no-cache' }, redirect: 'follow' });
      const body = mustHave ? await r.text() : '';
      if (r.ok && (!mustHave || body.includes(mustHave))) return { url, ok: true, status: r.status, ms: Date.now() - t0 };
      last = { url, ok: false, status: r.status, alasan: r.ok ? 'halaman terbuka tetapi isinya tidak sesuai' : 'HTTP ' + r.status };
    } catch (e) { last = { url, ok: false, status: 0, alasan: 'tidak bisa dihubungi (' + clean(e.name === 'TimeoutError' ? 'timeout 15 detik' : e.message).slice(0, 60) + ')' }; }
    if (i < 2) await sleep(E.UPTIME_JEDA ? +E.UPTIME_JEDA : 10000);
  }
  return last;
}
const lama = (a, b) => { const m = Math.max(1, Math.round((b - a) / 6e4)); return m >= 120 ? Math.floor(m / 60) + ' jam ' + (m % 60) + ' menit' : m + ' menit'; };

(async () => {
  try {
    const base = baseUrl(); if (!base) return console.log('Uptime: alamat situs tidak ditemukan (site.json / CNAME), dilewati.');
    const models = rd('models.json', []), m0 = models[0] && models[0].slug;
    const targets = [[base + '/', '</html>'], [base + '/sitemap.xml', '<urlset'], ...(m0 ? [[base + '/model/' + m0 + '/', '</html>']] : [])];
    const hasil = []; for (const [u, h] of targets) hasil.push(await cek(u, h));
    const gagal = hasil.filter(r => !r.ok), now = new Date().toISOString();
    const st = rd('uptime-state.json', { status: 'up', since: now, incidents: [] });
    let ubah = false;
    if (gagal.length && st.status !== 'down') {
      st.status = 'down'; st.since = now; st.lastRemind = now; st.incidents = (st.incidents || []).concat([{ from: now, to: null, alasan: gagal.map(g => g.url.replace(base, '') + ' ' + g.alasan).join('; ') }]).slice(-40); ubah = true;
      await tg('<b>ALARM: situs tidak bisa dibuka</b>\n⚠ ' + esc(base) + '\n' + gagal.map(g => esc(g.url.replace(base, '') || '/') + ': ' + esc(g.alasan)).join('\n') + '\n\nDicek 3 kali berturut-turut dan semuanya gagal (' + esc(jam(now)) + '). Cek tab Actions dan status GitHub Pages.');
    } else if (gagal.length && st.status === 'down') {
      if (Date.now() - Date.parse(st.lastRemind || st.since) >= 3 * 36e5) { st.lastRemind = now; ubah = true; await tg('<b>Pengingat: situs masih down</b>\nSejak ' + esc(jam(st.since)) + ' (' + lama(Date.parse(st.since), Date.now()) + ').\n' + gagal.map(g => esc(g.url.replace(base, '') || '/') + ': ' + esc(g.alasan)).join('\n')); }
    } else if (!gagal.length && st.status === 'down') {
      const inc = (st.incidents || []).slice(-1)[0]; if (inc && !inc.to) inc.to = now;
      const dur = lama(Date.parse(st.since), Date.now()); st.status = 'up'; st.since = now; delete st.lastRemind; ubah = true;
      await tg('<b>Situs pulih</b>\n' + esc(base) + ' kembali normal. Lama gangguan sekitar ' + dur + '.');
    }
    if (ubah && E.AGENT_DRY !== '1') wr('uptime-state.json', st);
    console.log('Uptime: ' + (gagal.length ? gagal.length + ' gagal (' + gagal.map(g => g.alasan).join(', ') + ')' : 'normal, ' + hasil.map(r => r.ms + 'ms').join(' / ')) + (ubah ? ' [status berubah]' : ''));
  } catch (e) { console.log('Uptime: dilewati karena error: ' + clean(e.message)); }
})();
