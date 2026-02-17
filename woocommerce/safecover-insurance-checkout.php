<?php
/**
 * Plugin Name: SafeCover Insurance Checkout
 * Description: Adds SafeCover microinsurance option at checkout
 * Version: 1.0.0
 * Author: SafeCover
 */

if (!defined('ABSPATH')) {
    exit;
}

define('SAFECOVER_API_URL', 'https://api.yourinsurance.com'); // Change for production

add_action('woocommerce_review_order_after_shipping', 'safecover_checkout_offer');
function safecover_checkout_offer() {
    $quote = safecover_fetch_quote();

    $premium = $quote['premium'];
    $quote_id = $quote['quote_id'];

    echo '<tr class="safecover-insurance">
    <th>Insurance (SafeCover)</th>
    <td>
        <input type="hidden" name="safecover_quote_id" value="' . esc_attr($quote_id) . '" />
        <input type="hidden" name="safecover_premium" value="' . esc_attr($premium) . '" />
        <label><input type="checkbox" name="safecover_insurance" /> Add insurance for $' . esc_html(number_format($premium, 2)) . '</label>
    </td>
    </tr>';
}

/**
 * Fetch quote from SafeCover API based on cart contents.
 *
 * @return array{quote_id: string, premium: float}
 */
function safecover_fetch_quote() {
    $default = [
        'quote_id' => 'QTY' . time(),
        'premium' => 3.12,
    ];

    if (!function_exists('WC') || !WC()->cart) {
        return $default;
    }

    $items = [];
    foreach (WC()->cart->get_cart() as $cart_item) {
        $items[] = ['value' => (float) $cart_item['line_subtotal']];
    }

    if (empty($items)) {
        $items[] = ['value' => (float) WC()->cart->get_cart_contents_total()];
    }

    $response = wp_remote_post(SAFECOVER_API_URL . '/api/quote', [
        'timeout' => 5,
        'headers' => ['Content-Type' => 'application/json'],
        'body' => json_encode(['items' => $items]),
    ]);

    if (is_wp_error($response)) {
        return $default;
    }

    $body = json_decode(wp_remote_retrieve_body($response), true);
    $code = wp_remote_retrieve_response_code($response);

    if ($code !== 200 || !is_array($body) || empty($body['quote_id'])) {
        return $default;
    }

    return [
        'quote_id' => sanitize_text_field($body['quote_id']),
        'premium' => isset($body['premium']) ? (float) $body['premium'] : $default['premium'],
    ];
}

add_action('woocommerce_checkout_update_order_meta', 'safecover_save_selection');
function safecover_save_selection($order_id) {
    if (isset($_POST['safecover_insurance'])) {
        update_post_meta($order_id, 'safecover_insurance', 'yes');
        if (!empty($_POST['safecover_quote_id'])) {
            update_post_meta($order_id, 'safecover_quote_id', sanitize_text_field($_POST['safecover_quote_id']));
        }
        if (isset($_POST['safecover_premium'])) {
            update_post_meta($order_id, 'safecover_premium', (float) $_POST['safecover_premium']);
        }
    }
}

add_action('woocommerce_thankyou', 'safecover_send_policy');
function safecover_send_policy($order_id) {
    $order = wc_get_order($order_id);
    if (!$order || get_post_meta($order_id, 'safecover_insurance', true) !== 'yes') {
        return;
    }

    $quote_id = get_post_meta($order_id, 'safecover_quote_id', true) ?: 'QTY' . time();
    $premium = (float) get_post_meta($order_id, 'safecover_premium', true) ?: 3.12;

    $data = [
        'transaction_id' => (string) $order_id,
        'customer' => [
            'email' => $order->get_billing_email(),
            'name' => $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
        ],
        'premium_paid' => $premium,
        'quote_id' => $quote_id,
    ];

    wp_remote_post(SAFECOVER_API_URL . '/api/policy/bind', [
        'method' => 'POST',
        'headers' => ['Content-Type' => 'application/json'],
        'body' => json_encode($data),
    ]);
}
