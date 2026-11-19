"""Limpieza y cálculos del informe de riego de Ag. Bafar (blum).

Entrada: carpeta de trabajo con los textos que entregan las consultas de scripts/consultas.sql
(sectores.txt, bloques.txt, lecturas.txt, caudal_api.txt, presion_api.txt).
Salida: datos.json en la misma carpeta, con todas las tablas que usa el informe.

Uso: python pipeline.py <carpeta de trabajo>
"""
import json, re, sys, os, datetime as dt, collections
import numpy as np, pandas as pd

AÑO = 2026
INICIO = dt.date(2026, 7, 1)          # temporada: solo datos desde esta fecha
CICLO_DIAS = 90                        # plan de mediciones cargado en blum
META = {'V': 1, 'C': 1, 'A': 7}        # mínimos por bloque y ciclo (plan en blum)
CAMPOS = {'1': ('01 · Agua Caliente MX', 1), '2': ('02.1 · San Antonio MX 2.0', 2), '3': ('03 · Encino MX', 3)}
META_BLOQUES = {'1': 245, '2': 261, '3': 117}
PSI_MAX = 87                           # 6 bar: sobre esto la presión se excluye
PSI_MIN = 5                            # presión casi nula: válvula cerrada o error de digitación
USR_PRUEBA = {'78'}                    # usuario de blum que registró pruebas (GPS en Chile, «ejemplo»)
OPERADOR = {'c7': 'Operador SA', '06': 'Operador EN', '0a': 'Operador blum', '20': 'Operador AC', '78': 'Prueba blum'}
# Caudal de diseño por sector cargado en blum (m3/h): min / óptimo / máx
DISENO = {'4e13cacf': (140.4, 156, 171.6), '60c677eb': (108, 120, 132), '71650ded': (140.4, 156, 171.6), 'bf5a355c': (86.4, 96, 105.6),
          '5d8fe638': (198, 220, 242), 'b65dea66': (199.8, 222, 244.2), '12004e16': (108, 120, 132), '94a1e929': (108, 120, 132),
          '94fe883f': (118.8, 132, 145.2), 'b4f2ad37': (108, 120, 132), 'df8cc4db': (108, 120, 132)}
DISENO_AC = (36.9, 41, 45.1)           # mismo valor en todos los sectores de Agua Caliente

W = sys.argv[1] if len(sys.argv) > 1 else '.'
rd = lambda n: open(os.path.join(W, n), encoding='utf-8').read().strip()
r1 = lambda x: None if x is None or (isinstance(x, float) and not np.isfinite(x)) else round(float(x), 1)
r2 = lambda x: None if x is None or (isinstance(x, float) and not np.isfinite(x)) else round(float(x), 2)

def eq_lbl(s):
    m = re.match(r'(EQUIPO|CIRCUITO)\s*(\d+)', s.strip(), re.I)
    return (f'{m.group(1).title()} {m.group(2)}', int(m.group(2))) if m else (s.strip().title(), 99)
def sec_lbl(s):
    m = re.search(r'(\d+)', s); return (f'Sector {m.group(1)}', int(m.group(1))) if m else (s.strip().title(), 99)
def bl_n(s):
    m = re.match(r'(\d+)', s); return float(m.group(1)) if m else 9999

# ---------- estructura
S = {}
for row in rd('sectores.txt').split('~'):
    sid, c, eq, sec, sup = row.split('|')
    e, en = eq_lbl(eq); s, sn = sec_lbl(sec)
    S[sid] = dict(sid=sid, campo=CAMPOS[c][0], campo_n=CAMPOS[c][1], c=c, equipo=e, equipo_n=en, sector=s, sector_n=sn,
                  sup=float(sup) if sup else None, sector_key=f'{CAMPOS[c][0]} · {e} · {s}')
B = []
for line in rd('bloques.txt').splitlines():
    sid, rest = line.split('=')
    for it in rest.split(';'):
        p = it.split(',')
        s = S[sid]
        B.append(dict(bid=p[0], sid=sid, bloque=f'Bloque {p[1]}', bloque_n=bl_n(p[1]), lat=float(p[2]) if p[2] else np.nan, lon=float(p[3]) if p[3] else np.nan,
                      activo=not (len(p) > 4 and p[4] == 'x'), **{k: s[k] for k in ('campo', 'campo_n', 'c', 'equipo', 'equipo_n', 'sector', 'sector_n', 'sector_key')}))
B = pd.DataFrame(B)
B['bloque_key'] = B.sector_key + ' · ' + B.bloque
bi = B.set_index('bid')

# ---------- lecturas manuales
TIPO = {'V': 'Válvula', 'C': 'Cola', 'A': 'Aforo'}
L = []
for line in rd('lecturas.txt').splitlines():
    bid, rest = line.split('=', 1)
    for it in rest.split(';'):
        t, f, v, rg, la, lo, us, foto, com = it.split(',', 8)
        mn = op = mx = None
        if rg: mn, op, mx = map(float, rg.split('/'))
        L.append(dict(bid=bid, t=t, fecha=dt.datetime(AÑO, int(f[:2]), int(f[2:4]), int(f[4:6]), int(f[6:8])), valor=float(v), valor_original=float(v),
                      min=mn, optimo=op, max=mx, lat=float(la) if la else np.nan, lon=float(lo) if lo else np.nan, usr=us, foto=foto == 'f', comentario=com.strip()))
M = pd.DataFrame(L)
M = M[M.fecha.dt.date >= INICIO].copy()
M = M.join(bi[['campo', 'campo_n', 'c', 'equipo', 'equipo_n', 'sector', 'sector_n', 'sector_key', 'bloque', 'bloque_n', 'bloque_key', 'sid']], on='bid')
M['tipo'] = M.t.map(TIPO); M['origen'] = 'Manual en terreno'
M['incluida'] = True; M['nota'] = ''
M = M.sort_values('fecha').reset_index(drop=True)
def nota(mask, txt, incl=None):
    M.loc[mask, 'nota'] = np.where(M.loc[mask, 'nota'] == '', txt, M.loc[mask, 'nota'] + ' · ' + txt)
    if incl is not None: M.loc[mask, 'incluida'] = incl
