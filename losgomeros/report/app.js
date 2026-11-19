// Informe Ag. Los Gomeros (versión corta): plan global, bloques, mapa de aforos y detalle.
(function () {
  const dash = window.dash, D = dash.D, P = dash.P;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const f = (n, d = 1) => n == null || isNaN(n) ? '—' : Number(n).toLocaleString('es-CL', {maximumFractionDigits: d, minimumFractionDigits: 0});
  const fd = (s) => s ? s.slice(0, 10).split('-').reverse().join('-') + (s.length > 10 ? ' ' + s.slice(11, 16) : '') : '—';
  const corto = (k) => k.replace(/^Equipo (\d+) · /, 'E$1 ').replace('Sector ', 'S').replace('Bloque ', 'B');
  const chip = (e) => e ? `<span class="yb-chip ${e === 'En rango' ? 'ok' : e === 'Bajo' ? 'low' : e === 'Alto' ? 'alert' : 'mid'}">${esc(e)}</span>` : '';
  const opts = (sel, arr, todos) => { sel.innerHTML = (todos ? `<option value="">${todos}</option>` : '') + arr.map((a) => `<option>${esc(a)}</option>`).join(''); };
  const L = D.lecturas, BL = D.bloques, CS = D.casetas, M = D.meta;
  const LI = L.filter((x) => x.incluida);
  const bkey = (x) => `${x.equipo} · ${x.sector} · ${x.bloque}`;
  const BK = Object.fromEntries(BL.map((b) => [b.key, b]));
  const equipos = M.equipos;
  const afs = LI.filter((x) => x.tipo === 'Aforo');

  // ---------- acciones por bloque (una por tipo de problema, sin repetir texto)
  const V = (b) => b.valvula && b.valvula.estado, A = (b) => b.aforo && b.aforo.estado;
  BL.forEach((b) => {
    const t = [];
    if (b.registro_dudoso) t.push('Confirmar registro');
    if (V(b) === 'Bajo') t.push('Subir presión');
    if (V(b) === 'Alto') t.push('Bajar presión');
    if (A(b) === 'Bajo' && V(b) !== 'Bajo') t.push('Limpiar goteros');
    if (b.aforo && b.aforo.cu != null && b.aforo.cu < 90) t.push('Revisar uniformidad');
        b.tags = t.length ? t : ['Sin acción'];
  });
  const con = (tag) => BL.filter((b) => b.tags.includes(tag));
  const lista = (bs) => { const g = {}; bs.forEach((b) => (g[b.equipo] = g[b.equipo] || []).push(`${b.sector.replace('Sector ', 'S')}·${b.bloque.replace('Bloque ', 'B')}`));
    return Object.entries(g).map(([e, v]) => `${e.replace(/^Equipo (\d+) · /, 'E$1 ')} (${v.join(', ')})`).join('; '); };

  // ---------- encabezado
  $('h-desde').textContent = fd(M.desde); $('h-hasta').textContent = fd(M.hasta); $('h-upd').textContent = P.actualizado || '—';
  const vals = BL.filter((b) => b.valvula), vFuera = vals.filter((b) => V(b) !== 'En rango');
  const afBajo = afs.filter((x) => { const b = BK[bkey(x)]; return b && b.aforo && x.valor < b.aforo.min; });
  $('h-kpis').innerHTML = [
    ['Bloques medidos', `${M.bloques_medidos}<small>/ ${M.bloques_total}</small>`, ''],
    ['Válvulas fuera de rango', `${vFuera.length}<small>/ ${vals.length}</small>`, vFuera.length ? 'warn' : ''],
    ['Aforos bajo el mínimo', `${afBajo.length}<small>/ ${afs.length}</small>`, afBajo.length ? 'warn' : '']
  ].map(([k, v, c]) => `<div class="kpi"><span>${k}</span><b class="${c}">${v}</b></div>`).join('');

  // ---------- qué hacer, en orden (plan para el equipo del cliente)
  const sb = (b) => `${b.sector.replace('Sector ', 'S')}·${b.bloque.replace('Bloque ', 'B')}`;
  const eqc = (e) => e.replace(/^Equipo (\d+) · /, 'E$1 ');
  const porEq = (bs, fn) => { const g = {}; bs.forEach((b) => (g[b.equipo] = g[b.equipo] || []).push(fn(b)));
    return Object.entries(g).map(([e, v]) => `${eqc(e)}: ${v.join('; ')}`).join('. ') + '.'; };
  const pasos = [];
  CS.filter((c) => c.prioridad === 'Alta').forEach((c) => {
    const dp = c.entrada != null && c.salida != null ? c.entrada - c.salida : null;
    pasos.push(['Alta', `${c.caseta}: retrolavar y limpiar los filtros y revisar la bomba`,
      `Se midió ${f(c.entrada)} bar antes de los filtros y ${f(c.salida)} bar después: se pierden ${f(dp)} bar (lo normal es hasta 0,5)${c.caudal != null ? `. Caudal ${f(c.caudal)} m³/h, bajo lo esperado` : ''}. Al terminar, medir de nuevo entrada, salida y caudal.`]);
  });
  const sub = con('Subir presión');
  if (sub.length) pasos.push(['Alta', 'Subir la presión de estas válvulas (piloto o regulador)',
    'Una vez limpia la caseta. ' + porEq(sub, (b) => `${sb(b)} de ${f(b.valvula.valor)} a ${f(b.valvula.min, 2)}–${f(b.valvula.max, 2)} bar`)]);
  const lim = con('Limpiar goteros');
  if (lim.length) pasos.push(['Media', 'Limpiar goteros y lavar laterales',
    'La válvula está bien, pero los goteros entregan menos de lo que deben. ' + porEq(lim, (b) => `${sb(b)} (${f(b.aforo.pct, 0)}% del caudal nominal)`)]);
  const baj = con('Bajar presión');
  if (baj.length) pasos.push(['Baja', 'Bajar la presión de estas válvulas',
    porEq(baj, (b) => `${sb(b)} de ${f(b.valvula.valor)} a ${f(b.valvula.min, 2)}–${f(b.valvula.max, 2)} bar`)]);
  const conf = con('Confirmar registro');
  const sinCola = BL.filter((b) => !b.cola).length, pocosAf = BL.filter((b) => !b.aforo || b.aforo.n < 3).length;
  pasos.push(['', 'Próxima medición',
    `En cada bloque medir válvula, cola y 3 aforos (inicio, mitad y final de la hilera); hoy falta la cola en ${sinCola} de ${BL.length} bloques y hay menos de 3 aforos en ${pocosAf}.` +
    (conf.length ? ` Al registrar en la app, elegir el bloque donde se está midiendo: ${conf.map((b) => `${eqc(b.equipo)} ${sb(b)}`).join(' y ')} quedaron registrados en otro lugar del campo.` : '') +
    ` Van ${M.bloques_medidos} de ${M.bloques_total} bloques medidos.`]);
  $('pasos').innerHTML = pasos.map(([p, t, x]) => `<li class="${p}"><div><b>${esc(t)}</b>${p ? ` <span class="yb-chip ${p}">${p}</span>` : ''}</div><span>${esc(x)}</span></li>`).join('');

  // ---------- tabla de bloques
  const cel = (o, d = 1) => o ? `<span class="lg-v ${o.estado.split(' ')[0]}">${f(o.valor, d)}</span>` : '<span class="gx-muted">—</span>';
  $('t-sema').innerHTML = BL.map((b) => `<tr><td><span class="yb-chip ${b.prioridad}">${b.prioridad}</span></td><td>${esc(b.key)}</td>
    <td class="num">${cel(b.valvula)}</td><td class="num">${cel(b.cola)}</td>
    <td class="num">${b.aforo ? `<span class="lg-v ${(b.aforo.estado || '').split(' ')[0]}">${f(b.aforo.pct, 0)}%</span>` : '<span class="gx-muted">—</span>'}</td>
    <td>${b.tags.map((x) => x === 'Confirmar registro' ? 'Verificar bloque al registrar' : x).map(esc).join(' · ')}</td></tr>`).join('');

  // ---------- detalle
  $('t-caseta').innerHTML = LI.filter((x) => x.caseta).map((x) => `<tr><td>${fd(x.fecha)}</td><td>${esc(x.sector)} · ${esc(x.bloque)}</td><td>${esc(x.tipo)}</td><td class="num">${f(x.valor)} ${x.unidad}</td><td class="num">${f(x.min, 2)}</td><td class="num">${f(x.max, 2)}</td><td>${chip(x.estado)}</td></tr>`).join('') || '<tr><td colspan="7" class="gx-muted">Sin mediciones de caseta.</td></tr>';
  $('t-af').innerHTML = BL.filter((b) => b.aforo).map((b) => `<tr><td>${esc(b.key)}</td><td class="num">${b.aforo.n}</td><td class="num">${f(b.aforo.prom, 2)}</td><td class="num">${f(b.aforo.nominal)}</td><td class="num">${b.aforo.cu != null ? f(b.aforo.cu) : '—'}</td></tr>`).join('');
  opts($('f-tipo'), [...new Set(L.map((x) => x.tipo))], 'Todos');
  opts($('f-estado'), [...new Set(L.map((x) => x.estado))], 'Todos');
  opts($('f-eq-det'), [...new Set(L.map((x) => x.equipo))].sort(), 'Todos');
  function detalle() {
    const t = $('f-tipo').value, e = $('f-estado').value, q = $('f-eq-det').value, s = $('f-q').value.trim().toLowerCase();
    const r = L.filter((x) => (!t || x.tipo === t) && (!e || x.estado === e) && (!q || x.equipo === q) && (!s || [x.sector, x.bloque, x.activo, x.comentario, x.equipo].join(' ').toLowerCase().includes(s)));
    $('t-det').innerHTML = r.map((x) => `<tr class="${x.incluida ? '' : 'gx-excl'}"><td>${fd(x.fecha)}</td><td>${esc(x.tipo)}</td><td>${esc(bkey(x))}</td><td class="num">${f(x.valor, 2)} ${x.unidad}</td><td class="num">${f(x.min, 2)}</td><td class="num">${f(x.max, 2)}</td><td>${chip(x.estado)}</td>
      <td>${esc(x.ubicacion)}${x.bloque_gps ? ' (' + esc(corto(x.bloque_gps)) + ')' : ''}</td><td class="gx-wrap">${esc(x.comentario)}</td></tr>`).join('');
    $('det-n').textContent = `${r.length} lecturas.`;
  }
  ['f-tipo', 'f-estado', 'f-eq-det'].forEach((i) => $(i).onchange = detalle); $('f-q').oninput = detalle;

  // ---------- mapa
  const eqMapa = equipos.filter((e) => LI.some((x) => !x.caseta && x.equipo === e && x.lat));
  const nAf = (e) => afs.filter((x) => x.equipo === e).length;
  eqMapa.sort((a, b) => nAf(b) - nAf(a));
  opts($('f-eq-mapa'), eqMapa);
  if (P.mapaEq && eqMapa.includes(P.mapaEq)) $('f-eq-mapa').value = P.mapaEq;
  $('f-eq-mapa').onchange = () => mapa();
  const dudB = BL.filter((b) => b.registro_dudoso);
  $('mapa-take').innerHTML = `${afs.length} aforos en ${new Set(afs.map(bkey)).size} bloques. ` + (dudB.length ? `Las lecturas de ${dudB.map((b) => corto(b.key)).join(' y ')} quedaron junto a otro bloque (ver equipo 2).` : '');
  function mapa() {
    const el = $('mapa-svg'), eq = $('f-eq-mapa').value; if (!eq) { el.innerHTML = '<div class="gx-empty">Sin aforos con GPS.</div>'; return; }
    const pts = LI.filter((x) => !x.caseta && x.equipo === eq && x.lat).sort((a, b) => (a.tipo === 'Aforo') - (b.tipo === 'Aforo'));
    const bls = BL.filter((b) => b.equipo === eq && b.vlat);
    const all = [...pts.map((x) => [x.lat, x.lon]), ...bls.map((b) => [b.vlat, b.vlon])];
    let la0 = Math.min(...all.map((p) => p[0])), la1 = Math.max(...all.map((p) => p[0])), lo0 = Math.min(...all.map((p) => p[1])), lo1 = Math.max(...all.map((p) => p[1]));
    const kx = Math.cos(la0 * Math.PI / 180) * 111320, ky = 110540;
    let w = (lo1 - lo0) * kx, h = (la1 - la0) * ky; const padM = Math.max(40, 0.18 * Math.max(w, h));
    const W = el.clientWidth || 800, H = Math.max(420, Math.min(560, W * 0.62)), m = 28;
    const sc = Math.min((W - 2 * m) / (w + 2 * padM), (H - 2 * m) / (h + 2 * padM));
    const ox = m + ((W - 2 * m) - (w + 2 * padM) * sc) / 2, oy = m + ((H - 2 * m) - (h + 2 * padM) * sc) / 2;
    const X = (lo) => ox + ((lo - lo0) * kx + padM) * sc, Y = (la) => oy + ((la1 - la) * ky + padM) * sc;
    const inView = (la, lo) => X(lo) > 0 && X(lo) < W && Y(la) > 0 && Y(la) < H;
    const ctx = D.valvulas.filter((v) => inView(v.lat, v.lon) && !bls.some((b) => b.key === v.key));
    const s = [], boxes = [];
    const lab = (x, y, txt, cls = '', anchor = 'start', style = '') => {
      const w = txt.length * 6.2, h = 12; let yy = y;
      const x0 = anchor === 'end' ? x - w : x;
      for (let k = 0; k < 8 && boxes.some((b) => x0 < b[0] + b[2] && x0 + w > b[0] && yy - h < b[1] && yy > b[1] - b[3]); k++) yy += 13;
      boxes.push([x0, yy, w, h]);
      return `<text class="${cls}" x="${x}" y="${yy}" text-anchor="${anchor}" style="${style}">${esc(txt)}</text>`;
    };
    s.push(`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Mapa de mediciones de ${esc(eq)}">`);
    ctx.forEach((v) => s.push(`<g data-t="${esc('Válvula en blum · ' + v.key)}"><rect x="${X(v.lon) - 3}" y="${Y(v.lat) - 3}" width="6" height="6" transform="rotate(45 ${X(v.lon)} ${Y(v.lat)})" fill="#FFFFFF" stroke="#BFCBCA" stroke-width="1.5"/>${pts.some((x) => Math.hypot(X(x.lon) - X(v.lon), Y(x.lat) - Y(v.lat)) < 90) ? lab(X(v.lon) + 7, Y(v.lat) + 3, corto(v.key), 'ctx') : ''}</g>`));
    // líneas aforo → válvula de su bloque
    pts.filter((x) => x.tipo === 'Aforo').forEach((x) => { const b = BK[bkey(x)]; if (b && b.vlat) s.push(`<line x1="${X(x.lon)}" y1="${Y(x.lat)}" x2="${X(b.vlon)}" y2="${Y(b.vlat)}" stroke="#5C6F6D" stroke-width="1" stroke-dasharray="3 3" opacity=".7"/>`); });
    bls.forEach((b) => s.push(`<g data-t="${esc('Válvula en blum · ' + b.key)}"><rect x="${X(b.vlon) - 6}" y="${Y(b.vlat) - 6}" width="12" height="12" transform="rotate(45 ${X(b.vlon)} ${Y(b.vlat)})" fill="none" stroke="#5C6F6D" stroke-width="2" stroke-dasharray="3 2"/>${lab(X(b.vlon) + 11, Y(b.vlat) - 8, corto(b.key), '', 'start', 'font-weight:600')}</g>`));
    const col = (e) => e === 'Bajo' ? '#F64500' : e === 'Alto' ? '#C30016' : '#77CFC9';
    pts.forEach((x) => {
      const cx = X(x.lon), cy = Y(x.lat), b = BK[bkey(x)];
      const tip = `<b>${esc(x.tipo)} · ${f(x.valor, 2)} ${x.unidad}</b><br>${esc(bkey(x))}<br>${fd(x.fecha)}` + (x.dist_valvula != null ? `<br>A ${f(x.dist_valvula, 0)} m de la válvula de su bloque` : '') + (x.bloque_gps ? `<br>Junto a ${esc(x.bloque_gps)}` : '') + (x.comentario ? `<br>«${esc(x.comentario)}»` : '');
      if (x.tipo === 'Aforo') {
        const pct = b && b.aforo ? 100 * x.valor / b.aforo.nominal : 100, c = pct < 80 ? '#C30016' : (b && x.valor < b.aforo.min ? '#F64500' : '#77CFC9');
        s.push(`<g data-h="${esc(tip + `<br>${f(pct, 0)}% del nominal`)}"><circle cx="${cx}" cy="${cy}" r="7" fill="${c}" stroke="#002E2B" stroke-width="1.5"/>${lab(cx + 9, cy + 14, f(x.valor) + ' l/h')}</g>`);
      } else if (x.tipo === 'Válvula') {
        s.push(`<g data-h="${esc(tip + `<br>Óptimo ${f(x.min, 2)}–${f(x.max, 2)} bar`)}"><rect x="${cx - 6}" y="${cy - 6}" width="12" height="12" transform="rotate(45 ${cx} ${cy})" fill="${x.estado === 'En rango' ? '#002E2B' : col(x.estado)}" stroke="#002E2B" stroke-width="1.5"/>${lab(cx - 12, cy + 4, f(x.valor) + ' bar', '', 'end')}</g>`);
      } else {
        s.push(`<g data-h="${esc(tip + `<br>Óptimo ${f(x.min, 2)}–${f(x.max, 2)} bar`)}"><rect x="${cx - 6}" y="${cy - 6}" width="12" height="12" fill="${x.estado === 'En rango' ? '#FFFFFF' : col(x.estado)}" stroke="#002E2B" stroke-width="2"/>${lab(cx + 9, cy - 8, 'cola ' + f(x.valor) + ' bar')}</g>`);
      }
    });
    // escala
    const nice = [10, 20, 50, 100, 200, 500].find((d) => d * sc > 60) || 500;
    s.push(`<g transform="translate(${m},${H - 14})"><line x1="0" x2="${nice * sc}" y1="0" y2="0" stroke="#002E2B" stroke-width="2"/><line x1="0" x2="0" y1="-4" y2="4" stroke="#002E2B"/><line x1="${nice * sc}" x2="${nice * sc}" y1="-4" y2="4" stroke="#002E2B"/><text x="${nice * sc + 6}" y="4">${nice} m</text></g>`);
    s.push(`<g transform="translate(${W - 22},30)"><path d="M0,-14 L5,4 L0,0 L-5,4 Z" fill="#002E2B"/><text x="0" y="16" text-anchor="middle">N</text></g></svg><div class="lg-tip" hidden></div>`);
    el.innerHTML = s.join('');
    const tipEl = el.querySelector('.lg-tip');
    el.querySelectorAll('g[data-h],g[data-t]').forEach((g) => {
      g.style.cursor = 'default';
      g.addEventListener('mousemove', (ev) => { const r = el.getBoundingClientRect(); tipEl.innerHTML = g.dataset.h || esc(g.dataset.t); tipEl.hidden = false;
        tipEl.style.left = Math.min(ev.clientX - r.left + 14, W - 260) + 'px'; tipEl.style.top = (ev.clientY - r.top + 14) + 'px'; });
      g.addEventListener('mouseleave', () => tipEl.hidden = true);
    });
  }

  
  // ---------- pestañas
  const vistas = ['plan', 'mapa', 'presiones', 'tecnico'];
  function irA(v) {
    if (!vistas.includes(v)) v = 'plan';
    vistas.forEach((k) => $(k).hidden = k !== v);
    document.querySelectorAll('.gx-tab').forEach((b) => b.setAttribute('aria-pressed', b.dataset.vista === v));
    history.replaceState(null, '', '#' + v);
    if (v === 'mapa') mapa();
  }
  document.querySelectorAll('.gx-tab').forEach((b) => b.addEventListener('click', () => irA(b.dataset.vista)));
  let t = null; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (!$('mapa').hidden) mapa(); }, 200); });

  dash.render = () => { detalle(); irA(P.vista); };
})();
