# SafeCover Platform Adapters

Use the universal widget + platform adapter for your e-commerce site.

## Integration Steps

1. Add a container where the widget should appear:
   ```html
   <div id="safecover-container"></div>
   ```

2. Load the widget script (before the adapter):
   ```html
   <script src="https://your-cdn.com/safecover-widget.js"></script>
   ```

3. Load your platform adapter (or use generic and customize):
   ```html
   <script src="https://your-cdn.com/adapters/shopify.js"></script>
   ```

4. Set your API URL in the adapter file (`apiUrl: 'https://api.yourinsurance.com'`).

## Available Adapters

| Platform | File | Notes |
|----------|------|-------|
| **Shopify** | shopify.js | Uses `Shopify.checkout` |
| **WooCommerce** | woocommerce.js | Uses `window.safecoverCheckoutData` if set by PHP plugin |
| **BigCommerce** | bigcommerce.js | Uses `BC.checkout` or DOM fallback |
| **Magento 2** | magento.js | Uses `checkoutConfig` / `quoteData` or DOM |
| **Generic** | generic.js | Customize `getCheckoutData()` for your platform |

## Checkout Data Format

Your `getCheckoutData()` must return:

```javascript
{
  order_id: string,
  email: string,
  customer_name: string,
  items: [{ value: number }, ...]  // value = price × quantity per item
}
```

## WooCommerce Note

For WooCommerce, you can use either:
- **PHP plugin** (server-side): `woocommerce/safecover-insurance-checkout.php` – no JS needed
- **JS adapter** (client-side): Use this adapter if you prefer the universal widget
