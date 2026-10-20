"""Convert a calculation workbook (.xlsx) into the JSON model used by xlsheet.js:
cells (formulas and constants with cached values), styles, column widths, row heights, merges, drop-down lists,
conditional formats and the XY-scatter "drawing" charts (series ranges, line styles, series-name labels, anchors).

    python3 -I extract.py workbook.xlsx model.json [expected-values.json.gz]

Input cells are the constant cells with the input fill colour (FFF2CC by default)."""
import sys, json, re, zipfile, posixpath
import xml.etree.ElementTree as ET
import openpyxl
from openpyxl.utils import get_column_letter, column_index_from_string

src, dst = sys.argv[1], sys.argv[2]
INPUT_FILL = 'FFFFF2CC'
wb = openpyxl.load_workbook(src)
wv = openpyxl.load_workbook(src, data_only=True)
NS = {'c': 'http://schemas.openxmlformats.org/drawingml/2006/chart', 'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      'xdr': 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing', 'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
REL = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'

styles, skey = [], {}
def rgb(col):
    try:
        v = col.rgb if col is not None else None
        return v[-6:] if isinstance(v, str) and len(v) >= 6 else None
    except Exception:
        return None
def style_of(c):
    f, a, b = c.font, c.alignment, c.border
    st = {}
    if f.b: st['b'] = 1
    if f.i: st['i'] = 1
    if f.u: st['u'] = 1
    if f.sz and f.sz != 10: st['sz'] = f.sz
    fc = rgb(f.color)
    if fc and fc != '000000': st['c'] = fc
    if c.fill and c.fill.fill_type == 'solid':
        fg = rgb(c.fill.fgColor)
        if fg and fg != 'FFFFFF': st['bg'] = fg
    if a.horizontal: st['h'] = a.horizontal
    if a.vertical: st['va'] = a.vertical
    if a.wrap_text: st['wrap'] = 1
    if a.indent: st['ind'] = a.indent
    if c.number_format and c.number_format != 'General': st['nf'] = c.number_format
    bd = {}
    for side in ('left', 'right', 'top', 'bottom'):
        s = getattr(b, side)
        if s is not None and s.style: bd[side[0]] = [s.style, rgb(s.color) or '000000']
    if bd: st['bd'] = bd
    k = json.dumps(st, sort_keys=True)
    if k not in skey: skey[k] = len(styles); styles.append(st)
    return skey[k]

def jval(v):
    if v is None: return None
    if isinstance(v, bool): return v
    if isinstance(v, (int, float)): return v
    if hasattr(v, 'isoformat'): return v.isoformat()
    return str(v)

z = zipfile.ZipFile(src)
def read_rels(path):
    rp = posixpath.join(posixpath.dirname(path), '_rels', posixpath.basename(path) + '.rels')
    if rp not in z.namelist(): return {}
    t = ET.fromstring(z.read(rp)); out = {}
    for r in t:
        out[r.get('Id')] = posixpath.normpath(posixpath.join(posixpath.dirname(path), r.get('Target')))
    return out
# workbook sheet name -> xml part
wbx = ET.fromstring(z.read('xl/workbook.xml')); wrels = read_rels('xl/workbook.xml')
part = {s.get('name'): wrels[s.get(REL)] for s in wbx.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheets')}

def ftext(el):
    return el.text if el is not None else None
def chart_model(cpath):
    t = ET.fromstring(z.read(cpath)); ch = {'series': []}
    sp = t.find('c:spPr', NS)  # chart area: fill and border
    if sp is not None:
        f = sp.find('a:solidFill/a:srgbClr', NS); ln = sp.find('a:ln', NS)
        if f is not None: ch['bg'] = f.get('val')
        if ln is not None and ln.find('a:noFill', NS) is None:
            c = ln.find('a:solidFill/a:srgbClr', NS); ch['bd'] = [c.get('val') if c is not None else '878787', round(int(ln.get('w', '9525')) / 12700, 2)]
    axes = t.findall('.//c:valAx', NS)
    for ax in axes:
        pos = ax.find('c:axPos', NS).get('val'); sc = ax.find('c:scaling', NS)
        mn, mx = sc.find('c:min', NS), sc.find('c:max', NS)
        key = 'x' if pos in ('b', 't') else 'y'
        ch[key] = [float(mn.get('val')) if mn is not None else None, float(mx.get('val')) if mx is not None else None]
    for ser in t.findall('.//c:ser', NS):
        s = {}
        tx = ser.find('c:tx', NS)
        if tx is not None:
            sr = tx.find('c:strRef/c:f', NS)
            s['name'] = {'f': sr.text} if sr is not None else {'v': ftext(tx.find('c:v', NS))}
        s['x'] = ftext(ser.find('c:xVal/c:numRef/c:f', NS)) or ftext(ser.find('c:xVal/c:strRef/c:f', NS))
        s['y'] = ftext(ser.find('c:yVal/c:numRef/c:f', NS))
        ln = ser.find('c:spPr/a:ln', NS)
        if ln is not None and ln.find('a:noFill', NS) is None:
            col = ln.find('a:solidFill/a:srgbClr', NS)
            d = ln.find('a:prstDash', NS)
            s['ln'] = {'c': col.get('val') if col is not None else '000000', 'w': round(int(ln.get('w', '9525')) / 12700, 2)}
            if d is not None and d.get('val') != 'solid': s['ln']['d'] = d.get('val')
        mk = ser.find('c:marker/c:symbol', NS)
        if mk is not None and mk.get('val') != 'none':
            s['mk'] = mk.get('val'); sz = ser.find('c:marker/c:size', NS); s['mks'] = int(sz.get('val')) if sz is not None else 5
            mf = ser.find('c:marker/c:spPr/a:solidFill/a:srgbClr', NS); s['mkc'] = mf.get('val') if mf is not None else None
        dl = ser.find('c:dLbls', NS)
        if dl is not None and dl.find('c:showSerName', NS) is not None and dl.find('c:showSerName', NS).get('val') == '1':
            rp = dl.find('c:txPr/a:p/a:pPr/a:defRPr', NS)
            col = dl.find('c:txPr/a:p/a:pPr/a:defRPr/a:solidFill/a:srgbClr', NS)
            pos = dl.find('c:dLblPos', NS)
            s['lbl'] = {'pos': pos.get('val') if pos is not None else 'r', 'sz': int(rp.get('sz', '1000')) / 100 if rp is not None else 10,
                        'c': col.get('val') if col is not None else '000000', 'b': 1 if rp is not None and rp.get('b') == '1' else 0}
        ch['series'].append(s)
    return ch

sheets = []
for ws in wb.worksheets:
    vs = wv[ws.title]
    sh = {'name': ws.title, 'cells': {}, 'inputs': [], 'merges': [str(m) for m in ws.merged_cells.ranges], 'val': {}, 'cf': [], 'charts': []}
    # geometry
    dw = ws.sheet_format.defaultColWidth or 8.43
    maxc = ws.max_column
    sh['cols'] = [round((ws.column_dimensions[get_column_letter(i)].width if get_column_letter(i) in ws.column_dimensions and ws.column_dimensions[get_column_letter(i)].width else dw), 3) for i in range(1, maxc + 1)]
    sh['hidden'] = [get_column_letter(i) for i in range(1, maxc + 1) if get_column_letter(i) in ws.column_dimensions and ws.column_dimensions[get_column_letter(i)].hidden]
    sh['defRow'] = ws.sheet_format.defaultRowHeight or 15
    sh['rows'] = {r: d.height for r, d in ws.row_dimensions.items() if d.height}
    sh['hrows'] = [r for r, d in ws.row_dimensions.items() if d.hidden]
    pa = ws.print_area
    if pa:
        m = re.search(r'\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)', pa if isinstance(pa, str) else pa[0])
        sh['print'] = [column_index_from_string(m.group(1)), int(m.group(2)), column_index_from_string(m.group(3)), int(m.group(4))]
    sh['page'] = {'paper': ws.page_setup.paperSize, 'orient': ws.page_setup.orientation, 'fit': bool(ws.sheet_properties.pageSetUpPr and ws.sheet_properties.pageSetUpPr.fitToPage)}
    sh['brk'] = [b.id for b in ws.row_breaks.brk]
    for row in ws.iter_rows():
        for c in row:
            v = c.value
            s = style_of(c) if (v is not None or c.has_style) else 0
            if v is None:
                if s and (styles[s].get('bg') or styles[s].get('bd')): sh['cells'][c.coordinate] = {'s': s}
                continue
            cell = {'s': s} if s else {}
            if isinstance(v, str) and v.startswith('=') and len(v) > 1:
                cell['f'] = v[1:]; cell['v'] = jval(vs[c.coordinate].value)
            elif isinstance(v, str) and v == '=':
                cell['v'] = '='
            else:
                cell['v'] = jval(v)
                if styles[s].get('bg') == INPUT_FILL[2:]: sh['inputs'].append(c.coordinate)
            sh['cells'][c.coordinate] = cell
    for dv in ws.data_validations.dataValidation:
        if dv.type == 'list' and dv.formula1 and dv.formula1.startswith('"'):
            opts = dv.formula1.strip('"').split(',')
            for rng in str(dv.sqref).split():
                sh['val'][rng] = opts
    for rng in ws.conditional_formatting:
        for r in rng.rules:
            fc = rgb(r.dxf.font.color) if r.dxf and r.dxf.font and r.dxf.font.color else None
            sh['cf'].append({'sq': str(rng.sqref), 'type': r.type, 'op': r.operator, 'f': list(r.formula or []), 'c': fc})
    # charts through the drawing part
    sp = part[ws.title]; srels = read_rels(sp)
    for rid, tgt in srels.items():
        if '/drawings/' not in tgt: continue
        d = ET.fromstring(z.read(tgt)); drels = read_rels(tgt)
        for an in d.findall('xdr:twoCellAnchor', NS):
            fr, to = an.find('xdr:from', NS), an.find('xdr:to', NS)
            g = lambda e, k: int(e.find('xdr:' + k, NS).text)
            ce = an.find('.//c:chart', NS)
            if ce is None: continue
            cm = chart_model(drels[ce.get(REL)])
            cm['from'] = [g(fr, 'col'), g(fr, 'colOff'), g(fr, 'row'), g(fr, 'rowOff')]
            cm['to'] = [g(to, 'col'), g(to, 'colOff'), g(to, 'row'), g(to, 'rowOff')]
            sh['charts'].append(cm)
    sheets.append(sh)

model = {'src': src.split('/')[-1], 'styles': styles, 'sheets': sheets}
# the shipped model carries no cached results (the app recalculates); the cached values go to a separate file for the tests
expect = {}
for sh in sheets:
    e = expect[sh['name']] = {}
    for a, c in sh['cells'].items():
        if 'f' in c:
            e[a] = c.pop('v', None)
json.dump(model, open(dst, 'w'), separators=(',', ':'), ensure_ascii=False)
if len(sys.argv) > 3:
    import gzip
    with gzip.open(sys.argv[3], 'wt', encoding='utf-8') as fh: json.dump(expect, fh, separators=(',', ':'), ensure_ascii=False)
print('styles', len(styles), ' '.join(f"{s['name']}: {len(s['cells'])} cells, {len(s['inputs'])} inputs, {len(s['charts'])} charts" for s in sheets))
