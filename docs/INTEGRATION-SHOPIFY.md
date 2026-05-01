# SafeCover Integration Guide: Shopify

## Overview

Add SafeCover microinsurance to Shopify checkout. The widget appears after shipping options; customers can add protection before payment.

---

## Step 1: Create a Checkout Extension (Recommended)

Use Shopify's **Checkout UI Extensions** (Shopify Plus or compatible plans).

### 1.1 Create extension

```bash
shopify app generate extension --type checkout_ui_extension --name safecover-insurance
```

### 1.2 Extension code (`src/Checkout.jsx`)

```jsx
import {
  reactExtension,
  BlockStack,
  Checkbox,
  Text,
  useApi,
} from '@shopify/ui-extensions-react/checkout';

export default reactExtension('purchase.checkout.block.render', () => (
  <SafeCoverBlock />
));

function SafeCoverBlock() {
  const { query } = useApi();
  const [checked, setChecked] = useState(false);
  const [premium, setPremium] = useState(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    // Fetch quote when cart loads
    query('cart').then((cart) => {
      const items = cart.lines.map((line) => ({
        value: parseFloat(line.cost.totalAmount.amount) * line.quantity,
      }));
      fetch('https://api.yourinsurance.com/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
        .then((r) => r.json())
        .then((data) => setPremium(data.premium));
    });
  }, []);

  const handleChange = (value) => {
    setChecked(value);
    if (value) {
      query('cart').then((cart) => {
        const payload = {
          quote_id: 'QTY' + Date.now(),
          transaction_id: cart.id,
          customer: { email: cart.buyerIdentity?.email },
          items: cart.lines.map((l) => ({ value: parseFloat(l.cost.totalAmount.amount) })),
          premium_paid: premium,
        };
        fetch('https://api.yourinsurance.com/api/policy/bind', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
          .then((r) => r.json())
          .then(() => setStatus("You're protected! ✓"));
      });
    } else {
      setStatus('');
    }
  };

  return (
    <BlockStack spacing="loose">
      <Text size="medium" emphasis="bold">Add Protection with SafeCover™</Text>
      <Text size="small">Covers loss, damage, or theft during delivery. Up to $1,000.</Text>
      <Checkbox checked={checked} onChange={handleChange}>
        Add insurance for ${premium?.toFixed(2) ?? '3.12'}
      </Checkbox>
      {status && <Text appearance="success">{status}</Text>}
    </BlockStack>
  );
}
```

---

## Step 2: Script / Liquid (Classic Checkout)

For stores without Checkout Extensions, use **Additional scripts** in Settings → Checkout.

### 2.1 Add to checkout.liquid (or Additional scripts)

```liquid
<div id="safecover-container" style="margin-top: 20px;"></div>

<script src="https://cdn.yourinsurance.com/safecover-widget.js"></script>
<script>
  (function() {
    function getCheckoutData() {
      var checkout = window.Shopify && window.Shopify.checkout;
      if (!checkout) return null;

      var items = (checkout.line_items || []).map(function(item) {
        return { value: parseFloat(item.price) * (item.quantity || 1) };
      });
      var name = '';
      if (checkout.billing_address) {
        name = [checkout.billing_address.first_name, checkout.billing_address.last_name]
          .filter(Boolean).join(' ');
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
</script>
```

---

## Step 3: Order Status Webhook (Confirm Policy)

Create a **Webhook** in Shopify Admin → Settings → Notifications → Webhooks:

- **Event:** Order creation
- **URL:** `https://api.yourinsurance.com/api/webhook`

Your backend should:
1. Receive the webhook
2. Check if order has SafeCover (stored in order note or metafield)
3. Call `POST /api/policy/confirm` with `policy_id` and `transaction_id`

### Example: Shopify Flow / Function

```javascript
// Shopify Function: order payment callback
export async function run(input) {
  const order = input.order;
  const hasInsurance = order.note?.includes('SafeCover') || 
    order.metafields?.some(m => m.key === 'safecover_policy_id');

  if (hasInsurance) {
    const policyId = order.metafields?.find(m => m.key === 'safecover_policy_id')?.value;
    await fetch('https://api.yourinsurance.com/api/policy/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        policy_id: policyId,
        transaction_id: order.id.toString(),
        payment_reference: order.transactions?.[0]?.id
      })
    });
  }

  return { operations: [] };
}
```

---

## Configuration

| Setting | Value |
|---------|-------|
| API URL | `https://api.yourinsurance.com` |
| Widget CDN | Host `safecover-widget.js` on your CDN |

---

## Testing

1. Use Shopify dev store with test checkout
2. Set API URL to `http://localhost:3000` for local testing (use ngrok for webhooks)
3. Place test order and verify policy bind + confirm flow

---

## See also

- [POS integration](INTEGRATION-POS.md) — in-store registers via `POST /api/pos/enhanced` (server-side; not the checkout widget)
- [API reference](API.md) — all endpoints including POS Enhanced
