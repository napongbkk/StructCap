"""lib/*.json -> site files: tdx/index.json (sheets, details, thumbnails) + tdx/<sheet>.json"""
import json, os, glob, math, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ftext
OUT = sys.argv[1] if len(sys.argv) > 1 else 'site_tdx'
os.makedirs(OUT, exist_ok=True)
import numpy as np, cv2
from PIL import Image
def thumb(d, path, W=240, H=150):
    w, h = max(1, d['w']), max(1, d['h']); S = 3  # supersample
    k = min((W - 6) / w, (H - 6) / h) * S
    ox, oy = (W * S - w * k) / 2, (H * S - h * k) / 2
    img = np.zeros((H * S, W * S), np.uint8)
    P = lambda p: (int(round(ox + p[0] * k)), int(round(H * S - oy - p[1] * k)))
    lw = lambda e: max(1, int(round(e.get('lw', 0.25) * k * 0.9)))
    for e in d['ents']:
        t = e['t']
        if t == 'line': cv2.line(img, P(e['a']), P(e['b']), 255, lw(e), cv2.LINE_AA)
        elif t == 'circle': cv2.circle(img, P(e['c']), max(1, int(e['r'] * k)), 255, lw(e), cv2.LINE_AA)
        elif t == 'arc':
            sw = (e['a1'] - e['a0']) % 360 or 360; n = max(6, int(sw / 5))
            pts = [P((e['c'][0] + e['r'] * math.cos(math.radians(e['a0'] + sw * i / n)), e['c'][1] + e['r'] * math.sin(math.radians(e['a0'] + sw * i / n)))) for i in range(n + 1)]
            cv2.polylines(img, [np.int32(pts)], False, 255, lw(e), cv2.LINE_AA)
        elif t == 'solid': cv2.fillPoly(img, [np.int32([P(q) for q in e['p']])], 255, cv2.LINE_AA)
        elif t == 'text':
            ca, sa = math.cos(math.radians(e.get('ang', 0))), math.sin(math.radians(e.get('ang', 0)))
            for st in ftext.strokes(e['s'], 0, 0, e['h'], e.get('wf', 1)):
                pts = [P((e['p'][0] + u * ca + v * sa, e['p'][1] + u * sa - v * ca)) for u, v in st]
                cv2.polylines(img, [np.int32(pts)], False, 255, max(1, int(round(e.get('sw', 0.25) * k))), cv2.LINE_AA)
    img = cv2.resize(img, (W, H), interpolation=cv2.INTER_AREA)
    img = np.clip(img.astype(float) * 1.6, 0, 255).astype(np.uint8)
    rgba = np.zeros((H, W, 4), np.uint8); rgba[..., 3] = img
    Image.fromarray(rgba).save(path, optimize=True)
def rnd(o):
    if isinstance(o, float): return round(o, 2)
    if isinstance(o, list): return [rnd(v) for v in o]
    if isinstance(o, dict): return {k: rnd(v) for k, v in o.items()}
    return o
idx = []
os.makedirs(os.path.join(OUT, 'th'), exist_ok=True)
for fn in sorted(glob.glob('lib/*.json')):
    L = json.load(open(fn))
    if not L.get('details'): continue
    base = os.path.basename(fn)
    json.dump(rnd(L), open(os.path.join(OUT, base), 'w'), separators=(',', ':'), ensure_ascii=False)
    ds, tiles = [], []
    for i, d in enumerate(L['details']):
        tmp = os.path.join(OUT, 'th', '_tmp.png'); thumb(d, tmp); tiles.append(Image.open(tmp).copy())
        ds.append(dict(n=d['name'], w=d['w'], h=d['h']))
    sp = Image.new('RGBA', (240 * len(tiles), 150), (0, 0, 0, 0))
    for i, t in enumerate(tiles): sp.paste(t, (240 * i, 0))
    tn = base[:-5] + '.png'; sp.save(os.path.join(OUT, 'th', tn), optimize=True)
    idx.append(dict(sheet=L['sheet'], title=L.get('title', ''), cat=L.get('cat', ''), f=base, th=tn, d=ds))
if os.path.exists(os.path.join(OUT, 'th', '_tmp.png')): os.remove(os.path.join(OUT, 'th', '_tmp.png'))
json.dump(idx, open(os.path.join(OUT, 'index.json'), 'w'), separators=(',', ':'), ensure_ascii=False)
print(len(idx), 'sheets', sum(len(s['d']) for s in idx), 'details', os.path.getsize(os.path.join(OUT, 'index.json')) // 1024, 'KB index')
