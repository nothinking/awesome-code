const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");

const controls = {
  energy: document.getElementById("energy"),
  wind: document.getElementById("wind"),
  chop: document.getElementById("chop"),
  detail: document.getElementById("detail"),
};

const outputs = {
  energy: document.getElementById("energyValue"),
  wind: document.getElementById("windValue"),
  chop: document.getElementById("chopValue"),
  detail: document.getElementById("detailValue"),
  mode: document.getElementById("modeValue"),
  waveCount: document.getElementById("waveCount"),
};

const presets = {
  calm: { energy: 28, wind: 20, chop: 16, detail: 45, label: "Calm" },
  swell: { energy: 58, wind: 62, chop: 48, detail: 56, label: "Swell" },
  storm: { energy: 92, wind: 88, chop: 82, detail: 78, label: "Storm" },
};

const state = {
  width: 0,
  height: 0,
  dpr: Math.min(window.devicePixelRatio || 1, 2),
  pointer: {
    active: false,
    lastSpawn: 0,
  },
  params: {
    energy: Number(controls.energy.value),
    wind: Number(controls.wind.value),
    chop: Number(controls.chop.value),
    detail: Number(controls.detail.value),
  },
  surface: {
    spanX: 160,
    spanZ: 180,
    gridX: 46,
    gridZ: 34,
    points: [],
    waves: [],
  },
  ripples: [],
};

const camera = {
  position: { x: 0, y: 44, z: -96 },
  target: { x: 0, y: 2, z: 68 },
  focalLength: 820,
  centerY: 0,
  right: null,
  up: null,
  forward: null,
};

