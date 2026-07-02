// POST /api/razorpay/verify
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature,
//         customer:{name,email,address}, items:[{id,size,qty}], code? }
// Verifies the Razorpay signature, re-prices server-side, then writes the
// order + line items to Supabase with the service-role key.
'use strict';
var crypto = require('crypto');
var lib = require('../_lib');

function orderNo() {
  return 'OMG-' + Math.floor(100000 + Math.random() * 900000);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  var keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return res.status(500).json({ error: 'razorpay_not_configured' });

  try {
    var body = await lib.readBody(req);
    var oid = body.razorpay_order_id, pid = body.razorpay_payment_id, sig = body.razorpay_signature;
    if (!oid || !pid || !sig) return res.status(400).json({ error: 'missing_fields' });

    // 1) verify signature
    var expected = crypto.createHmac('sha256', keySecret).update(oid + '|' + pid).digest('hex');
    var ok = expected.length === sig.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    if (!ok) return res.status(400).json({ error: 'invalid_signature' });

    // 2) re-price from authoritative data
    var items = Array.isArray(body.items) ? body.items : [];
    var ids = items.map(function (i) { return '"' + String(i.id) + '"'; }).join(',');
    var products = ids ? await lib.supa('products?id=in.(' + encodeURIComponent(ids) + ')&select=id,name,price,status') : [];
    var byId = {}; products.forEach(function (p) { byId[p.id] = p; });
    var subtotal = 0; var lines = [];
    items.forEach(function (it) {
      var p = byId[String(it.id)]; if (!p) return;
      var qty = Math.max(1, parseInt(it.qty, 10) || 1);
      subtotal += p.price * qty;
      lines.push({ product_id: p.id, name: p.name, size: it.size || 'One', qty: qty, price: p.price });
    });

    var discount = 0; var code = (body.code || '').trim().toUpperCase();
    if (code) {
      var dc = await lib.supa('discounts?code=eq.' + encodeURIComponent(code) + '&active=eq.true&select=code,type,value');
      var d = dc && dc[0];
      if (d) discount = d.type === 'pct' ? Math.round(subtotal * d.value / 100) : Math.min(subtotal, d.value);
    }
    var shipping = lib.shippingFor(subtotal - discount);
    var total = subtotal - discount + shipping;

    // 3) persist order
    var cust = body.customer || {};
    var id = orderNo();
    var now = new Date();
    var dateLabel = now.toLocaleString('en-US', { month: 'short', day: 'numeric' });
    await lib.supa('orders', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: [{
        id: id, customer: cust.name || 'Guest', email: cust.email || '', address: cust.address || '',
        date: dateLabel, stage: 1, method: 'Razorpay', tracking: '',
        subtotal: subtotal, shipping: shipping, total: total,
        currency: process.env.STORE_CURRENCY || 'INR',
        rzp_order_id: oid, rzp_payment_id: pid
      }]
    });
    if (lines.length) {
      await lib.supa('order_items', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: lines.map(function (l) { return Object.assign({ order_id: id }, l); })
      });
    }

    return res.status(200).json({ ok: true, orderNo: id, total: total });
  } catch (e) {
    // payment succeeded but persistence failed — surface so the client can show
    // a "paid, we'll email you" state rather than a hard error.
    return res.status(200).json({ ok: true, persisted: false, message: String(e && e.message || e) });
  }
};
