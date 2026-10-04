/* Oh my Gogh! admin approvals. No dependencies.
   The admin token lives only in sessionStorage (omg_admin_token). OMG.api does not send it,
   so requests go through adminFetch. DOM is built with OMG.h / textContent only. */
(function () {
  'use strict';

  var O = window.OMG;
  var app = document.getElementById('app');
  if (!O || !app) return;

  var TOKEN_KEY = 'omg_admin_token';
  var BTN_OK = 'btn btn-sm btn-gold';
  var BTN_NO = 'btn btn-sm btn-danger';
  var BTN_RESET = 'btn btn-sm btn-ghost';
  var TABS = [
    { id: 'artists-pending', label: 'Pending artists', kind: 'artists', filter: 'pending' },
    { id: 'products-pending', label: 'Pending listings', kind: 'products', filter: 'pending' },
    { id: 'artists-all', label: 'All artists', kind: 'artists', filter: 'all' },
    { id: 'products-all', label: 'All listings', kind: 'products', filter: 'all' }
  ];

  var active = 'artists-pending';
  var flash = '';
  var view = 0;
  var fetchSeq = 0;

  function readToken() {
    try { return sessionStorage.getItem(TOKEN_KEY) || ''; }
    catch (e) { return ''; }
  }
  function writeToken(value) {
    try {
      if (value) sessionStorage.setItem(TOKEN_KEY, value);
      else sessionStorage.removeItem(TOKEN_KEY);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* Authorization is attached here. OMG.api is for the artist session and must not see this token. */
  function adminFetch(method, path, body) {
    var headers = { 'Accept': 'application/json', 'Authorization': 'Bearer ' + readToken() };
    var opts = { method: method, credentials: 'same-origin', headers: headers };
    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body || {});
    }
    return fetch(path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { ok: res.ok && data && data.ok !== false, status: res.status, data: data || {} };
      });
    }).catch(function () {
      return { ok: false, status: 0, data: { message: 'We could not reach the server. Please check your connection and try again.' } };
    });
  }
  function currentTab() {
    for (var i = 0; i < TABS.length; i++) if (TABS[i].id === active) return TABS[i];
    return TABS[0];
  }
  function badgeClass(status) {
    if (status === 'approved' || status === 'published') return 'badge badge-ok';
    if (status === 'pending' || status === 'draft') return 'badge badge-pending';
    if (status === 'rejected' || status === 'suspended') return 'badge badge-bad';
    return 'badge';
  }
  function badge(status, label) {
    var name = O.titleCase(status || 'unknown');
    return O.h('span', { class: badgeClass(status), text: name, 'aria-label': label + ' ' + name });
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    try { return d.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch (e) { return String(iso).slice(0, 10); }
  }
  function joinParts(parts) {
    var out = [];
    for (var i = 0; i < parts.length; i++) if (parts[i]) out.push(parts[i]);
    return out.join(' · ');
  }
  function tagText(tags) {
    if (!tags || !tags.length) return '';
    var out = [];
    for (var i = 0; i < tags.length; i++) if (tags[i]) out.push(String(tags[i]));
    return out.join(', ');
  }
  function productCount(n) {
    var c = Number(n);
    if (!isFinite(c) || c < 0) c = 0;
    return c === 1 ? '1 product' : (c + ' products');
  }
  function safeSrc(url) {
    /* Same-origin image paths only, so a bad API value cannot become a remote or script URL. */
    if (typeof url !== 'string' || url.charAt(0) !== '/' || url.indexOf('//') !== -1) return '';
    if (!/^\/[A-Za-z0-9._~/-]+$/.test(url)) return '';
    return url;
  }
  function publicHref(slug) {
    if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return '';
    return '/p/' + slug;
  }
  function safeId(id) {
    return typeof id === 'string' && /^[a-z0-9_-]{1,40}$/.test(id) ? id : '';
  }
  function serverMessage(r, fallback) {
    return (r && r.data && r.data.message) || fallback;
  }
  function renderGate(message, state) {
    O.clear(app);
    var msg = O.h('p', { class: 'form-msg', id: 'gate-msg', role: 'status', 'aria-live': 'polite', 'data-state': state || '' });
    if (message) msg.textContent = message;
    var input = O.h('input', {
      class: 'field', id: 'admin-token', type: 'password', name: 'token', autocomplete: 'off',
      maxlength: '200', required: true, 'aria-label': 'Admin token'
    });
    app.appendChild(O.h('form', { class: 'form panel', method: 'post', on: { submit: onGate } },
      O.h('div', { class: 'row' },
        O.h('label', { for: 'admin-token', text: 'Admin token' }),
        input
      ),
      O.h('div', { class: 'actions' },
        O.h('button', { class: 'btn btn-gold', type: 'submit', text: 'Open admin' })
      ),
      msg
    ));
    if (message) input.focus();
  }
  function onGate(e) {
    e.preventDefault();
    var input = document.getElementById('admin-token');
    var msg = document.getElementById('gate-msg');
    var value = input ? String(input.value || '').replace(/^\s+|\s+$/g, '') : '';
    if (!value) {
      if (input) { input.setAttribute('aria-invalid', 'true'); input.focus(); }
      if (msg) O.setMsg(msg, 'error', 'Enter the admin token.');
      return;
    }
    if (input) { input.removeAttribute('aria-invalid'); input.value = ''; }
    if (!writeToken(value)) {
      if (msg) O.setMsg(msg, 'error', 'This browser blocked session storage, so the admin token cannot be saved.');
      return;
    }
    boot();
  }
  function renderBlocked(text) {
    O.clear(app);
    app.appendChild(O.h('div', { class: 'adm-card' },
      O.h('p', { class: 'form-msg', role: 'status', 'data-state': 'error', text: text }),
      O.h('div', { class: 'adm-actions' },
        O.h('button', { class: 'btn btn-sm btn-gold', type: 'button', text: 'Try again', on: { click: boot } }),
        O.h('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: 'Log out of admin', on: { click: logout } })
      )
    ));
  }
  function deny() {
    view++;
    writeToken('');
    flash = '';
    active = 'artists-pending';
    renderGate('That token is not valid', 'error');
  }
  function logout() {
    view++;
    writeToken('');
    flash = '';
    active = 'artists-pending';
    renderGate('', '');
  }
  function boot() {
    var seen = ++view;
    if (!readToken()) { renderGate('', ''); return; }
    O.clear(app);
    app.appendChild(O.h('p', { class: 'meta', role: 'status', text: 'Checking access...' }));
    adminFetch('GET', '/api/admin/artists?status=pending').then(function (r) {
      if (seen !== view) return;
      if (r.status === 401) { deny(); return; }
      if (!r.ok) { renderBlocked(serverMessage(r, 'Something went wrong. Please try again.')); return; }
      renderShell();
      if (active === 'artists-pending') paint('artists', (r.data && r.data.artists) || []);
      else loadTab();
    });
  }
  function renderShell() {
    var tab = currentTab();
    O.clear(app);
    var tabs = O.h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Approval queues', on: { keydown: onTabKey } });
    TABS.forEach(function (t) {
      var selected = t.id === active;
      tabs.appendChild(O.h('button', {
        class: 'tab', type: 'button', role: 'tab', id: 'tab-' + t.id,
        'aria-selected': selected ? 'true' : 'false',
        'aria-controls': 'adm-panel',
        tabindex: selected ? '0' : '-1',
        on: { click: function () { selectTab(t.id); } }
      }, t.label));
    });
    var status = O.h('p', { class: 'form-msg', id: 'adm-status', role: 'status', 'aria-live': 'polite' });
    var list = O.h('ul', { class: 'list', id: 'adm-list' });
    app.appendChild(O.h('div', { class: 'adm-actions' },
      O.h('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: 'Log out of admin', on: { click: logout } })
    ));
    app.appendChild(tabs);
    app.appendChild(O.h('div', {
      class: 'tabpanel', role: 'tabpanel', id: 'adm-panel', 'aria-labelledby': 'tab-' + tab.id
    }, status, list));
  }
  function onTabKey(e) {
    var dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    var idx = 0;
    for (var i = 0; i < TABS.length; i++) if (TABS[i].id === active) idx = i;
    var next = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (idx + dir + TABS.length) % TABS.length;
    selectTab(TABS[next].id);
  }
  function selectTab(id) {
    if (id === active) return;
    active = id;
    flash = '';
    view++;
    renderShell();
    var btn = document.getElementById('tab-' + id);
    if (btn) btn.focus();
    loadTab();
  }
  function loadTab() {
    var seen = view;
    var seq = ++fetchSeq;
    var tab = currentTab();
    var list = document.getElementById('adm-list');
    var status = document.getElementById('adm-status');
    if (!list) return;
    O.clear(list);
    list.appendChild(O.h('li', {}, O.h('p', { class: 'meta', text: 'Loading...' })));
    var path = tab.kind === 'artists'
      ? '/api/admin/artists?status=' + tab.filter
      : '/api/admin/products?approval=' + tab.filter;
    adminFetch('GET', path).then(function (r) {
      if (seen !== view || seq !== fetchSeq) return;
      if (r.status === 401) { deny(); return; }
      if (!r.ok) {
        flash = '';
        O.clear(list);
        if (status) O.setMsg(status, 'error', serverMessage(r, 'Something went wrong. Please try again.'));
        return;
      }
      var items = tab.kind === 'artists' ? (r.data.artists || []) : (r.data.products || []);
      paint(tab.kind, items);
    });
  }
  function paint(kind, items) {
    var list = document.getElementById('adm-list');
    var status = document.getElementById('adm-status');
    if (!list) return;
    if (status) {
      if (flash) O.setMsg(status, 'ok', flash);
      else if (!status.textContent) O.setMsg(status, '', '');
    }
    flash = '';
    O.clear(list);
    if (!items || !items.length) {
      list.appendChild(O.h('li', {}, O.h('p', { class: 'meta', text: 'Nothing waiting.' })));
      return;
    }
    for (var i = 0; i < items.length; i++) list.appendChild(kind === 'artists' ? artistCard(items[i]) : productCard(items[i]));
  }
  function doneText(kind, action) {
    var noun = kind === 'artists' ? 'Artist' : 'Listing';
    if (action === 'approve') return noun + ' approved.';
    if (action === 'reject') return noun + ' rejected.';
    if (action === 'suspend') return 'Artist suspended.';
    return noun + ' set back to pending.';
  }
  function runAction(kind, id, action, needsNote, noteEl, msgEl, btns) {
    var note = String(noteEl.value || '').replace(/^\s+|\s+$/g, '');
    if (needsNote && !note) {
      noteEl.setAttribute('aria-invalid', 'true');
      O.setMsg(msgEl, 'error', action === 'suspend' ? 'Add a note before you suspend.' : 'Add a note before you reject.');
      noteEl.focus();
      return;
    }
    var sid = safeId(id);
    if (!sid) { O.setMsg(msgEl, 'error', 'That record cannot be updated.'); return; }
    noteEl.removeAttribute('aria-invalid');
    var seen = view;
    for (var i = 0; i < btns.length; i++) btns[i].disabled = true;
    O.setMsg(msgEl, '', 'Saving...');
    var path = (kind === 'artists' ? '/api/admin/artists/' : '/api/admin/products/') + sid;
    adminFetch('POST', path, { action: action, note: note }).then(function (r) {
      if (seen !== view) return;
      if (r.status === 401) { deny(); return; }
      if (!r.ok) {
        for (var j = 0; j < btns.length; j++) btns[j].disabled = false;
        O.setMsg(msgEl, 'error', serverMessage(r, 'Something went wrong. Please try again.'));
        return;
      }
      flash = doneText(kind, action);
      loadTab();
    });
  }
  function actionRow(kind, id, specs) {
    var note = O.h('input', {
      class: 'field', type: 'text', maxlength: '300', autocomplete: 'off', 'aria-label': 'Note for the artist'
    });
    var msg = O.h('p', { class: 'form-msg', role: 'status' });
    var btns = [];
    var kids = [note];
    specs.forEach(function (spec) {
      var btn = O.h('button', {
        class: spec.cls, type: 'button', text: spec.label,
        on: { click: function () { runAction(kind, id, spec.action, !!spec.needsNote, note, msg, btns); } }
      });
      btns.push(btn);
      kids.push(btn);
    });
    return [O.h('div', { class: 'adm-actions' }, kids), msg];
  }

  /* Link label and URL stay plain text. They are not anchors. */
  function linkLines(links) {
    var nodes = [];
    if (!links || !links.length) return nodes;
    for (var i = 0; i < links.length; i++) {
      var item = links[i] || {};
      var label = item.label ? String(item.label) : '';
      var url = item.url ? String(item.url) : '';
      var line = label && url ? (label + ' ' + url) : (label || url);
      if (line) nodes.push(O.h('p', { class: 'mono', text: line }));
    }
    return nodes;
  }
  function artistCard(a) {
    var src = safeSrc(a.avatar_url);
    var meta = joinParts([a.category ? O.titleCase(a.category) : '', a.location || '', tagText(a.tags)]);
    var when = joinParts([productCount(a.product_count), fmtDate(a.created_at)]);
    return O.h('li', { class: 'adm-card' },
      src ? O.h('img', { class: 'avatar', src: src, alt: a.name ? String(a.name) : 'Artist' }) : null,
      O.h('h3', { text: a.name || 'Untitled artist' }),
      a.handle ? O.h('p', { class: 'meta', text: '@' + a.handle }) : null,
      a.email ? O.h('p', { class: 'mono', text: String(a.email) }) : null,
      meta ? O.h('p', { class: 'meta', text: meta }) : null,
      when ? O.h('p', { class: 'meta', text: when }) : null,
      O.h('p', {}, badge(a.status, 'Status')),
      a.bio ? O.h('p', { class: 'body', text: String(a.bio) }) : null,
      linkLines(a.links),
      a.status_note ? O.h('p', { class: 'meta', text: 'Earlier note: ' + a.status_note }) : null,
      actionRow('artists', a.id, [
        { action: 'approve', label: 'Approve', cls: BTN_OK },
        { action: 'reject', label: 'Reject', cls: BTN_NO, needsNote: true },
        { action: 'suspend', label: 'Suspend', cls: BTN_NO, needsNote: true },
        { action: 'reset', label: 'Reset to pending', cls: BTN_RESET }
      ])
    );
  }
  function imageList(p) {
    var items = [];
    var images = p.images || [];
    for (var i = 0; i < images.length; i++) {
      var src = safeSrc(images[i] && images[i].url);
      if (!src) continue;
      items.push(O.h('li', {}, O.h('img', { src: src, alt: p.title ? String(p.title) : 'Listing image' })));
    }
    return items.length ? O.h('ul', { class: 'images' }, items) : null;
  }
  function productCard(p) {
    var who = joinParts([p.artist_name || '', p.artist_handle ? '@' + p.artist_handle : '']);
    var stock = (p.stock == null ? 0 : p.stock) + ' in stock';
    var edition = p.edition_size ? ('Edition of ' + p.edition_size) : 'Open edition';
    var facts = joinParts([p.category ? O.titleCase(p.category) : '', tagText(p.tags), stock, edition, fmtDate(p.created_at)]);
    var href = publicHref(p.slug);
    return O.h('li', { class: 'adm-card' },
      imageList(p),
      O.h('h3', { text: p.title || 'Untitled listing' }),
      who ? O.h('p', { class: 'meta', text: who }) : null,
      O.h('p', { class: 'price', text: O.money(p.price_minor || 0, p.currency || 'INR') }),
      facts ? O.h('p', { class: 'meta', text: facts }) : null,
      O.h('p', { class: 'meta' },
        badge(p.artist_status, 'Artist status'), ' ',
        badge(p.status, 'Listing status'), ' ',
        badge(p.approval, 'Approval')
      ),
      p.description ? O.h('p', { class: 'body', text: String(p.description) }) : null,
      p.approval_note ? O.h('p', { class: 'meta', text: 'Earlier note: ' + p.approval_note }) : null,
      href ? O.h('p', {}, O.h('a', {
        href: href, target: '_blank', rel: 'noopener', text: 'Public page (only works once approved)'
      })) : null,
      actionRow('products', p.id, [
        { action: 'approve', label: 'Approve', cls: BTN_OK },
        { action: 'reject', label: 'Reject', cls: BTN_NO, needsNote: true },
        { action: 'reset', label: 'Reset to pending', cls: BTN_RESET }
      ])
    );
  }
  boot();
})();
