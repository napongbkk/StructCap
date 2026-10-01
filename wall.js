/* StructCap — limestone block gravity wall (dry-stacked or mortar-bedded courses) to AS 4678:2002.
   Per metre run. x = 0 at the toe (front of the bottom course), x positive into the retained soil, z up from the base.
   Earth pressure on a vertical virtual back through the heel of each wall portion by the trial-wedge (Coulomb)
   method, which handles a level crest followed by a back slope, strip surcharge and pseudo-static earthquake.
   Checks at the base and at every bed joint: overturning, sliding (shear between blocks), bearing at the base. */
(function (G) {
  'use strict';
  const RC = G.RC, PI = Math.PI, f = RC.f, rad = d => d * PI / 180, deg = r => r * 180 / PI;

  function design(inp, lang) {
    const R = new RC.Rep(lang), L = (a, b) => R.L(a, b), warn = [];
    const g = inp.geo, s = inp.soil, ld = inp.load, fc = inp.fac;
    const bx = g.bx, by = g.by, set = g.set || 0, gb = g.gb;
    const cs = g.courses.map((n, i) => ({ i, n, xf: i * set, xb: i * set + n * bx, z0: i * by, z1: (i + 1) * by }));
    const N = cs.length, H = N * by, top = cs[N - 1];
    cs.forEach((c, i) => { if (i && (c.xf < cs[i - 1].xf - 1 || c.xb > cs[i - 1].xb + 1)) warn.push(L('Course ', 'ชั้น ') + (i + 1) + L(' overhangs the course below.', ' ยื่นเกินชั้นล่าง')); });
    const beta = rad(Math.max(0, s.beta || 0)), tb = Math.tan(beta), xc0 = top.xf, xs0 = xc0 + (g.Lc || 0);
    const ds = Math.max(0, g.ds || 0), Hs = H - ds;                          // retained ground ds below the top of the stone
    const zs = x => x <= xs0 ? Hs : Hs + (x - xs0) * tb;                    // ground surface behind the wall
    const qa = xc0, qb = ld.qext === 'crest' ? xs0 : Infinity;              // surcharge strip
    const Pu = fc.Pphi, Pc = fc.Pc;
    const phiD = Math.atan(Pu * Math.tan(rad(s.phi)));                       // design friction angle, retained soil
    const phiB = Math.atan(Pu * Math.tan(rad(s.phib))), cB = Pc * (s.cb || 0); // foundation
    const muJ = Pu * s.mu, cJ = Pc * (s.cj || 0);                           // bed joints
    const dlt = s.dv === 'zero' ? 0 : s.dv === 'twothirds' ? 2 / 3 * phiD : Math.min(beta, phiD);
    const gs = s.gs, kh = ld.kh || 0, gw = 9.81;
    const wat = !!ld.water, hw = wat ? Math.max(0, ld.hw || 0) : -1, hwf = wat ? Math.min(Math.max(0, ld.hwf || 0), hw) : -1, gsat = s.gsat || gs + 1, gW = fc.gW || 1;
    if (wat && hw > Hs) warn.push(L('Water level behind is above the retained ground — taken as given.', 'ระดับน้ำด้านหลังสูงกว่าผิวดินถม — ใช้ค่าตามที่กำหนด'));
    if (beta >= phiD - rad(0.5)) warn.push(L('The back slope is as steep as or steeper than the design friction angle φ* — the slope itself is unstable; flatten it or check global stability.', 'ความชันด้านหลังเท่ากับหรือชันกว่ามุมเสียดทานออกแบบ φ* — ลาดดินเองไม่เสถียร ควรลดความชันหรือตรวจเสถียรภาพโดยรวม'));

    // ---- report: inputs
    R.sec(L('Wall geometry', 'รูปทรงกำแพง'), '');
    R.eq(L('Blocks', 'ก้อนหิน'), 'x × y, γ_b', f(bx, 0) + ' × ' + f(by, 0) + ' mm, ' + f(gb, 1) + ' kN/m³', '');
    R.eq(L('Courses (bottom → top)', 'จำนวนชั้น (ล่าง → บน)'), L('blocks per course', 'ก้อนต่อชั้น'), g.courses.join(' / '), '');
    R.eq(L('Wall height', 'ความสูงกำแพง'), 'H = n·y', H, 'mm');
    R.eq(L('Embedment / exposed height', 'ความลึกฝัง / ความสูงโผล่'), 'e, h = H − e', f(g.e, 0) + ' / ' + f(H - g.e, 0), 'mm');
    if (set) R.eq(L('Front setback per course', 'ระยะถอยหน้าต่อชั้น'), 's', set, 'mm');
    R.eq(L('Retained ground below top of stone', 'ผิวดินถมต่ำกว่าหลังหิน'), 'd_s', ds, 'mm');
    R.eq(L('Crest then back slope', 'ระยะราบด้านบนแล้วจึงลาด'), 'L_c, β', f(g.Lc, 0) + ' mm, ' + f(s.beta, 1) + '°', '');
    R.sec(L('Soil and design strengths', 'ดินและกำลังออกแบบ'), 'AS 4678 §5.2, Table 5.1');
    R.eq(L('Retained soil', 'ดินถม'), 'γ, φ\'', f(gs, 1) + ' kN/m³, ' + f(s.phi, 1) + '°', '');
    if (wat) R.eq(L('Below the water table', 'ใต้ระดับน้ำ'), 'γ_sat, γ\' = γ_sat − γ_w', f(gsat, 1) + ', ' + f(gsat - gw, 2) + ' kN/m³', '');
    R.eq('Φ_uφ, Φ_uc', L('Material reduction factors', 'ตัวคูณลดกำลังวัสดุ'), f(Pu, 2) + ', ' + f(Pc, 2), '');
    R.eq('φ*', 'tan φ* = Φ_uφ·tan φ\'', deg(phiD), '°');
    R.eq('δ', L('Wall friction on the virtual back', 'แรงเสียดทานผนังที่ระนาบสมมติ') + (s.dv === 'zero' ? ' = 0' : s.dv === 'twothirds' ? ' = 2/3·φ*' : ' = min(β, φ*)'), deg(dlt), '°');
    R.eq(L('Foundation', 'ดินฐานราก'), 'φ*_b = atan(Φ_uφ tan φ_b), c*_b = Φ_uc·c_b', f(deg(phiB), 1) + '°, ' + f(cB, 1) + ' kPa', '');
    R.eq(L('Bed joints', 'รอยต่อระหว่างชั้น'), 'μ* = Φ_uφ·μ, c*_j = Φ_uc·c_j', f(muJ, 3) + ', ' + f(cJ, 1) + ' kPa', '');
    R.eq(L('Design bearing capacity', 'กำลังรับน้ำหนักออกแบบ'), 'φq_u', ld.qbear, 'kPa');
    R.sec(L('Loads', 'น้ำหนักบรรทุก'), 'AS 4678 §4, AS/NZS 1170.1 Table 3.3');
    R.eq(L('Surcharge (UDL)', 'น้ำหนักแผ่กระจาย (UDL)'), 'q, ' + (ld.qext === 'crest' ? L('on the crest only', 'เฉพาะบนลานด้านบน') : L('on the crest and slope', 'บนลานและลาด')), ld.q, 'kPa');
    if ((ld.q || 0) < 5) warn.push(L('AS 4678 §4.2 asks for a live surcharge of at least 5 kPa on most walls.', 'AS 4678 §4.2 กำหนดน้ำหนักจรขั้นต่ำ 5 kPa สำหรับกำแพงส่วนใหญ่'));
    R.eq(L('Handrail line load', 'แรงราวกันตก'), 'H_r ' + L('at ', 'ที่ ') + f(ld.hr, 0) + L(' mm above the wall top', ' มม. เหนือหลังกำแพง'), ld.Hr, 'kN/m');
    if (wat) {
      R.eq(L('Groundwater behind / in front', 'ระดับน้ำใต้ดินด้านหลัง / ด้านหน้า'), 'h_w, h_wf ' + L('above the base', 'เหนือฐาน'), f(hw, 0) + ' / ' + f(hwf, 0), 'mm');
      R.eq(L('Water pressure', 'แรงดันน้ำ'), L('hydrostatic on the virtual back; uplift on each bed varying linearly from γ_w(h_w − z) at the back to γ_w(h_wf − z) at the front; load factor γ_W', 'แรงดันน้ำสถิตบนระนาบสมมติ แรงยกใต้แต่ละรอยต่อแปรผันเชิงเส้นจากด้านหลังถึงด้านหน้า ตัวคูณ γ_W'), gW, '');
    }
    if (kh) R.eq(L('Earthquake', 'แผ่นดินไหว'), 'k_h (' + L('pseudo-static', 'สถิตเทียบเท่า') + ')', kh, '', 'AS 4678 App. I, AS 1170.4');
    R.eq(L('Load factors', 'ตัวคูณน้ำหนัก'), 'γ_G,dst, γ_G,stb, γ_Q, ψ_E', f(fc.gGd, 2) + ', ' + f(fc.gGs, 2) + ', ' + f(fc.gQ, 2) + ', ' + f(fc.psiE, 2), '', 'AS 4678 §J');

    // ---- trial wedge on a vertical plane at x = xv, from level zb up to the surface
    function thrust(xv, zb, q, k) {
      const zt = zs(xv), n = 24, out = [{ z: zt, P: 0 }];
      for (let i = 1; i <= n; i++) {
        const z0 = zt - (zt - zb) * i / n;
        let best = 0;
        for (let th = Math.max(phiD, beta) + rad(0.5); th < rad(89.5); th += rad(0.5)) {
          const t = Math.tan(th);
          // intersection of the failure plane z = z0 + (x − xv)·t with the surface
          let lo = xv, hi = xv + Math.max(1, (zt - z0)) / Math.max(t - tb, 1e-3) + (xs0 > xv ? xs0 - xv : 0) + 10;
          if (z0 + (hi - xv) * t < zs(hi)) continue;
          for (let k2 = 0; k2 < 60; k2++) { const m = (lo + hi) / 2; if (z0 + (m - xv) * t < zs(m)) lo = m; else hi = m; }
          const xe = lo, m = 40, dx = (xe - xv) / m;
          let A = 0, Aw = 0; for (let j = 0; j < m; j++) { const x = xv + (j + 0.5) * dx, zl = z0 + (x - xv) * t, zu = zs(x); A += Math.max(0, zu - zl) * dx; if (hw > zl) Aw += Math.max(0, Math.min(zu, hw) - zl) * dx; }
          const Wt = (gs * (A - Aw) + (gsat - gw) * Aw) / 1e6 + q * Math.max(0, Math.min(xe, qb) - Math.max(xv, qa)) / 1e3; // kN/m
          const P = Wt * (Math.sin(th - phiD) + k * Math.cos(th - phiD)) / Math.cos(th - phiD - dlt);
          if (P > best) best = P;
        }
        out.push({ z: z0, P: best });
      }
      const P = out[out.length - 1].P;
      let M = 0; for (let i = 1; i < out.length; i++) M += (out[i].P - out[i - 1].P) * ((out[i].z + out[i - 1].z) / 2 - zb);
      return { P, arm: P > 0 ? M / P : 0, prof: out };
    }

    // ---- one wall portion: courses k..N-1 resting on the bed at z = cs[k].z0
    function portion(k) {
      const part = cs.slice(k), zb = cs[k].z0, xt = cs[k].xf, xh = cs[k].xb, B = xh - xt;
      const xv = Math.max(...part.map(c => c.xb));
      let Wb = 0, Mb = 0, Zb = 0;
      part.forEach(c => { const w = gb * c.n * bx * by / 1e6; Wb += w; Mb += w * ((c.xf + c.xb) / 2 - xt); Zb += w * ((c.z0 + c.z1) / 2 - zb); });
      // soil resting on the steps in front of the virtual back
      let Ws = 0, Ms = 0, Zs = 0;
      const nx = 200, dx = (xv - xt) / nx;
      for (let j = 0; j < nx; j++) {
        const x = xt + (j + 0.5) * dx;
        let m = -1; part.forEach((c, i) => { if (x >= c.xf && x <= c.xb) m = i; });
        const above = part[m + 1];
        if (m < 0 || (above && x < above.xf)) continue;           // air in front of a setback
        const z0 = part[m].z1, h = zs(x) - z0;
        if (h <= 0 || (above && x <= above.xb)) continue;
        const hwet = hw > z0 ? Math.min(h, hw - z0) : 0, w = (gs * (h - hwet) + gsat * hwet) * dx / 1e6; Ws += w; Ms += w * (x - xt); Zs += w * ((z0 + zs(x)) / 2 - zb);
      }
      const tG = thrust(xv, zb, 0, 0), tGQ = thrust(xv, zb, ld.q || 0, 0);
      const PG = tG.P, PQ = Math.max(0, tGQ.P - tG.P), aG = tG.arm, aQ = PQ > 0 ? (tGQ.P * tGQ.arm - PG * aG) / PQ : aG;
      const hr = H + (ld.hr || 0) - zb, xr = top.xf - xt;
      const cd = Math.cos(dlt), sd = Math.sin(dlt), lev = xv - xt;
      // water: hydrostatic on the virtual back, uplift under the bed (trapezoid back → front)
      const hb = Math.max(0, hw - zb), ub = gw * hb / 1e3, uf = gw * Math.max(0, hwf - zb) / 1e3; // kPa
      const Pw = 0.5 * gw * hb * hb / 1e6, aW = hb / 3, U = (ub + uf) / 2 * B / 1e3, xU = ub + uf > 0 ? B * (uf + 2 * ub) / (3 * (uf + ub)) : 0;
      const combos = [];
      const mk = (id, nm, fW, fP, fQ, fH, eq) => {
        let V = fW * (Wb + Ws), Hh = 0, Ms_ = fW * (Mb + Ms), Md = 0, Pe = null;
        if (eq) {
          Pe = thrust(xv, zb, fc.psiE * (ld.q || 0), kh);
          V += Pe.P * sd; Ms_ += Pe.P * sd * lev; Hh += Pe.P * cd + kh * (Wb + Ws); Md += Pe.P * cd * Pe.arm + kh * (Zb + Zs);
        } else {
          V += (fP * PG + fQ * PQ) * sd; Ms_ += (fP * PG + fQ * PQ) * sd * lev;
          Hh += (fP * PG + fQ * PQ) * cd + fH * (ld.Hr || 0);
          Md += fP * PG * cd * aG + fQ * PQ * cd * aQ + fH * (ld.Hr || 0) * hr;
        }
        const fw = eq ? 1 : gW;
        Hh += fw * Pw; Md += fw * (Pw * aW + U * xU); V -= fw * U;
        Ms_ /= 1e3; Md /= 1e3; // kNm/m
        const xR = V > 0 ? (Ms_ - Md) / V * 1e3 : -1, e = B / 2 - xR;
        const fr = k === 0 ? Math.tan(phiB) : muJ, cc = k === 0 ? cB : cJ;
        const Rs = V * fr + cc * B / 1e3;
        const Bp = B - 2 * Math.abs(e), qmax = Bp > 0 ? V / (Bp / 1e3) : Infinity;
        combos.push({ id, nm, V, Hh, Ms: Ms_, Md, xR, e, Rs, qmax, Bp, urOT: Ms_ > 0 ? Md / Ms_ : 99, urSL: Rs > 0 ? Hh / Rs : 99, urB: k === 0 ? qmax / ld.qbear : 0, Pe });
      };
      mk('C1', L('1: 0.8G stab. + 1.25G earth + 1.5Q', '1: 0.8G ต้าน + 1.25G ดิน + 1.5Q'), fc.gGs, fc.gGd, fc.gQ, fc.gQ);
      mk('C2', L('2: 1.25G + 1.5Q (bearing)', '2: 1.25G + 1.5Q (แรงแบกทาน)'), fc.gGd, fc.gGd, fc.gQ, fc.gQ);
      if (kh > 0) mk('E', L('3: G + E + ψ_E·Q', '3: G + E + ψ_E·Q'), 1, 1, 0, 0, true);
      const gov = key => combos.reduce((p, q) => (q[key] > p[key] ? q : p));
      return { k, zb, xt, xh, B, xv, Wb, Ws, Pw, aW, U, ub, uf, PG, PQ, aG, aQ, tG, tGQ, combos, ot: gov('urOT'), sl: gov('urSL'), br: gov('urB') };
    }

    const parts = cs.map((c, k) => portion(k));
    const checks = [], add = (id, name, Ed, Rd, unit, ur) => checks.push({ id, name, Ed, Rd, unit, ur });

    parts.forEach(p => {
      const base = p.k === 0;
      R.sec(base ? L('Base of wall', 'ฐานกำแพง') : L('Bed joint on top of course ', 'รอยต่อบนชั้นที่ ') + p.k + L(' (shear between blocks)', ' (แรงเฉือนระหว่างก้อน)'), base ? 'AS 4678 §5.3, §5.4' : 'AS 4678 §5.3');
      R.eq(L('Level / width', 'ระดับ / ความกว้าง'), 'z, B', f(p.zb, 0) + ', ' + f(p.B, 0), 'mm');
      R.eq(L('Blocks above', 'น้ำหนักก้อนหินด้านบน'), 'W_b', p.Wb, 'kN/m');
      if (p.Ws > 0.01) R.eq(L('Soil on the steps', 'ดินบนขั้น'), 'W_s', p.Ws, 'kN/m');
      R.eq(L('Virtual back', 'ระนาบด้านหลังสมมติ'), L('x_v from toe, height to surface', 'x_v จากปลายหน้า, ความสูงถึงผิวดิน'), f(p.xv - p.xt, 0) + ' mm, ' + f(zs(p.xv) - p.zb, 0) + ' mm', '');
      R.eq('P_a,G', L('Trial wedge, soil weight', 'ลิ่มทดลอง น้ำหนักดิน') + ', ' + L('at ', 'ที่ ') + f(p.aG, 0) + ' mm', p.PG, 'kN/m');
      if (p.PQ > 0.001) R.eq('P_a,Q', L('Extra thrust from the surcharge', 'แรงเพิ่มจากน้ำหนักแผ่') + ', ' + L('at ', 'ที่ ') + f(p.aQ, 0) + ' mm', p.PQ, 'kN/m');
      if (p.Pw > 0.001) R.eq('P_w', L('Water on the virtual back, at ', 'แรงดันน้ำบนระนาบสมมติ ที่ ') + f(p.aW, 0) + ' mm', p.Pw, 'kN/m');
      if (p.U > 0.001) R.eq('U', L('Uplift on the bed, u = ', 'แรงยกใต้รอยต่อ u = ') + f(p.ub, 1) + ' → ' + f(p.uf, 1) + ' kPa', p.U, 'kN/m');
      if ((ld.Hr || 0) > 0) R.eq('H_r', L('Handrail, lever arm', 'ราวกันตก แขนโมเมนต์'), H + ld.hr - p.zb, 'mm');
      p.combos.forEach(c => R.eq(L('Combination ', 'กรณี ') + c.nm, 'V*, H*, M*_stb, M*_dst', f(c.V, 1) + ', ' + f(c.Hh, 1) + ' kN/m; ' + f(c.Ms, 1) + ', ' + f(c.Md, 1) + ' kNm/m', ''));
      const nm = base ? L('Base', 'ฐาน') : L('Joint ', 'รอยต่อ ') + p.k;
      add('ot' + p.k, nm + L(': overturning', ': การพลิกคว่ำ'), p.ot.Md, p.ot.Ms, 'kNm', R.chk(L('Overturning about the toe (', 'การพลิกคว่ำรอบปลายหน้า (') + p.ot.id + ')', p.ot.Md, p.ot.Ms, 'kNm', p.ot.urOT));
      R.eq(L('Resultant from toe', 'ตำแหน่งแรงลัพธ์จากปลายหน้า'), 'x_R = (M*_stb − M*_dst)/V*,  e = B/2 − x_R', f(p.ot.xR, 0) + ' mm, e/B = ' + f(p.ot.e / p.B, 3), '');
      add('sl' + p.k, nm + (base ? L(': sliding', ': การเลื่อนไถล') : L(': shear between blocks', ': แรงเฉือนระหว่างก้อน')), p.sl.Hh, p.sl.Rs, 'kN', R.chk(base ? L('Sliding: H* ≤ V*·tan φ*_b + c*_b·B (', 'การเลื่อนไถล: H* ≤ V*·tan φ*_b + c*_b·B (') + p.sl.id + ')' : L('Joint shear: H* ≤ V*·μ* + c*_j·B (', 'แรงเฉือนรอยต่อ: H* ≤ V*·μ* + c*_j·B (') + p.sl.id + ')', p.sl.Hh, p.sl.Rs, 'kN', p.sl.urSL));
      if (base) {
        R.eq(L('Bearing pressure', 'แรงดันแบกทาน'), 'q* = V*/(B − 2e)  (' + p.br.id + ')', p.br.qmax, 'kPa');
        add('br', L('Base: bearing', 'ฐาน: แรงแบกทาน'), p.br.qmax, ld.qbear, 'kPa', R.chk(L('Bearing', 'แรงแบกทาน'), p.br.qmax, ld.qbear, 'kPa', p.br.urB));
      }
    });
    R.sec(L('Notes', 'หมายเหตุ'), '');
    R.txt(wat ? L('Passive resistance and water pressure on the front face are ignored (conservative). Effective unit weight below the water table in the wedge; total unit weight plus uplift for the wall and the soil on the steps.', 'ไม่คิดแรงต้านพาสซีฟและแรงดันน้ำด้านหน้า (ปลอดภัย) ใช้หน่วยน้ำหนักประสิทธิผลใต้ระดับน้ำในลิ่มดิน และใช้หน่วยน้ำหนักรวมกับแรงยกสำหรับกำแพงและดินบนขั้น') : L('Passive resistance in front of the wall is ignored. The backfill is assumed free-draining with no water pressure — provide drainage behind the wall.', 'ไม่คิดแรงต้านแบบพาสซีฟด้านหน้า สมมติดินถมระบายน้ำได้ดีไม่มีแรงดันน้ำ — ต้องมีระบบระบายน้ำหลังกำแพง'));
    R.txt(L('Overall (global) slope stability, block crushing and settlement are outside this module.', 'เสถียรภาพโดยรวมของลาด การแตกของก้อนหิน และการทรุดตัวอยู่นอกขอบเขต'));
    R.txt(L('Live load on the crest over the blocks is not counted as stabilising. The vertical component of the active thrust (δ on the virtual back) is taken with the same load factor as the thrust.', 'ไม่คิดน้ำหนักจรบนกำแพงเป็นแรงต้าน องค์ประกอบแนวดิ่งของแรงดันดิน (δ ที่ระนาบสมมติ) ใช้ตัวคูณเดียวกับแรงดันดิน'));

    const worst = (key) => parts.slice(1).reduce((p, q) => (!p || q[key][key === 'ot' ? 'urOT' : 'urSL'] > p[key][key === 'ot' ? 'urOT' : 'urSL'] ? q : p), null);
    return { code: 'AS', elem: 'lwall', checks, rep: R, warn: [...new Set(warn)], cs, H, Hs, ds, hw, hwf, wat, parts, zsAt: null, xs0, xc0, beta: s.beta, qa, qb: ld.qext === 'crest' ? xs0 : null, phiD: deg(phiD), dlt: deg(dlt), worstJ: worst('sl'), Lc: g.Lc };
  }

  G.LWALL = { design };
})(typeof window !== 'undefined' ? window : globalThis);
