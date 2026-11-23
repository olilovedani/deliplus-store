/* ============================================================
 * seo.js — Server-side rendered SEO layer for Deliplus UK
 * - Prerendered crawlable HTML for /, category, product pages
 * - Product + BreadcrumbList + FAQPage + Organization JSON-LD
 * - Dynamic sitemap.xml + Google Merchant feed.xml
 * - Trust pages (placeholder markers for owner-known facts)
 * - Does NOT touch /create-checkout-session, /webhook or basket JS
 * ============================================================ */
module.exports = function seo(app, products, publicDir) {
  const fs = require('fs');
  const path = require('path');
  const BASE = (process.env.BASE_URL || 'https://deliplus.uk').replace(/\/$/, '');
  const GA = process.env.GA4_MEASUREMENT_ID || '';

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const gbp = p => '£' + p.toFixed(2);
  const slugify = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const prodSlug = p => `/product/${p.id}-${slugify(p.name)}`;
  const GA_SNIPPET = GA ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(GA)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(GA)}');</script>` : '';

  const CATS = {
    makeup: { label: 'Makeup', h1: 'Deliplus Makeup — Spanish Cosmetics Delivered in the UK',
      intro: 'Explore Deliplus make-up sourced from Spain: fluid foundations, concealers, brow pencils, mascaras, eyeshadows, lip liners and lipsticks. Every item is an authentic Deliplus product from Mercadona\u2019s own-brand beauty range, priced in GBP with UK and worldwide delivery.' },
    eyes: { label: 'Eyes & Brows', h1: 'Deliplus Eye & Brow Products — Liners, Mascaras and Brow Pencils',
      intro: 'Shop Deliplus eye and brow products in the UK: waterproof eye liners, eyeliners, brow pencils, brow gels, mascaras and eyeshadow palettes. Authentic Spanish cosmetics at affordable prices, delivered across the UK.' },
    lips: { label: 'Lips', h1: 'Deliplus Lip Products — Lipsticks, Lip Liners and Balms',
      intro: 'Browse Deliplus lip care and colour: matte and creamy lipsticks, fluid matte lipsticks, 12h lasting lipsticks, lip liners, tinted balms and repairing lip balms. Sourced from Spain, shipped across the UK and worldwide.' },
    face: { label: 'Facial Care', h1: 'Deliplus Facial Care — Spanish Skincare for UK Customers',
      intro: 'Deliplus facial care sourced from Spain: make-up remover wipes and pads, facial mists, sheet masks, eye patches, BB creams and targeted face creams. Authentic products from Mercadona\u2019s cosmetics range with UK delivery.' },
    body: { label: 'Body Care', h1: 'Deliplus Body Care — Lotions, Oils and Hand Creams',
      intro: 'Shop Deliplus body care in the UK: body lotions, body oils, body creams and butters, hand creams, foot creams, scrubs and hygiene wipes. Authentic Spanish products, delivered UK-wide and worldwide.' },
    hair: { label: 'Hair Care', h1: 'Deliplus Hair Care — Shampoos, Conditioners and Hair Masks',
      intro: 'Buy Deliplus hair care online in the UK: shampoos, conditioners, hair masks, leave-in masks, serums and treatments for dry, damaged, curly, coloured and sensitive-scalp hair types. Authentic Deliplus products from Spain.' }
  };

  const byCat = cat => products.filter(p => p.category === cat && p.inStock);
  const featured = products.filter(p => p.inStock).slice(0, 8);

  /* ---------- shared layout ---------- */
  function layout({ title, desc, canonical, body, jsonLd = [], status = 200, crumbHtml = '' }) {
    const ld = jsonLd.map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n');
    const html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Deliplus UK">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:locale" content="en_GB">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
${GA_SNIPPET}
${ld}
<style>body{font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;margin:0;background:#f9fafb;color:#1f2937}.wrap{max-width:80rem;margin:0 auto;padding:0 1rem}header{background:#fff;border-bottom:1px solid #e5e7eb;position:sticky;top:0}header .wrap{display:flex;justify-content:space-between;align-items:center;padding:1rem}a{color:#047857}.logo{font-weight:900;font-size:1.6rem;color:#047857;text-decoration:none}.banner{background:#047857;color:#fff;text-align:center;padding:.6rem;font-size:.8rem}.crumbs{font-size:.75rem;color:#6b7280;padding:1rem 0}.crumbs a{color:#6b7280}h1{font-size:1.7rem;margin:.5rem 0}h2{font-size:1.25rem;margin-top:2rem}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1rem}@media(min-width:768px){.grid{grid-template-columns:repeat(4,1fr)}}.card{background:#fff;border:1px solid #e5e7eb;border-radius:1rem;overflow:hidden;display:flex;flex-direction:column}.card img{width:100%;height:11rem;object-fit:cover;background:#f3f4f6}.card .cbody{padding:.9rem;display:flex;flex-direction:column;gap:.5rem;flex:1}.card .name{font-size:.8rem;line-height:1.3;min-height:2.4rem}.price{font-weight:900;color:#047857;font-size:1.05rem}.btn{display:block;text-align:center;background:#111827;color:#fff;padding:.6rem;border-radius:.7rem;font-size:.75rem;font-weight:700;text-decoration:none;margin-top:auto}.btn:hover{background:#047857}.catlist{display:flex;flex-wrap:wrap;gap:.6rem;padding:0;list-style:none}.catlist a{background:#f3f4f6;border:1px solid #e5e7eb;border-radius:.8rem;padding:.5rem .9rem;font-size:.85rem;font-weight:600;text-decoration:none}.faq dt{font-weight:700;margin-top:1rem}footer{background:#065f46;color:#d1fae5;text-align:center;font-size:.75rem;padding:1.5rem;margin-top:3rem}footer a{color:#a7f3d0}.meta{font-size:.75rem;color:#6b7280}.badge{background:#d1fae5;color:#065f46;font-size:.7rem;font-weight:700;padding:.15rem .5rem;border-radius:.5rem}.placeholder{background:#fef9c3;border:1px dashed #ca8a04;padding:.15rem .3rem;border-radius:.3rem}</style>
</head>
<body>
<div class="banner">🌿 Worldwide shipping available! · Official Deliplus Collection</div>
<header><div class="wrap"><a class="logo" href="/">Deliplus <span style="font-size:.55rem;border:1px solid #a7f3d0;border-radius:99px;padding:.1rem .4rem;vertical-align:middle">UK</span></a><a class="btn" style="background:#047857;display:inline-block;padding:.55rem 1.1rem" href="/#all-products">Shop all products</a></div></header>
<div class="wrap">${crumbHtml ? `<nav class="crumbs" aria-label="Breadcrumb">${crumbHtml}</nav>` : ''}
${body}
</div>
<footer><strong>SLU Deliplus UK</strong> · 85 Great Portland St, Harley St, London W1W 7LT, United Kingdom · <a href="mailto:client@deliplus.uk" style="color:#a7f3d0">client@deliplus.uk</a><br>© Deliplus UK · Independent retailer of authentic Spanish cosmetics · Secure payments by Stripe<br>
<a href="/about-deliplus/">About Deliplus</a> · <a href="/shipping-to-uk/">Shipping to the UK</a> · <a href="/returns-refunds/">Returns &amp; Refunds</a> · <a href="/contact/">Contact</a> · <a href="/faq/">FAQ</a> · <a href="/privacy-policy/">Privacy</a> · <a href="/terms/">Terms</a> · <a href="/blog/">Blog</a></footer>
<script>
async function submitReview(ev, id) {
  ev.preventDefault();
  const form = document.getElementById('review-form-' + id);
  const s = document.getElementById('rv-status-' + id);
  s.textContent = 'Sending…';
  try {
    const payload = {
        name: document.getElementById('rv-name-' + id).value.trim(),
        email: document.getElementById('rv-email-' + id).value.trim(),
        rating: document.getElementById('rv-rating-' + id).value,
        message: 'PRODUCT REVIEW for ' + form.dataset.product + ' (SKU ' + form.dataset.sku + '):\n\n' + document.getElementById('rv-text-' + id).value.trim()
      };
    const r = await fetch('https://formsubmit.co/ajax/deliplus.uk@gmail.com', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ _subject: 'Product review submission (' + payload.rating + '/5) — ' + payload.name,
        _replyto: payload.email, _captcha: 'false', _template: 'table', ...payload }) }).catch(() => null);
    let d = null;
    if (r) { const out = await r.json().catch(() => ({})); if ((out.success === true || out.success === 'true')) d = { ok: true, message: 'Thank you! Your review has been submitted and will be published after moderation.' }; }
    if (!d) { const r2 = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, orderRef: '', website: document.getElementById('rv-website-' + id).value }) }); d = await r2.json(); }
    if (d.ok) { s.textContent = 'Thank you! Your review has been submitted and will be published after moderation.'; form.reset(); }
    else s.textContent = 'Error: ' + (d.error || 'please try again');
  } catch (e) { s.textContent = 'Network error — please email client@deliplus.uk.'; }
  return false;
}
</script>
</body>
</html>`;
    return { status, html };
  }

  const crumb = items => `<ol style="list-style:none;display:flex;gap:.4rem;margin:0;padding:0">${items.map((it, i) => `<li>${it.url ? `<a href="${esc(it.url)}">${esc(it.name)}</a>` : `<span>${esc(it.name)}</span>`}${i < items.length - 1 ? ' /' : ''}</li>`).join('')}</ol>`;

  function productCard(p) {
    return `<div class="card"><img src="${esc(p.image)}" alt="${esc(p.name)} — Deliplus ${esc(CATS[p.category] ? CATS[p.category].label : p.category)} product" loading="lazy"><div class="cbody"><div class="name"><a href="${esc(prodSlug(p))}" style="text-decoration:none;color:inherit">${esc(p.name)}</a></div><div class="price">${gbp(p.retailPrice)}</div><a class="btn" href="${esc(prodSlug(p))}">View product</a></div></div>`;
  }

  const INDEPENDENT = '<p><em>Deliplus UK is an independent retailer of Deliplus products and is not owned by, affiliated with or an authorised distributor for Mercadona, S.A. Products are sourced from Spain.</em></p>';

  /* ---------- HOMEPAGE: inject SSR content into index.html ---------- */
  let homeCache = null;
  function buildHome() {
    const raw = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
    const catLinks = Object.entries(CATS).map(([slug, c]) => `<li><a href="/category/${slug}/">${c.label} <span class="meta">(${byCat(slug).length})</span></a></li>`).join('');
    const feat = featured.map(productCard).join('');
    const faq = [
      ['What is Deliplus?', 'Deliplus is the own-brand cosmetics and personal-care range of Mercadona, a Spanish supermarket chain. Deliplus UK is an independent online retailer selling authentic Deliplus products sourced from Spain.'],
      ['Do you deliver across the UK?', 'Yes. We deliver to England, Scotland, Wales and Northern Ireland. UK standard delivery is £3.95 and takes 2\u20134 business days. We also ship to Europe and worldwide.'],
      ['What currency are prices in?', 'All prices are in British Pounds (GBP). Payments are processed securely through Stripe.'],
      ['Where do the products come from?', 'All products are sourced from Spain and shipped to your delivery address. We do not manufacture the products; Deliplus is produced for Mercadona.']
    ];
    const faqHtml = `<h2>Frequently asked questions</h2><dl>${faq.map(([q, a]) => `<dt>${esc(q)}</dt><dd>${esc(a)}</dd>`).join('')}</dl>`;
    const ssr = `
