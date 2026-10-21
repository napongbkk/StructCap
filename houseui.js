/* StructCap House — app for the structural design of houses (Thai practice): plan editor on grids and storeys,
   columns / pedestals / footings, beams, slabs, stair, walls, roof, loads and combinations, 3D analysis, automatic RC + steel design
   with user overrides, 3D rebar, Thai calculation report, BBS / BOQ and structural drawings (PDF, DXF). */
(function (G) {
  'use strict';
  G.SC_HOUSE_UI = function (ctx) {
    const { T, esc, f, $, $$, S, toast, isPro, COPY, logoMark, today, saveFile, render } = ctx;
    const X = G.HOUSE, BB = G.HOUSEBBS, VIEW = 'house', LS = 'sc.house.v1';
    const store = { get() { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(LS, JSON.stringify(v)); } catch (e) { } } };
    const A = { H: store.get() || X.example(), R: null, D: null, Q: null, step: 'grid', st: null, view: 'plan', m3: 'solid', hist: [], fut: [], brush: { csec: 'C1', ctop: null, bsec: 'B1', t: 12, use: 'res', ground: false, wall: 'block10', sdir: 'x' }, paper: 'A3', sheet: 0, err: '' };
    if (!A.H || !A.H.grid) A.H = X.example();
    const H = () => A.H;
    const persist = () => store.set(A.H);
    const snap = () => { A.hist.push(JSON.stringify(A.H)); if (A.hist.length > 80) A.hist.shift(); A.fut = []; };
    const stale = () => { A.R = A.D = A.Q = null; A.err = ''; };
    const undo = redo => { const from = redo ? A.fut : A.hist, to = redo ? A.hist : A.fut; if (!from.length) return; to.push(JSON.stringify(A.H)); A.H = JSON.parse(from.pop()); stale(); persist(); render(); };
    const fm = (v, d) => (v == null || !isFinite(v) ? '—' : f(v, d == null ? 2 : d));
    const STs = () => X.stories(H());
    const curSt = () => { const L = STs(); if (!L.find(s => s.id === A.st)) A.st = (L[1] || L[0]).id; return L.find(s => s.id === A.st); };
    const gname = (i, j) => `${H().grid.yn[j] || j + 1}/${H().grid.xn[i] || i + 1}`;

    // ------------------------------------------------------------------ steps
    const STEPS = [
      ['proj', 'โครงการ / วัสดุ'], ['grid', 'กริดและชั้น'], ['col', 'เสา ตอม่อ ฐานราก'], ['sec', 'หน้าตัด'], ['beam', 'คาน'], ['slab', 'พื้น'], ['stair', 'บันได'], ['wall', 'ผนัง'], ['roof', 'หลังคา'], ['load', 'น้ำหนักบรรทุก / Combo'],
      ['run', 'วิเคราะห์'], ['design', 'ออกแบบ / ปรับแก้'], ['m3', 'โมเดล 3D + เหล็กเสริม'], ['report', 'รายการคำนวณ'], ['boq', 'BBS / BOQ'], ['dwg', 'แบบก่อสร้าง']
    ];
    const PLAN_STEPS = ['grid', 'col', 'beam', 'slab', 'stair', 'wall'];
    const OUT_STEPS = ['run', 'design', 'boq', 'dwg', 'report'];

    // ------------------------------------------------------------------ analysis + design
    function solve(quiet) {
      try { A.R = X.analyse(H()); A.D = X.designAll(H(), A.R); A.Q = BB.boq(H(), A.D); A.err = ''; if (!quiet) { const s = X.summary(A.D); toast(`วิเคราะห์และออกแบบเสร็จ — ผ่าน ${s.nOk} / ไม่ผ่าน ${s.nBad}`, s.nBad ? 'bad' : 'ok'); } return true; }
      catch (e) { stale(); A.err = e.message || String(e); if (!quiet) toast('วิเคราะห์ไม่สำเร็จ: ' + A.err, 'bad'); return false; }
    }
    const ensure = () => (A.D ? true : solve(true));

    // ------------------------------------------------------------------ small widgets
    const opt = (L, v) => L.map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('');
    const fi = (path, lbl, v, o) => { o = o || {}; const at = `data-hs="${esc(path)}" ${o.num ? 'data-num="1"' : ''}`; const ctl = o.sel ? `<select ${at}>${opt(o.sel, v)}</select>` : o.chk ? `<input type="checkbox" ${at} data-chk="1" ${v ? 'checked' : ''}>` : `<input ${at} value="${esc(v == null ? '' : v)}" ${o.num ? 'inputmode="decimal"' : ''}>`; return `<label class="cn-f"><span>${lbl}${o.u ? ` <i>${o.u}</i>` : ''}</span>${ctl}</label>`; };
    const btn = (c, l, v, cls) => `<button class="btn ${cls || 'btn-ghost'} sm" data-act="hs-c" data-c="${c}" ${v != null ? `data-v="${esc(v)}"` : ''}>${l}</button>`;
    const secOpts = kind => H().sections.filter(s => s.kind === kind).map(s => [s.id, `${s.id} (${s.b}×${s.h})`]);
    const stOpts = () => STs().map(s => [s.id, s.name]);
    const ok = v => `<span class="cn-u ${v ? 'ok' : 'bad'}">${v ? 'OK' : 'NG'}</span>`;
    const barOpts = (cur, L) => opt((L || Object.keys(X.BARS)).map(k => [k, k]), cur);

    // ------------------------------------------------------------------ side panels per step
    function panel() {
      const h = H(), s = A.step, M = h.mat, So = h.soil;
      if (s === 'proj') return `<h3>ข้อมูลโครงการ</h3><div class="hs-form">${[['project', 'ชื่อโครงการ'], ['owner', 'เจ้าของ'], ['location', 'สถานที่ก่อสร้าง'], ['engineer', 'วิศวกรผู้ออกแบบ'], ['license', 'เลขทะเบียน ใบอนุญาต'], ['checker', 'ผู้ตรวจ'], ['drafter', 'ผู้เขียนแบบ']].map(([k, l]) => fi('meta.' + k, l, h.meta[k])).join('')}</div>
        <h3>วัสดุ (วิธีกำลัง SDM)</h3><div class="hs-form">${fi('mat.fc', "f'c คอนกรีต", M.fc, { num: 1, u: 'ksc' })}${fi('mat.fy', 'fy เหล็กข้ออ้อย', M.fy, { num: 1, u: 'ksc', sel: [[3000, 'SD30 (3000)'], [4000, 'SD40 (4000)'], [5000, 'SD50 (5000)']] })}${fi('mat.fys', 'fy เหล็กกลม (ปลอก)', M.fys, { num: 1, u: 'ksc', sel: [[2400, 'SR24 (2400)']] })}${fi('mat.Fy', 'Fy เหล็กรูปพรรณ', M.Fy, { num: 1, u: 'ksc' })}${fi('mat.ws', 'หน่วยน้ำหนัก คสล.', M.ws, { num: 1, u: 'kg/m³' })}
        ${fi('mat.cover.slab', 'ระยะหุ้ม พื้น', M.cover.slab, { num: 1, u: 'ซม.' })}${fi('mat.cover.beam', 'ระยะหุ้ม คาน', M.cover.beam, { num: 1, u: 'ซม.' })}${fi('mat.cover.col', 'ระยะหุ้ม เสา', M.cover.col, { num: 1, u: 'ซม.' })}${fi('mat.cover.fnd', 'ระยะหุ้ม ฐานราก', M.cover.fnd, { num: 1, u: 'ซม.' })}
        ${fi('mat.lapDB', 'ระยะทาบ DB', M.lapDB, { num: 1, u: 'db' })}${fi('mat.lapRB', 'ระยะทาบ RB', M.lapRB, { num: 1, u: 'db' })}${fi('mat.waste', 'เผื่อเหล็กเสีย', M.waste, { num: 1, u: '%' })}</div>`;
      if (s === 'grid') {
        const sp = a => a.slice(1).map((v, i) => +(v - a[i]).toFixed(3)).join(', ');
        return `<h3>เส้นกริด</h3><p class="muted sm">ระยะห่างระหว่างกริด (ม.) คั่นด้วยจุลภาค เช่น 4, 4, 3.5</p><div class="hs-form">
          <label class="cn-f"><span>ระยะกริดแนว X</span><input data-hsgrid="x" value="${esc(sp(h.grid.x))}"></label><label class="cn-f"><span>ชื่อกริดแนว X</span><input data-hsgridn="xn" value="${esc(h.grid.xn.join(', '))}"></label>
          <label class="cn-f"><span>ระยะกริดแนว Y</span><input data-hsgrid="y" value="${esc(sp(h.grid.y))}"></label><label class="cn-f"><span>ชื่อกริดแนว Y</span><input data-hsgridn="yn" value="${esc(h.grid.yn.join(', '))}"></label></div>
          <h3>ชั้นอาคาร</h3><table class="hs-t"><tr><th>ชื่อชั้น</th><th>ระดับ (ม.)</th><th>สูงชั้น</th><th></th></tr>${STs().map((st, k, L) => `<tr><td><input data-hsst="${st.id}" data-k="name" value="${esc(st.name)}"></td><td><input data-hsst="${st.id}" data-k="z" data-num="1" value="${st.z}"></td><td>${k + 1 < L.length ? fm(L[k + 1].z - st.z) : '—'}</td><td>${k ? btn('stdel', '✕', st.id) : ''}</td></tr>`).join('')}</table>
          <div class="hs-row">${btn('stadd', '+ เพิ่มชั้น')}</div><p class="muted sm">ชั้นล่างสุด (ระดับ ±0.00) คือคานคอดิน (GB) ชั้นบนสุดคือคานหลังคา (RB) ส่วนเสาใต้คานคอดินลงถึงฐานรากคือตอม่อ</p>`;
      }
      if (s === 'col') return `<h3>วางเสา</h3><p class="muted sm">คลิกจุดกริดบนแปลนเพื่อวาง / เปลี่ยน / ลบเสา</p><div class="hs-form">${fi('@csec', 'หน้าตัดเสา', A.brush.csec, { sel: secOpts('col') })}${fi('@ctop', 'เสาสูงถึงชั้น', A.brush.ctop || X.topSt(h).id, { sel: stOpts() })}</div>
        <div class="hs-row">${btn('allcols', 'วางเสาทุกจุดกริด')}${btn('nocols', 'ลบเสาทั้งหมด')}</div>
        <h3>ฐานราก</h3><div class="hs-form">${fi('soil.type', 'ชนิดฐานราก', So.type, { sel: [['spread', 'ฐานแผ่ (วางบนดิน)'], ['pile', 'ฐานรากบนเสาเข็ม']] })}${fi('soil.Df', 'ความลึกฐานราก Df', So.Df, { num: 1, u: 'ม.' })}
        ${So.type === 'pile' ? fi('soil.pile.name', 'เสาเข็ม', So.pile.name) + fi('soil.pile.cap', 'น้ำหนักปลอดภัยต่อต้น', So.pile.cap, { num: 1, u: 'ตัน' }) + fi('soil.pile.D', 'ขนาดเสาเข็ม', So.pile.D, { num: 1, u: 'ซม.' }) + fi('soil.pile.s', 'ระยะห่างเสาเข็ม', So.pile.s, { num: 1, u: 'ม.' }) : fi('soil.qa', 'กำลังรับน้ำหนักดินที่ยอมให้ qa', So.qa, { num: 1, u: 't/m²' })}</div>
        <p class="muted sm">ตอม่อออกแบบเป็นเสาจากหลังฐานรากถึงคานคอดิน ขนาดตามหน้าตัดเสาชั้นล่าง</p>`;
      if (s === 'sec') return `<h3>หน้าตัด</h3><table class="hs-t"><tr><th>ชื่อ</th><th>ชนิด</th><th>กว้าง b (ซม.)</th><th>ลึก h (ซม.)</th><th>ใช้</th><th></th></tr>${h.sections.map((q, k) => { const n = q.kind === 'col' ? h.columns.filter(c => c.sec === q.id).length : h.beams.filter(b => b.sec === q.id).length; return `<tr><td><b>${esc(q.id)}</b></td><td>${q.kind === 'col' ? 'เสา' : 'คาน'}</td><td><input data-hssec="${k}" data-k="b" data-num="1" value="${q.b}"></td><td><input data-hssec="${k}" data-k="h" data-num="1" value="${q.h}"></td><td>${n}</td><td>${n ? '' : btn('secdel', '✕', k)}</td></tr>`; }).join('')}</table>
        <div class="hs-row">${btn('secadd', '+ หน้าตัดเสา', 'col')}${btn('secadd', '+ หน้าตัดคาน', 'beam')}</div>`;
      const stSel = `<div class="hs-form">${fi('@st', 'ชั้น', curSt().id, { sel: stOpts() })}</div>`;
      if (s === 'beam') return `<h3>วางคาน</h3><p class="muted sm">คลิกช่วงระหว่างจุดกริดเพื่อวาง / เปลี่ยน / ลบคาน</p>${stSel}<div class="hs-form">${fi('@bsec', 'หน้าตัดคาน', A.brush.bsec, { sel: secOpts('beam') })}</div><div class="hs-row">${btn('allbeams', 'คานทุกแนวกริด (ชั้นนี้)')}${btn('nobeams', 'ลบคานชั้นนี้')}${btn('copybeams', 'คัดลอกจากชั้นล่าง')}</div>`;
      if (s === 'slab') return `<h3>วางพื้น</h3><p class="muted sm">คลิกช่องกริดเพื่อวาง / เปลี่ยน / ลบพื้น</p>${stSel}<div class="hs-form">${fi('@t', 'ความหนาพื้น', A.brush.t, { num: 1, u: 'ซม.' })}${fi('@use', 'การใช้งาน (น้ำหนักจร)', A.brush.use, { sel: Object.entries(X.LL).map(([k, v]) => [k, `${v[0]} ${v[1]} kg/m²`]) })}${fi('@ground', 'พื้นวางบนดิน', A.brush.ground, { chk: 1 })}</div><div class="hs-row">${btn('allslabs', 'พื้นทุกช่อง (ชั้นนี้)')}${btn('noslabs', 'ลบพื้นชั้นนี้')}</div>
        <p class="muted sm">พื้นที่มีคานรองรับ 4 ด้านและ L/S < 2 ออกแบบเป็นพื้นสองทาง (วิธีที่ 2 ว.ส.ท.) นอกนั้นเป็นพื้นทางเดียว พื้นวางบนดินใช้เหล็กกันร้าว</p>`;
      if (s === 'stair') return `<h3>บันได</h3><p class="muted sm">คลิกช่องกริดเพื่อวางบันไดจากชั้นที่เลือกขึ้นชั้นถัดไป (ช่องนั้นต้องไม่มีพื้นชั้นบน)</p>${stSel}<div class="hs-form">${fi('@sdir', 'ทิศทางขึ้น', A.brush.sdir, { sel: [['x', 'ตามแนว X'], ['y', 'ตามแนว Y']] })}</div>
        ${h.stairs.length ? `<table class="hs-t"><tr><th>บันได</th><th>ชั้น</th><th>ช่อง</th><th>หนา (ซม.)</th><th></th></tr>${h.stairs.map((t, k) => `<tr><td>${esc(t.id)}</td><td>${esc((STs().find(q => q.id === t.st) || {}).name || t.st)}</td><td>${gname(t.i, t.j)}</td><td><input data-hsarr="stairs.${k}.t" data-num="1" value="${t.t}"></td><td>${btn('stairdel', '✕', k)}</td></tr>`).join('')}</table>` : ''}`;
      if (s === 'wall') return `<h3>ผนัง</h3><p class="muted sm">คลิกช่วงคานเพื่อวาง / ลบผนังบนคาน (น้ำหนักผนัง × ความสูงชั้น)</p>${stSel}<div class="hs-form">${fi('@wall', 'ชนิดผนัง', A.brush.wall, { sel: Object.entries(X.WALLS).map(([k, v]) => [k, `${v[0]} ${v[1]} kg/m²`]) })}</div><div class="hs-row">${btn('perwalls', 'ผนังรอบนอก (ชั้นนี้)')}${btn('nowalls', 'ลบผนังชั้นนี้')}</div>`;
      if (s === 'roof') { const R = h.roof; return `<h3>โครงหลังคา</h3><div class="hs-form">${fi('roof.type', 'รูปแบบหลังคา', R.type, { sel: [['gable', 'หน้าจั่ว (โครงถักเหล็ก)'], ['hip', 'ปั้นหยา'], ['shed', 'เพิงหมาแหงน'], ['flat', 'หลังคา คสล. (วางพื้นที่ชั้นหลังคา)'], ['none', 'ไม่มี']] })}${fi('roof.st', 'วางบนคานชั้น', R.st || X.topSt(h).id, { sel: stOpts() })}${fi('roof.dir', 'แนวสันหลังคา', R.dir, { sel: [['x', 'ขนานแนว X'], ['y', 'ขนานแนว Y']] })}${fi('roof.pitch', 'ความชัน', R.pitch, { num: 1, u: 'องศา' })}${fi('roof.over', 'ชายคายื่น', R.over, { num: 1, u: 'ม.' })}${fi('roof.cover', 'วัสดุมุง', R.cover, { sel: Object.entries(X.ROOFS).map(([k, v]) => [k, `${v[0]} ${v[1]} kg/m²`]) })}${fi('roof.ll', 'น้ำหนักจรหลังคา', R.ll, { num: 1, u: 'kg/m²' })}${fi('roof.ceil', 'ฝ้าเพดาน', R.ceil, { num: 1, u: 'kg/m²' })}${fi('roof.sp', 'ระยะห่างโครงถัก', R.sp, { num: 1, u: 'ม.' })}${fi('roof.psp', 'ระยะห่างแป', R.psp, { num: 1, u: 'ม.' })}</div>
        <p class="muted sm">โครงถักหน้าจั่ว Howe / เพิง Pratt วิเคราะห์เป็นโครงถัก 2 มิติ ออกแบบ ASD (Fa ตาม AISC, Ft = 0.6Fy) แปเหล็กตัวซี ปั้นหยาถ่ายน้ำหนักลงคานรอบนอก</p>`; }
      if (s === 'load') {
        const cmb = h.loads.combos && h.loads.combos.length ? h.loads.combos : X.defCombos(h), cs = ['D', 'L'].concat(h.loads.wind.on ? ['WX', 'WY'] : []);
        return `<h3>น้ำหนักบรรทุก</h3><div class="hs-form">${fi('loads.sdl', 'น้ำหนักวัสดุปูพื้น / ฝ้า (SDL)', h.loads.sdl, { num: 1, u: 'kg/m²' })}${fi('loads.wind.on', 'คิดแรงลม', h.loads.wind.on, { chk: 1 })}${h.loads.wind.on ? fi('loads.wind.q', 'แรงลม', h.loads.wind.q, { num: 1, u: 'kg/m²' }) : ''}</div>
          <table class="hs-t"><tr><th>การใช้งาน (กฎกระทรวงฉบับที่ 6)</th><th>LL kg/m²</th></tr>${Object.values(X.LL).map(v => `<tr><td>${v[0]}</td><td>${v[1]}</td></tr>`).join('')}</table>
          <p class="muted sm">น้ำหนักตัวเอง (D) คิดอัตโนมัติ พื้นถ่ายลงคานตามเส้นแบ่งพื้นที่ 45° (สามเหลี่ยม / สี่เหลี่ยมคางหมู) ผนังคิดเป็นน้ำหนักแผ่บนคาน</p>
          <h3>Load combinations</h3><table class="hs-t"><tr><th>ชื่อ</th><th>ชนิด</th>${cs.map(c => `<th>${c}</th>`).join('')}<th></th></tr>${cmb.map((c, k) => `<tr><td><input data-hscmb="${k}" data-k="name" value="${esc(c.name)}"></td><td><select data-hscmb="${k}" data-k="type">${opt([['ULS', 'ULS'], ['SLS', 'SLS']], c.type)}</select></td>${cs.map(q => `<td><input data-hscmb="${k}" data-k="f.${q}" data-num="1" value="${c.f[q] == null ? '' : c.f[q]}"></td>`).join('')}<td>${k > 1 ? btn('cmbdel', '✕', k) : ''}</td></tr>`).join('')}</table>
          <div class="hs-row">${btn('cmbadd', '+ เพิ่ม combo')}${btn('cmbreset', 'ค่ามาตรฐาน (ว.ส.ท. / ACI)')}</div><p class="muted sm">combo แรกที่เป็น ULS ใช้ออกแบบพื้นและบันได ชิ้นส่วนอื่นใช้ค่าสูงสุดของทุก ULS (envelope)</p>`;
      }
      if (s === 'run') return `<h3>วิเคราะห์โครงสร้าง 3 มิติ</h3><p class="muted sm">โครงข้อแข็ง 3 มิติ (เสา คาน) ฐานยึดแน่นที่หลังฐานราก พื้น ผนัง บันได และหลังคาถ่ายน้ำหนักลงคาน</p><div class="hs-row">${btn('run', '▶ วิเคราะห์และออกแบบ', null, 'btn-hot')}</div>${A.err ? `<p class="bad">${esc(A.err)}</p>` : ''}${A.R ? statBox() : ''}`;
      if (s === 'design') return `<h3>ออกแบบอัตโนมัติ</h3><p class="muted sm">โปรแกรมเลือกเหล็กเสริมให้อัตโนมัติ แก้ไขหน้าตัด ขนาดเหล็ก จำนวน และระยะปลอกได้ในตาราง (ช่องว่าง = อัตโนมัติ) แล้วออกแบบใหม่ทันที</p><div class="hs-row">${btn('run', '▶ ออกแบบใหม่', null, 'btn-hot')}${btn('ovclear', 'ล้างค่าที่แก้ไขทั้งหมด')}</div>${A.R ? statBox() : ''}`;
      if (s === 'm3') return `<h3>โมเดล 3 มิติ</h3><div class="hs-row hs-seg">${[['solid', 'คอนกรีต'], ['rebar', 'เหล็กเสริม'], ['ur', 'ผลการออกแบบ']].map(([k, l]) => `<button class="btn sm ${A.m3 === k ? 'btn-hot' : 'btn-ghost'}" data-act="hs-c" data-c="m3" data-v="${k}">${l}</button>`).join('')}</div>${fi('@m3st', 'แสดงถึงชั้น', A.m3st || 'all', { sel: [['all', 'ทั้งหมด']].concat(stOpts()) })}${fi('@m3slab', 'แสดงเหล็กพื้น', !!A.m3slab, { chk: 1 })}<p class="muted sm">ลากเพื่อหมุน คลิกขวา/Shift ลากเพื่อเลื่อน ล้อเมาส์ซูม คลิกชิ้นส่วนเพื่อดูรายละเอียด</p><div id="hsPick" class="hs-pick"></div>`;
      if (s === 'report') return `<h3>รายการคำนวณ</h3><p class="muted sm">รายการคำนวณโครงสร้างตามรูปแบบที่ใช้ยื่นขออนุญาตก่อสร้าง: มาตรฐาน น้ำหนักบรรทุก Load combination ผลวิเคราะห์ และการออกแบบทุกชิ้นส่วนพร้อมสูตรและการแทนค่า</p><div class="hs-row">${btn('report', 'สร้างรายการคำนวณ', null, 'btn-hot')}</div>`;
      if (s === 'boq') return `<h3>BBS / BOQ</h3><p class="muted sm">ตัดเหล็ก (BBS) พร้อมระยะทาบ ขอ และงอ ตามมาตรฐานไทย: ทาบ DB ${M.lapDB}db, RB ${M.lapRB}db; งอฉาก 12db; ขอ 180° 4db ≥ 6.5 ซม.; ปลอกงอ 135° 6db ≥ 7.5 ซม.; เหล็กยาว 10 ม.; เผื่อ ${M.waste}%</p><div class="hs-row">${btn('csvboq', 'ดาวน์โหลด BOQ (CSV)')}${btn('csvbbs', 'ดาวน์โหลด BBS (CSV)')}</div><p class="muted sm">ใส่ราคาวัสดุและค่าแรงต่อหน่วยในตาราง BOQ เพื่อคำนวณราคา</p>`;
      if (s === 'dwg') return `<h3>แบบก่อสร้างงานโครงสร้าง</h3><div class="hs-form">${fi('@paper', 'ขนาดกระดาษ', A.paper, { sel: [['A4', 'A4'], ['A3', 'A3'], ['A1', 'A1'], ['A0', 'A0']] })}</div><div class="hs-row">${btn('pdfdwg', 'ส่งออก PDF', null, 'btn-hot')}${btn('dxfdwg', 'ส่งออก DXF (AutoCAD)')}</div><p class="muted sm">DXF เปิดได้ใน AutoCAD (บันทึกเป็น DWG ได้จาก AutoCAD) ตัวอักษรไทยใช้ code page ANSI_874</p>`;
      return '';
    }
    function statBox() { const s = X.summary(A.D); return `<div class="hs-stat"><b>${s.list.length}</b> ชิ้นส่วน · <span class="ok">ผ่าน ${s.nOk}</span> · <span class="${s.nBad ? 'bad' : 'muted'}">ไม่ผ่าน ${s.nBad}</span>${A.R.warn.length ? `<ul class="hs-warn">${A.R.warn.slice(0, 8).map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}</div>`; }

    // ------------------------------------------------------------------ plan (SVG)
    function plan() {
      const h = H(), g = h.grid, st = curSt(), k = X.stIdx(h, st.id), D = A.D, W = 900, Hh = 620, pad = 70;
      const X0 = g.x[0], X1 = g.x[g.x.length - 1], Y0 = g.y[0], Y1 = g.y[g.y.length - 1], sc = Math.min((W - 2 * pad) / max1(X1 - X0), (Hh - 2 * pad) / max1(Y1 - Y0));
      const px = x => pad + (x - X0) * sc, py = y => Hh - pad - (y - Y0) * sc, s = A.step, o = [];
      o.push(`<svg class="hs-plan" viewBox="0 0 ${W} ${Hh}" xmlns="http://www.w3.org/2000/svg">`);
      // grid
      g.x.forEach((x, i) => { o.push(`<line x1="${px(x)}" y1="${py(Y0) + 30}" x2="${px(x)}" y2="${py(Y1) - 30}" class="hs-gl"/><circle cx="${px(x)}" cy="${py(Y0) + 44}" r="13" class="hs-bub"/><text x="${px(x)}" y="${py(Y0) + 48}" class="hs-bt">${esc(g.xn[i] || i + 1)}</text>`); if (i) o.push(`<text x="${(px(x) + px(g.x[i - 1])) / 2}" y="${py(Y1) - 36}" class="hs-dim">${fm(x - g.x[i - 1])}</text>`); });
      g.y.forEach((y, j) => { o.push(`<line x1="${px(X0) - 30}" y1="${py(y)}" x2="${px(X1) + 30}" y2="${py(y)}" class="hs-gl"/><circle cx="${px(X0) - 44}" cy="${py(y)}" r="13" class="hs-bub"/><text x="${px(X0) - 44}" y="${py(y) + 4}" class="hs-bt">${esc(g.yn[j] || j + 1)}</text>`); if (j) o.push(`<text x="${px(X1) + 40}" y="${(py(y) + py(g.y[j - 1])) / 2 + 4}" class="hs-dim">${fm(y - g.y[j - 1])}</text>`); });
      // slabs, stairs
      h.slabs.filter(q => q.st === st.id).forEach(q => { const sd = D && D.slabs.find(r => r.id === q.id), x0 = px(g.x[q.i]), x1 = px(g.x[q.i + 1]), y0 = py(g.y[q.j + 1]), y1 = py(g.y[q.j]); o.push(`<rect x="${x0 + 3}" y="${y0 + 3}" width="${x1 - x0 - 6}" height="${y1 - y0 - 6}" class="hs-slab ${q.ground ? 'gnd' : ''} ${sd && !sd.ok ? 'ng' : ''}"/><text x="${(x0 + x1) / 2}" y="${(y0 + y1) / 2 - 2}" class="hs-lb">${esc(sd && sd.mark ? sd.mark : 'S')}</text><text x="${(x0 + x1) / 2}" y="${(y0 + y1) / 2 + 13}" class="hs-sm">t=${q.t} ซม.${q.ground ? ' (บนดิน)' : ''} · ${esc((X.LL[q.use] || X.LL.res)[1])}</text>`); });
      h.stairs.filter(q => q.st === st.id).forEach(q => { const x0 = px(g.x[q.i]), x1 = px(g.x[q.i + 1]), y0 = py(g.y[q.j + 1]), y1 = py(g.y[q.j]), n = 9, L = []; for (let m = 1; m < n; m++) L.push(q.dir === 'x' ? `M${x0 + (x1 - x0) * m / n} ${y0 + 4}V${y1 - 4}` : `M${x0 + 4} ${y1 - (y1 - y0) * m / n}H${x1 - 4}`); o.push(`<rect x="${x0 + 3}" y="${y0 + 3}" width="${x1 - x0 - 6}" height="${y1 - y0 - 6}" class="hs-stair"/><path d="${L.join('')}" class="hs-tread"/><text x="${(x0 + x1) / 2}" y="${(y0 + y1) / 2 + 4}" class="hs-lb">${esc(q.id)} ขึ้น ${q.dir === 'x' ? '→' : '↑'}</text>`); });
      // stair opening from the storey below
      const below = STs()[k - 1]; if (below) h.stairs.filter(q => q.st === below.id).forEach(q => { const x0 = px(g.x[q.i]), x1 = px(g.x[q.i + 1]), y0 = py(g.y[q.j + 1]), y1 = py(g.y[q.j]); o.push(`<path d="M${x0 + 6} ${y0 + 6}L${x1 - 6} ${y1 - 6}M${x1 - 6} ${y0 + 6}L${x0 + 6} ${y1 - 6}" class="hs-open"/>`); });
      // walls
      h.walls.filter(w => w.st === st.id).forEach(w => { const a = [px(g.x[w.a[0]]), py(g.y[w.a[1]])], b = [px(g.x[w.b[0]]), py(g.y[w.b[1]])], hz = a[1] === b[1]; o.push(`<line x1="${a[0]}" y1="${a[1] + (hz ? 7 : 0)}" x2="${b[0]}" y2="${b[1] + (hz ? 7 : 0)}" class="hs-wall" transform="translate(${hz ? 0 : 7},0)"/>`); });
      // beams
      h.beams.filter(b => b.st === st.id).forEach(b => { const bd = D && D.beams.find(r => r.id === b.id), a = [px(g.x[b.a[0]]), py(g.y[b.a[1]])], c = [px(g.x[b.b[0]]), py(g.y[b.b[1]])], hz = a[1] === c[1], sec = X.secOf(h, b.sec); o.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${c[0]}" y2="${c[1]}" class="hs-beam ${bd && !bd.ok ? 'ng' : ''}" style="stroke-width:${Math.max(3, sec.b * sc / 100)}"/><text x="${(a[0] + c[0]) / 2 + (hz ? 0 : -8)}" y="${(a[1] + c[1]) / 2 + (hz ? -8 : 4)}" class="hs-bl" ${hz ? '' : `transform="rotate(-90 ${(a[0] + c[0]) / 2 - 8} ${(a[1] + c[1]) / 2 + 4})"`}>${esc(bd && bd.mark ? bd.mark : b.sec)}</text>`); });
      // columns present at this storey (k = 0: pedestals below the ground beams)
      h.columns.forEach(c => { if (X.stIdx(h, c.top) < Math.max(k, 1) && k > 0) return; const sec = X.secOf(h, c.sec), w = Math.max(9, sec.b * sc / 100), d = Math.max(9, sec.h * sc / 100), cd = D && D.cols.find(r => r.id === c.id && r.seg === Math.max(0, k)); o.push(`<rect x="${px(g.x[c.i]) - w / 2}" y="${py(g.y[c.j]) - d / 2}" width="${w}" height="${d}" class="hs-col ${cd && !cd.ok ? 'ng' : ''}"/><text x="${px(g.x[c.i]) + w / 2 + 3}" y="${py(g.y[c.j]) + d / 2 + 11}" class="hs-cl">${esc(cd && cd.mark ? cd.mark : c.sec)}</text>`); if (k === 0 && D) { const fd = D.fnds.find(r => r.id === c.id); if (fd && fd.B) { const fw = fd.B * sc, fl = fd.L * sc; o.push(`<rect x="${px(g.x[c.i]) - fw / 2}" y="${py(g.y[c.j]) - fl / 2}" width="${fw}" height="${fl}" class="hs-fnd"/><text x="${px(g.x[c.i]) - fw / 2 + 2}" y="${py(g.y[c.j]) - fl / 2 - 3}" class="hs-cl">${esc(fd.mark)}</text>`); } } });
      // pick targets
      if (s === 'col' || s === 'grid') g.x.forEach((x, i) => g.y.forEach((y, j) => o.push(`<circle cx="${px(x)}" cy="${py(y)}" r="${s === 'col' ? 14 : 3}" class="hs-hit pt" ${s === 'col' ? `data-act="hs-pt" data-i="${i}" data-j="${j}"` : ''}><title>${gname(i, j)}</title></circle>`)));
      if (s === 'beam' || s === 'wall') { for (let j = 0; j < g.y.length; j++) for (let i = 0; i + 1 < g.x.length; i++) o.push(`<line x1="${px(g.x[i]) + 10}" y1="${py(g.y[j])}" x2="${px(g.x[i + 1]) - 10}" y2="${py(g.y[j])}" class="hs-hit seg" data-act="hs-seg" data-a="${i},${j}" data-b="${i + 1},${j}"/>`); for (let i = 0; i < g.x.length; i++) for (let j = 0; j + 1 < g.y.length; j++) o.push(`<line x1="${px(g.x[i])}" y1="${py(g.y[j]) - 10}" x2="${px(g.x[i])}" y2="${py(g.y[j + 1]) + 10}" class="hs-hit seg" data-act="hs-seg" data-a="${i},${j}" data-b="${i},${j + 1}"/>`); }
      if (s === 'slab' || s === 'stair') for (let i = 0; i + 1 < g.x.length; i++) for (let j = 0; j + 1 < g.y.length; j++) { const x0 = px(g.x[i]), x1 = px(g.x[i + 1]), y0 = py(g.y[j + 1]), y1 = py(g.y[j]); o.push(`<rect x="${x0 + 12}" y="${y0 + 12}" width="${x1 - x0 - 24}" height="${y1 - y0 - 24}" class="hs-hit bay" data-act="hs-bay" data-i="${i}" data-j="${j}"/>`); }
      o.push(`<text x="${W - 12}" y="22" class="hs-ttl">${esc(st.name)} · ระดับ ${fm(st.z)} ม.</text></svg>`);
      return o.join('');
    }
    const max1 = v => Math.max(1, v);

    // ------------------------------------------------------------------ 3D
    let viewer = null;
    function mesh3d() {
      const h = H(), D = A.D, m = new G.SC3D.Mesh(), S3 = STs(), gx = i => h.grid.x[i], gy = j => h.grid.y[j], Df = +h.soil.Df || 1.5;
      const lim = A.m3st && A.m3st !== 'all' ? X.stIdx(h, A.m3st) : 99, reb = A.m3 === 'rebar', ur = A.m3 === 'ur';
      const conc = [196, 192, 184], cF = [170, 164, 150], okC = [64, 168, 104], ngC = [222, 64, 72];
      const box = (tag, c, hx, hy, hz, col) => { m.tag = tag; m.alpha = reb ? 0.13 : null; m.box(c, [hx, hy, hz], [1, 0, 0], [0, 1, 0], [0, 0, 1], col); m.alpha = null; };
      const st = (o, base) => (ur && o ? (o.ok ? okC : ngC) : base);
      h.columns.forEach(c => { const fd = D && D.fnds.find(r => r.id === c.id), sec = X.secOf(h, c.sec), b = sec.b / 100, d = sec.h / 100, x = gx(c.i), y = gy(c.j), ft = fd && fd.t ? fd.t / 100 : 0.3;
        if (fd && fd.B) box('fnd:' + c.id, [x, y, -Df + ft / 2], fd.B / 2, fd.L / 2, ft / 2, st(fd, cF));
        if (fd && fd.pts && !reb) fd.pts.forEach(p => { m.tag = 'pile'; m.box([x + p[0], y + p[1], -Df - 1.2], [0.09, 0.09, 1.2], [1, 0, 0], [0, 1, 0], [0, 0, 1], [140, 136, 128]); });
        const top = Math.min(X.stIdx(h, c.top), lim); for (let k = 0; k <= top; k++) { const z0 = k === 0 ? -Df + ft : S3[k - 1].z, z1 = S3[k].z, cd = D && D.cols.find(r => r.id === c.id && r.seg === k); box(`col:${c.id}:${k}`, [x, y, (z0 + z1) / 2], b / 2, d / 2, (z1 - z0) / 2, st(cd, conc)); } });
      h.beams.forEach(bm => { const k = X.stIdx(h, bm.st); if (k > lim) return; const z = S3[k].z, sec = X.secOf(h, bm.sec), a = [gx(bm.a[0]), gy(bm.a[1])], b = [gx(bm.b[0]), gy(bm.b[1])], hz = a[1] === b[1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), bd = D && D.beams.find(r => r.id === bm.id);
        box('beam:' + bm.id, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z - sec.h / 200], hz ? L / 2 : sec.b / 200, hz ? sec.b / 200 : L / 2, sec.h / 200, st(bd, [206, 200, 190])); });
      h.slabs.forEach(s => { const k = X.stIdx(h, s.st); if (k > lim) return; const z = S3[k].z, sd = D && D.slabs.find(r => r.id === s.id), x0 = gx(s.i), x1 = gx(s.i + 1), y0 = gy(s.j), y1 = gy(s.j + 1); box('slab:' + s.id, [(x0 + x1) / 2, (y0 + y1) / 2, z - s.t / 200], (x1 - x0) / 2, (y1 - y0) / 2, s.t / 200, st(sd, [214, 210, 202])); });
      h.stairs.forEach(t => { const k = X.stIdx(h, t.st); if (k + 1 > lim || k + 1 >= S3.length) return; const z0 = S3[k].z, z1 = S3[k + 1].z, x0 = gx(t.i), x1 = gx(t.i + 1), y0 = gy(t.j), y1 = gy(t.j + 1); m.tag = 'stair:' + t.id; m.alpha = reb ? 0.13 : null;
        const P = t.dir === 'x' ? [[x0, y0 + 0.1, z0], [x1, y0 + 0.1, z1], [x1, y1 - 0.1, z1], [x0, y1 - 0.1, z0]] : [[x0 + 0.1, y0, z0], [x0 + 0.1, y1, z1], [x1 - 0.1, y1, z1], [x1 - 0.1, y0, z0]]; m.quad(P[0], P[1], P[2], P[3], st(D && D.stairs.find(r => r.id === t.id), [190, 180, 170])); m.alpha = null; });
      // roof trusses and purlins (lines)
      const rd = D && D.roof; if (rd && rd.truss && X.stIdx(h, rd.g.st) <= lim && !reb) { const g = rd.g, z = S3[X.stIdx(h, g.st)].z, tg = rd.truss.geom; for (let k2 = 0; k2 < rd.nTruss; k2++) { const s = Math.min(g.len, k2 * rd.sp), P = q => (g.dir === 'x' ? [g.x0 + s, g.y0 + q[0], z + q[1]] : [g.x0 + q[0], g.y0 + s, z + q[1]]); tg.mem.forEach(mm => m.line(P(tg.nodes[mm[1]]), P(tg.nodes[mm[2]]), ur ? (rd.ok ? okC : ngC) : [120, 92, 60], mm[0] === 'tc' || mm[0] === 'bc' ? 2 : 1.2)); } }
      if (reb && D) { BB.cage(h, D, { slabs: !!A.m3slab }).forEach(r => { const zc = r.pts[0][2]; void zc; const col = r.kind === 'tie' ? [40, 110, 200] : r.kind === 'slab' ? [120, 120, 120] : [200, 40, 40]; for (let q = 0; q + 1 < r.pts.length; q++) m.line(r.pts[q], r.pts[q + 1], col, r.kind === 'main' ? 1.8 : 1); }); }
      m.tag = ''; return m;
    }
    function mount3d() {
      const cv = $('#hsC3'); if (!cv || !G.SC3D) return;
      const h = H(), W = h.grid.x[h.grid.x.length - 1], D = h.grid.y[h.grid.y.length - 1], Z = X.topSt(h).z;
      if (!A.cam) A.cam = { yaw: -2.2, pitch: 0.42, dist: Math.max(W, D, Z) * 2.2, tx: W / 2, ty: D / 2, tz: Z / 2 };
      viewer = cv._v || new G.SC3D.Viewer(cv, A.cam); cv._v = viewer; viewer.cam = Object.assign({}, A.cam); viewer.onchange = c => { A.cam = Object.assign({}, c); };
      const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && G.matchMedia && G.matchMedia('(prefers-color-scheme: dark)').matches);
      viewer.bg = dark ? [24, 26, 30] : [250, 250, 248]; viewer.mesh = mesh3d(); viewer.marks = [];
      viewer.fmtPick = sel => [pickText(sel.tag)]; viewer.onpick = sel => { const p = $('#hsPick'); if (p) p.innerHTML = sel ? pickHTML(sel.tag) : ''; };
      viewer.draw();
    }
    function findEl(tag) {
      const D = A.D; if (!tag || !D) return null; const [k, id, seg] = tag.split(':');
      if (k === 'beam') return { k: 'คาน', o: D.beams.find(r => r.id === id) }; if (k === 'col') return { k: +seg === 0 ? 'ตอม่อ' : 'เสา', o: D.cols.find(r => r.id === id && r.seg === +seg) };
      if (k === 'fnd') return { k: 'ฐานราก', o: D.fnds.find(r => r.id === id) }; if (k === 'slab') return { k: 'พื้น', o: D.slabs.find(r => r.id === id) }; if (k === 'stair') return { k: 'บันได', o: D.stairs.find(r => r.id === id) }; return null;
    }
    const pickText = tag => { const e = findEl(tag); return e && e.o ? `${e.k} ${e.o.mark || ''} ${e.o.ok ? 'OK' : 'NG'}` : tag || ''; };
    function pickHTML(tag) {
      const e = findEl(tag); if (!e || !e.o) return `<span class="muted">${esc(tag || '')}</span>`; const o = e.o;
      const d = e.k === 'คาน' ? `${o.b}×${o.h} ซม. · บน ${o.top.n}-${o.top.bar} · ล่าง ${o.bot.n}-${o.bot.bar} · ปลอก ${o.shear.bar}@${o.shear.s} ซม. · Mu+ ${fm(o.Mpos)} Mu− ${fm(o.Mneg)} t·m · Vu ${fm(o.Vu)} t`
        : e.k === 'เสา' || e.k === 'ตอม่อ' ? `${o.b}×${o.h} ซม. · ${o.n}-${o.bar} · ปลอก ${o.tie}@${o.s} ซม. · Pu ${fm(o.Pu)} t · Mux ${fm(o.Mux)} Muy ${fm(o.Muy)} t·m · UR ${fm(o.ur)}`
          : e.k === 'ฐานราก' ? `${fm(o.B)}×${fm(o.L)}×${fm(o.t / 100)} ม. · ${o.fx.n}-${o.fx.bar} / ${o.fy.n}-${o.fy.bar}${o.np ? ` · เข็ม ${o.np} ต้น` : ''} · P ${fm(o.Ps)} t`
            : e.k === 'พื้น' ? `t = ${o.t} ซม. · ${o.rows.map(r => r.bar + '@' + r.s).filter((v, i, L) => L.indexOf(v) === i).join(', ')}` : `t = ${o.t} ซม. · ${o.main.bar}@${o.main.s}`;
      return `<b>${e.k} ${esc(o.mark || '')}</b> ${ok(o.ok)}<br><span class="mono sm">${esc(d)}</span>`;
    }

    // ------------------------------------------------------------------ output tables
    const locs = (L, fnLoc) => { const m = {}; L.forEach(o => { if (!o.mark) return; (m[o.mark] = m[o.mark] || []).push(o); }); return Object.entries(m).map(([mk, os]) => { const u = [...new Set(os.map(fnLoc))]; return { mark: mk, os, o: os[0], loc: u.length > 6 ? u.slice(0, 5).join(', ') + ` … (รวม ${u.length} ตำแหน่ง)` : u.join(', ') }; }); };
    const bLoc = o => { const st = STs().find(s => s.id === o.st); return `${st ? st.name.replace(/\s*\(.*\)/, '') : ''} ${gname(o.a[0], o.a[1])}–${gname(o.bb[0], o.bb[1])}`; };
    function results() {
      if (!A.R) return `<div class="hs-empty">กด “วิเคราะห์และออกแบบ” เพื่อดูผล</div>`;
      const h = H(), D = A.D, rx = Object.entries(A.R.RX);
      return `<h3>แรงปฏิกิริยาที่ฐานราก (D + L และ ${esc((A.R.combos.find(c => c.id === 'U1') || {}).name || 'U1')})</h3><div class="cn-tbl"><table class="hs-t"><tr><th>ตำแหน่ง</th><th>P ใช้งาน (t)</th><th>Pu (t)</th><th>Mux (t·m)</th><th>Muy (t·m)</th></tr>${rx.map(([id, r]) => { const [, i, j] = id.split(':').map(Number); return `<tr><td>${gname(i, j)}</td><td>${fm(r.s[2])}</td><td>${fm(r.u[2])}</td><td>${fm(Math.abs(r.u[3]))}</td><td>${fm(Math.abs(r.u[4]))}</td></tr>`; }).join('')}<tr><th>รวม</th><th>${fm(rx.reduce((s, [, r]) => s + r.s[2], 0))}</th><th>${fm(rx.reduce((s, [, r]) => s + r.u[2], 0))}</th><th></th><th></th></tr></table></div>
        <h3>แรงภายในคาน (envelope ULS)</h3><div class="cn-tbl"><table class="hs-t"><tr><th>คาน</th><th>ตำแหน่ง</th><th>ยาว (ม.)</th><th>Mu+ (t·m)</th><th>Mu− (t·m)</th><th>Vu (t)</th><th>δ ใช้งาน (มม.)</th></tr>${D.beams.map(b => `<tr><td>${esc(b.mark || '')}</td><td>${esc(bLoc(b))}</td><td>${fm(b.L)}</td><td>${fm(b.Mpos)}</td><td>${fm(b.Mneg)}</td><td>${fm(b.Vu)}</td><td>${fm(b.defl, 1)}</td></tr>`).join('')}</table></div>
        <h3>แรงในเสา (envelope ULS)</h3><div class="cn-tbl"><table class="hs-t"><tr><th>เสา</th><th>ตำแหน่ง</th><th>ช่วง</th><th>Pu (t)</th><th>Mux (t·m)</th><th>Muy (t·m)</th></tr>${D.cols.map(c => { const col = h.columns.find(q => q.id === c.id); return `<tr><td>${esc(c.mark || '')}</td><td>${gname(col.i, col.j)}</td><td>${c.seg === 0 ? 'ตอม่อ' : esc(STs()[c.seg - 1].name)}</td><td>${fm(c.Pu)}</td><td>${fm(c.Mux)}</td><td>${fm(c.Muy)}</td></tr>`; }).join('')}</table></div>`;
    }
    function designTables() {
      if (!A.D) return `<div class="hs-empty">กด “วิเคราะห์และออกแบบ” ก่อน</div>`;
      const h = H(), D = A.D, ov = h.over || {}, ovv = (k, f2) => (ov[k] && ov[k][f2] != null ? ov[k][f2] : '');
      const sel = (key, fld, cur, L, auto) => `<select data-hsov="${esc(key)}" data-f="${fld}"><option value="">${auto ? 'อัตโนมัติ' : '—'}</option>${opt(L.map(k => [k, k]), cur)}</select>`;
      const num = (key, fld, cur, w) => `<input data-hsov="${esc(key)}" data-f="${fld}" data-num="1" value="${esc(cur)}" placeholder="auto" style="width:${w || 52}px">`;
      const B = locs(D.beams, bLoc).map(g => { const o = g.o, ids = g.os.map(x => x.id).join(','); return `<tr><td><b>${g.mark}</b></td><td class="sm">${esc(g.loc)}</td><td><select data-hsbsec="${ids}">${opt(secOpts('beam'), (h.beams.find(b => b.id === o.id) || {}).sec)}</select></td><td>${num(ids, 'ntop', ovv('beam:' + o.id, 'ntop'), 40)}${sel(ids, 'top', ovv('beam:' + o.id, 'top'), ['DB12', 'DB16', 'DB20', 'DB25'], 1)}<div class="sm muted">${o.top.n}-${o.top.bar}</div></td><td>${num(ids, 'nbot', ovv('beam:' + o.id, 'nbot'), 40)}${sel(ids, 'bot', ovv('beam:' + o.id, 'bot'), ['DB12', 'DB16', 'DB20', 'DB25'], 1)}<div class="sm muted">${o.bot.n}-${o.bot.bar}</div></td><td>${sel(ids, 'stir', ovv('beam:' + o.id, 'stir'), ['RB6', 'RB9', 'DB10', 'DB12'], 1)}${num(ids, 's', ovv('beam:' + o.id, 's'), 44)}<div class="sm muted">${o.shear.bar}@${o.shear.s}</div></td><td>${fm(Math.max(...g.os.map(x => x.Mpos)))} / ${fm(Math.max(...g.os.map(x => x.Mneg)))}</td><td>${fm(Math.max(...g.os.map(x => x.Vu)))}</td><td>${ok(g.os.every(x => x.ok))}${g.os.some(x => x.warn.length) ? `<div class="sm bad">${esc([...new Set(g.os.flatMap(x => x.warn))].join(' · '))}</div>` : ''}</td></tr>`; }).join('');
      const C = locs(D.cols, c => { const q = h.columns.find(r => r.id === c.id); return (c.seg ? STs()[c.seg - 1].name.replace(/\s*\(.*\)/, '') + ' ' : '') + gname(q.i, q.j); }).map(g => { const o = g.o, ids = g.os.map(x => x.id + ':' + x.seg).join(','); const k0 = 'col:' + o.id + ':' + o.seg; return `<tr><td><b>${g.mark}</b></td><td class="sm">${o.seg === 0 ? 'ตอม่อ · ' : ''}${esc(g.loc)}</td><td><select data-hscsec="${[...new Set(g.os.map(x => x.id))].join(',')}">${opt(secOpts('col'), (h.columns.find(c => c.id === o.id) || {}).sec)}</select></td><td>${num(ids, 'n', ovv(k0, 'n'), 40)}${sel(ids, 'bar', ovv(k0, 'bar'), ['DB12', 'DB16', 'DB20', 'DB25'], 1)}<div class="sm muted">${o.n}-${o.bar}</div></td><td>${sel(ids, 'tie', ovv(k0, 'tie'), ['RB6', 'RB9', 'DB10'], 1)}<div class="sm muted">${o.tie}@${o.s}</div></td><td>${fm(Math.max(...g.os.map(x => x.Pu)))}</td><td>${fm(Math.max(...g.os.map(x => x.Mux)))} / ${fm(Math.max(...g.os.map(x => x.Muy)))}</td><td>${fm(Math.max(...g.os.map(x => x.ur)))}</td><td>${ok(g.os.every(x => x.ok))}</td></tr>`; }).join('');
      const F = locs(D.fnds, o => gname(o.i, o.j)).map(g => { const o = g.o, ids = g.os.map(x => x.id).join(','), k0 = 'fnd:' + o.id; return `<tr><td><b>${g.mark}</b></td><td class="sm">${esc(g.loc)}</td><td>${num(ids, 'B', ovv(k0, 'B'), 50)}<div class="sm muted">${fm(o.B)}</div></td><td>${num(ids, 'L', ovv(k0, 'L'), 50)}<div class="sm muted">${fm(o.L)}</div></td><td>${num(ids, 't', ovv(k0, 't'), 44)}<div class="sm muted">${o.t} ซม.</div></td><td>${sel(ids, 'bar', ovv(k0, 'bar'), ['DB12', 'DB16', 'DB20'], 1)}<div class="sm muted">${o.fx.n}-${o.fx.bar} / ${o.fy.n}-${o.fy.bar}</div></td><td>${h.soil.type === 'pile' ? num(ids, 'np', ovv(k0, 'np'), 40) + `<div class="sm muted">${o.np} ต้น · ${fm(o.Rpile)} t/ต้น</div>` : `<span class="sm">q = ${fm(o.q)} t/m²</span>`}</td><td>${fm(Math.max(...g.os.map(x => x.Ps)))}</td><td>${ok(g.os.every(x => x.ok))}${g.os.some(x => x.warn.length) ? `<div class="sm bad">${esc([...new Set(g.os.flatMap(x => x.warn))].join(' · '))}</div>` : ''}</td></tr>`; }).join('');
      const Sx = locs(D.slabs, o => { const s = h.slabs.find(q => q.id === o.id); return `${(STs().find(q => q.id === s.st) || {}).name || ''} ${gname(s.i, s.j)}`; }).map(g => { const o = g.o, ids = g.os.map(x => x.id).join(','); return `<tr><td><b>${g.mark}</b></td><td class="sm">${esc(g.loc)}</td><td><input data-hsslabt="${ids}" data-num="1" value="${o.t}" style="width:48px"></td><td>${o.ground ? 'บนดิน' : o.g.way === 'two' ? `สองทาง (กรณี ${o.case}, m = ${fm(o.m)})` : 'ทางเดียว'}</td><td>${sel(ids, 'bar', ovv('slab:' + o.id, 'bar'), ['RB9', 'DB10', 'DB12'], 1)}<div class="sm muted">${esc(o.rows.map(r => r.bar + '@' + r.s).filter((v, i, L) => L.indexOf(v) === i).join(', '))}</div></td><td>${fm(o.wu, 0)}</td><td>${ok(g.os.every(x => x.ok))}${o.warn.length ? `<div class="sm bad">${esc(o.warn.join(' · '))}</div>` : ''}</td></tr>`; }).join('');
      const ST = D.stairs.map((o, k) => `<tr><td><b>${o.mark}</b></td><td>${o.nr} ขั้น · ลูกตั้ง ${fm(o.R * 100, 1)} ซม. · ลูกนอน ${fm(o.Tr * 100, 1)} ซม.</td><td><input data-hsarr="stairs.${k}.t" data-num="1" value="${o.t}" style="width:48px"></td><td>${o.main.bar}@${o.main.s} / ${o.dist.bar}@${o.dist.s}</td><td>${fm(o.Mu / 1000)} t·m</td><td>${ok(o.ok)}</td></tr>`).join('');
      const R = D.roof, RT = R && R.truss ? R.truss.groups.map(gr => `<tr><td>${{ tc: 'จันทัน (Top chord)', bc: 'ขื่อ (Bottom chord)', vt: 'แนวดิ่ง', dg: 'ทแยง' }[gr.kind]}</td><td>${fm(gr.Nt, 0)}</td><td>${fm(gr.Nc, 0)}</td><td><select data-hsroof="sec_${gr.kind}"><option value="">อัตโนมัติ</option>${opt(X.BOX.map(k => [k, '□' + k]), h.roof['sec_' + gr.kind])}</select><div class="sm muted">${gr.sec ? esc(gr.sec.p.name) : '—'}</div></td><td>${gr.sec ? fm(gr.sec.KLr, 0) : '—'}</td><td>${gr.sec ? fm(gr.sec.ur) : '—'}</td><td>${ok(gr.sec && gr.sec.ok)}</td></tr>`).join('') + (R.purlin ? `<tr><td>แป @ ${fm(R.psp)} ม.</td><td colspan="2">M = ${fm(R.purlin.M, 0)} kg·m</td><td><select data-hsroof="purlin"><option value="">อัตโนมัติ</option>${opt(X.CLIP.map(k => [k, 'C' + k]), h.roof.purlin)}</select><div class="sm muted">${esc(R.purlin.p.name)}</div></td><td>fb ${fm(R.purlin.fb, 0)} ksc</td><td>${fm(R.purlin.fb / (0.6 * h.mat.Fy))}</td><td>${ok(R.purlin.fb <= 0.6 * h.mat.Fy)}</td></tr>` : '') : '';
      return `<h3>คาน</h3><div class="cn-tbl"><table class="hs-t"><tr><th>ชื่อ</th><th>ตำแหน่ง</th><th>หน้าตัด</th><th>เหล็กบน</th><th>เหล็กล่าง</th><th>ปลอก</th><th>Mu+/Mu− t·m</th><th>Vu t</th><th></th></tr>${B}</table></div>
        <h3>เสาและตอม่อ</h3><div class="cn-tbl"><table class="hs-t"><tr><th>ชื่อ</th><th>ตำแหน่ง</th><th>หน้าตัด</th><th>เหล็กยืน</th><th>ปลอก</th><th>Pu t</th><th>Mux/Muy t·m</th><th>UR</th><th></th></tr>${C}</table></div>
        <h3>ฐานราก</h3><div class="cn-tbl"><table class="hs-t"><tr><th>ชื่อ</th><th>ตำแหน่ง</th><th>B (ม.)</th><th>L (ม.)</th><th>t (ซม.)</th><th>เหล็ก</th><th>${h.soil.type === 'pile' ? 'เสาเข็ม' : 'แรงดันดิน'}</th><th>P t</th><th></th></tr>${F}</table></div>
        <h3>พื้น</h3><div class="cn-tbl"><table class="hs-t"><tr><th>ชื่อ</th><th>ตำแหน่ง</th><th>t (ซม.)</th><th>ระบบ</th><th>เหล็กเสริม</th><th>wu kg/m²</th><th></th></tr>${Sx}</table></div>
        ${ST ? `<h3>บันได</h3><div class="cn-tbl"><table class="hs-t"><tr><th>ชื่อ</th><th>ขั้นบันได</th><th>ท้องบันได (ซม.)</th><th>เหล็กเสริม</th><th>Mu</th><th></th></tr>${ST}</table></div>` : ''}
        ${RT ? `<h3>โครงหลังคาเหล็ก (ASD)</h3><div class="cn-tbl"><table class="hs-t"><tr><th>ชิ้นส่วน</th><th>แรงดึง kg</th><th>แรงอัด kg</th><th>หน้าตัด</th><th>KL/r</th><th>UR</th><th></th></tr>${RT}</table></div>` : ''}`;
    }
    function boqTables() {
      if (!A.Q) return `<div class="hs-empty">กด “วิเคราะห์และออกแบบ” ก่อน</div>`;
      const h = H(), Q = A.Q, r = h.rates || {}, grp = {}; Q.items.forEach(it => (grp[it.grp] = grp[it.grp] || []).push(it));
      const rows = Object.entries(grp).map(([g, L]) => `<tr class="hs-grp"><th colspan="8">${esc(g)}</th></tr>` + L.map(it => `<tr><td>${esc(it.name)}</td><td class="num">${fm(it.q)}</td><td>${it.unit}</td><td><input data-hsrate="${it.key}" data-f="mat" data-num="1" value="${esc((r[it.key] || {}).mat || '')}" style="width:64px"></td><td class="num">${it.mat ? fm(it.q * it.mat) : ''}</td><td><input data-hsrate="${it.key}" data-f="lab" data-num="1" value="${esc((r[it.key] || {}).lab || '')}" style="width:64px"></td><td class="num">${it.lab ? fm(it.q * it.lab) : ''}</td><td class="num">${it.tot ? fm(it.tot) : ''}</td></tr>`).join('')).join('');
      const bbs = {}; Q.B.rows.forEach(x => (bbs[x.grp + ' ' + x.mark] = bbs[x.grp + ' ' + x.mark] || []).push(x));
      const SH = { U: '⊔', L: '⌐', I: '—', Z: '⟋', '□': '□' };
      return `<h3>ปริมาณงานโครงสร้าง (BOQ)</h3><div class="cn-tbl"><table class="hs-t"><tr><th>รายการ</th><th>ปริมาณ</th><th>หน่วย</th><th>ค่าวัสดุ/หน่วย</th><th>รวมค่าวัสดุ</th><th>ค่าแรง/หน่วย</th><th>รวมค่าแรง</th><th>รวม (บาท)</th></tr>${rows}<tr class="hs-grp"><th colspan="7">รวมทั้งสิ้น</th><th class="num">${fm(Q.total)}</th></tr></table></div>
        <h3>สรุปเหล็กเสริม</h3><div class="cn-tbl"><table class="hs-t"><tr><th>ขนาด</th><th>ความยาวรวม (ม.)</th><th>น้ำหนัก (กก.)</th><th>เผื่อ ${h.mat.waste}% (กก.)</th><th>จำนวนเส้น (10 ม.)</th></tr>${Q.B.byBar.map(o => `<tr><td>${o.bar}</td><td class="num">${fm(o.L, 1)}</td><td class="num">${fm(o.kg, 1)}</td><td class="num">${fm(o.kgw, 1)}</td><td class="num">${o.nStock}</td></tr>`).join('')}<tr class="hs-grp"><th>รวม</th><th></th><th class="num">${fm(Q.B.byBar.reduce((s, o) => s + o.kg, 0), 1)}</th><th class="num">${fm(Q.kgAll, 1)}</th><th></th></tr></table></div>
        <h3>ตารางตัดเหล็ก (BBS)</h3><div class="cn-tbl"><table class="hs-t"><tr><th>ชิ้นส่วน</th><th>ตำแหน่งเหล็ก</th><th>ขนาด</th><th>รูปร่าง</th><th>ยาว/เส้น (ม.)</th><th>ทาบ</th><th>จำนวน</th><th>น้ำหนัก (กก.)</th></tr>${Object.entries(bbs).map(([k, L]) => L.map((x, i) => `<tr>${i ? '<td></td>' : `<td rowspan="1"><b>${esc(k)}</b></td>`}<td class="sm">${esc(x.note)}</td><td>${x.bar}</td><td>${SH[x.shape] || x.shape}</td><td class="num">${fm(x.L)}</td><td>${x.laps || ''}</td><td class="num">${x.n}</td><td class="num">${fm(x.kg, 1)}</td></tr>`).join('')).join('')}</table></div>`;
    }
    function dwgView() {
      if (!A.D) return `<div class="hs-empty">กด “วิเคราะห์และออกแบบ” ก่อน</div>`;
      if (!G.HOUSEDWG) return `<div class="hs-empty">โมดูลแบบก่อสร้างยังไม่พร้อม</div>`;
      let sh; try { sh = G.HOUSEDWG.sheets(H(), A.R, A.D, { size: A.paper }); } catch (e) { return `<div class="hs-empty bad">สร้างแบบไม่สำเร็จ: ${esc(e.message)}</div>`; }
      A.sheets = sh; const k = Math.min(A.sheet, sh.length - 1);
      return `<div class="hs-sheets">${sh.map((s, i) => `<button class="btn sm ${i === k ? 'btn-hot' : 'btn-ghost'}" data-act="hs-c" data-c="sheet" data-v="${i}">${esc(s.no)} ${esc(s.title)}</button>`).join('')}</div><div class="hs-sheet">${G.HOUSEDWG.svg(sh[k])}</div>`;
    }

    // ------------------------------------------------------------------ report
    function renderReport() {
      if (!isPro()) { toast('รายการคำนวณสำหรับสมาชิก Pro', 'bad'); return; }
      if (!ensure()) { toast('วิเคราะห์ไม่สำเร็จ', 'bad'); return; }
      const h = H(), w = $('#reportWrap'); if (!w) return;
      const body = G.HOUSERPT ? G.HOUSERPT.html(h, A.R, A.D, A.Q, { esc, logo: logoMark(34), date: today() }) : '<p class="rp-txt">โมดูลรายการคำนวณยังไม่พร้อม</p>';
      w.innerHTML = `<div class="rp-bar"><h2>รายการคำนวณโครงสร้าง — ${esc(h.meta.project || '')}</h2><div class="rp-btns"><button class="btn btn-hot sm" data-act="pdf" id="pdfBtn">ส่งออก PDF</button><button class="btn btn-ghost sm" data-act="closeReport">ปิด</button></div></div>
        <article class="report" id="report" lang="th">${body}<p class="rp-foot"><b>${COPY}</b> · จัดทำโดย StructCap วิศวกรผู้ออกแบบต้องตรวจสอบและรับผิดชอบต่อข้อมูล แบบจำลอง และผลการออกแบบ</p></article>`;
      S.reportOpen = true; w.scrollIntoView({ behavior: 'smooth' });
    }

    // ------------------------------------------------------------------ exports
    const fname = ext => ((H().meta.project || 'house').replace(/[^\w฀-๿\-]+/g, '_') + '_' + today() + '.' + ext);
    const csv = rows => '﻿' + rows.map(r => r.map(c => { const s = String(c == null ? '' : c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
    function loadJs(src) { return new Promise((res, rej) => { if ([...document.scripts].some(s => s.src === src)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
    async function pdfDwg() {
      if (!isPro()) { toast('การส่งออกแบบสำหรับสมาชิก Pro', 'bad'); return; } if (G.SC_FEAT_OFF && G.SC_FEAT_OFF('pdf')) return;
      if (!ensure() || !G.HOUSEDWG) return; toast('กำลังสร้าง PDF…', '');
      try { await loadJs('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'); const doc = await G.HOUSEDWG.pdf(H(), A.R, A.D, { size: A.paper }); saveFile(fname('pdf').replace('.pdf', '_' + A.paper + '.pdf'), doc.output('blob')); }
      catch (e) { toast('สร้าง PDF ไม่สำเร็จ: ' + (e.message || e), 'bad'); }
    }
    function dxfDwg() {
      if (!isPro()) { toast('การส่งออกแบบสำหรับสมาชิก Pro', 'bad'); return; } if (G.SC_FEAT_OFF && G.SC_FEAT_OFF('dxf')) return;
      if (!ensure() || !G.HOUSEDWG) return; try { const b = G.HOUSEDWG.dxf(H(), A.R, A.D, { size: A.paper }); saveFile(fname('dxf'), new Blob([b], { type: 'application/dxf' })); } catch (e) { toast('สร้าง DXF ไม่สำเร็จ: ' + e.message, 'bad'); }
    }

    // ------------------------------------------------------------------ view
    function work() {
      const s = A.step;
      if (s === 'm3') return `<div class="hs-c3"><canvas id="hsC3" tabindex="0"></canvas></div>`;
      if (s === 'run') return `<div class="hs-out">${results()}</div>`;
      if (s === 'design') return `<div class="hs-out">${designTables()}</div>`;
      if (s === 'boq') return `<div class="hs-out">${boqTables()}</div>`;
      if (s === 'dwg') return `<div class="hs-out">${dwgView()}</div>`;
      if (s === 'report') return `<div class="hs-out">${A.D ? designSummary() : '<div class="hs-empty">กด “สร้างรายการคำนวณ”</div>'}</div>`;
      return `<div class="hs-planw">${plan()}</div>`;
    }
    function designSummary() { const s = X.summary(A.D); return `<h3>สรุปผลการออกแบบ</h3><div class="cn-tbl"><table class="hs-t"><tr><th>ชนิด</th><th>ชื่อ</th><th>ผล</th></tr>${[...new Map(s.list.map(x => [x.k + x.mark, x])).values()].map(x => `<tr><td>${x.k}</td><td>${esc(x.mark || '')}</td><td>${ok(x.ok)}</td></tr>`).join('')}</table></div>`; }
    function view() {
      const s = A.step;
      return `<main class="an an-app hs-app"><div class="hs-top"><div class="hs-title"><b>ออกแบบบ้านพักอาศัย</b><span class="muted sm">${esc(H().meta.project || '')}</span></div>
          <nav class="hs-steps">${STEPS.map(([k, l], i) => `<button class="hs-step ${k === s ? 'on' : ''} ${OUT_STEPS.includes(k) && A.D ? 'done' : ''}" data-act="hs-step" data-s="${k}"><i>${i + 1}</i>${l}</button>`).join('')}</nav>
          <div class="hs-tools">${btn('undo', '↶', null)}${btn('redo', '↷', null)}${btn('new', 'ใหม่')}${btn('ex', 'ตัวอย่าง')}${btn('save', 'บันทึก')}<label class="btn btn-ghost sm">เปิด<input type="file" id="hs-file" accept=".json" hidden></label>${btn('run', '▶ วิเคราะห์', null, 'btn-hot')}</div></div>
        <aside class="hs-side" id="hsSide">${panel()}</aside><section class="hs-work" id="hsWork">${work()}</section><div id="reportWrap" class="an-report"></div></main>`;
    }
    // re-render the work area (and the side panel), keeping scroll positions and the focused input with its caret
    function refresh(side) {
      const ae = document.activeElement; let sel = null, pos = null;
      if (ae && ae.closest && ae.closest('.hs-app') && ae.tagName === 'INPUT' && ae.type !== 'checkbox') { sel = [...ae.attributes].filter(a => a.name.startsWith('data-')).map(a => `[${a.name}="${String(a.value).replace(/["\\]/g, '\\$&')}"]`).join(''); try { pos = ae.selectionStart; } catch (e) { } }
      const o1 = $('#hsWork .hs-out'), sc = o1 ? o1.scrollTop : 0, sd = $('#hsSide'), sc2 = sd ? sd.scrollTop : 0;
      const w = $('#hsWork'); if (w) w.innerHTML = work(); if (side !== false && sd) { sd.innerHTML = panel(); sd.scrollTop = sc2; }
      const o2 = $('#hsWork .hs-out'); if (o2) o2.scrollTop = sc;
      $$('.hs-step').forEach(b => { b.classList.toggle('on', b.dataset.s === A.step); b.classList.toggle('done', OUT_STEPS.includes(b.dataset.s) && !!A.D); });
      if (A.step === 'm3') mount3d();
      if (sel) { const n = document.querySelector('.hs-app ' + sel); if (n && n !== document.activeElement) { n.focus(); try { if (pos != null) n.setSelectionRange(pos, pos); } catch (e) { } } }
    }
    let tmr = 0; const later = fn => { clearTimeout(tmr); tmr = setTimeout(fn, 350); };
    const redesign = () => later(() => { persist(); solve(true); refresh(false); });
    function rerun() { if (A.D) solve(true); }

    // ------------------------------------------------------------------ editing
    function setPath(path, v) { const ks = path.split('.'); let o = H(); for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; } o[ks[ks.length - 1]] = v; }
    function reGrid(axis, txt) {
      const h = H(), sp = String(txt).split(/[,\s]+/).map(Number).filter(v => v > 0); if (!sp.length) return;
      const pos = [0]; sp.forEach(v => pos.push(+(pos[pos.length - 1] + v).toFixed(3))); h.grid[axis] = pos;
      const nk = axis + 'n', def = axis === 'x' ? i => String(i + 1) : i => String.fromCharCode(65 + i); while (h.grid[nk].length < pos.length) h.grid[nk].push(def(h.grid[nk].length)); h.grid[nk].length = pos.length;
      const nx = h.grid.x.length, ny = h.grid.y.length, okP = p => p[0] < nx && p[1] < ny;
      h.columns = h.columns.filter(c => c.i < nx && c.j < ny); h.beams = h.beams.filter(b => okP(b.a) && okP(b.b)); h.walls = h.walls.filter(b => okP(b.a) && okP(b.b));
      h.slabs = h.slabs.filter(s => s.i + 1 < nx && s.j + 1 < ny); h.stairs = h.stairs.filter(s => s.i + 1 < nx && s.j + 1 < ny);
    }
    function clickPt(i, j) { const h = H(), c = h.columns.find(q => q.i === i && q.j === j), top = A.brush.ctop || X.topSt(h).id; if (!c) h.columns.push({ id: X.uid(h, 'c'), i, j, top, sec: A.brush.csec }); else if (c.sec !== A.brush.csec || c.top !== top) { c.sec = A.brush.csec; c.top = top; } else h.columns.splice(h.columns.indexOf(c), 1); }
    function clickSeg(a, b) {
      const h = H(), st = curSt().id;
      if (A.step === 'beam') { const e = X.beamOn(h, st, a, b); if (!e) h.beams.push({ id: X.uid(h, 'b'), st, a, b, sec: A.brush.bsec }); else if (e.sec !== A.brush.bsec) e.sec = A.brush.bsec; else { h.beams.splice(h.beams.indexOf(e), 1); h.walls = h.walls.filter(w => !(w.st === st && X.beamOn({ beams: [e] }, st, w.a, w.b))); } }
      else { const k = h.walls.findIndex(w => w.st === st && ((w.a + '' === a + '' && w.b + '' === b + '') || (w.a + '' === b + '' && w.b + '' === a + ''))); if (k < 0) { if (!X.beamOn(h, st, a, b)) { toast('ต้องมีคานรองรับผนัง', 'bad'); return false; } h.walls.push({ st, a, b, type: A.brush.wall }); } else if (h.walls[k].type !== A.brush.wall) h.walls[k].type = A.brush.wall; else h.walls.splice(k, 1); }
      return true;
    }
    function clickBay(i, j) {
      const h = H(), st = curSt().id;
      if (A.step === 'slab') { const s = h.slabs.find(q => q.st === st && q.i === i && q.j === j), B = A.brush; if (!s) h.slabs.push({ id: X.uid(h, 's'), st, i, j, t: +B.t || 12, use: B.use, ground: !!B.ground }); else if (s.t !== +B.t || s.use !== B.use || !!s.ground !== !!B.ground) Object.assign(s, { t: +B.t || 12, use: B.use, ground: !!B.ground }); else h.slabs.splice(h.slabs.indexOf(s), 1); return true; }
      const k = X.stIdx(h, st), L = STs(); if (k + 1 >= L.length) { toast('เลือกชั้นที่บันไดเริ่มต้น (ไม่ใช่ชั้นบนสุด)', 'bad'); return false; }
      const e = h.stairs.findIndex(q => q.st === st && q.i === i && q.j === j); if (e >= 0) { h.stairs.splice(e, 1); return true; }
      h.stairs.push({ id: 'ST' + (h.stairs.length + 1), st, i, j, dir: A.brush.sdir, t: 15 }); const up = L[k + 1].id, n0 = h.slabs.length; h.slabs = h.slabs.filter(q => !(q.st === up && q.i === i && q.j === j)); if (h.slabs.length < n0) toast('ลบพื้นชั้นบนในช่องบันไดแล้ว', ''); return true;
    }
    const OVK = { beam: 'beam:', col: 'col:', fnd: 'fnd:', slab: 'slab:' };
    function cmd(c, v) {
      const h = H(), st = curSt().id, nx = h.grid.x.length, ny = h.grid.y.length;
      if (c === 'undo') return undo(false); if (c === 'redo') return undo(true);
      if (c === 'run') { solve(false); refresh(); return; }
      if (c === 'report') { renderReport(); return; }
      if (c === 'save') { persist(); saveFile(fname('json'), new Blob([JSON.stringify({ app: 'StructCap House', v: 1, H: h }, null, 1)], { type: 'application/json' })); return; }
      if (c === 'm3') { A.m3 = v; refresh(); return; } if (c === 'sheet') { A.sheet = +v; refresh(false); return; }
      if (c === 'pdfdwg') { pdfDwg(); return; } if (c === 'dxfdwg') { dxfDwg(); return; }
      if (c === 'csvboq') { if (!ensure()) return; saveFile(fname('csv').replace('.csv', '_BOQ.csv'), new Blob([csv([['หมวด', 'รายการ', 'ปริมาณ', 'หน่วย', 'ค่าวัสดุ/หน่วย', 'ค่าแรง/หน่วย', 'รวม']].concat(A.Q.items.map(i => [i.grp, i.name, i.q.toFixed(2), i.unit, i.mat || '', i.lab || '', i.tot ? i.tot.toFixed(2) : ''])))], { type: 'text/csv' })); return; }
      if (c === 'csvbbs') { if (!ensure()) return; saveFile(fname('csv').replace('.csv', '_BBS.csv'), new Blob([csv([['ชิ้นส่วน', 'ชื่อ', 'ตำแหน่งเหล็ก', 'ขนาด', 'รูปร่าง', 'ยาว/เส้น (ม.)', 'จุดทาบ', 'จำนวน', 'น้ำหนัก (กก.)']].concat(A.Q.B.rows.map(r => [r.grp, r.mark, r.note, r.bar, r.shape, r.L.toFixed(2), r.laps, r.n, r.kg.toFixed(2)])))], { type: 'text/csv' })); return; }
      if (c === 'new') { if (!confirm('เริ่มโครงการใหม่? (กดเลิกทำเพื่อย้อนกลับได้)')) return; snap(); A.H = X.defaults(); X.auto(A.H, { cols: true }); stale(); persist(); render(); return; }
      if (c === 'ex') { snap(); A.H = X.example(); stale(); persist(); render(); toast('โหลดบ้านตัวอย่าง 2 ชั้น 12 × 8 ม.', 'ok'); return; }
      snap();
      if (c === 'allcols') { h.columns = []; for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) h.columns.push({ id: X.uid(h, 'c'), i, j, top: A.brush.ctop || X.topSt(h).id, sec: A.brush.csec }); }
      else if (c === 'nocols') h.columns = [];
      else if (c === 'allbeams') { for (let j = 0; j < ny; j++) for (let i = 0; i + 1 < nx; i++) if (!X.beamOn(h, st, [i, j], [i + 1, j])) h.beams.push({ id: X.uid(h, 'b'), st, a: [i, j], b: [i + 1, j], sec: A.brush.bsec }); for (let i = 0; i < nx; i++) for (let j = 0; j + 1 < ny; j++) if (!X.beamOn(h, st, [i, j], [i, j + 1])) h.beams.push({ id: X.uid(h, 'b'), st, a: [i, j], b: [i, j + 1], sec: A.brush.bsec }); }
      else if (c === 'nobeams') { h.beams = h.beams.filter(b => b.st !== st); h.walls = h.walls.filter(w => w.st !== st); }
      else if (c === 'copybeams') { const k = X.stIdx(h, st), lo = STs()[k - 1]; if (!lo) { toast('ไม่มีชั้นล่าง', 'bad'); return; } h.beams = h.beams.filter(b => b.st !== st).concat(h.beams.filter(b => b.st === lo.id).map(b => ({ id: X.uid(h, 'b'), st, a: b.a.slice(), b: b.b.slice(), sec: b.sec }))); }
      else if (c === 'allslabs') { const B = A.brush; for (let i = 0; i + 1 < nx; i++) for (let j = 0; j + 1 < ny; j++) if (!h.slabs.some(q => q.st === st && q.i === i && q.j === j) && !h.stairs.some(q => STs()[X.stIdx(h, q.st) + 1] && STs()[X.stIdx(h, q.st) + 1].id === st && q.i === i && q.j === j)) h.slabs.push({ id: X.uid(h, 's'), st, i, j, t: +B.t || 12, use: B.use, ground: !!B.ground }); }
      else if (c === 'noslabs') h.slabs = h.slabs.filter(q => q.st !== st);
      else if (c === 'perwalls') X.perimeter(h).forEach(([a, b]) => { if (X.beamOn(h, st, a, b) && !h.walls.some(w => w.st === st && w.a + '' === a + '' && w.b + '' === b + '')) h.walls.push({ st, a, b, type: A.brush.wall }); });
      else if (c === 'nowalls') h.walls = h.walls.filter(w => w.st !== st);
      else if (c === 'stadd') { const L = STs(), top = L[L.length - 1], dz = L.length > 1 ? top.z - L[L.length - 2].z : 3; const id = 'S' + (Math.max(0, ...h.stories.map(s => +String(s.id).replace(/\D/g, '') || 0)) + 1); h.stories.push({ id, name: 'ชั้นที่ ' + (L.length + 1), z: +(top.z + dz).toFixed(2) }); }
      else if (c === 'stdel') { if (h.stories.length <= 2) { toast('ต้องมีอย่างน้อย 2 ชั้น', 'bad'); return; } h.stories = h.stories.filter(s => s.id !== v); ['beams', 'slabs', 'walls', 'stairs'].forEach(k => { h[k] = h[k].filter(e => e.st !== v); }); const tp = X.topSt(h).id; h.columns.forEach(cc => { if (X.stIdx(h, cc.top) < 0) cc.top = tp; }); if (h.roof.st === v) h.roof.st = tp; }
      else if (c === 'secadd') { const pre = v === 'col' ? 'C' : 'B', n = Math.max(0, ...h.sections.filter(s => s.id.startsWith(pre) && /^\D+\d+$/.test(s.id)).map(s => +s.id.replace(/\D/g, ''))) + 1; h.sections.push(v === 'col' ? { id: 'C' + n, kind: 'col', b: 25, h: 25 } : { id: 'B' + n, kind: 'beam', b: 20, h: 50 }); }
      else if (c === 'secdel') h.sections.splice(+v, 1);
      else if (c === 'stairdel') h.stairs.splice(+v, 1);
      else if (c === 'cmbadd' || c === 'cmbdel' || c === 'cmbreset') { if (c === 'cmbreset') delete h.loads.combos; else { if (!h.loads.combos || !h.loads.combos.length) h.loads.combos = X.clone(X.defCombos(h)); if (c === 'cmbadd') h.loads.combos.push({ id: 'C' + (h.loads.combos.length + 1), name: 'Combo ' + (h.loads.combos.length + 1), type: 'ULS', f: { D: 1.4, L: 1.7 } }); else h.loads.combos.splice(+v, 1); } }
      else if (c === 'ovclear') { h.over = {}; }
      stale(); persist(); if (['ovclear'].includes(c)) solve(true); refresh();
    }
    function onClick(a, b) {
      if (a === 'hs-c') { cmd(b.dataset.c, b.dataset.v); return true; }
      if (a === 'hs-step') { A.step = b.dataset.s; if (OUT_STEPS.concat(['m3']).includes(A.step) && !A.D && A.step !== 'report') solve(true); if (A.step === 'report' && !A.D) solve(true); refresh(); return true; }
      if (a === 'hs-pt') { snap(); clickPt(+b.dataset.i, +b.dataset.j); stale(); persist(); refresh(false); return true; }
      if (a === 'hs-seg') { snap(); if (clickSeg(b.dataset.a.split(',').map(Number), b.dataset.b.split(',').map(Number))) { stale(); persist(); refresh(false); } return true; }
      if (a === 'hs-bay') { snap(); if (clickBay(+b.dataset.i, +b.dataset.j)) { stale(); persist(); refresh(A.step === 'stair'); } return true; }
      return false;
    }
    function onInput(t) {
      if (!t.closest('.hs-app')) return false;
      const val = t.dataset.chk ? t.checked : t.dataset.num ? (t.value === '' ? '' : +t.value) : t.value, d = t.dataset, h = H();
      if (t.type !== 'file' && (!A._ts || Date.now() - A._ts > 800)) snap(); A._ts = Date.now();
      if (d.hs) {
        const p = d.hs;
        if (p[0] === '@') { const k = p.slice(1); if (k === 'st') A.st = val; else if (k === 'paper') A.paper = val; else if (k === 'm3st') A.m3st = val; else if (k === 'm3slab') A.m3slab = val; else A.brush[k] = val; refresh(['st', 'paper', 'm3st', 'm3slab'].includes(k) ? undefined : false); return true; }
        if (d.num && val === '') return true; setPath(p, val); stale(); persist();
        if (/^(soil\.type|loads\.wind\.on|roof\.type)$/.test(p) || t.tagName === 'SELECT' || d.chk) refresh(); else { const tt = $('.hs-title .muted'); if (tt && p === 'meta.project') tt.textContent = val; if (PLAN_STEPS.includes(A.step)) refresh(false); }
        return true;
      }
      if (d.hsgrid) { reGrid(d.hsgrid, t.value); stale(); persist(); refresh(false); return true; }
      if (d.hsgridn) { h.grid[d.hsgridn] = t.value.split(',').map(s => s.trim()); while (h.grid[d.hsgridn].length < h.grid[d.hsgridn === 'xn' ? 'x' : 'y'].length) h.grid[d.hsgridn].push('?'); persist(); refresh(false); return true; }
      if (d.hsst) { const s = h.stories.find(q => q.id === d.hsst); if (!s || (d.num && val === '')) return true; s[d.k] = val; stale(); persist(); if (d.k === 'z') refresh(); return true; }
      if (d.hssec) { const q = h.sections[+d.hssec]; if (!q || !(+val > 0)) return true; q[d.k] = val; stale(); persist(); return true; }
      if (d.hsarr) { if (d.num && val === '') return true; setPath(d.hsarr, val); stale(); persist(); if (A.step === 'design') redesign(); return true; }
      if (d.hscmb != null) { if (!h.loads.combos || !h.loads.combos.length) h.loads.combos = X.clone(X.defCombos(h)); const c = h.loads.combos[+d.hscmb]; if (!c) return true; if (d.k.startsWith('f.')) { c.f = c.f || {}; if (val === '') delete c.f[d.k.slice(2)]; else c.f[d.k.slice(2)] = val; } else c[d.k] = val; stale(); persist(); return true; }
      // design overrides (apply to every member of the mark)
      if (d.hsov != null) {
        const kind = A.step === 'design' ? (t.closest('table') && t.closest('table').previousElementSibling ? '' : '') : ''; void kind;
        const sec = t.closest('.cn-tbl').previousElementSibling.textContent, pre = /คาน/.test(sec) ? OVK.beam : /เสา/.test(sec) ? OVK.col : /ฐานราก/.test(sec) ? OVK.fnd : OVK.slab;
        h.over = h.over || {}; d.hsov.split(',').forEach(id => { const k = pre + id, o = h.over[k] = h.over[k] || {}; if (val === '' || val == null) delete o[d.f]; else o[d.f] = val; if (!Object.keys(o).length) delete h.over[k]; });
        redesign(); return true;
      }
      if (d.hsbsec) { d.hsbsec.split(',').forEach(id => { const b = h.beams.find(q => q.id === id); if (b) b.sec = val; }); persist(); solve(true); refresh(false); return true; }
      if (d.hscsec) { d.hscsec.split(',').forEach(id => { const c = h.columns.find(q => q.id === id); if (c) c.sec = val; }); persist(); solve(true); refresh(false); return true; }
      if (d.hsslabt) { if (!(+val > 0)) return true; d.hsslabt.split(',').forEach(id => { const s = h.slabs.find(q => q.id === id); if (s) s.t = val; }); redesign(); return true; }
      if (d.hsroof) { if (val === '') delete h.roof[d.hsroof]; else h.roof[d.hsroof] = val; persist(); solve(true); refresh(false); return true; }
      if (d.hsrate) { h.rates = h.rates || {}; const r = h.rates[d.hsrate] = h.rates[d.hsrate] || {}; r[d.f] = val === '' ? 0 : val; persist(); later(() => { A.Q = BB.boq(h, A.D); refresh(false); }); return true; }
      return true;
    }
    let bound = false;
    function mount() {
      if (A.step === 'm3') mount3d();
      if (bound) return; bound = true;
      document.addEventListener('change', e => { const t = e.target; if (S.view !== VIEW || !t || t.id !== 'hs-file') return; const fl = t.files[0]; if (!fl) return; fl.text().then(txt => { try { const j = JSON.parse(txt), h = j.H || j; if (!h.grid || !h.stories) throw 0; snap(); A.H = h; stale(); persist(); render(); toast('เปิดไฟล์แล้ว', 'ok'); } catch (er) { toast('ไฟล์นี้ไม่ใช่ไฟล์บ้าน StructCap', 'bad'); } }); });
      document.addEventListener('keydown', e => { if (S.view !== VIEW) return; const tg = e.target; if (tg && /INPUT|SELECT|TEXTAREA/.test(tg.tagName)) return; if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); cmd('run'); } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(e.shiftKey); } });
      G.addEventListener && G.addEventListener('resize', () => { if (S.view === VIEW && A.step === 'm3' && viewer) viewer.draw(); });
    }
    return { view, mount, onClick, onInput, state: A, solve, renderReport };
  };
})(typeof window !== 'undefined' ? window : globalThis);
