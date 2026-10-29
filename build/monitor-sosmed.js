/* AGENT 2 (bagian sosmed): pantau semua postingan Facebook, Instagram, Threads. FILE BARU.
   Yang dikerjakan:
   1) Ambil postingan terbaru + interaksi (suka, komentar, bagikan, jangkauan/views bila tersedia).
   2) Bandingkan interaksi 5 post terbaru vs 5 sebelumnya (tanda akun melemah).
   3) Cari SINYAL pelanggaran kebijakan / pembatasan: kode error Meta, kuota posting Instagram,
      posting beruntun terlalu rapat, token rusak/kedaluwarsa.
   JUJUR: tidak ada API Meta yang berkata "akun Anda dilemahkan". Yang dilaporkan adalah SINYAL,
   bukan vonis. Cek resmi tetap di Meta Business Suite > Kualitas Akun / Status Akun.
   Hasil: data/sosmed-stats.json. Peringatan Telegram hanya untuk masalah BARU.
   Aman: platform tanpa secret dilewati, token tidak dicetak, error tidak menggagalkan workflow.
   Uji tanpa kirim/ambil data: SOSMED_DRY=1 node build/monitor-sosmed.js */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), D = f => path.join(ROOT, 'data', f);
const E = process.env, DRY = E.SOSMED_DRY === '1';
const GRAPH = E.GRAPH_BASE || 'https://graph.facebook.com/' + (E.GRAPH_VERSION || 'v25.0'), THR = E.THREADS_BASE || 'https://graph.threads.net/v1.0';
const FB = { id: E.FB_PAGE_ID, tok: E.FB_PAGE_TOKEN }, IG = { id: E.IG_USER_ID, tok: E.IG_TOKEN || E.FB_PAGE_TOKEN }, TH = { id: E.THREADS_USER_ID, tok: E.THREADS_TOKEN };
const TG = { tok: E.TELEGRAM_BOT_TOKEN, chat: E.TELEGRAM_CHAT_ID };
const READY = { facebook: !!(FB.id && FB.tok), instagram: !!(IG.id && IG.tok), threads: !!(TH.id && TH.tok) };
const NAME = { facebook: 'Facebook', instagram: 'Instagram', threads: 'Threads' };
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(D(f), 'utf8')); } catch (e) { return d; } };
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const SECRETS = [FB.tok, IG.tok, TH.tok, TG.tok].filter(Boolean);
const scrub = m => SECRETS.reduce((s, t) => s.split(t).join('***'), String(m));
const POLICY = /policy|kebijakan|spam|restrict|blocked|violat|community standards|temporarily|\b368\b|2207051|2207057|1390008/i;
const TOKEN = /\b190\b|\b102\b|expired|kedaluwarsa|invalid.*token|session has|OAuthException|belum diisi/i;
const RATE = /rate limit|too many|\(kode (4|17|32|341|613)\)|limit reached|quota/i;

async function get(url, params) {
  const r = await fetch(url + '?' + new URLSearchParams(params), { signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) { const e = j.error || {}; throw new Error((e.message || 'HTTP ' + r.status) + (e.code ? ' (kode ' + e.code + (e.error_subcode ? '/' + e.error_subcode : '') + ')' : '')); }
  return j;
}
const safe = async fn => { try { return await fn(); } catch (e) { return { __err: scrub(e.message).slice(0, 160) }; } };
const ins = arr => { const o = {}; ((arr && arr.data) || []).forEach(m => { const v = m.values && m.values[0] ? m.values[0].value : m.total_value && m.total_value.value; if (typeof v === 'number') o[m.name] = v; }); return o; };
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
async function tgSend(text) {
  const r = await fetch((E.TG_BASE || 'https://api.telegram.org') + '/bot' + TG.tok + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TG.chat, text: text.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true }) });
  if (!r.ok) throw new Error('Telegram ' + r.status);
}

