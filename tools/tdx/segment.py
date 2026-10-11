"""Split a vectorised sheet (out/<page>.json, pixel space) into individual details.
   python3 segment.py <page> [--img]   ->  seg/<page>.json  {sheet, regions:[{id, bbox, title, n}], assign:[region id per entity]}"""
import sys, json, math, re, numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
import build

KEY = re.compile(r'^(SECTION|DETAIL|ELEVATION|PLAN|VIEW|TYPICAL|PART|END|SIDE|CROSS|LONGITUDINAL|NOTES?\b|ISOMETRIC|SCHEDULE|TABLE|OPTION|ALTERNATIVE|TYPE|ARRANGEMENT|PROFILE|BRACING|SETOUT|SET\s*OUT|LOCATION|LAYOUT)')

def ent_box(e):
    t = e['t']
    if t == 'line': xs, ys = [e['a'][0], e['b'][0]], [e['a'][1], e['b'][1]]
    elif t in ('circle', 'arc'): xs, ys = [e['c'][0] - e['r'], e['c'][0] + e['r']], [e['c'][1] - e['r'], e['c'][1] + e['r']]
    elif t == 'solid': xs, ys = [p[0] for p in e['p']], [p[1] for p in e['p']]
    elif t == 'dot': xs, ys = [e['c'][0]], [e['c'][1]]
    elif t == 'text':
        import ftext
        L = ftext.width(e['s']) * e['h'] / 10 * e['wf']
        if e['ang'] == 0: xs, ys = [e['x'], e['x'] + L], [e['y'] - e['h'], e['y']]
        else: xs, ys = [e['x'] - e['h'], e['x']], [e['y'] - L, e['y']]
    else: return None
    return min(xs), min(ys), max(xs), max(ys)

def sheet_no(F, page):
    T = [w for w in F.get('raw_words', [])]
    if page.startswith('r'):
        for w in T:
            m = re.search(r'PN\s*3?0?[-–]?\s*(\d{4}[A-Z]?)', w['s'])
            if m and w['y'] > 0.8 * F['H']: return 'PN30-' + m.group(1)
        return None
    best = None
    for w in T:
        m = re.search(r'1330[-–]?0*(\d{1,3})', w['s'])
        if m and w['x'] > 0.8 * F['W'] and w['y'] > 0.85 * F['H'] and (best is None or w['h'] > best[0]): best = (w['h'], '1330-%04d' % int(m.group(1)))
    if best: return best[1]
    return None

def drawing_area(F, page):
    H, W = F['H'], F['W']
    if page.startswith('m'):
        xs = []
        for e in F['ents']:
            if e['t'] != 'line': continue
            (ax, ay), (bx, by) = e['a'], e['b']
            if abs(ax - bx) < 8 and abs(ay - by) > 0.22 * H and 0.78 * W < ax < 0.92 * W: xs.append(min(ax, bx))
        x1 = (min(xs) - 10) if xs else 0.835 * W
        return (0.047 * W, 0.03 * H, x1, 0.975 * H)
    return (0, 0, W, H)

