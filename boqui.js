/* StructCap BOQ — warehouse / factory bill of quantities: building data, live sketch, BOQ (ปร.4 style), summary (ปร.5 style),
   editable unit prices, additional items, Excel (with live formulas) and PDF report. Engine: boq.js */
(function (G) {
  'use strict';
  G.SC_BOQ_UI = function (ctx) {
    const { T, esc, f, $, S, toast, isPro, COPY, logoMark, today, saveFile, render } = ctx;
    const Q = G.BOQ, VIEW = 'boqwh', LS = 'sc.boqwh.v1';
    const store = { get() { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(LS, JSON.stringify(v)); } catch (e) { } } };
    const fresh = () => { const d = Q.defaults(); d.meta.date = today(); return d; };
    const merge = (d, s) => { Object.keys(s || {}).forEach(k => { if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && d[k] && typeof d[k] === 'object') merge(d[k], s[k]); else d[k] = s[k]; }); return d; };
    const A = { B: merge(fresh(), store.get() || {}), sel: 'geo', rib: 'home', hist: [], fut: [], calc: true };
    const lang = () => (S.ui === 'th' ? 'th' : 'en');
    const persist = () => store.set(A.B);
    const snap = () => { A.hist.push(JSON.stringify(A.B)); if (A.hist.length > 60) A.hist.shift(); A.fut = []; };
    const undo = redo => { const from = redo ? A.fut : A.hist, to = redo ? A.hist : A.fut; if (!from.length) return; to.push(JSON.stringify(A.B)); A.B = JSON.parse(from.pop()); persist(); refresh(); };
    const R = () => Q.compute(A.B, lang());
    const baht = v => (v == null || !isFinite(v) ? '—' : (+v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    const qf = v => (+v).toLocaleString('en-US', { maximumFractionDigits: 2 });
    function setPath(path, v) { const ks = path.split('.'); let o = A.B; for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; o = o[ks[i]]; } o[ks[ks.length - 1]] = v; }
    function getPath(path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), A.B); }

    // ------------------------------------------------------------------ ribbon
    const IC = { new: '<path d="M6 3h8l4 4v14H6zM14 3v4h4M12 10v7M8.5 13.5h7"/>', open: '<path d="M3 7h6l2 2h10v10H3zM3 11h18"/>', save: '<path d="M5 3h12l3 3v15H5zM8 3v5h8V3M8 14h8v7H8z"/>', undo: '<path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-3"/>', redo: '<path d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h3"/>',
      geo: '<path d="M3 20V10l9-6 9 6v10M3 20h18M7 20v-6M17 20v-6"/>', steel: '<path d="M4 4h16M4 20h16M12 4v16M8 4v2M16 4v2M8 20v-2M16 20v-2"/>', roof: '<path d="M2 12l10-7 10 7M5 10v10h14V10"/>', wall: '<path d="M3 5h18v14H3zM3 10h18M3 15h18M9 5v5M15 10v5M9 15v4"/>', fnd: '<path d="M8 3h8v6H8zM4 9h16v4H4zM7 13v8M12 13v8M17 13v8"/>',
      slab: '<path d="M2 15l6-5h14l-6 5zM2 15v3h14v-3M16 18l6-5v-3"/>', price: '<path d="M4 4h10l6 6-10 10-6-6zM8 8h.01"/>', extra: '<path d="M12 5v14M5 12h14"/>', boq: '<path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/>', sum: '<path d="M18 4H6l7 8-7 8h12"/>', xls: '<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 11l5 6M14 11l-5 6"/>', pdf: '<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6"/>' };
    const icon = (k, big) => `<svg class="an-ic ${big ? 'big' : ''}" viewBox="0 0 24 24" aria-hidden="true">${IC[k] || IC.boq}</svg>`;
    function RIB() {
      return [
        ['file', T('File', 'ไฟล์'), [[T('Project file', 'ไฟล์โครงการ'), [{ c: 'new', i: 'new', l: T('New', 'ใหม่') }, { file: 1, i: 'open', l: T('Open', 'เปิด') }, { c: 'save', i: 'save', l: T('Save', 'บันทึก') }]], [T('Export', 'ส่งออก'), [{ c: 'xlsx', i: 'xls', l: T('Excel BOQ', 'Excel BOQ') }, { c: 'report', i: 'pdf', l: T('Report / PDF', 'รายงาน / PDF') }]]]],
        ['home', T('Building', 'ข้อมูลอาคาร'), [[T('Building data', 'ข้อมูลอาคาร'), [{ c: 'sel', v: 'geo', i: 'geo', l: T('Size & frames', 'ขนาดและโครง') }, { c: 'sel', v: 'steel', i: 'steel', l: T('Steel', 'โครงเหล็ก') }, { c: 'sel', v: 'roof', i: 'roof', l: T('Roof', 'หลังคา') }, { c: 'sel', v: 'wall', i: 'wall', l: T('Walls & doors', 'ผนัง ประตู') }, { c: 'sel', v: 'fnd', i: 'fnd', l: T('Foundations', 'ฐานราก') }, { c: 'sel', v: 'slab', i: 'slab', l: T('Slab & drains', 'พื้น ระบายน้ำ') }]],
          [T('Prices', 'ราคา'), [{ c: 'sel', v: 'price', i: 'price', l: T('Unit prices', 'ราคาต่อหน่วย') }, { c: 'sel', v: 'extra', i: 'extra', l: T('Extra items', 'รายการเพิ่ม') }]], [T('Results', 'ผลลัพธ์'), [{ c: 'sel', v: 'boq', i: 'boq', l: 'BOQ' }, { c: 'sel', v: 'sum', i: 'sum', l: T('Summary', 'สรุปราคา') }]]]]
      ];
    }
    function rbtn(it, big) { const lab = esc(it.l); if (it.file) return `<label class="an-rb ${big ? 'big' : 'sm'}" title="${lab}">${icon(it.i, big)}<span>${lab}</span><input type="file" accept=".json,application/json" id="bq-file" hidden></label>`; return `<button class="an-rb ${big ? 'big' : 'sm'}" data-act="bq-rb" data-c="${it.c}" ${it.v ? `data-v="${esc(it.v)}"` : ''} aria-pressed="${!!it.v && A.sel === it.v}" title="${lab}">${icon(it.i, big)}<span>${lab}</span></button>`; }
    function ribHTML() { const tabs = RIB(), cur = tabs.find(t => t[0] === A.rib) || tabs[1]; return `<div class="an-rib" id="bqRib"><div class="an-ribtabs" role="tablist">${tabs.map(t => `<button role="tab" class="an-rtab" data-act="bq-ribtab" data-t="${t[0]}" aria-selected="${t[0] === cur[0]}">${t[1]}</button>`).join('')}<span class="grow"></span><span class="an-qat">${[['undo', 'undo', T('Undo', 'เลิกทำ')], ['redo', 'redo', T('Redo', 'ทำซ้ำ')], ['save', 'save', T('Save', 'บันทึก')], ['xlsx', 'xls', 'Excel']].map(([c, i, l]) => `<button class="an-qb" data-act="bq-rb" data-c="${c}" title="${esc(l)}" aria-label="${esc(l)}">${icon(i)}</button>`).join('')}</span></div><div class="an-ribbar" role="toolbar">${cur[2].map(([title, items]) => `<div class="an-rg"><div class="an-rgi">${items.map(it => rbtn(it, true)).join('')}</div><div class="an-rgt">${title}</div></div>`).join('')}</div></div>`; }
    const ribRefresh = () => { const r = $('#bqRib'); if (r) r.outerHTML = ribHTML(); };

    // ------------------------------------------------------------------ navigation tree with running totals
    function treeHTML(r) {
      const tn = (k, l, x) => `<li><button class="an-tl2 cn-tl ${A.sel === k ? 'on' : ''}" data-act="bq-sel" data-k="${k}"><span class="an-tlt">${l}</span>${x || ''}</button></li>`;
      const g = r.geo, tag = s => `<span class="muted small">${s}</span>`;
      return `<div class="an-wtree cn-tree"><ul class="an-wt">
        <li class="bq-tt"><b>${esc(A.B.meta.name || T('Warehouse', 'โกดัง'))}</b><span class="muted small">${qf(g.W)} × ${qf(g.L)} ${T('m', 'ม.')} · ${qf(r.area)} ${T('m²', 'ตร.ม.')}</span></li>
        ${tn('proj', T('Project', 'ข้อมูลโครงการ'))}${tn('geo', T('Size & frames', 'ขนาดและโครงอาคาร'), tag(g.nf + T(' frames', ' โครง')))}${tn('steel', T('Structural steel', 'โครงสร้างเหล็ก'), tag(qf((r.steel.main + r.steel.plates + r.steel.purl + r.steel.girt) / 1000) + ' t'))}
        ${tn('roof', T('Roof', 'หลังคา'), tag(qf(r.Aroof) + ' m²'))}${tn('wall', T('Walls, doors, windows', 'ผนัง ประตู หน้าต่าง'))}${tn('fnd', T('Foundations & tie beams', 'ฐานรากและคานคอดิน'), tag(r.nCol + T(' footings', ' ฐาน')))}${tn('slab', T('Slab, drains, site', 'พื้น ระบายน้ำ พื้นที่'))}
        <li class="bq-th">${T('Prices', 'ราคา')}</li>${tn('price', T('Unit prices', 'ราคาต่อหน่วย'), Object.keys(A.B.price || {}).length ? tag(Object.keys(A.B.price).length + T(' edited', ' แก้ไข')) : '')}${tn('extra', T('Additional items', 'รายการเพิ่มเติม'), (A.B.extra || []).length ? tag((A.B.extra || []).length) : '')}
        <li class="bq-th">${T('Results', 'ผลลัพธ์')}</li>${tn('boq', T('Bill of quantities', 'บัญชีแสดงปริมาณงาน (BOQ)'), tag(r.items.length + T(' items', ' รายการ')))}${tn('sum', T('Price summary', 'สรุปราคา'))}
        <li class="bq-tot"><span>${T('Total', 'รวมทั้งสิ้น')}</span><b>${baht(r.grand)}</b><span class="muted small">${baht(r.perM2)} ${T('THB/m²', 'บาท/ตร.ม.')}</span></li></ul></div>`;
    }

    // ------------------------------------------------------------------ sketch: cross-section and plan
    function sketch(r) {
      const g = r.geo, B = A.B, hb = B.wall.sheet ? Math.min(g.H, +B.wall.hb || 0) : g.H, Df = +B.fnd.Df || 1.5;
      // cross-section in a 420 x 230 box
      const sx = 380 / (g.W + 4), sy = Math.min(sx, 170 / (g.H + g.rise + Df + 1)), k = Math.min(sx, sy), ox = 20 + 2 * k, gy = 30 + (g.H + g.rise + 0.5) * k, X = x => ox + x * k, Y = y => gy - y * k;
      let s = `<g class="bq-sk">`;
      s += `<line x1="8" y1="${Y(0)}" x2="${X(g.W) + 2 * k + 12}" y2="${Y(0)}" class="gl"/>`;
      const cols = [0, ...g.inner, g.W];
      cols.forEach(x => { const h = g.hAt(x); s += `<line x1="${X(x)}" y1="${Y(0)}" x2="${X(x)}" y2="${Y(h)}" class="st"/>`; const fb = (+B.fnd.B || 1.5) / 2; s += `<rect x="${X(x - fb)}" y="${Y(-Df + (+B.fnd.D || 0.5))}" width="${2 * fb * k}" height="${(+B.fnd.D || 0.5) * k}" class="cc"/><line x1="${X(x)}" y1="${Y(-Df)}" x2="${X(x)}" y2="${Y(-Df) + 18}" class="pl"/>`; });
      s += `<polyline points="${X(-g.eo)},${Y(g.H - g.eo * Math.tan(g.th))} ${X(g.a)},${Y(g.H + g.rise)} ${X(g.W + g.eo)},${Y(g.H - g.eo * Math.tan(g.th))}" class="rf"/>`;
      s += `<polyline points="${X(0)},${Y(g.H)} ${X(g.a)},${Y(g.H + g.rise)} ${X(g.W)},${Y(g.H)}" class="st"/>`;
      if (hb > 0) [0, g.W].forEach(x => { s += `<rect x="${X(x) - (x ? 0 : 4)}" y="${Y(hb)}" width="4" height="${hb * k}" class="bw"/>`; });
      s += `<rect x="${X(0)}" y="${Y(0.15)}" width="${g.W * k}" height="${0.15 * k + 2}" class="cc"/>`;
      s += `<text x="${X(g.a)}" y="${Y(0) + 34}" class="dm">${T('span', 'ช่วงกว้าง')} ${qf(g.W)} ${T('m', 'ม.')}</text><text x="${X(g.W) + 10}" y="${Y(g.H / 2)}" class="dm" text-anchor="start">H ${qf(g.H)}</text><text x="${X(g.a)}" y="${Y(g.H + g.rise) - 6}" class="dm">${qf(g.deg)}°</text>`;
      s += `<text x="10" y="16" class="tt">${T('CROSS-SECTION', 'รูปตัดขวาง')}</text></g>`;
      // plan in a 340 x 230 box
      const pk = Math.min(300 / g.L, 170 / g.W), px = 450, py = 40, PX = x => px + x * pk, PY = y => py + y * pk;
      let p = `<g class="bq-sk"><text x="${px}" y="16" class="tt">${T('PLAN', 'แปลน')} · ${g.nf} ${T('frames @', 'โครง @')} ${qf(g.bay)} ${T('m', 'ม.')}</text><rect x="${PX(0)}" y="${PY(0)}" width="${g.L * pk}" height="${g.W * pk}" class="pw"/>`;
      for (let i = 0; i < g.nf; i++) { const x = i * g.bay; p += `<line x1="${PX(x)}" y1="${PY(0)}" x2="${PX(x)}" y2="${PY(g.W)}" class="fr"/>`; cols.forEach(y => { p += `<rect x="${PX(x) - 2.5}" y="${PY(y) - 2.5}" width="5" height="5" class="cl"/>`; }); }
      g.gx.forEach(y => { [0, g.L].forEach(x => { p += `<rect x="${PX(x) - 2}" y="${PY(y) - 2}" width="4" height="4" class="gp"/>`; }); });
      const nbr = Math.min(g.nf - 1, Math.max(0, Math.round(+B.frame.brace || 0)));
      for (let i = 0; i < nbr; i++) { const b = i % 2 ? g.nf - 2 - Math.floor(i / 2) : Math.floor(i / 2) + 0; const x0 = b * g.bay, x1 = x0 + g.bay; p += `<path d="M${PX(x0)},${PY(0)}L${PX(x1)},${PY(g.W)}M${PX(x0)},${PY(g.W)}L${PX(x1)},${PY(0)}" class="br"/>`; }
      const rs = Math.round(+B.open.rsN || 0); for (let i = 0; i < rs; i++) { const side = i % 2, w = (+B.open.rsW || 5) * pk, x = side ? PX(g.L) : PX(0), y = PY(g.W / 2) - w / 2 + (Math.floor(i / 2) ? w * 1.4 : 0); p += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + w}" class="rs"/>`; }
      p += `<text x="${PX(g.L / 2)}" y="${PY(g.W) + 16}" class="dm">${qf(g.L)} ${T('m', 'ม.')}</text><text x="${PX(0) - 12}" y="${PY(g.W / 2) + 4}" class="dm" text-anchor="end">${qf(g.W)}</text></g>`;
      return `<svg viewBox="0 0 800 ${Math.max(gy + Df * k + 40, PY(g.W) + 26)}" class="bq-svg" role="img" aria-label="${T('Warehouse cross-section and plan', 'รูปตัดและแปลนโกดัง')}">${s}${p}</svg>`;
    }

    // ------------------------------------------------------------------ input widgets
    const inp = (path, o) => { o = o || {}; const v = getPath(path); if (o.sel) return `<select data-bq="${esc(path)}" ${o.num ? 'data-num="1"' : ''}>${o.sel.map(q => `<option value="${esc(q[0])}" ${String(q[0]) === String(v) ? 'selected' : ''}>${esc(q[1])}</option>`).join('')}</select>`; if (o.chk) return `<input type="checkbox" data-bq="${esc(path)}" data-chk="1" ${v ? 'checked' : ''}>`; return `<input ${o.text ? '' : 'type="number" step="any" data-num="1"'} data-bq="${esc(path)}" value="${esc(v == null ? '' : v)}">`; };
    const fld = (path, lbl, unit, o) => `<label class="cn-f"><span>${lbl}${unit ? ` <i>${unit}</i>` : ''}</span>${inp(path, o)}</label>`;
    const grid = h => `<div class="bq-grid">${h}</div>`, hint = h => `<p class="hint">${h}</p>`, h3 = h => `<h3>${h}</h3>`;
    const HS = Object.keys(Q.HSEC).map(k => [k, k + ' · ' + Q.HSEC[k][4] + ' ' + T('kg/m', 'กก./ม.')]), CS = Q.CSEC.map(k => [k, k + ' · ' + Q.cInfo(k).w + ' ' + T('kg/m', 'กก./ม.')]);
    const yes = [[true, T('Yes', 'มี')], [false, T('No', 'ไม่มี')]];
    function panelHTML(r) {
      const g = r.geo, m = T('m', 'ม.'), mm = T('mm', 'มม.'), pc = '%';
      switch (A.sel) {
        case 'proj': return h3(T('Project', 'ข้อมูลโครงการ')) + grid(fld('meta.name', T('Building', 'ชื่ออาคาร'), '', { text: 1 }) + fld('meta.owner', T('Owner', 'เจ้าของโครงการ'), '', { text: 1 }) + fld('meta.location', T('Location', 'สถานที่ก่อสร้าง'), '', { text: 1 }) + fld('meta.date', T('Date', 'วันที่'), '', { text: 1 })) + hint(T('Steel portal-frame warehouse or factory on piled pad footings with a slab on grade. Change any value — the quantities, prices and sketch update at once.', 'โกดัง/โรงงานโครงเหล็กพอร์ทัลบนฐานรากเสาเข็ม พื้นวางบนดิน แก้ค่าใดก็ได้ ปริมาณ ราคา และรูปจะเปลี่ยนทันที'));
        case 'geo': return h3(T('Size and frames', 'ขนาดและโครงอาคาร')) + grid(fld('geo.W', T('Building width (span)', 'ความกว้างอาคาร (ช่วงพาด)'), m) + fld('geo.L', T('Building length', 'ความยาวอาคาร'), m) + fld('geo.s', T('Frame spacing (bay)', 'ระยะห่างโครง'), m) + fld('geo.H', T('Eave height', 'ความสูงชายคา'), m) + fld('geo.pitch', T('Roof pitch', 'ความลาดหลังคา'), T('deg', 'องศา')) + fld('geo.spans', T('Spans across (internal column lines + 1)', 'จำนวนช่วงตามขวาง (แนวเสากลาง + 1)'), '', { sel: [[1, '1'], [2, '2'], [3, '3'], [4, '4']], num: 1 }) + fld('geo.eo', T('Eave overhang', 'ชายคายื่น'), m) + fld('geo.go', T('Gable overhang', 'หลังคายื่นด้านจั่ว'), m))
          + hint(`${g.nf} ${T('frames at', 'โครง ระยะ')} ${qf(g.bay)} ${m} · ${T('rafter', 'ความยาวจันทัน')} ${qf(g.rafter)} ${m} ${T('each side', 'ต่อด้าน')} · ${T('ridge', 'ยอดจั่ว')} +${qf(g.H + g.rise)} ${m}`);
        case 'steel': return h3(T('Structural steel', 'โครงสร้างเหล็ก')) + grid(fld('frame.col', T('Columns', 'เสา'), '', { sel: HS }) + fld('frame.raf', T('Rafters', 'คานหลังคา (Rafter)'), '', { sel: HS }) + fld('frame.gcol', T('Gable wind posts', 'เสากันลมผนังหัวท้าย'), '', { sel: HS }) + fld('frame.gsp', T('Gable post spacing', 'ระยะเสากันลม'), m) + fld('frame.conn', T('Plates and bolts', 'แผ่นต่อและสลักเกลียว'), T('% of H steel', '% ของเหล็ก H')) + fld('frame.nb', T('Anchor bolts per column', 'สลักยึดฐานต่อเสา'), T('no.', 'ตัว')) + fld('frame.brace', T('Braced bays', 'จำนวนช่วงที่มีค้ำยัน'), '') + fld('frame.rodD', T('Bracing rod dia.', 'ขนาดเหล็กค้ำยัน'), mm) + fld('frame.sag', T('Sag rods', 'Sag rod'), '', { sel: yes })
          + fld('purl.sec', T('Purlins', 'แป'), '', { sel: CS }) + fld('purl.sp', T('Purlin spacing', 'ระยะแป'), m) + fld('purl.girt', T('Wall girts', 'เคร่าผนัง'), '', { sel: CS }) + fld('purl.gsp', T('Girt spacing', 'ระยะเคร่า'), m) + fld('purl.lap', T('Laps / waste', 'ระยะทาบ/เผื่อ'), pc))
          + hint(T('Section sizes are for estimating; check them with a structural design. Steel weight: ', 'ขนาดหน้าตัดใช้เพื่อประมาณราคา ต้องตรวจสอบกับการออกแบบโครงสร้าง น้ำหนักเหล็ก: ') + `H ${qf(r.steel.main)} + ${T('plates', 'แผ่นต่อ')} ${qf(r.steel.plates)} + ${T('purlins', 'แป')} ${qf(r.steel.purl)} + ${T('girts', 'เคร่า')} ${qf(r.steel.girt)} ${T('kg', 'กก.')} = ${qf((r.steel.main + r.steel.plates + r.steel.purl + r.steel.girt) / r.area)} ${T('kg/m²', 'กก./ตร.ม.')}`);
        case 'roof': return h3(T('Roof', 'หลังคา')) + grid(fld('roof.sheet', T('Roof sheet', 'แผ่นหลังคา'), '', { sel: [['roof047', T('Metal sheet 0.47 mm', 'เมทัลชีท 0.47 มม.')], ['roof035', T('Metal sheet 0.35 mm', 'เมทัลชีท 0.35 มม.')]] }) + fld('roof.ins', T('Insulation', 'ฉนวนกันความร้อน'), '', { sel: [['none', T('None', 'ไม่มี')], ['pu', T('PU foam 25 mm (bonded)', 'โฟม PU 25 มม. ติดแผ่น')], ['blanket', T('Glass-wool blanket', 'ฉนวนใยแก้ว')]] }) + fld('roof.sky', T('Translucent sheets', 'แผ่นโปร่งแสง'), T('% of roof', '% ของหลังคา')) + fld('roof.gutter', T('Gutters and downpipes', 'รางน้ำและท่อน้ำฝน'), '', { sel: yes }) + fld('roof.dpEvery', T('Downpipe every', 'ท่อน้ำฝนทุก'), T('bays', 'ช่วง')));
        case 'wall': return h3(T('Walls, doors and windows', 'ผนัง ประตู หน้าต่าง')) + grid(fld('wall.hb', T('Block wall height', 'ความสูงผนังก่อ'), m) + fld('wall.sides', T('Plastered sides', 'ฉาบปูน'), '', { sel: [[0, T('none', 'ไม่ฉาบ')], [1, T('one side', '1 ด้าน')], [2, T('both sides', '2 ด้าน')]], num: 1 }) + fld('wall.sheet', T('Metal sheet above', 'เมทัลชีทเหนือผนังก่อ'), '', { sel: [[true, T('Yes', 'มี')], [false, T('No — open sides', 'ไม่มี (เปิดโล่ง)')]] }) + fld('wall.win', T('Windows / louvres', 'หน้าต่าง/เกล็ด'), T('m²', 'ตร.ม.'))
          + fld('open.rsN', T('Roller shutters', 'ประตูม้วน'), T('no.', 'บาน')) + fld('open.rsW', T('Shutter width', 'กว้าง'), m) + fld('open.rsH', T('Shutter height', 'สูง'), m) + fld('open.doorN', T('Steel doors 1.0 × 2.1 m', 'ประตูเหล็ก 1.0 × 2.1 ม.'), T('no.', 'ชุด'))) + hint(T('Without metal sheet the block wall runs full height to the eave when its height is set to the eave.', 'ถ้าไม่มีเมทัลชีท ผนังก่อจะสูงตามที่กำหนด ด้านบนเปิดโล่ง'));
        case 'fnd': return h3(T('Foundations', 'ฐานราก')) + grid(fld('fnd.B', T('Footing width', 'ฐานกว้าง'), m) + fld('fnd.Lf', T('Footing length', 'ฐานยาว'), m) + fld('fnd.D', T('Footing depth', 'ฐานหนา'), m) + fld('fnd.Df', T('Depth to underside', 'ความลึกถึงใต้ฐาน'), m) + fld('fnd.c', T('Pedestal size', 'ตอม่อ'), m) + fld('fnd.nP', T('Piles per footing', 'เข็มต่อฐาน'), T('no.', 'ต้น')) + fld('fnd.pileL', T('Pile length', 'ความยาวเข็ม'), m) + fld('fnd.pileType', T('Pile type', 'ชนิดเข็ม'), '', { text: 1 })
          + fld('fnd.gB', T('Gable footing width', 'ฐานเสากันลม กว้าง'), m) + fld('fnd.gLf', T('Gable footing length', 'ฐานเสากันลม ยาว'), m) + fld('fnd.gD', T('Gable footing depth', 'ฐานเสากันลม หนา'), m) + fld('fnd.gNP', T('Piles per gable footing', 'เข็มต่อฐานเสากันลม'), T('no.', 'ต้น')) + fld('fnd.rf', T('Rebar in footings', 'เหล็กเสริมฐาน'), T('kg/m³', 'กก./ลบ.ม.')) + fld('fnd.rp', T('Rebar in pedestals', 'เหล็กเสริมตอม่อ'), T('kg/m³', 'กก./ลบ.ม.')) + fld('fnd.lean', T('Lean concrete', 'คอนกรีตหยาบ'), m) + fld('fnd.sand', T('Sand bedding', 'ทรายรองพื้น'), m))
          + h3(T('Tie beams', 'คานคอดิน')) + grid(fld('tie.b', T('Width', 'กว้าง'), m) + fld('tie.h', T('Depth', 'ลึก'), m) + fld('tie.rt', T('Rebar', 'เหล็กเสริม'), T('kg/m³', 'กก./ลบ.ม.')) + fld('tie.inner', T('Also on inner column lines', 'แนวเสากลางด้วย'), '', { sel: yes })) + hint(T('Footing sizes, piles and reinforcement ratios are estimating values — use the foundation design for the tender BOQ.', 'ขนาดฐาน เสาเข็ม และอัตราส่วนเหล็กเสริมเป็นค่าประมาณ ใช้ผลการออกแบบฐานรากสำหรับ BOQ ประกวดราคา'));
        case 'slab': return h3(T('Ground slab', 'พื้นวางบนดิน')) + grid(fld('slab.t', T('Slab thickness', 'ความหนาพื้น'), m) + fld('slab.fill', T('Compacted sand fill', 'ทรายถมบดอัด'), m) + fld('slab.base', T('Crushed rock base', 'หินคลุก'), m) + fld('slab.poly', T('Moisture barrier', 'พลาสติกกันชื้น'), '', { sel: yes }) + fld('slab.mesh', T('Wire mesh', 'ตะแกรงเหล็ก (Wire mesh)'), '', { sel: yes }) + fld('slab.rs', T('Or bar reinforcement', 'หรือเหล็กเสริม'), T('kg/m³', 'กก./ลบ.ม.')) + fld('slab.joint', T('Joint spacing', 'ระยะรอยต่อ'), m) + fld('slab.hard', T('Floor hardener', 'ผิวขัดมัน+Hardener'), '', { sel: yes }))
          + h3(T('Drainage and site', 'ระบายน้ำและพื้นที่')) + grid(fld('drain.ditch', T('Perimeter drain', 'รางระบายน้ำรอบอาคาร'), '', { sel: yes }) + fld('site.clear', T('Site clearing', 'ปรับพื้นที่'), '', { sel: yes }) + fld('site.margin', T('Margin around building', 'ระยะเผื่อรอบอาคาร'), m));
        case 'price': {
          const rows = Object.keys(Q.PRICE).map(k => { const d = Q.PRICE[k], p = (A.B.price || {})[k] || {}, ed = p.mat != null || p.lab != null; return `<tr class="${ed ? 'bq-ed' : ''}"><td class="tb-wrap">${esc(lang() === 'th' ? d[3] : d[4])}</td><td>${esc(d[2])}</td><td><input type="number" step="any" data-bqp="${k}.mat" value="${esc(p.mat != null ? p.mat : d[0])}"></td><td><input type="number" step="any" data-bqp="${k}.lab" value="${esc(p.lab != null ? p.lab : d[1])}"></td><td class="num">${baht((p.mat != null ? +p.mat : d[0]) + (p.lab != null ? +p.lab : d[1]))}</td></tr>`; }).join('');
          return h3(T('Unit prices (THB)', 'ราคาต่อหน่วย (บาท)')) + `<p class="hint bq-warn">${T('These are SAMPLE prices for a first estimate, not an official price list. Replace them with the provincial material prices (สำนักงานพาณิชย์จังหวัด), the Comptroller General\'s labour rates or your suppliers\' quotations.', 'เป็นราคาตัวอย่างสำหรับประมาณการเบื้องต้น ไม่ใช่ราคากลางทางการ ให้แก้เป็นราคาวัสดุของสำนักงานพาณิชย์จังหวัด อัตราค่าแรงของกรมบัญชีกลาง หรือราคาที่ผู้ขายเสนอ')}</p><div class="cn-btns"><button class="btn btn-ghost xs" data-act="bq-rb" data-c="preset">${T('Reset all to sample prices', 'คืนค่าราคาตัวอย่างทั้งหมด')}</button><button class="btn btn-ghost xs" data-act="bq-rb" data-c="pricesave">${T('Save price list', 'บันทึกบัญชีราคา')}</button><label class="btn btn-ghost xs">${T('Load price list', 'โหลดบัญชีราคา')}<input type="file" accept=".json" id="bq-pfile" hidden></label></div>`
            + `<div class="cn-tbl"><table><thead><tr><th>${T('Item', 'รายการ')}</th><th>${T('Unit', 'หน่วย')}</th><th>${T('Material', 'ค่าวัสดุ')}</th><th>${T('Labour', 'ค่าแรง')}</th><th class="num">${T('Total', 'รวม')}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        }
        case 'extra': {
          const X = A.B.extra || [], cat = T('Additional items', 'รายการเพิ่มเติม');
          return h3(cat) + hint(T('Anything the building model does not cover: electrical and lighting, plumbing, fire protection, fences, roads, offices or mezzanines. Lump sums use the unit "LS" and quantity 1.', 'งานที่แบบจำลองไม่ครอบคลุม เช่น ไฟฟ้าแสงสว่าง ประปา ระบบดับเพลิง รั้ว ถนน ห้องสำนักงาน ชั้นลอย งานเหมาให้ใช้หน่วย "เหมา" จำนวน 1'))
            + `<div class="cn-tbl"><table><thead><tr><th>${T('Description', 'รายการ')}</th><th>${T('Qty', 'จำนวน')}</th><th>${T('Unit', 'หน่วย')}</th><th>${T('Material /unit', 'ค่าวัสดุ/หน่วย')}</th><th>${T('Labour /unit', 'ค่าแรง/หน่วย')}</th><th></th></tr></thead><tbody>${X.map((x, i) => `<tr><td>${inp('extra.' + i + '.desc', { text: 1 })}</td><td>${inp('extra.' + i + '.qty')}</td><td>${inp('extra.' + i + '.unit', { text: 1 })}</td><td>${inp('extra.' + i + '.mat')}</td><td>${inp('extra.' + i + '.lab')}</td><td><button class="btn btn-ghost xs" data-act="bq-rb" data-c="xdel" data-v="${i}">✕</button></td></tr>`).join('')}</tbody></table></div><div class="cn-btns"><button class="btn btn-ghost xs" data-act="bq-rb" data-c="xadd">+ ${T('Add item', 'เพิ่มรายการ')}</button></div>`;
        }
        case 'boq': return boqTable(r, false);
        case 'sum': return sumHTML(r, false);
      }
      return '';
    }
    function boqTable(r, rep) {
      const head = `<tr><th>${T('No.', 'ลำดับ')}</th><th>${T('Description', 'รายการ')}</th><th class="num">${T('Qty', 'จำนวน')}</th><th>${T('Unit', 'หน่วย')}</th><th class="num">${T('Material /unit', 'ค่าวัสดุ/หน่วย')}</th><th class="num">${T('Material', 'ค่าวัสดุรวม')}</th><th class="num">${T('Labour /unit', 'ค่าแรง/หน่วย')}</th><th class="num">${T('Labour', 'ค่าแรงรวม')}</th><th class="num">${T('Total', 'รวม')}</th></tr>`;
      const body = r.cats.map(c => `<tr class="bq-cat"><td>${c.no}</td><td colspan="8">${esc(c.name)}</td></tr>` + c.items.map(x => `<tr><td>${x.no}</td><td class="tb-wrap">${esc(x.desc)}${x.note ? ` <span class="muted small">(${esc(x.note)})</span>` : ''}${A.calc || rep ? `<div class="bq-calc">= ${esc(x.calc)}</div>` : ''}</td><td class="num">${qf(x.qty)}</td><td>${esc(x.unit)}</td><td class="num">${baht(x.mat)}</td><td class="num">${baht(x.matT)}</td><td class="num">${baht(x.lab)}</td><td class="num">${baht(x.labT)}</td><td class="num">${baht(x.tot)}</td></tr>`).join('') + `<tr class="bq-sub"><td></td><td>${T('Subtotal ', 'รวม')}${esc(c.name)}</td><td></td><td></td><td></td><td class="num">${baht(c.mat)}</td><td></td><td class="num">${baht(c.lab)}</td><td class="num">${baht(c.tot)}</td></tr>`).join('');
      const tot = `<tr class="bq-gt"><td></td><td>${T('Direct cost', 'รวมค่างานต้นทุน')}</td><td></td><td></td><td></td><td class="num">${baht(r.cats.reduce((s, c) => s + c.mat, 0))}</td><td></td><td class="num">${baht(r.cats.reduce((s, c) => s + c.lab, 0))}</td><td class="num">${baht(r.direct)}</td></tr>`;
      return (rep ? '' : h3(T('Bill of quantities', 'บัญชีแสดงปริมาณวัสดุและราคา (BOQ)')) + `<label class="bq-chk"><input type="checkbox" data-bqcalc="1" ${A.calc ? 'checked' : ''}> ${T('Show the calculation of each quantity', 'แสดงรายการคำนวณปริมาณ')}</label>`) + `<div class="cn-tbl bq-boq"><table class="${rep ? 'rp-t' : ''}"><thead>${head}</thead><tbody>${body}${tot}</tbody></table></div>`;
    }
    function sumHTML(r, rep) {
      const O = A.B.oh;
      const ctl = rep ? '' : grid(fld('oh.mode', T('Mark-up', 'วิธีคิดค่าดำเนินการ'), '', { sel: [['pct', T('Overheads + profit + VAT', 'ค่าดำเนินการ + กำไร + VAT')], ['F', T('Factor F (government works)', 'Factor F (งานราชการ)')]] }) + (O.mode === 'F' ? fld('oh.F', 'Factor F', '') : fld('oh.oh', T('Overheads', 'ค่าดำเนินการ'), '%') + fld('oh.profit', T('Profit', 'กำไร'), '%') + fld('oh.vat', T('VAT', 'ภาษีมูลค่าเพิ่ม'), '%')))
        + (O.mode === 'F' && !rep ? hint(T('Take Factor F from the Comptroller General\'s table for the cost range, advance payment, retention, interest rate and VAT of this contract.', 'ใช้ค่า Factor F จากตารางของกรมบัญชีกลาง ตามช่วงค่างานต้นทุน เงินล่วงหน้า เงินประกันผลงาน ดอกเบี้ย และภาษีมูลค่าเพิ่ม ของสัญญานี้')) : '');
      const g = r.geo, st = r.steel;
      return (rep ? '' : h3(T('Price summary', 'สรุปราคาค่าก่อสร้าง'))) + ctl + `<div class="cn-tbl"><table class="${rep ? 'rp-t' : ''}"><thead><tr><th>${T('No.', 'ลำดับ')}</th><th>${T('Work', 'รายการ')}</th><th class="num">${T('Materials', 'ค่าวัสดุ')}</th><th class="num">${T('Labour', 'ค่าแรง')}</th><th class="num">${T('Total (THB)', 'รวม (บาท)')}</th></tr></thead><tbody>
        ${r.cats.map(c => `<tr><td>${c.no}</td><td>${esc(c.name)}</td><td class="num">${baht(c.mat)}</td><td class="num">${baht(c.lab)}</td><td class="num">${baht(c.tot)}</td></tr>`).join('')}
        ${r.lines.map((l, i) => `<tr class="${i ? '' : 'bq-sub'}"><td></td><td colspan="3">${esc(l[0])}</td><td class="num">${baht(l[1])}</td></tr>`).join('')}
        <tr class="bq-gt"><td></td><td colspan="3">${T('Total construction cost', 'รวมค่าก่อสร้างทั้งสิ้น')}</td><td class="num">${baht(r.grand)}</td></tr></tbody></table></div>
        ${lang() === 'th' ? `<p class="bq-words">(${Q.bahtText(r.grand)})</p>` : ''}
        <div class="bq-kpi"><div><b>${baht(r.perM2)}</b><span>${T('THB per m² of floor', 'บาท ต่อ ตร.ม. พื้นที่อาคาร')}</span></div><div><b>${qf(r.area)}</b><span>${T('m² floor area', 'ตร.ม. พื้นที่อาคาร')}</span></div><div><b>${qf((st.main + st.plates + st.purl + st.girt) / 1000)}</b><span>${T('t steel', 'ตัน เหล็กทั้งหมด')} · ${qf((st.main + st.plates + st.purl + st.girt) / r.area)} ${T('kg/m²', 'กก./ตร.ม.')}</span></div><div><b>${g.nf} × ${g.inner.length + 2}</b><span>${T('frames × columns', 'โครง × เสา')}</span></div></div>`;
    }

    // ------------------------------------------------------------------ Excel workbook (xlsxw.js) with live formulas
    function sheets(r) {
      const B = A.B, g = r.geo, N = v => ({ v, s: 'num' }), Fm = (f, s) => ({ f, s: s || 'num' }), Bo = v => ({ v, s: 'bold' });
      const rows = [[{ v: T('Bill of quantities — ', 'บัญชีแสดงปริมาณวัสดุและราคา — ') + (B.meta.name || ''), s: 'title' }], [T('Owner: ', 'เจ้าของโครงการ: ') + (B.meta.owner || '') + '    ' + T('Location: ', 'สถานที่: ') + (B.meta.location || '') + '    ' + T('Date: ', 'วันที่: ') + (B.meta.date || '')], [],
        [T('No.', 'ลำดับ'), T('Description', 'รายการ'), T('Qty', 'จำนวน'), T('Unit', 'หน่วย'), T('Material /unit', 'ค่าวัสดุ/หน่วย'), T('Material', 'ค่าวัสดุรวม'), T('Labour /unit', 'ค่าแรง/หน่วย'), T('Labour', 'ค่าแรงรวม'), T('Total', 'รวมค่าวัสดุและค่าแรง'), T('Calculation', 'รายการคำนวณ')].map(Bo)], subs = [];
      r.cats.forEach(c => {
        rows.push([Bo(c.no), Bo(c.name)]); const r0 = rows.length + 1;
        c.items.forEach(x => { const n = rows.length + 1; rows.push([x.no, x.desc + (x.note ? ' (' + x.note + ')' : ''), N(x.qty), x.unit, N(x.mat), Fm(`C${n}*E${n}`), N(x.lab), Fm(`C${n}*G${n}`), Fm(`F${n}+H${n}`), { v: '= ' + x.calc, s: 'mono' }]); });
        const r1 = rows.length, n = rows.length + 1; subs.push(n);
        rows.push(['', Bo(T('Subtotal ', 'รวม') + c.name), '', '', '', Fm(`SUM(F${r0}:F${r1})`, 'bnum'), '', Fm(`SUM(H${r0}:H${r1})`, 'bnum'), Fm(`SUM(I${r0}:I${r1})`, 'bnum')]);
      });
      const gt = rows.length + 1; rows.push(['', Bo(T('Direct cost', 'รวมค่างานต้นทุน')), '', '', '', Fm(subs.map(q => 'F' + q).join('+'), 'bnum'), '', Fm(subs.map(q => 'H' + q).join('+'), 'bnum'), Fm(subs.map(q => 'I' + q).join('+'), 'bnum')]);
      const boq = { name: 'BOQ', rows, cols: [7, 60, 11, 8, 13, 15, 13, 15, 17, 70], merges: ['A1:I1'], freeze: 4 };
      // summary: categories pull the BOQ subtotals, mark-ups are cells the user can change
      const sr = [[{ v: T('Price summary — ', 'สรุปราคาค่าก่อสร้าง — ') + (B.meta.name || ''), s: 'title' }], [], [T('No.', 'ลำดับ'), T('Work', 'รายการ'), T('Materials', 'ค่าวัสดุ'), T('Labour', 'ค่าแรง'), T('Total (THB)', 'รวม (บาท)')].map(Bo)];
      r.cats.forEach((c, i) => sr.push([c.no, c.name, Fm(`BOQ!F${subs[i]}`), Fm(`BOQ!H${subs[i]}`), Fm(`BOQ!I${subs[i]}`)]));
      const d = sr.length + 1, f0 = 4; sr.push(['', Bo(T('Direct cost', 'ค่างานต้นทุน')), Fm(`SUM(C${f0}:C${d - 1})`, 'bnum'), Fm(`SUM(D${f0}:D${d - 1})`, 'bnum'), Fm(`SUM(E${f0}:E${d - 1})`, 'bnum')]);
      const O = B.oh || {}; let last;
      if (O.mode === 'F') { const fr = sr.length + 1; sr.push(['', 'Factor F', '', '', { v: +O.F || 1 }]); last = sr.length + 1; sr.push(['', Bo(T('Total construction cost', 'รวมค่าก่อสร้างทั้งสิ้น')), '', '', Fm(`ROUND(E${d}*E${fr},2)`, 'bnum')]); }
      else {
        const k = []; [['oh', T('Overheads', 'ค่าดำเนินการ')], ['profit', T('Profit', 'กำไร')]].forEach(([key, l]) => { const n = sr.length + 1; k.push(n); sr.push(['', l, { v: (+O[key] || 0) / 100, s: 'pct' }, '', Fm(`ROUND(E${d}*C${n},2)`)]); });
        const v = sr.length + 1; sr.push(['', T('VAT', 'ภาษีมูลค่าเพิ่ม'), { v: (+O.vat || 0) / 100, s: 'pct' }, '', Fm(`ROUND((E${d}+${k.map(q => 'E' + q).join('+')})*C${v},2)`)]);
        last = sr.length + 1; sr.push(['', Bo(T('Total construction cost', 'รวมค่าก่อสร้างทั้งสิ้น')), '', '', Fm(`E${d}+${k.map(q => 'E' + q).join('+')}+E${v}`, 'bnum')]);
      }
      sr.push([]); const ar = sr.length + 1; sr.push(['', T('Floor area (m²)', 'พื้นที่อาคาร (ตร.ม.)'), N(r.area)]); sr.push(['', T('Cost per m² (THB)', 'ราคาต่อ ตร.ม. (บาท)'), '', '', Fm(`E${last}/C${ar}`)]);
      if (lang() === 'th') { sr.push([]); sr.push(['', `(${Q.bahtText(r.grand)})`]); }
      const sum = { name: T('Summary', 'สรุป'), rows: sr, cols: [7, 44, 18, 18, 20], merges: ['A1:E1'] };
      const st = r.steel, info = [[{ v: T('Building data', 'ข้อมูลอาคาร'), s: 'title' }], [T('Width × length', 'กว้าง × ยาว'), `${qf(g.W)} × ${qf(g.L)} m`], [T('Eave height', 'ความสูงชายคา'), `${qf(g.H)} m`], [T('Roof pitch', 'ความลาดหลังคา'), `${qf(g.deg)}°`], [T('Frames', 'โครง'), `${g.nf} @ ${qf(g.bay)} m`], [T('Columns / rafters / gable posts', 'เสา / คานหลังคา / เสากันลม'), `${B.frame.col} / ${B.frame.raf} / ${B.frame.gcol}`], [T('Purlins / girts', 'แป / เคร่า'), `${B.purl.sec} @ ${B.purl.sp} m / ${B.purl.girt} @ ${B.purl.gsp} m`], [T('Footings', 'ฐานราก'), `${r.nColMain} × ${B.fnd.B}×${B.fnd.Lf}×${B.fnd.D} m, ${B.fnd.nP} × ${B.fnd.pileType} L ${B.fnd.pileL} m`], [T('Slab', 'พื้น'), `${B.slab.t} m`], [T('Steel (t)', 'เหล็ก (ตัน)'), N((st.main + st.plates + st.purl + st.girt) / 1000)], [], [{ v: T('Unit prices are sample prices unless edited — check them before use. Change prices in the BOQ sheet; all totals follow.', 'ราคาต่อหน่วยเป็นราคาตัวอย่างหากไม่ได้แก้ไข ตรวจสอบก่อนใช้งาน แก้ราคาในแผ่น BOQ แล้วยอดรวมทั้งหมดจะเปลี่ยนตาม'), s: 'bold' }]];
      return [boq, sum, { name: T('Building', 'ข้อมูลอาคาร'), rows: info, cols: [34, 70] }];
    }
    async function exportXlsx() {
      if (!isPro()) { toast(T('Excel export is a Pro feature.', 'ส่งออก Excel สำหรับสมาชิก Pro'), 'bad'); return; }
      if (G.SC_FEAT_OFF && G.SC_FEAT_OFF('xlsx')) return;
      const r = R(), name = (A.B.meta.name || 'warehouse').replace(/[^\wก-๙\-]+/g, '_') + '_BOQ_' + today();
      if (!G.XLSXW) { exportCsv(r, name); return; }
      await saveFile(name + '.xlsx', new Blob([G.XLSXW.book(sheets(r))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      toast(T('Excel BOQ saved — totals are live formulas.', 'บันทึก Excel BOQ แล้ว — ยอดรวมเป็นสูตร แก้ราคาใน Excel ได้'), 'ok');
    }
    function exportCsv(r, name) {
      const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"', L = [[T('No.', 'ลำดับ'), T('Description', 'รายการ'), T('Qty', 'จำนวน'), T('Unit', 'หน่วย'), T('Material /unit', 'ค่าวัสดุ/หน่วย'), T('Material', 'ค่าวัสดุรวม'), T('Labour /unit', 'ค่าแรง/หน่วย'), T('Labour', 'ค่าแรงรวม'), T('Total', 'รวม')]];
      r.cats.forEach(c => { L.push([c.no, c.name]); c.items.forEach(x => L.push([x.no, x.desc, x.qty, x.unit, x.mat, x.matT, x.lab, x.labT, x.tot])); L.push(['', T('Subtotal', 'รวม'), '', '', '', c.mat, '', c.lab, c.tot]); });
      L.push(['', T('Direct cost', 'ค่างานต้นทุน'), '', '', '', '', '', '', r.direct]); r.lines.slice(1).forEach(l => L.push(['', l[0], '', '', '', '', '', '', l[1]])); L.push(['', T('Total', 'รวมทั้งสิ้น'), '', '', '', '', '', '', r.grand]);
      saveFile(name + '.csv', new Blob(['﻿' + L.map(row => row.map(q).join(',')).join('\r\n')], { type: 'text/csv' }));
    }

    // ------------------------------------------------------------------ report (PDF through the app's report exporter)
    function renderReport() {
      if (!isPro()) { toast(T('The BOQ report is a Pro feature.', 'รายงาน BOQ สำหรับสมาชิก Pro'), 'bad'); return; }
      const r = R(), B = A.B, sec = (n, title, html) => `<section class="rp-sec"><h3><span class="rp-n">${n}</span>${title}</h3>${html}</section>`;
      const strip = h => h.replace(/<label class="cn-f">[\s\S]*?<\/label>/g, '');
      const html = sec(1, T('Building', 'ข้อมูลอาคาร'), `<figure>${sketch(r)}</figure><p class="rp-txt">${esc(B.meta.name || '')} — ${qf(r.geo.W)} × ${qf(r.geo.L)} ${T('m', 'ม.')}, ${T('eave', 'ชายคาสูง')} ${qf(r.geo.H)} ${T('m', 'ม.')}, ${T('pitch', 'ลาดหลังคา')} ${qf(r.geo.deg)}°, ${r.geo.nf} ${T('frames', 'โครง')} (${B.frame.col} / ${B.frame.raf}). ${T('Unit prices', 'ราคาต่อหน่วย')}: ${Object.keys(B.price || {}).length ? T('edited by the user', 'แก้ไขโดยผู้ใช้') : T('sample prices — not an official price list', 'ราคาตัวอย่าง ไม่ใช่ราคากลางทางการ')}.</p>`)
        + sec(2, T('Price summary', 'สรุปราคา'), strip(sumHTML(r, true))) + sec(3, T('Bill of quantities', 'บัญชีแสดงปริมาณวัสดุและราคา'), boqTable(r, true));
      $('#reportWrap').innerHTML = `<div class="rp-bar"><h2>${T('Warehouse BOQ report', 'รายงาน BOQ โกดัง/โรงงาน')}</h2><div class="rp-btns"><button class="btn btn-hot sm" data-act="pdf" id="pdfBtn">${T('Export PDF', 'ส่งออก PDF')}</button><button class="btn btn-ghost sm" data-act="closeReport">${T('Close', 'ปิด')}</button></div></div>
        <article class="report" id="report" lang="${S.ui}"><header class="rp-head"><div class="rp-brand">${logoMark(34)}<div><b>StructCap</b><small>${T('Bill of quantities — warehouse / factory', 'บัญชีแสดงปริมาณงาน โกดัง/โรงงาน')}</small></div></div>
          <table class="rp-hd"><tr><th>${T('Project', 'โครงการ')}</th><td>${esc(B.meta.name || '')}</td><th>${T('Date', 'วันที่')}</th><td>${esc(B.meta.date || today())}</td></tr><tr><th>${T('Owner', 'เจ้าของ')}</th><td>${esc(B.meta.owner || '')}</td><th>${T('Location', 'สถานที่')}</th><td>${esc(B.meta.location || '')}</td></tr></table></header>
          ${html}<p class="rp-foot"><b>${COPY}</b> · ${T('Generated by StructCap. Quantities come from the parametric building model and estimating ratios; prices are for estimating. Check against the construction drawings before tendering.', 'จัดทำโดย StructCap ปริมาณงานคำนวณจากแบบจำลองอาคารและอัตราส่วนประมาณการ ราคาใช้เพื่อประมาณการ ตรวจสอบกับแบบก่อสร้างก่อนใช้ประกวดราคา')}</p></article>`;
      S.reportOpen = true; const w = $('#reportWrap'); if (w) w.scrollIntoView({ behavior: 'smooth' });
    }

    // ------------------------------------------------------------------ page
    function view() {
      const r = R();
      return `<main class="an an-app tb-app bq-app">${ribHTML()}<aside class="an-side tb-side" id="bqTree">${treeHTML(r)}</aside>
        <section class="tb-work"><div class="tb-schw bq-schw" id="bqSk">${sketch(r)}</div><div class="tb-panel" id="bqPanel">${panelHTML(r)}</div></section>
        <div id="reportWrap" class="an-report"></div></main>`;
    }
    function refresh(all) { const r = R(), t = $('#bqTree'); if (t) t.innerHTML = treeHTML(r); const s = $('#bqSk'); if (s) s.innerHTML = sketch(r); if (all !== false) { const p = $('#bqPanel'); if (p) p.innerHTML = panelHTML(r); } ribRefresh(); }
    function cmd(c, v) {
      if (c === 'sel') { A.sel = v; refresh(); const p = $('#bqPanel'); if (p) p.scrollTop = 0; return; }
      if (c === 'undo') { undo(false); return; } if (c === 'redo') { undo(true); return; }
      if (c === 'save') { persist(); saveFile(((A.B.meta.name || 'warehouse') + '_boq.json').replace(/[^\wก-๙\-.]+/g, '_'), new Blob([JSON.stringify({ app: 'StructCap BOQ', v: 1, B: A.B }, null, 1)], { type: 'application/json' })); return; }
      if (c === 'xlsx') { exportXlsx(); return; }
      if (c === 'report') { renderReport(); return; }
      if (c === 'pricesave') { saveFile('price-list_' + today() + '.json', new Blob([JSON.stringify({ app: 'StructCap BOQ prices', price: A.B.price || {} }, null, 1)], { type: 'application/json' })); return; }
      snap();
      if (c === 'new') { if (!confirm(T('Start a new building? The current data is replaced (Undo brings it back).', 'เริ่มอาคารใหม่? ข้อมูลปัจจุบันจะถูกแทนที่ (กดเลิกทำเพื่อกู้คืน)'))) { A.hist.pop(); return; } const keep = A.B.price; A.B = fresh(); A.B.price = keep || {}; A.sel = 'geo'; }
      else if (c === 'preset') A.B.price = {};
      else if (c === 'xadd') (A.B.extra = A.B.extra || []).push({ desc: '', qty: 1, unit: lang() === 'th' ? 'เหมา' : 'LS', mat: 0, lab: 0 });
      else if (c === 'xdel') A.B.extra.splice(+v, 1);
      persist(); refresh();
    }
    function onClick(a, b) {
      if (a === 'bq-rb') { cmd(b.dataset.c, b.dataset.v); return true; }
      if (a === 'bq-ribtab') { A.rib = b.dataset.t; ribRefresh(); return true; }
      if (a === 'bq-sel') { cmd('sel', b.dataset.k); return true; }
      return false;
    }
    function onInput(t) {
      if (!t.closest('.bq-app')) return false;
      if (t.dataset.bqcalc) { A.calc = t.checked; refresh(); return true; }
      if (!A._ts || Date.now() - A._ts > 800) snap(); A._ts = Date.now();
      if (t.dataset.bqp) { const [k, w] = t.dataset.bqp.split('.'), P = A.B.price = A.B.price || {}, d = Q.PRICE[k]; P[k] = P[k] || {}; P[k][w] = t.value === '' ? null : +t.value; if ((P[k].mat == null || P[k].mat === d[0]) && (P[k].lab == null || P[k].lab === d[1])) delete P[k]; persist(); refresh(false); return true; }
      const p = t.dataset.bq; if (!p) return true;
      let v = t.dataset.chk ? t.checked : t.dataset.num ? (t.value === '' ? '' : +t.value) : t.value;
      if (t.tagName === 'SELECT' && (v === 'true' || v === 'false')) v = v === 'true';
      setPath(p, v); persist();
      const big = t.tagName === 'SELECT' && /^(oh\.mode|wall\.sheet)$/.test(p);
      if (big) { const pan = $('#bqPanel'), sc = pan && pan.scrollTop; refresh(); const pn = $('#bqPanel'); if (pn) pn.scrollTop = sc; } else refresh(false);
      if (/^(geo|frame|purl)\./.test(p) && (A.sel === 'geo' || A.sel === 'steel')) { const h = document.querySelector('#bqPanel .hint'); if (h) { const tmp = document.createElement('div'); tmp.innerHTML = panelHTML(R()); const nh = tmp.querySelector('.hint'); if (nh) h.innerHTML = nh.innerHTML; } }
      return true;
    }
    let bound = false;
    function mount() {
      if (bound) return; bound = true;
      document.addEventListener('change', e => {
        const t = e.target; if (S.view !== VIEW || !t) return;
        if (t.id === 'bq-file') { const fl = t.files[0]; if (!fl) return; fl.text().then(txt => { try { const j = JSON.parse(txt), B = j.B || j; if (!B.geo || !B.frame) throw 0; snap(); A.B = merge(fresh(), B); A.sel = 'geo'; persist(); refresh(); toast(T('Building loaded', 'โหลดข้อมูลอาคารแล้ว'), 'ok'); } catch (er) { toast(T('That is not a StructCap BOQ file.', 'ไฟล์นี้ไม่ใช่ไฟล์ BOQ ของ StructCap'), 'bad'); } }); t.value = ''; }
        if (t.id === 'bq-pfile') { const fl = t.files[0]; if (!fl) return; fl.text().then(txt => { try { const j = JSON.parse(txt), P = j.price || j; if (typeof P !== 'object') throw 0; snap(); A.B.price = {}; Object.keys(P).forEach(k => { if (Q.PRICE[k] && P[k]) A.B.price[k] = { mat: P[k].mat, lab: P[k].lab }; }); persist(); refresh(); toast(T('Price list loaded', 'โหลดบัญชีราคาแล้ว'), 'ok'); } catch (er) { toast(T('That is not a price list file.', 'ไฟล์นี้ไม่ใช่บัญชีราคา'), 'bad'); } }); t.value = ''; }
      });
      document.addEventListener('keydown', e => { if (S.view !== VIEW) return; const tg = e.target; if (tg && /INPUT|SELECT|TEXTAREA/.test(tg.tagName)) return; if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(e.shiftKey); } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); undo(true); } });
    }
    return { view, mount, onClick, onInput, state: A, renderReport, compute: R, sheets };
  };
})(typeof window !== 'undefined' ? window : globalThis);
