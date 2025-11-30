// SIGNAL ROOM MAIN LOGIC (C build)

const slider = document.getElementById("stateSlider");
const stateLabel = document.getElementById("stateLabel");
const stateValue = document.getElementById("stateValue");
const beamFill = document.getElementById("beamFill");

const pulseNote = document.getElementById("pulseNote");
const logPulseBtn = document.getElementById("logPulseBtn");
const lastLogged = document.getElementById("lastLogged");
const pulseTone = document.getElementById("pulseTone");
const pulseHistory = document.getElementById("pulseHistory");
const clearPulsesBtn = document.getElementById("clearPulsesBtn");

const streakValue = document.getElementById("streakValue");
const resetStreakBtn = document.getElementById("resetStreakBtn");

const modeButtons = document.querySelectorAll(".sr-mode-button");
const modeTitle = document.getElementById("modeTitle");
const modeTag = document.getElementById("modeTag");
const missionList = document.getElementById("missionList");
const rerollMissionsBtn = document.getElementById("rerollMissionsBtn");

const rollBarBtn = document.getElementById("rollBarBtn");
const copyBarBtn = document.getElementById("copyBarBtn");
const lockBarBtn = document.getElementById("lockBarBtn");
const micBar = document.getElementById("micBar");
const barMood = document.getElementById("barMood");
const lockedBars = document.getElementById("lockedBars");

const audioToggle = document.getElementById("audioToggle");
const audioStatusDot = document.getElementById("audioStatusDot");
const audioStatusLabel = document.getElementById("audioStatusLabel");

const bgCanvas = document.getElementById("srBackground");

const STORAGE_KEY = "signalRoom.state.v2";
const STREAK_KEY = "signalRoom.streak.v2";
const PULSE_KEY = "signalRoom.pulses.v2";
const BARS_KEY = "signalRoom.lockedBars.v2";
const MIC_LOCK_KEY = "signalRoom.lastBar.v2";

let currentMode = null;
let missionsData = null;
let audioActive = false;

// ---- Helpers

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function mapStateLabel(val) {
  if (val <= 10) return "Flatline → spark";
  if (val <= 25) return "Low but aware";
  if (val <= 45) return "Warming up";
  if (val <= 65) return "Dialed and ready";
  if (val <= 85) return "Charged, stay clean";
  return "Overdrive — breathe and aim";
}

function classifyTone(text) {
  const lower = text.toLowerCase();
  const hypeWords = ["up", "ready", "lit", "energy", "go", "charged", "focus"];
  const lowWords = ["tired", "drained", "low", "empty", "stuck", "lost"];
  const aggroWords = ["angry", "rage", "pissed", "mad", "fight"];

  let score = 0;

  hypeWords.forEach((w) => {
    if (lower.includes(w)) score += 1;
  });
  lowWords.forEach((w) => {
    if (lower.includes(w)) score -= 1;
  });
  aggroWords.forEach((w) => {
    if (lower.includes(w)) score -= 0.5;
  });

  if (score >= 1) return "Lifted";
  if (score <= -1) return "Heavy";
  if (text.trim().length < 6) return "Flat";
  return "Mixed";
}

function updateBeam(val, audioBoost = 0) {
  const baseRatio = clamp(val / 100, 0, 1);
  const boosted = clamp(baseRatio + audioBoost * 0.5, 0, 1);
  beamFill.style.transform = `scaleX(${boosted.toFixed(2)})`;

  const glowStrength = 0.25 + boosted * 0.75;
  beamFill.style.filter = `drop-shadow(0 0 14px rgba(255,180,90,${glowStrength.toFixed(
    2
  )}))`;

  const app = document.getElementById("app");
  const blue = 21 + Math.round(boosted * 16);
  const red = 7 + Math.round(boosted * 30);
  app.style.boxShadow =
    `0 32px 70px rgba(0,0,0,0.9), ` +
    `0 0 0 1px rgba(255,255,255,0.03), ` +
    `0 0 90px rgba(${red},${blue},60,${0.24 + boosted * 0.28})`;
}

function applyState(val, fromAudio) {
  const v = Number(val || 0);
  slider.value = v;
  stateValue.textContent = `${v}%`;
  stateLabel.textContent = mapStateLabel(v);

  const audioBoost = fromAudio ? fromAudio : 0;
  updateBeam(v, audioBoost);
}

