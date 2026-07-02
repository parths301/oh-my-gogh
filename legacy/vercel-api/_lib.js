// Shared helpers for the serverless functions (no external deps).
'use strict';

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    var data = '';
    req.on('data', function (c) { data += c; });
    req.on('end', function () {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); }
    });
    req.on('error', function () { resolve({}); });
  });
}

// Minimal Supabase REST (PostgREST) client using the service-role key (server-only).
function supa(path, opts) {
  var url = process.env.SUPABASE_URL;
  var key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Promise.reject(new Error('supabase_not_configured'));
  opts = opts || {};
  return fetch(url.replace(/\/$/, '') + '/rest/v1/' + path, {
    method: opts.method || 'GET',
    headers: Object.assign({
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json'
    }, opts.headers || {}),
    body: opts.body ? JSON.stringify(opts.body) : undefined
  }).then(function (r) {
    return r.text().then(function (t) {
      var json; try { json = t ? JSON.parse(t) : null; } catch (e) { json = t; }
      if (!r.ok) { var err = new Error('supabase_error'); err.status = r.status; err.detail = json; throw err; }
      return json;
    });
  });
}

function shippingFor(subtotal) {
  if (subtotal <= 0) return 0;
  var freeOver = Number(process.env.FREE_SHIPPING_OVER || 2000);
  var flat = Number(process.env.FLAT_SHIPPING || 99);
  return subtotal >= freeOver ? 0 : flat;
}

module.exports = { readBody, supa, shippingFor };
