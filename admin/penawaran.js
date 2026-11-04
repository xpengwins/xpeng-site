/* Penawaran: pustaka pembuat surat penawaran (nomor otomatis, isi, pratinjau, Export PDF dan Word).
   Dipakai oleh admin/app.js (menu Lainnya > Penawaran). Tidak membaca/menulis data sendiri. */
(function (root) {
  'use strict';
  const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const G = '1F4A35', GOLD = 'B8975A', CREAM = 'F4EFE4';
  const DOCX_URL = 'https://cdn.jsdelivr.net/npm/docx@9.5.0/dist/index.iife.js';
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const lines = b => String(b || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const strip = l => l.replace(/^[-•◆]\s+/, '');
  /* **tebal** -> potongan teks */
  const runs = t => { const o = []; String(t == null ? '' : t).split(/(\*\*[^*]+\*\*)/).forEach(p => { if (!p) return; if (/^\*\*[^*]+\*\*$/.test(p)) o.push({ t: p.slice(2, -2), b: true }); else o.push({ t: p, b: false }); }); return o; };
  const ih = t => runs(t).map(r => r.b ? '<b>' + esc(r.t) + '</b>' : esc(r.t)).join('');
  const clone = o => JSON.parse(JSON.stringify(o));
  const rpFmt = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

  /* ---------- isi bawaan (bisa diubah lewat "Edit isi default") ---------- */
  function defaults() {
    return {
      city: 'Tangerang',
      intro: 'Puji syukur atas hubungan baik yang terjalin. Bersama ini kami dari **XPENG Alam Sutera** (PT Era Dealer Otomotif), selaku Authorized Dealer kendaraan XPENG di Indonesia, dengan bangga mengajukan penawaran khusus kendaraan listrik premium **{mobil}** untuk mendukung mobilitas pimpinan, eksekutif, maupun operasional representatif perusahaan Bapak/Ibu.',
      unitNote: 'Ketersediaan unit dengan pilihan warna lain dapat kami informasikan sesuai stok yang tersedia.',
      sections: [
        { id: 'unit', type: 'unit', title: 'Penawaran Unit', show: true, body: '' },
        { id: 'unggul', type: 'bullets', title: 'Mengapa XPENG', show: true, body: '**Kendaraan listrik (EV) premium** yang mengutamakan kenyamanan kabin bagi penumpang dan eksekutif.\n**Garansi baterai 8 tahun / 160.000 km**, memberikan ketenangan penggunaan jangka panjang.\n**Layanan Roadside Assistance 1 tahun** serta dukungan purna jual dari dealer resmi.\n**Efisiensi biaya operasional** dibandingkan kendaraan konvensional, sekaligus mencerminkan citra perusahaan yang modern dan berwawasan lingkungan.' },
        { id: 'termasuk', type: 'cols', title: 'Harga Sudah Termasuk', show: true, body: 'Kaca Film Premium ( Vkool )\nTire tool kit\nFloor Mat\nPlat Sementara 1x (1 Bulan)\nWarranty Battery 8 tahun / 160.000 km\nRoadside Assistance 1 Year\nPortable Charger' },
        { id: 'ketentuan', type: 'numbered', title: 'Ketentuan Penawaran', show: true, body: 'Harga & BBN tidak mengikat.\nBooking Fee sebesar **Rp 10.000.000** untuk XPENG ditransfer ke rekening **BCA 2688811177 a/n PT. ERA DEALER OTOMOTIF.**\nSkema pembayaran, baik tunai maupun pembiayaan, dapat kami diskusikan lebih lanjut sesuai kebutuhan perusahaan.\nPenawaran berlaku selama 14 (empat belas) hari sejak tanggal surat ini dan dapat berubah sewaktu-waktu mengikuti kebijakan prinsipal.' },
        { id: 'dokumen', type: 'bullets', title: 'Dokumen Persyaratan Pengajuan Faktur STNK', show: true, body: 'Fotocopy **NPWP** (2 lembar + stempel perusahaan di setiap lembarnya)\nFotocopy **NIB berbasis risiko** (2 lembar + stempel di setiap lembarnya)\nSurat kuasa pengajuan STNK yang dicetak di atas kop surat perusahaan, disertai **materai 10.000**, stempel perusahaan dan TTD pemberi kuasa (sebanyak 2 lembar)' },
        { id: 'alur', type: 'steps', title: 'Alur Pemesanan', show: true, body: 'Konfirmasi unit & warna\nPembayaran Booking Fee\nPengajuan faktur & STNK\nSerah terima kendaraan' },
        { id: 'free1', type: 'free', title: '', show: true, body: '' },
        { id: 'free2', type: 'free', title: '', show: true, body: '' },
        { id: 'free3', type: 'free', title: '', show: true, body: '' }
      ],
      closing: 'Apabila terdapat pertanyaan atau kebutuhan simulasi lebih lanjut, silakan menghubungi **{kontak}** selaku {jabatan} XPENG Alam Sutera Tangerang.',
      closing2: 'Demikian surat penawaran ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.',
      sign: { company: 'PT Era Dealer Otomotif – XPENG Alam Sutera', name: 'Edwin Sowita S', role: 'Sales Consultant', hp: '087810208822', email: 'sales@xpengwins.com' }
    };
  }
  function mergeTpl(saved) {
    const d = defaults(); if (!saved || typeof saved !== 'object') return d;
    const o = Object.assign({}, d, clone(saved)); o.sign = Object.assign({}, d.sign, saved.sign || {});
    if (!Array.isArray(o.sections) || !o.sections.length) o.sections = d.sections; return o;
  }
  function newOffer(savedTpl, created) {
    const o = mergeTpl(savedTpl);
    return Object.assign(o, { id: 'p' + Date.now().toString(36), created: created, perusahaan: '', pic: '', perihal: '', perihalManual: false, rows: [], seq: 0 });
  }

  /* ---------- nomor, tanggal, nama mobil ---------- */
  const pad = n => String(n).padStart(3, '0');
  function nomor(seq, created) { const d = new Date((created || '') + 'T00:00:00'); const ok = !isNaN(d); return pad(seq) + '/EDO-XPENG/' + ROM[ok ? d.getMonth() : new Date().getMonth()] + '/' + (ok ? d.getFullYear() : new Date().getFullYear()); }
  function dateText(created, city) { const d = new Date((created || '') + 'T00:00:00'); const x = isNaN(d) ? new Date() : d; return (city ? city + ', ' : '') + x.getDate() + ' ' + BLN[x.getMonth()] + ' ' + x.getFullYear(); }
  function mobil(O) {
    const n = []; (O.rows || []).forEach(r => { const m = String(r.mname || '').replace(/xpeng/i, 'XPENG').trim(); if (m && n.indexOf(m) < 0) n.push(m); });
    return n.length <= 1 ? (n[0] || '') : n.slice(0, -1).join(', ') + ' & ' + n[n.length - 1];
  }
  const autoPerihal = O => 'Penawaran Kendaraan ' + (mobil(O) || 'XPENG') + ' untuk Kebutuhan Perusahaan';
  function rowFrom(model, variant) {
    return { key: model.slug + '|' + variant.name, mname: model.name, type: variant.name, ext: (model.colors || []).map(c => c.name).join(' / '), int: '', harga: variant.price ? rpFmt(variant.price) : '', ket: 'SESUAI STOK' };
  }

  /* ---------- model dokumen (satu sumber untuk HTML, PDF, Word) ---------- */
  function doc(O, no) {
    const mb = mobil(O) || 'XPENG', S = O.sign || {};
    const sub = t => String(t == null ? '' : t).replace(/\{mobil\}/g, mb).replace(/\{perusahaan\}/g, O.perusahaan || '').replace(/\{kontak\}/g, S.name || '').replace(/\{jabatan\}/g, S.role || '');
    const B = [];
    B.push({ k: 'meta', no: no, date: dateText(O.created, O.city), perihal: O.perihal || autoPerihal(O) });
    B.push({ k: 'addr', lines: [{ t: 'Kepada Yth.' }, { t: O.perusahaan || '[Nama Perusahaan]', b: true }].concat(O.pic ? [{ t: '(up : ' + O.pic + ' )', b: true }] : []).concat([{ t: 'di Tempat' }]) });
    B.push({ k: 'p', t: 'Dengan hormat,', after: 80 });
    if (String(O.intro || '').trim()) B.push({ k: 'p', t: sub(O.intro), just: true });
    let n = 0;
    (O.sections || []).forEach(s => {
      if (s.show === false) return;
      const L = lines(sub(s.body)), title = String(s.title || '').trim();
      if (s.type === 'unit') { if (!(O.rows || []).length) return; B.push({ k: 'h', t: ROM[n++] + '.  ' + (title || 'Penawaran Unit') }); B.push({ k: 'unit', rows: O.rows }); if (String(O.unitNote || '').trim()) B.push({ k: 'note', t: O.unitNote }); return; }
      if (!L.length) return;
      if (title) B.push({ k: 'h', t: ROM[n++] + '.  ' + title });
      if (s.type === 'bullets') B.push({ k: 'bul', items: L.map(strip) });
      else if (s.type === 'cols') B.push({ k: 'cols', items: L.map(strip) });
      else if (s.type === 'numbered') B.push({ k: 'num', items: L.map(strip) });
      else if (s.type === 'steps') B.push({ k: 'steps', items: L.map(strip) });
      else { /* sub judul bebas: baris "- " jadi butir, baris lain jadi paragraf */
        let buf = []; const flush = () => { if (buf.length) { B.push({ k: 'bul', items: buf }); buf = []; } };
        L.forEach(l => { if (/^[-•◆]\s+/.test(l)) buf.push(strip(l)); else { flush(); B.push({ k: 'p', t: l, just: true }); } }); flush();
      }
    });
    if (String(O.closing || '').trim()) B.push({ k: 'p', t: sub(O.closing), just: true, before: 160 });
    if (String(O.closing2 || '').trim()) B.push({ k: 'p', t: sub(O.closing2), just: true, before: 120 });
    B.push({ k: 'sign', company: S.company || '', name: S.name || '', role: S.role || '', hp: S.hp || '', email: S.email || '' });
    return B;
  }

  /* ---------- HTML (pratinjau dan PDF) ---------- */
  const CSS = `.pl{font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;line-height:1.5;color:#111}.pl *{box-sizing:border-box}
.pl p{margin:0 0 4px}.pl .row{display:flex;justify-content:space-between;gap:12px}.pl .gap{height:10px}
.pl h4{font:700 10.5pt Georgia,'Times New Roman',serif;color:#${G};letter-spacing:.12em;text-transform:uppercase;border-bottom:1px solid #${GOLD};padding-bottom:3px;margin:14px 0 6px;break-after:avoid}
.pl ul,.pl ol{list-style:none;margin:0;padding:0}.pl li{position:relative;padding-left:20px;margin:0 0 3px;text-align:justify}
.pl ul li:before{content:"\\25C6";position:absolute;left:3px;top:.15em;font-size:7pt;color:#${GOLD}}
.pl ol{counter-reset:n}.pl ol li{counter-increment:n}.pl ol li:before{content:counter(n) ".";position:absolute;left:0;font-weight:700;color:#${G}}
.pl table.un{width:100%;border-collapse:collapse;font-size:9.5pt;margin:2px 0}.pl table.un th{background:#${G};color:#fff;font-weight:700;padding:5px 6px;border:1px solid #${GOLD};text-align:center}
.pl table.un td{background:#${CREAM};padding:5px 6px;border:1px solid #${GOLD};text-align:center}.pl table.un td:first-child,.pl table.un td.hg{font-weight:700}.pl table.un tr{break-inside:avoid}
.pl .nt{font-size:9pt;font-style:italic;color:#555;margin-top:3px}.pl .cols{display:grid;grid-template-columns:1fr 1fr;column-gap:16px}
.pl .st{display:grid;gap:0;border:1px solid #${GOLD};background:#${CREAM};break-inside:avoid}.pl .st div{padding:7px 6px;text-align:center;border-left:1px solid #${GOLD};font:700 9pt Arial;color:#${G}}.pl .st div:first-child{border-left:0}.pl .st b{display:block;font:700 15pt Georgia,serif;color:#${GOLD}}
.pl .sg{margin-top:12px;break-inside:avoid}.pl .sg .co{font-weight:700;color:#${G};margin-bottom:46px}.pl .sg .nm{font-weight:700;text-decoration:underline}.pl .hl{background:#fff3a6}
.pl p.j,.pl .j{text-align:justify}`;
  function blockHTML(b) {
    switch (b.k) {
      case 'meta': return '<p style="text-align:right;margin:0 0 10px">' + esc(b.date) + '</p><p style="margin:0">Nomor : ' + esc(b.no) + '</p><p style="margin-bottom:10px">Perihal : <b>' + esc(b.perihal) + '</b></p>';
      case 'addr': return '<div style="margin-bottom:10px">' + b.lines.map(l => '<p style="margin:0">' + (l.b ? '<b>' + esc(l.t) + '</b>' : esc(l.t)) + '</p>').join('') + '</div>';
      case 'p': return '<p class="' + (b.just ? 'j' : '') + '" style="margin-top:' + ((b.before || 0) / 20) + 'px;margin-bottom:' + (b.after != null ? b.after / 20 : 4) + 'px">' + ih(b.t) + '</p>';
      case 'h': return '<h4>' + esc(b.t) + '</h4>';
      case 'unit': return '<table class="un"><thead><tr>' + ['TYPE', 'EXTERIOR', 'INTERIOR', 'HARGA OTR JAKARTA', 'KETERANGAN'].map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' + b.rows.map(r => '<tr><td>' + esc(r.type || '-') + '</td><td>' + esc(r.ext || '-') + '</td><td>' + esc(r.int || '-') + '</td><td class="hg">' + esc(r.harga || '-') + '</td><td class="hg">' + esc(r.ket || '-') + '</td></tr>').join('') + '</tbody></table>';
      case 'note': return '<p class="nt">' + ih(b.t) + '</p>';
      case 'bul': return '<ul>' + b.items.map(i => '<li>' + ih(i) + '</li>').join('') + '</ul>';
      case 'num': return '<ol>' + b.items.map(i => '<li>' + ih(i) + '</li>').join('') + '</ol>';
      case 'cols': { const h = Math.ceil(b.items.length / 2), a = b.items.slice(0, h), c = b.items.slice(h); return '<div class="cols"><ul>' + a.map(i => '<li>' + ih(i) + '</li>').join('') + '</ul><ul>' + c.map(i => '<li>' + ih(i) + '</li>').join('') + '</ul></div>'; }
      case 'steps': { const rows = []; for (let i = 0; i < b.items.length; i += 4) rows.push(b.items.slice(i, i + 4)); return rows.map((r, ri) => '<div class="st" style="grid-template-columns:repeat(' + r.length + ',1fr);margin-top:' + (ri ? '-1px' : '0') + '">' + r.map((t, i) => '<div><b>' + (ri * 4 + i + 1) + '</b>' + ih(t) + '</div>').join('') + '</div>').join(''); }
      case 'sign': return '<div class="sg"><p style="margin:0">Hormat kami,</p><p class="co">' + esc(b.company) + '</p><p class="nm" style="margin:0">' + esc(b.name) + '</p><p style="margin:0">' + esc(b.role) + '</p>' + (b.hp ? '<p style="margin:0">Hp. ' + esc(b.hp) + '</p>' : '') + (b.email ? '<p style="margin:0">Email : ' + esc(b.email) + '</p>' : '') + '</div>';
    }
    return '';
  }
  const bodyHTML = d => '<div class="pl">' + d.map(blockHTML).join('') + '</div>';
  const abs = f => { try { return new URL('kop/' + f, document.baseURI).href; } catch (e) { return 'kop/' + f; } };
  function injectCSS() { if (document.getElementById('pl-css')) return; const s = document.createElement('style'); s.id = 'pl-css'; s.textContent = CSS + '.pl-sheet{width:794px;min-height:1123px;background:#fff;display:flex;flex-direction:column;box-shadow:0 2px 14px #0006;margin:0 auto}.pl-sheet>img{display:block}.pl-sheet .kh{width:794px}.pl-sheet .kf{width:640px;margin:0 auto 14px}.pl-sheet .bd{flex:1;padding:22px 76px 24px}'; document.head.appendChild(s); }
  /* satu lembar pratinjau (lebar A4 794px; atur zoom dari luar supaya muat di layar) */
  function sheetHTML(O, no) { return '<div class="pl-sheet"><img class="kh" src="' + abs('kop-header.png') + '" alt=""><div class="bd">' + bodyHTML(doc(O, no)) + '</div><img class="kf" src="' + abs('kop-footer.png') + '" alt=""></div>'; }

  /* ---------- Export PDF (jendela cetak: pilih "Simpan sebagai PDF") ---------- */
  function printHTML(O, no, title) {
    const css = CSS + '@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}.pg{width:210mm;border-collapse:collapse}.pg td{padding:0}.pg .kh{display:block;width:210mm;height:auto}.pg .bd{padding:7mm 20mm 0}.pg .sp{height:26mm}.kf{position:fixed;left:20mm;bottom:6mm;width:170mm;height:auto}';
    return '<!doctype html><html lang="id"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' + css + '</style></head><body><table class="pg"><thead><tr><td><img class="kh" src="' + abs('kop-header.png') + '" alt=""></td></tr></thead><tbody><tr><td class="bd">' + bodyHTML(doc(O, no)) + '</td></tr></tbody><tfoot><tr><td><div class="sp"></div></td></tr></tfoot></table><img class="kf" src="' + abs('kop-footer.png') + '" alt=""><script>window.addEventListener("load",function(){setTimeout(function(){window.focus();window.print()},350)})<\/script></body></html>';
  }
  function openWin() { try { return window.open('', '_blank'); } catch (e) { return null; } }
  function printPDF(O, no, title, win) {
    const html = printHTML(O, no, title); let w = win || openWin();
    if (w && w.document) { w.document.open(); w.document.write(html); w.document.close(); return true; }
    /* popup diblokir: cetak lewat bingkai tersembunyi */
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
    f.srcdoc = html.replace(/<script>.*<\/script>/, ''); f.onload = () => setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {} setTimeout(() => f.remove(), 60000); }, 500); return true;
  }

  /* ---------- Export Word (.docx asli, kop di header dan footer) ---------- */
  function loadDocx() {
    if (root.docx) return Promise.resolve(root.docx);
    return new Promise((ok, no) => { const s = document.createElement('script'); s.src = DOCX_URL; s.onload = () => ok(root.docx); s.onerror = () => no(new Error('Pustaka Word tidak bisa dimuat. Cek koneksi internet lalu coba lagi.')); document.head.appendChild(s); });
  }
  async function fetchImg(f) { const r = await fetch(abs(f)); if (!r.ok) throw new Error('Gambar kop ' + f + ' tidak ditemukan'); return new Uint8Array(await r.arrayBuffer()); }
  async function buildDocx(O, no, lib, imgs) {
    const d = lib || await loadDocx(), im = imgs || { h: await fetchImg('kop-header.png'), f: await fetchImg('kop-footer.png') };
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType, ImageRun, Header, Footer, TabStopType, Tab, VerticalAlign, LevelFormat, HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, TextWrappingType } = d;
    const FW = 9026, blocks = doc(O, no), refs = [];
    const TR = (t, o) => new TextRun(Object.assign({ text: t, font: 'Arial', size: 21 }, o || {}));
    const RR = (text, o) => runs(text).map(r => TR(r.t, Object.assign({ bold: r.b || (o && o.bold) }, o && { color: o.color, size: o.size, italics: o.italics })));
    const P = (children, o) => new Paragraph(Object.assign({ children: children, spacing: { before: 0, after: 60, line: 288 } }, o || {}));
    const border = (c, sz) => ({ style: BorderStyle.SINGLE, size: sz || 4, color: c || GOLD });
    const bAll = c => ({ top: border(c), bottom: border(c), left: border(c), right: border(c) });
    const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const noB = { top: none, bottom: none, left: none, right: none };
    const shade = f => ({ type: ShadingType.CLEAR, color: 'auto', fill: f });
    const out = [];
    const bulP = (t, ref) => P(RR(t), { numbering: { reference: ref || 'bul', level: 0 }, alignment: AlignmentType.JUSTIFIED, spacing: { before: 0, after: 50, line: 288 } });
    blocks.forEach(b => {
      if (b.k === 'meta') {
        out.push(P([TR(b.date)], { alignment: AlignmentType.RIGHT, spacing: { after: 200, line: 288 } }));
        out.push(P([TR('Nomor : ' + b.no)], { spacing: { after: 0, line: 288 } }));
        out.push(P([TR('Perihal : '), TR(b.perihal, { bold: true })], { spacing: { after: 200, line: 288 } }));
      } else if (b.k === 'addr') b.lines.forEach((l, i) => out.push(P([TR(l.t, { bold: !!l.b })], { spacing: { after: i === b.lines.length - 1 ? 200 : 0, line: 288 } })));
      else if (b.k === 'p') out.push(P(RR(b.t), { alignment: b.just ? AlignmentType.JUSTIFIED : AlignmentType.LEFT, spacing: { before: b.before || 0, after: b.after != null ? b.after : 80, line: 288 } }));
      else if (b.k === 'h') out.push(P([TR(b.t, { bold: true, font: 'Georgia', size: 21, color: G, allCaps: true, characterSpacing: 24 })], { keepNext: true, spacing: { before: 240, after: 100, line: 288 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 3, color: GOLD } } }));
      else if (b.k === 'unit') {
        const W = [2700, 1350, 1400, 2000, 1576], cell = (t, w, o) => new TableCell({ width: { size: w, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, margins: { top: 70, bottom: 70, left: 80, right: 80 }, borders: bAll(), shading: o && o.fill ? shade(o.fill) : undefined, children: [P([TR(t, { size: 19, bold: !!(o && o.b), color: o && o.color })], { alignment: AlignmentType.CENTER, spacing: { after: 0, line: 276 } })] });
        const head = new TableRow({ tableHeader: true, children: ['TYPE', 'EXTERIOR', 'INTERIOR', 'HARGA OTR JAKARTA', 'KETERANGAN'].map((h, i) => cell(h, W[i], { fill: G, b: true, color: 'FFFFFF' })) });
        const body = b.rows.map(r => new TableRow({ cantSplit: true, children: [[r.type, 1], [r.ext, 0], [r.int, 0], [r.harga, 1], [r.ket, 1]].map((c, i) => cell(c[0] || '-', W[i], { fill: CREAM, b: !!c[1] })) }));
        out.push(new Table({ width: { size: FW, type: WidthType.DXA }, columnWidths: W, rows: [head].concat(body) }));
      } else if (b.k === 'note') out.push(P(RR(b.t, { italics: true, size: 18, color: '555555' }), { spacing: { before: 60, after: 0, line: 276 } }));
      else if (b.k === 'bul') b.items.forEach(t => out.push(bulP(t)));
      else if (b.k === 'num') { const ref = 'num' + refs.length; refs.push(ref); b.items.forEach(t => out.push(bulP(t, ref))); }
      else if (b.k === 'cols') {
        const h = Math.ceil(b.items.length / 2), mk = items => new TableCell({ width: { size: FW / 2, type: WidthType.DXA }, borders: noB, margins: { top: 0, bottom: 0, left: 0, right: 120 }, children: items.length ? items.map(t => bulP(t)) : [P([TR('')])] });
        out.push(new Table({ width: { size: FW, type: WidthType.DXA }, columnWidths: [FW / 2, FW / 2], borders: Object.assign({ insideHorizontal: none, insideVertical: none }, noB), rows: [new TableRow({ children: [mk(b.items.slice(0, h)), mk(b.items.slice(h))] })] }));
      } else if (b.k === 'steps') {
        const rows = []; for (let i = 0; i < b.items.length; i += 4) rows.push(b.items.slice(i, i + 4));
        rows.forEach((r, ri) => { const w = Math.floor(FW / r.length), W = r.map((x, i) => i === r.length - 1 ? FW - w * (r.length - 1) : w); out.push(new Table({ width: { size: FW, type: WidthType.DXA }, columnWidths: W, rows: [new TableRow({ cantSplit: true, children: r.map((t, i) => new TableCell({ width: { size: W[i], type: WidthType.DXA }, borders: bAll(), shading: shade(CREAM), margins: { top: 90, bottom: 90, left: 80, right: 80 }, verticalAlign: VerticalAlign.CENTER, children: [P([TR(String(ri * 4 + i + 1), { font: 'Georgia', size: 30, bold: true, color: GOLD })], { alignment: AlignmentType.CENTER, spacing: { after: 20 } }), P(RR(t, { size: 18, bold: true, color: G }), { alignment: AlignmentType.CENTER, spacing: { after: 0, line: 252 } })] })) })] })); });
      } else if (b.k === 'sign') {
        out.push(P([TR('Hormat kami,')], { keepNext: true, spacing: { before: 240, after: 0, line: 288 } }));
        out.push(P([TR(b.company, { bold: true, color: G })], { keepNext: true, spacing: { after: 700, line: 288 } }));
        out.push(P([TR(b.name, { bold: true, underline: {} })], { keepNext: true, spacing: { after: 0, line: 288 } }));
        out.push(P([TR(b.role)], { keepNext: true, spacing: { after: 0, line: 288 } }));
        if (b.hp) out.push(P([TR('Hp. ' + b.hp)], { keepNext: true, spacing: { after: 0, line: 288 } }));
        if (b.email) out.push(P([TR('Email : ' + b.email)], { spacing: { after: 0, line: 288 } }));
      }
      if (b.k === 'unit' || b.k === 'cols' || b.k === 'steps') out.push(P([TR('')], { spacing: { after: 0, line: 120 } }));
    });
    const numbering = { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '◆', alignment: AlignmentType.LEFT, style: { run: { color: GOLD, size: 14 }, paragraph: { indent: { left: 360, hanging: 360 } } } }] }].concat(refs.map(r => ({ reference: r, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { run: { bold: true, color: G, font: 'Arial', size: 21 }, paragraph: { indent: { left: 360, hanging: 360 } } } }] }))) };
    const hdr = new Header({ children: [new Paragraph({ children: [new ImageRun({ type: 'png', data: im.h, transformation: { width: 794, height: 111 }, floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 }, verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 }, behindDocument: true, allowOverlap: true, wrap: { type: TextWrappingType.NONE } } })] })] });
    const ftr = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: im.f, transformation: { width: 600, height: 56 } })] })] });
    const dc = new Document({ creator: O.sign && O.sign.name || 'XPENG', title: 'Surat Penawaran ' + no, styles: { default: { document: { run: { font: 'Arial', size: 21 } } } }, numbering: numbering, sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1850, bottom: 1400, left: 1440, right: 1440, header: 0, footer: 200 } } }, headers: { default: hdr }, footers: { default: ftr }, children: out }] });
    return Packer.toBlob(dc);
  }
  const fname = (O, no, ext) => ('Penawaran ' + String(no).replace(/\//g, '-') + ' ' + (O.perusahaan || '')).replace(/[\\:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() + '.' + ext;
  async function exportWord(O, no) {
    const blob = await buildDocx(O, no), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname(O, no, 'docx'); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }

  root.PN = { defaults, mergeTpl, newOffer, nomor, dateText, mobil, autoPerihal, rowFrom, doc, sheetHTML, injectCSS, printHTML, printPDF, openWin, buildDocx, exportWord, fname, rpFmt, esc, clone };
})(typeof window !== 'undefined' ? window : globalThis);