A, V, C = M.t == 'A', M.t == 'V', M.t == 'C'
nota(M.usr.isin(USR_PRUEBA), 'Excluida: registro de prueba de blum (GPS en Chile o valor de ejemplo)', False)
cien = A & M.incluida & (M.valor < 10) & (M.optimo >= 50)
M.loc[cien, 'valor'] = (M.loc[cien, 'valor'] * 100).round(1)
nota(cien, 'Corregida: la app no deja ingresar más de 100 l/h; el operador lo anotó en el comentario (×100)')
nota(~A & M.incluida & (M.valor >= PSI_MAX), f'Excluida: presión fuera de escala ({PSI_MAX} psi o más)', False)
nota(~A & M.incluida & (M.valor <= PSI_MIN), f'Excluida: presión de {PSI_MIN} psi o menos (válvula cerrada o error de digitación)', False)
nota(A & M.incluida & (M.valor > 2 * M.optimo), 'Se marca: aforo sobre el doble del nominal (revisar emisor, fuga o nominal cargado)')
nota(A & M.incluida & (M.valor < 0.2), 'Se marca: aforo bajo 0,2 l/h (emisor tapado o sin riego)')
# dos lecturas de válvula en la misma visita (minutos de diferencia)
M['visita'] = M.bid + '|' + M.fecha.dt.strftime('%Y-%m-%d')
vv = M[V & M.incluida].groupby('visita').valor.agg(['count', 'min', 'max'])
dobles = vv[(vv['count'] > 1) & (vv['max'] - vv['min'] >= 3)].index
dv = V & M.visita.isin(dobles)
menor = M[dv].groupby('visita').valor.transform('min')
alta = dv & (M.valor > M.visita.map(M[dv].groupby('visita').valor.min()))
nota(dv & ~alta, 'Se marca: dos presiones de válvula en la misma visita; se usa la menor (presión regulada que recibe el bloque)')
nota(alta, 'No se usa: en la misma visita hay otra lectura de válvula menor (esta parece ser la presión antes del regulador)', False)
bar = ~A & M['max'].notna() & (M['max'] < 5)
nota(bar, 'Rango óptimo cargado en bar con lecturas en psi: no se evalúa')
M['rango_ok'] = ~bar & M['min'].notna()
M['estado'] = np.select([~M.rango_ok, M.valor < M['min'], M.valor > M['max']], ['Sin rango válido', 'Bajo', 'Alto'], 'En rango')
pr = M.comentario.str.extract(r'(?i)principal\D{0,6}(\d{1,3})')[0]
M['principal'] = pd.to_numeric(pr, errors='coerce')
M['operador'] = M.usr.map(OPERADOR).fillna('Otro')

# ---------- ubicación de los aforos (metros locales por campo)
K = 6371000
M['x'] = np.nan; M['y'] = np.nan; B['x_v'] = np.nan; B['y_v'] = np.nan
for c, bc in B.groupby('c'):
    lat0 = bc.lat.mean()
    X = lambda lon: lon * np.cos(np.radians(lat0)) * np.pi / 180 * K
    Y = lambda lat: lat * np.pi / 180 * K
    x0, y0 = np.nanmin(X(bc.lon)) - 50, np.nanmin(Y(bc.lat)) - 50
    B.loc[bc.index, 'x_v'] = X(bc.lon) - x0; B.loc[bc.index, 'y_v'] = Y(bc.lat) - y0
    mm = (M.c == c) & M.lat.notna()
    M.loc[mm, 'x'] = X(M.loc[mm, 'lon']) - x0; M.loc[mm, 'y'] = Y(M.loc[mm, 'lat']) - y0
cola = M[C & M.incluida & M.x.notna()].merge(B[['bid', 'x_v', 'y_v']], on='bid')
cola = cola[np.hypot(cola.x - cola.x_v, cola.y - cola.y_v) <= 400]
cp = cola.groupby('bid')[['x', 'y']].median().rename(columns={'x': 'x_c', 'y': 'y_c'})
B = B.merge(cp, left_on='bid', right_index=True, how='left')
B['L'] = np.hypot(B.x_c - B.x_v, B.y_c - B.y_v)
bi = B.set_index('bid')
def segd(px, py, ax, ay, bx, by):
    ux, uy = bx - ax, by - ay; L2 = ux * ux + uy * uy
    if not np.isfinite(L2) or L2 == 0: return np.hypot(px - ax, py - ay)
    t = np.clip(((px - ax) * ux + (py - ay) * uy) / L2, 0, 1)
    return np.hypot(px - ax - t * ux, py - ay - t * uy)
M['ubicacion'] = ''; M['tramo'] = ''; M['bloque_gps'] = ''; M['dist_valvula'] = np.nan; M['dist_cola'] = np.nan
for i, r in M[A & M.incluida].iterrows():
    if not np.isfinite(r.x): M.at[i, 'ubicacion'] = 'Sin GPS'; continue
    bc = B[(B.c == r.c) & B.x_v.notna()]
    dall = np.hypot(r.x - bc.x_v.values, r.y - bc.y_v.values)
    if dall.min() > 1000: M.at[i, 'ubicacion'] = 'Fuera del campo'; continue
    b = bi.loc[r.bid]
    dV = float(np.hypot(r.x - b.x_v, r.y - b.y_v)); M.at[i, 'dist_valvula'] = round(dV)
    hasC = np.isfinite(b.x_c)
    dC = float(np.hypot(r.x - b.x_c, r.y - b.y_c)) if hasC else np.nan
    if hasC: M.at[i, 'dist_cola'] = round(dC)
    Lb = b.L if hasC else 150
    own = segd(r.x, r.y, b.x_v, b.y_v, b.x_c, b.y_c) if hasC else dV
    if dV <= 15: u = 'Junto a la válvula'
    elif hasC and dC <= 15: u = 'Junto a la cola'
    elif dV <= Lb + 40 or own <= 40: u = 'Dentro del bloque'
    else:
        k = int(np.argmin(dall))
        if bc.bid.values[k] != r.bid and dall[k] < dV / 2: u = 'Junto a otro bloque'; M.at[i, 'bloque_gps'] = bc.bloque_key.values[k]
        else: u = 'Lejos de su bloque'
    M.at[i, 'ubicacion'] = u
    if hasC and Lb > 0 and u in ('Junto a la válvula', 'Junto a la cola', 'Dentro del bloque'):
        t = ((r.x - b.x_v) * (b.x_c - b.x_v) + (r.y - b.y_v) * (b.y_c - b.y_v)) / Lb ** 2
        t = min(max(t, 0), 1); M.at[i, 'tramo'] = 'Inicio' if t < 1 / 3 else ('Mitad' if t < 2 / 3 else 'Cola')
    elif u in ('Junto a la válvula',): M.at[i, 'tramo'] = 'Inicio'

INC = M[M.incluida]
# ---------- datos API (Wiseconn)
caud = []
for line in rd('caudal_api.txt').splitlines():
    head, rest = line.split('=')
    aid, sid, nombre = head.split('|')
    for it in rest.split(';'):
        d, n, npos, med, mx, mnp = it.split(',')
        caud.append(dict(aid=aid, sid=sid, caudalimetro=nombre.strip().title().replace('Re-Bombeo', 'Rebombeo').replace('C2- ', 'C2 · '),
                         dia=dt.date(AÑO, int(d[:2]), int(d[2:])), n=int(n), npos=int(npos), med=float(med) if med else None, mx=float(mx)))
CA = pd.DataFrame(caud)
CA = CA[(CA.dia >= INICIO) & CA.sid.isin(S)].copy()
for k in ('campo', 'campo_n', 'equipo', 'sector', 'sector_key', 'sup'): CA[k] = CA.sid.map(lambda s: S[s][k])
PA = []
for it in rd('presion_api.txt').split(';'):
    aid, sid, f, v = it.split('|')
    PA.append(dict(aid=aid, sid=sid, fecha=dt.datetime(AÑO, int(f[:2]), int(f[2:4]), int(f[4:6]), int(f[6:8])), valor=float(v)))
PA = pd.DataFrame(PA)
PA = PA[(PA.fecha.dt.date >= INICIO) & PA.sid.isin(S)]
# las dos bombas del rebombeo informan la misma presión: una sola lectura por sector y hora
PA = PA.sort_values('fecha').drop_duplicates(['sid', 'fecha'])
PA['riego'] = PA.valor >= 10