<section id="ssr-seo" class="max-w-7xl mx-auto px-4 sm:px-6 py-10">
<h1 class="text-2xl sm:text-3xl font-black text-[#0F172A] mb-4">Shop Authentic Deliplus Spanish Cosmetics Online in the UK</h1>
<p class="text-sm text-gray-600 max-w-3xl leading-relaxed">Deliplus UK sells <strong>authentic Deliplus cosmetics and beauty products</strong> — the own-brand beauty range of the Spanish supermarket Mercadona — to customers across England, Scotland, Wales and Northern Ireland, with worldwide delivery also available. Browse <strong>${products.filter(p => p.inStock).length} products</strong> across makeup, eyes &amp; brows, lips, facial care, body care and hair care, all priced in GBP and paid for securely through Stripe.</p>
<h2 class="text-lg font-black mt-8 mb-3">Shop by category</h2>
<ul class="flex flex-wrap gap-2.5 list-none p-0 m-0">${Object.entries(CATS).map(([slug, c]) => `<li><a class="bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#E2E8F0] rounded-2xl px-4 py-2 text-sm font-semibold text-[#1E293B] no-underline" href="/category/${slug}/">${c.label} <span class="text-[11px] bg-[#E2E8F0] text-[#334155] rounded-full px-2 py-0.5">${byCat(slug).length}</span></a></li>`).join('')}</ul>
<h2 class="text-lg font-black mt-10 mb-4">Featured products</h2>
<div class="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">${featured.map(p => `
  <div class="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col overflow-hidden">
    <a href="${prodSlug(p)}"><img src="${p.image}" alt="${p.name} — authentic Deliplus product" loading="lazy" class="w-full h-48 object-contain p-3"></a>
    <div class="px-4 pb-4 flex flex-col gap-3 flex-1">
      <a href="${prodSlug(p)}" class="text-[13px] leading-snug font-medium text-[#0F172A] no-underline line-clamp-2 min-h-[2.4rem]">${p.name}</a>
      <span class="text-lg font-black text-[#007A48]">${gbp(p.retailPrice)}</span>
      <a href="${prodSlug(p)}" class="mt-auto w-full bg-[#007A48] hover:bg-[#006838] text-white py-2.5 rounded-xl text-[13px] font-semibold text-center no-underline">Add to basket</a>
      <a href="${prodSlug(p)}" class="w-full bg-white border border-[#E2E8F0] hover:border-[#006838] text-[#0F172A] py-2.5 rounded-xl text-[13px] font-semibold text-center no-underline">View product</a>
    </div>
  </div>`).join('')}</div>
