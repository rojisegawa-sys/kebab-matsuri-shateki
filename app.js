const STORAGE_KEY = "kebab-matsuri-shateki-v1";
const AMMO_PER_RUN = 1;
const todayKey = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });

const prizeFiles = [
  "お薬を持つケバブ.png",
  "こっちを見るケバブ.png",
  "ぷっくりシールのケバブ.png",
  "キラキラシールのケバブ.png",
  "グラビア撮影をするケバブ.png",
  "センターで踊るケバブ.png",
  "マカオの富豪ケバブ.png",
  "ロン毛のケバブ.png",
  "海の中のケバブ.png",
  "漂着したケバブ.png",
  "生家の前に立つケバブ.png",
  "素手で太鼓を叩くケバブ.png"
];

const prizeClassNames = [
  "prize-sticker",
  "prize-gold",
  "prize-mystery",
  "prize-light",
  "prize-hit",
  "prize-miss",
  "prize-cursed",
  "prize-lamp",
  "prize-cat",
  "prize-robot",
  "prize-card",
  "prize-bag"
];

const prizeScores = [80, 110, 130, 150, 170, 190, 210, 230, 250, 270, 300, 340];
const cards = prizeFiles.map((fileName) => fileName.replace(/\.[^.]+$/, ""));
const prizes = cards.map((name, index) => ({
  name,
  className: prizeClassNames[index],
  score: prizeScores[index]
}));

const againPromos = [
  { image: "./assets/again/again-01.png", url: "https://today-naru.vercel.app/" },
  { image: "./assets/again/again-02.png", url: "https://today-naru.vercel.app/" }
];

const PRIZE_SPAWN_INTERVAL_MS = 860;
const PRIZE_TRAVEL_MS = 4200;
const TARGET_LANE_RATIO = 0.78;
const AGAIN_VIEW_DURATION_MS = 6000;
const BGM_SRC = "./assets/audio/bgm.wav";
const COLLECTION_BGM_SRC = "./assets/audio/獲得景品一覧.mp3";
const READY_SFX_SRC = "./assets/audio/拳銃をチャッと構える.mp3";
const SHOTGUN_SFX_SRC = "./assets/audio/ショットガン発射.mp3";
const CHIME_SFX_SRC = "./assets/audio/チーン2.mp3";
const REWARD_SFX_SRC = "./assets/audio/きらきら輝く4.mp3";
const MISS_SFX_SRC = "./assets/audio/夏の山2.mp3";
const MISS_IMAGE_SRC = "./assets/prizes/ハズレ.JPG";
const BGM_VOLUME = 0.18;
const SFX_VOLUME = 0.9;
const FILE_SFX_VOLUME = 0.95;

const state = loadState();
let currentRun = null;
let targetFrame = null;

