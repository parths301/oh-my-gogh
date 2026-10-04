/* Oh my Gogh! marketplace: shared helpers. No dependencies.
   All DOM is built with createElement and textContent, never innerHTML, so user text cannot become markup. */
(function (w) {
  'use strict';
  var state = { csrf: null };

  function api(method, path, body) {
    var opts = { method: method, credentials: 'same-origin', headers: { 'Accept': 'application/json' } };
    if (state.csrf) opts.headers['X-CSRF-Token'] = state.csrf;
    if (body instanceof FormData) {
      opts.body = body;
    } else if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { ok: res.ok && data && data.ok !== false, status: res.status, data: data || {} };
      });
    }).catch(function () {
      return { ok: false, status: 0, data: { error: 'network', message: 'We could not reach the server. Please check your connection and try again.' } };
    });
  }

  /* h('div', {class:'x', 'aria-label':'y', on:{click:fn}}, 'text', childNode, ...) */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'on') { Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); }); }
        else if (k === 'text') { el.textContent = v; }
        else if (k === 'value') { el.value = v; }
        else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'readOnly') { el[k] = !!v; }
        else { el.setAttribute(k, v === true ? '' : String(v)); }
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  function money(minor, currency) {
    try { return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en', { style: 'currency', currency: currency }).format(minor / 100); }
    catch (e) { return currency + ' ' + (minor / 100).toFixed(2); }
  }
  function titleCase(s) { return String(s || '').replace(/(^|[\s\/-])(\S)/g, function (m, a, b) { return a + b.toUpperCase(); }); }

  /* Show per-field errors from an API response; returns true if any field had one. */
  function showFieldErrors(form, fields, prefix) {
    var any = false;
    form.querySelectorAll('.err').forEach(function (e) { e.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach(function (e) { e.removeAttribute('aria-invalid'); });
    Object.keys(fields || {}).forEach(function (name) {
      var err = form.querySelector('#' + (prefix || 'err-') + name);
      var input = form.querySelector('[name="' + name + '"]');
      if (err) { err.textContent = fields[name]; any = true; }
      if (input) input.setAttribute('aria-invalid', 'true');
    });
    return any;
  }
  function setMsg(el, state2, text) { el.textContent = text || ''; el.setAttribute('data-state', state2 || ''); }

  w.OMG = { state: state, api: api, h: h, clear: clear, money: money, titleCase: titleCase, showFieldErrors: showFieldErrors, setMsg: setMsg };
})(window);
