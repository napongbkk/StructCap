/* StructCap — reinforced concrete bridge barrier (traffic railing) to Thai practice.
   The Department of Highways (กรมทางหลวง) designs bridge barriers to AASHTO LRFD Section 13 (crash test levels,
   Appendix A13 yield-line analysis, Extreme Event II with φ = 1.0); materials and detailing follow the EIT / ACI 318-19
   strength-design rules used for Thai concrete work (f'c, f_y in ksc, DB bars).
   Units inside: N, mm, MPa; reported actions in kN, kN·m.
   Checks: barrier resistance R_w (interior and end segments) ≥ F_t, height ≥ H_min and ≥ H_e, shear transfer at the
   barrier-deck interface, deck overhang (flexure with axial tension, Design Case 1), the simplified base-moment check of
   the calculation sheet (F_t spread at θ), anchorage of the vertical bars into the deck, minimum wall reinforcement. */
(function (G) {
  'use strict';
  const RC = G.RC, f = RC.f, PI = Math.PI, sq = Math.sqrt, max = Math.max, min = Math.min;
  const Ab = d => PI * d * d / 4;

  // AASHTO LRFD Table A13.2-1 — design forces for traffic railings (kN, mm)
  const TL = {
    'TL-1': { Ft: 60, Fl: 20, Fv: 20, Lt: 1220, Lv: 5500, He: 460, Hmin: 685 },
    'TL-2': { Ft: 120, Fl: 40, Fv: 20, Lt: 1220, Lv: 5500, He: 510, Hmin: 685 },
    'TL-3': { Ft: 240, Fl: 80, Fv: 20, Lt: 1220, Lv: 5500, He: 610, Hmin: 685 },
    'TL-4': { Ft: 240, Fl: 80, Fv: 80, Lt: 1070, Lv: 5500, He: 810, Hmin: 810 },
    'TL-5': { Ft: 550, Fl: 180, Fv: 355, Lt: 2440, Lv: 12200, He: 1070, Hmin: 1070 },
    'TL-6': { Ft: 780, Fl: 260, Fv: 355, Lt: 2440, Lv: 12200, He: 1420, Hmin: 2290 }
  };
  // interface shear factors, AASHTO LRFD 5.7.4.4 (MPa)
  const IFACE = {
    rough: { c: 1.65, mu: 1.0, K1: 0.25, K2: 10.3, en: 'cast against hardened concrete, intentionally roughened to 6 mm', th: 'หล่อทับคอนกรีตเดิมที่ทำผิวขรุขระลึก 6 มม.' },
    smooth: { c: 0.52, mu: 0.6, K1: 0.2, K2: 5.5, en: 'cast against hardened concrete, not intentionally roughened', th: 'หล่อทับคอนกรีตเดิมที่ไม่ได้ทำผิวขรุขระ' },
    mono: { c: 2.8, mu: 1.4, K1: 0.25, K2: 10.3, en: 'cast monolithically with the deck', th: 'หล่อเป็นเนื้อเดียวกับพื้นสะพาน' }
  };

  // rectangular stress block, ACI 318-19 / EIT: M_n = A_s f_y (d − a/2) (N·mm), with an optional axial tension T (N)
  function Mn(As, fy, fc, b, d, T) { const F = max(0, As * fy - (T || 0)), a = F / (0.85 * fc * b); return { a, M: F * (d - a / 2) }; }

  function design(x, lang) {
    const R = new RC.Rep(lang), L = (a, b) => R.L(a, b), warn = [], checks = [];
    const g = x.geo, m = x.mat, b = x.bars, dk = x.deck, c = x.coef;
    const fc = m.fc, fy = m.fy, phi = c.phi || 1.0;
    const tl = g.tl === 'custom' ? { Ft: x.load.Ft, Fl: x.load.Fl, Fv: x.load.Fv, Lt: x.load.Lt, He: x.load.He, Hmin: x.load.Hmin, Lv: x.load.Lv } : TL[g.tl] || TL['TL-4'];
    const H = g.H, tt = g.tt, tb = g.shape === 'vertical' ? g.tt : g.tb, tAvg = (tt + tb) / 2, cov = g.cover;
    const tAt = z => tb + (tt - tb) * z / H;                         // wall thickness at height z above the deck
    const Ft = tl.Ft * 1e3, Lt = tl.Lt;                               // N, mm

    // ---------- 1 test level and design forces
    R.sec(L('Test level and design forces', 'ระดับการทดสอบและแรงออกแบบ'), 'AASHTO LRFD 13.7.2, Table A13.2-1');
    R.txt(L('Bridge barriers on Department of Highways projects are designed to AASHTO LRFD Section 13: the railing must resist the transverse impact F_t spread over L_t at height H_e, at the Extreme Event II limit state (load factor 1.0, φ = ' + f(phi, 2) + ').',
      'ราวกันตกสะพานของกรมทางหลวงออกแบบตาม AASHTO LRFD หมวด 13: ราวต้องต้านแรงชนตามขวาง F_t ที่กระจายบนความยาว L_t ที่ความสูง H_e ในสภาวะ Extreme Event II (ตัวคูณน้ำหนัก 1.0, φ = ' + f(phi, 2) + ')'));
    R.eq(L('Test level', 'ระดับการทดสอบ'), g.tl === 'custom' ? L('user defined', 'กำหนดเอง') : g.tl, '', '');
    R.eq('F_t', L('transverse', 'แรงตามขวาง'), tl.Ft, 'kN').eq('F_L', L('longitudinal', 'แรงตามยาว'), tl.Fl, 'kN').eq('F_v', L('vertical (downward)', 'แรงแนวดิ่ง (ลง)'), tl.Fv, 'kN');
    R.eq('L_t = L_L', L('length of load distribution', 'ความยาวกระจายแรง'), Lt, 'mm').eq('H_e', L('height of F_t above the deck', 'ความสูงแรง F_t เหนือพื้น'), tl.He, 'mm').eq('H_min', L('minimum railing height', 'ความสูงราวน้อยสุด'), tl.Hmin, 'mm');
    const urH = tl.Hmin / H, urHe = tl.He / H;
    R.chk(L('Railing height H ≥ H_min', 'ความสูงราว H ≥ H_min'), tl.Hmin, H, 'mm');
    checks.push({ name: L('Railing height H ≥ H_min (' + (g.tl === 'custom' ? 'custom' : g.tl) + ')', 'ความสูงราว H ≥ H_min (' + (g.tl === 'custom' ? 'กำหนดเอง' : g.tl) + ')'), Ed: tl.Hmin, Rd: H, unit: 'mm', ur: urH });
    R.chk(L('Resultant of the wall resistance (at H for a solid wall) ≥ H_e', 'ตำแหน่งแรงต้านของกำแพง (ที่ H สำหรับกำแพงตัน) ≥ H_e'), tl.He, H, 'mm');
    checks.push({ name: L('Effective height Ȳ = H ≥ H_e', 'ความสูงประสิทธิผล Ȳ = H ≥ H_e'), Ed: tl.He, Rd: H, unit: 'mm', ur: urHe });

    // ---------- 2 flexural resistances
    R.sec(L('Flexural resistance of the wall', 'กำลังต้านทานโมเมนต์ดัดของกำแพง'), 'AASHTO LRFD A13.3.1 · ACI 318-19 22.2');
    R.eq(L('Wall thickness top / base', 'ความหนากำแพง บน / ฐาน'), f(tt, 0) + ' / ' + f(tb, 0), '', 'mm').eq(L('Average thickness', 'ความหนาเฉลี่ย'), '(t_top + t_base) / 2', tAvg, 'mm');
    // horizontal bars → M_w about the vertical axis (whole wall height acts as the width)
    const nh = max(1, Math.floor(H / b.hS)), Ash = nh * Ab(b.hD), dw = tAvg - cov - b.hD / 2;
    const mw = Mn(Ash, fy, fc, H, dw), Mw = phi * mw.M / 1e6;   // kN·m
    R.eq(L('Horizontal bars in height H (per face)', 'เหล็กนอนในความสูง H (ต่อด้าน)'), 'n = ⌊H / s_h⌋ = ⌊' + f(H, 0) + ' / ' + f(b.hS, 0) + '⌋ = ' + nh + ' × ' + RC.barName('TH', b.hD), Ash, 'mm²');
    R.eq('d_w', 't_avg − cover − d_b/2', dw, 'mm').eq('a', 'A_s f_y / (0.85 f\'c H)', mw.a, 'mm');
    R.eq('M_w', 'φ A_s f_y (d − a/2)', Mw, 'kN·m', L('about the vertical axis, whole wall', 'รอบแกนดิ่ง ทั้งกำแพง'));
    // vertical bars on the traffic face → M_c about the longitudinal axis, per metre (varies with thickness)
    const Asv = 1000 / b.vS * Ab(b.vD), McAt = z => phi * Mn(Asv, fy, fc, 1000, tAt(z) - cov - b.vD / 2).M / 1e6;
    let McSum = 0; const NZ = 20; for (let i = 0; i < NZ; i++) McSum += McAt((i + 0.5) * H / NZ);
    const Mc = McSum / NZ, McBase = McAt(0), Mb = c.Mb || 0;
    R.eq(L('Vertical bars, traffic face', 'เหล็กยืนด้านจราจร'), RC.barName('TH', b.vD) + '@' + f(b.vS, 0), Asv, 'mm²/m');
    R.eq('M_c(base)', L('d = t_base − cover − d_b/2 = ', 'd = t_ฐาน − ระยะหุ้ม − d_b/2 = ') + f(tb - cov - b.vD / 2, 0) + ' mm', McBase, 'kN·m/m');
    R.eq('M_c', L('average over the height (thickness varies)', 'ค่าเฉลี่ยตลอดความสูง (ความหนาแปรผัน)'), Mc, 'kN·m/m');
    if (Mb) R.eq('M_b', L('additional resistance of a top beam', 'กำลังเพิ่มของคานบนราว'), Mb, 'kN·m');

    // ---------- 3 yield-line analysis
    R.sec(L('Yield-line resistance of the barrier', 'กำลังต้านทานตามทฤษฎีเส้นคราก'), 'AASHTO LRFD A13.3.1');
    const Hm = H / 1000, Ltm = Lt / 1000;
    const LcI = Ltm / 2 + sq((Ltm / 2) ** 2 + 8 * Hm * (Mb + Mw) / Mc);
    const RwI = 2 / (2 * LcI - Ltm) * (8 * Mb + 8 * Mw + Mc * LcI * LcI / Hm);
    const LcE = Ltm / 2 + sq((Ltm / 2) ** 2 + Hm * (Mb + Mw) / Mc);
    const RwE = 2 / (2 * LcE - Ltm) * (Mb + Mw + Mc * LcE * LcE / Hm);
    R.txt(L('Interior segment: the yield lines form a V over the critical length L_c; at an end (expansion joint or barrier end) only one side forms.', 'ช่วงกลาง: เส้นครากเป็นรูปตัว V บนความยาววิกฤต L_c ส่วนช่วงปลาย (รอยต่อขยายตัวหรือปลายราว) เกิดเส้นครากเพียงด้านเดียว'));
    R.eq('L_c (' + L('interior', 'ช่วงกลาง') + ')', 'L_t/2 + √((L_t/2)² + 8H(M_b + M_w)/M_c)', LcI, 'm');
    R.eq('R_w (' + L('interior', 'ช่วงกลาง') + ')', '2/(2L_c − L_t) · (8M_b + 8M_w + M_c L_c²/H)', RwI, 'kN');
    R.eq('L_c (' + L('end', 'ช่วงปลาย') + ')', 'L_t/2 + √((L_t/2)² + H(M_b + M_w)/M_c)', LcE, 'm');
    R.eq('R_w (' + L('end', 'ช่วงปลาย') + ')', '2/(2L_c − L_t) · (M_b + M_w + M_c L_c²/H)', RwE, 'kN');
    R.chk(L('Interior: F_t ≤ R_w', 'ช่วงกลาง: F_t ≤ R_w'), tl.Ft, RwI, 'kN');
    R.chk(L('End: F_t ≤ R_w', 'ช่วงปลาย: F_t ≤ R_w'), tl.Ft, RwE, 'kN');
    checks.push({ name: L('Barrier resistance, interior segment R_w', 'กำลังต้านทานราว ช่วงกลาง R_w'), Ed: tl.Ft, Rd: RwI, unit: 'kN', ur: tl.Ft / RwI });
    if (x.coef.ends !== 'no') checks.push({ name: L('Barrier resistance, end segment R_w', 'กำลังต้านทานราว ช่วงปลาย R_w'), Ed: tl.Ft, Rd: RwE, unit: 'kN', ur: tl.Ft / RwE });
    else R.txt(L('End segments are not checked (barrier continuous, ends strengthened separately).', 'ไม่ตรวจช่วงปลาย (ราวต่อเนื่อง ปลายราวเสริมกำลังแยก)'));
    if (Lt / 1000 >= LcI) warn.push(L('L_c is shorter than L_t — check the wall as a beam over L_t.', 'L_c สั้นกว่า L_t — ควรตรวจกำแพงแบบคาน'));

    // ---------- 4 shear transfer at the barrier–deck interface
    const ends = x.coef.ends !== 'no';
    const cases = [['int', RwI, LcI]].concat(ends ? [['end', RwE, LcE]] : []);
    const Vct = Math.max(...cases.map(([, Rw, Lc]) => Rw / (Lc + 2 * Hm)));   // kN/m
    const caseT = cases.reduce((a, q) => (q[1] / (q[2] + 2 * Hm) > a[1] / (a[2] + 2 * Hm) ? q : a));
    R.sec(L('Shear transfer at the barrier–deck interface', 'การถ่ายแรงเฉือนที่รอยต่อราวกับพื้นสะพาน'), 'AASHTO LRFD A13.4.2, 5.7.4');
    const IF = IFACE[x.deck.iface] || IFACE.rough, Acv = tb * 1000, Avf = Asv + 1000 / b.v2S * Ab(b.v2D);
    const Pc = (x.coef.gc || 24) * (tAvg / 1000) * Hm;                        // kN/m self weight of the wall
    const Vn = min(IF.c * Acv + IF.mu * (Avf * fy + Pc * 1e3), IF.K1 * fc * Acv, IF.K2 * Acv) / 1e3; // kN/m
    R.eq('V_ct', 'R_w / (L_c + 2H)', Vct, 'kN/m', caseT[0] === 'end' ? L('end segment governs', 'ช่วงปลายวิกฤต') : L('interior segment governs', 'ช่วงกลางวิกฤต'));
    R.txt(L('Interface ' + IF.en + ': c = ' + IF.c + ' MPa, μ = ' + IF.mu + ', K_1 = ' + IF.K1 + ', K_2 = ' + IF.K2 + ' MPa.', 'รอยต่อ' + IF.th + ': c = ' + IF.c + ' MPa, μ = ' + IF.mu + ', K_1 = ' + IF.K1 + ', K_2 = ' + IF.K2 + ' MPa'));
    R.eq('A_cv', 't_base × 1000', Acv, 'mm²/m').eq('A_vf', L('vertical bars crossing, both faces', 'เหล็กยืนที่ผ่านรอยต่อ ทั้งสองด้าน'), Avf, 'mm²/m').eq('P_c', L('wall self weight', 'น้ำหนักกำแพง'), Pc, 'kN/m');
    R.eq('V_n', 'min(c A_cv + μ(A_vf f_y + P_c), K_1 f\'c A_cv, K_2 A_cv)', Vn, 'kN/m');
    R.chk('V_ct ≤ φ V_n', Vct, phi * Vn, 'kN/m');
    checks.push({ name: L('Shear transfer barrier–deck V_ct', 'แรงเฉือนที่รอยต่อราว–พื้น V_ct'), Ed: Vct, Rd: phi * Vn, unit: 'kN/m', ur: Vct / (phi * Vn) });

    // ---------- 5 deck overhang, Design Case 1 (transverse impact)
    let deck = null;
    if (x.deck.check !== 'no') {
      R.sec(L('Deck overhang at the barrier face — Design Case 1', 'พื้นยื่นที่โคนราว — กรณีออกแบบที่ 1'), 'AASHTO LRFD A13.4.1, A13.4.2');
      const T = Vct;                                                              // kN/m axial tension in the deck
      const Asd = 1000 / dk.sTop * Ab(dk.dTop), dd = dk.ts - dk.cTop - dk.dTop / 2, mn = Mn(Asd, fy, fc, 1000, dd, T * 1e3), Md = phi * mn.M / 1e6;
      R.txt(L('The overhang must resist the barrier base moment M_c acting together with the axial tension T = R_w/(L_c + 2H).', 'พื้นยื่นต้องต้านโมเมนต์ที่โคนราว M_c ร่วมกับแรงดึง T = R_w/(L_c + 2H)'));
      R.eq('T', 'R_w / (L_c + 2H)', T, 'kN/m').eq('M_s', 'M_c(base)', McBase, 'kN·m/m');
      R.eq(L('Top bars', 'เหล็กบน'), RC.barName('TH', dk.dTop) + '@' + f(dk.sTop, 0), Asd, 'mm²/m').eq('d', 't_s − cover − d_b/2', dd, 'mm');
      R.eq('a', '(A_s f_y − T) / (0.85 f\'c b)', mn.a, 'mm').eq('φM_n', 'φ (A_s f_y − T)(d − a/2)', Md, 'kN·m/m');
      R.chk('M_c(base) ≤ φM_n', McBase, Md, 'kN·m/m');
      checks.push({ name: L('Deck overhang M with tension T (Case 1)', 'พื้นยื่น M ร่วมกับแรงดึง T (กรณี 1)'), Ed: McBase, Rd: Md, unit: 'kN·m/m', ur: McBase / Md });
      deck = { T, Asd, dd, Md };
    }

    // ---------- 6 simplified base moment (as in the calculation sheet)
    R.sec(L('Base moment from the impact force spread at θ (simplified)', 'โมเมนต์ที่ฐานจากแรงชนที่กระจายที่มุม θ (วิธีอย่างง่าย)'), L('calculation sheet method', 'ตามแผ่นคำนวณ'));
    const th = (x.coef.theta || 45) * PI / 180, Ls = Lt / 1000 + Math.tan(th) * Hm, Mstar = tl.Ft * Hm / Ls;
    R.eq('L', 'L_t + H tan θ', Ls, 'm').eq('M*', 'F_t H / L', Mstar, 'kN·m/m');
    R.chk('M* ≤ M_c(base)', Mstar, McBase, 'kN·m/m');
    checks.push({ name: L('Base moment F_t H / (L_t + H tan θ)', 'โมเมนต์ที่ฐาน F_t H / (L_t + H tan θ)'), Ed: Mstar, Rd: McBase, unit: 'kN·m/m', ur: Mstar / McBase });
    const dM = 1.1 * Mstar, dT = 1.1 * tl.Ft / Ls;
    R.eq(L('Deck slab design moment', 'โมเมนต์ออกแบบพื้น'), '1.1 M*', dM, 'kN·m/m').eq(L('Deck slab design tension', 'แรงดึงออกแบบพื้น'), '1.1 F_t / L', dT, 'kN/m');

    // ---------- 7 anchorage of the vertical bars into the deck (standard hook)
    R.sec(L('Anchorage of the vertical bars into the deck', 'การฝังยึดเหล็กยืนเข้าในพื้น'), 'ACI 318-19 25.4.3');
    const db = b.vD, psiR = b.vS >= 6 * db ? 1.0 : 1.6, psiO = 1.25, psiC = fc < 40 ? fc / 105 + 0.6 : 1.0;
    const ldh = max(fy * psiR * psiO * psiC / (23 * sq(fc)) * Math.pow(db, 1.5), 8 * db, 150), avail = dk.ts - (x.deck.cBot || 40);
    R.eq('ψ_r, ψ_o, ψ_c', (b.vS >= 6 * db ? 's ≥ 6d_b → 1.0' : '1.6') + ', 1.25, ' + f(psiC, 2), '', '');
    R.eq('l_dh', 'f_y ψ_r ψ_o ψ_c d_b^1.5 / (23 λ √f\'c) ≥ 8d_b, 150', ldh, 'mm');
    R.eq(L('Available depth in the deck', 'ความลึกที่มีในพื้น'), 't_s − ' + L('bottom cover', 'ระยะหุ้มล่าง'), avail, 'mm');
    R.chk('l_dh ≤ ' + L('available', 'ที่มี'), ldh, avail, 'mm');
    checks.push({ name: L('Hook anchorage of vertical bars in the deck l_dh', 'ระยะฝังขอเหล็กยืนในพื้น l_dh'), Ed: ldh, Rd: avail, unit: 'mm', ur: ldh / avail });

    // ---------- 8 minimum reinforcement and spacing (wall)
    R.sec(L('Minimum reinforcement and spacing', 'เหล็กเสริมน้อยสุดและระยะเรียง'), 'ACI 318-19 11.6, 11.7 · EIT');
    const rhoV = (Asv + 1000 / b.v2S * Ab(b.v2D)) / (tAvg * 1000), rhoH = 2 * Ab(b.hD) / b.hS / tAvg, rvMin = b.vD <= 16 ? 0.0012 : 0.0015, rhMin = b.hD <= 16 ? 0.0020 : 0.0025;
    R.eq('ρ_v', L('vertical, both faces', 'แนวดิ่ง ทั้งสองด้าน'), rhoV * 100, '%').eq('ρ_h', L('horizontal, both faces', 'แนวนอน ทั้งสองด้าน'), rhoH * 100, '%');
    const smax = min(3 * tAvg, 450), sMaxUsed = max(b.vS, b.hS, b.v2S);
    R.chk('ρ_v ≥ ' + rvMin, rvMin / rhoV, 1, '', rvMin / rhoV); R.chk('ρ_h ≥ ' + rhMin, rhMin / rhoH, 1, '', rhMin / rhoH); R.chk(L('Spacing ≤ min(3t, 450)', 'ระยะเรียง ≤ min(3t, 450)'), sMaxUsed, smax, 'mm');
    checks.push({ name: L('Minimum vertical steel ρ_v', 'เหล็กยืนน้อยสุด ρ_v'), Ed: rvMin, Rd: rhoV, unit: '', ur: rvMin / rhoV });
    checks.push({ name: L('Minimum horizontal steel ρ_h', 'เหล็กนอนน้อยสุด ρ_h'), Ed: rhMin, Rd: rhoH, unit: '', ur: rhMin / rhoH });
    checks.push({ name: L('Bar spacing ≤ min(3t, 450)', 'ระยะเรียงเหล็ก ≤ min(3t, 450)'), Ed: sMaxUsed, Rd: smax, unit: 'mm', ur: sMaxUsed / smax });
    if (tt < 150) warn.push(L('Top thickness under 150 mm — check cover and constructability.', 'ความหนาด้านบนน้อยกว่า 150 มม. — ตรวจระยะหุ้มและการก่อสร้าง'));
    R.txt(L('Longitudinal F_L and vertical F_v act with F_t on the barrier; for a continuous concrete wall they do not govern the yield-line design. F_v (' + tl.Fv + ' kN over L_v = ' + f(tl.Lv / 1000, 1) + ' m) should be included in the deck overhang design (Design Case 3).',
      'แรงตามยาว F_L และแรงดิ่ง F_v กระทำร่วมกับ F_t สำหรับกำแพงคอนกรีตต่อเนื่องไม่เป็นตัวกำหนด ควรรวม F_v (' + tl.Fv + ' kN บน L_v = ' + f(tl.Lv / 1000, 1) + ' ม.) ในการออกแบบพื้นยื่น (กรณีที่ 3)'));

    return { rep: R, checks, warn, tl, H, tt, tb, tAvg, Mw, Mc, McBase, Mb, LcI, RwI, LcE, RwE, Vct, Vn: phi * Vn, deck, Mstar, Ls, dM, dT, ldh, avail, nh, Ash, Asv, phi };
  }
  G.BARRIER = { design, TL, IFACE, Mn };
})(typeof window !== 'undefined' ? window : globalThis);
