/* Oh my Gogh! waitlist form. No dependencies. */
(function () {
  'use strict';
  var MESSAGES = {
    ok: "You're on the list. We'll email you when the doors open.",
    exists: "You're already on the list. Nothing more to do.",
    invalid_email: 'That email address does not look right. Please check it and try again.',
    rate_limited: 'Too many tries from this connection. Please wait a few minutes and try again.',
    server: 'Something went wrong on our side. Please try again in a moment.',
    network: 'We could not reach the server. Please check your connection and try again.'
  };
  var RE = /^[^\s@:]+@[^\s@:]+\.[^\s@:]{2,}$/;

  function show(form, state, text) {
    var msg = form.querySelector('.msg');
    var input = form.querySelector('input[name="email"]');
    msg.textContent = text || '';
    msg.setAttribute('data-state', state || '');
    if (state === 'error') { input.setAttribute('aria-invalid', 'true'); } else { input.removeAttribute('aria-invalid'); }
  }

  function wire(form) {
    var input = form.querySelector('input[name="email"]');
    var button = form.querySelector('button[type="submit"]');
    var label = button.textContent;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = (input.value || '').trim();
      if (!RE.test(email) || email.length > 254) {
        show(form, 'error', MESSAGES.invalid_email);
        input.focus();
        return;
      }
      button.disabled = true;
      button.textContent = 'Joining...';
      form.setAttribute('aria-busy', 'true');
      show(form, '', 'Saving your spot...');

      var trap = form.querySelector('input[name="website"]');
      fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email: email, website: trap ? trap.value : '', source: form.getAttribute('data-source') || 'web' })
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) { return { res: res, data: data }; });
      }).then(function (r) {
        if (r.res.ok && r.data && r.data.ok) {
          show(form, 'ok', MESSAGES[r.data.status === 'exists' ? 'exists' : 'ok']);
          input.value = '';
        } else {
          var code = (r.data && r.data.error) || (r.res.status === 429 ? 'rate_limited' : 'server');
          show(form, 'error', MESSAGES[code] || MESSAGES.server);
        }
      }).catch(function () {
        show(form, 'error', MESSAGES.network);
      }).then(function () {
        button.disabled = false;
        button.textContent = label;
        form.removeAttribute('aria-busy');
      });
    });
  }

  var forms = document.querySelectorAll('form[data-waitlist]');
  for (var i = 0; i < forms.length; i++) { wire(forms[i]); }

})();
