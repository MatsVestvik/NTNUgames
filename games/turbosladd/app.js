/**
 * Turbosladd - Top-down 2D Racing & Drifting Game Engine
 * Features:
 * - Single standardized high-performance drift car with custom paint
 * - Addictive, responsive drift physics: slide easily around every corner
 * - Counter-steering stabilization, tire smoke, rubber skid marks & drift turbo boost
 * - High-performance pre-rendered offscreen track caching for solid 60 FPS
 * - Multi-device synchronization over /api/turbosladd/sync and Party Lounge bridge
 * - Immediate camera centering with forward look-ahead
 * - Highly responsive keyboard controls (Arrows, WASD, Space for handbrake)
 * - Web Audio procedural sound synthesizer (engine rev, drift screech, turbo burst)
 */

(() => {
  "use strict";

  // =========================================================================
  // CONSTANTS & PALETTE
  // =========================================================================

  const PALETTE = [
    { color: "#ef4444", name: "Rød Turbo" },
    { color: "#38bdf8", name: "Blå Lyn" },
    { color: "#10b981", name: "Grønn Fart" },
    { color: "#fbbf24", name: "Gul Sol" },
    { color: "#a855f7", name: "Lilla Flamme" },
    { color: "#f97316", name: "Oransje Ild" },
    { color: "#ec4899", name: "Rosa Rakett" },
    { color: "#06b6d4", name: "Cyan Drifter" },
    { color: "#84cc16", name: "Lime Stunt" },
    { color: "#6366f1", name: "Indigo Nitro" },
    { color: "#e11d48", name: "Karmosin" },
    { color: "#14b8a6", name: "Teal Racer" },
    { color: "#d946ef", name: "Fuchsia" },
    { color: "#eab308", name: "Gull Pokal" },
    { color: "#3b82f6", name: "Kongeblå" },
    { color: "#22c55e", name: "Smaragd" },
  ];

  // Single Standardized Drift Car Spec: Responsive, fast & drifty on ice
  const CAR_SPEC = {
    name: "Turbosladd GT",
    accel: 850,
    maxSpeed: 530,
    reverseSpeed: 210,
    turnSpeed: 3.9,
  };

  // =========================================================================
  // CATMULL-ROM SPLINE SMOOTH TRACK GENERATOR
  // =========================================================================

  function evalSplinePoint(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      x: 0.5 * (
        (2 * p1.x) +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
      ),
      y: 0.5 * (
        (2 * p1.y) +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
      ),
    };
  }

  function generateSmoothTrack(rawPoints, samplesPerSegment = 16) {
    const smoothPoints = [];
    const n = rawPoints.length;
    for (let i = 0; i < n; i++) {
      const p0 = rawPoints[(i - 1 + n) % n];
      const p1 = rawPoints[i];
      const p2 = rawPoints[(i + 1) % n];
      const p3 = rawPoints[(i + 2) % n];
      for (let s = 0; s < samplesPerSegment; s++) {
        const t = s / samplesPerSegment;
        smoothPoints.push(evalSplinePoint(p0, p1, p2, p3, t));
      }
    }
    return smoothPoints;
  }

  // Circuit 1: Grand Prix Banen - Wide, fast flowing track with sweeping turns
  const RAW_GP_POINTS = [
    { x: 500, y: 1500 },  // 0: Start / Finish line straight
    { x: 1200, y: 1500 }, // 1: Main straight
    { x: 1900, y: 1500 }, // 2: End of straight
    { x: 2350, y: 1300 }, // 3: Turn 1 sweep
    { x: 2450, y: 850 },  // 4: Turn 2 apex
    { x: 2200, y: 450 },  // 5: Turn 3 exit
    { x: 1700, y: 350 },  // 6: Back straight
    { x: 1150, y: 350 },  // 7: Back straight end
    { x: 750, y: 550 },   // 8: Chicane entry
    { x: 800, y: 850 },   // 9: Chicane apex
    { x: 1250, y: 950 },  // 10: Infield drift sweep
    { x: 1350, y: 1200 }, // 11: Hairpin entry
    { x: 1050, y: 1250 }, // 12: Hairpin apex
    { x: 700, y: 1150 },  // 13: Infield exit
    { x: 400, y: 1050 },  // 14: West curve
    { x: 200, y: 1250 },  // 15: Final turn entry
    { x: 250, y: 1450 },  // 16: Final turn exit into straight
  ];

  // Circuit 2: Fjordsvingen - Technical continuous drift track
  const RAW_FJORD_POINTS = [
    { x: 600, y: 1550 },  // 0: Start straight
    { x: 1250, y: 1550 }, // 1: Straight
    { x: 1900, y: 1550 }, // 2: High-speed sweep
    { x: 2350, y: 1300 }, // 3: Hairpin 1
    { x: 2100, y: 1000 }, // 4: Drift switch 1
    { x: 1450, y: 1000 }, // 5: Infield drift
    { x: 800, y: 1000 },  // 6: Hairpin 2
    { x: 500, y: 750 },   // 7: Chicane entry
    { x: 900, y: 550 },   // 8: S-curve
    { x: 1500, y: 550 },  // 9: Infield technical
    { x: 2100, y: 400 },  // 10: Hairpin 3
    { x: 1800, y: 180 },  // 11: Mountain apex
    { x: 1050, y: 180 },  // 12: High straight
    { x: 350, y: 220 },   // 13: Hairpin 4
    { x: 150, y: 650 },   // 14: Downhill sweep
    { x: 150, y: 1200 },  // 15: Final hairpin
    { x: 250, y: 1500 },  // 16: Return to main straight
  ];

  function createTrack(id, name, rawPoints, roadWidth = 185) {
    const smoothPoints = generateSmoothTrack(rawPoints, 16);
    return {
      id,
      name,
      roadWidth,
      rawPoints,
      points: smoothPoints,
      checkpoints: rawPoints,
      totalPoints: smoothPoints.length,
    };
  }

  const TRACKS = {
    grand_prix: createTrack("grand_prix", "Grand Prix Banen", RAW_GP_POINTS, 185),
    fjord_drift: createTrack("fjord_drift", "Fjordsvingen", RAW_FJORD_POINTS, 180),
  };

  // Staggered starting grid slots on the start straightaway
  function getStartGridSlots(track, count = 16) {
    const p0 = track.rawPoints[0];
    const p1 = track.rawPoints[1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const forwardX = dx / len;
    const forwardY = dy / len;
    const rightX = -forwardY;
    const rightY = forwardX;
    const angle = Math.atan2(dy, dx);

    const slots = [];
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / 2);
      const side = (i % 2 === 0) ? -1 : 1;
      const distBack = 50 + row * 90;
      const lateralOffset = side * 35;

      slots.push({
        x: p0.x - forwardX * distBack + rightX * lateralOffset,
        y: p0.y - forwardY * distBack + rightY * lateralOffset,
        angle: angle,
      });
    }
    return slots;
  }

  // =========================================================================
  // APP STATE
  // =========================================================================

  const state = {
    mode: "online", // "online" | "solo"
    driverName: localStorage.getItem("ts_driver_name") || "Sjåfør 1",
    driverColor: localStorage.getItem("ts_driver_color") || PALETTE[0].color,

    roomCode: "",
    playerId: "",
    hostToken: "",
    isHost: false,
    trackId: "grand_prix",
    laps: 3,
    maxPlayers: 4,

    roomStatus: "lobby", // "lobby" | "countdown" | "racing" | "finished"
    players: [],

    myCar: {
      x: 500,
      y: 1500,
      angle: 0,
      vx: 0,
      vy: 0,
      speed: 0,
      accelInput: 0,
      brakeInput: 0,
      steerInput: 0,
      handbrakeInput: 0,
      isDrifting: false,
      driftAngle: 0,
      driftBoostCharge: 0,
      turboTimer: 0,
      lap: 1,
      checkpoint: 0,
      finished: false,
      finishTime: 0,
      bestLap: 0,
      lapStartTime: 0,
      raceStartTime: 0,
    },

    opponentCars: {},
    camera: { x: 500, y: 1500, zoom: 1.25 },
    skidmarks: [],
    particles: [],

    keys: { up: false, down: false, left: false, right: false, space: false },

    animFrameId: null,
    syncTimerId: null,
    lobbyPollTimerId: null,

    soundEnabled: localStorage.getItem("ts_sound") !== "false",
    audioCtx: null,
    engineOsc: null,
    engineGain: null,
  };

  // =========================================================================
  // DOM REFERENCES
  // =========================================================================

  const el = {
    // Header
    btnHeaderBack: document.getElementById("btnHeaderBack"),
    backBtnText: document.getElementById("backBtnText"),
    btnAudioToggle: document.getElementById("btnAudioToggle"),
    iconSoundOn: document.getElementById("iconSoundOn"),
    iconSoundOff: document.getElementById("iconSoundOff"),
    btnHeaderLeave: document.getElementById("btnHeaderLeave"),

    // Views
    viewLobby: document.getElementById("viewLobby"),
    viewRoomLounge: document.getElementById("viewRoomLounge"),
    viewGame: document.getElementById("viewGame"),

    // Lobby
    tabOnline: document.getElementById("tabOnline"),
    tabSolo: document.getElementById("tabSolo"),
    tabSplitscreen: document.getElementById("tabSplitscreen"),
    panelOnline: document.getElementById("panelOnline"),
    panelSolo: document.getElementById("panelSolo"),
    panelSplitscreen: document.getElementById("panelSplitscreen"),
    btnGoToOnlineTab: document.getElementById("btnGoToOnlineTab"),

    inputDriverName: document.getElementById("inputDriverName"),
    carPreviewCanvas: document.getElementById("carPreviewCanvas"),
    tsColorPalette: document.getElementById("tsColorPalette"),

    selectTrack: document.getElementById("selectTrack"),
    controlLaps: document.getElementById("controlLaps"),
    controlMaxPlayers: document.getElementById("controlMaxPlayers"),
    btnCreateRace: document.getElementById("btnCreateRace"),
    inputRoomCode: document.getElementById("inputRoomCode"),
    btnJoinRace: document.getElementById("btnJoinRace"),

    selectSoloTrack: document.getElementById("selectSoloTrack"),
    controlSoloLaps: document.getElementById("controlSoloLaps"),
    btnStartSolo: document.getElementById("btnStartSolo"),

    // Room Lounge
    displayRoomCode: document.getElementById("displayRoomCode"),
    btnCopyCode: document.getElementById("btnCopyCode"),
    loungeTrackName: document.getElementById("loungeTrackName"),
    loungeLapsBadge: document.getElementById("loungeLapsBadge"),
    racersGrid: document.getElementById("racersGrid"),
    racersCountBadge: document.getElementById("racersCountBadge"),
    btnLeaveRoom: document.getElementById("btnLeaveRoom"),
    btnToggleReady: document.getElementById("btnToggleReady"),
    btnHostStartRace: document.getElementById("btnHostStartRace"),

    // Race In-Game
    raceCanvas: document.getElementById("raceCanvas"),
    minimapCanvas: document.getElementById("minimapCanvas"),
    hudPosNum: document.getElementById("hudPosNum"),
    hudPosSuffix: document.getElementById("hudPosSuffix"),
    hudLapText: document.getElementById("hudLapText"),
    driftMeterWrap: document.getElementById("driftMeterWrap"),
    driftMeterBar: document.getElementById("driftMeterBar"),
    driftMeterLabel: document.getElementById("driftMeterLabel"),
    hudCurrentTime: document.getElementById("hudCurrentTime"),
    hudBestLap: document.getElementById("hudBestLap"),
    hudSpeedNum: document.getElementById("hudSpeedNum"),
    btnQuitRace: document.getElementById("btnQuitRace"),
    countdownOverlay: document.getElementById("countdownOverlay"),
    countdownText: document.getElementById("countdownText"),

    // Podium Modal
    modalPodium: document.getElementById("modalPodium"),
    podiumTitle: document.getElementById("podiumTitle"),
    podiumDesc: document.getElementById("podiumDesc"),
    podiumStandings: document.getElementById("podiumStandings"),
    btnPodiumPlayAgain: document.getElementById("btnPodiumPlayAgain"),
    btnPodiumReturnLobby: document.getElementById("btnPodiumReturnLobby"),
  };

  // =========================================================================
  // AUDIO SYNTHESIZER
  // =========================================================================

  function initAudio() {
    if (!state.audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      state.audioCtx = new AudioCtx();
    }
  }

  function startEngineSound() {
    if (!state.soundEnabled) return;
    try {
      initAudio();
      if (!state.audioCtx) return;
      if (state.audioCtx.state === "suspended") state.audioCtx.resume();
      if (state.engineOsc) return;

      const osc = state.audioCtx.createOscillator();
      const gain = state.audioCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(55, state.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, state.audioCtx.currentTime);

      osc.connect(gain);
      gain.connect(state.audioCtx.destination);
      osc.start();

      state.engineOsc = osc;
      state.engineGain = gain;
    } catch (e) {}
  }

  function stopEngineSound() {
    if (state.engineOsc) {
      try {
        state.engineOsc.stop();
        state.engineOsc.disconnect();
      } catch (e) {}
      state.engineOsc = null;
      state.engineGain = null;
    }
  }

  function updateEngineAudio(speed, throttle) {
    if (!state.engineOsc || !state.audioCtx) return;
    try {
      const targetFreq = 55 + (speed * 0.45) + (throttle * 30);
      state.engineOsc.frequency.setTargetAtTime(targetFreq, state.audioCtx.currentTime, 0.05);
      const targetVol = state.soundEnabled ? (0.03 + (speed / 500) * 0.05 + throttle * 0.03) : 0;
      state.engineGain.gain.setTargetAtTime(targetVol, state.audioCtx.currentTime, 0.05);
    } catch (e) {}
  }

  function playTone(freq, dur, type = "triangle", vol = 0.25) {
    if (!state.soundEnabled) return;
    try {
      initAudio();
      if (!state.audioCtx) return;
      if (state.audioCtx.state === "suspended") state.audioCtx.resume();
      const osc = state.audioCtx.createOscillator();
      const gain = state.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, state.audioCtx.currentTime);
      gain.gain.setValueAtTime(vol, state.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, state.audioCtx.currentTime + dur);
      osc.connect(gain);
      gain.connect(state.audioCtx.destination);
      osc.start();
      osc.stop(state.audioCtx.currentTime + dur);
    } catch (e) {}
  }

  function playDriftChirp() {
    if (!state.soundEnabled) return;
    try {
      initAudio();
      if (!state.audioCtx) return;
      const now = state.audioCtx.currentTime;
      const osc = state.audioCtx.createOscillator();
      const gain = state.audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(320 + Math.random() * 120, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.1);
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(state.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } catch (e) {}
  }

  function playBoostSound() {
    if (!state.soundEnabled) return;
    try {
      initAudio();
      if (!state.audioCtx) return;
      if (state.audioCtx.state === "suspended") state.audioCtx.resume();
      const now = state.audioCtx.currentTime;

      // Rocket whoosh tone (rising sawtooth ramp)
      const osc1 = state.audioCtx.createOscillator();
      const gain1 = state.audioCtx.createGain();
      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(260, now);
      osc1.frequency.exponentialRampToValueAtTime(740, now + 0.22);
      gain1.gain.setValueAtTime(0.22, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc1.connect(gain1);
      gain1.connect(state.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      // Bright harmonic chime (high triangle)
      const osc2 = state.audioCtx.createOscillator();
      const gain2 = state.audioCtx.createGain();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(587.33, now + 0.04);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.24);
      gain2.gain.setValueAtTime(0.20, now + 0.04);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc2.connect(gain2);
      gain2.connect(state.audioCtx.destination);
      osc2.start(now + 0.04);
      osc2.stop(now + 0.32);
    } catch (e) {}
  }

  // =========================================================================
  // VIEW NAVIGATION
  // =========================================================================

  function showView(viewName) {
    el.viewLobby.classList.add("hidden");
    el.viewRoomLounge.classList.add("hidden");
    el.viewGame.classList.add("hidden");

    if (viewName === "lobby") {
      el.viewLobby.classList.remove("hidden");
      el.backBtnText.textContent = "Hub";
      el.btnHeaderBack.href = "/";
      el.btnHeaderLeave.classList.add("hidden");
      stopEngineSound();
      stopSimulation();
      stopRoomSync();
      stopLobbyPolling();
    } else if (viewName === "room") {
      el.viewRoomLounge.classList.remove("hidden");
      el.backBtnText.textContent = "Lobby";
      el.btnHeaderBack.href = "#";
      el.btnHeaderLeave.classList.remove("hidden");
      stopEngineSound();
      stopSimulation();
    } else if (viewName === "game") {
      el.viewGame.classList.remove("hidden");
      el.backBtnText.textContent = "Lobby";
      el.btnHeaderLeave.classList.remove("hidden");
      resizeCanvas();
      startEngineSound();
    }
  }

  // =========================================================================
  // SINGLE STANDARDIZED DRIFT CAR DRAWING
  // =========================================================================

  function drawCarOnCanvas(ctx, cx, cy, angle, color, scale = 1.0, steerInput = 0, isBraking = false) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    // Drop Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.roundRect(-23, -13, 46, 26, 6);
    ctx.fill();

    // 4 Wide Performance Tires
    const steerRad = (steerInput || 0) * 0.45;
    ctx.fillStyle = "#090d16";

    // Front Left Tire (steerable)
    ctx.save();
    ctx.translate(15, -13);
    ctx.rotate(steerRad);
    ctx.fillRect(-6, -3, 13, 7);
    ctx.fillStyle = "#64748b";
    ctx.fillRect(-2, -1, 5, 3);
    ctx.restore();

    // Front Right Tire (steerable)
    ctx.save();
    ctx.translate(15, 13);
    ctx.rotate(steerRad);
    ctx.fillStyle = "#090d16";
    ctx.fillRect(-6, -4, 13, 7);
    ctx.fillStyle = "#64748b";
    ctx.fillRect(-2, -2, 5, 3);
    ctx.restore();

    // Rear tires (fixed wide rubber)
    ctx.fillStyle = "#090d16";
    ctx.fillRect(-21, -16, 13, 7);
    ctx.fillRect(-21, 9, 13, 7);
    ctx.fillStyle = "#64748b";
    ctx.fillRect(-17, -14, 5, 3);
    ctx.fillRect(-17, 11, 5, 3);

    // Front aero splitter
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.roundRect(16, -11, 8, 22, 3);
    ctx.fill();

    // Car Body Base
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-21, -13, 42, 26, 6);
    ctx.fill();

    // Body bevel outline
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Dark Cockpit & Windshield
    ctx.fillStyle = "rgba(11, 15, 25, 0.9)";
    ctx.beginPath();
    ctx.roundRect(-7, -9, 17, 18, 4);
    ctx.fill();

    // Windshield Cyan Glint
    ctx.fillStyle = "rgba(56, 189, 248, 0.75)";
    ctx.beginPath();
    ctx.moveTo(3, -8);
    ctx.lineTo(9, -8);
    ctx.lineTo(9, 8);
    ctx.lineTo(3, 8);
    ctx.closePath();
    ctx.fill();

    // Dual Racing Stripes
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.fillRect(-19, -3, 38, 2);
    ctx.fillRect(-19, 1, 38, 2);

    // Front Headlights
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(18, -10, 3, 4);
    ctx.fillRect(18, 6, 3, 4);

    // Rear Brake Lights (Red, glowing bright when braking)
    if (isBraking) {
      ctx.fillStyle = "#ff2222";
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 10;
      ctx.fillRect(-22, -10, 3, 5);
      ctx.fillRect(-22, 5, 3, 5);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = "#b91c1c";
      ctx.fillRect(-21, -10, 3, 4);
      ctx.fillRect(-21, 6, 3, 4);
    }

    // Rear Aerodynamic Drift Spoiler
    ctx.fillStyle = "#090d16";
    ctx.fillRect(-24, -14, 4, 28);
    ctx.fillStyle = color;
    ctx.fillRect(-24, -14, 4, 3);
    ctx.fillRect(-24, 11, 4, 3);

    ctx.restore();
  }

  function renderProfileCarPreview() {
    const canvas = el.carPreviewCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 15) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 15) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    drawCarOnCanvas(ctx, canvas.width / 2, canvas.height / 2, -0.15, state.driverColor, 1.45, 0.3);
  }

  function initColorPalette() {
    el.tsColorPalette.innerHTML = "";
    PALETTE.forEach(pal => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "ts-color-dot" + (pal.color.toLowerCase() === state.driverColor.toLowerCase() ? " active" : "");
      dot.style.backgroundColor = pal.color;
      dot.title = pal.name;
      dot.addEventListener("click", () => {
        state.driverColor = pal.color;
        localStorage.setItem("ts_driver_color", pal.color);
        document.querySelectorAll(".ts-color-dot").forEach(d => d.classList.remove("active"));
        dot.classList.add("active");
        renderProfileCarPreview();
      });
      el.tsColorPalette.appendChild(dot);
    });
  }

  // =========================================================================
  // ENHANCED DRIFT PHYSICS & SIMULATION
  // =========================================================================

  function resetCarToSlot(car, track, slotIndex) {
    const slots = getStartGridSlots(track, 16);
    const slot = slots[slotIndex % slots.length];
    car.x = slot.x;
    car.y = slot.y;
    car.angle = slot.angle;
    car.vx = 0;
    car.vy = 0;
    car.speed = 0;
    car.accelInput = 0;
    car.brakeInput = 0;
    car.steerInput = 0;
    car.handbrakeInput = 0;
    car.isDrifting = false;
    car.driftAngle = 0;
    car.driftBoostCharge = 0;
    car.turboTimer = 0;
    car.lap = 1;
    car.checkpoint = 0;
    car.finished = false;
    car.finishTime = 0;
    car.bestLap = 0;
    car.lapStartTime = performance.now();
    car.raceStartTime = performance.now();

    // Immediately snap camera to the car
    state.camera.x = slot.x;
    state.camera.y = slot.y;
    state.camera.zoom = 1.25;
  }

  function updateCarPhysics(car, track, dt) {
    const throttle = car.accelInput;
    const brake = car.brakeInput;
    const steer = car.steerInput;
    const handbrake = car.handbrakeInput;

    let enginePower = CAR_SPEC.accel;
    let maxSpeed = CAR_SPEC.maxSpeed;

    // Active Turbo Boost state
    if (car.turboTimer > 0) {
      car.turboTimer -= dt;
      enginePower *= 1.5;
      maxSpeed *= 1.28;
      addBoostParticle(car);
    }

    const forwardX = Math.cos(car.angle);
    const forwardY = Math.sin(car.angle);
    const rightX = -Math.sin(car.angle);
    const rightY = Math.cos(car.angle);

    let vForward = car.vx * forwardX + car.vy * forwardY;
    let vLateral = car.vx * rightX + car.vy * rightY;
    const speed = Math.hypot(car.vx, car.vy);
    car.speed = speed;

    // Steering yaw rotation: agile and responsive ice rotation
    const steerDir = vForward >= -15 ? 1 : -1;
    car.angle += steer * CAR_SPEC.turnSpeed * steerDir * dt;

    // Slip angle between heading and travel velocity vector
    let slip = 0;
    if (speed > 25) {
      const travelAngle = Math.atan2(car.vy, car.vx);
      let diff = car.angle - travelAngle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      slip = diff;
    }
    const absSlip = Math.abs(slip);

    // Drifting on ice:
    // 1. Sliding sideways when heading diverges from travel vector (absSlip > 0.18 & speed > 35)
    // 2. Handbrake held (Space)
    // 3. Tapping brake while steering at speed
    const isSlidingOnIce = (absSlip > 0.18 && speed > 35) ||
      Boolean(handbrake && speed > 25) ||
      Boolean(brake > 0 && Math.abs(steer) > 0.15 && speed > 40);

    if (isSlidingOnIce) {
      car.isDrifting = true;
      car.driftAngle = absSlip;
      // Drift meter charges up smoothly during the slide
      car.driftBoostCharge = Math.min(1.0, car.driftBoostCharge + dt * 0.82);

      addSkidmark(car);
      addIceSprayParticle(car);
      if (Math.random() < 0.28) playDriftChirp();
    } else {
      // DRIFT EXIT BOOST TRIGGER:
      // When straightening the car back to the road vector (counter-steering or wheel centering)
      if (car.isDrifting) {
        if (car.driftBoostCharge >= 0.22 && speed > 40) {
          const boostLevel = car.driftBoostCharge;
          // 1. Instant forward rocket impulse
          const forwardKick = 160 + 190 * boostLevel;
          car.vx += forwardX * forwardKick;
          car.vy += forwardY * forwardKick;

          // 2. Turbo boost duration with extra power and top speed
          car.turboTimer = 0.85 + boostLevel * 1.35;

          // 3. Turbo pop sound effect
          playBoostSound();

          // 4. Boost exhaust flames
          for (let i = 0; i < 14; i++) {
            addBoostParticle(car);
          }
        }
        car.isDrifting = false;
      }
      // Decay charge when straightened out and not boosting
      car.driftBoostCharge = Math.max(0, car.driftBoostCharge - dt * 2.2);
      car.driftAngle = 0;
    }

    // Ice Surface Physics:
    // - Low lateral friction while sliding (0.976 retention per 60Hz frame = smooth glide!)
    // - Handbrake frees lateral slip even further (0.985 retention)
    // - Once straightened out, studded tire grip bites into the track (0.88 retention)
    let latRetention;
    if (handbrake) {
      latRetention = 0.985;
    } else if (isSlidingOnIce) {
      latRetention = 0.976;
    } else {
      latRetention = 0.88;
    }

    let newVLateral = vLateral * Math.pow(latRetention, dt * 60);

    // Forward drive & slide braking on ice
    let newVForward = vForward;
    if (throttle > 0 && newVForward < maxSpeed) {
      newVForward += throttle * enginePower * dt;
    }
    if (brake > 0) {
      if (newVForward > 15) {
        // Sliding brake: on ice, wheels lock up and car slides gradually to a stop
        newVForward *= Math.pow(0.965, dt * 60);
        newVLateral *= Math.pow(0.965, dt * 60);
        newVForward -= brake * enginePower * 0.35 * dt;
      } else if (newVForward > -CAR_SPEC.reverseSpeed) {
        newVForward -= brake * enginePower * 0.7 * dt;
      }
    }

    // Very low rolling drag on ice
    newVForward *= Math.pow(0.996, dt * 60);

    car.vx = newVForward * forwardX + newVLateral * rightX;
    car.vy = newVForward * forwardY + newVLateral * rightY;

    // Track surface check (asphalt vs snowbank / grass vs barrier)
    const trackDist = getDistanceToTrackSpine(car.x, car.y, track);
    const halfRoad = track.roadWidth * 0.5;

    if (trackDist > halfRoad + 45) {
      // Off-road Deep Snowbank
      car.vx *= Math.pow(0.88, dt * 60);
      car.vy *= Math.pow(0.88, dt * 60);
    }

    // Barrier bounce
    const barrierLimit = halfRoad + 85;
    if (trackDist > barrierLimit) {
      const closest = getClosestPointOnTrack(car.x, car.y, track);
      const toTrackX = closest.x - car.x;
      const toTrackY = closest.y - car.y;
      const d = Math.hypot(toTrackX, toTrackY) || 1;
      const nx = toTrackX / d;
      const ny = toTrackY / d;

      const dot = car.vx * nx + car.vy * ny;
      if (dot < 0) {
        car.vx = (car.vx - 1.5 * dot * nx) * 0.55;
        car.vy = (car.vy - 1.5 * dot * ny) * 0.55;
        playTone(150, 0.12, "sawtooth", 0.25);
        addSparkParticles(car.x, car.y);
      }
    }

    car.x += car.vx * dt;
    car.y += car.vy * dt;

    updateCheckpointsAndLap(car, track);
  }

  // =========================================================================
  // TRACK QUERIES & CHECKPOINTS
  // =========================================================================

  function getClosestPointOnSegment(px, py, pA, pB) {
    const dx = pB.x - pA.x;
    const dy = pB.y - pA.y;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return { x: pA.x, y: pA.y };
    const t = Math.max(0, Math.min(1, ((px - pA.x) * dx + (py - pA.y) * dy) / l2));
    return { x: pA.x + t * dx, y: pA.y + t * dy };
  }

  function getClosestPointOnTrack(px, py, track) {
    let bestDist = Infinity;
    let bestPt = { x: px, y: py };
    const pts = track.points;
    for (let i = 0; i < pts.length; i += 4) {
      const pA = pts[i];
      const pB = pts[(i + 4) % pts.length];
      const cp = getClosestPointOnSegment(px, py, pA, pB);
      const d = Math.hypot(px - cp.x, py - cp.y);
      if (d < bestDist) {
        bestDist = d;
        bestPt = cp;
      }
    }
    return bestPt;
  }

  function getDistanceToTrackSpine(px, py, track) {
    const cp = getClosestPointOnTrack(px, py, track);
    return Math.hypot(px - cp.x, py - cp.y);
  }

  function updateCheckpointsAndLap(car, track) {
    if (car.finished) return;
    const cps = track.checkpoints;
    const nextIdx = (car.checkpoint + 1) % cps.length;
    const nextCp = cps[nextIdx];

    const dist = Math.hypot(car.x - nextCp.x, car.y - nextCp.y);
    if (dist < track.roadWidth * 0.95) {
      if (nextIdx === 0 && car.checkpoint === cps.length - 1) {
        // Completed Lap!
        const now = performance.now();
        const lapDuration = (now - car.lapStartTime) / 1000.0;
        if (car.bestLap === 0 || lapDuration < car.bestLap) {
          car.bestLap = lapDuration;
        }
        car.lapStartTime = now;

        if (car.lap >= state.laps) {
          car.finished = true;
          car.finishTime = (now - car.raceStartTime) / 1000.0;
          playTone(523.25, 0.25, "triangle", 0.3);
          setTimeout(() => playTone(659.25, 0.35, "triangle", 0.3), 150);
        } else {
          car.lap++;
          car.checkpoint = 0;
          playTone(587.33, 0.15, "triangle", 0.25);
        }
      } else if (nextIdx === car.checkpoint + 1) {
        car.checkpoint = nextIdx;
      }
    }
  }

  // =========================================================================
  // PARTICLES & SKIDMARKS
  // =========================================================================

  function addSkidmark(car) {
    const rightX = -Math.sin(car.angle);
    const rightY = Math.cos(car.angle);
    const backX = -Math.cos(car.angle) * 16;
    const backY = -Math.sin(car.angle) * 16;

    state.skidmarks.push({ x: car.x + backX - rightX * 11, y: car.y + backY - rightY * 11, alpha: 0.65, isIce: true });
    state.skidmarks.push({ x: car.x + backX + rightX * 11, y: car.y + backY + rightY * 11, alpha: 0.65, isIce: true });

    if (state.skidmarks.length > 600) {
      state.skidmarks.splice(0, 50);
    }
  }

  function addIceSprayParticle(car) {
    const rightX = -Math.sin(car.angle);
    const rightY = Math.cos(car.angle);
    const backX = -Math.cos(car.angle) * 16;
    const backY = -Math.sin(car.angle) * 16;

    // Both left and right rear tires throw up ice crystals & snow spray
    [-10, 10].forEach(sideOffset => {
      const startX = car.x + backX + rightX * sideOffset;
      const startY = car.y + backY + rightY * sideOffset;
      const sprayAngle = Math.atan2(car.vy || 1, car.vx || 1) + Math.PI + (Math.random() - 0.5) * 0.8;
      const spraySpeed = (car.speed * 0.25) + 20 + Math.random() * 45;

      state.particles.push({
        x: startX + (Math.random() - 0.5) * 4,
        y: startY + (Math.random() - 0.5) * 4,
        vx: Math.cos(sprayAngle) * spraySpeed + (Math.random() - 0.5) * 15,
        vy: Math.sin(sprayAngle) * spraySpeed + (Math.random() - 0.5) * 15,
        size: 3.5 + Math.random() * 5.5,
        alpha: 0.85,
        decay: 1.3,
        color: Math.random() > 0.35 ? "rgba(240, 249, 255," : "rgba(186, 230, 253,",
      });
    });
  }

  const addSmokeParticle = addIceSprayParticle;

  function addBoostParticle(car) {
    const backX = -Math.cos(car.angle) * 23;
    const backY = -Math.sin(car.angle) * 23;
    const rightX = -Math.sin(car.angle);
    const rightY = Math.cos(car.angle);

    // Twin rocket exhaust flame jets
    [-7, 7].forEach(exhaustOffset => {
      state.particles.push({
        x: car.x + backX + rightX * exhaustOffset + (Math.random() - 0.5) * 4,
        y: car.y + backY + rightY * exhaustOffset + (Math.random() - 0.5) * 4,
        vx: -Math.cos(car.angle) * (180 + Math.random() * 80) + (Math.random() - 0.5) * 25,
        vy: -Math.sin(car.angle) * (180 + Math.random() * 80) + (Math.random() - 0.5) * 25,
        size: 5.5 + Math.random() * 6.5,
        alpha: 0.95,
        decay: 2.1,
        color: Math.random() > 0.35 ? "rgba(56, 189, 248," : "rgba(251, 191, 36,",
      });
    });
  }

  function addSparkParticles(x, y) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 100;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: 2.5,
        alpha: 1.0,
        decay: 2.5,
        color: "rgba(253, 224, 71,",
      });
    }
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= p.decay * dt;
      p.size += dt * 8;
      if (p.alpha <= 0) {
        state.particles.splice(i, 1);
      }
    }
  }

  // =========================================================================
  // PRE-RENDERED OFFSCREEN TRACK CACHING (Solid 60 FPS)
  // =========================================================================

  let cachedTrackId = null;
  let cachedTrackCanvas = null;

  function renderTrackToOffscreen(track) {
    const pts = track.points;
    const rw = track.roadWidth;

    const canvas = document.createElement("canvas");
    canvas.width = 3000;
    canvas.height = 2000;
    const ctx = canvas.getContext("2d");

    // 1. Lush Green Turf with Diagonal Stripes
    ctx.fillStyle = "#0c1a12";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#102217";
    for (let x = -2000; x < 4000; x += 140) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 1000, 2000);
      ctx.lineTo(x + 1070, 2000);
      ctx.lineTo(x + 70, 0);
      ctx.closePath();
      ctx.fill();
    }

    // 2. Sand / Gravel Runoff Bed (wide beige/sand base)
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.lineWidth = rw + 84;
    ctx.strokeStyle = "#927757";
    ctx.stroke();

    ctx.lineWidth = rw + 76;
    ctx.strokeStyle = "#a18462";
    ctx.stroke();

    // 3. 3D Tire Wall Barriers
    ctx.lineWidth = rw + 54;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.stroke();

    ctx.lineWidth = rw + 44;
    ctx.strokeStyle = "#dc2626";
    ctx.stroke();

    ctx.lineWidth = rw + 44;
    ctx.setLineDash([28, 28]);
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.lineWidth = rw + 40;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.stroke();

    // 4. Red & White Apex Rumble Strips (Curbs)
    ctx.lineWidth = rw + 24;
    ctx.strokeStyle = "#ef4444";
    ctx.stroke();

    ctx.lineWidth = rw + 24;
    ctx.setLineDash([16, 16]);
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.setLineDash([]);

    // 5. Dark Asphalt Surface
    ctx.lineWidth = rw;
    ctx.strokeStyle = "#171d26";
    ctx.stroke();

    // 6. Rubbered Racing Line (Subtle darker grip groove where cars drive)
    ctx.lineWidth = rw * 0.42;
    ctx.strokeStyle = "#0f141c";
    ctx.stroke();

    // 7. Crisp White Outer Edge Lines
    ctx.lineWidth = rw - 6;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.stroke();

    // Re-fill inner road between edge lines
    ctx.lineWidth = rw - 14;
    ctx.strokeStyle = "#171d26";
    ctx.stroke();

    // Re-touch racing groove
    ctx.lineWidth = rw * 0.38;
    ctx.strokeStyle = "#0f141c";
    ctx.stroke();

    // 8. Yellow Dashed Centerline
    ctx.lineWidth = 4;
    ctx.setLineDash([24, 24]);
    ctx.strokeStyle = "#facc15";
    ctx.stroke();
    ctx.setLineDash([]);

    // 9. Starting Grid Boxes (Slots 1..16 painted on track)
    const slots = getStartGridSlots(track, 16);
    slots.forEach((s, idx) => {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-26, -18, 52, 36);
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.font = "900 13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(idx + 1), -18, 0);
      ctx.restore();
    });

    // 10. Checkered Start / Finish Line
    const p0 = track.rawPoints[0];
    const p1 = track.rawPoints[1];
    const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);

    ctx.save();
    ctx.translate(p0.x, p0.y);
    ctx.rotate(angle);

    const halfW = rw * 0.5;
    const boxSize = 14;
    const cols = 4;
    const rows = Math.floor(rw / boxSize);

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        ctx.fillStyle = (c + r) % 2 === 0 ? "#ffffff" : "#090d16";
        ctx.fillRect(-28 + c * boxSize, -halfW + r * boxSize, boxSize, boxSize);
      }
    }

    // Overhead gantry shadow & pillars
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(-22, -halfW - 24, 44, rw + 48);

    ctx.fillStyle = "#334155";
    ctx.fillRect(-20, -halfW - 22, 40, 18);
    ctx.fillRect(-20, halfW + 4, 40, 18);

    ctx.restore();

    return canvas;
  }

  function resizeCanvas() {
    const canvas = el.raceCanvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    }
  }

  function drawTexturedTrack(ctx, track) {
    if (cachedTrackId !== track.id || !cachedTrackCanvas) {
      cachedTrackCanvas = renderTrackToOffscreen(track);
      cachedTrackId = track.id;
    }
    ctx.drawImage(cachedTrackCanvas, 0, 0);
  }

  function drawSkidmarks(ctx) {
    if (!state.skidmarks.length) return;
    for (let i = 0; i < state.skidmarks.length; i++) {
      const sm = state.skidmarks[i];
      ctx.fillStyle = sm.isIce ? "rgba(224, 242, 254, 0.45)" : "rgba(15, 23, 42, 0.55)";
      ctx.globalAlpha = (sm.alpha || 0.6) * 0.65;
      ctx.beginPath();
      ctx.arc(sm.x, sm.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }

  function drawParticles(ctx) {
    for (let i = 0; i < state.particles.length; i++) {
      const p = state.particles[i];
      ctx.fillStyle = p.color + p.alpha + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayerCar(ctx, car, color, name, isLocal = false) {
    const isBraking = car.brakeInput > 0;
    const steer = car.steerInput || 0;
    drawCarOnCanvas(ctx, car.x, car.y, car.angle, color, 1.4, steer, isBraking);

    // Floating Name Tag (for opponents)
    if (!isLocal) {
      ctx.save();
      ctx.fillStyle = "rgba(11, 15, 25, 0.88)";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      const txt = name || "Sjåfør";
      const w = ctx.measureText(txt).width + 14;
      ctx.beginPath();
      ctx.roundRect(car.x - w / 2, car.y - 38, w, 20, 6);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.fillText(txt, car.x, car.y - 24);
      ctx.restore();
    }
  }

  function drawMinimap(track, allCars) {
    const canvas = el.minimapCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pts = track.points;
    const scale = Math.min((canvas.width - 24) / 2600, (canvas.height - 24) / 1800);
    const offsetX = (canvas.width - 2600 * scale) / 2;
    const offsetY = (canvas.height - 1800 * scale) / 2;

    ctx.beginPath();
    ctx.moveTo(offsetX + pts[0].x * scale, offsetY + pts[0].y * scale);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(offsetX + pts[i].x * scale, offsetY + pts[i].y * scale);
    }
    ctx.closePath();
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#334155";
    ctx.stroke();

    ctx.lineWidth = 4;
    ctx.strokeStyle = "#64748b";
    ctx.stroke();

    allCars.forEach(c => {
      ctx.fillStyle = c.color || "#38bdf8";
      ctx.beginPath();
      ctx.arc(offsetX + c.x * scale, offsetY + c.y * scale, c.isMe ? 5.5 : 4, 0, Math.PI * 2);
      ctx.fill();
      if (c.isMe) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }

  function formatTime(seconds) {
    if (!seconds || seconds <= 0) return "--:--.-";
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(4, "0")}`;
  }

  function updateHUD(track) {
    const now = performance.now();
    const curLapSecs = (now - state.myCar.lapStartTime) / 1000.0;
    if (el.hudCurrentTime) el.hudCurrentTime.textContent = formatTime(curLapSecs);
    if (el.hudBestLap) el.hudBestLap.textContent = formatTime(state.myCar.bestLap);

    const kmh = Math.round(state.myCar.speed * 0.48);
    if (el.hudSpeedNum) el.hudSpeedNum.textContent = String(kmh);
    if (el.hudLapText) el.hudLapText.textContent = `${state.myCar.lap}/${state.laps}`;

    const pct = Math.round(state.myCar.driftBoostCharge * 100);
    if (el.driftMeterBar) {
      el.driftMeterBar.style.width = pct + "%";
      if (pct > 75) {
        el.driftMeterBar.style.background = "linear-gradient(90deg, #38bdf8 0%, #3b82f6 40%, #fbbf24 100%)";
      } else {
        el.driftMeterBar.style.background = "linear-gradient(90deg, #38bdf8 0%, #06b6d4 60%, #3b82f6 100%)";
      }
    }

    if (el.driftMeterWrap && el.driftMeterLabel) {
      if (state.myCar.turboTimer > 0) {
        el.driftMeterLabel.textContent = "🚀 TURBO BOOST!";
        el.driftMeterWrap.style.boxShadow = "0 0 16px rgba(56, 189, 248, 0.95)";
      } else if (state.myCar.driftBoostCharge > 0.75) {
        el.driftMeterLabel.textContent = "⚡ BOOST KLAR! (RETT OPP)";
        el.driftMeterWrap.style.boxShadow = "0 0 14px rgba(251, 191, 36, 0.9)";
      } else if (state.myCar.isDrifting) {
        el.driftMeterLabel.textContent = `❄️ ISSLADD! ${pct}%`;
        el.driftMeterWrap.style.boxShadow = "0 0 12px rgba(56, 189, 248, 0.8)";
      } else {
        el.driftMeterLabel.textContent = "IS-SLADD BOOST";
        el.driftMeterWrap.style.boxShadow = "none";
      }
    }

    // Dynamic rank
    const allRacers = [
      { id: state.playerId || "local", lap: state.myCar.lap, checkpoint: state.myCar.checkpoint, finished: state.myCar.finished, finishTime: state.myCar.finishTime },
      ...Object.values(state.opponentCars).map(o => ({ id: o.id, lap: o.lap || 1, checkpoint: o.checkpoint || 0, finished: o.finished || false, finishTime: o.finishTime || 0 })),
    ];
    allRacers.sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      if (a.lap !== b.lap) return b.lap - a.lap;
      return b.checkpoint - a.checkpoint;
    });
    const rank = allRacers.findIndex(r => r.id === (state.playerId || "local")) + 1;
    if (el.hudPosNum) el.hudPosNum.textContent = String(rank > 0 ? rank : 1);
  }

  // =========================================================================
  // MAIN GAME LOOP & SIMULATION
  // =========================================================================

  let lastTime = 0;

  function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min(0.08, (timestamp - lastTime) / 1000.0);
    lastTime = timestamp;

    try {
      const track = TRACKS[state.trackId] || TRACKS.grand_prix;

      // In Solo or when racing, full driver control:
      if (state.mode === "solo" || state.roomStatus === "racing") {
        state.myCar.accelInput = state.keys.up ? 1 : 0;
        state.myCar.brakeInput = state.keys.down ? 1 : 0;
        state.myCar.steerInput = (state.keys.right ? 1 : 0) - (state.keys.left ? 1 : 0);
        state.myCar.handbrakeInput = state.keys.space ? 1 : 0;
      } else if (state.roomStatus === "countdown") {
        // Allow steering & wheel angling before green flag
        state.myCar.accelInput = 0;
        state.myCar.brakeInput = 0;
        state.myCar.steerInput = (state.keys.right ? 1 : 0) - (state.keys.left ? 1 : 0);
        state.myCar.handbrakeInput = 0;
      } else {
        state.myCar.accelInput = 0;
        state.myCar.brakeInput = 0.5;
        state.myCar.steerInput = 0;
        state.myCar.handbrakeInput = 0;
      }

      updateCarPhysics(state.myCar, track, dt);
      updateEngineAudio(state.myCar.speed, state.myCar.accelInput);

      // Opponent interpolation
      Object.values(state.opponentCars).forEach(opp => {
        if (opp.targetX !== undefined) {
          opp.x += (opp.targetX - opp.x) * Math.min(1.0, dt * 14.0);
          opp.y += (opp.targetY - opp.y) * Math.min(1.0, dt * 14.0);
          let diff = opp.targetAngle - opp.angle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          opp.angle += diff * Math.min(1.0, dt * 14.0);

          if (opp.isDrifting) {
            addIceSprayParticle(opp);
            addSkidmark(opp);
          }
        }
      });

      updateParticles(dt);

      // Render Canvas
      resizeCanvas();
      const canvas = el.raceCanvas;
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#090d16";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Smooth camera follow with look-ahead
        const lookahead = Math.min(110, state.myCar.speed * 0.3);
        const targetCamX = state.myCar.x + Math.cos(state.myCar.angle) * lookahead;
        const targetCamY = state.myCar.y + Math.sin(state.myCar.angle) * lookahead;
        state.camera.x += (targetCamX - state.camera.x) * 0.16;
        state.camera.y += (targetCamY - state.camera.y) * 0.16;

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(state.camera.zoom, state.camera.zoom);
        ctx.translate(-state.camera.x, -state.camera.y);

        drawTexturedTrack(ctx, track);
        drawSkidmarks(ctx);

        const allMinimapCars = [];
        Object.values(state.opponentCars).forEach(opp => {
          drawPlayerCar(ctx, opp, opp.color, opp.name, false);
          allMinimapCars.push({ x: opp.x, y: opp.y, color: opp.color, isMe: false });
        });

        drawPlayerCar(ctx, state.myCar, state.driverColor, state.driverName, true);
        allMinimapCars.push({ x: state.myCar.x, y: state.myCar.y, color: state.driverColor, isMe: true });

        drawParticles(ctx);
        ctx.restore();

        drawMinimap(track, allMinimapCars);
      }

      updateHUD(track);

      if (state.mode === "solo" && state.myCar.finished) {
        setTimeout(() => {
          showGameOverPodium([
            { name: state.driverName, color: state.driverColor, finishTime: state.myCar.finishTime, bestLap: state.myCar.bestLap },
          ]);
        }, 700);
        return;
      }
    } catch (err) {
      console.error("Game loop error:", err);
    }

    state.animFrameId = requestAnimationFrame(gameLoop);
  }

  function startSimulation() {
    stopSimulation();
    lastTime = 0;
    state.animFrameId = requestAnimationFrame(gameLoop);
  }

  function stopSimulation() {
    if (state.animFrameId) {
      cancelAnimationFrame(state.animFrameId);
      state.animFrameId = null;
    }
  }

  // =========================================================================
  // MULTIDEVICE ROOM SYNC
  // =========================================================================

  async function syncTelemetryWithServer() {
    if (!state.roomCode || !state.playerId || state.roomStatus === "lobby") return;
    try {
      const resp = await fetch("/api/turbosladd/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          telemetry: {
            x: state.myCar.x,
            y: state.myCar.y,
            angle: state.myCar.angle,
            vx: state.myCar.vx,
            vy: state.myCar.vy,
            speed: state.myCar.speed,
            isDrifting: state.myCar.isDrifting,
            lap: state.myCar.lap,
            checkpoint: state.myCar.checkpoint,
            finished: state.myCar.finished,
            finishTime: state.myCar.finishTime,
            bestLap: state.myCar.bestLap,
          },
        }),
      });
      const data = await resp.json();
      if (data && data.ok) {
        handleServerStateUpdate(data);
      }
    } catch (e) {}
  }

  function handleServerStateUpdate(data) {
    const prevStatus = state.roomStatus;
    state.roomStatus = data.status;

    if (data.status === "countdown") {
      el.countdownOverlay.classList.remove("hidden");
      const rem = Math.ceil(data.countdownRemaining || 3);
      el.countdownText.textContent = rem > 0 ? String(rem) : "KJØR!";
    } else if (data.status === "racing") {
      if (prevStatus === "countdown") {
        el.countdownText.textContent = "KJØR! 🏁";
        playTone(880, 0.4, "triangle", 0.3);
        setTimeout(() => el.countdownOverlay.classList.add("hidden"), 700);
      } else {
        el.countdownOverlay.classList.add("hidden");
      }
    } else if (data.status === "finished") {
      stopRoomSync();
      const standings = (data.players || []).slice().sort((a, b) => (a.finishTime || 9999) - (b.finishTime || 9999));
      showGameOverPodium(standings);
    }

    (data.players || []).forEach(p => {
      if (p.id !== state.playerId) {
        if (!state.opponentCars[p.id]) {
          state.opponentCars[p.id] = {
            id: p.id,
            name: p.name,
            color: p.color,
            x: p.x,
            y: p.y,
            angle: p.angle,
            targetX: p.x,
            targetY: p.y,
            targetAngle: p.angle,
            speed: p.speed,
            isDrifting: p.isDrifting,
            lap: p.lap,
            checkpoint: p.checkpoint,
            finished: p.finished,
            finishTime: p.finishTime,
          };
        } else {
          const opp = state.opponentCars[p.id];
          opp.targetX = p.x;
          opp.targetY = p.y;
          opp.targetAngle = p.angle;
          opp.speed = p.speed;
          opp.isDrifting = p.isDrifting;
          opp.lap = p.lap;
          opp.checkpoint = p.checkpoint;
          opp.finished = p.finished;
          opp.finishTime = p.finishTime;
        }
      }
    });
  }

  function startRoomSync() {
    stopRoomSync();
    state.syncTimerId = setInterval(syncTelemetryWithServer, 66); // 15 Hz
  }

  function stopRoomSync() {
    if (state.syncTimerId) {
      clearInterval(state.syncTimerId);
      state.syncTimerId = null;
    }
  }

  // =========================================================================
  // ROOM LOBBY POLLING
  // =========================================================================

  async function pollLobbyState() {
    if (!state.roomCode) return;
    try {
      const resp = await fetch(`/api/turbosladd/state?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`);
      const data = await resp.json();
      if (data && data.ok) {
        state.isHost = Boolean(data.isHost);
        state.trackId = data.trackId || "grand_prix";
        state.laps = data.laps || 3;
        state.maxPlayers = data.maxPlayers || 4;
        state.players = data.players || [];
        renderLoungeRacers(data.players);

        if (data.status === "countdown" || data.status === "racing") {
          stopLobbyPolling();
          launchOnlineRace(data);
        }
      }
    } catch (e) {}
  }

  function startLobbyPolling() {
    stopLobbyPolling();
    pollLobbyState();
    state.lobbyPollTimerId = setInterval(pollLobbyState, 750);
  }

  function stopLobbyPolling() {
    if (state.lobbyPollTimerId) {
      clearInterval(state.lobbyPollTimerId);
      state.lobbyPollTimerId = null;
    }
  }

  function renderLoungeRacers(players) {
    el.racersGrid.innerHTML = "";
    el.racersCountBadge.textContent = `${players.length}/${state.maxPlayers}`;

    players.forEach((p, idx) => {
      const card = document.createElement("div");
      card.className = "racer-slot-card occupied" + (p.id === state.playerId ? " is-me" : "");
      card.innerHTML = `
        <div class="racer-slot-num">${idx + 1}</div>
        <div class="racer-car-icon-wrap" style="background:${p.color};">
          <span style="font-size:1.1rem;">🏎️</span>
        </div>
        <div class="racer-info-wrap">
          <div class="racer-name">${escapeHtml(p.name)}${p.isHost ? " (Vert 👑)" : ""}</div>
          <div class="racer-subtext">Klar for sladd 🏁</div>
        </div>
        <span class="racer-ready-tag ${p.isReady ? "ready" : "waiting"}">
          ${p.isReady ? "KLAR" : "VENTER..."}
        </span>
      `;
      el.racersGrid.appendChild(card);
    });

    for (let i = players.length; i < state.maxPlayers; i++) {
      const emptyCard = document.createElement("div");
      emptyCard.className = "racer-slot-card empty";
      emptyCard.innerHTML = `
        <div class="racer-slot-num">${i + 1}</div>
        <div class="racer-subtext" style="color:#64748b;">Ledig plass...</div>
      `;
      el.racersGrid.appendChild(emptyCard);
    }

    if (state.isHost) {
      el.btnHostStartRace.classList.remove("hidden");
    } else {
      el.btnHostStartRace.classList.add("hidden");
    }
  }

  function launchOnlineRace(data) {
    state.mode = "online";
    state.roomStatus = data.status || "countdown";
    state.opponentCars = {};
    state.skidmarks = [];
    state.particles = [];
    state.keys = { up: false, down: false, left: false, right: false, space: false };

    const track = TRACKS[state.trackId] || TRACKS.grand_prix;
    const myPlayer = (data.players || []).find(p => p.id === state.playerId);
    const mySlot = myPlayer ? myPlayer.slot : 0;

    resetCarToSlot(state.myCar, track, mySlot);

    showView("game");
    resizeCanvas();
    if (el.raceCanvas) el.raceCanvas.focus();

    if (state.roomStatus === "countdown") {
      el.countdownOverlay.classList.remove("hidden");
      const rem = Math.ceil(data.countdownRemaining || 3);
      el.countdownText.textContent = rem > 0 ? String(rem) : "KJØR!";

      // Fallback timer ensures car is unlocked even on network hiccup
      const waitMs = Math.max(1000, ((data.countdownRemaining || 3) * 1000) + 200);
      setTimeout(() => {
        if (state.roomStatus === "countdown") {
          state.roomStatus = "racing";
          el.countdownText.textContent = "KJØR! 🏁";
          playTone(880, 0.4, "triangle", 0.3);
          setTimeout(() => el.countdownOverlay.classList.add("hidden"), 700);
        }
      }, waitMs);
    }

    startSimulation();
    startRoomSync();
  }

  function launchSoloTimeTrial() {
    state.mode = "solo";
    state.roomStatus = "racing";
    state.opponentCars = {};
    state.skidmarks = [];
    state.particles = [];
    state.keys = { up: false, down: false, left: false, right: false, space: false };

    const track = TRACKS[state.trackId] || TRACKS.grand_prix;
    resetCarToSlot(state.myCar, track, 0);

    showView("game");
    resizeCanvas();
    if (el.raceCanvas) el.raceCanvas.focus();

    el.countdownOverlay.classList.remove("hidden");
    el.countdownText.textContent = "KJØR! 🏁";
    playTone(880, 0.4, "triangle", 0.3);
    setTimeout(() => el.countdownOverlay.classList.add("hidden"), 700);

    startSimulation();
  }

  function showGameOverPodium(racers) {
    stopSimulation();
    stopRoomSync();
    stopEngineSound();

    el.podiumStandings.innerHTML = "";
    racers.forEach((r, idx) => {
      const row = document.createElement("div");
      row.className = "podium-row" + (idx === 0 ? " rank-1" : "");
      const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;
      row.innerHTML = `
        <div class="podium-left">
          <span class="podium-medal">${medal}</span>
          <span class="podium-color-dot" style="background:${r.color || '#38bdf8'};"></span>
          <span class="podium-name">${escapeHtml(r.name)}</span>
        </div>
        <div class="podium-time">${r.finishTime > 0 ? formatTime(r.finishTime) : "Fullførte"}</div>
      `;
      el.podiumStandings.appendChild(row);
    });

    el.modalPodium.classList.remove("hidden");
  }

  // =========================================================================
  // INPUT HANDLERS (Keys & Buttons)
  // =========================================================================

  function initInputHandlers() {
    function handleKey(e, isDown) {
      const k = e.key;
      const c = e.code;
      let matched = false;

      if (k === "ArrowUp" || c === "ArrowUp" || k === "w" || k === "W" || c === "KeyW" || k === "Up") {
        state.keys.up = isDown;
        matched = true;
      }
      if (k === "ArrowDown" || c === "ArrowDown" || k === "s" || k === "S" || c === "KeyS" || k === "Down") {
        state.keys.down = isDown;
        matched = true;
      }
      if (k === "ArrowLeft" || c === "ArrowLeft" || k === "a" || k === "A" || c === "KeyA" || k === "Left") {
        state.keys.left = isDown;
        matched = true;
      }
      if (k === "ArrowRight" || c === "ArrowRight" || k === "d" || k === "D" || c === "KeyD" || k === "Right") {
        state.keys.right = isDown;
        matched = true;
      }
      if (k === " " || c === "Space" || k === "Spacebar") {
        state.keys.space = isDown;
        matched = true;
      }

      if (matched && !el.viewGame.classList.contains("hidden")) {
        e.preventDefault();
      }
    }

    // Attach to both window and document so focus is never lost
    window.addEventListener("keydown", e => handleKey(e, true));
    window.addEventListener("keyup", e => handleKey(e, false));
    document.addEventListener("keydown", e => handleKey(e, true));
    document.addEventListener("keyup", e => handleKey(e, false));

    // Reset keys only when tab is actually hidden, not on internal DOM blurs
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        state.keys = { up: false, down: false, left: false, right: false, space: false };
      }
    });

    if (el.raceCanvas) {
      el.raceCanvas.addEventListener("pointerdown", () => {
        el.raceCanvas.focus();
      });
    }

    // Audio toggle
    el.btnAudioToggle.addEventListener("click", () => {
      state.soundEnabled = !state.soundEnabled;
      localStorage.setItem("ts_sound", String(state.soundEnabled));
      el.iconSoundOn.classList.toggle("hidden", !state.soundEnabled);
      el.iconSoundOff.classList.toggle("hidden", state.soundEnabled);
      if (state.soundEnabled) playTone(440, 0.1);
    });

    // Profile settings
    el.inputDriverName.value = state.driverName;
    el.inputDriverName.addEventListener("input", () => {
      state.driverName = el.inputDriverName.value.trim() || "Sjåfør 1";
      localStorage.setItem("ts_driver_name", state.driverName);
    });

    // Lobby tabs
    const tabs = [
      { btn: el.tabOnline, panel: el.panelOnline },
      { btn: el.tabSolo, panel: el.panelSolo },
      { btn: el.tabSplitscreen, panel: el.panelSplitscreen },
    ];
    tabs.forEach(({ btn, panel }) => {
      if (!btn || !panel) return;
      btn.addEventListener("click", () => {
        tabs.forEach(t => {
          t.btn.classList.remove("active");
          t.btn.setAttribute("aria-selected", "false");
          t.panel.classList.add("hidden");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
        panel.classList.remove("hidden");
      });
    });

    if (el.btnGoToOnlineTab) el.btnGoToOnlineTab.addEventListener("click", () => el.tabOnline.click());

    // Lap buttons
    el.controlLaps.querySelectorAll(".seg-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        el.controlLaps.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.laps = parseInt(btn.dataset.laps || "3", 10);
      });
    });

    el.controlSoloLaps.querySelectorAll(".seg-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        el.controlSoloLaps.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.laps = parseInt(btn.dataset.laps || "3", 10);
      });
    });

    el.controlMaxPlayers.querySelectorAll(".seg-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        el.controlMaxPlayers.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.maxPlayers = parseInt(btn.dataset.max || "4", 10);
      });
    });

    el.selectTrack.addEventListener("change", () => { state.trackId = el.selectTrack.value; });
    el.selectSoloTrack.addEventListener("change", () => { state.trackId = el.selectSoloTrack.value; });

    // Create Race (Host)
    el.btnCreateRace.addEventListener("click", async () => {
      try {
        const resp = await fetch("/api/turbosladd/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hostName: state.driverName,
            color: state.driverColor,
            trackId: state.trackId,
            laps: state.laps,
            maxPlayers: state.maxPlayers,
          }),
        });
        const data = await resp.json();
        if (data.ok) {
          state.roomCode = data.roomCode;
          state.playerId = data.playerId;
          state.hostToken = data.hostToken;
          state.isHost = true;
          el.displayRoomCode.textContent = data.roomCode;
          el.loungeTrackName.textContent = TRACKS[state.trackId].name;
          el.loungeLapsBadge.textContent = `${state.laps} runder`;
          showView("room");
          startLobbyPolling();
        } else {
          alert(data.error || "Kunne ikke opprette rom.");
        }
      } catch (err) {
        alert("Nettverksfeil ved oppretting av rom.");
      }
    });

    // Join Race
    el.btnJoinRace.addEventListener("click", async () => {
      const code = el.inputRoomCode.value.trim().toUpperCase();
      if (!code) {
        alert("Skriv inn en romkode.");
        return;
      }
      try {
        const resp = await fetch("/api/turbosladd/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: code,
            playerName: state.driverName,
            color: state.driverColor,
          }),
        });
        const data = await resp.json();
        if (data.ok) {
          state.roomCode = data.roomCode;
          state.playerId = data.playerId;
          state.isHost = false;
          state.trackId = data.trackId || "grand_prix";
          state.laps = data.laps || 3;
          el.displayRoomCode.textContent = data.roomCode;
          el.loungeTrackName.textContent = TRACKS[state.trackId].name;
          el.loungeLapsBadge.textContent = `${state.laps} runder`;
          showView("room");
          startLobbyPolling();
        } else {
          alert(data.error || "Kunne ikke koble til rom.");
        }
      } catch (err) {
        alert("Nettverksfeil ved tilkobling til rom.");
      }
    });

    // Copy code button
    el.btnCopyCode.addEventListener("click", () => {
      if (state.roomCode) {
        navigator.clipboard.writeText(state.roomCode);
        el.displayRoomCode.style.color = "#34d399";
        setTimeout(() => { el.displayRoomCode.style.color = "#38bdf8"; }, 800);
      }
    });

    // Toggle Ready
    let isReady = false;
    el.btnToggleReady.addEventListener("click", async () => {
      isReady = !isReady;
      el.btnToggleReady.textContent = isReady ? "Klar! (Venter)" : "Jeg er klar!";
      el.btnToggleReady.classList.toggle("btn-orange-accent", isReady);
      try {
        await fetch("/api/turbosladd/ready", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomCode: state.roomCode, playerId: state.playerId, ready: isReady }),
        });
        pollLobbyState();
      } catch (e) {}
    });

    // Host Start Race
    el.btnHostStartRace.addEventListener("click", async () => {
      try {
        const resp = await fetch("/api/turbosladd/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomCode: state.roomCode, playerId: state.playerId }),
        });
        const data = await resp.json();
        if (data.ok) {
          pollLobbyState();
        } else {
          alert(data.error || "Kunne ikke starte løpet.");
        }
      } catch (e) {}
    });

    // Leave room
    function handleLeaveRoom() {
      stopLobbyPolling();
      stopRoomSync();
      stopEngineSound();
      if (state.roomCode && state.playerId) {
        fetch("/api/turbosladd/leave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomCode: state.roomCode, playerId: state.playerId }),
        }).catch(() => {});
      }
      state.roomCode = "";
      state.playerId = "";
      showView("lobby");
    }

    el.btnLeaveRoom.addEventListener("click", handleLeaveRoom);

    // Navbar Back Button
    if (el.btnHeaderBack) {
      el.btnHeaderBack.addEventListener("click", (e) => {
        if (!el.viewGame.classList.contains("hidden")) {
          e.preventDefault();
          if (confirm("Vil du avslutte løpet og gå tilbake til lobbyen?")) {
            showView("lobby");
          }
        } else if (!el.viewRoomLounge.classList.contains("hidden")) {
          e.preventDefault();
          handleLeaveRoom();
        }
      });
    }

    if (el.btnHeaderLeave) {
      el.btnHeaderLeave.addEventListener("click", () => {
        if (!el.viewGame.classList.contains("hidden")) {
          if (confirm("Vil du avslutte løpet og gå tilbake til lobbyen?")) {
            showView("lobby");
          }
        } else {
          handleLeaveRoom();
        }
      });
    }

    el.btnQuitRace.addEventListener("click", () => {
      if (confirm("Vil du avslutte løpet og gå tilbake til lobbyen?")) {
        showView("lobby");
      }
    });

    // Start Solo Time-Trial
    el.btnStartSolo.addEventListener("click", () => {
      launchSoloTimeTrial();
    });

    // Podium
    el.btnPodiumPlayAgain.addEventListener("click", async () => {
      el.modalPodium.classList.add("hidden");
      if (state.mode === "solo") {
        launchSoloTimeTrial();
      } else if (state.isHost) {
        try {
          await fetch("/api/turbosladd/restart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomCode: state.roomCode, playerId: state.playerId }),
          });
        } catch (e) {}
        showView("room");
        startLobbyPolling();
      } else {
        showView("room");
        startLobbyPolling();
      }
    });

    el.btnPodiumReturnLobby.addEventListener("click", () => {
      el.modalPodium.classList.add("hidden");
      showView("lobby");
    });
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, s => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[s]));
  }

  // =========================================================================
  // INITIALIZATION (Including Party Lounge Direct Bridge)
  // =========================================================================

  async function init() {
    initColorPalette();
    renderProfileCarPreview();
    initInputHandlers();

    // Check URL parameters for Party Lounge / direct link
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = (urlParams.get("room") || urlParams.get("code") || "").trim().toUpperCase();
    const playerParam = (urlParams.get("player") || urlParams.get("playerId") || "").trim();

    if (roomParam) {
      state.roomCode = roomParam;
      state.playerId = playerParam;
      el.inputRoomCode.value = roomParam;
      el.displayRoomCode.textContent = roomParam;

      // Check if room already exists on server
      try {
        const resp = await fetch(`/api/turbosladd/state?room=${encodeURIComponent(roomParam)}&player=${encodeURIComponent(playerParam)}`);
        const data = await resp.json();
        if (data && data.ok) {
          state.isHost = Boolean(data.isHost);
          state.trackId = data.trackId || "grand_prix";
          state.laps = data.laps || 3;
          state.maxPlayers = data.maxPlayers || 4;
          state.players = data.players || [];
          el.loungeTrackName.textContent = TRACKS[state.trackId].name;
          el.loungeLapsBadge.textContent = `${state.laps} runder`;

          // If coming from Party Lounge, link Back button to party lounge
          el.btnHeaderBack.href = `/party/?room=${encodeURIComponent(roomParam)}`;
          el.backBtnText.textContent = "Lounge";

          if (data.status === "countdown" || data.status === "racing") {
            launchOnlineRace(data);
          } else {
            showView("room");
            startLobbyPolling();
          }
          return;
        }
      } catch (e) {}

      // If room didn't exist yet, open online tab with code prefilled
      el.tabOnline.click();
    }

    showView("lobby");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