# ---------- cálculos por bloque
def cond_activo(g):
    g = g.sort_values('fecha'); n = len(g); last = g.iloc[-1]; prom = g.valor.mean()
    ev = g[g.rango_ok]
    if len(ev):
        mn, mx = ev.iloc[-1]['min'], ev.iloc[-1]['max']
        b = (ev.estado == 'Bajo').mean(); a = (ev.estado == 'Alto').mean()
        cond = 'Presión baja' if prom < mn else 'Presión alta' if prom > mx else 'Inestable' if b + a >= 0.5 else 'En rango'
        rango = f'{mn:g}–{mx:g}'.replace('.', ',')
    else:
        mn = mx = None; b = a = np.nan; cond = 'Sin rango válido'
        rango = (f'{last["min"]:g}–{last["max"]:g}'.replace('.', ',') + ' (bar)') if pd.notna(last['min']) else '—'
    return dict(lecturas=n, prom=r1(prom), min=mn, max=mx, rango=rango, ult=r1(last.valor), ultFecha=last.fecha.strftime('%Y-%m-%d'),
                pctBajo=None if np.isnan(b) else round(b * 100), pctAlto=None if np.isnan(a) else round(a * 100), condicion=cond,
                comentarios=' | '.join(dict.fromkeys(g.comentario[g.comentario != ''])))
rows = []
for (bid, t), g in INC[INC.t.isin(['V', 'C'])].groupby(['bid', 't']):
    b = bi.loc[bid]
    rows.append(dict(id=f'{t}|{bid}', tipo=TIPO[t], campo=b.campo, equipo=b.equipo, equipo_n=int(b.equipo_n), sector=b.sector, sector_n=int(b.sector_n),
                     bloque=b.bloque, bloque_n=b.bloque_n, bloque_key=b.bloque_key, **cond_activo(g)))
COND = pd.DataFrame(rows)

def cu(v):
    v = np.asarray(v, float); p = v.mean(); return round((1 - np.abs(v - p).sum() / (len(v) * p)) * 100) if len(v) >= 4 and p > 0 else None
rows = []
for bid, g in INC[INC.t == 'A'].groupby('bid'):
    b = bi.loc[bid]; v = g.valor.values; prom = v.mean(); nom = g.optimo.mean()
    rows.append(dict(id=bid, campo=b.campo, equipo=b.equipo, equipo_n=int(b.equipo_n), sector=b.sector, sector_n=int(b.sector_n), bloque=b.bloque, bloque_n=b.bloque_n,
                     bloque_key=b.bloque_key, aforos=len(v), prom=r1(prom), nominal=r1(nom), min=g['min'].mean(), max=g['max'].mean(), pctNominal=round(prom / nom * 100),
                     cu=cu(v), faltanCu=max(0, 4 - len(v)), corregidos=int(g.nota.str.contains('×100').sum()),
                     comentarios=' | '.join(dict.fromkeys(g.comentario[g.comentario != '']))))
AF = pd.DataFrame(rows)

# semáforo y diagnóstico por bloque
nivel = lambda v, a, b: '' if v is None or a is None or pd.isna(a) else 'Bajo' if v < a else 'Alto' if v > b else 'En rango'
vis_v = INC[INC.t == 'V'].groupby('visita').valor.mean()
vis_c = INC[INC.t == 'C'].groupby('visita').valor.max()
both = vis_c.index.intersection(vis_v.index)
sobre = {k.split('|')[0] for k in both if vis_c[k] > vis_v[k] + 1}
cb = COND.set_index('id') if len(COND) else pd.DataFrame()
ab = AF.set_index('id') if len(AF) else pd.DataFrame()
keys = sorted(set(INC.bid))
diag = []
for bid in keys:
    b = bi.loc[bid]
    va = cb.loc[f'V|{bid}'] if f'V|{bid}' in cb.index else None
    co = cb.loc[f'C|{bid}'] if f'C|{bid}' in cb.index else None
    af = ab.loc[bid] if bid in ab.index else None
    Vn = nivel(va.prom, va['min'], va['max']) if va is not None else ''
    Cn = nivel(co.prom, co['min'], co['max']) if co is not None else ''
    Qn = nivel(af.prom, af['min'], af['max']) if af is not None else ''
    V_, C_, Q_ = Vn or 'Sin dato', Cn or 'Sin dato', Qn or 'Sin dato'
    pres = V_ != 'Sin dato' or C_ != 'Sin dato'
    vsin = va is not None and va.condicion == 'Sin rango válido'
    alto2 = af is not None and af.prom > 2 * af.nominal
    if alto2: d = ('Caudal muy sobre el nominal', 'El aforo supera el doble del caudal nominal: emisor roto o saltado, fuga junto al emisor o un emisor distinto al cargado en blum.', '1) Revisar el emisor aforado y las líneas cercanas. 2) Confirmar el modelo de microaspersor instalado. 3) Volver a aforar al menos 4 emisores.', 'Alta')
    elif V_ == 'Alto' and C_ == 'Alto': d = ('Sobrepresión en el bloque', 'La válvula y la cola están sobre su rango: la regulación deja pasar más presión de la necesaria y aumenta el riesgo de fugas y desgaste.', '1) Bajar la regulación (piloto) de la válvula a su óptimo. 2) Revisar fugas. 3) Volver a medir válvula y cola.', 'Media')
    elif V_ == 'Bajo' and Q_ == 'Bajo': d = ('Falta presión en el bloque', 'No llega presión suficiente y el caudal ya bajó: filtros sucios, piloto mal ajustado o demasiados sectores regando a la vez.', '1) Revisar presión del cabezal y filtros. 2) Subir la regulación al óptimo. 3) Revisar turnos. 4) Volver a medir.', 'Alta')
    elif bid in sobre: d = ('Cola con más presión que la válvula', 'La cola marca más que la válvula el mismo día: manómetros distintos, válvula medida antes del regulador o pendiente a favor.', '1) Medir válvula (a la salida del regulador) y cola con el mismo manómetro. 2) Confirmar el punto de medición.', 'Media')
    elif V_ == 'Alto' and Q_ == 'Bajo': d = ('Presión alta con caudal bajo', 'Hay presión de sobra pero los emisores entregan menos: obstrucción de emisores o laterales.', '1) Revisar y limpiar emisores y filtros. 2) Lavar laterales. 3) Volver a aforar.', 'Alta')
    elif V_ == 'Alto' and C_ in ('En rango', 'Bajo'): d = ('Válvula sobre su presión', 'La válvula está sobre su rango, pero la cola llega en rango o baja: hay pérdida de carga a lo largo del lateral o el rango de válvula no corresponde.', '1) Bajar la regulación al óptimo y medir la cola. 2) Si la cola cae bajo su mínimo, revisar el rango cargado en blum (pestaña Óptimos).', 'Media')
    elif V_ == 'Alto': d = ('Válvula sobre su presión', 'La regulación de la válvula está sobre el óptimo.', '1) Bajar la regulación al óptimo. 2) Medir la cola en la misma visita.', 'Media')
    elif V_ == 'Bajo' and C_ == 'Bajo': d = ('Presión baja en el bloque', 'Válvula y cola bajo su rango: el bloque trabaja al límite.', '1) Revisar filtros y presión de cabezal. 2) Subir la regulación. 3) Aforar para ver si el caudal ya cayó.', 'Media')
    elif V_ == 'Bajo': d = ('Válvula bajo su presión', 'La válvula está bajo su óptimo.', '1) Revisar filtros y piloto. 2) Subir la regulación. 3) Volver a medir.', 'Media')
    elif C_ == 'Bajo': d = ('Pérdida de presión en el lateral', 'La presión entra bien pero no llega a la cola: fugas, laterales largos o finales abiertos.', '1) Revisar fugas y finales de línea. 2) Lavar laterales. 3) Medir la cola en varias hileras.', 'Media')
    elif C_ == 'Alto': d = ('Cola sobre su presión', 'La cola marca sobre su rango con la válvula en rango: revisar el rango de cola cargado o el manómetro.', '1) Confirmar la lectura. 2) Revisar el rango de cola en blum.', 'Baja')
    elif Q_ == 'Bajo' and pres: d = ('Caudal bajo con presión correcta', 'La presión está bien y el emisor entrega menos: obstrucción (sarro, algas o sedimento) o emisor distinto al cargado.', '1) Revisar emisores y filtros. 2) Limpieza química si corresponde. 3) Volver a aforar.', 'Alta')
    elif Q_ == 'Bajo': d = ('Caudal bajo, sin presiones', 'El aforo está bajo el rango y no hay presiones para saber si es falta de presión u obstrucción.', '1) Medir válvula y cola. 2) Revisar emisores. 3) Volver a aforar.', 'Alta')
    elif vsin: d = ('Rango de válvula mal cargado', 'La válvula tiene su rango óptimo cargado en bar y las lecturas están en psi: no se puede evaluar.', '1) Corregir el rango en blum (pestaña Óptimos). 2) Mantener la frecuencia de medición.', 'Baja')
    elif not pres: d = ('Faltan presiones', 'Hay aforo pero no presión de válvula ni de cola.', 'Medir válvula y cola en la misma visita del aforo.', 'Baja')
    elif Q_ == 'Sin dato': d = ('Presiones en rango, sin aforos', 'Válvula y cola en rango, pero sin aforos no se sabe cuánto entrega cada emisor ni qué tan parejo riega.', 'Aforar 7 emisores del bloque (inicio, mitad y cola de la hilera).', 'Baja')
    else: d = ('Bloque en orden', 'Presiones y caudal dentro de rango.', 'Mantener la frecuencia de medición.', '—')
    diag.append(dict(bloque_key=b.bloque_key, bid=bid, campo=b.campo, equipo=b.equipo, equipo_n=int(b.equipo_n), sector=b.sector, sector_n=int(b.sector_n), bloque=b.bloque, bloque_n=b.bloque_n,
                     valvula=None if va is None else va.prom, valvulaNivel=V_ if not vsin else 'Sin rango', cola=None if co is None else co.prom, colaNivel=C_,
                     aforo=None if af is None else af.prom, aforoNivel=Q_, aforos=0 if af is None else int(af.aforos), cu=None if af is None else af.cu,
                     diagnostico=d[0], causa=d[1], accion=d[2], prioridad=d[3], orden={'Alta': 1, 'Media': 2, 'Baja': 3, '—': 4}[d[3]],
                     colaSobre=bid in sobre, comentarios=' | '.join(dict.fromkeys(INC[(INC.bid == bid) & (INC.comentario != '')].comentario))[:240]))
