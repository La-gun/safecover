/**
 * Shared logic for industry scenario demos.
 * Each scenario page defines SCENARIO_CONFIG and includes this script.
 */
(function () {
  if (typeof window.SCENARIO_CONFIG === 'undefined') return;

  var config = window.SCENARIO_CONFIG;
  var API = window.location.origin;

  window.runScenarioCheckout = function (cartItems, scenarioId, onSuccess, onError) {
    var itemsForQuote = cartItems.map(function (i) {
      return { value: (i.price || 0) * (i.qty || 1), name: i.name };
    });
    var cartValue = itemsForQuote.reduce(function (s, i) { return s + i.value; }, 0);

    fetch(API + '/api/quote/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'demo' },
      body: JSON.stringify({ items: itemsForQuote, scenario: scenarioId, jurisdiction: 'US' })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var options = data.options || [];
        var recommended = data.recommended || options[0];
        if (!recommended) {
          return fetch(API + '/api/quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': 'demo' },
            body: JSON.stringify({ items: itemsForQuote, scenario: scenarioId })
          }).then(function (r) { return r.json(); }).then(function (q) {
            return { premium: q.premium, quote_id: q.quote_id, provider_id: 'safecover', plan_id: 'standard' };
          });
        }
        return {
          premium: recommended.premium,
          quote_id: recommended.quote_id,
          provider_id: recommended.provider_id,
          plan_id: recommended.plan_id
        };
      })
      .then(function (quote) {
        var orderId = 'ORD_' + Date.now() + '_' + scenarioId;
        return fetch(API + '/api/policy/bind', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': 'demo' },
          body: JSON.stringify({
            quote_id: quote.quote_id,
            transaction_id: orderId,
            customer: { email: config.customerEmail || 'customer@example.com', name: config.customerName || 'Demo User' },
            premium_paid: quote.premium,
            provider_id: quote.provider_id,
            plan_id: quote.plan_id,
            scenario: scenarioId,
            jurisdiction: 'US'
          })
        }).then(function (r) { return r.json(); }).then(function (bind) {
          return { policy: bind, quote: quote, orderId: orderId };
        });
      })
      .then(function (result) {
        if (onSuccess) onSuccess(result);
      })
      .catch(function (e) {
        if (onError) onError(e);
      });
  };
})();
