/* StructCap Analysis — 2D frame / truss finite-element engine (stiffness method).
   Units: kN, m (sections in mm, E in MPa, unit weight in kN/m³). Global axes: X right, Y up, rotation counter-clockwise.
   Analyses: linear static (load cases, superposed combinations), P-Delta (iterative geometric stiffness, members
   subdivided internally), modal (consistent mass, subspace iteration), elastic buckling (linearised, per combination).
   Member results: N (tension +), V, M (sagging +, local y to the left of i→j), local deflection, at stations. */
(function (G) {
  'use strict';
  const PI = Math.PI, gAcc = 9.81;

  // ------------------------------------------------------------------ sections
  function secProps(s) {
    const t = s.type;
    if (t === 'rect') { const b = +s.b, h = +s.h; return { A: b * h, I: b * h * h * h / 12, d: h }; }
    if (t === 'circ') { const D = +s.D; return { A: PI * D * D / 4, I: PI * Math.pow(D, 4) / 64, d: D }; }
    if (t === 'I') {
      const d = +s.d, bf = +s.bf, tf = +s.tf, tw = +s.tw, hw = d - 2 * tf;
      return { A: 2 * bf * tf + hw * tw, I: (bf * d * d * d - (bf - tw) * hw * hw * hw) / 12, d };
    }
    if (t === 'tube' && G.GANTRY) { const p = G.GANTRY.section(s.shape, s.size, 'C350L0'); return { A: p.A, I: p.Ix, d: p.D }; }
    return { A: +s.A || 1, I: +s.I || 1, d: +s.dd || 300 };
  }
  const concreteE = fc => { const t = [[20, 24000], [25, 26700], [32, 30100], [40, 32800], [50, 34800], [65, 37400], [80, 39600], [100, 42200]]; if (fc <= 20) return 24000; for (let i = 1; i < t.length; i++) if (fc <= t[i][0]) return t[i - 1][1] + (t[i][1] - t[i - 1][1]) * (fc - t[i - 1][0]) / (t[i][0] - t[i - 1][0]); return 42200; };

  // ------------------------------------------------------------------ small dense linear algebra
  function cholesky(A, n) { // in place, lower; returns false if not positive definite
    for (let j = 0; j < n; j++) {
      let s = A[j * n + j];
      for (let k = 0; k < j; k++) s -= A[j * n + k] * A[j * n + k];
      if (!(s > 1e-12 * Math.max(1, Math.abs(A[j * n + j])))) return false;
      const d = Math.sqrt(s); A[j * n + j] = d;
      for (let i = j + 1; i < n; i++) {
        let t = A[i * n + j];
        for (let k = 0; k < j; k++) t -= A[i * n + k] * A[j * n + k];
        A[i * n + j] = t / d;
      }
    }
    return true;
  }
  function cholSolve(L, n, b) { // L from cholesky (lower), solve L Lᵀ x = b
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i * n + k] * y[k]; y[i] = s / L[i * n + i]; }
    const x = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= L[k * n + i] * x[k]; x[i] = s / L[i * n + i]; }
    return x;
  }
  function jacobiEig(Ain, n) { // symmetric eigen: returns {val, vec (column-major n×n)}
    const A = Float64Array.from(Ain), V = new Float64Array(n * n);
    for (let i = 0; i < n; i++) V[i * n + i] = 1;
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i * n + j] * A[i * n + j];
      if (off < 1e-22) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        const apq = A[p * n + q]; if (Math.abs(apq) < 1e-300) continue;
        const th = (A[q * n + q] - A[p * n + p]) / (2 * apq), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = A[k * n + p], akq = A[k * n + q]; A[k * n + p] = c * akp - s * akq; A[k * n + q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = A[p * n + k], aqk = A[q * n + k]; A[p * n + k] = c * apk - s * aqk; A[q * n + k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k * n + p], vkq = V[k * n + q]; V[k * n + p] = c * vkp - s * vkq; V[k * n + q] = s * vkp + c * vkq; }
      }
    }
    return { val: Array.from({ length: n }, (_, i) => A[i * n + i]), vec: V };
  }

  // ------------------------------------------------------------------ element matrices (local)
  function kLocal(E, A, I, L) {
    const a = E * A / L, b = 12 * E * I / (L * L * L), c = 6 * E * I / (L * L), d = 4 * E * I / L, e = 2 * E * I / L;
    return [
      [a, 0, 0, -a, 0, 0], [0, b, c, 0, -b, c], [0, c, d, 0, -c, e],
      [-a, 0, 0, a, 0, 0], [0, -b, -c, 0, b, -c], [0, c, e, 0, -c, d]];
  }
  function kgLocal(N, L, simple) {
    const z = [0, 0, 0, 0, 0, 0], K = [z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice()];
    if (simple) { const s = N / L; K[1][1] = s; K[1][4] = -s; K[4][1] = -s; K[4][4] = s; return K; }
    const s = N / L, l = L;
    const g = [[6 / 5, l / 10, -6 / 5, l / 10], [l / 10, 2 * l * l / 15, -l / 10, -l * l / 30], [-6 / 5, -l / 10, 6 / 5, -l / 10], [l / 10, -l * l / 30, -l / 10, 2 * l * l / 15]];
    const ix = [1, 2, 4, 5];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) K[ix[i]][ix[j]] = s * g[i][j];
    return K;
  }
  function mLocal(m, L) { // consistent mass, m = mass per length (t/m)
    const z = [0, 0, 0, 0, 0, 0], M = [z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice()];
    const a = m * L / 6; M[0][0] = 2 * a; M[0][3] = a; M[3][0] = a; M[3][3] = 2 * a;
    const c = m * L / 420, l = L, B = [[156, 22 * l, 54, -13 * l], [22 * l, 4 * l * l, 13 * l, -3 * l * l], [54, 13 * l, 156, -22 * l], [-13 * l, -3 * l * l, -22 * l, 4 * l * l]], ix = [1, 2, 4, 5];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) M[ix[i]][ix[j]] = c * B[i][j];
    return M;
  }
  // Hermite shape functions (ξ = x/L)
  const H = (xi, L) => [1 - 3 * xi * xi + 2 * xi * xi * xi, L * (xi - 2 * xi * xi + xi * xi * xi), 3 * xi * xi - 2 * xi * xi * xi, L * (-xi * xi + xi * xi * xi)];
  const dH = (xi, L) => [(-6 * xi + 6 * xi * xi) / L, 1 - 4 * xi + 3 * xi * xi, (6 * xi - 6 * xi * xi) / L, -2 * xi + 3 * xi * xi];
  const GP = [[-0.861136311594053, 0.347854845137454], [-0.339981043584856, 0.652145154862546], [0.339981043584856, 0.652145154862546], [0.861136311594053, 0.347854845137454]];

  // equivalent nodal loads (local) of an element load list; loads: {k:'d', a, b, qx1, qx2, qy1, qy2} | {k:'p', a, Px, Py} | {k:'m', a, M}
  function feq(loads, L) {
    const F = [0, 0, 0, 0, 0, 0];
    const addPoint = (x, px, py) => { const xi = x / L, h = H(xi, L); F[0] += px * (1 - xi); F[3] += px * xi; F[1] += py * h[0]; F[2] += py * h[1]; F[4] += py * h[2]; F[5] += py * h[3]; };
    loads.forEach(ld => {
      if (ld.k === 'p') addPoint(ld.a, ld.Px, ld.Py);
      else if (ld.k === 'm') { const d = dH(ld.a / L, L); F[1] += ld.M * d[0]; F[2] += ld.M * d[1]; F[4] += ld.M * d[2]; F[5] += ld.M * d[3]; }
      else {
        const a = ld.a, b = ld.b, half = (b - a) / 2, mid = (a + b) / 2;
        GP.forEach(([g, w]) => { const x = mid + half * g, t = (x - a) / ((b - a) || 1); addPoint(x, (ld.qx1 + (ld.qx2 - ld.qx1) * t) * w * half, (ld.qy1 + (ld.qy2 - ld.qy1) * t) * w * half); });
      }
    });
    return F;
  }
  // resultant of element loads on [0, x]: Qx, Qy and moment about x of the transverse loads, applied couples
  function loadsUpTo(loads, x) {
    let Qx = 0, Qy = 0, Mq = 0;
    loads.forEach(ld => {
      if (ld.k === 'p') { if (ld.a <= x + 1e-12) { Qx += ld.Px; Qy += ld.Py; Mq += ld.Py * (x - ld.a); } }
      else if (ld.k === 'm') { if (ld.a <= x + 1e-12) Mq -= ld.M; }
      else {
        const a = ld.a, b = Math.min(ld.b, x); if (b <= a) return;
        const len = ld.b - ld.a, q = s => ld.qy1 + (ld.qy2 - ld.qy1) * (s - a) / (len || 1), qx = s => ld.qx1 + (ld.qx2 - ld.qx1) * (s - a) / (len || 1);
        const qa = q(a), qb = q(b), l = b - a;
        Qy += (qa + qb) / 2 * l; Qx += (qx(a) + qx(b)) / 2 * l;
        // moment about x of a trapezoid on [a,b]: ∫ q(s)(x−s) ds
        Mq += qa * l * (x - a - l / 2) + (qb - qa) * l / 2 * (x - a - 2 * l / 3);
      }
    });
    return { Qx, Qy, Mq };
  }

  // ------------------------------------------------------------------ model → analysis mesh
  function build(model, nseg) {
    const nodes = model.nodes, nid = {}; nodes.forEach((n, i) => { nid[n.id] = i; });
    const sec = {}; model.sections.forEach(s => { sec[s.id] = Object.assign({}, s, secProps(s)); });
    const mat = {}; model.materials.forEach(m => { mat[m.id] = m; });
    const pts = nodes.map(n => ({ x: +n.x, y: +n.y, real: true })), els = [], mems = [];
    model.members.forEach((m, mi) => {
      const i = nid[m.i], j = nid[m.j];
      if (i === undefined || j === undefined || i === j) throw new Error('member ' + m.id + ': bad nodes');
      const s = sec[m.sec], t = mat[m.mat];
      if (!s || !t) throw new Error('member ' + m.id + ': section / material missing');
      const xi = pts[i].x, yi = pts[i].y, dx = pts[j].x - xi, dy = pts[j].y - yi, L = Math.hypot(dx, dy);
      if (L < 1e-9) throw new Error('member ' + m.id + ': zero length');
      const truss = m.type === 'truss', ns = truss ? 1 : Math.max(1, nseg | 0);
      const idx = [i]; for (let k = 1; k < ns; k++) { idx.push(pts.length); pts.push({ x: xi + dx * k / ns, y: yi + dy * k / ns, real: false, mem: mi }); } idx.push(j);
      const E = (+t.E) * 1e3, A = s.A * 1e-6, I = s.I * 1e-12, w = (+t.rho || 0) * A;
      const rec = { mi, id: m.id, L, c: dx / L, s: dy / L, E, A, I, w, els: [], sec: s, mat: t, truss };
      for (let k = 0; k < ns; k++) els.push(Object.assign({ n1: idx[k], n2: idx[k + 1], x0: L * k / ns, l: L / ns, rel1: truss || (k === 0 && !!m.relI), rel2: truss || (k === ns - 1 && !!m.relJ), mem: rec }, {}));
      rec.els = els.slice(els.length - ns);
      mems.push(rec);
    });
    return { pts, els, mems, nid };
  }

  // member loads of one load case, in local coordinates, split per element
  function caseLoads(model, mesh, caseId, factor) {
    const nodal = new Map(), byEl = new Map(), cs = model.cases.find(c => c.id === caseId) || {};
    const addN = (p, fx, fy, mz) => { const v = nodal.get(p) || [0, 0, 0]; v[0] += fx * factor; v[1] += fy * factor; v[2] += mz * factor; nodal.set(p, v); };
    const memLoad = (rec, ld) => { // ld in member-local, position along member
      rec.els.forEach(el => {
        const x0 = el.x0, x1 = el.x0 + el.l, list = byEl.get(el) || []; byEl.set(el, list);
        if (ld.k === 'p' || ld.k === 'm') { if (ld.a >= x0 - 1e-9 && ld.a <= x1 + 1e-9 && !(ld.a === x0 && x0 > 0)) list.push(Object.assign({}, ld, { a: Math.min(el.l, Math.max(0, ld.a - x0)) })); }
        else {
          const a = Math.max(ld.a, x0), b = Math.min(ld.b, x1); if (b - a < 1e-9) return;
          const qa = t => ld.qy1 + (ld.qy2 - ld.qy1) * (t - ld.a) / ((ld.b - ld.a) || 1), qxa = t => ld.qx1 + (ld.qx2 - ld.qx1) * (t - ld.a) / ((ld.b - ld.a) || 1);
          list.push({ k: 'd', a: a - x0, b: b - x0, qy1: qa(a), qy2: qa(b), qx1: qxa(a), qx2: qxa(b) });
        }
      });
    };
    if (cs.sw) mesh.mems.forEach(rec => { if (rec.w) memLoad(rec, { k: 'd', a: 0, b: rec.L, qx1: -rec.w * rec.s * factor, qx2: -rec.w * rec.s * factor, qy1: -rec.w * rec.c * factor, qy2: -rec.w * rec.c * factor }); });
    model.loads.filter(l => l.case === caseId).forEach(l => {
      if (l.kind === 'node') { const p = mesh.nid[l.node]; if (p !== undefined) addN(p, +l.Fx || 0, +l.Fy || 0, +l.Mz || 0); return; }
      const rec = mesh.mems.find(r => r.id === l.member); if (!rec) return;
      const L = rec.L, toLoc = (gx, gy) => [gx * rec.c + gy * rec.s, -gx * rec.s + gy * rec.c];
      // direction: 'gy' global Y (per member length), 'gyp' global Y projected (per horizontal length), 'gx' global X, 'ly' local y, 'lx' local x
      const dir = l.dir || 'gy', vec = v => dir === 'ly' ? [0, v] : dir === 'lx' ? [v, 0] : dir === 'gx' ? toLoc(v, 0) : toLoc(0, v);
      const proj = dir === 'gyp' ? Math.abs(rec.c) : dir === 'gxp' ? Math.abs(rec.s) : 1;
      if (l.kind === 'udl') {
        const a = Math.max(0, Math.min(L, (+l.a || 0))), b = l.b === '' || l.b == null || +l.b <= 0 ? L : Math.max(a, Math.min(L, +l.b));
        const [x1, y1] = vec((+l.w1 || 0) * proj * factor), [x2, y2] = vec((l.w2 === '' || l.w2 == null ? +l.w1 || 0 : +l.w2) * proj * factor);
        memLoad(rec, { k: 'd', a, b, qx1: x1, qx2: x2, qy1: y1, qy2: y2 });
      } else if (l.kind === 'point') {
        const a = Math.max(0, Math.min(L, +l.a || 0)), [px, py] = vec((+l.P || 0) * factor);
        memLoad(rec, { k: 'p', a, Px: px, Py: py });
      } else if (l.kind === 'moment') {
        memLoad(rec, { k: 'm', a: Math.max(0, Math.min(L, +l.a || 0)), M: (+l.M || 0) * factor });
      }
    });
    return { nodal, byEl };
  }

  // ------------------------------------------------------------------ assembly
  function T6(c, s) { return [[c, s, 0, 0, 0, 0], [-s, c, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0], [0, 0, 0, c, s, 0], [0, 0, 0, -s, c, 0], [0, 0, 0, 0, 0, 1]]; }
  const mul = (A, B) => A.map((r, i) => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
  const tr = A => A[0].map((_, j) => A.map(r => r[j]));
  const mv = (A, v) => A.map(r => r.reduce((s, x, k) => s + x * v[k], 0));
  function condense(K, F, rel) { // static condensation of released rotational dofs (local 2 and/or 5)
    if (!rel.length) return { K, F };
    const o = [0, 1, 2, 3, 4, 5].filter(i => !rel.includes(i));
    const Krr = rel.map(i => rel.map(j => K[i][j]));
    const det = rel.length === 1 ? Krr[0][0] : Krr[0][0] * Krr[1][1] - Krr[0][1] * Krr[1][0];
    const inv = rel.length === 1 ? [[1 / Krr[0][0]]] : [[Krr[1][1] / det, -Krr[0][1] / det], [-Krr[1][0] / det, Krr[0][0] / det]];
    const Kc = K.map(r => r.slice()), Fc = F.slice();
    o.forEach(i => {
      const kir = rel.map(r => K[i][r]), t = inv.map(row => row.reduce((s, v, k) => s + v * kir[k], 0)); // inv·k_ri (symmetric)
      o.forEach(j => { Kc[i][j] = K[i][j] - rel.reduce((s, r, a) => s + t[a] * K[r][j], 0); });
      Fc[i] = F[i] - rel.reduce((s, r, a) => s + t[a] * F[r], 0);
    });
    rel.forEach(r => { for (let k = 0; k < 6; k++) { Kc[r][k] = 0; Kc[k][r] = 0; } Fc[r] = 0; });
    return { K: Kc, F: Fc, inv };
  }
  const relOf = el => (el.rel1 ? [2] : []).concat(el.rel2 ? [5] : []);
  function elMats(el, N, simpleKg) {
    const m = el.mem, kl = kLocal(m.E, m.A, m.I, el.l);
    if (N) { const kg = kgLocal(N, el.l, simpleKg || el.rel1 || el.rel2); for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) kl[i][j] += kg[i][j]; }
    return kl;
  }

  function supportsOf(model, mesh) {
    const fixed = new Set(), springs = new Map();
    model.nodes.forEach((n, i) => {
      const s = n.sup || 'free';
      const r = { fixed: [1, 1, 1], pin: [1, 1, 0], rollerX: [0, 1, 0], rollerY: [1, 0, 0], free: [0, 0, 0], guided: [1, 0, 1], fixedRot: [0, 0, 1] }[s] || [0, 0, 0];
      r.forEach((v, d) => { if (v) fixed.add(3 * i + d); });
      ['kx', 'ky', 'kr'].forEach((k, d) => { if (+n[k] > 0 && !fixed.has(3 * i + d)) springs.set(3 * i + d, +n[k]); });
    });
    // joints where every member end is pinned have no rotational stiffness: hold that rotation
    const rigid = new Int32Array(mesh.pts.length);
    mesh.els.forEach(el => { if (!el.rel1) rigid[el.n1]++; if (!el.rel2) rigid[el.n2]++; });
    mesh.pts.forEach((p, i) => { if (!rigid[i] && !springs.has(3 * i + 2)) fixed.add(3 * i + 2); });
    return { fixed, springs };
  }

  // linear (or with axial forces Nel for geometric stiffness) static solve of one load set
  function solveStatic(model, mesh, loadset, Nel, simpleKg) {
    const nd = mesh.pts.length * 3, sup = supportsOf(model, mesh);
    const free = [], map = new Int32Array(nd).fill(-1);
    for (let d = 0; d < nd; d++) if (!sup.fixed.has(d)) { map[d] = free.length; free.push(d); }
    const n = free.length, K = new Float64Array(n * n), F = new Float64Array(n), Fall = new Float64Array(nd);
    const elData = [];
    mesh.els.forEach((el, e) => {
      const m = el.mem, Tm = T6(m.c, m.s), kl = elMats(el, Nel ? Nel[e] : 0, simpleKg);
      const fl = feq(loadset.byEl.get(el) || [], el.l), rel = relOf(el), cd = condense(kl, fl, rel);
      const kg = mul(mul(tr(Tm), cd.K), Tm), fg = mv(tr(Tm), cd.F);
      const dofs = [3 * el.n1, 3 * el.n1 + 1, 3 * el.n1 + 2, 3 * el.n2, 3 * el.n2 + 1, 3 * el.n2 + 2];
      for (let a = 0; a < 6; a++) { Fall[dofs[a]] += fg[a]; const ia = map[dofs[a]]; if (ia < 0) continue; F[ia] += fg[a]; for (let b = 0; b < 6; b++) { const ib = map[dofs[b]]; if (ib >= 0) K[ia * n + ib] += kg[a][b]; } }
      elData.push({ kl, fl, rel, Tm, dofs });
    });
    loadset.nodal.forEach((v, p) => { for (let d = 0; d < 3; d++) { Fall[3 * p + d] += v[d]; const i = map[3 * p + d]; if (i >= 0) F[i] += v[d]; } });
    sup.springs.forEach((k, d) => { const i = map[d]; if (i >= 0) K[i * n + i] += k; });
    const u = new Float64Array(nd);
    if (n) {
      const Lc = K.slice();
      if (!cholesky(Lc, n)) return { ok: false, reason: 'unstable' };
      const uf = cholSolve(Lc, n, F);
      free.forEach((d, i) => { u[d] = uf[i]; });
    }
    // reactions = Σ element end forces on restrained dofs − nodal loads there
    const R = new Float64Array(nd);
    elData.forEach(ed => {
      const ug = ed.dofs.map(d => u[d]), ul = mv(ed.Tm, ug);
      const full = recoverRel(ed.kl, ed.fl, ed.rel, ul);
      const fe = mv(ed.kl, full).map((v, k) => v - ed.fl[k]);
      ed.ul = full; ed.fe = fe;
      const fgl = mv(tr(ed.Tm), fe); ed.dofs.forEach((d, k) => { R[d] += fgl[k]; });
    });
    loadset.nodal.forEach((v, p) => { for (let d = 0; d < 3; d++) R[3 * p + d] -= v[d]; });
    sup.springs.forEach((k, d) => { R[d] = -k * u[d]; });
    return { ok: true, u, R, elData, sup };
  }
  function recoverRel(kl, fl, rel, ul) {
    const u = ul.slice(); if (!rel.length) return u;
    const o = [0, 1, 2, 3, 4, 5].filter(i => !rel.includes(i));
    // k_rr u_r = F_r − k_ro u_o
    const rhs = rel.map(r => fl[r] - o.reduce((s, j) => s + kl[r][j] * ul[j], 0));
    if (rel.length === 1) u[rel[0]] = rhs[0] / kl[rel[0]][rel[0]];
    else { const a = kl[2][2], b = kl[2][5], c = kl[5][2], d = kl[5][5], det = a * d - b * c; u[2] = (d * rhs[0] - b * rhs[1]) / det; u[5] = (-c * rhs[0] + a * rhs[1]) / det; }
    return u;
  }

  // ------------------------------------------------------------------ member results from element results
  function memberResults(mesh, st, loadset, nps) {
    return mesh.mems.map(rec => {
      const out = { id: rec.id, L: rec.L, x: [], N: [], V: [], M: [], dx: [], dy: [], dl: [] };
      rec.els.forEach((el, k) => {
        const e = mesh.els.indexOf(el), ed = st.elData[e], f = ed.fe, loads = loadset.byEl.get(el) || [], l = el.l;
        const ul = ed.ul, m = rec;
        // particular (fixed-fixed) deflection under the element loads, by double integration of M/EI
        const fl = feq(loads, l), np = Math.max(nps, 2), xs = Array.from({ length: np + 1 }, (_, i) => l * i / np);
        // fixed-fixed end forces f0 = −F_eq ⇒ M(x) = −f0m + x f0y + Mq = F_eq[2] − x F_eq[1] + Mq
        const Mp = xs.map(x => fl[2] - x * fl[1] + loadsUpTo(loads, x).Mq);
        const EI = m.E * m.I, th = [0], vp = [0];
        for (let i = 1; i <= np; i++) { const h = xs[i] - xs[i - 1]; th.push(th[i - 1] + (Mp[i] + Mp[i - 1]) / 2 / EI * h); vp.push(vp[i - 1] + (th[i] + th[i - 1]) / 2 * h); }
        const corr = vp[np] / l;
        xs.forEach((x, i) => {
          if (k > 0 && i === 0) return;
          const q = loadsUpTo(loads, x), xi = x / l, h = H(xi, l);
          const N = -f[0] - q.Qx, V = f[1] + q.Qy, M = -f[2] + x * f[1] + q.Mq;
          const v = ul[1] * h[0] + ul[2] * h[1] + ul[4] * h[2] + ul[5] * h[3] + (vp[i] - corr * x);
          const u = ul[0] * (1 - xi) + ul[3] * xi;
          out.x.push(el.x0 + x); out.N.push(N); out.V.push(V); out.M.push(M);
          out.dx.push(u * m.c - v * m.s); out.dy.push(u * m.s + v * m.c);
          out.dl.push(v);
        });
      });
      // deflection relative to the chord between the member ends
      const n = out.x.length, v0 = out.dl[0], v1 = out.dl[n - 1];
      out.drel = out.dl.map((v, i) => v - (v0 + (v1 - v0) * out.x[i] / rec.L));
      return out;
    });
  }

  // ------------------------------------------------------------------ public: analyse
  function analyse(model, opt) {
    opt = Object.assign({ pdelta: false, nseg: 4, modes: 0, buckling: false, nps: 10 }, opt || {});
    const t0 = Date.now(), warn = [];
    const nsegLin = 1;
    const meshL = build(model, nsegLin), meshS = (opt.pdelta || opt.modes || opt.buckling) ? build(model, opt.nseg) : null;
    const res = { cases: {}, combos: {}, warn, meshL, meshS, model };
    const pack = (mesh, st, ls) => ({ u: st.u, R: st.R, mem: memberResults(mesh, st, ls, mesh === meshL ? 20 : Math.max(4, Math.round(20 / opt.nseg))), mesh });
    // load cases, linear
    model.cases.forEach(c => {
      const ls = caseLoads(model, meshL, c.id, 1), st = solveStatic(model, meshL, ls);
      if (!st.ok) throw Object.assign(new Error('The structure is unstable (mechanism) — check supports and releases.'), { code: 'unstable' });
      res.cases[c.id] = Object.assign(pack(meshL, st, ls), { name: c.name });
    });
    // combinations
    const comboLoads = (mesh, cb) => {
      const out = { nodal: new Map(), byEl: new Map() };
      Object.entries(cb.f || {}).forEach(([cid, fct]) => {
        if (!+fct) return; const l = caseLoads(model, mesh, cid, +fct);
        l.nodal.forEach((v, p) => { const o = out.nodal.get(p) || [0, 0, 0]; out.nodal.set(p, [o[0] + v[0], o[1] + v[1], o[2] + v[2]]); });
        l.byEl.forEach((arr, el) => { out.byEl.set(el, (out.byEl.get(el) || []).concat(arr)); });
      });
      return out;
    };
    model.combos.forEach(cb => {
      if (!opt.pdelta) {
        const ls = comboLoads(meshL, cb), st = solveStatic(model, meshL, ls);
        res.combos[cb.id] = Object.assign(pack(meshL, st, ls), { name: cb.name, type: cb.type });
        return;
      }
      const ls = comboLoads(meshS, cb);
      let st = solveStatic(model, meshS, ls), it = 0, conv = false, lastU = st.u;
      while (it < 20 && st.ok) {
        const Nel = st.elData.map(ed => ed.fe[3]); // tension + : force on end 2 along local x
        const s2 = solveStatic(model, meshS, ls, Nel);
        it++;
        if (!s2.ok) { st = s2; break; }
        let d = 0, mx = 1e-12; for (let i = 0; i < s2.u.length; i++) { d = Math.max(d, Math.abs(s2.u[i] - lastU[i])); mx = Math.max(mx, Math.abs(s2.u[i])); }
        lastU = s2.u; st = s2;
        if (d / mx < 1e-6) { conv = true; break; }
      }
      if (!st.ok) { res.combos[cb.id] = { name: cb.name, type: cb.type, failed: true }; warn.push(cb.name + ': P-Delta analysis did not converge — the load exceeds the elastic critical load.'); return; }
      if (!conv) warn.push(cb.name + ': P-Delta iterations did not fully converge.');
      res.combos[cb.id] = Object.assign(pack(meshS, st, ls), { name: cb.name, type: cb.type, iters: it });
    });
    // modal
    if (opt.modes > 0) {
      try { res.modal = modal(model, meshS, opt.modes, opt.massSrc || {}); } catch (e) { warn.push('Modal analysis: ' + e.message); }
    }
    if (opt.buckling) {
      res.buckling = {};
      model.combos.filter(c => c.type !== 'SLS').forEach(cb => {
        try { res.buckling[cb.id] = buckle(model, meshS, comboLoads(meshS, cb)); } catch (e) { res.buckling[cb.id] = { error: e.message }; }
      });
    }
    res.ms = Date.now() - t0;
    return res;
  }

  // ------------------------------------------------------------------ generalized eigen (subspace iteration)
  function freeDofs(model, mesh) {
    const nd = mesh.pts.length * 3, sup = supportsOf(model, mesh), free = [], map = new Int32Array(nd).fill(-1);
    for (let d = 0; d < nd; d++) if (!sup.fixed.has(d)) { map[d] = free.length; free.push(d); }
    return { nd, sup, free, map, n: free.length };
  }
  function assembleK(model, mesh, fd, Nel, kgOnly) {
    const n = fd.n, K = new Float64Array(n * n);
    mesh.els.forEach((el, e) => {
      const m = el.mem, Tm = T6(m.c, m.s);
      let kl;
      if (kgOnly) kl = kgLocal(Nel[e], el.l, el.rel1 || el.rel2);
      else kl = condense(kLocal(m.E, m.A, m.I, el.l), [0, 0, 0, 0, 0, 0], relOf(el)).K;
      const kg = mul(mul(tr(Tm), kl), Tm), dofs = [3 * el.n1, 3 * el.n1 + 1, 3 * el.n1 + 2, 3 * el.n2, 3 * el.n2 + 1, 3 * el.n2 + 2];
      for (let a = 0; a < 6; a++) { const ia = fd.map[dofs[a]]; if (ia < 0) continue; for (let b = 0; b < 6; b++) { const ib = fd.map[dofs[b]]; if (ib >= 0) K[ia * n + ib] += kg[a][b]; } }
    });
    if (!kgOnly) fd.sup.springs.forEach((k, d) => { const i = fd.map[d]; if (i >= 0) K[i * n + i] += k; });
    return K;
  }
  // released rotations carry no stiffness in K: add a tiny rotational spring so K stays positive definite
  function stabilise(K, n) { let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, K[i * n + i]); for (let i = 0; i < n; i++) if (K[i * n + i] < 1e-9 * mx) K[i * n + i] += 1e-9 * mx + 1e-9; }
  function subspace(K, B, n, p, iters) { // K x = λ B x, lowest λ for positive B; returns {lam, X}
    const L = K.slice(); if (!cholesky(L, n)) throw new Error('stiffness matrix is singular — the structure is a mechanism');
    const q = Math.min(n, Math.max(p * 2, p + 8));
    let X = []; for (let j = 0; j < q; j++) { const v = new Float64Array(n); for (let i = 0; i < n; i++) v[i] = (B[i * n + i] || 0) * (j === 0 ? 1 : Math.sin((i + 1) * (j + 1) * 1.37)); if (j > 0 || !v.some(Boolean)) for (let i = 0; i < n; i++) v[i] += Math.cos((i + 3) * (j + 2) * 0.7) * 1e-3; X.push(v); }
    const Bm = v => { const o = new Float64Array(n); for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < n; k++) s += B[i * n + k] * v[k]; o[i] = s; } return o; };
    let lamOld = null, out = null;
    for (let it = 0; it < (iters || 40); it++) {
      const BX = X.map(Bm), Y = BX.map(b => cholSolve(L, n, b));
      const BY = Y.map(Bm), Kr = new Float64Array(q * q), Br = new Float64Array(q * q);
      for (let a = 0; a < q; a++) for (let b = 0; b < q; b++) { let s1 = 0, s2 = 0; for (let i = 0; i < n; i++) { s1 += Y[a][i] * BX[b][i]; s2 += Y[a][i] * BY[b][i]; } Kr[a * q + b] = s1; Br[a * q + b] = s2; }
      // Br z = μ Kr z  (μ = 1/λ); Kr = Lr Lrᵀ
      const Lr = Kr.slice(); if (!cholesky(Lr, q)) break;
      const inv = new Float64Array(q * q); // Lr⁻¹
      for (let j = 0; j < q; j++) { const e = new Float64Array(q); e[j] = 1; for (let i = 0; i < q; i++) { let s = e[i]; for (let k = 0; k < i; k++) s -= Lr[i * q + k] * inv[k * q + j]; inv[i * q + j] = s / Lr[i * q + i]; } }
      const C = new Float64Array(q * q);
      for (let i = 0; i < q; i++) for (let j = 0; j < q; j++) { let s = 0; for (let a = 0; a < q; a++) for (let b = 0; b < q; b++) s += inv[i * q + a] * Br[a * q + b] * inv[j * q + b]; C[i * q + j] = s; }
      const eg = jacobiEig(C, q), ord = eg.val.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]);
      const Z = ord.map(([, i]) => { const w = new Float64Array(q); for (let a = 0; a < q; a++) { let s = 0; for (let b = 0; b < q; b++) s += inv[b * q + a] * eg.vec[b * q + i]; w[a] = s; } return w; });
      X = Z.map(z => { const v = new Float64Array(n); for (let a = 0; a < q; a++) for (let i = 0; i < n; i++) v[i] += z[a] * Y[a][i]; return v; });
      const mu = ord.map(o => o[0]);
      out = { mu, X };
      if (lamOld && mu.slice(0, p).every((m, i) => Math.abs(m - lamOld[i]) <= 1e-8 * Math.abs(m) + 1e-14)) break;
      lamOld = mu;
    }
    return out;
  }
  function modal(model, mesh, nm, src) {
    const fd = freeDofs(model, mesh), n = fd.n;
    if (!n) throw new Error('no free degrees of freedom');
    const K = assembleK(model, mesh, fd); stabilise(K, n);
    const M = new Float64Array(n * n);
    mesh.els.forEach(el => {
      const m = el.mem, mm = m.w / gAcc; if (!mm) return;
      const Tm = T6(m.c, m.s), ml = mLocal(mm, el.l), mg = mul(mul(tr(Tm), ml), Tm), dofs = [3 * el.n1, 3 * el.n1 + 1, 3 * el.n1 + 2, 3 * el.n2, 3 * el.n2 + 1, 3 * el.n2 + 2];
      for (let a = 0; a < 6; a++) { const ia = fd.map[dofs[a]]; if (ia < 0) continue; for (let b = 0; b < 6; b++) { const ib = fd.map[dofs[b]]; if (ib >= 0) M[ia * n + ib] += mg[a][b]; } }
    });
    // added mass from the mass source: downward loads of the chosen cases (× factor) / g, lumped in X and Y
    Object.entries(src).forEach(([cid, fct]) => {
      if (!+fct) return; const ls = caseLoads(model, mesh, cid, +fct);
      const lump = (p, fy) => { const mass = Math.max(0, -fy) / gAcc; [0, 1].forEach(d => { const i = fd.map[3 * p + d]; if (i >= 0) M[i * n + i] += mass; }); };
      ls.nodal.forEach((v, p) => lump(p, v[1]));
      ls.byEl.forEach((arr, el) => { const fl = feq(arr, el.l), m = el.mem, fy1 = -fl[0] * m.s + fl[1] * m.c, fy2 = -fl[3] * m.s + fl[4] * m.c; lump(el.n1, fy1); lump(el.n2, fy2); });
    });
    let tot = 0; for (let i = 0; i < n; i++) tot += M[i * n + i];
    if (!(tot > 0)) throw new Error('no mass — give the members a unit weight or choose a mass source');
    // tiny rotational mass so that M is positive (consistent mass already has it for frame members)
    for (let i = 0; i < n; i++) if (M[i * n + i] <= 0) M[i * n + i] = 1e-12 * tot;
    const p = Math.min(nm, n), sol = subspace(K, M, n, p, 60);
    const rX = new Float64Array(n), rY = new Float64Array(n);
    fd.free.forEach((d, i) => { if (d % 3 === 0) rX[i] = 1; if (d % 3 === 1) rY[i] = 1; });
    const Mv = v => { const o = new Float64Array(n); for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < n; k++) s += M[i * n + k] * v[k]; o[i] = s; } return o; };
    const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
    const MX = dot(rX, Mv(rX)), MY = dot(rY, Mv(rY));
    const modes = [];
    for (let k = 0; k < p; k++) {
      const mu = sol.mu[k]; if (!(mu > 0)) continue;
      const w2 = 1 / mu, w = Math.sqrt(w2), phi = sol.X[k], Mp = Mv(phi), mgen = dot(phi, Mp);
      const LX = dot(phi, Mv(rX)), LY = dot(phi, Mv(rY));
      const u = new Float64Array(fd.nd); let mx = 0;
      fd.free.forEach((d, i) => { u[d] = phi[i]; if (d % 3 !== 2) mx = Math.max(mx, Math.abs(phi[i])); });
      for (let i = 0; i < u.length; i++) u[i] /= mx || 1;
      modes.push({ w, f: w / 2 / PI, T: 2 * PI / w, mx: MX ? LX * LX / mgen / MX : 0, my: MY ? LY * LY / mgen / MY : 0, u });
    }
    let cx = 0, cy = 0; modes.forEach(m => { cx += m.mx; cy += m.my; m.cmx = cx; m.cmy = cy; });
    return { modes, mesh, massX: MX, massY: MY };
  }
  function buckle(model, mesh, ls) {
    const st = solveStatic(model, mesh, ls);
    if (!st.ok) throw new Error('unstable');
    const Nel = st.elData.map(ed => ed.fe[3]);
    if (!Nel.some(N => N < -1e-6)) return { none: true };
    const fd = freeDofs(model, mesh), n = fd.n;
    const K = assembleK(model, mesh, fd); stabilise(K, n);
    const Kg = assembleK(model, mesh, fd, Nel, true); for (let i = 0; i < n * n; i++) Kg[i] = -Kg[i];
    const sol = subspace(K, Kg, n, 3, 80);
    const out = [];
    for (let k = 0; k < sol.mu.length && out.length < 3; k++) {
      const mu = sol.mu[k]; if (!(mu > 1e-9)) continue;
      const phi = sol.X[k], u = new Float64Array(fd.nd); let mx = 0;
      fd.free.forEach((d, i) => { u[d] = phi[i]; if (d % 3 !== 2) mx = Math.max(mx, Math.abs(phi[i])); });
      for (let i = 0; i < u.length; i++) u[i] /= mx || 1;
      out.push({ lam: 1 / mu, u });
    }
    return { modes: out, mesh };
  }

  // ------------------------------------------------------------------ envelopes
  function envelope(res, ids) {
    const list = ids.map(id => res.combos[id]).filter(r => r && !r.failed);
    if (!list.length) return null;
    const mem = list[0].mem.map((m0, k) => {
      const e = { id: m0.id, L: m0.L, x: m0.x, Nmax: [], Nmin: [], Vmax: [], Vmin: [], Mmax: [], Mmin: [] };
      m0.x.forEach((_, i) => {
        ['N', 'V', 'M'].forEach(q => { const vals = list.map(r => r.mem[k][q][i]); e[q + 'max'].push(Math.max(...vals)); e[q + 'min'].push(Math.min(...vals)); });
      });
      return e;
    });
    const R = {}; const nd = list[0].R.length;
    for (let d = 0; d < nd; d++) { const vals = list.map(r => r.R[d]); R[d] = [Math.min(...vals), Math.max(...vals)]; }
    return { mem, R, n: list.length };
  }

  G.FRAME = { analyse, envelope, secProps, concreteE, _test: { kLocal, feq, loadsUpTo, cholesky, cholSolve, jacobiEig } };
})(typeof window !== 'undefined' ? window : globalThis);
