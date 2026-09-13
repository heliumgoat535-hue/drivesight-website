/* Opinly instrumentation for phonedashcam.com.
 * Loaded after the pixel (static.opinly.ai/p.js). The pixel already captures
 * page views, clicks, form submits, and identifies visitors who type an email
 * into a recognisable email field. This adds the site's own signal:
 *   - play_store_click  every Google Play link (the site's primary conversion)
 *   - generate_lead     contact form submission (standard conversion event)
 *   - blog_post_read    reader reached the end of a blog post body
 * and exposes window.driveSightAnalytics for identify/track/purchase calls
 * from any page. Everything is queued until the pixel reports ready.
 */
(function () {
  'use strict';
  var queue = [];
  var ready = false;

  function flush() {
    ready = true;
    var q = queue; queue = [];
    q.forEach(function (fn) { try { fn(window.opinly); } catch (e) { /* never break the page */ } });
  }
  function whenReady(fn) {
    if (ready && window.opinly) { try { fn(window.opinly); } catch (e) { /* noop */ } }
    else queue.push(fn);
  }
  if (window.opinly) flush();
  else window.addEventListener('opinly:ready', flush, { once: true });

  // Public helper for pages that know more than this script does.
  window.driveSightAnalytics = {
    // Call after login/signup or wherever an email is known. First identify wins.
    identify: function (email, userId) {
      if (!email) return;
      whenReady(function (o) { o.identify(userId ? { email: email, userId: userId } : { email: email }); });
    },
    track: function (event, properties, opts) {
      whenReady(function (o) { o.track(event, properties || {}, opts || {}); });
    },
    // Browser-side purchase; pair with the server-side call using the same orderId
    // (POST /api/opinly/purchase) so the two merge into one event.
    purchase: function (orderId, value, currency) {
      if (!orderId || typeof value !== 'number') return;
      whenReady(function (o) {
        o.track('purchase', { value: value, currency: currency || 'USD', transaction_id: orderId }, { externalEventId: String(orderId) });
      });
    },
    anonId: function () { return window.opinly ? window.opinly.anonId : null; },
  };

  function pageProps() {
    var article = document.querySelector('article[data-opinly-post]');
    var props = { page: location.pathname };
    if (article) {
      props.post = article.getAttribute('data-opinly-post');
      var cat = article.getAttribute('data-opinly-category');
      if (cat) props.category = cat;
    }
    return props;
  }

  // Google Play links = the site's primary conversion.
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('a[href*="play.google.com"]') : null;
    if (!el) return;
    var props = pageProps();
    props.href = el.href;
    props.text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    props.placement = el.className ? String(el.className).slice(0, 60) : '';
    whenReady(function (o) { o.track('play_store_click', props); });
  }, true);

  // Contact form → generate_lead. The pixel identifies the visitor from the
  // email field on its own; this names the conversion.
  var contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', function () {
      var subject = contactForm.elements.subject ? String(contactForm.elements.subject.value || '').slice(0, 80) : '';
      whenReady(function (o) { o.track('generate_lead', { form: 'contact', subject: subject, page: location.pathname }); });
    });
  }

  // Blog engagement: reader reached the end of the post body.
  var body = document.querySelector('article[data-opinly-post] .post-body');
  if (body && 'IntersectionObserver' in window) {
    var fired = false;
    var sentinel = document.createElement('span');
    sentinel.setAttribute('aria-hidden', 'true');
    body.appendChild(sentinel);
    var io = new IntersectionObserver(function (entries) {
      if (fired || !entries.some(function (en) { return en.isIntersecting; })) return;
      fired = true;
      io.disconnect();
      whenReady(function (o) { o.track('blog_post_read', pageProps()); });
    });
    io.observe(sentinel);
  }
})();
