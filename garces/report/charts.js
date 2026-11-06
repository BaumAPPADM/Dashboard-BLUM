// Gráficos (colores Blum)
// Condición por equipo del campo elegido: barras apiladas horizontales
dash.draw('condChart', (el) => {
  const {COND, P, enCampo, fail, empty, tip, textW, fint} = window.GX;
  const d = dash.data('cond_bloque');
  if (d.status !== 'ok') { fail(el, d.status); return; }
  const {equipo} = P(), tipo = el.dataset.tipo;
  const rs = d.data.filter((r) => r.tipo === tipo && enCampo(r));
  if (!rs.length) { empty(el, `Sin mediciones de ${tipo.toLowerCase()} en este campo.`); return; }
  el.replaceChildren();
  const eqs = [...new Set(rs.map((r) => r.equipo))].sort((a, b) => a.localeCompare(b, 'es', {numeric: true}));
  const rows = eqs.map((e) => ({equipo: e, ...Object.fromEntries(COND.map((c) => [c.k, rs.filter((r) => r.equipo === e && r.condicion === c.k).length]))}));
  const W = el.clientWidth, rowH = 26, H = Math.max(60, rows.length * rowH + 28);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
  const ml = Math.max(40, ...rows.map((r) => textW(svg, r.equipo))) + 10;
  const tot = d3.max(rows, (r) => d3.sum(COND, (c) => r[c.k])) || 1;
  const x = d3.scaleLinear([0, tot], [ml, W - 30]);
  const y = d3.scaleBand(rows.map((r) => r.equipo), [4, H - 22]).padding(0.25);
  const ticks = x.ticks(Math.min(tot, 6)).filter(Number.isInteger);
  svg.append('g').selectAll('line').data(ticks).join('line').attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', H - 22).style('stroke', 'var(--cds-chart-grid)');
  svg.append('g').selectAll('text').data(ticks).join('text').attr('x', x).attr('y', H - 6).attr('text-anchor', 'middle').text(fint);
  const t = tip(el);
  rows.forEach((r) => {
    let x0 = 0;
    svg.append('text').attr('x', ml - 8).attr('y', y(r.equipo) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').attr('class', r.equipo === equipo ? 'strong' : null).text(r.equipo);
    COND.forEach((c) => {
      const n = r[c.k]; if (!n) return;
      svg.append('rect').attr('x', x(x0) + 0.5).attr('y', y(r.equipo)).attr('width', Math.max(1, x(x0 + n) - x(x0) - 1)).attr('height', y.bandwidth()).attr('rx', 2)
        .style('fill', c.c).style('opacity', equipo && r.equipo !== equipo ? 0.35 : 1)
        .on('mousemove', (ev) => { const [px, py] = d3.pointer(ev, el); t.show([r.equipo, `${c.k}: ${fint(n)}`], px, py); })
        .on('mouseleave', () => t.hide());
      x0 += n;
    });
    svg.append('text').attr('x', x(x0) + 6).attr('y', y(r.equipo) + y.bandwidth() / 2).attr('dy', '0.35em').text(fint(x0));
  });
});

// Presión de válvula vs aforo por bloque del campo elegido
dash.draw('relScatter', (el) => {
  const {P, enCampo, BL, fail, empty, tip, fnum, fint} = window.GX;
  const d = dash.data('aforo_bloque');
  if (d.status !== 'ok') { fail(el, d.status); return; }
  const equipo = el.dataset.alcance === 'todos' ? '' : P().equipo;
  const rs = d.data.filter((r) => enCampo(r) && r.valvPct != null);
  if (rs.length < 2) { empty(el, 'Este campo no tiene bloques con presión de válvula y aforo medidos a la vez.'); return; }
  el.replaceChildren();
  const W = el.clientWidth, H = 360, m = {l: 44, r: 16, t: 12, b: 40};
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
  const x = d3.scaleLinear(d3.extent([...rs.map((r) => r.valvPct), 100]), [m.l, W - m.r]).nice();
  const y = d3.scaleLinear(d3.extent([...rs.map((r) => r.aforoPct), 100]), [H - m.b, m.t]).nice();
  const gx = svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(Math.max(3, Math.floor(W / 80))).tickFormat((v) => fint(v) + '%'));
  const gy = svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickFormat((v) => fint(v) + '%'));
  [gx, gy].forEach((g) => { g.attr('font-size', null).attr('font-family', null); g.selectAll('line,path').style('stroke', 'var(--cds-chart-axis)'); });
  svg.append('line').attr('x1', x(100)).attr('x2', x(100)).attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '4 3');
  svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(100)).attr('y2', y(100)).style('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '4 3');
  svg.append('text').attr('x', W - m.r).attr('y', H - 6).attr('text-anchor', 'end').text('Presión de válvula, % de su óptimo');
  svg.append('text').attr('x', m.l + 4).attr('y', m.t + 10).text('Aforo, % del nominal');
  const t = tip(el);
  svg.append('g').selectAll('circle').data(rs).join('circle').attr('cx', (r) => x(r.valvPct)).attr('cy', (r) => y(r.aforoPct)).attr('r', 5)
    .style('fill', (r) => (equipo && r.equipo !== equipo ? BL.bosque25 : BL.turquesa)).style('stroke', BL.bosque).attr('stroke-width', 1.2)
    .on('mousemove', (ev, r) => { const [px, py] = d3.pointer(ev, el); t.show([r.bloque_key.split(' · ').slice(2).join(' · '), `Válvula ${fnum(r.valvProm)} bar (${fint(r.valvPct)}% del óptimo)`, `Aforo ${fnum(r.prom)} l/h (${fint(r.aforoPct)}% del nominal)`], px, py); })
    .on('mouseleave', () => t.hide());
});

