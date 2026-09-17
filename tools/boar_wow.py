"""Jabalí estilo Warcraft — modelado por SECCIONES (ni una esfera).

La malla se genera como tubos: el CUERPO es un solo tubo continuo que va de la
grupa al hocico (la altura y el radio cambian sección a sección), y las patas,
colmillos, orejas, cresta y cola son tubos que se estrechan. Tres ejes:
  eje='X' -> tubos horizontales (cuerpo, colmillos, cola)
  eje='Z' -> tubos verticales (patas, cascos, orejas)
  eje='Y' -> discos cortos hacia los lados (ojos)

  blender --background --factory-startup --python tools/boar_wow.py
"""
import bpy, math, os
from mathutils import Vector

OUT = r"C:\Users\carlo\thrall-survivors\tools\out"
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, rgb, rough=0.75):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    return m


M_BODY = mat("body", (1.00, 0.30, 0.012))      # naranja dorado
M_BELLY = mat("belly", (1.00, 0.56, 0.06))     # vientre claro
M_CREST = mat("crest", (0.80, 0.10, 0.004))    # cresta naranja-roja
M_SNOUT = mat("snout", (0.10, 0.05, 0.028))    # hocico oscuro
M_TUSK = mat("tusk", (1.0, 0.95, 0.82), 0.3)   # colmillos marfil
M_HOOF = mat("hoof", (0.012, 0.012, 0.012))
M_EYE = mat("eye", (0.01, 0.008, 0.006), 0.15)


def tubo(nombre, secciones, lados=14, materiales=None, eje='X'):
    """Malla continua: une anillos consecutivos.

    eje='X': secciones (x, y, z, ry, rz)  -> anillo en el plano YZ
    eje='Z': secciones (x, y, z, rx, ry)  -> anillo en el plano XY
    eje='Y': secciones (x, y, z, rx, rz)  -> anillo en el plano XZ
    """
    verts, caras = [], []
    n = len(secciones)
    for (a_, b_, c_, r1, r2) in secciones:
        for k in range(lados):
            ang = 2 * math.pi * k / lados
            s, co = math.sin(ang), math.cos(ang)
            if eje == 'X':
                verts.append((a_, b_ + r1 * s, c_ + r2 * co))
            elif eje == 'Z':
                verts.append((a_ + r1 * co, b_ + r2 * s, c_))
            else:  # 'Y'
                verts.append((a_ + r1 * co, b_, c_ + r2 * s))
    for i in range(n - 1):
        for k in range(lados):
            k2 = (k + 1) % lados
            caras.append((i * lados + k, i * lados + k2,
                          (i + 1) * lados + k2, (i + 1) * lados + k))
    # puntas: un vértice en el centro de la primera y de la última sección
    p0, p1 = secciones[0], secciones[-1]
    d = 0.02
    punta0 = {'X': (p0[0] - d, p0[1], p0[2]), 'Z': (p0[0], p0[1], p0[2] + d),
              'Y': (p0[0], p0[1] - d, p0[2])}[eje]
    punta1 = {'X': (p1[0] + d, p1[1], p1[2]), 'Z': (p1[0], p1[1], p1[2] - d),
              'Y': (p1[0], p1[1] + d, p1[2])}[eje]
    i0 = len(verts); verts.append(punta0)
    i1 = len(verts); verts.append(punta1)
    for k in range(lados):
        k2 = (k + 1) % lados
        caras.append((i0, k2, k))
        caras.append((i1, (n - 1) * lados + k, (n - 1) * lados + k2))

    me = bpy.data.meshes.new(nombre)
    me.from_pydata(verts, [], caras)
    me.validate()
    me.update()
    ob = bpy.data.objects.new(nombre, me)
    bpy.context.collection.objects.link(ob)
    for m in (materiales or []):
        ob.data.materials.append(m)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


partes = []

