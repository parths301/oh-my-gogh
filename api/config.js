// GET /api/config — public, non-secret config for the browser.
// Lets the static client discover Supabase + Razorpay public keys without
// committing them to the repo. Set these in Vercel → Project → Settings → Env.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    currency: process.env.STORE_CURRENCY || 'INR',
    freeShippingOver: Number(process.env.FREE_SHIPPING_OVER || 2000),
    flatShipping: Number(process.env.FLAT_SHIPPING || 99),
    configured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
  });
};
