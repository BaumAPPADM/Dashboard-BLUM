"""Limpieza y diagnóstico de las mediciones de Ag. Los Gomeros → datos.json para el informe.

Uso: python pipeline.py <carpeta con meter.json y blocks.txt>
Reglas de limpieza: las mismas de Ag. Garcés (ver METODO.md), más dos ajustes propios de Los Gomeros:
- rango de válvula que en BigQuery viene ×10 (p. ej. 13–30): se divide por 10 para compararlo con la lectura en bar;
- nominal de aforo distinto al del resto del campo: se marca para revisar.
"""
import json, math, re, sys, os, collections, statistics

W = sys.argv[1] if len(sys.argv) > 1 else '.'

def leer_json_arreglo(path):
    t = open(path, encoding='utf-8').read()
    try:
        d = json.loads(t)
        if isinstance(d, list) and d and isinstance(d[0], dict) and 'text' in d[0]:  # salida guardada de la herramienta
            t = d[0]['text']
        elif isinstance(d, list):
            return d
    except Exception:
        pass
    return json.loads(t[t.index('[{'):t.rindex('}]') + 2])

def leer_bloques(path):
    t = open(path, encoding='utf-8').read()
    filas = re.findall(r'([0-9a-f]{8}-[0-9a-f-]{27})\|([^|;]*)\|([^|;]*)\|([^|;]*)\|([-0-9.]*)\|([-0-9.]*)', t)
    return {i: dict(equipo=e, sector=s, bloque=b, lat=float(la) if la else None, lon=float(lo) if lo else None) for i, e, s, b, la, lo in filas}

M = leer_json_arreglo(os.path.join(W, 'meter.json'))
B = leer_bloques(os.path.join(W, 'blocks.txt'))

TIPO = {'PRESION VALVULA': 'Válvula', 'PRESIÓN COLA': 'Cola', 'AFORO EMISOR': 'Aforo', 'PRESION ENTRADA': 'Entrada filtros',
        'PRESION SALIDA': 'Salida filtros', 'CAUDAL INSTANTANEO': 'Caudal caseta'}
UNI = {'Aforo': 'l/h', 'Caudal caseta': 'm³/h'}

def lbl(s):
    s = re.sub(r'\s+', ' ', (s or '').strip())
    m = re.match(r'EQUIPO\s+(\d+)\s*-\s*(.*)', s, re.I)
    if m: return f'Equipo {m.group(1)} · {m.group(2).strip().capitalize()}'
    return s.capitalize() if s.isupper() else s

def num(v):
    return None if v is None else float(v)

def dist(a, b, c, d):
    return math.hypot((b - d) * math.cos(math.radians(a)) * 111320, (a - c) * 110540)

# ---- deduplicar (la tabla deja una fila por cada rango cargado) y limpiar
por_id = collections.OrderedDict()
for r in M:
    por_id.setdefault(r['id'], []).append(r)

