"""Sprite pipeline — jabalí (prueba v5). Blender 5.2 headless.
Vista cenital 3/4, sin assets externos. Uso:
  blender --background --factory-startup --python tools/boar_test.py
"""
import bpy, math, os
from mathutils import Vector

OUT = r"C:\Users\carlo\thrall-survivors\tools\out"
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, rgb, rough=0.85):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    return m

M_BODY = mat("body", (0.22, 0.13, 0.075))   # marrón oscuro
M_BACK = mat("back", (0.13, 0.08, 0.05))    # lomo aún más oscuro
M_HEAD = mat("head", (0.28, 0.16, 0.09))
M_SNOUT= mat("snout", (0.68, 0.52, 0.40))   # hocico claro
M_TUSK = mat("tusk", (1.0, 0.98, 0.92), 0.25)
M_HOOF = mat("hoof", (0.04, 0.035, 0.03))
M_EYE  = mat("eye", (1.0, 0.12, 0.05), 0.25)

def add(kind, name, loc, scale, rot=(0, 0, 0), material=None):
    if kind == "cube":     bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    elif kind == "sphere": bpy.ops.mesh.primitive_uv_sphere_add(segments=18, ring_count=10, radius=0.5, location=loc)
    elif kind == "cyl":    bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.5, depth=1, location=loc)
    elif kind == "cone":   bpy.ops.mesh.primitive_cone_add(vertices=14, radius1=0.5, radius2=0.0, depth=1, location=loc)
    ob = bpy.context.object; ob.name = name
    ob.scale = scale; ob.rotation_euler = rot
    if material: ob.data.materials.append(material)
    return ob

parts = []
# --- cuerpo compacto y ancho (eje X = hacia donde mira)
parts.append(add("sphere", "body",  (0.05, 0, 0.52), (1.15, 1.05, 0.70), material=M_BODY))
parts.append(add("sphere", "chest", (0.52, 0, 0.52), (0.62, 0.98, 0.72), material=M_BODY))
parts.append(add("sphere", "rump",  (-0.58, 0, 0.52), (0.60, 0.90, 0.66), material=M_BODY))
# --- cresta de pelo en el lomo (rasgo de jabalí)
for i in range(7):
    t = -0.45 + i * 0.16
    parts.append(add("cone", f"bristle{i}", (t, 0, 0.88), (0.15, 0.15, 0.34),
                     rot=(0, math.radians(-14), 0), material=M_BACK))
# --- cuello y cabeza
parts.append(add("sphere", "neck", (0.92, 0, 0.50), (0.38, 0.60, 0.56), material=M_HEAD))
parts.append(add("sphere", "head", (1.16, 0, 0.46), (0.38, 0.52, 0.44), material=M_HEAD))
# --- hocico claro, ancho y corto
parts.append(add("cyl", "snout", (1.36, 0, 0.38), (0.34, 0.34, 0.26), rot=(0, math.radians(90), 0), material=M_SNOUT))
parts.append(add("sphere", "nose", (1.53, 0, 0.38), (0.16, 0.20, 0.16), material=M_BACK))
# --- orejas erguidas
for s in (1, -1):
    parts.append(add("cone", f"ear{s}", (1.05, 0.26 * s, 0.70), (0.26, 0.13, 0.30),
                     rot=(math.radians(24 * s), 0, math.radians(-10 * s)), material=M_HEAD))
# --- ojos pequeños rojizos
for s in (1, -1):
    parts.append(add("sphere", f"eye{s}", (1.26, 0.25 * s, 0.54), (0.14, 0.11, 0.11), material=M_EYE))
# --- colmillos grandes curvados hacia arriba
for s in (1, -1):
    parts.append(add("cone", f"tusk{s}", (1.42, 0.17 * s, 0.34), (0.085, 0.085, 0.26),
                     rot=(math.radians(-48), 0, math.radians(16 * s)), material=M_TUSK))
# --- patas cortas y gruesas + pezuñas
for x in (0.60, -0.55):
    for y in (0.52, -0.52):
        parts.append(add("cyl", f"leg{x}{y}", (x, y, 0.26), (0.22, 0.22, 0.50), material=M_BACK))
        parts.append(add("cyl", f"hoof{x}{y}", (x, y, 0.055), (0.24, 0.24, 0.13), material=M_HOOF))
# --- rabo
parts.append(add("cone", "tail", (-1.06, 0, 0.62), (0.13, 0.13, 0.30), rot=(0, math.radians(-124), 0), material=M_BODY))

for ob in parts: ob.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
boar = bpy.context.object; boar.name = "Boar"
bpy.ops.object.shade_smooth()

# ---- centrar la MALLA en el origen (contando subdivisión) y medir de verdad
bpy.context.view_layer.update()
co = [v.co.copy() for v in boar.data.vertices]
cx = (min(v.x for v in co) + max(v.x for v in co)) / 2
cy = (min(v.y for v in co) + max(v.y for v in co)) / 2
cz = (min(v.z for v in co) + max(v.z for v in co)) / 2
for v in boar.data.vertices:
    v.co -= Vector((cx, cy, cz))
boar.data.update(); bpy.context.view_layer.update()

co = [v.co for v in boar.data.vertices]
SX = max(v.x for v in co) - min(v.x for v in co)
SY = max(v.y for v in co) - min(v.y for v in co)
print(f"SIZE model: {SX:.2f} x {SY:.2f}")

# ---- cámara apuntando al origen, encuadre automático
target = bpy.data.objects.new("Aim", None); bpy.context.collection.objects.link(target)
cam_data = bpy.data.cameras.new("Cam"); cam_data.type = 'ORTHO'
cam_data.ortho_scale = max(SX, SY) * 1.06
cam = bpy.data.objects.new("Cam", cam_data); bpy.context.collection.objects.link(cam)
ELEV, DIST = math.radians(68), 5.2
cam.location = (0.0, -DIST * math.cos(ELEV), DIST * math.sin(ELEV))
trk = cam.constraints.new(type='TRACK_TO'); trk.target = target
trk.track_axis = 'TRACK_NEGATIVE_Z'; trk.up_axis = 'UP_Y'
bpy.context.scene.camera = cam

sun_data = bpy.data.lights.new("Sun", type='SUN'); sun_data.energy = 3.0; sun_data.angle = math.radians(15)
sun = bpy.data.objects.new("Sun", sun_data); bpy.context.collection.objects.link(sun)
sun.rotation_euler = (math.radians(48), math.radians(10), math.radians(40))
fill_data = bpy.data.lights.new("Fill", type='SUN'); fill_data.energy = 1.4
fill = bpy.data.objects.new("Fill", fill_data); bpy.context.collection.objects.link(fill)
fill.rotation_euler = (math.radians(72), 0, math.radians(-140))

sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE'
sc.render.film_transparent = True
sc.render.resolution_x = 320; sc.render.resolution_y = 320
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
sc.render.filepath = os.path.join(OUT, "boar_test7.png")
bpy.ops.render.render(write_still=True)
print("RENDER OK ->", sc.render.filepath)
