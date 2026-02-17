/**
 * SafeCover generic adapter - for custom or unsupported e-commerce platforms
 * Implement getCheckoutData() for your checkout structure
 */
(function () {
  // CUSTOMIZE THIS: Return checkout data in the format below
  function getCheckoutData() {
    // Example: read from your checkout/cart object
    // var cart = window.MyStore.cart;
    // return {
    //   order_id: cart.id || 'ORD_' + Date.now(),
    //   email: cart.customerEmail || document.querySelector('#email').value,
    //   customer_name: cart.customerName || '',
    //   items: cart.items.map(function(i) { return { value: i.price * i.quantity }; })
    // };

    // Fallback: use order total from a common selector
    var totalEl = document.querySelector('.order-total, .cart-total, .total, [data-total]');
    var total = totalEl ? parseFloat(totalEl.textContent.replace(/[^0-9.]/g, '')) : 0;

    return {
      order_id: 'ORD_' + Date.now(),
      email: (document.querySelector('input[type="email"], #email, [name="email"]') || {}).value || '',
      customer_name: '',
      items: [{ value: total || 0 }]
    };
  }

  SafeCover.init({
    apiUrl: 'https://api.yourinsurance.com',  // Change to your API URL
    containerId: 'safecover-container',
    getCheckoutData: getCheckoutData
  });
})();