/* ---------- ambil data per platform: hasil = { account, posts:[{at,url,eng,reach}], extra } ---------- */
const FETCH = {
  facebook: async () => {
    const acc = await get(GRAPH + '/' + FB.id, { fields: 'name,fan_count,followers_count', access_token: FB.tok });
    const pq = { fields: 'created_time,permalink_url,reactions.summary(true).limit(0),comments.summary(true).limit(0),shares', limit: 15, access_token: FB.tok };
    /* /posts butuh izin pages_read_user_content (error #10); /published_posts cukup dengan izin Page biasa, jadi dicoba lebih dulu */
    const p = await get(GRAPH + '/' + FB.id + '/published_posts', pq).catch(() => get(GRAPH + '/' + FB.id + '/posts', pq));
    return { account: { name: acc.name, followers: acc.followers_count || acc.fan_count || 0 }, posts: (p.data || []).map(x => ({ at: x.created_time, url: x.permalink_url, eng: ((x.reactions && x.reactions.summary && x.reactions.summary.total_count) || 0) + ((x.comments && x.comments.summary && x.comments.summary.total_count) || 0) + ((x.shares && x.shares.count) || 0) })) };
  },
  instagram: async () => {
    const acc = await get(GRAPH + '/' + IG.id, { fields: 'username,followers_count,media_count', access_token: IG.tok });
    const m = await get(GRAPH + '/' + IG.id + '/media', { fields: 'timestamp,permalink,like_count,comments_count', limit: 15, access_token: IG.tok });
    const posts = (m.data || []).map(x => ({ id: x.id, at: x.timestamp, url: x.permalink, eng: (x.like_count || 0) + (x.comments_count || 0) }));
    for (const x of posts.slice(0, 10)) { const i = await safe(() => get(GRAPH + '/' + x.id + '/insights', { metric: 'reach,saved,shares', access_token: IG.tok })); if (!i.__err) { const o = ins(i); x.reach = o.reach; x.eng += (o.saved || 0) + (o.shares || 0); } }
    const lim = await safe(() => get(GRAPH + '/' + IG.id + '/content_publishing_limit', { fields: 'quota_usage,config', access_token: IG.tok }));
    const q = lim.data && lim.data[0] ? { used: lim.data[0].quota_usage, total: lim.data[0].config && lim.data[0].config.quota_total } : null;
    return { account: { name: '@' + acc.username, followers: acc.followers_count || 0, media: acc.media_count }, posts, extra: q ? { quota: q } : (lim.__err ? { quotaErr: lim.__err } : {}) };
  },
  threads: async () => {
    const me = await get(THR + '/me', { fields: 'id,username', access_token: TH.tok });
    const t = await get(THR + '/me/threads', { fields: 'id,timestamp,permalink', limit: 15, access_token: TH.tok });
    const posts = (t.data || []).map(x => ({ id: x.id, at: x.timestamp, url: x.permalink, eng: 0 }));
    for (const x of posts.slice(0, 10)) { const i = await safe(() => get(THR + '/' + x.id + '/insights', { metric: 'views,likes,replies,reposts,quotes', access_token: TH.tok })); if (!i.__err) { const o = ins(i); x.reach = o.views; x.eng = (o.likes || 0) + (o.replies || 0) + (o.reposts || 0) + (o.quotes || 0); } }
    const fol = await safe(() => get(THR + '/me/threads_insights', { metric: 'followers_count', access_token: TH.tok }));
    return { account: { name: '@' + me.username, followers: fol.__err ? null : (ins(fol).followers_count || 0) }, posts };
  }
};

