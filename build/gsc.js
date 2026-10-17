/* Tarik data Google Search Console (1x per hari) -> data/gsc.json. Tanpa GSC_KEY: dilewati. Tidak pernah menggagalkan workflow. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'data', 'gsc.json');
const iso = d => d.toISOString().slice(0, 10), add = (d, n) => new Date(d.getTime() + n * 864e5);
const b64u = b => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
(async () => {
  try {
    if (!process.env.GSC_KEY) return console.log('GSC: GSC_KEY belum diisi, dilewati.');
    const key = JSON.parse(process.env.GSC_KEY);
    let old = {}; try { old = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) {}
    const now = new Date();
    if (old.generated && old.generated.slice(0, 10) === iso(now) && !process.env.GSC_FORCE) return console.log('GSC: data hari ini sudah ada.');
    const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    const host = new URL(xml.match(/<loc>([^<]+)<\/loc>/)[1]).host;
    const jwt = (() => { const h = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' })), t = Math.floor(Date.now() / 1000), c = b64u(JSON.stringify({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: 'https://oauth2.googleapis.com/token', iat: t, exp: t + 3000 })); const sig = crypto.sign('RSA-SHA256', Buffer.from(h + '.' + c), key.private_key); return h + '.' + c + '.' + b64u(sig); })();
    const tr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt });
    const tj = await tr.json(); if (!tj.access_token) return console.log('GSC: gagal login: ' + (tj.error_description || tj.error));
    const q = async (site, body) => { const r = await fetch('https://www.googleapis.com/webmasters/v3/sites/' + encodeURIComponent(site) + '/searchAnalytics/query', { method: 'POST', headers: { Authorization: 'Bearer ' + tj.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(r.status + ' ' + (j.error && j.error.message)); return j.rows || []; };
    const end = add(now, -3), start = add(end, -27), pEnd = add(start, -1), pStart = add(pEnd, -27);
    const ps = [iso(start), iso(end)], pp = [iso(pStart), iso(pEnd)];
    let site = 'sc-domain:' + host.replace(/^www\./, '');
    const tot = async (a) => { const r = await q(site, { startDate: a[0], endDate: a[1] }); return r[0] ? { clicks: r[0].clicks, impr: r[0].impressions, pos: +r[0].position.toFixed(1) } : { clicks: 0, impr: 0, pos: 0 }; };
    let totals; try { totals = await tot(ps); } catch (e) { site = 'https://' + host + '/'; totals = await tot(ps); }
    const prevTotals = await tot(pp);
    const rows = (await q(site, { startDate: ps[0], endDate: ps[1], dimensions: ['query', 'page'], rowLimit: 1000 })).map(r => ({ q: r.keys[0], p: r.keys[1].replace(/^https?:\/\/[^/]+/, '') || '/', clicks: r.clicks, impr: r.impressions, pos: +r.position.toFixed(1) }));
    fs.writeFileSync(OUT, JSON.stringify({ generated: now.toISOString(), site, period: ps, prev: pp, totals, prevTotals, rows }));
    console.log('GSC: tersimpan, ' + rows.length + ' baris, properti ' + site);
  } catch (e) { console.log('GSC: dilewati karena error: ' + e.message); }
})();
