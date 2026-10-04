(function () {
  'use strict';
  var O = window.OMG;
  var form = document.getElementById('signup-form');
  var msg = document.getElementById('form-msg');
  var handleInput = form.querySelector('[name="handle"]');
  var nameInput = form.querySelector('[name="name"]');
  var preview = document.getElementById('handle-preview');

  function slug(s) {
    return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/, '');
  }
  function updatePreview() { preview.textContent = handleInput.value.trim().toLowerCase() || slug(nameInput.value) || 'your-handle'; }
  handleInput.addEventListener('input', updatePreview);
  nameInput.addEventListener('input', updatePreview);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = form.querySelector('button[type="submit"]');
    var fd = new FormData(form);
    var body = {
      name: fd.get('name'), handle: fd.get('handle'), email: fd.get('email'), password: fd.get('password'),
      category: fd.get('category'), bio: fd.get('bio'), website: fd.get('website'),
      accept_terms: form.querySelector('[name="accept_terms"]').checked
    };
    btn.disabled = true;
    O.setMsg(msg, '', 'Creating your account...');
    O.api('POST', '/api/auth/signup', body).then(function (r) {
      btn.disabled = false;
      if (r.ok) {
        O.setMsg(msg, 'ok', 'Welcome! Taking you to your dashboard...');
        window.location.href = '/dashboard';
        return;
      }
      var had = O.showFieldErrors(form, r.data.fields);
      O.setMsg(msg, 'error', had ? 'Please fix the highlighted fields.' : (r.data.message || 'Something went wrong. Please try again.'));
      var first = form.querySelector('[aria-invalid="true"]');
      if (first) first.focus();
    });
  });
})();