L = []
for rid, rs in por_id.items():
    r = dict(rs[0]); tipo = TIPO.get(r['tipo'])
    if not tipo: continue
    caseta = tipo in ('Entrada filtros', 'Salida filtros', 'Caudal caseta')
    v = num(r['value']); notas = []; incl = True
    mns = [num(x['mn']) for x in rs if x['mn'] is not None]; mxs = [num(x['mx']) for x in rs if x['mx'] is not None]
    ops = [num(x['op']) for x in rs if x['op'] is not None]
    mn, mx, op = (min(mns) if mns else None), (max(mxs) if mxs else None), (statistics.median(ops) if ops else None)
    if len(set(mns)) > 1: notas.append(f'{len(set(mns))} rangos cargados para este activo: se usa el más amplio')
    if re.search(r'JARD|IMPUL', r['equipo'] or '', re.I): incl = False; notas.append('Excluida: activo fuera de los bloques de riego')
    if re.search(r'es una prueba', r['comment'] or '', re.I): incl = False; notas.append('Excluida: registrada como prueba')
    if tipo == 'Aforo' and v >= 10: v = v / 10; notas.append('Corregida: decimal faltante (÷10)')
    if tipo in ('Válvula', 'Cola', 'Entrada filtros', 'Salida filtros') and v >= 5: incl = False; notas.append('Excluida: presión fuera de escala (5 bar o más)')
    if tipo == 'Aforo' and op and v > 2 * op: notas.append('Se marca: aforo más del doble del nominal')
    if tipo == 'Aforo' and v <= 0.2: notas.append('Se marca: aforo casi nulo (gotero tapado o sin riego)')
    if tipo == 'Válvula' and mx is not None and mx >= 10:
        mn, op, mx = mn / 10, (op / 10 if op else None), mx / 10
    estado = 'Sin rango' if mn is None else ('Bajo' if v < mn else ('Alto' if v > mx else 'En rango'))
    if caseta:
        equipo, sector, bloque = lbl(r['bloque']), (r['sector'] or '').strip().capitalize(), (r['activo'] or '').strip().capitalize()
    else:
        equipo, sector, bloque = lbl(r['equipo']), (r['sector'] or '').strip().capitalize(), (r['bloque'] or '').strip().capitalize()
    L.append(dict(id=rid, fecha=r['date_raw'][:16], dia=r['date_raw'][:10], tipo=tipo, caseta=caseta, equipo=equipo, sector=sector, bloque=bloque,
                  activo=(r['activo'] or '').strip().capitalize(), bloqueId=r['bloqueId'], valor=round(v, 2), unidad=UNI.get(tipo, 'bar'),
                  min=None if mn is None else round(mn, 2), optimo=None if op is None else round(op, 2), max=None if mx is None else round(mx, 2),
                  estado=estado, incluida=incl, nota=' · '.join(notas), comentario=(r['comment'] or '').strip(), lat=num(r['lat']), lon=num(r['lon']),
                  foto=r['foto'], ubicacion='', bloque_gps='', dist_valvula=None, tramo=''))

# ---- nominal de aforo dudoso: distinto al nominal más común del campo
noms = collections.Counter(x['optimo'] for x in L if x['tipo'] == 'Aforo' and x['optimo'])
nom_comun = noms.most_common(1)[0][0] if noms else None
for x in L:
    if x['tipo'] == 'Aforo' and nom_comun and x['optimo'] and x['optimo'] != nom_comun:
        x['nota'] = ' · '.join(filter(None, [x['nota'], f'Nominal cargado {x["optimo"]:g} l/h, distinto al del resto del campo ({nom_comun:g} l/h): revisar']))

# ---- ubicación GPS frente a la válvula del bloque (coordenada del activo en blum)
VAL = {k: b for k, b in B.items() if b['lat']}
def bloque_txt(b): return f'{lbl(b["equipo"])} · {b["sector"].capitalize()} · {b["bloque"].capitalize()}'
cola_pos = collections.defaultdict(list)
for x in L:
    if x['tipo'] == 'Cola' and x['lat'] and x['bloqueId'] in VAL and dist(x['lat'], x['lon'], VAL[x['bloqueId']]['lat'], VAL[x['bloqueId']]['lon']) <= 250:
        cola_pos[x['bloqueId']].append((x['lat'], x['lon']))
