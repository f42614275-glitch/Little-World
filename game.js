const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const startScreen = document.querySelector("#welcome");
const finishScreen = document.querySelector("#finish");
const startButton = document.querySelector("#start-button");
const playAgainButton = document.querySelector("#play-again");
const starCount = document.querySelector("#star-count");
const objectiveText = document.querySelector("#objective-text");
const hint = document.querySelector("#hint");
const music = document.getElementById("backgroundMusic");
const endingMusic = document.getElementById("endingMusic");
const musicToggle = document.getElementById("musicToggle");
const musicVolume = document.getElementById("musicVolume");

const TILE = 32;
const WORLD_W = 48;
const WORLD_H = 36;
const DISCOVERY_RADIUS = 30;

let height = 0;
let scale = 1;
let elapsed = 0;
let playing = false;
let playerMoving = false;
let width = 0;
let lastTime = 0;
let found = 0;

const keys = new Set();

/* for future update reference these are the player stats */
const player = {
    x: 7 * TILE,
    y: 7 * TILE,
    size: 18,
    speed: 170,
    face: "down",
    walkTime: 0
};

const camera = { x: 0, y: 0 }; /* camera position */
const monster = {
    x: 40 * TILE,
    y: 30 * TILE,
    speed: 160,
    active: false,
    path: [],
    pathTarget: -1
};

let world = [];
let stars = [];
let starBursts = [];
let flowers = [];
let stones = [];
let pond = {
    x: 32 * TILE,
    y: 15 * TILE,
    width: 6 * TILE,
    height: 4 * TILE
};
let treasureChest = {
    x: 20 * TILE,
    y: 12 * TILE,
    opened: false,
    massageShown: false
};
let chestSparkles = [];
let natureParticles = [];
let discoveries = [];
let discoveriesFound = 0;

function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    canvas.width = Math.round(width * dpr);
    height = canvas.clientHeight; /* fullscreen */
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.max(0.65, Math.min(width / 960, height / 620));
}

function randomFrom(seed) {
    let n = seed >>> 0;
    return () => {
        n = (n * 1664525 + 1013904223) >>> 0; /* **NEED TO BE VERIFIED** */
        return n / 4294967296;
    };
}

function startGame() {
    resetGame();
    playing = true;
    monster.active = true;
    startScreen.classList.add("hidden");
    lastTime = performance.now();
    endingMusic.pause();
    playBackgroundMusic();
}

function buildWorld() {
    const random = randomFrom(81921);
    world = [];
    flowers = [];
    stones = [];

    for (let y = 0; y < WORLD_H; y++) {
        const row = [];
        for (let x = 0; x < WORLD_W; x++) {
            const edge = x === 0 || y === 0 || x === WORLD_W - 1 || y === WORLD_H - 1;
            let tile = edge ? 1 : 0;
            if (!edge && random() < 0.055) tile = 2;
            if (!edge && random() < 0.025) tile = 3;
            row.push(tile);

            if (!edge && tile === 0 && random() < 0.11) {
                flowers.push({
                    x: x * TILE + 7 + random() * 18,
                    y: y * TILE + 7 + random() * 18,
                    color: ["#e9c66b", "#d98d91", "#d5d8a0", "#b9c7df"][Math.floor(random() * 4)]
                });
            }
            if (!edge && tile === 0 && random() < 0.018) {
                stones.push({ x: x * TILE + 4, y: y * TILE + 4, size: 8 + random() * 8 });
            }
        }
        world.push(row);
    }

    // makking a clear path in middle
    for (let x = 12; x < 36; x++) {
        world[17][x] = 0;
        if (x % 3 !== 0) world[18][x] = 0;
    }

    // stone ruin
    for (let y = 14; y < 21; y++) {
        for (let x = 22; x < 27; x++) {
            if ((x === 22 || x === 25) && (y === 14 || y === 20)) continue;
            if ((x + y) % 3 !== 0) world[y][x] = 3;
        }
    }

    // location of stars (randomness in future update)
    stars = [
        { x: 11 * TILE, y: 11 * TILE, found: false },
        { x: 33 * TILE, y: 9 * TILE, found: false },
        { x: 14 * TILE, y: 28 * TILE, found: false },
        { x: 39 * TILE, y: 26 * TILE, found: false },
        { x: 30 * TILE, y: 25 * TILE, found: false },
    ];

    //particles
    const particleRandom = randomFrom(24681);
    natureParticles = [];
    
    for (let i = 0; i < 16; i++) {
        natureParticles.push({
            x: particleRandom() * WORLD_W * TILE,
            y: particleRandom() * WORLD_H * TILE,
            phase: particleRandom() * Math.PI * 2,
            size: particleRandom() < 0.7 ? 2 : 3,
            leaf: particleRandom() < 0.4
        });
    }

    // discoveries
    discoveries = [
        {
            x: 13 * TILE + TILE / 2,
            y: 17 * TILE + TILE / 2,
            found: false,
            message: "Someone planted flowers here long ago."
        }
    ];
}

