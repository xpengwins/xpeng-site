/* IndexNow: memberi tahu Bing (dan mesin pencari pendukung) tentang URL baru di sitemap.
   Hanya mengirim URL yang belum pernah dikirim. Tidak pernah menggagalkan workflow. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SENT = path.join(ROOT, 'data', 'indexnow-sent.json');
(async () => {
  try {
    const keyFile = fs.readdirSync(ROOT).find(f => /^[a-f0-9]{32}\.txt$/.test(f));
    if (!keyFile) return console.log('IndexNow: file kunci tidak ada, dilewati.');
    const key = fs.readFileSync(path.join(ROOT, keyFile), 'utf8').trim();
    const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    if (!urls.length) return console.log('IndexNow: sitemap kosong.');
    const host = new URL(urls[0]).host;
    if (/github\.io$/.test(host)) return console.log('IndexNow: domain masih github.io, dilewati (butuh domain sendiri).');
    const origin = 'https://' + host;
    let sent = {}; try { sent = JSON.parse(fs.readFileSync(SENT, 'utf8')); } catch (e) {}
    const fresh = urls.filter(x => !sent[x]);
    if (!fresh.length) return console.log('IndexNow: tidak ada URL baru.');
    // halaman yang ikut berubah saat ada artikel baru
    const list = [...new Set([...fresh, origin + '/', origin + '/artikel/'])].filter(x => urls.includes(x));
    console.log('IndexNow: menunggu 90 detik agar situs selesai tayang...');
    await new Promise(r => setTimeout(r, 90000));
    const keyLocation = `${origin}/${keyFile}`;
    const chk = await fetch(keyLocation).then(r => r.text()).catch(() => '');
    if (chk.trim() !== key) return console.log('IndexNow: file kunci belum bisa dibuka di ' + keyLocation + ', coba lagi pada putaran berikutnya.');
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation, urlList: list.slice(0, 10000) })
    });
    console.log('IndexNow: status ' + res.status + ' untuk ' + list.length + ' URL');
    if (res.status === 200 || res.status === 202) {
      const now = new Date().toISOString();
      fresh.forEach(x => { sent[x] = now; });
      fs.writeFileSync(SENT, JSON.stringify(sent, null, 1));
    }
  } catch (e) { console.log('IndexNow: dilewati karena error: ' + e.message); }
})();
