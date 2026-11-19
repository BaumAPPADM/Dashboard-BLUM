// Cálculos sobre las lecturas de BLUM (Baumsystem) de los campos de Ag. Garcés, últimos 2 meses
dash.calc('general', {
  inputs: ['lecturas', 'bloques'], title: 'Resumen por campo',
  description: 'Por campo con mediciones: lecturas usadas, bloques medidos de los bloques del campo, período, lecturas excluidas y corregidas; la fila Total suma todos los campos.',
  fn: (lecturas, bloques) => {
    const inc = lecturas.filter((r) => r.incluida);
    const tot = d3.rollup(bloques, (g) => g.length, (r) => r.campo);
    const fila = (campo, rs, all, nb) => {
      const dias = rs.map((r) => r.dia).sort();
      return {campo, campo_n: rs[0]?.campo_n ?? 0, lecturas: rs.length, bloques: new Set(rs.map((r) => r.bloque_key)).size, bloquesCampo: nb,
        desde: dias[0] ?? null, hasta: dias[dias.length - 1] ?? null, excluidas: all.filter((r) => !r.incluida).length,
        corregidas: all.filter((r) => /^Corregida/.test(r.nota)).length};
    };
    const out = [...d3.group(lecturas, (r) => r.campo)].map(([campo, all]) => fila(campo, all.filter((r) => r.incluida), all, tot.get(campo) || 0));
    out.sort((a, b) => a.campo_n - b.campo_n);
    out.push({...fila('Total', inc, lecturas, bloques.length), campo_n: 999, campos: out.length});
    return out;
  }
});

dash.calc('cond_bloque', {
  inputs: ['lecturas'], title: 'Condición de cada válvula y cola',
  description: 'Cada válvula o cola con su promedio, última lectura, % de lecturas bajo el mínimo o sobre el máximo y comentarios de terreno; presión baja o alta según su promedio frente al rango, inestable cuando el promedio está en rango pero la mitad o más de las lecturas no.',
  fn: (lecturas) => {
    const rs = lecturas.filter((r) => r.incluida && (r.tipo === 'Válvula' || r.tipo === 'Cola') && r.estado !== 'Sin rango válido');
    const out = [];
    for (const [id, g] of d3.group(rs, (r) => `${r.tipo}|${r.bloque_key}`)) {
      const s = [...g].sort((a, b) => (a.fecha < b.fecha ? -1 : 1)), n = s.length, last = s[n - 1];
      const bajo = s.filter((r) => r.estado === 'Bajo').length, alto = s.filter((r) => r.estado === 'Alto').length;
      const prom = d3.mean(s, (r) => r.valor);
      const condicion = prom < last.min ? 'Presión baja' : prom > last.max ? 'Presión alta' : (bajo + alto) / n >= 0.5 ? 'Inestable' : 'En rango';
      const f = (x) => String(x).replace('.', ',');
      out.push({id, tipo: last.tipo, campo: last.campo, equipo: last.equipo, equipo_n: last.equipo_n, sector: last.sector, bloque: last.bloque, bloque_key: last.bloque_key,
        lecturas: n, prom: Math.round(prom * 100) / 100, min: last.min, max: last.max, rango: `${f(last.min)}–${f(last.max)}`, ult: last.valor, ultFecha: last.dia,
        pctBajo: Math.round(bajo * 100 / n), pctAlto: Math.round(alto * 100 / n), condicion,
        comentarios: [...new Set(s.map((r) => r.comentario).filter(Boolean))].join(' | ')});
    }
    return out;
  }
});

dash.calc('aforo_bloque', {
  inputs: ['lecturas'], title: 'Aforos por bloque',
  description: 'Por bloque: aforos, promedio, nominal y rango del gotero, diferencia %, DU (cuarto más bajo / promedio), CU de Christiansen, % fuera de rango, presión promedio de válvula y cola y comentarios de los aforos.',
  fn: (lecturas) => {
    const rs = lecturas.filter((r) => r.incluida);
    const pres = d3.rollup(rs.filter((r) => r.tipo !== 'Aforo' && r.estado !== 'Sin rango válido'), (g) => ({prom: d3.mean(g, (r) => r.valor), op: d3.mean(g, (r) => r.optimo)}), (r) => r.bloque_key, (r) => r.tipo);
    const out = [];
    for (const [id, g] of d3.group(rs.filter((r) => r.tipo === 'Aforo'), (r) => r.bloque_key)) {
      const f = g[0], v = g.map((r) => r.valor).sort((a, b) => a - b), n = v.length, prom = d3.mean(v), nominal = d3.mean(g, (r) => r.optimo);
      const q = v.slice(0, Math.max(1, Math.floor(n / 4)));
      const p = pres.get(f.bloque_key), va = p?.get('Válvula'), co = p?.get('Cola');
      out.push({id, campo: f.campo, equipo: f.equipo, equipo_n: f.equipo_n, sector: f.sector, bloque: f.bloque, bloque_key: f.bloque_key,
        aforos: n, dias: new Set(g.map((r) => r.dia)).size, prom: Math.round(prom * 100) / 100, nominal: Math.round(nominal * 100) / 100,
        min: Math.round(d3.mean(g, (r) => r.min) * 100) / 100, max: Math.round(d3.mean(g, (r) => r.max) * 100) / 100,
        difPct: Math.round((prom / nominal - 1) * 100), du: n >= 4 ? Math.round(d3.mean(q) / prom * 100) : null,
        cu: n >= 4 ? Math.round((1 - d3.sum(v, (x) => Math.abs(x - prom)) / (n * prom)) * 100) : null,
        pctAlto: Math.round(g.filter((r) => r.estado === 'Alto').length * 100 / n), pctBajo: Math.round(g.filter((r) => r.estado === 'Bajo').length * 100 / n),
        valvProm: va ? Math.round(va.prom * 100) / 100 : null, valvPct: va ? Math.round(va.prom / va.op * 100) : null,
        colaProm: co ? Math.round(co.prom * 100) / 100 : null, aforoPct: Math.round(prom / nominal * 100),
        comentarios: [...new Set(g.map((r) => r.comentario).filter(Boolean))].slice(0, 6).join(' | ')});
    }
    return out;
  }
});

