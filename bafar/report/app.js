// Informe de riego Ag. Bafar (blum). Datos ya calculados en scripts/pipeline.py; aquí solo filtros, tablas y gráficos.
const loc = d3.formatLocale({decimal: ',', thousands: '.', grouping: [3], currency: ['$', '']});
const fnum = loc.format(',.4~f'), f1 = loc.format(',.1~f'), fint = loc.format(',d');
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fdate = (s) => (s ? `${+s.slice(8, 10)} ${MESES[+s.slice(5, 7) - 1]}` : '—');
const BL = {bosque: '#002E2B', turquesa: '#77CFC9', naranjo: '#F64500', rojo: '#C30016', bosque60: '#668280', bosque25: '#BFCBCA', naranjo45: '#FBA680', mezcla: '#3C7F7A'};
const COND = [{k: 'Presión baja', c: BL.naranjo}, {k: 'Presión alta', c: BL.rojo}, {k: 'Inestable', c: BL.naranjo45}, {k: 'En rango', c: BL.turquesa}, {k: 'Sin rango válido', c: BL.bosque25}];
const UBIC = [{k: 'Junto a la válvula', c: BL.bosque}, {k: 'Dentro del bloque', c: BL.turquesa}, {k: 'Junto a la cola', c: BL.mezcla}, {k: 'Junto a otro bloque', c: BL.naranjo45},
  {k: 'Lejos de su bloque', c: BL.naranjo}, {k: 'Fuera del campo', c: BL.rojo}, {k: 'Sin GPS', c: BL.bosque25}];
const D = (id) => (dash.data(id).data || []);
const META = () => D('meta')[0] || {};
const CAMPO0 = '02.1 · San Antonio MX 2.0';
const P = () => ({campo: dash.params().campo || CAMPO0, equipo: dash.params().equipo || ''});
const enCampo = (r) => r.campo === P().campo;
const byEq = (r) => enCampo(r) && (!P().equipo || r.equipo === P().equipo);
const nat = (a, b) => String(a).localeCompare(String(b), 'es', {numeric: true});
const bySite = (a, b) => (a.equipo_n ?? 0) - (b.equipo_n ?? 0) || nat(a.equipo, b.equipo) || (a.sector_n ?? 0) - (b.sector_n ?? 0) || (a.bloque_n ?? 0) - (b.bloque_n ?? 0);
const nv = (v) => (v == null ? '—' : fnum(v));
const cell = (tr, text, cls) => { const td = document.createElement('td'); if (cls) td.className = cls; td.textContent = text == null ? '—' : text; tr.appendChild(td); return td; };
const chipEl = (text, kind) => { const s = document.createElement('span'); s.className = 'yb-chip ' + kind; s.textContent = text; return s; };
const chip = (tr, text, kind, cls) => { const td = document.createElement('td'); if (cls) td.className = cls; td.appendChild(chipEl(text, kind)); tr.appendChild(td); return td; };
const prioKind = (p) => (p === 'Alta' ? 'alert' : p === 'Media' ? 'low' : 'mid');
const nivKind = (n) => (n === 'Alerta' ? 'alert' : n === 'Atención' ? 'low' : n === 'Bien' ? 'ok' : 'mid');
const tone = (n) => (n === 'Bajo' ? 'low' : n === 'Alto' ? 'alert' : n === 'En rango' ? 'ok' : 'mid');
const fill = (tb, rows, render, vacio) => { tb.replaceChildren(); rows.forEach((r) => { const tr = document.createElement('tr'); render(tr, r); tb.appendChild(tr); }); if (!rows.length) { const tr = document.createElement('tr'); const td = cell(tr, vacio || 'Sin datos para este filtro.', 'gx-muted'); td.colSpan = 20; tb.appendChild(tr); } };
const bold = (td, t, rest) => { const b = document.createElement('b'); b.textContent = t; td.replaceChildren(b, document.createElement('br'), rest); };
const empty = (el, text) => { const d = document.createElement('div'); d.className = 'gx-empty'; d.textContent = text; el.replaceChildren(d); };
const tip = (host) => {
  const box = document.createElement('div'); box.className = 'yb-tip'; box.hidden = true; host.style.position = 'relative'; host.appendChild(box);
  return {show(lines, x, y) { box.replaceChildren(...lines.map((t, i) => { const d = document.createElement('div'); if (!i) d.className = 't1'; d.textContent = t; return d; })); box.hidden = false;
    const W = host.clientWidth, bw = box.offsetWidth, bh = box.offsetHeight; let l = x + 12; if (l + bw > W) l = Math.max(0, x - bw - 12); let t = y - bh - 8; if (t < 0) t = y + 12;
    box.style.left = l + 'px'; box.style.top = t + 'px'; }, hide() { box.hidden = true; }};
};
const axisStyle = (g) => { g.attr('font-size', null).attr('font-family', null); g.selectAll('line,path').style('stroke', 'var(--cds-chart-axis)'); };

