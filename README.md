# Deliplus Global Store 🌍🌿

Tienda e-commerce mundial de cosmética Deliplus (Tenerife → el mundo).
Node.js + Express + Stripe Checkout (EUR), frontend Tailwind + Vanilla JS.

## Características
- Catálogo con categorías dinámicas y contadores en tiempo real (Ojos y Cejas, Cuidado Facial, Cuerpo e Higiene, Cabello y Champús)
- Selector de cantidad (−/+) en cada tarjeta antes de añadir al carrito
- Carrito deslizante (slide-over) con totales en EUR
- **Los precios NUNCA vienen del navegador**: el servidor tiene el catálogo autorizado y aplica el margen 2.5× sobre el coste base, en céntimos enteros
- Stripe Checkout con: recogida de dirección internacional (`shipping_address_collection`, ~60 países), recogida de teléfono, 3 zonas de envío fijas (ES / Europa / Internacional) y metadatos del cliente (nombre, apellido, email, teléfono, dirección)
- Página de éxito `/success.html` + endpoint de webhook `/webhook` para confirmar pagos
- Stripe.js v3 en el flujo de pago (redirección a la sesión de Checkout)

## Ejecución local

```bash
cp env.example .env          # edita .env y pon tu clave (empieza por sk_test_...)
npm install
npm start                    # http://localhost:3000
```

Modo demo sin clave de Stripe (sin cargos reales):

```bash
MOCK_STRIPE=true npm start
```

## Despliegue

### Render
1. Sube el repo a GitHub (no incluyas `.env` ni `node_modules`).
2. En Render: **New → Web Service**, conecta el repo.
3. Build command: `npm install` · Start command: `npm start`.
4. En **Environment**, añade `STRIPE_SECRET_KEY` (empieza con `sk_test_...`).
5. Prueba un pago con la tarjeta de test `4242 4242 4242 4242`.
6. (Opcional) Añade `STRIPE_WEBHOOK_SECRET` y apunta un webhook de
   `checkout.session.completed` a `https://tu-dominio/webhook`.
7. Cuando todo funcione, cambia a tu clave `sk_live_...`.

### Railway
1. **New Project → Deploy from GitHub repo**.
2. En **Variables**, añade `STRIPE_SECRET_KEY`.
3. Railway detecta `npm start`; genera el dominio público.
4. Mismo consejo: prueba con `sk_test_...` y la tarjeta 4242… antes de pasar a `sk_live_...`.

## Notas de producción
- Sustituye el catálogo en memoria por una base de datos y añade gestión de stock.
- Añade webhook `checkout.session.completed` para automatizar el fulfillment.
- Cumple la normativa de tu jurisdicción (IVA/impuestos, RGPD, términos de venta).
