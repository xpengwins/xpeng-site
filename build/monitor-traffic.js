/* AGENT 8: pantau jumlah pengunjung (traffic) website dari Google Analytics 4. FILE BARU, tidak mengubah sistem lain.
   Mengambil lewat GA4 Data API (resmi, gratis): pengunjung hari ini/kemarin/7 hari/30 hari, grafik harian, halaman terpopuler,
   sumber (Google, langsung, sosmed), perangkat, kota, dan klik penting (WhatsApp, test drive, telepon, brosur).
   Hasil: data/traffic.json (dibaca kartu "Pengunjung" di Admin Beranda).
   Telegram: ringkasan harian pada run malam (21.30 WIB) + peringatan jika pengunjung turun tajam.
   Butuh: secret GSC_KEY (akun layanan yang sama dengan Search Console) dan GA4_PROPERTY_ID (angka, dari GA4 Admin).
   Aman: tanpa kunci/ID hanya mencetak petunjuk, error tidak menggagalkan workflow, token tidak pernah dicetak.
   Uji tanpa internet: GA_BASE=http://localhost:PORT GA_TOKEN_URL=http://localhost:PORT/token TRAFFIC_FORCE=1 node build/monitor-traffic.js */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..'), D = f => path.join(ROOT, 'data', f);
const E = process.env;
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(D(f), 'utf8')); } catch (e) { return d; } };
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const TG = { tok: E.TELEGRAM_BOT_TOKEN, chat: E.TELEGRAM_CHAT_ID };
const scrub = m => [TG.tok, E.GSC_KEY].filter(Boolean).reduce((s, t) => s.split(t).join('***'), String(m));
const b64u = b => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const CFG = { daily: true, dailyHourWIB: 21, dropAlertPct: 50, dropMinUsers: 20, ...(rd('traffic-config.json', {}) || {}) };
const LEADS = ['klik_whatsapp', 'kirim_form_test_drive', 'klik_booking_test_drive', 'klik_telepon', 'klik_email', 'unduh_brosur'];
const LEAD_NAME = { klik_whatsapp: 'Klik WhatsApp', kirim_form_test_drive: 'Kirim form test drive', klik_booking_test_drive: 'Klik booking test drive', klik_telepon: 'Klik telepon', klik_email: 'Klik email', unduh_brosur: 'Unduh brosur' };
const num = x => Number(x) || 0;

