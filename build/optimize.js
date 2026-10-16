/* Ubah semua jpg/png menjadi WebP dan perkecil gambar besar. Update referensi di data/*.json */
const fs = require('fs'), path = require('path'); let sharp; try { sharp = require('sharp'); } catch (e) { console.log('sharp tidak terpasang, lewati optimasi'); process.exit(0); }
const ROOT = path.join(__dirname, '..'), MAX_W = 1600, LIMIT = 250 * 1024; const changed = {};
function* walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const s = fs.statSync(p); if (s.isDirectory()) yield* walk(p); else yield p; } }
(async () => {
  for (const p of walk(path.join(ROOT, 'assets'))) {
    const ext = path.extname(p).toLowerCase(); if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) continue;
    const size = fs.statSync(p).size; if (ext === '.webp' && size <= LIMIT) continue;
    try {
      const img = sharp(p, { failOn: 'none' }).rotate(); const meta = await img.metadata();
      let q = 78, buf; do { buf = await sharp(p, { failOn: 'none' }).rotate().resize({ width: Math.min(meta.width || MAX_W, MAX_W), withoutEnlargement: true }).webp({ quality: q }).toBuffer(); q -= 8; } while (buf.length > LIMIT && q > 40);
      const out = p.replace(/\.(jpe?g|png|webp)$/i, '.webp');
      if (ext === '.webp') { if (buf.length < size) fs.writeFileSync(out, buf); } else { fs.writeFileSync(out, buf); fs.unlinkSync(p); changed[path.relative(ROOT, p)] = path.relative(ROOT, out); }
      console.log('optimasi', path.relative(ROOT, p), Math.round(size / 1024) + 'KB ->', Math.round(buf.length / 1024) + 'KB');
    } catch (e) { console.log('gagal', p, e.message); }
  }
  if (Object.keys(changed).length) for (const f of fs.readdirSync(path.join(ROOT, 'data'))) { if (!f.endsWith('.json')) continue; const fp = path.join(ROOT, 'data', f); let t = fs.readFileSync(fp, 'utf8'), o = t; for (const [a, b] of Object.entries(changed)) t = t.split(a).join(b); if (t !== o) fs.writeFileSync(fp, t); }
})();
