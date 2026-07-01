/* ============================================================
   Oh my Gogh! — storefront SPA (vanilla)
   Faithful port of the imported "Oh My Gogh.dc.html" design.
   ============================================================ */
(function () {
  'use strict';

  var DB = window.OMG;
  var cardBg = DB.cardBg, esc = DB.esc;
  var CART_KEY = 'omg.cart.v1';

  // currency-aware price formatting (symbol derived from settings.currency)
  var currencySymbol = '$';
  function symbolFromCurrency(c) {
    if (!c) return '$';
    var m = String(c).match(/\(([^)]+)\)/);
    if (m) return m[1];
    if (/INR|₹/i.test(c)) return '₹';
    if (/USD|\$/.test(c)) return '$';
    return String(c).trim().charAt(0) || '$';
  }
  function fmt(n) { return currencySymbol + Math.round(n); }

  // ----- live catalog (Supabase when configured, else bundled demo) ---
  var store = DB.load();
  currencySymbol = symbolFromCurrency(store.settings && store.settings.currency);

  function published(list) { return list.filter(function (p) { return p.status !== 'draft'; }); }
  function products() { return published(store.products); }
  function artists() { return store.artists.slice(); }
  function journal() { return published(store.journal); }

  var SAVED_KEY = 'omg.saved.v1';
  var ACCOUNT_KEY = 'omg.account.v1';

  // ----- app state ---------------------------------------------------
  var state = {
    view: 'home',
    cart: loadCart(),
    cat: 'All',
    pid: 'p1',
    size: 'M',
    articleId: null,
    artistName: null,
    promo: '',
    promoOk: false,
    orderNo: null,
    newsDone: false,
    toast: '',
    menuOpen: false,
    searchQ: '',
    saved: loadSaved(),
    checkoutStep: 1,
    co: { email: '', first: '', last: '', address: '', apt: '', city: '', zip: '', country: '', ship: 'standard' },
    infoKey: 'shipping',
    contactSent: false,
    acctTab: 'orders'
  };
  var acct = loadAccount();
  var toastTimer = null;

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { return []; }
  }
  function saveCart() { try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); } catch (e) {} }

  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || []; } catch (e) { return []; }
  }
  function saveSaved() { try { localStorage.setItem(SAVED_KEY, JSON.stringify(state.saved)); } catch (e) {} }
  function toggleSave(id) {
    var i = state.saved.indexOf(id);
    if (i >= 0) state.saved.splice(i, 1); else state.saved.push(id);
    saveSaved();
  }

  function loadAccount() {
    try {
      return JSON.parse(localStorage.getItem(ACCOUNT_KEY)) || { authed: false, profile: { name: '', email: '', address: '' } };
    } catch (e) { return { authed: false, profile: { name: '', email: '', address: '' } }; }
  }
  function saveAccount() { try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acct)); } catch (e) {} }

  // ----- helpers -----------------------------------------------------
  var ACCENT = { shop: '#E0A93A', artists: '#2E8A87', journal: '#15315C', about: '#C0561E' };
  var NAV = [['shop', 'Shop'], ['artists', 'Artists'], ['journal', 'Journal'], ['about', 'About']];

  function findProduct(id) {
    for (var i = 0; i < store.products.length; i++) if (store.products[i].id === id) return store.products[i];
    return store.products[0];
  }
  function findProductStrict(id) {
    for (var i = 0; i < store.products.length; i++) if (store.products[i].id === id) return store.products[i];
    return null;
  }
  function findArtist(name) {
    var list = artists();
    for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i];
    return null;
  }
  function cartCount() { return state.cart.reduce(function (s, c) { return s + c.qty; }, 0); }

  function showToast(msg) {
    state.toast = msg;
    render();
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { state.toast = ''; render(); }, 2200);
  }

  function go(view) {
    state.view = view;
    state.menuOpen = false;
    if (view === 'checkout') state.checkoutStep = 1;
    window.scrollTo(0, 0);
    render();
  }

  function checkoutNext() {
    var form = document.querySelector('[data-checkout-form]');
    if (form) {
      var get = function (n) { var el = form.querySelector('[name=' + n + ']'); return el ? el.value : undefined; };
      ['email', 'first', 'last', 'address', 'apt', 'city', 'zip', 'country'].forEach(function (k) {
        var v = get(k); if (v !== undefined) state.co[k] = v;
      });
    }
    if (state.checkoutStep >= 3) { startCheckout(form); return; }
    state.checkoutStep += 1;
    window.scrollTo(0, 0);
    render();
  }
  function checkoutBack() {
    state.checkoutStep = Math.max(1, state.checkoutStep - 1);
    window.scrollTo(0, 0);
    render();
  }

  function openArtist(name) {
    state.artistName = name;
    state.view = 'artist';
    state.menuOpen = false;
    window.scrollTo(0, 0);
    render();
  }

  function openProduct(id) {
    var p = findProduct(id);
    state.pid = id;
    state.size = (p && p.cat === 'Apparel') ? 'M' : 'One';
    state.view = 'product';
    window.scrollTo(0, 0);
    render();
  }

  function addToCart(p, size) {
    var s = size || (p.cat === 'Apparel' ? 'M' : 'One');
    var i = -1;
    for (var k = 0; k < state.cart.length; k++) if (state.cart[k].id === p.id && state.cart[k].size === s) { i = k; break; }
    if (i >= 0) state.cart[i].qty += 1;
    else state.cart.push({ id: p.id, name: p.name, price: p.price, tint: p.tint, cat: p.cat, size: s, qty: 1 });
    saveCart();
    showToast(p.name + ' added to your bag');
  }

  function changeQty(id, size, d) {
    for (var k = 0; k < state.cart.length; k++) {
      if (state.cart[k].id === id && state.cart[k].size === size) {
        state.cart[k].qty += d;
        if (state.cart[k].qty <= 0) state.cart.splice(k, 1);
        break;
      }
    }
    saveCart(); render();
  }
  function removeLine(id, size) {
    state.cart = state.cart.filter(function (c) { return !(c.id === id && c.size === size); });
    saveCart(); render();
  }

  // payment/shipping config — overridden from /api/config when the site is live
  var paymentsLive = false, rzpKeyId = '', shipFreeOver = 75, shipFlat = 8;

  var EXPRESS_SHIPPING = 14;
  function cartTotals() {
    var subtotal = state.cart.reduce(function (s, c) { return s + c.price * c.qty; }, 0);
    var discount = state.promoOk ? subtotal * 0.15 : 0;
    var shipping;
    if (subtotal === 0) shipping = 0;
    else if (state.co.ship === 'express') shipping = EXPRESS_SHIPPING;
    else shipping = (subtotal - discount >= shipFreeOver ? 0 : shipFlat);
    return { subtotal: subtotal, discount: discount, shipping: shipping, total: subtotal - discount + shipping };
  }

  // demo fallback — used when Razorpay isn't configured yet
  function placeOrder() {
    var no = 'OMG-' + Math.floor(100000 + Math.random() * 900000);
    state.orderNo = no;
    state.view = 'confirm';
    state.cart = [];
    state.promo = ''; state.promoOk = false;
    state.checkoutStep = 1;
    saveCart();
    window.scrollTo(0, 0);
    render();
  }

  function loadRazorpay() {
    return new Promise(function (resolve, reject) {
      if (window.Razorpay) return resolve(window.Razorpay);
      var s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = function () { resolve(window.Razorpay); };
      s.onerror = function () { reject(new Error('razorpay_load_failed')); };
      document.head.appendChild(s);
    });
  }

  function collectCustomer() {
    var co = state.co;
    var name = [co.first, co.last].filter(Boolean).join(' ');
    var addr = [co.address, co.apt, co.city, co.zip, co.country].filter(Boolean).join(', ');
    return { name: name, email: co.email || '', address: addr };
  }

  // real checkout: server prices the cart, creates a Razorpay order, opens
  // Razorpay Checkout, then verifies + records the order server-side.
  function startCheckout(form) {
    var customer = collectCustomer();
    if (!paymentsLive) { placeOrder(); return; }   // demo mode until keys are set
    var items = state.cart.map(function (c) { return { id: c.id, size: c.size, qty: c.qty }; });
    var code = state.promoOk ? (state.promo || '') : '';
    var btn = form ? form.querySelector('[data-act="checkoutnext"]') : null;
    var resetBtn = function () { if (btn) { btn.disabled = false; btn.textContent = 'Pay ' + fmt(cartTotals().total); } };
    if (btn) { btn.disabled = true; btn.textContent = 'Contacting Razorpay…'; }

    fetch('/api/razorpay/create-order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items, code: code })
    }).then(function (r) { return r.json(); }).then(function (order) {
      if (!order || !order.orderId) throw new Error((order && order.error) || 'order_failed');
      return loadRazorpay().then(function (Razorpay) {
        var rzp = new Razorpay({
          key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency,
          name: 'Oh my Gogh!', description: 'Wearable art & studio goods', image: 'assets/omg-emblem.png',
          prefill: { name: customer.name, email: customer.email }, theme: { color: '#15315C' },
          handler: function (resp) {
            fetch('/api/razorpay/verify', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(Object.assign({}, resp, { customer: customer, items: items, code: code }))
            }).then(function (r) { return r.json(); }).then(function (out) {
              state.orderNo = (out && out.orderNo) || 'OMG-PAID';
              state.view = 'confirm'; state.cart = []; state.promo = ''; state.promoOk = false;
              saveCart(); window.scrollTo(0, 0); render();
            }).catch(function () {
              state.orderNo = 'OMG-PAID'; state.view = 'confirm'; state.cart = [];
              saveCart(); render();
            });
          },
          modal: { ondismiss: resetBtn }
        });
        rzp.on('payment.failed', function () { showToast('Payment failed — please try again'); resetBtn(); });
        rzp.open();
      });
    }).catch(function (err) {
      resetBtn();
      showToast('Checkout error — ' + ((err && err.message) || 'please try again'));
    });
  }

  // card art layer: real image if assets/art/<id>.jpg exists, else painterly gradient
  function artLayer(p) {
    return '<div style="position:absolute;inset:0;background-image:url(\'assets/grain.svg\');background-size:200px;opacity:.14;mix-blend-mode:multiply"></div>';
  }

  // ===================================================================
  //  HEADER + FOOTER
  // ===================================================================
  function header() {
    var v = state.view;
    var items = NAV.map(function (n) {
      var key = n[0], label = n[1];
      var active = v === key;
      return '<button class="nav-link" data-act="go" data-view="' + key + '" style="display:flex;align-items:center;gap:9px;background:none;border:none;cursor:pointer;padding:6px 2px">' +
        '<span class="omg-navblob" style="position:relative;width:16px;height:16px;display:inline-block;flex:none">' +
        '<span style="position:absolute;inset:0;background:' + ACCENT[key] + ';border-radius:46% 54% 56% 44%/52% 48% 52% 48%;animation:ftBlob 6s ease-in-out infinite;box-shadow:0 2px 7px rgba(14,35,71,0.2)"></span>' +
        (active ? '<span style="position:absolute;inset:-5px;border:1.5px solid #15315C;border-radius:50%"></span>' : '') +
        '</span>' +
        '<span class="omg-navlabel" style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:' + (active ? '#15315C' : 'rgba(21,49,92,0.55)') + '">' + label + '</span>' +
        '</button>';
    }).join('');

    var searchActive = v === 'search';
    var search = '<button class="nav-link" data-act="go" data-view="search" style="display:flex;align-items:center;gap:9px;background:none;border:none;cursor:pointer;padding:6px 2px;margin-left:4px">' +
      '<span class="omg-navblob" style="position:relative;width:16px;height:16px;display:inline-block;flex:none">' +
      '<span style="position:absolute;inset:0;background:#C0561E;border-radius:46% 54% 56% 44%/52% 48% 52% 48%;animation:ftBlob 6s ease-in-out infinite;box-shadow:0 2px 7px rgba(14,35,71,0.2)"></span>' +
      (searchActive ? '<span style="position:absolute;inset:-5px;border:1.5px solid #15315C;border-radius:50%"></span>' : '') + '</span>' +
      '<span class="omg-navlabel" style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:' + (searchActive ? '#15315C' : 'rgba(21,49,92,0.55)') + '">Search</span></button>';

    var acctActive = v === 'account';
    var account = '<button class="nav-link" data-act="go" data-view="account" style="display:flex;align-items:center;gap:9px;background:none;border:none;cursor:pointer;padding:6px 2px">' +
      '<span class="omg-navblob" style="position:relative;width:16px;height:16px;display:inline-block;flex:none">' +
      '<span style="position:absolute;inset:0;background:#C99224;border-radius:46% 54% 56% 44%/52% 48% 52% 48%;animation:ftBlob 6s ease-in-out infinite;box-shadow:0 2px 7px rgba(14,35,71,0.2)"></span>' +
      (acctActive ? '<span style="position:absolute;inset:-5px;border:1.5px solid #15315C;border-radius:50%"></span>' : '') + '</span>' +
      '<span class="omg-navlabel" style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:' + (acctActive ? '#15315C' : 'rgba(21,49,92,0.55)') + '">Account</span></button>';

    var bagActive = v === 'cart';
    var bag = '<button class="nav-link" data-act="go" data-view="cart" style="display:flex;align-items:center;gap:9px;background:none;border:none;cursor:pointer;padding:6px 2px;margin-left:4px">' +
      '<span class="omg-bagblob" style="position:relative;width:18px;height:18px;display:inline-block;flex:none">' +
      '<span style="position:absolute;inset:0;background:#2E8A87;border-radius:46% 54% 56% 44%/52% 48% 52% 48%;animation:ftBlob 6s ease-in-out infinite;box-shadow:0 2px 7px rgba(14,35,71,0.2)"></span></span>' +
      '<span class="omg-navlabel" style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:' + (bagActive ? '#15315C' : 'rgba(21,49,92,0.55)') + '">Bag</span>' +
      (cartCount() > 0 ? '<span style="min-width:19px;height:19px;padding:0 5px;border-radius:10px;background:#15315C;color:#F3EDDD;font-family:\'Space Mono\',monospace;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center">' + cartCount() + '</span>' : '') +
      '</button>';

    var menuOpen = state.menuOpen;
    var burgerTop = menuOpen ? 'translateY(5.5px) rotate(45deg)' : 'none';
    var burgerMid = menuOpen ? '0' : '1';
    var burgerBot = menuOpen ? 'translateY(-5.5px) rotate(-45deg)' : 'none';
    var burger = '<button class="omg-burger" data-act="togglemenu" aria-label="Open menu" style="align-items:center;justify-content:center;width:42px;height:42px;border-radius:13px;border:1px solid rgba(21,49,92,0.16);background:rgba(251,246,234,0.92);cursor:pointer;flex:none;position:relative;padding:0">' +
      '<span style="position:relative;width:18px;height:13px;display:block">' +
      '<span style="position:absolute;left:0;right:0;top:0;height:2px;border-radius:2px;background:#15315C;transition:transform .3s ease;transform:' + burgerTop + '"></span>' +
      '<span style="position:absolute;left:0;right:0;top:5.5px;height:2px;border-radius:2px;background:#15315C;transition:opacity .2s ease;opacity:' + burgerMid + '"></span>' +
      '<span style="position:absolute;left:0;right:0;bottom:0;height:2px;border-radius:2px;background:#15315C;transition:transform .3s ease;transform:' + burgerBot + '"></span></span>' +
      (cartCount() > 0 ? '<span style="position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#C0561E;color:#F3EDDD;font-family:\'Space Mono\',monospace;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(14,35,71,0.4)">' + cartCount() + '</span>' : '') +
      '</button>';

    var overlay = menuOpen ? '<div data-act="closemenu" style="position:fixed;inset:0;z-index:480;background:rgba(14,35,71,0.12)"></div>' : '';

    return '<header class="omg-header" style="position:fixed;top:0;left:0;right:0;z-index:500;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:13px clamp(16px,4vw,46px);background:rgba(243,237,221,0.82);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid rgba(21,49,92,0.12)">' +
      '<div data-act="go" data-view="home" style="display:flex;align-items:center;gap:12px;cursor:pointer">' +
      '<img class="omg-emblem-nav" src="assets/omg-emblem.png" alt="Oh my Gogh emblem" style="width:42px;height:42px;border-radius:50%;box-shadow:0 3px 12px rgba(14,35,71,0.25);animation:ftBob 7s ease-in-out infinite">' +
      '<span class="omg-wordmark" style="font-family:\'Yellowtail\',cursive;font-size:27px;line-height:1;color:#15315C;white-space:nowrap">Oh my <span style="color:#C99224">Gogh!</span></span>' +
      '</div>' +
      '<nav class="omg-nav' + (menuOpen ? ' open' : '') + '" style="display:flex;align-items:center;gap:clamp(8px,2vw,24px);flex-wrap:wrap;justify-content:flex-end">' + items + search + account + bag + '</nav>' +
      burger +
      '</header>' + overlay;
  }

  function footer() {
    var shopLinks = ['Apparel', 'Art Supplies', 'Accessories', 'Books'].map(function (label) {
      return '<button class="foot-link" data-act="shopcat" data-cat="' + esc(label) + '" style="display:block;background:none;border:none;cursor:pointer;font-family:\'Space Grotesk\',sans-serif;font-size:14px;color:rgba(243,237,221,.78);padding:5px 0;text-align:left">' + label + '</button>';
    }).join('');

    return '<footer style="background:#0E2347;color:#F3EDDD;margin-top:clamp(40px,6vw,80px);padding:clamp(50px,6vw,80px) clamp(20px,6vw,70px) 30px;position:relative;overflow:hidden">' +
      '<div style="position:absolute;inset:0;background-image:url(\'assets/grain.svg\');background-size:240px;opacity:.07;mix-blend-mode:overlay"></div>' +
      '<div style="max-width:1280px;margin:0 auto;position:relative;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:40px">' +
      '<div style="grid-column:span 1;min-width:200px">' +
      '<div style="display:flex;align-items:center;gap:12px"><img src="assets/omg-emblem.png" alt="" style="width:48px;height:48px;border-radius:50%"><span style="font-family:\'Yellowtail\',cursive;font-size:28px;color:#F3EDDD">Oh my <span style="color:#E0A93A">Gogh!</span></span></div>' +
      '<p style="font-size:14px;line-height:1.7;color:rgba(243,237,221,.7);margin-top:16px;max-width:30ch">Wearable art &amp; studio goods. Made with too much paint, on purpose.</p></div>' +
      '<div><div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#E0A93A;margin-bottom:16px">Shop</div>' + shopLinks + '</div>' +
      '<div><div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#E0A93A;margin-bottom:16px">Explore</div>' +
      '<button class="foot-link" data-act="go" data-view="artists" style="display:block;background:none;border:none;cursor:pointer;font-family:\'Space Grotesk\',sans-serif;font-size:14px;color:rgba(243,237,221,.78);padding:5px 0;text-align:left">Collaborators</button>' +
      '<button class="foot-link" data-act="go" data-view="journal" style="display:block;background:none;border:none;cursor:pointer;font-family:\'Space Grotesk\',sans-serif;font-size:14px;color:rgba(243,237,221,.78);padding:5px 0;text-align:left">Journal</button>' +
      '<button class="foot-link" data-act="go" data-view="about" style="display:block;background:none;border:none;cursor:pointer;font-family:\'Space Grotesk\',sans-serif;font-size:14px;color:rgba(243,237,221,.78);padding:5px 0;text-align:left">Our story</button>' +
      '<button class="foot-link" data-act="go" data-view="account" style="display:block;background:none;border:none;cursor:pointer;font-family:\'Space Grotesk\',sans-serif;font-size:14px;color:rgba(243,237,221,.78);padding:5px 0;text-align:left">Your account</button></div>' +
      '<div><div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#E0A93A;margin-bottom:16px">Support</div>' +
      '<button class="foot-link" data-act="openinfo" data-info="shipping" style="display:block;background:none;border:none;cursor:pointer;font-family:\'Space Grotesk\',sans-serif;font-size:14px;color:rgba(243,237,221,.78);padding:5px 0;text-align:left">Shipping &amp; returns</button>' +
      '<button class="foot-link" data-act="openinfo" data-info="sizeguide" style="display:block;background:none;border:none;cursor:pointer;font-family:\'Space Grotesk\',sans-serif;font-size:14px;color:rgba(243,237,221,.78);padding:5px 0;text-align:left">Size guide</button>' +
      '<button class="foot-link" data-act="openinfo" data-info="faq" style="display:block;background:none;border:none;cursor:pointer;font-family:\'Space Grotesk\',sans-serif;font-size:14px;color:rgba(243,237,221,.78);padding:5px 0;text-align:left">FAQ</button>' +
      '<button class="foot-link" data-act="openinfo" data-info="contact" style="display:block;background:none;border:none;cursor:pointer;font-family:\'Space Grotesk\',sans-serif;font-size:14px;color:rgba(243,237,221,.78);padding:5px 0;text-align:left">Contact</button></div>' +
      '<div><div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#E0A93A;margin-bottom:16px">Legal</div>' +
      '<button class="foot-link" data-act="openinfo" data-info="privacy" style="display:block;background:none;border:none;cursor:pointer;font-family:\'Space Grotesk\',sans-serif;font-size:14px;color:rgba(243,237,221,.78);padding:5px 0;text-align:left">Privacy</button>' +
      '<button class="foot-link" data-act="openinfo" data-info="terms" style="display:block;background:none;border:none;cursor:pointer;font-family:\'Space Grotesk\',sans-serif;font-size:14px;color:rgba(243,237,221,.78);padding:5px 0;text-align:left">Terms</button>' +
      '<button class="foot-link" data-act="openinfo" data-info="accessibility" style="display:block;background:none;border:none;cursor:pointer;font-family:\'Space Grotesk\',sans-serif;font-size:14px;color:rgba(243,237,221,.78);padding:5px 0;text-align:left">Accessibility</button></div>' +
      '<div><div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#E0A93A;margin-bottom:16px">Follow</div>' +
      '<a class="foot-link" href="https://instagram.com" target="_blank" rel="noopener" style="display:block;font-size:14px;color:rgba(243,237,221,.78);padding:5px 0;text-decoration:none">Instagram ↗</a>' +
      '<a class="foot-link" href="https://pinterest.com" target="_blank" rel="noopener" style="display:block;font-size:14px;color:rgba(243,237,221,.78);padding:5px 0;text-decoration:none">Pinterest ↗</a>' +
      '<a class="foot-link" href="https://tiktok.com" target="_blank" rel="noopener" style="display:block;font-size:14px;color:rgba(243,237,221,.78);padding:5px 0;text-decoration:none">TikTok ↗</a></div>' +
      '</div>' +
      '<div style="max-width:1280px;margin:40px auto 0;position:relative;border-top:1px solid rgba(243,237,221,.16);padding-top:22px;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.06em;color:rgba(243,237,221,.55)">' +
      '<span>© 2026 Oh my Gogh! — Art Lifestyle Brand</span>' +
      '<a class="foot-link" href="admin.html" style="text-decoration:none;color:rgba(243,237,221,.55)">Studio admin ↗</a>' +
      '<span>Made with too much paint.</span></div>' +
      '</footer>';
  }

  // ===================================================================
  //  product card (shared shop/featured)
  // ===================================================================
  function productCard(p, opts) {
    opts = opts || {};
    var rot = opts.rot || '0deg';
    var w = opts.w ? ('width:' + opts.w + ';min-width:220px;') : '';
    var mt = opts.mt ? ('margin-top:' + opts.mt + ';') : '';
    var quick = opts.quickAdd ? '<button class="quick-add" data-act="quickadd" data-id="' + p.id + '" title="Add to bag" style="position:absolute;top:10px;right:10px;width:38px;height:38px;border-radius:50%;border:none;background:rgba(243,237,221,.94);color:#15315C;font-size:21px;line-height:1;cursor:pointer;box-shadow:0 4px 12px rgba(14,35,71,.28);display:flex;align-items:center;justify-content:center">+</button>' : '';
    return '<div class="' + (opts.tilt ? 'tilt' : 'lift') + '" data-act="open" data-id="' + p.id + '" style="' + w + mt + 'transform:rotate(' + rot + ');cursor:pointer">' +
      '<div style="position:relative;background:#FBF6EA;padding:13px;box-shadow:0 30px 60px -32px rgba(14,35,71,.55),0 0 0 1px rgba(21,49,92,.1)">' +
      '<div style="position:relative;aspect-ratio:4/5;overflow:hidden;background:' + cardBg(p.tint) + '">' + artLayer(p) +
      '<span style="position:absolute;left:11px;bottom:11px;font-family:\'Space Mono\',monospace;font-size:9px;letter-spacing:.12em;color:#F3EDDD;text-transform:uppercase;background:rgba(21,49,92,.62);padding:5px 9px;border-radius:100px">' + esc(p.medium) + '</span>' + quick +
      '</div></div>' +
      '<div style="margin-top:14px">' +
      '<div style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.2em;color:#C0561E;text-transform:uppercase">' + esc(p.cat) + '</div>' +
      '<h3 style="font-family:\'Playfair Display\',serif;font-size:20px;font-weight:700;margin-top:5px;color:#15315C">' + esc(p.name) + '</h3>' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:6px;gap:10px">' +
      '<span style="font-size:12.5px;color:rgba(21,49,92,.6)">by ' + esc(p.artist) + '</span>' +
      '<span style="font-family:\'Space Mono\',monospace;font-size:15px;color:#15315C">' + fmt(p.price) + '</span></div></div>' +
      '</div>';
  }

  // ===================================================================
  //  VIEWS
  // ===================================================================
  function homeView() {
    var feat = ['p1', 'p2', 'p6', 'p3'];
    var layout = [
      { w: 'clamp(280px,40vw,440px)', mt: '0px', rot: '-1.5deg' },
      { w: 'clamp(220px,26vw,300px)', mt: '72px', rot: '1.5deg' },
      { w: 'clamp(220px,28vw,320px)', mt: '18px', rot: '1deg' },
      { w: 'clamp(210px,24vw,280px)', mt: '108px', rot: '-1deg' }
    ];
    var featured = feat.map(function (id, i) {
      var p = findProduct(id);
      return productCard(p, { w: layout[i].w, mt: layout[i].mt, rot: layout[i].rot, tilt: true });
    }).join('');

    var catMeta = {
      'Apparel': { blurb: 'Wearable canvases', tint: '20,42,84' },
      'Art Supplies': { blurb: 'Tools of the trade', tint: '224,169,58' },
      'Accessories': { blurb: 'Carry the color', tint: '46,138,134' },
      'Books': { blurb: 'Read in color', tint: '192,86,30' }
    };
    var tiles = ['Apparel', 'Art Supplies', 'Accessories', 'Books'].map(function (name) {
      var count = products().filter(function (p) { return p.cat === name; }).length;
      var m = catMeta[name];
      return '<button class="tile-lift" data-act="shopcat" data-cat="' + esc(name) + '" style="position:relative;text-align:left;border:none;cursor:pointer;padding:0;aspect-ratio:3/4;overflow:hidden;background:' + cardBg(m.tint) + ';box-shadow:0 0 0 1px rgba(21,49,92,.1)">' +
        '<div style="position:absolute;inset:0;background-image:url(\'assets/grain.svg\');background-size:200px;opacity:.16;mix-blend-mode:multiply"></div>' +
        '<div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(14,35,71,.78) 0%,rgba(14,35,71,.1) 55%,transparent 100%)"></div>' +
        '<div style="position:absolute;left:18px;right:18px;bottom:18px;color:#F3EDDD">' +
        '<div style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#EBC766">' + count + ' pieces</div>' +
        '<h3 style="font-family:\'Playfair Display\',serif;font-size:clamp(22px,2.2vw,28px);font-weight:700;margin-top:4px">' + esc(name) + '</h3>' +
        '<p style="font-size:13px;opacity:.82;margin-top:3px">' + esc(m.blurb) + '</p></div></button>';
    }).join('');

    var marquee = 'Oil <span style="color:#E0A93A">✦</span> Impasto <span style="color:#E0A93A">✦</span> Sunflowers <span style="color:#E0A93A">✦</span> Starry Nights <span style="color:#E0A93A">✦</span> Wearable Art <span style="color:#E0A93A">✦</span> Hand-Screened <span style="color:#E0A93A">✦</span> Small Batch <span style="color:#E0A93A">✦</span> Made With Too Much Paint <span style="color:#E0A93A">✦</span>&nbsp;';

    var news = state.newsDone
      ? '<p style="font-family:\'Yellowtail\',cursive;font-size:30px;color:#2E8A87;margin-top:24px">You\'re on the list — see you in the studio.</p>'
      : '<form data-act="subscribe" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:26px;max-width:460px;margin-left:auto;margin-right:auto">' +
        '<input type="email" required placeholder="you@studio.com" style="flex:1;min-width:220px;font-family:\'Space Grotesk\',sans-serif;font-size:15px;color:#15315C;background:#F3EDDD;border:1.5px solid rgba(21,49,92,.25);border-radius:100px;padding:14px 22px;outline:none">' +
        '<button class="btn-primary" type="submit" style="font-family:\'Space Grotesk\',sans-serif;font-size:15px;font-weight:600;color:#F3EDDD;background:#15315C;border:none;border-radius:100px;padding:14px 30px;cursor:pointer">Subscribe</button></form>';

    return '<div>' +
      // hero
      '<section style="position:relative;min-height:calc(100vh - 69px);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px 20px 90px;overflow:hidden">' +
      '<svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:.9">' +
      '<path d="M-60,300 C220,210 360,360 600,260 C820,170 1010,300 1280,210" fill="none" stroke="#2E8A87" stroke-width="20" stroke-linecap="round" opacity="0.34" stroke-dasharray="2600" style="animation:ftStroke 1.7s cubic-bezier(.7,0,.3,1) .35s both"></path>' +
      '<path d="M-60,470 C260,400 540,560 780,430 C1000,310 1110,430 1280,360" fill="none" stroke="#E0A93A" stroke-width="30" stroke-linecap="round" opacity="0.5" stroke-dasharray="2600" style="animation:ftStroke 1.7s cubic-bezier(.7,0,.3,1) .15s both"></path>' +
      '<path d="M-60,560 C320,520 560,610 860,520 C1040,465 1150,520 1280,485" fill="none" stroke="#15315C" stroke-width="11" stroke-linecap="round" opacity="0.28" stroke-dasharray="2600" style="animation:ftStroke 1.7s cubic-bezier(.7,0,.3,1) .55s both"></path></svg>' +
      '<img src="assets/omg-emblem.png" alt="Oh my Gogh emblem" style="width:clamp(116px,15vw,176px);height:auto;border-radius:50%;box-shadow:0 22px 55px -16px rgba(14,35,71,0.55);position:relative;z-index:2;animation:ftFloat 6s ease-in-out infinite">' +
      '<div class="omg-hero-eyebrow" style="position:relative;z-index:2;font-family:\'Space Mono\',monospace;font-size:clamp(10px,1.4vw,13px);letter-spacing:0.42em;text-transform:uppercase;color:#C0561E;margin-top:30px;animation:ftRise .8s ease .25s both">Est. 2026 · Art Lifestyle Brand</div>' +
      '<h1 class="omg-hero-title" style="position:relative;z-index:2;font-family:\'Yellowtail\',cursive;font-size:clamp(66px,13vw,168px);line-height:0.86;color:#15315C;margin-top:14px;animation:ftRise .9s cubic-bezier(.16,1,.3,1) .35s both">Oh my <span style="color:#C99224">Gogh!</span></h1>' +
      '<p class="omg-hero-sub" style="position:relative;z-index:2;font-family:\'Playfair Display\',serif;font-style:italic;font-size:clamp(18px,2.4vw,28px);color:#2C436B;margin-top:18px;max-width:620px;animation:ftRise .9s ease .5s both">Wearable art &amp; studio goods for people who feel in color.</p>' +
      '<div class="omg-hero-cta" style="position:relative;z-index:2;display:flex;flex-wrap:wrap;gap:16px;justify-content:center;margin-top:36px;animation:ftRise .9s ease .65s both">' +
      '<button class="btn-primary" data-act="go" data-view="shop" style="font-family:\'Space Grotesk\',sans-serif;font-size:15px;font-weight:600;letter-spacing:.02em;color:#F3EDDD;background:#15315C;border:none;border-radius:100px;padding:16px 34px;cursor:pointer;box-shadow:0 14px 30px -12px rgba(21,49,92,.7)">Wander the Gallery</button>' +
      '<button class="btn-outline" data-act="go" data-view="about" style="font-family:\'Space Grotesk\',sans-serif;font-size:15px;font-weight:600;letter-spacing:.02em;color:#15315C;background:transparent;border:1.5px solid rgba(21,49,92,.4);border-radius:100px;padding:16px 34px;cursor:pointer">Read our story</button></div>' +
      '<div style="position:absolute;bottom:26px;left:50%;transform:translateX(-50%);font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:rgba(21,49,92,.5);display:flex;flex-direction:column;align-items:center;gap:8px;animation:ftRise 1s ease 1s both">scroll<span style="animation:ftDip 1.8s ease-in-out infinite;font-size:14px">↓</span></div>' +
      '</section>' +
      // marquee
      '<div style="background:#15315C;color:#F3EDDD;overflow:hidden;padding:15px 0;border-top:1px solid rgba(224,169,58,.4);border-bottom:1px solid rgba(224,169,58,.4)">' +
      '<div class="omg-marquee" style="display:flex;white-space:nowrap;width:max-content;animation:ftMarquee 32s linear infinite;font-family:\'Space Mono\',monospace;font-size:14px;letter-spacing:.22em;text-transform:uppercase"><span>' + marquee + '</span><span>' + marquee + '</span></div></div>' +
      // featured
      '<section style="max-width:1280px;margin:0 auto;padding:clamp(70px,9vw,120px) clamp(20px,6vw,70px) clamp(50px,6vw,80px)">' +
      '<div style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:18px;margin-bottom:clamp(40px,5vw,64px)">' +
      '<div><div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#C0561E">Now on the wall</div>' +
      '<h2 style="font-family:\'Playfair Display\',serif;font-size:clamp(34px,5vw,62px);font-weight:800;line-height:1.0;margin-top:10px;max-width:13ch">The Current Hang</h2></div>' +
      '<button class="link-underline" data-act="go" data-view="shop" style="font-family:\'Space Mono\',monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#15315C;background:none;border:none;border-bottom:1.5px solid #E0A93A;padding-bottom:5px;cursor:pointer">View all pieces →</button></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:clamp(24px,4vw,56px);align-items:flex-start;justify-content:center">' + featured + '</div></section>' +
      // categories
      '<section style="max-width:1280px;margin:0 auto;padding:clamp(40px,5vw,70px) clamp(20px,6vw,70px)">' +
      '<div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#C0561E;text-align:center">Find your medium</div>' +
      '<h2 style="font-family:\'Playfair Display\',serif;font-size:clamp(30px,4vw,52px);font-weight:800;text-align:center;margin-top:10px;margin-bottom:clamp(36px,4vw,54px)">Four rooms to wander</h2>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px">' + tiles + '</div></section>' +
      // artist in residence
      '<section style="background:#15315C;color:#F3EDDD;margin-top:clamp(50px,6vw,80px);padding:clamp(60px,8vw,110px) clamp(20px,6vw,70px);position:relative;overflow:hidden">' +
      '<div style="position:absolute;inset:0;background-image:url(\'assets/grain.svg\');background-size:240px;opacity:.08;mix-blend-mode:overlay"></div>' +
      '<div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:clamp(36px,5vw,72px);align-items:center;position:relative">' +
      '<div style="position:relative;justify-self:center;width:min(86%,360px)"><div style="position:absolute;inset:-14px;border:1px solid rgba(224,169,58,.45)"></div>' +
      '<div style="display:block;width:100%;aspect-ratio:4/5;background:linear-gradient(140deg,rgba(46,138,134,.5),rgba(20,42,84,.35)),#dfe6dd"></div></div>' +
      '<div><div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#EBC766">Artist in residence</div>' +
      '<h2 style="font-family:\'Playfair Display\',serif;font-size:clamp(30px,4vw,52px);font-weight:800;line-height:1.05;margin-top:14px">Mira Vance</h2>' +
      '<p style="font-family:\'Yellowtail\',cursive;font-size:clamp(26px,3vw,38px);color:#E0A93A;margin-top:6px;line-height:1.1">“I paint with thread the way Vincent painted with light.”</p>' +
      '<p style="font-size:16px;line-height:1.7;color:rgba(243,237,221,.82);margin-top:18px;max-width:46ch">A textile painter working in dyed wool and raw cotton, Mira built our spring capsule stitch by stitch — every swirl is a single continuous thread.</p>' +
      '<button class="btn-gold" data-act="go" data-view="artists" style="margin-top:26px;font-family:\'Space Grotesk\',sans-serif;font-size:15px;font-weight:600;color:#15315C;background:#E0A93A;border:none;border-radius:100px;padding:14px 30px;cursor:pointer">Meet the collaborators</button></div></div></section>' +
      // manifesto
      '<section style="max-width:1000px;margin:0 auto;padding:clamp(70px,9vw,120px) clamp(20px,6vw,70px);text-align:center">' +
      '<img src="assets/omg-emblem.png" alt="" style="width:74px;height:74px;border-radius:50%;opacity:.95;box-shadow:0 10px 26px -10px rgba(14,35,71,.5)">' +
      '<h2 style="font-family:\'Playfair Display\',serif;font-size:clamp(28px,4.4vw,56px);font-weight:700;line-height:1.18;margin-top:26px;text-wrap:balance">We believe a closet can be a gallery, a tote can be a canvas, and Tuesday is reason enough to wear something loud.</h2>' +
      '<button class="link-underline" data-act="go" data-view="about" style="margin-top:34px;font-family:\'Space Mono\',monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#15315C;background:none;border:none;border-bottom:1.5px solid #E0A93A;padding-bottom:5px;cursor:pointer">The whole story →</button></section>' +
      // newsletter
      '<section style="max-width:1280px;margin:0 auto 30px;padding:0 clamp(20px,6vw,70px)">' +
      '<div style="background:#FBF6EA;border:1px solid rgba(21,49,92,.12);padding:clamp(40px,6vw,80px) clamp(24px,5vw,70px);text-align:center;position:relative;overflow:hidden">' +
      '<div style="position:absolute;top:-40px;right:-30px;width:180px;height:180px;background:radial-gradient(circle,rgba(224,169,58,.4),transparent 70%);filter:blur(6px)"></div>' +
      '<div style="position:absolute;bottom:-50px;left:-40px;width:200px;height:200px;background:radial-gradient(circle,rgba(46,138,134,.32),transparent 70%);filter:blur(6px)"></div>' +
      '<div style="position:relative"><div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#C0561E">No spam, just pigment</div>' +
      '<h2 style="font-family:\'Playfair Display\',serif;font-size:clamp(28px,3.6vw,46px);font-weight:800;margin-top:12px">Join the Atelier</h2>' +
      '<p style="font-size:15px;color:rgba(21,49,92,.7);margin-top:10px;max-width:44ch;margin-left:auto;margin-right:auto">Early drops, artist letters, and the occasional studio mess. One email, twice a month.</p>' +
      news + '</div></div></section>' +
      '</div>';
  }

  function shopView() {
    var cats = ['All', 'Apparel', 'Art Supplies', 'Accessories', 'Books'];
    var pills = cats.map(function (label) {
      var active = state.cat === label;
      var style = 'padding:9px 18px;border-radius:100px;font-family:\'Space Mono\',monospace;font-size:12px;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:all .3s;border:1px solid ' +
        (active ? '#15315C;background:#15315C;color:#F3EDDD' : 'rgba(21,49,92,.25);background:transparent;color:#15315C');
      return '<button data-act="setcat" data-cat="' + esc(label) + '" style="' + style + '">' + label + '</button>';
    }).join('');
    var list = state.cat === 'All' ? products() : products().filter(function (p) { return p.cat === state.cat; });
    var grid = list.map(function (p, i) {
      return productCard(p, { rot: (i % 2 === 0 ? '-0.8deg' : '0.8deg'), quickAdd: true });
    }).join('');

    return '<div style="max-width:1280px;margin:0 auto;padding:clamp(36px,5vw,64px) clamp(20px,6vw,70px) 60px">' +
      '<div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#C0561E">The collection</div>' +
      '<h1 style="font-family:\'Playfair Display\',serif;font-size:clamp(36px,5.5vw,68px);font-weight:800;line-height:1;margin-top:10px">Everything we\'ve painted</h1>' +
      '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:28px;align-items:center">' + pills +
      '<span style="margin-left:auto;font-family:\'Space Mono\',monospace;font-size:12px;color:rgba(21,49,92,.55)">' + list.length + ' pieces</span></div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(258px,1fr));gap:clamp(26px,3vw,48px);margin-top:clamp(34px,4vw,52px)">' + grid + '</div></div>';
  }

  function productView() {
    var p = findProduct(state.pid);
    var hasSizes = p.cat === 'Apparel';
    var sizes = ['S', 'M', 'L', 'XL'].map(function (s) {
      var active = state.size === s;
      var style = 'min-width:48px;height:48px;border-radius:50%;font-family:\'Space Mono\',monospace;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .25s;border:1.5px solid ' +
        (active ? '#15315C;background:#15315C;color:#F3EDDD' : 'rgba(21,49,92,.3);background:#FBF6EA;color:#15315C');
      return '<button data-act="setsize" data-size="' + s + '" style="' + style + '">' + s + '</button>';
    }).join('');
    var thumbs = ['Front', 'Back', 'Detail'].map(function (label) {
      return '<div style="background:#FBF6EA;padding:7px;box-shadow:0 0 0 1px rgba(21,49,92,.1)"><div style="display:block;width:100%;aspect-ratio:1/1;background:' + cardBg(p.tint) + '"></div></div>';
    }).join('');
    var details = [
      { label: 'Materials', text: p.medium + '. Sourced and finished in small batches; slight variation is part of the charm.' },
      { label: 'Shipping', text: 'Ships in 2–4 business days, wrapped in acid-free tissue. Free over $75.' },
      { label: 'Care', text: 'Cold wash inside out, lay flat to dry. Never iron directly over a print.' }
    ].map(function (d) {
      return '<div style="padding:18px 0;border-bottom:1px solid rgba(21,49,92,.14)"><div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#C0561E">' + esc(d.label) + '</div><p style="font-size:14px;line-height:1.6;color:#2C436B;margin-top:6px">' + esc(d.text) + '</p></div>';
    }).join('');
    var related = products().filter(function (x) { return x.id !== p.id; }).slice(0, 3).map(function (x) {
      return '<div class="tile-lift" data-act="open" data-id="' + x.id + '" style="cursor:pointer">' +
        '<div style="position:relative;background:#FBF6EA;padding:12px;box-shadow:0 26px 52px -30px rgba(14,35,71,.5),0 0 0 1px rgba(21,49,92,.1)">' +
        '<div style="position:relative;aspect-ratio:4/5;overflow:hidden;background:' + cardBg(x.tint) + '">' + artLayer(x) + '</div></div>' +
        '<h3 style="font-family:\'Playfair Display\',serif;font-size:18px;font-weight:700;margin-top:12px">' + esc(x.name) + '</h3>' +
        '<span style="font-family:\'Space Mono\',monospace;font-size:14px;color:rgba(21,49,92,.7)">' + fmt(x.price) + '</span></div>';
    }).join('');
    var stockLabel = p.inventory === 0 ? '<span style="font-size:13px;color:#C0561E;font-family:\'Space Mono\',monospace;letter-spacing:.05em">● Sold out</span>'
      : '<span style="font-size:13px;color:#2E8A87;font-family:\'Space Mono\',monospace;letter-spacing:.05em">● In stock</span>';

    return '<div style="max-width:1180px;margin:0 auto;padding:clamp(28px,4vw,48px) clamp(20px,6vw,60px) 60px">' +
      '<button data-act="go" data-view="shop" style="font-family:\'Space Mono\',monospace;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:rgba(21,49,92,.7);background:none;border:none;cursor:pointer;margin-bottom:30px">← Back to the collection</button>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:clamp(36px,5vw,64px);align-items:start">' +
      '<div><div style="position:relative;background:#FBF6EA;padding:16px;box-shadow:0 36px 70px -34px rgba(14,35,71,.55),0 0 0 1px rgba(21,49,92,.1)">' +
      '<div style="position:relative;display:block;width:100%;aspect-ratio:4/5;background:' + cardBg(p.tint) + '">' + artLayer(p) + '</div></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:14px">' + thumbs + '</div></div>' +
      '<div style="padding-top:6px">' +
      '<div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#C0561E">' + esc(p.cat) + ' · ' + esc(p.medium) + '</div>' +
      '<h1 style="font-family:\'Playfair Display\',serif;font-size:clamp(30px,4vw,50px);font-weight:800;line-height:1.05;margin-top:12px">' + esc(p.name) + '</h1>' +
      '<div style="display:flex;align-items:center;gap:14px;margin-top:14px"><span style="font-family:\'Space Mono\',monospace;font-size:26px;color:#15315C">' + fmt(p.price) + '</span>' + stockLabel + '</div>' +
      '<p style="font-size:16px;line-height:1.75;color:#2C436B;margin-top:20px;max-width:48ch">' + esc(p.blurb) + '</p>' +
      (hasSizes ? '<div style="margin-top:28px"><div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:rgba(21,49,92,.6);margin-bottom:12px">Size</div><div style="display:flex;gap:10px;flex-wrap:wrap">' + sizes + '</div></div>' : '') +
      '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:30px">' +
      '<button class="btn-primary" data-act="addcurrent" style="flex:1;min-width:200px;font-family:\'Space Grotesk\',sans-serif;font-size:16px;font-weight:600;color:#F3EDDD;background:#15315C;border:none;border-radius:100px;padding:17px 30px;cursor:pointer;box-shadow:0 14px 30px -12px rgba(21,49,92,.7)">Add to bag — ' + fmt(p.price) + '</button>' +
      '<button class="save-btn" data-act="togglesave" data-id="' + p.id + '" style="font-family:\'Space Grotesk\',sans-serif;font-size:16px;color:#15315C;background:transparent;border:1.5px solid rgba(21,49,92,.35);border-radius:100px;padding:17px 24px;cursor:pointer">' + (state.saved.indexOf(p.id) >= 0 ? '♥ Saved' : '♡ Save') + '</button></div>' +
      '<div style="margin-top:34px;border-top:1px solid rgba(21,49,92,.14)">' + details + '</div>' +
      '<div data-act="openartist" data-name="' + esc(p.artist) + '" style="display:flex;align-items:center;gap:14px;margin-top:24px;padding:16px 18px;background:#FBF6EA;border:1px solid rgba(21,49,92,.12);border-radius:14px;cursor:pointer">' +
      '<img src="assets/omg-emblem.png" alt="" style="width:46px;height:46px;border-radius:50%;flex:none">' +
      '<div style="flex:1"><div style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:rgba(21,49,92,.55)">Made by</div>' +
      '<div style="font-family:\'Playfair Display\',serif;font-size:18px;font-weight:600">' + esc(p.artist) + '</div></div>' +
      (findArtist(p.artist) ? '<span style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#C0561E">View →</span>' : '') +
      '</div>' +
      '</div></div>' +
      '<div style="margin-top:clamp(60px,7vw,96px)"><h2 style="font-family:\'Playfair Display\',serif;font-size:clamp(24px,3vw,36px);font-weight:800;margin-bottom:28px">More from the hang</h2>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:clamp(22px,2.5vw,40px)">' + related + '</div></div></div>';
  }

  function artistsView() {
    var all = artists();
    var feat = all[0];
    var rest = all.slice(1).map(function (a) {
      return '<div data-act="openartist" data-name="' + esc(a.name) + '" style="cursor:pointer">' +
        '<div style="display:block;width:100%;aspect-ratio:1/1;background:' + cardBg(a.tint) + ';box-shadow:0 22px 44px -26px rgba(14,35,71,.45),0 0 0 1px rgba(21,49,92,.1)"></div>' +
        '<h3 style="font-family:\'Playfair Display\',serif;font-size:22px;font-weight:700;margin-top:16px">' + esc(a.name) + '</h3>' +
        '<div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#C0561E;margin-top:3px">' + esc(a.medium) + '</div>' +
        '<p style="font-size:14px;line-height:1.6;color:#2C436B;margin-top:10px">' + esc(a.bioText) + '</p></div>';
    }).join('');

    return '<div style="max-width:1200px;margin:0 auto;padding:clamp(36px,5vw,64px) clamp(20px,6vw,70px) 60px">' +
      '<div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#C0561E">Hands behind the work</div>' +
      '<h1 style="font-family:\'Playfair Display\',serif;font-size:clamp(36px,5.5vw,68px);font-weight:800;line-height:1;margin-top:10px">The Collaborators</h1>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:clamp(36px,5vw,64px);align-items:center;margin-top:clamp(40px,5vw,60px);padding:clamp(28px,4vw,48px);background:#FBF6EA;border:1px solid rgba(21,49,92,.12)">' +
      '<div data-act="openartist" data-name="' + esc(feat.name) + '" style="position:relative;justify-self:center;width:min(82%,320px);cursor:pointer"><div style="display:block;width:100%;aspect-ratio:1/1;background:' + cardBg(feat.tint) + ';box-shadow:0 24px 50px -26px rgba(14,35,71,.5)"></div></div>' +
      '<div><div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#2E8A87">Featured · ' + esc(feat.medium) + '</div>' +
      '<h2 style="font-family:\'Playfair Display\',serif;font-size:clamp(30px,4vw,48px);font-weight:800;margin-top:10px">' + esc(feat.name) + '</h2>' +
      '<p style="font-family:\'Yellowtail\',cursive;font-size:clamp(24px,3vw,34px);color:#C99224;margin-top:4px;line-height:1.1">“' + esc(feat.quote) + '”</p>' +
      '<p style="font-size:16px;line-height:1.75;color:#2C436B;margin-top:18px;max-width:48ch">' + esc(feat.bioText) + '</p>' +
      '<div style="display:flex;gap:18px;margin-top:24px;font-family:\'Space Mono\',monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase">' +
      '<span style="color:rgba(21,49,92,.6)">' + esc(feat.instagram || 'Instagram') + ' ↗</span><span style="color:rgba(21,49,92,.6)">' + esc(feat.portfolio || 'Portfolio') + ' ↗</span></div>' +
      '<button class="btn-primary" data-act="openartist" data-name="' + esc(feat.name) + '" style="margin-top:26px;font-family:\'Space Grotesk\',sans-serif;font-size:15px;font-weight:600;color:#F3EDDD;background:#15315C;border:none;border-radius:100px;padding:14px 30px;cursor:pointer">Shop ' + esc(feat.name.split(' ')[0]) + '\'s pieces</button></div></div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:clamp(24px,3vw,40px);margin-top:clamp(44px,5vw,64px)">' + rest + '</div></div>';
  }

  function artistView() {
    var a = findArtist(state.artistName) || artists()[0];
    if (!a) return notFoundView();
    var pieces = products().filter(function (p) { return p.artist === a.name; });
    var grid = pieces.map(function (p) {
      return '<div class="tile-lift" data-act="open" data-id="' + p.id + '" style="cursor:pointer">' +
        '<div style="position:relative;background:#FBF6EA;padding:12px;box-shadow:0 26px 52px -30px rgba(14,35,71,.5),0 0 0 1px rgba(21,49,92,.1)">' +
        '<div style="position:relative;aspect-ratio:4/5;overflow:hidden;background:' + cardBg(p.tint) + '">' + artLayer(p) + '</div></div>' +
        '<h3 style="font-family:\'Playfair Display\',serif;font-size:19px;font-weight:700;margin-top:13px">' + esc(p.name) + '</h3>' +
        '<span style="font-family:\'Space Mono\',monospace;font-size:14px;color:rgba(21,49,92,.7)">' + fmt(p.price) + '</span></div>';
    }).join('');

    return '<div style="max-width:1180px;margin:0 auto;padding:clamp(28px,4vw,52px) clamp(20px,6vw,60px) 60px">' +
      '<button data-act="go" data-view="artists" style="font-family:\'Space Mono\',monospace;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:rgba(21,49,92,.7);background:none;border:none;cursor:pointer;margin-bottom:26px">← All collaborators</button>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:clamp(36px,5vw,64px);align-items:start">' +
      '<div><div style="display:block;width:100%;aspect-ratio:4/5;background:' + cardBg(a.tint) + ';box-shadow:0 30px 60px -30px rgba(14,35,71,.5)"></div>' +
      '<div style="display:flex;gap:18px;margin-top:18px;font-family:\'Space Mono\',monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:rgba(21,49,92,.6)">' +
      '<span style="color:#15315C">' + esc(a.instagram || 'Instagram') + ' ↗</span><span style="color:#15315C">' + esc(a.portfolio || 'Portfolio') + ' ↗</span></div></div>' +
      '<div><div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#2E8A87">' + esc(a.medium) + ' · ' + esc(a.location) + '</div>' +
      '<h1 style="font-family:\'Playfair Display\',serif;font-size:clamp(34px,5vw,62px);font-weight:800;line-height:1;margin-top:12px">' + esc(a.name) + '</h1>' +
      '<p style="font-family:\'Yellowtail\',cursive;font-size:clamp(26px,3.4vw,40px);color:#C99224;margin-top:10px;line-height:1.15">“' + esc(a.quote) + '”</p>' +
      '<p style="font-size:16px;line-height:1.8;color:#2C436B;margin-top:18px;max-width:52ch">' + esc(a.bioText) + '</p></div></div>' +
      '<div style="margin-top:clamp(54px,6vw,80px)">' +
      '<div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:28px">' +
      '<h2 style="font-family:\'Playfair Display\',serif;font-size:clamp(24px,3vw,38px);font-weight:800">Pieces by ' + esc(a.name.split(' ')[0]) + '</h2>' +
      '<span style="font-family:\'Space Mono\',monospace;font-size:12px;color:rgba(21,49,92,.5)">' + pieces.length + ' in the collection</span></div>' +
      (pieces.length ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:clamp(24px,3vw,44px)">' + grid + '</div>'
        : '<p style="font-size:15px;color:rgba(21,49,92,.6)">No pieces in the shop right now — new work is on the loom.</p>') +
      '</div></div>';
  }

  function journalView() {
    var posts = journal();
    var feat = posts[0];
    var rest = posts.slice(1).map(function (p) {
      return '<div data-act="article" data-id="' + p.id + '" style="cursor:pointer">' +
        '<div style="display:block;width:100%;aspect-ratio:4/3;background:' + cardBg(p.tint) + ';box-shadow:0 22px 44px -28px rgba(14,35,71,.45),0 0 0 1px rgba(21,49,92,.1)"></div>' +
        '<div style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#2E8A87;margin-top:14px">' + esc(p.cat) + ' · ' + esc(p.read_time) + '</div>' +
        '<h3 style="font-family:\'Playfair Display\',serif;font-size:21px;font-weight:700;line-height:1.18;margin-top:8px">' + esc(p.title) + '</h3>' +
        '<p style="font-size:14px;line-height:1.6;color:#2C436B;margin-top:8px">' + esc(p.excerpt) + '</p></div>';
    }).join('');

    return '<div style="max-width:1200px;margin:0 auto;padding:clamp(36px,5vw,64px) clamp(20px,6vw,70px) 60px">' +
      '<div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#C0561E">Words &amp; pigment</div>' +
      '<h1 style="font-family:\'Playfair Display\',serif;font-size:clamp(36px,5.5vw,68px);font-weight:800;line-height:1;margin-top:10px">The Journal</h1>' +
      (feat ? '<div data-act="article" data-id="' + feat.id + '" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:clamp(30px,4vw,56px);align-items:center;margin-top:clamp(40px,5vw,58px);cursor:pointer">' +
        '<div style="display:block;width:100%;aspect-ratio:5/4;background:' + cardBg(feat.tint) + ';box-shadow:0 30px 60px -32px rgba(14,35,71,.5)"></div>' +
        '<div><div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#2E8A87">' + esc(feat.cat) + ' · ' + esc(feat.read_time) + '</div>' +
        '<h2 style="font-family:\'Playfair Display\',serif;font-size:clamp(28px,3.6vw,46px);font-weight:800;line-height:1.1;margin-top:12px">' + esc(feat.title) + '</h2>' +
        '<p style="font-size:16px;line-height:1.75;color:#2C436B;margin-top:16px;max-width:46ch">' + esc(feat.excerpt) + '</p>' +
        '<span style="display:inline-block;margin-top:20px;font-family:\'Space Mono\',monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#15315C;border-bottom:1.5px solid #E0A93A;padding-bottom:5px">Read the piece →</span></div></div>' : '') +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:clamp(28px,3vw,44px);margin-top:clamp(50px,6vw,72px);border-top:1px solid rgba(21,49,92,.14);padding-top:clamp(40px,5vw,56px)">' + rest + '</div></div>';
  }

  function articleView() {
    var p = null, list = store.journal;
    for (var i = 0; i < list.length; i++) if (list[i].id === state.articleId) p = list[i];
    if (!p) { return journalView(); }
    var body = String(p.bodyText || '').split('\n').filter(function (s) { return s.trim(); })
      .map(function (para) { return '<p style="font-size:17px;line-height:1.85;color:#2C436B;margin-top:20px">' + esc(para) + '</p>'; }).join('');

    return '<div style="max-width:760px;margin:0 auto;padding:clamp(36px,5vw,64px) clamp(20px,6vw,40px) 60px">' +
      '<button data-act="go" data-view="journal" style="font-family:\'Space Mono\',monospace;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:rgba(21,49,92,.7);background:none;border:none;cursor:pointer;margin-bottom:30px">← Back to the journal</button>' +
      '<div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#2E8A87">' + esc(p.cat) + ' · ' + esc(p.read_time) + '</div>' +
      '<h1 style="font-family:\'Playfair Display\',serif;font-size:clamp(32px,5vw,56px);font-weight:800;line-height:1.08;margin-top:12px;text-wrap:balance">' + esc(p.title) + '</h1>' +
      '<div style="font-size:13px;color:rgba(21,49,92,.55);margin-top:14px">By ' + esc(p.author) + ' · ' + esc(p.date) + '</div>' +
      '<div style="width:100%;aspect-ratio:16/9;margin-top:28px;background:' + cardBg(p.tint) + ';box-shadow:0 30px 60px -32px rgba(14,35,71,.5)"></div>' +
      '<div style="margin-top:8px">' + body + '</div>' +
      '<div style="margin-top:40px;padding-top:24px;border-top:1px solid rgba(21,49,92,.14)"><button class="link-underline" data-act="go" data-view="shop" style="font-family:\'Space Mono\',monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#15315C;background:none;border:none;border-bottom:1.5px solid #E0A93A;padding-bottom:5px;cursor:pointer">Shop the collection →</button></div></div>';
  }

  function aboutView() {
    var values = [
      { title: 'Real artists, real cuts', text: 'Every drop is a true collaboration. Artists are credited, paid fairly, and involved start to finish.', color: '#E0A93A' },
      { title: 'Made to be worn out', text: 'Heavyweight fabrics, honest printing, no fast-fashion shortcuts. Pieces that age like a favorite jacket.', color: '#2E8A87' },
      { title: 'Color without apology', text: 'We will never make the beige version. If it does not make you a little happy, it does not ship.', color: '#C0561E' }
    ].map(function (v) {
      return '<div><div style="width:46px;height:46px;border-radius:46% 54% 56% 44%/52% 48% 52% 48%;background:' + v.color + ';box-shadow:0 6px 16px -6px rgba(14,35,71,.5)"></div>' +
        '<h3 style="font-family:\'Playfair Display\',serif;font-size:24px;font-weight:700;margin-top:18px">' + esc(v.title) + '</h3>' +
        '<p style="font-size:15px;line-height:1.7;color:#2C436B;margin-top:8px">' + esc(v.text) + '</p></div>';
    }).join('');

    return '<div>' +
      '<section style="max-width:920px;margin:0 auto;padding:clamp(50px,7vw,96px) clamp(20px,6vw,60px) clamp(30px,4vw,50px);text-align:center">' +
      '<div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#C0561E">Our story</div>' +
      '<h1 style="font-family:\'Playfair Display\',serif;font-size:clamp(34px,5.5vw,72px);font-weight:800;line-height:1.04;margin-top:14px;text-wrap:balance">It started as a pun. It became a wardrobe.</h1>' +
      '<p style="font-size:17px;line-height:1.8;color:#2C436B;margin-top:24px;max-width:60ch;margin-left:auto;margin-right:auto">Oh my Gogh! began with a single screen-printed tee and a terrible, wonderful joke. The joke stuck. So did the idea behind it: that the masterpieces hanging behind glass were never meant to stay there — they were meant to be lived in.</p></section>' +
      '<section style="max-width:1100px;margin:0 auto;padding:0 clamp(20px,6vw,60px)"><div style="background:#FBF6EA;border:1px solid rgba(21,49,92,.12);padding:clamp(20px,3vw,36px);box-shadow:0 30px 60px -36px rgba(14,35,71,.4)">' +
      '<img src="assets/omg-logo.png" alt="Oh my Gogh! — Art Lifestyle Brand" style="display:block;width:100%;height:auto;mix-blend-mode:multiply"></div></section>' +
      '<section style="max-width:1100px;margin:0 auto;padding:clamp(50px,6vw,84px) clamp(20px,6vw,60px)"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:clamp(28px,4vw,48px)">' + values + '</div></section>' +
      '<section style="background:#15315C;color:#F3EDDD;padding:clamp(56px,7vw,96px) clamp(20px,6vw,60px);text-align:center;position:relative;overflow:hidden">' +
      '<div style="position:absolute;inset:0;background-image:url(\'assets/grain.svg\');background-size:240px;opacity:.08;mix-blend-mode:overlay"></div>' +
      '<h2 style="font-family:\'Playfair Display\',serif;font-size:clamp(26px,3.6vw,44px);font-weight:700;position:relative;max-width:24ch;margin:0 auto;line-height:1.2">Ready to wear something worth framing?</h2>' +
      '<button class="btn-gold" data-act="go" data-view="shop" style="margin-top:30px;font-family:\'Space Grotesk\',sans-serif;font-size:16px;font-weight:600;color:#15315C;background:#E0A93A;border:none;border-radius:100px;padding:16px 36px;cursor:pointer;position:relative">Shop the collection</button></section></div>';
  }

  function cartView() {
    if (state.cart.length === 0) {
      return '<div style="max-width:1100px;margin:0 auto;padding:clamp(36px,5vw,64px) clamp(20px,6vw,60px) 70px">' +
        '<div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#C0561E">Your studio bag</div>' +
        '<h1 style="font-family:\'Playfair Display\',serif;font-size:clamp(34px,5vw,60px);font-weight:800;line-height:1;margin-top:10px;margin-bottom:clamp(30px,4vw,44px)">The Bag</h1>' +
        '<div style="text-align:center;padding:clamp(40px,7vw,90px) 0"><img src="assets/omg-emblem.png" alt="" style="width:90px;height:90px;border-radius:50%;opacity:.9;animation:ftFloat 6s ease-in-out infinite">' +
        '<h2 style="font-family:\'Playfair Display\',serif;font-size:clamp(24px,3vw,34px);font-weight:700;margin-top:24px">Your bag is a blank canvas.</h2>' +
        '<p style="font-size:15px;color:rgba(21,49,92,.65);margin-top:8px">Nothing in it yet — let\'s fix that.</p>' +
        '<button class="btn-primary" data-act="go" data-view="shop" style="margin-top:26px;font-family:\'Space Grotesk\',sans-serif;font-size:15px;font-weight:600;color:#F3EDDD;background:#15315C;border:none;border-radius:100px;padding:15px 32px;cursor:pointer">Start the collection</button></div></div>';
    }
    var t = cartTotals();
    var lines = state.cart.map(function (c) {
      return '<div style="display:flex;gap:18px;padding:18px 0;border-bottom:1px solid rgba(21,49,92,.14)">' +
        '<div style="width:92px;height:115px;flex:none;background:' + cardBg(c.tint) + ';box-shadow:0 0 0 1px rgba(21,49,92,.1);position:relative;overflow:hidden"><div style="position:absolute;inset:0;background-image:url(\'assets/grain.svg\');background-size:160px;opacity:.14;mix-blend-mode:multiply"></div></div>' +
        '<div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;gap:12px"><h3 style="font-family:\'Playfair Display\',serif;font-size:19px;font-weight:700">' + esc(c.name) + '</h3><span style="font-family:\'Space Mono\',monospace;font-size:16px;white-space:nowrap">' + fmt(c.price * c.qty) + '</span></div>' +
        '<div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(21,49,92,.55);margin-top:5px">' + esc(c.cat) + ' · Size ' + esc(c.size) + '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;gap:12px">' +
        '<div style="display:flex;align-items:center;gap:14px;border:1px solid rgba(21,49,92,.22);border-radius:100px;padding:5px 12px">' +
        '<button data-act="qty" data-id="' + c.id + '" data-size="' + esc(c.size) + '" data-d="-1" style="background:none;border:none;cursor:pointer;font-size:18px;color:#15315C;line-height:1">−</button>' +
        '<span style="font-family:\'Space Mono\',monospace;font-size:14px;min-width:16px;text-align:center">' + c.qty + '</span>' +
        '<button data-act="qty" data-id="' + c.id + '" data-size="' + esc(c.size) + '" data-d="1" style="background:none;border:none;cursor:pointer;font-size:18px;color:#15315C;line-height:1">+</button></div>' +
        '<button data-act="removeline" data-id="' + c.id + '" data-size="' + esc(c.size) + '" style="background:none;border:none;cursor:pointer;font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#C0561E">Remove</button></div></div></div>';
    }).join('');

    var promoRow = state.promoOk ? '<div style="display:flex;justify-content:space-between;font-size:14px;padding:8px 0;color:#2E8A87"><span>Discount (STARRY)</span><span style="font-family:\'Space Mono\',monospace">−' + fmt(t.discount) + '</span></div>' : '';

    return '<div style="max-width:1100px;margin:0 auto;padding:clamp(36px,5vw,64px) clamp(20px,6vw,60px) 70px">' +
      '<div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#C0561E">Your studio bag</div>' +
      '<h1 style="font-family:\'Playfair Display\',serif;font-size:clamp(34px,5vw,60px);font-weight:800;line-height:1;margin-top:10px;margin-bottom:clamp(30px,4vw,44px)">The Bag</h1>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:clamp(32px,4vw,56px);align-items:start">' +
      '<div>' + lines + '<button class="link-underline" data-act="go" data-view="shop" style="margin-top:24px;font-family:\'Space Mono\',monospace;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#15315C;background:none;border:none;border-bottom:1.5px solid #E0A93A;padding-bottom:5px;cursor:pointer">← Keep wandering</button></div>' +
      '<div style="background:#FBF6EA;border:1px solid rgba(21,49,92,.12);padding:clamp(24px,3vw,32px);position:sticky;top:90px">' +
      '<h2 style="font-family:\'Playfair Display\',serif;font-size:24px;font-weight:800;margin-bottom:18px">Order summary</h2>' +
      '<div style="display:flex;justify-content:space-between;font-size:14px;padding:8px 0;color:#2C436B"><span>Subtotal</span><span style="font-family:\'Space Mono\',monospace">' + fmt(t.subtotal) + '</span></div>' + promoRow +
      '<div style="display:flex;justify-content:space-between;font-size:14px;padding:8px 0;color:#2C436B;border-bottom:1px solid rgba(21,49,92,.14)"><span>Shipping</span><span style="font-family:\'Space Mono\',monospace">' + (t.shipping === 0 ? 'Free' : fmt(t.shipping)) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;padding:16px 0 4px"><span style="font-family:\'Playfair Display\',serif;font-size:20px;font-weight:700">Total</span><span style="font-family:\'Space Mono\',monospace;font-size:24px;color:#15315C">' + fmt(t.total) + '</span></div>' +
      '<form data-act="applypromo" style="display:flex;gap:8px;margin-top:18px">' +
      '<input name="promo" value="' + esc(state.promo) + '" placeholder="Promo code" style="flex:1;min-width:0;font-family:\'Space Mono\',monospace;font-size:13px;color:#15315C;background:#F3EDDD;border:1.5px solid rgba(21,49,92,.22);border-radius:100px;padding:11px 18px;outline:none">' +
      '<button type="submit" style="font-family:\'Space Grotesk\',sans-serif;font-size:13px;font-weight:600;color:#15315C;background:transparent;border:1.5px solid rgba(21,49,92,.35);border-radius:100px;padding:11px 18px;cursor:pointer">Apply</button></form>' +
      '<p style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.06em;color:rgba(21,49,92,.45);margin-top:8px">Try code STARRY for 15% off</p>' +
      '<button class="btn-primary" data-act="go" data-view="checkout" style="width:100%;margin-top:20px;font-family:\'Space Grotesk\',sans-serif;font-size:16px;font-weight:600;color:#F3EDDD;background:#15315C;border:none;border-radius:100px;padding:17px;cursor:pointer;box-shadow:0 14px 30px -12px rgba(21,49,92,.7)">Checkout · ' + fmt(t.total) + '</button>' +
      '<p style="text-align:center;font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.1em;color:rgba(21,49,92,.45);margin-top:12px">Secure checkout · Free returns within 30 days</p></div></div></div>';
  }

  function checkoutView() {
    if (state.cart.length === 0) return cartView();
    var t = cartTotals();
    var co = state.co;
    var step = state.checkoutStep;

    var stepMarks = ['Contact', 'Shipping', 'Payment'].map(function (label, i) {
      var n = i + 1, done = n < step, active = n === step;
      var border = (done || active) ? '#15315C' : 'rgba(21,49,92,.3)';
      var bg = done ? '#15315C' : (active ? '#E0A93A' : 'transparent');
      var color = done ? '#F3EDDD' : (active ? '#15315C' : 'rgba(21,49,92,.5)');
      var labelColor = (done || active) ? '#15315C' : 'rgba(21,49,92,.5)';
      var mark = done ? '✓' : String(n);
      return '<div style="display:flex;align-items:center;gap:10px">' +
        '<span style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:\'Space Mono\',monospace;font-size:13px;font-weight:700;border:1.5px solid ' + border + ';background:' + bg + ';color:' + color + '">' + mark + '</span>' +
        '<span style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:' + labelColor + '">' + label + '</span>' +
        (i < 2 ? '<span style="width:clamp(18px,5vw,56px);height:1.5px;background:rgba(21,49,92,.2)"></span>' : '') + '</div>';
    }).join('');

    var field = function (name, label, ph, val, type, half) {
      return '<label style="display:block;' + (half ? 'flex:1;min-width:140px' : '') + '"><span style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(21,49,92,.55)">' + label + '</span>' +
        '<input name="' + name + '" type="' + (type || 'text') + '" value="' + esc(val || '') + '" placeholder="' + ph + '" style="width:100%;margin-top:6px;font-size:15px;color:#15315C;background:#FBF6EA;border:1.5px solid rgba(21,49,92,.2);border-radius:12px;padding:13px 15px;outline:none"></label>';
    };

    var stepBody;
    if (step === 1) {
      stepBody = '<h2 style="font-family:\'Playfair Display\',serif;font-size:clamp(24px,3vw,34px);font-weight:800;margin-bottom:6px">Contact</h2>' +
        '<p style="font-size:14px;color:rgba(21,49,92,.6);margin-bottom:22px">Where should we send your confirmation?</p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">' +
        '<div style="grid-column:span 2">' + field('email', 'Email', 'you@studio.com', co.email, 'email') + '</div>' +
        field('first', 'First name', '', co.first) + field('last', 'Last name', '', co.last) + '</div>';
    } else if (step === 2) {
      var standardFree = (t.subtotal - t.discount) >= shipFreeOver;
      var shipOpts = [
        { k: 'standard', label: 'Studio Standard', eta: '5–7 business days', priceTxt: standardFree ? 'Free' : fmt(shipFlat) },
        { k: 'express', label: 'Express', eta: '2–3 business days', priceTxt: fmt(EXPRESS_SHIPPING) }
      ].map(function (o) {
        var active = co.ship === o.k;
        return '<button data-act="setship" data-ship="' + o.k + '" style="display:flex;align-items:center;justify-content:space-between;gap:14px;width:100%;text-align:left;cursor:pointer;border-radius:14px;padding:14px 18px;background:#FBF6EA;border:1.5px solid ' + (active ? '#15315C' : 'rgba(21,49,92,.18)') + '">' +
          '<span style="text-align:left"><span style="font-weight:600">' + o.label + '</span><span style="display:block;font-size:12px;color:rgba(21,49,92,.55);margin-top:2px">' + o.eta + '</span></span>' +
          '<span style="font-family:\'Space Mono\',monospace">' + o.priceTxt + '</span></button>';
      }).join('');
      stepBody = '<h2 style="font-family:\'Playfair Display\',serif;font-size:clamp(24px,3vw,34px);font-weight:800;margin-bottom:6px">Shipping address</h2>' +
        '<p style="font-size:14px;color:rgba(21,49,92,.6);margin-bottom:22px">Where are we sending the paint?</p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">' +
        '<div style="grid-column:span 2">' + field('address', 'Street address', '', co.address) + '</div>' +
        field('apt', 'Apt / unit', '', co.apt) + field('city', 'City', '', co.city) +
        field('zip', 'ZIP / Postal', '', co.zip) + field('country', 'Country', 'United States', co.country) + '</div>' +
        '<div style="margin-top:22px"><span style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(21,49,92,.55)">Delivery</span>' +
        '<div style="display:flex;flex-direction:column;gap:10px;margin-top:11px">' + shipOpts + '</div></div>';
    } else {
      stepBody = '<h2 style="font-family:\'Playfair Display\',serif;font-size:clamp(24px,3vw,34px);font-weight:800;margin-bottom:6px">Payment</h2>' +
        '<p style="font-size:14px;color:rgba(21,49,92,.6);margin-bottom:22px">All transactions are secure and encrypted.</p>' +
        '<div style="background:#FBF6EA;border:1px solid rgba(21,49,92,.12);border-radius:16px;padding:22px">' +
        '<p style="font-size:14px;line-height:1.7;color:#2C436B">' + (paymentsLive ? 'Pay securely with Razorpay — UPI, cards and netbanking. A Razorpay window will open when you place your order.' : 'Preview mode — live payment turns on once Razorpay keys are configured. Placing the order will simulate a completed purchase.') + '</p></div>';
    }

    var summaryLines = state.cart.map(function (c) {
      return '<div style="display:flex;gap:12px;align-items:center"><div style="width:46px;height:58px;flex:none;background:' + cardBg(c.tint) + ';box-shadow:0 0 0 1px rgba(21,49,92,.1)"></div>' +
        '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(c.name) + '</div><div style="font-family:\'Space Mono\',monospace;font-size:11px;color:rgba(21,49,92,.5)">Qty ' + c.qty + ' · ' + esc(c.size) + '</div></div>' +
        '<span style="font-family:\'Space Mono\',monospace;font-size:13px">' + fmt(c.price * c.qty) + '</span></div>';
    }).join('');

    var cta = step >= 3 ? ('Pay ' + fmt(t.total)) : 'Continue';

    return '<div style="max-width:1080px;margin:0 auto;padding:clamp(28px,4vw,56px) clamp(20px,6vw,60px) 70px">' +
      '<button data-act="go" data-view="cart" style="font-family:\'Space Mono\',monospace;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:rgba(21,49,92,.7);background:none;border:none;cursor:pointer;margin-bottom:24px">← Back to bag</button>' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:clamp(26px,4vw,40px)">' + stepMarks + '</div>' +
      '<div data-checkout-form style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:clamp(30px,4vw,52px);align-items:start">' +
      '<div>' + stepBody +
      '<div style="display:flex;align-items:center;gap:18px;margin-top:28px;flex-wrap:wrap">' +
      '<button class="btn-primary" data-act="checkoutnext" style="font-family:\'Space Grotesk\',sans-serif;font-size:16px;font-weight:600;color:#F3EDDD;background:#15315C;border:none;border-radius:100px;padding:16px 36px;cursor:pointer;box-shadow:0 14px 30px -12px rgba(21,49,92,.7)">' + cta + '</button>' +
      (step > 1 ? '<button data-act="checkoutback" style="font-family:\'Space Mono\',monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:rgba(21,49,92,.6);background:none;border:none;cursor:pointer">← Back</button>' : '') +
      '</div></div>' +
      '<div style="background:#FBF6EA;border:1px solid rgba(21,49,92,.12);padding:clamp(22px,3vw,30px);position:sticky;top:90px">' +
      '<h2 style="font-family:\'Playfair Display\',serif;font-size:20px;font-weight:800;margin-bottom:18px">Order summary</h2>' +
      '<div style="display:flex;flex-direction:column;gap:14px;margin-bottom:16px">' + summaryLines + '</div>' +
      '<div style="border-top:1px solid rgba(21,49,92,.14);padding-top:12px">' +
      '<div style="display:flex;justify-content:space-between;font-size:14px;padding:6px 0;color:#2C436B"><span>Subtotal</span><span style="font-family:\'Space Mono\',monospace">' + fmt(t.subtotal) + '</span></div>' +
      (state.promoOk ? '<div style="display:flex;justify-content:space-between;font-size:14px;padding:6px 0;color:#2E8A87"><span>Discount</span><span style="font-family:\'Space Mono\',monospace">−' + fmt(t.discount) + '</span></div>' : '') +
      '<div style="display:flex;justify-content:space-between;font-size:14px;padding:6px 0;color:#2C436B"><span>Shipping</span><span style="font-family:\'Space Mono\',monospace">' + (t.shipping === 0 ? 'Free' : fmt(t.shipping)) + '</span></div></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;padding:14px 0 0;border-top:1px solid rgba(21,49,92,.14);margin-top:6px"><span style="font-family:\'Playfair Display\',serif;font-size:19px;font-weight:700">Total</span><span style="font-family:\'Space Mono\',monospace;font-size:22px;color:#15315C">' + fmt(t.total) + '</span></div>' +
      '<p style="text-align:center;font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.1em;color:rgba(21,49,92,.45);margin-top:16px">Secure checkout · Free returns within 30 days</p></div></div></div>';
  }

  function confirmView() {
    return '<div style="max-width:680px;margin:0 auto;padding:clamp(60px,9vw,130px) clamp(20px,6vw,40px);text-align:center;min-height:60vh">' +
      '<img src="assets/omg-emblem.png" alt="" style="width:104px;height:104px;border-radius:50%;box-shadow:0 18px 44px -16px rgba(14,35,71,.5);animation:ftBob 7s ease-in-out infinite">' +
      '<div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#2E8A87;margin-top:30px">Order placed</div>' +
      '<h1 style="font-family:\'Playfair Display\',serif;font-size:clamp(32px,5vw,56px);font-weight:800;line-height:1.05;margin-top:12px">Oh my Gogh — it\'s on its way!</h1>' +
      '<p style="font-size:16px;line-height:1.7;color:#2C436B;margin-top:18px;max-width:46ch;margin-left:auto;margin-right:auto">We\'re wrapping your pieces in acid-free tissue and a thank-you note. A confirmation is headed to your inbox.</p>' +
      '<div style="display:inline-block;margin-top:26px;font-family:\'Space Mono\',monospace;font-size:14px;letter-spacing:.1em;color:#15315C;background:#FBF6EA;border:1px dashed rgba(21,49,92,.3);border-radius:100px;padding:12px 26px">Order ' + esc(state.orderNo || 'OMG-000000') + '</div>' +
      '<div style="margin-top:34px"><button class="btn-primary" data-act="go" data-view="shop" style="font-family:\'Space Grotesk\',sans-serif;font-size:15px;font-weight:600;color:#F3EDDD;background:#15315C;border:none;border-radius:100px;padding:15px 34px;cursor:pointer">Continue wandering</button></div></div>';
  }

  // ===================================================================
  //  INFO HUB (shipping / size guide / FAQ / contact / legal)
  // ===================================================================
  var INFO_CONTENT = {
    shipping: { kind: 'doc', eyebrow: 'Support', title: 'Shipping & Returns', intro: 'Everything ships from the studio, wrapped in acid-free tissue with a hand-written note.', sections: [
      ['Processing', 'Orders are packed within 2–4 business days. You’ll get a tracking link the moment your piece leaves the studio.'],
      ['Rates', 'Free shipping on orders over $75, a flat $8 otherwise. International rates are calculated at checkout.'],
      ['Returns', 'Unworn pieces can come home within 30 days for a full refund. Originals and final-sale items are noted on their product page.'],
      ['Exchanges', 'Wrong size? Email us and we’ll cross-ship the right one as soon as the first is on its way back.']
    ] },
    sizeguide: { kind: 'doc', eyebrow: 'Support', title: 'Size Guide', intro: 'Our apparel runs true to size with a relaxed, lived-in cut. Between sizes? Size down for a classic fit.', sections: [
      ['Tees', 'S 34–36" · M 38–40" · L 42–44" · XL 46–48" (chest). Body length runs long by about an inch.'],
      ['Hoodies', 'Cut for layering. Take your normal size for room, or size down for a trim fit.'],
      ['One-size pieces', 'Totes, beanies and accessories are one size. Beanies are hand-knit with generous stretch.'],
      ['Still unsure?', 'Email parth@ohmygogh.com with your measurements and we’ll point you to the right fit.']
    ] },
    faq: { kind: 'faq', eyebrow: 'Support', title: 'Frequently Asked', intro: 'The things people ask us most, answered straight.', qa: [
      ['When will my order ship?', 'Within 2–4 business days. You’ll get tracking as soon as it leaves the studio.'],
      ['Do you ship internationally?', 'Yes, worldwide. Duties and international rates are shown at checkout.'],
      ['Are the artists really paid?', 'Every collaborator is credited and paid a fair share of each piece they design. It’s the whole point.'],
      ['How do I care for a printed piece?', 'Cold wash inside out, lay flat to dry, and never iron directly over a print.'],
      ['Can I return something?', 'Unworn pieces within 30 days, no questions. Originals and final-sale items are marked.'],
      ['Do you restock sold-out drops?', 'Sometimes. Join the Atelier list and we’ll tell you before anyone else.']
    ] },
    contact: { kind: 'contact', eyebrow: 'Say hello', title: 'Contact the Studio', intro: 'Questions, collaborations, or just want to talk paint? We read every note.', details: [
      ['Email', 'parth@ohmygogh.com'], ['Studio', '14 Atelier Lane, Arles, France'], ['Hours', 'Mon–Fri, 9–6 CET'], ['Social', 'Instagram · Pinterest · TikTok']
    ] },
    privacy: { kind: 'doc', eyebrow: 'Legal', title: 'Privacy Policy', intro: 'We collect as little as we can, and we never sell it. Here’s the plain version.', sections: [
      ['What we collect', 'The details you give us at checkout and account sign-up, plus basic analytics about how the site is used.'],
      ['How we use it', 'To fulfill orders, answer your questions, and — only if you opt in — send the occasional studio letter.'],
      ['Your choices', 'You can unsubscribe any time and ask us to delete your account data by emailing the studio.'],
      ['Contact', 'Privacy questions go to parth@ohmygogh.com and we’ll answer within a few days.']
    ] },
    terms: { kind: 'doc', eyebrow: 'Legal', title: 'Terms of Service', intro: 'The short, human version of the rules for using this shop.', sections: [
      ['Using the site', 'Browse, shop, and share freely. Don’t scrape, resell, or misuse the artwork or imagery.'],
      ['Orders & pricing', 'Prices may change. We may cancel an order if a piece is mispriced or sells out, with a full refund.'],
      ['Intellectual property', 'Artwork remains the property of its artist and Oh my Gogh!. Buying a piece doesn’t transfer those rights.'],
      ['Liability', 'We make things with care, but we’re not liable for indirect damages beyond the value of your order.']
    ] },
    accessibility: { kind: 'doc', eyebrow: 'Legal', title: 'Accessibility', intro: 'Color should be for everyone. We’re working to keep this shop usable for all.', sections: [
      ['Our commitment', 'We aim for WCAG 2.1 AA: readable contrast, keyboard navigation, and clear labels throughout.'],
      ['What we’ve done', 'Semantic structure, focus styles, alt text on imagery, and motion that respects reduced-motion settings.'],
      ['Known gaps', 'Some richly illustrated pages are still being audited. We fix issues as we find them.'],
      ['Tell us', 'Hit a barrier? Email parth@ohmygogh.com and we’ll prioritise a fix.']
    ] }
  };

  function infoView() {
    var info = INFO_CONTENT[state.infoKey] || INFO_CONTENT.shipping;
    var body = '';
    if (info.kind === 'doc') {
      body = info.sections.map(function (s) {
        return '<div style="padding:22px 0;border-top:1px solid rgba(21,49,92,.14)"><h2 style="font-family:\'Playfair Display\',serif;font-size:clamp(20px,2.6vw,26px);font-weight:700">' + esc(s[0]) + '</h2><p style="font-size:16px;line-height:1.8;color:#2C436B;margin-top:8px">' + esc(s[1]) + '</p></div>';
      }).join('');
      body = '<div style="margin-top:clamp(28px,4vw,44px)">' + body + '</div>';
    } else if (info.kind === 'faq') {
      body = '<div style="margin-top:clamp(28px,4vw,44px)">' + info.qa.map(function (q) {
        return '<div style="padding:22px 0;border-top:1px solid rgba(21,49,92,.14)"><h2 style="font-family:\'Playfair Display\',serif;font-size:clamp(18px,2.4vw,23px);font-weight:700">' + esc(q[0]) + '</h2><p style="font-size:16px;line-height:1.8;color:#2C436B;margin-top:8px">' + esc(q[1]) + '</p></div>';
      }).join('') + '</div>';
    } else if (info.kind === 'contact') {
      var details = info.details.map(function (d) {
        return '<div style="margin-bottom:20px"><div style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#2E8A87">' + esc(d[0]) + '</div><div style="font-size:16px;color:#15315C;margin-top:5px;line-height:1.6">' + esc(d[1]) + '</div></div>';
      }).join('');
      var right = state.contactSent
        ? '<div style="background:#FBF6EA;border:1px solid rgba(21,49,92,.12);border-radius:16px;padding:28px;text-align:center"><p style="font-family:\'Yellowtail\',cursive;font-size:32px;color:#2E8A87">Thanks — we\'ll be in touch.</p></div>'
        : '<form data-act="contact" style="display:flex;flex-direction:column;gap:13px">' +
          '<input name="name" required placeholder="Your name" style="font-size:15px;color:#15315C;background:#FBF6EA;border:1.5px solid rgba(21,49,92,.2);border-radius:12px;padding:13px 15px;outline:none">' +
          '<input name="email" required type="email" placeholder="Email" style="font-size:15px;color:#15315C;background:#FBF6EA;border:1.5px solid rgba(21,49,92,.2);border-radius:12px;padding:13px 15px;outline:none">' +
          '<textarea name="message" required rows="4" placeholder="How can we help?" style="font-size:15px;line-height:1.5;color:#15315C;background:#FBF6EA;border:1.5px solid rgba(21,49,92,.2);border-radius:12px;padding:13px 15px;outline:none;resize:vertical;font-family:\'Space Grotesk\',sans-serif"></textarea>' +
          '<button class="btn-primary" type="submit" style="font-family:\'Space Grotesk\',sans-serif;font-size:15px;font-weight:600;color:#F3EDDD;background:#15315C;border:none;border-radius:100px;padding:14px;cursor:pointer">Send message</button></form>';
      body = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:clamp(28px,4vw,48px);margin-top:clamp(30px,4vw,46px)"><div>' + details + '</div><div>' + right + '</div></div>';
    }

    return '<div style="max-width:760px;margin:0 auto;padding:clamp(40px,6vw,80px) clamp(20px,6vw,40px) 60px">' +
      '<div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#C0561E">' + esc(info.eyebrow) + '</div>' +
      '<h1 style="font-family:\'Playfair Display\',serif;font-size:clamp(34px,5.5vw,64px);font-weight:800;line-height:1.03;margin-top:12px;text-wrap:balance">' + esc(info.title) + '</h1>' +
      '<p style="font-size:17px;line-height:1.8;color:#2C436B;margin-top:18px;max-width:60ch">' + esc(info.intro) + '</p>' +
      body + '</div>';
  }

  // ===================================================================
  //  SEARCH
  // ===================================================================
  function searchView() {
    var q = state.searchQ.trim().toLowerCase();
    var hasSearch = q.length > 0;
    var spRaw = hasSearch ? products().filter(function (p) { return (p.name + ' ' + p.cat + ' ' + p.artist + ' ' + p.medium + ' ' + p.blurb).toLowerCase().indexOf(q) >= 0; }) : [];
    var saRaw = hasSearch ? artists().filter(function (a) { return (a.name + ' ' + a.medium).toLowerCase().indexOf(q) >= 0; }) : [];
    var arRaw = hasSearch ? journal().filter(function (a) { return (a.title + ' ' + a.cat + ' ' + a.excerpt).toLowerCase().indexOf(q) >= 0; }) : [];
    var total = spRaw.length + saRaw.length + arRaw.length;

    var suggestions = ['Tees', 'Totes', 'Mira Vance', 'Chrome yellow', 'Sunflower'].map(function (s) {
      return '<button data-act="searchpick" data-q="' + esc(s) + '" style="font-family:\'Space Mono\',monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#15315C;background:transparent;border:1px solid rgba(21,49,92,.25);border-radius:100px;padding:9px 16px;cursor:pointer">' + s + '</button>';
    }).join('');

    var results = '';
    if (hasSearch) {
      var prodGrid = spRaw.length ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:clamp(22px,3vw,40px)">' + spRaw.map(function (p) {
        return '<div class="tile-lift" data-act="open" data-id="' + p.id + '" style="cursor:pointer"><div style="position:relative;background:#FBF6EA;padding:12px;box-shadow:0 26px 52px -30px rgba(14,35,71,.5),0 0 0 1px rgba(21,49,92,.1)"><div style="position:relative;aspect-ratio:4/5;overflow:hidden;background:' + cardBg(p.tint) + '">' + artLayer(p) + '</div></div>' +
          '<h3 style="font-family:\'Playfair Display\',serif;font-size:18px;font-weight:700;margin-top:12px">' + esc(p.name) + '</h3><span style="font-family:\'Space Mono\',monospace;font-size:14px;color:rgba(21,49,92,.7)">' + fmt(p.price) + '</span></div>';
      }).join('') + '</div>' : '';
      var artistGrid = saRaw.length ? '<div style="margin-top:34px"><div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#2E8A87;margin-bottom:14px">Artists</div><div style="display:flex;flex-wrap:wrap;gap:12px">' + saRaw.map(function (a) {
        return '<button data-act="openartist" data-name="' + esc(a.name) + '" style="display:flex;align-items:center;gap:12px;background:#FBF6EA;border:1px solid rgba(21,49,92,.14);border-radius:14px;padding:12px 18px;cursor:pointer;text-align:left"><span style="width:30px;height:30px;border-radius:50%;background:' + cardBg(a.tint) + ';flex:none"></span><span><span style="display:block;font-family:\'Playfair Display\',serif;font-size:16px;font-weight:700">' + esc(a.name) + '</span><span style="font-size:12px;color:rgba(21,49,92,.55)">' + esc(a.medium) + '</span></span></button>';
      }).join('') + '</div></div>' : '';
      var articleList = arRaw.length ? '<div style="margin-top:34px"><div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#C0561E;margin-bottom:14px">From the journal</div><div style="display:flex;flex-direction:column;gap:10px">' + arRaw.map(function (p) {
        return '<button data-act="article" data-id="' + p.id + '" style="display:flex;align-items:baseline;justify-content:space-between;gap:16px;background:#FBF6EA;border:1px solid rgba(21,49,92,.14);border-radius:14px;padding:14px 18px;cursor:pointer;text-align:left"><span style="font-family:\'Playfair Display\',serif;font-size:16px;font-weight:700">' + esc(p.title) + '</span><span style="font-family:\'Space Mono\',monospace;font-size:11px;color:rgba(21,49,92,.5);white-space:nowrap">' + esc(p.cat) + '</span></button>';
      }).join('') + '</div></div>' : '';
      var empty = total === 0 ? '<div style="text-align:center;padding:clamp(36px,6vw,70px) 0"><img src="assets/omg-emblem.png" alt="" style="width:78px;height:78px;border-radius:50%;opacity:.9"><h2 style="font-family:\'Playfair Display\',serif;font-size:26px;font-weight:700;margin-top:20px">Nothing matches “' + esc(state.searchQ.trim()) + '”.</h2><p style="font-size:15px;color:rgba(21,49,92,.6);margin-top:8px">Try a color, a medium, or an artist\'s name.</p></div>' : '';
      results = '<div style="margin-top:30px"><div style="font-family:\'Space Mono\',monospace;font-size:12px;color:rgba(21,49,92,.55);margin-bottom:18px">' + total + ' result' + (total === 1 ? '' : 's') + ' for “' + esc(state.searchQ.trim()) + '”</div>' + prodGrid + artistGrid + articleList + empty + '</div>';
    } else {
      results = '<div style="margin-top:34px"><div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:rgba(21,49,92,.5);margin-bottom:12px">Try</div><div style="display:flex;flex-wrap:wrap;gap:10px">' + suggestions + '</div></div>';
    }

    return '<div style="max-width:1180px;margin:0 auto;padding:clamp(36px,5vw,64px) clamp(20px,6vw,60px) 60px">' +
      '<div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#C0561E">Find your medium</div>' +
      '<h1 style="font-family:\'Playfair Display\',serif;font-size:clamp(32px,5vw,60px);font-weight:800;line-height:1;margin-top:10px;margin-bottom:24px">Search the studio</h1>' +
      '<div style="display:flex;align-items:center;gap:12px;background:#FBF6EA;border:1.5px solid rgba(21,49,92,.2);border-radius:100px;padding:6px 8px 6px 22px;max-width:620px">' +
      '<span style="color:rgba(21,49,92,.45);font-size:18px">⌕</span>' +
      '<input data-act="searchq" value="' + esc(state.searchQ) + '" placeholder="Tees, totes, Mira, chrome yellow…" style="flex:1;border:none;background:none;outline:none;font-size:16px;color:#15315C;padding:10px 0">' +
      (hasSearch ? '<button data-act="searchclear" style="width:34px;height:34px;border-radius:50%;border:none;background:rgba(21,49,92,.08);color:#15315C;cursor:pointer;font-size:14px;flex:none">✕</button>' : '') +
      '</div>' + results + '</div>';
  }

  // ===================================================================
  //  ACCOUNT
  // ===================================================================
  var DEMO_ORDERS = [
    { no: 'OMG-204815', items: 'Starry Night Crew Tee · Wheatfield Canvas Tote', date: 'May 2, 2026', status: 'Delivered', total: '$124' },
    { no: 'OMG-198332', items: 'Sunflower Field Hoodie', date: 'Mar 18, 2026', status: 'Delivered', total: '$88' }
  ];
  function accountView() {
    if (!acct.authed) {
      return '<div style="max-width:460px;margin:0 auto;padding:clamp(40px,7vw,90px) clamp(20px,6vw,40px) 70px">' +
        '<div style="text-align:center;margin-bottom:30px"><img src="assets/omg-emblem.png" alt="" style="width:72px;height:72px;border-radius:50%;box-shadow:0 12px 30px -12px rgba(14,35,71,.5)">' +
        '<h1 style="font-family:\'Playfair Display\',serif;font-size:clamp(28px,4vw,40px);font-weight:800;margin-top:18px">Welcome to the studio</h1>' +
        '<p style="font-size:15px;color:rgba(21,49,92,.65);margin-top:6px">Sign in to track orders and keep your saved pieces.</p></div>' +
        '<form data-act="signin" style="display:flex;flex-direction:column;gap:14px;background:#FBF6EA;border:1px solid rgba(21,49,92,.12);padding:clamp(24px,4vw,34px)">' +
        '<label style="display:block"><span style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(21,49,92,.55)">Email</span><input name="email" type="email" required placeholder="you@studio.com" style="width:100%;margin-top:6px;font-size:15px;color:#15315C;background:#F3EDDD;border:1.5px solid rgba(21,49,92,.2);border-radius:12px;padding:13px 15px;outline:none"></label>' +
        '<label style="display:block"><span style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(21,49,92,.55)">Password</span><input name="password" type="password" required placeholder="••••••••" style="width:100%;margin-top:6px;font-size:15px;color:#15315C;background:#F3EDDD;border:1.5px solid rgba(21,49,92,.2);border-radius:12px;padding:13px 15px;outline:none"></label>' +
        '<button type="submit" style="margin-top:6px;font-family:\'Space Grotesk\',sans-serif;font-size:16px;font-weight:600;color:#F3EDDD;background:#15315C;border:none;border-radius:100px;padding:15px;cursor:pointer">Sign in</button>' +
        '<p style="text-align:center;font-size:13px;color:rgba(21,49,92,.6);margin-top:4px">New here? Just sign in — we\'ll set up your studio account.</p></form></div>';
    }

    var tabs = [['orders', 'Orders'], ['saved', 'Saved'], ['profile', 'Profile']].map(function (t) {
      var active = state.acctTab === t[0];
      return '<button data-act="accttab" data-tab="' + t[0] + '" style="font-family:\'Space Mono\',monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;background:none;border:none;padding:10px 4px;margin-right:14px;color:' + (active ? '#15315C' : 'rgba(21,49,92,.5)') + ';border-bottom:2px solid ' + (active ? '#E0A93A' : 'transparent') + '">' + t[1] + '</button>';
    }).join('');

    var body = '';
    if (state.acctTab === 'saved') {
      var savedProducts = state.saved.map(findProductStrict).filter(Boolean);
      if (savedProducts.length) {
        body = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:clamp(22px,3vw,40px)">' + savedProducts.map(function (p) {
          return '<div><div data-act="open" data-id="' + p.id + '" style="position:relative;background:#FBF6EA;padding:12px;box-shadow:0 26px 52px -30px rgba(14,35,71,.5),0 0 0 1px rgba(21,49,92,.1);cursor:pointer"><div style="position:relative;aspect-ratio:4/5;overflow:hidden;background:' + cardBg(p.tint) + '">' + artLayer(p) + '</div></div>' +
            '<h3 style="font-family:\'Playfair Display\',serif;font-size:18px;font-weight:700;margin-top:12px">' + esc(p.name) + '</h3>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px"><span style="font-family:\'Space Mono\',monospace;font-size:14px;color:rgba(21,49,92,.7)">' + fmt(p.price) + '</span><button data-act="togglesave" data-id="' + p.id + '" style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#C0561E;background:none;border:none;cursor:pointer">Remove</button></div>' +
            '<button class="btn-primary" data-act="quickadd" data-id="' + p.id + '" style="width:100%;margin-top:10px;font-family:\'Space Grotesk\',sans-serif;font-size:13px;font-weight:600;color:#F3EDDD;background:#15315C;border:none;border-radius:100px;padding:10px;cursor:pointer">Add to bag</button></div>';
        }).join('') + '</div>';
      } else {
        body = '<div style="text-align:center;padding:clamp(36px,6vw,70px) 0"><h2 style="font-family:\'Playfair Display\',serif;font-size:24px;font-weight:700">No saved pieces yet.</h2><p style="font-size:15px;color:rgba(21,49,92,.6);margin-top:8px">Tap ♡ on any piece to keep it here.</p><button class="btn-primary" data-act="go" data-view="shop" style="margin-top:22px;font-family:\'Space Grotesk\',sans-serif;font-size:15px;font-weight:600;color:#F3EDDD;background:#15315C;border:none;border-radius:100px;padding:14px 30px;cursor:pointer">Browse the collection</button></div>';
      }
    } else if (state.acctTab === 'profile') {
      var pr = acct.profile;
      body = '<div style="max-width:560px;display:flex;flex-direction:column;gap:14px">' +
        '<label style="display:block"><span style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(21,49,92,.55)">Name</span><input name="name" value="' + esc(pr.name) + '" style="width:100%;margin-top:6px;font-size:15px;color:#15315C;background:#FBF6EA;border:1.5px solid rgba(21,49,92,.2);border-radius:12px;padding:13px 15px;outline:none"></label>' +
        '<label style="display:block"><span style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(21,49,92,.55)">Email</span><input name="email" value="' + esc(pr.email) + '" style="width:100%;margin-top:6px;font-size:15px;color:#15315C;background:#FBF6EA;border:1.5px solid rgba(21,49,92,.2);border-radius:12px;padding:13px 15px;outline:none"></label>' +
        '<label style="display:block"><span style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(21,49,92,.55)">Shipping address</span><input name="address" value="' + esc(pr.address) + '" style="width:100%;margin-top:6px;font-size:15px;color:#15315C;background:#FBF6EA;border:1.5px solid rgba(21,49,92,.2);border-radius:12px;padding:13px 15px;outline:none"></label>' +
        '<button data-act="saveprofile" style="align-self:flex-start;margin-top:6px;font-family:\'Space Grotesk\',sans-serif;font-size:15px;font-weight:600;color:#F3EDDD;background:#15315C;border:none;border-radius:100px;padding:13px 28px;cursor:pointer">Save changes</button></div>';
    } else {
      var ordersList = DEMO_ORDERS.slice();
      if (state.orderNo) ordersList = [{ no: state.orderNo, items: 'Your latest order', date: 'Just now', status: 'Processing', total: '—' }].concat(ordersList);
      var statusChip = function (s) {
        var c = s === 'Delivered' ? '46,138,134' : (s === 'Processing' ? '224,169,58' : '58,110,168');
        return 'font-family:"Space Mono",monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;padding:5px 11px;border-radius:8px;background:rgba(' + c + ',.16);color:rgb(' + c + ')';
      };
      body = '<div style="display:flex;flex-direction:column;gap:14px">' + ordersList.map(function (o) {
        return '<div style="background:#FBF6EA;border:1px solid rgba(21,49,92,.12);border-radius:16px;padding:20px 22px;display:flex;gap:16px;align-items:center;flex-wrap:wrap">' +
          '<div style="flex:1;min-width:180px"><div style="font-family:\'Space Mono\',monospace;font-size:14px;font-weight:700">' + esc(o.no) + '</div><div style="font-size:13px;color:rgba(21,49,92,.6);margin-top:3px">' + esc(o.items) + '</div></div>' +
          '<div style="font-size:13px;color:rgba(21,49,92,.6)">' + esc(o.date) + '</div>' +
          '<span style="' + statusChip(o.status) + '">' + esc(o.status) + '</span>' +
          '<span style="font-family:\'Space Mono\',monospace;font-size:15px;min-width:54px;text-align:right">' + esc(o.total) + '</span></div>';
      }).join('') + '</div>';
    }

    return '<div style="max-width:1100px;margin:0 auto;padding:clamp(36px,5vw,60px) clamp(20px,6vw,60px) 60px">' +
      '<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap">' +
      '<div><div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#C0561E">Your studio</div>' +
      '<h1 style="font-family:\'Playfair Display\',serif;font-size:clamp(32px,5vw,56px);font-weight:800;line-height:1;margin-top:10px">Hello, ' + esc((acct.profile.name || 'friend').split(' ')[0]) + '</h1></div>' +
      '<button data-act="signout" style="font-family:\'Space Mono\',monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:rgba(21,49,92,.6);background:none;border:1px solid rgba(21,49,92,.25);border-radius:100px;padding:10px 18px;cursor:pointer">Sign out</button></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:30px;border-bottom:1px solid rgba(21,49,92,.14);padding-bottom:2px">' + tabs + '</div>' +
      '<div style="margin-top:28px">' + body + '</div></div>';
  }

  function notFoundView() {
    return '<div style="max-width:600px;margin:0 auto;padding:clamp(60px,10vw,140px) clamp(20px,6vw,40px);text-align:center;min-height:56vh">' +
      '<img src="assets/omg-emblem.png" alt="" style="width:96px;height:96px;border-radius:50%;opacity:.9;animation:ftFloat 6s ease-in-out infinite">' +
      '<div style="font-family:\'Yellowtail\',cursive;font-size:clamp(64px,14vw,120px);color:#C99224;line-height:1;margin-top:18px">404</div>' +
      '<h1 style="font-family:\'Playfair Display\',serif;font-size:clamp(26px,4vw,40px);font-weight:800;margin-top:6px">This wall is blank.</h1>' +
      '<p style="font-size:16px;color:rgba(21,49,92,.65);margin-top:12px;max-width:40ch;margin-left:auto;margin-right:auto">The page you\'re after isn\'t hanging here. Let\'s get you back to the gallery.</p>' +
      '<button class="btn-primary" data-act="go" data-view="home" style="margin-top:28px;font-family:\'Space Grotesk\',sans-serif;font-size:15px;font-weight:600;color:#F3EDDD;background:#15315C;border:none;border-radius:100px;padding:15px 34px;cursor:pointer">Back to home</button></div>';
  }

  // ===================================================================
  //  RENDER
  // ===================================================================
  var KNOWN_VIEWS = ['home', 'shop', 'product', 'artists', 'artist', 'journal', 'article', 'about', 'cart', 'checkout', 'confirm', 'search', 'account', 'info'];
  function currentView() {
    if (KNOWN_VIEWS.indexOf(state.view) < 0) return notFoundView();
    switch (state.view) {
      case 'shop': return shopView();
      case 'product': return productView();
      case 'artists': return artistsView();
      case 'artist': return artistView();
      case 'journal': return journalView();
      case 'article': return articleView();
      case 'about': return aboutView();
      case 'cart': return cartView();
      case 'checkout': return checkoutView();
      case 'confirm': return confirmView();
      case 'search': return searchView();
      case 'account': return accountView();
      case 'info': return infoView();
      default: return homeView();
    }
  }

  function render() {
    var toast = state.toast
      ? '<div style="position:fixed;bottom:26px;left:50%;transform:translateX(-50%);z-index:800;background:#15315C;color:#F3EDDD;font-family:\'Space Grotesk\',sans-serif;font-size:14px;padding:14px 24px;border-radius:100px;box-shadow:0 16px 40px -14px rgba(14,35,71,.7);display:flex;align-items:center;gap:10px"><span style="width:9px;height:9px;border-radius:50%;background:#E0A93A;flex:none"></span>' + esc(state.toast) + '</div>'
      : '';
    document.getElementById('app').innerHTML =
      header() +
      '<main class="view-anim" style="padding-top:69px;position:relative;z-index:1" key="' + state.view + '">' + currentView() + footer() + '</main>' +
      toast;
  }

  // ===================================================================
  //  EVENTS (delegation)
  // ===================================================================
  document.addEventListener('click', function (e) {
    var node = e.target.closest('[data-act]');
    if (!node) return;
    var act = node.getAttribute('data-act');
    // forms handle their own submit; ignore their submit buttons here
    if (node.tagName === 'BUTTON' && node.getAttribute('type') === 'submit') return;

    switch (act) {
      case 'go': go(node.getAttribute('data-view')); break;
      case 'open': openProduct(node.getAttribute('data-id')); break;
      case 'shopcat': state.cat = node.getAttribute('data-cat'); go('shop'); break;
      case 'setcat': state.cat = node.getAttribute('data-cat'); render(); break;
      case 'setsize': state.size = node.getAttribute('data-size'); render(); break;
      case 'quickadd': e.stopPropagation(); addToCart(findProduct(node.getAttribute('data-id'))); break;
      case 'addcurrent': addToCart(findProduct(state.pid), state.size); break;
      case 'qty': changeQty(node.getAttribute('data-id'), node.getAttribute('data-size'), parseInt(node.getAttribute('data-d'), 10)); break;
      case 'removeline': removeLine(node.getAttribute('data-id'), node.getAttribute('data-size')); break;
      case 'article': state.articleId = node.getAttribute('data-id'); go('article'); break;
      case 'openartist': e.stopPropagation(); openArtist(node.getAttribute('data-name')); break;
      case 'togglesave': e.stopPropagation(); toggleSave(node.getAttribute('data-id')); render(); break;
      case 'togglemenu': state.menuOpen = !state.menuOpen; render(); break;
      case 'closemenu': state.menuOpen = false; render(); break;
      case 'checkoutnext': checkoutNext(); break;
      case 'checkoutback': checkoutBack(); break;
      case 'setship': state.co.ship = node.getAttribute('data-ship'); render(); break;
      case 'searchclear': state.searchQ = ''; render(); break;
      case 'searchpick': state.searchQ = node.getAttribute('data-q'); render(); break;
      case 'openinfo': state.infoKey = node.getAttribute('data-info'); state.contactSent = false; go('info'); break;
      case 'accttab': state.acctTab = node.getAttribute('data-tab'); render(); break;
      case 'signout': acct.authed = false; saveAccount(); render(); break;
      case 'saveprofile':
        var wrap = node.closest('div');
        if (wrap) {
          var nameEl = wrap.querySelector('[name=name]'), emailEl = wrap.querySelector('[name=email]'), addrEl = wrap.querySelector('[name=address]');
          acct.profile.name = nameEl ? nameEl.value : acct.profile.name;
          acct.profile.email = emailEl ? emailEl.value : acct.profile.email;
          acct.profile.address = addrEl ? addrEl.value : acct.profile.address;
          saveAccount();
        }
        showToast('Profile saved');
        break;
    }
  });

  document.addEventListener('input', function (e) {
    var node = e.target;
    if (!node.matches('[data-act="searchq"]')) return;
    state.searchQ = node.value;
    render();
    var again = document.querySelector('[data-act="searchq"]');
    if (again) { again.focus(); var v = again.value; try { again.setSelectionRange(v.length, v.length); } catch (err) {} }
  });

  document.addEventListener('submit', function (e) {
    var form = e.target.closest('[data-act]');
    if (!form) return;
    e.preventDefault();
    var act = form.getAttribute('data-act');
    if (act === 'subscribe') {
      state.newsDone = true; render();
    } else if (act === 'applypromo') {
      var code = (form.querySelector('[name=promo]').value || '').trim().toUpperCase();
      state.promo = form.querySelector('[name=promo]').value;
      state.promoOk = code === 'STARRY';
      render();
      showToast(state.promoOk ? 'Code applied — 15% off' : 'That code didn\'t work');
    } else if (act === 'checkout') {
      startCheckout(form);
    } else if (act === 'contact') {
      state.contactSent = true; render();
    } else if (act === 'signin') {
      var email = form.querySelector('[name=email]');
      acct.authed = true;
      if (email && email.value && !acct.profile.email) acct.profile.email = email.value;
      saveAccount();
      state.acctTab = 'orders';
      render();
    }
  });

  // boot: render immediately with whatever we have, then hydrate from
  // Supabase if it's configured (falls back silently to demo data).
  function boot() {
    render();
    if (!DB.remote) return;
    if (DB.remote.getConfig) {
      DB.remote.getConfig().then(function (cfg) {
        if (!cfg) return;
        paymentsLive = !!cfg.razorpayKeyId;
        rzpKeyId = cfg.razorpayKeyId || '';
        if (cfg.freeShippingOver != null) shipFreeOver = Number(cfg.freeShippingOver);
        if (cfg.flatShipping != null) shipFlat = Number(cfg.flatShipping);
        if (paymentsLive && state.view === 'checkout') render();
      });
    }
    if (DB.remote.loadStore) {
      DB.remote.loadStore().then(function (remote) {
        if (remote && remote.products && remote.products.length) {
          store = remote;
          currencySymbol = symbolFromCurrency(store.settings && store.settings.currency);
          render();
        }
      });
    }
  }
  boot();
})();