dash.calc('relacion', {
  inputs: ['aforo_bloque'], title: 'Presión de válvula vs. aforo',
  description: 'Por campo, correlación de Pearson entre la presión de válvula (% de su óptimo) y el aforo (% del nominal) de los bloques con ambas mediciones; sin valor con menos de 5 bloques.',
  fn: (aforo_bloque) => [...d3.group(aforo_bloque.filter((r) => r.valvPct != null), (r) => r.campo)].map(([campo, rs]) => {
    const mx = d3.mean(rs, (r) => r.valvPct), my = d3.mean(rs, (r) => r.aforoPct);
    const sxy = d3.sum(rs, (r) => (r.valvPct - mx) * (r.aforoPct - my)), sx = d3.sum(rs, (r) => (r.valvPct - mx) ** 2), sy = d3.sum(rs, (r) => (r.aforoPct - my) ** 2);
    return {campo, bloques: rs.length, r: rs.length >= 5 && sx > 0 && sy > 0 ? Math.round(sxy / Math.sqrt(sx * sy) * 100) / 100 : null};
  })
});

dash.calc('resumen', {
  inputs: ['lecturas', 'cond_bloque', 'aforo_bloque'], title: 'Resumen por campo y tipo',
  description: 'Por campo y tipo de medición: lecturas, % en rango, bajo y sobre, promedio, válvulas o colas por condición; en aforos también nominal, DU y CU mediana, bloques con CU bajo 90 % y aforos por bloque.',
  fn: (lecturas, cond_bloque, aforo_bloque) => {
    const out = [];
    const campos = [...new Set(lecturas.map((r) => r.campo)), 'Total'];
    for (const campo of campos) for (const tipo of ['Válvula', 'Cola', 'Aforo']) {
      const inC = (r) => campo === 'Total' || r.campo === campo;
      const rs = lecturas.filter((r) => r.incluida && r.tipo === tipo && r.estado !== 'Sin rango válido' && inC(r));
      const n = rs.length, pc = (e) => (n ? Math.round(rs.filter((r) => r.estado === e).length * 100 / n) : null);
      const cb = cond_bloque.filter((r) => r.tipo === tipo && inC(r)), ab = aforo_bloque.filter((r) => r.cu != null && inC(r));
      const isA = tipo === 'Aforo', nb = new Set(rs.map((r) => r.bloque_key)).size;
      out.push({k: `${campo}|${tipo}`, campo, tipo, lecturas: n, pctEnRango: pc('En rango'), pctBajo: pc('Bajo'), pctAlto: pc('Alto'),
        prom: n ? Math.round(d3.mean(rs, (r) => r.valor) * 100) / 100 : null,
        activos: isA ? null : cb.length, activosBaja: isA ? null : cb.filter((r) => r.condicion === 'Presión baja').length,
        activosAlta: isA ? null : cb.filter((r) => r.condicion === 'Presión alta').length,
        nominal: isA && n ? Math.round(d3.mean(rs, (r) => r.optimo) * 100) / 100 : null,
        duMed: isA && ab.length ? Math.round(d3.median(ab, (r) => r.du)) : null, cuMed: isA && ab.length ? Math.round(d3.median(ab, (r) => r.cu)) : null, bloquesCuBajo: isA ? ab.filter((r) => r.cu < 90).length : null,
        bloques: nb, porBloque: isA && nb ? Math.round(n / nb) : null});
    }
    return out;
  }
});

dash.calc('ubicacion', {
  inputs: ['lecturas'], title: 'Ubicación GPS de los aforos',
  description: 'Aforos de cada campo según dónde quedó su GPS frente a la válvula y la cola de su bloque; la fila Total del campo suma los que quedaron en su bloque.',
  fn: (lecturas) => {
    const orden = ['Junto a la válvula', 'Dentro del bloque', 'Junto a la cola', 'Junto a otro bloque', 'Lejos de su bloque', 'Fuera del campo', 'Sin GPS', 'Sin referencia'];
    const out = [];
    for (const [campo, rs] of d3.group(lecturas.filter((r) => r.incluida && r.tipo === 'Aforo'), (r) => r.campo)) {
      const n = rs.length, c = (u) => rs.filter((r) => r.ubicacion === u).length;
      orden.forEach((ubicacion, i) => out.push({id: `${campo}|${ubicacion}`, campo, ubicacion, orden: i, aforos: c(ubicacion), pct: Math.round(c(ubicacion) * 1000 / n) / 10,
        enBloque: null, pctEnBloque: null, pctExtremos: null, fueraCampo: null, otroBloque: null, sinGps: null, lejos: null}));
      const enBloque = c(orden[0]) + c(orden[1]) + c(orden[2]);
      out.push({id: `${campo}|Total`, campo, ubicacion: 'Total', orden: 9, aforos: n, pct: 100, enBloque, pctEnBloque: Math.round(enBloque * 100 / n),
        pctExtremos: Math.round((c(orden[0]) + c(orden[2])) * 100 / n), fueraCampo: c('Fuera del campo'), otroBloque: c('Junto a otro bloque'), sinGps: c('Sin GPS'), lejos: c('Lejos de su bloque')});
    }
    return out;
  }
});

