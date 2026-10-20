// Column clamp calculation (workbook 07_T5_Column_Clamp_Rev35 converted by tools/xlsheet/extract.py):
// every formula of both sheets is recalculated by xlcalc.js and compared with
//   1. the values Excel saved in the workbook (original inputs), and
//   2. LibreOffice's recalculation with 17 inputs changed (grade, loads, bar count and size, plate counts, weld types …).
// Run: node tests/colclamp.test.js
const fs = require('fs'), path = require('path'), zlib = require('zlib');
globalThis.window = globalThis; require(path.join(__dirname, '..', 'xlcalc.js'));
const X = globalThis.XLCALC, model = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'colclamp.json'), 'utf8'));
const gz = f => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures', f))).toString('utf8'));
let bad = 0;
function check(label, B, E) {
  let n = 0, miss = 0; const ex = [];
  for (const sh in E) for (const a in E[sh]) {
    if (a === 'D6' && sh === 'Column Clamp') continue; // TODAY()
    n++; const v = B.get(sh, a), e = E[sh][a]; let ok;
    if (e == null) ok = v == null || v === '' || v === 0 || X.isErr(v);
    else if (typeof e === 'number') ok = typeof v === 'number' && Math.abs(v - e) <= 1e-9 * Math.max(1, Math.abs(e));
    else if (typeof e === 'boolean') ok = v === e;
    else if (/^#/.test(e)) ok = X.isErr(v) && v.e === e;
    else ok = String(X.isErr(v) ? v.e : v) === e;
    if (!ok) { miss++; if (ex.length < 10) ex.push(`  ${sh}!${a}: ${JSON.stringify(X.isErr(v) ? v.e : v)} vs ${JSON.stringify(e)}`); }
  }
  if (miss) bad++;
  console.log(miss ? 'BAD' : 'OK ', label.padEnd(64), `${n - miss}/${n} formulas match`); if (ex.length) console.log(ex.join('\n'));
}
const B1 = new X.Book(model); check('original inputs vs Excel cached values', B1, gz('colclamp_expect.json.gz'));
const alt = gz('colclamp_alt.json.gz'), B2 = new X.Book(model); Object.entries(alt.inputs).forEach(([k, v]) => B2.set('Column Clamp', k, v));
check('17 inputs changed vs LibreOffice recalculation', B2, alt.expect);
// input cells and drop-down lists
const sh = model.sheets[0]; const T = (l, ok) => { if (!ok) bad++; console.log(ok ? 'OK ' : 'BAD', l); };
T('116 input cells (yellow) found', sh.inputs.length === 116);
T('drop-down lists for steel grade, bars, welds', ['F58', 'F125', 'F527'].every(a => Object.keys(sh.val).some(k => k.split(' ').includes(a))));
// number formats
T('formats: 0.0 / #,##0 / 0.000E+00 / -0.0', X.fmtNum(156.25, '0.0') === '156.3' && X.fmtNum(4417.86, '#,##0') === '4,418' && X.fmtNum(0.000123456, '0.000E+00') === '1.235E-04' && X.fmtNum(-0.04, '0.0') === '-0.0');
console.log(bad ? bad + ' check(s) FAILED' : 'all column clamp checks passed'); process.exit(bad ? 1 : 0);