DIAG = pd.DataFrame(diag)

# ---------- Wiseconn: caudal por sector y cruce con aforos
# Caudal del sector en un día = suma de los caudalímetros que lo informan (en Agua Caliente dos rebombeos alimentan el Equipo 1)
riego = CA[(CA.npos >= 5) & CA.med.notna()]
sd = riego.groupby(['sid', 'dia']).agg(q=('med', 'sum'), lecturas=('npos', 'sum'), medidores=('aid', 'nunique')).reset_index()
api_rows, serie = [], []
afs = INC[INC.t == 'A'].groupby('sid').agg(aforos=('valor', 'size'), aforo=('valor', 'mean'), nominal=('optimo', 'mean'))
vals = INC[INC.t == 'V'].groupby('sid').agg(valvulas=('bid', 'nunique'), pv=('valor', 'mean'))
for sid in sorted(set(CA.sid), key=lambda s: (S[s]['campo_n'], S[s]['equipo_n'], S[s]['sector_n'])):
    s = S[sid]; g = sd[sd.sid == sid]; todos = CA[CA.sid == sid]
    mets = ' + '.join(sorted(set(todos.caudalimetro)))
    dis = DISENO.get(sid) or (DISENO_AC if s['c'] == '1' else None)
    q = float(g.q.median()) if len(g) else None
    cv = round(float(g.q.std() / g.q.mean() * 100)) if len(g) >= 3 and g.q.mean() > 0 else None
    af = afs.loc[sid] if sid in afs.index else None
    pct_d = round(q / dis[1] * 100) if q and dis else None
    pct_a = round(af.aforo / af.nominal * 100) if af is not None else None
    ceros = int(todos.n.sum() - todos.npos.sum())
    if not len(g): cruce = ('Caudalímetro en 0', 'Wiseconn informa caudal 0 en todas las lecturas del sector: caudalímetro sin señal o mal asociado al sector.', 'Revisar el caudalímetro y su asignación al sector en Wiseconn.', 'Alta')
    elif s['c'] == '1': cruce = ('Caudal de diseño mal cargado', f'El caudal real ronda {q:.0f} m³/h y en blum está cargado {dis[1]:g} m³/h (el mismo valor en todos los sectores).', 'Cargar el caudal de diseño real de cada sector (ver pestaña Óptimos).', 'Media')
    elif af is None and pct_d is not None and pct_d < 85: cruce = ('Caudal bajo el diseño', f'Wiseconn mide {q:.0f} m³/h, {pct_d} % del diseño ({dis[1]:g} m³/h), y no hay aforos para ver dónde se pierde.', 'Revisar filtros, válvula y presión del sector; aforar en el próximo riego.', 'Alta')
    elif af is None and pct_d is not None and pct_d > 120: cruce = ('Caudal sobre el diseño', f'Wiseconn mide {q:.0f} m³/h, {pct_d} % del diseño ({dis[1]:g} m³/h): posible fuga, otro sector abierto a la vez o diseño mal cargado.', 'Revisar fugas y sectores abiertos; confirmar el caudal de diseño.', 'Media')
    elif af is None: cruce = ('Falta aforar para cruzar', f'Wiseconn mide {q:.0f} m³/h ({pct_d} % del diseño), pero no hay aforos en el sector para saber si ese caudal sale parejo por los emisores.', 'Aforar al menos 7 emisores en 2 bloques del sector durante un riego.', 'Media')
    elif pct_d >= 110 and pct_a <= 90: cruce = ('Posible fuga', 'Entra más agua que la de diseño, pero los emisores entregan menos: el agua se pierde antes de los emisores.', 'Recorrer matrices y laterales buscando roturas.', 'Alta')
    elif pct_d <= 90 and pct_a <= 90: cruce = ('Falta presión u obstrucción general', 'Entra menos agua y los emisores entregan menos.', 'Revisar filtros, bomba y regulación del cabezal.', 'Alta')
    elif pct_a <= 90: cruce = ('Emisores bajo el nominal', 'El caudal del sector está bien, pero el aforo marca bajo: obstrucción puntual o aforo poco representativo.', 'Aforar más emisores y revisar obstrucción.', 'Media')
    elif pct_a >= 110: cruce = ('Emisores sobre el nominal', 'Los emisores entregan más que el nominal cargado: modelo distinto o desgaste.', 'Confirmar el emisor instalado y su nominal en blum.', 'Media')
    else: cruce = ('Sector en orden', 'Caudal del sector y aforos de acuerdo con el diseño.', 'Mantener el monitoreo.', '—')
    pm = riego[riego.sid == sid].groupby('caudalimetro').med.median()
    detm = ' · '.join(f'{k.replace("Caudalimetro ", "")}: {v:.0f}' for k, v in pm.items())
    if s['c'] == '1': pct_d = None
    api_rows.append(dict(id=sid, campo=s['campo'], campo_n=s['campo_n'], equipo=s['equipo'], sector=s['sector'], sector_n=s['sector_n'], sector_key=s['sector_key'], ha=s['sup'],
                         caudalimetros=mets, diasRiego=len(g), lecturas=int(todos.n.sum()), lecturasCero=ceros, desde=str(todos.dia.min()), hasta=str(todos.dia.max()),
                         q=r1(q), qMin=r1(g.q.min()) if len(g) else None, qMax=r1(g.q.max()) if len(g) else None, cv=cv,
                         qHa=r1(q / s['sup']) if q and s['sup'] else None, lamina=r2(q / s['sup'] / 10) if q and s['sup'] else None,
                         diseno=dis[1] if dis else None, disenoRango=f'{dis[0]:g}–{dis[2]:g}'.replace('.', ',') if dis else '—', disenoTxt=f'{dis[0]:g} / {dis[1]:g} / {dis[2]:g}'.replace('.', ',') if dis else '—', pctDiseno=pct_d,
                         aforos=0 if af is None else int(af.aforos), aforo=None if af is None else r1(af.aforo), nominal=None if af is None else r1(af.nominal), pctNominal=pct_a,
                         porMedidor=detm if len(pm) > 1 else '', suma=len(pm) > 1, valvulas=int(vals.loc[sid].valvulas) if sid in vals.index else 0,
                         cruce=cruce[0], detalle=cruce[1], accion=cruce[2], prioridad=cruce[3]))
    for _, x in g.iterrows():
        serie.append(dict(sid=sid, campo=s['campo'], sector_key=s['sector_key'], etiqueta=f"{s['equipo']} · {s['sector']}", dia=str(x.dia), q=r1(x.q), medidores=int(x.medidores),
                          dmin=dis[0] if dis else None, dmax=dis[2] if dis else None))
