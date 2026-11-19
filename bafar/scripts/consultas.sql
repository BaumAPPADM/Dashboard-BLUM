-- Consultas a BigQuery de Baumsystem (baumapp-prod.baumsystem_legacy) para el informe de Ag. Bafar.
-- Empresa: 037- Ag. Bafar · id 4eddc2ce-aa08-4e77-8597-29074f85a0db
-- Campos: 01- Agua Caliente MX, 02.1- San Antonio MX 2.0, 03- Encino MX («02- San Antonio MX» no aplica: no tiene mediciones).
-- Cada consulta devuelve texto compacto; se guarda tal cual en la carpeta de trabajo con el nombre indicado.
-- Se corren con la herramienta de Baumsystem del computador de Berni (consultar_baumsystem).

-- 1) sectores.txt  (una sola celda; registros separados por ~)
WITH a AS (SELECT * FROM `baumapp-prod.baumsystem_legacy.asset` WHERE companyId='4eddc2ce-aa08-4e77-8597-29074f85a0db'),
bo AS (SELECT id, name, CASE WHEN STARTS_WITH(name,'01') THEN 1 WHEN STARTS_WITH(name,'02.1') THEN 2 WHEN STARTS_WITH(name,'03') THEN 3 END c FROM `baumapp-prod.baumsystem_legacy.branchoffice` WHERE companyId='4eddc2ce-aa08-4e77-8597-29074f85a0db'),
s AS (SELECT s.id, bo.c, e.name eq, s.name sec, s.surface sup FROM a s JOIN a e ON e.id=s.parentId JOIN bo ON bo.id=s.branchOfficeId WHERE bo.c IS NOT NULL AND STARTS_WITH(UPPER(s.name),'SECTOR') AND (STARTS_WITH(UPPER(e.name),'EQUIPO') OR STARTS_WITH(UPPER(e.name),'CIRCUITO')))
SELECT STRING_AGG(FORMAT('%s|%d|%s|%s|%s', SUBSTR(id,1,8), c, TRIM(eq), TRIM(sec), IFNULL(CAST(sup AS STRING),'')), '~' ORDER BY c, eq, sec) sectores FROM s;

-- 2) bloques.txt  (una fila por sector: sector=bloque,número,lat,lon[,x si está inactivo];...)
WITH a AS (SELECT * FROM `baumapp-prod.baumsystem_legacy.asset` WHERE companyId='4eddc2ce-aa08-4e77-8597-29074f85a0db'),
bo AS (SELECT id FROM `baumapp-prod.baumsystem_legacy.branchoffice` WHERE companyId='4eddc2ce-aa08-4e77-8597-29074f85a0db' AND (STARTS_WITH(name,'01') OR STARTS_WITH(name,'02.1') OR STARTS_WITH(name,'03'))),
s AS (SELECT s.id FROM a s JOIN a e ON e.id=s.parentId JOIN bo ON bo.id=s.branchOfficeId WHERE STARTS_WITH(UPPER(s.name),'SECTOR') AND (STARTS_WITH(UPPER(e.name),'EQUIPO') OR STARTS_WITH(UPPER(e.name),'CIRCUITO'))),
v AS (SELECT parentId, ANY_VALUE(ROUND(latitude,5)) la, ANY_VALUE(ROUND(longitude,5)) lo FROM a WHERE STARTS_WITH(UPPER(name),'VALV') AND latitude IS NOT NULL AND latitude<>0 GROUP BY 1),
b AS (SELECT b.id, b.parentId sid, REGEXP_REPLACE(UPPER(TRIM(b.name)),r'^BLOQUE\s*','') bn, b.active, v.la, v.lo FROM a b JOIN s ON s.id=b.parentId LEFT JOIN v ON v.parentId=b.id WHERE STARTS_WITH(UPPER(b.name),'BLOQUE'))
SELECT CONCAT(SUBSTR(sid,1,8),'=',STRING_AGG(FORMAT('%s,%s,%s,%s%s', SUBSTR(id,1,8), bn, IFNULL(CAST(la AS STRING),''), IFNULL(CAST(lo AS STRING),''), IF(active=0,',x','')), ';' ORDER BY bn)) r FROM b GROUP BY sid ORDER BY 1;

