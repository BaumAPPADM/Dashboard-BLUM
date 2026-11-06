"""Cruza el calendario de mediciones de Ag. Garcés con los bloques medidos en blum (fechas del calendario corridas un mes)."""
import json, re, sys, unicodedata, collections, datetime

MESES_CORRIDOS = 1

def N(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().upper()
    return re.sub(r'[^A-Z0-9]+', ' ', s).strip()
def toks(s): return set(N(s).split())
def lead(s):
    m = re.match(r'(\d+)', s); return m.group(1) if m else None
def mas_meses(s, n):
    if not s: return s
    d = datetime.date.fromisoformat(s); m = d.month - 1 + n
    y, m = d.year + m // 12, m % 12 + 1
    dias = [31, 29 if y % 4 == 0 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
    return datetime.date(y, m, min(d.day, dias)).isoformat()

def main(plan, B, M):
    med, last = collections.defaultdict(set), {}
    for r in M:
        med[r['bloqueId']].add(r['tipo']); last[r['bloqueId']] = max(last.get(r['bloqueId'], ''), r['date_raw'][:10])
    campos = collections.defaultdict(list)
    for b in B: campos[N(re.sub(r'^\d+\s*-\s*', '', b['campo']))].append(b)
    code = {N(re.sub(r'^\d+\s*-\s*', '', b['campo'])): b['campo'].strip() for b in B}
    out = []
    for p in plan:
        cb = campos.get(N(p['campo']), [])
        eqs = collections.defaultdict(list)
        for b in cb: eqs[b['equipo'].strip()].append(b)
        cod = code.get(N(p['campo']), '')
        m = re.match(r'(\d+)\s*-\s*(.*)', cod)
        lbl, n = (f"{m.group(1)} · {m.group(2).strip()}", int(m.group(1))) if m else (p['campo'].title(), 99)
        for it in p['items']:
            pe = N(it['equipo']).replace('EQUIPO', '', 1).strip()
            cands = sorted(((len(toks(pe) & toks(N(e).replace('EQUIPO', '', 1))) / max(1, len(toks(pe) | toks(N(e).replace('EQUIPO', '', 1)))), e)
                            for e in eqs if not (lead(pe) and lead(pe) != lead(N(e).replace('EQUIPO', '', 1).strip()))), reverse=True)
            hit = None
            for _, e in cands[:3]:
                secs = collections.defaultdict(list)
                for b in eqs[e]: secs[b['sector'].strip()].append(b)
                ps = N('SECTOR ' + it['sector'])
                ex = [s for s in secs if N(s) == ps]
                if ex: hit = (e, ex[0], secs[ex[0]]); break
                ln = lead(N(it['sector']))
                best = sorted(((len(toks(ps) & toks(s)) / max(1, len(toks(ps) | toks(s))), s) for s in secs if lead(N(s).replace('SECTOR', '').strip()) == ln), reverse=True)
                if best and best[0][0] >= 0.5: hit = (e, best[0][1], secs[best[0][1]]); break
            medidos, ult, eb, sb = 0, None, '', ''
            if hit:
                eb, sb, bl = hit
                mids = [b['bloqueId'] for b in bl if b['bloqueId'] in med]
                medidos = min(len(set(mids)), it['bloques']); ult = max([last[i] for i in mids], default=None)
            est = 'Completo' if medidos >= it['bloques'] else ('Parcial' if medidos > 0 else 'Pendiente')
            out.append(dict(id=f"{lbl}|{len(out) + 1}", campo=lbl, campo_n=n, inicio=mas_meses(p['inicio'], MESES_CORRIDOS), fin=mas_meses(p['fin'], MESES_CORRIDOS),
                inicio_original=p['inicio'], fin_original=p['fin'], categoria=it['categoria'], equipo=it['equipo'], sector='Sector ' + it['sector'],
                equipo_blum=eb, sector_blum=sb, bloques_plan=it['bloques'], bloques_medidos=medidos, pendientes=it['bloques'] - medidos, estado=est, ultima=ult))
    return out

if __name__ == '__main__':
    d, plan_path = sys.argv[1], sys.argv[2]
    plan = json.load(open(plan_path))
    out = main(plan, json.load(open(f'{d}/blocks.json')), json.load(open(f'{d}/meter.json')))
    json.dump(out, open(f'{d}/plan_garces.json', 'w'), ensure_ascii=False)
    print('plan', len(out))
