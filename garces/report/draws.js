// Helpers, paleta Blum, filtros y valores
const loc = d3.formatLocale({decimal: ',', thousands: '.', grouping: [3], currency: ['$', '']});
const fnum = loc.format(',.2~f');
const fint = loc.format(',d');
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fdate = (s, withTime) => {
  if (!s) return '—';
  const d = +s.slice(8, 10), m = MESES[+s.slice(5, 7) - 1], y = s.slice(2, 4);
  return withTime && s.length > 10 ? `${d} ${m} ${y} ${s.slice(11, 16)}` : `${d} ${m} ${y}`;
};
// Umbrales del análisis
const LIM = {zonaM: 15, fueraKm: 1, duMin: 90};
// Paleta oficial Blum: Bosque, Turquesa; Naranjo y Rojo solo para alertas
const BL = {bosque: '#002E2B', turquesa: '#77CFC9', naranjo: '#F64500', rojo: '#C30016', bosque60: '#668280', bosque25: '#BFCBCA', naranjo45: '#FBA680', mezcla: '#3C7F7A'};
const COND = [
  {k: 'Presión baja', c: BL.naranjo}, {k: 'Presión alta', c: BL.rojo}, {k: 'Inestable', c: BL.naranjo45}, {k: 'En rango', c: BL.turquesa}
];
const UBIC = [
  {k: 'Junto a la válvula', c: BL.bosque}, {k: 'Dentro del bloque', c: BL.turquesa}, {k: 'Junto a la cola', c: BL.mezcla},
  {k: 'Junto a otro bloque', c: BL.naranjo45}, {k: 'Lejos de su bloque', c: BL.naranjo}, {k: 'Fuera del campo', c: BL.rojo}, {k: 'Sin GPS', c: BL.bosque25}
];
const CAMPO0 = '01 · Almahue';
const P = () => ({campo: dash.params().campo || CAMPO0, equipo: dash.params().equipo || ''});
const enCampo = (r) => r.campo === P().campo;
const byEq = (r) => enCampo(r) && (!P().equipo || r.equipo === P().equipo);

const tip = (host) => {
  const box = document.createElement('div');
  box.className = 'yb-tip';
  box.hidden = true;
  host.appendChild(box);
  return {
    show(lines, x, y) {
      box.replaceChildren(...lines.map((t, i) => { const d = document.createElement('div'); if (i === 0) d.className = 't1'; d.textContent = t; return d; }));
      box.hidden = false;
      const W = host.clientWidth, bw = box.offsetWidth, bh = box.offsetHeight;
      let left = x + 12; if (left + bw > W) left = Math.max(0, x - bw - 12);
      let top = y - bh - 8; if (top < 0) top = y + 12;
      box.style.left = left + 'px'; box.style.top = top + 'px';
    },
    hide() { box.hidden = true; }
  };
};
const fail = (el, st) => {
  if (st === 'error') { const d = document.createElement('div'); d.className = 'yb-fail'; d.textContent = 'Failed to load'; el.replaceChildren(d); }
  else el.replaceChildren();
};
const empty = (el, text) => { const d = document.createElement('div'); d.className = 'gx-empty'; d.textContent = text; el.replaceChildren(d); };
const textW = (svg, s, cls) => { const t = svg.append('text').attr('class', cls || null).text(s); const w = t.node().getComputedTextLength(); t.remove(); return w; };
window.GX = {fnum, fint, fdate, LIM, BL, COND, UBIC, P, enCampo, byEq, tip, fail, empty, textW};

// Pestañas
document.querySelectorAll('.gx-tab').forEach((b) => b.addEventListener('click', () => { dash.setParams({vista: b.dataset.vista}); dash.setLink(b.dataset.vista); }));
dash.onData(() => {
  const vista = dash.params().vista || 'campos';
  document.querySelectorAll('.gx-tab').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.vista === vista)));
  document.querySelectorAll('.gx-page').forEach((p) => { p.hidden = p.id !== vista; });
  document.querySelectorAll('.gx-campo-filtros').forEach((p) => { p.hidden = vista === 'campos' || vista === 'cumplimiento'; });
  document.querySelectorAll('.gx-solo-tecnico').forEach((p) => { p.hidden = vista !== 'tecnico'; });
});

// Filtros: campo (campos con mediciones) y equipo (del campo elegido)
dash.draw('campoSel', (sel) => {
  const g = dash.data('general');
  const cs = g.status === 'ok' ? g.data.filter((r) => r.campo !== 'Total').map((r) => r.campo) : [];
  sel.replaceChildren(...cs.map((c) => new Option(c, c)));
  sel.value = P().campo;
  sel.onchange = () => dash.setParams({campo: sel.value, equipo: null});
});
dash.draw('equipoSel', (sel) => {
  const g = dash.data('bloques');
  const eqs = g.status === 'ok' ? [...new Set(g.data.filter(enCampo).map((r) => r.equipo))].sort((a, b) => a.localeCompare(b, 'es', {numeric: true})) : [];
  sel.replaceChildren(new Option('Todos', ''), ...eqs.map((e) => new Option(e, e)));
  sel.value = P().equipo;
  sel.onchange = () => dash.setParams({equipo: sel.value || null});
});

// Valores sueltos. data-where-t admite {campo}, que se reemplaza por el campo elegido.
dash.draw('v', (el) => {
  const d = dash.data(el.dataset.source);
  if (el.dataset.whereT) el.dataset.where = el.dataset.whereT.split('{campo}').join(encodeURIComponent(P().campo));
  if (d.status !== 'ok') { el.textContent = '—'; return; }
  let row;
  if (el.dataset.where) {
    const conds = el.dataset.where.split('&').map((p) => p.split('=').map(decodeURIComponent));
    row = d.data.find((r) => conds.every(([k, v]) => String(r[k]) === v));
  } else row = d.data[+(el.dataset.row || 0)];
  const val = row ? row[el.dataset.field] : null;
  if (val == null) { el.textContent = '—'; return; }
  if (/^(desde|hasta|dia)$/.test(el.dataset.field)) el.textContent = fdate(String(val));
  else if (typeof val === 'number') el.textContent = fnum(val);
  else el.textContent = String(val);
});
dash.draw('k', (el) => { const v = LIM[el.dataset.k]; el.textContent = v == null ? '—' : fnum(v); });
