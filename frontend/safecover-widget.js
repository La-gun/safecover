/**
 * SafeCover Universal Widget - Works on any e-commerce platform
 * Usage: Include this script, then call SafeCover.init(config)
 *
 * @param {Object} config
 * @param {string} config.apiUrl - SafeCover API base URL (e.g. https://api.yourinsurance.com)
 * @param {Function} config.getCheckoutData - Returns { order_id, email, customer_name, items }
 * @param {string} [config.containerId] - DOM element ID for widget (default: safecover-container)
 * @param {string} [config.containerSelector] - CSS selector if no container (creates one)
 */
(function () {
  'use strict';

  window.SafeCover = {
    init: function (config) {
      if (!config || !config.apiUrl || typeof config.getCheckoutData !== 'function') {
        console.error('SafeCover: apiUrl and getCheckoutData are required');
        return;
      }

      var apiUrl = (config.apiUrl || (typeof location !== 'undefined' && location.origin) || '').replace(/\/$/, '');
      var getCheckoutData = config.getCheckoutData;
      var containerId = config.containerId || 'safecover-container';
      var container = document.getElementById(containerId) || document.querySelector(config.containerSelector || '#' + containerId);

      if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        document.body.appendChild(container);
      }

      var quote = null;

      function fetchQuote() {
        var data = getCheckoutData();
        if (!data || !data.items || !data.items.length) {
          return Promise.reject(new Error('No checkout data or items'));
        }

        return fetch(apiUrl + '/api/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: data.items })
        })
          .then(function (r) { return r.json(); })
          .then(function (res) {
            if (res.error) throw new Error(res.error);
            quote = res;
            return res;
          });
      }

      function bindPolicy() {
        var data = getCheckoutData();
        if (!data) {
          showStatus('Checkout data unavailable', false);
          return;
        }

        var payload = {
          transaction_id: data.order_id || 'ORD_' + Date.now(),
          customer: {
            email: data.email || '',
            name: data.customer_name || ''
          },
          items: data.items || [],
          premium_paid: quote ? quote.premium : 3.12,
          quote_id: quote ? quote.quote_id : 'QTY' + Date.now()
        };

        fetch(apiUrl + '/api/policy/bind', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
          .then(function (r) { return r.json(); })
          .then(function (res) {
            if (res.error) throw new Error(res.error);
            showStatus("You're protected! Policy issued ✓", true);
          })
          .catch(function (err) {
            showStatus('Failed to bind policy. Try again.', false);
            console.error('SafeCover policy bind failed:', err);
          });
      }

      function showStatus(msg, success) {
        var el = container.querySelector('.safecover-status');
        if (el) {
          el.textContent = msg;
          el.style.color = success ? 'green' : 'red';
          el.style.display = 'block';
        }
      }

      var html = [
        '<div class="safecover-widget" style="border:1px solid #ccc;border-radius:8px;padding:16px;margin-top:20px;font-family:sans-serif">',
        '  <h3 style="margin:0 0 10px;font-size:1.2em">✓ Add Protection with SafeCover™</h3>',
        '  <ul style="padding-left:20px;margin:0 0 12px">',
        '    <li>✔ Covers loss, damage, or theft during delivery</li>',
        '    <li>✔ Instant policy activation</li>',
        '    <li>✔ Up to <strong>$1,000</strong> coverage</li>',
        '  </ul>',
        '  <label style="display:flex;align-items:center">',
        '    <input type="checkbox" class="safecover-checkbox" style="margin-right:8px">',
        '    <span class="safecover-label">Add insurance for <strong>$--</strong></span>',
        '  </label>',
        '  <div class="safecover-status" style="margin-top:10px;display:none"></div>',
        '</div>'
      ].join('');

      container.innerHTML = html;

      var checkbox = container.querySelector('.safecover-checkbox');
      var label = container.querySelector('.safecover-label');

      fetchQuote()
        .then(function (q) {
          label.innerHTML = 'Add insurance for <strong>$' + q.premium.toFixed(2) + '</strong>';
        })
        .catch(function () {
          label.innerHTML = 'Add insurance for <strong>$3.12</strong>';
          quote = { quote_id: 'QTY' + Date.now(), premium: 3.12 };
        });

      checkbox.addEventListener('change', function () {
        var statusEl = container.querySelector('.safecover-status');
        if (checkbox.checked) {
          bindPolicy();
        } else {
          if (statusEl) statusEl.style.display = 'none';
        }
      });

      return { fetchQuote: fetchQuote, bindPolicy: bindPolicy };
    }
  };
})();
