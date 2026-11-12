"""Monitos de la Oficina MOON, sacados del mismo modelo 3D de los monitos de Animación Kidviniflo.
Uso: python3 gen.py <w1|w2> <nombre> [<nombre> ...]   -> salida/<nombre>_<pose>.png (fondo rosa, acabado)"""
import json, os, sys, subprocess, shutil, time
import numpy as np
from PIL import Image
W = sys.argv[1]; D = f'/home/claude/taller-monitos/{W}/'; os.chdir(D)
SAL = '/home/claude/taller-monitos/salida/'; os.makedirs(SAL, exist_ok=True)
def lin(c): c = np.array(c) / 255.0; return ','.join('%.4f' % v for v in np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92))
# nombre: piel, pelo, playera, pantalón, tenis, fleco, pico, nuca, largo de pelo (monitas) o None
P = {
 'verde':    ((150,100,70),(30,24,22),(60,170,90),(110,80,50),(240,240,235),0.42,22,-0.62,None),
 'naranja':  ((245,215,190),(160,70,30),(230,120,30),(40,50,90),(240,240,235),0.55,12,-0.62,None),
 'mostaza':  ((100,65,45),(25,20,18),(215,175,40),(120,120,125),(30,30,32),0.40,30,-0.62,None),
 'morado':   ((205,155,115),(205,205,205),(120,80,190),(200,185,150),(110,80,50),0.62,16,-0.62,None),
 'blanco':   ((240,205,175),(90,55,30),(245,245,240),(40,80,50),(30,30,32),0.50,10,-1.0,None),
 'turquesa': ((165,115,80),(35,28,25),(40,170,170),(70,45,110),(240,240,235),0.48,18,-1.05,None),
 'coral':    ((240,200,170),(30,24,22),(240,110,80),(240,110,80),(240,240,235),0,0,0,-1.55),
 'menta':    ((150,100,70),(60,35,20),(120,200,160),(140,30,50),(240,240,235),0,0,0,-1.20),
 'amarilla': ((100,65,45),(25,20,18),(240,200,90),(240,200,90),(110,80,50),0,0,0,-1.65),
 'cielo':    ((205,155,115),(150,60,30),(120,180,230),(240,240,235),(30,30,32),0,0,0,-1.00),
 'rosa':     ((245,215,190),(180,120,60),(230,110,160),(230,110,160),(30,30,32),0,0,0,-1.40),
 'lila':     ((165,115,80),(30,24,22),(150,120,200),(240,240,235),(240,240,235),0,0,0,-1.30),
 # Jason: todo blanco
 'jason':    ((236,236,232),(214,214,210),(245,245,242),(228,228,224),(250,250,248),0.48,14,-0.62,None),
 # Claude: todo naranja, sin miedo (piel, pelo, ropa y tenis)
 'claude':   ((255,140,51),(214,90,10),(255,122,26),(240,110,20),(255,150,60),0.45,14,-0.62,None),
}
BASE = dict(SINOREJAS='1', PELO3D='1', OJOS='', MUESTRAS='4', MEZCLA='3', ESCALA='150', PASES='1', CARA_POST='1', INTERP='Linear',
            POSES='reposo,sentado,camina,camina_b', ANG='45', ELEV='30', MANGA_Y0='351', MANGA_Y1='357')