<h2 class="text-lg font-black mt-10 mb-3">Why order from Deliplus UK</h2>
<ul class="list-disc pl-5 text-sm text-gray-600 space-y-1"><li>Authentic Deliplus products sourced directly from Spain</li><li>UK-wide delivery to England, Scotland, Wales and Northern Ireland (2–4 business days, £3.95)</li><li>Worldwide shipping to Europe, the Americas, Asia and Oceania</li><li>Secure card payments in GBP via Stripe Checkout</li><li>Clear prices in British Pounds — no surprise currency conversion at checkout</li></ul>
<h2 class="text-lg font-black mt-8 mb-2">About Deliplus</h2>
<p class="text-sm text-gray-600 max-w-3xl">Deliplus is the cosmetics and personal-care brand sold by Mercadona, one of Spain's largest supermarket chains. The range covers make-up, facial care, body care and hair care at accessible prices, and has a strong following in Spain and beyond. Deliplus UK imports and resells these products so UK customers can order without travelling to Spain.</p>
<p class="text-xs italic text-gray-500 mt-2">Deliplus UK is an independent retailer of Deliplus products and is not owned by, affiliated with or an authorised distributor for Mercadona, S.A. Products are sourced from Spain.</p>
<h2 class="text-lg font-black mt-8 mb-2">Frequently asked questions</h2>
<dl class="text-sm text-gray-600">${faq.map(([q, a]) => `<dt class="font-bold text-[#0F172A] mt-3">${esc(q)}</dt><dd class="ml-0 mt-1">${esc(a)}</dd>`).join('')}</dl>
<h2 id="all-products" class="text-lg font-black mt-10">All products</h2>
</section>`;
    const tabsSsr = `<button class="px-4 py-2 rounded-2xl text-xs sm:text-sm font-semibold bg-[#006838] text-white shadow-sm flex items-center gap-2"><span>All products</span><span class="text-[11px] px-2 py-0.5 rounded-full bg-[#005934] text-white">${products.filter(p => p.inStock).length}</span></button>` +
      Object.entries(CATS).map(([s, c]) => `<a href="#${s}" class="px-4 py-2 rounded-2xl text-xs sm:text-sm font-semibold bg-[#F1F5F9] text-[#1E293B] hover:bg-[#E2E8F0] flex items-center gap-2 no-underline"><span>${c.label}</span><span class="text-[11px] px-2 py-0.5 rounded-full bg-[#E2E8F0] text-[#334155]">${byCat(s).length}</span></a>`).join('');
    let out = raw.replace(
      '<div id="category-buttons" class="max-w-7xl mx-auto px-4 sm:px-6 overflow-x-auto py-3 flex gap-2.5 no-scrollbar"></div>',
      `<div id="category-buttons" class="max-w-7xl mx-auto px-4 sm:px-6 overflow-x-auto py-3 flex gap-2.5 no-scrollbar">${tabsSsr}</div>`
    );
    out = out.replace('    <footer', `${ssr}\n    <footer`);
    out = out.replace('</head>', `${GA_SNIPPET}
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', name: 'SLU Deliplus UK', legalName: 'SLU Deliplus UK', url: BASE + '/', email: 'client@deliplus.uk', description: 'Independent UK retailer of authentic Deliplus Spanish cosmetics.', address: { '@type': 'PostalAddress', streetAddress: '85 Great Portland St, Harley St', addressLocality: 'London', postalCode: 'W1W 7LT', addressCountry: 'GB' } })}</script>
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Deliplus UK', url: BASE + '/' })}</script>
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) })}</script>
</head>`);
    out = out.replace('© Deliplus UK · Authentic Spanish cosmetics, shipped worldwide 🌍 · Secure payments by Stripe',
      `© Deliplus UK · Authentic Spanish cosmetics, shipped worldwide 🌍 · Secure payments by Stripe<br><a href="/about-deliplus/" style="color:#a7f3d0">About</a> · <a href="/shipping-to-uk/" style="color:#a7f3d0">Shipping</a> · <a href="/returns-refunds/" style="color:#a7f3d0">Returns</a> · <a href="/contact/" style="color:#a7f3d0">Contact</a> · <a href="/privacy-policy/" style="color:#a7f3d0">Privacy</a> · <a href="/terms/" style="color:#a7f3d0">Terms</a>`);
    return out;
  }
  try { homeCache = buildHome(); } catch (e) { console.error('SSR homepage injection failed:', e.message); homeCache = null; }

  app.get('/', (req, res) => {
    if (homeCache) return res.status(200).type('html').send(homeCache);
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  /* ---------- CATEGORY PAGES ---------- */
  Object.keys(CATS).forEach(slug => {
    const c = CATS[slug];
    app.get(`/category/${slug}/`, (req, res) => {
      const list = byCat(slug);
      const url = `${BASE}/category/${slug}/`;
      const body = `<h1>${esc(c.h1)}</h1><p>${esc(c.intro)}</p><p class="meta">${list.length} products · Prices in GBP · UK standard delivery £3.95 (2–4 business days)</p>
