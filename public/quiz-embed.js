/**
 * "Find Your Yacht Match" embed for fyiyachts.com — the homepage entry to the
 * Yacht Match Platform quiz (served at /quiz on this app's domain).
 *
 * Install (WPCode footer, same as brianna-embed.js):
 *   <script src="https://<this-app-domain>/quiz-embed.js" defer></script>
 *
 * Placement:
 *   - If the page contains  <div id="fyi-yacht-match"></div>  the full banner
 *     renders there (drop that div wherever it belongs in the page builder).
 *   - Otherwise a slim dismissible ribbon appears at the top of the page.
 *
 * The CTA opens the quiz in a new tab on this app's own domain, so the
 * portal-login step at the end can set its session cookie first-party.
 */
(function () {
  if (window.__fyiQuizEmbedLoaded) return;
  window.__fyiQuizEmbedLoaded = true;

  var script = document.currentScript;
  var origin;
  try { origin = new URL(script.src).origin; } catch (e) { return; }

  var NAVY = '#0f2740';
  var GOLD = '#D4AF37';
  var QUIZ_URL = origin + '/quiz';
  var DISMISS_KEY = 'fyi-quiz-ribbon-dismissed';

  var mount = document.getElementById('fyi-yacht-match');

  if (mount) {
    // Full banner — campaign look, gold CTA.
    mount.innerHTML =
      '<div style="background:linear-gradient(115deg,' + NAVY + ' 0%,#17395c 100%);border-radius:18px;padding:28px 24px;' +
      'font-family:Montserrat,system-ui,sans-serif;text-align:center;box-shadow:0 0 0 2px ' + GOLD + '44,0 18px 45px rgba(15,39,64,.35);">' +
      '<p style="margin:0;color:' + GOLD + ';font:700 11px/1 Montserrat,sans-serif;letter-spacing:.3em;text-transform:uppercase;">FYI Yachts</p>' +
      '<h2 style="margin:10px 0 6px;color:#fff;font:800 26px/1.2 Montserrat,sans-serif;">Your next yacht is already in Miami</h2>' +
      '<p style="margin:0 auto;max-width:560px;color:rgba(255,255,255,.75);font:400 14.5px/1.6 Montserrat,sans-serif;">' +
      'Our <strong style="color:#fff">Yacht Match Platform</strong> pairs motivated buyers with sellers — including private ' +
      'off-market opportunities that are never publicly listed. Rate a few yachts, get matched, and unlock your own portal with market alerts.</p>' +
      '<a href="' + QUIZ_URL + '" target="_blank" rel="noopener" style="display:inline-block;margin-top:18px;background:' + GOLD + ';color:' + NAVY + ';' +
      'font:700 15px/1 Montserrat,sans-serif;padding:16px 34px;border-radius:12px;text-decoration:none;box-shadow:0 10px 28px rgba(212,175,55,.35);">' +
      'Find my yacht match &rarr;</a>' +
      '<p style="margin:10px 0 0;color:rgba(255,255,255,.4);font:400 11.5px/1 Montserrat,sans-serif;">Takes about a minute &middot; no obligation</p>' +
      '</div>';
    return;
  }

  // Fallback: slim dismissible ribbon pinned to the top of the page.
  try { if (localStorage.getItem(DISMISS_KEY)) return; } catch (e) { /* private mode */ }

  var bar = document.createElement('div');
  bar.style.cssText =
    'position:sticky;top:0;z-index:2147482000;background:' + NAVY + ';' +
    'display:flex;align-items:center;justify-content:center;gap:14px;padding:10px 44px 10px 16px;' +
    'font-family:Montserrat,system-ui,sans-serif;box-shadow:0 2px 12px rgba(0,0,0,.25);';
  bar.innerHTML =
    '<span style="color:#fff;font:600 13px/1.4 Montserrat,sans-serif;">' +
    '<span style="color:' + GOLD + ';font-weight:800;">New:</span> Find your yacht match in under a minute</span>' +
    '<a href="' + QUIZ_URL + '" target="_blank" rel="noopener" style="flex:none;background:' + GOLD + ';color:' + NAVY + ';' +
    'font:700 12.5px/1 Montserrat,sans-serif;padding:9px 18px;border-radius:999px;text-decoration:none;">Take the quiz</a>';

  var closeBtn = document.createElement('button');
  closeBtn.setAttribute('aria-label', 'Dismiss');
  closeBtn.style.cssText =
    'position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;' +
    'color:rgba(255,255,255,.6);font:400 18px/1 sans-serif;padding:6px;';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = function () {
    bar.remove();
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) { /* ignore */ }
  };
  bar.appendChild(closeBtn);
  document.body.insertBefore(bar, document.body.firstChild);
})();