# ── CUERPO: un solo tubo de la grupa al hocico ──────────────────────────────
# (x, y, z, ry, rz): la z arquea el lomo y baja hacia el hocico
cuerpo_secs = [
    (-0.86, 0, 0.52, 0.22, 0.24),   # grupa
    (-0.70, 0, 0.55, 0.36, 0.42),   # anca
    (-0.45, 0, 0.55, 0.42, 0.48),
    (-0.18, 0, 0.55, 0.44, 0.50),   # lomo
    (0.06, 0, 0.56, 0.45, 0.53),    # cruz (joroba)
    (0.30, 0, 0.53, 0.43, 0.50),
    (0.50, 0, 0.50, 0.38, 0.44),    # pecho
    (0.66, 0, 0.47, 0.31, 0.36),    # cuello
    (0.82, 0, 0.45, 0.30, 0.34),
    (1.00, 0, 0.44, 0.34, 0.38),    # cabeza
    (1.18, 0, 0.43, 0.31, 0.34),
    (1.32, 0, 0.42, 0.23, 0.24),    # arranque del hocico
    (1.46, 0, 0.41, 0.18, 0.18),
    (1.58, 0, 0.41, 0.14, 0.14),    # nariz
]
cuerpo = tubo("cuerpo", cuerpo_secs, lados=20, materiales=[M_BODY, M_SNOUT, M_BELLY])
for p in cuerpo.data.polygons:
    p.material_index = 0
    if p.center.x > 1.30:                       # hocico oscuro
        p.material_index = 1
    elif p.center.x < 0.55 and p.normal.z < -0.86:   # solo la panza, apenas visible
        p.material_index = 2
partes.append(cuerpo)

# ── CRESTA: tubo fino sobre el lomo con radios alternos (los "dientes") ────
cresta_secs = []
i = 0
x = -0.56
while x <= 0.34:
    pico = 0.32 if i % 2 == 0 else 0.11
    cresta_secs.append((x, 0, 0.86, 0.07, pico))
    x += 0.11
    i += 1
partes.append(tubo("cresta", cresta_secs, lados=8, materiales=[M_CREST]))

# ── PATAS verticales + cascos ──────────────────────────────────────────────
for px in (0.50, -0.52):
    for py in (0.24, -0.24):
        partes.append(tubo(f"pata{px}{py}", [
            (px, py, 0.60, 0.21, 0.20),      # dentro del tronco
            (px, py, 0.44, 0.19, 0.19),
            (px, py, 0.26, 0.17, 0.17),
            (px, py, 0.13, 0.155, 0.155),
        ], lados=10, materiales=[M_BODY], eje='Z'))
        partes.append(tubo(f"casco{px}{py}", [
            (px, py, 0.12, 0.175, 0.175),
            (px, py, 0.03, 0.185, 0.185),
            (px, py, 0.00, 0.155, 0.155),
        ], lados=10, materiales=[M_HOOF], eje='Z'))

# ── COLMILLOS: suben curvando hacia fuera ──────────────────────────────────
for s in (1, -1):
    partes.append(tubo(f"colmillo{s}", [
        (1.28, 0.19 * s, 0.31, 0.085, 0.085),
        (1.35, 0.22 * s, 0.44, 0.070, 0.070),
        (1.39, 0.25 * s, 0.57, 0.052, 0.052),
        (1.38, 0.27 * s, 0.68, 0.032, 0.032),
        (1.35, 0.28 * s, 0.76, 0.015, 0.015),
    ], lados=8, materiales=[M_TUSK], eje='Z'))

# ── OREJAS: pequeñas, aplanadas y hacia atrás ──────────────────────────────
for s_ in (1, -1):
    partes.append(tubo(f"oreja{s_}", [
        (0.94, 0.24 * s_, 0.58, 0.085, 0.05),
        (0.96, 0.27 * s_, 0.66, 0.065, 0.04),
        (0.97, 0.29 * s_, 0.72, 0.035, 0.022),
        (0.97, 0.30 * s_, 0.76, 0.012, 0.012),
    ], lados=8, materiales=[M_BODY], eje='Z'))

# ── COLA ───────────────────────────────────────────────────────────────────
partes.append(tubo("cola", [
    (-0.98, 0, 0.64, 0.08, 0.08),
    (-1.10, 0, 0.76, 0.05, 0.05),
    (-1.18, 0, 0.88, 0.02, 0.02),
], lados=8, materiales=[M_CREST], eje='Z'))

# ── OJOS: discos que miran hacia los lados (eje Y), sin bolas ──────────────
for s in (1, -1):
    partes.append(tubo(f"ojo{s}", [
        (1.08, 0.15 * s, 0.55, 0.085, 0.085),
        (1.08, 0.26 * s, 0.55, 0.080, 0.080),
    ], lados=12, materiales=[M_EYE], eje='Y'))
    partes.append(tubo(f"brillo{s}", [
        (1.095, 0.15 * s, 0.575, 0.028, 0.028),
        (1.095, 0.27 * s, 0.575, 0.026, 0.026),
    ], lados=8, materiales=[M_TUSK], eje='Y'))

