// Tablas
const cell = (tr, text, cls) => { const td = document.createElement('td'); if (cls) td.className = cls; td.textContent = text; tr.appendChild(td); return td; };
const chipEl = (text, kind) => { const s = document.createElement('span'); s.className = 'yb-chip ' + kind; s.textContent = text; return s; };
const chip = (tr, text, kind, cls) => { const td = document.createElement('td'); if (cls) td.className = cls; td.appendChild(chipEl(text, kind)); tr.appendChild(td); return td; };
const condKind = (c) => (c === 'En rango' ? 'ok' : c === 'Presión baja' ? 'low' : c === 'Presión alta' ? 'alert' : 'mid');
const nivKind = (n) => (n === 'Alerta' ? 'alert' : n === 'Atención' ? 'low' : n === 'Bien' ? 'ok' : 'mid');
const nv = (v) => (v == null ? '—' : window.GX.fnum(v));
const fillRows = (tb, id, filter, sort, render, key) => {
  const d = dash.data(id);
  tb.replaceChildren();
  if (d.status !== 'ok') return;
  d.data.filter(filter).sort(sort || (() => 0)).forEach((r) => {
    const tr = document.createElement('tr');
    tr.dataset.key = r[key || 'id'];
    render(tr, r);
    tb.appendChild(tr);
  });
};
const ORD = ['Presión baja', 'Presión alta', 'Inestable', 'En rango'];
const bySite = (a, b) => a.equipo.localeCompare(b.equipo, 'es', {numeric: true}) || a.sector.localeCompare(b.sector, 'es', {numeric: true}) || a.bloque.localeCompare(b.bloque, 'es', {numeric: true});

dash.draw('condTabla', (tb) => {
  const {byEq, fdate} = window.GX;
  const tipo = tb.dataset.tipo;
  fillRows(tb, 'cond_bloque', (r) => r.tipo === tipo && byEq(r), (a, b) => ORD.indexOf(a.condicion) - ORD.indexOf(b.condicion) || bySite(a, b), (tr, r) => {
    cell(tr, r.equipo); cell(tr, r.sector); cell(tr, r.bloque); cell(tr, nv(r.lecturas), 'num'); cell(tr, nv(r.prom), 'num strong'); cell(tr, r.rango, 'num');
    cell(tr, nv(r.ult), 'num'); cell(tr, fdate(r.ultFecha)); cell(tr, nv(r.pctBajo), 'num'); cell(tr, nv(r.pctAlto), 'num');
    chip(tr, r.condicion, condKind(r.condicion)); cell(tr, r.comentarios, 'gx-wrap');
  });
});

dash.draw('aforoTabla', (tb) => {
  const {byEq} = window.GX;
  fillRows(tb, 'aforo_bloque', byEq, bySite, (tr, r) => {
    cell(tr, r.equipo); cell(tr, r.sector); cell(tr, r.bloque); cell(tr, nv(r.aforos), 'num'); cell(tr, nv(r.dias), 'num');
    cell(tr, nv(r.prom), 'num strong'); cell(tr, nv(r.nominal), 'num'); cell(tr, (r.difPct > 0 ? '+' : '') + nv(r.difPct), 'num');
    cell(tr, nv(r.cu), 'num strong'); cell(tr, nv(r.du), 'num'); cell(tr, nv(r.pctAlto), 'num'); cell(tr, nv(r.pctBajo), 'num'); cell(tr, nv(r.valvProm), 'num'); cell(tr, nv(r.colaProm), 'num');
    cell(tr, r.comentarios, 'gx-wrap');
  });
});

dash.draw('limpiezaTabla', (tb) => {
  const {enCampo} = window.GX;
  fillRows(tb, 'limpieza', enCampo, null, (tr, r) => { cell(tr, r.regla, 'gx-wrap'); chip(tr, r.accion, r.accion === 'Excluida' ? 'alert' : r.accion === 'Corregida' ? 'low' : 'mid'); cell(tr, nv(r.lecturas), 'num'); });
});

dash.draw('rangosTabla', (tb) => {
  const {enCampo} = window.GX;
  fillRows(tb, 'rangos_valvula', enCampo, null, (tr, r) => { cell(tr, r.rango, 'num'); cell(tr, nv(r.valvulas), 'num strong'); cell(tr, r.equipos, 'gx-wrap'); });
});

