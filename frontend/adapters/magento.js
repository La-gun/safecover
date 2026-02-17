/**
 * SafeCover adapter for Magento 2
 * Add to checkout page template or requirejs
 */
(function () {
  function getCheckoutData() {
    var data = window.checkoutConfig || window.quoteData;
    if (data) {
      var totals = data.totalsData || data.totals || {};
      var items = (totals.items || []).map(function (item) {
        return { value: parseFloat(item.row_total_incl_tax || item.row_total || 0) };
      });
      var grandTotal = parseFloat(totals.grand_total || totals.base_grand_total || 0);
      return {
        order_id: data.quoteId || data.quote_id || 'MG_' + Date.now(),
        email: (data.customerData && data.customerData.email) || (data.customer && data.customer.email) || '',
        customer_name: (data.customerData && (data.customerData.firstname + ' ' + data.customerData.lastname)) || '',
        items: items.length ? items : [{ value: grandTotal }]
      };
    }

    // Fallback: DOM
    var totalEl = document.querySelector('.grand-totals .price, [data-th="Order Total"]');
    var total = totalEl ? parseFloat(totalEl.textContent.replace(/[^0-9.]/g, '')) : 0;
    return {
      order_id: 'MG_' + Date.now(),
      email: (document.querySelector('#customer-email') || document.querySelector('input[name="customer[email]"]') || {}).value || '',
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
