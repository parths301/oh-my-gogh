// POST /api/razorpay/create-order
// Body: { items:[{id,size,qty}], code? }
// Recomputes the amount server-side from Supabase prices (never trusts the
// client), applies a valid discount, creates a Razorpay order, and returns
// the public order details for Razorpay Checkout.
'use strict';
var lib = require('../_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  var keyId = process.env.RAZORPAY_KEY_ID;
  var keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return res.status(500).json({ error: 'razorpay_not_configured' });

  try {
    var body = await lib.readBody(req);
    var items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return res.status(400).json({ error: 'empty_cart' });

    // fetch authoritative prices for the requested products
    var ids = items.map(function (i) { return String(i.id); });
    var inList = ids.map(function (id) { return '"' + id + '"'; }).join(',');
    var products = await lib.supa('products?id=in.(' + encodeURIComponent(inList) + ')&select=id,name,price,status');
    var byId = {};
    products.forEach(function (p) { byId[p.id] = p; });

    var subtotal = 0; var lines = [];
    for (var k = 0; k < items.length; k++) {
      var it = items[k]; var p = byId[String(it.id)];
      if (!p || p.status !== 'published') continue;
      var qty = Math.max(1, parseInt(it.qty, 10) || 1);
      subtotal += p.price * qty;
      lines.push({ id: p.id, name: p.name, size: it.size || 'One', qty: qty, price: p.price });
    }
    if (!lines.length) return res.status(400).json({ error: 'no_valid_items' });

    // discount
    var discount = 0; var appliedCode = '';
    var code = (body.code || '').trim().toUpperCase();
    if (code) {
      var codes = await lib.supa('discounts?code=eq.' + encodeURIComponent(code) + '&active=eq.true&select=code,type,value,limit,used');
      var d = codes && codes[0];
      if (d && (d.limit === 0 || d.used < d.limit)) {
        discount = d.type === 'pct' ? Math.round(subtotal * d.value / 100) : Math.min(subtotal, d.value);
        appliedCode = d.code;
      }
    }

    var shipping = lib.shippingFor(subtotal - discount);
    var total = subtotal - discount + shipping;
    var currency = process.env.STORE_CURRENCY || 'INR';

    // create the Razorpay order (amount in the smallest currency unit)
    var auth = Buffer.from(keyId + ':' + keySecret).toString('base64');
    var rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: total * 100,
        currency: currency,
        receipt: 'omg_' + Date.now(),
        notes: { code: appliedCode }
      })
    });
    var rzp = await rzpRes.json();
    if (!rzpRes.ok) return res.status(502).json({ error: 'razorpay_order_failed', detail: rzp });

    return res.status(200).json({
      orderId: rzp.id,
      amount: rzp.amount,
      currency: currency,
      keyId: keyId,
      breakdown: { subtotal: subtotal, discount: discount, shipping: shipping, total: total, code: appliedCode },
      lines: lines
    });
  } catch (e) {
    return res.status(500).json({ error: 'server_error', message: String(e && e.message || e) });
  }
};
