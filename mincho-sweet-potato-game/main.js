const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");

const ui = {
  score: document.getElementById("scoreValue"),
  hp: document.getElementById("hpValue"),
  time: document.getElementById("timeValue"),
  combo: document.getElementById("comboValue"),
  title: document.getElementById("titleValue"),
  event: document.getElementById("eventValue"),
  message: document.getElementById("messageValue"),
  startButton: document.getElementById("startButton"),
  restartButton: document.getElementById("restartButton"),
};

const GAME_DURATION = 45;
const MAX_HP = 5;

const EVENT_DEFS = {
  normal: {
    label: "평온한 뇌절",
    duration: 0,
    goodChance: 0.56,
    spawnScale: 1,
    speedScale: 1,
    message: "잠깐 조용하지만 곧 이상한 게 쏟아집니다.",
  },
  spicy: {
    label: "떡볶이 세일",
    duration: 5.8,
    goodChance: 0.84,
    spawnScale: 0.85,
    speedScale: 1.04,
    message: "매운 탄수화물 파티가 시작됐습니다. 입에 넣을 준비 하세요.",
  },
  overtime: {
    label: "야근 서류 폭격",
    duration: 5.6,
    goodChance: 0.18,
    spawnScale: 0.88,
    speedScale: 1.2,
    message: "누군가 프린터를 폭주시켰습니다. 종이를 피해 다니세요.",
  },
  mint: {
    label: "민초 소행성대",
    duration: 5,
    goodChance: 0.12,
    spawnScale: 0.82,
    speedScale: 1.28,
    message: "민트초코가 하늘에서 내립니다. 삶이 아주 잘못됐습니다.",
  },
  coffee: {
    label: "커피 수혈 타임",
    duration: 4.8,
    goodChance: 0.78,
    spawnScale: 0.92,
    speedScale: 1.08,
    message: "카페인이 대기권을 뚫고 진입했습니다. 부지런히 주우세요.",
  },
};

const ITEM_TYPES = {
  tteok: {
    kind: "good",
    label: "떡볶이",
    radius: 25,
    score: 14,
    color: "#f54c32",
  },
  coffee: {
    kind: "good",
    label: "커피",
    radius: 22,
    score: 18,
    color: "#6a4228",
    heal: 1,
  },
  shield: {
    kind: "good",
    label: "김치 방패",
    radius: 24,
    score: 10,
    color: "#4f9156",
    shield: 6,
  },
  mint: {
    kind: "bad",
    label: "민초 운석",
    radius: 25,
    damage: 1,
    color: "#7cd4b0",
  },
  report: {
    kind: "bad",
    label: "야근 서류",
    radius: 24,
    damage: 1,
    color: "#f6efe1",
  },
};

