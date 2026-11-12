"""Recorta los monitos (quita el fondo rosa), los pone a la misma escala y los guarda para la Oficina.
Cada personaje: sus poses en un mismo lienzo (así no brincan al cambiar de pose) + 'acostado' (cuarto gris).
Salida: moon-digital-web/oficina/monitos/<n>_<pose>.webp y monitos.json (ancho, alto y dónde caen los pies)."""
import json, os, glob
import numpy as np
from PIL import Image, ImageOps, ImageEnhance
from scipy import ndimage as nd
S = '/home/claude/taller-monitos/salida/'; OUT = '/home/claude/moon-digital-web/oficina/monitos/'; os.makedirs(OUT, exist_ok=True)
ALTO = 200   # px del monito parado en la imagen (en pantalla se ve a lo más a ~160 px: queda nítido)
def recorte(f):
    a = np.asarray(Image.open(f).convert('RGB')).astype(int)
    d = np.abs(a - [249, 46, 154]).sum(2); m = d > 150
    m = nd.binary_opening(m, iterations=2); lab, n = nd.label(m)
    if not n: return None
    s = nd.sum(m, lab, range(1, n + 1)); m = lab == (1 + int(np.argmax(s))); m = nd.binary_fill_holes(m)
    al = (nd.gaussian_filter(m.astype(float), 0.8) * 255).clip(0, 255)
    return np.dstack([a, al]).astype('uint8'), m
meta = json.load(open(OUT + 'monitos.json')) if os.path.exists(OUT + 'monitos.json') else {}
nombres = sorted({os.path.basename(f).split('_reposo_f')[0] for f in glob.glob(S + '*_reposo_f.png')})
for n in nombres:
    poses = {}
    for f in glob.glob(S + n + '_*_f.png'):
        p = os.path.basename(f)[len(n) + 1:-6]
        r = recorte(f)
        if r: poses[p] = r
    ys, xs = np.where(np.any([m for _, m in poses.values()], axis=0))
    y0, y1, x0, x1 = ys.min() - 2, ys.max() + 3, xs.min() - 2, xs.max() + 3
    ry, rx = np.where(poses['reposo'][1]); alto = ry.max() - ry.min()
    k = ALTO / alto; W, H = round((x1 - x0) * k), round((y1 - y0) * k)
    pie_x, pie_y = (rx[ry > ry.max() - 8].mean() - x0) * k, (ry.max() - y0) * k
    for p, (img, m) in poses.items():
        im = Image.fromarray(img[y0:y1, x0:x1], 'RGBA').resize((W, H), Image.LANCZOS)
        im.save(OUT + f'{n}_{p}.webp', quality=82, method=6)
        if p == 'reposo':   # acostado en el piso, sin color (cuarto gris): el mismo monito girado
            g = ImageOps.grayscale(im.convert('RGB')).convert('RGB'); g = g.point(lambda v: int(120 + v * 0.45))
            g.putalpha(im.getchannel('A')); g = g.rotate(80, expand=True, resample=Image.BICUBIC)
            bb = g.getbbox(); g = g.crop(bb); g.save(OUT + f'{n}_acostado.webp', quality=80, method=6)
            meta.setdefault(n, {})['acostado'] = [g.width, g.height]
    meta.setdefault(n, {}).update(w=W, h=H, px=round(pie_x, 1), py=round(pie_y, 1), poses=sorted(poses))
    print(n, W, H, sorted(poses))
json.dump(meta, open(OUT + 'monitos.json', 'w'), indent=0)
tot = sum(os.path.getsize(f) for f in glob.glob(OUT + '*.webp')); print('peso total', round(tot / 1024), 'KB en', len(glob.glob(OUT + '*.webp')), 'imágenes')