<h2>Products</h2><div class="grid">${list.map(productCard).join('')}</div>
<h2>Other categories</h2><ul class="catlist">${Object.entries(CATS).filter(([s]) => s !== slug).map(([s, o]) => `<li><a href="/category/${s}/">${o.label}</a></li>`).join('')}</ul>`;
      const { status, html } = layout({
        title: `Buy Deliplus ${c.label} in the UK | Spanish Cosmetics — Deliplus UK`,
        desc: `Shop authentic Deliplus ${c.label.toLowerCase()} products from Spain at Deliplus UK. ${list.length} products, prices in GBP, UK delivery £3.95 (2–4 days) and worldwide shipping.`,
        canonical: url, body,
        jsonLd: [
          { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: BASE + '/' },
            { '@type': 'ListItem', position: 2, name: c.label, item: url }] },
          { '@context': 'https://schema.org', '@type': 'ItemList', name: `Deliplus ${c.label}`, numberOfItems: list.length, itemListElement: list.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: BASE + prodSlug(p), name: p.name })) }
        ],
        crumbHtml: crumb([{ name: 'Home', url: '/' }, { name: c.label }])
      });
      res.status(status).type('html').send(html);
    });
  });

  /* friendly 301 aliases per requested architecture */
  [['/skincare/', 'face'], ['/makeup/', 'makeup'], ['/hair-care/', 'hair'], ['/body-care/', 'body'], ['/sun-care/', null], ['/fragrance/', null], ['/best-sellers/', null], ['/new-arrivals/', null]].forEach(([from, target]) => {
    app.get(from, (req, res) => {
      if (target) return res.redirect(301, `/category/${target}/`);
      res.redirect(301, '/');  // no genuine best-seller/new-arrival/sun-care/fragrance data — do not fabricate
    });
  });

  /* ---------- PRODUCT PAGES ---------- */
  app.get('/product/:idslug', (req, res) => {
    const id = parseInt(req.params.idslug, 10);
    const p = products.find(x => x.id === id);
    if (!p || !p.inStock) {
      const { html } = layout({ title: 'Product not found | Deliplus UK', desc: 'This product could not be found.', canonical: `${BASE}/product/${esc(req.params.idslug)}`, body: '<h1>Product not found</h1><p>The product you are looking for is not in our current catalogue.</p><p><a href="/">Browse all products</a></p>' });
      return res.status(404).type('html').send(html);
    }
    const wantSlug = `${p.id}-${slugify(p.name)}`;
    if (req.params.idslug !== wantSlug) return res.redirect(301, `/product/${wantSlug}`);
    const cat = CATS[p.category] || { label: p.category };
    const url = BASE + prodSlug(p);
    const desc = `${p.name} is a Deliplus ${cat.label.toLowerCase()} product — the own-brand beauty range of the Spanish supermarket Mercadona. ${p.format ? `Format: ${p.format}. ` : ''}Buy online in the UK for ${gbp(p.retailPrice)} with UK delivery (2–4 business days) and worldwide shipping.`;
    const related = byCat(p.category).filter(x => x.id !== p.id).slice(0, 4);
    const body = `<h1>${esc(p.name)}</h1>
<p class="meta">SKU: ${esc(p.sku)} · Category: <a href="/category/${p.category}/">${esc(cat.label)}</a></p>
<p><span class="badge">In stock</span> <span class="price" style="font-size:1.5rem">${gbp(p.retailPrice)}</span> <span class="meta">GBP · includes UK shipping options at checkout</span></p>
<img src="${esc(p.image)}" alt="${esc(p.name)} — authentic Deliplus product" style="max-width:320px;width:100%;border-radius:1rem;border:1px solid #e5e7eb">
<h2>About this product</h2>
<p>${esc(p.name)} is part of the Deliplus range, the own-brand cosmetics and personal-care line of the Spanish supermarket Mercadona. ${p.format ? `Supplied format: ${esc(p.format)}.` : ''} It is sourced from Spain and sold in the UK by Deliplus UK, an independent retailer.</p>
${INDEPENDENT}
<p><a class="btn" style="display:inline-block;background:#047857;padding:.8rem 1.5rem;font-size:.9rem" href="/?add=${p.id}">Add to basket &amp; checkout</a></p>
<p class="meta">You will be taken to the main store page with this item added to your basket. Checkout is handled securely by Stripe in GBP.</p>
<h2>Delivery &amp; returns</h2>
<p>UK standard delivery £3.95 (2–4 business days). Europe £6.95 (5–8 business days). Worldwide £12.95 (8–15 business days). See <a href="/shipping-to-uk/">shipping details</a> and the <a href="/returns-refunds/">returns policy</a>.</p>
<h2>Seller information</h2>
<p><strong>SLU Deliplus UK</strong> · 85 Great Portland St, Harley St, London W1W 7LT, United Kingdom · <a href="mailto:client@deliplus.uk">client@deliplus.uk</a> · <a href="/about-deliplus/">About us</a></p>
<h2>Reviews</h2>
<p class="meta">We publish only genuine customer reviews and moderate every submission. There are no verified reviews for this product yet — if you have bought it, you can submit the first one below.</p>
<form id="review-form-${p.id}" data-product="${esc(p.name)}" data-sku="${esc(p.sku)}" style="max-width:30rem;display:flex;flex-direction:column;gap:.6rem;margin:.5rem 0 1rem" onsubmit="return submitReview(event, ${p.id})">
  <input type="text" id="rv-name-${p.id}" placeholder="Your name *" required style="padding:.6rem;border:1px solid #e5e7eb;border-radius:.6rem">
  <input type="email" id="rv-email-${p.id}" placeholder="Your email (not published) *" required style="padding:.6rem;border:1px solid #e5e7eb;border-radius:.6rem">
  <select id="rv-rating-${p.id}" required style="padding:.6rem;border:1px solid #e5e7eb;border-radius:.6rem"><option value="">Your rating *</option><option value="5">★★★★★ Excellent</option><option value="4">★★★★ Good</option><option value="3">★★★ Average</option><option value="2">★★ Poor</option><option value="1">★ Very poor</option></select>
  <textarea id="rv-text-${p.id}" rows="4" placeholder="Your review *" required style="padding:.6rem;border:1px solid #e5e7eb;border-radius:.6rem;font-family:inherit"></textarea>
  <input type="text" id="rv-website-${p.id}" style="display:none" tabindex="-1" autocomplete="off">
  <button type="submit" class="btn" style="background:#047857;border:none;cursor:pointer">Submit review</button>
  <p id="rv-status-${p.id}" class="meta"></p>
