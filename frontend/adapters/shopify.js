/**
 * SafeCover adapter for Shopify
 * Add to checkout.liquid or use Shopify Script Editor
 */
(function () {
  function getCheckoutData() {
    var checkout = window.Shopify && window.Shopify.checkout;
    if (!checkout) return null;

    var items = (checkout.line_items || []).map(function (item) {
      return { value: parseFloat(item.price) * (item.quantity || 1) };
    });

    var name = '';
    if (checkout.billing_address) {
      name = [checkout.billing_address.first_name, checkout.billing_address.last_name].filter(Boolean).join(' ');
    }

    return {
      order_id: checkout.order_id || checkout.token,
      email: checkout.email || '',
      customer_name: name,
      items: items.length ? items : [{ value: parseFloat(checkout.total_price) || 0 }]
    };
  }

  SafeCover.init({
    apiUrl: 'https://api.yourinsurance.com',
    containerId: 'safecover-container',
    getCheckoutData: getCheckoutData
  });
})();