def segment(F, page, R=10):
    H, W = F['H'], F['W']
    ax0, ay0, ax1, ay1 = drawing_area(F, page)
    ents = F['ents']; boxes = [ent_box(e) for e in ents]
    excl = np.zeros(len(ents), bool)
    for i, (e, b) in enumerate(zip(ents, boxes)):
        if b is None: excl[i] = True; continue
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        if not (ax0 <= cx <= ax1 and ay0 <= cy <= ay1): excl[i] = True
        if e['t'] == 'line' and (b[2] - b[0] > 0.6 * (ax1 - ax0) or b[3] - b[1] > 0.6 * (ay1 - ay0)): excl[i] = True   # border
        if e['t'] == 'text' and re.match(r'^\s*PN\s*3', e['s']) and e['h'] > 50: excl[i] = True
    # coarse occupancy image
    s = 0.25
    occ = np.zeros((int(H * s) + 2, int(W * s) + 2), np.uint8)
    for i, b in enumerate(boxes):
        if excl[i]: continue
        e = ents[i]
        if e['t'] == 'line': cv2.line(occ, (int(e['a'][0] * s), int(e['a'][1] * s)), (int(e['b'][0] * s), int(e['b'][1] * s)), 1, 1)
        else: cv2.rectangle(occ, (int(b[0] * s), int(b[1] * s)), (int(b[2] * s), int(b[3] * s)), 1, -1 if e['t'] == 'text' else 1)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * R + 1, 2 * R + 1))
    dil = cv2.dilate(occ, k)
    n, lab = cv2.connectedComponents(dil, connectivity=8)
    assign = []
    for i, b in enumerate(boxes):
        if excl[i]: assign.append(-1); continue
        e = ents[i]
        px, py = ((e['a'][0] + e['b'][0]) / 2, (e['a'][1] + e['b'][1]) / 2) if e['t'] == 'line' else ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)
        assign.append(int(lab[min(lab.shape[0] - 1, int(py * s)), min(lab.shape[1] - 1, int(px * s))]))
    regs = {}
    for i, r in enumerate(assign):
        if r <= 0: continue
        b = boxes[i]; g = regs.setdefault(r, dict(id=r, bbox=[1e9, 1e9, -1e9, -1e9], n=0, ntext=0, texts=[]))
        g['bbox'] = [min(g['bbox'][0], b[0]), min(g['bbox'][1], b[1]), max(g['bbox'][2], b[2]), max(g['bbox'][3], b[3])]
        g['n'] += 1
        if ents[i]['t'] == 'text': g['ntext'] += 1; g['texts'].append(i)
    # page median text height
    th = [e['h'] for e in ents if e['t'] == 'text']
    hmed = float(np.median(th)) if th else 30
    def title_of(g):
        cands = [ents[i] for i in g['texts'] if KEY.match(ents[i]['s'].strip()) and ents[i]['h'] >= 0.95 * hmed]
        big = [ents[i] for i in g['texts'] if ents[i]['h'] >= 1.25 * hmed]
        c = sorted(cands + big, key=lambda e: (-e['h'], -e['y']))
        return c[0]['s'] if c else ''
    for g in regs.values(): g['title'] = title_of(g)
    # merge "title only" regions into the view above them
    def is_title_only(g):
        return g['n'] <= 12 and g['ntext'] >= 1 and g['title']
    changed = True
    while changed:
        changed = False
        for g in sorted(regs.values(), key=lambda q: q['n']):
            if not is_title_only(g): continue
            x0, y0, x1, y1 = g['bbox']; cx = (x0 + x1) / 2
            best, bd = None, 1e9
            for q in regs.values():
                if q is g or is_title_only(q): continue
                qx0, qy0, qx1, qy1 = q['bbox']
                if qy1 <= y0 + 10 and qx0 - 60 <= cx <= qx1 + 60:
                    d = y0 - qy1
                    if d < bd: best, bd = q, d
            if best and bd < 0.12 * H:
                for i, r in enumerate(assign):
                    if r == g['id']: assign[i] = best['id']
                b = best['bbox']; best['bbox'] = [min(b[0], x0), min(b[1], y0), max(b[2], x1), max(b[3], y1)]
                best['n'] += g['n']; best['ntext'] += g['ntext']; best['texts'] += g['texts']
                if not best.get('title2'): best['title2'] = g['title']
                del regs[g['id']]; changed = True; break
    out = []
    for g in sorted(regs.values(), key=lambda q: (q['bbox'][1] // (0.2 * H), q['bbox'][0])):
        if g['n'] < 3:
            for i, r in enumerate(assign):
                if r == g['id']: assign[i] = -1
            continue
        out.append(dict(id=g['id'], bbox=[round(v) for v in g['bbox']], title=g.get('title2') or g['title'], n=g['n']))
    # renumber 1..n
    ren = {g['id']: k + 1 for k, g in enumerate(out)}
    for g in out: g['id'] = ren[g['id']]
    assign = [ren.get(r, -1) for r in assign]
    return dict(page=page, sheet=sheet_no(F, page), area=[round(v) for v in (ax0, ay0, ax1, ay1)], regions=out, assign=assign)

def overview(F, S, path, scale=0.22):
    img = build.render(F, scale)
    pil = Image.fromarray(img); d = ImageDraw.Draw(pil)
    try: fnt = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 28)
    except Exception: fnt = None
    for g in S['regions']:
        x0, y0, x1, y1 = [v * scale for v in g['bbox']]
        d.rectangle([x0 - 4, y0 - 4, x1 + 4, y1 + 4], outline=(230, 30, 30), width=3)
        d.rectangle([x0 - 4, y0 - 36, x0 + 40, y0 - 4], fill=(230, 30, 30))
        d.text((x0 + 2, y0 - 34), str(g['id']), fill=(255, 255, 255), font=fnt)
    pil.save(path)

if __name__ == '__main__':
    pg = sys.argv[1]
    F = json.load(open('out/%s.json' % pg))
    S = segment(F, pg)
    json.dump(S, open('seg/%s.json' % pg, 'w'))
    print(S['sheet'], [(g['id'], g['title'], g['n']) for g in S['regions']])
    if '--img' in sys.argv: overview(F, S, 'seg/%s.png' % pg)