// ---- pestañas y filtros
document.querySelectorAll('.gx-tab').forEach((b) => b.addEventListener('click', () => { dash.setParams({vista: b.dataset.vista}); dash.setLink(b.dataset.vista); window.scrollTo(0, 0); }));
dash.onData(() => {
  const v = dash.params().vista || 'campos';
  document.querySelectorAll('.gx-tab').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.vista === v)));
  document.querySelectorAll('.gx-page').forEach((p) => { p.hidden = p.id !== v; });
  document.querySelectorAll('.gx-campo-filtros').forEach((p) => { p.hidden = v === 'campos' || v === 'meta'; });
  document.querySelectorAll('.gx-solo-tecnico').forEach((p) => { p.hidden = v !== 'tecnico' && v !== 'plan'; });
});
dash.draw('campoSel', (sel) => {
  sel.replaceChildren(...D('campos').map((r) => new Option(r.campo, r.campo)));
  sel.value = P().campo; sel.onchange = () => dash.setParams({campo: sel.value, equipo: null});
});
dash.draw('equipoSel', (sel) => {
  const eqs = [...new Set(D('bloques').filter(enCampo).map((r) => r.equipo))].sort(nat);
  sel.replaceChildren(new Option('Todos', ''), ...eqs.map((e) => new Option(e, e)));
  sel.value = P().equipo; sel.onchange = () => dash.setParams({equipo: sel.value || null});
});
dash.draw('upd', (el) => { el.textContent = dash.params().actualizado || '—'; });
dash.draw('m', (el) => {
  const v = META()[el.dataset.k];
  if (v == null) { el.textContent = '—'; return; }
  el.textContent = el.dataset.f === 'fecha' ? fdate(v) : typeof v === 'number' ? fint(v * (+el.dataset.x || 1)) : v;
});
dash.draw('campoTxt', (el) => { el.textContent = el.dataset.corto ? P().campo.replace(/^[\d.]+ · /, '').replace(' MX', '') : P().campo; });

// ---- Todos los campos
document.querySelectorAll('.gx-campos-tabla').forEach((t) => t.addEventListener('click', (ev) => {
  const tr = ev.target.closest('tr[data-key]'); if (tr) { dash.setParams({campo: tr.dataset.key, equipo: null, vista: 'resumen'}); dash.setLink('resumen'); window.scrollTo(0, 0); }
}));
dash.draw('camposTabla', (tb) => fill(tb, D('campos'), (tr, r) => {
  tr.dataset.key = r.campo; tr.className = 'gx-click';
  cell(tr, r.campo, 'strong'); cell(tr, `${fint(r.bloques)} / ${fint(r.bloquesCampo)} (${r.pctBloques} %)`, 'num'); cell(tr, `${fdate(r.desde)} – ${fdate(r.hasta)}`);
  cell(tr, r.valvulas ? `${r.valvAltas} / ${r.valvBajas} de ${r.valvulas}` : '—', 'num');
  if (r.colas) cell(tr, fint(r.colas), 'num'); else chip(tr, '0', 'low', 'num');
  if (r.aforos < 0.2 * r.bloques * 7) chip(tr, fint(r.aforos), 'low', 'num'); else cell(tr, fint(r.aforos), 'num');
  cell(tr, r.aforoProm == null ? '—' : `${f1(r.aforoProm)} / ${f1(r.nominal)}`, 'num');
  cell(tr, fint(r.sectoresApi), 'num');
  if (r.sectoresApi && !r.sectoresApiAforo) chip(tr, '0', 'low', 'num'); else cell(tr, r.sectoresApi ? fint(r.sectoresApiAforo) : '—', 'num');
  if (r.alertas) chip(tr, fint(r.alertas), 'alert', 'num'); else cell(tr, '0', 'num');
}));
dash.draw('plusTiles', (el) => {
  const m = META(), cs = D('campos');
  const sinMed = m.bloquesTotal - m.bloquesMedidos;
  const items = [
    [fint(m.bloquesCu), 'bloques con uniformidad (CU) calculable', 'Se necesitan 4 aforos o más por bloque. Sin CU no se sabe si el riego es parejo ni dónde hay emisores tapados.', true],
    [`${fint(m.sectoresApiAforo)} de ${fint(m.sectoresApi)}`, 'sectores con Wiseconn que también tienen aforos', 'Wiseconn mide cuánta agua entra. Sin aforos no se puede saber si llega a los árboles o se pierde en fugas.', true],
    [fint(sinMed), `bloques sin ninguna medición de ${fint(m.bloquesTotal)}`, 'En esos bloques no hay presión de válvula, de cola ni aforo esta temporada.', sinMed > m.bloquesTotal / 3],
    [`${cs.filter((r) => !r.colas).length} de ${cs.length}`, `campos sin presión de cola (${cs.filter((r) => !r.colas).map((r) => r.campo.replace(/^[\d.]+ · /, '').replace(' MX', '')).join(' y ')})`, 'Sin la cola no se puede separar un problema de regulación de una pérdida en el lateral.', true],
  ];
  el.replaceChildren(...items.map(([big, t, d, al]) => {
    const div = document.createElement('div'); div.className = 'yb-tile' + (al ? ' is-alert' : '');
    const b = document.createElement('div'); b.className = 'big'; b.textContent = big;
    const s = document.createElement('div'); s.className = 'lbl'; s.textContent = t;
    const p = document.createElement('p'); p.textContent = d; div.append(b, s, p); return div;
  }));
});
dash.draw('origenTabla', (tb) => fill(tb, D('origen'), (tr, r) => {
  cell(tr, r.campo); cell(tr, r.medicion); chip(tr, r.origen, r.origen === 'API Wiseconn' ? 'ok' : 'mid'); cell(tr, fint(r.lecturas), 'num'); cell(tr, fint(r.activos), 'num'); cell(tr, fint(r.dias), 'num'); cell(tr, fdate(r.desde)); cell(tr, fdate(r.hasta));
}));
dash.draw('altasTabla', (tb) => fill(tb, D('observaciones').filter((r) => r.prioridad === 'Alta'), (tr, r) => {
  cell(tr, r.campo, 'strong'); cell(tr, r.tema); bold(cell(tr, '', 'gx-wrap'), r.titulo, r.detalle); cell(tr, r.accion, 'gx-wrap'); cell(tr, r.donde, 'gx-wrap gx-muted');
}));

