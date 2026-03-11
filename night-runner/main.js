(function () {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const titleOverlay = document.getElementById("title-overlay");
  const gameoverOverlay = document.getElementById("gameover-overlay");
  const startButton = document.getElementById("start-button");
  const restartButton = document.getElementById("restart-button");
  const statusText = document.getElementById("status-text");

  const ui = {
    distance: document.getElementById("distance-value"),
    pursuit: document.getElementById("pursuit-value"),
    focus: document.getElementById("focus-value"),
    hp: document.getElementById("hp-value"),
    pursuitBar: document.getElementById("pursuit-bar"),
    focusBar: document.getElementById("focus-bar"),
    resultTitle: document.getElementById("result-title"),
    resultCopy: document.getElementById("result-copy"),
    resultDistance: document.getElementById("result-distance"),
    resultRank: document.getElementById("result-rank"),
  };

  const DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  const touchButtons = document.querySelectorAll(".touch-btn");

  const keys = {
    jumpQueued: false,
    slideQueued: false,
    dashQueued: false,
  };

  const state = {
    mode: "title",
    width: 1280,
    height: 720,
    groundY: 560,
    worldSpeed: 360,
    distance: 0,
    focus: 100,
    hp: 3,
    pursuitGap: 280,
    spawnTimer: 0,
    pulse: 0,
    flash: 0,
    time: 0,
    shake: 0,
    obstacles: [],
    pickups: [],
    particles: [],
    skyline: [],
    sparks: [],
  };

  const player = {
    x: 230,
    y: 0,
    width: 52,
    height: 86,
    vy: 0,
    gravity: 2100,
    jumpForce: 840,
    jumpsLeft: 2,
    slideTimer: 0,
    dashTimer: 0,
    invulnerable: 0,
    hitTimer: 0,
  };

  const PATTERNS = [
    { obstacles: [{ kind: "crate", offset: 0 }] },
    { obstacles: [{ kind: "beam", offset: 0 }] },
    { obstacles: [{ kind: "drone", offset: 0 }] },
    { obstacles: [{ kind: "crate", offset: 0 }, { kind: "crate", offset: 160 }] },
    { obstacles: [{ kind: "beam", offset: 0 }, { kind: "crate", offset: 230 }], pickup: { kind: "cell", offset: 110, y: 280 } },
    { obstacles: [{ kind: "drone", offset: 0 }, { kind: "beam", offset: 220 }] },
    { obstacles: [{ kind: "shock", offset: 0 }, { kind: "crate", offset: 210 }], pickup: { kind: "cell", offset: 140, y: 320 } },
    { obstacles: [{ kind: "crate", offset: 0 }, { kind: "drone", offset: 250 }, { kind: "beam", offset: 430 }] },
    { obstacles: [{ kind: "shock", offset: 0 }, { kind: "shock", offset: 210 }], pickup: { kind: "cell", offset: 100, y: 260 } },
  ];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function resetGame() {
    state.mode = "playing";
    state.distance = 0;
    state.worldSpeed = 360;
    state.focus = 100;
    state.hp = 3;
    state.pursuitGap = 280;
    state.spawnTimer = 0.5;
    state.pulse = 0;
    state.flash = 0;
    state.time = 0;
    state.shake = 0;
    state.obstacles = [];
    state.pickups = [];
    state.particles = [];
    state.sparks = [];
    buildSkyline();

    player.y = state.groundY - player.height;
    player.vy = 0;
    player.jumpsLeft = 2;
    player.slideTimer = 0;
    player.dashTimer = 0;
    player.invulnerable = 0;
    player.hitTimer = 0;

    titleOverlay.classList.remove("active");
    gameoverOverlay.classList.remove("active");
    statusText.textContent = "추격 파동 접근 중";
    updateUI();
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    state.width = Math.max(320, Math.floor(rect.width));
    state.height = Math.max(420, Math.floor(rect.height));
    canvas.width = Math.floor(state.width * DPR);
    canvas.height = Math.floor(state.height * DPR);
    canvas.style.width = state.width + "px";
    canvas.style.height = state.height + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    state.groundY = Math.floor(state.height * 0.77);
    player.x = Math.floor(state.width * 0.22);
    if (state.mode !== "playing") {
      player.y = state.groundY - player.height;
    } else {
      player.y = Math.min(player.y, state.groundY - player.height);
    }
    buildSkyline();
  }

  function buildSkyline() {
    state.skyline = [];
    const count = Math.ceil(state.width / 70) + 4;
    for (let index = 0; index < count; index += 1) {
      state.skyline.push({
        x: index * 70 + rand(-20, 20),
        width: rand(28, 56),
        height: rand(50, state.height * 0.28),
        lightSeed: Math.random(),
      });
    }
  }

  function queueAction(action) {
    if (action === "jump") keys.jumpQueued = true;
    if (action === "slide") keys.slideQueued = true;
    if (action === "dash") keys.dashQueued = true;
  }

  function handleKeyDown(event) {
    if (event.repeat) return;
    if (["Space", "ArrowUp", "KeyW"].includes(event.code)) {
      queueAction("jump");
      event.preventDefault();
    }
    if (["ArrowDown", "KeyS"].includes(event.code)) {
      queueAction("slide");
      event.preventDefault();
    }
    if (["ShiftLeft", "ShiftRight", "KeyD"].includes(event.code)) {
      queueAction("dash");
      event.preventDefault();
    }
    if (event.code === "Enter" && state.mode !== "playing") {
      resetGame();
    }
  }

  function bindTouchControls() {
    touchButtons.forEach(function (button) {
      const action = button.getAttribute("data-action");
      const trigger = function (event) {
        event.preventDefault();
        queueAction(action);
      };
      button.addEventListener("touchstart", trigger, { passive: false });
      button.addEventListener("mousedown", trigger);
    });
  }

  function updateUI() {
    ui.distance.textContent = Math.floor(state.distance) + "m";
    ui.pursuit.textContent = Math.floor(state.pursuitGap);
    ui.focus.textContent = Math.floor(state.focus) + "%";
    ui.hp.textContent = String(state.hp);
    ui.pursuitBar.style.width = clamp((320 - state.pursuitGap) / 320, 0, 1) * 100 + "%";
    ui.focusBar.style.width = clamp(state.focus / 100, 0, 1) * 100 + "%";
  }

  function spawnParticle(x, y, color, speedX, speedY, radius, life) {
    state.particles.push({ x, y, color, speedX, speedY, radius, life, maxLife: life });
  }

  function burst(x, y, palette, amount) {
    for (let index = 0; index < amount; index += 1) {
      const angle = rand(-Math.PI * 0.9, Math.PI * 0.2);
      const speed = rand(80, 360);
      spawnParticle(
        x,
        y,
        palette[Math.floor(rand(0, palette.length))],
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        rand(2, 5),
        rand(0.18, 0.55)
      );
    }
  }

  function createObstacle(kind, x) {
    const obstacle = { kind, x, hit: false };
    if (kind === "crate") {
      obstacle.y = state.groundY - 54;
      obstacle.width = 60;
      obstacle.height = 54;
      obstacle.color = "#d4804a";
    } else if (kind === "beam") {
      obstacle.y = state.groundY - 96;
      obstacle.width = 120;
      obstacle.height = 34;
      obstacle.color = "#ff6b7d";
    } else if (kind === "drone") {
      obstacle.y = state.groundY - 174;
      obstacle.width = 70;
      obstacle.height = 44;
      obstacle.float = rand(0, Math.PI * 2);
      obstacle.color = "#8ab5ff";
    } else if (kind === "shock") {
      obstacle.y = state.groundY - 18;
      obstacle.width = 96;
      obstacle.height = 18;
      obstacle.color = "#f2ff7a";
    }
    state.obstacles.push(obstacle);
  }

  function createPickup(kind, x, y) {
    state.pickups.push({
      kind,
      x,
      y,
      width: 28,
      height: 28,
      pulse: Math.random() * Math.PI * 2,
    });
  }

  function spawnPattern() {
    const pattern = PATTERNS[Math.floor(rand(0, PATTERNS.length))];
    const startX = state.width + rand(150, 260);
    pattern.obstacles.forEach(function (entry) {
      createObstacle(entry.kind, startX + entry.offset);
    });
    if (pattern.pickup) {
      createPickup(pattern.pickup.kind, startX + pattern.pickup.offset, pattern.pickup.y);
    } else if (Math.random() < 0.3) {
      createPickup("cell", startX + rand(90, 180), rand(state.groundY - 210, state.groundY - 100));
    }
    const pace = clamp(state.distance / 380, 0, 7);
    state.spawnTimer = rand(0.72, 1.16) - pace * 0.04;
  }

  function activateJump() {
    const grounded = player.y >= state.groundY - player.height - 1;
    if (grounded) {
      player.vy = -player.jumpForce;
      player.jumpsLeft = 1;
      player.slideTimer = 0;
      burst(player.x + 18, state.groundY - 8, ["#65f3ff", "#ffffff"], 10);
      return;
    }
    if (player.jumpsLeft > 0) {
      player.vy = -player.jumpForce * 0.9;
      player.jumpsLeft -= 1;
      burst(player.x + 18, player.y + player.height * 0.6, ["#ff8b5c", "#ffffff"], 12);
    }
  }

  function activateSlide() {
    if (player.y < state.groundY - player.height - 4) return;
    player.slideTimer = 0.62;
  }

  function activateDash() {
    if (state.focus < 34 || player.dashTimer > 0) return;
    state.focus -= 34;
    player.dashTimer = 0.22;
    player.invulnerable = Math.max(player.invulnerable, 0.22);
    state.pursuitGap = clamp(state.pursuitGap + 16, 0, 320);
    state.flash = 0.26;
    burst(player.x + player.width, player.y + player.height * 0.5, ["#65f3ff", "#8ab5ff", "#ffffff"], 20);
  }

  function getPlayerBounds() {
    const sliding = player.slideTimer > 0 && player.y >= state.groundY - player.height - 1;
    if (sliding) {
      return { x: player.x - 4, y: state.groundY - 54, width: 66, height: 54 };
    }
    return { x: player.x, y: player.y, width: player.width, height: player.height };
  }

  function overlaps(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  function takeHit(reason) {
    if (player.invulnerable > 0 || state.mode !== "playing") return;
    state.hp -= 1;
    state.pursuitGap = clamp(state.pursuitGap - 82, 0, 320);
    player.invulnerable = 1.1;
    player.hitTimer = 0.35;
    state.shake = 16;
    state.flash = 0.35;
    burst(player.x + 20, player.y + 30, ["#ff476d", "#ffb76a", "#ffffff"], 28);

    if (reason === "shadow") {
      statusText.textContent = "추격 파동이 발끝에 닿았다";
    } else {
      statusText.textContent = "충격 발생, 속도가 떨어진다";
    }

    if (state.hp <= 0) {
      endGame("차체가 버티지 못했다", "충돌 누적으로 열차 외피가 붕괴했다.");
    }
  }

  function collectPickup(pickup) {
    state.focus = clamp(state.focus + 22, 0, 100);
    state.pursuitGap = clamp(state.pursuitGap + 24, 0, 320);
    state.distance += 8;
    pickup.collected = true;
    statusText.textContent = "에너지 셀 확보";
    burst(pickup.x + 10, pickup.y + 10, ["#c7ff7f", "#65f3ff", "#ffffff"], 14);
  }

  function shatterObstacle(obstacle) {
    obstacle.hit = true;
    state.pursuitGap = clamp(state.pursuitGap + 8, 0, 320);
    state.distance += 4;
    burst(obstacle.x + obstacle.width * 0.5, obstacle.y + obstacle.height * 0.5, ["#65f3ff", "#ffffff", "#8ab5ff"], 16);
    statusText.textContent = "대시 돌파 성공";
  }

  function endGame(title, copy) {
    state.mode = "gameover";
    ui.resultTitle.textContent = title;
    ui.resultCopy.textContent = copy;
    ui.resultDistance.textContent = Math.floor(state.distance) + "m";
    ui.resultRank.textContent = getRank(state.distance);
    gameoverOverlay.classList.add("active");
  }

  function getRank(distance) {
    if (distance >= 1800) return "S";
    if (distance >= 1300) return "A";
    if (distance >= 900) return "B";
    if (distance >= 550) return "C";
    return "D";
  }

  function update(dt) {
    if (state.mode !== "playing") return;

    state.time += dt;
    state.pulse += dt * 2.8;
    state.flash = Math.max(0, state.flash - dt);
    state.shake = Math.max(0, state.shake - dt * 28);

    const difficulty = clamp(state.distance / 240, 0, 11);
    state.worldSpeed = 360 + difficulty * 18 + (player.dashTimer > 0 ? 180 : 0);
    state.distance += state.worldSpeed * dt * 0.11;
    state.focus = clamp(state.focus + dt * 8.5, 0, 100);
    state.pursuitGap = clamp(state.pursuitGap - (17 + difficulty * 1.2) * dt, 0, 320);
    if (state.pursuitGap <= 16) {
      takeHit("shadow");
    }

    if (keys.jumpQueued) {
      activateJump();
      keys.jumpQueued = false;
    }
    if (keys.slideQueued) {
      activateSlide();
      keys.slideQueued = false;
    }
    if (keys.dashQueued) {
      activateDash();
      keys.dashQueued = false;
    }

    player.slideTimer = Math.max(0, player.slideTimer - dt);
    player.dashTimer = Math.max(0, player.dashTimer - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.hitTimer = Math.max(0, player.hitTimer - dt);

    player.vy += player.gravity * dt;
    player.y += player.vy * dt;

    if (player.y >= state.groundY - player.height) {
      player.y = state.groundY - player.height;
      player.vy = 0;
      player.jumpsLeft = 2;
    }

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnPattern();
    }

    const playerBounds = getPlayerBounds();

    state.obstacles.forEach(function (obstacle) {
      obstacle.x -= state.worldSpeed * dt;
      if (obstacle.kind === "drone") {
        obstacle.float += dt * 3.6;
      }
      if (obstacle.hit) return;
      const bounds = {
        x: obstacle.x,
        y: obstacle.kind === "drone" ? obstacle.y + Math.sin(obstacle.float) * 10 : obstacle.y,
        width: obstacle.width,
        height: obstacle.height,
      };
      if (!overlaps(playerBounds, bounds)) return;
      if (player.dashTimer > 0) {
        shatterObstacle(obstacle);
      } else {
        takeHit("impact");
      }
    });

    state.pickups.forEach(function (pickup) {
      pickup.x -= state.worldSpeed * dt;
      pickup.pulse += dt * 5;
      if (pickup.collected) return;
      const bounds = { x: pickup.x, y: pickup.y + Math.sin(pickup.pulse) * 6, width: pickup.width, height: pickup.height };
      if (overlaps(playerBounds, bounds)) {
        collectPickup(pickup);
      }
    });

    for (let index = state.particles.length - 1; index >= 0; index -= 1) {
      const particle = state.particles[index];
      particle.life -= dt;
      particle.x += particle.speedX * dt;
      particle.y += particle.speedY * dt;
      particle.speedY += 900 * dt;
      if (particle.life <= 0) {
        state.particles.splice(index, 1);
      }
    }

    state.obstacles = state.obstacles.filter(function (obstacle) {
      return obstacle.x + obstacle.width > -160 && !obstacle.remove;
    });

    state.pickups = state.pickups.filter(function (pickup) {
      return pickup.x + pickup.width > -120 && !pickup.collected;
    });

    if (state.distance > 1500) {
      statusText.textContent = "속도 한계 진입";
    } else if (state.distance > 850) {
      statusText.textContent = "터널 붕괴 심화";
    } else if (state.distance > 300) {
      statusText.textContent = "추격 속도 상승";
    }

    updateUI();
  }

  function drawBackground() {
    const horizon = state.height * 0.38;
    const floorHeight = state.height - state.groundY;

    const sky = ctx.createLinearGradient(0, 0, 0, state.height);
    sky.addColorStop(0, "#050816");
    sky.addColorStop(0.55, "#151531");
    sky.addColorStop(1, "#130d1f");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, state.width, state.height);

    ctx.save();
    ctx.globalAlpha = 0.24;
    const sweepX = (state.time * 160) % (state.width + 220);
    const warning = ctx.createLinearGradient(sweepX - 120, 0, sweepX + 120, 0);
    warning.addColorStop(0, "rgba(255, 71, 109, 0)");
    warning.addColorStop(0.5, "rgba(255, 71, 109, 0.34)");
    warning.addColorStop(1, "rgba(255, 71, 109, 0)");
    ctx.fillStyle = warning;
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.restore();

    state.skyline.forEach(function (building, index) {
      const speedOffset = ((state.distance * 0.18) + index * 17) % (state.width + 120);
      const x = state.width - speedOffset - building.width;
      const y = horizon - building.height;
      ctx.fillStyle = "rgba(15, 24, 45, 0.92)";
      ctx.fillRect(x, y, building.width, building.height);

      ctx.fillStyle = building.lightSeed > 0.44 ? "rgba(101, 243, 255, 0.42)" : "rgba(255, 210, 120, 0.25)";
      for (let row = 0; row < building.height / 16; row += 1) {
        if ((row + index) % 3 !== 0) continue;
        ctx.fillRect(x + 6, y + 6 + row * 14, Math.max(4, building.width - 12), 3);
      }
    });

    for (let line = 0; line < 14; line += 1) {
      const offset = ((state.distance * (0.8 + line * 0.05)) + line * 90) % (state.width + 200);
      const x = state.width - offset;
      ctx.strokeStyle = "rgba(140, 157, 205, 0.12)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, horizon);
      ctx.lineTo(x - 220, state.groundY);
      ctx.stroke();
    }

    const rail = ctx.createLinearGradient(0, state.groundY - 10, 0, state.height);
    rail.addColorStop(0, "#20172f");
    rail.addColorStop(1, "#090b13");
    ctx.fillStyle = rail;
    ctx.fillRect(0, state.groundY - 10, state.width, floorHeight + 20);

    for (let stripe = 0; stripe < 18; stripe += 1) {
      const x = state.width - (((state.distance * 2.6) + stripe * 120) % (state.width + 140));
      ctx.fillStyle = stripe % 2 === 0 ? "rgba(255,255,255,0.08)" : "rgba(101, 243, 255, 0.08)";
      ctx.fillRect(x, state.groundY + 34, 80, 4);
    }

    const fogWidth = clamp(380 - state.pursuitGap, 64, state.width * 0.56);
    const fog = ctx.createLinearGradient(0, 0, fogWidth, 0);
    fog.addColorStop(0, "rgba(255, 71, 109, 0.82)");
    fog.addColorStop(0.36, "rgba(255, 71, 109, 0.34)");
    fog.addColorStop(1, "rgba(255, 71, 109, 0)");
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, fogWidth, state.height);
  }

  function drawObstacle(obstacle) {
    const bob = obstacle.kind === "drone" ? Math.sin(obstacle.float) * 10 : 0;
    const x = obstacle.x;
    const y = obstacle.y + bob;

    if (obstacle.kind === "crate") {
      ctx.fillStyle = obstacle.hit ? "rgba(212, 128, 74, 0.2)" : obstacle.color;
      ctx.fillRect(x, y, obstacle.width, obstacle.height);
      ctx.strokeStyle = "rgba(36, 19, 8, 0.55)";
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 2, y + 2, obstacle.width - 4, obstacle.height - 4);
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 8);
      ctx.lineTo(x + obstacle.width - 8, y + obstacle.height - 8);
      ctx.moveTo(x + obstacle.width - 8, y + 8);
      ctx.lineTo(x + 8, y + obstacle.height - 8);
      ctx.stroke();
    } else if (obstacle.kind === "beam") {
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.fillRect(x, y, obstacle.width, obstacle.height);
      ctx.fillStyle = obstacle.hit ? "rgba(255, 107, 125, 0.18)" : obstacle.color;
      ctx.fillRect(x, y + 8, obstacle.width, 10);
      ctx.strokeStyle = "rgba(255, 215, 225, 0.85)";
      ctx.lineWidth = 2;
      for (let segment = 0; segment < 7; segment += 1) {
        const start = x + segment * 18;
        ctx.beginPath();
        ctx.moveTo(start, y + 13);
        ctx.lineTo(start + 9, y + 4 + Math.sin(state.time * 24 + segment) * 4);
        ctx.lineTo(start + 18, y + 13);
        ctx.stroke();
      }
    } else if (obstacle.kind === "drone") {
      ctx.fillStyle = obstacle.hit ? "rgba(138, 181, 255, 0.18)" : obstacle.color;
      ctx.beginPath();
      ctx.roundRect(x, y, obstacle.width, obstacle.height, 12);
      ctx.fill();
      ctx.fillStyle = "#f4f7ff";
      ctx.fillRect(x + 10, y + 12, obstacle.width - 20, 8);
      ctx.fillStyle = "rgba(101, 243, 255, 0.2)";
      ctx.beginPath();
      ctx.moveTo(x + obstacle.width * 0.5 - 10, y + obstacle.height);
      ctx.lineTo(x + obstacle.width * 0.5 + 34, state.groundY - 8);
      ctx.lineTo(x + obstacle.width * 0.5 - 34, state.groundY - 8);
      ctx.closePath();
      ctx.fill();
    } else if (obstacle.kind === "shock") {
      ctx.fillStyle = obstacle.hit ? "rgba(242, 255, 122, 0.18)" : "rgba(242, 255, 122, 0.8)";
      ctx.fillRect(x, y, obstacle.width, obstacle.height);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let segment = 0; segment < 5; segment += 1) {
        const px = x + segment * 18;
        ctx.moveTo(px, y + obstacle.height);
        ctx.lineTo(px + 7, y + 2);
      }
      ctx.stroke();
    }
  }

  function drawPickup(pickup) {
    const y = pickup.y + Math.sin(pickup.pulse) * 6;
    ctx.save();
    ctx.translate(pickup.x + pickup.width * 0.5, y + pickup.height * 0.5);
    ctx.rotate(state.time * 2.4);
    ctx.fillStyle = "rgba(199, 255, 127, 0.16)";
    ctx.fillRect(-18, -18, 36, 36);
    ctx.fillStyle = "#c7ff7f";
    ctx.fillRect(-10, -10, 20, 20);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-3, -14, 6, 28);
    ctx.fillRect(-14, -3, 28, 6);
    ctx.restore();
  }

  function drawPlayer() {
    const sliding = player.slideTimer > 0 && player.y >= state.groundY - player.height - 1;
    const dash = player.dashTimer > 0;
    const hit = player.hitTimer > 0;
    const baseY = sliding ? state.groundY - 54 : player.y;
    const bodyHeight = sliding ? 54 : player.height;
    const bodyWidth = sliding ? 66 : player.width;

    if (dash) {
      for (let trail = 0; trail < 5; trail += 1) {
        ctx.fillStyle = "rgba(101, 243, 255," + (0.15 - trail * 0.025) + ")";
        ctx.fillRect(player.x - trail * 24, baseY + 12, bodyWidth, bodyHeight - 12);
      }
    }

    ctx.save();
    if (hit) {
      ctx.globalAlpha = 0.55 + Math.sin(state.time * 42) * 0.3;
    }
    ctx.fillStyle = dash ? "#dffcff" : "#f4f7ff";
    ctx.beginPath();
    ctx.roundRect(player.x, baseY, bodyWidth, bodyHeight, 14);
    ctx.fill();

    ctx.fillStyle = "#151b31";
    ctx.fillRect(player.x + 12, baseY + 14, bodyWidth - 24, bodyHeight - 26);

    ctx.fillStyle = dash ? "#65f3ff" : "#ff8b5c";
    ctx.beginPath();
    ctx.arc(player.x + bodyWidth - 14, baseY + 18, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#65f3ff";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(player.x + 10, baseY + bodyHeight - 8);
    ctx.lineTo(player.x - 10, baseY + bodyHeight + 16);
    ctx.moveTo(player.x + bodyWidth - 14, baseY + bodyHeight - 10);
    ctx.lineTo(player.x + bodyWidth + 10, baseY + bodyHeight + 14);
    if (!sliding) {
      ctx.moveTo(player.x + 16, baseY + 44);
      ctx.lineTo(player.x - 6, baseY + 62);
      ctx.moveTo(player.x + bodyWidth - 16, baseY + 42);
      ctx.lineTo(player.x + bodyWidth + 12, baseY + 58);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    state.particles.forEach(function (particle) {
      ctx.save();
      ctx.globalAlpha = particle.life / particle.maxLife;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawHudEffects() {
    if (state.flash > 0) {
      ctx.fillStyle = "rgba(255, 71, 109, " + state.flash * 0.22 + ")";
      ctx.fillRect(0, 0, state.width, state.height);
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(22, 22, 220, 42);
    ctx.fillStyle = "#f4f7ff";
    ctx.font = '700 14px "Oxanium", sans-serif';
    ctx.fillText("SPEED " + Math.floor(state.worldSpeed), 38, 48);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 2;
    ctx.strokeRect(28, 78, 164, 10);
    ctx.fillStyle = "rgba(101, 243, 255, 0.8)";
    ctx.fillRect(30, 80, clamp(state.focus / 100, 0, 1) * 160, 6);
  }

  function render() {
    ctx.save();
    ctx.clearRect(0, 0, state.width, state.height);
    if (state.shake > 0) {
      ctx.translate(rand(-state.shake, state.shake), rand(-state.shake, state.shake) * 0.45);
    }

    drawBackground();
    state.obstacles.forEach(drawObstacle);
    state.pickups.forEach(drawPickup);
    drawPlayer();
    drawParticles();
    drawHudEffects();
    ctx.restore();
  }

  let lastTime = 0;
  function loop(timestamp) {
    const delta = Math.min(0.033, (timestamp - lastTime) / 1000 || 0.016);
    lastTime = timestamp;
    update(delta);
    render();
    window.requestAnimationFrame(loop);
  }

  startButton.addEventListener("click", resetGame);
  restartButton.addEventListener("click", resetGame);
  document.addEventListener("keydown", handleKeyDown);
  window.addEventListener("resize", resize);
  bindTouchControls();
  resize();
  updateUI();
  render();
  window.requestAnimationFrame(loop);
})();
