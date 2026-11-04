# Builds the samurai's body from the traced front view (trace_front.py -> reference/kami_front_trace.json).
# Every traced region becomes its own paper piece, so the game's ink line round each piece redraws the drawing's
# lines. Pieces that something else sits on are extended underneath it (the coat runs up under the sleeve, the
# hakama under the apron), like cut paper laid on cut paper, so nothing opens a gap when a part turns.
# Keeps the rig the game reads (root, torso, head, arm_L/R, hand_L/R, sword, skirt_L/R), the hands, the sword and
# Sumi's own pieces. X > 0 is the rival's side (the drawing's right) and gets the _L names.
# Run from the papercut folder, on the model as it was before the trace (it removes the old body pieces):
#   blender -b art/fighters/samurai.blend --python art/fighters/build_from_trace.py -- <trace.json> [out.glb]
import bpy, sys, json
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index('--') + 1:]
trace = json.load(open(args[0]))['pieces']
D = bpy.data
MAT = {m.name: m for m in D.materials}
COLL = D.objects['hand_L_paper'].users_collection

# ---------- helpers ----------
def piece(cond):
    found = [p for p in trace if cond(p)]
    assert len(found) == 1, f'expected one traced piece, found {len(found)}'
    return found[0]

def side(p): return 'L' if p['centre'][0] > 0 else 'R'

def hull(pts):
    pts = sorted(set(map(tuple, pts)))
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, hi = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(hi) >= 2 and cross(hi[-2], hi[-1], p) <= 0: hi.pop()
        hi.append(p)
    return lo[:-1] + hi[:-1]

def make(name, parent, faces):
    """A paper object from [(material, y, [(x, z)...])] in world units, hanging from a rig empty."""
    if name in D.objects: D.objects.remove(D.objects[name])
    me = D.meshes.new(name)
    mats, verts, polys, idx = [], [], [], []
    for mat, y, pts in faces:
        if mat not in mats: mats.append(mat)
        polys.append(list(range(len(verts), len(verts) + len(pts))))
        idx.append(mats.index(mat))
        verts += [(x, y, z) for x, z in pts]
    me.from_pydata(verts, [], polys)
    for m in mats: me.materials.append(MAT[m])
    for p, i in zip(me.polygons, idx): p.material_index = i
    me.update()
    o = D.objects.new(name, me)
    for c in COLL: c.objects.link(o)
    o.parent = D.objects[parent]
    o.matrix_parent_inverse = D.objects[parent].matrix_world.inverted()
    return o

def faces_of(o):
    mw, me = o.matrix_world, o.data
    return [(me.materials[p.material_index].name, (mw @ me.vertices[p.vertices[0]].co).y,
             [((mw @ me.vertices[i].co).x, (mw @ me.vertices[i].co).z) for i in p.vertices]) for p in me.polygons]

def reshape(o, faces):
    inv, me = o.matrix_world.inverted(), o.data
    mats = []
    for m, _, _ in faces:
        if m not in mats: mats.append(m)
    verts, polys = [], []
    for _, y, pts in faces:
        polys.append(list(range(len(verts), len(verts) + len(pts))))
        verts += [tuple(inv @ Vector((x, y, z))) for x, z in pts]
    me.clear_geometry(); me.materials.clear()
    me.from_pydata(verts, [], polys)
    for m in mats: me.materials.append(MAT[m])
    for p, (m, _, _) in zip(me.polygons, faces): p.material_index = mats.index(m)
    me.update()

def move_empty(name, dx, dz):
    e = D.objects[name]
    e.location = (e.location.x + dx, e.location.y, e.location.z + dz)
    bpy.context.view_layer.update()

# ---------- out with the old body ----------
OLD = ['collar', 'kimono', 'obi', 'lapel_L', 'lapel_R', 'robe_L', 'robe_R', 'hakama_L', 'hakama_R', 'hakama_back',
       'feet_L', 'feet_R', 'face', 'kami_hair', 'kami_sleeve_L', 'kami_sleeve_R']
for o in list(D.objects):
    if o.name in OLD or o.name.split('_')[0] in ('lapel', 'panel', 'underrobe') or o.name.startswith(('kami_lapel', 'kami_panel', 'kami_undersleeve', 'sumi_lapel')):
        D.objects.remove(o)

# ---------- the rig, refitted to the drawing ----------
# Shoulders sit at the top of the hanging sleeves; the arm keeps its length, so each hand comes out at the bottom
# of its sleeve and every pose (and the sword's reach) stays as it was. The neck drops to the drawing's neck.
if D.objects['arm_L'].matrix_world.translation.z > 2.9:  # only once
    move_empty('arm_L', -0.12, -0.42)
    move_empty('arm_R', +0.12, -0.42)
    move_empty('head', 0.0, -0.22)
    # Sumi's long hair, fitted to the new head (it moved down with the neck; the new head is wider).
    o = D.objects['sumi_hair']
    for v in o.data.vertices:
        w = o.matrix_world @ v.co
        w.x *= 1.2
        v.co = o.matrix_world.inverted() @ w

