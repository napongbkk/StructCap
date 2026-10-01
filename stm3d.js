/* StructCap — 3D strut-and-tie check of pile caps to AS 3600:2018 Section 7.
   Space truss: top nodes at the column quarter points, inclined struts to the pile heads,
   horizontal struts between the top nodes, tie bands between neighbouring piles.
   Member forces from a linear stiffness analysis on equal pile springs (rigid-cap reactions). Units N, mm. */
(function (G) {
  'use strict';
  const RC = G.RC, PI = Math.PI, sq = Math.sqrt, f = RC.f, barA = RC.barA;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const PHI_ST = 0.6, PHI_T = 0.8;

  // Gaussian elimination with partial pivoting
  function solve(K, F) {
    const n = F.length, A = K.map((r, i) => r.concat([F[i]]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      if (Math.abs(A[p][c]) < 1e-30) continue;
      [A[c], A[p]] = [A[p], A[c]];
      for (let r = c + 1; r < n; r++) { const k = A[r][c] / A[c][c]; if (k) for (let j = c; j <= n; j++) A[r][j] -= k * A[c][j]; }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) { let s = A[r][n]; for (let j = r + 1; j < n; j++) s -= A[r][j] * x[j]; x[r] = Math.abs(A[r][r]) < 1e-30 ? 0 : s / A[r][r]; }
    return x;
  }

  function design(inp, lang) {
    const R = new RC.Rep(lang), L = (a, b) => R.L(a, b);
    const m = RC.material('AS', inp.mat), g = inp.geo, A = inp.act, warn = [];
    const checks = [], add = (id, name, Ed, Rd, unit, ur) => checks.push({ id, name, Ed, Rd, unit, ur: ur !== undefined ? ur : (Rd > 0 ? Math.abs(Ed) / Rd : 99) });
    const piles = RC.pileLayout({ layout: g.layout, s: g.s, nx: g.nx, ny: g.ny, sy: g.sy }), n = piles.length;
    const outl = RC.capOutline(piles, g.edge, g.layout === '3'), H = g.H, cx = g.cx, cy = g.cy;
    const fc = m.fc, fsy = m.fy, Ap = PI * g.Dp * g.Dp / 4, Ast = g.tN * barA(g.tD);

    // ---- materials and geometry
    R.sec(L('Materials', 'วัสดุ'), '§3.1, §3.2');
    R.eq('f\'c', L('Characteristic compressive strength', 'กำลังอัดคอนกรีต'), fc, 'MPa');
    R.eq('f_sy', L('Reinforcement yield strength', 'กำลังครากเหล็กเสริม'), fsy, 'MPa');
    R.eq('E_c', 'Table 3.1.2', m.Ec, 'MPa');
    R.eq('φ_st, φ_t', L('Strut and tie capacity factors', 'ตัวคูณลดกำลังค้ำและตัวยึด'), PHI_ST + ', ' + PHI_T, '', 'Table 2.2.2');

    R.sec(L('Geometry', 'รูปทรง'), '');
    if (outl.tri) R.txt(L('Triangular cap following the pile setting-out (sides parallel to the pile lines, corners cut square to the bisector).', 'ฐานรากสามเหลี่ยมตามผังเข็ม (ด้านขนานแนวเข็ม ตัดมุมตั้งฉากกับเส้นแบ่งครึ่งมุม)'));
    R.eq(L('Cap plan (overall) × depth', 'ขนาดฐานราก (รวม) × ความหนา'), 'L_x × L_y × H', f(outl.Lx, 0) + ' × ' + f(outl.Ly, 0) + ' × ' + f(H, 0), 'mm');
    R.eq(L('Plan area', 'พื้นที่ผัง'), 'A_cap', outl.area / 1e6, 'm²');
    R.eq(L('Piles', 'เสาเข็ม'), n + ' × Ø' + f(g.Dp, 0) + ', s = ' + f(g.s, 0), '', 'mm');
    R.eq(L('Column', 'เสา'), 'c_x × c_y', f(cx, 0) + ' × ' + f(cy, 0), 'mm');

    // ---- reactions (rigid cap)
    const W = g.gc * outl.area * H / 1e9, gG = +g.gG || 1.2;
    const Nu = (+A.N || 0) + gG * W, Mxu = +A.Mx || 0, Myu = +A.My || 0, Ns = (+A.Ns || 0) + W;
    const sx2 = piles.reduce((s, p) => s + p.x * p.x, 0) / 1e6, sy2 = piles.reduce((s, p) => s + p.y * p.y, 0) / 1e6;
    const react = (NN, MX, MY) => piles.map(p => NN / n + (sy2 > 0 ? MX * (p.y / 1e3) / sy2 : 0) + (sx2 > 0 ? MY * (p.x / 1e3) / sx2 : 0));
    const Pu = react(Nu, Mxu, Myu), Ps = react(Ns, +A.Mxs || 0, +A.Mys || 0);
    R.sec(L('Pile reactions', 'แรงปฏิกิริยาเสาเข็ม'), L('Rigid cap', 'ฐานรากแข็ง'));
    R.eq(L('Cap self-weight', 'น้ำหนักฐานราก'), 'W = γ_c·A_cap·H', W, 'kN');
    R.eq('N*', 'N*_col + γ_G·W', Nu, 'kN');
    R.eq('P_i', 'P_i = ΣN/n + M_x·y_i/Σy² + M_y·x_i/Σx²', '', '');
    piles.forEach((p, i) => R.eq(p.id + ' (' + f(p.x, 0) + ', ' + f(p.y, 0) + ')', 'ULS / SLS', f(Pu[i], 1) + ' / ' + f(Ps[i], 1), 'kN'));
    const Psmax = Math.max(...Ps);
    add('pile', L('Pile SLS load', 'แรงเสาเข็ม (ใช้งาน)'), Psmax, +g.Pallow, 'kN', R.chk(L('Pile working load', 'น้ำหนักบรรทุกใช้งานเสาเข็ม'), Psmax, +g.Pallow, 'kN'));
    if (Math.min(...Pu) < 0) warn.push(L('Tension pile present — the model needs a hold-down tie into the pile.', 'มีเสาเข็มรับแรงดึง — ต้องมีเหล็กยึดลงเข็ม'));

    // ---- truss geometry
    const ab = g.cb + g.tD, d = H - ab, z = (+g.zd || 0.85) * d, zt = ab + z, ht = 2 * (H - zt);
    R.sec(L('Strut-and-tie model', 'แบบจำลองโครงถักค้ำ-ยึด'), 'Section 7');
    R.txt(L('Space truss: the column load enters at top nodes at the column quarter points (radially at c/4 for three piles); inclined struts carry it to the pile heads; horizontal struts join the top nodes; tie bands over the piles join neighbouring piles.', 'โครงถักสามมิติ: แรงเสาเข้าที่จุดต่อบนตำแหน่งหนึ่งในสี่ของเสา (ตามแนวรัศมี c/4 สำหรับเข็ม 3 ต้น) ค้ำเอียงถ่ายแรงลงหัวเข็ม ค้ำแนวนอนเชื่อมจุดต่อบน และแถบเหล็กยึดเหนือหัวเข็มเชื่อมเข็มข้างเคียง'));
    R.eq('a_b', L('Tie centroid above soffit = c_b + d_b (two crossing layers)', 'ศูนย์ถ่วงตัวยึดจากท้องฐาน = c_b + d_b (สองชั้นตัดกัน)'), ab, 'mm');
    R.eq('d', 'H − a_b', d, 'mm');
    R.eq('z', 'z = ' + f(+g.zd || 0.85, 2) + '·d', z, 'mm');
    R.eq(L('Top node depth', 'ความลึกจุดต่อบน'), 'h_t = 2(H − a_b − z)', ht, 'mm');
    if (ht <= 0) warn.push(L('z/d is too large: the top node has no depth.', 'z/d มากเกินไป: จุดต่อบนไม่มีความลึก'));

    const nodes = [], key = {}, members = [];
    const node = (x, y, zz, kind, id) => { const k = Math.round(x) + ',' + Math.round(y) + ',' + Math.round(zz); if (key[k] !== undefined) return key[k]; key[k] = nodes.length; nodes.push({ x, y, z: zz, kind, id }); return key[k]; };
    const ceq = sq(cx * cy);
    const topOf = p => {
      if (g.layout === '3') { const r = Math.hypot(p.x, p.y) || 1; return [p.x / r * ceq / 4, p.y / r * ceq / 4]; }
      return [clamp(p.x, -cx / 4, cx / 4), clamp(p.y, -cy / 4, cy / 4)];
    };
    const pN = piles.map(p => node(p.x, p.y, ab, 'P', p.id));
    // shift the top-node pattern by δ so that the node loads (= pile reactions) have the column moment:
    // Σ P_i·(t_i + δ) = M  →  each strut then carries its own pile reaction and the truss is in equilibrium
    const t0 = piles.map(topOf);
    const dX = sx2 > 0 && Nu > 0 ? (Myu * 1e3 - piles.reduce((s, p, i) => s + Pu[i] * t0[i][0], 0)) / Nu : 0;
    const dY = sy2 > 0 && Nu > 0 ? (Mxu * 1e3 - piles.reduce((s, p, i) => s + Pu[i] * t0[i][1], 0)) / Nu : 0;
    const tN = piles.map((p, i) => node(t0[i][0] + dX, t0[i][1] + dY, zt, 'T'));
    let tc = 0; nodes.forEach(q => { if (q.kind === 'T') q.id = 'T' + (++tc); });
    const tops = nodes.map((q, i) => i).filter(i => nodes[i].kind === 'T'), nT = tops.length;
    const Aj = cx * cy / nT; // column area per top node
    // inclined struts
    piles.forEach((p, i) => members.push({ id: 'S' + (i + 1), type: 'strut', a: tN[i], b: pN[i], pile: i }));
    // horizontal struts between top nodes (skip a pair that passes through another top node)
    const between = (i, j, list) => list.some(k => {
      if (k === i || k === j) return false;
      const A0 = nodes[i], B0 = nodes[j], C0 = nodes[k], ux = B0.x - A0.x, uy = B0.y - A0.y, l2 = ux * ux + uy * uy, t = ((C0.x - A0.x) * ux + (C0.y - A0.y) * uy) / l2;
      return t > 0.01 && t < 0.99 && Math.hypot(A0.x + t * ux - C0.x, A0.y + t * uy - C0.y) < 1;
    });
    let ct = 0;
    for (let a = 0; a < nT; a++) for (let b = a + 1; b < nT; b++) if (!between(tops[a], tops[b], tops)) members.push({ id: 'C' + (++ct), type: 'top', a: tops[a], b: tops[b] });
    // ties: all sides for three piles; otherwise neighbours along rows and columns
    let tt = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const P = piles[i], Q = piles[j], row = Math.abs(P.y - Q.y) < 1, colm = Math.abs(P.x - Q.x) < 1;
      const ok = g.layout === '3' || ((row || colm) && !between(pN[i], pN[j], pN));
      if (ok) members.push({ id: 'B' + (++tt), type: 'tie', a: pN[i], b: pN[j] });
    }
    // a pile left without a tie along its row / column (e.g. the centre pile of five) is tied to its nearest piles
    piles.forEach((p, i) => {
      if (members.some(e => e.type === 'tie' && (e.a === pN[i] || e.b === pN[i]))) return;
      const dmin = Math.min(...piles.map((q, j) => j === i ? Infinity : Math.hypot(q.x - p.x, q.y - p.y)));
      piles.forEach((q, j) => { if (j !== i && Math.hypot(q.x - p.x, q.y - p.y) < 1.02 * dmin) members.push({ id: 'B' + (++tt), type: 'tie', a: pN[i], b: pN[j] }); });
    });
    members.forEach(e => {
      const A0 = nodes[e.a], B0 = nodes[e.b];
      e.dx = B0.x - A0.x; e.dy = B0.y - A0.y; e.dz = B0.z - A0.z; e.L = Math.hypot(e.dx, e.dy, e.dz);
      e.lh = Math.hypot(e.dx, e.dy); e.th = Math.atan2(Math.abs(e.dz), e.lh) * 180 / PI;
      e.EA = e.type === 'tie' ? 200000 * Ast : e.type === 'top' ? m.Ec * Math.max(ht, 50) * Math.min(cx, cy) / 2 : m.Ec * Ap;
    });

    // ---- top node loads: the pile reactions served by each node (column + factored cap weight)
    const wPile = gG * W / n;
    const Fu = tops.map(j => piles.reduce((s, p, i) => s + (tN[i] === j ? Pu[i] : 0), 0));
    const Fc = tops.map(j => piles.reduce((s, p, i) => s + (tN[i] === j ? Pu[i] - wPile : 0), 0));
    if (sy2 === 0 && Mxu) warn.push(L('Single line of piles: M_x is not carried by the cap — provide tie beams.', 'เข็มแถวเดียว: ฐานรากไม่รับ M_x — ต้องมีคานยึด'));
    if (sx2 === 0 && Myu) warn.push(L('Single line of piles: M_y is not carried by the cap — provide tie beams.', 'เข็มแถวเดียว: ฐานรากไม่รับ M_y — ต้องมีคานยึด'));
    if (Math.abs(dX) > cx / 4 || Math.abs(dY) > cy / 4) warn.push(L('Large load eccentricity: the top nodes move beyond the column quarter points — check the column-to-cap connection for tension.', 'ความเยื้องศูนย์มาก: จุดต่อบนเลื่อนเกินตำแหน่งหนึ่งในสี่ของเสา — ตรวจรอยต่อเสากับฐานรากสำหรับแรงดึง'));
    // ---- stiffness analysis
    const nd = nodes.length, K = Array.from({ length: 3 * nd }, () => new Array(3 * nd).fill(0)), F = new Array(3 * nd).fill(0);
    let kref = Infinity;
    members.forEach(e => {
      const k = e.EA / e.L, c = [e.dx / e.L, e.dy / e.L, e.dz / e.L]; kref = Math.min(kref, k);
      for (let p = 0; p < 3; p++) for (let q = 0; q < 3; q++) {
        const v = k * c[p] * c[q];
        K[3 * e.a + p][3 * e.a + q] += v; K[3 * e.b + p][3 * e.b + q] += v; K[3 * e.a + p][3 * e.b + q] -= v; K[3 * e.b + p][3 * e.a + q] -= v;
      }
    });
    const kv = 1e-3 * kref, kh = 1e-6 * kref, ks = 1e-9 * kref;
    nodes.forEach((q, i) => { for (let p = 0; p < 3; p++) K[3 * i + p][3 * i + p] += q.kind === 'P' ? (p === 2 ? kv : kh) : ks; });
    tops.forEach((i, j) => { F[3 * i + 2] = -Fu[j] * 1e3; });
    const u = solve(K, F);
    members.forEach(e => { e.N = e.EA / e.L * ((u[3 * e.b] - u[3 * e.a]) * e.dx + (u[3 * e.b + 1] - u[3 * e.a + 1]) * e.dy + (u[3 * e.b + 2] - u[3 * e.a + 2]) * e.dz) / e.L / 1e3; }); // kN, + tension
    const Rv = pN.map(i => -kv * u[3 * i + 2] / 1e3), Rh = nodes.reduce((s, q, i) => s + (q.kind === 'P' ? kh * Math.hypot(u[3 * i], u[3 * i + 1]) : ks * Math.hypot(u[3 * i], u[3 * i + 1], u[3 * i + 2])) / 1e3, 0);
    const dR = Math.max(...Rv.map((r, i) => Math.abs(r - Pu[i])));
    if (Rh > 0.01 * Math.max(1, Nu)) warn.push(L('The truss is not fully stable for these loads (restraint springs carry load) — check the pile layout.', 'โครงถักไม่เสถียรสมบูรณ์ภายใต้แรงนี้ — ตรวจสอบผังเข็ม'));

    R.sec(L('Truss nodes and loads', 'จุดต่อและแรงกระทำ'), '');
    R.eq(L('Node pattern shift', 'การเลื่อนผังจุดต่อบน'), 'δ = (M* − ΣP_i·t_i) / N*  (x, y)', f(dX, 1) + ', ' + f(dY, 1), 'mm');
    R.txt(L('The top nodes sit at the column quarter points shifted by δ, so the node loads equal the pile reactions and their resultant is N* with M*_x, M*_y about the column centre.', 'จุดต่อบนอยู่ที่ตำแหน่งหนึ่งในสี่ของเสาเลื่อนด้วย δ แรงที่จุดต่อจึงเท่ากับแรงปฏิกิริยาเข็ม และมีแรงลัพธ์ N* กับ M*_x, M*_y รอบศูนย์กลางเสา'));
    tops.forEach((i, j) => R.eq(nodes[i].id + ' (' + f(nodes[i].x, 0) + ', ' + f(nodes[i].y, 0) + ', ' + f(nodes[i].z, 0) + ')', 'F*', Fu[j], 'kN'));
    R.eq(L('Truss reactions vs rigid cap', 'แรงปฏิกิริยาโครงถักเทียบฐานรากแข็ง'), 'max |R_i − P_i|', dR, 'kN');

    // ---- members
    const fcu = 0.9 * fc, sinD = t => Math.sin(t * PI / 180), cosD = t => Math.cos(t * PI / 180);
    const tieCap = PHI_T * Ast * fsy / 1e3;
    const Vnode = {}; members.filter(e => e.type === 'strut').forEach(e => { Vnode[e.a] = (Vnode[e.a] || 0) + Math.max(0, -e.N) * sinD(e.th); });
    members.forEach(e => {
      if (e.type === 'tie') {
        e.cap = tieCap; e.ur = e.N > 0 ? e.N / tieCap : 0; e.note = e.N > 0 ? '' : L('compression', 'แรงอัด');
      } else if (e.type === 'top') {
        e.beta = 1.0; e.Ac = Math.max(ht, 0) * Math.min(cx, cy) / 2; e.cap = PHI_ST * e.beta * fcu * e.Ac / 1e3;
        e.ur = e.N < 0 ? -e.N / e.cap : (e.N > 0.005 * Nu ? 99 : 0); e.note = e.N > 0.005 * Nu ? L('tension in a concrete strut', 'แรงดึงในค้ำคอนกรีต') : '';
      } else {
        const th = e.th, cot2 = th >= 89.99 ? 0 : Math.pow(1 / Math.tan(th * PI / 180), 2);
        e.beta = clamp(1 / (1 + 0.66 * cot2), 0.3, 1.0);
        const C = Math.max(0, -e.N), share = Vnode[e.a] > 0 ? C * sinD(th) / Vnode[e.a] : 1, Ash = Aj * share;
        e.Abot = PI / 4 * g.Dp * (g.Dp * sinD(th) + 2 * ab * cosD(th));
        e.Atop = Ash * sinD(th) + Math.max(ht, 0) * sq(Ash) * cosD(th);
        e.Ac = Math.min(e.Abot, e.Atop); e.cap = PHI_ST * e.beta * fcu * e.Ac / 1e3;
        e.ur = e.N < 0 ? C / e.cap : (e.N > 0.005 * Nu ? 99 : 0); e.note = e.N > 0.005 * Nu ? L('tension in a concrete strut', 'แรงดึงในค้ำคอนกรีต') : '';
      }
    });
    const nm = i => nodes[i].id;
    R.sec(L('Member forces (− compression, + tension)', 'แรงในชิ้นส่วน (− อัด, + ดึง)'), L('Linear analysis', 'วิเคราะห์เชิงเส้น'));
    members.forEach(e => R.eq(e.id + ' ' + nm(e.a) + '–' + nm(e.b), (e.type === 'tie' ? L('tie', 'ตัวยึด') : e.type === 'top' ? L('top strut', 'ค้ำบน') : L('strut', 'ค้ำ')) + ', L = ' + f(e.L, 0) + ' mm' + (e.type === 'strut' ? ', θ = ' + f(e.th, 1) + '°' : ''), e.N, 'kN'));

    // ties
    R.sec(L('Ties', 'ตัวยึด'), '§7.3');
    R.eq(L('Tie band over the piles', 'แถบเหล็กยึดเหนือหัวเข็ม'), g.tN + RC.barName('AS', g.tD) + ', A_st = ' + f(Ast, 0) + ' mm²', '', '');
    R.eq('φT_u', 'φ_t·A_st·f_sy', tieCap, 'kN');
    const ties = members.filter(e => e.type === 'tie'), wt = ties.reduce((p, q) => (!p || q.ur > p.ur ? q : p), null);
    if (wt) add('tie', L('Tie ', 'ตัวยึด ') + wt.id + ' (' + nm(wt.a) + '–' + nm(wt.b) + ')', Math.max(0, wt.N), tieCap, 'kN', R.chk(L('Worst tie ', 'ตัวยึดวิกฤต ') + wt.id, Math.max(0, wt.N), tieCap, 'kN'));

    // struts
    R.sec(L('Struts', 'ค้ำ'), '§7.2');
    R.eq('β_s', L('Bottle-shaped strut: 1/(1 + 0.66·cot²θ_s), 0.3 ≤ β_s ≤ 1.0; prismatic top strut 1.0', 'ค้ำรูปขวด: 1/(1 + 0.66·cot²θ_s), 0.3 ≤ β_s ≤ 1.0; ค้ำบนแบบปริซึม 1.0'), '', '', '§7.2.1');
    R.eq('φF_c', 'φ_st·β_s·0.9f\'c·A_c, A_c = ' + L('smallest strut section', 'หน้าตัดค้ำเล็กสุด'), '', '');
    R.eq(L('Section at the pile', 'หน้าตัดที่หัวเข็ม'), 'A_bot = (π/4)·D_p·(D_p·sin θ + 2a_b·cos θ)', '', '');
    R.eq(L('Section at the column', 'หน้าตัดที่เสา'), 'A_top = A_j·sin θ + h_t·√A_j·cos θ,  A_j = c_x·c_y/n_T·(' + L('share', 'สัดส่วน') + ')', '', '');
    const sts = members.filter(e => e.type === 'strut');
    sts.forEach(e => R.eq(e.id + ' (' + nm(e.a) + '–' + nm(e.b) + ')', 'θ = ' + f(e.th, 1) + '°, β_s = ' + f(e.beta, 3) + ', A_c = ' + f(e.Ac / 1e3, 0) + '×10³ mm²', f(-e.N, 0) + ' / ' + f(e.cap, 0), 'kN'));
    const ws = sts.reduce((p, q) => (!p || q.ur > p.ur ? q : p), null);
    add('strut', L('Inclined strut ', 'ค้ำเอียง ') + ws.id, Math.max(0, -ws.N), ws.cap, 'kN', R.chk(L('Worst inclined strut ', 'ค้ำเอียงวิกฤต ') + ws.id, Math.max(0, -ws.N), ws.cap, 'kN', ws.ur));
    const tps = members.filter(e => e.type === 'top');
    if (tps.length) {
      R.eq(L('Top struts', 'ค้ำบน'), 'A_c = h_t·min(c_x, c_y)/2, β_s = 1.0', f(tps[0].Ac / 1e3, 0) + '×10³', 'mm²');
      const wtp = tps.reduce((p, q) => (!p || q.ur > p.ur ? q : p), null);
      add('top', L('Top strut ', 'ค้ำบน ') + wtp.id, Math.abs(wtp.N), wtp.cap, 'kN', R.chk(L('Worst top strut ', 'ค้ำบนวิกฤต ') + wtp.id, Math.abs(wtp.N), wtp.cap, 'kN', wtp.ur));
    }
    const thMin = Math.min(...sts.map(e => e.th));
    R.eq(L('Smallest strut angle', 'มุมค้ำน้อยสุด'), 'θ_min', thMin, '°');
    add('theta', L('Strut angle θ ≥ 30°', 'มุมค้ำ θ ≥ 30°'), thMin, 30, '°', R.chk(L('Strut angle', 'มุมค้ำ'), 30, thMin, '°', 30 / Math.max(thMin, 1)));

    // nodes
    R.sec(L('Nodes', 'จุดต่อ'), '§7.2.4');
    const fn = bn => PHI_ST * bn * fcu;
    R.eq('φf_n', 'φ_st·β_n·0.9f\'c,  β_n = 1.0 (CCC), 0.8 (CCT), 0.6 (CTT)', f(fn(1), 2) + ' / ' + f(fn(0.8), 2) + ' / ' + f(fn(0.6), 2), 'MPa');
    const sC = Math.max(...Fc.map(F0 => F0 * 1e3 / Aj));
    R.eq(L('Column node face stress', 'หน่วยแรงที่หน้าจุดต่อใต้เสา'), 'max F_j / A_j', sC, 'MPa');
    add('nCCC', L('Column nodes (CCC)', 'จุดต่อใต้เสา (CCC)'), sC, fn(1), 'MPa', R.chk(L('Column node CCC', 'จุดต่อใต้เสา CCC'), sC, fn(1), 'MPa'));
    let wn = null;
    piles.forEach((p, i) => {
      const nt = ties.filter(e => (e.a === pN[i] || e.b === pN[i]) && e.N > 0.001).length, bn = nt === 0 ? 1.0 : nt === 1 ? 0.8 : 0.6;
      const s = Math.max(0, Rv[i]) * 1e3 / Ap, ur = s / fn(bn);
      if (!wn || ur > wn.ur) wn = { p, s, bn, ur, type: nt === 0 ? 'CCC' : nt === 1 ? 'CCT' : 'CTT' };
    });
    R.eq(L('Pile node', 'จุดต่อหัวเข็ม'), wn.p.id + ' (' + wn.type + ', β_n = ' + wn.bn + '),  R_i / A_p', wn.s, 'MPa');
    add('nP', L('Pile node ', 'จุดต่อหัวเข็ม ') + wn.p.id + ' (' + wn.type + ')', wn.s, fn(wn.bn), 'MPa', R.chk(L('Pile node bearing', 'แรงแบกทานที่หัวเข็ม'), wn.s, fn(wn.bn), 'MPa'));

    // tie anchorage at the outer piles
    R.sec(L('Tie anchorage', 'การยึดรั้งตัวยึด'), '§13.1.2');
    const db = g.tD, k1 = 1.0, k2 = (132 - db) / 100, cd = Math.min(g.cs, g.cb), k3 = clamp(1 - 0.15 * (cd - db) / db, 0.7, 1.0);
    const Lsytb = Math.max(0.5 * k1 * k3 * fsy * db / (k2 * sq(Math.min(fc, 65))), 29 * k1 * db), Lsyt = 0.5 * Lsytb;
    R.eq('L_sy.tb', '0.5·k₁·k₃·f_sy·d_b/(k₂·√f\'c) ≥ 29k₁d_b,  k₁ = 1.0, k₂ = ' + f(k2, 2) + ', k₃ = ' + f(k3, 2), Lsytb, 'mm', '§13.1.2.2');
    R.eq('L_sy.t', L('0.5·L_sy.tb with a standard hook or cog at the bar end', '0.5·L_sy.tb เมื่องอขอมาตรฐานที่ปลายเหล็ก'), Lsyt, 'mm', '§13.1.2.3');
    const rayOut = (x0, y0, ux, uy) => { let lo = 0, hi = 4 * (outl.Lx + outl.Ly); for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; if (outl.inside(x0 + ux * mid, y0 + uy * mid)) lo = mid; else hi = mid; } return lo; };
    let wa = null;
    ties.filter(e => e.N > 0).forEach(e => [[e.a, e.b], [e.b, e.a]].forEach(([i, j]) => {
      const P = nodes[i], Q = nodes[j], l = Math.hypot(P.x - Q.x, P.y - Q.y), ux = (P.x - Q.x) / l, uy = (P.y - Q.y) / l;
      const cont = ties.some(o => o !== e && (o.a === i || o.b === i) && (() => { const k = o.a === i ? o.b : o.a, ox = nodes[k].x - P.x, oy = nodes[k].y - P.y; return (ox * ux + oy * uy) / Math.hypot(ox, oy) > 0.99; })());
      if (cont) return;
      const la = g.Dp / 2 + rayOut(P.x, P.y, ux, uy) - g.cs, sst = Math.min(fsy, e.N * 1e3 / (PHI_T * Ast));
      const req = Math.max(Lsyt * sst / fsy, 12 * db), ur = req / Math.max(la, 1);
      if (!wa || ur > wa.ur) wa = { e, id: P.id, la, req, ur, sst };
    }));
    if (wa) {
      R.eq(L('Critical anchorage', 'การยึดรั้งวิกฤต'), wa.e.id + L(' at ', ' ที่ ') + wa.id + ', σ_st = T*/(φA_st) = ' + f(wa.sst, 0) + ' MPa', '', '');
      R.eq(L('Required', 'ที่ต้องการ'), 'L_st = L_sy.t·σ_st/f_sy ≥ 12d_b', wa.req, 'mm', '§13.1.2.1');
      R.eq(L('Available', 'ที่มี'), 'l_a = D_p/2 + ' + L('pile centre to cap edge along the tie', 'ศูนย์เข็มถึงขอบฐานรากตามแนวตัวยึด') + ' − c_s', wa.la, 'mm');
      add('anch', L('Tie anchorage at ', 'การยึดรั้งตัวยึดที่ ') + wa.id, wa.req, wa.la, 'mm', R.chk(L('Anchorage', 'การยึดรั้ง'), wa.req, wa.la, 'mm'));
      R.txt(L('Measured from the inner face of the pile (start of the extended nodal zone). Hook or cog the tie bars at the cap edge.', 'วัดจากผิวด้านในของเข็ม (จุดเริ่มเขตจุดต่อขยาย) งอขอเหล็กตัวยึดที่ขอบฐานราก'));
    }
    R.txt(L('Provide a distributed bottom mesh and side bars for crack control (§7.4), and check punching and one-way shear with the RC Pile Cap module.', 'ให้มีตะแกรงเหล็กล่างกระจายและเหล็กข้างเพื่อควบคุมรอยร้าว (§7.4) และตรวจเฉือนทะลุและเฉือนแบบคานด้วยโมดูลฐานรากบนเสาเข็ม'));
    const tens = members.filter(e => e.type !== 'tie' && e.N > 0.005 * Nu);
    if (tens.length) add('tens', L('Tension in concrete struts', 'แรงดึงในค้ำคอนกรีต'), Math.max(...tens.map(e => e.N)), 0, 'kN', 99);

    return { code: 'AS', elem: 'stm3d', checks, rep: R, warn, piles, Pu, Ps, Rv, W, Nu, nodes, members, outl, poly: outl.poly, tri: outl.tri, H, ab, d, z, zt, ht, Aj, Fu, Fc, dX, dY, thMin, X0: outl.X0, X1: outl.X1, Y0: outl.Y0, Y1: outl.Y1, Lx: outl.Lx, Ly: outl.Ly, area: outl.area, m };
  }

  G.STM3D = { design, solve };
})(typeof window !== 'undefined' ? window : globalThis);