</form>
${related.length ? `<h2>Related products</h2><div class="grid">${related.map(productCard).join('')}</div>` : ''}`;
    const { status, html } = layout({
      title: `${p.name} | Buy Deliplus UK — ${gbp(p.retailPrice)}`,
      desc, canonical: url, body,
      jsonLd: [
        { '@context': 'https://schema.org', '@type': 'Product', name: p.name, image: [p.image], description: desc, sku: p.sku, brand: { '@type': 'Brand', name: 'Deliplus' }, /* no GTIN/MPN: not verified — omitted rather than fabricated */ offers: { '@type': 'Offer', url, priceCurrency: 'GBP', price: p.retailPrice.toFixed(2), availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', itemCondition: 'https://schema.org/NewCondition', seller: { '@type': 'Organization', name: 'SLU Deliplus UK (independent retailer)' } } },
        { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE + '/' },
          { '@type': 'ListItem', position: 2, name: cat.label, item: `${BASE}/category/${p.category}/` },
          { '@type': 'ListItem', position: 3, name: p.name, item: url }] }
      ],
      crumbHtml: crumb([{ name: 'Home', url: '/' }, { name: cat.label, url: `/category/${p.category}/` }, { name: p.name }])
    });
    res.status(status).type('html').send(html);
  });

  /* ---------- SITEMAP (dynamic, matches live catalogue) ---------- */
  app.get('/sitemap.xml', (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const urls = [
      ['/', '1.0', 'daily'], ['/blog/', '0.6', 'weekly'],
      ...Object.keys(CATS).map(s => [`/category/${s}/`, '0.9', 'daily']),
      ...products.filter(p => p.inStock).map(p => [prodSlug(p), '0.8', 'weekly']),
      ['/about-deliplus/', '0.4', 'monthly'], ['/about-mercadona/', '0.4', 'monthly'],
      ['/shipping-to-uk/', '0.4', 'monthly'], ['/returns-refunds/', '0.4', 'monthly'],
      ['/contact/', '0.3', 'monthly'], ['/faq/', '0.4', 'monthly'],
      ['/privacy-policy/', '0.2', 'yearly'], ['/terms/', '0.2', 'yearly'],
      ...BLOG_POSTS.map(b => [`/blog/${b.slug}/`, '0.5', 'monthly'])
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, pr, cf]) => `  <url><loc>${BASE}${u}</loc><lastmod>${today}</lastmod><changefreq>${cf}</changefreq><priority>${pr}</priority></url>`).join('\n')}\n</urlset>`;
    res.type('application/xml').send(xml);
  });

  /* ---------- GOOGLE MERCHANT FEED ---------- */
  app.get('/feed.xml', (req, res) => {
    const items = products.filter(p => p.inStock).map(p => `  <item>
    <g:id>${p.sku}</g:id>
    <title>${esc(p.name)}</title>
    <link>${esc(BASE + prodSlug(p))}</link>
    <description>${esc(p.name)} — authentic Deliplus product sourced from Spain. ${esc(p.format || '')}</description>
    <g:image_link>${esc(p.image)}</g:image_link>
    <g:condition>new</g:condition>
    <g:availability>in stock</g:availability>
    <g:price>${p.retailPrice.toFixed(2)} GBP</g:price>
    <g:brand>Deliplus</g:brand>
    <g:product_type>Health &amp; Beauty &gt; Personal Care &gt; Cosmetics</g:product_type>
    <g:shipping>
      <g:country>GB</g:country>
      <g:service>UK Standard Delivery</g:service>
      <g:price>3.95 GBP</g:price>
    </g:shipping>
  </item>`).join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>Deliplus UK — Spanish Cosmetics</title>
<link>${BASE}/</link>
<description>Authentic Deliplus cosmetics from Spain, delivered in the UK and worldwide. Independent retailer.</description>
${items}
</channel>
</rss>`;
    res.type('application/xml').send(xml);
  });

  /* ---------- BLOG ---------- */
  const BLOG_POSTS = [
    { slug: 'what-is-deliplus', title: 'What Is Deliplus? Discover the Spanish Beauty Brand',
      body: `<p>Deliplus is the own-brand cosmetics and personal-care range of <a href="https://www.mercadona.es" rel="noopener">Mercadona</a>, one of Spain\u2019s largest supermarket chains. The line covers make-up, facial care, body care and hair care, and it is known in Spain for combining low prices with consistently good quality control — it is one of the country\u2019s best-selling beauty ranges.</p>
<h2>What does the Deliplus range include?</h2>
<p>The range is broad. In our current UK catalogue alone there are ${products.length} products across six areas: makeup (foundations, concealers, powders and highlighters), eye and brow products (waterproof liners, mascaras, brow pencils), lip products (matte and creamy lipsticks, liners, balms), facial care (make-up remover wipes, facial mists, sheet masks, BB creams), body care (lotions, oils, hand and foot creams) and hair care (shampoos, conditioners, masks and serums).</p>
<h2>Why is Deliplus popular?</h2>
<p>Two reasons come up again and again: price and practicality. Most Deliplus products cost a fraction of high-street equivalents — in our store, prices currently start at £2.00 — and the formulas are straightforward everyday products rather than trend-led launches.</p>
<h2>Can you buy Deliplus in the UK?</h2>
<p>Mercadona does not trade in the UK, so the realistic options are travelling to Spain or ordering from an independent UK retailer. <a href="/">Deliplus UK</a> stocks ${products.length} Deliplus lines with UK delivery at £3.95 (2–4 business days). <em>Deliplus UK is an independent retailer and is not affiliated with Mercadona, S.A.</em></p>` },
    { slug: 'where-to-buy-mercadona-cosmetics-in-the-uk', title: 'Where to Buy Mercadona Cosmetics in the UK (2026 Guide)',
      body: `<p>Mercadona — the Spanish supermarket behind the Deliplus cosmetics range — has no stores in the UK, so British shoppers have historically had two routes: buy on holiday, or ask friends to bring products back. There is now a third option: ordering online from UK-based independent retailers.</p>
<h2>Option 1: order online in the UK</h2>
<p>Independent retailers such as <a href="/">Deliplus UK</a> import authentic Deliplus lines and sell them in GBP with UK delivery. Our catalogue currently covers ${products.length} products, from the £2.63 travel bottle to the £27.50 Face Beauty gift set, with UK standard delivery at £3.95 (2–4 business days) and worldwide options.</p>
<h2>Option 2: buy in Spain</h2>
<p>If you are visiting Spain, Deliplus is stocked in every Mercadona store. Note that prices are in euros and luggage space limits how much you can bring back.</p>
<h2>What to check before ordering</h2>
<ul><li>That the retailer states products are sourced from Spain (authenticity)</li><li>That prices are shown in GBP including clear delivery costs before checkout</li><li>That there is a written returns policy that complies with UK consumer law</li></ul>
<p><em>Deliplus UK is an independent retailer and is not owned by or an authorised distributor for Mercadona, S.A.</em></p>` },
    { slug: 'how-to-buy-spanish-cosmetics-online-in-the-uk', title: 'How to Buy Spanish Cosmetics Online in the UK',
      body: `<p>Spanish pharmacy and supermarket beauty brands have a loyal UK following. Here is how to order them online with confidence.</p>
<h2>1. Buy from retailers who state their sourcing</h2>
<p>Look for a clear statement that products are sourced from Spain, and a real company behind the site. Our own <a href="/about-deliplus/">about page</a> explains exactly what Deliplus UK is and is not.</p>
<h2>2. Check the price in GBP — including delivery</h2>
<p>A low headline price can be undone by delivery costs. Our prices are shown in GBP (for example, the Deliplus Facial Serum is £15.00) and UK standard delivery is a flat £3.95 for 2–4 business days, shown before checkout.</p>
<h2>3. Understand the product range</h2>
<p>Spanish supermarket own-brands such as Deliplus cover the full routine: cleansing wipes and pads, face mists and masks, foundations and mascaras, body lotions and butters, and hair shampoos, conditioners and masks. Start with a category page such as <a href="/category/hair/">hair care</a> or <a href="/category/face/">facial care</a> and read the product pages for formats and sizes.</p>
<h2>4. Know your consumer rights</h2>
<p>UK distance-selling rules give you the right to cancel most online orders within 14 days. Our <a href="/returns-refunds/">returns policy</a> sets out how this works for Deliplus UK orders.</p>` }
  ];
  Object.defineProperty(module.exports, 'BLOG_POSTS', { value: BLOG_POSTS });

  app.get('/blog/', (req, res) => {
    const list = BLOG_POSTS.map(b => `<li style="margin:.6rem 0"><a href="/blog/${b.slug}/">${esc(b.title)}</a></li>`).join('');
    const { status, html } = layout({
      title: 'Blog | Deliplus UK — Spanish Cosmetics Guides',
      desc: 'Guides to the Deliplus brand, Mercadona cosmetics and buying Spanish beauty products online in the UK.',
      canonical: `${BASE}/blog/`,
      body: `<h1>Deliplus UK Blog</h1><p>Guides to Deliplus, Mercadona cosmetics and buying Spanish beauty products in the UK.</p><ul style="padding-left:1.2rem">${list}</ul><p class="meta">More articles are in preparation and will be published gradually.</p>`
    });
    res.status(status).type('html').send(html);
  });
  BLOG_POSTS.forEach(b => {
    app.get(`/blog/${b.slug}/`, (req, res) => {
      const url = `${BASE}/blog/${b.slug}/`;
      const body = `<h1>${esc(b.title)}</h1><p class="meta">By the Deliplus UK team · 17 November 2026</p>${b.body}
<h2>Shop Deliplus in the UK</h2><ul class="catlist">${Object.entries(CATS).map(([s, o]) => `<li><a href="/category/${s}/">${o.label}</a></li>`).join('')}</ul>
<h2>More reading</h2><ul style="padding-left:1.2rem">${BLOG_POSTS.filter(x => x.slug !== b.slug).map(x => `<li><a href="/blog/${x.slug}/">${esc(x.title)}</a></li>`).join('')}</ul>`;
      const { status, html } = layout({ title: `${b.title} | Deliplus UK`, desc: b.title + ' — guide from Deliplus UK, independent retailer of authentic Spanish cosmetics.', canonical: url, body,
        jsonLd: [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BASE}/blog/` },
          { '@type': 'ListItem', position: 3, name: b.title, item: url }] }],
        crumbHtml: crumb([{ name: 'Home', url: '/' }, { name: 'Blog', url: '/blog/' }, { name: b.title }]) });
      res.status(status).type('html').send(html);
    });
  });

  /* ---------- CONTACT / REVIEW SUBMISSIONS (emailed to deliplus.uk@gmail.com via FormSubmit relay) ---------- */
  const CONTACT_EMAIL = 'deliplus.uk@gmail.com';
  app.post('/api/contact', async (req, res) => {
    try {
      const b = req.body || {};
      if (b.website) return res.json({ ok: true, message: 'Thank you! Your message has been received.' }); // honeypot: silently drop bots
      const name = String(b.name || '').trim().slice(0, 120);
      const email = String(b.email || '').trim().slice(0, 200);
      const orderRef = String(b.orderRef || '').trim().slice(0, 60);
      const rating = String(b.rating || '').trim().slice(0, 1);
      const message = String(b.message || '').trim().slice(0, 5000);
      if (!name || !email || !message || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return res.status(400).json({ ok: false, error: 'Please provide your name, a valid email and a message.' });
      }
      const subject = rating
        ? `Product review submission (${rating}/5) — ${name}`
        : `Website contact${orderRef ? ' — order ' + orderRef : ''} — ${name}`;
      const r = await fetch(`https://formsubmit.co/ajax/${CONTACT_EMAIL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: 'https://deliplus.uk', Referer: 'https://deliplus.uk/contact/' },
        body: JSON.stringify({ _subject: subject, _replyto: email, _captcha: 'false', _template: 'table', name, email, orderRef: orderRef || '—', rating: rating ? rating + '/5' : '—', message })
      });
      const out = await r.json().catch(() => ({}));
      const sent = out && (out.success === true || out.success === 'true');
      if (r.ok && sent) return res.json({ ok: true, message: 'Thank you! Your message has been sent — we will reply within 2 business days.' });
      // FormSubmit returns HTTP 200 even when it did NOT send (e.g. activation pending) — treat honestly:
      console.error('FormSubmit did not send:', r.status, JSON.stringify(out).slice(0, 200));
      console.log('SAVED-FOR-MANUAL-PROCESSING:', subject, '|', name, '|', email, '|', orderRef, '|', message.slice(0, 500));
      return res.json({ ok: true, message: 'Thank you! Your message has been received and will be processed within 2 business days.' });
    } catch (e) {
      console.error('Contact form error:', e.message);
      return res.status(502).json({ ok: false, error: 'Could not send your message right now — please email client@deliplus.uk directly.' });
    }
  });

  /* ---------- TRUST / INFO PAGES ---------- */
  const OWNER = `<p><strong>SLU Deliplus UK</strong><br>85 Great Portland St, Harley St, London W1W 7LT, United Kingdom<br>Email: <a href="mailto:client@deliplus.uk">client@deliplus.uk</a></p>
`;
  const trust = {
    'about-deliplus': { title: 'About Deliplus UK | Independent Retailer of Spanish Cosmetics',
      body: `<h1>About Deliplus UK</h1><p>Deliplus UK is an <strong>independent online retailer</strong> selling authentic Deliplus cosmetics and beauty products to customers in the United Kingdom and worldwide.</p>
<h2>What we sell</h2><p>Our catalogue covers ${products.length} Deliplus products across makeup, eyes &amp; brows, lips, facial care, body care and hair care, all sourced from Spain and priced in GBP.</p>
<h2>Our relationship with Mercadona</h2><p>Deliplus is the own-brand cosmetics range of Mercadona, a Spanish supermarket chain. Deliplus UK is <strong>not</strong> owned by, affiliated with, or an authorised distributor for Mercadona, S.A. We purchase Deliplus products sourced in Spain and resell them to UK customers.</p>
<h2>Business information</h2>${OWNER}` },
    'about-mercadona': { title: 'About Mercadona | The Spanish Supermarket Behind Deliplus',
      body: `<h1>About Mercadona</h1><p>Mercadona is one of Spain\u2019s largest supermarket chains, with hundreds of stores across Spain and Portugal. Its own-brand ranges — including the Deliplus cosmetics line — are a major part of its appeal and are widely used in Spain.</p>
<h2>Deliplus and Mercadona</h2><p>Deliplus is the name under which Mercadona sells its cosmetics and personal-care products. The range spans make-up, skincare, body care and hair care.</p>
<h2>Deliplus UK\u2019s relationship with Mercadona</h2><p>Deliplus UK is an independent retailer. We are not Mercadona, we are not affiliated with Mercadona, S.A., and we are not an authorised distributor. We source authentic Deliplus products in Spain and resell them to UK customers.</p>
<p>For the official Mercadona website, visit <a href="https://www.mercadona.es" rel="noopener">mercadona.es</a>.</p>` },
    'shipping-to-uk': { title: 'Shipping to the UK | Delivery Costs & Times — Deliplus UK',
      body: `<h1>Shipping to the UK</h1>
<h2>UK delivery (England, Scotland, Wales, Northern Ireland)</h2><p><strong>£3.95 — 2–4 business days.</strong> Available on all orders, shown as an option at Stripe checkout.</p>
<h2>Europe</h2><p><strong>£6.95 — 5–8 business days.</strong></p>
<h2>Worldwide</h2><p><strong>£12.95 — 8–15 business days.</strong></p>
<h2>How delivery works</h2><p>Delivery options and costs are selected at checkout, after you enter your delivery address. All prices on the site are in GBP; payment is taken in GBP by Stripe. <span class="placeholder">[PLACEHOLDER — OWNER TO COMPLETE: dispatch cut-off times, dispatch location, and whether tracking is provided.]</span></p>` },
    'returns-refunds': { title: 'Returns & Refunds Policy | Deliplus UK',
      body: `<h1>Returns &amp; Refunds Policy</h1>
<h2>Your right to cancel (UK distance-selling rules)</h2><p>Under the Consumer Contracts Regulations, you may cancel most online orders within <strong>14 days</strong> of receiving your goods and return them for a refund. <span class="placeholder">[PLACEHOLDER — OWNER TO COMPLETE: exact returns window, return address, condition requirements for cosmetics/hygiene items, and who pays return postage. This is a legal statement that must reflect the owner\u2019s actual policy.]</span></p>
<h2>Damaged or incorrect items</h2><p>If an item arrives damaged or is not what you ordered, contact us with your order reference and a photo if possible — we will offer a replacement or a full refund, and cover the return postage.</p>
<h2>How to request a return</h2><p>Email <a href="mailto:client@deliplus.uk">client@deliplus.uk</a> or use the <a href="/contact/">contact form</a> with your order reference (shown on your success page and in your payment confirmation email). We will confirm the return address and next steps.</p>
<h2>Return conditions</h2>
<ul><li>Items must be <strong>unopened and unused</strong>, in their original packaging, to be accepted for a change-of-mind return.</li>
<li>For change-of-mind returns, <strong>return postage is paid by the customer</strong>.</li>
<li><strong>Faulty or damaged goods:</strong> your statutory rights under the Consumer Rights Act 2015 always apply — we accept the return and pay the return postage; you may choose a refund or replacement.</li></ul>` },
    'contact': { title: 'Contact Deliplus UK | Customer Service',
      body: `<h1>Contact us</h1><p>Questions about an order, a product or delivery? Send us a message using the form below — include your order reference if you have one (it is shown on your payment confirmation page and email).</p>
<h2>Our details</h2><p><strong>SLU Deliplus UK</strong><br>85 Great Portland St, Harley St, London W1W 7LT, United Kingdom<br>Email: <a href="mailto:client@deliplus.uk">client@deliplus.uk</a></p>
<p>We aim to reply within 2 business days. Orders are paid through Stripe.</p>
<h2>Message form</h2>
<form id="contact-form" style="max-width:30rem;display:flex;flex-direction:column;gap:.7rem" onsubmit="return submitContact(event)">
  <input type="text" id="cf-name" placeholder="Your name *" required style="padding:.6rem;border:1px solid #e5e7eb;border-radius:.6rem">
  <input type="email" id="cf-email" placeholder="Your email *" required style="padding:.6rem;border:1px solid #e5e7eb;border-radius:.6rem">
  <input type="text" id="cf-order" placeholder="Order reference (optional)" style="padding:.6rem;border:1px solid #e5e7eb;border-radius:.6rem">
  <textarea id="cf-message" rows="5" placeholder="Your message *" required style="padding:.6rem;border:1px solid #e5e7eb;border-radius:.6rem;font-family:inherit"></textarea>
  <input type="text" id="cf-website" style="display:none" tabindex="-1" autocomplete="off">
  <button type="submit" class="btn" style="background:#047857;border:none;cursor:pointer">Send message</button>
  <p id="cf-status" class="meta"></p>
</form>
<script>
async function submitContact(ev) {
  ev.preventDefault();
  const s = document.getElementById('cf-status');
  s.textContent = 'Sending…';
  try {
    const payload = {
        name: document.getElementById('cf-name').value.trim(),
        email: document.getElementById('cf-email').value.trim(),
        orderRef: document.getElementById('cf-order').value.trim(),
        message: document.getElementById('cf-message').value.trim()
      };
    const r = await fetch('https://formsubmit.co/ajax/deliplus.uk@gmail.com', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ _subject: 'Website contact' + (payload.orderRef ? ' — order ' + payload.orderRef : '') + ' — ' + payload.name,
        _replyto: payload.email, _captcha: 'false', _template: 'table', ...payload }) }).catch(() => null);
    let d = null;
    if (r) { const out = await r.json().catch(() => ({})); if ((out.success === true || out.success === 'true')) d = { ok: true, message: 'Thank you! Your message has been sent — we will reply within 2 business days.' }; }
    if (!d) { const r2 = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, website: document.getElementById('cf-website').value }) }); d = await r2.json(); }
    if (d.ok) { s.textContent = d.message; ev.target.reset(); }
    else { s.textContent = 'Error: ' + (d.error || 'please try again'); }
  } catch (e) { s.textContent = 'Network error — please email us directly at client@deliplus.uk.'; }
  return false;
}
</script>` },
    'faq': { title: 'FAQ | Deliplus UK — Ordering, Delivery and Products',
      body: `<h1>Frequently asked questions</h1>
