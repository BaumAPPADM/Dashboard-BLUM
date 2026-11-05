"""Arma el informe completo (página, estilos, scripts y datos), lo comprime y lo cifra en reporte.enc.json."""
import json, gzip, sys, os, datetime
from crypto_util import encrypt

R = os.path.join(os.path.dirname(__file__), '..', 'report')
def rd(n): return open(os.path.join(R, n), encoding='utf-8').read()

def build(work, out_dir, user, password, actualizado):
    payload = {
        'html': rd('body.html'),
        'css': rd('tokens.css') + rd('fonts.css') + rd('ref.css') + rd('extra.css'),
        'shim': rd('shim.js'),
        'scripts': [rd('draws.js'), rd('calcs.js'), rd('charts.js'), rd('tables.js')],
        'data': {k: json.load(open(os.path.join(work, f))) for k, f in [('lecturas', 'lecturas_garces.json'), ('bloques', 'bloques_garces.json'), ('plan', 'plan_garces.json')]},
        'params': {'vista': 'campos', 'campo': '01 · Almahue', 'equipo': None, 'tipo': None, 'estado': None, 'alcance': None, 'prio': None, 'planCampo': None, 'planEstado': None, 'mapaEq': None},
    }
    raw = gzip.compress(json.dumps(payload, ensure_ascii=False).encode('utf-8'), 9)
    enc = encrypt(raw, user, password); enc['actualizado'] = actualizado
    json.dump(enc, open(os.path.join(out_dir, 'reporte.enc.json'), 'w'))
    shell = rd('shell.html').replace('/*LOGO_CSS*/', rd('logo.css'))
    open(os.path.join(out_dir, 'index.html'), 'w', encoding='utf-8').write(shell)
    print('informe', len(raw), 'bytes comprimidos')

if __name__ == '__main__':
    work, out_dir = sys.argv[1], sys.argv[2]
    ahora = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3))).strftime('%d-%m-%Y %H:%M')
    build(work, out_dir, os.environ.get('REPORT_USER', 'Ag. Garcés'), os.environ['REPORT_PASSWORD'], os.environ.get('ACTUALIZADO', ahora + ' (hora de Chile)'))