function playBackgroundMusic() {
    music.volume = Number(musicVolume.value);
    music.play()
        .then(() => {
            musicToggle.textContent = "Music: On";
        })
        .catch(error => {
            console.error("Could not play background music", error);
        });
}

musicToggle.addEventListener("click", () => {
    if (music.paused) {
        endingMusic.pause();
        playBackgroundMusic();
    } else {
        music.pause();
        musicToggle.textContent = "Music: Off";
    }
});

musicVolume.addEventListener("input", () => {
    const volume = Number(musicVolume.value);
    music.volume = volume;
    endingMusic.volume = volume;
});

music.volume = Number(musicVolume.value);
endingMusic.volume = Number(musicVolume.value);

function resetGame () {
    player.x = 7 * TILE;
    player.y = 7 * TILE;
    player.walkTime = 0;
    found = 0;
    discoveriesFound = 0;
    discoveries.forEach(item => item.found = false);
    elapsed = 0;
    player.face = "down";
    stars.forEach(star => star.found = false);
    const monsterSpawn = nearestWalkablePosition(40 * TILE, 30 * TILE);
    monster.x = monsterSpawn.x;
    monster.y = monsterSpawn.y;
    monster.active = false;
    monster.path = [];
    monster.pathTarget = -1;
    starCount.textContent = "0";
    objectiveText.textContent = "Find those twinkly things";
    hint.textContent = "Move with WASD or arrow keys";
    finishScreen.classList.add("hidden");
}

function tileAt (px, py) {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return 1;
    return world[ty][tx];
}

function nearestWalkablePosition(px, py) {
    let nearest = null;
    let nearestDistance = Infinity;

    for (let y = 0; y < WORLD_H; y++) {
        for (let x = 0; x < WORLD_W; x++) {
            if (world[y][x] !== 0) continue;
            const centerX = (x + 0.5) * TILE;
            const centerY = (y + 0.5) * TILE;
            const distance = Math.hypot(centerX - px, centerY - py);
            if (distance < nearestDistance) {
                nearest = { x: centerX, y: centerY };
                nearestDistance = distance;
            }
        }
    }

    return nearest || { x: px, y: py };
}

function blocked(px, py) {
    const r = player.size * 0.35;
    return tileAt(px - r, py - r) !== 0 ||
    tileAt(px + r, py - r) !== 0 ||
    tileAt(px - r, py + r) !== 0 ||
    tileAt(px + r, py + r) !== 0;
    const pondLeft = pond.x;
    const pondTop = pond.y;
    const pondRight = pond.x + pond.width;
    const pondBottom = pond.y + pond.height;

    if (
        x + 8 > pondLeft &&
        x - 8 < pondRight &&
        y + 8 > pondTop &&
        y - 8 < pondBottom 
    ) {
        return true;
    }
}

function monsterBlocked(px, py) {
    const radius = 10;
    return [tileAt(px - radius, py - radius), tileAt(px + radius, py - radius),
        tileAt(px - radius, py + radius), tileAt(px + radius, py + radius)]
        .some(tile => tile !== 0);
}

