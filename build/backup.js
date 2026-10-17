const fs = require('fs'), path = require('path'); const ROOT = path.join(__dirname, '..'), D = path.join(ROOT, 'data'), B = path.join(ROOT, 'backup');
fs.mkdirSync(B, { recursive: true }); const data = {}; for (const n of ['site', 'models', 'articles', 'keywords', 'backlinks', 'leasing', 'about']) { try { data[n] = JSON.parse(fs.readFileSync(path.join(D, n + '.json'), 'utf8')); } catch (e) {} }
const today = new Date().toISOString().slice(0, 10), bf = path.join(B, 'auto-' + today + '.json'); let prev = null; try { prev = JSON.parse(fs.readFileSync(bf, 'utf8')); } catch (e) {}
if (!prev || JSON.stringify(prev.data) !== JSON.stringify(data)) fs.writeFileSync(bf, JSON.stringify({ app: 'xpeng-site', date: new Date().toISOString(), data }, null, 1)); /* hanya tulis bila data berubah (build tiap jam tidak membuat commit baru) */
fs.readdirSync(B).filter(f => f.startsWith('auto-')).sort().reverse().slice(14).forEach(f => fs.unlinkSync(path.join(B, f))); console.log('Backup', today);
