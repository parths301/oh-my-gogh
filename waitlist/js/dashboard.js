/* Artist dashboard. DOM is built with OMG.h and textContent only. */
(function () {
  'use strict';
  var O = window.OMG;
  var app = document.getElementById('app');
  if (!O || !app) return;

  var CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];
  var MAX_IMAGES = 6;
  var MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  var MAX_AVATAR_BYTES = 2 * 1024 * 1024;
  var TABS = ['listings', 'profile', 'account'];
  var ACCEPT = 'image/jpeg,image/png,image/webp';

  var artist = null;
  var products = null;
  var editing = null;
  var listingMode = 'list';
  var listingsLoading = false;
  var profileLoading = false;
  var profileReady = false;
  var imageBusy = false;
  var tabButtons = {};
  var tabPanels = {};

  function $(id) { return document.getElementById(id); }
  function say(id, state, text) { var el = $(id); if (el) O.setMsg(el, state, text); }
  function enable(btn) { if (btn && document.body.contains(btn)) btn.disabled = false; }

  function call(method, path, body) {
    return O.api(method, path, body).then(function (r) {
      if (r.status === 401) { window.location.href = '/login'; return null; }
      return r;
    });
  }

  function failText(r) { return (r && r.data && r.data.message) || 'Something went wrong. Please try again.'; }
  function val(fd, name) { var v = fd.get(name); return v == null ? '' : String(v).trim(); }
  function raw(fd, name) { var v = fd.get(name); return v == null ? '' : String(v); }
  function tagList(s) { return String(s || '').split(',').map(function (p) { return p.trim(); }).filter(Boolean); }
  function tagsText(list) { return list && list.join ? list.join(', ') : ''; }

  function intOrNull(s) {
    var t = String(s == null ? '' : s).trim();
    if (!t) return null;
    if (/^\d{1,9}$/.test(t)) return parseInt(t, 10);
    return t;
  }

  function lock(root, on) {
    if (!root) return;
    var nodes = root.querySelectorAll('button');
    var i;
    for (i = 0; i < nodes.length; i++) nodes[i].disabled = !!on;
  }

  function busy(form, on) {
    if (!form) return;
    if (on) form.setAttribute('data-busy', '1');
    else form.removeAttribute('data-busy');
    lock(form, on);
  }

  function badgeClass(status) {
    if (status === 'approved') return 'badge-ok';
    if (status === 'pending') return 'badge-pending';
    if (status === 'rejected' || status === 'suspended') return 'badge-bad';
    return 'badge-draft';
  }

  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/);
    var out = '';
    var i;
    for (i = 0; i < parts.length && out.length < 2; i++) if (parts[i]) out += parts[i].charAt(0).toUpperCase();
    return out || '?';
  }

  function allowedImage(file) {
    return !file.type || file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp';
  }

  function applyErrors(form, fields) {
    var data = fields || {};
    var stolen = [];
    var mine = {};
    var nodes = form.querySelectorAll('.err');
    var all, i, el, had;
    for (i = 0; i < nodes.length; i++) if (nodes[i].id) mine[nodes[i].id] = 1;
    all = document.querySelectorAll('.err');
    for (i = 0; i < all.length; i++) {
      el = all[i];
      if (el.id && mine[el.id] && !form.contains(el)) { stolen.push([el, el.id]); el.removeAttribute('id'); }
    }
    had = O.showFieldErrors(form, data);
    for (i = 0; i < stolen.length; i++) stolen[i][0].id = stolen[i][1];
    if (data.links) {
      nodes = form.querySelectorAll('[name^="link_"]');
      for (i = 0; i < nodes.length; i++) nodes[i].setAttribute('aria-invalid', 'true');
    }
    return had;
  }

  function report(form, msg, r) {
    var had = form ? applyErrors(form, (r && r.data && r.data.fields) || {}) : false;
    O.setMsg(msg, 'error', had ? 'Please fix the highlighted fields.' : failText(r));
    if (!had || !form) return;
    var first = form.querySelector('[aria-invalid="true"]');
    if (first && first.focus) first.focus();
  }

  function fieldRow(spec) {
    var attrs = { class: 'field', id: spec.id, name: spec.name };
    var extra = ['list', 'min', 'step', 'autocomplete', 'inputmode', 'maxlength', 'placeholder', 'rows', 'accept'];
    var i, control;
    for (i = 0; i < extra.length; i++) if (spec[extra[i]] != null && spec[extra[i]] !== '') attrs[extra[i]] = spec[extra[i]];
    if (spec.kind === 'textarea' && !attrs.rows) attrs.rows = '5';
    if (spec.value != null) attrs.value = spec.value;
    if (spec.readOnly) attrs.readOnly = true;
    if (spec.kind === 'textarea') control = O.h('textarea', attrs);
    else if (spec.kind === 'select') {
      control = O.h('select', { class: 'field', id: spec.id, name: spec.name }, (spec.options || []).map(function (opt) {
        return O.h('option', { value: opt[0], selected: String(opt[0]) === String(spec.value) }, opt[1]);
      }));
      if (spec.value != null) control.value = spec.value;
    } else {
      attrs.type = spec.type || 'text';
      control = O.h('input', attrs);
    }
    return O.h('div', { class: 'row' },
      O.h('label', { for: spec.id }, spec.label),
      spec.hint ? O.h('p', { class: 'hint' }, spec.hint) : null,
      control,
      spec.err === false ? null : O.h('p', { class: 'err', id: 'err-' + spec.name })
    );
  }

  function btn(cls, text, fn) {
    return O.h('button', { type: fn ? 'button' : 'submit', class: cls, on: fn ? { click: fn } : null }, text);
  }

  function status(id) { return O.h('p', { class: 'form-msg', id: id, role: 'status' }); }
  function two(a, b) { return O.h('div', { class: 'two' }, a, b); }
  function productUrl(id, tail) { return '/api/artist/products/' + encodeURIComponent(id) + (tail || ''); }

  function copyArtist(src) {
    var k, hello;
    if (!src) return;
    for (k in src) if (Object.prototype.hasOwnProperty.call(src, k)) artist[k] = src[k];
    hello = $('hello');
    if (hello) hello.textContent = 'Hello, ' + (artist.name || '');
  }

  function statusBox() {
    var s = artist.status;
    var note = artist.status_note || '';
    if (s === 'pending') return O.h('div', { class: 'statusbox banner' }, 'Your artist profile is waiting for approval. You can set up your profile and add listings now. Nothing is public until we approve it.');
    if (s === 'approved') return O.h('div', { class: 'statusbox banner' }, 'Your profile is live.');
    if (s === 'rejected') return O.h('div', { class: 'statusbox banner' }, note || 'Your artist profile was not approved.');
    if (s === 'suspended') {
      return O.h('div', { class: 'statusbox banner' },
        note ? note + ' ' : 'Your account is suspended. ',
        'Contact ', O.h('a', { href: 'mailto:hello@ohmygogh.com' }, 'hello@ohmygogh.com'), '.');
    }
    return O.h('div', { class: 'statusbox banner' }, O.titleCase(s || 'Unknown status'));
  }

  function logout(e) {
    e.currentTarget.disabled = true;
    call('POST', '/api/auth/logout').then(function () { window.location.href = '/login'; });
  }

  function onTabKey(e) {
    var i = TABS.indexOf(e.target && e.target.getAttribute && e.target.getAttribute('data-tab'));
    var n = i;
    if (i < 0) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i + TABS.length - 1) % TABS.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = TABS.length - 1;
    else return;
    e.preventDefault();
    selectTab(TABS[n]);
    tabButtons[TABS[n]].focus();
  }

  function selectTab(id) {
    var i, on;
    for (i = 0; i < TABS.length; i++) {
      on = TABS[i] === id;
      tabButtons[TABS[i]].setAttribute('aria-selected', on ? 'true' : 'false');
      tabButtons[TABS[i]].tabIndex = on ? 0 : -1;
      if (on) tabPanels[TABS[i]].removeAttribute('hidden');
      else tabPanels[TABS[i]].setAttribute('hidden', '');
    }
    if (id === 'listings' && products === null) loadListings();
    if (id === 'profile' && !profileReady) loadProfile();
  }

  function renderShell() {
    var tabs = O.h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Dashboard', on: { keydown: onTabKey } });
    O.clear(app);
    app.appendChild(O.h('div', { class: 'dash-top' },
      O.h('h1', { id: 'hello' }, 'Hello, ' + (artist.name || '')),
      O.h('div', { class: 'actions' },
        O.h('span', { class: 'badge ' + badgeClass(artist.status) }, O.titleCase(artist.status)),
        artist.status === 'approved' ? O.h('a', { href: '/artists/' + encodeURIComponent(artist.handle) }, 'View my public page') : null,
        btn('btn btn-ghost btn-sm', 'Log out', logout)
      )
    ));
    app.appendChild(statusBox());
    TABS.forEach(function (id, i) {
      var label = id.charAt(0).toUpperCase() + id.slice(1);
      tabButtons[id] = O.h('button', {
        type: 'button', class: 'tab', role: 'tab', id: 'tab-' + id, 'data-tab': id,
        'aria-controls': 'panel-' + id, 'aria-selected': i === 0 ? 'true' : 'false', tabindex: i === 0 ? '0' : '-1',
        on: { click: function () { selectTab(id); } }
      }, label);
      tabs.appendChild(tabButtons[id]);
      tabPanels[id] = O.h('div', {
        class: 'tabpanel', role: 'tabpanel', id: 'panel-' + id, 'aria-labelledby': 'tab-' + id, hidden: i !== 0
      });
    });
    app.appendChild(tabs);
    TABS.forEach(function (id) { app.appendChild(tabPanels[id]); });
    renderAccount();
  }

  function listingState(p) {
    if (p.status === 'draft') return { text: 'Draft', cls: 'badge-draft', note: p.approval === 'rejected' ? (p.approval_note || '') : '' };
    if (p.approval === 'rejected') return { text: 'Not approved', cls: 'badge-bad', note: p.approval_note || '' };
    if (p.approval === 'pending') return { text: 'Awaiting approval', cls: 'badge-pending', note: '' };
    if (p.approval === 'approved') {
      return artist.status === 'approved'
        ? { text: 'Live', cls: 'badge-ok', note: '' }
        : { text: 'Approved, live once your profile is approved', cls: 'badge-ok', note: '' };
    }
    return { text: O.titleCase(p.status || ''), cls: 'badge-draft', note: '' };
  }

  function showPanelError(panel, text, retry) {
    O.clear(panel);
    panel.appendChild(O.h('p', { class: 'form-msg', role: 'status', 'data-state': 'error' }, text));
    panel.appendChild(btn('btn btn-ghost btn-sm', 'Try again', retry));
  }

  function loadListings() {
    if (listingsLoading) return;
    listingsLoading = true;
    O.clear(tabPanels.listings);
    tabPanels.listings.appendChild(O.h('p', {}, 'Loading your listings...'));
    call('GET', '/api/artist/products').then(function (r) {
      listingsLoading = false;
      if (!r) return;
      if (!r.ok) { products = null; showPanelError(tabPanels.listings, failText(r), loadListings); return; }
      products = r.data.products || [];
      renderListings();
    });
  }

  function renderListings() {
    var msg = status('list-msg');
    var ul;
    listingMode = 'list';
    editing = null;
    O.clear(tabPanels.listings);
    tabPanels.listings.appendChild(O.h('div', { class: 'dash-top' },
      O.h('h2', {}, 'Listings'),
      btn('btn btn-gold', 'New listing', function () { openEditor(null); })
    ));
    tabPanels.listings.appendChild(msg);
    if (!products.length) {
      tabPanels.listings.appendChild(O.h('div', { class: 'empty' }, O.h('p', {}, 'No listings yet.')));
      return;
    }
    ul = O.h('ul', { class: 'list' });
    products.forEach(function (p) { ul.appendChild(listingItem(p, msg)); });
    tabPanels.listings.appendChild(ul);
  }

  function listingItem(p, msg) {
    var st = listingState(p);
    var img = p.images && p.images[0];
    return O.h('li', { class: 'item' },
      O.h('div', { class: 'thumb' }, img && img.url ? O.h('img', { src: img.url, alt: '' }) : null),
      O.h('div', {},
        O.h('h3', {}, p.title || 'Untitled'),
        O.h('p', { class: 'meta' },
          O.h('span', {}, O.money(p.price_minor, p.currency)),
          p.category ? O.h('span', {}, O.titleCase(p.category)) : null,
          O.h('span', {}, 'Stock: ' + p.stock),
          O.h('span', { class: 'badge ' + st.cls }, st.text)
        ),
        st.note ? O.h('p', { class: 'hint' }, st.note) : null
      ),
      O.h('div', { class: 'item-actions' },
        btn('btn btn-sm', 'Edit', function () { openEditor(p); }),
        O.h('a', { class: 'btn btn-ghost btn-sm', href: '/p/' + encodeURIComponent(p.slug), target: '_blank', rel: 'noopener' }, 'Preview'),
        btn('btn btn-danger btn-sm', 'Delete', function (e) { removeListing(p, e.currentTarget, msg); })
      )
    );
  }

  function removeListing(p, button, msg) {
    if (!window.confirm('Delete "' + (p.title || 'this listing') + '"? This cannot be undone.')) return;
    button.disabled = true;
    call('DELETE', productUrl(p.id)).then(function (r) {
      if (!r) return;
      if (!r.ok) { enable(button); O.setMsg(msg, 'error', failText(r)); return; }
      products = (products || []).filter(function (item) { return item.id !== p.id; });
      renderListings();
      say('list-msg', 'ok', 'Listing deleted.');
    });
  }

  function openEditor(product) { editing = product; listingMode = 'edit'; renderEditor(''); }
  function showList() { if (!products) loadListings(); else renderListings(); }

  function replaceProduct(p) {
    var i, found = false;
    products = products || [];
    for (i = 0; i < products.length; i++) if (products[i].id === p.id) { products[i] = p; found = true; break; }
    if (!found) products.unshift(p);
    editing = p;
  }

  function liveProduct(product) {
    var i, id = product && product.id;
    if (!id) return product;
    if (editing && editing.id === id) return editing;
    if (products) for (i = 0; i < products.length; i++) if (products[i].id === id) return products[i];
    return product;
  }

  function listingBody(fd) {
    return {
      title: val(fd, 'title'), description: val(fd, 'description'), category: val(fd, 'category'),
      tags: tagList(val(fd, 'tags')), price: val(fd, 'price'), currency: val(fd, 'currency'),
      stock: intOrNull(val(fd, 'stock')), edition_size: intOrNull(val(fd, 'edition_size')), status: val(fd, 'status')
    };
  }

  function renderEditor(flash) {
    var product = editing;
    var codes = CURRENCIES.slice();
    var msg = status('listing-msg');
    var title;
    if (product && product.currency && codes.indexOf(product.currency) < 0) codes.push(product.currency);
    listingMode = 'edit';
    O.clear(tabPanels.listings);
    tabPanels.listings.appendChild(O.h('form', { class: 'form panel', novalidate: true, autocomplete: 'off', on: { submit: saveListing } },
      O.h('div', { class: 'actions' }, btn('btn btn-ghost btn-sm', 'Back', showList)),
      O.h('h2', {}, product ? 'Edit listing' : 'New listing'),
      product && product.approval === 'approved' ? O.h('p', { class: 'banner', id: 'review-note' }, 'Editing the title, description, category, tags or images of an approved listing sends it back for review.') : null,
      product && product.approval === 'rejected' && product.approval_note ? O.h('p', { class: 'banner' }, 'Not approved. ' + product.approval_note) : null,
      fieldRow({ id: 'lst-title', name: 'title', label: 'Title', maxlength: 120, value: product ? product.title : '' }),
      fieldRow({ id: 'lst-description', name: 'description', label: 'Description', kind: 'textarea', maxlength: 4000, value: product ? product.description : '' }),
      fieldRow({ id: 'lst-category', name: 'category', label: 'Category', list: 'cat-list', maxlength: 40, value: product ? product.category : '' }),
      fieldRow({ id: 'lst-tags', name: 'tags', label: 'Tags', maxlength: 400, hint: 'Comma separated, up to 10.', value: tagsText(product && product.tags) }),
      two(
        fieldRow({ id: 'lst-price', name: 'price', label: 'Price', inputmode: 'decimal', hint: 'For example 1200 or 49.50.', value: product ? (Number(product.price_minor) / 100).toFixed(2) : '' }),
        fieldRow({ id: 'lst-currency', name: 'currency', label: 'Currency', kind: 'select', value: product ? product.currency : 'INR', options: codes.map(function (c) { return [c, c]; }) })
      ),
      two(
        fieldRow({ id: 'lst-stock', name: 'stock', label: 'Stock', type: 'number', min: 0, step: 1, inputmode: 'numeric', value: product ? product.stock : 1 }),
        fieldRow({ id: 'lst-edition_size', name: 'edition_size', label: 'Edition size', type: 'number', min: 1, step: 1, inputmode: 'numeric', hint: 'Leave empty for an open edition.', value: product && product.edition_size != null ? product.edition_size : '' })
      ),
      fieldRow({ id: 'lst-status', name: 'status', label: 'Status', kind: 'select', hint: 'Published listings still need our approval before they show.', value: product ? product.status : 'draft', options: [['draft', 'Draft'], ['published', 'Published']] }),
      O.h('div', { class: 'actions' }, btn('btn btn-gold', product ? 'Save listing' : 'Create listing')),
      msg
    ));
    if (product && product.id) tabPanels.listings.appendChild(imagesPanel(product));
    if (flash) O.setMsg(msg, 'ok', flash);
    title = $('lst-title');
    if (title && !flash) title.focus();
  }

  function saveListing(e) {
    var form = e.target;
    var existing = editing;
    var msg = $('listing-msg');
    e.preventDefault();
    if (form.getAttribute('data-busy')) return;
    busy(form, true);
    O.setMsg(msg, '', existing ? 'Saving...' : 'Creating your listing...');
    call(existing ? 'PUT' : 'POST', existing ? productUrl(existing.id) : '/api/artist/products', listingBody(new FormData(form))).then(function (r) {
      var back;
      if (!r) return;
      if (!(r.ok && r.data.product)) { busy(form, false); report(form, msg, r); return; }
      back = existing && existing.approval === 'approved' && r.data.product.approval === 'pending';
      replaceProduct(r.data.product);
      renderEditor(back ? 'Listing saved. It is back in the review queue.' : (existing ? 'Listing saved.' : 'Listing created. You can add images below.'));
    });
  }

  function sameEditor(product) {
    var box = $('images-box');
    return !!(box && product && box.getAttribute('data-id') === String(product.id));
  }

  function wentBackToReview(product) {
    var note;
    if (!product || product.approval === 'pending') return false;
    product.approval = 'pending';
    product.approval_note = '';
    note = $('review-note');
    if (note && note.parentNode) note.parentNode.removeChild(note);
    return true;
  }

  function imageList(product) {
    var ul = O.h('ul', { class: 'images', id: 'image-list' }, (product.images || []).map(function (img, i) {
      return O.h('li', {},
        O.h('img', { src: img.url, alt: 'Image ' + (i + 1) + ' of ' + (product.title || 'listing') }),
        btn('btn btn-ghost btn-sm', 'Make cover', function (e) { mutateImage(product, img, 'POST', { action: 'cover' }, e.currentTarget, 'Cover updated.'); }),
        btn('btn btn-danger btn-sm', 'Remove', function (e) { mutateImage(product, img, 'DELETE', undefined, e.currentTarget, 'Image removed.'); })
      );
    }));
    if (imageBusy) lock(ul, true);
    return ul;
  }

  function setImages(product, images) {
    var old = $('image-list');
    product.images = images || [];
    if (!old || !old.parentNode || !sameEditor(product)) return;
    old.parentNode.replaceChild(imageList(product), old);
  }

  function mutateImage(product, img, method, body, button, okText) {
    var path = productUrl(product.id, '/images/' + encodeURIComponent(img.id));
    button.disabled = true;
    call(method, path, body).then(function (r) {
      var current = liveProduct(product);
      if (!r) return;
      if (!r.ok) { enable(button); say('images-msg', 'error', failText(r)); return; }
      current.images = r.data.images || [];
      if (sameEditor(current)) { setImages(current, current.images); say('images-msg', 'ok', okText); }
      else if (listingMode === 'list') renderListings();
    });
  }

  function imagesPanel(product) {
    var input = O.h('input', {
      class: 'field', type: 'file', id: 'image-files', accept: ACCEPT, multiple: true,
      on: { change: function () { pickImages(product, input); } }
    });
    return O.h('div', { class: 'panel', id: 'images-box', 'data-id': product.id },
      O.h('h2', {}, 'Images'),
      O.h('p', { class: 'hint' }, 'JPEG, PNG or WebP. Up to 6 images, 5 MB each. The first image is the cover.'),
      imageList(product),
      O.h('div', { class: 'row' }, O.h('label', { for: 'image-files' }, 'Add images'), input, status('images-msg'))
    );
  }

  function finishImages(product, input, errText, flipped) {
    var current = liveProduct(product);
    var tail = flipped ? ' This listing is back in the review queue.' : '';
    imageBusy = false;
    if (input && document.body.contains(input)) input.disabled = false;
    if (!sameEditor(current)) { if (listingMode === 'list') renderListings(); return; }
    setImages(current, current.images);
    if (errText) say('images-msg', 'error', errText + tail);
    else say('images-msg', 'ok', 'Images updated.' + tail);
  }

  function pickImages(product, input) {
    var files, queue, notes, have, i, f, n, flipped;
    if (imageBusy) return;
    files = Array.prototype.slice.call(input.files || []);
    input.value = '';
    if (!files.length) return;
    queue = [];
    notes = [];
    have = (liveProduct(product).images || []).length;
    for (i = 0; i < files.length; i++) {
      f = files[i];
      if (!allowedImage(f)) notes.push((f.name || 'That file') + ' must be a JPEG, PNG or WebP.');
      else if (f.size > MAX_IMAGE_BYTES) notes.push((f.name || 'That file') + ' is larger than 5 MB.');
      else if (have + queue.length >= MAX_IMAGES) { notes.push('A listing can have up to 6 images.'); break; }
      else queue.push(f);
    }
    if (!queue.length) { say('images-msg', 'error', notes.join(' ')); return; }
    imageBusy = true;
    input.disabled = true;
    lock($('image-list'), true);
    n = 0;
    flipped = false;
    (function next() {
      var fd;
      if (n >= queue.length) { finishImages(product, input, notes.join(' '), flipped); return; }
      say('images-msg', '', 'Uploading ' + (n + 1) + ' of ' + queue.length + '...');
      fd = new FormData();
      fd.append('file', queue[n]);
      call('POST', productUrl(product.id, '/images'), fd).then(function (r) {
        var current = liveProduct(product);
        if (!r) { imageBusy = false; return; }
        if (!r.ok) { finishImages(current, input, failText(r), flipped); return; }
        current.images = r.data.images || current.images;
        if (wentBackToReview(current)) flipped = true;
        n += 1;
        next();
      });
    })();
  }

  function loadProfile() {
    if (profileLoading || profileReady) return;
    profileLoading = true;
    O.clear(tabPanels.profile);
    tabPanels.profile.appendChild(O.h('p', {}, 'Loading your profile...'));
    call('GET', '/api/artist/profile').then(function (r) {
      profileLoading = false;
      if (!r) return;
      if (!r.ok || !r.data.artist) { showPanelError(tabPanels.profile, failText(r), loadProfile); return; }
      copyArtist(r.data.artist);
      profileReady = true;
      renderProfile();
    });
  }

  function avatarNode() {
    if (artist.avatar_url) return O.h('img', { class: 'avatar', id: 'avatar-img', src: artist.avatar_url, alt: (artist.name || 'Artist') + ' profile photo' });
    return O.h('div', { class: 'avatar ph-round', id: 'avatar-img', 'aria-hidden': 'true' }, initials(artist.name));
  }

  function syncAvatar(url) {
    var el = $('avatar-img');
    var rm = $('avatar-remove');
    artist.avatar_url = url || null;
    if (el && el.parentNode) el.parentNode.replaceChild(avatarNode(), el);
    if (!rm) return;
    if (artist.avatar_url) rm.removeAttribute('hidden');
    else rm.setAttribute('hidden', '');
  }

  function onAvatarFile(input) {
    var file = input.files && input.files[0];
    var fd, rm;
    input.value = '';
    if (!file) return;
    if (!allowedImage(file)) { say('avatar-msg', 'error', 'Only JPEG, PNG or WebP images are accepted.'); return; }
    if (file.size > MAX_AVATAR_BYTES) { say('avatar-msg', 'error', 'Image is too large. The limit is 2 MB.'); return; }
    fd = new FormData();
    fd.append('file', file);
    input.disabled = true;
    rm = $('avatar-remove');
    if (rm) rm.disabled = true;
    say('avatar-msg', '', 'Uploading your photo...');
    call('POST', '/api/artist/avatar', fd).then(function (r) {
      if (document.body.contains(input)) input.disabled = false;
      enable(rm);
      if (!r) return;
      if (!r.ok) { say('avatar-msg', 'error', failText(r)); return; }
      syncAvatar(r.data.avatar_url);
      say('avatar-msg', 'ok', 'Profile photo updated.');
    });
  }

  function onAvatarRemove(button) {
    var input = $('avatar-file');
    button.disabled = true;
    if (input) input.disabled = true;
    call('DELETE', '/api/artist/avatar').then(function (r) {
      enable(button);
      if (input && document.body.contains(input)) input.disabled = false;
      if (!r) return;
      if (!r.ok) { say('avatar-msg', 'error', failText(r)); return; }
      syncAvatar(null);
      say('avatar-msg', 'ok', 'Profile photo removed.');
    });
  }

  function avatarBlock() {
    var input = O.h('input', { class: 'field', type: 'file', id: 'avatar-file', accept: ACCEPT, on: { change: function () { onAvatarFile(input); } } });
    return O.h('div', { class: 'avatar-row' },
      avatarNode(),
      O.h('div', { class: 'row' },
        O.h('label', { for: 'avatar-file' }, 'Profile photo'),
        O.h('p', { class: 'hint' }, 'JPEG, PNG or WebP, up to 2 MB.'),
        input,
        O.h('div', { class: 'actions' }, O.h('button', { type: 'button', id: 'avatar-remove', class: 'btn btn-danger btn-sm', hidden: !artist.avatar_url, on: { click: function (e) { onAvatarRemove(e.currentTarget); } } }, 'Remove')),
        status('avatar-msg')
      )
    );
  }

  function linksEditor() {
    var rows = [];
    var links = artist.links;
    var i, item;
    for (i = 0; i < 5; i++) {
      item = links && typeof links === 'object' ? links[i] : null;
      if (!item || typeof item !== 'object') item = { label: '', url: '' };
      rows.push(O.h('div', { class: 'linkrow' },
        O.h('input', { class: 'field', name: 'link_label_' + i, value: item.label || '', maxlength: '30', placeholder: 'Label', 'aria-label': 'Link ' + (i + 1) + ' label' }),
        O.h('input', { class: 'field', name: 'link_url_' + i, value: item.url || '', maxlength: '300', inputmode: 'url', placeholder: 'https://', autocomplete: 'url', 'aria-label': 'Link ' + (i + 1) + ' URL' })
      ));
    }
    return O.h('div', { class: 'row' },
      O.h('p', { class: 'lbl' }, 'Links'),
      O.h('p', { class: 'hint' }, 'Up to 5. Leave a row empty to skip it.'),
      rows,
      O.h('p', { class: 'err', id: 'err-links' })
    );
  }

  function collectLinks(fd) {
    var out = [];
    var i, label, url;
    for (i = 0; i < 5; i++) {
      label = val(fd, 'link_label_' + i);
      url = val(fd, 'link_url_' + i);
      if (label || url) out.push({ label: label, url: url });
    }
    return out;
  }

  function renderProfile() {
    var msg = status('profile-msg');
    O.clear(tabPanels.profile);
    tabPanels.profile.appendChild(O.h('div', { class: 'panel' },
      avatarBlock(),
      O.h('form', { class: 'form', novalidate: true, autocomplete: 'on', on: { submit: saveProfile } },
        fieldRow({ id: 'pro-name', name: 'name', label: 'Name', maxlength: 60, autocomplete: 'name', value: artist.name || '' }),
        fieldRow({ id: 'pro-handle', name: 'handle', label: 'Handle', readOnly: true, hint: 'cannot be changed', value: artist.handle || '' }),
        fieldRow({ id: 'pro-bio', name: 'bio', label: 'Bio', kind: 'textarea', maxlength: 1200, value: artist.bio || '' }),
        two(
          fieldRow({ id: 'pro-location', name: 'location', label: 'Location', maxlength: 80, value: artist.location || '' }),
          fieldRow({ id: 'pro-category', name: 'category', label: 'Category', list: 'cat-list', maxlength: 40, value: artist.category || '' })
        ),
        fieldRow({ id: 'pro-tags', name: 'tags', label: 'Tags', maxlength: 400, hint: 'Comma separated, up to 10.', value: tagsText(artist.tags) }),
        linksEditor(),
        O.h('div', { class: 'actions' }, btn('btn btn-gold', 'Save')),
        msg
      )
    ));
  }

  function saveProfile(e) {
    var form = e.target;
    var msg = $('profile-msg');
    var fd, img;
    e.preventDefault();
    if (form.getAttribute('data-busy')) return;
    busy(form, true);
    O.setMsg(msg, '', 'Saving...');
    fd = new FormData(form);
    call('PUT', '/api/artist/profile', {
      name: val(fd, 'name'), bio: val(fd, 'bio'), location: val(fd, 'location'),
      category: val(fd, 'category'), tags: tagList(val(fd, 'tags')), links: collectLinks(fd)
    }).then(function (r) {
      if (!r) return;
      busy(form, false);
      if (!r.ok) { report(form, msg, r); return; }
      copyArtist(r.data.artist);
      img = $('avatar-img');
      if (img && img.tagName === 'IMG') img.alt = (artist.name || 'Artist') + ' profile photo';
      else syncAvatar(null);
      O.setMsg(msg, 'ok', 'Profile saved.');
    });
  }

  function renderAccount() {
    O.clear(tabPanels.account);
    tabPanels.account.appendChild(O.h('div', { class: 'panel' },
      fieldRow({ id: 'acc-email', name: 'email', label: 'Email', readOnly: true, autocomplete: 'email', hint: 'Email verification is coming soon.', value: artist.email || '', err: false }),
      O.h('form', { class: 'form', novalidate: true, autocomplete: 'on', on: { submit: savePassword } },
        O.h('h2', {}, 'Change password'),
        fieldRow({ id: 'acc-current_password', name: 'current_password', label: 'Current password', type: 'password', autocomplete: 'current-password', maxlength: 200 }),
        fieldRow({ id: 'acc-new_password', name: 'new_password', label: 'New password', type: 'password', autocomplete: 'new-password', maxlength: 128, hint: 'At least 10 characters.' }),
        O.h('div', { class: 'actions' }, btn('btn', 'Change password')),
        status('password-msg')
      ),
      O.h('form', { class: 'form', novalidate: true, autocomplete: 'on', on: { submit: deleteAccount } },
        O.h('h2', {}, 'Delete account'),
        O.h('p', { class: 'hint' }, 'This permanently deletes your profile, listings and images.'),
        fieldRow({ id: 'acc-password', name: 'password', label: 'Password', type: 'password', autocomplete: 'current-password', maxlength: 200 }),
        O.h('div', { class: 'actions' }, btn('btn btn-danger', 'Delete my account and all my listings')),
        status('delete-msg')
      )
    ));
  }

  function savePassword(e) {
    var form = e.target;
    var msg = $('password-msg');
    var fd;
    e.preventDefault();
    if (form.getAttribute('data-busy')) return;
    busy(form, true);
    O.setMsg(msg, '', 'Updating your password...');
    fd = new FormData(form);
    call('POST', '/api/auth/password', { current_password: raw(fd, 'current_password'), new_password: raw(fd, 'new_password') }).then(function (r) {
      if (!r) return;
      busy(form, false);
      if (!r.ok) { report(form, msg, r); return; }
      form.reset();
      O.setMsg(msg, 'ok', 'Password updated.');
    });
  }

  function deleteAccount(e) {
    var form = e.target;
    var msg = $('delete-msg');
    var password;
    e.preventDefault();
    if (form.getAttribute('data-busy')) return;
    password = raw(new FormData(form), 'password');
    if (!window.confirm('Delete your account and all your listings? This cannot be undone.')) return;
    busy(form, true);
    O.setMsg(msg, '', 'Deleting your account...');
    call('DELETE', '/api/artist/account', { password: password }).then(function (r) {
      if (!r) return;
      if (!r.ok) { busy(form, false); report(form, msg, r); return; }
      window.location.href = '/';
    });
  }

  O.api('GET', '/api/auth/me').then(function (r) {
    if (r.status === 401 || (r.ok && (!r.data || !r.data.artist))) { window.location.href = '/login'; return; }
    if (!r.ok || !r.data || !r.data.artist) {
      O.clear(app);
      app.appendChild(O.h('p', { class: 'form-msg', role: 'status', 'data-state': 'error' }, failText(r)));
      return;
    }
    O.state.csrf = r.data.csrf || null;
    artist = r.data.artist;
    renderShell();
    selectTab('listings');
  });
})();
