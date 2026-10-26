"""Revisa que cada idioma tenga TODO lo del español, con los mismos huecos. Uso: python3 herramientas/idiomas/revisar.py [idioma…]
Detiene (sale con 1) si a un idioma le falta una clave, le sobra, cambió un {hueco}, perdió una etiqueta HTML o un [resaltado] de título."""
import re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
import dic

def huecos(t): return sorted(re.findall(r'\{\w+\}', t))
def etiquetas(t): return sorted(re.findall(r'</?(?:b|small|span|i)\b[^>]*>', t))
def corchetes(t): return len(re.findall(r'\[[^\]]+\]', t))

def textos(v): return list(v.values()) if isinstance(v, dict) else [v]

def revisar(lang):
    mal = []
    for largo in (False, True):
        if not os.path.exists(dic.ruta('es', largo)): continue
        es = dic.planos(dic.leer('es', largo))
        try: otro = dic.planos(dic.leer(lang, largo))
        except FileNotFoundError: return ['falta el archivo ' + os.path.basename(dic.ruta(lang, largo))]
        for k in es:
            if k not in otro: mal.append('falta ' + k); continue
            a, b = es[k], otro[k]
            if isinstance(a, dict):
                if not isinstance(b, dict) or 'other' not in b: mal.append(k + ': plural sin "other"'); continue
            for tb in textos(b):
                if not isinstance(tb, str) or not tb.strip(): mal.append(k + ': vacío'); continue
                ta = textos(a)[-1]
                if huecos(ta) != huecos(tb) and not (isinstance(a, dict) and set(huecos(tb)) <= set(huecos(ta))): mal.append(k + ': huecos ' + str(huecos(tb)) + ' ≠ ' + str(huecos(ta)))
                if etiquetas(ta) != etiquetas(tb): mal.append(k + ': etiquetas HTML cambiaron')
                if corchetes(ta) != corchetes(tb): mal.append(k + ': [corchetes] cambiaron')
        for k in otro:
            if k not in es: mal.append('sobra ' + k)
    return mal

if __name__ == '__main__':
    langs = sys.argv[1:] or [l for l in dic.IDIOMAS if l != 'es']
    total = 0
    for l in langs:
        m = revisar(l); total += len(m)
        print(('✅ ' if not m else '❌ ') + l + ('' if not m else ' (' + str(len(m)) + ')'))
        for x in m[:15]: print('   ', x)
    sys.exit(1 if total else 0)
