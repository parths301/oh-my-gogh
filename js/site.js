/* ============================================================
   Oh my Gogh! — storefront SPA (vanilla)
   Faithful port of the imported "Oh My Gogh.dc.html" design.
   ============================================================ */
(function () {
  'use strict';

  var DB = window.OMG;
  var fmt = DB.fmt, cardBg = DB.cardBg, esc = DB.esc;
  var CART_KEY = 'omg.cart.v1';

  // ----- live catalog (shared with admin via localStorage) -----------
  var store = DB.load();

  function published(list) { return list.filter(function (p) { return p.status !== 'draft'; }); }
  function products() { return published(store.products); }
  function artists() { return store.artists.slice(); }
  function journal() { return published(store.journal); }

  // ----- app state ---------------------------------------------------
  var state = {
    view: 'home',
    cart: loadCart(),
    cat: 'All',
    pid: 'p1',
    size: 'M',
    articleId: null,
    promo: '',
    promoOk: false,
    orderNo: null,
    newsDone: false,
    toast: ''
  };
  var toastTimer = null;

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { return []; }
  }
  function saveCart() { try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); } catch (e) {} }

  // ----- helpers -----------------------------------------------------
  var ACCENT = { shop: '#E0A93A', artists: '#2E8A87', journal: '#15315C', about: '#C0561E' };
  var NAV = [['shop', 'Shop'], ['artists', 'Artists'], ['journal', 'Journal'], ['about', 'About']];

  function findProduct(id) {
    for (var i = 0; i < store.products.length; i++) if (store.products[i].id === id) return store.products[i];
    return store.products[0];
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

  function cartTotals() {
    var subtotal = state.cart.reduce(function (s, c) { return s + c.price * c.qty; }, 0);
    var discount = state.promoOk ? subtotal * 0.15 : 0;
    var shipping = subtotal === 0 ? 0 : (subtotal - discount >= 75 ? 0 : 8);
    return { subtotal: subtotal, discount: discount, shipping: shipping, total: subtotal - discount + shipping };
  }

  function placeOrder() {
    var no = 'OMG-' + Math.floor(100000 + Math.random() * 900000);
    state.orderNo = no;
    state.view = 'confirm';
    state.cart = [];
    state.promo = ''; state.promoOk = false;
    saveCart();
    window.scrollTo(0, 0);
    render();
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
        '<span style="position:relative;width:16px;height:16px;display:inline-block;flex:none">' +
        '<span style="position:absolute;inset:0;background:' + ACCENT[key] + ';border-radius:46% 54% 56% 44%/52% 48% 52% 48%;animation:ftBlob 6s ease-in-out infinite;box-shadow:0 2px 7px rgba(14,35,71,0.2)"></span>' +
        (active ? '<span style="position:absolute;inset:-5px;border:1.5px solid #15315C;border-radius:50%"></span>' : '') +
        '</span>' +
        '<span style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:' + (active ? '#15315C' : 'rgba(21,49,92,0.55)') + '">' + label + '</span>' +
        '</button>';
    }).join('');

    var bagActive = v === 'cart';
    var bag = '<button class="nav-link" data-act="go" data-view="cart" style="display:flex;align-items:center;gap:9px;background:none;border:none;cursor:pointer;padding:6px 2px;margin-left:4px">' +
      '<span style="position:relative;width:18px;height:18px;display:inline-block;flex:none">' +
      '<span style="position:absolute;inset:0;background:#2E8A87;border-radius:46% 54% 56% 44%/52% 48% 52% 48%;animation:ftBlob 6s ease-in-out infinite;box-shadow:0 2px 7px rgba(14,35,71,0.2)"></span></span>' +
      '<span style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:' + (bagActive ? '#15315C' : 'rgba(21,49,92,0.55)') + '">Bag</span>' +
      (cartCount() > 0 ? '<span style="min-width:19px;height:19px;padding:0 5px;border-radius:10px;background:#15315C;color:#F3EDDD;font-family:\'Space Mono\',monospace;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center">' + cartCount() + '</span>' : '') +
      '</button>';

    return '<header style="position:fixed;top:0;left:0;right:0;z-index:500;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:13px clamp(16px,4vw,46px);background:rgba(243,237,221,0.82);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid rgba(21,49,92,0.12)">' +
      '<div data-act="go" data-view="home" style="display:flex;align-items:center;gap:12px;cursor:pointer">' +
      '<img src="assets/omg-emblem.png" alt="Oh my Gogh emblem" style="width:42px;height:42px;border-radius:50%;box-shadow:0 3px 12px rgba(14,35,71,0.25);animation:ftBob 7s ease-in-out infinite">' +
      '<span style="font-family:\'Yellowtail\',cursive;font-size:27px;line-height:1;color:#15315C">Oh my <span style="color:#C99224">Gogh!</span></span>' +
      '</div>' +
      '<nav style="display:flex;align-items:center;gap:clamp(8px,2vw,24px);flex-wrap:wrap;justify-content:flex-end">' + items + bag + '</nav>' +
      '</header>';
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
      '<button class="foot-link" data-act="go" data-view="about" style="display:block;background:none;border:none;cursor:pointer;font-family:\'Space Grotesk\',sans-serif;font-size:14px;color:rgba(243,237,221,.78);padding:5px 0;text-align:left">Our story</button></div>' +
      '<div><div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#E0A93A;margin-bottom:16px">Support</div>' +
      '<button class="foot-link" data-act="go" data-view="contact" style="display:block;background:none;border:none;cursor:pointer;font-family:\'Space Grotesk\',sans-serif;font-size:14px;color:rgba(243,237,221,.78);padding:5px 0;text-align:left">Shipping &amp; returns</button>' +
      '<button class="foot-link" data-act="go" data-view="contact" style="display:block;background:none;border:none;cursor:pointer;font-family:\'Space Grotesk\',sans-serif;font-size:14px;color:rgba(243,237,221,.78);padding:5px 0;text-align:left">Contact us</button>' +
      '<span style="display:block;font-size:14px;color:rgba(243,237,221,.78);padding:5px 0">parth@ohmygogh.com</span></div>' +
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
      '<div style="position:relative;z-index:2;font-family:\'Space Mono\',monospace;font-size:clamp(10px,1.4vw,13px);letter-spacing:0.42em;text-transform:uppercase;color:#C0561E;margin-top:30px;animation:ftRise .8s ease .25s both">Est. 2026 · Art Lifestyle Brand</div>' +
      '<h1 style="position:relative;z-index:2;font-family:\'Yellowtail\',cursive;font-size:clamp(66px,13vw,168px);line-height:0.86;color:#15315C;margin-top:14px;animation:ftRise .9s cubic-bezier(.16,1,.3,1) .35s both">Oh my <span style="color:#C99224">Gogh!</span></h1>' +
      '<p style="position:relative;z-index:2;font-family:\'Playfair Display\',serif;font-style:italic;font-size:clamp(18px,2.4vw,28px);color:#2C436B;margin-top:18px;max-width:620px;animation:ftRise .9s ease .5s both">Wearable art &amp; studio goods for people who feel in color.</p>' +
      '<div style="position:relative;z-index:2;display:flex;flex-wrap:wrap;gap:16px;justify-content:center;margin-top:36px;animation:ftRise .9s ease .65s both">' +
      '<button class="btn-primary" data-act="go" data-view="shop" style="font-family:\'Space Grotesk\',sans-serif;font-size:15px;font-weight:600;letter-spacing:.02em;color:#F3EDDD;background:#15315C;border:none;border-radius:100px;padding:16px 34px;cursor:pointer;box-shadow:0 14px 30px -12px rgba(21,49,92,.7)">Wander the Gallery</button>' +
      '<button class="btn-outline" data-act="go" data-view="about" style="font-family:\'Space Grotesk\',sans-serif;font-size:15px;font-weight:600;letter-spacing:.02em;color:#15315C;background:transparent;border:1.5px solid rgba(21,49,92,.4);border-radius:100px;padding:16px 34px;cursor:pointer">Read our story</button></div>' +
      '<div style="position:absolute;bottom:26px;left:50%;transform:translateX(-50%);font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:rgba(21,49,92,.5);display:flex;flex-direction:column;align-items:center;gap:8px;animation:ftRise 1s ease 1s both">scroll<span style="animation:ftDip 1.8s ease-in-out infinite;font-size:14px">↓</span></div>' +
      '</section>' +
      // marquee
      '<div style="background:#15315C;color:#F3EDDD;overflow:hidden;padding:15px 0;border-top:1px solid rgba(224,169,58,.4);border-bottom:1px solid rgba(224,169,58,.4)">' +
      '<div style="display:flex;white-space:nowrap;width:max-content;animation:ftMarquee 32s linear infinite;font-family:\'Space Mono\',monospace;font-size:14px;letter-spacing:.22em;text-transform:uppercase"><span>' + marquee + '</span><span>' + marquee + '</span></div></div>' +
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
      '<button class="save-btn" style="font-family:\'Space Grotesk\',sans-serif;font-size:16px;color:#15315C;background:transparent;border:1.5px solid rgba(21,49,92,.35);border-radius:100px;padding:17px 24px;cursor:pointer">♡ Save</button></div>' +
      '<div style="margin-top:34px;border-top:1px solid rgba(21,49,92,.14)">' + details + '</div>' +
      '<div style="display:flex;align-items:center;gap:14px;margin-top:24px;padding:16px 18px;background:#FBF6EA;border:1px solid rgba(21,49,92,.12);border-radius:14px">' +
      '<img src="assets/omg-emblem.png" alt="" style="width:46px;height:46px;border-radius:50%;flex:none">' +
      '<div><div style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:rgba(21,49,92,.55)">Made by</div>' +
      '<div style="font-family:\'Playfair Display\',serif;font-size:18px;font-weight:600">' + esc(p.artist) + '</div></div></div>' +
      '</div></div>' +
      '<div style="margin-top:clamp(60px,7vw,96px)"><h2 style="font-family:\'Playfair Display\',serif;font-size:clamp(24px,3vw,36px);font-weight:800;margin-bottom:28px">More from the hang</h2>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:clamp(22px,2.5vw,40px)">' + related + '</div></div></div>';
  }

  function artistsView() {
    var all = artists();
    var feat = all[0];
    var rest = all.slice(1).map(function (a) {
      return '<div><div style="display:block;width:100%;aspect-ratio:1/1;background:' + cardBg(a.tint) + ';box-shadow:0 22px 44px -26px rgba(14,35,71,.45),0 0 0 1px rgba(21,49,92,.1)"></div>' +
        '<h3 style="font-family:\'Playfair Display\',serif;font-size:22px;font-weight:700;margin-top:16px">' + esc(a.name) + '</h3>' +
        '<div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#C0561E;margin-top:3px">' + esc(a.medium) + '</div>' +
        '<p style="font-size:14px;line-height:1.6;color:#2C436B;margin-top:10px">' + esc(a.bioText) + '</p></div>';
    }).join('');

    return '<div style="max-width:1200px;margin:0 auto;padding:clamp(36px,5vw,64px) clamp(20px,6vw,70px) 60px">' +
      '<div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#C0561E">Hands behind the work</div>' +
      '<h1 style="font-family:\'Playfair Display\',serif;font-size:clamp(36px,5.5vw,68px);font-weight:800;line-height:1;margin-top:10px">The Collaborators</h1>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:clamp(36px,5vw,64px);align-items:center;margin-top:clamp(40px,5vw,60px);padding:clamp(28px,4vw,48px);background:#FBF6EA;border:1px solid rgba(21,49,92,.12)">' +
      '<div style="position:relative;justify-self:center;width:min(82%,320px)"><div style="display:block;width:100%;aspect-ratio:1/1;background:' + cardBg(feat.tint) + ';box-shadow:0 24px 50px -26px rgba(14,35,71,.5)"></div></div>' +
      '<div><div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#2E8A87">Featured · ' + esc(feat.medium) + '</div>' +
      '<h2 style="font-family:\'Playfair Display\',serif;font-size:clamp(30px,4vw,48px);font-weight:800;margin-top:10px">' + esc(feat.name) + '</h2>' +
      '<p style="font-family:\'Yellowtail\',cursive;font-size:clamp(24px,3vw,34px);color:#C99224;margin-top:4px;line-height:1.1">“' + esc(feat.quote) + '”</p>' +
      '<p style="font-size:16px;line-height:1.75;color:#2C436B;margin-top:18px;max-width:48ch">' + esc(feat.bioText) + '</p>' +
      '<div style="display:flex;gap:18px;margin-top:24px;font-family:\'Space Mono\',monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase">' +
      '<span style="color:rgba(21,49,92,.6)">Instagram ↗</span><span style="color:rgba(21,49,92,.6)">Portfolio ↗</span></div>' +
      '<button class="btn-primary" data-act="go" data-view="shop" style="margin-top:26px;font-family:\'Space Grotesk\',sans-serif;font-size:15px;font-weight:600;color:#F3EDDD;background:#15315C;border:none;border-radius:100px;padding:14px 30px;cursor:pointer">Shop ' + esc(feat.name.split(' ')[0]) + '\'s pieces</button></div></div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:clamp(24px,3vw,40px);margin-top:clamp(44px,5vw,64px)">' + rest + '</div></div>';
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
    var field = function (name, label, ph, type, half) {
      return '<label style="display:block;' + (half ? 'flex:1;min-width:140px' : '') + '"><span style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(21,49,92,.55)">' + label + '</span>' +
        '<input name="' + name + '" type="' + (type || 'text') + '" required placeholder="' + ph + '" style="width:100%;margin-top:5px;font-size:14px;color:#15315C;background:#fff;border:1px solid rgba(21,49,92,.18);border-radius:10px;padding:11px 13px;outline:none"></label>';
    };
    var summaryLines = state.cart.map(function (c) {
      return '<div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:6px 0;color:#2C436B"><span>' + esc(c.name) + ' <span style="color:rgba(21,49,92,.5)">×' + c.qty + '</span></span><span style="font-family:\'Space Mono\',monospace">' + fmt(c.price * c.qty) + '</span></div>';
    }).join('');

    return '<div style="max-width:1100px;margin:0 auto;padding:clamp(36px,5vw,64px) clamp(20px,6vw,60px) 70px">' +
      '<button data-act="go" data-view="cart" style="font-family:\'Space Mono\',monospace;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:rgba(21,49,92,.7);background:none;border:none;cursor:pointer;margin-bottom:20px">← Back to bag</button>' +
      '<div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#C0561E">Almost yours</div>' +
      '<h1 style="font-family:\'Playfair Display\',serif;font-size:clamp(32px,5vw,56px);font-weight:800;line-height:1;margin-top:10px;margin-bottom:clamp(28px,4vw,40px)">Checkout</h1>' +
      '<form data-act="checkout" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:clamp(28px,4vw,48px);align-items:start">' +
      '<div style="display:flex;flex-direction:column;gap:22px">' +
      '<div style="background:#FBF6EA;border:1px solid rgba(21,49,92,.12);border-radius:16px;padding:22px"><h2 style="font-family:\'Playfair Display\',serif;font-size:18px;font-weight:700;margin-bottom:16px">Contact</h2>' +
      '<div style="display:flex;flex-direction:column;gap:14px">' + field('name', 'Full name', 'Vincent van Gogh') + field('email', 'Email', 'you@studio.com', 'email') + '</div></div>' +
      '<div style="background:#FBF6EA;border:1px solid rgba(21,49,92,.12);border-radius:16px;padding:22px"><h2 style="font-family:\'Playfair Display\',serif;font-size:18px;font-weight:700;margin-bottom:16px">Shipping address</h2>' +
      '<div style="display:flex;flex-direction:column;gap:14px">' + field('address', 'Street address', '12 Studio Lane') +
      '<div style="display:flex;gap:12px;flex-wrap:wrap">' + field('city', 'City', 'Arles', 'text', true) + field('zip', 'Postal code', '13200', 'text', true) + '</div>' +
      field('country', 'Country', 'France') + '</div></div>' +
      '<div style="background:#FBF6EA;border:1px solid rgba(21,49,92,.12);border-radius:16px;padding:22px"><h2 style="font-family:\'Playfair Display\',serif;font-size:18px;font-weight:700;margin-bottom:6px">Payment</h2>' +
      '<p style="font-size:13px;color:rgba(21,49,92,.6);line-height:1.6">This is a demo storefront — no real card is charged. Placing the order simulates a successful Stripe payment.</p></div></div>' +
      '<div style="background:#FBF6EA;border:1px solid rgba(21,49,92,.12);padding:clamp(24px,3vw,32px);border-radius:16px;position:sticky;top:90px">' +
      '<h2 style="font-family:\'Playfair Display\',serif;font-size:22px;font-weight:800;margin-bottom:16px">Your order</h2>' + summaryLines +
      '<div style="border-top:1px solid rgba(21,49,92,.14);margin-top:8px;padding-top:12px">' +
      '<div style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;color:#2C436B"><span>Subtotal</span><span style="font-family:\'Space Mono\',monospace">' + fmt(t.subtotal) + '</span></div>' +
      (state.promoOk ? '<div style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;color:#2E8A87"><span>Discount</span><span style="font-family:\'Space Mono\',monospace">−' + fmt(t.discount) + '</span></div>' : '') +
      '<div style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;color:#2C436B"><span>Shipping</span><span style="font-family:\'Space Mono\',monospace">' + (t.shipping === 0 ? 'Free' : fmt(t.shipping)) + '</span></div></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;padding:12px 0 4px;border-top:1px solid rgba(21,49,92,.14);margin-top:6px"><span style="font-family:\'Playfair Display\',serif;font-size:20px;font-weight:700">Total</span><span style="font-family:\'Space Mono\',monospace;font-size:24px">' + fmt(t.total) + '</span></div>' +
      '<button class="btn-primary" type="submit" style="width:100%;margin-top:18px;font-family:\'Space Grotesk\',sans-serif;font-size:16px;font-weight:600;color:#F3EDDD;background:#15315C;border:none;border-radius:100px;padding:17px;cursor:pointer;box-shadow:0 14px 30px -12px rgba(21,49,92,.7)">Place order · ' + fmt(t.total) + '</button>' +
      '<p style="text-align:center;font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.1em;color:rgba(21,49,92,.45);margin-top:12px">🔒 Secure checkout · Free returns within 30 days</p></div></form></div>';
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

  function contactView() {
    var done = state.toast === '__contact';
    var faqs = [
      ['How long does shipping take?', 'Orders ship in 2–4 business days, wrapped in acid-free tissue. Shipping is free over $75, otherwise a flat $8.'],
      ['What is your return policy?', 'Free returns within 30 days on unworn pieces. Email us and we\'ll send a prepaid label.'],
      ['Do you ship internationally?', 'Yes — we ship worldwide. Duties and taxes are calculated at checkout where required.'],
      ['How do I care for a printed piece?', 'Cold wash inside out, lay flat to dry, and never iron directly over a print.']
    ].map(function (f) {
      return '<details style="background:#FBF6EA;border:1px solid rgba(21,49,92,.12);border-radius:14px;padding:16px 20px;margin-bottom:12px"><summary style="font-family:\'Playfair Display\',serif;font-size:18px;font-weight:700;cursor:pointer;list-style:none">' + esc(f[0]) + '</summary><p style="font-size:14px;line-height:1.7;color:#2C436B;margin-top:10px">' + esc(f[1]) + '</p></details>';
    }).join('');

    var form = done
      ? '<div style="background:#FBF6EA;border:1px solid rgba(46,138,134,.4);border-radius:16px;padding:40px;text-align:center"><p style="font-family:\'Yellowtail\',cursive;font-size:30px;color:#2E8A87">Thank you — we\'ll be in touch soon.</p></div>'
      : '<form data-act="contact" style="background:#FBF6EA;border:1px solid rgba(21,49,92,.12);border-radius:16px;padding:clamp(24px,3vw,32px);display:flex;flex-direction:column;gap:16px">' +
        '<label style="display:block"><span style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(21,49,92,.55)">Name</span><input name="name" required style="width:100%;margin-top:5px;font-size:14px;color:#15315C;background:#fff;border:1px solid rgba(21,49,92,.18);border-radius:10px;padding:11px 13px;outline:none"></label>' +
        '<label style="display:block"><span style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(21,49,92,.55)">Email</span><input name="email" type="email" required style="width:100%;margin-top:5px;font-size:14px;color:#15315C;background:#fff;border:1px solid rgba(21,49,92,.18);border-radius:10px;padding:11px 13px;outline:none"></label>' +
        '<label style="display:block"><span style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(21,49,92,.55)">Message</span><textarea name="message" rows="4" required style="width:100%;margin-top:5px;font-size:14px;line-height:1.5;color:#15315C;background:#fff;border:1px solid rgba(21,49,92,.18);border-radius:10px;padding:11px 13px;outline:none;resize:vertical;font-family:\'Space Grotesk\',sans-serif"></textarea></label>' +
        '<button class="btn-primary" type="submit" style="font-family:\'Space Grotesk\',sans-serif;font-size:15px;font-weight:600;color:#F3EDDD;background:#15315C;border:none;border-radius:100px;padding:14px;cursor:pointer">Send message</button></form>';

    return '<div style="max-width:1100px;margin:0 auto;padding:clamp(36px,5vw,64px) clamp(20px,6vw,60px) 60px">' +
      '<div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#C0561E">Say hello</div>' +
      '<h1 style="font-family:\'Playfair Display\',serif;font-size:clamp(34px,5.5vw,64px);font-weight:800;line-height:1;margin-top:10px">Get in touch</h1>' +
      '<p style="font-size:16px;line-height:1.7;color:#2C436B;margin-top:14px;max-width:54ch">Questions about an order, a collaboration, or a wholesale enquiry? Drop us a line at <a href="mailto:parth@ohmygogh.com" style="color:#C0561E">parth@ohmygogh.com</a> or use the form below.</p>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:clamp(32px,4vw,56px);margin-top:clamp(34px,4vw,48px);align-items:start">' +
      '<div>' + form + '</div>' +
      '<div><h2 style="font-family:\'Playfair Display\',serif;font-size:26px;font-weight:800;margin-bottom:18px">Frequent questions</h2>' + faqs + '</div></div></div>';
  }

  // ===================================================================
  //  RENDER
  // ===================================================================
  function currentView() {
    switch (state.view) {
      case 'shop': return shopView();
      case 'product': return productView();
      case 'artists': return artistsView();
      case 'journal': return journalView();
      case 'article': return articleView();
      case 'about': return aboutView();
      case 'cart': return cartView();
      case 'checkout': return checkoutView();
      case 'confirm': return confirmView();
      case 'contact': return contactView();
      default: return homeView();
    }
  }

  function render() {
    var toast = state.toast && state.toast !== '__contact'
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
    }
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
      placeOrder();
    } else if (act === 'contact') {
      state.toast = '__contact'; render();
    }
  });

  render();
})();