function saveState() {
  const data = {
    stateValue: Number(slider.value),
    lastMode: currentMode,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ---- State slider

slider.addEventListener("input", (e) => {
  const value = Number(e.target.value);
  applyState(value);
  saveState();
});

// ---- Missions

async function loadMissions() {
  try {
    const res = await fetch("assets/missions.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    missionsData = await res.json();
  } catch (err) {
    console.warn("Signal Room: missions.json failed, using fallback.", err);
    missionsData = {
      hype: [
        "Send one voice note hyping a friend for something real they did.",
        "Shake out your body for 20 seconds, then hit one avoided task.",
        "Put on one track that lifts you and move for the length of the hook.",
        "Write down one win from this week and screenshot it.",
      ],
      focus: [
        "Close all tabs except the one that actually moves you forward.",
        "Write the next 3 moves you need to make. Do the first.",
        "Mute one noisy app for the next hour.",
        "Pick something you can finish in 5 minutes and clear it.",
      ],
      drift: [
        "Step outside for 3 minutes and only notice sound, light and air.",
        "Put your phone face down for one full song.",
        "Breathe in 4, hold 4, out 6 — repeat 6 times.",
        "Choose one thought you don’t need tonight and let it pass.",
      ],
    };
  }
}

function pickRandom(array, count) {
  const arr = [...array];
  const out = [];
  for (let i = 0; i < count && arr.length; i++) {
    const idx = Math.floor(Math.random() * arr.length);
    out.push(arr.splice(idx, 1)[0]);
  }
  return out;
}

function setMode(mode, rerollOnly) {
  if (!missionsData) return;

  currentMode = mode;
  modeButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });

  let title = "";
  let tag = "";
  if (mode === "hype") {
    title = "Hype mode. Lift the ceiling.";
    tag = "Short, sharp moves that push your energy up without burning you out.";
  } else if (mode === "focus") {
    title = "Focus mode. Cut the noise.";
    tag = "Trim the static, tighten the frame, move one thing forward.";
  } else if (mode === "drift") {
    title = "Night drift. Safe low altitude.";
    tag = "Wind down without spiralling down. Gentle, calm, still sharp.";
  }

  if (!rerollOnly) {
    modeTitle.textContent = title;
    modeTag.textContent = tag;
  }

  const source = missionsData[mode] || [];
  const items = pickRandom(source, 3);
  missionList.innerHTML = "";
  items.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = "• " + text;
    missionList.appendChild(li);
  });

  if (!rerollOnly) {
    incrementStreak();
    saveState();
  }
}

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.mode;
    setMode(mode);
  });
});

rerollMissionsBtn.addEventListener("click", () => {
  if (!currentMode || !missionsData) return;
  setMode(currentMode, true);
});

// ---- Mic bar generator

const bars = [
  {
    text: "I'm just sitting still^ till my field refills^ and the outside static chills_.",
    mood: "Calm but loaded.",
  },
  {
    text: "If the room goes flat_, I lift the graph^ till doubt can’t do the maths_.",
    mood: "Edge + clarity.",
  },
  {
    text: "You stay scrolling_, I stay strolling^ above the noise you’re patrolling_.",
    mood: "Light flex.",
  },
  {
    text: "I don’t chase the wave_, I pace the wave^ till it knows my name_.",
    mood: "Quiet authority.",
  },
  {
    text: "Low state, high sight^—I see the drop before the night_.",
    mood: "Watchful.",
  },
  {
    text: "If my vibe goes dim_, I tune back in^ instead of faking a grin_.",
    mood: "Honest check-in.",
  },
  {
    text: "My lane is thin^ but the height is wild^, I keep my edge like a middle child_.",
    mood: "Restless focus.",
  },
  {
    text: "I turn my doubt^ into signal routes^ and let my future pick the routes_.",
    mood: "Future-facing.",
  },
];

function rollBar() {
  const idx = Math.floor(Math.random() * bars.length);
  const { text, mood } = bars[idx];
  micBar.textContent = text;
  barMood.textContent = "Mood: " + mood;
  localStorage.setItem(MIC_LOCK_KEY, JSON.stringify({ text, mood }));
}

rollBarBtn.addEventListener("click", rollBar);

copyBarBtn.addEventListener("click", async () => {
  const text = micBar.textContent.trim();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    barMood.textContent = "Copied to clipboard.";
    setTimeout(() => {
      const saved = localStorage.getItem(MIC_LOCK_KEY);
      if (saved) {
        const obj = JSON.parse(saved);
        barMood.textContent = "Mood: " + (obj.mood || "set");
      } else {
        barMood.textContent = "Mood: idle";
      }
    }, 2000);
  } catch (e) {
    barMood.textContent = "Clipboard blocked — copy manually.";
  }
});

lockBarBtn.addEventListener("click", () => {
  const text = micBar.textContent.trim();
  if (!text) return;
  const saved = JSON.parse(localStorage.getItem(BARS_KEY) || "[]");
  if (!saved.includes(text)) {
    saved.unshift(text);
    if (saved.length > 12) saved.pop();
    localStorage.setItem(BARS_KEY, JSON.stringify(saved));
    renderLockedBars(saved);
  }
});

function renderLockedBars(list) {
  lockedBars.innerHTML = "";
  if (!list || !list.length) {
    const li = document.createElement("li");
    li.textContent = "No locked lines yet.";
    li.className = "opacity-70";
    lockedBars.appendChild(li);
    return;
  }
  list.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = "• " + text;
    lockedBars.appendChild(li);
  });
}

// ---- Pulses

