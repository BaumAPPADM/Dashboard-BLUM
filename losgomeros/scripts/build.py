"""Arma el informe de Ag. Los Gomeros (página, estilos, script y datos), lo comprime y lo cifra en reporte.enc.json.

Uso: REPORT_PASSWORD=… python build.py <carpeta con datos.json> <carpeta de salida>
La clave solo se pasa por variable de entorno: nunca se escribe en el repositorio.
"""
import json, gzip, sys, os, datetime
from crypto_util import encrypt

R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'report')
def rd(n): return open(os.path.join(R, n), encoding='utf-8').read()

def build(work, out_dir, user, password, actualizado):
    payload = {
        'html': rd('body.html'),
        'css': rd('tokens.css') + rd('fonts.css') + rd('ref.css') + rd('extra.css') + rd('gomeros.css'),
        'shim': rd('shim.js'),
        'scripts': [rd('app.js')],
        'data': json.load(open(os.path.join(work, 'datos.json'), encoding='utf-8')),
        'params': {'vista': 'plan', 'actualizado': actualizado, 'mapaEq': None},
    }
    raw = gzip.compress(json.dumps(payload, ensure_ascii=False).encode('utf-8'), 9)
    enc = encrypt(raw, user, password); enc['actualizado'] = actualizado
    os.makedirs(out_dir, exist_ok=True)
    json.dump(enc, open(os.path.join(out_dir, 'reporte.enc.json'), 'w'))
    shell = rd('shell.html').replace('/*LOGO_CSS*/', rd('logo.css'))
    shell = shell.replace('<b>Calendario y plan de acción</b>Avance de las mediciones y qué hacer en cada bloque.', '<b>Mapa de aforos y plan de acción</b>Dónde se midió y qué hacer en cada bloque.')
    open(os.path.join(out_dir, 'index.html'), 'w', encoding='utf-8').write(shell)
    print('informe', len(raw), 'bytes comprimidos →', out_dir)

if __name__ == '__main__':
    work, out_dir = sys.argv[1], sys.argv[2]
    ahora = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3))).strftime('%d-%m-%Y %H:%M')
    build(work, out_dir, os.environ.get('REPORT_USER', 'Ag. Los Gomeros'), os.environ['REPORT_PASSWORD'], os.environ.get('ACTUALIZADO', ahora + ' (hora de Chile)'))
