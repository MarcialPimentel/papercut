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

# ---------- sleeves (Kami's own): indigo paper, the cream cuff with its waves printed on ----------
for p in [p for p in trace if p['kind'] == 'paper' and p['color'] == 'indigo' and p['centre'][1] > 1.6]:
    prints = sorted(p['prints'], key=lambda q: -len(q['pts']))  # the big cuff band first: it is the hem band
    faces = [('pc_robe', 0.030, p['pts'])] + [('pc_kimono', 0.026 - 0.004 * i, q['pts']) for i, q in enumerate(prints)]
    make('kami_sleeve_' + side(p), 'arm_' + side(p), faces)

# ---------- coat (the outer robe, cream): runs up under the sleeve to the shoulder; a thin indigo hem trim ----------
for p in [p for p in trace if p['kind'] == 'paper' and p['area'] > 15000 and p['color'] == 'cream']:
    s, sx = side(p), (1 if side(p) == 'L' else -1)
    hem = sorted(p['pts'], key=lambda q: q[1])[:4]  # the lowest corners
    inner, outer = min(hem, key=lambda q: abs(q[0])), max(hem, key=lambda q: abs(q[0]))
    trim = [(inner[0] + 0.01 * sx, inner[1] + 0.02), (outer[0] - 0.03 * sx, outer[1] + 0.02),
            (outer[0] - 0.05 * sx, outer[1] + 0.08), (inner[0] + 0.02 * sx, inner[1] + 0.08)]
    make('robe_' + s, 'torso', [('pc_kimono', 0.060, hull(p['pts'])), ('pc_robe', 0.058, trim)])

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

SUMI_SLEEVE = [(0.28, 2.66), (0.70, 2.62), (0.86, 2.20), (0.84, 1.95), (0.95, 1.50), (0.62, 1.46), (0.50, 1.92), (0.40, 2.20)]
left = faces_of(D.objects['sumi_sleeve_L'])
left[0] = ('pc_robe', left[0][1], SUMI_SLEEVE)
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