// ---- Meta de mediciones
dash.draw('metaKpis', (el) => {
  const m = META(), mc = D('metaCampo').filter((r) => r.ciclo_n === m.cicloActual);
  const tot = d3.sum(mc, (r) => r.metaBloques), cum = d3.sum(mc, (r) => r.cumplen), par = d3.sum(mc, (r) => r.parciales), af = d3.sum(mc, (r) => r.aforosHechos), afm = d3.sum(mc, (r) => r.aforosMeta);
  const k = (t, v, s, w) => `<div class="kpi"><span>${t}</span><b${w ? ' class="warn"' : ''}>${v}${s ? `<small>${s}</small>` : ''}</b></div>`;
  el.innerHTML = k('Tiempo transcurrido del ciclo', fint(mc[0]?.avanceTiempo ?? 0), '%') + k('Bloques que cumplen', fint(cum), `/ ${fint(tot)}`, cum < tot * (mc[0]?.avanceTiempo || 0) / 100)
    + k('Bloques con alguna medición', fint(par + cum), `/ ${fint(tot)}`) + k('Aforos del ciclo', fint(af), `/ ${fint(afm)}`, true);
});
dash.draw('metaSemChart', (el) => {
  const rs = D('metaSemana'); if (!rs.length) { empty(el, 'Sin datos.'); return; }
  el.replaceChildren();
  const campos = [...new Set(rs.map((r) => r.campo))];
  const W = el.clientWidth || 800, h1 = 150, H = campos.length * (h1 + 34) + 26, ml = 40, mr = 12;
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
  const sem = [...new Set(rs.map((r) => r.semana))];
  const x = d3.scaleBand(sem, [ml, W - mr]).padding(0.18);
  const t = tip(el);
  campos.forEach((c, i) => {
    const g = rs.filter((r) => r.campo === c), y0 = i * (h1 + 34) + 22;
    const y = d3.scaleLinear([0, Math.max(d3.max(g, (r) => r.visitados), g[0].objetivo) * 1.1], [y0 + h1, y0]).nice();
    svg.append('text').attr('x', ml).attr('y', y0 - 8).attr('class', 'strong').text(c);
    const gy = svg.append('g').attr('transform', `translate(${ml},0)`).call(d3.axisLeft(y).ticks(4).tickFormat(fint)); axisStyle(gy);
    svg.append('g').selectAll('rect').data(g).join('rect').attr('x', (r) => x(r.semana)).attr('width', x.bandwidth()).attr('y', (r) => y(r.visitados)).attr('height', (r) => y(0) - y(r.visitados))
      .style('fill', BL.turquesa).style('opacity', (r) => (r.enCurso ? 0.5 : 1))
      .on('mousemove', (ev, r) => { const [px, py] = d3.pointer(ev, el); t.show([`${c} · semana del ${fdate(r.semana)}`, `Visitados: ${fint(r.visitados)} bloques`, `Meta completa: ${fint(r.completos)}`, `Meta semanal: ${f1(r.objetivo)} bloques`, `Válvulas ${r.valvulas} · colas ${r.colas} · aforos ${r.aforos}`].concat(r.enCurso ? ['Semana en curso'] : []), px, py); })
      .on('mouseleave', () => t.hide());
    svg.append('g').selectAll('rect').data(g.filter((r) => r.completos)).join('rect').attr('x', (r) => x(r.semana)).attr('width', x.bandwidth()).attr('y', (r) => y(r.completos)).attr('height', (r) => y(0) - y(r.completos)).style('fill', BL.mezcla);
    svg.append('line').attr('x1', ml).attr('x2', W - mr).attr('y1', y(g[0].objetivo)).attr('y2', y(g[0].objetivo)).style('stroke', BL.bosque).attr('stroke-dasharray', '5 3').attr('stroke-width', 1.5);
    svg.append('text').attr('x', W - mr).attr('y', y(g[0].objetivo) - 4).attr('text-anchor', 'end').attr('class', 'gx-small').text(`Meta: ${f1(g[0].objetivo)} por semana`);
    if (i === campos.length - 1) {
      const gx = svg.append('g').attr('transform', `translate(0,${y0 + h1})`).call(d3.axisBottom(x).tickValues(sem.filter((s, j) => j % 2 === 0)).tickFormat((s) => fdate(s))); axisStyle(gx);
    } else svg.append('line').attr('x1', ml).attr('x2', W - mr).attr('y1', y0 + h1).attr('y2', y0 + h1).style('stroke', 'var(--cds-chart-axis)');
  });
});
dash.draw('metaSemTabla', (tb) => fill(tb, D('metaSemana').filter((r) => r.visitados || r.enCurso).sort((a, b) => a.campo_n - b.campo_n || nat(b.semana, a.semana)), (tr, r) => {
  cell(tr, r.campo); cell(tr, `${fdate(r.semana)} – ${fdate(r.fin)}${r.enCurso ? ' (en curso)' : ''}`); cell(tr, f1(r.objetivo), 'num'); cell(tr, fint(r.visitados), 'num');
  cell(tr, fint(r.conValvula), 'num'); cell(tr, fint(r.conCola), 'num'); cell(tr, fint(r.conAforo), 'num'); cell(tr, fint(r.completos), 'num strong'); cell(tr, fint(r.aforos), 'num');
  chip(tr, `${fint(r.pct)} %`, r.pct >= 100 ? 'ok' : r.pct >= 50 ? 'low' : 'alert', 'num');
}));
dash.draw('metaCampoTabla', (tb) => fill(tb, D('metaCampo').sort((a, b) => a.campo_n - b.campo_n || a.ciclo_n - b.ciclo_n), (tr, r) => {
  cell(tr, r.campo, 'strong'); cell(tr, r.ciclo); cell(tr, `${fdate(r.inicio)} – ${fdate(r.fin)}`); cell(tr, `${r.avanceTiempo} %`, 'num'); cell(tr, fint(r.metaBloques), 'num');
  chip(tr, fint(r.cumplen), r.cumplen ? 'ok' : 'alert', 'num'); cell(tr, fint(r.parciales), 'num'); cell(tr, fint(r.sinMedicion), 'num'); cell(tr, fint(r.conValvula), 'num'); cell(tr, fint(r.conCola), 'num');
  cell(tr, `${fint(r.aforosHechos)} / ${fint(r.aforosMeta)}`, 'num');
}));
dash.draw('mbCampoSel', (sel) => { sel.replaceChildren(...D('campos').map((r) => new Option(r.campo, r.campo))); sel.value = dash.params().mbCampo || CAMPO0; sel.onchange = () => dash.setParams({mbCampo: sel.value}); });
dash.draw('mbCicloSel', (sel) => { const cs = [...new Set(D('metaCampo').map((r) => r.ciclo_n))]; sel.replaceChildren(...cs.map((c) => new Option(`Ciclo ${c}`, c))); sel.value = dash.params().mbCiclo || META().cicloActual; sel.onchange = () => dash.setParams({mbCiclo: sel.value}); });
document.querySelectorAll('.gx-mb-estado').forEach((s) => s.addEventListener('change', () => dash.setParams({mbEstado: s.value || null})));
const mbRows = () => { const p = dash.params(); return D('metaBloque').filter((r) => r.campo === (p.mbCampo || CAMPO0) && r.ciclo_n === +(p.mbCiclo || META().cicloActual) && (!p.mbEstado || r.estado === p.mbEstado)); };
dash.draw('metaBloqueTabla', (tb) => fill(tb, mbRows().sort(bySite), (tr, r) => {
  cell(tr, r.equipo); cell(tr, r.sector); cell(tr, r.bloque);
  [['valvula', 1], ['cola', 1], ['aforos', 7]].forEach(([k, m]) => (r[k] >= m ? chip(tr, `${r[k]}/${m}`, 'ok', 'num') : cell(tr, `${r[k]}/${m}`, 'num')));
  chip(tr, r.estado, r.estado === 'Cumple' ? 'ok' : r.estado === 'Parcial' ? 'low' : 'alert'); cell(tr, r.falta, 'gx-muted');
}));
dash.draw('mbNota', (el) => { const rs = mbRows(); el.textContent = `${fint(rs.length)} bloques en la tabla. Bloques activos del campo según blum.`; });