(async () => {
  try {
    const log = rd('social-log.json', []), status = rd('social-status.json', {}), old = rd('sosmed-stats.json', {});
    const issues = [], out = { generated: new Date().toISOString(), platforms: {} };
    const now = Date.now();

    /* A) sinyal dari log posting sistem sendiri (tanpa API) */
    log.filter(l => !l.ok && l.platform !== 'telegram' && now - Date.parse(l.at) < 48 * 36e5).forEach(l => {
      const kind = POLICY.test(l.msg) ? 'kebijakan' : TOKEN.test(l.msg) ? 'token' : RATE.test(l.msg) ? 'batas' : 'gagal';
      const ic = { kebijakan: '🚫', token: '🔑', batas: '⏳', gagal: '❗' }[kind];
      issues.push({ k: kind + ':' + l.platform + ':' + String(l.msg).slice(0, 40), t: ic + ' ' + NAME[l.platform] + ' (' + kind + '): ' + String(l.msg).slice(0, 120) });
    });
    Object.entries(status.err || {}).forEach(([p, m]) => { if (p === 'telegram') return; const kind = POLICY.test(m) ? 'kebijakan' : TOKEN.test(m) ? 'token' : 'koneksi'; issues.push({ k: 'status:' + p + ':' + kind, t: (kind === 'kebijakan' ? '🚫 ' : kind === 'token' ? '🔑 ' : '❗ ') + NAME[p] + ' tes koneksi gagal: ' + String(m).slice(0, 120) }); });
    if (typeof status.threadsLeft === 'number' && status.threadsLeft <= 10) issues.push({ k: 'threads-token-umur', t: '🔑 Token Threads sisa ' + status.threadsLeft + ' hari, segera perpanjang.' });

    /* B) posting beruntun terlalu rapat (pola yang sering dianggap spam): 3 post dalam 30 menit di satu platform, 48 jam terakhir */
    for (const p of Object.keys(NAME)) {
      const t = log.filter(l => l.ok && l.platform === p && now - Date.parse(l.at) < 48 * 36e5).map(l => Date.parse(l.at)).sort((a, b) => a - b);
      let burst = 0; for (let i = 2; i < t.length; i++) if (t[i] - t[i - 2] <= 30 * 60e3) burst++;
      const perDay = t.filter(x => now - x < 24 * 36e5).length;
      if (burst) issues.push({ k: 'burst:' + p, t: '⚠️ ' + NAME[p] + ': ' + burst + 'x posting 3 kali dalam 30 menit (48 jam terakhir). Beri jeda minimal 2 jam per post agar tidak terlihat spam.' });
      if (perDay >= 6) issues.push({ k: 'perday:' + p, t: '⚠️ ' + NAME[p] + ': ' + perDay + ' posting dalam 24 jam, terlalu padat. Disarankan maksimal 3 sampai 4 per hari.' });
      out.platforms[p] = { posted48h: t.length, posted24h: perDay, bursts: burst };
    }

    /* C) data nyata dari API (butuh secret di GitHub) */
    if (DRY) { console.log('Sosmed (DRY): platform siap:', Object.keys(READY).filter(p => READY[p]).join(', ') || 'tidak ada', '| masalah dari log:', issues.length); }
    else for (const p of Object.keys(NAME)) {
      if (!READY[p]) { out.platforms[p].note = 'secret belum diisi, dilewati'; continue; }
      try {
        const r = await FETCH[p]();
        const posts = r.posts.filter(x => x.at).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
        const rec = posts.slice(0, 5), prv = posts.slice(5, 10);
        const a1 = avg(rec.map(x => x.eng)), a0 = avg(prv.map(x => x.eng));
        /* post yang baru tayang belum sempat dilihat orang; bandingkan hanya post berumur 24 jam ke atas supaya tidak salah dikira turun */
        const reach = posts.filter(x => typeof x.reach === 'number' && now - Date.parse(x.at) > 24 * 36e5);
        Object.assign(out.platforms[p], { account: r.account, posts: posts.length, avgEngRecent: +a1.toFixed(1), avgEngBefore: +a0.toFixed(1), avgReachRecent: reach.length ? Math.round(avg(reach.slice(0, 5).map(x => x.reach))) : null, last: posts[0] && posts[0].at, top: posts.slice().sort((a, b) => b.eng - a.eng).slice(0, 3).map(x => ({ url: x.url, eng: x.eng })), extra: r.extra || {} });
        if (prv.length >= 3 && a0 >= 3 && a1 < a0 * 0.5) issues.push({ k: 'drop:' + p, t: '📉 ' + NAME[p] + ': interaksi 5 post terbaru turun ' + a0.toFixed(1) + ' → ' + a1.toFixed(1) + ' per post (lebih dari 50%). Cek status akun & ganti format konten.' });
        if (r.extra && r.extra.quota && r.extra.quota.total && r.extra.quota.used / r.extra.quota.total >= 0.8) issues.push({ k: 'igquota', t: '⏳ Instagram: kuota posting 24 jam terpakai ' + r.extra.quota.used + '/' + r.extra.quota.total + '.' });
        if (reach.length >= 6) { const rc = avg(reach.slice(0, 3).map(x => x.reach)), rp = avg(reach.slice(3, 6).map(x => x.reach)); if (rp >= 20 && rc < rp * 0.4) issues.push({ k: 'reach:' + p, t: '📉 ' + NAME[p] + ': jangkauan 3 post terbaru turun tajam (' + Math.round(rp) + ' → ' + Math.round(rc) + '). Salah satu tanda pembatasan distribusi, cek Kualitas Akun di Meta.' }); }
      } catch (e) {
        const m = scrub(e.message).slice(0, 160), kind = POLICY.test(m) ? 'kebijakan' : TOKEN.test(m) ? 'token' : 'gagal';
        if (/\(#10\)|pages_read_user_content|Page Public Content/i.test(m)) { out.platforms[p].note = 'izin baca data post belum ada (posting tidak terpengaruh)'; continue; }
        out.platforms[p].error = m;
        issues.push({ k: 'api:' + p + ':' + kind, t: (kind === 'kebijakan' ? '🚫 ' : kind === 'token' ? '🔑 ' : '❗ ') + NAME[p] + ' (' + kind + '): ' + m });
      }
    }

    /* D) simpan + peringatan hanya untuk masalah BARU */
    const uniq = [...new Map(issues.map(i => [i.k, i])).values()];
    out.issues = uniq.map(i => i.t);
    out.alertKeys = old.alertKeys || [];
    const fresh = uniq.filter(i => !out.alertKeys.includes(i.k));
    if (!DRY && uniq.length && fresh.length && TG.tok && TG.chat) {
      try { await tgSend('📱 <b>Pantau sosmed XPeng</b>\n\n' + uniq.slice(0, 12).map(i => esc(i.t)).join('\n') + '\n\nIni SINYAL, bukan vonis. Cek resmi: Meta Business Suite, Kualitas Akun.'); out.alertKeys = uniq.map(i => i.k); }
      catch (e) { console.log('Sosmed: Telegram gagal: ' + scrub(e.message)); }
    } else if (!uniq.length) out.alertKeys = [];
    if (!DRY) fs.writeFileSync(D('sosmed-stats.json'), JSON.stringify(out, null, 1));
    console.log('Sosmed: ' + uniq.length + ' sinyal masalah. ' + Object.keys(NAME).map(p => NAME[p] + ': ' + (out.platforms[p].error ? 'GAGAL' : out.platforms[p].note ? 'dilewati' : 'ok')).join(', '));
  } catch (e) { console.log('Sosmed: gagal (diabaikan): ' + scrub(e.message)); }
})();
