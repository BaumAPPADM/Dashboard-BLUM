// Informe Ag. Los Gomeros: pestañas, tablas, plan de acción y mapa de aforos.
(function () {
  const dash = window.dash, D = dash.D, P = dash.P;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const f = (n, d = 1) => n == null || isNaN(n) ? '—' : Number(n).toLocaleString('es-CL', {maximumFractionDigits: d, minimumFractionDigits: 0});
  const fd = (s) => s ? s.slice(0, 10).split('-').reverse().join('-') + (s.length > 10 ? ' ' + s.slice(11, 16) : '') : '—';
  const corto = (k) => k.replace(/^Equipo (\d+) · /, 'E$1 ').replace('Sector ', 'S').replace('Bloque ', 'B');
  const chip = (e) => e ? `<span class="yb-chip ${e === 'En rango' ? 'ok' : e === 'Bajo' ? 'low' : e === 'Alto' ? 'alert' : 'mid'}">${esc(e)}</span>` : '';
  const val = (o, d = 1) => o ? `<span class="lg-v ${o.estado.split(' ')[0]}">${f(o.valor, d)}</span>` : '<span class="gx-muted">—</span>';
  const opts = (sel, arr, todos) => { sel.innerHTML = (todos ? `<option value="">${todos}</option>` : '') + arr.map((a) => `<option>${esc(a)}</option>`).join(''); };
  const L = D.lecturas, BL = D.bloques, CS = D.casetas, M = D.meta;
  const LI = L.filter((x) => x.incluida);
  const bkey = (x) => `${x.equipo} · ${x.sector} · ${x.bloque}`;
  const BK = Object.fromEntries(BL.map((b) => [b.key, b]));

  // ---------- encabezado
  $('h-desde').textContent = fd(M.desde); $('h-hasta').textContent = fd(M.hasta); $('h-upd').textContent = P.actualizado || '—';
  const vals = BL.filter((b) => b.valvula), vFuera = vals.filter((b) => b.valvula.estado !== 'En rango');
  const afs = LI.filter((x) => x.tipo === 'Aforo');
  const afBajo = afs.filter((x) => { const b = BK[bkey(x)]; return b && b.aforo && x.valor < b.aforo.min; });
  const altas = BL.filter((b) => b.prioridad === 'Alta').length + CS.filter((c) => c.prioridad === 'Alta').length;
  $('h-kpis').innerHTML = [
    ['Bloques medidos', `${M.bloques_medidos}<small>/ ${M.bloques_total}</small>`, ''],
    ['Válvulas fuera de rango', `${vFuera.length}<small>/ ${vals.length}</small>`, vFuera.length ? 'warn' : ''],
    ['Aforos bajo el mínimo', `${afBajo.length}<small>/ ${afs.length}</small>`, afBajo.length ? 'warn' : ''],
    ['Acciones de prioridad alta', `${altas}`, altas ? 'warn' : '']
  ].map(([k, v, c]) => `<div class="kpi"><span>${k}</span><b class="${c}">${v}</b></div>`).join('');

  // ---------- observaciones
  const obs = [];
  CS.filter((c) => c.prioridad === 'Alta').forEach((c) => obs.push(['alert', 'Caseta', `${c.caseta} · ${c.equipo}`, c.diagnostico + ' Es lo primero a revisar: una presión baja a la salida llega baja a todas las válvulas del equipo.']));
  if (vals.length) {
    const peor = [...vFuera].sort((a, b) => a.valvula.valor / a.valvula.min - b.valvula.valor / b.valvula.min)[0];
    const porEq = {}; vFuera.forEach((b) => porEq[b.equipo] = (porEq[b.equipo] || 0) + 1);
    const eqTop = Object.entries(porEq).sort((a, b) => b[1] - a[1])[0];
    obs.push([vFuera.length ? 'alert' : '', 'Presión de válvula', `${vFuera.length} de ${vals.length} válvulas fuera de rango`,
      vFuera.length ? `${eqTop[1]} están en ${eqTop[0]} (de ${vals.filter((b) => b.equipo === eqTop[0]).length} medidas en ese equipo). La más baja: <b>${f(peor.valvula.valor)} bar</b> en ${corto(peor.key)} (mínimo ${f(peor.valvula.min, 2)} bar).` : 'Todas las válvulas medidas están en su rango.']);
  }
  if (afs.length) {
    const peorA = [...afs].sort((a, b) => a.valor / (BK[bkey(a)]?.aforo?.nominal || 1) - b.valor / (BK[bkey(b)]?.aforo?.nominal || 1))[0];
    const nomP = BK[bkey(peorA)]?.aforo?.nominal;
    obs.push([afBajo.length ? 'alert' : '', 'Aforos', `${afBajo.length} de ${afs.length} aforos bajo el mínimo`,
      `El más bajo: <b>${f(peorA.valor)} l/h</b> (${f(100 * peorA.valor / nomP, 0)}% del nominal) en ${corto(bkey(peorA))}. Cuando la válvula también está baja, corregir la presión es lo primero; si la válvula está en rango, revisar goteros y laterales.`]);
  }
  const dud = BL.filter((b) => b.registro_dudoso);
  if (dud.length) obs.push(['alert', 'Registro', `${dud.length} bloque${dud.length > 1 ? 's' : ''} con lecturas fuera de su lugar`,
    `${dud.map((b) => corto(b.key)).join(' y ')}: el GPS de las lecturas quedó lejos de su válvula y junto a otro bloque. Confirmar en qué bloque se midió antes de actuar.`]);
  const conCola = BL.filter((b) => b.cola).length, sinTramo = afs.filter((x) => !['Inicio', 'Mitad', 'Final'].includes(x.tramo)).length;
  obs.push(['', 'Cobertura', `${M.bloques_medidos} de ${M.bloques_total} bloques medidos en ${M.visitas} visitas`,
    `Solo ${conCola} bloque${conCola === 1 ? '' : 's'} tiene${conCola === 1 ? '' : 'n'} presión de cola, por lo que en ${sinTramo} de ${afs.length} aforos no se sabe en qué parte de la hilera se tomaron. En cada bloque conviene medir válvula, cola y 3 aforos (inicio, mitad y final).`]);
  $('obs').innerHTML = obs.map(([c, t, l, x]) => `<li class="${c}"><span class="tag">${t}</span><span class="lead">${l}</span>${x}</li>`).join('');

  // ---------- semáforo
  $('t-sema').innerHTML = BL.map((b, i) => `<tr class="gx-click" data-i="${i}"><td><span class="yb-chip ${b.prioridad}">${b.prioridad}</span></td><td>${esc(b.key)}${b.registro_dudoso ? ' <span class="yb-chip low">verificar registro</span>' : ''}</td>
    <td class="num">${val(b.valvula)}</td><td class="num">${val(b.cola)}</td>
    <td class="num">${b.aforo ? `<span class="lg-v ${(b.aforo.estado || '').split(' ')[0]}">${f(b.aforo.prom, 2)}</span>` : '<span class="gx-muted">—</span>'}</td>
    <td class="num">${b.aforo ? f(b.aforo.pct, 0) + '%' : '—'}</td><td class="num">${b.aforo && b.aforo.cu != null ? f(b.aforo.cu) : '—'}</td><td>${fd(b.ultima)}</td></tr>`).join('');
  $('t-sema').querySelectorAll('tr').forEach((tr) => tr.addEventListener('click', () => { irA('plan'); const el = $('pl-' + tr.dataset.i); if (el) { el.scrollIntoView({behavior: 'smooth', block: 'center'}); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600); } }));

  // ---------- plan de acción
  const equipos = M.equipos;
  opts($('f-eq-plan'), equipos, 'Todos');
  function plan() {
    const pr = $('f-prio').value, eq = $('f-eq-plan').value;
    const items = [
      ...CS.map((c) => ({id: 'c', pri: c.prioridad, eq: c.equipo, tit: `${c.caseta} · ${c.equipo}`, diag: c.diagnostico, acc: c.acciones, meta: `Última medición ${fd(c.ultima)}`})),
      ...BL.map((b, i) => ({id: i, pri: b.prioridad, eq: b.equipo, tit: b.key, diag: b.diagnostico, acc: b.acciones, meta: `Última medición ${fd(b.ultima)}`}))
    ].filter((x) => (!pr || x.pri === pr) && (!eq || x.eq === eq));
    $('plan-list').innerHTML = items.length ? items.map((x) => `<article class="lg-item ${x.pri}" id="pl-${x.id}"><div class="lg-meta"><span class="yb-chip ${x.pri}">Prioridad ${x.pri.toLowerCase()}</span><span>${x.meta}</span></div>
      <div><h3>${esc(x.tit)}</h3><p>${esc(x.diag)}</p><ol>${x.acc.map((a) => `<li>${esc(a)}</li>`).join('')}</ol></div></article>`).join('') : '<div class="gx-empty">Sin acciones para este filtro.</div>';
  }
  $('f-prio').onchange = plan; $('f-eq-plan').onchange = plan;

  // ---------- aplicado a Los Arroyos
  const ap = [];
  CS.forEach((c) => { if (c.salida != null && c.entrada != null) ap.push(`<b>${c.caseta}:</b> la pérdida en filtros es de ${f(c.entrada - c.salida)} bar (lo normal es 0,3–0,5). Retrolavar y limpiar filtros y revisar la bomba debiera subir la presión en las válvulas de ${c.equipo}.`); });
  vFuera.filter((b) => b.valvula.estado === 'Bajo').forEach((b) => ap.push(`<b>${corto(b.key)}:</b> válvula en ${f(b.valvula.valor)} bar; llevarla a ${f(b.valvula.min, 2)}–${f(b.valvula.max, 2)} bar calibrando el piloto o regulador, una vez revisada la caseta.`));
  vFuera.filter((b) => b.valvula.estado === 'Alto').forEach((b) => ap.push(`<b>${corto(b.key)}:</b> válvula en ${f(b.valvula.valor)} bar, sobre el máximo de ${f(b.valvula.max, 2)} bar: bajarla calibrando el piloto.`));
  BL.filter((b) => b.valvula && b.valvula.estado === 'En rango' && b.aforo && b.aforo.estado === 'Bajo').forEach((b) => ap.push(`<b>${corto(b.key)}:</b> la válvula está bien pero los goteros entregan ${f(b.aforo.pct, 0)}% del nominal: limpiar goteros y lavar laterales${b.registro_dudoso ? ', una vez confirmado en qué bloque se midió' : ''}.`));
  $('aplicado').innerHTML = ap.map((x) => `<li>${x}</li>`).join('');

  // ---------- técnico
  const cas = LI.filter((x) => x.caseta);
  $('t-caseta').innerHTML = cas.map((x) => `<tr><td>${fd(x.fecha)}</td><td>${esc(x.equipo)}</td><td>${esc(x.sector)} · ${esc(x.bloque)}</td><td>${esc(x.tipo)}</td><td class="num">${f(x.valor)} ${x.unidad}</td><td class="num">${f(x.min, 2)}</td><td class="num">${f(x.max, 2)}</td><td>${chip(x.estado)}</td></tr>`).join('') || '<tr><td colspan="8" class="gx-muted">Sin mediciones de caseta.</td></tr>';
  const vv = LI.filter((x) => x.tipo === 'Válvula');
  const prom = (a) => a.length ? a.reduce((s, x) => s + x.valor, 0) / a.length : null;
  $('tiles-v').innerHTML = [
    ['Bajo el mínimo', vv.filter((x) => x.estado === 'Bajo').length, `de ${vv.length} lecturas`, 1],
    ['Sobre el máximo', vv.filter((x) => x.estado === 'Alto').length, 'lecturas', 0],
    ['Presión promedio', f(prom(vv)) + '<small> bar</small>', 'en las válvulas medidas', 0]
  ].map(([l, b, ft, a]) => `<div class="yb-tile ${a && b ? 'is-alert' : ''}"><span class="lbl">${l}</span><span class="big">${b}</span><span class="foot">${ft}</span></div>`).join('');
  $('t-val').innerHTML = vv.map((x) => `<tr><td>${fd(x.fecha)}</td><td>${esc(bkey(x))}</td><td class="num">${f(x.valor)}</td><td class="num">${f(x.min, 2)}</td><td class="num">${f(x.optimo, 2)}</td><td class="num">${f(x.max, 2)}</td><td>${chip(x.estado)}</td></tr>`).join('');
  $('t-cola').innerHTML = LI.filter((x) => x.tipo === 'Cola').map((x) => { const b = BK[bkey(x)]; const v = b && b.valvula && b.valvula.dia === x.dia ? f(b.valvula.valor) : '—';
    return `<tr><td>${fd(x.fecha)}</td><td>${esc(bkey(x))}</td><td class="num">${f(x.valor)}</td><td class="num">${f(x.min, 2)}</td><td class="num">${f(x.max, 2)}</td><td class="num">${v}</td><td>${chip(x.estado)}</td></tr>`; }).join('');
  $('t-af').innerHTML = BL.filter((b) => b.aforo).map((b) => `<tr><td>${esc(b.key)}</td><td class="num">${b.aforo.n}</td><td class="num">${f(b.aforo.prom, 2)}</td><td class="num">${f(b.aforo.nominal)}</td><td class="num">${f(b.aforo.pct, 0)}%</td><td class="num">${b.aforo.cu != null ? f(b.aforo.cu) : '—'}</td><td>${chip(b.aforo.estado)}</td></tr>`).join('');
  const cnt = (re) => L.filter((x) => re.test(x.nota)).length;
  $('limpieza').innerHTML = [
    `Aforos de 10 l/h o más se corrigen por decimal omitido (÷10): ${cnt(/decimal/)}.`,
    `Presiones de 5 bar o más se excluyen: ${cnt(/fuera de escala/)}.`,
    `Equipos de jardín o impulsión y lecturas de prueba se excluyen: ${cnt(/jardín|fuera de los bloques|prueba/i)}.`,
    `Aforos sobre el doble del nominal o bajo 0,2 l/h se marcan: ${cnt(/doble|casi nulo/)}.`,
    `Rango de válvula cargado ×10 en blum (m.c.a.), convertido a bar: ${cnt(/×10/)} lecturas.`,
    `Nominal de gotero distinto al del resto del campo, evaluado con ${f(M.nominal_comun)} l/h: ${cnt(/Nominal cargado/)} aforos.`,
    `Lecturas de caseta con varios rangos cargados (se usa el más amplio): ${cnt(/rangos cargados/)}.`,
    `Lecturas consideradas: ${LI.length} de ${L.length}.`
  ].map((x) => `<li>${x}</li>`).join('');

  // detalle filtrable
  opts($('f-tipo'), [...new Set(L.map((x) => x.tipo))], 'Todos');
  opts($('f-estado'), [...new Set(L.map((x) => x.estado))], 'Todos');
  opts($('f-eq-det'), [...new Set(L.map((x) => x.equipo))].sort(), 'Todos');
  function detalle() {
    const t = $('f-tipo').value, e = $('f-estado').value, q = $('f-eq-det').value, s = $('f-q').value.trim().toLowerCase();
    const r = L.filter((x) => (!t || x.tipo === t) && (!e || x.estado === e) && (!q || x.equipo === q) && (!s || [x.sector, x.bloque, x.activo, x.comentario, x.nota, x.equipo].join(' ').toLowerCase().includes(s)));
    $('t-det').innerHTML = r.map((x) => `<tr class="${x.incluida ? '' : 'gx-excl'}"><td>${fd(x.fecha)}</td><td>${esc(x.tipo)}</td><td>${esc(x.equipo)}</td><td>${esc(x.sector)}</td><td>${esc(x.bloque)}</td><td class="num">${f(x.valor, 2)}</td><td>${x.unidad}</td><td class="num">${f(x.min, 2)}</td><td class="num">${f(x.max, 2)}</td><td>${chip(x.estado)}</td>
      <td>${esc(x.ubicacion)}${x.bloque_gps ? ' (' + esc(corto(x.bloque_gps)) + ')' : ''}</td><td class="gx-wrap">${esc(x.comentario)}</td><td class="gx-wrap">${esc(x.nota)}</td></tr>`).join('');
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
  const ub = {}; afs.forEach((x) => ub[x.ubicacion] = (ub[x.ubicacion] || 0) + 1);
  $('mapa-take').innerHTML = `Se registraron <b>${afs.length} aforos</b> en ${new Set(afs.map(bkey)).size} bloques: ` + Object.entries(ub).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(', ') + '. ' +
    (dud.length ? `Las lecturas de ${dud.map((b) => corto(b.key)).join(' y ')} quedaron junto a otro bloque: revise el mapa de ese equipo.` : '');
  $('t-ubic').innerHTML = afs.map((x) => { const b = BK[bkey(x)]; const pct = b && b.aforo ? 100 * x.valor / b.aforo.nominal : null;
    return `<tr><td>${fd(x.fecha)}</td><td>${esc(bkey(x))}</td><td class="num">${f(x.valor)}</td><td class="num"><span class="lg-v ${pct < 80 ? 'Alto' : (b && x.valor < b.aforo.min ? 'Bajo' : 'En')}">${f(pct, 0)}%</span></td><td>${esc(x.ubicacion)}${x.bloque_gps ? ' (' + esc(corto(x.bloque_gps)) + ')' : ''}</td><td class="num">${f(x.dist_valvula, 0)}</td><td>${esc(x.tramo || '—')}</td><td class="gx-wrap">${esc(x.comentario)}</td></tr>`; }).join('');

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
  const vistas = ['resumen', 'plan', 'mapa', 'presiones', 'tecnico'];
  function irA(v) {
    if (!vistas.includes(v)) v = 'resumen';
    vistas.forEach((k) => $(k).hidden = k !== v);
    document.querySelectorAll('.gx-tab').forEach((b) => b.setAttribute('aria-pressed', b.dataset.vista === v));
    history.replaceState(null, '', '#' + v);
    if (v === 'mapa') mapa();
  }
  document.querySelectorAll('.gx-tab').forEach((b) => b.addEventListener('click', () => irA(b.dataset.vista)));
  let t = null; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (!$('mapa').hidden) mapa(); }, 200); });

  dash.render = () => { plan(); detalle(); irA(P.vista); };
})();