// ---- Resumen del campo
dash.draw('resumenLead', (el) => {
  const c = D('campos').find(enCampo) || {}; const a = D('api').filter(enCampo);
  el.textContent = `${fint(c.bloques)} de ${fint(c.bloquesCampo)} bloques con mediciones en terreno entre el ${fdate(c.desde)} y el ${fdate(c.hasta)}` +
    (a.length ? `, y ${a.length} sectores con caudal automático de Wiseconn.` : '. Este campo no tiene caudal automático de Wiseconn en la temporada.');
});
dash.draw('resumenKpis', (el) => {
  const c = D('campos').find(enCampo) || {};
  const k = (t, v, s, w) => `<div class="kpi"><span>${t}</span><b${w ? ' class="warn"' : ''}>${v}${s ? `<small>${s}</small>` : ''}</b></div>`;
  el.innerHTML = k('Bloques medidos', fint(c.bloques), `/ ${fint(c.bloquesCampo)}`) + k('Válvulas sobre su presión', fint(c.valvAltas), `/ ${fint(c.valvulas)}`, c.valvAltas > c.valvulas / 3)
    + k('Aforos', fint(c.aforos), c.aforoProm != null ? ` · ${f1(c.aforoProm)} l/h` : '', c.aforos < c.bloques) + k('Alertas altas', fint(c.alertas), '', c.alertas > 0);
});
dash.draw('obsTabla', (tb) => fill(tb, D('observaciones').filter(enCampo).sort((a, b) => ({Alta: 0, Media: 1, Baja: 2}[a.prioridad] ?? 3) - ({Alta: 0, Media: 1, Baja: 2}[b.prioridad] ?? 3) || a.orden - b.orden), (tr, r) => {
  chip(tr, r.nivel, nivKind(r.nivel)); bold(cell(tr, '', 'gx-wrap'), r.titulo, r.detalle); cell(tr, r.accion, 'gx-wrap'); cell(tr, r.donde, 'gx-wrap gx-muted'); chip(tr, r.prioridad, prioKind(r.prioridad));
}));
dash.draw('semaforoTabla', (tb) => {
  const val = (tr, v, n) => { const td = document.createElement('td'); td.className = 'num'; if (v == null) td.textContent = '—'; else td.appendChild(chipEl(f1(v), tone(n))); tr.appendChild(td); };
  fill(tb, D('diagnostico').filter(enCampo).sort((a, b) => a.orden - b.orden || bySite(a, b)), (tr, r) => {
    cell(tr, r.equipo); cell(tr, r.sector); cell(tr, r.bloque); val(tr, r.valvula, r.valvulaNivel); val(tr, r.cola, r.colaNivel); val(tr, r.aforo, r.aforoNivel);
    cell(tr, r.diagnostico, 'gx-wrap' + (r.orden <= 2 ? ' strong' : '')); if (r.prioridad === '—') cell(tr, '—'); else chip(tr, r.prioridad, prioKind(r.prioridad));
  });
});