dash.calc('tramo', {
  inputs: ['lecturas'], title: 'Tramo del lateral aforado',
  description: 'Por campo, aforos ubicados en su bloque (con cola medida) según su proyección entre válvula y cola: inicio, mitad o final en tercios.',
  fn: (lecturas) => [...d3.group(lecturas.filter((r) => r.incluida && r.tipo === 'Aforo' && r.tramo), (r) => r.campo)].flatMap(([campo, rs]) =>
    ['Inicio', 'Mitad', 'Final'].map((tramo) => {
      const n = rs.filter((r) => r.tramo === tramo).length;
      return {id: `${campo}|${tramo}`, campo, tramo, aforos: n, pct: Math.round(n * 100 / rs.length)};
    }))
});

dash.calc('cola_valvula', {
  inputs: ['lecturas'], title: 'Cola sobre la válvula',
  description: 'Por campo, visitas (bloque y día) con presión de válvula y de cola, y cuántas veces la cola más alta superó en más de 0,05 bar al promedio de la válvula; con los bloques donde ocurrió.',
  fn: (lecturas) => {
    const rs = lecturas.filter((r) => r.incluida && (r.tipo === 'Válvula' || r.tipo === 'Cola'));
    const v = d3.rollup(rs.filter((r) => r.tipo === 'Válvula'), (g) => d3.mean(g, (r) => r.valor), (r) => `${r.bloque_key}|${r.dia}`);
    const c = d3.rollup(rs.filter((r) => r.tipo === 'Cola'), (g) => ({max: d3.max(g, (r) => r.valor), campo: g[0].campo, key: g[0].bloque_key}), (r) => `${r.bloque_key}|${r.dia}`);
    return [...new Set(lecturas.map((r) => r.campo))].map((campo) => {
      const pares = [...c].filter(([k, x]) => x.campo === campo && v.has(k)), sobre = pares.filter(([k, x]) => x.max > v.get(k) + 0.05);
      return {campo, pares: pares.length, colaMayor: sobre.length, bloques: [...new Set(sobre.map(([, x]) => x.key))].join(' ; ')};
    });
  }
});

dash.calc('limpieza', {
  inputs: ['lecturas'], title: 'Reglas de limpieza aplicadas',
  description: 'Por campo, cada regla de limpieza o advertencia aplicada a las lecturas, con su acción y el número de lecturas afectadas.',
  fn: (lecturas) => {
    const m = new Map();
    lecturas.filter((r) => r.nota).forEach((r) => r.nota.split(' · ').forEach((regla) => { const k = `${r.campo}|${regla}`; m.set(k, (m.get(k) || 0) + 1); }));
    return [...m].map(([id, lecturas]) => { const [campo, regla] = id.split('|');
      return {id, campo, regla, accion: /^Excluida/.test(regla) ? 'Excluida' : /^Corregida/.test(regla) ? 'Corregida' : 'Se marca', lecturas}; })
      .sort((a, b) => a.accion.localeCompare(b.accion) || b.lecturas - a.lecturas);
  }
});

dash.calc('rangos_valvula', {
  inputs: ['lecturas'], title: 'Rangos de válvula cargados',
  description: 'Por campo, válvulas medidas agrupadas por el rango óptimo (mín / óptimo / máx) que tienen cargado en BLUM, con los equipos donde aparece.',
  fn: (lecturas) => [...d3.group(lecturas.filter((r) => r.tipo === 'Válvula' && r.min != null), (r) => r.campo, (r) => [r.min, r.optimo, r.max].map((x) => String(x).replace('.', ',')).join(' / '))]
    .flatMap(([campo, m]) => [...m].map(([rango, g]) => ({id: `${campo}|${rango}`, campo, rango, valvulas: new Set(g.map((r) => r.bloque_key)).size,
      equipos: [...new Set(g.map((r) => r.equipo))].join(', ')}))).sort((a, b) => b.valvulas - a.valvulas)
});

dash.calc('semaforo', {
  inputs: ['cond_bloque', 'aforo_bloque', 'lecturas'], title: 'Estado por bloque',
  description: 'Por bloque medido: presión promedio de válvula y cola frente a su rango, caudal promedio frente al rango del gotero, uniformidad (CU de Christiansen), puntos a revisar y comentarios de terreno.',
  fn: (cond_bloque, aforo_bloque, lecturas) => {
    const rs = lecturas.filter((r) => r.incluida);
    const v = d3.rollup(rs.filter((r) => r.tipo === 'Válvula'), (g) => d3.mean(g, (r) => r.valor), (r) => `${r.bloque_key}|${r.dia}`);
    const sobre = new Set([...d3.rollup(rs.filter((r) => r.tipo === 'Cola'), (g) => d3.max(g, (r) => r.valor), (r) => `${r.bloque_key}|${r.dia}`)]
      .filter(([k, c]) => v.has(k) && c > v.get(k) + 0.05).map(([k]) => k.slice(0, k.lastIndexOf('|'))));
    const nulos = new Set(rs.filter((r) => r.tipo === 'Aforo' && r.valor <= 0.2).map((r) => r.bloque_key));
    const com = d3.rollup(rs.filter((r) => r.comentario), (g) => [...new Set(g.map((r) => r.comentario))].slice(0, 4).join(' | '), (r) => r.bloque_key);
    const cb = d3.index(cond_bloque, (r) => r.id), ab = d3.index(aforo_bloque, (r) => r.bloque_key);
    const nivel = (v, a, b) => (v == null || a == null ? '' : v < a ? 'Bajo' : v > b ? 'Alto' : 'En rango');
    const keys = [...new Set([...cond_bloque.map((r) => r.bloque_key), ...aforo_bloque.map((r) => r.bloque_key)])];
    return keys.map((bloque_key) => {
      const va = cb.get(`Válvula|${bloque_key}`), co = cb.get(`Cola|${bloque_key}`), af = ab.get(bloque_key), f = va || co || af;
      const valvulaNivel = nivel(va?.prom, va?.min, va?.max), colaNivel = nivel(co?.prom, co?.min, co?.max), aforoNivel = nivel(af?.prom, af?.min, af?.max);
      const m = [];
      if (valvulaNivel === 'Bajo') m.push('Válvula bajo su presión');
      if (valvulaNivel === 'Alto') m.push('Válvula sobre su presión');
      if (sobre.has(bloque_key)) m.push('Cola con más presión que la válvula');
      if (colaNivel === 'Bajo') m.push('Cola baja');
      if (colaNivel === 'Alto') m.push('Cola alta');
      if (aforoNivel === 'Bajo') m.push('Caudal bajo el rango');
      if (aforoNivel === 'Alto') m.push('Caudal sobre el rango');
      if (nulos.has(bloque_key)) m.push('Goteros sin caudal');
      if (af?.cu != null && af.cu < 90) m.push('Uniformidad (CU) bajo 90 %');
      return {bloque_key, campo: f.campo, equipo: f.equipo, equipo_n: f.equipo_n, sector: f.sector, bloque: f.bloque,
        valvula: va ? va.prom : null, valvulaNivel, cola: co ? co.prom : null, colaNivel, aforo: af ? af.prom : null, aforoNivel,
        cu: af ? af.cu : null, cuNivel: af?.cu == null ? '' : af.cu < 90 ? 'Bajo' : 'En rango',
        motivo: m.length ? m.join(' · ') : 'Sin observaciones', puntos: m.length, comentarios: com.get(bloque_key) || '',
        colaSobre: sobre.has(bloque_key), nulos: nulos.has(bloque_key)};
    });
  }
});