function findMonsterPath(startX, startY, targetX, targetY) {
    const start = startY * WORLD_W + startX;
    const target = targetY * WORLD_W + targetX;
    const previous = new Int32Array(WORLD_W * WORLD_H).fill(-1);
    const queue = [start];
    previous[start] = start;

    for (let head = 0; head < queue.length && previous[target] === -1; head++) {
        const current = queue[head];
        const x = current % WORLD_W;
        const y = Math.floor(current / WORLD_W);
        const neighbors = [
            [x - 1, y],
            [x + 1, y],
            [x, y - 1],
            [x, y + 1]
        ];

        for (const [nextX, nextY] of neighbors) {
            if (nextX < 0 || nextY < 0 || nextX >= WORLD_W || nextY >= WORLD_H) continue;
            const next = nextY * WORLD_W + nextX;
            if (previous[next] !== -1 || world[nextY][nextX] !== 0) continue;
            previous[next] = current;
            queue.push(next);
        }
    }

    if (previous[target] === -1) return [];

    const path = [];
    for (let cell = target; cell !== start; cell = previous[cell]) {
        path.push({
            x: (cell % WORLD_W + 0.5) * TILE,
            y: (Math.floor(cell / WORLD_W) + 0.5) * TILE
        });
    }
    path.push({
        x: (startX + 0.5) * TILE,
        y: (startY + 0.5) * TILE
    });
    return path.reverse();
}

// keys to move player
function movePlayer(dx, dy, dt) {
    const length = Math.hypot(dx, dy);
    playerMoving = length > 0;
    if (!length) return;

    dx /= length;
    dy /= length;

    const stepX = dx * player.speed * dt;
    const stepY = dy * player.speed * dt;

    if (dx < 0) player.face = "left";
    if (dx > 0) player.face = "right";
    if (dy < 0) player.face = "up";
    if (dy > 0) player.face = "down";

    if (!blocked(player.x + stepX, player.y)) player.x += stepX;
    if (!blocked(player.x, player.y + stepY)) player.y += stepY;
    player.walkTime += dt * 10;
}

let starAudio;

function playStarSound() {
    const Audio = window.AudioContext || window.AudioContext;
    if (!Audio) return;

    if (!starAudio) starAudio = new Audio();
    if (starAudio.state === "suspended") starAudio.resume();

    const now = starAudio.currentTime;
    const notes = [880, 1174.66, 1567.98];

    notes.forEach((frequency, i) => {
        const oscillator = starAudio.createOscillator();
        const gain = starAudio.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, now + i * 0.055);

        gain.gain.setValueAtTime(0.0001, now + i * 0.055);
        gain.gain.exponentialRampToValueAtTime(0.12, now + i * 0.055 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.055 + 0.22);

        oscillator.connect(gain);
        gain.connect(starAudio.destination);

        oscillator.start(now + i * 0.055);
        oscillator.stop(now + i * 0.055 + 0.23);
    });
}