// ---- Análisis técnico
const two = (tr, a, b, cls) => { const td = cell(tr, '', cls); const x = document.createElement('div'); x.textContent = a; const y = document.createElement('div'); y.className = 'gx-muted gx-sub2'; y.textContent = b || ''; td.append(x, y); return td; };
dash.draw('apiTabla', (tb) => fill(tb, D('api').filter(byEq).sort(bySite), (tr, r) => {
  two(tr, r.sector, r.equipo, 'strong'); cell(tr, f1(r.ha), 'num'); cell(tr, fint(r.diasRiego), 'num');
  two(tr, r.q == null ? '—' : fint(r.q) + (r.suma ? '*' : ''), r.porMedidor, 'num strong'); cell(tr, r.disenoRango, 'num');
  if (r.pctDiseno == null) cell(tr, '—', 'num'); else chip(tr, `${r.pctDiseno} %`, r.pctDiseno > 110 || r.pctDiseno < 90 ? 'low' : 'ok', 'num');
  cell(tr, nv(r.lamina), 'num'); two(tr, r.aforo == null ? '0' : `${f1(r.aforo)} / ${f1(r.nominal)}`, r.aforos ? `${r.aforos} aforos` : 'sin aforos', 'num');
  const td = cell(tr, '', 'gx-wrap'); td.append(chipEl(r.cruce, prioKind(r.prioridad)), document.createElement('br'), r.detalle);
}));
dash.draw('apiNota', (el) => {
  const a = D('api').filter(enCampo);
  el.textContent = !a.length ? 'Este campo no envía caudal por la API de Wiseconn en la temporada.' :
    'Caudal: mediana de los días con riego (5 lecturas o más sobre 0). Lámina = caudal ÷ superficie. ' + (a.some((r) => r.suma) ? '* Suma de los dos caudalímetros de rebombeo que informan el mismo sector; si trabajan en serie y no en paralelo, el caudal real es el de uno solo.' : '');
});
dash.draw('serieChart', (el) => {
  const rs = D('serie').filter((r) => enCampo(r) && (!P().equipo || r.etiqueta.startsWith(P().equipo + ' ·')));
  if (!rs.length) { empty(el, 'Sin caudal de Wiseconn con riego para este filtro.'); return; }
  el.replaceChildren();
  const secs = [...new Set(rs.map((r) => r.etiqueta))].sort(nat);
  const cols = Math.max(1, Math.min(3, Math.floor((el.clientWidth || 800) / 280))), W = el.clientWidth || 800, cw = W / cols, ch = 150, rows = Math.ceil(secs.length / cols), H = rows * (ch + 30);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
  const x = d3.scaleTime(d3.extent(rs, (r) => new Date(r.dia)), [0, cw - 56]);
  const t = tip(el);
  secs.forEach((s, i) => {
    const g = rs.filter((r) => r.etiqueta === s), ox = (i % cols) * cw + 40, oy = Math.floor(i / cols) * (ch + 30) + 20;
    const ymax = d3.max(g, (r) => Math.max(r.q, r.dmax || 0)) * 1.15;
    const y = d3.scaleLinear([0, ymax], [oy + ch - 20, oy]).nice();
    const G = svg.append('g').attr('transform', `translate(${ox},0)`);
    G.append('text').attr('y', oy - 6).attr('class', 'strong').text(s);
    if (g[0].dmin != null) G.append('rect').attr('x', 0).attr('width', cw - 56).attr('y', y(g[0].dmax)).attr('height', Math.max(1, y(g[0].dmin) - y(g[0].dmax))).style('fill', BL.bosque25).style('opacity', 0.6);
    axisStyle(G.append('g').call(d3.axisLeft(y).ticks(3).tickFormat(fint)));
    axisStyle(G.append('g').attr('transform', `translate(0,${oy + ch - 20})`).call(d3.axisBottom(x).ticks(3).tickFormat((d) => `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`)));
    G.selectAll('circle').data(g).join('circle').attr('cx', (r) => x(new Date(r.dia))).attr('cy', (r) => y(r.q)).attr('r', 4).style('fill', BL.mezcla)
      .on('mousemove', (ev, r) => { const [px, py] = d3.pointer(ev, el); t.show([s, `${fdate(r.dia)}: ${fint(r.q)} m³/h`].concat(r.dmin != null ? [`Diseño: ${fnum(r.dmin)}–${fnum(r.dmax)} m³/h`] : []), px, py); })
      .on('mouseleave', () => t.hide());
  });
});
dash.draw('presTabla', (tb) => fill(tb, D('presion').filter(byEq).sort(bySite), (tr, r) => {
  two(tr, r.sector, r.equipo, 'strong'); two(tr, r.apiProm == null ? '—' : `${f1(r.apiProm)} (${f1(r.apiMin)}–${f1(r.apiMax)})`, r.apiFechas, 'num strong');
  two(tr, r.manProm == null ? '—' : `${f1(r.manProm)} (${f1(r.manMin)}–${f1(r.manMax)})`, `${r.valvulas} válvulas`, 'num'); cell(tr, nv(r.principal), 'num'); cell(tr, nv(r.diferencia), 'num');
  const td = cell(tr, '', 'gx-wrap'); const ac = document.createElement('div'); ac.className = 'gx-muted'; ac.textContent = r.accion;
  td.append(chipEl(r.resultado, r.resultado === 'Presiones coherentes' ? 'ok' : r.resultado === 'Sin válvulas medidas' ? 'mid' : 'low'), document.createElement('div'), r.detalle, ac);
}));
dash.draw('condChart', (el) => {
  const tipo = el.dataset.tipo, rs = D('cond').filter((r) => r.tipo === tipo && enCampo(r));
  if (!rs.length) { empty(el, `Sin mediciones de ${tipo.toLowerCase()} en este campo.`); return; }
  el.replaceChildren();
  const eqs = [...new Set(rs.map((r) => r.equipo))].sort(nat);
  const rows = eqs.map((e) => ({e, ...Object.fromEntries(COND.map((c) => [c.k, rs.filter((r) => r.equipo === e && r.condicion === c.k).length]))}));
  const W = el.clientWidth || 800, rh = 26, H = rows.length * rh + 30, ml = 90;
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
  const tot = d3.max(rows, (r) => d3.sum(COND, (c) => r[c.k])) || 1;
  const x = d3.scaleLinear([0, tot], [ml, W - 36]), y = d3.scaleBand(eqs, [4, H - 24]).padding(0.25);
  axisStyle(svg.append('g').attr('transform', `translate(0,${H - 24})`).call(d3.axisBottom(x).ticks(Math.min(tot, 6)).tickFormat(fint)));
  const t = tip(el), eq = P().equipo;
  rows.forEach((r) => {
    let x0 = 0;
    svg.append('text').attr('x', ml - 8).attr('y', y(r.e) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').text(r.e);
    COND.forEach((c) => {
      const n = r[c.k]; if (!n) return;
      svg.append('rect').attr('x', x(x0) + 0.5).attr('y', y(r.e)).attr('width', Math.max(1, x(x0 + n) - x(x0) - 1)).attr('height', y.bandwidth()).attr('rx', 2).style('fill', c.c).style('opacity', eq && r.e !== eq ? 0.35 : 1)
        .on('mousemove', (ev) => { const [px, py] = d3.pointer(ev, el); t.show([r.e, `${c.k}: ${fint(n)}`], px, py); }).on('mouseleave', () => t.hide());
      x0 += n;
    });
    svg.append('text').attr('x', x(x0) + 6).attr('y', y(r.e) + y.bandwidth() / 2).attr('dy', '0.35em').text(fint(x0));
  });
});
const condKind = (c) => (c === 'En rango' ? 'ok' : c === 'Presión baja' ? 'low' : c === 'Presión alta' ? 'alert' : 'mid');
const ORD = ['Presión alta', 'Presión baja', 'Inestable', 'Sin rango válido', 'En rango'];
dash.draw('condTabla', (tb) => fill(tb, D('cond').filter((r) => r.tipo === tb.dataset.tipo && byEq(r)).sort((a, b) => ORD.indexOf(a.condicion) - ORD.indexOf(b.condicion) || bySite(a, b)), (tr, r) => {
  cell(tr, r.equipo); cell(tr, r.sector); cell(tr, r.bloque); cell(tr, fint(r.lecturas), 'num'); cell(tr, f1(r.prom), 'num strong'); cell(tr, r.rango, 'num'); cell(tr, f1(r.ult), 'num'); cell(tr, fdate(r.ultFecha));
  cell(tr, nv(r.pctBajo), 'num'); cell(tr, nv(r.pctAlto), 'num'); chip(tr, r.condicion === 'Sin rango válido' ? 'Rango mal cargado' : r.condicion, condKind(r.condicion)); cell(tr, r.comentarios, 'gx-wrap gx-muted');
}));
dash.draw('aforoTabla', (tb) => fill(tb, D('aforos').filter(byEq).sort(bySite), (tr, r) => {
  cell(tr, r.equipo); cell(tr, r.sector); cell(tr, r.bloque); cell(tr, fint(r.aforos), 'num'); cell(tr, f1(r.prom), 'num strong'); cell(tr, f1(r.nominal), 'num');
  chip(tr, `${r.pctNominal} %`, r.pctNominal > 200 ? 'alert' : r.pctNominal < 90 || r.pctNominal > 110 ? 'low' : 'ok', 'num');
  if (r.cu == null) cell(tr, '—', 'num'); else chip(tr, fint(r.cu), r.cu < 90 ? 'alert' : 'ok', 'num'); cell(tr, r.faltanCu ? fint(r.faltanCu) : '0', 'num'); cell(tr, r.comentarios, 'gx-wrap gx-muted');
}));
dash.draw('mapa', (el) => {
  const eq = P().equipo, bl = D('bloques').filter((r) => enCampo(r) && (!eq || r.equipo === eq) && r.x_v != null), pts = D('puntos').filter((r) => enCampo(r) && (!eq || r.equipo === eq) && r.x != null);
  if (!bl.length) { empty(el, 'Sin coordenadas de válvulas para este filtro.'); return; }
  el.replaceChildren();
  const xs = bl.map((r) => r.x_v).concat(pts.map((r) => r.x)), ys = bl.map((r) => r.y_v).concat(pts.map((r) => r.y));
  const W = el.clientWidth || 800, H = Math.min(620, Math.max(320, W * 0.6)), m = 24;
  const [x0, x1] = d3.extent(xs), [y0, y1] = d3.extent(ys), k = Math.min((W - 2 * m) / Math.max(1, x1 - x0), (H - 2 * m) / Math.max(1, y1 - y0));
  const X = (v) => m + (v - x0) * k + ((W - 2 * m) - (x1 - x0) * k) / 2, Y = (v) => H - m - (v - y0) * k - ((H - 2 * m) - (y1 - y0) * k) / 2;
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
  const t = tip(el);
  svg.append('g').selectAll('line').data(bl.filter((r) => r.x_c != null)).join('line').attr('x1', (r) => X(r.x_v)).attr('y1', (r) => Y(r.y_v)).attr('x2', (r) => X(r.x_c)).attr('y2', (r) => Y(r.y_c)).style('stroke', BL.bosque25);
  svg.append('g').selectAll('circle').data(bl.filter((r) => r.x_c != null)).join('circle').attr('cx', (r) => X(r.x_c)).attr('cy', (r) => Y(r.y_c)).attr('r', 3.5).style('fill', '#fff').style('stroke', BL.bosque);
  svg.append('g').selectAll('rect').data(bl).join('rect').attr('x', (r) => X(r.x_v) - 3.5).attr('y', (r) => Y(r.y_v) - 3.5).attr('width', 7).attr('height', 7).style('fill', (r) => (r.medido ? BL.bosque : BL.bosque25))
    .on('mousemove', (ev, r) => { const [px, py] = d3.pointer(ev, el); t.show([`${r.equipo} · ${r.sector} · ${r.bloque}`, r.medido ? 'Válvula con mediciones' : 'Sin mediciones esta temporada'], px, py); }).on('mouseleave', () => t.hide());
  const col = Object.fromEntries(UBIC.map((u) => [u.k, u.c]));
  svg.append('g').selectAll('circle').data(pts).join('circle').attr('cx', (r) => X(r.x)).attr('cy', (r) => Y(r.y)).attr('r', 6).style('fill', (r) => col[r.ubicacion] || BL.bosque25).style('stroke', '#fff').attr('stroke-width', 1.5)
    .on('mousemove', (ev, r) => { const [px, py] = d3.pointer(ev, el); t.show([`Aforo ${f1(r.valor)} l/h (nominal ${f1(r.optimo)})`, `${r.equipo} · ${r.sector} · ${r.bloque}`, `${fdate(r.fecha)} · ${r.ubicacion}${r.tramo ? ' · tramo ' + r.tramo.toLowerCase() : ''}`, r.dist_valvula != null ? `A ${fint(r.dist_valvula)} m de la válvula` : ''].filter(Boolean), px, py); })
    .on('mouseleave', () => t.hide());
  const s = 200 * k; svg.append('line').attr('x1', W - m - s).attr('x2', W - m).attr('y1', H - 8).attr('y2', H - 8).style('stroke', BL.bosque).attr('stroke-width', 2);
  svg.append('text').attr('x', W - m - s / 2).attr('y', H - 12).attr('text-anchor', 'middle').attr('class', 'gx-small').text('200 m');
});
dash.draw('mapaNota', (el) => {
  const pts = D('puntos').filter(byEq), tr = d3.rollup(pts.filter((r) => r.tramo), (g) => g.length, (r) => r.tramo);
  el.textContent = `${fint(pts.length)} aforos en el filtro. A lo largo de la hilera: inicio ${tr.get('Inicio') || 0}, mitad ${tr.get('Mitad') || 0}, cola ${tr.get('Cola') || 0} (solo bloques con cola medida). La cola de cada bloque es la mediana de sus lecturas GPS de cola.`;
});
dash.draw('ubicTabla', (tb) => { const rs = D('ubicacion').filter(enCampo), n = d3.sum(rs, (r) => r.aforos);
  fill(tb, UBIC.map((u) => ({k: u.k, n: (rs.find((r) => r.ubicacion === u.k) || {}).aforos || 0})).filter((r) => r.n), (tr, r) => { cell(tr, r.k); cell(tr, fint(r.n), 'num'); cell(tr, `${Math.round(r.n * 100 / n)} %`, 'num'); }); });
dash.draw('limpiezaTabla', (tb) => fill(tb, D('limpieza').filter(enCampo), (tr, r) => { cell(tr, r.regla, 'gx-wrap'); chip(tr, r.accion, /^Excluida|^No se usa/.test(r.accion) ? 'alert' : /^Corregida/.test(r.accion) ? 'low' : 'mid'); cell(tr, fint(r.lecturas), 'num'); }));
const detF = {tipo: '.gx-det-tipo', origen: '.gx-det-origen', estado: '.gx-det-estado'};
Object.entries(detF).forEach(([k, s]) => document.querySelectorAll(s).forEach((el) => el.addEventListener('change', () => dash.setParams({['det_' + k]: el.value || null}))));
let qT = null; document.querySelectorAll('.gx-det-q').forEach((el) => el.addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(() => dash.setParams({det_q: el.value || null}), 250); }));
const detRows = () => {
  const p = dash.params(), q = (p.det_q || '').toLowerCase();
  return D('lecturas').filter((r) => byEq(r) && (!p.det_tipo || r.tipo === p.det_tipo) && (!p.det_origen || r.origen === p.det_origen) &&
    (!p.det_estado || (p.det_estado === 'excl' ? !r.incluida : p.det_estado === 'nota' ? !!r.nota : r.estado === p.det_estado)) &&
    (!q || `${r.sector} ${r.bloque} ${r.comentario} ${r.equipo}`.toLowerCase().includes(q)));
};
dash.draw('detalleTabla', (tb) => { const rs = detRows().slice(-800).reverse(); fill(tb, rs, (tr, r) => {
  if (!r.incluida) tr.className = 'gx-excl';
  cell(tr, r.fecha); cell(tr, r.tipo); cell(tr, r.origen === 'API Wiseconn' ? 'API' : 'Manual'); cell(tr, r.equipo); cell(tr, r.sector); cell(tr, r.bloque);
  cell(tr, `${fnum(r.valor)} ${r.unidad}${r.valor !== r.valor_original ? ` (registró ${fnum(r.valor_original)})` : ''}`, 'num strong'); cell(tr, r.min == null ? '—' : `${fnum(r.min)}–${fnum(r.max)}`, 'num');
  if (['Bajo', 'Alto', 'En rango'].includes(r.estado)) chip(tr, r.estado, tone(r.estado)); else cell(tr, r.estado, 'gx-muted');
  cell(tr, r.ubicacion ? r.ubicacion + (r.tramo ? ` · ${r.tramo.toLowerCase()}` : '') : '—'); cell(tr, r.comentario, 'gx-wrap gx-muted'); cell(tr, r.nota, 'gx-wrap gx-muted');
}); });
dash.draw('detalleNota', (el) => { const n = detRows().length; el.textContent = `${fint(n)} lecturas en el filtro${n > 800 ? '; se muestran las 800 más recientes. Acote con los filtros' : ''}.`; });