dash.calc('observaciones', {
  inputs: ['general', 'resumen', 'semaforo', 'ubicacion', 'cola_valvula', 'relacion', 'lecturas'], title: 'Observaciones y plan de acción',
  description: 'Por campo, observaciones breves generadas con reglas fijas sobre cobertura, presiones, caudal, uniformidad (CU) y ubicación de aforos, cada una con su acción, dónde aplicarla y prioridad.',
  fn: (general, resumen, semaforo, ubicacion, cola_valvula, relacion, lecturas) => {
    const corto = (k) => k.split(' · ').slice(2).join(' ').replace(/Equipo /g, 'E').replace(/Sector /g, 'S').replace(/Bloque /g, 'B');
    const lista = (keys) => (keys.length > 6 ? `${keys.slice(0, 6).map(corto).join(', ')} y ${keys.length - 6} más` : keys.map(corto).join(', '));
    const pl = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
    const fdia = (s) => `${+s.slice(8, 10)}-${s.slice(5, 7)}`;
    const out = [];
    for (const g of general.filter((r) => r.campo !== 'Total')) {
      const campo = g.campo, R = (t) => resumen.find((r) => r.k === `${campo}|${t}`) || {};
      const V = R('Válvula'), C = R('Cola'), A = R('Aforo'), S = semaforo.filter((r) => r.campo === campo);
      const U = ubicacion.find((r) => r.id === `${campo}|Total`), CV = cola_valvula.find((r) => r.campo === campo), RL = relacion.find((r) => r.campo === campo);
      const add = (nivel, titulo, detalle, accion, donde, prioridad) => out.push({id: `${campo}|${out.filter((o) => o.campo === campo).length + 1}`, campo, orden: out.filter((o) => o.campo === campo).length + 1, nivel, titulo, detalle, accion, donde: donde || '', prioridad});
      const cob = g.bloquesCampo ? Math.round(g.bloques * 100 / g.bloquesCampo) : null;
      add('Dato', 'Cobertura', `${g.bloques} de ${pl(g.bloquesCampo, 'bloque medido', 'bloques medidos')} (${cob} %), del ${fdia(g.desde)} al ${fdia(g.hasta)}.`, cob < 50 ? 'Completar la ronda de mediciones en los bloques que faltan.' : 'Mantener la frecuencia de medición.', '', cob < 50 ? 'Media' : 'Baja');
      if (A.lecturas && !V.lecturas && !C.lecturas) add('Atención', 'Aforos sin presiones', 'Hay aforos, pero no se midió presión de válvula ni de cola.', 'Medir presión de válvula y cola en la misma visita del aforo.', '', 'Alta');
      const vb = S.filter((r) => r.valvulaNivel === 'Bajo').map((r) => r.bloque_key), va = S.filter((r) => r.valvulaNivel === 'Alto').map((r) => r.bloque_key);
      if (vb.length) add('Alerta', 'Válvulas bajo su presión', `${vb.length} de ${pl(V.activos, 'válvula medida', 'válvulas medidas')} ${vb.length === 1 ? 'promedia' : 'promedian'} bajo su mínimo.`, 'Revisar regulación de la válvula, filtros y presión de la caseta; volver a medir.', lista(vb), vb.length / V.activos >= 0.3 ? 'Alta' : 'Media');
      if (va.length) add('Atención', 'Válvulas sobre su presión', `${va.length} de ${pl(V.activos, 'válvula medida', 'válvulas medidas')} ${va.length === 1 ? 'promedia' : 'promedian'} sobre su máximo.`, 'Bajar la regulación de la válvula a su óptimo.', lista(va), 'Media');
      const cbj = S.filter((r) => r.colaNivel === 'Bajo').map((r) => r.bloque_key), cal = S.filter((r) => r.colaNivel === 'Alto').map((r) => r.bloque_key);
      if (cbj.length) add('Alerta', 'Colas bajo su presión', `${cbj.length} de ${pl(C.activos, 'cola medida', 'colas medidas')} ${cbj.length === 1 ? 'promedia' : 'promedian'} bajo su mínimo.`, 'Revisar fugas y lavado de laterales; confirmar la presión de la válvula.', lista(cbj), 'Alta');
      if (cal.length) add('Atención', 'Colas sobre su presión', `${cal.length} de ${pl(C.activos, 'cola medida', 'colas medidas')} ${cal.length === 1 ? 'promedia' : 'promedian'} sobre su máximo.`, 'Revisar la regulación y confirmar la lectura de cola.', lista(cal), 'Media');
      if (CV?.colaMayor) add('Atención', 'Cola con más presión que la válvula', `En ${CV.colaMayor} de ${pl(CV.pares, 'visita', 'visitas')} la cola marcó más que la válvula el mismo día.`, 'Revisar manómetros y medir la válvula siempre a la salida.', lista(CV.bloques.split(' ; ')), 'Media');
      const qb = S.filter((r) => r.aforoNivel === 'Bajo').map((r) => r.bloque_key), qa = S.filter((r) => r.aforoNivel === 'Alto').map((r) => r.bloque_key);
      const nul = lecturas.filter((r) => r.campo === campo && r.incluida && r.tipo === 'Aforo' && r.valor <= 0.2);
      if (nul.length) add('Alerta', 'Goteros sin caudal', `${pl(nul.length, 'aforo marcó', 'aforos marcaron')} 0,2 l/h o menos.`, 'Revisar goteros tapados o líneas sin riego y volver a aforar.', lista([...new Set(nul.map((r) => r.bloque_key))]), 'Alta');
      if (qb.length) add('Alerta', 'Caudal bajo el rango', `${pl(qb.length, 'bloque promedia', 'bloques promedian')} bajo el mínimo de su gotero.`, 'Revisar obstrucciones y lavar laterales; volver a aforar.', lista(qb), 'Alta');
      if (qa.length) add('Atención', 'Caudal sobre el rango', `${pl(qa.length, 'bloque promedia', 'bloques promedian')} sobre el máximo de su gotero.`, 'Confirmar el gotero instalado y el caudal nominal cargado en BLUM.', lista(qa), 'Media');
      if (A.lecturas && !qb.length && !nul.length) add('Bien', 'Caudal en rango', `Los aforos promedian ${String(A.prom).replace('.', ',')} l/h frente a un nominal de ${String(A.nominal).replace('.', ',')} l/h.`, 'Sin acción.', '', '—');
      const du = S.filter((r) => r.cuNivel === 'Bajo').map((r) => r.bloque_key);
      if (du.length) add('Atención', 'Uniformidad baja', `${pl(du.length, 'bloque', 'bloques')} con CU bajo 90 % (mediana del campo ${A.cuMed} %).`, 'Revisar goteros tapados y presión al final del lateral.', lista(du), 'Media');
      else if (A.cuMed != null) add('Bien', 'Riego parejo', `CU mediana de ${A.cuMed} % y ningún bloque bajo 90 %.`, 'Sin acción.', '', '—');
      if (U && U.pctEnBloque < 90) {
        const p = [U.otroBloque && `${U.otroBloque} junto a otro bloque`, U.lejos && `${U.lejos} lejos de su bloque`, U.fueraCampo && `${U.fueraCampo} fuera del campo`, U.sinGps && `${U.sinGps} sin GPS`].filter(Boolean).join(', ');
        add('Atención', 'Aforos sin ubicación verificable', `Solo ${U.pctEnBloque} % de los aforos quedó en su bloque: ${p}.`,
          U.otroBloque > U.aforos / 3 ? 'Revisar en BLUM las coordenadas de las válvulas y que el aforo se registre en el bloque correcto.' : 'Guardar cada aforo en el punto, con GPS activo.', '', 'Media');
      } else if (U) add('Bien', 'Aforos bien ubicados', `${U.pctEnBloque} % de los aforos quedó registrado en su bloque.`, 'Sin acción.', '', '—');
      if (RL?.r != null && RL.bloques >= 8 && Math.abs(RL.r) < 0.3) add('Dato', 'La presión no explica el caudal', `Correlación ${String(RL.r).replace('.', ',')} entre presión de válvula y aforo en ${RL.bloques} bloques.`, 'Confirmar si los goteros son autocompensados y su caudal nominal.', '', 'Baja');
    }
    return out;
  }
});