function update(dt) {
    if (!playing) return;
    elapsed += dt;

    let dx = 0;
    let dy = 0;
    if (keys.has("arrowleft") || keys.has("a")) dx--;
    if (keys.has("arrowup") || keys.has("w")) dy--;
    if (keys.has("arrowright") || keys.has("d")) dx++;
    if (keys.has("arrowdown") || keys.has("s")) dy++;

    movePlayer(dx, dy, dt);

    let canDiscover = false;
    for (const item of discoveries) {
        if (item.found) continue;

        const distance = Math.hypot(
            player.x - item.x,
            player.y - item.y
        );

        if (distance < DISCOVERY_RADIUS) {
            hint.textContent = "Press E to discover";
            canDiscover = true;
        }
    }
    if (!canDiscover && hint.textContent === "Press E to discover") {
        hint.textContent = "Move with WASD or arrow keys";
    }

    for (const star of stars) {
        if (star.found) continue;
        if (Math.hypot(player.x - star.x, player.y - star.y) < 24) {
            star.found = true;
            playStarSound();
            starBursts.push({
                x: star.x,
                y: star.y,
                start: performance.now()
            });
            found++;
            starCount.textContent = String(found);
            objectiveText.textContent = found === stars.length ? "All stars found!" : "Keep looking around";
            hint.textContent = found === stars.length ? "The lost world is glowing again" : "You found a star";
            if (found === stars.length) {
                playing = false;
                finishScreen.classList.remove("hidden");
                finishScreen.classList.add("celebration");

                let endingMessage = finishScreen.querySelector("#ending-message");

                if (!endingMessage) {
                    endingMessage = document.createElement("p");
                    endingMessage.id = "ending-message";
                    finishScreen.prepend(endingMessage);
                }

                endingMessage.textContent = "You found every star. The planet shines again.";

                let endingStats = finishScreen.querySelector("#ending-stats");

                if (!endingStats) {
                    endingStats = document.createElement("p");
                    endingStats.id = "ending-stats";
                    endingMessage.after(endingStats);
                }
                
                endingStats.textContent = `Adventure Complete · ${found}/${stars.length} stars collected`;

                music.pause();
                endingMusic.currentTime = 0;
                endingMusic.play()
                    .then(() => {
                        musicToggle.textContent = "Music: On";
                    })
                    .catch(error => {
                        console.error("Could not play ending music", error);
                    });
            }
        }
    }

    if (monster.active && playing) {
        const startX = Math.floor(monster.x / TILE);
        const startY = Math.floor(monster.y / TILE);
        const targetX = Math.floor(player.x / TILE);
        const targetY = Math.floor(player.y / TILE);
        const target = targetY * WORLD_W + targetX;

        if (monster.pathTarget !== target) {
            monster.path = findMonsterPath(startX, startY, targetX, targetY);
            monster.pathTarget = target;
        }

        while (monster.path.length > 0 &&
            Math.hypot(monster.path[0].x - monster.x, monster.path[0].y - monster.y) < 2) {
            monster.path.shift();
        }

        if (monster.path.length > 0) {
            const waypoint = monster.path[0];
            const dx = waypoint.x - monster.x;
            const dy = waypoint.y - monster.y;
            const distance = Math.hypot(dx, dy);
            const step = Math.min(monster.speed * dt, distance);
            const nextX = monster.x + dx / distance * step;
            const nextY = monster.y + dy / distance * step;

            if (!monsterBlocked(nextX, monster.y)) monster.x = nextX;
            if (!monsterBlocked(monster.x, nextY)) monster.y = nextY;
        }

        if (Math.hypot(player.x - monster.x, player.y - monster.y) < 21) {
            player.x = 7 * TILE;
            player.y = 7 * TILE;
            player.face = "down";

            const monsterSpawn = nearestWalkablePosition(40 * TILE, 30 * TILE);
            monster.x = monsterSpawn.x;
            monster.y = monsterSpawn.y;
            monster.path = [];
            monster.pathTarget = -1;

            hint.textContent = "Abhijeet caught you! Run away!";
        }
    }

    const viewW = width / scale;
    const viewH = height / scale;
    camera.x = Math.max(0, Math.min(WORLD_W * TILE - viewW, player.x - viewW / 2));
    camera.y = Math.max(0, Math.min(WORLD_H * TILE - viewH, player.y - viewH / 2));
}

function drawTile(x, y, tile) {
    const px = x * TILE;
    const py = y * TILE;
    if (tile === 1) {
        ctx.fillStyle = "#294b43";
        ctx.fillRect
        (px, py, TILE, TILE);
        ctx.fillStyle = "#355c4d";
        ctx.fillRect(px + 2, py + 2, TILE - 4, 5);
    } else {
        ctx.fillStyle = ((x * 13 + y * 7) % 5 === 0) ? "#6f9b68" : "#79a66e";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#2a573a1f";
        if ((x + y) % 4 === 0) ctx.fillRect(px + 4, py + 8, 3, 3);
        if ((x * 3 + y) % 7 === 0) ctx.fillRect(px + 23, py + 22, 2, 4);
        if (tile === 2) {
            ctx.fillStyle = "#5e8d61";
            ctx.fillRect(px + 4, py + 5, 24, 22);
            ctx.fillStyle = "#477751";
            ctx.fillRect(px + 7, py + 2, 17, 20);
            ctx.fillStyle = "#6f9b68";
            ctx.fillRect(px + 10, py + 6, 4, 3);
        }
        if (tile === 3) {
            ctx.fillStyle = "#7f8c7c";
            ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
            ctx.fillStyle = "#a0a58c";
            ctx.fillRect(px + 4, py + 4, TILE - 8, 5);
            ctx.fillStyle = "#69786f";
            ctx.fillRect(px + 5, py + 13, TILE - 10, 13);
        }
    }
}

