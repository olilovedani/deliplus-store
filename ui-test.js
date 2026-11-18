/* Functional test: execute the homepage JS in jsdom against the local store
   and verify grid render, quantity selector, basket counter, category filter,
   search, wishlist and checkout payload. */
const fs = require('fs');
const http = require('http');
const { JSDOM, VirtualConsole } = require('jsdom');

const html = fs.readFileSync(__dirname + '/public/index.html', 'utf8');

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: 'localhost', port: 4006, path, headers: { accept: 'application/json' } }, res => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => resolve(JSON.parse(b)));
    }).on('error', reject);
  });
}

(async () => {
  const catalog = await getJson('/api/products');
  const vc = new VirtualConsole();
  const errors = [];
  vc.on('jsdomError', e => { if (!/navigation/i.test(e.message)) errors.push('jsdomError: ' + e.message); });
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

  const dom = new JSDOM(html, {
    url: 'http://localhost:4006/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.fetch = (url, opts) => {
        const u = String(url);
        if (u.includes('/api/products')) return Promise.resolve({ json: async () => catalog, ok: true });
        if (u.includes('/create-checkout-session')) {
          window.__checkoutPayload = JSON.parse(opts.body);
          return Promise.resolve({ json: async () => ({ url: 'https://checkout.stripe.com/test_session' }), ok: true });
        }
        return Promise.resolve({ json: async () => ({}), ok: true });
      };
      window.alert = m => { (window.__alerts = window.__alerts || []).push(String(m)); };
    }
  });

  await new Promise(r => setTimeout(r, 700));
  const d = dom.window.document;
  const txt = el => (el.textContent || '').trim();
  const ok = (cond, label) => console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);

  const cards = d.querySelectorAll('#product-grid .dp-card');
  ok(cards.length === 279, `1. JS grid renders ${cards.length}/279 cards`);
  ok(txt(d.getElementById('cart-count')) === '0', '2. basket counter initial = 0');

  dom.window.changeCardQty(1, 1);                       // 1 -> 2
  const qtyShown = txt(d.getElementById('card-qty-1'));
  dom.window.addToCart(1);                              // adds 2 units, opens basket
  ok(qtyShown === '2', `3. card quantity selector changed to ${qtyShown}`);
  ok(txt(d.getElementById('cart-count')) === '2', '4. basket counter updated to 2 after add');
  ok(!d.getElementById('cart-modal').classList.contains('hidden'), '5. basket slide-over opens on add');

  dom.window.filterCategory('hair', true);
  let visible = [...d.querySelectorAll('#product-grid [data-category]')].filter(c => c.style.display !== 'none').length;
  ok(visible === 43 && dom.window.location.hash === '#hair', `6. filter Hair Care -> ${visible} visible, URL ${dom.window.location.hash}`);
  dom.window.filterCategory('makeup', false);
  visible = [...d.querySelectorAll('#product-grid [data-category]')].filter(c => c.style.display !== 'none').length;
  ok(visible === 66, `7. filter Makeup -> ${visible} visible`);
  dom.window.filterCategory('all', false);

  const heart = cards[0].querySelector('button');
  dom.window.toggleWishlist(1, heart);
  ok(heart.querySelector('svg').getAttribute('fill') === '#e11d48', '8. wishlist heart fills on toggle');
  ok(dom.window.localStorage.getItem('dp-wishlist') === '[1]', '9. wishlist persisted to localStorage');
  dom.window.toggleWishlist(1, heart);

  const ms = d.getElementById('product-search');
  ms.value = 'shampoo'; ms.dispatchEvent(new dom.window.Event('input'));
  await new Promise(r => setTimeout(r, 100));
  visible = [...d.querySelectorAll('#product-grid [data-category]')].filter(c => c.style.display !== 'none').length;
  ok(visible > 0 && visible < 279, `10. search "shampoo" -> ${visible} visible`);
  ms.value = ''; ms.dispatchEvent(new dom.window.Event('input'));

  d.getElementById('checkout-name').value = 'Test';
  d.getElementById('checkout-surname').value = 'Cliente';
  d.getElementById('checkout-email').value = 'test@example.com';
  d.getElementById('checkout-phone').value = '+447000000000';
  d.getElementById('checkout-address').value = '10 Downing St, London, SW1A 2AA, GB';
  dom.window.addToCart(1);
  dom.window.checkoutStripe();
  await new Promise(r => setTimeout(r, 300));
  const p = dom.window.__checkoutPayload;
  ok(!!p && p.cart.length > 0 && p.cart[0].qty === 3 && p.customer.name === 'Test',
     `11. checkout posts ids+qty+customer: ${p ? JSON.stringify(p.cart) + '|' + p.customer.name : 'NOT CALLED'}`);

  ok(errors.length === 0, `12. no JS runtime errors${errors.length ? ' — got: ' + errors[0] : ''}`);
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('TEST CRASH:', e.message); process.exit(1); });
