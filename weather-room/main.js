(function () {
  "use strict";

  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");
  const root = document.documentElement;

  const presetButtons = Array.from(document.querySelectorAll(".preset"));
  const modeValue = document.getElementById("mode-value");
  const densityValue = document.getElementById("density-value");
  const tempoValue = document.getElementById("tempo-value");
  const presetCopy = document.getElementById("preset-copy");

  const presets = {
    sunny: {
      label: "Sunny",
      copy: "따뜻한 빛과 느린 공기 흐름으로 고요한 실내 아침 장면을 만든다.",
      bgTop: "#ebc989",
      bgBottom: "#456ea8",
      haze: "rgba(255, 244, 221, 0.45)",
      accent: "#ffe28a",
      accentStrong: "#9ae4ff",
      drift: 0.38,
      density: 48,
      floorGlow: "rgba(255, 224, 160, 0.26)",
      particleColor: "rgba(255, 252, 234, 0.82)",
      streakColor: "rgba(255, 255, 255, 0.14)",
      wind: 0.08,
      vertical: -0.02,
      blur: 0.3,
    },
    rain: {
      label: "Rain",
      copy: "차가운 빗줄기와 반사광이 겹쳐 젖은 도시의 실내 창가 같은 장면을 만든다.",
      bgTop: "#516b8c",
      bgBottom: "#132033",
      haze: "rgba(168, 206, 255, 0.2)",
      accent: "#9ed0ff",
      accentStrong: "#d2e8ff",
      drift: 0.86,
      density: 160,
      floorGlow: "rgba(98, 136, 196, 0.18)",
      particleColor: "rgba(194, 225, 255, 0.72)",
      streakColor: "rgba(194, 225, 255, 0.46)",
      wind: -0.24,
      vertical: 1.6,
      blur: 0.18,
    },
    wind: {
      label: "Wind",
      copy: "먼지와 안개 결이 빠르게 흐르며 압력감 있는 공기 움직임을 보여준다.",
      bgTop: "#d7d0c2",
      bgBottom: "#4f5c69",
      haze: "rgba(255, 244, 229, 0.22)",
      accent: "#f6e4c8",
      accentStrong: "#d9f0ff",
      drift: 0.94,
      density: 110,
      floorGlow: "rgba(255, 240, 214, 0.14)",
      particleColor: "rgba(255, 246, 229, 0.64)",
      streakColor: "rgba(255, 255, 255, 0.18)",
      wind: 1.14,
      vertical: 0.08,
      blur: 0.38,
    },
    snow: {
      label: "Snow",
      copy: "아주 느린 낙하와 넓은 확산광으로 조용하고 차분한 겨울 실내를 표현한다.",
      bgTop: "#d9e7f7",
      bgBottom: "#6b84a6",
      haze: "rgba(255, 255, 255, 0.3)",
      accent: "#ffffff",
      accentStrong: "#dff4ff",
      drift: 0.28,
      density: 90,
      floorGlow: "rgba(225, 241, 255, 0.2)",
      particleColor: "rgba(255, 255, 255, 0.9)",
      streakColor: "rgba(228, 240, 255, 0.14)",
      wind: 0.12,
      vertical: 0.24,
      blur: 0.6,
    },
    aurora: {
      label: "Aurora Night",
      copy: "어두운 실내 위로 오로라 톤의 빛이 번지고 작은 입자가 천천히 맴돈다.",
      bgTop: "#0b1227",
      bgBottom: "#1b204f",
      haze: "rgba(110, 255, 218, 0.16)",
      accent: "#79ffd3",
      accentStrong: "#8fd4ff",
      drift: 0.54,
      density: 72,
      floorGlow: "rgba(122, 255, 211, 0.16)",
      particleColor: "rgba(160, 244, 255, 0.82)",
      streakColor: "rgba(122, 255, 211, 0.12)",
      wind: -0.06,
      vertical: -0.05,
      blur: 0.26,
    },
  };

  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    time: 0,
    lastFrame: performance.now(),
    preset: "sunny",
    particles: [],
    streaks: [],
    pointer: {
      x: 0,
      y: 0,
      active: false,
    },
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function applyVars() {
    const preset = presets[state.preset];
    root.style.setProperty("--bg-top", preset.bgTop);
    root.style.setProperty("--bg-bottom", preset.bgBottom);
    root.style.setProperty("--haze", preset.haze);
    root.style.setProperty("--accent", preset.accent);
    root.style.setProperty("--accent-strong", preset.accentStrong);
  }

  function resetParticle(particle, seeded) {
    const preset = presets[state.preset];
    particle.x = seeded ? Math.random() * state.width : rand(-80, state.width + 80);
    particle.y = seeded ? Math.random() * state.height : rand(-120, state.height + 60);
    particle.radius = state.preset === "snow" ? rand(1.6, 4.6) : rand(0.8, 2.4);
    particle.alpha = rand(0.22, 0.95);
    particle.speedX = rand(-0.4, 0.4) + preset.wind;
    particle.speedY = rand(0.2, 0.8) + preset.vertical;
    particle.wobble = rand(0.4, 2.2);
    particle.offset = rand(0, Math.PI * 2);
  }

  function createParticles() {
    const preset = presets[state.preset];
    state.particles = [];
    for (let index = 0; index < preset.density; index += 1) {
      const particle = {};
      resetParticle(particle, true);
      state.particles.push(particle);
    }
    densityValue.textContent = preset.density.toLocaleString("en-US");
  }

  function createStreaks() {
    state.streaks = [];
    const count = Math.round(clamp(state.width / 18, 18, 80));
    for (let index = 0; index < count; index += 1) {
      state.streaks.push({
        x: Math.random() * state.width,
        width: rand(90, 220),
        alpha: rand(0.03, 0.12),
        speed: rand(8, 32),
      });
    }
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

    state.pointer.x = state.width * 0.5;
    state.pointer.y = state.height * 0.45;

    createParticles();
    createStreaks();
  }

  function applyPreset(key) {
    if (!presets[key]) {
      return;
    }

    state.preset = key;
    applyVars();
    createParticles();
    createStreaks();

    const preset = presets[key];
    modeValue.textContent = preset.label;
    tempoValue.textContent = Math.round(preset.drift * 100) + "%";
    presetCopy.textContent = preset.copy;

    for (const button of presetButtons) {
      button.classList.toggle("active", button.dataset.preset === key);
    }
  }

  function drawBackground(preset) {
    const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
    gradient.addColorStop(0, preset.bgTop);
    gradient.addColorStop(1, preset.bgBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, state.width, state.height);

    const glowX = state.pointer.active ? state.pointer.x : state.width * 0.68;
    const glowY = state.pointer.active ? state.pointer.y : state.height * 0.26;
    const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, state.width * 0.32);
    glow.addColorStop(0, preset.haze);
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  function drawFloor(preset) {
    const floorY = state.height * 0.72;
    const floorGradient = ctx.createLinearGradient(0, floorY, 0, state.height);
    floorGradient.addColorStop(0, "rgba(255,255,255,0)");
    floorGradient.addColorStop(1, "rgba(8, 12, 20, 0.3)");
    ctx.fillStyle = floorGradient;
    ctx.fillRect(0, floorY, state.width, state.height - floorY);

    ctx.fillStyle = preset.floorGlow;
    ctx.beginPath();
    ctx.ellipse(state.width * 0.5, floorY + 26, state.width * 0.32, 48, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStreaks(delta, preset) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const streak of state.streaks) {
      streak.x += delta * streak.speed * preset.drift;
      if (streak.x - streak.width > state.width) {
        streak.x = -streak.width;
      }

      const gradient = ctx.createLinearGradient(streak.x, 0, streak.x + streak.width, 0);
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(0.45, preset.streakColor);
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.globalAlpha = streak.alpha;
      ctx.fillRect(streak.x, 0, streak.width, state.height);
    }
    ctx.restore();
  }

  function drawParticles(delta, preset) {
    ctx.save();
    ctx.fillStyle = preset.particleColor;

    for (const particle of state.particles) {
      particle.x += particle.speedX * delta * 40 * preset.drift;
      particle.y += particle.speedY * delta * 40 * preset.drift;
      particle.x += Math.sin(state.time * particle.wobble + particle.offset) * preset.blur;

      const pointerDx = state.pointer.x - particle.x;
      const pointerDy = state.pointer.y - particle.y;
      const pointerDistance = Math.hypot(pointerDx, pointerDy) || 1;
      if (pointerDistance < 180) {
        particle.x -= (pointerDx / pointerDistance) * 0.6;
        particle.y -= (pointerDy / pointerDistance) * 0.6;
      }

      if (
        particle.x < -120 ||
        particle.x > state.width + 120 ||
        particle.y < -160 ||
        particle.y > state.height + 160
      ) {
        resetParticle(particle, false);
      }

      ctx.globalAlpha = particle.alpha;

      if (state.preset === "rain") {
        ctx.strokeStyle = preset.particleColor;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(particle.x, particle.y);
        ctx.lineTo(particle.x + preset.wind * 10, particle.y + 16);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function drawRoomLines() {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    const horizonY = state.height * 0.72;

    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(state.width, horizonY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(state.width * 0.18, 0);
    ctx.lineTo(state.width * 0.36, horizonY);
    ctx.moveTo(state.width * 0.82, 0);
    ctx.lineTo(state.width * 0.64, horizonY);
    ctx.stroke();
    ctx.restore();
  }

  function frame(now) {
    const delta = Math.min((now - state.lastFrame) / 1000, 0.035);
    state.lastFrame = now;
    state.time += delta;

    const preset = presets[state.preset];
    drawBackground(preset);
    drawStreaks(delta, preset);
    drawFloor(preset);
    drawParticles(delta, preset);
    drawRoomLines();

    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", function (event) {
    state.pointer.active = true;
    state.pointer.x = event.clientX;
    state.pointer.y = event.clientY;
  });
  window.addEventListener("pointerleave", function () {
    state.pointer.active = false;
  });

  for (const button of presetButtons) {
    button.addEventListener("click", function () {
      applyPreset(button.dataset.preset);
    });
  }

  applyPreset(state.preset);
  resize();
  requestAnimationFrame(frame);
})();
