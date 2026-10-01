/* StructCap Analysis — page UI: model tables, templates, load combinations, drawing, results and report.
   The engine is frame.js (FRAME.analyse). app.js creates this module with its helpers (ctx). */
(function (G) {
  'use strict';
  G.SC_ANALYSIS_UI = function (ctx) {
    const { T, esc, f, $, $$, S, toast, isPro, COPY, logoMark, today } = ctx;
    const F = G.FRAME, KEY = 'structcap.analysis.v2', FREE_MEMBERS = 30;
    const lsGet = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
    const lsSet = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { } };
    const clone = o => JSON.parse(JSON.stringify(o));
    const fx = (v, d) => { if (v === undefined || v === null || !isFinite(v)) return '—'; const dd = d === undefined ? 2 : d; return f(Math.abs(v) < 0.5 * Math.pow(10, -dd) ? 0 : v, dd); };

    // ------------------------------------------------------------------ materials, sections, templates
    const MAT = {
      steel: { id: 'STEEL', name: 'Steel', E: 200000, rho: 78.5 },
      conc: { id: 'C32', name: 'Concrete 32 MPa', E: 30100, rho: 24 },
      timber: { id: 'TIMBER', name: 'Timber (MGP10)', E: 10000, rho: 5.5 }
    };
    const CASES = (w) => [{ id: 'G', name: T('Dead', 'น้ำหนักบรรทุกคงที่'), type: 'G', sw: true }, { id: 'Q', name: T('Live', 'น้ำหนักบรรทุกจร'), type: 'Q', sw: false }].concat(w ? [{ id: 'W1', name: T('Wind → (left to right)', 'ลม → (ซ้ายไปขวา)'), type: 'W', sw: false }, { id: 'W2', name: T('Wind ← (right to left)', 'ลม ← (ขวาไปซ้าย)'), type: 'W', sw: false }] : []);
    function preset(code, cases) {
      const G0 = cases.filter(c => c.type === 'G').map(c => c.id), Q0 = cases.filter(c => c.type === 'Q').map(c => c.id), W0 = cases.filter(c => c.type === 'W').map(c => c.id), E0 = cases.filter(c => c.type === 'E').map(c => c.id);
      const out = [], add = (name, type, parts) => { const fct = {}; parts.forEach(([ids, k]) => ids.forEach(id => { fct[id] = (fct[id] || 0) + k; })); out.push({ id: 'C' + (out.length + 1), name, type, f: fct }); };
      if (code === 'AS') {
        add('1.35G', 'ULS', [[G0, 1.35]]);
        if (Q0.length) add('1.2G + 1.5Q', 'ULS', [[G0, 1.2], [Q0, 1.5]]);
        W0.forEach(w => { add('1.2G + ' + w + ' + 0.4Q', 'ULS', [[G0, 1.2], [[w], 1], [Q0, 0.4]]); add('0.9G + ' + w, 'ULS', [[G0, 0.9], [[w], 1]]); });
        E0.forEach(e => add('G + ' + e + ' + 0.3Q', 'ULS', [[G0, 1], [[e], 1], [Q0, 0.3]]));
        add('G + 0.7Q (short-term)', 'SLS', [[G0, 1], [Q0, 0.7]]); add('G + 0.4Q (long-term)', 'SLS', [[G0, 1], [Q0, 0.4]]);
      } else if (code === 'EC') {
        add('1.35G + 1.5Q', 'ULS', [[G0, 1.35], [Q0, 1.5]]);
        W0.forEach(w => { add('1.35G + 1.5Q + 0.9' + w, 'ULS', [[G0, 1.35], [Q0, 1.5], [[w], 0.9]]); add('1.35G + 1.5' + w + ' + 1.05Q', 'ULS', [[G0, 1.35], [[w], 1.5], [Q0, 1.05]]); add('1.0G + 1.5' + w, 'ULS', [[G0, 1], [[w], 1.5]]); });
        E0.forEach(e => add('G + ' + e + ' + 0.3Q', 'ULS', [[G0, 1], [[e], 1], [Q0, 0.3]]));
        add('G + Q (characteristic)', 'SLS', [[G0, 1], [Q0, 1]]); add('G + 0.3Q (quasi-permanent)', 'SLS', [[G0, 1], [Q0, 0.3]]);
      } else {
        add('1.4D', 'ULS', [[G0, 1.4]]); add('1.2D + 1.6L', 'ULS', [[G0, 1.2], [Q0, 1.6]]);
        W0.forEach(w => { add('1.2D + 1.0' + w + ' + L', 'ULS', [[G0, 1.2], [[w], 1], [Q0, 1]]); add('0.9D + 1.0' + w, 'ULS', [[G0, 0.9], [[w], 1]]); });
        E0.forEach(e => { add('1.2D + 1.0' + e + ' + L', 'ULS', [[G0, 1.2], [[e], 1], [Q0, 1]]); add('0.9D + 1.0' + e, 'ULS', [[G0, 0.9], [[e], 1]]); });
        add('D + L', 'SLS', [[G0, 1], [Q0, 1]]);
      }
      return out;
    }
    const base = (secs, mats, w) => ({ nodes: [], members: [], sections: secs, materials: mats, cases: CASES(w), loads: [], combos: [], code: 'AS' });
    const TPL = {
      beam: { n: ['Continuous beam', 'คานต่อเนื่อง'], p: { spans: '6, 6, 6', g: 15, q: 10 } },
      portal: { n: ['Portal frame (steel)', 'โครงข้อแข็งหลังคาจั่ว (เหล็ก)'], p: { span: 20, eave: 6, rise: 1.5, bay: 6, base: 'pin' } },
      frame: { n: ['Multi-storey frame (RC)', 'โครงอาคารหลายชั้น (คสล.)'], p: { bays: '6, 6, 6', storeys: '4, 3.5, 3.5, 3.5', g: 25, q: 12, wind: 15 } },
      truss: { n: ['Truss (Pratt / Warren / Howe)', 'โครงถัก (Pratt / Warren / Howe)'], p: { kind: 'pratt', span: 18, depth: 2, panels: 6, load: 12 } }
    };
    function build(kind, p) {
      const num = s => String(s).split(/[,\s]+/).map(Number).filter(v => v > 0);
      let m;
      if (kind === 'beam') {
        m = base([{ id: 'S1', name: '300×600 RC', type: 'rect', b: 300, h: 600 }], [clone(MAT.conc)], false);
        const sp = num(p.spans); let x = 0;
        m.nodes.push({ id: 'N1', x: 0, y: 0, sup: 'pin' });
        sp.forEach((L, i) => { x += L; m.nodes.push({ id: 'N' + (i + 2), x: +x.toFixed(4), y: 0, sup: 'rollerX' }); m.members.push({ id: 'B' + (i + 1), i: 'N' + (i + 1), j: 'N' + (i + 2), sec: 'S1', mat: 'C32', type: 'frame' }); });
        m.members.forEach(b => { m.loads.push({ case: 'G', kind: 'udl', member: b.id, dir: 'grav', w1: +p.g, w2: '', a: '', b: '' }, { case: 'Q', kind: 'udl', member: b.id, dir: 'grav', w1: +p.q, w2: '', a: '', b: '' }); });
      } else if (kind === 'portal') {
        m = base([{ id: 'COL', name: '360×170 I (col)', type: 'I', d: 356, bf: 171, tf: 11.5, tw: 7.3 }, { id: 'RAF', name: '310×165 I (rafter)', type: 'I', d: 304, bf: 165, tf: 10.2, tw: 6.1 }], [clone(MAT.steel)], true);
        const L = +p.span, h = +p.eave, r = +p.rise, s = +p.bay, base0 = p.base === 'fixed' ? 'fixed' : 'pin';
        m.nodes.push({ id: 'N1', x: 0, y: 0, sup: base0 }, { id: 'N2', x: 0, y: h }, { id: 'N3', x: L / 2, y: h + r }, { id: 'N4', x: L, y: h }, { id: 'N5', x: L, y: 0, sup: base0 });
        m.members.push({ id: 'C1', i: 'N1', j: 'N2', sec: 'COL', mat: 'STEEL', type: 'frame' }, { id: 'R1', i: 'N2', j: 'N3', sec: 'RAF', mat: 'STEEL', type: 'frame' }, { id: 'R2', i: 'N3', j: 'N4', sec: 'RAF', mat: 'STEEL', type: 'frame' }, { id: 'C2', i: 'N5', j: 'N4', sec: 'COL', mat: 'STEEL', type: 'frame' });
        ['R1', 'R2'].forEach(id => { m.loads.push({ case: 'G', kind: 'udl', member: id, dir: 'gravp', w1: +(0.15 * s).toFixed(3), w2: '', a: '', b: '' }, { case: 'Q', kind: 'udl', member: id, dir: 'gravp', w1: +(0.25 * s).toFixed(3), w2: '', a: '', b: '' }); });
        const qz = 0.9, wind = (cs, sg) => {
          m.loads.push({ case: cs, kind: 'udl', member: sg > 0 ? 'C1' : 'C2', dir: 'gx', w1: +(sg * 0.7 * qz * s).toFixed(3), w2: '', a: '', b: '' });
          m.loads.push({ case: cs, kind: 'udl', member: sg > 0 ? 'C2' : 'C1', dir: 'gx', w1: +(sg * 0.5 * qz * s).toFixed(3), w2: '', a: '', b: '' });
          ['R1', 'R2'].forEach(id => m.loads.push({ case: cs, kind: 'udl', member: id, dir: 'ly', w1: +(0.9 * qz * s).toFixed(3), w2: '', a: '', b: '' }));
        };
        wind('W1', 1); wind('W2', -1);
      } else if (kind === 'frame') {
        m = base([{ id: 'COL', name: '400×400 RC column', type: 'rect', b: 400, h: 400 }, { id: 'BM', name: '300×600 RC beam', type: 'rect', b: 300, h: 600 }], [clone(MAT.conc)], true);
        const bays = num(p.bays), st = num(p.storeys), xs = [0], ys = [0];
        bays.forEach(b => xs.push(+(xs[xs.length - 1] + b).toFixed(4))); st.forEach(h => ys.push(+(ys[ys.length - 1] + h).toFixed(4)));
        const id = (i, j) => 'N' + (j * xs.length + i + 1);
        ys.forEach((y, j) => xs.forEach((x, i) => m.nodes.push({ id: id(i, j), x, y, sup: j === 0 ? 'fixed' : 'free' })));
        let c = 0, b = 0;
        for (let j = 1; j < ys.length; j++) {
          xs.forEach((x, i) => m.members.push({ id: 'C' + (++c), i: id(i, j - 1), j: id(i, j), sec: 'COL', mat: 'C32', type: 'frame' }));
          for (let i = 0; i < bays.length; i++) { const bid = 'B' + (++b); m.members.push({ id: bid, i: id(i, j), j: id(i + 1, j), sec: 'BM', mat: 'C32', type: 'frame' }); m.loads.push({ case: 'G', kind: 'udl', member: bid, dir: 'grav', w1: +p.g, w2: '', a: '', b: '' }, { case: 'Q', kind: 'udl', member: bid, dir: 'grav', w1: +p.q, w2: '', a: '', b: '' }); }
          const Fw = +(+p.wind * (j === ys.length - 1 ? 0.6 : 1)).toFixed(2);
          m.loads.push({ case: 'W1', kind: 'node', node: id(0, j), Fx: Fw, Fy: 0, Mz: 0 }, { case: 'W2', kind: 'node', node: id(xs.length - 1, j), Fx: -Fw, Fy: 0, Mz: 0 });
        }
      } else {
        m = base([{ id: 'CH', name: 'SHS 100×100×5 (chord)', type: 'tube', shape: 'SHS', size: '100x100x5' }, { id: 'WEB', name: 'SHS 75×75×4 (web)', type: 'tube', shape: 'SHS', size: '75x75x4' }], [clone(MAT.steel)], false);
        const L = +p.span, d = +p.depth, n = Math.max(2, Math.round(+p.panels / 2) * 2), dx = L / n, K = p.kind;
        for (let i = 0; i <= n; i++) m.nodes.push({ id: 'B' + i, x: +(i * dx).toFixed(4), y: 0, sup: i === 0 ? 'pin' : i === n ? 'rollerX' : 'free' });
        if (K === 'warren') { for (let i = 0; i < n; i++) m.nodes.push({ id: 'T' + i, x: +((i + 0.5) * dx).toFixed(4), y: d, sup: 'free' }); }
        else for (let i = 1; i < n; i++) m.nodes.push({ id: 'T' + i, x: +(i * dx).toFixed(4), y: d, sup: 'free' });
        let k = 0; const mem = (a, b, s) => m.members.push({ id: 'T' + (++k), i: a, j: b, sec: s, mat: 'STEEL', type: 'truss' });
        for (let i = 0; i < n; i++) mem('B' + i, 'B' + (i + 1), 'CH');
        if (K === 'warren') {
          for (let i = 0; i < n - 1; i++) mem('T' + i, 'T' + (i + 1), 'CH');
          for (let i = 0; i < n; i++) { mem('B' + i, 'T' + i, 'WEB'); mem('T' + i, 'B' + (i + 1), 'WEB'); }
          for (let i = 0; i < n; i++) m.loads.push({ case: 'G', kind: 'node', node: 'T' + i, Fx: 0, Fy: -(+p.load), Mz: 0 }, { case: 'Q', kind: 'node', node: 'T' + i, Fx: 0, Fy: -(+p.load * 0.6).toFixed(2) * 1, Mz: 0 });
        } else {
          mem('B0', 'T1', 'CH'); for (let i = 1; i < n - 1; i++) mem('T' + i, 'T' + (i + 1), 'CH'); mem('T' + (n - 1), 'B' + n, 'CH');
          for (let i = 1; i < n; i++) mem('B' + i, 'T' + i, 'WEB');
          for (let i = 1; i < n; i++) { const left = i <= n / 2; if (K === 'pratt') { if (left && i > 1) mem('B' + (i - 1) < 'x' ? 'T' + (i) : 'T' + i, 'B' + (i - 1), 'WEB'); } }
          // diagonals: Pratt slopes down toward mid-span (tension), Howe the opposite
          m.members = m.members.filter(x => !(x.i === x.j));
          for (let i = 1; i < n - 1; i++) {
            const left = i < n / 2;
            if (K === 'pratt') { if (left) mem('T' + i, 'B' + (i + 1), 'WEB'); else mem('B' + i, 'T' + (i + 1), 'WEB'); }
            else { if (left) mem('B' + i, 'T' + (i + 1), 'WEB'); else mem('T' + i, 'B' + (i + 1), 'WEB'); }
          }
          for (let i = 1; i < n; i++) m.loads.push({ case: 'G', kind: 'node', node: 'T' + i, Fx: 0, Fy: -(+p.load), Mz: 0 }, { case: 'Q', kind: 'node', node: 'T' + i, Fx: 0, Fy: -(+(+p.load * 0.6).toFixed(2)), Mz: 0 });
        }
        // remove accidental duplicates
        const seen = new Set(); m.members = m.members.filter(x => { const kk = [x.i, x.j].sort().join('|'); if (seen.has(kk) || x.i === x.j) return false; seen.add(kk); return true; });
        m.members.forEach((x, i) => { x.id = 'T' + (i + 1); });
      }
      m.combos = preset(m.code, m.cases);
      m.name = T(TPL[kind].n[0], TPL[kind].n[1]);
      return m;
    }

    // ------------------------------------------------------------------ state
    const saved = lsGet();
    const A = {
      model: saved && saved.model ? saved.model : build('portal', TPL.portal.p),
      opt: Object.assign({ pdelta: false, modes: false, nmodes: 6, buckling: false, nseg: 4, massG: 1, massQ: 0.3 }, saved && saved.opt || {}),
      tab: 'nodes', view: 'M', src: null, sel: null, mode: 0, labels: true, dscale: 1, vb: null, res: null, err: null, tpl: 'portal', tplOpen: false, rtab: 'sum', lcase: (saved && saved.model && saved.model.cases && saved.model.cases[0] ? saved.model.cases[0].id : 'G')
    };
    const persist = () => lsSet({ model: A.model, opt: A.opt });
    const pro = () => isPro();

    // ------------------------------------------------------------------ analysis
    function run() {
      A.err = null; A.res = null;
      const m = A.model;
      try {
        if (!m.nodes.length || !m.members.length) throw new Error(T('Add nodes and members.', 'เพิ่มจุดต่อและชิ้นส่วน'));
        if (!pro() && m.members.length > FREE_MEMBERS) throw new Error(T('The Free plan analyses up to ' + FREE_MEMBERS + ' members. Upgrade to Pro for larger models.', 'แพ็กเกจ Free วิเคราะห์ได้ไม่เกิน ' + FREE_MEMBERS + ' ชิ้นส่วน อัปเกรดเป็น Pro สำหรับโมเดลที่ใหญ่กว่า'));
        const o = A.opt, adv = pro();
        const mass = {}; m.cases.forEach(c => { if (c.type === 'G') mass[c.id] = +o.massG || 0; else if (c.type === 'Q') mass[c.id] = +o.massQ || 0; });
        const model = Object.assign({}, m, { loads: m.loads.map(l => l.dir === 'grav' ? Object.assign({}, l, { dir: 'gy', w1: -(+l.w1 || 0), w2: l.w2 === '' || l.w2 == null ? '' : -(+l.w2), P: -(+l.P || 0) }) : l.dir === 'gravp' ? Object.assign({}, l, { dir: 'gyp', w1: -(+l.w1 || 0), w2: l.w2 === '' || l.w2 == null ? '' : -(+l.w2), P: -(+l.P || 0) }) : l) });
        A.res = F.analyse(model, { pdelta: adv && o.pdelta, modes: adv && o.modes ? Math.max(1, Math.min(20, o.nmodes | 0)) : 0, buckling: adv && o.buckling, nseg: Math.max(2, Math.min(10, o.nseg | 0)), massSrc: mass });
        if (!A.src || !srcList().some(s => s[0] === A.src)) A.src = m.combos.length ? 'combo:' + m.combos[0].id : 'case:' + m.cases[0].id;
      } catch (e) { A.err = e.message || String(e); }
    }
    let tmr = null;
    const schedule = () => { clearTimeout(tmr); tmr = setTimeout(() => { persist(); run(); drawAll(); }, 250); };

    // ------------------------------------------------------------------ result source helpers
    function srcList() {
      const m = A.model, out = [];
      m.cases.forEach(c => out.push(['case:' + c.id, T('Case ', 'กรณี ') + c.id + ' — ' + c.name]));
      m.combos.forEach(c => out.push(['combo:' + c.id, c.id + ' — ' + c.name + ' (' + c.type + ')']));
      if (m.combos.some(c => c.type === 'ULS')) out.push(['env:ULS', T('Envelope — all ULS combinations', 'ค่าสูงสุด/ต่ำสุด — ULS ทั้งหมด')]);
      if (m.combos.some(c => c.type === 'SLS')) out.push(['env:SLS', T('Envelope — all SLS combinations', 'ค่าสูงสุด/ต่ำสุด — SLS ทั้งหมด')]);
      return out;
    }
    function current() {
      const r = A.res; if (!r || !A.src) return null;
      const [k, id] = A.src.split(':');
      if (k === 'case') return r.cases[id] ? Object.assign({ kind: 'case' }, r.cases[id]) : null;
      if (k === 'combo') return r.combos[id] ? Object.assign({ kind: 'combo' }, r.combos[id]) : null;
      const env = F.envelope(r, A.model.combos.filter(c => c.type === id).map(c => c.id));
      return env ? Object.assign({ kind: 'env', name: id }, env) : null;
    }

    // ------------------------------------------------------------------ drawing
    const W = 900, Hh = 520;
    function extent() {
      const xs = A.model.nodes.map(n => +n.x), ys = A.model.nodes.map(n => +n.y);
      if (!xs.length) return { x0: 0, x1: 10, y0: 0, y1: 5 };
      return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    }
    function frameView() {
      const e = extent(), span = Math.max(e.x1 - e.x0, e.y1 - e.y0, 1), pad = 0.18 * span + 1;
      const w = (e.x1 - e.x0) + 2 * pad, h = (e.y1 - e.y0) + 2 * pad, k = Math.min(W / w, Hh / h);
      return { k, cx: (e.x0 + e.x1) / 2, cy: (e.y0 + e.y1) / 2, span };
    }
    function svgModel() {
      const m = A.model, fv = frameView(), k = fv.k, X = x => W / 2 + (x - fv.cx) * k, Y = y => Hh / 2 - (y - fv.cy) * k;
      const nd = {}; m.nodes.forEach(n => { nd[n.id] = n; });
      const cur = A.view === 'model' ? null : current();
      let s = '';
      // grid
      const gs = niceStep(fv.span / 8);
      const gx0 = Math.floor((fv.cx - W / 2 / k) / gs) * gs, gy0 = Math.floor((fv.cy - Hh / 2 / k) / gs) * gs;
      for (let x = gx0; x <= fv.cx + W / 2 / k; x += gs) s += `<line x1="${X(x)}" x2="${X(x)}" y1="0" y2="${Hh}" class="an-gl"/>`;
      for (let y = gy0; y <= fv.cy + Hh / 2 / k; y += gs) s += `<line y1="${Y(y)}" y2="${Y(y)}" x1="0" x2="${W}" class="an-gl"/>`;
      // members
      m.members.forEach(mb => {
        const a = nd[mb.i], b = nd[mb.j]; if (!a || !b) return;
        const sel = A.sel && A.sel.k === 'm' && A.sel.id === mb.id;
        s += `<line x1="${X(+a.x)}" y1="${Y(+a.y)}" x2="${X(+b.x)}" y2="${Y(+b.y)}" class="an-mem ${mb.type === 'truss' ? 'truss' : ''} ${sel ? 'sel' : ''} ${cur ? 'dim' : ''}" data-sel="m:${esc(mb.id)}"/>`;
        const L = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
        const hinge = (n, sg) => `<circle cx="${X(+n.x + sg * ux * 10 / k)}" cy="${Y(+n.y + sg * uy * 10 / k)}" r="3.6" class="an-hinge"/>`;
        if (mb.type !== 'truss') { if (mb.relI) s += hinge(a, 1); if (mb.relJ) s += hinge(b, -1); }
        if (A.labels) s += `<text x="${(X(+a.x) + X(+b.x)) / 2 + 4}" y="${(Y(+a.y) + Y(+b.y)) / 2 - 5}" class="an-mid">${esc(mb.id)}</text>`;
      });
      // supports + nodes
      m.nodes.forEach(n => {
        const x = X(+n.x), y = Y(+n.y), sp = n.sup || 'free', sel = A.sel && A.sel.k === 'n' && A.sel.id === n.id;
        if (sp === 'fixed') s += `<path d="M${x - 13} ${y + 1}h26" class="an-sup"/>${[-10, -4, 2, 8].map(d => `<path d="M${x + d} ${y + 1}l-6 8" class="an-sup thin"/>`).join('')}`;
        else if (sp === 'pin') s += `<path d="M${x} ${y}l-9 14h18z" class="an-sup"/><path d="M${x - 12} ${y + 15}h24" class="an-sup thin"/>`;
        else if (sp === 'rollerX') s += `<path d="M${x} ${y}l-9 12h18z" class="an-sup"/><circle cx="${x - 5}" cy="${y + 15}" r="2.6" class="an-sup"/><circle cx="${x + 5}" cy="${y + 15}" r="2.6" class="an-sup"/>`;
        else if (sp === 'rollerY') s += `<path d="M${x} ${y}l-12 -9v18z" class="an-sup"/><circle cx="${x - 15}" cy="${y - 5}" r="2.6" class="an-sup"/><circle cx="${x - 15}" cy="${y + 5}" r="2.6" class="an-sup"/>`;
        else if (sp === 'guided' || sp === 'fixedRot') s += `<rect x="${x - 7}" y="${y - 7}" width="14" height="14" class="an-sup"/>`;
        if (+n.kx > 0 || +n.ky > 0 || +n.kr > 0) s += `<path d="M${x} ${y + 2}l4 4-8 4 8 4-8 4 4 4" class="an-sup thin"/>`;
        s += `<circle cx="${x}" cy="${y}" r="${sel ? 5.5 : 4}" class="an-node ${sel ? 'sel' : ''}" data-sel="n:${esc(n.id)}"/>`;
        if (A.labels) s += `<text x="${x + 6}" y="${y - 6}" class="an-nid">${esc(n.id)}</text>`;
      });
      if (A.view === 'model') s += loadsSvg(X, Y, k);
      else if (A.err) { }
      else s += resultSvg(X, Y, k, fv, cur);
      return `<svg viewBox="0 0 ${W} ${Hh}" class="an-svg" id="anSvg" role="img" aria-label="${T('Frame model', 'แบบจำลองโครงสร้าง')}">${s}</svg>`;
    }
    function niceStep(v) { const p = Math.pow(10, Math.floor(Math.log10(v || 1))), n = v / p; return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p; }
    function arrow(x1, y1, x2, y2, cls) { const a = Math.atan2(y2 - y1, x2 - x1), hl = 7; return `<path d="M${x1} ${y1}L${x2} ${y2}M${x2} ${y2}L${x2 - hl * Math.cos(a - 0.45)} ${y2 - hl * Math.sin(a - 0.45)}M${x2} ${y2}L${x2 - hl * Math.cos(a + 0.45)} ${y2 - hl * Math.sin(a + 0.45)}" class="${cls}"/>`; }
    function loadsSvg(X, Y, k) {
      const m = A.model, nd = {}; m.nodes.forEach(n => { nd[n.id] = n; });
      const lc = A.lcase === 'all' ? null : A.lcase, ls = m.loads.filter(l => !lc || l.case === lc);
      const maxW = Math.max(1e-9, ...ls.filter(l => l.kind === 'udl').map(l => Math.max(Math.abs(+l.w1 || 0), Math.abs(+l.w2 || 0))));
      const maxP = Math.max(1e-9, ...ls.filter(l => l.kind !== 'udl').map(l => Math.max(Math.abs(+l.Fx || 0), Math.abs(+l.Fy || 0), Math.abs(+l.P || 0))));
      let s = ''; const stack = {};
      const cls = c => 'an-ld c-' + ((m.cases.find(x => x.id === c) || {}).type || 'O');
      ls.forEach(l => {
        if (l.kind === 'node') {
          const n = nd[l.node]; if (!n) return; const x = X(+n.x), y = Y(+n.y);
          [['Fx', 1, 0], ['Fy', 0, -1]].forEach(([q, ex, ey]) => { const v = +l[q] || 0; if (!v) return; const len = 22 + 26 * Math.abs(v) / maxP, sg = Math.sign(v); s += arrow(x - ex * sg * len, y - ey * sg * len, x - ex * sg * 6, y - ey * sg * 6, cls(l.case)) + `<text x="${x - ex * sg * len - (ex ? 0 : -4)}" y="${y - ey * sg * len - 4}" class="an-ldt">${f(Math.abs(v), 1)}</text>`; });
          if (+l.Mz) s += `<path d="M${x + 14} ${y}A14 14 0 1 ${+l.Mz > 0 ? 0 : 1} ${x} ${y - 14}" class="${cls(l.case)}"/><text x="${x + 16}" y="${y - 12}" class="an-ldt">${f(Math.abs(+l.Mz), 1)}</text>`;
          return;
        }
        const mb = m.members.find(q => q.id === l.member); if (!mb) return; const a = nd[mb.i], b = nd[mb.j]; if (!a || !b) return;
        const L = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
        const dirv = (l.dir === 'grav' || l.dir === 'gravp') ? [0, -1] : l.dir === 'gx' ? [1, 0] : l.dir === 'ly' ? [-uy, ux] : l.dir === 'lx' ? [ux, uy] : [0, 1];
        const at = t => [+a.x + ux * t, +a.y + uy * t];
        if (l.kind === 'udl') {
          const a0 = +l.a || 0, b0 = l.b === '' || l.b == null || +l.b <= 0 ? L : Math.min(L, +l.b), w1 = +l.w1 || 0, w2 = l.w2 === '' || l.w2 == null ? w1 : +l.w2;
          const nA = Math.max(3, Math.round((b0 - a0) * k / 22)), top = [];
          // several distributed loads on one member (e.g. G and Q in "all cases") are stacked outward so they stay readable
          const kk = l.member + '|' + l.dir, off = (stack[kk] || 0); stack[kk] = off + 46;
          for (let i = 0; i <= nA; i++) {
            const t = a0 + (b0 - a0) * i / nA, w = w1 + (w2 - w1) * i / nA, [px, py] = at(t), sg = Math.sign(w || w1 || 1), len = (10 + 30 * Math.abs(w) / maxW + off) * sg;
            const sx = X(px) - dirv[0] * len, sy = Y(py) + dirv[1] * len; top.push(sx.toFixed(1) + ' ' + sy.toFixed(1));
            if (w) s += arrow(sx, sy, X(px) - dirv[0] * (3 + off) * sg, Y(py) + dirv[1] * (3 + off) * sg, cls(l.case));
          }
          s += `<path d="M${top.join(' L')}" class="${cls(l.case)}"/>`;
          const [mx, my] = at((a0 + b0) / 2), lo = (44 + off) * Math.sign(w1 || 1); s += `<text x="${X(mx) - dirv[0] * lo}" y="${Y(my) + dirv[1] * lo - 2}" text-anchor="middle" class="an-ldt">${esc(l.case)} ${f(Math.abs(w1), 2)}${w2 !== w1 ? '→' + f(Math.abs(w2), 2) : ''}</text>`;
        } else if (l.kind === 'point') {
          const [px, py] = at(Math.min(L, +l.a || 0)), v = +l.P || 0, len = (22 + 26 * Math.abs(v) / maxP) * Math.sign(v || 1);
          s += arrow(X(px) - dirv[0] * len, Y(py) + dirv[1] * len, X(px) - dirv[0] * 4 * Math.sign(v || 1), Y(py) + dirv[1] * 4 * Math.sign(v || 1), cls(l.case)) + `<text x="${X(px) - dirv[0] * len + 4}" y="${Y(py) + dirv[1] * len - 4}" class="an-ldt">${f(Math.abs(v), 1)}</text>`;
        } else if (l.kind === 'moment') {
          const [px, py] = at(Math.min(L, +l.a || 0)), x = X(px), y = Y(py);
          s += `<path d="M${x + 13} ${y}A13 13 0 1 ${+l.M > 0 ? 0 : 1} ${x} ${y - 13}" class="${cls(l.case)}"/><text x="${x + 15}" y="${y - 12}" class="an-ldt">${f(Math.abs(+l.M), 1)}</text>`;
        }
      });
      return s;
    }
    function resultSvg(X, Y, k, fv, cur) {
      const m = A.model, r = A.res; if (!r) return '';
      let s = '';
      const memRec = id => A.model.members.find(q => q.id === id), nd = {}; m.nodes.forEach(n => { nd[n.id] = n; });
      const geom = id => { const mb = memRec(id), a = nd[mb.i], b = nd[mb.j], L = Math.hypot(b.x - a.x, b.y - a.y); return { a, b, L, ux: (b.x - a.x) / L, uy: (b.y - a.y) / L }; };
      const v = A.view;
      if (v === 'def' || v === 'mode' || v === 'buck') {
        let u, mesh, title = '';
        if (v === 'def') { if (!cur || cur.kind === 'env') return `<text x="16" y="24" class="an-note">${T('Choose a load case or combination to see the deflected shape.', 'เลือกกรณีน้ำหนักหรือกรณีรวมแรงเพื่อดูรูปการโก่งตัว')}</text>`; }
        if (v === 'mode') { const md = r.modal && r.modal.modes[A.mode]; if (!md) return `<text x="16" y="24" class="an-note">${T('Turn on modal analysis (Pro) in Analysis settings.', 'เปิดการวิเคราะห์โหมด (Pro) ในการตั้งค่าการวิเคราะห์')}</text>`; u = md.u; mesh = r.modal.mesh; title = T('Mode ', 'โหมด ') + (A.mode + 1) + ' · f = ' + f(md.f, 3) + ' Hz · T = ' + f(md.T, 3) + ' s'; }
        if (v === 'buck') { const bid = A.src && A.src.startsWith('combo:') ? A.src.slice(6) : null, bk = bid && r.buckling && r.buckling[bid]; const md = bk && bk.modes && bk.modes[0]; if (!md) return `<text x="16" y="24" class="an-note">${bk && bk.none ? T('No compression in this combination — no buckling mode.', 'ไม่มีแรงอัดในกรณีนี้ — ไม่มีโหมดการโก่งเดาะ') : T('Turn on buckling analysis (Pro) and choose a ULS combination.', 'เปิดการวิเคราะห์การโก่งเดาะ (Pro) และเลือกกรณีรวมแรง ULS')}</text>`; u = md.u; mesh = bk.mesh; title = T('Buckling mode 1 · λcr = ', 'โหมดการโก่งเดาะ 1 · λcr = ') + f(md.lam, 2); }
        if (v === 'def') {
          // member station displacements
          let mx = 0; cur.mem.forEach(mm => mm.dx.forEach((d, i) => { mx = Math.max(mx, Math.hypot(d, mm.dy[i])); }));
          const sc = mx > 0 ? 0.08 * fv.span / mx * A.dscale : 0;
          cur.mem.forEach(mm => { const g = geom(mm.id); const pts = mm.x.map((x, i) => (X(+g.a.x + g.ux * x + mm.dx[i] * sc)).toFixed(1) + ' ' + (Y(+g.a.y + g.uy * x + mm.dy[i] * sc)).toFixed(1)); s += `<path d="M${pts.join(' L')}" class="an-def" data-sel="m:${esc(mm.id)}"/>`; });
          const mxN = maxNodeDisp(cur);
          if (mxN) { const n = nd[mxN.id]; s += `<circle cx="${X(+n.x + mxN.ux * sc)}" cy="${Y(+n.y + mxN.uy * sc)}" r="5" class="an-pk"/><text x="${X(+n.x + mxN.ux * sc) + 8}" y="${Y(+n.y + mxN.uy * sc) - 8}" class="an-pkt">${f(mxN.d * 1000, 2)} mm</text>`; }
          return s + `<text x="16" y="24" class="an-note">${T('Deflected shape · max displacement ', 'รูปการโก่งตัว · การเคลื่อนตัวสูงสุด ')}${f(mx * 1000, 2)} mm · ${T('scale', 'มาตราส่วน')} ×${f(sc, 0)}</text>`;
        }
        // mode / buckling shapes from the subdivided mesh
        const P = mesh.pts; let mx = 0; for (let i = 0; i < P.length; i++) mx = Math.max(mx, Math.hypot(u[3 * i], u[3 * i + 1]));
        const sc = mx > 0 ? 0.1 * fv.span / mx * A.dscale : 0;
        mesh.els.forEach(el => { const a = P[el.n1], b = P[el.n2]; s += `<line x1="${X(a.x + u[3 * el.n1] * sc)}" y1="${Y(a.y + u[3 * el.n1 + 1] * sc)}" x2="${X(b.x + u[3 * el.n2] * sc)}" y2="${Y(b.y + u[3 * el.n2 + 1] * sc)}" class="an-def"/>`; });
        return s + `<text x="16" y="24" class="an-note">${title}</text>`;
      }
      if (v === 'react') {
        if (!cur || cur.kind === 'env') { if (!cur) return ''; }
        const R = cur.R, mx = Math.max(1e-9, ...m.nodes.map((n, i) => cur.kind === 'env' ? Math.max(Math.abs(R[3 * i][0]), Math.abs(R[3 * i][1]), Math.abs(R[3 * i + 1][0]), Math.abs(R[3 * i + 1][1])) : Math.max(Math.abs(R[3 * i]), Math.abs(R[3 * i + 1]))));
        m.nodes.forEach((n, i) => {
          if ((n.sup || 'free') === 'free' && !(+n.kx || +n.ky || +n.kr)) return;
          const x = X(+n.x), y = Y(+n.y);
          if (cur.kind === 'env') { s += `<text x="${x + 8}" y="${y + 30}" class="an-rt">Rx ${f(R[3 * i][0], 1)}…${f(R[3 * i][1], 1)}</text><text x="${x + 8}" y="${y + 44}" class="an-rt">Ry ${f(R[3 * i + 1][0], 1)}…${f(R[3 * i + 1][1], 1)}</text><text x="${x + 8}" y="${y + 58}" class="an-rt">Mz ${f(R[3 * i + 2][0], 1)}…${f(R[3 * i + 2][1], 1)}</text>`; return; }
          const rx = R[3 * i], ry = R[3 * i + 1], mz = R[3 * i + 2];
          if (Math.abs(ry) > 1e-6) { const len = 20 + 30 * Math.abs(ry) / mx, sg = Math.sign(ry); s += arrow(x, y + 22 + (sg > 0 ? len : 0), x, y + 22 + (sg > 0 ? 0 : len), 'an-ra') + `<text x="${x + 6}" y="${y + 40 + len * 0.5}" class="an-rt">${f(ry, 2)}</text>`; }
          if (Math.abs(rx) > 1e-6) { const len = 20 + 30 * Math.abs(rx) / mx, sg = Math.sign(rx); s += arrow(x - 18 - (sg > 0 ? len : 0), y + 18, x - 18 - (sg > 0 ? 0 : len), y + 18, 'an-ra') + `<text x="${x - 20 - len}" y="${y + 12}" text-anchor="end" class="an-rt">${f(rx, 2)}</text>`; }
          if (Math.abs(mz) > 1e-6) s += `<text x="${x + 10}" y="${y + 58}" class="an-rt">M ${f(mz, 2)}</text>`;
        });
        return s + `<text x="16" y="24" class="an-note">${T('Support reactions (kN, kNm) · + = along +X / +Y / counter-clockwise', 'แรงปฏิกิริยา (kN, kNm) · + ตามแกน +X / +Y / ทวนเข็ม')}</text>`;
      }
      // N, V, M diagrams
      if (!cur) return '';
      const q = v, env = cur.kind === 'env';
      // truss members: only N is meaningful (their M / V come from local self-weight bending only)
      const isTruss = id => { const mb = memRec(id); return mb && mb.type === 'truss'; };
      const mems = q === 'N' ? cur.mem : cur.mem.filter(mm => !isTruss(mm.id));
      if (!mems.length) return s + `<text x="16" y="24" class="an-note">${T('Truss members carry axial force only — see the N diagram.', 'ชิ้นส่วนโครงถักรับแรงตามแนวแกนเท่านั้น — ดูแผนภาพ N')}</text>`;
      let mx = 0; mems.forEach(mm => { (env ? mm[q + 'max'].concat(mm[q + 'min']) : mm[q]).forEach(val => { mx = Math.max(mx, Math.abs(val)); }); });
      const sc = mx > 0 ? 0.09 * fv.span / mx * A.dscale : 0, sgn = q === 'M' ? -1 : 1; // moments drawn on the tension side
      const curve = (mm, arr, g) => arr.map((val, i) => { const px = +g.a.x + g.ux * mm.x[i] + (-g.uy) * val * sc * sgn, py = +g.a.y + g.uy * mm.x[i] + g.ux * val * sc * sgn; return X(px).toFixed(1) + ' ' + Y(py).toFixed(1); });
      mems.forEach(mm => {
        const g = geom(mm.id), base = `${X(+g.a.x)} ${Y(+g.a.y)}`, end = `${X(+g.b.x)} ${Y(+g.b.y)}`;
        const sets = env ? [[mm[q + 'max'], 'pos'], [mm[q + 'min'], 'neg']] : [[mm[q], 'one']];
        sets.forEach(([arr, cl]) => { const c = curve(mm, arr, g); s += `<path d="M${base} L${c.join(' L')} L${end} Z" class="an-dg ${q} ${cl}" data-sel="m:${esc(mm.id)}"/>`; });
        // peak labels per member
        const lab = (arr, pick) => { let bi = 0; arr.forEach((val, i) => { if (pick(val, arr[bi])) bi = i; }); const val = arr[bi]; if (Math.abs(val) < mx * 0.04) return; const c = curve(mm, [val], { a: { x: +g.a.x + g.ux * mm.x[bi], y: +g.a.y + g.uy * mm.x[bi] }, ux: g.ux, uy: g.uy }); const [px, py] = c[0].split(' ').map(Number); s += `<text x="${px + 3}" y="${py - 3}" class="an-pkt ${q}">${f(val, 1)}</text>`; };
        if (env) { lab(mm[q + 'max'], (a, b) => a > b); lab(mm[q + 'min'], (a, b) => a < b); }
        else { lab(mm[q], (a, b) => a > b); lab(mm[q], (a, b) => a < b); }
      });
      const nm = { M: T('Bending moment M (kNm) — drawn on the tension side', 'โมเมนต์ดัด M (kNm) — วาดด้านรับแรงดึง'), V: T('Shear force V (kN)', 'แรงเฉือน V (kN)'), N: T('Axial force N (kN) — tension +', 'แรงตามแนวแกน N (kN) — แรงดึง +') }[q];
      return s + `<text x="16" y="24" class="an-note">${nm} · ${T('max', 'สูงสุด')} ${f(mx, 2)}</text>`;
    }
    function maxNodeDisp(cur) {
      if (!cur || !cur.u) return null; let best = null;
      A.model.nodes.forEach((n, i) => { const ux = cur.u[3 * i], uy = cur.u[3 * i + 1], d = Math.hypot(ux, uy); if (!best || d > best.d) best = { id: n.id, ux, uy, d }; });
      return best;
    }
    // largest displacement anywhere along the members (stations), e.g. mid-span of a beam between supports
    function maxStationDisp(cur) {
      if (!cur || !cur.mem) return null; let best = null;
      cur.mem.forEach(mm => mm.x.forEach((x, i) => { const d = Math.hypot(mm.dx[i], mm.dy[i]); if (!best || d > best.d) best = { id: mm.id, x, d }; }));
      return best;
    }

    // ------------------------------------------------------------------ tables (inputs)
    const SUP = [['free', T('Free', 'อิสระ')], ['fixed', T('Fixed', 'ยึดแน่น')], ['pin', T('Pinned', 'หมุด')], ['rollerX', T('Roller (free in X)', 'ล้อเลื่อน (เลื่อนแกน X)')], ['rollerY', T('Roller (free in Y)', 'ล้อเลื่อน (เลื่อนแกน Y)')], ['guided', T('Guided (free in Y)', 'นำทาง (เลื่อนแกน Y)')], ['fixedRot', T('Rotation fixed only', 'ยึดการหมุนเท่านั้น')]];
    const DIRS = [['grav', T('Gravity ↓ (per member length)', 'แรงโน้มถ่วง ↓ (ต่อความยาวชิ้นส่วน)')], ['gravp', T('Gravity ↓ (per horizontal length)', 'แรงโน้มถ่วง ↓ (ต่อความยาวแนวราบ)')], ['gx', T('Global X →', 'แกน X →')], ['ly', T('Local y (perpendicular)', 'แกน y เฉพาะที่ (ตั้งฉาก)')], ['lx', T('Local x (axial)', 'แกน x เฉพาะที่ (ตามแนวแกน)')]];
    const SECT = [['rect', T('Rectangle', 'สี่เหลี่ยม')], ['I', T('I-section', 'หน้าตัด I')], ['circ', T('Solid circle', 'วงกลมตัน')], ['tube', 'CHS / SHS / RHS'], ['user', T('User A, I', 'กำหนด A, I เอง')]];
    const sel = (opts, v, attrs) => `<select ${attrs}>${opts.map(o => `<option value="${esc(o[0])}" ${String(v) === String(o[0]) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
    const inp = (v, attrs, w) => `<input ${attrs} value="${esc(v == null ? '' : v)}" ${w ? `style="width:${w}px"` : ''}>`;
    const cell = (tbl, i, fld, v, type, w) => inp(v, `data-tb="${tbl}" data-i="${i}" data-f="${fld}" ${type === 'n' ? 'type="number" step="any" inputmode="decimal"' : ''}`, w);
    function tables() {
      const m = A.model, t = A.tab;
      const tabs = [['nodes', T('Nodes', 'จุดต่อ')], ['members', T('Members', 'ชิ้นส่วน')], ['sections', T('Sections', 'หน้าตัด')], ['materials', T('Materials', 'วัสดุ')], ['cases', T('Load cases', 'กรณีน้ำหนัก')], ['nloads', T('Nodal loads', 'แรงที่จุดต่อ')], ['mloads', T('Member loads', 'แรงบนชิ้นส่วน')], ['combos', T('Combinations', 'กรณีรวมแรง')], ['settings', T('Analysis', 'การวิเคราะห์')]];
      const del = (tb, i) => `<button class="icon-btn" data-act="an-del" data-tb="${tb}" data-i="${i}" aria-label="${T('Delete row', 'ลบแถว')}">×</button>`;
      const add = (tb, lbl) => `<button class="linkbtn" data-act="an-add" data-tb="${tb}">+ ${lbl}</button>`;
      const secOpts = m.sections.map(s => [s.id, s.id + (s.name ? ' · ' + s.name : '')]), matOpts = m.materials.map(s => [s.id, s.id]), nodeOpts = m.nodes.map(n => [n.id, n.id]), memOpts = m.members.map(n => [n.id, n.id]), caseOpts = m.cases.map(c => [c.id, c.id]);
      let body = '';
      if (t === 'nodes') body = `<table class="an-t"><thead><tr><th>ID</th><th>X (m)</th><th>Y (m)</th><th>${T('Support', 'จุดรองรับ')}</th><th title="kN/m, kN/m, kNm/rad">${T('Springs kx / ky / kr', 'สปริง kx / ky / kr')}</th><th></th></tr></thead><tbody>${m.nodes.map((n, i) => `<tr class="${A.sel && A.sel.k === 'n' && A.sel.id === n.id ? 'on' : ''}"><td>${cell('nodes', i, 'id', n.id, '', 52)}</td><td>${cell('nodes', i, 'x', n.x, 'n', 64)}</td><td>${cell('nodes', i, 'y', n.y, 'n', 64)}</td><td>${sel(SUP, n.sup || 'free', `data-tb="nodes" data-i="${i}" data-f="sup"`)}</td><td class="spr">${cell('nodes', i, 'kx', n.kx || '', 'n', 52)}${cell('nodes', i, 'ky', n.ky || '', 'n', 52)}${cell('nodes', i, 'kr', n.kr || '', 'n', 52)}</td><td>${del('nodes', i)}</td></tr>`).join('')}</tbody></table>${add('nodes', T('Add node', 'เพิ่มจุดต่อ'))}`;
      else if (t === 'members') body = `<table class="an-t"><thead><tr><th>ID</th><th>${T('Node i', 'จุด i')}</th><th>${T('Node j', 'จุด j')}</th><th>${T('Section', 'หน้าตัด')}</th><th>${T('Material', 'วัสดุ')}</th><th>${T('Type', 'ชนิด')}</th><th title="${T('Moment release (hinge) at end i / j', 'ปลดโมเมนต์ (บานพับ) ที่ปลาย i / j')}">${T('Hinge i / j', 'บานพับ i / j')}</th><th>L (m)</th><th></th></tr></thead><tbody>${m.members.map((mb, i) => { const a = m.nodes.find(n => n.id === mb.i), b = m.nodes.find(n => n.id === mb.j), L = a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0; return `<tr class="${A.sel && A.sel.k === 'm' && A.sel.id === mb.id ? 'on' : ''}"><td>${cell('members', i, 'id', mb.id, '', 52)}</td><td>${sel(nodeOpts, mb.i, `data-tb="members" data-i="${i}" data-f="i"`)}</td><td>${sel(nodeOpts, mb.j, `data-tb="members" data-i="${i}" data-f="j"`)}</td><td>${sel(secOpts, mb.sec, `data-tb="members" data-i="${i}" data-f="sec"`)}</td><td>${sel(matOpts, mb.mat, `data-tb="members" data-i="${i}" data-f="mat"`)}</td><td>${sel([['frame', T('Frame', 'โครงข้อแข็ง')], ['truss', T('Truss', 'โครงถัก')]], mb.type || 'frame', `data-tb="members" data-i="${i}" data-f="type"`)}</td><td class="chk2"><input type="checkbox" data-tb="members" data-i="${i}" data-f="relI" ${mb.relI ? 'checked' : ''} ${mb.type === 'truss' ? 'disabled' : ''} aria-label="hinge i"><input type="checkbox" data-tb="members" data-i="${i}" data-f="relJ" ${mb.relJ ? 'checked' : ''} ${mb.type === 'truss' ? 'disabled' : ''} aria-label="hinge j"></td><td class="mono">${f(L, 3)}</td><td>${del('members', i)}</td></tr>`; }).join('')}</tbody></table>${add('members', T('Add member', 'เพิ่มชิ้นส่วน'))}`;
      else if (t === 'sections') body = `<table class="an-t"><thead><tr><th>ID</th><th>${T('Name', 'ชื่อ')}</th><th>${T('Type', 'ชนิด')}</th><th>${T('Dimensions (mm)', 'ขนาด (มม.)')}</th><th>A (mm²)</th><th>I (×10⁶ mm⁴)</th><th></th></tr></thead><tbody>${m.sections.map((s, i) => { const p = F.secProps(s); const dims = s.type === 'rect' ? `b ${cell('sections', i, 'b', s.b, 'n', 56)} h ${cell('sections', i, 'h', s.h, 'n', 56)}` : s.type === 'I' ? `d ${cell('sections', i, 'd', s.d, 'n', 50)} bf ${cell('sections', i, 'bf', s.bf, 'n', 50)} tf ${cell('sections', i, 'tf', s.tf, 'n', 44)} tw ${cell('sections', i, 'tw', s.tw, 'n', 44)}` : s.type === 'circ' ? `D ${cell('sections', i, 'D', s.D, 'n', 60)}` : s.type === 'tube' ? `${sel([['CHS', 'CHS'], ['SHS', 'SHS'], ['RHS', 'RHS']], s.shape || 'SHS', `data-tb="sections" data-i="${i}" data-f="shape"`)} ${sel((G.GANTRY ? G.GANTRY.sizeOptions(s.shape || 'SHS') : []).map(o => [o[0], o[1]]), s.size, `data-tb="sections" data-i="${i}" data-f="size"`)}` : `A ${cell('sections', i, 'A', s.A, 'n', 70)} I ${cell('sections', i, 'I', s.I, 'n', 90)}`; return `<tr><td>${cell('sections', i, 'id', s.id, '', 56)}</td><td>${cell('sections', i, 'name', s.name || '', '', 120)}</td><td>${sel(SECT, s.type, `data-tb="sections" data-i="${i}" data-f="type"`)}</td><td class="dims">${dims}</td><td class="mono">${f(p.A, 0)}</td><td class="mono">${f(p.I / 1e6, 2)}</td><td>${del('sections', i)}</td></tr>`; }).join('')}</tbody></table>${add('sections', T('Add section', 'เพิ่มหน้าตัด'))}`;
      else if (t === 'materials') body = `<table class="an-t"><thead><tr><th>ID</th><th>${T('Name', 'ชื่อ')}</th><th>E (MPa)</th><th>${T('Unit weight (kN/m³)', 'หน่วยน้ำหนัก (kN/m³)')}</th><th></th></tr></thead><tbody>${m.materials.map((s, i) => `<tr><td>${cell('materials', i, 'id', s.id, '', 70)}</td><td>${cell('materials', i, 'name', s.name || '', '', 140)}</td><td>${cell('materials', i, 'E', s.E, 'n', 80)}</td><td>${cell('materials', i, 'rho', s.rho, 'n', 70)}</td><td>${del('materials', i)}</td></tr>`).join('')}</tbody></table><div class="an-adds">${add('materials', T('Add material', 'เพิ่มวัสดุ'))} <button class="linkbtn" data-act="an-mat" data-m="steel">+ ${T('Steel', 'เหล็ก')}</button> <button class="linkbtn" data-act="an-mat" data-m="conc">+ ${T('Concrete 32 MPa', 'คอนกรีต 32 MPa')}</button> <button class="linkbtn" data-act="an-mat" data-m="timber">+ ${T('Timber', 'ไม้')}</button></div>`;
      else if (t === 'cases') body = `<table class="an-t"><thead><tr><th>ID</th><th>${T('Name', 'ชื่อ')}</th><th>${T('Type', 'ประเภท')}</th><th>${T('Self-weight', 'น้ำหนักตัวเอง')}</th><th></th></tr></thead><tbody>${m.cases.map((c, i) => `<tr><td>${cell('cases', i, 'id', c.id, '', 52)}</td><td>${cell('cases', i, 'name', c.name, '', 170)}</td><td>${sel([['G', T('G — dead', 'G — คงที่')], ['Q', T('Q — live', 'Q — จร')], ['W', T('W — wind', 'W — ลม')], ['E', T('E — earthquake', 'E — แผ่นดินไหว')], ['O', T('Other', 'อื่น ๆ')]], c.type, `data-tb="cases" data-i="${i}" data-f="type"`)}</td><td><input type="checkbox" data-tb="cases" data-i="${i}" data-f="sw" ${c.sw ? 'checked' : ''} aria-label="self-weight"></td><td>${del('cases', i)}</td></tr>`).join('')}</tbody></table>${add('cases', T('Add load case', 'เพิ่มกรณีน้ำหนัก'))}`;
      else if (t === 'nloads') { const rows = m.loads.map((l, i) => [l, i]).filter(([l]) => l.kind === 'node'); body = `<p class="hint">${T('Global axes: +X right, +Y up, +Mz counter-clockwise. kN, kNm.', 'แกนหลัก: +X ขวา, +Y ขึ้น, +Mz ทวนเข็ม หน่วย kN, kNm')}</p><table class="an-t"><thead><tr><th>${T('Case', 'กรณี')}</th><th>${T('Node', 'จุดต่อ')}</th><th>Fx</th><th>Fy</th><th>Mz</th><th></th></tr></thead><tbody>${rows.map(([l, i]) => `<tr><td>${sel(caseOpts, l.case, `data-tb="loads" data-i="${i}" data-f="case"`)}</td><td>${sel(nodeOpts, l.node, `data-tb="loads" data-i="${i}" data-f="node"`)}</td><td>${cell('loads', i, 'Fx', l.Fx, 'n', 66)}</td><td>${cell('loads', i, 'Fy', l.Fy, 'n', 66)}</td><td>${cell('loads', i, 'Mz', l.Mz, 'n', 66)}</td><td>${del('loads', i)}</td></tr>`).join('')}</tbody></table>${add('nload', T('Add nodal load', 'เพิ่มแรงที่จุดต่อ'))}`; }
      else if (t === 'mloads') { const rows = m.loads.map((l, i) => [l, i]).filter(([l]) => l.kind !== 'node'); body = `<p class="hint">${T('UDL: w₁ → w₂ (kN/m) from a to b (m from end i; blank b = to end j). Point: P (kN) at a. Moment: M (kNm) at a. Gravity directions take positive values downward.', 'แผ่กระจาย: w₁ → w₂ (kN/m) จาก a ถึง b (ม. จากปลาย i; เว้นว่าง b = ถึงปลาย j) แรงจุด: P (kN) ที่ a โมเมนต์: M (kNm) ที่ a ทิศแรงโน้มถ่วงใช้ค่าบวกเมื่อกดลง')}</p><table class="an-t"><thead><tr><th>${T('Case', 'กรณี')}</th><th>${T('Member', 'ชิ้นส่วน')}</th><th>${T('Load', 'ชนิด')}</th><th>${T('Direction', 'ทิศทาง')}</th><th>w₁ / P / M</th><th>w₂</th><th>a</th><th>b</th><th></th></tr></thead><tbody>${rows.map(([l, i]) => `<tr><td>${sel(caseOpts, l.case, `data-tb="loads" data-i="${i}" data-f="case"`)}</td><td>${sel(memOpts, l.member, `data-tb="loads" data-i="${i}" data-f="member"`)}</td><td>${sel([['udl', T('Distributed', 'แผ่กระจาย')], ['point', T('Point', 'แรงจุด')], ['moment', T('Moment', 'โมเมนต์')]], l.kind, `data-tb="loads" data-i="${i}" data-f="kind"`)}</td><td>${l.kind === 'moment' ? '—' : sel(DIRS, l.dir || 'grav', `data-tb="loads" data-i="${i}" data-f="dir"`)}</td><td>${cell('loads', i, l.kind === 'udl' ? 'w1' : l.kind === 'point' ? 'P' : 'M', l.kind === 'udl' ? l.w1 : l.kind === 'point' ? l.P : l.M, 'n', 62)}</td><td>${l.kind === 'udl' ? cell('loads', i, 'w2', l.w2, 'n', 56) : ''}</td><td>${cell('loads', i, 'a', l.a, 'n', 50)}</td><td>${l.kind === 'udl' ? cell('loads', i, 'b', l.b, 'n', 50) : ''}</td><td>${del('loads', i)}</td></tr>`).join('')}</tbody></table>${add('mload', T('Add member load', 'เพิ่มแรงบนชิ้นส่วน'))}`; }
      else if (t === 'combos') body = `<div class="an-preset"><span>${T('Generate from', 'สร้างตาม')}</span>${sel([['AS', 'AS/NZS 1170.0'], ['EC', 'EN 1990 (Eurocode)'], ['ASCE', 'ASCE 7 (LRFD)']], m.code || 'AS', 'id="an-code"')}<button class="btn btn-ghost xs" data-act="an-gen">${T('Generate combinations', 'สร้างกรณีรวมแรง')}</button></div>
        <div class="tbl-wrap"><table class="an-t"><thead><tr><th>ID</th><th>${T('Name', 'ชื่อ')}</th><th>${T('Type', 'ชนิด')}</th>${m.cases.map(c => `<th>${esc(c.id)}</th>`).join('')}<th></th></tr></thead><tbody>${m.combos.map((c, i) => `<tr><td>${cell('combos', i, 'id', c.id, '', 44)}</td><td>${cell('combos', i, 'name', c.name, '', 160)}</td><td>${sel([['ULS', 'ULS'], ['SLS', 'SLS']], c.type, `data-tb="combos" data-i="${i}" data-f="type"`)}</td>${m.cases.map(cs => `<td>${inp((c.f || {})[cs.id] || '', `data-tb="combos" data-i="${i}" data-f="f.${esc(cs.id)}" type="number" step="any"`, 50)}</td>`).join('')}<td>${del('combos', i)}</td></tr>`).join('')}</tbody></table></div>${add('combos', T('Add combination', 'เพิ่มกรณีรวมแรง'))}`;
      else {
        const o = A.opt, lock = pro() ? '' : 'disabled';
        body = `<div class="an-set">
          <p><b>${T('Linear static', 'สถิตเชิงเส้น')}</b> — ${T('always on: every load case, combinations by superposition, envelopes.', 'คำนวณเสมอ: ทุกกรณีน้ำหนัก กรณีรวมแรงโดยการซ้อนทับ และค่าสูงสุด/ต่ำสุด')}</p>
          ${pro() ? '' : `<p class="notice warn">${T('P-Delta, modal and buckling analyses, models over ' + FREE_MEMBERS + ' members and the analysis report are Pro features.', 'การวิเคราะห์ P-Delta โหมด และการโก่งเดาะ โมเดลเกิน ' + FREE_MEMBERS + ' ชิ้นส่วน และรายงานการวิเคราะห์ สำหรับสมาชิก Pro')}</p>`}
          <label class="chkl"><input type="checkbox" data-opt="pdelta" ${o.pdelta ? 'checked' : ''} ${lock}> <b>${T('P-Delta (second-order)', 'P-Delta (อันดับสอง)')}</b> — ${T('combinations solved iteratively with geometric stiffness; members subdivided internally (P-Δ and P-δ).', 'แก้กรณีรวมแรงแบบวนซ้ำด้วย geometric stiffness แบ่งชิ้นส่วนย่อยภายใน (P-Δ และ P-δ)')}</label>
          <label class="chkl"><input type="checkbox" data-opt="modes" ${o.modes ? 'checked' : ''} ${lock}> <b>${T('Modal analysis', 'การวิเคราะห์โหมด')}</b> — ${T('natural frequencies, periods, mode shapes and mass participation.', 'ความถี่ธรรมชาติ คาบ รูปโหมด และสัดส่วนมวลที่มีส่วนร่วม')}</label>
          <div class="an-row"><label>${T('Modes', 'จำนวนโหมด')} <input type="number" min="1" max="20" data-opt="nmodes" value="${o.nmodes}" ${lock}></label><label>${T('Mass source: G ×', 'แหล่งมวล: G ×')} <input type="number" step="any" data-opt="massG" value="${o.massG}" ${lock}></label><label>Q × <input type="number" step="any" data-opt="massQ" value="${o.massQ}" ${lock}></label></div>
          <label class="chkl"><input type="checkbox" data-opt="buckling" ${o.buckling ? 'checked' : ''} ${lock}> <b>${T('Elastic buckling', 'การโก่งเดาะแบบยืดหยุ่น')}</b> — ${T('critical load factor λcr for every ULS combination (λcr < 10: second-order effects matter — AS 4100 §4.4, EN 1993-1-1 §5.2.1).', 'ตัวคูณแรงวิกฤต λcr ของทุกกรณีรวมแรง ULS (λcr < 10: ต้องพิจารณาผลอันดับสอง — AS 4100 §4.4, EN 1993-1-1 §5.2.1)')}</label>
          <div class="an-row"><label>${T('Internal segments per member', 'จำนวนส่วนย่อยต่อชิ้นส่วน')} <input type="number" min="2" max="10" data-opt="nseg" value="${o.nseg}" ${lock}></label></div>
          <p class="hint">${T('Sign convention: N tension +; M sagging + (tension on the right-hand side looking from i to j); reactions + along +X, +Y, counter-clockwise.', 'เครื่องหมาย: N แรงดึง +; M บวกเมื่อดึงด้านขวาเมื่อมองจาก i ไป j; แรงปฏิกิริยา + ตาม +X, +Y, ทวนเข็ม')}</p></div>`;
      }
      return `<div class="an-tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${t === k}" data-act="an-tab" data-t="${k}">${l}</button>`).join('')}</div><div class="an-tb">${body}</div>`;
    }

    // ------------------------------------------------------------------ results panel
    function resultsHTML() {
      if (A.err) return `<p class="form-err">${esc(A.err)}</p>`;
      const r = A.res; if (!r) return '';
      const cur = current(), m = A.model;
      const rt = A.rtab, tabs = [['sum', T('Summary', 'สรุป')], ['react', T('Reactions', 'แรงปฏิกิริยา')], ['forces', T('Member forces', 'แรงในชิ้นส่วน')], ['disp', T('Displacements', 'การเคลื่อนตัว')], ['drift', T('Storey drift', 'การเคลื่อนตัวระหว่างชั้น')], ['modal', T('Modal', 'โหมด')], ['buck', T('Buckling', 'การโก่งเดาะ')]];
      let body = '';
      const env = cur && cur.kind === 'env';
      const memSum = mm => { const g = k => env ? [Math.max(...mm[k + 'max']), Math.min(...mm[k + 'min'])] : [Math.max(...mm[k]), Math.min(...mm[k])]; return { N: g('N'), V: g('V'), M: g('M') }; };
      if (rt === 'sum') {
        let mxM = [0, ''], mxV = [0, ''], mxT = [0, ''], mxC = [0, ''];
        if (cur) cur.mem.forEach(mm => { const s = memSum(mm); const am = Math.max(Math.abs(s.M[0]), Math.abs(s.M[1])), av = Math.max(Math.abs(s.V[0]), Math.abs(s.V[1])); if (am > mxM[0]) mxM = [am, mm.id]; if (av > mxV[0]) mxV = [av, mm.id]; if (s.N[0] > mxT[0]) mxT = [s.N[0], mm.id]; if (s.N[1] < mxC[0]) mxC = [s.N[1], mm.id]; });
        const md = cur && !env ? maxStationDisp(cur) : null;
        const kv = (k, v, u) => `<div><dt>${k}</dt><dd class="mono">${v} <span class="u">${u}</span></dd></div>`;
        body = `<dl class="kv an-kv">${kv(T('Max |M|', '|M| สูงสุด'), fx(mxM[0]) + ' · ' + esc(mxM[1]), 'kNm')}${kv(T('Max |V|', '|V| สูงสุด'), fx(mxV[0]) + ' · ' + esc(mxV[1]), 'kN')}${kv(T('Max tension', 'แรงดึงสูงสุด'), fx(mxT[0]) + ' · ' + esc(mxT[1]), 'kN')}${kv(T('Max compression', 'แรงอัดสูงสุด'), fx(mxC[0]) + ' · ' + esc(mxC[1]), 'kN')}${md ? kv(T('Max displacement', 'การเคลื่อนตัวสูงสุด'), fx(md.d * 1000) + ' mm', '· ' + esc(md.id) + ' @ ' + f(md.x, 2) + ' m') : ''}${kv(T('Model', 'แบบจำลอง'), m.nodes.length + ' ' + T('nodes', 'จุดต่อ') + ' · ' + m.members.length + ' ' + T('members', 'ชิ้นส่วน'), '')}${kv(T('Solved in', 'เวลาคำนวณ'), r.ms, 'ms')}</dl>
          ${r.modal && r.modal.modes.length ? `<p class="muted">${T('Fundamental period', 'คาบพื้นฐาน')} T₁ = <b class="mono">${f(r.modal.modes[0].T, 3)} s</b> (f₁ = ${f(r.modal.modes[0].f, 3)} Hz)</p>` : ''}
          ${r.buckling ? `<p class="muted">${T('Lowest buckling factor', 'ตัวคูณการโก่งเดาะต่ำสุด')} λcr = <b class="mono">${fx(Math.min(...Object.values(r.buckling).map(b => b.modes && b.modes[0] ? b.modes[0].lam : Infinity)))}</b></p>` : ''}
          ${r.warn.length ? `<ul class="warn-list">${r.warn.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}`;
      } else if (rt === 'react') {
        const rows = m.nodes.map((n, i) => [n, i]).filter(([n]) => (n.sup || 'free') !== 'free' || +n.kx || +n.ky || +n.kr);
        body = !cur ? '' : `<table class="chk an-r"><thead><tr><th>${T('Node', 'จุดต่อ')}</th><th class="num">Rx (kN)</th><th class="num">Ry (kN)</th><th class="num">Mz (kNm)</th></tr></thead><tbody>${rows.map(([n, i]) => `<tr><td>${esc(n.id)}</td>${[0, 1, 2].map(d => `<td class="num mono">${env ? fx(cur.R[3 * i + d][0]) + ' … ' + fx(cur.R[3 * i + d][1]) : fx(cur.R[3 * i + d])}</td>`).join('')}</tr>`).join('')}
          ${env ? '' : `<tr class="tot"><td>Σ</td>${[0, 1].map(d => `<td class="num mono">${fx(rows.reduce((s, [, i]) => s + cur.R[3 * i + d], 0))}</td>`).join('')}<td></td></tr>`}</tbody></table>`;
      } else if (rt === 'forces') {
        body = !cur ? '' : `<div class="tbl-wrap"><table class="chk an-r"><thead><tr><th>${T('Member', 'ชิ้นส่วน')}</th><th class="num">L (m)</th><th class="num">N max</th><th class="num">N min</th><th class="num">V max</th><th class="num">V min</th><th class="num">M max (+)</th><th class="num">M min (−)</th>${env ? '' : `<th class="num">δ ${T('rel. chord', 'เทียบคอร์ด')} (mm)</th><th class="num">L/δ</th>`}</tr></thead><tbody>${cur.mem.map(mm => { const s = memSum(mm), dmax = env ? 0 : Math.max(...mm.drel.map(Math.abs)); return `<tr class="${A.sel && A.sel.id === mm.id ? 'on' : ''}" data-act="an-pick" data-m="${esc(mm.id)}"><td>${esc(mm.id)}</td><td class="num mono">${f(mm.L, 3)}</td>${[s.N[0], s.N[1], s.V[0], s.V[1], s.M[0], s.M[1]].map(v => `<td class="num mono">${fx(v)}</td>`).join('')}${env ? '' : `<td class="num mono">${fx(dmax * 1000)}</td><td class="num mono">${dmax > 1e-9 ? f(mm.L / dmax, 0) : '—'}</td>`}</tr>`; }).join('')}</tbody></table></div>`;
      } else if (rt === 'disp') {
        body = !cur || env ? `<p class="muted">${T('Choose a load case or combination.', 'เลือกกรณีน้ำหนักหรือกรณีรวมแรง')}</p>` : `<div class="tbl-wrap"><table class="chk an-r"><thead><tr><th>${T('Node', 'จุดต่อ')}</th><th class="num">ux (mm)</th><th class="num">uy (mm)</th><th class="num">θz (mrad)</th></tr></thead><tbody>${m.nodes.map((n, i) => `<tr><td>${esc(n.id)}</td><td class="num mono">${fx(cur.u[3 * i] * 1000, 3)}</td><td class="num mono">${fx(cur.u[3 * i + 1] * 1000, 3)}</td><td class="num mono">${fx(cur.u[3 * i + 2] * 1000, 3)}</td></tr>`).join('')}</tbody></table></div>`;
      } else if (rt === 'drift') {
        if (!cur || env) body = `<p class="muted">${T('Choose a load case or combination.', 'เลือกกรณีน้ำหนักหรือกรณีรวมแรง')}</p>`;
        else {
          const lv = {}; m.nodes.forEach((n, i) => { const y = (+n.y).toFixed(3); (lv[y] = lv[y] || []).push(cur.u[3 * i]); });
          const ys = Object.keys(lv).map(Number).sort((a, b) => a - b), rows = []; let prev = null;
          ys.forEach(y => { const ux = lv[y.toFixed(3)].reduce((a, b) => a + b, 0) / lv[y.toFixed(3)].length; if (prev) { const h = y - prev.y, d = ux - prev.ux; rows.push({ y, ux, h, d }); } prev = { y, ux }; });
          body = rows.length ? `<table class="chk an-r"><thead><tr><th>${T('Level (m)', 'ระดับ (ม.)')}</th><th class="num">${T('Lateral disp. (mm)', 'การเคลื่อนตัวด้านข้าง (มม.)')}</th><th class="num">${T('Storey height (m)', 'ความสูงชั้น (ม.)')}</th><th class="num">${T('Drift (mm)', 'การเคลื่อนตัวระหว่างชั้น (มม.)')}</th><th class="num">${T('Drift ratio', 'อัตราส่วน')}</th></tr></thead><tbody>${rows.map(rw => `<tr><td class="mono">${f(rw.y, 2)}</td><td class="num mono">${fx(rw.ux * 1000)}</td><td class="num mono">${f(rw.h, 2)}</td><td class="num mono">${fx(rw.d * 1000)}</td><td class="num mono">${Math.abs(rw.d) > 1e-9 ? 'h / ' + f(rw.h / Math.abs(rw.d), 0) : '—'}</td></tr>`).join('')}</tbody></table><p class="hint">${T('Average horizontal displacement of the nodes at each level. Typical limits: h/500 (AS 1170 commentary), h/300 (portal frames, wind).', 'ค่าเฉลี่ยการเคลื่อนตัวแนวราบของจุดต่อในแต่ละระดับ ค่าจำกัดทั่วไป: h/500, h/300 (โครงข้อแข็งรับลม)')}</p>` : `<p class="muted">${T('One level only.', 'มีระดับเดียว')}</p>`;
        }
      } else if (rt === 'modal') {
        body = r.modal ? `<table class="chk an-r"><thead><tr><th>${T('Mode', 'โหมด')}</th><th class="num">f (Hz)</th><th class="num">T (s)</th><th class="num">${T('Mass X', 'มวล X')}</th><th class="num">${T('Mass Y', 'มวล Y')}</th><th class="num">Σ X</th><th class="num">Σ Y</th><th></th></tr></thead><tbody>${r.modal.modes.map((md, i) => `<tr class="${A.view === 'mode' && A.mode === i ? 'on' : ''}"><td>${i + 1}</td><td class="num mono">${f(md.f, 3)}</td><td class="num mono">${f(md.T, 3)}</td><td class="num mono">${f(md.mx * 100, 1)}%</td><td class="num mono">${f(md.my * 100, 1)}%</td><td class="num mono">${f(md.cmx * 100, 1)}%</td><td class="num mono">${f(md.cmy * 100, 1)}%</td><td><button class="btn btn-ghost xs" data-act="an-mode" data-k="${i}">${T('Show', 'แสดง')}</button></td></tr>`).join('')}</tbody></table><p class="hint">${T('Total mass X / Y', 'มวลรวม X / Y')}: ${f(r.modal.massX, 2)} / ${f(r.modal.massY, 2)} t</p>` : `<p class="muted">${pro() ? T('Turn on modal analysis in the Analysis tab.', 'เปิดการวิเคราะห์โหมดในแท็บ การวิเคราะห์') : T('Modal analysis is a Pro feature.', 'การวิเคราะห์โหมดสำหรับสมาชิก Pro')}</p>`;
      } else if (rt === 'buck') {
        body = r.buckling ? `<table class="chk an-r"><thead><tr><th>${T('Combination', 'กรณีรวมแรง')}</th><th class="num">λcr,1</th><th class="num">λcr,2</th><th class="num">λcr,3</th><th>${T('Second-order effects', 'ผลอันดับสอง')}</th><th></th></tr></thead><tbody>${m.combos.filter(c => r.buckling[c.id]).map(c => { const b = r.buckling[c.id], l = b.modes ? b.modes.map(q => q.lam) : []; const l1 = l[0]; return `<tr><td>${esc(c.id)} — ${esc(c.name)}</td>${[0, 1, 2].map(i => `<td class="num mono">${l[i] ? f(l[i], 2) : b.none && i === 0 ? '∞' : '—'}</td>`).join('')}<td>${l1 ? (l1 < 3 ? `<span class="pill st-bad">${T('λcr < 3: unstable / redesign', 'λcr < 3: ไม่มั่นคง ควรแก้ไข')}</span>` : l1 < 10 ? `<span class="pill st-warn">${T('3 ≤ λcr < 10: use second-order (P-Delta)', '3 ≤ λcr < 10: ใช้การวิเคราะห์อันดับสอง')}</span>` : `<span class="pill st-ok">${T('λcr ≥ 10: first-order OK', 'λcr ≥ 10: อันดับหนึ่งเพียงพอ')}</span>`) : ''}</td><td>${l1 ? `<button class="btn btn-ghost xs" data-act="an-buck" data-c="${esc(c.id)}">${T('Show', 'แสดง')}</button>` : ''}</td></tr>`; }).join('')}</tbody></table>` : `<p class="muted">${pro() ? T('Turn on buckling analysis in the Analysis tab.', 'เปิดการวิเคราะห์การโก่งเดาะในแท็บ การวิเคราะห์') : T('Buckling analysis is a Pro feature.', 'การวิเคราะห์การโก่งเดาะสำหรับสมาชิก Pro')}</p>`;
      }
      return `<div class="tabs sm" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${rt === k}" data-act="an-rtab" data-t="${k}">${l}</button>`).join('')}</div><div class="an-rb">${body}</div>`;
    }
    // selected member detail: small N / V / M / δ charts
    function memberHTML() {
      const cur = current(); if (!A.sel || A.sel.k !== 'm' || !cur) return '';
      const mm = cur.mem.find(q => q.id === A.sel.id); if (!mm) return '';
      const mb = A.model.members.find(q => q.id === mm.id), env = cur.kind === 'env';
      const chart = (lbl, unit, arrs, cls) => {
        const Wc = 300, Hc = 110, all = arrs.flat(), mx = Math.max(1e-9, ...all.map(Math.abs)), X = x => 10 + (Wc - 20) * x / mm.L, Y = v => Hc / 2 - v / mx * (Hc / 2 - 14) * (cls === 'M' ? -1 : 1);
        const paths = arrs.map(a => `<path d="M${X(0)} ${Hc / 2} ${a.map((v, i) => `L${X(mm.x[i]).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ')} L${X(mm.L)} ${Hc / 2} Z" class="an-dg ${cls}"/>`).join('');
        const mxv = Math.max(...all), mnv = Math.min(...all);
        return `<figure class="an-mc"><figcaption>${lbl} <span class="mono">${f(mnv, 2)} … ${f(mxv, 2)} ${unit}</span></figcaption><svg viewBox="0 0 ${Wc} ${Hc}"><line x1="10" x2="${Wc - 10}" y1="${Hc / 2}" y2="${Hc / 2}" class="an-ax"/>${paths}</svg></figure>`;
      };
      const g = q => env ? [mm[q + 'max'], mm[q + 'min']] : [mm[q]];
      const s = A.model.sections.find(q => q.id === mb.sec), p = s ? F.secProps(s) : null;
      return `<div class="card an-member"><div class="an-mh"><h3>${T('Member', 'ชิ้นส่วน')} ${esc(mm.id)} <span class="muted small">${esc(mb.i)} → ${esc(mb.j)} · L = ${f(mm.L, 3)} m · ${esc(mb.sec)}${p ? ' (A ' + f(p.A, 0) + ' mm², I ' + f(p.I / 1e6, 1) + '×10⁶ mm⁴)' : ''}</span></h3>
        <div class="an-send"><button class="btn btn-ghost xs" data-act="an-send" data-e="beam">${T('Design as RC beam →', 'ออกแบบเป็นคาน คสล. →')}</button><button class="btn btn-ghost xs" data-act="an-send" data-e="column">${T('Design as RC column →', 'ออกแบบเป็นเสา คสล. →')}</button></div></div>
        <div class="an-mcs">${chart(T('Axial N', 'แรงตามแนวแกน N'), 'kN', g('N'), 'N')}${chart(T('Shear V', 'แรงเฉือน V'), 'kN', g('V'), 'V')}${chart(T('Moment M', 'โมเมนต์ M'), 'kNm', g('M'), 'M')}${env ? '' : chart(T('Deflection rel. chord', 'การโก่งเทียบคอร์ด'), 'mm', [mm.drel.map(v => v * 1000)], 'D')}</div></div>`;
    }

    // ------------------------------------------------------------------ page
    function view() {
      if (!A.res && !A.err) run();
      const srcs = srcList(), views = [['model', T('Model & loads', 'แบบจำลองและแรง')], ['def', T('Deflected', 'การโก่งตัว')], ['M', 'M'], ['V', 'V'], ['N', 'N'], ['react', T('Reactions', 'แรงปฏิกิริยา')], ['mode', T('Modes', 'โหมด')], ['buck', T('Buckling', 'การโก่งเดาะ')]];
      return `<main class="wrap page an">
        <div class="page-head"><div><p class="eyebrow">Structural Analysis · ${T('2D frame & truss', 'โครงข้อแข็งและโครงถัก 2 มิติ')}</p><h1>${T('Frame analysis', 'วิเคราะห์โครงสร้าง')}</h1><p class="muted">${T('Linear static, P-Delta, modal and buckling analysis with load combinations and envelopes — finite-element stiffness method.', 'วิเคราะห์สถิตเชิงเส้น P-Delta โหมด และการโก่งเดาะ พร้อมการรวมแรงและค่าสูงสุด/ต่ำสุด — วิธีสติฟเนสไฟไนต์เอลิเมนต์')}</p></div>
          <div class="dz-actions an-acts"><button class="btn btn-ghost sm" data-act="an-tplopen">${T('New from template', 'สร้างจากแม่แบบ')}</button><button class="btn btn-ghost sm" data-act="an-save">${T('Save model', 'บันทึกแบบจำลอง')}</button><label class="btn btn-ghost sm an-open">${T('Open model', 'เปิดแบบจำลอง')}<input type="file" accept=".json,application/json" id="an-file" hidden></label><button class="btn ${pro() ? 'btn-hot' : 'btn-lock'} sm" data-act="an-report">${pro() ? T('Analysis report', 'รายงานการวิเคราะห์') : '🔒 ' + T('Report (Pro)', 'รายงาน (Pro)')}</button></div></div>
        ${A.tplOpen ? tplHTML() : ''}
        <div class="an-grid">
          <aside class="an-side card" id="anSide">${tables()}</aside>
          <section class="an-main">
            <div class="card an-view">
              <div class="an-bar"><div class="seg" role="group" aria-label="${T('View', 'มุมมอง')}">${views.map(([k, l]) => `<button data-act="an-view" data-v="${k}" aria-pressed="${A.view === k}">${l}</button>`).join('')}</div>
                <div class="an-bar2">${A.view === 'model' ? `<label>${T('Loads', 'แรง')} ${sel([['all', T('All cases', 'ทุกกรณี')]].concat(A.model.cases.map(c => [c.id, c.id + ' — ' + c.name])), A.lcase, 'id="an-lcase"')}</label>` : A.view === 'mode' ? `<label>${T('Mode', 'โหมด')} ${sel((A.res && A.res.modal ? A.res.modal.modes : []).map((md, i) => [i, (i + 1) + ' · ' + f(md.f, 2) + ' Hz']), A.mode, 'id="an-mode"')}</label>` : `<label>${T('Results for', 'ผลของ')} ${sel(srcs, A.src, 'id="an-src"')}</label>`}
                  <label>${T('Scale', 'มาตราส่วน')} <input type="range" min="0.2" max="4" step="0.1" value="${A.dscale}" id="an-scale"></label>
                  <label class="chkl sm"><input type="checkbox" id="an-labels" ${A.labels ? 'checked' : ''}> ${T('Labels', 'ป้ายชื่อ')}</label></div></div>
              <div class="an-canvas" id="anCanvas">${svgModel()}</div>
              <p class="hint">${T('Click a member or node to select it. Units: kN, m, kNm.', 'คลิกชิ้นส่วนหรือจุดต่อเพื่อเลือก หน่วย kN, m, kNm')}</p>
            </div>
            <div id="anMember">${memberHTML()}</div>
            <div class="card an-results" id="anRes">${resultsHTML()}</div>
          </section>
        </div>
        <div id="reportWrap"></div></main>`;
    }
    function tplHTML() {
      const p = Object.assign({}, TPL[A.tpl].p, A.tplP || {});
      const fld = (k, lbl, type) => `<label>${lbl}<input data-tp="${k}" value="${esc(p[k])}" ${type === 'n' ? 'type="number" step="any"' : ''}></label>`;
      const form = A.tpl === 'beam' ? fld('spans', T('Spans (m), comma separated', 'ช่วงคาน (ม.) คั่นด้วยจุลภาค')) + fld('g', T('Dead UDL G (kN/m, plus self-weight)', 'น้ำหนักคงที่ G (kN/m ไม่รวมน้ำหนักตัวเอง)'), 'n') + fld('q', T('Live UDL Q (kN/m)', 'น้ำหนักจร Q (kN/m)'), 'n')
        : A.tpl === 'portal' ? fld('span', T('Span (m)', 'ช่วงกว้าง (ม.)'), 'n') + fld('eave', T('Eave height (m)', 'ความสูงชายคา (ม.)'), 'n') + fld('rise', T('Apex rise (m)', 'ความสูงจั่ว (ม.)'), 'n') + fld('bay', T('Frame spacing (m)', 'ระยะห่างโครง (ม.)'), 'n') + `<label>${T('Bases', 'ฐาน')}${sel([['pin', T('Pinned', 'หมุด')], ['fixed', T('Fixed', 'ยึดแน่น')]], p.base, 'data-tp="base"')}</label>`
          : A.tpl === 'frame' ? fld('bays', T('Bay widths (m)', 'ช่วงกว้าง (ม.)')) + fld('storeys', T('Storey heights (m), bottom up', 'ความสูงชั้น (ม.) จากล่างขึ้นบน')) + fld('g', T('Beam dead UDL G (kN/m)', 'น้ำหนักคงที่บนคาน G (kN/m)'), 'n') + fld('q', T('Beam live UDL Q (kN/m)', 'น้ำหนักจรบนคาน Q (kN/m)'), 'n') + fld('wind', T('Wind force per floor (kN)', 'แรงลมต่อชั้น (kN)'), 'n')
            : `<label>${T('Type', 'ชนิด')}${sel([['pratt', 'Pratt'], ['howe', 'Howe'], ['warren', 'Warren']], p.kind, 'data-tp="kind"')}</label>` + fld('span', T('Span (m)', 'ช่วงกว้าง (ม.)'), 'n') + fld('depth', T('Depth (m)', 'ความลึก (ม.)'), 'n') + fld('panels', T('Panels (even)', 'จำนวนช่อง (คู่)'), 'n') + fld('load', T('Dead load per top node (kN)', 'น้ำหนักคงที่ต่อจุดต่อบน (kN)'), 'n');
      return `<div class="card an-tpl"><div class="seg" role="group">${Object.entries(TPL).map(([k, v]) => `<button data-act="an-tpl" data-t="${k}" aria-pressed="${A.tpl === k}">${T(v.n[0], v.n[1])}</button>`).join('')}</div><div class="mgrid an-tplf">${form}</div><div class="mfoot"><span class="muted small">${T('Replaces the current model. Loads, sections and AS/NZS 1170.0 combinations are filled in — edit them in the tables.', 'แทนที่แบบจำลองปัจจุบัน ระบบใส่แรง หน้าตัด และกรณีรวมแรงตาม AS/NZS 1170.0 ให้ — แก้ไขได้ในตาราง')}</span><span class="grow"></span><button class="btn btn-ghost sm" data-act="an-tplclose">${T('Cancel', 'ยกเลิก')}</button><button class="btn btn-hot sm" data-act="an-tplgo">${T('Create model', 'สร้างแบบจำลอง')}</button></div></div>`;
    }
    function drawAll() {
      const c = $('#anCanvas'); if (c) c.innerHTML = svgModel();
      const r = $('#anRes'); if (r) r.innerHTML = resultsHTML();
      const mm = $('#anMember'); if (mm) mm.innerHTML = memberHTML();
      const s = $('#an-src'); if (s) { const list = srcList(); s.innerHTML = list.map(o => `<option value="${esc(o[0])}" ${o[0] === A.src ? 'selected' : ''}>${esc(o[1])}</option>`).join(''); }
    }
    function sideRefresh() { const s = $('#anSide'); if (s) { const sc = s.scrollTop; s.innerHTML = tables(); s.scrollTop = sc; } }
    function mount() {
      const c = $('#anCanvas'); if (!c || c._b) return; c._b = true;
      c.addEventListener('click', ev => { const t = ev.target.closest('[data-sel]'); if (!t) return; const [k, id] = t.dataset.sel.split(':'); A.sel = A.sel && A.sel.k === k && A.sel.id === id ? null : { k, id }; drawAll(); sideRefresh(); });
    }

    // ------------------------------------------------------------------ editing
    const nextId = (arr, p) => { let i = arr.length + 1; while (arr.some(o => o.id === p + i)) i++; return p + i; };
    function addRow(tb) {
      const m = A.model;
      if (tb === 'nodes') { const l = m.nodes[m.nodes.length - 1]; m.nodes.push({ id: nextId(m.nodes, 'N'), x: l ? +l.x + 1 : 0, y: l ? +l.y : 0, sup: 'free' }); }
      else if (tb === 'members') { const n = m.nodes; m.members.push({ id: nextId(m.members, 'M'), i: n[0] ? n[0].id : '', j: n[1] ? n[1].id : '', sec: m.sections[0] ? m.sections[0].id : '', mat: m.materials[0] ? m.materials[0].id : '', type: 'frame' }); }
      else if (tb === 'sections') m.sections.push({ id: nextId(m.sections, 'S'), name: '', type: 'rect', b: 300, h: 500 });
      else if (tb === 'materials') m.materials.push({ id: nextId(m.materials, 'MAT'), name: '', E: 200000, rho: 78.5 });
      else if (tb === 'cases') { const id = nextId(m.cases, 'L'); m.cases.push({ id, name: id, type: 'O', sw: false }); }
      else if (tb === 'nload') m.loads.push({ case: m.cases[0] ? m.cases[0].id : '', kind: 'node', node: m.nodes[0] ? m.nodes[0].id : '', Fx: 0, Fy: -10, Mz: 0 });
      else if (tb === 'mload') m.loads.push({ case: m.cases[0] ? m.cases[0].id : '', kind: 'udl', member: m.members[0] ? m.members[0].id : '', dir: 'grav', w1: 5, w2: '', a: '', b: '' });
      else if (tb === 'combos') m.combos.push({ id: nextId(m.combos, 'C'), name: '', type: 'ULS', f: {} });
    }
    function rename(tb, oldId, nid) {
      const m = A.model;
      if (tb === 'nodes') { m.members.forEach(x => { if (x.i === oldId) x.i = nid; if (x.j === oldId) x.j = nid; }); m.loads.forEach(l => { if (l.node === oldId) l.node = nid; }); }
      if (tb === 'members') m.loads.forEach(l => { if (l.member === oldId) l.member = nid; });
      if (tb === 'sections') m.members.forEach(x => { if (x.sec === oldId) x.sec = nid; });
      if (tb === 'materials') m.members.forEach(x => { if (x.mat === oldId) x.mat = nid; });
      if (tb === 'cases') { m.loads.forEach(l => { if (l.case === oldId) l.case = nid; }); m.combos.forEach(c => { if (c.f && oldId in c.f) { c.f[nid] = c.f[oldId]; delete c.f[oldId]; } }); }
    }
    function onInput(t) {
      if (t.dataset.tp) { A.tplP = Object.assign({}, TPL[A.tpl].p, A.tplP || {}); A.tplP[t.dataset.tp] = t.value; return true; }
      if (t.dataset.opt) { const k = t.dataset.opt; A.opt[k] = t.type === 'checkbox' ? t.checked : +t.value; schedule(); return true; }
      if (t.id === 'an-src') { A.src = t.value; drawAll(); return true; }
      if (t.id === 'an-lcase') { A.lcase = t.value; drawAll(); return true; }
      if (t.id === 'an-mode') { A.mode = +t.value; drawAll(); return true; }
      if (t.id === 'an-scale') { A.dscale = +t.value; const c = $('#anCanvas'); if (c) c.innerHTML = svgModel(); return true; }
      if (t.id === 'an-labels') { A.labels = t.checked; const c = $('#anCanvas'); if (c) c.innerHTML = svgModel(); return true; }
      if (t.id === 'an-file') { const fl = t.files[0]; if (!fl) return true; fl.text().then(txt => { try { const j = JSON.parse(txt), mm = j.model || j; if (!mm.nodes || !mm.members) throw 0; A.model = Object.assign({ loads: [], combos: [], cases: [], sections: [], materials: [] }, mm); if (j.opt) A.opt = Object.assign(A.opt, j.opt); A.sel = null; A.src = null; A.lcase = A.model.cases[0] ? A.model.cases[0].id : 'all'; persist(); run(); ctx.render(); toast(T('Model opened', 'เปิดแบบจำลองแล้ว'), 'ok'); } catch (e) { toast(T('That file is not a StructCap model.', 'ไฟล์นี้ไม่ใช่แบบจำลอง StructCap'), 'bad'); } }); return true; }
      if (!t.dataset.tb) return false;
      const tb = t.dataset.tb, i = +t.dataset.i, fld = t.dataset.f, row = A.model[tb][i]; if (!row) return true;
      let v = t.type === 'checkbox' ? t.checked : t.value;
      if (fld.startsWith('f.')) { row.f = row.f || {}; const k = fld.slice(2); if (v === '' || +v === 0) delete row.f[k]; else row.f[k] = +v; }
      else if (fld === 'id') { const nid = String(v).trim(); if (!nid || A.model[tb].some((o, k) => k !== i && o.id === nid)) { t.classList.add('bad'); return true; } t.classList.remove('bad'); rename(tb, row.id, nid); if (A.sel && A.sel.id === row.id) A.sel.id = nid; row.id = nid; }
      else if (['x', 'y', 'kx', 'ky', 'kr', 'b', 'h', 'd', 'bf', 'tf', 'tw', 'D', 'A', 'I', 'E', 'rho', 'Fx', 'Fy', 'Mz', 'w1', 'P', 'M'].includes(fld)) row[fld] = v === '' ? '' : +v;
      else row[fld] = v;
      if (tb === 'sections' && fld === 'shape') { const o = G.GANTRY ? G.GANTRY.sizeOptions(v) : []; row.size = o[0] ? o[0][0] : ''; }
      if ((tb === 'sections' && (fld === 'type' || fld === 'shape')) || (tb === 'loads' && fld === 'kind') || (tb === 'members' && fld === 'type') || (tb === 'cases' && fld === 'id')) {
        if (tb === 'sections' && fld === 'type') Object.assign(row, { rect: { b: 300, h: 500 }, I: { d: 356, bf: 171, tf: 11.5, tw: 7.3 }, circ: { D: 400 }, tube: { shape: 'SHS', size: (G.GANTRY ? G.GANTRY.sizeOptions('SHS')[0][0] : '') }, user: { A: 10000, I: 100e6 } }[v]);
        if (tb === 'loads' && fld === 'kind') Object.assign(row, v === 'udl' ? { w1: row.w1 || 5, dir: row.dir || 'grav' } : v === 'point' ? { P: row.P || 10, a: row.a || 1, dir: row.dir || 'grav' } : { M: row.M || 10, a: row.a || 1 });
        sideRefresh();
      }
      if (tb === 'members' && (fld === 'i' || fld === 'j')) sideRefresh();
      schedule();
      return true;
    }
    function onClick(a, b) {
      const m = A.model;
      if (a === 'an-tab') { A.tab = b.dataset.t; sideRefresh(); }
      else if (a === 'an-rtab') { A.rtab = b.dataset.t; const r = $('#anRes'); if (r) r.innerHTML = resultsHTML(); }
      else if (a === 'an-view') { A.view = b.dataset.v; if (A.view === 'buck' && !(A.src || '').startsWith('combo:')) { const c = m.combos.find(q => q.type === 'ULS'); if (c) A.src = 'combo:' + c.id; } ctx.render(); }
      else if (a === 'an-add') { addRow(b.dataset.tb); sideRefresh(); schedule(); }
      else if (a === 'an-del') { const tb = b.dataset.tb, i = +b.dataset.i, row = m[tb][i]; m[tb].splice(i, 1); if (tb === 'nodes') { m.members = m.members.filter(x => x.i !== row.id && x.j !== row.id); m.loads = m.loads.filter(l => l.node !== row.id); } if (tb === 'members') m.loads = m.loads.filter(l => l.member !== row.id); if (tb === 'cases') { m.loads = m.loads.filter(l => l.case !== row.id); m.combos.forEach(c => { if (c.f) delete c.f[row.id]; }); } if (A.sel && A.sel.id === row.id) A.sel = null; sideRefresh(); schedule(); }
      else if (a === 'an-mat') { const mt = clone(MAT[b.dataset.m]); let id = mt.id, k = 2; while (m.materials.some(q => q.id === id)) id = mt.id + k++; mt.id = id; m.materials.push(mt); sideRefresh(); schedule(); }
      else if (a === 'an-gen') { m.code = $('#an-code').value; m.combos = preset(m.code, m.cases); A.src = null; sideRefresh(); schedule(); toast(T('Combinations generated', 'สร้างกรณีรวมแรงแล้ว'), 'ok'); }
      else if (a === 'an-tplopen') { A.tplOpen = true; ctx.render(); }
      else if (a === 'an-tplclose') { A.tplOpen = false; ctx.render(); }
      else if (a === 'an-tpl') { A.tpl = b.dataset.t; A.tplP = null; ctx.render(); }
      else if (a === 'an-tplgo') { const p = Object.assign({}, TPL[A.tpl].p, A.tplP || {}); try { A.model = build(A.tpl, p); A.sel = null; A.src = null; A.lcase = A.model.cases[0] ? A.model.cases[0].id : 'all'; A.tplOpen = false; A.tab = 'nodes'; persist(); run(); ctx.render(); toast(T('Model created', 'สร้างแบบจำลองแล้ว'), 'ok'); } catch (e) { toast(T('Check the template values.', 'ตรวจสอบค่าที่กรอก'), 'bad'); } }
      else if (a === 'an-save') { const blob = new Blob([JSON.stringify({ app: 'StructCap', kind: 'frame2d', version: 1, model: m, opt: A.opt }, null, 1)], { type: 'application/json' }); const name = (m.name || 'model').replace(/[^\w\-]+/g, '_') + '_' + today() + '.json'; ctx.saveFile(name, blob); }
      else if (a === 'an-pick') { A.sel = { k: 'm', id: b.dataset.m }; drawAll(); sideRefresh(); const mm = $('#anMember'); if (mm) mm.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
      else if (a === 'an-mode') { A.mode = +b.dataset.k; A.view = 'mode'; ctx.render(); }
      else if (a === 'an-buck') { A.src = 'combo:' + b.dataset.c; A.view = 'buck'; ctx.render(); }
      else if (a === 'an-send') sendToDesign(b.dataset.e);
      else if (a === 'an-report') { if (!pro()) { toast(T('The analysis report is a Pro feature.', 'รายงานการวิเคราะห์สำหรับสมาชิก Pro'), 'bad'); return; } renderReport(); const w = $('#reportWrap'); if (w) w.scrollIntoView({ behavior: 'smooth' }); }
      else return false;
      return true;
    }
    function sendToDesign(elem) {
      const cur = current(); if (!cur || !A.sel) return;
      const mm = cur.mem.find(q => q.id === A.sel.id); if (!mm) return;
      const env = cur.kind === 'env', mxA = k => env ? Math.max(...mm[k + 'max'].map(Math.abs), ...mm[k + 'min'].map(Math.abs)) : Math.max(...mm[k].map(Math.abs));
      const Msag = env ? Math.max(...mm.Mmax) : Math.max(...mm.M), Mhog = env ? Math.min(...mm.Mmin) : Math.min(...mm.M);
      const M = Math.abs(Msag) >= Math.abs(Mhog) ? Msag : Mhog, V = mxA('V'), Nc = env ? -Math.min(...mm.Nmin) : -Math.min(...mm.N);
      ctx.toDesign(elem, { M, V, N: Math.max(0, Nc), id: mm.id, src: A.src });
    }

    // ------------------------------------------------------------------ report
    function renderReport() {
      const m = A.model, r = A.res; if (!r) return;
      const Mt = S.meta, cur = current();
      const tbl = (head, rows) => `<table class="rp-t an-rp"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(rw => `<tr>${rw.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      const sec = (n, title, html) => `<section class="rp-sec"><h3><span class="rp-n">${n}</span>${title}</h3>${html}</section>`;
      const snap = (v, lc) => { const o = A.view, osrc = A.src, ol = A.lcase; A.view = v; if (lc !== undefined) A.lcase = lc; const s = svgModel(); A.view = o; A.src = osrc; A.lcase = ol; return `<figure class="an-fig">${s}</figure>`; };
      const sv = A.src;
      const combos = m.combos.filter(c => r.combos[c.id] && !r.combos[c.id].failed);
      let html = sec(1, T('Model', 'แบบจำลอง'), snap('model', '__none') + tbl([T('Node', 'จุดต่อ'), 'X (m)', 'Y (m)', T('Support', 'จุดรองรับ')], m.nodes.map(n => [esc(n.id), f(+n.x, 3), f(+n.y, 3), esc((SUP.find(s => s[0] === (n.sup || 'free')) || [])[1] || n.sup)])) +
        tbl([T('Member', 'ชิ้นส่วน'), 'i', 'j', T('Section', 'หน้าตัด'), T('Material', 'วัสดุ'), T('Type', 'ชนิด'), T('Hinges', 'บานพับ'), 'L (m)'], m.members.map(x => { const a = m.nodes.find(n => n.id === x.i), b = m.nodes.find(n => n.id === x.j); return [esc(x.id), esc(x.i), esc(x.j), esc(x.sec), esc(x.mat), x.type === 'truss' ? T('truss', 'โครงถัก') : T('frame', 'โครงข้อแข็ง'), (x.relI ? 'i ' : '') + (x.relJ ? 'j' : ''), a && b ? f(Math.hypot(b.x - a.x, b.y - a.y), 3) : '']; })) +
        tbl([T('Section', 'หน้าตัด'), T('Name', 'ชื่อ'), 'A (mm²)', 'I (×10⁶ mm⁴)'], m.sections.map(s => { const p = F.secProps(s); return [esc(s.id), esc(s.name || s.type), f(p.A, 0), f(p.I / 1e6, 2)]; })) +
        tbl([T('Material', 'วัสดุ'), 'E (MPa)', T('Unit weight (kN/m³)', 'หน่วยน้ำหนัก (kN/m³)')], m.materials.map(x => [esc(x.id + (x.name ? ' — ' + x.name : '')), f(+x.E, 0), f(+x.rho, 1)])));
      html += sec(2, T('Loads and combinations', 'แรงและกรณีรวมแรง'), m.cases.filter(c => m.loads.some(l => l.case === c.id)).map(c => `<p class="rp-txt"><b>${esc(c.id)} — ${esc(c.name)}</b></p>` + snap('model', c.id)).join('') + tbl([T('Case', 'กรณี'), T('Name', 'ชื่อ'), T('Type', 'ประเภท'), T('Self-weight', 'น้ำหนักตัวเอง')], m.cases.map(c => [esc(c.id), esc(c.name), c.type, c.sw ? '✓' : ''])) +
        tbl([T('Case', 'กรณี'), T('On', 'ที่'), T('Load', 'แรง'), T('Values', 'ค่า')], m.loads.map(l => [esc(l.case), esc(l.kind === 'node' ? l.node : l.member), l.kind === 'node' ? T('nodal', 'ที่จุดต่อ') : l.kind + ' · ' + (DIRS.find(d => d[0] === l.dir) || ['', ''])[1], l.kind === 'node' ? `Fx ${f(+l.Fx || 0, 2)}, Fy ${f(+l.Fy || 0, 2)}, Mz ${f(+l.Mz || 0, 2)}` : l.kind === 'udl' ? `w ${f(+l.w1 || 0, 2)}${l.w2 !== '' && l.w2 != null ? '→' + f(+l.w2, 2) : ''} kN/m${+l.a || (l.b !== '' && l.b != null) ? ` (${f(+l.a || 0, 2)}–${l.b !== '' && l.b != null ? f(+l.b, 2) : 'L'} m)` : ''}` : l.kind === 'point' ? `P ${f(+l.P || 0, 2)} kN @ ${f(+l.a || 0, 2)} m` : `M ${f(+l.M || 0, 2)} kNm @ ${f(+l.a || 0, 2)} m`])) +
        tbl([T('Combination', 'กรณีรวมแรง'), T('Type', 'ชนิด'), T('Factors', 'ตัวคูณ')], m.combos.map(c => [esc(c.id + ' — ' + c.name), c.type, Object.entries(c.f || {}).map(([k, v]) => f(v, 2) + '·' + esc(k)).join(' + ')])));
      html += sec(3, T('Analysis', 'การวิเคราะห์'), `<p class="rp-txt">${T('Finite-element stiffness method, 2D frame elements (3 DOF per node) with exact fixed-end actions for member loads.', 'วิธีสติฟเนสไฟไนต์เอลิเมนต์ ชิ้นส่วนโครงข้อแข็ง 2 มิติ (3 องศาอิสระต่อจุด) ใช้แรงปลายยึดแน่นที่แม่นตรงสำหรับแรงบนชิ้นส่วน')} ${A.opt.pdelta && pro() ? T('Second-order P-Delta analysis of every combination (members subdivided into ' + A.opt.nseg + ' segments).', 'วิเคราะห์อันดับสอง P-Delta ทุกกรณีรวมแรง (แบ่งชิ้นส่วนเป็น ' + A.opt.nseg + ' ส่วน)') : T('First-order (linear) analysis; combinations by superposition.', 'วิเคราะห์อันดับหนึ่ง (เชิงเส้น) รวมแรงโดยการซ้อนทับ')}</p>`);
      // results per ULS combination: reactions + member extremes
      let n = 4;
      combos.forEach(c => {
        A.src = 'combo:' + c.id; const rc = current(), sums = rc.mem.map(mm => [esc(mm.id), f(Math.max(...mm.N), 2), f(Math.min(...mm.N), 2), f(Math.max(...mm.V.map(Math.abs)), 2), f(Math.max(...mm.M), 2), f(Math.min(...mm.M), 2), f(Math.max(...mm.drel.map(Math.abs)) * 1000, 2)]);
        const sup = m.nodes.map((nn, i) => [nn, i]).filter(([nn]) => (nn.sup || 'free') !== 'free' || +nn.kx || +nn.ky || +nn.kr);
        html += sec(n++, esc(c.id + ' — ' + c.name) + ' <span class="rp-cl">' + c.type + '</span>', (c.type === 'ULS' ? `<div class="an-figs">${snap('M')}${snap('V')}${snap('N')}</div>` : `<div class="an-figs">${snap('def')}</div>`) +
          tbl([T('Node', 'จุดต่อ'), 'Rx (kN)', 'Ry (kN)', 'Mz (kNm)'], sup.map(([nn, i]) => [esc(nn.id), f(rc.R[3 * i], 2), f(rc.R[3 * i + 1], 2), f(rc.R[3 * i + 2], 2)])) +
          tbl([T('Member', 'ชิ้นส่วน'), 'N max', 'N min', '|V| max', 'M max', 'M min', 'δ (mm)'], sums));
      });
      A.src = sv;
      if (r.modal) html += sec(n++, T('Modal analysis', 'การวิเคราะห์โหมด'), tbl([T('Mode', 'โหมด'), 'f (Hz)', 'T (s)', T('Mass X', 'มวล X'), T('Mass Y', 'มวล Y')], r.modal.modes.map((md, i) => [i + 1, f(md.f, 3), f(md.T, 3), f(md.mx * 100, 1) + '%', f(md.my * 100, 1) + '%'])));
      if (r.buckling) html += sec(n++, T('Elastic buckling', 'การโก่งเดาะแบบยืดหยุ่น'), tbl([T('Combination', 'กรณีรวมแรง'), 'λcr,1', 'λcr,2', 'λcr,3'], m.combos.filter(c => r.buckling[c.id]).map(c => { const b = r.buckling[c.id], l = b.modes ? b.modes.map(q => f(q.lam, 2)) : []; return [esc(c.id + ' — ' + c.name), l[0] || (b.none ? '∞' : '—'), l[1] || '—', l[2] || '—']; })));
      if (r.warn.length) html += `<ul class="warn-list">${r.warn.map(w => `<li>${esc(w)}</li>`).join('')}</ul>`;
      $('#reportWrap').innerHTML = `<div class="rp-bar"><h2>${T('Analysis report', 'รายงานการวิเคราะห์')}</h2>
        <div class="rp-meta">${[['project', T('Project', 'โครงการ')], ['job', T('Job no.', 'เลขที่งาน')], ['ref', T('Model ref.', 'ชื่อแบบจำลอง')], ['by', T('Analysed by', 'ผู้วิเคราะห์')], ['checked', T('Checked by', 'ผู้ตรวจสอบ')]].map(([k, l]) => `<label>${l}<input id="meta-${k}" data-meta="${k}" value="${esc(Mt[k])}"></label>`).join('')}</div>
        <div class="rp-btns"><button class="btn btn-hot sm" data-act="pdf" id="pdfBtn">${T('Export PDF', 'ส่งออก PDF')}</button><button class="btn btn-ghost sm" data-act="closeReport">${T('Close', 'ปิด')}</button></div></div>
        <article class="report" id="report" lang="${S.ui}">
          <header class="rp-head"><div class="rp-brand">${logoMark(34)}<div><b>StructCap</b><small>${T('Structural analysis · 2D frame', 'วิเคราะห์โครงสร้าง · โครงข้อแข็ง 2 มิติ')}</small></div></div>
            <table class="rp-hd"><tr><th>${T('Project', 'โครงการ')}</th><td id="rv-project">${esc(Mt.project)}</td><th>${T('Job no.', 'เลขที่งาน')}</th><td id="rv-job">${esc(Mt.job)}</td></tr>
            <tr><th>${T('Model', 'แบบจำลอง')}</th><td>${esc(m.name || '')} · <span id="rv-ref">${esc(Mt.ref)}</span></td><th>${T('Date', 'วันที่')}</th><td>${today()}</td></tr>
            <tr><th>${T('Analysed', 'วิเคราะห์')}</th><td id="rv-by">${esc(Mt.by)}</td><th>${T('Checked', 'ตรวจสอบ')}</th><td id="rv-checked">${esc(Mt.checked)}</td></tr></table></header>
          ${html}
          <p class="rp-foot"><b>${COPY}</b> · ${T('Generated by StructCap. Units kN, m, kNm. The engineer remains responsible for the model, loads and interpretation of results.', 'จัดทำโดย StructCap หน่วย kN, m, kNm วิศวกรต้องรับผิดชอบต่อแบบจำลอง แรง และการตีความผลลัพธ์')}</p>
        </article>`;
    }

    return { view, mount, onClick, onInput, run, state: A, build, preset, TPL };
  };
})(typeof window !== 'undefined' ? window : globalThis);