API = pd.DataFrame(api_rows)

# presión automática (cabezal) vs válvulas manuales del sector
pres_rows = []
for sid, g in PA.groupby('sid'):
    s = S[sid]; gr = g[g.riego]
    man = INC[(INC.sid == sid) & (INC.t == 'V')]
    pri = INC[(INC.sid == sid) & INC.principal.notna()]
    papi = gr.valor.mean() if len(gr) else None; pman = man.valor.mean() if len(man) else None
    dif = papi - pman if papi is not None and pman is not None else None
    if not len(man): txt = ('Sin válvulas medidas', 'Hay presión automática del cabezal, pero no hay válvulas del sector medidas a mano para compararla.', 'Medir a mano las válvulas del sector en un riego con lectura de Wiseconn.')
    elif dif is not None and dif >= 20: txt = ('Gran pérdida entre cabezal y válvula', f'El cabezal marca {papi:.0f} psi y las válvulas del sector {pman:.0f} psi en promedio: {dif:.0f} psi se pierden o se regulan en el camino.', 'Revisar pilotos reguladores, filtros y matrices; confirmar que la regulación sea intencional.')
    elif dif is not None and dif < 0: txt = ('Válvula sobre el cabezal', 'Las válvulas marcan más que el cabezal: manómetros distintos o lecturas de días sin riego.', 'Calibrar manómetros y medir el mismo día que la lectura automática.')
    else: txt = ('Presiones coherentes', f'Diferencia de {dif:.0f} psi entre cabezal y válvulas.', 'Mantener.')
    pres_rows.append(dict(id=sid, campo=s['campo'], campo_n=s['campo_n'], equipo=s['equipo'], sector=s['sector'], sector_n=s['sector_n'], sector_key=s['sector_key'],
                          apiLecturas=len(g), apiRiego=len(gr), apiProm=r1(papi), apiMin=r1(gr.valor.min()) if len(gr) else None, apiMax=r1(gr.valor.max()) if len(gr) else None,
                          apiFechas=', '.join(sorted({x.strftime('%d-%m') for x in gr.fecha})),
                          valvulas=int(man.bid.nunique()), manLecturas=len(man), manProm=r1(pman), manMin=r1(man.valor.min()) if len(man) else None, manMax=r1(man.valor.max()) if len(man) else None,
                          principal=r1(pri.principal.mean()) if len(pri) else None, diferencia=r1(dif), resultado=txt[0], detalle=txt[1], accion=txt[2]))
PRES = pd.DataFrame(pres_rows)

# ---------- meta de mediciones (plan cargado en blum)
corte = max(INC.fecha.max().date(), CA.dia.max())
hoy = dt.date.today()
ciclos = []
d0 = INICIO
while d0 <= hoy:
    ciclos.append((d0, min(d0 + dt.timedelta(days=CICLO_DIAS - 1), dt.date(2099, 1, 1)))); d0 = d0 + dt.timedelta(days=CICLO_DIAS)
def ciclo_de(d):
    for i, (a, b) in enumerate(ciclos):
        if a <= d <= b: return i
INC2 = INC.assign(dia=INC.fecha.dt.date)
INC2['ciclo'] = INC2.dia.map(ciclo_de)
meta_bloque = []
Bact = B[B.activo]
cnt = INC2.groupby(['ciclo', 'bid', 't']).size().unstack(fill_value=0)
for ci, (a, b_) in enumerate(ciclos):
    for _, b in Bact.iterrows():
        k = (ci, b.bid)
        nv = int(cnt.loc[k, 'V']) if k in cnt.index and 'V' in cnt.columns else 0
        nc = int(cnt.loc[k, 'C']) if k in cnt.index and 'C' in cnt.columns else 0
        na = int(cnt.loc[k, 'A']) if k in cnt.index and 'A' in cnt.columns else 0
        falta = [x for x in [f'válvula' if nv < META['V'] else '', 'cola' if nc < META['C'] else '', f'{META["A"] - na} aforos' if na < META['A'] else ''] if x]
        est = 'Cumple' if not falta else ('Parcial' if nv + nc + na else 'Sin medición')
        meta_bloque.append(dict(id=f'{ci}|{b.bid}', ciclo=f'Ciclo {ci + 1}', ciclo_n=ci + 1, campo=b.campo, campo_n=int(b.campo_n), equipo=b.equipo, equipo_n=int(b.equipo_n),
                                sector=b.sector, sector_n=int(b.sector_n), bloque=b.bloque, bloque_n=b.bloque_n, valvula=nv, cola=nc, aforos=na,
                                estado=est, falta=', '.join(falta) if falta else '—'))
MB = pd.DataFrame(meta_bloque)
semanas = []
lunes0 = INICIO - dt.timedelta(days=INICIO.weekday())
w = lunes0
while w <= hoy:
    semanas.append(w); w += dt.timedelta(days=7)
