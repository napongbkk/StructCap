/* StructCap — bus shelter: concrete strip footings, overall stability, sliding, hold-down bolts, base plate and weld
   to Australian Standards:
     AS/NZS 1170.0:2002 (combinations §4.2.1 stability, §4.2.2 strength), AS/NZS 1170.1 (roof live load),
     AS/NZS 1170.2:2021 (wind: V_R Table 3.1(A), M_c Table 3.3, M_z,cat Table 4.1, free roofs / free-standing walls App. B),
     AS 4100:2020 (post, bolts §9.3, base plate, fillet welds §9.7.3), AS 5216:2021 (cast-in anchors: concrete cone,
     pull-out, edge breakout, pry-out), AS 3600:2018 (footing reinforcement §8.1, bearing §12.6).
   The shelter is an open-fronted canopy: a mono-slope roof on a line of rear posts (with the back wall) and a line of front
   posts, each line on a concrete strip footing (or pads under the front posts). Internal units: N, mm, MPa (kPa = 1e-3 MPa). */
(function (G) {
  'use strict';
  const RC = G.RC, f = RC.f, Rep = RC.Rep, GA = G.GANTRY;
  const PI = Math.PI, sq = Math.sqrt, abs = Math.abs, max = Math.max, min = Math.min;

  // ------------------------------------------------------------------ wind (AS/NZS 1170.2:2021)
  const REGIONS = {
    A: { n: 'A0–A5', VR: R => 67 - 41 * Math.pow(R, -0.1), Mc: 1.0 },
    W: { n: 'W', VR: R => 104 - 70 * Math.pow(R, -0.045), Mc: 1.0 },
    B1: { n: 'B1', VR: R => 106 - 92 * Math.pow(R, -0.1), Mc: 1.0 },
    C: { n: 'C', VR: R => (R >= 50 ? 1.05 : 1.0) * (122 - 104 * Math.pow(R, -0.1)), Mc: 1.05 },
    D: { n: 'D', VR: R => (R >= 50 ? 1.1 : 1.0) * (156 - 142 * Math.pow(R, -0.1)), Mc: 1.05 }
  };
  // terrain / height multiplier for z ≤ 5 m (Table 4.1: the values at 3 m and 5 m are equal for TC2–TC4)
  const MZ = { 1: 0.99, 2: 0.91, 2.5: 0.87, 3: 0.83, 4: 0.75 };
  const BOLTS = GA.BOLTS, BGRADE = GA.BGRADE;                       // [A_s, A_c] mm², f_uf MPa
  const NUT_AF = { M12: 18, M16: 24, M20: 30, M24: 36, M30: 46, M36: 55, M42: 65, M48: 75 };
  const dOf = b => +String(b).replace(/\D/g, '');

  function design(x, lang) {
    const R = new Rep(lang), L = (a, b) => R.L(a, b), checks = [], warn = [];
    const add = (id, name, Ed, Rd, unit, ur, grp) => checks.push({ id, name, Ed, Rd, unit, ur: ur !== undefined ? ur : (Rd > 0 ? abs(Ed) / Rd : 99), grp });
    const g = x;                                                                  // all lengths mm, forces kN-inputs converted below

    // ---------- geometry (mm)
    const Ls = g.L, Dp = g.Dp, hF = g.hF, hR = g.hR, ofF = g.ofF, ofR = g.ofR, ep = g.ep;
    const nR = max(2, g.nR | 0), nF = max(2, g.nF | 0), dcov = g.dcov, Df = g.Df;
    const dr = Dp + ofF + ofR, slope = Math.atan2(abs(hF - hR), Dp) * 180 / PI;
    const zb = -(dcov + Df);                                                       // underside of footings (z = 0 at ground)
    const z0 = -dcov;                                                              // top of footing = base plate level
    const xs = n => Array.from({ length: n }, (_, i) => -Ls / 2 + ep + i * (Ls - 2 * ep) / (n - 1));   // post x positions (shelter centred on x = 0)
    const xR = xs(nR), xF = xs(nF), sR = (Ls - 2 * ep) / (nR - 1), sF = (Ls - 2 * ep) / (nF - 1);
    const Aw = g.Lw * g.hw / 1e6, zw = g.zwb + g.hw / 2;                           // back wall (m², mm)
    const As = g.bs * g.hw / 1e6, zs = g.zwb + g.hw / 2;                           // one side wall
    const Ar = Ls * dr / 1e6;                                                       // roof plan area m²
    const zr = (hF + hR) / 2;                                                       // roof mean height
    const yRoof0 = -ofF, yRoof1 = Dp + ofR;                                         // roof edges (y = 0 front posts, y = Dp rear posts)
    const post = GA.section('SHS', g.post, g.pgrade || 'C350L0'), dc = post.D, tc = post.t;
    const front = g.ftype === 'pad' ? 'pad' : 'strip';
    const Bf = front === 'pad' ? g.Bp : g.Bf, Lf = front === 'pad' ? g.Lp : g.Lsf;
    const Br = g.Br, Lr = g.Lsr;

    R.sec(L('Shelter geometry and materials', 'รูปทรงที่พักผู้โดยสารและวัสดุ'), '');
    R.eq(L('Shelter length × roof depth', 'ความยาว × ความลึกหลังคา'), 'L × d_r = ' + f(Ls / 1000, 2) + ' × ' + f(dr / 1000, 2) + ' m', Ar, 'm²');
    R.eq(L('Post lines', 'แนวเสา'), L('front ', 'หน้า ') + nF + L(' posts, rear ', ' ต้น หลัง ') + nR + L(' posts, line spacing D_p', ' ต้น ระยะระหว่างแนว D_p'), Dp / 1000, 'm');
    R.eq(L('Roof height (front / rear)', 'ความสูงหลังคา (หน้า / หลัง)'), 'h_F / h_R, ' + L('slope ', 'ความชัน ') + f(slope, 2) + '°', f(hF / 1000, 3) + ' / ' + f(hR / 1000, 3), 'm');
    R.eq(L('Back wall (battens)', 'ผนังหลัง (ระแนง)'), 'L_w × h_w = ' + f(g.Lw / 1000, 2) + ' × ' + f(g.hw / 1000, 3) + ' m, ' + L('from ', 'จาก ') + f(g.zwb, 0) + L(' mm above ground', ' มม. เหนือดิน'), Aw, 'm²');
    R.eq(L('Side walls', 'ผนังข้าง'), g.nsw + ' × ' + f(g.bs / 1000, 2) + ' × ' + f(g.hw / 1000, 3) + ' m', As * g.nsw, 'm²');
    R.eq(L('Posts', 'เสา'), post.label + ' ' + post.grade + ' (f_y = ' + post.fy + ' MPa)', f(post.mass, 1), 'kg/m');
    R.eq(L('Base plates', 'แผ่นฐาน'), L('top of footing ', 'ผิวบนฐานราก ') + f(dcov, 0) + L(' mm below ground', ' มม. ใต้ระดับดิน'), '', '');
    R.eq(L('Rear footing', 'ฐานรากแนวหลัง'), L('strip ', 'แถบ ') + f(Lr / 1000, 2) + ' × ' + f(Br / 1000, 2) + ' × ' + f(Df / 1000, 2) + ' m', '', '');
    R.eq(L('Front footing', 'ฐานรากแนวหน้า'), front === 'pad' ? nF + L(' pads ', ' ฐานเดี่ยว ') + f(Lf / 1000, 2) + ' × ' + f(Bf / 1000, 2) + ' × ' + f(Df / 1000, 2) + ' m' : L('strip ', 'แถบ ') + f(Lf / 1000, 2) + ' × ' + f(Bf / 1000, 2) + ' × ' + f(Df / 1000, 2) + ' m', '', '');
    R.eq(L('Concrete', 'คอนกรีต'), "f'c, " + L('density ', 'หน่วยน้ำหนัก ') + f(g.gc, 1) + ' kN/m³', g.fc, 'MPa');
    R.eq(L('Soil over footings', 'ดินบนฐานราก'), 'γ_s, ' + L('cover ', 'ระยะกลบ ') + f(dcov, 0) + ' mm' + (g.soil === 'yes' ? '' : L(' (not counted)', ' (ไม่นับ)')), g.gs, 'kN/m³');
    if (Br < dc + 2 * 100 || Bf < dc + 2 * 100) warn.push(L('A footing is narrow for the base plate and bolt edge distances.', 'ฐานรากแคบเมื่อเทียบกับแผ่นฐานและระยะขอบสลัก'));

    // ---------- wind speeds and pressures
    const reg = REGIONS[g.region] || REGIONS.A;
    const VRu = g.region === 'user' ? g.VRu : reg.VR(g.Ru), VRs = g.region === 'user' ? g.VRs : reg.VR(g.Rs);
    const Mc = g.region === 'user' ? 1 : reg.Mc, Mz = MZ[g.tc] || 0.91;
    const Vsit = V => V * Mc * g.Md * Mz * g.Ms * g.Mt;
    const Vu = max(30, Vsit(VRu)), Vs = Vsit(VRs);
    const qu = 0.6 * Vu * Vu / 1000, qs = 0.6 * Vs * Vs / 1000;                   // kPa
    R.sec(L('Design wind speed and pressure', 'ความเร็วลมและแรงดันลมออกแบบ'), 'AS/NZS 1170.2:2021 §2, §3, §4');
    if (g.region === 'user') R.eq('V_R', L('regional wind speed (input) ULS / SLS', 'ความเร็วลมภูมิภาค (กำหนด) ULS / SLS'), f(VRu, 1) + ' / ' + f(VRs, 1), 'm/s');
    else {
      R.eq('V_R (ULS)', L('Region ', 'เขต ') + reg.n + ', R = ' + g.Ru + L(' years — Table 3.1(A)', ' ปี — ตาราง 3.1(A)'), VRu, 'm/s');
      R.eq('V_R (SLS)', 'R = ' + g.Rs + L(' years', ' ปี'), VRs, 'm/s');
    }
    R.eq('M_c · M_d · M_z,cat · M_s · M_t', f(Mc, 2) + ' × ' + f(g.Md, 2) + ' × ' + f(Mz, 2) + ' (TC' + g.tc + ', z ≤ 5 m) × ' + f(g.Ms, 2) + ' × ' + f(g.Mt, 2), Mc * g.Md * Mz * g.Ms * g.Mt, '', 'Tables 3.3, 4.1');
    R.eq('V_des (ULS)', 'max(V_sit, 30 m/s)', Vu, 'm/s', '§2.3');
    R.eq('V_des (SLS)', 'V_sit', Vs, 'm/s');
    R.eq('q_u', '0.5·ρ_air·V² = 0.6·V²_des', qu, 'kPa', '§2.4');
    R.eq('q_s', '0.6·V²_s', qs, 'kPa');
    R.eq(L('Net pressure coefficients — walls', 'สัมประสิทธิ์แรงดันสุทธิ — ผนัง'), 'C_p,n (back) = ' + f(g.cpw, 2) + ', C_p,n (side) = ' + f(g.cps, 2) + ', K_p (porosity) = ' + f(g.Kp, 2), '', '', 'App. B (free-standing walls)');
    R.eq(L('Net pressure coefficients — roof', 'สัมประสิทธิ์แรงดันสุทธิ — หลังคา'), L('front wind ', 'ลมด้านหน้า ') + f(g.r1w, 2) + ' / ' + f(g.r1l, 2) + L(', rear wind ', ', ลมด้านหลัง ') + f(g.r2w, 2) + ' / ' + f(g.r2l, 2) + L(', along ', ', ตามยาว ') + f(g.r3, 2) + L(', down ', ', กดลง ') + f(g.rd, 2), '', '', 'App. B (free roofs, windward / leeward half)');
    R.txt(L('Negative roof coefficients act upwards. Free-roof coefficients depend on the roof pitch and on the blockage under the roof (the back wall blocks the flow for wind into the open front) — confirm them against AS/NZS 1170.2 App. B for the actual layout. K_a = K_l = C_dyn = 1.0.', 'ค่าสัมประสิทธิ์หลังคาที่เป็นลบคือแรงยก ค่าของหลังคาอิสระขึ้นกับความชันและการปิดกั้นใต้หลังคา (ผนังหลังกั้นลมเมื่อลมเข้าด้านหน้า) — ตรวจสอบกับ AS/NZS 1170.2 ภาคผนวก B ตามรูปแบบจริง K_a = K_l = C_dyn = 1.0'));

    // ---------- dead loads (kN) with their positions (x, y in mm; z not needed for gravity)
    const kN = v => v;                                                             // readability
    const Gs = [];                                                                 // { n, W, x, y, line }
    const postW = h => post.mass * 9.81 / 1e6 * (h + dcov);                       // kN (post from base plate up)
    Gs.push({ n: L('Roof (frame + panels)', 'หลังคา (โครง + แผ่น)'), W: g.groof * Ar, x: 0, y: (yRoof0 + yRoof1) / 2 });
    Gs.push({ n: L('Back wall', 'ผนังหลัง'), W: g.gwall * Aw, x: 0, y: Dp });
    if (g.nsw > 0) Gs.push({ n: L('Side walls', 'ผนังข้าง'), W: g.gwall * As * g.nsw, x: 0, y: Dp - g.bs / 2 });
    Gs.push({ n: L('Seat', 'ที่นั่ง'), W: g.wseat * g.Lseat / 1000, x: 0, y: Dp - 300 });
    Gs.push({ n: L('Rear posts', 'เสาแนวหลัง'), W: nR * postW(hR), x: 0, y: Dp });
    Gs.push({ n: L('Front posts', 'เสาแนวหน้า'), W: nF * postW(hF), x: 0, y: 0 });
    const Wsup = Gs.reduce((s, q) => s + q.W, 0);
    const soilOn = g.soil === 'yes';
    const ftgW = (Lx, B) => g.gc * Lx * B * Df / 1e9, soilW = (Lx, B) => soilOn ? g.gs * Lx * B * dcov / 1e9 : 0;
    const WrF = ftgW(Lr, Br), WrS = soilW(Lr, Br);
    const nPad = front === 'pad' ? nF : 1, WfF = nPad * ftgW(Lf, Bf), WfS = nPad * soilW(Lf, Bf);
    R.sec(L('Permanent actions G', 'น้ำหนักบรรทุกคงที่ G'), 'AS/NZS 1170.1');
    R.eq(L('Roof', 'หลังคา'), 'g_roof·A_r = ' + f(g.groof, 2) + ' × ' + f(Ar, 2), Gs[0].W, 'kN');
    R.eq(L('Walls', 'ผนัง'), 'g_wall·(A_w + n·A_s) = ' + f(g.gwall, 2) + ' × ' + f(Aw + As * g.nsw, 2), Gs[1].W + (g.nsw > 0 ? Gs[2].W : 0), 'kN');
    R.eq(L('Seat and posts', 'ที่นั่งและเสา'), 'w_seat·L_seat + Σ m·g·(h + cover)', Wsup - Gs[0].W - Gs[1].W - (g.nsw > 0 ? Gs[2].W : 0), 'kN');
    R.eq(L('Superstructure total', 'รวมโครงสร้างส่วนบน'), 'ΣG', Wsup, 'kN');
    R.eq(L('Rear footing + soil', 'ฐานรากแนวหลัง + ดิน'), 'γ_c·L·B·D + γ_s·L·B·cover', f(WrF, 2) + ' + ' + f(WrS, 2), 'kN');
    R.eq(L('Front footing(s) + soil', 'ฐานรากแนวหน้า + ดิน'), (front === 'pad' ? nF + ' × ' : '') + 'γ_c·L·B·D + γ_s·L·B·cover', f(WfF, 2) + ' + ' + f(WfS, 2), 'kN');
    R.eq(L('Roof live load (non-trafficable)', 'น้ำหนักจรหลังคา (ไม่มีผู้ใช้เดิน)'), 'Q = q_roof·A_r = ' + f(g.qroof, 2) + ' × ' + f(Ar, 2), g.qroof * Ar, 'kN', 'AS/NZS 1170.1 Table 3.2');

    // ---------- wind actions per case: lateral forces (kN, sign along the case direction) and vertical roof forces (+ down)
    const half = (y0, y1) => ({ A: Ar / 2, y: (y0 + y1) / 2 });
    const roofFront = half(yRoof0, (yRoof0 + yRoof1) / 2), roofRear = half((yRoof0 + yRoof1) / 2, yRoof1);
    const postDrag = (q, h) => q * 2.0 * dc / 1000 * h / 1000;                     // C_d ≈ 2.0 for a square post
    function windCase(id, q) {
      const c = { id, H: [], V: [] };                                              // H: { F, z, x?, y? }  V: { F (+down), x, y }
      if (id === 'W1' || id === 'W2') {
        const s = id === 'W1' ? 1 : -1;
        c.H.push({ n: L('Back wall', 'ผนังหลัง'), F: s * q * g.cpw * g.Kp * Aw, z: zw, y: Dp });
        xF.forEach(() => c.H.push({ n: L('Front posts', 'เสาแนวหน้า'), F: s * postDrag(q, hF), z: hF / 2, y: 0, agg: 1 }));
        const [cw, cl] = id === 'W1' ? [g.r1w, g.r1l] : [g.r2w, g.r2l];
        const win = id === 'W1' ? roofFront : roofRear, lee = id === 'W1' ? roofRear : roofFront;
        c.V.push({ n: L('Roof windward half', 'หลังคาครึ่งต้นลม'), F: q * cw * win.A, x: 0, y: win.y });
        c.V.push({ n: L('Roof leeward half', 'หลังคาครึ่งท้ายลม'), F: q * cl * lee.A, x: 0, y: lee.y });
        c.dir = s; c.axis = 'y';
      } else if (id === 'W3') {
        if (g.nsw > 0) c.H.push({ n: L('Side wall (windward end)', 'ผนังข้าง (ด้านต้นลม)'), F: q * g.cps * g.Kp * As, z: zs, x: -Ls / 2 });
        c.H.push({ n: L('Posts (end-on)', 'เสา (ด้านปลาย)'), F: postDrag(q, (hF + hR) / 2) * 2, z: zr / 2, x: -Ls / 2 });
        c.V.push({ n: L('Roof', 'หลังคา'), F: q * g.r3 * Ar, x: 0, y: (yRoof0 + yRoof1) / 2 });
        c.dir = 1; c.axis = 'x';
      } else {                                                                      // downward pressure on the roof (for bearing)
        c.V.push({ n: L('Roof (downward)', 'หลังคา (กดลง)'), F: q * abs(g.rd) * Ar, x: 0, y: (yRoof0 + yRoof1) / 2 });
        c.dir = 0; c.axis = 'y';
      }
      c.Htot = c.H.reduce((s, h) => s + h.F, 0);
      c.zH = c.Htot ? c.H.reduce((s, h) => s + h.F * h.z, 0) / c.Htot : 0;
      c.Vtot = c.V.reduce((s, v) => s + v.F, 0);                                  // + down
      return c;
    }
    const CASES = [['W1', L('Wind on the open front (towards the back wall)', 'ลมเข้าด้านหน้า (เข้าหาผนังหลัง)')], ['W2', L('Wind on the back wall', 'ลมเข้าด้านหลัง')], ['W3', L('Wind along the shelter', 'ลมตามแนวยาว')], ['WD', L('Downward wind on the roof', 'แรงลมกดหลังคา')]];
    const WU = {}, WS = {};
    CASES.forEach(([id]) => { WU[id] = windCase(id, qu); WS[id] = windCase(id, qs); });
    R.sec(L('Wind actions (ULS)', 'แรงลม (ULS)'), 'AS/NZS 1170.2 App. B');
    CASES.forEach(([id, nm]) => {
      const c = WU[id];
      R.eq(id + ' — ' + nm, L('horizontal ΣF at height z_H; vertical roof force (+ down)', 'แรงราบ ΣF ที่ความสูง z_H; แรงดิ่งบนหลังคา (+ กดลง)'), f(abs(c.Htot), 2) + ' kN @ ' + f(c.zH, 0) + ' mm; ' + f(c.Vtot, 2) + ' kN', '');
    });

    // ---------- overall stability, uplift and sliding (rigid shelter on its footings)
    R.sec(L('Overall stability of the shelter', 'เสถียรภาพโดยรวมของที่พักผู้โดยสาร'), 'AS/NZS 1170.0 §4.2.1(b): 0.9G stabilising, W_u destabilising');
    R.txt(L('The roof frame ties the post lines together, so the shelter and its footings rotate as one body about the leeward edge of the leeward footing. Soil over the footings is counted only when selected; passive soil pressure on the footing sides is ignored.', 'โครงหลังคายึดแนวเสาเข้าด้วยกัน ที่พักและฐานรากจึงหมุนเป็นวัตถุเดียวรอบขอบท้ายลมของฐานรากด้านท้ายลม นับดินบนฐานรากเมื่อเลือกเท่านั้น ไม่คิดแรงดันดินเชิงรับด้านข้างฐานราก'));
    const gAll = [...Gs, { W: WrF + WrS, x: 0, y: Dp }, { W: WfF + WfS, x: 0, y: 0 }];
    const Gtot = gAll.reduce((s, q) => s + q.W, 0);
    const stab = {};
    ['W1', 'W2', 'W3'].forEach(id => {
      const c = WU[id];
      let Md = 0, Ms = 0, piv;
      if (c.axis === 'y') {
        piv = c.dir > 0 ? Dp + Br / 2 : -Bf / 2;                                   // leeward edge (y)
        const arm = y => c.dir > 0 ? piv - y : y - piv;
        c.H.forEach(h => { Md += abs(h.F) * (h.z - zb) / 1000; });
        c.V.forEach(v => { const m = -v.F * arm(v.y) / 1000; if (m > 0) Md += m; });   // wind is never relied on to stabilise
        gAll.forEach(q => { Ms += 0.9 * q.W * arm(q.y) / 1000; });
      } else {
        const Lmax = max(Lr, front === 'pad' ? (Ls - 2 * ep) + Lf : Lf);
        piv = Lmax / 2;
        c.H.forEach(h => { Md += abs(h.F) * (h.z - zb) / 1000; });
        c.V.forEach(v => { const m = -v.F * (piv - v.x) / 1000; if (m > 0) Md += m; });
        gAll.forEach(q => { Ms += 0.9 * q.W * piv / 1000; });
      }
      stab[id] = { Md, Ms };
      const nm = CASES.find(k => k[0] === id)[1];
      R.eq(id + ' — ' + L('overturning', 'การพลิกคว่ำ'), 'M*_dst = ΣF·(z − z_b) + ΣU·a,  M_stb = 0.9·ΣG·a', f(Md, 2) + ' / ' + f(Ms, 2), 'kNm');
      add('ot' + id, L('Overall overturning — ', 'การพลิกคว่ำโดยรวม — ') + nm, Md, Ms, 'kNm', R.chk(L('Overturning ', 'การพลิกคว่ำ ') + id, Md, Ms, 'kNm'), 'stab');
    });
    // uplift and sliding
    R.sec(L('Uplift and sliding', 'แรงยกและการเลื่อนไถล'), 'AS/NZS 1170.0 §4.2.1(b)');
    R.eq(L('Base friction coefficient (design)', 'สัมประสิทธิ์แรงเสียดทานที่ฐาน (ออกแบบ)'), 'μ = tan δ_b' + L(' (concrete cast on soil)', ' (คอนกรีตหล่อบนดิน)'), g.mu, '');
    let slideWorst = null;
    ['W1', 'W2', 'W3'].forEach(id => {
      const c = WU[id], up = max(0, -c.Vtot), N = 0.9 * Gtot - up, Hd = abs(c.Htot), Rd = g.mu * max(0, N);
      const nm = CASES.find(k => k[0] === id)[1];
      R.eq(id + ' — ' + L('net vertical', 'แรงดิ่งสุทธิ'), 'N = 0.9ΣG − U = 0.9 × ' + f(Gtot, 2) + ' − ' + f(up, 2), N, 'kN');
      const ur = R.chk(L('Sliding ', 'การเลื่อนไถล ') + id + ': H* ≤ μ·N', Hd, Rd, 'kN');
      add('sl' + id, L('Sliding — ', 'การเลื่อนไถล — ') + nm, Hd, Rd, 'kN', ur, 'stab');
      if (!slideWorst || ur > slideWorst.ur) slideWorst = { id, ur };
      if (up > 0) add('up' + id, L('Net uplift of the shelter — ', 'แรงยกสุทธิทั้งหลัง — ') + nm, up, 0.9 * Gtot, 'kN', R.chk(L('Uplift ', 'แรงยก ') + id + ': U ≤ 0.9ΣG', up, 0.9 * Gtot, 'kN'), 'stab');
    });

    // ---------- actions at the post bases (superstructure above the base plates)
    // vertical actions split between the two lines by statics (roof forces as on a beam with overhangs between the lines);
    // horizontal actions shared equally by all posts (roof frame = diaphragm). Base moments: cantilever posts (pinned roof
    // connections, default) or portal frame (moment roof connections: inflection at mid-height, the rest as an axial couple).
    const nAll = nR + nF;
    const split = (W, y) => { const r = y / Dp; return [W * (1 - r), W * r]; };   // [front, rear]
    const frame = g.path === 'frame';
    function baseActs(gG, c, withQ) {
      // returns per-line totals and per-post actions (axial + compression, kN; V kN; M kNm about the transverse / long axis)
      let NF = 0, NRr = 0;
      Gs.forEach(q => { const [a, b] = split(q.W * gG, q.y); NF += a; NRr += b; });
      if (withQ) { const [a, b] = split(1.5 * g.qroof * Ar, (yRoof0 + yRoof1) / 2); NF += a; NRr += b; }
      let H = 0, zH = 0, axis = 'y';
      if (c) {
        c.V.forEach(v => { const [a, b] = split(v.F, v.y); NF += a; NRr += b; });
        H = c.Htot; zH = c.zH; axis = c.axis;
        // horizontal forces applied above the base, lever to base plate level
      }
      const lev = (zH - z0) / 1000;                                                // m
      const Vp = H / nAll;                                                         // kN per post
      let Mp = Vp * lev, dN = 0;
      if (frame && axis === 'y' && H) { Mp = Vp * lev / 2; dN = (H * lev - nAll * Mp) / (Dp / 1000); }
      // overturning couple: lifts the windward line, compresses the leeward line (W1: front windward)
      if (axis === 'y' && H) { if (H > 0) { NF -= dN; NRr += dN; } else { NF += dN; NRr -= dN; } }
      return { NF, NR: NRr, Vp: abs(Vp), Mp: abs(Mp), axis, H: abs(H), lev, dN };
    }
    const COMB = [
      { id: 'G', nm: '1.35G', gG: 1.35, c: null },
      { id: 'GQ', nm: '1.2G + 1.5Q', gG: 1.2, c: null, q: 1 },
      ...['W1', 'W2', 'W3', 'WD'].flatMap(w => [{ id: '12' + w, nm: '1.2G + W_u (' + w + ')', gG: 1.2, c: WU[w] }, { id: '09' + w, nm: '0.9G + W_u (' + w + ')', gG: 0.9, c: WU[w] }])
    ].filter(k => !(k.id === '09WD'));
    const BA = COMB.map(k => Object.assign({ k }, baseActs(k.gG, k.c, k.q)));
    R.sec(L('Actions at the post bases', 'แรงที่โคนเสา'), 'AS/NZS 1170.0 §4.2.2');
    R.txt(frame ? L('Portal action (moment roof connections): each post has an inflection point at mid-height, so its base moment is V·h/2; the remaining overturning moment becomes an axial couple between the front and rear lines.', 'โครงข้อแข็ง (รอยต่อหลังคารับโมเมนต์): เสามีจุดดัดกลับที่กึ่งความสูง โมเมนต์ที่โคน = V·h/2 โมเมนต์พลิกคว่ำส่วนที่เหลือเป็นแรงคู่ตามแนวแกนระหว่างแนวหน้าและแนวหลัง')
      : L('Cantilever posts (roof connections not relied on for moment): the roof frame shares the horizontal load equally between all ' + nAll + ' posts and each post carries its share as a cantilever, M* = V*·h, into its footing.', 'เสายื่น (ไม่พึ่งโมเมนต์ที่รอยต่อหลังคา): โครงหลังคาแบ่งแรงราบเท่ากันให้เสาทั้ง ' + nAll + ' ต้น แต่ละต้นรับเป็นคานยื่น M* = V*·h ลงฐานราก'));
    BA.forEach(b => R.eq(b.k.nm, L('front line N*, rear line N* (+ compression); per post V*, M*', 'แนวหน้า N*, แนวหลัง N* (+ อัด); ต่อเสา V*, M*'), f(b.NF, 2) + ', ' + f(b.NR, 2) + ' kN; ' + f(b.Vp, 2) + ' kN, ' + f(b.Mp, 2) + ' kNm', ''));

    // ---------- footing checks: rotation (overturning of the footing about its edge), uplift, bearing
    const phiq = g.qult;                                                            // design bearing capacity φ_g·q_ult (kPa)
    function footing(nm, idk, line, B, Lx, nposts, Wc, Ws, perPost) {
      R.sec(nm, 'AS/NZS 1170.0 §4.2.1(b), AS 2159 / AS 4678 bearing (φ_g·R_ug input)');
      R.eq(L('Footing', 'ฐานราก'), 'L × B × D = ' + f(Lx / 1000, 2) + ' × ' + f(B / 1000, 2) + ' × ' + f(Df / 1000, 2) + ' m' + (perPost ? L(' (one post)', ' (ต่อเสาหนึ่งต้น)') : ''), Wc + Ws, 'kN');
      let worstRot = { ur: -1 }, worstUp = { ur: -1 }, worstBr = { ur: -1 }, worstBrS = { ur: -1 };
      BA.forEach(b => {
        const n = perPost ? 1 : nposts, N = (line === 'F' ? b.NF : b.NR) * (perPost ? 1 / nposts : 1);
        const gF = b.k.gG >= 1.2 ? 1.2 : 0.9, Wf = (b.k.gG === 1.35 ? 1.35 : gF) * (Wc + Ws);
        const trans = b.axis === 'y', M = trans ? n * b.Mp + n * b.Vp * Df / 1000 : (perPost ? b.Mp + b.Vp * Df / 1000 : 0);
        const Bw = trans ? B : Lx, Lw = trans ? Lx : B;                             // width in the plane of the moment
        // overturning of the footing about its edge (stability: 0.9G only, uplift counted)
        if (b.k.gG === 0.9 && M > 0) {
          const Nst = 0.9 * (Wc + Ws) + N, Mr = max(0, Nst) * Bw / 2000;
          const ur = Mr > 0 ? M / Mr : 99; if (ur > worstRot.ur) worstRot = { ur, M, Mr, b };
        }
        if (N < 0) { const ur = -N / (0.9 * (Wc + Ws)); if (ur > worstUp.ur) worstUp = { ur, U: -N, R: 0.9 * (Wc + Ws), b }; }
        // bearing pressure (every ULS combination)
        {
          const Nt = N + Wf, e = Nt > 0 ? M / Nt * 1000 : 1e9;                      // mm
          let qmax;
          if (Nt <= 0) qmax = 0;
          else if (e <= Bw / 6) qmax = Nt / (Bw * Lw / 1e6) * (1 + 6 * e / Bw);
          else if (e < Bw / 2) qmax = 2 * Nt / (3 * Lw / 1000 * (Bw / 2 - e) / 1000);
          else qmax = Infinity;                                                   // resultant outside the base: the footing overturns
          const ur = isFinite(qmax) ? qmax / phiq : 99; if (ur > worstBr.ur) worstBr = { ur, qmax, e, Nt, b };
        }
      });
      if (worstRot.b) {
        R.eq(L('Footing overturning about its edge', 'การพลิกคว่ำของฐานรากรอบขอบ'), 'M* = ΣM*_base + ΣV*·D,  M_stb = (0.9G_ftg + N*)·B/2 — ' + worstRot.b.k.nm, f(worstRot.M, 2) + ' / ' + f(worstRot.Mr, 2), 'kNm');
        add(idk + 'rot', nm + L(': overturning about its edge', ': การพลิกคว่ำรอบขอบ'), worstRot.M, worstRot.Mr, 'kNm', R.chk(L('Footing overturning', 'การพลิกคว่ำของฐานราก'), worstRot.M, worstRot.Mr, 'kNm'), 'ftg');
      }
      if (worstUp.b) {
        R.eq(L('Net uplift on the footing', 'แรงยกสุทธิที่ฐานราก'), 'U* = −N* (0.9G + W_u)  ≤ 0.9·(G_ftg + G_soil) — ' + worstUp.b.k.nm, f(worstUp.U, 2) + ' / ' + f(worstUp.R, 2), 'kN');
        add(idk + 'up', nm + L(': uplift', ': แรงยก'), worstUp.U, worstUp.R, 'kN', R.chk(L('Uplift', 'แรงยก'), worstUp.U, worstUp.R, 'kN'), 'ftg');
      } else R.txt(L('No net uplift on this footing line in any combination.', 'ไม่มีแรงยกสุทธิที่ฐานรากแนวนี้ในทุกกรณี'));
      if (worstBr.b) {
        R.eq(L('Eccentricity and bearing', 'ความเยื้องศูนย์และแรงแบกทาน'), 'e = M*/N*,  q_max = N(1 + 6e/B)/(BL) or 2N/(3L(B/2 − e)) — ' + worstBr.b.k.nm, f(worstBr.e, 0) + ' mm, ' + f(worstBr.qmax, 1), 'kPa');
        add(idk + 'br', nm + L(': bearing pressure', ': แรงแบกทาน'), worstBr.qmax, phiq, 'kPa', R.chk(L('Bearing q_max ≤ φ_g·q_ult', 'แรงแบกทาน q_max ≤ φ_g·q_ult'), worstBr.qmax, phiq, 'kPa', worstBr.ur), 'ftg');
        if (!isFinite(worstBr.qmax)) R.txt(L('The resultant falls outside the footing (e ≥ B/2): widen the footing.', 'แรงลัพธ์อยู่นอกฐานราก (e ≥ B/2): เพิ่มความกว้างฐานราก'));
      }
      // SLS bearing (G + W_s) against the allowable bearing pressure
      if (g.qa > 0) {
        ['W1', 'W2', 'WD'].forEach(w => {
          const b = Object.assign({ k: { gG: 1, nm: 'G + W_s (' + w + ')' } }, baseActs(1.0, WS[w]));
          const N = (line === 'F' ? b.NF : b.NR) * (perPost ? 1 / nposts : 1), n = perPost ? 1 : nposts;
          const M = n * b.Mp + n * b.Vp * Df / 1000, Nt = N + Wc + Ws, e = Nt > 0 ? M / Nt * 1000 : 1e9;
          const qmax = Nt <= 0 ? 0 : e <= B / 6 ? Nt / (B * Lx / 1e6) * (1 + 6 * e / B) : e < B / 2 ? 2 * Nt / (3 * Lx / 1000 * (B / 2 - e) / 1000) : Infinity;
          const ur = isFinite(qmax) ? qmax / g.qa : 99; if (ur > worstBrS.ur) worstBrS = { ur, qmax, b };
        });
        add(idk + 'brs', nm + L(': bearing (SLS)', ': แรงแบกทาน (SLS)'), worstBrS.qmax, g.qa, 'kPa', R.chk(L('SLS bearing ≤ q_a — ', 'แรงแบกทานใช้งาน ≤ q_a — ') + worstBrS.b.k.nm, worstBrS.qmax, g.qa, 'kPa', worstBrS.ur), 'ftg');
      }
      return { worstRot, worstUp, worstBr };
    }
    const fR = footing(L('Rear strip footing', 'ฐานรากแถบแนวหลัง'), 'fr', 'R', Br, Lr, nR, WrF, WrS, false);
    const fF = front === 'pad' ? footing(L('Front pad footings', 'ฐานรากเดี่ยวแนวหน้า'), 'ff', 'F', Bf, Lf, nF, WfF / nF, WfS / nF, true)
      : footing(L('Front strip footing', 'ฐานรากแถบแนวหน้า'), 'ff', 'F', Bf, Lf, nF, WfF, WfS, false);

    // ---------- strip reinforcement (longitudinal bending between posts) — AS 3600 §8.1
    R.sec(L('Footing reinforcement', 'เหล็กเสริมฐานราก'), 'AS 3600:2018 §8.1.2, §8.1.6.1');
    const barA = d => PI * d * d / 4;
    function stripBend(nm, idk, B, Lx, s, line, nposts) {
      if (nposts < 2 || s <= 0) return;
      // bearing: posts push down, soil pushes up → tension at the TOP between posts, at the BOTTOM over the posts / cantilever ends.
      // uplift: posts pull up, the footing (and soil over it) hangs between them → tension at the BOTTOM between posts.
      let wUp = 0, Pup = 0;
      BA.forEach(b => { const N = line === 'F' ? b.NF : b.NR; if (N > 0) wUp = max(wUp, N / (Lx / 1000)); else Pup = max(Pup, -N / nposts); });
      const Wself = g.gc * B * Df / 1e6 + (soilOn ? g.gs * B * dcov / 1e6 : 0);
      const sm = s / 1000, kM = nposts > 2 ? 10 : 8, a = max(0, (Lx - (Ls - 2 * ep)) / 2000);
      const lUp = min(sm, Pup / max(1e-6, 0.9 * Wself));                          // length of footing lifted to balance one post's uplift
      const Mtop = wUp * sm * sm / kM, Mbot = max(nposts > 2 ? wUp * sm * sm / 10 : 0, wUp * a * a / 2, Pup * lUp / 8);
      const cover = g.cover, dbar = g.db, d = Df - cover - g.dl - dbar / 2;
      const Ast = g.nt * barA(dbar), Asb = g.nb * barA(dbar), fsy = 500, fc = g.fc, a2 = max(0.67, 0.85 - 0.0015 * fc);
      const phiM = As => { const aa = As * fsy / (a2 * fc * B); return 0.85 * As * fsy * (d - aa / 2) / 1e6; };
      const Mcr = 0.6 * sq(fc) * B * Df * Df / 6 / 1e6;
      R.eq(nm + ' — ' + L('loads', 'แรง'), L('soil reaction w = N*/L; post span s; end cantilever a', 'แรงดันดิน w = N*/L; ช่วงเสา s; ส่วนยื่นปลาย a'), f(wUp, 2) + ' kN/m, s = ' + f(sm, 2) + ' m, a = ' + f(a, 2) + ' m', '');
      R.eq('M*_top', 'w·s²/' + kM + L(' (between posts)', ' (ระหว่างเสา)'), Mtop, 'kNm');
      R.eq('M*_bottom', L('max(w·s²/10 over posts, w·a²/2 cantilever, P_up·l/8 with l = P_up/0.9g_self under uplift)', 'max(w·s²/10 เหนือเสา, w·a²/2 ส่วนยื่น, P_up·l/8 โดย l = P_up/0.9g_self เมื่อมีแรงยก)'), Mbot, 'kNm');
      R.eq(L('Bars', 'เหล็ก'), L('top ', 'บน ') + g.nt + 'N' + dbar + ', ' + L('bottom ', 'ล่าง ') + g.nb + 'N' + dbar + ', d = ' + f(d, 0) + ' mm, α₂ = ' + f(a2, 3) + ' → φM_u top / bottom', f(phiM(Ast), 2) + ' / ' + f(phiM(Asb), 2), 'kNm');
      add(idk + 'mt', nm + L(': bending, top bars', ': การดัด เหล็กบน'), Mtop, phiM(Ast), 'kNm', R.chk('M*_top ≤ φM_u', Mtop, phiM(Ast), 'kNm'), 'rc');
      add(idk + 'mb', nm + L(': bending, bottom bars', ': การดัด เหล็กล่าง'), Mbot, phiM(Asb), 'kNm', R.chk('M*_bottom ≤ φM_u', Mbot, phiM(Asb), 'kNm'), 'rc');
      R.eq(L('Minimum strength', 'กำลังต่ำสุด'), "M_uo ≥ (M_uo)_min = 1.2·M_cr,  M_cr = 0.6√f'c·B·D²/6", 1.2 * Mcr, 'kNm', '§8.1.6.1');
      add(idk + 'mmin', nm + L(': minimum strength 1.2M_cr', ': กำลังต่ำสุด 1.2M_cr'), 1.2 * Mcr, min(phiM(Ast), phiM(Asb)) / 0.85, 'kNm', R.chk('1.2·M_cr ≤ M_uo (' + L('lesser face', 'ด้านที่น้อยกว่า') + ')', 1.2 * Mcr, min(phiM(Ast), phiM(Asb)) / 0.85, 'kNm'), 'rc');
    }
    stripBend(L('Rear strip', 'ฐานรากแถบหลัง'), 'fr', Br, Lr, sR, 'R', nR);
    if (front === 'strip') stripBend(L('Front strip', 'ฐานรากแถบหน้า'), 'ff', Bf, Lf, sF, 'F', nF);
    R.txt(L('Detail: N12 ligatures at 300 mm maximum around the longitudinal bars, 50 mm cover to bars cast against blinding (65 mm against ground).', 'รายละเอียด: เหล็กปลอก N12 ระยะไม่เกิน 300 มม. ระยะหุ้ม 50 มม. เมื่อเทบนคอนกรีตหยาบ (65 มม. เมื่อเทบนดิน)'));

    // ---------- governing post actions (per post) for the post, base plate, bolts and weld
    const postCases = [];
    BA.forEach(b => {
      [['F', b.NF / nF, hF], ['R', b.NR / nR, hR]].forEach(([ln, N, h]) => postCases.push({ k: b.k, ln, N, V: b.Vp, M: b.Mp, axis: b.axis, h }));
    });
    const tens = postCases.reduce((a, c) => (!a || (c.M + max(0, -c.N) * 0.05 > a.M + max(0, -a.N) * 0.05) ? c : a), null);
    const upl = postCases.reduce((a, c) => (!a || c.N < a.N ? c : a), null);
    const comp = postCases.reduce((a, c) => (!a || c.N + c.M > a.N + a.M ? c : a), null);

    // post member (AS 4100 §5, §6, §8.3 — section capacity at the base, compact SHS)
    R.sec(L('Post at the base', 'เสาที่โคน'), 'AS 4100 §5.2, §5.11, §8.3');
    const lamE = (post.B - 2 * post.t) / post.t * sq(post.fy / 250), Ze = lamE <= 30 ? min(post.Sx, 1.5 * post.Zx) : lamE <= 40 ? post.Zx + (40 - lamE) / 10 * (min(post.Sx, 1.5 * post.Zx) - post.Zx) : post.Zx * 40 / lamE;
    const phiMs = 0.9 * post.fy * Ze / 1e6, phiNs = 0.9 * post.A * post.fy / 1e3, phiVv = 0.9 * 0.6 * post.fy * 2 * (post.D - 2 * post.t) * post.t / 1e3;
    R.eq('λ_e', '(b − 2t)/t·√(f_y/250)', lamE, '', 'Table 5.2');
    R.eq('φM_s', '0.9·f_y·Z_e', phiMs, 'kNm');
    R.eq('φN_s, φV_v', '0.9·A·f_y,  0.9·0.6·f_y·A_w', f(phiNs, 1) + ', ' + f(phiVv, 1), 'kN');
    const pr = postCases.reduce((a, c) => { const u = abs(c.N) / phiNs + c.M / phiMs; return !a || u > a.u ? { c, u } : a; }, null);
    add('pNM', L('Post: axial + bending at base', 'เสา: แรงตามแนวแกน + ดัดที่โคน'), pr.u, 1, '', R.chk('N*/φN_s + M*/φM_s ≤ 1 — ' + pr.c.k.nm, pr.u, 1, '', pr.u), 'post');
    const pv = postCases.reduce((a, c) => max(a, c.V), 0);
    add('pV', L('Post: shear', 'เสา: แรงเฉือน'), pv, phiVv, 'kN', R.chk(L('Shear V* ≤ φV_v', 'แรงเฉือน V* ≤ φV_v'), pv, phiVv, 'kN'), 'post');
    // SLS sway (cantilever post, load at the resultant height)
    {
      const ws = WS.W1, Vp = abs(ws.Htot) / nAll, hh = (ws.zH - z0), I = post.Ix;
      const dlt = frame ? Vp * 1e3 * Math.pow(hh, 3) / (12 * 200000 * I) : Vp * 1e3 * Math.pow(hh, 3) / (3 * 200000 * I);
      const lim = (max(hF, hR) + dcov) / (g.dlim || 100);
      R.eq(L('Sway at roof level (SLS, W1)', 'การเซที่ระดับหลังคา (SLS, W1)'), frame ? 'Δ = V·h³/(12EI)' : 'Δ = V·h³/(3EI)', dlt, 'mm');
      add('pD', L('Post sway (SLS)', 'การเซของเสา (SLS)'), dlt, lim, 'mm', R.chk('Δ ≤ h/' + (g.dlim || 100), dlt, lim, 'mm'), 'post');
    }

    // ---------- base plate, hold-down bolts, concrete anchorage, weld
    R.sec(L('Base plate and hold-down bolts', 'แผ่นฐานและสลักยึด'), 'AS 4100 §9.3, §9.7.3; AS 3600 §12.6');
    const nb = g.nbolt === 2 ? 2 : 4, bt = g.bolt, bd = dOf(bt), [Asb, Acb] = BOLTS[bt] || [245, 225], fuf = BGRADE[g.bgrade] || 400;
    const sb = g.sbolt, Bp = g.Bpl, tp = g.tpl, fyp = g.fyp;
    const z = sb / 2 + (dc - tc) / 2;                                              // lever arm: tension bolt row → compression flange
    const nT = nb === 4 ? 2 : 1;                                                    // bolts in the tension row
    const phiNtf = 0.8 * Asb * fuf / 1e3, phiVf = 0.8 * 0.62 * fuf * Acb / 1e3;    // kN per bolt (threads in the shear plane)
    R.eq(L('Bolts', 'สลัก'), nb + ' × ' + bt + ' ' + L('grade ', 'เกรด ') + g.bgrade + ', ' + L('gauge ', 'ระยะ ') + sb + ' mm, ' + L('plate ', 'แผ่น ') + Bp + ' × ' + Bp + ' × ' + tp + ' mm', '', '');
    R.eq('φN_tf', '0.8·A_s·f_uf = 0.8 × ' + Asb + ' × ' + fuf, phiNtf, 'kN', '§9.3.2.2');
    R.eq('φV_f', '0.8·0.62·f_uf·k_r·A_c (' + L('threads in the shear plane', 'เกลียวอยู่ในระนาบเฉือน') + ')', phiVf, 'kN', '§9.3.2.1');
    R.eq('z', L('lever arm: tension bolt row to the compression flange = s/2 + (d − t)/2', 'แขนโมเมนต์: แถวสลักรับแรงดึงถึงปีกรับแรงอัด = s/2 + (d − t)/2'), z, 'mm');
    const boltForces = c => {
      const Tr = max(0, c.M * 1e6 / z / 1e3 - c.N / 2);                             // kN on the tension row (N + compression)
      return { Tr, Tb: Tr / nT, Vb: c.V / nb };
    };
    let bw = null;
    postCases.forEach(c => { const q = boltForces(c), u = Math.pow(q.Vb / phiVf, 2) + Math.pow(q.Tb / phiNtf, 2); if (!bw || u > bw.u) bw = { c, q, u }; });
    R.eq(L('Governing bolt actions', 'แรงในสลักวิกฤต'), 'T_row = M*/z − N*/2,  N*_tf = T_row/' + nT + ',  V*_f = V*/' + nb + ' — ' + bw.c.k.nm + (bw.c.ln === 'F' ? L(', front post', ', เสาหน้า') : L(', rear post', ', เสาหลัง')), f(bw.q.Tb, 2) + ' / ' + f(bw.q.Vb, 2), 'kN');
    add('bT', L('Bolt tension', 'แรงดึงสลัก'), bw.q.Tb, phiNtf, 'kN', R.chk('N*_tf ≤ φN_tf', bw.q.Tb, phiNtf, 'kN'), 'conn');
    add('bV', L('Bolt shear', 'แรงเฉือนสลัก'), bw.q.Vb, phiVf, 'kN', R.chk('V*_f ≤ φV_f', bw.q.Vb, phiVf, 'kN'), 'conn');
    add('bTV', L('Bolt tension + shear', 'แรงดึง + เฉือนสลัก'), bw.u, 1, '', R.chk('(V*_f/φV_f)² + (N*_tf/φN_tf)² ≤ 1', bw.u, 1, '', bw.u), 'conn');

    // concrete anchorage — AS 5216:2021 (cast-in headed bolts, cracked concrete)
    R.sec(L('Anchorage in the footing (cast-in bolts)', 'การยึดในฐานราก (สลักฝังในคอนกรีต)'), 'AS 5216:2021 §6, §7 (cracked concrete, φ_Mc = 1/1.5)');
    const hef = g.hef, fc = g.fc, phic = 1 / 1.5;
    const Bfoot = min(Br, Bf);                                                      // narrowest footing carrying posts
    const c1 = (Bfoot - sb) / 2;                                                    // edge distance across the footing
    const ccr = 1.5 * hef, scr = 3 * hef;
    const N0 = 8.9 * sq(fc) * Math.pow(hef, 1.5) / 1e3;                             // kN, k_cr,N = 8.9
    const nTb = nb === 4 ? 2 : 1;
    // projected area of the tension bolts (one row; across the footing the edge distance c1 applies on one side when the row is at the edge)
    const AcN0 = scr * scr, wx = min(sb, scr) * (nTb - 1) + 2 * ccr, wy = min(c1, ccr) + min(sb + c1, ccr);
    const AcN = min(AcN0 * nTb, wx * wy);
    const psiS = min(1, 0.7 + 0.3 * c1 / ccr), psiRe = min(1, 0.5 + hef / 200);
    const NRkc = N0 * AcN / AcN0 * psiS * psiRe, NRdc = phic * NRkc;
    R.eq('N⁰_Rk,c', "k₁·√f'c·h_ef^1.5 = 8.9·√" + f(fc, 0) + '·' + hef + '^1.5', N0, 'kN', '§7.2.1.4');
    R.eq('A_c,N / A⁰_c,N, ψ_s,N, ψ_re,N', L('edge distance c = ', 'ระยะขอบ c = ') + f(c1, 0) + ' mm, c_cr,N = 1.5h_ef = ' + f(ccr, 0) + ' mm', f(AcN / AcN0, 2) + ', ' + f(psiS, 3) + ', ' + f(psiRe, 2), '');
    R.eq('φN_Rk,c', L('concrete cone, tension row (', 'กรวยคอนกรีต แถวรับแรงดึง (') + nTb + L(' bolts)', ' ตัว)'), NRdc, 'kN');
    const AF = NUT_AF[bt] || 1.5 * bd, Ah = 0.866 * AF * AF - PI * bd * bd / 4, NRdp = phic * 7.5 * Ah * fc / 1e3;
    R.eq('φN_Rk,p', L('pull-out of the nut head, k₂ = 7.5, A_h = 0.866·AF² − π·d²/4 = ', 'การถอนของหัวน็อต k₂ = 7.5, A_h = 0.866·AF² − π·d²/4 = ') + f(Ah, 0) + ' mm²', NRdp, 'kN', '§7.2.1.5');
    const Trow = bw.q.Tb * nTb;
    add('aC', L('Anchors: concrete cone (tension)', 'สลักยึด: กรวยคอนกรีต (แรงดึง)'), Trow, NRdc, 'kN', R.chk(L('Tension row N* ≤ φN_Rk,c', 'แรงดึงแถว N* ≤ φN_Rk,c'), Trow, NRdc, 'kN'), 'anch');
    add('aP', L('Anchors: pull-out', 'สลักยึด: การถอน'), bw.q.Tb, NRdp, 'kN', R.chk(L('Per bolt N* ≤ φN_Rk,p', 'ต่อสลัก N* ≤ φN_Rk,p'), bw.q.Tb, NRdp, 'kN'), 'anch');
    // edge breakout in shear towards the long edge of the footing (W1/W2) and pry-out
    const lf = min(hef, 12 * bd), alpha = 0.1 * Math.pow(lf / c1, 0.5), beta = 0.1 * Math.pow(bd / c1, 0.2);
    const V0 = 1.7 * Math.pow(bd, alpha) * Math.pow(lf, beta) * sq(fc) * Math.pow(c1, 1.5) / 1e3;
    const AcV0 = 4.5 * c1 * c1, AcV = (2 * 1.5 * c1 + (nb === 4 ? sb : 0)) * min(Df, 1.5 * c1);
    const psiH = max(1, sq(1.5 * c1 / Df)), NRdcp = phic * 2 * NRkc;
    const VRdc = phic * V0 * min(AcV / AcV0, 2) * psiH;
    R.eq('V⁰_Rk,c', '1.7·d^α·l_f^β·√f\'c·c₁^1.5, c₁ = ' + f(c1, 0) + ' mm', V0, 'kN', '§7.2.2.5');
    R.eq('φV_Rk,c', 'A_c,V/A⁰_c,V = ' + f(AcV / AcV0, 2) + ', ψ_h,V = ' + f(psiH, 2), VRdc, 'kN');
    R.eq('φV_Rk,cp', L('pry-out, k₈ = 2', 'การงัดหลุด k₈ = 2'), NRdcp, 'kN', '§7.2.2.4');
    const VshT = postCases.filter(c => c.axis === 'y').reduce((a, c) => max(a, c.V), 0);
    add('aV', L('Anchors: concrete edge (shear across the footing)', 'สลักยึด: ขอบคอนกรีต (เฉือนขวางฐานราก)'), VshT, VRdc, 'kN', R.chk(L('V* ≤ φV_Rk,c', 'V* ≤ φV_Rk,c'), VshT, VRdc, 'kN'), 'anch');
    const Vmax = postCases.reduce((a, c) => max(a, c.V), 0);
    add('aPO', L('Anchors: pry-out', 'สลักยึด: การงัดหลุด'), Vmax, NRdcp, 'kN', R.chk('V* ≤ φV_Rk,cp', Vmax, NRdcp, 'kN'), 'anch');
    const intc = Math.pow(Trow / min(NRdc, NRdp * nTb), 1.5) + Math.pow(VshT / min(VRdc, NRdcp), 1.5);
    add('aNV', L('Anchors: concrete tension + shear', 'สลักยึด: คอนกรีต แรงดึง + เฉือน'), intc, 1, '', R.chk('(N*/φN_Rk)^1.5 + (V*/φV_Rk)^1.5 ≤ 1', intc, 1, '', intc), 'anch');
    if (hef + 50 > Df) warn.push(L('Bolt embedment h_ef leaves less than 50 mm below the head — deepen the footing or shorten the bolts.', 'ความลึกฝังสลัก h_ef เหลือคอนกรีตใต้หัวน้อยกว่า 50 มม. — เพิ่มความลึกฐานรากหรือลดความยาวสลัก'));
    if (sb < 3 * bd + dc || sb > Bp - 2 * 1.5 * bd) warn.push(L('Bolt gauge does not suit the post and plate (needs room for nuts beside the post and 1.5d to the plate edge).', 'ระยะสลักไม่เหมาะกับเสาและแผ่น (ต้องมีที่สำหรับน็อตข้างเสาและระยะ 1.5d ถึงขอบแผ่น)'));

    // base plate bending: tension side (bolt row) and compression side (bearing)
    R.sec(L('Base plate bending and bearing', 'การดัดแผ่นฐานและแรงแบกทาน'), 'AS 4100 §5.2 (plate), AS 3600 §12.6');
    const m = sb / 2 - dc / 2;                                                       // bolt line to post face
    const phiMp = 0.9 * fyp * Bp * tp * tp / 4 / 1e6;                                // kNm (plastic, full width)
    const Mpt = bw.q.Tr * m / 1e3;
    R.eq(L('Tension side', 'ด้านรับแรงดึง'), 'M* = T_row·m,  m = s/2 − d/2 = ' + f(m, 1) + ' mm', Mpt, 'kNm');
    R.eq('φM_p', '0.9·f_y·B·t²/4', phiMp, 'kNm');
    add('plT', L('Base plate: bending at the bolts', 'แผ่นฐาน: การดัดที่แนวสลัก'), Mpt, phiMp, 'kNm', R.chk(L('Tension side M* ≤ φM_p', 'ด้านดึง M* ≤ φM_p'), Mpt, phiMp, 'kNm'), 'conn');
    const A1 = Bp * Bp, A2 = min(Bfoot, Bp * 3) * min(Bfoot, Bp * 3), fb = min(0.6 * 0.85 * fc * sq(A2 / A1), 2 * 0.6 * 0.85 * fc);
    const cc = comp, Cc = max(0, cc.M * 1e6 / z / 1e3 - cc.N / 2) + max(0, cc.N), Y = Cc * 1e3 / (fb * Bp);
    const n2 = (Bp - 0.95 * dc) / 2;
    const Mpc = (Y < n2 ? fb * Y * (n2 - Y / 2) : fb * n2 * n2 / 2) * Bp / 1e6;
    R.eq(L('Bearing strength', 'กำลังแบกทาน'), "φ·0.85f'c·√(A₂/A₁) ≤ 2φ·0.85f'c, φ = 0.6", fb, 'MPa', 'AS 3600 §12.6');
    R.eq(L('Compression side', 'ด้านรับแรงอัด'), 'C = T_row + N*,  Y = C/(f_b·B),  n = (B − 0.95d)/2 = ' + f(n2, 1) + ' mm — ' + cc.k.nm, f(Cc, 2) + ' kN, Y = ' + f(Y, 1), 'mm');
    add('plC', L('Base plate: bearing on concrete', 'แผ่นฐาน: แรงแบกทานบนคอนกรีต'), Y, Bp / 2, 'mm', R.chk(L('Bearing length Y ≤ B/2', 'ความยาวแบกทาน Y ≤ B/2'), Y, Bp / 2, 'mm'), 'conn');
    add('plB', L('Base plate: bending on the compression side', 'แผ่นฐาน: การดัดด้านรับแรงอัด'), Mpc, phiMp, 'kNm', R.chk(L('Compression side M* ≤ φM_p', 'ด้านอัด M* ≤ φM_p'), Mpc, phiMp, 'kNm'), 'conn');
    if (tp < 10) warn.push(L('Base plates thinner than 10 mm are not recommended for cast-in hold-down bolts.', 'ไม่แนะนำแผ่นฐานบางกว่า 10 มม. สำหรับสลักยึดฝังในคอนกรีต'));

    // weld: post to base plate, fillet all round (AS 4100 §9.7.3.10, E49XX SP)
    R.sec(L('Weld: post to base plate', 'รอยเชื่อม: เสากับแผ่นฐาน'), 'AS 4100 §9.7.3.10 (E49XX, SP, φ = 0.8)');
    const sw = g.sw, phiVw = 0.8 * 0.6 * 490 * sw / Math.SQRT2 / 1e3;               // kN/mm
    const Lw = 4 * dc, Zw = dc * dc + dc * dc / 3;                                    // mm, mm² (square outline)
    let ww = null;
    postCases.forEach(c => { const vn = max(0, -c.N) * 1e3 / Lw + c.M * 1e6 / Zw, vs = c.V * 1e3 / (2 * dc), v = Math.hypot(vn, vs) / 1e3; if (!ww || v > ww.v) ww = { c, v, vn, vs }; });
    R.eq(L('Weld group (square outline)', 'กลุ่มรอยเชื่อม (รอบเสาสี่เหลี่ยม)'), 'L_w = 4d, Z_w = d² + d²/3 = ' + f(Zw, 0) + ' mm²', Lw, 'mm');
    R.eq('v*_w', '√((N*/L_w + M*/Z_w)² + (V*/2d)²) — ' + ww.c.k.nm, ww.v, 'kN/mm');
    R.eq('φv_w', '0.8·0.6·f_uw·t_t = 0.8 × 0.6 × 490 × ' + sw + '/√2', phiVw, 'kN/mm');
    add('w', L('Fillet weld post-to-plate', 'รอยเชื่อมพอกเสา-แผ่นฐาน'), ww.v, phiVw, 'kN/mm', R.chk('v*_w ≤ φv_w', ww.v, phiVw, 'kN/mm'), 'conn');
    if (sw > tc) warn.push(L('Fillet weld larger than the post wall thickness.', 'รอยเชื่อมพอกใหญ่กว่าความหนาผนังเสา'));

    warn.splice(0, warn.length, ...warn.filter(Boolean));
    return {
      code: 'AS', elem: 'shelter', checks, rep: R, warn: [...new Set(warn)],
      geo: { Ls, Dp, hF, hR, ofF, ofR, ep, nR, nF, xR, xF, dr, dcov, Df, Br, Bf, Lr, Lf, front, zwb: g.zwb, hw: g.hw, bs: g.bs, nsw: g.nsw, Lw: g.Lw, dc, Bp, tp, sb, nb, bolt: bt, hef, sw, slope },
      wind: { Vu, Vs, qu, qs, WU, WS }, stab, Gtot, Wsup, post, BA, fR, fF, bw, frame
    };
  }

  // ------------------------------------------------------------------ drawings (SVG)
  function sketch(r, T) {
    const g = r.geo, W = 440, fmt = v => f(v, 0), d0 = dOf(g.bolt);
    const css = `<style>.sh-f{fill:color-mix(in srgb,#e11d48 16%,transparent);stroke:#e11d48;stroke-width:1.3}.sh-r{fill:none;stroke:currentColor;stroke-dasharray:5 3;stroke-width:.8;opacity:.7}.sh-p{fill:currentColor}.sh-w{stroke:#a16207;stroke-width:3}.sh-t{font:10px var(--f-sans,sans-serif);fill:currentColor}.sh-h{font:700 10.5px var(--f-sans,sans-serif);fill:currentColor;letter-spacing:.04em}.sh-d{stroke:currentColor;stroke-width:.6;opacity:.75;fill:none}.sh-g{stroke:#78716c;stroke-width:1.2}.sh-c{fill:color-mix(in srgb,#94a3b8 28%,transparent);stroke:#64748b;stroke-width:1}.sh-b{fill:none;stroke:#2563eb;stroke-width:1.4}</style>`;
    const dimH = (x1, x2, y, t) => `<path d="M${x1} ${y}H${x2}M${x1} ${y - 3}v6M${x2} ${y - 3}v6" class="sh-d"/><text x="${(x1 + x2) / 2}" y="${y - 3}" text-anchor="middle" class="sh-t">${t}</text>`;
    const dimV = (x, y1, y2, t) => `<path d="M${x} ${y1}V${y2}M${x - 3} ${y1}h6M${x - 3} ${y2}h6" class="sh-d"/><text x="${x - 4}" y="${(y1 + y2) / 2 + 3}" text-anchor="end" class="sh-t">${t}</text>`;
    // ---- plan
    const Lmax = max(g.Ls, g.Lr, g.front === 'strip' ? g.Lf : g.Ls), k = (W - 64) / Lmax;
    const yTop = 22 + g.ofR * k, X = x => 12 + (x + Lmax / 2) * k, Y = y => yTop + (g.Dp - y) * k + max(g.Br / 2 - g.ofR, 0) * k;
    let s = `<text x="8" y="14" class="sh-h">${T('PLAN', 'ผัง')}</text>`;
    s += `<rect x="${X(-g.Ls / 2)}" y="${Y(g.Dp + g.ofR)}" width="${g.Ls * k}" height="${g.dr * k}" class="sh-r"/>`;
    s += `<rect x="${X(-g.Lr / 2)}" y="${Y(g.Dp + g.Br / 2)}" width="${g.Lr * k}" height="${g.Br * k}" class="sh-f"/>`;
    if (g.front === 'strip') s += `<rect x="${X(-g.Lf / 2)}" y="${Y(g.Bf / 2)}" width="${g.Lf * k}" height="${g.Bf * k}" class="sh-f"/>`;
    else g.xF.forEach(x => { s += `<rect x="${X(x - g.Lf / 2)}" y="${Y(g.Bf / 2)}" width="${g.Lf * k}" height="${g.Bf * k}" class="sh-f"/>`; });
    s += `<line x1="${X(-g.Lw / 2)}" y1="${Y(g.Dp) - 3.5}" x2="${X(g.Lw / 2)}" y2="${Y(g.Dp) - 3.5}" class="sh-w"/>`;
    const pw = max(4, g.dc * k);
    g.xR.forEach(x => { s += `<rect x="${X(x) - pw / 2}" y="${Y(g.Dp) - pw / 2}" width="${pw}" height="${pw}" class="sh-p"/>`; });
    g.xF.forEach(x => { s += `<rect x="${X(x) - pw / 2}" y="${Y(0) - pw / 2}" width="${pw}" height="${pw}" class="sh-p"/>`; });
    s += `<text x="${X(-g.Ls / 2) + 4}" y="${Y(g.Dp) + g.Br / 2 * k + 11}" class="sh-t">${T('rear strip', 'แถบหลัง')} ${fmt(g.Lr)} × ${fmt(g.Br)} × ${fmt(g.Df)}</text>`;
    const yF = Y(-(g.front === 'strip' ? g.Bf : g.Bf) / 2);
    s += `<text x="${X(-g.Ls / 2) + 4}" y="${yF + 11}" class="sh-t">${g.front === 'strip' ? T('front strip', 'แถบหน้า') + ' ' + fmt(g.Lf) + ' × ' + fmt(g.Bf) : g.nF + ' ' + T('pads', 'ฐานเดี่ยว') + ' ' + fmt(g.Lf) + ' × ' + fmt(g.Bf)} × ${fmt(g.Df)}</text>`;
    s += dimH(X(-g.Ls / 2), X(g.Ls / 2), yF + 26, fmt(g.Ls));
    s += `<text x="${X(Lmax / 2) + 5}" y="${Y(g.Dp) + 3}" class="sh-t">${T('REAR', 'หลัง')}</text><text x="${X(Lmax / 2) + 5}" y="${Y(0) + 3}" class="sh-t">${T('FRONT', 'หน้า')}</text>`;
    const planH = yF + 34;
    // ---- section (left) and base plate (right)
    const y0 = planH + 22, sW = W * 0.56, zTop = max(g.hF, g.hR), zBot = -(g.dcov + g.Df), spanY = g.Dp + g.ofF + g.ofR + max(g.Bf, g.Br);
    const ks = min((sW - 40) / spanY, 210 / (zTop - zBot));
    const ox = 52 + (max(g.ofF, g.Bf / 2)) * ks, oz = y0 + 8 + zTop * ks;
    const SX = y => ox + y * ks, SZ = z => oz - z * ks, zr = y => g.hF + (g.hR - g.hF) * y / g.Dp;
    s += `<text x="8" y="${y0 - 6}" class="sh-h">${T('SECTION', 'รูปตัด')}</text>`;
    s += `<line x1="8" y1="${SZ(0)}" x2="${sW}" y2="${SZ(0)}" class="sh-g"/><text x="10" y="${SZ(0) - 3}" class="sh-t">${T('G.L.', 'ระดับดิน')}</text>`;
    const ftg = (yc, B) => `<rect x="${SX(yc - B / 2)}" y="${SZ(-g.dcov)}" width="${B * ks}" height="${g.Df * ks}" class="sh-f"/>`;
    s += ftg(0, g.Bf) + ftg(g.Dp, g.Br);
    s += `<line x1="${SX(0)}" y1="${SZ(-g.dcov)}" x2="${SX(0)}" y2="${SZ(zr(0))}" stroke="currentColor" stroke-width="2.4"/><line x1="${SX(g.Dp)}" y1="${SZ(-g.dcov)}" x2="${SX(g.Dp)}" y2="${SZ(zr(g.Dp))}" stroke="currentColor" stroke-width="2.4"/>`;
    s += `<line x1="${SX(-g.ofF)}" y1="${SZ(zr(-g.ofF))}" x2="${SX(g.Dp + g.ofR)}" y2="${SZ(zr(g.Dp + g.ofR))}" stroke="currentColor" stroke-width="3"/>`;
    s += `<line x1="${SX(g.Dp) + 4}" y1="${SZ(g.zwb)}" x2="${SX(g.Dp) + 4}" y2="${SZ(g.zwb + g.hw)}" class="sh-w"/>`;
    s += dimV(SX(-g.ofF) - 14, SZ(0), SZ(zr(0)) , f(g.hF, 0));
    s += dimH(SX(0), SX(g.Dp), SZ(zBot) + 14, fmt(g.Dp));
    s += `<text x="${SX(g.Dp / 2)}" y="${SZ(-g.dcov) - 4}" text-anchor="middle" class="sh-t">${fmt(g.dcov)} ${T('cover', 'กลบ')}</text>`;
    const wa = SZ(zr(0) * 0.78);
    s += `<path d="M${SX(0) + 6} ${wa}h22" class="sh-d" stroke-width="1.6"/><path d="M${SX(0) + 30} ${wa}l-6 -4v8z" fill="currentColor"/><text x="${SX(0) + 8}" y="${wa - 5}" class="sh-t">W1</text>`;
    // base plate
    const bx = sW + 10, bW = W - bx - 8, kb = min(bW / (g.Bp + 40), 150 / (g.Bp + 40)), pcx = bx + bW / 2, pcy = y0 + 18 + g.Bp / 2 * kb;
    s += `<text x="${bx}" y="${y0 - 6}" class="sh-h">${T('BASE PLATE', 'แผ่นฐาน')}</text>`;
    s += `<rect x="${pcx - g.Bp / 2 * kb}" y="${pcy - g.Bp / 2 * kb}" width="${g.Bp * kb}" height="${g.Bp * kb}" class="sh-c"/>`;
    s += `<rect x="${pcx - g.dc / 2 * kb}" y="${pcy - g.dc / 2 * kb}" width="${g.dc * kb}" height="${g.dc * kb}" fill="none" stroke="currentColor" stroke-width="2"/>`;
    (g.nb === 4 ? [[-1, -1], [1, -1], [1, 1], [-1, 1]] : [[0, -1], [0, 1]]).forEach(([a, b]) => { s += `<circle cx="${pcx + a * g.sb / 2 * kb}" cy="${pcy + b * g.sb / 2 * kb}" r="${max(2.5, d0 / 2 * kb)}" class="sh-b"/>`; });
    s += dimH(pcx - g.Bp / 2 * kb, pcx + g.Bp / 2 * kb, pcy - g.Bp / 2 * kb - 6, fmt(g.Bp));
    if (g.nb === 4) s += dimH(pcx - g.sb / 2 * kb, pcx + g.sb / 2 * kb, pcy + g.Bp / 2 * kb + 14, fmt(g.sb));
    const ty = pcy + g.Bp / 2 * kb + 30;
    [g.Bp + ' × ' + g.Bp + ' × ' + g.tp + ' PL', g.nb + '-' + g.bolt + ' ' + T('cast-in', 'ฝังใน'), 'h_ef = ' + fmt(g.hef), g.sw + ' ' + T('mm fillet weld all round', 'มม. เชื่อมพอกรอบเสา')].forEach((t, i) => { s += `<text x="${pcx}" y="${ty + i * 13}" text-anchor="middle" class="sh-t">${t}</text>`; });
    const H = max(SZ(zBot) + 22, ty + 4 * 13);
    return `<svg viewBox="0 0 ${W} ${H}" class="sec-svg shelter-svg" role="img" aria-label="${T('Footing plan, section and base plate', 'ผังฐานราก รูปตัด และแผ่นฐาน')}">${css}${s}</svg>`;
  }

  G.SHELTER = { design, sketch, REGIONS, MZ };
})(typeof window !== 'undefined' ? window : globalThis);
