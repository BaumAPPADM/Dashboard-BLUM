// Motor mínimo que reemplaza al runtime del dashboard: datos, cálculos, dibujos, filtros y vínculos.
(function () {
  const datasets = {}, calcs = {}, cache = {}, draws = {}, onDataFns = [];
  let params = {}, defaults = {};
  const dash = {
    _init(data, defs) { Object.assign(datasets, data); defaults = {...defs}; params = {...defs}; },
    data(id) {
      if (id in datasets) return {status: 'ok', data: datasets[id], columns: datasets[id].length ? Object.keys(datasets[id][0]) : [], meta: []};
      if (id in calcs) {
        if (!(id in cache)) {
          const c = calcs[id];
          try { cache[id] = c.fn(...c.inputs.map((i) => dash.data(i).data)); }
          catch (e) { console.error('Cálculo', id, e); cache[id] = []; }
        }
        return {status: 'ok', data: cache[id], columns: cache[id].length ? Object.keys(cache[id][0]) : [], meta: []};
      }
      return {status: 'missing', data: [], columns: [], meta: []};
    },
    calc(id, def) { calcs[id] = def; },
    loader() {},
    draw(name, fn) {
      if (fn) { draws[name] = typeof fn === 'function' ? fn : (fn.update || fn.mount); return; }
      runDraw(name);
    },
    onData(fn) { onDataFns.push(fn); try { fn(); } catch (e) { console.error(e); } },
    params() { return {...params}; },
    setParams(p) { Object.entries(p).forEach(([k, v]) => { if (v === null || v === undefined) params[k] = null; else params[k] = v; }); refresh(); },
    resetParams() { params = {...defaults}; refresh(); },
    setLink(name) { if (name) history.replaceState(null, '', '#' + name); },
    refresh() { refresh(); },
    colors: ['#002E2B', '#77CFC9', '#3C7F7A', '#668280', '#F64500', '#C30016', '#BFCBCA', '#FBA680']
  };
  const visible = (el) => !el.closest('[hidden]');
  function runDraw(name) {
    const fn = draws[name]; if (!fn) return;
    document.querySelectorAll(`[data-draw="${name}"]`).forEach((el) => { if (visible(el)) { try { fn(el); } catch (e) { console.error('Dibujo', name, e); } } });
  }
  function refresh() {
    onDataFns.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
    Object.keys(draws).forEach(runDraw);
  }
  let t = null;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(refresh, 200); });
  dash._refresh = refresh;
  window.dash = dash;
})();
