(function () {
  const transitionIcon =
    '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" xmlns="http://www.w3.org/2000/svg">' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 14.25c0-5.25 2.25-8.25 6.75-9 0 4.5-1.5 7.5-4.5 9 1.5.75 3.75 1.125 6.75 1.125-1.5 1.5-3.75 2.25-6.75 2.25-1.5 0-2.625-.375-3.375-1.125.75-.75 1.125-1.875 1.125-3.375Z"/>' +
    '</svg>';
  // ── Inject overlay ──────────────────────────────────────────────
  const ov = document.createElement('div');
  ov.id = 'pg-ov';
  ov.innerHTML =
    '<div class="pg-door pg-door-l"><span class="pg-word">Meal</span></div>' +
    '<div class="pg-door pg-door-r"><span class="pg-word"><em>Major</em></span></div>' +
    '<div id="pg-carrot">' + transitionIcon + '</div>';
  document.body.prepend(ov);

  const carrotEl = document.getElementById('pg-carrot');
  let busy = false;

  // ── Enter: open doors if we arrived via an internal transition ──
  if (sessionStorage.getItem('mm-tx')) {
    sessionStorage.removeItem('mm-tx');
    ov.className = 'pg-closed';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        ov.className = 'pg-open';
        setTimeout(function () { ov.className = ''; }, 480);
      });
    });
  }

  // ── Shared exit sequence ────────────────────────────────────────
  function runExit(callback) {
    if (busy) return;
    busy = true;

    ov.className = 'pg-closed';           // doors slam shut (420ms)

    setTimeout(function () {
      carrotEl.style.transition = 'none';
      carrotEl.style.opacity    = '0';
      carrotEl.style.transform  = 'translateX(-160px) rotate(-20deg)';
      void carrotEl.offsetWidth;          // force reflow

      carrotEl.style.transition =
        'transform 0.48s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.15s';
      carrotEl.style.opacity    = '1';
      carrotEl.style.transform  = 'translateX(160px) rotate(20deg)';

      setTimeout(function () {
        sessionStorage.setItem('mm-tx', '1');
        callback();
      }, 260);               // navigate while carrot is mid-flight
    }, 420);
  }

  // ── Intercept all same-origin link clicks ───────────────────────
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('javascript:') ||
        a.target === '_blank') return;

    let dest;
    try { dest = new URL(href, window.location.origin); } catch (_) { return; }
    if (dest.origin !== window.location.origin) return;
    if (busy) return;

    e.preventDefault();
    runExit(function () { window.location.href = href; });
  }, true);   // capture phase so we beat other handlers

  // ── Tab carrot: quick fly, no doors ─────────────────────────────
  window.mmCarrot = function () {
    const c = document.createElement('span');
    c.innerHTML = transitionIcon;
    c.style.cssText =
      'position:fixed;top:46%;left:-80px;color:inherit;' +
      'z-index:9998;pointer-events:none;' +
      'filter:drop-shadow(3px 5px 12px rgba(0,0,0,.45));' +
      'transform:rotate(-20deg);transition:none';
    document.body.appendChild(c);
    void c.offsetWidth;
    c.style.transition = 'left 0.4s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.4s';
    c.style.left      = 'calc(100% + 80px)';
    c.style.transform = 'rotate(20deg)';
    setTimeout(function () { c.remove(); }, 460);
  };
})();
