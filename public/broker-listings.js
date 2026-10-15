/**
 * Broker-listings embed for fyiyachts.com broker bio pages
 * (e.g. /ralph-navarro/). Renders a broker's live inventory — active + sold —
 * pulled from the BoatsGroup feed by listing broker (SalesRep), the same data
 * that powers the portal's /team/:slug pages.
 *
 * Install once, globally (WPCode footer, same slot as brianna-embed.js):
 *   <script src="https://<this-app-domain>/broker-listings.js" defer></script>
 *
 * Then on each broker page, drop ONE Code module containing a target div with
 * the broker's name exactly as it appears in the boats.com feed:
 *   <div class="fyi-broker-listings" data-broker="Ralph Navarro"></div>
 *
 * Active listing cards link to the site's worldwide-listings keyword search
 * for that make, keeping the visitor on fyiyachts.com. Sold cards are badged
 * showcase — social proof of the broker's track record.
 */
(function () {
  if (window.__fyiBrokerListingsLoaded) return;
  window.__fyiBrokerListingsLoaded = true;

  var script = document.currentScript;
  var origin;
  try { origin = new URL(script.src).origin; } catch (e) { return; }

  var NAVY = '#0f2740';
  var GOLD = '#D4AF37';
  var SOLD = '#9d7413';
  var SEARCH = 'https://fyiyachts.com/worldwide-listings/?keyword=';

  function usd(n) {
    if (n == null || n === 0) return 'Price on request';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function card(b, sold) {
    var meta = [b.year, b.lengthFt ? Math.round(b.lengthFt) + ' ft' : null,
      [b.city, b.state || b.country].filter(Boolean).join(', ') || null].filter(Boolean).join(' · ');
    var priceLine = sold
      ? (b.priceUsd ? 'Listed at ' + usd(b.priceUsd) : 'Sold')
      : usd(b.priceUsd);
    var img = b.image
      ? '<img src="' + esc(b.image) + '" alt="' + esc(b.name) + '" loading="lazy" ' +
        'style="width:100%;height:172px;object-fit:cover;display:block;' + (sold ? 'filter:saturate(.6);' : '') + '">'
      : '<div style="width:100%;height:172px;background:#eef1f4;"></div>';
    var badge = sold
      ? '<span style="position:absolute;top:8px;left:8px;background:' + SOLD + ';color:#fff;font:700 10px/1 Montserrat,sans-serif;' +
        'letter-spacing:.06em;text-transform:uppercase;padding:4px 8px;border-radius:999px;">Sold</span>'
      : '';
    var inner =
      '<div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 1px 3px rgba(15,39,64,.08);height:100%;">' +
      '<div style="position:relative;">' + img + badge + '</div>' +
      '<div style="padding:10px 12px;">' +
      '<div style="font:600 13px/1.3 Montserrat,sans-serif;color:' + NAVY + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(b.name) + '</div>' +
      '<div style="font:700 13px/1.4 Montserrat,sans-serif;color:' + (sold ? '#64748b' : SOLD) + ';">' + esc(priceLine) + '</div>' +
      (meta ? '<div style="font:400 11.5px/1.4 Montserrat,sans-serif;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(meta) + '</div>' : '') +
      '</div></div>';
    // Active cards deep-link into the site's worldwide search for that make,
    // keeping the visitor on fyiyachts.com; sold cards are non-clickable showcase.
    if (!sold && b.make) {
      return '<a href="' + SEARCH + encodeURIComponent(b.make) + '" ' +
        'style="text-decoration:none;display:block;height:100%;">' + inner + '</a>';
    }
    return '<div style="height:100%;">' + inner + '</div>';
  }

  function heading(title, count, subtitle) {
    return '<div style="margin:0 0 16px;">' +
      '<h3 style="font:700 22px/1.2 Montserrat,sans-serif;color:' + NAVY + ';margin:0;display:flex;align-items:baseline;gap:8px;">' +
      esc(title) + '<span style="color:' + GOLD + ';font-weight:700;font-size:16px;">' + count + '</span></h3>' +
      (subtitle ? '<p style="margin:4px 0 0;font:400 13px/1.4 Montserrat,sans-serif;color:#94a3b8;">' + esc(subtitle) + '</p>' : '') +
      '<div style="height:3px;width:52px;background:' + GOLD + ';border-radius:2px;margin-top:10px;"></div>' +
      '</div>';
  }

  function grid(boats, sold) {
    var cards = boats.map(function (b) { return card(b, sold); }).join('');
    return '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px;">' + cards + '</div>';
  }

  function render(el, data) {
    var active = Array.isArray(data.active) ? data.active : [];
    var sold = Array.isArray(data.sold) ? data.sold : [];
    if (!active.length && !sold.length) { el.innerHTML = ''; return; }

    var html = '';
    if (active.length) {
      html += '<section style="margin-bottom:40px;">' +
        heading('Current Listings', active.length, 'Available now — tap any yacht to explore similar boats.') +
        grid(active, false) + '</section>';
    }
    if (sold.length) {
      // Sold sits in its own tinted band so it never blurs into the active
      // listings — it's a track-record showcase, visually distinct.
      html += '<section style="background:#f6f8fa;border:1px solid #eef1f4;border-radius:16px;padding:24px;">' +
        heading('Recently Sold', sold.length, 'A track record of closed deals.') +
        grid(sold, true) + '</section>';
    }

    // Break out of the (often narrow) Divi column this div sits in, so the
    // grid uses the full content width. 96vw avoids the scrollbar overflow
    // that 100vw causes; capped at 1180px and centered.
    el.innerHTML =
      '<div style="width:96vw;max-width:1180px;position:relative;left:50%;transform:translateX(-50%);' +
      'box-sizing:border-box;padding:8px 4px;font-family:Montserrat,system-ui,sans-serif;text-align:left;">' +
      html + '</div>';
  }

  function hydrate(el) {
    var broker = el.getAttribute('data-broker');
    // Fallback: read the page's first <h1> if no name was supplied.
    if (!broker) { var h1 = document.querySelector('h1'); broker = h1 ? h1.textContent.trim() : ''; }
    if (!broker) return;
    el.innerHTML = '<p style="text-align:center;color:#94a3b8;font:400 13px Montserrat,sans-serif;padding:24px;">Loading ' +
      esc(broker.split(' ')[0]) + '’s listings…</p>';
    fetch(origin + '/api/team/data?rep=' + encodeURIComponent(broker))
      .then(function (r) { return r.json(); })
      .then(function (d) { render(el, d); })
      .catch(function () {
        el.innerHTML = '<p style="text-align:center;color:#94a3b8;font:400 13px Montserrat,sans-serif;padding:24px;">Listings are unavailable right now.</p>';
      });
  }

  function init() {
    var nodes = document.querySelectorAll('.fyi-broker-listings, [data-fyi-broker], #fyi-broker-listings');
    for (var i = 0; i < nodes.length; i++) {
      // Support data-fyi-broker as an alias for data-broker.
      if (!nodes[i].getAttribute('data-broker') && nodes[i].getAttribute('data-fyi-broker')) {
        nodes[i].setAttribute('data-broker', nodes[i].getAttribute('data-fyi-broker'));
      }
      hydrate(nodes[i]);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
