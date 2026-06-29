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
    map: { product: mapProduct, artist: mapArtist, post: mapPost, collection: mapCollection, discount: mapDiscount }
  };
})(window);
