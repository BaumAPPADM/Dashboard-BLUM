"""Actualización completa: BigQuery → limpieza y cálculo → informe cifrado."""
import json, os, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..')
user, pw = os.environ.get('REPORT_USER', 'Ag. Garcés'), os.environ['REPORT_PASSWORD']
work = tempfile.mkdtemp()
run = lambda *a, **k: subprocess.run([sys.executable, *a], check=True, **k)
run(os.path.join(HERE, 'fetch_bq.py'), work)
run(os.path.join(HERE, 'pipeline.py'), cwd=work)
# El calendario de Garcés ya no se usa: la evaluación es la meta semanal (5 bloques por campo con protocolo completo).
run(os.path.join(HERE, 'build.py'), work, ROOT)