// ---- Plan de acción
dash.draw('diagResTabla', (tb) => {
  const rs = D('diagnostico').filter(byEq), g = d3.groups(rs, (r) => r.diagnostico).map(([d, x]) => ({d, n: x.length, ...x[0]})).sort((a, b) => a.orden - b.orden || b.n - a.n);
  fill(tb, g, (tr, r) => { if (r.prioridad === '—') cell(tr, '—'); else chip(tr, r.prioridad, prioKind(r.prioridad)); cell(tr, r.d, 'strong'); cell(tr, fint(r.n), 'num'); cell(tr, r.causa, 'gx-wrap'); cell(tr, r.accion, 'gx-wrap'); });
});
dash.draw('planApiTabla', (tb) => fill(tb, D('api').filter(byEq).concat(D('presion').filter((r) => byEq(r) && r.resultado !== 'Presiones coherentes' && r.resultado !== 'Sin válvulas medidas').map((r) => ({...r, cruce: r.resultado, prioridad: 'Media'})))
  .sort((a, b) => ({Alta: 0, Media: 1, Baja: 2}[a.prioridad] ?? 3) - ({Alta: 0, Media: 1, Baja: 2}[b.prioridad] ?? 3) || bySite(a, b)), (tr, r) => {
  if (r.prioridad === '—') cell(tr, '—'); else chip(tr, r.prioridad, prioKind(r.prioridad)); cell(tr, r.equipo); cell(tr, r.sector); cell(tr, r.cruce, 'strong'); cell(tr, r.detalle, 'gx-wrap'); cell(tr, r.accion, 'gx-wrap');
}, 'Este campo no envía caudal ni presión por la API de Wiseconn en la temporada.'));
dash.draw('planDatosTabla', (tb) => fill(tb, D('observaciones').filter((r) => enCampo(r) && (r.tema === 'Medición' || r.tema === 'Datos')).sort((a, b) => ({Alta: 0, Media: 1, Baja: 2}[a.prioridad] ?? 3) - ({Alta: 0, Media: 1, Baja: 2}[b.prioridad] ?? 3)), (tr, r) => {
  chip(tr, r.prioridad, prioKind(r.prioridad)); bold(cell(tr, '', 'gx-wrap'), r.titulo, r.detalle); cell(tr, r.accion, 'gx-wrap'); cell(tr, r.donde, 'gx-wrap gx-muted');
}));
document.querySelectorAll('.gx-prio').forEach((s) => s.addEventListener('change', () => dash.setParams({prio: s.value || null})));
dash.draw('planBloques', (tb) => { const p = dash.params().prio;
  fill(tb, D('diagnostico').filter((r) => byEq(r) && r.prioridad !== '—' && (!p || r.prioridad === p)).sort((a, b) => a.orden - b.orden || bySite(a, b)), (tr, r) => {
    chip(tr, r.prioridad, prioKind(r.prioridad)); cell(tr, r.equipo); cell(tr, r.sector); cell(tr, r.bloque); bold(cell(tr, '', 'gx-wrap'), r.diagnostico, r.causa); cell(tr, r.accion, 'gx-wrap'); cell(tr, r.comentarios, 'gx-wrap gx-muted');
  }); });

// ---- Óptimos
const TORD = ['Válvula', 'Cola', 'Aforo', 'Caudal del sector'];
dash.draw('optTabla', (tb) => fill(tb, D('optimos').filter(enCampo).sort((a, b) => TORD.indexOf(a.tipo) - TORD.indexOf(b.tipo) || (b.lecturas - a.lecturas)), (tr, r) => {
  two(tr, r.tipo, r.unidad, 'strong'); cell(tr, r.cargado, 'num'); cell(tr, r.bloques == null ? '—' : fint(r.bloques), 'num'); cell(tr, fint(r.lecturas), 'num');
  two(tr, nv(r.mediana), r.p25 == null ? '' : `${nv(r.p25)}–${nv(r.p75)}`, 'num strong');
  if (r.pctEnRango == null) cell(tr, '—', 'num'); else chip(tr, `${r.pctEnRango} %`, r.pctEnRango >= 70 ? 'ok' : r.pctEnRango >= 40 ? 'low' : 'alert', 'num');
  cell(tr, r.base, 'gx-muted'); if (r.sugerido === 'Mantener') chip(tr, 'Mantener', 'ok'); else cell(tr, r.sugerido, 'gx-wrap strong');
}));
