/* LAPORAN ROLLING GAMBAR DAN VIDEO MINGGUAN (jalan tiap Senin pagi WIB). FILE BARU.
   Yang berputar (diatur di data/rolling.json, dihitung oleh build/rolling-lib.js, diterapkan oleh build/build.js tiap build):
     - Video beranda: bergantian di antara video dalam "pool" tiap minggu
     - Galeri beranda: jendela foto bergeser tiap minggu, sehingga semua foto tampil bergantian
   Yang SENGAJA tidak berputar: gambar artikel, galeri halaman model, nama file dan teks alt. Alamat gambar yang sudah dikenal Google
   dibiarkan tetap supaya tidak kehilangan peringkat di Google Gambar dan tidak ada link gambar yang rusak.
   Skrip ini: (1) mencatat pilihan minggu ini di data/rolling-state.json, (2) memeriksa file media (ada, ukuran, poster video),
   (3) mengirim ringkasan ke Telegram saat pilihan berganti atau ada masalah media.
   Uji tanpa kirim: AGENT_DRY=1 node build/rolling-media.js */
const fs = require('fs'), path = require('path');
const U = require('./util-agent.js'), R = require('./rolling-lib.js');
const { ROOT, E, rd, wr, esc, clean, tg } = U;
const ada = p => fs.existsSync(path.join(ROOT, String(p).replace(/^\//, '')));
const ukuran = p => { try { return fs.statSync(path.join(ROOT, p)).size; } catch (e) { return 0; } };
const mb = b => (b / 1048576).toFixed(1) + ' MB';
const nama = p => String(p).split('/').pop();

(async () => {
  try {
    const cfg = rd('rolling.json', null), models = rd('models.json', []);
    if (!cfg || cfg.aktif === false) return console.log('Rolling media: dimatikan (data/rolling.json tidak ada atau aktif=false).');
    const pil = R.pilih(cfg, ada), masalah = [];
    if (!pil) return;
    const state = { minggu: pil.minggu, video: pil.video ? pil.video.src : null, galeri: {}, at: new Date().toISOString() };
    const m2 = models.slice(0, 2);
    if (pil.galeri) m2.forEach(m => { state.galeri[m.slug] = pil.galeri(m.gallery).map(nama); });

    /* pemeriksaan media */
    const pool = (cfg.videoBeranda && cfg.videoBeranda.pool) || [];
    pool.forEach(x => {
      if (!ada(x.src)) { masalah.push('Video tidak ada di repo: ' + x.src + ' (dilewati dari putaran)'); return; }
      const sz = ukuran(x.src); if (sz > 5 * 1048576) masalah.push('Video ' + nama(x.src) + ' berukuran ' + mb(sz) + ' (disarankan di bawah 5 MB agar beranda cepat)');
      const base = x.src.replace(/\.(mp4|webm)$/i, ''); if (!ada(base + '.jpg') && !ada(base + '.webp')) masalah.push('Poster video ' + nama(x.src) + ' belum ada (jalankan build agar dibuat otomatis)');
    });
    if (pool.length && pool.filter(x => ada(x.src)).length < 2) masalah.push('Hanya ' + pool.filter(x => ada(x.src)).length + ' video yang tersedia di pool, jadi video beranda tidak berganti. Tambahkan video lewat upload/video/');
    m2.forEach(m => (pil.galeri ? pil.galeri(m.gallery) : []).forEach(f => { if (!ada(f)) masalah.push('Foto galeri tidak ada: ' + f); else if (ukuran(f) > 450 * 1024) masalah.push('Foto ' + nama(f) + ' berukuran ' + Math.round(ukuran(f) / 1024) + ' KB (disarankan di bawah 450 KB)'); }));

    const old = rd('rolling-state.json', null), berganti = !old || old.minggu !== state.minggu;
    if (!berganti && !masalah.length) return console.log('Rolling media: minggu ' + state.minggu + ' sudah tercatat, tidak ada masalah.');
    const L = ['<b>Rolling gambar dan video: minggu ini</b>'];
    if (berganti) {
      L.push('\nVideo beranda: ' + esc(state.video ? nama(state.video) : '(tidak ada)') + (old && old.video && old.video !== state.video ? ' (sebelumnya ' + esc(nama(old.video)) + ')' : ''));
      Object.entries(state.galeri).forEach(([s, a]) => L.push('Galeri beranda, ' + esc(s) + ': ' + a.map(esc).join(', ')));
      L.push('Berlaku otomatis pada build berikutnya (paling lambat 1 jam).');
    }
    if (masalah.length) L.push('\n<b>Perlu dicek</b>\n' + masalah.map(m => '⚠ ' + esc(m)).join('\n'));
    await tg(L.join('\n'));
    if (E.AGENT_DRY !== '1') wr('rolling-state.json', state);
    console.log('Rolling media: minggu ' + state.minggu + ', video ' + (state.video || '-') + ', masalah ' + masalah.length);
  } catch (e) { console.log('Rolling media: dilewati karena error: ' + clean(e.message)); }
})();
