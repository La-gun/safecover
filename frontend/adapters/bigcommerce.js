/**
 * SafeCover adapter for BigCommerce
 * Add to checkout template or Script Manager
 */
(function () {
  function getCheckoutData() {
    var checkout = window.BC && window.BC.checkout;
    if (checkout) {
      var items = (checkout.lineItems || checkout.line_items || []).map(function (item) {
        var val = item.salePrice || item.price || 0;
        var qty = item.quantity || 1;
        return { value: parseFloat(val) * qty };
      });
      return {
        order_id: checkout.orderId || checkout.id || 'BC_' + Date.now(),
        email: (checkout.billingAddress && checkout.billingAddress.email) || checkout.customerEmail || '',
        customer_name: checkout.billingAddress
          ? [checkout.billingAddress.firstName, checkout.billingAddress.lastName].filter(Boolean).join(' ')
          : '',
        items: items.length ? items : [{ value: parseFloat(checkout.subtotal || checkout.grandTotal || 0) }]
      };
    }

    // Fallback: common BigCommerce DOM selectors
    var totalEl = document.querySelector('[data-checkout="grand-total"]') || document.querySelector('.grand-total');
    var total = totalEl ? parseFloat(totalEl.textContent.replace(/[^0-9.]/g, '')) : 0;
    return {
      order_id: 'BC_' + Date.now(),
      email: (document.querySelector('#email') || {}).value || '',
      customer_name: '',
      items: [{ value: total || 0 }]
    };
  }

  SafeCover.init({
    apiUrl: 'https://api.yourinsurance.com',
    containerId: 'safecover-container',
    getCheckoutData: getCheckoutData
  });
})();