// Estado por bloque (semáforo)
dash.draw('semaforoTabla', (tb) => {
  const {enCampo, fnum} = window.GX;
  const tone = (n) => (n === 'Bajo' ? 'low' : n === 'Alto' ? 'alert' : n === 'En rango' ? 'ok' : 'mid');
  const val = (tr, v, n) => { const td = document.createElement('td'); td.className = 'num'; if (v == null) td.textContent = '—'; else td.appendChild(chipEl(fnum(v), tone(n))); tr.appendChild(td); };
  fillRows(tb, 'semaforo', enCampo, (a, b) => b.puntos - a.puntos || bySite(a, b), (tr, r) => {
    cell(tr, r.equipo); cell(tr, r.sector); cell(tr, r.bloque);
    val(tr, r.valvula, r.valvulaNivel); val(tr, r.cola, r.colaNivel); val(tr, r.aforo, r.aforoNivel); val(tr, r.cu, r.cuNivel);
    cell(tr, r.motivo, 'gx-wrap' + (r.puntos ? ' strong' : '')); cell(tr, r.comentarios, 'gx-wrap gx-muted');
  }, 'bloque_key');
});

// Observaciones y plan de acción del campo
dash.draw('obsTabla', (tb) => {
  const {enCampo} = window.GX;
  fillRows(tb, 'observaciones', enCampo, (a, b) => a.orden - b.orden, (tr, r) => {
    chip(tr, r.nivel, nivKind(r.nivel));
    const td = cell(tr, '', 'gx-wrap'); const b = document.createElement('b'); b.textContent = r.titulo; td.append(b, document.createElement('br'), r.detalle);
    cell(tr, r.accion, 'gx-wrap'); cell(tr, r.donde, 'gx-wrap gx-muted');
    if (r.prioridad === '—') cell(tr, '—'); else chip(tr, r.prioridad, r.prioridad === 'Alta' ? 'alert' : r.prioridad === 'Media' ? 'low' : 'mid');
  });
});

// Todos los campos
const clickCampo = (ev) => { const tr = ev.target.closest('tr[data-key]'); if (tr) { dash.setParams({campo: tr.dataset.key, equipo: null, vista: 'resumen'}); dash.setLink('resumen'); } };
document.querySelectorAll('.gx-campos-tabla').forEach((t) => t.addEventListener('click', clickCampo));
dash.draw('camposTabla', (tb) => {
  const {fdate} = window.GX;
  const pctK = (v, bueno, malo) => (v == null ? 'mid' : v >= bueno ? 'ok' : v < malo ? 'alert' : 'low');
  fillRows(tb, 'campos', () => true, (a, b) => a.campo_n - b.campo_n, (tr, r) => {
    tr.className = 'gx-click';
    cell(tr, r.campo, 'strong'); cell(tr, `${nv(r.bloques)} / ${nv(r.bloquesCampo)}`, 'num'); cell(tr, `${fdate(r.desde)} – ${fdate(r.hasta)}`);
    cell(tr, r.valvulas ? `${nv(r.valvBajas)} / ${nv(r.valvulas)}` : '—', 'num'); cell(tr, r.colas ? `${nv(r.colasBajas)} / ${nv(r.colas)}` : '—', 'num');
    cell(tr, nv(r.aforos), 'num'); cell(tr, r.aforoProm == null ? '—' : `${nv(r.aforoProm)} / ${nv(r.nominal)}`, 'num');
    if (r.pctAforoRango == null) cell(tr, '—', 'num'); else chip(tr, nv(r.pctAforoRango), pctK(r.pctAforoRango, 80, 60), 'num');
    if (r.cuMed == null) cell(tr, '—', 'num'); else chip(tr, nv(r.cuMed), pctK(r.cuMed, 90, 85), 'num');
    if (r.pctEnBloque == null) cell(tr, '—', 'num'); else chip(tr, nv(r.pctEnBloque), pctK(r.pctEnBloque, 90, 60), 'num');
    if (r.alertas) chip(tr, nv(r.alertas), 'alert', 'num'); else cell(tr, '0', 'num');
  }, 'campo');
});
dash.draw('planTabla', (tb) => {
  fillRows(tb, 'observaciones', (r) => r.prioridad === 'Alta', (a, b) => a.campo.localeCompare(b.campo, 'es', {numeric: true}) || a.orden - b.orden, (tr, r) => {
    cell(tr, r.campo, 'strong'); chip(tr, r.nivel, nivKind(r.nivel));
    const td = cell(tr, '', 'gx-wrap'); const b = document.createElement('b'); b.textContent = r.titulo; td.append(b, document.createElement('br'), r.detalle);
    cell(tr, r.accion, 'gx-wrap'); cell(tr, r.donde, 'gx-wrap gx-muted');
  });
});

