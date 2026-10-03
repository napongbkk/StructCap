/* StructCap Analysis — 3D frame / truss finite-element engine (stiffness method, 6 DOF per node).
   Units: kN, m (sections in mm, E in MPa, unit weight in kN/m³). Global axes: X, Y horizontal, Z up (right-handed).
   Member local axes: x from node i to node j; y in the vertical plane through the member, pointing up
   (vertical members: y = +X); z = x × y; then rotated by beta (degrees) about x.
   Rectangle / I / tube sections: depth h (d, D) along local y, so Iz is the major axis.
   Analyses: linear static (load cases, superposed combinations), P-Delta (iterative geometric stiffness,
   members subdivided internally), modal (consistent mass, subspace iteration), elastic buckling (per combination).
   Sparse skyline Cholesky with reverse Cuthill–McKee node ordering.
   Member results at stations: N (tension +), Vy, Vz, T, My, Mz (Mz + = tension on the −y side, My + = tension on the −z side),
   global station displacements and local deflections relative to the chord. */
(function (G) {
  'use strict';
  const PI = Math.PI, gAcc = 9.81;

  // ------------------------------------------------------------------ sections
  function rectJ(b, h) { const a = Math.max(b, h), c = Math.min(b, h); return a * c * c * c * (1 / 3 - 0.21 * (c / a) * (1 - Math.pow(c / a, 4) / 12)); }
  function secProps(s) {
    const t = s.type;
    if (t === 'rect') { const b = +s.b, h = +s.h; return { A: b * h, Iz: b * h * h * h / 12, Iy: h * b * b * b / 12, J: rectJ(b, h), I: b * h * h * h / 12, d: h, w: b }; }
    if (t === 'circ') { const D = +s.D, I = PI * Math.pow(D, 4) / 64; return { A: PI * D * D / 4, Iz: I, Iy: I, J: 2 * I, I, d: D, w: D }; }
    if (t === 'I') {
      const d = +s.d, bf = +s.bf, tf = +s.tf, tw = +s.tw, hw = d - 2 * tf;
      const Iz = (bf * d * d * d - (bf - tw) * hw * hw * hw) / 12;
      return { A: 2 * bf * tf + hw * tw, Iz, Iy: (2 * tf * bf * bf * bf + hw * tw * tw * tw) / 12, J: (2 * bf * tf * tf * tf + (d - tf) * tw * tw * tw) / 3, I: Iz, d, w: bf };
    }
    if (t === 'std' && G.STEELLIB) { const p = G.STEELLIB.find(s.series, s.size); if (p) return { A: p.A, Iz: p.Iz, Iy: p.Iy, J: p.J, I: p.Iz, d: p.d, w: p.bf }; }
    if (t === 'tube' && G.GANTRY) { const p = G.GANTRY.section(s.shape, s.size, 'C350L0'); return { A: p.A, Iz: p.Ix, Iy: p.Iy, J: p.J, I: p.Ix, d: p.D, w: p.B }; }
    const Iz = +s.Iz || +s.I || 1, Iy = +s.Iy || Iz;
    return { A: +s.A || 1, Iz, Iy, J: +s.J || (Iz + Iy) / 50, I: Iz, d: +s.dd || 300, w: +s.ww || +s.dd || 300 };
  }
  // coefficient of thermal expansion (per °C): material value, else concrete 10e-6, steel 12e-6
  const alphaOf = t => { const a = +t.alpha; if (a > 0) return a > 0.01 ? a * 1e-6 : a; return t.kind === 'conc' || (+t.E || 0) < 100000 ? 10e-6 : 12e-6; };
  const concreteE = fc => { const t = [[20, 24000], [25, 26700], [32, 30100], [40, 32800], [50, 34800], [65, 37400], [80, 39600], [100, 42200]]; if (fc <= 20) return 24000; for (let i = 1; i < t.length; i++) if (fc <= t[i][0]) return t[i - 1][1] + (t[i][1] - t[i - 1][1]) * (fc - t[i - 1][0]) / (t[i][0] - t[i - 1][0]); return 42200; };

  // ------------------------------------------------------------------ vectors, local axes
  const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const unit3 = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  function axes(pi, pj, betaDeg) {
    const d = sub3(pj, pi), L = Math.hypot(d[0], d[1], d[2]), ex = [d[0] / L, d[1] / L, d[2] / L];
    let ey;
    if (Math.hypot(ex[0], ex[1]) < 1e-6) ey = [1, 0, 0];
    else ey = unit3([-ex[2] * ex[0], -ex[2] * ex[1], 1 - ex[2] * ex[2]]); // Z minus its component along x
    let ez = cross3(ex, ey);
    const b = (+betaDeg || 0) * PI / 180;
    if (b) { const c = Math.cos(b), s = Math.sin(b), y2 = [0, 1, 2].map(k => c * ey[k] + s * ez[k]), z2 = [0, 1, 2].map(k => -s * ey[k] + c * ez[k]); ey = y2; ez = z2; }
    return { L, ex, ey, ez, R: [ex, ey, ez] };
  }

  // ------------------------------------------------------------------ small dense helpers
  function jacobiEig(Ain, n) { // symmetric eigen: returns {val, vec (row-major, column i = eigenvector i)}
    const A = Float64Array.from(Ain), V = new Float64Array(n * n);
    for (let i = 0; i < n; i++) V[i * n + i] = 1;
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0, dia = 0; for (let i = 0; i < n; i++) { dia += A[i * n + i] * A[i * n + i]; for (let j = i + 1; j < n; j++) off += A[i * n + j] * A[i * n + j]; }
      if (off <= 1e-24 * (dia || 1)) break;
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
  function cholDense(A, n) { // in place lower; false if not positive definite
    for (let j = 0; j < n; j++) {
      let s = A[j * n + j]; for (let k = 0; k < j; k++) s -= A[j * n + k] * A[j * n + k];
      if (!(s > 1e-14 * Math.max(1e-300, Math.abs(A[j * n + j])))) return false;
      const d = Math.sqrt(s); A[j * n + j] = d;
      for (let i = j + 1; i < n; i++) { let t = A[i * n + j]; for (let k = 0; k < j; k++) t -= A[i * n + k] * A[j * n + k]; A[i * n + j] = t / d; }
    }
    return true;
  }
  function invSmall(M) { // Gauss–Jordan, M array of arrays
    const n = M.length, A = M.map((r, i) => r.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]];
      const d = A[c][c]; if (Math.abs(d) < 1e-300) return null;
      for (let k = 0; k < 2 * n; k++) A[c][k] /= d;
      for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c]; if (f) for (let k = 0; k < 2 * n; k++) A[r][k] -= f * A[c][k]; }
    }
    return A.map(r => r.slice(n));
  }
  const zeros12 = () => Array.from({ length: 12 }, () => new Array(12).fill(0));

  // ------------------------------------------------------------------ element matrices (local, 12×12)
  // dof order: u1 v1 w1 θx1 θy1 θz1 | u2 v2 w2 θx2 θy2 θz2 ; the x–z plane uses (w, −θy) so signs of θy terms flip
  const IXY = [1, 5, 7, 11], IXZ = [2, 4, 8, 10], SG = [1, -1, 1, -1];
  function put4(K, idx, M, s, flip) { for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) K[idx[a]][idx[b]] += s * M[a][b] * (flip ? SG[a] * SG[b] : 1); }
  const bend4 = L => [[12, 6 * L, -12, 6 * L], [6 * L, 4 * L * L, -6 * L, 2 * L * L], [-12, -6 * L, 12, -6 * L], [6 * L, 2 * L * L, -6 * L, 4 * L * L]];
  function kLocal(m, L) { // m: {E, Gm, A, Iy, Iz, J} in kN, m
    const K = zeros12(), a = m.E * m.A / L, t = m.Gm * m.J / L;
    K[0][0] = K[6][6] = a; K[0][6] = K[6][0] = -a;
    K[3][3] = K[9][9] = t; K[3][9] = K[9][3] = -t;
    const B = bend4(L), L3 = L * L * L;
    put4(K, IXY, B, m.E * m.Iz / L3, false);
    put4(K, IXZ, B, m.E * m.Iy / L3, true);
    return K;
  }
  function kgLocal(N, L, simple) {
    const K = zeros12(), s = N / L;
    if (simple) { [[1, 7], [2, 8]].forEach(([i, j]) => { K[i][i] += s; K[j][j] += s; K[i][j] -= s; K[j][i] -= s; }); return K; }
    const g = [[6 / 5, L / 10, -6 / 5, L / 10], [L / 10, 2 * L * L / 15, -L / 10, -L * L / 30], [-6 / 5, -L / 10, 6 / 5, -L / 10], [L / 10, -L * L / 30, -L / 10, 2 * L * L / 15]];
    put4(K, IXY, g, s, false); put4(K, IXZ, g, s, true);
    return K;
  }
  function mLocal(mpl, rr, L) { // consistent mass; mpl = mass per length (t/m), rr = polar radius² (m²)
    const M = zeros12(), a = mpl * L / 6;
    M[0][0] = M[6][6] = 2 * a; M[0][6] = M[6][0] = a;
    const tq = a * rr; M[3][3] = M[9][9] = 2 * tq; M[3][9] = M[9][3] = tq;
    const c = mpl * L / 420, B = [[156, 22 * L, 54, -13 * L], [22 * L, 4 * L * L, 13 * L, -3 * L * L], [54, 13 * L, 156, -22 * L], [-13 * L, -3 * L * L, -22 * L, 4 * L * L]];
    put4(M, IXY, B, c, false); put4(M, IXZ, B, c, true);
    return M;
  }
  // Hermite shape functions (ξ = x/L) and their x-derivatives
  const H = (xi, L) => [1 - 3 * xi * xi + 2 * xi * xi * xi, L * (xi - 2 * xi * xi + xi * xi * xi), 3 * xi * xi - 2 * xi * xi * xi, L * (-xi * xi + xi * xi * xi)];
  const dH = (xi, L) => [(-6 * xi + 6 * xi * xi) / L, 1 - 4 * xi + 3 * xi * xi, (6 * xi - 6 * xi * xi) / L, -2 * xi + 3 * xi * xi];
  const GP = [[-0.861136311594053, 0.347854845137454], [-0.339981043584856, 0.652145154862546], [0.339981043584856, 0.652145154862546], [0.861136311594053, 0.347854845137454]];

  // element loads (local): {k:'d', a, b, q1:[qx,qy,qz], q2:[...]} | {k:'p', a, P:[px,py,pz]} | {k:'m', a, M:[mx,my,mz]}
  function feq(loads, L) {
    const F = new Array(12).fill(0);
    const addPoint = (x, p) => {
      const xi = x / L, h = H(xi, L);
      F[0] += p[0] * (1 - xi); F[6] += p[0] * xi;
      F[1] += p[1] * h[0]; F[5] += p[1] * h[1]; F[7] += p[1] * h[2]; F[11] += p[1] * h[3];
      F[2] += p[2] * h[0]; F[4] -= p[2] * h[1]; F[8] += p[2] * h[2]; F[10] -= p[2] * h[3];
    };
    loads.forEach(ld => {
      if (ld.k === 't') { // temperature: equivalent nodal loads of the restrained thermal strain / curvatures
        F[0] -= ld.N0; F[6] += ld.N0;
        F[5] -= ld.Mz0; F[11] += ld.Mz0;
        F[4] += ld.My0; F[10] -= ld.My0;
      } else if (ld.k === 'p') addPoint(ld.a, ld.P);
      else if (ld.k === 'm') {
        const xi = ld.a / L, d = dH(xi, L), [mx, my, mz] = ld.M;
        F[3] += mx * (1 - xi); F[9] += mx * xi;
        F[1] += mz * d[0]; F[5] += mz * d[1]; F[7] += mz * d[2]; F[11] += mz * d[3];
        F[2] -= my * d[0]; F[4] += my * d[1]; F[8] -= my * d[2]; F[10] += my * d[3];
      } else {
        const a = ld.a, b = ld.b, half = (b - a) / 2, mid = (a + b) / 2;
        GP.forEach(([g, w]) => { const x = mid + half * g, t = (x - a) / ((b - a) || 1); addPoint(x, [0, 1, 2].map(k => (ld.q1[k] + (ld.q2[k] - ld.q1[k]) * t) * w * half)); });
      }
    });
    return F;
  }
  // resultants of the element loads on [0, x]: forces Q, analog moments about x (xy plane: Mz-type, xz plane: My-type), torque
  function loadsUpTo(loads, x) {
    const Q = [0, 0, 0]; let Mz = 0, My = 0, Tq = 0;
    loads.forEach(ld => {
      if (ld.k === 't') return;
      if (ld.k === 'p') { if (ld.a <= x + 1e-12) { for (let k = 0; k < 3; k++) Q[k] += ld.P[k]; Mz += ld.P[1] * (x - ld.a); My += ld.P[2] * (x - ld.a); } }
      else if (ld.k === 'm') { if (ld.a <= x + 1e-12) { Mz -= ld.M[2]; My += ld.M[1]; Tq += ld.M[0]; } }
      else {
        const a = ld.a, b = Math.min(ld.b, x); if (b <= a) return;
        const len = (ld.b - ld.a) || 1, l = b - a;
        for (let k = 0; k < 3; k++) {
          const qa = ld.q1[k], qb = ld.q1[k] + (ld.q2[k] - ld.q1[k]) * (b - a) / len;
          Q[k] += (qa + qb) / 2 * l;
          const mom = qa * l * (x - a - l / 2) + (qb - qa) * l / 2 * (x - a - 2 * l / 3); // ∫ q(s)(x−s) ds
          if (k === 1) Mz += mom; else if (k === 2) My += mom;
        }
      }
    });
    return { Q, Mz, My, Tq };
  }

  // ------------------------------------------------------------------ model → analysis mesh
  const SUPS = { fixed: [1, 1, 1, 1, 1, 1], pin: [1, 1, 1, 0, 0, 0], roller: [0, 0, 1, 0, 0, 0], rollerX: [0, 1, 1, 0, 0, 0], rollerY: [1, 0, 1, 0, 0, 0], free: [0, 0, 0, 0, 0, 0] };
  const fixOf = n => n.sup === 'custom' && Array.isArray(n.fix) ? n.fix.map(v => (v ? 1 : 0)) : (SUPS[n.sup || 'free'] || SUPS.free);
  const SPR = ['kx', 'ky', 'kz', 'krx', 'kry', 'krz'];
  function build(model, nseg) {
    const nodes = model.nodes, nid = {}; nodes.forEach((n, i) => { if (nid[n.id] !== undefined) throw new Error('duplicate node ' + n.id); nid[n.id] = i; });
    const sec = {}; model.sections.forEach(s => { sec[s.id] = Object.assign({}, s, secProps(s)); });
    const mat = {}; model.materials.forEach(m => { mat[m.id] = m; });
    const pts = nodes.map(n => ({ x: +n.x || 0, y: +n.y || 0, z: +n.z || 0, real: true })), els = [], mems = [];
    model.members.forEach((m, mi) => {
      const i = nid[m.i], j = nid[m.j];
      if (i === undefined || j === undefined || i === j) throw new Error('member ' + m.id + ': bad nodes');
      const s = sec[m.sec], t = mat[m.mat];
      if (!s || !t) throw new Error('member ' + m.id + ': section / material missing');
      const pi = [pts[i].x, pts[i].y, pts[i].z], pj = [pts[j].x, pts[j].y, pts[j].z], ax = axes(pi, pj, m.beta), L = ax.L;
      if (L < 1e-9) throw new Error('member ' + m.id + ': zero length');
      const truss = m.type === 'truss', ns = truss ? 1 : Math.max(1, nseg | 0);
      const idx = [i]; for (let k = 1; k < ns; k++) { idx.push(pts.length); pts.push({ x: pi[0] + (pj[0] - pi[0]) * k / ns, y: pi[1] + (pj[1] - pi[1]) * k / ns, z: pi[2] + (pj[2] - pi[2]) * k / ns, real: false, mem: mi }); } idx.push(j);
      const E = (+t.E) * 1e3, nu = t.nu === undefined || t.nu === '' ? 0.3 : +t.nu, A = s.A * 1e-6;
      const rec = { mi, id: m.id, L, ax, R: ax.R, E, Gm: E / (2 * (1 + nu)), A, Iy: s.Iy * 1e-12, Iz: s.Iz * 1e-12, J: truss ? 0 : s.J * 1e-12, w: (+t.rho || 0) * A, els: [], sec: s, mat: t, truss, i, j };
      for (let k = 0; k < ns; k++) els.push({ n1: idx[k], n2: idx[k + 1], x0: L * k / ns, l: L / ns, rel1: truss || (k === 0 && !!m.relI), rel2: truss || (k === ns - 1 && !!m.relJ), mem: rec });
      rec.els = els.slice(els.length - ns);
      mems.push(rec);
    });
    els.forEach((el, e) => { el.e = e; });
    return { pts, els, mems, nid };
  }

  // member loads of one load case in local coordinates, split per element
  function caseLoads(model, mesh, caseId, factor) {
    const nodal = new Map(), byEl = new Map(), imposed = new Map(), cs = model.cases.find(c => c.id === caseId) || {};
    const addN = (p, v) => { const o = nodal.get(p) || [0, 0, 0, 0, 0, 0]; for (let k = 0; k < 6; k++) o[k] += (v[k] || 0) * factor; nodal.set(p, o); };
    const memLoad = (rec, ld) => {
      rec.els.forEach(el => {
        const x0 = el.x0, x1 = el.x0 + el.l, list = byEl.get(el) || []; byEl.set(el, list);
        if (ld.k === 't') { list.push(ld); return; }
        if (ld.k === 'p' || ld.k === 'm') { if (ld.a >= x0 - 1e-9 && ld.a <= x1 + 1e-9 && !(Math.abs(ld.a - x0) < 1e-9 && x0 > 0)) list.push(Object.assign({}, ld, { a: Math.min(el.l, Math.max(0, ld.a - x0)) })); }
        else {
          const a = Math.max(ld.a, x0), b = Math.min(ld.b, x1); if (b - a < 1e-9) return;
          const at = x => [0, 1, 2].map(k => ld.q1[k] + (ld.q2[k] - ld.q1[k]) * (x - ld.a) / ((ld.b - ld.a) || 1));
          list.push({ k: 'd', a: a - x0, b: b - x0, q1: at(a), q2: at(b) });
        }
      });
    };
    const loc = (rec, g) => rec.R.map(e => dot3(e, g));
    if (cs.sw) mesh.mems.forEach(rec => { if (rec.w) { const q = loc(rec, [0, 0, -rec.w * factor]); memLoad(rec, { k: 'd', a: 0, b: rec.L, q1: q, q2: q.slice() }); } });
    const GV = { gx: [1, 0, 0], gy: [0, 1, 0], gz: [0, 0, 1], grav: [0, 0, -1], gravp: [0, 0, -1] }, LV = { lx: [1, 0, 0], ly: [0, 1, 0], lz: [0, 0, 1] };
    model.loads.filter(l => l.case === caseId).forEach(l => {
      if (l.kind === 'node') { const p = mesh.nid[l.node]; if (p !== undefined) addN(p, [+l.Fx || 0, +l.Fy || 0, +l.Fz || 0, +l.Mx || 0, +l.My || 0, +l.Mz || 0]); return; }
      if (l.kind === 'settle') { // imposed displacement of a support (m, rad), global axes
        const p = mesh.nid[l.node]; if (p === undefined) return;
        ['dx', 'dy', 'dz', 'rx', 'ry', 'rz'].forEach((q, d) => { const v = (+l[q] || 0) * factor; if (v) imposed.set(6 * p + d, (imposed.get(6 * p + d) || 0) + v); });
        return;
      }
      const rec = mesh.mems.find(r => r.id === l.member); if (!rec) return;
      if (l.kind === 'pres') { // prestressing tendon, parabolic in the local x–y plane; e (mm) positive towards −y (below the centroid)
        const L = rec.L, P = (+l.P || 0) * factor, e1 = (+l.e1 || 0) / 1000, e2 = (+l.e2 || 0) / 1000, em = l.em === '' || l.em == null ? (e1 + e2) / 2 : (+l.em || 0) / 1000;
        if (!P) return;
        const D = em - (e1 + e2) / 2, s0 = (e2 - e1) / L + 4 * D / L, sL = (e2 - e1) / L - 4 * D / L, q = 8 * P * D / (L * L);
        memLoad(rec, { k: 'p', a: 0, P: [P, -P * s0, 0] }); memLoad(rec, { k: 'p', a: L, P: [-P, P * sL, 0] });
        if (!rec.truss) { memLoad(rec, { k: 'm', a: 0, M: [0, 0, P * e1] }); memLoad(rec, { k: 'm', a: L, M: [0, 0, -P * e2] }); if (q) memLoad(rec, { k: 'd', a: 0, b: L, q1: [0, q, 0], q2: [0, q, 0] }); }
        return;
      }
      if (l.kind === 'temp') {
        // α ΔT: uniform → axial strain; ΔTy = T(+y face) − T(−y face) over the depth, ΔTz over the width → curvature κ = −α ΔT / h
        const al = alphaOf(rec.mat), h = Math.max(1e-6, (+rec.sec.d || 300) * 1e-3), b = Math.max(1e-6, (+rec.sec.w || +rec.sec.d || 300) * 1e-3);
        const e0 = al * (+l.dT || 0) * factor, ky = rec.truss ? 0 : -al * (+l.dTy || 0) / h * factor, kz = rec.truss ? 0 : -al * (+l.dTz || 0) / b * factor;
        if (e0 || ky || kz) memLoad(rec, { k: 't', N0: rec.E * rec.A * e0, Mz0: rec.E * rec.Iz * ky, My0: rec.E * rec.Iy * kz });
        return;
      }
      const L = rec.L, dir = l.dir || (l.kind === 'moment' ? 'lz' : 'grav');
      const vec = v => LV[dir] ? LV[dir].map(c => c * v) : loc(rec, (GV[dir] || GV.grav).map(c => c * v));
      const proj = dir === 'gravp' ? Math.hypot(rec.ax.ex[0], rec.ax.ex[1]) : 1;
      if (l.kind === 'udl') {
        const a = Math.max(0, Math.min(L, (+l.a || 0))), b = l.b === '' || l.b == null || +l.b <= 0 ? L : Math.max(a, Math.min(L, +l.b));
        const w1 = +l.w1 || 0, w2 = l.w2 === '' || l.w2 == null ? w1 : +l.w2;
        memLoad(rec, { k: 'd', a, b, q1: vec(w1 * proj * factor), q2: vec(w2 * proj * factor) });
      } else if (l.kind === 'point') memLoad(rec, { k: 'p', a: Math.max(0, Math.min(L, +l.a || 0)), P: vec((+l.P || 0) * factor) });
      else if (l.kind === 'moment') memLoad(rec, { k: 'm', a: Math.max(0, Math.min(L, +l.a || 0)), M: vec((+l.M || 0) * factor) });
    });
    return { nodal, byEl, imposed };
  }

  // ------------------------------------------------------------------ element processing
  function toGlobalK(kl, R) { // Tᵀ k T with T = diag(R, R, R, R)
    const out = zeros12();
    for (let I = 0; I < 4; I++) for (let J = 0; J < 4; J++) {
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
        let s = 0;
        for (let p = 0; p < 3; p++) { const rp = R[p][a]; if (!rp) continue; for (let q = 0; q < 3; q++) s += rp * kl[3 * I + p][3 * J + q] * R[q][b]; }
        out[3 * I + a][3 * J + b] = s;
      }
    }
    return out;
  }
  const toGlobalV = (v, R) => { const o = new Array(12).fill(0); for (let I = 0; I < 4; I++) for (let a = 0; a < 3; a++) o[3 * I + a] = R[0][a] * v[3 * I] + R[1][a] * v[3 * I + 1] + R[2][a] * v[3 * I + 2]; return o; };
  const toLocalV = (v, R) => { const o = new Array(12).fill(0); for (let I = 0; I < 4; I++) for (let p = 0; p < 3; p++) o[3 * I + p] = R[p][0] * v[3 * I] + R[p][1] * v[3 * I + 1] + R[p][2] * v[3 * I + 2]; return o; };
  const relOf = el => el.mem.truss ? [4, 5, 10, 11] : (el.rel1 ? [4, 5] : []).concat(el.rel2 ? [10, 11] : []);
  function condense(K, F, rel) {
    if (!rel.length) return { K, F, inv: null };
    const o = []; for (let i = 0; i < 12; i++) if (!rel.includes(i)) o.push(i);
    const inv = invSmall(rel.map(i => rel.map(j => K[i][j]))); if (!inv) return { K, F, inv: null };
    const Kc = zeros12(), Fc = new Array(12).fill(0);
    o.forEach(i => {
      const t = inv.map(row => row.reduce((s, v, k) => s + v * K[rel[k]][i], 0)); // Krr⁻¹ K_ri
      o.forEach(j => { Kc[i][j] = K[i][j] - rel.reduce((s, r, a) => s + K[j][r] * t[a], 0); });
      Fc[i] = F[i] - rel.reduce((s, r, a) => s + F[r] * t[a], 0);
    });
    return { K: Kc, F: Fc, inv };
  }
  function recoverRel(kl, fl, rel, inv, ul) {
    const u = ul.slice(); if (!rel.length || !inv) return u;
    const rhs = rel.map(r => { let s = fl[r]; for (let j = 0; j < 12; j++) if (!rel.includes(j)) s -= kl[r][j] * ul[j]; return s; });
    rel.forEach((r, a) => { u[r] = inv[a].reduce((s, v, k) => s + v * rhs[k], 0); });
    return u;
  }
  const dofsOf = el => { const a = 6 * el.n1, b = 6 * el.n2; return [a, a + 1, a + 2, a + 3, a + 4, a + 5, b, b + 1, b + 2, b + 3, b + 4, b + 5]; };

  // ------------------------------------------------------------------ equation numbering (RCM) and skyline storage
  function numbering(model, mesh) {
    const np = mesh.pts.length, nd = np * 6, fixed = new Uint8Array(nd), springs = new Map();
    model.nodes.forEach((n, i) => {
      const f = fixOf(n); f.forEach((v, d) => { if (v) fixed[6 * i + d] = 1; });
      SPR.forEach((k, d) => { if (+n[k] > 0 && !fixed[6 * i + d]) springs.set(6 * i + d, +n[k]); });
    });
    if (model.plane === 'XZ') for (let p = 0; p < np; p++) { fixed[6 * p + 1] = 1; fixed[6 * p + 3] = 1; fixed[6 * p + 5] = 1; }
    // reverse Cuthill–McKee over the points
    const adj = Array.from({ length: np }, () => []);
    mesh.els.forEach(el => { adj[el.n1].push(el.n2); adj[el.n2].push(el.n1); });
    const deg = adj.map(a => a.length), seen = new Uint8Array(np), order = [];
    const starts = Array.from({ length: np }, (_, i) => i).sort((a, b) => deg[a] - deg[b]);
    starts.forEach(s0 => {
      if (seen[s0]) return; seen[s0] = 1; const q = [s0];
      for (let h = 0; h < q.length; h++) { const p = q[h]; order.push(p); adj[p].filter(x => !seen[x]).sort((a, b) => deg[a] - deg[b]).forEach(x => { seen[x] = 1; q.push(x); }); }
    });
    order.reverse();
    const map = new Int32Array(nd).fill(-1), free = [], nodeFirst = new Int32Array(np).fill(-1);
    order.forEach(p => { for (let d = 0; d < 6; d++) { const g = 6 * p + d; if (!fixed[g]) { if (nodeFirst[p] < 0) nodeFirst[p] = free.length; map[g] = free.length; free.push(g); } } });
    const n = free.length, fr = new Int32Array(n);
    for (let e = 0; e < n; e++) fr[e] = nodeFirst[Math.floor(free[e] / 6)];
    mesh.els.forEach(el => {
      const eq = dofsOf(el).map(d => map[d]).filter(e => e >= 0); if (!eq.length) return;
      const mn = Math.min(...eq); eq.forEach(e => { if (mn < fr[e]) fr[e] = mn; });
    });
    const ptr = new Int32Array(n + 1); for (let j = 0; j < n; j++) ptr[j + 1] = ptr[j] + (j - fr[j] + 1);
    return { nd, n, fixed, springs, map, free, fr, ptr, np };
  }
  class Sky {
    constructor(num) { this.num = num; this.v = new Float64Array(num.ptr[num.n]); }
    add(i, j, val) { if (i > j) { const t = i; i = j; j = t; } const fr = this.num.fr[j]; if (i < fr) return; this.v[this.num.ptr[j] + i - fr] += val; }
    get(i, j) { if (i > j) { const t = i; i = j; j = t; } const fr = this.num.fr[j]; return i < fr ? 0 : this.v[this.num.ptr[j] + i - fr]; }
    diag(j) { return this.v[this.num.ptr[j] + j - this.num.fr[j]]; }
    clone() { const s = new Sky(this.num); s.v.set(this.v); return s; }
    // in-place UᵀU factorisation; returns -1 on success or the failing equation.
    // reg(j) → spring stiffness: a zero pivot on a rotation (e.g. a member free to spin about its own axis between
    // pinned ends) is replaced by that tiny spring and listed in this.reg; translations are never regularised.
    factor(reg) {
      const { n, fr, ptr } = this.num, v = this.v; this.reg = [];
      for (let j = 0; j < n; j++) {
        const fj = fr[j], pj = ptr[j], d0 = v[pj + j - fj];
        for (let i = fj; i <= j; i++) {
          const fi = fr[i], pi = ptr[i], k0 = Math.max(fi, fj);
          let s = v[pj + i - fj];
          for (let k = k0; k < i; k++) s -= v[pi + k - fi] * v[pj + k - fj];
          if (i < j) v[pj + i - fj] = s / v[pi + i - fi];
          else {
            if (!(s > 1e-11 * Math.max(Math.abs(d0), 1e-300))) { const k = reg ? reg(j) : 0; if (!k) return j; this.reg.push([j, k - s]); s = k; }
            v[pj + j - fj] = Math.sqrt(s);
          }
        }
      }
      return -1;
    }
    solve(b) {
      const { n, fr, ptr } = this.num, v = this.v, y = Float64Array.from(b);
      for (let j = 0; j < n; j++) { const fj = fr[j], pj = ptr[j]; let s = y[j]; for (let k = fj; k < j; k++) s -= v[pj + k - fj] * y[k]; y[j] = s / v[pj + j - fj]; }
      for (let j = n - 1; j >= 0; j--) { const fj = fr[j], pj = ptr[j]; y[j] /= v[pj + j - fj]; const xj = y[j]; for (let k = fj; k < j; k++) y[k] -= v[pj + k - fj] * xj; }
      return y;
    }
    mul(x) {
      const { n, fr, ptr } = this.num, v = this.v, o = new Float64Array(n);
      for (let j = 0; j < n; j++) { const fj = fr[j], pj = ptr[j]; for (let i = fj; i < j; i++) { const a = v[pj + i - fj]; o[i] += a * x[j]; o[j] += a * x[i]; } o[j] += v[pj + j - fj] * x[j]; }
      return o;
    }
  }
  // sparse symmetric matrix (diagonal + upper triplets) for mass and geometric stiffness: only add, diag, mul
  class Sparse {
    constructor(n) { this.n = n; this.d = new Float64Array(n); this.map = new Map(); this.csr = null; }
    add(i, j, v) { if (i === j) { this.d[i] += v; return; } if (i > j) { const t = i; i = j; j = t; } const k = i * this.n + j; this.map.set(k, (this.map.get(k) || 0) + v); this.csr = null; }
    diag(i) { return this.d[i]; }
    scale(s) { for (let i = 0; i < this.n; i++) this.d[i] *= s; this.map.forEach((v, k) => this.map.set(k, v * s)); this.csr = null; }
    mul(x) {
      if (!this.csr) { const n = this.n, m = this.map.size, I = new Int32Array(m), J = new Int32Array(m), V = new Float64Array(m); let c = 0; this.map.forEach((v, k) => { I[c] = Math.floor(k / n); J[c] = k % n; V[c] = v; c++; }); this.csr = { I, J, V }; }
      const { I, J, V } = this.csr, o = new Float64Array(this.n);
      for (let i = 0; i < this.n; i++) o[i] = this.d[i] * x[i];
      for (let c = 0; c < V.length; c++) { const i = I[c], j = J[c], v = V[c]; o[i] += v * x[j]; o[j] += v * x[i]; }
      return o;
    }
  }
  function scatter(S, num, dofs, kg) {
    for (let a = 0; a < 12; a++) { const ia = num.map[dofs[a]]; if (ia < 0) continue; for (let b = a; b < 12; b++) { const ib = num.map[dofs[b]]; if (ib >= 0 && kg[a][b]) S.add(ia, ib, kg[a][b] * (ia === ib && a !== b ? 2 : 1)); } }
  }
  // joints whose rotations have no stiffness (all members pinned, trusses) get a tiny spring so K stays positive definite
  function stabilise(S, num, mesh) {
    let mx = 0; for (let j = 0; j < num.n; j++) mx = Math.max(mx, Math.abs(S.diag(j)));
    const eps = 1e-9 * (mx || 1);
    for (let p = 0; p < num.np; p++) {
      const eq = [3, 4, 5].map(d => num.map[6 * p + d]).filter(e => e >= 0); if (!eq.length) continue;
      const k = eq.length, A = new Float64Array(k * k);
      for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) A[a * k + b] = S.get(eq[a], eq[b]);
      const eg = jacobiEig(A, k);
      for (let i = 0; i < k; i++) if (eg.val[i] < eps * 10) for (let a = 0; a < k; a++) for (let b = a; b < k; b++) S.add(eq[a], eq[b], eps * eg.vec[a * k + i] * eg.vec[b * k + i]);
    }
    return eps;
  }

  const rotReg = (num, eps) => j => (num.free[j] % 6 >= 3 ? eps : 0);
  // linear (or with element axial forces Nel for geometric stiffness) static solve of one load set
  // assemble and factorise K (plus geometric stiffness from element axial forces Nel); reusable for many load sets
  function prepare(model, mesh, num, Nel) {
    const S = new Sky(num), els = [];
    mesh.els.forEach((el, e) => {
      const m = el.mem, kl = kLocal(m, el.l);
      if (Nel && Nel[e]) { const kg = kgLocal(Nel[e], el.l, el.rel1 || el.rel2 || m.truss); for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) kl[i][j] += kg[i][j]; }
      const rel = relOf(el), cd = condense(kl, new Array(12).fill(0), rel), dofs = dofsOf(el);
      scatter(S, num, dofs, toGlobalK(cd.K, m.R));
      els.push({ kl, rel, inv: cd.inv, dofs, R: m.R });
    });
    num.springs.forEach((k, d) => { const i = num.map[d]; if (i >= 0) S.add(i, i, k); });
    const eps = stabilise(S, num, mesh);
    if (num.n) { const bad = S.factor(rotReg(num, eps)); if (bad >= 0) { const g = num.free[bad]; return { ok: false, at: Math.floor(g / 6), dof: g % 6 }; } }
    return { ok: true, S, els, eps, num };
  }
  function solveWith(prep, mesh, loadset) {
    const num = prep.num, F = new Float64Array(num.n), elData = [];
    mesh.els.forEach((el, e) => {
      const pe = prep.els[e], loads = loadset.byEl.get(el), fl = loads && loads.length ? feq(loads, el.l) : new Array(12).fill(0);
      let fc = fl;
      if (pe.rel.length && pe.inv && loads && loads.length) {
        const t = pe.inv.map(row => row.reduce((s, v, k) => s + v * fl[pe.rel[k]], 0));
        fc = fl.map((f, i) => (pe.rel.includes(i) ? 0 : f - pe.rel.reduce((s, r, a) => s + pe.kl[i][r] * t[a], 0)));
      }
      if (loads && loads.length) { const fg = toGlobalV(fc, pe.R); for (let a = 0; a < 12; a++) { const ia = num.map[pe.dofs[a]]; if (ia >= 0) F[ia] += fg[a]; } }
      elData.push({ kl: pe.kl, fl, rel: pe.rel, inv: pe.inv, dofs: pe.dofs });
    });
    loadset.nodal.forEach((v, p) => { for (let d = 0; d < 6; d++) { const i = num.map[6 * p + d]; if (i >= 0) F[i] += v[d]; } });
    // imposed displacements of restrained DOFs (support settlement): F_free −= K_free,fixed · d
    const imp = loadset.imposed && loadset.imposed.size ? new Map([...loadset.imposed].filter(([d]) => num.map[d] < 0)) : null;
    if (imp && imp.size) mesh.els.forEach((el, e) => {
      const pe = prep.els[e]; if (!pe.dofs.some(d => imp.has(d))) return;
      const Kg = toGlobalK(condense(pe.kl, new Array(12).fill(0), pe.rel).K, pe.R);
      for (let a = 0; a < 12; a++) { const ia = num.map[pe.dofs[a]]; if (ia < 0) continue; let s = 0; for (let b = 0; b < 12; b++) { const v = imp.get(pe.dofs[b]); if (v) s += Kg[a][b] * v; } F[ia] -= s; }
    });
    const u = new Float64Array(num.nd);
    if (num.n) {
      const uf = prep.S.solve(F);
      // a regularised rotation must not carry load: otherwise it is a real mechanism
      if (prep.S.reg.length) {
        let fmax = 0; for (let i = 0; i < num.n; i++) fmax = Math.max(fmax, Math.abs(F[i]));
        for (const [j] of prep.S.reg) if (prep.eps * Math.abs(uf[j]) > 1e-6 * (fmax || 1)) { const g = num.free[j]; return { ok: false, at: Math.floor(g / 6), dof: g % 6 }; }
      }
      num.free.forEach((d, i) => { u[d] = uf[i]; });
    }
    if (imp) imp.forEach((v, d) => { u[d] = v; });
    const R = new Float64Array(num.nd);
    elData.forEach((ed, e) => {
      const Rm = prep.els[e].R, ul = toLocalV(ed.dofs.map(d => u[d]), Rm);
      const full = recoverRel(ed.kl, ed.fl, ed.rel, ed.inv, ul);
      const fe = new Array(12); for (let i = 0; i < 12; i++) { let s = -ed.fl[i]; for (let j = 0; j < 12; j++) s += ed.kl[i][j] * full[j]; fe[i] = s; }
      ed.ul = full; ed.fe = fe;
      const fg = toGlobalV(fe, Rm); ed.dofs.forEach((d, k) => { R[d] += fg[k]; });
    });
    loadset.nodal.forEach((v, p) => { for (let d = 0; d < 6; d++) R[6 * p + d] -= v[d]; });
    num.springs.forEach((k, d) => { R[d] = -k * u[d]; });
    for (let d = 0; d < num.nd; d++) if (!num.fixed[d] && !num.springs.has(d)) R[d] = 0;
    return { ok: true, u, R, elData };
  }
  function solveStatic(model, mesh, num, loadset, Nel) {
    const prep = prepare(model, mesh, num, Nel);
    return prep.ok ? solveWith(prep, mesh, loadset) : prep;
  }

  // ------------------------------------------------------------------ member results
  function memberResults(mesh, st, loadset, nps) {
    return mesh.mems.map(rec => {
      const out = { id: rec.id, L: rec.L, x: [], N: [], Vy: [], Vz: [], T: [], My: [], Mz: [], dx: [], dy: [], dz: [], dv: [], dw: [] };
      const { ex, ey, ez } = rec.ax;
      rec.els.forEach((el, k) => {
        const ed = st.elData[el.e], f = ed.fe, loads = loadset.byEl.get(el) || [], l = el.l, ul = ed.ul;
        const fl = feq(loads.filter(q => q.k !== 't'), l), np = Math.max(nps, 2), xs = Array.from({ length: np + 1 }, (_, i) => l * i / np);
        // particular (fixed-fixed) deflections from the element loads: v'' = Mz/EIz, w'' = My/EIy (analog moments)
        const part = (Mf, EI) => {
          const th = [0], vp = [0];
          for (let i = 1; i <= np; i++) { const h = xs[i] - xs[i - 1]; th.push(th[i - 1] + (Mf[i] + Mf[i - 1]) / 2 / EI * h); vp.push(vp[i - 1] + (th[i] + th[i - 1]) / 2 * h); }
          const c = vp[np] / l; return vp.map((v, i) => v - c * xs[i]);
        };
        const qs = xs.map(x => loadsUpTo(loads, x));
        // truss members: no local sag (their transverse loads only go to the joints)
        const vpart = rec.truss ? xs.map(() => 0) : part(xs.map((x, i) => fl[5] - x * fl[1] + qs[i].Mz), rec.E * rec.Iz);
        const wpart = rec.truss ? xs.map(() => 0) : part(xs.map((x, i) => -fl[4] - x * fl[2] + qs[i].My), rec.E * rec.Iy);
        xs.forEach((x, i) => {
          if (k > 0 && i === 0) return;
          const q = qs[i], xi = x / l, h = H(xi, l);
          out.x.push(el.x0 + x);
          out.N.push(-f[0] - q.Q[0]); out.Vy.push(f[1] + q.Q[1]); out.Vz.push(f[2] + q.Q[2]); out.T.push(-f[3] - q.Tq);
          out.Mz.push(-f[5] + x * f[1] + q.Mz); out.My.push(f[4] + x * f[2] + q.My);
          const u = ul[0] * (1 - xi) + ul[6] * xi;
          const v = rec.truss ? ul[1] * (1 - xi) + ul[7] * xi : ul[1] * h[0] + ul[5] * h[1] + ul[7] * h[2] + ul[11] * h[3] + vpart[i];
          const w = rec.truss ? ul[2] * (1 - xi) + ul[8] * xi : ul[2] * h[0] - ul[4] * h[1] + ul[8] * h[2] - ul[10] * h[3] + wpart[i];
          out.dx.push(u * ex[0] + v * ey[0] + w * ez[0]); out.dy.push(u * ex[1] + v * ey[1] + w * ez[1]); out.dz.push(u * ex[2] + v * ey[2] + w * ez[2]);
          out.dv.push(v); out.dw.push(w);
        });
      });
      const n = out.x.length, rel = (arr) => { const a0 = arr[0], a1 = arr[n - 1]; return arr.map((v, i) => v - (a0 + (a1 - a0) * out.x[i] / rec.L)); };
      out.drel = rel(out.dv); out.drelz = rel(out.dw);
      out.V = out.Vy; out.M = out.Mz; // 2D-style aliases
      return out;
    });
  }

  // ------------------------------------------------------------------ public: analyse
  function analyse(model, opt) {
    opt = Object.assign({ pdelta: false, nseg: 4, modes: 0, buckling: false, nps: 10 }, opt || {});
    const t0 = Date.now(), warn = [];
    const meshL = build(model, 1), numL = numbering(model, meshL);
    const adv = opt.pdelta || opt.modes || opt.buckling;
    const meshS = adv ? build(model, opt.nseg) : null, numS = adv ? numbering(model, meshS) : null;
    const res = { cases: {}, combos: {}, warn, meshL, meshS, model };
    const lost = model.loads.filter(l => l.kind === 'node' || l.kind === 'settle' ? meshL.nid[l.node] === undefined : !model.members.some(q => q.id === l.member)).length;
    if (lost) warn.push(lost + ' load(s) refer to a node or member that no longer exists and were ignored.');
    const noCase = model.loads.filter(l => !model.cases.some(c => c.id === l.case)).length;
    if (noCase) warn.push(noCase + ' load(s) belong to a load case that no longer exists.');
    const pack = (mesh, st, ls) => ({ u: st.u, R: st.R, mem: memberResults(mesh, st, ls, mesh === meshL ? 20 : Math.max(4, Math.round(20 / opt.nseg))), mesh });
    const unstable = st => { const n = model.nodes[st.at]; const D = ['X', 'Y', 'Z', 'rotation X', 'rotation Y', 'rotation Z'][st.dof]; return Object.assign(new Error('The structure is unstable (mechanism)' + (n ? ' at node ' + n.id + ', ' + D : (st.at !== undefined ? ' inside a member' : '')) + ' — check supports, releases and connections.'), { code: 'unstable', node: n ? n.id : null }); };
    const prepL = prepare(model, meshL, numL);
    if (!prepL.ok) throw unstable(prepL);
    model.cases.forEach(c => {
      const ls = caseLoads(model, meshL, c.id, 1), st = solveWith(prepL, meshL, ls);
      if (!st.ok) throw unstable(st);
      res.cases[c.id] = Object.assign(pack(meshL, st, ls), { name: c.name });
    });
    const comboLoads = (mesh, cb) => {
      const out = { nodal: new Map(), byEl: new Map(), imposed: new Map() };
      Object.entries(cb.f || {}).forEach(([cid, fct]) => {
        if (!+fct || !model.cases.some(c => c.id === cid)) return; const l = caseLoads(model, mesh, cid, +fct);
        l.nodal.forEach((v, p) => { const o = out.nodal.get(p) || [0, 0, 0, 0, 0, 0]; out.nodal.set(p, o.map((x, k) => x + v[k])); });
        l.byEl.forEach((arr, el) => { out.byEl.set(el, (out.byEl.get(el) || []).concat(arr)); });
        l.imposed.forEach((v, d) => { out.imposed.set(d, (out.imposed.get(d) || 0) + v); });
      });
      return out;
    };
    let prepS0 = null;
    model.combos.forEach(cb => {
      if (!opt.pdelta) {
        const ls = comboLoads(meshL, cb), st = solveWith(prepL, meshL, ls);
        if (!st.ok) throw unstable(st);
        res.combos[cb.id] = Object.assign(pack(meshL, st, ls), { name: cb.name, type: cb.type });
        return;
      }
      const ls = comboLoads(meshS, cb);
      if (!prepS0) prepS0 = prepare(model, meshS, numS);
      let st = prepS0.ok ? solveWith(prepS0, meshS, ls) : prepS0, it = 0, conv = false, lastU = st.u;
      while (it < 25 && st.ok) {
        const Nel = st.elData.map(ed => ed.fe[6]);
        const s2 = solveStatic(model, meshS, numS, ls, Nel);
        it++;
        if (!s2.ok) { st = s2; break; }
        let d = 0, mx = 1e-12; for (let i = 0; i < s2.u.length; i++) { d = Math.max(d, Math.abs(s2.u[i] - lastU[i])); mx = Math.max(mx, Math.abs(s2.u[i])); }
        lastU = s2.u; st = s2;
        if (d / mx < 1e-5) { conv = true; break; }
      }
      if (!st.ok) { res.combos[cb.id] = { name: cb.name, type: cb.type, failed: true }; warn.push(cb.name + ': P-Delta analysis did not converge — the load exceeds the elastic critical load.'); return; }
      if (!conv) warn.push(cb.name + ': P-Delta iterations did not fully converge.');
      res.combos[cb.id] = Object.assign(pack(meshS, st, ls), { name: cb.name, type: cb.type, iters: it });
    });
    const prepS = () => { if (!prepS0) prepS0 = prepare(model, meshS, numS); if (!prepS0.ok) throw unstable(prepS0); return prepS0; };
    if (opt.modes > 0) { try { res.modal = modal(model, meshS, numS, prepS().S, opt.modes, opt.massSrc || {}); } catch (e) { warn.push('Modal analysis: ' + e.message); } }
    if (opt.buckling) {
      res.buckling = {};
      model.combos.filter(c => c.type !== 'SLS').forEach(cb => {
        try { res.buckling[cb.id] = buckle(model, meshS, numS, comboLoads(meshS, cb), prepS()); } catch (e) { res.buckling[cb.id] = { error: e.message }; }
      });
    }
    res.ms = Date.now() - t0;
    return res;
  }

  // ------------------------------------------------------------------ eigen problems (subspace iteration on skyline K)
  function assembleKg(mesh, num, Nel) {
    const S = new Sparse(num.n);
    mesh.els.forEach((el, e) => { const m = el.mem; if (Nel[e]) scatter(S, num, dofsOf(el), toGlobalK(kgLocal(Nel[e], el.l, el.rel1 || el.rel2 || m.truss), m.R)); });
    return S;
  }
  function subspace(L, B, n, p, iters, pc) { // L = factorised K; K x = λ B x, lowest λ; returns {mu (=1/λ, descending), X}
    const q = Math.min(n, Math.max(p * 2, p + 8));
    const Bd = new Float64Array(n); for (let i = 0; i < n; i++) Bd[i] = Math.abs(B.diag(i));
    let X = [];
    for (let j = 0; j < q; j++) { const v = new Float64Array(n); for (let i = 0; i < n; i++) v[i] = (j === 0 ? Bd[i] : Bd[i] * Math.sin((i + 1) * (j + 1) * 1.37)) + Math.cos((i + 3) * (j + 2) * 0.7) * 1e-3 * (Bd[i] + 1e-30); X.push(v); }
    let lamOld = null, out = null;
    for (let it = 0; it < (iters || 40); it++) {
      const BX = X.map(x => B.mul(x)), Y = BX.map(b => L.solve(b)), BY = Y.map(y => B.mul(y));
      const Kr = new Float64Array(q * q), Br = new Float64Array(q * q);
      for (let a = 0; a < q; a++) for (let b = a; b < q; b++) { let s1 = 0, s2 = 0; const ya = Y[a], xb = BX[b], yb = BY[b]; for (let i = 0; i < n; i++) { s1 += ya[i] * xb[i]; s2 += ya[i] * yb[i]; } Kr[a * q + b] = Kr[b * q + a] = s1; Br[a * q + b] = Br[b * q + a] = s2; }
      const Lr = Kr.slice(); if (!cholDense(Lr, q)) break;
      const inv = new Float64Array(q * q);
      for (let j = 0; j < q; j++) { for (let i = 0; i < q; i++) { let s = i === j ? 1 : 0; for (let k = 0; k < i; k++) s -= Lr[i * q + k] * inv[k * q + j]; inv[i * q + j] = s / Lr[i * q + i]; } }
      const C = new Float64Array(q * q), T1 = new Float64Array(q * q);
      for (let i = 0; i < q; i++) for (let b = 0; b < q; b++) { let s = 0; for (let a = 0; a < q; a++) s += inv[i * q + a] * Br[a * q + b]; T1[i * q + b] = s; }
      for (let i = 0; i < q; i++) for (let j = 0; j < q; j++) { let s = 0; for (let b = 0; b < q; b++) s += T1[i * q + b] * inv[j * q + b]; C[i * q + j] = s; }
      const eg = jacobiEig(C, q), ord = eg.val.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]);
      const Z = ord.map(([, i]) => { const w = new Float64Array(q); for (let a = 0; a < q; a++) { let s = 0; for (let b = 0; b < q; b++) s += inv[b * q + a] * eg.vec[b * q + i]; w[a] = s; } return w; });
      X = Z.map(z => { const v = new Float64Array(n); for (let a = 0; a < q; a++) { const za = z[a], ya = Y[a]; if (za) for (let i = 0; i < n; i++) v[i] += za * ya[i]; } return v; });
      const mu = ord.map(o => o[0]);
      out = { mu, X };
      if (lamOld && mu.slice(0, pc || p).every((m, i) => Math.abs(m - lamOld[i]) <= 1e-6 * Math.abs(m) + 1e-14)) { if (G.FRAME_DEBUG) console.log("subspace iters", it + 1, "q", q); break; }
      lamOld = mu;
    }
    if (!out) throw new Error('eigen solution failed');
    return out;
  }
  function modal(model, mesh, num, L, nm, src) {
    const n = num.n; if (!n) throw new Error('no free degrees of freedom');
    const M = new Sparse(n);
    mesh.els.forEach(el => {
      const m = el.mem, mpl = m.w / gAcc; if (!mpl) return;
      const rr = m.A > 0 ? (m.Iy + m.Iz) / m.A : 0;
      scatter(M, num, dofsOf(el), toGlobalK(mLocal(mpl, rr, el.l), m.R));
    });
    // added mass from the mass source: downward (−Z) loads of the chosen cases (× factor) / g, lumped in X, Y and Z
    Object.entries(src).forEach(([cid, fct]) => {
      if (!+fct) return; const ls = caseLoads(model, mesh, cid, +fct);
      const lump = (p, fz) => { const mass = Math.max(0, -fz) / gAcc; [0, 1, 2].forEach(d => { const i = num.map[6 * p + d]; if (i >= 0) M.add(i, i, mass); }); };
      ls.nodal.forEach((v, p) => lump(p, v[2]));
      ls.byEl.forEach((arr, el) => { const fg = toGlobalV(feq(arr, el.l), el.mem.R); lump(el.n1, fg[2]); lump(el.n2, fg[8]); });
    });
    let tot = 0; for (let i = 0; i < n; i++) tot += Math.max(0, M.diag(i));
    if (!(tot > 0)) throw new Error('no mass — give the members a unit weight or choose a mass source');
    for (let i = 0; i < n; i++) if (M.diag(i) <= 1e-12 * tot) M.add(i, i, 1e-10 * tot);
    const p = Math.min(nm, n), sol = subspace(L, M, n, p, 60);
    const r = [0, 1, 2].map(dir => { const v = new Float64Array(n); num.free.forEach((g, i) => { if (g % 6 === dir) v[i] = 1; }); return v; });
    const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
    const Mr = r.map(v => M.mul(v)), Mt = r.map((v, k) => dot(v, Mr[k]));
    const modes = [];
    for (let k = 0; k < p; k++) {
      const mu = sol.mu[k]; if (!(mu > 0)) continue;
      const w = Math.sqrt(1 / mu), phi = sol.X[k], mgen = dot(phi, M.mul(phi));
      const part = Mr.map((mr, d) => { const Ld = dot(phi, mr); return Mt[d] ? Ld * Ld / mgen / Mt[d] : 0; });
      const u = new Float64Array(num.nd); let mx = 0, mr = 0;
      num.free.forEach((g, i) => { u[g] = phi[i]; if (g % 6 < 3) mx = Math.max(mx, Math.abs(phi[i])); else mr = Math.max(mr, Math.abs(phi[i])); });
      if (mx < 1e-7 * mr) continue; // spinning of a member about its own axis (regularised), not a structural mode
      for (let i = 0; i < u.length; i++) u[i] /= mx || 1;
      modes.push({ w, f: w / 2 / PI, T: 2 * PI / w, mx: part[0], my: part[1], mz: part[2], u });
    }
    let cx = 0, cy = 0, cz = 0; modes.forEach(m => { cx += m.mx; cy += m.my; cz += m.mz; m.cmx = cx; m.cmy = cy; m.cmz = cz; });
    return { modes, mesh, massX: Mt[0], massY: Mt[1], massZ: Mt[2] };
  }
  function buckle(model, mesh, num, ls, prep) {
    const st = solveWith(prep, mesh, ls);
    if (!st.ok) throw new Error('unstable');
    const Nel = st.elData.map(ed => ed.fe[6]);
    if (!Nel.some(N => N < -1e-6)) return { none: true };
    const Kg = assembleKg(mesh, num, Nel); Kg.scale(-1);
    const sol = subspace(prep.S, Kg, num.n, 3, 80, 1);
    const out = [];
    for (let k = 0; k < sol.mu.length && out.length < 3; k++) {
      const mu = sol.mu[k]; if (!(mu > 1e-9)) continue;
      const phi = sol.X[k], u = new Float64Array(num.nd); let mx = 0, mr = 0;
      num.free.forEach((g, i) => { u[g] = phi[i]; if (g % 6 < 3) mx = Math.max(mx, Math.abs(phi[i])); else mr = Math.max(mr, Math.abs(phi[i])); });
      if (mx < 1e-7 * mr) continue;
      for (let i = 0; i < u.length; i++) u[i] /= mx || 1;
      out.push({ lam: 1 / mu, u });
    }
    return { modes: out, mesh };
  }

  // ------------------------------------------------------------------ envelopes
  const COMP = ['N', 'Vy', 'Vz', 'T', 'My', 'Mz'];
  function envelope(res, ids) {
    const list = ids.map(id => res.combos[id]).filter(r => r && !r.failed);
    if (!list.length) return null;
    const mem = list[0].mem.map((m0, k) => {
      const e = { id: m0.id, L: m0.L, x: m0.x };
      COMP.forEach(q => { e[q + 'max'] = []; e[q + 'min'] = []; });
      m0.x.forEach((_, i) => { COMP.forEach(q => { let a = -Infinity, b = Infinity; list.forEach(r => { const v = r.mem[k][q][i]; if (v > a) a = v; if (v < b) b = v; }); e[q + 'max'].push(a); e[q + 'min'].push(b); }); });
      e.Vmax = e.Vymax; e.Vmin = e.Vymin; e.Mmax = e.Mzmax; e.Mmin = e.Mzmin;
      return e;
    });
    const R = {}, nd = list[0].R.length;
    for (let d = 0; d < nd; d++) { let a = Infinity, b = -Infinity; list.forEach(r => { const v = r.R[d]; if (v < a) a = v; if (v > b) b = v; }); R[d] = [a, b]; }
    return { mem, R, n: list.length };
  }

  // paths: [{id, mems:[member ids in order]}]; returns per path the station positions and, for every station,
  // the member results (N, Vy, Vz, T, My, Mz, dz at nps+1 points) and the reactions, for a unit load in direction dir
  function influence(model, opt) {
    opt = Object.assign({ ds: 0.5, nps: 10, dir: [0, 0, -1], maxSt: 400 }, opt || {});
    const mesh = build(model, 1), num = numbering(model, mesh), prep = prepare(model, mesh, num);
    if (!prep.ok) { const n = model.nodes[prep.at]; throw Object.assign(new Error('The structure is unstable (mechanism)' + (n ? ' at node ' + n.id : '') + ' — check supports, releases and connections.'), { code: 'unstable', node: n ? n.id : null }); }
    const byId = {}; mesh.mems.forEach(r => { byId[r.id] = r; });
    const NC = 7, np = opt.nps + 1, nm = mesh.mems.length, nd = num.nd;
    const out = { comps: ['N', 'Vy', 'Vz', 'T', 'My', 'Mz', 'dz'], nps: opt.nps, memIds: mesh.mems.map(r => r.id), L: mesh.mems.map(r => r.L), nd, paths: {} };
    (opt.paths || []).forEach(pa => {
      const recs = (pa.mems || []).map(id => byId[id]).filter(Boolean); if (!recs.length) return;
      // orientation of each member along the path
      const seg = []; let at = null;
      recs.forEach((r, k) => {
        let rev = false;
        if (k === 0) { const nx = recs[1]; rev = !!(nx && (r.i === nx.i || r.i === nx.j) && !(r.j === nx.i || r.j === nx.j)); }
        else rev = r.j === at;
        at = rev ? r.i : r.j; seg.push({ r, rev });
      });
      const Lt = seg.reduce((s, q) => s + q.r.L, 0), nst = Math.max(2, Math.min(opt.maxSt, Math.round(Lt / opt.ds))), ds = Lt / nst, S = [];
      for (let k = 0; k <= nst; k++) S.push(k * ds);
      const data = new Float32Array((nst + 1) * nm * NC * np), R = new Float32Array((nst + 1) * nd);
      S.forEach((sv, k) => {
        let acc = 0, q = seg[seg.length - 1], a = q.r.L; for (const sg of seg) { if (sv <= acc + sg.r.L + 1e-9) { q = sg; a = sv - acc; break; } acc += sg.r.L; }
        const t = Math.max(0, Math.min(q.r.L, q.rev ? q.r.L - a : a)), el = q.r.els[0], loc = q.r.R.map(e => dot3(e, opt.dir));
        const ls = { nodal: new Map(), byEl: new Map([[el, [{ k: 'p', a: t, P: loc }]]]), imposed: new Map() };
        const st = solveWith(prep, mesh, ls); if (!st.ok) return;
        const mr = memberResults(mesh, st, ls, opt.nps), base = k * nm * NC * np;
        mr.forEach((m, mi) => { out.comps.forEach((c, ci) => { const arr = m[c], o = base + (mi * NC + ci) * np; for (let i = 0; i < np && i < arr.length; i++) data[o + i] = arr[i]; }); });
        R.set(st.R, k * nd);
      });
      out.paths[pa.id] = { id: pa.id, S, ds, L: Lt, mems: pa.mems.slice(), data, R, nst };
    });
    out.x = mesh.mems.map(r => Array.from({ length: np }, (_, i) => r.L * i / opt.nps));
    return out;
  }

  G.FRAME = { analyse, influence, envelope, secProps, concreteE, alphaOf, axes, SUPS, fixOf, COMP, _test: { kLocal, feq, loadsUpTo, jacobiEig, Sky, numbering, build } };
})(typeof window !== 'undefined' ? window : globalThis);
