# Traces a flat front-view drawing (art/fighters/reference/kami_front.webp) into paper pieces.
# Every region the ink lines enclose is one paper piece; colour changes inside it without an ink line are prints;
# big black areas (hair, topknot, feet) are pieces of their own. Writes the pieces as JSON in model units
# (4.00 tall, X = 0 at the middle of the feet, Z up) plus a debug picture with every piece numbered by colour.
# Run: blender -b --factory-startup --python art/fighters/trace_front.py -- <image> <out.json> <debug.png>
import bpy, sys, json, math
import numpy as np
from collections import deque

img_path, out_json, out_png = sys.argv[sys.argv.index('--') + 1:][:3]
im = bpy.data.images.load(img_path)
W, H = im.size
px = np.array(im.pixels[:], dtype=np.float32).reshape(H, W, 4)[::-1, :, :3]  # row 0 = top
# Work at half size: one pixel is then about 0.005 units, plenty for paper corners.
px = px[: H // 2 * 2, : W // 2 * 2].reshape(H // 2, 2, W // 2, 2, 3).mean(axis=(1, 3))
H, W = px.shape[:2]
r, g, b = px[..., 0], px[..., 1], px[..., 2]
mx, mn = px.max(axis=2), px.min(axis=2)

# Colour classes, from the drawing's flat palette.
WHITE = (mn > 0.93)
BLACK = (mx < 0.30)
GOLD = (r > 0.6) & (b < 0.25) & ~WHITE
INDIGO = (b > r + 0.05) & (mx < 0.75) & ~BLACK
CREAM = ~(WHITE | BLACK | GOLD | INDIGO)
CLASS = np.zeros((H, W), np.int8)  # 0 white, 1 black, 2 cream, 3 indigo, 4 gold
CLASS[BLACK] = 1; CLASS[CREAM] = 2; CLASS[INDIGO] = 3; CLASS[GOLD] = 4
NAMES = {2: 'cream', 3: 'indigo', 4: 'gold', 1: 'black'}


def label(mask):
    """4-connected components of a boolean mask: (labels, count)."""
    lab = np.zeros(mask.shape, np.int32)
    n = 0
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if lab[y0, x0]: continue
        n += 1
        lab[y0, x0] = n
        q = deque([(y0, x0)])
        while q:
            y, x = q.popleft()
            for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= yy < H and 0 <= xx < W and mask[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n; q.append((yy, xx))
    return lab, n


def dilate(m, k):
    out = m.copy()
    for _ in range(k):
        o = out.copy()
        o[1:] |= out[:-1]; o[:-1] |= out[1:]; o[:, 1:] |= out[:, :-1]; o[:, :-1] |= out[:, 1:]
        out = o
    return out


def erode(m, k):
    return ~dilate(~m, k)


def fill_holes(m):
    """The mask with its holes filled (everything not reachable from the border)."""
    outside, _ = label_from_border(~m)
    return ~outside


def label_from_border(m):
    seen = np.zeros(m.shape, bool)
    q = deque()
    for y in range(H):
        for x in (0, W - 1):
            if m[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    for x in range(W):
        for y in (0, H - 1):
            if m[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= yy < H and 0 <= xx < W and m[yy, xx] and not seen[yy, xx]:
                seen[yy, xx] = True; q.append((yy, xx))
    return seen, None


def trace(mask):
    """Outer boundary of one blob as a list of (x, y) pixel corners, walking the pixel edges (crack following)."""
    m = np.pad(mask, 1)
    ys, xs = np.nonzero(m)
    i = np.argmin(ys * 10 ** 6 + xs)
    y0, x0 = ys[i], xs[i]  # topmost-leftmost pixel: its top-left corner is on the outline
    # Walk corners; direction d: 0 right, 1 down, 2 left, 3 up (y grows down). Keep the blob on the right hand.
    DX, DY = (1, 0, -1, 0), (0, 1, 0, -1)
    def inside(cx, cy):  # pixel whose top-left corner is (cx, cy)
        return m[cy, cx] if 0 <= cy < m.shape[0] and 0 <= cx < m.shape[1] else False
    x, y, d = x0, y0, 0
    pts = [(x, y)]
    for _ in range(10 ** 6):
        # pixels ahead-right and ahead-left of the edge we are about to walk
        if d == 0: R, L = inside(x, y), inside(x, y - 1)
        elif d == 1: R, L = inside(x - 1, y), inside(x, y)
        elif d == 2: R, L = inside(x - 1, y - 1), inside(x - 1, y)
        else: R, L = inside(x, y - 1), inside(x - 1, y - 1)
        if L: d = (d + 3) % 4          # blob turns left: follow it
        elif not R: d = (d + 1) % 4    # nothing ahead: turn right
        else:
            x += DX[d]; y += DY[d]
            pts.append((x, y))
            if (x, y) == (x0, y0): break
    return [(p[0] - 1, p[1] - 1) for p in pts]


def simplify(pts, tol):
    """Douglas-Peucker on a closed loop."""
    pts = pts[:-1] if pts[0] == pts[-1] else pts
    if len(pts) < 4: return pts
    # split at the two points farthest apart so the loop has fixed ends
    a = 0
    far = max(range(len(pts)), key=lambda i: (pts[i][0] - pts[a][0]) ** 2 + (pts[i][1] - pts[a][1]) ** 2)
    def dp(seq):
        if len(seq) < 3: return seq
        (x1, y1), (x2, y2) = seq[0], seq[-1]
        L = math.hypot(x2 - x1, y2 - y1) or 1e-9
        dmax, imax = 0, 0
        for i in range(1, len(seq) - 1):
            x, y = seq[i]
            dd = abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / L
            if dd > dmax: dmax, imax = dd, i
        if dmax <= tol: return [seq[0], seq[-1]]
        return dp(seq[: imax + 1])[:-1] + dp(seq[imax:])
    loop = pts[a:] + pts[:a]
    k = far - a
    first = dp(loop[: k + 1]); second = dp(loop[k:] + loop[:1])
    return first[:-1] + second[:-1]


# Figure bounds -> model units (4.00 tall, feet at Z = 0, X = 0 at the middle of the feet).
fig = ~WHITE
rows = np.nonzero(fig.any(axis=1))[0]
top, bottom = rows[0], rows[-1] + 1
S = 4.0 / (bottom - top)
feetrow = fig[bottom - 3]
cols = np.nonzero(feetrow)[0]
cx = (cols[0] + cols[-1]) / 2


def units(p):
    return (round((p[0] - cx) * S, 4), round((bottom - p[1]) * S, 4))


pieces = []
debug = np.ones((H, W, 3), np.float32)

# 1. Paper regions: everything that is neither ink nor background, split by the ink lines.
paper = ~(WHITE | BLACK)
lab, n = label(paper)
INK_HALF = 4  # grow each region about half an ink line, so neighbouring pieces meet under the game's ink
for i in range(1, n + 1):
    m = lab == i
    area = int(m.sum())
    if area < 40: continue
    cls = CLASS[m]
    counts = {NAMES[c]: int((cls == c).sum()) for c in (2, 3, 4) if (cls == c).any()}
    main = 'indigo' if 'indigo' in counts else max(counts, key=counts.get)  # a sleeve is indigo paper with cream prints
    grown = dilate(m, INK_HALF)
    outline = [units(p) for p in simplify(trace(grown), 1.3)]
    prints = []
    for c in (2, 3, 4):
        if NAMES[c] == main: continue
        sub, k = label(m & (CLASS == c))
        for j in range(1, k + 1):
            sm = sub == j
            if sm.sum() < 25: continue
            prints.append({'color': NAMES[c], 'pts': [units(p) for p in simplify(trace(sm), 1.0)]})
    ys, xs = np.nonzero(m)
    pieces.append({'id': len(pieces), 'kind': 'paper', 'color': main, 'area': area,
                   'centre': units((xs.mean(), ys.mean())), 'pts': outline, 'prints': prints})
    col = np.array([(len(pieces) * 0.37) % 1, (len(pieces) * 0.61) % 1, (len(pieces) * 0.83) % 1], np.float32) * 0.8 + 0.1
    debug[m] = col

# 2. Black shapes, cut out by where they are (the game draws its own ink, so the drawing's outline goes):
# the head's silhouette above the collar (hair and topknot; the face and the gold tie go on top of it), the two
# feet below the hakama, and the eye and brow inside the face (prints on the face).
row = lambda z: int(round(bottom - z / S))
def add_black(kind, m, tol=1.3):
    ys, xs = np.nonzero(m)
    pieces.append({'id': len(pieces), 'kind': kind, 'color': 'black', 'area': int(m.sum()),
                   'centre': units((xs.mean(), ys.mean())), 'pts': [units(p) for p in simplify(trace(m), tol)], 'prints': []})
    debug[m & BLACK] = (0.15, 0.15, 0.15)

above = np.zeros((H, W), bool); above[: row(2.95)] = True
lab, n = label(~WHITE & above)
big = max(range(1, n + 1), key=lambda i: (lab == i).sum())
add_black('head', fill_holes(lab == big))

below = np.zeros((H, W), bool); below[row(0.30):] = True
lab, n = label(~WHITE & below)
feet = lab == max(range(1, n + 1), key=lambda i: (lab == i).sum())
side = np.arange(W)[None, :] < cx
for half in (feet & side, feet & ~side):
    add_black('foot', half)

face = max((p for p in pieces if p['kind'] == 'paper' and p['centre'][1] > 2.9 and p['color'] == 'cream'), key=lambda p: p['area'])
fm = np.zeros((H, W), bool)
lab, n = label(~(WHITE | BLACK))
for i in range(1, n + 1):
    m = lab == i
    ys, xs = np.nonzero(m)
    if units((xs.mean(), ys.mean())) == face['centre']: fm = m
# The eye and brow: ink inside the face, keeping clear of the face's own outline (the brow runs into it).
inner = erode(fill_holes(dilate(fm, 4)), 7)
eyes, n = label(inner & BLACK)
for i in range(1, n + 1):
    m = eyes == i
    if m.sum() >= 8: face['prints'].append({'color': 'black', 'pts': [units(p) for p in simplify(trace(m), 0.8)]})
thick = np.zeros((H, W), bool)

json.dump({'scale': S, 'pieces': pieces}, open(out_json, 'w'), indent=1)
# Debug picture: every piece in its own colour, thin ink left black.
debug[BLACK & ~thick] = (0, 0, 0)
out = bpy.data.images.new('dbg', W, H)
rgba = np.concatenate([debug[::-1], np.ones((H, W, 1), np.float32)], axis=2)
out.pixels[:] = rgba.ravel()
out.filepath_raw = out_png; out.file_format = 'PNG'; out.save()
print('TRACED', len(pieces), 'pieces; scale', S)
for p in pieces:
    print('P%02d %-6s %-6s area=%6d centre=(%.2f, %.2f) corners=%d prints=%d' % (p['id'], p['kind'], p['color'], p['area'], p['centre'][0], p['centre'][1], len(p['pts']), len(p['prints'])))
