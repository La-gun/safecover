/**
 * SafeCover adapter for WooCommerce
 * Use with the PHP plugin - this provides client-side widget with dynamic quote.
 * Data is injected by the PHP plugin via window.safecoverCheckoutData
 */
(function () {
  function getCheckoutData() {
    var data = window.safecoverCheckoutData;
    if (data) return data;

    // Fallback: try to read from DOM (WooCommerce form fields)
    var email = (document.querySelector('#billing_email') || {}).value || '';
    var firstName = (document.querySelector('#billing_first_name') || {}).value || '';
    var lastName = (document.querySelector('#billing_last_name') || {}).value || '';
    var orderTotal = parseFloat((document.querySelector('.order-total .amount') || {}).textContent?.replace(/[^0-9.]/g, '') || 0);

    return {
      order_id: 'WC_' + Date.now(),
      email: email,
      customer_name: (firstName + ' ' + lastName).trim(),
      items: [{ value: orderTotal || 0 }]
    };
  }

  SafeCover.init({
    apiUrl: window.safecoverApiUrl || 'https://api.yourinsurance.com',
    containerId: 'safecover-container',
    getCheckoutData: getCheckoutData
  });
})();