<dl><dt>What is Deliplus?</dt><dd>Deliplus is the own-brand cosmetics and personal-care range of Mercadona, a Spanish supermarket chain. Deliplus UK is an independent online retailer selling authentic Deliplus products sourced from Spain.</dd>
<dt>Do you deliver across the UK?</dt><dd>Yes — England, Scotland, Wales and Northern Ireland. UK standard delivery is £3.95 (2–4 business days). We also deliver to Europe (£6.95) and worldwide (£12.95).</dd>
<dt>What currency are prices in?</dt><dd>All prices are in GBP and payment is processed securely through Stripe.</dd>
<dt>Are you an official Mercadona store?</dt><dd>No. Deliplus UK is an independent retailer and is not affiliated with or an authorised distributor for Mercadona, S.A.</dd>
<dt>How do I return an item?</dt><dd>See our <a href="/returns-refunds/">returns policy</a> — UK distance-selling rules give you a 14-day right to cancel most orders.</dd><dt>How can I contact customer service?</dt><dd>Email <a href="mailto:client@deliplus.uk">client@deliplus.uk</a> or use the form on our <a href="/contact/">contact page</a> — we reply within 2 business days.</dd></dl>` },
    'privacy-policy': { title: 'Privacy Policy | Deliplus UK',
      body: `<h1>Privacy Policy</h1><p>This policy explains what personal data Deliplus UK collects and how it is used. Last updated: 17 November 2026.</p>
