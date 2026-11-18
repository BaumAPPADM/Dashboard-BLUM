-- Consultas del informe de Ag. Los Gomeros (053- Ag. Los Gomeros, campo 01- Los Arroyos).
-- Se corren con la herramienta de Baumsystem del computador de blum (consultar_baumsystem).
-- Empresa: d9c5c4f2-635e-4a5e-af8a-f38350a64906 · Temporada desde 2026-07-01.

-- 1) MEDICIONES → guardar la respuesta completa como meter.json (la columna j es un arreglo JSON).
WITH a AS (SELECT id,name,parentId FROM `baumapp-prod.baumsystem_legacy.asset` WHERE companyId='d9c5c4f2-635e-4a5e-af8a-f38350a64906')
SELECT TO_JSON_STRING(ARRAY_AGG(STRUCT(m.id, m.assetId, mt.name AS tipo, FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S',m.date) AS date_raw, FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S',m.createdAt) AS created_raw,
 m.value, m.latitude AS lat, m.longitude AS lon, IF(m.image IS NULL OR m.image='',0,1) AS foto, REGEXP_REPLACE(IFNULL(m.comment,''),r'\s+',' ') AS comment,
 SUBSTR(IFNULL(m.createdUserId,''),1,8) AS usr, amt.optimalMinValue AS mn, amt.optimalValue AS op, amt.optimalMaxValue AS mx,
 bo.name AS campo, m.branchOfficeId AS campoId, x.name AS activo, x.parentId AS bloqueId, p1.name AS bloque, p2.name AS sector, p3.name AS equipo) ORDER BY m.date)) j
FROM `baumapp-prod.baumsystem_legacy.meter_latest` m JOIN `baumapp-prod.baumsystem_legacy.metertype` mt ON mt.id=m.meterTypeId
JOIN `baumapp-prod.baumsystem_legacy.branchoffice` bo ON bo.id=m.branchOfficeId
LEFT JOIN `baumapp-prod.baumsystem_legacy.assetmetertype` amt ON amt.assetId=m.assetId AND amt.meterTypeId=m.meterTypeId
LEFT JOIN a x ON x.id=m.assetId LEFT JOIN a p1 ON p1.id=x.parentId LEFT JOIN a p2 ON p2.id=p1.parentId LEFT JOIN a p3 ON p3.id=p2.parentId
WHERE m.companyId='d9c5c4f2-635e-4a5e-af8a-f38350a64906' AND m.date >= TIMESTAMP('2026-07-01');

-- 2) BLOQUES Y COORDENADAS DE VÁLVULA → guardar la respuesta como blocks.txt (id|equipo|sector|bloque|lat|lon separados por ;).
WITH a AS (SELECT * FROM `baumapp-prod.baumsystem_legacy.asset` WHERE companyId='d9c5c4f2-635e-4a5e-af8a-f38350a64906')
SELECT STRING_AGG(CONCAT(b.id,'|',TRIM(e.name),'|',TRIM(s.name),'|',TRIM(b.name),'|',IFNULL(CAST(ROUND(v.latitude,6) AS STRING),''),'|',IFNULL(CAST(ROUND(v.longitude,6) AS STRING),'')),';') j
FROM a b JOIN a s ON s.id=b.parentId JOIN a e ON e.id=s.parentId
LEFT JOIN a v ON v.parentId=b.id AND STARTS_WITH(UPPER(v.name),'VALV')
WHERE STARTS_WITH(UPPER(b.name),'BLOQUE') AND STARTS_WITH(UPPER(s.name),'SECTOR') AND STARTS_WITH(UPPER(e.name),'EQUIPO');