// Detalle: filtros de tipo, estado y texto
const tipoSel = document.querySelectorAll('.gx-tipo'), estSel = document.querySelectorAll('.gx-estado'), qIn = document.querySelectorAll('.gx-q');
tipoSel.forEach((s) => s.addEventListener('change', () => dash.setParams({tipo: s.value || null})));
estSel.forEach((s) => s.addEventListener('change', () => dash.setParams({estado: s.value || null})));
qIn.forEach((q) => q.addEventListener('input', () => dash.draw('detalleTabla')));
dash.onData(() => { tipoSel.forEach((s) => { s.value = dash.params().tipo || ''; }); estSel.forEach((s) => { s.value = dash.params().estado || ''; }); });
dash.draw('detalleTabla', (tb) => {
  const {byEq, fdate} = window.GX;
  const tipo = dash.params().tipo || '', est = dash.params().estado || '';
  const q = [...qIn].map((i) => i.value.trim().toLowerCase()).find(Boolean) || '';
  const okEst = (r) => !est || (est === 'Fuera de rango' ? r.estado === 'Bajo' || r.estado === 'Alto' : est === 'Con comentario' ? !!r.comentario : est === 'Limpieza' ? !!r.nota : r.estado === est);
  fillRows(tb, 'lecturas', (r) => byEq(r) && (!tipo || r.tipo === tipo) && okEst(r) &&
      (!q || `${r.equipo} ${r.sector} ${r.bloque} ${r.activo} ${r.nota} ${r.comentario} ${r.estado} ${r.ubicacion}`.toLowerCase().includes(q)),
    (a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0), (tr, r) => {
      if (!r.incluida) tr.className = 'gx-excl';
      cell(tr, fdate(r.fecha, true)); cell(tr, r.tipo); cell(tr, r.equipo); cell(tr, r.sector); cell(tr, r.bloque); cell(tr, nv(r.valor), 'num strong'); cell(tr, r.unidad);
      cell(tr, nv(r.min), 'num yb-hide-narrow'); cell(tr, nv(r.max), 'num yb-hide-narrow');
      chip(tr, r.estado, r.estado === 'En rango' ? 'ok' : r.estado === 'Bajo' ? 'low' : r.estado === 'Alto' ? 'alert' : 'mid');
      cell(tr, r.ubicacion || '', 'yb-hide-narrow'); cell(tr, r.comentario || '', 'gx-wrap'); cell(tr, r.nota || '', 'gx-wrap gx-muted');
    });
});

// Plan de acción
const prioKind = (p) => (p === 'Alta' ? 'alert' : p === 'Media' ? 'low' : p === 'Baja' ? 'mid' : 'ok');
const alcSel = document.querySelectorAll('.gx-alcance'), prioSel = document.querySelectorAll('.gx-prio');
alcSel.forEach((s) => s.addEventListener('change', () => dash.setParams({alcance: s.value || null})));
prioSel.forEach((s) => s.addEventListener('change', () => dash.setParams({prio: s.value || null})));
dash.onData(() => { alcSel.forEach((s) => { s.value = dash.params().alcance || ''; }); prioSel.forEach((s) => { s.value = dash.params().prio || ''; }); });
const enAlcance = (r) => (dash.params().alcance === 'todos' ? true : r.campo === window.GX.P().campo);
const enPrio = (r) => !dash.params().prio || r.prioridad === dash.params().prio;
dash.draw('diagResTabla', (tb) => {
  const campo = dash.params().alcance === 'todos' ? 'Todos' : window.GX.P().campo;
  fillRows(tb, 'diag_resumen', (r) => r.campo === campo && enPrio(r), (a, b) => a.orden - b.orden || b.bloques - a.bloques, (tr, r) => {
    chip(tr, r.prioridad === '—' ? 'Sin acción' : r.prioridad, prioKind(r.prioridad)); cell(tr, r.diagnostico, 'strong'); cell(tr, nv(r.bloques), 'num'); cell(tr, r.accion, 'gx-wrap');
  });
});
dash.draw('planBloques', (tb) => {
  const {fnum} = window.GX;
  const tone = (n) => (n === 'Bajo' ? 'low' : n === 'Alto' ? 'alert' : n === 'En rango' ? 'ok' : 'mid');
  const val = (tr, v, n) => { const td = document.createElement('td'); td.className = 'num'; if (v == null) td.textContent = '—'; else td.appendChild(chipEl(fnum(v), tone(n))); tr.appendChild(td); };
  fillRows(tb, 'diagnostico', (r) => enAlcance(r) && enPrio(r), (a, b) => a.orden - b.orden || a.campo.localeCompare(b.campo, 'es', {numeric: true}) || bySite(a, b), (tr, r) => {
    chip(tr, r.prioridad === '—' ? 'Sin acción' : r.prioridad, prioKind(r.prioridad)); cell(tr, r.campo); cell(tr, `${r.equipo} · ${r.sector} · ${r.bloque}`);
    val(tr, r.valvula, r.valvulaNivel); val(tr, r.cola, r.colaNivel); val(tr, r.aforo, r.aforoNivel); val(tr, r.cu, r.cuNivel);
    const td = cell(tr, '', 'gx-wrap'); const b = document.createElement('b'); b.textContent = r.diagnostico; td.append(b, document.createElement('br'), r.causa);
    cell(tr, r.accion, 'gx-wrap'); cell(tr, r.comentarios, 'gx-wrap gx-muted');
  }, 'bloque_key');
});

