# Informe de riego · Ag. Bafar (blum)

Informe de presiones, aforos, caudal de Wiseconn y meta de mediciones de Ag. Bafar (nogal pecanero, México), temporada 2026-27.

- Link: https://baumappadm.github.io/Dashboard-BLUM/bafar/
- Pide **usuario** (`Ag. Bafar`) y **clave**. El informe y sus datos van cifrados (AES-GCM): sin la clave no se puede leer nada, ni mirando los archivos del repositorio. La clave no está escrita en ningún archivo.
- Se actualiza todos los viernes y cuando el cliente lo pide. El método completo está en [METODO.md](METODO.md).

## Qué hay en la carpeta

- `index.html`: pantalla de acceso (pública, misma portada que Ag. Garcés).
- `reporte.enc.json`: informe completo cifrado, con la fecha de la última actualización.
- `report/`: diseño del informe (HTML, estilos y `app.js`).
- `scripts/consultas.sql`: consultas a BigQuery de Baumsystem.
- `scripts/pipeline.py`: limpieza, cruces con Wiseconn, meta de mediciones, diagnóstico y óptimos.
- `scripts/build.py` y `scripts/crypto_util.py`: arma y cifra el informe.
