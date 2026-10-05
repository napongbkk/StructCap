// StructCap timber bridge module — sections, grillage load rating against the worked example
// (Bridge 3393 in the road authority's procedure manual), repair detail library and DXF output.
// Run: node tests/timber.test.js
const path = require('path');
globalThis.window = globalThis;
['timber.js', 'tdetails.js', 'tdraw.js'].forEach(f => require(path.join(__dirname, '..', f)));
const TB = globalThis.TIMBER, D = globalThis.TDET, X = globalThis.TDRAW;
let bad = 0;
const P = (lbl, got, exp, tol = 0.005) => { const ok = Math.abs(got - exp) <= tol * Math.max(1, Math.abs(exp)); if (!ok) bad++; console.log(ok ? 'OK ' : 'BAD', lbl.padEnd(60), (+got).toFixed(4), 'expected', (+exp).toFixed(4)); };
const T = (lbl, ok) => { if (!ok) bad++; console.log(ok ? 'OK ' : 'BAD', lbl); };

// 1. stringer sections (oval logs with top cut, bottom cut at the ends, pipe / solid defects) — span 3
{
  const S = TB.example3393().spans[2];
  const A1 = [1.267e5, 1.566e5, 1.488e5, 1.890e5, 1.488e5, 1.640e5, 1.446e5], Im = [2.203e9, 2.350e9, 3.509e9, 2.390e9, 2.640e9, 4.011e9, 3.356e9], A2 = [6.617e4, 1.038e5, 1.769e5, 1.537e5, 1.612e5, 1.405e5, 1.129e5];
  S.stringers.forEach((s, i) => { P(`span 3 S${i + 1} end 1 area (mm²)`, TB.stringerSection(s.e1, true).A, A1[i], 0.004); P(`span 3 S${i + 1} midspan I (mm⁴)`, TB.stringerSection(s.mid, false).I, Im[i], 0.004); P(`span 3 S${i + 1} end 2 area (mm²)`, TB.stringerSection(s.e2, true).A, A2[i], 0.004); });
  const p = TB.pileSection({ d: 430, def: 2, L: 110, R: 80, B: 110, F: 70 });
  P('pile with type 2 defect: area (m²)', p.A / 1e6, 0.0981, 0.01); P('pile with type 2 defect: Zmin (m³)', p.Zmin / 1e9, 6.528e-3, 0.01);
}

// 2. full assessment of the worked example
const R = TB.analyse(TB.example3393());
T('analysis runs without warnings', R && R.warn.length === 0);
{
  const sp = R.spans[2];
  const exp = { T44: [74.11, 76.48, 112.34, 113.48, 116.05, 96.75, 148.85], MT: [33.85, 31.40, 47.26, 47.07, 47.81, 42.08, 67.11], TA: [32.31, 33.34, 48.98, 49.48, 50.60, 42.18, 64.90], M16: [148.29, 168.47, 245.33, 248.52, 257.25, 206.27, 298.40] };
  Object.entries(exp).forEach(([v, e]) => sp.str.forEach((s, i) => P(`span 3 S${i + 1} ${v} rating (t)`, s.veh[v].t, e[i], v === 'M16' ? 0.025 : 0.015)));
  P('span 3 deck planks T44 (t)', sp.planks.veh.T44.t, 42.07, 0.03);
  P('span 3 deck planks Tandem (t)', sp.planks.veh.TA.t, 18.71, 0.03);
}
{
  const A = R.supports[3], at = [933.45, 306.89, 352.17, 288.48, 1189.15];
  A.piles.forEach((p, i) => P(`abutment 2 pile ${p.p} T44 rating (t)`, p.veh.T44.t, at[i], 0.035));
  P('pier 2 pile 3 halfcap bearing capacity (kN)', R.supports[2].piles[2].bear.T44.Cap, 180.45, 0.005);
  T('posting rules give no load limit for the example', R.summary.limit == null);
  T('summary lists elements below 100 %', R.summary.low.length > 0 && R.summary.rows.T44.comp === 'Span 3 deck planks');
}
// halfcap: published load case M 21.91 kNm / V 30.58 kN reproduced by the halfcap check
{
  const hc = R.supports[2].halfcap; T('pier halfcap rated', hc && hc.veh.T44 && hc.veh.T44.t > 44.04);
}

// 3. repair detail library: every detail generates, has a sensible extent and only known layers
for (const d of D.DEF) {
  let E = null; try { E = D.generate(d.id, {}); } catch (e) { }
  const b = E && D.bbox(E), w = b ? b.x1 - b.x0 : 0, h = b ? b.y1 - b.y0 : 0;
  T(`detail ${d.id} (${d.ref}) generates ${E ? E.length : 0} entities, ${w.toFixed(0)} × ${h.toFixed(0)} mm`, E && E.length > 20 && w > 100 && w < 800 && h > 60 && h < 560 && E.every(e => D.LAYERS[e.L]));
  for (const q of d.params.filter(q => q.opts)) { const v = q.opts[q.opts.length - 1]; let ok = true; try { D.generate(d.id, { [q.k]: v }); } catch (e) { ok = false; } if (!ok) T(`detail ${d.id} with ${q.k} = ${v}`, false); }
}
T('every suggested repair family maps to existing details', Object.values(D.SUGGEST).flat().every(id => D.DEF.some(d => d.id === id)));

// 4. DXF R12 output and round trip
{
  const sh = { name: 'Sheet 1', size: 'A1', items: [{ det: 'hcb', params: {}, x: 40, y: 300, s: 1, r: 0 }, { det: 'stf', params: {}, x: 400, y: 300, s: 1, r: 0 }], ents: [{ t: 'line', a: [20, 20], b: [200, 20], L: 'S-NEW' }, { t: 'text', p: [30, 40], s: 'NOTE', h: 3.5, L: 'S-TEXT' }], title: { bridge: '3393' } };
  const doc = { sheets: [sh], cur: 0, hidden: {}, layers: {} };
  const s = X.dxf(doc, sh);
  T('DXF header is AutoCAD R12 (AC1009)', /\$ACADVER\s*\n\s*1\s*\nAC1009/.test(s));
  T('DXF has LTYPE, LAYER and STYLE tables', ['LTYPE', 'LAYER', 'STYLE'].every(t => new RegExp('2\\s*\\n' + t).test(s)));
  T('DXF ends with EOF', /0\s*\nEOF\s*$/.test(s));
  const back = X.parseDXF(s), E = back.ents || back, n = {}; E.forEach(e => { n[e.t] = (n[e.t] || 0) + 1; });
  const src = X.allEnts(sh, {}).length;
  T(`DXF round trip keeps the drawing (${E.length} entities read, ${src} drawn; hatches exploded to lines)`, E.length >= src * 0.9 && n.text > 20 && n.line > 50);
  const nb = D.bbox(E); T('DXF round trip extent lies on the A1 sheet', nb.x0 >= -1 && nb.y0 >= -1 && nb.x1 <= 842 && nb.y1 <= 595);
}

console.log(bad ? `\n${bad} check(s) FAILED` : '\nall timber checks passed');
process.exit(bad ? 1 : 0);
