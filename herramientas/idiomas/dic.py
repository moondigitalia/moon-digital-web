"""Leer y escribir los diccionarios de idiomas (web/idiomas/<idioma>.js y <idioma>-largo.js).
Formato fijo: 1a línea abre, en medio JSON puro, última línea cierra. Así el navegador lo usa directo y las herramientas lo leen como JSON."""
import json, os
RAIZ = os.path.join(os.path.dirname(__file__), '..', '..', 'idiomas')
IDIOMAS = ['es', 'en', 'pt', 'fr', 'de', 'it', 'nl', 'pl', 'tr', 'ru', 'uk', 'ar', 'hi', 'bn', 'id', 'vi', 'th', 'ja', 'ko', 'zh', 'zh-TW']
NOMBRES = {'es': 'español', 'en': 'inglés', 'pt': 'portugués (Brasil)', 'fr': 'francés', 'de': 'alemán', 'it': 'italiano', 'nl': 'neerlandés',
           'pl': 'polaco', 'tr': 'turco', 'ru': 'ruso', 'uk': 'ucraniano', 'ar': 'árabe', 'hi': 'hindi', 'bn': 'bengalí', 'id': 'indonesio',
           'vi': 'vietnamita', 'th': 'tailandés', 'ja': 'japonés', 'ko': 'coreano', 'zh': 'chino simplificado', 'zh-TW': 'chino tradicional (Taiwán)'}
ABRE = '(function(d,k){d[k]=Object.assign(d[k]||{},'
CIERRA = ');})(window.KVI_DICS=window.KVI_DICS||{},"%s");'

def ruta(lang, largo=False):
    return os.path.join(RAIZ, lang + ('-largo' if largo else '') + '.js')

def leer(lang, largo=False):
    with open(ruta(lang, largo), encoding='utf-8') as f:
        lineas = f.read().strip().split('\n')
    return json.loads('\n'.join(lineas[1:-1]))

def escribir(lang, datos, largo=False):
    with open(ruta(lang, largo), 'w', encoding='utf-8') as f:
        f.write(ABRE + '\n' + json.dumps(datos, ensure_ascii=False, indent=1) + '\n' + CIERRA % lang + '\n')

def planos(d, pre=''):
    """{'kd':{'t':{'nombre':'x'}}} → {'kd.t.nombre':'x'} (los plurales {one,other} cuentan como una hoja)"""
    out = {}
    for k, v in d.items():
        c = pre + k
        if isinstance(v, dict) and not ({'other'} <= set(v) and set(v) <= {'zero', 'one', 'two', 'few', 'many', 'other'}):
            out.update(planos(v, c + '.'))
        else:
            out[c] = v
    return out
