// Motor mínimo: guarda datos y parámetros; app.js define render().
window.dash = {
  D: null, P: {},
  _init(data, params) { this.D = data; this.P = {...params}; },
  _refresh() { if (this.render) this.render(); },
  setParams(p) { Object.assign(this.P, p); this._refresh(); }
};
