/* StructCap — free-standing sign column (totem / advertising column) on a concrete pad, to Australian Standards:
     AS/NZS 1170.0:2002 §4.2 (combinations), AS/NZS 1170.2:2021 (wind: V_R, M_c, M_z,cat, V_des ≥ 30 m/s, App. B / C shape factors),
     AS 4100:2020 (RHS stub legs §5–§8, bolts §9.3, fillet welds §9.7.3), AS 5216:2021 (cast-in anchors), AS 3600:2018 (pad, bearing §12.6).
   Layout (after the column framework drawings): a 2 mm aluminium-clad framework on a bolted splice (plates 2 / 3) sitting on a
   steel stub of two RHS legs welded to a base plate (plate 1), bolted to a concrete pad below ground.
   Internal units: N, mm, MPa; reported in kN, kNm, kPa. */
(function (G) {
  'use strict';
  const RC = G.RC, f = RC.f, Rep = RC.Rep, GA = G.GANTRY, SH = G.SHELTER;
  const PI = Math.PI, sq = Math.sqrt, abs = Math.abs, max = Math.max, min = Math.min;
  const BOLTS = GA.BOLTS, BGRADE = GA.BGRADE;
  const NUT_AF = { M12: 18, M16: 24, M20: 30, M24: 36, M30: 46 };
  const dOf = b => +String(b).replace(/\D/g, '');

  // RHS d × b × t (sharp-corner approximation, conservative for capacity)
  function rhs(d, b, t, fy) {
    const di = d - 2 * t, bi = b - 2 * t, A = b * d - bi * di;
    const Ix = (b * d * d * d - bi * di * di * di) / 12, Iy = (d * b * b * b - di * bi * bi * bi) / 12;
    const Sx = (b * d * d - bi * di * di) / 4, Sy = (d * b * b - di * bi * bi) / 4;
    const k = sq(fy / 250), lf = (b - 2 * t) / t * k, lw = (d - 2 * t) / t * k;
    const Zx = 2 * Ix / d, Zy = 2 * Iy / b;
    const ZeX = lf <= 30 && lw <= 82 ? min(Sx, 1.5 * Zx) : Zx;            // compact flange & web → S, else elastic (conservative)
    const lf2 = (d - 2 * t) / t * k, lw2 = (b - 2 * t) / t * k, ZeY = lf2 <= 30 && lw2 <= 82 ? min(Sy, 1.5 * Zy) : (lf2 <= 40 ? Zy : Zy * 40 / lf2);
    return { d, b, t, fy, A, Ix, Iy, Sx, Sy, Zx, Zy, ZeX, ZeY, lf, lw, lf2, mass: A * 7850e-6 };
  }

  function design(x, lang) {
    const R = new Rep(lang), L = (a, b) => R.L(a, b), checks = [], warn = [];
    const add = (id, name, Ed, Rd, unit, ur, grp) => checks.push({ id, name, Ed, Rd, unit, ur: ur !== undefined ? ur : (Rd > 0 ? abs(Ed) / Rd : 99), grp });
    const g = x;
    const Wp = g.Wp, Dpn = g.Dpn, Hp = g.Hp, zb = g.zb, dcov = g.dcov, Lpad = g.Lpad, Bpad = g.Bpad, Dpad = g.Dpad;
    const z0 = -dcov, zbot = -(dcov + Dpad), zF = zb + Hp / 2;
    const Lpl = g.Lpl, Bpl = g.Bpl, tpl = g.tpl, e = g.eb, xb = Lpl / 2 - e, yb = Bpl / 2 - e;
    const leg = rhs(g.ld, g.lb, g.lt, g.lfy), sL = g.sleg, nLeg = 2;

    R.sec(L('Sign column, stub and pad', 'เสาป้าย ขาตั้ง และฐานราก'), '');
    R.eq(L('Sign panel', 'แผงป้าย'), 'W × D × H = ' + f(Wp, 0) + ' × ' + f(Dpn, 0) + ' × ' + f(Hp, 0) + ' mm, ' + L('bottom ', 'ขอบล่าง ') + f(zb, 0) + L(' mm above ground', ' มม. เหนือดิน'), Wp * Hp / 1e6, 'm²');
    R.eq(L('Self-weight above the base plate', 'น้ำหนักเหนือแผ่นฐาน'), L('framework, cladding, lights and stub', 'โครง แผ่นปิด ไฟ และขาตั้ง'), g.Gs, 'kN');
    R.eq(L('Stub legs', 'ขาตั้ง'), nLeg + ' × ' + g.ld + ' × ' + g.lb + ' × ' + g.lt + ' RHS (f_y = ' + g.lfy + ' MPa) @ ' + f(sL, 0) + ' mm', f(leg.mass, 2), 'kg/m');
    R.eq(L('Base plate', 'แผ่นฐาน'), f(Lpl, 0) + ' × ' + f(Bpl, 0) + ' × ' + f(tpl, 0) + ' mm, ' + L('4 bolts at ', 'สลัก 4 ตัวที่ ') + e + L(' mm from the edges', ' มม. จากขอบ'), '', '');
    R.eq(L('Concrete pad', 'ฐานรากคอนกรีต'), f(Lpad, 0) + ' × ' + f(Bpad, 0) + ' × ' + f(Dpad, 0) + ' mm, ' + L('top ', 'ผิวบน ') + f(dcov, 0) + L(' mm below ground', ' มม. ใต้ดิน') + ", f'c = " + g.fc + ' MPa', '', '');

    // ---------- wind (AS/NZS 1170.2:2021)
    const reg = SH.REGIONS[g.region] || SH.REGIONS.A;
    const VRu = g.region === 'user' ? g.VRu : reg.VR(g.Ru), VRs = g.region === 'user' ? g.VRs : reg.VR(g.Rs);
    const Mc = g.region === 'user' ? 1 : reg.Mc, Mz = SH.MZ[g.tc] || 0.91, mult = Mc * g.Md * Mz * g.Ms * g.Mt;
    const Vu = max(30, VRu * mult), Vs = VRs * mult, qu = 0.6 * Vu * Vu / 1000, qs = 0.6 * Vs * Vs / 1000;
    R.sec(L('Wind', 'แรงลม'), 'AS/NZS 1170.2:2021 §2–§4, App. B / C');
    R.eq('V_R (ULS / SLS)', g.region === 'user' ? L('input', 'กำหนด') : L('Region ', 'เขต ') + reg.n + ', R = ' + g.Ru + ' / ' + g.Rs, f(VRu, 1) + ' / ' + f(VRs, 1), 'm/s', 'Table 3.1(A)');
    R.eq('M_c · M_d · M_z,cat · M_s · M_t', f(Mc, 2) + ' × ' + f(g.Md, 2) + ' × ' + f(Mz, 2) + ' (TC' + g.tc + ') × ' + f(g.Ms, 2) + ' × ' + f(g.Mt, 2), mult, '');
    R.eq('V_des, q_u = 0.6V²', 'V_des ≥ 30 m/s (ULS)', f(Vu, 1) + ' m/s, ' + f(qu, 3), 'kPa');
    R.eq('q_s', '0.6·V_s²', qs, 'kPa');
    const Ff = q => q * g.Cf * Wp * Hp / 1e6, Fs = q => q * g.Cfs * Dpn * Hp / 1e6;     // kN
    R.eq(L('Force on the face (wind normal to the 600 face)', 'แรงบนหน้าป้าย (ลมตั้งฉากหน้ากว้าง)'), 'F_Y = q_u·C_fig·W·H, C_fig = ' + f(g.Cf, 2), Ff(qu), 'kN');
    R.eq(L('Force on the side', 'แรงด้านข้าง'), 'F_X = q_u·C_fig,s·D·H, C_fig,s = ' + f(g.Cfs, 2), Fs(qu), 'kN');
    R.eq(L('Torsion from oblique wind', 'แรงบิดจากลมเฉียง'), 'T = F_Y·e, e = ' + f(g.ecc, 2) + '·W', Ff(qu) * g.ecc * Wp / 1000, 'kNm', 'App. B');
    R.txt(L('C_fig for a free-standing sign / prism of depth-to-width 0.25 at ground level; the defaults are typical values — confirm them against AS/NZS 1170.2 App. B (hoardings) and App. C for the actual proportions.', 'C_fig ของป้ายตั้งอิสระ / แท่งที่มีสัดส่วนลึกต่อกว้าง 0.25 ที่ระดับพื้น ค่าเริ่มต้นเป็นค่าทั่วไป — ตรวจสอบกับ AS/NZS 1170.2 ภาคผนวก B (ป้าย) และ C ตามสัดส่วนจริง'));

    // ---------- actions (per combination) at the base plate (z0) and at the splice (zb)
    const Wpad = g.gc * Lpad * Bpad * Dpad / 1e9, Wsoil = g.soil === 'yes' ? g.gs * Lpad * Bpad * dcov / 1e9 : 0;
    R.sec(L('Permanent actions', 'น้ำหนักคงที่'), '');
    R.eq(L('Sign', 'ป้าย'), 'G_s', g.Gs, 'kN');
    R.eq(L('Pad + soil over it', 'ฐานราก + ดินบนฐาน'), 'γ_c·L·B·D + γ_s·L·B·cover' + (g.soil === 'yes' ? '' : L(' (soil not counted)', ' (ไม่นับดิน)')), f(Wpad, 2) + ' + ' + f(Wsoil, 2), 'kN');
    const COMB = [];
    [['Y', L('wind on the face', 'ลมบนหน้าป้าย')], ['X', L('wind on the side', 'ลมด้านข้าง')]].forEach(([d, dn]) => [[1.2, '1.2G'], [0.9, '0.9G']].forEach(([gG, gn]) => COMB.push({ d, gG, nm: gn + ' + W_u (' + d + ')', dn })));
    COMB.push({ d: null, gG: 1.35, nm: '1.35G' });
    const act = (c, q, zref) => {
      const F = !c.d ? 0 : c.d === 'Y' ? Ff(q) : Fs(q), lev = (zF - zref) / 1000;
      return { N: c.gG * g.Gs, V: F, M: F * lev, T: c.d === 'Y' ? F * g.ecc * Wp / 1000 : 0, d: c.d };
    };
    R.sec(L('Design actions', 'แรงออกแบบ'), 'AS/NZS 1170.0 §4.2.2');
    COMB.forEach(c => { const a = act(c, qu, z0), s = act(c, qu, zb); R.eq(c.nm, L('base plate: N*, V*, M*, T*; splice: M*', 'แผ่นฐาน: N*, V*, M*, T*; รอยต่อ: M*'), f(a.N, 2) + ' kN, ' + f(a.V, 2) + ' kN, ' + f(a.M, 2) + ' kNm, ' + f(a.T, 2) + ' kNm; ' + f(s.M, 2) + ' kNm', ''); });

    // ---------- pad: overturning, sliding, bearing
    R.sec(L('Pad stability and bearing', 'เสถียรภาพและแรงแบกทานของฐานราก'), 'AS/NZS 1170.0 §4.2.1(b); φ_g·R_ug input');
    ['Y', 'X'].forEach(d => {
      const F = d === 'Y' ? Ff(qu) : Fs(qu), Md = F * (zF - zbot) / 1000, Bw = d === 'Y' ? Bpad : Lpad;
      const Ms = 0.9 * (g.Gs + Wpad + Wsoil) * Bw / 2000;
      R.eq(L('Overturning ', 'การพลิกคว่ำ ') + d, 'F·(z − z_b) vs 0.9ΣG·B/2', f(Md, 2) + ' / ' + f(Ms, 2), 'kNm');
      add('ot' + d, L('Pad overturning — ', 'การพลิกคว่ำของฐานราก — ') + (d === 'Y' ? L('wind on the face', 'ลมบนหน้าป้าย') : L('wind on the side', 'ลมด้านข้าง')), Md, Ms, 'kNm', R.chk('M*_dst ≤ M_stb (' + d + ')', Md, Ms, 'kNm'), 'stab');
      const Rs = g.mu * 0.9 * (g.Gs + Wpad + Wsoil);
      add('sl' + d, L('Sliding — ', 'การเลื่อนไถล — ') + (d === 'Y' ? L('wind on the face', 'ลมบนหน้าป้าย') : L('wind on the side', 'ลมด้านข้าง')), F, Rs, 'kN', R.chk('H* ≤ μ·0.9ΣG (' + d + ')', F, Rs, 'kN'), 'stab');
    });
    const bearing = (q, gG, d, gPad) => {
      const F = d === 'Y' ? Ff(q) : d === 'X' ? Fs(q) : 0, M = F * (zF - zbot) / 1000, N = gG * g.Gs + gPad * (Wpad + Wsoil), Bw = d === 'X' ? Lpad : Bpad, Lw = d === 'X' ? Bpad : Lpad, ee = M / N * 1000;
      return { qmax: ee <= Bw / 6 ? N / (Bw * Lw / 1e6) * (1 + 6 * ee / Bw) : ee < Bw / 2 ? 2 * N / (3 * Lw / 1000 * (Bw / 2 - ee) / 1000) : Infinity, ee, N, M };
    };
    let bw = null;
    COMB.forEach(c => { const b = bearing(qu, c.gG, c.d, c.gG >= 1.2 ? 1.2 : 0.9); if (!bw || b.qmax > bw.qmax) bw = Object.assign(b, { c }); });
    R.eq(L('Bearing (ULS)', 'แรงแบกทาน (ULS)'), 'e = M/N,  q_max = N(1 + 6e/B)/(BL) or 2N/(3L(B/2 − e)) — ' + bw.c.nm, f(bw.ee, 0) + ' mm, ' + f(bw.qmax, 1), 'kPa');
    add('br', L('Pad bearing pressure (ULS)', 'แรงแบกทานใต้ฐานราก (ULS)'), bw.qmax, g.qult, 'kPa', R.chk('q_max ≤ φ_g·q_ult', bw.qmax, g.qult, 'kPa', isFinite(bw.qmax) ? bw.qmax / g.qult : 99), 'stab');
    if (g.qa > 0) { const b = [bearing(qs, 1, 'Y', 1), bearing(qs, 1, 'X', 1)].reduce((a, c) => (c.qmax > a.qmax ? c : a)); add('brs', L('Pad bearing pressure (SLS)', 'แรงแบกทานใต้ฐานราก (SLS)'), b.qmax, g.qa, 'kPa', R.chk('q_max (G + W_s) ≤ q_a', b.qmax, g.qa, 'kPa', isFinite(b.qmax) ? b.qmax / g.qa : 99), 'stab'); }
    // pad reinforcement: cantilever beyond the base plate under q_max (bottom bars each way)
    {
      const q = isFinite(bw.qmax) ? bw.qmax : 0, cy = max(0, (Bpad - Bpl) / 2), cx = max(0, (Lpad - Lpl) / 2), d = Dpad - g.cover - g.db;
      const As = g.nbar * PI * g.db * g.db / 4, a2 = max(0.67, 0.85 - 0.0015 * g.fc);
      const phiM = b => { const aa = As * 500 / (a2 * g.fc * b); return 0.85 * As * 500 * (d - aa / 2) / 1e6; };
      const My = q * Lpad / 1000 * Math.pow(cy / 1000, 2) / 2, Mx = q * Bpad / 1000 * Math.pow(cx / 1000, 2) / 2;
      R.sec(L('Pad reinforcement', 'เหล็กเสริมฐานราก'), 'AS 3600 §8.1, §9.1.1');
      R.eq('M*', 'q_max·L·c²/2,  c = ' + f(cy, 0) + ' / ' + f(cx, 0) + ' mm', f(My, 2) + ' / ' + f(Mx, 2), 'kNm');
      R.eq('φM_u', g.nbar + 'N' + g.db + L(' bottom each way, d = ', ' ล่างแต่ละทิศ d = ') + f(d, 0) + ' mm', f(phiM(Lpad), 2) + ' / ' + f(phiM(Bpad), 2), 'kNm');
      add('padM', L('Pad bending (bottom bars)', 'การดัดฐานราก (เหล็กล่าง)'), max(My, Mx), min(phiM(Lpad), phiM(Bpad)), 'kNm', R.chk('M* ≤ φM_u', max(My, Mx), min(phiM(Lpad), phiM(Bpad)), 'kNm'), 'rc');
      const bmax = max(Lpad, Bpad), Asmin = 0.20 * Math.pow(Dpad / d, 2) * 0.6 * sq(g.fc) / 500 * bmax * d;
      add('padMin', L('Pad minimum reinforcement', 'เหล็กเสริมต่ำสุดของฐานราก'), Asmin, As, 'mm²', R.chk("A_st ≥ 0.20(D/d)²·(0.6√f'c/f_sy)·b·d (" + L('per direction, b = ', 'ต่อทิศ b = ') + f(bmax, 0) + ' mm)', Asmin, As, 'mm²'), 'rc');
    }

    // ---------- stub legs (two RHS) at the base plate
    R.sec(L('Stub legs at the base plate', 'ขาตั้งที่แผ่นฐาน'), 'AS 4100 §5.2, §5.11, §8.3');
    R.eq(L('Leg section', 'หน้าตัดขา'), 'A = ' + f(leg.A, 0) + ' mm², S_x = ' + f(leg.Sx / 1e3, 1) + ', Z_ex = ' + f(leg.ZeX / 1e3, 1) + ', Z_ey = ' + f(leg.ZeY / 1e3, 1) + ' ×10³ mm³', L('λ flange / web ', 'λ ปีก / เอว ') + f(leg.lf, 1) + ' / ' + f(leg.lw, 1), '');
    const phiMx = 0.9 * leg.fy * leg.ZeX / 1e6, phiMy = 0.9 * leg.fy * leg.ZeY / 1e6, phiNs = 0.9 * leg.fy * leg.A / 1e3, phiVv = 0.9 * 0.6 * leg.fy * 2 * (leg.d - 2 * leg.t) * leg.t / 1e3;
    R.eq('φM_sx, φM_sy, φN_s, φV_v', '0.9·f_y·Z_e, 0.9·f_y·A, 0.9·0.6·f_y·A_w', f(phiMx, 2) + ', ' + f(phiMy, 2) + ' kNm, ' + f(phiNs, 1) + ', ' + f(phiVv, 1), 'kN');
    const legAct = a => a.d === 'Y' ? { N: a.N / 2, Mx: a.M / 2, My: 0, V: a.V / 2 + a.T / (sL / 1000) } : a.d === 'X' ? { N: a.N / 2 - a.M / (sL / 1000), Mx: 0, My: 0, V: a.V / 2 } : { N: a.N / 2, Mx: 0, My: 0, V: 0 };
    let lw = null;
    COMB.forEach(c => { const a = legAct(act(c, qu, z0)), u = abs(a.N) / phiNs + a.Mx / phiMx + a.My / phiMy; if (!lw || u > lw.u) lw = { u, a, c }; });
    R.txt(L('Wind on the face: each leg bends about its strong axis (M*/2) and torsion adds T*/s to the leg shear. Wind on the side: the overturning moment becomes an axial couple N = M*/s between the legs.', 'ลมบนหน้าป้าย: ขาแต่ละขาดัดรอบแกนหลัก (M*/2) และแรงบิดเพิ่มแรงเฉือน T*/s ลมด้านข้าง: โมเมนต์พลิกคว่ำเป็นแรงคู่ N = M*/s ระหว่างขา'));
    add('legNM', L('Stub leg: axial + bending', 'ขาตั้ง: แรงตามแนวแกน + ดัด'), lw.u, 1, '', R.chk('N*/φN_s + M*/φM_s ≤ 1 — ' + lw.c.nm, lw.u, 1, '', lw.u), 'steel');
    const lvMax = COMB.reduce((m, c) => max(m, legAct(act(c, qu, z0)).V), 0);
    add('legV', L('Stub leg: shear', 'ขาตั้ง: แรงเฉือน'), lvMax, phiVv, 'kN', R.chk('V* ≤ φV_v', lvMax, phiVv, 'kN'), 'steel');

    // ---------- weld: each leg to the base plate (fillet all round)
    R.sec(L('Weld: legs to base plate', 'รอยเชื่อม: ขากับแผ่นฐาน'), 'AS 4100 §9.7.3.10 (E49XX, SP, φ = 0.8)');
    const sw = g.sw, phiVw = 0.8 * 0.6 * 490 * sw / Math.SQRT2 / 1e3;
    const Lw = 2 * (leg.d + leg.b), Zwx = leg.b * leg.d + leg.d * leg.d / 3;
    let ww = null;
    COMB.forEach(c => { const a = legAct(act(c, qu, z0)), vn = max(0, -a.N) * 1e3 / Lw + a.Mx * 1e6 / Zwx, vs = a.V * 1e3 / (2 * leg.d), v = Math.hypot(vn, vs) / 1e3; if (!ww || v > ww.v) ww = { v, c }; });
    R.eq(L('Weld group per leg', 'กลุ่มรอยเชื่อมต่อขา'), 'L_w = 2(d + b) = ' + f(Lw, 0) + ' mm,  Z_w = bd + d²/3 = ' + f(Zwx, 0) + ' mm²', '', '');
    R.eq('v*_w', '√((N*/L_w + M*/Z_w)² + (V*/2d)²) — ' + ww.c.nm, ww.v, 'kN/mm');
    R.eq('φv_w', '0.8 × 0.6 × 490 × ' + sw + '/√2', phiVw, 'kN/mm');
    add('w', L('Fillet weld legs-to-plate', 'รอยเชื่อมพอกขา-แผ่นฐาน'), ww.v, phiVw, 'kN/mm', R.chk('v*_w ≤ φv_w', ww.v, phiVw, 'kN/mm'), 'steel');
    if (sw > leg.t + 1) warn.push(L('Fillet weld much larger than the leg wall — use a weld size close to the wall thickness.', 'รอยเชื่อมพอกใหญ่กว่าผนังขามาก — ใช้ขนาดใกล้เคียงความหนาผนัง'));

    // ---------- hold-down bolts (4 at the plate corners)
    R.sec(L('Hold-down bolts', 'สลักยึด'), 'AS 4100 §9.3.2');
    const bt = g.bolt, bd = dOf(bt), [Asb, Acb] = BOLTS[bt] || [157, 144], fuf = BGRADE[g.bgrade] || 400;
    const phiNtf = 0.8 * Asb * fuf / 1e3, phiVf = 0.8 * 0.62 * fuf * Acb / 1e3;
    const zY = yb + leg.d / 2, zX = xb + sL / 2 + leg.b / 2, rB = Math.hypot(xb, yb);
    R.eq(L('Bolts', 'สลัก'), '4 × ' + bt + ' ' + L('grade ', 'เกรด ') + g.bgrade + ' @ x = ±' + f(xb, 0) + ', y = ±' + f(yb, 0) + ' mm', f(phiNtf, 1) + ' / ' + f(phiVf, 1), 'kN', 'φN_tf / φV_f');
    R.eq(L('Lever arms', 'แขนโมเมนต์'), 'z_Y = y_b + d_leg/2,  z_X = x_b + s/2 + b_leg/2', f(zY, 0) + ' / ' + f(zX, 0), 'mm');
    const bF = a => {
      const z = a.d === 'X' ? zX : zY, Tr = max(0, a.M * 1e6 / z / 1e3 - a.N / 2);
      const Vb = Math.hypot(a.V / 4, a.T * 1e6 / (4 * rB) / 1e3);
      return { Tr, Tb: Tr / 2, Vb };
    };
    let bb = null;
    COMB.forEach(c => { const a = act(c, qu, z0), q = bF(a), u = Math.pow(q.Tb / phiNtf, 2) + Math.pow(q.Vb / phiVf, 2); if (!bb || u > bb.u) bb = { u, q, c, a }; });
    R.eq(L('Governing bolt actions', 'แรงในสลักวิกฤต'), 'N*_tf = (M*/z − N*/2)/2,  V*_f = √((V*/4)² + (T*/4r)²) — ' + bb.c.nm, f(bb.q.Tb, 2) + ' / ' + f(bb.q.Vb, 2), 'kN');
    add('bT', L('Bolt tension', 'แรงดึงสลัก'), bb.q.Tb, phiNtf, 'kN', R.chk('N*_tf ≤ φN_tf', bb.q.Tb, phiNtf, 'kN'), 'conn');
    add('bV', L('Bolt shear', 'แรงเฉือนสลัก'), bb.q.Vb, phiVf, 'kN', R.chk('V*_f ≤ φV_f', bb.q.Vb, phiVf, 'kN'), 'conn');
    add('bTV', L('Bolt tension + shear', 'แรงดึง + เฉือนสลัก'), bb.u, 1, '', R.chk('(V*/φV_f)² + (N*/φN_tf)² ≤ 1', bb.u, 1, '', bb.u), 'conn');

    // anchorage in the pad (AS 5216, cast-in headed, cracked)
    R.sec(L('Anchorage in the pad', 'การยึดในฐานราก'), 'AS 5216:2021 §7 (cracked concrete, φ_Mc = 1/1.5)');
    const hef = g.hef, fc = g.fc, phic = 1 / 1.5, ccr = 1.5 * hef, scr = 3 * hef;
    const cY = (Bpad - Bpl) / 2 + e, cX = (Lpad - Lpl) / 2 + e, cmin = min(cX, cY);
    const N0 = 8.9 * sq(fc) * Math.pow(hef, 1.5) / 1e3;
    // tension row = 2 bolts 2·x_b apart (wind on the face) — projected area with the edges
    const sRow = 2 * xb, wx = min(sRow, scr) + min(cX, ccr) + min(cX, ccr), wy = min(cY, ccr) + min(2 * yb + cY, ccr);
    const AcN = min(2 * scr * scr, wx * wy), psiS = min(1, 0.7 + 0.3 * cmin / ccr), psiRe = min(1, 0.5 + hef / 200);
    const NRdc = phic * N0 * AcN / (scr * scr) * psiS * psiRe;
    const AF = NUT_AF[bt] || 1.5 * bd, NRdp = phic * 7.5 * (0.866 * AF * AF - PI * bd * bd / 4) * fc / 1e3;
    R.eq('N⁰_Rk,c', "8.9·√f'c·h_ef^1.5", N0, 'kN');
    R.eq('φN_Rk,c (2 bolts)', 'A_c,N/A⁰_c,N = ' + f(AcN / (scr * scr), 2) + ', ψ_s,N = ' + f(psiS, 3) + ', c = ' + f(cY, 0) + ' / ' + f(cX, 0) + ' mm', NRdc, 'kN');
    R.eq('φN_Rk,p', L('pull-out of the nut head, k₂ = 7.5', 'การถอนของหัวน็อต k₂ = 7.5'), NRdp, 'kN');
    add('aC', L('Anchors: concrete cone', 'สลักยึด: กรวยคอนกรีต'), 2 * bb.q.Tb, NRdc, 'kN', R.chk('2·N*_tf ≤ φN_Rk,c', 2 * bb.q.Tb, NRdc, 'kN'), 'anch');
    add('aP', L('Anchors: pull-out', 'สลักยึด: การถอน'), bb.q.Tb, NRdp, 'kN', R.chk('N*_tf ≤ φN_Rk,p', bb.q.Tb, NRdp, 'kN'), 'anch');
    const c1 = cY, lf = min(hef, 12 * bd), al = 0.1 * Math.pow(lf / c1, 0.5), be = 0.1 * Math.pow(bd / c1, 0.2);
    const V0 = 1.7 * Math.pow(bd, al) * Math.pow(lf, be) * sq(fc) * Math.pow(c1, 1.5) / 1e3;
    const AcV = (min(cX, 1.5 * c1) * 2 + 2 * xb) * min(Dpad, 1.5 * c1), VRdc = phic * V0 * min(AcV / (4.5 * c1 * c1), 2) * max(1, sq(1.5 * c1 / Dpad));
    const Vtot = COMB.reduce((m, c) => max(m, act(c, qu, z0).V), 0);
    R.eq('φV_Rk,c', L('edge breakout towards the pad edge, c₁ = ', 'ขอบคอนกรีตแตกทางขอบฐาน c₁ = ') + f(c1, 0) + ' mm', VRdc, 'kN');
    add('aV', L('Anchors: concrete edge (shear)', 'สลักยึด: ขอบคอนกรีต (เฉือน)'), Vtot, VRdc, 'kN', R.chk('V* ≤ φV_Rk,c', Vtot, VRdc, 'kN'), 'anch');
    if (hef + 50 > Dpad) warn.push(L('Bolt embedment leaves less than 50 mm of concrete below the head.', 'ความลึกฝังสลักเหลือคอนกรีตใต้หัวน้อยกว่า 50 มม.'));

    // ---------- base plate bending (tension bolts) and bearing (compression)
    R.sec(L('Base plate', 'แผ่นฐาน'), 'AS 4100 §5.2 (plate), AS 3600 §12.6');
    const dx = max(0, xb - (sL / 2 + leg.b / 2)), dy = max(0, yb - leg.d / 2), m = max(10, Math.hypot(dx, dy)), beff = min(2 * m, Bpl, Lpl / 2);
    const Mp = bb.q.Tb * m / 1e3, phiMp = 0.9 * g.fyp * beff * tpl * tpl / 4 / 1e6;
    R.eq(L('Tension bolt to leg', 'สลักรับแรงดึงถึงขา'), 'm = √(Δx² + Δy²) = √(' + f(dx, 0) + '² + ' + f(dy, 0) + '²),  b_eff = 2m', f(m, 0) + ' / ' + f(beff, 0), 'mm');
    add('plT', L('Base plate: bending at a tension bolt', 'แผ่นฐาน: การดัดที่สลักรับแรงดึง'), Mp, phiMp, 'kNm', R.chk('N*_tf·m ≤ 0.9·f_y·b_eff·t²/4', Mp, phiMp, 'kNm'), 'conn');
    const fb = min(0.6 * 0.85 * fc * 2, 0.6 * 0.85 * fc * sq(min(Lpad * Bpad, 9 * Lpl * Bpl) / (Lpl * Bpl)));
    const C = max(0, bb.q.Tr + bb.a.N), Ycomp = C * 1e3 / (fb * Lpl);
    R.eq(L('Bearing under the plate', 'แรงแบกทานใต้แผ่น'), "f_b = φ·0.85f'c·√(A₂/A₁) ≤ 2φ0.85f'c;  Y = C/(f_b·L)", f(fb, 2) + ' MPa, Y = ' + f(Ycomp, 1), 'mm');
    add('plC', L('Base plate: bearing length', 'แผ่นฐาน: ความยาวแบกทาน'), Ycomp, Bpl / 2 + leg.d / 2, 'mm', R.chk('Y ≤ B/2 + d_leg/2', Ycomp, Bpl / 2 + leg.d / 2, 'mm'), 'conn');

    // ---------- splice: framework base plate (3) to stub top plate (2)
    R.sec(L('Splice bolts: framework to stub (plates 2 / 3)', 'สลักรอยต่อ: โครงกับขาตั้ง (แผ่น 2 / 3)'), 'AS 4100 §9.3.2');
    const sb = g.sbolt, sbd = dOf(sb), [sAs, sAc] = BOLTS[sb] || [84.3, 76.3], sfu = BGRADE[g.sgrade] || 830;
    const sPhiN = 0.8 * sAs * sfu / 1e3, sPhiV = 0.8 * 0.62 * sfu * sAc / 1e3;
    // pattern (plate 3): 4 bolts at (±x1, ±y1) and 2 at (±x2, 0); rotation about the compression edge of the 200 plate
    const pts = [[g.sx1, g.sy1], [-g.sx1, g.sy1], [g.sx1, -g.sy1], [-g.sx1, -g.sy1], [g.sx2, 0], [-g.sx2, 0]], hB = g.sB / 2, hL = g.sL / 2;
    const S2y = pts.reduce((s, p) => s + Math.pow(p[1] + hB, 2), 0), S2x = pts.reduce((s, p) => s + Math.pow(p[0] + hL, 2), 0), Sr2 = pts.reduce((s, p) => s + p[0] * p[0] + p[1] * p[1], 0);
    let sw2 = null;
    COMB.forEach(c => {
      const a = act(c, qu, zb), N = a.N - (g.Gs * c.gG) * 0.3;                  // part of the weight is below the splice (stub)
      const Tm = a.d === 'X' ? a.M * 1e6 * (g.sx1 + hL) / S2x : a.M * 1e6 * (g.sy1 + hB) / S2y;
      const Tb = max(0, Tm / 1e3 - N / 6), rmax = Math.hypot(g.sx1, g.sy1), Vb = Math.hypot(a.V / 6, a.T * 1e6 * rmax / Sr2 / 1e3);
      const u = Math.pow(Tb / sPhiN, 2) + Math.pow(Vb / sPhiV, 2); if (!sw2 || u > sw2.u) sw2 = { u, Tb, Vb, c };
    });
    R.eq(L('Splice bolts', 'สลักรอยต่อ'), '6 × ' + sb + ' ' + L('grade ', 'เกรด ') + g.sgrade + ', ' + L('plates ', 'แผ่น ') + g.sL + ' × ' + g.sB + ' mm', f(sPhiN, 1) + ' / ' + f(sPhiV, 1), 'kN', 'φN_tf / φV_f');
    R.eq(L('Governing splice bolt', 'สลักรอยต่อวิกฤต'), 'N* = M*·y′_max/Σy′² (' + L('rotation about the compression edge', 'หมุนรอบขอบรับแรงอัด') + '),  V* = √((V*/6)² + (T*·r/Σr²)²) — ' + sw2.c.nm, f(sw2.Tb, 2) + ' / ' + f(sw2.Vb, 2), 'kN');
    add('sT', L('Splice bolt tension', 'แรงดึงสลักรอยต่อ'), sw2.Tb, sPhiN, 'kN', R.chk('N*_tf ≤ φN_tf', sw2.Tb, sPhiN, 'kN'), 'conn');
    add('sTV', L('Splice bolt tension + shear', 'แรงดึง + เฉือนสลักรอยต่อ'), sw2.u, 1, '', R.chk('(V*/φV_f)² + (N*/φN_tf)² ≤ 1', sw2.u, 1, '', sw2.u), 'conn');
    R.txt(L('The aluminium cladding, the 50x25x3 framework members and their welds are the sign manufacturer’s design and are not checked here.', 'แผ่นอลูมิเนียม โครง 50x25x3 และรอยเชื่อมเป็นงานออกแบบของผู้ผลิตป้าย ไม่ได้ตรวจสอบในที่นี้'));

    warn.splice(0, warn.length, ...warn.filter(Boolean));
    return { code: 'AS', elem: 'signcol', checks, rep: R, warn: [...new Set(warn)], wind: { Vu, Vs, qu, qs, FY: Ff(qu), FX: Fs(qu) }, Wpad, Wsoil,
      geo: { Wp, Dpn, Hp, zb, dcov, Lpad, Bpad, Dpad, Lpl, Bpl, tpl, xb, yb, sL, leg: { d: leg.d, b: leg.b }, bolt: bt, hef, sw, sbolt: sb } };
  }

  // ------------------------------------------------------------------ drawing: elevation + base plate plan + pad plan
  function sketch(r, T) {
    const g = r.geo, W = 440, fmt = v => f(v, 0);
    const css = `<style>.sc-f{fill:color-mix(in srgb,#e11d48 16%,transparent);stroke:#e11d48;stroke-width:1.3}.sc-p{fill:color-mix(in srgb,#94a3b8 25%,transparent);stroke:currentColor;stroke-width:1.2}.sc-t{font:10px var(--f-sans,sans-serif);fill:currentColor}.sc-h{font:700 10.5px var(--f-sans,sans-serif);fill:currentColor;letter-spacing:.04em}.sc-d{stroke:currentColor;stroke-width:.6;opacity:.75;fill:none}.sc-g{stroke:#78716c;stroke-width:1.2}.sc-b{fill:none;stroke:#2563eb;stroke-width:1.4}.sc-l{fill:none;stroke:currentColor;stroke-width:1.6}</style>`;
    const dimH = (x1, x2, y, t) => `<path d="M${x1} ${y}H${x2}M${x1} ${y - 3}v6M${x2} ${y - 3}v6" class="sc-d"/><text x="${(x1 + x2) / 2}" y="${y - 3}" text-anchor="middle" class="sc-t">${t}</text>`;
    const dimV = (x, y1, y2, t) => `<path d="M${x} ${y1}V${y2}M${x - 3} ${y1}h6M${x - 3} ${y2}h6" class="sc-d"/><text x="${x - 4}" y="${(y1 + y2) / 2 + 3}" text-anchor="end" class="sc-t">${t}</text>`;
    // elevation (left)
    const zTop = g.zb + g.Hp, zBot = -(g.dcov + g.Dpad), H = 400, k = min((H - 40) / (zTop - zBot), 170 / g.Lpad);
    const ex = 40 + g.Lpad / 2 * k, X = x => ex + x * k, Z = z => 20 + (zTop - z) * k;
    let s = `<text x="8" y="12" class="sc-h">${T('ELEVATION', 'รูปด้าน')}</text>`;
    s += `<rect x="${X(-g.Wp / 2)}" y="${Z(zTop)}" width="${g.Wp * k}" height="${g.Hp * k}" class="sc-p"/>`;
    s += `<line x1="8" y1="${Z(0)}" x2="${X(g.Lpad / 2) + 20}" y2="${Z(0)}" class="sc-g"/><text x="10" y="${Z(0) - 3}" class="sc-t">${T('G.L.', 'ระดับดิน')}</text>`;
    s += `<rect x="${X(-g.Lpad / 2)}" y="${Z(-g.dcov)}" width="${g.Lpad * k}" height="${g.Dpad * k}" class="sc-f"/>`;
    s += `<rect x="${X(-g.Lpl / 2)}" y="${Z(-g.dcov) - max(2, g.tpl * k)}" width="${g.Lpl * k}" height="${max(2, g.tpl * k)}" fill="currentColor"/>`;
    [-1, 1].forEach(sg => { s += `<rect x="${X(sg * g.sL / 2 - g.leg.b / 2)}" y="${Z(g.zb)}" width="${g.leg.b * k}" height="${(g.zb + g.dcov) * k}" class="sc-l"/>`; });
    s += dimV(X(-g.Lpad / 2) - 8, Z(0), Z(zTop), fmt(zTop));
    s += dimH(X(-g.Lpad / 2), X(g.Lpad / 2), Z(zBot) + 14, fmt(g.Lpad));
    s += `<text x="${X(g.Lpad / 2) + 4}" y="${Z(-g.dcov - g.Dpad / 2)}" class="sc-t">D ${fmt(g.Dpad)}</text>`;
    s += `<path d="M${X(g.Wp / 2) + 30} ${Z(g.zb + g.Hp / 2)}h-22" class="sc-d" stroke-width="1.6"/><path d="M${X(g.Wp / 2) + 8} ${Z(g.zb + g.Hp / 2)}l6 -4v8z" fill="currentColor"/><text x="${X(g.Wp / 2) + 12}" y="${Z(g.zb + g.Hp / 2) - 6}" class="sc-t">W</text>`;
    // base plate plan (right top) and pad plan (right bottom)
    const bx = 220, bw = W - bx - 10, kb = bw / (g.Lpl + 60), cx = bx + bw / 2, cy = 40 + g.Bpl / 2 * kb;
    s += `<text x="${bx}" y="12" class="sc-h">${T('BASE PLATE', 'แผ่นฐาน')}</text>`;
    s += `<rect x="${cx - g.Lpl / 2 * kb}" y="${cy - g.Bpl / 2 * kb}" width="${g.Lpl * kb}" height="${g.Bpl * kb}" class="sc-p"/>`;
    [-1, 1].forEach(sg => { s += `<rect x="${cx + (sg * g.sL / 2 - g.leg.b / 2) * kb}" y="${cy - g.leg.d / 2 * kb}" width="${g.leg.b * kb}" height="${g.leg.d * kb}" class="sc-l"/>`; });
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([a, b]) => { s += `<circle cx="${cx + a * g.xb * kb}" cy="${cy + b * g.yb * kb}" r="${max(2.5, dOf(g.bolt) / 2 * kb)}" class="sc-b"/>`; });
    s += dimH(cx - g.Lpl / 2 * kb, cx + g.Lpl / 2 * kb, cy - g.Bpl / 2 * kb - 6, fmt(g.Lpl));
    s += `<text x="${cx}" y="${cy + g.Bpl / 2 * kb + 14}" text-anchor="middle" class="sc-t">${fmt(g.Lpl)} × ${fmt(g.Bpl)} × ${fmt(g.tpl)} PL · 4-${g.bolt} · h_ef ${fmt(g.hef)}</text>`;
    s += `<text x="${cx}" y="${cy + g.Bpl / 2 * kb + 27}" text-anchor="middle" class="sc-t">2 × ${g.leg.d}×${g.leg.b} RHS @ ${fmt(g.sL)} · ${g.sw} ${T('mm FW all round', 'มม. เชื่อมรอบ')}</text>`;
    const py0 = cy + g.Bpl / 2 * kb + 52, kp = min((bw - 10) / (g.Lpad + 40), (H - py0 - 30) / (g.Bpad + 40)), pcy = py0 + 12 + g.Bpad / 2 * kp;
    s += `<text x="${bx}" y="${py0}" class="sc-h">${T('PAD PLAN', 'ผังฐานราก')}</text>`;
    s += `<rect x="${cx - g.Lpad / 2 * kp}" y="${pcy - g.Bpad / 2 * kp}" width="${g.Lpad * kp}" height="${g.Bpad * kp}" class="sc-f"/><rect x="${cx - g.Lpl / 2 * kp}" y="${pcy - g.Bpl / 2 * kp}" width="${g.Lpl * kp}" height="${g.Bpl * kp}" class="sc-p"/>`;
    s += dimH(cx - g.Lpad / 2 * kp, cx + g.Lpad / 2 * kp, pcy + g.Bpad / 2 * kp + 14, fmt(g.Lpad));
    s += `<text x="${cx - g.Lpad / 2 * kp + 4}" y="${pcy - g.Bpad / 2 * kp + 12}" class="sc-t">${fmt(g.Lpad)} × ${fmt(g.Bpad)} × ${fmt(g.Dpad)}</text>`;
    return `<svg viewBox="0 0 ${W} ${H + 10}" class="sec-svg signcol-svg" role="img" aria-label="${T('Sign column elevation, base plate and pad', 'รูปด้านเสาป้าย แผ่นฐาน และฐานราก')}">${css}${s}</svg>`;
  }

  G.SIGNCOL = { design, sketch, rhs };
})(typeof window !== 'undefined' ? window : globalThis);
