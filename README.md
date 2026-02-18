# SafeCover Embedded Microinsurance System

Embedded microinsurance for e-commerce checkouts. Works with **any platform**: Shopify, WooCommerce, BigCommerce, Magento, custom sites.

> **Demo / Prototype** — This project is a demonstration and reference implementation. It is not intended for production use without proper insurance licensing, regulatory compliance, and security hardening. Use at your own risk.

## Documentation

| Doc | Description |
|-----|--------------|
| [API Reference](docs/API.md) | Quote, Bind, Confirm, Webhook – full structure |
| [Shopify Integration](docs/INTEGRATION-SHOPIFY.md) | Checkout extension + Liquid snippets |
| [WooCommerce Integration](docs/INTEGRATION-WOOCOMMERCE.md) | PHP plugin + universal widget |
| [Checkout UX Demo](frontend/checkout-ux-demo.html) | Desktop + mobile simulation |

## Project Structure

```
├── backend/              # Node.js Express API
├── docs/                 # API reference + integration guides
├── frontend/
│   ├── safecover-widget.js   # Universal widget (platform-agnostic)
│   ├── checkout-ux-demo.html # Desktop + mobile UX simulation
│   ├── adapters/             # Platform-specific adapters
│   │   ├── shopify.js
│   │   ├── woocommerce.js
│   │   ├── bigcommerce.js
│   │   ├── magento.js
│   │   └── generic.js
│   ├── widget.html           # Demo page
│   └── embed-snippet.html    # Generic embed template
├── contracts/             # Ethereum smart contract (Solidity)
├── woocommerce/           # WooCommerce PHP plugin (server-side)
└── README.md
```

## Quick Start

### 1. Backend API

```bash
cd backend
npm install
npm start
```

API runs at `http://localhost:3000`

**Endpoints:**
- `POST /api/quote` – Get insurance quote
- `POST /api/policy/bind` – Bind policy at checkout
- `POST /api/policy/confirm` – Confirm policy when payment succeeds
- `POST /api/webhook` – Receive order/payment events

### 2. Universal Widget (Any E-Commerce Platform)

**Option A: Use a platform adapter**

1. Add container: `<div id="safecover-container"></div>`
2. Load widget + adapter:
   ```html
   <script src="safecover-widget.js"></script>
   <script src="adapters/shopify.js"></script>
   ```
3. Set `apiUrl` in the adapter file.

**Option B: Custom integration**

```html
<div id="safecover-container"></div>
<script src="safecover-widget.js"></script>
<script>
  SafeCover.init({
    apiUrl: 'https://api.yourinsurance.com',
    getCheckoutData: function() {
      return {
        order_id: '...',
        email: '...',
        customer_name: '...',
        items: [{ value: 100 }]
      };
    }
  });
</script>
```

**Supported platforms:** Shopify, WooCommerce, BigCommerce, Magento, custom. See `frontend/adapters/README.md`.

### 3. WooCommerce (Server-Side)

For WordPress/WooCommerce, use the PHP plugin (no JS required):

1. Copy `woocommerce/safecover-insurance-checkout.php` to `wp-content/plugins/safecover-insurance/`
2. Activate in WordPress Admin → Plugins
3. Set `SAFECOVER_API_URL` in the plugin file

### 4. Smart Contract

Deploy `contracts/MicroInsurancePolicy.sol` with Hardhat, Foundry, or Remix.

## Configuration

| Component   | Config                          |
|-------------|----------------------------------|
| Backend     | `PORT` env var (default: 3000)  |
| Widget      | `apiUrl` in SafeCover.init()    |
| WooCommerce | `SAFECOVER_API_URL` constant    |

## License

MIT — see [LICENSE](LICENSE) for details.
