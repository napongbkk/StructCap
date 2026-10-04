/* StructCap Connection — plate finite-element analysis of a joint (CBFEM-style).
   Plates → 4-node flat shells (Q4 membrane + MITC4 plate, 6 DOF per node), elastic-plastic (von Mises, small hardening,
   5 layers through the thickness). Welds → stiff ties whose forces give the weld stresses. Bolts → tension-only axial
   springs + shear springs between the hole regions of the plates. Contact between plates and under a base plate →
   compression-only springs; anchors → tension-only springs to the foundation. Members are modelled over about twice
   their depth; loads act at the far end of the loaded member through a rigid end diaphragm; bearing members are held
   at their ends. Loads are applied in steps with equilibrium iterations (initial-stiffness method).
   run(J, g, load) → result; checks(J, g, res) → check list like conncheck. Units N, mm, MPa. */
(function (G) {
  'use strict';
  const C = G.CONN, V = C.V, PI = Math.PI, sq = Math.sqrt, abs = Math.abs, max = Math.max, min = Math.min;
  const NU = 0.3, KS = 5 / 6, LAY = [-0.5, -0.25, 0, 0.25, 0.5], LW = [1, 4, 2, 4, 1].map(w => w / 12), GP = 1 / sq(3);
  const XI = [-1, 1, 1, -1], ETA = [-1, -1, 1, 1];

  // ------------------------------------------------------------------ bilinear plate map
  const bil = (c, s, t) => [0, 1, 2].map(k => (1 - s) * (1 - t) * c[0][k] + s * (1 - t) * c[1][k] + s * t * c[2][k] + (1 - s) * t * c[3][k]);
  function inv2(loc, x, y) { // (s, t) of a local point in the plate quad (Newton)
    let s = 0.5, t = 0.5;
    for (let it = 0; it < 20; it++) {
      const px = (1 - s) * (1 - t) * loc[0][0] + s * (1 - t) * loc[1][0] + s * t * loc[2][0] + (1 - s) * t * loc[3][0] - x, py = (1 - s) * (1 - t) * loc[0][1] + s * (1 - t) * loc[1][1] + s * t * loc[2][1] + (1 - s) * t * loc[3][1] - y;
      const a = -(1 - t) * loc[0][0] + (1 - t) * loc[1][0] + t * loc[2][0] - t * loc[3][0], b = -(1 - s) * loc[0][0] - s * loc[1][0] + s * loc[2][0] + (1 - s) * loc[3][0];
      const c2 = -(1 - t) * loc[0][1] + (1 - t) * loc[1][1] + t * loc[2][1] - t * loc[3][1], d = -(1 - s) * loc[0][1] - s * loc[1][1] + s * loc[2][1] + (1 - s) * loc[3][1], det = a * d - b * c2 || 1e-12;
      const ds = (d * px - b * py) / det, dt = (-c2 * px + a * py) / det; s -= ds; t -= dt; if (abs(ds) + abs(dt) < 1e-10) break;
    }
    return [s, t];
  }
  const toLoc = (p, q) => { const d = V.sub(q, p.o); return [V.dot(d, p.u), V.dot(d, p.v), V.dot(d, p.n)]; };
  function stOf(p, q) { const l = toLoc(p, q); const st = inv2(p.loc, l[0], l[1]); return { s: st[0], t: st[1], h: l[2] }; }
  function segDist(q, a, b) { const ab = V.sub(b, a), L2 = V.dot(ab, ab) || 1, t = max(0, min(1, V.dot(V.sub(q, a), ab) / L2)); return { d: V.len(V.sub(q, V.lin(a, ab, t))), t }; }
  function stations(len, h, hints) { // parametric stations 0..1 with spacing ≤ h plus the hint positions
    const n = max(1, Math.ceil(len / h - 1e-6)), pts = [], tol = min(0.3 * h / max(len, 1e-9), 0.2);
    hints.filter(x => x > 1e-6 && x < 1 - 1e-6).forEach(x => pts.push([x, 1]));
    for (let i = 0; i <= n; i++) pts.push([i / n, i === 0 || i === n ? 2 : 0]);
    pts.sort((a, b) => a[0] - b[0]);
    const out = []; pts.forEach(p => { const l = out[out.length - 1]; if (l && p[0] - l[0] < tol) { if (p[1] > l[1]) out[out.length - 1] = p; } else out.push(p); });
    if (out[0][0] > 0) out.unshift([0, 2]); if (out[out.length - 1][0] < 1) out.push([1, 2]); out[0] = [0, 2]; out[out.length - 1] = [1, 2];
    // fill gaps larger than h after merging
    const res = []; for (let i = 0; i < out.length; i++) { if (i) { const gap = out[i][0] - out[i - 1][0], k = Math.ceil(gap * len / h - 1e-6); for (let j = 1; j < k; j++) res.push(out[i - 1][0] + gap * j / k); } res.push(out[i][0]); }
    return res;
  }
  function graded(len, h, x0, hints) { // member stations: fine near the joint (x0, 0..1), coarser away from it
    const pts = [0], hh = x => min(3 * h, h * (1 + 2.2 * abs(x - x0)));
    let x = 0; while (x < 1 - 1e-9) { x = min(1, x + hh(x) / len); pts.push(x); }
    if (1 - pts[pts.length - 2] < 0.3 * hh(1) / len && pts.length > 2) pts.splice(pts.length - 2, 1);
    const all = pts.map(v => [v, 0]).concat(hints.filter(v => v > 1e-6 && v < 1 - 1e-6).map(v => [v, 1])).sort((a, b) => a[0] - b[0]), out = [];
    all.forEach(p => { const l = out[out.length - 1]; if (l && (p[0] - l[0]) * len < 0.35 * hh(p[0])) { if (p[1] > l[1] && l[0] !== 0) out[out.length - 1] = p; } else out.push(p); });
    if (out[out.length - 1][0] < 1) out.push([1, 0]); return out.map(p => p[0]);
  }

  // ------------------------------------------------------------------ model
  function mesh(J, g) {
    const dep = g.members.reduce((a, m) => max(a, m.s.d || m.s.D || 200), 200), base = min(45, max(16, dep / 9)), h = base * ({ coarse: 1.6, normal: 1, fine: 0.65 }[(J.fe || {}).mesh] || 1);
    const P = {}; g.plates.forEach(p => { P[p.id] = p; p.hs = []; p.ht = []; });
    const plOf = id => (/\.\*$/.test(id) ? g.plates.filter(q => q.mem === id.slice(0, -2)) : P[id] ? [P[id]] : []);
    const memOf = {}; g.members.forEach(m => m.plates.forEach(id => { memOf[id] = m; }));
    const hint = (p, q, both) => { const st = stOf(p, q); if (abs(st.h) > p.t + 2 * h || st.s < -0.01 || st.s > 1.01 || st.t < -0.01 || st.t > 1.01) return; p.hs.push(st.s); p.ht.push(st.t); };
    const lineHint = (p, a, b) => { const A = stOf(p, a), B = stOf(p, b); if (abs(A.h) > p.t + h || abs(B.h) > p.t + h) return; if (abs(A.s - B.s) < 1e-3) p.hs.push(A.s); if (abs(A.t - B.t) < 1e-3) p.ht.push(A.t); [A, B].forEach(q => { if (q.s > -0.01 && q.s < 1.01 && q.t > -0.01 && q.t < 1.01) { p.hs.push(q.s); p.ht.push(q.t); } }); };
    g.bolts.forEach(b => b.stack.forEach(id => plOf(id || '').forEach(p => { const st = stOf(p, b.p), q = V.lin(b.p, p.n, -st.h); hint(p, q); })));
    g.anchors.forEach(a => plOf(a.plate).forEach(p => hint(p, a.p)));
    g.welds.forEach(w => [w.a, w.b].forEach(id => plOf(id).forEach(p => lineHint(p, w.p0, w.p1))));
    // junctions between plates that share nodes (same member or part): edges of one plate lying on another
    const partOf = p => (memOf[p.id] ? 'M' + memOf[p.id].id : p.part || p.id), byPart = {}; g.plates.forEach(p => (byPart[partOf(p)] = byPart[partOf(p)] || []).push(p));
    Object.values(byPart).forEach(ps => { if (ps.length < 2) return; ps.forEach(a => ps.forEach(b => { if (a === b) return; for (let k = 0; k < 4; k++) { const q0 = a.c[k], q1 = a.c[(k + 1) % 4], A = stOf(b, q0), B = stOf(b, q1); if (abs(A.h) > 0.5 || abs(B.h) > 0.5) continue; const inn = q => q.s > -0.01 && q.s < 1.01 && q.t > -0.01 && q.t < 1.01; if (!inn(A) && !inn(B)) continue; if (abs(A.s - B.s) < 1e-3) b.hs.push(A.s); if (abs(A.t - B.t) < 1e-3) b.ht.push(A.t); [A, B].forEach(q => { if (inn(q)) { b.hs.push(q.s); b.ht.push(q.t); } }); } })); });
    // contacts: the outline of the smaller plate on the larger one
    g.contacts.forEach(c => { const A = plOf(c.a)[0], B = plOf(c.b)[0]; if (!A || !B) return; A.c.forEach((q, k) => lineHint(B, q, A.c[(k + 1) % 4])); });
    // nodes
    const X = [], key = new Map(), nodeOf = (part, q) => { const k = part + '|' + Math.round(q[0] * 20) + ',' + Math.round(q[1] * 20) + ',' + Math.round(q[2] * 20); let i = key.get(k); if (i === undefined) { i = X.length / 3; X.push(q[0], q[1], q[2]); key.set(k, i); } return i; };
    const els = [], pmesh = {};
    // member stations shared by all plates of the member
    const mst = {}; g.members.forEach(m => { const L = m.s1 - m.s0, x0 = m.role === 'bearing' && m.ends === 'both' ? (0 - m.s0) / L : 0; const hs = []; m.plates.forEach(id => P[id].hs.forEach(v => hs.push(v))); mst[m.id] = graded(L, h, x0, hs); });
    g.plates.forEach(p => {
      const Ls = (V.len(V.sub(p.c[1], p.c[0])) + V.len(V.sub(p.c[2], p.c[3]))) / 2, Lt = (V.len(V.sub(p.c[3], p.c[0])) + V.len(V.sub(p.c[2], p.c[1]))) / 2, m = memOf[p.id];
      const ss = m ? mst[m.id] : stations(Ls, h * (p.role === 'member' ? 1 : 0.8), p.hs), tt = stations(Lt, h * (p.role === 'member' ? 1 : 0.8), p.ht), part = m ? 'M' + m.id : p.part || p.id;
      const ids = []; tt.forEach(t => ss.forEach(s => ids.push(nodeOf(part, bil(p.c, s, t)))));
      const ns = ss.length, nt = tt.length, my = [];
      for (let j = 0; j + 1 < nt; j++) for (let i = 0; i + 1 < ns; i++) { const e = { n: [ids[j * ns + i], ids[j * ns + i + 1], ids[(j + 1) * ns + i + 1], ids[(j + 1) * ns + i]], p: p.id, t: p.t, E: p.E || 210000, fy: p.fy || 355 }; els.push(e); my.push(els.length - 1); }
      pmesh[p.id] = { ids, ss, tt, ns, nt, els: my, set: new Set(ids) };
    });
    return { X, els, pmesh, h, P, plOf, memOf, nn: X.length / 3 };
  }

  // springs: { terms: [[dof, coef], ...], k, kind: 'lin' | 'tens' | 'comp', on }
  function build(J, g, l) {
    const M = mesh(J, g), X = M.X, xyz = i => [X[3 * i], X[3 * i + 1], X[3 * i + 2]], sp = [], warn = [];
    let nn = M.nn; const masters = [];
    const addMaster = q => { const i = nn++; X.push(q[0], q[1], q[2]); return i; };
    const nodesOf = id => { const out = new Set(); M.plOf(id).forEach(p => M.pmesh[p.id].ids.forEach(i => out.add(i))); return [...out]; };
    const caps = [], RR = C.R(J.code), FAC = C.FAC[J.code], wcap = (w, p) => { const a = +w.a_ || 6, sd = w.sides || 2; if (w.type === 'butt') return (p.t || 10) * (p.fy || 355); const fu = C.weldMetal(J.code, J.mat.weld, p.fu || 490).fu; return J.code === 'EN' ? fu / (sq(3) * (p.bw || 1) * FAC.M2) * a * sd : J.code === 'AS' ? 0.8 * 0.6 * fu * a * sd : 0.75 * 0.6 * fu * a * sd; };
    const Eref = 210000;
    // welds: ties between the nodes on the weld line (plate a) and the nearest node of plate b
    const welds = g.welds.map(w => {
      const A = nodesOf(w.a), Bn = nodesOf(w.b), tol = 0.3 * M.h, onL = A.map(i => ({ i, d: segDist(xyz(i), w.p0, w.p1) })).filter(q => q.d.d < tol).sort((a, b) => a.d.t - b.d.t), ties = [];
      onL.forEach((q, k) => { const pq = xyz(q.i); let best = -1, bd = Infinity; Bn.forEach(j => { if (j === q.i) return; const d = V.len(V.sub(xyz(j), pq)); if (d < bd) { bd = d; best = j; } }); if (best < 0 || bd > max(2 * M.h, 30)) return;
        const t0 = k ? (q.d.t - onL[k - 1].d.t) / 2 : q.d.t, t1 = k < onL.length - 1 ? (onL[k + 1].d.t - q.d.t) / 2 : 1 - q.d.t, trib = max(1, (t0 + t1) * w.L);
        const kk = Eref * trib * 4, gi = caps.length, ids = [0, 1, 2].map(c => sp.push({ terms: [[6 * q.i + c, 1], [6 * best + c, -1]], k: kk, kind: 'lin', on: true, w: w.id, cg: gi }) - 1); caps.push({ cap: wcap(w, (M.plOf(w.b)[0] || M.plOf(w.a)[0] || {})) * trib, ids, pl: false }); ties.push({ i: q.i, j: best, trib, ids, cg: gi }); });
      if (!ties.length) warn.push('Weld ' + w.id + ' (' + (w.name || '') + ') found no nodes to connect.');
      return { w, ties };
    });
    // bolts: hole regions (spiders) in each plate of the stack, shear springs between consecutive plates, tension-only axial spring
    const bolts = g.bolts.map(b => {
      const B = b.B, rings = b.stack.map(id => { const pls = M.plOf(id || ''); if (!pls.length) return null; const p = pls[0], st = stOf(p, b.p), c = V.lin(b.p, p.n, -st.h), ids = M.pmesh[p.id].ids, R = max(0.75 * B.d0, 0.6 * M.h); let ring = ids.filter(i => V.len(V.sub(xyz(i), c)) <= R); if (!ring.length) { let bi = ids[0], bd = Infinity; ids.forEach(i => { const d = V.len(V.sub(xyz(i), c)); if (d < bd) { bd = d; bi = i; } }); ring = [bi]; } return { p, ring: [...new Set(ring)], c }; }).filter(Boolean);
      const ax = b.axis, e1 = V.unit(abs(ax[0]) < 0.9 ? V.cross(ax, [1, 0, 0]) : V.cross(ax, [0, 1, 0])), e2 = V.cross(ax, e1), avg = (ring, dir, sg) => ring.ring.map(i => [0, 1, 2].map(c => [6 * i + c, sg * dir[c] / ring.ring.length])).flat();
      const ks = 16 * B.d * B.d * B.fu / 16, grip = b.stack.reduce((a, id) => a + ((M.plOf(id || '')[0] || {}).t || 0), 0), ka = 1.6 * Eref * B.As / (grip + B.d), shear = [];
      // slip measured at the shear plane (mid-way between the plates) so that the shear pair forms no local couple
      const avgAt = (ring, dir, sg, zp) => { const r = V.sub(zp, ring.c), rxe = V.cross(r, dir), w = sg / ring.ring.length; return ring.ring.map(i => [0, 1, 2].map(c => [6 * i + c, w * dir[c]]).concat([0, 1, 2].map(c => [6 * i + 3 + c, w * rxe[c]]))).flat().filter(q => q[1]); };
      for (let k = 0; k + 1 < rings.length; k++) { const zp = V.lin(rings[k].c, V.sub(rings[k + 1].c, rings[k].c), 0.5), gi = caps.length, ids = [e1, e2].map(e => sp.push({ terms: avgAt(rings[k], e, 1, zp).concat(avgAt(rings[k + 1], e, -1, zp)), k: ks, kind: 'lin', on: true, b: b.id, cg: gi }) - 1); const pa = rings[k].p, pb = rings[k + 1].p, br = Math.min(RR.bear(B, pa.t, pa.fu || 400, 2 * B.d0, 3 * B.d0, 1.5 * B.d0, 3 * B.d0).v, RR.bear(B, pb.t, pb.fu || 400, 2 * B.d0, 3 * B.d0, 1.5 * B.d0, 3 * B.d0).v); caps.push({ cap: Math.min(RR.boltV(B).v, br), ids, pl: false }); shear.push(ids); }
      // extension = separation of the outer plates along the line from the last plate to the first
      const dsep = rings.length >= 2 ? V.unit(V.sub(rings[0].c, rings[rings.length - 1].c)) : ax, axial = rings.length >= 2 ? sp.push({ terms: avg(rings[0], dsep, 1).concat(avg(rings[rings.length - 1], dsep, -1)), k: ka, kind: 'tens', on: false, b: b.id }) - 1 : -1;
      return { b, rings, shear, axial };
    });
    // contact between plates (compression-only along the normal of plate b)
    g.contacts.forEach(c => { const A = M.plOf(c.a)[0], Bp = M.plOf(c.b)[0]; if (!A || !Bp) return; const Ai = M.pmesh[A.id].ids, Bi = M.pmesh[Bp.id].ids, nB = Bp.n, sideA = V.dot(V.sub(A.o, Bp.o), nB) > 0 ? 1 : -1, trib = A.area / Ai.length;
      Ai.forEach(i => { const q = xyz(i), st = stOf(Bp, q); if (st.s < -0.02 || st.s > 1.02 || st.t < -0.02 || st.t > 1.02) return; let best = -1, bd = Infinity; Bi.forEach(j => { const dq = V.sub(xyz(j), q), d = V.len(V.sub(dq, V.mul(nB, V.dot(dq, nB)))); if (d < bd) { bd = d; best = j; } }); if (best < 0 || bd > 1.2 * M.h) return;
        // extension = opening of the gap (A moving away from B along n, which points from B to A)
        const n = V.mul(nB, sideA), k = Eref * trib / max(5, (A.t + Bp.t) / 2); sp.push({ terms: [0, 1, 2].map(cc => [6 * i + cc, n[cc]]).concat([0, 1, 2].map(cc => [6 * best + cc, -n[cc]])), k, kind: 'comp', on: false, ct: true }); }); });
    // base plate on concrete, anchors to the foundation
    let conc = null; const anchors = [];
    if (g.conc) { const Bp = M.P[g.conc.plate], ids = M.pmesh[Bp.id].ids, Ec = 4700 * sq(g.conc.fc), hc = 0.5 * sq(g.conc.L * g.conc.B), trib = Bp.area / ids.length; conc = { ids: [], trib };
      ids.forEach(i => { conc.ids.push(sp.push({ terms: [[6 * i + 2, 1]], k: Ec * trib / hc, kind: 'comp', on: false, cc: true, i }) - 1); });
      g.anchors.forEach(a => { const ring = ids.filter(i => V.len(V.sub(xyz(i), a.p)) <= max(0.75 * a.B.d0, 0.6 * M.h)); const rg = ring.length ? ring : [ids.reduce((b2, i) => (V.len(V.sub(xyz(i), a.p)) < V.len(V.sub(xyz(b2), a.p)) ? i : b2), ids[0])];
        const av = c => rg.map(i => [6 * i + c, 1 / rg.length]), La = 8 * a.d + (g.conc.grout || 30), ka = Eref * a.B.As / La, ks = 16 * a.d * a.d * a.B.fu / 16 * 0.5;
        anchors.push({ a, ax: sp.push({ terms: av(2), k: ka, kind: 'tens', on: false, an: a.id }) - 1, sx: sp.push({ terms: av(0), k: ks, kind: 'lin', on: true, an: a.id }) - 1, sy: sp.push({ terms: av(1), k: ks, kind: 'lin', on: true, an: a.id }) - 1 }); }); }
    // member ends: bearing ends clamped; the load of the loaded member is spread over its end section (beam theory)
    const fixed = new Set(), F = new Map();
    g.members.forEach(m => {
      const ends = m.role === 'bearing' ? (m.ends === 'both' ? [0, 1] : [1]) : m.loaded ? [1] : [];
      ends.forEach(e => {
        const xe = e ? m.s1 : m.s0, cpt = V.lin(m.O, m.fr.x, xe), nodes = new Map();
        m.plates.forEach(pid => { const pm = M.pmesh[pid], pp = M.P[pid], j = e ? pm.ns - 1 : 0; for (let r = 0; r < pm.nt; r++) { const i = pm.ids[r * pm.ns + j], t0 = r ? (pm.tt[r] - pm.tt[r - 1]) / 2 : 0, t1 = r < pm.nt - 1 ? (pm.tt[r + 1] - pm.tt[r]) / 2 : 0, Lt = V.len(V.sub(pp.c[3], pp.c[0])), A = (t0 + t1) * Lt * pp.t, q = nodes.get(i) || { A: 0, wy: 0, wz: 0 }; q.A += A; q.wy += A * V.dot(pp.v, m.fr.y) ** 2; q.wz += A * V.dot(pp.v, m.fr.z) ** 2; nodes.set(i, q); } });
        if (m.role === 'bearing') { nodes.forEach((q, i) => { for (let d = 0; d < 6; d++) fixed.add(6 * i + d); }); return; }
        if (!l) return;
        const fr = m.fr, Fj = V.add(V.add(V.mul(fr.x, (+l.N || 0) * 1e3), V.mul(fr.z, -(+l.Vz || 0) * 1e3)), V.mul(fr.y, -(+l.Vy || 0) * 1e3));
        const Mj = V.add(V.add(V.mul(fr.x, (+l.Mx || 0) * 1e6), V.mul(fr.y, (+l.My || 0) * 1e6)), V.mul(fr.z, (+l.Mz || 0) * 1e6));
        let A = 0, yc = 0, zc = 0; nodes.forEach((q, i) => { const r = V.sub(xyz(i), cpt); q.y = V.dot(r, fr.y); q.z = V.dot(r, fr.z); A += q.A; yc += q.A * q.y; zc += q.A * q.z; }); yc /= A; zc /= A;
        const cen = V.lin(cpt, fr.y, yc, fr.z, zc), r0 = V.sub(cen, V.lin(m.O, m.fr.x, m.s0)), Ma = V.sub(Mj, V.cross(r0, Fj));
        const fx = V.dot(Fj, fr.x), fy = V.dot(Fj, fr.y), fz = V.dot(Fj, fr.z), mx = V.dot(Ma, fr.x), my = V.dot(Ma, fr.y), mz = V.dot(Ma, fr.z);
        let Iy = 0, Iz = 0, Ip = 0, Wy = 0, Wz = 0; nodes.forEach(q => { q.y -= yc; q.z -= zc; Iy += q.A * q.z * q.z; Iz += q.A * q.y * q.y; Wy += q.wy; Wz += q.wz; }); Ip = Iy + Iz;
        nodes.forEach((q, i) => { const sx = fx / A + (Iy ? my * q.z / Iy : 0) - (Iz ? mz * q.y / Iz : 0), f = V.add(V.add(V.mul(fr.x, sx * q.A), V.mul(fr.y, Wy ? fy * q.wy / Wy : 0)), V.mul(fr.z, Wz ? fz * q.wz / Wz : 0)), ft = Ip ? mx * q.A / Ip : 0, tor = V.add(V.mul(fr.z, ft * q.y), V.mul(fr.y, -ft * q.z));
          for (let d = 0; d < 3; d++) F.set(6 * i + d, (F.get(6 * i + d) || 0) + f[d] + tor[d]); });
        masters.push({ m: m.id, e, at: cen, nodes: [...nodes.keys()] });
      });
    });
    // members with no support at all and no load (e.g. nothing to hold): warn
    return { M, X, sp, welds, bolts, conc, anchors, fixed, F, masters, nn, warn, caps };
  }

  // ------------------------------------------------------------------ shell element (local)
  function elGeom(X, e) {
    const P = e.n.map(i => [X[3 * i], X[3 * i + 1], X[3 * i + 2]]), c = [0, 1, 2].map(k => (P[0][k] + P[1][k] + P[2][k] + P[3][k]) / 4);
    const e1 = V.unit(V.add(V.sub(P[1], P[0]), V.sub(P[2], P[3]))), e3 = V.unit(V.cross(V.sub(P[2], P[0]), V.sub(P[3], P[1]))), e2 = V.cross(e3, e1);
    const xy = P.map(q => { const d = V.sub(q, c); return [V.dot(d, e1), V.dot(d, e2)]; });
    return { R: [e1, e2, e3], xy };
  }
  function shape(xy, xi, eta) {
    const N = [0, 1, 2, 3].map(i => 0.25 * (1 + XI[i] * xi) * (1 + ETA[i] * eta)), dxi = [0, 1, 2, 3].map(i => 0.25 * XI[i] * (1 + ETA[i] * eta)), deta = [0, 1, 2, 3].map(i => 0.25 * ETA[i] * (1 + XI[i] * xi));
    let J11 = 0, J12 = 0, J21 = 0, J22 = 0; for (let i = 0; i < 4; i++) { J11 += dxi[i] * xy[i][0]; J12 += dxi[i] * xy[i][1]; J21 += deta[i] * xy[i][0]; J22 += deta[i] * xy[i][1]; }
    const det = J11 * J22 - J12 * J21, i11 = J22 / det, i12 = -J12 / det, i21 = -J21 / det, i22 = J11 / det;
    const dx = [0, 1, 2, 3].map(i => i11 * dxi[i] + i12 * deta[i]), dy = [0, 1, 2, 3].map(i => i21 * dxi[i] + i22 * deta[i]);
    return { N, dxi, deta, dx, dy, det, J: [J11, J12, J21, J22], Ji: [i11, i12, i21, i22] };
  }
  // B matrices at a Gauss point in local DOFs (24: per node u v w θx θy θz)
  function Bmats(xy, xi, eta) {
    const s = shape(xy, xi, eta), Bm = [new Float64Array(24), new Float64Array(24), new Float64Array(24)], Bb = [new Float64Array(24), new Float64Array(24), new Float64Array(24)], Bs = [new Float64Array(24), new Float64Array(24)];
    for (let i = 0; i < 4; i++) { const o = 6 * i; Bm[0][o] = s.dx[i]; Bm[1][o + 1] = s.dy[i]; Bm[2][o] = s.dy[i]; Bm[2][o + 1] = s.dx[i];
      // κx = θy,x ; κy = −θx,y ; κxy = θy,y − θx,x
      Bb[0][o + 4] = s.dx[i]; Bb[1][o + 3] = -s.dy[i]; Bb[2][o + 4] = s.dy[i]; Bb[2][o + 3] = -s.dx[i]; }
    // MITC4 transverse shear: covariant strains tied at the edge mid-points
    const tie = (xt, et) => { const q = shape(xy, xt, et), ex = new Float64Array(24), ee = new Float64Array(24); for (let i = 0; i < 4; i++) { const o = 6 * i; // e_ξ = w,ξ + βx·x,ξ + βy·y,ξ with βx = θy, βy = −θx
        ex[o + 2] = q.dxi[i]; ex[o + 4] = q.N[i] * q.J[0]; ex[o + 3] = -q.N[i] * q.J[1]; ee[o + 2] = q.deta[i]; ee[o + 4] = q.N[i] * q.J[2]; ee[o + 3] = -q.N[i] * q.J[3]; } return { ex, ee }; };
    const A = tie(0, -1), Cc = tie(0, 1), Bt = tie(-1, 0), D = tie(1, 0), exi = new Float64Array(24), eet = new Float64Array(24);
    for (let k = 0; k < 24; k++) { exi[k] = 0.5 * (1 - eta) * A.ex[k] + 0.5 * (1 + eta) * Cc.ex[k]; eet[k] = 0.5 * (1 - xi) * Bt.ee[k] + 0.5 * (1 + xi) * D.ee[k]; }
    const [i11, i12, i21, i22] = s.Ji; for (let k = 0; k < 24; k++) { Bs[0][k] = i11 * exi[k] + i12 * eet[k]; Bs[1][k] = i21 * exi[k] + i22 * eet[k]; }
    return { Bm, Bb, Bs, w: s.det };
  }
  function prepEl(X, e) { const gm = elGeom(X, e), gps = []; for (const a of [-GP, GP]) for (const b of [-GP, GP]) gps.push(Bmats(gm.xy, a, b)); const area = gps.reduce((s, q) => s + q.w, 0); e.R = gm.R; e.gps = gps; e.area = area; }
  // elastic local stiffness 24×24
  function kLocal(e) {
    const E = e.E, t = e.t, Dm = E * t / (1 - NU * NU), Db = E * t * t * t / (12 * (1 - NU * NU)), Ds = KS * E / (2 * (1 + NU)) * t, K = new Float64Array(576);
    const D3 = (B, D, w) => { const d = [[1, NU, 0], [NU, 1, 0], [0, 0, (1 - NU) / 2]]; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { const c = d[a][b] * D * w; if (!c) continue; const Ba = B[a], Bb2 = B[b]; for (let i = 0; i < 24; i++) { const v = Ba[i] * c; if (!v) continue; for (let j = 0; j < 24; j++) K[i * 24 + j] += v * Bb2[j]; } } };
    e.gps.forEach(q => { D3(q.Bm, Dm, q.w); D3(q.Bb, Db, q.w); for (let a = 0; a < 2; a++) { const B = q.Bs[a], c = Ds * q.w; for (let i = 0; i < 24; i++) { const v = B[i] * c; if (!v) continue; for (let j = 0; j < 24; j++) K[i * 24 + j] += v * B[j]; } } });
    const kd = 1e-3 * E * t * e.area / 4; for (let i = 0; i < 4; i++) K[(6 * i + 5) * 25] += kd;
    return K;
  }
  // stress at a layer: plane-stress von Mises, radial return to the yield surface with small hardening (deformation theory)
  function mat(eps, E, fy, out) {
    const c = E / (1 - NU * NU), sx = c * (eps[0] + NU * eps[1]), sy = c * (eps[1] + NU * eps[0]), txy = c * (1 - NU) / 2 * eps[2], se = sq(sx * sx - sx * sy + sy * sy + 3 * txy * txy);
    if (se <= fy) { out[0] = sx; out[1] = sy; out[2] = txy; return { se, ep: 0 }; }
    const sy2 = fy + (se - fy) * 1e-3, f = sy2 / se; out[0] = sx * f; out[1] = sy * f; out[2] = txy * f; return { se: sy2, ep: (se - sy2) / E };
  }
  // internal force (local 24) and max stress / plastic strain of an element from its local displacements
  function fInt(e, dl, wantRes) {
    const f = new Float64Array(24), t = e.t, E = e.E, Ds = KS * E / (2 * (1 + NU)) * t, sig = [0, 0, 0]; let smax = 0, emax = 0;
    e.gps.forEach(q => {
      const em = [0, 1, 2].map(a => { let s = 0; for (let i = 0; i < 24; i++) s += q.Bm[a][i] * dl[i]; return s; }), kb = [0, 1, 2].map(a => { let s = 0; for (let i = 0; i < 24; i++) s += q.Bb[a][i] * dl[i]; return s; }), gs = [0, 1].map(a => { let s = 0; for (let i = 0; i < 24; i++) s += q.Bs[a][i] * dl[i]; return s; });
      const N = [0, 0, 0], Mo = [0, 0, 0];
      for (let k = 0; k < 5; k++) { const z = LAY[k] * t, r = mat([em[0] + z * kb[0], em[1] + z * kb[1], em[2] + z * kb[2]], E, e.fy, sig), w = LW[k] * t; for (let a = 0; a < 3; a++) { N[a] += w * sig[a]; Mo[a] += w * z * sig[a]; } if (r.se > smax) smax = r.se; if (r.ep > emax) emax = r.ep; }
      for (let i = 0; i < 24; i++) { f[i] += q.w * (q.Bm[0][i] * N[0] + q.Bm[1][i] * N[1] + q.Bm[2][i] * N[2] + q.Bb[0][i] * Mo[0] + q.Bb[1][i] * Mo[1] + q.Bb[2][i] * Mo[2] + q.Bs[0][i] * Ds * gs[0] + q.Bs[1][i] * Ds * gs[1]); }
    });
    const kd = 1e-3 * E * t * e.area / 4; for (let i = 0; i < 4; i++) f[6 * i + 5] += kd * dl[6 * i + 5];
    if (wantRes) { e.smax = smax; e.emax = emax; }
    return f;
  }
  const toLocal = (e, u) => { const dl = new Float64Array(24), R = e.R; for (let i = 0; i < 4; i++) { const n = e.n[i]; for (let blk = 0; blk < 2; blk++) { const g0 = 6 * n + 3 * blk; for (let a = 0; a < 3; a++) dl[6 * i + 3 * blk + a] = R[a][0] * u[g0] + R[a][1] * u[g0 + 1] + R[a][2] * u[g0 + 2]; } } return dl; };

  // ------------------------------------------------------------------ skyline Cholesky with RCM ordering
  function numbering(nn, adj, fixed) {
    // nodes with no free DOF take no part in the ordering
    const free = new Uint8Array(nn); for (let i = 0; i < nn; i++) for (let d = 0; d < 6; d++) if (!fixed.has(6 * i + d)) { free[i] = 1; break; }
    const nb = adj.map((a, i) => (free[i] ? [...a].filter(x => free[x]) : [])), deg = nb.map(a => a.length);
    const levels = s0 => { const lv = new Int32Array(nn).fill(-1), q = [s0]; lv[s0] = 0; for (let h = 0; h < q.length; h++) { const p = q[h]; nb[p].forEach(x => { if (lv[x] < 0) { lv[x] = lv[p] + 1; q.push(x); } }); } return { lv, q }; };
    const rcm = (s0, seen) => { const out = [], q = [s0]; seen[s0] = 1; for (let h = 0; h < q.length; h++) { const p = q[h]; out.push(p); nb[p].filter(x => !seen[x]).sort((a, b) => deg[a] - deg[b]).forEach(x => { seen[x] = 1; q.push(x); }); } return out.reverse(); };
    const prof = ord => { const pos = new Map(); ord.forEach((p, k) => pos.set(p, k)); let s = 0; ord.forEach((p, k) => { let mn = k; nb[p].forEach(x => { const j = pos.get(x); if (j < mn) mn = j; }); s += k - mn; }); return s; };
    const done = new Uint8Array(nn), order = [];
    for (let s = 0; s < nn; s++) { if (done[s] || !free[s]) continue;
      // component and a pseudo-peripheral start node (George–Liu)
      let r = levels(s), comp = r.q, st = s, ecc = 0; comp.forEach(i => { done[i] = 1; });
      for (let it = 0; it < 6; it++) { const far = Math.max(...comp.map(i => r.lv[i])); if (it && far <= ecc) break; ecc = far; const cand = comp.filter(i => r.lv[i] === far).sort((a, b) => deg[a] - deg[b])[0]; st = cand; r = levels(st); }
      const cands = [st, comp.slice().sort((a, b) => deg[a] - deg[b])[0]]; let best = null, bp = Infinity;
      cands.forEach(c => { const sn = new Uint8Array(nn), o = rcm(c, sn), pv = prof(o); if (pv < bp) { bp = pv; best = o; } });
      best.forEach(p => order.push(p)); }
    const map = new Int32Array(6 * nn).fill(-1); let n = 0; order.forEach(p => { for (let d = 0; d < 6; d++) if (!fixed.has(6 * p + d)) map[6 * p + d] = n++; });
    return { map, n };
  }
  class Sky {
    constructor(n, fr) { this.n = n; this.fr = fr; this.ptr = new Int32Array(n + 1); for (let j = 0; j < n; j++) this.ptr[j + 1] = this.ptr[j] + (j - fr[j] + 1); this.v = new Float64Array(this.ptr[n]); }
    add(i, j, val) { if (i > j) { const t = i; i = j; j = t; } const f = this.fr[j]; if (i < f) return; this.v[this.ptr[j] + i - f] += val; }
    factor() { // U^T U in place
      const { n, fr, ptr, v } = this;
      for (let j = 0; j < n; j++) { const fj = fr[j], pj = ptr[j];
        const oj = pj - fj; for (let i = fj; i < j; i++) { const fi = fr[i], oi = ptr[i] - fi, k0 = fi > fj ? fi : fj; let s = v[oj + i]; for (let k = k0; k < i; k++) s -= v[oi + k] * v[oj + k]; v[oj + i] = s / v[oi + i]; }
        let d = v[pj + j - fj]; for (let k = fj; k < j; k++) { const x = v[pj + k - fj]; d -= x * x; } if (!(d > 1e-9 * abs(v[pj + j - fj] || 1))) return j; v[pj + j - fj] = sq(d); }
      return -1;
    }
    solve(b) { const { n, fr, ptr, v } = this, x = Float64Array.from(b);
      for (let j = 0; j < n; j++) { const fj = fr[j], pj = ptr[j]; let s = x[j]; for (let k = fj; k < j; k++) s -= v[pj + k - fj] * x[k]; x[j] = s / v[pj + j - fj]; }
      for (let j = n - 1; j >= 0; j--) { const fj = fr[j], pj = ptr[j]; x[j] /= v[pj + j - fj]; const xj = x[j]; for (let k = fj; k < j; k++) x[k] -= v[pj + k - fj] * xj; }
      return x; }
  }

  // ------------------------------------------------------------------ analysis
  function run(J, g, l, opt) {
    const t0 = Date.now(); opt = opt || {};
    const m = build(J, g, l), M = m.M, X = m.X, nn = m.nn, els = M.els, sp = m.sp;
    els.forEach(e => prepEl(X, e));
    // node graph (elements + springs) for ordering and skyline profile
    const adj = Array.from({ length: nn }, () => new Set());
    els.forEach(e => e.n.forEach(a => e.n.forEach(b => { if (a !== b) adj[a].add(b); })));
    sp.forEach(s => { const ns = [...new Set(s.terms.map(q => Math.floor(q[0] / 6)))]; ns.forEach(a => ns.forEach(b => { if (a !== b) adj[a].add(b); })); });
    const used = new Uint8Array(nn); els.forEach(e => e.n.forEach(i => { used[i] = 1; })); sp.forEach(s => s.terms.forEach(q => { used[Math.floor(q[0] / 6)] = 1; }));
    const fixed = new Set(m.fixed); for (let i = 0; i < nn; i++) if (!used[i]) for (let d = 0; d < 6; d++) fixed.add(6 * i + d);
    const num = numbering(nn, adj, fixed), map = num.map, n = num.n;
    const fr = new Int32Array(n); for (let j = 0; j < n; j++) fr[j] = j;
    const touch = dofs => { const eq = dofs.map(d => map[d]).filter(x => x >= 0); if (!eq.length) return; const mn = Math.min(...eq); eq.forEach(x => { if (mn < fr[x]) fr[x] = mn; }); };
    els.forEach(e => { const d = []; e.n.forEach(i => { for (let k = 0; k < 6; k++) d.push(6 * i + k); }); touch(d); });
    sp.forEach(s => touch(s.terms.map(q => q[0])));
    const Kel = els.map(e => kLocal(e));
    sp.forEach(s => { s.sc = 1; }); const keff = s => (s.on ? s.k * s.sc : 0);
    const assemble = () => {
      const S = new Sky(n, fr);
      els.forEach((e, ei) => { const K = Kel[ei], R = e.R, T = (a, b) => R[a][b];
        // K_g = Tᵀ K_l T with T = blockdiag(R) (8 blocks of 3)
        const dofs = []; e.n.forEach(i => { for (let k = 0; k < 6; k++) dofs.push(6 * i + k); });
        const KT = new Float64Array(576); // K_l · T
        for (let i = 0; i < 24; i++) for (let B = 0; B < 8; B++) for (let c = 0; c < 3; c++) { let s = 0; for (let a = 0; a < 3; a++) s += K[i * 24 + 3 * B + a] * R[a][c]; KT[i * 24 + 3 * B + c] = s; }
        for (let A = 0; A < 8; A++) for (let r = 0; r < 3; r++) { const gi = map[dofs[3 * A + r]]; if (gi < 0) continue; for (let j = 0; j < 24; j++) { const gj = map[dofs[j]]; if (gj < 0 || gj < gi) continue; let s = 0; for (let a = 0; a < 3; a++) s += R[a][r] * KT[(3 * A + a) * 24 + j]; if (s) S.add(gi, gj, s); } }
      });
      sp.forEach(s => { const ke = keff(s); if (!ke) return; const tm = s.terms.filter(q => map[q[0]] >= 0); for (let a = 0; a < tm.length; a++) for (let b = a; b < tm.length; b++) { const ia = map[tm[a][0]], ib = map[tm[b][0]], v = ke * tm[a][1] * tm[b][1] * (a === b ? 1 : 1); if (a === b) S.add(ia, ia, v); else S.add(ia, ib, ia === ib ? 2 * v : v); } });
      return S;
    };
    const Fext = new Float64Array(n); m.F.forEach((v, d) => { const q = map[d]; if (q >= 0) Fext[q] += v; });
    const fnorm = Math.max(...Fext.map(abs), 1);
    const u = new Float64Array(6 * nn), cdot = s => s.terms.reduce((a, q) => a + q[1] * u[q[0]], 0), caps = m.caps; let lastSF = null;
    const internal = (res) => { const f = new Float64Array(n);
      els.forEach(e => { const dl = toLocal(e, u), fl = fInt(e, dl, res), R = e.R; e.n.forEach((ni, i) => { for (let blk = 0; blk < 2; blk++) for (let c = 0; c < 3; c++) { const q = map[6 * ni + 3 * blk + c]; if (q < 0) continue; let s = 0; for (let a = 0; a < 3; a++) s += R[a][c] * fl[6 * i + 3 * blk + a]; f[q] += s; } }); });
      const sf = new Float64Array(sp.length); sp.forEach((s, i) => { if (s.on) sf[i] = s.k * cdot(s); });
      caps.forEach(c => { let r2 = 0; c.ids.forEach(i => { r2 += sf[i] * sf[i]; }); const rr = sq(r2); c.f = rr; c.scNow = rr > c.cap ? c.cap / rr : 1; if (rr > c.cap) { const sc = c.cap / rr; c.ids.forEach(i => { sf[i] *= sc; }); c.pl = true; } else c.pl = false; });
      sp.forEach((s, i) => { if (!s.on || !sf[i]) return; const fs = sf[i]; s.terms.forEach(q => { const d = map[q[0]]; if (d >= 0) f[d] += fs * q[1]; }); });
      lastSF = sf; return f; };
    // initial status: tension-only / compression-only springs start closed for a first solve
    sp.forEach(s => { if (s.kind !== 'lin') s.on = true; });
    // linear solver: factored K0 plus low-rank (Woodbury) corrections for springs whose status changed since the factorisation
    sp.forEach(s => { s.av = s.terms.map(q => [map[q[0]], q[1]]).filter(q => q[0] >= 0); });
    let fc = 0, scost = 0; for (let j = 0; j < n; j++) { const hgt = j - fr[j] + 1; fc += hgt * hgt / 2; scost += 2 * hgt; }
    const zBudget = Math.max(20, Math.min(800, 1.2 * fc / scost));
    let S = null, bad = -1, nfac = 0, K0k = [], Zc = new Map(), D = [], Cap = null, zNew = 0;
    const refactor = () => { nfac++; S = assemble(); bad = S.factor(); K0k = sp.map(keff); Zc = new Map(); D = []; Cap = null; zNew = 0; return bad; };
    const lu = (A, mm) => { const piv = new Int32Array(mm); let amax = 0; for (let k = 0; k < mm * mm; k++) amax = max(amax, abs(A[k])); for (let k = 0; k < mm; k++) { let p = k, pv = abs(A[k * mm + k]); for (let i = k + 1; i < mm; i++) if (abs(A[i * mm + k]) > pv) { pv = abs(A[i * mm + k]); p = i; } if (pv < 1e-11 * amax) return null; piv[k] = p; if (p !== k) for (let j = 0; j < mm; j++) { const t = A[k * mm + j]; A[k * mm + j] = A[p * mm + j]; A[p * mm + j] = t; } const d = A[k * mm + k]; for (let i = k + 1; i < mm; i++) { const f = A[i * mm + k] / d; if (!f) continue; A[i * mm + k] = f; for (let j = k + 1; j < mm; j++) A[i * mm + j] -= f * A[k * mm + j]; } } return { A, piv, mm }; };
    const luSolve = (F, b) => { const { A, piv, mm } = F, x = Float64Array.from(b); for (let k = 0; k < mm; k++) { const p = piv[k]; if (p !== k) { const t = x[k]; x[k] = x[p]; x[p] = t; } } for (let k = 0; k < mm; k++) for (let i = k + 1; i < mm; i++) x[i] -= A[i * mm + k] * x[k]; for (let k = mm - 1; k >= 0; k--) { let s2 = x[k]; for (let j = k + 1; j < mm; j++) s2 -= A[k * mm + j] * x[j]; x[k] = s2 / A[k * mm + k]; } return x; };
    const statusChanged = () => {
      D = []; sp.forEach((s, i) => { if (abs(keff(s) - K0k[i]) > 1e-9 * s.k) D.push(i); });
      const need = D.filter(i => !Zc.has(i)).length; if (D.length > 300 || zNew + need > zBudget) return refactor();
      D.forEach(i => { if (Zc.has(i)) return; const b = new Float64Array(n); sp[i].av.forEach(q => { b[q[0]] += q[1]; }); Zc.set(i, S.solve(b)); zNew++; });
      const mm = D.length; if (!mm) { Cap = null; return -1; }
      const Mx = new Float64Array(mm * mm); D.forEach((i, a) => { D.forEach((j, b) => { const z = Zc.get(j); let s2 = 0; sp[i].av.forEach(q => { s2 += q[1] * z[q[0]]; }); Mx[a * mm + b] = s2; }); Mx[a * mm + a] += 1 / (keff(sp[i]) - K0k[i]); });
      Cap = lu(Mx, mm); return Cap ? -1 : refactor(); };
    const solveK = r => { const y = S.solve(r); if (!Cap) return y; const w = D.map(i => sp[i].av.reduce((a, q) => a + q[1] * y[q[0]], 0)), v = luSolve(Cap, w); D.forEach((i, a) => { const z = Zc.get(i), va = v[a]; if (va) for (let k = 0; k < n; k++) y[k] -= z[k] * va; }); return y; };
    if (opt.dbg) console.log('profile', fr.reduce((a, f, j) => a + j - f + 1, 0), 'n', n, 'zBudget', Math.round(zBudget));
    refactor(); let iters = 0, conv = true, steps = opt.steps || 3, msg = '';
    if (bad >= 0) { const d = [...map].indexOf(bad), node = Math.floor(d / 6); return { ok: false, bad, dof: d, err: 'The plate model is unstable (mechanism) near node ' + node + ' — check that every plate is connected by welds or bolts.', ms: Date.now() - t0, m }; }
    const tol = 2e-3 * fnorm;
    for (let st = 1; st <= steps; st++) {
      const lam = st / steps; let it = 0, rn = Infinity;
      for (; it < 150; it++) {
        const fi = internal(false); const r = new Float64Array(n); rn = 0; for (let k = 0; k < n; k++) { r[k] = lam * Fext[k] - fi[k]; rn = max(rn, abs(r[k])); }
        if (rn < tol && it > 0) break;
        const du = solveK(r); for (let i = 0; i < 6 * nn; i++) { const q = map[i]; if (q >= 0) u[i] += du[q]; }
        // contact / bolt / anchor status
        let ch = 0; sp.forEach(s => { if (s.kind === 'lin') return; const v = cdot(s), want = s.kind === 'tens' ? v > -1e-9 : v < 1e-9; if (want !== s.on) { s.on = want; ch++; } });
        // secant stiffness of yielded bolt / weld groups (updated when it changes by more than 10 %)
        caps.forEach(c => { const s0 = sp[c.ids[0]].sc, sn = c.scNow == null ? 1 : max(0.02, c.scNow); if (abs(sn - s0) > 0.1 * s0) { c.ids.forEach(i => { sp[i].sc = sn; }); ch++; } });
        if (ch && statusChanged() >= 0) { sp.forEach(s => { if (s.kind !== 'lin') s.on = true; }); refactor(); }
        iters++; if (opt.dbg) console.log("st", st, "it", it, "rn", (rn / fnorm).toExponential(2), "ch", ch, "D", D.length, "nfac", nfac, "t", Date.now() - t0);
      }
      if (rn >= tol) { conv = false; msg = 'Equilibrium not reached at ' + Math.round(lam * 100) + ' % of the load (residual ' + (rn / fnorm * 100).toFixed(1) + ' %) — the joint may be overloaded.'; break; }
    }
    internal(true); if (opt.dbg) console.log("factorisations", nfac);
    // ---- results
    const R = { ok: true, conv, msg, iters, ms: 0, nn, nel: els.length, ndof: n, h: M.h, X, u, els: els.map(e => ({ n: e.n, p: e.p, s: e.smax || 0, ep: e.emax || 0, fy: e.fy })), warn: m.warn.slice(), masters: m.masters };
    const pl = {}; els.forEach(e => { const q = pl[e.p] || (pl[e.p] = { s: 0, ep: 0, fy: e.fy, t: e.t }); q.s = max(q.s, e.smax || 0); q.ep = max(q.ep, e.emax || 0); }); R.plates = pl;
    const SF = i => (lastSF ? lastSF[i] : sp[i].k * cdot(sp[i]));
    R.bolts = m.bolts.map(b => { const ax = b.axial >= 0 && sp[b.axial].on ? max(0, SF(b.axial)) : 0; const sh = b.shear.map(pr => Math.hypot(...pr.map(i => SF(i)))), pl = b.shear.some(pr => caps[sp[pr[0]].cg] && caps[sp[pr[0]].cg].pl); return { id: b.b.id, Nt: ax, V: sh.length ? max(...sh) : 0, Vs: sh, planes: sh.length, b: b.b, pl }; });
    R.welds = m.welds.map(w => { const W = w.w, l0 = V.unit(V.sub(W.p1, W.p0)), pb = (M.plOf(W.b)[0] || {}), nB = pb.n || [0, 0, 1], tdir = V.cross(nB, l0); const pts = w.ties.map(t => { const f = [0, 1, 2].map(c => SF(t.ids[c])), q = 1 / t.trib; return { fn: abs(V.dot(f, nB)) * q, ft: abs(V.dot(f, tdir)) * q, fl: abs(V.dot(f, l0)) * q, at: t.i, pl: caps[t.cg] && caps[t.cg].pl }; }); return { id: W.id, name: W.name, a: W.a_, sides: W.sides || 2, type: W.type, pts, L: W.L, a_: W.a, b: W.b, pl: pts.some(q => q.pl) }; });
    if (m.conc) { const pr = m.conc.ids.filter(i => sp[i].on).map(i => max(0, -sp[i].k * cdot(sp[i])) / m.conc.trib); R.conc = { pmax: pr.length ? max(...pr) : 0, area: pr.length * m.conc.trib, force: pr.reduce((a, p) => a + p * m.conc.trib, 0) }; }
    R.anchors = m.anchors.map(a => ({ id: a.a.id, Nt: sp[a.ax].on ? max(0, sp[a.ax].k * cdot(sp[a.ax])) : 0, V: Math.hypot(sp[a.sx].k * cdot(sp[a.sx]), sp[a.sy].k * cdot(sp[a.sy])), a: a.a }));
    // node values for contour plots (average of the elements around)
    const ns = new Float64Array(nn), ne = new Float64Array(nn), nc = new Float64Array(nn); els.forEach(e => e.n.forEach(i => { ns[i] += e.smax || 0; ne[i] += e.emax || 0; nc[i]++; })); for (let i = 0; i < nn; i++) if (nc[i]) { ns[i] /= nc[i]; ne[i] /= nc[i]; }
    R.ns = ns; R.ne = ne; R.ms = Date.now() - t0;
    if (!conv) R.warn.push(msg);
    return R;
  }

  // ------------------------------------------------------------------ checks from the FE results (CBFEM)
  function checks(J, g, res, l) {
    const code = J.code, r = C.R(code), list = [], add = (grp, item, name, Ed, Rd, unit, ref, expr, ex) => { const u = Rd > 0 ? abs(Ed) / Rd : 0; list.push(Object.assign({ grp, item, name, Ed, Rd, unit, util: u, ref, expr, fe: true }, ex || {})); };
    if (!res || !res.ok) return list;
    const lim = 0.05;
    Object.entries(res.plates).forEach(([id, q]) => { const p = g.plates.find(z => z.id === id) || {}; const u = q.ep > 0 ? q.ep / lim : q.s / q.fy; list.push({ grp: 'Plates', item: id, name: (p.name || id) + ' (t = ' + p.t + ' mm)', Ed: q.ep > 0 ? q.ep * 100 : q.s, Rd: q.ep > 0 ? lim * 100 : q.fy, unit: q.ep > 0 ? '%' : 'MPa', util: u, ref: code === 'EN' ? 'EN 1993-1-5 Annex C (5 % plastic strain)' : 'CBFEM limit: 5 % plastic strain', expr: 'σ_Ed = ' + q.s.toFixed(0) + ' MPa, f_y = ' + q.fy + ' MPa, ε_pl = ' + (q.ep * 100).toFixed(2) + ' %', fe: true, sig: q.s, ep: q.ep }); });
    res.bolts.forEach(b => { const B = b.b.B, Vr = r.boltV(B).v, Tr = r.boltT(B).v, ip = r.boltVT(B, b.V, b.Nt, Vr, Tr), stk = b.b.stack.map(id => g.plates.find(p => p.id === id)).filter(Boolean), tmin = Math.min(...stk.map(p => p.t)), pmin = stk.find(p => p.t === tmin) || {}, br = r.bear(B, tmin, pmin.fu || 400, 2 * B.d0, 3 * B.d0, 1.5 * B.d0, 3 * B.d0);
      const u = max(b.Nt / Tr, b.V / Vr, ip.u, b.V / br.v); list.push({ grp: 'Bolts', item: b.id, name: 'Bolt ' + b.id + ' ' + B.size + ' ' + B.grade, Ed: b.Nt / 1e3, Rd: Tr / 1e3, unit: 'kN', util: u, ref: r.boltT(B).ref, expr: 'F_t = ' + (b.Nt / 1e3).toFixed(1) + ' / ' + (Tr / 1e3).toFixed(1) + ' kN, V = ' + (b.V / 1e3).toFixed(1) + ' / ' + (Vr / 1e3).toFixed(1) + ' kN, bearing ' + (br.v / 1e3).toFixed(1) + ' kN, interaction ' + ip.u.toFixed(2), fe: true, Nt: b.Nt, V: b.V }); });
    res.welds.forEach(w => { if (!w.pts.length) return; const p = g.plates.find(z => z.id === w.b) || g.plates.find(z => z.id === w.a) || {}; let worst = null;
      w.pts.forEach(q => { const c = w.type === 'butt' ? { u: Math.hypot(q.fn, q.ft, q.fl) / ((p.t || 10) * (p.fy || 355) / (code === 'EN' ? 1 : 1 / 0.9)), x: 'full penetration: f/(t·f_y)' } : r.fillet(w.a, w.sides, q.fn, q.ft, q.fl, C.weldMetal(code, J.mat.weld, p.fu || 490).fu, p.bw || 1); if (!worst || c.u > worst.c.u) worst = { c, q }; });
      list.push({ grp: 'Welds', item: w.id, name: (w.name || w.id) + ' (a = ' + w.a + ' mm, L = ' + w.L.toFixed(0) + ')', Ed: null, Rd: null, unit: '', util: worst.c.u, ref: worst.c.ref || '', expr: worst.c.x + ' — f⊥ = ' + Math.hypot(worst.q.fn, worst.q.ft).toFixed(0) + ', f∥ = ' + worst.q.fl.toFixed(0) + ' N/mm', fe: true }); });
    (res.anchors || []).forEach(a => { const A = a.a.B, Tr = r.ancT(A).v, Vr = r.ancV(A).v, iv = r.ancVT(a.Nt / Tr, a.V / Vr); list.push({ grp: 'Anchors', item: a.id, name: 'Anchor ' + a.id + ' ' + A.size, Ed: a.Nt / 1e3, Rd: Tr / 1e3, unit: 'kN', util: max(a.Nt / Tr, a.V / Vr, iv.u), ref: r.ancT(A).ref, expr: 'N = ' + (a.Nt / 1e3).toFixed(1) + ' / ' + (Tr / 1e3).toFixed(1) + ' kN, V = ' + (a.V / 1e3).toFixed(1) + ' / ' + (Vr / 1e3).toFixed(1) + ' kN', fe: true }); });
    if (res.conc && g.conc) { const fb = r.bearC(g.conc.fc, g.conc.L * g.conc.B, g.conc.pedB * g.conc.pedL), pav = res.conc.area ? res.conc.force / res.conc.area : 0; add('Concrete', 'CB', 'Concrete in compression (average over the contact area ' + (res.conc.area / 100).toFixed(0) + ' cm²)', pav, fb.v, 'MPa', fb.ref, fb.x + '; peak ' + res.conc.pmax.toFixed(1) + ' MPa'); }
    return list;
  }

  C.fe = { run, checks, mesh, build, _t: { kLocal, prepEl, fInt, Bmats, Sky, stations, graded, inv2 } };
})(typeof window !== 'undefined' ? window : globalThis);