function drawStar(x, y, time) {
    const bob = Math.sin(time * 2.5 + x) * 3;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.shadowColor = "#ffe99a";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#ffe28a";
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + i * Math.PI / 5;
        const radius = i % 2 === 0 ? 10 : 4.5;
        const sx = Math.cos(angle) * radius;
        const sy = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function drawPlayer(time) {
    const step = playerMoving ? Math.sin(player.walkTime) : 0;
    const bob = playerMoving? Math.abs(step) * 1.2
    : Math.sin(time * 0.002) * 0.7;

    const x = Math.round(player.x);
    const y = Math.round(player.y + bob);
    const armSwing = playerMoving ? step * 2 : 0;
    const legSwing = playerMoving ? step * 2 : 0;

    ctx.fillStyle = "#19302747";
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    //legs
    ctx.fillStyle = "#344039";
    ctx.fillRect(x - 6, y + 8 + legSwing, 5, 5);
    ctx.fillRect(x + 1, y + 8 - legSwing, 5, 5);

    //arms
    ctx.fillStyle = "#e9c6a2";
    ctx.fillRect(x - 10, y - 1 + armSwing, 3, 7);
    ctx.fillRect(x + 7, y - 1 - armSwing, 3, 7);

    //body
    ctx.fillStyle = "#314d49";
    ctx.fillRect(x - 8, y + 1, 16, 9);
    ctx.fillStyle = "#d7e0bd";
    ctx.fillRect(x - 5, y + 3, 10, 3);

    //head and rest 
    ctx.fillStyle = "#e9c6a2";
    ctx.fillRect(x - 7, y - 11, 14, 14);
    ctx.fillStyle = "#5a493b"
    ctx.fillRect(x - 8, y - 14, 16, 6);
    ctx.fillRect(x - 6, y - 17, 12, 5);
    ctx.fillStyle = "#344039";

    if (player.face === "left") {
        ctx.fillRect(x - 6, y - 5, 2, 2);
    } else if (player.face === "right") {
        ctx.fillRect(x + 4, y - 5, 2, 2);
    } else if (player.face === "up") {
        ctx.fillStyle = "#5a493b";
        ctx.fillRect(x - 5, y - 7, 10, 3);
    } else {
        ctx.fillRect(x - 4, y - 5, 2, 2);
        ctx.fillRect(x + 2, y - 5, 2, 2);
    }
}

function render(time) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#294c43";
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-Math.floor(camera.x), -Math.floor(camera.y));

    const viewW = width / scale;
    const viewH = height / scale;
    const startX = Math.max(0, Math.floor(camera.x / TILE));
    const startY = Math.max(0, Math.floor(camera.y / TILE));
    const endX = Math.min(WORLD_W, Math.ceil((camera.x + viewW) / TILE) + 1);
    const endY = Math.min(WORLD_H, Math.ceil((camera.y + viewH) / TILE) + 1);

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            drawTile(x, y, world[y][x]);
        }
    }

    const px = pond.x;
    const py = pond.y;

    ctx.fillStyle = "#315b50";
    ctx.fillRect(px + 8, py, pond.width - 16, pond.height);
    ctx.fillRect(px, py + 8, pond.width, pond.height - 16);
    ctx.fillRect(px + 4, py + 4, pond.width - 8, pond.height - 8);

    ctx.fillStyle = "#347f91";
    ctx.fillRect(px + 8, py + 8, pond.width - 16, pond.height - 16);
    ctx.fillRect(px + 8, py + 12, pond.width - 8, pond.height - 24);

    ctx.fillStyle = "#58a6ad";
    ctx.fillRect(px + 16, py + 16, pond.width - 32, pond.height - 32);
    const sparkle = Math.sin(time * 0.004) * 2;
    ctx.fillStyle = "#c3f3d5";
    ctx.fillRect(px + 35, py + 20 + sparkle, 3, 3);
    ctx.fillRect(px + 105, py + 65 - sparkle, 3, 3);
    ctx.fillRect(px + 65, py + 85 + sparkle, 3, 3);

    ctx.fillStyle = "#34745a";
    ctx.fillRect(px + 22, py + 20, 13, 7);
    ctx.fillRect(px + 24, py + 17, 7, 3);
    ctx.fillRect(px + 75, py + 48, 14, 8)
    ctx.fillRect(px + 80, py + 45, 7, 3);
    ctx.fillRect(px + 43, py + 75, 12, 7);
    ctx.fillRect(px + 46, py + 72, 6, 3);
    ctx.fillStyle = "#f5c8df";
    ctx.fillRect(px + 29, py + 19, 3, 3);
    ctx.fillStyle = "#fff0b8";
    ctx.fillRect(px + 30, py + 20, 1, 1);

    const cx = treasureChest.x;
    const cy = treasureChest.y;

    ctx.fillStyle = "#141e1940";
    ctx.fillRect(cx - 10, cy + 7, 22, 5);
    ctx.fillStyle = "#795039";
    ctx.fillRect(cx - 10, cy - 5, 20, 13);
    ctx.fillStyle = "#a56c43";
    ctx.fillRect(cx - 10, cy - 5, 20, 5);
    ctx.fillStyle = "#f2c65d";
    ctx.fillRect(cx - 10, cy - 6, 20, 2);
    ctx.fillRect(cx - 2, cy - 2, 4, 6);
    
    if (treasureChest.opened) {
        ctx.fillStyle = "#795039"
        ctx.fillRect(cx - 9, cy - 11, 18, 5);
        ctx.fillStyle = "#f8dc82";
        ctx.fillRect(cx - 5, cy - 15, 10, 3);

        chestSparkles = chestSparkles.filter(p => p.life > 0);

        for (const p of chestSparkles) {
            p.x += p.vx * 0.016;
            p.y += p.vy * 0.016;
            p.life -= 0.016;

            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = "#ffe58a";
            ctx.fillRect(p.x , p.y, 3, 3);
        }
        ctx.globalAlpha
    }

    for (const flower of flowers) {
        if (flower.x < camera.x - 10 || flower.x > camera.x + viewW + 10) continue;
        if (flower.y < camera.y - 10 || flower.y > camera.y + viewH + 10) continue;

        const sway = Math.sin(time * 0.002 + flower.x) * 1.5;

        ctx.fillStyle = "#416c4c";
        ctx.fillRect(flower.x + 2, flower.y + 3, 2, 6);

        ctx.fillStyle = flower.color;
        ctx.fillRect(flower.x + sway, flower.y, 5, 5);
        ctx.fillRect(flower.x + 3 + sway, flower.y + 3, 2, 6);
        
        ctx.fillStyle = "#f4e7b0";
        ctx.fillRect(flower.x + 2 + sway, flower.y + 2, 2, 2);
    }

    for (const particle of natureParticles) {
        const driftX = Math.sin(time * 0.0005 + particle.phase) * 5;
        const drifty = Math.sin(time * 0.0004 + particle.phase) * 7;
        const x = particle.x + driftX;
        const y = particle.y + drifty;

        if (x < camera.x - 10 || x > camera.x + viewW + 10) continue;
        if (y < camera.y - 10 || y > camera.y + viewH + 10) continue;

        ctx.fillStyle = particle.leaf ? "#c5d99a" : "#e6e8b5";

        if (particle.leaf) {
            ctx.fillRect(x, y, particle.size + 1, particle.size);
            ctx.fillRect(x + 1, y - 1, particle.size, 1);
        } else {
            ctx.fillRect(x, y, particle.size, particle.size);
        }
    }

    for (const stone of stones) {
        ctx.fillStyle = "#557a5a";
        ctx.fillRect(stone.x, stone.y, stone.size, stone.size * .65);
        ctx.fillStyle = "#6d9168";
        ctx.fillRect(stone.x + 2, stone.y + 1, stone.size * .5, 2);
    }

    for (const star of stars) {
        if (!star.found) drawStar(star.x, star.y, time / 1000);
    }

    starBursts = starBursts.filter(burst => {
        const age = (time - burst.start) / 1000;
        if (age >= 0.45) return false;

        const distance = age * 30;
        const opacity = 1 - age / 0.45;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = "#ffe99a";

        for (let i = 0; i < 8; i++) {
            const angle = i * Math.PI / 4;
            const x = burst.x + Math.cos(angle) * distance;
            const y = burst.y + Math.sin(angle) * distance;

            ctx.fillRect(Math.round(x), Math.round(y), 3, 3);
        }

        ctx.restore();
        return true;
    });

    for (const item of discoveries) {
        if (item.found) continue;
        
        const pulse = (Math.sin(time * 0.004) + 1) / 2;
        const glow = 10 + pulse * 14;
        const size = 4 + pulse * 4;

        ctx.save();

        ctx.shadowColor = "#b9ff91";
        ctx.shadowBlur = glow;

        ctx.fillStyle = "#b9e7a1";
        ctx.fillRect(
            item.x - size,
            item.y - size,
            size * 2,
            size * 2
        );


        ctx.shadowBlur = glow / 2;
        ctx.fillStyle = "#efffc2";
        ctx.fillRect(item.x - 2, item.y - 2, 4, 4);

        ctx.restore();
    }

    if (monster.active) {
        const bob = Math.sin(time * 0.008) * 2;
        const x = Math.round(monster.x);
        const y = Math.round(monster.y + bob);

        ctx.fillStyle = "#12191b4d"
        ctx.fillRect(x - 12, y + 9, 24, 5);

        const wiggle = Math.sin(time * 0.012) * 2;

        ctx.fillStyle = "#263239";
        ctx.fillRect(x - 10, y - 9, 20, 18);
        ctx.fillRect(x - 13, y - 5 + wiggle, 5, 10);
        ctx.fillRect(x + 8, y - 5 - wiggle, 5, 10);
        
        ctx.fillStyle = "#111d25";
        ctx.fillRect(x - 7, y - 13, 14, 7);
        ctx.fillRect(x - 7, y + 7 + wiggle, 5, 5);
        ctx.fillRect(x + 2, y + 7 - wiggle, 5, 5);

        ctx.fillStyle = "#ff6b70";
        ctx.fillRect(x - 6, y - 5, 4, 4);
        ctx.fillRect(x + 3, y - 5, 4, 4);

        ctx.fillStyle = "#ffe5a1";
        ctx.fillRect(x - 5, y - 5, 2, 2);
        ctx.fillRect(x + 4, y - 5, 2, 2);
    }
    
      drawPlayer(time);
  ctx.restore();

  const shade = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * .15, width / 2, height / 2, Math.max(width, height) * .7);
  shade.addColorStop(0, "rgba(7, 22, 23, 0)");
  shade.addColorStop(1, "rgba(7, 22, 23, .28)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);

}