(async () => {
  try {
    const site = rd('site.json', {});
    const prop = String(E.GA4_PROPERTY_ID || site.ga4PropertyId || '').replace(/\D/g, '');
    if (!E.GSC_KEY || !prop) return console.log('Traffic: belum aktif. Butuh secret GSC_KEY dan GA4_PROPERTY_ID (lihat docs/panduan-traffic.md).');
    let key; try { key = JSON.parse(E.GSC_KEY); } catch (e) { return console.log('Traffic: GSC_KEY bukan JSON yang benar.'); }
    const out0 = rd('traffic.json', {}), now = new Date(), wib = new Date(now.getTime() + 7 * 36e5);
    const API = E.GA_BASE || 'https://analyticsdata.googleapis.com/v1beta';

    /* login akun layanan */
    const t = Math.floor(Date.now() / 1000), hd = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' })), cl = b64u(JSON.stringify({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: 'https://oauth2.googleapis.com/token', iat: t, exp: t + 3000 }));
    const sig = crypto.createSign('RSA-SHA256').update(hd + '.' + cl).sign(key.private_key);
    const tr = await fetch(E.GA_TOKEN_URL || 'https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + hd + '.' + cl + '.' + b64u(sig) });
    const tj = await tr.json(); if (!tj.access_token) return console.log('Traffic: gagal login akun layanan: ' + (tj.error_description || tj.error || tr.status));

    const run = async body => {
      const r = await fetch(API + '/properties/' + prop + ':runReport', { method: 'POST', headers: { Authorization: 'Bearer ' + tj.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { const m = (j.error && j.error.message) || r.status; const hint = r.status === 403 ? ' | Akun layanan belum jadi Viewer di GA4, atau "Google Analytics Data API" belum diaktifkan.' : r.status === 400 ? ' | Cek GA4_PROPERTY_ID (harus angka Property ID).' : ''; const e = new Error('GA4 ' + r.status + ': ' + String(m).slice(0, 140) + hint); e.status = r.status; throw e; }
      return j.rows || [];
    };
    const m4 = ['activeUsers', 'sessions', 'screenPageViews', 'newUsers'].map(name => ({ name }));
    /* total per periode (rentang tanggal GA4 memakai zona waktu properti) */
    const ranges = [{ startDate: 'today', endDate: 'today' }, { startDate: 'yesterday', endDate: 'yesterday' }, { startDate: '6daysAgo', endDate: 'today' }, { startDate: '29daysAgo', endDate: 'today' }, { startDate: '59daysAgo', endDate: '30daysAgo' }];
    const tot = await run({ dateRanges: ranges, metrics: m4 });
    const per = i => { const r = tot.find(x => (x.dimensionValues && x.dimensionValues[0] && x.dimensionValues[0].value) === 'date_range_' + i) || (tot.length === 1 && i === 0 ? tot[0] : null); const v = r ? r.metricValues.map(x => num(x.value)) : [0, 0, 0, 0]; return { users: v[0], sessions: v[1], views: v[2], newUsers: v[3] }; };
    const hasRangeDim = tot.some(x => x.dimensionValues && x.dimensionValues.length);
    const P = hasRangeDim ? [0, 1, 2, 3, 4].map(per) : null;
    if (!P) throw new Error('GA4: format laporan tidak dikenali');
    const daily = (await run({ dateRanges: [{ startDate: '29daysAgo', endDate: 'today' }], dimensions: [{ name: 'date' }], metrics: m4, orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 40 }))
      .map(r => { const d = r.dimensionValues[0].value; return { date: d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8), users: num(r.metricValues[0].value), sessions: num(r.metricValues[1].value), views: num(r.metricValues[2].value) }; });
    const top = async (dim, metric, n, extra) => (await run({ dateRanges: [{ startDate: '29daysAgo', endDate: 'today' }], dimensions: [{ name: dim }], metrics: [{ name: metric }], orderBys: [{ metric: { metricName: metric }, desc: true }], limit: n, ...(extra || {}) })).map(r => ({ k: r.dimensionValues[0].value, v: num(r.metricValues[0].value) }));
    const pages = (await run({ dateRanges: [{ startDate: '29daysAgo', endDate: 'today' }], dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 10 })).map(r => ({ path: r.dimensionValues[0].value, views: num(r.metricValues[0].value), users: num(r.metricValues[1].value) }));
    const channels = await top('sessionDefaultChannelGroup', 'sessions', 8), devices = await top('deviceCategory', 'sessions', 4), cities = await top('city', 'activeUsers', 8);
    const evRows = await run({ dateRanges: [{ startDate: '29daysAgo', endDate: 'today' }], dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }], dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: LEADS } } }, limit: 20 });
    const leads = {}; LEADS.forEach(l => leads[l] = 0); evRows.forEach(r => { leads[r.dimensionValues[0].value] = num(r.metricValues[0].value); });

    const out = { generated: now.toISOString(), property: prop, today: P[0], yesterday: P[1], last7: P[2], last30: P[3], prev30: P[4], daily, pages, channels, devices, cities, leads,
      catatan: 'Pengunjung = pengguna aktif GA4. Data hari ini bisa naik beberapa jam ke depan (GA4 menunda pemrosesan). Pengunjung yang menolak/menonaktifkan pelacakan tidak terhitung.' };
    fs.writeFileSync(D('traffic.json'), JSON.stringify(out, null, 1));
    console.log('Traffic: hari ini ' + P[0].users + ', kemarin ' + P[1].users + ', 7 hari ' + P[2].users + ', 30 hari ' + P[3].users + ' pengunjung.');

    /* Telegram: ringkasan harian (run malam) + peringatan turun tajam; sekali per hari */
    const day = wib.toISOString().slice(0, 10), st = rd('traffic-sent.json', {});
    const force = E.TRAFFIC_FORCE === '1';
    const L = [];
    if (CFG.daily && (force || (wib.getUTCHours() >= CFG.dailyHourWIB && st.daily !== day))) {
      const wow = P[3].users && P[4].users ? Math.round((P[3].users - P[4].users) / P[4].users * 100) : null;
      L.push('👥 <b>Pengunjung xpengwins.com</b>\n\nHari ini: <b>' + P[0].users + '</b> pengunjung (' + P[0].views + ' halaman dilihat)\nKemarin: ' + P[1].users + '\n7 hari terakhir: ' + P[2].users + '\n30 hari terakhir: ' + P[3].users + (wow != null ? ' (' + (wow >= 0 ? '+' : '') + wow + '% vs 30 hari sebelumnya)' : ''));
      const lead = LEADS.filter(l => leads[l]).map(l => LEAD_NAME[l] + ' ' + leads[l]).join(', '); if (lead) L.push('\nKlik penting (30 hari): ' + lead);
      if (pages[0]) L.push('Halaman terpopuler: ' + esc(pages.slice(0, 3).map(p => p.path + ' (' + p.views + ')').join(', ')));
      st.daily = day;
    }
    /* turun tajam: rata-rata 3 hari terakhir (tanpa hari ini) vs 14 hari sebelumnya */
    const full = daily.slice(0, -1); if (full.length >= 17) {
      const avg = a => a.reduce((s, x) => s + x.users, 0) / a.length, rec = avg(full.slice(-3)), base = avg(full.slice(-17, -3));
      if (base >= CFG.dropMinUsers && rec < base * (1 - CFG.dropAlertPct / 100) && st.drop !== day) { L.push('\n📉 <b>Pengunjung turun tajam</b>: rata-rata 3 hari terakhir ' + Math.round(rec) + '/hari, sebelumnya ' + Math.round(base) + '/hari. Cek iklan, Search Console, dan kecepatan situs.'); st.drop = day; }
    }
    if (L.length && TG.tok && TG.chat) {
      try { const r = await fetch((E.TG_BASE || 'https://api.telegram.org') + '/bot' + TG.tok + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TG.chat, text: L.join('\n').slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true }) }); if (r.ok) fs.writeFileSync(D('traffic-sent.json'), JSON.stringify(st)); else console.log('Traffic: Telegram ' + r.status); } catch (e) { console.log('Traffic: Telegram gagal: ' + scrub(e.message)); }
    }
  } catch (e) { console.log('Traffic: gagal (diabaikan): ' + scrub(e.message)); }
})();