meta_sem = []
for c, (campo, cn) in CAMPOS.items():
    nb = META_BLOQUES[c]; obj = round(nb * 7 / CICLO_DIAS, 1)
    for w in semanas:
        we = w + dt.timedelta(days=6)
        g = INC2[(INC2.c == c) & (INC2.dia >= w) & (INC2.dia <= we)]
        cnts = g.groupby(['bid', 't']).size().unstack(fill_value=0)
        for t in 'VCA':
            if t not in cnts.columns: cnts[t] = 0
        comp = int(((cnts.V >= 1) & (cnts.C >= 1) & (cnts.A >= META['A'])).sum())
        meta_sem.append(dict(id=f'{campo}|{w}', campo=campo, campo_n=cn, semana=str(w), fin=str(we), etiqueta=f'{w.day}-{w.month:02d}', objetivo=obj,
                             visitados=int(len(cnts)), conValvula=int((cnts.V >= 1).sum()), conCola=int((cnts.C >= 1).sum()), conAforo=int((cnts.A >= 1).sum()),
                             completos=comp, valvulas=int(len(g[g.t == 'V'])), colas=int(len(g[g.t == 'C'])), aforos=int(len(g[g.t == 'A'])),
                             pct=round(comp * 100 / obj) if obj else None, enCurso=we >= hoy))
MS = pd.DataFrame(meta_sem)
meta_campo = []
for c, (campo, cn) in CAMPOS.items():
    for ci, (a, b_) in enumerate(ciclos):
        g = MB[(MB.campo == campo) & (MB.ciclo_n == ci + 1)]; nb = META_BLOQUES[c]
        trans = (min(hoy, b_) - a).days + 1
        meta_campo.append(dict(id=f'{campo}|{ci + 1}', campo=campo, campo_n=cn, ciclo=f'Ciclo {ci + 1}', ciclo_n=ci + 1, inicio=str(a), fin=str(b_),
                               avanceTiempo=round(min(trans, CICLO_DIAS) * 100 / CICLO_DIAS), metaBloques=nb, bloques=len(g),
                               cumplen=int((g.estado == 'Cumple').sum()), parciales=int((g.estado == 'Parcial').sum()), sinMedicion=int((g.estado == 'Sin medición').sum()),
                               conValvula=int((g.valvula >= 1).sum()), conCola=int((g.cola >= 1).sum()), conAforo=int((g.aforos >= 1).sum()), con7=int((g.aforos >= 7).sum()),
                               aforosHechos=int(g.aforos.sum()), aforosMeta=nb * META['A'], pctCumple=round((g.estado == 'Cumple').sum() * 100 / nb)))
MC = pd.DataFrame(meta_campo)

# ---------- óptimos: propuesta en base a las mediciones
opt_rows = []
def prop(vals):
    q = np.percentile(vals, [25, 50, 75]); return q
for (campo, t, rg), g in INC[INC.t.isin(['V', 'C', 'A'])].assign(rg=INC['min'].astype(str) + '/' + INC['optimo'].astype(str) + '/' + INC['max'].astype(str)).groupby(['campo', 't', 'rg']):
    if g['min'].isna().all(): continue
    mn, op, mx = g['min'].iloc[0], g['optimo'].iloc[0], g['max'].iloc[0]
    v = g.valor.values; q25, q50, q75 = prop(v)
    unidad = 'l/h' if t == 'A' else 'psi'
    enr = round(((v >= mn) & (v <= mx)).mean() * 100)
    if t != 'A' and mx < 5: obs, sug = 'Cargado en bar, lecturas en psi', f'Pasar a psi: {mn * 14.5:.0f}–{mx * 14.5:.0f} psi (equivalente) o usar el rango del resto de los bloques'
    elif t == 'V':
        cola_ok = DIAG[DIAG.bid.isin(g.bid) & (DIAG.colaNivel == 'En rango')].bid
        vref = g[g.bid.isin(cola_ok)].valor
        base = vref.median() if len(vref) >= 5 else q50
        obs = 'Válvulas con la cola en rango' if len(vref) >= 5 else 'Mediana de lo medido'
        sug = f'{base * 0.9:.0f} / {base:.0f} / {base * 1.1:.0f} psi' if abs(base - op) / op > 0.15 else 'Mantener'
    elif t == 'C': obs, sug = 'Mediana de lo medido', (f'{q50 * 0.9:.0f} / {q50:.0f} / {q50 * 1.1:.0f} psi' if abs(q50 - op) / op > 0.15 else 'Mantener')
    else: obs, sug = 'Confirmar el emisor instalado', ('Mantener' if abs(q50 - op) / op <= 0.15 else f'Revisar: lo medido ronda {q50:.0f} l/h frente a {op:g} l/h cargado')
    opt_rows.append(dict(id=f'{campo}|{t}|{mn:g}/{op:g}/{mx:g}', campo=campo, tipo=TIPO[t], unidad=unidad, cargado=f'{mn:g} / {op:g} / {mx:g}'.replace('.', ','),
                         bloques=int(g.bid.nunique()), lecturas=len(v), p25=r1(q25), mediana=r1(q50), p75=r1(q75), pctEnRango=enr, base=obs, sugerido=sug.replace('.', ',')))
for _, r in API.iterrows():
    if pd.isna(r.q) or pd.isna(r.diseno): continue
    if abs(r.q - r.diseno) / r.diseno <= 0.15: sug = 'Mantener'
    else: sug = f'{r.q * 0.9:.0f} / {r.q:.0f} / {r.q * 1.1:.0f} m³/h'
    opt_rows.append(dict(id=f'{r.campo}|Q|{r.id}', campo=r.campo, tipo='Caudal del sector', unidad='m³/h', cargado=r.disenoTxt,
                         bloques=None, lecturas=int(r.lecturas), p25=None, mediana=r.q, p75=None, pctEnRango=None, base=f'{r.equipo} · {r.sector}: mediana Wiseconn en riego ({r.diasRiego} días)', sugerido=sug))
OPT = pd.DataFrame(opt_rows)

# ---------- origen de las mediciones (API vs manual)
orig = []
for c, (campo, cn) in CAMPOS.items():
    for t in 'VCA':
        g = INC[(INC.c == c) & (INC.t == t)]
        if len(g): orig.append(dict(id=f'{campo}|M|{t}', campo=campo, campo_n=cn, medicion={'V': 'Presión de válvula', 'C': 'Presión de cola', 'A': 'Aforo de emisor'}[t], origen='Manual en terreno',
                                    lecturas=len(g), activos=int(g.bid.nunique()), desde=str(g.fecha.min().date()), hasta=str(g.fecha.max().date()), dias=int(g.fecha.dt.date.nunique())))
    g = CA[CA.campo == campo]
    if len(g): orig.append(dict(id=f'{campo}|A|Q', campo=campo, campo_n=cn, medicion='Caudal del sector', origen='API Wiseconn', lecturas=int(g.n.sum()), activos=int(g.sid.nunique()),
                                desde=str(g.dia.min()), hasta=str(g.dia.max()), dias=int(g.dia.nunique())))
    g = PA[PA.sid.map(lambda s: S[s]['c']) == c]
    if len(g): orig.append(dict(id=f'{campo}|A|P', campo=campo, campo_n=cn, medicion='Presión de cabezal', origen='API Wiseconn', lecturas=len(g), activos=int(g.sid.nunique()),
                                desde=str(g.fecha.min().date()), hasta=str(g.fecha.max().date()), dias=int(g.fecha.dt.date.nunique())))
ORIG = pd.DataFrame(orig)

