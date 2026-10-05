/* StructCap — steel post-and-rail bridge barrier.
   Inelastic (plastic mechanism) method of AASHTO LRFD A13.3.2 as set out in Austroads AP-G108-25
   "Standardised Bridge Barrier Design Guidelines" Section 5.4 (Equations 9–16), with design loads from
   AS 5100.2 (Austroads Table 5.1) or the AASHTO test levels used by the Thai Department of Highways.
   Steel member and connection checks follow AISC 360 / EIT (Thai code) or AS 4100 (Australian code).
   Units inside: N, mm, MPa; reported in kN, kN·m.  Worked example: AP-G108-25 Appendix A.2 (Design example 2). */
(function (G) {
  'use strict';
  const RC = G.RC, f = RC.f, PI = Math.PI, sq = Math.sqrt, max = Math.max, min = Math.min, abs = Math.abs;

  // Austroads AP-G108-25 Table 5.1 (from AS 5100.2:2017) and AASHTO LRFD Table A13.2-1 — kN, mm
  const LEVELS = {
    'AS-low': { n: ['Low (TL-2) – AS 5100.2', 'ต่ำ (TL-2) – AS 5100.2'], Ft: 150, Fl: 50, Fv: 22, Lt: 1100, Lv: 5500, He: 600 },
    'AS-regular': { n: ['Regular (TL-4) – AS 5100.2', 'ปกติ (TL-4) – AS 5100.2'], Ft: 300, Fl: 100, Fv: 100, Lt: 1200, Lv: 6000, He: 900 },
    'AS-medium': { n: ['Medium (TL-5) – AS 5100.2', 'ปานกลาง (TL-5) – AS 5100.2'], Ft: 600, Fl: 200, Fv: 300, Lt: 2400, Lv: 12000, He: 1200 },
    'AS-tl6': { n: ['Special (TL-6) – AS 5100.2', 'พิเศษ (TL-6) – AS 5100.2'], Ft: 750, Fl: 250, Fv: 375, Lt: 2400, Lv: 12000, He: 1800 },
    'AS-special': { n: ['Special (> TL-6) – AS 5100.2', 'พิเศษ (> TL-6) – AS 5100.2'], Ft: 1200, Fl: 400, Fv: 600, Lt: 2500, Lv: 15000, He: 1500 },
    'TL-1': { n: ['AASHTO TL-1', 'AASHTO TL-1'], Ft: 60, Fl: 20, Fv: 20, Lt: 1220, Lv: 5500, He: 460 },
    'TL-2': { n: ['AASHTO TL-2', 'AASHTO TL-2'], Ft: 120, Fl: 40, Fv: 20, Lt: 1220, Lv: 5500, He: 510 },
    'TL-3': { n: ['AASHTO TL-3', 'AASHTO TL-3'], Ft: 240, Fl: 80, Fv: 20, Lt: 1220, Lv: 5500, He: 610 },
    'TL-4': { n: ['AASHTO TL-4 (DOH)', 'AASHTO TL-4 (กรมทางหลวง)'], Ft: 240, Fl: 80, Fv: 80, Lt: 1070, Lv: 5500, He: 810 },
    'TL-5': { n: ['AASHTO TL-5', 'AASHTO TL-5'], Ft: 550, Fl: 180, Fv: 355, Lt: 2440, Lv: 12200, He: 1070 },
    'TL-6': { n: ['AASHTO TL-6', 'AASHTO TL-6'], Ft: 780, Fl: 260, Fv: 355, Lt: 2440, Lv: 12200, He: 1420 }
  };
  // bolt materials: f_uf (MPa)
  const BOLTS = { '4.6': 400, '8.8': 830, 'F1554-36': 400, 'F1554-55': 517, 'F1554-105': 862 };

  // plastic modulus about the axis normal to the load: d = depth in the load direction, b = other side, t wall.
  // Cold-formed hollow sections, corner radii r_o = 2.5t, r_i = 1.5t (AS/NZS 1163 / TIS 107 tables reproduce within 1 %).
  function hollow(shape, d, b, t) {
    if (shape === 'CHS') { const Do = d, Di = d - 2 * t; return { S: (Do ** 3 - Di ** 3) / 6, A: PI / 4 * (Do * Do - Di * Di), Aw: PI / 8 * (Do * Do - Di * Di), shape, d, b: d, t }; }
    if (shape === 'SHS') b = d;
    const ro = 2.5 * t, ri = 1.5 * t, w = (y, H, B, r) => { const yy = abs(y); if (yy > H / 2) return 0; if (yy <= H / 2 - r) return B; const dy = yy - (H / 2 - r); return B - 2 * r + 2 * sq(max(0, r * r - dy * dy)); };
    let S = 0, A = 0; const n = 4000, h = d / 2 / n;
    for (let i = 0; i < n; i++) { const y = (i + 0.5) * h, ww = w(y, d, b, ro) - w(y, d - 2 * t, b - 2 * t, ri); S += ww * y * h; A += ww * h; }
    return { S: 2 * S, A: 2 * A, Aw: 2 * (d - 2 * t) * t, shape, d, b, t };   // A_w: webs parallel to the load
  }
  const secName = s => s.shape === 'CHS' ? s.d + '×' + s.t + ' CHS' : s.d + '×' + s.b + '×' + s.t + ' ' + s.shape;

  function design(x, lang) {
    const R = new RC.Rep(lang), L = (a, b) => R.L(a, b), warn = [], checks = [];
    const code = x.code, g = x.geo, phi = x.coef.phi || 0.9;
    const lv = g.level === 'custom' ? Object.assign({ n: [L('User-defined', 'กำหนดเอง'), ''] }, x.load) : LEVELS[g.level] || LEVELS['AS-regular'];
    const Ft = lv.Ft * 1e3, Lt = lv.Lt, Lsp = g.L;

    // ---------- 1 design loads
    R.sec(L('Design loads and performance level', 'แรงออกแบบและระดับสมรรถนะ'), g.level.startsWith('AS') ? 'AP-G108-25 Table 5.1 · AS 5100.2' : g.level === 'custom' ? '' : 'AASHTO LRFD Table A13.2-1');
    R.eq(L('Performance level', 'ระดับสมรรถนะ'), g.level === 'custom' ? L('user defined', 'กำหนดเอง') : L(lv.n[0], lv.n[1]), '', '');
    R.eq('F_t', L('ultimate transverse outward load', 'แรงตามขวางประลัย'), lv.Ft, 'kN').eq('F_L', L('longitudinal load', 'แรงตามยาว'), lv.Fl, 'kN').eq('F_v', L('vertical downward load', 'แรงดิ่งลง'), lv.Fv, 'kN');
    R.eq('L_t = L_L', L('contact length', 'ความยาวสัมผัส'), Lt, 'mm').eq('L_v', L('vertical contact length', 'ความยาวสัมผัสแรงดิ่ง'), lv.Lv, 'mm').eq('H_e', L('minimum effective height', 'ความสูงประสิทธิผลน้อยสุด'), lv.He, 'mm');

    // ---------- 2 rail and post capacities
    R.sec(L('Ultimate capacities of the rails and post', 'กำลังประลัยของราวและเสา'), 'AP-G108-25 Eq. 11, 12 · AASHTO A13.3.2');
    const rails = g.rails.map((r, i) => { const s = r.S > 0 ? Object.assign(hollow(r.shape, r.d, r.b, r.t), { S: r.S, given: true }) : hollow(r.shape, r.d, r.b, r.t); return Object.assign({ i, y: r.y, use: r.use, fy: r.fy, sec: s, vert: r.shape === 'CHS' ? r.d : r.shape === 'SHS' ? r.d : r.b }, { Mp0: phi * r.fy * s.S }); });
    const used = rails.filter(r => r.use), ytop = used.length ? Math.max(...used.map(r => r.y)) : 1;
    if (!used.length) throw new Error('no rails');
    rails.forEach(r => { r.c = r.use ? r.y / ytop : 0; r.Mp = r.c * r.Mp0; });
    rails.forEach(r => {
      R.eq(L('Rail ', 'ราว ') + (r.i + 1) + ' (' + f(r.y, 0) + ' mm)', secName(r.sec) + ', S = ' + f(r.sec.S / 1e3, 1) + '×10³ mm³' + (r.sec.given ? L(' (given)', ' (กำหนด)') : ''), r.Mp0 / 1e6, 'kN·m', 'M_p = φ f_y S');
      if (r.use && r.c < 0.9999) R.eq(L('  contribution', '  ส่วนร่วม'), 'h_' + (r.i + 1) + '/h_top × M_p = ' + f(r.y, 0) + '/' + f(ytop, 0) + ' × M_p', r.Mp / 1e6, 'kN·m');
      if (!r.use) R.txt(L('Rail ' + (r.i + 1) + ' is not taken to resist the design load (maximises Y*).', 'ราว ' + (r.i + 1) + ' ไม่นำมาคิดรับแรงออกแบบ (เพื่อให้ Y* สูงสุด)'));
    });
    const Mp = used.reduce((a, r) => a + r.Mp, 0);
    const Ystar = used.reduce((a, r) => a + r.Mp * r.y, 0) / Mp;
    const post = Object.assign(hollow(g.post.shape, g.post.d, g.post.b, g.post.t), g.post.S > 0 ? { S: g.post.S, given: true } : {});
    const MpPost = phi * g.post.fy * post.S, Pp = MpPost / Ystar;
    R.eq('ΣM_p', L('rails contributing to the plastic hinge', 'ราวที่ร่วมเกิดจุดหมุนพลาสติก'), Mp / 1e6, 'kN·m');
    R.eq('M_p,post', 'φ f_y S = ' + f(phi, 2) + ' × ' + f(g.post.fy, 0) + ' × ' + f(post.S / 1e3, 1) + '×10³  (' + secName(post) + ')', MpPost / 1e6, 'kN·m');
    R.eq('Y*', 'Σ M_p,i y_i / Σ M_p,i', Ystar, 'mm', 'Eq. 14');
    R.eq('P_p', 'M_p,post / Y*', Pp / 1e3, 'kN', 'Eq. 12');

    // ---------- 3 barrier resistance — plastic mechanisms over N spans
    R.sec(L('Barrier resistance — plastic mechanisms', 'กำลังต้านทานของราว — กลไกพลาสติก'), 'AP-G108-25 Eq. 9, 10, 13');
    R.txt(L('Interior: odd N → R = [16M_p + (N−1)(N+1) P_p L] / (2NL − L_t); even N → R = [16M_p + N² P_p L] / (2NL − L_t). End post failing: R = [2M_p + 2P_p L Σi] / (2NL − L_t).', 'ช่วงกลาง: N คี่ → R = [16M_p + (N−1)(N+1) P_p L] / (2NL − L_t); N คู่ → R = [16M_p + N² P_p L] / (2NL − L_t) — เสาปลายวิบัติ: R = [2M_p + 2P_p L Σi] / (2NL − L_t)'));
    const NM = max(1, min(12, x.coef.Nmax | 0 || 6)), inter = [], ends = [];
    for (let N = 1; N <= NM; N++) {
      const den = 2 * N * Lsp - Lt; if (den <= 0) { inter.push({ N, R: Infinity }); ends.push({ N, R: Infinity }); continue; }
      const Ri = (N % 2 ? 16 * Mp + (N - 1) * (N + 1) * Pp * Lsp : 16 * Mp + N * N * Pp * Lsp) / den;
      const Re = (2 * Mp + 2 * Pp * Lsp * (N * (N + 1) / 2)) / den;
      inter.push({ N, R: Ri / 1e3 }); ends.push({ N, R: Re / 1e3 });
      R.eq('N = ' + N, L('interior', 'ช่วงกลาง') + ' / ' + L('end', 'ปลาย'), f(Ri / 1e3, 1) + ' / ' + f(Re / 1e3, 1), 'kN');
    }
    const crit = inter.reduce((a, q) => (q.R < a.R ? q : a)), critE = ends.reduce((a, q) => (q.R < a.R ? q : a));
    if (crit.N === NM) warn.push(L('The lowest interior resistance is at the largest N checked — increase the number of spans examined.', 'กำลังต่ำสุดอยู่ที่ N มากสุดที่ตรวจ — ควรเพิ่มจำนวนช่วงที่ตรวจ'));
    R.chk(L('Interior: F_t ≤ R* (N = ', 'ช่วงกลาง: F_t ≤ R* (N = ') + crit.N + ')', lv.Ft, crit.R, 'kN');
    checks.push({ name: L('Barrier resistance R*, interior (N = ' + crit.N + ')', 'กำลังต้านทาน R* ช่วงกลาง (N = ' + crit.N + ')'), Ed: lv.Ft, Rd: crit.R, unit: 'kN', ur: lv.Ft / crit.R });
    if (x.coef.ends !== 'no') { R.chk(L('End post: F_t ≤ R (N = ', 'เสาปลาย: F_t ≤ R (N = ') + critE.N + ')', lv.Ft, critE.R, 'kN'); checks.push({ name: L('Barrier resistance at a segment end (N = ' + critE.N + ')', 'กำลังต้านทานที่ปลายช่วงราว (N = ' + critE.N + ')'), Ed: lv.Ft, Rd: critE.R, unit: 'kN', ur: lv.Ft / critE.R }); }

    // ---------- 4 effective height
    R.sec(L('Effective height of the barrier', 'ความสูงประสิทธิผลของราว'), 'AP-G108-25 Eq. 14, Section 5.2');
    const Rstar = crit.R; let sumR = 0; const shares = used.map(r => { const Ri = Rstar * r.Mp / Mp; sumR += Ri; return { r, Ri }; });
    shares.forEach(s => R.eq('R_' + (s.r.i + 1), 'R* × M_p,' + (s.r.i + 1) + ' / ΣM_p', s.Ri, 'kN', 'y = ' + f(s.r.y, 0) + ' mm'));
    R.eq('Y*', 'Σ R_i y_i / Σ R_i', Ystar, 'mm');
    R.chk('Y* ≥ H_e', lv.He, Ystar, 'mm');
    checks.push({ name: L('Effective height Y* ≥ H_e', 'ความสูงประสิทธิผล Y* ≥ H_e'), Ed: lv.He, Rd: Ystar, unit: 'mm', ur: lv.He / Ystar });

    // ---------- 5 geometry (AS 5100.1 via AP-G108-25 5.4.1)
    R.sec(L('Barrier geometry', 'รูปทรงราว'), 'AP-G108-25 5.4.1 · AS 5100.1');
    const sorted = rails.slice().sort((a, b) => a.y - b.y), H = Math.max(...rails.map(r => r.y + r.vert / 2)) - (g.ref || 0);
    const A = rails.reduce((a, r) => a + r.vert, 0) + (g.kerb || 0);
    let gap = sorted[0].y - sorted[0].vert / 2 - (g.kerb || 0), gaps = [gap];
    for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i].y - sorted[i].vert / 2 - (sorted[i - 1].y + sorted[i - 1].vert / 2));
    const maxGap = Math.max(...gaps), aH = A / H, sReq = aH >= 0.5 ? 100 : aH <= 0.3 ? 200 : 200 - (aH - 0.3) / 0.2 * 100;
    R.eq('H', L('to the top of the top rail', 'ถึงขอบบนราวบนสุด'), H, 'mm').eq('A', L('total depth of rails' + (g.kerb ? ' and kerb' : ''), 'ความลึกรวมของราว' + (g.kerb ? 'และขอบทาง' : '')), A, 'mm').eq('A / H', '', aH, '');
    R.chk('A ≥ 0.25 H', 0.25 * H, A, 'mm'); R.chk(L('Clear opening ≤ 380 mm', 'ช่องว่าง ≤ 380 มม.'), maxGap, 380, 'mm');
    R.eq(L('Required post setback', 'ระยะถอยเสาที่ต้องการ'), aH >= 0.5 ? 'A/H ≥ 0.5 → 100' : aH <= 0.3 ? 'A/H ≤ 0.3 → 200' : L('interpolated', 'เทียบสัดส่วน'), sReq, 'mm');
    checks.push({ name: L('Rail depth A ≥ 0.25 H', 'ความลึกราว A ≥ 0.25 H'), Ed: 0.25 * H, Rd: A, unit: 'mm', ur: 0.25 * H / A });
    checks.push({ name: L('Clear opening between rails ≤ 380 mm', 'ช่องว่างระหว่างราว ≤ 380 มม.'), Ed: maxGap, Rd: 380, unit: 'mm', ur: maxGap / 380 });
    if (g.setback > 0) { R.chk(L('Post setback ≥ required', 'ระยะถอยเสา ≥ ที่ต้องการ'), sReq, g.setback, 'mm'); checks.push({ name: L('Post setback from the rail face', 'ระยะถอยเสาจากหน้าราว'), Ed: sReq, Rd: g.setback, unit: 'mm', ur: sReq / g.setback }); }
    used.forEach(r => { if (r.y < 380) warn.push(L('Rail ' + (r.i + 1) + ' is centred below 380 mm — it should not be counted as a traffic rail.', 'ราว ' + (r.i + 1) + ' อยู่ต่ำกว่า 380 มม. — ไม่ควรนับเป็นราวรับแรงชน')); });

    // ---------- 6 post shear and base connection
    R.sec(L('Post shear, base plate and anchor bolts', 'แรงเฉือนเสา แผ่นฐาน และสลักยึด'), code === 'AS' ? 'AS 4100 5.11, 9.2' : 'AISC 360 G4, J3 · EIT');
    const b = x.base, Vn = 0.6 * g.post.fy * post.Aw, phiV = 0.9, Vd = phiV * Vn / 1e3;
    R.eq('V_n', '0.6 f_y A_w,  A_w = 2(d − 2t)t', Vn / 1e3, 'kN').chk('P_p ≤ φV_n', Pp / 1e3, Vd, 'kN');
    checks.push({ name: L('Post shear at the base P_p', 'แรงเฉือนที่โคนเสา P_p'), Ed: Pp / 1e3, Rd: Vd, unit: 'kN', ur: Pp / 1e3 / Vd });
    // anchor bolts develop M_p,post: tension row at z from the compression edge, total n bolts
    const fuf = BOLTS[b.grade] || 400, Ab = PI / 4 * b.db * b.db, As = 0.78 * Ab, z = b.z, Tg = MpPost / z, Tb = Tg / max(1, b.nt), Vb = Pp / max(1, b.n);
    let phiNt, phiVb, nm;
    if (code === 'AS') { phiNt = 0.8 * As * fuf; phiVb = 0.8 * 0.62 * fuf * As; nm = 'φN_tf = 0.8 A_s f_uf; φV_f = 0.8 × 0.62 f_uf A_c'; }
    else { phiNt = 0.75 * 0.75 * fuf * Ab; phiVb = 0.75 * 0.45 * fuf * Ab; nm = 'φR_nt = 0.75 × 0.75 F_u A_b; φR_nv = 0.75 × 0.45 F_u A_b'; }
    R.eq(L('Bolt tension (develop M_p,post)', 'แรงดึงสลัก (รับ M_p,post)'), 'M_p,post / (z n_t) = ' + f(MpPost / 1e6, 1) + ' kN·m / (' + f(z, 0) + ' × ' + b.nt + ')', Tb / 1e3, 'kN');
    R.eq(L('Bolt shear', 'แรงเฉือนสลัก'), 'P_p / n', Vb / 1e3, 'kN').eq(L('Bolt capacities', 'กำลังสลัก'), nm, f(phiNt / 1e3, 1) + ' / ' + f(phiVb / 1e3, 1), 'kN');
    const inter2 = (Tb / phiNt) ** 2 + (Vb / phiVb) ** 2;
    R.chk(L('Bolt interaction (T/φN)² + (V/φV)² ≤ 1', 'ปฏิสัมพันธ์สลัก (T/φN)² + (V/φV)² ≤ 1'), inter2, 1, '', inter2);
    checks.push({ name: L('Anchor bolts — tension + shear (M_' + 'p,post developed)', 'สลักยึด — แรงดึง + เฉือน (รับ M_p,post)'), Ed: inter2, Rd: 1, unit: '', ur: inter2 });
    const Mpl = Tg * b.e, Mcap = 0.9 * b.fyp * b.bp * b.tp * b.tp / 4;
    R.eq(L('Base plate moment', 'โมเมนต์แผ่นฐาน'), L('tension row × lever to the post face = ', 'แรงดึงแถวสลัก × ระยะถึงหน้าเสา = ') + f(Tg / 1e3, 1) + ' kN × ' + f(b.e, 0) + ' mm', Mpl / 1e6, 'kN·m');
    R.eq(L('Base plate capacity', 'กำลังแผ่นฐาน'), '0.9 f_y b_p t_p² / 4', Mcap / 1e6, 'kN·m').chk(L('Base plate bending', 'การดัดแผ่นฐาน'), Mpl / 1e6, Mcap / 1e6, 'kN·m');
    checks.push({ name: L('Base plate bending', 'การดัดแผ่นฐาน'), Ed: Mpl / 1e6, Rd: Mcap / 1e6, unit: 'kN·m', ur: Mpl / Mcap });

    // ---------- 7 deck design actions (cantilever slab)
    R.sec(L('Design actions on the deck cantilever', 'แรงกระทำออกแบบบนพื้นยื่น'), 'AP-G108-25 Eq. 15–18');
    const wd = b.Wb + b.D, Md1 = MpPost / wd, T1 = Pp / wd, Pv = lv.Fv * 1e3 * Lsp / lv.Lv, bb = min(2 * b.X + b.Wb, Lsp), Md2 = Pv * b.X / bb;
    R.eq('M_d', 'M_p,post / (W_b + D)', Md1 / 1e3, 'kN·m/m', L('design case 1; design for 1.1 M_d', 'กรณี 1 ออกแบบที่ 1.1 M_d')).eq('T', 'P_p / (W_b + D)', T1, 'kN/m', L('design for 1.1 T', 'ออกแบบที่ 1.1 T'));
    R.eq('1.1 M_d / 1.1 T', '', f(1.1 * Md1 / 1e3, 1) + ' kN·m/m / ' + f(1.1 * T1, 1) + ' kN/m', '', '');
    R.eq('P_v', 'F_v L / L_v', Pv / 1e3, 'kN', L('design case 2', 'กรณี 2')).eq('b', '2X + W_b ≤ L', bb, 'mm').eq('M_d', 'P_v X / b', Md2 / 1e3, 'kN·m/m');
    R.txt(L('Equation 15 applies when the base plate is fixed directly to the deck and only the deck top steel resists the tension. Anchor bolts shall be fully developed by bond, hooks or embedded plates.', 'สมการ 15 ใช้เมื่อยึดแผ่นฐานกับพื้นโดยตรงและใช้เหล็กบนของพื้นรับแรงดึงเท่านั้น สลักยึดต้องพัฒนากำลังเต็มด้วยแรงยึดเหนี่ยว ขอ หรือแผ่นฝัง'));

    return { rep: R, checks, warn, lv, rails, used, Mp, Ystar, post, MpPost, Pp, inter, ends, crit, critE, H, A, maxGap, sReq, Md1, T1, Pv, Md2, Tb, phiNt, phiVb, L: Lsp };
  }
  G.SBARRIER = { design, LEVELS, BOLTS, hollow };
})(typeof window !== 'undefined' ? window : globalThis);