def receta(n):
    piel, pelo, pl, pa, te, fl, pi, nuca, largo = P[n]
    for src, dst in (('ropa_sola.png', f'ropa_o_{n}.png'), ('ropa_torso.png', f'ropat_o_{n}.png')):
        a = np.array(Image.open(src).convert('RGBA')).astype(int); r, g, b = a[..., 0], a[..., 1], a[..., 2]
        azul = (b > 140) & (r < 90); osc = (b > 100) & (r < 60) & ~azul; bla = (r > 225) & (g > 225) & (b > 215)
        piel_m = (r > 200) & (g > 160) & (b > 110) & (b < 220) & ~bla
        a[azul, :3] = pl; a[osc, :3] = (np.array(pl) * 0.75).astype(int); a[bla, :3] = pa
        a[piel_m, :3] = (a[piel_m, :3] * np.array(piel) / np.array([246, 209, 169])).clip(0, 255).astype(int)
        Image.fromarray(a.astype(np.uint8)).save(dst)
    p = np.array(Image.open('piel.png').convert('RGBA')).astype(float); p[..., :3] = (p[..., :3] * np.array(piel) / np.array([246, 209, 169])).clip(0, 255)
    Image.fromarray(p.astype(np.uint8)).save(f'piel_o_{n}.png')
    env = dict(PERSONAJE='monito_' + n, PIEL=f'piel_o_{n}.png', ROPA=f'ropa_o_{n}.png', ROPA_TORSO=f'ropat_o_{n}.png', PELO_COL=lin(pelo),
               MANGA_COL=lin(pl), DOB_COL=lin(tuple(int(v * 0.75) for v in pl)), PANT_COL=lin(pa), FRANJA_COL=lin(te),
               PIEL_LADO=lin(tuple(int(v * 0.94) for v in piel)), PIEL_BRAZO=lin(piel), TENIS_Y0='462', TENIS_Y1='480', CEJA=','.join(str(int(v)) for v in pelo))
    if largo is None: env.update(FLECO=str(fl), PICO=str(pi), NUCA=str(nuca))
    else: env.update(PERSONAJE='monita_' + n, FLECO='0.52', FLECO_LISO='1', LADO_A='55', LADO_B='110', NUCA='-1.05', PELO_LARGO3D='1', PELO_LARGO=str(largo), PELO_DESDE='60')
    return env
def correr(n):
    t = time.time()
    if n == 'kid':
        env = dict(SINOREJAS='1', PELO3D='1', PIEL='piel.png', OJOS='ojos_hd.png', CUELLO='cutkid_abertura.png', CUTKID3D='1', ROPA='ropa_sola.png',
                   ROPA_TORSO='ropa_torso.png', MUESTRAS='4', MEZCLA='3', ESCALA='150', PASES='1', INTERP='Linear', POSES=BASE['POSES'], ANG='45', ELEV='30')
        cara = None
    elif n == 'jesus':
        env = {**BASE, 'PERSONAJE': 'jesus', 'ELEV': '12', 'PELO3D': '1', 'JESUS3D': '1', 'PIEL': 'piel.png', 'PELO_COL': '0.10,0.045,0.015', 'FLECO': '0.52', 'FLECO_LISO': '1', 'NUCA': '-1.05', 'ROPA': 'ropa_jesus.png', 'ROPA_TORSO': 'ropa_jesus_torso.png',
               'POSES': 'reposo', 'MANGA_COL': lin((232, 219, 198)), 'DOB_COL': lin((200, 185, 165)), 'PANT_COL': lin((232, 219, 198)), 'CEJA': '62,36,18'}
        cara = 'jesus'
    else:
        env = {**BASE, **receta(n)}; cara = env['PERSONAJE']
    r = subprocess.run(['/home/claude/venv_bpy/bin/python', 'conejo_rig2.py'], env={**os.environ, **env}, capture_output=True, text=True)
    if r.returncode: print('FALLO', n, r.stderr[-800:], flush=True); return
    for pose in env['POSES'].split(','):
        b = SAL + f'{n}_{pose}'
        for s in ('', '_alb', '_luz', '_rui', '_id', '_uvc'):
            if os.path.exists(f'rig2_out/{pose}{s}.png'): shutil.copy(f'rig2_out/{pose}{s}.png', b + s + '.png')
        subprocess.run(['python3', 'pintura.py', b, b + '_p.png', 'fuerte'], check=True, capture_output=True)
        if cara:
            subprocess.run(['python3', 'cara.py', b + '_p.png', b, 'abiertos', b + '_c.png'], check=True, capture_output=True,
                           env={**os.environ, 'PERSONAJE': cara, 'CEJA_COL': env.get('CEJA', '30,24,22')})
            shutil.copy(b + '_id.png', b + '_c_id.png')
        else: shutil.copy(b + '_p.png', b + '_c.png'); shutil.copy(b + '_id.png', b + '_c_id.png')
        subprocess.run(['python3', 'contorno4.py', b + '_c.png', b + '_n.png'], check=True, capture_output=True,
                       env={**os.environ, 'CONTORNO': '28,26,34', 'GROSOR': '5', 'PIXEL': '1', 'FONDO': '249,46,154'})
        subprocess.run(['python3', 'acabado.py', b + '_n.png', b + '_f.png', '1.0', '4'], check=True, capture_output=True)
    print('listo', n, round(time.time() - t), 's', flush=True)
for n in sys.argv[2:]: correr(n)