# ---------- head ----------
head = piece(lambda p: p['kind'] == 'head')
gold = piece(lambda p: p['color'] == 'gold')
make('kami_hair', 'head', [('pc_hair', -0.040, head['pts']), ('pc_accent', -0.044, gold['pts'])])
face = piece(lambda p: p['kind'] == 'paper' and p['color'] == 'cream' and p['centre'][1] > 2.9)
make('face', 'head', [('pc_skin', -0.050, face['pts'])] + [('pc_ink', -0.054, q['pts']) for q in face['prints']])

# The crest, taken from Sumi's sleeve (every print but the paper and the cord), centred on its outer ring.
_sumi = faces_of(D.objects['sumi_sleeve_L'])
_crest = [f for f in _sumi[1:] if f[0] != 'pc_cord']
_cx = sum(x for x, _ in _crest[0][2]) / len(_crest[0][2]); _cz = sum(z for _, z in _crest[0][2]) / len(_crest[0][2])
CREST = [(m, y, [(x - _cx, z - _cz) for x, z in pts]) for m, y, pts in _crest]
KAMI_CREST = (0.50, 2.30)

# ---------- sleeves (Kami's own): indigo paper, the cream cuff with its waves printed on ----------
for p in [p for p in trace if p['kind'] == 'paper' and p['color'] == 'indigo' and p['centre'][1] > 1.6]:
    prints = sorted(p['prints'], key=lambda q: -len(q['pts']))  # the big cuff band first: it is the hem band
    faces = [('pc_robe', 0.030, p['pts'])] + [('pc_kimono', 0.026 - 0.004 * i, q['pts']) for i, q in enumerate(prints)]
    # The crest on the upper sleeve (part of the Waves outfit), the same crest as Sumi's.
    sx = 1 if side(p) == 'L' else -1
    for i, (m, _, pts) in enumerate(CREST):
        faces.append((m, 0.018 - 0.0015 * i, [(sx * (x + KAMI_CREST[0]), z + KAMI_CREST[1]) for x, z in pts][:: sx]))
    make('kami_sleeve_' + side(p), 'arm_' + side(p), faces)

# One wave (the old robe's wave print), 0.23 wide from X 0.30, sitting on Z 1.05.
WAVE = [(0.30, 1.15), (0.33, 1.13), (0.37, 1.10), (0.41, 1.10), (0.44, 1.13), (0.42, 1.14), (0.39, 1.14), (0.37, 1.16),
        (0.40, 1.19), (0.45, 1.20), (0.49, 1.16), (0.53, 1.10), (0.53, 1.05), (0.30, 1.05)]

# ---------- coat (the outer robe, cream): runs up under the sleeve to the shoulder; a thin indigo hem trim ----------
for p in [p for p in trace if p['kind'] == 'paper' and p['area'] > 15000 and p['color'] == 'cream']:
    s, sx = side(p), (1 if side(p) == 'L' else -1)
    hem = sorted(p['pts'], key=lambda q: q[1])[:4]  # the lowest corners
    inner, outer = min(hem, key=lambda q: abs(q[0])), max(hem, key=lambda q: abs(q[0]))
    trim = [(inner[0] + 0.01 * sx, inner[1] + 0.02), (outer[0] - 0.03 * sx, outer[1] + 0.02),
            (outer[0] - 0.05 * sx, outer[1] + 0.08), (inner[0] + 0.02 * sx, inner[1] + 0.08)]
    # A row of three waves just above the trim, following the hem (the Waves outfit; other outfits drop them).
    a0, b0 = trim[3], trim[2]  # the trim's top edge, inner to outer
    waves = []
    for k in range(3):
        for_x = lambda u: a0[0] + (b0[0] - a0[0]) * u
        for_z = lambda u: a0[1] + (b0[1] - a0[1]) * u + 0.015
        u0 = 0.04 + 0.31 * k
        pts = [(for_x(u0 + (x - 0.30) / 0.23 * 0.29), for_z(u0 + (x - 0.30) / 0.23 * 0.29) + (z - 1.05) * 0.9) for x, z in WAVE]
        waves.append(('pc_robe', 0.056 - 0.002 * k, pts if sx > 0 else pts[::-1]))
    make('robe_' + s, 'torso', [('pc_kimono', 0.060, hull(p['pts'])), ('pc_robe', 0.058, trim)] + waves)

