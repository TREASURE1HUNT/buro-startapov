(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.className = 'ocean-wave-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });
  let width = 0, height = 0, ratio = 1;
  let samples = [], surfaceGradient, stripeGradient, frame = 0;
  const buildWaveCache = () => {
    samples = [];
    for (let x = 0; x <= width; x += 3) {
      const u = x / width;
      const centralRise = Math.exp(-Math.pow((u - .49) / .17, 2));
      const leftRise = Math.exp(-Math.pow((u - .23) / .095, 2));
      const trough = Math.exp(-Math.pow((u - .37) / .07, 2));
      const rightRise = Math.exp(-Math.pow((u - .91) / .2, 2));
      samples.push({ x, u, sinU:Math.sin(u * 8.2), cosU:Math.cos(u * 8.2),
        baseY: height * (.755 - .065 * u - .22 * centralRise - .065 * leftRise + .028 * trough - .055 * rightRise) });
    }
    surfaceGradient = ctx.createLinearGradient(0, 0, width, 0);
    surfaceGradient.addColorStop(0, 'rgba(112,109,255,.10)');
    surfaceGradient.addColorStop(.22, 'rgba(130,129,204,.21)');
    surfaceGradient.addColorStop(.48, 'rgba(127,127,153,.16)');
    surfaceGradient.addColorStop(.70, 'rgba(130,129,204,.23)');
    surfaceGradient.addColorStop(1, 'rgba(112,109,255,.09)');
    stripeGradient = ctx.createLinearGradient(0, 0, width, 0);
    stripeGradient.addColorStop(0, 'rgba(112,109,255,.20)');
    stripeGradient.addColorStop(.22, 'rgba(130,129,204,.38)');
    stripeGradient.addColorStop(.48, 'rgba(127,127,153,.31)');
    stripeGradient.addColorStop(.70, 'rgba(130,129,204,.40)');
    stripeGradient.addColorStop(1, 'rgba(112,109,255,.20)');
  };
  const resize = () => {
    width = window.innerWidth; height = window.innerHeight;
    ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (ctx && width) buildWaveCache();
    if (reduced && width) {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    }
  };
  const draw = now => {
    if (!ctx) return;
    if (!width || canvas.width !== Math.round(window.innerWidth * ratio) || canvas.height !== Math.round(window.innerHeight * ratio)) resize();
    ctx.clearRect(0, 0, width, height);
    const time = reduced ? 0 : now * .00022;
    ctx.globalCompositeOperation = 'screen';
    const phase = 39.5 * .035 - time * 1.7;
    const phaseSin = Math.sin(phase), phaseCos = Math.cos(phase);
    const halfDepth = height * .25675;
    ctx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      const drift = (sample.sinU * phaseCos + sample.cosU * phaseSin) * height * .02;
      const y = sample.baseY + drift - halfDepth;
      if (i === 0) ctx.moveTo(sample.x, y); else ctx.lineTo(sample.x, y);
    }
    for (let i = samples.length - 1; i >= 0; i--) {
      const sample = samples[i];
      const drift = (sample.sinU * phaseCos + sample.cosU * phaseSin) * height * .02;
      ctx.lineTo(sample.x, sample.baseY + drift + halfDepth);
    }
    ctx.closePath();
    ctx.fillStyle = surfaceGradient;
    ctx.shadowColor = 'rgba(112,109,255,.28)';
    ctx.shadowBlur = 26;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(130,129,204,.24)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = stripeGradient;
    for (let stripe = 0; stripe < 80; stripe++) {
      const offset = ((stripe / 79) * 2 - 1) * halfDepth;
      ctx.beginPath();
      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        const drift = (sample.sinU * phaseCos + sample.cosU * phaseSin) * height * .02;
        const y = sample.baseY + drift + offset;
        if (i === 0) ctx.moveTo(sample.x, y); else ctx.lineTo(sample.x, y);
      }
      ctx.globalAlpha = stripe % 8 === 0 ? .78 : .48;
      ctx.lineWidth = stripe % 8 === 0 ? 1.15 : .8;
      ctx.stroke();
    }
    ctx.restore();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (!reduced && !document.hidden) frame = requestAnimationFrame(draw);
  };
  resize(); window.addEventListener('resize', resize, { passive: true });
  const pauseWave = () => { if (frame) cancelAnimationFrame(frame); frame = 0; };
  const resumeWave = () => { if (!reduced && !document.hidden && !frame) frame = requestAnimationFrame(draw); };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseWave();
    else resumeWave();
  });
  resumeWave();

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
