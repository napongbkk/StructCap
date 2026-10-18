// Warehouse BOQ: quantities checked by hand for the default 30 x 60 m building, pricing and summary arithmetic.
// Run: node tests/boq.test.js
const path = require('path'); globalThis.window = globalThis; require(path.join(__dirname, '..', 'boq.js'));
const Q = globalThis.BOQ; let bad = 0;
const P = (lbl, got, exp, tol = 0.002) => { const ok = Math.abs(got - exp) <= tol * Math.max(1, Math.abs(exp)); if (!ok) bad++; console.log(ok ? 'OK ' : 'BAD', lbl.padEnd(58), (+got).toFixed(3), 'expected', (+exp).toFixed(3)); };
const T = (lbl, ok) => { if (!ok) bad++; console.log(ok ? 'OK ' : 'BAD', lbl); };
const B = Q.defaults(), R = Q.compute(B, 'th'), g = R.geo;
const find = (cat, re) => R.items.filter(x => x.cat === cat && re.test(x.desc));
const q = (cat, re, key) => find(cat, re).filter(x => !key || x.key === key).reduce((s, x) => s + x.qty, 0);
// geometry: 30 m span, 10°, 60 m long, 6 m bays -> 11 frames
P('frames', g.nf, 11); P('rafter length per side (m)', g.rafter, 15 / Math.cos(10 * Math.PI / 180)); P('ridge rise (m)', g.rise, 15 * Math.tan(10 * Math.PI / 180));
T('gable posts at 6, 12, 18, 24 m', JSON.stringify(g.gx.map(x => Math.round(x))) === '[6,12,18,24]');
P('columns: 22 main + 8 gable', R.nCol, 30);
// footings: 22 x 1.5x1.5x0.5 + 8 x 1.0x1.0x0.4
P('footing concrete (m³)', q('fnd', /ฐานราก/, 'conc'), 22 * 1.125 + 8 * 0.4);
P('piles (m)', q('fnd', /^เสาเข็ม/, 'pile'), (22 * 4 + 8 * 2) * 12);
P('excavation (m³)', q('fnd', /^ขุดดิน/), 22 * 2.1 * 2.1 * 1.5 + 8 * 1.6 * 1.6 * 1.5);
const hp = 1.5 - 0.5 - 0.05 - 0.05 + 0.15, hpg = 1.5 - 0.4 - 0.1 + 0.15;
P('pedestal concrete (m³)', q('fnd', /ตอม่อ/, 'conc'), 22 * 0.16 * hp + 8 * 0.16 * hpg);
P('anchor bolts', q('fnd', /Anchor/), 120);
// tie beams around 180 m perimeter, 0.2 x 0.4
P('tie beam concrete (m³)', q('tie', /คอนกรีต/), 0.08 * 180);
// slab 1,800 m² x 0.15
P('slab concrete (m³)', q('slab', /คอนกรีตพื้น/), 270); P('wire mesh (m²)', q('slab', /ตะแกรง/), 1980);
P('saw-cut joints (m)', q('slab', /ตัดรอยต่อ/), 4 * 60 + 9 * 30);
// steel: columns 11 x 2 x 8 m x 49.6; rafters 11 x 2 x rafter x 49.6
P('columns (kg)', find('steel', /^เสาเหล็ก/)[0].qty, 11 * 16 * 49.6);
P('rafters (kg)', find('steel', /Rafter/)[0].qty, 11 * 2 * g.rafter * 49.6, 0.001);
const hAt = x => 8 + g.rise * (1 - Math.abs(x - 15) / 15), gl = 2 * [6, 12, 18, 24].reduce((s, x) => s + hAt(x), 0);
P('gable posts (kg)', find('steel', /เสากันลม/)[0].qty, gl * 21.3, 0.001);
const cp = Q.cInfo('C150x50x20x2.3'); T('C150x50x20x2.3 about 5 kg/m', cp.w > 4.9 && cp.w < 5.2);
const nPl = Math.ceil(g.rafter / 1.0) + 1; P('purlins (kg)', find('steel', /^แป/)[0].qty, 2 * nPl * 60.6 * 1.05 * cp.w, 0.001);
// roof sheet: 2 x (rafter + 0.3/cos) x 60.6 x 95 %
const slope = g.rafter + 0.3 / Math.cos(10 * Math.PI / 180);
P('roof sheet (m²)', q('roof', /เมทัลชีท/), 2 * slope * 60.6 * 0.95, 0.001); P('translucent (m²)', q('roof', /โปร่งแสง/), 2 * slope * 60.6 * 0.05, 0.001);
// block wall 2.0 m high less shutters (2 x 5 x 2.0) and doors (2 x 1.0 x 2.0)
P('block wall (m²)', q('wall', /บล็อก/), 180 * 2 - 20 - 4);
P('wall sheet (m²)', q('wall', /ผนังเมทัลชีท/), 2 * 60 * 6 + 2 * (30 * 6 + 30 * g.rise / 2) - 2 * 5 * 3 - 2 * 0.1, 0.001);
P('roller shutters (m²)', q('open', /ประตูม้วน/), 50);
// pricing arithmetic
T('every line total = qty × (material + labour)', R.items.every(x => Math.abs(x.tot - (x.qty * x.mat + x.qty * x.lab)) < 0.02));
P('direct cost = sum of categories', R.direct, R.cats.reduce((s, c) => s + c.tot, 0));
P('grand total with 8 % + 7 % + VAT 7 %', R.grand, (R.direct * 1.15) * 1.07, 0.0005);
B.oh = { mode: 'F', F: 1.2345 }; const R2 = Q.compute(B, 'th'); P('Factor F mode', R2.grand, R2.direct * 1.2345, 0.0001);
B.price = { conc: { mat: 3000, lab: 500 } }; const R3 = Q.compute(B, 'th'); T('price override applies', R3.items.filter(x => x.key === 'conc').every(x => x.mat === 3000 && x.lab === 500));
B.extra = [{ desc: 'ระบบไฟฟ้า', qty: 1, unit: 'เหมา', mat: 250000, lab: 80000 }]; const R4 = Q.compute(B, 'th'); T('extra item priced', R4.items.some(x => x.cat === 'extra' && x.tot === 330000));
T('baht text', Q.bahtText(1234567.5) === 'หนึ่งล้านสองแสนสามหมื่นสี่พันห้าร้อยหกสิบเจ็ดบาทห้าสิบสตางค์' && Q.bahtText(21) === 'ยี่สิบเอ็ดบาทถ้วน' && Q.bahtText(11000000) === 'สิบเอ็ดล้านบาทถ้วน');
// robustness: two spans, PU roof, no block wall, silly inputs
const B2 = Q.defaults(); Object.assign(B2.geo, { W: 48, spans: 2, pitch: 6 }); B2.roof.ins = 'pu'; B2.wall.hb = 0; B2.geo.s = 'x';
const R5 = Q.compute(B2, 'en'); T('two-span building computes, inner columns on line', R5.geo.inner.length === 1 && R5.nColMain === R5.geo.nf * 3);
T('no NaN anywhere', R5.items.every(x => isFinite(x.qty) && isFinite(x.tot)) && isFinite(R5.grand));
T('PU roof sheet used', R5.items.some(x => x.key === 'roofpu'));
console.log('items', R.items.length, 'direct', R.direct.toFixed(0), 'grand', R.grand.toFixed(0), 'THB/m²', R.perM2.toFixed(0), 'steel kg/m²', ((R.steel.main + R.steel.plates + R.steel.purl + R.steel.girt) / R.area).toFixed(1));
console.log(bad ? bad + ' check(s) FAILED' : 'all BOQ checks passed'); process.exit(bad ? 1 : 0);
