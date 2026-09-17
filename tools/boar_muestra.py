"""Compone la muestra del jabalí: grande + tira de tamaños de sprite sobre verde."""
from PIL import Image

OUT = "C:/Users/carlo/thrall-survivors/tools/out"
bicho = Image.open(OUT + "/boar_wow.png").convert("RGBA")
lado = Image.open(OUT + "/boar_lado.png").convert("RGBA")


def recortar(im):
    return im.crop(im.split()[-1].getbbox())


bicho, lado = recortar(bicho), recortar(lado)

VERDE = (58, 92, 52, 255)
W, H = 1180, 620
lienzo = Image.new("RGBA", (W, H), VERDE)
# un poco de textura para que el ojo no juzgue sobre un fondo plano
for i in range(0, H, 7):
    for j in range(0, W, 7):
        v = 8 if ((i * j) % 3) else -8
        lienzo.putpixel((j, i), (VERDE[0] + v, VERDE[1] + v, VERDE[2] + v, 255))

g = bicho.resize((430, int(430 * bicho.height / bicho.width)), Image.NEAREST)
l = lado.resize((430, int(430 * lado.height / lado.width)), Image.NEAREST)
lienzo.paste(g, (60, 330 - g.height // 2), g)
lienzo.paste(l, (660, 330 - l.height // 2), l)

# tira de tamaños de sprite: 72 (jefe), 56 y 40 (enemigos normales), 32 (enjambre)
x = 60
for px in (72, 56, 40, 32):
    s = bicho.resize((px, max(1, int(px * bicho.height / bicho.width))), Image.NEAREST)
    lienzo.paste(s, (x, 70), s)
    x += px + 30
x = 60
for px in (72, 56, 40, 32):
    s = lado.resize((px, max(1, int(px * lado.height / lado.width))), Image.NEAREST)
    lienzo.paste(s, (x, 180), s)
    x += px + 30

lienzo.convert("RGB").save(OUT + "/boar_wow_muestra.png")
print("muestra:", OUT + "/boar_wow_muestra.png")
