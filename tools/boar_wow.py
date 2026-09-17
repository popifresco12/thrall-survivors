"""Jabalí estilo Warcraft v2 — arregla dos fallos de la v1:
  1) el view transform AgX de Blender 4+ desaturaba el naranja (salía beige) -> Standard
  2) el encuadre cortaba la cabeza -> se mide el render y se reajusta cámara y zoom
Uso: blender --background --factory-startup --python tools/boar_wow.py
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


# La referencia es naranja dorado saturado; los valores van en lineal, así que
# el naranja "de verdad" pide el canal rojo casi a tope y el azul casi a cero.
M_BODY = mat("body", (1.00, 0.30, 0.012))      # naranja dorado
M_BELLY = mat("belly", (1.00, 0.52, 0.05))     # vientre más claro
M_CREST = mat("crest", (0.85, 0.12, 0.004))    # cresta naranja-roja
M_HEAD = mat("head", (0.95, 0.26, 0.01))
M_SNOUT = mat("snout", (0.12, 0.055, 0.03))    # hocico marrón oscuro
M_NOSE = mat("nose", (0.01, 0.01, 0.01))
M_TUSK = mat("tusk", (1.0, 0.95, 0.82), 0.3)   # colmillos marfil
M_HOOF = mat("hoof", (0.012, 0.012, 0.012))
M_EYE = mat("eye", (0.01, 0.008, 0.006), 0.15)


def add(kind, name, loc, scale, rot=(0, 0, 0), material=None):
    if kind == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=16, radius=0.5, location=loc)
    elif kind == "cyl":
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.5, depth=1, location=loc)
    elif kind == "cone":
        bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.5, radius2=0.0, depth=1, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = scale
    ob.rotation_euler = rot
    if material:
        ob.data.materials.append(material)
    return ob


parts = []

# --- cuerpo TUBULAR continuo: un cilindro con los dos extremos redondeados.
# (con esferas sueltas quedaban costuras y se veía como un saco de bolas)
parts.append(add("cyl", "body", (0.0, 0, 0.50), (0.80, 0.86, 1.06),
                 rot=(0, math.radians(90), 0), material=M_BODY))
parts.append(add("sphere", "front", (0.50, 0, 0.50), (0.80, 0.86, 0.82), material=M_BODY))
parts.append(add("sphere", "rear", (-0.50, 0, 0.50), (0.80, 0.84, 0.80), material=M_BODY))
parts.append(add("sphere", "hump", (0.04, 0, 0.74), (0.96, 0.80, 0.32), material=M_BODY))
parts.append(add("sphere", "belly", (0.02, 0, 0.18), (1.00, 0.80, 0.24), material=M_BELLY))

# --- cresta erizada: púas grandes y separadas, el rasgo que más lo identifica
for i in range(8):
    t = -0.52 + i * 0.17
    alto = 0.62 - abs(t) * 0.34
    parts.append(add("cone", f"crest{i}", (t, 0, 0.72 + alto * 0.46), (0.20, 0.13, alto),
                     rot=(0, math.radians(-26), 0), material=M_CREST))

# --- cuello y cabeza, claramente diferenciados del cuerpo
parts.append(add("sphere", "neck", (1.00, 0, 0.50), (0.54, 0.72, 0.70), material=M_HEAD))
parts.append(add("sphere", "head", (1.36, 0, 0.46), (0.54, 0.62, 0.60), material=M_HEAD))
parts.append(add("sphere", "cheek", (1.28, 0, 0.30), (0.42, 0.64, 0.34), material=M_HEAD))

# --- hocico largo y oscuro, con nariz negra y mandíbula
parts.append(add("cyl", "snout", (1.60, 0, 0.42), (0.34, 0.36, 0.34),
                 rot=(0, math.radians(90), 0), material=M_SNOUT))
parts.append(add("sphere", "snouttip", (1.74, 0, 0.42), (0.24, 0.34, 0.28), material=M_SNOUT))
parts.append(add("sphere", "nose", (1.82, 0, 0.44), (0.12, 0.26, 0.17), material=M_NOSE))
parts.append(add("sphere", "jaw", (1.62, 0, 0.28), (0.30, 0.28, 0.15), material=M_SNOUT))

# --- ojos pequeños y juntos con brillo
for s_ in (1, -1):
    parts.append(add("sphere", f"eye{s_}", (1.54, 0.23 * s_, 0.62), (0.12, 0.10, 0.11), material=M_EYE))
    parts.append(add("sphere", f"shine{s_}", (1.57, 0.25 * s_, 0.645), (0.042, 0.042, 0.042), material=M_TUSK))

# --- orejas
for s_ in (1, -1):
    parts.append(add("cone", f"ear{s_}", (1.18, 0.30 * s_, 0.70), (0.22, 0.11, 0.28),
                     rot=(math.radians(14 * s_), math.radians(-26), 0), material=M_HEAD))

# --- colmillos grandes curvados hacia arriba y afuera
for s_ in (1, -1):
    parts.append(add("cone", f"tuskA{s_}", (1.56, 0.22 * s_, 0.34), (0.13, 0.13, 0.60),
                     rot=(math.radians(20 * s_), math.radians(-16), 0), material=M_TUSK))
    parts.append(add("cone", f"tuskB{s_}", (1.44, 0.26 * s_, 0.30), (0.085, 0.085, 0.34),
                     rot=(math.radians(34 * s_), math.radians(-6), 0), material=M_TUSK))

# --- cuatro patas cortas y gruesas, bien separadas, con cascos negros
for x in (0.72, -0.70):
    for y in (0.56, -0.56):
        parts.append(add("cyl", f"leg{x}{y}", (x, y, 0.25), (0.26, 0.26, 0.50), material=M_BODY))
        parts.append(add("cyl", f"hoof{x}{y}", (x, y, 0.05), (0.28, 0.28, 0.13), material=M_HOOF))

# --- rabo tieso
parts.append(add("cone", "tail", (-1.16, 0, 0.62), (0.11, 0.11, 0.32),
                 rot=(0, math.radians(-114), 0), material=M_CREST))

for ob in parts:
    ob.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
boar = bpy.context.object
boar.name = "BoarWow"
bpy.ops.object.shade_smooth()

# centrar la malla en el origen
bpy.context.view_layer.update()
co = [v.co.copy() for v in boar.data.vertices]
cx = (min(v.x for v in co) + max(v.x for v in co)) / 2
cy = (min(v.y for v in co) + max(v.y for v in co)) / 2
cz = (min(v.z for v in co) + max(v.z for v in co)) / 2
for v in boar.data.vertices:
    v.co -= Vector((cx, cy, cz))
boar.data.update()
bpy.context.view_layer.update()
co = [v.co for v in boar.data.vertices]
print(f"SIZE model: {max(v.x for v in co) - min(v.x for v in co):.2f} x "
      f"{max(v.y for v in co) - min(v.y for v in co):.2f}")

# ---- cámara 3/4 (el objetivo se mueve para centrar el bicho en el encuadre)
target = bpy.data.objects.new("Aim", None)
bpy.context.collection.objects.link(target)
cam_data = bpy.data.cameras.new("Cam")
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 3.2
cam = bpy.data.objects.new("Cam", cam_data)
bpy.context.collection.objects.link(cam)
ELEV, DIST = math.radians(52), 6.0
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
# CLAVE: sin esto Blender 4+ aplica AgX y el naranja sale beige
sc.view_settings.view_transform = 'Standard'
sc.view_settings.look = 'None'
sc.render.film_transparent = True
RES = 512
sc.render.resolution_x = RES
sc.render.resolution_y = RES
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'

def encuadrar(margen=0.92, pasadas=2):
    """Coloca cámara y zoom midiendo la proyección real del objeto.

    Sin PIL: se proyectan las esquinas de la caja envolvente con
    world_to_camera_view, que ya devuelve coordenadas normalizadas del encuadre.
    """
    from bpy_extras.object_utils import world_to_camera_view
    for _ in range(pasadas):
        pts = [world_to_camera_view(sc, cam, boar.matrix_world @ Vector(c))
               for c in boar.bound_box]
        minx, maxx = min(p.x for p in pts), max(p.x for p in pts)
        miny, maxy = min(p.y for p in pts), max(p.y for p in pts)
        ancho, alto = maxx - minx, maxy - miny
        factor = max(ancho, alto) / margen
        cam_data.ortho_scale *= factor
        # el objetivo se mueve hacia donde está el bicho para centrarlo
        dx = ((minx + maxx) / 2 - 0.5) * cam_data.ortho_scale
        dy = ((miny + maxy) / 2 - 0.5) * cam_data.ortho_scale
        derecha = cam.matrix_world.to_3x3().col[0]
        arriba = cam.matrix_world.to_3x3().col[1]
        target.location = target.location + derecha * dx + arriba * dy
        bpy.context.view_layer.update()
    print(f"encuadre: ocupa {ancho:.2f}x{alto:.2f} del marco -> ortho {cam_data.ortho_scale:.2f}")


encuadrar()
final = os.path.join(OUT, "boar_wow.png")
sc.render.filepath = final
bpy.ops.render.render(write_still=True)
print("RENDER OK ->", final)

# vista lateral (para revisar la silueta sin la perspectiva cenital)
ELEV2 = math.radians(12)
cam.location = (0.0, -DIST * math.cos(ELEV2), DIST * math.sin(ELEV2))
cam_data.ortho_scale = 3.6
bpy.context.view_layer.update()
sc.render.filepath = os.path.join(OUT, "boar_lado.png")
bpy.ops.render.render(write_still=True)
print("RENDER OK ->", sc.render.filepath)
