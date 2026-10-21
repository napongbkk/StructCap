/* StructCap House — structural design of houses and small buildings (Thai practice).
   Engine (pure, no DOM): building model on grids and stories, load take-down (slabs to beams by yield lines, walls, stairs, roof),
   3D frame analysis (frame.js), RC design by the strength method (SDM, EIT/ACI 318-99 style) and the steel roof by ASD.
   Units: geometry m; sections cm; loads kg/m², kg/m, kg; results t, t·m (1 t = 1000 kg); stresses ksc. FRAME runs in kN, m. */
(function (G) {
  'use strict';
  const KG = 0.00980665;                      // kg (force) -> kN
  const PI = Math.PI, sq = Math.sqrt, abs = Math.abs, max = Math.max, min = Math.min, ceil = Math.ceil, floor = Math.floor, round = Math.round;
  const r2 = v => round(v * 100) / 100, r3 = v => round(v * 1000) / 1000;
  const clone = o => JSON.parse(JSON.stringify(o));
  const num = (v, d) => (v === '' || v == null || !isFinite(+v) ? d : +v);

  // ------------------------------------------------------------------ libraries
  // rebar (มอก. 20 / 24): diameter mm, area cm², kg/m
  const BARS = { RB6: [6, 0.283, 0.222], RB9: [9, 0.636, 0.499], DB10: [10, 0.785, 0.617], DB12: [12, 1.131, 0.888], DB16: [16, 2.011, 1.578], DB20: [20, 3.142, 2.466], DB25: [25, 4.909, 3.853], DB28: [28, 6.158, 4.834] };
  const barD = k => BARS[k][0], barA = k => BARS[k][1], barW = k => BARS[k][2];
  // steel sections for the roof (dimensions mm): box (b x h x t) and lipped channel (h x b x c x t)
  const BOX = ['50x50x2.3', '50x50x3.2', '75x45x2.3', '75x75x2.3', '75x75x3.2', '100x50x2.3', '100x50x3.2', '100x100x3.2', '125x75x3.2', '150x50x3.2', '150x100x3.2', '150x150x4.5'];
  const CLIP = ['75x45x15x2.3', '100x50x20x2.3', '100x50x20x3.2', '125x50x20x2.3', '125x50x20x3.2', '150x50x20x2.3', '150x50x20x3.2', '150x65x20x3.2'];
  function steelProps(kind, name) { // returns A cm², Ix cm⁴, Iy, Sx cm³, rx, ry cm, w kg/m, h, b cm
    const p = name.split('x').map(Number);
    if (kind === 'box') { const [b, h, t] = p.map(v => v / 10); const A = 2 * t * (b + h - 2 * t), Ix = (b * h ** 3 - (b - 2 * t) * (h - 2 * t) ** 3) / 12, Iy = (h * b ** 3 - (h - 2 * t) * (b - 2 * t) ** 3) / 12; return { A, Ix, Iy, Sx: Ix / (h / 2), Sy: Iy / (b / 2), rx: sq(Ix / A), ry: sq(Iy / A), w: A * 0.785, h, b, t, name: '□' + name }; }
    const [h, b, c, t] = p.map(v => v / 10); // lipped channel, mid-line approximation
    const segs = [[b - t, t, (h - t) / 2], [b - t, t, -(h - t) / 2], [h - t, t, 0, 1], [c - t / 2, t, (h - t) / 2 - (c - t / 2) / 2, 1], [c - t / 2, t, -(h - t) / 2 + (c - t / 2) / 2, 1]];
    let A = 0, Ix = 0; segs.forEach(([L, tt, y, vert]) => { const a = L * tt; A += a; Ix += a * y * y + (vert ? tt * L ** 3 / 12 : L * tt ** 3 / 12); });
    const xw = 0, xs = [[b - t, (b - t) / 2], [b - t, (b - t) / 2], [h - t, 0], [c - t / 2, b - t], [c - t / 2, b - t]];
    const xc = xs.reduce((s, [L, x]) => s + L * t * x, 0) / A; let Iy = 0; xs.forEach(([L, x], i) => { const a = L * t; Iy += a * (x - xc) ** 2 + (i < 2 ? t * L ** 3 / 12 : 0); });
    return { A, Ix, Iy, Sx: Ix / (h / 2), Sy: Iy / max(xc + t / 2, b - t / 2 - xc), xc, rx: sq(Ix / A), ry: sq(Iy / A), w: A * 0.785, h, b, t, c, name: 'C' + name };
  }
  // live loads (kg/m²) — Ministerial Regulation No. 6 (B.E. 2527) under the Building Control Act B.E. 2522
  const LL = { res: ['ที่พักอาศัย', 150], toilet: ['ห้องน้ำ ห้องส้วม', 150], stair: ['บันได ช่องทางเดิน', 300], balcony: ['ระเบียง', 300], office: ['สำนักงาน', 250], store: ['ห้องเก็บของ', 500], roofc: ['หลังคา คสล. / ดาดฟ้า', 100], garage: ['ที่จอดรถยนต์นั่ง', 400] };
  // superimposed dead load of walls (kg/m² of wall)
  const WALLS = { brick05: ['ผนังอิฐมอญครึ่งแผ่น ฉาบ 2 ด้าน', 180], brick10: ['ผนังอิฐมอญเต็มแผ่น ฉาบ 2 ด้าน', 360], block10: ['ผนังคอนกรีตบล็อก 10 ซม. ฉาบ 2 ด้าน', 150], block20: ['ผนังคอนกรีตบล็อก 20 ซม. ฉาบ 2 ด้าน', 240], alc75: ['ผนังอิฐมวลเบา 7.5 ซม. ฉาบ 2 ด้าน', 90], alc10: ['ผนังอิฐมวลเบา 10 ซม. ฉาบ 2 ด้าน', 110], glass: ['ผนังกระจก / เบา', 40] };
  const ROOFS = { tile: ['กระเบื้องคอนกรีต', 55], ceramic: ['กระเบื้องดินเผา / เซรามิก', 60], fiber: ['กระเบื้องลอนคู่ (ไฟเบอร์ซีเมนต์)', 20], metal: ['เมทัลชีท', 8], metalpu: ['เมทัลชีทบุ PU', 12] };

  // ------------------------------------------------------------------ default house (2 storeys, 12 x 8 m)
  function defaults() {
    return {
      v: 1,
      meta: { project: 'บ้านพักอาศัย 2 ชั้น', owner: '', location: '', engineer: '', license: '', checker: '', drafter: '', date: '' },
      grid: { x: [0, 4, 8, 12], y: [0, 4, 8], xn: ['1', '2', '3', '4'], yn: ['A', 'B', 'C'] },
      stories: [{ id: 'S1', name: 'ชั้น 1 (คานคอดิน)', z: 0 }, { id: 'S2', name: 'ชั้น 2', z: 3.2 }, { id: 'S3', name: 'ชั้นหลังคา', z: 6.2 }],
      mat: { fc: 240, fy: 4000, fys: 2400, Fy: 2400, Es: 2.04e6, ws: 2400, cover: { slab: 2.0, beam: 3.0, col: 3.5, fnd: 7.5 }, lapDB: 40, lapRB: 48, waste: 5 },
      soil: { type: 'spread', qa: 10, gs: 1.8, Df: 1.5, pile: { name: 'เข็ม I-0.18x0.18 ม. ยาว 6 ม.', cap: 15, D: 18, s: 0.6 } },
      sections: [
        { id: 'C1', kind: 'col', b: 20, h: 20 }, { id: 'C2', kind: 'col', b: 25, h: 25 },
        { id: 'GB1', kind: 'beam', b: 20, h: 40 }, { id: 'B1', kind: 'beam', b: 20, h: 40 }, { id: 'B2', kind: 'beam', b: 20, h: 50 }, { id: 'RB1', kind: 'beam', b: 15, h: 30 }
      ],
      columns: [], beams: [], slabs: [], stairs: [], walls: [],
      roof: { type: 'gable', st: 'S3', dir: 'x', pitch: 30, over: 0.6, cover: 'tile', ll: 30, ceil: 15, sp: 1.5, psp: 1.0 },
      loads: { sdl: 100, wind: { on: false, q: 50 } },
      over: {},   // design overrides: { 'beam:<id>': { top: 'DB16', ntop: 3, ... } }
      next: 1
    };
  }
  // fill an example: columns at every grid point, beams on every grid line on every storey, slabs in every bay (storey 2: suspended, storey 1: on ground)
  function example() {
    const H = defaults(); auto(H, { cols: true, beams: true, slabs: true });
    H.slabs.filter(s => s.st === 'S1').forEach(s => { s.ground = true; });
    H.slabs = H.slabs.filter(s => s.st !== 'S3');
    H.stairs.push({ id: 'ST1', st: 'S1', i: 0, j: 1, dir: 'x', t: 15 });
    H.slabs = H.slabs.filter(s => !(s.st === 'S2' && s.i === 0 && s.j === 1));
    // perimeter walls on both floors (block 10 cm), toilet slab
    perimeter(H).forEach(([a, b]) => { H.walls.push({ st: 'S1', a, b, type: 'block10' }); H.walls.push({ st: 'S2', a, b, type: 'block10' }); });
    H.beams.filter(b => b.st === 'S2' && (b.a[1] === 0 || b.a[1] === H.grid.y.length - 1) && b.a[1] === b.b[1]).forEach(b => { b.sec = 'B1'; });
    return H;
  }
  const nid = (st, i, j) => `${st}:${i}:${j}`;
  const uid = (H, p) => p + (H.next++);
  function perimeter(H) { const nx = H.grid.x.length - 1, ny = H.grid.y.length - 1, L = []; for (let i = 0; i < nx; i++) { L.push([[i, 0], [i + 1, 0]]); L.push([[i, ny], [i + 1, ny]]); } for (let j = 0; j < ny; j++) { L.push([[0, j], [0, j + 1]]); L.push([[nx, j], [nx, j + 1]]); } return L; }
  function stories(H) { return H.stories.slice().sort((a, b) => a.z - b.z); }
  const stIdx = (H, id) => stories(H).findIndex(s => s.id === id);
  const topSt = H => stories(H)[stories(H).length - 1];
  // auto placement helpers
  function auto(H, o) {
    const nx = H.grid.x.length, ny = H.grid.y.length, S = stories(H);
    if (o.cols) { H.columns = []; for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) H.columns.push({ id: uid(H, 'c'), i, j, top: S[S.length - 1].id, sec: 'C1', fsec: 'F1' }); }
    if (o.beams) { H.beams = []; S.forEach((st, k) => { const sec = k === 0 ? 'GB1' : k === S.length - 1 ? 'RB1' : 'B1'; for (let j = 0; j < ny; j++) for (let i = 0; i + 1 < nx; i++) H.beams.push({ id: uid(H, 'b'), st: st.id, a: [i, j], b: [i + 1, j], sec }); for (let i = 0; i < nx; i++) for (let j = 0; j + 1 < ny; j++) H.beams.push({ id: uid(H, 'b'), st: st.id, a: [i, j], b: [i, j + 1], sec }); }); }
    if (o.slabs) { H.slabs = []; S.forEach(st => { for (let i = 0; i + 1 < nx; i++) for (let j = 0; j + 1 < ny; j++) H.slabs.push({ id: uid(H, 's'), st: st.id, i, j, t: 12, use: 'res', ground: false }); }); }
  }
  const secOf = (H, id) => H.sections.find(s => s.id === id) || { id, kind: 'beam', b: 20, h: 40 };
  const gx = (H, i) => H.grid.x[i], gy = (H, j) => H.grid.y[j];

  // ------------------------------------------------------------------ beams: segments between neighbouring grid points, lines
  const bkey = (st, a, b) => { const p = a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? [a, b] : [b, a]; return `${st}|${p[0]}|${p[1]}`; };
  function beamOn(H, st, a, b) { const k = bkey(st, a, b); return H.beams.find(x => bkey(x.st, x.a, x.b) === k) || null; }
  // continuous beam lines: collinear touching segments on the same storey
  function beamLines(H) {
    const out = [];
    stories(H).forEach(st => {
      const bs = H.beams.filter(b => b.st === st.id);
      ['x', 'y'].forEach(dir => {
        const along = bs.filter(b => (dir === 'x' ? b.a[1] === b.b[1] : b.a[0] === b.b[0]));
        const byLine = {}; along.forEach(b => { const k = dir === 'x' ? b.a[1] : b.a[0]; (byLine[k] = byLine[k] || []).push(b); });
        Object.entries(byLine).forEach(([k, L]) => {
          const pos = b => (dir === 'x' ? min(b.a[0], b.b[0]) : min(b.a[1], b.b[1]));
          L.sort((p, q) => pos(p) - pos(q));
          let cur = null;
          L.forEach(b => { const s = pos(b); if (cur && cur.end === s) { cur.spans.push(b); cur.end = s + 1; } else { cur = { st: st.id, dir, line: +k, spans: [b], start: s, end: s + 1 }; out.push(cur); } });
        });
      });
    });
    return out;
  }

  // ------------------------------------------------------------------ slabs: support edges, two-way / one-way, continuity
  function slabEdges(H, s) { // edges: s (south, y0), n, w (x0), e — beam present?
    const [i, j] = [s.i, s.j], st = s.st;
    return { s: !!beamOn(H, st, [i, j], [i + 1, j]), n: !!beamOn(H, st, [i, j + 1], [i + 1, j + 1]), w: !!beamOn(H, st, [i, j], [i, j + 1]), e: !!beamOn(H, st, [i + 1, j], [i + 1, j + 1]) };
  }
  function slabCont(H, s) { // continuous edge = another slab across that edge on the same storey
    const has = (i, j) => H.slabs.some(q => q.st === s.st && q.i === i && q.j === j && !q.ground);
    return { s: has(s.i, s.j - 1), n: has(s.i, s.j + 1), w: has(s.i - 1, s.j), e: has(s.i + 1, s.j) };
  }
  function slabGeom(H, s) {
    const Lx = gx(H, s.i + 1) - gx(H, s.i), Ly = gy(H, s.j + 1) - gy(H, s.j), E = slabEdges(H, s);
    let way;
    if (E.s && E.n && E.w && E.e) way = max(Lx, Ly) / min(Lx, Ly) >= 2 ? (Lx < Ly ? 'x' : 'y') : 'two';
    else if (E.w && E.e) way = 'x';           // spans in x between the beams on x0 and x1
    else if (E.s && E.n) way = 'y';
    else way = 'none';
    return { Lx, Ly, S: min(Lx, Ly), L: max(Lx, Ly), way, E };
  }
  // service loads per m² of a slab (kg/m²)
  function slabLoads(H, s) { const sw = s.t / 100 * H.mat.ws, sdl = num(s.sdl, H.loads.sdl), ll = num(s.ll, (LL[s.use] || LL.res)[1]); return { sw, sdl, D: sw + sdl, L: ll }; }

  // ------------------------------------------------------------------ roof (steel trusses or a concrete roof slab)
  function roofGeom(H) {
    const R = H.roof, st = R.st || topSt(H).id, bs = H.beams.filter(b => b.st === st);
    if (!bs.length || R.type === 'none' || R.type === 'flat') return null;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; bs.forEach(b => [b.a, b.b].forEach(p => { x0 = min(x0, gx(H, p[0])); x1 = max(x1, gx(H, p[0])); y0 = min(y0, gy(H, p[1])); y1 = max(y1, gy(H, p[1])); }));
    const dir = R.dir === 'y' ? 'y' : 'x', span = dir === 'x' ? y1 - y0 : x1 - x0, len = dir === 'x' ? x1 - x0 : y1 - y0, th = num(R.pitch, 30) * PI / 180, ov = num(R.over, 0.6);
    const rise = R.type === 'shed' ? span * Math.tan(th) : span / 2 * Math.tan(th);
    return { st, x0, x1, y0, y1, dir, span, len, th, ov, rise, type: R.type };
  }
  // roof loads per m² of plan (kg/m²): cover + purlins + truss + ceiling on slope, live load on plan
  function roofLoads(H) { const R = H.roof, g = roofGeom(H); if (!g) return null; const c = (ROOFS[R.cover] || ROOFS.tile)[1], cs = 1 / Math.cos(g.th); return { cover: c * cs, steel: 15 * cs, ceil: num(R.ceil, 15), D: (c + 15) * cs + num(R.ceil, 15), L: num(R.ll, 30) }; }

  // load combinations: the standard set, or the user's table H.loads.combos [{id, name, f:{D, L, WX, WY}, type:'ULS'|'SLS'}] (U1 and SV must exist)
  function defCombos(H) {
    const c = [{ id: 'U1', name: '1.4D + 1.7L', f: { D: 1.4, L: 1.7 }, type: 'ULS' }, { id: 'SV', name: 'D + L', f: { D: 1, L: 1 }, type: 'SLS' }];
    if (H.loads.wind && H.loads.wind.on) ['WX', 'WY'].forEach(w => [1, -1].forEach(sg => { c.push({ id: `U2${w}${sg > 0 ? 'p' : 'n'}`, name: `0.75(1.4D + 1.7L ${sg > 0 ? '+' : '−'} 1.7${w})`, f: { D: 1.05, L: 1.275, [w]: sg * 1.275 }, type: 'ULS' }); c.push({ id: `U3${w}${sg > 0 ? 'p' : 'n'}`, name: `0.9D ${sg > 0 ? '+' : '−'} 1.3${w}`, f: { D: 0.9, [w]: sg * 1.3 }, type: 'ULS' }); }));
    return c;
  }
  function uFac(H) { const u = (H.loads.combos || []).find(c => c.id === 'U1'); return { D: u && u.f && +u.f.D || 1.4, L: u && u.f && +u.f.L || 1.7 }; }
  function userCombos(H, ids) {
    const L = H.loads.combos.map((c, k) => ({ id: c.id || 'C' + (k + 1), name: c.name || ('Combo ' + (k + 1)), type: c.type === 'SLS' ? 'SLS' : 'ULS', f: Object.fromEntries(Object.entries(c.f || {}).filter(([q, v]) => ids.has(q) && +v).map(([q, v]) => [q, +v])) }));
    if (!L.some(c => c.id === 'U1')) { const u = L.find(c => c.type === 'ULS'); if (u) u.id = 'U1'; else L.unshift({ id: 'U1', name: '1.4D + 1.7L', f: { D: 1.4, L: 1.7 }, type: 'ULS' }); }
    if (!L.some(c => c.id === 'SV')) { const v = L.find(c => c.type === 'SLS'); if (v) v.id = 'SV'; else L.push({ id: 'SV', name: 'D + L', f: { D: 1, L: 1 }, type: 'SLS' }); }
    return L;
  }
  // ------------------------------------------------------------------ build the 3D frame model (FRAME, kN m)
  function frameModel(H, ft) {
    const S = stories(H), fc = H.mat.fc, Ec = 15100 * sq(fc) * 0.0980665; // MPa
    const zBase = -num(H.soil.Df, 1.5) + 0.3;    // top of the footing: base at Df, minimum footing thickness 30 cm
    const nodes = [], nset = new Set(), members = [], loads = [], warn = [];
    const addNode = (id, x, y, z, sup) => { if (nset.has(id)) return; nset.add(id); nodes.push({ id, x, y, z, sup: sup || 'free' }); };
    const sections = [], sset = new Set(), addSec = s => { if (sset.has(s.id)) return; sset.add(s.id); sections.push({ id: s.id, type: 'rect', b: s.b * 10, h: s.h * 10 }); };
    const materials = [{ id: 'RC', E: Ec, nu: 0.2, rho: H.mat.ws * KG, kind: 'conc' }];
    // columns: base at the top of the footing, segment per storey up to the column top
    H.columns.forEach(c => {
      const sec = secOf(H, c.sec), x = gx(H, c.i), y = gy(H, c.j), top = stIdx(H, c.top); addSec(sec);
      const bid = `F:${c.i}:${c.j}`; addNode(bid, x, y, ft && ft[c.id] ? -num(H.soil.Df, 1.5) + ft[c.id] : zBase, 'fixed');
      let prev = bid;
      for (let k = 0; k <= top && k < S.length; k++) { const id = nid(S[k].id, c.i, c.j); addNode(id, x, y, S[k].z); members.push({ id: `col:${c.id}:${k}`, i: prev, j: id, sec: sec.id, mat: 'RC', beta: 0 }); prev = id; }
    });
    H.beams.forEach(b => {
      const st = S.find(s => s.id === b.st); if (!st) return; const sec = secOf(H, b.sec); addSec(sec);
      const ia = nid(st.id, b.a[0], b.a[1]), ib = nid(st.id, b.b[0], b.b[1]);
      addNode(ia, gx(H, b.a[0]), gy(H, b.a[1]), st.z); addNode(ib, gx(H, b.b[0]), gy(H, b.b[1]), st.z);
      members.push({ id: `beam:${b.id}`, i: ia, j: ib, sec: sec.id, mat: 'RC', beta: 0 });
    });
    // nodes that only carry beams need at least one column below somewhere: the frame solver reports a mechanism otherwise
    const cases = [{ id: 'D', name: 'Dead load', sw: true }, { id: 'L', name: 'Live load' }];
    const bm = id => `beam:${id}`;
    // load on a beam segment from a slab edge: shape 'tri' (peak q at mid) / 'trap' (q flat in the middle, ramps of length a) / 'uni'
    const edgeLoad = (beam, kgm, shape, a, cs) => {
      if (!beam || !(kgm > 0)) return; const L = Math.hypot(gx(H, beam.b[0]) - gx(H, beam.a[0]), gy(H, beam.b[1]) - gy(H, beam.a[1])), q = -kgm * KG;
      const push = (w1, w2, x0, x1) => loads.push({ case: cs, kind: 'udl', member: bm(beam.id), dir: 'grav', w1: -w1, w2: -w2, a: x0, b: x1 });
      if (shape === 'uni') push(q, q, 0, L);
      else if (shape === 'tri') { push(0, q, 0, L / 2); push(q, 0, L / 2, L); }
      else { const aa = min(a, L / 2); push(0, q, 0, aa); if (L - 2 * aa > 1e-6) push(q, q, aa, L - aa); push(q, 0, L - aa, L); }
    };
    // slabs
    H.slabs.forEach(s => {
      if (s.ground) return; const g = slabGeom(H, s), ld = slabLoads(H, s), i = s.i, j = s.j, st = s.st;
      const B = { s: beamOn(H, st, [i, j], [i + 1, j]), n: beamOn(H, st, [i, j + 1], [i + 1, j + 1]), w: beamOn(H, st, [i, j], [i, j + 1]), e: beamOn(H, st, [i + 1, j], [i + 1, j + 1]) };
      if (g.way === 'none') { warn.push(`พื้น ${s.mark || s.id} ไม่มีคานรองรับเพียงพอ — ไม่ได้ถ่ายน้ำหนัก`); return; }
      [['D', ld.D], ['L', ld.L]].forEach(([cs, q]) => {
        if (g.way === 'two') {
          const S2 = g.S / 2; // short edges carry triangles (peak q·S/2), long edges trapezoids
          if (g.Lx <= g.Ly) { edgeLoad(B.s, q * S2, 'trap', S2, cs); edgeLoad(B.n, q * S2, 'trap', S2, cs); edgeLoad(B.w, q * S2, 'tri', 0, cs); edgeLoad(B.e, q * S2, 'tri', 0, cs); }
          else { edgeLoad(B.w, q * S2, 'trap', S2, cs); edgeLoad(B.e, q * S2, 'trap', S2, cs); edgeLoad(B.s, q * S2, 'tri', 0, cs); edgeLoad(B.n, q * S2, 'tri', 0, cs); }
        } else if (g.way === 'x') { edgeLoad(B.w, q * g.Lx / 2, 'uni', 0, cs); edgeLoad(B.e, q * g.Lx / 2, 'uni', 0, cs); }
        else { edgeLoad(B.s, q * g.Ly / 2, 'uni', 0, cs); edgeLoad(B.n, q * g.Ly / 2, 'uni', 0, cs); }
      });
    });
    // walls: line load on the beam under the wall (height = storey height − depth of the beam above)
    H.walls.forEach(w => {
      const k = stIdx(H, w.st); if (k < 0) return; const b = beamOn(H, w.st, w.a, w.b); if (!b) { warn.push('ผนังที่ไม่มีคานรองรับถูกข้าม'); return; }
      const hz = k + 1 < S.length ? S[k + 1].z - S[k].z : 3.0, above = k + 1 < S.length ? beamOn(H, S[k + 1].id, w.a, w.b) : null, h = num(w.h, hz - (above ? secOf(H, above.sec).h / 100 : 0));
      edgeLoad(b, (WALLS[w.type] || WALLS.block10)[1] * h, 'uni', 0, 'D');
    });
    // stairs: one-way waist slab spanning in plan between the beam at its storey and the beam at the storey above
    H.stairs.forEach(t => {
      const k = stIdx(H, t.st); if (k < 0 || k + 1 >= S.length) return; const sd = stairDesign(H, t, null);
      const up = S[k + 1].id, i = t.i, j = t.j;
      const lower = t.dir === 'x' ? beamOn(H, t.st, [i, j], [i, j + 1]) : beamOn(H, t.st, [i, j], [i + 1, j]);
      const upper = t.dir === 'x' ? beamOn(H, up, [i + 1, j], [i + 1, j + 1]) : beamOn(H, up, [i, j + 1], [i + 1, j + 1]);
      [['D', sd.D], ['L', sd.L]].forEach(([cs, q]) => { edgeLoad(lower, q * sd.Lh / 2, 'uni', 0, cs); edgeLoad(upper, q * sd.Lh / 2, 'uni', 0, cs); });
      if (!lower || !upper) warn.push(`บันได ${t.id}: ต้องมีคานรองรับที่ชั้นล่างและชั้นบน`);
    });
    // roof: trusses span across, from eave beam to eave beam (gable / shed); a hip roof loads every perimeter beam like a two-way slab
    const rg = roofGeom(H), rl = roofLoads(H);
    if (rg && rl) {
      const bs = H.beams.filter(b => b.st === rg.st), onLine = (b, axis, v) => (axis === 'y' ? gy(H, b.a[1]) === v && gy(H, b.b[1]) === v : gx(H, b.a[0]) === v && gx(H, b.b[0]) === v);
      const eaveA = rg.dir === 'x' ? bs.filter(b => onLine(b, 'y', rg.y0)) : bs.filter(b => onLine(b, 'x', rg.x0)), eaveB = rg.dir === 'x' ? bs.filter(b => onLine(b, 'y', rg.y1)) : bs.filter(b => onLine(b, 'x', rg.x1));
      [['D', rl.D], ['L', rl.L]].forEach(([cs, q]) => {
        if (rg.type === 'hip') { const Lx = rg.x1 - rg.x0, Ly = rg.y1 - rg.y0, S2 = min(Lx, Ly) / 2 + rg.ov; bs.forEach(b => { const per = onLine(b, 'y', rg.y0) || onLine(b, 'y', rg.y1) || onLine(b, 'x', rg.x0) || onLine(b, 'x', rg.x1); if (per) edgeLoad(b, q * S2, 'uni', 0, cs); }); }
        else { const w = q * (rg.span / 2 + rg.ov); eaveA.forEach(b => edgeLoad(b, w, 'uni', 0, cs)); eaveB.forEach(b => edgeLoad(b, w, 'uni', 0, cs)); }
        // overhang at the gable ends rests on the end trusses: included through the end-span loads
      });
    }
    // wind: lateral pressure on the facade, lumped at the storey levels at the column heads (cases WX, WY)
    if (H.loads.wind && H.loads.wind.on) {
      const q = num(H.loads.wind.q, 50), W = H.grid.x[H.grid.x.length - 1] - H.grid.x[0], Dd = H.grid.y[H.grid.y.length - 1] - H.grid.y[0];
      cases.push({ id: 'WX', name: 'Wind X' }, { id: 'WY', name: 'Wind Y' });
      S.forEach((st, k) => {
        const hb = k > 0 ? (st.z - S[k - 1].z) / 2 : 0, ha = k + 1 < S.length ? (S[k + 1].z - st.z) / 2 : (rg ? rg.rise : 0) * 0.7;
        const h = hb + ha; if (h <= 0) return;
        const heads = H.columns.filter(c => stIdx(H, c.top) >= k); if (!heads.length) return;
        const FX = q * Dd * h * KG / heads.length, FY = q * W * h * KG / heads.length;
        heads.forEach(c => { loads.push({ case: 'WX', kind: 'node', node: nid(st.id, c.i, c.j), Fx: FX }); loads.push({ case: 'WY', kind: 'node', node: nid(st.id, c.i, c.j), Fy: FY }); });
      });
    }
    // combinations (strength method, ACI 318-99 / EIT): U = 1.4D + 1.7L; with wind 0.75(1.4D + 1.7L ± 1.7W), 0.9D ± 1.3W; service D + L
    const combos = defCombos(H);
    if (H.loads.combos && H.loads.combos.length) { const ids = new Set(cases.map(c => c.id)); return { model: { nodes, members, sections, materials, cases, loads, combos: userCombos(H, ids) }, warn, zBase }; }
    return { model: { nodes, members, sections, materials, cases, loads, combos }, warn, zBase };
  }
  function analyse(H, ft) {
    if (!G.FRAME) throw new Error('frame.js is required');
    const fm = frameModel(H, ft);
    if (!fm.model.members.length) throw new Error('ยังไม่มีชิ้นส่วนโครงสร้าง');
    const res = G.FRAME.analyse(fm.model, { nseg: 1, nps: 10 });
    const ult = fm.model.combos.filter(c => c.type === 'ULS').map(c => c.id);
    const env = G.FRAME.envelope(res, ult), sls = res.combos.SV;
    const byId = {}; env.mem.forEach((m, k) => { byId[m.id] = { env: m, sls: sls.mem[k], u1: res.combos.U1.mem[k] }; });
    // base reactions (kN -> t): service and ultimate, per column
    const RX = {}; fm.model.nodes.forEach((n, p) => { if (n.sup !== 'fixed') return; const s = sls.R.slice(6 * p, 6 * p + 6).map(v => v / KG / 1000), u = res.combos.U1.R.slice(6 * p, 6 * p + 6).map(v => v / KG / 1000); RX[n.id] = { s, u }; });
    return { fm, res, env, byId, RX, ft: ft || null, warn: fm.warn.concat(res.warn || []), combos: fm.model.combos };
  }

  // ------------------------------------------------------------------ RC design helpers (SDM, kg-cm)
  const phiB = 0.9, phiV = 0.85, phiC = 0.7;
  const beta1 = fc => (fc <= 280 ? 0.85 : max(0.65, 0.85 - 0.05 * (fc - 280) / 70));
  const rhoB = (fc, fy) => 0.85 * beta1(fc) * fc / fy * 6120 / (6120 + fy);
  // required steel ratio for Mu (kg-cm) on b x d (cm)
  function rhoReq(Mu, b, d, fc, fy) { const Rn = Mu / (phiB * b * d * d), t = 1 - 2 * Rn / (0.85 * fc); if (t < 0) return { rho: Infinity, Rn }; return { rho: 0.85 * fc / fy * (1 - sq(t)), Rn }; }
  // choose bars for As (cm²) in a width bw: smallest total weight with n >= nmin fitting one layer (clear >= max(2.5, db))
  function pickBars(As, bw, cover, stirD, list, nmin) {
    let best = null;
    (list || ['DB12', 'DB16', 'DB20', 'DB25']).forEach(k => {
      const a = barA(k), d = barD(k) / 10, n = max(nmin || 2, ceil(As / a - 1e-9)), clear = bw - 2 * cover - 2 * stirD / 10, fit = n * d + (n - 1) * max(2.5, d) <= clear + 1e-6;
      const layers = fit ? 1 : 2, w = n * a; if (layers > 1 && n * d + (ceil(n / 2) - 1) * max(2.5, d) > clear * 2) return;
      const sc = w * (layers > 1 ? 1.15 : 1); if (!best || sc < best.sc) best = { bar: k, n, As: n * a, layers, sc };
    });
    return best;
  }
  // stirrup spacing (cm) for Vu (kg) on b x d, legs Av
  function stirrups(Vu, b, d, fc, fys, bar) {
    const Vc = 0.53 * sq(fc) * b * d, pVc = phiV * Vc, Av = 2 * barA(bar), need = Vu > pVc / 2;
    let Vs = max(0, Vu / phiV - Vc), s;
    const sMax = Vs > 1.06 * sq(fc) * b * d ? d / 4 : d / 2, sMin = Av * fys / (3.5 * b);
    s = Vs > 0 ? Av * fys * d / Vs : 999;
    s = min(s, sMax, need ? sMin : 999, 30);
    s = max(5, floor(s / 2.5) * 2.5);
    return { Vc, pVc, Vs, s, Av, over: Vs > 2.1 * sq(fc) * b * d, bar };
  }
  const devLen = (bar, fc, fy) => { const db = barD(bar) / 10; return max(30, 0.06 * barA(bar) * fy / sq(fc), 0.0057 * db * fy); };

  // ------------------------------------------------------------------ slab design (two-way: EIT / ACI Method 2 coefficients; one-way: ACI coefficients)
  const M2 = { // case -> [short: neg cont, neg discont, pos] for m = 1.0 .9 .8 .7 .6 .5 ; long: [neg cont, neg discont, pos]
    1: [[.033, .040, .048, .055, .063, .083], [0, 0, 0, 0, 0, 0], [.025, .030, .036, .041, .047, .062], [.033, 0, .025]],
    2: [[.041, .048, .055, .062, .069, .085], [.021, .024, .027, .031, .035, .042], [.031, .036, .041, .047, .052, .064], [.041, .021, .031]],
    3: [[.049, .057, .064, .071, .078, .090], [.025, .028, .032, .036, .039, .045], [.037, .043, .048, .054, .059, .068], [.049, .025, .037]],
    4: [[.058, .066, .074, .082, .090, .098], [.029, .033, .037, .041, .045, .049], [.044, .050, .056, .062, .068, .074], [.058, .029, .044]],
    5: [[0, 0, 0, 0, 0, 0], [.033, .038, .043, .047, .053, .055], [.050, .057, .064, .072, .080, .083], [0, .033, .050]]
  };
  const coef = (row, m) => { const ms = [1, .9, .8, .7, .6, .5], mm = max(.5, min(1, m)); for (let k = 1; k < ms.length; k++) if (mm >= ms[k]) { const t = (ms[k - 1] - mm) / (ms[k - 1] - ms[k]); return row[k - 1] + (row[k] - row[k - 1]) * t; } return row[5]; };
  function slabBars(As, t, fy, ovBar) { // bar and spacing for As per m width (cm²/m)
    const L = ovBar ? [ovBar] : fy >= 3000 ? ['DB10', 'DB12', 'DB16'] : ['RB9', 'DB12'];
    for (const k of L) { const s = floor(min(100 * barA(k) / As, 3 * t, 30) / 2.5) * 2.5; if (s >= 10) return { bar: k, s, As: 100 * barA(k) / s }; }
    const k = L[L.length - 1]; return { bar: k, s: 10, As: 100 * barA(k) / 10 };
  }
  function slabDesign(H, s) {
    const M = H.mat, fc = M.fc, fy = M.fy, g = slabGeom(H, s), ld = slabLoads(H, s), t = num(s.t, 12), cov = M.cover.slab, ov = (H.over || {})['slab:' + s.id] || {};
    const fu = uFac(H), wu = fu.D * ld.D + fu.L * ld.L, d = t - cov - 0.6, b = 100, Asmin = (fy >= 3000 ? 0.0018 : 0.0025) * b * t;
    const out = { id: s.id, mark: s.mark, t, d, wu, ld, g, rows: [], warn: [] };
    if (s.ground) { const sb = slabBars(Asmin, t, fy, ov.bar); out.ground = true; out.rows.push({ pos: 'ทั้งสองทาง (เหล็กกันร้าว)', M: 0, ...sb, Aprov: sb.As, As: Asmin }); out.ok = true; return out; }
    const C = slabCont(H, s), nDisc = ['s', 'n', 'w', 'e'].filter(k => !C[k]).length;
    const kase = g.way === 'two' ? [1, 2, 3, 4, 5][nDisc] : null; out.case = kase;
    const mom = []; // [label, M kg-m/m]
    if (g.way === 'two') {
      const m = g.S / g.L, Tb = M2[kase], wS2 = wu * g.S * g.S; out.m = m;
      const shortCont = g.Lx <= g.Ly ? (C.w || C.e) : (C.s || C.n), longCont = g.Lx <= g.Ly ? (C.s || C.n) : (C.w || C.e);
      mom.push(['ช่วงสั้น โมเมนต์ลบ (ด้านต่อเนื่อง)', shortCont ? coef(Tb[0], m) * wS2 : 0, coef(Tb[0], m)]);
      mom.push(['ช่วงสั้น โมเมนต์ลบ (ด้านไม่ต่อเนื่อง)', coef(Tb[1], m) * wS2, coef(Tb[1], m)]);
      mom.push(['ช่วงสั้น โมเมนต์บวก', coef(Tb[2], m) * wS2, coef(Tb[2], m)]);
      mom.push(['ช่วงยาว โมเมนต์ลบ (ด้านต่อเนื่อง)', longCont ? Tb[3][0] * wS2 : 0, Tb[3][0]]);
      mom.push(['ช่วงยาว โมเมนต์ลบ (ด้านไม่ต่อเนื่อง)', Tb[3][1] * wS2, Tb[3][1]]);
      mom.push(['ช่วงยาว โมเมนต์บวก', Tb[3][2] * wS2, Tb[3][2]]);
    } else if (g.way === 'x' || g.way === 'y') {
      const Lsp = g.way === 'x' ? g.Lx : g.Ly, cA = g.way === 'x' ? C.w : C.s, cB = g.way === 'x' ? C.e : C.n, nc = (cA ? 1 : 0) + (cB ? 1 : 0), w2 = wu * Lsp * Lsp;
      mom.push(['ทางเดียว โมเมนต์ลบ', nc ? w2 / (nc === 2 ? 11 : 10) : w2 / 24, nc ? (nc === 2 ? 1 / 11 : 1 / 10) : 1 / 24]);
      mom.push(['ทางเดียว โมเมนต์บวก', w2 / [8, 10, 14][nc], 1 / [8, 10, 14][nc]]);
      out.span = Lsp;
    } else { out.warn.push('ไม่มีคานรองรับ'); out.ok = false; return out; }
    let okAll = true;
    mom.forEach(([pos, Mm, c]) => {
      const Mu = Mm * 100, r = rhoReq(Mu, b, d, fc, fy), As = max(isFinite(r.rho) ? r.rho * b * d : Infinity, Asmin), ok = isFinite(As) && r.rho <= 0.75 * rhoB(fc, fy);
      const sb = slabBars(isFinite(As) ? As : Asmin, t, fy, ov.bar); if (!ok) okAll = false;
      out.rows.push({ pos, C: c, M: Mm, Mu: Mm, Rn: r.Rn, rho: r.rho, ...sb, Aprov: sb.As, As, ok });
    });
    // shear: Vu = wu S / 2 per m (two-way: conservative) vs φVc
    const Vu = wu * (g.way === 'two' ? g.S : out.span || g.S) / 2, pVc = phiV * 0.53 * sq(fc) * b * d;
    out.Vu = Vu; out.pVc = pVc; if (Vu > pVc) { okAll = false; out.warn.push('แรงเฉือนเกิน — เพิ่มความหนา'); }
    const hmin = g.way === 'two' ? (g.S * 100 * 2 + g.L * 100 * 2) / 180 : (out.span || g.S) * 100 / 24; out.hmin = max(g.way === 'two' ? 9 : 8, hmin);
    if (t < out.hmin - 0.01) out.warn.push(`ความหนาน้อยกว่า ${r2(out.hmin)} ซม. (ควบคุมการแอ่นตัว)`);
    out.ok = okAll; return out;
  }

  // ------------------------------------------------------------------ beam design (per span, from the ultimate envelope)
  function beamDesign(H, A, b) {
    const M = H.mat, fc = M.fc, fy = M.fy, sec = secOf(H, b.sec), bw = sec.b, h = sec.h, cov = M.cover.beam, ov = (H.over || {})['beam:' + b.id] || {}, stb = ov.stir || (bw >= 25 ? 'RB9' : 'RB6');
    const R = A && A.byId['beam:' + b.id]; const out = { id: b.id, mark: b.mark, sec, b: bw, h, warn: [] };
    if (!R) { out.ok = false; out.warn.push('ยังไม่วิเคราะห์'); return out; }
    const e = R.env, k2 = 1 / KG / 1000; // kN·m -> t·m
    const Mpos = max(0, ...e.Mzmax) * k2, Mneg = max(0, ...e.Mzmin.map(v => -v)) * k2;
    const Mneg1 = max(0, -e.Mzmin[0]) * k2, Mneg2 = max(0, -e.Mzmin[e.Mzmin.length - 1]) * k2, Vu = max(...e.Vymax.map(abs), ...e.Vymin.map(abs)) * k2;
    const dmain = 1.6, d = h - cov - barD(stb) / 10 - dmain / 2, Asmin = max(14 / fy, 0.8 * sq(fc) / fy) * bw * d, rmax = 0.75 * rhoB(fc, fy);
    const flex = (Mtm, label, ovBar, ovN) => {
      const Mu = Mtm * 1e5, r = rhoReq(Mu, bw, d, fc, fy), As = max(isFinite(r.rho) ? r.rho * bw * d : Infinity, Mtm > 0.01 ? Asmin : 0), ok = isFinite(As) && r.rho <= rmax;
      let pk = ovBar ? { bar: ovBar, n: max(2, ovN || ceil((isFinite(As) ? As : 0) / barA(ovBar))), layers: 1 } : pickBars(isFinite(As) ? max(As, 2 * barA('DB12')) : 4 * barA('DB25'), bw, cov, barD(stb), null, 2);
      if (!pk) pk = { bar: 'DB25', n: 4, layers: 2 }; pk.As = pk.n * barA(pk.bar);
      return { label, Mu: Mtm, Rn: r.Rn, rho: r.rho, ...pk, Aprov: pk.As, As, ok: ok && pk.As >= As - 1e-6 };
    };
    out.d = d; out.Asmin = Asmin; out.rmax = rmax; out.L = R.env.L;
    out.top = flex(max(Mneg1, Mneg2, Mneg), 'โมเมนต์ลบ (ที่ฐานรองรับ)', ov.top, ov.ntop);
    out.bot = flex(Mpos, 'โมเมนต์บวก (กลางช่วง)', ov.bot, ov.nbot);
    // keep at least 2 bars top and bottom through the span (hangers / corner bars)
    const st = stirrups(Vu * 1000, bw, d, fc, M.fys, stb); if (ov.s) st.s = +ov.s;
    out.Vu = Vu; out.shear = st; out.Mpos = Mpos; out.Mneg = Mneg;
    // serviceability: minimum depth (ACI Table 9.5a) with fy factor
    const L = R.env.L, cont = beamContinuity(H, b), den = cont === 2 ? 21 : cont === 1 ? 18.5 : 16, hmin = L * 100 / den * (0.4 + fy / 7000);
    out.hmin = hmin; out.cont = cont;
    const sv = R.sls; out.defl = max(...sv.drel.map(abs)) * 1000; // mm (elastic, gross section)
    if (h < hmin - 0.01) out.warn.push(`ความลึกน้อยกว่า L/${den} = ${r2(hmin)} ซม. — ตรวจการแอ่นตัว`);
    if (!out.top.ok || !out.bot.ok) out.warn.push('เหล็กเสริมเกิน ρmax — เพิ่มขนาดหน้าตัด');
    if (st.over) out.warn.push('แรงเฉือนเกินขีดจำกัด — เพิ่มขนาดหน้าตัด');
    out.ok = out.top.ok && out.bot.ok && !st.over;
    out.ur = max(isFinite(out.top.As) ? out.top.As / out.top.Aprov : 9, isFinite(out.bot.As) ? out.bot.As / out.bot.Aprov : 9, Vu * 1000 / max(1, phiV * (st.Vc + st.Av * M.fys * d / st.s)));
    return out;
  }
  function beamContinuity(H, b) { // number of continuous ends (another collinear beam beyond the end)
    const dx = Math.sign(b.b[0] - b.a[0]), dy = Math.sign(b.b[1] - b.a[1]);
    const before = beamOn(H, b.st, [b.a[0] - dx, b.a[1] - dy], b.a), after = beamOn(H, b.st, b.b, [b.b[0] + dx, b.b[1] + dy]);
    return (before ? 1 : 0) + (after ? 1 : 0);
  }

  // ------------------------------------------------------------------ column design (P–M interaction, strain compatibility, biaxial by load contour α = 1.5)
  function interaction(b, h, cov, bar, n, fc, fy, Pu) { // bending about the axis parallel to b (depth h); bars around the perimeter
    const db = barD(bar) / 10, Ab = barA(bar), dt = cov + 0.9 + db / 2, E = 2.04e6, ey = fy / E, b1 = beta1(fc);
    // bar layout: 4 corners + the rest split between the two faces perpendicular to h and the two side faces
    const rows = []; const nPer = max(0, n - 4), nFace = floor(nPer / 4) * 1 + (nPer % 4 >= 2 ? 1 : 0), nSide = (nPer - 2 * nFace) / 2;
    rows.push([dt, 2 + nFace]); rows.push([h - dt, 2 + nFace]); for (let k = 1; k <= nSide; k++) rows.push([dt + (h - 2 * dt) * k / (nSide + 1), 2]);
    const Ast = n * Ab, P0 = 0.85 * fc * (b * h - Ast) + fy * Ast, Pmax = 0.8 * phiC * P0;
    const at = c => { let P = 0, Mm = 0; const a = min(b1 * c, h); P += 0.85 * fc * a * b; Mm += 0.85 * fc * a * b * (h / 2 - a / 2);
      rows.forEach(([y, m]) => { const es = 0.003 * (c - y) / c, fs = max(-fy, min(fy, es * E)), F = m * Ab * (fs - (y < a ? 0.85 * fc : 0)); P += F; Mm += F * (h / 2 - y); });
      const et = 0.003 * (h - dt - c) / c, phi = Pu === undefined ? phiC : (P >= 0.1 * fc * b * h ? phiC : phiB - (phiB - phiC) * P / (0.1 * fc * b * h)); return { P, M: Mm, phi: max(phiC, min(phiB, phi)) }; };
    // find φMn at the given Pu by bisection on c
    let lo = 0.01, hi = 5 * h, f = c => { const r = at(c); return r.phi * r.P - Pu; };
    if (Pu > Pmax) return { ok: false, Pmax, P0, phiMn: 0 };
    for (let k = 0; k < 80; k++) { const mid = (lo + hi) / 2; if (f(mid) > 0) hi = mid; else lo = mid; }
    const r = at((lo + hi) / 2); return { ok: true, Pmax, P0, phiMn: r.phi * r.M, c: (lo + hi) / 2 };
  }
  function columnDesign(H, A, c, k) { // k: storey segment index (0 = pedestal below the first storey)
    const M = H.mat, fc = M.fc, fy = M.fy, sec = secOf(H, c.sec), b = sec.b, h = sec.h, cov = M.cover.col, ov = (H.over || {})['col:' + c.id + ':' + k] || (H.over || {})['col:' + c.id] || {};
    const R = A && A.byId[`col:${c.id}:${k}`], out = { id: c.id, k, sec, b, h, warn: [] }; if (!R) { out.ok = false; return out; }
    const e = R.env, kt = 1 / KG / 1000;
    const Pu = max(0, -min(...e.Nmin)) * kt * 1000, Mz = max(...e.Mzmax.map(abs), ...e.Mzmin.map(abs)) * kt, My = max(...e.Mymax.map(abs), ...e.Mymin.map(abs)) * kt;
    const Lu = R.env.L, rmin = 0.3 * min(b, h) / 100, kl = Lu / rmin; out.Lu = Lu; out.slender = kl;
    // non-sway magnifier (k = 1, Cm = 1), EI = 0.4 Ec Ig / (1 + βd), βd = 0.6
    const Ec = 15100 * sq(fc), mag = I => { if (kl <= 22) return 1; const Pc = PI * PI * 0.4 * Ec * I / 1.6 / (Lu * 100) ** 2; return max(1, 1 / (1 - Pu / (0.75 * Pc))); };
    const dz = mag(b * h ** 3 / 12), dy = mag(h * b ** 3 / 12), emin = (1.5 + 0.03 * h) / 100;
    const Mux = max(Mz * dz, Pu / 1000 * emin), Muy = max(My * dy, Pu / 1000 * emin);
    out.Pu = Pu / 1000; out.Mux = Mux; out.Muy = Muy; out.dz = dz; out.dy = dy;
    const tryBars = (bar, n) => { const ix = interaction(b, h, cov, bar, n, fc, fy, Pu), iy = interaction(h, b, cov, bar, n, fc, fy, Pu); if (!ix.ok || !iy.ok) return { ok: false, ur: Infinity, ix, iy }; const rx = Mux * 1e5 / max(1, ix.phiMn), ry = Muy * 1e5 / max(1, iy.phiMn), ur = Math.pow(Math.pow(rx, 1.5) + Math.pow(ry, 1.5), 1 / 1.5); return { ok: ur <= 1, ur, ix, iy, rx, ry }; };
    let pick = null;
    if (ov.bar) { const r = tryBars(ov.bar, +ov.n || 4); pick = { bar: ov.bar, n: +ov.n || 4, ...r }; }
    else for (const n of [4, 6, 8, 10, 12, 16]) { for (const bar of ['DB12', 'DB16', 'DB20', 'DB25']) { const rho = n * barA(bar) / (b * h); if (rho < 0.01 - 1e-9 || rho > 0.04) continue; const r = tryBars(bar, n); if (r.ok) { pick = { bar, n, ...r }; break; } } if (pick) break; }
    if (!pick) { pick = { bar: 'DB25', n: 16, ...tryBars('DB25', 16) }; out.warn.push('หน้าตัดเล็กเกินไป — ขยายหน้าตัดเสา'); }
    const tie = ov.tie || 'RB6', s = min(16 * barD(pick.bar) / 10, 48 * barD(tie) / 10, min(b, h)); out.tie = tie; out.s = floor(s / 2.5) * 2.5;
    out.bar = pick.bar; out.n = pick.n; out.ur = pick.ur; out.rho = pick.n * barA(pick.bar) / (b * h); out.Pmax = pick.ix.Pmax / 1000; out.phiMnx = (pick.ix.phiMn || 0) / 1e5; out.phiMny = (pick.iy.phiMn || 0) / 1e5;
    out.ok = pick.ok; return out;
  }

  // ------------------------------------------------------------------ footings (spread on soil or a pile cap) and pedestals
  const PILE_PATTERNS = { 1: [[0, 0]], 2: [[-.5, 0], [.5, 0]], 3: [[-.5, -.2887], [.5, -.2887], [0, .5774]], 4: [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]], 5: [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5], [0, 0]], 6: [[-1, -.5], [0, -.5], [1, -.5], [-1, .5], [0, .5], [1, .5]] };
  function footingDesign(H, A, c) {
    const M = H.mat, fc = M.fc, fy = M.fy, So = H.soil, sec = secOf(H, c.sec), cb = sec.b, ch = sec.h, ov = (H.over || {})['fnd:' + c.id] || {};
    const Rx = A && A.RX[`F:${c.i}:${c.j}`]; const out = { id: c.id, i: c.i, j: c.j, warn: [] }; if (!Rx) { out.ok = false; return out; }
    const Ps = max(0, Rx.s[2]), Pu = max(0, Rx.u[2]); out.Ps = Ps; out.Pu = Pu;
    const cov = M.cover.fnd, Df = num(So.Df, 1.5);
    let B, L, t = num(ov.t, 0), n = 0, pts = null;
    if (So.type === 'pile') {
      const cap = num(So.pile.cap, 15), s = num(So.pile.s, 0.6), D = num(So.pile.D, 18) / 100;
      n = ov.np ? +ov.np : 1; while (n < 6 && (Ps * 1.1) / n > cap) n++; // cap self weight ~10 %
      pts = (PILE_PATTERNS[n] || PILE_PATTERNS[6]).map(([u, v]) => [u * s, v * s]);
      const ex = max(...pts.map(p => abs(p[0]))), ey = max(...pts.map(p => abs(p[1])));
      B = num(ov.B, max(2 * ex + D + 0.3, cb / 100 + 0.3)); L = num(ov.L, max(2 * ey + D + 0.3, ch / 100 + 0.3));
      out.np = n; out.pts = pts; out.capP = cap; out.Rpile = Ps * 1.1 / n;
      if (out.Rpile > cap + 1e-6) out.warn.push('น้ำหนักต่อต้นเกินกำลังเข็ม');
    } else {
      const qa = num(So.qa, 10), qnet = qa - (Df) * (So.gs || 1.8) * 0 - 0; // gross allowable; the footing and soil weight are added below
      const Wfs = Df * 2.0; // t/m² of footing + backfill (≈ 2.0 t/m³ average)
      const Areq = Ps / max(0.5, qa - Wfs); B = num(ov.B, max(1.0, ceil(sq(Areq) * 20) / 20)); L = num(ov.L, B);
      out.qa = qa; out.Areq = Areq; out.q = (Ps) / (B * L) + Wfs;
      if (out.q > qa + 1e-6) out.warn.push('แรงแบกทานดินเกิน');
    }
    // thickness by punching and one-way shear (SDM)
    const bar0 = ov.bar || 'DB12', db = barD(bar0) / 10;
    const qu = Pu / (B * L);  // t/m² net ultimate (spread), or pile reactions for the cap
    const check = tt => {
      const d = tt - cov - db, c1 = cb + d, c2 = ch + d, b0 = 2 * (c1 + c2), bc = max(cb, ch) / min(cb, ch);
      let Vp, V1x, V1y;
      if (So.type === 'pile') { const Pr = Pu / n; const inside = p => abs(p[0]) * 100 < c1 / 2 && abs(p[1]) * 100 < c2 / 2; Vp = pts.filter(p => !inside(p)).length * Pr; const face = (B * 100 / 2 - cb / 2 - d) / 100; V1x = pts.filter(p => p[0] > cb / 200 + d / 100).length * Pr; V1y = pts.filter(p => p[1] > ch / 200 + d / 100).length * Pr; }
      else { Vp = qu * (B * L - c1 * c2 / 1e4); V1x = qu * L * max(0, B / 2 - cb / 200 - d / 100); V1y = qu * B * max(0, L / 2 - ch / 200 - d / 100); }
      const pVp = phiV * min(0.27 * (2 + 4 / bc), 0.27 * (40 * d / b0 + 2), 1.06) * sq(fc) * b0 * d / 1000;
      const pV1x = phiV * 0.53 * sq(fc) * L * 100 * d / 1000, pV1y = phiV * 0.53 * sq(fc) * B * 100 * d / 1000;
      return { d, b0, Vp, pVp, V1x, pV1x, V1y, pV1y, ok: Vp <= pVp && V1x <= pV1x && V1y <= pV1y };
    };
    if (!t) { t = 30; while (t < 120 && !check(t).ok) t += 5; }
    const sh = check(t); out.B = B; out.L = L; out.t = t; out.sh = sh; out.d = sh.d;
    // flexure at the column face, both directions
    const flexDir = (span, width, cface) => {
      let Mu;
      if (So.type === 'pile') { const Pr = Pu / n; Mu = pts.reduce((s, p) => s + (abs(p[span === 'x' ? 0 : 1]) * 100 > cface / 2 ? Pr * (abs(p[span === 'x' ? 0 : 1]) - cface / 200) / 2 : 0), 0); }
      else { const arm = ((span === 'x' ? B : L) / 2 - cface / 200); Mu = qu * width * arm * arm / 2; }
      const r = rhoReq(Mu * 1e5, width * 100, sh.d, fc, fy), As = max(isFinite(r.rho) ? r.rho * width * 100 * sh.d : Infinity, 0.0018 * width * 100 * t);
      const bar = ov.bar || (As / (width * 100) * 100 > 12 ? 'DB16' : 'DB12'), nb = max(4, ceil(As / barA(bar))), s = floor(((width * 100 - 2 * cov) / (nb - 1)) / 2.5) * 2.5;
      return { Mu, Rn: r.Rn, rho: r.rho, As, bar, n: nb, s, ok: isFinite(As) && r.rho <= 0.75 * rhoB(fc, fy) };
    };
    out.fx = flexDir('x', L, cb); out.fy = flexDir('y', B, ch);
    out.ok = sh.ok && out.fx.ok && out.fy.ok && !out.warn.length;
    if (!sh.ok) out.warn.push('ความหนาฐานรากไม่พอต่อแรงเฉือน');
    return out;
  }

  // ------------------------------------------------------------------ stair (one-way waist slab, simply supported in plan)
  function stairDesign(H, t, A) {
    const M = H.mat, S = stories(H), k = stIdx(H, t.st), hgt = k >= 0 && k + 1 < S.length ? S[k + 1].z - S[k].z : 3.0;
    const Lh = t.dir === 'x' ? gx(H, t.i + 1) - gx(H, t.i) : gy(H, t.j + 1) - gy(H, t.j), W = t.dir === 'x' ? gy(H, t.j + 1) - gy(H, t.j) : gx(H, t.i + 1) - gx(H, t.i);
    const nr = max(2, round(hgt / 0.18)), R = hgt / nr, Tr = Lh / (nr - 1), th = Math.atan2(hgt, Lh), tw = num(t.t, 15);
    const D = (tw / 100 / Math.cos(th) + R / 2) * M.ws + 100, Lq = (LL.stair)[1], fu = uFac(H), wu = fu.D * D + fu.L * Lq, Mu = wu * Lh * Lh / 8;
    const d = tw - M.cover.slab - 0.6, r = rhoReq(Mu * 100, 100, d, M.fc, M.fy), Asmin = 0.0018 * 100 * tw, As = max(isFinite(r.rho) ? r.rho * 100 * d : Infinity, Asmin);
    const main = slabBars(isFinite(As) ? As : Asmin, tw, M.fy), dist = slabBars(Asmin, tw, M.fy, M.fy >= 3000 ? 'DB10' : 'RB9');
    const Vu = wu * Lh / 2, pVc = phiV * 0.53 * sq(M.fc) * 100 * d;
    return { id: t.id, Lh, W, hgt, nr, R, Tr, th, t: tw, D, L: Lq, wu, Mu, d, Rn: r.Rn, rho: r.rho, As, main, dist, ok: isFinite(As) && r.rho <= 0.75 * rhoB(M.fc, M.fy) && Vu <= pVc, Vu, pVc };
  }

  // ------------------------------------------------------------------ steel roof: purlins (C-lip) and the truss (ASD, AISC / EIT)
  function Fa(KLr, Fy, E) { const Cc = sq(2 * PI * PI * E / Fy); if (KLr <= Cc) { const q = KLr / Cc; return (1 - q * q / 2) * Fy / (5 / 3 + 3 / 8 * q - q * q * q / 8); } return 12 * PI * PI * E / (23 * KLr * KLr); }
  function trussGeom(g) { // Howe truss (gable) or mono-pitch Pratt (shed) spanning g.span; panel ≈ 1 m
    const L = g.span, n = max(2, 2 * round(L / 2 / 1.0)), rise = g.rise, nodes = [], mem = [];
    if (g.type === 'shed') { // mono-pitch Pratt: bottom nodes 0..np, top nodes 1..np (the top chord starts at bottom node 0)
      const np = max(2, round(L / 1.0)), bI = [], tI = []; for (let k = 0; k <= np; k++) { bI[k] = nodes.length; nodes.push([k * L / np, 0]); if (k) { tI[k] = nodes.length; nodes.push([k * L / np, rise * k / np]); } }
      tI[0] = bI[0]; for (let k = 0; k < np; k++) { mem.push(['bc', bI[k], bI[k + 1]]); mem.push(['tc', tI[k], tI[k + 1]]); }
      for (let k = 1; k <= np; k++) mem.push(['vt', bI[k], tI[k]]); for (let k = 1; k < np; k++) mem.push(['dg', bI[k + 1], tI[k]]);
      return { nodes, mem, sup: [bI[0], bI[np]], top: tI.slice() }; }
    for (let k = 0; k <= n; k++) { const x = k * L / n, z = rise * (1 - abs(2 * x / L - 1)); nodes.push([x, 0]); if (k > 0 && k < n) nodes.push([x, z]); }
    // index helpers: bottom k -> b(k), top k (1..n-1) -> t(k)
    const bI = [], tI = []; let p = 0; for (let k = 0; k <= n; k++) { bI[k] = p++; if (k > 0 && k < n) tI[k] = p++; }
    for (let k = 0; k < n; k++) mem.push(['bc', bI[k], bI[k + 1]]);
    const T = k => (k === 0 ? bI[0] : k === n ? bI[n] : tI[k]);
    for (let k = 0; k < n; k++) mem.push(['tc', T(k), T(k + 1)]);
    for (let k = 1; k < n; k++) mem.push(['vt', bI[k], tI[k]]);
    for (let k = 1; k < n - 1; k++) { if (k < n / 2) mem.push(['dg', bI[k + 1], tI[k]]); else if (k >= n / 2) mem.push(['dg', bI[k], tI[k + 1]]); }
    return { nodes, mem, sup: [bI[0], bI[n]], top: [bI[0]].concat(tI.filter(v => v != null)).concat([bI[n]]) };
  }
  function roofDesign(H) {
    const R = H.roof, g = roofGeom(H), rl = roofLoads(H); if (!g || !rl) return null;
    const Fy = num(H.mat.Fy, 2400), E = H.mat.Es, sp = num(R.sp, 1.0), psp = num(R.psp, 1.0), out = { g, rl, sp, psp, warn: [] };
    // purlins: simply supported between trusses (span = truss spacing), biaxial bending on the slope (ASD):
    // gravity per m  w = cover·psp + self weight + LL·cosθ·psp  →  normal wn = w·cosθ (strong axis, span L), along the slope wt = w·sinθ
    // (weak axis, span L / (n_sag + 1) with sag rods); fbx/Fbx + fby/Fby ≤ 1 with Fbx = 0.6Fy, Fby = 0.75Fy; deflections ≤ L/180 both ways
    const cs = Math.cos(g.th), sn = Math.sin(g.th), cov = (ROOFS[R.cover] || ROOFS.tile)[1], nsag = R.sag == null ? (sp > 3 ? 2 : sp > 1.6 ? 1 : 0) : max(0, round(+R.sag)), Ly = sp / (nsag + 1);
    const pChk = nm => { const p = steelProps('clip', nm), w = cov * psp + p.w + rl.L * cs * psp, wn = w * cs, wt = w * sn, Mx = wn * sp * sp / 8, My = wt * Ly * Ly / 8;
      const fbx = Mx * 100 / p.Sx, fby = My * 100 / p.Sy, Fbx = 0.6 * Fy, Fby = 0.75 * Fy, ur = fbx / Fbx + fby / Fby;
      const dx = 5 * wn / 100 * (sp * 100) ** 4 / (384 * E * p.Ix), dy = 5 * wt / 100 * (Ly * 100) ** 4 / (384 * E * p.Iy), dlim = sp * 100 / 180, dlimy = Ly * 100 / 180;
      return { name: nm, p, w, wn, wt, M: Mx, Mx, My, fb: fbx, fbx, fby, Fbx, Fby, ur, dl: dx, dx, dy, dlim, dlimy, nsag, Ly, ok: ur <= 1 && dx <= dlim && dy <= dlimy }; };
    let purl = null; for (const nm of CLIP) { const q = pChk(nm); if (q.ok) { purl = q; break; } }
    if (R.purlin) purl = pChk(R.purlin);
    out.purlin = purl; if (!purl) out.warn.push('แปเกินขนาดในตาราง');
    // truss: 2D analysis (pinned members), panel loads from the roof load × truss spacing
    const tg = trussGeom(g), nodes = tg.nodes.map((p, i) => ({ id: 'n' + i, x: p[0], y: 0, z: p[1], sup: i === tg.sup[0] ? 'pin' : i === tg.sup[1] ? 'rollerX' : 'free' }));
    nodes.forEach(n => { if (n.sup === 'free') n.fix = null; });
    // restrain out-of-plane: every node fixed in y, rotations free (truss)
    nodes.forEach(n => { n.sup = 'custom'; n.fix = [0, 1, 0, 1, 1, 1]; }); nodes[tg.sup[0]].fix = [1, 1, 1, 1, 1, 1]; nodes[tg.sup[1]].fix = [0, 1, 1, 1, 1, 1];
    const members = tg.mem.map((m, i) => ({ id: m[0] + i, i: 'n' + m[1], j: 'n' + m[2], sec: 'S', mat: 'ST', type: 'truss' }));
    const topN = [...new Set(tg.top)].sort((a, b) => tg.nodes[a][0] - tg.nodes[b][0]);
    const loads = [];
    topN.forEach((p, k) => { const xl = k > 0 ? (tg.nodes[p][0] - tg.nodes[topN[k - 1]][0]) / 2 : 0, xr = k + 1 < topN.length ? (tg.nodes[topN[k + 1]][0] - tg.nodes[p][0]) / 2 : 0, trib = (xl + xr) + ((k === 0 || k === topN.length - 1) ? g.ov : 0); loads.push({ case: 'D', kind: 'node', node: 'n' + p, Fz: -rl.D * sp * trib * KG }); loads.push({ case: 'L', kind: 'node', node: 'n' + p, Fz: -rl.L * sp * trib * KG }); });
    const model = { nodes, members, sections: [{ id: 'S', type: 'rect', b: 50, h: 50 }], materials: [{ id: 'ST', E: 200000, nu: 0.3, rho: 0 }], cases: [{ id: 'D', name: 'D' }, { id: 'L', name: 'L' }], loads, combos: [{ id: 'S1', name: 'D + L', f: { D: 1, L: 1 }, type: 'SLS' }] };
    let res; try { res = G.FRAME.analyse(model, { nseg: 1, nps: 2 }); } catch (e) { out.warn.push('วิเคราะห์โครงถักไม่สำเร็จ: ' + e.message); return out; }
    const Nmem = res.combos.S1.mem.map((m, k) => ({ id: m.id, kind: tg.mem[k][0], L: m.L, N: m.N[0] / KG })); // kg, tension +
    const groups = {}; Nmem.forEach(m => { const g0 = groups[m.kind] = groups[m.kind] || { kind: m.kind, Nt: 0, Nc: 0, L: 0 }; g0.Nt = max(g0.Nt, m.N); g0.Nc = max(g0.Nc, -m.N); g0.L = max(g0.L, m.L); });
    const pick = gr => { const list = R['sec_' + gr.kind] ? [R['sec_' + gr.kind]] : BOX; for (const nm of list) { const p = steelProps('box', nm), KLr = gr.L * 100 / min(p.rx, p.ry), fa = Fa(KLr, Fy, E), ft = 0.6 * Fy, urc = gr.Nc / p.A / fa, urt = gr.Nt / p.A / ft; if ((urc <= 1 && urt <= 1 && KLr <= 200) || list.length === 1) return { name: nm, p, KLr, fa, ft, urc, urt, ur: max(urc, urt), ok: urc <= 1 && urt <= 1 && KLr <= 200 }; } return null; };
    out.truss = { geom: tg, members: Nmem, groups: Object.values(groups).map(gr => Object.assign(gr, { sec: pick(gr) })), R: res.combos.S1.R };
    out.nTruss = floor((g.len) / sp) + 1; out.reaction = (rl.D + rl.L) * sp * (g.span / 2 + g.ov);
    out.ok = !!purl && purl.ok && out.truss.groups.every(gr => gr.sec && gr.sec.ok);
    return out;
  }

  // analyse and design, then re-analyse with every pedestal running down to the top of its designed footing (thickness t)
  // until the footing thicknesses stop changing (normally one extra pass)
  function solve(H) {
    let A = analyse(H), D = designAll(H, A);
    for (let k = 0; k < 4; k++) {
      const ft = {}; D.fnds.forEach(f => { if (f.t) ft[f.id] = f.t / 100; });
      const used = A.ft || {}, same = H.columns.every(c => abs((used[c.id] || 0.3) - (ft[c.id] || 0.3)) < 1e-9);
      if (same) break; A = analyse(H, ft); D = designAll(H, A);
    }
    return { A, D };
  }
  // ------------------------------------------------------------------ design everything + marks
  function designAll(H, A) {
    const S = stories(H), D = { slabs: [], beams: [], cols: [], fnds: [], stairs: [], roof: null, warn: [] };
    H.slabs.forEach(s => D.slabs.push(slabDesign(H, s)));
    H.beams.forEach(b => D.beams.push(Object.assign(beamDesign(H, A, b), { st: b.st, a: b.a, bb: b.b })));
    H.columns.forEach(c => { const top = stIdx(H, c.top); for (let k = 0; k <= top; k++) D.cols.push(Object.assign(columnDesign(H, A, c, k), { st: k === 0 ? 'P' : S[k - 1].id, seg: k })); });
    H.columns.forEach(c => D.fnds.push(footingDesign(H, A, c)));
    H.stairs.forEach(t => D.stairs.push(stairDesign(H, t, A)));
    D.roof = roofDesign(H);
    marks(H, D);
    return D;
  }
  // group equal designs under one mark: GB1.., B1.. (by storey type), RB1..; C1.. by section and bars; F1..; S1..
  function marks(H, D) {
    const S = stories(H), pref = st => { const k = stIdx(H, st); return k === 0 ? 'GB' : k === S.length - 1 ? 'RB' : 'B'; };
    const tag = (list, key, prefix) => { const seen = {}, cnt = {}; list.forEach(x => { const k = key(x); if (!k) return; const p = prefix(x); if (!seen[p + '|' + k]) { cnt[p] = (cnt[p] || 0) + 1; seen[p + '|' + k] = p + cnt[p]; } x.mark = seen[p + '|' + k]; }); };
    tag(D.beams.filter(b => b.top), b => [b.b, b.h, b.top.bar, b.top.n, b.bot.bar, b.bot.n, b.shear.bar, b.shear.s].join(','), b => pref(b.st));
    tag(D.cols.filter(c => c.bar), c => [c.b, c.h, c.bar, c.n, c.tie, c.s].join(','), c => (c.seg === 0 ? 'P' : 'C'));
    tag(D.fnds.filter(f => f.B), f => [f.B, f.L, f.t, f.np || 0, f.fx.bar, f.fx.n, f.fy.bar, f.fy.n].join(','), () => 'F');
    tag(D.slabs.filter(s => s.rows.length), s => [s.t, s.ground ? 'g' : '', s.rows.map(r => r.bar + '@' + r.s).join(';')].join(','), s => (s.ground ? 'SG' : 'S'));
    D.stairs.forEach((t, i) => { t.mark = 'ST' + (i + 1); });
  }
  // overall utilisation summary
  function summary(D) {
    const L = [];
    D.slabs.forEach(s => L.push({ k: 'พื้น', mark: s.mark, ok: s.ok, warn: s.warn }));
    D.beams.forEach(b => L.push({ k: 'คาน', mark: b.mark, ok: b.ok, warn: b.warn }));
    D.cols.forEach(c => L.push({ k: c.seg === 0 ? 'ตอม่อ' : 'เสา', mark: c.mark, ok: c.ok, ur: c.ur, warn: c.warn }));
    D.fnds.forEach(f => L.push({ k: 'ฐานราก', mark: f.mark, ok: f.ok, warn: f.warn }));
    D.stairs.forEach(t => L.push({ k: 'บันได', mark: t.mark, ok: t.ok, warn: [] }));
    if (D.roof) L.push({ k: 'โครงหลังคา', mark: 'RT', ok: D.roof.ok, warn: D.roof.warn });
    return { list: L, nOk: L.filter(x => x.ok).length, nBad: L.filter(x => !x.ok).length };
  }

  G.HOUSE = { KG, BARS, barD, barA, barW, BOX, CLIP, steelProps, LL, WALLS, ROOFS, defaults, example, auto, stories, stIdx, topSt, secOf, beamOn, beamLines, slabGeom, slabEdges, slabCont, slabLoads, roofGeom, roofLoads,
    frameModel, solve, defCombos, uFac, analyse, slabDesign, beamDesign, columnDesign, interaction, footingDesign, stairDesign, roofDesign, trussGeom, designAll, summary, rhoB, rhoReq, beta1, devLen, M2, coef, Fa, PILE_PATTERNS, perimeter, uid, nid, clone };
})(typeof window !== 'undefined' ? window : globalThis);
