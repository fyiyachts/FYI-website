/**
 * Brianna chatbot embed for fyiyachts.com (replaces the Meow Apps / AI Engine
 * widget). Drop this single tag into the WordPress site (footer, or a
 * "Insert Headers and Footers" slot):
 *
 *   <script src="https://<this-app-domain>/brianna-embed.js" defer></script>
 *
 * It injects a floating launcher button and lazily loads the chat UI in an
 * iframe pointed at /brianna on the same origin this script was served from —
 * no hardcoded domain, no cross-origin API calls.
 */
(function () {
  if (window.__briannaEmbedLoaded) return;
  window.__briannaEmbedLoaded = true;

  var script = document.currentScript;
  var origin;
  try {
    origin = new URL(script.src).origin;
  } catch (e) {
    return;
  }

  // --- Phone-number cutover shim --------------------------------------------
  // The Divi Theme Builder header/footer templates on fyiyachts.com hardcode
  // the retired 305-239-4978 line and are not editable over the REST API
  // (and xmlrpc.php is blocked by Cloudflare). Rewrite it — and the briefly
  // used 305-506-6574 — client-side to 305-854-6020 until the templates are
  // fixed in wp-admin (Divi → Theme Builder); then this block can be deleted.
  function fixPhones() {
    var reText = /239([\s.‑-]?)4978|506([\s.‑-]?)6574/g;
    var sub = function (m, sepA, sepB) { return '854' + (sepA || sepB || '') + '6020'; };
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var n;
    while ((n = walker.nextNode())) {
      if (n.nodeValue.indexOf('4978') !== -1 || n.nodeValue.indexOf('6574') !== -1) {
        n.nodeValue = n.nodeValue.replace(reText, sub);
      }
    }
    var links = document.querySelectorAll('a[href^="tel:"]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href');
      var fixed = href
        .replace(/2394978|5066574/g, '8546020')
        .replace(/239([\s.-]?)4978|506([\s.-]?)6574/g, sub);
      if (fixed !== href) links[i].setAttribute('href', fixed);
    }
  }
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fixPhones);
    } else {
      fixPhones();
    }
  } catch (e) { /* never block the launcher */ }

  var NAVY = '#0f2740';
  var GOLD = '#D4AF37';
  var Z = '2147483000';

  // --- "Discover" pill launcher ---------------------------------------------
  // Brianna's headshot + a "Discover" CTA — a personal, search-led launcher
  // rather than a generic chat bubble.
  var AVATAR = origin + '/brianna-avatar.webp';
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Discover yachts with Brianna');
  btn.style.cssText =
    'position:fixed;bottom:24px;right:16px;height:66px;border-radius:33px;' +
    'background:' + NAVY + ';border:none;cursor:pointer;z-index:' + Z + ';' +
    'box-shadow:0 0 0 2px ' + GOLD + ',0 10px 25px rgba(15,39,64,.4);' +
    'display:flex;align-items:center;gap:10px;padding:0 22px 0 6px;transition:transform .15s ease;';
  btn.onmouseenter = function () { btn.style.transform = 'scale(1.05)'; };
  btn.onmouseleave = function () { btn.style.transform = 'scale(1)'; };

  var avatar =
    '<img src="' + AVATAR + '" alt="Brianna" width="54" height="54" ' +
    'style="width:54px;height:54px;border-radius:50%;object-fit:cover;' +
    'background:#fff;box-shadow:0 0 0 2px ' + GOLD + ';flex:none;" />';
  var label =
    '<span style="font:600 14px/1 Montserrat,system-ui,sans-serif;color:#fff;letter-spacing:.02em;">Discover</span>';
  var closeIcon =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="' + GOLD + '" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  var discoverInner = avatar + label;
  btn.innerHTML = discoverInner;

  // --- Teaser bubble ---------------------------------------------------------
  var teaser = document.createElement('div');
  // Sits ABOVE the pill (bottom clears the 66px button + gap) so it never
  // covers Brianna's face; the tail points down toward the launcher.
  teaser.style.cssText =
    'position:fixed;bottom:102px;right:16px;max-width:250px;background:#fff;color:' + NAVY + ';' +
    'font:500 13px/1.45 Montserrat,system-ui,sans-serif;padding:11px 15px;border-radius:14px 14px 4px 14px;' +
    'box-shadow:0 6px 20px rgba(15,39,64,.18);z-index:' + Z + ';cursor:pointer;display:none;';
  teaser.textContent = "Hi, I'm Brianna 👋 Tell me what you're looking for and I'll search our live inventory.";

  // --- Chat iframe (created on first open) -----------------------------------
  var frame = null;
  var open = false;

  function ensureFrame() {
    if (frame) return;
    frame = document.createElement('iframe');
    frame.src = origin + '/brianna';
    frame.title = 'Brianna — FYI Yachts Concierge';
    frame.allow = 'clipboard-write';
    frame.style.cssText =
      'position:fixed;bottom:96px;right:16px;width:380px;height:560px;' +
      'max-width:calc(100vw - 32px);max-height:calc(100dvh - 120px);border:none;border-radius:16px;' +
      'box-shadow:0 20px 50px rgba(15,39,64,.35);z-index:' + Z + ';background:#F0F4F8;display:none;';
    document.body.appendChild(frame);
  }

  function setOpen(next) {
    open = next;
    if (open) {
      ensureFrame();
      frame.style.display = 'block';
      teaser.style.display = 'none';
      btn.style.padding = '0';
      btn.style.width = '66px';
      btn.style.justifyContent = 'center';
      btn.innerHTML = closeIcon;
    } else {
      if (frame) frame.style.display = 'none';
      btn.style.padding = '0 22px 0 6px';
      btn.style.width = '';
      btn.style.justifyContent = '';
      btn.innerHTML = discoverInner;
    }
  }

  btn.addEventListener('click', function () { setOpen(!open); });
  teaser.addEventListener('click', function () { setOpen(true); });

  window.addEventListener('message', function (e) {
    if (e.origin !== origin) return;
    if (e.data && e.data.type === 'brianna:close') setOpen(false);
  });

  function mount() {
    document.body.appendChild(btn);
    document.body.appendChild(teaser);
    setTimeout(function () {
      if (!open) teaser.style.display = 'block';
    }, 5000);
    setTimeout(function () {
      if (!open) teaser.style.display = 'none';
    }, 25000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
