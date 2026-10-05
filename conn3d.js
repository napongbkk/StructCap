/* StructCap Connection — WebGL view of a joint.
   meshOf(g, opt) turns the joint geometry (plates, bolts, welds, anchors, concrete, FE results) into triangles and
   edge lines in world coordinates (mm); Renderer draws them with a depth buffer (orthographic camera, two-sided
   lighting, crisp outlines, transparent parts last). raycast(g, o, d) finds the part under a screen ray on the CPU,
   for picking, hover and placing new parts on a face. No dependencies; returns null when WebGL is not available. */
(function (G) {
  'use strict';
  const PI = Math.PI, abs = Math.abs, max = Math.max, min = Math.min;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = a => Math.hypot(a[0], a[1], a[2]), unit = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const lin = (o, ...t) => { const r = o.slice(); for (let i = 0; i < t.length; i += 2) { r[0] += t[i][0] * t[i + 1]; r[1] += t[i][1] * t[i + 1]; r[2] += t[i][2] * t[i + 1]; } return r; };
  const perp = a => unit(abs(a[2]) < 0.9 ? cross(a, [0, 0, 1]) : cross(a, [1, 0, 0]));

  // ------------------------------------------------------------------ mesh builder
  class Mesh {
    constructor() { this.p = []; this.n = []; this.c = []; this.lp = []; this.lc = []; this.tp = []; this.tn = []; this.tc = []; }
    tri(a, b, c, col, nrm) { const n = nrm || unit(cross(sub(b, a), sub(c, a))), tr = col[3] < 0.999, P = tr ? this.tp : this.p, N = tr ? this.tn : this.n, C = tr ? this.tc : this.c;
      [a, b, c].forEach(q => { P.push(q[0], q[1], q[2]); N.push(n[0], n[1], n[2]); C.push(col[0], col[1], col[2], col[3]); }); }
    quad(a, b, c, d, col, nrm) { const n = nrm || unit(cross(sub(c, a), sub(d, b))); this.tri(a, b, c, col, n); this.tri(a, c, d, col, n); }
    poly(pts, col, nrm) { const n = nrm || unit(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]))); for (let i = 1; i + 1 < pts.length; i++) this.tri(pts[0], pts[i], pts[i + 1], col, n); }
    line(a, b, col) { this.lp.push(a[0], a[1], a[2], b[0], b[1], b[2]); this.lc.push(col[0], col[1], col[2], col[3], col[0], col[1], col[2], col[3]); }
    // prism between two parallel polygons (side walls + caps)
    prism(A, B, col, edge, caps) {
      const n = A.length; for (let i = 0; i < n; i++) { const j = (i + 1) % n; this.quad(A[i], A[j], B[j], B[i], col); }
      if (caps !== false) { this.poly(A.slice().reverse(), col); this.poly(B, col); }
      if (edge) for (let i = 0; i < n; i++) { const j = (i + 1) % n; this.line(A[i], A[j], edge); this.line(B[i], B[j], edge); }
    }
    cyl(a, b, r, col, seg, edge) { const ax = unit(sub(b, a)), e1 = perp(ax), e2 = cross(ax, e1), ring = o => Array.from({ length: seg }, (_, i) => lin(o, e1, r * Math.cos(2 * PI * i / seg), e2, r * Math.sin(2 * PI * i / seg)));
      const A = ring(a), B = ring(b); for (let i = 0; i < seg; i++) { const j = (i + 1) % seg, nI = unit(sub(A[i], a)), nJ = unit(sub(A[j], a)), nm = unit(add(nI, nJ)); this.quad(A[i], A[j], B[j], B[i], col, nm); }
      this.poly(A.slice().reverse(), col, mul(ax, -1)); this.poly(B, col, ax); if (edge) { for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; this.line(A[i], A[j], edge); this.line(B[i], B[j], edge); } } }
  }
  const rgb = (c, a) => [c[0] / 255, c[1] / 255, c[2] / 255, a == null ? 1 : a];
  function ramp(t) { t = max(0, min(1, t)); const st = [[0, [40, 70, 200]], [0.25, [40, 170, 230]], [0.5, [60, 200, 90]], [0.75, [245, 210, 50]], [0.9, [245, 120, 40]], [1, [215, 40, 40]]]; for (let i = 1; i < st.length; i++) if (t <= st[i][0]) { const a = st[i - 1], b = st[i], u = (t - a[0]) / (b[0] - a[0]); return [0, 1, 2].map(k => Math.round(a[1][k] + (b[1][k] - a[1][k]) * u)); } return st[st.length - 1][1]; }

  // opt: { pal, disp, fr (FE result), def (scale), hl (key), hov (key), sel (Set of keys), lay, utilOf(key) }
  function meshOf(g, opt) {
    const M = new Mesh(), P = opt.pal, lay = opt.lay || {}, disp = opt.disp || 'model', fr = opt.fr, useFE = fr && disp !== 'model';
    const memIds = new Set(g.members.flatMap(m => m.plates)), userMem = new Set(g.members.filter(m => m.user).flatMap(m => m.plates));
    const isSel = k => k && (k === opt.hl || (opt.sel && opt.sel.has(k))), isHov = k => k && k === opt.hov;
    const tint = (c, k) => isSel(k) ? P.selRGB : isHov(k) ? c.map(v => Math.min(255, v * 0.75 + 70)) : c;
    const EDGE = rgb(P.edge, 1), EDGE_M = rgb(P.edgeM, 1);
    const plateKey = p => (p.user ? 'u:' + p.id : p.mem && userMem.has(p.id) ? 'u:' + p.mem : 'pl:' + p.id);
    const drawPlate = (p, base, a, edge, keyOverride) => {
      const k = keyOverride || plateKey(p), col = rgb(tint(base, k), a), h = p.t / 2, top = p.c.map(q => lin(q, p.n, h)), bot = p.c.map(q => lin(q, p.n, -h));
      M.prism(bot, top, col, a < 0.999 ? null : edge);
    };
    if (useFE) {
      const X = fr.X, u = fr.u, sc = opt.def || 0, xyz = i => [X[3 * i] + sc * u[6 * i], X[3 * i + 1] + sc * u[6 * i + 1], X[3 * i + 2] + sc * u[6 * i + 2]];
      fr.els.forEach(e => { const q = e.n.map(xyz), val = disp === 'ep' ? e.ep / 0.05 : e.s / (e.fy || 355), base = disp === 'mesh' ? (memIds.has(e.p) ? P.mem : P.pl) : ramp(val), a = lay.ghost && memIds.has(e.p) && disp === 'mesh' ? 0.35 : 1;
        M.quad(q[0], q[1], q[2], q[3], rgb(disp === 'mesh' && isSel('pl:' + e.p) ? P.selRGB : base, a));
        if (disp === 'mesh' || a === 1) for (let i = 0; i < 4; i++) M.line(q[i], q[(i + 1) % 4], disp === 'mesh' ? [0.08, 0.12, 0.18, 0.55] : [0.08, 0.12, 0.18, 0.16]); });
    } else {
      g.plates.forEach(p => {
        const isM = memIds.has(p.id), base = p.user ? P.user : isM ? (userMem.has(p.id) ? P.userMem : P.mem) : p.op === 'ST' ? P.st : P.pl, a = isM && lay.ghost && !userMem.has(p.id) ? 0.22 : 1;
        drawPlate(p, base, a, isM ? EDGE_M : EDGE);
      });
    }
    // parts that are not connected yet: drawn in red, see-through
    ((g.floating || {}).plates || []).forEach(p => drawPlate(p, P.float, 0.55, null));
    // concrete block under a base plate
    if (g.conc && !useFE) { const c = g.conc, z0 = -(c.tp / 2) - (c.grout || 30), D = max(300, Math.min(900, (g.base && g.base.hef || 400) + 150)), x = c.pedL / 2, y = c.pedB / 2;
      const ring = z => [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]];
      M.prism(ring(z0 - D), ring(z0), rgb(P.conc, 0.32), null);
      const gx = c.L / 2 + 15, gy = c.B / 2 + 15, gr = z => [[-gx, -gy, z], [gx, -gy, z], [gx, gy, z], [-gx, gy, z]]; M.prism(gr(z0), gr(-c.tp / 2), rgb(P.grout, 0.9), [0.3, 0.3, 0.3, 0.5]);
      for (let i = 0; i < 4; i++) { const A = ring(z0 - D), B = ring(z0); M.line(A[i], A[(i + 1) % 4], [0.4, 0.42, 0.45, 0.6]); M.line(B[i], B[(i + 1) % 4], [0.4, 0.42, 0.45, 0.6]); M.line(A[i], B[i], [0.4, 0.42, 0.45, 0.6]); } }
    // bolts: hex head + shank + washer + nut
    const plById = {}; g.plates.forEach(p => { plById[p.id] = p; });
    const hex = (o, ax, R, h0, h1, col, e) => { const e1 = perp(ax), e2 = cross(ax, e1), ring = s => Array.from({ length: 6 }, (_, i) => lin(o, ax, s, e1, R * Math.cos(i * PI / 3 + PI / 6), e2, R * Math.sin(i * PI / 3 + PI / 6))); M.prism(ring(h0), ring(h1), col, e); };
    if (lay.bolts !== false) g.bolts.concat(((g.floating || {}).bolts) || []).forEach(b => {
      const ax = b.axis, stk = b.stack.map(id => plById[id]).filter(Boolean); if (!stk.length) return;
      let s0 = 1e9, s1 = -1e9; stk.forEach(p => { const dn = dot(p.n, ax) || 1, s = dot(p.n, sub(p.o, b.p)) / dn; s0 = min(s0, s - p.t / 2); s1 = max(s1, s + p.t / 2); });
      const d = b.B.d, k = 'b:' + (b.user ? b.user : b.id), kk = 'b:' + b.id, util = opt.utilOf && useFE ? opt.utilOf(kk) : null;
      const base = isSel(kk) || isSel(k) ? P.selRGB : isHov(k) ? [120, 130, 150] : util != null ? ramp(util) : P.bolt, col = rgb(base, 1), R = b.B.s / Math.sqrt(3), ed = [0.05, 0.06, 0.08, 0.8];
      hex(b.p, ax, R, s0 - 0.65 * d, s0 - 0.08 * d, col, ed);
      M.cyl(lin(b.p, ax, s0 - 0.08 * d), lin(b.p, ax, s0), 0.98 * R, rgb(base.map(v => v * 1.15), 1), 16, null); // washer
      M.cyl(lin(b.p, ax, s1), lin(b.p, ax, s1 + 0.08 * d), 0.98 * R, rgb(base.map(v => v * 1.15), 1), 16, null);
      hex(b.p, ax, R, s1 + 0.08 * d, s1 + 0.88 * d, col, ed);
      M.cyl(lin(b.p, ax, s0 - 0.6 * d), lin(b.p, ax, s1 + 1.25 * d), d / 2, col, 12, null);
    });
    // anchors: rod into the concrete, washer and nut on the base plate
    if (lay.bolts !== false && g.anchors.length) { const bp = plById[g.conc && g.conc.plate]; g.anchors.forEach(a => { const ax = [0, 0, 1], t = bp ? bp.t / 2 : 15, d = a.d, k = 'b:' + a.id, util = opt.utilOf && useFE ? opt.utilOf(k) : null, base = isSel(k) ? P.selRGB : isHov(k) ? [120, 130, 150] : util != null ? ramp(util) : P.bolt, col = rgb(base, 1), R = a.B.s / Math.sqrt(3);
      M.cyl(lin(a.p, ax, -(a.hef || 400)), lin(a.p, ax, t + 1.4 * d), d / 2, col, 12, null);
      M.cyl(lin(a.p, ax, t), lin(a.p, ax, t + 0.15 * d), 1.25 * R, rgb(base.map(v => v * 1.15), 1), 16, null);
      hex(a.p, ax, R, t + 0.15 * d, t + 0.95 * d, col, [0.05, 0.06, 0.08, 0.8]);
      const pl = lin(a.p, ax, -(a.hef || 400)); M.cyl(pl, lin(pl, ax, 0.6 * d), 1.6 * d, rgb([110, 116, 126], 0.8), 12, null); }); }
    // welds: fillet beads along the line (one per side), butt welds as a band across the joint
    if (lay.welds !== false) g.welds.concat(((g.floating || {}).welds) || []).forEach(w => {
      const A = plById[w.a], B = plById[w.b] || (/\.\*$/.test(w.b) ? g.plates.find(q => q.mem === w.b.slice(0, -2)) : null), k = 'w:' + (w.user || w.id), kk = 'w:' + w.id;
      const util = opt.utilOf && useFE ? opt.utilOf(kk) : null, base = isSel(kk) || isSel(k) ? P.selRGB : isHov(k) ? [255, 170, 120] : util != null ? ramp(util) : P.weld, col = rgb(base, 1), ed = [0.45, 0.16, 0.05, 0.9];
      const L = sub(w.p1, w.p0), ll = len(L); if (ll < 0.5) return; const ex = mul(L, 1 / ll);
      let na = A ? A.n : perp(ex); na = unit(sub(na, mul(ex, dot(na, ex))));
      // direction from the weld line into plate a (away from plate b)
      let into = A ? unit(sub(sub(A.c.reduce((s, q) => add(s, q), [0, 0, 0]).map(v => v / 4), w.p0), mul(ex, dot(sub(A.c.reduce((s, q) => add(s, q), [0, 0, 0]).map(v => v / 4), w.p0), ex)))) : cross(ex, na);
      into = unit(sub(into, mul(na, dot(into, na)))); if (!isFinite(into[0])) into = cross(ex, na);
      const ta = A ? A.t : 8, tb = B ? B.t : 8, leg = max(3, (+w.a_ || 6) * Math.SQRT2), nb = B ? (dot(B.n, into) >= 0 ? B.n : mul(B.n, -1)) : into;
      // corner where the face of plate a meets the surface of plate b
      const surf = lin(w.p0, nb, B ? tb / 2 - dot(sub(w.p0, B.o), nb) : 0);
      const s0 = surf, sh = sub(s0, w.p0);
      if (w.type === 'butt') { const th = ta / 2 + 1.2, A0 = [lin(w.p0, sh, 1, na, -th, into, 0), lin(w.p0, sh, 1, na, th, into, 0), lin(w.p0, sh, 1, na, th, into, 6), lin(w.p0, sh, 1, na, -th, into, 6)], B0 = A0.map(q => add(q, L)); M.prism(A0, B0, col, ed); return; }
      if (w.lap && B) { // lap plate lying on the face: fillet along its edge, on the face of plate b
        const up = dot(sub(A.o, B.o), B.n) >= 0 ? B.n : mul(B.n, -1), out = mul(into, -1), c0 = lin(w.p0, up, tb / 2 - dot(sub(w.p0, B.o), up)), tri0 = [c0, lin(c0, up, leg), lin(c0, out, leg)], tri1 = tri0.map(q => add(q, L));
        M.prism(tri0, tri1, col, null); M.line(tri0[1], tri1[1], ed); M.line(tri0[2], tri1[2], ed); return; }
      (w.sides === 1 ? [1] : [1, -1]).forEach(sd => {
        const c0 = lin(w.p0, sh, 1, na, sd * ta / 2), tri0 = [c0, lin(c0, into, leg), lin(c0, na, sd * leg)], tri1 = tri0.map(q => add(q, L));
        M.prism(sd > 0 ? tri0 : tri0.slice().reverse(), sd > 0 ? tri1 : tri1.slice().reverse(), col, null);
        M.line(tri0[1], tri1[1], ed); M.line(tri0[2], tri1[2], ed);
      });
    });
    return M;
  }

  // ------------------------------------------------------------------ ray casting (pick / place)
  function rayQuad(o, d, Q, n) { const dn = dot(d, n); if (abs(dn) < 1e-9) return null; const t = dot(sub(Q[0], o), n) / dn; if (t < 0) return null; const x = lin(o, d, t);
    let sg = 0; for (let i = 0; i < Q.length; i++) { const a = Q[i], b = Q[(i + 1) % Q.length], s = dot(cross(sub(b, a), sub(x, a)), n); if (abs(s) < 1e-9) continue; if (sg && Math.sign(s) !== sg) return null; sg = Math.sign(s); } return { t, x }; }
  function segRay(o, d, a, b) { // closest distance between the ray o + t d and the segment a–b
    const u = sub(b, a), w0 = sub(o, a), A = dot(d, d), Bv = dot(d, u), Cc = dot(u, u), D = dot(d, w0), E = dot(u, w0), den = A * Cc - Bv * Bv;
    let sc, tc; if (den < 1e-9) { sc = 0; tc = Bv > Cc ? D / Bv : E / Cc; } else { sc = (Bv * E - Cc * D) / den; tc = (A * E - Bv * D) / den; }
    tc = max(0, min(1, tc)); sc = max(0, (Bv * tc - D) / A); const p1 = lin(o, d, sc), p2 = lin(a, u, tc); return { dist: len(sub(p1, p2)), t: sc, x: p1 };
  }
  // returns { key, t, x (hit point), n (face normal), plate } of the nearest part along the ray, or null
  function raycast(g, o, d, opt) {
    opt = opt || {}; let best = null; const take = h => { if (h && (!best || h.t < best.t)) best = h; };
    const userMem = new Set(g.members.filter(m => m.user).flatMap(m => m.plates));
    const plates = g.plates.concat(opt.floating === false ? [] : ((g.floating || {}).plates || []));
    plates.forEach(p => { if (opt.skip && opt.skip(p)) return; const h = p.t / 2, top = p.c.map(q => lin(q, p.n, h)), bot = p.c.map(q => lin(q, p.n, -h)), key = p.user ? 'u:' + p.id : userMem.has(p.id) ? 'u:' + p.mem : 'pl:' + p.id;
      const faces = [[top, p.n], [bot.slice().reverse(), mul(p.n, -1)]]; for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, n = unit(cross(sub(p.c[j], p.c[i]), p.n)); faces.push([[bot[i], bot[j], top[j], top[i]], n]); }
      faces.forEach(([Q, n], fi) => { const r = rayQuad(o, d, Q, n); if (r) take({ key, t: r.t, x: r.x, n: fi === 1 ? mul(p.n, -1) : fi === 0 ? p.n : n, plate: p, face: fi }); }); });
    if (opt.parts !== false) {
      g.bolts.forEach(b => { const s = segRay(o, d, lin(b.p, b.axis, -40), lin(b.p, b.axis, 40)); if (s.dist < b.B.s * 0.6) take({ key: 'b:' + (b.user || b.id), t: s.t - 1, x: s.x, n: b.axis, bolt: b }); });
      g.anchors.forEach(a => { const s = segRay(o, d, lin(a.p, [0, 0, 1], -20), lin(a.p, [0, 0, 1], 60)); if (s.dist < a.B.s * 0.6) take({ key: 'b:' + a.id, t: s.t - 1, x: s.x, n: [0, 0, 1] }); });
      g.welds.forEach(w => { const s = segRay(o, d, w.p0, w.p1); if (s.dist < max(6, (+w.a_ || 6) * 1.6)) take({ key: 'w:' + (w.user || w.id), t: s.t - 2, x: s.x, n: null, weld: w }); });
    }
    return best;
  }

  // ------------------------------------------------------------------ WebGL renderer
  function shader(gl, type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  class Renderer {
    constructor(cv) {
      const gl = cv.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true }) || cv.getContext('experimental-webgl', { antialias: true, alpha: true, preserveDrawingBuffer: true });
      if (!gl) throw new Error('no webgl'); this.gl = gl; this.cv = cv;
      const vs = `precision highp float; attribute vec3 aP; attribute vec3 aN; attribute vec4 aC;
        uniform vec3 uC; uniform vec3 uR; uniform vec3 uU; uniform vec3 uE; uniform vec4 uV; uniform vec3 uS;
        varying vec3 vN; varying vec4 vC;
        void main(){ vec3 d = aP - uC; float sx = uV.x + uV.z * dot(d, uR); float sy = uV.y - uV.z * dot(d, uU);
          gl_Position = vec4(sx * uS.x - 1.0, 1.0 - sy * uS.y, -dot(d, uE) * uS.z, 1.0); vN = aN; vC = aC; }`;
      const fs = `#ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif
        varying vec3 vN; varying vec4 vC; uniform vec3 uEf; uniform vec3 uL; uniform float uLit;
        void main(){ vec3 n = normalize(vN); if (dot(n, uEf) < 0.0) n = -n; float df = max(dot(n, uL), 0.0); float sp = pow(max(dot(n, normalize(uL + uEf)), 0.0), 40.0);
          vec3 c = uLit > 0.5 ? vC.rgb * (0.42 + 0.6 * df) + vec3(0.10) * sp : vC.rgb; gl_FragColor = vec4(c, vC.a); }`;
      const pr = gl.createProgram(); gl.attachShader(pr, shader(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(pr, shader(gl, gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      this.pr = pr; this.loc = {}; ['aP', 'aN', 'aC'].forEach(k => { this.loc[k] = gl.getAttribLocation(pr, k); }); ['uC', 'uR', 'uU', 'uE', 'uEf', 'uV', 'uS', 'uL', 'uLit'].forEach(k => { this.loc[k] = gl.getUniformLocation(pr, k); });
      this.buf = {}; this.n = { o: 0, t: 0, l: 0 };
    }
    upload(M) {
      const gl = this.gl, mk = (name, arr) => { if (!this.buf[name]) this.buf[name] = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf[name]); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); };
      mk('op', M.p); mk('on', M.n); mk('oc', M.c); mk('tp', M.tp); mk('tn', M.tn); mk('tc', M.tc); mk('lp', M.lp); mk('lc', M.lc);
      const zero = []; for (let i = 0; i < M.lp.length; i++) zero.push(0); mk('ln', zero.length ? zero : [0, 0, 1]);
      this.n = { o: M.p.length / 3, t: M.tp.length / 3, l: M.lp.length / 3 };
    }
    draw(cam, W, H, dpr, R) {
      const gl = this.gl, L = this.loc, cv = this.cv; if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.useProgram(this.pr);
      const B = cam.B; gl.uniform3fv(L.uC, cam.c); gl.uniform3fv(L.uR, B.r); gl.uniform3fv(L.uU, B.u); gl.uniform3fv(L.uE, B.e); gl.uniform3fv(L.uEf, B.e); gl.uniform4f(L.uV, W / 2 + cam.ox, H / 2 + cam.oy, cam.k, 0); gl.uniform3f(L.uS, 2 / W, 2 / H, 1 / max(1, 4 * R));
      gl.uniform3fv(L.uL, unit(add(add(mul(B.r, -0.35), mul(B.u, 0.6)), mul(B.e, 0.72))));
      const bind = (p, n, c) => { [[p, L.aP, 3], [n, L.aN, 3], [c, L.aC, 4]].forEach(([b, l, s]) => { if (l < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, this.buf[b]); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, s, gl.FLOAT, false, 0, 0); }); };
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE);
      // opaque faces pushed back a little so that outlines on them win the depth test
      gl.disable(gl.BLEND); gl.depthMask(true); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.0, 1.0); gl.uniform1f(L.uLit, 1);
      if (this.n.o) { bind('op', 'on', 'oc'); gl.drawArrays(gl.TRIANGLES, 0, this.n.o); }
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      if (this.n.l) { gl.uniform1f(L.uLit, 0); bind('lp', 'ln', 'lc'); gl.drawArrays(gl.LINES, 0, this.n.l); }
      if (this.n.t) { gl.uniform1f(L.uLit, 1); gl.depthMask(false); bind('tp', 'tn', 'tc'); gl.drawArrays(gl.TRIANGLES, 0, this.n.t); gl.depthMask(true); }
      gl.disable(gl.BLEND);
    }
  }
  function create(cv) { try { return new Renderer(cv); } catch (e) { return null; } }
  G.CONN3D = { meshOf, raycast, create, ramp, Mesh, _R: Renderer };
})(typeof window !== 'undefined' ? window : globalThis);
