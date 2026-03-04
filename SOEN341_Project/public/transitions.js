(function () {
  function init() {
    var overlay = document.querySelector('.page-transition');
    if (!overlay || typeof gsap === 'undefined') return;

    // Page enter: fade the black overlay out
    gsap.fromTo(overlay,
      { opacity: 1 },
      { opacity: 0, duration: 0.5, ease: 'power2.out', delay: 0.05 }
    );

    // Page exit: fade to black then navigate
    document.querySelectorAll('a[href]').forEach(function (link) {
      var href = link.getAttribute('href');
      if (
        !href ||
        href === '#' ||
        href.charAt(0) === '#' ||
        href.indexOf('mailto:') === 0 ||
        href.indexOf('http') === 0 ||
        href.indexOf('javascript') === 0
      ) return;

      link.addEventListener('click', function (e) {
        if (link.closest('form')) return;
        e.preventDefault();
        var target = href;
        gsap.fromTo(overlay,
          { opacity: 0 },
          {
            opacity: 1,
            duration: 0.35,
            ease: 'power2.in',
            onComplete: function () {
              window.location.href = target;
            }
          }
        );
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
