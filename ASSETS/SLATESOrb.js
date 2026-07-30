// SLATESOrb — ported from ROQ's RoqOrb.js (React Native) to vanilla DOM/WAAPI.
// Same particle field, breathing, rotation, and shimmer as the ROQ app mark —
// no glow/halo layer, fully transparent, just the living particles themselves.
(function () {
  const REDUCE_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function buildParticles(radius, count) {
    const list = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.55) * radius;
      list.push({
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
        size: Math.random() * 1.6 + 1,
        startOpacity: 0.68 + Math.random() * 0.32,
        speed: 900 + Math.random() * 1600,
        minOpacity: 0.62,
        maxOpacity: 1,
      });
    }
    return list;
  }

  function shimmerStep(el, p) {
    const target1 = p.minOpacity + Math.random() * (p.maxOpacity - p.minOpacity);
    const up = el.animate(
      [{ opacity: el.style.opacity || p.startOpacity }, { opacity: target1 }],
      { duration: p.speed, easing: 'ease-in-out', fill: 'forwards' }
    );
    up.onfinish = () => {
      el.style.opacity = target1;
      const target2 = p.minOpacity * Math.random();
      const down = el.animate(
        [{ opacity: target1 }, { opacity: target2 }],
        { duration: p.speed * 0.7, easing: 'ease-in-out', fill: 'forwards' }
      );
      down.onfinish = () => {
        el.style.opacity = target2;
        shimmerStep(el, p);
      };
    };
  }

  function createOrb(container, opts) {
    const size = (opts && opts.size) || 56;
    const color = (opts && opts.color) || '#232120';
    const radius = size * 0.46;
    const center = size / 2;
    const count = (opts && opts.particleCount) || Math.round(55 + size * 2.3);

    container.innerHTML = '';
    container.style.position = 'relative';
    container.style.width = size + 'px';
    container.style.height = size + 'px';
    container.style.background = 'transparent';

    const rotator = document.createElement('div');
    rotator.className = 'orb-rotator';
    rotator.style.cssText = 'position:absolute;inset:0;';
    container.appendChild(rotator);

    const breather = document.createElement('div');
    breather.className = 'orb-breather';
    breather.style.cssText = 'position:absolute;inset:0;';
    rotator.appendChild(breather);

    const particles = buildParticles(radius, count);
    particles.forEach((p) => {
      const el = document.createElement('div');
      el.style.cssText =
        'position:absolute;' +
        'left:' + (center + p.x - p.size / 2) + 'px;' +
        'top:' + (center + p.y - p.size / 2) + 'px;' +
        'width:' + p.size + 'px;height:' + p.size + 'px;border-radius:' + p.size + 'px;' +
        'background:' + color + ';opacity:' + p.startOpacity + ';';
      breather.appendChild(el);
      if (!REDUCE_MOTION) shimmerStep(el, p);
    });

    if (REDUCE_MOTION) {
      rotator.style.animation = 'none';
      breather.style.animation = 'none';
    }
  }

  window.SLATESOrb = { create: createOrb };
})();
