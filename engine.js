/* SigmaRC calculation engine — RC beam, column, pile cap
   Codes: EN 1992-1-1:2023 (EC2), AS 3600:2018 (AS), Thai EIT strength design / ACI 318-19 (TH)
   Internal units: N, mm, MPa. Compression positive for axial force. */
(function (G) {
  'use strict';
  const ES = 200000;
  const KSC = 0.0980665;   // MPa per ksc
  const TF = 9.80665;      // kN per tonne-force
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sq = Math.sqrt, cbrt = Math.cbrt, PI = Math.PI;
  const barA = d => PI * d * d / 4;

  // ---------------------------------------------------------------- formatting
  function f(v, dp) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    if (dp === undefined) { const a = Math.abs(v); dp = a >= 1000 ? 0 : a >= 100 ? 1 : a >= 10 ? 2 : a >= 1 ? 3 : 4; }
    return v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }

  // Report builder -----------------------------------------------------------
  class Rep {
    constructor(lang) { this.lang = lang; this.secs = []; this.cur = null; }
    L(en, th) { return this.lang === 'th' ? th : en; }
    sec(title, clause) { this.cur = { title, clause, rows: [] }; this.secs.push(this.cur); return this; }
    eq(label, expr, val, unit, note) { this.cur.rows.push({ k: 'eq', label, expr, val, unit: unit || '', note }); return this; }
    txt(t) { this.cur.rows.push({ k: 'txt', t }); return this; }
    chk(label, ed, rd, unit, ur, okText) {
      const u = ur !== undefined ? ur : (rd > 0 ? Math.abs(ed) / rd : 99);
      this.cur.rows.push({ k: 'chk', label, ed, rd, unit, ur: u }); return u;
    }
  }

  // ---------------------------------------------------------------- materials
  const AS_EC = [[20, 24000], [25, 26700], [32, 30100], [40, 32800], [50, 34800], [65, 37400], [80, 39600], [100, 42200]];
  function interp(tab, x) {
    if (x <= tab[0][0]) return tab[0][1];
    for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) {
      const [x0, y0] = tab[i - 1], [x1, y1] = tab[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
    return tab[tab.length - 1][1];
  }

  function material(code, p) {
    const m = { code, fc: +p.fc, fy: +p.fy, fyt: +p.fyt, Es: ES, dg: +p.dg || 20 };
    const fc = m.fc;
    if (code === 'EC2') {
      m.gC = +p.gC || 1.5; m.gS = +p.gS || 1.15; m.ktc = p.ktc !== undefined ? +p.ktc : 1.0;
      m.etacc = Math.min(1, cbrt(40 / fc));
      m.fcd = m.etacc * m.ktc * fc / m.gC;
      m.fyd = m.fy / m.gS; m.fywd = m.fyt / m.gS;
      m.lam = fc <= 50 ? 0.8 : 0.8 - (fc - 50) / 400;
      m.eta = fc <= 50 ? 1.0 : 1.0 - (fc - 50) / 200;
      m.ecu = fc <= 50 ? 0.0035 : (2.6 + 35 * Math.pow((90 - fc) / 100, 4)) / 1000;
      m.sigc = m.eta * m.fcd;
      m.fsd = m.fyd; m.fsvd = m.fywd;
      m.fctm = fc <= 50 ? 0.30 * Math.pow(fc, 2 / 3) : 2.12 * Math.log(1 + (fc + 8) / 10);
      m.Ec = 22000 * Math.pow((fc + 8) / 10, 0.3);
      m.gV = 1.4;
      m.ddg = fc <= 60 ? Math.min(40, 16 + m.dg) : Math.min(40, 16 + m.dg * Math.pow(60 / fc, 4));
      m.creep = p.creep !== undefined ? +p.creep : 2.0;
      m.kt = p.kt !== undefined ? +p.kt : 0.4;
    } else if (code === 'AS') {
      m.alpha2 = Math.max(0.67, 0.85 - 0.0015 * fc);
      m.gamma = Math.max(0.67, 0.97 - 0.0025 * fc);
      m.lam = m.gamma; m.ecu = 0.003; m.sigc = m.alpha2 * fc;
      m.fsd = m.fy; m.fsvd = m.fyt;
      m.fct = 0.6 * sq(fc);
      m.Ec = interp(AS_EC, fc);
      m.alpha1 = clamp(1.0 - 0.003 * fc, 0.72, 0.85);
    } else { // TH (EIT / ACI 318-19 strength design)
      m.beta1 = clamp(0.85 - 0.05 * (fc - 28) / 7, 0.65, 0.85);
      m.lam = m.beta1; m.ecu = 0.003; m.sigc = 0.85 * fc;
      m.fsd = m.fy; m.fsvd = m.fyt;
      m.fr = 0.62 * sq(fc);
      m.Ec = 4700 * sq(fc);
      m.sqfc = Math.min(sq(fc), 8.3);
    }
    m.alphaE = ES / (code === 'EC2' ? m.Ec / (1 + m.creep) : m.Ec);
    return m;
  }

  function phiOf(m, epsT, ku) {
    if (m.code === 'EC2') return 1;
    if (m.code === 'AS') return clamp(1.24 - 13 * ku / 12, 0.65, 0.85);
    const ety = m.fy / ES; return clamp(0.65 + 0.25 * (epsT - ety) / 0.003, 0.65, 0.90);
  }

  // ---------------------------------------------------------------- section
  function makeSection(b, h, bars) {
    const n = 36, nf = n * n, fx = new Float64Array(nf), fy = new Float64Array(nf);
    const dA = (b / n) * (h / n);
    let k = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      fx[k] = -b / 2 + (i + 0.5) * b / n; fy[k] = -h / 2 + (j + 0.5) * h / n; k++;
    }
    const As = bars.reduce((s, r) => s + barA(r.d), 0);
    return { b, h, bars, fx, fy, dA, nf, As, Ag: b * h };
  }

  function stateAt(S, m, c, th) {
    const nx = Math.cos(th), ny = Math.sin(th);
    const smax = S.b / 2 * Math.abs(nx) + S.h / 2 * Math.abs(ny);
    const sna = smax - c, sblk = smax - m.lam * c;
    let N = 0, Mx = 0, My = 0, Cc = 0;
    const sc = m.sigc * S.dA;
    for (let k = 0; k < S.nf; k++) {
      const x = S.fx[k], y = S.fy[k];
      if (x * nx + y * ny >= sblk) { N += sc; Mx += sc * y; My += sc * x; Cc += sc; }
    }
    let minS = Infinity, Fsc = 0, Fst = 0;
    for (const r of S.bars) {
      const s = r.x * nx + r.y * ny;
      const eps = m.ecu * (s - sna) / c;
      let sig = clamp(ES * eps, -m.fsd, m.fsd);
      if (s >= sblk) sig -= m.sigc;
      const F = sig * barA(r.d);
      N += F; Mx += F * r.y; My += F * r.x;
      if (F >= 0) Fsc += F; else Fst += F;
      if (s < minS) minS = s;
    }
    const dt = smax - minS;
    const epsT = -m.ecu * (minS - sna) / c;
    const phi = phiOf(m, epsT, c / dt);
    return { N, Mx, My, phi, epsT, dt, c, Cc, Fsc, Fst, smax };
  }

  function nMax(S, m) {
    const Ac = S.Ag - S.As;
    if (m.code === 'EC2') return m.sigc * Ac + S.As * Math.min(m.fyd, 0.002 * ES);
    if (m.code === 'AS') return 0.65 * (m.alpha1 * m.fc * Ac + S.As * m.fy);
    return 0.80 * 0.65 * (0.85 * m.fc * Ac + m.fy * S.As);
  }
  function nTen(S, m) { const phi = m.code === 'EC2' ? 1 : m.code === 'AS' ? 0.85 : 0.9; return -phi * S.As * m.fsd; }

  // Solve neutral axis depth for a design axial force at angle th
  function solveC(S, m, th, Nt) {
    const smax = S.b / 2 * Math.abs(Math.cos(th)) + S.h / 2 * Math.abs(Math.sin(th));
    let lo = Math.log(smax * 1e-4), hi = Math.log(smax * 80);
    const fN = lc => { const st = stateAt(S, m, Math.exp(lc), th); return st.phi * st.N - Nt; };
    if (fN(lo) > 0 || fN(hi) < 0) return null;
    for (let i = 0; i < 48; i++) { const mid = (lo + hi) / 2; if (fN(mid) > 0) hi = mid; else lo = mid; }
    return stateAt(S, m, Math.exp((lo + hi) / 2), th);
  }

  // Uniaxial interaction curve: th = PI/2 (+Mx), 3PI/2 (-Mx), 0 (+My), PI (-My)
  function uniCurve(S, m, th, axis) {
    const smax = S.b / 2 * Math.abs(Math.cos(th)) + S.h / 2 * Math.abs(Math.sin(th));
    const Nmax = nMax(S, m), pts = [{ N: nTen(S, m), M: 0 }];
    for (let i = 0; i <= 70; i++) {
      const c = smax * 0.004 * Math.pow(10, i * 3.3 / 70);
      const st = stateAt(S, m, c, th);
      const M = Math.abs(axis === 'x' ? st.Mx : st.My) * st.phi, N = st.N * st.phi;
      pts.push({ N, M, c, phi: st.phi });
    }
    pts.sort((a, b) => a.N - b.N);
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.N <= Nmax) out.push(p);
      else { const q = out[out.length - 1]; if (q) { const t = (Nmax - q.N) / (p.N - q.N); out.push({ N: Nmax, M: q.M + t * (p.M - q.M) }); } break; }
    }
    out.push({ N: Nmax, M: 0 });
    return out;
  }
  function mAtN(curve, N) {
    // capacity = max M at this N (the curve is a single-valued M(N) after sort)
    let best = null;
    for (let i = 1; i < curve.length; i++) {
      const a = curve[i - 1], b = curve[i];
      if ((N - a.N) * (N - b.N) <= 0 && a.N !== b.N) { const M = a.M + (b.M - a.M) * (N - a.N) / (b.N - a.N); best = best === null ? M : Math.max(best, M); }
    }
    return best;
  }

  function biaxContour(S, m, N) {
    const pts = [];
    for (let k = 0; k < 72; k++) {
      const th = k * PI / 36, st = solveC(S, m, th, N);
      if (!st) return null;
      pts.push({ Mx: st.Mx * st.phi, My: st.My * st.phi });
    }
    return pts;
  }
  function rayCap(poly, mx, my) {
    const L = Math.hypot(mx, my); if (!poly || L === 0) return null;
    const ux = mx / L, uy = my / L; let best = null;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const ex = q.Mx - p.Mx, ey = q.My - p.My;
      const den = ux * ey - uy * ex; if (Math.abs(den) < 1e-12) continue;
      const s = (p.Mx * ey - p.My * ex) / den, t = (p.Mx * uy - p.My * ux) / den;
      if (s > 0 && t >= -1e-9 && t <= 1 + 1e-9) best = best === null ? s : Math.max(best, s);
    }
    return best;
  }

  // ---------------------------------------------------------------- layouts
  function layoutBeam(g) {
    const bars = [], cl = g.cover + g.linkD;
    const rowsY = (rows, top) => {
      let off = 0, prev = 0; const ys = [];
      rows.forEach((r, i) => {
        if (i > 0) off += prev / 2 + Math.max(25, prev, r.d, g.dg + 5) + r.d / 2; else off = r.d / 2;
        prev = r.d; ys.push(top ? g.h / 2 - cl - off : -g.h / 2 + cl + off);
      });
      return ys;
    };
    const place = (rows, ys, grp) => rows.forEach((r, i) => {
      const n = Math.max(0, r.n | 0); if (!n) return;
      const x0 = -g.b / 2 + cl + r.d / 2, x1 = g.b / 2 - cl - r.d / 2;
      for (let k = 0; k < n; k++) bars.push({ x: n === 1 ? 0 : x0 + (x1 - x0) * k / (n - 1), y: ys[i], d: r.d, g: grp + (i + 1) });
    });
    const yt = rowsY(g.top, true), yb = rowsY(g.bot, false);
    place(g.top, yt, 'T'); place(g.bot, yb, 'B');
    const ns = g.side.n | 0;
    if (ns > 0) {
      const yTop = yt.length ? yt[yt.length - 1] : g.h / 2 - cl, yBot = yb.length ? yb[yb.length - 1] : -g.h / 2 + cl;
      const xs = g.b / 2 - cl - g.side.d / 2;
      for (let k = 1; k <= ns; k++) {
        const y = yTop + (yBot - yTop) * k / (ns + 1);
        bars.push({ x: -xs, y, d: g.side.d, g: 'S' }); bars.push({ x: xs, y, d: g.side.d, g: 'S' });
      }
    }
    return bars;
  }
  function layoutColumn(g) {
    const bars = [], cl = g.cover + g.linkD;
    const xc = g.b / 2 - cl - g.dc / 2, yc = g.h / 2 - cl - g.dc / 2;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => bars.push({ x: sx * xc, y: sy * yc, d: g.dc, g: 'C' }));
    const nb = Math.max(0, (g.nb | 0) - 2), nh = Math.max(0, (g.nh | 0) - 2);
    for (let k = 1; k <= nb; k++) { const x = -xc + 2 * xc * k / (nb + 1); bars.push({ x, y: yc, d: g.dm, g: 'M' }); bars.push({ x, y: -yc, d: g.dm, g: 'M' }); }
    for (let k = 1; k <= nh; k++) { const y = -yc + 2 * yc * k / (nh + 1); bars.push({ x: xc, y, d: g.dm, g: 'M' }); bars.push({ x: -xc, y, d: g.dm, g: 'M' }); }
    return bars;
  }

  function minClear(m, d) {
    if (m.code === 'EC2') return Math.max(d, m.dg + 5, 20);
    if (m.code === 'AS') return Math.max(d, 1.5 * m.dg, 25);
    return Math.max(25, d, 4 / 3 * m.dg);
  }

  // ---------------------------------------------------------------- shear
  function shearDesign(m, R, o) {
    // o: {V (N), bw, d, h, Asw, s, rhoL, dir}
    const { V, bw, d, h, Asw, s, rhoL } = o; const V_abs = Math.abs(V);
    const L = (a, b) => R.L(a, b);
    const res = { V: V_abs };
    if (m.code === 'EC2') {
      const z = 0.9 * d, fck = m.fc;
      R.eq(L('Lever arm', 'แขนโมเมนต์'), 'z = 0.9·d = 0.9 × ' + f(d, 0), z, 'mm');
      R.eq(L('Design shear stress', 'หน่วยแรงเฉือน'), 'τ_Ed = V_Ed / (b_w·z)', V_abs / (bw * z), 'MPa');
      const tmin = 11 / m.gV * sq(fck / m.fyd * m.ddg / d);
      const tc = 0.66 / m.gV * cbrt(100 * rhoL * fck * m.ddg / d);
      const tRdc = Math.max(tc, tmin);
      R.eq('d_dg', 'd_dg = 16 + D_lower ≤ 40', m.ddg, 'mm');
      R.eq('ρ_l', 'ρ_l = A_sl / (b_w·d)', rhoL, '');
      R.eq('τ_Rdc,min', 'τ_Rdc,min = (11/γ_V)·√(f_ck/f_yd · d_dg/d)', tmin, 'MPa', '(8.20)');
      R.eq('τ_Rd,c', 'τ_Rd,c = (0.66/γ_V)·(100·ρ_l·f_ck·d_dg/d)^{1/3} ≥ τ_Rdc,min', tRdc, 'MPa', '(8.27)');
      const VRdc = tRdc * bw * z;
      const tEd = V_abs / (bw * z), nu = 0.5;
      const K = nu * m.fcd / Math.max(tEd, 1e-9);
      let cot = 2.5, crush = false;
      if (K < 2) { cot = 1; crush = true; } else cot = Math.min(2.5, (K + sq(K * K - 4)) / 2);
      const rw = Asw / (bw * s);
      const cotBal = rw > 0 ? sq(Math.max(0, nu * m.fcd / (rw * m.fywd) - 1)) : 2.5; // balances τ_Rd,s = τ_Rd,max
      cot = clamp(Math.min(cot, cotBal), 1, 2.5);
      const tRds = rw * m.fywd * cot;
      const tRdmax = nu * m.fcd / (cot + 1 / cot);
      R.eq('cot θ', L('1.0 ≤ cot θ ≤ 2.5, chosen to maximise V_Rd while τ_Ed ≤ τ_Rd,max', '1.0 ≤ cot θ ≤ 2.5'), cot, '');
      R.eq('ρ_w', 'ρ_w = A_sw / (b_w·s) = ' + f(Asw, 0) + ' / (' + f(bw, 0) + ' × ' + f(s, 0) + ')', rw, '');
      R.eq('τ_Rd,s', 'τ_Rd,s = ρ_w·f_ywd·cot θ', tRds, 'MPa', '(8.35)');
      R.eq('τ_Rd,max', 'τ_Rd,max = ν·f_cd / (cot θ + tan θ),  ν = 0.5', tRdmax, 'MPa', '(8.38)');
      const tRd = Math.min(Math.max(tRdc, tRds), tRdmax);
      const VRd = tRd * bw * z;
      R.eq('V_Rd', 'V_Rd = min(max(τ_Rd,c, τ_Rd,s), τ_Rd,max)·b_w·z', VRd / 1e3, 'kN');
      const rwmin = 0.08 * sq(fck) / m.fyt;
      const qreq = Math.max(tEd > tRdc ? tEd * bw / (m.fywd * cot) : 0, rwmin * bw);
      R.eq('ρ_w,min', 'ρ_w,min = 0.08·√f_ck / f_yk', rwmin, '', '§12.2');
      Object.assign(res, { VRd, VRdc, VRdmax: tRdmax * bw * z, cot, z, qreq, crush, rwmin, rw });
    } else if (m.code === 'AS') {
      const dv = Math.max(0.72 * h, 0.9 * d), rf = Math.min(sq(m.fc), 8);
      const Asvmin = 0.08 * sq(m.fc) * bw * s / m.fyt;
      const kv = Asw >= Asvmin ? 0.15 : Math.min(0.10, 200 / (1000 + 1.3 * dv));
      const cot = 1 / Math.tan(36 * PI / 180);
      R.eq('d_v', 'd_v = max(0.72·D, 0.9·d)', dv, 'mm', '§8.2.1.9');
      R.eq('A_sv,min', 'A_sv,min = 0.08·√f\'c·b_v·s / f_sy.f', Asvmin, 'mm²', '§8.2.1.7');
      R.eq('k_v', Asw >= Asvmin ? 'A_sv ≥ A_sv,min → k_v = 0.15' : 'k_v = 200/(1000 + 1.3·d_v) ≤ 0.10', kv, '', '§8.2.4.3');
      R.eq('θ_v', L('Simplified method', 'วิธีอย่างง่าย'), 36, '°');
      const Vuc = kv * bw * dv * rf, Vus = Asw * m.fyt * dv * cot / s;
      const Vumax = 0.55 * m.fc * bw * dv * cot / (1 + cot * cot);
      R.eq('V_uc', 'V_uc = k_v·b_v·d_v·√f\'c', Vuc / 1e3, 'kN', '(8.2.4.1)');
      R.eq('V_us', 'V_us = (A_sv·f_sy.f·d_v / s)·cot θ_v', Vus / 1e3, 'kN', '(8.2.5.2)');
      R.eq('V_u.max', 'V_u.max = 0.55·f\'c·b_v·d_v·cot θ_v/(1 + cot²θ_v)', Vumax / 1e3, 'kN', '(8.2.6.1)');
      const VRd = 0.75 * Math.min(Vuc + Vus, Vumax);
      R.eq('φV_u', 'φV_u = 0.75·min(V_uc + V_us, V_u.max)', VRd / 1e3, 'kN');
      const qreq = Math.max((V_abs / 0.75 - Vuc) > 0 ? (V_abs / 0.75 - Vuc) / (m.fyt * dv * cot) : 0, 0.08 * sq(m.fc) * bw / m.fyt);
      Object.assign(res, { VRd, VRdc: 0.75 * Vuc, VRdmax: 0.75 * Vumax, cot, z: dv, dv, qreq, kv });
    } else {
      const rf = m.sqfc, Avmin = Math.max(0.062 * sq(m.fc), 0.35) * bw * s / m.fyt;
      const lams = Math.min(1, sq(2 / (1 + 0.004 * d)));
      let Vc;
      R.eq('A_v,min', 'A_v,min = max(0.062√f\'c, 0.35)·b_w·s / f_yt', Avmin, 'mm²', '9.6.3.4');
      if (Asw >= Avmin) {
        Vc = 0.17 * rf * bw * d;
        R.eq('V_c', L('A_v ≥ A_v,min → V_c = 0.17·λ·√f\'c·b_w·d', 'A_v ≥ A_v,min → V_c = 0.17·λ·√f\'c·b_w·d'), Vc / 1e3, 'kN', 'Table 22.5.5.1(a)');
      } else {
        Vc = 0.66 * lams * cbrt(rhoL) * rf * bw * d;
        R.eq('λ_s', 'λ_s = √(2/(1 + 0.004·d)) ≤ 1', lams, '', '22.5.5.1.3');
        R.eq('V_c', 'V_c = 0.66·λ_s·λ·(ρ_w)^{1/3}·√f\'c·b_w·d', Vc / 1e3, 'kN', 'Table 22.5.5.1(c)');
      }
      const Vs = Math.min(Asw * m.fyt * d / s, 0.66 * rf * bw * d);
      R.eq('V_s', 'V_s = A_v·f_yt·d / s ≤ 0.66√f\'c·b_w·d', Vs / 1e3, 'kN', '22.5.8.5.3');
      const VRd = 0.75 * (Vc + Vs);
      R.eq('φV_n', 'φV_n = 0.75·(V_c + V_s)', VRd / 1e3, 'kN', '21.2.1');
      const qreq = Math.max(V_abs / 0.75 > Vc ? (V_abs / 0.75 - Vc) / (m.fyt * d) : 0, Math.max(0.062 * sq(m.fc), 0.35) * bw / m.fyt);
      Object.assign(res, { VRd, VRdc: 0.75 * Vc, VRdmax: 0.75 * (Vc + 0.66 * rf * bw * d), cot: 1, z: d, qreq, Vc });
    }
    return res;
  }

  // ---------------------------------------------------------------- torsion
  function torsionDesign(m, R, o) {
    // o: {T, V, b, h, c (cover to link), dl (link dia), dbar, shear (result), Aleg, s}
    const { T, b, h, c, dl, dbar, sh } = o; const Ta = Math.abs(T);
    const L = (a, bb) => R.L(a, bb);
    const out = { T: Ta };
    if (m.code === 'EC2') {
      const A = b * h, u = 2 * (b + h), a = c + dl + dbar / 2;
      const tef = Math.max(A / u, 2 * a);
      const Ak = (b - tef) * (h - tef), uk = 2 * (b - tef + h - tef);
      const cot = sh.cot, th = Math.atan(1 / cot), nu = 0.5;
      const TRdmax = 2 * nu * m.fcd * Ak * tef * Math.sin(th) * Math.cos(th);
      R.eq('t_ef', 't_ef = max(A/u, 2·a)', tef, 'mm', '§8.3.2');
      R.eq('A_k', 'A_k = (b − t_ef)(h − t_ef)', Ak, 'mm²');
      R.eq('u_k', 'u_k = 2(b + h − 2t_ef)', uk, 'mm');
      R.eq('T_Rd,max', 'T_Rd,max = 2ν·f_cd·A_k·t_ef·sin θ·cos θ', TRdmax / 1e6, 'kNm');
      const At = Ta / (2 * Ak * m.fywd * cot), Asl = Ta * uk * cot / (2 * Ak * m.fyd);
      R.eq('A_t/s', 'A_t/s = T_Ed / (2·A_k·f_ywd·cot θ)', At, 'mm²/mm');
      R.eq('A_sl', 'A_sl = T_Ed·u_k·cot θ / (2·A_k·f_yd)', Asl, 'mm²');
      const inter = Ta / TRdmax + sh.V / sh.VRdmax;
      Object.assign(out, { cap: TRdmax, At, Asl, inter, interExpr: 'T_Ed/T_Rd,max + V_Ed/V_Rd,max' });
    } else if (m.code === 'AS') {
      const x = Math.min(b, h), y = Math.max(b, h), Jt = 0.33 * x * x * y;
      const At = (b - 2 * c - dl) * (h - 2 * c - dl), ut = 2 * (b - 2 * c - dl + h - 2 * c - dl);
      const cot = sh.cot, Tumax = 0.2 * m.fc * Jt, Tuc = Jt * 0.3 * sq(m.fc);
      R.eq('J_t', 'J_t = 0.33·x²·y', Jt, 'mm³', '§8.3.3');
      R.eq('A_t', 'A_t = area within torsion link centreline', At, 'mm²');
      R.eq('φT_u.max', 'φT_u.max = 0.7·0.2·f\'c·J_t', 0.7 * Tumax / 1e6, 'kNm', '§8.3.3');
      R.eq('φT_uc', 'φT_uc = 0.7·J_t·0.3·√f\'c', 0.7 * Tuc / 1e6, 'kNm', '§8.3.5');
      const need = Ta >= 0.25 * 0.7 * Tuc;
      if (!need) R.txt(L('T* < 0.25φT_uc — torsion reinforcement not required (§8.3.4).', 'T* < 0.25φT_uc — ไม่ต้องเสริมเหล็กรับแรงบิด'));
      const Atq = need ? Ta / (0.7 * m.fyt * 2 * At * cot) : 0;
      const Asl = need ? (Ta / 0.7) * ut * cot / (2 * At * m.fy) : 0;
      R.eq('A_sw/s', 'A_sw/s = T* / (φ·f_sy.f·2A_t·cot θ_t)', Atq, 'mm²/mm', '§8.3.5');
      R.eq('A_l', 'A_l = (T*/φ)·u_t·cot θ_t / (2A_t·f_sy)', Asl, 'mm²', '§8.3.6');
      const inter = Ta / (0.7 * Tumax) + sh.V / sh.VRdmax;
      Object.assign(out, { cap: 0.7 * Tumax, At: Atq, Asl, inter, interExpr: 'T*/φT_u.max + V*/φV_u.max' });
    } else {
      const Acp = b * h, pcp = 2 * (b + h), x1 = b - 2 * c - dl, y1 = h - 2 * c - dl;
      const Aoh = x1 * y1, ph = 2 * (x1 + y1), Ao = 0.85 * Aoh, rf = m.sqfc;
      const Tth = 0.083 * rf * Acp * Acp / pcp, Tcr = 4 * Tth;
      R.eq('T_th', 'T_th = 0.083·λ·√f\'c·A_cp² / p_cp', Tth / 1e6, 'kNm', '22.7.4.1');
      R.eq('A_oh', 'A_oh = x₁·y₁', Aoh, 'mm²'); R.eq('p_h', 'p_h = 2(x₁ + y₁)', ph, 'mm');
      const need = Ta >= 0.75 * Tth;
      if (!need) R.txt(L('T_u < φT_th — torsion may be neglected (9.5.4.1).', 'T_u < φT_th — ไม่ต้องพิจารณาแรงบิด'));
      const At = need ? Ta / (0.75 * 2 * Ao * m.fyt) : 0;
      const Al = At * ph * (m.fyt / m.fy);
      R.eq('A_t/s', 'A_t/s = T_u / (φ·2A_o·f_yt·cot 45°)', At, 'mm²/mm', '22.7.6.1');
      R.eq('A_l', 'A_l = (A_t/s)·p_h·(f_yt/f_y)·cot²θ', Al, 'mm²', '22.7.6.1');
      const bw = b, d = sh.z;
      const lhs = sq(Math.pow(sh.V / (bw * d), 2) + Math.pow(Ta * ph / (1.7 * Aoh * Aoh), 2));
      const rhs = 0.75 * ((sh.Vc || 0) / (bw * d) + 0.66 * rf);
      R.eq(L('Section limit', 'ขีดจำกัดหน้าตัด'), '√[(V_u/b_w d)² + (T_u p_h/1.7A_oh²)²] ≤ φ(V_c/b_w d + 0.66√f\'c)', lhs, 'MPa', '22.7.7.1');
      Object.assign(out, { cap: 0.75 * Tcr, At, Asl: Al, inter: lhs / rhs, interExpr: L('section adequacy ratio', 'อัตราส่วนความพอเพียงหน้าตัด') });
    }
    return out;
  }

  // ---------------------------------------------------------------- SLS elastic cracked section (major axis)
  function crackedElastic(S, aE, sag) {
    // depth measured from compression face
    const top = S.h / 2, bars = S.bars.map(r => ({ dd: sag ? top - r.y : r.y + top, A: barA(r.d), d: r.d }));
    const F = x => S.b * x * x / 2 + bars.reduce((s, r) => s + (r.dd < x ? (aE - 1) * r.A * (x - r.dd) : -aE * r.A * (r.dd - x)), 0);
    let lo = 1e-3, hi = S.h;
    for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (F(mid) > 0) hi = mid; else lo = mid; }
    const x = (lo + hi) / 2;
    const I = S.b * x * x * x / 3 + bars.reduce((s, r) => s + (r.dd < x ? (aE - 1) : aE) * r.A * (r.dd - x) * (r.dd - x), 0);
    const ten = bars.filter(r => r.dd > x);
    const dmax = ten.length ? Math.max(...ten.map(r => r.dd)) : S.h;
    const AsT = ten.filter(r => r.dd > S.h / 2).reduce((s, r) => s + r.A, 0);
    const dcen = AsT > 0 ? ten.filter(r => r.dd > S.h / 2).reduce((s, r) => s + r.A * r.dd, 0) / AsT : dmax;
    const phiMax = ten.length ? Math.max(...ten.map(r => r.d)) : 0;
    return { x, I, dmax, dcen, AsT, phiMax };
  }

  // ---------------------------------------------------------------- BEAM
  function designBeam(code, inp, lang) {
    const R = new Rep(lang), L = (a, b) => R.L(a, b);
    const m = material(code, inp.mat);
    const g = inp.geo;
    const bars = layoutBeam({ b: g.b, h: g.h, cover: g.cover, linkD: g.linkD, dg: m.dg, top: inp.top, bot: inp.bot, side: inp.side });
    const S = makeSection(g.b, g.h, bars);
    const A = inp.act; // kN, kNm
    const checks = [];
    const add = (id, name, Ed, Rd, unit, ur, clause, note) => checks.push({ id, name, Ed, Rd, unit, ur: ur !== undefined ? ur : (Rd > 0 ? Math.abs(Ed) / Rd : 99), clause, note });

    // Materials
    R.sec(L('Materials & design strengths', 'วัสดุและกำลังออกแบบ'), code === 'EC2' ? '§5.1, §5.2' : code === 'AS' ? '§3.1, §3.2, §8.1.3' : '19.2, 20.2, 22.2');
    materialRows(R, m, lang);

    // Section
    R.sec(L('Section & reinforcement', 'หน้าตัดและเหล็กเสริม'), '');
    R.eq('b × h', L('Section size', 'ขนาดหน้าตัด'), g.b + ' × ' + g.h, 'mm');
    R.eq('c_nom', L('Cover to link', 'ระยะหุ้มถึงเหล็กปลอก'), g.cover, 'mm');
    const grp = {};
    bars.forEach(r => { const k = r.g[0]; grp[k] = grp[k] || { n: 0, A: 0, list: {} }; grp[k].n++; grp[k].A += barA(r.d); grp[k].list[r.d] = (grp[k].list[r.d] || 0) + 1; });
    const nm = { T: L('Top bars', 'เหล็กบน'), B: L('Bottom bars', 'เหล็กล่าง'), S: L('Side bars', 'เหล็กข้าง') };
    Object.keys(grp).forEach(k => R.eq(nm[k], Object.entries(grp[k].list).map(([d, n]) => n + barName(code, +d)).join(' + '), grp[k].A, 'mm²'));
    const legs = 2 + (g.innerN | 0); // outer closed link (2 legs) + single-leg links (1 leg each, vertical)
    const Asw = 2 * barA(g.linkD) + (g.innerN | 0) * barA(g.innerD || g.linkD), AswX = 2 * barA(g.linkD);
    R.eq(L('Shear links', 'เหล็กปลอก'), linkName(code, g.linkD, g.s) + (g.innerN ? ' + ' + g.innerN + '×' + L('single-leg ', 'ปลอกขาเดี่ยว ') + barName(code, g.innerD) : '') + ' (' + legs + ' ' + L('legs', 'ขา') + ')', Asw, 'mm²');

    // Flexure major axis
    const Mx = (+A.Mx || 0) * 1e6, My = (+A.My || 0) * 1e6;
    const flex = (th, axis, M, label, clause) => {
      const st = solveC(S, m, th, 0);
      R.sec(label, clause);
      if (!st) { R.txt(L('No equilibrium found — check reinforcement.', 'ไม่พบสมดุล — ตรวจสอบเหล็กเสริม')); return { Rd: 0, st: null }; }
      const Mr = Math.abs(axis === 'x' ? st.Mx : st.My), Md = Mr * st.phi;
      blockRows(R, m, lang);
      R.eq(L('Neutral axis depth', 'ระยะแกนสะเทิน'), 'x  (ΣF = 0, ' + L('strain compatibility', 'ความเข้ากันได้ของความเครียด') + ')', st.c, 'mm');
      R.eq('C_c', L('Concrete compression', 'แรงอัดคอนกรีต') + (code === 'EC2' ? ' = η·f_cd·A_c,block' : code === 'AS' ? ' = α₂·f\'c·A_c,block' : ' = 0.85·f\'c·A_c,block'), st.Cc / 1e3, 'kN');
      R.eq('ΣF_s,c', L('Steel in compression', 'เหล็กรับแรงอัด'), st.Fsc / 1e3, 'kN');
      R.eq('ΣF_s,t', L('Steel in tension', 'เหล็กรับแรงดึง'), st.Fst / 1e3, 'kN');
      R.eq('ε_s', L('Strain in extreme tension bar', 'ความเครียดเหล็กดึงนอกสุด'), st.epsT, '');
      if (code === 'AS') { R.eq('k_uo', 'k_uo = x/d_o', st.c / st.dt, '', '§8.1.5'); R.eq('φ', 'φ = 1.24 − 13k_uo/12  (0.65 ≤ φ ≤ 0.85)', st.phi, '', 'Table 2.2.2'); }
      if (code === 'TH') { R.eq('φ', L('Strain-based φ (tension-controlled 0.90)', 'ตัวคูณลดกำลังตามความเครียด (ควบคุมด้วยแรงดึง 0.90)'), st.phi, '', '21.2.2'); }
      R.eq(code === 'EC2' ? 'M_Rd' : code === 'AS' ? 'φM_u' : 'φM_n', L('Design moment capacity', 'กำลังรับโมเมนต์ออกแบบ'), Md / 1e6, 'kNm');
      const ur = R.chk(L('Moment', 'โมเมนต์'), M / 1e6, Md / 1e6, 'kNm');
      if (code === 'AS' && st.c / st.dt > 0.36) R.txt(L('k_uo > 0.36: add compression steel or deepen section for ductility (§8.1.5).', 'k_uo > 0.36: เพิ่มเหล็กรับแรงอัดหรือเพิ่มความลึกหน้าตัดเพื่อความเหนียว (§8.1.5)'));
      if (code === 'TH' && st.epsT < 0.004) R.txt(L('ε_t < 0.004 — beam ductility limit not met (ACI 9.3.3.1).', 'ε_t < 0.004 — ไม่ผ่านข้อกำหนดความเหนียวของคาน (ACI 9.3.3.1)'));
      return { Rd: Md, st, ur };
    };
    const fxM = flex(Mx >= 0 ? PI / 2 : 3 * PI / 2, 'x', Mx, L('Flexure — major axis ', 'การดัด — แกนหลัก ') + (Mx >= 0 ? L('(sagging)', '(โมเมนต์บวก)') : L('(hogging)', '(โมเมนต์ลบ)')), code === 'EC2' ? '§8.1' : code === 'AS' ? '§8.1' : '22.2, 22.3');
    add('Mx', L('Bending major M_x', 'โมเมนต์แกนหลัก M_x'), Mx / 1e6, fxM.Rd / 1e6, 'kNm', undefined, code === 'EC2' ? '§8.1' : code === 'AS' ? '§8.1' : '22.3');
    let fyM = null;
    if (My !== 0) {
      fyM = flex(My >= 0 ? 0 : PI, 'y', My, L('Flexure — minor axis', 'การดัด — แกนรอง'), code === 'EC2' ? '§8.1' : code === 'AS' ? '§8.1' : '22.3');
      add('My', L('Bending minor M_y', 'โมเมนต์แกนรอง M_y'), My / 1e6, fyM.Rd / 1e6, 'kNm');
      R.sec(L('Biaxial bending — linear interaction', 'การดัดสองแกน — ปฏิสัมพันธ์เชิงเส้น'), code === 'EC2' ? '§8.1' : code === 'AS' ? '§8.1' : '22.3');
      R.txt(L('Beam biaxial bending checked conservatively with a linear interaction of the uniaxial resistances.', 'ตรวจการดัดสองแกนของคานแบบอนุรักษ์ด้วยผลรวมเชิงเส้นของกำลังแต่ละแกน'));
      const inter = Math.abs(Mx) / Math.max(fxM.Rd, 1) + Math.abs(My) / Math.max(fyM.Rd, 1);
      R.eq(L('Interaction', 'ปฏิสัมพันธ์'), '|M_x,Ed|/M_Rd,x + |M_y,Ed|/M_Rd,y', inter, '');
      const ur = R.chk(L('Biaxial bending', 'การดัดสองแกน'), inter, 1, '', inter);
      add('Mxy', L('Biaxial bending (linear)', 'การดัดสองแกน (เชิงเส้น)'), inter, 1, '', ur);
    }

    // Longitudinal reinforcement limits
    const sag = Mx >= 0;
    const ce = crackedElastic(S, 1, sag); // for d & As tension
    const d = ce.dcen, AsT = ce.AsT;
    R.sec(L('Longitudinal reinforcement limits', 'ปริมาณเหล็กเสริมตามยาว'), code === 'EC2' ? '§12.2' : code === 'AS' ? '§8.1.6.1' : '9.6.1');
    let Asmin;
    if (code === 'EC2') { Asmin = Math.max(0.26 * m.fctm / m.fy, 0.0013) * g.b * d; R.eq('A_s,min', 'A_s,min = max(0.26·f_ctm/f_yk, 0.0013)·b·d', Asmin, 'mm²'); }
    else if (code === 'AS') { Asmin = 0.20 * Math.pow(g.h / d, 2) * m.fct / m.fy * g.b * d; R.eq('A_st,min', 'A_st,min = 0.20·(D/d)²·(f\'ct.f/f_sy)·b·d', Asmin, 'mm²'); }
    else { Asmin = Math.max(0.25 * sq(m.fc) / m.fy, 1.4 / m.fy) * g.b * d; R.eq('A_s,min', 'A_s,min = max(0.25√f\'c/f_y, 1.4/f_y)·b_w·d', Asmin, 'mm²'); }
    R.eq('d', L('Effective depth (tension steel centroid)', 'ความลึกประสิทธิผล'), d, 'mm');
    const urMin = AsT > 0 ? Asmin / AsT : 99;
    R.chk(L('Minimum tension steel', 'เหล็กรับแรงดึงน้อยสุด'), Asmin, AsT, 'mm²', urMin);
    add('Asmin', L('Min. tension steel', 'เหล็กดึงน้อยสุด'), Asmin, AsT, 'mm²', urMin);
    const Asmax = 0.04 * g.b * g.h;
    add('Asmax', L('Max. total steel 4%', 'เหล็กรวมมากสุด 4%'), S.As, Asmax, 'mm²');

    // bar spacing
    R.sec(L('Bar spacing', 'ระยะห่างเหล็กเสริม'), code === 'EC2' ? '§11.2' : code === 'AS' ? '§8.1.9' : '25.2.1');
    let worst = 1e9, need = 0;
    [...inp.top, ...inp.bot].forEach(r => {
      if ((r.n | 0) < 2) return;
      const cl = (g.b - 2 * (g.cover + g.linkD) - r.n * r.d) / (r.n - 1);
      const req = minClear(m, r.d);
      if (cl / req < worst / Math.max(need, 1) || worst === 1e9) { worst = cl; need = req; }
    });
    if (worst < 1e9) {
      R.eq(L('Clear spacing (governing row)', 'ระยะช่องว่าง (แถววิกฤต)'), 's_clear', worst, 'mm');
      R.eq(L('Minimum clear spacing', 'ระยะช่องว่างน้อยสุด'), code === 'EC2' ? 'max(φ, d_g + 5, 20)' : code === 'AS' ? 'max(d_b, 1.5·d_g, 25)' : 'max(25, d_b, 4/3·d_agg)', need, 'mm');
      const u = need / Math.max(worst, 1e-6);
      R.chk(L('Clear spacing', 'ระยะช่องว่าง'), need, worst, 'mm', u);
      add('sp', L('Bar clear spacing', 'ระยะช่องว่างเหล็ก'), need, worst, 'mm', u);
    }

    // Shear major
    const shearAxis = (V, bw, dd, hh, rho, lbl, id) => {
      R.sec(lbl, code === 'EC2' ? '§8.2' : code === 'AS' ? '§8.2' : '22.5');
      const aw = id === 'Vx' ? AswX : Asw;
      if (id === 'Vx' && AswX !== Asw) R.txt(L('Single-leg links act in the major direction only; minor-axis shear uses the two horizontal legs of the outer link.', 'ปลอกขาเดี่ยวรับแรงเฉือนแกนหลักเท่านั้น แรงเฉือนแกนรองใช้ขานอนสองขาของปลอกนอก'));
      const r = shearDesign(m, R, { V, bw, d: dd, h: hh, Asw: aw, s: g.s, rhoL: rho });
      const ur = R.chk(L('Shear', 'แรงเฉือน'), Math.abs(V) / 1e3, r.VRd / 1e3, 'kN');
      add(id, lbl, Math.abs(V) / 1e3, r.VRd / 1e3, 'kN', ur);
      return r;
    };
    const Vy = (+A.Vy || 0) * 1e3, Vx = (+A.Vx || 0) * 1e3, T = (+A.T || 0) * 1e6;
    const rhoMaj = Math.min(0.02, AsT / (g.b * d));
    const shY = shearAxis(Vy, g.b, d, g.h, rhoMaj, L('Shear — major axis V_y', 'แรงเฉือน — แกนหลัก V_y'), 'Vy');
    let shX = null;
    if (Vx !== 0) {
      const dmin = g.b - g.cover - g.linkD - (inp.side.n ? inp.side.d : Math.max(...inp.top.map(r => r.d), 16)) / 2;
      const AsS = bars.filter(r => r.x > 0).reduce((s, r) => s + barA(r.d), 0);
      shX = shearAxis(Vx, g.h, dmin, g.b, Math.min(0.02, AsS / (g.h * dmin)), L('Shear — minor axis V_x', 'แรงเฉือน — แกนรอง V_x'), 'Vx');
      const inter = Math.pow(Math.abs(Vy) / shY.VRd, 2) + Math.pow(Math.abs(Vx) / shX.VRd, 2);
      add('Vxy', L('Biaxial shear (V_y/V_Rd,y)² + (V_x/V_Rd,x)²', 'แรงเฉือนสองแกน'), inter, 1, '', inter);
    }

    // Torsion & combined link design
    let tor = null;
    const Aleg = barA(g.linkD);
    if (T !== 0) {
      R.sec(L('Torsion', 'แรงบิด'), code === 'EC2' ? '§8.3' : code === 'AS' ? '§8.3' : '22.7');
      tor = torsionDesign(m, R, { T, b: g.b, h: g.h, c: g.cover, dl: g.linkD, dbar: Math.max(...bars.map(r => r.d)), sh: shY });
      const ur = R.chk(L('Torsion crushing / section', 'การอัดแตกจากแรงบิด / หน้าตัด'), tor.inter, 1, '', tor.inter);
      add('T', L('Torsion + shear (concrete)', 'แรงบิด + แรงเฉือน (คอนกรีต)'), tor.inter, 1, '', ur);
      const AsLong = S.As - (Math.abs(Mx) > 0 && fxM.st ? Math.min(AsT, AsT * Math.abs(Mx) / Math.max(fxM.Rd, 1)) : 0);
      const u2 = tor.Asl / Math.max(AsLong, 1);
      R.chk(L('Longitudinal torsion steel (spare area)', 'เหล็กยืนรับแรงบิด (พื้นที่เหลือ)'), tor.Asl, AsLong, 'mm²', u2);
      add('Tl', L('Torsion longitudinal steel', 'เหล็กยืนรับแรงบิด'), tor.Asl, AsLong, 'mm²', u2);
    }
    R.sec(L('Shear links — combined requirement', 'เหล็กปลอก — ความต้องการรวม'), code === 'EC2' ? '§8.2.3, §8.3' : code === 'AS' ? '§8.2.5, §8.3.5' : '22.5.8, 22.7.6');
    const qShear = shY.qreq / legs;
    const qT = tor ? tor.At : 0;
    const qProv = Aleg / g.s;
    R.eq(L('Shear demand per leg', 'ความต้องการเฉือนต่อขา'), '(A_sw/s)_V / n_legs', qShear, 'mm²/mm');
    if (tor) R.eq(L('Torsion demand, outer leg', 'ความต้องการบิด ขานอก'), 'A_t/s', qT, 'mm²/mm');
    R.eq(L('Provided outer leg', 'ขานอกที่ใส่'), 'A_leg / s = ' + f(Aleg, 1) + ' / ' + f(g.s, 0), qProv, 'mm²/mm');
    const ul = R.chk(L('Outer link leg', 'ขาปลอกนอก'), qShear + qT, qProv, 'mm²/mm');
    add('link', L('Outer link (V + T)', 'เหล็กปลอกนอก (V + T)'), (qShear + qT) * 1000, qProv * 1000, 'mm²/m', ul);
    const smax = code === 'EC2' ? Math.min(0.75 * d, 600) : code === 'AS' ? Math.min(0.5 * g.h, 300) : Math.min(d / 2, 600);
    R.eq(L('Maximum link spacing', 'ระยะเรียงปลอกมากสุด'), code === 'EC2' ? 's_max = 0.75·d ≤ 600' : code === 'AS' ? 's_max = min(0.5D, 300)' : 's_max = min(d/2, 600)', smax, 'mm');
    const us = g.s / smax; R.chk(L('Link spacing', 'ระยะปลอก'), g.s, smax, 'mm', us);
    add('ls', L('Link spacing', 'ระยะเรียงปลอก'), g.s, smax, 'mm', us);

    // SLS
    const Ms = (+A.Ms || 0) * 1e6;
    let sls = null;
    if (Ms !== 0) {
      sls = slsBeam(code, m, S, Ms, g, R, lang, add, inp);
    }

    return { code, m, S, bars, checks, rep: R, flex: { x: fxM, y: fyM }, shear: { y: shY, x: shX }, tor, sls, d };
  }

  function slsBeam(code, m, S, Ms, g, R, lang, add, inp) {
    const L = (a, b) => R.L(a, b);
    const sag = Ms > 0, aE = m.alphaE;
    const ce = crackedElastic(S, aE, sag);
    const Ma = Math.abs(Ms);
    R.sec(L('Serviceability — stresses (cracked elastic section)', 'สภาวะใช้งาน — หน่วยแรง (หน้าตัดแตกร้าวยืดหยุ่น)'), code === 'EC2' ? '§9.1' : code === 'AS' ? '§8.6' : '24.3');
    R.eq('α_e', code === 'EC2' ? 'α_e = E_s / (E_cm/(1 + φ))' : 'α_e = E_s / E_c', aE, '');
    R.eq('x_cr', L('Neutral axis (transformed section)', 'แกนสะเทิน (หน้าตัดแปลง)'), ce.x, 'mm');
    R.eq('I_cr', L('Cracked second moment of area', 'โมเมนต์ความเฉื่อยแตกร้าว'), ce.I / 1e6, '×10⁶ mm⁴');
    const sc = Ma * ce.x / ce.I, ss = aE * Ma * (ce.dmax - ce.x) / ce.I;
    R.eq('σ_c', 'σ_c = M·x / I_cr', sc, 'MPa'); R.eq('σ_s', 'σ_s = α_e·M·(d − x) / I_cr', ss, 'MPa');
    const out = { sc, ss, ce };
    if (code === 'EC2') {
      const u1 = R.chk('σ_c ≤ 0.6·f_ck', sc, 0.6 * m.fc, 'MPa'); add('sc', 'SLS σ_c ≤ 0.6f_ck', sc, 0.6 * m.fc, 'MPa', u1);
      const u2 = R.chk('σ_s ≤ 0.8·f_yk', ss, 0.8 * m.fy, 'MPa'); add('ss', 'SLS σ_s ≤ 0.8f_yk', ss, 0.8 * m.fy, 'MPa', u2);
      R.sec(L('Crack width', 'ความกว้างรอยร้าว'), '§9.2.3');
      const h = S.h, x = ce.x, d = ce.dcen, c = g.cover + g.linkD, phi = ce.phiMax || 16;
      const hceff = Math.min(2.5 * (h - d), (h - x) / 3, h / 2);
      const rho = ce.AsT / (S.b * hceff);
      const kfl = Math.max(0.5 * (1 + (h - x - hceff) / (h - x)), 0.5), kb = 0.9, kw = 1.3;
      const srm = Math.min(1.5 * c + kfl * kb / 7.2 * phi / rho, 1.3 / kw * (h - x));
      const k1r = (h - x) / (h - (h - d) - x);
      const ssd = aE * Ma * (d - x) / ce.I; // steel stress at tension centroid
      const eps = Math.max((ssd - m.kt * m.fctm / rho * (1 + (ES / m.Ec) * rho)) / ES, (1 - m.kt) * ssd / ES);
      const wk = kw * k1r * srm * eps;
      R.eq('h_c,eff', 'h_c,eff = min(2.5(h − d), (h − x)/3, h/2)', hceff, 'mm');
      R.eq('ρ_p,eff', 'ρ_p,eff = A_s / (b·h_c,eff)', rho, '');
      R.eq('k_fl', 'k_fl = 0.5·(1 + (h − x − h_c,eff)/(h − x)) ≥ 0.5', kfl, '', '(9.17)');
      R.eq('s_r,m,cal', 's_r,m,cal = 1.5c + (k_fl·k_b/7.2)·φ/ρ_p,eff ≤ 1.3(h − x)/k_w', srm, 'mm', '(9.15)');
      R.eq('k_1/r', 'k_1/r = (h − x)/(h − a_y − x)', k1r, '', '(9.9)');
      R.eq('ε_sm − ε_cm', '[σ_s − k_t·f_ct,eff/ρ_p,eff·(1 + α_e·ρ_p,eff)]/E_s ≥ (1 − k_t)σ_s/E_s', eps, '', '(9.11)');
      R.eq('w_k,cal', 'w_k,cal = k_w·k_1/r·s_r,m,cal·(ε_sm − ε_cm)', wk, 'mm', '(9.8)');
      const wl = +inp.mat.wlim || 0.3;
      const u3 = R.chk(L('Crack width', 'ความกว้างรอยร้าว'), wk, wl, 'mm'); add('wk', L('Crack width w_k', 'ความกว้างรอยร้าว'), wk, wl, 'mm', u3);
      out.wk = wk;
    } else if (code === 'AS') {
      const tabD = [[10, 360], [12, 330], [16, 280], [20, 240], [24, 210], [28, 185], [32, 160], [36, 140], [40, 120]];
      const phi = ce.phiMax || 16, lim1 = interp(tabD, phi);
      R.sec(L('Crack control — steel stress', 'ควบคุมรอยร้าว — หน่วยแรงเหล็ก'), '§8.6.1');
      const u1 = R.chk('σ_scr ≤ 0.8·f_sy', ss, 0.8 * m.fy, 'MPa'); add('ss', 'SLS σ_scr ≤ 0.8f_sy', ss, 0.8 * m.fy, 'MPa', u1);
      R.eq(L('Table 8.6.1(A) limit for d_b = ', 'ขีดจำกัดตาราง 8.6.1(A) d_b = ') + phi, 'σ_s,lim', lim1, 'MPa');
      const u2 = R.chk(L('Bar diameter criterion', 'เกณฑ์ขนาดเหล็ก'), ss, lim1, 'MPa'); add('ssd', 'σ_scr ≤ Table 8.6.1(A)', ss, lim1, 'MPa', u2);
      const tabS = [[160, 300], [200, 250], [240, 200], [280, 150], [320, 100], [360, 50]];
      const rowT = sag ? inp.bot[0] : inp.top[0];
      if (rowT && rowT.n > 1) {
        const sp = (g.b - 2 * (g.cover + g.linkD) - rowT.d) / (rowT.n - 1);
        const smx = ss <= 160 ? 300 : interp(tabS, ss);
        R.eq(L('Bar centre spacing', 'ระยะศูนย์กลางเหล็ก'), 's', sp, 'mm');
        const u3 = R.chk(L('Table 8.6.1(B) spacing', 'ระยะตามตาราง 8.6.1(B)'), sp, smx, 'mm'); add('ssp', L('Max bar spacing (crack)', 'ระยะเหล็กมากสุด (รอยร้าว)'), sp, smx, 'mm', u3);
      }
    } else {
      R.sec(L('Crack control — bar spacing', 'ควบคุมรอยร้าว — ระยะเรียงเหล็ก'), '24.3.2');
      const cc = g.cover + g.linkD, fs = ss;
      const smx = Math.min(380 * (280 / fs) - 2.5 * cc, 300 * (280 / fs));
      const rowT = sag ? inp.bot[0] : inp.top[0];
      R.eq('f_s', L('Service steel stress', 'หน่วยแรงเหล็กใช้งาน'), fs, 'MPa');
      R.eq('s_max', 's ≤ 380(280/f_s) − 2.5c_c ≤ 300(280/f_s)', smx, 'mm', 'Table 24.3.2');
      if (rowT && rowT.n > 1) {
        const sp = (g.b - 2 * cc - rowT.d) / (rowT.n - 1);
        const u = R.chk(L('Bar spacing', 'ระยะเรียงเหล็ก'), sp, smx, 'mm'); add('ssp', L('Crack control spacing', 'ระยะเหล็กควบคุมรอยร้าว'), sp, smx, 'mm', u);
      }
      R.txt('σ_c = ' + f(sc, 2) + ' MPa vs 0.45f\'c = ' + f(0.45 * m.fc, 2) + ' MPa ' + L('(working-stress reference only, not a strength-design requirement)', '(ข้อมูลอ้างอิงแบบหน่วยแรงใช้งาน ไม่ใช่ข้อบังคับวิธีกำลัง)'));
    }
    return out;
  }

  // ---------------------------------------------------------------- COLUMN
  function designColumn(code, inp, lang) {
    const R = new Rep(lang), L = (a, b) => R.L(a, b);
    const m = material(code, inp.mat), g = inp.geo;
    const bars = layoutColumn({ b: g.b, h: g.h, cover: g.cover, linkD: g.linkD, nb: inp.nb, nh: inp.nh, dc: inp.dc, dm: inp.dm });
    const S = makeSection(g.b, g.h, bars);
    const A = inp.act;
    const checks = [];
    const add = (id, name, Ed, Rd, unit, ur, clause) => checks.push({ id, name, Ed, Rd, unit, ur: ur !== undefined ? ur : (Rd > 0 ? Math.abs(Ed) / Rd : 99), clause });
    R.sec(L('Materials & design strengths', 'วัสดุและกำลังออกแบบ'), code === 'EC2' ? '§5.1, §5.2' : code === 'AS' ? '§3.1, §3.2' : '19.2, 20.2');
    materialRows(R, m, lang);
    R.sec(L('Section & reinforcement', 'หน้าตัดและเหล็กเสริม'), '');
    R.eq('b × h', L('Section size', 'ขนาดหน้าตัด'), g.b + ' × ' + g.h, 'mm');
    R.eq('A_s', bars.length + L(' bars: 4', ' เส้น: 4') + barName(code, inp.dc) + (bars.length > 4 ? ' + ' + (bars.length - 4) + barName(code, inp.dm) : ''), S.As, 'mm²');
    const rho = S.As / S.Ag;
    R.eq('ρ', 'ρ = A_s / A_g', rho * 100, '%');
    blockRows(R, m, lang);
    const N = (+A.N || 0) * 1e3;
    let Mx = (+A.Mx || 0) * 1e6, My = (+A.My || 0) * 1e6;
    // minimum eccentricity
    R.sec(L('Design actions incl. minimum eccentricity', 'แรงออกแบบรวมความเยื้องศูนย์น้อยสุด'), code === 'EC2' ? '§7.2 (e₀ = max(h/30, 20 mm))' : code === 'AS' ? '§10.1.2 (e = 0.05D)' : '22.4.2 (P_n,max = 0.80P_o)');
    if (N > 0 && code !== 'TH') {
      const ex = code === 'EC2' ? Math.max(g.h / 30, 20) : 0.05 * g.h, ey = code === 'EC2' ? Math.max(g.b / 30, 20) : 0.05 * g.b;
      const Mxm = N * ex, Mym = N * ey;
      R.eq('M_x,min', 'N·e_x = ' + f(N / 1e3, 1) + ' × ' + f(ex, 1) + '/1000', Mxm / 1e6, 'kNm');
      R.eq('M_y,min', 'N·e_y = ' + f(N / 1e3, 1) + ' × ' + f(ey, 1) + '/1000', Mym / 1e6, 'kNm');
      if (Math.abs(Mx) < Mxm) Mx = (Mx < 0 ? -1 : 1) * Mxm;
      if (Math.abs(My) < Mym && My !== 0) My = (My < 0 ? -1 : 1) * Mym;
    }
    R.eq('N_Ed', L('Axial (compression +)', 'แรงอัดแนวแกน (+ อัด)'), N / 1e3, 'kN');
    R.eq('M_x,Ed', L('Design moment major', 'โมเมนต์ออกแบบแกนหลัก'), Mx / 1e6, 'kNm');
    R.eq('M_y,Ed', L('Design moment minor', 'โมเมนต์ออกแบบแกนรอง'), My / 1e6, 'kNm');
    R.txt(L('Short column assumed — include second-order effects in the design moments where the member is slender.', 'สมมติเป็นเสาสั้น — กรณีเสาชะลูดให้รวมผลลำดับที่สองในโมเมนต์ออกแบบ'));

    const Nmax = nMax(S, m);
    R.sec(L('Axial capacity', 'กำลังรับแรงอัดแนวแกน'), code === 'EC2' ? '§8.1.2' : code === 'AS' ? '§10.6.2' : '22.4.2');
    if (code === 'EC2') R.eq('N_Rd,max', 'N_Rd = η·f_cd·(A_c − A_s) + A_s·min(f_yd, 0.002E_s)', Nmax / 1e3, 'kN');
    else if (code === 'AS') { R.eq('α₁', 'α₁ = 1.0 − 0.003f\'c (0.72–0.85)', m.alpha1, ''); R.eq('φN_uo', 'φN_uo = 0.65·(α₁f\'c·A_c + A_s·f_sy)', Nmax / 1e3, 'kN'); }
    else R.eq('φP_n,max', 'φP_n,max = 0.80·φ·[0.85f\'c(A_g − A_st) + f_y·A_st], φ = 0.65', Nmax / 1e3, 'kN');
    const uN = R.chk(L('Axial', 'แรงอัด'), N / 1e3, Nmax / 1e3, 'kN');
    add('N', L('Axial capacity', 'กำลังรับแรงอัด'), N / 1e3, Nmax / 1e3, 'kN', uN);

    const cxP = uniCurve(S, m, PI / 2, 'x'), cxN = uniCurve(S, m, 3 * PI / 2, 'x');
    const cyP = uniCurve(S, m, 0, 'y'), cyN = uniCurve(S, m, PI, 'y');
    const uni = (curve, M, lbl, id) => {
      R.sec(lbl, code === 'EC2' ? '§8.1' : code === 'AS' ? '§10.6' : '22.4');
      const cap = mAtN(curve, N);
      R.txt(L('Interaction curve by strain compatibility; moment resistance read at N_Ed.', 'เส้นปฏิสัมพันธ์จากความเข้ากันได้ของความเครียด อ่านกำลังโมเมนต์ที่ N_Ed'));
      if (cap === null) { add(id, lbl, Math.abs(M) / 1e6, 0, 'kNm', 9.99); R.txt(L('N_Ed outside the interaction diagram.', 'N_Ed อยู่นอกแผนภาพปฏิสัมพันธ์')); return 9.99; }
      R.eq(L('Moment resistance at N_Ed', 'กำลังโมเมนต์ที่ N_Ed'), 'M_Rd(N_Ed)', cap / 1e6, 'kNm');
      const u = Math.max(R.chk(L('Moment', 'โมเมนต์'), Math.abs(M) / 1e6, cap / 1e6, 'kNm'), N > 0 ? N / Nmax : 0);
      add(id, lbl, Math.abs(M) / 1e6, cap / 1e6, 'kNm', u);
      return u;
    };
    uni(Mx >= 0 ? cxP : cxN, Mx, L('N–M interaction, major axis', 'ปฏิสัมพันธ์ N–M แกนหลัก'), 'NMx');
    uni(My >= 0 ? cyP : cyN, My, L('N–M interaction, minor axis', 'ปฏิสัมพันธ์ N–M แกนรอง'), 'NMy');
    let poly = null;
    R.sec(L('Biaxial bending at N_Ed', 'การดัดสองแกนที่ N_Ed'), code === 'EC2' ? '§8.1.1 (full contour)' : code === 'AS' ? '§10.6.4' : '22.4');
    poly = biaxContour(S, m, N);
    const Me = Math.hypot(Mx, My), cap = poly ? rayCap(poly, Mx, My) : 0;
    R.txt(L('M_x–M_y load contour at N_Ed from fibre integration over 72 neutral-axis angles; resistance taken along the resultant moment direction.', 'เส้นชั้นกำลัง M_x–M_y ที่ N_Ed จากการอินทิเกรตไฟเบอร์ 72 มุมแกนสะเทิน'));
    R.eq('M_Ed', '√(M_x,Ed² + M_y,Ed²)', Me / 1e6, 'kNm');
    R.eq('M_Rd', L('Resistance along load direction', 'กำลังต้านทานตามทิศแรงกระทำ'), (cap || 0) / 1e6, 'kNm');
    const ub = cap ? R.chk(L('Biaxial', 'สองแกน'), Me / 1e6, cap / 1e6, 'kNm') : 9.99;
    add('NMxy', L('Biaxial N–Mx–My', 'ปฏิสัมพันธ์สองแกน N–Mx–My'), Me / 1e6, (cap || 0) / 1e6, 'kNm', ub);

    // shear
    const Asw = 2 * barA(g.linkD) + (g.innerN | 0) * barA(g.innerD || g.linkD), AswX = 2 * barA(g.linkD);
    const sh = (V, bw, hh, lbl, id) => {
      if (!V) return null;
      R.sec(lbl, code === 'EC2' ? '§8.2' : code === 'AS' ? '§8.2' : '22.5');
      const dd = hh - g.cover - g.linkD - inp.dc / 2;
      const AsT = bars.filter(r => (id === 'Vy' ? r.y : r.x) < 0).reduce((s, r) => s + barA(r.d), 0);
      if (id === 'Vx' && AswX !== Asw) R.txt(L('Single-leg ties act in the y direction only; V_x uses the two outer tie legs.', 'ปลอกขาเดี่ยวรับแรงในแนว y เท่านั้น V_x ใช้ขาปลอกนอกสองขา'));
      const r = shearDesign(m, R, { V, bw, d: dd, h: hh, Asw: id === 'Vx' ? AswX : Asw, s: g.s, rhoL: Math.min(0.02, AsT / (bw * dd)) });
      R.txt(L('Axial compression benefit conservatively ignored.', 'ไม่นำผลของแรงอัดมาเพิ่มกำลังเฉือน (ปลอดภัย)'));
      const u = R.chk(L('Shear', 'แรงเฉือน'), Math.abs(V) / 1e3, r.VRd / 1e3, 'kN'); add(id, lbl, Math.abs(V) / 1e3, r.VRd / 1e3, 'kN', u);
      return r;
    };
    sh((+A.Vy || 0) * 1e3, g.b, g.h, L('Shear — V_y', 'แรงเฉือน — V_y'), 'Vy');
    sh((+A.Vx || 0) * 1e3, g.h, g.b, L('Shear — V_x', 'แรงเฉือน — V_x'), 'Vx');

    // detailing
    R.sec(L('Detailing', 'รายละเอียดการเสริมเหล็ก'), code === 'EC2' ? '§12.4' : code === 'AS' ? '§10.7' : '10.6, 25.7.2');
    const [rmin, rmax] = code === 'EC2' ? [Math.max(0.002, 0.1 * N / m.fyd / S.Ag), 0.04] : code === 'AS' ? [0.01, 0.04] : [0.01, 0.08];
    R.eq('ρ_min', code === 'EC2' ? 'max(0.10·N_Ed/f_yd, 0.002·A_c)/A_c' : code === 'AS' ? '0.01 (§10.7.1)' : '0.01 (10.6.1.1)', rmin * 100, '%');
    R.eq('ρ_max', code === 'TH' ? '0.08 (10.6.1.1)' : '0.04', rmax * 100, '%');
    const u1 = R.chk('ρ ≥ ρ_min', rmin * 100, rho * 100, '%', rmin / rho); add('rmin', L('Min. steel ratio', 'อัตราส่วนเหล็กน้อยสุด'), rmin * 100, rho * 100, '%', rmin / rho);
    const u2 = R.chk('ρ ≤ ρ_max', rho * 100, rmax * 100, '%'); add('rmax', L('Max. steel ratio', 'อัตราส่วนเหล็กมากสุด'), rho * 100, rmax * 100, '%', u2);
    const dmin = Math.min(inp.dc, inp.dm), least = Math.min(g.b, g.h);
    const smx = code === 'EC2' ? Math.min(20 * dmin, least, 400) : code === 'AS' ? Math.min(least, 15 * dmin) : Math.min(16 * dmin, 48 * g.linkD, least);
    R.eq('s_max', code === 'EC2' ? 'min(20φ_min, b_min, 400)' : code === 'AS' ? 'min(D_c, 15d_b)' : 'min(16d_b, 48d_tie, b_min)', smx, 'mm');
    const u3 = R.chk(L('Tie spacing', 'ระยะเหล็กปลอก'), g.s, smx, 'mm'); add('ts', L('Tie spacing', 'ระยะเหล็กปลอก'), g.s, smx, 'mm', u3);
    const clr = Math.min(
      (g.b - 2 * (g.cover + g.linkD) - 2 * inp.dc - Math.max(0, inp.nb - 2) * inp.dm) / Math.max(1, inp.nb - 1),
      (g.h - 2 * (g.cover + g.linkD) - 2 * inp.dc - Math.max(0, inp.nh - 2) * inp.dm) / Math.max(1, inp.nh - 1));
    const req = code === 'TH' ? Math.max(40, 1.5 * Math.max(inp.dc, inp.dm), 4 / 3 * m.dg) : minClear(m, Math.max(inp.dc, inp.dm));
    const u4 = R.chk(L('Clear bar spacing', 'ระยะช่องว่างเหล็ก'), req, clr, 'mm', req / Math.max(clr, 1e-6)); add('cs', L('Clear bar spacing', 'ระยะช่องว่างเหล็ก'), req, clr, 'mm', u4);

    return { code, m, S, bars, checks, rep: R, curves: { xP: cxP, xN: cxN, yP: cyP, yN: cyN }, poly, N, Mx, My, Nmax };
  }

  // ---------------------------------------------------------------- PILE CAP
  function pileLayout(p) {
    const s = p.s, pts = [];
    switch (p.layout) {
      case '1': pts.push([0, 0]); break;
      case '2': pts.push([-s / 2, 0], [s / 2, 0]); break;
      case '3': { const hh = s * sq(3) / 2; pts.push([0, 2 * hh / 3], [-s / 2, -hh / 3], [s / 2, -hh / 3]); break; }
      case '4': pts.push([-s / 2, -s / 2], [s / 2, -s / 2], [s / 2, s / 2], [-s / 2, s / 2]); break;
      case '5': { const a = s / sq(2); pts.push([-a, -a], [a, -a], [a, a], [-a, a], [0, 0]); break; }
      case '6': for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) pts.push([(i - 1) * s, (j - 0.5) * s]); break;
      case '9': for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) pts.push([(i - 1) * s, (j - 1) * s]); break;
      default: { const nx = Math.max(1, p.nx | 0), ny = Math.max(1, p.ny | 0), sy = p.sy || s; for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) pts.push([(i - (nx - 1) / 2) * s, (j - (ny - 1) / 2) * sy]); }
    }
    return pts.map(([x, y], i) => ({ x, y, id: 'P' + (i + 1) }));
  }

  function clippedPerim(xc, yc, a, X0, X1, Y0, Y1) {
    // square [xc-a,xc+a]x[yc-a,yc+a] clipped to cap; return length of sides lying inside the cap
    const x0 = Math.max(xc - a, X0), x1 = Math.min(xc + a, X1), y0 = Math.max(yc - a, Y0), y1 = Math.min(yc + a, Y1);
    let L = 0, open = 0;
    if (xc - a > X0) L += y1 - y0; else open++;
    if (xc + a < X1) L += y1 - y0; else open++;
    if (yc - a > Y0) L += x1 - x0; else open++;
    if (yc + a < Y1) L += x1 - x0; else open++;
    return { L, open };
  }

  function designPileCap(code, inp, lang) {
    const R = new Rep(lang), L = (a, b) => R.L(a, b);
    const m = material(code, inp.mat), g = inp.geo, A = inp.act;
    const checks = [];
    const add = (id, name, Ed, Rd, unit, ur) => checks.push({ id, name, Ed, Rd, unit, ur: ur !== undefined ? ur : (Rd > 0 ? Math.abs(Ed) / Rd : 99) });
    const piles = pileLayout({ layout: g.layout, s: g.s, nx: g.nx, ny: g.ny, sy: g.sy });
    const xs = piles.map(p => p.x), ys = piles.map(p => p.y);
    const X1 = Math.max(...xs) + g.edge, X0 = Math.min(...xs) - g.edge, Y1 = Math.max(...ys) + g.edge, Y0 = Math.min(...ys) - g.edge;
    const Lx = X1 - X0, Ly = Y1 - Y0, H = g.H;
    const dx = H - g.cb - g.barX.d / 2, dy = dx - g.barX.d / 2 - g.barY.d / 2, dav = (dx + dy) / 2;
    const n = piles.length;

    R.sec(L('Materials & design strengths', 'วัสดุและกำลังออกแบบ'), code === 'EC2' ? '§5.1' : code === 'AS' ? '§3.1' : '19.2');
    materialRows(R, m, lang);
    R.sec(L('Geometry', 'รูปทรงฐานราก'), '');
    R.eq(L('Cap plan', 'ขนาดฐานราก'), 'L_x × L_y × H', f(Lx, 0) + ' × ' + f(Ly, 0) + ' × ' + f(H, 0), 'mm');
    R.eq(L('Piles', 'เสาเข็ม'), n + ' × Ø' + g.Dp + ', s = ' + g.s, '', 'mm');
    R.eq('d_x, d_y', L('Effective depths to bottom bars', 'ความลึกประสิทธิผลถึงเหล็กล่าง'), f(dx, 0) + ', ' + f(dy, 0), 'mm');

    // reactions
    const W = g.gc * Lx * Ly * H / 1e9; // kN
    const gG = +g.gG || 1.35;
    const Nu = (+A.N || 0) + gG * W, Mxu = +A.Mx || 0, Myu = +A.My || 0;
    const Ns = (+A.Ns || 0) + W, Mxs = +A.Mxs || 0, Mys = +A.Mys || 0;
    const sx2 = xs.reduce((s, x) => s + x * x, 0) / 1e6, sy2 = ys.reduce((s, y) => s + y * y, 0) / 1e6;
    const react = (NN, MX, MY) => piles.map(p => NN / n + (sy2 > 0 ? MX * (p.y / 1e3) / sy2 : 0) + (sx2 > 0 ? MY * (p.x / 1e3) / sx2 : 0));
    const Pu = react(Nu, Mxu, Myu), Ps = react(Ns, Mxs, Mys);
    R.sec(L('Pile reactions', 'แรงปฏิกิริยาเสาเข็ม'), L('Rigid cap', 'ฐานรากแข็ง'));
    R.eq(L('Cap self-weight', 'น้ำหนักฐานราก'), 'W = γ_c·L_x·L_y·H', W, 'kN');
    R.eq('P_i', 'P_i = ΣN/n ± M_x·y_i/Σy² ± M_y·x_i/Σx²', '', '');
    piles.forEach((p, i) => R.eq(p.id + ' (' + f(p.x, 0) + ', ' + f(p.y, 0) + ')', 'ULS / SLS', f(Pu[i], 1) + ' / ' + f(Ps[i], 1), 'kN'));
    const Psmax = Math.max(...Ps), Pumax = Math.max(...Pu), Pmin = Math.min(...Pu);
    const up = R.chk(L('Pile working load', 'น้ำหนักบรรทุกใช้งานเสาเข็ม'), Psmax, +g.Pallow, 'kN');
    add('pile', L('Pile SLS load', 'แรงเสาเข็ม (ใช้งาน)'), Psmax, +g.Pallow, 'kN', up);
    if (Pmin < 0) R.txt(L('Tension pile present — check pile tension capacity and anchorage.', 'มีเสาเข็มรับแรงดึง — ตรวจสอบกำลังดึงและการยึดรั้ง'));
    if (sy2 === 0 && Mxu !== 0) R.txt(L('Single row of piles: M_x must be resisted by tie beams.', 'เข็มแถวเดียว: M_x ต้องรับด้วยคานยึด'));
    if (sx2 === 0 && Myu !== 0) R.txt(L('Single row of piles: M_y must be resisted by tie beams.', 'เข็มแถวเดียว: M_y ต้องรับด้วยคานยึด'));

    const nbx = Math.floor((Ly - 2 * g.cs) / g.barX.s) + 1, nby = Math.floor((Lx - 2 * g.cs) / g.barY.s) + 1;
    const Asx = nbx * barA(g.barX.d), Asy = nby * barA(g.barY.d);
    const phiB = code === 'EC2' ? 1 : code === 'AS' ? 0.85 : 0.9;
    const cx = g.cx, cy = g.cy;
    const res = { piles, Pu, Ps, Lx, Ly, X0, X1, Y0, Y1, dx, dy, n, Asx, Asy, nbx, nby };

    // ---- flexure (beam method)
    const faceMoment = (axis) => {
      const c = axis === 'x' ? cx : cy, B = axis === 'x' ? Ly : Lx, Lh = (axis === 'x' ? Lx : Ly) / 2;
      let best = 0;
      [1, -1].forEach(sg => {
        let M = 0; piles.forEach((p, i) => { const t = sg * (axis === 'x' ? p.x : p.y) - c / 2; if (t > 0) M += Pu[i] * t / 1e3; });
        const ov = Math.max(0, (sg > 0 ? (axis === 'x' ? X1 : Y1) : -(axis === 'x' ? X0 : Y0)) - c / 2);
        M -= gG * g.gc * B * H / 1e9 * ov * ov / 2 / 1e3;
        best = Math.max(best, M);
      });
      return best;
    };
    const mRd = (As, B, d) => { const a = As * m.fsd / (m.sigc * B); return phiB * As * m.fsd * (d - a / 2) / 1e6; };
    const Mfx = faceMoment('x'), Mfy = faceMoment('y');
    const MRx = mRd(Asx, Ly, dx), MRy = mRd(Asy, Lx, dy);
    res.Mfx = Mfx; res.Mfy = Mfy;

    // ---- STM
    const z = (+g.zd || 0.85) * dav;
    const tie = axis => {
      let best = 0;
      [1, -1].forEach(sg => {
        let T = 0; piles.forEach((p, i) => { const t = sg * (axis === 'x' ? p.x : p.y) - (axis === 'x' ? cx : cy) / 4; if (t > 0 && sg * (axis === 'x' ? p.x : p.y) > 0) T += Pu[i] * t / z; });
        best = Math.max(best, T);
      });
      return best; // kN
    };
    const Tx = tie('x'), Ty = tie('y');
    const phiT = code === 'EC2' ? 1 : code === 'AS' ? 0.8 : 0.75;
    const fyT = code === 'EC2' ? m.fyd : m.fy;
    res.Tx = Tx; res.Ty = Ty; res.z = z;

    if (g.method === 'stm') {
      R.sec(L('Strut-and-tie model', 'แบบจำลองโครงถักค้ำ-ยึด (STM)'), code === 'EC2' ? '§8.5 (strut-and-tie), §9.8' : code === 'AS' ? 'Section 7' : 'Chapter 23');
      R.eq('z', 'z = ' + f(+g.zd || 0.85, 2) + '·d_avg', z, 'mm');
      if (g.layout === '2') {
        R.txt(L('Two-pile model: the column load splits into two inclined struts from the column quarter points to the pile heads, held by one horizontal tie between the piles (bars in x).', 'แบบจำลองเข็ม 2 ต้น: แรงเสาแยกเป็นค้ำเอียงสองตัวจากจุดหนึ่งในสี่ของเสาลงหัวเข็ม โดยมีตัวยึดแนวนอนหนึ่งตัวระหว่างเข็ม (เหล็กแนว x)'));
        R.eq('T', 'T = max P_i·(|x_i| − c_x/4) / z', Tx, 'kN');
        const TRx = phiT * Asx * fyT / 1e3;
        R.eq(L('Tie capacity', 'กำลังตัวยึด'), (code === 'EC2' ? 'A_s·f_yd' : 'φ·A_s·f_y') + ' = ' + nbx + barName(code, g.barX.d), TRx, 'kN');
        add('Tx', L('Tie between piles', 'ตัวยึดระหว่างเข็ม'), Tx, TRx, 'kN', R.chk(L('Tie', 'ตัวยึด'), Tx, TRx, 'kN'));
        R.txt(L('Bars in y act as distribution / transverse reinforcement for the two-pile cap.', 'เหล็กแนว y ทำหน้าที่เป็นเหล็กกระจายแรงสำหรับฐานรากเข็ม 2 ต้น'));
      } else if (g.layout === '3') {
        R.txt(L('Three-pile model: three struts from the column to the pile heads; the horizontal thrust at each pile is carried by perimeter ties along the triangle sides (bars bundled over the piles).', 'แบบจำลองเข็ม 3 ต้น: ค้ำสามตัวจากเสาลงหัวเข็ม แรงผลักแนวนอนที่หัวเข็มรับด้วยตัวยึดรอบรูปสามเหลี่ยม (เหล็กรวมเหนือหัวเข็ม)'));
        const ceq = Math.sqrt(cx * cy);
        let Hmax = 0;
        piles.forEach((p, i) => { const r = Math.max(0, Math.hypot(p.x, p.y) - ceq / 4); Hmax = Math.max(Hmax, Pu[i] * r / z); });
        const Te = Hmax / Math.sqrt(3);
        const nt = Math.max(1, g.tieN | 0), dt = +g.tieD || g.barX.d, TRe = phiT * nt * barA(dt) * fyT / 1e3;
        R.eq('H_i', L('Radial thrust at pile: P_i·r_i / z, r_i = centre to pile − c/4', 'แรงผลักแนวรัศมีที่หัวเข็ม: P_i·r_i / z'), Hmax, 'kN');
        R.eq('T_side', 'T_side = H_i / (2·cos 30°) = H_i / √3', Te, 'kN');
        R.eq(L('Perimeter tie capacity', 'กำลังตัวยึดรอบรูป'), (code === 'EC2' ? 'n·A_b·f_yd' : 'φ·n·A_b·f_y') + ' = ' + nt + barName(code, dt), TRe, 'kN');
        add('Tp', L('Perimeter tie (triangle side)', 'ตัวยึดรอบรูป (ด้านสามเหลี่ยม)'), Te, TRe, 'kN', R.chk(L('Perimeter tie', 'ตัวยึดรอบรูป'), Te, TRe, 'kN'));
        Object.assign(res, { Te, TRe });
      } else {
        R.txt(L('Column load split to quarter-point nodes; struts run to pile heads; ties are the bottom bars.', 'แรงเสาแบ่งลงจุดต่อที่ตำแหน่งหนึ่งในสี่ของเสา ค้ำลงหัวเข็ม เหล็กล่างเป็นตัวยึด'));
        R.eq('T_x', 'T_x = Σ P_i·(x_i − c_x/4) / z', Tx, 'kN');
        R.eq('T_y', 'T_y = Σ P_i·(y_i − c_y/4) / z', Ty, 'kN');
        const TRx = phiT * Asx * fyT / 1e3, TRy = phiT * Asy * fyT / 1e3;
        R.eq(L('Tie capacity x', 'กำลังตัวยึด x'), (code === 'EC2' ? 'A_s·f_yd' : 'φ·A_s·f_y') + ' = ' + nbx + barName(code, g.barX.d), TRx, 'kN');
        R.eq(L('Tie capacity y', 'กำลังตัวยึด y'), (code === 'EC2' ? 'A_s·f_yd' : 'φ·A_s·f_y') + ' = ' + nby + barName(code, g.barY.d), TRy, 'kN');
        add('Tx', L('Tie x', 'ตัวยึดแกน x'), Tx, TRx, 'kN', R.chk(L('Tie x', 'ตัวยึด x'), Tx, TRx, 'kN'));
        add('Ty', L('Tie y', 'ตัวยึดแกน y'), Ty, TRy, 'kN', R.chk(L('Tie y', 'ตัวยึด y'), Ty, TRy, 'kN'));
      }
      // struts & nodes
      const nuP = 1 - m.fc / 250;
      let fCCC, fCCT, fStr;
      if (code === 'EC2') { fCCC = nuP * m.fcd; fCCT = 0.85 * nuP * m.fcd; fStr = 0.6 * nuP * m.fcd; R.eq('ν\'', 'ν\' = 1 − f_ck/250', nuP, ''); }
      else if (code === 'AS') { fCCC = 0.6 * 1.0 * 0.9 * m.fc; fCCT = 0.6 * 0.8 * 0.9 * m.fc; fStr = null; }
      else { const bs = +g.betaS || 0.75; fCCC = 0.75 * 0.85 * 1.0 * m.fc; fCCT = 0.75 * 0.85 * 0.8 * m.fc; fStr = 0.75 * 0.85 * bs * m.fc; R.eq('β_s', L('Strut coefficient (user)', 'ค่าสัมประสิทธิ์ค้ำ'), bs, '', 'Table 23.4.3'); }
      R.eq(L('Node CCC limit', 'ขีดจำกัดจุดต่อ CCC'), code === 'EC2' ? 'σ_Rd = ν\'·f_cd' : code === 'AS' ? 'φ_st·β_n·0.9f\'c (β_n = 1.0)' : 'φ·0.85·β_n·f\'c (β_n = 1.0)', fCCC, 'MPa');
      R.eq(L('Node CCT limit', 'ขีดจำกัดจุดต่อ CCT'), code === 'EC2' ? 'σ_Rd = 0.85ν\'·f_cd' : code === 'AS' ? 'φ_st·β_n·0.9f\'c (β_n = 0.8)' : 'φ·0.85·β_n·f\'c (β_n = 0.8)', fCCT, 'MPa');
      const Ncol = +A.N * 1e3;
      const uC = R.chk(L('Column node (CCC)', 'จุดต่อใต้เสา (CCC)'), Ncol / (cx * cy), fCCC, 'MPa');
      add('nCCC', L('Column node CCC', 'จุดต่อใต้เสา CCC'), Ncol / (cx * cy), fCCC, 'MPa', uC);
      const Ap = PI * g.Dp * g.Dp / 4, u = 2 * (H - dx);
      let worstS = 0, worstN = 0, minTh = 90, sEd = 0, sRd = 0;
      piles.forEach((p, i) => {
        const r = g.layout === '3' ? Math.max(0, Math.hypot(p.x, p.y) - Math.sqrt(cx * cy) / 4) : Math.hypot(Math.max(0, Math.abs(p.x) - cx / 4), Math.max(0, Math.abs(p.y) - cy / 4));
        const th = Math.atan2(z, Math.max(r, 1)); minTh = Math.min(minTh, th * 180 / PI);
        const C = Pu[i] * 1e3 / Math.sin(th);
        const ws = u * Math.cos(th) + g.Dp * Math.sin(th);
        const fs = code === 'AS' ? 0.6 * clamp(1 / (1 + 0.66 / Math.pow(Math.tan(th), 2)), 0.3, 1) * 0.9 * m.fc : fStr;
        const ss = C / (ws * g.Dp);
        if (ss / fs > worstS) { worstS = ss / fs; sEd = ss; sRd = fs; }
        worstN = Math.max(worstN, (Pu[i] * 1e3 / Ap) / fCCT);
      });
      R.eq(L('Minimum strut angle', 'มุมค้ำน้อยสุด'), 'θ_min = atan(z / r)', minTh, '°', code === 'TH' ? '23.2.7 (≥ 25°)' : '');
      if (minTh < 25) R.txt(L('Strut angle below 25° — deepen the cap.', 'มุมค้ำต่ำกว่า 25° — ควรเพิ่มความหนาฐานราก'));
      R.eq(L('Strut width at pile node', 'ความกว้างค้ำที่หัวเข็ม'), 'w_s = u·cos θ + D_p·sin θ,  u = 2(H − d)', '', '');
      add('str', L('Strut stress (worst pile)', 'หน่วยแรงค้ำ (เข็มวิกฤต)'), sEd, sRd, 'MPa', R.chk(L('Strut', 'ค้ำ'), sEd, sRd, 'MPa'));
      const Pb = Pumax * 1e3 / Ap;
      add('nCCT', L('Pile node CCT (bearing)', 'จุดต่อหัวเข็ม CCT'), Pb, fCCT, 'MPa', R.chk(L('Pile node (CCT)', 'จุดต่อหัวเข็ม (CCT)'), Pb, fCCT, 'MPa'));
      res.minTh = minTh;
    } else {
      R.sec(L('Flexure — beam method at column face', 'การดัด — วิธีคานที่ผิวเสา'), code === 'EC2' ? '§8.1, §9.8' : code === 'AS' ? '§8.1, §12.5' : '13.2.7, 22.3');
      R.eq('M_x-face', 'Σ P_i·(x_i − c_x/2) − γ_G·w_cap·l²/2', Mfx, 'kNm');
      R.eq('M_y-face', 'Σ P_i·(y_i − c_y/2) − γ_G·w_cap·l²/2', Mfy, 'kNm');
      R.eq(L('Bars in x', 'เหล็กแนว x'), nbx + barName(code, g.barX.d) + ' (@' + g.barX.s + ')', Asx, 'mm²');
      R.eq(L('Bars in y', 'เหล็กแนว y'), nby + barName(code, g.barY.d) + ' (@' + g.barY.s + ')', Asy, 'mm²');
      R.eq(code === 'EC2' ? 'M_Rd,x' : 'φM_n,x', (code === 'EC2' ? '' : 'φ·') + 'A_s·f_s·(d − a/2), a = A_s f_s/(' + (code === 'EC2' ? 'η f_cd' : code === 'AS' ? 'α₂ f\'c' : '0.85 f\'c') + '·B)', MRx, 'kNm');
      R.eq(code === 'EC2' ? 'M_Rd,y' : 'φM_n,y', '', MRy, 'kNm');
      add('Mfx', L('Flexure x (column face)', 'การดัดแกน x (ผิวเสา)'), Mfx, MRx, 'kNm', R.chk(L('Flexure x', 'การดัด x'), Mfx, MRx, 'kNm'));
      add('Mfy', L('Flexure y (column face)', 'การดัดแกน y (ผิวเสา)'), Mfy, MRy, 'kNm', R.chk(L('Flexure y', 'การดัด y'), Mfy, MRy, 'kNm'));
    }
    // min steel
    let rminc = code === 'EC2' ? Math.max(0.26 * m.fctm / m.fy, 0.0013) : code === 'AS' ? 0.0019 : 0.0018 * Math.min(1, 420 / m.fy) * H / dx;
    const Asminx = rminc * Ly * dx, Asminy = rminc * Lx * dy;
    add('Asmin', L('Min. steel (x / y)', 'เหล็กน้อยสุด (x / y)'), Math.max(Asminx / Asx, Asminy / Asy), 1, '', Math.max(Asminx / Asx, Asminy / Asy));

    // ---- one-way shear at d from column face
    R.sec(L('One-way (beam) shear at d from column face', 'แรงเฉือนแบบคานที่ระยะ d จากผิวเสา'), code === 'EC2' ? '§8.2.2' : code === 'AS' ? '§8.2.4' : '13.2.7.2, 22.5');
    const oneWay = axis => {
      const c = axis === 'x' ? cx : cy, d = axis === 'x' ? dx : dy, B = axis === 'x' ? Ly : Lx;
      let best = 0;
      [1, -1].forEach(sg => {
        const sec = c / 2 + d; let V = 0;
        piles.forEach((p, i) => { const t = sg * (axis === 'x' ? p.x : p.y) - sec; const w = clamp((t + g.Dp / 2) / g.Dp, 0, 1); V += Pu[i] * w; });
        const ov = Math.max(0, (sg > 0 ? (axis === 'x' ? X1 : Y1) : -(axis === 'x' ? X0 : Y0)) - sec);
        V -= gG * g.gc * B * H * ov / 1e9;
        best = Math.max(best, V);
      });
      const As = axis === 'x' ? Asx : Asy, rho = Math.min(0.02, As / (B * d));
      let VRd;
      if (code === 'EC2') { const zz = 0.9 * d; const t = Math.max(0.66 / m.gV * cbrt(100 * rho * m.fc * m.ddg / d), 11 / m.gV * sq(m.fc / m.fyd * m.ddg / d)); VRd = t * B * zz / 1e3; R.eq('V_Rd,c,' + axis, 'τ_Rd,c·b·z', VRd, 'kN'); }
      else if (code === 'AS') { const dv = Math.max(0.72 * H, 0.9 * d), kv = Math.min(0.1, 200 / (1000 + 1.3 * dv)); VRd = 0.75 * kv * B * dv * Math.min(8, sq(m.fc)) / 1e3; R.eq('φV_uc,' + axis, 'φ·k_v·b·d_v·√f\'c, k_v = ' + f(kv, 3), VRd, 'kN'); }
      else { const ls = Math.min(1, sq(2 / (1 + 0.004 * d))); VRd = 0.75 * 0.66 * ls * cbrt(rho) * m.sqfc * B * d / 1e3; R.eq('φV_c,' + axis, 'φ·0.66·λ_s·ρ^{1/3}·√f\'c·b·d, λ_s = ' + f(ls, 3), VRd, 'kN'); }
      const u = R.chk(L('Beam shear ', 'เฉือนแบบคาน ') + axis, best, VRd, 'kN');
      add('V1' + axis, L('One-way shear ', 'เฉือนแบบคาน ') + axis, best, VRd, 'kN', u);
    };
    oneWay('x'); oneWay('y');

    // ---- punching at column
    R.sec(L('Punching shear — column', 'แรงเฉือนทะลุ — เสา'), code === 'EC2' ? '§8.4' : code === 'AS' ? '§9.3' : '22.6');
    const rhoP = Math.min(0.02, sq((Asx / (Ly * dx)) * (Asy / (Lx * dy))));
    let Vp = 0, VpR = 0, urP = 0;
    const b0 = 2 * (cx + cy);
    if (code === 'EC2') {
      const dv = dav, b05 = b0 + PI * dv;
      const inside = piles.reduce((s, p, i) => s + ((Math.abs(p.x) <= cx / 2 + dv / 2 && Math.abs(p.y) <= cy / 2 + dv / 2) ? Pu[i] : 0), 0);
      Vp = (+A.N) - inside;
      const kpb = clamp(3.6 * sq(1 - b0 / b05), 1, 2.5);
      const ap = Math.max(1, Math.min(...piles.map(p => Math.max(Math.abs(p.x) - cx / 2, Math.abs(p.y) - cy / 2)).filter(v => v > 0).concat([dv])));
      const apd = Math.min(dv, sq(ap * dv / 8));
      const tR = Math.min(0.6 / m.gV * kpb * cbrt(100 * rhoP * m.fc * m.ddg / apd), 0.5 / m.gV * sq(m.fc));
      res.apd = apd; res.ap = ap;
      const tE = 1.15 * Vp * 1e3 / (b05 * dv);
      R.eq('b_0,5', 'b_0,5 = 2(c_x + c_y) + π·d_v', b05, 'mm'); R.eq('k_pb', 'k_pb = 3.6√(1 − b_0/b_0,5), 1 ≤ k_pb ≤ 2.5', kpb, '');
      R.eq('ρ_l', '√(ρ_x·ρ_y)', rhoP, '');
      R.eq('a_pd', L('a_pd = √(a_p·d_v/8) ≤ d_v, a_p = column face to nearest pile axis', 'a_pd = √(a_p·d_v/8) ≤ d_v'), apd, 'mm', '§8.4.3');
      R.eq('τ_Ed', 'τ_Ed = β_e·V_Ed/(b_0,5·d_v),  β_e = 1.15', tE, 'MPa');
      R.eq('τ_Rd,c', 'τ_Rd,c = (0.6/γ_V)·k_pb·(100ρ_l f_ck d_dg/a_pd)^{1/3} ≤ (0.5/γ_V)√f_ck', tR, 'MPa');
      urP = R.chk(L('Punching stress', 'หน่วยแรงเฉือนทะลุ'), tE, tR, 'MPa'); Vp = tE; VpR = tR;
      add('pc', L('Punching at column', 'เฉือนทะลุที่เสา'), tE, tR, 'MPa', urP);
    } else {
      const d = dav, bo = 2 * (cx + d) + 2 * (cy + d);
      const inside = piles.reduce((s, p, i) => s + ((Math.abs(p.x) <= cx / 2 + d / 2 && Math.abs(p.y) <= cy / 2 + d / 2) ? Pu[i] : 0), 0);
      const V = (+A.N) - inside;
      const beta = Math.max(cx, cy) / Math.min(cx, cy);
      let Vc;
      if (code === 'AS') { const fcv = Math.min(0.17 * (1 + 2 / beta), 0.34) * sq(m.fc); Vc = 0.7 * bo * d * fcv / 1e3; R.eq('u', 'u = 2(c_x + d_om) + 2(c_y + d_om)', bo, 'mm'); R.eq('f_cv', 'f_cv = 0.17(1 + 2/β_h)√f\'c ≤ 0.34√f\'c', fcv, 'MPa'); R.eq('φV_uo', 'φ·u·d_om·f_cv, φ = 0.7', Vc, 'kN'); }
      else { const ls = Math.min(1, sq(2 / (1 + 0.004 * d))); const vc = Math.min(0.33, 0.17 * (1 + 2 / beta), 0.083 * (2 + 40 * d / bo)) * ls * m.sqfc; Vc = 0.75 * vc * bo * d / 1e3; R.eq('b_o', 'b_o = 2(c_1 + d) + 2(c_2 + d)', bo, 'mm'); R.eq('v_c', 'min(0.33, 0.17(1+2/β), 0.083(2+α_s d/b_o))·λ_s·√f\'c', vc, 'MPa', 'Table 22.6.5.2'); R.eq('φV_c', 'φ·v_c·b_o·d, φ = 0.75', Vc, 'kN'); }
      urP = R.chk(L('Punching', 'เฉือนทะลุ'), V, Vc, 'kN'); add('pc', L('Punching at column', 'เฉือนทะลุที่เสา'), V, Vc, 'kN', urP);
    }
    // punching at pile (worst)
    R.sec(L('Punching shear — corner / edge pile', 'แรงเฉือนทะลุ — เสาเข็มริม/มุม'), code === 'EC2' ? '§8.4' : code === 'AS' ? '§9.3' : '22.6');
    let worstPile = null, skipped = false;
    piles.forEach((p, i) => {
      const a = g.Dp / 2 + dav / 2, cp = clippedPerim(p.x, p.y, a, X0, X1, Y0, Y1);
      if (cp.L <= 0 || cp.open >= 3) { skipped = true; return; }
      let cap;
      if (code === 'EC2') cap = Math.min(0.6 / m.gV * cbrt(100 * rhoP * m.fc * m.ddg / (res.apd || dav)), 0.5 / m.gV * sq(m.fc)) * cp.L * dav / 1e3;
      else if (code === 'AS') cap = 0.7 * 0.34 * sq(m.fc) * cp.L * dav / 1e3;
      else { const as = cp.open >= 2 ? 20 : cp.open === 1 ? 30 : 40, ls = Math.min(1, sq(2 / (1 + 0.004 * dav))); cap = 0.75 * Math.min(0.33, 0.083 * (2 + as * dav / cp.L)) * ls * m.sqfc * cp.L * dav / 1e3; }
      const u = Pu[i] / cap;
      if (!worstPile || u > worstPile.u) worstPile = { p, u, cap, P: Pu[i], L: cp.L };
    });
    if (worstPile) {
      R.eq(L('Critical pile', 'เข็มวิกฤต'), worstPile.p.id, '', '');
      R.eq(L('Perimeter (edges clipped)', 'เส้นรอบรูป (ตัดขอบ)'), 'u_p', worstPile.L, 'mm');
      const u = R.chk(L('Pile punching', 'เฉือนทะลุเข็ม'), worstPile.P, worstPile.cap, 'kN');
      add('pp', L('Punching at pile', 'เฉือนทะลุที่เข็ม'), worstPile.P, worstPile.cap, 'kN', u);
    }
    if (skipped) R.txt(L('Piles whose critical perimeter is cut by three cap edges (narrow caps such as 2-pile caps) are covered by the one-way shear check instead.', 'เข็มที่เส้นรอบรูปวิกฤตถูกขอบฐานรากตัดสามด้าน (เช่น ฐานรากเข็ม 2 ต้น) ตรวจสอบด้วยแรงเฉือนแบบคานแทน'));
    res.worstPile = worstPile;
    return Object.assign(res, { code, m, checks, rep: R, W, Nu });
  }

  // ---------------------------------------------------------------- shared rows
  function materialRows(R, m, lang) {
    const L = (a, b) => R.L(a, b);
    if (m.code === 'EC2') {
      R.eq('f_ck', L('Characteristic cylinder strength', 'กำลังอัดคอนกรีต'), m.fc, 'MPa');
      R.eq('η_cc', 'η_cc = (40/f_ck)^{1/3} ≤ 1.0', m.etacc, '', '(5.4)');
      R.eq('f_cd', 'f_cd = η_cc·k_tc·f_ck / γ_C = ' + f(m.etacc, 3) + ' × ' + f(m.ktc, 2) + ' × ' + m.fc + ' / ' + m.gC, m.fcd, 'MPa', '(5.3)');
      R.eq('f_yd', 'f_yd = f_yk / γ_S = ' + m.fy + ' / ' + m.gS, m.fyd, 'MPa');
      R.eq('f_ywd', 'f_ywd = f_ywk / γ_S', m.fywd, 'MPa');
      R.eq('f_ctm', 'f_ctm = 0.30·f_ck^{2/3}', m.fctm, 'MPa');
      R.eq('E_cm', 'E_cm = 22000·((f_ck + 8)/10)^{0.3}', m.Ec, 'MPa');
    } else if (m.code === 'AS') {
      R.eq('f\'c', L('Characteristic compressive strength', 'กำลังอัดคอนกรีต'), m.fc, 'MPa');
      R.eq('f_sy', L('Reinforcement yield', 'กำลังคราก'), m.fy, 'MPa'); R.eq('f_sy.f', L('Fitment yield', 'กำลังครากปลอก'), m.fyt, 'MPa');
      R.eq('f\'ct.f', 'f\'ct.f = 0.6√f\'c', m.fct, 'MPa', '§3.1.1.3'); R.eq('E_c', 'Table 3.1.2', m.Ec, 'MPa');
    } else {
      R.eq('f\'c', L('Specified cylinder strength', 'กำลังอัดคอนกรีตทรงกระบอก'), m.fc, 'MPa', f(m.fc / KSC, 0) + ' ksc');
      R.eq('f_y', L('Longitudinal bar yield', 'กำลังครากเหล็กยืน'), m.fy, 'MPa', f(m.fy / KSC, 0) + ' ksc');
      R.eq('f_yt', L('Transverse bar yield', 'กำลังครากเหล็กปลอก'), m.fyt, 'MPa', f(m.fyt / KSC, 0) + ' ksc');
      R.eq('E_c', 'E_c = 4700√f\'c', m.Ec, 'MPa', '19.2.2');
      R.eq('β₁', 'β₁ = 0.85 − 0.05(f\'c − 28)/7, 0.65 ≤ β₁ ≤ 0.85', m.beta1, '', '22.2.2.4.3');
    }
  }
  function blockRows(R, m, lang) {
    const L = (a, b) => R.L(a, b);
    if (m.code === 'EC2') { R.eq('λ, η', L('Rectangular stress block', 'บล็อกหน่วยแรงสี่เหลี่ยม'), f(m.lam, 2) + ', ' + f(m.eta, 2), '', '§8.1.2'); R.eq('ε_cu', '', m.ecu * 1000, '‰'); }
    else if (m.code === 'AS') { R.eq('α₂', 'α₂ = 0.85 − 0.0015f\'c ≥ 0.67', m.alpha2, '', '§8.1.3'); R.eq('γ', 'γ = 0.97 − 0.0025f\'c ≥ 0.67', m.gamma, ''); R.eq('ε_cu', '', 3, '‰'); }
    else { R.eq('β₁', 'a = β₁·c,  σ = 0.85f\'c', m.beta1, '', '22.2.2'); R.eq('ε_cu', '', 3, '‰'); }
  }
  function barName(code, d) { return code === 'EC2' ? 'H' + d : code === 'AS' ? 'N' + d : 'DB' + d; }
  function linkName(code, d, s) { return (code === 'TH' ? (d <= 9 ? 'RB' : 'DB') : code === 'AS' ? 'N' : 'H') + d + '@' + s; }

  G.RC = { designBeam, designColumn, designPileCap, material, layoutBeam, layoutColumn, pileLayout, f, barName, linkName, KSC, TF, barA, Rep };
})(typeof window !== 'undefined' ? window : globalThis);
