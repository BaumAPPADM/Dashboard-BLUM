# Método · «actualiza Los Gomeros»

Informe de riego de **Ag. Los Gomeros** (empresa `053- Ag. Los Gomeros`, id `d9c5c4f2-635e-4a5e-af8a-f38350a64906`, campo `01- Los Arroyos`). Datos desde el 01-07-2026. Se actualiza todos los viernes y a pedido.

## Pasos

1. **Consultar BigQuery** de Baumsystem con la herramienta de Baumsystem del computador de blum (`consultar_baumsystem`), usando las dos consultas de `scripts/consultas.sql`:
   - consulta 1 → guardar la respuesta como `meter.json` en una carpeta de trabajo (sirve la respuesta tal cual o el archivo que guarda la herramienta cuando la salida es larga);
   - consulta 2 → guardar la respuesta como `blocks.txt`.
2. **Procesar**: `python scripts/pipeline.py <carpeta de trabajo>` → `datos.json`. Revisar lo que imprime: resumen, diagnóstico por bloque y notas de limpieza. Si aparece algo nuevo (otro rango mal cargado, otra caseta, lecturas de prueba), avisar a Berni antes de publicar.
3. **Armar y cifrar**: `REPORT_PASSWORD=<clave> python scripts/build.py <carpeta de trabajo> losgomeros/`. Usuario por defecto `Ag. Los Gomeros`. La clave se pide a Berni o se toma del gestor de claves; **nunca** se escribe en el repositorio, en este documento ni en commits.
4. **Probar**: abrir `losgomeros/index.html` con usuario y clave y revisar las 4 pestañas (Resumen y plan de acción, Mapa de aforos, Presiones altas y bajas, Detalle) y la fecha de actualización.
5. **Publicar**: rama nueva, commit solo de `losgomeros/reporte.enc.json` (y de lo que haya cambiado en `losgomeros/`), pull request a `main` para que Berni lo apruebe. Link de prueba antes de aprobar: `https://raw.githack.com/BaumAPPADM/dashboard-blum/<rama>/losgomeros/index.html`. No tocar `garces/` ni el resto del repositorio.

## Reglas de limpieza (las de Ag. Garcés)

- Aforo de 10 l/h o más = decimal omitido (÷10).
- Presión de 5 bar o más se excluye.
- Se excluyen equipos de jardín o impulsión y comentarios de prueba.
- Se marcan aforos sobre el doble del nominal o bajo 0,2 l/h.

### Ajustes propios de Los Gomeros

- **Rango de válvula ×10 en BigQuery** (p. ej. 13–15–30): BigQuery lo trae 10 veces mayor que la lectura en bar; se divide por 10. Berni revisó que en blum están bien cargados. Tres válvulas ya vienen en bar (1,2–2) y no se tocan.
- **Nominal de gotero distinto al del resto del campo** (Equipo 1 Nectarines y cerezos · Sector 6 · Bloque 2 tiene 2 l/h; el resto 4 l/h): se evalúa con el nominal común y se marca para revisar.
- **Caseta**: el caudalímetro tiene un rango por sector; se usa el más amplio. Se calcula la pérdida en filtros (entrada − salida); sobre 0,5 bar es alerta.
- **Lecturas fuera de su bloque**: si el GPS queda a más de 160 m de la válvula de su bloque y más cerca de la válvula de otro, se marca «Junto a otro bloque» y el plan pide confirmar el registro antes de actuar.

## Qué calcula el informe

- Presión de válvula y de cola frente al rango óptimo de blum: bajo, en rango, sobre.
- Aforos: promedio frente al nominal y CU % de Christiansen por bloque (con 2 aforos o más; bajo 90 % = alerta).
- Mapa por equipo con el GPS de cada lectura frente a la válvula del bloque en blum; ubicación (junto a la válvula ≤ 15 m, dentro del bloque ≤ 160 m, junto a otro bloque, fuera del campo > 1 km, sin GPS) y tramo de la hilera (inicio, mitad, final) cuando hay presión de cola como referencia.
- Plan de acción global y corto: primero la caseta, luego cada tipo de acción con la lista de bloques (sin repetir texto por bloque). Tabla de bloques con una acción breve.
- Respuesta al cliente sobre manejos para presiones altas y bajas, aplicada a los bloques medidos.
- Meta de mediciones: no se incluye todavía (el plan de mediciones del cliente no está en BigQuery). Si Berni entrega el plan, agregar una pestaña como la de Garcés.
