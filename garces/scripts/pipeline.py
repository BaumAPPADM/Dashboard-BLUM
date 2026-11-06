import json, re, numpy as np, pandas as pd

M = pd.DataFrame(json.load(open('meter.json')))
B = pd.DataFrame(json.load(open('blocks.json')))
for c in ['mn', 'op', 'mx', 'value', 'lat', 'lon']:
    M[c] = pd.to_numeric(M[c])
for c in ['lat', 'lon']:
    B[c] = pd.to_numeric(B[c])

def campo_lbl(s):
    m = re.match(r'\s*(\d+)\s*-\s*(.*)', s)
    return (f'{m.group(1)} · {m.group(2).strip()}', int(m.group(1))) if m else (s.strip(), 99)

def equipo_lbl(s):
    s = (s or '').strip()
    m = re.match(r'EQUIPO\s+(\d+)', s, re.I)
    if m: return f'Equipo {m.group(1)}', int(m.group(1))
    base = re.split(r'\s*-\s*', s)[0]
    return base.title().replace('Equipo', 'Equipo'), 900

def bloque_lbl(s):
    s = (s or '').strip().title()
    return re.sub(r'(\d+)\.0\b', r'\1', s)

def sector_lbl(s):
    return re.sub(r'\s+', ' ', (s or '').strip()).title()

for D in (M, B):
    D[['campo_l', 'campo_n']] = D.campo.apply(lambda s: pd.Series(campo_lbl(s)))
    D[['equipo_l', 'equipo_n']] = D.equipo.apply(lambda s: pd.Series(equipo_lbl(s)))
    D['sector_l'] = D.sector.apply(sector_lbl)
    D['bloque_l'] = D.bloque.apply(bloque_lbl)
    D['bloque_key'] = D.campo_l + ' · ' + D.equipo_l + ' · ' + D.sector_l + ' · ' + D.bloque_l

B = B.sort_values(['bloqueId', 'lat'], na_position='last').drop_duplicates('bloqueId')

# ---- limpieza
M['valor_orig'] = M.value
M['incluida'] = True
M['nota'] = ''
def setn(mask, nota, incl=None):
    M.loc[mask, 'nota'] = np.where(M.loc[mask, 'nota'] == '', nota, M.loc[mask, 'nota'] + ' · ' + nota)
    if incl is not None: M.loc[mask, 'incluida'] = incl
A, V, C = M.tipo == 'AFORO EMISOR', M.tipo == 'PRESION VALVULA', M.tipo == 'PRESIÓN COLA'
setn(M.equipo.str.contains('JARD|IMPUL', case=False), 'Excluida: activo fuera de los bloques de riego', False)
setn(M.comment.str.contains(r'es una prueba', case=False), 'Excluida: registrada como prueba', False)
setn(M.comment.str.contains(r'no es la v|no me da', case=False) & ~A, 'Excluida: el operador indica que la lectura no es válida', False)
m = A & (M.value >= 10); M.loc[m, 'value'] = M.loc[m, 'value'] / 10; setn(m, 'Corregida: decimal faltante (÷10)')
setn(~A & (M.value >= 5), 'Excluida: presión fuera de escala (5 bar o más)', False)
setn(A & M.incluida & (M.value > 2 * M.op), 'Se marca: aforo más del doble del nominal (revisar gotero o nominal cargado)')
setn(A & M.incluida & (M.value <= 0.2), 'Se marca: aforo casi nulo (gotero tapado o sin riego)')
g = ~A & M.activo.str.upper().str.startswith('GOTERO')
setn(g, 'Registrada en el activo gotero: se evalúa con el rango del bloque')
bad = V & (M.mx >= 10)
setn(bad, 'Rango de válvula mal cargado en BLUM: no se evalúa')
setn(C & (M.mx < 1.4), 'Rango de cola distinto al estándar')
M['rango_ok'] = ~bad & M.mn.notna()
M['estado'] = np.select([~M.rango_ok, M.value < M.mn, M.value > M.mx], ['Sin rango válido', 'Bajo', 'Alto'], 'En rango')

