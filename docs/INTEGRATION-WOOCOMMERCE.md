# SafeCover Integration Guide: WooCommerce

## Overview

Two integration options for WooCommerce:

| Option | Method | Best for |
|--------|--------|----------|
| **A. PHP Plugin** | Server-side, no JS | Simple setup, standard checkout |
| **B. Universal Widget** | Client-side JS | Custom themes, dynamic quote |

---

## Option A: PHP Plugin (Recommended)

### Step 1: Install the Plugin

1. Copy `woocommerce/safecover-insurance-checkout.php` to:
   ```
   wp-content/plugins/safecover-insurance/safecover-insurance-checkout.php
   ```

2. Activate in **WordPress Admin → Plugins**

### Step 2: Configure API URL

Edit the plugin file, line ~14:

```php
define('SAFECOVER_API_URL', 'https://api.yourinsurance.com');
```

For local testing: `http://localhost:3000`

### Step 3: Flow

1. **Quote** – Plugin calls `POST /api/quote` when checkout loads (cart items → premium)
2. **Display** – Checkbox appears: "Add insurance for $X.XX"
3. **Save** – On order, `quote_id` and `premium` stored in order meta
4. **Bind** – On thank-you page, plugin calls `POST /api/policy/bind`

### Step 4: Confirm on Payment

Add to your theme's `functions.php` or a custom plugin:

```php
add_action('woocommerce_payment_complete', 'safecover_confirm_policy');
function safecover_confirm_policy($order_id) {
    if (get_post_meta($order_id, 'safecover_insurance', true) !== 'yes') {
        return;
    }
    $policy_id = get_post_meta($order_id, 'safecover_policy_id', true);
    if (!$policy_id) return;

    wp_remote_post(SAFECOVER_API_URL . '/api/policy/confirm', [
        'method' => 'POST',
        'headers' => ['Content-Type' => 'application/json'],
        'body' => json_encode([
            'policy_id' => $policy_id,
            'transaction_id' => (string) $order_id,
            'payment_reference' => $order_id
        ])
    ]);
}
```

**Note:** The plugin currently doesn't save `policy_id` from the bind response. You'd need to extend it to store the bind response and pass it to confirm.

---

## Option B: Universal Widget (Client-Side)

### Step 1: Enqueue Scripts

Add to your theme's `functions.php`:

```php
add_action('wp_enqueue_scripts', 'safecover_enqueue_widget');
function safecover_enqueue_widget() {
    if (!is_checkout()) return;

    wp_enqueue_script(
        'safecover-widget',
        'https://cdn.yourinsurance.com/safecover-widget.js',
        [],
        '1.0',
        true
    );
}
```

### Step 2: Add Container + Inject Data

```php
add_action('woocommerce_review_order_after_shipping', 'safecover_widget_container');
function safecover_widget_container() {
    $cart = WC()->cart;
    if (!$cart) return;

    $items = [];
    foreach ($cart->get_cart() as $item) {
        $items[] = ['value' => (float) $item['line_subtotal']];
    }
    if (empty($items)) {
        $items[] = ['value' => (float) $cart->get_cart_contents_total()];
    }

    echo '<tr><td colspan="2"><div id="safecover-container"></div></td></tr>';
    echo '<script>
        window.safecoverCheckoutData = ' . json_encode([
            'order_id' => 'WC_' . time(),
            'email' => WC()->customer->get_email(),
            'customer_name' => WC()->customer->get_display_name(),
            'items' => $items
        ]) . ';
        window.safecoverApiUrl = "' . esc_js(SAFECOVER_API_URL) . '";
    </script>';
}
```

### Step 3: Load Adapter

```php
add_action('wp_footer', 'safecover_load_adapter');
function safecover_load_adapter() {
    if (!is_checkout()) return;
    ?>
    <script src="https://cdn.yourinsurance.com/adapters/woocommerce.js"></script>
    <?php
}
```

---

## Add Insurance Fee to Order Total

To charge the premium, add a fee when the checkbox is checked:

```php
add_action('woocommerce_cart_calculate_fees', 'safecover_add_fee');
function safecover_add_fee() {
    if (!isset($_POST['safecover_insurance']) || !$_POST['safecover_insurance']) {
        return;
    }
    $premium = isset($_POST['safecover_premium']) ? (float) $_POST['safecover_premium'] : 3.12;
    WC()->cart->add_fee('SafeCover Insurance', $premium, true);
}
```

**Note:** For dynamic fees, you may need to use AJAX to update the cart when the checkbox changes.

---

## Webhook: Order Status Updates

To receive order events (e.g. shipped), configure a webhook in your SafeCover dashboard pointing to:

```
https://yoursite.com/wp-json/safecover/v1/webhook
```

Register the endpoint:

```php
add_action('rest_api_init', function() {
    register_rest_route('safecover/v1', '/webhook', [
        'methods' => 'POST',
        'callback' => 'safecover_webhook_handler',
        'permission_callback' => '__return_true'
    ]);
});

function safecover_webhook_handler($request) {
    $body = $request->get_json_params();
    error_log('SafeCover webhook: ' . print_r($body, true));
    return new WP_REST_Response(null, 200);
}
```

---

## Summary

| Step | PHP Plugin | Universal Widget |
|------|------------|------------------|
| Install | Copy plugin, activate | Enqueue script |
| Quote | Server-side on page load | Client-side on load |
| Display | PHP-rendered checkbox | JS-rendered widget |
| Bind | On thank-you (PHP) | On checkbox change (JS) |
| Confirm | `woocommerce_payment_complete` | Same |

---

## See also

- [POS integration](INTEGRATION-POS.md) — retail POS via `POST /api/pos/enhanced` (separate from this web checkout flow)
- [API reference](API.md) — request/response details including POS Enhanced