logPulseBtn.addEventListener("click", () => {
  const text = pulseNote.value.trim();
  if (!text) return;

  const tone = classifyTone(text);
  const entry = {
    text,
    at: new Date().toISOString(),
    tone,
  };

  const list = JSON.parse(localStorage.getItem(PULSE_KEY) || "[]");
  list.unshift(entry);
  if (list.length > 20) list.pop();
  localStorage.setItem(PULSE_KEY, JSON.stringify(list));

  pulseNote.value = "";
  pulseTone.textContent = "Tone: " + tone;

  updateLastLogged(entry);
  renderPulseHistory(list);
});

clearPulsesBtn.addEventListener("click", () => {
  localStorage.removeItem(PULSE_KEY);
  pulseHistory.innerHTML = "";
  lastLogged.textContent = "No pulses logged yet.";
  pulseTone.textContent = "Tone: —";
});

function updateLastLogged(entry) {
  const time = new Date(entry.at);
  lastLogged.textContent =
    "Last pulse: " +
    time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
    " — \"" +
    (entry.text.length > 52 ? entry.text.slice(0, 49) + "..." : entry.text) +
    "\"";
}

function renderPulseHistory(list) {
  pulseHistory.innerHTML = "";
  if (!list || !list.length) return;
  list.forEach((entry) => {
    const li = document.createElement("li");
    const time = new Date(entry.at);
    li.textContent =
      time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
      " · [" +
      entry.tone +
      "] " +
      (entry.text.length > 60 ? entry.text.slice(0, 57) + "..." : entry.text);
    pulseHistory.appendChild(li);
  });
}

// ---- Streak

function loadStreak() {
  const raw = localStorage.getItem(STREAK_KEY);
  const value = raw ? Number(raw) || 0 : 0;
  streakValue.textContent = value;
}

function incrementStreak() {
  const raw = localStorage.getItem(STREAK_KEY);
  const value = (raw ? Number(raw) || 0 : 0) + 1;
  localStorage.setItem(STREAK_KEY, String(value));
  streakValue.textContent = value;
}

resetStreakBtn.addEventListener("click", () => {
  localStorage.setItem(STREAK_KEY, "0");
  loadStreak();
});

// ---- Persisted state

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (typeof data.stateValue === "number") {
      applyState(data.stateValue);
    }
    if (data.lastMode) {
      currentMode = data.lastMode;
      setMode(data.lastMode);
    }
  } catch (e) {
    console.warn("Signal Room: corrupted state, ignoring.");
  }
}

function loadPulses() {
  const raw = localStorage.getItem(PULSE_KEY);
  if (!raw) return;
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || !list.length) return;
    renderPulseHistory(list);
    updateLastLogged(list[0]);
    pulseTone.textContent = "Tone: " + (list[0].tone || "—");
  } catch (e) {
    console.warn("Signal Room: corrupted pulses.");
  }
}

function loadBars() {
  const raw = localStorage.getItem(BARS_KEY);
  const list = raw ? JSON.parse(raw) : [];
  renderLockedBars(list);

  const last = localStorage.getItem(MIC_LOCK_KEY);
  if (last) {
    try {
      const obj = JSON.parse(last);
      if (obj.text) {
        micBar.textContent = obj.text;
        barMood.textContent = "Mood: " + (obj.mood || "set");
      }
    } catch {
      // ignore
    }
  } else {
    rollBar();
  }
}

// ---- Audio reactive

function attachAudioReactive() {
  if (!window.SignalAudio) return;
  if (audioActive) {
    // turn off
    audioActive = false;
    window.SignalAudio.stop();
    audioStatusDot.classList.remove("active");
    audioStatusLabel.textContent = "Mic-reactive: off";
    applyState(Number(slider.value));
    return;
  }

  audioActive = true;
  audioStatusLabel.textContent = "Mic-reactive: on";
  audioStatusDot.classList.add("active");

  window.SignalAudio.start((level) => {
    const sliderVal = Number(slider.value);
    applyState(sliderVal, level);
  });
}

audioToggle.addEventListener("click", attachAudioReactive);

// ---- Background particles

function initBackground() {
  if (!bgCanvas) return;
  const ctx = bgCanvas.getContext("2d");
  let width = (bgCanvas.width = window.innerWidth);
  let height = (bgCanvas.height = window.innerHeight);

  const particles = [];
  const count = 60;

  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 0.6 + Math.random() * 1.4,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      a: Math.random() * Math.PI * 2,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#05070b";
    ctx.fillRect(0, 0, width, height);

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.a += 0.002;
      p.y += Math.sin(p.a) * 0.08;

      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;
      if (p.y < -10) p.y = height + 10;
      if (p.y > height + 10) p.y = -10;

      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 8);
      gradient.addColorStop(0, "rgba(255,255,255,0.4)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 8, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  draw();

  window.addEventListener("resize", () => {
    width = bgCanvas.width = window.innerWidth;
    height = bgCanvas.height = window.innerHeight;
  });
}

// ---- Init

(async function init() {
  applyState(Number(slider.value));
  initBackground();
  loadStreak();
  await loadMissions();
  loadState();
  loadPulses();
  loadBars();
})();