<h2>What we collect</h2><p>When you place an order we collect the name, surname, email, phone number and delivery address you provide, plus the order contents and amount. Payments are processed by <strong>Stripe</strong>; we do not receive or store your full card details.</p>
<h2>Why we process it</h2><p>To fulfil your order (contract), to keep legally required payment/accounting records (legal obligation), and to answer your queries (legitimate interest). We do not sell your data and we do not add you to marketing lists without consent.</p>
<h2>Who we share it with</h2><p>Stripe (payment processing) and our delivery providers as needed to fulfil your order.</p>
<h2>Retention, rights and contact</h2><p>The data controller is <strong>SLU Deliplus UK</strong>, 85 Great Portland St, Harley St, London W1W 7LT, United Kingdom (email: <a href="mailto:client@deliplus.uk">client@deliplus.uk</a>). Order records are kept for as long as required by applicable tax and accounting law (typically at least six years). You have rights of access, rectification, erasure and objection under UK GDPR — to exercise them, email <a href="mailto:client@deliplus.uk">client@deliplus.uk</a>. You may also complain to the ICO (ico.org.uk).</p>
<h2>Cookies</h2><p>The store currently sets no tracking cookies of its own. If analytics are enabled in future, this policy and a consent banner will be updated first. <span class="placeholder">[PLACEHOLDER — OWNER TO COMPLETE if any analytics/marketing cookies are switched on: consent management per PECR.]</span></p>` },
    'terms': { title: 'Terms & Conditions | Deliplus UK',
      body: `<h1>Terms &amp; Conditions</h1><p>These terms apply to orders placed on deliplus.uk. Last updated: 17 November 2026.</p>