# ── unir, suavizar, centrar ────────────────────────────────────────────────
bpy.ops.object.select_all(action='DESELECT')
for ob in partes:
    ob.select_set(True)
bpy.context.view_layer.objects.active = partes[0]
bpy.ops.object.join()
boar = bpy.context.object
boar.name = "BoarWow"
bpy.ops.object.shade_smooth()

bpy.context.view_layer.update()
co = [v.co.copy() for v in boar.data.vertices]
c = Vector(((min(v.x for v in co) + max(v.x for v in co)) / 2,
            (min(v.y for v in co) + max(v.y for v in co)) / 2,
            (min(v.z for v in co) + max(v.z for v in co)) / 2))
for v in boar.data.vertices:
    v.co -= c
boar.data.update()
bpy.context.view_layer.update()
co = [v.co for v in boar.data.vertices]
print(f"SIZE: {max(v.x for v in co) - min(v.x for v in co):.2f} x "
      f"{max(v.y for v in co) - min(v.y for v in co):.2f} x "
      f"{max(v.z for v in co) - min(v.z for v in co):.2f} | "
      f"caras: {len(boar.data.polygons)} | vértices: {len(boar.data.vertices)}")

# ── cámara, luces y encuadre ───────────────────────────────────────────────
target = bpy.data.objects.new("Aim", None)
bpy.context.collection.objects.link(target)
cam_data = bpy.data.cameras.new("Cam")
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 3.2
cam = bpy.data.objects.new("Cam", cam_data)
bpy.context.collection.objects.link(cam)
ELEV, DIST = math.radians(38), 7.0
cam.location = (0.0, -DIST * math.cos(ELEV), DIST * math.sin(ELEV))
trk = cam.constraints.new(type='TRACK_TO')
trk.target = target
trk.track_axis = 'TRACK_NEGATIVE_Z'
trk.up_axis = 'UP_Y'
bpy.context.scene.camera = cam

sun_data = bpy.data.lights.new("Sun", type='SUN')
sun_data.energy = 3.4
sun_data.angle = math.radians(10)
sun = bpy.data.objects.new("Sun", sun_data)
bpy.context.collection.objects.link(sun)
sun.rotation_euler = (math.radians(44), math.radians(6), math.radians(36))
fill_data = bpy.data.lights.new("Fill", type='SUN')
fill_data.energy = 1.6
fill = bpy.data.objects.new("Fill", fill_data)
bpy.context.collection.objects.link(fill)
fill.rotation_euler = (math.radians(76), 0, math.radians(-140))

sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE'
sc.view_settings.view_transform = 'Standard'
sc.view_settings.look = 'None'
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = 512
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'


def encuadrar(margen=0.93, pasadas=2):
    from bpy_extras.object_utils import world_to_camera_view
    for _ in range(pasadas):
        pts = [world_to_camera_view(sc, cam, boar.matrix_world @ Vector(c))
               for c in boar.bound_box]
        minx, maxx = min(p.x for p in pts), max(p.x for p in pts)
        miny, maxy = min(p.y for p in pts), max(p.y for p in pts)
        cam_data.ortho_scale *= max(maxx - minx, maxy - miny) / margen
        dx = ((minx + maxx) / 2 - 0.5) * cam_data.ortho_scale
        dy = ((miny + maxy) / 2 - 0.5) * cam_data.ortho_scale
        target.location = (target.location
                           + cam.matrix_world.to_3x3().col[0] * dx
                           + cam.matrix_world.to_3x3().col[1] * dy)
        bpy.context.view_layer.update()


encuadrar()
sc.render.filepath = os.path.join(OUT, "boar_wow.png")
bpy.ops.render.render(write_still=True)
print("RENDER OK ->", sc.render.filepath)

ELEV2 = math.radians(10)
cam.location = (0.0, -DIST * math.cos(ELEV2), DIST * math.sin(ELEV2))
cam_data.ortho_scale = 3.5
bpy.context.view_layer.update()
sc.render.filepath = os.path.join(OUT, "boar_lado.png")
bpy.ops.render.render(write_still=True)
print("RENDER OK ->", sc.render.filepath)
