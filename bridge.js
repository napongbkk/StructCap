// StructCap — bridge analysis: vehicle library, moving-load envelopes from influence lines, construction stages,
// bridge load combinations. Uses G.FRAME (frame.js). Units: kN, m.
(function (G) {
  'use strict';
  const F = () => G.FRAME;
  const COMPS = ['N', 'Vy', 'Vz', 'T', 'My', 'Mz', 'dz'];

  // ------------------------------------------------------------------ vehicle library
  // axles: [offset from the front axle (m), load (kN)]; vary: gap after axle index i may grow from min to max
  const M16 = [0, 1.25, 2.5, 6.25, 7.5, 8.75, 15, 16.25, 17.5, 22.5, 23.75, 25];
  const VEH = {
    M1600: { name: 'AS 5100 M1600 moving traffic', code: 'AS', axles: M16.map(x => [x, 120]), vary: { after: 5, min: 6.25, max: 14.25, step: 2 }, udl: 6, dla: 0.3, dlaUdl: true },
    S1600: { name: 'AS 5100 S1600 stationary traffic', code: 'AS', axles: M16.map(x => [x, 80]), vary: { after: 5, min: 6.25, max: 14.25, step: 2 }, udl: 24, dla: 0, dlaUdl: false },
    A160: { name: 'AS 5100 A160 axle', code: 'AS', axles: [[0, 160]], udl: 0, dla: 0.4, dlaUdl: false },
    LM1: { name: 'EN 1991-2 LM1 tandem (per lane class)', code: 'EN', axles: [[0, 1], [1.2, 1]], udl: 0, dla: 0, dlaUdl: false, unit: true },
    HL93T: { name: 'AASHTO HL-93 design truck + lane', code: 'HL93', axles: [[0, 35], [4.3, 145], [8.6, 145]], vary: { after: 1, min: 4.3, max: 9.0, step: 0.94 }, udl: 9.3, dla: 0.33, dlaUdl: false },
    HL93D: { name: 'AASHTO HL-93 design tandem + lane', code: 'HL93', axles: [[0, 110], [1.2, 110]], udl: 9.3, dla: 0.33, dlaUdl: false },
    HS20: { name: 'AASHTO HS20-44 truck (Thai DOH practice)', code: 'HS20', axles: [[0, 35.6], [4.27, 142.3], [8.54, 142.3]], vary: { after: 1, min: 4.27, max: 9.14, step: 0.974 }, udl: 0, dla: 0.3, dlaUdl: false },
    HS20L: { name: 'AASHTO HS20-44 lane (9.34 kN/m + 80 kN)', code: 'HS20', axles: [[0, 80]], udl: 9.34, dla: 0.3, dlaUdl: true }
  };
  // lane classes: s = axle scale, q = lane UDL (kN/m, null = vehicle UDL), f(n, k) = factor for the k-th lane when n lanes are loaded
  const SCHEMES = {
    AS: { name: 'AS 5100.2 — accompanying lane factors 1.0, 0.8, 0.4', cls: k => ({ s: 1, q: null }), f: (n, k) => [1, 0.8][k] || 0.4 },
    EN: { name: 'EN 1991-2 LM1 — lanes 1/2/3: 300/200/100 kN axles, 27/7.5/7.5 kN/m', cls: k => ({ s: [300, 200, 100][k] || 0, q: k === 0 ? 27 : 7.5 }), f: () => 1 },
    HL93: { name: 'AASHTO LRFD — multiple presence 1.2, 1.0, 0.85, 0.65', cls: () => ({ s: 1, q: null }), f: n => [1.2, 1.0, 0.85][n - 1] || 0.65 },
    HS20: { name: 'AASHTO Standard (HS20-44) — 1.0, 1.0, 0.9, 0.75', cls: () => ({ s: 1, q: null }), f: n => (n <= 2 ? 1 : n === 3 ? 0.9 : 0.75) },
    USER: { name: 'User — every lane factor 1.0', cls: () => ({ s: 1, q: null }), f: () => 1 }
  };
  const vehicle = (model, id) => { const u = ((model.bridge || {}).vehicles || []).find(v => v.id === id); return u ? Object.assign({ udl: 0, dla: 0, dlaUdl: false }, u, { axles: (u.axles || []).map(a => [+a[0] || 0, +a[1] || 0]) }) : VEH[id] ? Object.assign({ id }, VEH[id]) : null; };
  // axle-spacing variants of a vehicle (variable gap)
  function variants(v) {
    const ax = v.axles.slice().sort((a, b) => a[0] - b[0]); if (!v.vary) return [ax];
    const out = [], i = v.vary.after, g0 = ax[i + 1][0] - ax[i][0];
    for (let g = v.vary.min; g <= v.vary.max + 1e-9; g += v.vary.step || 1) out.push(ax.map((a, k) => [k > i ? a[0] + (g - g0) : a[0], a[1]]));
    return out.length ? out : [ax];
  }

  // ------------------------------------------------------------------ influence data per lane
  // lane: {id, a:[member ids], b:[member ids] | null, w: share carried by path b (0–1)}
  function lanePaths(model) {
    const out = {}; ((model.bridge || {}).lanes || []).forEach(l => { [l.a, l.b].forEach(p => { if (p && p.length) out[p.join('|')] = p; }); });
    return Object.entries(out).map(([id, mems]) => ({ id, mems }));
  }
  function influence(model, opt) { return F().influence(model, Object.assign({ paths: lanePaths(model), ds: 0.5, nps: 4 }, opt || {})); }
  // rows = result channels: members × comps × points, then supported reaction DOFs
  function channels(model, inf) {
    const np = inf.nps + 1, nm = inf.memIds.length, NC = 7, rd = [];
    model.nodes.forEach((n, i) => { const fx = F().fixOf(n); for (let d = 0; d < 6; d++) if (fx[d] || +n[['kx', 'ky', 'kz', 'krx', 'kry', 'krz'][d]] > 0) rd.push(6 * i + d); });
    return { np, nm, NC, nMem: nm * NC * np, rd, n: nm * NC * np + rd.length };
  }
  // lane influence matrix, station-major: M[k * n + c] = channel c for a unit load at station k (path a grid)
  function laneIL(model, inf, lane, ch) {
    const pa = inf.paths[(lane.a || []).join('|')]; if (!pa) return null;
    const pb = lane.b && lane.b.length ? inf.paths[lane.b.join('|')] : null, w = pb ? Math.max(0, Math.min(1, +lane.w || 0)) : 0;
    const ns = pa.nst + 1, n = ch.n, M = new Float64Array(n * ns), per = ch.nm * ch.NC * ch.np, rd = ch.rd;
    for (let k = 0; k < ns; k++) {
      const o = k * n, da = k * per, ra = k * inf.nd;
      for (let c = 0; c < ch.nMem; c++) M[o + c] = pa.data[da + c];
      for (let j = 0; j < rd.length; j++) M[o + ch.nMem + j] = pa.R[ra + rd[j]];
      if (pb) {
        const x = (pa.S[k] / pa.L * pb.L) / pb.ds, kb = Math.min(pb.nst - 1, Math.floor(x)), tb = Math.min(1, x - kb), d0 = kb * per, d1 = d0 + per, r0 = kb * inf.nd, r1 = r0 + inf.nd;
        for (let c = 0; c < ch.nMem; c++) M[o + c] = (1 - w) * M[o + c] + w * ((1 - tb) * pb.data[d0 + c] + tb * pb.data[d1 + c]);
        for (let j = 0; j < rd.length; j++) M[o + ch.nMem + j] = (1 - w) * M[o + ch.nMem + j] + w * ((1 - tb) * pb.R[r0 + rd[j]] + tb * pb.R[r1 + rd[j]]);
      }
    }
    return { M, ns, ds: pa.ds, L: pa.L, S: pa.S, n };
  }
  // at most three spacing variants (shortest, middle, longest gap) keep the search fast
  const variants3 = v => { const all = variants(v); return all.length <= 3 ? all : [all[0], all[Math.floor(all.length / 2)], all[all.length - 1]]; };
  // max / min of Σ P·IL over all positions and both directions, for one vehicle: a coarse sweep of every channel at once
  // (vehicle front at 2·ds steps) keeps the K best separated positions per channel, then a fine search (ds/2) around each
  const K = 3;
  function keepHi(V, X, o, s, x0, sep) { // V/X: K candidates per channel, best first; a nearby candidate is replaced, not duplicated
    let j = 0; for (; j < K; j++) { const xj = X[o + j]; if (xj === xj && (xj - x0 <= sep && x0 - xj <= sep)) break; }
    if (j < K) { if (s <= V[o + j]) return; V[o + j] = s; X[o + j] = x0; } else { j = K - 1; V[o + j] = s; X[o + j] = x0; }
    for (; j > 0 && V[o + j] > V[o + j - 1]; j--) { const v = V[o + j]; V[o + j] = V[o + j - 1]; V[o + j - 1] = v; const x = X[o + j]; X[o + j] = X[o + j - 1]; X[o + j - 1] = x; }
  }
  function keepLo(V, X, o, s, x0, sep) {
    let j = 0; for (; j < K; j++) { const xj = X[o + j]; if (xj === xj && (xj - x0 <= sep && x0 - xj <= sep)) break; }
    if (j < K) { if (s >= V[o + j]) return; V[o + j] = s; X[o + j] = x0; } else { j = K - 1; V[o + j] = s; X[o + j] = x0; }
    for (; j > 0 && V[o + j] < V[o + j - 1]; j--) { const v = V[o + j]; V[o + j] = V[o + j - 1]; V[o + j - 1] = v; const x = X[o + j]; X[o + j] = X[o + j - 1]; X[o + j - 1] = x; }
  }
  function vehicleExtremes(IL, ch, v) {
    const n = IL.n, ns = IL.ns, ds = IL.ds, L = IL.L, M = IL.M, vmax = new Float64Array(n), vmin = new Float64Array(n), acc = new Float64Array(n);
    const VX = new Float64Array(n * K), XX = new Float64Array(n * K), VN = new Float64Array(n * K), XN = new Float64Array(n * K);
    const at1 = (ax, x0, dir, c) => { let s = 0; for (const [o, P] of ax) { const x = x0 - dir * o; if (x < -1e-9 || x > L + 1e-9 || !P) continue; const t = Math.min(ns - 1 - 1e-9, Math.max(0, x / ds)), k = Math.floor(t), f = t - k; s += P * ((1 - f) * M[k * n + c] + (f > 1e-12 ? f * M[(k + 1) * n + c] : 0)); } return s; };
    variants3(v).forEach(ax => {
      const len = ax[ax.length - 1][0], hc = 2 * ds, npos = Math.ceil((L + len) / hc) + 1, sep = 1.5 * hc;
      [1, -1].forEach(dir => {
        VX.fill(0); VN.fill(0); XX.fill(NaN); XN.fill(NaN);
        for (let p = 0; p < npos; p++) {
          const x0 = dir > 0 ? p * hc : L - p * hc; let any = false; acc.fill(0);
          for (const [o, P] of ax) {
            const x = x0 - dir * o; if (x < -1e-9 || x > L + 1e-9 || !P) continue;
            const t = Math.min(ns - 1 - 1e-9, Math.max(0, x / ds)), k = Math.floor(t), f = t - k, w0 = P * (1 - f), w1 = P * f, r0 = k * n, r1 = r0 + n; any = true;
            if (f > 1e-12) for (let c = 0; c < n; c++) acc[c] += w0 * M[r0 + c] + w1 * M[r1 + c]; else for (let c = 0; c < n; c++) acc[c] += w0 * M[r0 + c];
          }
          if (!any) continue;
          for (let c = 0; c < n; c++) { const s2 = acc[c], o = c * K; if (s2 > VX[o + K - 1]) keepHi(VX, XX, o, s2, x0, sep); else if (s2 < VN[o + K - 1]) keepLo(VN, XN, o, s2, x0, sep); }
        }
        for (let c = 0; c < n; c++) {
          const o = c * K; let a = VX[o], b = VN[o];
          for (let j = 0; j < K; j++) {
            const xa = XX[o + j], xb = XN[o + j];
            if (xa === xa) for (let d = -hc; d <= hc + 1e-9; d += ds / 2) { const s2 = at1(ax, xa + d, dir, c); if (s2 > a) a = s2; }
            if (xb === xb) for (let d = -hc; d <= hc + 1e-9; d += ds / 2) { const s2 = at1(ax, xb + d, dir, c); if (s2 < b) b = s2; }
          }
          if (a > vmax[c]) vmax[c] = a; if (b < vmin[c]) vmin[c] = b;
        }
      });
    });
    return { vmax, vmin };
  }
  function udlPatch(IL, ch) {
    const ns = IL.ns, ds = IL.ds, n = IL.n, M = IL.M, up = new Float64Array(n), un = new Float64Array(n);
    // Simpson weights (trapezoid on a last odd interval) applied to the positive and negative parts of the influence line
    const W = new Float64Array(ns), nI = ns - 1, nS = nI - (nI % 2);
    for (let k = 0; k <= nS; k++) W[k] += (k === 0 || k === nS ? 1 : k % 2 ? 4 : 2) * ds / 3;
    if (nI % 2) { W[nI - 1] += ds / 2; W[nI] += ds / 2; }
    for (let k = 0; k < ns; k++) { const o = k * n, w = W[k]; for (let c = 0; c < n; c++) { const y = M[o + c]; if (y > 0) up[c] += y * w; else un[c] += y * w; } }
    return { up, un };
  }
  // moving-load case → envelope {kind:'env', mem:[{id,L,x,Nmax,Nmin,…,dzmax,dzmin}], R:{d:[min,max]}}
  function movingEnvelope(model, inf, mlc) {
    const ch = channels(model, inf), sch = SCHEMES[mlc.code] || SCHEMES.USER;
    const lanes = ((model.bridge || {}).lanes || []).filter(l => !mlc.lanes || !mlc.lanes.length || mlc.lanes.includes(l.id));
    const vehs = (mlc.veh || []).map(id => vehicle(model, id)).filter(Boolean);
    if (!lanes.length) throw new Error((mlc.name || mlc.id) + ': no traffic lanes defined.');
    if (!vehs.length) throw new Error((mlc.name || mlc.id) + ': no vehicle chosen.');
    const nL = lanes.length, maxE = [], minE = []; // [lane][class] → Float64Array
    const memo = {};
    lanes.forEach(lane => {
      const key = (lane.a || []).join('|') + '#' + ((lane.b || []).join('|')) + '#' + (+lane.w || 0);
      if (!memo[key]) { const IL = laneIL(model, inf, lane, ch); if (!IL) throw new Error('Lane ' + lane.id + ': its path is not in the model.'); memo[key] = { ud: udlPatch(IL, ch), ex: vehs.map(v => ({ v, e: vehicleExtremes(IL, ch, v) })) }; }
      const { ud, ex } = memo[key];
      const mx = [], mn = [];
      for (let k = 0; k < nL; k++) {
        const cl = sch.cls(k), a = new Float64Array(ch.n).fill(-Infinity), b = new Float64Array(ch.n).fill(Infinity);
        ex.forEach(({ v, e }) => {
          const fa = cl.s * (1 + (+mlc.dla >= 0 && mlc.dla !== '' && mlc.dla != null ? +mlc.dla : v.dla)), q = cl.q != null ? cl.q : v.udl, fu = q * (1 + (v.dlaUdl ? (mlc.dla !== '' && mlc.dla != null ? +mlc.dla : v.dla) : 0));
          for (let c = 0; c < ch.n; c++) { const hi = fa * Math.max(0, e.vmax[c]) + fu * ud.up[c], lo = fa * Math.min(0, e.vmin[c]) + fu * ud.un[c]; if (hi > a[c]) a[c] = hi; if (lo < b[c]) b[c] = lo; }
        });
        mx.push(a); mn.push(b);
      }
      maxE.push(mx); minE.push(mn);
    });
    // combine lanes: for n loaded lanes, assign lane classes greedily to the most adverse lanes
    const tmax = new Float64Array(ch.n), tmin = new Float64Array(ch.n);
    for (let c = 0; c < ch.n; c++) {
      let best = 0, worst = 0;
      for (let n = 1; n <= nL; n++) {
        let s1 = 0, s2 = 0; const u1 = new Set(), u2 = new Set();
        for (let k = 0; k < n; k++) {
          let li = -1, lv = -Infinity, lj = -1, lw = Infinity;
          for (let l = 0; l < nL; l++) { if (!u1.has(l) && maxE[l][k][c] > lv) { lv = maxE[l][k][c]; li = l; } if (!u2.has(l) && minE[l][k][c] < lw) { lw = minE[l][k][c]; lj = l; } }
          u1.add(li); u2.add(lj); s1 += sch.f(n, k) * Math.max(0, lv); s2 += sch.f(n, k) * Math.min(0, lw);
        }
        if (s1 > best) best = s1; if (s2 < worst) worst = s2;
      }
      tmax[c] = best; tmin[c] = worst;
    }
    const mem = inf.memIds.map((id, mi) => {
      const e = { id, L: inf.L[mi], x: inf.x[mi] };
      COMPS.forEach((q, ci) => { const o = (mi * ch.NC + ci) * ch.np; e[q + 'max'] = Array.from(tmax.subarray(o, o + ch.np)); e[q + 'min'] = Array.from(tmin.subarray(o, o + ch.np)); });
      e.Vmax = e.Vymax; e.Vmin = e.Vymin; e.Mmax = e.Mzmax; e.Mmin = e.Mzmin;
      return e;
    });
    const R = {}; for (let d = 0; d < 6 * model.nodes.length; d++) R[d] = [0, 0];
    ch.rd.forEach((d, j) => { R[d] = [tmin[ch.nMem + j], tmax[ch.nMem + j]]; });
    return { kind: 'env', moving: true, mem, R, n: nL, lanes: nL, vehicles: vehs.map(v => v.name || v.id) };
  }
  // influence line of one result along a lane: target {k:'m', mem, comp, pt} | {k:'r', node, dof}
  function lineOf(model, inf, lane, tg) {
    const ch = channels(model, inf), IL = laneIL(model, inf, lane, ch); if (!IL) return null;
    let c;
    if (tg.k === 'r') { const i = model.nodes.findIndex(n => n.id === tg.node); c = ch.nMem + ch.rd.indexOf(6 * i + (+tg.dof || 0)); if (c < ch.nMem) return null; }
    else { const mi = inf.memIds.indexOf(tg.mem), ci = COMPS.indexOf(tg.comp); if (mi < 0 || ci < 0) return null; c = (mi * ch.NC + ci) * ch.np + Math.max(0, Math.min(ch.np - 1, +tg.pt || 0)); }
    const y = []; for (let k = 0; k < IL.ns; k++) y.push(IL.M[k * IL.n + c]);
    return { s: IL.S.slice(), y, L: IL.L };
  }

  // ------------------------------------------------------------------ construction stages (linear, cumulative)
  // stage: {id, name, mems:[ids activated], cases:[case ids applied in this stage], sw: self-weight of the new members}
  function stageRun(model, opt) {
    const stages = (model.bridge || {}).stages || []; if (!stages.length) return [];
    const out = [], active = new Set(), cum = { mem: {}, R: new Float64Array(6 * model.nodes.length), u: new Float64Array(6 * model.nodes.length) };
    const idx = {}; model.nodes.forEach((n, i) => { idx[n.id] = i; });
    stages.forEach((st, si) => {
      const fresh = (st.mems || []).filter(id => !active.has(id) && model.members.some(q => q.id === id)); fresh.forEach(id => active.add(id));
      const mems = model.members.filter(q => active.has(q.id)), used = new Set(); mems.forEach(q => { used.add(q.i); used.add(q.j); });
      if (!mems.length) { out.push({ id: st.id, name: st.name, empty: true, mem: [], R: cum.R.slice(), u: cum.u.slice() }); return; }
      const nodes = model.nodes.filter(n => used.has(n.id)), ok = new Set(mems.map(q => q.id));
      const loads = model.loads.filter(l => (st.cases || []).includes(l.case) && (l.kind === 'node' || l.kind === 'settle' ? used.has(l.node) : ok.has(l.member))).map(l => Object.assign({}, l, { case: '__S' }));
      if (st.sw) fresh.forEach(id => { const q = model.members.find(z => z.id === id), s = model.sections.find(z => z.id === q.sec), t = model.materials.find(z => z.id === q.mat); if (!s || !t) return; const w = F().secProps(s).A * 1e-6 * (+t.rho || 0); if (w) loads.push({ case: '__S', kind: 'udl', member: id, dir: 'grav', w1: w, w2: '', a: '', b: '' }); });
      const sub = Object.assign({}, model, { nodes, members: mems, loads, cases: [{ id: '__S', name: st.name, sw: false }], combos: [] });
      let r; try { r = F().analyse(sub, { nps: 20 }).cases.__S; } catch (e) { throw new Error('Stage ' + (st.name || st.id) + ': ' + e.message); }
      // accumulate (members by id, nodes mapped to the full model)
      r.mem.forEach(m => { const p = cum.mem[m.id]; if (!p) { cum.mem[m.id] = JSON.parse(JSON.stringify(m)); return; } ['N', 'Vy', 'Vz', 'T', 'My', 'Mz', 'dx', 'dy', 'dz', 'dv', 'dw', 'drel', 'drelz'].forEach(q => { if (p[q] && m[q]) for (let i = 0; i < p[q].length; i++) p[q][i] += m[q][i]; }); });
      nodes.forEach((n, j) => { const i = idx[n.id]; for (let d = 0; d < 6; d++) { cum.R[6 * i + d] += r.R[6 * j + d]; cum.u[6 * i + d] += r.u[6 * j + d]; } });
      const mem = model.members.filter(q => cum.mem[q.id]).map(q => { const m = JSON.parse(JSON.stringify(cum.mem[q.id])); m.V = m.Vy; m.M = m.Mz; return m; });
      out.push({ id: st.id, name: st.name, stage: si + 1, mem, R: cum.R.slice(), u: cum.u.slice(), active: [...active] });
    });
    return out;
  }

  // ------------------------------------------------------------------ bridge combinations: Σ f·case (+ stage result) + Σ f·moving envelope
  function sampleAt(arr, xFrom, xTo) { // linear interpolation of a static diagram at the envelope points
    return xTo.map(x => { let k = 0; while (k < xFrom.length - 2 && xFrom[k + 1] < x - 1e-9) k++; const a = xFrom[k], b = xFrom[k + 1], t = b > a ? (x - a) / (b - a) : 0; return arr[k] + (arr[k + 1] - arr[k]) * Math.max(0, Math.min(1, t)); });
  }
  function combine(model, res, mlRes, stRes, bc) {
    const parts = Object.entries(bc.f || {}).filter(([k, v]) => +v && res.cases[k]).map(([k, v]) => [res.cases[k], +v]);
    const stg = bc.stage && stRes ? stRes.find(s => s.id === bc.stage) : null;
    const mls = Object.entries(bc.ml || {}).filter(([k, v]) => +v && mlRes[k]).map(([k, v]) => [mlRes[k], +v]);
    const ref = mls.length ? mls[0][0] : null;
    const mem = model.members.map((q, mi) => {
      const m0 = ref ? ref.mem.find(z => z.id === q.id) : null, base = parts.length ? parts[0][0].mem.find(z => z.id === q.id) : stg ? stg.mem.find(z => z.id === q.id) : null;
      const x = m0 ? m0.x : base ? base.x : null; if (!x) return null;
      const e = { id: q.id, L: (m0 || base).L, x };
      COMPS.forEach(c => {
        const st = x.map(() => 0);
        parts.forEach(([r, f]) => { const mm = r.mem.find(z => z.id === q.id); if (mm && mm[c]) sampleAt(mm[c], mm.x, x).forEach((v, i) => { st[i] += f * v; }); });
        if (stg) { const mm = stg.mem.find(z => z.id === q.id); if (mm && mm[c]) sampleAt(mm[c], mm.x, x).forEach((v, i) => { st[i] += v; }); }
        const hi = st.slice(), lo = st.slice();
        mls.forEach(([r, f]) => { const mm = r.mem.find(z => z.id === q.id); if (!mm) return; x.forEach((_, i) => { const a = f * mm[c + 'max'][i], b = f * mm[c + 'min'][i]; hi[i] += Math.max(a, b); lo[i] += Math.min(a, b); }); });
        e[c + 'max'] = hi; e[c + 'min'] = lo;
      });
      e.Vmax = e.Vymax; e.Vmin = e.Vymin; e.Mmax = e.Mzmax; e.Mmin = e.Mzmin;
      return e;
    }).filter(Boolean);
    const R = {}; for (let d = 0; d < 6 * model.nodes.length; d++) {
      let s = 0; parts.forEach(([r, f]) => { s += f * r.R[d]; }); if (stg) s += stg.R[d];
      let a = s, b = s; mls.forEach(([r, f]) => { const v = r.R[d] || [0, 0]; const p = f * v[0], q = f * v[1]; a += Math.min(p, q); b += Math.max(p, q); });
      R[d] = [a, b];
    }
    return { kind: 'env', bridge: true, mem, R, n: 1, name: bc.name };
  }

  // ------------------------------------------------------------------ run everything for a model with model.bridge
  function run(model, res) {
    const B = model.bridge || {}, out = { ml: {}, st: [], bc: {}, warn: [], inf: null, ms: 0 }, t0 = Date.now();
    if ((B.mlc || []).length && (B.lanes || []).length) {
      out.inf = influence(model);
      B.mlc.forEach(c => { try { out.ml[c.id] = Object.assign(movingEnvelope(model, out.inf, c), { name: c.name }); } catch (e) { out.warn.push(e.message); } });
    }
    try { out.st = stageRun(model); } catch (e) { out.warn.push(e.message); }
    (B.bcombos || []).forEach(bc => { try { out.bc[bc.id] = combine(model, res, out.ml, out.st, bc); } catch (e) { out.warn.push((bc.name || bc.id) + ': ' + e.message); } });
    out.ms = Date.now() - t0;
    return out;
  }

  G.BRIDGE = { VEH, SCHEMES, vehicle, variants, influence, channels, laneIL, movingEnvelope, lineOf, stageRun, combine, run, lanePaths };
})(typeof window !== 'undefined' ? window : globalThis);
