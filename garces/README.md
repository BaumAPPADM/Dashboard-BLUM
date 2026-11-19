# Informe de riego · Ag. Garcés (blum)

Página con el informe de presiones, aforos y meta semanal de mediciones (5 bloques por campo con protocolo completo: 24 aforos, 1 presión de válvula y 2 colas) de Ag. Garcés, temporada 2026-27.

- Se abre en el link de GitHub Pages de este repositorio.
- Pide **usuario** (`Ag. Garcés`) y **clave**. Todo el informe y sus datos están cifrados: sin la clave no se puede leer nada, ni siquiera mirando los archivos del repositorio.
- Evalúa los últimos 2 meses hasta la última medición (`MESES_VENTANA` en scripts/build.py) y muestra el período en la portada y en el informe.
- Se actualiza todos los viernes y cuando el cliente lo pide: Claude consulta Baumsystem, recalcula y publica (ver «Actualizar a pedido»). El workflow de GitHub queda disponible para correrlo a mano si algún día se cargan las credenciales GCP_SA_KEY y REPORT_PASSWORD.

## Configuración (una sola vez, desde el navegador)

1. **Settings → Secrets and variables → Actions → New repository secret**
   - `GCP_SA_KEY`: contenido completo del archivo JSON de la cuenta de servicio de Google Cloud (solo lectura en BigQuery).
   - `REPORT_PASSWORD`: la clave del informe.
2. **Settings → Pages**: Source `Deploy from a branch`, Branch `main`, carpeta `/ (root)`, Save.
3. **Actions → Actualizar informe Ag. Garcés → Run workflow** para probar la primera actualización.

## Cuenta de servicio de Google Cloud (la crea un administrador de Baumsystem)

En el proyecto `baumapp-prod`: IAM → Service accounts → Create, con los roles **BigQuery Data Viewer** y **BigQuery Job User**. Luego Keys → Add key → JSON y pegar el contenido en el secreto `GCP_SA_KEY`.

## Cambiar la clave

Para cambiar la clave basta con volver a generar el informe con la nueva clave.

## Qué hay en el repositorio

- `index.html`: pantalla de acceso (pública).
- `reporte.enc.json`: informe completo cifrado (AES-GCM).
- `plan/calendario.enc.json`: calendario de mediciones original de Ag. Garcés (cifrado). Ya no se usa en el informe; queda como respaldo.
- `report/`: diseño del informe (HTML, estilos y cálculos).
- `scripts/`: descarga desde BigQuery, limpieza y cifrado.
- `.github/workflows/actualizar.yml`: actualización automática.

## Actualizar a pedido

1. Exportar desde BigQuery de Baumsystem `meter.json` y `blocks.json` (consultas de `scripts/fetch_bq.py`).
2. `python scripts/pipeline.py` en la carpeta de trabajo → `lecturas_garces.json`, `bloques_garces.json`.
3. `REPORT_PASSWORD=… python scripts/build.py <carpeta de trabajo> garces/` y publicar `reporte.enc.json` en `main`.
