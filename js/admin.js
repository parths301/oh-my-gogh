/* ============================================================
   Oh my Gogh! — Studio Admin SPA (vanilla)
   Faithful port of "Oh My Gogh Admin.dc.html".
   Reads/writes the shared catalog (localStorage) so changes
   appear on the storefront.
   ============================================================ */
(function () {
  'use strict';

  var DB = window.OMG;
  var fmt = DB.fmt, cardBg = DB.cardBg, esc = DB.esc;

  var store = DB.load();
  function persist() { DB.save(store); }

  var state = {
    view: 'overview',
    search: '',
    toast: '',
    statusFilter: 'all',
    orderFilter: 'all',
    custFilter: 'all',
    discFilter: 'all',
    jrnFilter: 'all',
    drawer: null,        // product | order | customer | discount | collection | journal | artist
    isNew: false,
    draft: null,
    selOrderId: null,
    selCustId: null
  };
  var toastTimer = null;
  var searchFocused = false;

  // ----- helpers -----------------------------------------------------
  function toast(m) {
    state.toast = m; render();
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { state.toast = ''; render(); }, 2200);
  }
  function go(v) { state.view = v; state.search = ''; render(); }

  function payStyleFor(stage) {
    var paid = stage >= 1; var c = paid ? '46,138,134' : '224,169,58';
    return 'font-family:"Space Mono",monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;padding:4px 9px;border-radius:8px;background:rgba(' + c + ',.16);color:rgb(' + c + ')';
  }
  function fulfillStyleFor(stage) {
    var map = ['120,120,120', '120,120,120', '21,49,92', '46,138,134', '40,140,70']; var c = map[stage];
    return 'font-family:"Space Mono",monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;padding:4px 9px;border-radius:8px;background:rgba(' + c + ',.15);color:rgb(' + c + ')';
  }
  function fulfillLabel(stage) { return ['Unfulfilled', 'Unfulfilled', 'Fulfilled', 'Shipped', 'Delivered'][stage]; }
  function orderTotals(o) {
    var sub = o.items.reduce(function (s, it) {
      var p = store.products.find(function (x) { return x.id === it.pid; });
      return s + (p ? p.price : 0) * it.qty;
    }, 0);
    var ship = sub >= 75 ? 0 : 8;
    return { sub: sub, ship: ship, total: sub + ship };
  }
  function chip(color, label) {
    return '<span style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;padding:4px 9px;border-radius:8px;background:rgba(' + color + ',.16);color:rgb(' + color + ')">' + esc(label) + '</span>';
  }
  function statusChip(s) { return s === 'published' || s === 'active' ? chip('46,138,134', s) : chip('120,120,120', s); }
  function filterPill(label, active, group) {
    var style = 'padding:8px 16px;border-radius:100px;font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;border:1px solid ' +
      (active ? '#15315C;background:#15315C;color:#F3EDDD' : 'rgba(21,49,92,.22);background:transparent;color:#15315C');
    return '<button data-act="filter" data-group="' + group + '" data-value="' + esc(label) + '" style="' + style + '">' + esc(label) + '</button>';
  }
  var AVATARS = ['linear-gradient(135deg,#E0A93A,#C99224)', 'linear-gradient(135deg,#2E8A87,#3A6EA8)', 'linear-gradient(135deg,#C0561E,#C99224)', 'linear-gradient(135deg,#3A6EA8,#2E8A87)', 'linear-gradient(135deg,#C99224,#E0A93A)', 'linear-gradient(135deg,#2E8A87,#C0561E)'];

  // sync visible (uncontrolled) inputs into draft / store before a re-render
  function syncDOM() {
    var root = document.getElementById('admin');
    if (!root) return;
    if (state.draft) {
      root.querySelectorAll('[data-dfield]').forEach(function (el) {
        state.draft[el.getAttribute('data-dfield')] = el.value;
      });
    }
    root.querySelectorAll('[data-prov]').forEach(function (el) {
      var k = el.getAttribute('data-prov'), f = el.getAttribute('data-pf');
      if (store.providers[k]) store.providers[k][f] = el.value;
    });
    root.querySelectorAll('[data-sfield]').forEach(function (el) {
      store.settings[el.getAttribute('data-sfield')] = el.value;
    });
  }

  // ===================================================================
  //  SIDEBAR + HEADER
  // ===================================================================
  var TITLES = { overview: 'Dashboard', products: 'Products', orders: 'Orders', payments: 'Payments', settings: 'Settings', customers: 'Customers', discounts: 'Discounts', collections: 'Collections', journal: 'Journal', artists: 'Artists' };
  var CRUMBS = { overview: 'Studio', products: 'Catalog', orders: 'Fulfillment', payments: 'Configuration', settings: 'Store', customers: 'Audience', discounts: 'Marketing', collections: 'Catalog', journal: 'Content', artists: 'Collaborators' };
  var NAVCOLORS = { overview: '#E0A93A', products: '#2E8A87', orders: '#C0561E', payments: '#3A6EA8', settings: '#C99224', customers: '#C0561E', discounts: '#2E8A87', collections: '#C99224', journal: '#3A6EA8', artists: '#E0A93A' };
  var NAV_ORDER = ['overview', 'products', 'orders', 'customers', 'discounts', 'collections', 'journal', 'artists', 'payments', 'settings'];

  function sidebar() {
    var v = state.view;
    var pending = store.orders.filter(function (o) { return o.stage < 2; }).length;
    var badges = { orders: pending ? String(pending) : '' };
    var navBtns = NAV_ORDER.map(function (k) {
      var active = v === k;
      var style = 'display:flex;align-items:center;gap:11px;width:100%;text-align:left;border:none;cursor:pointer;padding:11px 12px;border-radius:12px;background:' + (active ? 'rgba(243,237,221,.1)' : 'transparent') + ';color:' + (active ? '#F3EDDD' : 'rgba(243,237,221,.62)') + '';
      var badge = badges[k] ? '<span class="adm-navtext" style="margin-left:auto;font-family:\'Space Mono\',monospace;font-size:10px;background:rgba(224,169,58,.22);color:#E0A93A;padding:2px 7px;border-radius:8px">' + badges[k] + '</span>' : '';
      return '<button class="adm-nav-btn" data-act="go" data-view="' + k + '" style="' + style + '">' +
        '<span style="width:11px;height:11px;border-radius:46% 54% 56% 44%/52% 48% 52% 48%;background:' + NAVCOLORS[k] + ';flex:none;box-shadow:0 1px 4px rgba(0,0,0,.25)"></span>' +
        '<span class="adm-navtext" style="font-size:14px;font-weight:500">' + TITLES[k] + '</span>' + badge + '</button>';
    }).join('');

    return '<aside class="adm-sidebar" style="position:fixed;top:0;left:0;bottom:0;width:248px;background:#0E2347;display:flex;flex-direction:column;padding:22px 16px;z-index:50">' +
      '<div class="adm-logo" style="display:flex;align-items:center;gap:11px;margin-bottom:28px;padding:0 6px">' +
      '<img src="assets/omg-emblem.png" alt="" style="width:40px;height:40px;border-radius:50%;box-shadow:0 3px 10px rgba(0,0,0,.3)">' +
      '<div><div style="font-family:\'Yellowtail\',cursive;font-size:22px;color:#F3EDDD;line-height:1">Oh my <span style="color:#E0A93A">Gogh!</span></div>' +
      '<div style="font-family:\'Space Mono\',monospace;font-size:9px;letter-spacing:.24em;text-transform:uppercase;color:rgba(243,237,221,.45);margin-top:1px">Studio Admin</div></div></div>' +
      '<nav class="adm-navgroup" style="display:flex;flex-direction:column;gap:3px">' + navBtns + '</nav>' +
      '<div class="adm-foot" style="margin-top:auto;display:flex;flex-direction:column;gap:12px">' +
      '<a href="index.html" style="display:flex;align-items:center;gap:9px;text-decoration:none;font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(243,237,221,.6);padding:11px 12px;border:1px solid rgba(243,237,221,.16);border-radius:12px">View storefront ↗</a>' +
      '<div style="display:flex;align-items:center;gap:10px;padding:6px 4px">' +
      '<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#E0A93A,#C0561E);display:flex;align-items:center;justify-content:center;font-weight:700;color:#0E2347;flex:none">P</div>' +
      '<div style="min-width:0"><div style="font-size:13px;font-weight:600;color:#F3EDDD;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Parth S.</div>' +
      '<div style="font-size:11px;color:rgba(243,237,221,.5)">Owner</div></div></div></div></aside>';
  }

  function topbar() {
    var v = state.view;
    var newBtn = '';
    if (v === 'products') newBtn = '<button data-act="newproduct" style="font-size:13px;font-weight:600;color:#F3EDDD;background:#15315C;border:none;border-radius:100px;padding:11px 18px;cursor:pointer;white-space:nowrap;box-shadow:0 8px 18px -8px rgba(21,49,92,.6)">+ New product</button>';
    else if (v === 'discounts') newBtn = '<button data-act="newdiscount" style="font-size:13px;font-weight:600;color:#F3EDDD;background:#2E8A87;border:none;border-radius:100px;padding:11px 18px;cursor:pointer;white-space:nowrap;box-shadow:0 8px 18px -8px rgba(46,138,134,.6)">+ New code</button>';
    else if (v === 'journal') newBtn = '<button data-act="newpost" style="font-size:13px;font-weight:600;color:#F3EDDD;background:#3A6EA8;border:none;border-radius:100px;padding:11px 18px;cursor:pointer;white-space:nowrap;box-shadow:0 8px 18px -8px rgba(58,110,168,.6)">+ New post</button>';
    else if (v === 'artists') newBtn = '<button data-act="newartist" style="font-size:13px;font-weight:600;color:#F3EDDD;background:#C99224;border:none;border-radius:100px;padding:11px 18px;cursor:pointer;white-space:nowrap;box-shadow:0 8px 18px -8px rgba(201,146,36,.6)">+ Add artist</button>';

    return '<header style="position:sticky;top:0;z-index:30;background:rgba(239,232,214,.86);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid rgba(21,49,92,.12);padding:18px clamp(18px,3vw,38px);display:flex;align-items:center;gap:16px;flex-wrap:wrap">' +
      '<div style="min-width:0"><div style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#C0561E">' + CRUMBS[v] + '</div>' +
      '<h1 style="font-family:\'Playfair Display\',serif;font-size:clamp(22px,2.6vw,30px);font-weight:800;line-height:1.1;margin-top:2px">' + TITLES[v] + '</h1></div>' +
      '<div style="margin-left:auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
      '<div style="display:flex;align-items:center;gap:8px;background:#FBF6EA;border:1px solid rgba(21,49,92,.14);border-radius:100px;padding:9px 15px">' +
      '<span style="color:rgba(21,49,92,.4);font-size:13px">⌕</span>' +
      '<input data-act="search" value="' + esc(state.search) + '" placeholder="Search…" style="border:none;background:none;outline:none;font-size:13px;color:#15315C;width:clamp(90px,16vw,180px)"></div>' +
      newBtn + '</div></header>';
  }

  // ===================================================================
  //  VIEWS
  // ===================================================================
  function overviewView() {
    var revenue = store.orders.reduce(function (s, o) { return s + (o.stage >= 1 ? orderTotals(o).total : 0); }, 0);
    var paidCount = store.orders.filter(function (o) { return o.stage >= 1; }).length;
    var kpis = [
      { label: 'Revenue', value: fmt(revenue), delta: '▲ 18%', dc: '#2E8A87', color: '#E0A93A' },
      { label: 'Orders', value: String(store.orders.length), delta: '▲ 6', dc: '#2E8A87', color: '#2E8A87' },
      { label: 'Avg order', value: fmt(revenue / Math.max(1, paidCount)), delta: '▲ 4%', dc: '#2E8A87', color: '#C0561E' },
      { label: 'Conversion', value: '3.2%', delta: '▼ 0.3%', dc: '#C0561E', color: '#3A6EA8' }
    ].map(function (k) {
      return '<div style="background:#FBF6EA;border:1px solid rgba(21,49,92,.1);border-radius:18px;padding:20px 20px 18px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between"><span style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(21,49,92,.55)">' + k.label + '</span>' +
        '<span style="width:10px;height:10px;border-radius:46% 54% 56% 44%/52% 48% 52% 48%;background:' + k.color + '"></span></div>' +
        '<div style="font-family:\'Playfair Display\',serif;font-size:30px;font-weight:800;margin-top:12px;line-height:1">' + k.value + '</div>' +
        '<div style="font-size:12px;margin-top:6px;color:' + k.dc + '">' + k.delta + ' <span style="color:rgba(21,49,92,.45)">vs last month</span></div></div>';
    }).join('');

    var chartVals = [40, 55, 48, 62, 70, 58, 80, 72, 90, 85, 76, 95, 88, 100];
    var bars = chartVals.map(function (h, i) {
      return '<div title="Day ' + (i + 1) + '" style="flex:1;height:' + h + '%;background:linear-gradient(to top,#15315C,#3A6EA8);border-radius:5px 5px 0 0;transform-origin:bottom;animation:admBar .6s ease both;animation-delay:' + (i * 0.04) + 's"></div>';
    }).join('');

    var top = store.products.slice().sort(function (a, b) { return b.sold - a.sold; }).slice(0, 4).map(function (p) {
      return '<div style="display:flex;align-items:center;gap:12px">' +
        '<div style="width:38px;height:46px;border-radius:7px;background:' + cardBg(p.tint) + ';flex:none;box-shadow:0 0 0 1px rgba(21,49,92,.1)"></div>' +
        '<div style="min-width:0;flex:1"><div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(p.name) + '</div>' +
        '<div style="font-family:\'Space Mono\',monospace;font-size:11px;color:rgba(21,49,92,.5)">' + p.sold + ' sold</div></div>' +
        '<span style="font-family:\'Space Mono\',monospace;font-size:13px">' + fmt(p.sold * p.price) + '</span></div>';
    }).join('');

    var rows = store.orders.slice(0, 5).map(orderRow).join('');

    return '<div>' +
      '<div class="adm-kpis" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">' + kpis + '</div>' +
      '<div class="adm-twocol" style="display:grid;grid-template-columns:1.6fr 1fr;gap:16px;margin-top:16px">' +
      '<div style="background:#FBF6EA;border:1px solid rgba(21,49,92,.1);border-radius:18px;padding:22px">' +
      '<div style="display:flex;align-items:baseline;justify-content:space-between"><h2 style="font-family:\'Playfair Display\',serif;font-size:18px;font-weight:700">Revenue · last 14 days</h2><span style="font-family:\'Space Mono\',monospace;font-size:12px;color:#2E8A87">▲ 18%</span></div>' +
      '<div style="display:flex;align-items:flex-end;gap:6px;height:150px;margin-top:20px">' + bars + '</div></div>' +
      '<div style="background:#FBF6EA;border:1px solid rgba(21,49,92,.1);border-radius:18px;padding:22px"><h2 style="font-family:\'Playfair Display\',serif;font-size:18px;font-weight:700">Top pieces</h2>' +
      '<div style="margin-top:14px;display:flex;flex-direction:column;gap:12px">' + top + '</div></div></div>' +
      '<div style="background:#FBF6EA;border:1px solid rgba(21,49,92,.1);border-radius:18px;padding:22px;margin-top:16px">' +
      '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px"><h2 style="font-family:\'Playfair Display\',serif;font-size:18px;font-weight:700">Recent orders</h2>' +
      '<button data-act="go" data-view="orders" style="background:none;border:none;cursor:pointer;font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#15315C;border-bottom:1.5px solid #E0A93A;padding-bottom:3px">View all →</button></div>' +
      '<div style="overflow-x:auto" class="adm-scroll"><table style="width:100%;border-collapse:collapse;min-width:560px">' +
      '<thead><tr style="text-align:left;font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(21,49,92,.5)">' +
      '<th style="padding:10px 8px;font-weight:400">Order</th><th style="padding:10px 8px;font-weight:400">Customer</th><th style="padding:10px 8px;font-weight:400">Date</th><th style="padding:10px 8px;font-weight:400">Payment</th><th style="padding:10px 8px;font-weight:400">Fulfillment</th><th style="padding:10px 8px;font-weight:400;text-align:right">Total</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></div></div>';
  }

  function orderRow(o) {
    var tt = orderTotals(o);
    var items = o.items.reduce(function (s, i) { return s + i.qty; }, 0);
    return '<tr class="adm-row" data-act="openorder" data-id="' + esc(o.id) + '" style="cursor:pointer;border-top:1px solid rgba(21,49,92,.08)">' +
      '<td style="padding:13px 8px;font-family:\'Space Mono\',monospace;font-size:13px;font-weight:700">' + esc(o.id) + '</td>' +
      '<td style="padding:13px 8px;font-size:13px">' + esc(o.customer) + '</td>' +
      '<td style="padding:13px 8px;font-size:13px;color:rgba(21,49,92,.6)">' + esc(o.date) + '</td>' +
      '<td style="padding:13px 8px"><span style="' + payStyleFor(o.stage) + '">' + (o.stage >= 1 ? 'Paid' : 'Pending') + '</span></td>' +
      '<td style="padding:13px 8px"><span style="' + fulfillStyleFor(o.stage) + '">' + fulfillLabel(o.stage) + '</span></td>' +
      '<td style="padding:13px 8px;font-family:\'Space Mono\',monospace;font-size:13px;text-align:right">' + fmt(tt.total) + '</td></tr>';
  }

  function tableShell(minWidth, head, body) {
    return '<div style="background:#FBF6EA;border:1px solid rgba(21,49,92,.1);border-radius:18px;overflow:hidden"><div style="overflow-x:auto" class="adm-scroll">' +
      '<table style="width:100%;border-collapse:collapse;min-width:' + minWidth + 'px">' + head + '<tbody>' + body + '</tbody></table></div></div>';
  }
  function th(label, right) { return '<th style="padding:13px ' + (right ? '16px' : '8px') + ';font-weight:400' + (right ? ';text-align:right' : '') + '">' + label + '</th>'; }
  function headRow(cells) {
    return '<thead><tr style="text-align:left;font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(21,49,92,.5);background:rgba(21,49,92,.03)">' + cells + '</tr></thead>';
  }

  function productsView() {
    var q = state.search.trim().toLowerCase();
    var rows = store.products.filter(function (p) {
      if (state.statusFilter !== 'all' && p.status !== state.statusFilter) return false;
      if (q && p.name.toLowerCase().indexOf(q) < 0 && p.cat.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var body = rows.map(function (p) {
      var invColor = p.inventory === 0 ? '#C0561E' : (p.inventory <= 10 ? '#C99224' : 'rgba(21,49,92,.7)');
      var inv = p.inventory === 0 ? 'Out of stock' : (p.inventory + ' in stock');
      return '<tr class="adm-row" data-act="editproduct" data-id="' + p.id + '" style="cursor:pointer;border-top:1px solid rgba(21,49,92,.08)">' +
        '<td style="padding:12px 16px"><div style="display:flex;align-items:center;gap:12px">' +
        '<div style="width:40px;height:50px;border-radius:7px;background:' + cardBg(p.tint) + ';flex:none;box-shadow:0 0 0 1px rgba(21,49,92,.1)"></div>' +
        '<div><div style="font-size:14px;font-weight:600">' + esc(p.name) + '</div><div style="font-family:\'Space Mono\',monospace;font-size:10px;color:rgba(21,49,92,.45)">' + esc(DB.handleFor(p.name)) + '</div></div></div></td>' +
        '<td style="padding:12px 8px;font-size:13px;color:rgba(21,49,92,.7)">' + esc(p.cat) + '</td>' +
        '<td style="padding:12px 8px">' + statusChip(p.status) + '</td>' +
        '<td style="padding:12px 8px;font-family:\'Space Mono\',monospace;font-size:13px;color:' + invColor + '">' + inv + '</td>' +
        '<td style="padding:12px 8px;font-family:\'Space Mono\',monospace;font-size:13px;text-align:right">' + fmt(p.price) + '</td>' +
        '<td style="padding:12px 16px;text-align:right;color:rgba(21,49,92,.4);font-size:16px">✎</td></tr>';
    }).join('');
    var filters = ['all', 'published', 'draft'].map(function (f) { return filterPill(f, state.statusFilter === f, 'statusFilter'); }).join('');
    var head = headRow(th('Piece') + th('Category') + th('Status') + th('Inventory') + '<th style="padding:13px 8px;font-weight:400;text-align:right">Price</th>' + th('Edit', true));
    return '<div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">' + filters +
      '<span style="margin-left:auto;align-self:center;font-family:\'Space Mono\',monospace;font-size:12px;color:rgba(21,49,92,.5)">' + rows.length + ' products</span></div>' +
      tableShell(680, head, body) + '</div>';
  }

  function ordersView() {
    var q = state.search.trim().toLowerCase();
    var of = state.orderFilter;
    var rows = store.orders.filter(function (o) {
      if (of === 'pending' && !(o.stage < 2)) return false;
      if (of === 'shipped' && o.stage !== 3) return false;
      if (of === 'delivered' && o.stage !== 4) return false;
      if (q && o.customer.toLowerCase().indexOf(q) < 0 && o.id.indexOf(q) < 0) return false;
      return true;
    });
    var body = rows.map(function (o) {
      var tt = orderTotals(o); var items = o.items.reduce(function (s, i) { return s + i.qty; }, 0);
      return '<tr class="adm-row" data-act="openorder" data-id="' + esc(o.id) + '" style="cursor:pointer;border-top:1px solid rgba(21,49,92,.08)">' +
        '<td style="padding:13px 16px;font-family:\'Space Mono\',monospace;font-size:13px;font-weight:700">' + esc(o.id) + '</td>' +
        '<td style="padding:13px 8px"><div style="font-size:13px;font-weight:600">' + esc(o.customer) + '</div><div style="font-size:11px;color:rgba(21,49,92,.5)">' + esc(o.email) + '</div></td>' +
        '<td style="padding:13px 8px;font-size:13px;color:rgba(21,49,92,.6)">' + esc(o.date) + '</td>' +
        '<td style="padding:13px 8px;font-size:13px">' + items + ' items</td>' +
        '<td style="padding:13px 8px"><span style="' + payStyleFor(o.stage) + '">' + (o.stage >= 1 ? 'Paid' : 'Pending') + '</span></td>' +
        '<td style="padding:13px 8px"><span style="' + fulfillStyleFor(o.stage) + '">' + fulfillLabel(o.stage) + '</span></td>' +
        '<td style="padding:13px 16px;font-family:\'Space Mono\',monospace;font-size:13px;text-align:right">' + fmt(tt.total) + '</td></tr>';
    }).join('');
    var filters = ['all', 'pending', 'shipped', 'delivered'].map(function (f) { return filterPill(f, of === f, 'orderFilter'); }).join('');
    var head = headRow(th('Order') + th('Customer') + th('Date') + th('Items') + th('Payment') + th('Fulfillment') + th('Total', true));
    return '<div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">' + filters +
      '<span style="margin-left:auto;align-self:center;font-family:\'Space Mono\',monospace;font-size:12px;color:rgba(21,49,92,.5)">' + rows.length + ' orders</span></div>' +
      tableShell(720, head, body) + '</div>';
  }

  function customersView() {
    var q = state.search.trim().toLowerCase();
    var rows = store.customers.filter(function (c) {
      if (state.custFilter !== 'all' && c.status !== state.custFilter) return false;
      if (q && c.name.toLowerCase().indexOf(q) < 0 && c.email.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var body = rows.map(function (c, i) {
      return '<tr class="adm-row" data-act="opencust" data-id="' + c.id + '" style="cursor:pointer;border-top:1px solid rgba(21,49,92,.08)">' +
        '<td style="padding:13px 16px"><div style="display:flex;align-items:center;gap:11px">' +
        '<div style="width:36px;height:36px;border-radius:50%;background:' + AVATARS[i % AVATARS.length] + ';display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#0E2347;flex:none">' + esc(c.name.charAt(0)) + '</div>' +
        '<div><div style="font-size:14px;font-weight:600">' + esc(c.name) + '</div><div style="font-size:11px;color:rgba(21,49,92,.5)">' + esc(c.email) + '</div></div></div></td>' +
        '<td style="padding:13px 8px;font-size:13px;color:rgba(21,49,92,.65)">' + esc(c.location) + '</td>' +
        '<td style="padding:13px 8px;font-family:\'Space Mono\',monospace;font-size:13px">' + c.orderCount + '</td>' +
        '<td style="padding:13px 8px;font-family:\'Space Mono\',monospace;font-size:13px;font-weight:700">$' + c.ltv + '</td>' +
        '<td style="padding:13px 8px;font-size:13px;color:rgba(21,49,92,.6)">Jun 28</td>' +
        '<td style="padding:13px 8px">' + statusChip(c.status) + '</td></tr>';
    }).join('');
    var filters = ['all', 'active', 'inactive'].map(function (f) { return filterPill(f, state.custFilter === f, 'custFilter'); }).join('');
    var head = headRow(th('Customer') + th('Location') + th('Orders') + th('Lifetime value') + th('Last order') + th('Status'));
    return '<div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;align-items:center">' + filters +
      '<span style="margin-left:auto;font-family:\'Space Mono\',monospace;font-size:12px;color:rgba(21,49,92,.5)">' + rows.length + ' customers</span></div>' +
      tableShell(680, head, body) + '</div>';
  }

  function discountsView() {
    var rows = store.discounts.filter(function (d) {
      if (state.discFilter === 'active') return d.active;
      if (state.discFilter === 'inactive') return !d.active;
      return true;
    });
    var body = rows.map(function (d) {
      var valueTxt = d.type === 'pct' ? (d.value + '% off') : ('$' + d.value + ' off');
      var usedTxt = d.limit > 0 ? (d.used + '/' + d.limit) : (d.used + ' uses');
      return '<tr class="adm-row" data-act="editdisc" data-id="' + d.id + '" style="cursor:pointer;border-top:1px solid rgba(21,49,92,.08)">' +
        '<td style="padding:13px 16px;font-family:\'Space Mono\',monospace;font-size:14px;font-weight:700;letter-spacing:.06em">' + esc(d.code) + '</td>' +
        '<td style="padding:13px 8px;font-size:13px;color:rgba(21,49,92,.65)">' + (d.type === 'pct' ? 'Percentage' : 'Fixed amount') + '</td>' +
        '<td style="padding:13px 8px;font-family:\'Space Mono\',monospace;font-size:14px;color:#2E8A87;font-weight:700">' + valueTxt + '</td>' +
        '<td style="padding:13px 8px;font-family:\'Space Mono\',monospace;font-size:12px;color:rgba(21,49,92,.6)">' + usedTxt + '</td>' +
        '<td style="padding:13px 8px;font-size:13px;color:rgba(21,49,92,.6)">' + esc(d.expires || 'No expiry') + '</td>' +
        '<td style="padding:13px 8px">' + (d.active ? chip('46,138,134', 'Active') : chip('120,120,120', 'Inactive')) + '</td>' +
        '<td style="padding:13px 16px;text-align:right;color:rgba(21,49,92,.4);font-size:16px">✎</td></tr>';
    }).join('');
    var filters = ['all', 'active', 'inactive'].map(function (f) { return filterPill(f, state.discFilter === f, 'discFilter'); }).join('');
    var head = headRow(th('Code') + th('Type') + th('Value') + th('Used') + th('Expires') + th('Status') + th('Edit', true));
    return '<div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;align-items:center">' + filters +
      '<span style="margin-left:auto;font-family:\'Space Mono\',monospace;font-size:12px;color:rgba(21,49,92,.5)">' + rows.length + ' codes</span></div>' +
      tableShell(640, head, body) + '</div>';
  }

  function collectionsView() {
    var cards = store.collections.map(function (col) {
      var thumbs = col.productIds.slice(0, 4).map(function (pid) {
        var p = store.products.find(function (x) { return x.id === pid; });
        return '<div style="aspect-ratio:1;background:' + cardBg(p ? p.tint : '20,42,84') + '"></div>';
      });
      while (thumbs.length < 4) thumbs.push('<div style="aspect-ratio:1;background:' + cardBg('20,42,84') + '"></div>');
      return '<div class="adm-card-hover" data-act="editcol" data-id="' + col.id + '" style="background:#FBF6EA;border:1px solid rgba(21,49,92,.1);border-radius:18px;overflow:hidden;cursor:pointer">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:3px;background:rgba(21,49,92,.06)">' + thumbs.join('') + '</div>' +
        '<div style="padding:16px 18px"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +
        '<h3 style="font-family:\'Playfair Display\',serif;font-size:18px;font-weight:700">' + esc(col.name) + '</h3>' + statusChip(col.status) + '</div>' +
        '<p style="font-size:13px;color:rgba(21,49,92,.6);margin-top:5px;line-height:1.5">' + esc(col.desc) + '</p>' +
        '<div style="font-family:\'Space Mono\',monospace;font-size:11px;color:rgba(21,49,92,.45);margin-top:10px">' + col.productIds.length + ' pieces</div></div></div>';
    }).join('');
    var add = '<button class="adm-dash" data-act="newcol" style="background:transparent;border:1.5px dashed rgba(21,49,92,.22);border-radius:18px;padding:40px 20px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:rgba(21,49,92,.5)">' +
      '<span style="font-size:28px">+</span><span style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase">New collection</span></button>';
    return '<div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">' + cards + add + '</div></div>';
  }

  function journalView() {
    var q = state.search.trim().toLowerCase();
    var rows = store.journal.filter(function (p) {
      if (state.jrnFilter !== 'all' && p.status !== state.jrnFilter) return false;
      if (q && p.title.toLowerCase().indexOf(q) < 0 && p.cat.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var body = rows.map(function (p) {
      return '<tr class="adm-row" data-act="editjrn" data-id="' + p.id + '" style="cursor:pointer;border-top:1px solid rgba(21,49,92,.08)">' +
        '<td style="padding:13px 16px"><div style="display:flex;align-items:center;gap:10px">' +
        '<div style="width:40px;height:40px;border-radius:8px;background:' + cardBg(p.tint) + ';flex:none"></div>' +
        '<div style="font-size:14px;font-weight:600;line-height:1.3">' + esc(p.title) + '</div></div></td>' +
        '<td style="padding:13px 8px"><span style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#2E8A87">' + esc(p.cat) + '</span></td>' +
        '<td style="padding:13px 8px;font-size:13px;color:rgba(21,49,92,.65)">' + esc(p.author) + '</td>' +
        '<td style="padding:13px 8px">' + statusChip(p.status) + '</td>' +
        '<td style="padding:13px 8px;font-size:13px;color:rgba(21,49,92,.6)">' + esc(p.date) + '</td>' +
        '<td style="padding:13px 16px;text-align:right;color:rgba(21,49,92,.4);font-size:16px">✎</td></tr>';
    }).join('');
    var filters = ['all', 'published', 'draft'].map(function (f) { return filterPill(f, state.jrnFilter === f, 'jrnFilter'); }).join('');
    var head = headRow(th('Title') + th('Category') + th('Author') + th('Status') + th('Date') + th('Edit', true));
    return '<div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;align-items:center">' + filters +
      '<span style="margin-left:auto;font-family:\'Space Mono\',monospace;font-size:12px;color:rgba(21,49,92,.5)">' + rows.length + ' posts</span></div>' +
      tableShell(620, head, body) + '</div>';
  }

  function artistsView() {
    var cards = store.artists.map(function (a) {
      var pCount = store.products.filter(function (p) { return p.artist === a.name; }).length;
      var chipEl = a.featured ? chip('224,169,58', 'Featured') : chip('46,138,134', 'Active');
      return '<div class="adm-card-hover" data-act="editartist" data-id="' + a.id + '" style="background:#FBF6EA;border:1px solid rgba(21,49,92,.1);border-radius:18px;padding:20px;cursor:pointer;display:flex;flex-direction:column;gap:14px">' +
        '<div style="display:flex;align-items:center;gap:13px">' +
        '<div style="width:52px;height:52px;border-radius:50%;background:' + cardBg(a.tint) + ';flex:none;box-shadow:0 4px 12px -4px rgba(14,35,71,.4);display:flex;align-items:center;justify-content:center;font-family:\'Playfair Display\',serif;font-size:20px;font-weight:800;color:#F3EDDD">' + esc(a.name.charAt(0)) + '</div>' +
        '<div style="flex:1;min-width:0"><div style="font-family:\'Playfair Display\',serif;font-size:17px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(a.name) + '</div>' +
        '<div style="font-size:12px;color:rgba(21,49,92,.55)">' + esc(a.medium) + '</div></div>' + chipEl + '</div>' +
        '<div style="font-size:13px;color:rgba(21,49,92,.65);line-height:1.5">' + esc(a.location) + '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid rgba(21,49,92,.1)">' +
        '<span style="font-family:\'Space Mono\',monospace;font-size:11px;color:rgba(21,49,92,.5)">' + pCount + ' pieces</span>' +
        '<span style="font-family:\'Space Mono\',monospace;font-size:11px;color:rgba(21,49,92,.5)">' + esc(a.medium) + '</span></div></div>';
    }).join('');
    var add = '<button class="adm-dash" data-act="newartist" style="background:transparent;border:1.5px dashed rgba(21,49,92,.22);border-radius:18px;padding:40px 20px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:rgba(21,49,92,.5);min-height:180px">' +
      '<span style="font-size:28px">+</span><span style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase">Add collaborator</span></button>';
    return '<div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px">' + cards + add + '</div></div>';
  }

  function paymentsView() {
    var meta = {
      stripe: { name: 'Stripe', desc: 'Cards, Apple Pay, Google Pay', initial: 'S', mark: '#635BFF', fields: [{ k: 'f1', label: 'Publishable key', ph: 'pk_live_…' }, { k: 'f2', label: 'Secret key', ph: 'sk_live_…' }] },
      paypal: { name: 'PayPal', desc: 'PayPal balance & cards', initial: 'P', mark: '#003087', fields: [{ k: 'f1', label: 'Client ID', ph: 'AY…' }, { k: 'f2', label: 'Secret', ph: 'EH…' }] },
      razorpay: { name: 'Razorpay', desc: 'UPI, cards, netbanking (India)', initial: 'R', mark: '#0C2451', fields: [{ k: 'f1', label: 'Key ID', ph: 'rzp_live_…' }, { k: 'f2', label: 'Key secret', ph: '••••' }] },
      manual: { name: 'Manual / COD', desc: 'Cash or bank transfer', initial: 'M', mark: '#2E8A87', fields: [{ k: 'f1', label: 'Instructions', ph: 'Wire to account…' }] }
    };
    var cards = ['stripe', 'paypal', 'razorpay', 'manual'].map(function (k) {
      var st = store.providers[k]; var m = meta[k]; var isTest = st.mode === 'test';
      var seg = 'font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;padding:6px 12px;border-radius:8px;cursor:pointer;border:1px solid ';
      var fields = st.enabled ? '<div style="margin-top:16px;display:flex;flex-direction:column;gap:11px;animation:admIn .3s ease">' +
        m.fields.map(function (f) {
          return '<label style="display:block"><span style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(21,49,92,.55)">' + f.label + '</span>' +
            '<input data-prov="' + k + '" data-pf="' + f.k + '" value="' + esc(st[f.k] || '') + '" placeholder="' + f.ph + '" style="width:100%;margin-top:5px;font-family:\'Space Mono\',monospace;font-size:12px;color:#15315C;background:#fff;border:1px solid rgba(21,49,92,.18);border-radius:10px;padding:10px 12px;outline:none"></label>';
        }).join('') +
        '<div style="display:flex;align-items:center;gap:8px;margin-top:2px"><span style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(21,49,92,.55)">Mode</span>' +
        '<button data-act="provmode" data-key="' + k + '" data-mode="test" style="' + seg + (isTest ? '#15315C;background:#15315C;color:#F3EDDD' : 'rgba(21,49,92,.22);background:transparent;color:#15315C') + '">Test</button>' +
        '<button data-act="provmode" data-key="' + k + '" data-mode="live" style="' + seg + (!isTest ? '#15315C;background:#15315C;color:#F3EDDD' : 'rgba(21,49,92,.22);background:transparent;color:#15315C') + '">Live</button></div></div>' : '';
      return '<div style="background:#FBF6EA;border:1px solid ' + (st.enabled ? 'rgba(46,138,134,.5)' : 'rgba(21,49,92,.1)') + ';border-radius:18px;padding:20px">' +
        '<div style="display:flex;align-items:center;gap:12px">' +
        '<div style="width:46px;height:46px;border-radius:12px;background:' + m.mark + ';display:flex;align-items:center;justify-content:center;font-family:\'Space Mono\',monospace;font-weight:700;font-size:18px;color:#fff;flex:none">' + m.initial + '</div>' +
        '<div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:700">' + m.name + '</div><div style="font-size:12px;color:rgba(21,49,92,.55)">' + m.desc + '</div></div>' +
        '<button data-act="provtoggle" data-key="' + k + '" role="switch" aria-checked="' + st.enabled + '" style="width:46px;height:26px;border-radius:100px;border:none;cursor:pointer;background:' + (st.enabled ? '#2E8A87' : 'rgba(21,49,92,.2)') + ';position:relative;flex:none;transition:background .25s">' +
        '<span style="position:absolute;top:3px;left:' + (st.enabled ? '23px' : '3px') + ';width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 2px 5px rgba(0,0,0,.25);transition:left .25s"></span></button></div>' + fields + '</div>';
    }).join('');
    return '<div><div style="background:#15315C;color:#F3EDDD;border-radius:18px;padding:22px 24px;display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">' +
      '<span style="font-size:24px">🔌</span><div style="flex:1;min-width:240px"><h2 style="font-family:\'Playfair Display\',serif;font-size:20px;font-weight:700">Payment providers</h2>' +
      '<p style="font-size:13px;line-height:1.6;color:rgba(243,237,221,.78);margin-top:6px;max-width:62ch">Enable a provider and drop in its keys. These map to your commerce backend\'s payment plugins (works with <span style="font-family:\'Space Mono\',monospace;color:#E0A93A">Vendure</span>, <span style="font-family:\'Space Mono\',monospace;color:#E0A93A">WooCommerce</span> or any open-source engine). Use test keys here.</p></div></div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-top:16px">' + cards + '</div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:18px"><button data-act="savepayments" style="font-size:14px;font-weight:600;color:#F3EDDD;background:#15315C;border:none;border-radius:100px;padding:13px 26px;cursor:pointer;box-shadow:0 10px 22px -10px rgba(21,49,92,.6)">Save configuration</button></div></div>';
  }

  function settingsView() {
    var s = store.settings;
    var fields = [['store', 'Store name'], ['email', 'Support email'], ['currency', 'Currency']].map(function (f) {
      return '<label style="display:block"><span style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(21,49,92,.55)">' + f[1] + '</span>' +
        '<input data-sfield="' + f[0] + '" value="' + esc(s[f[0]]) + '" style="width:100%;margin-top:5px;font-size:14px;color:#15315C;background:#fff;border:1px solid rgba(21,49,92,.18);border-radius:10px;padding:11px 13px;outline:none"></label>';
    }).join('');
    return '<div style="max-width:680px;display:flex;flex-direction:column;gap:16px">' +
      '<div style="background:#FBF6EA;border:1px solid rgba(21,49,92,.1);border-radius:18px;padding:22px"><h2 style="font-family:\'Playfair Display\',serif;font-size:18px;font-weight:700;margin-bottom:16px">Store profile</h2>' +
      '<div style="display:flex;flex-direction:column;gap:14px">' + fields + '</div></div>' +
      '<div style="background:#FBF6EA;border:1px solid rgba(21,49,92,.1);border-radius:18px;padding:22px"><h2 style="font-family:\'Playfair Display\',serif;font-size:18px;font-weight:700;margin-bottom:6px">Shipping</h2>' +
      '<p style="font-size:13px;color:rgba(21,49,92,.6);line-height:1.6">Free shipping over $75 · $8 flat otherwise. Maps to a <span style="font-family:\'Space Mono\',monospace">shipping zone</span> in your commerce backend; edit rates there after integration.</p></div>' +
      '<div style="background:#FBF6EA;border:1px solid rgba(21,49,92,.1);border-radius:18px;padding:22px"><h2 style="font-family:\'Playfair Display\',serif;font-size:18px;font-weight:700;margin-bottom:6px">Demo data</h2>' +
      '<p style="font-size:13px;color:rgba(21,49,92,.6);line-height:1.6;margin-bottom:14px">Reset the catalog, orders and content back to the seeded sample data.</p>' +
      '<button data-act="resetdata" style="font-size:13px;color:#C0561E;background:transparent;border:1.5px solid rgba(192,86,30,.4);border-radius:100px;padding:11px 20px;cursor:pointer">Reset to sample data</button></div>' +
      '<div style="display:flex;justify-content:flex-end"><button data-act="savesettings" style="font-size:14px;font-weight:600;color:#F3EDDD;background:#15315C;border:none;border-radius:100px;padding:13px 26px;cursor:pointer;box-shadow:0 10px 22px -10px rgba(21,49,92,.6)">Save settings</button></div></div>';
  }

  function bodyView() {
    switch (state.view) {
      case 'products': return productsView();
      case 'orders': return ordersView();
      case 'customers': return customersView();
      case 'discounts': return discountsView();
      case 'collections': return collectionsView();
      case 'journal': return journalView();
      case 'artists': return artistsView();
      case 'payments': return paymentsView();
      case 'settings': return settingsView();
      default: return overviewView();
    }
  }

  // ===================================================================
  //  DRAWERS
  // ===================================================================
  function drawerShell(width, eyebrow, eyebrowColor, title, bodyHtml) {
    return '<div data-act="closedrawer" style="position:fixed;inset:0;z-index:90;background:rgba(14,35,71,.34);backdrop-filter:blur(2px)"></div>' +
      '<aside class="adm-drawer adm-scroll" style="position:fixed;top:0;right:0;bottom:0;width:' + width + 'px;max-width:100%;background:#EFE8D6;z-index:100;overflow-y:auto;box-shadow:-20px 0 60px -20px rgba(14,35,71,.5);animation:admDrawer .32s cubic-bezier(.16,1,.3,1)">' +
      '<div style="position:sticky;top:0;background:rgba(239,232,214,.92);backdrop-filter:blur(10px);padding:18px 24px;border-bottom:1px solid rgba(21,49,92,.12);display:flex;align-items:center;justify-content:space-between;z-index:5">' +
      '<div><div style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:' + eyebrowColor + '">' + esc(eyebrow) + '</div>' +
      '<h2 style="font-family:\'Playfair Display\',serif;font-size:22px;font-weight:800;line-height:1.1">' + esc(title) + '</h2></div>' +
      '<button data-act="closedrawer" style="width:36px;height:36px;border-radius:50%;border:1px solid rgba(21,49,92,.18);background:#FBF6EA;cursor:pointer;font-size:16px;color:#15315C;flex:none">✕</button></div>' +
      '<div style="padding:22px 24px 40px;display:flex;flex-direction:column;gap:18px">' + bodyHtml + '</div></aside>';
  }
  function lbl(text) { return '<span style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(21,49,92,.55)">' + text + '</span>'; }
  function inputField(field, value, ph, extra) {
    return '<input data-dfield="' + field + '" value="' + esc(value == null ? '' : value) + '" placeholder="' + esc(ph || '') + '" style="width:100%;margin-top:5px;font-size:14px;color:#15315C;background:#fff;border:1px solid rgba(21,49,92,.18);border-radius:10px;padding:11px 13px;outline:none;' + (extra || '') + '">';
  }
  function toggleSwitch(act, on) {
    return '<button data-act="' + act + '" style="width:46px;height:26px;border-radius:100px;border:none;cursor:pointer;background:' + (on ? '#2E8A87' : 'rgba(21,49,92,.2)') + ';position:relative;flex:none;transition:background .25s">' +
      '<span style="position:absolute;top:3px;left:' + (on ? '23px' : '3px') + ';width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 2px 5px rgba(0,0,0,.25);transition:left .25s"></span></button>';
  }
  function switchRow(label, sub, act, on) {
    return '<div style="display:flex;align-items:center;justify-content:space-between;background:#FBF6EA;border:1px solid rgba(21,49,92,.12);border-radius:12px;padding:14px 16px">' +
      '<div><div style="font-size:14px;font-weight:600">' + label + '</div><div style="font-size:12px;color:rgba(21,49,92,.55)">' + sub + '</div></div>' + toggleSwitch(act, on) + '</div>';
  }
  function saveBar(saveAct, saveLabel, delAct, delLabel) {
    var del = delAct ? '<button data-act="' + delAct + '" style="font-size:14px;color:#C0561E;background:transparent;border:1.5px solid rgba(192,86,30,.4);border-radius:100px;padding:14px 20px;cursor:pointer">' + delLabel + '</button>' : '';
    return '<div style="display:flex;gap:12px;margin-top:4px"><button data-act="' + saveAct + '" style="flex:1;font-size:15px;font-weight:600;color:#F3EDDD;background:#15315C;border:none;border-radius:100px;padding:14px;cursor:pointer;box-shadow:0 10px 22px -10px rgba(21,49,92,.6)">' + saveLabel + '</button>' + del + '</div>';
  }

  function productDrawer() {
    var d = state.draft;
    var cats = ['Apparel', 'Art Supplies', 'Accessories', 'Books'].map(function (c) {
      var active = d.cat === c;
      return '<button data-act="pcat" data-cat="' + esc(c) + '" style="padding:8px 14px;border-radius:100px;font-size:12px;cursor:pointer;border:1px solid ' + (active ? '#15315C;background:#15315C;color:#F3EDDD' : 'rgba(21,49,92,.22);background:#fff;color:#15315C') + '">' + c + '</button>';
    }).join('');
    var sizes = ['S', 'M', 'L', 'XL', 'One'].map(function (sz) {
      var active = (d.sizes || []).indexOf(sz) >= 0;
      return '<button data-act="psize" data-size="' + sz + '" style="min-width:42px;padding:8px 12px;border-radius:10px;font-family:\'Space Mono\',monospace;font-size:12px;cursor:pointer;border:1px solid ' + (active ? '#15315C;background:#15315C;color:#F3EDDD' : 'rgba(21,49,92,.22);background:#fff;color:#15315C') + '">' + sz + '</button>';
    }).join('');
    var published = d.status === 'published';
    var body =
      '<div><span style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(21,49,92,.55)">Product image</span>' +
      '<div style="display:block;width:100%;aspect-ratio:4/3;margin-top:7px;border-radius:12px;background:' + cardBg(d.tint || '20,42,84') + '"></div></div>' +
      '<label style="display:block">' + lbl('Title') + inputField('name', d.name, 'e.g. Starry Night Crew Tee', 'font-weight:600;font-size:15px') + '</label>' +
      '<label style="display:block">' + lbl('Description') + '<textarea data-dfield="blurb" rows="3" placeholder="What makes this piece special…" style="width:100%;margin-top:5px;font-size:14px;line-height:1.5;color:#15315C;background:#fff;border:1px solid rgba(21,49,92,.18);border-radius:10px;padding:11px 13px;outline:none;resize:vertical;font-family:\'Space Grotesk\',sans-serif">' + esc(d.blurb) + '</textarea></label>' +
      '<div style="display:flex;gap:12px"><label style="flex:1">' + lbl('Price (USD)') + '<input data-dfield="price" type="number" value="' + esc(d.price) + '" style="width:100%;margin-top:5px;font-family:\'Space Mono\',monospace;font-size:14px;color:#15315C;background:#fff;border:1px solid rgba(21,49,92,.18);border-radius:10px;padding:11px 13px;outline:none"></label>' +
      '<label style="flex:1">' + lbl('Inventory') + '<input data-dfield="inventory" type="number" value="' + esc(d.inventory) + '" style="width:100%;margin-top:5px;font-family:\'Space Mono\',monospace;font-size:14px;color:#15315C;background:#fff;border:1px solid rgba(21,49,92,.18);border-radius:10px;padding:11px 13px;outline:none"></label></div>' +
      '<div>' + lbl('Category') + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:7px">' + cats + '</div></div>' +
      '<div>' + lbl('Variants / sizes') + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:7px">' + sizes + '</div></div>' +
      switchRow('Published', 'Visible in the storefront', 'ptogglestatus', published) +
      saveBar('saveproduct', state.isNew ? 'Create product' : 'Save changes', state.isNew ? null : 'delproduct', 'Delete');
    return drawerShell(480, state.isNew ? 'New product' : 'Edit product', '#C0561E', state.isNew ? 'Create a piece' : (d.name || 'Untitled'), body);
  }

  function orderDrawer() {
    var o = store.orders.find(function (x) { return x.id === state.selOrderId; });
    if (!o) return '';
    var tt = orderTotals(o);
    var stageLabels = ['Ordered', 'Payment confirmed', 'Fulfilled', 'Shipped', 'Delivered'];
    var stageSubs = ['Order placed by customer', 'Charged via ' + o.method, 'Packed in the studio', o.tracking ? ('Tracking ' + o.tracking) : 'Handed to carrier', 'Arrived at destination'];
    var timeline = stageLabels.map(function (lab, i) {
      var done = i <= o.stage, current = i === o.stage;
      var dotBg = done ? (current ? '#E0A93A' : '#2E8A87') : '#EFE8D6';
      var dotBorder = done ? (current ? '#E0A93A' : '#2E8A87') : 'rgba(21,49,92,.25)';
      var lineBg = i < o.stage ? '#2E8A87' : 'rgba(21,49,92,.15)';
      var connector = i < 4 ? '<div style="width:2px;height:26px;background:' + lineBg + '"></div>' : '';
      return '<div style="display:flex;gap:14px;align-items:flex-start"><div style="display:flex;flex-direction:column;align-items:center;flex:none">' +
        '<div style="width:22px;height:22px;border-radius:50%;background:' + dotBg + ';border:2px solid ' + dotBorder + ';display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px">' + (done ? '✓' : '') + '</div>' + connector + '</div>' +
        '<div style="padding-bottom:14px"><div style="font-size:14px;font-weight:600;color:' + (done ? '#15315C' : 'rgba(21,49,92,.45)') + '">' + lab + '</div>' +
        '<div style="font-size:12px;color:rgba(21,49,92,.5)">' + (done ? esc(stageSubs[i]) : 'Pending') + '</div></div></div>';
    }).join('');
    var advLabel = ['Confirm payment', 'Mark as fulfilled', 'Mark as shipped', 'Mark as delivered', 'Delivered'][o.stage];
    var advance = o.stage < 4 ? '<button data-act="advorder" style="width:100%;margin-top:8px;font-size:14px;font-weight:600;color:#F3EDDD;background:#2E8A87;border:none;border-radius:100px;padding:12px;cursor:pointer">' + advLabel + '</button>' : '';
    var items = o.items.map(function (it) {
      var p = store.products.find(function (x) { return x.id === it.pid; }) || { name: '—', price: 0, tint: '20,42,84' };
      return '<div style="display:flex;gap:12px;align-items:center"><div style="width:40px;height:50px;border-radius:7px;background:' + cardBg(p.tint) + ';flex:none;box-shadow:0 0 0 1px rgba(21,49,92,.1)"></div>' +
        '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600">' + esc(p.name) + '</div><div style="font-family:\'Space Mono\',monospace;font-size:11px;color:rgba(21,49,92,.5)">Qty ' + it.qty + ' · ' + esc(it.size) + '</div></div>' +
        '<span style="font-family:\'Space Mono\',monospace;font-size:14px">' + fmt(p.price * it.qty) + '</span></div>';
    }).join('');

    var body =
      '<div style="background:#FBF6EA;border:1px solid rgba(21,49,92,.12);border-radius:16px;padding:20px"><div style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(21,49,92,.55);margin-bottom:18px">Fulfillment status</div>' + timeline + advance + '</div>' +
      '<div>' + lbl('Tracking number') + '<input data-act="settracking" value="' + esc(o.tracking) + '" placeholder="Add carrier tracking…" style="width:100%;margin-top:6px;font-family:\'Space Mono\',monospace;font-size:13px;color:#15315C;background:#fff;border:1px solid rgba(21,49,92,.18);border-radius:10px;padding:11px 13px;outline:none"></div>' +
      '<div><div style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(21,49,92,.55);margin-bottom:10px">Items</div><div style="display:flex;flex-direction:column;gap:12px">' + items + '</div></div>' +
      '<div style="background:#FBF6EA;border:1px solid rgba(21,49,92,.12);border-radius:16px;padding:18px">' +
      '<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:rgba(21,49,92,.7)"><span>Subtotal</span><span style="font-family:\'Space Mono\',monospace">' + fmt(tt.sub) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:rgba(21,49,92,.7)"><span>Shipping</span><span style="font-family:\'Space Mono\',monospace">' + (tt.ship === 0 ? 'Free' : fmt(tt.ship)) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;padding:10px 0 0;margin-top:6px;border-top:1px solid rgba(21,49,92,.12)"><span style="font-family:\'Playfair Display\',serif;font-size:17px;font-weight:700">Total</span><span style="font-family:\'Space Mono\',monospace;font-size:18px">' + fmt(tt.total) + '</span></div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin-top:14px"><span style="' + payStyleFor(o.stage) + '">' + (o.stage >= 1 ? 'Paid' : 'Pending') + '</span><span style="font-size:12px;color:rgba(21,49,92,.5)">via ' + esc(o.method) + '</span></div></div>' +
      '<div><div style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(21,49,92,.55);margin-bottom:8px">Customer</div>' +
      '<div style="font-size:14px">' + esc(o.customer) + '</div><div style="font-size:13px;color:rgba(21,49,92,.6)">' + esc(o.email) + '</div>' +
      '<div style="font-size:13px;color:rgba(21,49,92,.6);margin-top:4px;line-height:1.5">' + esc(o.address) + '</div></div>';
    return drawerShell(480, 'Order ' + o.id, '#C0561E', o.customer, body);
  }

  function customerDrawer() {
    var c = store.customers.find(function (x) { return x.id === state.selCustId; });
    if (!c) return '';
    var idx = store.customers.indexOf(c);
    var orders = store.orders.filter(function (o) { return o.customer === c.name; }).map(function (o) {
      var tt = orderTotals(o); var items = o.items.reduce(function (s, i) { return s + i.qty; }, 0);
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:#FBF6EA;border:1px solid rgba(21,49,92,.1);border-radius:12px;padding:12px 16px">' +
        '<div><div style="font-family:\'Space Mono\',monospace;font-size:13px;font-weight:700">' + esc(o.id) + '</div><div style="font-size:12px;color:rgba(21,49,92,.55);margin-top:2px">' + items + ' items</div></div>' +
        '<div style="text-align:right"><div style="font-family:\'Space Mono\',monospace;font-size:13px">' + fmt(tt.total) + '</div><span style="' + fulfillStyleFor(o.stage) + '">' + fulfillLabel(o.stage) + '</span></div></div>';
    }).join('') || '<p style="font-size:13px;color:rgba(21,49,92,.5)">No orders yet.</p>';
    var stat = function (val, label) {
      return '<div style="background:#FBF6EA;border:1px solid rgba(21,49,92,.1);border-radius:12px;padding:14px;text-align:center"><div style="font-family:\'Playfair Display\',serif;font-size:22px;font-weight:800">' + val + '</div><div style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(21,49,92,.5);margin-top:4px">' + label + '</div></div>';
    };
    var body =
      '<div style="display:flex;align-items:center;gap:14px"><div style="width:56px;height:56px;border-radius:50%;background:' + AVATARS[idx % AVATARS.length] + ';display:flex;align-items:center;justify-content:center;font-family:\'Playfair Display\',serif;font-size:24px;font-weight:800;color:#0E2347;flex:none">' + esc(c.name.charAt(0)) + '</div>' +
      '<div><div style="font-size:16px;font-weight:700">' + esc(c.name) + '</div><div style="font-size:13px;color:rgba(21,49,92,.6)">' + esc(c.email) + '</div>' +
      '<div style="font-size:12px;color:rgba(21,49,92,.5);margin-top:2px">' + esc(c.location) + ' · Customer since ' + esc(c.since) + '</div></div></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">' + stat(c.orderCount, 'Orders') + stat('$' + c.ltv, 'Lifetime') + stat('$' + c.avg, 'Avg order') + '</div>' +
      '<div><div style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(21,49,92,.55);margin-bottom:10px">Order history</div><div style="display:flex;flex-direction:column;gap:8px">' + orders + '</div></div>' +
      '<div>' + lbl('Internal note') + '<textarea data-act="setcustnote" rows="3" placeholder="Add a note about this customer…" style="width:100%;margin-top:6px;font-size:14px;line-height:1.5;color:#15315C;background:#fff;border:1px solid rgba(21,49,92,.18);border-radius:10px;padding:11px 13px;outline:none;resize:vertical;font-family:\'Space Grotesk\',sans-serif">' + esc(c.note) + '</textarea></div>';
    return drawerShell(480, 'Customer', '#C0561E', c.name, body);
  }

  function discountDrawer() {
    var d = state.draft;
    var types = [['pct', 'Percentage'], ['fixed', 'Fixed amount']].map(function (t) {
      var active = d.type === t[0];
      return '<button data-act="dtype" data-type="' + t[0] + '" style="padding:9px 18px;border-radius:100px;font-family:\'Space Mono\',monospace;font-size:12px;cursor:pointer;border:1px solid ' + (active ? '#15315C;background:#15315C;color:#F3EDDD' : 'rgba(21,49,92,.22);background:transparent;color:#15315C') + '">' + t[1] + '</button>';
    }).join('');
    var body =
      '<label style="display:block">' + lbl('Code') + '<input data-dfield="code" value="' + esc(d.code) + '" placeholder="e.g. STARRY20" style="width:100%;margin-top:5px;font-family:\'Space Mono\',monospace;font-size:16px;font-weight:700;letter-spacing:.06em;color:#15315C;background:#fff;border:1px solid rgba(21,49,92,.18);border-radius:10px;padding:11px 13px;outline:none;text-transform:uppercase"></label>' +
      '<div>' + lbl('Type') + '<div style="display:flex;gap:8px;margin-top:7px">' + types + '</div></div>' +
      '<label style="display:block">' + lbl(d.type === 'pct' ? 'Percentage (%)' : 'Fixed amount ($)') + '<input data-dfield="value" type="number" value="' + esc(d.value) + '" placeholder="e.g. 15" style="width:100%;margin-top:5px;font-family:\'Space Mono\',monospace;font-size:15px;color:#15315C;background:#fff;border:1px solid rgba(21,49,92,.18);border-radius:10px;padding:11px 13px;outline:none"></label>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><label style="display:block">' + lbl('Usage limit') + '<input data-dfield="limit" type="number" value="' + esc(d.limit) + '" placeholder="∞" style="width:100%;margin-top:5px;font-family:\'Space Mono\',monospace;font-size:14px;color:#15315C;background:#fff;border:1px solid rgba(21,49,92,.18);border-radius:10px;padding:11px 13px;outline:none"></label>' +
      '<label style="display:block">' + lbl('Expires') + '<input data-dfield="expires" type="date" value="' + esc(d.expires) + '" style="width:100%;margin-top:5px;font-family:\'Space Mono\',monospace;font-size:13px;color:#15315C;background:#fff;border:1px solid rgba(21,49,92,.18);border-radius:10px;padding:11px 13px;outline:none"></label></div>' +
      switchRow('Active', 'Customers can use this code', 'dtoggle', d.active) +
      saveBar('savedisc', state.isNew ? 'Create code' : 'Save changes', state.isNew ? null : 'deldisc', 'Delete');
    return drawerShell(460, state.isNew ? 'New discount' : 'Edit discount', '#2E8A87', d.code || 'New code', body);
  }

  function collectionDrawer() {
    var d = state.draft;
    var rows = store.products.map(function (p) {
      var inCol = d.productIds.indexOf(p.id) >= 0;
      var ts = 'font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;padding:6px 12px;border-radius:8px;cursor:pointer;border:1px solid ' + (inCol ? 'rgba(192,86,30,.4);color:#C0561E;background:transparent' : 'rgba(21,49,92,.22);color:#15315C;background:#fff');
      return '<div style="display:flex;align-items:center;gap:12px;background:#FBF6EA;border:1px solid rgba(21,49,92,.1);border-radius:12px;padding:10px 14px">' +
        '<div style="width:34px;height:42px;border-radius:6px;background:' + cardBg(p.tint) + ';flex:none"></div>' +
        '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(p.name) + '</div>' +
        '<div style="font-family:\'Space Mono\',monospace;font-size:10px;color:rgba(21,49,92,.45)">' + esc(p.cat) + '</div></div>' +
        '<button data-act="coltoggle" data-id="' + p.id + '" style="' + ts + '">' + (inCol ? 'Remove' : 'Add') + '</button></div>';
    }).join('');
    var published = d.status === 'published';
    var body =
      '<label style="display:block">' + lbl('Collection name') + inputField('name', d.name, 'e.g. Spring Drop', 'font-weight:600;font-size:15px') + '</label>' +
      '<label style="display:block">' + lbl('Description') + '<textarea data-dfield="desc" rows="2" style="width:100%;margin-top:5px;font-size:14px;line-height:1.5;color:#15315C;background:#fff;border:1px solid rgba(21,49,92,.18);border-radius:10px;padding:11px 13px;outline:none;resize:vertical;font-family:\'Space Grotesk\',sans-serif">' + esc(d.desc) + '</textarea></label>' +
      '<div><div style="font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(21,49,92,.55);margin-bottom:10px">Pieces in this collection</div><div style="display:flex;flex-direction:column;gap:8px">' + rows + '</div></div>' +
      switchRow('Published', 'Visible in the storefront', 'coltogglestatus', published) +
      saveBar('savecol', state.isNew ? 'Create collection' : 'Save changes', state.isNew ? null : 'delcol', 'Delete');
    return drawerShell(520, state.isNew ? 'New collection' : 'Edit collection', '#C99224', d.name || 'New collection', body);
  }

  function journalDrawer() {
    var d = state.draft;
    var catOpts = ['Materials', 'Spotlight', 'Style', 'Technique', 'Behind the Scenes'].map(function (c) {
      return '<option value="' + esc(c) + '"' + (d.cat === c ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('');
    var published = d.status === 'published';
    var body =
      '<label style="display:block">' + lbl('Title') + inputField('title', d.title, 'Article title…', 'font-weight:600;font-size:15px') + '</label>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><label style="display:block">' + lbl('Category') +
      '<select data-dfield="cat" style="width:100%;margin-top:5px;font-size:14px;color:#15315C;background:#fff;border:1px solid rgba(21,49,92,.18);border-radius:10px;padding:11px 13px;outline:none;cursor:pointer">' + catOpts + '</select></label>' +
      '<label style="display:block">' + lbl('Read time') + inputField('read_time', d.read_time, 'e.g. 5 min read') + '</label></div>' +
      '<label style="display:block">' + lbl('Excerpt') + '<textarea data-dfield="excerpt" rows="2" placeholder="Short description shown on the journal grid…" style="width:100%;margin-top:5px;font-size:14px;line-height:1.5;color:#15315C;background:#fff;border:1px solid rgba(21,49,92,.18);border-radius:10px;padding:11px 13px;outline:none;resize:vertical;font-family:\'Space Grotesk\',sans-serif">' + esc(d.excerpt) + '</textarea></label>' +
      '<label style="display:block">' + lbl('Body (paste or type content)') + '<textarea data-dfield="bodyText" rows="10" placeholder="Write your article here…" style="width:100%;margin-top:5px;font-size:14px;line-height:1.7;color:#15315C;background:#fff;border:1px solid rgba(21,49,92,.18);border-radius:10px;padding:11px 13px;outline:none;resize:vertical;font-family:\'Space Grotesk\',sans-serif">' + esc(d.bodyText) + '</textarea></label>' +
      switchRow('Published', 'Visible in the journal', 'jtogglestatus', published) +
      saveBar('savejrn', state.isNew ? 'Publish post' : 'Save changes', state.isNew ? null : 'deljrn', 'Delete');
    return drawerShell(560, state.isNew ? 'New post' : 'Edit post', '#3A6EA8', d.title || 'Untitled post', body);
  }

  function artistDrawer() {
    var d = state.draft;
    var body =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      '<label style="display:block;grid-column:span 2">' + lbl('Full name') + inputField('name', d.name, '', 'font-weight:600;font-size:15px') + '</label>' +
      '<label style="display:block">' + lbl('Medium') + inputField('medium', d.medium, 'e.g. Textile Painter') + '</label>' +
      '<label style="display:block">' + lbl('Location') + inputField('location', d.location, 'City, Country') + '</label>' +
      '<label style="display:block">' + lbl('Instagram') + inputField('instagram', d.instagram, '@handle') + '</label>' +
      '<label style="display:block">' + lbl('Portfolio URL') + inputField('portfolio', d.portfolio, 'https://…') + '</label></div>' +
      '<label style="display:block">' + lbl('Quote') + inputField('quote', d.quote, 'Their signature line…', 'font-style:italic') + '</label>' +
      '<label style="display:block">' + lbl('Bio') + '<textarea data-dfield="bioText" rows="4" placeholder="A few sentences about the artist…" style="width:100%;margin-top:5px;font-size:14px;line-height:1.6;color:#15315C;background:#fff;border:1px solid rgba(21,49,92,.18);border-radius:10px;padding:11px 13px;outline:none;resize:vertical;font-family:\'Space Grotesk\',sans-serif">' + esc(d.bioText) + '</textarea></label>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;background:#FBF6EA;border:1px solid rgba(21,49,92,.12);border-radius:12px;padding:14px 16px">' +
      '<div><div style="font-size:14px;font-weight:600">Featured</div><div style="font-size:12px;color:rgba(21,49,92,.55)">Highlighted on the Artists page</div></div>' +
      '<button data-act="atogglefeat" style="width:46px;height:26px;border-radius:100px;border:none;cursor:pointer;background:' + (d.featured ? '#E0A93A' : 'rgba(21,49,92,.2)') + ';position:relative;flex:none;transition:background .25s"><span style="position:absolute;top:3px;left:' + (d.featured ? '23px' : '3px') + ';width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 2px 5px rgba(0,0,0,.25);transition:left .25s"></span></button></div>' +
      saveBar('saveartist', state.isNew ? 'Add collaborator' : 'Save changes', state.isNew ? null : 'delartist', 'Remove');
    return drawerShell(480, state.isNew ? 'New collaborator' : 'Edit collaborator', '#C99224', d.name || 'New collaborator', body);
  }

  function activeDrawer() {
    switch (state.drawer) {
      case 'product': return productDrawer();
      case 'order': return orderDrawer();
      case 'customer': return customerDrawer();
      case 'discount': return discountDrawer();
      case 'collection': return collectionDrawer();
      case 'journal': return journalDrawer();
      case 'artist': return artistDrawer();
      default: return '';
    }
  }

  // ===================================================================
  //  RENDER
  // ===================================================================
  function render() {
    var toastEl = state.toast ? '<div style="position:fixed;bottom:26px;left:50%;transform:translateX(-50%);z-index:200;background:#15315C;color:#F3EDDD;font-size:14px;padding:14px 24px;border-radius:100px;box-shadow:0 16px 40px -14px rgba(14,35,71,.7);display:flex;align-items:center;gap:10px"><span style="width:9px;height:9px;border-radius:50%;background:#2E8A87;flex:none"></span>' + esc(state.toast) + '</div>' : '';
    document.getElementById('admin').innerHTML =
      '<div class="adm-shell" style="display:flex;min-height:100vh">' + sidebar() +
      '<main class="adm-main adm-scroll" style="margin-left:248px;flex:1;min-width:0;display:flex;flex-direction:column;max-height:100vh;overflow-y:auto">' +
      topbar() + '<div style="padding:clamp(18px,3vw,34px);animation:admIn .4s ease">' + bodyView() + '</div></main></div>' +
      activeDrawer() + toastEl;

    if (searchFocused) {
      var s = document.querySelector('[data-act="search"]');
      if (s) { s.focus(); var val = s.value; s.value = ''; s.value = val; }
    }
  }

  // ===================================================================
  //  ACTIONS
  // ===================================================================
  function setDraft(k, v) { state.draft[k] = v; }

  function dispatch(act, node) {
    switch (act) {
      case 'go': state.drawer = null; state.draft = null; go(node.getAttribute('data-view')); break;
      case 'filter': state[node.getAttribute('data-group')] = node.getAttribute('data-value'); render(); break;
      case 'closedrawer': state.drawer = null; state.draft = null; state.selOrderId = null; state.selCustId = null; render(); break;

      // products
      case 'newproduct': state.drawer = 'product'; state.isNew = true; state.draft = { id: null, name: '', cat: 'Apparel', price: '', inventory: '', status: 'draft', tint: '20,42,84', blurb: '', sizes: [], medium: 'Cotton · Screen Print', artist: 'Atelier OMG', sold: 0 }; render(); break;
      case 'editproduct': {
        var p = store.products.find(function (x) { return x.id === node.getAttribute('data-id'); });
        state.drawer = 'product'; state.isNew = false; state.draft = DB.clone(p); render(); break;
      }
      case 'pcat': setDraft('cat', node.getAttribute('data-cat')); render(); break;
      case 'psize': {
        var sz = node.getAttribute('data-size'); var arr = state.draft.sizes || [];
        var i = arr.indexOf(sz); if (i >= 0) arr.splice(i, 1); else arr.push(sz);
        state.draft.sizes = arr; render(); break;
      }
      case 'ptogglestatus': setDraft('status', state.draft.status === 'published' ? 'draft' : 'published'); render(); break;
      case 'saveproduct': {
        var d = state.draft;
        if (!String(d.name).trim()) { toast('Give the piece a title first'); return; }
        d.price = Number(d.price) || 0; d.inventory = Number(d.inventory) || 0;
        d.sizes = (d.sizes && d.sizes.length) ? d.sizes : ['One']; d.sold = d.sold || 0;
        if (state.isNew) { d.id = 'p' + Date.now(); store.products.unshift(d); }
        else { var idx = store.products.findIndex(function (x) { return x.id === d.id; }); if (idx >= 0) store.products[idx] = d; }
        persist(); var name = d.name; var wasNew = state.isNew;
        state.drawer = null; state.draft = null; toast(wasNew ? name + ' added' : name + ' updated'); break;
      }
      case 'delproduct': {
        var id = state.draft.id; store.products = store.products.filter(function (x) { return x.id !== id; });
        persist(); state.drawer = null; state.draft = null; toast('Product removed'); break;
      }

      // orders
      case 'openorder': state.drawer = 'order'; state.selOrderId = node.getAttribute('data-id'); render(); break;
      case 'advorder': {
        var o = store.orders.find(function (x) { return x.id === state.selOrderId; });
        if (o) { o.stage = Math.min(4, o.stage + 1); persist(); } render(); break;
      }

      // customers
      case 'opencust': state.drawer = 'customer'; state.selCustId = node.getAttribute('data-id'); render(); break;

      // discounts
      case 'newdiscount': state.drawer = 'discount'; state.isNew = true; state.draft = { id: null, code: '', type: 'pct', value: '', limit: '', expires: '', used: 0, active: true }; render(); break;
      case 'editdisc': { var dd = store.discounts.find(function (x) { return x.id === node.getAttribute('data-id'); }); state.drawer = 'discount'; state.isNew = false; state.draft = DB.clone(dd); render(); break; }
      case 'dtype': setDraft('type', node.getAttribute('data-type')); render(); break;
      case 'dtoggle': setDraft('active', !state.draft.active); render(); break;
      case 'savedisc': {
        var d2 = state.draft;
        if (!String(d2.code).trim()) { toast('Give the code a name first'); return; }
        d2.code = String(d2.code).trim().toUpperCase(); d2.value = Number(d2.value) || 0; d2.limit = Number(d2.limit) || 0; d2.used = d2.used || 0;
        if (state.isNew) { d2.id = 'disc' + Date.now(); store.discounts.unshift(d2); }
        else { var di = store.discounts.findIndex(function (x) { return x.id === d2.id; }); if (di >= 0) store.discounts[di] = d2; }
        persist(); var code = d2.code; var wn = state.isNew; state.drawer = null; state.draft = null; toast(wn ? code + ' created' : code + ' updated'); break;
      }
      case 'deldisc': { var id2 = state.draft.id; store.discounts = store.discounts.filter(function (x) { return x.id !== id2; }); persist(); state.drawer = null; state.draft = null; toast('Code removed'); break; }

      // collections
      case 'newcol': state.drawer = 'collection'; state.isNew = true; state.draft = { id: null, name: 'New collection', desc: '', productIds: [], status: 'draft' }; render(); break;
      case 'editcol': { var col = store.collections.find(function (x) { return x.id === node.getAttribute('data-id'); }); state.drawer = 'collection'; state.isNew = false; state.draft = DB.clone(col); render(); break; }
      case 'coltoggle': { var pid = node.getAttribute('data-id'); var ids = state.draft.productIds; var ci = ids.indexOf(pid); if (ci >= 0) ids.splice(ci, 1); else ids.push(pid); render(); break; }
      case 'coltogglestatus': setDraft('status', state.draft.status === 'published' ? 'draft' : 'published'); render(); break;
      case 'savecol': {
        var c3 = state.draft;
        if (state.isNew) { c3.id = 'col' + Date.now(); store.collections.push(c3); }
        else { var coi = store.collections.findIndex(function (x) { return x.id === c3.id; }); if (coi >= 0) store.collections[coi] = c3; }
        persist(); var nm = c3.name; state.drawer = null; state.draft = null; toast(nm + ' saved'); break;
      }
      case 'delcol': { var id3 = state.draft.id; store.collections = store.collections.filter(function (x) { return x.id !== id3; }); persist(); state.drawer = null; state.draft = null; toast('Collection removed'); break; }

      // journal
      case 'newpost': state.drawer = 'journal'; state.isNew = true; state.draft = { id: null, title: 'Untitled post', cat: 'Materials', read_time: '5 min read', excerpt: '', bodyText: '', status: 'draft', tint: '20,42,84', author: 'Atelier OMG', date: 'Jun 29, 2026' }; render(); break;
      case 'editjrn': { var jp = store.journal.find(function (x) { return x.id === node.getAttribute('data-id'); }); state.drawer = 'journal'; state.isNew = false; state.draft = DB.clone(jp); render(); break; }
      case 'jtogglestatus': setDraft('status', state.draft.status === 'published' ? 'draft' : 'published'); render(); break;
      case 'savejrn': {
        var j = state.draft;
        if (!String(j.title).trim()) { toast('Give the post a title first'); return; }
        if (state.isNew) { j.id = 'a' + Date.now(); store.journal.unshift(j); }
        else { var ji = store.journal.findIndex(function (x) { return x.id === j.id; }); if (ji >= 0) store.journal[ji] = j; }
        persist(); var t = j.title; state.drawer = null; state.draft = null; toast(t + ' saved'); break;
      }
      case 'deljrn': { var id4 = state.draft.id; store.journal = store.journal.filter(function (x) { return x.id !== id4; }); persist(); state.drawer = null; state.draft = null; toast('Post removed'); break; }

      // artists
      case 'newartist': state.drawer = 'artist'; state.isNew = true; state.draft = { id: null, name: 'New collaborator', medium: '', location: '', tint: '46,138,134', quote: '', bioText: '', instagram: '', portfolio: '', featured: false, status: 'active' }; render(); break;
      case 'editartist': { var ar = store.artists.find(function (x) { return x.id === node.getAttribute('data-id'); }); state.drawer = 'artist'; state.isNew = false; state.draft = DB.clone(ar); render(); break; }
      case 'atogglefeat': setDraft('featured', !state.draft.featured); render(); break;
      case 'saveartist': {
        var a = state.draft;
        if (!String(a.name).trim()) { toast('Give the artist a name first'); return; }
        if (state.isNew) { a.id = 'art' + Date.now(); store.artists.push(a); }
        else { var ai = store.artists.findIndex(function (x) { return x.id === a.id; }); if (ai >= 0) store.artists[ai] = a; }
        persist(); var an = a.name; state.drawer = null; state.draft = null; toast(an + ' saved'); break;
      }
      case 'delartist': { var id5 = state.draft.id; store.artists = store.artists.filter(function (x) { return x.id !== id5; }); persist(); state.drawer = null; state.draft = null; toast('Artist removed'); break; }

      // payments + settings
      case 'provtoggle': { var k = node.getAttribute('data-key'); store.providers[k].enabled = !store.providers[k].enabled; persist(); render(); break; }
      case 'provmode': { var k2 = node.getAttribute('data-key'); store.providers[k2].mode = node.getAttribute('data-mode'); persist(); render(); break; }
      case 'savepayments': persist(); toast('Payment configuration saved'); break;
      case 'savesettings': persist(); toast('Settings saved'); break;
      case 'resetdata': DB.reset(); store = DB.load(); state.drawer = null; state.draft = null; toast('Reset to sample data'); break;
    }
  }

  document.addEventListener('click', function (e) {
    var node = e.target.closest('[data-act]');
    if (!node) return;
    var act = node.getAttribute('data-act');
    if (act === 'search' || act === 'settracking' || act === 'setcustnote') return; // inputs
    // sync any visible form values so toggles/saves keep typed text
    syncDOM();
    dispatch(act, node);
  });

  // live inputs
  document.addEventListener('input', function (e) {
    var node = e.target.closest('[data-act]');
    if (!node) return;
    var act = node.getAttribute('data-act');
    if (act === 'search') {
      state.search = node.value; searchFocused = true; render(); searchFocused = false;
    } else if (act === 'settracking') {
      var o = store.orders.find(function (x) { return x.id === state.selOrderId; });
      if (o) { o.tracking = node.value; persist(); }
    } else if (act === 'setcustnote') {
      var c = store.customers.find(function (x) { return x.id === state.selCustId; });
      if (c) { c.note = node.value; persist(); }
    }
  });

  // refresh catalog if another tab (e.g. admin/storefront) changed it
  window.addEventListener('storage', function (e) {
    if (e.key === DB.KEY) { store = DB.load(); if (!state.drawer) render(); }
  });

  render();
})();
