require('dotenv').config();
const express = require('express');
const path = require('path');

/* ============================================================
 * Deliplus UK Store — Express + Stripe Checkout (GBP)
 * - Catalog loaded from products.json (single source of truth)
 * - Prices NEVER come from the client; amounts are integer pence
 * - Currency: GBP — UK-first storefront (deliplus.uk)
 * - Global shipping zones via Stripe shipping_options
 * ============================================================ */

const CURRENCY = 'gbp';

/* ---- Server-side catalog from products.json ---- */
const productsData = require('./products.json');
if (productsData.currency.toUpperCase() !== 'GBP') {
  console.error('FATAL: products.json currency must be GBP');
  process.exit(1);
}
const CATALOG = {};
for (const p of productsData.products) {
  // integrity check: pence field must equal retail x 100
  if (!Number.isInteger(p.stripeUnitAmountCents) || p.stripeUnitAmountCents !== Math.round(p.retailPrice * 100)) {
    console.error(`FATAL: id ${p.id} — stripeUnitAmountCents mismatch`);
    process.exit(1);
  }
  CATALOG[p.id] = p;
}

/* ---- Shipping zones (fixed rates in GBP pence) ---- */
const SHIPPING_OPTIONS = [
  {
    shipping_rate_data: {
      type: 'fixed_amount',
      fixed_amount: { amount: 395, currency: CURRENCY },
      display_name: 'UK Standard Delivery (2–4 business days)',
      delivery_estimate: { minimum: { unit: 'business_day', value: 2 }, maximum: { unit: 'business_day', value: 4 } }
    }
  },
  {
    shipping_rate_data: {
      type: 'fixed_amount',
      fixed_amount: { amount: 695, currency: CURRENCY },
      display_name: 'Europe Delivery (5–8 business days)',
      delivery_estimate: { minimum: { unit: 'business_day', value: 5 }, maximum: { unit: 'business_day', value: 8 } }
    }
  },
  {
    shipping_rate_data: {
      type: 'fixed_amount',
      fixed_amount: { amount: 1295, currency: CURRENCY },
      display_name: 'Worldwide Delivery (8–15 business days)',
      delivery_estimate: { minimum: { unit: 'business_day', value: 8 }, maximum: { unit: 'business_day', value: 15 } }
    }
  }
];

const ALLOWED_COUNTRIES = [
  'GB', 'IE',
  'ES', 'PT', 'FR', 'DE', 'IT', 'NL', 'BE', 'LU', 'AT', 'GR', 'CH', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'HU', 'RO', 'BG', 'HR', 'SK', 'SI', 'EE', 'LV', 'LT',
  'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'UY', 'EC', 'DO', 'CR', 'PA',
  'AU', 'NZ', 'JP', 'KR', 'SG', 'HK', 'AE', 'SA', 'QA', 'IL', 'TR', 'MA', 'ZA', 'IN'
];

/* ---- Stripe init ---- */
const MOCK_STRIPE = process.env.MOCK_STRIPE === 'true';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY && !MOCK_STRIPE) {
  console.error('FATAL: STRIPE_SECRET_KEY is not set. Copy env.example to .env and add your key.');
  process.exit(1);
}
const stripe = MOCK_STRIPE ? null : require('stripe')(STRIPE_SECRET_KEY);

const app = express();

/* Webhook must read the RAW body before express.json() — registered first */
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  let event;
  const sig = req.headers['stripe-signature'];

  if (process.env.STRIPE_WEBHOOK_SECRET && !MOCK_STRIPE) {
    try {
      event = require('stripe').webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else {
    try { event = JSON.parse(req.body.toString()); } catch { return res.status(400).send('Invalid payload'); }
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object;
      console.log('✅ Payment completed:', s.id, '| Customer:', s.metadata && s.metadata.client_name, '| Total:', s.amount_total, s.currency);
      // TODO: fulfil the order (receipt email, ERP, shipping label, etc.)
      break;
    }
    default:
      console.log('Unhandled Stripe event:', event.type);
  }
  res.json({ received: true });
});

app.use(express.json());
require('./seo')(app, productsData.products, path.join(__dirname, 'public'));
app.use(express.static(path.join(__dirname, 'public')));

/* Public catalog — the browser never sends prices, only ids + quantities */
app.get('/api/products', (req, res) => {
  res.json(productsData.products.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: p.retailPrice,          // display price in GBP
    currency: 'gbp',
    image: p.image
  })));
});

app.post('/create-checkout-session', async (req, res) => {
  try {
    const { cart, customer } = req.body || {};

    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty.' });
    }
    if (!customer || !customer.name || !customer.surname || !customer.email || !customer.phone || !customer.address) {
      return res.status(400).json({ error: 'Missing customer details (name, surname, email, phone or address).' });
    }

    /* Build line items ONLY from the trusted server-side catalog */
    const line_items = [];
    for (const item of cart) {
      const product = CATALOG[item.id];
      if (!product) return res.status(400).json({ error: `Unknown product: ${item.id}` });

      const qty = parseInt(item.qty, 10);
      if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
        return res.status(400).json({ error: `Invalid quantity for product ${item.id}.` });
      }

      line_items.push({
        price_data: {
          currency: CURRENCY,
          product_data: { name: product.name, images: [product.image] },
          unit_amount: product.stripeUnitAmountCents, // integer pence, GBP
        },
        quantity: qty,
      });
    }

    /* ---- Mock mode (MOCK_STRIPE=true) for local testing without keys ---- */
    if (MOCK_STRIPE) {
      const total = line_items.reduce((sum, li) => sum + li.price_data.unit_amount * li.quantity, 0);
      console.warn('⚠️  MOCK_STRIPE=true — returning a simulated session (no real charge).');
      const origin = process.env.BASE_URL || req.headers.origin || `http://localhost:${process.env.PORT || 3000}`;
      return res.json({ url: `${origin}/success.html?mock=true`, mock: true, computed_total_cents: total });
    }

    const origin = process.env.BASE_URL || req.headers.origin || `http://localhost:${process.env.PORT || 3000}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      shipping_options: SHIPPING_OPTIONS,
      shipping_address_collection: { allowed_countries: ALLOWED_COUNTRIES },
      phone_number_collection: { enabled: true },
      customer_email: customer.email,
      payment_intent_data: { receipt_email: customer.email },   // Stripe emails the payment receipt to the customer automatically
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=true`,
      metadata: {
        client_name: customer.name,
        client_surname: customer.surname,
        client_email: customer.email,
        client_phone: customer.phone,
        client_address: customer.address
      }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating Stripe session:', error.message);
    res.status(500).json({ error: 'Could not start the payment. Please try again.' });
  }
});

const PORT = process.env.PORT || 3000;
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));
app.listen(PORT, () => {
  console.log(`Deliplus UK store server running on port ${PORT}${MOCK_STRIPE ? ' (MOCK STRIPE MODE)' : ''}`);
});