for x in L:
    if x['caseta'] or not x['incluida']: continue
    if not x['lat']: x['ubicacion'] = 'Sin GPS'; continue
    own = VAL.get(x['bloqueId'])
    cerca = min(VAL.items(), key=lambda kv: dist(x['lat'], x['lon'], kv[1]['lat'], kv[1]['lon'])) if VAL else None
    dmin = dist(x['lat'], x['lon'], cerca[1]['lat'], cerca[1]['lon']) if cerca else None
    if dmin is not None and dmin > 1000: x['ubicacion'] = 'Fuera del campo'; continue
    if not own: x['ubicacion'] = 'Sin referencia'; continue
    dV = dist(x['lat'], x['lon'], own['lat'], own['lon']); x['dist_valvula'] = round(dV)
    cp = cola_pos.get(x['bloqueId'])
    if dV <= 15: u = 'Junto a la válvula'
    elif cp and dist(x['lat'], x['lon'], *cp[0]) <= 15 and x['tipo'] != 'Cola': u = 'Junto a la cola'
    elif dV <= 160: u = 'Dentro del bloque'
    elif cerca[0] != x['bloqueId'] and dmin < dV / 2: u = 'Junto a otro bloque'; x['bloque_gps'] = bloque_txt(cerca[1])
    else: u = 'Lejos de su bloque'
    x['ubicacion'] = u
    if x['tipo'] == 'Aforo':
        if cp:
            (cl, co) = cp[0]
            vx, vy = (co - own['lon']) * math.cos(math.radians(own['lat'])) * 111320, (cl - own['lat']) * 110540
            px, py = (x['lon'] - own['lon']) * math.cos(math.radians(own['lat'])) * 111320, (x['lat'] - own['lat']) * 110540
            t = max(0, min(1, (px * vx + py * vy) / max(vx * vx + vy * vy, 1)))
            x['tramo'] = 'Inicio' if t < 1 / 3 else ('Mitad' if t < 2 / 3 else 'Final')
        elif dV <= 20: x['tramo'] = 'Inicio'
        else: x['tramo'] = 'Sin referencia'

# ---- diagnóstico por bloque
def cu(vals):
    if len(vals) < 2: return None
    m = statistics.mean(vals)
    return round(100 * (1 - statistics.mean(abs(v - m) for v in vals) / m), 1)

def ultimo(rs): return sorted(rs, key=lambda r: r['fecha'])[-1] if rs else None

G = collections.defaultdict(list)
for x in L:
    if x['incluida'] and not x['caseta']: G[(x['equipo'], x['sector'], x['bloque'])].append(x)