dash.calc('campos', {
  inputs: ['general', 'resumen', 'ubicacion', 'cola_valvula', 'observaciones'], title: 'Comparación de campos',
  description: 'Una fila por campo: cobertura, válvulas y colas bajo su presión, aforo promedio frente al nominal, DU mediana, % de aforos ubicados en su bloque y observaciones de prioridad alta.',
  fn: (general, resumen, ubicacion, cola_valvula, observaciones) => general.filter((g) => g.campo !== 'Total').map((g) => {
    const R = (t) => resumen.find((r) => r.k === `${g.campo}|${t}`) || {};
    const V = R('Válvula'), C = R('Cola'), A = R('Aforo'), U = ubicacion.find((r) => r.id === `${g.campo}|Total`);
    const ob = observaciones.filter((o) => o.campo === g.campo);
    return {campo: g.campo, campo_n: g.campo_n, bloques: g.bloques, bloquesCampo: g.bloquesCampo, desde: g.desde, hasta: g.hasta,
      valvulas: V.activos || 0, valvBajas: V.activosBaja || 0, colas: C.activos || 0, colasBajas: C.activosBaja || 0,
      aforos: A.lecturas || 0, aforoProm: A.prom, nominal: A.nominal, pctAforoRango: A.pctEnRango, cuMed: A.cuMed, pctEnBloque: U ? U.pctEnBloque : null,
      alertas: ob.filter((o) => o.prioridad === 'Alta').length};
  })
});

