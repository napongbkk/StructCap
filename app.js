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
  const stdFor = () => S.elem === 'gantry' ? 'AS 4100:2020 · AS/NZS 1170.2 · AS/NZS 1163' : S.code === 'AS' ? 'AS 3600:2018' : cStd(S.code);
  const ELEMS = {
    beam: { en: 'RC Beam', th: 'คาน คสล.', den: 'Bending about both axes, shear, torsion, crack width and service stresses.', dth: 'ดัดสองแกน แรงเฉือน แรงบิด ความกว้างรอยร้าว และหน่วยแรงใช้งาน', free: true },
    column: { en: 'RC Column', th: 'เสา คสล.', den: 'N–M interaction for both axes plus the full biaxial N–Mx–My contour.', dth: 'แผนภาพปฏิสัมพันธ์ N–M ทั้งสองแกน และ N–Mx–My สองแกน', free: false },
    pilecap: { en: 'RC Pile Cap', th: 'ฐานรากบนเสาเข็ม', den: 'Beam method or strut-and-tie, punching at column and piles, one-way shear.', dth: 'วิธีคานหรือแบบจำลองโครงถัก (STM) เฉือนทะลุที่เสาและเข็ม เฉือนแบบคาน', free: false },
    gantry: { en: 'Sign Gantry', th: 'โครงป้ายจราจรยื่น', den: 'Steel cantilever sign structure: CHS / SHS / RHS members, welded or bolted arm, base plate, fatigue.', dth: 'โครงเหล็กป้ายจราจรแบบคานยื่น: หน้าตัด CHS / SHS / RHS รอยต่อเชื่อมหรือสลัก แผ่นฐาน และความล้า', free: false, codes: ['AS'], steel: true }
  };
  const UNITS = {
    len: { si: ['mm', 'mm', 1], th: ['cm', 'ซม.', 10] }, spc: { si: ['mm', 'mm', 1], th: ['cm', 'ซม.', 10] }, dia: { si: ['mm', 'mm', 1], th: ['mm', 'มม.', 1] },
    stress: { si: ['MPa', 'MPa', 1], th: ['ksc', 'ksc', RC.KSC] }, force: { si: ['kN', 'kN', 1], th: ['t', 'ตัน', RC.TF] }, moment: { si: ['kNm', 'kNm', 1], th: ['t·m', 'ตัน·ม.', RC.TF] },
    density: { si: ['kN/m³', 'kN/m³', 1], th: ['t/m³', 'ตัน/ม.³', RC.TF] }, none: { si: ['', '', 1], th: ['', '', 1] },
    lenm: { si: ['m', 'ม.', 1000], th: ['m', 'ม.', 1000] }, kpa: { si: ['kPa', 'kPa', 1], th: ['kPa', 'kPa', 1] }, ms: { si: ['m/s', 'ม./วินาที', 1], th: ['m/s', 'ม./วินาที', 1] }, pa: { si: ['Pa', 'Pa', 1], th: ['Pa', 'Pa', 1] }
  };
  const OUT_TH = { kN: [['t', 'ตัน'], 1 / RC.TF], kNm: [['t·m', 'ตัน·ม.'], 1 / RC.TF], mm: [['cm', 'ซม.'], 0.1], MPa: [['ksc', 'ksc'], 1 / RC.KSC], 'mm²': [['cm²', 'ซม.²'], 0.01], 'mm²/m': [['cm²/m', 'ซม.²/ม.'], 0.01] };
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
  const GA = window.GANTRY;
  const YN = [['yes', 'Yes', 'ใช่'], ['no', 'No', 'ไม่ใช่']];
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
    F('Lst', 'conn', 'Stub length from column face', 'ความยาวท่อสั้นจากผิวเสา', 'len', { when: isBolt }), F('tep', 'conn', 'End plate thickness', 'ความหนาแผ่นปลาย', 'len', { when: isBolt }),
    F('nf', 'conn', 'Flange bolts (number)', 'จำนวนสลักหน้าแปลน', 'none', { type: 'int', when: isBolt }), F('fb', 'conn', 'Flange bolt size', 'ขนาดสลักหน้าแปลน', 'none', { type: 'sel', opts: BOLT_OPTS, when: isBolt }),
    F('fg', 'conn', 'Flange bolt grade', 'เกรดสลักหน้าแปลน', 'none', { type: 'sel', opts: BGR_OPTS, when: isBolt }), F('af', 'conn', 'Bolt offset from tube face', 'ระยะสลักจากผิวท่อ', 'len', { when: isBolt }),
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
  DEF.gantry = { AS: {
    H: 7.0, L: 6.5, ke: 2.2, Bs: 3.0, Hs: 2.0, xs: 4.5, ez: 0, ey: 350, gs: 0.35, Gadd: 1.0,
    colShape: 'CHS', colSize: '457x12.7', colGrade: 'C350L0', armShape: 'CHS', armSize: '323.9x9.5', armGrade: 'C350L0',
    mode: 'V', Vu: 45, Vs: 30, qu: 1.2, qs: 0.54, Cfig: 1.4, Cdc: 1.2, Cda: 1.2, Cdyn: 1.0, eb: 0,
    ctype: 'weld', cweld: 'cjp', sa: 10, Lst: 400, tep: 32, nf: 8, fb: 'M24', fg: '8.8', af: 45,
    nb: 12, db: 'M36', bg: '8.8', ab: 75, ep: 60, tp: 40, fyp: 340, bweld: 'cjp', sb: 12, stiff: 'yes', ts: 16, hs: 300, sst: 8,
    fon: 'yes', IF: 1.0, phiF: 0.7, PNW: 250, Vm: 5.0, tg: 'yes', PTG: 900, xTG: 4.5, LTG: 3700, dsh: 300, ga: 'no', PG: 1000,
    cB: 'auto', cS: 'auto', cR: 'auto', cA: 'auto', limH: 100, limV: 150 } };

  // ------------------------------------------------------------------ session
  const sess = ss.get('srcSession'); if (sess) Object.assign(S, { role: sess.role, user: sess.user });
  const isPro = () => S.role === 'pro' || S.role === 'admin' || !!S.promo;
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
      ['accounts', 'members', 'payments', 'settings'].forEach(c => { d[c] = d[c] || {}; });
      return d;
    },
    _save(d) { this.persistent = ls.set(DBKEY, JSON.stringify(d)); if (!this.persistent) this._mem = d; },
    async get(col, id) { return this._load()[col][id] || null; },
    async set(col, id, data) { const d = this._load(); d[col][id] = data; this._save(d); this._emit(col); },
    async del(col, id) { const d = this._load(); delete d[col][id]; this._save(d); this._emit(col); },
    async reset() { const keep = this._load().settings; this._mem = null; this._save({ accounts: {}, members: {}, payments: {}, settings: keep }); ['accounts', 'members', 'payments'].forEach(c => this._emit(c)); },
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
    const r = await fetch(CFG.apiUrl, { method: 'POST', headers, body: JSON.stringify(Object.assign({ action, token: ss.get('scAdminToken') }, payload || {})) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { const e = new Error('auth'); e.code = 'auth'; throw e; }
    if (!r.ok) { const e = new Error(j.error || 'http ' + r.status); e.code = 'http'; e.msg = j.error; throw e; }
    return j;
  }
  const Ops = {
    async adminLogin(u, p) {
      if (CLOUD) { const j = await api('adminLogin', { username: u, password: p }); if (j.ok) ss.set('scAdminToken', j.token); return !!j.ok; }
      const h = await pbkdf2(u + '\u0000' + p, ADMIN.salt, ADMIN.iter); return u === ADMIN.user && h === ADMIN.hash;
    },
    async userLogin(u, p) {
      if (CLOUD) return api('login', { username: u, password: p });
      const acc = await Store.get('accounts', u);
      if (!acc || (await pbkdf2(p, acc.salt, acc.iter || USER_ITER)) !== acc.hash) return { ok: false, err: 'bad' };
      if (acc.status !== 'active') return { ok: false, err: 'suspended' };
      if (acc.plan === 'pro' && acc.expiry && acc.expiry < today()) return { ok: false, err: 'expired', expiry: acc.expiry };
      return { ok: true, account: { username: u, name: acc.name, plan: acc.plan, expiry: acc.expiry } };
    },
    async refresh() {
      if (!CLOUD) return;
      const j = await api('list');
      A.accounts = (j.accounts || []).map(a => Object.assign({ _id: a.username }, a));
      A.members = (j.members || []).map(m => Object.assign({ _id: m.username }, m));
      A.payments = (j.payments || []).map(p => Object.assign({ _id: p.id }, p, { amount: +p.amount }));
      S.promo = !!j.proFree;
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
    async setPromo(on) { if (CLOUD) { await api('setPromo', { on }); S.promo = on; return; } await Store.set('settings', 'global', { proFree: on, changed: new Date().toISOString() }); S.promo = on; },
    async reset() { if (CLOUD) { await api('reset'); return Ops.refresh(); } await Store.reset(); }
  };
  const opErr = x => x && x.code === 'auth' ? (ss.del('scAdminToken'), T('Your admin session has expired. Sign in again.', 'เซสชันผู้ดูแลหมดอายุ กรุณาเข้าสู่ระบบใหม่'))
    : x && x.msg === 'Username taken' ? T('That username is already taken.', 'มีชื่อผู้ใช้นี้แล้ว')
      : T('Could not save. Check the connection and try again.', 'บันทึกไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง');
  // "Pro for free" switch set by the administrator (settings/global.proFree)
  const promoOn = () => { const g = Store._load().settings.global; return !!(g && g.proFree); };
  S.promo = CLOUD ? false : promoOn();
  if (CLOUD) api('settings').then(j => { if (!!j.proFree !== S.promo) { S.promo = !!j.proFree; if (S.view !== 'design') render(); } }).catch(() => { });
  if (!CLOUD) Store.watch('settings', () => { const was = S.promo; S.promo = promoOn(); if (was !== S.promo && S.view !== 'design') render(); });
  window.addEventListener('storage', e => { if (e.key === DBKEY) ['accounts', 'members', 'payments', 'settings'].forEach(c => Store._emit(c)); });

  // ------------------------------------------------------------------ toast
  function toast(msg, tone) {
    const t = document.createElement('div'); t.className = 'toast ' + (tone || ''); t.textContent = msg; t.setAttribute('role', 'status');
    $('#toasts').appendChild(t); setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3700);
  }

  // ------------------------------------------------------------------ navigation
  function go(view, patch) { Object.assign(S, patch || {}); S.view = view; S.codePop = false; S.reportOpen = false; render(); window.scrollTo(0, 0); }
  function saveSession() { ss.set('srcSession', { role: S.role, user: S.user }); }
  function logout() { S.role = 'guest'; S.user = null; ss.del('srcSession'); ss.del('scAdminToken'); A.loaded = false; go('landing'); toast(T('Signed out', 'ออกจากระบบแล้ว')); }
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
      : S.role === 'pro' ? '<span class="chip chip-pro">PRO · ' + esc(S.user.name || S.user.username) + '</span>'
        : S.role === 'free' ? (S.promo ? '<span class="chip chip-pro">PRO · ' + T('free now', 'ฟรี') + '</span>' : '<span class="chip">Free</span>') : '';
    return `<header class="nav"><div class="nav-in">
      <button class="brand" data-act="nav" data-v="${S.role === 'guest' ? 'landing' : 'home'}" aria-label="StructCap home">${logoMark(32)}<span class="wordmark">Struct<b>Cap</b></span></button>
      <nav class="nav-links">
        ${S.role !== 'guest' ? `<button data-act="nav" data-v="home">${T('RC design', 'ออกแบบ RC')}</button>` : `<button data-act="nav" data-v="landing">${T('Home', 'หน้าแรก')}</button><button data-act="scroll" data-t="plans">${T('Plans', 'แพ็กเกจ')}</button>`}
        ${S.role === 'admin' ? `<button data-act="nav" data-v="admin">${T('Admin', 'จัดการระบบ')}</button>` : ''}
      </nav>
      <div class="nav-right">${langToggle()}${who}
        ${S.role === 'guest' ? `<button class="btn btn-ghost sm" data-act="nav" data-v="login">${T('Pro sign in', 'เข้าสู่ระบบ Pro')}</button>` : `<button class="btn btn-ghost sm" data-act="logout">${T('Sign out', 'ออกจากระบบ')}</button>`}
      </div></div></header>`;
  }

  const COPY = '© ' + new Date().getFullYear() + ' StructCap · Developed by NS';
  const siteFoot = () => `<footer class="foot"><div class="wrap foot-in"><span>${T('StructCap is a design aid. Results must be checked by a licensed engineer.', 'StructCap เป็นเครื่องมือช่วยคำนวณ ผลลัพธ์ต้องตรวจสอบโดยวิศวกรผู้มีใบอนุญาต')}</span><span class="copy">${COPY} · ${T('All rights reserved', 'สงวนลิขสิทธิ์')}</span>${S.role === 'guest' ? `<button class="linkbtn" data-act="nav" data-v="adminLogin">${T('Administrator sign in', 'เข้าสู่ระบบผู้ดูแล')}</button>` : ''}</div></footer>`;

  // ------------------------------------------------------------------ LANDING
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
          <p class="lead">${T('Check reinforced concrete beams, columns and pile caps against three design codes, with section sketches, column interaction diagrams and a full calculation report you can export to PDF.', 'ตรวจสอบคาน เสา และฐานรากบนเสาเข็ม คอนกรีตเสริมเหล็ก ตามสามมาตรฐานการออกแบบ พร้อมภาพหน้าตัด แผนภาพปฏิสัมพันธ์ของเสา และรายการคำนวณฉบับเต็มส่งออกเป็น PDF')}</p>
          <ul class="code-list">${codes.map(c => `<li class="tone-${c[1]}"><span class="code-tag">${c[0]}</span><div><b>${c[2]}</b> <span class="mono">${c[3]}</span><p>${c[4]}</p></div></li>`).join('')}</ul>
          <div class="cta-row">${S.promo ? `
            <span class="btn btn-glass struck" aria-hidden="true">${T('Start free', 'เริ่มใช้งานฟรี')}</span><span class="btn btn-glass struck" aria-hidden="true">${T('Pro sign in', 'เข้าสู่ระบบ Pro')}</span>
            <button class="btn btn-hot" data-act="free">${T('Pro for free — start now', 'Pro ฟรี — เริ่มใช้งาน')}</button>` : `
            <button class="btn btn-hot" data-act="free">${T('Start free', 'เริ่มใช้งานฟรี')}</button>
            <button class="btn btn-glass" data-act="nav" data-v="login">${T('Pro sign in', 'เข้าสู่ระบบ Pro')}</button>`}
          </div>
        </div>
        <div class="hero-card" aria-label="${T('Example beam result', 'ตัวอย่างผลการออกแบบคาน')}">
          <div class="hc-head"><span>RC Beam · EN 1992-1-1:2023</span><span class="pill ok">PASS</span></div>
          <div class="hc-body">${heroSketch()}
            <ul class="hc-urs">
              ${[['M_Ed / M_Rd', 0.83], ['V_Ed / V_Rd', 0.38], [T('Torsion', 'แรงบิด'), 0.58], ['w_k / w_max', 0.71]].map(([l, u]) => `<li><span>${l}</span><div class="ur"><i style="width:${u * 100}%"></i></div><b>${u.toFixed(2)}</b></li>`).join('')}
            </ul></div>
          <p class="hc-note">${T('Example', 'ตัวอย่าง')}: 300×600, 4H20 + 2H16, H10@150</p>
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
        <article class="plan"><h3>Free</h3><p class="price"><b>USD 0</b></p><ul>
          ${ticks.map(t => `<li>${t}</li>`).join('')}<li class="no">${T('Full calculation report / PDF', 'รายการคำนวณฉบับเต็ม / PDF')}</li><li class="no">${T('Columns and pile caps', 'เสา และฐานรากบนเสาเข็ม')}</li></ul>
          ${S.promo ? `<span class="btn btn-ghost struck" aria-hidden="true">${T('Start free', 'เริ่มใช้งานฟรี')}</span><p class="promo-note">${T('Pro for free — every feature is open', 'Pro ฟรี — เปิดทุกฟังก์ชัน')}</p>` : `<button class="btn btn-ghost" data-act="free">${T('Start free', 'เริ่มใช้งานฟรี')}</button>`}</article>
        <article class="plan plan-pro"><span class="ribbon">${T('Recommended', 'แนะนำ')}</span><h3>Pro</h3><p class="price">${S.promo ? `<s>USD 1.99</s> <b>${T('Free now', 'ฟรีตอนนี้')}</b>` : `<b>USD 1.99</b> / ${T('month', 'เดือน')}`}</p><ul>
          <li>${T('Everything in Free', 'ทุกอย่างใน Free')}</li><li>${T('RC columns: N–M and N–Mx–My interaction', 'เสา คสล. แผนภาพ N–M และ N–Mx–My')}</li><li>${T('Pile caps: beam method and STM', 'ฐานรากบนเสาเข็ม วิธีคาน และ STM')}</li><li>${T('Steel sign gantry to AS 4100, including fatigue', 'โครงป้ายจราจรเหล็กตาม AS 4100 รวมความล้า')}</li><li>${T('Full calculation report with clause references', 'รายการคำนวณฉบับเต็ม อ้างอิงข้อกำหนด')}</li><li>${T('PDF export', 'ส่งออกรายงานเป็น PDF')}</li></ul>
          ${S.promo ? `<span class="btn btn-ghost struck" aria-hidden="true">${T('Pro sign in', 'เข้าสู่ระบบ Pro')}</span><button class="btn btn-hot" data-act="free">${T('Pro for free — start now', 'Pro ฟรี — เริ่มใช้งาน')}</button>` : `<button class="btn btn-hot" data-act="nav" data-v="login">${T('Pro sign in', 'เข้าสู่ระบบ Pro')}</button>`}</article>
      </div></div></section>

    ${siteFoot()}`;
  }

  // ------------------------------------------------------------------ LOGIN
  function viewLogin(admin) {
    return `${navBar()}<section class="auth-wrap"><div class="glow soft" aria-hidden="true"><i class="g1"></i><i class="g3"></i></div>
      <form class="auth-card" id="loginForm" data-admin="${admin ? 1 : 0}" novalidate>
        <p class="eyebrow">${admin ? 'Administrator' : 'Pro member'}</p>
        <h1>${admin ? T('Administrator sign in', 'เข้าสู่ระบบผู้ดูแล') : T('Pro sign in', 'เข้าสู่ระบบ Pro')}</h1>
        <p class="muted">${admin ? T('Manage users, passwords, subscription periods and payments.', 'จัดการผู้ใช้ รหัสผ่าน อายุการใช้งาน และการชำระเงิน') : T('Use the username and password issued by your administrator.', 'ใช้ชื่อผู้ใช้และรหัสผ่านที่ได้รับจากผู้ดูแลระบบ')}</p>
        <label for="lg-user">${T('Username', 'ชื่อผู้ใช้')}</label><input id="lg-user" autocomplete="username" required>
        <label for="lg-pass">${T('Password', 'รหัสผ่าน')}</label><input id="lg-pass" type="password" autocomplete="current-password" required>
        <p class="form-err" id="lg-err" hidden></p>
        <button class="btn btn-hot wide" type="submit" id="lg-btn">${T('Sign in', 'เข้าสู่ระบบ')}</button>
        ${admin ? `<p class="muted small"><button type="button" class="linkbtn" data-act="nav" data-v="login">${T('Pro member sign in', 'เข้าสู่ระบบสมาชิก Pro')}</button></p>` : `<p class="muted small">${T('No account yet?', 'ยังไม่มีบัญชี?')} <button type="button" class="linkbtn" data-act="free">${T('Continue with Free', 'ใช้งานแบบ Free ก่อน')}</button> · <button type="button" class="linkbtn" data-act="nav" data-v="adminLogin">${T('Administrator', 'ผู้ดูแลระบบ')}</button></p>`}
      </form></section>`;
  }
  async function doLogin(form) {
    const admin = form.dataset.admin === '1', u = $('#lg-user').value.trim(), p = $('#lg-pass').value, err = $('#lg-err'), btn = $('#lg-btn');
    err.hidden = true; btn.disabled = true; btn.textContent = T('Checking…', 'กำลังตรวจสอบ…');
    const fail = m => { err.textContent = m; err.hidden = false; btn.disabled = false; btn.textContent = T('Sign in', 'เข้าสู่ระบบ'); };
    const bad = T('Username or password is incorrect.', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    try {
      if (admin) {
        if (!(await Ops.adminLogin(u, p))) return fail(bad);
        S.role = 'admin'; S.user = { username: u, name: 'Administrator' }; saveSession(); go('admin'); toast(T('Welcome, administrator', 'ยินดีต้อนรับ ผู้ดูแลระบบ'), 'ok'); return;
      }
      if (!/^[A-Za-z0-9_.-]{3,32}$/.test(u)) return fail(T('Usernames are 3–32 letters, digits, _ . or -.', 'ชื่อผู้ใช้ต้องเป็นตัวอักษรอังกฤษหรือตัวเลข 3–32 ตัว'));
      const res = await Ops.userLogin(u, p);
      if (!res.ok) {
        if (res.err === 'suspended') return fail(T('This account is suspended. Contact the administrator.', 'บัญชีนี้ถูกระงับ กรุณาติดต่อผู้ดูแลระบบ'));
        if (res.err === 'expired') return fail(T('Your Pro plan expired on ', 'แพ็กเกจ Pro หมดอายุเมื่อ ') + res.expiry + T('. Contact the administrator to renew.', ' กรุณาต่ออายุกับผู้ดูแลระบบ'));
        return fail(bad);
      }
      const acc = res.account;
      S.role = acc.plan === 'pro' ? 'pro' : 'free'; S.user = { username: u, name: acc.name, plan: acc.plan, expiry: acc.expiry }; saveSession();
      go('home'); toast(T('Signed in', 'เข้าสู่ระบบแล้ว') + (acc.plan === 'pro' ? ' · Pro ' + T('until ', 'ถึง ') + acc.expiry : ''), 'ok');
    } catch (e) { fail(T('Sign-in check failed. Try again.', 'ตรวจสอบไม่สำเร็จ ลองอีกครั้ง')); }
  }

  // ------------------------------------------------------------------ HOME (step 1 code, step 2 member)
  function viewHome() {
    const days = S.user && S.user.expiry ? Math.ceil((new Date(S.user.expiry) - new Date(today())) / 864e5) : null;
    const plan = S.promo && S.role !== 'admin' ? T('Pro is free right now · all features unlocked', 'ตอนนี้ใช้งาน Pro ได้ฟรี · เปิดทุกฟังก์ชัน') : S.role === 'pro' ? T('Pro plan', 'แพ็กเกจ Pro') + (days !== null ? T(` · ${days} days left (until ${S.user.expiry})`, ` · เหลือ ${days} วัน (ถึง ${S.user.expiry})`) : '')
      : S.role === 'admin' ? T('Administrator · all features', 'ผู้ดูแลระบบ · เข้าถึงทุกฟังก์ชัน') : T('Free plan · RC beams to all codes', 'แพ็กเกจ Free · ออกแบบคาน คสล. ได้ทุกมาตรฐาน');
    const sel = S.codeSel;
    return `${navBar()}<main class="wrap page">
      <div class="page-head"><div><p class="eyebrow">Structural Capacity · ${T('RC design', 'ออกแบบคอนกรีตเสริมเหล็ก')}</p><h1>${T('Select design code', 'เลือกมาตรฐานการออกแบบ')}</h1><p class="muted">${S.user ? esc(S.user.name || S.user.username) + ' · ' : ''}${plan}</p></div></div>
      <section class="flow">
        <div class="pick-grid">${Object.keys(CODES).map(k => `<button class="pick code-pick tone-${CODES[k].tone} ${sel === k ? 'on' : ''}" data-act="code" data-c="${k}" aria-pressed="${sel === k}">
          <span class="code-top"><span class="pick-t">${cName(k)}</span><span class="code-big" aria-hidden="true">${CODES[k].tag}</span></span><span class="mono">${cStd(k)}</span><span class="pick-s">${cSub(k)}</span>
          <span class="pick-go">${sel === k ? T('Selected ✓', 'เลือกแล้ว ✓') : T('Select →', 'เลือก →')}</span></button>`).join('')}</div>
      </section>
      ${sel && S.codePop ? `<div class="modal-bg pop" data-act="closePop"><div class="modal elem-pop tone-${CODES[sel].tone}" role="dialog" aria-modal="true" aria-labelledby="popT">
        <div class="pop-head"><span class="code-big">${CODES[sel].tag}</span><div><p class="eyebrow">${cName(sel)} · ${cStd(sel)}</p><h2 id="popT">${T('What are you designing?', 'เลือกชิ้นส่วนที่ต้องการออกแบบ')}</h2></div><button class="icon-btn pop-x" data-act="closePop" aria-label="${T('Close', 'ปิด')}">×</button></div>
        <div class="pop-grid">${Object.entries(ELEMS).filter(([k, e]) => !e.codes || e.codes.includes(sel)).map(([k, e]) => {
        const locked = !e.free && !isPro();
        return `<button class="pick elem ${locked ? 'locked' : ''}" data-act="elem" data-e="${k}">
            ${elemIcon(k)}<span class="pick-t">${T(e.en, e.th)} <span class="pill ${e.free || S.promo ? 'free' : 'pro'}">${e.free ? 'Free' : S.promo ? T('Pro · free now', 'Pro · ฟรี') : 'Pro'}</span></span><span class="pick-s">${T(e.den, e.dth)}</span>
            <span class="pick-go">${locked ? T('Sign in with Pro to unlock', 'เข้าสู่ระบบ Pro เพื่อใช้งาน') : T('Open designer →', 'เปิดหน้าออกแบบ →')}</span></button>`;
      }).join('')}</div></div></div>` : ''}
      <section class="analysis-strip">${analysisIcon()}<div><p class="eyebrow">Structural Analysis</p><h2>${T('Analysis tools', 'เครื่องมือวิเคราะห์โครงสร้าง')}</h2><p class="muted">${T('Continuous beams, 2D frames and load combinations.', 'คานต่อเนื่อง โครงข้อแข็ง 2 มิติ และการรวมแรง')}</p></div><span class="pill soon">${T('Phase 2 · in development', 'ระยะที่ 2 · กำลังพัฒนา')}</span></section>
    </main>`;
  }
  // Line-sketch icons in drafting style: ink outlines, accent for loads / struts
  function elemIcon(k) {
    const o = '<svg class="ei" viewBox="0 0 120 72" aria-hidden="true">';
    if (k === 'gantry') return o + `
      <path d="M8 68h104" class="ln"/>${[12, 22, 32, 42].map(x => `<path d="M${x} 68l-5 4" class="ln-thin"/>`).join('')}
      <path d="M16 66h16" class="ln"/><rect x="21" y="10" width="6" height="56" class="ln"/>
      <rect x="27" y="11" width="84" height="5" class="ln"/><path d="M27 13.5h84" class="ln-dash"/>
      <rect x="58" y="18" width="40" height="24" class="ln"/><path d="M62 24h32M62 30h26M62 36h20" class="ln-thin"/>
      <path d="M66 16v2M90 16v2" class="ln"/><path d="M29 16l6 6" class="ln-thin"/>
      <g class="ln-acc"><circle cx="104" cy="30" r="4"/><path d="M101 27l6 6M107 27l-6 6"/></g></svg>`;
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
    else ctrl = `<input id="${id}" data-k="${fd.k}" type="number" inputmode="decimal" step="any" value="${esc(v[fd.k])}">`;
    return `<div class="fld"><label for="${id}">${fmLabel(fieldLabel(fd))}</label><div class="ctl">${ctrl}${u ? `<span class="unit">${u}</span>` : ''}</div></div>`;
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
    const order = S.elem === 'gantry' ? ['geo', 'sign', 'col', 'arm', 'wind', 'conn', 'base', 'fat', 'lim'] : S.elem === 'pilecap' ? ['piles', 'geo', 'mat', 'bars', 'coef', 'uls', 'sls'] : ['geo', 'mat', 'coef', 'bars', 'link', 'uls', 'sls'];
    let html = '';
    order.forEach(g => {
      const fs = sch.filter(fd => fd.g === g);
      let body = fs.map(fd => fieldHTML(fd, v)).join('');
      if (S.elem === 'beam' && g === 'bars') {
        body = `<p class="sub-h">${T('Top bars', 'เหล็กบน')}</p>${barRowsHTML('top', v.top)}<p class="sub-h">${T('Bottom bars', 'เหล็กล่าง')}</p>${barRowsHTML('bot', v.bot)}
          <p class="sub-h">${T('Side bars (each face)', 'เหล็กข้าง (ต่อด้าน)')}</p><div class="brow"><span class="rlab">${T('Per face', 'ต่อด้าน')}</span><input type="number" min="0" step="1" id="in-sideN" data-k="sideN" value="${v.sideN}" aria-label="${T('Side bars per face', 'จำนวนเหล็กข้างต่อด้าน')}"><span class="x">×</span><select id="in-sideD" data-k="sideD" aria-label="${T('Side bar diameter', 'ขนาดเหล็กข้าง')}">${diaOpts(v.sideD)}</select><span></span></div>
          <p class="hint">${T('Bars are positioned automatically: equal spacing inside the links, further layers stacked at the minimum clear gap.', 'ระบบจัดตำแหน่งเหล็กอัตโนมัติ: ระยะเท่ากันภายในเหล็กปลอก ชั้นถัดไปเว้นระยะช่องว่างน้อยสุด')}</p>`;
      }
      if (S.elem === 'gantry' && (g === 'col' || g === 'arm')) body += secProps(GA.section(v[g + 'Shape'], v[g + 'Size'], v[g + 'Grade']));
      if (S.elem === 'gantry' && g === 'wind') body += `<p class="hint">${T('Wind acts normal to the sign face. e/B_s = 0.2 models oblique wind (AS/NZS 1170.2 App. B).', 'ลมกระทำตั้งฉากกับหน้าป้าย ใช้ e/B_s = 0.2 สำหรับลมเฉียง (AS/NZS 1170.2 ภาคผนวก B)')}</p>`;
      if (S.elem === 'gantry' && g === 'fat') body += `<p class="hint">${T('Equivalent static fatigue pressures after AASHTO LTS; defaults 250 Pa natural gust, 900 Pa truck gust, 1000 Pa galloping. Adopt the road authority’s values.', 'แรงดันความล้าสถิตเทียบเท่าตาม AASHTO LTS ค่าเริ่มต้น 250 Pa ลมกระโชก 900 Pa ลมรถบรรทุก 1000 Pa แกลลอปปิง ใช้ค่าตามหน่วยงานทางหลวง')}</p>`;
      if (g === 'coef' && !fs.length && S.elem !== 'pilecap') body = `<p class="hint">${S.code === 'AS' ? T('Capacity reduction factors φ follow Table 2.2.2 and are set automatically from k_uo.', 'ตัวคูณลดกำลัง φ ตามตาราง 2.2.2 คำนวณอัตโนมัติจาก k_uo') : T('Strength reduction factors φ are set from the steel strain (0.65–0.90); 0.75 for shear and torsion.', 'ตัวคูณลดกำลัง φ คำนวณอัตโนมัติจากความเครียดเหล็ก (0.65–0.90) และ 0.75 สำหรับแรงเฉือน/แรงบิด')}</p>`;
      if (!body) return;
      html += `<details class="grp" open><summary>${T(GROUPS[g][0], GROUPS[g][1])}</summary><div class="grp-b">${body}</div></details>`;
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
          <div class="out-top"><div class="sketch-card"><h2 class="card-h">${S.elem === 'gantry' ? T('Elevation and plan', 'รูปด้านและผัง') : S.elem === 'pilecap' ? T('Plan & reactions', 'ผังฐานรากและแรงเข็ม') : T('Section & reinforcement', 'หน้าตัดและเหล็กเสริม')}</h2><div id="sketch"></div></div>
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
        conn: { type: v.ctype, weld: v.cweld, sa: +v.sa, Lst: +v.Lst, tep: +v.tep, nf: v.nf | 0, af: +v.af, fb: v.fb, fg: v.fg },
        base: { nb: v.nb | 0, db: v.db, bg: v.bg, ab: +v.ab, ep: +v.ep, tp: +v.tp, fyp: +v.fyp, stiff: on('stiff'), ts: +v.ts, hs: +v.hs, sst: +v.sst, weld: v.bweld, sb: +v.sb },
        fat: { on: on('fon'), IF: +v.IF, phi: +v.phiF, PNW: +v.PNW, Vm: +v.Vm, tg: on('tg'), PTG: +v.PTG, xTG: val('xTG'), LTG: +v.LTG, dsh: +v.dsh, ga: on('ga'), PG: +v.PG, cB: v.cB, cS: v.cS, cR: v.cR, cA: v.cA },
        sls: { limH: +v.limH || 100, limV: +v.limV || 150 }
      };
    }
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
    if (S.elem !== 'pilecap') {
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
      S.res = S.elem === 'gantry' ? GA.designGantry(x, lang()) : S.elem === 'beam' ? RC.designBeam(S.code, x, lang()) : S.elem === 'column' ? RC.designColumn(S.code, x, lang()) : RC.designPileCap(S.code, x, lang());
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
    $('#sketch').innerHTML = S.elem === 'gantry' ? gantrySketch(r) : S.elem === 'pilecap' ? capSketch(r) : sectionSketch(r);
    $('#charts').innerHTML = S.elem === 'gantry' ? v3Card(r) + `<div class="card"><h2 class="card-h">${T('Connection details and fatigue', 'รายละเอียดรอยต่อและความล้า')}</h2>${gantryDetails(r)}</div>` : S.elem === 'column' ? columnCharts(r) : S.elem === 'pilecap' ? capElevation(r) : '';
  }
  function summaryKV(r) {
    const kv = (k, v, u) => { const [a, uu] = outVal(v, u); return `<div><dt>${fmLabel(k)}</dt><dd class="mono">${f(a, 2)} <span class="u">${esc(uu)}</span></dd></div>`; };
    if (S.elem === 'gantry') {
      const mx = fn => Math.max(...r.acts.map(c => fn(c.a)));
      return kv(T('N* at base', 'N* ที่โคนเสา'), mx(a => a.base.N) / 1e3, 'kN') + kv(T('M* at base (resultant)', 'M* ที่โคนเสา (ผลลัพธ์)'), mx(a => Math.hypot(a.base.Mop, a.base.Mip)) / 1e6, 'kNm')
        + kv(T('T* in column', 'T* ในเสา'), mx(a => a.base.T) / 1e6, 'kNm') + kv(T('M* at arm root', 'M* ที่โคนคาน'), mx(a => Math.hypot(a.root.Mv, a.root.Mh)) / 1e6, 'kNm')
        + kv(T('Tip deflection (SLS wind)', 'การโก่งปลายคาน (ลม SLS)'), r.sls.dH, 'mm') + kv(T('Natural frequency', 'ความถี่ธรรมชาติ'), Math.min(r.sls.fy, r.sls.fz), 'Hz');
    }
    if (S.elem === 'beam') return kv(T('d (effective depth)', 'd (ความลึกประสิทธิผล)'), r.d, 'mm') + kv('A_s,total', r.S.As, 'mm²') + (r.flex.x.st ? kv(T('x (NA depth)', 'x (แกนสะเทิน)'), r.flex.x.st.c, 'mm') : '') + kv(T('M_Rd major', 'กำลังโมเมนต์แกนหลัก'), r.flex.x.Rd / 1e6, 'kNm') + kv(T('V_Rd major', 'กำลังเฉือนแกนหลัก'), r.shear.y.VRd / 1e3, 'kN') + (r.sls && r.sls.wk !== undefined ? kv('w_k', r.sls.wk, 'mm') : '');
    if (S.elem === 'column') return kv('A_s', r.S.As, 'mm²') + `<div><dt>ρ</dt><dd class="mono">${f(r.S.As / r.S.Ag * 100, 2)} %</dd></div>` + kv(T('N_Rd,max', 'กำลังรับแรงอัดสูงสุด'), r.Nmax / 1e3, 'kN') + kv('M_x,Ed', r.Mx / 1e6, 'kNm') + kv('M_y,Ed', r.My / 1e6, 'kNm');
    return kv(T('Cap L_x', 'ความยาว L_x'), r.Lx, 'mm') + kv(T('Cap L_y', 'ความกว้าง L_y'), r.Ly, 'mm') + kv(T('Cap weight', 'น้ำหนักฐานราก'), r.W, 'kN') + kv('P_max (ULS)', Math.max(...r.Pu), 'kN') + kv('P_max (SLS)', Math.max(...r.Ps), 'kN') + (r.input.geo.method === 'stm' ? kv('z', r.z, 'mm') : '');
  }

  // ------------------------------------------------------------------ sketches
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
  function capSketch(r) {
    const W = 340, H = 320, pad = 34, k = Math.min((W - 2 * pad) / r.Lx, (H - 2 * pad) / r.Ly);
    const cxm = (r.X0 + r.X1) / 2, cym = (r.Y0 + r.Y1) / 2, X = x => W / 2 + (x - cxm) * k, Y = y => H / 2 - (y - cym) * k;
    const g = r.input.geo, stm = g.method === 'stm';
    let s = `<svg viewBox="0 0 ${W} ${H}" class="sec-svg" role="img" aria-label="${T('Pile cap plan', 'ผังฐานราก')}">`;
    s += `<rect x="${X(r.X0)}" y="${Y(r.Y1)}" width="${r.Lx * k}" height="${r.Ly * k}" class="s-conc"/>`;
    const nbx = Math.min(r.nbx, 14), nby = Math.min(r.nby, 14);
    for (let i = 0; i < nbx; i++) { const y = r.Y0 + g.cs + (r.Ly - 2 * g.cs) * i / Math.max(1, nbx - 1); s += `<line x1="${X(r.X0 + g.cs)}" x2="${X(r.X1 - g.cs)}" y1="${Y(y)}" y2="${Y(y)}" class="s-mesh"/>`; }
    for (let i = 0; i < nby; i++) { const x = r.X0 + g.cs + (r.Lx - 2 * g.cs) * i / Math.max(1, nby - 1); s += `<line y1="${Y(r.Y0 + g.cs)}" y2="${Y(r.Y1 - g.cs)}" x1="${X(x)}" x2="${X(x)}" class="s-mesh"/>`; }
    const d = (r.dx + r.dy) / 2;
    s += `<rect x="${X(-g.cx / 2 - d / 2)}" y="${Y(g.cy / 2 + d / 2)}" width="${(g.cx + d) * k}" height="${(g.cy + d) * k}" rx="${S.code === 'EC2' ? d / 2 * k : 0}" class="s-perim"/>`;
    if (stm && g.layout === '3') { const P = r.piles; s += `<path d="M${X(P[0].x)} ${Y(P[0].y)} L${X(P[1].x)} ${Y(P[1].y)} L${X(P[2].x)} ${Y(P[2].y)} Z" class="s-tri"/>`; }
    if (stm) r.piles.forEach(p => { const nx = Math.sign(p.x) * g.cx / 4, ny = Math.sign(p.y) * g.cy / 4; s += `<line x1="${X(nx)}" y1="${Y(ny)}" x2="${X(p.x)}" y2="${Y(p.y)}" class="s-strut"/>`; });
    const Pmax = Math.max(...r.Pu);
    r.piles.forEach((p, i) => {
      const crit = r.worstPile && r.worstPile.p.id === p.id;
      s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${g.Dp / 2 * k}" class="s-pile ${r.Pu[i] === Pmax ? 'hot' : ''}"/>`;
      if (crit) { const a = g.Dp / 2 + d / 2, x0 = Math.max(p.x - a, r.X0), x1 = Math.min(p.x + a, r.X1), y0 = Math.max(p.y - a, r.Y0), y1 = Math.min(p.y + a, r.Y1); s += `<rect x="${X(x0)}" y="${Y(y1)}" width="${(x1 - x0) * k}" height="${(y1 - y0) * k}" class="s-perim thin"/>`; }
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
    let s = `<svg viewBox="0 0 ${W} ${W}" class="det-svg" role="img" aria-label="${T('Base plate plan', 'ผังแผ่นฐาน')}"><rect x="${U(-P / 2)}" y="${V(P / 2)}" width="${P * k}" height="${P * k}" class="g-plate2"/>`;
    b.stiff.forEach(st => { s += `<line x1="${U(st.u)}" y1="${V(st.v)}" x2="${U(st.u + st.nu * b.Ls)}" y2="${V(st.v + st.nv * b.Ls)}" class="g-stiff" style="stroke-width:${Math.max(2, x.ts * k)}"/>`; });
    s += col.shape === 'CHS' ? `<circle cx="${c}" cy="${c}" r="${col.D / 2 * k}" class="g-tube"/>` : `<rect x="${U(-col.B / 2)}" y="${V(col.D / 2)}" width="${col.B * k}" height="${col.D * k}" rx="${col.ro * k}" class="g-tube"/>`;
    b.bolts.pts.forEach(q => { s += `<circle cx="${U(q.u)}" cy="${V(q.v)}" r="${Math.max(3, (+x.db.slice(1)) / 2 * k)}" class="g-bolt"/>`; });
    s += `<text x="${c}" y="${W - 6}" text-anchor="middle" class="s-lbl">${f(P, 0)} × ${f(P, 0)} × ${x.tp} · ${x.nb}×${x.db} ${x.bg}</text><text x="${W - 8}" y="14" text-anchor="end" class="s-lbl">↑ ${T('wind axis', 'แกนลม')}</text></svg>`;
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
    return `<div class="gx"><figure class="det"><figcaption>${T('Base plate plan', 'ผังแผ่นฐาน')}</figcaption>${s}</figure><figure class="det"><figcaption>${T('Base plate elevation', 'รูปตัดแผ่นฐาน')}</figcaption>${el}</figure><figure class="det"><figcaption>${cn.type === 'bolt' ? T('Stub and bolted end plates', 'ท่อสั้นและแผ่นปลายยึดสลัก') : T('Arm welded to column', 'คานเชื่อมเข้ากับเสา')}</figcaption>${cst}</figure></div>${ft}`;
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
  window.addEventListener('resize', () => { if (viewer && $('#v3c')) viewer.draw(); });

  // ------------------------------------------------------------------ REPORT
  function fm(s) { return esc(s).replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>').replace(/_\{([^}]*)\}/g, '<sub>$1</sub>').replace(/_([A-Za-z0-9,.'\-]+)/g, '<sub>$1</sub>'); }
  function inputTable() {
    const v = inp(), sch = SCHEMA[S.elem].filter(fd => (!fd.codes || fd.codes.includes(S.code)) && (!fd.when || fd.when(v)));
    let rows = sch.map(fd => { const [u] = unitOf(fd.u); let val = v[fd.k]; if (fd.type === 'dia') val = RC.barName(S.code, val); if (fd.type === 'sel') { const o = (typeof fd.opts === 'function' ? fd.opts(v) : fd.opts).find(o => o[0] === val); val = o ? T(o[1], o[2]) : val; } return `<tr><td>${fmLabel(fieldLabel(fd))}</td><td class="num mono">${esc(val)}</td><td>${u}</td></tr>`; }).join('');
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
    const drawing = S.elem === 'gantry' ? gantrySketch(r) : S.elem === 'pilecap' ? capSketch(r) : sectionSketch(r);
    let charts = S.elem === 'column' ? columnChartsInner(r) : S.elem === 'gantry' ? gantryDetails(r) : '';
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
      const name = (S.meta.ref || S.elem).replace(/[^\w\-]+/g, '_') + '_' + S.elem + '_' + S.code + '_' + today() + '.pdf';
      if (dl) await dl.save({ filename: name, data: blob }); else pdf.save(name);
      toast(T('PDF saved', 'บันทึก PDF แล้ว'), 'ok');
    } catch (e) {
      if (e && e.code === 'declined') toast(T('Download cancelled', 'ยกเลิกการดาวน์โหลด'));
      else toast(T('Could not create the PDF. Try again.', 'สร้าง PDF ไม่สำเร็จ ลองอีกครั้ง'), 'bad');
    } finally { if (host) host.remove(); btn.disabled = false; btn.textContent = T('Export PDF', 'ส่งออก PDF'); }
  }

  // ------------------------------------------------------------------ ADMIN
  const A = { tab: 'users', accounts: [], members: [], payments: [], q: '', filter: 'all', edit: null, unsub: [], confirm: null, resetAsk: false };
  const METHODS = [['card', 'Credit / debit card', 'บัตรเครดิต / เดบิต'], ['paypal', 'PayPal', 'PayPal'], ['bank', 'Bank transfer', 'โอนธนาคาร'], ['promptpay', 'PromptPay', 'พร้อมเพย์'], ['cash', 'Cash', 'เงินสด'], ['other', 'Other', 'อื่น ๆ']];
  const PSTAT = { paid: ['Paid', 'ชำระแล้ว', 'ok'], pending: ['Pending', 'รอตรวจสอบ', 'warn'], refunded: ['Refunded', 'คืนเงิน', 'bad'] };
  function adminSubscribe() {
    if (CLOUD) { if (!A.loaded) { A.loaded = true; Ops.refresh().catch(x => { A.loaded = false; toast(opErr(x), 'bad'); }); } return; }
    if (A.unsub.length) return;
    ['accounts', 'members', 'payments'].forEach(c => A.unsub.push(Store.watch(c, rows => { A[c] = rows; if (S.view === 'admin') adminBody(); })));
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
      <div id="adminBody"></div></main>`;
  }
  function adminBody() {
    const el = $('#adminBody'); if (!el) return;
    const t = today(), acc = A.accounts, pro = acc.filter(a => a.plan === 'pro' && a.status === 'active' && a.expiry >= t);
    const soon = pro.filter(a => a.expiry <= addDays(t, 14)), mon = t.slice(0, 7);
    const rev = A.payments.filter(p => p.status === 'paid' && (p.date || '').slice(0, 7) === mon).reduce((s, p) => s + (+p.amount || 0), 0);
    const pend = A.payments.filter(p => p.status === 'pending').length;
    const mem = id => A.members.find(m => m._id === id) || {};
    const stat = a => a.status !== 'active' ? ['bad', T('Suspended', 'ระงับ'), 'suspended'] : a.plan !== 'pro' ? ['', 'Free', 'free'] : a.expiry < t ? ['bad', T('Expired', 'หมดอายุ'), 'expired'] : a.expiry <= addDays(t, 14) ? ['warn', T('Expiring soon', 'ใกล้หมดอายุ'), 'soon'] : ['ok', T('Active', 'ใช้งาน'), 'active'];
    const q = A.q.toLowerCase();
    const list = acc.filter(a => (!q || [a.username, a.name, mem(a._id).email].join(' ').toLowerCase().includes(q)) && (A.filter === 'all' || stat(a)[2] === A.filter)).sort((a, b) => (a.expiry || '9').localeCompare(b.expiry || '9'));
    const daysLeft = a => a.plan === 'pro' && a.expiry ? Math.ceil((new Date(a.expiry) - new Date(t)) / 864e5) : null;
    const filters = [['all', T('All', 'ทั้งหมด')], ['active', T('Active', 'ใช้งาน')], ['soon', T('Expiring soon', 'ใกล้หมดอายุ')], ['expired', T('Expired', 'หมดอายุ')], ['suspended', T('Suspended', 'ระงับ')], ['free', 'Free']];
    el.innerHTML = `<div class="stats">
        <div class="stat"><span>${T('Users', 'ผู้ใช้ทั้งหมด')}</span><b>${acc.length}</b></div><div class="stat"><span>${T('Active Pro', 'Pro ที่ใช้งานอยู่')}</span><b>${pro.length}</b></div>
        <div class="stat ${soon.length ? 'warn' : ''}"><span>${T('Expiring in 14 days', 'หมดอายุใน 14 วัน')}</span><b>${soon.length}</b></div><div class="stat"><span>${T('Paid this month', 'รายรับเดือนนี้')}${pend ? ' · ' + pend + T(' pending', ' รอตรวจ') : ''}</span><b>$${f(rev, 2)}</b></div></div>
      <div class="tabs" role="tablist"><button role="tab" aria-selected="${A.tab === 'users'}" data-act="tab" data-t="users">${T('Users', 'ผู้ใช้งาน')}</button><button role="tab" aria-selected="${A.tab === 'pay'}" data-act="tab" data-t="pay">${T('Payments', 'การชำระเงิน')}</button></div>
      ${A.tab === 'users' ? `<div class="card"><div class="tbl-tools"><input id="adm-q" placeholder="${T('Search username, name or email', 'ค้นหาชื่อผู้ใช้ ชื่อ หรืออีเมล')}" value="${esc(A.q)}" aria-label="${T('Search', 'ค้นหา')}"><div class="seg">${filters.map(([k, l]) => `<button data-act="filter" data-f="${k}" aria-pressed="${A.filter === k}">${l}</button>`).join('')}</div></div>
        ${acc.length ? (list.length ? `<div class="tbl-wrap"><table class="chk adm"><thead><tr><th>${T('User', 'ผู้ใช้')}</th><th>${T('Plan', 'แพ็กเกจ')}</th><th>${T('Start', 'เริ่ม')}</th><th>${T('Expiry', 'หมดอายุ')}</th><th>${T('Status', 'สถานะ')}</th><th></th></tr></thead><tbody>
        ${list.map(a => { const [c, l] = stat(a), dl = daysLeft(a); return `<tr><td><b>${esc(a.username)}</b><br><span class="muted small">${esc(a.name || '')}${mem(a._id).email ? ' · ' + esc(mem(a._id).email) : ''}</span></td><td>${a.plan === 'pro' ? '<span class="pill pro">Pro</span>' : '<span class="pill free">Free</span>'}</td><td class="mono">${esc(a.start || '')}</td><td class="mono">${esc(a.expiry || '—')}${dl !== null ? `<br><span class="muted small">${dl >= 0 ? T(dl + ' days left', 'เหลือ ' + dl + ' วัน') : T(-dl + ' days ago', 'เกินมา ' + -dl + ' วัน')}</span>` : ''}</td><td><span class="pill st-${c}">${l}</span></td>
          <td class="act"><button class="btn btn-ghost xs" data-act="ext" data-u="${esc(a._id)}" data-d="30">+30 ${T('d', 'วัน')}</button><button class="btn btn-ghost xs" data-act="ext" data-u="${esc(a._id)}" data-d="365">+1 ${T('yr', 'ปี')}</button><button class="btn btn-ghost xs" data-act="editUser" data-u="${esc(a._id)}">${T('Edit', 'แก้ไข')}</button></td></tr>`; }).join('')}
        </tbody></table></div>` : `<p class="muted pad">${T('No users match this search.', 'ไม่พบผู้ใช้ตามเงื่อนไข')}</p>`)
          : `<div class="empty"><b>${T('No users yet', 'ยังไม่มีผู้ใช้')}</b><p>${T('Create the first account with “New user”: set the password, plan and expiry date in one step.', 'สร้างบัญชีแรกด้วยปุ่ม “สร้างผู้ใช้” กำหนดรหัสผ่าน แพ็กเกจ และวันหมดอายุได้ทันที')}</p><button class="btn btn-hot sm" data-act="newUser">+ ${T('New user', 'สร้างผู้ใช้')}</button></div>`}</div>`
        : `<div class="card">${A.payments.length ? `<div class="tbl-wrap"><table class="chk adm"><thead><tr><th>${T('Date', 'วันที่')}</th><th>${T('User', 'ผู้ใช้')}</th><th class="num">${T('Amount', 'จำนวนเงิน')}</th><th>${T('Method', 'ช่องทาง')}</th><th>${T('Reference', 'อ้างอิง')}</th><th>${T('Period', 'ระยะเวลา')}</th><th>${T('Status', 'สถานะ')}</th><th></th></tr></thead><tbody>
        ${A.payments.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(p => { const m = METHODS.find(x => x[0] === p.method), st = PSTAT[p.status] || [p.status, p.status, '']; return `<tr><td class="mono">${esc(p.date)}</td><td>${esc(p.username)}</td><td class="num mono">$${f(+p.amount, 2)}</td><td>${m ? T(m[1], m[2]) : esc(p.method)}</td><td class="mono small">${esc(p.ref || '')}</td><td>${p.days ? p.days + ' ' + T('days', 'วัน') : '—'}</td><td><span class="pill st-${st[2]}">${T(st[0], st[1])}</span></td>
          <td class="act"><button class="btn btn-ghost xs" data-act="editPay" data-p="${esc(p._id)}">${T('Edit', 'แก้ไข')}</button></td></tr>`; }).join('')}</tbody></table></div>`
          : `<div class="empty"><b>${T('No payments yet', 'ยังไม่มีรายการชำระเงิน')}</b><p>${T('Record a payment and extend the user’s Pro period in the same step.', 'บันทึกการชำระเงินพร้อมต่ออายุแพ็กเกจ Pro ให้ผู้ใช้ได้ในขั้นตอนเดียว')}</p><button class="btn btn-hot sm" data-act="newPay">+ ${T('Record payment', 'บันทึกการชำระเงิน')}</button></div>`}</div>`}
      <div id="modal"></div>`;
    if (A.edit) renderModal();
  }
  function renderModal() {
    const el = $('#modal'); if (!el) return;
    const e = A.edit;
    if (!e) { el.innerHTML = ''; return; }
    if (e.kind === 'user') {
      const a = e.data;
      el.innerHTML = `<div class="modal-bg"><form class="modal" id="userForm" novalidate><h2>${e.isNew ? T('New user', 'สร้างผู้ใช้ใหม่') : T('Edit user ', 'แก้ไขผู้ใช้ ') + esc(a.username)}</h2>
        <div class="mgrid">
          <label>${T('Username', 'ชื่อผู้ใช้')}<input id="u-username" value="${esc(a.username)}" ${e.isNew ? '' : 'disabled'} required autocomplete="off"></label>
          <label>${T('Full name', 'ชื่อ-นามสกุล')}<input id="u-name" value="${esc(a.name)}"></label>
          <label>${T('Email', 'อีเมล')}<input id="u-email" type="email" value="${esc(a.email)}"></label>
          <label>${T('Phone', 'โทรศัพท์')}<input id="u-phone" value="${esc(a.phone)}"></label>
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
          <label>${T('Amount (USD)', 'จำนวนเงิน (USD)')}<input id="p-amount" type="number" step="0.01" min="0" value="${esc(p.amount)}"></label>
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
    A.edit = { kind: 'user', isNew: !a, data: a ? { username: a.username, name: a.name, plan: a.plan, status: a.status, start: a.start, expiry: a.expiry, email: m.email, phone: m.phone, note: m.note } : { username: '', name: '', plan: 'pro', status: 'active', start: today(), expiry: addDays(today(), 365), email: '', phone: '', note: '' } };
    renderModal();
  }
  function openPay(id) {
    if (!A.accounts.length) { toast(T('Create a user before recording a payment.', 'สร้างผู้ใช้ก่อนบันทึกการชำระเงิน'), 'bad'); return; }
    const p = id ? A.payments.find(x => x._id === id) : null; A.confirm = null;
    A.edit = { kind: 'pay', isNew: !p, id, data: p ? Object.assign({}, p) : { username: A.accounts[0]._id, date: today(), amount: 1.99, method: 'card', ref: '', days: 30, status: 'paid' } };
    renderModal();
  }
  async function saveUser() {
    const e = A.edit, v = id => $('#' + id).value.trim(), err = $('#u-err'), fail = m => { err.textContent = m; err.hidden = false; };
    const username = e.isNew ? v('u-username') : e.data.username;
    if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username)) return fail(T('Username: 3–32 letters, digits, _ . or -.', 'ชื่อผู้ใช้: ตัวอักษรอังกฤษ ตัวเลข _ . - ยาว 3–32 ตัว'));
    if (username.toLowerCase() === ADMIN.user.toLowerCase()) return fail(T('That username is reserved for the administrator.', 'ชื่อนี้สงวนไว้สำหรับผู้ดูแลระบบ'));
    if (e.isNew && A.accounts.some(a => a._id.toLowerCase() === username.toLowerCase())) return fail(T('That username is already taken.', 'มีชื่อผู้ใช้นี้แล้ว'));
    const pass = $('#u-pass').value;
    if (e.isNew && pass.length < 8) return fail(T('The password must be at least 8 characters.', 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร'));
    if (!e.isNew && pass && pass.length < 8) return fail(T('The new password must be at least 8 characters.', 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร'));
    const email = v('u-email');
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(T('Enter a valid email address, or leave it blank.', 'กรอกอีเมลให้ถูกต้อง หรือเว้นว่าง'));
    const plan = v('u-plan'), expiry = v('u-expiry'), start = v('u-start');
    if (plan === 'pro' && !expiry) return fail(T('Set an expiry date for a Pro plan.', 'กำหนดวันหมดอายุสำหรับแพ็กเกจ Pro'));
    if (start && expiry && expiry < start) return fail(T('The expiry date is before the start date.', 'วันหมดอายุอยู่ก่อนวันเริ่ม'));
    const btn = $('#u-save'); btn.disabled = true; btn.textContent = T('Saving…', 'กำลังบันทึก…');
    try {
      await Ops.saveUser(e.isNew, { username, name: v('u-name'), plan, status: v('u-status'), start, expiry }, { email, phone: v('u-phone'), note: v('u-note') }, pass);
      A.edit = null; renderModal(); toast(e.isNew ? T('User ' + username + ' created', 'สร้างผู้ใช้ ' + username + ' แล้ว') : T('Changes saved', 'บันทึกการเปลี่ยนแปลงแล้ว'), 'ok');
      if (pass) toast(T('Send the password to the user through a secure channel.', 'ส่งรหัสผ่านให้ผู้ใช้ผ่านช่องทางที่ปลอดภัย'));
    } catch (x) { btn.disabled = false; btn.textContent = T('Save', 'บันทึก'); fail(opErr(x)); }
  }
  async function savePay() {
    const e = A.edit, v = id => $('#' + id).value.trim(), err = $('#p-err'), fail = m => { err.textContent = m; err.hidden = false; };
    const amount = parseFloat(v('p-amount'));
    if (!(amount >= 0)) return fail(T('Enter the amount paid.', 'ระบุจำนวนเงิน'));
    const data = { username: v('p-user'), date: v('p-date') || today(), amount, method: v('p-method'), ref: v('p-ref'), days: parseInt(v('p-days')) || 0, status: v('p-status'), created: e.data.created || new Date().toISOString() };
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
    if (e.kind === 'user') ['username', 'name', 'email', 'phone', 'plan', 'status', 'start', 'expiry', 'note'].forEach(k => { const v = g('u-' + k); if (v !== undefined) e.data[k] = v; });
    else ['username', 'date', 'amount', 'method', 'ref', 'days', 'status'].forEach(k => { const v = g(k === 'username' ? 'p-user' : 'p-' + k); if (v !== undefined) e.data[k] = v; });
  }

  // ------------------------------------------------------------------ render + events
  function render() {
    const root = $('#app');
    document.body.dataset.view = S.view;
    document.documentElement.lang = S.ui;
    if (S.view === 'adminLogin' && S.role === 'admin') S.view = 'admin';
    if (S.view === 'codes' || S.view === 'elems') S.view = 'home';
    if (S.view === 'landing') root.innerHTML = viewLanding();
    else if (S.view === 'login') root.innerHTML = viewLogin(false) + siteFoot();
    else if (S.view === 'adminLogin') root.innerHTML = viewLogin(true) + siteFoot();
    else if (S.view === 'home') root.innerHTML = viewHome() + siteFoot();
    else if (S.view === 'design') { root.innerHTML = viewDesign() + siteFoot(); compute(); }
    else if (S.view === 'admin') { root.innerHTML = viewAdmin() + siteFoot(); if (S.role === 'admin') { adminSubscribe(); adminBody(); } }
  }

  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'lang') { if (A.edit) syncModalDraft(); const wasReport = S.reportOpen; setLang(b.dataset.l); if (wasReport && S.view === 'design') { S.reportOpen = true; renderReport(); } }
    else if (a === 'nav') { const v = b.dataset.v; if ((v === 'home' || v === 'codes') && S.role === 'guest') { S.role = 'free'; saveSession(); } go(v); }
    else if (a === 'scroll') { const t = document.getElementById(b.dataset.t); if (t) t.scrollIntoView({ behavior: 'smooth' }); }
    else if (a === 'free') { if (S.role === 'guest') { S.role = 'free'; saveSession(); } go('home'); }
    else if (a === 'logout') logout();
    else if (a === 'code') { S.codeSel = b.dataset.c; S.code = b.dataset.c; S.codePop = true; render(); const p = $('.elem-pop .pick'); if (p) p.focus(); }
    else if (a === 'elem') { const e = b.dataset.e; if (!ELEMS[e].free && !isPro()) { toast(T('This designer is part of Pro. Sign in with a Pro account to use it.', 'ฟังก์ชันนี้สำหรับสมาชิก Pro กรุณาเข้าสู่ระบบด้วยบัญชี Pro'), 'bad'); return; } go('design', { elem: e, code: S.codeSel || S.code }); }
    else if (a === 'reset') { delete S.inputs[S.elem + ':' + S.code]; $('#dzIn').innerHTML = inputsHTML(); compute(); }
    else if (a === 'rowadd') { const v = inp(), k = b.dataset.row; v[k].push({ n: 2, d: v[k][v[k].length - 1].d }); $('#dzIn').innerHTML = inputsHTML(); schedule(); }
    else if (a === 'rowdel') { const v = inp(), k = b.dataset.row; v[k].splice(+b.dataset.i, 1); $('#dzIn').innerHTML = inputsHTML(); schedule(); }
    else if (a === 'report') { if (!isPro()) { toast(T('The full calculation report and PDF export are Pro features.', 'รายการคำนวณฉบับเต็มและ PDF สำหรับสมาชิก Pro'), 'bad'); return; } S.reportOpen = true; renderReport(); $('#reportWrap').scrollIntoView({ behavior: 'smooth' }); }
    else if (a === 'closeReport') { S.reportOpen = false; $('#reportWrap').innerHTML = ''; }
    else if (a === 'pdf') exportPdf();
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
    else if (a === 'promo') { const on = !S.promo; Ops.setPromo(on).then(() => { render(); toast(on ? T('Pro is now free for all users', 'เปิด Pro ฟรีให้ผู้ใช้ทุกคนแล้ว') : T('Pro is back to paid accounts only', 'กลับเป็น Pro เฉพาะบัญชีที่ชำระเงิน'), 'ok'); }).catch(x => toast(opErr(x), 'bad')); }
    else if (a === 'closePop') { if (ev.target === b || b.tagName === 'BUTTON') { S.codePop = false; render(); } }
    else if (a === 'resetAsk' || a === 'resetNo') { A.resetAsk = a === 'resetAsk'; render(); }
    else if (a === 'resetYes') { A.resetAsk = false; Ops.reset().then(() => { render(); toast(CLOUD ? T('All users and payments deleted', 'ลบผู้ใช้และรายการชำระเงินทั้งหมดแล้ว') : T('Test data cleared', 'ล้างข้อมูลทดสอบแล้ว'), 'ok'); }).catch(x => toast(opErr(x), 'bad')); }
  });
  document.addEventListener('input', ev => {
    const t = ev.target;
    if (t.dataset.k && S.view === 'design') {
      const v = inp(), fd = SCHEMA[S.elem].find(x => x.k === t.dataset.k);
      v[t.dataset.k] = t.value;
      if (fd && typeof fd.re === 'string') v[fd.re] = SEC_DEF[t.value];
      if (t.dataset.k === 'layout' || t.dataset.k === 'method' || (fd && fd.re)) { const sc = $('#dzIn').scrollTop; $('#dzIn').innerHTML = inputsHTML(); $('#dzIn').scrollTop = sc; }
      schedule();
    }
    else if (t.dataset.row) { inp()[t.dataset.row][+t.dataset.i][t.dataset.f] = +t.value; schedule(); }
    else if (t.id === 'v3case' || t.id === 'v3mode') { if (t.id === 'v3case') S.v3.cs = t.value; else S.v3.mode = t.value; const md = $('#v3mode'); if (md) md.disabled = S.v3.cs === 'none'; if (S.res) mount3D(S.res); }
    else if (t.dataset.meta) { S.meta[t.dataset.meta] = t.value; const o = $('#rv-' + t.dataset.meta); if (o) o.textContent = t.value; }
    else if (t.id === 'adm-q') { A.q = t.value; const pos = t.selectionStart; adminBody(); const n = $('#adm-q'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
  });
  document.addEventListener('submit', ev => {
    ev.preventDefault();
    const fm = ev.target;
    if (fm.id === 'loginForm') doLogin(fm);
    else if (fm.id === 'userForm') saveUser();
    else if (fm.id === 'payForm') savePay();
  });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && A.edit) { A.edit = null; renderModal(); } else if (ev.key === 'Escape' && S.codePop) { S.codePop = false; render(); } });

  if (S.role !== 'guest') S.view = S.role === 'admin' ? 'admin' : 'home';
  render();
})();
