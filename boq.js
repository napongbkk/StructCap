/* StructCap BOQ — bill of quantities for a steel portal-frame warehouse / factory building.
   Parametric take-off: site, piled pad footings and pedestals, tie beams, slab on grade, steel frames (H sections),
   purlins and girts (cold-formed lipped channels), bracing, roof and wall cladding, block walls, doors, gutters and drains.
   Every quantity keeps the arithmetic that produced it ("calc"), so the BOQ can be checked line by line.
   Unit prices are SAMPLE prices (THB, material + labour) for editing — they are not an official price list.
   Units: m, m², m³, kg, no. */
(function (G) {
  'use strict';
  const PI = Math.PI, max = Math.max, min = Math.min, ceil = Math.ceil, round = Math.round;
  const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
  const n2 = v => (Math.round(v * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const n3 = v => (Math.round(v * 1000) / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 });

  // ------------------------------------------------------------------ steel sections
  // Hot-rolled H sections (TIS 1227 / JIS sizes): h, b, tw, tf (mm), mass kg/m. Painted surface per metre computed from the outline.
  const HSEC = {
    'H100x100': [100, 100, 6, 8, 17.2], 'H125x125': [125, 125, 6.5, 9, 23.8], 'H150x75': [150, 75, 5, 7, 14.0], 'H150x150': [150, 150, 7, 10, 31.5],
    'H175x175': [175, 175, 7.5, 11, 40.2], 'H200x100': [200, 100, 5.5, 8, 21.3], 'H194x150': [194, 150, 6, 9, 30.6], 'H200x200': [200, 200, 8, 12, 49.9],
    'H250x125': [250, 125, 6, 9, 29.6], 'H244x175': [244, 175, 7, 11, 44.1], 'H250x250': [250, 250, 9, 14, 72.4], 'H300x150': [300, 150, 6.5, 9, 36.7],
    'H294x200': [294, 200, 8, 12, 56.8], 'H300x300': [300, 300, 10, 15, 94.0], 'H350x175': [350, 175, 7, 11, 49.6], 'H340x250': [340, 250, 9, 14, 79.7],
    'H400x200': [400, 200, 8, 13, 66.0], 'H390x300': [390, 300, 10, 16, 107], 'H450x200': [450, 200, 9, 14, 76.0], 'H500x200': [500, 200, 10, 16, 89.6],
    'H600x200': [600, 200, 11, 17, 106]
  };
  const hInfo = k => { const s = HSEC[k] || HSEC['H300x150']; return { h: s[0], b: s[1], tw: s[2], tf: s[3], w: s[4], P: (2 * s[0] + 4 * s[1] - 2 * s[2]) / 1000 }; };
  // cold-formed lipped channels (TIS 1228 sizes) h x b x c x t; mass from the mid-line of the section
  const CSEC = ['C75x45x15x2.3', 'C100x50x20x2.3', 'C100x50x20x3.2', 'C125x50x20x2.3', 'C125x50x20x3.2', 'C150x50x20x2.3', 'C150x50x20x3.2', 'C150x65x20x2.3', 'C150x65x20x3.2', 'C150x75x20x3.2', 'C200x75x20x3.2'];
  const cInfo = k => { const m = /C(\d+)x(\d+)x(\d+)x([\d.]+)/.exec(k) || [0, 150, 50, 20, 2.3], h = +m[1], b = +m[2], c = +m[3], t = +m[4]; const A = t * ((h - t) + 2 * (b - t) + 2 * (c - t / 2)); return { h, b, c, t, A, w: r2(A * 7.85e-3) }; };
  const rodKg = d => PI * d * d / 4 * 7.85e-3; // kg/m for a round bar of d mm

  // ------------------------------------------------------------------ sample unit prices (THB): [material, labour, unit, Thai, English]
  const PRICE = {
    clear: [0, 15, 'ตร.ม.', 'ถางป่า ขุดตอ ปรับพื้นที่', 'Site clearing and levelling'],
    exc: [0, 120, 'ลบ.ม.', 'ขุดดิน', 'Excavation'],
    backfill: [0, 70, 'ลบ.ม.', 'ถมดินกลับบดอัด', 'Backfill and compaction'],
    pile: [380, 110, 'ม.', 'เสาเข็ม', 'Piles (supply and drive)'],
    pilecut: [0, 350, 'ต้น', 'ตัดหัวเข็ม', 'Pile head cut-off'],
    lean: [1750, 400, 'ลบ.ม.', 'คอนกรีตหยาบ 1:3:5', 'Lean concrete 1:3:5'],
    sandbed: [450, 80, 'ลบ.ม.', 'ทรายหยาบรองพื้น', 'Sand bedding'],
    conc: [2350, 450, 'ลบ.ม.', "คอนกรีตโครงสร้าง f'c 240 กก./ตร.ซม. (ทรงกระบอก)", "Structural concrete f'c 240 ksc (cylinder)"],
    form: [280, 150, 'ตร.ม.', 'ไม้แบบ', 'Formwork'],
    rebar: [26, 4.5, 'กก.', 'เหล็กเสริม SD40 / SR24 (รวมลวดผูก)', 'Reinforcement SD40 / SR24 incl. tie wire'],
    abolt: [180, 40, 'ตัว', 'สลักเกลียวยึดฐาน (Anchor bolt) พร้อมแป้นเกลียว แหวน', 'Anchor bolt with nuts and washers'],
    grout: [180, 120, 'จุด', 'เกราท์ไม่หดตัวใต้แผ่นฐาน', 'Non-shrink grout under base plate'],
    fill: [450, 80, 'ลบ.ม.', 'ทรายถมบดอัดใต้พื้น', 'Compacted sand fill under slab'],
    base: [650, 90, 'ลบ.ม.', 'หินคลุกบดอัด', 'Compacted crushed rock base'],
    poly: [15, 3, 'ตร.ม.', 'แผ่นพลาสติกกันความชื้น', 'Polyethylene moisture barrier'],
    mesh: [48, 10, 'ตร.ม.', 'ตะแกรงเหล็กสำเร็จรูป (Wire mesh)', 'Welded wire mesh'],
    sawcut: [25, 15, 'ม.', 'ตัดรอยต่อพื้น และยาแนว', 'Saw-cut joints and sealant'],
    hard: [90, 40, 'ตร.ม.', 'ขัดมันผิวพื้นพร้อมผงเพิ่มความแข็ง (Floor hardener)', 'Power-floated finish with floor hardener'],
    steelH: [32, 10, 'กก.', 'เหล็กรูปพรรณรีดร้อน (H-beam) ประกอบและติดตั้ง', 'Hot-rolled H sections, fabricated and erected'],
    plate: [32, 14, 'กก.', 'แผ่นเหล็กต่อ แผ่นฐาน ครีบ สลักเกลียว', 'Connection plates, base plates, stiffeners and bolts'],
    purlin: [34, 6, 'กก.', 'แป / เคร่า เหล็กรูปพรรณขึ้นรูปเย็น (C-lip)', 'Cold-formed C-lip purlins / girts'],
    rod: [30, 10, 'กก.', 'เหล็กเส้นค้ำยัน / Sag rod พร้อมเกลียวเร่ง', 'Bracing and sag rods with turnbuckles'],
    paint: [45, 35, 'ตร.ม.', 'ทาสีกันสนิม 2 ชั้น และสีจริง 2 ชั้น', 'Primer 2 coats + finish 2 coats'],
    roof047: [285, 60, 'ตร.ม.', 'หลังคาเมทัลชีท หนา 0.47 มม. (TCT)', 'Metal roof sheet 0.47 mm TCT'],
    roof035: [215, 60, 'ตร.ม.', 'หลังคาเมทัลชีท หนา 0.35 มม. (TCT)', 'Metal roof sheet 0.35 mm TCT'],
    roofpu: [470, 70, 'ตร.ม.', 'หลังคาเมทัลชีท 0.47 มม. บุโฟม PU 25 มม.', 'Metal roof sheet 0.47 mm with 25 mm PU foam'],
    blanket: [95, 25, 'ตร.ม.', 'ฉนวนใยแก้วพร้อมแผ่นฟอยล์ใต้หลังคา', 'Glass-wool blanket with foil under roof'],
    sky: [350, 60, 'ตร.ม.', 'แผ่นหลังคาโปร่งแสง (Translucent)', 'Translucent roof sheet'],
    ridge: [220, 40, 'ม.', 'ครอบสันหลังคา', 'Ridge capping'],
    flash: [180, 40, 'ม.', 'แผ่นปิดขอบ / Flashing', 'Flashing and trims'],
    gutter: [450, 120, 'ม.', 'รางน้ำฝนเหล็กอาบสังกะสี', 'Galvanised steel gutter'],
    dpipe: [250, 60, 'ม.', 'ท่อระบายน้ำฝน PVC Ø 4" พร้อมอุปกรณ์', 'PVC Ø100 downpipe with fittings'],
    block: [125, 110, 'ตร.ม.', 'ผนังคอนกรีตบล็อก (รวมปูนก่อ)', 'Concrete block wall incl. mortar'],
    plaster: [70, 120, 'ตร.ม.', 'ฉาบปูนเรียบ', 'Cement plaster'],
    lintel: [180, 150, 'ม.', 'เสาเอ็น / คานทับหลัง คสล. 0.10 x 0.15 ม.', 'RC stiffener posts / lintels 0.10 x 0.15 m'],
    wallsheet: [235, 60, 'ตร.ม.', 'ผนังเมทัลชีท หนา 0.40 มม.', 'Metal wall sheet 0.40 mm'],
    shutter: [2800, 450, 'ตร.ม.', 'ประตูม้วนเหล็ก (Roller shutter) อาบสังกะสี', 'Galvanised steel roller shutter'],
    door: [9500, 1500, 'ชุด', 'ประตูเหล็กบานเดี่ยว 1.00 x 2.10 ม. พร้อมวงกบ อุปกรณ์', 'Steel door 1.00 x 2.10 m with frame and hardware'],
    window: [2500, 500, 'ตร.ม.', 'หน้าต่าง / เกล็ดระบายอากาศอะลูมิเนียม', 'Aluminium windows / louvres'],
    ditch: [1800, 600, 'ม.', 'รางระบายน้ำ คสล. กว้าง 0.30 ม. พร้อมฝาตะแกรง', 'RC drain 0.30 m wide with grating']
  };
  const CATS = [
    ['site', 'งานเตรียมพื้นที่', 'Site preparation'], ['fnd', 'งานฐานราก', 'Foundations'], ['tie', 'งานคานคอดิน', 'Tie beams'],
    ['slab', 'งานพื้น', 'Ground slab'], ['steel', 'งานโครงสร้างเหล็ก', 'Structural steel'], ['roof', 'งานหลังคา', 'Roofing'],
    ['wall', 'งานผนัง', 'Walls'], ['open', 'งานประตู หน้าต่าง', 'Doors and windows'], ['drain', 'งานระบายน้ำ', 'Drainage'], ['extra', 'รายการเพิ่มเติม', 'Additional items']
  ];

  // ------------------------------------------------------------------ default building
  function defaults() {
    return {
      v: 1, meta: { name: 'โกดังเก็บสินค้า', owner: '', location: '', date: '' },
      geo: { W: 30, L: 60, s: 6, H: 8, pitch: 10, spans: 1, eo: 0.3, go: 0.3 },
      frame: { col: 'H350x175', raf: 'H350x175', gcol: 'H200x100', gsp: 6, conn: 12, nb: 4, brace: 2, rodD: 20, sag: true },
      purl: { sec: 'C150x50x20x2.3', sp: 1.0, girt: 'C125x50x20x2.3', gsp: 1.2, lap: 5 },
      roof: { sheet: 'roof047', ins: 'none', sky: 5, gutter: true, dpEvery: 2 },
      wall: { hb: 2.0, sides: 2, sheet: true, win: 0 },
      open: { rsN: 2, rsW: 5, rsH: 5, doorN: 2 },
      fnd: { B: 1.5, Lf: 1.5, D: 0.5, Df: 1.5, c: 0.4, nP: 4, pileL: 12, pileType: 'เสาเข็มสปัน Ø 0.30 ม.', gB: 1.0, gLf: 1.0, gD: 0.4, gNP: 2, rf: 60, rp: 150, lean: 0.05, sand: 0.05 },
      tie: { b: 0.2, h: 0.4, rt: 120, inner: false },
      slab: { t: 0.15, fill: 0.2, base: 0.1, poly: true, mesh: true, rs: 0, joint: 6, hard: true },
      drain: { ditch: true },
      site: { clear: true, margin: 2 },
      price: {}, extra: [],
      oh: { mode: 'pct', F: 1.0, oh: 8, profit: 7, vat: 7 }
    };
  }
  const num = (v, d) => (v === '' || v == null || !isFinite(+v) ? d : +v);

  // ------------------------------------------------------------------ geometry
  function geometry(B) {
    const g = B.geo, W = max(3, num(g.W, 30)), L = max(3, num(g.L, 60)), s0 = max(1, num(g.s, 6)), H = max(2, num(g.H, 8)), th = min(45, max(0, num(g.pitch, 10))) * PI / 180;
    const spans = max(1, min(6, round(num(g.spans, 1)))), a = W / 2, rafter = a / Math.cos(th), rise = a * Math.tan(th);
    const nf = max(2, round(L / s0) + 1), bay = L / (nf - 1);
    const hAt = x => H + rise * (1 - Math.abs(x - a) / a);           // height to the rafter at x across the width
    const inner = []; for (let j = 1; j < spans; j++) inner.push(j * W / spans);
    const gsp = max(2, num(B.frame.gsp, 6)), gx = []; for (let i = 1; i < ceil(W / gsp); i++) { const x = i * W / ceil(W / gsp); if (!inner.some(q => Math.abs(q - x) < 0.5)) gx.push(x); }
    return { W, L, H, th, deg: th * 180 / PI, spans, a, rafter, rise, nf, bay, inner, gx, hAt, eo: max(0, num(g.eo, 0.3)), go: max(0, num(g.go, 0.3)) };
  }

  // ------------------------------------------------------------------ take-off
  function takeoff(B, lang) {
    const th = lang !== 'en', T = (t, e) => (th ? t : e), it = [], G0 = geometry(B), { W, L, H, nf, bay, rafter, rise, inner, gx, hAt } = G0;
    const F = B.frame, P = B.purl, R = B.roof, Wl = B.wall, O = B.open, Fd = B.fnd, Tb = B.tie, S = B.slab;
    const add = (cat, key, qty, calc, o) => { o = o || {}; if (!(qty > 0)) return; it.push({ cat, key, qty: o.r ? round(qty) : r2(qty), unit: o.unit || (PRICE[key] ? PRICE[key][2] : ''), desc: o.desc || (PRICE[key] ? (th ? PRICE[key][3] : PRICE[key][4]) : key), note: o.note || '', calc }); };
    const nColMain = nf * (2 + inner.length), nColGable = 2 * gx.length, nCol = nColMain + nColGable;

    // 1 site
    if (B.site.clear) { const m = num(B.site.margin, 2); add('site', 'clear', (L + 2 * m) * (W + 2 * m), `(${n2(L)} + 2×${n2(m)}) × (${n2(W)} + 2×${n2(m)})`); }

    // 2 foundations: main column footings and gable post footings
    const fd = (lbl, n, Bf, Lf, D, nP) => {
      const Df = max(D + 0.2, num(Fd.Df, 1.5)), c = num(Fd.c, 0.4), ln = num(Fd.lean, 0.05), sd = num(Fd.sand, 0.05), hp = max(0, Df - D - ln - sd) + 0.15;
      return { lbl, n, Bf, Lf, D, nP, Df, c, ln, sd, hp, Vf: Bf * Lf * D, Vp: c * c * hp, Vx: (Bf + 0.6) * (Lf + 0.6) * Df };
    };
    const FT = [fd(T('ฐานรากเสาหลัก', 'main column footings'), nColMain, num(Fd.B, 1.5), num(Fd.Lf, 1.5), num(Fd.D, 0.5), round(num(Fd.nP, 4)))];
    if (nColGable) FT.push(fd(T('ฐานรากเสากันลมหัวท้าย', 'gable post footings'), nColGable, num(Fd.gB, 1.0), num(Fd.gLf, 1.0), num(Fd.gD, 0.4), round(num(Fd.gNP, 2))));
    const sumF = fn => FT.reduce((s, f) => s + fn(f), 0), cf = fn => FT.map(f => `${f.n} × ${fn(f)}`).join(' + ');
    add('fnd', 'exc', sumF(f => f.n * f.Vx), cf(f => `(${n2(f.Bf)}+0.6)×(${n2(f.Lf)}+0.6)×${n2(f.Df)}`), { note: T('เผื่อที่ทำงานข้างละ 0.30 ม.', '0.30 m working space each side') });
    add('fnd', 'pile', sumF(f => f.n * f.nP * num(Fd.pileL, 12)), cf(f => `${f.nP} ${T('ต้น', 'piles')} × ${n2(num(Fd.pileL, 12))} ${T('ม.', 'm')}`), { desc: /^เสาเข็ม/.test(Fd.pileType || '') ? Fd.pileType : T('เสาเข็ม ', 'Piles ') + (Fd.pileType || '') });
    add('fnd', 'pilecut', sumF(f => f.n * f.nP), cf(f => `${f.nP}`), { r: 1 });
    add('fnd', 'sandbed', sumF(f => f.n * f.Bf * f.Lf * f.sd), cf(f => `${n2(f.Bf)}×${n2(f.Lf)}×${n2(f.sd)}`));
    add('fnd', 'lean', sumF(f => f.n * f.Bf * f.Lf * f.ln), cf(f => `${n2(f.Bf)}×${n2(f.Lf)}×${n2(f.ln)}`));
    add('fnd', 'conc', sumF(f => f.n * f.Vf), cf(f => `${n2(f.Bf)}×${n2(f.Lf)}×${n2(f.D)}`), { desc: T('คอนกรีตฐานราก', 'Concrete — footings') + " f'c 240 ksc" });
    add('fnd', 'conc', sumF(f => f.n * f.Vp), cf(f => `${n2(f.c)}×${n2(f.c)}×${n2(f.hp)}`), { desc: T('คอนกรีตตอม่อ', 'Concrete — pedestals') + " f'c 240 ksc", note: T('ตอม่อสูงจากหลังฐานถึง +0.15 ม. จากระดับดิน', 'pedestal from top of footing to +0.15 m above ground') });
    add('fnd', 'form', sumF(f => f.n * (2 * (f.Bf + f.Lf) * f.D + 4 * f.c * f.hp)), cf(f => `(2×(${n2(f.Bf)}+${n2(f.Lf)})×${n2(f.D)} + 4×${n2(f.c)}×${n2(f.hp)})`), { desc: T('ไม้แบบฐานรากและตอม่อ', 'Formwork — footings and pedestals') });
    const rf = num(Fd.rf, 60), rp = num(Fd.rp, 150);
    add('fnd', 'rebar', sumF(f => f.n * (f.Vf * rf + f.Vp * rp)), cf(f => `(${n3(f.Vf)} ${T('ลบ.ม.', 'm³')}×${rf} + ${n3(f.Vp)} ${T('ลบ.ม.', 'm³')}×${rp})`), { desc: T('เหล็กเสริมฐานรากและตอม่อ', 'Reinforcement — footings and pedestals'), note: T('ประมาณจากอัตราส่วน กก./ลบ.ม.', 'estimated from kg/m³ ratios') });
    add('fnd', 'abolt', nCol * round(num(F.nb, 4)), `${nCol} ${T('เสา', 'columns')} × ${round(num(F.nb, 4))}`, { r: 1 });
    add('fnd', 'grout', nCol, `${nColMain} + ${nColGable}`, { r: 1 });
    add('fnd', 'backfill', sumF(f => f.n * (f.Vx - f.Vf - f.Bf * f.Lf * (f.ln + f.sd) - f.c * f.c * (f.Df - f.D - f.ln - f.sd))), T('ปริมาตรขุด − ฐาน − ทราย/คอนกรีตหยาบ − ตอม่อใต้ดิน', 'excavation − footing − bedding − pedestal below ground'));

    // 3 tie beams around the perimeter (and along inner column lines)
    const tb = num(Tb.b, 0.2), tH = num(Tb.h, 0.4), tlen = 2 * (L + W) + (Tb.inner ? inner.length * L : 0);
    const tcalc = `2×(${n2(L)}+${n2(W)})` + (Tb.inner && inner.length ? ` + ${inner.length}×${n2(L)}` : '');
    add('tie', 'exc', (tb + 0.4) * (tH + 0.1) * tlen, `(${n2(tb)}+0.4)×(${n2(tH)}+0.1)×${n2(tlen)}`);
    add('tie', 'sandbed', tb * 0.05 * tlen, `${n2(tb)}×0.05×${n2(tlen)}`);
    add('tie', 'conc', tb * tH * tlen, `${n2(tb)}×${n2(tH)}×(${tcalc})`, { desc: T('คอนกรีตคานคอดิน', 'Concrete — tie beams') + ` ${n2(tb)}×${n2(tH)} ม.` });
    add('tie', 'form', 2 * tH * tlen, `2×${n2(tH)}×${n2(tlen)}`, { desc: T('ไม้แบบคานคอดิน', 'Formwork — tie beams') });
    add('tie', 'rebar', tb * tH * tlen * num(Tb.rt, 120), `${n3(tb * tH * tlen)} ${T('ลบ.ม.', 'm³')} × ${num(Tb.rt, 120)}`, { desc: T('เหล็กเสริมคานคอดิน', 'Reinforcement — tie beams') });
    add('tie', 'backfill', 0.4 * (tH + 0.1) * tlen, `0.4×(${n2(tH)}+0.1)×${n2(tlen)}`);

    // 4 slab on grade
    const A = W * L, t = num(S.t, 0.15);
    add('slab', 'fill', A * num(S.fill, 0.2), `${n2(W)}×${n2(L)}×${n2(num(S.fill, 0.2))}`);
    add('slab', 'base', A * num(S.base, 0.1), `${n2(W)}×${n2(L)}×${n2(num(S.base, 0.1))}`);
    if (S.poly) add('slab', 'poly', A * 1.05, `${n2(A)} × 1.05 ${T('(ระยะทาบ)', '(laps)')}`);
    if (S.mesh) add('slab', 'mesh', A * 1.1, `${n2(A)} × 1.10 ${T('(ระยะทาบ)', '(laps)')}`);
    if (num(S.rs, 0) > 0) add('slab', 'rebar', A * t * num(S.rs, 0), `${n2(A)}×${n2(t)}×${num(S.rs, 0)}`, { desc: T('เหล็กเสริมพื้น', 'Reinforcement — slab') });
    add('slab', 'conc', A * t, `${n2(W)}×${n2(L)}×${n2(t)}`, { desc: T('คอนกรีตพื้น หนา ', 'Concrete — slab ') + n2(t) + T(' ม.', ' m') });
    const j = max(2, num(S.joint, 6)), jl = (ceil(W / j) - 1) * L + (ceil(L / j) - 1) * W;
    add('slab', 'sawcut', jl, `(${ceil(W / j) - 1}×${n2(L)}) + (${ceil(L / j) - 1}×${n2(W)})`, { note: T('รอยต่อทุก ', 'joints at ') + n2(j) + T(' ม.', ' m') });
    if (S.hard) add('slab', 'hard', A, `${n2(W)}×${n2(L)}`);

    // 5 structural steel
    const hc = hInfo(F.col), hr = hInfo(F.raf), hg = hInfo(F.gcol);
    const colLen = nf * (2 * H + inner.reduce((s, x) => s + hAt(x), 0)), rafLen = nf * 2 * rafter, gLen = 2 * gx.reduce((s, x) => s + hAt(x), 0);
    const kgC = colLen * hc.w, kgR = rafLen * hr.w, kgG = gLen * hg.w;
    add('steel', 'steelH', kgC, `${nf} ${T('โครง', 'frames')} × ${n2(colLen / nf)} ${T('ม.', 'm')} × ${hc.w}`, { desc: T('เสาเหล็ก ', 'Columns ') + F.col + ` (${hc.w} ${T('กก./ม.', 'kg/m')})` });
    add('steel', 'steelH', kgR, `${nf} × 2 × ${n2(rafter)} ${T('ม.', 'm')} × ${hr.w}`, { desc: T('คานหลังคา (Rafter) ', 'Rafters ') + F.raf + ` (${hr.w} ${T('กก./ม.', 'kg/m')})` });
    if (kgG) add('steel', 'steelH', kgG, `2 × (${gx.map(x => n2(hAt(x))).join(' + ')}) ${T('ม.', 'm')} × ${hg.w}`, { desc: T('เสากันลมผนังหัวท้าย ', 'Gable wind posts ') + F.gcol + ` (${hg.w} ${T('กก./ม.', 'kg/m')})` });
    const kgMain = kgC + kgR + kgG, conn = num(F.conn, 12) / 100;
    add('steel', 'plate', kgMain * conn, `${n2(kgMain)} ${T('กก.', 'kg')} × ${n2(conn * 100)}%`, { note: T('แผ่นฐาน ครีบ haunch แผ่นต่อ และสลักเกลียว', 'base plates, haunches, splices, stiffeners, bolts') });
    const cp = cInfo(P.sec), cg = cInfo(P.girt), lap = 1 + num(P.lap, 5) / 100;
    const nPl = ceil(rafter / max(0.5, num(P.sp, 1.0))) + 1, purlLen = 2 * nPl * (L + 2 * G0.go) * lap;
    add('steel', 'purlin', purlLen * cp.w, `2 ${T('ด้าน', 'slopes')} × ${nPl} ${T('แนว', 'lines')} × ${n2(L + 2 * G0.go)} ${T('ม.', 'm')} × ${n2(lap)} × ${cp.w}`, { desc: T('แป ', 'Purlins ') + P.sec + ` (${cp.w} ${T('กก./ม.', 'kg/m')})` });
    const hb = Wl.sheet ? min(H, max(0, num(Wl.hb, 2))) : H, gs = max(0.5, num(P.gsp, 1.2));
    const nGl = Wl.sheet && H - hb > 0.1 ? ceil((H - hb) / gs) : 0, gableA = Wl.sheet ? 2 * (W * (H - hb) + W * rise / 2) : 0;
    const girtLen = (2 * nGl * L + gableA / gs) * lap;
    if (girtLen > 0) add('steel', 'purlin', girtLen * cg.w, `(2×${nGl}×${n2(L)} + ${n2(gableA)}/${n2(gs)}) × ${n2(lap)} × ${cg.w}`, { desc: T('เคร่าผนัง ', 'Wall girts ') + P.girt + ` (${cg.w} ${T('กก./ม.', 'kg/m')})` });
    if (F.sag) add('steel', 'rod', 2 * (nf - 1) * rafter * rodKg(12), `2 × ${nf - 1} ${T('ช่วง', 'bays')} × ${n2(rafter)} ${T('ม.', 'm')} × ${n3(rodKg(12))} (Ø12)`, { desc: T('Sag rod Ø12 มม.', 'Sag rods Ø12 mm') });
    const nbr = min(nf - 1, max(0, round(num(F.brace, 2)))), dR = Math.hypot(bay, rafter), dW = Math.hypot(bay, H), rd = num(F.rodD, 20);
    if (nbr) add('steel', 'rod', nbr * (2 * 2 * dR + 2 * 2 * dW) * rodKg(rd), `${nbr} ${T('ช่วง', 'bays')} × (4×${n2(dR)} + 4×${n2(dW)}) ${T('ม.', 'm')} × ${n3(rodKg(rd))} (Ø${rd})`, { desc: T('ค้ำยันหลังคาและผนัง (X-bracing) Ø', 'Roof and wall X-bracing Ø') + rd + T(' มม.', ' mm') });
    const paintA = colLen * hc.P + rafLen * hr.P + gLen * hg.P + kgMain * conn * 0.02;
    add('steel', 'paint', paintA, `${n2(colLen)}×${n3(hc.P)} + ${n2(rafLen)}×${n3(hr.P)}` + (gLen ? ` + ${n2(gLen)}×${n3(hg.P)}` : '') + ` + ${T('แผ่นต่อ', 'plates')} ${n2(kgMain * conn)}×0.02`, { note: T('เฉพาะเหล็กรูปพรรณรีดร้อน (แป/เคร่าชุบสังกะสี)', 'hot-rolled steel only (purlins and girts galvanised)') });

    // 6 roofing
    const slope = rafter + G0.eo / Math.cos(G0.th), roofL = L + 2 * G0.go, Aroof = 2 * slope * roofL, sky = min(50, max(0, num(R.sky, 0))) / 100;
    add('roof', R.ins === 'pu' ? 'roofpu' : R.sheet || 'roof047', Aroof * (1 - sky), `2 × ${n2(slope)} × ${n2(roofL)}` + (sky ? ` × (1 − ${n2(sky * 100)}%)` : ''));
    if (sky) add('roof', 'sky', Aroof * sky, `${n2(Aroof)} × ${n2(sky * 100)}%`);
    if (R.ins === 'blanket') add('roof', 'blanket', Aroof, `${n2(Aroof)}`);
    add('roof', 'ridge', roofL, `${n2(roofL)}`);
    add('roof', 'flash', 2 * 2 * slope, `2 ${T('ด้าน', 'ends')} × 2 × ${n2(slope)}`, { desc: T('ครอบปิดขอบหลังคาด้านจั่ว', 'Gable barge flashing') });
    if (R.gutter) {
      add('roof', 'gutter', 2 * roofL, `2 × ${n2(roofL)}`);
      const nd = 2 * (ceil((nf - 1) / max(1, num(R.dpEvery, 2))) + 1);
      add('roof', 'dpipe', nd * (H + 0.3), `${nd} ${T('จุด', 'pipes')} × ${n2(H + 0.3)} ${T('ม.', 'm')}`);
    }

    // 7 walls
    const per = 2 * (L + W), rsN = round(num(O.rsN, 0)), rsW = num(O.rsW, 5), rsH = num(O.rsH, 5), dN = round(num(O.doorN, 0)), win = max(0, num(Wl.win, 0));
    const opB = rsN * rsW * min(rsH, hb) + dN * 1.0 * min(2.1, hb), opS = rsN * rsW * max(0, rsH - hb) + dN * 1.0 * max(0, 2.1 - hb);
    const winB = hb >= 2.4 ? win : 0, winS = win - winB;
    if (hb > 0) {
      const Ab = per * hb - opB - winB;
      add('wall', 'block', Ab, `${n2(per)} × ${n2(hb)} − ${T('ช่องเปิด', 'openings')} ${n2(opB + winB)}`);
      const sides = round(num(Wl.sides, 2)); if (sides) add('wall', 'plaster', Ab * sides, `${n2(Ab)} × ${sides} ${T('ด้าน', 'sides')}`);
      const nPost = ceil(per / 2.5) + 2 * (rsN + dN), lint = per + rsN * (rsW + 0.4) + dN * 1.4;
      add('wall', 'lintel', nPost * hb + lint, `${nPost} ${T('ต้น', 'posts')} × ${n2(hb)} + ${T('ทับหลัง', 'lintels')} ${n2(lint)}`);
    }
    if (Wl.sheet) {
      const As = 2 * L * (H - hb) + gableA - opS - winS;
      add('wall', 'wallsheet', As, `2×${n2(L)}×${n2(H - hb)} + ${T('ผนังหัวท้าย', 'gables')} 2×(${n2(W)}×${n2(H - hb)} + ${n2(W)}×${n2(rise)}/2) − ${n2(opS + winS)}`);
      add('wall', 'flash', 4 * (H - hb) + (hb > 0 ? per : 0), `4×${n2(H - hb)}` + (hb > 0 ? ` + ${n2(per)}` : ''), { desc: T('แผ่นปิดมุมผนังและปิดบนผนังก่อ', 'Corner and wall-head trims') });
    }

    // 8 doors and windows
    if (rsN) add('open', 'shutter', rsN * rsW * rsH, `${rsN} × ${n2(rsW)} × ${n2(rsH)}`, { desc: (th ? PRICE.shutter[3] : PRICE.shutter[4]) + ` ${n2(rsW)} × ${n2(rsH)} ${T('ม.', 'm')}` });
    if (dN) add('open', 'door', dN, `${dN}`, { r: 1 });
    if (win) add('open', 'window', win, `${n2(win)}`);

    // 9 drainage
    if (B.drain.ditch) add('drain', 'ditch', per + 8 * 0.6, `2×(${n2(L)}+${n2(W)}) + 8×0.6 ${T('(มุม)', '(corners)')}`);

    // 10 user items
    (B.extra || []).forEach((x, i) => { if (x && x.desc && num(x.qty, 0) > 0) it.push({ cat: 'extra', key: 'x' + i, qty: num(x.qty, 0), unit: x.unit || '', desc: x.desc, note: '', calc: T('กรอกเอง', 'entered'), mat: num(x.mat, 0), lab: num(x.lab, 0) }); });

    const steel = { main: kgMain, plates: kgMain * conn, purl: purlLen * cp.w, girt: girtLen * cg.w };
    return { items: it, geo: G0, steel, area: A, nCol, nColMain, nColGable, Aroof };
  }

  // ------------------------------------------------------------------ pricing and summary
  function price(B, key) { const p = (B.price || {})[key], d = PRICE[key]; return { mat: p && p.mat != null && p.mat !== '' ? +p.mat : d ? d[0] : 0, lab: p && p.lab != null && p.lab !== '' ? +p.lab : d ? d[1] : 0 }; }
  function compute(B, lang) {
    const R = takeoff(B, lang);
    R.items.forEach(x => { const p = x.cat === 'extra' ? { mat: x.mat, lab: x.lab } : price(B, x.key); x.mat = p.mat; x.lab = p.lab; x.matT = r2(x.qty * p.mat); x.labT = r2(x.qty * p.lab); x.tot = r2(x.matT + x.labT); });
    const th = lang !== 'en';
    R.cats = CATS.map(([k, t, e], i) => { const its = R.items.filter(x => x.cat === k); return { k, no: i + 1, name: th ? t : e, items: its, mat: r2(its.reduce((s, x) => s + x.matT, 0)), lab: r2(its.reduce((s, x) => s + x.labT, 0)), tot: r2(its.reduce((s, x) => s + x.tot, 0)) }; }).filter(c => c.items.length);
    // number items within categories: 1.1, 1.2 …
    R.cats.forEach((c, i) => { c.no = i + 1; c.items.forEach((x, j) => { x.no = (i + 1) + '.' + (j + 1); }); });
    const direct = r2(R.cats.reduce((s, c) => s + c.tot, 0)), O = B.oh || {};
    let grand, lines = [];
    if (O.mode === 'F') { const F = num(O.F, 1); grand = r2(direct * F); lines = [[th ? 'ค่างานต้นทุน' : 'Direct cost', direct], [(th ? 'Factor F' : 'Factor F') + ' ' + F, r2(grand - direct)]]; }
    else { const oh = num(O.oh, 0) / 100, pr = num(O.profit, 0) / 100, vat = num(O.vat, 0) / 100, ohv = r2(direct * oh), prv = r2(direct * pr), sub = direct + ohv + prv, vv = r2(sub * vat); grand = r2(sub + vv);
      lines = [[th ? 'ค่างานต้นทุน (ค่าวัสดุ + ค่าแรง)' : 'Direct cost (materials + labour)', direct], [(th ? 'ค่าดำเนินการ ' : 'Overheads ') + n2(oh * 100) + '%', ohv], [(th ? 'กำไร ' : 'Profit ') + n2(pr * 100) + '%', prv], [(th ? 'ภาษีมูลค่าเพิ่ม ' : 'VAT ') + n2(vat * 100) + '%', vv]]; }
    R.direct = direct; R.grand = grand; R.lines = lines; R.perM2 = r2(grand / R.area);
    return R;
  }
  // Thai baht in words (บาทถ้วน) for the summary sheet
  function bahtText(v) {
    const D = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'], U = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
    const words = n => { let s = ''; const t = String(n); if (t.length > 6) return words(+t.slice(0, -6)) + 'ล้าน' + words(+t.slice(-6)); for (let i = 0; i < t.length; i++) { const d = +t[i], p = t.length - i - 1; if (!d) continue; if (p === 1 && d === 1) s += 'สิบ'; else if (p === 1 && d === 2) s += 'ยี่สิบ'; else if (p === 0 && d === 1 && t.length > 1) s += 'เอ็ด'; else s += D[d] + U[p]; } return s; };
    v = Math.round(v * 100) / 100; const b = Math.floor(v), st = Math.round((v - b) * 100);
    return (b ? words(b) + 'บาท' : 'ศูนย์บาท') + (st ? words(st) + 'สตางค์' : 'ถ้วน');
  }
  G.BOQ = { PRICE, CATS, HSEC, CSEC, hInfo, cInfo, rodKg, defaults, geometry, takeoff, compute, price, bahtText, n2, n3 };
})(typeof window !== 'undefined' ? window : globalThis);
