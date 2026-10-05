/* StructCap — reinforced concrete bridge barrier (traffic railing), Thai and Australian practice.
   Australian code: Austroads AP-G108-25 §5.3 (Equations 3–8, AASHTO yield-line method), design loads from AS 5100.2
   (Table 5.1), section capacities to AS 5100.5 Equation 7 (φ A_s f_y d (1 − 0.5 A_s f_y / (α2 b d f'c))), deck designed
   for 1.1 M_c with 1.1 T. Worked example: AP-G108-25 Appendix A.1 (Design example 1).
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
    'TL-6': { Ft: 780, Fl: 260, Fv: 355, Lt: 2440, Lv: 12200, He: 1420, Hmin: 2290 },
    // Austroads AP-G108-25 Table 5.1 (AS 5100.2:2017); for a concrete parapet Y* = H, so H_min = H_e
    'AS-low': { Ft: 150, Fl: 50, Fv: 22, Lt: 1100, Lv: 5500, He: 600, Hmin: 600, as: 1 },
    'AS-regular': { Ft: 300, Fl: 100, Fv: 100, Lt: 1200, Lv: 6000, He: 900, Hmin: 900, as: 1 },
    'AS-medium': { Ft: 600, Fl: 200, Fv: 300, Lt: 2400, Lv: 12000, He: 1200, Hmin: 1200, as: 1 },
    'AS-tl6': { Ft: 750, Fl: 250, Fv: 375, Lt: 2400, Lv: 12000, He: 1800, Hmin: 1800, as: 1 },
    'AS-special': { Ft: 1200, Fl: 400, Fv: 600, Lt: 2500, Lv: 15000, He: 1500, Hmin: 1500, as: 1 }
  };
  const TLNAME = { 'AS-low': 'Low (TL-2)', 'AS-regular': 'Regular (TL-4)', 'AS-medium': 'Medium (TL-5)', 'AS-tl6': 'Special (TL-6)', 'AS-special': 'Special (> TL-6)' };
  // interface shear factors, AASHTO LRFD 5.7.4.4 (MPa)
  const IFACE = {
    rough: { c: 1.65, mu: 1.0, K1: 0.25, K2: 10.3, en: 'cast against hardened concrete, intentionally roughened to 6 mm', th: 'หล่อทับคอนกรีตเดิมที่ทำผิวขรุขระลึก 6 มม.' },
    smooth: { c: 0.52, mu: 0.6, K1: 0.2, K2: 5.5, en: 'cast against hardened concrete, not intentionally roughened', th: 'หล่อทับคอนกรีตเดิมที่ไม่ได้ทำผิวขรุขระ' },
    mono: { c: 2.8, mu: 1.4, K1: 0.25, K2: 10.3, en: 'cast monolithically with the deck', th: 'หล่อเป็นเนื้อเดียวกับพื้นสะพาน' }
  };

  // rectangular stress block, ACI 318-19 / EIT: M_n = A_s f_y (d − a/2) (N·mm), with an optional axial tension T (N)
  function Mn(As, fy, fc, b, d, T) { const F = max(0, As * fy - (T || 0)), a = F / (0.85 * fc * b); return { a, M: F * (d - a / 2) }; }
  // AS 5100.5 / AP-G108-25 Eq. 7: M_u = A_s f_y d (1 − 0.5 A_s f_y / (α2 b d f'c)), α2 = 1 − 0.003 f'c within 0.67 … 0.85
  const alpha2 = fc => min(0.85, max(0.67, 1 - 0.003 * fc));
  function MuAS(As, fy, fc, b, d, T) { const F = max(0, As * fy - (T || 0)), k = 0.5 * F / (alpha2(fc) * b * d * fc); return { a: 2 * k * d, k, M: F * d * (1 - k) }; }

  function design(x, lang) {
    const R = new RC.Rep(lang), L = (a, b) => R.L(a, b), warn = [], checks = [];
    const g = x.geo, m = x.mat, b = x.bars, dk = x.deck, c = x.coef, AS = x.code === 'AS', M = AS ? MuAS : Mn, bn = d => RC.barName(AS ? 'AS' : 'TH', d);
    const fc = m.fc, fy = m.fy, phi = c.phi || 1.0, direct = x.mode === 'direct', kDeck = AS ? 1.1 : 1.0;
    const tl = g.tl === 'custom' ? { Ft: x.load.Ft, Fl: x.load.Fl, Fv: x.load.Fv, Lt: x.load.Lt, He: x.load.He, Hmin: x.load.Hmin, Lv: x.load.Lv } : TL[g.tl] || TL['TL-4'];
    const H = g.H, tt = g.tt, tb = g.shape === 'vertical' ? g.tt : g.tb, tAvg = (tt + tb) / 2, cov = g.cover;
    const tAt = z => tb + (tt - tb) * z / H;                         // wall thickness at height z above the deck
    const Ft = tl.Ft * 1e3, Lt = tl.Lt;                               // N, mm

    // ---------- 1 test level and design forces
    R.sec(L(AS ? 'Performance level and design forces' : 'Test level and design forces', AS ? 'ระดับสมรรถนะและแรงออกแบบ' : 'ระดับการทดสอบและแรงออกแบบ'), tl.as ? 'AP-G108-25 Table 5.1 · AS 5100.2' : 'AASHTO LRFD 13.7.2, Table A13.2-1');
    if (AS) R.txt(L('Austroads AP-G108-25 §5.3: yield-line analysis of the parapet (adopted from AASHTO); the barrier resistance R* = R_w must be at least F_t of Table 5.1 and the effective height Y* = H at least H_e. Section capacities to AS 5100.5 (Equation 7) with φ = ' + f(phi, 2) + '.',
      'Austroads AP-G108-25 §5.3: วิเคราะห์เส้นครากของกำแพงราว (ตาม AASHTO) กำลัง R* = R_w ต้องไม่น้อยกว่า F_t ตามตาราง 5.1 และความสูงประสิทธิผล Y* = H ไม่น้อยกว่า H_e กำลังหน้าตัดตาม AS 5100.5 (สมการ 7) φ = ' + f(phi, 2)));
    else R.txt(L('Bridge barriers on Department of Highways projects are designed to AASHTO LRFD Section 13: the railing must resist the transverse impact F_t spread over L_t at height H_e, at the Extreme Event II limit state (load factor 1.0, φ = ' + f(phi, 2) + ').',
      'ราวกันตกสะพานของกรมทางหลวงออกแบบตาม AASHTO LRFD หมวด 13: ราวต้องต้านแรงชนตามขวาง F_t ที่กระจายบนความยาว L_t ที่ความสูง H_e ในสภาวะ Extreme Event II (ตัวคูณน้ำหนัก 1.0, φ = ' + f(phi, 2) + ')'));
    const tlName = g.tl === 'custom' ? L('user defined', 'กำหนดเอง') : TLNAME[g.tl] ? TLNAME[g.tl] + ' – AS 5100.2' : g.tl;
    R.eq(L(AS ? 'Performance level' : 'Test level', AS ? 'ระดับสมรรถนะ' : 'ระดับการทดสอบ'), tlName, '', '');
    R.eq('F_t', L('transverse', 'แรงตามขวาง'), tl.Ft, 'kN').eq('F_L', L('longitudinal', 'แรงตามยาว'), tl.Fl, 'kN').eq('F_v', L('vertical (downward)', 'แรงแนวดิ่ง (ลง)'), tl.Fv, 'kN');
    R.eq('L_t = L_L', L('length of load distribution', 'ความยาวกระจายแรง'), Lt, 'mm').eq('H_e', L('height of F_t above the deck', 'ความสูงแรง F_t เหนือพื้น'), tl.He, 'mm').eq('H_min', L('minimum railing height', 'ความสูงราวน้อยสุด'), tl.Hmin, 'mm');
    const urH = tl.Hmin / H, urHe = tl.He / H;
    R.chk(L('Railing height H ≥ H_min', 'ความสูงราว H ≥ H_min'), tl.Hmin, H, 'mm');
    checks.push({ name: L('Railing height H ≥ H_min (' + (g.tl === 'custom' ? 'custom' : (TLNAME[g.tl] || g.tl)) + ')', 'ความสูงราว H ≥ H_min (' + (g.tl === 'custom' ? 'กำหนดเอง' : (TLNAME[g.tl] || g.tl)) + ')'), Ed: tl.Hmin, Rd: H, unit: 'mm', ur: urH });
    R.chk(L('Resultant of the wall resistance (at H for a solid wall) ≥ H_e', 'ตำแหน่งแรงต้านของกำแพง (ที่ H สำหรับกำแพงตัน) ≥ H_e'), tl.He, H, 'mm');
    checks.push({ name: L('Effective height Ȳ = H ≥ H_e', 'ความสูงประสิทธิผล Ȳ = H ≥ H_e'), Ed: tl.He, Rd: H, unit: 'mm', ur: urHe });

    // ---------- 2 flexural resistances
    R.sec(L('Flexural resistance of the wall', 'กำลังต้านทานโมเมนต์ดัดของกำแพง'), AS ? 'AP-G108-25 Eq. 7 · AS 5100.5' : 'AASHTO LRFD A13.3.1 · ACI 318-19 22.2');
    const blockTxt = AS ? 'φ A_s f_y d (1 − 0.5 A_s f_y / (α2 b d f\'c))' : 'φ A_s f_y (d − a/2)';
    if (AS) R.eq('α2', '1 − 0.003 f\'c (0.67 … 0.85)', alpha2(fc), '');
    let Mw, Mc, McBase, Mb, nh = 0, Ash = 0, Asv;
    if (direct) {
      const d = x.direct, mb = d.Asb > 0 ? M(d.Asb, fy, fc, d.bb, d.db) : null, mw = M(d.Asw, fy, fc, d.bw, d.dw), mc = M(d.Asc, fy, fc, 1000, d.dc);
      Mb = mb ? phi * mb.M / 1e6 : 0; Mw = phi * mw.M / 1e6; Mc = phi * mc.M / 1e6; McBase = Mc; Asv = d.Asc; Ash = d.Asw;
      R.txt(L('Components as in AP-G108-25 Figure 5.5: A_s, b and d of the top beam, the wall about its vertical axis and a 1 m strip of the cantilevered wall.', 'องค์ประกอบตาม AP-G108-25 รูป 5.5: A_s, b และ d ของคานบน กำแพงรอบแกนดิ่ง และแถบกว้าง 1 ม. ของกำแพงยื่น'));
      if (mb) R.eq('M_b', blockTxt + ' — A_s = ' + f(d.Asb, 0) + ', b = ' + f(d.bb, 0) + ', d = ' + f(d.db, 0), Mb, 'kN·m', L('top beam, vertical axis', 'คานบน รอบแกนดิ่ง'));
      R.eq('M_w', blockTxt + ' — A_s = ' + f(d.Asw, 0) + ', b = ' + f(d.bw, 0) + ', d = ' + f(d.dw, 0), Mw, 'kN·m', L('wall, vertical axis', 'กำแพง รอบแกนดิ่ง'));
      R.eq('M_c', blockTxt + ' — A_s = ' + f(d.Asc, 0) + ' /m, b = 1000, d = ' + f(d.dc, 0), Mc, 'kN·m/m', L('cantilever wall, per metre', 'กำแพงยื่น ต่อเมตร'));
    } else {
      R.eq(L('Wall thickness top / base', 'ความหนากำแพง บน / ฐาน'), f(tt, 0) + ' / ' + f(tb, 0), '', 'mm').eq(L('Average thickness', 'ความหนาเฉลี่ย'), '(t_top + t_base) / 2', tAvg, 'mm');
      // horizontal bars → M_w about the vertical axis (whole wall height acts as the width)
      nh = max(1, Math.floor(H / b.hS)); Ash = nh * Ab(b.hD); const dw = tAvg - cov - b.hD / 2;
      const mw = M(Ash, fy, fc, H, dw); Mw = phi * mw.M / 1e6;   // kN·m
      R.eq(L('Horizontal bars in height H (per face)', 'เหล็กนอนในความสูง H (ต่อด้าน)'), 'n = ⌊H / s_h⌋ = ⌊' + f(H, 0) + ' / ' + f(b.hS, 0) + '⌋ = ' + nh + ' × ' + bn(b.hD), Ash, 'mm²');
      R.eq('d_w', 't_avg − cover − d_b/2', dw, 'mm'); if (!AS) R.eq('a', 'A_s f_y / (0.85 f\'c H)', mw.a, 'mm');
      R.eq('M_w', blockTxt, Mw, 'kN·m', L('about the vertical axis, whole wall', 'รอบแกนดิ่ง ทั้งกำแพง'));
      // vertical bars on the traffic face → M_c about the longitudinal axis, per metre (varies with thickness)
      Asv = 1000 / b.vS * Ab(b.vD); const McAt = z => phi * M(Asv, fy, fc, 1000, tAt(z) - cov - b.vD / 2).M / 1e6;
      let McSum = 0; const NZ = 20; for (let i = 0; i < NZ; i++) McSum += McAt((i + 0.5) * H / NZ);
      Mc = McSum / NZ; McBase = McAt(0); Mb = c.Mb || 0;
      R.eq(L('Vertical bars, traffic face', 'เหล็กยืนด้านจราจร'), bn(b.vD) + '@' + f(b.vS, 0), Asv, 'mm²/m');
      R.eq('M_c(base)', L('d = t_base − cover − d_b/2 = ', 'd = t_ฐาน − ระยะหุ้ม − d_b/2 = ') + f(tb - cov - b.vD / 2, 0) + ' mm', McBase, 'kN·m/m');
      R.eq('M_c', L('average over the height (thickness varies)', 'ค่าเฉลี่ยตลอดความสูง (ความหนาแปรผัน)'), Mc, 'kN·m/m');
      if (Mb) R.eq('M_b', L('additional resistance of a top beam', 'กำลังเพิ่มของคานบนราว'), Mb, 'kN·m');
    }

    // ---------- 3 yield-line analysis
    R.sec(L('Yield-line resistance of the barrier', 'กำลังต้านทานตามทฤษฎีเส้นคราก'), AS ? 'AP-G108-25 Eq. 3–6' : 'AASHTO LRFD A13.3.1');
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
    R.sec(L('Shear transfer at the barrier–deck interface', 'การถ่ายแรงเฉือนที่รอยต่อราวกับพื้นสะพาน'), AS ? L('AASHTO LRFD A13.4.2, 5.7.4 (shear friction, as referenced by AP-G108-25)', 'AASHTO LRFD A13.4.2, 5.7.4 (แรงเฉือนเสียดทาน ตามที่ AP-G108-25 อ้างถึง)') : 'AASHTO LRFD A13.4.2, 5.7.4');
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
      R.sec(L('Deck overhang at the barrier face — Design Case 1', 'พื้นยื่นที่โคนราว — กรณีออกแบบที่ 1'), AS ? 'AP-G108-25 §5.3.3, Eq. 8' : 'AASHTO LRFD A13.4.1, A13.4.2');
      const phid = c.phid || phi, T = kDeck * Vct, Ms = kDeck * McBase;          // kN/m axial tension, kN·m/m moment in the deck
      const Asd = 1000 / dk.sTop * Ab(dk.dTop), dd = dk.ts - dk.cTop - dk.dTop / 2, mn = M(Asd, fy, fc, 1000, dd, T * 1e3), Md = phid * mn.M / 1e6;
      if (AS) R.txt(L('AP-G108-25 §5.3.3: the deck is designed for 1.1 times the barrier base moment M_c together with 1.1 times the tension T = R_w/(L_c + 2H), so that the barrier fails before the deck.', 'AP-G108-25 §5.3.3: ออกแบบพื้นสำหรับ 1.1 เท่าของโมเมนต์ที่โคนราว M_c ร่วมกับ 1.1 เท่าของแรงดึง T = R_w/(L_c + 2H) เพื่อให้ราววิบัติก่อนพื้น'));
      else R.txt(L('The overhang must resist the barrier base moment M_c acting together with the axial tension T = R_w/(L_c + 2H).', 'พื้นยื่นต้องต้านโมเมนต์ที่โคนราว M_c ร่วมกับแรงดึง T = R_w/(L_c + 2H)'));
      const kTxt = AS ? '1.1 ' : '';
      R.eq('T', kTxt + 'R_w / (L_c + 2H)', T, 'kN/m').eq('M_s', kTxt + 'M_c(base)', Ms, 'kN·m/m');
      R.eq(L('Top bars', 'เหล็กบน'), bn(dk.dTop) + '@' + f(dk.sTop, 0), Asd, 'mm²/m').eq('d', 't_s − cover − d_b/2', dd, 'mm');
      if (AS && phid !== phi) R.eq('φ', L('deck overhang, AS 5100.5', 'พื้นยื่น AS 5100.5'), phid, '');
      if (AS) R.eq('φM_u', 'φ (A_s f_y − T) d (1 − 0.5 (A_s f_y − T) / (α2 b d f\'c))', Md, 'kN·m/m');
      else R.eq('a', '(A_s f_y − T) / (0.85 f\'c b)', mn.a, 'mm').eq('φM_n', 'φ (A_s f_y − T)(d − a/2)', Md, 'kN·m/m');
      R.chk(kTxt + 'M_c(base) ≤ φM', Ms, Md, 'kN·m/m');
      checks.push({ name: L('Deck overhang ' + kTxt + 'M_c with tension ' + kTxt + 'T (Case 1)', 'พื้นยื่น ' + kTxt + 'M_c ร่วมกับแรงดึง ' + kTxt + 'T (กรณี 1)'), Ed: Ms, Rd: Md, unit: 'kN·m/m', ur: Ms / Md });
      deck = { T, Ms, Asd, dd, Md };
    }

    // ---------- 6 simplified base moment (as in the calculation sheet)
    let Mstar = null, Ls = null, dM = null, dT = null;
    if (!AS) {
    R.sec(L('Base moment from the impact force spread at θ (simplified)', 'โมเมนต์ที่ฐานจากแรงชนที่กระจายที่มุม θ (วิธีอย่างง่าย)'), L('calculation sheet method', 'ตามแผ่นคำนวณ'));
    const th = (x.coef.theta || 45) * PI / 180; Ls = Lt / 1000 + Math.tan(th) * Hm; Mstar = tl.Ft * Hm / Ls;
    R.eq('L', 'L_t + H tan θ', Ls, 'm').eq('M*', 'F_t H / L', Mstar, 'kN·m/m');
    R.chk('M* ≤ M_c(base)', Mstar, McBase, 'kN·m/m');
    checks.push({ name: L('Base moment F_t H / (L_t + H tan θ)', 'โมเมนต์ที่ฐาน F_t H / (L_t + H tan θ)'), Ed: Mstar, Rd: McBase, unit: 'kN·m/m', ur: Mstar / McBase });
    dM = 1.1 * Mstar; dT = 1.1 * tl.Ft / Ls;
    R.eq(L('Deck slab design moment', 'โมเมนต์ออกแบบพื้น'), '1.1 M*', dM, 'kN·m/m').eq(L('Deck slab design tension', 'แรงดึงออกแบบพื้น'), '1.1 F_t / L', dT, 'kN/m');
    }

    // ---------- 7 anchorage of the vertical bars into the deck (standard hook)
    R.sec(L('Anchorage of the vertical bars into the deck', 'การฝังยึดเหล็กยืนเข้าในพื้น'), AS ? 'AS 5100.5 §13.1.2.2, 13.1.2.7' : 'ACI 318-19 25.4.3');
    const db = b.vD, avail = dk.ts - (x.deck.cBot || 40);
    let ldh;
    if (AS) {
      const k1 = 1.0, k2 = (132 - db) / 100, k3 = max(0.7, min(1.0, 1 - 0.15 * (cov - db) / db)), Lsy = max(0.5 * k1 * k3 * fy * db / (k2 * sq(min(fc, 65))), 29 * k1 * db);
      ldh = max(0.5 * Lsy, 8 * db);
      R.eq('k_1, k_2, k_3', '1.0, (132 − d_b)/100 = ' + f(k2, 2) + ', 1 − 0.15(c_d − d_b)/d_b = ' + f(k3, 2), '', '');
      R.eq('L_sy.tb', '0.5 k_1 k_3 f_sy d_b / (k_2 √f\'c) ≥ 29 k_1 d_b', Lsy, 'mm');
      R.eq(L('L_sy.t with a standard hook', 'L_sy.t เมื่อใช้ขอมาตรฐาน'), '0.5 L_sy.tb ≥ 8d_b', ldh, 'mm');
    } else {
      const psiR = b.vS >= 6 * db ? 1.0 : 1.6, psiO = 1.25, psiC = fc < 40 ? fc / 105 + 0.6 : 1.0;
      ldh = max(fy * psiR * psiO * psiC / (23 * sq(fc)) * Math.pow(db, 1.5), 8 * db, 150);
      R.eq('ψ_r, ψ_o, ψ_c', (b.vS >= 6 * db ? 's ≥ 6d_b → 1.0' : '1.6') + ', 1.25, ' + f(psiC, 2), '', '');
      R.eq('l_dh', 'f_y ψ_r ψ_o ψ_c d_b^1.5 / (23 λ √f\'c) ≥ 8d_b, 150', ldh, 'mm');
    }
    R.eq(L('Available depth in the deck', 'ความลึกที่มีในพื้น'), 't_s − ' + L('bottom cover', 'ระยะหุ้มล่าง'), avail, 'mm');
    R.chk('l_dh ≤ ' + L('available', 'ที่มี'), ldh, avail, 'mm');
    checks.push({ name: L('Hook anchorage of vertical bars in the deck l_dh', 'ระยะฝังขอเหล็กยืนในพื้น l_dh'), Ed: ldh, Rd: avail, unit: 'mm', ur: ldh / avail });

    // ---------- 8 minimum reinforcement and spacing (wall)
    R.sec(L('Minimum reinforcement and spacing', 'เหล็กเสริมน้อยสุดและระยะเรียง'), AS ? 'AS 5100.5 §11.6' : 'ACI 318-19 11.6, 11.7 · EIT');
    const rhoV = (Asv + 1000 / b.v2S * Ab(b.v2D)) / (tAvg * 1000), rhoH = 2 * Ab(b.hD) / b.hS / tAvg, rvMin = AS ? 0.0015 : b.vD <= 16 ? 0.0012 : 0.0015, rhMin = AS ? 0.0025 : b.hD <= 16 ? 0.0020 : 0.0025;
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
  G.BARRIER = { design, TL, TLNAME, IFACE, Mn, MuAS };
})(typeof window !== 'undefined' ? window : globalThis);
