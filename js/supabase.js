/* ============================================================
   Oh my Gogh! — Supabase integration layer
   Fetches public config from /api/config, lazy-loads supabase-js,
   and maps DB rows into the shape the storefront/admin UI expects.

   Storefront/admin call OMG.remote.loadStore(); if Supabase isn't
   configured (e.g. local static preview), it returns null and the
   app falls back to the bundled demo data in data.js.
   ============================================================ */
(function (global) {
  'use strict';

  var SDK_URL = 'https://esm.sh/@supabase/supabase-js@2';
  var _client = null;
  var _config = null;
  var _ready = null;

  function getConfig() {
    if (_config) return Promise.resolve(_config);
    return fetch('/api/config', { headers: { accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (c) { _config = c || { configured: false }; return _config; })
      .catch(function () { _config = { configured: false }; return _config; });
  }

  function getClient() {
    if (_ready) return _ready;
    _ready = getConfig().then(function (cfg) {
      if (!cfg || !cfg.configured) return null;
      return import(SDK_URL).then(function (mod) {
        _client = mod.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth: { persistSession: true, autoRefreshToken: true }
        });
        return _client;
      });
    }).catch(function () { return null; });
    return _ready;
  }

  // ---- row mappers: DB (snake_case) -> UI (camelCase) ----------------
  function mapProduct(r) {
    return { id: r.id, name: r.name, cat: r.cat, price: r.price, inventory: r.inventory,
      status: r.status, tint: r.tint, medium: r.medium, artist: r.artist,
      sizes: r.sizes || ['One'], sold: r.sold, blurb: r.blurb, image_url: r.image_url };
  }
  function mapArtist(r) {
    return { id: r.id, name: r.name, medium: r.medium, location: r.location, tint: r.tint,
      quote: r.quote, bioText: r.bio_text, instagram: r.instagram, portfolio: r.portfolio,
      featured: r.featured, status: r.status, image_url: r.image_url };
  }
  function mapPost(r) {
    return { id: r.id, title: r.title, cat: r.cat, read_time: r.read_time, author: r.author,
      date: r.date, excerpt: r.excerpt, bodyText: r.body_text, status: r.status,
      tint: r.tint, image_url: r.image_url };
  }
  function mapCollection(r) {
    return { id: r.id, name: r.name, desc: r.description, productIds: r.product_ids || [], status: r.status };
  }
  function mapDiscount(r) {
    return { id: r.id, code: r.code, type: r.type, value: r.value, limit: r.limit, used: r.used, expires: r.expires, active: r.active };
  }
  function mapCustomer(r) {
    return { id: r.id, name: r.name, email: r.email, location: r.location, since: r.since,
      ltv: r.ltv, orderCount: r.order_count, avg: r.avg, status: r.status, note: r.note };
  }

  // ---- row un-mappers: UI (camelCase) -> DB (snake_case), for writes -----
  function unmapProduct(p) {
    return { id: p.id, name: p.name, cat: p.cat, price: Number(p.price) || 0, inventory: Number(p.inventory) || 0,
      status: p.status, tint: p.tint, medium: p.medium, artist: p.artist,
      sizes: (p.sizes && p.sizes.length) ? p.sizes : ['One'], sold: Number(p.sold) || 0,
      blurb: p.blurb || '', image_url: p.image_url || null };
  }
  function unmapArtist(a) {
    return { id: a.id, name: a.name, medium: a.medium || '', location: a.location || '', tint: a.tint,
      quote: a.quote || '', bio_text: a.bioText || '', instagram: a.instagram || '', portfolio: a.portfolio || '',
      featured: !!a.featured, status: a.status || 'active', image_url: a.image_url || null };
  }
  function unmapPost(p) {
    return { id: p.id, title: p.title, cat: p.cat, read_time: p.read_time || '', author: p.author || 'Atelier OMG',
      date: p.date || '', excerpt: p.excerpt || '', body_text: p.bodyText || '', status: p.status,
      tint: p.tint, image_url: p.image_url || null };
  }
  function unmapCollection(c) {
    return { id: c.id, name: c.name, description: c.desc || '', product_ids: c.productIds || [], status: c.status };
  }
  function unmapDiscount(d) {
    return { id: d.id, code: d.code, type: d.type, value: Number(d.value) || 0, limit: Number(d.limit) || 0,
      used: Number(d.used) || 0, expires: d.expires || '', active: !!d.active };
  }

  // ---- auth ---------------------------------------------------------
  function signIn(email, password) {
    return getClient().then(function (client) {
      if (!client) return { error: { message: 'Supabase is not configured — check /api/config.' } };
      return client.auth.signInWithPassword({ email: email, password: password });
    });
  }
  function signOut() {
    return getClient().then(function (client) { return client ? client.auth.signOut() : null; });
  }
  function getSession() {
    return getClient().then(function (client) {
      if (!client) return null;
      return client.auth.getSession().then(function (r) { return (r.data && r.data.session) || null; });
    });
  }
  function onAuthChange(cb) {
    getClient().then(function (client) {
      if (client) client.auth.onAuthStateChange(function (event, session) { cb(event, session); });
    });
  }
  // The "admins" table is only selectable by admins (RLS); a non-admin's
  // query silently comes back empty rather than erroring, so "got a row
  // back" is a reliable admin check without needing a separate RPC.
  function checkIsAdmin() {
    return getClient().then(function (client) {
      if (!client) return false;
      return client.from('admins').select('email').limit(1).then(function (r) {
        return !r.error && Array.isArray(r.data) && r.data.length > 0;
      });
    }).catch(function () { return false; });
  }

  // ---- generic admin CRUD --------------------------------------------
  function insertRow(table, row) {
    return getClient().then(function (client) {
      if (!client) throw new Error('supabase_not_configured');
      return client.from(table).insert(row).select().then(function (r) {
        if (r.error) throw r.error;
        return r.data && r.data[0];
      });
    });
  }
  function updateRow(table, id, patch) {
    return getClient().then(function (client) {
      if (!client) throw new Error('supabase_not_configured');
      return client.from(table).update(patch).eq('id', id).select().then(function (r) {
        if (r.error) throw r.error;
        return r.data && r.data[0];
      });
    });
  }
  function deleteRow(table, id) {
    return getClient().then(function (client) {
      if (!client) throw new Error('supabase_not_configured');
      return client.from(table).delete().eq('id', id).then(function (r) {
        if (r.error) throw r.error;
        return true;
      });
    });
  }
  function updateSettings(patch) {
    return getClient().then(function (client) {
      if (!client) throw new Error('supabase_not_configured');
      return client.from('settings').update(patch).eq('id', 1).select().then(function (r) {
        if (r.error) throw r.error;
        return r.data && r.data[0];
      });
    });
  }
  function updateOrder(id, patch) {
    return updateRow('orders', id, patch);
  }

  // ---- storage: product / artist / journal photos --------------------
  // Bucket "media" is public-read; only admins (RLS) can write to it.
  function uploadImage(file, folder) {
    return getClient().then(function (client) {
      if (!client) throw new Error('supabase_not_configured');
      var extMatch = /\.([a-z0-9]+)$/i.exec(file.name || '');
      var ext = (extMatch ? extMatch[1] : 'jpg').toLowerCase();
      var path = folder + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      return client.storage.from('media').upload(path, file, { upsert: true, cacheControl: '3600' }).then(function (r) {
        if (r.error) throw r.error;
        var pub = client.storage.from('media').getPublicUrl(path);
        return (pub && pub.data && pub.data.publicUrl) || null;
      });
    });
  }

  // ---- load everything the admin needs, including drafts/unpublished -
  // (RLS lets an authenticated admin see draft/inactive rows too, so these
  // are the same tables the storefront reads, just without the status filter.)
  function loadAdminCatalog() {
    return getClient().then(function (client) {
      if (!client) return null;
      return Promise.all([
        client.from('products').select('*').order('position'),
        client.from('artists').select('*').order('position'),
        client.from('journal_posts').select('*').order('created_at', { ascending: false }),
        client.from('collections').select('*').order('position'),
        client.from('discounts').select('*'),
        client.from('customers').select('*'),
        client.from('orders').select('*').order('created_at', { ascending: false }),
        client.from('order_items').select('*'),
        client.from('settings').select('*').eq('id', 1).maybeSingle()
      ]).then(function (res) {
        var anyError = res.some(function (r) { return r.error; });
        if (anyError) return null;
        var itemsByOrder = {};
        (res[7].data || []).forEach(function (it) {
          (itemsByOrder[it.order_id] = itemsByOrder[it.order_id] || []).push({ pid: it.product_id, qty: it.qty, size: it.size });
        });
        var orders = (res[6].data || []).map(function (o) {
          return { id: o.id, customer: o.customer, email: o.email, address: o.address, date: o.date,
            stage: o.stage, method: o.method, tracking: o.tracking || '', items: itemsByOrder[o.id] || [] };
        });
        var settings = res[8].data || {};
        return {
          products: (res[0].data || []).map(mapProduct),
          artists: (res[1].data || []).map(mapArtist),
          journal: (res[2].data || []).map(mapPost),
          collections: (res[3].data || []).map(mapCollection),
          discounts: (res[4].data || []).map(mapDiscount),
          customers: (res[5].data || []).map(mapCustomer),
          orders: orders,
          settings: { store: settings.store, email: settings.email, currency: settings.currency },
          providers: settings.providers || {}
        };
      });
    }).catch(function () { return null; });
  }

  // ---- load the whole catalog/content into the UI store shape -------
  function loadStore() {
    return getClient().then(function (client) {
      if (!client) return null;
      return Promise.all([
        client.from('products').select('*').order('position'),
        client.from('artists').select('*').order('position'),
        client.from('journal_posts').select('*').order('created_at', { ascending: false }),
        client.from('collections').select('*').order('position'),
        client.from('discounts').select('*'),
        client.from('settings').select('*').eq('id', 1).maybeSingle()
      ]).then(function (res) {
        var anyError = res.some(function (r) { return r.error; });
        if (anyError) return null;
        var settings = res[5].data || {};
        return {
          products: (res[0].data || []).map(mapProduct),
          artists: (res[1].data || []).map(mapArtist),
          journal: (res[2].data || []).map(mapPost),
          collections: (res[3].data || []).map(mapCollection),
          discounts: (res[4].data || []).map(mapDiscount),
          settings: { store: settings.store, email: settings.email, currency: settings.currency },
          providers: settings.providers || {}
        };
      });
    }).catch(function () { return null; });
  }

  global.OMG = global.OMG || {};
  global.OMG.remote = {
    getConfig: getConfig,
    getClient: getClient,
    loadStore: loadStore,
    loadAdminCatalog: loadAdminCatalog,
    map: { product: mapProduct, artist: mapArtist, post: mapPost, collection: mapCollection, discount: mapDiscount, customer: mapCustomer },
    unmap: { product: unmapProduct, artist: unmapArtist, post: unmapPost, collection: unmapCollection, discount: unmapDiscount },
    signIn: signIn, signOut: signOut, getSession: getSession, onAuthChange: onAuthChange, checkIsAdmin: checkIsAdmin,
    insertRow: insertRow, updateRow: updateRow, deleteRow: deleteRow, updateSettings: updateSettings, updateOrder: updateOrder,
    uploadImage: uploadImage
  };
})(window);