# ---- geometría por campo (metros locales)
K = 6371000
out_b, rows = [], []
M['x'] = np.nan; M['y'] = np.nan
for cid, bc in B.groupby('campoId'):
    ok = bc.lat.notna() & (bc.lat != 0)
    lat0 = bc.loc[ok, 'lat'].mean() if ok.any() else -34.4
    X = lambda lon: lon * np.cos(np.radians(lat0)) * np.pi / 180 * K
    Y = lambda lat: lat * np.pi / 180 * K
    bx = np.where(ok, X(bc.lon), np.nan); by = np.where(ok, Y(bc.lat), np.nan)
    mc = M.campoId == cid
    mok = mc & M.lat.notna() & (M.lat != 0)
    mx_ = X(M.loc[mok, 'lon']); my_ = Y(M.loc[mok, 'lat'])
    x0 = np.nanmin(bx) - 50 if ok.any() else (mx_.min() - 50 if len(mx_) else 0)
    y0 = np.nanmin(by) - 50 if ok.any() else (my_.min() - 50 if len(my_) else 0)
    bc = bc.assign(x_v=bx - x0, y_v=by - y0)
    M.loc[mok, 'x'] = mx_ - x0; M.loc[mok, 'y'] = my_ - y0
    # cola: mediana de lecturas de cola a <= 250 m de la válvula
    cc = M[mc & C & M.x.notna()].merge(bc[['bloqueId', 'x_v', 'y_v']], on='bloqueId')
    cc = cc[np.hypot(cc.x - cc.x_v, cc.y - cc.y_v) <= 250]
    cr = cc.groupby('bloqueId')[['x', 'y']].median().rename(columns={'x': 'x_c', 'y': 'y_c'})
    bc = bc.merge(cr, left_on='bloqueId', right_index=True, how='left')
    bc['L'] = np.hypot(bc.x_c - bc.x_v, bc.y_c - bc.y_v)
    out_b.append(bc)
B = pd.concat(out_b)
bi = B.set_index('bloqueId')

def segd(px, py, ax, ay, bx_, by_):
    ux, uy = bx_ - ax, by_ - ay; L2 = ux * ux + uy * uy
    if not np.isfinite(L2) or L2 == 0: return np.hypot(px - ax, py - ay)
    t = np.clip(((px - ax) * ux + (py - ay) * uy) / L2, 0, 1)
    return np.hypot(px - ax - t * ux, py - ay - t * uy)

M['ubicacion'] = ''; M['bloque_gps'] = ''; M['tramo'] = ''; M['dV'] = np.nan; M['dC'] = np.nan
af_idx = M.index[A & M.incluida]
for cid, g in M.loc[af_idx].groupby('campoId'):
    bc = B[(B.campoId == cid) & B.x_v.notna()]
    for i, r in g.iterrows():
        if np.isnan(r.x): M.at[i, 'ubicacion'] = 'Sin GPS'; continue
        if bc.empty: M.at[i, 'ubicacion'] = 'Sin referencia'; continue
        dmin = min(segd(r.x, r.y, b.x_v, b.y_v, b.x_c if np.isfinite(b.x_c) else b.x_v, b.y_c if np.isfinite(b.y_c) else b.y_v) for b in bc.itertuples())
        if dmin > 1000: M.at[i, 'ubicacion'] = 'Fuera del campo'; continue
        if r.bloqueId not in bi.index or not np.isfinite(bi.at[r.bloqueId, 'x_v']):
            M.at[i, 'ubicacion'] = 'Sin referencia'; continue
        b = bi.loc[r.bloqueId]
        dV = np.hypot(r.x - b.x_v, r.y - b.y_v); M.at[i, 'dV'] = dV
        hasC = np.isfinite(b.x_c)
        dC = np.hypot(r.x - b.x_c, r.y - b.y_c) if hasC else np.nan; M.at[i, 'dC'] = dC
        L = b.L if hasC else 120
        own = segd(r.x, r.y, b.x_v, b.y_v, b.x_c, b.y_c) if hasC else dV
        if dV <= 15: u = 'Junto a la válvula'
        elif hasC and dC <= 15: u = 'Junto a la cola'
        elif dV <= L + 40 or own <= 40: u = 'Dentro del bloque'
        else:
            dv_all = np.hypot(r.x - bc.x_v.values, r.y - bc.y_v.values); k = int(np.nanargmin(dv_all))
            if bc.bloqueId.values[k] != r.bloqueId and dv_all[k] < dV / 2:
                u = 'Junto a otro bloque'; M.at[i, 'bloque_gps'] = bc.bloque_key.values[k]
            else: u = 'Lejos de su bloque'
        M.at[i, 'ubicacion'] = u
        if hasC and u in ('Junto a la válvula', 'Junto a la cola', 'Dentro del bloque') and L > 0:
            t = ((r.x - b.x_v) * (b.x_c - b.x_v) + (r.y - b.y_v) * (b.y_c - b.y_v)) / L ** 2
            t = min(max(t, 0), 1)
            M.at[i, 'tramo'] = 'Inicio' if t < 1 / 3 else ('Mitad' if t < 2 / 3 else 'Final')

