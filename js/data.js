/* ============================================================
   Oh my Gogh! — shared catalog + persistence
   Single source of truth for the storefront and the studio admin.
   Persists to localStorage so admin edits show up on the storefront.
   ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'omg.store.v1';

  // ---- brand palette -------------------------------------------------
  var COLORS = {
    ink: '#15315C',
    inkDeep: '#0E2347',
    cream: '#F3EDDD',
    creamCard: '#FBF6EA',
    sand: '#EFE8D6',
    gold: '#E0A93A',
    goldDeep: '#C99224',
    teal: '#2E8A87',
    rust: '#C0561E',
    blue: '#3A6EA8'
  };

  // ---- default seed data (mirrors the imported design) ---------------
  var DEFAULTS = {
    products: [
      { id: 'p1', name: 'Starry Night Crew Tee', cat: 'Apparel', price: 52, inventory: 48, status: 'published', tint: '20,42,84', medium: 'Cotton · Screen Print', artist: 'Mira Vance', sizes: ['S', 'M', 'L', 'XL'], sold: 64, blurb: 'Heavyweight organic cotton with a hand-pulled swirl print that wraps from the front hem up over the shoulder. Pre-shrunk, garment-dyed, gets better every wash.' },
      { id: 'p2', name: 'Sunflower Field Hoodie', cat: 'Apparel', price: 88, inventory: 23, status: 'published', tint: '224,169,58', medium: 'Fleece · Embroidered', artist: 'Juno Okafor', sizes: ['S', 'M', 'L', 'XL'], sold: 41, blurb: 'Brushed-back fleece in chrome yellow with a tonal embroidered sunflower over the heart. Heavy, warm, and impossible to take off once it is on.' },
      { id: 'p3', name: 'Wheatfield Canvas Tote', cat: 'Accessories', price: 36, inventory: 120, status: 'published', tint: '46,138,134', medium: 'Canvas · Block Print', artist: 'Émile Roux', sizes: ['One'], sold: 88, blurb: '12oz natural canvas, hand block-printed wheat motif, boxed base and a pocket for your sketchbook. Built to outlive every other bag you own.' },
      { id: 'p4', name: 'Sable Round Brush Set', cat: 'Art Supplies', price: 64, inventory: 7, status: 'published', tint: '20,42,84', medium: 'Set of 6 · Sable', artist: 'Atelier OMG', sizes: ['One'], sold: 29, blurb: 'Six pure sable rounds, sizes 000 through 8, on balanced birch handles. The exact set we reach for in the studio every single day.' },
      { id: 'p5', name: 'Chrome Yellow Oil Set', cat: 'Art Supplies', price: 72, inventory: 0, status: 'draft', tint: '224,169,58', medium: 'Oils · 12 Tubes', artist: 'Atelier OMG', sizes: ['One'], sold: 18, blurb: 'A twelve-tube oil set built around the yellows Vincent loved, milled with a little extra pigment load so a stroke really means it.' },
      { id: 'p6', name: 'Almond Blossom Tee', cat: 'Apparel', price: 52, inventory: 34, status: 'published', tint: '46,138,134', medium: 'Cotton · Screen Print', artist: 'Lena Park', sizes: ['S', 'M', 'L', 'XL'], sold: 37, blurb: 'Soft-hand discharge print of blossoming branches on a sea-glass teal tee. Light enough for summer, loud enough for any season.' },
      { id: 'p7', name: 'Impasto Knit Beanie', cat: 'Accessories', price: 34, inventory: 52, status: 'published', tint: '224,169,58', medium: 'Merino · Hand-Knit', artist: 'Lena Park', sizes: ['One'], sold: 46, blurb: 'Chunky hand-knit merino with a textured cable that mimics thick brushwork. Warm, a little wild, entirely yours.' },
      { id: 'p8', name: 'The Gogh Letters', cat: 'Books', price: 28, inventory: 14, status: 'draft', tint: '20,42,84', medium: 'Hardcover · 248pp', artist: 'Atelier OMG', sizes: ['One'], sold: 12, blurb: 'A pocket hardcover of our favorite letters between the lines — annotated by the studio, printed on heavy uncoated stock.' }
    ],
    artists: [
      { id: 'art1', name: 'Mira Vance', medium: 'Textile Painter', location: 'Arles, France', tint: '46,138,134', quote: 'Color is the only language I never had to learn.', bioText: 'From a converted barn outside Arles, Mira dyes her own wool in batches no bigger than a soup pot. Our spring capsule is her first wearable collection — six pieces, each a single continuous thread.', instagram: '@miravance', portfolio: 'miravance.com', featured: true, status: 'active' },
      { id: 'art2', name: 'Juno Okafor', medium: 'Oil & Impasto', location: 'Lagos, Nigeria', tint: '224,169,58', quote: 'Paint should arrive before the image does.', bioText: 'Juno works in oils thick enough that you feel a canvas before you read it. He built our sunflower capsule around a single chrome yellow he mixes by hand.', instagram: '@junookafor', portfolio: '', featured: true, status: 'active' },
      { id: 'art3', name: 'Lena Park', medium: 'Pigment & Ceramic', location: 'Seoul, South Korea', tint: '192,86,30', quote: 'I chase the exact color of a memory I can almost place.', bioText: 'Lena moves between pigment and clay, hunting hues that feel half-remembered. Her blossom prints and knit pieces carry the soft, washed light of early spring.', instagram: '@lenapark_studio', portfolio: 'lenapark.kr', featured: false, status: 'active' },
      { id: 'art4', name: 'Émile Roux', medium: 'Printmaker', location: 'Lyon, France', tint: '20,42,84', quote: 'Repetition is not boredom — it is devotion.', bioText: 'Émile block-prints by hand, one pull at a time, on heavy natural canvas. He believes a motif only earns its place once you’ve cut it a hundred times.', instagram: '@emileroux', portfolio: '', featured: false, status: 'active' }
    ],
    journal: [
      { id: 'a1', title: 'The Chemistry of Chrome Yellow', cat: 'Materials', read_time: '6 min read', author: 'Atelier OMG', date: 'Jun 24, 2026', excerpt: 'Why Van Gogh’s brightest pigment was also his most fragile — and how a modern mill keeps it singing.', status: 'published', tint: '224,169,58', bodyText: 'Of all the colors Vincent reached for, chrome yellow was the loudest and the most reckless.\n\nLead chromate is a brilliant, opaque yellow that mixes fast and dries faster. That speed is exactly why it fades.\n\nWe can’t bring back what time has taken from the originals. What we can do is choose a modern, lightfast yellow that sings the same note without the same fate.' },
      { id: 'a2', title: 'Inside Mira Vance’s Thread Studio', cat: 'Spotlight', read_time: '8 min read', author: 'Atelier OMG', date: 'Jun 12, 2026', excerpt: 'A morning among the looms with the textile painter behind our spring drop.', status: 'published', tint: '46,138,134', bodyText: 'Mira Vance’s studio is a converted barn an hour outside Arles, and it smells like wet wool and eucalyptus.\n\nShe dyes everything herself, in pots no bigger than you’d use for soup. Nothing matches exactly, and that is the point.' },
      { id: 'a3', title: 'How to Wear a Painting', cat: 'Style', read_time: '4 min read', author: 'Atelier OMG', date: 'May 30, 2026', excerpt: 'Five ways to style loud, painterly pieces without tipping into costume.', status: 'published', tint: '192,86,30', bodyText: 'A painterly piece can tip into costume fast. The trick is to let one loud thing be the whole outfit.\n\nIf the print is doing the talking, everything else should whisper: raw denim, unbleached cotton, a flat leather sandal.' },
      { id: 'a4', title: 'Impasto on Fabric: A Field Guide', cat: 'Technique', read_time: '7 min read', author: 'Atelier OMG', date: 'May 16, 2026', excerpt: 'The textures we chase, the threads that hold them, and the failures along the way.', status: 'draft', tint: '20,42,84', bodyText: 'Thick paint wants to crack, and fabric wants to move. Putting impasto texture on something you can wear is a small war between the two.' }
    ],
    orders: [
      { id: '#1042', customer: 'Ava Lindqvist', email: 'ava@studio.se', date: 'Jun 28', stage: 4, method: 'Stripe', address: 'Götgatan 12, Stockholm, SE', tracking: 'PT9X-44820-SE', items: [{ pid: 'p1', qty: 1, size: 'M' }, { pid: 'p3', qty: 2, size: 'One' }] },
      { id: '#1041', customer: 'Marcus Bell', email: 'm.bell@gmail.com', date: 'Jun 28', stage: 3, method: 'Stripe', address: '88 Pearl St, Brooklyn, NY', tracking: '1Z-OMG-77410', items: [{ pid: 'p2', qty: 1, size: 'L' }] },
      { id: '#1040', customer: 'Yuki Tanaka', email: 'yuki.t@me.com', date: 'Jun 27', stage: 2, method: 'PayPal', address: '2-4-1 Shibuya, Tokyo, JP', tracking: '', items: [{ pid: 'p7', qty: 2, size: 'One' }, { pid: 'p6', qty: 1, size: 'S' }] },
      { id: '#1039', customer: 'Sofia Reyes', email: 'sofia@hey.com', date: 'Jun 27', stage: 1, method: 'Razorpay', address: 'Roma Norte, CDMX, MX', tracking: '', items: [{ pid: 'p4', qty: 1, size: 'One' }] },
      { id: '#1038', customer: 'Liam O’Connor', email: 'liam.oc@outlook.com', date: 'Jun 26', stage: 0, method: 'Stripe', address: '14 Dame St, Dublin, IE', tracking: '', items: [{ pid: 'p1', qty: 3, size: 'XL' }] },
      { id: '#1037', customer: 'Priya Nair', email: 'priya.nair@gmail.com', date: 'Jun 26', stage: 4, method: 'Razorpay', address: 'Indiranagar, Bengaluru, IN', tracking: 'BD-5521-IN', items: [{ pid: 'p3', qty: 1, size: 'One' }, { pid: 'p8', qty: 1, size: 'One' }] }
    ],
    customers: [
      { id: 'c1', name: 'Ava Lindqvist', email: 'ava@studio.se', location: 'Stockholm, SE', since: 'Jan 2025', ltv: 164, orderCount: 2, avg: 82, status: 'active', note: '' },
      { id: 'c2', name: 'Marcus Bell', email: 'm.bell@gmail.com', location: 'Brooklyn, NY', since: 'Mar 2025', ltv: 88, orderCount: 1, avg: 88, status: 'active', note: '' },
      { id: 'c3', name: 'Yuki Tanaka', email: 'yuki.t@me.com', location: 'Tokyo, JP', since: 'Apr 2025', ltv: 164, orderCount: 2, avg: 82, status: 'active', note: 'Ships to Japan — confirm duty rates' },
      { id: 'c4', name: 'Sofia Reyes', email: 'sofia@hey.com', location: 'CDMX, MX', since: 'May 2025', ltv: 64, orderCount: 1, avg: 64, status: 'active', note: '' },
      { id: 'c5', name: 'Liam O’Connor', email: 'liam.oc@outlook.com', location: 'Dublin, IE', since: 'Jun 2025', ltv: 156, orderCount: 1, avg: 156, status: 'active', note: 'Repeat buyer — check discount usage' },
      { id: 'c6', name: 'Priya Nair', email: 'priya.nair@gmail.com', location: 'Bengaluru, IN', since: 'Feb 2025', ltv: 64, orderCount: 1, avg: 64, status: 'active', note: '' }
    ],
    discounts: [
      { id: 'd1', code: 'STARRY', type: 'pct', value: 15, limit: 100, used: 47, expires: '2026-12-31', active: true },
      { id: 'd2', code: 'WELCOME10', type: 'pct', value: 10, limit: 0, used: 234, expires: '', active: true },
      { id: 'd3', code: 'SUNFLOWER', type: 'fixed', value: 20, limit: 50, used: 23, expires: '2026-07-31', active: true },
      { id: 'd4', code: 'STUDIO2025', type: 'pct', value: 20, limit: 30, used: 30, expires: '2025-12-31', active: false }
    ],
    collections: [
      { id: 'col1', name: 'Spring Drop', desc: 'The first seasonal capsule — six wearables from Mira Vance\'s loom.', productIds: ['p1', 'p2', 'p6'], status: 'published' },
      { id: 'col2', name: 'Van Gogh Essentials', desc: 'The pieces that started it all. Each one a nod to the master.', productIds: ['p1', 'p3', 'p7'], status: 'published' },
      { id: 'col3', name: 'Art Supplies', desc: 'Tools for the studio, chosen with the same care as the wearables.', productIds: ['p4', 'p5'], status: 'published' },
      { id: 'col4', name: 'Summer Reads', desc: 'For the long afternoon. Books that belong in a bag.', productIds: ['p8'], status: 'draft' }
    ],
    providers: {
      stripe: { enabled: true, mode: 'test', f1: 'pk_test_51Hxxxxxxxxxxxx', f2: 'sk_test_51Hxxxxxxxxxxxx' },
      paypal: { enabled: false, mode: 'test', f1: '', f2: '' },
      razorpay: { enabled: true, mode: 'test', f1: 'rzp_test_xxxxxxxx', f2: '' },
      manual: { enabled: false, mode: 'test', f1: '', f2: '' }
    },
    settings: { store: 'Oh my Gogh!', email: 'parth@ohmygogh.com', currency: 'USD ($)' }
  };

  // ---- persistence ---------------------------------------------------
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function load() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return clone(DEFAULTS);
      var saved = JSON.parse(raw);
      // shallow-merge so new default keys appear after upgrades
      var merged = clone(DEFAULTS);
      Object.keys(saved).forEach(function (k) { merged[k] = saved[k]; });
      return merged;
    } catch (e) {
      return clone(DEFAULTS);
    }
  }

  function save(data) {
    try { global.localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
  }

  // ---- shared helpers ------------------------------------------------
  function fmt(n) { return '$' + Math.round(n); }

  function cardBg(t) {
    return 'radial-gradient(115% 95% at 26% 20%, rgba(' + t + ',0.55), rgba(' + t + ',0) 60%), ' +
      'radial-gradient(95% 95% at 82% 88%, rgba(14,35,71,0.22), rgba(14,35,71,0) 58%), ' +
      'linear-gradient(140deg, rgba(' + t + ',0.28), rgba(' + t + ',0.08)), #ece1c6';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function handleFor(name) {
    return '/' + String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  global.OMG = {
    KEY: KEY,
    COLORS: COLORS,
    DEFAULTS: DEFAULTS,
    load: load,
    save: save,
    reset: function () { try { global.localStorage.removeItem(KEY); } catch (e) {} },
    fmt: fmt,
    cardBg: cardBg,
    esc: escapeHtml,
    handleFor: handleFor,
    clone: clone
  };
})(window);