const els = {
  dailyStatus: document.querySelector("#dailyStatus"),
  ammoCount: document.querySelector("#ammoCount"),
  collectionCount: document.querySelector("#collectionCount"),
  kebabLine: document.querySelector("#kebabLine"),
  targets: document.querySelector("#targets"),
  hitZone: document.querySelector("#hitZone"),
  crosshair: document.querySelector("#crosshair"),
  playButton: document.querySelector("#playButton"),
  adButton: document.querySelector("#adButton"),
  bookButton: document.querySelector("#bookButton"),
  homeButton: document.querySelector("#homeButton"),
  bookHomeButton: document.querySelector("#bookHomeButton"),
  bookAudioButton: document.querySelector("#bookAudioButton"),
  homeScreen: document.querySelector("#homeScreen"),
  gameScreen: document.querySelector("#gameScreen"),
  topImage: document.querySelector("#topImage"),
  posterFallback: document.querySelector("#posterFallback"),
  topFreeButton: document.querySelector("#topFreeButton"),
  topAdButton: document.querySelector("#topAdButton"),
  topBookButton: document.querySelector("#topBookButton"),
  topOtherButton: document.querySelector("#topOtherButton"),
  book: document.querySelector("#book"),
  cards: document.querySelector("#cards"),
  shootButton: document.querySelector("#shootButton"),
  reloadButton: document.querySelector("#reloadButton"),
  resultLog: document.querySelector("#resultLog"),
  scoreValue: document.querySelector("#scoreValue"),
  bestValue: document.querySelector("#bestValue"),
  resultDialog: document.querySelector("#resultDialog"),
  dialogLabel: document.querySelector("#dialogLabel"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogText: document.querySelector("#dialogText"),
  rewardCard: document.querySelector("#rewardCard"),
  imageDialog: document.querySelector("#imageDialog"),
  imageDialogTitle: document.querySelector("#imageDialogTitle"),
  imageDialogImage: document.querySelector("#imageDialogImage"),
  againDialog: document.querySelector("#againDialog"),
  againLink: document.querySelector("#againLink"),
  againImage: document.querySelector("#againImage"),
  againMeter: document.querySelector("#againMeter"),
  againText: document.querySelector("#againText"),
  audioButton: document.querySelector("#audioButton")
};

const audio = {
  context: null,
  master: null,
  bgmElement: null,
  bgmSrc: "",
  fileSounds: new Map()
};

function loadState() {
  const fallback = {
    lastFreePlayDate: "",
    adTickets: 0,
    collection: [],
    playCount: 0,
    bestScore: 0,
    audioMuted: false
  };

  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function hasFreePlay() {
  return state.lastFreePlayDate !== todayKey;
}

function render() {
  const owned = new Set(state.collection);
  els.dailyStatus.textContent = hasFreePlay() ? "未使用" : "使用済み";
  els.ammoCount.textContent = currentRun?.ammo ?? AMMO_PER_RUN;
  els.collectionCount.textContent = `${owned.size}/12`;
  els.playButton.disabled = !hasFreePlay() || Boolean(currentRun);
  els.adButton.disabled = Boolean(currentRun);
  els.topFreeButton.disabled = !hasFreePlay() || Boolean(currentRun);
  els.topAdButton.disabled = Boolean(currentRun);
  els.crosshair.disabled = !currentRun;
  els.shootButton.disabled = !currentRun;
  els.reloadButton.disabled = !currentRun;
  els.crosshair.classList.toggle("ready", Boolean(currentRun));
  els.playButton.textContent = hasFreePlay() ? "今日の無料分で遊ぶ" : "今日の無料分は使用済み";
  els.adButton.textContent = state.adTickets > 0 ? "再挑戦チケットで遊ぶ" : "広告を見てもう一度遊ぶ";
  els.scoreValue.textContent = formatScore(currentRun?.score ?? 0);
  els.bestValue.textContent = formatScore(state.bestScore);
  els.audioButton.textContent = state.audioMuted ? "音 OFF" : "音 ON";
  els.audioButton.setAttribute("aria-pressed", String(!state.audioMuted));
  els.audioButton.classList.toggle("is-muted", state.audioMuted);
  els.bookAudioButton.textContent = state.audioMuted ? "音 OFF" : "音 ON";
  els.bookAudioButton.setAttribute("aria-pressed", String(!state.audioMuted));
  renderCards();
}

function getAudioContext() {
  if (audio.context) return audio.context;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;

  audio.context = new AudioContext();
  audio.master = audio.context.createGain();
  audio.master.gain.value = state.audioMuted ? 0 : SFX_VOLUME;
  audio.master.connect(audio.context.destination);

  return audio.context;
}

function ensureAudio() {
  if (state.audioMuted) return;

  const context = getAudioContext();
  if (!context) return;

  if (context.state === "suspended") {
    context.resume();
  }

  startBgm();
}

function getCurrentBgmSrc() {
  return els.book.hidden ? BGM_SRC : COLLECTION_BGM_SRC;
}

function setAudioMuted(muted) {
  state.audioMuted = muted;
  saveState();

  if (audio.master) {
    audio.master.gain.cancelScheduledValues(audio.context.currentTime);
    audio.master.gain.setTargetAtTime(muted ? 0 : SFX_VOLUME, audio.context.currentTime, 0.03);
  }

  if (muted) {
    stopBgm();
  } else {
    ensureAudio();
    playSound("ui");
  }

  render();
}

function startBgm() {
  if (state.audioMuted || document.hidden) return;

  if (!audio.bgmElement) {
    audio.bgmElement = new Audio();
    audio.bgmElement.loop = true;
    audio.bgmElement.preload = "auto";
  }

  const nextSrc = getCurrentBgmSrc();
  if (audio.bgmSrc !== nextSrc) {
    audio.bgmElement.pause();
    audio.bgmElement.src = nextSrc;
    audio.bgmElement.currentTime = 0;
    audio.bgmSrc = nextSrc;
  }

  audio.bgmElement.volume = BGM_VOLUME;
  audio.bgmElement.play().catch(() => {
    // Browsers may reject playback until the next user gesture.
  });
}

function stopBgm() {
  audio.bgmElement?.pause();
}

function stopFileSound(src) {
  const sound = audio.fileSounds.get(src);
  if (!sound) return;

  sound.pause();
  sound.currentTime = 0;
}

function playFileSound(src, { volume = FILE_SFX_VOLUME, delay = 0 } = {}) {
  if (state.audioMuted) return;
  ensureAudio();

  const play = () => {
    let sound = audio.fileSounds.get(src);
    if (!sound) {
      sound = new Audio(src);
      sound.preload = "auto";
      audio.fileSounds.set(src, sound);
    }

    sound.pause();
    sound.currentTime = 0;
    sound.volume = volume;
    sound.play().catch(() => {
      // Browsers may reject playback until the next user gesture.
    });
  };

  if (delay > 0) {
    window.setTimeout(play, delay);
  } else {
    play();
  }
}

function playTone({ frequency, duration = 0.12, type = "square", gain = 0.12, destination = audio.master, delay = 0 }) {
  const context = getAudioContext();
  if (!context || state.audioMuted || !destination) return;

  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(gain, start + 0.015);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(envelope);
  envelope.connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playSound(name) {
  ensureAudio();

  if (name === "ui") {
    playTone({ frequency: 880, duration: 0.055, type: "sine", gain: 0.09 });
  } else if (name === "shoot") {
    playFileSound(SHOTGUN_SFX_SRC, { volume: 1 });
  } else if (name === "hit") {
    playTone({ frequency: 659.25, duration: 0.07, type: "square", gain: 0.15 });
    playTone({ frequency: 880, duration: 0.08, type: "square", gain: 0.15, delay: 0.07 });
    playTone({ frequency: 1174.66, duration: 0.14, type: "square", gain: 0.16, delay: 0.15 });
  } else if (name === "miss") {
    playFileSound(MISS_SFX_SRC, { volume: 0.95 });
  } else if (name === "reward") {
    playFileSound(REWARD_SFX_SRC, { volume: 0.95 });
  }
}

function formatScore(score) {
  return String(score).padStart(5, "0");
}

function getPrizeImageSrc(cardId) {
  const fileName = prizeFiles[cardId - 1];
  return fileName ? `./assets/prizes/${encodeURIComponent(fileName)}` : "";
}

function showScreen(screen) {
  document.body.dataset.screen = screen;
  els.homeScreen.hidden = screen !== "home";
  els.gameScreen.hidden = screen !== "game";
  els.book.hidden = screen !== "book";
  startBgm();
}

function showRoute(screen, options = {}) {
  if (!options.replaceHash) {
    ensureAudio();
    if (screen === "book" || screen === "home") {
      playFileSound(CHIME_SFX_SRC, { volume: 0.95 });
    } else {
      playSound("ui");
    }
  }
  showScreen(screen);
  if (options.replaceHash) {
    history.replaceState(null, "", options.replaceHash);
    return;
  }
  if (options.skipHash) return;

  const nextHash = screen === "book" ? "#collection" : "#home";
  if (window.location.hash !== nextHash) {
    history.pushState(null, "", nextHash);
  }
}

function restoreRoute() {
  showRoute(window.location.hash === "#collection" ? "book" : "home", {
    replaceHash: window.location.hash === "#collection" ? "#collection" : "#home"
  });
}

function renderCards() {
  const owned = new Set(state.collection);
  els.cards.innerHTML = cards.map((name, index) => {
    const id = index + 1;
    const isOwned = owned.has(id);
    const imageSrc = getPrizeImageSrc(id);
    return `
      <article class="card ${isOwned ? "" : "locked"}">
        <div class="card-art">
          ${isOwned ? `
            <button class="prize-preview-button" type="button" data-preview-id="${id}" aria-label="${name}を大きく見る">
              <img class="collection-prize-image" src="${imageSrc}" alt="${name}" style="object-fit: contain !important;">
            </button>
          ` : ""}
        </div>
        <strong>${isOwned ? name : "未獲得"}</strong>
      </article>
    `;
  }).join("");
}

function openPrizeImage(cardId) {
  const name = cards[cardId - 1];
  const imageSrc = getPrizeImageSrc(cardId);
  if (!name || !imageSrc) return;

  playSound("ui");
  els.imageDialogTitle.textContent = name;
  els.imageDialogImage.src = imageSrc;
  els.imageDialogImage.alt = name;
  if (!els.imageDialog.open) {
    els.imageDialog.showModal();
  }
}

function placeTargets() {
  els.targets.innerHTML = "";
}

function getPrizeForSpawn() {
  if (!currentRun) return prizes[0];
  const prize = prizes[currentRun.nextPrizeIndex % prizes.length];
  currentRun.nextPrizeIndex += 1;
  return prize;
}

function spawnTarget(now) {
  if (!currentRun) return;

  const target = document.createElement("div");
  const prize = getPrizeForSpawn();
  target.className = `target ${prize.className}`;
  target.dataset.prize = prize.name;
  target.dataset.prizeId = String(prizes.indexOf(prize) + 1);
  target.dataset.score = String(prize.score ?? 100);
  target.innerHTML = `<span>${prize.name}</span>`;
  els.targets.append(target);

  const lane = els.targets.getBoundingClientRect();
  const startX = lane.width + 22;
  const endX = -target.offsetWidth - 22;
  const laneY = Math.max(8, lane.height * TARGET_LANE_RATIO - target.offsetHeight / 2);

  target.style.top = `${laneY}px`;
  target.style.setProperty("--target-x", `${startX}px`);
  target.style.transform = `translate(${startX}px, 0)`;

  currentRun.targets.push({
    element: target,
    prize,
    startAt: now,
    startX,
    endX,
    travel: startX - endX,
    durationMs: PRIZE_TRAVEL_MS
  });
}

function startRun(source) {
  if (currentRun) return;

  ensureAudio();
  if (source === "free") {
    if (!hasFreePlay()) return;
    state.lastFreePlayDate = todayKey;
  } else if (state.adTickets > 0) {
    state.adTickets -= 1;
  } else {
    watchAd();
    return;
  }

  state.playCount += 1;
  currentRun = {
    ammo: AMMO_PER_RUN,
    score: 0,
    hits: 0,
    rewards: [],
    log: [],
    status: "moving",
    targets: [],
    nextPrizeIndex: Math.floor(Math.random() * prizes.length),
    lastSpawnAt: 0
  };
  saveState();
  showRoute("game", { skipHash: true });
  placeTargets();
  appendLog("○ 勝負開始。景品レーンを見ろ！");
  startMovingPrize();
  els.kebabLine.textContent = "お、やるか？ 景品が来たらスペースだ。";
  playFileSound(READY_SFX_SRC, { volume: 0.8 });
  render();
}

function startMovingPrize() {
  window.cancelAnimationFrame(targetFrame);
  placeTargets();
  currentRun.status = "moving";

  const step = (now) => {
    if (!currentRun || currentRun.status !== "moving") return;

    if (!currentRun.targets.length || now - currentRun.lastSpawnAt >= PRIZE_SPAWN_INTERVAL_MS) {
      spawnTarget(now);
      currentRun.lastSpawnAt = now;
    }

    currentRun.targets = currentRun.targets.filter((targetState) => {
      const progress = Math.min((now - targetState.startAt) / targetState.durationMs, 1);
      const x = targetState.startX - targetState.travel * progress;
      targetState.element.style.setProperty("--target-x", `${x}px`);
      targetState.element.style.transform = `translate(${x}px, 0)`;

      if (progress >= 1) {
        targetState.element.remove();
        return false;
      }
      return true;
    });

    targetFrame = window.requestAnimationFrame(step);
  };

  targetFrame = window.requestAnimationFrame(step);
}

function shoot() {
  if (!currentRun || currentRun.ammo <= 0 || currentRun.status !== "moving") return;

  playSound("shoot");
  currentRun.ammo -= 1;
  currentRun.status = "shot";
  els.crosshair.classList.add("fired");
  window.setTimeout(() => els.crosshair.classList.remove("fired"), 140);
  const hitTarget = findHitTarget();

  if (hitTarget) {
    hitTarget.classList.add("hit");
    const prizeName = hitTarget.dataset.prize ?? "景品";
    const prize = prizes.find((item) => item.name === prizeName) ?? prizes[0];
    const cardId = Number(hitTarget.dataset.prizeId ?? 1);
    const firstGet = !state.collection.includes(cardId);
    if (firstGet) state.collection.push(cardId);
    currentRun.hits += 1;
    currentRun.score += Number(hitTarget.dataset.score ?? prize.score ?? 100);
    currentRun.rewards.push(cardId);
    currentRun.targets = currentRun.targets.filter((targetState) => targetState.element !== hitTarget);
    window.setTimeout(() => hitTarget.remove(), 620);
    appendLog(`○ 大当り！${prize.name}をGET！`);
    saveState();
    els.kebabLine.textContent = firstGet
      ? `${prizeName}を落としたか。今日は運が良いかもなァ…`
      : `${prizeName}だ。同じカードも祭りのうちよ。`;
    playSound("hit");
  } else {
    appendLog("× ハズレ…残念！");
    els.kebabLine.textContent = "おっと、早いか遅いか。広告を見りゃ、もう一勝負だ。";
  }

  render();
  if (currentRun?.ammo > 0) {
    currentRun.status = "moving";
  } else {
    window.setTimeout(endRun, 420);
  }
}

function findHitTarget() {
  const cross = els.crosshair.getBoundingClientRect();
  const zone = els.hitZone.getBoundingClientRect();
  const hitBox = {
    left: Math.min(cross.left, zone.left),
    right: Math.max(cross.right, zone.right),
    top: Math.min(cross.top, zone.top),
    bottom: Math.max(cross.bottom, zone.bottom)
  };

  return [...document.querySelectorAll(".target:not(.hit)")].find((target) => {
    const rect = target.getBoundingClientRect();
    return (
      rect.left < hitBox.right &&
      rect.right > hitBox.left &&
      rect.top < hitBox.bottom &&
      rect.bottom > hitBox.top
    );
  });
}

function finishRun() {
  window.cancelAnimationFrame(targetFrame);
  currentRun = null;
  placeTargets();
  render();
}

function endRun() {
  if (!currentRun) return;
  window.cancelAnimationFrame(targetFrame);
  const finalScore = currentRun.score;
  const rewards = [...currentRun.rewards];
  if (finalScore > state.bestScore) state.bestScore = finalScore;
  saveState();
  currentRun = null;
  placeTargets();
  render();

  if (rewards.length) {
    showReward(rewards[rewards.length - 1], true);
  } else {
    showMiss();
  }
}

function appendLog(message) {
  if (!currentRun) return;
  currentRun.log.unshift(message);
  currentRun.log = currentRun.log.slice(0, 3);
  els.resultLog.innerHTML = currentRun.log.map((line) => `<p>${line}</p>`).join("");
}

function reloadPrize() {
  if (!currentRun || currentRun.status !== "moving") return;
  playSound("ui");
  currentRun.targets.forEach((targetState) => targetState.element.remove());
  currentRun.targets = [];
  currentRun.lastSpawnAt = 0;
  appendLog("↺ リロード。景品レーンを入れ替えた。");
}

function showReward(cardId, firstGet) {
  playSound("reward");
  els.dialogLabel.textContent = firstGet ? "新カード" : "カード獲得";
  els.dialogTitle.textContent = cards[cardId - 1];
  const imageSrc = getPrizeImageSrc(cardId);
  els.rewardCard.innerHTML = `
    <article class="card">
      <div class="card-art">
        <button class="prize-preview-button" type="button" data-preview-id="${cardId}" aria-label="${cards[cardId - 1]}を大きく見る">
          <img src="${imageSrc}" alt="${cards[cardId - 1]}" style="object-fit: cover;">
        </button>
      </div>
      <strong>${cards[cardId - 1]}</strong>
    </article>
  `;
  els.dialogText.textContent = firstGet
    ? "獲得景品一覧に追加されました。"
    : "すでに持っている景品です。";
  els.resultDialog.showModal();
}

function showMiss() {
  playSound("miss");
  els.dialogLabel.textContent = "はずれ";
  els.dialogTitle.textContent = "景品は落ちなかった";
  els.rewardCard.innerHTML = `
    <article class="card miss-card">
      <div class="card-art">
        <img src="${MISS_IMAGE_SRC}" alt="ハズレ">
      </div>
      <strong>ハズレ</strong>
    </article>
  `;
  els.dialogText.textContent = "今日の無料分はここまで。広告視聴で再挑戦できます。";
  els.resultDialog.showModal();
}

function watchAd() {
  ensureAudio();
  playFileSound(CHIME_SFX_SRC, { volume: 0.95 });
  const ad = againPromos[Math.floor(Math.random() * againPromos.length)];
  const imageUrl = new URL(ad.image, document.baseURI).href;
  els.againImage.onload = () => {
    els.againLink.classList.remove("has-load-error");
  };
  els.againImage.onerror = () => {
    els.againLink.classList.add("has-load-error");
    els.againText.textContent = `広告画像を読み込めませんでした: ${ad.image}`;
  };
  els.againImage.src = imageUrl;
  els.againImage.alt = "広告";
  if (ad.url) {
    els.againLink.href = ad.url;
    els.againLink.setAttribute("aria-label", "広告元サイトを開く");
    els.againLink.classList.remove("is-disabled");
  } else {
    els.againLink.removeAttribute("href");
    els.againLink.setAttribute("aria-label", "広告元URL未設定");
    els.againLink.classList.add("is-disabled");
  }
  els.againMeter.style.width = "0%";
  els.againText.textContent = ad.url
    ? "広告をタップまたはクリックすると広告元サイトを開きます。"
    : "広告元URLを設定するとタップまたはクリックでサイトを開けます。";
  els.againDialog.showModal();

  let progress = 0;
  const progressStep = 100 / (AGAIN_VIEW_DURATION_MS / 100);
  const timer = window.setInterval(() => {
    progress += progressStep;
    els.againMeter.style.width = `${progress}%`;

    if (progress >= 100) {
      window.clearInterval(timer);
      state.adTickets += 1;
      saveState();
      els.againText.textContent = "再挑戦できます。";
      window.setTimeout(() => {
        els.againDialog.close();
        startRun("ad");
      }, 550);
    }
  }, 320);
}

els.playButton.addEventListener("click", () => startRun("free"));
els.adButton.addEventListener("click", () => startRun("ad"));
els.audioButton.addEventListener("click", () => setAudioMuted(!state.audioMuted));
els.bookAudioButton.addEventListener("click", () => setAudioMuted(!state.audioMuted));
els.crosshair.addEventListener("click", shoot);
els.shootButton.addEventListener("click", shoot);
els.reloadButton.addEventListener("click", reloadPrize);
els.resultDialog.addEventListener("close", () => {
  stopFileSound(MISS_SFX_SRC);
});
document.addEventListener("keydown", (event) => {
  if (els.gameScreen.hidden || els.resultDialog.open || els.againDialog.open || els.imageDialog.open) return;
  if (event.code === "KeyR") {
    event.preventDefault();
    reloadPrize();
    return;
  }
  if (event.code !== "Space") return;
  event.preventDefault();
  shoot();
});
els.bookButton.addEventListener("click", () => showRoute("book"));
els.homeButton.addEventListener("click", () => showRoute("home"));
els.bookHomeButton.addEventListener("click", () => showRoute("home"));
els.cards.addEventListener("click", (event) => {
  const button = event.target.closest("[data-preview-id]");
  if (!button) return;
  openPrizeImage(Number(button.dataset.previewId));
});
els.rewardCard.addEventListener("click", (event) => {
  const button = event.target.closest("[data-preview-id]");
  if (!button) return;
  openPrizeImage(Number(button.dataset.previewId));
});
els.imageDialog.addEventListener("click", (event) => {
  if (event.target === els.imageDialog) {
    els.imageDialog.close();
  }
});
els.topFreeButton.addEventListener("click", () => startRun("free"));
els.topAdButton.addEventListener("click", () => startRun("ad"));
els.topBookButton.addEventListener("click", () => showRoute("book"));
els.topImage.addEventListener("load", () => {
  els.posterFallback.hidden = true;
  els.topImage.closest(".home-poster").classList.add("has-image");
});
els.topImage.addEventListener("error", () => {
  els.topImage.classList.add("is-missing");
  els.posterFallback.hidden = false;
  els.topImage.closest(".home-poster").classList.remove("has-image");
});
if (els.topImage.complete && els.topImage.naturalWidth === 0) {
  els.topImage.classList.add("is-missing");
  els.posterFallback.hidden = false;
} else if (els.topImage.complete && els.topImage.naturalWidth > 0) {
  els.posterFallback.hidden = true;
  els.topImage.closest(".home-poster").classList.add("has-image");
}

placeTargets();
window.addEventListener("popstate", restoreRoute);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopBgm();
  } else if (audio.context && audio.context.state === "running" && !state.audioMuted) {
    startBgm();
  }
});
restoreRoute();
render();
