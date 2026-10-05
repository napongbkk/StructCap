/* StructCap Timber — timber bridge load rating and refurbishment assessment (pure, no DOM).
   Method after MRWA practice (TIMBAR procedure, Load Rating & Refurbishment Design Manual for Existing Timber
   Bridges): working stress design to AS 1720.1-1988, k1 by road type, no load or capacity factors, live load
   multiplied by (1 + DLA). Each span is a grillage of stringers and transverse deck members; vehicles are stepped
   across and along the span; stringers, pier and abutment piles, halfcaps, halfcap bearing, deck planks and wing
   wall piles are rated in tonnes and as % of T44 / M1600.
   Units: geometry m (section inputs mm), forces kN, moments kNm, stresses MPa. */
(function (G) {
  'use strict';
  const PI = Math.PI, sq = Math.sqrt, abs = Math.abs, max = Math.max, min = Math.min;

  // ------------------------------------------------------------------ materials (LRRD Table B2.3 basic working stresses, MPa)
  const GRADES = {
    F34: { fb: 34.5, ft: 20.7, fs: 2.45, fc: 26.0, E: 21500, rho: 1.26 }, F27: { fb: 27.5, ft: 16.5, fs: 2.05, fc: 20.5, E: 18500, rho: 1.22 },
    F22: { fb: 22.0, ft: 13.2, fs: 1.70, fc: 16.5, E: 16000, rho: 1.18 }, F17: { fb: 17.0, ft: 10.2, fs: 1.45, fc: 13.0, E: 14000, rho: 1.13 },
    F14: { fb: 14.0, ft: 8.4, fs: 1.25, fc: 10.2, E: 12000, rho: 1.10 }, F11: { fb: 11.0, ft: 6.6, fs: 1.05, fc: 8.4, E: 10500, rho: 1.06 },
    F8: { fb: 8.6, ft: 5.2, fs: 0.85, fc: 6.6, E: 9100, rho: 1.01 }, F7: { fb: 6.9, ft: 4.1, fs: 0.70, fc: 5.2, E: 7900, rho: 0.98 },
    F5: { fb: 5.5, ft: 3.3, fs: 0.60, fc: 4.1, E: 6900, rho: 0.95 }, F4: { fb: 4.3, ft: 2.6, fs: 0.50, fc: 3.3, E: 6100, rho: 0.91 }
  };
  // species: default grades per element (LRRD 1.5 / workshop), compression perpendicular F'p, density kN/m3
  const SPECIES = {
    jarrah: { n: 'Jarrah', stringer: 'F17', sawn: 'F14', pile: 'F17', halfcap: 'F14', deck: 'F7', fp: 6.6, gamma: 10.8 },
    wandoo: { n: 'Wandoo', stringer: 'F27', sawn: 'F17', pile: 'F27', halfcap: 'F17', deck: 'F11', fp: 7.8, gamma: 12.3 },
    wjE: { n: 'Wandoo with Jarrah E', stringer: 'F27', sawn: 'F17', pile: 'F27', halfcap: 'F17', deck: 'F11', fp: 7.8, gamma: 12.3, E: 14000 },
    karri: { n: 'Karri', stringer: 'F22', sawn: 'F22', pile: 'F22', halfcap: 'F22', deck: 'F8', fp: 9.0, gamma: 11.3 },
    marri: { n: 'Marri', stringer: 'F22', sawn: 'F17', pile: 'F17', halfcap: 'F17', deck: 'F8', fp: 7.8, gamma: 11.0, friableIsRot: true },
    steel: { n: 'Steel', gamma: 77 }
  };
  // condition factors on permissible stresses (Table 3-1): bending/axial compression, bending tension, shear
  const COND = { G: { c: 1, t: 1, s: 1 }, F: { c: 0.85, t: 0.70, s: 0.70 }, R: { c: 0.15, t: 0.10, s: 0.10 } };
  const condOf = (c, sp) => COND[(c === 'F' && SPECIES[sp] && SPECIES[sp].friableIsRot) ? 'R' : c] || COND.G;
  const K1 = road => (road === 'main' ? 1.40 : 1.65);
  // permissible steel stresses AS 3990: Gr250 167 / 92.5, Gr300 200 / 111 MPa
  const STEELGR = { 250: { fb: 167, fs: 92.5 }, 300: { fb: 200, fs: 111 } };
  // a few common replacement stringer sections when the section library is not loaded (A mm2, I mm4, d mm, tw mm)
  const UBX = { '410UB54': { A: 6890, I: 188e6, d: 403, tw: 7.6, bf: 178, tf: 10.9 }, '410UB60': { A: 7640, I: 216e6, d: 406, tw: 7.8, bf: 178, tf: 12.8 }, '360UB57': { A: 7240, I: 161e6, d: 359, tw: 8.0, bf: 172, tf: 13.0 }, '460UB67': { A: 8540, I: 296e6, d: 454, tw: 8.5, bf: 190, tf: 12.7 }, '530UB82': { A: 10500, I: 477e6, d: 528, tw: 9.6, bf: 209, tf: 13.2 }, '310UC97': { A: 12300, I: 222e6, d: 308, tw: 9.9, bf: 305, tf: 15.4 }, '250UC73': { A: 9320, I: 114e6, d: 254, tw: 8.6, bf: 254, tf: 14.2 } };
  function steelSec(name) {
    if (name && typeof name === 'object') return name;
    const L = G.STEELLIB; let p = null;
    if (L) for (const lib of ['UB', 'UC']) { const q = L.find(lib, name); if (q) { p = q; break; } }
    if (p) { const I = max(p.Iz || 0, p.Iy || 0); return { name, A: p.A, I, d: p.d, tw: p.tw, bf: p.bf, tf: p.tf, ymax: p.d / 2, Aw: p.d * p.tw }; }
    const q = UBX[name] || UBX['410UB54']; return { name: UBX[name] ? name : '410UB54', A: q.A, I: q.I, d: q.d, tw: q.tw, bf: q.bf, tf: q.tf, ymax: q.d / 2, Aw: q.d * q.tw };
  }

  // ------------------------------------------------------------------ polygon helpers (mm)
  function polyProps(P) { // area, centroid, I about horizontal axis through origin (signed area made positive)
    let A = 0, cy = 0, cx = 0, Ix = 0; const n = P.length;
    for (let i = 0; i < n; i++) { const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % n], c = x0 * y1 - x1 * y0; A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c; Ix += (y0 * y0 + y0 * y1 + y1 * y1) * c; }
    A /= 2; if (!A) return { A: 0, cx: 0, cy: 0, Ix0: 0 }; cx /= 6 * A; cy /= 6 * A; Ix /= 12; const s = Math.sign(A); return { A: abs(A), cx, cy, Ix0: Ix * s };
  }
  function clipHalf(P, keep) { // Sutherland–Hodgman against a half-plane keep(p) -> {in:boolean} with intersect(p,q)
    const out = []; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], ia = keep.f(a) >= 0, ib = keep.f(b) >= 0; if (ia) out.push(a); if (ia !== ib) { const fa = keep.f(a), fb = keep.f(b), t = fa / (fa - fb); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); } } return out;
  }
  const below = y => ({ f: p => y - p[1] }), above = y => ({ f: p => p[1] - y });
  function clipConvex(P, C) { // clip polygon P by convex polygon C (counter-clockwise)
    let out = P; for (let i = 0; i < C.length && out.length; i++) { const a = C[i], b = C[(i + 1) % C.length]; out = clipHalf(out, { f: p => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) }); } return out;
  }
  const ellipse = (cx, cy, a, b, n) => { const P = []; n = n || 72; for (let i = 0; i < n; i++) { const t = 2 * PI * i / n; P.push([cx + a * Math.cos(t), cy + b * Math.sin(t)]); } return P; };

  // ------------------------------------------------------------------ stringer section (TIMBAR App B)
  // st: { W top-cut width (999 = square sawn), H horizontal, V vertical (mm), F oval factor (0 = auto), def 0|1|1.5|2,
  //       R pipe radius (type 1), Vs solid bottom, L solid left, Rr solid right, Ts solid top (type 1.5) }, end: true at the ends
  function stringerSection(st, end) {
    const H = +st.H || 300, V = +st.V || H, W = +st.W || 0, def = +st.def || 0;
    let outerRound, outerCut, a, b, ytop, ybot, ybotRound, F;
    if (W >= 999) { // square sawn
      a = H / 2; b = V / 2; ytop = b; ybot = -b; ybotRound = -b; F = V / H;
      outerRound = outerCut = [[-a, -b], [a, -b], [a, b], [-a, b]];
    } else {
      a = H / 2; const r = sq(max(0, 1 - Math.pow(min(W, H) / H, 2)));
      const Fmin = 2 * V / (H * (1 + r));
      if (!end) F = Fmin; else { F = +st.F || 0; if (!F) F = max(1, Fmin); if (F < Fmin) F = Fmin; }
      b = F * a; ytop = b * r; ybotRound = -b; ybot = end ? -(V - ytop) : -b;
      const E = ellipse(0, 0, a, b, 72);
      outerRound = clipHalf(E, below(ytop));
      outerCut = end ? clipHalf(outerRound, above(ybot)) : outerRound;
    }
    // void
    let voidP = null;
    if (def === 1 && +st.R > 0) voidP = ellipse(0, 0, +st.R, +st.R, 72);
    else if (def === 1.5) { const x0 = -a + (+st.L || 0), x1 = a - (+st.Rr || 0), y0 = ybot + (+st.Vs || 0), y1 = ytop - (+st.Ts || 0); if (x1 > x0 && y1 > y0) voidP = ellipse((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, 72); }
    else if (def === 2) { const x0 = -a + (+st.L || 0), x1 = a - (+st.Rr || 0), yb = ybot + (+st.Vs || 0); if (x1 > x0 && yb < 0) { const ax = (x1 - x0) / 2, cx = (x0 + x1) / 2, by = -yb; voidP = []; for (let i = 0; i <= 36; i++) { const t = PI + PI * i / 36; voidP.push([cx + ax * Math.cos(t), by * Math.sin(t)]); } const wt = W >= 999 ? a : W / 2; voidP.push([min(x1, wt), ytop + 1], [max(x0, -wt), ytop + 1]); } }
    const cutV = voidP ? clipConvex(voidP, outerRound) : null, vp = cutV && cutV.length > 2 ? polyProps(cutV) : { A: 0, cx: 0, cy: 0, Ix0: 0 };
    const pc = polyProps(outerCut), pr = polyProps(outerRound);
    const net = (p) => { const A = p.A - vp.A, cy = (p.A * p.cy - vp.A * vp.cy) / A, I0 = p.Ix0 - vp.Ix0; return { A, cy, I: I0 - A * cy * cy }; };
    const nc = net(pc), nr = net(pr);
    const ys = (end ? outerCut : outerRound).map(p => p[1]), yMax = max(...ys), yMin = min(...ys);
    const ref = end ? nr : nr; // stiffness: round-bottom section minus void
    return { A: nc.A, Ag: pr.A, I: ref.I, ymax: max(yMax - ref.cy, ref.cy - min(...outerRound.map(p => p[1]))), F, ytop, ybot, b, a, outer: end ? outerCut : outerRound, round: outerRound, void: cutV && cutV.length > 2 ? cutV : null };
  }

  // ------------------------------------------------------------------ pile section (circle with defect; mm)
  // p: { d, def 0|1|2, r (type 1 pipe radius), L, R, B (back), F (front) solid thicknesses (type 2) }
  function pileSection(p) {
    const d = +p.d || 300, R = d / 2, def = +p.def || 0, A0 = PI * R * R, I0 = PI * Math.pow(d, 4) / 64;
    let A = A0, I = I0, yc = 0, Zb, Zf;
    if (def === 1 && +p.r > 0) { const r = +p.r; A = A0 - PI * r * r; I = I0 - PI * Math.pow(r, 4) / 4; }
    else if (def === 2) { const a = (d - (+p.L || 0) - (+p.R || 0)) / 2, b = (d - (+p.B || 0) - (+p.F || 0)) / 2; if (a > 0 && b > 0) { const off = ((+p.B || 0) - (+p.F || 0)) / 2, Av = PI * a * b, Iv = PI * a * b * b * b / 4; A = A0 - Av; yc = -Av * off / A; I = I0 - (Iv + Av * off * off) - A * yc * yc; } }
    Zb = I / (R + yc); Zf = I / (R - yc); // back fibre at +R? (back thicker -> hole shifts to front; sign irrelevant for min)
    return { d, A, I, Zb: min(Zb, Zf) === Zb ? Zb : Zb, Zf, Zmin: min(Zb, Zf), Zmax: max(Zb, Zf), r: sq(I / A), loss: 1 - A / A0, A0, I0, Z0: I0 / R };
  }

  // ------------------------------------------------------------------ vehicles (TIMBAR App A); axles [x from front (m), load kN], wheel lines (m from vehicle CL)
  const g = 9.81;
  function vehicle(id, o) {
    o = o || {};
    const W2 = (load, xs, lines) => xs.map((x, i) => ({ x, P: Array.isArray(load) ? load[i] : load, lines }));
    const L2 = w => [-w / 2, w / 2];
    switch (id) {
      case 'T44': { const A = +o.A || 0; const vs = (A ? [A] : [3, 4, 5, 6, 7, 8]).map(a => ({ name: 'A=' + a, axles: W2([48, 96, 96, 96, 96], [0, 3.7, 4.9, 4.9 + a, 6.1 + a], L2(1.8)) })); return { id, n: 'T44', W: 44.04, Wk: 432, dla: 0.30, side: 0.6, width: 1.8, models: vs, pair: 0.9 }; }
      case 'MT': return { id, n: 'M-Truck', W: 10, Wk: 100, dla: 0.30, side: 0.6, width: 1.8, models: [{ name: '', axles: W2([20, 80], [0, 4.25], L2(1.8)) }] };
      case 'TA': return { id, n: 'Tandem', W: 18, Wk: 180, dla: 0.30, side: 0.6, width: 1.8, pm: true, models: [{ name: '', axles: W2(90, [0, 1.2], L2(1.8)) }] };
      case 'TR': return { id, n: 'Triaxle', W: 27, Wk: 270, dla: 0.30, side: 0.6, width: 1.8, pm: true, models: [{ name: '', axles: W2(90, [0, 1.2, 2.4], L2(1.8)) }] };
      case 'QU': return { id, n: 'Quad', W: 36, Wk: 360, dla: 0.30, side: 0.6, width: 1.8, pm: true, models: [{ name: '', axles: W2(90, [0, 1.2, 2.4, 3.6], L2(1.8)) }] };
      case 'Q4': return { id, n: '484 Quad', W: 36, Wk: 360, dla: 0.30, side: 0.6, width: 1.8, pm: true, models: [{ name: '', axles: W2(90, [0, 1.2, 3.6, 4.8], L2(1.8)) }] };
      case 'H3': return { id, n: 'HLP320', W: 320, Wk: 3200, dla: 0.10, side: 0.25, width: 3.1, centre: 1.0, models: [{ name: '', axles: W2(200, Array.from({ length: 16 }, (_, i) => 1.8 * i), [-1.55, -0.65, 0.65, 1.55]) }] };
      case 'H4': return { id, n: 'HLP400', W: 400, Wk: 4000, dla: 0.10, side: 0.25, width: 4.0, centre: 1.0, models: [{ name: '', axles: W2(250, Array.from({ length: 16 }, (_, i) => 1.8 * i), [-2.0, -1.1, 1.1, 2.0]) }] };
      // models 2 / 3: wider multi-wheel axles (axle width 2.6 / 3.2 m, dual-wheel spacing B 1.1 / 1.7 m), 540 / 720 kN, DLA 0.10
      case 'TR2': case 'TR3': case 'QU2': case 'QU3': case 'Q42': case 'Q43': {
        const m3 = id.slice(-1) === '3', w = m3 ? 3.2 : 2.6, Bd = m3 ? 1.7 : 1.1, lines = [-w / 2, -w / 2 + Bd, w / 2 - Bd, w / 2], tri = id[0] === 'T', four = id[1] === '4';
        const xs = tri ? [0, 1.8, 3.6] : four ? [0, 1.2, 3.6, 4.8] : [0, 1.2, 2.4, 3.6], Wk = tri ? 540 : 720;
        return { id, n: (tri ? 'Triaxle' : four ? '484 Quad' : 'Quad') + ' model ' + id.slice(-1), W: Wk / 10, Wk, dla: 0.10, side: 0.6, width: w, opt: true, models: [{ name: '', axles: W2(Wk / xs.length, xs, lines) }] };
      }
      case 'M16': { const xs = []; let x = 0; [0, 3.75, 6.25, 5.0].forEach((gap, k) => { x += k ? gap : 0; for (let i = 0; i < 3; i++) { xs.push(x); x += i < 2 ? 1.25 : 0; } }); return { id, n: 'M1600', W: 144, Wk: 1440, dla: 0.35, side: 0.6, width: 2.0, models: [{ name: '', axles: W2(120, xs, L2(2.0)) }], pair: 'm1600', udl: 6.0 }; }
      default: return null;
    }
  }
  const VEH_ORDER = ['T44', 'MT', 'TA', 'TR', 'QU', 'Q4', 'H3', 'H4', 'M16', 'TR2', 'TR3', 'QU2', 'QU3', 'Q42', 'Q43'];
  // vehicles rated for a bridge: standard ones unless switched off (B.veh.off), optional ones (models 2 / 3) only when switched on (B.veh.on)
  const vehOn = (B, k) => { const v = vehicle(k); return v && (v.opt ? ((B.veh && B.veh.on) || []).includes(k) : !((B.veh && B.veh.off) || []).includes(k)); };
  // prime mover for tandem / tri / quad groups (6 t steer 3.7 m ahead of a 16.5 t drive tandem, 3 m to the trailer group)
  const PRIME = [{ dx: -3.0 - 1.2 - 3.7, P: 60 }, { dx: -3.0 - 1.2, P: 82.5 }, { dx: -3.0, P: 82.5 }];

  // ------------------------------------------------------------------ linear algebra (dense Cholesky)
  function chol(K, n) { const L = new Float64Array(n * n); for (let j = 0; j < n; j++) { let s = K[j * n + j]; for (let k = 0; k < j; k++) s -= L[j * n + k] * L[j * n + k]; if (s <= 1e-12 * abs(K[j * n + j] || 1)) return null; const d = sq(s); L[j * n + j] = d; for (let i = j + 1; i < n; i++) { let t = K[i * n + j]; for (let k = 0; k < j; k++) t -= L[i * n + k] * L[j * n + k]; L[i * n + j] = t / d; } } return L; }
  function cholSolve(L, n, b) { const y = Float64Array.from(b); for (let i = 0; i < n; i++) { let s = y[i]; for (let k = 0; k < i; k++) s -= L[i * n + k] * y[k]; y[i] = s / L[i * n + i]; } for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= L[k * n + i] * y[k]; y[i] = s / L[i * n + i]; } return y; }

  // ------------------------------------------------------------------ span model
  // span: { L, Lo, ndiv, spacing:[edge->S1, S1->S2, ..., Sn->edge], deck:{t, E, gamma}, stringers:[...], patches:[...] }
  function spanGeom(B, si) {
    const S = B.spans[si], L = +S.L, Lo = +S.Lo || (L - (si === 0 || si === B.spans.length - 1 ? 1.05 : 1.5)), Le = (L + Lo) / 2;
    const sp = (S.spacing || []).map(Number), ns = S.stringers.length, ys = []; let y = sp[0] || 0; for (let i = 0; i < ns; i++) { ys.push(y); y += sp[i + 1] || 0; }
    const width = +S.width || sp.reduce((a, v) => a + v, 0);
    let xs0, xs1; const nsp = B.spans.length, ab0 = si === 0, ab1 = si === nsp - 1;
    // face of support for shear: 0.3 m from an abutment centreline, the rest of (L - Lo) at a pier
    const cl = L - Lo; let xf0 = cl / 2, xf1 = L - cl / 2;
    if (ab0 && ab1) { xf0 = min(0.3, cl / 2); xf1 = L - xf0; } // single span: both faces 0.3 m from the abutment centrelines
    else if (ab0) { xf0 = min(0.3, cl); xf1 = L - max(0, cl - xf0); } else if (ab1) { xf1 = L - min(0.3, cl); xf0 = max(0, cl - (L - xf1)); }
    if (S.face1 != null) xf0 = +S.face1; if (S.face2 != null) xf1 = L - (+S.face2);
    xs0 = xf0 / 2; xs1 = L - (L - xf1) / 2; // effective supports mid-way between the centreline and the face (Le = (L + Lo)/2)
    if (ab0 && ab1 && S.face1 == null && S.face2 == null) { xs0 = (L - Le) / 2; xs1 = L - xs0; }
    const kerbL = S.kerbL != null ? +S.kerbL : 0.15, kerbR = S.kerbR != null ? +S.kerbR : 0.15;
    return { L, Lo, Le, ys, ns, width, xs0, xs1, xf0, xf1, cw0: kerbL, cw1: width - kerbR };
  }
  // section properties at the three stations of every stringer
  function stringerProps(B, S) {
    return S.stringers.map(s => {
      const mat = s.mat || 'jarrah';
      if (mat === 'steel') { const q = steelSec(s.steel || '410UB54'); const st = { A: q.A, Ag: q.A, I: q.I, ymax: q.ymax, Aw: q.Aw }; return { mat, steel: q.name, e1: st, mid: st, e2: st, E: 200000, gamma: 77 }; }
      const sp = SPECIES[mat] || SPECIES.jarrah, gr = GRADES[s.grade || sp.stringer] || GRADES.F17;
      return { mat, e1: stringerSection(s.e1 || {}, true), mid: stringerSection(s.mid || s.e1 || {}, false), e2: stringerSection(s.e2 || s.e1 || {}, true), E: sp.E || gr.E, gamma: s.gamma || 10.8 };
    });
  }
  // grillage: nodes along each stringer at the shared stations x[]; transverse deck members at each station
  function buildGrillage(B, si) {
    const S = B.spans[si], gm = spanGeom(B, si), P = stringerProps(B, S), ns = gm.ns, nd = Math.max(4, (+S.ndiv || 12) & ~1);
    const xmid = (gm.xs0 + gm.xs1) / 2; let xs = [gm.xs0, gm.xs1, xmid, gm.xf0, gm.xf1]; for (let i = 1; i < nd; i++) xs.push(gm.xs0 + (gm.Le * i) / nd);
    for (let i = 8; i <= 16; i++) xs.push(gm.xs0 + gm.Le * i / 24); // middle third at Le / 24 for the maximum moment
    xs = [...new Set(xs.map(v => Math.round(v * 1e4) / 1e4))].sort((a, b) => a - b).filter((v, i, a) => !i || v - a[i - 1] > 0.02);
    const nx = xs.length, nn = nx * ns, N = 3 * nn, K = new Float64Array(N * N), id = (s, i) => s * nx + i;
    const deck = S.deck || {}, Ed = (+deck.E || 7900) * 1e3, td = +deck.t || 0.127, Jd = +deck.J || 1e-6;
    const interp = (s, x, key) => { const p = P[s], xm = gm.L / 2, a = x <= xm ? p.e1 : p.e2, w = x <= xm ? (x - gm.xs0) / (xm - gm.xs0) : (gm.xs1 - x) / (gm.xs1 - xm); const t = Math.max(0, Math.min(1, w)); return a[key] + (p.mid[key] - a[key]) * t; };
    const addMember = (na, nb, c, s, l, EI, GJ) => { // c,s direction cosines; dofs [w, phx, phy]
      const k = [[12 / l ** 3, 6 / l ** 2, -12 / l ** 3, 6 / l ** 2], [6 / l ** 2, 4 / l, -6 / l ** 2, 2 / l], [-12 / l ** 3, -6 / l ** 2, 12 / l ** 3, -6 / l ** 2], [6 / l ** 2, 2 / l, -6 / l ** 2, 4 / l]].map(r => r.map(v => v * EI));
      // local dofs: w_a, sl_a(bending slope), tw_a(twist), w_b, sl_b, tw_b ; global: w, phx, phy ; sl = c phx + s phy ; tw = -s phx + c phy
      const T = [[1, 0, 0], [0, c, s], [0, -s, c]], kl = Array.from({ length: 6 }, () => new Float64Array(6)), mp = [0, 1, 3, 4];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) kl[mp[i]][mp[j]] = k[i][j];
      const kt = GJ / l; kl[2][2] += kt; kl[5][5] += kt; kl[2][5] -= kt; kl[5][2] -= kt;
      const dofs = [3 * na, 3 * na + 1, 3 * na + 2, 3 * nb, 3 * nb + 1, 3 * nb + 2];
      const Tg = (r, cI) => { const bi = r < 3 ? 0 : 3, bj = cI < 3 ? 0 : 3; return bi === bj ? T[r - bi][cI - bj] : 0; };
      for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { let v = 0; for (let p = 0; p < 6; p++) { const tpi = Tg(p, i); if (!tpi) continue; for (let q = 0; q < 6; q++) { const tqj = Tg(q, j); if (tqj) v += tpi * kl[p][q] * tqj; } } K[dofs[i] * N + dofs[j]] += v; }
      return { na, nb, c, s, l, EI, GJ, kl, T };
    };
    const strEl = [], trEl = [];
    for (let s = 0; s < ns; s++) for (let i = 0; i + 1 < nx; i++) { const xm = (xs[i] + xs[i + 1]) / 2, I = interp(s, xm, 'I') * 1e-12, E = P[s].E * 1e3; strEl.push(Object.assign(addMember(id(s, i), id(s, i + 1), 1, 0, xs[i + 1] - xs[i], E * I, E / 15 * 1e-6), { s, i })); }
    for (let i = 0; i < nx; i++) { const trib = ((i ? xs[i] - xs[i - 1] : 0) + (i < nx - 1 ? xs[i + 1] - xs[i] : 0)) / 2; for (let s = 0; s + 1 < ns; s++) { const l = gm.ys[s + 1] - gm.ys[s]; if (l <= 0) continue; trEl.push(addMember(id(s, i), id(s + 1, i), 0, 1, l, Ed * trib * td * td * td / 12, Ed / 2.6 * Jd)); } }
    // supports: w = 0 at xs0 and xs1 on every stringer
    const i0 = xs.indexOf(Math.round(gm.xs0 * 1e4) / 1e4), i1 = xs.indexOf(Math.round(gm.xs1 * 1e4) / 1e4), fixed = new Set();
    for (let s = 0; s < ns; s++) { fixed.add(3 * id(s, i0)); fixed.add(3 * id(s, i1)); }
    const free = [], map = new Int32Array(N).fill(-1); for (let d = 0; d < N; d++) if (!fixed.has(d)) { map[d] = free.length; free.push(d); }
    const n = free.length, Kf = new Float64Array(n * n); for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) Kf[a * n + b] = K[free[a] * N + free[b]];
    // tiny rotational spring for nodes that might otherwise float (single stringer bridges)
    for (let a = 0; a < n; a++) if (free[a] % 3) Kf[a * n + a] += 1e-6;
    const Lc = chol(Kf, n); if (!Lc) throw new Error('Span ' + (si + 1) + ': the grillage is unstable — check stringer spacings and sections.');
    const ix = v => xs.findIndex(q => abs(q - v) < 1e-3), im = ix(xmid), if0 = ix(gm.xf0), if1 = ix(gm.xf1);
    // effects per unit nodal load: for each stringer [M_mid, V_face1, V_face2, R_support0, R_support1, M at every node...]
    const NE = 5 + nx, infl = new Float64Array(nn * ns * NE);
    const elemOf = (s, i) => strEl[s * (nx - 1) + i];
    const endForces = (el, u) => { const ug = [u[3 * el.na], u[3 * el.na + 1], u[3 * el.na + 2], u[3 * el.nb], u[3 * el.nb + 1], u[3 * el.nb + 2]], ul = new Float64Array(6); for (let p = 0; p < 6; p++) { const bi = p < 3 ? 0 : 3; for (let q = 0; q < 3; q++) ul[p] += el.T[p - bi][q] * ug[bi + q]; } const f = new Float64Array(6); for (let p = 0; p < 6; p++) for (let q = 0; q < 6; q++) f[p] += el.kl[p][q] * ul[q]; return f; };
    const effects = (u, load) => { // load: Float64Array(nn) of applied w loads (kN) -> per stringer effects
      const out = new Float64Array(ns * NE);
      for (let s = 0; s < ns; s++) {
        const fm = endForces(elemOf(s, im - 1), u); out[s * NE] = -fm[4]; // sagging moment at midspan (w down)
        // shear at the face of support on the support side (an axle standing on the face is included, as TIMBAR)
        const f1 = endForces(elemOf(s, max(0, if0 - 1)), u); out[s * NE + 1] = -f1[3];
        const f2 = endForces(elemOf(s, min(nx - 2, if1)), u); out[s * NE + 2] = f2[0];
        // support reactions (upward +): load at node minus element forces at the node
        const rx = (i) => { const nd2 = id(s, i); let r = load[nd2]; strEl.concat(trEl).forEach(el => { if (el.na === nd2 || el.nb === nd2) { const f = endForces(el, u); r -= el.na === nd2 ? f[0] : f[3]; } }); return r; };
        out[s * NE + 3] = rx(i0); out[s * NE + 4] = rx(i1);
        for (let i = i0 + 1; i < i1; i++) out[s * NE + 5 + i] = -endForces(elemOf(s, i - 1), u)[4];
      }
      return out;
    };
    const solveLoad = (load) => { const b = new Float64Array(n); for (let k = 0; k < nn; k++) if (load[k]) { const m = map[3 * k]; if (m >= 0) b[m] += load[k]; } const uf = cholSolve(Lc, n, b), u = new Float64Array(N); for (let a = 0; a < n; a++) u[free[a]] = uf[a]; return u; };
    for (let k = 0; k < nn; k++) { const load = new Float64Array(nn); load[k] = 1; const e = effects(solveLoad(load), load); infl.set(e, k * ns * NE); }
    return { si, gm, P, xs, nx, ns, nn, id, infl, NE, i0, i1, im, if0, if1, strEl, trEl };
  }
  // distribute a point load P at (x, y) to grillage nodes (statics: lever rule across, linear along); out-of-span loads go to the support
  function pointToNodes(Gr, x, y, P, acc) {
    const gm = Gr.gm, ys = gm.ys, xs = Gr.xs, ns = Gr.ns, nx = Gr.nx;
    let sa, sb, wa;
    if (ns === 1 || y <= ys[0]) { sa = sb = 0; wa = 1; } else if (y >= ys[ns - 1]) { sa = sb = ns - 1; wa = 1; } else { sb = ys.findIndex(v => v >= y); sa = sb - 1; wa = (ys[sb] - y) / (ys[sb] - ys[sa]); }
    let xa, xb, wx;
    if (x <= xs[0]) { xa = xb = 0; wx = 1; } else if (x >= xs[nx - 1]) { xa = xb = nx - 1; wx = 1; } else { xb = xs.findIndex(v => v >= x); xa = xb - 1; wx = (xs[xb] - x) / (xs[xb] - xs[xa]); }
    const add = (s, i, w) => { if (w) acc[s * nx + i] += P * w; };
    add(sa, xa, wa * wx); add(sa, xb, wa * (1 - wx)); if (sb !== sa) { add(sb, xa, (1 - wa) * wx); add(sb, xb, (1 - wa) * (1 - wx)); } else if (wa !== 1) { /* single */ }
  }
  function effectsOf(Gr, load) { const ns = Gr.ns, NE = Gr.NE, out = new Float64Array(ns * NE); for (let k = 0; k < Gr.nn; k++) { const p = load[k]; if (!p) continue; const o = k * ns * NE; for (let j = 0; j < ns * NE; j++) out[j] += p * Gr.infl[o + j]; } return out; }

  // ------------------------------------------------------------------ dead load
  function deadLoad(B, si, Gr) {
    const S = B.spans[si], gm = Gr.gm, load = new Float64Array(Gr.nn), xs = Gr.xs, nx = Gr.nx;
    // stringer self weight (gross area, round bottom) as nodal loads by tributary length
    for (let s = 0; s < Gr.ns; s++) { const p = Gr.P[s]; for (let i = 0; i < nx; i++) { const a = i ? (xs[i] - xs[i - 1]) / 2 : 0, b = i < nx - 1 ? (xs[i + 1] - xs[i]) / 2 : 0, xm = gm.L / 2, st = xs[i] <= xm ? p.e1 : p.e2, w = xs[i] <= xm ? (xs[i] - gm.xs0) / (xm - gm.xs0) : (gm.xs1 - xs[i]) / (gm.xs1 - xm), t = Math.max(0, Math.min(1, w)), Ag = (st.Ag + (p.mid.Ag - st.Ag) * t) * 1e-6; load[s * nx + i] += Ag * p.gamma * (a + b); }
      // the part of the stringer between the support and the span end is carried directly
    }
    // deck (transverse members) and patch loads: integrate on a fine grid over the full span length
    const deck = S.deck || {}, td = +deck.t || 0.127, gd = +deck.gamma || 10.8, dx = 0.05, dy = 0.05;
    const patches = [{ gamma: gd, x: 0, y: 0, lx: gm.L, ly: gm.width, t: [td, td, td, td] }].concat(S.patches || []);
    patches.forEach(pa => { const lx = +pa.lx || gm.L, ly = +pa.ly || 0, x0 = +pa.x || 0, y0 = +pa.y || 0, t = (pa.t || []).map(Number), gam = +pa.gamma || 0; if (!ly || !gam) return;
      const [tA2R, tA1R, tA2L, tA1L] = [t[0] || 0, t[1] || 0, t[2] || 0, t[3] || 0];
      for (let x = x0 + dx / 2; x < x0 + lx; x += dx) for (let y = y0 + dy / 2; y < y0 + ly; y += dy) { const u = (x - x0) / lx, v = (y - y0) / ly, tt = (1 - u) * (1 - v) * tA1L + u * (1 - v) * tA2L + (1 - u) * v * tA1R + u * v * tA2R; if (tt > 0) pointToNodes(Gr, x, y, tt * gam * dx * dy, load); } });
    return { load, eff: effectsOf(Gr, load) };
  }

  // ------------------------------------------------------------------ vehicle envelopes on a span
  function lateralPositions(gm, ys, veh, cw0, cw1) {
    // vehicle centreline positions: each wheel line over each stringer, within the carriageway less side clearances
    const lines = veh.lines, half = max(...lines.map(abs)), lo = cw0 + veh.side + half, hi = cw1 - veh.side - half;
    if (hi < lo - 1e-9) return [];
    let pos = [lo, hi]; ys.forEach(y => lines.forEach(l => { const c = y - l; if (c >= lo - 1e-9 && c <= hi + 1e-9) pos.push(c); }));
    if (veh.centre != null) { const cc = (cw0 + cw1) / 2; pos = pos.map(c => Math.max(cc - veh.centre, Math.min(cc + veh.centre, c))); }
    return [...new Set(pos.map(v => Math.round(v * 1000) / 1000))].sort((a, b) => a - b);
  }
  function trainOf(v, model, L, withPrime) { // list of {x, P, lines}
    const ax = model.axles.map(a => ({ x: a.x, P: a.P, lines: a.lines }));
    if (withPrime) PRIME.forEach(p => ax.push({ x: p.dx, P: p.P, lines: [-0.9, 0.9] }));
    const x0 = min(...ax.map(a => a.x)); ax.forEach(a => { a.x -= x0; }); return ax;
  }
  // envelope of stringer effects for one vehicle on a span
  function vehicleSpan(B, Gr, vid, opt) {
    opt = opt || {}; const v = vehicle(vid, { A: (B.veh && B.veh.t44A) || 0 }); if (!v) return null;
    const gm = Gr.gm, ns = Gr.ns, NE = Gr.NE, step = opt.step || 0.1;
    const lines0 = v.models[0].axles[0].lines; const pos = lateralPositions(gm, gm.ys, { lines: lines0, side: v.side, centre: v.centre }, gm.cw0, gm.cw1);
    const env = new Float64Array(ns * NE), envA = new Float64Array(ns * NE); let skip = !pos.length;
    if (skip) return { v, env, skip: true, note: v.n + ' does not fit the carriageway (' + (gm.cw1 - gm.cw0).toFixed(2) + ' m)' };
    const withPrime = !!v.pm; // the prime mover is always on the bridge when it fits (whole or part of it)
    const one = (axles, yc, xFront) => { const load = new Float64Array(Gr.nn); axles.forEach(a => a.lines.forEach(l => { const x = xFront - a.x; if (x < -0.5 || x > gm.L + 0.5) return; pointToNodes(Gr, Math.max(0, Math.min(gm.L, x)), yc + l, a.P / a.lines.length, load); })); return effectsOf(Gr, load); };
    const pair = v.pair && pos.length > 1;
    // M1600 lane UDL (6 kN/m over a 3.2 m lane, the whole span) is added to the axle effects
    const udl = v.udl ? pos.map(yc => { const load = new Float64Array(Gr.nn), n = 40, m = 8; for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) pointToNodes(Gr, (i + 0.5) * gm.L / n, yc - 1.6 + (j + 0.5) * 3.2 / m, v.udl * gm.L / n / m, load); return effectsOf(Gr, load); }) : null;
    v.models.forEach(m => {
      const tr = trainOf(v, m, gm.L, withPrime), len = max(...tr.map(a => a.x));
      for (const dir of [1, -1]) {
        const axles = dir > 0 ? tr : tr.map(a => ({ x: len - a.x, P: a.P, lines: a.lines }));
        for (let xf = 0; xf <= gm.L + len + 1e-9; xf += step) {
          const effs = pos.map((yc, p) => { const e = one(axles, yc, xf); if (udl) for (let j = 0; j < e.length; j++) e[j] += Math.sign(e[j] || 1) * abs(udl[p][j]); return e; });
          for (let p = 0; p < pos.length; p++) { const e = effs[p]; for (let j = 0; j < ns * NE; j++) { if (abs(e[j]) > env[j]) env[j] = abs(e[j]); } }
          if (pair) { const w = v.width; for (let p = 0; p < pos.length; p++) for (let q = p + 1; q < pos.length; q++) { if (pos[q] - pos[p] < w + 1.2 - 1e-9) continue; const a = effs[p], b = effs[q]; for (let j = 0; j < ns * NE; j++) { const ea = abs(a[j]), eb = abs(b[j]), t = v.pair === 'm1600' ? max(ea, eb) + 0.8 * min(ea, eb) : 0.9 * (ea + eb); if (t > env[j]) env[j] = t; } } }
        }
      }
    });
    for (let s = 0; s < ns; s++) { const o = s * NE; for (let i = Gr.i0 + 1; i < Gr.i1; i++) if (env[o + 5 + i] > env[o]) env[o] = env[o + 5 + i]; }
    return { v, env, skip: false, withPrime };
  }

  // ------------------------------------------------------------------ substructure: halfcap continuous beam on rigid piles
  function capInfluence(piles, pts, EI) {
    // returns R[p][j]: reaction at pile p for a unit load at point j (positions m along the cap)
    const xsAll = [...new Set(piles.concat(pts).map(v => Math.round(v * 1e4) / 1e4))].sort((a, b) => a - b), nx = xsAll.length, N = 2 * nx, K = new Float64Array(N * N);
    for (let i = 0; i + 1 < nx; i++) { const l = xsAll[i + 1] - xsAll[i]; if (l <= 0) continue; const k = [[12 / l ** 3, 6 / l ** 2, -12 / l ** 3, 6 / l ** 2], [6 / l ** 2, 4 / l, -6 / l ** 2, 2 / l], [-12 / l ** 3, -6 / l ** 2, 12 / l ** 3, -6 / l ** 2], [6 / l ** 2, 2 / l, -6 / l ** 2, 4 / l]], d = [2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 3]; for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) K[d[a] * N + d[b]] += EI * k[a][b]; }
    const pIdx = piles.map(p => xsAll.findIndex(x => abs(x - p) < 1e-3)), fixed = new Set(pIdx.map(i => 2 * i)), free = []; for (let d = 0; d < N; d++) if (!fixed.has(d)) free.push(d);
    const n = free.length, Kf = new Float64Array(n * n); for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) Kf[a * n + b] = K[free[a] * N + free[b]];
    const Lc = chol(Kf, n); if (!Lc) return null;
    return pts.map(pt => { const j = xsAll.findIndex(x => abs(x - pt) < 1e-3), b = new Float64Array(n); b[free.indexOf(2 * j)] = 1; const uf = cholSolve(Lc, n, b), u = new Float64Array(N); free.forEach((d, a) => { u[d] = uf[a]; }); return pIdx.map(pi => { let r = 0; for (let c = 0; c < N; c++) r += K[2 * pi * N + c] * u[c]; return (2 * pi === 2 * j ? 1 : 0) - r; }); });
  }
  // pile reactions at a support for dead load and every vehicle (max axial and max one-span cases)
  function supportLoads(B, ki, grs, deads, opt) {
    const Sup = B.supports[ki], piles = (Sup.piles || []).map(p => +p.x), np = piles.length; if (!np) return null;
    const left = ki > 0 ? ki - 1 : null, right = ki < B.spans.length ? ki : null; // span indices
    const EI = (+((Sup.cap || {}).E) || 12000) * 1e3 * (+((Sup.cap || {}).b) || 0.3) * Math.pow(+((Sup.cap || {}).d) || 0.3, 3) / 12;
    // stringer positions at the support for each side (deck coordinates); piles within 10 mm of a stringer are offset 10 mm
    const side = si => (si == null ? [] : spanGeom(B, si).ys.map(y => { let q = y; piles.forEach(p => { if (abs(p - q) < 0.01) q = p + 0.01; }); return q; }));
    const yL = side(left), yR = side(right), inf = capInfluence(piles, yL.concat(yR), EI);
    if (!inf) return null;
    const toPiles = (rL, rR) => { const R1 = new Float64Array(np), R2 = new Float64Array(np); rL.forEach((r, s) => inf[s].forEach((f, p) => { R1[p] += r * f; })); rR.forEach((r, s) => inf[yL.length + s].forEach((f, p) => { R2[p] += r * f; })); return { R1, R2 }; };
    // dead
    const dL = left != null ? deads[left].eff : null, dR = right != null ? deads[right].eff : null;
    const rDL = left != null ? Array.from({ length: grs[left].ns }, (_, s) => dL[s * grs[left].NE + 4] + sideLoad(grs[left], deads[left].load, s, 1)) : [];
    const rDR = right != null ? Array.from({ length: grs[right].ns }, (_, s) => dR[s * grs[right].NE + 3] + sideLoad(grs[right], deads[right].load, s, 0)) : [];
    const dead = toPiles(rDL, rDR), vDL = left != null ? Array.from({ length: grs[left].ns }, (_, s) => abs(dL[s * grs[left].NE + 2])) : Array.from({ length: grs[right].ns }, (_, s) => abs(dR[s * grs[right].NE + 1]));
    const veh = {};
    (opt.vehicles || VEH_ORDER).forEach(vid => {
      const v = vehicle(vid, { A: (B.veh && B.veh.t44A) || 0 }); if (!v) return;
      const res = { ax1: new Float64Array(np), ax2: new Float64Array(np), axS: new Float64Array(np).fill(-1), m1: new Float64Array(np), m2: new Float64Array(np) };
      const grL = left != null ? grs[left] : null, grR = right != null ? grs[right] : null, gL = grL && grL.gm, gR = grR && grR.gm;
      const cw0 = max(gL ? gL.cw0 : -1e9, gR ? gR.cw0 : -1e9), cw1 = min(gL ? gL.cw1 : 1e9, gR ? gR.cw1 : 1e9), ysA = (gL ? gL.ys : []).concat(gR ? gR.ys : []);
      const pos = lateralPositions(null, ysA, { lines: v.models[0].axles[0].lines, side: v.side, centre: v.centre }, cw0, cw1); if (!pos.length) { veh[vid] = Object.assign(res, { skip: true }); return; }
      const LL = gL ? gL.L : 0, LR = gR ? gR.L : 0, withPrime = !!v.pm; // prime mover included whenever it is on the bridge (LRRD 1.9)
      const reac = (gr, load, end) => { if (!gr) return []; const e = effectsOf(gr, load); return Array.from({ length: gr.ns }, (_, s) => e[s * gr.NE + (end ? 4 : 3)] + sideLoad(gr, load, s, end)); };
      // M1600 lane UDL (6 kN/m over a 3.2 m lane) on the whole of each adjacent span
      const udl = v.udl ? pos.map(yc => { const one = (gr, end) => { if (!gr) return []; const load = new Float64Array(gr.nn), n = 40, m = 8; for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) pointToNodes(gr, (i + 0.5) * gr.gm.L / n, yc - 1.6 + (j + 0.5) * 3.2 / m, v.udl * gr.gm.L / n / m, load); return reac(gr, load, end); }; return toPiles(one(grL, 1), one(grR, 0)); }) : null;
      const take = (R1, R2, onL, onR) => { for (let p = 0; p < np; p++) { const t = R1[p] + R2[p]; if (t > res.axS[p]) { res.axS[p] = t; res.ax1[p] = R1[p]; res.ax2[p] = R2[p]; } if (onL && !onR && R1[p] > res.m1[p]) res.m1[p] = R1[p]; if (onR && !onL && R2[p] > res.m2[p]) res.m2[p] = R2[p]; } };
      v.models.forEach(m => { const tr = trainOf(v, m, 0, withPrime), len = max(...tr.map(a => a.x));
        for (const dir of [1, -1]) { const axles = dir > 0 ? tr : tr.map(a => ({ x: len - a.x, P: a.P, lines: a.lines }));
          for (let xf = -LL; xf <= LR + len + 1e-9; xf += 0.1) {
            const one = pos.map((yc, pi) => {
              // x measured from the support centreline: left span occupies [-LL, 0], right span [0, LR]
              const loadL = grL ? new Float64Array(grL.nn) : null, loadR = grR ? new Float64Array(grR.nn) : null; let onL = false, onR = false;
              axles.forEach(a => { const x = xf - a.x; a.lines.forEach(l => { const P = a.P / a.lines.length;
                if (grL && x <= 0 && x >= -LL) { pointToNodes(grL, LL + x, yc + l, P, loadL); onL = true; } else if (grR && x > 0 && x <= LR) { pointToNodes(grR, x, yc + l, P, loadR); onR = true; } }); });
              const { R1, R2 } = toPiles(reac(grL, loadL, 1), reac(grR, loadR, 0));
              if (udl) for (let p = 0; p < np; p++) { if (onL || !onR) R1[p] += udl[pi].R1[p]; if (onR || !onL) R2[p] += udl[pi].R2[p]; }
              return { R1, R2, onL, onR };
            });
            one.forEach(q => take(q.R1, q.R2, q.onL, q.onR));
            // two vehicles side by side (LRRD 1.8 / 1.9): T44 0.9 + 0.9, M1600 1.0 + 0.8
            if (v.pair && pos.length > 1) for (let a = 0; a < pos.length; a++) for (let b = a + 1; b < pos.length; b++) { if (pos[b] - pos[a] < v.width + 1.2 - 1e-9) continue;
              const A = one[a], Bq = one[b], R1 = new Float64Array(np), R2 = new Float64Array(np);
              for (let p = 0; p < np; p++) { const ta = A.R1[p] + A.R2[p], tb = Bq.R1[p] + Bq.R2[p], [fa, fb] = v.pair === 'm1600' ? (ta >= tb ? [1, 0.8] : [0.8, 1]) : [0.9, 0.9]; R1[p] = fa * A.R1[p] + fb * Bq.R1[p]; R2[p] = fa * A.R2[p] + fb * Bq.R2[p]; }
              take(R1, R2, A.onL || Bq.onL, A.onR || Bq.onR); }
          } } });
      veh[vid] = res;
    });
    return { ki, kind: Sup.kind || (ki === 0 || ki === B.spans.length ? 'abut' : 'pier'), piles, dead, veh, rDL, rDR, vDL, yL, yR, inf, left, right };
  }
  // loads applied directly at the support nodes beyond the grillage support points (outside Le) go straight to the support
  function sideLoad(Gr, load, s, end) { const i = end ? Gr.i1 : Gr.i0; let r = 0; const nx = Gr.nx; if (end) { for (let k = i + 1; k < nx; k++) r += load[s * nx + k]; } else { for (let k = 0; k < i; k++) r += load[s * nx + k]; } return r; }

  // ------------------------------------------------------------------ ratings
  const rate = (cap, dl, ll, dla, W) => (ll > 1e-9 ? max(0, (cap - dl) / (ll * (1 + dla)) * W) : cap >= dl ? Infinity : 0); // 0 = dead load alone exceeds the capacity
  function rateStringers(B, si, Gr, dead, vres) {
    const S = B.spans[si], k1 = K1(B.road), out = [];
    for (let s = 0; s < Gr.ns; s++) {
      const st = S.stringers[s], p = Gr.P[s], d = dead.eff, o = s * Gr.NE;
      let Fb, Fs1, Fs2, Mcap, V1cap, V2cap, info;
      if (p.mat === 'steel') { const gr = STEELGR[+st.steelGrade || 250] || STEELGR[250], q = steelSec(st.steel || '410UB54'); Fb = gr.fb; Fs1 = Fs2 = gr.fs; Mcap = Fb * q.I / q.ymax * 1e-6; V1cap = V2cap = gr.fs * q.Aw * 1e-3; info = { grade: 'Gr' + (+st.steelGrade || 250), I: q.I, ymax: q.ymax, A1: q.Aw, A2: q.Aw }; }
      else {
        const sp = SPECIES[p.mat] || SPECIES.jarrah, sawn = [st.e1, st.mid, st.e2].some(q => q && +q.W >= 999), grN = st.grade || (sawn ? sp.sawn : sp.stringer), gr = GRADES[grN] || GRADES.F17, cm = condOf((st.mid || {}).cond || 'G', p.mat), c1 = condOf((st.e1 || {}).cond || 'G', p.mat), c2 = condOf((st.e2 || {}).cond || 'G', p.mat);
        Fb = k1 * gr.fb * cm.t; const fs0 = k1 * gr.fs * 0.66; Fs1 = fs0 * c1.s; Fs2 = fs0 * c2.s;
        Mcap = Fb * p.mid.I / p.mid.ymax * 1e-6; V1cap = Fs1 * p.e1.A * 1e-3; V2cap = Fs2 * p.e2.A * 1e-3;
        info = { grade: grN, sawn, I: p.mid.I, ymax: p.mid.ymax, A1: p.e1.A, A2: p.e2.A, I1: p.e1.I, I2: p.e2.I, Ag: p.mid.Ag };
      }
      const DL = { M: d[o], V1: abs(d[o + 1]), V2: abs(d[o + 2]) }, r = { s: s + 1, Fb, Fs1, Fs2, Mcap, V1cap, V2cap, DL, info, veh: {} };
      Object.entries(vres).forEach(([vid, vr]) => { if (!vr || vr.skip) { r.veh[vid] = { skip: true }; return; } const e = vr.env, v = vr.v;
        const LL = { M: e[o], V1: e[o + 1], V2: e[o + 2] }, rb = rate(Mcap, DL.M, LL.M, v.dla, v.W), r1 = rate(V1cap, DL.V1, LL.V1, v.dla, v.W), r2 = rate(V2cap, DL.V2, LL.V2, v.dla, v.W);
        const lim = min(rb, r1, r2), crit = lim === rb ? 'Bending' : lim === r1 ? 'Shear end 1' : 'Shear end 2';
        r.veh[vid] = { LL, rb, r1, r2, t: lim, pct: lim / v.W * 100, crit, W: v.W, dlx: lim === 0 }; });
      out.push(r);
    }
    return out;
  }
  // piles: allowable stresses, slenderness, propped cantilever
  function pileCaps(B, pl) {
    const k1 = K1(B.road), mat = pl.mat || 'jarrah', sp = SPECIES[mat] || SPECIES.jarrah, grN = pl.grade || sp.pile || 'F17', gr = GRADES[grN] || GRADES.F17, cd = condOf(pl.cond || 'G', mat);
    const crit = pileSection(pl), top = pileSection({ d: pl.d });
    const Hgl = +pl.Hgl || 1.0, dfix = pl.dfix != null ? +pl.dfix : 1.0, L = Hgl + dfix, Le = 0.85 * L, E = (sp.E || gr.E) * 1e3; // kPa
    const A = crit.A * 1e-6, I = crit.I * 1e-12, Pcr = PI * PI * E * I / (Le * Le), S = sq(0.823 * E * A / Pcr), rS = gr.rho * S;
    const k12 = rS <= 10 ? 1 : rS < 20 ? 1.5 - 0.05 * rS : 200 / (rS * rS), asf = pl.asf != null ? +pl.asf : 1.0;
    const Fbc = k1 * gr.fb * cd.c, Fbt = k1 * gr.fb * cd.t, Fs = k1 * gr.fs * asf * cd.s, Fcc = k1 * k12 * gr.fc * cd.c, Fct = k1 * gr.fc;
    return { k1, gr: grN, Hgl, dfix, L, Le, Pcr, S, rho: gr.rho, k12, Fbc, Fbt, Fs, Fcc, Fct, Fb0: k1 * gr.fb,
      crit: { A, I, Zb: crit.Zb * 1e-9, Zf: crit.Zf * 1e-9, Zmin: crit.Zmin * 1e-9, P: A * Fcc * 1e3, V: A * Fs * 1e3, M: crit.Zmin * 1e-9 * Fbc * 1e3, Mb: crit.Zb * 1e-9 * Fbc * 1e3, Mf: crit.Zf * 1e-9 * Fbc * 1e3, sec: crit },
      top: { A: top.A * 1e-6, Z: top.Z0 * 1e-9, P: top.A * 1e-6 * Fct * 1e3, V: top.A * 1e-6 * k1 * gr.fs * asf * 1e3, M: top.Z0 * 1e-9 * k1 * gr.fb * 1e3 } };
  }
  // pier pile rating (cases (i) max axial, (ii) max eccentric; top and critical sections; linear interaction)
  function ratePierPile(B, pl, D1, D2, V, v, cp) {
    const e = pl.e != null ? +pl.e : 0.15, zc = cp.Hgl + (pl.dc != null ? +pl.dc : 1.0), fac = 1 - 1.5 * zc / cp.L, dla = v.dla;
    const solve = (P0, P1, M0, M1, Pc, Mc) => { // P(l)=P0+l P1 ; M(l)=|M0 + l M1| ; P/Pc + M/Mc = 1
      const f = l => (P0 + l * P1) / Pc + abs(M0 + l * M1) / Mc - 1; if (f(0) >= 0) return 0; let lo = 0, hi = 1; while (f(hi) < 0 && hi < 1e7) hi *= 2; if (hi >= 1e7) return Infinity; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (f(m) < 0) lo = m; else hi = m; } return lo; };
    const cases = [];
    const add = (name, V1, V2) => {
      const P0 = D1 + D2, P1 = (1 + dla) * (V1 + V2), M0 = (D1 - D2) * e, M1 = (1 + dla) * (V1 - V2) * e;
      cases.push({ name: name + ' Top', l: solve(P0, P1, M0, M1, cp.top.P, cp.top.M) });
      cases.push({ name: name + ' Crit', l: solve(P0, P1, M0 * fac, M1 * fac, cp.crit.P, cp.crit.M) });
    };
    add('(i) Max P', V.ax1, V.ax2); add('(ii) Max Me', V.m1, 0); if (V.m2) add('(ii) Max Me R2', 0, V.m2);
    const best = cases.reduce((a, c) => (c.l < a.l ? c : a), { l: Infinity });
    return { t: best.l * v.W, pct: best.l * v.W / v.W * 100, crit: best.name, cases: cases.map(c => ({ name: c.name, t: c.l * v.W })) };
  }
  // abutment pile: soil on a propped cantilever (pinned at the cap, fixed at dfix below GL) + eccentric axial load
  function soilPile(q0, q1, a, L) { // linear q from q0 at z=0 to q1 at z=a (kN/m), zero below a; returns functions
    const q = z => (z <= a ? q0 + (q1 - q0) * z / a : 0), n = 200, dz = a / n; let RA = 0, Q = 0, Mq = 0;
    for (let i = 0; i < n; i++) { const z = (i + 0.5) * dz, w = q(z) * dz; RA += w * (L - z) * (L - z) * (2 * L + z) / (2 * L * L * L); Q += w; Mq += w * (L - z); }
    const RB = Q - RA, MB = RA * L - Mq;
    const at = zc => { let V = RA, M = RA * zc; for (let i = 0; i < n; i++) { const z = (i + 0.5) * dz; if (z >= zc) break; const w = q(z) * dz; V -= w; M -= w * (zc - z); } return { V, M }; };
    return { RA, RB, MB, at };
  }
  function rateAbutPile(B, pl, Dd, Rv, v, cp, wtrib) {
    const ka = (B.soil && +B.soil.ka) || 0.33, gs = (B.soil && +B.soil.gamma) || 20, sur = (B.soil && B.soil.sur != null) ? +B.soil.sur : 1.0;
    const hr = pl.hr != null ? +pl.hr : 0.6, ds = pl.ds != null ? +pl.ds : 0.6, a = cp.Hgl + ds, L = cp.L, zc = cp.Hgl + (pl.dc != null ? +pl.dc : 1.0), e = pl.e != null ? +pl.e : 0.15;
    const soil = hs => soilPile(ka * gs * wtrib * hs, ka * gs * wtrib * (hs + a), a, L);
    const s1 = soil(hr + sur), s2 = soil(hr);
    // case 1: max soil, live load = extra allowable axial
    const c1 = (M, P, cap) => (1 - abs(M) / cap.M) * cap.P - P;
    const s1c = s1.at(zc), case1 = min(c1(s1c.M, Dd, { M: s1c.M >= 0 ? cp.crit.Mb : cp.crit.Mf, P: cp.crit.P }), c1(s1.MB, Dd, { M: cp.top.M, P: cp.top.P }));
    const shear1 = max(abs(s1c.V) / cp.crit.V, abs(s1.RB) / cp.top.V);
    // case 2: min soil, total axial P with eccentric top moment
    const allowP = (Ms, Vs, fac, cap, Zt) => { // P/(Pc) + |Ms - P e fac|/Mc = 1
      const f = P => P / cap.P + abs(Ms - P * e * fac) / cap.M - 1; let lo = 0, hi = 1; if (f(0) >= 0) return 0; while (f(hi) < 0 && hi < 1e7) hi *= 2; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (f(m) < 0) lo = m; else hi = m; } const Pcb = lo;
      const kv = 1.5 * e / L, Psh = kv > 0 ? (cap.V - abs(Vs)) / kv : Infinity; return min(Pcb, Psh); };
    const s2c = s2.at(zc), fc = 1 - 1.5 * zc / L;
    const top = allowP(0, s2.RA, 1, cp.top);
    let critCap = { P: cp.crit.P, M: cp.crit.M, V: cp.crit.V }, crit = allowP(s2c.M, s2c.V, fc, critCap);
    for (let it = 0; it < 2; it++) { const Mn = s2c.M - crit * e * fc; critCap = { P: cp.crit.P, M: Mn >= 0 ? cp.crit.Mb : cp.crit.Mf, V: cp.crit.V }; crit = allowP(s2c.M, s2c.V, fc, critCap); }
    const fix = allowP(s2.MB, s2.RB, -0.5, cp.top);
    // tension in the pile (soil moment less the dead-load compression) must not exceed F_b,t
    const Zt = s1c.M >= 0 ? cp.crit.Zf : cp.crit.Zb, sigT = abs(s1c.M) / Zt * 1e-3 - Dd / cp.crit.A * 1e-3, tensionOK = sigT <= cp.Fbt + 1e-9;
    const case2 = min(top, crit, fix) - Dd, liveCap = min(case1, case2), lam = Rv > 1e-9 ? liveCap / (Rv * (1 + v.dla)) : Infinity;
    return { t: lam * v.W, pct: lam * 100, crit: liveCap === case1 ? 'Case 1 (max soil)' : top <= crit && top <= fix ? 'Case 2 Top' : crit <= fix ? 'Case 2 Crit' : 'Case 2 Fixed', liveCap, case1, case2, soil1: s1, soil2: s2, shearOK: shear1 <= 1, shear1, sigT, tensionOK, case2Top: top - Dd, case2Crit: crit - Dd, case2Fix: fix - Dd };
  }
  function halfcapBearing(B, pl, D, Vlive, v, share, Sup) {
    const k1 = K1(B.road), R = (+pl.d || 350) / 2, seg = h => (h > 0 ? R * R * Math.acos((R - h) / R) - (R - h) * sq(max(0, 2 * R * h - h * h)) : 0);
    const cap = Sup.cap || {}, at = +(pl.bearT != null ? pl.bearT : cap.bear || 80), as = +(pl.bearS || 0), sp = SPECIES[(cap.mat || 'jarrah')] || SPECIES.jarrah, spP = SPECIES[pl.mat || 'jarrah'] || SPECIES.jarrah;
    const Cap = k1 * (seg(at) * sp.fp + seg(as) * (GRADES[spP.pile] || GRADES.F17).fc) * 1e-3;
    const t = rate(Cap, D, share * Vlive, v.dla, v.W); return { Cap, A: seg(at), t, pct: t / v.W * 100 };
  }
  // halfcap as a continuous timber beam on piles (direct-bearing rules for loads near piles)
  function rateHalfcap(B, Sup, sl, vehRes) {
    const cap = Sup.cap || {}, k1 = K1(B.road), mat = cap.mat || 'jarrah', sp = SPECIES[mat] || SPECIES.jarrah, gr = GRADES[cap.grade || sp.halfcap] || GRADES.F14, cd = condOf(cap.cond || 'G', mat);
    const b = (+cap.bh || +cap.b || 0.3) * 1000, H = (+cap.d || 0.3) * 1000, Fb = k1 * gr.fb * cd.t, Fs = k1 * gr.fs * cd.s, Z = b * H * H / 6, As = 2 / 3 * b * H;
    const piles = sl.piles, pd = (Sup.piles || []).map(p => +p.d || 350), share = Sup.share != null && Sup.share !== '' ? +Sup.share : (sl.kind === 'pier' ? 2 / 3 : 1.0);
    const ys = sl.yL.length ? sl.yL : sl.yR, rD = sl.vDL && sl.vDL.length ? sl.vDL : (sl.rDL.length ? sl.rDL : sl.rDR);
    const pct = ys.map(y => { let best = { x: Infinity }; piles.forEach((p, i) => { const x = abs(y - p) * 1000; if (x < best.x) best = { x, D: pd[i] }; }); const c = best.D / 2 + H / 4, c5 = best.D / 2 + 5 * H / 4; return { M: best.x <= c ? 0 : 1, V: best.x <= c ? 0 : best.x >= c5 ? 1 : (best.x - c) / H }; });
    // beam on piles: moment / shear envelopes for point loads at stringer positions
    const faces = []; piles.forEach((p, i) => { faces.push(p - pd[i] / 2000, p + pd[i] / 2000); });
    const xsAll = [...new Set(piles.concat(ys, faces).map(v => Math.round(v * 1e4) / 1e4))].sort((a, c) => a - c), isFace = xsAll.map(x => faces.some(f => abs(f - x) < 1e-3)), faceSide = xsAll.map(x => { const i = piles.findIndex((p, k) => abs(p - pd[k] / 2000 - x) < 1e-3); return i >= 0 ? -1 : piles.findIndex((p, k) => abs(p + pd[k] / 2000 - x) < 1e-3) >= 0 ? 1 : 0; });
    const solveBeam = (loads) => { // loads [{x, P}] -> max |M|, max |V| along beam (FE beam on rigid supports)
      const nx = xsAll.length, N = 2 * nx, K = new Float64Array(N * N), F = new Float64Array(N), EI = 1;
      for (let i = 0; i + 1 < nx; i++) { const l = xsAll[i + 1] - xsAll[i], k = [[12 / l ** 3, 6 / l ** 2, -12 / l ** 3, 6 / l ** 2], [6 / l ** 2, 4 / l, -6 / l ** 2, 2 / l], [-12 / l ** 3, -6 / l ** 2, 12 / l ** 3, -6 / l ** 2], [6 / l ** 2, 2 / l, -6 / l ** 2, 4 / l]], d = [2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 3]; for (let a = 0; a < 4; a++) for (let c = 0; c < 4; c++) K[d[a] * N + d[c]] += EI * k[a][c]; }
      loads.forEach(q => { const j = xsAll.findIndex(x => abs(x - q.x) < 1e-3); if (j >= 0) F[2 * j] += q.P; });
      const fixed = new Set(piles.map(p => 2 * xsAll.findIndex(x => abs(x - p) < 1e-3))), free = []; for (let d = 0; d < N; d++) if (!fixed.has(d)) free.push(d);
      const n = free.length, Kf = new Float64Array(n * n); for (let a = 0; a < n; a++) for (let c = 0; c < n; c++) Kf[a * n + c] = K[free[a] * N + free[c]];
      const Lc = chol(Kf, n); if (!Lc) return { M: 0, V: 0 }; const uf = cholSolve(Lc, n, free.map(d => F[d])), u = new Float64Array(N); free.forEach((d, a) => { u[d] = uf[a]; });
      // signed moment at every node (sagging +) and shear at every pile face
      const Mn = new Float64Array(nx), Vf = new Float64Array(nx); let Mx = 0, Vx = 0;
      for (let i = 0; i + 1 < nx; i++) { const l = xsAll[i + 1] - xsAll[i], ue = [u[2 * i], u[2 * i + 1], u[2 * i + 2], u[2 * i + 3]], k = [[12 / l ** 3, 6 / l ** 2, -12 / l ** 3, 6 / l ** 2], [6 / l ** 2, 4 / l, -6 / l ** 2, 2 / l], [-12 / l ** 3, -6 / l ** 2, 12 / l ** 3, -6 / l ** 2], [6 / l ** 2, 2 / l, -6 / l ** 2, 4 / l]]; const f = k.map(r => r.reduce((s, kv, c) => s + kv * ue[c], 0));
        Mn[i] = -f[1]; Mn[i + 1] = f[3]; Mx = max(Mx, abs(f[1]), abs(f[3])); if (faceSide[i] === 1) { Vf[i] = f[0]; Vx = max(Vx, abs(f[0])); } if (faceSide[i + 1] === -1) { Vf[i + 1] = -f[2]; Vx = max(Vx, abs(f[2])); } }
      return { M: Mx, V: Vx, Mn, Vf }; };
    const locName = (j, kind) => { const x = xsAll[j], pi = piles.findIndex(p => abs(p - x) < 1e-3); if (kind === 'V') { const k = piles.findIndex((p, q) => abs(abs(p - x) - pd[q] / 2000) < 1e-3); return 'V at pile ' + (k + 1) + (x < piles[k] ? ' left face' : ' right face'); } return pi >= 0 ? 'M over pile ' + (pi + 1) : 'M at x = ' + x.toFixed(2) + ' m'; };
    // rating at one location: |f_DL + λ f_LL| ≤ F with the dead and live effects at the same place
    const rateAt = (cap, d, l) => { if (abs(l) < 1e-12) return Infinity; const same = Math.sign(d) === Math.sign(l) || !d; return max(0, (same ? cap - abs(d) : cap + abs(d)) / abs(l)); };
    const dM = solveBeam(ys.map((y, s) => ({ x: y, P: rD[s] * pct[s].M }))), dV = solveBeam(ys.map((y, s) => ({ x: y, P: rD[s] * pct[s].V })));
    const Mcap = Fb * Z * 1e-6, Vcap = Fs * As * 1e-3; // kNm, kN
    const out = { Fb, Fs, Z, As, Mcap, Vcap, MD: dM.M, VD: dV.V, share, veh: {} };
    Object.entries(vehRes).forEach(([vid, r]) => { if (!r || !r.cases) return; const v = vehicle(vid); let bm = { r: Infinity }, bv = { r: Infinity };
      r.cases.forEach(cs => { const m = solveBeam(ys.map((y, s) => ({ x: y, P: (cs[s] || 0) * pct[s].M * share * (1 + v.dla) }))), vv = solveBeam(ys.map((y, s) => ({ x: y, P: (cs[s] || 0) * pct[s].V * share * (1 + v.dla) })));
        for (let j = 0; j < xsAll.length; j++) {
          const rm = rateAt(Mcap, dM.Mn[j], m.Mn[j]); if (rm < bm.r) bm = { r: rm, loc: locName(j, 'M'), MD: dM.Mn[j], ML: m.Mn[j] };
          if (isFace[j]) { const rv = rateAt(Vcap, dV.Vf[j], vv.Vf[j]); if (rv < bv.r) bv = { r: rv, loc: locName(j, 'V'), VD: dV.Vf[j], VL: vv.Vf[j] }; }
        } });
      const rr = min(bm.r, bv.r);
      out.veh[vid] = { t: rr * v.W, pct: rr * 100, crit: bm.r <= bv.r ? 'Bending — ' + bm.loc : 'Shear — ' + bv.loc, tM: bm.r * v.W, tV: bv.r * v.W, locM: bm.loc, locV: bv.loc, M: bm.ML, V: bv.VL, MD: bm.MD, VD: bv.VD }; });
    return out;
  }
  // deck planks: continuous beam over stringers, two wheel patches 1.8 m apart, 45 deg spread through pavement
  function rateDeckPlanks(B, si) {
    const S = B.spans[si], dp = S.planks || {}, gm = spanGeom(B, si), k1 = K1(B.road), mat = dp.mat || 'jarrah', sp = SPECIES[mat] || SPECIES.jarrah, gr = GRADES[dp.grade || sp.deck] || GRADES.F7, cd = condOf(dp.cond || 'G', mat);
    const bw = +dp.b || 220, d = +dp.d || 127, rot = +dp.rot || 0, t = (+dp.pave || 0) * 1000, deff = d * (1 - rot / 100), topCut = +dp.topCut || 200;
    const len = 200 + 2 * t, wid = 400 + 2 * t, beff = len, nPl = beff / bw; // b_eff = patch length on the plank top (TIMBAR deck plank sheet)
    const Fb = k1 * gr.fb * cd.t, Fs = k1 * gr.fs * 0.667 * cd.s, Z = beff * deff * deff / 6, A = beff * deff, Mcap = Fb * Z * 1e-6, Vcap = Fs * A * 1e-3;
    const ys = gm.ys, x0 = ys[0], x1 = ys[ys.length - 1]; if (ys.length < 2) return null;
    const nE = 200, h = (x1 - x0) / nE, xsN = Array.from({ length: nE + 1 }, (_, i) => x0 + i * h);
    const supIdx = ys.map(y => Math.round((y - x0) / h));
    const N = 2 * (nE + 1), K = new Float64Array(N * N), EI = 1;
    const ke = [[12 / h ** 3, 6 / h ** 2, -12 / h ** 3, 6 / h ** 2], [6 / h ** 2, 4 / h, -6 / h ** 2, 2 / h], [-12 / h ** 3, -6 / h ** 2, 12 / h ** 3, -6 / h ** 2], [6 / h ** 2, 2 / h, -6 / h ** 2, 4 / h]];
    for (let i = 0; i < nE; i++) { const dd = [2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 3]; for (let a = 0; a < 4; a++) for (let c = 0; c < 4; c++) K[dd[a] * N + dd[c]] += EI * ke[a][c]; }
    const fixed = new Set(supIdx.map(i => 2 * i)), free = []; for (let dd = 0; dd < N; dd++) if (!fixed.has(dd)) free.push(dd);
    const n = free.length, Kf = new Float64Array(n * n); for (let a = 0; a < n; a++) for (let c = 0; c < n; c++) Kf[a * n + c] = K[free[a] * N + free[c]];
    const Lc = chol(Kf, n);
    const analyse = (q) => { // q: nodal loads (kN) array length nE+1 -> envelope M (kNm), V (kN)
      const F = new Float64Array(N); q.forEach((v, i) => { F[2 * i] = v; }); const uf = cholSolve(Lc, n, free.map(dd => F[dd])), u = new Float64Array(N); free.forEach((dd, a) => { u[dd] = uf[a]; });
      let M = 0, V = 0; for (let i = 0; i < nE; i++) { const ue = [u[2 * i], u[2 * i + 1], u[2 * i + 2], u[2 * i + 3]], f = ke.map(r => r.reduce((s, kv, c) => s + kv * ue[c] * EI, 0)); M = max(M, abs(f[1]), abs(f[3])); V = max(V, abs(f[0]), abs(f[2])); } return { M, V }; };
    // dead load UDL
    const wDL = (22 * (+dp.paveDL || +dp.pave || 0) * bw * 1e-3 + 10.8 * d * 1e-3 * bw * 1e-3) * nPl;
    const qD = xsN.map((x, i) => wDL * h * (i === 0 || i === nE ? 0.5 : 1)); const DL = analyse(qD);
    // live: wheel patches of length wid along the plank (transverse), stepping; zones near stringers ignored
    const zb = (topCut + 2 * deff) / 2000, zs = (topCut + 2 * deff + 2 * t) / 2000, wheel = 48 * 1.3, qLL = wheel / (wid / 1000);
    let LM = 0, LV = 0;
    const kL = gm.cw0 + 0.6, kR = gm.cw1 - 0.6; // centre of a wheel patch at least 0.6 m from the kerb
    for (let c = max(x0 - 0.9 + 0.3, kL + 0.9); c <= min(x1 + 0.9 - 0.3, kR - 0.9) + 1e-9; c += 0.02) {
      const pos = [c - 0.9, c + 0.9];
      const build = zone => xsN.map((x, i) => { let p = 0; pos.forEach(pc => { if (abs(x - pc) <= wid / 2000) p += qLL * h; }); if (ys.some(y => abs(x - y) <= zone)) p = 0; return p; });
      const rM = analyse(build(zb)), rV = analyse(build(zs)); LM = max(LM, rM.M); LV = max(LV, rV.V);
    }
    const tb = (Mcap - DL.M) / LM * 44.04, ts = (Vcap - DL.V) / LV * 44.04, tT = min(tb, ts);
    const wheelOf = { T44: 48, MT: 40, TA: 45, TR: 45, QU: 45, Q4: 45 }, Wk = { T44: 432, MT: 100, TA: 180, TR: 270, QU: 360, Q4: 360 };
    const veh = {}; Object.keys(wheelOf).forEach(k => { const f = 48 / wheelOf[k] * (k === 'T44' ? 1 : Wk[k] / 9.81 / 44.04); const b = tb * f, s = ts * f, W = k === 'T44' ? 44.04 : Wk[k] / 9.81; veh[k] = { t: min(b, s), pct: min(b, s) / W * 100, crit: b <= s ? 'Bending' : 'Shear', W }; });
    return { deff, beff, Fb, Fs, Z, A, Mcap, Vcap, wDL, DL, LM, LV, tb, ts, veh, nPl };
  }

  // ------------------------------------------------------------------ whole bridge
  function analyse(B, opt) {
    opt = opt || {}; const t0 = Date.now(), vids = VEH_ORDER.filter(k => vehOn(B, k)), warn = [];
    const grs = [], deads = [], spans = [];
    B.spans.forEach((S, si) => {
      const Gr = buildGrillage(B, si), dead = deadLoad(B, si, Gr); grs.push(Gr); deads.push(dead);
      if (S.rate === false) { spans.push(null); return; }
      const vres = {}; vids.forEach(vid => { const r = vehicleSpan(B, Gr, vid); vres[vid] = r; if (r && r.skip) warn.push('Span ' + (si + 1) + ': ' + r.note + ' — not analysed.'); });
      spans.push({ si, gm: Gr.gm, props: Gr.P, dead, vres, str: rateStringers(B, si, Gr, dead, vres), planks: S.planks && S.planks.on !== false ? rateDeckPlanks(B, si) : null });
    });
    const supports = (B.supports || []).map((Sup, ki) => {
      const adj = [ki - 1, ki].filter(i => i >= 0 && i < B.spans.length); if (!adj.some(i => B.spans[i].rate !== false) || !(Sup.piles || []).length) return null;
      const sl = supportLoads(B, ki, grs, deads, { vehicles: vids }); if (!sl) return null;
      const piles = (Sup.piles || []).map((pl, p) => {
        const cp = pileCaps(B, pl), r = { p: pl.id || p + 1, cp, D1: sl.dead.R1[p], D2: sl.dead.R2[p], veh: {}, bear: {} };
        const wtrib = (() => { const xs = sl.piles; const l = p ? xs[p] - xs[p - 1] : 0, rr = p < xs.length - 1 ? xs[p + 1] - xs[p] : 0, osw = pl.osw != null ? +pl.osw : 0.5; return (p ? l / 2 : osw) + (p < xs.length - 1 ? rr / 2 : osw); })();
        r.wtrib = wtrib;
        vids.forEach(vid => { const V = sl.veh[vid]; if (!V || V.skip) { r.veh[vid] = { skip: true }; return; } const v = vehicle(vid);
          const Vp = { ax1: V.ax1[p], ax2: V.ax2[p], m1: V.m1[p], m2: V.m2[p] }; r.load = r.load || {}; r.load[vid] = Vp;
          if (sl.kind === 'pier') r.veh[vid] = ratePierPile(B, pl, r.D1, r.D2, Vp, v, cp);
          else r.veh[vid] = rateAbutPile(B, pl, r.D1 + r.D2, Vp.ax1 + Vp.ax2, v, cp, wtrib);
          // halfcap bearing at a pier: two halfcaps (k_sh = 2/3); abutment: one halfcap (k_sh = 1.0 unless set)
          // (TIMBAR halfcap-bearing sheet: dead load of the facing side, live = R1 + R2 of the max case x 2/3; both facing sides checked)
          if (sl.kind === 'pier') { const Vl = max(Vp.ax1 + Vp.ax2, Vp.m1, Vp.m2), b1 = halfcapBearing(B, pl, r.D1, Vl, v, 2 / 3, Sup), b2 = halfcapBearing(B, pl, r.D2, Vl, v, 2 / 3, Sup); r.bear[vid] = Object.assign(b1.t <= b2.t ? b1 : b2, { side: b1.t <= b2.t ? 1 : 2, t1: b1.t, t2: b2.t }); }
          else r.bear[vid] = halfcapBearing(B, pl, r.D1 + r.D2, Vp.ax1 + Vp.ax2, v, Sup.share != null && Sup.share !== '' ? +Sup.share : 1, Sup);
        });
        return r;
      });
      // halfcap rating with stringer reaction load cases (max reaction per stringer for each vehicle position family)
      const vcases = {}; vids.forEach(vid => { const V = sl.veh[vid]; if (V && !V.skip) vcases[vid] = { cases: stringerCases(B, ki, grs, vid, sl) }; });
      let halfcap = null; try { halfcap = (Sup.cap && Sup.cap.rate !== false) ? rateHalfcap(B, Sup, sl, vcases) : null; } catch (e) { warn.push('Halfcap ' + ki + ': ' + e.message); }
      const wing = (Sup.wing || []).filter(w => (w.piles || []).length).map(w => rateWingWall(B, w));
      return { ki, kind: sl.kind, name: sl.kind === 'pier' ? 'Pier ' + ki : 'Abutment ' + (ki === 0 ? 1 : 2), sl, piles, halfcap, wing };
    });
    return { ok: true, spans, supports, vids, warn, ms: Date.now() - t0, k1: K1(B.road), summary: summarise(B, spans, supports, vids) };
  }
  // stringer reaction vectors at a support for the worst transverse positions (for the halfcap)
  function stringerCases(B, ki, grs, vid, sl) {
    const si = ki > 0 ? ki - 1 : 0, end = ki > 0 ? 1 : 0, Gr = grs[si]; if (!Gr) return [];
    const v = vehicle(vid), gm = Gr.gm, pos = lateralPositions(gm, gm.ys, { lines: v.models[0].axles[0].lines, side: v.side, centre: v.centre }, gm.cw0, gm.cw1), cases = [];
    const udl = yc => { if (!v.udl) return null; const load = new Float64Array(Gr.nn), n = 40, mm = 8; for (let i = 0; i < n; i++) for (let j = 0; j < mm; j++) pointToNodes(Gr, (i + 0.5) * gm.L / n, yc - 1.6 + (j + 0.5) * 3.2 / mm, v.udl * gm.L / n / mm, load); const e = effectsOf(Gr, load); return Array.from({ length: Gr.ns }, (_, s) => abs(e[s * Gr.NE + 1 + end])); };
    pos.forEach(yc => { let best = null, bt = -1; const u = udl(yc); v.models.forEach(m => { const tr = trainOf(v, m, gm.L, !!v.pm), len = max(...tr.map(a => a.x)); for (let xf = 0; xf <= gm.L + len; xf += 0.2) { const load = new Float64Array(Gr.nn); tr.forEach(a => a.lines.forEach(l => { const x = xf - a.x; if (x < 0 || x > gm.L) return; pointToNodes(Gr, x, yc + l, a.P / a.lines.length, load); })); const e = effectsOf(Gr, load), r = Array.from({ length: Gr.ns }, (_, s) => abs(e[s * Gr.NE + 1 + end]) + (u ? u[s] : 0)), tt = r.reduce((a, c) => a + c, 0); if (tt > bt) { bt = tt; best = r; } } }); if (best) cases.push(best); });
    return cases;
  }
  // wing wall piles (unbraced cantilevers fixed below GL, sloping backfill, LL surcharge) — capacity/demand PASS/FAIL
  function rateWingWall(B, w) {
    const phi = (+w.phi || 30) * PI / 180, al = (+w.alpha || 45) * PI / 180, x = +w.slope || 2, gs = +w.gamma || 20, pas = w.passive !== false;
    const beta = Math.atan(Math.sin(al) / x), Ka1 = (1 - Math.sin(phi)) / (1 + Math.sin(phi)), Kp = 1 / Ka1, cb = Math.cos(beta), cp = Math.cos(phi), Ka2 = cb * (cb - sq(max(0, cb * cb - cp * cp))) / (cb + sq(max(0, cb * cb - cp * cp)));
    const sp = (w.piles || []).map(p => +p.s || 1.5), out = [];
    (w.piles || []).forEach((p, i) => {
      const H = +p.h || 1.5, dfix = p.dfix != null ? +p.dfix : 1, ds = p.ds != null ? +p.ds : 0.6, dc = p.dc != null ? +p.dc : 1, L = H + dfix, wt = i < sp.length - 1 ? (sp[i] + sp[i + 1]) / 2 : sp[i] / 2 + (+w.osw || 0.5), d = (+p.d || 350) / 1000;
      const mat = p.mat || 'jarrah', spc = SPECIES[mat] || SPECIES.jarrah, gr = GRADES[p.grade || spc.pile] || GRADES.F17, cd = condOf(p.cond || 'G', mat);
      // top of the live-load surcharge measured up from GL (default: the edge-most pile at its full height, none for the others)
      const sTop = p.sur != null && p.sur !== '' ? +p.sur : i === 0 ? H : -1, z0s = H - sTop, surAt = z => { if (sTop < 0) return 0; const zz = z - z0s; return zz < 0 ? 0 : zz <= 3 ? 1 : zz <= 8 ? 1 - (zz - 3) / 5 : 0; };
      const n = 300, dz = L / n; let Mf = 0, Vf = 0, Mc = 0, Vc = 0; const zc = H + dc;
      for (let k = 0; k < n; k++) { const z = (k + 0.5) * dz; const width = z <= H + ds ? wt : d; let pr = Ka2 * gs * z * width + Ka1 * gs * 1.0 * surAt(z) * width; if (z > H && pas) pr -= Kp * gs * (z - H) * d; pr = max(0, pr); const f = pr * dz; Vf += f; Mf += f * (L - z); if (z < zc) { Vc += f; Mc += f * (zc - z); } }
      const sc = pileSection(p), s0 = pileSection({ d: p.d }), Fbt = gr.fb * cd.t, Fbc = gr.fb * cd.c, Fs = gr.fs * (p.asf != null ? +p.asf : 1) * cd.s;
      const MrC = min(sc.Zb * Fbt, sc.Zf * Fbc) * 1e-6, VrC = sc.A * Fs * 1e-3, MrF = s0.Z0 * gr.fb * 1e-6, VrF = s0.A * gr.fs * 1e-3;
      const r = { p: p.id || i + 1, H, L, wt, Ka1, Ka2, Kp, beta: beta * 180 / PI, Mf, Vf, Mc, Vc, MrC, VrC, MrF, VrF, rMF: Mf > 1e-6 ? MrF / Mf : 99.99, rVF: Vf > 1e-6 ? VrF / Vf : 99.99, rMC: Mc > 1e-6 ? MrC / Mc : 99.99, rVC: Vc > 1e-6 ? VrC / Vc : 99.99 };
      r.ok = min(r.rMF, r.rVF, r.rMC, r.rVC) >= 1; out.push(r);
    });
    return { name: w.name || 'Wing wall', piles: out, ok: out.every(q => q.ok) };
  }
  function summarise(B, spans, supports, vids) {
    const rows = {}; const push = (vid, comp, t, W, crit) => { if (!isFinite(t)) return; const r = rows[vid]; if (!r || t < r.t) rows[vid] = { t, pct: t / W * 100, comp, crit, W }; };
    const low = [], lowP = low.push.bind(low); low.push = q => (q.vid === 'M16' ? 0 : lowP(q)); // M1600 is recorded, not a deficiency (LRRD)
    spans.forEach((sp, si) => { if (!sp) return; sp.str.forEach(st => vids.forEach(vid => { const r = st.veh[vid]; if (r && !r.skip) { push(vid, 'Span ' + (si + 1) + ' stringer ' + st.s, r.t, r.W, r.crit); if (r.t < r.W) low.push({ comp: 'Span ' + (si + 1) + ' stringer ' + st.s, vid, t: r.t, pct: r.pct, crit: r.crit }); } }));
      if (sp.planks) Object.entries(sp.planks.veh).forEach(([vid, r]) => { if (vids.includes(vid)) { push(vid, 'Span ' + (si + 1) + ' deck planks', r.t, r.W, r.crit); if (r.t < r.W) low.push({ comp: 'Span ' + (si + 1) + ' deck planks', vid, t: r.t, pct: r.pct, crit: r.crit }); } }); });
    supports.forEach(su => { if (!su) return; su.piles.forEach(pr => vids.forEach(vid => { const r = pr.veh[vid], v = vehicle(vid); if (r && !r.skip) { push(vid, su.name + ' pile ' + pr.p, r.t, v.W, r.crit); if (r.t < v.W) low.push({ comp: su.name + ' pile ' + pr.p, vid, t: r.t, pct: r.t / v.W * 100, crit: r.crit }); } const b = pr.bear[vid]; if (b) { push(vid, su.name + ' pile ' + pr.p + ' halfcap bearing', b.t, v.W, 'Bearing'); if (b.t < v.W) low.push({ comp: su.name + ' pile ' + pr.p + ' halfcap bearing', vid, t: b.t, pct: b.pct, crit: 'Bearing' }); } }));
      if (su.halfcap) Object.entries(su.halfcap.veh).forEach(([vid, r]) => { const v = vehicle(vid); if (isFinite(r.t)) { push(vid, su.name + ' halfcap', r.t, v.W, r.crit); if (r.t < v.W) low.push({ comp: su.name + ' halfcap', vid, t: r.t, pct: r.pct, crit: r.crit }); } }); });
    // load limit (posting): M-Truck rating <= 10 t -> that; otherwise Tandem / 0.8 if below 16.5 t
    const mt = rows.MT && rows.MT.t, ta = rows.TA && rows.TA.t, tr = rows.TR && rows.TR.t;
    let limit = null; if (mt != null && mt < 10) limit = { t: mt, rule: 'M-Truck rating < 10 t' }; else if (ta != null && ta < 16.5) limit = { t: ta / 0.8, rule: 'Tandem rating < 16.5 t → limit = Tandem / 0.8' }; else if (tr != null && tr < 20) limit = { t: tr / 0.8, rule: 'Triaxle rating < 20 t → limit = Triaxle / 0.8' };
    return { rows, low, limit };
  }

  // ------------------------------------------------------------------ examples
  function newBridge() {
    const st = (W, H, V) => ({ W, H, V, def: 0, cond: 'G' });
    const span = L => ({ L, Lo: 0, ndiv: 12, width: 7.05, kerbL: 0.15, kerbR: 0.15, spacing: [0.24, 1.14, 1.07, 1.08, 1.07, 1.16, 1.08, 0.21], deck: { t: 0.12, E: 7900, gamma: 10.8, J: 1e-6 },
      stringers: Array.from({ length: 7 }, () => ({ mat: 'jarrah', grade: 'F17', e1: st(220, 450, 370), mid: st(220, 450, 480), e2: st(220, 450, 370) })),
      patches: [{ name: 'Kerb + guardrail L', gamma: 10.8, x: 0, y: 0, lx: L, ly: 0.15, t: [0.485, 0.485, 0.485, 0.485] }, { name: 'Kerb + guardrail R', gamma: 10.8, x: 0, y: 6.9, lx: L, ly: 0.15, t: [0.485, 0.485, 0.485, 0.485] }, { name: 'Pavement', gamma: 22, x: 0, y: 0.15, lx: L, ly: 6.75, t: [0.1, 0.1, 0.1, 0.1] }],
      planks: { on: true, b: 220, d: 127, rot: 0, pave: 0.1, mat: 'jarrah', grade: 'F7', topCut: 200 } });
    const pile = (x, d) => ({ x, d, def: 0, cond: 'G', mat: 'jarrah', grade: 'F17', Hgl: 1.2, dfix: 1.0, e: 0.15, dc: 1.0, hr: 0.6, ds: 0.6, osw: 0.5 });
    const piles = [0.5, 2.5, 4.5, 6.5].map(x => pile(x, 380));
    return { no: 'NEW', name: 'New timber bridge', designer: '', road: 'local', spans: [span(6.0), span(6.0), span(6.0)],
      supports: [0, 1, 2, 3].map(k => ({ kind: k === 0 || k === 3 ? 'abut' : 'pier', piles: JSON.parse(JSON.stringify(piles)), cap: { b: k === 0 || k === 3 ? 0.17 : 0.34, bh: 0.17, d: 0.35, E: 12000, mat: 'jarrah', grade: 'F14', bear: 80 }, wing: [] })),
      veh: { off: ['M16'], on: [] }, soil: { gamma: 20, ka: 0.33, sur: 1.0 } }; // M1600 not normally checked (workshop notes) — tick it to include
  }
  // Bridge 3393 (TIMBAR manual App C) – span 3 and the substructure as published
  function example3393() {
    const B = newBridge(); B.no = '3393'; B.name = 'Ambergate Rd over drain, Busselton (TIMBAR App C)'; B.road = 'local';
    const S = (W, H, V, o) => Object.assign({ W, H, V, def: 0, cond: 'G' }, o || {});
    const sp3 = B.spans[2]; sp3.L = 4.40; sp3.Lo = 3.60;
    const e1 = [S(200, 420, 370, { def: 1, R: 40 }), S(240, 480, 370), S(230, 460, 370), S(300, 570, 370), S(230, 460, 370), S(250, 500, 370), S(220, 450, 370)];
    const md = [S(200, 420, 460), S(200, 420, 470, { def: 1, R: 20 }), S(230, 460, 520), S(250, 520, 440), S(220, 440, 480), S(250, 530, 520), S(220, 440, 520)];
    const e2 = [S(220, 450, 370, { def: 2, Vs: 40, L: 90, Rr: 80 }), S(180, 370, 370, { def: 1.5, Vs: 125, L: 140, Rr: 130, Ts: 125, F: 1.086 }), S(250, 540, 370), S(240, 480, 370, { def: 1, R: 30 }), S(250, 500, 370, { def: 1, R: 30 }), S(220, 440, 370), S(250, 500, 370, { def: 2, Vs: 120, L: 160, Rr: 130 })];
    sp3.stringers = e1.map((x, i) => ({ mat: 'jarrah', grade: 'F17', e1: x, mid: md[i], e2: e2[i] }));
    sp3.patches = [{ name: 'Kerb L', gamma: 10.8, x: 0, y: 0, lx: 4.4, ly: 0.15, t: [0.485, 0.485, 0.485, 0.485] }, { name: 'Kerb R', gamma: 10.8, x: 0, y: 6.9, lx: 4.4, ly: 0.15, t: [0.485, 0.485, 0.485, 0.485] },
      { name: 'Pavement L', gamma: 22, x: 0, y: 0.15, lx: 4.4, ly: 3.375, t: [0.197, 0.19, 0.1, 0.1] }, { name: 'Pavement R', gamma: 22, x: 0, y: 3.525, lx: 4.4, ly: 3.375, t: [0.12, 0.113, 0.197, 0.19] }];
    sp3.planks = { on: true, b: 220, d: 120, rot: 5, pave: 0.1, paveDL: 0.12, mat: 'jarrah', grade: 'F7', topCut: 200 };
    B.veh.off = []; // the App C printout includes M1600
    B.spans[1].L = 6.05; B.spans[1].Lo = 4.56;
    B.spans[1].patches = [{ name: 'Kerb L', gamma: 10.8, x: 0, y: 0, lx: 6.05, ly: 0.15, t: [0.485, 0.485, 0.485, 0.485] }, { name: 'Kerb R', gamma: 10.8, x: 0, y: 6.9, lx: 6.05, ly: 0.15, t: [0.485, 0.485, 0.485, 0.485] },
      { name: 'Pavement L', gamma: 22, x: 0, y: 0.15, lx: 6.05, ly: 3.375, t: [0.19, 0.184, 0.1, 0.1] }, { name: 'Pavement R', gamma: 22, x: 0, y: 3.525, lx: 6.05, ly: 3.375, t: [0.113, 0.107, 0.19, 0.184] }];
    B.spans[0].L = 6.05; B.spans[0].rate = false; B.spans[0].patches.forEach(p => { p.lx = 6.05; });
    // pier 2 (between spans 2 and 3), abutment 2
    const pp = (x, d, o) => Object.assign({ x, d, def: 0, cond: 'G', mat: 'jarrah', grade: 'F17', dfix: 1.0, dc: 1.0 }, o);
    B.supports[2].piles = [pp(0.5, 430, { def: 2, L: 110, R: 80, B: 110, F: 70, Hgl: 0.9, e: 0.13, dc: 0.30 }), pp(2.48, 380, { Hgl: 1.6, e: 0.13 }), pp(4.50, 350, { Hgl: 1.4, e: 0.135, bearT: 80 }), pp(6.53, 380, { def: 1, r: 30, Hgl: 1.1, e: 0.1325 })];
    B.supports[2].cap = { b: 0.34, bh: 0.17, d: 0.35, E: 12000, mat: 'jarrah', grade: 'F14', bear: 80 };
    B.supports[3].piles = [pp(-0.26, 410, { id: 4, def: 2, L: 60, R: 40, B: 50, F: 40, Hgl: 0.9, e: 0.16, dc: 0.40, hr: 0.59, osw: 0.35, bearT: 90 }), pp(1.70, 410, { id: 5, Hgl: 0.9, e: 0.12, hr: 0.634 }), pp(3.58, 420, { id: 6, Hgl: 0.8, e: 0.125, hr: 0.685 }), pp(5.36, 410, { id: 7, cond: 'F', Hgl: 0.7, e: 0.1325, hr: 0.645 }), pp(7.34, 420, { id: 8, cond: 'F', Hgl: 0.9, e: 0.1275, hr: 0.61, osw: 0.43 })];
    B.supports[3].cap = { b: 0.17, bh: 0.17, d: 0.35, E: 12000, mat: 'jarrah', grade: 'F14', bear: 90 };
    B.supports[3].wing = [{ name: 'Abutment 2 LHS wing wall', phi: 30, alpha: 45, slope: 1.5, passive: true, osw: 0.6, piles: [{ id: 3, h: 1.5, s: 0.7, d: 390, def: 2, L: 50, R: 80, B: 60, F: 80, dc: 0.4 }, { id: 2, h: 0.5, s: 1.8, d: 410, cond: 'F' }, { id: 1, h: 0.1, s: 1.45, d: 350, def: 1, r: 40 }] }];
    B.supports[0].piles = []; B.supports[1].piles = [];
    return B;
  }

  G.TIMBER = { GRADES, SPECIES, COND, K1, STEELGR, steelSec, stringerSection, pileSection, vehicle, VEH_ORDER, vehOn, spanGeom, stringerProps, buildGrillage, deadLoad, vehicleSpan, supportLoads, effectsOf, pointToNodes,
    rate, rateStringers, pileCaps, ratePierPile, rateAbutPile, soilPile, halfcapBearing, rateHalfcap, rateDeckPlanks, rateWingWall, analyse, newBridge, example3393, polyProps };
})(typeof window !== 'undefined' ? window : globalThis);