dash.calc('diagnostico', {
  inputs: ['semaforo'], title: 'Diagnóstico y acción por bloque',
  description: 'Para cada bloque, combina el nivel de presión de válvula, presión de cola, caudal de goteros (frente al rango cargado en blum) y uniformidad en un diagnóstico, su causa probable, los pasos a seguir y una prioridad, según una tabla fija de reglas.',
  fn: (semaforo) => {
    const P = {Alta: 1, Media: 2, Baja: 3, '—': 4};
    return semaforo.map((r) => {
      const V = r.valvulaNivel || 'Sin dato', C = r.colaNivel || 'Sin dato', Q = r.aforoNivel || 'Sin dato', duBajo = r.cuNivel === 'Bajo';
      const pres = V !== 'Sin dato' || C !== 'Sin dato';
      let d;
      if (r.nulos) d = ['Goteros sin caudal', 'Goteros tapados, laterales cortados o línea sin riego al momento del aforo.', '1) Recorrer el bloque y revisar los goteros que no entregan agua. 2) Limpiar o reemplazar. 3) Volver a aforar.', 'Alta'];
      else if (V === 'Bajo' && Q === 'Alto') d = ['Presión baja con caudal alto', 'El bloque entrega más agua de la diseñada y eso hace caer la presión: fugas o roturas en laterales, goteros dañados o un gotero de mayor caudal que el cargado en blum. También puede ser un manómetro que marca bajo.', '1) Verificar el manómetro con uno de referencia. 2) Recorrer laterales buscando fugas, roturas o goteros saltados. 3) Confirmar modelo y caudal del gotero instalado y corregir el nominal en blum. 4) Recién entonces ajustar la válvula.', 'Alta'];
      else if (V === 'Bajo' && Q === 'Bajo') d = ['Falta presión en el bloque', 'No llega suficiente presión y el caudal ya bajó: filtros sucios, válvula reguladora mal ajustada, bomba o demasiados sectores regando a la vez.', '1) Revisar presión a la salida de la caseta y el estado de los filtros. 2) Subir la regulación de la válvula al óptimo. 3) Revisar los turnos de riego. 4) Volver a medir válvula, cola y aforo.', 'Alta'];
      else if (r.colaSobre || (V === 'Bajo' && C === 'Alto')) d = ['Lecturas de presión inconsistentes', 'La cola marca más que la válvula, lo que no ocurre en terreno plano: manómetros distintos, presión de válvula tomada a la entrada o pendiente a favor.', '1) Medir válvula (a la salida) y cola con el mismo manómetro. 2) Confirmar el punto de medición con el equipo de terreno. 3) Volver a medir antes de ajustar.', 'Media'];
      else if (V === 'Bajo' && C === 'Bajo') d = ['Presión baja, caudal aún en rango', 'Válvula y cola bajo su rango. Los goteros todavía compensan, pero trabajan al límite: con un poco menos de presión el caudal empezará a caer.', '1) Revisar filtros y presión de caseta. 2) Subir la regulación de la válvula al óptimo. 3) Volver a medir en la próxima ronda.', 'Media'];
      else if (V === 'Bajo') d = ['Válvula bajo su presión', 'La válvula está bajo su óptimo; la cola y el caudal todavía responden.', '1) Revisar filtros. 2) Subir la regulación de la válvula al óptimo. 3) Volver a medir.', 'Media'];
      else if (C === 'Bajo' && Q === 'Bajo') d = ['Pérdida de presión en los laterales', 'La presión entra bien pero no llega al final y el caudal baja: laterales obstruidos o con fugas, o finales de línea abiertos.', '1) Lavar laterales abriendo finales de línea. 2) Revisar fugas y roturas. 3) Si persiste, limpieza química de goteros. 4) Volver a aforar.', 'Alta'];
      else if (C === 'Bajo' && V === 'Sin dato') d = ['Cola baja, falta presión de válvula', 'La cola está bajo su rango, pero sin la presión de válvula no se sabe si el problema entra desde la válvula o se pierde en el lateral.', '1) Medir la presión de válvula en la próxima visita. 2) Revisar fugas y finales de línea.', 'Media'];
      else if (C === 'Bajo') d = ['Cola baja con válvula en rango', 'Hay pérdida de presión a lo largo del lateral, por fugas o laterales largos; el caudal todavía se mantiene.', '1) Revisar fugas y finales de línea. 2) Lavar laterales. 3) Medir de nuevo la cola en varias hileras.', 'Media'];
      else if (V === 'Alto' && C === 'Alto') d = ['Sobrepresión en el bloque', 'La válvula deja pasar más presión de la recomendada; aumenta el riesgo de fugas y desgaste de goteros.', '1) Bajar la regulación de la válvula al óptimo. 2) Revisar fugas. 3) Volver a medir.', 'Media'];
      else if (V === 'Alto') d = ['Válvula sobre su presión', 'La regulación de la válvula está más alta que el óptimo.', '1) Bajar la regulación de la válvula al óptimo. 2) Volver a medir.', Q === 'Bajo' ? 'Media' : 'Baja'];
      else if (Q === 'Bajo' && pres) d = ['Caudal bajo con presión correcta', 'La presión está bien y el caudal baja: lo más probable es obstrucción de goteros (sarro, algas o sedimento).', '1) Revisar goteros y filtros. 2) Limpieza química (ácido o cloro) según el tipo de obstrucción. 3) Volver a aforar.', 'Alta'];
      else if (Q === 'Bajo') d = ['Caudal bajo, sin presiones medidas', 'El caudal está bajo el rango y no hay presión de válvula ni de cola para saber si es falta de presión u obstrucción.', '1) Medir presión de válvula y cola. 2) Revisar goteros y filtros. 3) Volver a aforar.', 'Alta'];
      else if (Q === 'Alto') d = ['Caudal sobre el nominal', 'Goteros de mayor caudal que el cargado en blum, o goteros gastados que ya no regulan.', '1) Confirmar modelo y caudal del gotero instalado. 2) Corregir el nominal en blum si corresponde. 3) Si son goteros gastados, evaluar reemplazo.', 'Media'];
      else if (duBajo) d = ['Riego disparejo', 'La uniformidad (CU) está bajo 90 %: algunos goteros entregan bastante más o menos que el resto, por obstrucción puntual.', '1) Identificar las hileras con goteros bajos. 2) Limpiar o reemplazar goteros. 3) Volver a aforar.', 'Media'];
      else if (!pres) d = ['Faltan presiones', 'Hay aforos en rango, pero no se midió presión de válvula ni de cola.', 'Medir presión de válvula y de cola en la misma visita del aforo.', 'Baja'];
      else if (C === 'Alto') d = ['Cola sobre su presión', 'La cola marca sobre el máximo con la válvula en rango.', '1) Confirmar la lectura de cola. 2) Revisar la regulación de la válvula.', 'Baja'];
      else d = ['Bloque en orden', 'Presiones, caudal y uniformidad dentro de rango.', 'Mantener la frecuencia de medición.', '—'];
      if (d[3] !== 'Alta' && duBajo && d[0] !== 'Riego disparejo') d = [d[0], d[1] + ' Además, la uniformidad (CU) está bajo 90 %.', d[2] + ' Revisar goteros tapados en las hileras más bajas.', d[3] === '—' || d[3] === 'Baja' ? 'Media' : d[3]];
      return {bloque_key: r.bloque_key, campo: r.campo, equipo: r.equipo, sector: r.sector, bloque: r.bloque,
        valvula: r.valvula, valvulaNivel: r.valvulaNivel, cola: r.cola, colaNivel: r.colaNivel, aforo: r.aforo, aforoNivel: r.aforoNivel, cu: r.cu, cuNivel: r.cuNivel,
        diagnostico: d[0], causa: d[1], accion: d[2], prioridad: d[3], orden: P[d[3]], comentarios: r.comentarios};
    });
  }
});

