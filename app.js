/* StructCap — application shell, auth, admin (test store), design pages
   UI language: English by default, toggle to Thai (all pages, reports included). */
(function () {
  'use strict';
  const RC = window.RC, f = RC.f;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (d, n) => { const t = new Date((d || today()) + 'T00:00:00'); t.setDate(t.getDate() + n); return t.toISOString().slice(0, 10); };
  const ss = { get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }, del(k) { try { sessionStorage.removeItem(k); } catch (e) { } } };
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } } };

  // ------------------------------------------------------------------ language
  const S = {
    codeSel: null,
    ui: ls.get('sigmarc.lang') === 'th' ? 'th' : 'en',
    view: 'landing', role: 'guest', user: null, code: 'EC2', elem: 'beam', inputs: {}, res: null, reportOpen: false,
    meta: { project: 'Sample project', job: 'J-001', ref: 'B1', by: '', checked: '' }
  };
  const T = (en, th) => (S.ui === 'th' ? th : en);
  const lang = () => S.ui;
  function setLang(l) { S.ui = l; ls.set('sigmarc.lang', l); render(); }

  // ------------------------------------------------------------------ constants
  const ADMIN = { user: 'NapongBKK', salt: '42291376d78531243c221a49fc292654', hash: '50fe235505d5b364014ed3586017ecf2b44c84a8998af37bc64c8c44f4a77ffb', iter: 210000 };
  const USER_ITER = 120000;
  const CODES = {
    EC2: { name: ['Eurocode 2', 'Eurocode 2'], std: 'EN 1992-1-1:2023', sub: ['Second-generation Eurocode · design of concrete structures', 'Eurocode รุ่นที่ 2 · การออกแบบโครงสร้างคอนกรีต'], tone: 'blue', tag: 'EU' },
    AS: { name: ['Australian Standards', 'มาตรฐานออสเตรเลีย'], std: 'AS 3600:2018 · AS 4100:2020', sub: ['Concrete and steel structures', 'โครงสร้างคอนกรีตและเหล็ก'], tone: 'teal', tag: 'AU' },
    TH: { name: ['Thai Standard', 'มาตรฐานไทย'], std: 'EIT strength design · ACI 318-19', stdTh: 'วสท. วิธีกำลัง · ACI 318-19', sub: ['Strength design in Thai practice units: t · cm · ksc', 'ออกแบบโดยวิธีกำลัง หน่วย ตัน · ซม. · กก./ซม.²'], tone: 'orange', tag: 'TH' }
  };
  const cName = k => T(CODES[k].name[0], CODES[k].name[1]);
  const cStd = k => (S.ui === 'th' && CODES[k].stdTh) || CODES[k].std;
  const cSub = k => T(CODES[k].sub[0], CODES[k].sub[1]);
  const stdFor = () => S.elem === 'sbarrier' ? 'Austroads AP-G108-25 §5.4 · AASHTO LRFD A13.3.2 · ' + (S.code === 'AS' ? 'AS 4100' : T('AISC 360 / EIT', 'AISC 360 / วสท.')) : S.elem === 'barrier' ? (S.code === 'AS' ? 'Austroads AP-G108-25 §5.3 · AS 5100.2 / AS 5100.5' : T('AASHTO LRFD Sec. 13 (DOH practice) · EIT / ACI 318-19', 'AASHTO LRFD หมวด 13 (แนวทางกรมทางหลวง) · วสท. / ACI 318-19')) : S.elem === 'gantry' ? 'AS 4100:2020 · AS/NZS 1170.2 · AS/NZS 1163' : S.elem === 'stm3d' ? 'AS 3600:2018 Section 7 · Strut-and-tie' : S.elem === 'lwall' ? 'AS 4678:2002 · AS/NZS 1170.1 · AS 1170.4' : S.code === 'AS' ? 'AS 3600:2018' : cStd(S.code);
  const ELEMS = {
    beam: { en: 'RC Beam', th: 'คาน คสล.', den: 'Bending about both axes, shear, torsion, crack width and service stresses.', dth: 'ดัดสองแกน แรงเฉือน แรงบิด ความกว้างรอยร้าว และหน่วยแรงใช้งาน', free: true },
    column: { en: 'RC Column', th: 'เสา คสล.', den: 'N–M interaction for both axes plus the full biaxial N–Mx–My contour.', dth: 'แผนภาพปฏิสัมพันธ์ N–M ทั้งสองแกน และ N–Mx–My สองแกน', free: false },
    pilecap: { en: 'RC Pile Cap', th: 'ฐานรากบนเสาเข็ม', den: 'Beam method or strut-and-tie, punching at column and piles, one-way shear.', dth: 'วิธีคานหรือแบบจำลองโครงถัก (STM) เฉือนทะลุที่เสาและเข็ม เฉือนแบบคาน', free: false },
    stm3d: { en: 'Pile Cap 3D STM', th: 'ฐานรากเข็ม STM 3 มิติ', den: 'Space strut-and-tie model of the pile cap: struts, ties, nodes and tie anchorage, with a 3D view of the member forces.', dth: 'แบบจำลองโครงถักค้ำ-ยึดสามมิติของฐานรากเข็ม: ค้ำ ตัวยึด จุดต่อ และการยึดรั้ง พร้อมภาพ 3 มิติของแรงในชิ้นส่วน', free: false, codes: ['AS'] },
    lwall: { en: 'Limestone Block Wall', th: 'กำแพงกันดินก้อนหินปูน', den: 'Gravity wall of stacked limestone blocks: overturning, sliding and shear between blocks at every course, bearing; handrail, surcharge, back slope and earthquake.', dth: 'กำแพงกันดินแบบน้ำหนักจากก้อนหินปูนวางซ้อน: การพลิกคว่ำ การเลื่อนไถล และแรงเฉือนระหว่างก้อนทุกชั้น แรงแบกทาน พร้อมแรงราวกันตก น้ำหนักแผ่ ลาดด้านหลัง และแผ่นดินไหว', free: false, codes: ['AS'] },
    barrier: { en: 'Bridge Barrier', th: 'ราวกันตกสะพาน คสล.', den: 'Concrete traffic barrier to Department of Highways practice: AASHTO crash test levels, yield-line resistance, deck interface shear, deck overhang and bar anchorage.', dth: 'ราวกันตกคอนกรีตตามแนวทางกรมทางหลวง: ระดับการทดสอบการชนตาม AASHTO กำลังตามทฤษฎีเส้นคราก แรงเฉือนที่รอยต่อกับพื้น พื้นยื่น และการฝังยึดเหล็ก', free: false, codes: ['TH', 'AS'] },
    sbarrier: { en: 'Steel Post-and-Rail Barrier', th: 'ราวกันตกเหล็ก (เสาและราว)', den: 'Steel bridge railing by the plastic-mechanism method (Austroads AP-G108-25 §5.4, AASHTO A13.3.2): rail and post capacities, 1–N span failure modes, effective height, geometry, post base and deck actions.', dth: 'ราวกันตกเหล็กบนสะพานด้วยวิธีกลไกพลาสติก (Austroads AP-G108-25 §5.4, AASHTO A13.3.2): กำลังราวและเสา รูปแบบการวิบัติ 1–N ช่วง ความสูงประสิทธิผล รูปทรง ฐานเสา และแรงบนพื้นยื่น', free: false, codes: ['TH', 'AS'] },
    gantry: { en: 'Sign Gantry', th: 'โครงป้ายจราจรยื่น', den: 'Steel cantilever sign structure: CHS / SHS / RHS members, welded or bolted arm, base plate, fatigue.', dth: 'โครงเหล็กป้ายจราจรแบบคานยื่น: หน้าตัด CHS / SHS / RHS รอยต่อเชื่อมหรือสลัก แผ่นฐาน และความล้า', free: false, codes: ['AS'], steel: true }
  };
  const UNITS = {
    len: { si: ['mm', 'mm', 1], th: ['cm', 'ซม.', 10] }, spc: { si: ['mm', 'mm', 1], th: ['cm', 'ซม.', 10] }, dia: { si: ['mm', 'mm', 1], th: ['mm', 'มม.', 1] },
    stress: { si: ['MPa', 'MPa', 1], th: ['ksc', 'ksc', RC.KSC] }, force: { si: ['kN', 'kN', 1], th: ['t', 'ตัน', RC.TF] }, moment: { si: ['kNm', 'kNm', 1], th: ['t·m', 'ตัน·ม.', RC.TF] },
    density: { si: ['kN/m³', 'kN/m³', 1], th: ['t/m³', 'ตัน/ม.³', RC.TF] }, none: { si: ['', '', 1], th: ['', '', 1] },
    deg: { si: ['°', '°', 1], th: ['°', '°', 1] }, kNm1: { si: ['kN/m', 'kN/m', 1], th: ['kN/m', 'kN/m', 1] },
    lenm: { si: ['m', 'ม.', 1000], th: ['m', 'ม.', 1000] }, mm: { si: ['mm', 'มม.', 1], th: ['mm', 'มม.', 1] }, mm3: { si: ['×10³ mm³', '×10³ มม.³', 1000], th: ['×10³ mm³', '×10³ มม.³', 1000] }, kpa: { si: ['kPa', 'kPa', 1], th: ['kPa', 'kPa', 1] }, mm2: { si: ['mm²', 'มม.²', 1], th: ['mm²', 'มม.²', 1] }, mm2m: { si: ['mm²/m', 'มม.²/ม.', 1], th: ['mm²/m', 'มม.²/ม.', 1] }, ms: { si: ['m/s', 'ม./วินาที', 1], th: ['m/s', 'ม./วินาที', 1] }, pa: { si: ['Pa', 'Pa', 1], th: ['Pa', 'Pa', 1] }
  };
  const OUT_TH = { kN: [['t', 'ตัน'], 1 / RC.TF], kNm: [['t·m', 'ตัน·ม.'], 1 / RC.TF], mm: [['cm', 'ซม.'], 0.1], MPa: [['ksc', 'ksc'], 1 / RC.KSC], 'mm²': [['cm²', 'ซม.²'], 0.01], 'mm²/m': [['cm²/m', 'ซม.²/ม.'], 0.01], 'kN/m': [['t/m', 'ตัน/ม.'], 1 / RC.TF], 'kN·m/m': [['t·m/m', 'ตัน·ม./ม.'], 1 / RC.TF], 'kN·m': [['t·m', 'ตัน·ม.'], 1 / RC.TF] };
  const DIAS = { EC2: [8, 10, 12, 16, 20, 25, 32, 40], AS: [10, 12, 16, 20, 24, 28, 32, 36, 40], TH: [6, 9, 10, 12, 16, 20, 25, 28, 32] };

  // ------------------------------------------------------------------ input schemas
  const F = (k, g, en, th, u, extra) => Object.assign({ k, g, en, th, u, type: 'num' }, extra || {});
  const COEF_EC2 = [F('gC', 'coef', 'γ_C concrete', 'γ_C คอนกรีต', 'none'), F('gS', 'coef', 'γ_S steel', 'γ_S เหล็ก', 'none'), F('ktc', 'coef', 'k_tc (time / sustained load)', 'k_tc (อายุ / แรงค้าง)', 'none')].map(x => Object.assign(x, { codes: ['EC2'] }));
  const MAT = elemLinks => [
    F('fc', 'mat', 'f_ck concrete', 'f_ck คอนกรีต', 'stress', { alt: { AS: ['f\'c concrete', 'f\'c คอนกรีต'], TH: ['f\'c concrete', 'f\'c คอนกรีต'] } }),
    F('fy', 'mat', 'f_yk main bars', 'f_yk เหล็กยืน', 'stress', { alt: { AS: ['f_sy main bars', 'f_sy เหล็กยืน'], TH: ['f_y main bars', 'f_y เหล็กยืน'] } }),
    ...(elemLinks ? [F('fyt', 'mat', 'f_ywk links', 'f_ywk เหล็กปลอก', 'stress', { alt: { AS: ['f_sy.f fitments', 'f_sy.f เหล็กปลอก'], TH: ['f_yt links', 'f_yt เหล็กปลอก'] } })] : []),
    F('dg', 'mat', 'Max. aggregate size', 'ขนาดหินใหญ่สุด', 'dia')
  ];
  const SCHEMA = {
    beam: [
      F('b', 'geo', 'Width b', 'ความกว้าง b', 'len'), F('h', 'geo', 'Depth h', 'ความลึก h', 'len'), F('cover', 'geo', 'Cover to link', 'ระยะหุ้มถึงเหล็กปลอก', 'len'),
      ...MAT(true), ...COEF_EC2,
      F('creep', 'coef', 'Creep coefficient φ(∞)', 'สัมประสิทธิ์การคืบ φ(∞)', 'none', { codes: ['EC2'] }), F('kt', 'coef', 'k_t (0.4 long term)', 'k_t (0.4 ระยะยาว)', 'none', { codes: ['EC2'] }),
      F('wlim', 'coef', 'Crack width limit w_max', 'ความกว้างรอยร้าวยอมให้ w_max', 'dia', { codes: ['EC2'] }),
      F('linkD', 'link', 'Outer link Ø', 'เหล็กปลอกนอก Ø', 'dia', { type: 'dia' }), F('s', 'link', 'Link spacing', 'ระยะเรียงปลอก', 'spc'),
      F('innerN', 'link', 'Single-leg links (number)', 'ปลอกขาเดี่ยว (จำนวน)', 'none', { type: 'int' }), F('innerD', 'link', 'Single-leg link Ø', 'ปลอกขาเดี่ยว Ø', 'dia', { type: 'dia' }),
      F('Mx', 'uls', 'M_x major (+ sagging)', 'M_x แกนหลัก (+ บวก)', 'moment'), F('My', 'uls', 'M_y minor', 'M_y แกนรอง', 'moment'),
      F('Vy', 'uls', 'V_y major', 'V_y แกนหลัก', 'force'), F('Vx', 'uls', 'V_x minor', 'V_x แกนรอง', 'force'), F('T', 'uls', 'Torsion T', 'แรงบิด T', 'moment'),
      F('Ms', 'sls', 'Service M_x', 'โมเมนต์ใช้งาน M_x', 'moment', { alt: { EC2: ['Service M_x (quasi-permanent)', 'โมเมนต์ใช้งาน M_x (กึ่งถาวร)'] } })
    ],
    column: [
      F('b', 'geo', 'Width b (x-dir)', 'ความกว้าง b (แนว x)', 'len'), F('h', 'geo', 'Depth h (y-dir)', 'ความลึก h (แนว y)', 'len'), F('cover', 'geo', 'Cover to link', 'ระยะหุ้มถึงเหล็กปลอก', 'len'),
      ...MAT(true), ...COEF_EC2,
      F('dc', 'bars', 'Corner bar Ø', 'เหล็กมุม Ø', 'dia', { type: 'dia' }), F('dm', 'bars', 'Intermediate bar Ø', 'เหล็กกลาง Ø', 'dia', { type: 'dia' }),
      F('nb', 'bars', 'Bars along b face (incl. corners)', 'จำนวนเหล็กด้าน b (รวมมุม)', 'none', { type: 'int' }), F('nh', 'bars', 'Bars along h face (incl. corners)', 'จำนวนเหล็กด้าน h (รวมมุม)', 'none', { type: 'int' }),
      F('linkD', 'link', 'Tie Ø', 'เหล็กปลอก Ø', 'dia', { type: 'dia' }), F('s', 'link', 'Tie spacing', 'ระยะเรียงปลอก', 'spc'),
      F('innerN', 'link', 'Cross-ties, single leg (number)', 'เหล็กยึดขาเดี่ยว (จำนวน)', 'none', { type: 'int' }), F('innerD', 'link', 'Cross-tie Ø', 'เหล็กยึดขาเดี่ยว Ø', 'dia', { type: 'dia' }),
      F('N', 'uls', 'N (compression +)', 'N (แรงอัด +)', 'force'), F('Mx', 'uls', 'M_x major', 'M_x แกนหลัก', 'moment'), F('My', 'uls', 'M_y minor', 'M_y แกนรอง', 'moment'),
      F('Vy', 'uls', 'V_y', 'V_y', 'force'), F('Vx', 'uls', 'V_x', 'V_x', 'force')
    ],
    pilecap: [
      F('layout', 'piles', 'Pile group', 'รูปแบบกลุ่มเข็ม', 'none', { type: 'sel', opts: [['2', '2 piles', '2 ต้น'], ['3', '3 piles (triangle)', '3 ต้น (สามเหลี่ยม)'], ['4', '4 piles', '4 ต้น'], ['5', '5 piles', '5 ต้น'], ['6', '6 piles (3×2)', '6 ต้น (3×2)'], ['9', '9 piles (3×3)', '9 ต้น (3×3)'], ['grid', 'Custom grid', 'กำหนดเอง']] }),
      F('nx', 'piles', 'Grid: piles in x', 'จำนวนเข็มแนว x', 'none', { type: 'int', when: v => v.layout === 'grid' }), F('ny', 'piles', 'Grid: piles in y', 'จำนวนเข็มแนว y', 'none', { type: 'int', when: v => v.layout === 'grid' }),
      F('s', 'piles', 'Pile spacing (x)', 'ระยะห่างเข็ม (x)', 'len'), F('sy', 'piles', 'Pile spacing y (grid)', 'ระยะห่างเข็ม y', 'len', { when: v => v.layout === 'grid' }),
      F('Dp', 'piles', 'Pile diameter', 'ขนาดเข็ม', 'len'), F('edge', 'piles', 'Pile centre to cap edge', 'ศูนย์เข็มถึงขอบฐาน', 'len'), F('Pallow', 'piles', 'Pile working capacity', 'น้ำหนักบรรทุกปลอดภัยต่อต้น', 'force'),
      F('H', 'geo', 'Cap thickness H', 'ความหนาฐานราก H', 'len'), F('cb', 'geo', 'Bottom cover to bars', 'ระยะหุ้มล่าง', 'len'), F('cs', 'geo', 'Side cover', 'ระยะหุ้มข้าง', 'len'),
      F('cx', 'geo', 'Column c_x', 'ขนาดเสา c_x', 'len'), F('cy', 'geo', 'Column c_y', 'ขนาดเสา c_y', 'len'),
      ...MAT(false),
      F('bxd', 'bars', 'Bottom bars x Ø', 'เหล็กล่างแนว x Ø', 'dia', { type: 'dia' }), F('bxs', 'bars', 'Spacing of x bars', 'ระยะเหล็กแนว x', 'spc'),
      F('byd', 'bars', 'Bottom bars y Ø', 'เหล็กล่างแนว y Ø', 'dia', { type: 'dia' }), F('bys', 'bars', 'Spacing of y bars', 'ระยะเหล็กแนว y', 'spc'),
      F('tieN', 'bars', 'Perimeter tie bars per side (3-pile STM)', 'เหล็กยึดรอบรูปต่อด้าน (STM 3 ต้น)', 'none', { type: 'int', when: v => v.layout === '3' && v.method === 'stm' }), F('tieD', 'bars', 'Perimeter tie Ø', 'เหล็กยึดรอบรูป Ø', 'dia', { type: 'dia', when: v => v.layout === '3' && v.method === 'stm' }),
      F('method', 'coef', 'Design method', 'วิธีออกแบบ', 'none', { type: 'sel', opts: [['stm', 'Strut-and-tie (STM)', 'โครงถักค้ำ-ยึด (STM)'], ['beam', 'Flexural beam method', 'วิธีคานรับแรงดัด']] }),
      ...COEF_EC2,
      F('gG', 'coef', 'Load factor on cap weight', 'ตัวคูณน้ำหนักฐานราก', 'none'), F('gc', 'coef', 'Concrete unit weight', 'หน่วยน้ำหนักคอนกรีต', 'density'),
      F('zd', 'coef', 'STM lever arm z/d', 'แขนโมเมนต์ z/d', 'none'), F('betaS', 'coef', 'Strut β_s (ACI 23.4.3)', 'β_s ค้ำ (ACI 23.4.3)', 'none', { codes: ['TH'] }),
      F('N', 'uls', 'N_Ed from column', 'N_Ed จากเสา', 'force', { alt: { TH: ['P_u from column', 'P_u จากเสา'] } }), F('Mx', 'uls', 'M_x', 'M_x', 'moment'), F('My', 'uls', 'M_y', 'M_y', 'moment'),
      F('Ns', 'sls', 'N service', 'N ใช้งาน', 'force'), F('Mxs', 'sls', 'M_x service', 'M_x ใช้งาน', 'moment'), F('Mys', 'sls', 'M_y service', 'M_y ใช้งาน', 'moment')
    ]
  };
  {
    const pick = ['layout', 'nx', 'ny', 's', 'sy', 'Dp', 'edge', 'Pallow', 'H', 'cb', 'cs', 'cx', 'cy', 'fc', 'fy', 'dg'];
    SCHEMA.stm3d = SCHEMA.pilecap.filter(fd => pick.includes(fd.k)).map(fd => Object.assign({}, fd, fd.k === 'cs' ? { en: 'Side cover to tie bars', th: 'ระยะหุ้มข้างถึงเหล็กยึด' } : {})).concat([
      F('tN', 'bars', 'Tie band: bars per pile line', 'แถบเหล็กยึด: จำนวนเส้นต่อแนวเข็ม', 'none', { type: 'int' }), F('tD', 'bars', 'Tie bar Ø', 'เหล็กยึด Ø', 'dia', { type: 'dia' }),
      F('zd', 'coef', 'Lever arm z/d (top node level)', 'แขนโมเมนต์ z/d (ระดับจุดต่อบน)', 'none'), F('gG', 'coef', 'Load factor on cap weight', 'ตัวคูณน้ำหนักฐานราก', 'none'), F('gc', 'coef', 'Concrete unit weight', 'หน่วยน้ำหนักคอนกรีต', 'density'),
      F('N', 'uls', 'N* from column', 'N* จากเสา', 'force'), F('Mx', 'uls', 'M*_x', 'M*_x', 'moment'), F('My', 'uls', 'M*_y', 'M*_y', 'moment'),
      F('Ns', 'sls', 'N service', 'N ใช้งาน', 'force'), F('Mxs', 'sls', 'M_x service', 'M_x ใช้งาน', 'moment'), F('Mys', 'sls', 'M_y service', 'M_y ใช้งาน', 'moment')]);
  }
  SCHEMA.lwall = [
    F('bx', 'wall', 'Block width x (into the wall)', 'ความกว้างก้อน x (ตามความหนากำแพง)', 'len'), F('by', 'wall', 'Block height y', 'ความสูงก้อน y', 'len'),
    F('set', 'wall', 'Front setback per course', 'ระยะถอยด้านหน้าต่อชั้น', 'len'), F('e', 'wall', 'Embedment below front ground e', 'ความลึกฝังใต้ดินด้านหน้า e', 'len'),
    F('gb', 'wall', 'Block unit weight γ_b', 'หน่วยน้ำหนักหิน γ_b', 'density'),
    F('ds', 'top', 'Retained ground below top of stone d_s', 'ผิวดินถมต่ำกว่าหลังหิน d_s', 'len'),
    F('Lc', 'top', 'Level crest width (from wall front)', 'ความกว้างลานราบด้านบน (จากหน้ากำแพง)', 'len'), F('beta', 'top', 'Back slope β', 'มุมลาดด้านหลัง β', 'deg'),
    F('gs', 'soil', 'Retained soil unit weight γ', 'หน่วยน้ำหนักดินถม γ', 'density'), F('phi', 'soil', 'Retained soil friction angle φ\'', 'มุมเสียดทานดินถม φ\'', 'deg'),
    F('dv', 'soil', 'Wall friction on virtual back δ', 'แรงเสียดทานที่ระนาบสมมติ δ', 'none', { type: 'sel', opts: [['beta', 'δ = β (≤ φ*)', 'δ = β (≤ φ*)'], ['twothirds', 'δ = 2/3 φ*', 'δ = 2/3 φ*'], ['zero', 'δ = 0', 'δ = 0']] }),
    F('water', 'wat', 'Groundwater behind the wall', 'น้ำใต้ดินหลังกำแพง', 'none', { type: 'sel', opts: [['no', 'No (drained)', 'ไม่มี (ระบายน้ำ)'], ['yes', 'Yes', 'มี']], re: true }),
    F('hw', 'wat', 'Water level behind, above wall base h_w', 'ระดับน้ำด้านหลังเหนือฐาน h_w', 'len', { when: v => v.water === 'yes' }),
    F('hwf', 'wat', 'Water level in front, above wall base h_wf', 'ระดับน้ำด้านหน้าเหนือฐาน h_wf', 'len', { when: v => v.water === 'yes' }),
    F('gsat', 'wat', 'Saturated unit weight γ_sat', 'หน่วยน้ำหนักอิ่มตัว γ_sat', 'density', { when: v => v.water === 'yes' }),
    F('gW', 'wat', 'Load factor on water γ_W', 'ตัวคูณแรงดันน้ำ γ_W', 'none', { when: v => v.water === 'yes' }),
    F('phib', 'fnd', 'Foundation friction angle φ_b', 'มุมเสียดทานดินฐาน φ_b', 'deg'), F('cb', 'fnd', 'Foundation cohesion c_b', 'แรงยึดเหนี่ยวดินฐาน c_b', 'kpa'), F('qbear', 'fnd', 'Design bearing capacity φq_u', 'กำลังรับน้ำหนักออกแบบ φq_u', 'kpa'),
    F('mu', 'joint', 'Block-to-block friction coefficient μ', 'สัมประสิทธิ์แรงเสียดทานระหว่างก้อน μ', 'none'), F('cj', 'joint', 'Joint adhesion c_j (0 = dry-stacked)', 'แรงยึดเกาะรอยต่อ c_j (0 = วางแห้ง)', 'kpa'),
    F('q', 'lds', 'UDL surcharge q', 'น้ำหนักแผ่กระจาย q', 'kpa'), F('qext', 'lds', 'Surcharge applies on', 'ตำแหน่งน้ำหนักแผ่', 'none', { type: 'sel', opts: [['crest', 'Level crest only', 'เฉพาะลานราบด้านบน'], ['all', 'Crest and back slope', 'ลานราบและลาดด้านหลัง']] }),
    F('Hr', 'lds', 'Handrail horizontal line load H_r', 'แรงแนวนอนที่ราวกันตก H_r', 'kNm1'), F('hr', 'lds', 'Handrail height above wall top', 'ความสูงราวเหนือหลังกำแพง', 'len'),
    F('kh', 'lds', 'Earthquake coefficient k_h (0 = none)', 'สัมประสิทธิ์แผ่นดินไหว k_h (0 = ไม่คิด)', 'none'),
    F('Pphi', 'fac', 'Φ_uφ (friction)', 'Φ_uφ (แรงเสียดทาน)', 'none'), F('Pc', 'fac', 'Φ_uc (cohesion / adhesion)', 'Φ_uc (แรงยึดเหนี่ยว)', 'none'),
    F('gGd', 'fac', 'γ_G destabilising', 'γ_G ก่อให้เกิดการวิบัติ', 'none'), F('gGs', 'fac', 'γ_G stabilising', 'γ_G ต้านทาน', 'none'), F('gQ', 'fac', 'γ_Q live', 'γ_Q น้ำหนักจร', 'none'), F('psiE', 'fac', 'ψ_E live with earthquake', 'ψ_E น้ำหนักจรกับแผ่นดินไหว', 'none')
  ];
  const YN = [['yes', 'Yes', 'ใช่'], ['no', 'No', 'ไม่ใช่']];
  const TLS_AS = [['AS-low', 'Low (TL-2)', 'ต่ำ (TL-2)'], ['AS-regular', 'Regular (TL-4)', 'ปกติ (TL-4)'], ['AS-medium', 'Medium (TL-5)', 'ปานกลาง (TL-5)'], ['AS-tl6', 'Special (TL-6)', 'พิเศษ (TL-6)'], ['AS-special', 'Special (> TL-6)', 'พิเศษ (> TL-6)'], ['custom', 'User-defined forces', 'กำหนดแรงเอง']];
  const TLS_TH = [['TL-1', 'TL-1', 'TL-1'], ['TL-2', 'TL-2', 'TL-2'], ['TL-3', 'TL-3', 'TL-3'], ['TL-4', 'TL-4 (DOH standard barrier)', 'TL-4 (ราวมาตรฐานกรมทางหลวง)'], ['TL-5', 'TL-5 (high containment)', 'TL-5 (ป้องกันสูง)'], ['TL-6', 'TL-6', 'TL-6'], ['custom', 'User-defined forces', 'กำหนดแรงเอง']];
  const TLS = () => S.code === 'AS' ? TLS_AS : TLS_TH, isDirect = v => v.mode === 'direct', isBars = v => v.mode !== 'direct';
  const isCustom = v => v.tl === 'custom', isCustom2 = v => v.level === 'custom';
  SCHEMA.barrier = [
    F('tl', 'tl', 'Test level', 'ระดับการทดสอบ', 'none', { type: 'sel', opts: TLS, re: true, alt: { AS: ['Performance level (AS 5100.2)', 'ระดับสมรรถนะ (AS 5100.2)'] } }),
    F('Ft', 'tl', 'Transverse force F_t', 'แรงตามขวาง F_t', 'force', { when: isCustom }), F('Fl', 'tl', 'Longitudinal force F_L', 'แรงตามยาว F_L', 'force', { when: isCustom }), F('Fv', 'tl', 'Vertical force F_v', 'แรงแนวดิ่ง F_v', 'force', { when: isCustom }),
    F('Lt', 'tl', 'Distribution length L_t', 'ความยาวกระจายแรง L_t', 'lenm', { when: isCustom }), F('Lv', 'tl', 'Vertical load length L_v', 'ความยาวแรงดิ่ง L_v', 'lenm', { when: isCustom }),
    F('He', 'tl', 'Height of F_t above deck H_e', 'ความสูงแรง F_t เหนือพื้น H_e', 'len', { when: isCustom }), F('Hmin', 'tl', 'Minimum railing height H_min', 'ความสูงราวน้อยสุด H_min', 'len', { when: isCustom }),
    F('shape', 'geo', 'Wall shape', 'รูปทรงกำแพง', 'none', { type: 'sel', opts: [['tapered', 'Tapered (traffic face sloped)', 'เรียวขึ้น (หน้าจราจรลาด)'], ['vertical', 'Vertical wall (constant thickness)', 'กำแพงตั้งตรง (หนาเท่ากัน)']], re: true }),
    F('H', 'geo', 'Height above deck H', 'ความสูงเหนือพื้น H', 'len'), F('tt', 'geo', 'Thickness at top', 'ความหนาด้านบน', 'len'), F('tb', 'geo', 'Thickness at base', 'ความหนาที่ฐาน', 'len', { when: v => v.shape !== 'vertical' }),
    F('cover', 'geo', 'Cover to bar centre layer', 'ระยะหุ้มถึงเหล็ก', 'len'),
    F('fc', 'mat', 'f\'c concrete', 'f\'c คอนกรีต', 'stress'), F('fy', 'mat', 'f_y bars (SD40 / SD50)', 'f_y เหล็ก (SD40 / SD50)', 'stress', { alt: { AS: ['f_sy bars (D500N)', 'f_sy เหล็ก (D500N)'] } }),
    F('mode', 'comp', 'Wall resistance from', 'กำลังกำแพงคำนวณจาก', 'none', { type: 'sel', opts: [['bars', 'Wall reinforcement (bars and spacing)', 'เหล็กเสริมกำแพง (ขนาดและระยะเรียง)'], ['direct', 'Section components A_s, b, d (AP-G108-25 Fig. 5.5)', 'องค์ประกอบหน้าตัด A_s, b, d (AP-G108-25 รูป 5.5)']], re: true }),
    F('Asb', 'comp', 'Top beam A_s (0 = no beam)', 'A_s คานบน (0 = ไม่มี)', 'mm2', { when: isDirect }), F('bb', 'comp', 'Top beam b (vertical axis)', 'b คานบน (แกนดิ่ง)', 'mm', { when: isDirect }), F('db', 'comp', 'Top beam d', 'd คานบน', 'mm', { when: isDirect }),
    F('Asw', 'comp', 'Wall A_s, horizontal bars (one face)', 'A_s กำแพง เหล็กนอน (ด้านเดียว)', 'mm2', { when: isDirect }), F('bw', 'comp', 'Wall b (height of the bars)', 'b กำแพง (ความสูงช่วงเหล็ก)', 'mm', { when: isDirect }), F('dw', 'comp', 'Wall d (horizontal bars)', 'd กำแพง (เหล็กนอน)', 'mm', { when: isDirect }),
    F('Asc', 'comp', 'Cantilever A_s, vertical bars per metre', 'A_s กำแพงยื่น เหล็กยืนต่อเมตร', 'mm2m', { when: isDirect }), F('dc', 'comp', 'Cantilever d (vertical bars)', 'd กำแพงยื่น (เหล็กยืน)', 'mm', { when: isDirect }),
    F('vD', 'bars', 'Vertical bars, traffic face Ø', 'เหล็กยืนด้านจราจร Ø', 'dia', { type: 'dia' }), F('vS', 'bars', 'Spacing of traffic-face vertical bars', 'ระยะเรียงเหล็กยืนด้านจราจร', 'spc'),
    F('v2D', 'bars', 'Vertical bars, back face Ø', 'เหล็กยืนด้านหลัง Ø', 'dia', { type: 'dia' }), F('v2S', 'bars', 'Spacing of back-face vertical bars', 'ระยะเรียงเหล็กยืนด้านหลัง', 'spc'),
    F('hD', 'bars', 'Horizontal bars Ø (each face)', 'เหล็กนอน Ø (แต่ละด้าน)', 'dia', { type: 'dia' }), F('hS', 'bars', 'Spacing of horizontal bars', 'ระยะเรียงเหล็กนอน', 'spc'),
    F('Mb', 'bars', 'Top beam additional resistance M_b (0 = none)', 'กำลังเพิ่มของคานบน M_b (0 = ไม่มี)', 'moment', { when: isBars }),
    F('check', 'deck', 'Check the deck overhang', 'ตรวจสอบพื้นยื่น', 'none', { type: 'sel', opts: YN, re: true }),
    F('ts', 'deck', 'Deck thickness at the barrier t_s', 'ความหนาพื้นที่โคนราว t_s', 'len'),
    F('dTop', 'deck', 'Deck top bars Ø', 'เหล็กบนพื้น Ø', 'dia', { type: 'dia', when: v => v.check !== 'no' }), F('sTop', 'deck', 'Spacing of deck top bars', 'ระยะเรียงเหล็กบนพื้น', 'spc', { when: v => v.check !== 'no' }),
    F('cTop', 'deck', 'Top cover to bar centre', 'ระยะหุ้มบนถึงศูนย์เหล็ก', 'len', { when: v => v.check !== 'no' }), F('cBot', 'deck', 'Bottom cover (hook anchorage)', 'ระยะหุ้มล่าง (ระยะฝังขอ)', 'len'),
    F('iface', 'deck', 'Barrier–deck interface', 'รอยต่อราวกับพื้น', 'none', { type: 'sel', opts: [['rough', 'Roughened construction joint', 'รอยต่อก่อสร้างทำผิวขรุขระ'], ['smooth', 'Construction joint, not roughened', 'รอยต่อก่อสร้างไม่ทำผิวขรุขระ'], ['mono', 'Cast monolithically', 'หล่อเป็นเนื้อเดียว']] }),
    F('phi', 'coef', 'φ for Extreme Event II', 'φ สำหรับ Extreme Event II', 'none', { alt: { AS: ['φ for the barrier (AP-G108-25 example: 0.6)', 'φ สำหรับราว (ตัวอย่าง AP-G108-25: 0.6)'] } }), F('phid', 'coef', 'φ for the deck overhang (AS 5100.5 bending)', 'φ สำหรับพื้นยื่น (AS 5100.5 การดัด)', 'none', { codes: ['AS'] }), F('ends', 'coef', 'Check end segments (joints, barrier ends)', 'ตรวจช่วงปลาย (รอยต่อ ปลายราว)', 'none', { type: 'sel', opts: YN }),
    F('theta', 'coef', 'Spread angle θ (simplified base check)', 'มุมกระจาย θ (ตรวจฐานอย่างง่าย)', 'deg', { codes: ['TH'] }), F('gc', 'coef', 'Concrete unit weight', 'หน่วยน้ำหนักคอนกรีต', 'density')
  ];
  const LVL_OPTS = () => Object.entries(window.SBARRIER ? window.SBARRIER.LEVELS : {}).map(([k, o]) => [k, o.n[0], o.n[1]]).concat([['custom', 'User-defined forces', 'กำหนดแรงเอง']]);
  const SHP = [['RHS', 'RHS', 'RHS'], ['SHS', 'SHS', 'SHS'], ['CHS', 'CHS', 'CHS']];
  const railF = i => { const on = v => (+v.nr || 0) >= i; return [
    F('y' + i, 'rails', 'Rail ' + i + ': height above base plate y_' + i, 'ราว ' + i + ': ความสูงเหนือแผ่นฐาน y_' + i, 'len', { when: on }),
    F('sh' + i, 'rails', 'Rail ' + i + ': section', 'ราว ' + i + ': หน้าตัด', 'none', { type: 'sel', opts: SHP, re: true, when: on }),
    F('d' + i, 'rails', 'Rail ' + i + ': depth in the load direction', 'ราว ' + i + ': ความลึกตามแนวแรง', 'mm', { when: on }),
    F('b' + i, 'rails', 'Rail ' + i + ': vertical size', 'ราว ' + i + ': ขนาดแนวดิ่ง', 'mm', { when: v => on(v) && v['sh' + i] === 'RHS' }),
    F('t' + i, 'rails', 'Rail ' + i + ': wall thickness', 'ราว ' + i + ': ความหนา', 'mm', { when: on }),
    F('S' + i, 'rails', 'Rail ' + i + ': plastic modulus S (0 = from size)', 'ราว ' + i + ': โมดูลัสพลาสติก S (0 = คำนวณ)', 'mm3', { when: on }),
    F('u' + i, 'rails', 'Rail ' + i + ': resists the design load', 'ราว ' + i + ': คิดรับแรงออกแบบ', 'none', { type: 'sel', opts: YN, when: on })]; };
  SCHEMA.sbarrier = [
    F('level', 'plvl', 'Performance level', 'ระดับสมรรถนะ', 'none', { type: 'sel', opts: LVL_OPTS, re: true }),
    F('Ft', 'plvl', 'Transverse load F_t', 'แรงตามขวาง F_t', 'force', { when: isCustom2 }), F('Fl', 'plvl', 'Longitudinal load F_L', 'แรงตามยาว F_L', 'force', { when: isCustom2 }), F('Fv', 'plvl', 'Vertical load F_v', 'แรงดิ่ง F_v', 'force', { when: isCustom2 }),
    F('Lt', 'plvl', 'Contact length L_t', 'ความยาวสัมผัส L_t', 'lenm', { when: isCustom2 }), F('Lv', 'plvl', 'Vertical contact length L_v', 'ความยาวสัมผัสแรงดิ่ง L_v', 'lenm', { when: isCustom2 }), F('He', 'plvl', 'Minimum effective height H_e', 'ความสูงประสิทธิผลน้อยสุด H_e', 'len', { when: isCustom2 }),
    F('L', 'geo', 'Post spacing L', 'ระยะห่างเสา L', 'lenm'), F('setback', 'geo', 'Post setback from rail face (0 = not checked)', 'ระยะถอยเสาจากหน้าราว (0 = ไม่ตรวจ)', 'mm'), F('kerb', 'geo', 'Kerb height in contact (0 = none)', 'ความสูงขอบทางที่สัมผัส (0 = ไม่มี)', 'mm'),
    F('nr', 'rails', 'Number of rails', 'จำนวนราว', 'none', { type: 'sel', opts: [['1', '1', '1'], ['2', '2', '2'], ['3', '3', '3'], ['4', '4', '4']], re: true }),
    ...railF(1), ...railF(2), ...railF(3), ...railF(4),
    F('fyr', 'rails', 'Rail yield strength f_y', 'กำลังครากราว f_y', 'stress'),
    F('psh', 'post', 'Post section', 'หน้าตัดเสา', 'none', { type: 'sel', opts: SHP, re: true }), F('pd', 'post', 'Depth in the load direction', 'ความลึกตามแนวแรง', 'mm'),
    F('pb', 'post', 'Width', 'ความกว้าง', 'mm', { when: v => v.psh === 'RHS' }), F('pt', 'post', 'Wall thickness', 'ความหนา', 'mm'), F('pS', 'post', 'Plastic modulus S (0 = from size)', 'โมดูลัสพลาสติก S (0 = คำนวณ)', 'mm3'), F('fyp', 'post', 'Post yield strength f_y', 'กำลังครากเสา f_y', 'stress'),
    F('bp', 'base', 'Base plate width b_p (= W_b)', 'ความกว้างแผ่นฐาน b_p (= W_b)', 'mm'), F('tp', 'base', 'Base plate thickness', 'ความหนาแผ่นฐาน', 'mm'), F('fyb', 'base', 'Base plate f_y', 'f_y แผ่นฐาน', 'stress'),
    F('db', 'base', 'Anchor bolt size', 'ขนาดสลักยึด', 'none', { type: 'sel', opts: [16, 20, 24, 27, 30, 36].map(d => [String(d), 'M' + d, 'M' + d]) }),
    F('grade', 'base', 'Anchor bolt grade', 'เกรดสลักยึด', 'none', { type: 'sel', opts: [['4.6', 'Grade 4.6', 'เกรด 4.6'], ['8.8', 'Grade 8.8', 'เกรด 8.8'], ['F1554-36', 'ASTM F1554 Gr 36', 'ASTM F1554 Gr 36'], ['F1554-55', 'ASTM F1554 Gr 55', 'ASTM F1554 Gr 55'], ['F1554-105', 'ASTM F1554 Gr 105', 'ASTM F1554 Gr 105']] }),
    F('n', 'base', 'Anchor bolts in total', 'จำนวนสลักยึดทั้งหมด', 'none', { type: 'int' }), F('nt', 'base', 'Bolts in the tension row', 'จำนวนสลักแถวรับแรงดึง', 'none', { type: 'int' }),
    F('z', 'base', 'Lever arm, tension bolts to compression edge z', 'แขนโมเมนต์ สลักรับแรงดึงถึงขอบรับแรงอัด z', 'mm'), F('e', 'base', 'Tension bolts to the post face e', 'ระยะสลักรับแรงดึงถึงหน้าเสา e', 'mm'),
    F('D', 'base', 'Plate edge to the innermost bolts D', 'ขอบแผ่นถึงสลักแถวในสุด D', 'mm'), F('X', 'base', 'Plate edge to the deck section checked X', 'ขอบแผ่นถึงหน้าตัดพื้นที่ตรวจ X', 'mm'),
    F('phi', 'coef', 'Capacity factor φ (Eq. 11)', 'ตัวคูณลดกำลัง φ (สมการ 11)', 'none'), F('Nmax', 'coef', 'Spans N examined (1 … N_max)', 'จำนวนช่วงที่ตรวจ (1 … N_max)', 'none', { type: 'int' }),
    F('ends', 'coef', 'Check failure at a segment end (end post)', 'ตรวจการวิบัติที่ปลายช่วงราว (เสาปลาย)', 'none', { type: 'sel', opts: YN })
  ];
  const GA = window.GANTRY;
  const SHAPES = [['CHS', 'CHS — circular hollow', 'CHS — ท่อกลม'], ['SHS', 'SHS — square hollow', 'SHS — ท่อสี่เหลี่ยมจัตุรัส'], ['RHS', 'RHS — rectangular hollow', 'RHS — ท่อสี่เหลี่ยมผืนผ้า']];
  const SEC_DEF = { CHS: '323.9x9.5', SHS: '250x250x9', RHS: '300x200x10' };
  const sizeOpts = k => v => GA.sizeOptions(v[k]).map(o => [o[0], o[1], o[1]]);
  const GRADE_OPTS = Object.keys(GA.GRADES).map(g => [g, g + ' (f_y ' + GA.GRADES[g].fy + ' MPa)', g + ' (f_y ' + GA.GRADES[g].fy + ' MPa)']);
  const BOLT_OPTS = Object.keys(GA.BOLTS).map(b => [b, b, b]);
  const BGR_OPTS = [['4.6', 'Grade 4.6 (f_uf 400 MPa)', 'เกรด 4.6 (f_uf 400 MPa)'], ['8.8', 'Grade 8.8 (f_uf 830 MPa)', 'เกรด 8.8 (f_uf 830 MPa)']];
  const WELD_OPTS = [['cjp', 'Complete-penetration butt weld', 'รอยเชื่อมชนทะลุเต็ม'], ['fillet', 'Fillet weld all round', 'รอยเชื่อมพอกรอบท่อ']];
  const CAT_OPTS = [['auto', 'Auto (by detail)', 'อัตโนมัติ (ตามรายละเอียด)']].concat([36, 40, 45, 50, 56, 63, 71, 80, 90].map(c => [String(c), 'FAT ' + c, 'FAT ' + c]));
  const isBolt = v => v.ctype === 'bolt', yes = k => v => v[k] === 'yes';
  SCHEMA.gantry = [
    F('H', 'geo', 'Column height to arm centreline H', 'ความสูงเสาถึงแนวแกนคาน H', 'lenm'), F('L', 'geo', 'Arm length from column centreline L', 'ความยาวคานจากแนวแกนเสา L', 'lenm'),
    F('ke', 'geo', 'Column effective length factor k_e', 'ตัวคูณความยาวประสิทธิผลเสา k_e', 'none'),
    F('Bs', 'sign', 'Sign width B_s', 'ความกว้างป้าย B_s', 'lenm'), F('Hs', 'sign', 'Sign height H_s', 'ความสูงป้าย H_s', 'lenm'),
    F('xs', 'sign', 'Sign centre from column centreline x_s', 'ศูนย์กลางป้ายจากแนวแกนเสา x_s', 'lenm'),
    F('ez', 'sign', 'Sign centre above arm centreline e_z', 'ศูนย์กลางป้ายเหนือแนวแกนคาน e_z', 'len'), F('ey', 'sign', 'Sign face offset from arm centreline e_y', 'ระยะหน้าป้ายจากแนวแกนคาน e_y', 'len'),
    F('gs', 'sign', 'Sign self-weight g_s', 'น้ำหนักป้าย g_s', 'kpa'), F('Gadd', 'sign', 'Brackets, lights and attachments', 'น้ำหนักขายึด ไฟ และอุปกรณ์', 'force'),
    F('colShape', 'col', 'Section type', 'ชนิดหน้าตัด', 'none', { type: 'sel', opts: SHAPES, re: 'colSize' }), F('colSize', 'col', 'Size (AS/NZS 1163)', 'ขนาด (AS/NZS 1163)', 'none', { type: 'sel', opts: sizeOpts('colShape') }),
    F('colGrade', 'col', 'Grade', 'เกรด', 'none', { type: 'sel', opts: GRADE_OPTS }),
    F('armShape', 'arm', 'Section type', 'ชนิดหน้าตัด', 'none', { type: 'sel', opts: SHAPES, re: 'armSize' }), F('armSize', 'arm', 'Size (AS/NZS 1163)', 'ขนาด (AS/NZS 1163)', 'none', { type: 'sel', opts: sizeOpts('armShape') }),
    F('armGrade', 'arm', 'Grade', 'เกรด', 'none', { type: 'sel', opts: GRADE_OPTS }),
    F('mode', 'wind', 'Wind input', 'รูปแบบข้อมูลลม', 'none', { type: 'sel', opts: [['V', 'Design wind speed V_des,θ', 'ความเร็วลมออกแบบ V_des,θ'], ['q', 'Design wind pressure q_z', 'แรงดันลมออกแบบ q_z']], re: true }),
    F('Vu', 'wind', 'ULS wind speed V_des,θ', 'ความเร็วลม ULS V_des,θ', 'ms', { when: v => v.mode === 'V' }), F('Vs', 'wind', 'SLS wind speed', 'ความเร็วลม SLS', 'ms', { when: v => v.mode === 'V' }),
    F('qu', 'wind', 'ULS wind pressure q_u', 'แรงดันลม ULS q_u', 'kpa', { when: v => v.mode === 'q' }), F('qs', 'wind', 'SLS wind pressure q_s', 'แรงดันลม SLS q_s', 'kpa', { when: v => v.mode === 'q' }),
    F('Cfig', 'wind', 'Sign shape factor C_fig', 'สัมประสิทธิ์รูปทรงป้าย C_fig', 'none'), F('Cdc', 'wind', 'Column drag factor C_d', 'สัมประสิทธิ์แรงลากเสา C_d', 'none'),
    F('Cda', 'wind', 'Arm drag factor C_d', 'สัมประสิทธิ์แรงลากคาน C_d', 'none'), F('Cdyn', 'wind', 'Dynamic response factor C_dyn', 'ตัวคูณผลพลวัต C_dyn', 'none'),
    F('eb', 'wind', 'Wind eccentricity on sign e/B_s', 'ความเยื้องศูนย์ของลมบนป้าย e/B_s', 'none'),
    F('ctype', 'conn', 'Arm connection', 'รูปแบบรอยต่อคาน', 'none', { type: 'sel', opts: [['weld', 'Arm welded to column', 'เชื่อมคานเข้ากับเสา'], ['bolt', 'Stub + bolted end plates', 'ท่อสั้น + แผ่นปลายยึดสลัก']], re: true }),
    F('cweld', 'conn', 'Tube weld', 'รอยเชื่อมท่อ', 'none', { type: 'sel', opts: WELD_OPTS, re: true }), F('sa', 'conn', 'Fillet weld size', 'ขนาดรอยเชื่อมพอก', 'len', { when: v => v.cweld === 'fillet' }),
    F('Lst', 'conn', 'Stub length from column face', 'ความยาวท่อสั้นจากผิวเสา', 'len', { when: isBolt }), F('tep', 'conn', 'End plate thickness', 'ความหนาแผ่นปลาย', 'len', { when: isBolt }), F('epshape', 'conn', 'End plate shape', 'รูปทรงแผ่นปลาย', 'none', { type: 'sel', opts: [['square', 'Square', 'สี่เหลี่ยมจัตุรัส'], ['circle', 'Circular', 'วงกลม']], when: isBolt }),
    F('nf', 'conn', 'Flange bolts (number)', 'จำนวนสลักหน้าแปลน', 'none', { type: 'int', when: isBolt }), F('fb', 'conn', 'Flange bolt size', 'ขนาดสลักหน้าแปลน', 'none', { type: 'sel', opts: BOLT_OPTS, when: isBolt }),
    F('fg', 'conn', 'Flange bolt grade', 'เกรดสลักหน้าแปลน', 'none', { type: 'sel', opts: BGR_OPTS, when: isBolt }), F('af', 'conn', 'Bolt offset from tube face', 'ระยะสลักจากผิวท่อ', 'len', { when: isBolt }),
    F('pshape', 'base', 'Base plate shape', 'รูปทรงแผ่นฐาน', 'none', { type: 'sel', opts: [['square', 'Square', 'สี่เหลี่ยมจัตุรัส'], ['circle', 'Circular', 'วงกลม']] }),
    F('nb', 'base', 'Anchor bolts (number)', 'จำนวนสลักยึด', 'none', { type: 'int' }), F('db', 'base', 'Anchor bolt size', 'ขนาดสลักยึด', 'none', { type: 'sel', opts: BOLT_OPTS }),
    F('bg', 'base', 'Anchor bolt grade', 'เกรดสลักยึด', 'none', { type: 'sel', opts: BGR_OPTS }), F('ab', 'base', 'Bolt offset from tube face a', 'ระยะสลักจากผิวท่อ a', 'len'),
    F('ep', 'base', 'Plate edge beyond bolt', 'ระยะขอบแผ่นจากสลัก', 'len'), F('tp', 'base', 'Base plate thickness', 'ความหนาแผ่นฐาน', 'len'), F('fyp', 'base', 'Plate yield stress f_y', 'กำลังครากแผ่นเหล็ก f_y', 'stress'),
    F('bweld', 'base', 'Column-to-plate weld', 'รอยเชื่อมเสากับแผ่นฐาน', 'none', { type: 'sel', opts: WELD_OPTS, re: true }), F('sb', 'base', 'Fillet weld size', 'ขนาดรอยเชื่อมพอก', 'len', { when: v => v.bweld === 'fillet' }),
    F('stiff', 'base', 'Stiffeners', 'แผ่นเสริมกำลัง', 'none', { type: 'sel', opts: YN, re: true }),
    F('ts', 'base', 'Stiffener thickness', 'ความหนาแผ่นเสริม', 'len', { when: yes('stiff') }), F('hs', 'base', 'Stiffener height', 'ความสูงแผ่นเสริม', 'len', { when: yes('stiff') }),
    F('sst', 'base', 'Stiffener fillet weld size', 'ขนาดรอยเชื่อมแผ่นเสริม', 'len', { when: yes('stiff') }),
    F('fon', 'fat', 'Check fatigue', 'ตรวจสอบความล้า', 'none', { type: 'sel', opts: YN, re: true }),
    F('IF', 'fat', 'Fatigue importance factor I_F', 'ตัวคูณความสำคัญ I_F', 'none', { when: yes('fon') }), F('phiF', 'fat', 'Fatigue capacity factor φ_f', 'ตัวคูณลดกำลังความล้า φ_f', 'none', { when: yes('fon') }),
    F('PNW', 'fat', 'Natural wind gust pressure', 'แรงดันลมกระโชกธรรมชาติ', 'pa', { when: yes('fon') }), F('Vm', 'fat', 'Yearly mean wind speed', 'ความเร็วลมเฉลี่ยรายปี', 'ms', { when: yes('fon') }),
    F('tg', 'fat', 'Truck-induced gust (sign over traffic)', 'ลมจากรถบรรทุก (ป้ายอยู่เหนือช่องจราจร)', 'none', { type: 'sel', opts: YN, re: true, when: yes('fon') }),
    F('PTG', 'fat', 'Truck gust pressure', 'แรงดันลมจากรถบรรทุก', 'pa', { when: v => v.fon === 'yes' && v.tg === 'yes' }), F('xTG', 'fat', 'Truck lane centre from column x_TG', 'ศูนย์กลางช่องจราจรจากเสา x_TG', 'lenm', { when: v => v.fon === 'yes' && v.tg === 'yes' }),
    F('LTG', 'fat', 'Loaded length along arm', 'ความยาวรับแรงตามคาน', 'len', { when: v => v.fon === 'yes' && v.tg === 'yes' }), F('dsh', 'fat', 'Sign horizontal projection', 'ความลึกป้ายในแนวราบ', 'len', { when: v => v.fon === 'yes' && v.tg === 'yes' }),
    F('ga', 'fat', 'Galloping', 'การสั่นแบบแกลลอปปิง', 'none', { type: 'sel', opts: YN, re: true, when: yes('fon') }), F('PG', 'fat', 'Galloping pressure', 'แรงดันแกลลอปปิง', 'pa', { when: v => v.fon === 'yes' && v.ga === 'yes' }),
    F('cB', 'fat', 'Category: column-to-base weld', 'หมวด: รอยเชื่อมเสา-ฐาน', 'none', { type: 'sel', opts: CAT_OPTS, when: yes('fon') }),
    F('cS', 'fat', 'Category: stiffener termination', 'หมวด: ปลายแผ่นเสริม', 'none', { type: 'sel', opts: CAT_OPTS, when: v => v.fon === 'yes' && v.stiff === 'yes' }),
    F('cR', 'fat', 'Category: arm / stub welds', 'หมวด: รอยเชื่อมคาน / ท่อสั้น', 'none', { type: 'sel', opts: CAT_OPTS, when: yes('fon') }),
    F('cA', 'fat', 'Category: bolts in tension', 'หมวด: สลักรับแรงดึง', 'none', { type: 'sel', opts: CAT_OPTS, when: yes('fon') }),
    F('limH', 'lim', 'Horizontal tip deflection limit L/…', 'ขีดจำกัดการโก่งแนวนอน L/…', 'none'), F('limV', 'lim', 'Vertical tip deflection limit L/…', 'ขีดจำกัดการโก่งแนวดิ่ง L/…', 'none')
  ];
  const GROUPS = {
    geo: ['Geometry', 'รูปทรงหน้าตัด'], mat: ['Materials', 'วัสดุ'], coef: ['Code coefficients', 'ค่าสัมประสิทธิ์'], link: ['Shear links', 'เหล็กปลอก'],
    bars: ['Reinforcement', 'เหล็กเสริม'], uls: ['Design actions — ULS', 'แรงประลัย (ULS)'], sls: ['Service actions — SLS', 'แรงใช้งาน (SLS)'], piles: ['Pile group', 'กลุ่มเสาเข็ม'],
    sign: ['Sign panel', 'แผ่นป้าย'], col: ['Column section', 'หน้าตัดเสา'], arm: ['Cantilever arm section', 'หน้าตัดคานยื่น'], wind: ['Wind (AS/NZS 1170.2)', 'ลม (AS/NZS 1170.2)'],
    wall: ['Wall and blocks', 'กำแพงและก้อนหิน'], wat: ['Groundwater', 'น้ำใต้ดิน'], top: ['Top of wall and back slope', 'ด้านบนกำแพงและลาดด้านหลัง'], soil: ['Retained soil', 'ดินถม'], fnd: ['Foundation', 'ดินฐานราก'], joint: ['Bed joints between blocks', 'รอยต่อระหว่างชั้นก้อนหิน'], lds: ['Loads', 'น้ำหนักบรรทุก'], fac: ['Factors (AS 4678)', 'ตัวคูณ (AS 4678)'],
    plvl: ['Performance level and design loads', 'ระดับสมรรถนะและแรงออกแบบ'], rails: ['Rails', 'ราว'], post: ['Post', 'เสา'],
    tl: ['Test level — AASHTO LRFD 13 (DOH)', 'ระดับการทดสอบ — AASHTO LRFD 13 (กรมทางหลวง)'], deck: ['Deck overhang and interface', 'พื้นยื่นและรอยต่อ'], comp: ['Wall flexural resistance', 'กำลังดัดของกำแพง'],
    conn: ['Arm-to-column connection', 'รอยต่อคาน-เสา'], base: ['Base plate and anchor bolts', 'แผ่นฐานและสลักยึด'], fat: ['Fatigue (AS 4100 §11)', 'ความล้า (AS 4100 §11)'], lim: ['Serviceability limits', 'ขีดจำกัดสภาวะใช้งาน']
  };
  const DEF = {
    beam: {
      EC2: { b: 300, h: 600, cover: 30, fc: 30, fy: 500, fyt: 500, dg: 20, gC: 1.5, gS: 1.15, ktc: 1.0, creep: 2.0, kt: 0.4, wlim: 0.3, linkD: 10, s: 150, innerN: 0, innerD: 10, top: [{ n: 2, d: 16 }], bot: [{ n: 4, d: 20 }], sideN: 1, sideD: 12, Mx: 250, My: 10, Vy: 200, Vx: 30, T: 15, Ms: 170 },
      AS: { b: 300, h: 600, cover: 30, fc: 32, fy: 500, fyt: 500, dg: 20, linkD: 10, s: 150, innerN: 0, innerD: 10, top: [{ n: 2, d: 16 }], bot: [{ n: 4, d: 20 }], sideN: 1, sideD: 12, Mx: 250, My: 10, Vy: 200, Vx: 30, T: 15, Ms: 170 },
      TH: { b: 30, h: 60, cover: 3, fc: 280, fy: 4000, fyt: 4000, dg: 20, linkD: 12, s: 15, innerN: 0, innerD: 12, top: [{ n: 2, d: 16 }], bot: [{ n: 4, d: 20 }], sideN: 1, sideD: 12, Mx: 22, My: 0.5, Vy: 20, Vx: 3, T: 1.0, Ms: 15 }
    },
    column: {
      EC2: { b: 400, h: 600, cover: 40, fc: 40, fy: 500, fyt: 500, dg: 20, gC: 1.5, gS: 1.15, ktc: 1.0, dc: 25, dm: 20, nb: 3, nh: 4, linkD: 10, s: 200, innerN: 1, innerD: 10, N: 2500, Mx: 300, My: 120, Vy: 150, Vx: 60 },
      AS: { b: 400, h: 600, cover: 40, fc: 40, fy: 500, fyt: 500, dg: 20, dc: 24, dm: 20, nb: 3, nh: 4, linkD: 10, s: 200, innerN: 1, innerD: 10, N: 2500, Mx: 300, My: 120, Vy: 150, Vx: 60 },
      TH: { b: 40, h: 60, cover: 4, fc: 320, fy: 4000, fyt: 2400, dg: 20, dc: 25, dm: 20, nb: 3, nh: 4, linkD: 9, s: 20, innerN: 1, innerD: 9, N: 250, Mx: 30, My: 12, Vy: 15, Vx: 6 }
    },
    pilecap: {
      EC2: { layout: '4', nx: 2, ny: 2, s: 1500, sy: 1500, Dp: 500, edge: 500, Pallow: 1100, H: 1200, cb: 100, cs: 75, cx: 500, cy: 500, fc: 30, fy: 500, dg: 20, bxd: 20, bxs: 150, byd: 20, bys: 150, method: 'stm', gC: 1.5, gS: 1.15, ktc: 1.0, gG: 1.35, gc: 25, zd: 0.85, N: 3500, Mx: 150, My: 80, Ns: 2500, Mxs: 100, Mys: 50 },
      AS: { layout: '4', nx: 2, ny: 2, s: 1500, sy: 1500, Dp: 500, edge: 500, Pallow: 1100, H: 1200, cb: 100, cs: 75, cx: 500, cy: 500, fc: 32, fy: 500, dg: 20, bxd: 20, bxs: 125, byd: 20, bys: 125, method: 'stm', gG: 1.2, gc: 25, zd: 0.85, N: 3500, Mx: 150, My: 80, Ns: 2500, Mxs: 100, Mys: 50 },
      TH: { layout: '4', nx: 2, ny: 2, s: 120, sy: 120, Dp: 40, edge: 40, Pallow: 60, H: 90, cb: 10, cs: 7.5, cx: 50, cy: 50, fc: 280, fy: 4000, dg: 20, bxd: 20, bxs: 12.5, byd: 20, bys: 12.5, method: 'stm', gG: 1.2, gc: 2.4, zd: 0.85, betaS: 0.75, N: 300, Mx: 8, My: 5, Ns: 210, Mxs: 5, Mys: 3 }
    }
  };

  Object.values(DEF.pilecap).forEach(d => { d.tieN = 5; d.tieD = 20; });
  DEF.lwall = { AS: { crs: [{ n: 4 }, { n: 3 }, { n: 2 }, { n: 2 }], ds: 300, water: 'no', hw: 600, hwf: 0, gsat: 20, gW: 1.0, bx: 500, by: 500, set: 0, e: 300, gb: 22, Lc: 1500, beta: 18.4, gs: 19, phi: 30, dv: 'beta', phib: 30, cb: 0, qbear: 300, mu: 0.6, cj: 0, q: 5, qext: 'crest', Hr: 0.75, hr: 1000, kh: 0, Pphi: 0.85, Pc: 0.65, gGd: 1.25, gGs: 0.8, gQ: 1.5, psiE: 0.3 } };
  DEF.barrier = { TH: { tl: 'TL-4', Ft: 24.5, Fl: 8.2, Fv: 8.2, Lt: 1.07, Lv: 5.5, He: 81, Hmin: 81, shape: 'tapered', H: 100, tt: 25, tb: 45, cover: 5, fc: 320, fy: 4000, vD: 12, vS: 12.5, v2D: 12, v2S: 30, hD: 12, hS: 15, Mb: 0, check: 'yes', ts: 25, dTop: 20, sTop: 12.5, cTop: 4, cBot: 4, iface: 'rough', phi: 1.0, ends: 'yes', theta: 45, gc: 2.4, mode: 'bars', Asb: 0, bb: 180, db: 300, Asw: 550, bw: 1020, dw: 250, Asc: 1570, dc: 350 },
    AS: { tl: 'AS-medium', mode: 'direct', Ft: 600, Fl: 200, Fv: 300, Lt: 2.4, Lv: 12, He: 1200, Hmin: 1200, shape: 'tapered', H: 1200, tt: 250, tb: 400, cover: 50, fc: 32, fy: 400, Asb: 400, bb: 180, db: 300, Asw: 550, bw: 1020, dw: 250, Asc: 2200, dc: 350, vD: 16, vS: 90, v2D: 12, v2S: 300, hD: 12, hS: 200, Mb: 0, check: 'yes', ts: 300, dTop: 24, sTop: 125, cTop: 50, cBot: 40, iface: 'rough', phi: 0.6, phid: 0.8, ends: 'yes', theta: 45, gc: 24 } };
  DEF.sbarrier = { AS: { level: 'AS-regular', nr: '3', y1: 1050, sh1: 'RHS', d1: 150, b1: 100, t1: 6, S1: 0, u1: 'yes', y2: 750, sh2: 'RHS', d2: 150, b2: 100, t2: 6, S2: 0, u2: 'yes', y3: 300, sh3: 'RHS', d3: 150, b3: 100, t3: 6, S3: 0, u3: 'no', y4: 0, sh4: 'RHS', d4: 150, b4: 100, t4: 6, S4: 0, u4: 'no', psh: 'SHS', pd: 200, pb: 200, pt: 6, pS: 0, setback: 200, kerb: 0, L: 3.0, bp: 400, tp: 40, db: '24', grade: '8.8', n: 4, nt: 2, z: 320, e: 60, D: 340, X: 300, phi: 0.9, Nmax: 6, ends: 'no', fyr: 350, fyp: 350, fyb: 250, Ft: 300, Fl: 100, Fv: 100, Lt: 1.2, Lv: 6.0, He: 900 }, TH: { level: 'AS-regular', nr: '3', y1: 105, sh1: 'RHS', d1: 150, b1: 100, t1: 6, S1: 0, u1: 'yes', y2: 75, sh2: 'RHS', d2: 150, b2: 100, t2: 6, S2: 0, u2: 'yes', y3: 30, sh3: 'RHS', d3: 150, b3: 100, t3: 6, S3: 0, u3: 'no', y4: 0, sh4: 'RHS', d4: 150, b4: 100, t4: 6, S4: 0, u4: 'no', psh: 'SHS', pd: 200, pb: 200, pt: 6, pS: 0, setback: 200, kerb: 0, L: 3.0, bp: 400, tp: 40, db: '24', grade: '8.8', n: 4, nt: 2, z: 320, e: 60, D: 340, X: 300, phi: 0.9, Nmax: 6, ends: 'no', fyr: 3570, fyp: 3570, fyb: 2550, Ft: 30.6, Fl: 10.2, Fv: 10.2, Lt: 1.2, Lv: 6.0, He: 90 } };
  DEF.stm3d = { AS: { layout: '4', nx: 3, ny: 2, s: 1500, sy: 1500, Dp: 500, edge: 500, Pallow: 1100, H: 1400, cb: 100, cs: 75, cx: 600, cy: 600, fc: 32, fy: 500, dg: 20, tN: 6, tD: 24, zd: 0.85, gG: 1.2, gc: 25, N: 3500, Mx: 150, My: 80, Ns: 2500, Mxs: 100, Mys: 50 } };
  DEF.gantry = { AS: {
    H: 7.0, L: 6.5, ke: 2.2, Bs: 3.0, Hs: 2.0, xs: 4.5, ez: 0, ey: 350, gs: 0.35, Gadd: 1.0,
    colShape: 'CHS', colSize: '457x12.7', colGrade: 'C350L0', armShape: 'CHS', armSize: '323.9x9.5', armGrade: 'C350L0',
    mode: 'V', Vu: 45, Vs: 30, qu: 1.2, qs: 0.54, Cfig: 1.4, Cdc: 1.2, Cda: 1.2, Cdyn: 1.0, eb: 0,
    ctype: 'weld', cweld: 'cjp', sa: 10, Lst: 400, tep: 32, epshape: 'square', nf: 8, fb: 'M24', fg: '8.8', af: 45,
    pshape: 'square', nb: 12, db: 'M36', bg: '8.8', ab: 75, ep: 60, tp: 40, fyp: 340, bweld: 'cjp', sb: 12, stiff: 'yes', ts: 16, hs: 300, sst: 8,
    fon: 'yes', IF: 1.0, phiF: 0.7, PNW: 250, Vm: 5.0, tg: 'yes', PTG: 900, xTG: 4.5, LTG: 3700, dsh: 300, ga: 'no', PG: 1000,
    cB: 'auto', cS: 'auto', cR: 'auto', cA: 'auto', limH: 100, limV: 150 } };

  // ------------------------------------------------------------------ session
  const sess = ss.get('srcSession'); if (sess) Object.assign(S, { role: sess.role, user: sess.user });
  const isPro = () => S.role === 'pro' || S.role === 'admin' || !!S.promo;
  // functions the administrator has switched off (settings/global.off = { key: true }); the administrator still sees them
  const FEATS = [
    ['Structural design', 'ออกแบบโครงสร้าง', [['beam', 'RC Beam', 'คาน คสล.'], ['column', 'RC Column', 'เสา คสล.'], ['pilecap', 'RC Pile Cap', 'ฐานรากบนเสาเข็ม'], ['stm3d', 'Pile Cap 3D STM', 'ฐานรากเข็ม STM 3 มิติ'], ['lwall', 'Limestone Block Wall', 'กำแพงกันดินก้อนหินปูน'], ['barrier', 'Bridge Barrier (Thai)', 'ราวกันตกสะพาน (ไทย)'], ['sbarrier', 'Steel Post-and-Rail Barrier', 'ราวกันตกเหล็ก'], ['gantry', 'Sign Gantry', 'โครงป้ายจราจรยื่น']]],
    ['Structural analysis', 'วิเคราะห์โครงสร้าง', [['analysis', '3D frame & truss', 'โครงข้อแข็งและโครงถัก 3 มิติ'], ['building', 'Building design', 'อาคาร'], ['bridge', 'Bridge', 'สะพาน'], ['conn', 'Steel connections', 'รอยต่อเหล็ก']]],
    ['Timber bridges', 'สะพานไม้', [['timber', 'Timber bridge assessment', 'ประเมินสะพานไม้'], ['tdraw', 'Repair detail drawings', 'แบบรายละเอียดการซ่อม']]],
    ['Output', 'ผลลัพธ์', [['pdf', 'PDF export (reports and drawings)', 'ส่งออก PDF (รายงานและแบบ)'], ['dxf', 'AutoCAD DXF export', 'ส่งออก DXF สำหรับ AutoCAD']]]
  ];
  const featOff = k => !!(S.off && S.off[k]);                 // switched off by the administrator
  const isOff = k => featOff(k) && S.role !== 'admin';        // blocked for this user
  const offMsg = () => T('This function is switched off by the administrator for now.', 'ผู้ดูแลระบบปิดฟังก์ชันนี้ไว้ชั่วคราว');
  window.SC_FEAT_OFF = k => { if (isOff(k)) { toast(offMsg(), 'bad'); return true; } return false; };
  const inp = () => { const k = S.elem + ':' + S.code; if (!S.inputs[k]) S.inputs[k] = JSON.parse(JSON.stringify(DEF[S.elem][S.code])); return S.inputs[k]; };

  // ------------------------------------------------------------------ crypto
  const hex = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  async function pbkdf2(pass, salt, iter) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: iter }, key, 256);
    return hex(bits);
  }
  const newSalt = () => hex(crypto.getRandomValues(new Uint8Array(16)));

  // ------------------------------------------------------------------ data store (TEST MODE)
  /* Test store: keeps accounts, members and payments in this browser (localStorage).
     To go live with Supabase, replace get / set / del / reset / watch with supabase-js calls on tables
       accounts(username pk, name, plan, status, start, expiry, salt, hash, iter, updated)
       members(username pk, email, phone, note, created)
       payments(id pk, username fk, date, amount, method, ref, days, status, created)
     (or Supabase Auth for passwords). The pages above call only these methods, so the UI does not change. */
  const DBKEY = 'sigmarc.testdb.v1';
  const Store = {
    mode: 'test', persistent: false, _mem: null, _ls: {},
    _load() {
      const raw = ls.get(DBKEY);
      let d = null;
      if (raw) { try { d = JSON.parse(raw); } catch (e) { } }
      d = d || this._mem || {};
      ['accounts', 'members', 'payments', 'settings', 'requests', 'messages'].forEach(c => { d[c] = d[c] || {}; });
      return d;
    },
    _save(d) { this.persistent = ls.set(DBKEY, JSON.stringify(d)); if (!this.persistent) this._mem = d; },
    async get(col, id) { return this._load()[col][id] || null; },
    async set(col, id, data) { const d = this._load(); d[col][id] = data; this._save(d); this._emit(col); },
    async del(col, id) { const d = this._load(); delete d[col][id]; this._save(d); this._emit(col); },
    async reset() { const keep = this._load().settings; this._mem = null; this._save({ accounts: {}, members: {}, payments: {}, requests: {}, messages: {}, settings: keep }); ['accounts', 'members', 'payments', 'requests', 'messages'].forEach(c => this._emit(c)); },
    watch(col, cb) { (this._ls[col] = this._ls[col] || []).push(cb); cb(this._rows(col)); return () => { this._ls[col] = this._ls[col].filter(x => x !== cb); }; },
    _rows(col) { return Object.entries(this._load()[col]).map(([k, v]) => Object.assign({ _id: k }, v)); },
    _emit(col) { const rows = this._rows(col); (this._ls[col] || []).forEach(cb => cb(rows)); }
  };
  Store.persistent = ls.set('sigmarc.probe', '1');

  // ------------------------------------------------------------------ cloud mode (Supabase Edge Function)
  // When config.js sets window.STRUCTCAP_CONFIG.apiUrl, every account / payment / setting operation goes
  // through the server API; passwords are hashed server-side and the tables are closed to the browser.
  const CFG = window.STRUCTCAP_CONFIG || {};
  const CLOUD = !!CFG.apiUrl;
  async function api(action, payload) {
    const headers = { 'content-type': 'application/json' };
    if (CFG.anonKey) { headers.apikey = CFG.anonKey; }
    const r = await fetch(CFG.apiUrl, { method: 'POST', headers, body: JSON.stringify(Object.assign({ action, token: S.role === 'admin' ? ss.get('scAdminToken') : ss.get('scUserToken') }, payload || {})) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { const e = new Error('auth'); e.code = 'auth'; throw e; }
    if (!r.ok) { const e = new Error(j.error || 'http ' + r.status); e.code = 'http'; e.msg = j.error; throw e; }
    return j;
  }
  // ---- prices and the administrator's email (registrations, Pro applications, contact and feedback)
  const PRICE = { USD: 0.99, THB: 30 };
  const EMAIL_ID = /^[a-z0-9._%+-]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/;
  const ADMIN_EMAIL = CFG.adminEmail || 'napong.subanpong@outlook.com';
  const curOf = () => (S.ui === 'th' ? 'THB' : 'USD');
  const money = (v, cur) => cur === 'THB' ? f(v, v % 1 ? 2 : 0) + ' ' + T('THB', 'บาท') : 'USD ' + (+v).toFixed(2);
  const priceTxt = cur => money(PRICE[cur || curOf()], cur || curOf()) + ' / ' + T('month', 'เดือน');
  const uidLocal = p => p + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  /* Browser relay: when the server has no mail key (RESEND_API_KEY), the same summary is sent through FormSubmit
     to ADMIN_EMAIL. FormSubmit asks the administrator to confirm the address once (first message only).
     Set mailRelay: false in config.js to switch it off. No passwords or slip images are sent this way. */
  async function relayMail(subject, fields) {
    if (CFG.mailRelay === false) return false;
    try {
      const r = await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(ADMIN_EMAIL), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(Object.assign({ _subject: '[StructCap] ' + subject, _template: 'table', _captcha: 'false' }, fields)) });
      return r.ok;
    } catch (e) { return false; }
  }
  const fileToData = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  function setUser(acc, token) {
    if (token) ss.set('scUserToken', token);
    S.role = acc.plan === 'pro' ? 'pro' : 'free';
    S.user = { username: acc.username, name: acc.name, plan: acc.plan, expiry: acc.expiry, expired: acc.expired || null, email: acc.email || '', phone: acc.phone || '', company: acc.company || '', country: acc.country || '', requests: acc.requests || [], member: true };
    saveSession();
  }
  // local (test-mode) account view, same shape as the server's
  async function localAccount(u) {
    const a = await Store.get('accounts', u); if (!a) return null;
    const m = (await Store.get('members', u)) || {}, d = Store._load();
    const rq = Object.entries(d.requests).map(([id, r]) => Object.assign({ id }, r)).filter(r => r.username === u).sort((x, y) => (y.created || '').localeCompare(x.created || ''));
    const expired = a.plan === 'pro' && a.expiry && a.expiry < today();
    return { username: u, name: a.name, plan: expired ? 'free' : a.plan, status: a.status, start: a.start, expiry: a.expiry, expired: expired ? a.expiry : null, email: m.email, phone: m.phone, company: m.company, country: m.country, requests: rq.map(r => ({ id: r.id, months: r.months, amount: r.amount, currency: r.currency, status: r.status, created: r.created })) };
  }
  async function localRequest(u, pro) {
    const cur = pro.currency === 'THB' ? 'THB' : 'USD', months = Math.min(36, Math.max(1, pro.months | 0 || 1)), id = uidLocal('req');
    await Store.set('requests', id, { username: u, months, amount: Math.round(PRICE[cur] * months * 100) / 100, currency: cur, method: pro.method, ref: pro.ref, note: pro.note, slip_name: pro.slip ? pro.slip.name : '', slip_data: pro.slip ? pro.slip.data : '', status: 'pending', created: new Date().toISOString() });
    return { id, months, amount: Math.round(PRICE[cur] * months * 100) / 100, currency: cur };
  }
  const Ops = {
    async register(form) {
      if (CLOUD) {
        const j = await api('register', form);
        if (!j.emailed) relayMail(form.plan === 'pro' ? 'New registration + Pro application: ' + form.email : 'New registration: ' + form.email, { Email: form.email, Language: form.lang, Plan: form.plan === 'pro' ? 'Pro application — ' + (j.request ? j.request.months + ' month(s), ' + money(j.request.amount, j.request.currency) : 'slip not received') : 'Free', Note: form.note || '', Review: 'Open the StructCap admin panel → Applications' });
        return j;
      }
      if (await Store.get('accounts', form.username)) { const e = new Error('taken'); e.msg = 'Email taken'; throw e; }
      const salt = newSalt();
      await Store.set('accounts', form.username, { username: form.username, name: form.name || '', plan: 'free', status: 'active', start: today(), expiry: null, salt, hash: await pbkdf2(form.password, salt, USER_ITER), iter: USER_ITER, updated: new Date().toISOString() });
      await Store.set('members', form.username, { email: form.email, phone: form.phone, company: form.company, country: form.country, note: form.note, created: today() });
      const request = form.plan === 'pro' ? await localRequest(form.username, form.pro) : null;
      await Store.set('messages', uidLocal('msg'), { kind: form.plan === 'pro' ? 'pro' : 'register', name: form.name, email: form.email, username: form.username, message: form.plan === 'pro' ? 'Registered and applied for Pro' : 'Registered (Free)', status: 'new', created: new Date().toISOString() });
      return { ok: true, emailed: false, request, account: await localAccount(form.username) };
    },
    async me() { if (CLOUD) return (await api('me')).account; return localAccount(S.user.username); },
    async changePassword(old, pw) {
      if (CLOUD) return api('changePassword', { old, password: pw });
      const a = await Store.get('accounts', S.user.username);
      if (!a || (await pbkdf2(old, a.salt, a.iter || USER_ITER)) !== a.hash) return { ok: false, err: 'bad' };
      const salt = newSalt(); await Store.set('accounts', S.user.username, Object.assign({}, a, { salt, hash: await pbkdf2(pw, salt, USER_ITER), iter: USER_ITER, updated: new Date().toISOString() }));
      return { ok: true };
    },
    async updateProfile(p) {
      if (CLOUD) return (await api('updateProfile', p)).account;
      const u = S.user.username, a = await Store.get('accounts', u), m = (await Store.get('members', u)) || {};
      await Store.set('accounts', u, Object.assign({}, a, { name: p.name })); await Store.set('members', u, Object.assign({}, m, { email: p.email, phone: p.phone, company: p.company, country: p.country }));
      return localAccount(u);
    },
    async applyPro(pro) {
      if (CLOUD) {
        const j = await api('applyPro', { pro, lang: S.ui });
        if (!j.emailed) relayMail('Pro application: ' + S.user.username, { Username: S.user.username, Name: S.user.name || '', Email: S.user.email || '', Period: j.request.months + ' month(s)', Amount: money(j.request.amount, j.request.currency), 'Method / ref.': (pro.method || '') + ' ' + (pro.ref || ''), Note: pro.note || '', Review: 'Open the StructCap admin panel → Applications' });
        return j;
      }
      const request = await localRequest(S.user.username, pro);
      await Store.set('messages', uidLocal('msg'), { kind: 'pro', name: S.user.name, email: S.user.email, username: S.user.username, message: 'Applied for Pro', status: 'new', created: new Date().toISOString() });
      return { ok: true, emailed: false, request, account: await localAccount(S.user.username) };
    },
    async contact(m) {
      if (CLOUD) { const j = await api('contact', m); if (!j.emailed) relayMail((m.kind === 'feedback' ? 'Feedback' : 'Contact') + ' from ' + (m.name || m.email || 'a visitor'), { Name: m.name, Email: m.email, Type: m.kind, Message: m.message, _replyto: m.email || undefined }); return j; }
      await Store.set('messages', uidLocal('msg'), { kind: m.kind, name: m.name, email: m.email, username: S.user && S.user.member ? S.user.username : null, message: m.message, status: 'new', created: new Date().toISOString() });
      return { ok: true, emailed: false };
    },
    async decide(id, approve, days) {
      if (CLOUD) { await api('decide', { id, approve, days }); return Ops.refresh(); }
      const d = Store._load(), r = d.requests[id]; if (!r || r.status !== 'pending') return;
      await Store.set('requests', id, Object.assign({}, r, { status: approve ? 'approved' : 'rejected', decided: new Date().toISOString() }));
      if (approve) { await Ops.extend(r.username, days || r.months * 30); await Store.set('payments', uidLocal('pay'), { username: r.username, date: today(), amount: r.amount, currency: r.currency, method: r.method || 'bank', ref: r.ref || r.slip_name, days: days || r.months * 30, status: 'paid' }); }
    },
    async slipUrl(id) { if (CLOUD) return (await api('slipUrl', { id })).url; const r = Store._load().requests[id]; return r && r.slip_data; },
    async readMessage(id, unread) { if (CLOUD) { await api('readMessage', { id, unread }); return Ops.refresh(); } const r = Store._load().messages[id]; if (r) await Store.set('messages', id, Object.assign({}, r, { status: unread ? 'new' : 'read' })); },
    async deleteMessage(id) { if (CLOUD) { await api('deleteMessage', { id }); return Ops.refresh(); } await Store.del('messages', id); },
    async setPayInfo(en, th) { if (CLOUD) { await api('setPayInfo', { en, th }); S.payInfo = { en, th }; return; } const g = Store._load().settings.global || {}; await Store.set('settings', 'global', Object.assign({}, g, { payInfo: { en, th } })); S.payInfo = { en, th }; },
    async adminLogin(u, p) {
      if (CLOUD) { const j = await api('adminLogin', { username: u, password: p }); if (j.ok) ss.set('scAdminToken', j.token); return !!j.ok; }
      const h = await pbkdf2(u + '\u0000' + p, ADMIN.salt, ADMIN.iter); return u === ADMIN.user && h === ADMIN.hash;
    },
    async userLogin(u, p) {
      if (CLOUD) return api('login', { username: u, password: p });
      const acc = await Store.get('accounts', u);
      if (!acc || (await pbkdf2(p, acc.salt, acc.iter || USER_ITER)) !== acc.hash) return { ok: false, err: 'bad' };
      if (acc.status !== 'active') return { ok: false, err: 'suspended' };
      return { ok: true, account: await localAccount(u) };
    },
    async refresh() {
      if (!CLOUD) return;
      const j = await api('list');
      A.accounts = (j.accounts || []).map(a => Object.assign({ _id: a.username }, a));
      A.members = (j.members || []).map(m => Object.assign({ _id: m.username }, m));
      A.payments = (j.payments || []).map(p => Object.assign({ _id: p.id }, p, { amount: +p.amount }));
      A.requests = (j.requests || []).map(r => Object.assign({ _id: r.id }, r, { amount: +r.amount }));
      A.messages = (j.messages || []).map(m => Object.assign({ _id: m.id }, m));
      A.mail = !!j.mail; A.mailUsers = !!j.mailUsers; S.payInfo = j.payInfo || S.payInfo;
      ['en', 'th'].forEach(k => { const el = $('#pi-' + k); if (el && document.activeElement !== el) el.value = (S.payInfo || {})[k] || ''; });
      S.promo = !!j.proFree; S.off = j.off || {};
      if (S.view === 'admin') adminBody();
    },
    async saveUser(isNew, user, member, password) {
      if (CLOUD) { await api('saveUser', { isNew, user, member, password: password || '' }); return Ops.refresh(); }
      const old = A.accounts.find(a => a._id === user.username) || {};
      let salt = old.salt, hash = old.hash, iter = old.iter || USER_ITER;
      if (password) { salt = newSalt(); iter = USER_ITER; hash = await pbkdf2(password, salt, iter); }
      await Store.set('accounts', user.username, Object.assign({}, user, { salt, hash, iter, updated: new Date().toISOString() }));
      await Store.set('members', user.username, Object.assign({}, member, { created: (A.members.find(m => m._id === user.username) || {}).created || today() }));
    },
    async deleteUser(id) { if (CLOUD) { await api('deleteUser', { username: id }); return Ops.refresh(); } await Store.del('accounts', id); await Store.del('members', id); },
    async extend(id, days) {
      if (CLOUD) { await api('extend', { username: id, days }); return Ops.refresh(); }
      const a = A.accounts.find(x => x._id === id); if (!a) return;
      const base = a.expiry && a.expiry >= today() ? a.expiry : today();
      const upd = Object.assign({}, a); delete upd._id;
      Object.assign(upd, { plan: 'pro', status: 'active', expiry: addDays(base, days), start: a.start || today(), updated: new Date().toISOString() });
      await Store.set('accounts', id, upd);
    },
    async savePayment(id, data, ext) {
      if (CLOUD) { await api('savePayment', { id: id || null, payment: data, extend: ext }); return Ops.refresh(); }
      await Store.set('payments', id || ('pay-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)), data);
      if (ext) await Ops.extend(data.username, data.days);
    },
    async deletePayment(id) { if (CLOUD) { await api('deletePayment', { id }); return Ops.refresh(); } await Store.del('payments', id); },
    async setPromo(on) { if (CLOUD) { await api('setPromo', { on }); S.promo = on; return; } await Store.set('settings', 'global', Object.assign({}, Store._load().settings.global || {}, { proFree: on, changed: new Date().toISOString() })); S.promo = on; },
    async setFeatures(off) { if (CLOUD) { await api('setFeatures', { off }); S.off = off; return; } await Store.set('settings', 'global', Object.assign({}, Store._load().settings.global || {}, { off, changed: new Date().toISOString() })); S.off = off; },
    async reset() { if (CLOUD) { await api('reset'); return Ops.refresh(); } await Store.reset(); }
  };
  const opErr = x => x && x.code === 'auth' ? (ss.del('scAdminToken'), T('Your admin session has expired. Sign in again.', 'เซสชันผู้ดูแลหมดอายุ กรุณาเข้าสู่ระบบใหม่'))
    : x && x.msg === 'Unknown action' ? T('The server does not support this yet — the api function on Supabase needs to be redeployed.', 'เซิร์ฟเวอร์ยังไม่รองรับ — ต้องอัปเดตฟังก์ชัน api บน Supabase')
    : x && x.msg === 'Username taken' ? T('That username is already taken.', 'มีชื่อผู้ใช้นี้แล้ว')
      : T('Could not save. Check the connection and try again.', 'บันทึกไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง');
  // "Pro for free" switch set by the administrator (settings/global.proFree)
  const promoOn = () => { const g = Store._load().settings.global; return !!(g && g.proFree); };
  S.promo = CLOUD ? false : promoOn();
  S.off = CLOUD ? {} : ((Store._load().settings.global || {}).off || {});
  S.payInfo = CLOUD ? { en: '', th: '' } : ((Store._load().settings.global || {}).payInfo || { en: '', th: '' });
  if (CLOUD) api('settings').then(j => { S.payInfo = j.payInfo || S.payInfo; const offWas = JSON.stringify(S.off); S.off = j.off || {}; if (JSON.stringify(S.off) !== offWas) { if (S.view !== 'design') render(); } if (!!j.proFree !== S.promo) { S.promo = !!j.proFree; if (S.view !== 'design') render(); } else if (S.view === 'register' || S.view === 'account') render(); }).catch(() => { });
  if (!CLOUD) Store.watch('settings', () => { const was = S.promo + JSON.stringify(S.off); S.promo = promoOn(); S.off = (Store._load().settings.global || {}).off || {}; if (was !== S.promo + JSON.stringify(S.off) && S.view !== 'design') render(); });
  window.addEventListener('storage', e => { if (e.key === DBKEY) ['accounts', 'members', 'payments', 'settings'].forEach(c => Store._emit(c)); });

  // ------------------------------------------------------------------ toast
  function toast(msg, tone) {
    const t = document.createElement('div'); t.className = 'toast ' + (tone || ''); t.textContent = msg; t.setAttribute('role', 'status');
    const box = $('#toasts'); while (box.children.length >= 3) box.firstChild.remove(); box.appendChild(t); setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3700);
  }

  // ------------------------------------------------------------------ navigation
  const ANV = ['analysis', 'building', 'bridge', 'conn', 'timber', 'tdraw'];
  function go(view, patch) { Object.assign(S, patch || {}); S.view = view; S.codePop = false; S.reportOpen = false; render(); window.scrollTo(0, 0); }
  function saveSession() { ss.set('srcSession', { role: S.role, user: S.user }); }
  function logout() { S.role = 'guest'; S.user = null; ss.del('srcSession'); ss.del('scAdminToken'); ss.del('scUserToken'); A.loaded = false; go('landing'); toast(T('Signed out', 'ออกจากระบบแล้ว')); }
  // StructCap mark: simple RC section — link outline and four bars on a gradient tile
  let logoN = 0;
  function logoMark(px) {
    const id = 'lg' + (++logoN);
    return `<svg class="logo" width="${px}" height="${px}" viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF7A2B"/><stop offset=".55" stop-color="#F2387A"/><stop offset="1" stop-color="#3A6BFF"/></linearGradient></defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#${id})"/>
      <rect x="11" y="9" width="18" height="22" rx="3.5" fill="none" stroke="#fff" stroke-width="2.6"/>
      <circle cx="16" cy="14" r="2.1" fill="#fff"/><circle cx="24" cy="14" r="2.1" fill="#fff"/><circle cx="16" cy="26" r="2.1" fill="#fff"/><circle cx="24" cy="26" r="2.1" fill="#fff"/></svg>`;
  }
  const langToggle = () => `<div class="lang" role="group" aria-label="Language"><button data-act="lang" data-l="en" aria-pressed="${S.ui === 'en'}">EN</button><button data-act="lang" data-l="th" aria-pressed="${S.ui === 'th'}">ไทย</button></div>`;

  function navBar() {
    const who = S.role === 'admin' ? '<span class="chip chip-admin">Admin · ' + esc(S.user.username) + '</span>'
      : S.role === 'pro' ? '<span class="chip chip-pro">PRO · ' + esc(S.user.username) + '</span>'
        : S.role === 'free' ? (S.promo ? '<span class="chip chip-pro">PRO · ' + T('free now', 'ฟรี') + '</span>' : '<span class="chip">Free' + (S.user && S.user.member ? ' · ' + esc(S.user.username) : '') + '</span>') : '';
    return `<header class="nav"><div class="nav-in">
      <button class="brand" data-act="nav" data-v="landing" aria-label="StructCap home">${logoMark(32)}<span class="wordmark">Struct<b>Cap</b></span></button>
      <nav class="nav-links">
        <button data-act="nav" data-v="landing" aria-current="${S.view === 'landing' ? 'page' : 'false'}">⌂ ${T('Home', 'หน้าแรก')}</button>
        ${S.role !== 'guest' ? `<button data-act="nav" data-v="home" aria-current="${S.view === 'home' ? 'page' : 'false'}">${T('Main menu', 'เมนูหลัก')}</button>` : `<button data-act="scroll" data-t="plans">${T('Plans', 'แพ็กเกจ')}</button>`}
        ${S.role === 'admin' ? `<button data-act="nav" data-v="admin">${T('Admin', 'จัดการระบบ')}</button>` : ''}
      </nav>
      <div class="nav-right">${langToggle()}${who}
        ${S.role === 'guest' || (S.role === 'free' && !(S.user && S.user.member)) ? `<button class="btn btn-ghost sm" data-act="nav" data-v="login">${T('Sign in', 'เข้าสู่ระบบ')}</button><button class="btn btn-hot sm" data-act="register">${T('Register', 'สมัครสมาชิก')}</button>` : `${S.user && S.user.member ? `<button class="btn btn-ghost sm" data-act="nav" data-v="account">${T('My account', 'บัญชีของฉัน')}</button>` : ''}<button class="btn btn-ghost sm" data-act="logout">${T('Sign out', 'ออกจากระบบ')}</button>`}
      </div></div></header>`;
  }

  const COPY = '© ' + new Date().getFullYear() + ' StructCap · Developed by NS';
  const siteFoot = () => `<footer class="foot"><div class="wrap foot-in"><span>${T('StructCap is a design aid. Results must be checked by a licensed engineer.', 'StructCap เป็นเครื่องมือช่วยคำนวณ ผลลัพธ์ต้องตรวจสอบโดยวิศวกรผู้มีใบอนุญาต')}</span><span class="copy">${COPY} · ${T('All rights reserved', 'สงวนลิขสิทธิ์')}</span>${S.role === 'guest' ? `<button class="linkbtn" data-act="nav" data-v="adminLogin">${T('Administrator sign in', 'เข้าสู่ระบบผู้ดูแล')}</button>` : ''}</div></footer>`;

  // ------------------------------------------------------------------ LANDING
  // isometric 3D frame (2 × 2 bays, 3 storeys) with the bending moment on the front frame; fitted to its own view box
  function heroFrame() {
    const c = Math.cos(Math.PI / 6), sn = Math.sin(Math.PI / 6), k = 34;
    const P = (x, y, z) => [(x * 1.3 - y) * c * k, (x * 1.3 + y) * sn * k - z * k * 1.0];
    const segs = [], fills = [], dots = [], F = 2; // y = 2 is the frame nearest the viewer
    const L = (a, b, cls) => segs.push([a, b, cls]);
    [0, 1, 2].forEach(x => L(P(x, 0, 0), P(x, 2, 0), 'f-grid')); [0, 1, 2].forEach(y => L(P(0, y, 0), P(2, y, 0), 'f-grid'));
    for (let y = 0; y <= 2; y++) {
      for (let x = 0; x <= 2; x++) L(P(x, y, 0), P(x, y, 3), y === F ? 'f-mem front' : 'f-mem');
      for (let z = 1; z <= 3; z++) { for (let x = 0; x < 2; x++) L(P(x, y, z), P(x + 1, y, z), y === F ? 'f-mem front' : 'f-mem'); if (y < 2) for (let x = 0; x <= 2; x++) L(P(x, y, z), P(x, y + 1, z), 'f-mem'); }
    }
    for (let z = 1; z <= 3; z++) for (let x = 0; x < 2; x++) {
      const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14, m = 0.42 * 4 * t * (1 - t) - 0.3 * Math.pow(Math.abs(2 * t - 1), 2.2); pts.push(P(x + t, F, z - m * 0.9)); }
      fills.push([P(x, F, z)].concat(pts, [P(x + 1, F, z)]));
    }
    for (let x = 0; x <= 2; x++) for (let z = 1; z <= 3; z++) dots.push(P(x, F, z));
    const all = segs.flatMap(q => [q[0], q[1]]).concat(fills.flat()), pad = 12;
    const x0 = Math.min(...all.map(q => q[0])) - pad, x1 = Math.max(...all.map(q => q[0])) + pad + 10, y0 = Math.min(...all.map(q => q[1])) - pad, y1 = Math.max(...all.map(q => q[1])) + pad;
    const n = v => v.toFixed(1);
    let g = segs.map(([a, b2, cls]) => `<path d="M${n(a[0])} ${n(a[1])}L${n(b2[0])} ${n(b2[1])}" class="${cls}"/>`).join('');
    g += fills.map(f => `<path d="M${f.map(q => n(q[0]) + ' ' + n(q[1])).join('L')}Z" class="f-mom"/>`).join('');
    for (let y = 0; y <= 2; y++) for (let x = 0; x <= 2; x++) { const q = P(x, y, 0); g += `<path d="M${n(q[0] - 5)} ${n(q[1] + 2.5)}h10M${n(q[0] - 4)} ${n(q[1] + 2.5)}l-3 4M${n(q[0])} ${n(q[1] + 2.5)}l-3 4M${n(q[0] + 4)} ${n(q[1] + 2.5)}l-3 4" class="f-sup"/>`; }
    g += dots.map(q => `<circle cx="${n(q[0])}" cy="${n(q[1])}" r="2.3" class="f-node"/>`).join('');
    const t = P(2, F, 3);
    g += `<text x="${n(t[0] + 6)}" y="${n(t[1] - 4)}" class="f-lbl">M<tspan dy="2" font-size="7">z</tspan></text>`;
    return `<svg viewBox="${n(x0)} ${n(y0)} ${n(x1 - x0)} ${n(y1 - y0)}" class="hero-frame" role="img" aria-label="${T('3D frame with bending moment diagram', 'โครง 3 มิติพร้อมแผนภาพโมเมนต์ดัด')}">${g}</svg>`;
  }
  function heroSketch() {
    return `<svg viewBox="0 0 260 300" class="hero-svg" role="img" aria-label="Beam section with reinforcement">
      <rect x="55" y="20" width="150" height="260" rx="3" class="s-conc"/>
      <rect x="67" y="32" width="126" height="236" rx="10" class="s-link"/>
      <rect x="100" y="32" width="60" height="236" rx="8" class="s-link2"/>
      ${[80, 115, 145, 180].map(x => `<circle cx="${x}" cy="255" r="8" class="s-bb"/>`).join('')}
      ${[80, 180].map(x => `<circle cx="${x}" cy="45" r="6.5" class="s-bt"/>`).join('')}
      <circle cx="75" cy="150" r="5" class="s-bs"/><circle cx="185" cy="150" r="5" class="s-bs"/>
      <line x1="40" y1="112" x2="220" y2="112" class="s-na"/><text x="222" y="108" class="s-lbl">x</text>
      <line x1="55" y1="292" x2="205" y2="292" class="s-dim"/><text x="130" y="289" text-anchor="middle" class="s-lbl">b = 300</text>
    </svg>`;
  }
  function viewLanding() {
    const ticks = [T('RC beam design to all three codes', 'ออกแบบคาน คสล. ทั้ง 3 มาตรฐาน'), T('Section sketch with automatic bar positioning', 'ภาพหน้าตัดและตำแหน่งเหล็กอัตโนมัติ'), T('Design capacity, action and UR summary', 'สรุปกำลังออกแบบ แรงกระทำ และ UR')];
    const codes = [
      ['EU', 'blue', T('Eurocode 2', 'Eurocode 2'), 'EN 1992-1-1:2023', T('Design of concrete structures — the second-generation European standard (CEN).', 'การออกแบบโครงสร้างคอนกรีต — มาตรฐานยุโรปรุ่นที่ 2 (CEN)')],
      ['AU', 'teal', T('Australian Standard', 'มาตรฐานออสเตรเลีย'), 'AS 3600:2018', T('Concrete structures — published by Standards Australia.', 'โครงสร้างคอนกรีต — จัดทำโดย Standards Australia')],
      ['TH', 'orange', T('Thai EIT Standard', 'มาตรฐาน วสท.'), T('Strength design method', 'วิธีกำลัง'), T('The Engineering Institute of Thailand under H.M. The King’s Patronage (วสท.) — reinforced concrete strength design, in ton · cm · ksc.', 'วิศวกรรมสถานแห่งประเทศไทย ในพระบรมราชูปถัมภ์ (วสท.) — การออกแบบคอนกรีตเสริมเหล็กโดยวิธีกำลัง หน่วย ตัน · ซม. · กก./ซม.²')]
    ];
    return `${navBar()}
    <section class="hero">
      <div class="glow" aria-hidden="true"><i class="g1"></i><i class="g2"></i><i class="g3"></i><i class="g4"></i></div>
      ${S.promo ? `<div class="promo-banner"><span class="pill pro">PRO</span><b>${T('Pro is free right now.', 'ตอนนี้ใช้งาน Pro ได้ฟรี')}</b><span>${T('Every feature is unlocked for all users: columns, pile caps, full calculation reports and PDF export.', 'ทุกฟังก์ชันเปิดให้ผู้ใช้ทุกคน: เสา ฐานรากบนเสาเข็ม รายการคำนวณฉบับเต็ม และส่งออก PDF')}</span><button class="btn btn-hot sm" data-act="free">${T('Start now', 'เริ่มใช้งาน')}</button></div>` : ''}
      <div class="hero-in">
        <div class="hero-copy">
          <h1 class="mega" aria-label="StructCap">${logoMark(96).replace('class="logo"', 'class="logo mega-logo"')}<span class="mega-word">Struct<span>Cap</span></span></h1>
          <p class="tagline">${T('Structural Design and Analysis', 'ออกแบบและวิเคราะห์โครงสร้าง')}</p>
          <p class="lead">${T('Design reinforced concrete, steel and masonry members to three design codes, and analyse 3D frames and trusses — with section sketches, 3D results and full calculation reports you can export to PDF.', 'ออกแบบชิ้นส่วนคอนกรีตเสริมเหล็ก เหล็ก และงานก่อ ตามสามมาตรฐาน และวิเคราะห์โครงข้อแข็งและโครงถัก 3 มิติ — พร้อมภาพหน้าตัด ผลลัพธ์ 3 มิติ และรายการคำนวณฉบับเต็มส่งออกเป็น PDF')}</p>
          <ul class="code-list">${codes.map(c => `<li class="tone-${c[1]}"><span class="code-tag">${c[0]}</span><div><b>${c[2]}</b> <span class="mono">${c[3]}</span><p>${c[4]}</p></div></li>`).join('')}</ul>
          <div class="cta-row">${S.promo ? `
            <button class="btn btn-hot" data-act="free">${T('Pro is free — start now', 'Pro ฟรี — เริ่มใช้งานเลย')}</button>` : `
            <button class="btn btn-hot" data-act="free">${T('Start free', 'เริ่มใช้งานฟรี')}</button>
            <button class="btn btn-glass" data-act="register" data-plan="pro">${T('Register for Pro', 'สมัคร Pro')} · ${priceTxt()}</button>
            <button class="btn btn-glass" data-act="nav" data-v="login">${T('Sign in', 'เข้าสู่ระบบ')}</button>`}
          </div>
        </div>
        <div class="hero-card" aria-label="${T('Examples: RC beam design and 3D frame analysis', 'ตัวอย่าง: การออกแบบคาน คสล. และการวิเคราะห์โครง 3 มิติ')}">
          <div class="hc-sec">
            <div class="hc-head"><span>${T('Design', 'ออกแบบ')} · RC Beam · EN 1992-1-1:2023</span><span class="pill ok">PASS</span></div>
            <div class="hc-body">${heroSketch()}
              <ul class="hc-urs">
                ${[['M_Ed / M_Rd', 0.83], ['V_Ed / V_Rd', 0.38], [T('Torsion', 'แรงบิด'), 0.58], ['w_k / w_max', 0.71]].map(([l, u]) => `<li><span>${l}</span><div class="ur"><i style="width:${u * 100}%"></i></div><b>${u.toFixed(2)}</b></li>`).join('')}
              </ul></div>
            <p class="hc-note">300×600 · 4H20 + 2H16 · H10@150</p>
          </div>
          <div class="hc-sec hc-an">
            <div class="hc-head"><span>${T('Analysis', 'วิเคราะห์')} · ${T('3D frame', 'โครง 3 มิติ')} · AS/NZS 1170</span><span class="pill an">${T('SOLVED', 'คำนวณแล้ว')}</span></div>
            <div class="hc-body2">${heroFrame()}
              <dl class="hc-kv">
                ${[['M<sub>z</sub> max', '201 kNm'], ['N max', '−2 104 kN'], ['T<sub>1</sub>', '0.84 s'], ['λ<sub>cr</sub>', '35.2'], [T('Drift', 'ดริฟต์'), 'h / 1 240']].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}
              </dl></div>
            <p class="hc-note">${T('2 × 2 bays · 3 storeys · 63 elements · 1.2G + 1.5Q', '2 × 2 ช่วง · 3 ชั้น · 63 ชิ้นส่วน · 1.2G + 1.5Q')}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="band steps-band"><div class="wrap">
      <h2>${T('How it works', 'ทำงานอย่างไร')}</h2>
      <ol class="steps">
        <li><b>${T('Choose a design code', 'เลือกมาตรฐานออกแบบ')}</b><span>${T('Eurocode 2, AS 3600 or the Thai EIT standard', 'Eurocode 2, AS 3600 หรือมาตรฐาน วสท.')}</span></li>
        <li><b>${T('Choose a member and enter data', 'เลือกชิ้นส่วนและกรอกข้อมูล')}</b><span>${T('Section, materials, reinforcement and actions; bars are positioned for you', 'หน้าตัด วัสดุ เหล็กเสริม แรงกระทำ ระบบจัดตำแหน่งเหล็กให้อัตโนมัติ')}</span></li>
        <li><b>${T('Check and report', 'ตรวจสอบผลและออกรายงาน')}</b><span>${T('Capacity, action and utilisation, with a calculation report in PDF', 'กำลังออกแบบ แรงกระทำ และอัตราส่วน UR พร้อมรายการคำนวณ PDF')}</span></li>
      </ol></div></section>

    <section class="band plans-band" id="plans"><div class="wrap">
      <h2>${T('Plans', 'แพ็กเกจ')}</h2>
      <div class="plans">
        <article class="plan"><h3>Free</h3><p class="price"><b>${S.ui === 'th' ? '0 บาท' : 'USD 0'}</b></p><ul>
          ${ticks.map(t => `<li>${t}</li>`).join('')}<li class="no">${T('Full calculation report / PDF', 'รายการคำนวณฉบับเต็ม / PDF')}</li><li class="no">${T('Columns and pile caps', 'เสา และฐานรากบนเสาเข็ม')}</li></ul>
          ${S.promo ? `<p class="promo-note">${T('Pro is free — every feature is open', 'Pro ฟรี — เปิดทุกฟังก์ชัน')}</p>` : `<button class="btn btn-ghost" data-act="free">${T('Start free', 'เริ่มใช้งานฟรี')}</button><button class="linkbtn" data-act="register" data-plan="free">${T('or register a free account', 'หรือสมัครบัญชี Free')}</button>`}</article>
        <article class="plan plan-pro"><span class="ribbon">${T('Recommended', 'แนะนำ')}</span><h3>Pro</h3><p class="price">${S.promo ? `<s>${priceTxt()}</s> <b>${T('Free now', 'ฟรีตอนนี้')}</b>` : `<b>${money(PRICE[curOf()], curOf())}</b> / ${T('month', 'เดือน')}`}</p><ul>
          <li>${T('Everything in Free', 'ทุกอย่างใน Free')}</li><li>${T('RC columns: N–M and N–Mx–My interaction', 'เสา คสล. แผนภาพ N–M และ N–Mx–My')}</li><li>${T('Pile caps: beam method and STM', 'ฐานรากบนเสาเข็ม วิธีคาน และ STM')}</li><li>${T('Steel sign gantry to AS 4100, including fatigue', 'โครงป้ายจราจรเหล็กตาม AS 4100 รวมความล้า')}</li><li>${T('3D pile cap strut-and-tie and limestone block walls (AS)', 'STM ฐานรากเข็ม 3 มิติ และกำแพงกันดินก้อนหินปูน (AS)')}</li><li>${T('Full calculation report with clause references', 'รายการคำนวณฉบับเต็ม อ้างอิงข้อกำหนด')}</li><li>${T('PDF export', 'ส่งออกรายงานเป็น PDF')}</li></ul>
          ${S.promo ? `<button class="btn btn-hot" data-act="free">${T('Pro is free — start now', 'Pro ฟรี — เริ่มใช้งานเลย')}</button>` : `<button class="btn btn-hot" data-act="register" data-plan="pro">${T('Register for Pro', 'สมัคร Pro')}</button><p class="muted small">${T('Pay by transfer and attach the slip — Pro is switched on within 2 hours.', 'ชำระเงินโดยการโอนและแนบสลิป — เปิดใช้ Pro ภายใน 2 ชั่วโมง')}</p>`}</article>
      </div></div></section>

    <section class="band contact-band" id="contact"><div class="wrap contact-in">
      <div><h2>${T('Contact us & feedback', 'ติดต่อเราและข้อเสนอแนะ')}</h2><p class="muted">${T('Questions about Pro, a calculation, or an idea for a new designer? Write to us — it goes straight to the StructCap team.', 'มีคำถามเกี่ยวกับ Pro การคำนวณ หรือมีไอเดียฟังก์ชันใหม่? เขียนถึงเรา ข้อความจะส่งถึงทีม StructCap โดยตรง')}</p>
        <ul class="contact-pts"><li>${T('We reply by email within 2 hours.', 'เราจะตอบกลับทางอีเมลภายใน 2 ชั่วโมง')}</li><li>${T('Found a wrong result? Include the code, member and inputs.', 'พบผลลัพธ์ผิด? ระบุมาตรฐาน ชิ้นส่วน และข้อมูลที่กรอก')}</li></ul></div>
      <form class="contact-card" id="contactForm" novalidate>
        <div class="seg" role="group" aria-label="${T('Message type', 'ประเภทข้อความ')}"><button type="button" data-act="ckind" data-k="contact" aria-pressed="${S.ckind !== 'feedback'}">${T('Contact', 'ติดต่อ')}</button><button type="button" data-act="ckind" data-k="feedback" aria-pressed="${S.ckind === 'feedback'}">${T('Feedback', 'ข้อเสนอแนะ')}</button></div>
        <div class="mgrid"><label>${T('Name', 'ชื่อ')}<input id="c-name" autocomplete="name" value="${esc(S.user && S.user.member ? S.user.name || '' : '')}"></label><label>${T('Email (for our reply)', 'อีเมล (สำหรับตอบกลับ)')}<input id="c-email" type="email" autocomplete="email" value="${esc(S.user && S.user.member ? S.user.email || '' : '')}"></label></div>
        <label>${T('Message', 'ข้อความ')}<textarea id="c-msg" rows="5" maxlength="5000" required placeholder="${S.ckind === 'feedback' ? T('What works well, what should change, what should we add?', 'อะไรดี อะไรควรปรับ หรือควรเพิ่มอะไร?') : T('How can we help?', 'ให้เราช่วยอะไร?')}"></textarea></label>
        <input id="c-web" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <p class="form-err" id="c-err" hidden></p>
        <button class="btn btn-hot" type="submit" id="c-btn">${T('Send', 'ส่งข้อความ')}</button></form>
    </div></section>

    ${siteFoot()}`;
  }

  // ------------------------------------------------------------------ LOGIN
  function viewLogin(admin) {
    return `${navBar()}<section class="auth-wrap"><div class="glow soft" aria-hidden="true"><i class="g1"></i><i class="g3"></i></div>
      <form class="auth-card" id="loginForm" data-admin="${admin ? 1 : 0}" novalidate>
        <p class="eyebrow">${admin ? 'Administrator' : T('Members', 'สมาชิก')}</p>
        <h1>${admin ? T('Administrator sign in', 'เข้าสู่ระบบผู้ดูแล') : T('Sign in', 'เข้าสู่ระบบ')}</h1>
        <p class="muted">${admin ? T('Manage users, passwords, subscription periods and payments.', 'จัดการผู้ใช้ รหัสผ่าน อายุการใช้งาน และการชำระเงิน') : T('Free and Pro members sign in with their email address and password.', 'สมาชิก Free และ Pro เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน')}</p>
        <label for="lg-user">${admin ? T('Username', 'ชื่อผู้ใช้') : T('Email', 'อีเมล')}</label><input id="lg-user" ${admin ? '' : 'type="email" inputmode="email" placeholder="name@example.com"'} autocomplete="username" required>
        <label for="lg-pass">${T('Password', 'รหัสผ่าน')}</label><input id="lg-pass" type="password" autocomplete="current-password" required>
        <p class="form-err" id="lg-err" hidden></p>
        <button class="btn btn-hot wide" type="submit" id="lg-btn">${T('Sign in', 'เข้าสู่ระบบ')}</button>
        ${admin ? `<p class="muted small"><button type="button" class="linkbtn" data-act="nav" data-v="login">${T('Pro member sign in', 'เข้าสู่ระบบสมาชิก Pro')}</button></p>` : `<div class="auth-alt"><span>${T('No account yet?', 'ยังไม่มีบัญชี?')}</span><button type="button" class="btn btn-glass wide" data-act="register">${T('Register — Free or Pro', 'สมัครสมาชิก — Free หรือ Pro')}</button></div><p class="muted small"><button type="button" class="linkbtn" data-act="free">${T('Continue without an account', 'ใช้งานโดยไม่สมัคร')}</button> · <button type="button" class="linkbtn" data-act="nav" data-v="adminLogin">${T('Administrator', 'ผู้ดูแลระบบ')}</button></p>`}
      </form></section>`;
  }
  async function doLogin(form) {
    const admin = form.dataset.admin === '1', u = $('#lg-user').value.trim(), p = $('#lg-pass').value, err = $('#lg-err'), btn = $('#lg-btn');
    err.hidden = true; btn.disabled = true; btn.textContent = T('Checking…', 'กำลังตรวจสอบ…');
    const fail = m => { err.textContent = m; err.hidden = false; btn.disabled = false; btn.textContent = T('Sign in', 'เข้าสู่ระบบ'); };
    const bad = admin ? T('Username or password is incorrect.', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง') : T('Email or password is incorrect.', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    try {
      if (admin) {
        if (!(await Ops.adminLogin(u, p))) return fail(bad);
        S.role = 'admin'; S.user = { username: u, name: 'Administrator' }; saveSession(); go('admin'); toast(T('Welcome, administrator', 'ยินดีต้อนรับ ผู้ดูแลระบบ'), 'ok'); return;
      }
      const id = u.includes('@') ? u.toLowerCase() : u;
      if (!EMAIL_ID.test(id) && !/^[A-Za-z0-9_.-]{3,32}$/.test(id)) return fail(T('Enter the email address you registered with.', 'กรอกอีเมลที่ใช้สมัครสมาชิก'));
      const res = await Ops.userLogin(id, p);
      if (!res.ok) {
        if (res.err === 'suspended') return fail(T('This account is suspended. Contact the administrator.', 'บัญชีนี้ถูกระงับ กรุณาติดต่อผู้ดูแลระบบ'));
        return fail(bad);
      }
      const acc = res.account;
      setUser(acc, res.token);
      go('home'); toast(T('Signed in', 'เข้าสู่ระบบแล้ว') + (acc.plan === 'pro' ? ' · Pro ' + T('until ', 'ถึง ') + acc.expiry : ''), 'ok');
      if (acc.expired) toast(T('Your Pro plan ended on ' + acc.expired + '. Renew it from My account.', 'แพ็กเกจ Pro หมดอายุเมื่อ ' + acc.expired + ' ต่ออายุได้ที่ บัญชีของฉัน'), 'bad');
    } catch (e) { fail(T('Sign-in check failed. Try again.', 'ตรวจสอบไม่สำเร็จ ลองอีกครั้ง')); }
  }

  // ------------------------------------------------------------------ REGISTER / PRO APPLICATION / MEMBER PAGE
  const PAY_METHODS = [['bank', 'Bank transfer', 'โอนผ่านธนาคาร'], ['promptpay', 'PromptPay', 'พร้อมเพย์'], ['paypal', 'PayPal', 'PayPal'], ['other', 'Other', 'อื่น ๆ']];
  // Pro payment fields, shared by the register page and the member page
  function proFields(pre) {
    const cur = S.payCur || curOf(), mo = S.payMonths || 1, info = (S.payInfo && (S.ui === 'th' ? S.payInfo.th || S.payInfo.en : S.payInfo.en || S.payInfo.th)) || '';
    return `<div class="pro-box">
      <div class="pro-price"><b>${money(PRICE[cur], cur)}</b> / ${T('month', 'เดือน')}<span class="seg sm" role="group" aria-label="${T('Currency', 'สกุลเงิน')}"><button type="button" data-act="paycur" data-c="USD" aria-pressed="${cur === 'USD'}">USD</button><button type="button" data-act="paycur" data-c="THB" aria-pressed="${cur === 'THB'}">THB</button></span></div>
      <div class="mgrid">
        <label>${T('Period', 'ระยะเวลา')}<select id="${pre}-months">${[1, 3, 6, 12].map(m => `<option value="${m}" ${mo === m ? 'selected' : ''}>${m} ${T(m > 1 ? 'months' : 'month', 'เดือน')}</option>`).join('')}</select></label>
        <div class="pro-total"><span>${T('Amount to pay', 'ยอดที่ต้องชำระ')}</span><b id="${pre}-total">${money(Math.round(PRICE[cur] * mo * 100) / 100, cur)}</b></div>
        <label>${T('Paid by', 'ชำระโดย')}<select id="${pre}-method">${PAY_METHODS.map(m => `<option value="${m[0]}">${T(m[1], m[2])}</option>`).join('')}</select></label>
        <label>${T('Transfer reference (optional)', 'เลขอ้างอิงการโอน (ถ้ามี)')}<input id="${pre}-ref" maxlength="120"></label>
      </div>
      <div class="pay-info"><b>${T('How to pay', 'วิธีชำระเงิน')}</b><p>${info ? esc(info).replace(/\n/g, '<br>') : T('Payment details are sent by the administrator — contact us below the plans on the welcome page if you do not have them yet.', 'ผู้ดูแลระบบจะแจ้งรายละเอียดการชำระเงิน หากยังไม่ได้รับ ติดต่อเราได้ที่หน้าแรก')}</p></div>
      <label class="file-l">${T('Payment slip (image or PDF, max 5 MB)', 'สลิปการชำระเงิน (รูปภาพหรือ PDF ไม่เกิน 5 MB)')}<input id="${pre}-slip" type="file" accept="image/png,image/jpeg,image/webp,image/heic,application/pdf" required></label>
      <p class="muted small">${T('The administrator checks the payment and switches Pro on within 2 hours, and you get an email when it is on. You can use the Free features meanwhile.', 'ผู้ดูแลระบบจะตรวจสอบการชำระเงินและเปิด Pro ภายใน 2 ชั่วโมง และแจ้งทางอีเมลเมื่อเปิดใช้แล้ว ระหว่างนี้ใช้งานฟังก์ชัน Free ได้')}</p></div>`;
  }
  async function readPro(pre) {
    const fl = $('#' + pre + '-slip').files[0];
    if (!fl) throw new Error(T('Attach the payment slip.', 'แนบสลิปการชำระเงิน'));
    if (fl.size > 5 * 1024 * 1024) throw new Error(T('The slip file is larger than 5 MB.', 'ไฟล์สลิปใหญ่เกิน 5 MB'));
    if (!/^(image\/(png|jpeg|webp|heic)|application\/pdf)$/.test(fl.type)) throw new Error(T('Use a PNG, JPG, WEBP, HEIC or PDF file.', 'ใช้ไฟล์ PNG, JPG, WEBP, HEIC หรือ PDF'));
    return { months: +$('#' + pre + '-months').value, currency: S.payCur || curOf(), method: $('#' + pre + '-method').value, ref: $('#' + pre + '-ref').value.trim(), slip: { name: fl.name, type: fl.type, data: await fileToData(fl) } };
  }
  function viewRegister() {
    const pro = S.regPlan === 'pro';
    return `${navBar()}<section class="auth-wrap"><div class="glow soft" aria-hidden="true"><i class="g1"></i><i class="g3"></i></div>
      <form class="auth-card reg-card" id="regForm" novalidate>
        <p class="eyebrow">${T('New member', 'สมาชิกใหม่')}</p><h1>${T('Register', 'สมัครสมาชิก')}</h1>
        <div class="plan-pick" role="radiogroup" aria-label="${T('Plan', 'แพ็กเกจ')}">
          <button type="button" role="radio" aria-checked="${!pro}" data-act="regplan" data-p="free"><b>Free</b><span>${S.ui === 'th' ? '0 บาท' : 'USD 0'}</span><small>${T('RC beams, all codes', 'คาน คสล. ทุกมาตรฐาน')}</small></button>
          <button type="button" role="radio" aria-checked="${pro}" data-act="regplan" data-p="pro"><b>Pro</b><span>${priceTxt()}</span><small>${T('Every designer, full reports, PDF', 'ทุกฟังก์ชัน รายการคำนวณฉบับเต็ม PDF')}</small></button></div>
        <div class="mgrid">
          <label class="full">${T('Email — you sign in with this', 'อีเมล — ใช้สำหรับเข้าสู่ระบบ')} *<input id="r-email" type="email" autocomplete="email" required maxlength="254" placeholder="name@example.com"></label>
          <label>${T('Password (min. 8 characters)', 'รหัสผ่าน (อย่างน้อย 8 ตัว)')} *<input id="r-pass" type="password" autocomplete="new-password" required minlength="8"></label>
          <label>${T('Confirm password', 'ยืนยันรหัสผ่าน')} *<input id="r-pass2" type="password" autocomplete="new-password" required minlength="8"></label>
        </div>
        <p class="muted small">${T('We send a confirmation to this email.', 'เราจะส่งอีเมลยืนยันไปยังอีเมลนี้')}</p>
        ${pro ? proFields('rp') : ''}
        ${pro ? `<label>${T('Note to the administrator (optional)', 'ข้อความถึงผู้ดูแลระบบ (ถ้ามี)')}<input id="r-note" maxlength="500"></label>` : ''}
        <input id="r-web" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <label class="chkl"><input id="r-ok" type="checkbox"> ${T('I understand StructCap is a design aid and results must be checked by a licensed engineer.', 'ข้าพเจ้าเข้าใจว่า StructCap เป็นเครื่องมือช่วยออกแบบ ผลลัพธ์ต้องตรวจสอบโดยวิศวกรผู้มีใบอนุญาต')}</label>
        <p class="form-err" id="r-err" hidden></p>
        <button class="btn btn-hot wide" type="submit" id="r-btn">${pro ? T('Register and send the slip', 'สมัครและส่งสลิป') : T('Create free account', 'สร้างบัญชี Free')}</button>
        <p class="muted small">${T('Already a member?', 'เป็นสมาชิกแล้ว?')} <button type="button" class="linkbtn" data-act="nav" data-v="login">${T('Sign in', 'เข้าสู่ระบบ')}</button></p>
      </form></section>`;
  }
  async function doRegister() {
    const v = id => $('#' + id).value.trim(), err = $('#r-err'), btn = $('#r-btn'), label = btn.textContent;
    const fail = m => { err.textContent = m; err.hidden = false; btn.disabled = false; btn.textContent = label; err.scrollIntoView({ block: 'nearest' }); };
    err.hidden = true;
    const email = v('r-email').toLowerCase(), note = $('#r-note') ? v('r-note') : '';
    const form = { email, username: email, note, password: $('#r-pass').value, plan: S.regPlan === 'pro' ? 'pro' : 'free', website: v('r-web'), lang: S.ui };
    if (!EMAIL_ID.test(form.email)) return fail(T('Enter a valid email address.', 'กรอกอีเมลให้ถูกต้อง'));
    if (form.password.length < 8) return fail(T('The password must be at least 8 characters.', 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร'));
    if (form.password !== $('#r-pass2').value) return fail(T('The passwords do not match.', 'รหัสผ่านไม่ตรงกัน'));
    if (!$('#r-ok').checked) return fail(T('Tick the box to confirm.', 'กรุณาทำเครื่องหมายยืนยัน'));
    btn.disabled = true; btn.textContent = T('Sending…', 'กำลังส่ง…');
    try {
      if (form.plan === 'pro') form.pro = await readPro('rp');
    } catch (x) { return fail(x.message); }
    try {
      const j = await Ops.register(form);
      if (!j.account) return fail(T('Registration failed. Try again.', 'สมัครไม่สำเร็จ ลองอีกครั้ง'));
      setUser(j.account, j.token);
      S.notice = form.plan === 'pro' ? (j.request ? 'proSent' : 'proFail') : 'freeOk';
      S.mailed = !!j.emailedUser;
      go('account');
      toast(T('Welcome to StructCap', 'ยินดีต้อนรับสู่ StructCap'), 'ok');
    } catch (x) {
      fail(x.msg === 'Username taken' || x.msg === 'Email taken' ? T('This email is already registered — sign in instead.', 'อีเมลนี้สมัครไว้แล้ว — กรุณาเข้าสู่ระบบ') : x.msg === 'Invalid email' ? T('Enter a valid email address.', 'กรอกอีเมลให้ถูกต้อง') : T('Registration failed. Check the connection and try again.', 'สมัครไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง'));
    }
  }
  const daysTo = d => Math.ceil((new Date(d + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 864e5);
  const RQS = { pending: ['Waiting for review', 'รอตรวจสอบ', 'warn'], approved: ['Approved', 'อนุมัติแล้ว', 'ok'], rejected: ['Not approved', 'ไม่อนุมัติ', 'bad'] };
  function viewAccount() {
    const u = S.user;
    if (!u || !u.member) return viewLogin(false);
    const pro = u.plan === 'pro', dl = pro && u.expiry ? daysTo(u.expiry) : null, pend = (u.requests || []).filter(r => r.status === 'pending');
    const pct = dl !== null ? Math.max(0, Math.min(100, dl / 30 * 100)) : 0;
    const sent = S.mailed ? T(' A confirmation has been emailed to ' + u.username + '.', ' ส่งอีเมลยืนยันไปที่ ' + u.username + ' แล้ว') : '';
    const notice = { freeOk: ['ok', T('Registration complete — your free account is ready. Sign in any time with your email and password.', 'สมัครสมาชิกเรียบร้อย — บัญชี Free พร้อมใช้งาน เข้าสู่ระบบได้ทุกเมื่อด้วยอีเมลและรหัสผ่าน') + sent], proSent: ['ok', T('Thank you — your registration and payment slip were received. Pro will be switched on within 2 hours and you will get an email when it is on.', 'ขอบคุณ — ได้รับข้อมูลการสมัครและสลิปแล้ว จะเปิดใช้ Pro ภายใน 2 ชั่วโมง และแจ้งทางอีเมลเมื่อเปิดใช้แล้ว') + sent], proFail: ['bad', T('Your account was created, but the slip did not upload. Send it again with “Apply for Pro” below.', 'สร้างบัญชีแล้ว แต่ส่งสลิปไม่สำเร็จ กรุณาส่งอีกครั้งด้วยปุ่ม “สมัคร Pro” ด้านล่าง')], applied: ['ok', T('Payment slip received. Pro will be switched on within 2 hours and you will get an email when it is on.', 'ได้รับสลิปแล้ว จะเปิดใช้ Pro ภายใน 2 ชั่วโมง และแจ้งทางอีเมลเมื่อเปิดใช้แล้ว') + sent] }[S.notice];
    return `${navBar()}<main class="wrap page account">
      <div class="page-head"><div><p class="eyebrow">${T('My account', 'บัญชีของฉัน')}</p><h1>${esc(u.username)}</h1></div>
        <div class="dz-actions"><button class="btn btn-hot sm" data-act="nav" data-v="home">${T('Open designers', 'ไปหน้าออกแบบ')} →</button></div></div>
      ${notice ? `<p class="notice ${notice[0]}">${notice[1]}</p>` : ''}
      <div class="acc-grid">
        <section class="card plan-card ${pro ? 'is-pro' : ''}"><h2 class="card-h">${T('Plan', 'แพ็กเกจ')}</h2>
          <div class="plan-now"><span class="pill ${pro ? 'pro' : 'free'}">${pro ? 'PRO' : 'FREE'}</span><b>${pro ? T('Pro member', 'สมาชิก Pro') : T('Free version', 'เวอร์ชันฟรี')}</b></div>
          ${pro ? `<div class="remain"><b class="mono">${Math.max(0, dl)}</b><span>${T('days remaining', 'วันคงเหลือ')}</span></div><div class="ur big"><i style="width:${pct}%"></i></div><p class="muted">${T('Pro until ', 'ใช้งาน Pro ถึง ')}<b>${esc(u.expiry)}</b>${dl <= 7 ? ' · ' + T('renew soon to keep Pro', 'ควรต่ออายุเร็ว ๆ นี้') : ''}</p>`
            : `<p class="muted">${u.expired ? T('Your Pro plan ended on ', 'แพ็กเกจ Pro หมดอายุเมื่อ ') + esc(u.expired) + '. ' : ''}${S.promo ? T('Pro is free for everyone right now.', 'ตอนนี้ทุกคนใช้งาน Pro ได้ฟรี') : T('Free covers RC beams to all three codes. Pro unlocks every designer, full calculation reports and PDF export for ', 'Free ใช้ออกแบบคาน คสล. ได้ทุกมาตรฐาน Pro เปิดทุกฟังก์ชัน รายการคำนวณฉบับเต็ม และ PDF ในราคา ') + priceTxt() + '.'}</p>`}
          ${pend.length ? `<p class="notice warn">${T('Pro application waiting for review', 'คำขอ Pro รอการตรวจสอบ')}: ${pend.map(r => r.months + ' ' + T('month(s)', 'เดือน') + ', ' + money(r.amount, r.currency)).join(' · ')}</p>` : ''}
          ${S.applyOpen ? `<form id="applyForm" novalidate><h3>${pro ? T('Renew Pro', 'ต่ออายุ Pro') : T('Apply for Pro', 'สมัคร Pro')}</h3>${proFields('ap')}<p class="form-err" id="ap-err" hidden></p><div class="mfoot"><span class="grow"></span><button type="button" class="btn btn-ghost sm" data-act="applyClose">${T('Cancel', 'ยกเลิก')}</button><button class="btn btn-hot sm" type="submit" id="ap-btn">${T('Send slip', 'ส่งสลิป')}</button></div></form>`
            : `<button class="btn btn-hot" data-act="applyOpen">${pro ? T('Renew / extend Pro', 'ต่ออายุ Pro') : T('Register for Pro', 'สมัคร Pro')} · ${priceTxt()}</button>`}
          ${(u.requests || []).length ? `<h3>${T('Applications', 'ประวัติคำขอ')}</h3><table class="chk mini"><tbody>${u.requests.map(r => { const st = RQS[r.status] || [r.status, r.status, '']; return `<tr><td class="mono">${esc((r.created || '').slice(0, 10))}</td><td>${r.months} ${T('mo', 'ด.')}</td><td class="num mono">${money(r.amount, r.currency)}</td><td><span class="pill st-${st[2]}">${T(st[0], st[1])}</span></td></tr>`; }).join('')}</tbody></table>` : ''}
        </section>
        <section class="card"><h2 class="card-h">${T('Sign-in', 'การเข้าสู่ระบบ')}</h2>
          <div class="mgrid"><label class="full">${T('Email', 'อีเมล')}<input value="${esc(u.username)}" disabled></label></div>
          <h2 class="card-h">${T('Change password', 'เปลี่ยนรหัสผ่าน')}</h2>
          <form id="pwForm" class="mgrid" novalidate>
            <label class="full">${T('Current password', 'รหัสผ่านปัจจุบัน')}<input id="pw-old" type="password" autocomplete="current-password"></label>
            <label>${T('New password (min. 8)', 'รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)')}<input id="pw-new" type="password" autocomplete="new-password" minlength="8"></label>
            <label>${T('Confirm new password', 'ยืนยันรหัสผ่านใหม่')}<input id="pw-new2" type="password" autocomplete="new-password" minlength="8"></label>
            <p class="form-err full" id="pw-err" hidden></p>
            <div class="mfoot full"><span class="grow"></span><button class="btn btn-ghost sm" type="submit" id="pw-btn">${T('Change password', 'เปลี่ยนรหัสผ่าน')}</button></div></form>
        </section>
      </div></main>`;
  }
  async function refreshMe(silent) {
    if (!S.user || !S.user.member) return;
    try { const acc = await Ops.me(); if (acc) { setUser(acc); if (S.view === 'account' || (!silent && S.view !== 'design')) render(); } }
    catch (x) { if (x && x.code === 'auth') { toast(T('Your session has expired. Sign in again.', 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'), 'bad'); logout(); } }
  }
  async function doApply() {
    const err = $('#ap-err'), btn = $('#ap-btn'), fail = m => { err.textContent = m; err.hidden = false; btn.disabled = false; btn.textContent = T('Send slip', 'ส่งสลิป'); };
    err.hidden = true; btn.disabled = true; btn.textContent = T('Sending…', 'กำลังส่ง…');
    let pro; try { pro = await readPro('ap'); } catch (x) { return fail(x.message); }
    try { const j = await Ops.applyPro(pro); if (j.account) setUser(j.account); S.applyOpen = false; S.notice = 'applied'; S.mailed = !!j.emailedUser; render(); toast(T('Application sent', 'ส่งคำขอแล้ว'), 'ok'); }
    catch (x) { fail(x.msg === 'Too many pending applications' ? T('You already have applications waiting for review.', 'มีคำขอที่รอตรวจสอบอยู่แล้ว') : T('Could not send. Check the connection and try again.', 'ส่งไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง')); }
  }
  async function doPassword() {
    const err = $('#pw-err'), fail = m => { err.textContent = m; err.hidden = false; };
    const o = $('#pw-old').value, n = $('#pw-new').value;
    if (n.length < 8) return fail(T('The new password must be at least 8 characters.', 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร'));
    if (n !== $('#pw-new2').value) return fail(T('The new passwords do not match.', 'รหัสผ่านใหม่ไม่ตรงกัน'));
    try { const j = await Ops.changePassword(o, n); if (!j.ok) return fail(T('The current password is incorrect.', 'รหัสผ่านปัจจุบันไม่ถูกต้อง')); ['pw-old', 'pw-new', 'pw-new2'].forEach(id => { $('#' + id).value = ''; }); err.hidden = true; toast(T('Password changed', 'เปลี่ยนรหัสผ่านแล้ว'), 'ok'); }
    catch (x) { fail(T('Could not change the password. Try again.', 'เปลี่ยนรหัสผ่านไม่สำเร็จ ลองอีกครั้ง')); }
  }
  async function doContact() {
    const v = id => $('#' + id).value.trim(), err = $('#c-err'), btn = $('#c-btn'), fail = m => { err.textContent = m; err.hidden = false; btn.disabled = false; btn.textContent = T('Send', 'ส่งข้อความ'); };
    const m = { kind: S.ckind === 'feedback' ? 'feedback' : 'contact', name: v('c-name'), email: v('c-email'), message: v('c-msg'), website: v('c-web') };
    err.hidden = true;
    if (m.message.length < 2) return fail(T('Write a message first.', 'กรุณาเขียนข้อความ'));
    if (m.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.email)) return fail(T('Enter a valid email address, or leave it blank.', 'กรอกอีเมลให้ถูกต้อง หรือเว้นว่าง'));
    if (m.kind === 'contact' && !m.email) return fail(T('Add your email so we can reply.', 'กรอกอีเมลเพื่อให้เราตอบกลับ'));
    btn.disabled = true; btn.textContent = T('Sending…', 'กำลังส่ง…');
    try { await Ops.contact(m); $('#c-msg').value = ''; btn.disabled = false; btn.textContent = T('Send', 'ส่งข้อความ'); toast(m.kind === 'feedback' ? T('Thank you for the feedback!', 'ขอบคุณสำหรับข้อเสนอแนะ!') : T('Message sent — we will reply by email.', 'ส่งข้อความแล้ว — เราจะตอบกลับทางอีเมล'), 'ok'); }
    catch (x) { fail(T('Could not send. Check the connection and try again.', 'ส่งไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง')); }
  }

  // ------------------------------------------------------------------ HOME (step 1 code, step 2 member)
  function viewHome() {
    const days = S.user && S.user.expiry ? Math.ceil((new Date(S.user.expiry) - new Date(today())) / 864e5) : null;
    const plan = S.promo && S.role !== 'admin' ? T('Pro is free right now · all features unlocked', 'ตอนนี้ใช้งาน Pro ได้ฟรี · เปิดทุกฟังก์ชัน') : S.role === 'pro' ? T('Pro plan', 'แพ็กเกจ Pro') + (days !== null ? T(` · ${days} days left (until ${S.user.expiry})`, ` · เหลือ ${days} วัน (ถึง ${S.user.expiry})`) : '')
      : S.role === 'admin' ? T('Administrator · all features', 'ผู้ดูแลระบบ · เข้าถึงทุกฟังก์ชัน') : T('Free plan · RC beams to all codes', 'แพ็กเกจ Free · ออกแบบคาน คสล. ได้ทุกมาตรฐาน');
    const sel = S.codeSel;
    return `${navBar()}<main class="wrap page menu">
      <div class="page-head"><div><p class="eyebrow">StructCap</p><h1>${T('Main menu', 'เมนูหลัก')}</h1><p class="muted">${S.user ? esc(S.user.name || S.user.username) + ' · ' : ''}${plan}</p></div></div>
      <section class="menu-box box-design">
        <div class="menu-hd"><span class="menu-n">1</span><div><p class="eyebrow">${T('Structural design', 'ออกแบบโครงสร้าง')}</p><h2>${T('Select a design code', 'เลือกมาตรฐานการออกแบบ')}</h2><p class="muted">${T('RC beams, columns and pile caps, 3D strut-and-tie, steel sign gantries, limestone block walls, concrete and steel bridge barriers — with calculation reports.', 'คาน เสา ฐานรากบนเสาเข็ม คสล. strut-and-tie 3 มิติ โครงป้ายเหล็ก กำแพงหินบล็อก ราวกันตกคอนกรีตและเหล็ก — พร้อมรายการคำนวณ')}</p></div></div>
        <div class="pick-grid">${Object.keys(CODES).map(k => `<button class="pick code-pick tone-${CODES[k].tone} ${sel === k ? 'on' : ''}" data-act="code" data-c="${k}" aria-pressed="${sel === k}">
          <span class="code-top"><span class="pick-t">${cName(k)}</span><span class="code-big" aria-hidden="true">${CODES[k].tag}</span></span><span class="mono">${cStd(k)}</span><span class="pick-s">${cSub(k)}</span>
          <span class="pick-go">${sel === k ? T('Selected ✓', 'เลือกแล้ว ✓') : T('Select →', 'เลือก →')}</span></button>`).join('')}</div>
      </section>
      ${sel && S.codePop ? `<div class="modal-bg pop" data-act="closePop"><div class="modal elem-pop tone-${CODES[sel].tone}" role="dialog" aria-modal="true" aria-labelledby="popT">
        <div class="pop-head"><span class="code-big">${CODES[sel].tag}</span><div><p class="eyebrow">${cName(sel)} · ${cStd(sel)}</p><h2 id="popT">${T('What are you designing?', 'เลือกชิ้นส่วนที่ต้องการออกแบบ')}</h2></div><button class="icon-btn pop-x" data-act="closePop" aria-label="${T('Close', 'ปิด')}">×</button></div>
        <div class="pop-grid">${Object.entries(ELEMS).filter(([k, e]) => !e.codes || e.codes.includes(sel)).map(([k, e]) => {
        const off = isOff(k), locked = off || (!e.free && !isPro());
        return `<button class="pick elem ${locked ? 'locked' : ''} ${off ? 'feat-off' : ''}" data-act="elem" data-e="${k}">
            ${elemIcon(k)}<span class="pick-t">${T(e.en, e.th)} <span class="pill ${e.free || S.promo ? 'free' : 'pro'}">${e.free ? 'Free' : S.promo ? T('Pro · free now', 'Pro · ฟรี') : 'Pro'}</span>${offPill(k)}</span><span class="pick-s">${T(e.den, e.dth)}</span>
            <span class="pick-go">${off ? T('Unavailable for now', 'ปิดใช้งานชั่วคราว') : locked ? T('Sign in with Pro to unlock', 'เข้าสู่ระบบ Pro เพื่อใช้งาน') : T('Open designer →', 'เปิดหน้าออกแบบ →')}</span></button>`;
      }).join('')}</div></div></div>` : ''}
      <section class="menu-box box-analysis">
        <div class="menu-hd"><span class="menu-n">2</span><div><p class="eyebrow">${T('Structural analysis', 'วิเคราะห์โครงสร้าง')}</p><h2>${T('3D analysis — frames, buildings, bridges and steel connections', 'วิเคราะห์ 3 มิติ — โครงข้อแข็ง อาคาร สะพาน และรอยต่อเหล็ก')}</h2><p class="muted">${T('Four apps on finite-element engines, each with a ribbon, model tree, 3D view, design to AS, Eurocode or Thai EIT / AISC, and a calculation report.', 'สี่แอปบนเครื่องคำนวณไฟไนต์เอลิเมนต์ มีริบบอน ผังแบบจำลอง มุมมอง 3 มิติ การออกแบบตาม AS, Eurocode หรือ วสท. / AISC และรายงานการคำนวณ')}</p></div></div>
        <div class="an-apps">${[
          ['analysis', analysisIcon(), T('3D frame & truss', 'โครงข้อแข็งและโครงถัก 3 มิติ'), T('Any frame, truss or grillage: nodes and elements, supports, releases, loads and combinations.', 'โครงข้อแข็ง โครงถัก หรือกริลเลจ: จุดต่อ ชิ้นส่วน จุดรองรับ การปลดแรง น้ำหนัก และการรวมน้ำหนัก'), [T('Linear static', 'สถิตเชิงเส้น'), 'P-Delta', T('Modal', 'โหมด'), T('Buckling', 'การโก่งเดาะ'), T('Results → RC design', 'ผล → ออกแบบ RC')]],
          ['building', buildingIcon(), T('Building design', 'อาคาร'), T('Grid lines and stories, draw columns, beams and slabs on plan, floor loads by tributary area, automatic wind, story drift.', 'เส้นกริดและชั้น วาดเสา คาน แผ่นพื้นบนแปลน น้ำหนักบนพื้นตามพื้นที่รับ แรงลมอัตโนมัติ ดริฟต์รายชั้น'), [T('Grids & stories', 'กริดและชั้น'), T('Floor loads', 'น้ำหนักบนพื้น'), T('Wind AS · EN · DPT 1311-50', 'ลม AS · EN · มยผ. 1311-50'), T('Rigid diaphragm', 'ไดอะแฟรมแข็ง'), T('Story drift', 'ดริฟต์')]],
          ['bridge', bridgeIcon(), T('Bridge', 'สะพาน'), T('Girder decks, box girders, truss, arch and cable-stayed bridges under moving traffic loads.', 'สะพานคาน คานกล่อง โครงถัก โค้ง และขึงเคเบิล ภายใต้น้ำหนักจราจรเคลื่อนที่'), ['AS 5100 · EN 1991-2 · HL-93', T('Influence lines', 'เส้นอิทธิพล'), T('Construction stages', 'ขั้นตอนก่อสร้าง'), T('Prestress', 'แรงอัดล่วงหน้า')]],
          ['conn', connIcon(), T('Steel connections', 'รอยต่อเหล็ก'), T('Bolted and welded joints: end plates, fin plates, cleats, base plates, splices, gussets and tube joints, checked by plate FE (CBFEM) and the component method.', 'รอยต่อสลักเกลียวและรอยเชื่อม: แผ่นปลาย แผ่นครีบ เหล็กฉาก แผ่นฐาน รอยต่อทาบ แผ่นกัสเซ็ท และรอยต่อท่อ ตรวจสอบด้วยไฟไนต์เอลิเมนต์แผ่น (CBFEM) และวิธีชิ้นส่วน'), ['AS 4100 · EN 1993-1-8 · AISC 360', 'CBFEM', T('Bolts · welds · plates', 'สลัก · รอยเชื่อม · แผ่น'), 'I · SHS · RHS · CHS']]
        ].map(appCard).join('')}</div>
      </section>
      <section class="menu-box box-timber">
        <div class="menu-hd"><span class="menu-n">3</span><div><p class="eyebrow">${T('Timber bridges', 'สะพานไม้')}</p><h2>${T('Timber bridge load rating and repair drawings', 'ประเมินกำลังรับน้ำหนักสะพานไม้และแบบซ่อมแซม')}</h2><p class="muted">${T('Rate existing timber bridges by the working-stress method, then place standard repair details on a drawing sheet, edit them and export to AutoCAD.', 'ประเมินสะพานไม้เดิมด้วยวิธีหน่วยแรงใช้งาน แล้ววางรายละเอียดซ่อมแซมมาตรฐานบนแผ่นงาน แก้ไข และส่งออกเป็นไฟล์ AutoCAD')}</p></div></div>
        <div class="an-apps an-apps2">${[
          ['timber', timberIcon(), T('Timber bridge assessment', 'ประเมินสะพานไม้'), T('Spans, stringers with defects, decks, halfcaps, piles and wing walls. Grillage analysis, load rating for standard and heavy vehicles, posting limits and repair suggestions.', 'ช่วง คานไม้พร้อมความบกพร่อง พื้น คานหัวเสา เสาเข็ม และกำแพงปีก วิเคราะห์กริลเลจ ประเมินกำลังรับน้ำหนักรถมาตรฐานและรถหนัก ป้ายจำกัดน้ำหนัก และแนะนำการซ่อม'), ['AS 1720.1 WSD', 'T44 · M1600 · HLP', T('Grillage', 'กริลเลจ'), T('Rating factors', 'ค่าประเมิน'), T('Load limits', 'ป้ายจำกัด')]],
          ['tdraw', tdrawIcon(), T('Repair detail drawings', 'แบบรายละเอียดการซ่อม'), T('A library of 50 parametric timber bridge repair details from the standard drawings and the repair manual. Place them on A1–A4 sheets, edit with CAD tools and export DXF for AutoCAD, or SVG and PDF.', 'คลังรายละเอียดการซ่อมสะพานไม้แบบพารามิเตอร์ 50 แบบ จากแบบมาตรฐานและคู่มือการซ่อม วางบนแผ่นงาน A1–A4 แก้ไขด้วยเครื่องมือ CAD และส่งออก DXF สำหรับ AutoCAD หรือ SVG และ PDF'), ['DXF · SVG · PDF', T('Snap · layers', 'สแนป · เลเยอร์'), T('Import DXF', 'นำเข้า DXF'), T('50 details', '50 แบบ')]]
        ].map(appCard).join('')}</div>
      </section>
    </main>`;
  }
  function offPill(k) { return featOff(k) ? `<span class="pill off">${S.role === 'admin' ? T('Off for users', 'ปิดสำหรับผู้ใช้') : T('Off', 'ปิด')}</span>` : ''; }
  function appCard([v, ic, t, d, ch]) { const off = isOff(v); return `<button class="an-appc ${off ? 'feat-off' : ''}" data-act="nav" data-v="${v}">${ic}<b>${t}${offPill(v)}</b><span class="muted small">${d}</span><span class="an-chips">${ch.map(c => `<i>${c}</i>`).join('')}</span><span class="pick-go">${off ? T('Unavailable for now', 'ปิดใช้งานชั่วคราว') : T('Open →', 'เปิด →')}</span></button>`; }
  // Line-sketch icons in drafting style: ink outlines, accent for loads / struts
  function elemIcon(k) {
    const o = '<svg class="ei" viewBox="0 0 120 72" aria-hidden="true">';
    if (k === 'sbarrier') return o + `
      <path d="M4 64h112" class="ln"/><path d="M30 64V14M86 64V14" class="ln"/><path d="M24 64h12M80 64h12" class="ln-thin"/>
      <rect x="10" y="14" width="100" height="8" class="ln"/><rect x="10" y="32" width="100" height="8" class="ln"/><rect x="10" y="50" width="100" height="6" class="ln-dash"/>
      <g class="ln-acc"><path d="M58 2v10M55 8l3 4 3-4"/></g></svg>`;
    if (k === 'barrier') return o + `
      <path d="M4 50h112M4 60h112" class="ln"/><path d="M4 60v-10M116 60v-10" class="ln-thin"/>
      <path d="M40 50L46 16h16v34" class="ln"/><path d="M46 20v28M58 20v28" class="ln-dash"/><path d="M48 24h8M48 32h8M48 40h8" class="ln-thin"/>
      <g class="ln-acc"><path d="M8 26h28M30 22l6 4-6 4"/></g><path d="M70 50h40" class="ln-thin"/><path d="M76 46l4-4 4 4M90 46l4-4 4 4" class="ln-thin"/></svg>`;
    if (k === 'gantry') return o + `
      <path d="M8 68h104" class="ln"/>${[12, 22, 32, 42].map(x => `<path d="M${x} 68l-5 4" class="ln-thin"/>`).join('')}
      <path d="M16 66h16" class="ln"/><rect x="21" y="10" width="6" height="56" class="ln"/>
      <rect x="27" y="11" width="84" height="5" class="ln"/><path d="M27 13.5h84" class="ln-dash"/>
      <rect x="58" y="18" width="40" height="24" class="ln"/><path d="M62 24h32M62 30h26M62 36h20" class="ln-thin"/>
      <path d="M66 16v2M90 16v2" class="ln"/><path d="M29 16l6 6" class="ln-thin"/>
      <g class="ln-acc"><circle cx="104" cy="30" r="4"/><path d="M101 27l6 6M107 27l-6 6"/></g></svg>`;
    if (k === 'lwall') return o + `
      <path d="M6 68h108" class="ln"/>${[10, 18, 26].map(x => `<path d="M${x} 68l-5 4" class="ln-thin"/>`).join('')}
      <rect x="30" y="50" width="16" height="16" class="ln"/><rect x="46" y="50" width="16" height="16" class="ln"/><rect x="62" y="50" width="16" height="16" class="ln"/>
      <rect x="30" y="34" width="16" height="16" class="ln"/><rect x="46" y="34" width="16" height="16" class="ln"/><rect x="30" y="18" width="16" height="16" class="ln"/>
      <path d="M46 18H64L112 6" class="ln"/><path d="M62 34h16v16" class="ln-dash"/>
      <g class="ln-acc"><path d="M33 18V4M33 6h14M44 3l3 3-3 3"/>${[52, 58].map(x => `<path d="M${x} 9v7M${x - 2} 13l2 3 2-3"/>`).join('')}</g></svg>`;
    if (k === 'stm3d') return o + `
      <path d="M14 30L46 14H106L74 30Z" class="ln"/><path d="M14 30v14M74 30v14M106 14v14M14 44h60l32 -16" class="ln"/>
      <path d="M22 44v22M66 44v22M98 30v22" class="ln-thin"/>
      <g class="ln-acc"><path d="M56 18L22 42M62 20L66 42M64 18L98 30"/><circle cx="60" cy="19" r="2.2"/></g>
      <path d="M22 42L66 42L98 30Z" class="ln-dash"/></svg>`;
    if (k === 'beam') return o + `
      <g class="ln-acc">${[22, 38, 54, 70, 86, 102].map(x => `<path d="M${x} 8v11M${x - 3} 15l3 4 3-4"/>`).join('')}<path d="M16 8h92"/></g>
      <rect x="10" y="22" width="100" height="18" class="ln"/>
      ${[20, 30, 40, 50, 60, 70, 80, 90, 100].map(x => `<path d="M${x} 24v14" class="ln-thin"/>`).join('')}
      <path d="M13 36h94M13 26h94" class="ln-dash"/>
      <path d="M18 40l-6 9h12zM102 40l-6 9h12z" class="ln"/><path d="M9 52h18M93 52h18" class="ln-thin"/>
      <path d="M10 62h100M10 59v6M110 59v6" class="ln-dim"/><text x="60" y="70" class="ln-txt">L</text></svg>`;
    if (k === 'column') return o + `
      <g class="ln-acc"><path d="M60 2v12M56 10l4 4 4-4"/></g>
      <rect x="48" y="16" width="24" height="44" class="ln"/>
      ${[22, 29, 36, 43, 50, 57].map(y => `<path d="M50 ${y}h20" class="ln-thin"/>`).join('')}
      <path d="M53 18v40M67 18v40" class="ln-dash"/>
      <path d="M36 60h48" class="ln"/>${[38, 46, 54, 62, 70, 78].map(x => `<path d="M${x} 60l-5 6" class="ln-thin"/>`).join('')}
      <rect x="86" y="26" width="22" height="22" class="ln"/><rect x="89" y="29" width="16" height="16" rx="2" class="ln-thin"/>${[[91, 31], [103, 31], [91, 43], [103, 43], [97, 31], [97, 43]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" class="dot"/>`).join('')}</svg>`;
    return o + `
      <rect x="52" y="4" width="16" height="14" class="ln"/><g class="ln-acc"><path d="M60 0v8"/></g>
      <rect x="16" y="18" width="88" height="22" class="ln"/>
      <path d="M20 36h80" class="ln-dash"/>
      <g class="ln-acc"><path d="M56 20L32 36M64 20l24 16"/></g>
      <path d="M26 40v28M38 40v28M82 40v28M94 40v28" class="ln"/>
      ${[46, 52, 58, 64].map(y => `<path d="M26 ${y}l12 -4M82 ${y}l12 -4" class="ln-thin"/>`).join('')}</svg>`;
  }
  function bridgeIcon() {
    return `<svg class="ei an-ico" viewBox="0 0 120 72" aria-hidden="true"><path d="M4 50h112" class="ln"/><path d="M14 50V40M106 50V40" class="ln"/><path d="M14 40 Q60 6 106 40" class="ln" fill="none"/>${[26, 38, 50, 60, 70, 82, 94].map(x => { const y = 40 - 34 * (1 - Math.pow((x - 60) / 46, 2)); return `<path d="M${x} ${y.toFixed(1)}V50" class="ln-thin"/>`; }).join('')}<path d="M40 64V50M80 64V50" class="ln"/><path d="M34 68h12M74 68h12" class="ln-thin"/><path d="M52 34l6-6 6 6" class="ln-acc"/></svg>`;
  }
  function buildingIcon() {
    return `<svg class="ei an-ico" viewBox="0 0 120 72" aria-hidden="true"><path d="M6 66h108" class="ln"/>${[0, 1, 2, 3].map(k => `<path d="M${22 + k * 4} ${62 - k * 14}h${64 - k * 0}" class="ln"/>`).join('')}${[22, 54, 86].map(x => `<path d="M${x} 66V${66 - 4 * 14 - 2}" class="ln"/>`).join('')}<path d="M86 66l20-10V8L86 18M106 8L86 18H22l20-10h64" class="ln-thin"/><path d="M96 9v50M74 8v52" class="ln-dash"/><g class="ln-acc"><path d="M4 22h12M4 34h12M4 46h12"/><path d="M12 19l4 3-4 3M12 31l4 3-4 3M12 43l4 3-4 3"/></g></svg>`;
  }
  function connIcon() {
    return `<svg class="ei an-ico" viewBox="0 0 120 72" aria-hidden="true"><path d="M30 4v64M44 4v64" class="ln"/><path d="M30 4h14M30 68h14" class="ln-thin"/><path d="M46 14v42" class="ln"/><path d="M50 18h62M50 52h62M50 20v30" class="ln"/><path d="M50 35h62" class="ln-thin"/>${[22, 30, 42, 48].map(y => `<circle cx="47" cy="${y + 0.5}" r="2.2" class="ln-acc"/>`).join('')}<path d="M36 18h8M36 52h8" class="ln-dash"/><path d="M52 18l4 3M52 52l4-3" class="ln-acc"/></svg>`;
  }
  function timberIcon() {
    return `<svg class="ei an-ico" viewBox="0 0 120 72" aria-hidden="true"><path d="M4 66h112" class="ln"/><path d="M6 24h108" class="ln"/><rect x="6" y="18" width="108" height="6" class="ln-thin"/>${[10, 22, 34, 46, 58, 70, 82, 94, 106].map(x => `<path d="M${x} 18v6" class="ln-thin"/>`).join('')}<ellipse cx="20" cy="29" rx="6" ry="5" class="ln"/><ellipse cx="60" cy="29" rx="6" ry="5" class="ln"/><ellipse cx="100" cy="29" rx="6" ry="5" class="ln"/><path d="M12 34h96" class="ln"/>${[30, 50, 70, 90].map(x => `<path d="M${x} 34v32" class="ln"/>`).join('')}<path d="M30 46l20 12M50 46l-20 12M70 46l20 12M90 46l-20 12" class="ln-thin"/><g class="ln-acc"><path d="M44 4v10M41 10l3 4 3-4M76 4v10M73 10l3 4 3-4"/></g></svg>`;
  }
  function tdrawIcon() {
    return `<svg class="ei an-ico" viewBox="0 0 120 72" aria-hidden="true"><rect x="6" y="6" width="108" height="60" class="ln"/><rect x="82" y="52" width="32" height="14" class="ln-thin"/><path d="M86 57h20M86 61h14" class="ln-thin"/><path d="M18 18h40M18 18v34M58 18v34M18 52h40" class="ln"/><path d="M30 18v34M46 18v34" class="ln-dash"/><circle cx="38" cy="28" r="2.5" class="ln-acc"/><circle cx="38" cy="42" r="2.5" class="ln-acc"/><path d="M64 26h12M76 26l-3-2M76 26l-3 2" class="ln-thin"/><path d="M70 36l28-14 6 6-28 14z" class="ln-acc"/><text x="66" y="48" font-size="8" class="ln-thin" style="stroke:none;fill:currentColor">DXF</text></svg>`;
  }
  function qtoIcon() {
    return `<svg class="ei an-ico" viewBox="0 0 120 72" aria-hidden="true"><path d="M14 58l30-14 30 14-30 14z" class="ln-thin"/><path d="M14 58V30l30-14 30 14v28M44 44V16M14 30l30 14 30-14" class="ln"/><rect x="84" y="10" width="30" height="40" rx="3" class="ln"/><path d="M90 20h18M90 28h18M90 36h12" class="ln-thin"/><path d="M90 44h18" class="ln-acc"/></svg>`;
  }
  function analysisIcon() {
    return `<svg class="ei ei-an" viewBox="0 0 120 72" aria-hidden="true"><path d="M10 26h100" class="ln"/><path d="M12 26l-5 8h10zM60 26l-5 8h10zM108 26l-5 8h10z" class="ln"/>
      <path d="M10 26c12 26 38 26 50 0M60 26c12 26 38 26 50 0" class="ln-acc"/><path d="M10 26q25 -14 50 0q25 -14 50 0" class="ln-dash"/>
      <g class="ln-acc">${[22, 36, 84, 98].map(x => `<path d="M${x} 4v14M${x - 3} 14l3 4 3-4"/>`).join('')}</g></svg>`;
  }

  // ------------------------------------------------------------------ DESIGN PAGE
  function unitOf(kind) { const u = UNITS[kind] || UNITS.none, r = S.code === 'TH' ? u.th : u.si; return [S.ui === 'th' ? r[1] : r[0], r[2]]; }
  function fieldLabel(fd) { const a = fd.alt && fd.alt[S.code]; return a ? T(a[0], a[1]) : T(fd.en, fd.th || fd.en); }
  function fmLabel(s) { return esc(s).replace(/_\{([^}]*)\}/g, '<sub>$1</sub>').replace(/_([A-Za-z0-9.,]+)/g, '<sub>$1</sub>'); }
  function diaOpts(v) { return DIAS[S.code].map(d => `<option value="${d}" ${+v === d ? 'selected' : ''}>${RC.barName(S.code, d)}</option>`).join(''); }
  function fieldHTML(fd, v) {
    const id = 'in-' + fd.k, [u] = unitOf(fd.u);
    let ctrl;
    if (fd.type === 'dia') ctrl = `<select id="${id}" data-k="${fd.k}">${diaOpts(v[fd.k])}</select>`;
    else if (fd.type === 'sel') ctrl = `<select id="${id}" data-k="${fd.k}">${(typeof fd.opts === 'function' ? fd.opts(v) : fd.opts).map(o => `<option value="${o[0]}" ${v[fd.k] === o[0] ? 'selected' : ''}>${T(o[1], o[2])}</option>`).join('')}</select>`;
    else if (fd.type === 'txt') ctrl = `<input id="${id}" data-k="${fd.k}" type="text" inputmode="numeric" value="${esc(v[fd.k])}">`;
    else ctrl = `<input id="${id}" data-k="${fd.k}" type="number" inputmode="decimal" step="any" value="${esc(v[fd.k])}">`;
    return `<div class="fld"><label for="${id}">${fmLabel(fieldLabel(fd))}</label><div class="ctl">${ctrl}${u ? `<span class="unit">${u}</span>` : ''}</div></div>`;
  }
  function courseRowsHTML(rows) {
    const n = rows.length;
    return `<div class="rows" data-rows="crs">${rows.slice().reverse().map((r, j) => { const i = n - 1 - j; return `<div class="brow crow"><span class="rlab">${T('Course', 'ชั้น')} ${i + 1}${i === n - 1 ? ' · ' + T('top', 'บน') : i === 0 ? ' · ' + T('base', 'ฐาน') : ''}</span>
      <input type="number" min="1" step="1" id="r-crs-${i}-n" data-row="crs" data-i="${i}" data-f="n" value="${r.n}" aria-label="${T('Blocks in course', 'จำนวนก้อนในชั้น')} ${i + 1}">
      <span class="x">${T('blocks', 'ก้อน')}</span><span></span>
      ${n > 1 ? `<button class="icon-btn" data-act="rowdel" data-row="crs" data-i="${i}" aria-label="${T('Remove course', 'ลบชั้น')} ${i + 1}">×</button>` : '<span></span>'}</div>`; }).join('')}
      <button class="linkbtn" data-act="rowadd" data-row="crs">+ ${T('Add a course on top', 'เพิ่มชั้นด้านบน')}</button></div>`;
  }
  function barRowsHTML(key, rows) {
    return `<div class="rows" data-rows="${key}">${rows.map((r, i) => `<div class="brow"><span class="rlab">${T('Layer', 'ชั้น')} ${i + 1}</span>
      <input type="number" min="0" step="1" id="r-${key}-${i}-n" data-row="${key}" data-i="${i}" data-f="n" value="${r.n}" aria-label="${T('Number of bars', 'จำนวนเส้น')}">
      <span class="x">×</span><select id="r-${key}-${i}-d" data-row="${key}" data-i="${i}" data-f="d" aria-label="${T('Bar diameter', 'ขนาดเหล็ก')}">${diaOpts(r.d)}</select>
      ${rows.length > 1 ? `<button class="icon-btn" data-act="rowdel" data-row="${key}" data-i="${i}" aria-label="${T('Remove layer', 'ลบชั้น')}">×</button>` : '<span></span>'}</div>`).join('')}
      <button class="linkbtn" data-act="rowadd" data-row="${key}">+ ${T('Add layer', 'เพิ่มชั้นเหล็ก')}</button></div>`;
  }
  function inputsHTML() {
    const v = inp(), sch = SCHEMA[S.elem].filter(fd => (!fd.codes || fd.codes.includes(S.code)) && (!fd.when || fd.when(v)));
    const order = S.elem === 'sbarrier' ? ['plvl', 'geo', 'rails', 'post', 'base', 'coef'] : S.elem === 'barrier' ? ['tl', 'geo', 'mat', 'comp', 'bars', 'deck', 'coef'] : S.elem === 'lwall' ? ['wall', 'top', 'soil', 'wat', 'fnd', 'joint', 'lds', 'fac'] : S.elem === 'gantry' ? ['geo', 'sign', 'col', 'arm', 'wind', 'conn', 'base', 'fat', 'lim'] : S.elem === 'pilecap' || S.elem === 'stm3d' ? ['piles', 'geo', 'mat', 'bars', 'coef', 'uls', 'sls'] : ['geo', 'mat', 'coef', 'bars', 'link', 'uls', 'sls'];
    let html = '';
    order.forEach(g => {
      const fs = sch.filter(fd => fd.g === g);
      let body = fs.map(fd => fieldHTML(fd, v)).join('');
      if (S.elem === 'beam' && g === 'bars') {
        body = `<p class="sub-h">${T('Top bars', 'เหล็กบน')}</p>${barRowsHTML('top', v.top)}<p class="sub-h">${T('Bottom bars', 'เหล็กล่าง')}</p>${barRowsHTML('bot', v.bot)}
          <p class="sub-h">${T('Side bars (each face)', 'เหล็กข้าง (ต่อด้าน)')}</p><div class="brow"><span class="rlab">${T('Per face', 'ต่อด้าน')}</span><input type="number" min="0" step="1" id="in-sideN" data-k="sideN" value="${v.sideN}" aria-label="${T('Side bars per face', 'จำนวนเหล็กข้างต่อด้าน')}"><span class="x">×</span><select id="in-sideD" data-k="sideD" aria-label="${T('Side bar diameter', 'ขนาดเหล็กข้าง')}">${diaOpts(v.sideD)}</select><span></span></div>
          <p class="hint">${T('Bars are positioned automatically: equal spacing inside the links, further layers stacked at the minimum clear gap.', 'ระบบจัดตำแหน่งเหล็กอัตโนมัติ: ระยะเท่ากันภายในเหล็กปลอก ชั้นถัดไปเว้นระยะช่องว่างน้อยสุด')}</p>`;
      }
      if (S.elem === 'barrier' && g === 'tl' && v.tl !== 'custom' && S.code === 'AS' && window.BARRIER.TL[v.tl]) { const t = window.BARRIER.TL[v.tl], fo = q => { const [a, u] = outVal(q, 'kN'); return f(a, 1) + ' ' + u; }; body += `<p class="hint">AP-G108-25 Table 5.1 / AS 5100.2: F<sub>t</sub> = ${fo(t.Ft)}, F<sub>L</sub> = ${fo(t.Fl)}, F<sub>v</sub> = ${fo(t.Fv)}, L<sub>t</sub> = ${f(t.Lt / 1000, 2)} m, L<sub>v</sub> = ${f(t.Lv / 1000, 1)} m, H<sub>e</sub> = ${f(t.He, 0)} mm · ${T('The road authority selects the level from the risk assessment (AS 5100.1).', 'หน่วยงานทางหลวงเลือกระดับจากการประเมินความเสี่ยง (AS 5100.1)')}</p>`; }
      else if (S.elem === 'barrier' && g === 'tl' && v.tl !== 'custom' && window.BARRIER.TL[v.tl]) { const t = window.BARRIER.TL[v.tl], fo = q => { const [a, u] = outVal(q, 'kN'); return f(a, 1) + ' ' + u; }, lo = q => { const [a, u] = outVal(q, 'mm'); return f(a, 0) + ' ' + u; }; body += `<p class="hint">${T('AASHTO LRFD Table A13.2-1', 'AASHTO LRFD ตาราง A13.2-1')}: F<sub>t</sub> = ${fo(t.Ft)}, F<sub>L</sub> = ${fo(t.Fl)}, F<sub>v</sub> = ${fo(t.Fv)}, L<sub>t</sub> = ${f(t.Lt / 1000, 2)} m, H<sub>e</sub> = ${lo(t.He)}, H<sub>min</sub> = ${lo(t.Hmin)} · ${T('DOH standard barriers: Type 1 = 1.00 m high, Type 2 = 1.15 m (curves, high-risk locations).', 'ราวมาตรฐานกรมทางหลวง: แบบที่ 1 สูง 1.00 ม. แบบที่ 2 สูง 1.15 ม. (ทางโค้ง จุดเสี่ยงสูง)')}</p>`; }
      if (S.elem === 'sbarrier' && g === 'plvl' && v.level !== 'custom') { const t = window.SBARRIER.LEVELS[v.level], fo = q => { const [a, u] = outVal(q, 'kN'); return f(a, 1) + ' ' + u; }, lo = q => { const [a, u] = outVal(q, 'mm'); return f(a, 0) + ' ' + u; }; body += `<p class="hint">F<sub>t</sub> = ${fo(t.Ft)}, F<sub>L</sub> = ${fo(t.Fl)}, F<sub>v</sub> = ${fo(t.Fv)}, L<sub>t</sub> = ${f(t.Lt / 1000, 2)} m, L<sub>v</sub> = ${f(t.Lv / 1000, 1)} m, H<sub>e</sub> = ${lo(t.He)} · ${T('Thai DOH projects use the AASHTO test levels; Austroads / AS 5100.2 levels are listed for comparison.', 'โครงการกรมทางหลวงใช้ระดับการทดสอบ AASHTO ระดับตาม Austroads / AS 5100.2 แสดงเพื่อเปรียบเทียบ')}</p>`; }
      if (S.elem === 'sbarrier' && g === 'rails') body += `<p class="hint">${T('Heights are to the rail centre above the top of the base plate. A lower rail can be excluded from the load resistance to maximise Y* (AP-G108-25 §5.4.2). Hollow-section S is computed with corner radii 2.5t / 1.5t (matches the section tables within 1 %).', 'ความสูงวัดถึงศูนย์กลางราวเหนือแผ่นฐาน สามารถไม่คิดราวล่างรับแรงเพื่อให้ Y* สูงสุด (AP-G108-25 §5.4.2) ค่า S ของหน้าตัดกลวงคำนวณด้วยรัศมีมุม 2.5t / 1.5t (ตรงกับตารางเหล็กภายใน 1 %)')}</p>`;
      if (S.elem === 'barrier' && g === 'comp' && v.mode === 'direct') body += `<p class="hint">${T('As in AP-G108-25 Design Example 1: M_b from the top-beam bars, M_w from the horizontal wall bars (b = height over which they act) and M_c from the vertical bars per metre. The bars below are still used for the interface, anchorage and minimum-steel checks.', 'ตามตัวอย่างที่ 1 ของ AP-G108-25: M_b จากเหล็กคานบน M_w จากเหล็กนอนของกำแพง (b = ความสูงที่เหล็กกระจาย) และ M_c จากเหล็กยืนต่อเมตร เหล็กเสริมด้านล่างยังใช้ตรวจรอยต่อ การฝังยึด และเหล็กน้อยสุด')}</p>`;
      if (S.elem === 'barrier' && g === 'coef' && S.code === 'AS') body += `<p class="hint">${T('Ultimate limit state for the collision load (load factor 1.0). The deck overhang is designed for 1.1 M_c and 1.1 T so that the barrier fails first (AP-G108-25 §5.3.3).', 'สภาวะขีดจำกัดประลัยสำหรับแรงชน (ตัวคูณ 1.0) ออกแบบพื้นยื่นสำหรับ 1.1 M_c และ 1.1 T เพื่อให้ราววิบัติก่อน (AP-G108-25 §5.3.3)')}</p>`;
      else if (S.elem === 'barrier' && g === 'coef') body += `<p class="hint">${T('Extreme Event II: load factor 1.0 on the impact and φ = 1.0 (AASHTO LRFD 1.3.2.1, 13.6.1).', 'Extreme Event II: ตัวคูณน้ำหนักแรงชน 1.0 และ φ = 1.0 (AASHTO LRFD 1.3.2.1, 13.6.1)')}</p>`;
      if (S.elem === 'gantry' && (g === 'col' || g === 'arm')) body += secProps(GA.section(v[g + 'Shape'], v[g + 'Size'], v[g + 'Grade']));
      if (S.elem === 'gantry' && g === 'wind') body += `<p class="hint">${T('Wind acts normal to the sign face. e/B_s = 0.2 models oblique wind (AS/NZS 1170.2 App. B).', 'ลมกระทำตั้งฉากกับหน้าป้าย ใช้ e/B_s = 0.2 สำหรับลมเฉียง (AS/NZS 1170.2 ภาคผนวก B)')}</p>`;
      if (S.elem === 'gantry' && g === 'fat') body += `<p class="hint">${T('Equivalent static fatigue pressures after AASHTO LTS; defaults 250 Pa natural gust, 900 Pa truck gust, 1000 Pa galloping. Adopt the road authority’s values.', 'แรงดันความล้าสถิตเทียบเท่าตาม AASHTO LTS ค่าเริ่มต้น 250 Pa ลมกระโชก 900 Pa ลมรถบรรทุก 1000 Pa แกลลอปปิง ใช้ค่าตามหน่วยงานทางหลวง')}</p>`;
      if (S.elem === 'lwall' && g === 'wall') body = `<p class="sub-h">${T('Blocks in each course (course 1 = bottom)', 'จำนวนก้อนในแต่ละชั้น (ชั้น 1 = ล่างสุด)')}</p>${courseRowsHTML(v.crs)}` + body + `<p class="hint">${T('The front face is at the left; courses step back into the retained soil.', 'หน้ากำแพงอยู่ด้านซ้าย ชั้นถัดขึ้นไปถอยเข้าหาดินถม')}</p>`;
      if (S.elem === 'lwall' && g === 'wat' && v.water === 'yes') body += `<p class="hint">${T('Use the design (worst credible) water level. AS 4678 asks for drainage behind walls; a drained wall can be checked with water at a reduced level.', 'ใช้ระดับน้ำออกแบบ (กรณีเลวร้ายที่เป็นไปได้) AS 4678 กำหนดให้มีการระบายน้ำหลังกำแพง')}</p>`;
      if (S.elem === 'lwall' && g === 'lds') body += `<p class="hint">${T('AS/NZS 1170.1 Table 3.3: handrail top load typically 0.35–0.75 kN/m (by occupancy). AS 4678 §4.2: live surcharge at least 5 kPa.', 'AS/NZS 1170.1 ตาราง 3.3: แรงที่ราวกันตกโดยทั่วไป 0.35–0.75 kN/m ตามการใช้งาน AS 4678 §4.2: น้ำหนักจรขั้นต่ำ 5 kPa')}</p>`;
      if (S.elem === 'stm3d' && g === 'bars') body += `<p class="hint">${T('Each tie is a band of bars over the piles, between neighbouring piles (all three sides for a 3-pile cap). Add a distributed mesh for crack control.', 'ตัวยึดแต่ละตัวเป็นแถบเหล็กเหนือหัวเข็มระหว่างเข็มข้างเคียง (ครบสามด้านสำหรับเข็ม 3 ต้น) ควรมีตะแกรงเหล็กกระจายเพื่อควบคุมรอยร้าว')}</p>`;
      if (g === 'coef' && !fs.length && S.elem !== 'pilecap') body = `<p class="hint">${S.code === 'AS' ? T('Capacity reduction factors φ follow Table 2.2.2 and are set automatically from k_uo.', 'ตัวคูณลดกำลัง φ ตามตาราง 2.2.2 คำนวณอัตโนมัติจาก k_uo') : T('Strength reduction factors φ are set from the steel strain (0.65–0.90); 0.75 for shear and torsion.', 'ตัวคูณลดกำลัง φ คำนวณอัตโนมัติจากความเครียดเหล็ก (0.65–0.90) และ 0.75 สำหรับแรงเฉือน/แรงบิด')}</p>`;
      if (!body) return;
      const gName = S.elem === 'barrier' && g === 'tl' && S.code === 'AS' ? ['Performance level — AP-G108-25 / AS 5100.2', 'ระดับสมรรถนะ — AP-G108-25 / AS 5100.2'] : GROUPS[g];
      html += `<details class="grp" open><summary>${T(gName[0], gName[1])}</summary><div class="grp-b">${body}</div></details>`;
    });
    return html;
  }
  function secProps(p) {
    const row = (k, v, u) => `<tr><td>${fmLabel(k)}</td><td class="num mono">${v}</td><td class="u">${u}</td></tr>`;
    return `<table class="props" aria-label="${T('Section properties', 'คุณสมบัติหน้าตัด')}">${row(T('Mass', 'มวล'), f(p.mass, 1), 'kg/m') + row('A', f(p.A, 0), 'mm²') + row('I_x / I_y', f(p.Ix / 1e6, 1) + ' / ' + f(p.Iy / 1e6, 1), '×10⁶ mm⁴') + row('Z_x / S_x', f(p.Zx / 1e3, 0) + ' / ' + f(p.Sx / 1e3, 0), '×10³ mm³') + row('J / C', f(p.J / 1e6, 1) + ' / ' + f(p.C / 1e3, 0), '×10⁶ mm⁴ / ×10³ mm³')}</table>`;
  }
  function viewDesign() {
    const c = CODES[S.code], e = ELEMS[S.elem];
    return `${navBar()}<main class="wrap page design">
      <div class="crumbs"><button data-act="nav" data-v="home">${T('Design codes', 'มาตรฐานออกแบบ')}</button><span>/</span><button data-act="nav" data-v="home">${cName(S.code)}</button><span>/</span><span>${T(e.en, e.th)}</span></div>
      <div class="dz-head tone-${c.tone}"><div><p class="eyebrow">${stdFor()}</p><h1>${T(e.en + ' design', 'ออกแบบ' + e.th)}</h1></div>
        <div class="dz-actions"><button class="btn btn-ghost sm" data-act="reset">${T('Reset example', 'คืนค่าตัวอย่าง')}</button>
        <button class="btn ${isPro() ? 'btn-hot' : 'btn-lock'} sm" data-act="report">${isPro() ? T('Full calculation', 'รายการคำนวณฉบับเต็ม') : '🔒 ' + T('Full calculation (Pro)', 'รายการคำนวณ (Pro)')}</button></div></div>
      ${S.code === 'TH' ? `<p class="note">${T('Input units: cm · mm (bars) · ksc · t · t·m. The calculation report shows equations in SI and summarises results in Thai units.', 'หน่วยที่กรอก: ซม. · มม. (เหล็ก) · กก./ซม.² · ตัน · ตัน·ม. — รายการคำนวณแสดงสมการในหน่วย SI และสรุปผลเป็นหน่วยไทย')}</p>` : ''}
      <div class="dz">
        <aside class="dz-in" id="dzIn" aria-label="${T('Inputs', 'ข้อมูลนำเข้า')}">${inputsHTML()}</aside>
        <section class="dz-out" aria-live="polite">
          <div class="out-top"><div class="sketch-card"><h2 class="card-h">${S.elem === 'sbarrier' ? T('Barrier elevation', 'รูปด้านราวกันตก') : S.elem === 'barrier' ? T('Barrier section and reinforcement', 'รูปตัดราวและเหล็กเสริม') : S.elem === 'gantry' ? T('Elevation and plan', 'รูปด้านและผัง') : S.elem === 'pilecap' ? T('Plan & reactions', 'ผังฐานรากและแรงเข็ม') : S.elem === 'stm3d' ? T('Plan of the strut-and-tie model', 'ผังแบบจำลองโครงถักค้ำ-ยึด') : S.elem === 'lwall' ? T('Wall section and loads', 'รูปตัดกำแพงและแรงกระทำ') : T('Section & reinforcement', 'หน้าตัดและเหล็กเสริม')}</h2><div id="sketch"></div></div>
            <div class="sum-card" id="summary"></div></div>
          <div id="charts"></div>
          <div class="card"><h2 class="card-h">${T('Design checks', 'ผลการตรวจสอบ')}</h2><div id="checks"></div></div>
        </section>
      </div>
      <div id="reportWrap"></div></main>`;
  }

  function toSI(v, kind) { const [, k] = unitOf(kind); return (+v || 0) * k; }
  function buildInput() {
    const v = inp(), sch = SCHEMA[S.elem], val = k => { const fd = sch.find(x => x.k === k); return fd ? toSI(v[k], fd.u) : +v[k]; };
    if (S.elem === 'gantry') {
      const on = k => v[k] === 'yes';
      return {
        geo: { H: val('H'), L: val('L'), xs: val('xs'), Bs: val('Bs'), Hs: val('Hs'), ez: +v.ez || 0, ey: +v.ey || 0, eb: +v.eb || 0, gs: +v.gs, Gadd: +v.Gadd || 0, ke: +v.ke || 2.2 },
        col: { shape: v.colShape, size: v.colSize, grade: v.colGrade }, arm: { shape: v.armShape, size: v.armSize, grade: v.armGrade },
        wind: { mode: v.mode, Vu: +v.Vu, Vs: +v.Vs, qu: +v.qu, qs: +v.qs, Cfig: +v.Cfig, Cdc: +v.Cdc, Cda: +v.Cda, Cdyn: +v.Cdyn || 1 },
        conn: { pshape: v.epshape === 'circle' ? 'circle' : 'square', type: v.ctype, weld: v.cweld, sa: +v.sa, Lst: +v.Lst, tep: +v.tep, nf: v.nf | 0, af: +v.af, fb: v.fb, fg: v.fg },
        base: { shape: v.pshape === 'circle' ? 'circle' : 'square', nb: v.nb | 0, db: v.db, bg: v.bg, ab: +v.ab, ep: +v.ep, tp: +v.tp, fyp: +v.fyp, stiff: on('stiff'), ts: +v.ts, hs: +v.hs, sst: +v.sst, weld: v.bweld, sb: +v.sb },
        fat: { on: on('fon'), IF: +v.IF, phi: +v.phiF, PNW: +v.PNW, Vm: +v.Vm, tg: on('tg'), PTG: +v.PTG, xTG: val('xTG'), LTG: +v.LTG, dsh: +v.dsh, ga: on('ga'), PG: +v.PG, cB: v.cB, cS: v.cS, cR: v.cR, cA: v.cA },
        sls: { limH: +v.limH || 100, limV: +v.limV || 150 }
      };
    }
    if (S.elem === 'sbarrier') {
      const n = k => +v[k] || 0, nr = Math.max(1, Math.min(4, +v.nr || 1)), mm3 = k => (+v[k] || 0) * 1000;
      const rails = []; for (let i = 1; i <= nr; i++) rails.push({ y: val('y' + i), shape: v['sh' + i], d: n('d' + i), b: v['sh' + i] === 'RHS' ? n('b' + i) : n('d' + i), t: n('t' + i), S: mm3('S' + i), fy: val('fyr'), use: v['u' + i] !== 'no' });
      return {
        code: S.code, geo: { level: v.level, L: val('L'), setback: n('setback'), kerb: n('kerb'), rails, post: { shape: v.psh, d: n('pd'), b: v.psh === 'RHS' ? n('pb') : n('pd'), t: n('pt'), S: mm3('pS'), fy: val('fyp') } },
        load: { Ft: val('Ft'), Fl: val('Fl'), Fv: val('Fv'), Lt: val('Lt'), Lv: val('Lv'), He: val('He') },
        base: { bp: n('bp'), Wb: n('bp'), tp: n('tp'), fyp: val('fyb'), db: +v.db, grade: v.grade, n: Math.max(1, v.n | 0), nt: Math.max(1, v.nt | 0), z: n('z'), e: n('e'), D: n('D'), X: n('X') },
        coef: { phi: n('phi') || 0.9, Nmax: v.Nmax | 0, ends: v.ends }
      };
    }
    if (S.elem === 'barrier') {
      const n = k => +v[k] || 0;
      return {
        code: S.code, mode: v.mode || 'bars', direct: { Asb: n('Asb'), bb: n('bb'), db: n('db'), Asw: n('Asw'), bw: n('bw'), dw: n('dw'), Asc: n('Asc'), dc: n('dc') },
        geo: { tl: v.tl, shape: v.shape, H: val('H'), tt: val('tt'), tb: v.shape === 'vertical' ? val('tt') : val('tb'), cover: val('cover') },
        load: { Ft: val('Ft'), Fl: val('Fl'), Fv: val('Fv'), Lt: val('Lt'), Lv: val('Lv'), He: val('He'), Hmin: val('Hmin') },
        mat: { fc: val('fc'), fy: val('fy') },
        bars: { vD: +v.vD, vS: val('vS'), v2D: +v.v2D, v2S: val('v2S'), hD: +v.hD, hS: val('hS') },
        deck: { check: v.check, ts: val('ts'), dTop: +v.dTop, sTop: val('sTop'), cTop: val('cTop'), cBot: val('cBot'), iface: v.iface },
        coef: { phi: n('phi') || 1, phid: S.code === 'AS' ? n('phid') || 0.8 : 0, Mb: val('Mb'), theta: n('theta') || 45, gc: val('gc') || 24, ends: v.ends }
      };
    }
    if (S.elem === 'lwall') {
      const n = k => +v[k] || 0;
      return {
        geo: { courses: (v.crs || String(v.courses || '').split(/[^0-9]+/).filter(Boolean).map(n => ({ n: +n }))).map(r => Math.max(1, Math.round(+r.n) || 1)), ds: val('ds'), bx: val('bx'), by: val('by'), set: val('set'), e: val('e'), gb: n('gb'), Lc: val('Lc') },
        soil: { beta: n('beta'), phi: n('phi'), dv: v.dv, gs: n('gs'), gsat: n('gsat'), phib: n('phib'), cb: n('cb'), mu: n('mu'), cj: n('cj') },
        load: { water: v.water === 'yes', hw: val('hw'), hwf: val('hwf'), q: n('q'), qext: v.qext, Hr: n('Hr'), hr: val('hr'), kh: n('kh'), qbear: n('qbear') },
        fac: { gW: n('gW') || 1, Pphi: n('Pphi'), Pc: n('Pc'), gGd: n('gGd'), gGs: n('gGs'), gQ: n('gQ'), psiE: n('psiE') }
      };
    }
    if (S.elem === 'stm3d') return {
      mat: { fc: val('fc'), fy: val('fy'), fyt: val('fy'), dg: +v.dg },
      geo: { layout: v.layout, nx: v.nx | 0, ny: v.ny | 0, s: val('s'), sy: val('sy'), Dp: val('Dp'), edge: val('edge'), Pallow: val('Pallow'), H: val('H'), cb: val('cb'), cs: val('cs'), cx: val('cx'), cy: val('cy'), tN: Math.max(1, v.tN | 0), tD: +v.tD, zd: +v.zd, gG: +v.gG, gc: val('gc') },
      act: { N: val('N'), Mx: val('Mx'), My: val('My'), Ns: val('Ns'), Mxs: val('Mxs'), Mys: val('Mys') }
    };
    const mat = { fc: val('fc'), fy: val('fy'), fyt: val('fyt') || val('fy'), dg: +v.dg, gC: +v.gC, gS: +v.gS, ktc: v.ktc, creep: v.creep, kt: v.kt, wlim: +v.wlim };
    if (S.elem === 'beam') return {
      mat, geo: { b: val('b'), h: val('h'), cover: val('cover'), linkD: +v.linkD, s: val('s'), innerN: Math.max(0, v.innerN | 0), innerD: +v.innerD },
      top: v.top.map(r => ({ n: Math.max(0, r.n | 0), d: +r.d })), bot: v.bot.map(r => ({ n: Math.max(0, r.n | 0), d: +r.d })), side: { n: Math.max(0, v.sideN | 0), d: +v.sideD },
      act: { Mx: val('Mx'), My: val('My'), Vy: val('Vy'), Vx: val('Vx'), T: val('T'), Ms: val('Ms') }
    };
    if (S.elem === 'column') return {
      mat, geo: { b: val('b'), h: val('h'), cover: val('cover'), linkD: +v.linkD, s: val('s'), innerN: Math.max(0, v.innerN | 0), innerD: +v.innerD },
      nb: Math.max(2, v.nb | 0), nh: Math.max(2, v.nh | 0), dc: +v.dc, dm: +v.dm, act: { N: val('N'), Mx: val('Mx'), My: val('My'), Vy: val('Vy'), Vx: val('Vx') }
    };
    return {
      mat: Object.assign(mat, { fyt: val('fy') }),
      geo: { layout: v.layout, nx: v.nx | 0, ny: v.ny | 0, s: val('s'), sy: val('sy'), Dp: val('Dp'), edge: val('edge'), H: val('H'), cb: val('cb'), cs: val('cs'), cx: val('cx'), cy: val('cy'), barX: { d: +v.bxd, s: val('bxs') }, barY: { d: +v.byd, s: val('bys') }, gc: val('gc'), gG: +v.gG, zd: +v.zd, Pallow: val('Pallow'), method: v.method, betaS: +v.betaS || 0.75, tieN: v.tieN | 0, tieD: +v.tieD },
      act: { N: val('N'), Mx: val('Mx'), My: val('My'), Ns: val('Ns'), Mxs: val('Mxs'), Mys: val('Mys') }
    };
  }
  function validate(x) {
    const g = x.geo, errs = [];
    if (S.elem === 'gantry') {
      if (!(g.H >= 2000)) errs.push(T('Column height must be at least 2 m.', 'ความสูงเสาต้องไม่น้อยกว่า 2 ม.'));
      if (!(g.L >= 1000)) errs.push(T('Arm length must be at least 1 m.', 'ความยาวคานต้องไม่น้อยกว่า 1 ม.'));
      if (!(g.Bs > 0 && g.Hs > 0)) errs.push(T('Enter the sign size.', 'กรอกขนาดป้าย'));
      if (!(g.xs > 0 && g.xs <= g.L)) errs.push(T('The sign centre must lie on the arm (0 < x_s ≤ L).', 'ศูนย์กลางป้ายต้องอยู่บนคาน (0 < x_s ≤ L)'));
      if (!((x.wind.mode === 'V' ? x.wind.Vu : x.wind.qu) > 0)) errs.push(T('Enter the ULS wind.', 'กรอกข้อมูลลม ULS'));
      if (!(x.base.nb >= 4)) errs.push(T('Use at least 4 anchor bolts.', 'ใช้สลักยึดอย่างน้อย 4 ตัว'));
      if (x.conn.type === 'bolt' && !(x.conn.nf >= 4)) errs.push(T('Use at least 4 flange bolts.', 'ใช้สลักหน้าแปลนอย่างน้อย 4 ตัว'));
      if (!(x.base.tp > 0 && x.base.ab > 0 && x.base.ep > 0)) errs.push(T('Check the base plate dimensions.', 'ตรวจสอบขนาดแผ่นฐาน'));
      if (x.fat.on && !(x.fat.phi > 0 && x.fat.phi <= 1)) errs.push(T('φ_f must be between 0 and 1.', 'φ_f ต้องอยู่ระหว่าง 0 ถึง 1'));
      return errs;
    }
    if (S.elem === 'sbarrier') {
      if (!(g.L >= 500)) errs.push(T('Post spacing must be at least 0.5 m.', 'ระยะห่างเสาต้องไม่น้อยกว่า 0.5 ม.'));
      if (!g.rails.some(r => r.use)) errs.push(T('At least one rail must resist the design load.', 'ต้องมีราวอย่างน้อยหนึ่งเส้นที่รับแรงออกแบบ'));
      if (!g.rails.every(r => r.y > 0 && r.d > 0 && r.t > 0 && r.t * 2 < Math.min(r.d, r.b) && r.fy > 0)) errs.push(T('Check the rail sizes, heights and f_y.', 'ตรวจสอบขนาด ความสูง และ f_y ของราว'));
      if (!(g.post.d > 0 && g.post.t > 0 && g.post.t * 2 < Math.min(g.post.d, g.post.b) && g.post.fy > 0)) errs.push(T('Check the post size and f_y.', 'ตรวจสอบขนาดและ f_y ของเสา'));
      if (g.level === 'custom' && !(x.load.Ft > 0 && x.load.Lt > 0 && x.load.Lv > 0)) errs.push(T('Enter F_t, L_t and L_v.', 'กรอก F_t, L_t และ L_v'));
      if (!(x.base.z > 0 && x.base.tp > 0 && x.base.bp > 0 && x.base.nt <= x.base.n)) errs.push(T('Check the base plate and bolt layout.', 'ตรวจสอบแผ่นฐานและการจัดสลัก'));
      if (!(x.coef.phi > 0 && x.coef.phi <= 1)) errs.push(T('φ must be between 0 and 1.', 'φ ต้องอยู่ระหว่าง 0 ถึง 1'));
      return errs;
    }
    if (S.elem === 'barrier') {
      if (!(g.H >= 300 && g.H <= 3000)) errs.push(T('Barrier height must be between 0.3 m and 3 m.', 'ความสูงราวต้องอยู่ระหว่าง 0.3 ถึง 3 ม.'));
      if (!(g.tt >= 100 && g.tb >= g.tt)) errs.push(T('Wall thickness: at least 100 mm, base not thinner than the top.', 'ความหนากำแพงอย่างน้อย 10 ซม. และฐานไม่บางกว่าด้านบน'));
      if (!(g.cover > 0 && g.cover < g.tt / 2)) errs.push(T('Check the cover.', 'ตรวจสอบระยะหุ้ม'));
      if (!(x.bars.vS > 0 && x.bars.v2S > 0 && x.bars.hS > 0)) errs.push(T('Bar spacing must be positive.', 'ระยะเรียงเหล็กต้องมากกว่า 0'));
      if (g.tl === 'custom' && !(x.load.Ft > 0 && x.load.Lt > 0)) errs.push(T('Enter F_t and L_t.', 'กรอก F_t และ L_t'));
      if (x.mode === 'direct') { const d = x.direct; if (!(d.Asw > 0 && d.bw > 0 && d.dw > 0 && d.Asc > 0 && d.dc > 0 && (d.Asb === 0 || (d.bb > 0 && d.db > 0)))) errs.push(T('Enter A_s, b and d of each wall component.', 'กรอก A_s, b และ d ของแต่ละองค์ประกอบ')); }
      if (!(x.deck.ts > 100)) errs.push(T('Check the deck thickness.', 'ตรวจสอบความหนาพื้น'));
      if (x.deck.check !== 'no' && !(x.deck.sTop > 0 && x.deck.cTop > 0 && x.deck.cTop < x.deck.ts / 2)) errs.push(T('Check the deck bars and cover.', 'ตรวจสอบเหล็กและระยะหุ้มพื้น'));
      if (!(x.coef.phi > 0 && x.coef.phi <= 1)) errs.push(T('φ must be between 0 and 1.', 'φ ต้องอยู่ระหว่าง 0 ถึง 1'));
      if (!(x.mat.fc > 5 && x.mat.fy > 100)) errs.push(T('Check material strengths.', 'ตรวจสอบกำลังวัสดุ'));
      return errs;
    }
    if (S.elem === 'lwall') {
      if (!g.courses.length) errs.push(T('Add at least one course.', 'เพิ่มอย่างน้อยหนึ่งชั้น'));
      if (!(g.ds >= 0 && g.ds < g.courses.length * g.by)) errs.push(T('The retained ground must lie between the base and the top of the wall.', 'ผิวดินถมต้องอยู่ระหว่างฐานและหลังกำแพง'));
      if (x.load.water && !(x.load.hw >= 0 && x.load.hwf >= 0 && x.soil.gsat > 9.81)) errs.push(T('Check the water levels and γ_sat.', 'ตรวจสอบระดับน้ำและ γ_sat'));
      if (g.courses.length > 20) errs.push(T('At most 20 courses.', 'ไม่เกิน 20 ชั้น'));
      if (!(g.bx > 50 && g.by > 50 && g.gb > 0)) errs.push(T('Check the block size and unit weight.', 'ตรวจสอบขนาดและหน่วยน้ำหนักก้อนหิน'));
      if (!(x.soil.phi > 0 && x.soil.phi < 60 && x.soil.gs > 0)) errs.push(T('Check the retained soil properties.', 'ตรวจสอบคุณสมบัติดินถม'));
      if (!(x.soil.beta >= 0 && x.soil.beta < 60)) errs.push(T('Back slope must be between 0° and 60°.', 'มุมลาดต้องอยู่ระหว่าง 0° ถึง 60°'));
      if (!(x.fac.Pphi > 0 && x.fac.Pphi <= 1 && x.load.qbear > 0)) errs.push(T('Check Φ_uφ and the bearing capacity.', 'ตรวจสอบ Φ_uφ และกำลังรับน้ำหนัก'));
      return errs;
    }
    if (S.elem === 'stm3d') {
      if (!(g.H > 200 && g.Dp > 100 && g.s > g.Dp)) errs.push(T('Check pile spacing, pile size and cap thickness.', 'ตรวจสอบระยะเข็ม ขนาดเข็ม และความหนาฐานราก'));
      if (g.layout === 'grid' && !(g.nx * g.ny >= 2)) errs.push(T('Use at least two piles.', 'ใช้เสาเข็มอย่างน้อย 2 ต้น'));
      if (!(g.zd > 0.3 && g.zd < 0.98)) errs.push(T('z/d must lie between 0.3 and 0.98.', 'z/d ต้องอยู่ระหว่าง 0.3 ถึง 0.98'));
      if (!(g.cx > 0 && g.cy > 0 && x.act.N > 0)) errs.push(T('Enter the column size and a compressive column load.', 'กรอกขนาดเสาและแรงอัดจากเสา'));
    } else if (S.elem !== 'pilecap') {
      if (!(g.b > 50 && g.h > 50)) errs.push(T('Section size must be greater than 50 mm.', 'ขนาดหน้าตัดต้องมากกว่า 5 ซม.'));
      if (!(g.s > 0)) errs.push(T('Link spacing must be positive.', 'ระยะเหล็กปลอกต้องมากกว่า 0'));
      if (S.elem === 'beam' && !x.bot.some(r => r.n > 0) && !x.top.some(r => r.n > 0)) errs.push(T('Add at least one layer of bars.', 'ต้องมีเหล็กเสริมอย่างน้อยหนึ่งชั้น'));
    } else {
      if (!(g.H > 200 && g.Dp > 100 && g.s > g.Dp)) errs.push(T('Check pile spacing, pile size and cap thickness.', 'ตรวจสอบระยะเข็ม ขนาดเข็ม และความหนาฐานราก'));
      if (!(g.barX.s > 0 && g.barY.s > 0)) errs.push(T('Bar spacing must be positive.', 'ระยะเหล็กต้องมากกว่า 0'));
    }
    if (!(x.mat.fc > 5 && x.mat.fy > 100)) errs.push(T('Check material strengths.', 'ตรวจสอบกำลังวัสดุ'));
    return errs;
  }

  let timer = null;
  function schedule() { clearTimeout(timer); timer = setTimeout(compute, 180); }
  function compute() {
    const x = buildInput(), errs = validate(x);
    if (errs.length) { $('#checks').innerHTML = `<p class="form-err">${errs.map(esc).join('<br>')}</p>`; $('#summary').innerHTML = ''; return; }
    try {
      S.res = S.elem === 'sbarrier' ? window.SBARRIER.design(x, lang()) : S.elem === 'barrier' ? window.BARRIER.design(x, lang()) : S.elem === 'lwall' ? LWALL.design(x, lang()) : S.elem === 'stm3d' ? STM3D.design(x, lang()) : S.elem === 'gantry' ? GA.designGantry(x, lang()) : S.elem === 'beam' ? RC.designBeam(S.code, x, lang()) : S.elem === 'column' ? RC.designColumn(S.code, x, lang()) : RC.designPileCap(S.code, x, lang());
      S.res.input = x;
    } catch (e) { console.error(e); $('#checks').innerHTML = `<p class="form-err">${T('Calculation failed for these inputs. Check geometry and reinforcement.', 'คำนวณไม่สำเร็จ ตรวจสอบรูปทรงและเหล็กเสริม')}</p>`; return; }
    renderResults();
    if (S.reportOpen) renderReport();
  }
  function outVal(v, unit) {
    if (S.code === 'TH' && OUT_TH[unit]) return [v * OUT_TH[unit][1], T(OUT_TH[unit][0][0], OUT_TH[unit][0][1])];
    return [v, unit];
  }
  function urClass(u) { return u > 1.0001 ? 'bad' : u > 0.9 ? 'warn' : 'ok'; }
  function renderResults() {
    const r = S.res, ch = r.checks;
    const worst = ch.reduce((a, b) => (b.ur > a.ur ? b : a), ch[0]);
    const pass = ch.every(c => c.ur <= 1.0001);
    $('#summary').innerHTML = `<div class="sum ${pass ? 'ok' : 'bad'}"><span class="sum-l">${T('Overall', 'สรุปผล')}</span><b class="sum-v">${pass ? T('PASS', 'ผ่าน') : T('FAIL', 'ไม่ผ่าน')}</b>
      <span class="sum-u">UR<sub>max</sub> = <b class="mono">${f(worst.ur, 3)}</b></span><span class="sum-g">${T('Governing', 'วิกฤต')}: ${fmLabel(worst.name)}</span></div>
      <dl class="kv">${summaryKV(r)}</dl>${r.warn && r.warn.length ? `<ul class="warn-list">${r.warn.map(w => `<li>${fmLabel(w)}</li>`).join('')}</ul>` : ''}`;
    $('#checks').innerHTML = `<div class="tbl-wrap"><table class="chk"><thead><tr><th>${T('Check', 'รายการ')}</th><th class="num">${T('Action', 'แรงกระทำ')}</th><th class="num">${T('Capacity', 'กำลังออกแบบ')}</th><th>UR</th></tr></thead><tbody>
      ${ch.map(c => { const [a, u] = outVal(c.Ed, c.unit), [b] = outVal(c.Rd, c.unit); const dim = c.unit === ''; return `<tr class="${urClass(c.ur)}"><td>${fmLabel(c.name)}</td><td class="num mono">${dim ? '' : f(a, 2)}</td><td class="num mono">${dim ? '' : f(b, 2) + ' <span class="u">' + esc(u) + '</span>'}</td>
        <td><div class="urb"><div class="ur"><i style="width:${Math.min(100, c.ur * 100)}%"></i></div><b class="mono">${f(c.ur, 2)}</b></div></td></tr>`; }).join('')}
      </tbody></table></div>`;
    if (S.elem === 'gantry') setTimeout(() => mount3D(r), 0);
    if (S.elem === 'stm3d') setTimeout(() => mountSTM(r), 0);
    $('#sketch').innerHTML = S.elem === 'sbarrier' ? sbarSketch(r) : S.elem === 'barrier' ? barrierSketch(r) : S.elem === 'lwall' ? wallSketch(r) : S.elem === 'stm3d' ? stmPlan(r) : S.elem === 'gantry' ? gantrySketch(r) : S.elem === 'pilecap' ? capSketch(r) : sectionSketch(r);
    $('#charts').innerHTML = S.elem === 'sbarrier' ? `<div class="card"><h2 class="card-h">${T('Barrier resistance for N-span failure modes', 'กำลังต้านทานตามรูปแบบการวิบัติ N ช่วง')}</h2>${sbarChart(r)}</div>` : S.elem === 'barrier' ? `<div class="card"><h2 class="card-h">${T('Yield-line patterns (elevation of the traffic face)', 'รูปแบบเส้นคราก (รูปด้านหน้าจราจร)')}</h2>${yieldSketch(r)}</div>` : S.elem === 'lwall' ? `<div class="card"><h2 class="card-h">${T('Checks at the base and every bed joint', 'ผลตรวจสอบที่ฐานและทุกรอยต่อ')}</h2>${wallTable(r)}</div>` : S.elem === 'stm3d' ? stmCard(r) + `<div class="card"><h2 class="card-h">${T('Members', 'ชิ้นส่วน')}</h2>${stmTable(r)}</div>` : S.elem === 'gantry' ? v3Card(r) + `<div class="card"><h2 class="card-h">${T('Connection details and fatigue', 'รายละเอียดรอยต่อและความล้า')}</h2>${gantryDetails(r)}</div>` : S.elem === 'column' ? columnCharts(r) : S.elem === 'pilecap' ? capElevation(r) : '';
  }
  function summaryKV(r) {
    const kv = (k, v, u) => { const [a, uu] = outVal(v, u); return `<div><dt>${fmLabel(k)}</dt><dd class="mono">${f(a, 2)} <span class="u">${esc(uu)}</span></dd></div>`; };
    if (S.elem === 'gantry') {
      const mx = fn => Math.max(...r.acts.map(c => fn(c.a)));
      return kv(T('N* at base', 'N* ที่โคนเสา'), mx(a => a.base.N) / 1e3, 'kN') + kv(T('M* at base (resultant)', 'M* ที่โคนเสา (ผลลัพธ์)'), mx(a => Math.hypot(a.base.Mop, a.base.Mip)) / 1e6, 'kNm')
        + kv(T('T* in column', 'T* ในเสา'), mx(a => a.base.T) / 1e6, 'kNm') + kv(T('M* at arm root', 'M* ที่โคนคาน'), mx(a => Math.hypot(a.root.Mv, a.root.Mh)) / 1e6, 'kNm')
        + kv(T('Tip deflection (SLS wind)', 'การโก่งปลายคาน (ลม SLS)'), r.sls.dH, 'mm') + kv(T('Natural frequency', 'ความถี่ธรรมชาติ'), Math.min(r.sls.fy, r.sls.fz), 'Hz');
    }
    if (S.elem === 'sbarrier') return kv('F_t', r.lv.Ft, 'kN') + kv('ΣM_p ' + T('rails', 'ราว'), r.Mp / 1e6, 'kN·m') + kv('M_p,post', r.MpPost / 1e6, 'kN·m') + kv('P_p', r.Pp / 1e3, 'kN') + kv('Y*', r.Ystar, 'mm') + kv('R* (N = ' + r.crit.N + ')', r.crit.R, 'kN') + kv(T('Deck 1.1 M_d', 'พื้น 1.1 M_d'), 1.1 * r.Md1 / 1e3, 'kN·m/m') + kv(T('Deck 1.1 T', 'พื้น 1.1 T'), 1.1 * r.T1, 'kN/m');
    if (S.elem === 'barrier') return kv('F_t (' + (r.input.geo.tl === 'custom' ? T('custom', 'กำหนดเอง') : (window.BARRIER.TLNAME[r.input.geo.tl] || r.input.geo.tl)) + ')', r.tl.Ft, 'kN') + kv('M_w', r.Mw, 'kN·m') + kv(T('M_c average', 'M_c เฉลี่ย'), r.Mc, 'kN·m/m') + kv(T('M_c at base', 'M_c ที่ฐาน'), r.McBase, 'kN·m/m') + kv('R_w ' + T('interior', 'ช่วงกลาง'), r.RwI, 'kN') + kv('R_w ' + T('end', 'ช่วงปลาย'), r.RwE, 'kN') + kv(T('Deck tension T', 'แรงดึงพื้น T'), r.Vct, 'kN/m') + `<div><dt>L<sub>c</sub> ${T('interior / end', 'ช่วงกลาง / ปลาย')}</dt><dd class="mono">${f(r.LcI, 2)} / ${f(r.LcE, 2)} m</dd></div>`;
    if (S.elem === 'lwall') { const b = r.parts[0], c = b.ot; return kv(T('Wall height H', 'ความสูงกำแพง H'), r.H, 'mm') + kv(T('Base width B', 'ความกว้างฐาน B'), b.B, 'mm') + kv(T('Wall weight', 'น้ำหนักกำแพง'), b.Wb, 'kN/m') + kv(T('Active thrust at base (G + Q)', 'แรงดันดินที่ฐาน (G + Q)'), b.PG + b.PQ, 'kN/m') + `<div><dt>${fmLabel('φ*, δ')}</dt><dd class="mono">${f(r.phiD, 1)}°, ${f(r.dlt, 1)}°</dd></div>` + `<div><dt>${fmLabel(T('Base e/B', 'e/B ที่ฐาน'))}</dt><dd class="mono">${f(c.e / b.B, 3)}</dd></div>`; }
    if (S.elem === 'stm3d') return kv(T('Cap plan area', 'พื้นที่ผังฐานราก'), r.area / 1e6, 'm²') + kv(T('Cap weight', 'น้ำหนักฐานราก'), r.W, 'kN') + kv('P_max (ULS)', Math.max(...r.Pu), 'kN') + kv('z', r.z, 'mm') + kv(T('Top node depth h_t', 'ความลึกจุดต่อบน h_t'), r.ht, 'mm') + `<div><dt>${fmLabel('θ_min')}</dt><dd class="mono">${f(r.thMin, 1)}°</dd></div>`;
    if (S.elem === 'beam') return kv(T('d (effective depth)', 'd (ความลึกประสิทธิผล)'), r.d, 'mm') + kv('A_s,total', r.S.As, 'mm²') + (r.flex.x.st ? kv(T('x (NA depth)', 'x (แกนสะเทิน)'), r.flex.x.st.c, 'mm') : '') + kv(T('M_Rd major', 'กำลังโมเมนต์แกนหลัก'), r.flex.x.Rd / 1e6, 'kNm') + kv(T('V_Rd major', 'กำลังเฉือนแกนหลัก'), r.shear.y.VRd / 1e3, 'kN') + (r.sls && r.sls.wk !== undefined ? kv('w_k', r.sls.wk, 'mm') : '');
    if (S.elem === 'column') return kv('A_s', r.S.As, 'mm²') + `<div><dt>ρ</dt><dd class="mono">${f(r.S.As / r.S.Ag * 100, 2)} %</dd></div>` + kv(T('N_Rd,max', 'กำลังรับแรงอัดสูงสุด'), r.Nmax / 1e3, 'kN') + kv('M_x,Ed', r.Mx / 1e6, 'kNm') + kv('M_y,Ed', r.My / 1e6, 'kNm');
    return kv(T('Cap L_x', 'ความยาว L_x'), r.Lx, 'mm') + kv(T('Cap L_y', 'ความกว้าง L_y'), r.Ly, 'mm') + (r.tri ? kv(T('Cap plan area (triangular)', 'พื้นที่ผังฐานราก (สามเหลี่ยม)'), r.area / 1e6, 'm²') : '') + kv(T('Cap weight', 'น้ำหนักฐานราก'), r.W, 'kN') + kv('P_max (ULS)', Math.max(...r.Pu), 'kN') + kv('P_max (SLS)', Math.max(...r.Ps), 'kN') + (r.input.geo.method === 'stm' ? kv('z', r.z, 'mm') : '');
  }

  // ------------------------------------------------------------------ sketches
  // ------------------------------------------------------------------ bridge barrier sketches
  function barrierSketch(r) {
    const x = r.input, g = x.geo, b = x.bars, dk = x.deck, H = r.H, tt = r.tt, tb = r.tb, ts = dk.ts, W = 320, Hs = 340, ov = Math.max(500, 1.4 * tb);
    const X0 = -tb - ov, X1 = 120, Y0 = -ts - 60, Y1 = H + 80, k = Math.min((W - 70) / (X1 - X0), (Hs - 60) / (Y1 - Y0));
    const X = v => 50 + (v - X0) * k, Y = v => Hs - 30 - (v - Y0) * k, P = (a, c) => X(a).toFixed(1) + ',' + Y(c).toFixed(1);
    const cov = g.cover, dv = b.vD, len = v => outVal(v, 'mm'), L = v => { const [a, u] = len(v); return f(a, 0) + ' ' + u; };
    let s = `<svg viewBox="0 0 ${W} ${Hs}" class="sec-svg" role="img" aria-label="${T('Barrier cross-section', 'รูปตัดราวกันตก')}">`;
    s += `<polygon points="${P(X0, -ts)} ${P(0, -ts)} ${P(0, 0)} ${P(X0, 0)}" class="s-conc" style="opacity:.55"/>`;
    s += `<polygon points="${P(-tb, 0)} ${P(0, 0)} ${P(0, H)} ${P(-tt, H)}" class="s-conc"/>`;
    // traffic-face vertical bar (follows the sloped face), back-face bar, hooks into the deck
    const xf = z => -(tb + (tt - tb) * z / H) + cov, hookY = -ts + (dk.cBot || 40);
    s += `<path d="M${P(xf(H - cov), H - cov)} L${P(xf(0), 0)} L${P(xf(0), hookY)} L${P(xf(0) - 12 * dv, hookY)}" class="s-link" style="stroke-width:${Math.max(1.6, dv * k)}"/>`;
    s += `<path d="M${P(-cov, H - cov)} L${P(-cov, hookY)} L${P(-cov - 12 * b.v2D, hookY)}" class="s-link2" style="stroke-width:${Math.max(1.3, b.v2D * k)}"/>`;
    s += `<path d="M${P(xf(H - cov), H - cov)} L${P(-cov, H - cov)}" class="s-link2" style="stroke-width:${Math.max(1.2, b.v2D * k)}"/>`;
    for (let z = cov + b.hS / 2; z < H - cov; z += b.hS) { s += `<circle cx="${X(xf(z) + b.hD)}" cy="${Y(z)}" r="${Math.max(2, b.hD / 2 * k)}" class="s-bt"/><circle cx="${X(-cov - b.hD)}" cy="${Y(z)}" r="${Math.max(2, b.hD / 2 * k)}" class="s-bt"/>`; }
    if (dk.check !== 'no') s += `<path d="M${P(X0 + 20, -dk.cTop)} L${P(-dk.cTop, -dk.cTop)} L${P(-dk.cTop, -ts + dk.cTop)}" class="s-link2" style="stroke-width:${Math.max(1.3, dk.dTop * k)}"/>`;
    // impact force at H_e
    const he = Math.min(r.tl.He, H), xe = X(-(tb + (tt - tb) * he / H));
    s += `<path d="M${xe - 46} ${Y(he)}H${xe - 4}M${xe - 12} ${Y(he) - 5}l8 5-8 5" class="w-load" style="stroke-width:2.2"/><text x="${xe - 48}" y="${Y(he) - 8}" class="s-lbl">F<tspan dy="3" font-size="8">t</tspan></text>`;
    s += `<line x1="${xe - 40}" x2="${xe - 40}" y1="${Y(0)}" y2="${Y(he)}" class="s-dim" stroke-dasharray="3 3"/><text x="${xe - 44}" y="${(Y(0) + Y(he)) / 2}" text-anchor="end" class="s-lbl">H<tspan dy="3" font-size="8">e</tspan><tspan dy="-3"> ${L(r.tl.He)}</tspan></text>`;
    // dimensions
    s += `<line x1="${X(0) + 18}" x2="${X(0) + 18}" y1="${Y(0)}" y2="${Y(H)}" class="s-dim"/><text transform="translate(${X(0) + 30} ${(Y(0) + Y(H)) / 2}) rotate(-90)" text-anchor="middle" class="s-lbl">H = ${L(H)}</text>`;
    s += `<text x="${(X(-tt) + X(0)) / 2}" y="${Y(H) - 8}" text-anchor="middle" class="s-lbl">${L(tt)}</text><text x="${(X(-tb) + X(0)) / 2}" y="${Y(-ts) + 14}" text-anchor="middle" class="s-lbl">${L(tb)}</text>`;
    s += `<text x="${X(X0) + 4}" y="${Y(-ts) + 14}" class="s-lbl">${T('deck', 'พื้น')} t<tspan dy="3" font-size="8">s</tspan><tspan dy="-3"> = ${L(ts)}</tspan></text><text x="${X(X0) + 4}" y="${Y(0) - 6}" class="s-lbl">${T('traffic side', 'ด้านจราจร')}</text>`;
    return s + '</svg>';
  }
  function sbarSketch(r) {
    const x = r.input, g = x.geo, W = 320, Hs = 340, top = Math.max(...g.rails.map(q => q.y + (q.shape === 'RHS' ? q.b : q.d) / 2), r.lv.He) + 80;
    const k = (Hs - 70) / top, X0 = 160, Y = v => Hs - 40 - v * k, pw = Math.max(6, g.post.d * k);
    const L = v => { const [a, u] = outVal(v, 'mm'); return f(a, 0) + ' ' + u; };
    let s = `<svg viewBox="0 0 ${W} ${Hs}" class="sec-svg" role="img" aria-label="${T('Barrier elevation', 'รูปด้านราว')}">`;
    s += `<rect x="20" y="${Y(0)}" width="${W - 40}" height="14" class="s-conc" style="opacity:.6"/>`;
    s += `<rect x="${X0 - pw / 2 - 18}" y="${Y(0) - 5}" width="${pw + 36}" height="5" class="s-conc" style="fill:var(--ink);opacity:.7"/>`;
    s += `<rect x="${X0 - pw / 2}" y="${Y(top - 70)}" width="${pw}" height="${Y(0) - 5 - Y(top - 70)}" class="s-conc" style="fill:color-mix(in srgb,var(--blue) 18%,var(--card));stroke:var(--blue)"/>`;
    g.rails.forEach((q, i) => { const hv = (q.shape === 'RHS' ? q.b : q.d) * k, dw = Math.max(8, q.d * k), used = q.use;
      s += `<rect x="${X0 - pw / 2 - dw}" y="${Y(q.y) - hv / 2}" width="${dw}" height="${hv}" rx="${q.shape === 'CHS' ? hv / 2 : 2}" style="fill:${used ? 'color-mix(in srgb,var(--acc) 30%,var(--card))' : 'var(--card)'};stroke:${used ? 'var(--acc)' : 'var(--muted)'};stroke-width:1.5${used ? '' : ';stroke-dasharray:3 2'}"/>`;
      s += `<line x1="${X0 + pw / 2 + 12}" x2="${X0 + pw / 2 + 40}" y1="${Y(q.y)}" y2="${Y(q.y)}" class="s-dim"/><text x="${X0 + pw / 2 + 44}" y="${Y(q.y) + 4}" class="s-lbl">${i + 1}: ${L(q.y)}</text>`; });
    s += `<line x1="30" x2="${W - 30}" y1="${Y(r.Ystar)}" y2="${Y(r.Ystar)}" style="stroke:#16a34a;stroke-width:1.5;stroke-dasharray:6 4"/><text x="32" y="${Y(r.Ystar) - 5}" class="s-lbl" style="fill:#15803d">Y* = ${L(r.Ystar)}</text>`;
    s += `<line x1="30" x2="${X0 - pw / 2 - 40}" y1="${Y(r.lv.He)}" y2="${Y(r.lv.He)}" style="stroke:#dc2626;stroke-width:1;stroke-dasharray:2 3"/><text x="32" y="${Y(r.lv.He) + 13}" class="s-lbl" style="fill:#dc2626">H<tspan dy="3" font-size="8">e</tspan><tspan dy="-3"> = ${L(r.lv.He)}</tspan></text>`;
    const xa = X0 - pw / 2 - Math.max(...g.rails.map(q => Math.max(8, q.d * k))) - 4; s += `<path d="M${xa - 60} ${Y(r.Ystar)}H${xa}M${xa - 9} ${Y(r.Ystar) - 5}l9 5-9 5" class="w-load" style="stroke-width:2.2"/><text x="${xa - 12}" y="${Y(r.Ystar) - 8}" text-anchor="end" class="s-lbl">F<tspan dy="3" font-size="8">t</tspan></text>`;
    s += `<text x="${X0}" y="${Y(top - 70) - 6}" text-anchor="middle" class="s-lbl">${T('post', 'เสา')} ${esc(g.post.d + '×' + g.post.b + '×' + g.post.t)} @ ${f(g.L / 1000, 2)} m</text>`;
    return s + '</svg>';
  }
  function sbarChart(r) {
    const W = 640, H = 230, ints = r.inter.filter(q => isFinite(q.R)), ens = r.input.coef.ends !== 'no' ? r.ends.filter(q => isFinite(q.R)) : [];
    const vmax = Math.max(r.lv.Ft, ...ints.map(q => q.R), ...ens.map(q => q.R)) * 1.12, n = r.inter.length, bw = (W - 80) / n, Y = v => H - 34 - v / vmax * (H - 60), cv = v => outVal(v, 'kN');
    let s = `<svg viewBox="0 0 ${W} ${H}" class="sec-svg" style="max-width:100%" role="img" aria-label="${T('Resistance against the number of spans', 'กำลังต้านทานเทียบจำนวนช่วง')}">`;
    s += `<line x1="56" x2="${W - 16}" y1="${Y(0)}" y2="${Y(0)}" class="s-dim"/>`;
    r.inter.forEach((q, i) => { const x0 = 60 + i * bw; if (isFinite(q.R)) { const crit = q.N === r.crit.N; s += `<rect x="${x0 + 4}" y="${Y(q.R)}" width="${ens.length ? bw / 2 - 6 : bw - 10}" height="${Y(0) - Y(q.R)}" style="fill:${crit ? 'var(--acc)' : 'color-mix(in srgb,var(--blue) 55%,var(--card))'}"/><text x="${x0 + (ens.length ? bw / 4 : bw / 2)}" y="${Y(q.R) - 4}" text-anchor="middle" class="s-lbl">${f(cv(q.R)[0], S.code === 'TH' ? 1 : 0)}</text>`; }
      const e = ens.find(z => z.N === q.N); if (e) s += `<rect x="${x0 + bw / 2}" y="${Y(e.R)}" width="${bw / 2 - 6}" height="${Y(0) - Y(e.R)}" style="fill:color-mix(in srgb,var(--muted) 45%,var(--card))"/><text x="${x0 + 3 * bw / 4}" y="${Y(e.R) - 4}" text-anchor="middle" class="s-lbl">${f(cv(e.R)[0], S.code === 'TH' ? 1 : 0)}</text>`;
      s += `<text x="${x0 + bw / 2}" y="${H - 16}" text-anchor="middle" class="s-lbl">N = ${q.N}</text>`; });
    s += `<line x1="56" x2="${W - 16}" y1="${Y(r.lv.Ft)}" y2="${Y(r.lv.Ft)}" style="stroke:#dc2626;stroke-width:1.6;stroke-dasharray:6 4"/><text x="${W - 18}" y="${Y(r.lv.Ft) - 5}" text-anchor="end" class="s-lbl" style="fill:#dc2626">F<tspan dy="3" font-size="8">t</tspan><tspan dy="-3"> = ${f(cv(r.lv.Ft)[0], 1)} ${cv(r.lv.Ft)[1]}</tspan></text>`;
    s += `<text x="8" y="16" class="s-lbl">${T('R (interior', 'R (ช่วงกลาง')}${ens.length ? T(' | end post', ' | เสาปลาย') : ''}) — ${cv(1)[1]}</text>`;
    return s + '</svg>';
  }
  function yieldSketch(r) {
    const W = 640, Hh = 210, Lt = r.tl.Lt / 1000, H = r.H / 1000, pane = (ox, Lc, end, title, Rw) => {
      const span = end ? Math.max(Lc, Lt) + 0.8 : Math.max(Lc, Lt) + 1.0, k = Math.min(270 / span, 90 / H), x0 = ox + 15, yb = 172, yt = yb - H * k, X = v => x0 + v * k;
      const mid = end ? 0.4 : span / 2, a = end ? mid : mid - Lc / 2, bnd = end ? mid + Lc : mid + Lc / 2, la = end ? mid : mid - Lt / 2, lb = end ? mid + Lt : mid + Lt / 2;
      let s = `<rect x="${X(0)}" y="${yt}" width="${span * k}" height="${H * k}" class="w-block" style="fill:var(--conc);stroke:var(--conc-line)"/>`;
      if (end) s += `<line x1="${X(mid)}" x2="${X(mid)}" y1="${yt - 6}" y2="${yb + 6}" style="stroke:var(--ink);stroke-width:2.5"/><text x="${X(mid) - 4}" y="${yb + 18}" text-anchor="end" class="s-lbl">${T('joint / end', 'รอยต่อ / ปลาย')}</text>`;
      s += `<path d="M${X(end ? la : a)} ${yt}L${X(la)} ${yb}L${X(lb)} ${yb}L${X(bnd)} ${yt}" style="fill:none;stroke:#dc2626;stroke-width:2;stroke-dasharray:6 3"/>`;
      if (!end) s += `<path d="M${X(la)} ${yb}L${X(mid)} ${yt}L${X(lb)} ${yb}" style="fill:none;stroke:#dc2626;stroke-width:1.2;stroke-dasharray:2 3;opacity:.6"/>`;
      for (let i = 0; i <= 6; i++) { const xx = X(la + (lb - la) * i / 6); s += `<path d="M${xx} ${yt - 22}v16M${xx - 3} ${yt - 10}l3 4 3-4" class="w-load"/>`; }
      s += `<line x1="${X(la)}" x2="${X(lb)}" y1="${yt - 22}" y2="${yt - 22}" class="w-load"/><text x="${X((la + lb) / 2)}" y="${yt - 27}" text-anchor="middle" class="s-lbl">F<tspan dy="3" font-size="8">t</tspan><tspan dy="-3"> ${T('over', 'บน')} L</tspan><tspan dy="3" font-size="8">t</tspan><tspan dy="-3"> = ${f(Lt, 2)} m</tspan></text>`;
      s += `<line x1="${X(a)}" x2="${X(bnd)}" y1="${yb + 30}" y2="${yb + 30}" class="s-dim"/><path d="M${X(a)} ${yb + 25}v10M${X(bnd)} ${yb + 25}v10" class="s-dim"/><text x="${X((a + bnd) / 2)}" y="${yb + 42}" text-anchor="middle" class="s-lbl">L<tspan dy="3" font-size="8">c</tspan><tspan dy="-3"> = ${f(Lc, 2)} m</tspan></text>`;
      const [rv, ru] = outVal(Rw, 'kN');
      return s + `<text x="${ox + 15}" y="18" class="s-lbl" style="font-weight:700">${title}</text><text x="${ox + 15}" y="34" class="s-lbl">R<tspan dy="3" font-size="8">w</tspan><tspan dy="-3"> = ${f(rv, 1)} ${ru}</tspan></text>`;
    };
    return `<svg viewBox="0 0 ${W} ${Hh + 10}" class="sec-svg" style="max-width:100%" role="img" aria-label="${T('Yield-line patterns', 'รูปแบบเส้นคราก')}">${pane(0, r.LcI, false, T('Interior segment', 'ช่วงกลาง'), r.RwI)}${pane(330, r.LcE, true, T('End segment', 'ช่วงปลาย'), r.RwE)}</svg>`;
  }
  function sectionSketch(r) {
    const S2 = r.S, b = S2.b, h = S2.h, g = r.input.geo, W = 300, H = 330, pad = 46;
    const k = Math.min((W - 2 * pad) / b, (H - 2 * pad) / h), ox = (W - b * k) / 2, oy = (H - h * k) / 2;
    const X = x => ox + (x + b / 2) * k, Y = y => oy + (h / 2 - y) * k;
    const cl = g.cover + g.linkD / 2, lw = b - 2 * cl, lh = h - 2 * cl;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="sec-svg" role="img" aria-label="${T('Cross-section sketch', 'ภาพหน้าตัด')}">`;
    s += `<rect x="${X(-b / 2)}" y="${Y(h / 2)}" width="${b * k}" height="${h * k}" class="s-conc"/>`;
    s += `<rect x="${X(-lw / 2)}" y="${Y(lh / 2)}" width="${lw * k}" height="${lh * k}" rx="${Math.max(3, 2 * g.linkD * k)}" class="s-link" style="stroke-width:${Math.max(1.6, g.linkD * k)}"/>`;
    const nI = g.innerN | 0, dI = g.innerD || g.linkD;
    if (nI > 0) {
      // single-leg links: one straight vertical leg each (hooked at both ends), placed at interior bars
      const row = (S.elem === 'beam' ? r.bars.filter(q => q.g === 'B1') : r.bars.filter(q => Math.abs(q.y - Math.min(...r.bars.map(z => z.y))) < 1)).sort((p, q) => p.x - q.x);
      const inner = row.slice(1, -1), m = inner.length, hk = Math.max(5, 6 * dI * k);
      for (let i = 0; i < nI; i++) {
        const x = m >= nI ? inner[Math.min(m - 1, Math.max(0, Math.round((i + 1) * (m + 1) / (nI + 1)) - 1))].x : -lw / 2 + lw * (i + 1) / (nI + 1);
        const xt = X(x), yt = Y(lh / 2), yb = Y(-lh / 2);
        s += `<path d="M${xt + hk} ${yt + hk} L${xt} ${yt} L${xt} ${yb} L${xt - hk} ${yb - hk}" class="s-link2" style="stroke-width:${Math.max(1.4, dI * k)}"/>`;
      }
    }
    const cls = { T: 's-bt', B: 's-bb', S: 's-bs', C: 's-bb', M: 's-bt' };
    r.bars.forEach(bar => { s += `<circle cx="${X(bar.x)}" cy="${Y(bar.y)}" r="${Math.max(2.4, bar.d / 2 * k)}" class="${cls[bar.g[0]]}"/>`; });
    if (S.elem === 'beam' && r.flex.x.st) {
      const sag = r.input.act.Mx >= 0, yNA = sag ? h / 2 - r.flex.x.st.c : -h / 2 + r.flex.x.st.c;
      s += `<line x1="${X(-b / 2) - 12}" x2="${X(b / 2) + 12}" y1="${Y(yNA)}" y2="${Y(yNA)}" class="s-na"/><text x="${X(b / 2) + 14}" y="${Y(yNA) + 4}" class="s-lbl">x=${f(outVal(r.flex.x.st.c, 'mm')[0], 1)}</text>`;
    }
    const [bv, bu] = outVal(b, 'mm'), [hv] = outVal(h, 'mm');
    s += `<line x1="${X(-b / 2)}" x2="${X(b / 2)}" y1="${Y(-h / 2) + 20}" y2="${Y(-h / 2) + 20}" class="s-dim"/><text x="${W / 2}" y="${Y(-h / 2) + 34}" text-anchor="middle" class="s-lbl">b = ${f(bv, 0)} ${bu}</text>`;
    s += `<line x1="${X(-b / 2) - 20}" x2="${X(-b / 2) - 20}" y1="${Y(h / 2)}" y2="${Y(-h / 2)}" class="s-dim"/><text transform="translate(${X(-b / 2) - 26} ${H / 2}) rotate(-90)" text-anchor="middle" class="s-lbl">h = ${f(hv, 0)}</text>`;
    s += '</svg>';
    const grp = {}; r.bars.forEach(bb => { const kk = bb.g[0]; grp[kk] = grp[kk] || {}; grp[kk][bb.d] = (grp[kk][bb.d] || 0) + 1; });
    const nm = { T: T('Top', 'บน'), B: T('Bottom', 'ล่าง'), S: T('Side', 'ข้าง'), C: T('Corner', 'มุม'), M: T('Intermediate', 'กลาง') };
    const legend = Object.entries(grp).map(([kk, v]) => `<li><i class="${cls[kk]}"></i>${nm[kk]}: ${Object.entries(v).map(([d, n]) => n + RC.barName(S.code, d)).join(' + ')}</li>`).join('');
    const link = `<li><i class="s-link-k"></i>${RC.linkName(S.code, g.linkD, f(outVal(g.s, 'mm')[0], 0))}${nI ? ' + ' + nI + '× ' + T('single-leg', 'ขาเดี่ยว') + ' ' + RC.barName(S.code, g.innerD) : ''}</li>`;
    return s + `<ul class="legend">${legend}${link}</ul>`;
  }
  function niceTicks(lo, hi, n) {
    const span = hi - lo || 1, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0))), e = step0 / mag;
    const step = (e >= 5 ? 10 : e >= 2 ? 5 : e >= 1 ? 2 : 1) * mag, out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }
  function chartFrame(W, H, pad, xs, ys, xl, yl) {
    const [x0, x1] = xs, [y0, y1] = ys;
    const X = v => pad.l + (v - x0) / (x1 - x0) * (W - pad.l - pad.r), Y = v => H - pad.b - (v - y0) / (y1 - y0) * (H - pad.t - pad.b);
    let s = '';
    niceTicks(x0, x1, 5).forEach(t => { s += `<line x1="${X(t)}" x2="${X(t)}" y1="${pad.t}" y2="${H - pad.b}" class="c-grid"/><text x="${X(t)}" y="${H - pad.b + 14}" text-anchor="middle" class="c-tick">${f(t, 0)}</text>`; });
    niceTicks(y0, y1, 5).forEach(t => { s += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${Y(t)}" y2="${Y(t)}" class="c-grid"/><text x="${pad.l - 6}" y="${Y(t) + 4}" text-anchor="end" class="c-tick">${f(t, 0)}</text>`; });
    if (x0 < 0 && x1 > 0) s += `<line x1="${X(0)}" x2="${X(0)}" y1="${pad.t}" y2="${H - pad.b}" class="c-axis"/>`;
    if (y0 < 0 && y1 > 0) s += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${Y(0)}" y2="${Y(0)}" class="c-axis"/>`;
    s += `<text x="${(pad.l + W - pad.r) / 2}" y="${H - 4}" text-anchor="middle" class="c-ax">${xl.replace(/_/g, '')}</text><text transform="translate(12 ${(pad.t + H - pad.b) / 2}) rotate(-90)" text-anchor="middle" class="c-ax">${yl.replace(/_/g, '')}</text>`;
    return { s, X, Y };
  }
  function nmChart(cP, cN, Nd, Md, title, axis) {
    const cv = v => outVal(v, 'kN')[0], cm = v => outVal(v, 'kNm')[0];
    const P = cP.map(p => [cm(p.M / 1e6), cv(p.N / 1e3)]), Q = cN.map(p => [-cm(p.M / 1e6), cv(p.N / 1e3)]);
    const all = P.concat(Q), dN = cv(Nd / 1e3), dM = cm(Md / 1e6);
    const xm = Math.max(...all.map(p => Math.abs(p[0])), Math.abs(dM)) * 1.1, ymin = Math.min(...all.map(p => p[1]), dN) * 1.05, ymax = Math.max(...all.map(p => p[1]), dN) * 1.08;
    const W = 360, H = 300, fr = chartFrame(W, H, { l: 56, r: 14, t: 14, b: 38 }, [-xm, xm], [Math.min(ymin, 0), ymax], `M_${axis} (${outVal(1, 'kNm')[1]})`, `N (${outVal(1, 'kN')[1]})`);
    const path = pts => pts.map((p, i) => (i ? 'L' : 'M') + fr.X(p[0]).toFixed(1) + ' ' + fr.Y(p[1]).toFixed(1)).join(' ');
    return `<figure class="chart"><figcaption>${fmLabel(title)}</figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${fr.s}
      <path d="${path(P)} ${path(Q.slice().reverse()).replace(/^M/, 'L')} Z" class="c-area"/><path d="${path(P)}" class="c-line"/><path d="${path(Q)}" class="c-line"/>
      <circle cx="${fr.X(dM)}" cy="${fr.Y(dN)}" r="5.5" class="c-pt"/><text x="${fr.X(dM) + 9}" y="${fr.Y(dN) - 8}" class="c-ptl">Ed</text></svg></figure>`;
  }
  function contourChart(poly, mx, my) {
    if (!poly) return `<p class="form-err">${T('N_Ed exceeds the section capacity — no moment contour exists.', 'N_Ed เกินกำลังหน้าตัด — ไม่มีเส้นชั้นกำลังโมเมนต์')}</p>`;
    const cm = v => outVal(v, 'kNm')[0];
    const P = poly.map(p => [cm(p.Mx / 1e6), cm(p.My / 1e6)]), dx = cm(mx), dy = cm(my);
    const m = Math.max(...P.map(p => Math.max(Math.abs(p[0]), Math.abs(p[1]))), Math.abs(dx), Math.abs(dy)) * 1.12;
    const W = 330, H = 300, u = outVal(1, 'kNm')[1], fr = chartFrame(W, H, { l: 52, r: 14, t: 14, b: 38 }, [-m * 1.1, m * 1.1], [-m, m], 'M_x (' + u + ')', 'M_y (' + u + ')');
    const d = P.map((p, i) => (i ? 'L' : 'M') + fr.X(p[0]).toFixed(1) + ' ' + fr.Y(p[1]).toFixed(1)).join(' ') + ' Z';
    return `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Mx-My contour">${fr.s}<path d="${d}" class="c-area"/><path d="${d}" class="c-line"/>
      <line x1="${fr.X(0)}" y1="${fr.Y(0)}" x2="${fr.X(dx)}" y2="${fr.Y(dy)}" class="c-vec"/><circle cx="${fr.X(dx)}" cy="${fr.Y(dy)}" r="5.5" class="c-pt"/><text x="${fr.X(dx) + 8}" y="${fr.Y(dy) - 8}" class="c-ptl">Ed</text></svg></figure>`;
  }
  function columnCharts(r) { return `<div class="card"><h2 class="card-h">${T('Interaction diagrams', 'แผนภาพปฏิสัมพันธ์')}</h2>${columnChartsInner(r)}</div>`; }
  function columnChartsInner(r) {
    return `<div class="charts3">
      ${nmChart(r.curves.xP, r.curves.xN, r.N, r.Mx, T('N–M, major axis (x)', 'N–M แกนหลัก (x)'), 'x')}
      ${nmChart(r.curves.yP, r.curves.yN, r.N, r.My, T('N–M, minor axis (y)', 'N–M แกนรอง (y)'), 'y')}
      <div><p class="figcap">${fmLabel(T('Biaxial M_x–M_y at N_Ed', 'M_x–M_y สองแกนที่ N_Ed'))}</p>${contourChart(r.poly, r.Mx / 1e6, r.My / 1e6)}</div></div>
      <p class="hint">${T('Design curves include φ (AS / Thai) or partial factors (EC2), capped at the code maximum axial resistance.', 'เส้นโค้งออกแบบรวมตัวคูณลดกำลัง φ และจำกัดด้วยกำลังรับแรงอัดสูงสุดตามมาตรฐาน')}</p>`;
  }
  let clipSeq = 0;
  function capSketch(r) {
    const W = 340, H = 320, pad = 34, k = Math.min((W - 2 * pad) / r.Lx, (H - 2 * pad) / r.Ly);
    const cxm = (r.X0 + r.X1) / 2, cym = (r.Y0 + r.Y1) / 2, X = x => W / 2 + (x - cxm) * k, Y = y => H / 2 - (y - cym) * k;
    const g = r.input.geo, stm = g.method === 'stm';
    let s = `<svg viewBox="0 0 ${W} ${H}" class="sec-svg" role="img" aria-label="${T('Pile cap plan', 'ผังฐานราก')}">`;
    const pth = P => 'M' + P.map(p => X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(' L') + ' Z';
    const cid = 'capclip' + (++clipSeq);
    s += `<defs><clipPath id="${cid}o"><path d="${pth(r.poly)}"/></clipPath></defs>`;
    if (r.tri) {
      const inner = RC.capOutline(r.piles, g.edge - g.cs, true).poly;
      s += `<defs><clipPath id="${cid}"><path d="${pth(inner)}"/></clipPath></defs><path d="${pth(r.poly)}" class="s-conc"/><g clip-path="url(#${cid})">`;
    } else s += `<rect x="${X(r.X0)}" y="${Y(r.Y1)}" width="${r.Lx * k}" height="${r.Ly * k}" class="s-conc"/>`;
    const nbx = Math.min(r.nbx, 14), nby = Math.min(r.nby, 14);
    for (let i = 0; i < nbx; i++) { const y = r.Y0 + g.cs + (r.Ly - 2 * g.cs) * i / Math.max(1, nbx - 1); s += `<line x1="${X(r.X0 + g.cs)}" x2="${X(r.X1 - g.cs)}" y1="${Y(y)}" y2="${Y(y)}" class="s-mesh"/>`; }
    for (let i = 0; i < nby; i++) { const x = r.X0 + g.cs + (r.Lx - 2 * g.cs) * i / Math.max(1, nby - 1); s += `<line y1="${Y(r.Y0 + g.cs)}" y2="${Y(r.Y1 - g.cs)}" x1="${X(x)}" x2="${X(x)}" class="s-mesh"/>`; }
    if (r.tri) s += '</g>';
    const d = (r.dx + r.dy) / 2;
    s += `<rect x="${X(-g.cx / 2 - d / 2)}" y="${Y(g.cy / 2 + d / 2)}" width="${(g.cx + d) * k}" height="${(g.cy + d) * k}" rx="${S.code === 'EC2' ? d / 2 * k : 0}" class="s-perim" clip-path="url(#${cid}o)"/>`;
    if (stm && g.layout === '3') { const P = r.piles; s += `<path d="M${X(P[0].x)} ${Y(P[0].y)} L${X(P[1].x)} ${Y(P[1].y)} L${X(P[2].x)} ${Y(P[2].y)} Z" class="s-tri"/>`; }
    if (stm) r.piles.forEach(p => { const nx = Math.sign(p.x) * g.cx / 4, ny = Math.sign(p.y) * g.cy / 4; s += `<line x1="${X(nx)}" y1="${Y(ny)}" x2="${X(p.x)}" y2="${Y(p.y)}" class="s-strut"/>`; });
    const Pmax = Math.max(...r.Pu);
    r.piles.forEach((p, i) => {
      const crit = r.worstPile && r.worstPile.p.id === p.id;
      s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${g.Dp / 2 * k}" class="s-pile ${r.Pu[i] === Pmax ? 'hot' : ''}"/>`;
      if (crit && r.worstPile.circ) s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${r.worstPile.a * k}" class="s-perim thin" clip-path="url(#capclip${clipSeq}o)"/>`;
      else if (crit) { const a = g.Dp / 2 + d / 2, x0 = Math.max(p.x - a, r.X0), x1 = Math.min(p.x + a, r.X1), y0 = Math.max(p.y - a, r.Y0), y1 = Math.min(p.y + a, r.Y1); s += `<rect x="${X(x0)}" y="${Y(y1)}" width="${(x1 - x0) * k}" height="${(y1 - y0) * k}" class="s-perim thin"/>`; }
      s += `<text x="${X(p.x)}" y="${Y(p.y) - 2}" text-anchor="middle" class="s-pid">${p.id}</text><text x="${X(p.x)}" y="${Y(p.y) + 11}" text-anchor="middle" class="s-pv">${f(outVal(r.Pu[i], 'kN')[0], 0)}</text>`;
    });
    s += `<rect x="${X(-g.cx / 2)}" y="${Y(g.cy / 2)}" width="${g.cx * k}" height="${g.cy * k}" class="s-col"/>`;
    const [lx, lu] = outVal(r.Lx, 'mm'), [ly] = outVal(r.Ly, 'mm');
    s += `<text x="${W / 2}" y="${Y(r.Y0) + 20}" text-anchor="middle" class="s-lbl">Lx = ${f(lx, 0)} ${lu}</text><text transform="translate(${X(r.X0) - 12} ${H / 2}) rotate(-90)" text-anchor="middle" class="s-lbl">Ly = ${f(ly, 0)}</text></svg>`;
    return s + `<ul class="legend"><li><i class="s-pile-k"></i>${T('Pile, P_u', 'เข็ม, P_u')} (${outVal(1, 'kN')[1]})</li><li><i class="s-perim-k"></i>${T('Punching perimeters', 'เส้นรอบรูปเฉือนทะลุ')}</li>${stm ? `<li><i class="s-strut-k"></i>${T('Struts', 'ค้ำ')}</li>` : ''}<li><i class="s-mesh-k"></i>${r.nbx + RC.barName(S.code, g.barX.d)} / ${r.nby + RC.barName(S.code, g.barY.d)}</li></ul>`;
  }
  function capElevation(r) {
    const g = r.input.geo, W = 520, H = 220, px = r.piles.filter((p, i, a) => a.findIndex(q => Math.abs(q.x - p.x) < 1) === i).sort((a, b) => a.x - b.x);
    const k = Math.min((W - 60) / r.Lx, 120 / g.H), cxm = (r.X0 + r.X1) / 2, X = x => W / 2 + (x - cxm) * k, top = 40, Yd = y => top + y * k;
    let s = `<div class="card"><h2 class="card-h">${T('Elevation', 'รูปตัด')}${g.method === 'stm' ? ' · STM' : ''}</h2><div class="tbl-wrap"><svg viewBox="0 0 ${W} ${H}" class="elev" role="img" aria-label="${T('Pile cap elevation', 'รูปตัดฐานราก')}">`;
    s += `<rect x="${X(r.X0)}" y="${top}" width="${r.Lx * k}" height="${g.H * k}" class="s-conc"/><rect x="${X(-g.cx / 2)}" y="${top - 30}" width="${g.cx * k}" height="30" class="s-col"/>`;
    px.forEach(p => { s += `<rect x="${X(p.x - g.Dp / 2)}" y="${Yd(g.H) - 6}" width="${g.Dp * k}" height="${H - Yd(g.H) + 6}" class="s-pilee"/>`; });
    s += `<line x1="${X(r.X0 + g.cs)}" x2="${X(r.X1 - g.cs)}" y1="${Yd(g.H - g.cb)}" y2="${Yd(g.H - g.cb)}" class="s-tie"/>`;
    if (g.method === 'stm') {
      const zt = Yd(g.H - g.cb - r.z);
      px.forEach(p => { s += `<line x1="${X(Math.sign(p.x) * g.cx / 4)}" y1="${zt}" x2="${X(p.x)}" y2="${Yd(g.H - g.cb)}" class="s-strut"/>`; });
      s += `<text x="${X(r.X1) + 4}" y="${(zt + Yd(g.H - g.cb)) / 2}" class="s-lbl">z</text>`;
    }
    const [hv] = outVal(g.H, 'mm');
    s += `<text x="${X(r.X0) - 6}" y="${top + g.H * k / 2}" text-anchor="end" class="s-lbl">H=${f(hv, 0)}</text></svg></div></div>`;
    return s;
  }

  // ------------------------------------------------------------------ gantry drawings
  function gantrySketch(r) {
    const g = r.geo, col = r.col, arm = r.arm, cn = r.conn;
    const colW = col.shape === 'RHS' ? col.B : col.D;
    const W = 360, H = 300, pl = 58, pr = 18, pt = 26, pb = 34;
    const zTop = Math.max(g.H + arm.D / 2, g.zs + g.Hs / 2) + 250, xMin = -Math.max(900, colW), xMax = g.L + 250;
    const k = Math.min((W - pl - pr) / (xMax - xMin), (H - pt - pb) / zTop);
    const X = x => pl + (x - xMin) * k, Y = z => H - pb - z * k;
    const cw = Math.max(4, colW * k), ad = Math.max(4, arm.D * k), bp = r.base.plateSide;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="sec-svg gantry-svg" role="img" aria-label="${T('Gantry elevation', 'รูปด้านโครงป้าย')}">`;
    s += `<line x1="${X(xMin) - 10}" x2="${W - 4}" y1="${Y(0)}" y2="${Y(0)}" class="g-ground"/>`;
    for (let x = X(xMin) - 6; x < W - 6; x += 9) s += `<line x1="${x}" x2="${x - 6}" y1="${Y(0)}" y2="${Y(0) + 6}" class="g-hatch"/>`;
    s += `<rect x="${X(-bp / 2)}" y="${Y(0) - 3}" width="${bp * k}" height="3" class="g-plate"/>`;
    s += `<rect x="${X(0) - cw / 2}" y="${Y(g.H + arm.D / 2)}" width="${cw}" height="${(g.H + arm.D / 2) * k - 3}" class="g-steel"/>`;
    s += `<rect x="${X(0) + cw / 2}" y="${Y(g.H) - ad / 2}" width="${(g.L - colW / 2) * k}" height="${ad}" class="g-steel"/>`;
    if (cn.type === 'bolt') { const xf = X(g.x0 + cn.Lst); s += `<line x1="${xf - 1.5}" x2="${xf - 1.5}" y1="${Y(g.H) - ad / 2 - 4}" y2="${Y(g.H) + ad / 2 + 4}" class="g-flange"/><line x1="${xf + 1.5}" x2="${xf + 1.5}" y1="${Y(g.H) - ad / 2 - 4}" y2="${Y(g.H) + ad / 2 + 4}" class="g-flange"/>`; }
    const sx = X(g.xs - g.Bs / 2), sy = Y(g.zs + g.Hs / 2), sw = g.Bs * k, sh = g.Hs * k;
    s += `<rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="2" class="g-sign"/><text x="${sx + sw / 2}" y="${sy + sh / 2 + 4}" text-anchor="middle" class="g-signt">${T('SIGN', 'ป้าย')} ${f(g.Bs / 1000, 1)}×${f(g.Hs / 1000, 1)}</text>`;
    // wind symbol (into page, normal to sign)
    s += `<circle cx="${sx + sw + 11}" cy="${sy + 8}" r="6" class="g-wind"/><path d="M${sx + sw + 7} ${sy + 4}l8 8M${sx + sw + 15} ${sy + 4}l-8 8" class="g-wind"/>`;
    // dimensions
    const dx = X(0) - cw / 2 - 22;
    s += `<line x1="${dx}" x2="${dx}" y1="${Y(0)}" y2="${Y(g.H)}" class="s-dim"/><path d="M${dx - 4} ${Y(g.H)}h8M${dx - 4} ${Y(0)}h8" class="s-dim"/><text transform="translate(${dx - 6} ${(Y(0) + Y(g.H)) / 2}) rotate(-90)" text-anchor="middle" class="s-lbl">H = ${f(g.H / 1000, 2)} m</text>`;
    const dy = Y(zTop) + 10;
    s += `<line x1="${X(0)}" x2="${X(g.L)}" y1="${dy}" y2="${dy}" class="s-dim"/><path d="M${X(0)} ${dy - 4}v8M${X(g.L)} ${dy - 4}v8" class="s-dim"/><text x="${(X(0) + X(g.L)) / 2}" y="${dy - 5}" text-anchor="middle" class="s-lbl">L = ${f(g.L / 1000, 2)} m</text>`;
    const dy2 = Y(0) + 22;
    s += `<line x1="${X(0)}" x2="${X(g.xs)}" y1="${dy2}" y2="${dy2}" class="s-dim"/><path d="M${X(0)} ${dy2 - 4}v8M${X(g.xs)} ${dy2 - 4}v8" class="s-dim"/><text x="${(X(0) + X(g.xs)) / 2}" y="${dy2 - 4}" text-anchor="middle" class="s-lbl">x_s = ${f(g.xs / 1000, 2)} m</text>`;
    s += '</svg>';
    // plan view
    const P = 110, kp = Math.min((W - pl - pr) / (xMax - xMin), (P - 30) / (2 * Math.max(Math.abs(g.ey) + 600, colW)));
    const Xp = x => pl + (x - xMin) * kp, Yp = y => P / 2 - y * kp;
    let p = `<svg viewBox="0 0 ${W} ${P}" class="sec-svg gantry-svg" role="img" aria-label="${T('Gantry plan', 'ผังโครงป้าย')}">`;
    p += col.shape === 'CHS' ? `<circle cx="${Xp(0)}" cy="${Yp(0)}" r="${Math.max(3, col.D / 2 * kp)}" class="g-steel"/>` : `<rect x="${Xp(-col.B / 2)}" y="${Yp(col.D / 2)}" width="${Math.max(4, col.B * kp)}" height="${Math.max(4, col.D * kp)}" class="g-steel"/>`;
    const aw = Math.max(3, (arm.shape === 'CHS' ? arm.D : arm.B) * kp);
    p += `<rect x="${Xp(colW / 2)}" y="${Yp(0) - aw / 2}" width="${(g.L - colW / 2) * kp}" height="${aw}" class="g-steel"/>`;
    p += `<line x1="${Xp(g.xs - g.Bs / 2)}" x2="${Xp(g.xs + g.Bs / 2)}" y1="${Yp(g.ey)}" y2="${Yp(g.ey)}" class="g-signp"/>`;
    for (let i = 0; i < 4; i++) { const x = Xp(g.xs - g.Bs / 2 + g.Bs * (i + 0.5) / 4), y0 = Yp(g.ey) - 26; p += `<path d="M${x} ${y0}v18M${x - 4} ${y0 + 13}l4 5 4-5" class="g-arrow"/>`; }
    p += `<text x="${Xp(g.xs - g.Bs / 2) - 6}" y="${Yp(g.ey) - 14}" text-anchor="end" class="s-lbl">${T('wind', 'ลม')} ↓</text><text x="${Xp(g.xs - g.Bs / 2) - 6}" y="${Yp(g.ey) + 4}" text-anchor="end" class="s-lbl">e_y = ${f(g.ey, 0)} mm</text>`;
    p += `<text x="${pl - 50}" y="${P - 6}" class="s-lbl">${T('PLAN', 'ผัง')}</text></svg>`;
    const leg = `<ul class="legend"><li><i class="g-k-steel"></i>${T('Column', 'เสา')}: ${esc(col.label)} ${col.grade}</li><li><i class="g-k-steel"></i>${T('Arm', 'คาน')}: ${esc(arm.label)} ${arm.grade}</li><li><i class="g-k-sign"></i>${T('Sign', 'ป้าย')} ${f(g.Bs * g.Hs / 1e6, 2)} m²</li></ul>`;
    return s + p + leg;
  }
  function gantryDetails(r) {
    const col = r.col, arm = r.arm, b = r.base, cn = r.conn, x = r.input.base;
    // base plate plan
    const W = 230, P = b.plateSide, k = (W - 40) / P, c = W / 2, U = u => c + u * k, V = v => c - v * k;
    const circP = b.shape === 'circle';
    let s = `<svg viewBox="0 0 ${W} ${W}" class="det-svg" role="img" aria-label="${T('Base plate plan', 'ผังแผ่นฐาน')}">${circP ? `<circle cx="${c}" cy="${c}" r="${P / 2 * k}" class="g-plate2"/>` : `<rect x="${U(-P / 2)}" y="${V(P / 2)}" width="${P * k}" height="${P * k}" class="g-plate2"/>`}`;
    b.stiff.forEach(st => { s += `<line x1="${U(st.u)}" y1="${V(st.v)}" x2="${U(st.u + st.nu * b.Ls)}" y2="${V(st.v + st.nv * b.Ls)}" class="g-stiff" style="stroke-width:${Math.max(2, x.ts * k)}"/>`; });
    s += col.shape === 'CHS' ? `<circle cx="${c}" cy="${c}" r="${col.D / 2 * k}" class="g-tube"/>` : `<rect x="${U(-col.B / 2)}" y="${V(col.D / 2)}" width="${col.B * k}" height="${col.D * k}" rx="${col.ro * k}" class="g-tube"/>`;
    b.bolts.pts.forEach(q => { s += `<circle cx="${U(q.u)}" cy="${V(q.v)}" r="${Math.max(3, (+x.db.slice(1)) / 2 * k)}" class="g-bolt"/>`; });
    s += `<text x="${c}" y="${W - 6}" text-anchor="middle" class="s-lbl">${circP ? 'Ø' + f(P, 0) : f(P, 0) + ' × ' + f(P, 0)} × ${x.tp} · ${x.nb}×${x.db} ${x.bg}</text><text x="${W - 8}" y="14" text-anchor="end" class="s-lbl">↑ ${T('wind axis', 'แกนลม')}</text></svg>`;
    // base plate elevation (section through two opposite bolts)
    const We = 270, He = 236, Pp = b.plateSide, ke = (We - 40) / Pp, ce = We / 2, yc = He - 64, tpp = Math.max(4, x.tp * ke), gap = Math.max(5, 50 * ke);
    const yTop = yc - gap - tpp, db = +x.db.slice(1), FS = SC3D.FAST(db / 1000), px = v => Math.max(2, v * 1000 * ke);
    const halfC = (col.shape === 'RHS' ? col.B : col.D) / 2, bx = (b.bolts.shape === 'circle' ? b.bolts.R : b.bolts.hu);
    let el = `<svg viewBox="0 0 ${We} ${He}" class="det-svg" role="img" aria-label="${T('Base plate elevation', 'รูปตัดแผ่นฐาน')}">`;
    el += `<rect x="4" y="${yc}" width="${We - 8}" height="${He - yc - 4}" class="g-conc"/><line x1="4" x2="${We - 4}" y1="${yc}" y2="${yc}" class="g-ground"/>`;
    el += `<rect x="${ce - Pp / 2 * ke}" y="${yc - gap}" width="${Pp * ke}" height="${gap}" class="g-grout"/>`;
    el += `<rect x="${ce - Pp / 2 * ke}" y="${yTop}" width="${Pp * ke}" height="${tpp}" class="g-plate"/>`;
    const tw = Math.max(3, col.t * ke);
    el += `<rect x="${ce - halfC * ke}" y="8" width="${2 * halfC * ke}" height="${yTop - 8}" class="g-tube2"/><rect x="${ce - halfC * ke}" y="8" width="${tw}" height="${yTop - 8}" class="g-steelw"/><rect x="${ce + halfC * ke - tw}" y="8" width="${tw}" height="${yTop - 8}" class="g-steelw"/>`;
    el += `<path d="M${ce - halfC * ke - 6} 8q8 -6 16 0t16 0M${ce + halfC * ke - 26} 8q8 -6 16 0t16 0" class="g-break"/>`;
    if (x.stiff) {
      const poly = SC3D.trapStiff(b.Ls / 1000, x.hs / 1000);
      [-1, 1].forEach(sg => { el += `<polygon points="${poly.map(([rr, zz]) => (ce + sg * (halfC + rr * 1000) * ke) + ',' + (yTop - zz * 1000 * ke)).join(' ')}" class="g-stiffe"/>`; });
    }
    [-1, 1].forEach(sg => {
      const X0 = ce + sg * bx * ke, bw = Math.max(3, db * ke), ww = px(FS.wd), wt = Math.max(2, px(FS.wt)), nw = px(FS.s), nh = Math.max(4, px(FS.m)), jh = Math.max(3, px(FS.mj));
      el += `<rect x="${X0 - bw / 2}" y="${yTop - wt - nh - jh - 6}" width="${bw}" height="${yc - (yTop - wt - nh - jh - 6)}" class="g-boltr"/><line x1="${X0}" x2="${X0}" y1="${yc}" y2="${yc + 12}" class="g-embed"/>`;
      let y = yTop; el += `<rect x="${X0 - ww / 2}" y="${y - wt}" width="${ww}" height="${wt}" class="g-washer"/>`; y -= wt;
      el += `<rect x="${X0 - nw / 2}" y="${y - nh}" width="${nw}" height="${nh}" class="g-nut"/>`; y -= nh;
      el += `<rect x="${X0 - nw / 2}" y="${y - jh}" width="${nw}" height="${jh}" class="g-nut"/>`;
      let yb = yTop + tpp; el += `<rect x="${X0 - ww / 2}" y="${yb}" width="${ww}" height="${wt}" class="g-washer"/>`; yb += wt;
      el += `<rect x="${X0 - nw / 2}" y="${yb}" width="${nw}" height="${Math.min(nh, yc - yb)}" class="g-nut"/>`;
    });
    el += `<text x="${ce}" y="${yc + 26}" text-anchor="middle" class="s-lbl">${T('Top: washer · nut · lock nut', 'บน: แหวน · น็อต · น็อตล็อก')}</text><text x="${ce}" y="${yc + 40}" text-anchor="middle" class="s-lbl">${T('Under plate: levelling nut + washer', 'ใต้แผ่น: น็อตปรับระดับ + แหวน')}</text>`;
    el += `<text x="${ce}" y="${He - 8}" text-anchor="middle" class="s-lbl g-inv2">${T('grout', 'ปูนเกราท์')} 50 · ${x.tp} ${T('plate', 'แผ่น')}${x.stiff ? ' · ' + T('stiffener', 'แผ่นเสริม') + ' ' + x.ts + '×' + x.hs : ''}</text></svg>`;
    // arm connection elevation
    const Wc = 260, Hc = 204, kc = Math.min(110 / Math.max(arm.D, 200), 0.35), zc = (Hc - 48) / 2, x0 = 50;
    const colW = Math.max(18, (col.shape === 'RHS' ? col.B : col.D) * kc * 0.5), ad = arm.D * kc;
    let cst = `<svg viewBox="0 0 ${Wc} ${Hc}" class="det-svg" role="img" aria-label="${T('Arm connection', 'รอยต่อคาน')}"><rect x="${x0 - colW}" y="6" width="${colW}" height="${Hc - 50}" class="g-steel"/>`;
    if (cn.type === 'bolt') {
      const ls = Math.max(24, cn.Lst * kc), tp = Math.max(3, cn.tep * kc), ph = Math.min(Hc - 60, ad + 2 * Math.max(10, (cn.af + 30) * kc));
      cst += `<rect x="${x0}" y="${zc - ad / 2}" width="${ls}" height="${ad}" class="g-steel"/><rect x="${x0 + ls}" y="${zc - ph / 2}" width="${tp}" height="${ph}" class="g-plate"/><rect x="${x0 + ls + tp + 1}" y="${zc - ph / 2}" width="${tp}" height="${ph}" class="g-plate"/>`;
      cst += `<rect x="${x0 + ls + 2 * tp + 1}" y="${zc - ad / 2}" width="${Wc - (x0 + ls + 2 * tp + 1) - 6}" height="${ad}" class="g-steel"/>`;
      [-1, 1].forEach(sg => {
        const yb = zc + sg * (ad / 2 + Math.max(6, cn.af * kc)), xa = x0 + ls, xb = x0 + ls + 2 * tp + 1;
        cst += `<rect x="${xa - 16}" y="${yb - 2}" width="${xb - xa + 34}" height="4" class="g-boltr"/>`;
        cst += `<rect x="${xa - 3}" y="${yb - 7}" width="3" height="14" class="g-washer"/><rect x="${xa - 10}" y="${yb - 6}" width="7" height="12" class="g-nut"/>`;
        cst += `<rect x="${xb}" y="${yb - 7}" width="3" height="14" class="g-washer"/><rect x="${xb + 3}" y="${yb - 6}" width="8" height="12" class="g-nut"/><rect x="${xb + 11}" y="${yb - 6}" width="5" height="12" class="g-nut"/>`;
      });
      cst += `<text x="6" y="${Hc - 18}" class="s-lbl">${T('Left: bolt head + washer', 'ซ้าย: หัวสลัก + แหวน')}</text><text x="6" y="${Hc - 5}" class="s-lbl">${T('Right: washer · nut · lock nut', 'ขวา: แหวน · น็อต · น็อตล็อก')}</text>`;
      cst += `<text x="6" y="${Hc - 31}" class="s-lbl">${cn.nf} × ${cn.fb} ${T('grade', 'เกรด')} ${cn.fg} · ${T('end plates', 'แผ่นปลาย')} ${cn.tep} mm</text>`;
    } else {
      cst += `<rect x="${x0}" y="${zc - ad / 2}" width="${Wc - x0 - 6}" height="${ad}" class="g-steel"/>`;
      [-1, 1].forEach(sg => { const y = zc + sg * ad / 2; cst += `<path d="M${x0} ${y}l8 ${sg * 8}h-8z" class="g-weld"/>`; });
      cst += `<text x="${x0 + 60}" y="${Hc - 4}" text-anchor="middle" class="s-lbl">${cn.weld === 'cjp' ? T('CJP butt weld', 'เชื่อมชนทะลุเต็ม') : T('Fillet ', 'เชื่อมพอก ') + cn.sa + ' mm'}</text>`;
    }
    cst += `<text x="${x0 - colW / 2}" y="${(Hc - 44) / 2}" transform="rotate(-90 ${x0 - colW / 2} ${(Hc - 44) / 2})" text-anchor="middle" class="s-lbl g-inv">${T('COLUMN', 'เสา')}</text><text x="${Wc - 10}" y="${zc + 4}" text-anchor="end" class="s-lbl g-inv">${T('ARM', 'คาน')}</text></svg>`;
    // fatigue table
    let ft = '';
    if (r.fat && r.fat.rows.length) {
      const dets = [...new Set(r.fat.rows.map(q => q.det))], cases = r.fat.cases;
      ft = `<div class="tbl-wrap"><table class="chk fat-t"><thead><tr><th>${T('Fatigue detail', 'รายละเอียดความล้า')}</th><th class="num">FAT</th><th class="num">φ<sub>f</sub>f<sub>3</sub></th>${cases.map(cs => `<th class="num">Δσ ${esc(cs)}</th>`).join('')}<th>UR</th></tr></thead><tbody>
        ${dets.map(d => { const rows = r.fat.rows.filter(q => q.det === d), u = Math.max(...rows.map(q => q.ur)); return `<tr class="${urClass(u)}"><td>${esc(d)}</td><td class="num mono">${rows[0].cat}</td><td class="num mono">${f(rows[0].cap, 1)}</td>${cases.map(cs => { const q = rows.find(z => z.cs === cs); return `<td class="num mono">${q ? f(q.ds, 1) : '—'}</td>`; }).join('')}<td><div class="urb"><div class="ur"><i style="width:${Math.min(100, u * 100)}%"></i></div><b class="mono">${f(u, 2)}</b></div></td></tr>`; }).join('')}
      </tbody></table></div><p class="hint">${T('Stress ranges in MPa. Infinite-life check: Δσ ≤ φ_f·f₃ with f₃ = 0.737·FAT (AS 4100 §11.6).', 'ช่วงหน่วยแรงหน่วย MPa ตรวจอายุไม่จำกัด: Δσ ≤ φ_f·f₃, f₃ = 0.737·FAT (AS 4100 §11.6)')}</p>`;
    }
    let epf = '';
    const fp = r.flange && r.flange.plate;
    if (cn.type === 'bolt' && fp) {
      const We2 = 230, kk = (We2 - 40) / fp.size, c2 = We2 / 2;
      epf = `<svg viewBox="0 0 ${We2} ${We2}" class="det-svg" role="img" aria-label="${T('End plate face', 'หน้าแผ่นปลาย')}">`;
      epf += fp.shape === 'circle' ? `<circle cx="${c2}" cy="${c2}" r="${fp.size / 2 * kk}" class="g-plate2"/>` : `<rect x="${c2 - fp.size / 2 * kk}" y="${c2 - fp.size / 2 * kk}" width="${fp.size * kk}" height="${fp.size * kk}" class="g-plate2"/>`;
      epf += arm.shape === 'CHS' ? `<circle cx="${c2}" cy="${c2}" r="${arm.D / 2 * kk}" class="g-tube"/>` : `<rect x="${c2 - arm.B / 2 * kk}" y="${c2 - arm.D / 2 * kk}" width="${arm.B * kk}" height="${arm.D * kk}" rx="${arm.ro * kk}" class="g-tube"/>`;
      r.flange.pts.forEach(q => { epf += `<circle cx="${c2 + q.u * kk}" cy="${c2 - q.v * kk}" r="${Math.max(3, (+cn.fb.slice(1)) / 2 * kk)}" class="g-bolt"/>`; });
      epf += `<text x="${c2}" y="${We2 - 6}" text-anchor="middle" class="s-lbl">${fp.shape === 'circle' ? 'Ø' + f(fp.size, 0) : f(fp.size, 0) + ' × ' + f(fp.size, 0)} × ${cn.tep} · ${cn.nf}×${cn.fb} ${cn.fg}</text></svg>`;
      epf = `<figure class="det"><figcaption>${T('End plate (stub / arm)', 'แผ่นปลาย (ท่อสั้น / คาน)')}</figcaption>${epf}</figure>`;
    }
    return `<div class="gx"><figure class="det"><figcaption>${T('Base plate plan', 'ผังแผ่นฐาน')}</figcaption>${s}</figure><figure class="det"><figcaption>${T('Base plate elevation', 'รูปตัดแผ่นฐาน')}</figcaption>${el}</figure><figure class="det"><figcaption>${cn.type === 'bolt' ? T('Stub and bolted end plates', 'ท่อสั้นและแผ่นปลายยึดสลัก') : T('Arm welded to column', 'คานเชื่อมเข้ากับเสา')}</figcaption>${cst}</figure>${epf}</div>${ft}`;
  }

  // ------------------------------------------------------------------ 3D view (gantry)
  S.v3 = { view: 'overall', cs: 'none', mode: 'ur', cam: null };
  let viewer = null;
  const worstCase = r => { if (!r.fat || !r.fat.rows.length) return 'none'; const w = r.fat.rows.reduce((p, q) => q.ur > p.ur ? q : p); const c = r.fat.caseObjs.find(o => o.nm === w.cs); return c ? c.id : 'none'; };
  function themeColors() {
    const cs = getComputedStyle(document.documentElement), get = k => cs.getPropertyValue(k).trim(), dk = matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme !== 'light' || document.documentElement.dataset.theme === 'dark';
    const tryHex = (k, d) => { try { const v = get(k); return v.startsWith('#') ? SC3D.hex(v) : d; } catch (e) { return d; } };
    return { bg: tryHex('--card', dk ? [20, 30, 49] : [255, 255, 255]), steel: dk ? [128, 146, 178] : [158, 174, 200], dark: dk ? [70, 78, 96] : [72, 80, 98], concrete: dk ? [70, 76, 88] : [206, 208, 204], washer: dk ? [150, 158, 172] : [200, 206, 216], sign: tryHex('--teal', [0, 168, 154]), bolt: tryHex('--acc', [255, 106, 43]) };
  }
  function v3Card(r) {
    const cases = r.fat && r.fat.caseObjs ? r.fat.caseObjs : [], st = S.v3;
    if (st.cs !== 'none' && !cases.some(c => c.id === st.cs)) st.cs = 'none';
    const views = [['overall', T('Overall', 'ภาพรวม')], ['base', T('Base connection', 'รอยต่อฐาน')], ['arm', r.conn.type === 'bolt' ? T('Stub and flange', 'ท่อสั้นและหน้าแปลน') : T('Arm connection', 'รอยต่อคาน')]];
    return `<div class="card v3"><div class="v3-head"><h2 class="card-h">${T('3D view', 'มุมมอง 3 มิติ')}</h2>
      <div class="seg" role="group" aria-label="${T('Camera', 'มุมกล้อง')}">${views.map(([k, l]) => `<button data-act="v3view" data-p="${k}" aria-pressed="${st.view === k}">${l}</button>`).join('')}</div></div>
      <div class="v3-tools"><label for="v3case">${T('Fatigue stress range', 'ช่วงหน่วยแรงล้า')}</label><select id="v3case"${cases.length ? '' : ' disabled'}><option value="none">${T('Off', 'ปิด')}</option>${cases.map(c => `<option value="${c.id}" ${st.cs === c.id ? 'selected' : ''}>${esc(c.nm)}</option>`).join('')}</select>
        <label for="v3mode">${T('Colour by', 'ระบายสีตาม')}</label><select id="v3mode"${st.cs === 'none' ? ' disabled' : ''}><option value="ur" ${st.mode === 'ur' ? 'selected' : ''}>${T('Utilisation Δσ / φ_f·f₃', 'อัตราส่วน Δσ / φ_f·f₃')}</option><option value="mpa" ${st.mode === 'mpa' ? 'selected' : ''}>${T('Stress range Δσ (MPa)', 'ช่วงหน่วยแรง Δσ (MPa)')}</option></select>
        <button class="btn btn-ghost xs" data-act="v3reset">${T('Reset view', 'รีเซ็ตมุมมอง')}</button></div>
      <canvas id="v3c" class="v3c" tabindex="0" aria-label="${T('3D model of the gantry. Drag to rotate, shift-drag or two fingers to pan, scroll or pinch to zoom, arrow keys to rotate.', 'แบบจำลอง 3 มิติ ลากเพื่อหมุน กด shift ค้างแล้วลากหรือใช้สองนิ้วเพื่อเลื่อน เลื่อนล้อหรือบีบนิ้วเพื่อซูม')}"></canvas>
      <div id="v3leg" class="v3-leg"></div>
      <div id="v3pick" class="v3-pick" aria-live="polite"></div>
      <p class="hint">${T('Drag to rotate · shift-drag / two fingers to pan · scroll / pinch to zoom. The contour is the nominal stress range from beam theory on the modelled sections (stiffeners included at the base). It shows how the stress is distributed around each weld; it is not a finite-element hot-spot analysis — weld-toe concentration is covered by the detail category.', 'ลากเพื่อหมุน · shift+ลาก / สองนิ้วเพื่อเลื่อน · เลื่อนล้อ / บีบนิ้วเพื่อซูม สีแสดงช่วงหน่วยแรงระบุจากทฤษฎีคาน (รวมแผ่นเสริมที่ฐาน) เพื่อดูการกระจายหน่วยแรงรอบรอยเชื่อม ไม่ใช่การวิเคราะห์ไฟไนต์เอลิเมนต์แบบจุดร้อน ความเข้มข้นของหน่วยแรงที่ขอบรอยเชื่อมครอบคลุมโดยหมวดรายละเอียด')}</p></div>`;
  }
  const niceMax = v => { if (!(v > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
  function colorFn(mode, smax) {
    return s => { const a = (s[0][mode === 'ur' ? 'ur' : 'mpa'] + s[1][mode === 'ur' ? 'ur' : 'mpa'] + s[2][mode === 'ur' ? 'ur' : 'mpa']) / 3; return SC3D.ramp(mode === 'ur' ? a : Math.min(1, a / smax)); };
  }
  const PART = () => ({ found: T('Foundation', 'ฐานคอนกรีต'), plate: T('Base plate', 'แผ่นฐาน'), anchor: T('Anchor bolt', 'สลักยึด'), stiff: T('Stiffener', 'แผ่นเสริม'), col: T('Column', 'เสา'),
    bweld: T('Column-to-base weld', 'รอยเชื่อมเสา-ฐาน'), stub: T('Stub', 'ท่อสั้น'), arm: T('Arm', 'คาน'), eplate: T('End plate', 'แผ่นปลาย'), fbolt: T('Flange bolt', 'สลักหน้าแปลน'),
    aweld: S.res && S.res.conn.type === 'bolt' ? T('Stub-to-column weld', 'รอยเชื่อมท่อสั้น-เสา') : T('Arm-to-column weld', 'รอยเชื่อมคาน-เสา'), sign: T('Sign panel', 'แผ่นป้าย'), bracket: T('Sign bracket', 'ขายึดป้าย') });
  // location text in the terms an engineer uses for that part
  function where(sel) {
    const p = sel.p.map(v => v * 1000), nm = PART()[sel.tag] || sel.tag;
    if (['col', 'bweld', 'stiff'].includes(sel.tag)) return nm + ' · z = ' + f(Math.max(0, p[2]), 0) + ' mm';
    if (['arm', 'stub', 'aweld'].includes(sel.tag)) return nm + ' · x = ' + f(p[0], 0) + ' mm';
    return nm + ' · ' + f(p[0], 0) + ', ' + f(p[1], 0) + ', ' + f(p[2], 0) + ' mm';
  }
  const stressTxt = s => 'Δσ = ' + f(s.mpa, 1) + ' MPa · UR ' + f(s.ur, 2);
  function mount3D(r) {
    const cv = $('#v3c'); if (!cv || !window.SC3D) return;
    const pre = SC3D.presets(r), theme = themeColors(), st = S.v3;
    if (!st.cam) st.cam = Object.assign({}, pre[st.view]);
    viewer = cv._v || new SC3D.Viewer(cv, st.cam); cv._v = viewer;
    viewer.cam = Object.assign({}, viewer.cam, st.cam); viewer.sel = null;
    viewer.onchange = c => { st.cam = Object.assign({}, c); };
    viewer.bg = theme.bg;
    const sc = SC3D.gantryScene(r, { stress: st.cs === 'none' ? null : st.cs }, theme);
    viewer.mesh = sc.mesh;
    const smax = niceMax(sc.smax);
    viewer.color = st.cs === 'none' ? null : colorFn(st.mode, smax);
    viewer.fmtPick = sel => sel.s ? [where(sel), stressTxt(sel.s)] : [where(sel), st.cs === 'none' ? T('select a fatigue case to see stress', 'เลือกกรณีความล้าเพื่อดูหน่วยแรง') : T('not stress-checked in this model', 'ไม่ได้คำนวณหน่วยแรงในแบบจำลองนี้')];
    viewer.marks = [];
    // each view labels the maximum within its own region
    const region = { base: ['col', 'bweld', 'stiff', 'anchor'], arm: ['arm', 'aweld', 'stub', 'eplate', 'fbolt'] }[st.view];
    if (region && sc.byTag) {
      const pickMax = k => region.map(t => sc.byTag[t] && sc.byTag[t][k]).filter(Boolean).reduce((p, q) => !p || q.s[k === 'm' ? 'mpa' : 'ur'] > p.s[k === 'm' ? 'mpa' : 'ur'] ? q : p, null);
      sc.maxM = pickMax('m'); sc.maxU = pickMax('u');
    }
    if (st.cs !== 'none' && sc.maxM) {
      viewer.marks.push({ p: sc.maxM.p, kind: 'max', lines: [(region ? T('MAX Δσ in view', 'Δσ สูงสุดในมุมนี้') : T('MAX Δσ', 'Δσ สูงสุด')) + ' ' + f(sc.maxM.s.mpa, 1) + ' MPa', where(sc.maxM), 'UR ' + f(sc.maxM.s.ur, 2)] });
      if (sc.maxU && Math.hypot(...sc.maxU.p.map((v, i) => v - sc.maxM.p[i])) > 0.05) viewer.marks.push({ p: sc.maxU.p, kind: 'maxu', lines: [T('MAX UR', 'UR สูงสุด') + ' ' + f(sc.maxU.s.ur, 2), where(sc.maxU), 'Δσ ' + f(sc.maxU.s.mpa, 1) + ' MPa'] });
    }
    const pickBox = $('#v3pick');
    const showPick = sel => { if (!pickBox) return; pickBox.innerHTML = sel ? `<b>${T('Selected', 'จุดที่เลือก')}:</b> ${esc(where(sel))}${sel.s ? ' · <span class="mono">' + esc(stressTxt(sel.s)) + '</span>' : ''} <button class="linkbtn" data-act="v3clear">${T('Clear', 'ล้าง')}</button>` : `<span class="muted">${T('Click the model to read the stress range at any point.', 'คลิกที่แบบจำลองเพื่ออ่านช่วงหน่วยแรง ณ จุดนั้น')}</span>`; };
    viewer.onpick = showPick;
    showPick(null);
    viewer.draw();
    const leg = $('#v3leg');
    if (st.cs === 'none') { leg.innerHTML = ''; return; }
    const ticks = st.mode === 'ur' ? ['0', '0.25', '0.50', '0.75', '1.00'] : [0, 0.25, 0.5, 0.75, 1].map(t => f(t * smax, smax < 10 ? 1 : 0));
    const cname = sc.cs ? sc.cs.nm : '';
    leg.innerHTML = `<div class="v3-bar"><span class="v3-grad"></span>${st.mode === 'ur' ? '<span class="v3-over">&gt; 1.0</span>' : ''}</div><div class="v3-ticks">${ticks.map(t => `<span>${t}</span>`).join('')}${st.mode === 'ur' ? '<span></span>' : ''}</div>
      <p class="v3-cap">${esc(cname)} · ${st.mode === 'ur' ? T('UR = Δσ / φ_f·f₃ of the detail at each location (plain tube: FAT 140)', 'UR = Δσ / φ_f·f₃ ของรายละเอียด ณ ตำแหน่งนั้น (ท่อปกติ: FAT 140)') : T('Δσ in MPa', 'Δσ หน่วย MPa')} · ${T('model max Δσ', 'Δσ สูงสุดทั้งแบบจำลอง')} ${f(sc.smax, 1)} MPa</p>`;
  }
  function snapshot3D(r, view, cs) {
    if (!window.SC3D) return '';
    const oc = document.createElement('canvas'), theme = themeColors(), pre = SC3D.presets(r);
    theme.bg = [255, 255, 255];
    const v = new SC3D.Viewer(oc, pre[view]), sc = SC3D.gantryScene(r, { stress: cs }, theme);
    v.bg = theme.bg; v.mesh = sc.mesh; v.color = cs ? colorFn('ur', 1) : null;
    v.marks = cs && sc.maxM ? [{ p: sc.maxM.p, kind: 'max', lines: [T('MAX Δσ', 'Δσ สูงสุด') + ' ' + f(sc.maxM.s.mpa, 1) + ' MPa', where(sc.maxM)] }] : [];
    v.draw(720, 430);
    try { return oc.toDataURL('image/png'); } catch (e) { return ''; }
  }
  // ------------------------------------------------------------------ limestone block wall
  function wallSketch(r) {
    const cs = r.cs, H = r.H, top = cs[cs.length - 1], inp0 = r.input, b0 = r.parts[0], ld = inp0.load;
    const tb = Math.tan((r.beta || 0) * Math.PI / 180), Hs = r.Hs, zs = x => x <= r.xs0 ? Hs : Hs + (x - r.xs0) * tb;
    const xL = -Math.max(700, 0.45 * H), xR = Math.max(b0.xv, r.xs0) + Math.max(1200, 0.9 * H), zmin = -Math.max(250, 0.15 * H);
    const zmax = Math.max(zs(xR), H + (ld.Hr > 0 ? ld.hr : 0)) + 350;
    const W = 360, SH = 320, pl = 30, pr = 12, pt = 16, pb = 30, k = Math.min((W - pl - pr) / (xR - xL), (SH - pt - pb) / (zmax - zmin));
    const X = x => pl + (x - xL) * k, Y = z => SH - pb - (z - zmin) * k;
    let s = `<svg viewBox="0 0 ${W} ${SH}" class="sec-svg" role="img" aria-label="${T('Limestone wall section', 'รูปตัดกำแพงหินปูน')}"><defs><pattern id="wsoil" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 7L7 0" class="w-hatch"/></pattern></defs>`;
    // foundation and front ground
    s += `<rect x="${X(xL)}" y="${Y(0)}" width="${(xR - xL) * k}" height="${(0 - zmin) * k}" class="w-found"/>`;
    s += `<rect x="${X(xL)}" y="${Y(inp0.geo.e)}" width="${(cs[0].xf - xL) * k}" height="${inp0.geo.e * k}" class="w-soil"/>`;
    // retained soil
    const back = [];
    cs.forEach((c, i) => { back.push([c.xb, c.z0], [c.xb, c.z1]); });
    const back2 = []; back.forEach(p => { if (p[1] <= Hs) back2.push(p); else if (!back2.some(q => q[1] === Hs && q[0] === p[0])) back2.push([p[0], Hs]); });
    const pts = back2.concat(r.xs0 > top.xb ? [[r.xs0, Hs]] : []).concat([[xR, zs(xR)], [xR, 0]]);
    const soilD = `M${pts.map(p => X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(' L')} Z`;
    s += `<defs><clipPath id="wsclip"><path d="${soilD}"/></clipPath></defs><path d="${soilD}" class="w-soil"/>`;
    s += `<path d="M${X(top.xb)} ${Y(Hs)} L${X(Math.max(top.xb, r.xs0))} ${Y(Hs)} L${X(xR)} ${Y(zs(xR))}" class="w-ground"/><line x1="${X(xL)}" x2="${X(cs[0].xf)}" y1="${Y(inp0.geo.e)}" y2="${Y(inp0.geo.e)}" class="w-ground"/>`;
    // groundwater
    if (r.wat && r.hw > 0) {
      s += `<g clip-path="url(#wsclip)"><rect x="${X(cs[0].xf)}" y="${Y(r.hw)}" width="${(xR - cs[0].xf) * k}" height="${r.hw * k}" class="w-water"/><line x1="${X(cs[0].xf)}" x2="${X(xR)}" y1="${Y(r.hw)}" y2="${Y(r.hw)}" class="w-wline"/></g>`;
      const xm = X(xR) - 26; s += `<path d="M${xm - 5} ${Y(r.hw) - 8}h10l-5 7z" class="w-wtri"/><text x="${xm - 8}" y="${Y(r.hw) - 10}" text-anchor="end" class="s-lbl w-wt">h_w ${f(r.hw, 0)}</text>`.replace('h_w', 'hw');
      if (r.hwf > 0) s += `<line x1="${X(xL)}" x2="${X(cs[0].xf)}" y1="${Y(r.hwf)}" y2="${Y(r.hwf)}" class="w-wline"/><path d="M${X(xL) + 22} ${Y(r.hwf) - 8}h10l-5 7z" class="w-wtri"/>`;
    }
    // blocks
    const bx = inp0.geo.bx;
    cs.forEach(c => { for (let j = 0; j < c.n; j++) s += `<rect x="${X(c.xf + j * bx) + 0.6}" y="${Y(c.z1) + 0.6}" width="${bx * k - 1.2}" height="${(c.z1 - c.z0) * k - 1.2}" rx="1.5" class="w-block"/>`; });
    // worst joint
    const wj = r.parts.slice(1).reduce((p, q) => (!p || Math.max(q.ot.urOT, q.sl.urSL) > Math.max(p.ot.urOT, p.sl.urSL) ? q : p), null);
    if (wj) s += `<line x1="${X(wj.xt)}" x2="${X(wj.xh) + 2}" y1="${Y(wj.zb)}" y2="${Y(wj.zb)}" class="w-joint"/><text x="${X(wj.xh) + 5}" y="${Y(wj.zb) + 4}" class="s-lbl w-jt">${T('joint', 'รอยต่อ')} ${wj.k}</text>`;
    // surcharge
    if (ld.q > 0) {
      const xa = Math.max(top.xf, xL), xb2 = ld.qext === 'crest' ? r.xs0 : xR - 60, n = Math.max(3, Math.round((xb2 - xa) * k / 16));
      const zq = x => (x >= top.xf && x <= top.xb) ? H : zs(x);
      for (let i = 0; i <= n; i++) { const x = xa + (xb2 - xa) * i / n, y0 = Y(zq(x)); s += `<path d="M${X(x)} ${y0 - 16}v13M${X(x) - 3} ${y0 - 7}l3 4 3-4" class="w-load"/>`; }
      const qpts = []; for (let i = 0; i <= n; i++) { const x = xa + (xb2 - xa) * i / n; qpts.push(X(x).toFixed(1) + ' ' + (Y(zq(x)) - 16).toFixed(1)); }
      s += `<path d="M${qpts.join(' L')}" class="w-load"/><text x="${X(xa) + 4}" y="${Y(H) - 21}" class="s-lbl w-lt">q = ${f(ld.q, 1)} kPa</text>`;
    }
    // handrail
    if (ld.Hr > 0) {
      const xh = X(top.xf + 40), y0 = Y(H), y1 = Y(H + ld.hr);
      const dxr = xh - 10; s += `<line x1="${dxr}" x2="${dxr}" y1="${y0}" y2="${y1}" class="s-dim"/><path d="M${dxr - 4} ${y0}h8M${dxr - 4} ${y1}h8" class="s-dim"/><text transform="translate(${dxr - 4} ${(y0 + y1) / 2}) rotate(-90)" text-anchor="middle" class="s-lbl">${f(ld.hr, 0)}</text>`;
      s += `<line x1="${xh}" x2="${xh}" y1="${y0}" y2="${y1}" class="w-rail"/><path d="M${xh + 26} ${y1}h-22M${xh + 9} ${y1 - 4}l-5 4 5 4" class="w-load"/><text x="${xh + 30}" y="${y1 + 4}" class="s-lbl w-lt">H_r ${f(ld.Hr, 2)} kN/m</text>`.replace('H_r', 'Hᵣ');
    }
    // virtual back and thrust at the base
    s += `<line x1="${X(b0.xv)}" x2="${X(b0.xv)}" y1="${Y(0)}" y2="${Y(zs(b0.xv))}" class="w-virt"/>`;
    const ya = Y(b0.aG), L0 = 34;
    s += `<path d="M${X(b0.xv) + L0} ${ya - L0 * Math.tan(r.dlt * Math.PI / 180)}L${X(b0.xv) + 3} ${ya}" class="w-pa"/><path d="M${X(b0.xv) + 3} ${ya}l7 -4M${X(b0.xv) + 3} ${ya}l7 4" class="w-pa"/><text x="${X(b0.xv) + L0 + 3}" y="${ya - L0 * Math.tan(r.dlt * Math.PI / 180) - 3}" class="s-lbl">Pa</text>`;
    // dims
    const dx = X(xL) + 14;
    s += `<line x1="${dx}" x2="${dx}" y1="${Y(0)}" y2="${Y(H)}" class="s-dim"/><path d="M${dx - 4} ${Y(0)}h8M${dx - 4} ${Y(H)}h8" class="s-dim"/><text transform="translate(${dx - 4} ${(Y(0) + Y(H)) / 2}) rotate(-90)" text-anchor="middle" class="s-lbl">H = ${f(H, 0)}</text>`;
    s += `<line x1="${X(cs[0].xf)}" x2="${X(cs[0].xb)}" y1="${Y(zmin) - 8}" y2="${Y(zmin) - 8}" class="s-dim"/><text x="${(X(cs[0].xf) + X(cs[0].xb)) / 2}" y="${Y(zmin) - 12}" text-anchor="middle" class="s-lbl">B = ${f(cs[0].xb - cs[0].xf, 0)}</text>`;
    if (r.ds > 0) { const xd = X(top.xb) + 7; s += `<line x1="${xd}" x2="${xd}" y1="${Y(H)}" y2="${Y(Hs)}" class="s-dim"/><path d="M${xd - 4} ${Y(H)}h8M${xd - 4} ${Y(Hs)}h8" class="s-dim"/><text x="${xd + 5}" y="${Y(Hs) + 12}" class="s-lbl">d<tspan font-size="8" dy="2">s</tspan><tspan dy="-2"> ${f(r.ds, 0)}</tspan></text>`; }
    if (r.Lc > 0 && r.beta > 0) { const yd = Y(Math.max(H, zs(r.xs0))) - 40; s += `<line x1="${X(top.xf)}" x2="${X(r.xs0)}" y1="${yd}" y2="${yd}" class="s-dim w-dimc"/><path d="M${X(top.xf)} ${yd - 4}v8M${X(r.xs0)} ${yd - 4}v8" class="s-dim"/><text x="${X(r.xs0) + 4}" y="${yd + 4}" class="s-lbl">Lc ${f(r.Lc, 0)}</text>`; }
    if (r.beta > 0) s += `<text x="${X(xR) - 6}" y="${Y(zs(xR)) + 14}" text-anchor="end" class="s-lbl">β = ${f(r.beta, 1)}°</text>`;
    s += '</svg>';
    return s + `<ul class="legend"><li><i class="w-block-k"></i>${T('Limestone blocks', 'ก้อนหินปูน')} ${f(inp0.geo.bx, 0)}×${f(inp0.geo.by, 0)}</li><li><i class="w-soil-k"></i>${T('Retained soil', 'ดินถม')}</li><li><i class="w-virt-k"></i>${T('Virtual back', 'ระนาบด้านหลังสมมติ')}</li>${r.wat && r.hw > 0 ? `<li><i class="w-water-k"></i>${T('Groundwater', 'น้ำใต้ดิน')}</li>` : ''}${wj ? `<li><i class="w-joint-k"></i>${T('Critical bed joint', 'รอยต่อวิกฤต')}</li>` : ''}</ul>`;
  }
  function wallTable(r) {
    const row = p => { const b = p.k === 0, u = Math.max(p.ot.urOT, p.sl.urSL, b ? p.br.urB : 0);
      const cell = v => `<td><div class="urb"><div class="ur"><i style="width:${Math.min(100, v * 100)}%"></i></div><b class="mono">${f(v, 2)}</b></div></td>`;
      return `<tr class="${urClass(u)}"><td>${b ? T('Base', 'ฐาน') : T('Joint ', 'รอยต่อ ') + p.k}</td><td class="num mono">${f(p.zb, 0)}</td><td class="num mono">${f(p.B, 0)}</td><td class="num mono">${f(p.sl.V, 1)}</td><td class="num mono">${f(p.sl.Hh, 1)}</td><td class="num mono">${f(p.ot.e / p.B, 3)}</td>${cell(p.ot.urOT)}${cell(p.sl.urSL)}${b ? cell(p.br.urB) : '<td class="num">—</td>'}</tr>`; };
    return `<div class="tbl-wrap"><table class="chk stm-t"><thead><tr><th>${T('Level', 'ระดับ')}</th><th class="num">z (mm)</th><th class="num">B (mm)</th><th class="num">V* (kN/m)</th><th class="num">H* (kN/m)</th><th class="num">e/B</th><th>${T('Overturning', 'การพลิกคว่ำ')}</th><th>${T('Sliding / shear', 'เลื่อนไถล / เฉือน')}</th><th>${T('Bearing', 'แรงแบกทาน')}</th></tr></thead><tbody>${r.parts.map(row).join('')}</tbody></table></div>
      <p class="hint">${T('Each row checks the blocks above that level as one rigid body on its bed: overturning about the front edge, and sliding (base) or shear between the blocks (joints). V*, H* and e/B are from the combination that governs sliding / overturning. e/B ≤ 1/6 keeps the whole joint in compression.', 'แต่ละแถวตรวจก้อนหินเหนือระดับนั้นเป็นวัตถุแข็งบนรอยต่อ: การพลิกคว่ำรอบขอบหน้า และการเลื่อนไถล (ฐาน) หรือแรงเฉือนระหว่างก้อน (รอยต่อ) V*, H* และ e/B มาจากกรณีที่วิกฤต e/B ≤ 1/6 ทำให้รอยต่อรับแรงอัดทั้งหน้าตัด')}</p>`;
  }
  // ------------------------------------------------------------------ 3D strut-and-tie (pile cap)
  const MT = () => ({ strut: T('Strut', 'ค้ำ'), top: T('Top strut', 'ค้ำบน'), tie: T('Tie', 'ตัวยึด') });
  function stmPlan(r) {
    const g = r.input.geo, W = 340, H = 320, pad = 34, k = Math.min((W - 2 * pad) / r.Lx, (H - 2 * pad) / r.Ly);
    const cxm = (r.X0 + r.X1) / 2, cym = (r.Y0 + r.Y1) / 2, X = x => W / 2 + (x - cxm) * k, Y = y => H / 2 - (y - cym) * k;
    const nd = r.nodes;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="sec-svg" role="img" aria-label="${T('Strut-and-tie model, plan', 'ผังแบบจำลองโครงถัก')}">`;
    s += `<path d="M${r.poly.map(p => X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(' L')} Z" class="s-conc"/>`;
    r.piles.forEach((p, i) => { s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${g.Dp / 2 * k}" class="s-pile"/>`; });
    s += `<rect x="${X(-g.cx / 2)}" y="${Y(g.cy / 2)}" width="${g.cx * k}" height="${g.cy * k}" class="s-colp"/>`;
    const order = { tie: 0, strut: 1, top: 2 };
    r.members.slice().sort((a, b) => order[a.type] - order[b.type]).forEach(e => {
      const a = nd[e.a], b = nd[e.b], cls = e.type === 'tie' ? 's-stie' : e.type === 'top' ? 's-stop' : 's-strut';
      s += `<line x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(b.x)}" y2="${Y(b.y)}" class="${cls}${e.ur > 1.0001 ? ' over' : ''}"/>`;
    });
    r.members.filter(e => e.type === 'tie').forEach(e => { const a = nd[e.a], b = nd[e.b]; s += `<text x="${(X(a.x) + X(b.x)) / 2}" y="${(Y(a.y) + Y(b.y)) / 2 - 4}" text-anchor="middle" class="s-tid">${e.id}</text>`; });
    nd.forEach(q => { if (q.kind === 'T') s += `<circle cx="${X(q.x)}" cy="${Y(q.y)}" r="3" class="s-tnode"/>`; });
    r.piles.forEach((p, i) => { s += `<text x="${X(p.x)}" y="${Y(p.y) - 2}" text-anchor="middle" class="s-pid">${p.id}</text><text x="${X(p.x)}" y="${Y(p.y) + 11}" text-anchor="middle" class="s-pv">${f(outVal(r.Pu[i], 'kN')[0], 0)}</text>`; });
    const [lx, lu] = outVal(r.Lx, 'mm'), [ly] = outVal(r.Ly, 'mm');
    s += `<text x="${W / 2}" y="${Y(r.Y0) + 20}" text-anchor="middle" class="s-lbl">Lx = ${f(lx, 0)} ${lu}</text><text transform="translate(${X(r.X0) - 12} ${H / 2}) rotate(-90)" text-anchor="middle" class="s-lbl">Ly = ${f(ly, 0)}</text></svg>`;
    return s + `<ul class="legend"><li><i class="s-pile-k"></i>${T('Pile, P*', 'เข็ม, P*')} (${outVal(1, 'kN')[1]})</li><li><i class="s-strut-k"></i>${T('Inclined struts', 'ค้ำเอียง')}</li><li><i class="s-stop-k"></i>${T('Top struts', 'ค้ำบน')}</li><li><i class="s-stie-k"></i>${T('Ties', 'ตัวยึด')}: ${r.input.geo.tN + RC.barName('AS', r.input.geo.tD)}</li></ul>`;
  }
  function stmTable(r) {
    const nm = i => r.nodes[i].id, mt = MT();
    return `<div class="tbl-wrap"><table class="chk stm-t"><thead><tr><th>${T('Member', 'ชิ้นส่วน')}</th><th>${T('Type', 'ชนิด')}</th><th>${T('Nodes', 'จุดต่อ')}</th><th class="num">L (mm)</th><th class="num">θ</th><th class="num">β<sub>s</sub></th><th class="num">${T('Force', 'แรง')} (${outVal(1, 'kN')[1]})</th><th class="num">${T('Capacity', 'กำลัง')}</th><th>UR</th></tr></thead><tbody>
      ${r.members.map(e => `<tr class="${urClass(e.ur)}"><td class="mono">${e.id}</td><td>${mt[e.type]}${e.note ? ' <span class="u">(' + esc(e.note) + ')</span>' : ''}</td><td class="mono">${nm(e.a)}–${nm(e.b)}</td><td class="num mono">${f(e.L, 0)}</td><td class="num mono">${e.type === 'strut' ? f(e.th, 1) + '°' : '—'}</td><td class="num mono">${e.beta ? f(e.beta, 2) : '—'}</td>
        <td class="num mono">${f(outVal(e.N, 'kN')[0], 1)}</td><td class="num mono">${f(outVal(e.cap, 'kN')[0], 1)}</td><td><div class="urb"><div class="ur"><i style="width:${Math.min(100, e.ur * 100)}%"></i></div><b class="mono">${f(e.ur, 2)}</b></div></td></tr>`).join('')}
      </tbody></table></div><p class="hint">${T('Forces: − compression, + tension. Struts: φ_st·β_s·0.9f′c·A_c on the smallest section (at the pile or the column node); ties: φ·A_st·f_sy.', 'แรง: − อัด, + ดึง ค้ำ: φ_st·β_s·0.9f′c·A_c ที่หน้าตัดเล็กสุด (ที่หัวเข็มหรือจุดต่อใต้เสา) ตัวยึด: φ·A_st·f_sy')}</p>`;
  }
  S.v3s = { mode: 'ur', shape: 'bottle', cam: null };
  let sviewer = null;
  function stmTheme() { const t = themeColors(), cs = getComputedStyle(document.documentElement), hx = (k, d) => { try { const v = cs.getPropertyValue(k).trim(); return v.startsWith('#') ? SC3D.hex(v) : d; } catch (e) { return d; } }; return Object.assign(t, { strut: hx('--acc', [255, 106, 43]), tie: hx('--blue', [58, 107, 255]), top: [150, 92, 220], idle: [150, 156, 170], edge: [118, 128, 148], pile: [176, 168, 150], node: [40, 48, 66] }); }
  function stmCard(r) {
    const st = S.v3s;
    return `<div class="card v3"><div class="v3-head"><h2 class="card-h">${T('3D strut-and-tie model', 'แบบจำลองโครงถักค้ำ-ยึด 3 มิติ')}</h2></div>
      <div class="v3-tools"><label for="v3smode">${T('Colour by', 'ระบายสีตาม')}</label><select id="v3smode"><option value="ur" ${st.mode === 'ur' ? 'selected' : ''}>${T('Utilisation (UR)', 'อัตราส่วนการใช้งาน (UR)')}</option><option value="type" ${st.mode === 'type' ? 'selected' : ''}>${T('Member type', 'ชนิดชิ้นส่วน')}</option></select>
        <label for="v3sshape">${T('Show', 'แสดง')}</label><select id="v3sshape"><option value="bottle" ${st.shape !== 'line' ? 'selected' : ''}>${T('Actual strut widths (bottle-shaped)', 'ความกว้างค้ำจริง (รูปขวด)')}</option><option value="line" ${st.shape === 'line' ? 'selected' : ''}>${T('Line model (thickness ∝ force)', 'แบบเส้น (ความหนา ∝ แรง)')}</option></select>
        <button class="btn btn-ghost xs" data-act="v3sreset">${T('Reset view', 'รีเซ็ตมุมมอง')}</button></div>
      <canvas id="v3s" class="v3c" tabindex="0" aria-label="${T('3D strut-and-tie model. Drag to rotate, shift-drag or two fingers to pan, scroll or pinch to zoom; click a member to read its force.', 'แบบจำลองโครงถัก 3 มิติ ลากเพื่อหมุน shift+ลากหรือสองนิ้วเพื่อเลื่อน เลื่อนล้อหรือบีบนิ้วเพื่อซูม คลิกชิ้นส่วนเพื่ออ่านแรง')}"></canvas>
      <div id="v3sleg" class="v3-leg"></div><div id="v3spick" class="v3-pick" aria-live="polite"></div>
      <p class="hint">${S.v3s.shape !== 'line' ? T('Inclined struts are drawn bottle-shaped: end widths are the sections used in the check (A_top at the column node, A_bot at the pile), spreading at mid-length; top struts are prisms of the node depth h_t; ties show the bar band. ', 'ค้ำเอียงแสดงเป็นรูปขวด: ความกว้างที่ปลายคือหน้าตัดที่ใช้ตรวจสอบ (A_top ที่จุดต่อใต้เสา A_bot ที่หัวเข็ม) และขยายตัวกลางความยาว ค้ำบนเป็นปริซึมลึก h_t ตัวยึดแสดงแถบเหล็ก ') : ''}${S.v3s.shape === 'line' ? T('Rod thickness is proportional to the member force. ', 'ความหนาของแท่งแปรผันตามแรงในชิ้นส่วน ') : ''}${T('Struts and ties meet at the nodes: top nodes in the column, bottom nodes at the tie level over each pile.', 'ค้ำและตัวยึดพบกันที่จุดต่อ: จุดต่อบนอยู่ใต้เสา จุดต่อล่างที่ระดับตัวยึดเหนือหัวเข็มแต่ละต้น')}</p></div>`;
  }
  const stmLines = (r, e) => [e.id + ' · ' + MT()[e.type] + ' ' + r.nodes[e.a].id + '–' + r.nodes[e.b].id, (e.N < 0 ? 'C = ' : 'T = ') + f(Math.abs(outVal(e.N, 'kN')[0]), 1) + ' ' + outVal(1, 'kN')[1] + ' · UR ' + f(e.ur, 2)];
  function stmSetup(v, r, mode, theme, shape) {
    const sc = SC3D.stmScene(r, { mode, shape }, theme);
    v.mesh = sc.mesh; v.bg = theme.bg;
    v.color = mode === 'ur' ? (s => SC3D.ramp(s[0].ur)) : null;
    v.marks = sc.maxU ? [{ p: sc.maxU.p, kind: 'max', lines: [T('MAX UR', 'UR สูงสุด') + ' ' + f(sc.maxU.e.ur, 2)].concat(stmLines(r, sc.maxU.e)) }] : [];
    const memOf = sel => sel && /^m\d+$/.test(sel.tag) ? r.members[+sel.tag.slice(1)] : null;
    v.memOf = memOf;
    v.fmtPick = sel => { const e = memOf(sel); return e ? stmLines(r, e) : [{ cap: T('Pile cap', 'ฐานราก'), column: T('Column', 'เสา'), pile: T('Pile', 'เสาเข็ม'), node: T('Node', 'จุดต่อ') }[sel.tag] || sel.tag]; };
    return sc;
  }
  function mountSTM(r) {
    const cv = $('#v3s'); if (!cv || !window.SC3D) return;
    const st = S.v3s, theme = stmTheme();
    if (!st.cam) st.cam = SC3D.stmPreset(r);
    sviewer = cv._v || new SC3D.Viewer(cv, st.cam); cv._v = sviewer;
    sviewer.cam = Object.assign({}, sviewer.cam, st.cam); sviewer.sel = null;
    sviewer.onchange = c => { st.cam = Object.assign({}, c); };
    stmSetup(sviewer, r, st.mode, theme, st.shape);
    const box = $('#v3spick');
    const show = sel => { if (!box) return; const e = sviewer.memOf(sel); box.innerHTML = e ? `<b>${T('Selected', 'ที่เลือก')}:</b> <span class="mono">${esc(stmLines(r, e).join(' · '))}</span> <button class="linkbtn" data-act="v3sclear">${T('Clear', 'ล้าง')}</button>` : `<span class="muted">${T('Click a strut or tie to read its force and utilisation.', 'คลิกค้ำหรือตัวยึดเพื่ออ่านแรงและอัตราส่วนการใช้งาน')}</span>`; };
    sviewer.onpick = show; show(null);
    sviewer.draw();
    const leg = $('#v3sleg');
    leg.innerHTML = st.mode === 'ur' ? `<div class="v3-bar"><span class="v3-grad"></span><span class="v3-over">&gt; 1.0</span></div><div class="v3-ticks">${['0', '0.25', '0.50', '0.75', '1.00'].map(t => `<span>${t}</span>`).join('')}<span></span></div><p class="v3-cap">UR = ${T('force / design capacity of each member', 'แรง / กำลังออกแบบของแต่ละชิ้นส่วน')}</p>`
      : `<ul class="legend"><li><i class="s-strut-k"></i>${T('Inclined struts', 'ค้ำเอียง')}</li><li><i class="s-stop-k"></i>${T('Top struts', 'ค้ำบน')}</li><li><i class="s-stie-k"></i>${T('Ties', 'ตัวยึด')}</li></ul>`;
  }
  function snapshotSTM(r) {
    if (!window.SC3D) return '';
    const oc = document.createElement('canvas'), theme = stmTheme(); theme.bg = [255, 255, 255];
    const v = new SC3D.Viewer(oc, SC3D.stmPreset(r)); stmSetup(v, r, 'ur', theme); v.draw(720, 430);
    try { return oc.toDataURL('image/png'); } catch (e) { return ''; }
  }
  window.addEventListener('resize', () => { if (viewer && $('#v3c')) viewer.draw(); if (sviewer && $('#v3s')) sviewer.draw(); });

  // ------------------------------------------------------------------ REPORT
  function fm(s) { return esc(s).replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>').replace(/_\{([^}]*)\}/g, '<sub>$1</sub>').replace(/_([A-Za-z0-9,.'\-]+)/g, '<sub>$1</sub>'); }
  function inputTable() {
    const v = inp(), sch = SCHEMA[S.elem].filter(fd => (!fd.codes || fd.codes.includes(S.code)) && (!fd.when || fd.when(v)));
    let rows = sch.map(fd => { const [u] = unitOf(fd.u); let val = v[fd.k]; if (fd.type === 'dia') val = RC.barName(S.code, val); if (fd.type === 'sel') { const o = (typeof fd.opts === 'function' ? fd.opts(v) : fd.opts).find(o => o[0] === val); val = o ? T(o[1], o[2]) : val; } return `<tr><td>${fmLabel(fieldLabel(fd))}</td><td class="num mono">${esc(val)}</td><td>${u}</td></tr>`; }).join('');
    if (S.elem === 'lwall') rows = `<tr><td>${T('Blocks per course (bottom → top)', 'จำนวนก้อนต่อชั้น (ล่าง → บน)')}</td><td class="num mono">${(v.crs || []).map(r => r.n).join(' / ')}</td><td></td></tr>` + rows;
    if (S.elem === 'beam') rows += `<tr><td>${T('Top bars', 'เหล็กบน')}</td><td class="num mono">${v.top.map(r => r.n + RC.barName(S.code, r.d)).join(' / ')}</td><td></td></tr><tr><td>${T('Bottom bars', 'เหล็กล่าง')}</td><td class="num mono">${v.bot.map(r => r.n + RC.barName(S.code, r.d)).join(' / ')}</td><td></td></tr><tr><td>${T('Side bars per face', 'เหล็กข้างต่อด้าน')}</td><td class="num mono">${v.sideN + RC.barName(S.code, v.sideD)}</td><td></td></tr>`;
    return `<table class="rp-in">${rows}</table>`;
  }
  function renderReport() {
    const r = S.res, e = ELEMS[S.elem], M = S.meta, R = r.rep;
    const pass = r.checks.every(x => x.ur <= 1.0001), worst = Math.max(...r.checks.map(x => x.ur));
    const secs = R.secs.map((sc, i) => `<section class="rp-sec"><h3><span class="rp-n">${i + 1}</span>${esc(sc.title)}${sc.clause ? `<span class="rp-cl">${esc(sc.clause)}</span>` : ''}</h3><table class="rp-t">${sc.rows.map(row => {
      if (row.k === 'txt') return `<tr><td colspan="4" class="rp-txt">${fm(row.t)}</td></tr>`;
      if (row.k === 'chk') { const ok = row.ur <= 1.0001; return `<tr class="rp-chk ${ok ? 'ok' : 'bad'}"><td>${fm(row.label)}</td><td class="rp-ex">${row.unit === '' ? T('ratio', 'อัตราส่วน') + ' = ' + f(row.ed, 3) + ' ≤ 1.0' : fm(f(row.ed, 2) + ' ≤ ' + f(row.rd, 2) + ' ' + row.unit)}</td><td class="num mono">UR = ${f(row.ur, 3)}</td><td class="rp-v">${ok ? T('OK', 'ผ่าน') : T('NOT OK', 'ไม่ผ่าน')}</td></tr>`; }
      const val = typeof row.val === 'number' ? f(row.val) : esc(row.val);
      return `<tr><td class="rp-l">${fm(row.label)}</td><td class="rp-ex">${fm(row.expr)}</td><td class="num mono">${val !== '' ? '= ' + val : ''} ${fm(row.unit)}</td><td class="rp-note">${fm(row.note || '')}</td></tr>`;
    }).join('')}</table></section>`).join('');
    const summary = `<table class="rp-sum"><thead><tr><th>${T('Check', 'รายการ')}</th><th class="num">${T('Action', 'แรงกระทำ')}</th><th class="num">${T('Capacity', 'กำลัง')}</th><th class="num">UR</th><th>${T('Result', 'ผล')}</th></tr></thead><tbody>${r.checks.map(x => { const [a, u] = outVal(x.Ed, x.unit), [b] = outVal(x.Rd, x.unit); return `<tr><td>${fmLabel(x.name)}</td><td class="num mono">${x.unit ? f(a, 2) : ''}</td><td class="num mono">${x.unit ? f(b, 2) + ' ' + esc(u) : ''}</td><td class="num mono">${f(x.ur, 3)}</td><td>${x.ur <= 1.0001 ? T('OK', 'ผ่าน') : T('NOT OK', 'ไม่ผ่าน')}</td></tr>`; }).join('')}</tbody></table>`;
    const drawing = S.elem === 'sbarrier' ? sbarSketch(r) : S.elem === 'barrier' ? barrierSketch(r) : S.elem === 'lwall' ? wallSketch(r) : S.elem === 'stm3d' ? stmPlan(r) : S.elem === 'gantry' ? gantrySketch(r) : S.elem === 'pilecap' ? capSketch(r) : sectionSketch(r);
    let charts = S.elem === 'column' ? columnChartsInner(r) : S.elem === 'gantry' ? gantryDetails(r) : '';
    if (S.elem === 'lwall') charts = wallTable(r);
    if (S.elem === 'sbarrier') charts = `<div class="rp-fig" style="max-width:640px;margin:8px auto">${sbarChart(r)}</div>`;
    if (S.elem === 'barrier') charts = `<div class="rp-fig" style="max-width:640px;margin:8px auto">${yieldSketch(r)}</div>`;
    if (S.elem === 'stm3d') { const src = snapshotSTM(r); charts = (src ? `<div class="rp-3d one"><figure><img src="${src}" alt="${T('3D strut-and-tie model', 'แบบจำลองโครงถัก 3 มิติ')}"><figcaption>${T('3D strut-and-tie model — bottle-shaped struts at the checked widths, colour = utilisation', 'แบบจำลองโครงถัก 3 มิติ — ค้ำรูปขวดตามความกว้างที่ตรวจสอบ สี = อัตราส่วนการใช้งาน')}</figcaption></figure></div>` : '') + stmTable(r); }
    if (S.elem === 'gantry') {
      const wc = worstCase(r), cs = wc === 'none' ? null : wc, cn = cs ? r.fat.caseObjs.find(c => c.id === cs).nm : '';
      const shots = [['overall', null, T('Overall', 'ภาพรวม')], ['base', cs, T('Base connection', 'รอยต่อฐาน') + (cs ? ' — ' + cn : '')], ['arm', cs, T('Arm connection', 'รอยต่อคาน') + (cs ? ' — ' + cn : '')]];
      charts += `<div class="rp-3d">${shots.map(([vw, c, cap]) => { const src = snapshot3D(r, vw, c); return src ? `<figure><img src="${src}" alt="${esc(cap)}"><figcaption>${esc(cap)}</figcaption></figure>` : ''; }).join('')}</div>${cs ? `<p class="rp-txt">${T('3D contours: nominal fatigue stress range as UR = Δσ/φ_f·f₃ (blue 0 → red 1.0, magenta > 1.0), beam theory on the modelled sections; not a finite-element hot-spot analysis.', 'สี 3 มิติ: ช่วงหน่วยแรงล้าระบุเป็น UR = Δσ/φ_f·f₃ (น้ำเงิน 0 → แดง 1.0, ม่วง > 1.0) จากทฤษฎีคาน ไม่ใช่การวิเคราะห์ไฟไนต์เอลิเมนต์แบบจุดร้อน')}</p>` : ''}`;
    }
    $('#reportWrap').innerHTML = `<div class="rp-bar"><h2>${T('Calculation report', 'รายการคำนวณ')}</h2>
      <div class="rp-meta">${[['project', T('Project', 'โครงการ')], ['job', T('Job no.', 'เลขที่งาน')], ['ref', T('Member ref.', 'ชื่อชิ้นส่วน')], ['by', T('Designed by', 'ผู้ออกแบบ')], ['checked', T('Checked by', 'ผู้ตรวจสอบ')]].map(([k, l]) => `<label>${l}<input id="meta-${k}" data-meta="${k}" value="${esc(M[k])}"></label>`).join('')}</div>
      <div class="rp-btns"><button class="btn btn-hot sm" data-act="pdf" id="pdfBtn">${T('Export PDF', 'ส่งออก PDF')}</button><button class="btn btn-ghost sm" data-act="closeReport">${T('Close', 'ปิด')}</button></div></div>
      <article class="report" id="report" lang="${lang()}">
        <header class="rp-head"><div class="rp-brand">${logoMark(34)}<div><b>StructCap</b><small>${stdFor()}</small></div></div>
          <table class="rp-hd"><tr><th>${T('Project', 'โครงการ')}</th><td id="rv-project">${esc(M.project)}</td><th>${T('Job no.', 'เลขที่งาน')}</th><td id="rv-job">${esc(M.job)}</td></tr>
          <tr><th>${T('Element', 'ชิ้นส่วน')}</th><td>${T(e.en, e.th)} · <span id="rv-ref">${esc(M.ref)}</span></td><th>${T('Date', 'วันที่')}</th><td>${today()}</td></tr>
          <tr><th>${T('Designed', 'ออกแบบ')}</th><td id="rv-by">${esc(M.by)}</td><th>${T('Checked', 'ตรวจสอบ')}</th><td id="rv-checked">${esc(M.checked)}</td></tr></table></header>
        <div class="rp-verdict ${pass ? 'ok' : 'bad'}"><b>${pass ? T('Member adequate', 'ชิ้นส่วนผ่านการตรวจสอบ') : T('Member NOT adequate', 'ชิ้นส่วนไม่ผ่านการตรวจสอบ')}</b><span>UR<sub>max</sub> = ${f(worst, 3)}</span></div>
        ${S.code === 'TH' ? `<p class="rp-txt">${T('Equations are shown in SI (N, mm, MPa) using the metric ACI 318-19 expressions · 1 ksc = 0.0981 MPa · 1 t = 9.807 kN · the summary table uses Thai units.', 'การคำนวณแสดงในหน่วย SI (N, mm, MPa) ตามสมการ ACI 318-19 ฉบับหน่วยเมตริก · 1 ksc = 0.0981 MPa · 1 ตัน = 9.807 kN · ตารางสรุปแสดงเป็นหน่วยไทย')}</p>` : ''}
        <section class="rp-sec"><h3><span class="rp-n">0</span>${T('Input data', 'ข้อมูลนำเข้า')}</h3><div class="rp-2">${inputTable()}<div class="rp-fig">${drawing}</div></div>${charts}</section>
        ${secs}
        <section class="rp-sec"><h3><span class="rp-n">Σ</span>${T('Summary of checks', 'สรุปผลการตรวจสอบ')}</h3>${summary}</section>
        <p class="rp-foot"><b>${COPY}</b> · ${T('Generated by StructCap. The designer remains responsible for verifying inputs, load combinations, detailing and National Annex / code edition parameters.', 'จัดทำโดย StructCap วิศวกรผู้ออกแบบต้องตรวจสอบข้อมูลนำเข้า การรวมแรง รายละเอียดการเสริมเหล็ก และพารามิเตอร์ตามฉบับของมาตรฐานที่ใช้')}</p>
      </article>`;
  }
  const libs = {};
  function loadScript(src) {
    if (libs[src]) return libs[src];
    libs[src] = new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = () => { delete libs[src]; rej(new Error('load')); }; document.head.appendChild(el); });
    return libs[src];
  }
  async function exportPdf() {
    if (window.SC_FEAT_OFF('pdf')) return;
    const btn = $('#pdfBtn'); btn.disabled = true; btn.textContent = T('Preparing PDF…', 'กำลังสร้าง PDF…');
    const src = $('#report');
    let host = null;
    try {
      const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
      await Promise.all([loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'), loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')]);
      // render a clone pinned to the top-left of the document, so scroll position cannot shift the capture
      host = document.createElement('div'); host.className = 'pdf-host';
      const el = src.cloneNode(true); el.removeAttribute('id'); host.appendChild(el); document.body.appendChild(host);
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      src.querySelectorAll('svg, svg *').forEach((n, idx) => {
        const cs = getComputedStyle(n), st = [], tgt = el.querySelectorAll('svg, svg *')[idx]; if (!tgt) return;
        ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'font-family', 'font-size', 'font-weight'].forEach(p => { const v = cs.getPropertyValue(p); if (v) st.push(p + ':' + v); });
        tgt.setAttribute('style', (tgt.getAttribute('style') || '') + ';' + st.join(';'));
      });
      const scale = 2, top0 = el.getBoundingClientRect().top;
      const breaks = Array.from(el.querySelectorAll('.rp-head, .rp-verdict, .rp-sec, .rp-sec h3, tr, figure, .rp-2, .rp-foot, .charts3')).map(n => n.getBoundingClientRect().top - top0).filter(y => y > 0).sort((a, b) => a - b);
      const canvas = await window.html2canvas(el, { scale, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0, windowWidth: el.scrollWidth, useCORS: true });
      const { jsPDF } = window.jspdf, pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const mm = { l: 12, r: 12, t: 12, b: 16 }, pw = 210 - mm.l - mm.r, ph = 297 - mm.t - mm.b;
      const cssW = el.offsetWidth, pxPerMm = cssW / pw, pageCss = ph * pxPerMm, totalCss = canvas.height / scale;
      const cuts = [0];
      while (cuts[cuts.length - 1] + pageCss < totalCss - 1) {
        const start = cuts[cuts.length - 1], limit = start + pageCss;
        const cand = breaks.filter(y => y > start + pageCss * 0.5 && y <= limit);
        cuts.push(cand.length ? cand[cand.length - 1] : limit);
      }
      cuts.push(totalCss);
      const n = cuts.length - 1;
      for (let i = 0; i < n; i++) {
        const y0 = Math.round(cuts[i] * scale), h = Math.round((cuts[i + 1] - cuts[i]) * scale);
        const pc = document.createElement('canvas'); pc.width = canvas.width; pc.height = h;
        const cx = pc.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, pc.width, h); cx.drawImage(canvas, 0, y0, canvas.width, h, 0, 0, canvas.width, h);
        if (i) pdf.addPage();
        pdf.addImage(pc.toDataURL('image/jpeg', 0.95), 'JPEG', mm.l, mm.t, pw, h / scale / pxPerMm);
        pdf.setDrawColor(200); pdf.setLineWidth(0.2); pdf.line(mm.l, 297 - mm.b + 4, 210 - mm.r, 297 - mm.b + 4);
        pdf.setFontSize(8); pdf.setTextColor(90);
        pdf.text(COPY + '  |  ' + (S.meta.project || '') + '  ' + (S.meta.ref || ''), mm.l, 297 - mm.b + 8.5);
        pdf.text('Page ' + (i + 1) + ' of ' + n, 210 - mm.r, 297 - mm.b + 8.5, { align: 'right' });
      }
      const blob = pdf.output('blob');
      const name = ANV.includes(S.view) ? (S.meta.ref || S.view).replace(/[^\w\-]+/g, '_') + (S.view === 'conn' ? '_steel-connection_' : S.view === 'timber' ? '_timber-bridge-rating_' : '_frame-analysis_') + today() + '.pdf' : (S.meta.ref || S.elem).replace(/[^\w\-]+/g, '_') + '_' + S.elem + '_' + S.code + '_' + today() + '.pdf';
      if (dl) await dl.save({ filename: name, data: blob }); else pdf.save(name);
      toast(T('PDF saved', 'บันทึก PDF แล้ว'), 'ok');
    } catch (e) {
      if (e && e.code === 'declined') toast(T('Download cancelled', 'ยกเลิกการดาวน์โหลด'));
      else toast(T('Could not create the PDF. Try again.', 'สร้าง PDF ไม่สำเร็จ ลองอีกครั้ง'), 'bad');
    } finally { if (host) host.remove(); btn.disabled = false; btn.textContent = T('Export PDF', 'ส่งออก PDF'); }
  }

  // ------------------------------------------------------------------ ADMIN
  const A = { tab: 'users', accounts: [], members: [], payments: [], requests: [], messages: [], mail: false, q: '', filter: 'all', edit: null, unsub: [], confirm: null, resetAsk: false };
  const METHODS = [['card', 'Credit / debit card', 'บัตรเครดิต / เดบิต'], ['paypal', 'PayPal', 'PayPal'], ['bank', 'Bank transfer', 'โอนธนาคาร'], ['promptpay', 'PromptPay', 'พร้อมเพย์'], ['cash', 'Cash', 'เงินสด'], ['other', 'Other', 'อื่น ๆ']];
  const PSTAT = { paid: ['Paid', 'ชำระแล้ว', 'ok'], pending: ['Pending', 'รอตรวจสอบ', 'warn'], refunded: ['Refunded', 'คืนเงิน', 'bad'] };
  function adminSubscribe() {
    if (CLOUD) { if (!A.loaded) { A.loaded = true; Ops.refresh().catch(x => { A.loaded = false; toast(opErr(x), 'bad'); }); } return; }
    if (A.unsub.length) return;
    ['accounts', 'members', 'payments', 'requests', 'messages'].forEach(c => A.unsub.push(Store.watch(c, rows => { A[c] = rows; if (S.view === 'admin') adminBody(); })));
  }
  function viewAdmin() {
    if (S.role !== 'admin') return viewLogin(true);
    return `${navBar()}<main class="wrap page admin">
      <div class="page-head"><div><p class="eyebrow">Administrator</p><h1>${T('User & subscription management', 'จัดการผู้ใช้และการสมัครสมาชิก')}</h1><p class="muted">${T('Create users, set passwords and subscription periods, and record payments.', 'สร้างผู้ใช้ ตั้งรหัสผ่าน กำหนดระยะเวลาใช้งาน และบันทึกการชำระเงิน')}</p></div>
        <div class="dz-actions"><button class="btn btn-hot sm" data-act="newUser">+ ${T('New user', 'สร้างผู้ใช้')}</button><button class="btn btn-ghost sm" data-act="newPay">+ ${T('Record payment', 'บันทึกการชำระเงิน')}</button></div></div>
      <div class="testbar"><span class="pill soon">${CLOUD ? T('SUPABASE', 'SUPABASE') : T('TEST MODE', 'โหมดทดสอบ')}</span><span>${CLOUD ? T('Connected to the Supabase database. Changes apply to all users immediately.', 'เชื่อมต่อฐานข้อมูล Supabase แล้ว การเปลี่ยนแปลงมีผลกับผู้ใช้ทุกคนทันที') : Store.persistent ? T('Data is saved in this browser only, until the Supabase database is connected.', 'ข้อมูลบันทึกไว้ในเบราว์เซอร์นี้เท่านั้น จนกว่าจะเชื่อมต่อฐานข้อมูล Supabase') : T('This browser blocks storage, so data lasts until the page is closed.', 'เบราว์เซอร์นี้ไม่อนุญาตให้บันทึกข้อมูล ข้อมูลจะหายเมื่อปิดหน้า')}</span>
        <span class="grow"></span>${A.resetAsk ? `<span class="confirm">${CLOUD ? T('Delete ALL users and payments from the database?', 'ลบผู้ใช้และรายการชำระเงินทั้งหมดในฐานข้อมูล?') : T('Delete all test users and payments?', 'ลบผู้ใช้และรายการชำระเงินทดสอบทั้งหมด?')} <button class="btn btn-danger xs" data-act="resetYes">${T('Delete all', 'ลบทั้งหมด')}</button> <button class="btn btn-ghost xs" data-act="resetNo">${T('Cancel', 'ยกเลิก')}</button></span>` : `<button class="btn btn-danger-ghost xs" data-act="resetAsk">${CLOUD ? T('Delete all data', 'ลบข้อมูลทั้งหมด') : T('Clear test data', 'ล้างข้อมูลทดสอบ')}</button>`}</div>
      <div class="promo-card ${S.promo ? 'on' : ''}"><div><b>${T('Open Pro for free', 'เปิดใช้งาน Pro ฟรี')}</b><p>${S.promo ? T('On: every user can use all Pro features, and the landing page announces that Pro is free.', 'เปิดอยู่: ผู้ใช้ทุกคนใช้ฟังก์ชัน Pro ได้ทั้งหมด และหน้าแรกแจ้งว่า Pro ใช้งานฟรี') : T('Off: Pro features need a Pro account. Turn on to unlock everything for all users.', 'ปิดอยู่: ต้องใช้บัญชี Pro เปิดเพื่อให้ผู้ใช้ทุกคนใช้ได้ทุกฟังก์ชัน')}</p></div>
        <button class="switch" role="switch" aria-checked="${!!S.promo}" aria-label="${T('Open Pro for free', 'เปิดใช้งาน Pro ฟรี')}" data-act="promo"><i></i></button></div>
      ${featCard()}
      <details class="card payinfo-card"><summary><b>${T('Payment instructions shown to members', 'วิธีชำระเงินที่แสดงให้สมาชิก')}</b> <span class="muted small">${T('bank account, PromptPay, PayPal …', 'บัญชีธนาคาร พร้อมเพย์ PayPal …')}</span></summary>
        <div class="mgrid"><label>English<textarea id="pi-en" rows="4" maxlength="2000">${esc((S.payInfo || {}).en)}</textarea></label><label>ไทย<textarea id="pi-th" rows="4" maxlength="2000">${esc((S.payInfo || {}).th)}</textarea></label></div>
        <div class="mfoot"><span class="muted small">${T('Prices: USD 0.99 / month (English page), 30 THB / month (Thai page).', 'ราคา: USD 0.99 / เดือน (หน้าภาษาอังกฤษ) 30 บาท / เดือน (หน้าภาษาไทย)')}</span><span class="grow"></span><button class="btn btn-hot sm" data-act="savePayInfo">${T('Save', 'บันทึก')}</button></div></details>
      <div id="adminBody"></div></main>`;
  }
  function featName(k) { for (const g of FEATS) for (const f of g[2]) if (f[0] === k) return T(f[1], f[2]); return k; }
  function featCard() {
    const n = Object.keys(S.off || {}).filter(k => S.off[k]).length;
    return `<section class="card feat-card"><div class="feat-hd"><div><b>${T('Functions', 'ฟังก์ชัน')}</b><p class="muted small">${T('Switch a function off to make it unavailable to all users — its menu card is greyed out and it cannot be opened. You still see and can open it, marked “Off for users”.', 'ปิดฟังก์ชันเพื่อไม่ให้ผู้ใช้ทุกคนใช้งาน — การ์ดในเมนูจะเป็นสีเทาและเปิดไม่ได้ ผู้ดูแลยังเห็นและเปิดได้ โดยมีป้าย “ปิดสำหรับผู้ใช้”')}</p></div>
      <span class="feat-n ${n ? 'on' : ''}">${n ? n + T(' off', ' ปิดอยู่') : T('All on', 'เปิดทั้งหมด')}</span>${n ? `<button class="btn btn-ghost sm" data-act="featAll">${T('Turn all on', 'เปิดทั้งหมด')}</button>` : ''}</div>
      <div class="feat-grid">${FEATS.map(([gen, gth, list]) => `<div class="feat-grp"><h4>${T(gen, gth)}</h4>${list.map(([k, en, th]) => `<div class="feat-row ${featOff(k) ? 'is-off' : ''}"><span>${T(en, th)}</span><button class="switch sm" role="switch" aria-checked="${!featOff(k)}" aria-label="${esc(T(en, th))}" data-act="feat" data-k="${k}"><i></i></button></div>`).join('')}</div>`).join('')}</div></section>`;
  }
  function adminBody() {
    const el = $('#adminBody'); if (!el) return;
    const t = today(), acc = A.accounts, pro = acc.filter(a => a.plan === 'pro' && a.status === 'active' && a.expiry >= t);
    const soon = pro.filter(a => a.expiry <= addDays(t, 14)), mon = t.slice(0, 7);
    const rev = A.payments.filter(p => p.status === 'paid' && (p.currency || 'USD') === 'USD' && (p.date || '').slice(0, 7) === mon).reduce((s, p) => s + (+p.amount || 0), 0);
    const revT = A.payments.filter(p => p.status === 'paid' && p.currency === 'THB' && (p.date || '').slice(0, 7) === mon).reduce((s, p) => s + (+p.amount || 0), 0);
    const pend = A.payments.filter(p => p.status === 'pending').length;
    const mem = id => A.members.find(m => m._id === id) || {};
    const stat = a => a.status !== 'active' ? ['bad', T('Suspended', 'ระงับ'), 'suspended'] : a.plan !== 'pro' ? ['', 'Free', 'free'] : a.expiry < t ? ['bad', T('Expired', 'หมดอายุ'), 'expired'] : a.expiry <= addDays(t, 14) ? ['warn', T('Expiring soon', 'ใกล้หมดอายุ'), 'soon'] : ['ok', T('Active', 'ใช้งาน'), 'active'];
    const q = A.q.toLowerCase();
    const list = acc.filter(a => (!q || [a.username, a.name, mem(a._id).email].join(' ').toLowerCase().includes(q)) && (A.filter === 'all' || stat(a)[2] === A.filter)).sort((a, b) => (a.expiry || '9').localeCompare(b.expiry || '9'));
    const daysLeft = a => a.plan === 'pro' && a.expiry ? Math.ceil((new Date(a.expiry) - new Date(t)) / 864e5) : null;
    const nReq = A.requests.filter(r => r.status === 'pending').length, nMsg = A.messages.filter(m => m.status === 'new').length;
    const filters = [['all', T('All', 'ทั้งหมด')], ['active', T('Active', 'ใช้งาน')], ['soon', T('Expiring soon', 'ใกล้หมดอายุ')], ['expired', T('Expired', 'หมดอายุ')], ['suspended', T('Suspended', 'ระงับ')], ['free', 'Free']];
    el.innerHTML = `<div class="stats">
        <div class="stat"><span>${T('Users', 'ผู้ใช้ทั้งหมด')}</span><b>${acc.length}</b></div><div class="stat"><span>${T('Active Pro', 'Pro ที่ใช้งานอยู่')}</span><b>${pro.length}</b></div>
        <div class="stat ${soon.length ? 'warn' : ''}"><span>${T('Expiring in 14 days', 'หมดอายุใน 14 วัน')}</span><b>${soon.length}</b></div><div class="stat"><span>${T('Paid this month', 'รายรับเดือนนี้')}${pend ? ' · ' + pend + T(' pending', ' รอตรวจ') : ''}</span><b>$${f(rev, 2)}${revT ? ` <small>+ ${f(revT, 0)} ฿</small>` : ''}</b></div></div>
      <div class="tabs" role="tablist"><button role="tab" aria-selected="${A.tab === 'users'}" data-act="tab" data-t="users">${T('Users', 'ผู้ใช้งาน')}</button><button role="tab" aria-selected="${A.tab === 'req'}" data-act="tab" data-t="req">${T('Pro applications', 'คำขอ Pro')}${nReq ? ` <span class="badge">${nReq}</span>` : ''}</button><button role="tab" aria-selected="${A.tab === 'pay'}" data-act="tab" data-t="pay">${T('Payments', 'การชำระเงิน')}</button><button role="tab" aria-selected="${A.tab === 'msg'}" data-act="tab" data-t="msg">${T('Messages', 'ข้อความ')}${nMsg ? ` <span class="badge">${nMsg}</span>` : ''}</button></div>
      <p class="mail-state ${A.mailUsers ? 'ok' : ''}">${T('Member emails (registration confirmation, payment received, Pro switched on): ', 'อีเมลถึงสมาชิก (ยืนยันการสมัคร ได้รับการชำระเงิน เปิดใช้ Pro): ') + (A.mailUsers ? T('on.', 'เปิดใช้งาน') : T('off — needs RESEND_API_KEY and MAIL_FROM on a domain verified in Resend (Supabase → Edge Functions → Secrets).', 'ปิดอยู่ — ต้องตั้งค่า RESEND_API_KEY และ MAIL_FROM บนโดเมนที่ยืนยันใน Resend (Supabase → Edge Functions → Secrets)'))}</p>
      <p class="mail-state ${A.mail ? 'ok' : ''}">${A.mail ? T('Email to ' + ADMIN_EMAIL + ': sent by the server.', 'อีเมลถึง ' + ADMIN_EMAIL + ': ส่งจากเซิร์ฟเวอร์') : T('Email to ' + ADMIN_EMAIL + ': sent through the browser relay (FormSubmit) — confirm the address once from the first FormSubmit email. For server email with the slip attached, set RESEND_API_KEY in Supabase.', 'อีเมลถึง ' + ADMIN_EMAIL + ': ส่งผ่านตัวส่งต่อในเบราว์เซอร์ (FormSubmit) — ยืนยันที่อยู่อีเมลครั้งแรกจากอีเมลของ FormSubmit หากต้องการส่งจากเซิร์ฟเวอร์พร้อมแนบสลิป ให้ตั้งค่า RESEND_API_KEY ใน Supabase')}</p>
      ${A.tab === 'req' ? reqTab() : A.tab === 'msg' ? msgTab() : A.tab === 'users' ? `<div class="card"><div class="tbl-tools"><input id="adm-q" placeholder="${T('Search username, name or email', 'ค้นหาชื่อผู้ใช้ ชื่อ หรืออีเมล')}" value="${esc(A.q)}" aria-label="${T('Search', 'ค้นหา')}"><div class="seg">${filters.map(([k, l]) => `<button data-act="filter" data-f="${k}" aria-pressed="${A.filter === k}">${l}</button>`).join('')}</div></div>
        ${acc.length ? (list.length ? `<div class="tbl-wrap"><table class="chk adm"><thead><tr><th>${T('User', 'ผู้ใช้')}</th><th>${T('Plan', 'แพ็กเกจ')}</th><th>${T('Start', 'เริ่ม')}</th><th>${T('Expiry', 'หมดอายุ')}</th><th>${T('Status', 'สถานะ')}</th><th></th></tr></thead><tbody>
        ${list.map(a => { const [c, l] = stat(a), dl = daysLeft(a); return `<tr><td><b>${esc(a.username)}</b><br>${mem(a._id).email && mem(a._id).email !== a.username ? `<span class="muted small">${esc(mem(a._id).email)}</span>` : ''}</td><td>${a.plan === 'pro' ? '<span class="pill pro">Pro</span>' : '<span class="pill free">Free</span>'}</td><td class="mono">${esc(a.start || '')}</td><td class="mono">${esc(a.expiry || '—')}${dl !== null ? `<br><span class="muted small">${dl >= 0 ? T(dl + ' days left', 'เหลือ ' + dl + ' วัน') : T(-dl + ' days ago', 'เกินมา ' + -dl + ' วัน')}</span>` : ''}</td><td><span class="pill st-${c}">${l}</span></td>
          <td class="act"><button class="btn btn-ghost xs" data-act="ext" data-u="${esc(a._id)}" data-d="30">+30 ${T('d', 'วัน')}</button><button class="btn btn-ghost xs" data-act="ext" data-u="${esc(a._id)}" data-d="365">+1 ${T('yr', 'ปี')}</button><button class="btn btn-ghost xs" data-act="editUser" data-u="${esc(a._id)}">${T('Edit', 'แก้ไข')}</button></td></tr>`; }).join('')}
        </tbody></table></div>` : `<p class="muted pad">${T('No users match this search.', 'ไม่พบผู้ใช้ตามเงื่อนไข')}</p>`)
          : `<div class="empty"><b>${T('No users yet', 'ยังไม่มีผู้ใช้')}</b><p>${T('Create the first account with “New user”: set the password, plan and expiry date in one step.', 'สร้างบัญชีแรกด้วยปุ่ม “สร้างผู้ใช้” กำหนดรหัสผ่าน แพ็กเกจ และวันหมดอายุได้ทันที')}</p><button class="btn btn-hot sm" data-act="newUser">+ ${T('New user', 'สร้างผู้ใช้')}</button></div>`}</div>`
        : `<div class="card">${A.payments.length ? `<div class="tbl-wrap"><table class="chk adm"><thead><tr><th>${T('Date', 'วันที่')}</th><th>${T('User', 'ผู้ใช้')}</th><th class="num">${T('Amount', 'จำนวนเงิน')}</th><th>${T('Method', 'ช่องทาง')}</th><th>${T('Reference', 'อ้างอิง')}</th><th>${T('Period', 'ระยะเวลา')}</th><th>${T('Status', 'สถานะ')}</th><th></th></tr></thead><tbody>
        ${A.payments.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(p => { const m = METHODS.find(x => x[0] === p.method), st = PSTAT[p.status] || [p.status, p.status, '']; return `<tr><td class="mono">${esc(p.date)}</td><td>${esc(p.username)}</td><td class="num mono">${money(+p.amount, p.currency || 'USD')}</td><td>${m ? T(m[1], m[2]) : esc(p.method)}</td><td class="mono small">${esc(p.ref || '')}</td><td>${p.days ? p.days + ' ' + T('days', 'วัน') : '—'}</td><td><span class="pill st-${st[2]}">${T(st[0], st[1])}</span></td>
          <td class="act"><button class="btn btn-ghost xs" data-act="editPay" data-p="${esc(p._id)}">${T('Edit', 'แก้ไข')}</button></td></tr>`; }).join('')}</tbody></table></div>`
          : `<div class="empty"><b>${T('No payments yet', 'ยังไม่มีรายการชำระเงิน')}</b><p>${T('Record a payment and extend the user’s Pro period in the same step.', 'บันทึกการชำระเงินพร้อมต่ออายุแพ็กเกจ Pro ให้ผู้ใช้ได้ในขั้นตอนเดียว')}</p><button class="btn btn-hot sm" data-act="newPay">+ ${T('Record payment', 'บันทึกการชำระเงิน')}</button></div>`}</div>`}
      <div id="modal"></div>`;
    if (A.edit) renderModal();
  }
  function reqTab() {
    const rs = A.requests.slice().sort((a, b) => (a.status === 'pending') - (b.status === 'pending') || 0).sort((a, b) => (b.status === 'pending') - (a.status === 'pending') || (b.created || '').localeCompare(a.created || ''));
    if (!rs.length) return `<div class="card"><div class="empty"><b>${T('No Pro applications yet', 'ยังไม่มีคำขอ Pro')}</b><p>${T('Members who register for Pro or apply from their account page appear here with their payment slip.', 'สมาชิกที่สมัคร Pro หรือยื่นคำขอจากหน้าบัญชี จะแสดงที่นี่พร้อมสลิป')}</p></div></div>`;
    const acc = id => A.accounts.find(a => a._id === id) || {}, mem = id => A.members.find(m => m._id === id) || {};
    return `<div class="card"><div class="tbl-wrap"><table class="chk adm"><thead><tr><th>${T('Received', 'วันที่')}</th><th>${T('Member', 'สมาชิก')}</th><th>${T('Period', 'ระยะเวลา')}</th><th class="num">${T('Amount', 'จำนวนเงิน')}</th><th>${T('Paid by / ref.', 'ชำระโดย / อ้างอิง')}</th><th>${T('Slip', 'สลิป')}</th><th>${T('Status', 'สถานะ')}</th><th></th></tr></thead><tbody>
      ${rs.map(r => { const st = RQS[r.status] || [r.status, r.status, ''], m = PAY_METHODS.find(x => x[0] === r.method); return `<tr class="${r.status === 'pending' ? 'rq-open' : ''}"><td class="mono small">${esc((r.created || '').slice(0, 16).replace('T', ' '))}</td><td><b>${esc(r.username)}</b></td>
        <td>${r.months} ${T('month(s)', 'เดือน')}</td><td class="num mono">${money(+r.amount, r.currency)}</td><td>${m ? T(m[1], m[2]) : esc(r.method || '')}<br><span class="mono small">${esc(r.ref || '')}</span></td>
        <td><button class="btn btn-ghost xs" data-act="slip" data-r="${esc(r._id)}">${T('View', 'ดู')}</button><br><span class="muted small">${esc(r.slip_name || '')}</span></td><td><span class="pill st-${st[2]}">${T(st[0], st[1])}</span></td>
        <td class="act">${r.status === 'pending' ? `<label class="days-in">${T('Days', 'วัน')} <input type="number" min="1" id="rd-${esc(r._id)}" value="${r.months * 30}"></label><button class="btn btn-hot xs" data-act="approve" data-r="${esc(r._id)}">${T('Approve · turn on Pro', 'อนุมัติ · เปิด Pro')}</button><button class="btn btn-danger-ghost xs" data-act="reject" data-r="${esc(r._id)}">${T('Reject', 'ไม่อนุมัติ')}</button>` : `<span class="muted small">${esc((r.decided || '').slice(0, 10))}</span>`}</td></tr>`; }).join('')}
      </tbody></table></div><p class="hint">${T('Approving switches the member to Pro (adding the days to any time left), records the payment and emails the member that Pro is on. Members are told it takes up to 2 hours.', 'การอนุมัติจะเปิด Pro ให้สมาชิก (บวกวันเพิ่มจากเวลาที่เหลือ) บันทึกการชำระเงิน และส่งอีเมลแจ้งสมาชิก สมาชิกได้รับแจ้งว่าใช้เวลาไม่เกิน 2 ชั่วโมง')}</p></div>`;
  }
  function msgTab() {
    const ms = A.messages.slice().sort((a, b) => (b.created || '').localeCompare(a.created || ''));
    if (!ms.length) return `<div class="card"><div class="empty"><b>${T('No messages yet', 'ยังไม่มีข้อความ')}</b><p>${T('Contact and feedback messages from the welcome page, and new registrations, are listed here.', 'ข้อความติดต่อ ข้อเสนอแนะจากหน้าแรก และการสมัครสมาชิกใหม่ จะแสดงที่นี่')}</p></div></div>`;
    const K = { contact: ['Contact', 'ติดต่อ'], feedback: ['Feedback', 'ข้อเสนอแนะ'], register: ['Registration', 'สมัครสมาชิก'], pro: ['Pro application', 'คำขอ Pro'] };
    return `<div class="card msg-list">${ms.map(m => `<article class="msg ${m.status === 'new' ? 'new' : ''}"><header><span class="pill">${T(...(K[m.kind] || [m.kind, m.kind]))}</span><b>${esc(m.name || m.username || T('Visitor', 'ผู้เยี่ยมชม'))}</b>${m.email ? ` <a href="mailto:${esc(m.email)}">${esc(m.email)}</a>` : ''}${m.username ? ` <span class="muted small">@${esc(m.username)}</span>` : ''}<span class="grow"></span><span class="mono small muted">${esc((m.created || '').slice(0, 16).replace('T', ' '))}</span></header>
      <p>${esc(m.message)}</p><footer><button class="linkbtn" data-act="mread" data-m="${esc(m._id)}" data-u="${m.status === 'new' ? '' : '1'}">${m.status === 'new' ? T('Mark as read', 'ทำเครื่องหมายว่าอ่านแล้ว') : T('Mark as unread', 'ทำเครื่องหมายว่ายังไม่อ่าน')}</button>${m.email ? ` · <a class="linkbtn" href="mailto:${esc(m.email)}?subject=${encodeURIComponent('Re: StructCap')}">${T('Reply by email', 'ตอบกลับทางอีเมล')}</a>` : ''} · <button class="linkbtn danger" data-act="mdel" data-m="${esc(m._id)}">${T('Delete', 'ลบ')}</button></footer></article>`).join('')}</div>`;
  }
  function renderModal() {
    const el = $('#modal'); if (!el) return;
    const e = A.edit;
    if (!e) { el.innerHTML = ''; return; }
    if (e.kind === 'user') {
      const a = e.data;
      el.innerHTML = `<div class="modal-bg"><form class="modal" id="userForm" novalidate><h2>${e.isNew ? T('New user', 'สร้างผู้ใช้ใหม่') : T('Edit user ', 'แก้ไขผู้ใช้ ') + esc(a.username)}</h2>
        <div class="mgrid">
          <label>${T('Email (sign-in)', 'อีเมล (ใช้เข้าสู่ระบบ)')}<input id="u-username" value="${esc(a.username)}" ${e.isNew ? '' : 'disabled'} required autocomplete="off" placeholder="name@example.com"></label>
          <label>${T('Plan', 'แพ็กเกจ')}<select id="u-plan"><option value="pro" ${a.plan === 'pro' ? 'selected' : ''}>Pro</option><option value="free" ${a.plan !== 'pro' ? 'selected' : ''}>Free</option></select></label>
          <label>${T('Status', 'สถานะ')}<select id="u-status"><option value="active" ${a.status !== 'suspended' ? 'selected' : ''}>${T('Active', 'ใช้งาน')}</option><option value="suspended" ${a.status === 'suspended' ? 'selected' : ''}>${T('Suspended', 'ระงับ')}</option></select></label>
          <label>${T('Start date', 'วันเริ่ม')}<input id="u-start" type="date" value="${esc(a.start)}"></label>
          <label>${T('Expiry date', 'วันหมดอายุ')}<input id="u-expiry" type="date" value="${esc(a.expiry)}"></label>
          <div class="quick">${T('Set period from start date:', 'กำหนดอายุจากวันเริ่ม:')} ${[30, 90, 180, 365].map(d => `<button type="button" class="btn btn-ghost xs" data-act="setExp" data-d="${d}">${d === 365 ? T('1 year', '1 ปี') : d + ' ' + T('days', 'วัน')}</button>`).join('')}</div>
          <label class="full">${e.isNew ? T('Password (min. 8 characters)', 'รหัสผ่าน (อย่างน้อย 8 ตัว)') : T('New password (leave blank to keep)', 'ตั้งรหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)')}<span class="pw"><input id="u-pass" type="text" autocomplete="new-password" minlength="8"><button type="button" class="btn btn-ghost xs" data-act="genPass">${T('Generate', 'สุ่มรหัส')}</button></span></label>
          <label class="full">${T('Note', 'หมายเหตุ')}<input id="u-note" value="${esc(a.note)}"></label>
        </div><p class="form-err" id="u-err" hidden></p>
        <div class="mfoot">${e.isNew ? '' : (A.confirm === 'delUser' ? `<span class="confirm">${T('Delete this user permanently?', 'ลบผู้ใช้นี้ถาวร?')} <button type="button" class="btn btn-danger xs" data-act="delUserYes">${T('Delete', 'ยืนยันลบ')}</button> <button type="button" class="btn btn-ghost xs" data-act="delNo">${T('Cancel', 'ยกเลิก')}</button></span>` : `<button type="button" class="btn btn-danger-ghost sm" data-act="delUser">${T('Delete user', 'ลบผู้ใช้')}</button>`)}
          <span class="grow"></span><button type="button" class="btn btn-ghost sm" data-act="closeModal">${T('Cancel', 'ยกเลิก')}</button><button class="btn btn-hot sm" type="submit" id="u-save">${T('Save', 'บันทึก')}</button></div></form></div>`;
    } else {
      const p = e.data;
      el.innerHTML = `<div class="modal-bg"><form class="modal" id="payForm" novalidate><h2>${e.isNew ? T('Record payment', 'บันทึกการชำระเงิน') : T('Edit payment', 'แก้ไขรายการชำระเงิน')}</h2>
        <div class="mgrid">
          <label>${T('User', 'ผู้ใช้')}<select id="p-user">${A.accounts.map(a => `<option value="${esc(a._id)}" ${p.username === a._id ? 'selected' : ''}>${esc(a.username)}${a.name ? ' — ' + esc(a.name) : ''}</option>`).join('')}</select></label>
          <label>${T('Payment date', 'วันที่ชำระ')}<input id="p-date" type="date" value="${esc(p.date)}"></label>
          <label>${T('Amount', 'จำนวนเงิน')}<span class="pw"><input id="p-amount" type="number" step="0.01" min="0" value="${esc(p.amount)}"><select id="p-currency"><option value="USD" ${p.currency !== 'THB' ? 'selected' : ''}>USD</option><option value="THB" ${p.currency === 'THB' ? 'selected' : ''}>THB</option></select></span></label>
          <label>${T('Method', 'ช่องทาง')}<select id="p-method">${METHODS.map(m => `<option value="${m[0]}" ${p.method === m[0] ? 'selected' : ''}>${T(m[1], m[2])}</option>`).join('')}</select></label>
          <label>${T('Reference / slip no.', 'เลขอ้างอิง / สลิป')}<input id="p-ref" value="${esc(p.ref)}"></label>
          <label>${T('Period bought (days)', 'ระยะเวลาที่ซื้อ (วัน)')}<input id="p-days" type="number" min="0" step="1" value="${esc(p.days)}"></label>
          <label>${T('Status', 'สถานะ')}<select id="p-status">${Object.entries(PSTAT).map(([k, v]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${T(v[0], v[1])}</option>`).join('')}</select></label>
          ${e.isNew ? `<label class="chkl"><input id="p-extend" type="checkbox" checked> ${T('Extend the user’s Pro period when the status is Paid', 'ต่ออายุ Pro ให้ผู้ใช้อัตโนมัติเมื่อสถานะ “ชำระแล้ว”')}</label>` : ''}
        </div><p class="form-err" id="p-err" hidden></p>
        <div class="mfoot">${e.isNew ? '' : (A.confirm === 'delPay' ? `<span class="confirm">${T('Delete this payment?', 'ลบรายการนี้?')} <button type="button" class="btn btn-danger xs" data-act="delPayYes">${T('Delete', 'ยืนยันลบ')}</button> <button type="button" class="btn btn-ghost xs" data-act="delNo">${T('Cancel', 'ยกเลิก')}</button></span>` : `<button type="button" class="btn btn-danger-ghost sm" data-act="delPay">${T('Delete payment', 'ลบรายการ')}</button>`)}
          <span class="grow"></span><button type="button" class="btn btn-ghost sm" data-act="closeModal">${T('Cancel', 'ยกเลิก')}</button><button class="btn btn-hot sm" type="submit">${T('Save', 'บันทึก')}</button></div></form></div>`;
    }
    const first = el.querySelector('input:not([disabled]),select'); if (first) first.focus();
  }
  function openUser(id) {
    const a = id ? A.accounts.find(x => x._id === id) : null, m = id ? (A.members.find(x => x._id === id) || {}) : {};
    A.confirm = null;
    A.edit = { kind: 'user', isNew: !a, data: a ? { username: a.username, name: a.name, plan: a.plan, status: a.status, start: a.start, expiry: a.expiry, email: m.email, phone: m.phone, company: m.company, country: m.country, note: m.note } : { username: '', name: '', plan: 'pro', status: 'active', start: today(), expiry: addDays(today(), 365), email: '', phone: '', note: '' } };
    renderModal();
  }
  function openPay(id) {
    if (!A.accounts.length) { toast(T('Create a user before recording a payment.', 'สร้างผู้ใช้ก่อนบันทึกการชำระเงิน'), 'bad'); return; }
    const p = id ? A.payments.find(x => x._id === id) : null; A.confirm = null;
    A.edit = { kind: 'pay', isNew: !p, id, data: p ? Object.assign({}, p) : { username: A.accounts[0]._id, date: today(), amount: 0.99, currency: 'USD', method: 'bank', ref: '', days: 30, status: 'paid' } };
    renderModal();
  }
  async function saveUser() {
    const e = A.edit, v = id => $('#' + id).value.trim(), err = $('#u-err'), fail = m => { err.textContent = m; err.hidden = false; };
    const raw = e.isNew ? v('u-username') : e.data.username, username = raw.includes('@') ? raw.toLowerCase() : raw;
    if (!EMAIL_ID.test(username) && !/^[A-Za-z0-9_.-]{3,32}$/.test(username)) return fail(T('Enter the member’s email address.', 'กรอกอีเมลของสมาชิก'));
    if (username.toLowerCase() === ADMIN.user.toLowerCase()) return fail(T('That username is reserved for the administrator.', 'ชื่อนี้สงวนไว้สำหรับผู้ดูแลระบบ'));
    if (e.isNew && A.accounts.some(a => a._id.toLowerCase() === username.toLowerCase())) return fail(T('That username is already taken.', 'มีชื่อผู้ใช้นี้แล้ว'));
    const pass = $('#u-pass').value;
    if (e.isNew && pass.length < 8) return fail(T('The password must be at least 8 characters.', 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร'));
    if (!e.isNew && pass && pass.length < 8) return fail(T('The new password must be at least 8 characters.', 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร'));
    const email = username.includes('@') ? username : '';
    const plan = v('u-plan'), expiry = v('u-expiry'), start = v('u-start');
    if (plan === 'pro' && !expiry) return fail(T('Set an expiry date for a Pro plan.', 'กำหนดวันหมดอายุสำหรับแพ็กเกจ Pro'));
    if (start && expiry && expiry < start) return fail(T('The expiry date is before the start date.', 'วันหมดอายุอยู่ก่อนวันเริ่ม'));
    const btn = $('#u-save'); btn.disabled = true; btn.textContent = T('Saving…', 'กำลังบันทึก…');
    try {
      await Ops.saveUser(e.isNew, { username, name: e.data.name || '', plan, status: v('u-status'), start, expiry }, { email, note: v('u-note') }, pass);
      A.edit = null; renderModal(); toast(e.isNew ? T('User ' + username + ' created', 'สร้างผู้ใช้ ' + username + ' แล้ว') : T('Changes saved', 'บันทึกการเปลี่ยนแปลงแล้ว'), 'ok');
      if (pass) toast(T('Send the password to the user through a secure channel.', 'ส่งรหัสผ่านให้ผู้ใช้ผ่านช่องทางที่ปลอดภัย'));
    } catch (x) { btn.disabled = false; btn.textContent = T('Save', 'บันทึก'); fail(opErr(x)); }
  }
  async function savePay() {
    const e = A.edit, v = id => $('#' + id).value.trim(), err = $('#p-err'), fail = m => { err.textContent = m; err.hidden = false; };
    const amount = parseFloat(v('p-amount'));
    if (!(amount >= 0)) return fail(T('Enter the amount paid.', 'ระบุจำนวนเงิน'));
    const data = { username: v('p-user'), date: v('p-date') || today(), amount, currency: v('p-currency'), method: v('p-method'), ref: v('p-ref'), days: parseInt(v('p-days')) || 0, status: v('p-status'), created: e.data.created || new Date().toISOString() };
    try {
      const ext = e.isNew && $('#p-extend') && $('#p-extend').checked && data.status === 'paid' && data.days > 0;
      await Ops.savePayment(e.id, data, ext);
      A.edit = null; renderModal(); toast(T('Payment recorded', 'บันทึกการชำระเงินแล้ว') + (ext ? T(' · extended ' + data.days + ' days', ' · ต่ออายุ ' + data.days + ' วัน') : ''), 'ok');
    } catch (x) { fail(opErr(x)); }
  }
  async function extendUser(id, days, quiet) {
    await Ops.extend(id, days);
    const a = A.accounts.find(x => x._id === id);
    if (!quiet && a) toast(T(id + ' active until ' + a.expiry, id + ' ใช้งานได้ถึง ' + a.expiry), 'ok');
  }

  const genPass = () => { const c = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#%'; const r = crypto.getRandomValues(new Uint8Array(12)); return Array.from(r, x => c[x % c.length]).join(''); };
  function syncModalDraft() {
    const e = A.edit; if (!e) return;
    const g = id => { const el = $('#' + id); return el ? el.value : undefined; };
    if (e.kind === 'user') ['username', 'plan', 'status', 'start', 'expiry', 'note'].forEach(k => { const v = g('u-' + k); if (v !== undefined) e.data[k] = v; });
    else ['username', 'date', 'amount', 'currency', 'method', 'ref', 'days', 'status'].forEach(k => { const v = g(k === 'username' ? 'p-user' : 'p-' + k); if (v !== undefined) e.data[k] = v; });
  }

  // ------------------------------------------------------------------ render + events
  // keep typed registration fields when the page re-renders (plan switch, language)
  function regDraft() { const f0 = $('#regForm'); if (!f0) return null; const d = {}; f0.querySelectorAll('input[id]:not([type=file]),select[id]').forEach(el => { d[el.id] = el.type === 'checkbox' ? el.checked : el.value; }); return d; }
  function regRestore(d) { if (!d) return; Object.entries(d).forEach(([id, v]) => { const el = $('#' + id); if (el) { if (el.type === 'checkbox') el.checked = v; else el.value = v; } }); updPro('rp'); }
  function updPro(pre) {
    const cur = S.payCur || curOf(), sel = $('#' + pre + '-months'); if (!sel) return;
    const mo = +sel.value; S.payMonths = mo;
    const t = $('#' + pre + '-total'); if (t) t.textContent = money(Math.round(PRICE[cur] * mo * 100) / 100, cur);
    const pp = sel.closest('.pro-box').querySelector('.pro-price b'); if (pp) pp.textContent = money(PRICE[cur], cur);
    sel.closest('.pro-box').querySelectorAll('[data-act=paycur]').forEach(b => b.setAttribute('aria-pressed', b.dataset.c === cur));
  }
  function render() {
    const root = $('#app');
    document.body.dataset.view = S.view;
    document.documentElement.lang = S.ui;
    if (S.view === 'adminLogin' && S.role === 'admin') S.view = 'admin';
    if (S.view === 'codes' || S.view === 'elems') S.view = 'home';
    if ((ANV.includes(S.view) && isOff(S.view)) || (S.view === 'design' && isOff(S.elem))) { S.view = 'home'; setTimeout(() => toast(offMsg(), 'bad'), 0); }
    if (S.view === 'landing') root.innerHTML = viewLanding();
    else if (S.view === 'login') root.innerHTML = viewLogin(false) + siteFoot();
    else if (S.view === 'register') { const d = regDraft(); root.innerHTML = viewRegister() + siteFoot(); regRestore(d); }
    else if (S.view === 'account') { root.innerHTML = viewAccount() + siteFoot(); }
    else if (S.view === 'adminLogin') root.innerHTML = viewLogin(true) + siteFoot();
    else if (S.view === 'home') root.innerHTML = viewHome() + siteFoot();
    else if (S.view === 'design') { root.innerHTML = viewDesign() + siteFoot(); compute(); }
    else if (S.view === 'admin') { root.innerHTML = viewAdmin() + siteFoot(); if (S.role === 'admin') { adminSubscribe(); adminBody(); } }
    else if (ANV.includes(S.view)) { const an = anUI(S.view); if (!an) { S.view = 'home'; root.innerHTML = viewHome() + siteFoot(); return; } root.innerHTML = navBar() + an.view(); an.mount(); }
  }

  // ------------------------------------------------------------------ ANALYSIS (frame.js engine + analysis.js page)
  let AN = null; const AN2 = {};
  function anUI(view) {
    view = ANV.includes(view) ? view : 'analysis';
    if (!AN2[view]) {
      if (view === 'timber') { if (!window.SC_TIMBER_UI || !window.TIMBER) return null; AN2[view] = window.SC_TIMBER_UI({ T, esc, f, $, $$, S, toast, isPro, COPY, logoMark, today, render, saveFile, go }); AN = AN2[view]; window.SC_AN = AN; return AN; }
      if (view === 'tdraw') { if (!window.SC_TDRAW_UI || !window.TDET || !window.TDRAW) return null; AN2[view] = window.SC_TDRAW_UI({ T, esc, f, $, $$, S, toast, isPro, COPY, logoMark, today, render, saveFile, go }); AN = AN2[view]; window.SC_AN = AN; return AN; }
      if (view === 'conn') { if (!window.SC_CONN_UI || !window.CONN || !window.CONN.fe) return null; AN2[view] = window.SC_CONN_UI({ T, esc, f, $, $$, S, toast, isPro, COPY, logoMark, today, render, saveFile }); AN = AN2[view]; window.SC_AN = AN; return AN; }
      if (!window.SC_ANALYSIS_UI || !window.FRAME || (view === 'bridge' && !window.BRIDGE) || (view === 'building' && !window.BUILDING)) return null;
      AN2[view] = window.SC_ANALYSIS_UI({ T, esc, f, $, $$, S, toast, isPro, COPY, logoMark, today, render, saveFile, toDesign, mode: view === 'bridge' ? 'bridge' : view === 'building' ? 'building' : 'frame', viewName: view });
    }
    AN = AN2[view];
    window.SC_AN = AN; // handy for checking a model from the browser console
    return AN;
  }
  async function saveFile(name, blob) {
    try {
      const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
      if (dl) await dl.save({ filename: name, data: blob });
      else { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1500); }
      toast(T('Saved ', 'บันทึกแล้ว ') + name, 'ok');
    } catch (e) { toast(e && e.code === 'declined' ? T('Download cancelled', 'ยกเลิกการดาวน์โหลด') : T('Could not save the file.', 'บันทึกไฟล์ไม่สำเร็จ'), e && e.code === 'declined' ? '' : 'bad'); }
  }
  // member forces from the analysis → prefilled RC beam / column design (kN, kNm; Thai code in t, t·m)
  function toDesign(elem, a) {
    if (!ELEMS[elem].free && !isPro()) { toast(T('Column design is part of Pro.', 'การออกแบบเสาสำหรับสมาชิก Pro'), 'bad'); return; }
    const code = a.code || S.codeSel || (ELEMS[elem].codes ? ELEMS[elem].codes[0] : S.code) || 'AS', k = elem + ':' + code;
    const u = code === 'TH' ? 1 / 9.807 : 1, r = v => Math.round(v * u * 10) / 10;
    if (!S.inputs[k]) S.inputs[k] = JSON.parse(JSON.stringify(DEF[elem][code]));
    const v = S.inputs[k];
    if (elem === 'beam') Object.assign(v, { Mx: r(a.M), Vy: r(a.V), My: r(a.My || 0), Vx: r(a.Vz || 0), T: r(a.T || 0) });
    else Object.assign(v, { N: r(a.N), Mx: r(Math.abs(a.M)), My: r(a.My || 0), Vy: r(a.V), Vx: r(a.Vz || 0) });
    go('design', { elem, code });
    toast(T('Forces of member ' + a.id + ' copied — check the section and serviceability inputs.', 'คัดลอกแรงของชิ้นส่วน ' + a.id + ' แล้ว — ตรวจสอบหน้าตัดและค่าสภาวะใช้งาน'), 'ok');
  }

  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a.startsWith('an-') && ANV.includes(S.view) && AN) { AN.onClick(a, b); return; }
    if (a.startsWith('cn-') && S.view === 'conn' && AN) { AN.onClick(a, b); return; }
    if (a.startsWith('tb-') && S.view === 'timber' && AN) { AN.onClick(a, b); return; }
    if (a.startsWith('td-') && S.view === 'tdraw' && AN) { AN.onClick(a, b); return; }
    if (a === 'lang') { if (A.edit) syncModalDraft(); const wasReport = S.reportOpen; setLang(b.dataset.l); if (wasReport && S.view === 'design') { S.reportOpen = true; renderReport(); } }
    else if (a === 'nav') { const v = b.dataset.v; if (ANV.includes(v) && isOff(v)) { toast(offMsg(), 'bad'); return; } if ((v === 'home' || v === 'codes' || ANV.includes(v)) && S.role === 'guest') { S.role = 'free'; saveSession(); } go(v); if (b.dataset.qto && ANV.includes(v)) setTimeout(() => { const an = anUI(v); if (an && an.openQto) an.openQto(); }, 30); }
    else if (a === 'scroll') { const t = document.getElementById(b.dataset.t); if (t) t.scrollIntoView({ behavior: 'smooth' }); }
    else if (a === 'free') { if (S.role === 'guest') { S.role = 'free'; saveSession(); } go('home'); }
    else if (a === 'logout') logout();
    else if (a === 'register') { if (b.dataset.plan) S.regPlan = b.dataset.plan; else if (!S.regPlan) S.regPlan = 'free'; S.payCur = null; if (S.user && S.user.member) { S.applyOpen = b.dataset.plan === 'pro'; go('account'); } else go('register'); }
    else if (a === 'regplan') { S.regPlan = b.dataset.p; render(); }
    else if (a === 'paycur') { S.payCur = b.dataset.c; const box = b.closest('.pro-box'); const sel = box && box.querySelector('select[id$=-months]'); if (sel) updPro(sel.id.split('-')[0]); }
    else if (a === 'applyOpen') { S.applyOpen = true; S.payCur = null; render(); const f0 = $('#applyForm'); if (f0) f0.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    else if (a === 'applyClose') { S.applyOpen = false; render(); }
    else if (a === 'ckind') { S.ckind = b.dataset.k; $$('[data-act=ckind]').forEach(x => x.setAttribute('aria-pressed', x.dataset.k === S.ckind)); const t = $('#c-msg'); if (t) t.placeholder = S.ckind === 'feedback' ? T('What works well, what should change, what should we add?', 'อะไรดี อะไรควรปรับ หรือควรเพิ่มอะไร?') : T('How can we help?', 'ให้เราช่วยอะไร?'); }
    else if (a === 'savePayInfo') Ops.setPayInfo($('#pi-en').value.trim(), $('#pi-th').value.trim()).then(() => toast(T('Payment instructions saved', 'บันทึกวิธีชำระเงินแล้ว'), 'ok')).catch(x => toast(opErr(x), 'bad'));
    else if (a === 'slip') { const w = window.open('', '_blank'); Ops.slipUrl(b.dataset.r).then(u => { if (!u) { if (w) w.close(); toast(T('Slip not found', 'ไม่พบสลิป'), 'bad'); return; } if (w) { if (u.startsWith('data:')) w.document.write(u.startsWith('data:application/pdf') ? '<iframe src="' + u + '" style="border:0;width:100%;height:100vh"></iframe>' : '<img src="' + u + '" style="max-width:100%">'); else w.location = u; } }).catch(x => { if (w) w.close(); toast(opErr(x), 'bad'); }); }
    else if (a === 'approve' || a === 'reject') { const id = b.dataset.r, d = $('#rd-' + CSS.escape(id)), days = d ? +d.value : 0; b.disabled = true; Ops.decide(id, a === 'approve', days).then(() => toast(a === 'approve' ? T('Approved — Pro is on for this member', 'อนุมัติแล้ว — เปิด Pro ให้สมาชิกแล้ว') : T('Application rejected', 'ไม่อนุมัติคำขอ'), 'ok')).catch(x => { b.disabled = false; toast(opErr(x), 'bad'); }); }
    else if (a === 'mread') Ops.readMessage(b.dataset.m, !!b.dataset.u).catch(x => toast(opErr(x), 'bad'));
    else if (a === 'mdel') Ops.deleteMessage(b.dataset.m).then(() => toast(T('Message deleted', 'ลบข้อความแล้ว'), 'ok')).catch(x => toast(opErr(x), 'bad'));
    else if (a === 'code') { S.codeSel = b.dataset.c; S.code = b.dataset.c; S.codePop = true; render(); const p = $('.elem-pop .pick'); if (p) p.focus(); }
    else if (a === 'elem') { const e = b.dataset.e; if (isOff(e)) { toast(offMsg(), 'bad'); return; } if (!ELEMS[e].free && !isPro()) { toast(T('This designer is part of Pro. Sign in with a Pro account to use it.', 'ฟังก์ชันนี้สำหรับสมาชิก Pro กรุณาเข้าสู่ระบบด้วยบัญชี Pro'), 'bad'); return; } go('design', { elem: e, code: S.codeSel || S.code }); }
    else if (a === 'reset') { delete S.inputs[S.elem + ':' + S.code]; $('#dzIn').innerHTML = inputsHTML(); compute(); }
    else if (a === 'rowadd' && b.dataset.row === 'crs') { const v = inp(); if (v.crs.length < 20) v.crs.push({ n: Math.max(1, v.crs[v.crs.length - 1].n) }); $('#dzIn').innerHTML = inputsHTML(); schedule(); }
    else if (a === 'rowadd') { const v = inp(), k = b.dataset.row; v[k].push({ n: 2, d: v[k][v[k].length - 1].d }); $('#dzIn').innerHTML = inputsHTML(); schedule(); }
    else if (a === 'rowdel') { const v = inp(), k = b.dataset.row; v[k].splice(+b.dataset.i, 1); $('#dzIn').innerHTML = inputsHTML(); schedule(); }
    else if (a === 'report') { if (!isPro()) { toast(T('The full calculation report and PDF export are Pro features.', 'รายการคำนวณฉบับเต็มและ PDF สำหรับสมาชิก Pro'), 'bad'); return; } S.reportOpen = true; renderReport(); $('#reportWrap').scrollIntoView({ behavior: 'smooth' }); }
    else if (a === 'closeReport') { S.reportOpen = false; $('#reportWrap').innerHTML = ''; }
    else if (a === 'pdf') exportPdf();
    else if (a === 'v3sclear') { if (sviewer) { sviewer.sel = null; sviewer.draw(); if (sviewer.onpick) sviewer.onpick(null); } }
    else if (a === 'v3sreset') { S.v3s.cam = null; if (S.res && S.elem === 'stm3d') mountSTM(S.res); }
    else if (a === 'v3clear') { if (viewer) { viewer.sel = null; viewer.draw(); if (viewer.onpick) viewer.onpick(null); } }
    else if (a === 'v3view' || a === 'v3reset') {
      if (a === 'v3view') { S.v3.view = b.dataset.p; if (S.v3.view !== 'overall' && S.v3.cs === 'none' && S.res) S.v3.cs = worstCase(S.res); }
      S.v3.cam = null; if (S.res) { $$('[data-act=v3view]').forEach(x => x.setAttribute('aria-pressed', x.dataset.p === S.v3.view)); const cs = $('#v3case'); if (cs) cs.value = S.v3.cs; const md = $('#v3mode'); if (md) md.disabled = S.v3.cs === 'none'; mount3D(S.res); }
    }
    else if (a === 'tab') { A.tab = b.dataset.t; adminBody(); }
    else if (a === 'filter') { A.filter = b.dataset.f; adminBody(); }
    else if (a === 'newUser') openUser(null);
    else if (a === 'editUser') openUser(b.dataset.u);
    else if (a === 'newPay') openPay(null);
    else if (a === 'editPay') openPay(b.dataset.p);
    else if (a === 'closeModal') { A.edit = null; renderModal(); }
    else if (a === 'ext') extendUser(b.dataset.u, +b.dataset.d).catch(x => toast(opErr(x), 'bad'));
    else if (a === 'setExp') { const st = $('#u-start').value || today(); $('#u-expiry').value = addDays(st, +b.dataset.d); }
    else if (a === 'genPass') { $('#u-pass').value = genPass(); }
    else if (a === 'delUser' || a === 'delPay') { syncModalDraft(); A.confirm = a; renderModal(); }
    else if (a === 'delNo') { syncModalDraft(); A.confirm = null; renderModal(); }
    else if (a === 'delUserYes') { const id = A.edit.data.username; Ops.deleteUser(id).then(() => { A.edit = null; renderModal(); toast(T('User ' + id + ' deleted', 'ลบผู้ใช้ ' + id + ' แล้ว'), 'ok'); }).catch(x => toast(opErr(x), 'bad')); }
    else if (a === 'delPayYes') { Ops.deletePayment(A.edit.id).then(() => { A.edit = null; renderModal(); toast(T('Payment deleted', 'ลบรายการแล้ว'), 'ok'); }).catch(x => toast(opErr(x), 'bad')); }
    else if (a === 'feat' || a === 'featAll') { const off = a === 'featAll' ? {} : Object.assign({}, S.off || {}), k = b.dataset.k; if (a === 'feat') { if (off[k]) delete off[k]; else off[k] = true; } Ops.setFeatures(off).then(() => { render(); toast(a === 'featAll' ? T('All functions are on', 'เปิดทุกฟังก์ชันแล้ว') : (off[k] ? T('Switched off for users: ', 'ปิดสำหรับผู้ใช้: ') : T('Switched on: ', 'เปิดใช้งาน: ')) + featName(k), 'ok'); }).catch(x => toast(opErr(x), 'bad')); }
    else if (a === 'promo') { const on = !S.promo; Ops.setPromo(on).then(() => { render(); toast(on ? T('Pro is now free for all users', 'เปิด Pro ฟรีให้ผู้ใช้ทุกคนแล้ว') : T('Pro is back to paid accounts only', 'กลับเป็น Pro เฉพาะบัญชีที่ชำระเงิน'), 'ok'); }).catch(x => toast(opErr(x), 'bad')); }
    else if (a === 'closePop') { if (ev.target === b || b.tagName === 'BUTTON') { S.codePop = false; render(); } }
    else if (a === 'resetAsk' || a === 'resetNo') { A.resetAsk = a === 'resetAsk'; render(); }
    else if (a === 'resetYes') { A.resetAsk = false; Ops.reset().then(() => { render(); toast(CLOUD ? T('All users and payments deleted', 'ลบผู้ใช้และรายการชำระเงินทั้งหมดแล้ว') : T('Test data cleared', 'ล้างข้อมูลทดสอบแล้ว'), 'ok'); }).catch(x => toast(opErr(x), 'bad')); }
  });
  document.addEventListener('input', ev => {
    const t = ev.target;
    if (ANV.includes(S.view) && AN && t.closest('.an') && AN.onInput(t)) return;
    if (t.dataset.k && S.view === 'design') {
      const v = inp(), fd = SCHEMA[S.elem].find(x => x.k === t.dataset.k);
      v[t.dataset.k] = t.value;
      if (fd && typeof fd.re === 'string') v[fd.re] = SEC_DEF[t.value];
      if (t.dataset.k === 'layout' || t.dataset.k === 'method' || t.dataset.k === 'qext' || (fd && fd.re)) { const sc = $('#dzIn').scrollTop; $('#dzIn').innerHTML = inputsHTML(); $('#dzIn').scrollTop = sc; }
      schedule();
    }
    else if (t.dataset.row) { inp()[t.dataset.row][+t.dataset.i][t.dataset.f] = +t.value; schedule(); }
    else if (t.id === 'v3sshape') { S.v3s.shape = t.value; if (S.res && S.elem === 'stm3d') { $('#charts').querySelector('.card.v3').outerHTML = stmCard(S.res); mountSTM(S.res); } }
    else if (t.id === 'v3smode') { S.v3s.mode = t.value; if (S.res && S.elem === 'stm3d') mountSTM(S.res); }
    else if (t.id === 'v3case' || t.id === 'v3mode') { if (t.id === 'v3case') S.v3.cs = t.value; else S.v3.mode = t.value; const md = $('#v3mode'); if (md) md.disabled = S.v3.cs === 'none'; if (S.res) mount3D(S.res); }
    else if (t.id === 'rp-months' || t.id === 'ap-months') updPro(t.id.split('-')[0]);
    else if (t.dataset.meta) { S.meta[t.dataset.meta] = t.value; const o = $('#rv-' + t.dataset.meta); if (o) o.textContent = t.value; }
    else if (t.id === 'adm-q') { A.q = t.value; const pos = t.selectionStart; adminBody(); const n = $('#adm-q'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
  });
  document.addEventListener('submit', ev => {
    ev.preventDefault();
    const fm = ev.target;
    if (fm.id === 'loginForm') doLogin(fm);
    else if (fm.id === 'userForm') saveUser();
    else if (fm.id === 'regForm') doRegister();
    else if (fm.id === 'applyForm') doApply();
    else if (fm.id === 'pwForm') doPassword();
    else if (fm.id === 'contactForm') doContact();
    else if (fm.id === 'payForm') savePay();
  });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && A.edit) { A.edit = null; renderModal(); } else if (ev.key === 'Escape' && S.codePop) { S.codePop = false; render(); } });

  if (S.role !== 'guest') S.view = S.role === 'admin' ? 'admin' : 'home';
  render();
  if (S.user && S.user.member) refreshMe(true);
})();
