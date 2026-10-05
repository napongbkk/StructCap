/* StructCap Connection — steel joint design app (ribbon, tree, 3D view, properties, checks, report).
   The 3D view is WebGL (conn3d.js) with a 2D overlay for labels, loads and the move / rotate gizmo; parts are added
   by dragging Plate, Stiffener, Member, Weld or Bolts from the toolbox onto a face of the model.
   Uses conn.js (joint model), conncheck.js (component method) and connfe.js (plate FE / CBFEM).
   The FE runs in a Web Worker (connworker.js) when the browser allows it, otherwise on the page. */
(function (G) {
  'use strict';
  G.SC_CONN_UI = function (ctx) {
    const { T, esc, f, $, S, toast, isPro, COPY, logoMark, today, saveFile } = ctx;
    const C = G.CONN, V = C.V, VIEW = 'conn';
    const LS = 'sc.conn.v1';
    const abs = Math.abs, max = Math.max, min = Math.min;
    const store = { get() { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(LS, JSON.stringify(v)); } catch (e) { } } };
    const defCode = () => (S.code === 'AS' ? 'AS' : /^(EC|EN)/.test(S.code || '') ? 'EN' : S.code ? 'AISC' : 'EN');
    const saved = store.get();
    const A = {
      J: saved && saved.J && C.TYPES[saved.J.type] ? saved.J : C.newJoint('ep', defCode()), g: null, cm: {}, fe: {}, fec: {}, feErr: {}, err: null,
      le: null, rib: 'design', disp: 'model', dsc: 1, def: false, sel: 'joint', hl: null, ver: 0,
      cam: { yaw: -0.95, pitch: 0.38, k: null, c: [0, 0, 0], ox: 0, oy: 0 }, busy: false, prog: '', drawer: 'cm', drawerMin: false,
      lay: { bolts: true, welds: true, labels: true, ghost: false, loads: true }, gallery: false, hist: [], fut: [], open: { joint: true, mem: true, le: true, op: true, res: true, user: true },
      hov: null, place: null, drop: null, dragTool: null, gzHot: null, gzInfo: ''
    };
    if (saved && saved.lay) Object.assign(A.lay, saved.lay);
    const persist = () => store.set({ J: A.J, lay: A.lay });
    const LE = () => A.J.loads.find(l => l.id === A.le) || A.J.loads[0];

    // ------------------------------------------------------------------ model updates
    function rebuild(keepFe) {
      A.err = null;
      try { A.g = C.build(A.J); } catch (e) { A.g = null; A.err = T('The joint geometry could not be built: ', 'สร้างรูปทรงรอยต่อไม่ได้: ') + (e && e.message || e); }
      A.cm = {};
      if (A.g) A.J.loads.forEach(l => { try { A.cm[l.id] = C.check(A.J, A.g, l); } catch (e) { A.cm[l.id] = { checks: [], util: 0, ok: false, err: String(e && e.message || e) }; } });
      if (!keepFe) { A.fe = {}; A.fec = {}; A.feErr = {}; }
      if (!A.J.loads.some(l => l.id === A.le)) A.le = (A.J.loads[0] || {}).id || null;
      A.ver++;
    }
    function snap() { A.hist.push(JSON.stringify(A.J)); if (A.hist.length > 60) A.hist.shift(); A.fut = []; }
    function undo(redo) {
      const from = redo ? A.fut : A.hist, to = redo ? A.hist : A.fut; if (!from.length) return;
      to.push(JSON.stringify(A.J)); A.J = JSON.parse(from.pop()); rebuild(); persist(); ctx.render();
    }
    function changed(full) { rebuild(); persist(); if (full) { ctx.render(); return; } refreshParts(); }
    function refreshParts() { const nt = $('#cnNotes'); if (nt) nt.innerHTML = notesHTML(); const s = $('#cnTree'); if (s) s.innerHTML = treeHTML(); const d = $('#cnDrawer'); if (d) d.innerHTML = drawerHTML(); const st = $('#cnStat'); if (st) st.innerHTML = statHTML(); redraw(); ribRefresh(); }
    function setType(t) { snap(); const keep = A.J; const J = C.newJoint(t, keep.code); if (C.TYPES[t].mem.every(k => keep.mem[k])) C.TYPES[t].mem.forEach(k => { J.mem[k] = keep.mem[k]; }); A.J = J; A.sel = 'joint'; A.hl = null; A.cam.k = null; A.gallery = false; rebuild(); persist(); ctx.render(); }
    function setCode(c) { if (c === A.J.code) return; snap(); const old = A.J, J = C.newJoint(old.type, c); J.p = old.p; J.loads = old.loads; J.name = old.name; J.fe = old.fe; J.ops = old.ops; J.so = old.so; A.J = J; rebuild(); persist(); ctx.render(); toast(T('Standard: ', 'มาตรฐาน: ') + C.CODES[c].name + T(' — sections and materials reset to its defaults', ' — หน้าตัดและวัสดุถูกตั้งเป็นค่าเริ่มต้น'), ''); }

    // ------------------------------------------------------------------ labels
    const TYPE_IC = { ep: 'ep', fin: 'fin', hdr: 'hdr', clt: 'clt', wld: 'wld', base: 'base', spl: 'spl', spe: 'spe', gus: 'gus' };
    const MEMN = () => ({ col: [T('Column', 'เสา')], beam: [T('Beam', 'คาน')], brace: [T('Brace', 'ค้ำยัน')] });
    const memLabel = (k) => (A.J.type === 'spl' || A.J.type === 'spe') && k === 'beam' ? T('Members (both sides)', 'ชิ้นส่วน (สองข้าง)') : MEMN()[k][0];
    // parameter: [en, th, unit, kind, options]
    const PL = {
      tp: ['Plate thickness', 'ความหนาแผ่น', 'mm'], bp: ['Plate width (0 = auto)', 'ความกว้างแผ่น (0 = อัตโนมัติ)', 'mm'], hp: ['Plate height (0 = auto)', 'ความสูงแผ่น (0 = อัตโนมัติ)', 'mm'],
      ext: ['End-plate extension', 'ส่วนยื่นของแผ่นปลาย', '', 'sel', [['top', 'Top (hogging)', 'ด้านบน'], ['both', 'Top and bottom', 'บนและล่าง'], ['none', 'Flush', 'เสมอปีก']]],
      ex: ['Extension / edge length', 'ระยะยื่น / ระยะขอบ', 'mm'], bolt: ['Bolt size', 'ขนาดสลักเกลียว', '', 'sel', 'bolt'],
      g: ['Bolt gauge (cross-centres)', 'ระยะห่างแนวสลักตามขวาง', 'mm'], rows: ['Bolt rows: auto, or z positions (mm)', 'แถวสลัก: auto หรือระดับ z (มม.)', '', 'text'],
      pitch: ['Bolt pitch', 'ระยะห่างสลัก', 'mm'], ninner: ['Inner bolt rows', 'จำนวนแถวด้านใน', ''], af: ['Flange weld throat a', 'ขนาดคอเชื่อมปีก a', 'mm'], aw: ['Web weld throat a', 'ขนาดคอเชื่อมเอว a', 'mm'],
      stiff: ['Stiffeners', 'แผ่นเสริมกำลัง', '', 'chk'], ts: ['Stiffener thickness', 'ความหนาแผ่นเสริม', 'mm'], butt: ['Full-penetration butt welds', 'เชื่อมทะลุเต็มความหนา', '', 'chk'],
      ang: ['Beam angle to the column', 'มุมคานกับเสา', '°'], to: ['Connected to the column', 'ต่อเข้ากับเสาที่', '', 'sel', [['flange', 'Flange', 'ปีก'], ['web', 'Web', 'เอว']]],
      gap: ['Gap', 'ระยะช่องว่าง', 'mm'], e: ['Bolt line from the support face', 'แนวสลักจากผิวจุดรองรับ', 'mm'], e2: ['Bolt end distance', 'ระยะสลักถึงขอบแผ่น', 'mm'],
      n: ['Number of bolt rows', 'จำนวนแถวสลัก', ''], a: ['Weld throat a', 'ขนาดคอเชื่อม a', 'mm'],
      angle: ['Angle cleat (b × b × t)', 'เหล็กฉาก (b × b × t)', '', 'sel', [['75x75x8', 'L 75×75×8'], ['90x90x8', 'L 90×90×8'], ['90x90x10', 'L 90×90×10'], ['100x100x10', 'L 100×100×10'], ['125x125x10', 'L 125×125×10'], ['150x90x10', 'L 150×90×10']]],
      B: ['Base plate width B (0 = auto)', 'ความกว้างแผ่นฐาน B (0 = อัตโนมัติ)', 'mm'], L: ['Base plate length L (0 = auto)', 'ความยาวแผ่นฐาน L (0 = อัตโนมัติ)', 'mm'],
      na: ['Number of anchors', 'จำนวนสลักยึด', '', 'sel', [['4', '4'], ['6', '6'], ['8', '8']]], ey: ['Anchor edge distance (width)', 'ระยะขอบสลักยึด (ด้านกว้าง)', 'mm'],
      hef: ['Anchor embedment h_ef', 'ความลึกฝัง h_ef', 'mm'], grout: ['Grout thickness', 'ความหนาปูนเกราต์', 'mm'], pedB: ['Pedestal width (0 = auto)', 'ความกว้างตอม่อ (0 = อัตโนมัติ)', 'mm'], pedL: ['Pedestal length (0 = auto)', 'ความยาวตอม่อ (0 = อัตโนมัติ)', 'mm'],
      tfp: ['Flange cover plate thickness', 'ความหนาแผ่นประกบปีก', 'mm'], bfp: ['Flange cover width (0 = flange)', 'ความกว้างแผ่นประกบปีก (0 = เท่าปีก)', 'mm'], nf: ['Flange bolt rows each side', 'แถวสลักปีกแต่ละข้าง', ''],
      pf: ['Flange bolt pitch', 'ระยะสลักปีก', 'mm'], gf: ['Flange bolt gauge (0 = auto)', 'ระยะสลักปีกตามขวาง (0 = อัตโนมัติ)', 'mm'], twp: ['Web plate thickness (each)', 'ความหนาแผ่นประกบเอว (ต่อแผ่น)', 'mm'],
      hwp: ['Web plate height (0 = auto)', 'ความสูงแผ่นประกบเอว (0 = อัตโนมัติ)', 'mm'], nw: ['Web bolts per column', 'สลักเอวต่อแนว', ''], pw: ['Web bolt pitch', 'ระยะสลักเอว', 'mm'], cw: ['Web bolt columns each side', 'แนวสลักเอวแต่ละข้าง', ''], pc: ['Web bolt column spacing', 'ระยะระหว่างแนวสลักเอว', 'mm'],
      nb: ['Number of bolts (0 = auto)', 'จำนวนสลัก (0 = อัตโนมัติ)', ''], theta: ['Brace angle', 'มุมค้ำยัน', '°'], tg: ['Gusset thickness', 'ความหนาแผ่นกัสเซ็ท', 'mm'], Lw: ['Brace weld / lap length', 'ความยาวรอยเชื่อม / ทาบค้ำยัน', 'mm'],
      Lg: ['Gusset length (0 = auto)', 'ความยาวกัสเซ็ท (0 = อัตโนมัติ)', 'mm'], Hg: ['Gusset height (0 = auto)', 'ความสูงกัสเซ็ท (0 = อัตโนมัติ)', 'mm'], pb: ['Bolt pitch', 'ระยะสลัก', 'mm']
    };
    const OPS_ = () => [['plates', T('Plates', 'แผ่นเหล็ก'), 'plate'], ['bolts', T('Bolts / anchors', 'สลักเกลียว / สลักยึด'), 'bolt'], ['welds', T('Welds', 'รอยเชื่อม'), 'weld'], ['stiff', T('Stiffeners', 'แผ่นเสริมกำลัง'), 'stiff'], ['geom', T('Geometry', 'รูปทรง'), 'geom']];
    const OPOF = { tp: 'plates', bp: 'plates', hp: 'plates', ext: 'plates', ex: 'plates', tfp: 'plates', bfp: 'plates', twp: 'plates', hwp: 'plates', tg: 'plates', Lg: 'plates', Hg: 'plates', B: 'plates', L: 'plates', angle: 'plates', pedB: 'geom', pedL: 'geom', grout: 'geom',
      bolt: 'bolts', g: 'bolts', rows: 'bolts', pitch: 'bolts', ninner: 'bolts', n: 'bolts', nf: 'bolts', pf: 'bolts', gf: 'bolts', nw: 'bolts', pw: 'bolts', cw: 'bolts', pc: 'bolts', nb: 'bolts', pb: 'bolts', na: 'bolts', ey: 'bolts', hef: 'bolts', e: 'bolts', e2: 'bolts',
      af: 'welds', aw: 'welds', a: 'welds', butt: 'welds', Lw: 'welds', stiff: 'stiff', ts: 'stiff', to: 'geom', gap: 'geom', ang: 'geom', theta: 'geom' };
    const opOf = k => (A.J.type === 'base' && k === 'ex' ? 'bolts' : OPOF[k] || 'geom');
    const opKeys = op => Object.keys(A.J.p).filter(k => opOf(k) === op && PL[k]);

    // ------------------------------------------------------------------ icons (24 × 24 line drawings)
    const IC = {
      new: '<path d="M6 3h8l4 4v14H6z M14 3v4h4 M12 10v7 M8.5 13.5h7"/>', open: '<path d="M3 7h6l2 2h10v10H3z M3 11h18"/>', save: '<path d="M5 3h12l3 3v15H5z M8 3v5h8V3 M8 14h8v7H8z"/>',
      undo: '<path d="M9 7L4 12l5 5 M4 12h11a5 5 0 0 1 0 10h-3"/>', redo: '<path d="M15 7l5 5-5 5 M20 12H9a5 5 0 0 0 0 10h3"/>', play: '<path d="M7 4l13 8-13 8z"/>', report: '<path d="M6 3h12v18H6z M9 8h6 M9 12h6 M9 16h4"/>',
      member: '<path d="M3 9h18 M3 15h18 M12 9v6 M3 6h18 M3 18h18"/>', load: '<path d="M12 3v13 M7 11l5 5 5-5 M4 21h16"/>', mat: '<path d="M4 6l8-3 8 3v12l-8 3-8-3z M4 6l8 3 8-3 M12 9v12"/>',
      plate: '<path d="M4 8l9-4 7 4-9 4z M4 8v4l7 4v-4 M20 8v4l-9 4"/>', bolt: '<path d="M8 3h8v4H8z M10 7h4v12h-4z M8 19h8 M10 10h4 M10 13h4 M10 16h4"/>', weld: '<path d="M3 18h18 M5 18l3-5 3 5 3-5 3 5 3-5"/>', stiff: '<path d="M4 4h16v16H4z M12 4v16 M4 12h16"/>', geom: '<path d="M4 20L20 4 M4 20h8 M4 20v-8 M9 20a5 5 0 0 0-5-5"/>',
      mesh: '<path d="M3 3h18v18H3z M3 9h18 M3 15h18 M9 3v18 M15 3v18"/>', stress: '<path d="M3 20h18 M5 20V10 M9 20V6 M13 20v-8 M17 20V4"/>', strain: '<path d="M3 17c4-10 6 4 9-4s5-6 9-8"/>', deform: '<path d="M3 8h18 M3 16c6 4 12 4 18 0"/>', model: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z M12 12l8-4.5 M12 12v9 M12 12L4 7.5"/>',
      v3d: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z M12 12l8-4.5 M12 12v9 M12 12L4 7.5"/>', front: '<path d="M5 5h14v14H5z M5 12h14"/>', top: '<path d="M5 5h14v14H5z M12 5v14"/>', side: '<path d="M5 5h14v14H5z M5 5l14 14"/>', fit: '<path d="M4 9V4h5 M15 4h5v5 M20 15v5h-5 M9 20H4v-5"/>',
      label: '<path d="M4 6h16 M4 12h10 M4 18h13"/>', ghost: '<path d="M5 19V9a7 7 0 0 1 14 0v10l-2.5-2-2.5 2-2-2-2 2-2.5-2z"/>', help: '<path d="M9 9a3 3 0 1 1 4 2.8c-.7.4-1 1-1 1.7V15 M12 18v.5"/>', copy: '<path d="M8 8h12v12H8z M4 16V4h12"/>', del: '<path d="M5 7h14 M10 7V4h4v3 M7 7l1 13h8l1-13"/>', add: '<path d="M12 5v14 M5 12h14"/>',
      ep: '<path d="M3 3v18 M6 3v18 M8 6v12 M8 9h13 M8 15h13 M8 12h13" /><circle cx="7" cy="7.5" r=".9"/><circle cx="7" cy="16.5" r=".9"/>', fin: '<path d="M3 3v18 M6 3v18 M6 8h8v8H6 M10 7h11 M10 17h11 M10 7v10"/><circle cx="11" cy="10" r=".9"/><circle cx="11" cy="14" r=".9"/>',
      hdr: '<path d="M3 3v18 M6 3v18 M8 7v10 M8 8h13 M8 16h13"/><circle cx="7" cy="10" r=".9"/><circle cx="7" cy="14" r=".9"/>', clt: '<path d="M3 3v18 M6 3v18 M6 8h4v8H6 M11 7h10 M11 17h10 M11 7v10"/><circle cx="8" cy="12" r=".9"/>',
      wld: '<path d="M3 3v18 M6 3v18 M6 8h15 M6 16h15 M6 12h15 M6 8l2 1 M6 16l2-1"/>', base: '<path d="M10 3v13 M14 3v13 M8 3h8 M8 16h8 M4 18h16v2H4z M6 20v3 M18 20v3"/>', spl: '<path d="M3 8h8 M13 8h8 M3 16h8 M13 16h8 M7 6h10v4H7z M7 14h10v4H7z"/>',
      spe: '<path d="M3 8h8 M13 8h8 M3 16h8 M13 16h8 M11 4v16 M13 4v16"/><circle cx="12" cy="6" r=".9"/><circle cx="12" cy="18" r=".9"/>', gus: '<path d="M3 20h18 M6 20V12h8l4 8 M9 16l10-10 M11 18l10-10"/>'
    };
    const icon = (k, big) => `<svg class="an-ic ${big ? 'big' : ''}" viewBox="0 0 24 24" aria-hidden="true">${IC[k] || IC.model}</svg>`;

    // ------------------------------------------------------------------ ribbon
    function RIB() {
      const J = A.J, ty = C.TYPE_ORDER.map(t => ({ c: 'type', v: t, i: TYPE_IC[t], l: T(C.TYPES[t].n[0], C.TYPES[t].n[1]).replace(/\s*\(.*\)/, ''), on: () => J.type === t }));
      return [
        ['project', T('Project', 'โครงการ'), [
          [T('File', 'ไฟล์'), [{ c: 'new', i: 'new', l: T('New joint', 'รอยต่อใหม่') }, { file: 1, i: 'open', l: T('Open', 'เปิด') }, { c: 'save', i: 'save', l: T('Save', 'บันทึก') }]],
          [T('Design standard', 'มาตรฐานการออกแบบ'), [{ col: ['AS', 'EN', 'AISC'].map(c => ({ radio: 1, c: 'code', v: c, l: C.CODES[c].name + (c === 'AISC' ? ' / EIT' : ''), on: () => J.code === c })) }]],
          [T('Edit', 'แก้ไข'), [{ col: [{ c: 'undo', i: 'undo', l: T('Undo', 'เลิกทำ') }, { c: 'redo', i: 'redo', l: T('Redo', 'ทำซ้ำ') }] }]]]],
        ['design', T('Design', 'ออกแบบ'), [
          [T('Joint type', 'ชนิดรอยต่อ'), ty],
          [T('Joint data', 'ข้อมูลรอยต่อ'), [{ c: 'pick', v: 'mem:' + C.TYPES[J.type].mem[0], i: 'member', l: T('Members', 'ชิ้นส่วน') }, { c: 'pick', v: 'mat', i: 'mat', l: T('Materials', 'วัสดุ') }, { c: 'addle', i: 'load', l: T('New load effect', 'แรงใหม่') }]],
          [T('Operations', 'การดำเนินการ'), OPS_().filter(o => opKeys(o[0]).length).map(o => ({ c: 'pick', v: 'op:' + o[0], i: o[2], l: o[1], on: () => A.sel === 'op:' + o[0] })).concat(C.SO_TYPES[J.type] ? [{ c: 'pick', v: 'so', i: 'geom', l: T('Setting out', 'ตำแหน่งวาง'), on: () => A.sel === 'so' }] : [])]]],
        ['check', T('Check', 'ตรวจสอบ'), [
          [T('Analysis', 'วิเคราะห์'), [{ c: 'calc', i: 'play', l: A.busy ? T('Calculating…', 'กำลังคำนวณ…') : T('Calculate (CBFEM)', 'คำนวณ (CBFEM)') }]],
          [T('Mesh', 'เมช'), [{ col: [['coarse', T('Coarse', 'หยาบ')], ['normal', T('Normal', 'ปกติ')], ['fine', T('Fine', 'ละเอียด')]].map(([v, l]) => ({ radio: 1, c: 'mesh', v, l, on: () => (J.fe || {}).mesh === v })) }]],
          [T('Display', 'การแสดงผล'), [{ c: 'disp', v: 'model', i: 'model', l: T('Model', 'แบบจำลอง'), on: () => A.disp === 'model' }, { c: 'disp', v: 'vm', i: 'stress', l: T('Equivalent stress', 'หน่วยแรงเทียบเท่า'), on: () => A.disp === 'vm' }, { c: 'disp', v: 'ep', i: 'strain', l: T('Plastic strain', 'ความเครียดพลาสติก'), on: () => A.disp === 'ep' }, { c: 'disp', v: 'mesh', i: 'mesh', l: T('Mesh', 'เมช'), on: () => A.disp === 'mesh' }, { c: 'deform', i: 'deform', l: T('Deformed', 'รูปร่างเสียรูป'), on: () => A.def }]]]],
        ['report', T('Report', 'รายงาน'), [
          [T('Output', 'ผลลัพธ์'), [{ c: 'report', i: 'report', l: T('Report', 'รายงาน') }, { c: 'json', i: 'save', l: T('Save joint file', 'บันทึกไฟล์รอยต่อ') }]]]],
        ['view', T('View', 'มุมมอง'), [
          [T('View', 'มุมมอง'), [{ c: 'view', v: '3d', i: 'v3d', l: '3D' }, { c: 'view', v: 'front', i: 'front', l: T('Front', 'ด้านหน้า') }, { c: 'view', v: 'top', i: 'top', l: T('Top', 'ด้านบน') }, { c: 'view', v: 'side', i: 'side', l: T('Side', 'ด้านข้าง') }, { c: 'fit', i: 'fit', l: T('Zoom to fit', 'พอดีหน้าจอ') }]],
          [T('Show', 'แสดง'), [{ col: [['bolts', T('Bolts', 'สลัก')], ['welds', T('Welds', 'รอยเชื่อม')], ['loads', T('Loads', 'แรง')], ['labels', T('Labels', 'ป้ายชื่อ')], ['ghost', T('Transparent members', 'ชิ้นส่วนโปร่งใส')]].map(([v, l]) => ({ radio: 1, c: 'lay', v, l, on: () => A.lay[v] })) }]]]]
      ];
    }
    function rbtn(it, big) {
      const on = it.on ? it.on() : false, lab = esc(it.l);
      if (it.file) return `<label class="an-rb ${big ? 'big' : 'sm'}" title="${lab}">${icon(it.i, big)}<span>${lab}</span><input type="file" accept=".json,application/json" id="cn-file" hidden></label>`;
      if (it.radio) return `<button class="an-rb sm an-rradio" data-act="cn-rb" data-c="${it.c}" data-v="${it.v}" aria-pressed="${on}"><i class="an-rdot"></i><span>${lab}</span></button>`;
      return `<button class="an-rb ${big ? 'big' : 'sm'} ${it.c === 'calc' ? 'cn-hot' : ''}" ${it.drag ? `draggable="true" data-tool="${it.drag}"` : ''} data-act="cn-rb" data-c="${it.c}" ${it.v ? `data-v="${esc(it.v)}"` : ''} aria-pressed="${on}" title="${lab}" ${it.c === 'calc' && A.busy ? 'disabled' : ''}>${icon(it.i, big)}<span>${lab}</span></button>`;
    }
    function ribHTML() {
      const tabs = RIB(), cur = tabs.find(t => t[0] === A.rib) || tabs[1];
      const qat = [['undo', 'undo', T('Undo (Ctrl+Z)', 'เลิกทำ')], ['redo', 'redo', T('Redo (Ctrl+Y)', 'ทำซ้ำ')], ['save', 'save', T('Save', 'บันทึก')], ['calc', 'play', T('Calculate (Ctrl+Enter)', 'คำนวณ')]];
      return `<div class="an-rib" id="cnRib"><div class="an-ribtabs" role="tablist" aria-label="${T('Ribbon', 'ริบบอน')}">${tabs.map(t => `<button role="tab" class="an-rtab" data-act="cn-ribtab" data-t="${t[0]}" aria-selected="${t[0] === cur[0]}">${t[1]}</button>`).join('')}<span class="grow"></span>
        <span class="an-qat">${qat.map(([c, i, l]) => `<button class="an-qb ${c === 'calc' ? 'hot' : ''}" data-act="cn-rb" data-c="${c}" title="${esc(l)}" aria-label="${esc(l)}" ${c === 'undo' && !A.hist.length || c === 'redo' && !A.fut.length || c === 'calc' && A.busy ? 'disabled' : ''}>${icon(i)}</button>`).join('')}</span></div>
        <div class="an-ribbar" role="toolbar">${cur[2].map(([title, items]) => `<div class="an-rg"><div class="an-rgi">${items.map(it => (it.col ? `<div class="an-rcol">${it.col.map(x => rbtn(x, false)).join('')}</div>` : rbtn(it, true))).join('')}</div><div class="an-rgt">${title}</div></div>`).join('')}</div></div>`;
    }
    function ribRefresh() { const r = $('#cnRib'); if (r) r.outerHTML = ribHTML(); }

    // ------------------------------------------------------------------ tree
    const secName = s => { try { return C.dims(s).name || s.kind; } catch (e) { return s.kind; } };
    const uClass = u => (u > 1.0005 ? 'bad' : u > 0.9 ? 'warn' : 'ok');
    const uTag = u => `<span class="cn-u ${uClass(u)}">${f(u * 100, 0)}%</span>`;
    function feWorst(le) { const ch = A.fec[le]; if (!ch) return null; const by = {}; ch.forEach(c => { if (!by[c.grp] || c.util > by[c.grp].util) by[c.grp] = c; }); return by; }
    function tnode(key, ic, label, extra, kids, openKey) {
      const on = A.sel === key || (A.hl && A.hl === key), hasK = kids != null, open = openKey ? A.open[openKey] : true;
      return `<li>${hasK && openKey ? `<button class="cn-tw" data-act="cn-tog" data-k="${openKey}" aria-expanded="${open}" aria-label="${T('Expand', 'ขยาย')}">${open ? '▾' : '▸'}</button>` : ''}<button class="an-tl2 cn-tl ${on ? 'on' : ''}" data-act="cn-sel" data-k="${esc(key)}" aria-current="${on}">${icon(ic)}<span class="an-tlt">${label}</span>${extra || ''}</button>${hasK && open ? `<ul>${kids}</ul>` : ''}</li>`;
    }
    function treeHTML() {
      const J = A.J, Ty = C.TYPES[J.type], le = LE(), cm = le && A.cm[le.id], fw = le && feWorst(le.id);
      const mem = Ty.mem.map(k => tnode('mem:' + k, 'member', memLabel(k) + ' — ' + esc(secName(J.mem[k])))).join('');
      const les = J.loads.map(l => tnode('le:' + l.id, 'load', esc(l.id + ' · ' + (l.name || '')), A.fec[l.id] ? uTag(Math.max(...A.fec[l.id].map(c => c.util), 0)) : A.cm[l.id] ? uTag(A.cm[l.id].util) : '')).join('') + `<li><button class="an-tl2 cn-tl cn-add" data-act="cn-rb" data-c="addle">${icon('add')}<span class="an-tlt">${T('New load effect', 'เพิ่มแรง')}</span></button></li>`;
      const ops = OPS_().filter(o => opKeys(o[0]).length).map(o => tnode('op:' + o[0], o[2], o[1])).join('') + (soInfo() ? tnode('so', 'geom', T('Setting out', 'การวางตำแหน่ง'), (J.so && (+J.so.dx || +J.so.dy || +J.so.dz)) ? '<span class="cn-u warn">e</span>' : '') : '');
      const fl = new Set((A.g ? [...(A.g.floating.plates || []), ...(A.g.floating.members || [])] : []).map(p => p.id)), bad = id => A.g && A.g.notes.some(n => n.bad && n.en.indexOf(id) >= 0);
      const UIC = { plate: 'plate', member: 'member', weld: 'weld', bolts: 'bolt' }, uops = (J.ops || []).map(o => tnode('u:' + o.id, o.id[1] === 'S' ? 'stiff' : UIC[o.kind], esc(o.name || o.id), fl.has(o.id) || bad(o.id) ? '<span class="cn-u bad">!</span>' : '')).join('');
      let res = '';
      if (fw) res = Object.values(fw).map(c => tnode('res:' + c.grp, c.grp === 'Bolts' || c.grp === 'Anchors' ? 'bolt' : c.grp === 'Welds' ? 'weld' : c.grp === 'Plates' ? 'plate' : 'stress', esc(grpName(c.grp)) + ' (CBFEM)', uTag(c.util))).join('');
      if (cm && cm.checks.length) { const by = {}; cm.checks.forEach(c => { if (!by[c.grp] || c.util > by[c.grp].util) by[c.grp] = c; }); res += Object.values(by).map(c => tnode('cm:' + c.grp, 'stress', esc(grpName(c.grp)) + ' (' + T('CM', 'วิธีชิ้นส่วน') + ')', uTag(c.util))).join(''); }
      return `<div class="an-wtree cn-tree"><ul class="an-wt">
        ${tnode('joint', TYPE_IC[J.type], '<b>' + esc(J.name || T(Ty.n[0], Ty.n[1])) + '</b>', '', tnode('code', 'help', esc(C.CODES[J.code].name) + (J.code === 'AISC' ? ' / EIT' : '')) + tnode('mat', 'mat', T('Materials', 'วัสดุ') + ' — ' + esc(J.mat.steel)), 'joint')}
        ${tnode('mems', 'member', T('Members', 'ชิ้นส่วน'), '', mem, 'mem')}
        ${tnode('les', 'load', T('Load effects', 'แรงกระทำ'), '', les, 'le')}
        ${tnode('ops', 'plate', T('Operations', 'การดำเนินการ'), '', ops, 'op')}
        ${tnode('user', 'add', T('Added parts', 'ชิ้นส่วนที่เพิ่ม') + ' (' + (J.ops || []).length + ')', '', uops || `<li class="cn-empty">${T('Drag Plate, Stiffener, Member, Weld or Bolts from Add onto the model.', 'ลาก แผ่น แผ่นเสริม ชิ้นส่วน รอยเชื่อม หรือสลัก จาก เพิ่ม ไปวางบนแบบจำลอง')}</li>`, 'user')}
        ${res ? tnode('res', 'stress', T('Check results', 'ผลการตรวจสอบ') + ' · ' + esc(le.id), '', res, 'res') : ''}
      </ul></div>`;
    }
    const GRPN = { Plates: ['Plates', 'แผ่นเหล็ก'], Bolts: ['Bolts', 'สลักเกลียว'], Welds: ['Welds', 'รอยเชื่อม'], Anchors: ['Anchors', 'สลักยึด'], Concrete: ['Concrete', 'คอนกรีต'], Column: ['Column', 'เสา'], Beam: ['Beam', 'คาน'], Joint: ['Joint', 'รอยต่อ'], Brace: ['Brace', 'ค้ำยัน'], Tube: ['Tube', 'ท่อ'], Splice: ['Splice', 'รอยต่อ'] };
    const grpName = g => (GRPN[g] ? T(GRPN[g][0], GRPN[g][1]) : g);

    // ------------------------------------------------------------------ property panel
    const fld = (path, lbl, val, unit, kind, opts) => {
      const id = 'cnf-' + path.replace(/[^\w]/g, '_');
      let inp;
      if (kind === 'sel') inp = `<select id="${id}" data-cp="${esc(path)}">${opts.map(o => `<option value="${esc(o[0])}" ${String(o[0]) === String(val) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
      else if (kind === 'chk') inp = `<input id="${id}" type="checkbox" data-cp="${esc(path)}" ${val ? 'checked' : ''}>`;
      else if (kind === 'text') inp = `<input id="${id}" data-cp="${esc(path)}" value="${esc(val == null ? '' : val)}">`;
      else inp = `<input id="${id}" type="number" step="any" data-cp="${esc(path)}" value="${esc(val == null ? '' : val)}">`;
      return `<label class="cn-f ${kind === 'chk' ? 'chk' : ''}" for="${id}"><span>${lbl}${unit ? ` <i>${unit}</i>` : ''}</span>${inp}</label>`;
    };
    function paramField(k) {
      const d = PL[k], v = A.J.p[k];
      if (d[3] === 'sel') { const o = d[4] === 'bolt' ? Object.keys(C.BSIZE).map(s => [s, s]) : d[4].map(q => [q[0], q[2] ? T(q[1], q[2]) : q[1]]); return fld('p.' + k, T(d[0], d[1]), v, d[2], 'sel', o); }
      if (d[3] === 'chk') return fld('p.' + k, T(d[0], d[1]), v, '', 'chk');
      if (d[3] === 'text') return fld('p.' + k, T(d[0], d[1]), v, '', 'text');
      return fld('p.' + k, T(d[0], d[1]), v, d[2], 'num');
    }
    function secForm(k) { return secFormP(A.J.mem[k] || {}, 'mem.' + k + '.', k === 'brace'); }
    function secFormP(s, pre, angles) {
      const kinds = [['I', T('Rolled I / H (library)', 'หน้าตัด I / H รีดร้อน (ตาราง)')], ['BU', T('Built-up I (welded plates)', 'หน้าตัด I ประกอบ (แผ่นเชื่อม)')], ['SHS', 'SHS'], ['RHS', 'RHS'], ['CHS', 'CHS']].concat(angles ? [['L', T('Angle', 'เหล็กฉาก')]] : []);
      const SL = G.STEELLIB, std = { AS: ['UB', 'UC'], EN: ['IPE', 'HEA', 'HEB'], AISC: ['H'] }[A.J.code] || ['UB'];
      let h = fld(pre + 'kind', T('Section type', 'ชนิดหน้าตัด'), s.kind, '', 'sel', kinds);
      if (s.kind === 'I') { const libs = Object.keys(SL.LIB), lib = libs.includes(s.lib) ? s.lib : std[0]; h += fld(pre + 'lib', T('Series', 'อนุกรม'), lib, '', 'sel', std.concat(libs.filter(x => !std.includes(x))).map(x => [x, SL.SERIES[x] || x])) + fld(pre + 'size', T('Size', 'ขนาด'), s.size, '', 'sel', SL.sizes(lib).map(x => [x, x])); }
      else if (s.kind === 'BU') h += [['d', 'Depth d', 'ความลึก d'], ['bf', 'Top flange width b_f', 'ความกว้างปีกบน'], ['tf', 'Top flange thickness t_f', 'ความหนาปีกบน'], ['bf2', 'Bottom flange width (0 = top)', 'ความกว้างปีกล่าง (0 = เท่าบน)'], ['tf2', 'Bottom flange thickness (0 = top)', 'ความหนาปีกล่าง (0 = เท่าบน)'], ['tw', 'Web thickness t_w', 'ความหนาเอว']].map(([q, en, th]) => fld(pre + q, T(en, th), s[q] || '', 'mm', 'num')).join('');
      else if (s.kind === 'L') h += [['b1', 'Leg b₁', 'ขา b₁'], ['b2', 'Leg b₂', 'ขา b₂'], ['t', 'Thickness t', 'ความหนา t']].map(([q, en, th]) => fld(pre + q, T(en, th), s[q] || '', 'mm', 'num')).join('');
      else { const o = G.GANTRY ? G.GANTRY.sizeOptions(s.kind) : []; h += fld(pre + 'size', T('Size', 'ขนาด'), s.size, '', 'sel', o); }
      let d = null; try { d = C.dims(s); } catch (e) { }
      if (d) h += `<p class="cn-note">${esc(d.name || '')} · A = ${f((d.A || 0) / 100, 1)} cm²${d.Iy ? ' · I<sub>y</sub> = ' + f(d.Iy / 1e4, 0) + ' cm⁴' : ''}${d.d ? ' · d = ' + f(d.d, 0) + ' mm' : ''}</p>`;
      return h;
    }
    function propsHTML() {
      const J = A.J, Ty = C.TYPES[J.type], k = A.sel, CD = C.CODES[J.code];
      const head = (t, sub) => `<div class="cn-ph"><b>${t}</b>${sub ? `<span class="muted small">${sub}</span>` : ''}</div>`;
      if (A.hl && !/^(le|mem|op|res|cm):/.test(k)) { const it = itemInfo(A.hl); if (it) return head(it.t, it.s) + it.h; }
      if (k === 'so') return head(T('Setting out', 'การวางตำแหน่ง'), J.type === 'base' ? T('Column on the base plate', 'เสาบนแผ่นฐาน') : T('Beam on the column', 'คานบนเสา')) + soFields();
      if (k === 'joint' || k === 'code') return head(T('Joint', 'รอยต่อ'), T(Ty.n[0], Ty.n[1])) + fld('name', T('Name', 'ชื่อ'), J.name, '', 'text') +
        fld('type', T('Joint type', 'ชนิดรอยต่อ'), J.type, '', 'sel', C.TYPE_ORDER.map(t => [t, T(C.TYPES[t].n[0], C.TYPES[t].n[1])])) +
        fld('code', T('Design standard', 'มาตรฐาน'), J.code, '', 'sel', ['AS', 'EN', 'AISC'].map(c => [c, C.CODES[c].full])) +
        fld('fe.mesh', T('FE mesh', 'ความละเอียดเมช'), (J.fe || {}).mesh || 'normal', '', 'sel', [['coarse', T('Coarse (fast)', 'หยาบ (เร็ว)')], ['normal', T('Normal', 'ปกติ')], ['fine', T('Fine', 'ละเอียด')]]) +
        `<p class="cn-note">${T('Members are drawn from the joint origin; the column (or the first member) is supported at its ends, the other members carry the load effects at their far ends. Units: kN, kNm, mm, MPa.', 'ชิ้นส่วนเริ่มจากจุดกำเนิดของรอยต่อ เสา (หรือชิ้นส่วนแรก) ถูกยึดที่ปลาย ชิ้นส่วนอื่นรับแรงที่ปลายไกล หน่วย: kN, kNm, มม., MPa')}</p>`;
      if (k === 'mat') return head(T('Materials', 'วัสดุ'), CD.full) + fld('mat.steel', T('Steel grade', 'ชั้นคุณภาพเหล็ก'), J.mat.steel, '', 'sel', CD.steel.map(s => [s, s])) +
        fld('mat.bolt', T('Bolt grade', 'ชั้นคุณภาพสลัก'), J.mat.bolt, '', 'sel', CD.bolts.map(s => [s, s])) + fld('mat.weld', T('Weld metal', 'ลวดเชื่อม'), J.mat.weld, '', 'sel', CD.welds.map(s => [s, s === 'match' ? T('Matching (EN 1993-1-8 §4.2)', 'เข้ากับเหล็ก') : s])) +
        (J.type === 'base' ? fld('mat.conc', T('Concrete f′c / f_ck', 'คอนกรีต f′c / f_ck'), J.mat.conc, 'MPa', 'sel', CD.conc.map(s => [s, s])) + fld('mat.anchor', T('Anchor grade', 'ชั้นคุณภาพสลักยึด'), J.mat.anchor, '', 'sel', CD.anchors.map(s => [s, s])) : '') +
        (() => { const s = C.steel(J.mat.steel, 16); return `<p class="cn-note">f<sub>y</sub> = ${s.fy} MPa, f<sub>u</sub> = ${s.fu} MPa (t ≤ 16 mm), E = ${f(s.E, 0)} MPa</p>`; })();
      if (k.startsWith('mem:')) { const m = k.slice(4); return head(memLabel(m), esc(secName(J.mem[m]))) + secForm(m); }
      if (k === 'mems') return head(T('Members', 'ชิ้นส่วน')) + Ty.mem.map(m => `<h4 class="cn-h4">${memLabel(m)}</h4>` + secForm(m)).join('');
      if (k.startsWith('le:') || k === 'les') { const l = k === 'les' ? LE() : J.loads.find(q => q.id === k.slice(3)); if (!l) return head(T('Load effects', 'แรงกระทำ')); const i = J.loads.indexOf(l);
        return head(T('Load effect', 'แรงกระทำ') + ' ' + esc(l.id), T('Internal forces in the loaded member at the joint face', 'แรงภายในชิ้นส่วนที่ผิวรอยต่อ')) + fld('load.' + i + '.name', T('Name', 'ชื่อ'), l.name, '', 'text') +
          [['N', 'N', T('axial, + tension', 'แรงตามแกน, + ดึง'), 'kN'], ['Vz', 'V<sub>z</sub>', T('shear, + down', 'แรงเฉือน, + ลง'), 'kN'], ['Vy', 'V<sub>y</sub>', T('shear, sideways', 'แรงเฉือนด้านข้าง'), 'kN'], ['Mx', 'M<sub>x</sub>', T('torsion', 'บิด'), 'kNm'], ['My', 'M<sub>y</sub>', T('major axis, + hogging', 'แกนหลัก, + โมเมนต์ลบ'), 'kNm'], ['Mz', 'M<sub>z</sub>', T('minor axis', 'แกนรอง'), 'kNm']].map(([q, s, d, u]) => fld('load.' + i + '.' + q, s + ' <small class="muted">' + d + '</small>', l[q], u, 'num')).join('') +
          `<div class="cn-btns"><button class="btn btn-ghost xs" data-act="cn-rb" data-c="dupLE" data-v="${esc(l.id)}">${T('Duplicate', 'ทำซ้ำ')}</button>${J.loads.length > 1 ? `<button class="btn btn-ghost xs" data-act="cn-rb" data-c="delLE" data-v="${esc(l.id)}">${T('Delete', 'ลบ')}</button>` : ''}</div>`; }
      if (k.startsWith('op:') || k === 'ops') { const ops = k === 'ops' ? OPS_().filter(o => opKeys(o[0]).length) : OPS_().filter(o => o[0] === k.slice(3)); return ops.map(o => head(o[1], T(Ty.n[0], Ty.n[1])) + opKeys(o[0]).map(paramField).join('') + (o[0] === 'bolts' ? `<p class="cn-note">${T('Bolt grade and the other materials are under Materials.', 'ชั้นคุณภาพสลักและวัสดุอื่นอยู่ที่หัวข้อวัสดุ')}</p>` : '')).join(''); }
      if (k.startsWith('res:') || k.startsWith('cm:') || k === 'res') { const g0 = k.split(':')[1], le = LE(), list = k.startsWith('cm:') ? (A.cm[le.id] || { checks: [] }).checks : (A.fec[le.id] || []); return head(grpName(g0 || '') || T('Results', 'ผลลัพธ์'), esc(le.id)) + checkRows(list.filter(c => !g0 || c.grp === g0), true); }
      return head(T('Properties', 'คุณสมบัติ'));
    }
    function soFields() {
      const J = A.J, so = J.so || {}, ns = A.g ? A.g.notes.filter(n => /set out|เยื้อง/.test(n.en + n.th)) : [];
      return (J.type === 'base' ? fld('so.dx', T('Offset along x (e_x)', 'เยื้องตามแกน x (e_x)'), so.dx || 0, 'mm', 'num') + fld('so.dy', T('Offset along y (e_y)', 'เยื้องตามแกน y (e_y)'), so.dy || 0, 'mm', 'num')
        : fld('so.dy', T('Sideways offset e_y', 'เยื้องด้านข้าง e_y'), so.dy || 0, 'mm', 'num') + fld('so.dz', T('Vertical offset e_z', 'เยื้องแนวดิ่ง e_z'), so.dz || 0, 'mm', 'num')) +
        ns.map(n => `<p class="cn-note ${n.bad ? 'bad' : ''}">${esc(T(n.en, n.th))}</p>`).join('') +
        `<p class="cn-note">${J.type === 'base' ? T('Or click the column in the view and drag its arrows (5 mm steps, Shift = 1 mm).', 'หรือคลิกเสาในมุมมองแล้วลากลูกศร (ทีละ 5 มม., Shift = 1 มม.)') : T('Or click the beam, end plate or fin plate in the view and drag its arrows (5 mm steps, Shift = 1 mm).', 'หรือคลิกคาน แผ่นปลาย หรือแผ่นครีบในมุมมองแล้วลากลูกศร (ทีละ 5 มม., Shift = 1 มม.)')}</p>` +
        ((+so.dx || +so.dy || +so.dz) ? `<div class="cn-btns"><button class="btn btn-ghost xs" data-act="cn-rb" data-c="soReset">${T('Reset to centred', 'กลับกึ่งกลาง')}</button></div>` : '');
    }
    function opForm(op) {
      const pre = 'uo.' + op.id + '.', K = op.kind, num = (q, en, th, u) => fld(pre + q, T(en, th), op[q], u, 'num');
      let h = fld(pre + 'name', T('Name', 'ชื่อ'), op.name || '', '', 'text');
      const pos = lbl => `<h4 class="cn-h4">${lbl}</h4>` + ['x', 'y', 'z'].map((c, i) => fld(pre + 'o.' + i, c.toUpperCase(), Math.round((op.o || [0, 0, 0])[i] * 10) / 10, 'mm', 'num')).join('');
      const rot = axes => `<h4 class="cn-h4">${T('Rotate', 'หมุน')}</h4><div class="cn-rot">${axes.map(([ax, lab]) => `<div class="cn-rotg"><b>${lab}</b><span>${[-90, -15, 15, 90].map(d => `<button class="btn btn-ghost xs" data-act="cn-rot" data-v="${esc(op.id)}" data-ax="${ax}" data-d="${d}">${d > 0 ? '+' : '−'}${abs(d)}°</button>`).join('')}</span></div>`).join('')}</div>`;
      const pls = allPlates().filter(p => !String(p.id).startsWith(op.id)).map(p => [p.id, p.id + ' — ' + (p.name || '')]);
      if (K === 'plate') h += num('w', 'Width b', 'ความกว้าง b', 'mm') + num('h', 'Height h', 'ความสูง h', 'mm') + num('t', 'Thickness t', 'ความหนา t', 'mm') + pos(T('Centre', 'จุดศูนย์กลาง')) + rot([['u', T('about u', 'รอบ u')], ['v', T('about v', 'รอบ v')], ['n', T('about n (in plane)', 'รอบ n (ในระนาบ)')]]);
      if (K === 'member') h += secFormP(op.sec || {}, pre + 'sec.', true) + num('L', 'Length', 'ความยาว', 'mm') + fld(pre + 'end', T('Far end', 'ปลายไกล'), op.end || 'free', '', 'sel', [['free', T('Free', 'อิสระ')], ['supported', T('Supported (fixed)', 'ยึดแน่น')]]) + num('roll', 'Roll about its axis', 'หมุนรอบแกนตัวเอง', '°') + pos(T('Start point', 'จุดเริ่มต้น')) + `<p class="cn-note">${T('Direction', 'ทิศทาง')} (${(op.x || []).map(v => f(v, 2)).join(', ')})</p>` + rot([['y', T('about y', 'รอบ y')], ['z', T('about z', 'รอบ z')]]);
      if (K === 'weld') { const mems = (A.J.ops || []).filter(o => o.kind === 'member').map(o => ['M:' + o.id, (o.name || o.id) + T(' — all walls at its start', ' — ทุกผนังที่ปลายเริ่ม')]);
        h += fld(pre + 'a', T('Part welded (its edge)', 'ชิ้นที่นำมาเชื่อม (ขอบ)'), op.a, '', 'sel', mems.concat(pls)) + fld(pre + 'b', T('Onto plate (its face)', 'เชื่อมเข้ากับแผ่น (ผิว)'), op.b, '', 'sel', pls) + fld(pre + 'type', T('Weld type', 'ชนิดรอยเชื่อม'), op.type || 'fillet', '', 'sel', [['fillet', T('Fillet', 'เชื่อมพอก')], ['butt', T('Full-penetration butt', 'ชนเต็มความหนา')]]) + num('a_', 'Throat a', 'ขนาดคอ a', 'mm') + fld(pre + 'sides', T('Sides', 'ด้าน'), String(op.sides || 2), '', 'sel', [['2', T('Both sides', 'สองด้าน')], ['1', T('One side', 'ด้านเดียว')]]) + fld(pre + 'all', T('All round (every edge on the face)', 'รอบทุกขอบที่ชิดผิว'), !!op.all, '', 'chk'); }
      if (K === 'bolts') h += fld(pre + 'host', T('Through plate', 'ผ่านแผ่น'), op.host, '', 'sel', pls) + fld(pre + 'size', T('Bolt size', 'ขนาดสลัก'), op.size, '', 'sel', Object.keys(C.BSIZE).map(q => [q, q])) + num('nr', 'Rows', 'จำนวนแถว', '') + num('nc', 'Columns', 'จำนวนแนว', '') + num('p', 'Pitch along the rows', 'ระยะห่างตามแถว', 'mm') + num('gg', 'Gauge across', 'ระยะห่างตามขวาง', 'mm') + pos(T('Group centre', 'ศูนย์กลางกลุ่ม')) + rot([['n', T('in the plate plane', 'ในระนาบแผ่น')]]) + (A.g ? `<p class="cn-note">${A.g.bolts.filter(b => b.user === op.id).length} ${T('bolts', 'สลัก')} · ${esc([...new Set(A.g.bolts.filter(b => b.user === op.id).map(b => b.stack.join(' + ')))].join(', '))}</p>` : '');
      const nts = A.g ? A.g.notes.filter(n => n.en.indexOf(op.id) >= 0) : [];
      h += nts.map(n => `<p class="cn-note ${n.bad ? 'bad' : ''}">${esc(T(n.en, n.th))}</p>`).join('');
      if (K !== 'weld') h += `<p class="cn-note">${T('In the view: drag the arrows to move (5 mm steps, Shift = 1 mm) and the rings to rotate (15°, Shift = 5°).', 'ในมุมมอง: ลากลูกศรเพื่อเลื่อน (ทีละ 5 มม., Shift = 1 มม.) และลากวงแหวนเพื่อหมุน (ทีละ 15°, Shift = 5°)')}</p>`;
      h += `<p class="cn-note">${T('Checked by CBFEM only — the component method covers the standard parts of the joint.', 'ตรวจสอบด้วย CBFEM เท่านั้น — วิธีชิ้นส่วนครอบคลุมเฉพาะชิ้นส่วนมาตรฐานของรอยต่อ')}</p>`;
      h += `<div class="cn-btns"><button class="btn btn-ghost xs" data-act="cn-rb" data-c="dupOp" data-v="${esc(op.id)}">${T('Duplicate (Ctrl+D)', 'ทำซ้ำ (Ctrl+D)')}</button><button class="btn btn-ghost xs" data-act="cn-rb" data-c="delOp" data-v="${esc(op.id)}">${T('Delete (Del)', 'ลบ (Del)')}</button></div>`;
      return { t: esc(op.name || op.id), s: esc(op.id + ' · ' + { plate: op.id[1] === 'S' ? T('stiffener', 'แผ่นเสริม') : T('plate', 'แผ่น'), member: T('member', 'ชิ้นส่วน'), weld: T('weld', 'รอยเชื่อม'), bolts: T('bolt group', 'กลุ่มสลัก') }[K]), h };
    }
    function itemInfo(hl) {
      const g = A.g; if (!g) return null; const [kind, id] = hl.split(':'), le = LE(), fr = le && A.fe[le.id];
      if (kind === 'u') { const op = opById(id); return op ? opForm(op) : null; }
      if (kind === 'pl') { const p = g.plates.find(q => q.id === id); if (!p) return null; const q = fr && fr.plates && fr.plates[id];
        const so = soInfo(); return { t: esc(p.name || p.id), s: esc(p.id), h: `<dl class="cn-dl"><dt>${T('Thickness', 'ความหนา')}</dt><dd>${f(p.t, 1)} mm</dd><dt>${T('Material', 'วัสดุ')}</dt><dd>${esc(p.mat || A.J.mat.steel)} · f<sub>y</sub> ${f(p.fy || C.steel(A.J.mat.steel, p.t).fy, 0)} MPa</dd>${q ? `<dt>σ<sub>Ed</sub></dt><dd>${f(q.s, 0)} MPa</dd><dt>ε<sub>pl</sub></dt><dd>${f(q.ep * 100, 2)} %</dd>` : ''}</dl>` + (so && so.match(p.id) ? `<h4 class="cn-h4">${T('Setting out', 'การวางตำแหน่ง')}</h4>` + soFields() : '') }; }
      if (kind === 'b') { const b = g.bolts.find(q => q.id === id); if (!b) return null; const r = fr && fr.bolts.find(q => q.id === id);
        return { t: T('Bolt ', 'สลัก ') + esc(id), s: esc(b.B.size + ' ' + (b.B.grade || '')), h: `<dl class="cn-dl"><dt>${T('Plates', 'แผ่น')}</dt><dd>${esc(b.stack.filter(Boolean).join(' + '))}</dd><dt>d₀</dt><dd>${f(b.B.d0, 0)} mm</dd>${r ? `<dt>F<sub>t</sub></dt><dd>${f(r.Nt / 1e3, 1)} kN</dd><dt>V</dt><dd>${f(r.V / 1e3, 1)} kN</dd>` : ''}</dl>` }; }
      if (kind === 'w') { const w = g.welds.find(q => q.id === id); if (!w) return null; const r = fr && fr.welds.find(q => q.id === id);
        return { t: T('Weld ', 'รอยเชื่อม ') + esc(id), s: esc(w.name || ''), h: `<dl class="cn-dl"><dt>${T('Type', 'ชนิด')}</dt><dd>${w.type === 'butt' ? T('Full-penetration butt', 'ชนเต็มความหนา') : T('Fillet', 'เชื่อมพอก') + ' a = ' + f(w.a_, 0) + ' mm' + (w.sides === 2 ? T(', both sides', ', สองด้าน') : '')}</dd><dt>L</dt><dd>${f(w.L, 0)} mm</dd><dt>${T('Joins', 'เชื่อม')}</dt><dd>${esc(w.a)} → ${esc(w.b)}</dd>${r && r.pts.length ? `<dt>${T('Peak', 'สูงสุด')}</dt><dd>${f(max(...r.pts.map(p => Math.hypot(p.fn, p.ft, p.fl))), 0)} N/mm</dd>` : ''}</dl>` }; }
      return null;
    }

    // ------------------------------------------------------------------ check tables
    const unitOf = c => (c.fe ? c.unit : c.unit === 'kN' ? 'kN' : c.unit === 'kNm' ? 'kNm' : c.unit);
    const valOf = (c, v) => (v == null ? null : c.fe || c.mpa ? v : c.unit === 'kN' ? v / 1e3 : c.unit === 'kNm' ? v / 1e6 : v);
    function checkRows(list, compact) {
      if (!list.length) return `<p class="cn-note">${T('No checks.', 'ไม่มีรายการตรวจสอบ')}</p>`;
      const by = {}; list.forEach(c => (by[c.grp] = by[c.grp] || []).push(c));
      return `<div class="cn-tbl"><table><thead><tr><th>${T('Check', 'รายการ')}</th>${compact ? '' : `<th class="num">${T('Action', 'แรงกระทำ')}</th><th class="num">${T('Resistance', 'กำลังต้านทาน')}</th>`}<th>${T('Utilisation', 'อัตราส่วน')}</th></tr></thead><tbody>${Object.entries(by).map(([g, cs]) => {
        const w = Math.max(...cs.map(c => c.util));
        return `<tr class="cn-grp"><td colspan="${compact ? 2 : 4}">${esc(grpName(g))} ${uTag(w)}</td></tr>` + cs.map(c => { const hk = c.fe ? (c.grp === 'Plates' ? 'pl:' + c.item : c.grp === 'Bolts' || c.grp === 'Anchors' ? 'b:' + c.item : c.grp === 'Welds' ? 'w:' + c.item : '') : '';
          return `<tr class="${c.util > 1.0005 ? 'bad' : ''} ${hk && A.hl === hk ? 'on' : ''}" ${hk ? `data-act="cn-hl" data-k="${esc(hk)}"` : ''} title="${esc((c.ref || '') + (c.expr ? ' — ' + c.expr : ''))}"><td><b>${esc(c.item)}</b> ${esc(c.name)}${compact ? '' : `<small class="cn-ref">${esc(c.ref || '')}${c.expr ? ' · ' + esc(c.expr) : ''}</small>`}</td>${compact ? '' : `<td class="num">${c.Ed == null ? '' : f(valOf(c, c.Ed), 1) + ' ' + esc(unitOf(c))}</td><td class="num">${c.Rd == null ? '' : f(valOf(c, c.Rd), 1) + ' ' + esc(unitOf(c))}</td>`}<td><span class="cn-bar ${uClass(c.util)}"><i style="width:${Math.min(100, c.util * 100).toFixed(1)}%"></i></span>${f(c.util * 100, 1)} %</td></tr>`; }).join('');
      }).join('')}</tbody></table></div>`;
    }
    function drawerHTML() {
      const le = LE(); if (!le) return '';
      const cm = A.cm[le.id], fe = A.fec[le.id], fr = A.fe[le.id], fer = A.feErr[le.id];
      const tabs = [['fe', T('CBFEM check', 'ตรวจสอบ CBFEM')], ['cm', T('Component method', 'วิธีชิ้นส่วน')], ['le', T('Load effects', 'แรงกระทำ')]];
      let body = '';
      if (A.drawer === 'fe') body = fe ? `<p class="cn-sum">${sumLine(fe, fr)}</p>` + checkRows(fe, false) : `<p class="cn-note">${fer ? '<b class="bad">' + esc(fer) + '</b>' : A.busy ? esc(A.prog || T('Calculating…', 'กำลังคำนวณ…')) : T('Run Calculate (CBFEM) to analyse the plates, bolts and welds with the finite-element model.', 'กด คำนวณ (CBFEM) เพื่อวิเคราะห์แผ่น สลัก และรอยเชื่อมด้วยไฟไนต์เอลิเมนต์')}</p>`;
      else if (A.drawer === 'cm') body = cm ? (cm.err ? `<p class="cn-note bad">${esc(cm.err)}</p>` : `<p class="cn-sum">${T('Component method', 'วิธีชิ้นส่วน')} — ${esc(C.CODES[A.J.code].full)} · ${T('governing', 'ควบคุม')} ${uTag(cm.util)}</p>` + checkRows(cm.checks, false)) : '';
      else body = `<div class="cn-tbl"><table class="cn-le"><thead><tr><th>${T('Load effect', 'แรง')}</th><th>${T('Name', 'ชื่อ')}</th><th class="num">N (kN)</th><th class="num">V<sub>z</sub> (kN)</th><th class="num">V<sub>y</sub> (kN)</th><th class="num">M<sub>x</sub> (kNm)</th><th class="num">M<sub>y</sub> (kNm)</th><th class="num">M<sub>z</sub> (kNm)</th><th>${T('Result', 'ผล')}</th><th></th></tr></thead><tbody>${A.J.loads.map((l, i) => `<tr class="${l.id === le.id ? 'on' : ''}"><td><button class="btn btn-ghost xs" data-act="cn-le" data-v="${esc(l.id)}">${esc(l.id)}</button></td><td><input data-cp="load.${i}.name" value="${esc(l.name || '')}"></td>${['N', 'Vz', 'Vy', 'Mx', 'My', 'Mz'].map(q => `<td class="num"><input type="number" step="any" data-cp="load.${i}.${q}" value="${esc(l[q])}"></td>`).join('')}<td>${A.fec[l.id] ? uTag(Math.max(...A.fec[l.id].map(c => c.util), 0)) + ' FE' : ''} ${A.cm[l.id] ? uTag(A.cm[l.id].util) + ' CM' : ''}</td><td>${A.J.loads.length > 1 ? `<button class="btn btn-ghost xs" data-act="cn-rb" data-c="delLE" data-v="${esc(l.id)}" aria-label="${T('Delete', 'ลบ')}">✕</button>` : ''}</td></tr>`).join('')}</tbody></table></div><div class="cn-btns"><button class="btn btn-ghost xs" data-act="cn-rb" data-c="addle">+ ${T('New load effect', 'เพิ่มแรง')}</button></div>`;
      return `<div class="an-drawhead cn-dh">${tabs.map(t => `<button class="cn-dtab" data-act="cn-dtab" data-v="${t[0]}" aria-pressed="${A.drawer === t[0]}">${t[1]}</button>`).join('')}<span class="grow"></span><label class="cn-lesel">${T('Load effect', 'แรง')} <select id="cn-le">${A.J.loads.map(l => `<option value="${esc(l.id)}" ${l.id === le.id ? 'selected' : ''}>${esc(l.id + ' · ' + (l.name || ''))}</option>`).join('')}</select></label><button class="btn btn-ghost xs" data-act="cn-dmin">${A.drawerMin ? T('Show ▴', 'แสดง ▴') : T('Hide ▾', 'ซ่อน ▾')}</button></div>${A.drawerMin ? '' : `<div class="cn-dbody">${body}</div>`}`;
    }
    function sumLine(fe, fr) {
      const w = Math.max(...fe.map(c => c.util), 0), ok = w <= 1.0005;
      return `<b class="${ok ? 'ok' : 'bad'}">${ok ? T('✓ Joint satisfies the CBFEM checks', '✓ รอยต่อผ่านการตรวจสอบ CBFEM') : T('✗ Joint does not satisfy the checks', '✗ รอยต่อไม่ผ่านการตรวจสอบ')}</b> · ${T('governing', 'ควบคุม')} ${uTag(w)}${fr ? ` · ${fr.nel} ${T('elements', 'เอลิเมนต์')}, ${fr.ndof} DOF, ${fr.iters} ${T('iterations', 'รอบ')}, ${f(fr.ms / 1000, 1)} s${fr.conv ? '' : ' · <b class="bad">' + T('not converged', 'ไม่ลู่เข้า') + '</b>'}` : ''}`;
    }
    function statHTML() {
      const le = LE(), fe = le && A.fec[le.id], cm = le && A.cm[le.id];
      if (A.err) return `<b class="bad">${esc(A.err)}</b>`;
      return `<b>${esc(A.J.name || '')}</b> · ${esc(C.CODES[A.J.code].name)} · ${le ? esc(le.id) : ''}${fe ? ' · CBFEM ' + uTag(Math.max(...fe.map(c => c.util), 0)) : ''}${cm ? ' · ' + T('CM', 'วิธีชิ้นส่วน') + ' ' + uTag(cm.util) : ''}${A.busy ? ' · <span class="cn-spin"></span> ' + esc(A.prog) : ''}`;
    }

    // ------------------------------------------------------------------ page
    function view() {
      if (!A.g && !A.err) rebuild();
      return `<main class="an an-app cn-app">
        ${ribHTML()}
        <aside class="an-side cn-side" id="cnTree">${treeHTML()}</aside>
        <section class="an-work cn-work">
          <div class="an-canvas cn-canvas"><canvas id="cnGl" aria-hidden="true"></canvas><canvas id="cnCv" tabindex="0" aria-label="${T('3D view of the joint', 'มุมมอง 3 มิติของรอยต่อ')}"></canvas>
            <div class="cn-stat" id="cnStat">${statHTML()}</div>
            <div class="cn-gz" id="cnGz" hidden></div>
            ${toolsHTML()}
            <div class="cn-legend" id="cnLeg"></div>
            <div class="cn-notes" id="cnNotes">${notesHTML()}</div>
            <p class="an-hintbar cn-hint">${T('Drag: rotate · right-drag / Shift-drag: pan · wheel: zoom · click: select · drag a part from Add onto a face · arrows / rings of the selected part: move / rotate', 'ลาก: หมุน · ลากคลิกขวา / Shift-ลาก: เลื่อน · ล้อเมาส์: ซูม · คลิก: เลือก · ลากชิ้นส่วนจาก เพิ่ม ไปวางบนผิว · ลูกศร / วงแหวนของชิ้นที่เลือก: เลื่อน / หมุน')}</p></div>
          <div class="an-drawer on cn-drawer ${A.drawerMin ? 'min' : ''}" id="cnDrawer">${drawerHTML()}</div>
        </section>
        <aside class="cn-props" id="cnProps">${propsHTML()}</aside>
        ${A.gallery ? galleryHTML() : ''}
        <div id="reportWrap" class="an-report"></div></main>`;
    }
    function galleryHTML() {
      return `<div class="modal-bg cn-galbg" data-act="cn-galclose"><div class="modal cn-gal" data-stop="1" role="dialog" aria-label="${T('New joint', 'รอยต่อใหม่')}"><h3>${T('New joint — pick a type', 'รอยต่อใหม่ — เลือกชนิด')}</h3>
        <div class="cn-galg">${C.TYPE_ORDER.map(t => `<button class="cn-gi" data-act="cn-rb" data-c="type" data-v="${t}"><svg viewBox="0 0 24 24" aria-hidden="true">${IC[TYPE_IC[t]]}</svg><b>${T(C.TYPES[t].n[0], C.TYPES[t].n[1])}</b><span class="muted small">${{ moment: T('Moment connection', 'รอยต่อรับโมเมนต์'), shear: T('Shear connection', 'รอยต่อรับแรงเฉือน'), base: T('Column base', 'ฐานเสา'), splice: T('Member splice', 'รอยต่อชิ้นส่วน'), brace: T('Bracing', 'ค้ำยัน') }[C.TYPES[t].g]}</span></button>`).join('')}</div>
        <div class="mfoot"><span class="muted small">${T('Keeps the current standard. Undo brings the previous joint back.', 'ใช้มาตรฐานปัจจุบัน กดย้อนกลับเพื่อคืนรอยต่อเดิม')}</span><span class="grow"></span><button class="btn btn-ghost sm" data-act="cn-galclose">${T('Cancel', 'ยกเลิก')}</button></div></div></div>`;
    }

    // ------------------------------------------------------------------ 3D view: WebGL with a depth buffer (canvas painter as fallback)
    const PAL = () => { const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && G.matchMedia && G.matchMedia('(prefers-color-scheme: dark)').matches); return dark ? { dark: true, bg: '#11161f', ink: '#e6ebf2', mem: [150, 163, 181], pl: [222, 160, 70], st: [120, 178, 120], bolt: [70, 78, 92], weld: '#ff6a3d', sel: '#f2387a', grid: '#2a3242', load: '#5b9dff' } : { dark: false, bg: '#f7f8fb', ink: '#1d2433', mem: [168, 180, 196], pl: [226, 162, 66], st: [118, 176, 116], bolt: [62, 70, 84], weld: '#e4572e', sel: '#f2387a', grid: '#dde3ec', load: '#2563eb' }; };
    const pal3 = () => (PAL().dark ? { mem: [128, 140, 158], pl: [222, 160, 70], st: [112, 172, 112], bolt: [150, 158, 172], weld: [255, 112, 64], user: [92, 156, 240], userMem: [110, 150, 205], float: [235, 90, 90], conc: [120, 124, 130], grout: [95, 98, 104], edge: [8, 10, 14], edgeM: [14, 18, 26], selRGB: [242, 56, 122] }
      : { mem: [178, 188, 202], pl: [232, 168, 72], st: [126, 184, 124], bolt: [70, 76, 88], weld: [232, 92, 44], user: [86, 148, 232], userMem: [130, 166, 216], float: [232, 80, 80], conc: [205, 205, 200], grout: [165, 165, 165], edge: [60, 44, 18], edgeM: [62, 74, 92], selRGB: [242, 56, 122] });
    function basis(c) { const cp = Math.cos(c.pitch), e = [cp * Math.cos(c.yaw), cp * Math.sin(c.yaw), Math.sin(c.pitch)], r = V.unit([-Math.sin(c.yaw), Math.cos(c.yaw), 0]), u = V.cross(e, r); return { e, r, u }; }
    function allPlates() { const g = A.g; return g ? g.plates.concat((g.floating || {}).plates || []) : []; }
    function bounds() { const g = A.g; if (!g) return { c: [0, 0, 0], R: 500 }; let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; allPlates().forEach(p => p.c.forEach(q => { for (let i = 0; i < 3; i++) { lo[i] = min(lo[i], q[i]); hi[i] = max(hi[i], q[i]); } })); return { c: V.mul(V.add(lo, hi), 0.5), R: max(100, V.len(V.sub(hi, lo)) / 2) }; }
    function fitCam(W, H) {
      const b = bounds(), c = A.cam, B = basis(c); c.c = b.c; c.ox = 0; c.oy = 0;
      if (!A.g) { c.k = 0.5 * min(W, H) / b.R; return; }
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; allPlates().forEach(p => p.c.forEach(q => { const d = V.sub(q, b.c), x = V.dot(d, B.r), y = V.dot(d, B.u); x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y); }));
      const mxL = 92, mxR = 40, myT = 52, myB = 40; c.k = min((W - mxL - mxR) / max(1, x1 - x0), (H - myT - myB) / max(1, y1 - y0));
      c.ox = -c.k * (x0 + x1) / 2 + (mxL - mxR) / 2; c.oy = c.k * (y0 + y1) / 2 + (myT - myB) / 2; }
    function shadeRGB(rgb, n, B, a) { const L = V.unit(V.add(V.mul(B.e, 0.8), V.add(V.mul(B.u, 0.5), V.mul(B.r, -0.3)))), s = 0.5 + 0.5 * abs(V.dot(n, L)); return `rgba(${Math.round(rgb[0] * s)},${Math.round(rgb[1] * s)},${Math.round(rgb[2] * s)},${a == null ? 1 : a})`; }
    function ramp(t) { t = Math.max(0, Math.min(1, t)); const st = [[0, [40, 70, 200]], [0.25, [40, 170, 230]], [0.5, [60, 200, 90]], [0.75, [245, 210, 50]], [0.9, [245, 120, 40]], [1, [215, 40, 40]]]; for (let i = 1; i < st.length; i++) if (t <= st[i][0]) { const a = st[i - 1], b = st[i], u = (t - a[0]) / (b[0] - a[0]); return [0, 1, 2].map(k => Math.round(a[1][k] + (b[1][k] - a[1][k]) * u)); } return st[st.length - 1][1]; }
    function camNow(W, H) { if (!A.cam.k) fitCam(W, H); const c = A.cam; return { c: c.c, ox: c.ox, oy: c.oy, k: c.k, B: basis(c), cx: W / 2 + c.ox, cy: H / 2 + c.oy }; }
    const projector = cm => q => { const d = V.sub(q, cm.c); return [cm.cx + cm.k * V.dot(d, cm.B.r), cm.cy - cm.k * V.dot(d, cm.B.u), V.dot(d, cm.B.e)]; };
    function rayAt(x, y, cm) { const R = bounds().R, w = V.lin(cm.c, cm.B.r, (x - cm.cx) / cm.k, cm.B.u, -(y - cm.cy) / cm.k); return { o: V.lin(w, cm.B.e, 6 * R), d: V.mul(cm.B.e, -1) }; }
    function utilOf(key) { const le = LE(), ch = le && A.fec[le.id]; if (!ch) return null; const i = key.indexOf(':'), k = key.slice(0, i), id = key.slice(i + 1); const c = ch.find(q => (k === 'b' ? q.grp === 'Bolts' || q.grp === 'Anchors' : q.grp === 'Welds') && q.item === id); return c ? c.util : null; }
    const opById = id => (A.J.ops || []).find(o => o.id === id);
    // keys of user parts: 'u:<op id>' (a bolt or weld of a user group carries the group id)
    const keyOf = h => { if (!h) return null; const i = h.key.indexOf(':'), id = h.key.slice(i + 1); return opById(id) ? 'u:' + id : h.key; };
    const selSet = () => { const s = new Set(); if (A.hl) { s.add(A.hl); if (A.hl.startsWith('u:')) { const id = A.hl.slice(2); s.add('b:' + id); s.add('w:' + id); } } return s; };

    // painter (no WebGL): primitives in screen space sorted back to front
    let picks = [];
    function scene(W, H, opt) {
      opt = opt || {}; const g = A.g, c = A.cam, B = basis(c), P = PAL(), prims = [], disp = opt.disp || A.disp, le = LE(), fr = le && A.fe[le.id];
      if (!g) return { prims, B, P };
      const k = c.k, cx = W / 2 + c.ox, cy = H / 2 + c.oy, pr = q => { const d = V.sub(q, c.c); return [cx + k * V.dot(d, B.r), cy - k * V.dot(d, B.u), V.dot(d, B.e)]; };
      const poly = (pts3, fill, stroke, key, lw, bias) => { const s = pts3.map(pr); prims.push({ t: 'poly', s, z: s.reduce((a, q) => a + q[2], 0) / s.length + (bias || 0), fill, stroke, key, lw }); };
      const useFE = fr && disp !== 'model', sel = selSet();
      const memIds = new Set(g.members.flatMap(m => m.plates));
      if (useFE) {
        const X = fr.X, u = fr.u, sc = A.def ? defScale(fr) : 0, xyz = i => [X[3 * i] + sc * u[6 * i], X[3 * i + 1] + sc * u[6 * i + 1], X[3 * i + 2] + sc * u[6 * i + 2]];
        fr.els.forEach(e => { const q = e.n.map(xyz), n = V.unit(V.cross(V.sub(q[2], q[0]), V.sub(q[3], q[1]))), val = disp === 'ep' ? e.ep / 0.05 : e.s / (e.fy || 355);
          const rgb = disp === 'mesh' ? (memIds.has(e.p) ? P.mem : P.pl) : ramp(val), a = A.lay.ghost && memIds.has(e.p) && disp === 'mesh' ? 0.35 : 1;
          poly(q, shadeRGB(rgb, n, B, a), disp === 'mesh' ? 'rgba(20,30,45,.55)' : 'rgba(20,30,45,.18)', 'pl:' + e.p, 0.6); });
      } else {
        allPlates().forEach(p => {
          const isM = memIds.has(p.id), key = p.user ? 'u:' + p.id : 'pl:' + p.id, rgb = sel.has(key) ? [242, 56, 122] : p.user ? [86, 148, 232] : isM ? P.mem : p.op === 'ST' ? P.st : P.pl, a = isM && A.lay.ghost ? 0.28 : 1;
          const h = p.t / 2, top = p.c.map(q => V.lin(q, p.n, h)), bot = p.c.map(q => V.lin(q, p.n, -h));
          const L1 = V.len(V.sub(p.c[1], p.c[0])), L2 = V.len(V.sub(p.c[3], p.c[0])), ns = Math.max(1, Math.min(14, Math.round(L1 / 120))), nt = Math.max(1, Math.min(14, Math.round(L2 / 120)));
          const bl = (cc, s, t) => { const a0 = V.lin(cc[0], V.sub(cc[1], cc[0]), s), a1 = V.lin(cc[3], V.sub(cc[2], cc[3]), s); return V.lin(a0, V.sub(a1, a0), t); };
          const edge = isM ? 'rgba(40,52,70,.35)' : 'rgba(40,30,10,.45)';
          [[top, p.n], [bot, V.mul(p.n, -1)]].forEach(([cc, n]) => { for (let i = 0; i < ns; i++) for (let j = 0; j < nt; j++) poly([bl(cc, i / ns, j / nt), bl(cc, (i + 1) / ns, j / nt), bl(cc, (i + 1) / ns, (j + 1) / nt), bl(cc, i / ns, (j + 1) / nt)], shadeRGB(rgb, n, B, a), null, key); });
          for (let e = 0; e < 4; e++) { const e1 = (e + 1) % 4, nE = V.unit(V.cross(V.sub(p.c[e1], p.c[e]), p.n)); poly([top[e], top[e1], bot[e1], bot[e]], shadeRGB(rgb, nE, B, a), null, key); }
          [top, bot].forEach(cc => { for (let e = 0; e < 4; e++) { const s0 = pr(cc[e]), s1 = pr(cc[(e + 1) % 4]); prims.push({ t: 'line', s: [s0, s1], z: (s0[2] + s1[2]) / 2 + 0.5, stroke: edge, lw: 0.8 }); } });
        });
      }
      if (A.lay.bolts) g.bolts.forEach(b => { const q0 = pr(V.lin(b.p, b.axis, -30)), q1 = pr(V.lin(b.p, b.axis, 30)); prims.push({ t: 'line', s: [q0, q1], z: Math.max(q0[2], q1[2]) + 1, stroke: sel.has('b:' + b.id) || sel.has('b:' + b.user) ? P.sel : 'rgb(62,70,84)', lw: max(3, b.B.d * k), key: 'b:' + b.id }); });
      if (A.lay.welds) g.welds.forEach(w => { const a = pr(w.p0), b2 = pr(w.p1); prims.push({ t: 'line', s: [a, b2], z: Math.max(a[2], b2[2]) + 3, stroke: sel.has('w:' + w.id) || sel.has('w:' + w.user) ? P.sel : P.weld, lw: max(2.5, (+w.a_ || 6) * 1.2 * k), key: 'w:' + w.id, cap: 'round' }); });
      prims.sort((a, b) => a.z - b.z);
      return { prims, B, P, pr };
    }
    function defScale(fr) { let um = 0; for (let i = 0; i < fr.u.length; i += 6) um = max(um, Math.hypot(fr.u[i], fr.u[i + 1], fr.u[i + 2])); const R = bounds().R; return um > 0 ? 0.06 * R / um * A.dsc : 0; }
    function paint(cv, W, H, opt) {
      const dpr = G.devicePixelRatio || 1, g = cv.getContext('2d'); opt = opt || {};
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cm = camNow(W, H), { prims, B, P, pr } = scene(W, H, opt); g.fillStyle = P.bg; g.fillRect(0, 0, W, H);
      prims.forEach(p => {
        if (p.t === 'poly') { g.beginPath(); p.s.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fillStyle = p.fill; g.fill(); g.strokeStyle = p.stroke || p.fill; g.lineWidth = p.lw || 0.6; g.stroke(); }
        else { g.beginPath(); g.moveTo(p.s[0][0], p.s[0][1]); g.lineTo(p.s[1][0], p.s[1][1]); g.strokeStyle = p.stroke; g.lineWidth = p.lw || 1; g.lineCap = p.cap || 'butt'; g.stroke(); g.lineCap = 'butt'; }
      });
      if (pr && A.g) { { const pl = []; drawLoads(g, pr, P, W, H, pl); if (A.lay.labels) drawLabels(g, pr, P, cm, W, H, pl); } }
      drawTriad(g, B, P, H);
      if (!A.g) { g.fillStyle = P.ink; g.font = '14px system-ui'; g.fillText(A.err || '', 20, 40); }
      return cm;
    }
    function drawTriad(g, B, P, H) { const o = [40, H - 40]; g.fillStyle = P.dark ? 'rgba(20,26,36,.7)' : 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(o[0], o[1], 30, 0, 2 * Math.PI); g.fill(); [['X', [1, 0, 0], '#e04848'], ['Y', [0, 1, 0], '#2fa84f'], ['Z', [0, 0, 1], '#2f6fe0']].forEach(([l, v, col]) => { const x = o[0] + 22 * V.dot(v, B.r), y = o[1] - 22 * V.dot(v, B.u); g.strokeStyle = col; g.lineWidth = 2.2; g.beginPath(); g.moveTo(o[0], o[1]); g.lineTo(x, y); g.stroke(); g.fillStyle = col; g.font = 'bold 11px system-ui'; g.fillText(l, x + 2, y + 4); }); }
    function arrow(g, a, b, col, w) { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, hl = 6 + 2 * (w || 2); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = w || 2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0] - ux * hl * 0.8, b[1] - uy * hl * 0.8); g.stroke(); g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(b[0] - ux * hl - uy * hl * 0.45, b[1] - uy * hl + ux * hl * 0.45); g.lineTo(b[0] - ux * hl + uy * hl * 0.45, b[1] - uy * hl - ux * hl * 0.45); g.closePath(); g.fill(); }
    const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    function pill(g, x, y, txt, P, opt) { opt = opt || {}; g.font = (opt.bold ? 'bold ' : '') + '11.5px system-ui, sans-serif'; const w = g.measureText(txt).width + 10, h = 18; rr(g, x, y, w, h, 5); g.fillStyle = opt.fill || (P.dark ? 'rgba(24,30,42,.9)' : 'rgba(255,255,255,.92)'); g.fill(); if (!opt.fill) { g.strokeStyle = P.dark ? 'rgba(255,255,255,.14)' : 'rgba(20,30,50,.18)'; g.lineWidth = 1; g.stroke(); } g.fillStyle = opt.ink || P.ink; g.textBaseline = 'middle'; g.fillText(txt, x + 5, y + h / 2 + 0.5); g.textBaseline = 'alphabetic'; return [x, y, w, h]; }
    function drawLoads(g, pr, P, W, H, placed) {
      if (!A.lay.loads) return; const le = LE(); if (!le) return; W = W || 9999; H = H || 9999; placed = placed || [];
      const lbl = (x, y, txt) => { g.font = 'bold 11.5px system-ui, sans-serif'; const w = g.measureText(txt).width + 10, h = 18; let bx = Math.max(4, Math.min(W - w - 4, x)), by = Math.max(44, Math.min(H - h - 26, y));
        for (let k = 0; k < 6 && placed.some(o => bx < o[0] + o[2] + 4 && o[0] < bx + w + 4 && by < o[1] + o[3] + 3 && o[1] < by + h + 3); k++) by += h + 4;
        placed.push(pill(g, bx, by, txt, P, { bold: 1, ink: P.load })); };
      A.g.members.filter(m => m.loaded).forEach(m => {
        const O = V.lin(m.O, m.fr.x, m.s1), s = pr(O), comps = [['N', m.fr.x, 1], ['Vz', m.fr.z, -1], ['Vy', m.fr.y, -1]], L = 62;
        comps.forEach(([q, dir, sg]) => { const v = +le[q] || 0; if (!v) return; const d = V.mul(dir, sg * Math.sign(v)), p0 = pr(V.lin(O, d, -L / A.cam.k)), tip = q === 'N' ? pr(V.lin(O, d, L / A.cam.k)) : s; arrow(g, q === 'N' ? s : p0, tip, P.load, 2.4); const lp = q === 'N' ? tip : p0; lbl(lp[0] + 6, lp[1] - 20, q + ' ' + f(v, 0) + ' kN'); });
        const ms = ['Mx', 'My', 'Mz'].filter(q => +le[q]); if (ms.length) { g.strokeStyle = P.load; g.lineWidth = 2.2; g.beginPath(); g.arc(s[0], s[1], 14, -2.4, 1.6); g.stroke(); lbl(s[0] + 10, s[1] + 12, ms.map(q => q + ' ' + f(+le[q], 0)).join('  ') + ' kNm'); }
      });
    }
    // part names with leader lines: hidden parts are skipped and the labels never overlap each other
    function drawLabels(g, pr, P, cm, W, H, placed0) {
      const G0 = A.g, items = [], R = bounds().R, cen = p => V.mul(p.c.reduce((a, q) => V.add(a, q), [0, 0, 0]), 0.25), opN = id => { const o = opById(id); return o && o.name ? o.name : id; };
      const MN = { Column: ['Column', 'เสา'], Beam: ['Beam', 'คาน'], Brace: ['Brace', 'ค้ำยัน'], Branch: ['Branch', 'ท่อสาขา'], 'Member A': ['Member A', 'ชิ้นส่วน A'], 'Member B': ['Member B', 'ชิ้นส่วน B'] }, mName = m => (MN[m.name] ? T(MN[m.name][0], MN[m.name][1]) : m.name);
      G0.members.forEach(m => items.push({ t: (m.user ? opN(m.id) : mName(m)) + ' · ' + (m.s.name || ''), q: V.lin(m.O, m.fr.x, m.s0 + (m.s1 - m.s0) * 0.82), key: m.user ? 'u:' + m.id : 'pl:' + m.plates[0], pri: 3, bold: 1, mem: m }));
      G0.plates.forEach(p => { if (p.role === 'member') return; items.push({ t: p.user ? opN(p.id) : p.id, q: cen(p), key: p.user ? 'u:' + p.id : 'pl:' + p.id, pri: p.user ? 2 : 1, plate: p }); });
      ((G0.floating || {}).plates || []).forEach(p => { if (p.role === 'member') return; items.push({ t: opN(p.id) + ' — ' + T('not connected', 'ยังไม่ได้ต่อ'), q: cen(p), key: 'u:' + p.id, pri: 4, warn: 1 }); });
      items.forEach(it => { if (it.key === A.hl || (A.hl && it.mem && A.hl === 'pl:' + it.mem.plates[0])) it.pri = 9; });
      items.sort((a, b) => b.pri - a.pri);
      const placed = placed0 || [];
      items.forEach(it => {
        const s = pr(it.q); if (s[0] < 0 || s[0] > W || s[1] < 0 || s[1] > H) return;
        if (it.pri < 9 && !it.warn) { const h = G.CONN3D ? G.CONN3D.raycast(G0, V.lin(it.q, cm.B.e, 6 * R), V.mul(cm.B.e, -1), { parts: false, floating: false }) : null; const depth = it.plate ? it.plate.t / 2 + 3 : it.mem ? (it.mem.s.d || it.mem.s.D || 200) / 2 + 3 : 3;
          if (h && h.t < 6 * R - depth && h.key !== it.key && !(it.mem && h.plate && h.plate.mem === it.mem.id)) return; }
        g.font = (it.bold ? 'bold ' : '') + '11.5px system-ui, sans-serif'; const w = g.measureText(it.t).width + 10, h = 18;
        const cands = [[12, -h - 8], [12, 8], [-w - 12, -h - 8], [-w - 12, 8], [-w / 2, -h - 16], [-w / 2, 16], [28, -h - 28], [-w - 28, -h - 28], [28, 28], [-w - 28, 28], [44, -h / 2], [-w - 44, -h / 2], [40, -h - 48], [-w - 40, 48]].concat(it.pri === 9 ? [[100, -h / 2], [-w - 100, -h / 2], [-w / 2, -h - 100], [-w / 2, 100], [96, -h - 70], [-w - 96, 70]] : []);
        let box = null; for (const [dx, dy] of cands) { const b = [s[0] + dx, s[1] + dy, w, h]; if (b[0] < 4 || b[1] < 44 || b[0] + w > W - 4 || b[1] + h > H - 26) continue; if (placed.some(o => b[0] < o[0] + o[2] + 4 && o[0] < b[0] + w + 4 && b[1] < o[1] + o[3] + 3 && o[1] < b[1] + h + 3)) continue; box = b; break; }
        if (!box) return; placed.push(box);
        const ax = Math.max(box[0], Math.min(s[0], box[0] + w)), ay = Math.max(box[1], Math.min(s[1], box[1] + h)), hot = it.pri === 9;
        g.strokeStyle = hot ? P.sel : it.warn ? '#dc2626' : P.dark ? 'rgba(220,230,245,.55)' : 'rgba(40,50,70,.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(ax, ay); g.stroke();
        g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(s[0], s[1], 2.6, 0, 2 * Math.PI); g.fill();
        pill(g, box[0], box[1], it.t, P, { bold: it.bold, fill: hot ? P.sel : it.warn ? '#dc2626' : null, ink: hot || it.warn ? '#fff' : null });
      });
    }
    function legend() {
      const el = $('#cnLeg'); if (!el) return; const le = LE(), fr = le && A.fe[le.id];
      if (!fr || A.disp === 'model' || A.disp === 'mesh') { el.innerHTML = ''; el.hidden = true; return; }
      el.hidden = false; const ep = A.disp === 'ep', stops = [1, 0.9, 0.75, 0.5, 0.25, 0];
      el.innerHTML = `<b>${ep ? T('Plastic strain ε_pl', 'ความเครียดพลาสติก ε_pl') : T('Equivalent stress σ / f_y', 'หน่วยแรงเทียบเท่า σ / f_y')}</b><div class="cn-lgb"><i style="background:linear-gradient(to bottom,${stops.map(s => `rgb(${ramp(s).join(',')})`).join(',')})"></i><span>${stops.map(s => `<em>${ep ? f(s * 5, 2) + ' %' : f(s * 100, 0) + ' %'}</em>`).join('')}</span></div><small>${ep ? T('limit 5 %', 'ขีดจำกัด 5 %') : T('max ', 'สูงสุด ') + f(Math.max(...Object.values(fr.plates).map(q => q.s)), 0) + ' MPa'}${A.def ? ' · ' + T('deformation ×', 'การเสียรูป ×') + f(defScale(fr), 0) : ''}</small>`;
    }

    // ------------------------------------------------------------------ gizmo: move arrows and rotation rings for the selected part
    const perpV = a => V.unit(abs(a[2]) < 0.9 ? V.cross(a, [0, 0, 1]) : V.cross(a, [1, 0, 0]));
    function rotV(v, a, deg) { const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t), k = V.unit(a); return V.add(V.add(V.mul(v, c), V.mul(V.cross(k, v), s)), V.mul(k, V.dot(k, v) * (1 - c))); }
    function soInfo() {
      const J = A.J, g = A.g; if (!g || !C.SO_TYPES[J.type] || g.tube) return null;
      if (J.type === 'base') { const m = g.members.find(q => q.id === 'C'); return m && { o: m.O, match: id => /^C\./.test(id), ax: [{ v: [1, 0, 0], lab: 'e_x', col: '#e04848', mv: 1, key: 'dx' }, { v: [0, 1, 0], lab: 'e_y', col: '#2fa84f', mv: 1, key: 'dy' }] }; }
      const m = g.members.find(q => q.id === 'B'); if (!m) return null; const web = J.type === 'fin' && J.p.to === 'web';
      return { o: m.O, match: id => /^B\./.test(id) || ['EP', 'FP', 'AL.w', 'AL.c', 'AR.w', 'AR.c'].includes(id), ax: [{ v: web ? [-1, 0, 0] : [0, 1, 0], lab: 'e_y', col: '#2fa84f', mv: 1, key: 'dy' }, { v: [0, 0, 1], lab: 'e_z', col: '#2f6fe0', mv: 1, key: 'dz' }] };
    }
    function opAxes(op) {
      if (op.kind === 'plate') { const u = V.unit(op.u), n = V.unit(V.cross(u, op.v)), v = V.cross(n, u); return [{ v: u, lab: 'u', col: '#e04848', mv: 1, rt: 1 }, { v, lab: 'v', col: '#2fa84f', mv: 1, rt: 1 }, { v: n, lab: 'n', col: '#2f6fe0', mv: 1, rt: 1 }]; }
      if (op.kind === 'member') { const fr = C.memberFrame(op.x, op.roll); return [{ v: fr.x, lab: 'x', col: '#e04848', mv: 1, rt: 1, roll: 1 }, { v: fr.y, lab: 'y', col: '#2fa84f', mv: 1, rt: 1 }, { v: fr.z, lab: 'z', col: '#2f6fe0', mv: 1, rt: 1 }]; }
      if (op.kind === 'bolts') { const H = allPlates().find(p => p.id === op.host); if (!H) return []; const n = H.n, d0 = op.dir || H.u, d = V.unit(V.sub(d0, V.mul(n, V.dot(d0, n)))); return [{ v: d, lab: 'p', col: '#e04848', mv: 1 }, { v: V.cross(n, d), lab: 'g', col: '#2fa84f', mv: 1 }, { v: n, lab: 'n', col: '#2f6fe0', rt: 1 }]; }
      return [];
    }
    function gizmoTarget() {
      if (!A.g || !A.hl || A.disp !== 'model' || A.place) return null;
      if (A.hl.startsWith('u:')) { const op = opById(A.hl.slice(2)); if (!op || op.kind === 'weld') return null; return { t: 'op', op, o: op.o, ax: opAxes(op) }; }
      const so = soInfo(); if (so && A.hl.startsWith('pl:') && so.match(A.hl.slice(3))) return { t: 'so', o: so.o, ax: so.ax };
      return null;
    }
    let GZ = null;
    function gizmoBox(pr) { const tg = gizmoTarget(); if (!tg) return []; const c = pr(tg.o); return [[c[0] - 92, c[1] - 92, 184, 184]]; }
    function drawGizmo(g, cm, pr) {
      GZ = null; const tg = gizmoTarget(); if (!tg) return; const c = pr(tg.o), L = 78, hs = [], hot = A.gzHot;
      tg.ax.forEach(a => { if (!a.rt) return; const p1 = perpV(a.v), p2 = V.cross(a.v, p1), rho = 54 / cm.k, pts = []; for (let i = 0; i <= 72; i++) { const t = 2 * Math.PI * i / 72; pts.push(pr(V.lin(tg.o, p1, rho * Math.cos(t), p2, rho * Math.sin(t)))); }
        const on = hot && hot.kind === 'rot' && hot.a.lab === a.lab; g.strokeStyle = a.col; g.globalAlpha = on ? 1 : 0.6; g.lineWidth = on ? 3.2 : 2; g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.stroke(); g.globalAlpha = 1; hs.push({ kind: 'rot', a, pts }); });
      tg.ax.forEach(a => { if (!a.mv) return; const sx = V.dot(a.v, cm.B.r), sy = -V.dot(a.v, cm.B.u), sl = Math.hypot(sx, sy); if (sl < 0.15) return; const ux = sx / sl, uy = sy / sl, tip = [c[0] + ux * L, c[1] + uy * L], on = hot && hot.kind === 'mv' && hot.a.lab === a.lab;
        g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = on ? 7 : 5.5; g.beginPath(); g.moveTo(c[0], c[1]); g.lineTo(tip[0] - ux * 10, tip[1] - uy * 10); g.stroke();
        arrow(g, c, tip, a.col, on ? 3.6 : 2.6); pill(g, tip[0] + ux * 8 - 8, tip[1] + uy * 8 - 9, a.lab, PAL(), { bold: 1, ink: a.col }); hs.push({ kind: 'mv', a, c, tip, ux, uy, ks: cm.k * sl }); });
      g.fillStyle = '#fff'; g.strokeStyle = '#1d2433'; g.lineWidth = 1.5; g.beginPath(); g.arc(c[0], c[1], 5, 0, 2 * Math.PI); g.fill(); g.stroke();
      GZ = { tg, c, hs };
    }
    const segD = (x, y, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)); return Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y); };
    function gizmoHit(x, y) { if (!GZ) return null; let best = null, bd = 9; GZ.hs.forEach(h => { let d = 1e9; if (h.kind === 'mv') d = segD(x, y, h.c, h.tip) - 1.5; else for (let i = 1; i < h.pts.length; i++) d = Math.min(d, segD(x, y, h.pts[i - 1], h.pts[i])); if (d < bd) { bd = d; best = h; } }); return best; }
    function rotateOp(op, op0, axis, deg, a) {
      const r = v => rotV(v, axis, deg).map(x => Math.round(x * 1e6) / 1e6);
      if (op.kind === 'plate') { op.u = r(op0.u); op.v = r(op0.v); }
      else if (op.kind === 'member') { if (a && a.roll) op.roll = (((+op0.roll || 0) + deg) % 360 + 360) % 360; else op.x = r(op0.x); }
      else if (op.kind === 'bolts') { const H = allPlates().find(p => p.id === op.host); op.dir = r(op0.dir || (H ? H.u : [1, 0, 0])); }
    }
    function gizmoDrag(h, st, x, y, e) {
      const tg = GZ ? GZ.tg : null; if (!tg) return;
      if (h.kind === 'mv') { const dpx = (x - st.x) * h.ux + (y - st.y) * h.uy, step = e.shiftKey ? 1 : 5, mm = Math.round(dpx / h.ks / step) * step;
        if (tg.t === 'so') { A.J.so = A.J.so || {}; A.J.so[h.a.key] = Math.round((+st.so[h.a.key] || 0) + mm); A.gzInfo = h.a.lab + ' = ' + A.J.so[h.a.key] + ' mm'; }
        else { st.op.o = V.lin(st.op0.o, h.a.v, mm).map(v => Math.round(v * 10) / 10); A.gzInfo = T('Move ', 'เลื่อน ') + h.a.lab + ' ' + (mm > 0 ? '+' : '') + mm + ' mm'; }
      } else { const c = st.c0, a0 = Math.atan2(st.y - c[1], st.x - c[0]), a1 = Math.atan2(y - c[1], x - c[0]); let d = -(a1 - a0) * (V.dot(h.a.v, st.B.e) >= 0 ? 1 : -1) * 180 / Math.PI; while (d > 180) d -= 360; while (d < -180) d += 360; const step = e.shiftKey ? 5 : 15; d = Math.round(d / step) * step;
        rotateOp(st.op, st.op0, h.a.v, d, h.a); A.gzInfo = T('Rotate about ', 'หมุนรอบ ') + h.a.lab + ' ' + (d > 0 ? '+' : '') + d + '°'; }
      rebuild(); schedule();
    }

    // ------------------------------------------------------------------ toolbox: drag a part into the view (or click a tool, then click a face)
    const TOOLS = { plate: ['plate', 'Plate', 'แผ่น', 'A plate lying on the face, welded all round', 'แผ่นวางบนผิว เชื่อมรอบ'], stiff: ['stiff', 'Stiffener', 'แผ่นเสริม', 'A plate standing on the face, welded both sides', 'แผ่นตั้งบนผิว เชื่อมสองด้าน'], member: ['member', 'Member', 'ชิ้นส่วน', 'A member starting on the face, welded all round', 'ชิ้นส่วนเริ่มจากผิว เชื่อมรอบ'], weld: ['weld', 'Weld', 'รอยเชื่อม', 'Weld the plate under the pointer to the part it touches', 'เชื่อมแผ่นใต้ตัวชี้กับชิ้นที่สัมผัส'], bolts: ['bolt', 'Bolts', 'สลัก', 'A bolt group through the plates stacked at that point', 'กลุ่มสลักผ่านแผ่นที่ซ้อนกันตรงนั้น'] };
    const r1 = v => v.map(x => Math.round(x * 10) / 10);
    function nextId(pre, extra) { const ids = new Set((A.J.ops || []).map(o => o.id).concat(extra || [])); let i = 1; while (ids.has(pre + i)) i++; return pre + i; }
    function faceFrame(hit) { const p = hit.plate, n = V.unit(hit.n); let u = abs(V.dot(p.u, n)) > 0.5 ? p.n : p.u; u = V.unit(V.sub(u, V.mul(n, V.dot(u, n)))); if (abs(u[2]) > 0.9 && abs(n[2]) < 0.9) { /* keep vertical faces upright */ } return { n, u, v: V.cross(n, u) }; }
    function makeOps(tool, hit) {
      const g = A.g; if (!g) return null; const host = hit && hit.plate && !hit.plate.floatingOnly ? hit.plate : null, mid = hit ? hit.x : bounds().c;
      const F = host ? faceFrame(hit) : { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] };
      const nm = (en, th, id) => T(en, th) + ' ' + id;
      if (tool === 'weld') {
        if (!host) return { ops: [], msg: T('Drop the weld on a plate that touches another part.', 'วางรอยเชื่อมบนแผ่นที่สัมผัสชิ้นอื่น') };
        let best = null; g.plates.forEach(q => { if (q.id === host.id || (q.mem && q.mem === host.mem)) return; [[host, q], [q, host]].forEach(([a, b]) => { const e = C.weldEdge(a, b); if (!e) return; const d = segD3(mid, e.p0, e.p1); if (!best || d < best.d) best = { d, a, b }; }); });
        if (!best || best.d > 300) return { ops: [], msg: T('No touching part found next to that point.', 'ไม่พบชิ้นส่วนที่สัมผัสบริเวณนั้น') };
        const id = nextId('UW'); return { ops: [{ id, kind: 'weld', name: nm('Weld', 'รอยเชื่อม', id), a: best.a.id, b: best.b.id, a_: 6, sides: 2, type: 'fillet' }], label: best.a.id + ' → ' + best.b.id };
      }
      if (tool === 'bolts') {
        if (!host) return { ops: [], msg: T('Drop the bolts on a plate.', 'วางสลักบนแผ่น') };
        const id = nextId('UB'), o = V.lin(mid, host.n, -V.dot(V.sub(mid, host.o), host.n)), d = abs(V.dot(F.u, host.n)) > 0.5 ? host.u : F.u;
        return { ops: [{ id, kind: 'bolts', name: nm('Bolts', 'สลัก', id), host: host.id, o: r1(o), dir: r1(V.unit(V.sub(d, V.mul(host.n, V.dot(d, host.n))))), nr: 2, nc: 2, p: 70, gg: 70, size: (A.J.p && A.J.p.bolt) || 'M20' }], label: T('through ', 'ผ่าน ') + host.id };
      }
      if (tool === 'plate') { const t = 10, id = nextId('UP'), op = { id, kind: 'plate', name: nm('Plate', 'แผ่น', id), o: r1(V.lin(mid, F.n, t / 2)), u: r1(F.u), v: r1(F.v), w: 160, h: 120, t };
        return { ops: host ? [op, { id: nextId('UW'), kind: 'weld', name: nm('Weld', 'รอยเชื่อม', id), a: id, b: host.id, a_: 6, all: true }] : [op], label: host ? T('on ', 'บน ') + host.id : '' }; }
      if (tool === 'stiff') { const t = 10, h = 120, id = nextId('US'), uS = abs(F.n[2]) < 0.7 ? V.unit(V.cross(F.n, [0, 0, 1])) : F.u, op = { id, kind: 'plate', name: nm('Stiffener', 'แผ่นเสริม', id), o: r1(V.lin(mid, F.n, h / 2)), u: r1(uS), v: r1(F.n), w: 160, h, t };
        return { ops: host ? [op, { id: nextId('UW'), kind: 'weld', name: nm('Weld', 'รอยเชื่อม', id), a: id, b: host.id, a_: 6, sides: 2 }] : [op], label: host ? T('on ', 'บน ') + host.id : '' }; }
      if (tool === 'member') { const id = nextId('UM'), op = { id, kind: 'member', name: nm('Member', 'ชิ้นส่วน', id), sec: { kind: 'SHS', size: '100x100x6' }, o: r1(mid), x: r1(F.n), roll: 0, L: 500, end: 'free' };
        return { ops: host ? [op, { id: nextId('UW'), kind: 'weld', name: nm('Weld', 'รอยเชื่อม', id), a: 'M:' + id, b: host.id, a_: 6 }] : [op], label: host ? T('on ', 'บน ') + host.id : '' }; }
      return null;
    }
    const segD3 = (q, a, b) => { const ab = V.sub(b, a), t = Math.max(0, Math.min(1, V.dot(V.sub(q, a), ab) / (V.dot(ab, ab) || 1))); return V.len(V.sub(q, V.lin(a, ab, t))); };
    function placeAt(tool, hit) {
      const r = makeOps(tool, hit); A.place = null; A.drop = null;
      if (!r || !r.ops.length) { toast(r && r.msg || T('Nothing placed.', 'ไม่ได้วางชิ้นส่วน'), 'bad'); refreshParts(); return; }
      snap(); A.J.ops = (A.J.ops || []).concat(r.ops); const keep = A.cam.k; rebuild(); A.cam.k = keep;
      if (tool === 'bolts' && A.g && !A.g.bolts.some(b => b.user === r.ops[0].id)) { A.J = JSON.parse(A.hist.pop()); rebuild(); A.cam.k = keep; refreshParts(); toast(T('No bolts placed: no other plate lies against ', 'ไม่ได้วางสลัก: ไม่มีแผ่นอื่นแนบกับ ') + r.ops[0].host + T(' there. Drop the bolts where two plates overlap.', ' ตรงนั้น วางสลักตรงที่สองแผ่นซ้อนกัน'), 'bad'); return; }
      persist();
      A.hl = 'u:' + r.ops[0].id; A.sel = 'item'; A.open.op = true; refreshParts(); refreshProps(); const tr = $('.cn-tools'); if (tr) tr.outerHTML = toolsHTML();
      const bad = A.g && A.g.notes.filter(n => n.bad && r.ops.some(o => n.en.indexOf(o.id) >= 0));
      toast(T(TOOLS[tool][1], TOOLS[tool][2]) + ' ' + r.ops[0].id + T(' added', ' เพิ่มแล้ว') + (r.label ? ' — ' + r.label : '') + (bad && bad.length ? ' · ' + T(bad[0].en, bad[0].th) : ''), bad && bad.length ? 'bad' : 'ok');
    }
    function delOp(id) {
      const J = A.J; if (!opById(id)) return; snap(); const gone = new Set([id]); let more = true;
      while (more) { more = false; (J.ops || []).forEach(o => { if (gone.has(o.id)) return; if ((o.kind === 'weld' && (gone.has(o.a) || gone.has(o.b) || gone.has(String(o.a).replace(/^M:/, '')))) || (o.kind === 'bolts' && gone.has(o.host))) { gone.add(o.id); more = true; } }); }
      J.ops = J.ops.filter(o => !gone.has(o.id)); if (A.hl && gone.has(A.hl.slice(2))) { A.hl = null; A.sel = 'joint'; }
      const keep = A.cam.k; rebuild(); A.cam.k = keep; persist(); refreshParts(); refreshProps(); toast(T('Deleted ', 'ลบ ') + [...gone].join(', '), '');
    }
    function dupOp(id) {
      const op = opById(id); if (!op) return; snap(); const c = JSON.parse(JSON.stringify(op)), pre = id.replace(/\d+$/, ''); c.id = nextId(pre); c.name = (op.name || op.id).replace(op.id, c.id);
      if (c.o) { const ax = op.kind === 'plate' ? V.unit(op.u) : op.kind === 'member' ? C.memberFrame(op.x, op.roll).y : V.unit(op.dir || [1, 0, 0]); c.o = r1(V.lin(op.o, ax, op.kind === 'plate' ? (+op.w || 100) + 30 : op.kind === 'member' ? 200 : (+op.p || 70) * (+op.nr || 1))); }
      const add = [c]; (A.J.ops || []).forEach(o => { if (o.kind === 'weld' && (o.a === id || o.a === 'M:' + id)) { const w = JSON.parse(JSON.stringify(o)); w.id = nextId('UW', add.map(q => q.id)); w.a = o.a === id ? c.id : 'M:' + c.id; w.name = (o.name || '').replace(id, c.id); add.push(w); } });
      A.J.ops = A.J.ops.concat(add); const keep = A.cam.k; rebuild(); A.cam.k = keep; persist(); A.hl = 'u:' + c.id; A.sel = 'item'; refreshParts(); refreshProps();
    }
    function toolsHTML() { return `<div class="cn-tools" role="toolbar" aria-label="${T('Add parts', 'เพิ่มชิ้นส่วน')}"><span class="cn-tools-h">${T('Add', 'เพิ่ม')}</span>${Object.entries(TOOLS).map(([k, t]) => `<button class="cn-tool ${A.place === k ? 'on' : ''}" draggable="true" data-act="cn-tool" data-v="${k}" title="${esc(T(t[3], t[4]))} — ${T('drag into the view, or click then click a face', 'ลากเข้ามุมมอง หรือคลิกแล้วคลิกที่ผิว')}" aria-pressed="${A.place === k}">${icon(t[0])}<span>${T(t[1], t[2])}</span></button>`).join('')}</div>`; }
    function notesHTML() {
      const ns = (A.g ? A.g.notes : []).slice().sort((a, b) => (b.bad ? 1 : 0) - (a.bad ? 1 : 0)); if (!ns.length) return '';
      const nb = ns.filter(n => n.bad).length, line = n => `<p class="${n.bad ? 'bad' : ''}">${n.bad ? '⚠ ' : 'ⓘ '}${esc(T(n.en, n.th))}</p>`;
      return `<button class="cn-nbtn ${nb ? 'bad' : ''}" data-act="cn-notes" aria-expanded="${!!A.notesOpen}">${nb ? '⚠ ' + nb + T(nb > 1 ? ' issues' : ' issue', ' ปัญหา') : 'ⓘ ' + ns.length + T(ns.length > 1 ? ' notes' : ' note', ' หมายเหตุ')}<span>${A.notesOpen ? '▾' : '▸'}</span></button>` + (A.notesOpen ? ns.map(line).join('') : `<p class="${ns[0].bad ? 'bad' : ''} one">${esc(T(ns[0].en, ns[0].th))}</p>`);
    }

    // ------------------------------------------------------------------ drawing loop
    let R3 = null, R3fail = false, meshSig = '', raf = 0;
    function gl3() { const cv = $('#cnGl'); if (!cv || !G.CONN3D || R3fail) return null; if (R3 && R3.cv === cv) return R3; R3 = G.CONN3D.create(cv); meshSig = ''; if (!R3) { R3fail = true; cv.hidden = true; } return R3; }
    function schedule() { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; redraw(); }); }
    function redraw() {
      const cv = $('#cnCv'); if (!cv) return; const W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
      const r3 = A.g ? gl3() : null, dpr = G.devicePixelRatio || 1; let cm, pr;
      if (r3) {
        cm = camNow(W, H); const le = LE(), fr = le && A.fe[le.id];
        const sig = [A.ver, A.hl, A.hov, A.disp, A.def, A.dsc, JSON.stringify(A.lay), A.le, PAL().dark, fr ? 1 : 0].join('|');
        if (sig !== meshSig) { meshSig = sig; r3.upload(G.CONN3D.meshOf(A.g, { pal: pal3(), disp: A.disp, fr, def: fr && A.def ? defScale(fr) : 0, hl: A.hl, sel: selSet(), hov: A.hov, lay: A.lay, utilOf })); }
        r3.draw(cm, W, H, dpr, bounds().R);
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
        pr = projector(cm); const P = PAL(); { const pl = gizmoBox(pr); drawLoads(g, pr, P, W, H, pl); if (A.lay.labels) drawLabels(g, pr, P, cm, W, H, pl); } drawTriad(g, cm.B, P, H);
      } else { cm = paint(cv, W, H); pr = projector(cm); }
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawGizmo(g, cm, pr); drawDrop(g, cm, pr, W, H);
      const gi = $('#cnGz'); if (gi) { gi.textContent = A.gzInfo || (A.place ? T('Click a face to place the ', 'คลิกที่ผิวเพื่อวาง') + T(TOOLS[A.place][1].toLowerCase(), TOOLS[A.place][2]) + T(' — Esc to cancel', ' — Esc เพื่อยกเลิก') : ''); gi.hidden = !gi.textContent; }
      legend();
    }
    // preview of the part being dragged in: outline of what will be added
    function drawDrop(g, cm, pr) {
      const d = A.drop; if (!d || !A.g) return; const r = makeOps(d.tool, d.hit); if (!r || !r.ops.length) { if (r && r.msg && d.pt) pill(g, d.pt[0] + 14, d.pt[1] + 10, r.msg, PAL(), { fill: '#dc2626', ink: '#fff' }); return; }
      let pg; try { pg = C.build(Object.assign({}, A.J, { ops: (A.J.ops || []).concat(r.ops) })); } catch (e) { return; }
      const ids = new Set(r.ops.map(o => o.id)), col = '#f2387a'; g.strokeStyle = col; g.fillStyle = 'rgba(242,56,122,.18)'; g.lineWidth = 2; g.setLineDash([5, 4]);
      pg.plates.concat(pg.floating.plates).filter(p => ids.has(p.id) || ids.has(p.mem)).forEach(p => { const s = p.c.map(pr); g.beginPath(); s.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill(); g.stroke(); });
      g.setLineDash([]); g.lineWidth = 4; pg.welds.concat(pg.floating.welds).filter(w => ids.has(w.user)).forEach(w => { const a = pr(w.p0), b = pr(w.p1); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); });
      pg.bolts.filter(b => ids.has(b.user)).forEach(b => { const s = pr(b.p); g.beginPath(); g.arc(s[0], s[1], 5, 0, 2 * Math.PI); g.fillStyle = col; g.fill(); });
      if (d.pt) pill(g, d.pt[0] + 14, d.pt[1] + 10, T(TOOLS[d.tool][1], TOOLS[d.tool][2]) + (r.label ? ' ' + r.label : ''), PAL(), { fill: col, ink: '#fff', bold: 1 });
    }
    function snapshot(disp, W, H) {
      const keep = { k: A.cam.k, c: A.cam.c, ox: A.cam.ox, oy: A.cam.oy, yaw: A.cam.yaw, pitch: A.cam.pitch }, hl = A.hl, hov = A.hov; A.hl = null; A.hov = null; A.cam.yaw = -0.95; A.cam.pitch = 0.38; A.cam.k = null;
      let url = '';
      const glc = document.createElement('canvas'), r3 = G.CONN3D && A.g ? G.CONN3D.create(glc) : null;
      try {
        if (r3) { const cm = camNow(W, H), le = LE(), fr = le && A.fe[le.id], P = PAL(); r3.upload(G.CONN3D.meshOf(A.g, { pal: pal3(), disp, fr, def: 0, lay: A.lay, utilOf })); r3.draw(cm, W, H, 2, bounds().R);
          const out = document.createElement('canvas'); out.width = W * 2; out.height = H * 2; const g = out.getContext('2d'); g.fillStyle = P.bg; g.fillRect(0, 0, out.width, out.height); g.drawImage(glc, 0, 0); g.setTransform(2, 0, 0, 2, 0, 0);
          const pr = projector(cm); { const pl = []; drawLoads(g, pr, P, W, H, pl); if (A.lay.labels) drawLabels(g, pr, P, cm, W, H, pl); } drawTriad(g, cm.B, P, H); url = out.toDataURL('image/png');
          const ext = r3.gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); }
        else { const cv = document.createElement('canvas'); paint(cv, W, H, { disp }); url = cv.toDataURL('image/png'); }
      } finally { Object.assign(A.cam, keep); A.hl = hl; A.hov = hov; }
      return url;
    }
    function hitAt(x, y) { const cv = $('#cnCv'); if (!cv || !A.g) return null; const cm = camNow(cv.clientWidth, cv.clientHeight), r = rayAt(x, y, cm); return G.CONN3D ? G.CONN3D.raycast(A.g, r.o, r.d) : null; }
    function select(key) { A.hl = key; A.sel = key ? 'item' : 'joint'; refreshProps(); const t = $('#cnTree'); if (t) t.innerHTML = treeHTML(); const dr = $('#cnDrawer'); if (dr) dr.innerHTML = drawerHTML(); redraw(); }
    let hovT = 0;
    function hover(cv, x, y) {
      const now = Date.now(); if (now - hovT < 30) return; hovT = now;
      const gh = A.place ? null : gizmoHit(x, y), was = A.gzHot; A.gzHot = gh;
      let key = null; if (!gh) { const h = hitAt(x, y); key = keyOf(h); }
      cv.style.cursor = A.place ? 'crosshair' : gh ? (gh.kind === 'mv' ? 'move' : 'grab') : key ? 'pointer' : 'grab';
      if (key !== A.hov || gh !== was) { A.hov = key; schedule(); }
    }
    function bindCanvas(cv) {
      let drag = null;
      cv.addEventListener('contextmenu', e => e.preventDefault());
      cv.addEventListener('pointerdown', e => {
        cv.focus(); const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        const gh = e.button === 0 && !A.place ? gizmoHit(x, y) : null;
        if (gh && GZ) { snap(); const op = GZ.tg.op || null; drag = { gz: gh, x, y, op, op0: op ? JSON.parse(JSON.stringify(op)) : null, so: Object.assign({}, A.J.so || {}), B: basis(A.cam), c0: GZ.c.slice(), moved: false }; cv.setPointerCapture(e.pointerId); return; }
        drag = { x: e.clientX, y: e.clientY, b: e.button, sh: e.shiftKey, moved: false, yaw: A.cam.yaw, pitch: A.cam.pitch, ox: A.cam.ox, oy: A.cam.oy }; cv.setPointerCapture(e.pointerId);
      });
      cv.addEventListener('pointermove', e => {
        const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        if (!drag) { hover(cv, x, y); return; }
        if (drag.gz) { drag.moved = true; gizmoDrag(drag.gz, drag, x, y, e); return; }
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (abs(dx) + abs(dy) > 3) drag.moved = true; if (!drag.moved) return;
        if (drag.b === 2 || drag.b === 1 || drag.sh) { A.cam.ox = drag.ox + dx; A.cam.oy = drag.oy + dy; } else { A.cam.yaw = drag.yaw - dx * 0.008; A.cam.pitch = Math.max(-1.55, Math.min(1.55, drag.pitch + dy * 0.008)); } schedule();
      });
      const up = e => {
        if (!drag) return; const d = drag; drag = null; const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        if (d.gz) { A.gzInfo = ''; if (!d.moved) A.hist.pop(); else { persist(); refreshParts(); } refreshProps(); redraw(); return; }
        if (!d.moved && d.b === 0) { if (A.place) { placeAt(A.place, hitAt(x, y)); return; } select(keyOf(hitAt(x, y))); }
      };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { drag = null; A.gzInfo = ''; });
      cv.addEventListener('pointerleave', () => { if (A.hov || A.gzHot) { A.hov = null; A.gzHot = null; schedule(); } });
      cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2 - A.cam.ox, y = e.clientY - r.top - r.height / 2 - A.cam.oy, s = e.deltaY < 0 ? 1.15 : 1 / 1.15; A.cam.k *= s; A.cam.ox -= x * (s - 1); A.cam.oy -= y * (s - 1); schedule(); }, { passive: false });
      cv.addEventListener('keydown', e => { const c = A.cam; if (e.key === 'ArrowLeft') c.yaw += 0.1; else if (e.key === 'ArrowRight') c.yaw -= 0.1; else if (e.key === 'ArrowUp') c.pitch = Math.min(1.55, c.pitch + 0.1); else if (e.key === 'ArrowDown') c.pitch = Math.max(-1.55, c.pitch - 0.1); else if (e.key === 'f') c.k = null; else if (e.key === '+' || e.key === '=') c.k *= 1.2; else if (e.key === '-') c.k /= 1.2; else return; e.preventDefault(); redraw(); });
      // drag and drop from the toolbox
      cv.addEventListener('dragover', e => { if (!A.dragTool) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; A.drop = { tool: A.dragTool, hit: hitAt(x, y), pt: [x, y] }; schedule(); });
      cv.addEventListener('dragleave', () => { A.drop = null; schedule(); });
      cv.addEventListener('drop', e => { e.preventDefault(); const tool = A.dragTool || (e.dataTransfer && e.dataTransfer.getData('text/plain')); const r = cv.getBoundingClientRect(); A.dragTool = null; A.drop = null; if (TOOLS[tool]) placeAt(tool, hitAt(e.clientX - r.left, e.clientY - r.top)); });
    }
    function refreshProps() { const p = $('#cnProps'); if (p) p.innerHTML = propsHTML(); }
    function setView(v) { const c = A.cam; ({ '3d': () => { c.yaw = -0.95; c.pitch = 0.38; }, front: () => { c.yaw = -Math.PI / 2; c.pitch = 0; }, top: () => { c.yaw = -Math.PI / 2; c.pitch = 1.5; }, side: () => { c.yaw = 0; c.pitch = 0; } })[v](); c.k = null; redraw(); }

    // ------------------------------------------------------------------ FE run (worker when possible)
    let worker = null, wfail = false, jobId = 0;
    function getWorker() {
      if (wfail || !G.Worker) return null; if (worker) return worker;
      try { worker = new G.Worker('connworker.js'); worker.onerror = () => { wfail = true; worker = null; }; return worker; } catch (e) { wfail = true; return null; }
    }
    function calc() {
      if (A.busy) return; if (!A.g) { toast(A.err || T('Nothing to calculate.', 'ไม่มีข้อมูล'), 'bad'); return; }
      const J = JSON.parse(JSON.stringify(A.J)), les = J.loads.map(l => l.id), id = ++jobId, t0 = Date.now(); let left = les.length;
      A.busy = true; A.fe = {}; A.fec = {}; A.feErr = {}; A.prog = T('Meshing and solving ', 'สร้างเมชและคำนวณ ') + les[0] + '…'; A.drawer = 'fe'; refreshParts();
      const done = (le, msg) => {
        if (id !== jobId) return;
        if (msg.ok) { A.fe[le] = msg.res; A.fec[le] = msg.checks; } else A.feErr[le] = msg.err;
        left--; A.prog = left ? T('Solving ', 'กำลังคำนวณ ') + les[les.length - left] + '…' : '';
        if (!left) { A.busy = false; if (A.disp === 'model' && Object.keys(A.fe).length) A.disp = 'vm'; const w = les.map(l => A.fec[l] ? Math.max(...A.fec[l].map(c => c.util), 0) : 0), errs = les.filter(l => A.feErr[l]);
          toast(errs.length ? T('FE analysis failed for ', 'การวิเคราะห์ล้มเหลวสำหรับ ') + errs.join(', ') + ': ' + A.feErr[errs[0]] : T('CBFEM done in ', 'คำนวณ CBFEM เสร็จใน ') + f((Date.now() - t0) / 1000, 1) + ' s — ' + T('governing utilisation ', 'อัตราส่วนสูงสุด ') + f(Math.max(...w) * 100, 0) + ' %', errs.length ? 'bad' : Math.max(...w) > 1.0005 ? 'bad' : 'ok');
          ctx.render(); }
        else refreshParts();
      };
      const local = () => { let i = 0; const step = () => { if (id !== jobId) return; const le = les[i++]; if (le == null) return; const l = J.loads.find(q => q.id === le); try { const g = C.build(J), r = C.fe.run(J, g, l); if (!r.ok) done(le, { ok: false, err: r.err }); else done(le, { ok: true, res: r, checks: C.fe.checks(J, g, r, l) }); } catch (e) { done(le, { ok: false, err: String(e && e.message || e) }); } setTimeout(step, 20); }; setTimeout(step, 40); };
      const w = getWorker();
      if (!w) { local(); return; }
      let got = false; const tm = setTimeout(() => { if (!got) { wfail = true; try { w.terminate(); } catch (e) { } worker = null; local(); } }, 4000);
      w.onmessage = e => { const m = e.data; if (m.id !== id) return; if (m.ready) { got = true; clearTimeout(tm); return; } got = true; clearTimeout(tm); if (m.le) done(m.le, m); };
      w.onerror = () => { clearTimeout(tm); wfail = true; worker = null; if (!got) local(); else { les.filter(l => !A.fe[l] && !A.feErr[l]).forEach(l => done(l, { ok: false, err: T('The analysis stopped unexpectedly.', 'การวิเคราะห์หยุดกลางคัน') })); } };
      w.postMessage({ id, J, les });
    }

    // ------------------------------------------------------------------ report
    function renderReport() {
      if (!isPro()) { toast(T('The connection report is a Pro feature.', 'รายงานรอยต่อสำหรับสมาชิก Pro'), 'bad'); return; }
      const J = A.J, Ty = C.TYPES[J.type], CD = C.CODES[J.code], Mt = S.meta || {}, g = A.g; if (!g) return;
      const tbl = (head, rows) => `<table class="rp-t an-rp"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(rw => `<tr>${rw.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      const sec = (n, title, html) => `<section class="rp-sec"><h3><span class="rp-n">${n}</span>${title}</h3>${html}</section>`;
      const fig = (disp, cap) => `<figure class="an-fig"><img src="${snapshot(disp, 760, 430)}" alt="${esc(cap)}" style="width:100%;max-width:760px;border:1px solid #dde3ec;border-radius:6px"><figcaption>${cap}</figcaption></figure>`;
      const keepLE = A.le;
      const st = C.steel(J.mat.steel, 16);
      let html = sec(1, T('Joint', 'รอยต่อ'), `<p class="rp-txt">${esc(J.name || '')} — ${T(Ty.n[0], Ty.n[1])}. ${T('Design to', 'ออกแบบตาม')} ${esc(CD.full)}.</p>` + fig('model', T('Joint geometry', 'รูปทรงรอยต่อ')) +
        tbl([T('Member', 'ชิ้นส่วน'), T('Section', 'หน้าตัด'), T('Role', 'บทบาท')], g.members.map(m => [esc(m.name), esc(m.s.name || m.s.kind), m.role === 'bearing' ? T('supported', 'ยึดรองรับ') : T('loaded', 'รับแรง')])) +
        tbl([T('Material', 'วัสดุ'), T('Grade', 'ชั้นคุณภาพ'), T('Properties', 'คุณสมบัติ')], [[T('Steel', 'เหล็ก'), esc(J.mat.steel), 'f<sub>y</sub> = ' + st.fy + ' MPa, f<sub>u</sub> = ' + st.fu + ' MPa (t ≤ 16 mm)'], [T('Bolts', 'สลัก'), esc(J.mat.bolt), ''], [T('Weld metal', 'ลวดเชื่อม'), esc(J.mat.weld), '']].concat(J.type === 'base' ? [[T('Concrete', 'คอนกรีต'), esc(J.mat.conc) + ' MPa', ''], [T('Anchors', 'สลักยึด'), esc(J.mat.anchor), '']] : [])));
      html += sec(2, T('Operations and parameters', 'การดำเนินการและพารามิเตอร์'), tbl([T('Group', 'กลุ่ม'), T('Parameter', 'พารามิเตอร์'), T('Value', 'ค่า')], OPS_().flatMap(o => opKeys(o[0]).map(k => [o[1], T(PL[k][0], PL[k][1]), esc(String(J.p[k])) + (PL[k][2] && PL[k][3] == null ? ' ' + PL[k][2] : '')]))) +
        tbl([T('Item', 'รายการ'), T('Count', 'จำนวน'), T('Detail', 'รายละเอียด')], [[T('Plates', 'แผ่น'), g.plates.filter(p => p.role !== 'member').length, esc(g.plates.filter(p => p.role !== 'member').map(p => p.id + ' t' + p.t).join(', '))], [T('Bolts', 'สลัก'), g.bolts.length, g.bolts[0] ? esc(g.bolts[0].B.size + ' ' + J.mat.bolt) : ''], [T('Welds', 'รอยเชื่อม'), g.welds.length, esc(g.welds.map(w => w.id + (w.type === 'butt' ? ' CJP' : ' a' + w.a_)).join(', '))]].concat(g.anchors.length ? [[T('Anchors', 'สลักยึด'), g.anchors.length, esc(g.anchors[0].B.size + ' ' + J.mat.anchor)]] : [])));
      const uo = J.ops || [], so = J.so || {};
      if (uo.length || +so.dx || +so.dy || +so.dz) {
        const v3 = v => (v || []).map(x => f(x, 0)).join(', '), desc = o => o.kind === 'plate' ? f(o.w, 0) + ' × ' + f(o.h, 0) + ' × ' + f(o.t, 0) + ' mm, ' + T('centre', 'ศูนย์กลาง') + ' (' + v3(o.o) + ')' : o.kind === 'member' ? esc(secName(o.sec)) + ', L = ' + f(o.L, 0) + ' mm, ' + T('from', 'จาก') + ' (' + v3(o.o) + ') ' + T('along', 'ตามทิศ') + ' (' + (o.x || []).map(x => f(x, 2)).join(', ') + '), ' + (o.end === 'supported' ? T('far end supported', 'ปลายไกลยึดแน่น') : T('far end free', 'ปลายไกลอิสระ')) : o.kind === 'weld' ? esc(o.a + ' → ' + o.b) + ', ' + (o.type === 'butt' ? T('butt', 'ชนเต็ม') : 'a = ' + f(o.a_, 0) + ' mm') + (o.all ? T(', all round', ', รอบ') : '') : o.nr + ' × ' + o.nc + ' ' + esc(o.size) + T(' through ', ' ผ่าน ') + esc(o.host) + ', p = ' + f(o.p, 0) + ', g = ' + f(o.gg, 0) + ' mm';
        html += sec('2a', T('Setting out and added parts', 'การวางตำแหน่งและชิ้นส่วนที่เพิ่ม'), ((+so.dx || +so.dy || +so.dz) ? `<p class="rp-txt">${T('Setting out', 'การวางตำแหน่ง')}: ${J.type === 'base' ? 'e<sub>x</sub> = ' + f(+so.dx || 0, 0) + ' mm, e<sub>y</sub> = ' + f(+so.dy || 0, 0) + ' mm' : 'e<sub>y</sub> = ' + f(+so.dy || 0, 0) + ' mm, e<sub>z</sub> = ' + f(+so.dz || 0, 0) + ' mm'} — ${T('included in CBFEM; the component method uses the centred layout.', 'รวมใน CBFEM ส่วนวิธีชิ้นส่วนใช้ตำแหน่งกึ่งกลาง')}</p>` : '') +
          (uo.length ? tbl([T('Item', 'รายการ'), T('Type', 'ชนิด'), T('Description', 'รายละเอียด')], uo.map(o => [esc(o.id + (o.name ? ' ' + o.name : '')), { plate: T('plate', 'แผ่น'), member: T('member', 'ชิ้นส่วน'), weld: T('weld', 'รอยเชื่อม'), bolts: T('bolts', 'สลัก') }[o.kind], desc(o)])) + `<p class="rp-txt">${T('Parts added in the workspace are included in the CBFEM model and checked there; the component method covers the standard parts only.', 'ชิ้นส่วนที่เพิ่มในพื้นที่ทำงานรวมอยู่ในแบบจำลอง CBFEM และตรวจสอบในนั้น วิธีชิ้นส่วนครอบคลุมเฉพาะชิ้นส่วนมาตรฐาน')}</p>` : '') +
          (g.notes.length ? g.notes.map(n => `<p class="rp-txt ${n.bad ? 'bad' : ''}">${n.bad ? '⚠ ' : ''}${esc(T(n.en, n.th))}</p>`).join('') : ''));
      }
      html += sec(3, T('Load effects', 'แรงกระทำ'), `<p class="rp-txt">${T('Internal forces of the loaded member at the joint face (N + tension, V_z + down, M_y + hogging).', 'แรงภายในของชิ้นส่วนที่ผิวรอยต่อ (N + ดึง, V_z + ลง, M_y + โมเมนต์ลบ)')}</p>` + tbl([T('Load effect', 'แรง'), T('Name', 'ชื่อ'), 'N (kN)', 'V<sub>z</sub> (kN)', 'V<sub>y</sub> (kN)', 'M<sub>x</sub> (kNm)', 'M<sub>y</sub> (kNm)', 'M<sub>z</sub> (kNm)'], J.loads.map(l => [esc(l.id), esc(l.name || ''), f(+l.N || 0, 1), f(+l.Vz || 0, 1), f(+l.Vy || 0, 1), f(+l.Mx || 0, 1), f(+l.My || 0, 1), f(+l.Mz || 0, 1)])));
      const sumRows = J.loads.map(l => { const fe = A.fec[l.id], cm = A.cm[l.id]; return [esc(l.id), fe ? uTag(Math.max(...fe.map(c => c.util), 0)) : '—', cm ? uTag(cm.util) : '—', fe ? (Math.max(...fe.map(c => c.util), 0) <= 1.0005 && (!cm || cm.util <= 1.0005) ? '<b class="ok">OK</b>' : '<b class="bad">NG</b>') : cm ? (cm.util <= 1.0005 ? '<b class="ok">OK</b>' : '<b class="bad">NG</b>') : '']; });
      html += sec(4, T('Summary', 'สรุปผล'), tbl([T('Load effect', 'แรง'), 'CBFEM', T('Component method', 'วิธีชิ้นส่วน'), T('Status', 'สถานะ')], sumRows) + `<p class="rp-txt">${T('CBFEM: plates are modelled with layered shell elements (elastic – plastic steel, von Mises), bolts and anchors as springs (tension only in the axial direction, bearing / shear with plastic caps), welds as elastic – plastic ties along the weld lines and contact between plates as compression-only springs. Plates are checked against a 5 % plastic strain limit (EN 1993-1-5 Annex C); bolts, welds and anchors are checked to the standard with the forces taken from the model. The component method results are given for comparison.', 'CBFEM: แผ่นเหล็กจำลองด้วยเอลิเมนต์เปลือกแบบชั้น (เหล็กยืดหยุ่น–พลาสติก ฟอนมิสเซส) สลักและสลักยึดเป็นสปริง (แรงดึงอย่างเดียวตามแกน แรงแบก/แรงเฉือนมีขีดจำกัดพลาสติก) รอยเชื่อมเป็นตัวยึดยืดหยุ่น–พลาสติกตามแนวเชื่อม และการสัมผัสระหว่างแผ่นเป็นสปริงรับแรงอัดอย่างเดียว แผ่นเหล็กตรวจสอบกับขีดจำกัดความเครียดพลาสติก 5 % สลัก รอยเชื่อม และสลักยึดตรวจสอบตามมาตรฐานด้วยแรงจากแบบจำลอง ผลจากวิธีชิ้นส่วนแสดงเพื่อเปรียบเทียบ')}</p>`);
      let n = 5;
      J.loads.forEach(l => {
        A.le = l.id; const fe = A.fec[l.id], cm = A.cm[l.id], fr = A.fe[l.id];
        let h = '';
        if (fe && fr) h += `<p class="rp-txt">${sumLine(fe, fr)}</p>` + fig('vm', T('Equivalent stress σ_eq, ', 'หน่วยแรงเทียบเท่า σ_eq, ') + esc(l.id)) + repChecks(fe);
        else h += `<p class="rp-txt">${A.feErr[l.id] ? esc(A.feErr[l.id]) : T('CBFEM not run for this load effect — press Calculate before opening the report.', 'ยังไม่ได้คำนวณ CBFEM สำหรับแรงนี้ — กดคำนวณก่อนเปิดรายงาน')}</p>`;
        if (cm && cm.checks.length) h += `<h4>${T('Component method', 'วิธีชิ้นส่วน')} — ${esc(CD.full)}</h4>` + repChecks(cm.checks);
        html += sec(n++, T('Checks — ', 'การตรวจสอบ — ') + esc(l.id + ' ' + (l.name || '')), h);
      });
      A.le = keepLE;
      $('#reportWrap').innerHTML = `<div class="rp-bar"><h2>${T('Steel connection report', 'รายงานการออกแบบรอยต่อเหล็ก')}</h2>
        <div class="rp-meta">${[['project', T('Project', 'โครงการ')], ['job', T('Job no.', 'เลขที่งาน')], ['ref', T('Joint ref.', 'ชื่อรอยต่อ')], ['by', T('Designed by', 'ผู้ออกแบบ')], ['checked', T('Checked by', 'ผู้ตรวจสอบ')]].map(([k2, l]) => `<label>${l}<input id="meta-${k2}" data-meta="${k2}" value="${esc(Mt[k2] || '')}"></label>`).join('')}</div>
        <div class="rp-btns"><button class="btn btn-hot sm" data-act="pdf" id="pdfBtn">${T('Export PDF', 'ส่งออก PDF')}</button><button class="btn btn-ghost sm" data-act="closeReport">${T('Close', 'ปิด')}</button></div></div>
        <article class="report" id="report" lang="${S.ui}">
          <header class="rp-head"><div class="rp-brand">${logoMark(34)}<div><b>StructCap</b><small>${T('Steel connection design · ', 'ออกแบบรอยต่อเหล็ก · ') + esc(CD.name)}</small></div></div>
            <table class="rp-hd"><tr><th>${T('Project', 'โครงการ')}</th><td id="rv-project">${esc(Mt.project || '')}</td><th>${T('Job no.', 'เลขที่งาน')}</th><td id="rv-job">${esc(Mt.job || '')}</td></tr>
            <tr><th>${T('Joint', 'รอยต่อ')}</th><td>${esc(J.name || '')} · <span id="rv-ref">${esc(Mt.ref || '')}</span></td><th>${T('Date', 'วันที่')}</th><td>${today()}</td></tr>
            <tr><th>${T('Designed', 'ออกแบบ')}</th><td id="rv-by">${esc(Mt.by || '')}</td><th>${T('Checked', 'ตรวจสอบ')}</th><td id="rv-checked">${esc(Mt.checked || '')}</td></tr></table></header>
          ${html}
          <p class="rp-foot"><b>${COPY}</b> · ${T('Generated by StructCap. Units kN, kNm, mm, MPa. The engineer remains responsible for the joint model, loads and interpretation of results.', 'จัดทำโดย StructCap หน่วย kN, kNm, มม., MPa วิศวกรต้องรับผิดชอบต่อแบบจำลองรอยต่อ แรง และการตีความผลลัพธ์')}</p>
        </article>`;
      S.reportOpen = true; const w = $('#reportWrap'); if (w) w.scrollIntoView({ behavior: 'smooth' });
    }
    function repChecks(list) { return `<table class="rp-t an-rp"><thead><tr><th>${T('Item', 'รายการ')}</th><th>${T('Check', 'การตรวจสอบ')}</th><th>${T('Action', 'แรงกระทำ')}</th><th>${T('Resistance', 'กำลังต้านทาน')}</th><th>${T('Util.', 'อัตราส่วน')}</th><th>${T('Reference', 'อ้างอิง')}</th></tr></thead><tbody>${list.map(c => `<tr><td>${esc(c.item)}</td><td>${esc(c.name)}${c.expr ? `<br><small>${esc(c.expr)}</small>` : ''}</td><td>${c.Ed == null ? '' : f(valOf(c, c.Ed), 1) + ' ' + esc(unitOf(c))}</td><td>${c.Rd == null ? '' : f(valOf(c, c.Rd), 1) + ' ' + esc(unitOf(c))}</td><td class="${c.util > 1.0005 ? 'bad' : ''}">${f(c.util * 100, 1)} %</td><td><small>${esc(c.ref || '')}</small></td></tr>`).join('')}</tbody></table>`; }

    // ------------------------------------------------------------------ events
    function mount() {
      const cv = $('#cnCv'); if (!cv) return;
      if (!cv._b) { cv._b = true; bindCanvas(cv); if (G.ResizeObserver) { let raf = 0; new G.ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (cv.isConnected) redraw(); }); }).observe(cv); } }
      redraw(); bindKeys();
    }
    let keysBound = false;
    function bindKeys() {
      if (keysBound) return; keysBound = true;
      document.addEventListener('keydown', e => {
        if (S.view !== VIEW || !$('#cnCv')) return; const tg = e.target, typing = tg && /INPUT|SELECT|TEXTAREA/.test(tg.tagName);
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); calc(); return; }
        if (typing) return;
        if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(e.shiftKey); return; }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); undo(true); return; }
        if (e.key === 'Escape') { if (A.gallery) { A.gallery = false; ctx.render(); } else if (A.place) setPlace(null); else if (A.hl) { A.hl = null; A.sel = 'joint'; refreshProps(); redraw(); } }
        if ((e.key === 'Delete' || e.key === 'Backspace') && A.hl && A.hl.startsWith('u:')) { e.preventDefault(); delOp(A.hl.slice(2)); }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D') && A.hl && A.hl.startsWith('u:')) { e.preventDefault(); dupOp(A.hl.slice(2)); }
      });
      // toolbox drag and drop (the drop is handled on the canvas)
      document.addEventListener('dragstart', e => { const t = e.target && e.target.closest && e.target.closest('.cn-tool, [data-tool]'); if (!t || S.view !== VIEW) return; const tool = t.dataset.v && TOOLS[t.dataset.v] ? t.dataset.v : t.dataset.tool; if (!TOOLS[tool]) return; A.dragTool = tool; A.place = null; try { e.dataTransfer.setData('text/plain', tool); e.dataTransfer.effectAllowed = 'copy'; } catch (er) { } });
      document.addEventListener('dragend', () => { if (A.dragTool || A.drop) { A.dragTool = null; A.drop = null; schedule(); } });
      document.addEventListener('change', e => { const t = e.target; if (S.view !== VIEW || !t || t.id !== 'cn-file') return; const fl = t.files[0]; if (!fl) return;
        fl.text().then(txt => { try { const j = JSON.parse(txt), J = j.J || j; if (!J || !C.TYPES[J.type] || !J.mem || !J.p) throw 0; snap(); A.J = J; A.cam.k = null; rebuild(); persist(); ctx.render(); toast(T('Joint opened', 'เปิดรอยต่อแล้ว'), 'ok'); } catch (er) { toast(T('That file is not a StructCap joint.', 'ไฟล์นี้ไม่ใช่ไฟล์รอยต่อ StructCap'), 'bad'); } }); });
    }
    function setPath(path, val, t) {
      const J = A.J, ps = path.split('.');
      if (ps[0] === 'name') { J.name = val; return 'soft'; }
      if (ps[0] === 'type') { setType(val); return 'done'; }
      if (ps[0] === 'code') { setCode(val); return 'done'; }
      if (ps[0] === 'fe') { J.fe = J.fe || {}; J.fe.mesh = val; return 'fe'; }
      if (ps[0] === 'mat') { J.mat[ps[1]] = ps[1] === 'conc' ? +val : val; return 'full'; }
      if (ps[0] === 'p') { const k = ps[1], d = PL[k] || []; J.p[k] = d[3] === 'chk' ? !!t.checked : d[3] === 'sel' && d[4] !== 'bolt' && k !== 'na' ? val : d[3] === 'text' || d[3] === 'sel' ? (k === 'na' ? +val : val) : (val === '' ? 0 : +val); return 'geo'; }
      if (ps[0] === 'uo') { const op = opById(ps[1]); if (!op) return null; const q = ps[2];
        if (q === 'name') { op.name = val; return 'soft'; }
        if (q === 'o') { op.o[+ps[3]] = val === '' ? 0 : +val; return 'geo'; }
        if (q === 'sec') { const r = setSec(op, 'sec', ps[3], val, 'beam'); return r === 'geo' ? 'geo' : 'geoP'; }
        if (q === 'all') { op.all = !!t.checked; return 'geoP'; }
        if (q === 'sides') { op.sides = +val; return 'geoP'; }
        if (['a', 'b', 'host', 'end', 'type', 'size'].includes(q)) { op[q] = val; return 'geoP'; }
        op[q] = val === '' ? 0 : +val; return 'geo'; }
      if (ps[0] === 'so') { J.so = J.so || {}; J.so[ps[1]] = val === '' ? 0 : +val; return 'geo'; }
      if (ps[0] === 'mem') return setSec(J.mem, ps[1], ps[2], val, ps[1]);
      if (ps[0] === 'load') return setPathRest(ps, val);
      return null;
    }
    function setSec(holder, key, q, val, role) {
      const J = A.J, s = holder[key], ps = [null, role];
      {
        if (q === 'kind') { holder[key] = val === 'I' ? { kind: 'I', lib: { AS: ps[1] === 'col' ? 'UC' : 'UB', EN: ps[1] === 'col' ? 'HEB' : 'IPE', AISC: 'H' }[J.code], size: '' } : val === 'BU' ? { kind: 'BU', d: 400, bf: 200, tf: 16, tw: 10 } : val === 'L' ? { kind: 'L', b1: 100, b2: 100, t: 10 } : { kind: val, size: (G.GANTRY.sizeOptions(val)[Math.floor(G.GANTRY.sizeOptions(val).length / 2)] || [''])[0] };
          if (val === 'I') { const sz = G.STEELLIB.sizes(holder[key].lib); holder[key].size = sz[Math.floor(sz.length / 2)]; } return 'props'; }
        if (q === 'lib') { s.lib = val; const sz = G.STEELLIB.sizes(val); s.size = sz[Math.floor(sz.length / 2)]; return 'props'; }
        s[q] = q === 'size' ? val : val === '' ? 0 : +val; return q === 'size' ? 'props' : 'geo'; }
    }
    function setPathRest(ps, val) {
      const J = A.J;
      if (ps[0] === 'load') { const l = J.loads[+ps[1]]; if (!l) return; l[ps[2]] = ps[2] === 'name' ? val : val === '' ? 0 : +val; return ps[2] === 'name' ? 'soft' : 'load'; }
      return null;
    }
    function onInput(t) {
      if (!t.closest('.cn-app')) return false;
      if (t.id === 'cn-le') { A.le = t.value; refreshParts(); refreshProps(); return true; }
      if (t.id === 'cn-file') return true;
      const path = t.dataset.cp; if (!path) return false;
      if (!A._snapT || Date.now() - A._snapT > 800) snap(); A._snapT = Date.now();
      const r = setPath(path, t.type === 'checkbox' ? t.checked : t.value, t);
      if (r === 'done') return true;
      if (r === 'soft') { persist(); const s = $('#cnTree'); if (s) s.innerHTML = treeHTML(); const st = $('#cnStat'); if (st) st.innerHTML = statHTML(); return true; }
      if (r === 'fe') { A.fe = {}; A.fec = {}; A.feErr = {}; persist(); refreshParts(); return true; }
      if (r === 'props') { A.cam.k = null; changed(); refreshProps(); return true; }
      if (r === 'load') { const keepLE = A.le; rebuild(); A.le = keepLE; persist(); refreshParts(); return true; }
      if (r) { if (r === 'geo') { const keep = A.cam.k; rebuild(); A.cam.k = keep; } else rebuild(); persist(); refreshParts(); if (t.tagName === 'SELECT' || t.type === 'checkbox') refreshProps(); return true; }
      return true;
    }
    function newLE(copyOf) { const J = A.J; let k = J.loads.length + 1; while (J.loads.some(l => l.id === 'LE' + k)) k++; const src = copyOf || { N: 0, Vy: 0, Vz: 0, Mx: 0, My: 0, Mz: 0 }; const l = Object.assign({}, src, { id: 'LE' + k, name: copyOf ? (copyOf.name || '') + T(' (copy)', ' (สำเนา)') : T('New load effect', 'แรงใหม่') }); J.loads.push(l); return l; }
    function ribCmd(c, v) {
      if (c === 'new') { A.gallery = true; ctx.render(); return; }
      if (c === 'save' || c === 'json') { persist(); const name = (A.J.name || 'joint').replace(/[^\w\-]+/g, '_') + '_' + A.J.type + '_' + A.J.code + '.json'; saveFile(name, new Blob([JSON.stringify({ app: 'StructCap Connection', v: 1, J: A.J }, null, 1)], { type: 'application/json' })); return; }
      if (c === 'undo') { undo(false); return; } if (c === 'redo') { undo(true); return; }
      if (c === 'code') { setCode(v); return; }
      if (c === 'type') { setType(v); return; }
      if (c === 'pick') { A.sel = v; A.hl = null; const k = v.split(':')[0]; if (k === 'mem') A.open.mem = true; if (k === 'op') A.open.op = true; refreshProps(); const s = $('#cnTree'); if (s) s.innerHTML = treeHTML(); ribRefresh(); redraw(); return; }
      if (c === 'addle') { snap(); const l = newLE(); A.le = l.id; A.sel = 'le:' + l.id; rebuild(true); persist(); ctx.render(); return; }
      if (c === 'dupLE') { snap(); const l = newLE(A.J.loads.find(q => q.id === v)); A.le = l.id; A.sel = 'le:' + l.id; rebuild(true); persist(); ctx.render(); return; }
      if (c === 'delLE') { if (A.J.loads.length < 2) return; snap(); A.J.loads = A.J.loads.filter(l => l.id !== v); delete A.fe[v]; delete A.fec[v]; if (A.le === v) A.le = A.J.loads[0].id; A.sel = 'les'; rebuild(true); persist(); ctx.render(); return; }
      if (c === 'calc') { calc(); return; }
      if (c === 'mesh') { snap(); A.J.fe = A.J.fe || {}; A.J.fe.mesh = v; A.fe = {}; A.fec = {}; A.feErr = {}; persist(); refreshParts(); return; }
      if (c === 'disp') { A.disp = v; if (v !== 'model' && !Object.keys(A.fe).length) toast(T('Run Calculate (CBFEM) first to see FE results.', 'กดคำนวณ (CBFEM) ก่อนเพื่อดูผล FE'), ''); ribRefresh(); redraw(); return; }
      if (c === 'deform') { A.def = !A.def; ribRefresh(); redraw(); return; }
      if (c === 'report') { renderReport(); return; }
      if (c === 'view') { setView(v); return; }
      if (c === 'fit') { A.cam.k = null; redraw(); return; }
      if (c === 'lay') { A.lay[v] = !A.lay[v]; persist(); ribRefresh(); redraw(); return; }
      if (c === 'tool') { setPlace(A.place === v ? null : v); return; }
      if (c === 'dupOp') { dupOp(v); return; }
      if (c === 'delOp') { delOp(v); return; }
      if (c === 'soReset') { snap(); A.J.so = {}; const keep = A.cam.k; rebuild(); A.cam.k = keep; persist(); refreshParts(); refreshProps(); return; }
    }
    function setPlace(v) { A.place = v; A.hl = v ? null : A.hl; const tr = $('.cn-tools'); if (tr) tr.outerHTML = toolsHTML(); ribRefresh(); const cv = $('#cnCv'); if (cv) { cv.style.cursor = v ? 'crosshair' : 'grab'; cv.focus(); } redraw(); }
    function rotBtn(id, ax, d) {
      const op = opById(id); if (!op) return; const a = opAxes(op).find(q => q.lab === ax); if (!a) return; snap(); rotateOp(op, JSON.parse(JSON.stringify(op)), a.v, d, a);
      const keep = A.cam.k; rebuild(); A.cam.k = keep; persist(); refreshParts(); refreshProps();
    }
    function onClick(a, b) {
      if (a === 'cn-rb') { ribCmd(b.dataset.c, b.dataset.v); return true; }
      if (a === 'cn-tool') { setPlace(A.place === b.dataset.v ? null : b.dataset.v); return true; }
      if (a === 'cn-rot') { rotBtn(b.dataset.v, b.dataset.ax, +b.dataset.d); return true; }
      if (a === 'cn-notes') { A.notesOpen = !A.notesOpen; const nt = $('#cnNotes'); if (nt) nt.innerHTML = notesHTML(); return true; }
      if (a === 'cn-ribtab') { A.rib = b.dataset.t; ribRefresh(); return true; }
      if (a === 'cn-sel') { const k = b.dataset.k; if (k.startsWith('u:')) { select(k); return true; } A.sel = k; A.hl = null; if (k.startsWith('le:')) { A.le = k.slice(3); const d = $('#cnDrawer'); if (d) d.innerHTML = drawerHTML(); const st = $('#cnStat'); if (st) st.innerHTML = statHTML(); } if (k.startsWith('res:')) A.drawer = 'fe'; if (k.startsWith('cm:')) A.drawer = 'cm'; refreshProps(); const s = $('#cnTree'); if (s) s.innerHTML = treeHTML(); const d = $('#cnDrawer'); if (d) d.innerHTML = drawerHTML(); ribRefresh(); redraw(); return true; }
      if (a === 'cn-tog') { const k = b.dataset.k; A.open[k] = !A.open[k]; const s = $('#cnTree'); if (s) s.innerHTML = treeHTML(); return true; }
      if (a === 'cn-hl') { A.hl = A.hl === b.dataset.k ? null : b.dataset.k; refreshProps(); const d = $('#cnDrawer'); if (d) d.innerHTML = drawerHTML(); redraw(); return true; }
      if (a === 'cn-dtab') { A.drawer = b.dataset.v; A.drawerMin = false; const d = $('#cnDrawer'); if (d) { d.classList.remove('min'); d.innerHTML = drawerHTML(); } return true; }
      if (a === 'cn-dmin') { A.drawerMin = !A.drawerMin; const d = $('#cnDrawer'); if (d) { d.classList.toggle('min', A.drawerMin); d.innerHTML = drawerHTML(); } redraw(); return true; }
      if (a === 'cn-le') { A.le = b.dataset.v; refreshParts(); refreshProps(); return true; }
      if (a === 'cn-galclose') { const ev = G.event; if (b.classList.contains('cn-galbg') && ev && ev.target && ev.target.closest && ev.target.closest('.cn-gal')) return true; A.gallery = false; ctx.render(); return true; }
      return false;
    }
    rebuild();
    const api = { view, mount, onClick, onInput, state: A, calc, rebuild, renderReport, pick: (x, y) => { const h = hitAt(x, y); return h ? { key: keyOf(h), raw: h.key } : null; }, screenOf: q => { const cv = $('#cnCv'); return cv ? projector(camNow(cv.clientWidth, cv.clientHeight))(q).slice(0, 2) : null; } };
    api.gizmo = () => (GZ ? GZ.hs.map(h => ({ kind: h.kind, lab: h.a.lab, c: h.c, tip: h.tip, p: h.pts ? h.pts[9] : null })) : null);
    G.SC_CONN_API = api; // used by the browser tests
    return api;
  };
})(typeof window !== 'undefined' ? window : globalThis);