const state = {
  width: 0,
  height: 0,
  dpr: Math.min(window.devicePixelRatio || 1, 2),
  lastTime: 0,
  score: 0,
  hp: MAX_HP,
  combo: 0,
  timeLeft: GAME_DURATION,
  gameState: "idle",
  eventKey: "normal",
  eventTimer: 0,
  eventCooldown: 3.5,
  spawnTimer: 0.55,
  hitFlash: 0,
  screenShake: 0,
  pointerX: null,
  items: [],
  particles: [],
  clouds: [],
  input: {
    left: false,
    right: false,
  },
  player: {
    x: 0,
    targetX: 0,
    y: 0,
    radius: 32,
    speed: 540,
    shield: 0,
    invulnerable: 0,
    bounce: 0,
  },
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

function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function roundedRect(x, y, width, height, radius) {
  const r = Math.min(radius, width * 0.5, height * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function setMessage(text) {
  ui.message.textContent = text;
}

function getTitle() {
  if (state.gameState === "won") {
    return "퇴근 신화 고구마";
  }

  if (state.gameState === "lost") {
    return "축축한 울보 고구마";
  }

  if (state.score >= 260) {
    return "민초 파괴왕";
  }

  if (state.score >= 170) {
    return "칼퇴 후보 1순위";
  }

  if (state.score >= 95) {
    return "맵부심 중간 관리자";
  }

  if (state.combo >= 6) {
    return "의욕 과다 고구마";
  }

  return "축 늘어진 인턴 고구마";
}

function updateUI() {
  ui.score.textContent = String(state.score);
  ui.hp.textContent = `${state.hp} / ${MAX_HP}`;
  ui.time.textContent = `${Math.max(0, state.timeLeft).toFixed(1)}초`;
  ui.combo.textContent = `${state.combo}x`;
  ui.title.textContent = getTitle();
  ui.event.textContent = EVENT_DEFS[state.eventKey].label;
  ui.startButton.disabled = state.gameState === "running";
}

function burst(x, y, color, amount = 10) {
  for (let index = 0; index < amount; index += 1) {
    state.particles.push({
      x,
      y,
      vx: rand(-180, 180),
      vy: rand(-220, -40),
      size: rand(4, 10),
      life: rand(0.35, 0.85),
      maxLife: 1,
      color,
    });
  }
}

function createClouds() {
  state.clouds = Array.from({ length: 8 }, (_, index) => ({
    x: (state.width / 8) * index + rand(-30, 30),
    y: rand(state.height * 0.08, state.height * 0.38),
    scale: rand(0.8, 1.55),
    speed: rand(10, 24),
  }));
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

  state.player.y = state.height - 102;
  state.player.x = clamp(state.player.x || state.width * 0.5, 56, state.width - 56);
  state.player.targetX = clamp(state.player.targetX || state.player.x, 56, state.width - 56);
  createClouds();
}

function chooseItemType() {
  const event = EVENT_DEFS[state.eventKey];
  const shieldChance = state.player.shield > 2.5 ? 0.02 : 0.07;

  if (Math.random() < shieldChance) {
    return "shield";
  }

  if (Math.random() < event.goodChance) {
    if (state.eventKey === "coffee") {
      return Math.random() < 0.7 ? "coffee" : "tteok";
    }

    return Math.random() < 0.72 ? "tteok" : "coffee";
  }

  if (state.eventKey === "mint") {
    return Math.random() < 0.74 ? "mint" : "report";
  }

  if (state.eventKey === "overtime") {
    return Math.random() < 0.72 ? "report" : "mint";
  }

  return Math.random() < 0.55 ? "mint" : "report";
}

function spawnItem() {
  const typeKey = chooseItemType();
  const type = ITEM_TYPES[typeKey];
  const event = EVENT_DEFS[state.eventKey];
  const difficulty = 1 - state.timeLeft / GAME_DURATION;
  const radius = type.radius * rand(0.92, 1.08);

  state.items.push({
    typeKey,
    x: rand(radius + 18, state.width - radius - 18),
    y: -radius - 26,
    radius,
    speed: rand(170, 250) * event.speedScale + difficulty * 95,
    drift: rand(-24, 24),
    phase: rand(0, Math.PI * 2),
    spin: rand(-1.6, 1.6),
    rotation: rand(-0.3, 0.3),
    chips: typeKey === "mint"
      ? Array.from({ length: 5 }, () => ({
          x: rand(-radius * 0.4, radius * 0.4),
          y: rand(-radius * 0.4, radius * 0.4),
          size: rand(2.8, 4.8),
        }))
      : [],
  });
}

function getSpawnInterval() {
  const difficulty = 1 - state.timeLeft / GAME_DURATION;
  const base = lerp(0.74, 0.34, difficulty);
  return clamp(base * EVENT_DEFS[state.eventKey].spawnScale, 0.24, 0.78);
}

function resetGame() {
  state.score = 0;
  state.hp = MAX_HP;
  state.combo = 0;
  state.timeLeft = GAME_DURATION;
  state.eventKey = "normal";
  state.eventTimer = 0;
  state.eventCooldown = 3.5;
  state.spawnTimer = 0.5;
  state.hitFlash = 0;
  state.screenShake = 0;
  state.items = [];
  state.particles = [];
  state.player.shield = 0;
  state.player.invulnerable = 0;
  state.player.bounce = 0;
  state.player.x = state.width * 0.5;
  state.player.targetX = state.player.x;
  state.gameState = "idle";
  setMessage("시작 버튼을 누르면 고구마 대리의 퇴근 본능이 활성화됩니다.");
  updateUI();
}

function startGame() {
  state.score = 0;
  state.hp = MAX_HP;
  state.combo = 0;
  state.timeLeft = GAME_DURATION;
  state.eventKey = "normal";
  state.eventTimer = 0;
  state.eventCooldown = 4.2;
  state.spawnTimer = 0.45;
  state.hitFlash = 0;
  state.screenShake = 0;
  state.items = [];
  state.particles = [];
  state.player.shield = 0;
  state.player.invulnerable = 0;
  state.player.bounce = 0;
  state.player.x = state.width * 0.5;
  state.player.targetX = state.player.x;
  state.gameState = "running";
  setMessage("떡볶이는 먹고 민초는 치우세요. 그것이 오늘의 업무입니다.");
  updateUI();
}

function endGame(result) {
  state.gameState = result;

  if (result === "won") {
    setMessage(`퇴근 성공. 점수 ${state.score}점으로 민초 재난을 버텼습니다.`);
  } else {
    setMessage("멘탈이 바닥났습니다. 민초와 서류에 포위당해 눈물 퇴장했습니다.");
  }

  updateUI();
}

function setEvent(key) {
  state.eventKey = key;
  state.eventTimer = EVENT_DEFS[key].duration;
  setMessage(EVENT_DEFS[key].message);
  updateUI();
}

function updateEvent(dt) {
  if (state.eventKey !== "normal") {
    state.eventTimer -= dt;

    if (state.eventTimer <= 0) {
      state.eventKey = "normal";
      state.eventTimer = 0;
      state.eventCooldown = rand(5.2, 7.8);
      setMessage(EVENT_DEFS.normal.message);
    }

    return;
  }

  state.eventCooldown -= dt;
  if (state.eventCooldown <= 0) {
    setEvent(pick(["spicy", "overtime", "mint", "coffee"]));
  }
}

function addScore(baseScore) {
  const comboBoost = 1 + Math.min(state.combo, 8) * 0.08;
  const total = Math.round(baseScore * comboBoost);
  state.score += total;
}

function handleGoodCollision(item) {
  const type = ITEM_TYPES[item.typeKey];
  state.combo += 1;
  addScore(type.score);
  state.player.bounce = 0.35;

  if (type.heal && state.hp < MAX_HP && Math.random() < 0.65) {
    state.hp += type.heal;
  }

  if (type.shield) {
    state.player.shield = Math.max(state.player.shield, type.shield);
  }

  if (state.combo > 0 && state.combo % 6 === 0) {
    state.score += 24;
    setMessage("콤보 보너스 발동. 고구마 대리가 갑자기 유능해졌습니다.");
  } else if (item.typeKey === "shield") {
    setMessage("김치 방패 획득. 6초 동안 민초를 밀어냅니다.");
  } else if (item.typeKey === "coffee") {
    setMessage("카페인 주입 완료. 눈빛이 아주 약간 살아났습니다.");
  } else {
    setMessage("떡볶이 확보. 매운 기세로 점수를 쓸어 담습니다.");
  }

  burst(item.x, item.y, type.color, 12);
  updateUI();
}

function handleBadCollision(item) {
  if (state.player.shield > 0) {
    state.score += 8;
    burst(item.x, item.y, "#4f9156", 10);
    setMessage("김치 방패가 재앙을 반찬처럼 막아냈습니다.");
    updateUI();
    return;
  }

  if (state.player.invulnerable > 0) {
    return;
  }

  const type = ITEM_TYPES[item.typeKey];
  state.hp = Math.max(0, state.hp - type.damage);
  state.combo = 0;
  state.player.invulnerable = 0.85;
  state.screenShake = 16;
  state.hitFlash = 0.8;
  burst(item.x, item.y, item.typeKey === "mint" ? "#7cd4b0" : "#ffffff", 14);

  if (item.typeKey === "mint") {
    setMessage("민초 직격. 영혼에서 치약 향이 올라옵니다.");
  } else {
    setMessage("야근 서류 피격. 멘탈이 단정하게 반으로 접혔습니다.");
  }

  if (state.hp <= 0) {
    endGame("lost");
  } else {
    updateUI();
  }
}

function updatePlayer(dt) {
  const minX = 56;
  const maxX = state.width - 56;
  const direction = Number(state.input.right) - Number(state.input.left);

  if (direction !== 0) {
    state.player.targetX = clamp(state.player.targetX + direction * state.player.speed * dt, minX, maxX);
  } else if (state.pointerX !== null) {
    state.player.targetX = clamp(state.pointerX, minX, maxX);
  }

  const follow = 1 - Math.exp(-12 * dt);
  state.player.x = lerp(state.player.x, state.player.targetX, follow);
  state.player.bounce = Math.max(0, state.player.bounce - dt * 1.8);
  state.player.shield = Math.max(0, state.player.shield - dt);
  state.player.invulnerable = Math.max(0, state.player.invulnerable - dt);
}

function updateItems(dt, time) {
  for (let index = state.items.length - 1; index >= 0; index -= 1) {
    const item = state.items[index];
    item.y += item.speed * dt;
    item.x += Math.sin(time * 2.5 + item.phase) * item.drift * dt;
    item.rotation += item.spin * dt;

    const dx = item.x - state.player.x;
    const dy = item.y - (state.player.y - 18);
    const distance = Math.hypot(dx, dy);

    if (distance < item.radius + state.player.radius * 0.76) {
      if (ITEM_TYPES[item.typeKey].kind === "good") {
        handleGoodCollision(item);
      } else {
        handleBadCollision(item);
      }

      state.items.splice(index, 1);
      continue;
    }

    if (item.y - item.radius > state.height + 40) {
      state.items.splice(index, 1);
    }
  }
}

function updateParticles(dt) {
  for (let index = state.particles.length - 1; index >= 0; index -= 1) {
    const particle = state.particles[index];
    particle.life -= dt * 1.6;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 280 * dt;

    if (particle.life <= 0) {
      state.particles.splice(index, 1);
    }
  }
}

function updateClouds(dt) {
  for (const cloud of state.clouds) {
    cloud.x += cloud.speed * dt;

    if (cloud.x - cloud.scale * 70 > state.width + 60) {
      cloud.x = -cloud.scale * 90;
      cloud.y = rand(state.height * 0.08, state.height * 0.38);
      cloud.scale = rand(0.8, 1.55);
      cloud.speed = rand(10, 24);
    }
  }
}

function update(dt, time) {
  updateClouds(dt);
  updateParticles(dt);
  updatePlayer(dt);
  state.screenShake = Math.max(0, state.screenShake - dt * 28);
  state.hitFlash = Math.max(0, state.hitFlash - dt * 2.4);

  if (state.gameState !== "running") {
    return;
  }

  state.timeLeft = Math.max(0, state.timeLeft - dt);
  updateEvent(dt);
  state.spawnTimer -= dt;

  if (state.spawnTimer <= 0) {
    spawnItem();
    state.spawnTimer = getSpawnInterval();
  }

  updateItems(dt, time);
  updateUI();

  if (state.timeLeft <= 0 && state.gameState === "running") {
    endGame("won");
  }
}

function drawBackground(time) {
  const sky = ctx.createLinearGradient(0, 0, 0, state.height);
  sky.addColorStop(0, "#fff1a8");
  sky.addColorStop(0.36, "#ffb566");
  sky.addColorStop(1, "#ff5b39");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, state.width, state.height);

  const sunX = state.width * 0.82 + Math.sin(time * 0.8) * 12;
  const sunY = state.height * 0.18;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 12, sunX, sunY, 108);
  sunGlow.addColorStop(0, "rgba(255, 251, 226, 0.9)");
  sunGlow.addColorStop(1, "rgba(255, 251, 226, 0)");
  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, 0, state.width, state.height * 0.5);

  ctx.fillStyle = "#ffd457";
  ctx.beginPath();
  ctx.arc(sunX, sunY, 48, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#73301b";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(sunX - 14, sunY - 4, 5, 0, Math.PI * 2);
  ctx.arc(sunX + 14, sunY - 4, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sunX, sunY + 10, 16, 0.2, Math.PI - 0.2);
  ctx.stroke();

  for (const cloud of state.clouds) {
    drawCloud(cloud);
  }

  ctx.fillStyle = "rgba(255, 235, 208, 0.12)";
  for (let x = -40; x < state.width + 40; x += 54) {
    ctx.fillRect(x + Math.sin(time + x) * 6, state.height * 0.54, 26, state.height * 0.24);
  }

  const floorGradient = ctx.createLinearGradient(0, state.height * 0.76, 0, state.height);
  floorGradient.addColorStop(0, "#76452a");
  floorGradient.addColorStop(1, "#31180d");
  ctx.fillStyle = floorGradient;
  ctx.fillRect(0, state.height * 0.77, state.width, state.height * 0.23);

  ctx.fillStyle = "rgba(255, 224, 186, 0.12)";
  for (let x = 0; x < state.width + 40; x += 42) {
    ctx.fillRect(x, state.height * 0.8 + ((x / 42) % 2) * 12, 20, 10);
  }
}

function drawCloud(cloud) {
  ctx.save();
  ctx.translate(cloud.x, cloud.y);
  ctx.scale(cloud.scale, cloud.scale);
  ctx.fillStyle = "rgba(255, 251, 241, 0.66)";

  ctx.beginPath();
  ctx.arc(-28, 10, 24, 0, Math.PI * 2);
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.arc(30, 12, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer(time) {
  const x = state.player.x;
  const bounce = Math.sin(time * 7) * 2 + state.player.bounce * 14;
  const y = state.player.y - bounce;
  const blink = state.player.invulnerable > 0 && Math.floor(time * 18) % 2 === 0;

  ctx.fillStyle = "rgba(38, 17, 9, 0.24)";
  ctx.beginPath();
  ctx.ellipse(x, state.player.y + 24, 38, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  if (state.player.shield > 0) {
    const shieldAlpha = 0.16 + Math.sin(time * 8) * 0.04;
    ctx.strokeStyle = `rgba(79, 145, 86, ${0.6 + shieldAlpha})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y - 4, 44, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (!blink) {
    ctx.fillStyle = "#a55b2c";
    ctx.beginPath();
    ctx.ellipse(x, y, 32, 42, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#cf7d3f";
    ctx.beginPath();
    ctx.ellipse(x - 8, y - 10, 13, 18, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#fbe8c9";
  ctx.beginPath();
  ctx.arc(x - 10, y - 8, 4, 0, Math.PI * 2);
  ctx.arc(x + 10, y - 8, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#33180d";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(x - 10, y + 10);
  ctx.quadraticCurveTo(x, y + 18 + Math.sin(time * 10) * 2, x + 10, y + 10);
  ctx.stroke();

  ctx.fillStyle = "#d43e23";
  ctx.beginPath();
  ctx.moveTo(x + 4, y - 2);
  ctx.lineTo(x + 16, y + 22);
  ctx.lineTo(x + 6, y + 22);
  ctx.lineTo(x + 2, y + 8);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#33180d";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 12, y + 38);
  ctx.lineTo(x - 16, y + 48);
  ctx.moveTo(x + 10, y + 38);
  ctx.lineTo(x + 14, y + 48);
  ctx.stroke();

  ctx.fillStyle = "#fff7ec";
  ctx.font = '700 16px "Trebuchet MS", "Apple SD Gothic Neo", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("고구마 대리", x, y - 54);
}

function drawTteok(item) {
  ctx.fillStyle = "#ffe7d4";
  ctx.beginPath();
  ctx.ellipse(0, 10, item.radius * 0.9, item.radius * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ef4a32";
  roundedRect(-item.radius * 0.76, -item.radius * 0.34, item.radius * 1.52, item.radius * 0.9, 10);
  ctx.fill();

  ctx.strokeStyle = "#ffd1bf";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-item.radius * 0.4, -3);
  ctx.lineTo(item.radius * 0.34, 4);
  ctx.moveTo(-item.radius * 0.2, 8);
  ctx.lineTo(item.radius * 0.48, 11);
  ctx.stroke();
}

function drawCoffee(item, time) {
  ctx.fillStyle = "#fff6e5";
  roundedRect(-item.radius * 0.58, -item.radius * 0.38, item.radius * 1.02, item.radius * 1.08, 7);
  ctx.fill();

  ctx.strokeStyle = "#6a4228";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(item.radius * 0.48, 1, item.radius * 0.24, -1.2, 1.2);
  ctx.stroke();

  ctx.fillStyle = "#6a4228";
  ctx.fillRect(-item.radius * 0.5, -item.radius * 0.22, item.radius * 0.86, item.radius * 0.34);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
  ctx.lineWidth = 2;
  for (let index = -1; index <= 1; index += 1) {
    ctx.beginPath();
    ctx.moveTo(index * 8, -item.radius * 0.54);
    ctx.quadraticCurveTo(index * 10 + Math.sin(time * 7 + index) * 3, -item.radius * 0.9, index * 4, -item.radius * 1.18);
    ctx.stroke();
  }
}

function drawShield(item) {
  ctx.fillStyle = "#4f9156";
  ctx.beginPath();
  ctx.arc(0, 0, item.radius * 0.82, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#d9f0d0";
  ctx.beginPath();
  ctx.arc(0, 0, item.radius * 0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2e5b34";
  ctx.font = '700 12px "Trebuchet MS", "Apple SD Gothic Neo", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("김치", 0, 4);
}

function drawMint(item) {
  ctx.fillStyle = "#7cd4b0";
  roundedRect(-item.radius * 0.64, -item.radius * 0.64, item.radius * 1.28, item.radius * 1.28, 8);
  ctx.fill();

  ctx.fillStyle = "#573d2c";
  for (const chip of item.chips) {
    ctx.beginPath();
    ctx.arc(chip.x, chip.y, chip.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawReport(item) {
  ctx.fillStyle = "#fff7ed";
  roundedRect(-item.radius * 0.58, -item.radius * 0.74, item.radius * 1.06, item.radius * 1.36, 6);
  ctx.fill();

  ctx.fillStyle = "#de5032";
  ctx.fillRect(-item.radius * 0.36, -item.radius * 0.18, item.radius * 0.72, 7);

  ctx.fillStyle = "#c4bcb1";
  for (let index = -1; index <= 1; index += 1) {
    ctx.fillRect(-item.radius * 0.34, index * 10 + 5, item.radius * 0.68, 3);
  }
}

function drawItem(item, time) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.rotation);

  if (item.typeKey === "tteok") {
    drawTteok(item);
  } else if (item.typeKey === "coffee") {
    drawCoffee(item, time);
  } else if (item.typeKey === "shield") {
    drawShield(item);
  } else if (item.typeKey === "mint") {
    drawMint(item);
  } else {
    drawReport(item);
  }

  ctx.restore();

  ctx.fillStyle = "rgba(49, 24, 13, 0.78)";
  ctx.font = '700 11px "Trebuchet MS", "Apple SD Gothic Neo", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(ITEM_TYPES[item.typeKey].label, item.x, item.y + item.radius + 16);
}

function drawParticles() {
  for (const particle of state.particles) {
    ctx.globalAlpha = clamp(particle.life, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

function drawBanner() {
  ctx.save();
  ctx.translate(state.width * 0.5, 48);
  ctx.fillStyle = "rgba(44, 20, 11, 0.24)";
  roundedRect(-138, -18, 276, 40, 20);
  ctx.fill();

  ctx.fillStyle = "#fff7ec";
  ctx.font = '700 18px "Trebuchet MS", "Apple SD Gothic Neo", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(EVENT_DEFS[state.eventKey].label, 0, 8);
  ctx.restore();
}

function drawOverlay() {
  if (state.gameState === "running") {
    return;
  }

  ctx.fillStyle = "rgba(31, 13, 7, 0.24)";
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#fff8ef";
  ctx.font = '700 20px "Trebuchet MS", "Apple SD Gothic Neo", sans-serif';
  ctx.fillText("월요병 대응 실전 훈련장", state.width * 0.5, state.height * 0.38);

  ctx.font = '700 44px Georgia, "Times New Roman", serif';
  ctx.fillText("민초 운석을 피하는 고구마", state.width * 0.5, state.height * 0.45);

  ctx.font = '700 18px "Trebuchet MS", "Apple SD Gothic Neo", sans-serif';
  if (state.gameState === "idle") {
    ctx.fillText("게임 시작을 누르거나 화면을 터치해서 바로 달리면 됩니다.", state.width * 0.5, state.height * 0.53);
  } else if (state.gameState === "won") {
    ctx.fillText(`퇴근 성공. 최종 점수 ${state.score}점`, state.width * 0.5, state.height * 0.53);
  } else {
    ctx.fillText(`멘탈 고갈. 최종 점수 ${state.score}점`, state.width * 0.5, state.height * 0.53);
  }
}

function drawHitFlash() {
  if (state.hitFlash <= 0) {
    return;
  }

  ctx.fillStyle = `rgba(255, 255, 255, ${state.hitFlash * 0.16})`;
  ctx.fillRect(0, 0, state.width, state.height);
}

function render(time) {
  ctx.clearRect(0, 0, state.width, state.height);
  ctx.save();

  if (state.screenShake > 0) {
    ctx.translate(rand(-state.screenShake, state.screenShake), rand(-state.screenShake, state.screenShake));
  }

  drawBackground(time);

  for (const item of state.items) {
    drawItem(item, time);
  }

  drawPlayer(time);
  drawParticles();
  drawBanner();
  drawOverlay();
  ctx.restore();
  drawHitFlash();
}

function tick(now) {
  const time = now * 0.001;

  if (!state.lastTime) {
    state.lastTime = time;
  }

  const dt = Math.min(0.033, time - state.lastTime);
  state.lastTime = time;
  update(dt, time);
  render(time);
  requestAnimationFrame(tick);
}

function bindControls() {
  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
      state.input.left = true;
      state.pointerX = null;
      event.preventDefault();
    }

    if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
      state.input.right = true;
      state.pointerX = null;
      event.preventDefault();
    }

    if ((event.key === "Enter" || event.key === " ") && state.gameState !== "running") {
      startGame();
      event.preventDefault();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
      state.input.left = false;
    }

    if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
      state.input.right = false;
    }
  });

  canvas.addEventListener("pointerdown", (event) => {
    state.pointerX = event.clientX;

    if (state.gameState !== "running") {
      startGame();
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    state.pointerX = event.clientX;
  });

  canvas.addEventListener("pointerleave", () => {
    state.pointerX = null;
  });

  ui.startButton.addEventListener("click", () => {
    if (state.gameState !== "running") {
      startGame();
    }
  });

  ui.restartButton.addEventListener("click", () => {
    startGame();
  });
}

function init() {
  resize();
  resetGame();
  bindControls();
  updateUI();
  requestAnimationFrame(tick);
}

window.addEventListener("resize", resize);

init();
