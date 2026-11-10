require('dotenv').config();
const express = require('express');
const path = require('path');

/* ============================================================
 * Deliplus Global Store — hardened Express + Stripe Checkout
 * - Prices live ONLY in this server-side catalog (2.5x markup)
 * - Amounts computed in integer EUR cents, never trusted from client
 * - Global shipping zones via Stripe shipping_options
 * - Address collection + phone collection enabled
 * - Customer data (name, surname, email, phone, address) in metadata
 * ============================================================ */

const MARKUP = 2.5;                 // retail = baseCost * MARKUP
const CURRENCY = 'eur';

/* ---- Server-side catalog: single source of truth for prices ---- */
const CATALOG = {
  1: { name: 'Perfilador de ojos Waterproof Deliplus 01 negro', category: 'eyes', basePrice: 2.20, image: 'https://prod-mercadona.imgix.net/images/f44a4fa64c09ba45ca4fc10d8c55c606.jpg?fit=crop&h=300&w=300' },
  2: { name: 'Perfilador de ojos Waterproof Deliplus 06 marrón', category: 'eyes', basePrice: 2.20, image: 'https://prod-mercadona.imgix.net/images/f7103591e662577de248cebd8439f07c.jpg?fit=crop&h=300&w=300' },
  3: { name: 'Sérum facial ácido hialurónico y ceramidas Hidrata', category: 'face', basePrice: 6.00, image: 'https://prod-mercadona.imgix.net/images/417a335e2cf9e49c883ec654f7eedb29.jpg?fit=crop&h=300&w=300' },
  4: { name: 'Crema facial Hidrata ácido hialurónico y aloe vera', category: 'face', basePrice: 5.00, image: 'https://prod-mercadona.imgix.net/images/f742763721e41b1e409c3cde1fb13d8e.jpg?fit=crop&h=300&w=300' },
  5: { name: 'Aceite corporal aloe vera Deliplus', category: 'body', basePrice: 3.50, image: 'https://prod-mercadona.imgix.net/images/76a23c276b7c9273382d278ac4fab212.jpg?fit=crop&h=300&w=300' },
  6: { name: 'Loción corporal Hidrata Deliplus aloe vera', category: 'body', basePrice: 2.80, image: 'https://prod-mercadona.imgix.net/images/075dfce6c0be2f32dd315789a65a7ce3.jpg?fit=crop&h=300&w=300' },
  7: { name: 'Champú protección y brillo Deliplus', category: 'hair', basePrice: 2.10, image: 'https://prod-mercadona.imgix.net/images/a49366621a784d2cf90babefbfd51827.jpeg?fit=crop&h=300&w=300' },
  8: { name: 'Mascarilla Repair & Nutrition Deliplus', category: 'hair', basePrice: 3.00, image: 'https://prod-mercadona.imgix.net/images/a633371d3a0e4a33ecba0219f8674845.jpg?fit=crop&h=300&w=300' }
};

/* ---- Global shipping zones (fixed rates in cents) ---- */
const SHIPPING_OPTIONS = [
  {
    shipping_rate_data: {
      type: 'fixed_amount',
      fixed_amount: { amount: 395, currency: CURRENCY, display: 'subtle' },
      display_name: 'Envío España (3–5 días laborables)',
      delivery_estimate: { minimum: { unit: 'business_day', value: 3 }, maximum: { unit: 'business_day', value: 5 } }
    }
  },
  {
    shipping_rate_data: {
      type: 'fixed_amount',
      fixed_amount: { amount: 695, currency: CURRENCY, display: 'subtle' },
      display_name: 'Envío Europa (5–8 días laborables)',
      delivery_estimate: { minimum: { unit: 'business_day', value: 5 }, maximum: { unit: 'business_day', value: 8 } }
    }
  },
  {
    shipping_rate_data: {
      type: 'fixed_amount',
      fixed_amount: { amount: 1295, currency: CURRENCY, display: 'subtle' },
      display_name: 'Envío Internacional (8–15 días laborables)',
      delivery_estimate: { minimum: { unit: 'business_day', value: 8 }, maximum: { unit: 'business_day', value: 15 } }
    }
  }
];

