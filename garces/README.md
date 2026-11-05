# Informe de riego · Ag. Garcés (blum)

Página con el informe de presiones, aforos y cumplimiento del calendario de mediciones de Ag. Garcés, temporada 2026-27.

- Link: https://baumappadm.github.io/Dashboard-BLUM/garces/ (carpeta `garces/` del repositorio Dashboard BLUM; no modifica la página principal).
- Pide **usuario** (`Ag. Garcés`) y **clave**. Todo el informe y sus datos están cifrados: sin la clave no se puede leer nada, ni siquiera mirando los archivos del repositorio.
- Se actualiza solo dos veces al día (07:00 y 14:00, hora de Chile) con los datos de BigQuery de Baumsystem.

## Configuración (una sola vez, desde el navegador)

1. **Settings → Secrets and variables → Actions → New repository secret**
   - `GCP_SA_KEY`: contenido completo del archivo JSON de la cuenta de servicio de Google Cloud (solo lectura en BigQuery).
   - `REPORT_PASSWORD`: la clave del informe.
2. **Actions → Actualizar informe Ag. Garcés → Run workflow** para probar la primera actualización.

## Cuenta de servicio de Google Cloud (la crea un administrador de Baumsystem)

En el proyecto `baumapp-prod`: IAM → Service accounts → Create, con los roles **BigQuery Data Viewer** y **BigQuery Job User**. Luego Keys → Add key → JSON y pegar el contenido en el secreto `GCP_SA_KEY`.

## Cambiar la clave

Cambiar el secreto `REPORT_PASSWORD` no basta: el calendario (`plan/calendario.enc.json`) también está cifrado con la clave actual. Pedir el cambio a blum para volver a cifrarlo.

## Qué hay en el repositorio

- `index.html`: pantalla de acceso (pública).
- `reporte.enc.json`: informe completo cifrado (AES-GCM).
- `plan/calendario.enc.json`: calendario de mediciones entregado por Ag. Garcés, cifrado.
- `report/`: diseño del informe (HTML, estilos y cálculos).
- `scripts/`: descarga desde BigQuery, limpieza, cruce con el calendario y cifrado.
- `../.github/workflows/actualizar-garces.yml`: actualización automática.
