"""Descarga desde BigQuery de Baumsystem las mediciones de la temporada y los bloques de Ag. Garcés."""
import json, sys, datetime, decimal
from google.cloud import bigquery

PROYECTO = 'baumapp-prod'
EMPRESA = '186d5686-54ec-413c-88fd-ca61d65d23df'  # 039- Ag. G.F
DESDE = '2026-07-01'

SQL_MEDICIONES = f"""
WITH a AS (SELECT id,name,parentId FROM `baumapp-prod.baumsystem_legacy.asset` WHERE companyId='{EMPRESA}')
SELECT m.id, m.assetId, mt.name tipo, FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S',m.date) date_raw, FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S',m.createdAt) created_raw,
 m.value, m.latitude lat, m.longitude lon, IF(m.image IS NULL OR m.image='',0,1) foto, REGEXP_REPLACE(IFNULL(m.comment,''),r'\\s+',' ') comment,
 SUBSTR(IFNULL(m.createdUserId,''),1,8) usr, amt.optimalMinValue mn, amt.optimalValue op, amt.optimalMaxValue mx,
 bo.name campo, m.branchOfficeId campoId, x.name activo, x.parentId bloqueId, p1.name bloque, p2.name sector, p3.name equipo
FROM `baumapp-prod.baumsystem_legacy.meter_latest` m JOIN `baumapp-prod.baumsystem_legacy.metertype` mt ON mt.id=m.meterTypeId
JOIN `baumapp-prod.baumsystem_legacy.branchoffice` bo ON bo.id=m.branchOfficeId
LEFT JOIN `baumapp-prod.baumsystem_legacy.assetmetertype` amt ON amt.assetId=m.assetId AND amt.meterTypeId=m.meterTypeId
LEFT JOIN a x ON x.id=m.assetId LEFT JOIN a p1 ON p1.id=x.parentId LEFT JOIN a p2 ON p2.id=p1.parentId LEFT JOIN a p3 ON p3.id=p2.parentId
WHERE m.companyId='{EMPRESA}' AND mt.name IN ('PRESION VALVULA','PRESIÓN COLA','AFORO EMISOR') AND m.date >= TIMESTAMP('{DESDE}') ORDER BY m.date
"""

SQL_BLOQUES = f"""
WITH a AS (SELECT * FROM `baumapp-prod.baumsystem_legacy.asset` WHERE companyId='{EMPRESA}')
SELECT b.id bloqueId, b.name bloque, s.name sector, e.name equipo, bo.name campo, b.branchOfficeId campoId, v.name valvula, v.latitude lat, v.longitude lon, b.active
FROM a b JOIN a s ON s.id=b.parentId JOIN a e ON e.id=s.parentId JOIN `baumapp-prod.baumsystem_legacy.branchoffice` bo ON bo.id=b.branchOfficeId
LEFT JOIN a v ON v.parentId=b.id AND STARTS_WITH(UPPER(v.name),'VALV')
WHERE STARTS_WITH(UPPER(b.name),'BLOQUE') AND STARTS_WITH(UPPER(s.name),'SECTOR') AND STARTS_WITH(UPPER(e.name),'EQUIPO')
"""

def _val(v):
    if isinstance(v, decimal.Decimal): return float(v)
    if isinstance(v, (datetime.date, datetime.datetime)): return v.isoformat()
    return v

def descargar(sql, destino):
    cli = bigquery.Client(project=PROYECTO)
    filas = [{k: _val(v) for k, v in dict(r).items()} for r in cli.query(sql).result()]
    json.dump(filas, open(destino, 'w'), ensure_ascii=False)
    print(destino, len(filas))

if __name__ == '__main__':
    d = sys.argv[1]
    descargar(SQL_MEDICIONES, f'{d}/meter.json')
    descargar(SQL_BLOQUES, f'{d}/blocks.json')
