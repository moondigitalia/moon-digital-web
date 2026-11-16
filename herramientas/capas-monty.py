#!/usr/bin/env python3
"""Capas para que Monty hable y parpadee (como Bolita): cara base + boca cerrada/media + ojos cerrados.
Todas del mismo tamaño y alineadas; las capas son transparentes fuera de su zona.
Uso: python3 capas.py cabeza.png carpeta_salida"""
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter

src = Image.open(sys.argv[1]).convert('RGBA'); OUT = sys.argv[2]
A = np.array(src).astype(int); H, W = A.shape[:2]
r, g, b, al = A[..., 0], A[..., 1], A[..., 2], A[..., 3]
amarillo = (r > 190) & (g > 140) & (b < 120)
blanco = (r > 200) & (g > 200) & (b > 200)
yy, xx = np.mgrid[0:H, 0:W]

def elipse(cx, cy, rx, ry):
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1

def suave(mask, s=1.2):
    return np.array(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(s))) / 255.0

def capa(rgb, mask):
    out = np.zeros((H, W, 4), np.uint8)
    out[..., :3] = np.clip(rgb, 0, 255)
    out[..., 3] = (suave(mask) * al).astype(np.uint8)
    return Image.fromarray(out)

def color_anillo(mask, grosor=10):
    m = np.array(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(grosor * 2 + 1))) > 0
    anillo = m & ~mask & amarillo
    return np.median(A[anillo][:, :3], 0)

# ── ojos cerrados ──
ojos = [(136, 255, 52, 53), (316, 230, 62, 56)]
lienzo = A[..., :3].astype(float).copy(); mOjos = np.zeros((H, W), bool)
dib = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(dib)
for cx, cy, rx, ry in ojos:
    # el párpado tapa lo de adentro del aro negro (el aro se queda, como en caricatura)
    m = elipse(cx, cy, rx - 8, ry - 8)
    c = color_anillo(elipse(cx, cy, rx, ry) & ~amarillo, 12)
    # párpado redondo: más claro arriba-centro, más oscuro en las orillas
    dist = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy + ry * 0.25) / ry) ** 2)
    luz = np.clip(1.06 - 0.28 * dist, 0.78, 1.06)[..., None]
    lienzo = np.where(m[..., None], np.clip(c * luz, 0, 255), lienzo)
    mOjos |= m
    # pestaña cerrada: un arco hacia abajo, como ojo feliz
    d.arc([cx - rx * 0.78, cy - ry * 0.55, cx + rx * 0.78, cy + ry * 0.55], 15, 165, fill=(24, 28, 52, 255), width=max(5, int(rx * 0.13)))
parp = capa(lienzo, mOjos)
parp.alpha_composite(dib)
parp.save(f'{OUT}/parpadeo.webp', quality=92)

# ── boca ──
zona = (xx > 190) & (xx < 305) & (yy > 282) & (yy < 385)
# interior: rojo oscuro y lengua rosa (el pico naranja tiene muy poco azul y es claro: no entra)
boca = zona & (((r - g > 60) & (g < 135) & ((b > 60) | (r < 170))) | ((r < 120) & (g < 80) & (b < 80))) & (al > 200)
from scipy import ndimage
lab, n = ndimage.label(boca)
if n: boca = lab == (np.bincount(lab.ravel())[1:].argmax() + 1)
boca = ndimage.binary_fill_holes(ndimage.binary_closing(boca, iterations=3))
boca = ndimage.binary_dilation(boca, iterations=2) & zona
pico = color_anillo(boca, 8)
cols = np.where(boca.any(0))[0]
arriba = {x: np.where(boca[:, x])[0].min() for x in cols}
abajo = {x: np.where(boca[:, x])[0].max() for x in cols}

def frame(frac):
    """frac = qué tanto queda abierta (0 cerrada, 1 original). El interior se aplasta hacia arriba."""
    rgb = A[..., :3].astype(float).copy()
    rgb[boca] = pico * 0.96
    for x in cols:
        t, bt = arriba[x], abajo[x]; alto = bt - t
        if frac <= 0 or alto < 3: continue
        nuevo = max(2, int(alto * frac))
        for k in range(nuevo):
            y = t + k; ys = t + int(k / max(nuevo - 1, 1) * alto)
            rgb[y, x] = A[ys, x, :3]
    img = capa(rgb, boca)
    if frac <= 0:  # labio: línea de sonrisa siguiendo el borde de arriba
        d = ImageDraw.Draw(img)
        xs = np.array(cols); k = np.polyfit(xs, [arriba[x] for x in cols], 2)
        pts = [(float(x), float(np.polyval(k, x)) + 3) for x in np.linspace(xs.min() + 4, xs.max() - 4, 40)]
        d.line(pts, fill=(176, 92, 22, 230), width=4, joint='curve')
    return img

frame(0).save(f'{OUT}/boca-1.webp', quality=92)
frame(0.45).save(f'{OUT}/boca-2.webp', quality=92)
src.save(f'{OUT}/cabeza.webp', quality=92)
# vista de revisión: base, boca cerrada, media, parpadeo
prev = Image.new('RGBA', (W * 4, H), (30, 60, 160, 255))
for i, extra in enumerate([None, 'boca-1', 'boca-2', 'parpadeo']):
    t = src.copy()
    if extra: t.alpha_composite(Image.open(f'{OUT}/{extra}.webp').convert('RGBA'))
    prev.alpha_composite(t, (W * i, 0))
prev.convert('RGB').save(f'{OUT}/_revision.jpg', quality=85)
print('ok', W, H)
