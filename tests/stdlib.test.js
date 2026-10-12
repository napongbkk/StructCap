// Standard-drawing library (tdx/): index and sheet files are consistent, every entity is well-formed,
// every character used in the text has a glyph in the CAD lettering. Run: node tests/stdlib.test.js
const fs = require('fs'), path = require('path');
const TF = require('../tfont.js');
const dir = path.join(__dirname, '..', 'tdx');
let bad = 0; const fail = (...a) => { bad++; if (bad < 40) console.log('FAIL', ...a); };
const idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const num = v => typeof v === 'number' && Number.isFinite(v), pt = p => Array.isArray(p) && p.length === 2 && num(p[0]) && num(p[1]);
const glyphs = new Set(); let nd = 0, ne = 0;
const LAYERS = /^(L18|L25|L35|L50|L70|L10|T18|T25|T35|T50|T70)$/;
for (const s of idx) {
  if (!s.sheet || !s.f || !s.th || !Array.isArray(s.d) || !s.d.length) fail('index entry', s.sheet);
  if (!fs.existsSync(path.join(dir, 'th', s.th))) fail('missing thumbnail', s.th);
  const L = JSON.parse(fs.readFileSync(path.join(dir, s.f), 'utf8'));
  if (L.details.length !== s.d.length) fail('detail count', s.sheet);
  L.details.forEach((d, i) => {
    nd++;
    if (d.name !== s.d[i].n) fail('name', s.sheet, i);
    if (!(d.w > 1 && d.h > 1 && d.w < 1300 && d.h < 900)) fail('size', s.sheet, d.name, d.w, d.h);
    for (const e of d.ents) {
      ne++;
      if (!LAYERS.test(e.L || '')) fail('layer', s.sheet, e.L);
      if (e.t === 'line') { if (!pt(e.a) || !pt(e.b)) fail('line', s.sheet); }
      else if (e.t === 'circle') { if (!pt(e.c) || !(e.r > 0)) fail('circle', s.sheet); }
      else if (e.t === 'arc') { if (!pt(e.c) || !(e.r > 0) || !num(e.a0) || !num(e.a1)) fail('arc', s.sheet); }
      else if (e.t === 'solid') { if (!Array.isArray(e.p) || e.p.length < 3 || !e.p.every(pt)) fail('solid', s.sheet); }
      else if (e.t === 'text') { if (!pt(e.p) || !(e.h > 0) || typeof e.s !== 'string' || !(e.wf > 0) || !(e.sw > 0)) fail('text', s.sheet, e.s); for (const c of e.s) glyphs.add(c); }
      else fail('type', s.sheet, e.t);
      // every entity inside the detail's box (origin at its bottom-left)
      const P = e.t === 'line' ? [e.a, e.b] : e.t === 'solid' ? e.p : e.c ? [e.c] : [e.p];
      if (P.some(q => q[0] < -0.01 || q[1] < -0.01 || q[0] > d.w + 0.15 || q[1] > d.h + 0.15)) fail('outside detail box', s.sheet, d.name, e.t);
    }
  });
}
// glyph coverage: a missing glyph draws as an X
const probe = TF.path('X', 10);
const missing = [...glyphs].filter(c => c !== ' ' && TF.path(c, 10) === probe && c !== 'X');
if (missing.length) fail('characters without a glyph:', missing.join(' '));
console.log(idx.length, 'sheets,', nd, 'details,', ne, 'entities');
console.log(bad ? bad + ' failed' : 'all standard library checks passed');
process.exit(bad ? 1 : 0);