# ---------- resumen por campo
camp = []
for c, (campo, cn) in CAMPOS.items():
    g = INC[INC.c == c]; d = DIAG[DIAG.campo == campo]; co = COND[COND.campo == campo] if len(COND) else COND
    a = API[API.campo == campo] if len(API) else API
    vb = co[(co.tipo == 'Válvula')]; cl = co[co.tipo == 'Cola']
    camp.append(dict(campo=campo, campo_n=cn, bloquesCampo=META_BLOQUES[c], bloques=int(g.bid.nunique()), pctBloques=round(g.bid.nunique() * 100 / META_BLOQUES[c]),
                     desde=str(g.fecha.min().date()) if len(g) else None, hasta=str(g.fecha.max().date()) if len(g) else None,
                     lecturas=len(g), valvulas=len(vb), valvAltas=int((vb.condicion == 'Presión alta').sum()), valvBajas=int((vb.condicion == 'Presión baja').sum()),
                     valvSinRango=int((vb.condicion == 'Sin rango válido').sum()), colas=len(cl), colasBajas=int((cl.condicion == 'Presión baja').sum()), colasAltas=int((cl.condicion == 'Presión alta').sum()),
                     aforos=int((g.t == 'A').sum()), aforoProm=r1(g[g.t == 'A'].valor.mean()) if (g.t == 'A').any() else None, nominal=r1(g[g.t == 'A'].optimo.mean()) if (g.t == 'A').any() else None,
                     bloquesCu=int(AF[(AF.campo == campo) & AF.cu.notna()].shape[0]) if len(AF) else 0,
                     sectoresApi=len(a), sectoresApiAforo=int((a.aforos > 0).sum()) if len(a) else 0, alertas=int((d.prioridad == 'Alta').sum()) + int((a.prioridad == 'Alta').sum()) if len(a) else int((d.prioridad == 'Alta').sum()),
                     ultimaManual=str(g.fecha.max().date()) if len(g) else None, ultimaApi=str(CA[CA.campo == campo].dia.max()) if (CA.campo == campo).any() else None))
CAMP = pd.DataFrame(camp)

# ---------- observaciones y plan de acción por campo
obs = []
def add(campo, nivel, titulo, detalle, accion, donde='', prioridad='Media', tema='Riego'):
    n = sum(1 for o in obs if o['campo'] == campo) + 1
    obs.append(dict(id=f'{campo}|{n}', campo=campo, orden=n, nivel=nivel, tema=tema, titulo=titulo, detalle=detalle, accion=accion, donde=donde, prioridad=prioridad))
pl = lambda n, a, b: f'{n} {a if n == 1 else b}'
corto = lambda k: k.replace('Equipo ', 'E').replace('Circuito ', 'C').replace('Sector ', 'S').replace('Bloque ', 'B')
def lista(ks, n=6):
    ks = [corto(k) for k in ks]; return ', '.join(ks[:n]) + (f' y {len(ks) - n} más' if len(ks) > n else '')
for _, cp_ in CAMP.iterrows():
    campo = cp_.campo; d = DIAG[DIAG.campo == campo]; a = API[API.campo == campo] if len(API) else API
    loc = lambda dd: [f'{r.equipo} · {r.sector} · {r.bloque}' for r in dd.itertuples()]
    add(campo, 'Dato', 'Cobertura', f'{cp_.bloques} de {cp_.bloquesCampo} bloques con alguna medición ({cp_.pctBloques} %), entre el {cp_.desde[8:]}-{cp_.desde[5:7]} y el {cp_.hasta[8:]}-{cp_.hasta[5:7]}.',
        'Completar la ronda: el plan pide medir el 100 % de los bloques cada 90 días.', '', 'Alta' if cp_.pctBloques < 50 else 'Media', 'Medición')
    if cp_.aforos < 0.2 * cp_.bloques * META['A']:
        add(campo, 'Alerta', 'Muy pocos aforos', f'{pl(cp_.aforos, "aforo", "aforos")} en toda la temporada (meta: {META["A"]} por bloque). Ningún bloque llega a 4 aforos, así que no se puede calcular la uniformidad (CU).',
            'Aforar 7 emisores por bloque (inicio, mitad y cola) en cada visita de válvula.', '', 'Alta', 'Medición')
    x = d[d.diagnostico == 'Sobrepresión en el bloque']
    if len(x): add(campo, 'Alerta', 'Sobrepresión', f'{len(x)} bloques con válvula y cola sobre su rango.', 'Bajar la regulación de los pilotos al óptimo.', lista(loc(x)), 'Media')
    x = d[d.valvulaNivel == 'Alto']
    if len(x) >= 3: add(campo, 'Atención', 'Válvulas sobre su presión', f'{len(x)} de {cp_.valvulas} válvulas promedian sobre su máximo.', 'Revisar regulación; si la cola llega en rango, revisar el rango de válvula cargado.', lista(loc(x)), 'Media')
    x = d[d.valvulaNivel == 'Bajo']
    if len(x): add(campo, 'Atención', 'Válvulas bajo su presión', f'{len(x)} válvulas promedian bajo su mínimo.', 'Revisar filtros y pilotos; subir la regulación.', lista(loc(x)), 'Media')
    x = d[d.colaNivel == 'Bajo']
    if len(x): add(campo, 'Atención', 'Colas bajo su presión', f'{len(x)} colas promedian bajo su mínimo.', 'Revisar fugas y finales de línea.', lista(loc(x)), 'Media')
    x = d[d.colaSobre]
    if len(x): add(campo, 'Atención', 'Cola sobre la válvula', f'En {pl(len(x), "bloque", "bloques")} la cola marcó más que la válvula el mismo día.', 'Medir con el mismo manómetro y a la salida del regulador.', lista(loc(x)), 'Media', 'Medición')
    x = d[d.valvulaNivel == 'Sin rango']
    if len(x): add(campo, 'Dato', 'Rangos de válvula en bar', f'{len(x)} válvulas tienen su rango cargado en bar y se miden en psi.', 'Corregir el rango en blum (pestaña Óptimos).', lista(loc(x)), 'Baja', 'Datos')
    x = INC[(INC.campo == campo) & INC.nota.str.contains('×100')]
    if len(x): add(campo, 'Atención', 'Aforos que la app no deja registrar', f'{len(x)} aforos de {x.valor.min():.0f} a {x.valor.max():.0f} l/h se ingresaron divididos por 100 porque la app no acepta más de 100 l/h.',
                   'Subir el máximo del aforo en blum y revisar esos emisores: superan el nominal de 90 l/h.', lista(sorted(set(x.bloque_key.map(lambda k: ' · '.join(k.split(' · ')[2:]))))), 'Alta', 'Datos')
    x = d[d.diagnostico == 'Caudal muy sobre el nominal']
    if len(x): add(campo, 'Alerta', 'Emisores muy sobre el nominal', f'{pl(len(x), "bloque", "bloques")} con aforos sobre el doble del nominal.', 'Revisar emisores rotos, fugas o modelo distinto.', lista(loc(x)), 'Alta')
    x = d[d.aforoNivel == 'Bajo']
    if len(x): add(campo, 'Atención', 'Aforos bajo el rango', f'{len(x)} bloques con aforo bajo el rango del emisor.', 'Revisar obstrucción y presión; volver a aforar 7 emisores.', lista(loc(x)), 'Media')
    for r in a.itertuples():
        if r.prioridad in ('Alta',) or r.cruce in ('Caudal de diseño mal cargado',):
            pass
    z = a[a.cruce == 'Caudalímetro en 0'] if len(a) else a
    if len(z): add(campo, 'Alerta', 'Caudalímetro en 0', f'{len(z)} sectores con Wiseconn marcando 0 en todas sus lecturas.', 'Revisar el caudalímetro y su asignación de sectores en Wiseconn.', ', '.join(f'{r.equipo} · {r.sector}' for r in z.itertuples()), 'Alta', 'Wiseconn')
    z = a[a.cruce == 'Caudal de diseño mal cargado'] if len(a) else a
    if len(z): add(campo, 'Atención', 'Caudal de diseño mal cargado', f'{len(z)} sectores con caudal de diseño de 41 m³/h en blum; Wiseconn mide entre {z.q.min():.0f} y {z.q.max():.0f} m³/h.', 'Cargar el caudal real de cada sector (pestaña Óptimos).', '', 'Media', 'Wiseconn')
    z = a[a.cruce == 'Caudal bajo el diseño'] if len(a) else a
    if len(z): add(campo, 'Alerta', 'Sector con caudal bajo el diseño', f'{pl(len(z), "sector recibe", "sectores reciben")} menos del 85 % del caudal de diseño según Wiseconn.', 'Revisar filtros, válvula y presión; aforar en el próximo riego.', ', '.join(f'{r.equipo} · {r.sector}' for r in z.itertuples()), 'Alta', 'Wiseconn')
    z = a[a.cruce == 'Falta aforar para cruzar'] if len(a) else a
    if len(z): add(campo, 'Atención', 'Sectores con Wiseconn sin aforos', f'{len(z)} sectores tienen caudal de Wiseconn pero ningún aforo para cruzar.', 'Aforar en esos sectores durante un riego.', ', '.join(f'{r.equipo} · {r.sector}' for r in z.itertuples()), 'Media', 'Wiseconn')
    p = PRES[PRES.campo == campo] if len(PRES) else PRES
    z = p[p.resultado == 'Gran pérdida entre cabezal y válvula'] if len(p) else p
    if len(z): add(campo, 'Atención', 'Pérdida de presión cabezal → válvula', f'En {pl(len(z), "sector", "sectores")} el cabezal (Wiseconn) marca 20 psi o más que las válvulas medidas a mano.', 'Revisar pilotos, filtros y matrices; confirmar que la regulación sea intencional.', ', '.join(f'{r.equipo} · {r.sector}' for r in z.itertuples()), 'Media', 'Wiseconn')
    ult = max(filter(None, [cp_.ultimaManual]))
    add(campo, 'Dato', 'Última medición', f'Última medición manual: {ult[8:]}-{ult[5:7]}' + (f'; última lectura de Wiseconn: {cp_.ultimaApi[8:]}-{cp_.ultimaApi[5:7]}.' if isinstance(cp_.ultimaApi, str) else '.'),
        'Retomar las rondas de medición; en nogal pecanero, ajustar la meta a la etapa del cultivo si el riego baja después de cosecha.', '', 'Media', 'Medición')