PRI = {'Alta': 0, 'Media': 1, 'Baja': 2}
BL = []
for (eq, se, bl), rs in G.items():
    v = ultimo([r for r in rs if r['tipo'] == 'Válvula']); c = ultimo([r for r in rs if r['tipo'] == 'Cola'])
    af = [r for r in rs if r['tipo'] == 'Aforo']
    a_vals = [r['valor'] for r in af]; nom = af[0]['optimo'] if af else None
    nom_raro = any('distinto al del resto' in r['nota'] for r in af)
    nom_cargado = nom
    a_min = af[0]['min'] if af else None; a_max = af[0]['max'] if af else None
    if nom_raro:  # se evalúa con el nominal del resto del campo y la misma banda relativa
        a_min, a_max, nom = round(a_min * nom_comun / nom, 2), round(a_max * nom_comun / nom, 2), nom_comun
    a_prom = round(statistics.mean(a_vals), 2) if a_vals else None
    a_pct = int(100 * a_prom / nom + 0.5) if (a_prom and nom) else None
    a_est = None if a_prom is None else ('Bajo' if a_prom < a_min else ('Alto' if a_prom > a_max else 'En rango'))
    cuv = cu(a_vals)
    dudoso = [r for r in rs if r['ubicacion'] in ('Junto a otro bloque', 'Lejos de su bloque')]
    diag, acc, falta = [], [], []
    pri = 'Baja'
    def sube(p):
        nonlocal_p[0] = min(nonlocal_p[0], p, key=lambda q: PRI[q])
    nonlocal_p = [pri]
    if dudoso:
        d0 = dudoso[0]
        diag.append(f'Las lecturas quedaron a ~{d0["dist_valvula"]} m de la válvula de este bloque' + (f', junto a {d0["bloque_gps"]}' if d0['bloque_gps'] else '') + '. Probablemente se cargaron en el bloque equivocado.')
        acc.append('Confirmar con el operador en qué bloque se midió y corregir el registro en blum antes de actuar.')
        sube('Media')
    if v:
        txt = f'Válvula {v["valor"]:g} bar (óptimo {v["min"]:g}–{v["max"]:g})'
        if v['estado'] == 'Bajo':
            muy = v['valor'] < 0.75 * v['min']
            diag.append(txt + (': muy bajo el mínimo.' if muy else ': bajo el mínimo.'))
            acc.append('Subir la presión de la válvula hasta el óptimo: revisar piloto o regulador, filtro de comando y que la válvula abra completa.')
            sube('Alta' if muy else 'Media')
        elif v['estado'] == 'Alto':
            muy = v['valor'] > 1.25 * v['max']
            diag.append(txt + (': muy sobre el máximo.' if muy else ': levemente sobre el máximo.'))
            acc.append('Bajar la presión de la válvula al óptimo calibrando el piloto o regulador.')
            sube('Alta' if muy else 'Baja')
        else:
            diag.append(txt + ': en rango.')
    else:
        falta.append('presión de válvula')
    if c:
        txt = f'Cola {c["valor"]:g} bar (óptimo {c["min"]:g}–{c["max"]:g})'
        if c['estado'] != 'En rango':
            diag.append(txt + (': baja.' if c['estado'] == 'Bajo' else ': alta.'))
            if c['estado'] == 'Bajo':
                acc.append('Lavar laterales abriendo los finales de hilera y buscar fugas o laterales rotos.')
            sube('Alta' if (v and v['estado'] == 'En rango') else 'Media')
        else:
            diag.append(txt + ': en rango.')
        if v and v['dia'] == c['dia']:
            dif = round(v['valor'] - c['valor'], 2)
            diag.append(f'La presión cae {dif:g} bar entre válvula y cola el mismo día.' if dif >= 0 else f'La cola marcó {abs(dif):g} bar más que la válvula: revisar ambos manómetros.')
    else:
        falta.append('presión de cola')
    if af:
        txt = f'Aforo promedio {a_prom:g} l/h en {len(af)} gotero{"s" if len(af) > 1 else ""} ({a_pct}% del nominal {nom:g} l/h)'
        if a_est == 'Bajo':
            diag.append(txt + ': bajo el mínimo.')
            if v and v['estado'] == 'Bajo':
                diag.append('La presión baja en la válvula explica el caudal bajo de los goteros.')
            elif v:
                diag.append('Con la válvula en rango, el caudal bajo apunta a goteros obstruidos o fugas en la hilera.')
                acc.append('Limpiar goteros y lavar laterales; si persiste, revisar obstrucción por sedimentos o precipitados.')
            sube('Alta' if a_pct < 80 else 'Media')
        elif a_est == 'Alto':
            diag.append(txt + ': sobre el máximo.')
            sube('Media')
        else:
            diag.append(txt + ': en rango.')
            if v and v['estado'] == 'Bajo':
                diag.append('Los goteros mantienen su caudal pese a la presión baja (probablemente autocompensados), pero con poco margen.')
        if cuv is not None:
            diag.append(f'Uniformidad CU {cuv:g}%' + (' (bajo 90%: riego desuniforme).' if cuv < 90 else '.'))
            if cuv < 90: acc.append('Revisar goteros con caudal distinto al resto y lavar laterales.'); sube('Media')
        if nom_raro:
            diag.append(f'El nominal cargado en blum ({nom_cargado:g} l/h) es distinto al del resto del campo; se evaluó con {nom_comun:g} l/h.')
            acc.append('Confirmar el caudal nominal del gotero y corregirlo en blum.')
            sube('Media')
        if len(af) < 3: falta.append(f'aforos (hay {len(af)}; medir al menos 3: inicio, mitad y final de hilera)')
    else:
        falta.append('aforos')
    if falta: acc.append('Próxima visita: medir ' + ', '.join(falta) + '.')
    if not acc: acc.append('Mantener el manejo actual y repetir la medición en la próxima ronda.')
    pri = nonlocal_p[0]
    own = VAL.get(rs[0]['bloqueId'])
    BL.append(dict(equipo=eq, sector=se, bloque=bl, key=f'{eq} · {se} · {bl}', prioridad=pri,
                   valvula=v and dict(valor=v['valor'], min=v['min'], max=v['max'], estado=v['estado'], dia=v['dia']),
                   cola=c and dict(valor=c['valor'], min=c['min'], max=c['max'], estado=c['estado'], dia=c['dia']),
                   aforo=None if not af else dict(n=len(af), prom=a_prom, nominal=nom, pct=a_pct, min=a_min, max=a_max, estado=a_est, cu=cuv),
                   registro_dudoso=bool(dudoso), diagnostico=' '.join(diag), acciones=acc, ultima=max(r['dia'] for r in rs),
                   vlat=own and own['lat'], vlon=own and own['lon']))

