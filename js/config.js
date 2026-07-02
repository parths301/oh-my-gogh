/* ============================================================
   Oh my Gogh! — storefront runtime config
   Points the storefront at the Medusa backend. The publishable
   key is public by design (it only unlocks the Store API for the
   storefront sales channel — no admin/secret access).

   Local dev:   backend on http://localhost:9000 (npm run dev in backend/)
   Production:  set medusaUrl to the deployed backend origin.
   ============================================================ */
window.OMG_CONFIG = {
  medusaUrl: (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:9000'
    : 'https://api.ohmygogh.com',
  publishableKey: 'pk_61afe1bd4ef68681e6b9bbe69edc09cc0459a467f58e902e43ec9fd46f98d236'
};
