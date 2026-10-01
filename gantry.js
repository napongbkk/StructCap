/* StructCap — cantilever traffic sign gantry (steel) to Australian Standards
   AS 4100:2020 (members, connections, fatigue Section 11), AS/NZS 1170.0 (combinations),
   AS/NZS 1170.2 (wind), AS/NZS 1163 (cold-formed hollow sections), AS 1275 (bolts).
   Fatigue loads follow the AASHTO LTS equivalent-static approach (galloping, natural wind gust,
   truck-induced gust) as adopted by Australian road authorities; all values are user-editable.
   Internal units: N, mm, MPa. */
(function (G) {
  'use strict';
  const RC = G.RC, f = RC.f, Rep = RC.Rep;
  const E = 200000, GM = 80000, PI = Math.PI, sq = Math.sqrt;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ------------------------------------------------------------------ section library (AS/NZS 1163)
  const GRADES = { C250L0: { fy: 250, fu: 320 }, C350L0: { fy: 350, fu: 430 }, C450L0: { fy: 450, fu: 500 } };
  const LIB = {
    CHS: [[101.6, [3.2, 4.0, 5.0, 6.0]], [114.3, [3.6, 4.5, 5.4, 6.0]], [139.7, [3.5, 5.0, 5.4]], [165.1, [3.5, 5.0, 5.4]],
      [168.3, [4.8, 6.4, 7.1]], [219.1, [4.8, 6.4, 8.2]], [273.1, [4.8, 6.4, 9.3]], [323.9, [6.4, 9.5, 12.7]],
      [355.6, [6.4, 9.5, 12.7]], [406.4, [6.4, 9.5, 12.7]], [457.0, [6.4, 9.5, 12.7]], [508.0, [6.4, 9.5, 12.7]]],
    SHS: [[100, [3, 4, 5, 6, 9]], [125, [4, 5, 6, 9]], [150, [5, 6, 9]], [200, [5, 6, 9, 12.5, 16]], [250, [6, 9, 12.5, 16]],
      [300, [8, 10, 12.5, 16]], [350, [8, 10, 12.5, 16]], [400, [10, 12.5, 16]]],
    RHS: [[150, 100, [4, 5, 6, 9]], [200, 100, [4, 5, 6, 9]], [250, 150, [5, 6, 9, 12.5, 16]], [300, 200, [6, 8, 10, 12.5, 16]],
      [350, 250, [8, 10, 12.5, 16]], [400, 200, [8, 10, 12.5, 16]], [400, 300, [10, 12.5, 16]]]
  };
  function sizeOptions(shape) {
    if (shape === 'CHS') return LIB.CHS.flatMap(([D, ts]) => ts.map(t => [D + 'x' + t, D.toFixed(1) + ' × ' + t.toFixed(1) + ' CHS']));
    if (shape === 'SHS') return LIB.SHS.flatMap(([B, ts]) => ts.map(t => [B + 'x' + B + 'x' + t, B + ' × ' + B + ' × ' + t + ' SHS']));
    return LIB.RHS.flatMap(([D, B, ts]) => ts.map(t => [D + 'x' + B + 'x' + t, D + ' × ' + B + ' × ' + t + ' RHS']));
  }

  // rounded rectangle (width w, depth h, corner radius r): area, I about axis parallel to w, first moment of half area
  function rr(w, h, r) {
    r = Math.max(0, r);
    const yc = (h / 2 - r) + 4 * r / (3 * PI);
    const A = w * h - (4 - PI) * r * r;
    const I = w * Math.pow(h - 2 * r, 3) / 12 + 2 * ((w - 2 * r) * r * r * r / 12 + (w - 2 * r) * r * Math.pow(h / 2 - r / 2, 2))
      + 4 * ((PI / 16 - 4 / (9 * PI)) * Math.pow(r, 4) + PI * r * r / 4 * yc * yc);
    const Q = w * Math.pow(h / 2 - r, 2) / 2 + (w - 2 * r) * r * (h / 2 - r / 2) + 2 * (PI * r * r / 4) * yc;
    return { A, I, Q };
  }

  function section(shape, id, grade) {
    const gr = GRADES[grade] || GRADES.C350L0, p = id.split('x').map(Number);
    let s;
    if (shape === 'CHS') {
      const D = p[0], t = p[1], d = D - 2 * t;
      const A = PI / 4 * (D * D - d * d), I = PI / 64 * (Math.pow(D, 4) - Math.pow(d, 4)), S = (Math.pow(D, 3) - Math.pow(d, 3)) / 6;
      const J = 2 * I;
      s = { shape, D, B: D, t, A, Ix: I, Iy: I, Zx: 2 * I / D, Zy: 2 * I / D, Sx: S, Sy: S, J, C: 2 * J / D, ro: 0, label: D.toFixed(1) + '×' + t.toFixed(1) + ' CHS' };
    } else {
      const D = p[0], B = p[1], t = p[2];
      const ro = t <= 3 ? 2 * t : 2.5 * t, ri = Math.max(0, ro - t);
      const ox = rr(B, D, ro), ix = rr(B - 2 * t, D - 2 * t, ri), oy = rr(D, B, ro), iy = rr(D - 2 * t, B - 2 * t, ri);
      const Ix = ox.I - ix.I, Iy = oy.I - iy.I, A = ox.A - ix.A;
      const rm = ro - t / 2, Ah = (B - t) * (D - t) - (4 - PI) * rm * rm, ph = 2 * ((B - t) + (D - t)) - (8 - 2 * PI) * rm;
      const J = t * t * t * ph / 3 + 4 * Ah * Ah * t / ph;
      s = { shape, D, B, t, A, Ix, Iy, Zx: 2 * Ix / D, Zy: 2 * Iy / B, Sx: 2 * (ox.Q - ix.Q), Sy: 2 * (oy.Q - iy.Q), J, C: J / (t + 2 * Ah / ph), ro, Ah,
        label: D + '×' + B + '×' + t + ' ' + shape };
    }
    s.grade = grade; s.fy = gr.fy; s.fu = gr.fu;
    s.rx = sq(s.Ix / s.A); s.ry = sq(s.Iy / s.A); s.mass = s.A * 7850e-6; // kg/m
    return s;
  }

  // ------------------------------------------------------------------ AS 4100 capacities
  function bend(s, ax) {
    const fy = s.fy, k = sq(fy / 250), Z = ax === 'x' ? s.Zx : s.Zy, S = ax === 'x' ? s.Sx : s.Sy, Zc = Math.min(S, 1.5 * Z);
    let lam, lamp, lamy, el;
    if (s.shape === 'CHS') { lam = (s.D / s.t) * (fy / 250); lamp = 50; lamy = 120; el = 'CHS'; }
    else {
      const bf = (ax === 'x' ? s.B : s.D) - 2 * s.t, dw = (ax === 'x' ? s.D : s.B) - 2 * s.t;
      const lf = bf / s.t * k, lw = dw / s.t * k;
      if (lf / 40 >= lw / 115) { lam = lf; lamp = 30; lamy = 40; el = 'flange'; } else { lam = lw; lamp = 82; lamy = 115; el = 'web'; }
    }
    let Ze, cls;
    if (lam <= lamp) { Ze = Zc; cls = 'compact'; }
    else if (lam <= lamy) { Ze = Z + (lamy - lam) / (lamy - lamp) * (Zc - Z); cls = 'non-compact'; }
    else { cls = 'slender'; Ze = el === 'CHS' ? Math.min(Z * sq(lamy / lam), Z * Math.pow(2 * lamy / lam, 2)) : el === 'flange' ? Z * lamy / lam : Z * Math.pow(lamy / lam, 2); }
    return { Z, S, Ze, lam, lamp, lamy, cls, el };
  }
  function compression(s, le) {
    const fy = s.fy, k = sq(fy / 250);
    let Ae = s.A;
    if (s.shape === 'CHS') { const le2 = (s.D / s.t) * (fy / 250); Ae = s.A * Math.min(1, sq(82 / le2), Math.pow(3 * 82 / le2, 2)); }
    else {[s.B - 2 * s.t, s.B - 2 * s.t, s.D - 2 * s.t, s.D - 2 * s.t].forEach(b => { const l = b / s.t * k; if (l > 40) Ae -= (b - b * sq(40 / l)) * s.t; }); }
    const kf = Ae / s.A, Ns = kf * s.A * fy, r = Math.min(s.rx, s.ry);
    const lamn = (le / r) * sq(kf) * k, ab = -0.5;
    const aa = 2100 * (lamn - 13.5) / (lamn * lamn - 15.3 * lamn + 2050);
    const lam = lamn + aa * ab, eta = Math.max(0, 0.00326 * (lam - 13.5));
    const xi = (Math.pow(lam / 90, 2) + 1 + eta) / (2 * Math.pow(lam / 90, 2));
    const ac = lam <= 0 ? 1 : Math.min(1, xi * (1 - sq(Math.max(0, 1 - Math.pow(90 / (xi * lam), 2)))));
    return { kf, Ns, lamn, ac, Nc: ac * Ns };
  }
  function shear(s, dir) {
    const fy = s.fy;
    if (s.shape === 'CHS') return { Vw: 0.36 * fy * s.A, Aw: s.A / 2, av: 1, expr: 'V_w = 0.36·f_y·A_e (CHS)' };
    const d = dir === 'x' ? s.D : s.B, Aw = 2 * (d - 2 * s.t) * s.t, dp = d - 2 * s.ro, lw = dp / s.t * sq(fy / 250);
    const av = lw <= 82 ? 1 : Math.pow(82 / lw, 2);
    return { Vw: av * 0.6 * fy * Aw, Aw, av, lw, expr: 'V_w = α_v·0.6·f_y·A_w,  A_w = 2(d − 2t)t' };
  }

  // ------------------------------------------------------------------ bolts (AS 1275) & welds
  const BOLTS = { M16: [157, 144], M20: [245, 225], M24: [353, 324], M30: [561, 519], M36: [817, 759], M42: [1120, 1050], M48: [1470, 1380], M56: [2030, 1910], M64: [2680, 2520] };
  const BGRADE = { '4.6': 400, '8.8': 830 };
  const FUW = 490; // E49XX
  const weldCap = s => 0.8 * 0.6 * FUW * (s / Math.SQRT2); // φv_w, N/mm (SP, k_r = 1)

  // bolt pattern around a tube: circle (CHS) or rectangle (SHS/RHS); coordinates (u, v) about the tube axis
  function boltPattern(sec, n, a) {
    const pts = [];
    if (sec.shape === 'CHS') {
      const R = sec.D / 2 + a;
      for (let i = 0; i < n; i++) { const th = PI / n + 2 * PI * i / n; pts.push({ u: R * Math.cos(th), v: R * Math.sin(th) }); }
      return { pts, pitch: 2 * PI * R / n, R, shape: 'circle' };
    }
    const hu = sec.B / 2 + a, hv = sec.D / 2 + a, k = Math.max(2, Math.round(n / 4) + 1);
    const corners = [[-hu, -hv], [hu, -hv], [hu, hv], [-hu, hv]];
    for (let c = 0; c < 4; c++) {
      const [x0, y0] = corners[c], [x1, y1] = corners[(c + 1) % 4];
      for (let j = 0; j < k - 1; j++) pts.push({ u: x0 + (x1 - x0) * j / (k - 1), v: y0 + (y1 - y0) * j / (k - 1) });
    }
    const pitch = Math.min(2 * hu, 2 * hv) / (k - 1);
    return { pts, pitch, hu, hv, shape: 'rect' };
  }
  // elastic bolt group (rigid plate, double-nut / no grout contact): tension from N (compression +), Mu about v-axis?  see usage
  function boltGroup(pts, N, Mu, Mv, V, T) {
    // Mu: moment producing tension proportional to +u; Mv: proportional to +v
    const n = pts.length, Su = pts.reduce((s, p) => s + p.u * p.u, 0), Sv = pts.reduce((s, p) => s + p.v * p.v, 0), Sr = Su + Sv;
    let mom = 0, Vmax = 0;
    pts.forEach(p => {
      const t = (Su > 0 ? Math.abs(Mu) * Math.abs(p.u) / Su : 0) + (Sv > 0 ? Math.abs(Mv) * Math.abs(p.v) / Sv : 0);
      const r = Math.hypot(p.u, p.v), vv = Math.abs(V) / n + (Sr > 0 ? Math.abs(T) * r / Sr : 0);
      if (t > mom) mom = t; if (vv > Vmax) Vmax = vv;
    });
    return { Tmax: Math.max(0, mom - N / n), Cmax: mom + Math.max(0, N) / n, Vmax, Su, Sv, n };
  }
  // weld line around tube outline (per unit length)
  function weldGroup(sec, N, Mx, My, Vx, Vy, T) {
    if (sec.shape === 'CHS') {
      const r = sec.D / 2, Lw = 2 * PI * r, Zw = PI * r * r, M = Math.hypot(Mx, My), V = Math.hypot(Vx, Vy);
      const vn = Math.abs(N) / Lw + M / Zw, vs = V / (PI * r) + Math.abs(T) / (2 * PI * r * r);
      return { v: Math.hypot(vn, vs), vn, vs, Lw, expr: 'Z_w = π·r²,  v_V = V/(π·r),  v_T = T/(2π·r²)' };
    }
    const d = sec.D, b = sec.B, Lw = 2 * (b + d), Zx = b * d + d * d / 3, Zy = d * b + b * b / 3, Jw = Math.pow(b + d, 3) / 6;
    const vn = Math.abs(N) / Lw + Math.abs(Mx) / Zx + Math.abs(My) / Zy;
    const vs = Math.abs(Vx) / (2 * d) + Math.abs(Vy) / (2 * b) + Math.abs(T) * Math.hypot(b, d) / 2 / Jw;
    return { v: Math.hypot(vn, vs), vn, vs, Lw, expr: 'Z_wx = bd + d²/3,  J_w = (b + d)³/6' };
  }
  const fatCat = v => (v === 'auto' || v === '' || v == null) ? null : +v;

  // ------------------------------------------------------------------ main
  function designGantry(inp, lang) {
    const R = new Rep(lang), L = (a, b) => R.L(a, b);
    const Mute = { lang, L, sec() { return this; }, eq() { return this; }, txt() { return this; }, chk(l, ed, rd, u, ur) { return ur !== undefined ? ur : (rd > 0 ? Math.abs(ed) / rd : 99); } };
    const g = inp.geo, w = inp.wind, cn = inp.conn, bp = inp.base, ft = inp.fat;
    const col = section(inp.col.shape, inp.col.size, inp.col.grade), arm = section(inp.arm.shape, inp.arm.size, inp.arm.grade);
    const checks = [], warn = [];
    const add = (id, name, Ed, Rd, unit, ur, grp, combo) => checks.push({ id, name: combo ? name + ' · ' + combo : name, Ed, Rd, unit, ur: ur !== undefined ? ur : (Rd > 0 ? Math.abs(Ed) / Rd : 99), grp });

    // geometry (mm)
    const H = g.H, Lr0 = g.L, xs = g.xs, Bs = g.Bs, Hs = g.Hs, ez = g.ez, ey = g.ey;
    const x0 = col.shape === 'RHS' ? col.B / 2 : col.D / 2;             // column face (arm root) from column centreline
    const colFront = col.shape === 'RHS' ? col.B : col.D;               // column width facing the wind (x-dimension)
    const zs = H + ez, xsw = xs + (g.eb || 0) * Bs, As = Bs * Hs / 1e6; // sign area m²
    const armFront = arm.D, armPlan = arm.shape === 'CHS' ? arm.D : arm.B;
    if (xs + Bs / 2 > Lr0 + 1) warn.push(L('The sign extends beyond the arm tip.', 'ป้ายยื่นเกินปลายคาน'));
    if (xs - Bs / 2 < x0) warn.push(L('The sign overlaps the column.', 'ป้ายทับเสา'));

    // ---------- 1. materials & sections
    R.sec(L('Sections and materials', 'หน้าตัดและวัสดุ'), 'AS/NZS 1163, AS 4100 §2');
    [[L('Column', 'เสา'), col], [L('Cantilever arm', 'คานยื่น'), arm]].forEach(([nm, s]) => {
      R.eq(nm, s.label + ' · ' + s.grade + ' (f_y = ' + s.fy + ', f_u = ' + s.fu + ' MPa)', f(s.mass, 1), 'kg/m');
      R.eq('A, I_x, I_y', s.shape === 'CHS' ? 'I = π(D⁴ − d⁴)/64' : L('Rounded corners r_ext = ', 'รัศมีมุมนอก r_ext = ') + f(s.ro, 1) + ' mm', f(s.A, 0) + ' mm², ' + f(s.Ix / 1e6, 2) + ', ' + f(s.Iy / 1e6, 2) + ' ×10⁶ mm⁴', '');
      R.eq('Z_x, S_x, J, C', s.shape === 'CHS' ? 'C = 2J/D' : 'J = t³p_h/3 + 4A_h²t/p_h,  C = J/(t + 2A_h/p_h)', f(s.Zx / 1e3, 1) + ', ' + f(s.Sx / 1e3, 1) + ' ×10³ mm³, ' + f(s.J / 1e6, 2) + ' ×10⁶ mm⁴, ' + f(s.C / 1e3, 1) + ' ×10³ mm³', '');
    });
    R.eq(L('Structural steel (plates)', 'เหล็กแผ่น'), 'AS/NZS 3678, f_y', bp.fyp, 'MPa');
    R.eq(L('Welds', 'รอยเชื่อม'), 'E49XX, f_uw = 490 MPa, SP: φ = 0.8', '', '', 'AS 4100 §9.7');

    // ---------- 2. loads
    R.sec(L('Geometry and loads', 'รูปทรงและน้ำหนักบรรทุก'), 'AS/NZS 1170.0, AS/NZS 1170.2');
    R.eq(L('Column height to arm centreline', 'ความสูงเสาถึงแนวแกนคาน'), 'H', H / 1000, 'm');
    R.eq(L('Arm length from column centreline', 'ความยาวคานจากแนวแกนเสา'), 'L', Lr0 / 1000, 'm');
    R.eq(L('Sign panel', 'แผ่นป้าย'), 'B_s × H_s = ' + f(Bs / 1000, 2) + ' × ' + f(Hs / 1000, 2) + ' m', As, 'm²');
    R.eq(L('Sign centre', 'จุดศูนย์กลางป้าย'), 'x_s = ' + f(xs / 1000, 2) + ' m, z_s = H + e_z = ' + f(zs / 1000, 2) + ' m, e_y = ' + f(ey, 0) + ' mm', '', '');
    const wArm = arm.mass * 9.81 / 1e3, wCol = col.mass * 9.81 / 1e3;   // N/mm (= kN/m)
    const Ws = g.gs * As * 1e3 + g.Gadd * 1e3;                         // N
    R.eq(L('Arm self-weight', 'น้ำหนักคาน'), 'w_G,arm = m·g', wArm, 'kN/m');
    R.eq(L('Column self-weight', 'น้ำหนักเสา'), 'w_G,col = m·g', wCol, 'kN/m');
    R.eq(L('Sign and attachments', 'น้ำหนักป้ายและอุปกรณ์'), 'W_s = g_s·A_s + G_add = ' + f(g.gs, 2) + ' × ' + f(As, 2) + ' + ' + f(g.Gadd, 2), Ws / 1e3, 'kN');
    const qOf = V => 0.6 * V * V / 1000; // kPa, ρ_air = 1.2 kg/m³
    const qu = w.mode === 'V' ? qOf(w.Vu) : w.qu, qs = w.mode === 'V' ? qOf(w.Vs) : w.qs;
    if (w.mode === 'V') {
      R.eq(L('ULS design wind speed', 'ความเร็วลมออกแบบ ULS'), 'V_des,θ (ULS)', w.Vu, 'm/s');
      R.eq(L('ULS dynamic pressure', 'แรงดันลมพลวัต ULS'), 'q_u = 0.5·ρ_air·V² = 0.6·V²', qu, 'kPa', '§2.4');
      R.eq(L('SLS dynamic pressure', 'แรงดันลมพลวัต SLS'), 'q_s = 0.6·V_s²,  V_s = ' + f(w.Vs, 1) + ' m/s', qs, 'kPa');
    } else {
      R.eq(L('ULS design wind pressure (input)', 'แรงดันลมออกแบบ ULS (กำหนด)'), 'q_u = 0.5·ρ_air·V²_des', qu, 'kPa');
      R.eq(L('SLS design wind pressure (input)', 'แรงดันลมออกแบบ SLS (กำหนด)'), 'q_s', qs, 'kPa');
    }
    R.eq(L('Sign aerodynamic shape factor', 'สัมประสิทธิ์รูปทรงป้าย'), 'C_fig (free-standing hoarding, App. B/D)', w.Cfig, '');
    R.eq(L('Member drag factors', 'สัมประสิทธิ์แรงลากชิ้นส่วน'), 'C_d,col = ' + f(w.Cdc, 2) + ', C_d,arm = ' + f(w.Cda, 2) + ', C_dyn = ' + f(w.Cdyn, 2), '', '', 'App. C');
    const Fs1 = w.Cfig * w.Cdyn * As * 1e3, wa1 = w.Cda * w.Cdyn * armFront / 1e3, wc1 = w.Cdc * w.Cdyn * colFront / 1e3; // per kPa → N, N/mm
    R.eq(L('ULS wind on sign', 'แรงลมบนป้าย ULS'), 'F_s = q_u·C_fig·C_dyn·A_s', Fs1 * qu / 1e3, 'kN');
    R.eq(L('ULS wind on arm / column', 'แรงลมบนคาน / เสา ULS'), 'w = q_u·C_d·C_dyn·b', f(wa1 * qu, 3) + ' / ' + f(wc1 * qu, 3), 'kN/m');
    if (g.eb) R.eq(L('Resultant eccentricity on sign', 'ระยะเยื้องศูนย์ของแรงลมบนป้าย'), 'e = ' + f(g.eb, 2) + '·B_s (oblique wind)', g.eb * Bs, 'mm', 'App. B');

    // actions for a combination (γG, γW, q)
    function actions(gG, gW, q, lever0) {
      const Fs = Fs1 * q * gW, wa = wa1 * q * gW, wc = wc1 * q * gW, Wg = Ws * gG, wag = wArm * gG, wcg = wCol * gG;
      const N = wcg * H + wag * Lr0 + Wg;
      const Mip = wag * Lr0 * Lr0 / 2 + Wg * xs;
      const Mop = Fs * zs + wa * Lr0 * H + wc * H * H / 2 + Wg * Math.abs(ey);
      const Vy = Fs + wa * Lr0 + wc * H;
      const T = Fs * xsw + wa * Lr0 * Lr0 / 2;
      const at = x => { const Lr = Lr0 - x; return { Mv: wag * Lr * Lr / 2 + Wg * Math.max(0, xs - x), Vv: wag * Lr + Wg, Mh: Fs * Math.max(0, xsw - x) + wa * Lr * Lr / 2, Vh: Fs + wa * Lr, T: Fs * Math.abs(ez) + Wg * Math.abs(ey) }; };
      return { base: { N, Mip, Mop, V: Vy, T }, root: at(x0), flange: at(x0 + (cn.type === 'bolt' ? cn.Lst : 0)) };
    }
    const COMBOS = [['1.35G', 1.35, 0], ['1.2G + W_u', 1.2, 1], ['0.9G + W_u', 0.9, 1]];
    const acts = COMBOS.map(([nm, gG, gW]) => ({ nm, a: actions(gG, gW, qu) }));
    R.sec(L('Design actions (ULS)', 'แรงออกแบบ (ULS)'), 'AS/NZS 1170.0 §4.2.2');
    R.txt(L('Wind normal to the sign face (either direction). Gravity and wind effects are added in the most adverse sense.', 'ลมตั้งฉากกับหน้าป้าย (ทั้งสองทิศ) รวมผลของน้ำหนักและลมในทิศที่วิกฤต'));
    acts.forEach(c => {
      const b = c.a.base, r = c.a.root;
      R.eq(c.nm + ' — ' + L('column base', 'โคนเสา'), 'N*, M*_ip, M*_op, V*, T*', f(b.N / 1e3, 1) + ' kN, ' + f(b.Mip / 1e6, 1) + ', ' + f(b.Mop / 1e6, 1) + ' kNm, ' + f(b.V / 1e3, 1) + ' kN, ' + f(b.T / 1e6, 1) + ' kNm', '');
      R.eq(c.nm + ' — ' + L('arm root', 'โคนคาน'), 'M*_v, V*_v, M*_h, V*_h, T*', f(r.Mv / 1e6, 1) + ', ' + f(r.Vv / 1e3, 1) + ' kN, ' + f(r.Mh / 1e6, 1) + ', ' + f(r.Vh / 1e3, 1) + ' kN, ' + f(r.T / 1e6, 2) + ' kNm', '');
    });

    // ---------- member checks
    function member(Rx, s, a, o) {
      const out = [], put = (id, name, Ed, Rd, unit, ur) => out.push({ id, name, Ed, Rd, unit, ur: ur !== undefined ? ur : (Rd > 0 ? Math.abs(Ed) / Rd : 99) });
      const phi = 0.9, fy = s.fy, bx = bend(s, 'x'), by = bend(s, 'y');
      const Msx = phi * fy * bx.Ze, Msy = phi * fy * by.Ze;
      Rx.eq(L('Section slenderness (bending)', 'ความชะลูดหน้าตัด (ดัด)'), bx.el === 'CHS' ? 'λ_s = (d_o/t)(f_y/250)' : 'λ_e = (b/t)√(f_y/250), ' + L('critical element: ', 'ชิ้นวิกฤต: ') + bx.el, f(bx.lam, 1) + ' (λ_sp = ' + bx.lamp + ', λ_sy = ' + bx.lamy + ') → ' + bx.cls, '', 'Table 5.2');
      Rx.eq('φM_sx', 'φ·f_y·Z_ex,  Z_ex = ' + f(bx.Ze / 1e3, 1) + ' ×10³ mm³', Msx / 1e6, 'kNm', '§5.2');
      if (s.shape !== 'CHS') Rx.eq('φM_sy', 'φ·f_y·Z_ey,  Z_ey = ' + f(by.Ze / 1e3, 1) + ' ×10³ mm³ (' + by.cls + ')', Msy / 1e6, 'kNm');
      let Mbx = Msx;
      if (s.shape === 'RHS' && o.leb) {
        const Mo = sq((PI * PI * E * s.Iy / (o.leb * o.leb)) * (GM * s.J)), as = Math.min(1, 0.6 * (sq(Math.pow(Msx / phi / Mo, 2) + 3) - Msx / phi / Mo));
        Mbx = Math.min(Msx, as * Msx);
        Rx.eq('φM_bx', 'α_m·α_s·φM_sx,  M_o = √(π²EI_y/l_e²·GJ), l_e = ' + f(o.leb / 1000, 2) + ' m, α_s = ' + f(as, 3), Mbx / 1e6, 'kNm', '§5.6');
      } else Rx.txt(L('Closed square / circular section: lateral-torsional buckling does not govern (φM_b = φM_s).', 'หน้าตัดปิดสี่เหลี่ยมจัตุรัส/วงกลม: ไม่เกิดการโก่งเดาะทางข้างด้วยการบิด (φM_b = φM_s)'));
      const vx = shear(s, 'x'), vy = shear(s, 'y'), Vvx = phi * vx.Vw, Vvy = phi * vy.Vw, Tu = phi * 0.6 * fy * s.C;
      Rx.eq('φV_v', vx.expr + (s.shape === 'CHS' ? '' : ', α_v = ' + f(vx.av, 3)), s.shape === 'CHS' ? Vvx / 1e3 : f(Vvx / 1e3, 1) + ' / ' + f(Vvy / 1e3, 1), 'kN', '§5.11');
      Rx.eq('φT_u', 'φ·0.6·f_y·C', Tu / 1e6, 'kNm', 'ASI / ATM DCT');
      const circ = s.shape === 'CHS';
      const M = circ ? Math.hypot(a.Mx, a.My) : 0, V = circ ? Math.hypot(a.Vx, a.Vy) : 0;
      // shear (with moment interaction §5.12.3)
      const vr = circ ? V / Vvx : Math.max(Math.abs(a.Vx) / Vvx, Math.abs(a.Vy) / Vvy);
      put('V', L('Shear', 'แรงเฉือน'), circ ? V / 1e3 : Math.max(Math.abs(a.Vx), Math.abs(a.Vy)) / 1e3, (circ ? Vvx : Vvx) / 1e3, 'kN', Rx.chk(L('Shear', 'แรงเฉือน'), circ ? V / 1e3 : Math.abs(a.Vx) / 1e3, Vvx / 1e3, 'kN', vr));
      put('T', L('Torsion', 'แรงบิด'), Math.abs(a.T) / 1e6, Tu / 1e6, 'kNm', Rx.chk(L('Torsion', 'แรงบิด'), Math.abs(a.T) / 1e6, Tu / 1e6, 'kNm'));
      const vt = vr + Math.abs(a.T) / Tu;
      Rx.eq(L('Shear + torsion', 'แรงเฉือน + แรงบิด'), 'V*/φV_v + T*/φT_u ≤ 1', vt, '');
      put('VT', L('Shear + torsion', 'แรงเฉือน + แรงบิด'), vt, 1, '', Rx.chk(L('Shear + torsion', 'แรงเฉือน + แรงบิด'), vt, 1, '', vt));
      let mr;
      if (a.N > 0) {
        const c = compression(s, o.le);
        const Nsd = phi * c.Ns, Ncd = phi * c.Nc;
        Rx.eq('k_f', L('form factor (effective area)', 'ตัวคูณรูปทรง (พื้นที่ประสิทธิผล)'), c.kf, '', '§6.2');
        Rx.eq('φN_s', 'φ·k_f·A_n·f_y', Nsd / 1e3, 'kN');
        Rx.eq('φN_c', 'φ·α_c·N_s,  l_e = k_e·H = ' + f(o.le / 1000, 2) + ' m, λ_n = ' + f(c.lamn, 1) + ', α_b = −0.5, α_c = ' + f(c.ac, 3), Ncd / 1e3, 'kN', '§6.3');
        const red = Math.max(1e-6, 1 - a.N / Ncd);
        if (circ) {
          const sec = a.N / Nsd + M / Msx, mem = M / (Msx * red);
          Rx.eq('M*', '√(M*_x² + M*_y²)', M / 1e6, 'kNm');
          put('NMs', L('Axial + bending (section)', 'แรงอัด + ดัด (หน้าตัด)'), sec, 1, '', Rx.chk(L('Section: N*/φN_s + M*/φM_s', 'หน้าตัด: N*/φN_s + M*/φM_s'), sec, 1, '', sec));
          mr = mem;
          put('NMm', L('Axial + bending (member)', 'แรงอัด + ดัด (ชิ้นส่วน)'), M / 1e6, Msx * red / 1e6, 'kNm', Rx.chk(L('Member: M* ≤ φM_i = φM_s(1 − N*/φN_c)', 'ชิ้นส่วน: M* ≤ φM_s(1 − N*/φN_c)'), M / 1e6, Msx * red / 1e6, 'kNm'));
        } else {
          const sec = a.N / Nsd + Math.abs(a.Mx) / Msx + Math.abs(a.My) / Msy;
          const Mix = Msx * red, Miy = Msy * red, Mcx = Math.min(Mix, Mbx * red);
          const mem = Math.pow(Math.abs(a.Mx) / Mcx, 1.4) + Math.pow(Math.abs(a.My) / Miy, 1.4);
          put('NMs', L('Axial + biaxial bending (section)', 'แรงอัด + ดัดสองแกน (หน้าตัด)'), sec, 1, '', Rx.chk('N*/φN_s + M*_x/φM_sx + M*_y/φM_sy ≤ 1', sec, 1, '', sec));
          put('NMm', L('Axial + biaxial bending (member)', 'แรงอัด + ดัดสองแกน (ชิ้นส่วน)'), mem, 1, '', Rx.chk('(M*_x/φM_cx)^1.4 + (M*_y/φM_iy)^1.4 ≤ 1', mem, 1, '', mem));
          mr = mem;
        }
      } else if (circ) {
        Rx.eq('M*', '√(M*_x² + M*_y²)', M / 1e6, 'kNm');
        put('M', L('Bending (resultant)', 'ดัด (ผลลัพธ์)'), M / 1e6, Msx / 1e6, 'kNm', Rx.chk(L('Bending', 'การดัด'), M / 1e6, Msx / 1e6, 'kNm'));
      } else {
        const bi = Math.abs(a.Mx) / Mbx + Math.abs(a.My) / Msy;
        Rx.eq(L('Biaxial bending', 'ดัดสองแกน'), 'M*_x/φM_bx + M*_y/φM_sy', bi, '', '§8.3.4');
        put('M', L('Biaxial bending', 'ดัดสองแกน'), bi, 1, '', Rx.chk(L('Biaxial bending', 'ดัดสองแกน'), bi, 1, '', bi));
      }
      // combined stress (bending + axial + shear + torsion)
      const sig = (a.N > 0 ? a.N / s.A : 0) + (circ ? M / bx.Ze : Math.abs(a.Mx) / bx.Ze + Math.abs(a.My) / by.Ze);
      const tau = Math.abs(a.T) / s.C + (circ ? 2 * V / s.A : Math.max(Math.abs(a.Vx) / vx.Aw, Math.abs(a.Vy) / vy.Aw));
      const cs = sq(Math.pow(sig / (phi * fy), 2) + Math.pow(tau / (phi * 0.6 * fy), 2));
      Rx.eq(L('Combined stress', 'หน่วยแรงรวม'), 'σ* = ' + f(sig, 1) + ' MPa, τ* = T*/C + V*/A_w = ' + f(tau, 1) + ' MPa', '', '');
      put('CS', L('Combined stress σ–τ', 'หน่วยแรงรวม σ–τ'), cs, 1, '', Rx.chk('(σ*/φf_y)² + (τ*/0.6φf_y)² ≤ 1', cs, 1, '', cs));
      return out;
    }
    function governing(title, clause, grp, fn) {
      // every combination is evaluated; each check keeps its own governing combination
      const runs = acts.map(c => ({ c, out: fn(Mute, c) }));
      const ids = runs[0].out.map(x => x.id);
      const urOf = (r, id) => { const x = r.out.find(y => y.id === id); return x ? x.ur : 0; };
      const varies = id => { const v = runs.map(r => urOf(r, id)); return Math.max(...v) - Math.min(...v) > 1e-9; };
      let shown = runs[0], top = -1;
      runs.forEach(r => { const m = Math.max(0, ...r.out.filter(x => varies(x.id)).map(x => x.ur)); if (m > top) { top = m; shown = r; } });
      R.sec(title + ' — ' + shown.c.nm, clause);
      fn(R, shown.c);
      let other = false;
      ids.forEach(id => {
        let b = null;
        runs.forEach(r => { const x = r.out.find(y => y.id === id); if (x && (!b || x.ur > b.x.ur)) b = { x, c: r.c }; });
        if (b.c !== shown.c && varies(id)) other = true;
        add(grp + id, b.x.name, b.x.Ed, b.x.Rd, b.x.unit, b.x.ur, grp, varies(id) ? b.c.nm : null);
      });
      if (other) R.txt(L('Some checks in this group are governed by another combination; the summary table lists the governing combination for each check.', 'บางรายการในกลุ่มนี้วิกฤตในกรณีรวมแรงอื่น ดูกรณีวิกฤตของแต่ละรายการในตารางสรุป'));
      return shown.c;
    }
    const armAct = c => ({ N: 0, Mx: c.a.root.Mv, My: c.a.root.Mh, Vx: c.a.root.Vv, Vy: c.a.root.Vh, T: c.a.root.T });
    governing(L('Cantilever arm at column face', 'คานยื่นที่ผิวเสา'), 'AS 4100 §5, §8', 'arm', (Rx, c) => {
      const a = armAct(c);
      Rx.eq(L('Design actions', 'แรงออกแบบ'), 'M*_v, M*_h, V*_v, V*_h, T*', f(a.Mx / 1e6, 1) + ', ' + f(a.My / 1e6, 1) + ' kNm, ' + f(a.Vx / 1e3, 1) + ', ' + f(a.Vy / 1e3, 1) + ' kN, ' + f(a.T / 1e6, 2) + ' kNm', '');
      return member(Rx, arm, a, { leb: 2 * (Lr0 - x0) }).map(x => Object.assign(x, { name: L('Arm: ', 'คาน: ') + x.name }));
    });
    // column: second-order amplification (sway cantilever)
    const ke = g.ke || 2.2, leC = ke * H;
    const colAct = (c, Rx) => {
      const b = c.a.base, Nomx = PI * PI * E * col.Ix / (leC * leC), Nomy = PI * PI * E * col.Iy / (leC * leC);
      const dx = 1 / Math.max(1e-6, 1 - b.N / Nomx), dy = 1 / Math.max(1e-6, 1 - b.N / Nomy);
      if (Rx) Rx.eq(L('Moment amplification (sway)', 'ตัวขยายโมเมนต์ (เซ)'), 'δ_s = 1/(1 − N*/N_om),  N_om = π²EI/(k_e·H)²', f(dx, 3) + ' / ' + f(dy, 3), '', '§4.4.2.3');
      return { N: b.N, Mx: b.Mop * dx, My: b.Mip * dy, Vx: b.V, Vy: 0, T: b.T };
    };
    governing(L('Column at base', 'เสาที่โคน'), 'AS 4100 §4.4, §5, §6, §8', 'col', (Rx, c) => {
      const a = colAct(c, Rx);
      Rx.eq(L('Design actions', 'แรงออกแบบ'), 'N*, M*_op (x), M*_ip (y), V*, T*', f(a.N / 1e3, 1) + ' kN, ' + f(a.Mx / 1e6, 1) + ', ' + f(a.My / 1e6, 1) + ' kNm, ' + f(a.Vx / 1e3, 1) + ' kN, ' + f(a.T / 1e6, 1) + ' kNm', '');
      return member(Rx, col, a, { le: leC, leb: 2 * H }).map(x => Object.assign(x, { name: L('Column: ', 'เสา: ') + x.name }));
    });

    // ---------- arm-to-column joint (welded arm, or welded stub)
    const plateFy = bp.fyp;
    function joint(Rx, rt) {
      const out = [], put = (id, name, Ed, Rd, unit, ur) => out.push({ id, name, Ed, Rd, unit, ur: ur !== undefined ? ur : (Rd > 0 ? Math.abs(Ed) / Rd : 99) });
      const phi = 0.9, fy0 = col.fy, t0 = col.t, Mip = Math.abs(rt.Mv), Mop = Math.abs(rt.Mh);
      if (col.shape === 'CHS' && arm.shape === 'CHS') {
        const d0 = col.D, d1 = arm.D, beta = d1 / d0, gam = d0 / (2 * t0);
        Rx.eq('β, γ', 'β = d₁/d₀, γ = d₀/2t₀', f(beta, 3) + ', ' + f(gam, 1), '', 'EN 1993-1-8 Table 7.2 / 7.5');
        if (beta > 1 || beta < 0.2 || 2 * gam > 50) warn.push(L('Arm-to-column CHS joint is outside the validity range (0.2 ≤ β ≤ 1.0, d₀/t₀ ≤ 50).', 'รอยต่อ CHS คาน-เสาอยู่นอกขอบเขตใช้งาน'));
        let Mipr = 4.85 * fy0 * t0 * t0 * sq(gam) * beta * d1, Mopr = fy0 * t0 * t0 * d1 * 2.7 / (1 - 0.81 * Math.min(beta, 0.99));
        if (d1 <= d0 - 2 * t0) { const p = fy0 * t0 * d1 * d1 / sq(3); Mipr = Math.min(Mipr, p); Mopr = Math.min(Mopr, p); }
        Rx.eq('M_ip,Rd', '4.85·f_y0·t₀²·√γ·β·d₁ (chord face) ≤ punching', Mipr / 1e6, 'kNm');
        Rx.eq('M_op,Rd', 'f_y0·t₀²·d₁·2.7/(1 − 0.81β) ≤ punching', Mopr / 1e6, 'kNm');
        const u = Math.pow(Mip / (phi * Mipr), 2) + Mop / (phi * Mopr);
        put('J', L('Joint: column wall (CHS)', 'รอยต่อ: ผนังเสา (CHS)'), u, 1, '', Rx.chk('(M*_ip/φM_ip)² + M*_op/φM_op ≤ 1', u, 1, '', u));
      } else if (col.shape !== 'CHS') {
        const b0 = col.D, b1 = arm.shape === 'CHS' ? arm.D : arm.B, h1 = arm.D, beta = b1 / b0, eta = h1 / b0, fct = arm.shape === 'CHS' ? PI / 4 : 1;
        Rx.eq('β, η', 'β = b₁/b₀, η = h₁/b₀' + (arm.shape === 'CHS' ? L(' (CHS arm: resistance × π/4)', ' (คาน CHS: กำลัง × π/4)') : ''), f(beta, 3) + ', ' + f(eta, 3), '', 'EN 1993-1-8 Table 7.14 / CIDECT');
        if (b0 / t0 > 35) warn.push(L('Column face b₀/t₀ > 35: outside the RHS joint validity range.', 'ผนังเสา b₀/t₀ > 35 เกินขอบเขตใช้งาน'));
        let Mipr, Mopr;
        if (beta <= 0.85) {
          Mipr = fy0 * t0 * t0 * h1 * (1 / (2 * eta) + 2 / sq(1 - beta) + eta / (1 - beta));
          Mopr = fy0 * t0 * t0 * (h1 * (1 + beta) / (2 * (1 - beta)) + sq(2 * b0 * b1 * (1 + beta) / (1 - beta)));
          Rx.eq('M_ip,Rd', 'f_y0·t₀²·h₁·[1/(2η) + 2/√(1−β) + η/(1−β)] (chord face)', fct * Mipr / 1e6, 'kNm');
          Rx.eq('M_op,Rd', 'f_y0·t₀²·[h₁(1+β)/(2(1−β)) + √(2b₀b₁(1+β)/(1−β))]', fct * Mopr / 1e6, 'kNm');
        } else {
          const beff = Math.min(b1, 10 / (b0 / t0) * (fy0 * t0) / (arm.fy * arm.t) * b1);
          Mipr = Math.min(0.5 * fy0 * t0 * Math.pow(h1 + 5 * t0, 2), arm.fy * (arm.Sx - (1 - beff / b1) * b1 * (h1 - arm.t) * arm.t));
          Mopr = Math.min(fy0 * t0 * (b0 - t0) * (h1 + 5 * t0), arm.fy * (arm.Sy - 0.5 * arm.t * Math.pow(b1 - beff, 2)));
          Rx.eq('M_ip,Rd', 'min(side wall 0.5·f_y0·t₀(h₁ + 5t₀)², brace b_eff = ' + f(beff, 0) + ' mm)', fct * Mipr / 1e6, 'kNm');
          Rx.eq('M_op,Rd', 'min(side wall f_y0·t₀(b₀ − t₀)(h₁ + 5t₀), brace)', fct * Mopr / 1e6, 'kNm');
        }
        const u = Mip / (phi * fct * Mipr) + Mop / (phi * fct * Mopr);
        put('J', L('Joint: column wall (RHS)', 'รอยต่อ: ผนังเสา (RHS)'), u, 1, '', Rx.chk('M*_ip/φM_ip + M*_op/φM_op ≤ 1', u, 1, '', u));
      } else {
        Rx.txt(L('RHS arm into a CHS column is outside the EN 1993-1-8 / CIDECT joint tables — use a stub with end plates on a saddle, or verify the column wall by finite-element analysis.', 'คาน RHS ต่อเข้าเสา CHS อยู่นอกตารางรอยต่อ — ใช้ท่อสั้นพร้อมแผ่นปลายบนแผ่นรองโค้ง หรือตรวจด้วย FE'));
        warn.push(L('Arm-to-column joint not checked (RHS arm into CHS column).', 'ไม่ได้ตรวจรอยต่อคาน-เสา (คาน RHS เข้าเสา CHS)'));
      }
      Rx.txt(L('Torsion of the arm is transferred to the column wall by shear; wall torsion capacity is covered by the weld check below.', 'แรงบิดของคานส่งเข้าผนังเสาด้วยแรงเฉือน ตรวจผ่านรอยเชื่อมด้านล่าง'));
      // weld around arm (or stub) at column face
      if (cn.weld === 'fillet') {
        const wg = weldGroup(arm, 0, rt.Mv, rt.Mh, rt.Vv, rt.Vh, rt.T), cap = weldCap(cn.sa);
        Rx.eq(L('Fillet weld all round', 'รอยเชื่อมพอกรอบท่อ'), wg.expr + ',  v*_n = ' + f(wg.vn, 0) + ', v*_s = ' + f(wg.vs, 0) + ' N/mm', wg.v, 'N/mm');
        Rx.eq('φv_w', '0.8 × 0.6 × 490 × s/√2,  s = ' + cn.sa + ' mm', cap, 'N/mm', '§9.7.3.10');
        put('W', L('Weld arm/stub to column', 'รอยเชื่อมคาน/ท่อสั้นกับเสา'), wg.v, cap, 'N/mm', Rx.chk(L('Weld', 'รอยเชื่อม'), wg.v, cap, 'N/mm'));
      } else Rx.txt(L('Complete-penetration butt weld: design capacity equal to the arm section (AS 4100 §9.7.2.7), covered by the arm checks.', 'รอยเชื่อมทะลุเต็ม: กำลังเท่าหน้าตัดคาน (AS 4100 §9.7.2.7)'));
      return out;
    }
    const flBolts = boltPattern(arm, cn.nf, cn.af);
    // end plates: square or circular, edge distance e_f beyond the outermost bolt
    const ef = Math.max(45, 1.5 * (+String(cn.fb).slice(1) || 24));
    const epCirc = cn.pshape === 'circle';
    const epSize = epCirc ? 2 * (Math.max(...flBolts.pts.map(q => Math.hypot(q.u, q.v))) + ef) : 2 * (Math.max(...flBolts.pts.map(q => Math.max(Math.abs(q.u), Math.abs(q.v)))) + ef);
    flBolts.plate = { shape: epCirc ? 'circle' : 'square', size: epSize, ef };
    governing(cn.type === 'bolt' ? L('Stub-to-column joint', 'รอยต่อท่อสั้น-เสา') : L('Arm-to-column welded joint', 'รอยต่อเชื่อมคาน-เสา'), 'EN 1993-1-8 §7 / CIDECT DG 1, 3; AS 4100 §9.7', 'jnt',
      (Rx, c) => joint(Rx, c.a.root).map(x => Object.assign(x, { name: L('Connection: ', 'รอยต่อ: ') + x.name })));
    if (cn.type === 'bolt') {
      governing(L('Bolted flange (stub / arm end plates)', 'หน้าแปลนยึดสลักเกลียว (แผ่นปลายท่อสั้น / คาน)'), 'AS 4100 §9.3, §9.7', 'fl', (Rx, c) => {
        const out = [], put = (id, name, Ed, Rd, unit, ur) => out.push({ id, name, Ed, Rd, unit, ur: ur !== undefined ? ur : (Rd > 0 ? Math.abs(Ed) / Rd : 99) });
        const fa = c.a.flange, bd = BOLTS[cn.fb], fuf = BGRADE[cn.fg];
        const bg = boltGroup(flBolts.pts, 0, fa.Mh, fa.Mv, Math.hypot(fa.Vv, fa.Vh), fa.T);
        Rx.eq(L('Flange position from column face', 'ตำแหน่งหน้าแปลนจากผิวเสา'), 'L_stub', cn.Lst, 'mm');
        Rx.eq(L(epCirc ? 'End plates (circular)' : 'End plates (square)', epCirc ? 'แผ่นปลาย (วงกลม)' : 'แผ่นปลาย (สี่เหลี่ยม)'), (epCirc ? 'Ø' + f(epSize, 0) : f(epSize, 0) + ' × ' + f(epSize, 0)) + ' × ' + cn.tep + ' mm, e_f = ' + f(ef, 0) + ' mm ' + L('beyond the outermost bolt', 'จากสลักตัวนอกสุด'), '', '');
        Rx.eq(L('Actions at flange', 'แรงที่หน้าแปลน'), 'M*_v, M*_h, V*, T*', f(fa.Mv / 1e6, 1) + ', ' + f(fa.Mh / 1e6, 1) + ' kNm, ' + f(Math.hypot(fa.Vv, fa.Vh) / 1e3, 1) + ' kN, ' + f(fa.T / 1e6, 2) + ' kNm', '');
        Rx.eq(L('Bolt group', 'กลุ่มสลักเกลียว'), cn.nf + ' × ' + cn.fb + ' ' + cn.fg + ', ' + (flBolts.shape === 'circle' ? 'PCD = ' + f(2 * flBolts.R, 0) + ' mm' : L('offset ', 'ระยะ ') + cn.af + ' mm'), '', '');
        Rx.eq('N*_tf', 'M*_v·v_i/Σv² + M*_h·u_i/Σu²  (' + L('rigid plate, elastic', 'แผ่นแข็ง ยืดหยุ่น') + ')', bg.Tmax / 1e3, 'kN');
        Rx.eq('V*_f', 'V*/n + T*·r_i/Σr²', bg.Vmax / 1e3, 'kN');
        const Nt = 0.8 * bd[0] * fuf, Vf = 0.8 * 0.62 * fuf * bd[1];
        Rx.eq('φN_tf', '0.8·A_s·f_uf', Nt / 1e3, 'kN', '§9.3.2.2');
        Rx.eq('φV_f', '0.8·0.62·f_uf·A_c (threads in shear plane)', Vf / 1e3, 'kN', '§9.3.2.1');
        const ui = Math.pow(bg.Vmax / Vf, 2) + Math.pow(bg.Tmax / Nt, 2);
        put('B', L('Flange bolts (tension + shear)', 'สลักหน้าแปลน (ดึง + เฉือน)'), ui, 1, '', Rx.chk('(V*_f/φV_f)² + (N*_tf/φN_tf)² ≤ 1', ui, 1, '', ui));
        const a = cn.af, beff = Math.min(flBolts.pitch, 2 * a), Mp = bg.Tmax * a, Mr = 0.9 * plateFy * beff * cn.tep * cn.tep / 4;
        Rx.eq(L('End plate bending', 'การดัดแผ่นปลาย'), 'M* = N*_tf·a,  a = ' + a + ' mm, b_eff = min(p, 2a) = ' + f(beff, 0) + ' mm', Mp / 1e6, 'kNm');
        Rx.eq('φM_p', '0.9·f_y·b_eff·t_p²/4,  t_p = ' + cn.tep + ' mm', Mr / 1e6, 'kNm');
        put('P', L('End plate bending', 'การดัดแผ่นปลาย'), Mp / 1e6, Mr / 1e6, 'kNm', Rx.chk(L('End plate', 'แผ่นปลาย'), Mp / 1e6, Mr / 1e6, 'kNm'));
        Rx.txt(L('Prying is not included; keep t_p at or above the value for which the plate stays elastic under N*_tf, or add a prying allowance.', 'ไม่รวมแรงงัด ควรใช้แผ่นหนาพอให้อยู่ในช่วงยืดหยุ่น หรือเพิ่มค่าเผื่อแรงงัด'));
        if (cn.weld === 'fillet') {
          const wg = weldGroup(arm, 0, fa.Mv, fa.Mh, fa.Vv, fa.Vh, fa.T), cap = weldCap(cn.sa);
          Rx.eq(L('Arm to end-plate fillet weld', 'รอยเชื่อมพอกคานกับแผ่นปลาย'), wg.expr, wg.v, 'N/mm');
          put('W2', L('Weld arm to end plate', 'รอยเชื่อมคานกับแผ่นปลาย'), wg.v, cap, 'N/mm', Rx.chk(L('Weld', 'รอยเชื่อม'), wg.v, cap, 'N/mm'));
        }
        return out.map(x => Object.assign(x, { name: L('Flange: ', 'หน้าแปลน: ') + x.name }));
      });
    }

    // ---------- base plate, anchor bolts, stiffeners
    const bb = boltPattern(col, bp.nb, bp.ab);
    // stiffeners between bolts, attached to the tube face
    const stiff = [];
    if (bp.stiff) {
      const ns = bp.nb;
      if (bb.shape === 'circle') for (let j = 0; j < ns; j++) { const th = 2 * PI * j / ns, r = col.D / 2; stiff.push({ u: r * Math.cos(th), v: r * Math.sin(th), nu: Math.cos(th), nv: Math.sin(th) }); }
      else bb.pts.forEach((p, i) => {
        const q = bb.pts[(i + 1) % bb.pts.length], mu = (p.u + q.u) / 2, mv = (p.v + q.v) / 2, hu = col.B / 2, hv = col.D / 2;
        if (Math.abs(Math.abs(mv) - bb.hv) < 1e-6) stiff.push({ u: clamp(mu, -hu, hu), v: Math.sign(mv) * hv, nu: 0, nv: Math.sign(mv) });
        else stiff.push({ u: Math.sign(mu) * hu, v: clamp(mv, -hv, hv), nu: Math.sign(mu), nv: 0 });
      });
    }
    const Ls = bp.ab + bp.ep; // stiffener projection
    const circP = bp.shape === 'circle', rMax = Math.max(...bb.pts.map(q => Math.hypot(q.u, q.v)));
    const plateD = 2 * (rMax + bp.ep); // circular plate: edge distance e_p beyond the outermost bolt
    const plateSide = circP ? plateD : 2 * ((bb.shape === 'circle' ? bb.R : Math.max(bb.hu, bb.hv)) + bp.ep);
    const plateTxt = (circP ? 'Ø' + f(plateD, 0) + ' × ' : f(plateSide, 0) + ' × ' + f(plateSide, 0) + ' × ') + bp.tp + ' mm';
    function stiffenedI() {
      let Iu = col.Ix, Iv = col.Iy; // Iu: about global x (stress ∝ v, resists M_op); Iv: about global y (resists M_ip)
      stiff.forEach(s => {
        const a = bp.ts * Ls, cu = s.u + s.nu * Ls / 2, cv = s.v + s.nv * Ls / 2;
        Iu += a * cv * cv + (bp.ts * Math.pow(Ls, 3) / 12) * s.nv * s.nv + (Ls * Math.pow(bp.ts, 3) / 12) * s.nu * s.nu;
        Iv += a * cu * cu + (bp.ts * Math.pow(Ls, 3) / 12) * s.nu * s.nu + (Ls * Math.pow(bp.ts, 3) / 12) * s.nv * s.nv;
      });
      return { Iop: Iu, Iip: Iv };
    }
    const SI = stiffenedI();
    governing(L('Base plate and anchor bolts', 'แผ่นฐานและสลักยึด'), 'AS 4100 §9.3, §9.7', 'bp', (Rx, c) => {
      const out = [], put = (id, name, Ed, Rd, unit, ur) => out.push({ id, name, Ed, Rd, unit, ur: ur !== undefined ? ur : (Rd > 0 ? Math.abs(Ed) / Rd : 99) });
      const b = colAct(c, null), bd = BOLTS[bp.db], fuf = BGRADE[bp.bg];
      // u = global x (in-plane), v = global y (out-of-plane): M_op → tension ∝ v; M_ip → ∝ u
      const grp = boltGroup(bb.pts, b.N, b.My, b.Mx, b.Vx, b.T);
      Rx.eq(L('Anchor bolts', 'สลักยึด'), bp.nb + ' × ' + bp.db + ' ' + L('grade ', 'เกรด ') + bp.bg + ', ' + (bb.shape === 'circle' ? 'PCD = ' + f(2 * bb.R, 0) + ' mm' : L('offset from tube face ', 'ระยะจากผิวท่อ ') + bp.ab + ' mm'), '', '');
      Rx.eq(L(circP ? 'Base plate (circular)' : 'Base plate', circP ? 'แผ่นฐาน (วงกลม)' : 'แผ่นฐาน'), plateTxt + ', f_y = ' + plateFy + ' MPa' + (bp.stiff ? ', ' + stiff.length + L(' stiffeners ', ' แผ่นเสริม ') + bp.ts + ' × ' + bp.hs + ' mm' : ''), '', '');
      Rx.eq('N*_tf', '−N*/n + M*_op·v_i/Σv² + M*_ip·u_i/Σu²  (' + L('double-nut, rigid plate', 'น็อตคู่ แผ่นแข็ง') + ')', grp.Tmax / 1e3, 'kN');
      Rx.eq('V*_f', 'V*/n + T*·r_i/Σr²', grp.Vmax / 1e3, 'kN');
      const Nt = 0.8 * bd[0] * fuf, Vf = 0.8 * 0.62 * fuf * bd[1];
      Rx.eq('φN_tf, φV_f', '0.8·A_s·f_uf,  0.8·0.62·f_uf·A_c', f(Nt / 1e3, 1) + ', ' + f(Vf / 1e3, 1), 'kN', '§9.3.2');
      const ui = Math.pow(grp.Vmax / Vf, 2) + Math.pow(grp.Tmax / Nt, 2);
      put('AB', L('Anchor bolts (tension + shear)', 'สลักยึด (ดึง + เฉือน)'), ui, 1, '', Rx.chk('(V*_f/φV_f)² + (N*_tf/φN_tf)² ≤ 1', ui, 1, '', ui));
      Rx.txt(L('Concrete breakout, pull-out and edge checks for the cast-in anchors to AS 5216 are outside this module.', 'การตรวจการแตกของคอนกรีตและการถอนของสลักฝังตาม AS 5216 อยู่นอกขอบเขต'));
      const Tb = Math.max(grp.Tmax, grp.Cmax), a = bp.ab;
      Rx.eq(L('Max. bolt compression (levelling nuts)', 'แรงอัดสูงสุดในสลัก (น็อตปรับระดับ)'), 'N*/n + M*·r/Σr²', grp.Cmax / 1e3, 'kN');
      let Mp, beff, expr;
      if (bp.stiff) {
        const s = bb.shape === 'circle' ? 2 * PI * bb.R / stiff.length : bb.pitch; beff = Math.min(s, 2 * a); Mp = Tb * s / 8; expr = 'M* = N*_tf·s/8 (' + L('strip fixed at stiffeners', 'แถบยึดแน่นที่แผ่นเสริม') + '), s = ' + f(s, 0) + ' mm, b_eff = ' + f(beff, 0) + ' mm';
      } else { beff = Math.min(bb.pitch, 2 * a); Mp = Tb * a; expr = 'M* = N*_tf·a,  a = ' + a + ' mm, b_eff = min(p, 2a) = ' + f(beff, 0) + ' mm'; }
      const Mr = 0.9 * plateFy * beff * bp.tp * bp.tp / 4;
      Rx.eq(L('Base plate bending', 'การดัดแผ่นฐาน'), expr, Mp / 1e6, 'kNm');
      Rx.eq('φM_p', '0.9·f_y·b_eff·t_p²/4', Mr / 1e6, 'kNm');
      put('BP', L('Base plate bending', 'การดัดแผ่นฐาน'), Mp / 1e6, Mr / 1e6, 'kNm', Rx.chk(L('Base plate', 'แผ่นฐาน'), Mp / 1e6, Mr / 1e6, 'kNm'));
      if (bp.stiff) {
        const Fst = Tb, e = a, lam = (Ls / bp.ts) * sq(plateFy / 250);
        Rx.eq(L('Stiffener force', 'แรงในแผ่นเสริม'), 'F_st = max(N*_tf, N*_c) (' + L('half of two adjacent bolts', 'ครึ่งหนึ่งของสลักข้างเคียงสองตัว') + '), e = a', Fst / 1e3, 'kN');
        put('SL', L('Stiffener outstand slenderness', 'ความชะลูดแผ่นเสริม'), lam, 16, '', Rx.chk('λ_e = (L_s/t_s)√(f_y/250) ≤ 16', lam, 16, ''));
        const sb = Fst * e / (bp.ts * bp.hs * bp.hs / 6);
        put('SB', L('Stiffener bending', 'การดัดแผ่นเสริม'), sb, 0.9 * plateFy, 'MPa', Rx.chk('σ* = F_st·e/(t_s·h_s²/6)', sb, 0.9 * plateFy, 'MPa'));
        const vv = Fst / (2 * bp.hs), vm = Fst * e / (2 * bp.hs * bp.hs / 6), vw = Math.hypot(vv, vm), capS = weldCap(bp.sst);
        put('SW', L('Stiffener-to-tube welds', 'รอยเชื่อมแผ่นเสริมกับท่อ'), vw, capS, 'N/mm', Rx.chk(L('Stiffener welds (2 × fillet ', 'รอยเชื่อมแผ่นเสริม (2 × พอก ') + bp.sst + ' mm)', vw, capS, 'N/mm'));
      }
      if (bp.weld === 'fillet') {
        const wg = weldGroup(col, b.N, b.Mx, b.My, b.Vx, 0, b.T), cap = weldCap(bp.sb);
        Rx.eq(L('Column-to-base fillet weld', 'รอยเชื่อมพอกเสากับแผ่นฐาน'), wg.expr, wg.v, 'N/mm');
        Rx.eq('φv_w', '0.8·0.6·490·s/√2, s = ' + bp.sb + ' mm', cap, 'N/mm');
        put('BW', L('Column-to-base weld', 'รอยเชื่อมเสากับแผ่นฐาน'), wg.v, cap, 'N/mm', Rx.chk(L('Weld', 'รอยเชื่อม'), wg.v, cap, 'N/mm'));
      } else Rx.txt(L('Complete-penetration butt weld to the base plate: capacity equal to the column section.', 'รอยเชื่อมทะลุเต็มกับแผ่นฐาน: กำลังเท่าหน้าตัดเสา'));
      return out.map(x => Object.assign(x, { name: L('Base: ', 'ฐาน: ') + x.name }));
    });

    // ---------- serviceability
    R.sec(L('Serviceability', 'สภาวะใช้งาน'), 'AS/NZS 1170.0 App. C');
    const Fss = Fs1 * qs, was = wa1 * qs, wcs = wc1 * qs, Tcs = Fss * xsw + was * Lr0 * Lr0 / 2;
    const Pt = Fss + was * Lr0, Mt = Fss * (zs - H);
    const dTop = Pt * Math.pow(H, 3) / (3 * E * col.Ix) + Mt * H * H / (2 * E * col.Ix) + wcs * Math.pow(H, 4) / (8 * E * col.Ix);
    const twist = Tcs * H / (GM * col.J);
    const dArm = Fss * xsw * xsw * (3 * Lr0 - xsw) / (6 * E * arm.Iy) + was * Math.pow(Lr0, 4) / (8 * E * arm.Iy);
    const dH = dTop + twist * Lr0 + dArm, limH = Lr0 / (inp.sls.limH || 100);
    R.eq(L('Column sway at arm level', 'การเซของเสาที่ระดับคาน'), 'P·H³/3EI + M·H²/2EI + w·H⁴/8EI', dTop, 'mm');
    R.eq(L('Column twist × arm length', 'การบิดของเสา × ความยาวคาน'), 'T_s·H/(GJ)·L', twist * Lr0, 'mm');
    R.eq(L('Arm horizontal bending', 'การดัดแนวนอนของคาน'), 'F·a²(3L − a)/6EI + w·L⁴/8EI', dArm, 'mm');
    put2('DH', L('Tip deflection, SLS wind (horizontal)', 'การโก่งปลายคาน ลม SLS (แนวนอน)'), dH, limH, 'mm', R.chk('δ_h ≤ L/' + (inp.sls.limH || 100), dH, limH, 'mm'));
    const MgCol = wArm * Lr0 * Lr0 / 2 + Ws * xs;
    const dV = wArm * Math.pow(Lr0, 4) / (8 * E * arm.Ix) + Ws * xs * xs * (3 * Lr0 - xs) / (6 * E * arm.Ix) + MgCol * H / (E * col.Iy) * Lr0, limV = Lr0 / (inp.sls.limV || 150);
    R.eq(L('Vertical tip deflection under G', 'การโก่งแนวดิ่งปลายคานจาก G'), 'arm bending + column rotation × L', dV, 'mm');
    put2('DV', L('Tip deflection, permanent (vertical)', 'การโก่งปลายคาน น้ำหนักคงที่ (แนวดิ่ง)'), dV, limV, 'mm', R.chk('δ_v ≤ L/' + (inp.sls.limV || 150), dV, limV, 'mm'));
    R.txt(L('Pre-camber the arm by the dead-load deflection where the road authority requires a level arm.', 'ควรยกโค้งคานล่วงหน้าเท่าการโก่งจากน้ำหนักคงที่ หากหน่วยงานกำหนด'));
    function put2(id, name, Ed, Rd, unit, ur) { add('sls' + id, name, Ed, Rd, unit, ur, 'sls'); }
    // natural frequencies (generalised SDOF)
    const m = Ws / 9.81 * 1e-3 + 0.25 * arm.mass * Lr0 / 1e3 * 1e-3 + 0.24 * col.mass * H / 1e3 * 1e-3; // tonnes → N·s²/mm
    const flexY = Math.pow(H, 3) / (3 * E * col.Ix) + xs * xs * H / (GM * col.J) + Math.pow(xs, 3) / (3 * E * arm.Iy);
    const flexZ = Math.pow(xs, 3) / (3 * E * arm.Ix) + xs * xs * H / (E * col.Iy);
    const fy1 = 1 / (2 * PI) * sq(1 / (flexY * m)), fz1 = 1 / (2 * PI) * sq(1 / (flexZ * m));
    R.eq(L('First natural frequency (horizontal)', 'ความถี่ธรรมชาติแรก (แนวนอน)'), 'f = (1/2π)·√(k/m_eff),  m_eff = m_sign + 0.25m_arm + 0.24m_col', fy1, 'Hz');
    R.eq(L('First natural frequency (vertical)', 'ความถี่ธรรมชาติแรก (แนวดิ่ง)'), 'f = (1/2π)·√(k_z/m_eff)', fz1, 'Hz');
    if (fy1 < 1) warn.push(L('Horizontal natural frequency below 1 Hz: dynamic response to AS/NZS 1170.2 §6 applies — set C_dyn accordingly.', 'ความถี่ธรรมชาติแนวนอนต่ำกว่า 1 Hz: ต้องพิจารณาผลพลวัตตาม AS/NZS 1170.2 §6'));

    // ---------- fatigue
    const fat = { rows: [], cases: [], caseObjs: [], caps: {} };
    if (ft.on) {
      R.sec(L('Fatigue loads (equivalent static, infinite life)', 'น้ำหนักล้า (สถิตเทียบเท่า อายุไม่จำกัด)'), 'AASHTO LTS §11 · AS 4100 §11');
      const IF = ft.IF;
      R.eq(L('Fatigue importance factor', 'ตัวคูณความสำคัญด้านความล้า'), 'I_F', IF, '');
      const PNW = ft.PNW * Math.pow(ft.Vm / 5.0, 2) * IF;
      R.eq(L('Natural wind gust pressure', 'แรงดันลมกระโชกธรรมชาติ'), 'P_NW = ' + ft.PNW + '·(V_mean/5.0)²·I_F,  V_mean = ' + f(ft.Vm, 1) + ' m/s', PNW, 'Pa');
      const cases = [];
      cases.push({ id: 'NW', nm: L('Natural wind gust', 'ลมกระโชกธรรมชาติ'), Fs: PNW * w.Cfig * As, wa: PNW * 1e-6 * w.Cda * armFront, wc: PNW * 1e-6 * w.Cdc * colFront, Fz: 0, xz: 0 });
      if (ft.tg) {
        const hr = clamp((10000 - H) / (10000 - 6000), 0, 1), PTG = ft.PTG * IF * hr;
        const x1 = clamp(ft.xTG - ft.LTG / 2, x0, Lr0), x2 = clamp(ft.xTG + ft.LTG / 2, x0, Lr0), la = Math.max(0, x2 - x1);
        const s1 = clamp(ft.xTG - ft.LTG / 2, xs - Bs / 2, xs + Bs / 2), s2 = clamp(ft.xTG + ft.LTG / 2, xs - Bs / 2, xs + Bs / 2), lsg = Math.max(0, s2 - s1);
        const Fz = PTG * 1e-6 * (w.Cda * armPlan * la + w.Cfig * ft.dsh * lsg), xz = la + lsg > 0 ? (w.Cda * armPlan * la * (x1 + x2) / 2 + w.Cfig * ft.dsh * lsg * (s1 + s2) / 2) / (w.Cda * armPlan * la + w.Cfig * ft.dsh * lsg) : 0;
        R.eq(L('Truck-induced gust pressure', 'แรงดันลมจากรถบรรทุก'), 'P_TG = ' + ft.PTG + '·I_F·k_h,  k_h = ' + f(hr, 3) + L(' (full ≤ 6.0 m, zero at 10.0 m)', ' (เต็มที่ ≤ 6.0 ม. เป็นศูนย์ที่ 10.0 ม.)'), PTG, 'Pa');
        R.eq(L('Truck gust force (vertical)', 'แรงลมจากรถบรรทุก (แนวดิ่ง)'), 'P_TG·(C_d·b·l_arm + C_fig·d_sign·l_sign) over ' + ft.LTG + ' mm at x = ' + f(ft.xTG, 0) + ' mm', Fz / 1e3, 'kN');
        cases.push({ id: 'TG', nm: L('Truck-induced gust', 'ลมจากรถบรรทุก'), Fs: 0, wa: 0, wc: 0, Fz, xz });
      }
      if (ft.ga) {
        const PG = ft.PG * IF, Fz = PG * As;
        R.eq(L('Galloping pressure (vertical, on sign face)', 'แรงดันการสั่นแบบแกลลอปปิง (แนวดิ่ง บนหน้าป้าย)'), 'P_G = ' + ft.PG + '·I_F', PG, 'Pa');
        cases.push({ id: 'GA', nm: L('Galloping', 'แกลลอปปิง'), Fs: 0, wa: 0, wc: 0, Fz, xz: xs });
      }
      const phiF = ft.phi;
      R.eq(L('Capacity factor for fatigue', 'ตัวคูณลดกำลังด้านความล้า'), 'φ_f', phiF, '', '§11.8');
      R.eq(L('Constant amplitude fatigue limit', 'ขีดจำกัดความล้าแอมพลิจูดคงที่'), 'f₃ = f_rc·(2×10⁶/5×10⁶)^{1/3} = 0.737·f_rc', '', '', 'Fig. 11.6.1');
      // details
      const isCHS = col.shape === 'CHS', armCHS = arm.shape === 'CHS';
      const catTube = (chs, wt) => wt === 'cjp' ? (chs ? 50 : 45) : (chs ? 40 : 36);
      const hs = bp.hs;
      const catSt = hs <= 50 ? 80 : hs <= 80 ? 71 : hs <= 100 ? 63 : 56;
      const dets = [];
      dets.push({ id: 'fB', nm: L('Column to base plate weld', 'รอยเชื่อมเสากับแผ่นฐาน'), cat: fatCat(ft.cB) || catTube(isCHS, bp.weld), src: 'EN 1993-1-9 Table 8.7 (' + (bp.weld === 'cjp' ? 'butt' : 'fillet') + ', t ≤ 8 mm)', t: col.t,
        st: cs => { const Mop = cs.Fs * zs + cs.wa * Lr0 * H + cs.wc * H * H / 2, Mip = cs.Fz * cs.xz; return isCHS ? Math.hypot(Mop, Mip) * (col.D / 2) / SI.Iop : Mop * (col.D / 2) / SI.Iop + Mip * (col.B / 2) / SI.Iip; } });
      if (bp.stiff) dets.push({ id: 'fS', nm: L('Stiffener termination on column', 'ปลายแผ่นเสริมบนเสา'), cat: fatCat(ft.cS) || catSt, src: 'EN 1993-1-9 Table 8.4 (L = h_s = ' + hs + ' mm)', t: col.t,
        st: cs => { const V = cs.Fs + cs.wa * Lr0 + cs.wc * H, Mop = cs.Fs * zs + cs.wa * Lr0 * H + cs.wc * H * H / 2 - V * hs, Mip = cs.Fz * cs.xz; return isCHS ? Math.hypot(Mop, Mip) / col.Zx : Mop / col.Zx + Mip / col.Zy; } });
      dets.push({ id: 'fA', nm: L('Anchor bolts', 'สลักยึด'), cat: fatCat(ft.cA) || 50, bolt: +bp.db.slice(1), src: 'EN 1993-1-9 Table 8.1 (bolts in tension)',
        st: cs => { const Mop = cs.Fs * zs + cs.wa * Lr0 * H + cs.wc * H * H / 2, Mip = cs.Fz * cs.xz; return boltGroup(bb.pts, 0, Mip, Mop, 0, 0).Tmax / BOLTS[bp.db][0]; } });
      const rootSt = x => cs => { const a1 = Math.max(0, cs.xz - x), Mv = cs.Fz * a1, Mh = cs.Fs * Math.max(0, xsw - x) + cs.wa * Math.pow(Lr0 - x, 2) / 2; return armCHS ? Math.hypot(Mv, Mh) / arm.Zx : Mv / arm.Zx + Mh / arm.Zy; };
      dets.push({ id: 'fR', nm: cn.type === 'bolt' ? L('Stub to column weld', 'รอยเชื่อมท่อสั้นกับเสา') : L('Arm to column weld', 'รอยเชื่อมคานกับเสา'), cat: fatCat(ft.cR) || catTube(armCHS, cn.weld), src: 'EN 1993-1-9 Table 8.7 (' + L('tube weld toe', 'ขอบรอยเชื่อมท่อ') + ')', t: arm.t, st: rootSt(x0) });
      if (cn.type === 'bolt') {
        dets.push({ id: 'fE', nm: L('Arm to end plate weld', 'รอยเชื่อมคานกับแผ่นปลาย'), cat: fatCat(ft.cR) || catTube(armCHS, cn.weld), src: 'EN 1993-1-9 Table 8.7', t: arm.t, st: rootSt(x0 + cn.Lst) });
        dets.push({ id: 'fF', nm: L('Flange bolts', 'สลักหน้าแปลน'), cat: fatCat(ft.cA) || 50, bolt: +cn.fb.slice(1), src: 'EN 1993-1-9 Table 8.1',
          st: cs => { const x = x0 + cn.Lst, Mv = cs.Fz * Math.max(0, cs.xz - x), Mh = cs.Fs * Math.max(0, xsw - x) + cs.wa * Math.pow(Lr0 - x, 2) / 2; return boltGroup(flBolts.pts, 0, Mh, Mv, 0, 0).Tmax / BOLTS[cn.fb][0]; } });
      }
      R.sec(L('Fatigue checks — stress range ≤ φ_f·f₃', 'ตรวจสอบความล้า — ช่วงหน่วยแรง ≤ φ_f·f₃'), 'AS 4100 §11.5, §11.6, §11.8');
      if (bp.stiff) R.txt(L('With stiffeners, the base weld stress is taken on the tube + stiffener section; the stiffener termination on the tube wall is checked as its own detail and normally governs.', 'เมื่อมีแผ่นเสริม หน่วยแรงที่รอยเชื่อมฐานคิดบนหน้าตัดท่อรวมแผ่นเสริม และตรวจปลายแผ่นเสริมบนผนังท่อแยกเป็นรายละเอียดหนึ่ง ซึ่งมักวิกฤต'));
      R.txt(L('Nominal stress ranges on the gross section at each detail, one load case at a time (the cases are not combined). Detail categories are user-selectable; the defaults follow EN 1993-1-9, which AS 4100 Section 11 is based on. Hot-spot stresses at the arm-to-column wall are not evaluated.', 'ช่วงหน่วยแรงระบุบนหน้าตัดเต็มที่แต่ละรายละเอียด ทีละกรณี (ไม่รวมกรณี) หมวดรายละเอียดเลือกได้ ค่าเริ่มต้นตาม EN 1993-1-9 ซึ่งเป็นพื้นฐานของ AS 4100 หมวด 11 ไม่ได้ประเมินหน่วยแรงจุดร้อนที่ผนังเสา'));
      dets.forEach(d => {
        const ks = d.bolt && d.bolt > 30 ? Math.pow(30 / d.bolt, 0.25) : 1;
        const f3 = 0.737 * d.cat * ks, cap = phiF * f3;
        fat.caps[d.id] = cap;
        if (d.t > 8 && !d.bolt && d.id !== 'fS') warn.push(d.nm + ': ' + L('wall t = ', 'ผนัง t = ') + d.t + L(' mm exceeds the t ≤ 8 mm range of the default category — confirm the category.', ' มม. เกินช่วง t ≤ 8 มม. ของหมวดเริ่มต้น — ยืนยันหมวด'));
        R.eq(d.nm, L('Category f_rc = ', 'หมวด f_rc = ') + d.cat + (ks < 1 ? ', k_s = (30/d)^0.25 = ' + f(ks, 3) : '') + ' — ' + d.src, cap, 'MPa');
        let worst = 0, wc = null;
        cases.forEach(cs => {
          const ds = d.st(cs), u = ds / cap;
          fat.rows.push({ det: d.nm, cs: cs.nm, ds, cat: d.cat, cap, ur: u });
          R.chk(d.nm + ' — ' + cs.nm, ds, cap, 'MPa');
          if (u > worst) { worst = u; wc = { cs, ds }; }
        });
        if (wc) add('fat' + d.id, L('Fatigue: ', 'ความล้า: ') + d.nm, wc.ds, cap, 'MPa', worst, 'fat', wc.cs.nm);
      });
      fat.cases = cases.map(c => c.nm);
      fat.caseObjs = cases; fat.phi = phiF;
    }

    const res = { code: 'AS', elem: 'gantry', checks, rep: R, warn: [...new Set(warn)], col, arm, geo: { H, L: Lr0, xs, Bs, Hs, ez, ey, x0, zs, xsw }, acts, base: { bolts: bb, stiff, plateSide, plateD, shape: circP ? 'circle' : 'square', Ls, SI }, flange: flBolts, conn: cn, sls: { dH, dV, limH, limV, fy: fy1, fz: fz1 }, fat, q: { qu, qs } };
    return res;
  }

  G.GANTRY = { designGantry, section, sizeOptions, GRADES, BOLTS, BGRADE, LIB };
})(typeof window !== 'undefined' ? window : globalThis);