# ---- caseta: pérdida en filtros y caudal
CS = []
for eq in sorted({x['equipo'] for x in L if x['caseta']}):
    rs = [x for x in L if x['caseta'] and x['equipo'] == eq and x['incluida']]
    ent, sal, cau = (ultimo([r for r in rs if r['tipo'] == t]) for t in ('Entrada filtros', 'Salida filtros', 'Caudal caseta'))
    diag, acc, pri = [], [], 'Baja'
    if ent and sal and ent['dia'] == sal['dia']:
        dp = round(ent['valor'] - sal['valor'], 2)
        diag.append(f'Entrada a filtros {ent["valor"]:g} bar y salida {sal["valor"]:g} bar: se pierden {dp:g} bar en el filtrado.')
        if dp > 0.5:
            acc.append('Retrolavar y limpiar los filtros; revisar el programa de retrolavado (pérdida normal: 0,3–0,5 bar).'); pri = 'Alta'
    if sal and sal['estado'] == 'Bajo':
        diag.append(f'La presión que sale a los sectores ({sal["valor"]:g} bar) está bajo el mínimo cargado ({sal["min"]:g} bar).'); pri = 'Alta'
    if cau and cau['estado'] == 'Bajo':
        diag.append(f'Caudal instantáneo {cau["valor"]:g} m³/h, bajo el mínimo cargado para los sectores del equipo (desde {cau["min"]:g} m³/h).')
        acc.append('Revisar bomba (presión y caudal entregado, variador) y que estén abiertos solo los sectores del turno.'); pri = 'Alta'
    if rs:
        acc.append('Repetir la medición de entrada, salida y caudal en la próxima visita (la última es del ' + max(r['dia'] for r in rs) + ').')
        CS.append(dict(equipo=eq, caseta=rs[0]['sector'], prioridad=pri, diagnostico=' '.join(diag), acciones=acc, ultima=max(r['dia'] for r in rs),
                       entrada=ent and ent['valor'], salida=sal and sal['valor'], caudal=cau and cau['valor']))

def coma(t):
    t = re.sub(r'(\d{4})-(\d{2})-(\d{2})', r'\3-\2-\1', t)
    return re.sub(r'(\d)\.(\d)', r'\1,\2', t)
for b in BL + CS:
    b['diagnostico'] = coma(b['diagnostico']); b['acciones'] = [coma(a) for a in b['acciones']]

BL.sort(key=lambda b: (PRI[b['prioridad']], b['key']))
inc = [x for x in L if x['incluida']]
meta = dict(desde=min(x['dia'] for x in inc), hasta=max(x['dia'] for x in inc), lecturas=len(inc),
            bloques_medidos=len(BL), bloques_total=len(B), visitas=len({x['dia'] for x in inc}),
            nominal_comun=nom_comun,
            equipos=sorted({b['equipo'] for b in BL}))
for x in L: x.pop('bloqueId', None)
json.dump(dict(meta=meta, lecturas=L, bloques=BL, casetas=CS,
               valvulas=[dict(key=bloque_txt(b), equipo=lbl(b['equipo']), lat=b['lat'], lon=b['lon']) for b in VAL.values()]),
          open(os.path.join(W, 'datos.json'), 'w'), ensure_ascii=False)

print(json.dumps(meta, ensure_ascii=False))
for b in BL: print(b['prioridad'], '|', b['key'], '|', b['diagnostico'], '|', ' / '.join(b['acciones']))
for c in CS: print(c['prioridad'], '|', c['equipo'], c['caseta'], '|', c['diagnostico'])
for x in L:
    if x['nota'] or x['ubicacion'] not in ('', 'Dentro del bloque', 'Junto a la válvula'): print('  ', x['fecha'], x['tipo'], x['equipo'], x['sector'], x['bloque'], x['valor'], '|', x['nota'], '|', x['ubicacion'], x['bloque_gps'], x['tramo'])
