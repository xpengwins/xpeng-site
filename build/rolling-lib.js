/* Logika ROLLING GAMBAR DAN VIDEO MINGGUAN. FILE BARU.
   Dipakai oleh build/build.js (memilih tampilan beranda) dan build/rolling-media.js (laporan mingguan).
   Pilihan ditentukan oleh nomor minggu (bukan acak), jadi build tiap jam menghasilkan halaman yang sama sepanjang minggu
   dan berganti otomatis tiap Senin WIB. Tidak ada file yang diganti nama atau dihapus; hanya pilihan yang tampil di beranda yang berputar. */
const SENIN = '2026-01-05';
const hariWib = () => new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
const mingguKe = t => Math.floor(Math.floor((Date.parse(t + 'T00:00:00Z') - Date.parse(SENIN + 'T00:00:00Z')) / 864e5) / 7);
const geser = (arr, n, mulai) => { if (!Array.isArray(arr) || arr.length <= n) return (arr || []).slice(); const o = []; for (let i = 0; i < n; i++) o.push(arr[(mulai + i) % arr.length]); return o; };

/* cfg = isi data/rolling.json; ada(path) = fungsi cek file ada; tgl = 'YYYY-MM-DD' (uji). Mengembalikan null bila dimatikan. */
function pilih(cfg, ada, tgl) {
  if (!cfg || cfg.aktif === false) return null;
  const w = mingguKe(tgl || hariWib()), hasil = { minggu: w };
  const v = cfg.videoBeranda;
  if (v && v.aktif !== false) {
    const pool = (v.pool || []).filter(x => x && x.src && (!ada || ada(x.src)));
    if (pool.length) hasil.video = pool[((w % pool.length) + pool.length) % pool.length];
  }
  const g = cfg.galeriBeranda;
  if (g && g.aktif !== false) {
    const per = Math.max(1, g.jumlahPerModel || 5), langkah = Math.max(1, g.langkah || 3);
    hasil.mulai = len => len ? ((w * langkah) % len + len) % len : 0;
    hasil.galeri = arr => geser(arr, per, hasil.mulai((arr || []).length));
  }
  return hasil;
}
module.exports = { pilih, mingguKe, geser, hariWib };
