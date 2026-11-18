# Informe de riego · Ag. Los Gomeros (blum)

Página con el informe de presiones, aforos, mapa de aforos y plan de acción de Ag. Los Gomeros (campo 01- Los Arroyos), temporada 2026-27.

- Link: `https://baumappadm.github.io/dashboard-blum/losgomeros/`
- Pide **usuario** (`Ag. Los Gomeros`) y **clave** (la entrega blum; no está escrita en el repositorio). Todo el informe y sus datos están cifrados (AES-GCM): sin la clave no se puede leer nada, ni siquiera mirando los archivos.
- Se actualiza todos los viernes y a pedido. El método está en [METODO.md](METODO.md).

## Qué hay en la carpeta

- `index.html`: pantalla de acceso (pública, misma portada que Garcés).
- `reporte.enc.json`: informe completo cifrado, con la fecha de la última actualización.
- `report/`: diseño del informe (HTML, estilos y `app.js`).
- `scripts/consultas.sql`: consultas a BigQuery de Baumsystem.
- `scripts/pipeline.py`: limpieza, diagnóstico por bloque, caseta y ubicación GPS → `datos.json`.
- `scripts/build.py` y `scripts/crypto_util.py`: arman y cifran el informe.
