/* StructCap House — detailing: bar bending schedule (BBS), structural BOQ and the 3D rebar cage.
   Thai practice (EIT 1008 / มยผ.): main bars DB lap 40db, RB lap 48db; 90° hook ext. 12db; 180° hook (RB) 4db ≥ 6.5 cm (allow 12db);
   stirrups / ties 135° hook 6db ≥ 7.5 cm each end; stock bars 10 m; waste % on the weight. Lengths m, weights kg. */
(function (G) {
  'use strict';
  const X = () => G.HOUSE;
  const max = Math.max, min = Math.min, ceil = Math.ceil, abs = Math.abs, round = Math.round, hyp = Math.hypot;
  const STOCK = 10;
  const db = k => X().barD(k) / 1000;                 // m
  const hook90 = k => 12 * db(k);
  const hook180 = k => max(12 * db(k), 0.065 + 4 * db(k));
  const hookStir = k => max(6 * db(k), 0.075) + 3 * db(k); // straight extension + bend allowance
  const isRB = k => /^RB/.test(k);
  const lap = (H, k) => (isRB(k) ? H.mat.lapRB : H.mat.lapDB) * db(k);
  // a straight run longer than a stock bar gets laps
  function withLaps(H, k, L) { if (L <= STOCK) return { L, nl: 0 }; const lp = lap(H, k), nl = ceil((L - STOCK) / (STOCK - lp)); return { L: L + nl * lp, nl }; }

  function fndTop(H, f) { return -(+H.soil.Df || 1.5) + (f && f.t ? f.t / 100 : 0.3); }

  // ------------------------------------------------------------------ bar schedule
  function schedule(H, D) {
    const HX = X(), S = HX.stories(H), rows = [], conc = [], form = [], cov = H.mat.cover, Df = +H.soil.Df || 1.5;
    const add = (grp, mark, bar, shape, L, n, note) => { if (!(n > 0) || !(L > 0)) return; const r = withLaps(H, bar, L); rows.push({ grp, mark, bar, shape, L: r.L, n, laps: r.nl, kg: r.L * n * HX.barW(bar), note: note || '' }); };
    const cv = (grp, mark, v, note) => { if (v > 0) conc.push({ grp, mark, v, note: note || '' }); };
    const fw = (grp, mark, a) => { if (a > 0) form.push({ grp, mark, a }); };
    const gx = i => H.grid.x[i], gy = j => H.grid.y[j];
    const colAt = (i, j) => H.columns.find(c => c.i === i && c.j === j);
    const colW = (i, j, dirX) => { const c = colAt(i, j); if (!c) return 0; const s = HX.secOf(H, c.sec); return (dirX ? s.b : s.h) / 100; };
    // footings
    D.fnds.forEach(f => {
      if (!f.B) return; const t = f.t / 100, c = cov.fnd / 100, m = f.mark;
      add('ฐานราก', m, f.fx.bar, 'U', f.B - 2 * c + 2 * hook90(f.fx.bar), f.fx.n, 'เหล็กล่าง ขนาน X');
      add('ฐานราก', m, f.fy.bar, 'U', f.L - 2 * c + 2 * hook90(f.fy.bar), f.fy.n, 'เหล็กล่าง ขนาน Y');
      cv('ฐานราก', m, f.B * f.L * t); fw('ฐานราก', m, 2 * (f.B + f.L) * t);
      conc.push({ grp: 'คอนกรีตหยาบ', mark: m, v: (f.B + 0.1) * (f.L + 0.1) * 0.05, lean: 1 });
      conc.push({ grp: 'ทรายรองพื้น', mark: m, v: (f.B + 0.1) * (f.L + 0.1) * 0.05, sand: 1 });
      conc.push({ grp: 'งานดินขุด', mark: m, v: (f.B + 0.6) * (f.L + 0.6) * (Df + 0.1), dig: 1 });
    });
    // columns and pedestals
    D.cols.forEach(c => {
      if (!c.bar) return; const col = H.columns.find(q => q.id === c.id), f = D.fnds.find(q => q.id === c.id), b = c.b / 100, h = c.h / 100, cc = cov.col / 100;
      const z0 = c.seg === 0 ? -Df + (f && f.t ? f.t / 100 : 0.3) : S[c.seg - 1].z, z1 = S[c.seg] ? S[c.seg].z : z0 + 3, Lc = z1 - z0;
      const top = HX.stIdx(H, col.top), last = c.seg === top;
      let Lv = Lc + (last ? hook90(c.bar) - cc : lap(H, c.bar));
      if (c.seg === 0 && f) Lv += f.t / 100 - cov.fnd / 100 + hook90(c.bar);
      add(c.seg === 0 ? 'ตอม่อ' : 'เสา', c.mark, c.bar, c.seg === 0 ? 'L' : last ? 'L' : 'I', Lv, c.n, c.seg === 0 ? 'เหล็กยืน (งอเข้าฐานราก)' : 'เหล็กยืน');
      const per = 2 * (b - 2 * cc) + 2 * (h - 2 * cc) + 2 * hookStir(c.tie), nt = ceil(Lc / (c.s / 100)) + 1;
      add(c.seg === 0 ? 'ตอม่อ' : 'เสา', c.mark, c.tie, '□', per, nt, `ปลอก @ ${c.s} ซม.`);
      cv(c.seg === 0 ? 'ตอม่อ' : 'เสา', c.mark, b * h * Lc); fw(c.seg === 0 ? 'ตอม่อ' : 'เสา', c.mark, 2 * (b + h) * Lc);
    });
    // beams (per segment, centre-to-centre; bars hooked into the end columns)
    D.beams.forEach(bd => {
      if (!bd.top) return; const b = HX.beamOn(H, bd.st, bd.a, bd.bb), dirX = b.a[1] === b.b[1];
      const L = hyp(gx(b.b[0]) - gx(b.a[0]), gy(b.b[1]) - gy(b.a[1])), w = bd.b / 100, h = bd.h / 100, c = H.mat.cover.beam / 100;
      const ca = colW(b.a[0], b.a[1], dirX) / 2, cb = colW(b.b[0], b.b[1], dirX) / 2, clear = max(0.3, L - ca - cb);
      const end = k => 2 * hook90(k) - 2 * c;
      add('คาน', bd.mark, bd.top.bar, 'U', L + end(bd.top.bar), bd.top.n, 'เหล็กบน');
      add('คาน', bd.mark, bd.bot.bar, 'U', L + end(bd.bot.bar), bd.bot.n, 'เหล็กล่าง');
      const st = bd.shear, per = 2 * (w - 2 * c) + 2 * (h - 2 * c) + 2 * hookStir(st.bar), ns = ceil(clear / (st.s / 100)) + 1;
      add('คาน', bd.mark, st.bar, '□', per, ns, `ปลอก @ ${st.s} ซม.`);
      const slabT = 0; cv('คาน', bd.mark, w * h * clear); fw('คาน', bd.mark, (w + 2 * h) * clear);
      void slabT;
    });
    // slabs
    D.slabs.forEach(sd => {
      const s = H.slabs.find(q => q.id === sd.id); if (!s || !sd.rows.length) return;
      const Lx = sd.g.Lx, Ly = sd.g.Ly, t = sd.t / 100, c = cov.slab / 100;
      if (sd.ground) { const r = sd.rows[0], sp = r.s / 100; add('พื้น', sd.mark, r.bar, 'I', Lx - 2 * c, ceil(Ly / sp) + 1, 'ตะแกรงทาง X'); add('พื้น', sd.mark, r.bar, 'I', Ly - 2 * c, ceil(Lx / sp) + 1, 'ตะแกรงทาง Y'); }
      else if (sd.g.way === 'two') {
        const shortX = Lx <= Ly, Sx = shortX ? Lx : Ly, Lg = shortX ? Ly : Lx, pos = sd.rows.filter(r => /บวก/.test(r.pos)), neg = sd.rows.filter(r => /ลบ/.test(r.pos));
        // bottom: short direction bars run along the short span, spaced along the long side
        add('พื้น', sd.mark, pos[0].bar, 'I', Sx + 0.2, ceil(Lg / (pos[0].s / 100)) + 1, 'เหล็กล่าง ช่วงสั้น');
        add('พื้น', sd.mark, pos[1].bar, 'I', Lg + 0.2, ceil(Sx / (pos[1].s / 100)) + 1, 'เหล็กล่าง ช่วงยาว');
        // top: each supported edge, bars of length S/4 + anchorage, spaced along that edge
        const tb = neg.reduce((a, r) => (r.As > a.As ? r : a), neg[0]);
        [['s', Lx], ['n', Lx], ['w', Ly], ['e', Ly]].forEach(([e, len]) => { if (sd.g.E[e]) add('พื้น', sd.mark, tb.bar, 'L', Sx / 4 + 0.15 + hook90(tb.bar), ceil(len / (tb.s / 100)) + 1, 'เหล็กบน ขอบ ' + e.toUpperCase()); });
      } else {
        const sp = sd.g.way === 'x' ? Lx : Ly, other = sd.g.way === 'x' ? Ly : Lx, pos = sd.rows.find(r => /บวก/.test(r.pos)), neg = sd.rows.find(r => /ลบ/.test(r.pos)), tmp = X().slabDesign ? null : null; void tmp;
        add('พื้น', sd.mark, pos.bar, 'I', sp + 0.2, ceil(other / (pos.s / 100)) + 1, 'เหล็กหลัก');
        const tr = X().BARS[H.mat.fy >= 3000 ? 'DB10' : 'RB9'] ? (H.mat.fy >= 3000 ? 'DB10' : 'RB9') : pos.bar, ts = min(30, round(100 * X().barA(tr) / (0.0018 * 100 * sd.t) / 2.5) * 2.5);
        add('พื้น', sd.mark, tr, 'I', other + 0.2, ceil(sp / (ts / 100)) + 1, 'เหล็กกันร้าว');
        add('พื้น', sd.mark, neg.bar, 'L', 2 * (sp / 4 + 0.15) + 2 * hook90(neg.bar), ceil(other / (neg.s / 100)) + 1, 'เหล็กบน');
      }
      cv('พื้น', sd.mark, Lx * Ly * t); if (!sd.ground) fw('พื้น', sd.mark, Lx * Ly);
    });
    // stairs
    D.stairs.forEach(sd => {
      const Ls = hyp(sd.Lh, sd.hgt), t = sd.t / 100;
      add('บันได', sd.mark, sd.main.bar, 'Z', Ls + 2 * 0.4, ceil(sd.W / (sd.main.s / 100)) + 1, 'เหล็กหลัก');
      add('บันได', sd.mark, sd.dist.bar, 'I', sd.W - 0.05, ceil(Ls / (sd.dist.s / 100)) + 1, 'เหล็กกันร้าว');
      add('บันได', sd.mark, sd.main.bar, 'L', 1.0, ceil(sd.W / (sd.main.s / 100)) + 1, 'เหล็กบนที่ฐานรองรับ (2 ปลาย)');
      cv('บันได', sd.mark, sd.W * (Ls * t + sd.nr * sd.R * sd.Tr / 2)); fw('บันได', sd.mark, sd.W * Ls + sd.nr * sd.R * sd.W);
    });
    // roof steel
    const steel = [];
    if (D.roof && D.roof.truss) {
      const R = D.roof, nt = R.nTruss;
      R.truss.groups.forEach(gr => { if (!gr.sec) return; const Ltot = R.truss.members.filter(m => m.kind === gr.kind).reduce((s, m) => s + m.L, 0); steel.push({ item: { tc: 'จันทันโครงถัก (Top chord)', bc: 'ขื่อ (Bottom chord)', vt: 'ค้ำยันแนวดิ่ง', dg: 'ค้ำยันทแยง' }[gr.kind], sec: gr.sec.p.name, L: Ltot * nt, kg: Ltot * nt * gr.sec.p.w }); });
      if (R.purlin) { const g = R.g, nRow = ceil((g.span / Math.cos(g.th) + 2 * g.ov / Math.cos(g.th)) / R.psp) + 1, Lp = g.len + 2 * g.ov; steel.push({ item: 'แป', sec: R.purlin.p.name, L: nRow * Lp, kg: nRow * Lp * R.purlin.p.w }); }
    }
    // summary by diameter, waste
    const wf = 1 + (+H.mat.waste || 0) / 100, byBar = {};
    rows.forEach(r => { const o = byBar[r.bar] = byBar[r.bar] || { bar: r.bar, L: 0, kg: 0 }; o.L += r.L * r.n; o.kg += r.kg; });
    Object.values(byBar).forEach(o => { o.kgw = o.kg * wf; o.nStock = ceil(o.L * wf / STOCK); });
    return { rows, conc, form, steel, byBar: Object.values(byBar).sort((a, b) => X().barD(a.bar) - X().barD(b.bar)), wf };
  }

  // ------------------------------------------------------------------ BOQ (quantities, optional unit rates in H.rates)
  // default unit rates (บาท, ไม่รวม VAT) — editable per project in H.rates[key] = { mat, lab }
  // วัสดุ: สนค. กระทรวงพาณิชย์ ราคาเฉลี่ยทั่วประเทศ ส.ค. 2569; ค่าแรง: บัญชีค่าแรงงาน กรมบัญชีกลาง ว 480 (26 มิ.ย. 2569); 'est' = ประมาณการ
  const SRC = { M: 'สนค. ส.ค. 2569', L: 'กรมบัญชีกลาง ว 480 (2569)', E: 'ประมาณการ' };
  const RATES = {
    dig: { mat: 0, lab: 153, src: [null, 'L'] }, fill: { mat: 0, lab: 121, src: [null, 'L'] }, sand: { mat: 450, lab: 112, src: ['E', 'L'] }, lean: { mat: 2100, lab: 427, src: ['E', 'L'] },
    pile: { mat: 750, lab: 183, src: ['E', 'L'] }, conc: { mat: 2634, lab: 522, src: ['M', 'L'] }, form: { mat: 220, lab: 163, src: ['E', 'L'] },
    bar_RB6: { mat: 22.36, lab: 4.9, src: ['M', 'L'] }, bar_RB9: { mat: 21.32, lab: 4.9, src: ['M', 'L'] }, bar_DB10: { mat: 21.0, lab: 3.9, src: ['E', 'L'] }, bar_DB12: { mat: 20.65, lab: 3.9, src: ['M', 'L'] },
    bar_DB16: { mat: 20.54, lab: 3.9, src: ['M', 'L'] }, bar_DB20: { mat: 20.77, lab: 3.5, src: ['M', 'L'] }, bar_DB25: { mat: 21.21, lab: 3.5, src: ['M', 'L'] }, bar_DB28: { mat: 21.21, lab: 3.5, src: ['E', 'L'] },
    wire: { mat: 42.7, lab: 0, src: ['M', null] }, steel: { mat: 26, lab: 14, src: ['E', 'L'] }, purlin: { mat: 26, lab: 12, src: ['E', 'L'] }, paint: { mat: 45, lab: 35, src: ['E', 'E'] }
  };
  const rateOf = (H, key) => { const d = RATES[key] || { mat: 0, lab: 0, src: [] }, u = (H.rates || {})[key] || {}; const pick = (f, i) => (u[f] != null && u[f] !== '' ? { v: +u[f] || 0, src: 'ผู้ใช้' } : { v: d[f], src: d.src[i] ? SRC[d.src[i]] : '' }); return { mat: pick('mat', 0), lab: pick('lab', 1) }; };
  function boq(H, D) {
    const B = schedule(H, D), items = [];
    const sum = (L, f) => L.reduce((s, x) => s + f(x), 0);
    const it = (grp, name, q, unit, key) => { const rt = rateOf(H, key); items.push({ grp, name, q, unit, key, mat: rt.mat.v, lab: rt.lab.v, smat: rt.mat.src, slab: rt.lab.src, own: rt.mat.src === 'ผู้ใช้' || rt.lab.src === 'ผู้ใช้' }); };
    const vc = g => sum(B.conc.filter(c => c.grp === g && !c.lean && !c.sand && !c.dig), c => c.v);
    it('1. งานดิน', 'งานดินขุดฐานราก', sum(B.conc.filter(c => c.dig), c => c.v), 'ลบ.ม.', 'dig');
    it('1. งานดิน', 'งานดินถมกลับ (ประมาณ)', max(0, sum(B.conc.filter(c => c.dig), c => c.v) - vc('ฐานราก') - vc('ตอม่อ')), 'ลบ.ม.', 'fill');
    it('1. งานดิน', 'ทรายหยาบรองพื้น หนา 5 ซม.', sum(B.conc.filter(c => c.sand), c => c.v), 'ลบ.ม.', 'sand');
    it('1. งานดิน', 'คอนกรีตหยาบ (Lean) หนา 5 ซม.', sum(B.conc.filter(c => c.lean), c => c.v), 'ลบ.ม.', 'lean');
    if (H.soil.type === 'pile') it('2. งานเสาเข็ม', H.soil.pile.name, sum(D.fnds, f => f.np || 0), 'ต้น', 'pile');
    const fc = H.mat.fc;
    ['ฐานราก', 'ตอม่อ', 'เสา', 'คาน', 'พื้น', 'บันได'].forEach(g => it('3. งานคอนกรีตโครงสร้าง', `คอนกรีต ${g} f'c ${fc} กก./ตร.ซม.`, vc(g), 'ลบ.ม.', 'conc'));
    ['ฐานราก', 'ตอม่อ', 'เสา', 'คาน', 'พื้น', 'บันได'].forEach(g => it('4. งานไม้แบบ', `ไม้แบบ ${g}`, sum(B.form.filter(x => x.grp === g), x => x.a), 'ตร.ม.', 'form'));
    B.byBar.forEach(o => it('5. งานเหล็กเสริม', `เหล็ก${/^RB/.test(o.bar) ? 'กลม SR24' : 'ข้ออ้อย SD40'} ${o.bar} (เผื่อ ${H.mat.waste}%)`, o.kgw, 'กก.', 'bar_' + o.bar));
    const kgAll = sum(B.byBar, o => o.kgw);
    it('5. งานเหล็กเสริม', 'ลวดผูกเหล็ก (15 กก./ตันเหล็ก)', kgAll * 0.015, 'กก.', 'wire');
    B.steel.forEach(s => it('6. งานโครงหลังคาเหล็ก', `${s.item} ${s.sec}`, s.kg, 'กก.', s.item === 'แป' ? 'purlin' : 'steel'));
    if (B.steel.length) it('6. งานโครงหลังคาเหล็ก', 'สีกันสนิม + สีทับหน้า (ประมาณ 1 ตร.ม. ต่อ 12 กก.)', sum(B.steel, s => s.kg) / 12, 'ตร.ม.', 'paint');
    items.forEach(x => { x.tmat = x.q * x.mat; x.tlab = x.q * x.lab; x.tot = x.tmat + x.tlab; });
    const total = sum(items, x => x.tot), vat = +(H.vat == null ? 7 : H.vat) || 0;
    return { B, items, total, tmat: sum(items, x => x.tmat), tlab: sum(items, x => x.tlab), vat, vatAmt: total * vat / 100, grand: total * (1 + vat / 100), kgAll, SRC };
  }

  // ------------------------------------------------------------------ 3D rebar cage (world coordinates m: x, y plan; z up)
  function cage(H, D, opt) {
    opt = opt || {}; const HX = X(), S = HX.stories(H), out = [], Df = +H.soil.Df || 1.5, gx = i => H.grid.x[i], gy = j => H.grid.y[j];
    const bar = (pts, k, kind, el) => out.push({ pts, r: HX.barD(k) / 2000, kind, el });
    const loop = (pts, k, el) => bar(pts.concat([pts[0]]), k, 'tie', el);
    D.fnds.forEach(f => {
      if (!f.B) return; const x = gx(f.i), y = gy(f.j), c = H.mat.cover.fnd / 100, z = -Df + c, t = f.t / 100, el = 'fnd:' + f.id;
      for (let k = 0; k < f.fx.n; k++) { const yy = y - f.L / 2 + c + (f.L - 2 * c) * k / max(1, f.fx.n - 1); bar([[x - f.B / 2 + c, yy, z + t - 2 * c], [x - f.B / 2 + c, yy, z], [x + f.B / 2 - c, yy, z], [x + f.B / 2 - c, yy, z + t - 2 * c]], f.fx.bar, 'main', el); }
      for (let k = 0; k < f.fy.n; k++) { const xx = x - f.B / 2 + c + (f.B - 2 * c) * k / max(1, f.fy.n - 1), zz = z + HX.barD(f.fx.bar) / 1000; bar([[xx, y - f.L / 2 + c, zz + t - 2 * c], [xx, y - f.L / 2 + c, zz], [xx, y + f.L / 2 - c, zz], [xx, y + f.L / 2 - c, zz + t - 2 * c]], f.fy.bar, 'main', el); }
    });
    D.cols.forEach(cd => {
      if (!cd.bar) return; const col = H.columns.find(q => q.id === cd.id), f = D.fnds.find(q => q.id === cd.id), x = gx(col.i), y = gy(col.j), b = cd.b / 100, h = cd.h / 100, c = H.mat.cover.col / 100 + 0.01, el = 'col:' + cd.id + ':' + cd.seg;
      const z0 = cd.seg === 0 ? -Df + (f && f.t ? f.t / 100 : 0.3) : S[cd.seg - 1].z, z1 = S[cd.seg] ? S[cd.seg].z : z0 + 3;
      const pts = perimeterPts(cd.n, b - 2 * c, h - 2 * c);
      pts.forEach(([u, v]) => bar([[x + u, y + v, cd.seg === 0 ? -Df + H.mat.cover.fnd / 100 + 0.03 : z0], [x + u, y + v, z1 - 0.04]], cd.bar, 'main', el));
      if (opt.ties !== false) for (let z = z0 + 0.05; z < z1 - 0.02; z += cd.s / 100) loop([[x - b / 2 + c - 0.008, y - h / 2 + c - 0.008, z], [x + b / 2 - c + 0.008, y - h / 2 + c - 0.008, z], [x + b / 2 - c + 0.008, y + h / 2 - c + 0.008, z], [x - b / 2 + c - 0.008, y + h / 2 - c + 0.008, z]], cd.tie, el);
    });
    D.beams.forEach(bd => {
      if (!bd.top) return; const st = S.find(s => s.id === bd.st), A = [gx(bd.a[0]), gy(bd.a[1])], B = [gx(bd.bb[0]), gy(bd.bb[1])], L = hyp(B[0] - A[0], B[1] - A[1]), ux = (B[0] - A[0]) / L, uy = (B[1] - A[1]) / L, nx = -uy, ny = ux;
      const w = bd.b / 100, h = bd.h / 100, c = H.mat.cover.beam / 100 + 0.01, zt = st.z - c, zb = st.z - h + c, el = 'beam:' + bd.id;
      const P = (s, o, z) => [A[0] + ux * s + nx * o, A[1] + uy * s + ny * o, z];
      const row = (n, z, k) => { for (let q = 0; q < n; q++) { const o = -w / 2 + c + (w - 2 * c) * q / max(1, n - 1); bar([P(0, o, z), P(L, o, z)], k, 'main', el); } };
      row(bd.top.n, zt, bd.top.bar); row(bd.bot.n, zb, bd.bot.bar);
      if (opt.ties !== false) { const s = bd.shear.s / 100; for (let p = 0.1; p < L - 0.05; p += s) loop([P(p, -w / 2 + c - 0.006, zb - 0.006), P(p, w / 2 - c + 0.006, zb - 0.006), P(p, w / 2 - c + 0.006, zt + 0.006), P(p, -w / 2 + c + -0.006, zt + 0.006)], bd.shear.bar, el); }
    });
    if (opt.slabs) D.slabs.forEach(sd => {
      const s = H.slabs.find(q => q.id === sd.id); if (!s || !sd.rows.length) return; const st = S.find(q => q.id === s.st), x0 = gx(s.i), y0 = gy(s.j), x1 = gx(s.i + 1), y1 = gy(s.j + 1), z = st.z - sd.t / 100 + H.mat.cover.slab / 100, el = 'slab:' + sd.id;
      const r = sd.rows.find(q => /บวก/.test(q.pos)) || sd.rows[0], sp = r.s / 100;
      for (let y = y0 + sp / 2; y < y1; y += sp) bar([[x0 + 0.05, y, z], [x1 - 0.05, y, z]], r.bar, 'slab', el);
      for (let x = x0 + sp / 2; x < x1; x += sp) bar([[x, y0 + 0.05, z + 0.01], [x, y1 - 0.05, z + 0.01]], r.bar, 'slab', el);
    });
    return out;
  }
  // bar positions around a b x h core: 4 corners, then the rest shared between the faces
  function perimeterPts(n, b, h) {
    const P = [[-b / 2, -h / 2], [b / 2, -h / 2], [b / 2, h / 2], [-b / 2, h / 2]], rest = n - 4; if (rest <= 0) return P;
    const nF = Math.floor(rest / 4) + (rest % 4 >= 2 ? 1 : 0), nS = (rest - 2 * nF) / 2;
    for (let k = 1; k <= nF; k++) { const u = -b / 2 + b * k / (nF + 1); P.push([u, -h / 2], [u, h / 2]); }
    for (let k = 1; k <= nS; k++) { const v = -h / 2 + h * k / (nS + 1); P.push([-b / 2, v], [b / 2, v]); }
    return P;
  }

  G.HOUSEBBS = { schedule, boq, RATES, rateOf, SRC, cage, perimeterPts, hook90, hook180, hookStir, lap, STOCK, fndTop };
})(typeof window !== 'undefined' ? window : globalThis);