const light = normalize({ x: -0.32, y: 0.82, z: -0.47 });

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(a, b, t) {
  return {
    r: Math.round(lerp(a.r, b.r, t)),
    g: Math.round(lerp(a.g, b.g, t)),
    b: Math.round(lerp(a.b, b.b, t)),
  };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function normalize(v) {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function updateOutputs() {
  Object.entries(state.params).forEach(([key, value]) => {
    outputs[key].value = Math.round(value);
    outputs[key].textContent = Math.round(value);
  });
  outputs.waveCount.textContent = `${state.surface.waves.length} carriers`;
}

function buildWaveSet() {
  const energy = state.params.energy / 100;
  const wind = state.params.wind / 100;
  const chop = state.params.chop / 100;
  const directionBase = -0.85 + wind * 1.9;

  state.surface.waves = [
    { amplitude: 4.2, wavelength: 78, speed: 0.62, angle: directionBase - 0.42, phase: 0.5, steepness: 0.32 },
    { amplitude: 3.1, wavelength: 54, speed: 0.86, angle: directionBase - 0.12, phase: 2.1, steepness: 0.44 },
    { amplitude: 2.5, wavelength: 36, speed: 1.08, angle: directionBase + 0.24, phase: 4.2, steepness: 0.57 },
    { amplitude: 1.6, wavelength: 21, speed: 1.32, angle: directionBase + 0.58, phase: 1.1, steepness: 0.66 },
    { amplitude: 1.15, wavelength: 12, speed: 1.85, angle: directionBase + 0.92, phase: 3.8, steepness: 0.74 },
    { amplitude: 0.72, wavelength: 8, speed: 2.3, angle: directionBase - 1.18, phase: 5.6, steepness: 0.86 },
  ].map((wave, index, all) => {
    const angleJitter = Math.sin(index * 1.7 + wind * 4.4) * 0.08;
    return {
      ...wave,
      amplitude: wave.amplitude * lerp(0.55, 1.85, energy),
      wavelength: wave.wavelength * lerp(1.2, 0.82, wind),
      speed: wave.speed * lerp(0.7, 1.35, wind),
      angle: wave.angle + angleJitter,
      steepness: wave.steepness * lerp(0.55, 1.4, chop) / all.length,
    };
  });

  outputs.waveCount.textContent = `${state.surface.waves.length} carriers`;
}

function resize() {
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(state.width * state.dpr);
  canvas.height = Math.round(state.height * state.dpr);
  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

  camera.focalLength = Math.min(state.width * 0.95, 860);
  camera.centerY = state.height * 0.58;
  camera.position = {
    x: 0,
    y: lerp(40, 50, clamp(state.height / 1000, 0, 1)),
    z: -96,
  };

  updateCameraBasis();
}

function updateCameraBasis() {
  camera.forward = normalize(subtract(camera.target, camera.position));
  camera.right = normalize(cross(camera.forward, { x: 0, y: 1, z: 0 }));
  camera.up = normalize(cross(camera.right, camera.forward));
}

function updateSurfaceConfig() {
  const detail = state.params.detail / 100;
  state.surface.gridX = Math.round(lerp(30, 74, detail));
  state.surface.gridZ = Math.round(lerp(24, 54, detail));
}

function sampleSurface(x, z, time) {
  let worldX = x;
  let worldY = 0;
  let worldZ = z;

  for (const wave of state.surface.waves) {
    const direction = {
      x: Math.cos(wave.angle),
      y: Math.sin(wave.angle),
    };
    const k = (Math.PI * 2) / wave.wavelength;
    const phase = k * (direction.x * x + direction.y * z) - time * wave.speed + wave.phase;
    const amplitude = wave.amplitude;
    const crest = wave.steepness / (k * amplitude + 0.0001);

    worldX += direction.x * crest * amplitude * Math.cos(phase);
    worldY += amplitude * Math.sin(phase);
    worldZ += direction.y * crest * amplitude * Math.cos(phase);
  }

  for (const ripple of state.ripples) {
    const age = time - ripple.start;
    if (age <= 0) {
      continue;
    }

    const dx = x - ripple.x;
    const dz = z - ripple.z;
    const distance = Math.hypot(dx, dz);
    const band = distance - age * ripple.velocity;
    const envelope = Math.exp(-(band * band) / (2 * ripple.width * ripple.width));
    worldY += ripple.amplitude * envelope * Math.sin(distance * 0.22 - age * 6.2) * Math.exp(-age * 0.45);
  }

  return { x: worldX, y: worldY, z: worldZ };
}

function project(point) {
  const relative = subtract(point, camera.position);
  const cameraX = dot(relative, camera.right);
  const cameraY = dot(relative, camera.up);
  const cameraZ = dot(relative, camera.forward);

  if (cameraZ < 1) {
    return null;
  }

  const scale = camera.focalLength / cameraZ;
  return {
    x: state.width * 0.5 + cameraX * scale,
    y: camera.centerY - cameraY * scale,
    depth: cameraZ,
  };
}

function mapPointerToWorld(clientX, clientY) {
  const nx = clientX / state.width;
  const ny = clientY / state.height;
  return {
    x: lerp(-state.surface.spanX * 0.52, state.surface.spanX * 0.52, nx),
    z: lerp(-8, state.surface.spanZ * 0.88, clamp((ny - 0.18) / 0.72, 0, 1)),
  };
}

function spawnRipple(clientX, clientY) {
  const world = mapPointerToWorld(clientX, clientY);
  state.ripples.push({
    x: world.x,
    z: world.z,
    start: performance.now() * 0.001,
    amplitude: lerp(0.9, 2.6, state.params.energy / 100),
    velocity: lerp(12, 18, state.params.wind / 100),
    width: lerp(8, 13, state.params.chop / 100),
  });

  if (state.ripples.length > 14) {
    state.ripples.splice(0, state.ripples.length - 14);
  }
}

function updateRipples(time) {
  state.ripples = state.ripples.filter((ripple) => time - ripple.start < 5.5);
}

function renderBackdrop(time) {
  const sky = ctx.createLinearGradient(0, 0, 0, state.height);
  sky.addColorStop(0, "#07111d");
  sky.addColorStop(0.3, "#163753");
  sky.addColorStop(0.62, "#2f6687");
  sky.addColorStop(1, "#f2bb74");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, state.width, state.height);

  const horizon = state.height * 0.45;
  const glowX = state.width * 0.72 + Math.sin(time * 0.04) * 18;
  const glow = ctx.createRadialGradient(glowX, horizon * 0.72, 0, glowX, horizon * 0.72, state.width * 0.22);
  glow.addColorStop(0, "rgba(255, 239, 188, 0.82)");
  glow.addColorStop(0.24, "rgba(246, 204, 132, 0.34)");
  glow.addColorStop(1, "rgba(246, 204, 132, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, state.width, horizon + 120);

  const haze = ctx.createLinearGradient(0, horizon - 50, 0, horizon + 130);
  haze.addColorStop(0, "rgba(255, 218, 155, 0)");
  haze.addColorStop(0.5, "rgba(255, 218, 155, 0.26)");
  haze.addColorStop(1, "rgba(7, 18, 29, 0)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - 50, state.width, 180);
}

function renderSurface(time) {
  const { spanX, spanZ, gridX, gridZ } = state.surface;
  const stepX = spanX / gridX;
  const stepZ = spanZ / gridZ;
  const points = new Array(gridZ + 1);
  const deep = { r: 7, g: 54, b: 78 };
  const mid = { r: 23, g: 121, b: 164 };
  const crest = { r: 133, g: 219, b: 255 };

  for (let zi = 0; zi <= gridZ; zi += 1) {
    const row = new Array(gridX + 1);
    const z = zi * stepZ;

    for (let xi = 0; xi <= gridX; xi += 1) {
      const x = -spanX * 0.5 + xi * stepX;
      const world = sampleSurface(x, z, time);
      row[xi] = {
        world,
        screen: project(world),
      };
    }

    points[zi] = row;
  }

  state.surface.points = points;

  for (let zi = gridZ - 1; zi >= 0; zi -= 1) {
    for (let xi = 0; xi < gridX; xi += 1) {
      const a = points[zi][xi];
      const b = points[zi][xi + 1];
      const c = points[zi + 1][xi + 1];
      const d = points[zi + 1][xi];

      if (!a.screen || !b.screen || !c.screen || !d.screen) {
        continue;
      }

      const ab = subtract(b.world, a.world);
      const ad = subtract(d.world, a.world);
      const normal = normalize(cross(ad, ab));
      const illumination = clamp(dot(normal, light) * 0.5 + 0.5, 0, 1);
      const averageHeight = (a.world.y + b.world.y + c.world.y + d.world.y) * 0.25;
      const depthFactor = clamp(1 - zi / gridZ, 0, 1);
      const crestFactor = clamp((averageHeight + 3) / 9, 0, 1);
      const foamFactor = clamp((1 - normal.y) * 1.8 + crestFactor * 0.8 - 0.48, 0, 1);

      let color = mixColor(deep, mid, clamp(0.18 + depthFactor * 0.78 + illumination * 0.24, 0, 1));
      color = mixColor(color, crest, clamp(foamFactor * 0.76 + illumination * 0.18, 0, 1));

      ctx.beginPath();
      ctx.moveTo(a.screen.x, a.screen.y);
      ctx.lineTo(b.screen.x, b.screen.y);
      ctx.lineTo(c.screen.x, c.screen.y);
      ctx.lineTo(d.screen.x, d.screen.y);
      ctx.closePath();
      ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${lerp(0.72, 0.96, depthFactor)})`;
      ctx.fill();

      if (foamFactor > 0.18) {
        ctx.strokeStyle = `rgba(235, 248, 255, ${foamFactor * 0.28})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  const overlay = ctx.createLinearGradient(0, state.height * 0.46, 0, state.height);
  overlay.addColorStop(0, "rgba(255, 219, 162, 0)");
  overlay.addColorStop(0.55, "rgba(9, 41, 61, 0.05)");
  overlay.addColorStop(1, "rgba(3, 16, 26, 0.34)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, state.height * 0.44, state.width, state.height * 0.56);
}

function tick(now) {
  const time = now * 0.001;
  updateRipples(time);
  renderBackdrop(time);
  renderSurface(time);
  requestAnimationFrame(tick);
}

function applyPreset(name) {
  const preset = presets[name];
  if (!preset) {
    return;
  }

  state.params.energy = preset.energy;
  state.params.wind = preset.wind;
  state.params.chop = preset.chop;
  state.params.detail = preset.detail;

  controls.energy.value = preset.energy;
  controls.wind.value = preset.wind;
  controls.chop.value = preset.chop;
  controls.detail.value = preset.detail;
  outputs.mode.textContent = preset.label;

  buildWaveSet();
  updateSurfaceConfig();
  updateOutputs();
}

function bindControls() {
  Object.entries(controls).forEach(([key, input]) => {
    input.addEventListener("input", () => {
      state.params[key] = Number(input.value);
      outputs[key].value = input.value;
      outputs[key].textContent = input.value;
      outputs.mode.textContent = "Custom";
      buildWaveSet();
      updateSurfaceConfig();
      updateOutputs();
    });
  });

  document.querySelectorAll(".preset").forEach((button) => {
    button.addEventListener("click", () => {
      applyPreset(button.dataset.preset);
    });
  });

  const pointerMove = (event) => {
    if (!state.pointer.active) {
      return;
    }

    const now = performance.now();
    if (now - state.pointer.lastSpawn > 90) {
      spawnRipple(event.clientX, event.clientY);
      state.pointer.lastSpawn = now;
    }
  };

  canvas.addEventListener("pointerdown", (event) => {
    state.pointer.active = true;
    state.pointer.lastSpawn = performance.now();
    spawnRipple(event.clientX, event.clientY);
  });

  canvas.addEventListener("pointermove", pointerMove);
  window.addEventListener("pointerup", () => {
    state.pointer.active = false;
  });
  window.addEventListener("pointercancel", () => {
    state.pointer.active = false;
  });
}

function init() {
  buildWaveSet();
  updateSurfaceConfig();
  updateOutputs();
  resize();
  bindControls();
  requestAnimationFrame(tick);
}

window.addEventListener("resize", resize);

init();
