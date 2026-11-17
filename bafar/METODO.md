# Método · Informe de riego Ag. Bafar

Documento para repetir el informe cuando Berni diga **«actualiza Bafar»** (todos los viernes y a pedido).

## Datos de partida

- BigQuery de Baumsystem: `baumapp-prod.baumsystem_legacy`, con la herramienta de Baumsystem del computador de Berni (`consultar_baumsystem`).
- Empresa **037- Ag. Bafar**, id `4eddc2ce-aa08-4e77-8597-29074f85a0db`.
- Campos: `01- Agua Caliente MX` (Equipos 1–7), `02.1- San Antonio MX 2.0` (Circuitos 1–8) y `03- Encino MX` (Circuitos 1–6). `02- San Antonio MX` **no aplica** (no tiene mediciones).
- Temporada: solo datos desde el **01-07-2026**.
- Jerarquía: Equipo o Circuito → Sector → Bloque → Válvula / Cola / Microaspersor. El «Circuito» se trata como equipo de riego.
- Unidades: presión en **psi**, aforo en **l/h** (microaspersión, nominal 90 l/h; en Encino 62 l/h), caudal de sector en **m³/h**.

## Origen de las mediciones

| Medición | Origen | Cómo se reconoce |
|---|---|---|
| Presión de válvula, presión de cola, aforo | Manual en terreno (app blum) | `meter.manual = 1`, activo hijo del bloque |
| Caudal instantáneo del sector | API Wiseconn (Dropcontrol) | `manual = 0`, activo «Caudalímetro», sector en `assetSectorId` |
| Presión del cabezal | API Wiseconn | `manual = 0`, tipo «PRESION VALVULA» en el caudalímetro |

En Agua Caliente, el Equipo 1 tiene dos caudalímetros (Rebombeo 7 y 8) que informan los mismos sectores: el caudal del sector se toma como la **suma** de ambos (queda marcado con * en el informe; confirmar con Bafar si trabajan en paralelo).

## Pasos para actualizar

1. Clonar `BaumAPPADM/Dashboard-BLUM` y crear una rama `bafar-actualiza-AAAA-MM-DD`.
2. Correr las 5 consultas de `scripts/consultas.sql` con `consultar_baumsystem` y guardar cada resultado, tal cual, en una carpeta de trabajo **fuera del repositorio**: `sectores.txt`, `bloques.txt`, `lecturas.txt`, `caudal_api.txt`, `presion_api.txt`. Correr también la consulta 6 de control: si cambió el caudal de diseño de algún sector, actualizar `DISENO` en `pipeline.py`.
3. `python scripts/pipeline.py <carpeta de trabajo>` → `datos.json`. Revisar lo que imprime (número de filas por tabla) y la tabla de limpieza.
4. `REPORT_PASSWORD=<clave> python scripts/build.py <carpeta de trabajo> bafar/` → `bafar/index.html` y `bafar/reporte.enc.json` (la fecha de actualización queda dentro del informe y en la portada). La clave se pide a Berni o se toma de la conversación; **nunca se escribe en el repositorio ni en documentos**.
5. Probar con el link de prueba de la rama (`https://raw.githack.com/BaumAPPADM/dashboard-blum/<rama>/bafar/index.html`): entrar con usuario `Ag. Bafar` y la clave y revisar las 6 pestañas.
6. Abrir el pull request hacia `main` (solo archivos de `bafar/`) y pasarle a Berni los dos links. Berni lo aprueba con un clic.

## Reglas de limpieza

- Se excluyen los registros de prueba de blum (usuario `78ceab25`, GPS en Chile o comentario «ejemplo»).
- Aforo bajo 10 l/h en microaspersor con nominal de 50 l/h o más → la app no deja ingresar más de 100 l/h y el operador lo anota dividido por 100: **se multiplica por 100** (queda «Corregida»). La regla de Garcés (÷10 desde 10 l/h) no aplica.
- Presión de 87 psi o más (6 bar) se excluye. Presión de 5 psi o menos se excluye (válvula cerrada o error de digitación).
- Dos presiones de válvula distintas (3 psi o más) en la misma visita: se usa la menor (presión regulada que recibe el bloque); la mayor queda marcada como «No se usa».
- Rango óptimo de presión cargado en bar (máx. bajo 5) con lecturas en psi: no se evalúa y se propone corregir.
- Se marcan los aforos sobre el doble del nominal o bajo 0,2 l/h.
- Presión del cabezal (API) bajo 10 psi: sin riego, no se usa.
- Caudal API: solo días con 5 lecturas o más sobre 0; caudal del día = mediana de lecturas sobre 0.

## Cálculos

- **Válvula y cola** (por bloque): promedio frente al rango cargado → Presión baja, Presión alta, Inestable (promedio en rango pero la mitad o más de las lecturas fuera) o En rango.
- **Aforos**: promedio y % del nominal por bloque; **CU de Christiansen** con 4 aforos o más (alerta bajo 90 %).
- **Dónde se aforó**: distancia GPS del aforo a la válvula del bloque y a su cola (mediana de las lecturas GPS de cola) → Junto a la válvula (≤15 m), Junto a la cola (≤15 m), Dentro del bloque, Junto a otro bloque, Lejos de su bloque, Fuera del campo (>1 km), Sin GPS; y tramo de la hilera en tercios (inicio, mitad, cola).
- **Caudal Wiseconn × aforos** (por sector): caudal mediano en riego frente al diseño cargado en blum y al aforo del sector. Posible fuga (caudal ≥110 % y aforos ≤90 %), falta presión u obstrucción (ambos ≤90 %), emisores bajo o sobre el nominal, caudal bajo el diseño (<85 %), caudal sobre el diseño (>120 %), caudalímetro en 0, diseño mal cargado (Agua Caliente: 41 m³/h en todos los sectores), falta aforar para cruzar.
- **Presión cabezal (API) × válvulas manuales** del mismo sector: diferencia de 20 psi o más = gran pérdida o regulación fuerte. En Encino, el operador anota la presión «Principal» en el comentario; se extrae y se muestra.
- **Diagnóstico por bloque**: tabla fija de reglas combinando válvula, cola y aforo (sobrepresión, falta de presión, pérdida en el lateral, presión alta con caudal bajo, caudal muy sobre el nominal, etc.), con causa, pasos y prioridad.
- **Meta de mediciones** (plan cargado en blum): ciclo de 90 días desde el 01-07-2026, 100 % de los bloques activos; por bloque y ciclo, 1 presión de válvula, 1 presión de cola y 7 aforos. Bloques por campo: Agua Caliente 245, San Antonio 2.0 261, Encino 117. Semana a semana: bloques visitados y con la meta completa frente a la meta semanal (bloques × 7 ÷ 90).
- **Óptimos**: por campo y rango cargado, mediana y P25–P75 de lo medido y % en rango. Válvula: propuesta = mediana de las válvulas de bloques con la cola en rango (si hay 5 o más) ±10 %. Cola y caudal de sector: mediana ±10 %. «Mantener» si lo medido está a menos de 15 % del óptimo.

## Pestañas del informe

Todos los campos · Meta de mediciones · Resumen del campo (para el cliente) · Análisis técnico (Wiseconn, válvula, cola, aforos, mapa, limpieza, detalle filtrable) · Plan de acción · Actualización de óptimos. Colores blum: Bosque #002E2B, Turquesa #77CFC9 y blanco; Naranjo #F64500 y Rojo #C30016 solo para alertas.