dash.calc('diag_resumen', {
  inputs: ['diagnostico'], title: 'Bloques por diagnóstico',
  description: 'Por campo y en total, cuántos bloques quedan en cada diagnóstico, con su prioridad y la acción principal.',
  fn: (diagnostico) => {
    const out = [];
    for (const [campo, rs] of [...d3.group(diagnostico, (r) => r.campo), ['Todos', diagnostico]]) {
      for (const [diag, g] of d3.group(rs, (r) => r.diagnostico)) {
        out.push({id: `${campo}|${diag}`, campo, diagnostico: diag, bloques: g.length, prioridad: g[0].prioridad, orden: g[0].orden, accion: g[0].accion});
      }
    }
    return out.sort((a, b) => a.orden - b.orden || b.bloques - a.bloques);
  }
});

// Meta semanal (protocolo de mediciones en terreno de Ag. Garcés)
const PROTO = {inicio: null, cambio: '2026-11-09', meta: 5, valvulas: 1, colas: 2, aforosAntes: 12, aforosAhora: 24};
const lunes = (s) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); };
const masDias = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const rangoSem = (s) => { const f = masDias(s, 6), d1 = +s.slice(8, 10), d2 = +f.slice(8, 10), m1 = MES3[+s.slice(5, 7) - 1], m2 = MES3[+f.slice(5, 7) - 1]; return m1 === m2 ? `${d1}–${d2} ${m2}` : `${d1} ${m1}–${d2} ${m2}`; };
const inicioSem = (periodo) => { const p = (periodo && periodo[0]) || {}; const l = lunes(p.desde || '2026-09-28'); return l < p.desde ? masDias(l, 7) : l; };
const metaAf = (sem) => (sem >= PROTO.cambio ? PROTO.aforosAhora : PROTO.aforosAntes);
window.GXP = {PROTO, rangoSem, metaAf};

dash.calc('bloque_semana', {
  inputs: ['lecturas', 'periodo'], title: 'Bloques medidos por semana',
  description: 'Cada bloque medido en cada semana (lunes a domingo) desde la primera semana completa del período evaluado (2 meses hasta la última medición): aforos, presiones de válvula y de cola registradas, meta de aforos de esa semana (12 hasta el 08-11-2026, 24 desde el 09-11-2026), si cumple el protocolo completo (aforos + 1 válvula + 2 colas), qué le faltó y cómo se repartieron los aforos a lo largo de la hilera (inicio, mitad, cola) según su GPS.',
  fn: (lecturas, periodo) => {
    const corte = lecturas.map((r) => r.dia).sort().pop(), semAct = lunes(corte), ini = inicioSem(periodo);
    const L = lecturas.filter((r) => r.incluida && r.dia >= ini);
    return [...d3.group(L, (r) => lunes(r.dia), (r) => r.bloque_key)].flatMap(([sem, m]) => [...m].map(([key, g]) => {
      const f = g[0], af = g.filter((r) => r.tipo === 'Aforo');
      const nA = af.length, nV = g.filter((r) => r.tipo === 'Válvula').length, nC = g.filter((r) => r.tipo === 'Cola').length, meta = metaAf(sem);
      const faltas = [];
      if (nA < meta) faltas.push(`${meta - nA} ${meta - nA === 1 ? 'aforo' : 'aforos'}`);
      if (nV < PROTO.valvulas) faltas.push('presión de válvula');
      if (nC < PROTO.colas) faltas.push(nC === 1 ? '1 cola' : '2 colas');
      const t = (k) => af.filter((r) => r.tramo === k).length, ini = t('Inicio'), mit = t('Mitad'), fin = t('Final'), sinT = nA - ini - mit - fin;
      let mapeo;
      if (!nA) mapeo = 'Sin aforos';
      else if (sinT > nA / 2) mapeo = 'Sin GPS para ubicar';
      else { const fl = [ini ? null : 'inicio', mit ? null : 'mitad', fin ? null : 'cola'].filter(Boolean); mapeo = fl.length ? `Sin aforos en ${fl.join(' ni ')}` : 'En los tres tramos'; }
      return {id: sem + '|' + key, semana: sem, semanaTxt: rangoSem(sem), enCurso: sem === semAct, campo: f.campo, campo_n: f.campo_n, equipo: f.equipo, sector: f.sector, bloque: f.bloque, bloque_key: key,
        aforos: nA, metaAforos: meta, valvula: nV, colas: nC, completo: !faltas.length, estado: faltas.length ? 'Incompleto' : 'Completo', falta: faltas.length ? 'Falta ' + faltas.join(', ') : '—',
        ini, mit, fin, sinTramo: sinT, mapeo, ultima: g.map((r) => r.dia).sort().pop()};
    }));
  }
});

