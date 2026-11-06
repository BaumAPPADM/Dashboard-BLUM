"""Actualización completa: BigQuery → limpieza y cálculo → cruce con el calendario → informe cifrado."""
import json, os, subprocess, sys, tempfile
from crypto_util import decrypt
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..')
user, pw = os.environ.get('REPORT_USER', 'Ag. Garcés'), os.environ['REPORT_PASSWORD']
work = tempfile.mkdtemp()
run = lambda *a, **k: subprocess.run([sys.executable, *a], check=True, **k)
run(os.path.join(HERE, 'fetch_bq.py'), work)
run(os.path.join(HERE, 'pipeline.py'), cwd=work)
plan = json.loads(decrypt(json.load(open(os.path.join(ROOT, 'plan', 'calendario.enc.json'))), user, pw))
json.dump(plan, open(os.path.join(work, 'plan.json'), 'w'), ensure_ascii=False)
run(os.path.join(HERE, 'plan_match.py'), work, os.path.join(work, 'plan.json'))
run(os.path.join(HERE, 'build.py'), work, ROOT)