function frame(time) {
    const dt = Math.min((time - lastTime) / 1000 || 0, 0.04);
    lastTime = time;
    update(dt);
    render(time);
    requestAnimationFrame(frame);
}

window.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    if (key === "e" && playing) {
        for (const item of discoveries) {
            if (item.found) continue;

            const distance = Math.hypot(
                player.x - item.x,
                player.y - item.y
            );

            if (distance < DISCOVERY_RADIUS) {
                item.found = true;
                discoveriesFound++;
                hint.textContent = item.message;
                objectiveText.textContent = "Secrets found:" + discoveriesFound;
                break;
            }
        }
    }
    if (key.toLowerCase()=== "e" && playing) {
        const distance = Math.hypot(
            player.x - treasureChest.x,
            player.y - treasureChest.y,
        );

        if (distance < 48 && !treasureChest.opened) {
            treasureChest.opened = "true";
            treasureChest.massageShown = true;
            hint.textContent = "Damn! You found an ancient treasure";

            for (let i = 0; i < 12; i++) {
                chestSparkles.push({
                    x: treasureChest.x,
                    y: treasureChest.y,
                    vx: (Math.random() - 0.5) * 100,
                    vy: (Math.random() + 0.5) * 100,
                    life: 1
                });
            }
        }
    }
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
        keys.add(key);
    }
    if (key === "enter" && !playing && startScreen.classList.contains("hidden") && finishScreen.classList.contains("hidden")) {
        startGame();
    }
});

window.addEventListener("keyup", event => keys.delete(event.key.toLowerCase()));
window.addEventListener("blur", () => keys.clear());
window.addEventListener("resize", resize);

startButton.addEventListener("click", startGame);
playAgainButton.addEventListener("click", startGame);

buildWorld();
resize();
camera.x = 0;
camera.y = 0;
requestAnimationFrame(frame);