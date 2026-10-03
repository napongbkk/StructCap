/* StructCap Building — engine for the building module (pure, no DOM):
   grids and stories, floor loads spread to the beams by tributary area, rigid floor diaphragms,
   automatic wind loads (AS/NZS 1170.2:2021, EN 1991-1-4, Thai DPT 1311-50), story results, and the
   3D quantity take-off used by every analysis mode. Units: kN, m, kPa (slab thickness and sections in mm). */
(function (G) {
  'use strict';
  const r4 = v => Math.round(v * 1e4) / 1e4, TOL = 1e-3;
  const interp = (tb, x) => { if (x <= tb[0][0]) return tb[0][1]; for (let i = 1; i < tb.length; i++) if (x <= tb[i][0]) return tb[i - 1][1] + (tb[i][1] - tb[i - 1][1]) * (x - tb[i - 1][0]) / (tb[i][0] - tb[i - 1][0]); return tb[tb.length - 1][1]; };
  const clone = o => JSON.parse(JSON.stringify(o));

  // ------------------------------------------------------------------ data defaults
  function windDefaults(std) {
    return {
      on: true, code: std === 'EC' ? 'EN' : std === 'TH' ? 'TH' : 'AS', X: true, Y: true, neg: true, par: 0,
      cases: { X: 'WX', Y: 'WY', XN: 'WXN', YN: 'WYN' },
      AS: { region: 'A', R: 500, tc: '3', Md: 1, Ms: 1, Mt: 1, Ka: 1, Kc: 1, Cdyn: 1, cpw: '', cpl: '' },
      EN: { vb0: 25, cdir: 1, cseason: 1, tc: 'III', cscd: 1, cpw: '', cpl: '' },
      TH: { zone: '1', imp: 'normal', exp: 'B', Cg: 2, cpw: 0.8, cpl: -0.5 }
    };
  }
  function bld(m) { // make sure m.bld has every field
    if (!m.bld) m.bld = {};
    const b = m.bld;
    ['gx', 'gy', 'stories', 'slabs'].forEach(k => { if (!Array.isArray(b[k])) b[k] = []; });
    b.floor = Object.assign({ dl: 'G', ll: 'Q', sw: true, mat: '', way: 'auto' }, b.floor || {});
    const wd = windDefaults(m.std);
    b.wind = Object.assign(wd, b.wind || {}); ['AS', 'EN', 'TH', 'cases'].forEach(k => { b.wind[k] = Object.assign(wd[k], (b.wind || {})[k] || {}); });
    if (b.dia === undefined) b.dia = true;
    return b;
  }
  const stories = m => (m.bld && m.bld.stories || []).slice().sort((a, b) => a.z - b.z);
  const storyAt = (m, z) => stories(m).find(s => Math.abs(s.z - z) < TOL) || null;
  const nodeMap = m => { const o = {}; m.nodes.forEach(n => { o[n.id] = n; }); return o; };
  const P3 = n => [+n.x || 0, +n.y || 0, +n.z || 0];

  // ------------------------------------------------------------------ floor loads → beams (tributary area)
  // slab: { id, st (story id), x0, x1, y0, y1 (m), t (mm), sdl, ll (kPa), way: auto | two | oneX | oneY }
  //   two-way: 45° yield lines → trapezoids on the long edges, triangles on the short ones
  //   one-way X (spans in X): the load goes to the edges at x0 and x1, q·Lx/2 each
  function slabWay(s) { const Lx = s.x1 - s.x0, Ly = s.y1 - s.y0, w = s.way || 'auto'; if (w !== 'auto') return w; const r = Math.max(Lx, Ly) / Math.min(Lx, Ly); return r >= 2 ? (Lx < Ly ? 'oneX' : 'oneY') : 'two'; }
  // the four edges of a slab: line, coordinate along it, and the load profile (kN/m per kPa) as breakpoints
  function slabEdges(s) {
    const Lx = s.x1 - s.x0, Ly = s.y1 - s.y0, way = slabWay(s), h = Math.min(Lx, Ly) / 2;
    const prof = (Le, act, uni) => !act ? null : uni != null ? [[0, uni], [Le, uni]] : [[0, 0], [h, h], [Le - h, h], [Le, 0]];
    const tw = way === 'two', ox = way === 'oneX', oy = way === 'oneY';
    return [
      { k: 'S', ax: 'x', c: s.y0, o: s.x0, L: Lx, prof: prof(Lx, tw || oy, oy ? Ly / 2 : null) },
      { k: 'N', ax: 'x', c: s.y1, o: s.x0, L: Lx, prof: prof(Lx, tw || oy, oy ? Ly / 2 : null) },
      { k: 'W', ax: 'y', c: s.x0, o: s.y0, L: Ly, prof: prof(Ly, tw || ox, ox ? Lx / 2 : null) },
      { k: 'E', ax: 'y', c: s.x1, o: s.y0, L: Ly, prof: prof(Ly, tw || ox, ox ? Lx / 2 : null) }
    ];
  }
  const profAt = (p, s) => interp(p, s);
  // members lying on an edge line at level z: [{mem, s0 (along edge at node i), s1 (at node j)}]
  function edgeMembers(m, nd, z, e, byLevel) {
    const out = [], list = byLevel ? byLevel.get(r4(z)) || [] : m.members;
    list.forEach(q => {
      const a = nd[q.i], b = nd[q.j]; if (!a || !b) return;
      if (Math.abs(+a.z - z) > TOL || Math.abs(+b.z - z) > TOL) return;
      const ca = e.ax === 'x' ? +a.y : +a.x, cb = e.ax === 'x' ? +b.y : +b.x; if (Math.abs(ca - e.c) > TOL || Math.abs(cb - e.c) > TOL) return;
      const sa = (e.ax === 'x' ? +a.x : +a.y) - e.o, sb = (e.ax === 'x' ? +b.x : +b.y) - e.o;
      if (Math.min(sa, sb) >= e.L - TOL || Math.max(sa, sb) <= TOL) return;
      out.push({ mem: q, s0: sa, s1: sb });
    });
    return out;
  }
  function levelIndex(m, nd) { const mp = new Map(); m.members.forEach(q => { const a = nd[q.i], b = nd[q.j]; if (!a || !b || Math.abs(+a.z - +b.z) > TOL) return; const k = r4(+a.z); if (!mp.has(k)) mp.set(k, []); mp.get(k).push(q); }); return mp; }
  // slab self-weight density (kN/m³)
  function slabRho(m) { const b = bld(m), mt = m.materials.find(t => t.id === b.floor.mat) || m.materials.find(t => t.kind === 'conc'); return mt && +mt.rho > 0 ? +mt.rho : 24; }
  function slabLoads(m) {
    const b = bld(m), nd = nodeMap(m), byL = levelIndex(m, nd), acc = new Map(), nodal = new Map(), warn = [];
    const swCase = (m.cases.find(c => c.sw) || {}).id, rho = slabRho(m);
    const add = (mem, cs, a, bb, w1, w2) => { const k = mem.id + '|' + cs; if (!acc.has(k)) acc.set(k, { mem, cs, segs: [] }); acc.get(k).segs.push([a, bb, w1, w2]); };
    const addN = (id, cs, fz) => { const k = id + '|' + cs; nodal.set(k, (nodal.get(k) || 0) + fz); };
    b.slabs.forEach(s => {
      const st = b.stories.find(q => q.id === s.st); if (!st) return; const z = +st.z;
      const qs = []; if (+s.sdl) qs.push([b.floor.dl, +s.sdl]); if (+s.ll) qs.push([b.floor.ll, +s.ll]); if (b.floor.sw && swCase && +s.t > 0) qs.push([swCase, rho * s.t / 1000]);
      if (!qs.length || !(s.x1 > s.x0) || !(s.y1 > s.y0)) return;
      let lost = 0;
      slabEdges(s).forEach(e => {
        if (!e.prof) return;
        const em = edgeMembers(m, nd, z, e, byL), brk = e.prof.map(p => p[0]);
        // covered intervals
        const cov = [];
        em.forEach(({ mem, s0, s1 }) => {
          const lo = Math.max(0, Math.min(s0, s1)), hi = Math.min(e.L, Math.max(s0, s1)); if (hi - lo < 1e-6) return; cov.push([lo, hi]);
          const cuts = [lo, ...brk.filter(x => x > lo + 1e-9 && x < hi - 1e-9), hi];
          for (let k = 0; k + 1 < cuts.length; k++) {
            const sa = cuts[k], sb = cuts[k + 1], wa = profAt(e.prof, sa), wb = profAt(e.prof, sb);
            const ta = Math.abs(sa - s0), tb = Math.abs(sb - s0); // distance from node i
            qs.forEach(([cs, q]) => add(mem, cs, Math.min(ta, tb), Math.max(ta, tb), q * (ta < tb ? wa : wb), q * (ta < tb ? wb : wa)));
          }
        });
        // uncovered parts: lumped to the corner nodes of the edge (lever rule), if they exist
        cov.sort((p, q) => p[0] - q[0]); const gaps = []; let at = 0; cov.forEach(([lo, hi]) => { if (lo > at + 1e-6) gaps.push([at, lo]); at = Math.max(at, hi); }); if (at < e.L - 1e-6) gaps.push([at, e.L]);
        gaps.forEach(([lo, hi]) => {
          const n = 8; let F = 0, Fs = 0; for (let i = 0; i < n; i++) { const s0 = lo + (hi - lo) * (i + 0.5) / n, w = profAt(e.prof, s0) * (hi - lo) / n; F += w; Fs += w * s0; }
          if (F < 1e-9) return; const sc = Fs / F, end = s2 => { const x = e.ax === 'x' ? e.o + s2 : e.c, y = e.ax === 'x' ? e.c : e.o + s2; return m.nodes.find(n2 => Math.abs(+n2.x - x) < TOL && Math.abs(+n2.y - y) < TOL && Math.abs(+n2.z - z) < TOL); };
          const n0 = end(0), n1 = end(e.L);
          if (n0 && n1) { const w1 = sc / e.L; qs.forEach(([cs, q]) => { addN(n0.id, cs, -q * F * (1 - w1)); addN(n1.id, cs, -q * F * w1); }); }
          else if (n0 || n1) qs.forEach(([cs, q]) => addN((n0 || n1).id, cs, -q * F));
          else lost += F;
        });
      });
      if (lost > 1e-6) warn.push('Slab ' + s.id + ': an edge has no beam and no corner node — part of its load is not applied.');
    });
    // merge the segments of each member and case into piecewise-linear loads
    const out = [];
    acc.forEach(({ mem, cs, segs }) => {
      const xs = [...new Set(segs.flatMap(g => [r4(g[0]), r4(g[1])]))].sort((a, b) => a - b), w = x => segs.reduce((t, g) => t + (x >= g[0] - 1e-7 && x <= g[1] + 1e-7 ? (g[1] - g[0] < 1e-9 ? 0 : g[2] + (g[3] - g[2]) * (x - g[0]) / (g[1] - g[0])) : 0), 0);
      // evaluate each piece just inside its ends (values jump where two slabs meet with different loads)
      const pcs = []; for (let k = 0; k + 1 < xs.length; k++) { const a = xs[k], c = xs[k + 1], e2 = Math.min(1e-6, (c - a) / 10), wa = w(a + e2) - (w(a + 2 * e2) - w(a + e2)), wc = w(c - e2) + (w(c - e2) - w(c - 2 * e2)); pcs.push([a, c, wa, wc]); }
      // join collinear neighbours
      const mg = []; pcs.forEach(p => { const l = mg[mg.length - 1]; if (l && Math.abs(l[3] - p[2]) < 1e-6 && Math.abs((l[3] - l[2]) / (l[1] - l[0]) - (p[3] - p[2]) / (p[1] - p[0])) < 1e-6) { l[1] = p[1]; l[3] = p[3]; } else mg.push(p.slice()); });
      const L = Math.hypot(...[0, 1, 2].map(i => P3(nd[mem.j])[i] - P3(nd[mem.i])[i]));
      mg.forEach(([a, c, wa, wc]) => { if (Math.abs(wa) < 1e-9 && Math.abs(wc) < 1e-9) return; const full = a < 1e-6 && c > L - 1e-6, uni = Math.abs(wa - wc) < 1e-6; out.push({ case: cs, kind: 'udl', member: mem.id, dir: 'grav', w1: r4(wa), w2: uni ? '' : r4(wc), a: full ? '' : r4(a), b: full ? '' : r4(c), gen: 'slab' }); });
    });
    nodal.forEach((fz, k) => { const [id, cs] = k.split('|'); out.push({ case: cs, kind: 'node', node: id, Fx: 0, Fy: 0, Fz: r4(fz), Mx: 0, My: 0, Mz: 0, gen: 'slab' }); });
    return { loads: out, warn };
  }

  // ------------------------------------------------------------------ wind
  const AS_MZ = [[3, [0.99, 0.91, 0.87, 0.83, 0.75]], [5, [1.05, 0.91, 0.87, 0.83, 0.75]], [10, [1.12, 1.0, 0.92, 0.83, 0.75]], [15, [1.16, 1.05, 0.97, 0.89, 0.75]], [20, [1.19, 1.08, 1.01, 0.94, 0.75]], [30, [1.22, 1.12, 1.06, 1.0, 0.8]], [40, [1.24, 1.16, 1.1, 1.04, 0.85]], [50, [1.25, 1.18, 1.13, 1.07, 0.9]], [75, [1.27, 1.22, 1.17, 1.12, 0.98]], [100, [1.29, 1.24, 1.2, 1.16, 1.03]], [150, [1.31, 1.27, 1.24, 1.21, 1.11]], [200, [1.32, 1.29, 1.27, 1.24, 1.16]]];
  const AS_TC = { 1: 0, 2: 1, 2.5: 2, 3: 3, 4: 4 };
  const asMz = (z, tc) => { const c = AS_TC[tc] !== undefined ? AS_TC[tc] : 3; return interp(AS_MZ.map(r => [r[0], r[1][c]]), Math.max(3, Math.min(200, z))); };
  const asVR = (reg, R) => { R = Math.max(5, +R || 500); switch (reg) { case 'W': return 104 - 70 * Math.pow(R, -0.045); case 'B1': case 'B2': return 106 - 92 * Math.pow(R, -0.1); case 'C': return 122 - 104 * Math.pow(R, -0.1); case 'D': return 156 - 142 * Math.pow(R, -0.1); default: return 67 - 41 * Math.pow(R, -0.1); } };
  const EN_TC = { 0: [0.003, 1], I: [0.01, 1], II: [0.05, 2], III: [0.3, 5], IV: [1.0, 10] };
  const TH_ZONE = { 1: [25, 1], 2: [27, 1], 3: [29, 1], '4A': [25, 1.2], '4B': [25, 1.08] }, TH_IW = { low: 0.8, normal: 1, high: 1.15, post: 1.15 };
  // pressures for one wind direction: building height H (above base), crosswind width B, depth D (along the wind)
  // returns { pw(z) kPa windward (+, towards the face), pl kPa leeward (−, suction), info(z), fac (force factor), note, warn[] }
  function windModel(cfg, H, B, D) {
    const c = cfg.code, warn = [];
    if (c === 'EN') {
      const p = cfg.EN, [z0, zmin] = EN_TC[p.tc] || EN_TC.III, kr = 0.19 * Math.pow(z0 / 0.05, 0.07), vb = (+p.vb0 || 0) * (+p.cdir || 1) * (+p.cseason || 1), rho = 1.25;
      const qp = z => { const zz = Math.max(zmin, Math.min(200, z)), lz = Math.log(zz / z0), vm = kr * lz * vb, Iv = 1 / lz; return (1 + 7 * Iv) * 0.5 * rho * vm * vm / 1000; };
      const ze = z => (H <= B ? H : H <= 2 * B ? (z <= B ? B : H) : z <= B ? B : z >= H - B ? H : z);
      const hd = H / Math.max(D, 1e-6), cpD = p.cpw !== '' && p.cpw != null ? +p.cpw : interp([[0.25, 0.7], [1, 0.8], [5, 0.8]], hd), cpE = p.cpl !== '' && p.cpl != null ? +p.cpl : interp([[0.25, -0.3], [1, -0.5], [5, -0.7]], hd);
      const corr = interp([[1, 0.85], [5, 1]], hd), fac = corr * (+p.cscd || 1), qh = qp(H);
      if (!(H < 15) && !(H < 100 && H < 4 * D)) warn.push('EN 1991-1-4 §6.2: cscd = 1 is not covered for this building — check the structural factor (Annex B/C).');
      return { pw: z => qp(ze(z)) * cpD, pl: qh * cpE, fac, info: z => ({ ze: ze(z), qp: qp(ze(z)) }), cp: [cpD, cpE], note: 'EN 1991-1-4: qp(ze)·cpe,D − qp(h)·cpe,E · ' + corr.toFixed(3) + ' (lack of correlation, h/d = ' + hd.toFixed(2) + ') · cscd ' + (+p.cscd || 1), q0: qp(H), warn };
    }
    if (c === 'TH') {
      const p = cfg.TH, zn = TH_ZONE[p.zone] || TH_ZONE[1], V = zn[0] * zn[1], q = 0.5 * 1.25 * V * V / 1000, Iw = TH_IW[p.imp] || 1, Cg = +p.Cg || 2;
      const Ce = z => (p.exp === 'A' ? Math.max(Math.pow(Math.max(z, 0.01) / 10, 0.2), 0.9) : Math.max(0.7 * Math.pow(Math.max(z, 0.01) / 12, 0.3), 0.7));
      const cpw = p.cpw === '' || p.cpw == null ? 0.8 : +p.cpw, cpl = p.cpl === '' || p.cpl == null ? -0.5 : +p.cpl;
      if (H > 80 || H > 3 * Math.min(B, D)) warn.push('DPT 1311-50: the simplified procedure is for H ≤ 80 m and H ≤ 3 × the narrowest width — use the detailed (dynamic) procedure for this building.');
      return { pw: z => Iw * q * Ce(z) * Cg * cpw, pl: Iw * q * Ce(H / 2) * Cg * cpl, fac: 1, info: z => ({ Ce: Ce(z), q }), cp: [cpw, cpl], note: 'DPT 1311-50: p = Iw·q·Ce·Cg·Cp, V = ' + V.toFixed(1) + ' m/s (V50 × TF), q = ' + (q * 1000).toFixed(1) + ' Pa, Iw = ' + Iw + ', Cg = ' + Cg + '; leeward Ce at H/2', q0: q, warn };
    }
    const p = cfg.AS, VR = asVR(p.region, p.R), Mc = ['B2', 'C', 'D'].includes(p.region) ? 1.05 : 1, mult = VR * (+p.Md || 1) * Mc * (+p.Ms || 1) * (+p.Mt || 1);
    const V = z => mult * asMz(z, p.tc), low = H <= 25, cpw = p.cpw !== '' && p.cpw != null ? +p.cpw : low ? 0.7 : 0.8, db = D / Math.max(B, 1e-6), cpl = p.cpl !== '' && p.cpl != null ? +p.cpl : interp([[1, -0.5], [2, -0.3], [4, -0.2]], db);
    const k = (+p.Ka || 1) * (+p.Kc || 1) * (+p.Cdyn || 1), pz = z => 0.6 * V(z) * V(z) * k / 1000;
    if (H > 45) warn.push('AS/NZS 1170.2: buildings this tall may be dynamically sensitive (first frequency < 1 Hz) — check Cdyn (Section 6).');
    return { pw: z => pz(low ? H : z) * cpw, pl: pz(H) * cpl, fac: 1, info: z => ({ Mz: asMz(low ? H : z, p.tc), V: V(low ? H : z) }), cp: [cpw, cpl], note: 'AS/NZS 1170.2: VR = ' + VR.toFixed(1) + ' m/s (Region ' + p.region + ', R = ' + p.R + ' yr)' + (Mc > 1 ? ', Mc = 1.05' : '') + ', TC' + p.tc + '; p = 0.5·ρ·Vdes²·Cp,e·Ka·Kc·Cdyn, ρ = 1.2 kg/m³' + (low ? ' (h ≤ 25 m: windward at z = h)' : ''), q0: pz(H), warn };
  }
  // story-by-story wind forces for direction 'X' or 'Y' (positive sense)
  function windCalc(m, dir) {
    const b = bld(m), w = b.wind, st = stories(m); if (st.length < 2) return null;
    const z0 = st[0].z, lv = st.slice(1), top = lv[lv.length - 1].z, H = top - z0 + (+w.par || 0);
    const ax = dir === 'X' ? 'x' : 'y', cr = dir === 'X' ? 'y' : 'x', nodes = m.nodes.filter(n => +n.z > z0 + TOL);
    if (!nodes.length) return null;
    const ext = (arr, k) => [Math.min(...arr.map(n => +n[k] || 0)), Math.max(...arr.map(n => +n[k] || 0))];
    const [c0, c1] = ext(nodes, cr), [a0, a1] = ext(nodes, ax), B = Math.max(c1 - c0, 0.1), D = Math.max(a1 - a0, 0.1);
    const wm = windModel(w, H, B, D), rows = [];
    lv.forEach((s, k) => {
      const zb = k === 0 ? (z0 + s.z) / 2 : (lv[k - 1].z + s.z) / 2, zt = k === lv.length - 1 ? s.z + (+w.par || 0) : (s.z + lv[k + 1].z) / 2;
      const at = m.nodes.filter(n => Math.abs(+n.z - s.z) < TOL); if (!at.length) { rows.push({ id: s.id, z: s.z, zb, zt, B: 0, pw: 0, pl: 0, Fw: 0, Fl: 0, F: 0 }); return; }
      const [b0, b1] = ext(at, cr), Bk = Math.max(b1 - b0, 0);
      const n = 24; let Fw = 0; for (let i = 0; i < n; i++) { const z = zb + (zt - zb) * (i + 0.5) / n; Fw += wm.pw(z - z0) * (zt - zb) / n; }
      Fw *= Bk * wm.fac; const Fl = -wm.pl * (zt - zb) * Bk * wm.fac;
      rows.push({ id: s.id, z: s.z, zb, zt, B: Bk, pw: wm.pw(s.z - z0), pl: wm.pl, Fw, Fl, F: Fw + Fl, info: wm.info(s.z - z0) });
    });
    let V = 0, M = 0; for (let k = rows.length - 1; k >= 0; k--) { V += rows[k].F; rows[k].V = V; }
    rows.forEach(r => { M += r.F * (r.z - z0); }); const Mb = M;
    return { dir, H, B, D, rows, base: V, Mb, note: wm.note, warn: wm.warn, cp: wm.cp, q0: wm.q0 };
  }
  // nodal wind loads: windward / leeward faces of each level, by tributary width of each column line
  function windLoads(m) {
    const b = bld(m), w = b.wind, out = [], calc = {};
    if (!w.on) return { loads: out, calc };
    [['X', 1], ['Y', 1], ['X', -1], ['Y', -1]].forEach(([dir, sg]) => {
      if (!w[dir] || (sg < 0 && !w.neg)) return;
      const cs = w.cases[dir + (sg < 0 ? 'N' : '')]; if (!cs || !m.cases.some(c => c.id === cs)) return;
      const c = calc[dir] || (calc[dir] = windCalc(m, dir)); if (!c) return;
      const ax = dir === 'X' ? 'x' : 'y', cr = dir === 'X' ? 'y' : 'x', F = dir === 'X' ? 'Fx' : 'Fy';
      c.rows.forEach(r => {
        const at = m.nodes.filter(n => Math.abs(+n.z - r.z) < TOL); if (!at.length || !(r.B > 0)) return;
        const rowsC = new Map(); at.forEach(n => { const k = r4(+n[cr] || 0); if (!rowsC.has(k)) rowsC.set(k, []); rowsC.get(k).push(n); });
        const cs2 = [...rowsC.keys()].sort((p, q) => p - q), lo = cs2[0], hi = cs2[cs2.length - 1], acc = new Map();
        cs2.forEach((cc, i) => {
          const tw = ((i < cs2.length - 1 ? cs2[i + 1] : hi) - (i > 0 ? cs2[i - 1] : lo)) / 2 || (cs2.length === 1 ? r.B : 0); if (!(tw > 0)) return;
          const ns = rowsC.get(cc).sort((p, q) => (+p[ax] || 0) - (+q[ax] || 0)), ww = sg > 0 ? ns[0] : ns[ns.length - 1], lw = sg > 0 ? ns[ns.length - 1] : ns[0], share = tw / r.B;
          acc.set(ww.id, (acc.get(ww.id) || 0) + sg * r.Fw * share); acc.set(lw.id, (acc.get(lw.id) || 0) + sg * r.Fl * share);
        });
        acc.forEach((v, id) => { if (Math.abs(v) < 1e-9) return; const l = { case: cs, kind: 'node', node: id, Fx: 0, Fy: 0, Fz: 0, Mx: 0, My: 0, Mz: 0, gen: 'wind' }; l[F] = r4(v); out.push(l); });
      });
    });
    return { loads: out, calc };
  }
  // replace the generated loads (gen: slab | wind) with fresh ones from the slabs, stories and wind settings
  function sync(m) {
    if (!m.bld) return { warn: [] };
    bld(m);
    const keep = m.loads.filter(l => !l.gen), s = slabLoads(m), wl = windLoads(m);
    m.loads = keep.concat(s.loads, wl.loads);
    return { warn: s.warn.concat(...Object.values(wl.calc).filter(Boolean).map(c => c.warn)), nSlab: s.loads.length, nWind: wl.loads.length, calc: wl.calc };
  }

  // ------------------------------------------------------------------ rigid floor diaphragm (stiff in-plane truss bracing per slab)
  function expand(m) {
    if (!m.bld || !m.bld.dia || !(m.bld.slabs || []).length) return m;
    const out = Object.assign({}, m, { members: m.members.slice(), sections: m.sections.concat([{ id: '~DIA', name: 'diaphragm', type: 'gen', A: 1e5, Iz: 1, Iy: 1, J: 1 }]), materials: m.materials.concat([{ id: '~DIA', name: 'diaphragm', kind: 'other', E: 2e6, nu: 0.3, rho: 0 }]) });
    const idx = new Map(); m.nodes.forEach(n => idx.set(r4(+n.x) + ',' + r4(+n.y) + ',' + r4(+n.z), n.id));
    const seen = new Set(); let k = 0;
    const link = (a, b) => { if (!a || !b || a === b) return; const key = a < b ? a + '|' + b : b + '|' + a; if (seen.has(key)) return; seen.add(key); out.members.push({ id: '~D' + (++k), i: a, j: b, sec: '~DIA', mat: '~DIA', type: 'truss', dia: true }); };
    m.bld.slabs.forEach(s => {
      const st = m.bld.stories.find(q => q.id === s.st); if (!st) return; const z = r4(+st.z), at = (x, y) => idx.get(r4(x) + ',' + r4(y) + ',' + z);
      const c = [at(s.x0, s.y0), at(s.x1, s.y0), at(s.x1, s.y1), at(s.x0, s.y1)], ok = c.filter(Boolean);
      if (ok.length < 3) return;
      for (let i = 0; i < 4; i++) link(c[i], c[(i + 1) % 4]);
      link(c[0], c[2]); link(c[1], c[3]);
    });
    return out;
  }
  function stripRes(res) { // drop diaphragm members from the results
    if (!res) return res;
    const f = o => { if (o && Array.isArray(o.mem)) o.mem = o.mem.filter(q => !String(q.id).startsWith('~')); };
    Object.values(res.cases || {}).forEach(f); Object.values(res.combos || {}).forEach(f);
    return res;
  }

  // ------------------------------------------------------------------ story results: displacement, drift, shear
  function storyResults(m, cur) {
    const st = stories(m); if (st.length < 2 || !cur || !cur.u) return [];
    const idx = new Map(); m.nodes.forEach((n, i) => idx.set(n.id, i));
    const col = new Map(); m.nodes.forEach((n, i) => { const k = r4(+n.x) + ',' + r4(+n.y); if (!col.has(k)) col.set(k, []); col.get(k).push([+n.z, i]); });
    const nd = nodeMap(m), out = [];
    for (let k = 1; k < st.length; k++) {
      const s = st[k], s0 = st[k - 1], h = s.z - s0.z; let ux = 0, uy = 0, dx = 0, dy = 0, has = false;
      col.forEach(list => {
        const a = list.find(q => Math.abs(q[0] - s.z) < TOL); if (!a) return; has = true;
        const u = [cur.u[6 * a[1]], cur.u[6 * a[1] + 1]]; if (Math.abs(u[0]) > Math.abs(ux)) ux = u[0]; if (Math.abs(u[1]) > Math.abs(uy)) uy = u[1];
        const b = list.find(q => Math.abs(q[0] - s0.z) < TOL); if (!b) return;
        const ddx = u[0] - cur.u[6 * b[1]], ddy = u[1] - cur.u[6 * b[1] + 1]; if (Math.abs(ddx) > Math.abs(dx)) dx = ddx; if (Math.abs(ddy) > Math.abs(dy)) dy = ddy;
      });
      if (!has) continue;
      // story shear: global horizontal force in every element crossing mid-height of the story
      const zm = (s.z + s0.z) / 2; let Vx = 0, Vy = 0;
      (cur.mem || []).forEach(mm => {
        const q = m.members.find(z2 => z2.id === mm.id); if (!q) return; const a = nd[q.i], b = nd[q.j]; if (!a || !b) return;
        const za = +a.z, zb = +b.z; if (!((za - zm) * (zb - zm) < 0)) return;
        const ax = G.FRAME.axes(P3(a), P3(b), q.beta), t = (zm - za) / (zb - za), x = t * ax.L; let i = 0; while (i < mm.x.length - 1 && mm.x[i + 1] <= x) i++;
        const N = mm.N[i], vy = mm.Vy[i], vz = mm.Vz[i];
        Vx += N * ax.ex[0] + vy * ax.ey[0] + vz * ax.ez[0]; Vy += N * ax.ex[1] + vy * ax.ey[1] + vz * ax.ez[1];
      });
      out.push({ id: s.id, z: s.z, h, ux, uy, dx, dy, rx: Math.abs(dx) > 1e-12 ? h / Math.abs(dx) : Infinity, ry: Math.abs(dy) > 1e-12 ? h / Math.abs(dy) : Infinity, Vx: Math.abs(Vx), Vy: Math.abs(Vy) });
    }
    return out;
  }

  // ------------------------------------------------------------------ 3D quantity take-off
  const QDEF = { deduct: true, rebar: { col: 180, beam: 150, slab: 100, brace: 120, other: 120 }, rates: { conc: 0, form: 0, rebar: 0, steel: 0 }, cur: '', conn: 0, waste: 0 };
  function matKind(t) { if (!t) return 'other'; if (t.kind === 'conc' || t.kind === 'steel') return t.kind; const E = +t.E || 0; return /conc|^C\d|^N\d|FC/i.test((t.id || '') + (t.name || '')) ? 'conc' : E >= 150000 ? 'steel' : 'other'; }
  function qto(m, o) {
    o = Object.assign({}, QDEF, o || {}); o.rebar = Object.assign({}, QDEF.rebar, (o || {}).rebar || {}); o.rates = Object.assign({}, QDEF.rates, (o || {}).rates || {});
    const nd = nodeMap(m), sec = {}, mat = {}; m.sections.forEach(s => { sec[s.id] = s; }); m.materials.forEach(t => { mat[t.id] = t; });
    const SP = id => { const s = sec[id]; if (!s) return null; try { return G.FRAME.secProps(s); } catch (e) { return null; } };
    const st = stories(m), b = m.bld || {}, slabs = (b.slabs || []).filter(s => b.stories.some(q => q.id === s.st));
    const levelName = z => { const s = st.find(q => Math.abs(q.z - z) < TOL); return s ? s.id : 'Z = ' + (Math.round(z * 100) / 100) + ' m'; };
    const perim = s => { if (!s) return 0; if (s.type === 'rect') return 2 * (+s.b + +s.h) / 1000; if (s.type === 'circ') return Math.PI * +s.D / 1000; return 0; };
    // slab thickness at a node / along a beam line
    const slabAt = (x, y, z) => slabs.filter(s => { const ss = st.find(q => q.id === s.st); return ss && Math.abs(ss.z - z) < TOL && x >= s.x0 - TOL && x <= s.x1 + TOL && y >= s.y0 - TOL && y <= s.y1 + TOL; });
    // column half-size at each node (for clear beam lengths)
    const colHalf = {};
    const kindOf = q => { const a = nd[q.i], c = nd[q.j]; if (!a || !c) return null; const v = [c.x - a.x, c.y - a.y, c.z - a.z].map(Number), L = Math.hypot(...v) || 1, cz = Math.abs(v[2]) / L; return { L, k: cz > 0.97 ? 'col' : cz < 0.03 ? 'beam' : 'brace', ztop: Math.max(+a.z, +c.z) }; };
    m.members.forEach(q => { const g = kindOf(q), p = SP(q.sec); if (!g || g.k !== 'col' || !p || matKind(mat[q.mat]) !== 'conc') return; const h = Math.max(+p.d || 0, +p.w || 0) / 2000; [q.i, q.j].forEach(id => { colHalf[id] = Math.max(colHalf[id] || 0, h); }); });
    const rows = []; let virt = 0;
    m.members.forEach(q => {
      const g = kindOf(q), p = SP(q.sec), t = mat[q.mat], mk = matKind(t), s = sec[q.sec]; if (!g || !p) return;
      if (t && t.rho !== '' && t.rho != null && +t.rho === 0) { virt++; return; } // stiffness-only element (its weight is carried elsewhere)
      const A = p.A / 1e6, r = { id: q.id, cat: g.k, mk, sec: q.sec, secName: (s && (s.name || s.size)) || q.sec, L: g.L, lvl: levelName(g.ztop), V: 0, form: 0, rebar: 0, steel: 0, Lq: g.L };
      if (mk === 'conc') {
        const a = nd[q.i], c = nd[q.j];
        if (g.k === 'beam' && s && s.type === 'rect') {
          const Lc = Math.max(0, g.L - (o.deduct ? (colHalf[q.i] || 0) + (colHalf[q.j] || 0) : 0)), mid = [(+a.x + +c.x) / 2, (+a.y + +c.y) / 2, +a.z];
          const ts = slabAt(mid[0], mid[1], mid[2]).reduce((x, sl) => Math.max(x, +sl.t || 0), 0) / 1000, bb = +s.b / 1000, hh = +s.h / 1000, hd = Math.max(0, hh - ts);
          r.Lq = Lc; r.V = bb * hd * Lc; r.form = (bb + 2 * hd) * Lc; r.ts = ts;
        } else if (g.k === 'col') {
          const top = +a.z > +c.z ? a : c, ts = slabAt(+top.x, +top.y, +top.z).reduce((x, sl) => Math.max(x, +sl.t || 0), 0) / 1000;
          r.V = A * g.L; r.form = perim(s) * Math.max(0, g.L - ts);
        } else { const Lc = Math.max(0, g.L - (o.deduct ? (colHalf[q.i] || 0) + (colHalf[q.j] || 0) : 0)); r.Lq = Lc; r.V = A * Lc; r.form = perim(s) * Lc; }
        r.rebar = r.V * (+o.rebar[g.k] || +o.rebar.other || 0);
      } else if (mk === 'steel') r.steel = A * g.L * 7850 * (1 + (+o.conn || 0) / 100);
      else r.V = A * g.L;
      rows.push(r);
    });
    // slabs: area × thickness; soffit formwork less half of each edge beam; edge formwork where no neighbouring slab
    const beamsOn = (sl, e) => { const ss = st.find(q => q.id === sl.st), z = ss.z, out = []; m.members.forEach(q => { const a = nd[q.i], c = nd[q.j], s = sec[q.sec]; if (!a || !c || !s || s.type !== 'rect' || Math.abs(+a.z - z) > TOL || Math.abs(+c.z - z) > TOL) return; const ca = e.ax === 'x' ? +a.y : +a.x, cc = e.ax === 'x' ? +c.y : +c.x; if (Math.abs(ca - e.c) > TOL || Math.abs(cc - e.c) > TOL) return; const sa = (e.ax === 'x' ? +a.x : +a.y) - e.o, sb = (e.ax === 'x' ? +c.x : +c.y) - e.o, lo = Math.max(0, Math.min(sa, sb)), hi = Math.min(e.L, Math.max(sa, sb)); if (hi > lo) out.push([hi - lo, +s.b / 1000]); }); return out; };
    const srows = slabs.map(sl => {
      const ss = st.find(q => q.id === sl.st), Lx = sl.x1 - sl.x0, Ly = sl.y1 - sl.y0, Aa = Lx * Ly, t = (+sl.t || 0) / 1000;
      let soff = Aa, edge = 0;
      slabEdges(sl).forEach(e => {
        beamsOn(sl, e).forEach(([len, bw]) => { soff -= len * bw / 2; });
        const nb = slabs.some(o2 => o2 !== sl && o2.st === sl.st && (e.ax === 'x' ? Math.abs((e.k === 'S' ? o2.y1 : o2.y0) - e.c) < TOL && o2.x0 < sl.x1 - TOL && o2.x1 > sl.x0 + TOL : Math.abs((e.k === 'W' ? o2.x1 : o2.x0) - e.c) < TOL && o2.y0 < sl.y1 - TOL && o2.y1 > sl.y0 + TOL));
        if (!nb) edge += e.L * t;
      });
      const V = Aa * t;
      return { id: sl.id, cat: 'slab', mk: 'conc', sec: 't' + (+sl.t || 0), secName: (+sl.t || 0) + ' mm slab', lvl: ss.id, A: Aa, V, form: Math.max(0, soff) + edge, rebar: V * (+o.rebar.slab || 0), steel: 0, L: 0, Lq: 0 };
    });
    const all = rows.concat(srows), w = 1 + (+o.waste || 0) / 100;
    const sum = (list, k) => list.reduce((s2, r) => s2 + (r[k] || 0), 0);
    const group = key => { const mp = new Map(); all.forEach(r => { const k = key(r); if (!mp.has(k)) mp.set(k, []); mp.get(k).push(r); }); return [...mp.entries()].map(([k, list]) => ({ k, n: list.length, L: sum(list, 'Lq'), A: sum(list, 'A'), V: sum(list, 'V') * w, form: sum(list, 'form'), rebar: sum(list, 'rebar') * w, steel: sum(list, 'steel'), list })); };
    const lvlOrder = [...st.map(s => s.id)], byStory = group(r => r.lvl).sort((p, q) => { const a = lvlOrder.indexOf(p.k), c = lvlOrder.indexOf(q.k); return (a < 0 ? 1e9 : a) - (c < 0 ? 1e9 : c) || String(p.k).localeCompare(q.k); });
    const catOrd = ['col', 'beam', 'brace', 'slab'], byCat = group(r => r.cat + '|' + r.mk).sort((p, q) => catOrd.indexOf(p.k.split('|')[0]) - catOrd.indexOf(q.k.split('|')[0]) || p.k.localeCompare(q.k));
    const bySec = group(r => r.mk + '|' + r.secName).sort((p, q) => p.k.localeCompare(q.k));
    const tot = { V: sum(all, 'V') * w, form: sum(all, 'form'), rebar: sum(all, 'rebar') * w, steel: sum(all, 'steel'), n: all.length, L: sum(rows, 'L') };
    const R = o.rates, cost = { conc: tot.V * (+R.conc || 0), form: tot.form * (+R.form || 0), rebar: tot.rebar / 1000 * (+R.rebar || 0), steel: tot.steel / 1000 * (+R.steel || 0) }; cost.tot = cost.conc + cost.form + cost.rebar + cost.steel;
    return { rows: all, byStory, byCat, bySec, tot, cost, opts: o, virt };
  }

  G.BUILDING = { windDefaults, bld, stories, storyAt, slabWay, slabEdges, slabLoads, windModel, windCalc, windLoads, sync, expand, stripRes, storyResults, qto, QDEF, matKind, AS_MZ, asVR, asMz, EN_TC, TH_ZONE, TH_IW };
})(typeof window !== 'undefined' ? window : globalThis);
