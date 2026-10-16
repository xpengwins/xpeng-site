const fs = require('fs'), path = require('path'); const ROOT = path.join(__dirname, '..'), D = path.join(ROOT, 'data'), B = path.join(ROOT, 'backup');
fs.mkdirSync(B, { recursive: true }); const data = {}; for (const n of ['site', 'models', 'articles', 'keywords', 'backlinks']) { try { data[n] = JSON.parse(fs.readFileSync(path.join(D, n + '.json'), 'utf8')); } catch (e) {} }
const today = new Date().toISOString().slice(0, 10); fs.writeFileSync(path.join(B, 'auto-' + today + '.json'), JSON.stringify({ app: 'xpeng-site', date: new Date().toISOString(), data }, null, 1));
fs.readdirSync(B).filter(f => f.startsWith('auto-')).sort().reverse().slice(14).forEach(f => fs.unlinkSync(path.join(B, f))); console.log('Backup', today);