// Cumplimiento del calendario
const estKind = (e) => (e === 'Cumplido' || e === 'Completo' || e === 'Al día' ? 'ok' : e === 'Casi completo' ? 'casi' : e === 'Por iniciar' ? 'mid' : e === 'Sin avance' || e === 'Pendiente' ? 'alert' : 'low');
const plazo = (r) => (r.restan == null ? '—' : r.estado === 'Cumplido' ? 'Cumplido' : r.restan > 1 ? `Quedan ${r.restan} días` : r.restan === 1 ? 'Queda 1 día' : r.restan === 0 ? 'Vence hoy' : r.restan === -1 ? 'Venció hace 1 día' : `Venció hace ${-r.restan} días`);
dash.draw('cumplTabla', (tb) => {
  const {fdate} = window.GX;
  fillRows(tb, 'cumplimiento', (r) => r.campo !== 'Total', (a, b) => a.campo_n - b.campo_n, (tr, r) => {
    cell(tr, r.campo, 'strong'); cell(tr, fdate(r.inicio)); cell(tr, fdate(r.fin), 'strong'); cell(tr, plazo(r), r.restan < 0 && r.estado !== 'Cumplido' ? 'gx-vencido' : 'gx-muted'); cell(tr, nv(r.priorizados), 'num'); cell(tr, nv(r.medidos), 'num'); cell(tr, nv(r.pct), 'num strong');
    chip(tr, r.estado, estKind(r.estado)); cell(tr, `${nv(r.sectoresPendientes)} / ${nv(r.sectores)}`, 'num'); cell(tr, nv(r.fueraPlan), 'num'); cell(tr, fdate(r.ultima));
  }, 'campo');
});
const pcSel = document.querySelectorAll('.gx-plan-campo'), peSel = document.querySelectorAll('.gx-plan-estado');
peSel.forEach((s) => s.addEventListener('change', () => dash.setParams({planEstado: s.value || null})));
dash.onData(() => { peSel.forEach((s) => { s.value = dash.params().planEstado || ''; }); });
dash.draw('planCampoSel', (sel) => {
  const d = dash.data('plan');
  const cs = d.status === 'ok' ? [...new Set(d.data.map((r) => r.campo))] : [];
  sel.replaceChildren(new Option('Todos', ''), ...cs.map((c) => new Option(c, c)));
  sel.value = dash.params().planCampo || '';
  sel.onchange = () => dash.setParams({planCampo: sel.value || null});
});
dash.draw('planDetalle', (tb) => {
  const {fdate} = window.GX;
  const c = dash.params().planCampo || '', e = dash.params().planEstado || '';
  const ord = {Pendiente: 0, Parcial: 1, Completo: 2};
  fillRows(tb, 'plan', (r) => (!c || r.campo === c) && (!e || r.estado === e), (a, b) => a.campo_n - b.campo_n || ord[a.estado] - ord[b.estado] || a.equipo.localeCompare(b.equipo, 'es', {numeric: true}) || a.sector.localeCompare(b.sector, 'es', {numeric: true}), (tr, r) => {
    cell(tr, r.campo); cell(tr, r.categoria, 'gx-wrap gx-muted'); cell(tr, r.equipo); cell(tr, r.sector); cell(tr, nv(r.bloques_plan), 'num'); cell(tr, nv(r.bloques_medidos), 'num strong');
    chip(tr, r.estado, estKind(r.estado)); cell(tr, fdate(r.inicio)); cell(tr, fdate(r.fin), 'strong'); cell(tr, fdate(r.ultima));
  });
});