ops = {u: f'Usuario {u[:4]}' for u in M.usr.unique()}
M['fecha'] = pd.to_datetime(M.date_raw)
tipo = M.tipo.map({'PRESION VALVULA': 'Válvula', 'PRESIÓN COLA': 'Cola', 'AFORO EMISOR': 'Aforo'})
out = pd.DataFrame(dict(id=M.id, campo=M.campo_l, campo_n=M.campo_n, fecha=M.fecha.dt.strftime('%Y-%m-%d %H:%M'), dia=M.fecha.dt.strftime('%Y-%m-%d'),
    tipo=tipo, equipo=M.equipo_l, equipo_n=M.equipo_n, sector=M.sector_l, bloque=M.bloque_l, bloque_key=M.bloque_key, activo=M.activo.str.title(),
    valor=M.value.round(2), valor_original=M.valor_orig, unidad=np.where(tipo == 'Aforo', 'l/h', 'bar'), min=M.mn, optimo=M.op, max=M.mx,
    estado=M.estado, incluida=M.incluida, nota=M.nota, comentario=M.comment.str.strip(), ubicacion=M.ubicacion, bloque_gps=M.bloque_gps, tramo=M.tramo,
    dist_valvula=M.dV.round(0), dist_cola=M.dC.round(0), x=M.x.round(1), y=M.y.round(1), operador=M.usr.map(ops), foto=M.foto))
out = out.sort_values(['campo_n', 'fecha', 'tipo']).replace({np.nan: None})
json.dump(out.to_dict('records'), open('lecturas_garces.json', 'w'), ensure_ascii=False)

bo = pd.DataFrame(dict(campo=B.campo_l, campo_n=B.campo_n, equipo=B.equipo_l, equipo_n=B.equipo_n, sector=B.sector_l, bloque=B.bloque_l, bloque_key=B.bloque_key,
    valvula_x=B.x_v.round(1), valvula_y=B.y_v.round(1), cola_x=B.x_c.round(1), cola_y=B.y_c.round(1), largo_m=B.L.round(0)))
bo = bo[~bo.equipo.str.contains('Jard|Impul', case=False)]
bo = bo.drop_duplicates('bloque_key').sort_values(['campo_n', 'equipo_n', 'sector', 'bloque']).replace({np.nan: None})
json.dump(bo.to_dict('records'), open('bloques_garces.json', 'w'), ensure_ascii=False)

o = out[out.incluida == True]
print(len(out), len(bo))
print(o[o.tipo == 'Aforo'].groupby('campo').ubicacion.value_counts().unstack(fill_value=0).to_string())
print(out[out.nota != ''].nota.value_counts().to_string())
print(set(o.bloque_key) - set(bo.bloque_key))
import os; print(os.path.getsize('lecturas_garces.json'), os.path.getsize('bloques_garces.json'))