OBS = pd.DataFrame(obs)

# ---------- lecturas para el detalle
det = INC.copy() if False else M.copy()
DET = pd.DataFrame(dict(id=det.index.astype(str), campo=det.campo, campo_n=det.campo_n, fecha=det.fecha.dt.strftime('%Y-%m-%d %H:%M'), dia=det.fecha.dt.strftime('%Y-%m-%d'),
                        tipo=det.tipo, origen=det.origen, equipo=det.equipo, sector=det.sector, bloque=det.bloque, valor=det.valor.round(2), valor_original=det.valor_original,
                        unidad=np.where(det.t == 'A', 'l/h', 'psi'), min=det['min'], optimo=det.optimo, max=det['max'], estado=det.estado, incluida=det.incluida, nota=det.nota,
                        comentario=det.comentario, ubicacion=det.ubicacion, tramo=det.tramo, operador=det.operador, foto=det.foto))
for _, r in PA.iterrows():
    s = S[r.sid]
    DET.loc[len(DET)] = dict(id=f'api{len(DET)}', campo=s['campo'], campo_n=s['campo_n'], fecha=r.fecha.strftime('%Y-%m-%d %H:%M'), dia=r.fecha.strftime('%Y-%m-%d'), tipo='Presión cabezal',
                             origen='API Wiseconn', equipo=s['equipo'], sector=s['sector'], bloque='—', valor=r.valor, valor_original=r.valor, unidad='psi', min=None, optimo=None, max=None,
                             estado='Sin riego' if not r.riego else 'Sin rango', incluida=bool(r.riego), nota='' if r.riego else 'Bajo 10 psi: sin riego al momento de la lectura',
                             comentario='', ubicacion='', tramo='', operador='Wiseconn', foto=False)
DET = DET.sort_values(['campo_n', 'fecha'])

# ---------- aforos y bloques para el mapa
PUN = INC[INC.t == 'A'][['campo', 'equipo', 'sector', 'bloque', 'bloque_key', 'x', 'y', 'valor', 'optimo', 'ubicacion', 'tramo', 'dist_valvula', 'dist_cola']].copy()
PUN['fecha'] = INC[INC.t == 'A'].fecha.dt.strftime('%Y-%m-%d')
BLO = B[['campo', 'campo_n', 'equipo', 'equipo_n', 'sector', 'sector_n', 'bloque', 'bloque_n', 'bloque_key', 'x_v', 'y_v', 'x_c', 'y_c']].copy()
BLO['medido'] = B.bid.isin(INC.bid)
UBI = (INC[INC.t == 'A'].groupby(['campo', 'ubicacion']).size().rename('aforos').reset_index())
TRA = (INC[(INC.t == 'A') & (INC.tramo != '')].groupby(['campo', 'tramo']).size().rename('aforos').reset_index())
LIMP = []
for (campo, n), g in M[M.nota != ''].assign(n=M.nota.str.split(' · ')).explode('n').groupby(['campo', 'n']):
    LIMP.append(dict(id=f'{campo}|{n}', campo=campo, regla=n, accion=next((a for a in ('Excluida', 'Corregida', 'No se usa', 'Se marca') if n.startswith(a)), 'Se marca'), lecturas=len(g)))

def recs(df):
    if df is None or not len(df): return []
    return json.loads(df.replace({np.nan: None}).to_json(orient='records', force_ascii=False))
out = dict(campos=recs(CAMP), cond=recs(COND), aforos=recs(AF), diagnostico=recs(DIAG), api=recs(API), serie=serie, presion=recs(PRES),
           metaBloque=recs(MB), metaSemana=recs(MS), metaCampo=recs(MC), optimos=recs(OPT), origen=recs(ORIG), observaciones=recs(OBS),
           lecturas=recs(DET), puntos=recs(PUN), bloques=recs(BLO), ubicacion=recs(UBI), tramo=recs(TRA), limpieza=LIMP,
           meta=[dict(k='plan', ciclo=CICLO_DIAS, valvula=META['V'], cola=META['C'], aforosMeta=META['A'], corte=str(corte), hoy=str(hoy), cicloActual=len(ciclos),
                      inicioCiclo=str(ciclos[-1][0]), finCiclo=str(ciclos[-1][1]), bloquesTotal=int(sum(META_BLOQUES.values())), bloquesMedidos=int(INC.bid.nunique()),
                      aforos=int((INC.t == 'A').sum()), lecturasManual=len(INC), lecturasApi=int(CA.n.sum() + len(PA)), sectoresApi=len(API),
                      sectoresApiAforo=int((API.aforos > 0).sum()), bloquesCu=int(AF.cu.notna().sum()) if len(AF) else 0, excluidas=int((~M.incluida).sum()),
                      corregidas=int(M.nota.str.contains('Corregida').sum()))])
json.dump(out, open(os.path.join(W, 'datos.json'), 'w'), ensure_ascii=False)
print({k: len(v) for k, v in out.items()})
