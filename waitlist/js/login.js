(function () {
  'use strict';
  var O = window.OMG;
  var form = document.getElementById('login-form');
  var msg = document.getElementById('form-msg');

  O.api('GET', '/api/auth/me').then(function (r) { if (r.ok && r.data.artist) window.location.href = '/dashboard'; });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = form.querySelector('button[type="submit"]');
    var fd = new FormData(form);
    btn.disabled = true;
    O.setMsg(msg, '', 'Logging in...');
    O.api('POST', '/api/auth/login', { email: fd.get('email'), password: fd.get('password') }).then(function (r) {
      btn.disabled = false;
      if (r.ok) { window.location.href = '/dashboard'; return; }
      O.showFieldErrors(form, r.data.fields);
      O.setMsg(msg, 'error', r.data.message || 'Something went wrong. Please try again.');
    });
  });
})();
