/* ==========================================================================
   ביגי ספקים — תצוגה מלאה של תמונות וסרטונים
   Shared by the client pages and the server-rendered supplier profile, so it
   has no dependencies of its own (no data.js, no site.js).

   Mark anything clickable with:
     data-lb-type="image" | "video" | "embed" | "link"
     data-lb-src="…"            the full-size image / video file / embed url
     data-lb-poster="…"         optional, for video
     data-lb-caption="…"        optional
   then call Lightbox.attach(container). Items open in DOM order.
   ========================================================================== */
(function(){
  'use strict';

  // The viewer freezes the page with position:fixed while it is open, which
  // makes the browser read the scroll position as 0. Its own scroll
  // restoration would then snap the page to the top when the pushed history
  // entry is popped, undoing the position we put back by hand.
  try{ if('scrollRestoration' in history) history.scrollRestoration = 'manual'; }catch(e){}

  var overlay = null;
  var stage = null;
  var captionEl = null;
  var counterEl = null;
  var prevBtn = null;
  var nextBtn = null;
  var items = [];
  var index = 0;
  var openerEl = null;
  var scrollY = 0;
  var pushedHistory = false;

  function build(){
    if(overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'lb-overlay';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'תצוגה מלאה');
    overlay.innerHTML =
      '<button type="button" class="lb-close" aria-label="סגירת התצוגה">✕</button>' +
      '<button type="button" class="lb-nav lb-prev" aria-label="הקודם">›</button>' +
      '<button type="button" class="lb-nav lb-next" aria-label="הבא">‹</button>' +
      '<div class="lb-stage"></div>' +
      '<div class="lb-bar"><span class="lb-caption"></span><span class="lb-counter"></span></div>';
    document.body.appendChild(overlay);

    stage = overlay.querySelector('.lb-stage');
    captionEl = overlay.querySelector('.lb-caption');
    counterEl = overlay.querySelector('.lb-counter');
    prevBtn = overlay.querySelector('.lb-prev');
    nextBtn = overlay.querySelector('.lb-next');

    overlay.querySelector('.lb-close').addEventListener('click', close);
    prevBtn.addEventListener('click', function(){ step(-1); });
    nextBtn.addEventListener('click', function(){ step(1); });
    // Only a click on the backdrop itself closes — not one on the media
    overlay.addEventListener('click', function(e){ if(e.target === overlay || e.target === stage) close(); });

    document.addEventListener('keydown', function(e){
      if(overlay.hidden) return;
      if(e.key === 'Escape'){ e.preventDefault(); close(); }
      else if(e.key === 'ArrowRight') step(-1);   // RTL: right arrow goes back
      else if(e.key === 'ArrowLeft') step(1);
      else if(e.key === 'Tab') trapFocus(e);
    });

    addSwipe();
    // The phone's back button closes the view instead of leaving the page
    window.addEventListener('popstate', function(){
      if(!overlay.hidden){ pushedHistory = false; close(); }
    });
  }

  function trapFocus(e){
    var focusable = overlay.querySelectorAll('button:not([hidden]), video, iframe, a[href]');
    if(!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  }

  function addSwipe(){
    var startX = 0, startY = 0, tracking = false;
    stage.addEventListener('touchstart', function(e){
      if(e.touches.length !== 1) return;
      tracking = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    stage.addEventListener('touchend', function(e){
      if(!tracking) return;
      tracking = false;
      var touch = e.changedTouches[0];
      var dx = touch.clientX - startX;
      var dy = touch.clientY - startY;
      // Horizontal only, so scrolling a tall image never flips the slide
      if(Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx > 0 ? -1 : 1);
    }, { passive: true });
  }

  function render(){
    var item = items[index];
    stage.replaceChildren();

    if(item.type === 'video'){
      var video = document.createElement('video');
      video.src = item.src;
      if(item.poster) video.poster = item.poster;
      video.controls = true;
      video.playsInline = true;          // iOS: play in place, not full-screen takeover
      video.setAttribute('playsinline', '');
      video.preload = 'metadata';
      video.className = 'lb-media';
      stage.appendChild(video);
    } else if(item.type === 'embed'){
      var frame = document.createElement('iframe');
      frame.src = item.src;
      frame.className = 'lb-media lb-embed';
      frame.allow = 'accelerometer; clipboard-write; encrypted-media; picture-in-picture; fullscreen';
      frame.setAttribute('allowfullscreen', '');
      frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      frame.title = item.caption || 'סרטון';
      stage.appendChild(frame);
    } else {
      var img = document.createElement('img');
      img.src = item.src;
      img.alt = item.caption || '';
      img.className = 'lb-media';
      stage.appendChild(img);
    }

    captionEl.textContent = item.caption || '';
    counterEl.textContent = items.length > 1 ? (index + 1) + ' / ' + items.length : '';
    prevBtn.hidden = items.length < 2;
    nextBtn.hidden = items.length < 2;
  }

  function step(delta){
    if(items.length < 2) return;
    index = (index + delta + items.length) % items.length;
    render();
  }

  function open(list, startAt, opener){
    if(!list || !list.length) return;
    build();
    items = list;
    index = Math.min(Math.max(startAt || 0, 0), list.length - 1);
    openerEl = opener || null;

    scrollY = window.scrollY;
    document.body.classList.add('lb-open');
    document.body.style.top = '-' + scrollY + 'px';
    overlay.hidden = false;
    render();
    overlay.querySelector('.lb-close').focus();

    try{ history.pushState({ lightbox: true }, ''); pushedHistory = true; }catch(e){ pushedHistory = false; }
  }

  function close(){
    if(!overlay || overlay.hidden) return;
    overlay.hidden = true;
    stage.replaceChildren();                 // stops playback
    document.body.classList.remove('lb-open');
    document.body.style.top = '';
    window.scrollTo(0, scrollY);
    if(openerEl && document.contains(openerEl)) openerEl.focus();
    openerEl = null;
    if(pushedHistory){ pushedHistory = false; try{ history.back(); }catch(e){} }
  }

  // Collects the tiles inside `container` and makes each one open the viewer.
  function attach(container){
    var root = container || document;
    var tiles = Array.prototype.slice.call(root.querySelectorAll('[data-lb-src]'));
    if(!tiles.length) return;

    var list = tiles.map(function(el){
      return {
        type: el.getAttribute('data-lb-type') || 'image',
        src: el.getAttribute('data-lb-src'),
        poster: el.getAttribute('data-lb-poster') || '',
        caption: el.getAttribute('data-lb-caption') || '',
      };
    });

    tiles.forEach(function(el, i){
      if(el.dataset.lbBound) return;
      el.dataset.lbBound = '1';
      if(!el.hasAttribute('tabindex') && el.tagName !== 'BUTTON' && el.tagName !== 'A') el.tabIndex = 0;
      if(!el.hasAttribute('role') && el.tagName !== 'BUTTON' && el.tagName !== 'A') el.setAttribute('role', 'button');
      el.classList.add('lb-tile');
      el.addEventListener('click', function(e){
        e.preventDefault();
        open(list, i, el);
      });
      el.addEventListener('keydown', function(e){
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); open(list, i, el); }
      });
    });
  }

  window.Lightbox = { attach: attach, open: open, close: close };
})();

