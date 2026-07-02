/* ============================================================
   Oh my Gogh! — Medusa Store API client
   Replaces the old Supabase layer (js/supabase.js, archived in
   legacy/). Talks to the Medusa backend configured in js/config.js.

   Exposes OMG.api with:
     loadStore()                 catalog+content in the UI store shape
     cart: ensure/sync/promo/shipping/payment/complete
     auth: register/login/logout/me/orders/addresses
     reviews, ratings, wishlist

   Everything returns Promises and fails soft (null) so the SPA can
   fall back to the bundled demo catalog when the backend is down.
   ============================================================ */
(function (global) {
  'use strict';

  var CFG = global.OMG_CONFIG || {};
  var BASE = CFG.medusaUrl || '';
  var PK = CFG.publishableKey || '';
  var TOKEN_KEY = 'omg.jwt.v1';
  var CART_ID_KEY = 'omg.cartid.v1';

  var _region = null;      // resolved once per session
  var _shipOptions = null; // cached per cart id

  function token() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} }
  function cartId() { try { return localStorage.getItem(CART_ID_KEY) || ''; } catch (e) { return ''; } }
  function setCartId(id) { try { id ? localStorage.setItem(CART_ID_KEY, id) : localStorage.removeItem(CART_ID_KEY); } catch (e) {} }

  function req(path, opts) {
    opts = opts || {};
    var headers = { 'x-publishable-api-key': PK };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    var t = token();
    if (t) headers['Authorization'] = 'Bearer ' + t;
    return fetch(BASE + path, {
      method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'),
      headers: headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) {
          var err = new Error((data && data.message) || ('http_' + r.status));
          err.status = r.status; err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  function getRegion() {
    if (_region) return Promise.resolve(_region);
    return req('/store/regions').then(function (d) {
      _region = (d.regions && d.regions[0]) || null;
      return _region;
    });
  }

  // ---- catalog: map Medusa entities into the UI store shape ----------
  function mapProduct(p) {
    var meta = p.metadata || {};
    var variants = (p.variants || []).map(function (v) {
      var size = 'One';
      (v.options || []).forEach(function (o) { if (o.value) size = o.value; });
      return {
        id: v.id, size: size,
        price: (v.calculated_price && v.calculated_price.calculated_amount) || 0,
        inventory: typeof v.inventory_quantity === 'number' ? v.inventory_quantity : null
      };
    });
    var cats = (p.categories || []).map(function (c) { return c.name; });
    var shopCat = null, collections = [];
    (p.categories || []).forEach(function (c) {
      if (c.parent_category_id) collections.push(c.name);
      else if (c.name !== 'Collections') shopCat = c.name;
    });
    var inv = 0, invKnown = false;
    variants.forEach(function (v) { if (v.inventory !== null) { invKnown = true; inv += v.inventory; } });
    return {
      id: p.id,
      handle: p.handle,
      name: p.title,
      cat: shopCat || cats[0] || '',
      collections: collections,
      price: variants.length ? variants[0].price : 0,
      inventory: invKnown ? inv : 99,
      status: p.status === 'published' ? 'published' : 'draft',
      tint: meta.tint || '20,42,84',
      medium: meta.medium || '',
      artist: meta.artist || 'Atelier OMG',
      sizes: variants.map(function (v) { return v.size; }),
      variants: variants,
      sold: meta.sold || 0,
      blurb: p.description || '',
      image_url: (p.images && p.images[0] && p.images[0].url) || null
    };
  }

  function mapArtist(a) {
    return { id: a.id, handle: a.handle, name: a.name, medium: a.medium, location: a.location,
      tint: a.tint, quote: a.quote, bioText: a.bio, instagram: a.instagram,
      portfolio: a.portfolio, featured: a.featured, status: a.status, image_url: a.image_url };
  }

  function mapPost(p) {
    return { id: p.id, handle: p.handle, title: p.title, cat: p.category, read_time: p.read_time,
      author: p.author, date: p.published_date, excerpt: p.excerpt, bodyText: p.body,
      status: p.status, tint: p.tint, image_url: p.image_url };
  }

  function loadStore() {
    if (!BASE || !PK) return Promise.resolve(null);
    return getRegion().then(function (region) {
      if (!region) return null;
      var productFields = 'id,title,handle,status,description,metadata,' +
        '*variants,*variants.calculated_price,*variants.options,+variants.inventory_quantity,' +
        '*categories,*images';
      return Promise.all([
        req('/store/products?region_id=' + region.id + '&limit=100&fields=' + encodeURIComponent(productFields)),
        req('/store/artists'),
        req('/store/journal'),
        req('/store/product-categories?limit=50')
      ]).then(function (res) {
        var products = (res[0].products || []).map(mapProduct);
        var collections = (res[3].product_categories || [])
          .filter(function (c) { return c.parent_category_id; })
          .map(function (c) {
            return {
              id: c.id, name: c.name, desc: c.description || '', status: 'published',
              productIds: products.filter(function (p) {
                return p.collections.indexOf(c.name) >= 0;
              }).map(function (p) { return p.id; })
            };
          });
        return {
          products: products,
          artists: (res[1].artists || []).map(mapArtist),
          journal: (res[2].posts || []).map(mapPost),
          collections: collections,
          discounts: [], // promo codes are validated server-side at checkout now
          settings: { store: 'Oh my Gogh!', email: 'parth@ohmygogh.com', currency: 'INR (₹)' },
          providers: { razorpay: { enabled: true, mode: 'test' } },
          region: region
        };
      });
    }).catch(function (e) {
      console.warn('[omg] backend unreachable, using demo catalog:', e.message);
      return null;
    });
  }

  // ---- cart -----------------------------------------------------------
  // The SPA keeps its lightweight local cart for instant UI; this syncs it
  // into a real Medusa cart whenever server truth is needed (promo,
  // shipping, totals, payment).
  function getCart(id) {
    var fields = 'id,email,total,subtotal,discount_total,shipping_total,tax_total,currency_code,' +
      '*items,*shipping_methods,*promotions,*payment_collection,*payment_collection.payment_sessions';
    return req('/store/carts/' + id + '?fields=' + encodeURIComponent(fields))
      .then(function (d) { return d.cart; });
  }

  function ensureCart() {
    var id = cartId();
    var get = id ? getCart(id).catch(function () { return null; }) : Promise.resolve(null);
    return get.then(function (cart) {
      if (cart && !cart.completed_at) return cart;
      return getRegion().then(function (region) {
        return req('/store/carts', { body: { region_id: region.id } }).then(function (d) {
          setCartId(d.cart.id);
          return d.cart;
        });
      });
    });
  }

  // Replace the Medusa cart's lines with the local cart's lines.
  // localLines: [{variantId, qty}]
  function syncCart(localLines) {
    return ensureCart().then(function (cart) {
      return getCart(cart.id).then(function (full) {
        var ops = Promise.resolve();
        (full.items || []).forEach(function (item) {
          ops = ops.then(function () {
            return req('/store/carts/' + cart.id + '/line-items/' + item.id, { method: 'DELETE' });
          });
        });
        localLines.forEach(function (l) {
          ops = ops.then(function () {
            return req('/store/carts/' + cart.id + '/line-items', {
              body: { variant_id: l.variantId, quantity: l.qty }
            });
          });
        });
        return ops.then(function () { return getCart(cart.id); });
      });
    });
  }

  function applyPromo(code) {
    return ensureCart().then(function (cart) {
      return req('/store/carts/' + cart.id + '/promotions', { body: { promo_codes: [code] } })
        .then(function () { return getCart(cart.id); });
    });
  }
  function removePromos(codes) {
    return ensureCart().then(function (cart) {
      return req('/store/carts/' + cart.id + '/promotions', {
        method: 'DELETE', body: { promo_codes: codes }
      }).then(function () { return getCart(cart.id); });
    });
  }

  function setCheckoutDetails(email, address) {
    return ensureCart().then(function (cart) {
      return req('/store/carts/' + cart.id, {
        body: { email: email, shipping_address: address, billing_address: address }
      }).then(function (d) { return d.cart; });
    });
  }

  function listShippingOptions() {
    return ensureCart().then(function (cart) {
      return req('/store/shipping-options?cart_id=' + cart.id).then(function (d) {
        return d.shipping_options || [];
      });
    });
  }

  function addShippingMethod(optionId) {
    return ensureCart().then(function (cart) {
      return req('/store/carts/' + cart.id + '/shipping-methods', {
        body: { option_id: optionId }
      }).then(function () { return getCart(cart.id); });
    });
  }

  function initPaymentSession(providerId) {
    return ensureCart().then(function (cart) {
      return getCart(cart.id).then(function (full) {
        return req('/store/payment-collections', { body: { cart_id: cart.id } })
          .then(function (d) {
            return req('/store/payment-collections/' + d.payment_collection.id + '/payment-sessions', {
              body: { provider_id: providerId }
            });
          })
          .then(function (d) {
            var sessions = (d.payment_collection && d.payment_collection.payment_sessions) || [];
            var s = null;
            sessions.forEach(function (x) { if (x.provider_id === providerId) s = x; });
            return { cart: full, session: s };
          });
      });
    });
  }

  function completeCart() {
    return ensureCart().then(function (cart) {
      return req('/store/carts/' + cart.id + '/complete', { method: 'POST', body: {} })
        .then(function (d) {
          if (d.type === 'order' && d.order) { setCartId(''); return d.order; }
          var msg = (d.error && (d.error.message || d.error)) || 'cart_completion_failed';
          throw new Error(typeof msg === 'string' ? msg : 'cart_completion_failed');
        });
    });
  }

  // ---- customer auth ---------------------------------------------------
  function register(email, password, firstName, lastName) {
    return req('/auth/customer/emailpass/register', { body: { email: email, password: password } })
      .then(function (d) {
        setToken(d.token);
        return req('/store/customers', {
          body: { email: email, first_name: firstName || '', last_name: lastName || '' }
        });
      })
      .then(function () { return login(email, password); });
  }

  function login(email, password) {
    return req('/auth/customer/emailpass', { body: { email: email, password: password } })
      .then(function (d) {
        setToken(d.token);
        return me();
      });
  }

  function logout() { setToken(''); return Promise.resolve(null); }

  function me() {
    if (!token()) return Promise.resolve(null);
    return req('/store/customers/me').then(function (d) { return d.customer; })
      .catch(function (e) {
        if (e.status === 401) setToken('');
        return null;
      });
  }

  function myOrders() {
    var fields = 'id,display_id,status,total,currency_code,created_at,*items,*fulfillments,*fulfillments.labels';
    return req('/store/orders?order=-created_at&fields=' + encodeURIComponent(fields))
      .then(function (d) { return d.orders || []; })
      .catch(function () { return []; });
  }

  function updateProfile(patch) {
    return req('/store/customers/me', { body: patch }).then(function (d) { return d.customer; });
  }

  function addAddress(address) {
    return req('/store/customers/me/addresses', { body: address }).then(function (d) { return d.customer; });
  }
  function deleteAddress(id) {
    return req('/store/customers/me/addresses/' + id, { method: 'DELETE' });
  }

  // ---- reviews / ratings / wishlist -------------------------------------
  function productReviews(productId) {
    return req('/store/products/' + productId + '/reviews')
      .catch(function () { return { reviews: [], rating: { count: 0, average: 0 } }; });
  }
  function submitReview(productId, review) {
    return req('/store/products/' + productId + '/reviews', { body: review });
  }
  function ratings(productIds) {
    if (!productIds.length) return Promise.resolve({});
    return req('/store/ratings?product_ids=' + productIds.join(','))
      .then(function (d) { return d.ratings || {}; })
      .catch(function () { return {}; });
  }
  function wishlist() {
    return req('/store/wishlist').then(function (d) { return d.items || []; });
  }
  function wishlistAdd(productId) {
    return req('/store/wishlist', { body: { product_id: productId } })
      .then(function (d) { return d.items || []; });
  }
  function wishlistRemove(productId) {
    return req('/store/wishlist/' + productId, { method: 'DELETE' })
      .then(function (d) { return d.items || []; });
  }

  function searchProducts(q, regionId) {
    var fields = 'id,title,handle,status,description,metadata,' +
      '*variants,*variants.calculated_price,*variants.options,*categories,*images';
    return req('/store/products?q=' + encodeURIComponent(q) + '&region_id=' + regionId +
      '&limit=50&fields=' + encodeURIComponent(fields))
      .then(function (d) { return (d.products || []).map(mapProduct); })
      .catch(function () { return null; });
  }

  global.OMG = global.OMG || {};
  global.OMG.api = {
    configured: !!(BASE && PK),
    base: BASE,
    loadStore: loadStore,
    getRegion: getRegion,
    hasToken: function () { return !!token(); },
    cart: {
      ensure: ensureCart,
      get: getCart,
      id: cartId,
      clearId: function () { setCartId(''); },
      sync: syncCart,
      applyPromo: applyPromo,
      removePromos: removePromos,
      setDetails: setCheckoutDetails,
      shippingOptions: listShippingOptions,
      addShippingMethod: addShippingMethod,
      initPaymentSession: initPaymentSession,
      complete: completeCart
    },
    auth: {
      register: register, login: login, logout: logout, me: me,
      orders: myOrders, updateProfile: updateProfile,
      addAddress: addAddress, deleteAddress: deleteAddress
    },
    reviews: { list: productReviews, submit: submitReview, ratings: ratings },
    wishlist: { list: wishlist, add: wishlistAdd, remove: wishlistRemove },
    search: searchProducts
  };
})(window);