# ---------- the middle: inner kimono pieces, obi, apron, the dark neck behind the collar ----------
small = [p for p in trace if p['kind'] == 'paper' and p['color'] == 'cream' and 1.3 < p['centre'][1] < 2.8 and p['area'] < 4000]
for i, p in enumerate(sorted([p for p in small if p['centre'][1] > 2.1], key=lambda p: -p['area'])):
    make('kimono' if i == 0 else f'kimono_{i + 1}', 'torso', [('pc_kimono', 0.110, p['pts'])])
obi = [p for p in small if 1.9 < p['centre'][1] < 2.1]
for p in obi:
    name = 'obi' if abs(p['centre'][0]) < 0.06 else 'obi_' + side(p)
    make(name, 'torso', [('pc_kimono', 0.100, p['pts'])])
apron = piece(lambda p: p in small and p['centre'][1] < 1.9)
top = max(z for _, z in apron['pts'])
make('apron', 'torso', [('pc_kimono', 0.120, hull(apron['pts'] + [(x, top + 0.12) for x, z in apron['pts'] if z > top - 0.05]))])
kz = min(z for p in small if p['centre'][1] > 2.1 for _, z in p['pts'])
make('neck', 'torso', [('pc_ink', 0.130, [(-0.14, 2.90), (0.16, 2.90), (0.13, kz), (-0.09, kz)])])

# ---------- hakama: the side strips swing with the legs, the middle one stays; a dark back panel behind all ----------
strips = [p for p in trace if p['kind'] == 'paper' and p['color'] == 'indigo' and p['centre'][1] < 1.6]
allpts = []
for p in strips:
    pts = p['pts']
    if abs(p['centre'][0]) < 0.1:  # the middle strip runs up under the apron
        t = max(z for _, z in pts)
        pts = hull(pts + [(x, t + 0.3) for x, z in pts if z > t - 0.05])
        make('hakama_mid', 'torso', [('pc_hakama', 0.150, pts)])
    else:
        make('hakama_' + side(p), 'skirt_' + side(p), [('pc_hakama', 0.150, pts)])
    allpts += pts
make('hakama_back', 'torso', [('pc_hakamaDark', 0.170, hull(allpts))])

# ---------- feet: the tabi under each hakama (the drawing's outline above them is left out) ----------
for p in [p for p in trace if p['kind'] == 'foot']:
    sx = 1 if side(p) == 'L' else -1
    xs = [abs(x) for x, z in p['pts'] if z < 0.05]
    a, b = min(xs), max(xs)
    make('feet_' + side(p), 'skirt_' + side(p), [('pc_ink', 0.200, [(sx * a, 0.0), (sx * b, 0.0), (sx * (b - 0.07), 0.24), (sx * a, 0.24)][:: sx])])

# ---------- Sumi's sleeves: down to the wrist like Kami's, narrower, with her crest and the cord at the elbow ----------
# (Marz, 2026-11-04: cover the arms; the bare forearms go.)
# The shoulder slopes from beside the neck straight out and down, like Kami's (Marz: the flat top was boxy).
SUMI_SLEEVE = [(0.28, 2.66), (0.45, 2.65), (0.88, 2.06), (0.95, 1.50), (0.62, 1.46), (0.50, 1.92), (0.40, 2.20)]
# Her design sits at the wrist, like Kami's wave cuffs (Marz): the cord is a cuff band just above the opening,
# the crest right above it.
SUMI_CORD = [(0.58, 1.67), (0.90, 1.69), (0.92, 1.58), (0.61, 1.55)]
CREST_Z = 1.82
left = faces_of(D.objects['sumi_sleeve_L'])
left[0] = ('pc_robe', left[0][1], SUMI_SLEEVE)
crest = [i for i, (m, _, _) in enumerate(left) if i > 0 and m != 'pc_cord']
cz = max(sum(z for _, z in left[i][2]) / len(left[i][2]) for i in crest[:1])  # the crest's outer ring
for i, (m, y, pts) in enumerate(left):
    if m == 'pc_cord': left[i] = (m, y, SUMI_CORD)
    elif i in crest: left[i] = (m, y, [(x, z + CREST_Z - cz) for x, z in pts])
reshape(D.objects['sumi_sleeve_L'], left)
reshape(D.objects['sumi_sleeve_R'], [(m, y, [(-x, z) for x, z in reversed(pts)]) for m, y, pts in left])
for s in 'LR':
    if 'sumi_forearm_' + s in D.objects: D.objects.remove(D.objects['sumi_forearm_' + s])

bpy.ops.wm.save_mainfile()
if len(args) > 1:
    bpy.ops.object.select_all(action='DESELECT')
    def sel(o):
        o.select_set(True)
        for c in o.children: sel(c)
    sel(D.objects['root'])
    bpy.ops.export_scene.gltf(filepath=args[1], export_format='GLB', use_selection=True, export_yup=True, export_animations=False)
print('BUILT', sorted(o.name for o in D.objects if o.type == 'MESH'))
