/*!
 * Vasco lead-capture widget — R84
 * Drop-in form contractor pastes on their site. Renders into the
 * <div data-vasco-widget> element on the host page. Submits to the
 * `capture-lead` Supabase edge function with the contractor's user_id
 * baked into the script-tag query string.
 *
 * Usage on contractor's site:
 *   <div data-vasco-widget></div>
 *   <script async src="https://vascobuild.com/widget/embed.js?to=USER_ID"></script>
 *
 * The script is small + dependency-free on purpose: no React, no
 * external CSS, no analytics. Form posts cross-origin to the edge fn
 * via fetch + CORS.
 */
(function () {
  'use strict';

  // Parse contractor user_id from the script tag's own src.
  var currentScript = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();
  if (!currentScript) return;

  var srcUrl;
  try {
    srcUrl = new URL(currentScript.src);
  } catch (_) {
    return;
  }
  var contractorId = srcUrl.searchParams.get('to');
  if (!contractorId) {
    console.error('[vasco] missing ?to=USER_ID on widget script tag');
    return;
  }

  // Edge function endpoint. Convention: vascobuild.com → live prod
  // Supabase. For self-hosters this'll need to point elsewhere; we'll
  // surface a config knob when we ship multi-tenant.
  var EDGE_FN =
    'https://gblhqhorkarocmputhte.supabase.co/functions/v1/capture-lead';

  // ── Render form ────────────────────────────────────────────────────
  function render(container) {
    container.innerHTML =
      '<form class="vasco-form">' +
      '  <h3 class="vasco-h">Request an estimate</h3>' +
      '  <input type="text" name="name" placeholder="Your name" required />' +
      '  <input type="tel" name="phone" placeholder="Phone" />' +
      '  <input type="email" name="email" placeholder="Email" />' +
      '  <textarea name="job" rows="3" placeholder="What needs doing?"></textarea>' +
      // Honeypot — hidden via CSS, real visitors leave it empty.
      '  <input type="text" name="hp_token" class="vasco-hp" tabindex="-1" autocomplete="off" />' +
      '  <button type="submit" class="vasco-cta">Send</button>' +
      '  <p class="vasco-status" role="status"></p>' +
      '</form>';

    // Self-scoped styles. Prefixed so we don't fight the host page.
    var css =
      '.vasco-form{font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;gap:10px;max-width:380px;padding:16px;background:#0B0E11;color:#fff;border-radius:14px;border:1px solid #2A3038}' +
      '.vasco-form .vasco-h{margin:0 0 4px 0;font-size:18px;font-weight:800;letter-spacing:.5px}' +
      '.vasco-form input,.vasco-form textarea{background:#14181F;border:1px solid #2A3038;color:#fff;padding:10px 12px;border-radius:8px;font:inherit;font-size:14px}' +
      '.vasco-form input:focus,.vasco-form textarea:focus{outline:none;border-color:#F97316;box-shadow:0 0 0 3px rgba(249,115,22,.2)}' +
      '.vasco-form .vasco-cta{background:linear-gradient(135deg,#9A3412,#C2410C,#F97316);color:#fff;border:none;padding:12px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;letter-spacing:.4px;text-transform:uppercase}' +
      '.vasco-form .vasco-cta:hover{filter:brightness(1.1)}' +
      '.vasco-form .vasco-cta:disabled{opacity:.5;cursor:not-allowed}' +
      '.vasco-form .vasco-status{margin:4px 0 0 0;font-size:13px;min-height:18px;color:#9CA3AF}' +
      '.vasco-form .vasco-status.ok{color:#22C55E}' +
      '.vasco-form .vasco-status.err{color:#EF4444}' +
      '.vasco-form .vasco-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}';

    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var form = container.querySelector('.vasco-form');
    var btn = form.querySelector('.vasco-cta');
    var status = form.querySelector('.vasco-status');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.className = 'vasco-status';
      status.textContent = 'Sending…';
      btn.disabled = true;

      var fd = new FormData(form);
      var payload = {
        to: contractorId,
        customerName: String(fd.get('name') || ''),
        customerPhone: String(fd.get('phone') || '') || undefined,
        customerEmail: String(fd.get('email') || '') || undefined,
        jobDescription: String(fd.get('job') || '') || undefined,
        hp_token: String(fd.get('hp_token') || ''),
      };

      fetch(EDGE_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) {
          if (r.ok) return r.json().then(function (data) { return { ok: true, data: data }; });
          return r.json().then(function (data) { return { ok: false, data: data }; }).catch(function () { return { ok: false, data: {} }; });
        })
        .then(function (resp) {
          if (resp.ok) {
            status.className = 'vasco-status ok';
            status.textContent = 'Thanks! We\'ll be in touch shortly.';
            form.reset();
          } else {
            status.className = 'vasco-status err';
            var code = resp.data && resp.data.error ? resp.data.error : 'unknown_error';
            status.textContent =
              code === 'rate_limited'
                ? 'Too many submissions — try again later.'
                : 'Something went wrong. Please try again.';
          }
        })
        .catch(function () {
          status.className = 'vasco-status err';
          status.textContent = 'Network error. Please try again.';
        })
        .finally(function () {
          btn.disabled = false;
        });
    });
  }

  function init() {
    var containers = document.querySelectorAll('[data-vasco-widget]');
    for (var i = 0; i < containers.length; i++) render(containers[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