<h2>Who we are</h2><p>Deliplus UK is an independent retailer of Deliplus-brand cosmetics sourced from Spain. We are not affiliated with or an authorised distributor for Mercadona, S.A. The trader behind this website is <strong>SLU Deliplus UK</strong>, 85 Great Portland St, Harley St, London W1W 7LT, United Kingdom (email: <a href="mailto:client@deliplus.uk">client@deliplus.uk</a>).</p>
<h2>Orders and pricing</h2><p>Prices are in GBP and include UK VAT where applicable. <span class="placeholder">[PLACEHOLDER — OWNER TO CONFIRM VAT treatment of imported cosmetics.]</span> An order is accepted when payment succeeds via Stripe Checkout; you will see an order reference on the confirmation page.</p>
<h2>Delivery</h2><p>Delivery options and times are shown at checkout and summarised on the <a href="/shipping-to-uk/">shipping page</a>. Risk passes to you on delivery.</p>
<h2>Returns</h2><p>See the <a href="/returns-refunds/">returns &amp; refunds policy</a>, which forms part of these terms.</p>
<h2>Liability and law</h2><p>Nothing in these terms limits your statutory rights as a UK consumer. These terms are governed by the laws of England and Wales, and the courts of England and Wales have non-exclusive jurisdiction over any dispute.</p>` }
  };
  Object.entries(trust).forEach(([slug, pg]) => {
    app.get(`/${slug}/`, (req, res) => {
      const { status, html } = layout({ title: pg.title, desc: pg.title.replace(' | Deliplus UK', '') + ' — Deliplus UK, independent retailer of authentic Spanish cosmetics.', canonical: `${BASE}/${slug}/`, body: pg.body });
      res.status(status).type('html').send(html);
    });
    app.get(`/${slug}`, (req, res) => res.redirect(301, `/${slug}/`));
  });
};
