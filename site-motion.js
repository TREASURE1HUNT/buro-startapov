(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hero = document.querySelector('.academy-hero');
  const mount = hero || document.querySelector('main');
  if (mount && !mount.querySelector('.academy-route-art')) {
    const art = document.createElement('div');
    art.className = 'academy-route-art';
    art.setAttribute('aria-hidden', 'true');
    art.innerHTML = '<svg viewBox="0 0 1000 760" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="route-metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#777" stop-opacity=".05"/><stop offset=".5" stop-color="#999" stop-opacity=".26"/><stop offset="1" stop-color="#555" stop-opacity=".1"/></linearGradient><filter id="route-depth"><feGaussianBlur stdDeviation="7"/></filter></defs><path class="route-shadow" d="M-90 590C110 570 154 380 305 330S478 525 642 477 738 244 930 210 1087 300 1110 348"/><path class="route-branch" d="M-90 590C110 570 154 380 305 330S478 525 642 477 738 244 930 210 1087 300 1110 348"/><path class="route-shadow" d="M305 330C315 210 227 158 191 61M642 477C625 610 727 661 781 767M930 210C888 92 948 38 1014 -40"/><path class="route-branch" d="M305 330C315 210 227 158 191 61M642 477C625 610 727 661 781 767M930 210C888 92 948 38 1014 -40"/><path class="route-branch route-secondary" d="M-48 690C166 663 225 483 385 440S510 600 677 545 822 341 985 326 1076 390 1115 434"/><path class="route-branch route-secondary" d="M385 440C388 327 347 257 371 158M677 545C720 640 672 685 641 760M985 326C1007 233 1078 196 1120 153"/><g class="route-stations"><circle cx="305" cy="330" r="5"/><circle cx="642" cy="477" r="5"/><circle cx="930" cy="210" r="5"/><circle cx="385" cy="440" r="4"/><circle cx="677" cy="545" r="4"/><circle cx="985" cy="326" r="4"/></g></svg>';
    mount.prepend(art);
  }
  const animate = window.anime?.animate;
  let revealObserver = null;
  if (typeof animate === 'function' && !reduceMotion && 'IntersectionObserver' in window) {
    revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      animate(entry.target, { opacity: [0, 1], y: [14, 0], duration: 650, ease: 'outCubic' });
      revealObserver.unobserve(entry.target);
    }), { threshold: .08 });
  }
  window.BuroMotion = { observe(element) { if (!revealObserver) return; element.style.opacity = '0'; revealObserver.observe(element); } };
  if (typeof animate === 'function' && !reduceMotion) {
    const paths = document.querySelectorAll('.route-branch');
    paths.forEach(path => {
      const length = path.getTotalLength();
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;
      animate(path, { strokeDashoffset: [length, 0], duration: 2600, delay: 250, ease: 'inOutSine' });
    });
    animate('.route-stations circle', { opacity: [.2, .8], scale: [.82, 1], transformOrigin: 'center', duration: 2400, delay: 1800, loop: true, alternate: true, ease: 'inOutSine' });
    const revealables = document.querySelectorAll('.academy-hero-copy, .workspace-head, .academy-section-heading, .leader-row, .library-project-card');
    revealables.forEach(element => window.BuroMotion.observe(element));
  }
})();