/* ---- Worldwide (plus key markets) delivery coverage ---- */
const ALLOWED_COUNTRIES = [
  'ES', 'PT', 'FR', 'DE', 'IT', 'NL', 'BE', 'LU', 'AT', 'IE', 'GR', 'CH', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'HU', 'RO', 'BG', 'HR', 'SK', 'SI', 'EE', 'LV', 'LT',
  'GB', 'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'UY', 'EC', 'VE', 'DO', 'CR', 'PA',
  'AU', 'NZ', 'JP', 'KR', 'SG', 'HK', 'AE', 'SA', 'QA', 'IL', 'TR', 'MA', 'ZA', 'IN'
];

/* ---- Stripe init ---- */
const MOCK_STRIPE = process.env.MOCK_STRIPE === 'true'; // local dev / demo only
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY && !MOCK_STRIPE) {
  console.error('FATAL: STRIPE_SECRET_KEY is not set. Copy env.example to .env and add your key (start with sk_test_...).');
  process.exit(1);
}
const stripe = MOCK_STRIPE ? null : require('stripe')(STRIPE_SECRET_KEY);

const app = express();

/* Webhook must read the RAW body before express.json() — register first */
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
      console.log('✅ Pago completado:', s.id, '| Cliente:', s.metadata && s.metadata.client_name, '| Total:', s.amount_total, s.currency);
      // TODO: fulfill the order (email receipt, ERP, shipping label, etc.)
      break;
    }
    default:
      console.log('Evento Stripe no gestionado:', event.type);
  }
  res.json({ received: true });
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* Public catalog — the browser never sends prices, only ids + quantities */
app.get('/api/products', (req, res) => {
  res.json(Object.entries(CATALOG).map(([id, p]) => ({
    id: Number(id),
    name: p.name,
    category: p.category,
    // Frontend display price = same markup the server charges
    price: +(p.basePrice * MARKUP).toFixed(2),
    currency: CURRENCY,
    image: p.image
  })));
});

app.post('/create-checkout-session', async (req, res) => {
  try {
    const { cart, customer } = req.body || {};

    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: 'El carrito está vacío.' });
    }
    if (!customer || !customer.name || !customer.surname || !customer.email || !customer.phone || !customer.address) {
      return res.status(400).json({ error: 'Faltan datos del cliente (nombre, apellido, email, teléfono o dirección).' });
    }

    /* Build line items ONLY from the trusted server-side catalog */
    const line_items = [];
    for (const item of cart) {
      const product = CATALOG[item.id];
      if (!product) return res.status(400).json({ error: `Producto desconocido: ${item.id}` });

      const qty = parseInt(item.qty, 10);
      if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
        return res.status(400).json({ error: `Cantidad no válida para el producto ${item.id}.` });
      }

      const unitPriceInCents = Math.round(product.basePrice * MARKUP * 100); // integer cents, EUR
      line_items.push({
        price_data: {
          currency: CURRENCY,
          product_data: { name: product.name, images: [product.image] },
          unit_amount: unitPriceInCents,
        },
        quantity: qty,
      });
    }

    /* ---- Mock mode (MOCK_STRIPE=true) for local testing without keys ---- */
    if (MOCK_STRIPE) {
      const total = line_items.reduce((sum, li) => sum + li.price_data.unit_amount * li.quantity, 0);
      console.warn('⚠️  MOCK_STRIPE=true — devolviendo sesión simulada (no se realizará ningún cargo real).');
      const origin = process.env.BASE_URL || req.headers.origin || `http://localhost:${process.env.PORT || 3000}`;
      return res.json({
        url: `${origin}/success.html?mock=true`,
        mock: true,
        computed_total_cents: total
      });
    }

    const origin = process.env.BASE_URL || req.headers.origin || `http://localhost:${process.env.PORT || 3000}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      shipping_options: SHIPPING_OPTIONS,
      shipping_address_collection: { allowed_countries: ALLOWED_COUNTRIES },
      phone_number_collection: { enabled: true },
      customer_email: customer.email,
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
    res.status(500).json({ error: 'No se pudo iniciar el pago. Inténtalo de nuevo.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Deliplus store server running on port ${PORT}${MOCK_STRIPE ? ' (MOCK STRIPE MODE)' : ''}`);
});
