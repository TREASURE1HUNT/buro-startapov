(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.className = 'ocean-wave-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });
  const palette = ['#706DFF', '#8281CC', '#7F7F99', '#8281CC', '#706DFF'];
  let width = 0, height = 0, ratio = 1;
  const resize = () => {
    width = window.innerWidth; height = window.innerHeight;
    ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  const pathY = (u, lane, time) => {
    const centralRise = Math.exp(-Math.pow((u - .49) / .16, 2));
    const leftRise = Math.exp(-Math.pow((u - .23) / .095, 2));
    const trough = Math.exp(-Math.pow((u - .37) / .07, 2));
    const rightRise = Math.exp(-Math.pow((u - .91) / .2, 2));
    const drift = Math.sin(u * 8.2 - time * 1.7 + lane * .035) * height * .012;
    return height * (.755 - .065 * u - .19 * centralRise - .065 * leftRise + .028 * trough - .045 * rightRise) +
      (lane - 31.5) * height * .0042 + drift;
  };
  const draw = now => {
    if (!ctx) return;
    if (!width || canvas.width !== Math.round(window.innerWidth * ratio) || canvas.height !== Math.round(window.innerHeight * ratio)) resize();
    ctx.clearRect(0, 0, width, height);
    const time = reduced ? 0 : now * .00022;
    ctx.globalCompositeOperation = 'screen';
    for (let lane = 0; lane < 64; lane++) {
      const edge = Math.abs(lane - 31.5) / 31.5;
      const strength = (1 - edge * .58) * (.28 + ((lane * 17) % 11) / 17);
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, `rgba(112,109,255,${strength * .08})`);
      grad.addColorStop(.22, `rgba(130,129,204,${strength * .52})`);
      grad.addColorStop(.48, `rgba(127,127,153,${strength * .42})`);
      grad.addColorStop(.68, `rgba(130,129,204,${strength * .58})`);
      grad.addColorStop(1, `rgba(112,109,255,${strength * .12})`);
      ctx.beginPath();
      for (let x = 0; x <= width; x += 3) {
        const u = x / width, y = pathY(u, lane, time);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = grad;
      ctx.lineWidth = lane % 7 === 0 ? 1.35 : .82;
      ctx.globalAlpha = lane % 7 === 0 ? .9 : .72;
      ctx.shadowColor = palette[lane % palette.length];
      ctx.shadowBlur = lane % 7 === 0 ? 12 : 4;
      ctx.stroke();
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (!reduced) requestAnimationFrame(draw);
  };
  resize(); window.addEventListener('resize', resize, { passive: true }); requestAnimationFrame(draw);

  const revealTargets = document.querySelectorAll('.academy-hero-copy,.workspace-head,.academy-section-heading,.leader-row,.library-project-card');
  const animate = window.anime?.animate;
  let observer;
  if (typeof animate === 'function' && !reduced && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { animate(entry.target, { opacity: [0, 1], y: [14, 0], duration: 650, ease: 'outCubic' }); observer.unobserve(entry.target); }
    }), { threshold: .08 });
  }
  window.BuroMotion = { observe(element) { if (!observer) return; element.style.opacity = '0'; observer.observe(element); } };
  revealTargets.forEach(element => window.BuroMotion.observe(element));
})();