-- 3) lecturas.txt  (manuales: válvula V, cola C, aforo A; una fila por bloque)
--    tipo,MMDDhhmm,valor,mín/ópt/máx,lat,lon,usuario(2),foto,comentario
WITH x AS (SELECT id, parentId FROM `baumapp-prod.baumsystem_legacy.asset` WHERE companyId='4eddc2ce-aa08-4e77-8597-29074f85a0db'),
m AS (SELECT m.*, mt.name tipo FROM `baumapp-prod.baumsystem_legacy.meter_latest` m JOIN `baumapp-prod.baumsystem_legacy.metertype` mt ON mt.id=m.meterTypeId WHERE m.companyId='4eddc2ce-aa08-4e77-8597-29074f85a0db' AND m.date>=TIMESTAMP('2026-07-01') AND m.manual=1 AND mt.name IN ('PRESION VALVULA','PRESIÓN COLA','AFORO EMISOR'))
SELECT CONCAT(SUBSTR(x.parentId,1,8),'=',STRING_AGG(FORMAT('%s,%s,%s,%s,%s,%s,%s,%s,%s', CASE m.tipo WHEN 'PRESION VALVULA' THEN 'V' WHEN 'PRESIÓN COLA' THEN 'C' ELSE 'A' END, FORMAT_TIMESTAMP('%m%d%H%M',m.date), CAST(ROUND(m.value,2) AS STRING),
 IFNULL(FORMAT('%g/%g/%g', CAST(amt.optimalMinValue AS FLOAT64), CAST(amt.optimalValue AS FLOAT64), CAST(amt.optimalMaxValue AS FLOAT64)),''),
 IF(m.tipo='PRESION VALVULA' OR m.latitude IS NULL OR m.latitude=0,'',CAST(ROUND(m.latitude,5) AS STRING)), IF(m.tipo='PRESION VALVULA' OR m.latitude IS NULL OR m.latitude=0,'',CAST(ROUND(m.longitude,5) AS STRING)), SUBSTR(m.createdUserId,1,2), IF(m.image IS NULL OR m.image='','','f'), REGEXP_REPLACE(TRIM(IFNULL(m.comment,'')),r'[;,=\s]+',' ')), ';' ORDER BY m.date)) r
FROM m JOIN x ON x.id=m.assetId LEFT JOIN `baumapp-prod.baumsystem_legacy.assetmetertype` amt ON amt.assetId=m.assetId AND amt.meterTypeId=m.meterTypeId
GROUP BY x.parentId ORDER BY 1;

-- 4) caudal_api.txt  (Wiseconn, manual=0: caudal instantáneo por caudalímetro, sector y día)
--    día,lecturas,lecturas>0,mediana>0,máx,mín>0
WITH q AS (SELECT m.assetId, m.assetSectorId, m.date, m.value FROM `baumapp-prod.baumsystem_legacy.meter_latest` m JOIN `baumapp-prod.baumsystem_legacy.metertype` mt ON mt.id=m.meterTypeId WHERE m.companyId='4eddc2ce-aa08-4e77-8597-29074f85a0db' AND m.date>=TIMESTAMP('2026-07-01') AND m.manual=0 AND mt.name='CAUDAL INSTANTANEO'),
d AS (SELECT assetId, assetSectorId, FORMAT_TIMESTAMP('%m%d',date) dia, COUNT(*) n, COUNTIF(value>0) np, APPROX_QUANTILES(IF(value>0,value,NULL),2)[OFFSET(1)] med, MAX(value) mx, MIN(IF(value>0,value,NULL)) mnp FROM q GROUP BY 1,2,3)
SELECT CONCAT(SUBSTR(d.assetId,1,8),'|',SUBSTR(IFNULL(d.assetSectorId,'-'),1,8),'|',a.name,'=',STRING_AGG(FORMAT('%s,%d,%d,%s,%s,%s',dia,n,np,IFNULL(CAST(ROUND(med,1) AS STRING),''),CAST(ROUND(mx,1) AS STRING),IFNULL(CAST(ROUND(mnp,1) AS STRING),'')),';' ORDER BY dia)) r
FROM d JOIN `baumapp-prod.baumsystem_legacy.asset` a ON a.id=d.assetId GROUP BY d.assetId, d.assetSectorId, a.name ORDER BY 1;

-- 5) presion_api.txt  (Wiseconn, manual=0: presión en el cabezal; una sola celda)
SELECT STRING_AGG(FORMAT('%s|%s|%s|%s', SUBSTR(m.assetId,1,8), SUBSTR(IFNULL(m.assetSectorId,'-'),1,8), FORMAT_TIMESTAMP('%m%d%H%M',m.date), CAST(ROUND(m.value,2) AS STRING)), ';' ORDER BY m.date) r
FROM `baumapp-prod.baumsystem_legacy.meter_latest` m JOIN `baumapp-prod.baumsystem_legacy.metertype` mt ON mt.id=m.meterTypeId
WHERE m.companyId='4eddc2ce-aa08-4e77-8597-29074f85a0db' AND m.date>=TIMESTAMP('2026-07-01') AND m.manual=0 AND mt.name='PRESION VALVULA';

-- 6) Control: caudal de diseño por sector cargado en blum (si cambia, actualizar DISENO en pipeline.py)
SELECT SUBSTR(q.assetSectorId,1,8) sector, amt.optimalMinValue mn, amt.optimalValue op, amt.optimalMaxValue mx
FROM (SELECT DISTINCT assetId, assetSectorId, meterTypeId FROM `baumapp-prod.baumsystem_legacy.meter_latest` WHERE companyId='4eddc2ce-aa08-4e77-8597-29074f85a0db' AND manual=0 AND date>=TIMESTAMP('2026-07-01')) q
JOIN `baumapp-prod.baumsystem_legacy.metertype` mt ON mt.id=q.meterTypeId AND mt.name='CAUDAL INSTANTANEO'
LEFT JOIN `baumapp-prod.baumsystem_legacy.assetmetertype` amt ON amt.assetId=q.assetId AND amt.meterTypeId=q.meterTypeId AND IFNULL(amt.assetSectorId,'')=IFNULL(q.assetSectorId,'')
ORDER BY 1;
