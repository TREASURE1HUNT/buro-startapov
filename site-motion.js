(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hero = document.querySelector('.academy-hero');
  const mount = hero || document.body;
  if (!mount.querySelector('.academy-route-art')) {
    const art = document.createElement('div');
    art.className = 'academy-route-art';
    art.setAttribute('aria-hidden', 'true');
    art.innerHTML = `<svg viewBox="0 0 1200 850" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="route-metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#777" stop-opacity=".08"/><stop offset=".48" stop-color="#c2c2c5" stop-opacity=".5"/><stop offset="1" stop-color="#555" stop-opacity=".16"/></linearGradient>
        <linearGradient id="route-edge" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#d3d3d6" stop-opacity=".55"/><stop offset="1" stop-color="#65656a" stop-opacity=".05"/></linearGradient>
        <filter id="route-depth"><feGaussianBlur stdDeviation="5"/></filter>
      </defs>
      <g class="route-map">
        <path class="route-shadow" d="M-100 675C92 628 158 449 318 419S508 601 683 545 790 288 1003 270 1160 345 1290 410"/>
        <path class="route-glow" d="M-100 675C92 628 158 449 318 419S508 601 683 545 790 288 1003 270 1160 345 1290 410"/>
        <path id="route-main-path" class="route-branch" d="M-100 675C92 628 158 449 318 419S508 601 683 545 790 288 1003 270 1160 345 1290 410"/>
        <path class="route-shadow" d="M318 419C350 283 263 194 208 54M318 419C257 492 155 524 70 502M683 545C621 679 732 753 811 900M683 545C763 620 887 659 1026 620M1003 270C948 156 1011 66 1095 -48M1003 270C1094 215 1170 161 1255 98"/>
        <path class="route-branch route-feeder" d="M318 419C350 283 263 194 208 54M318 419C257 492 155 524 70 502M683 545C621 679 732 753 811 900M683 545C763 620 887 659 1026 620M1003 270C948 156 1011 66 1095 -48M1003 270C1094 215 1170 161 1255 98"/>
        <path class="route-secondary" d="M-85 755C112 706 215 546 368 531S544 703 709 634 832 386 1039 367 1190 449 1300 502"/>
        <path class="route-secondary route-feeder" d="M368 531C379 421 332 336 383 222M709 634C822 733 913 781 1002 887M1039 367C1072 293 1142 259 1248 222"/>
        <path class="route-fine" d="M-40 594C119 573 193 355 367 350S522 496 666 468 817 206 962 193 1110 250 1246 315M367 350C387 260 450 181 491 93M666 468C699 375 674 315 704 209M962 193C937 91 895 35 865 -28"/>
        <g class="route-stations"><circle cx="318" cy="419" r="7"/><circle cx="683" cy="545" r="7"/><circle cx="1003" cy="270" r="7"/><circle cx="368" cy="531" r="5"/><circle cx="709" cy="634" r="5"/><circle cx="1039" cy="367" r="5"/><circle cx="666" cy="468" r="4"/><circle cx="962" cy="193" r="4"/></g>
        <circle class="route-runner" r="7" cx="0" cy="0"/>
      </g>
    </svg>`;
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
  if (typeof animate !== 'function' || reduceMotion) return;
  const paths = document.querySelectorAll('.route-branch, .route-glow, .route-feeder, .route-fine');
  paths.forEach((path, index) => {
    if (path.classList.contains('route-secondary')) return;
    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;
    animate(path, { strokeDashoffset: [length, 0], duration: 1900 + index * 330, delay: 120 + index * 100, ease: 'inOutSine' });
  });
  animate('.route-secondary', { strokeDashoffset: [0, -180], duration: 9000, delay: 1700, loop: true, ease: 'linear' });
  animate('.route-stations circle', { opacity: [.22, .85], scale: [.82, 1.2], transformOrigin: 'center', duration: 2100, delay: 800, loop: true, alternate: true, ease: 'inOutSine' });
  const pathMotion = window.anime?.svg?.createMotionPath;
  const runner = document.querySelector('.route-runner');
  if (runner && typeof pathMotion === 'function') animate(runner, { ease: 'linear', duration: 12500, loop: true, ...pathMotion('#route-main-path') });
  const routeSvg = document.querySelector('.academy-route-art svg');
  if (routeSvg && hero && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    hero.addEventListener('pointermove', event => {
      const bounds = hero.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - .5;
      const y = (event.clientY - bounds.top) / bounds.height - .5;
      animate(routeSvg, { rotateY: `${-17 + x * 5}deg`, rotateX: `${7 - y * 4}deg`, duration: 900, ease: 'outCubic' });
    }, { passive: true });
  }
  document.querySelectorAll('.academy-hero-copy, .workspace-head, .academy-section-heading, .leader-row, .library-project-card').forEach(element => window.BuroMotion.observe(element));
})();
