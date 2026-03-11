(function () {
  "use strict";

  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");
  const root = document.documentElement;

  const presetButtons = Array.from(document.querySelectorAll(".preset"));
  const burstButton = document.getElementById("burst-button");
  const modeValue = document.getElementById("mode-value");
  const particleValue = document.getElementById("particle-value");
  const tempoValue = document.getElementById("tempo-value");

  const presets = {
    aurora: {
      label: "Aurora",
      speed: 0.72,
      drift: 0.92,
      waveLift: 1.06,
      bgTop: "#040816",
      bgMid: "#0c1735",
      bgBottom: "#180c2c",
      accent: "#6cf5ff",
      accentStrong: "#7affc2",
      accentWarm: "#ff7fd7",
      haze: "rgba(108, 245, 255, 0.12)",
      glow: "rgba(255, 127, 215, 0.16)",
      ribbons: [
        "rgba(92, 252, 255, 0.14)",
        "rgba(121, 255, 194, 0.16)",
        "rgba(255, 127, 215, 0.14)",
      ],
      grid: "rgba(108, 245, 255, 0.2)",
      trails: [
        "rgba(108, 245, 255, 0.76)",
        "rgba(122, 255, 194, 0.82)",
        "rgba(255, 127, 215, 0.74)",
      ],
      pulse: "rgba(255, 255, 255, 0.2)",
    },
    ember: {
      label: "Ember",
      speed: 0.95,
      drift: 1.1,
      waveLift: 1.24,
      bgTop: "#17070d",
      bgMid: "#331022",
      bgBottom: "#071525",
      accent: "#ffb86c",
      accentStrong: "#ff6a88",
      accentWarm: "#ffe180",
      haze: "rgba(255, 184, 108, 0.12)",
      glow: "rgba(255, 106, 136, 0.16)",
      ribbons: [
        "rgba(255, 184, 108, 0.16)",
        "rgba(255, 106, 136, 0.16)",
        "rgba(255, 225, 128, 0.12)",
      ],
      grid: "rgba(255, 184, 108, 0.2)",
      trails: [
        "rgba(255, 184, 108, 0.82)",
        "rgba(255, 106, 136, 0.78)",
        "rgba(255, 225, 128, 0.76)",
      ],
      pulse: "rgba(255, 225, 128, 0.22)",
    },
    lagoon: {
      label: "Lagoon",
      speed: 0.62,
      drift: 0.84,
      waveLift: 0.96,
      bgTop: "#04111b",
      bgMid: "#0c2b35",
      bgBottom: "#10213f",
      accent: "#68f1ff",
      accentStrong: "#7afff0",
      accentWarm: "#5ea0ff",
      haze: "rgba(104, 241, 255, 0.12)",
      glow: "rgba(94, 160, 255, 0.16)",
      ribbons: [
        "rgba(104, 241, 255, 0.14)",
        "rgba(122, 255, 240, 0.14)",
        "rgba(94, 160, 255, 0.14)",
      ],
      grid: "rgba(104, 241, 255, 0.2)",
      trails: [
        "rgba(104, 241, 255, 0.84)",
        "rgba(122, 255, 240, 0.76)",
        "rgba(94, 160, 255, 0.78)",
      ],
      pulse: "rgba(255, 255, 255, 0.18)",
    },
  };

  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    time: 0,
    lastFrame: performance.now(),
    preset: "aurora",
    particles: [],
    pulses: [],
    stars: [],
    pointer: {
      x: 0,
      y: 0,
      active: false,
      intensity: 0,
    },
    needsClear: true,
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function particleTargetCount() {
    return Math.round(clamp((state.width * state.height) / 7200, 90, 260));
  }

  function updatePaletteVars() {
    const preset = presets[state.preset];
    root.style.setProperty("--bg-top", preset.bgTop);
    root.style.setProperty("--bg-mid", preset.bgMid);
    root.style.setProperty("--bg-bottom", preset.bgBottom);
    root.style.setProperty("--accent", preset.accent);
    root.style.setProperty("--accent-strong", preset.accentStrong);
    root.style.setProperty("--accent-warm", preset.accentWarm);
  }

  function createStars() {
    const count = Math.round(clamp(state.width / 14, 50, 120));
    state.stars = [];
    for (let index = 0; index < count; index += 1) {
      state.stars.push({
        x: Math.random() * state.width,
        y: Math.random() * state.height * 0.72,
        radius: rand(0.4, 2.2),
        alpha: rand(0.1, 0.55),
        twinkle: rand(0.6, 2.4),
      });
    }
  }

  function resetParticle(particle, seeded) {
    const edge = Math.floor(rand(0, 4));
    if (seeded) {
      particle.x = Math.random() * state.width;
      particle.y = Math.random() * state.height;
    } else if (edge === 0) {
      particle.x = -40;
      particle.y = Math.random() * state.height;
    } else if (edge === 1) {
      particle.x = state.width + 40;
      particle.y = Math.random() * state.height;
    } else if (edge === 2) {
      particle.x = Math.random() * state.width;
      particle.y = -40;
    } else {
      particle.x = Math.random() * state.width;
      particle.y = state.height + 40;
    }

    particle.prevX = particle.x;
    particle.prevY = particle.y;
    particle.vx = rand(-0.4, 0.4);
    particle.vy = rand(-0.4, 0.4);
    particle.size = rand(7, 18);
    particle.life = rand(220, 620);
    particle.tint = Math.floor(rand(0, presets[state.preset].trails.length));
    particle.jitter = rand(0.5, 2.4);
    particle.flapOffset = rand(0, Math.PI * 2);
    particle.bank = rand(-0.18, 0.18);
  }

  function rebuildParticles() {
    const nextCount = particleTargetCount();
    state.particles = [];
    for (let index = 0; index < nextCount; index += 1) {
      const particle = {};
      resetParticle(particle, true);
      state.particles.push(particle);
    }
    particleValue.textContent = nextCount.toLocaleString("en-US");
  }

  function resize() {
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    canvas.style.width = state.width + "px";
    canvas.style.height = state.height + "px";
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    createStars();
    rebuildParticles();
    state.pointer.x = state.width * 0.5;
    state.pointer.y = state.height * 0.5;
    state.needsClear = true;
  }

  function spawnPulse(x, y, strength) {
    state.pulses.push({
      x,
      y,
      age: 0,
      life: lerp(0.8, 1.55, strength),
      radius: lerp(80, 180, strength),
      strength: lerp(0.7, 1.4, strength),
    });

    if (state.pulses.length > 8) {
      state.pulses.shift();
    }
  }

  function updatePulses(dt) {
    state.pulses = state.pulses.filter(function (pulse) {
      pulse.age += dt;
      return pulse.age < pulse.life;
    });
  }

  function fieldAt(x, y, time) {
    const preset = presets[state.preset];
    const nx = x / state.width - 0.5;
    const ny = y / state.height - 0.5;
    const radial = Math.hypot(nx, ny) + 0.0001;

    const ribbonWave = Math.sin(nx * 7.2 - time * preset.speed + ny * 5.1);
    const crossWave = Math.cos(ny * 10.8 + time * (preset.speed * 1.18) - nx * 3.8);
    const spin = Math.sin(radial * 16 - time * (preset.speed * 1.4));

    let fx = crossWave * 0.46 + Math.cos((ny + ribbonWave * 0.18) * 8.5 - time * 0.46) * 0.32;
    let fy = -ribbonWave * 0.52 + Math.sin((nx - crossWave * 0.12) * 9.8 + time * 0.5) * 0.24;

    fx += (-ny / radial) * spin * 0.24;
    fy += (nx / radial) * spin * 0.22;

    const pointerDx = x - state.pointer.x;
    const pointerDy = y - state.pointer.y;
    const pointerDistance = Math.hypot(pointerDx, pointerDy) + 0.001;
    const pointerRange = Math.min(state.width, state.height) * 0.38;
    const pointerWeight = clamp(1 - pointerDistance / pointerRange, 0, 1) * state.pointer.intensity;
    if (pointerWeight > 0) {
      fx += (-pointerDy / pointerDistance) * pointerWeight * 2.2;
      fy += (pointerDx / pointerDistance) * pointerWeight * 2;
    }

    for (const pulse of state.pulses) {
      const dx = x - pulse.x;
      const dy = y - pulse.y;
      const distance = Math.hypot(dx, dy) + 0.001;
      const ring = distance - pulse.age * 220;
      const influence = Math.exp(-(ring * ring) / (2 * pulse.radius * pulse.radius));
      fx += (dx / distance) * influence * pulse.strength * 1.7;
      fy += (dy / distance) * influence * pulse.strength * 1.7;
    }

    return { x: fx, y: fy };
  }

  function updateParticles(dt) {
    const preset = presets[state.preset];
    state.pointer.intensity = lerp(
      state.pointer.intensity,
      state.pointer.active ? 1 : 0.18,
      dt * 2.4
    );

    for (const particle of state.particles) {
      particle.prevX = particle.x;
      particle.prevY = particle.y;

      const field = fieldAt(particle.x, particle.y, state.time * 0.9 + particle.jitter);
      const force = (54 + particle.size * 10) * preset.drift;

      particle.vx = particle.vx * 0.94 + field.x * dt * force;
      particle.vy = particle.vy * 0.94 + field.y * dt * force;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life -= dt * 60;

      if (
        particle.life <= 0 ||
        particle.x < -120 ||
        particle.x > state.width + 120 ||
        particle.y < -120 ||
        particle.y > state.height + 120
      ) {
        resetParticle(particle, false);
      }
    }
  }

  function drawBackdrop(time) {
    const preset = presets[state.preset];

    if (state.needsClear) {
      ctx.clearRect(0, 0, state.width, state.height);
      state.needsClear = false;
    }

    const wash = ctx.createLinearGradient(0, 0, 0, state.height);
    wash.addColorStop(0, preset.bgTop + "2a");
    wash.addColorStop(0.45, preset.bgMid + "24");
    wash.addColorStop(1, preset.bgBottom + "2f");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, state.width, state.height);

    const halo = ctx.createRadialGradient(
      state.width * 0.5,
      state.height * 0.44,
      0,
      state.width * 0.5,
      state.height * 0.44,
      Math.max(state.width, state.height) * 0.58
    );
    halo.addColorStop(0, preset.haze);
    halo.addColorStop(0.45, preset.glow);
    halo.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, state.width, state.height);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const star of state.stars) {
      const alpha = star.alpha + Math.sin(time * star.twinkle + star.x * 0.01) * 0.08;
      ctx.fillStyle = "rgba(255, 255, 255, " + clamp(alpha, 0.05, 0.7) + ")";
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRibbons(time) {
    const preset = presets[state.preset];
    const ribbonCount = 4;

    for (let index = 0; index < ribbonCount; index += 1) {
      const baseY = lerp(state.height * 0.16, state.height * 0.52, index / (ribbonCount - 1));
      const amplitude = lerp(28, 90, index / (ribbonCount - 1)) * preset.waveLift;
      const drift = (index + 1) * 0.18;

      ctx.beginPath();
      ctx.moveTo(-40, state.height + 40);

      for (let x = -40; x <= state.width + 40; x += 20) {
        const nx = x / state.width;
        const y =
          baseY +
          Math.sin(nx * 9 + time * (preset.speed + drift) + index * 1.8) * amplitude +
          Math.cos(nx * 15 - time * (preset.speed * 0.82) - index * 1.1) * amplitude * 0.36;
        ctx.lineTo(x, y);
      }

      ctx.lineTo(state.width + 40, state.height + 40);
      ctx.closePath();

      const fill = ctx.createLinearGradient(0, baseY - amplitude, 0, state.height);
      fill.addColorStop(0, preset.ribbons[index % preset.ribbons.length]);
      fill.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = fill;
      ctx.fill();
    }
  }

  function drawWaveGrid(time) {
    const preset = presets[state.preset];
    const horizon = state.height * 0.68;

    ctx.save();
    ctx.globalAlpha = 0.62;
    ctx.strokeStyle = preset.grid;
    ctx.lineWidth = 1;

    for (let row = 0; row < 11; row += 1) {
      const t = row / 10;
      const y = lerp(horizon, state.height * 1.03, t * t);
      ctx.beginPath();
      for (let x = -30; x <= state.width + 30; x += 24) {
        const lift =
          Math.sin(x * 0.009 + time * (preset.speed * 1.3) + row * 0.6) * (1 - t) * 18 +
          Math.cos(x * 0.015 - time * (preset.speed * 0.7) + row) * (1 - t) * 8;
        if (x === -30) {
          ctx.moveTo(x, y + lift);
        } else {
          ctx.lineTo(x, y + lift);
        }
      }
      ctx.stroke();
    }

    for (let column = 0; column < 16; column += 1) {
      const t = column / 15;
      const xBase = lerp(state.width * 0.12, state.width * 0.88, t);
      ctx.beginPath();
      for (let step = 0; step <= 10; step += 1) {
        const depth = step / 10;
        const y = lerp(horizon, state.height * 1.02, depth * depth);
        const sway = Math.sin(depth * 8 + time * preset.speed + column * 0.45) * (1 - depth) * 22;
        const x = lerp(xBase, state.width * 0.5, depth) + sway;
        if (step === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawPulses() {
    const preset = presets[state.preset];

    for (const pulse of state.pulses) {
      const progress = pulse.age / pulse.life;
      const radius = pulse.age * 220;
      const alpha = (1 - progress) * 0.22;

      const ring = ctx.createRadialGradient(pulse.x, pulse.y, radius * 0.2, pulse.x, pulse.y, radius + pulse.radius);
      ring.addColorStop(0, preset.pulse);
      ring.addColorStop(0.34, "rgba(255, 255, 255, " + alpha + ")");
      ring.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = ring;
      ctx.beginPath();
      ctx.arc(pulse.x, pulse.y, radius + pulse.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles() {
    const preset = presets[state.preset];
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const particle of state.particles) {
      const speed = Math.hypot(particle.vx, particle.vy);
      const angle = Math.atan2(particle.vy, particle.vx);
      const flap = Math.sin(state.time * 11 + particle.flapOffset + speed * 0.015);
      const wingLift = (0.35 + flap * 0.55) * particle.size;
      const wingSpan = particle.size * 1.15;
      const bodyLength = particle.size * 0.46;
      const alpha = clamp(0.3 + speed * 0.005, 0.3, 0.92);

      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(angle + particle.bank);
      ctx.strokeStyle = preset.trails[particle.tint].replace(
        /0\.\d+\)/,
        alpha.toFixed(2) + ")"
      );
      ctx.lineWidth = Math.max(1.2, particle.size * 0.14);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(-bodyLength, 0);
      ctx.lineTo(0, particle.size * 0.08);
      ctx.lineTo(bodyLength, 0);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-wingSpan * 0.45, -wingLift, -wingSpan, particle.size * 0.16);
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(wingSpan * 0.45, -wingLift, wingSpan, particle.size * 0.16);
      ctx.stroke();

      if (speed > 18) {
        ctx.strokeStyle = preset.grid;
        ctx.lineWidth = Math.max(0.8, particle.size * 0.08);
        ctx.beginPath();
        ctx.moveTo(-particle.size * 1.4, 0);
        ctx.lineTo(-particle.size * 2.4, 0);
        ctx.stroke();
      }

      ctx.restore();
    }

    ctx.restore();
  }

  function drawVignette() {
    const vignette = ctx.createRadialGradient(
      state.width * 0.5,
      state.height * 0.48,
      Math.min(state.width, state.height) * 0.12,
      state.width * 0.5,
      state.height * 0.5,
      Math.max(state.width, state.height) * 0.7
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.38)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  function render() {
    drawBackdrop(state.time);
    drawRibbons(state.time);
    drawWaveGrid(state.time);
    drawPulses();
    drawParticles();
    drawVignette();
  }

  function updateStats() {
    const preset = presets[state.preset];
    modeValue.textContent = preset.label;
    particleValue.textContent = state.particles.length.toLocaleString("en-US");
    tempoValue.textContent = Math.round(preset.speed * 100) + "%";
  }

  function setPreset(name) {
    if (!presets[name]) return;
    state.preset = name;
    updatePaletteVars();
    updateStats();
    presetButtons.forEach(function (button) {
      button.classList.toggle("active", button.dataset.preset === name);
    });

    for (const particle of state.particles) {
      particle.tint = Math.floor(rand(0, presets[name].trails.length));
    }

    state.needsClear = true;
    spawnPulse(state.width * 0.5, state.height * 0.5, 1);
  }

  function animate(now) {
    const dt = Math.min((now - state.lastFrame) / 1000, 0.033);
    state.lastFrame = now;
    state.time += dt;

    updatePulses(dt);
    updateParticles(dt);
    render();

    requestAnimationFrame(animate);
  }

  function handlePointerMove(event) {
    state.pointer.x = event.clientX;
    state.pointer.y = event.clientY;
    state.pointer.active = true;
  }

  function handlePointerLeave() {
    state.pointer.active = false;
  }

  function handlePointerDown(event) {
    state.pointer.x = event.clientX;
    state.pointer.y = event.clientY;
    state.pointer.active = true;
    spawnPulse(event.clientX, event.clientY, 1);
  }

  function bindEvents() {
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    canvas.addEventListener("pointerdown", handlePointerDown);
    burstButton.addEventListener("click", function () {
      spawnPulse(state.width * 0.5, state.height * 0.52, 1.2);
    });

    presetButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        setPreset(button.dataset.preset);
      });
    });
  }

  function init() {
    updatePaletteVars();
    resize();
    updateStats();
    bindEvents();
    spawnPulse(state.width * 0.5, state.height * 0.52, 1.2);
    requestAnimationFrame(function (now) {
      state.lastFrame = now;
      animate(now);
    });
  }

  init();
})();