dash.calc('semanal', {
  inputs: ['bloque_semana', 'bloques', 'lecturas', 'periodo'], title: 'Meta semanal por campo',
  description: 'Por campo y semana desde la primera semana completa del período evaluado (2 meses hasta la última medición): bloques con protocolo completo frente a la meta de 5, bloques medidos e incompletos, y estado (Cumplida 5 o más; Casi 3 a 4; Baja 1 a 2; Solo incompletos; Sin mediciones). La semana en curso se marca aparte.',
  fn: (bs, bloques, lecturas, periodo) => {
    const corte = lecturas.map((r) => r.dia).sort().pop(), semAct = lunes(corte), semanas = [];
    for (let s = inicioSem(periodo); s <= semAct; s = masDias(s, 7)) semanas.push(s);
    const campos = [...new Map([...bloques, ...bs].map((r) => [r.campo, r.campo_n]))].sort((a, b) => a[1] - b[1]);
    const idx = d3.group(bs, (r) => r.campo, (r) => r.semana);
    return campos.flatMap(([campo, campo_n]) => semanas.map((sem) => {
      const g = idx.get(campo)?.get(sem) || [], comp = g.filter((r) => r.completo).length;
      return {id: campo + '|' + sem, campo, campo_n, semana: sem, semanaTxt: rangoSem(sem), enCurso: sem === semAct, completos: comp, medidos: g.length, incompletos: g.length - comp, meta: PROTO.meta, metaAforos: metaAf(sem),
        estado: comp >= PROTO.meta ? 'Cumplida' : comp >= 3 ? 'Casi' : comp >= 1 ? 'Baja' : g.length ? 'Solo incompletos' : 'Sin mediciones'};
    }));
  }
});

dash.calc('cumplimiento', {
  inputs: ['semanal', 'bloque_semana', 'lecturas'], title: 'Cumplimiento de la meta semanal',
  description: 'Por campo: semanas cerradas evaluadas y cumplidas, bloques completos en la última semana cerrada y en la semana en curso, promedio de bloques completos por semana, % de bloques medidos con protocolo completo, lo que más falta en los incompletos y última medición; la fila Total resume todos los campos.',
  fn: (sw, bs, lecturas) => {
    const corte = lecturas.map((r) => r.dia).sort().pop();
    const sems = [...new Set(sw.map((r) => r.semana))].sort(), act = sems[sems.length - 1], ult = sems[sems.length - 2];
    const out = [...d3.group(sw, (r) => r.campo)].map(([campo, g]) => {
      const c = g.filter((r) => !r.enCurso), a = g.find((r) => r.semana === act), u = g.find((r) => r.semana === ult);
      const b = bs.filter((r) => r.campo === campo), inc = b.filter((r) => !r.completo);
      const falt = [['aforos', inc.filter((r) => r.aforos < r.metaAforos).length], ['colas', inc.filter((r) => r.colas < PROTO.colas).length], ['presión de válvula', inc.filter((r) => r.valvula < PROTO.valvulas).length]].sort((x, y) => y[1] - x[1]);
      return {campo, campo_n: g[0].campo_n, semanas: c.length, cumplidas: c.filter((r) => r.estado === 'Cumplida').length,
        completos: d3.sum(g, (r) => r.completos), medidos: b.length, incompletos: inc.length,
        promSemana: c.length ? Math.round(d3.sum(c, (r) => r.completos) / c.length * 10) / 10 : null,
        pctCompleto: b.length ? Math.round((b.length - inc.length) * 100 / b.length) : null,
        actual: a?.completos ?? 0, actualMedidos: a?.medidos ?? 0, estadoAct: a?.estado ?? 'Sin mediciones',
        ultSem: u?.completos ?? 0, ultMedidos: u?.medidos ?? 0, estadoUlt: u?.estado ?? 'Sin mediciones',
        faltaMas: inc.length && falt[0][1] ? `${falt[0][0]} (${falt[0][1]} de ${inc.length})` : '—', ultima: b.map((r) => r.ultima).sort().pop() || null};
    }).sort((a, b) => a.campo_n - b.campo_n);
    const n = out.length, B = d3.sum(out, (r) => r.medidos), I = d3.sum(out, (r) => r.incompletos);
    const sem0 = sems[0];
    out.push({campo: 'Total', campo_n: 999, campos: n, semanaIni: sem0 ? rangoSem(sem0) : '—', metaSemana: n * PROTO.meta, corte: `${+corte.slice(8, 10)} de ${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][+corte.slice(5, 7) - 1]} de ${corte.slice(0, 4)}`, semanaAct: act ? rangoSem(act) : '—', semanaUlt: ult ? rangoSem(ult) : '—',
      actual: d3.sum(out, (r) => r.actual), ultSem: d3.sum(out, (r) => r.ultSem), cumplenUlt: out.filter((r) => r.estadoUlt === 'Cumplida').length, cumplenAct: out.filter((r) => r.estadoAct === 'Cumplida').length,
      sinUlt: out.filter((r) => r.estadoUlt === 'Sin mediciones').length, medidos: B, incompletos: I, completos: B - I, pctCompleto: B ? Math.round((B - I) * 100 / B) : null,
      semanas: null, cumplidas: null, promSemana: null, faltaMas: null, ultima: null});
    return out;
  }
});