// Ubicación de aforos: barra 100% por equipo del campo elegido
dash.draw('ubicBar', (el) => {
  const {UBIC, enCampo, fail, empty, tip, fnum, fint, textW} = window.GX;
  const d = dash.data('lecturas');
  if (d.status !== 'ok') { fail(el, d.status); return; }
  const rs = d.data.filter((r) => r.incluida && r.tipo === 'Aforo' && enCampo(r));
  if (!rs.length) { empty(el, 'Sin aforos en este campo.'); return; }
  el.replaceChildren();
  const eqs = [...new Set(rs.map((r) => r.equipo))].sort((a, b) => a.localeCompare(b, 'es', {numeric: true}));
  const W = el.clientWidth, H = Math.max(60, eqs.length * 30 + 12);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
  const ml = Math.max(...eqs.map((e) => textW(svg, e))) + 12;
  const x = d3.scaleLinear([0, 100], [ml, W - 4]), y = d3.scaleBand(eqs, [6, H - 6]).padding(0.3);
  const t = tip(el);
  eqs.forEach((eq) => {
    const g = rs.filter((r) => r.equipo === eq), n = g.length;
    svg.append('text').attr('x', ml - 8).attr('y', y(eq) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').attr('class', 'strong').text(eq);
    let x0 = 0;
    UBIC.forEach((u) => {
      const c = g.filter((r) => r.ubicacion === u.k).length; if (!c) return;
      const pct = c * 100 / n;
      svg.append('rect').attr('x', x(x0)).attr('y', y(eq)).attr('width', Math.max(1, x(x0 + pct) - x(x0) - 1)).attr('height', y.bandwidth()).attr('rx', 2).style('fill', u.c)
        .on('mousemove', (ev) => { const [px, py] = d3.pointer(ev, el); t.show([`${eq} · ${u.k}`, `${fint(c)} de ${fint(n)} aforos · ${fnum(Math.round(pct * 10) / 10)}%`], px, py); })
        .on('mouseleave', () => t.hide());
      const lbl = `${fint(Math.round(pct))}%`;
      if (x(x0 + pct) - x(x0) > textW(svg, lbl) + 8) svg.append('text').attr('x', (x(x0) + x(x0 + pct)) / 2).attr('y', y(eq) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'middle').style('fill', u.c === '#002E2B' || u.c === '#C30016' || u.c === '#3C7F7A' ? '#FFFFFF' : '#002E2B').style('pointer-events', 'none').text(lbl);
      x0 += pct;
    });
  });
});

// Mapa del campo elegido: válvulas, colas y aforos
dash.draw('mapa', (el) => {
  const {UBIC, BL, P, enCampo, fail, empty, tip, fnum, fint, fdate} = window.GX;
  const b = dash.data('bloques'), l = dash.data('lecturas');
  if (b.status !== 'ok' || l.status !== 'ok') { fail(el, b.status === 'error' || l.status === 'error' ? 'error' : b.status); return; }
  const {equipo} = P();
  const bl = b.data.filter((r) => enCampo(r) && r.valvula_x != null);
  if (!bl.length) { empty(el, 'Las válvulas de este campo no tienen coordenadas en BLUM.'); return; }
  el.replaceChildren();
  const lc = l.data.filter((r) => enCampo(r) && r.tipo === 'Aforo' && r.incluida);
  const medidos = new Set(lc.map((r) => r.bloque_key));
  const eqSel = el.dataset.alcance === 'medidos' ? '' : equipo;
  let sel = eqSel ? bl.filter((r) => r.equipo === eqSel) : el.dataset.alcance === 'medidos' ? bl.filter((r) => medidos.has(r.bloque_key)) : bl;
  if (!sel.length) sel = bl;
  const col = new Map(UBIC.map((u) => [u.k, u.c]));
  const af = lc.filter((r) => (!eqSel || r.equipo === eqSel) && r.x != null && r.ubicacion !== 'Fuera del campo');
  const pts = sel.flatMap((r) => [[r.valvula_x, r.valvula_y], ...(r.cola_x != null ? [[r.cola_x, r.cola_y]] : [])]);
  const ex = d3.extent(pts, (p) => p[0]), ey = d3.extent(pts, (p) => p[1]), pad = 80;
  af.forEach((r) => { if (r.x > ex[0] - 400 && r.x < ex[1] + 400 && r.y > ey[0] - 400 && r.y < ey[1] + 400) { ex[0] = Math.min(ex[0], r.x); ex[1] = Math.max(ex[1], r.x); ey[0] = Math.min(ey[0], r.y); ey[1] = Math.max(ey[1], r.y); } });
  const spanX = ex[1] - ex[0] + 2 * pad, spanY = ey[1] - ey[0] + 2 * pad;
  const W = el.clientWidth, H = Math.round(Math.min(760, Math.max(360, W * spanY / spanX)));
  const k = Math.min(W / spanX, H / spanY);
  const cx = (ex[0] + ex[1]) / 2, cy = (ey[0] + ey[1]) / 2;
  const X = (v) => W / 2 + (v - cx) * k, Y = (v) => H / 2 - (v - cy) * k;
  const inside = (r) => X(r.x) >= 0 && X(r.x) <= W && Y(r.y) >= 0 && Y(r.y) <= H;
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
  const inSel = new Set(sel.map((r) => r.bloque_key)), other = (r) => !inSel.has(r.bloque_key);
  svg.append('g').selectAll('line').data(bl.filter((r) => r.cola_x != null)).join('line')
    .attr('x1', (r) => X(r.valvula_x)).attr('y1', (r) => Y(r.valvula_y)).attr('x2', (r) => X(r.cola_x)).attr('y2', (r) => Y(r.cola_y))
    .style('stroke', BL.bosque60).style('opacity', (r) => (other(r) ? 0.2 : 0.7)).attr('stroke-width', 1.5);
  const shown = af.filter(inside);
  svg.append('g').selectAll('circle').data(shown).join('circle').attr('cx', (r) => X(r.x)).attr('cy', (r) => Y(r.y)).attr('r', 4)
    .style('fill', (r) => col.get(r.ubicacion) || BL.bosque25).style('stroke', 'var(--color-panel)').attr('stroke-width', 0.6).style('opacity', 0.9);
  svg.append('g').selectAll('rect.cola').data(bl.filter((r) => r.cola_x != null)).join('rect').attr('class', 'cola')
    .attr('x', (r) => X(r.cola_x) - 3.5).attr('y', (r) => Y(r.cola_y) - 3.5).attr('width', 7).attr('height', 7)
    .style('fill', 'var(--color-panel)').style('stroke', BL.bosque).attr('stroke-width', 1.5).style('opacity', (r) => (other(r) ? 0.3 : 1));
  svg.append('g').selectAll('path.valv').data(bl).join('path').attr('class', 'valv')
    .attr('d', (r) => `M${X(r.valvula_x)},${Y(r.valvula_y) - 5}l5,5l-5,5l-5,-5z`)
    .style('fill', BL.bosque).style('opacity', (r) => (other(r) ? 0.3 : 1));
  const eqc = d3.rollups(bl, (g) => [d3.mean(g, (r) => r.valvula_x), d3.max(g, (r) => r.valvula_y)], (r) => r.equipo);
  svg.append('g').selectAll('text').data(eqc.filter(([, p]) => X(p[0]) > 0 && X(p[0]) < W && Y(p[1]) > 0 && Y(p[1]) < H)).join('text')
    .attr('x', ([, p]) => X(p[0])).attr('y', ([, p]) => Y(p[1]) - 12).attr('text-anchor', 'middle').attr('class', ([e]) => (e === eqSel ? 'strong' : null))
    .style('opacity', ([e]) => (eqSel && e !== eqSel ? 0.5 : 1)).text(([e]) => e.replace('Equipo ', 'E'));
  const sb = [50, 100, 200, 500, 1000].find((v) => v * k > 60) || 1000;
  const sg = svg.append('g').attr('transform', `translate(12,${H - 14})`);
  sg.append('line').attr('x1', 0).attr('x2', sb * k).style('stroke', BL.bosque).attr('stroke-width', 2);
  sg.append('text').attr('x', sb * k + 6).attr('dy', '0.35em').text(`${fint(sb)} m`);
  const items = [...shown.map((r) => ({px: X(r.x), py: Y(r.y), lines: [`Aforo · ${fdate(r.fecha, true)}`, `${r.equipo} · ${r.sector} · ${r.bloque}`, `${fnum(r.valor)} l/h · ${r.ubicacion}`,
      r.bloque_gps ? `GPS junto a ${r.bloque_gps.split(' · ').slice(2).join(' · ')}` : '', r.dist_valvula != null ? `${fint(r.dist_valvula)} m a la válvula${r.dist_cola != null ? ` · ${fint(r.dist_cola)} m a la cola` : ''}` : '', r.comentario || '']})),
    ...sel.map((r) => ({px: X(r.valvula_x), py: Y(r.valvula_y), lines: ['Válvula', `${r.equipo} · ${r.sector} · ${r.bloque}`, r.largo_m != null ? `${fint(r.largo_m)} m hasta la cola` : 'Sin cola medida']}))];
  const dl = d3.Delaunay.from(items, (i) => i.px, (i) => i.py), t = tip(el);
  svg.append('rect').attr('width', W).attr('height', H).style('fill', 'transparent')
    .on('mousemove', (ev) => { const [px, py] = d3.pointer(ev, el); const i = dl.find(px, py); const it = items[i]; if (it && Math.hypot(it.px - px, it.py - py) < 18) t.show(it.lines.filter(Boolean), px, py); else t.hide(); })
    .on('mouseleave', () => t.hide());
});

// Cumplimiento del calendario por campo: barra de avance con marca del avance esperado
dash.draw('cumplChart', (el) => {
  const {BL, fail, tip, fint, fdate, textW} = window.GX;
  const d = dash.data('cumplimiento');
  if (d.status !== 'ok') { fail(el, d.status); return; }
  el.replaceChildren();
  const rows = d.data.filter((r) => r.campo !== 'Total');
  const W = el.clientWidth, rowH = 24, H = rows.length * rowH + 30;
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
  const ml = Math.max(...rows.map((r) => textW(svg, r.campo))) + 12, mr = 60;
  const x = d3.scaleLinear([0, 100], [ml, W - mr]), y = d3.scaleBand(rows.map((r) => r.campo), [4, H - 24]).padding(0.28);
  [0, 25, 50, 75, 100].forEach((v) => {
    svg.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', 0).attr('y2', H - 24).style('stroke', 'var(--cds-chart-grid)');
    svg.append('text').attr('x', x(v)).attr('y', H - 8).attr('text-anchor', 'middle').text(`${v}%`);
  });
  const col = (r) => (r.estado === 'Cumplido' || r.estado === 'Al día' ? BL.turquesa : r.estado === 'Casi completo' ? BL.mezcla : r.estado === 'Por iniciar' ? BL.bosque60 : r.estado === 'Sin avance' ? BL.rojo : BL.naranjo);
  const t = tip(el);
  rows.forEach((r) => {
    const yy = y(r.campo), h = y.bandwidth();
    svg.append('text').attr('x', ml - 8).attr('y', yy + h / 2).attr('dy', '0.35em').attr('text-anchor', 'end').text(r.campo);
    svg.append('rect').attr('x', x(0)).attr('y', yy).attr('width', x(100) - x(0)).attr('height', h).attr('rx', 2).style('fill', BL.bosque25).style('opacity', 0.45);
    svg.append('rect').attr('x', x(0)).attr('y', yy).attr('width', Math.max(r.pct ? 2 : 0, x(Math.min(100, r.pct)) - x(0))).attr('height', h).attr('rx', 2).style('fill', col(r));
    if (r.esperado < 100) svg.append('line').attr('x1', x(r.esperado)).attr('x2', x(r.esperado)).attr('y1', yy - 3).attr('y2', yy + h + 3).style('stroke', BL.bosque).attr('stroke-width', 2);
    svg.append('text').attr('x', x(100) + 6).attr('y', yy + h / 2).attr('dy', '0.35em').attr('class', 'strong').text(`${fint(r.pct)}%`);
    svg.append('rect').attr('x', 0).attr('y', yy - 2).attr('width', W).attr('height', h + 4).style('fill', 'transparent')
      .on('mousemove', (ev) => { const [px, py] = d3.pointer(ev, el); t.show([r.campo, `${fint(r.medidos)} de ${fint(r.priorizados)} bloques priorizados medidos`, `Fecha límite ${fdate(r.fin)} · ${r.estado}`, `${fint(r.fueraPlan)} bloques medidos fuera del plan`], px, py); })
      .on('mouseleave', () => t.hide());
  });
});

// Contorno convexo propio (cadena monótona)
const hull = (pts) => {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return null;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  const h = lo.slice(0, -1).concat(up.slice(0, -1));
  return h.length >= 3 ? h : null;
};
// Mapa por equipo de riego (resumen del campo): sectores, bloques y puntos de aforo de un equipo
const mapaEquipos = () => {
  const l = dash.data('lecturas');
  if (l.status !== 'ok') return [];
  const {enCampo} = window.GX;
  return [...new Set(l.data.filter((r) => enCampo(r) && r.tipo === 'Aforo' && r.incluida && r.x != null).map((r) => r.equipo))].sort((a, b) => a.localeCompare(b, 'es', {numeric: true}));
};
const mapaEq = () => { const eqs = mapaEquipos(), p = dash.params().mapaEq; return eqs.includes(p) ? p : eqs[0] || ''; };
dash.draw('mapaEqSel', (sel) => {
  const eqs = mapaEquipos();
  sel.replaceChildren(...eqs.map((e) => new Option(e, e)));
  sel.value = mapaEq();
  sel.onchange = () => dash.setParams({mapaEq: sel.value});
});
dash.draw('mapaEquipo', (el) => {
  const {UBIC, BL, enCampo, fail, empty, tip, fnum, fint, fdate} = window.GX;
  const b = dash.data('bloques'), l = dash.data('lecturas');
  if (b.status !== 'ok' || l.status !== 'ok') { fail(el, b.status === 'error' || l.status === 'error' ? 'error' : b.status); return; }
  const eq = mapaEq();
  if (!eq) { empty(el, 'Este campo no tiene aforos con GPS para dibujar.'); return; }
  const bl = b.data.filter((r) => enCampo(r) && r.equipo === eq && r.valvula_x != null);
  const af = l.data.filter((r) => enCampo(r) && r.equipo === eq && r.tipo === 'Aforo' && r.incluida && r.x != null && r.ubicacion !== 'Fuera del campo');
  if (!bl.length) { empty(el, 'Las válvulas de este equipo no tienen coordenadas en blum.'); return; }
  el.replaceChildren();
  const pts = [...bl.flatMap((r) => [[r.valvula_x, r.valvula_y], ...(r.cola_x != null ? [[r.cola_x, r.cola_y]] : [])])];
  const ex = d3.extent(pts, (p) => p[0]), ey = d3.extent(pts, (p) => p[1]);
  af.forEach((r) => { if (r.x > ex[0] - 300 && r.x < ex[1] + 300 && r.y > ey[0] - 300 && r.y < ey[1] + 300) { ex[0] = Math.min(ex[0], r.x); ex[1] = Math.max(ex[1], r.x); ey[0] = Math.min(ey[0], r.y); ey[1] = Math.max(ey[1], r.y); } });
  const pad = 40, spanX = Math.max(ex[1] - ex[0], 120) + 2 * pad, spanY = Math.max(ey[1] - ey[0], 120) + 2 * pad;
  const W = el.clientWidth, H = Math.round(Math.min(720, Math.max(380, W * spanY / spanX)));
  const k = Math.min(W / spanX, H / spanY), cx = (ex[0] + ex[1]) / 2, cy = (ey[0] + ey[1]) / 2;
  const X = (v) => W / 2 + (v - cx) * k, Y = (v) => H / 2 - (v - cy) * k;
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H).style('overflow', 'hidden');
  // sectores: contorno de válvulas, colas y aforos ubicados en sus bloques
  const enBloque = new Set(['Junto a la válvula', 'Dentro del bloque', 'Junto a la cola']);
  const secs = d3.groups(bl, (r) => r.sector).sort((a, c) => a[0].localeCompare(c[0], 'es', {numeric: true}));
  const gs = svg.append('g');
  secs.forEach(([sec, g], i) => {
    const keys = new Set(g.map((r) => r.bloque_key));
    const p = [...g.flatMap((r) => [[X(r.valvula_x), Y(r.valvula_y)], ...(r.cola_x != null ? [[X(r.cola_x), Y(r.cola_y)]] : [])]),
      ...af.filter((r) => keys.has(r.bloque_key) && enBloque.has(r.ubicacion)).map((r) => [X(r.x), Y(r.y)])];
    const box = hull(p);
    const c = [d3.mean(p, (q) => q[0]), d3.mean(p, (q) => q[1])];
    const fill = i % 2 ? BL.bosque25 : BL.turquesa;
    if (box) gs.append('path').attr('d', `M${box.join('L')}Z`).style('fill', fill).style('fill-opacity', 0.18).style('stroke', BL.bosque60).style('stroke-width', 14).style('stroke-opacity', 0.12).style('stroke-linejoin', 'round');
    const top = d3.min(p, (q) => q[1]);
    gs.append('text').attr('x', c[0]).attr('y', Math.max(12, top - 12)).attr('text-anchor', 'middle').attr('class', 'strong').text(sec);
  });
  svg.append('g').selectAll('line').data(bl.filter((r) => r.cola_x != null)).join('line')
    .attr('x1', (r) => X(r.valvula_x)).attr('y1', (r) => Y(r.valvula_y)).attr('x2', (r) => X(r.cola_x)).attr('y2', (r) => Y(r.cola_y))
    .style('stroke', BL.bosque60).attr('stroke-width', 1.5);
  const col = new Map(UBIC.map((u) => [u.k, u.c]));
  svg.append('g').selectAll('circle').data(af).join('circle').attr('cx', (r) => X(r.x)).attr('cy', (r) => Y(r.y)).attr('r', 4.5)
    .style('fill', (r) => col.get(r.ubicacion) || BL.bosque25).style('stroke', 'var(--color-panel)').attr('stroke-width', 0.8);
  svg.append('g').selectAll('rect').data(bl.filter((r) => r.cola_x != null)).join('rect')
    .attr('x', (r) => X(r.cola_x) - 4).attr('y', (r) => Y(r.cola_y) - 4).attr('width', 8).attr('height', 8)
    .style('fill', 'var(--color-panel)').style('stroke', BL.bosque).attr('stroke-width', 1.5);
  svg.append('g').selectAll('path').data(bl).join('path').attr('d', (r) => `M${X(r.valvula_x)},${Y(r.valvula_y) - 6}l6,6l-6,6l-6,-6z`).style('fill', BL.bosque);
  svg.append('g').selectAll('text').data(bl).join('text').attr('x', (r) => X(r.valvula_x) + 8).attr('y', (r) => Y(r.valvula_y) + 4).text((r) => r.bloque.replace('Bloque ', 'B'));
  const sb = [25, 50, 100, 200, 500].find((v) => v * k > 60) || 500;
  const sg = svg.append('g').attr('transform', `translate(12,${H - 14})`);
  sg.append('line').attr('x1', 0).attr('x2', sb * k).style('stroke', BL.bosque).attr('stroke-width', 2);
  sg.append('text').attr('x', sb * k + 6).attr('dy', '0.35em').text(`${fint(sb)} m`);
  const items = [...af.map((r) => ({px: X(r.x), py: Y(r.y), lines: [`Aforo · ${fdate(r.fecha, true)}`, `${r.sector} · ${r.bloque}`, `${fnum(r.valor)} l/h · ${r.ubicacion}`,
      r.bloque_gps ? `GPS junto a ${r.bloque_gps.split(' · ').slice(3).join(' · ')}` : '', r.dist_valvula != null ? `${fint(r.dist_valvula)} m a la válvula${r.dist_cola != null ? ` · ${fint(r.dist_cola)} m a la cola` : ''}` : '', r.comentario || '']})),
    ...bl.map((r) => ({px: X(r.valvula_x), py: Y(r.valvula_y), lines: ['Válvula', `${r.sector} · ${r.bloque}`, r.largo_m != null ? `${fint(r.largo_m)} m hasta la cola` : 'Sin cola medida']}))];
  const dl = d3.Delaunay.from(items, (i) => i.px, (i) => i.py), t = tip(el);
  svg.append('rect').attr('width', W).attr('height', H).style('fill', 'transparent')
    .on('mousemove', (ev) => { const [px, py] = d3.pointer(ev, el); const i = dl.find(px, py); const it = items[i]; if (it && Math.hypot(it.px - px, it.py - py) < 18) t.show(it.lines.filter(Boolean), px, py); else t.hide(); })
    .on('mouseleave', () => t.hide());
});
