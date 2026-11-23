#!/usr/bin/env python3
"""ARCHIVERO · lector de Claude (Kid, 23-nov-2026).

Baja a esta máquina los archivos que el equipo subió al Archivero de la Oficina y saca lo que dicen, para que Claude
explique de quién es, qué es y para qué, sin pasar los archivos por la conversación ni gastar créditos de IA:
  - PDF → texto (pdftotext) · Word → texto · Excel → tablas · texto plano → tal cual
  - Audio (notas de voz de WhatsApp) → texto con Whisper en esta máquina
  - Video → texto de lo que se dice + 3 cuadros en imagen para mirarlos
  - Fotos → se dejan en la carpeta para que Claude las mire con Read

Uso:  ARCHIVERO_LLAVE=<llave> python3 herramientas/archivero-leer.py a-xxxxxxxxxxxx [a-yyyy…]
      (la llave vive en la base moon-crm, tabla claves_claude, nombre 'archivero'; nunca en este repositorio público)
      ARCHIVERO_URL cambia el servidor (pruebas locales).
Sale: /tmp/archivero/<id>/<archivo> y un resumen en pantalla por archivo (lo que leyó, recortado).
"""
import json, os, subprocess, sys, urllib.request

URL = os.environ.get('ARCHIVERO_URL', 'https://moondigitalia.com/api/archivero')
LLAVE = os.environ.get('ARCHIVERO_LLAVE', '')
CARPETA = '/tmp/archivero'
TOPE = 6000   # letras que se enseñan por archivo (lo demás queda en el .txt de al lado)


def pedir(q):
    r = urllib.request.Request(f'{URL}?{q}', headers={'x-llave': LLAVE})
    with urllib.request.urlopen(r, timeout=60) as x:
        return x.read()


def bajar(id_):
    info = json.loads(pedir(f'id={id_}'))
    nombre = os.path.basename(info.get('nombre') or id_).replace('/', '_') or id_
    d = os.path.join(CARPETA, id_); os.makedirs(d, exist_ok=True)
    ruta = os.path.join(d, nombre)
    if not (os.path.exists(ruta) and os.path.getsize(ruta) == info.get('tamano')):
        with open(ruta, 'wb') as f:
            for n in range(info['partes']):
                f.write(pedir(f'id={id_}&n={n}'))
    return info, ruta


def correr(c):
    return subprocess.run(c, capture_output=True, text=True, timeout=900).stdout


def a_texto_audio(ruta):
    from faster_whisper import WhisperModel   # se baja una vez de Hugging Face (~460 MB, modelo "small")
    import numpy as np
    m = WhisperModel('small', device='cpu', compute_type='int8')
    # ffmpeg decodifica cualquier audio (opus de WhatsApp, m4a de iPhone…) a 16 kHz mono; así no depende de otra librería
    crudo = subprocess.run(['ffmpeg', '-loglevel', 'quiet', '-i', ruta, '-f', 's16le', '-ac', '1', '-ar', '16000', '-'], capture_output=True, timeout=900).stdout
    sonido = np.frombuffer(crudo, np.int16).astype(np.float32) / 32768.0
    partes, info = m.transcribe(sonido, language=None, vad_filter=True)
    return f'[idioma: {info.language} · {round(info.duration)} s]\n' + ' '.join(p.text.strip() for p in partes)


def leer(ruta, mime):
    ext = os.path.splitext(ruta)[1].lower(); mime = mime or ''
    if ext == '.pdf' or mime == 'application/pdf':
        return correr(['pdftotext', '-layout', ruta, '-'])
    if ext == '.docx':
        import docx
        doc = docx.Document(ruta)
        return '\n'.join(p.text for p in doc.paragraphs) + '\n' + '\n'.join(' | '.join(c.text for c in r.cells) for t in doc.tables for r in t.rows)
    if ext in ('.xlsx', '.xlsm'):
        import openpyxl
        wb = openpyxl.load_workbook(ruta, data_only=True, read_only=True); s = []
        for h in wb.worksheets:
            s.append(f'## Hoja: {h.title}')
            for fila in h.iter_rows(values_only=True):
                if any(v is not None for v in fila): s.append(' | '.join('' if v is None else str(v) for v in fila))
        return '\n'.join(s)
    if ext in ('.csv', '.txt', '.md', '.json') or mime.startswith('text/'):
        return open(ruta, encoding='utf-8', errors='replace').read()
    if mime.startswith('audio/') or ext in ('.ogg', '.opus', '.mp3', '.m4a', '.wav', '.aac', '.amr'):
        return a_texto_audio(ruta)
    if mime.startswith('video/') or ext in ('.mp4', '.mov', '.3gp', '.webm', '.mkv'):
        d = os.path.dirname(ruta)
        dur = float(correr(['ffprobe', '-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', ruta]) or 0)
        for i, t in enumerate([dur * 0.1, dur * 0.5, dur * 0.9]):
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'quiet', '-ss', str(t), '-i', ruta, '-frames:v', '1', '-vf', 'scale=720:-2', os.path.join(d, f'cuadro-{i + 1}.jpg')])
        tiene_audio = 'audio' in correr(['ffprobe', '-v', 'quiet', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', ruta])
        habla = a_texto_audio(ruta) if tiene_audio else '(sin audio)'
        return f'[video de {round(dur)} s · cuadros para mirar: {d}/cuadro-1..3.jpg]\n{habla}'
    if mime.startswith('image/') or ext in ('.jpg', '.jpeg', '.png', '.webp', '.heic', '.gif'):
        if ext == '.heic':   # las fotos de iPhone: se pasan a jpg para poder mirarlas
            jpg = ruta + '.jpg'; subprocess.run(['ffmpeg', '-y', '-loglevel', 'quiet', '-i', ruta, jpg]); ruta = jpg
        return f'[imagen: mírala con Read → {ruta}]'
    return f'[formato que no sé leer todavía ({ext or mime}): queda en {ruta}]'


if __name__ == '__main__':
    if not LLAVE: sys.exit('Falta ARCHIVERO_LLAVE (base moon-crm, tabla claves_claude).')
    for id_ in sys.argv[1:]:
        try:
            info, ruta = bajar(id_)
            texto = (leer(ruta, info.get('mime')) or '').strip() or '(vacío)'
            open(ruta + '.leido.txt', 'w').write(texto)
            print(f'\n===== {id_} · {info.get("titulo")} · {info.get("nombre")} ({info.get("mime")}, {info.get("tamano")} bytes)')
            print(texto[:TOPE] + (f'\n… (sigue en {ruta}.leido.txt)' if len(texto) > TOPE else ''))
        except Exception as e:
            print(f'\n===== {id_} · NO SE PUDO LEER: {e}')
