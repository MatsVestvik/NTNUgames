/**
 * Turbosladd - Top-down 2D Racing & Drifting Game Engine
 * Features realistic drift physics, tire skid marks, particle effects,
 * multi-device room synchronization, track checkpoints & lap tracking,
 * touch controls for mobile, and Web Audio sound effects.
 */

(() => {
  "use strict";

  // =========================================================================
  // CONSTANTS & CONFIGURATION
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

  const CAR_SPECS = {
    sport: {
      name: "Sport Coupe",
      accel: 520,
      maxSpeed: 450,
      reverseSpeed: 160,
      turnSpeed: 3.4,
      grip: 6.8,
      driftThreshold: 130,
      driftFriction: 0.985,
    },
    drift: {
      name: "Drift Spec",
      accel: 500,
      maxSpeed: 440,
      reverseSpeed: 150,
      turnSpeed: 3.8,
      grip: 5.2,
      driftThreshold: 100,
      driftFriction: 0.988,
    },
    formula: {
      name: "Formula Racer",
      accel: 620,
      maxSpeed: 490,
      reverseSpeed: 140,
      turnSpeed: 3.6,
      grip: 7.8,
      driftThreshold: 160,
      driftFriction: 0.98,
    },
    muscle: {
      name: "Muscle Car",
      accel: 540,
      maxSpeed: 460,
      reverseSpeed: 160,
      turnSpeed: 3.1,
      grip: 5.8,
      driftThreshold: 115,
      driftFriction: 0.989,
    },
  };

  // Track 1: Grand Prix Circuit
  // Defined by spine points. Road width = 140px.
  const TRACK_GRAND_PRIX = {
    id: "grand_prix",
    name: "Grand Prix Banen",
    width: 2400,
    height: 1600,
    roadWidth: 150,
    points: [
      { x: 450, y: 1350 },  // 0: Start / Finish line
      { x: 950, y: 1350 },  // 1: Straightaway
      { x: 1550, y: 1350 }, // 2: End of straight
      { x: 2000, y: 1150 }, // 3: Sweeping curve 1
      { x: 2150, y: 750 },  // 4: Turn 2 apex
      { x: 1950, y: 450 },  // 5: Turn 2 exit
      { x: 1500, y: 400 },  // 6: Back straight
      { x: 1100, y: 450 },  // 7: Chicane entry
      { x: 950, y: 650 },   // 8: Chicane flick
      { x: 1200, y: 850 },  // 9: Chicane exit
      { x: 1400, y: 1000 }, // 10: Hairpin entry
      { x: 1150, y: 1150 }, // 11: Hairpin apex
      { x: 800, y: 1050 },  // 12: Infield loop
      { x: 450, y: 950 },   // 13: Left hairpin
      { x: 300, y: 650 },   // 14: North-west corner
      { x: 450, y: 350 },   // 15: North apex
      { x: 750, y: 300 },   // 16: Top loop
      { x: 400, y: 200 },   // 17: Outer loop
      { x: 200, y: 450 },   // 18: West edge
      { x: 200, y: 1050 },  // 19: Final corner entry
      { x: 250, y: 1300 },  // 20: Final corner exit into start straight
    ],
  };

  // Track 2: Fjord Drift (Continuous hairpin drift circuit)
  const TRACK_FJORD_DRIFT = {
    id: "fjord_drift",
    name: "Fjordsvingen",
    width: 2200,
    height: 1600,
    roadWidth: 140,
    points: [
      { x: 400, y: 1400 },  // 0: Start / Finish
      { x: 1000, y: 1400 }, // 1
      { x: 1600, y: 1400 }, // 2
      { x: 1950, y: 1250 }, // 3: Hairpin 1
      { x: 1800, y: 950 },  // 4
      { x: 1300, y: 950 },  // 5
      { x: 800, y: 950 },   // 6
      { x: 400, y: 800 },   // 7: Hairpin 2
      { x: 700, y: 600 },   // 8
      { x: 1300, y: 600 },  // 9
      { x: 1850, y: 500 },  // 10: Hairpin 3
      { x: 1600, y: 250 },  // 11
      { x: 1000, y: 250 },  // 12
      { x: 400, y: 350 },   // 13: Hairpin 4
      { x: 300, y: 750 },   // 14
      { x: 250, y: 1150 },  // 15
    ],
  };

  const TRACKS = {
    grand_prix: TRACK_GRAND_PRIX,
    fjord_drift: TRACK_FJORD_DRIFT,
  };

  // Staggered grid slots for starting line (up to 16 slots)
  function getStartGridSlots(track, count) {
    const p0 = track.points[0];
    const p1 = track.points[1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const angle = Math.atan2(dy, dx);
    const forward = { x: Math.cos(angle), y: Math.sin(angle) };
    const right = { x: -Math.sin(angle), y: Math.cos(angle) };

    const slots = [];
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / 2);
      const side = (i % 2 === 0) ? -1 : 1;
      const distBack = 60 + row * 85;
      const lateral = side * 34;

      slots.push({
        x: p0.x - forward.x * distBack + right.x * lateral,
        y: p0.y - forward.y * distBack + right.y * lateral,
        angle: angle,
      });
    }
    return slots;
  }

  // =========================================================================
  // APP STATE
  // =========================================================================

  const state = {
    // Mode: "online" | "solo"
    mode: "online",

    // Driver profile
    driverName: localStorage.getItem("ts_driver_name") || "Sjåfør 1",
    driverColor: localStorage.getItem("ts_driver_color") || PALETTE[0].color,
    carModel: localStorage.getItem("ts_car_model") || "sport",

    // Room info
    roomCode: "",
    playerId: "",
    hostToken: "",
    isHost: false,
    trackId: "grand_prix",
    laps: 3,
    maxPlayers: 4,

    // Live Room status: "lobby" | "countdown" | "racing" | "finished"
    roomStatus: "lobby",
    players: [],
    standings: [],

    // Local Car Simulation
    myCar: {
      x: 0,
      y: 0,
      angle: 0,
      vx: 0,
      vy: 0,
      speed: 0,
      accelInput: 0,
      brakeInput: 0,
      steerInput: 0,
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

    // Opponent Cars (interpolated from server sync)
    opponentCars: {},

    // Camera
    camera: { x: 0, y: 0, zoom: 1.0 },

    // Visuals & Effects
    skidmarks: [],
    particles: [],

    // Input States
    keys: {
      up: false,
      down: false,
      left: false,
      right: false,
    },
    touchControlsActive: false,

    // Timers & Loops
    animFrameId: null,
    syncTimerId: null,
    lobbyPollTimerId: null,

    // Sound
    soundEnabled: localStorage.getItem("ts_sound") !== "false",
    audioCtx: null,
  };

  // Cache track objects with calculated segment lengths
  function prepareTrack(track) {
    if (track._prepared) return track;
    track.segments = [];
    track.totalLength = 0;
    const pts = track.points;
    for (let i = 0; i < pts.length; i++) {
      const pA = pts[i];
      const pB = pts[(i + 1) % pts.length];
      const dx = pB.x - pA.x;
      const dy = pB.y - pA.y;
      const len = Math.hypot(dx, dy);
      track.segments.push({
        pA,
        pB,
        dx,
        dy,
        len,
        normal: { x: -dy / len, y: dx / len },
      });
      track.totalLength += len;
    }
    track._prepared = true;
    return track;
  }

  // Pre-prepare tracks
  prepareTrack(TRACKS.grand_prix);
  prepareTrack(TRACKS.fjord_drift);

  // =========================================================================
  // DOM ELEMENTS
  // =========================================================================

  const el = {
    // Header
    btnHubBack: document.getElementById("btnHubBack"),
    backBtnText: document.getElementById("backBtnText"),
    btnSoundToggle: document.getElementById("btnSoundToggle"),
    iconSoundOn: document.getElementById("iconSoundOn"),
    iconSoundOff: document.getElementById("iconSoundOff"),

    // Views
    viewLobby: document.getElementById("viewLobby"),
    viewRoomLounge: document.getElementById("viewRoomLounge"),
    viewGame: document.getElementById("viewGame"),

    // Lobby Tabs & Panels
    tabOnline: document.getElementById("tabOnline"),
    tabSolo: document.getElementById("tabSolo"),
    tabSplitscreen: document.getElementById("tabSplitscreen"),
    panelOnline: document.getElementById("panelOnline"),
    panelSolo: document.getElementById("panelSolo"),
    panelSplitscreen: document.getElementById("panelSplitscreen"),
    btnGoToOnlineTab: document.getElementById("btnGoToOnlineTab"),

    // Driver Profile
    inputDriverName: document.getElementById("inputDriverName"),
    controlCarModel: document.getElementById("controlCarModel"),
    carPreviewCanvas: document.getElementById("carPreviewCanvas"),
    tsColorPalette: document.getElementById("tsColorPalette"),

    // Create / Join Race
    selectTrack: document.getElementById("selectTrack"),
    controlLaps: document.getElementById("controlLaps"),
    controlMaxPlayers: document.getElementById("controlMaxPlayers"),
    btnCreateRace: document.getElementById("btnCreateRace"),
    inputRoomCode: document.getElementById("inputRoomCode"),
    btnJoinRace: document.getElementById("btnJoinRace"),

    // Solo Panel
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

    // In-Game HUD
    raceCanvas: document.getElementById("raceCanvas"),
    minimapCanvas: document.getElementById("minimapCanvas"),
    hudPosNum: document.getElementById("hudPosNum"),
    hudPosSuffix: document.getElementById("hudPosSuffix"),
    hudLapText: document.getElementById("hudLapText"),
    driftMeterBar: document.getElementById("driftMeterBar"),
    driftMeterLabel: document.getElementById("driftMeterLabel"),
    hudCurrentTime: document.getElementById("hudCurrentTime"),
    hudBestLap: document.getElementById("hudBestLap"),
    hudSpeedNum: document.getElementById("hudSpeedNum"),
    btnQuitRace: document.getElementById("btnQuitRace"),
    countdownOverlay: document.getElementById("countdownOverlay"),
    countdownCircle: document.getElementById("countdownCircle"),
    countdownText: document.getElementById("countdownText"),
    wrongWayBanner: document.getElementById("wrongWayBanner"),

    // Touch controls
    touchControlsLayer: document.getElementById("touchControlsLayer"),
    btnTouchLeft: document.getElementById("btnTouchLeft"),
    btnTouchRight: document.getElementById("btnTouchRight"),
    btnTouchGas: document.getElementById("btnTouchGas"),
    btnTouchBrake: document.getElementById("btnTouchBrake"),

    // Podium Modal
    modalPodium: document.getElementById("modalPodium"),
    podiumTitle: document.getElementById("podiumTitle"),
    podiumDesc: document.getElementById("podiumDesc"),
    podiumStandings: document.getElementById("podiumStandings"),
    btnPodiumPlayAgain: document.getElementById("btnPodiumPlayAgain"),
    btnPodiumReturnLobby: document.getElementById("btnPodiumReturnLobby"),
  };

  // =========================================================================
  // AUDIO SYNTHESIZER (Web Audio API)
  // =========================================================================

  function initAudio() {
    if (!state.audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      state.audioCtx = new AudioCtx();
    }
  }

  function playTone(freq, dur, type = "sine", vol = 0.2) {
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

  function playBeep(isGo = false) {
    if (isGo) {
      playTone(880, 0.4, "triangle", 0.3); // High GO beep
    } else {
      playTone(440, 0.2, "square", 0.2);  // Low countdown beep
    }
  }

  function playDriftBoostSound() {
    playTone(587.33, 0.15, "sawtooth", 0.25);
    setTimeout(() => playTone(880, 0.25, "triangle", 0.3), 80);
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
      el.backBtnText.textContent = "Spillhylle";
      stopSimulation();
      stopRoomSync();
    } else if (viewName === "room") {
      el.viewRoomLounge.classList.remove("hidden");
      el.backBtnText.textContent = "Lobby";
      stopSimulation();
    } else if (viewName === "game") {
      el.viewGame.classList.remove("hidden");
      el.backBtnText.textContent = "Avslutt";
    }
  }

  // =========================================================================
  // CAR PREVIEW CANVAS (Profile Box)
  // =========================================================================

  function drawCarOnCanvas(ctx, cx, cy, angle, color, model, scale = 1.0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    // Wheels (4 tires)
    ctx.fillStyle = "#0f172a";
    // Front wheels
    ctx.fillRect(12, -14, 10, 5);
    ctx.fillRect(12, 9, 10, 5);
    // Rear wheels
    ctx.fillRect(-18, -14, 11, 5);
    ctx.fillRect(-18, 9, 11, 5);

    // Car Body Base
    ctx.fillStyle = color;
    ctx.beginPath();
    if (model === "formula") {
      // Sleek open-wheel nose
      ctx.moveTo(22, 0);
      ctx.lineTo(8, -8);
      ctx.lineTo(-20, -9);
      ctx.lineTo(-24, 0);
      ctx.lineTo(-20, 9);
      ctx.lineTo(8, 8);
      ctx.closePath();
    } else if (model === "muscle") {
      // Boxy, wide body
      ctx.roundRect(-22, -12, 44, 24, 4);
    } else {
      // Sport & Drift Spec (Aerodynamic curves)
      ctx.roundRect(-20, -11, 40, 22, 6);
    }
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Windshield & Roof
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(-6, -8, 16, 16, 3);
    ctx.fill();

    // Windshield highlight
    ctx.fillStyle = "rgba(56, 189, 248, 0.6)";
    ctx.beginPath();
    ctx.moveTo(2, -6);
    ctx.lineTo(8, -6);
    ctx.lineTo(8, 6);
    ctx.lineTo(2, 6);
    ctx.closePath();
    ctx.fill();

    // Racing stripe or accent
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.fillRect(-18, -2, 36, 4);

    // Headlights
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(17, -9, 3, 4);
    ctx.fillRect(17, 5, 3, 4);

    // Rear spoiler
    if (model === "drift" || model === "sport") {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(-22, -12, 3, 24);
    }

    ctx.restore();
  }

  function renderProfileCarPreview() {
    const canvas = el.carPreviewCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid background
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
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

    // Car centered at slight angle
    drawCarOnCanvas(ctx, canvas.width / 2, canvas.height / 2, -0.15, state.driverColor, state.carModel, 1.45);
  }

  // Populate color swatches
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
  // CAR PHYSICS & SIMULATION
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
  }

  function updateCarPhysics(car, spec, track, dt) {
    // 1. Gather inputs
    let throttle = car.accelInput;
    let brake = car.brakeInput;
    let steer = car.steerInput;

    // Apply Turbo Boost if active
    let enginePower = spec.accel;
    let maxSpeed = spec.maxSpeed;
    if (car.turboTimer > 0) {
      car.turboTimer -= dt;
      enginePower *= 1.6;
      maxSpeed *= 1.35;
      // Spawn boost flames
      addBoostParticle(car);
    }

    // 2. Heading vectors
    const forwardX = Math.cos(car.angle);
    const forwardY = Math.sin(car.angle);
    const rightX = -Math.sin(car.angle);
    const rightY = Math.cos(car.angle);

    // 3. Current velocity components
    const vForward = car.vx * forwardX + car.vy * forwardY;
    const vLateral = car.vx * rightX + car.vy * rightY;
    const speed = Math.hypot(car.vx, car.vy);
    car.speed = speed;

    // 4. Steering (scaled with forward speed)
    const steerFactor = Math.min(1.0, Math.max(0.12, speed / 140.0));
    const steerDir = vForward >= -10 ? 1 : -1; // reverse steering when going backwards
    const deltaAngle = steer * spec.turnSpeed * steerFactor * steerDir * dt;
    car.angle += deltaAngle;

    // 5. Acceleration & Braking Forces
    let fForward = 0;
    if (throttle > 0) {
      if (vForward < maxSpeed) {
        fForward += throttle * enginePower;
      }
    }
    if (brake > 0) {
      if (vForward > 10) {
        // Normal braking
        fForward -= brake * enginePower * 1.5;
      } else {
        // Reverse
        if (vForward > -spec.reverseSpeed) {
          fForward -= brake * enginePower * 0.7;
        }
      }
    }

    // Rolling resistance & air drag
    const dragCoeff = 0.0018;
    fForward -= vForward * Math.abs(vForward) * dragCoeff;
    fForward -= vForward * 1.5; // Natural friction

    // 6. Lateral Grip & Drifting Mechanics
    // When cornering hard at speed, tires lose lateral grip!
    const lateralSpeed = Math.abs(vLateral);
    const wantsDrift = lateralSpeed > spec.driftThreshold || (brake > 0 && Math.abs(steer) > 0.3 && speed > 140);

    let lateralGripFactor = spec.grip;
    if (wantsDrift && speed > 100) {
      car.isDrifting = true;
      lateralGripFactor = spec.grip * 0.25; // Tires break loose!
      car.driftAngle = Math.abs(vLateral) / (speed + 0.1);

      // Charge drift turbo meter
      car.driftBoostCharge = Math.min(1.0, car.driftBoostCharge + dt * 0.45);

      // Deposit rubber skidmarks on track
      addSkidmark(car);
      // Spawn tire smoke
      addSmokeParticle(car);
    } else {
      if (car.isDrifting && car.driftBoostCharge > 0.35) {
        // Exiting drift cleanly -> TRIGGER TURBO BOOST!
        car.turboTimer = Math.min(1.6, car.driftBoostCharge * 1.5);
        playDriftBoostSound();
      }
      car.isDrifting = false;
      car.driftBoostCharge = Math.max(0, car.driftBoostCharge - dt * 1.8);
      car.driftAngle = 0;
    }

    // Damp lateral velocity based on grip
    const newVLateral = vLateral * Math.max(0, 1 - lateralGripFactor * dt * 12.0);
    const newVForward = vForward + fForward * dt;

    // Reconstruct velocity in world coordinates
    car.vx = newVForward * forwardX + newVLateral * rightX;
    car.vy = newVForward * forwardY + newVLateral * rightY;

    // 7. Check Track Surface & Boundaries
    const trackDist = getDistanceToTrackSpine(car.x, car.y, track);
    const halfRoad = track.roadWidth * 0.5;

    if (trackDist > halfRoad + 40) {
      // Off-road Grass / Gravel! Drastic slowdown
      car.vx *= Math.pow(0.85, dt * 60);
      car.vy *= Math.pow(0.85, dt * 60);
    } else if (trackDist > halfRoad) {
      // Curbs / Rumble strips: Slight rumble & friction
      car.vx *= Math.pow(0.97, dt * 60);
      car.vy *= Math.pow(0.97, dt * 60);
    }

    // Outer perimeter barrier bounce
    const barrierLimit = halfRoad + 90;
    if (trackDist > barrierLimit) {
      // Bounce car back toward track spine
      const closest = getClosestPointOnTrack(car.x, car.y, track);
      const toTrackX = (closest.x - car.x);
      const toTrackY = (closest.y - car.y);
      const dist = Math.hypot(toTrackX, toTrackY) || 1;
      const nx = toTrackX / dist;
      const ny = toTrackY / dist;

      // Elastic reflection
      const dot = car.vx * nx + car.vy * ny;
      if (dot < 0) {
        car.vx = (car.vx - 1.4 * dot * nx) * 0.6;
        car.vy = (car.vy - 1.4 * dot * ny) * 0.6;
        playTone(160, 0.12, "sawtooth", 0.2);
        addSparkParticles(car.x, car.y);
      }
    }

    // 8. Integrate position
    car.x += car.vx * dt;
    car.y += car.vy * dt;

    // 9. Lap & Checkpoint Tracking
    updateLapAndCheckpoints(car, track);
  }

  // =========================================================================
  // TRACK GEOMETRY & CHECKPOINTS
  // =========================================================================

  function getClosestPointOnSegment(px, py, pA, pB) {
    const dx = pB.x - pA.x;
    const dy = pB.y - pA.y;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return { x: pA.x, y: pA.y, t: 0 };
    const t = Math.max(0, Math.min(1, ((px - pA.x) * dx + (py - pA.y) * dy) / l2));
    return { x: pA.x + t * dx, y: pA.y + t * dy, t };
  }

  function getClosestPointOnTrack(px, py, track) {
    let bestDist = Infinity;
    let bestPt = { x: px, y: py };
    const pts = track.points;
    for (let i = 0; i < pts.length; i++) {
      const pA = pts[i];
      const pB = pts[(i + 1) % pts.length];
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

  function updateLapAndCheckpoints(car, track) {
    if (car.finished) return;

    const pts = track.points;
    const nextCpIndex = (car.checkpoint + 1) % pts.length;
    const nextCp = pts[nextCpIndex];

    const distToNext = Math.hypot(car.x - nextCp.x, car.y - nextCp.y);

    // If within checkpoint trigger radius (roadWidth * 0.7)
    if (distToNext < track.roadWidth * 0.8) {
      if (nextCpIndex === 0 && car.checkpoint === pts.length - 1) {
        // Completed Lap!
        const now = performance.now();
        const lapDuration = (now - car.lapStartTime) / 1000.0;
        if (car.bestLap === 0 || lapDuration < car.bestLap) {
          car.bestLap = lapDuration;
        }
        car.lapStartTime = now;

        if (car.lap >= state.laps) {
          // Finished the race!
          car.finished = true;
          car.finishTime = (now - car.raceStartTime) / 1000.0;
          playTone(523.25, 0.2, "triangle", 0.3);
          setTimeout(() => playTone(659.25, 0.4, "triangle", 0.3), 150);
        } else {
          car.lap++;
          car.checkpoint = 0;
          playTone(659.25, 0.1, "triangle", 0.2);
        }
      } else if (nextCpIndex === car.checkpoint + 1) {
        car.checkpoint = nextCpIndex;
      }
    }
  }

  // Calculate dynamic rank for leaderboard
  function computeLeaderboard(allRacers, track) {
    const pts = track.points;
    return allRacers.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      if (a.lap !== b.lap) return b.lap - a.lap;
      if (a.checkpoint !== b.checkpoint) return b.checkpoint - a.checkpoint;

      // Distance to next checkpoint
      const nextA = pts[(a.checkpoint + 1) % pts.length];
      const nextB = pts[(b.checkpoint + 1) % pts.length];
      const distA = Math.hypot(a.x - nextA.x, a.y - nextA.y);
      const distB = Math.hypot(b.x - nextB.x, b.y - nextB.y);
      return distA - distB;
    });
  }

  // =========================================================================
  // PARTICLES & SKIDMARKS
  // =========================================================================

  function addSkidmark(car) {
    // 2 rear wheel positions
    const rightX = -Math.sin(car.angle);
    const rightY = Math.cos(car.angle);
    const backX = -Math.cos(car.angle) * 16;
    const backY = -Math.sin(car.angle) * 16;

    const w1X = car.x + backX - rightX * 10;
    const w1Y = car.y + backY - rightY * 10;
    const w2X = car.x + backX + rightX * 10;
    const w2Y = car.y + backY + rightY * 10;

    state.skidmarks.push({ x: w1X, y: w1Y, alpha: 0.65 });
    state.skidmarks.push({ x: w2X, y: w2Y, alpha: 0.65 });

    // Limit skidmarks to prevent performance lag
    if (state.skidmarks.length > 500) {
      state.skidmarks.splice(0, 50);
    }
  }

  function addSmokeParticle(car) {
    const backX = -Math.cos(car.angle) * 18;
    const backY = -Math.sin(car.angle) * 18;
    state.particles.push({
      x: car.x + backX + (Math.random() - 0.5) * 12,
      y: car.y + backY + (Math.random() - 0.5) * 12,
      vx: (Math.random() - 0.5) * 20 - car.vx * 0.1,
      vy: (Math.random() - 0.5) * 20 - car.vy * 0.1,
      size: 4 + Math.random() * 6,
      alpha: 0.6,
      decay: 0.75 + Math.random() * 0.4,
      color: "rgba(226, 232, 240,",
    });
  }

  function addBoostParticle(car) {
    const backX = -Math.cos(car.angle) * 22;
    const backY = -Math.sin(car.angle) * 22;
    state.particles.push({
      x: car.x + backX + (Math.random() - 0.5) * 6,
      y: car.y + backY + (Math.random() - 0.5) * 6,
      vx: -Math.cos(car.angle) * 140 + (Math.random() - 0.5) * 30,
      vy: -Math.sin(car.angle) * 140 + (Math.random() - 0.5) * 30,
      size: 6 + Math.random() * 6,
      alpha: 0.9,
      decay: 1.8,
      color: Math.random() > 0.4 ? "rgba(56, 189, 248," : "rgba(249, 115, 22,",
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
  // RENDERER: CANVAS DRAWING & CAMERA
  // =========================================================================

  function resizeCanvas() {
    const canvas = el.raceCanvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }
  }

  function drawTrack(ctx, track) {
    const pts = track.points;
    const rw = track.roadWidth;

    // 1. Asphalt Road
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Outer kerb / edge border
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.lineWidth = rw + 28;
    ctx.strokeStyle = "#334155";
    ctx.stroke();

    // Red & White kerbs (alternating dashed lines)
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.lineWidth = rw + 20;
    ctx.strokeStyle = "#ef4444";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.lineWidth = rw + 20;
    ctx.setLineDash([20, 20]);
    ctx.strokeStyle = "#f8fafc";
    ctx.stroke();
    ctx.setLineDash([]);

    // Main Dark Asphalt Surface
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.lineWidth = rw;
    ctx.strokeStyle = "#1e293b";
    ctx.stroke();

    // Road Centerline
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 24]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.stroke();
    ctx.setLineDash([]);

    // Start / Finish Line (Checkered Pattern across road)
    const p0 = pts[0];
    const p1 = pts[1];
    const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const rightX = -Math.sin(angle);
    const rightY = Math.cos(angle);

    ctx.save();
    ctx.translate(p0.x, p0.y);
    ctx.rotate(angle);

    const halfW = rw * 0.5;
    const checkerSize = 10;
    const numCols = 3;
    const numRows = Math.floor(rw / checkerSize);

    for (let c = 0; c < numCols; c++) {
      for (let r = 0; r < numRows; r++) {
        const isWhite = (c + r) % 2 === 0;
        ctx.fillStyle = isWhite ? "#ffffff" : "#0f172a";
        ctx.fillRect(-15 + c * checkerSize, -halfW + r * checkerSize, checkerSize, checkerSize);
      }
    }
    ctx.restore();
  }

  function drawSkidmarks(ctx) {
    if (!state.skidmarks.length) return;
    ctx.fillStyle = "#020617";
    for (let i = 0; i < state.skidmarks.length; i++) {
      const sm = state.skidmarks[i];
      ctx.globalAlpha = sm.alpha * 0.45;
      ctx.beginPath();
      ctx.arc(sm.x, sm.y, 2.8, 0, Math.PI * 2);
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

  function drawPlayerCar(ctx, car, color, model, name, isLocal = false) {
    // Car Body & Wheels
    drawCarOnCanvas(ctx, car.x, car.y, car.angle, color, model, 1.35);

    // Headlight Beams
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    const grad = ctx.createRadialGradient(25, 0, 10, 100, 0, 160);
    grad.addColorStop(0, "rgba(254, 240, 138, 0.28)");
    grad.addColorStop(1, "rgba(254, 240, 138, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(20, -10);
    ctx.lineTo(160, -50);
    ctx.lineTo(160, 50);
    ctx.lineTo(20, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Floating Name Tag (for opponents)
    if (!isLocal) {
      ctx.save();
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      const txt = name || "Sjåfør";
      const w = ctx.measureText(txt).width + 12;
      ctx.beginPath();
      ctx.roundRect(car.x - w / 2, car.y - 36, w, 18, 5);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.fillText(txt, car.x, car.y - 23);
      ctx.restore();
    }
  }

  function drawMinimap(track, allCars) {
    const canvas = el.minimapCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pts = track.points;
    const scaleX = (canvas.width - 24) / track.width;
    const scaleY = (canvas.height - 24) / track.height;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (canvas.width - track.width * scale) / 2;
    const offsetY = (canvas.height - track.height * scale) / 2;

    // Track path outline
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

    // Checkered Start Line dot
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(offsetX + pts[0].x * scale, offsetY + pts[0].y * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Racers dots
    allCars.forEach(c => {
      ctx.fillStyle = c.color || "#38bdf8";
      ctx.beginPath();
      ctx.arc(offsetX + c.x * scale, offsetY + c.y * scale, c.isMe ? 4.5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
      if (c.isMe) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });
  }

  // Main Render Loop
  function render(track) {
    resizeCanvas();
    const canvas = el.raceCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // Clear Screen
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Smooth Camera Follow: Local Car at center
    const targetCamX = state.myCar.x + state.myCar.vx * 0.15;
    const targetCamY = state.myCar.y + state.myCar.vy * 0.15;
    state.camera.x += (targetCamX - state.camera.x) * 0.12;
    state.camera.y += (targetCamY - state.camera.y) * 0.12;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(state.camera.zoom, state.camera.zoom);
    ctx.translate(-state.camera.x, -state.camera.y);

    // 1. Draw Track
    drawTrack(ctx, track);

    // 2. Skidmarks on road
    drawSkidmarks(ctx);

    // 3. Opponent Cars
    const allCarsForMinimap = [];
    Object.values(state.opponentCars).forEach(opp => {
      drawPlayerCar(ctx, opp, opp.color, opp.carModel, opp.name, false);
      allCarsForMinimap.push({
        x: opp.x,
        y: opp.y,
        color: opp.color,
        isMe: false,
      });
    });

    // 4. Local Player Car
    drawPlayerCar(ctx, state.myCar, state.driverColor, state.carModel, state.driverName, true);
    allCarsForMinimap.push({
      x: state.myCar.x,
      y: state.myCar.y,
      color: state.driverColor,
      isMe: true,
    });

    // 5. Smoke & Spark Particles
    drawParticles(ctx);

    ctx.restore();

    // 6. Draw Minimap
    drawMinimap(track, allCarsForMinimap);
  }

  // Format mm:ss.d
  function formatTime(seconds) {
    if (!seconds || seconds <= 0) return "--:--.-";
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    const padM = String(mins).padStart(2, "0");
    const padS = String(secs).padStart(4, "0");
    return `${padM}:${padS}`;
  }

  // Update In-Game HUD
  function updateHUD(track) {
    // Current & Best Lap Time
    const now = performance.now();
    const curLapSecs = (now - state.myCar.lapStartTime) / 1000.0;
    el.hudCurrentTime.textContent = formatTime(curLapSecs);
    el.hudBestLap.textContent = formatTime(state.myCar.bestLap);

    // Speedometer (convert px/s to ~km/h for arcade feel)
    const kmh = Math.round(state.myCar.speed * 0.48);
    el.hudSpeedNum.textContent = String(kmh);

    // Lap indicator
    el.hudLapText.textContent = `${state.myCar.lap}/${state.laps}`;

    // Drift / Boost Meter
    const pct = Math.round(state.myCar.driftBoostCharge * 100);
    el.driftMeterBar.style.width = pct + "%";
    if (state.myCar.turboTimer > 0) {
      el.driftMeterLabel.textContent = "🔥 TURBO BOOST!";
      el.driftMeterWrap.style.boxShadow = "0 0 15px rgba(56, 189, 248, 0.9)";
    } else if (state.myCar.isDrifting) {
      el.driftMeterLabel.textContent = "SLADDER...";
      el.driftMeterWrap.style.boxShadow = "0 0 12px rgba(249, 115, 22, 0.7)";
    } else {
      el.driftMeterLabel.textContent = "DRIFT BOOST";
      el.driftMeterWrap.style.boxShadow = "none";
    }

    // Dynamic Rank Position
    const allRacers = [
      {
        id: state.playerId || "local",
        lap: state.myCar.lap,
        checkpoint: state.myCar.checkpoint,
        finished: state.myCar.finished,
        finishTime: state.myCar.finishTime,
        x: state.myCar.x,
        y: state.myCar.y,
      },
      ...Object.values(state.opponentCars).map(o => ({
        id: o.id,
        lap: o.lap || 1,
        checkpoint: o.checkpoint || 0,
        finished: o.finished || false,
        finishTime: o.finishTime || 0,
        x: o.x,
        y: o.y,
      })),
    ];

    const sorted = computeLeaderboard(allRacers, track);
    const myRank = sorted.findIndex(r => r.id === (state.playerId || "local")) + 1;
    el.hudPosNum.textContent = String(myRank > 0 ? myRank : 1);
  }

  // =========================================================================
  // SIMULATION & GAME LOOP
  // =========================================================================

  let lastTime = 0;

  function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min(0.1, (timestamp - lastTime) / 1000.0);
    lastTime = timestamp;

    const track = TRACKS[state.trackId] || TRACKS.grand_prix;
    const spec = CAR_SPECS[state.carModel] || CAR_SPECS.sport;

    // Read Key & Touch Inputs into Car
    if (state.roomStatus === "racing") {
      state.myCar.accelInput = state.keys.up ? 1 : 0;
      state.myCar.brakeInput = state.keys.down ? 1 : 0;
      state.myCar.steerInput = (state.keys.right ? 1 : 0) - (state.keys.left ? 1 : 0);
    } else {
      state.myCar.accelInput = 0;
      state.myCar.brakeInput = 1;
      state.myCar.steerInput = 0;
    }

    // Update Local Car
    updateCarPhysics(state.myCar, spec, track, dt);

    // Interpolate Opponent Cars
    Object.values(state.opponentCars).forEach(opp => {
      if (opp.targetX !== undefined) {
        opp.x += (opp.targetX - opp.x) * Math.min(1.0, dt * 14.0);
        opp.y += (opp.targetY - opp.y) * Math.min(1.0, dt * 14.0);
        // Shortest angle interpolation
        let diff = opp.targetAngle - opp.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        opp.angle += diff * Math.min(1.0, dt * 14.0);

        if (opp.isDrifting) addSmokeParticle(opp);
      }
    });

    // Update Particles
    updateParticles(dt);

    // Render Frame
    render(track);

    // Update HUD
    updateHUD(track);

    // Check if finished in solo mode
    if (state.mode === "solo" && state.myCar.finished) {
      setTimeout(() => {
        showGameOverPodium([
          {
            name: state.driverName,
            color: state.driverColor,
            finishTime: state.myCar.finishTime,
            bestLap: state.myCar.bestLap,
          },
        ]);
      }, 800);
      return;
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
  // MULTIDEVICE ROOM SYNC (HTTP High-Frequency Sync)
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
    } catch (err) {
      console.warn("Sync error:", err);
    }
  }

  function handleServerStateUpdate(data) {
    const prevStatus = state.roomStatus;
    state.roomStatus = data.status;

    // Handle countdown transition
    if (data.status === "countdown") {
      el.countdownOverlay.classList.remove("hidden");
      const rem = Math.ceil(data.countdownRemaining || 3);
      el.countdownText.textContent = rem > 0 ? String(rem) : "KJØR!";
      if (rem !== state._lastCountdownVal) {
        state._lastCountdownVal = rem;
        playBeep(rem <= 0);
      }
    } else if (data.status === "racing") {
      if (prevStatus === "countdown") {
        el.countdownText.textContent = "KJØR! 🏁";
        playBeep(true);
        setTimeout(() => {
          el.countdownOverlay.classList.add("hidden");
        }, 800);
      } else {
        el.countdownOverlay.classList.add("hidden");
      }
    } else if (data.status === "finished") {
      // Race completed!
      stopRoomSync();
      const standingsPlayers = (data.players || [])
        .slice()
        .sort((a, b) => (a.finishTime || 9999) - (b.finishTime || 9999));
      showGameOverPodium(standingsPlayers);
    }

    // Update opponent targets
    (data.players || []).forEach(p => {
      if (p.id !== state.playerId) {
        if (!state.opponentCars[p.id]) {
          state.opponentCars[p.id] = {
            id: p.id,
            name: p.name,
            color: p.color,
            carModel: p.carModel,
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
    state.syncTimerId = setInterval(syncTelemetryWithServer, 70); // ~14-15 Hz sync loop
  }

  function stopRoomSync() {
    if (state.syncTimerId) {
      clearInterval(state.syncTimerId);
      state.syncTimerId = null;
    }
  }

  // =========================================================================
  // ROOM LOBBY POLLING (Waiting for host to start)
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

        // If race status turned into countdown or racing, transition to game view!
        if (data.status === "countdown" || data.status === "racing") {
          clearInterval(state.lobbyPollTimerId);
          state.lobbyPollTimerId = null;
          launchOnlineRace(data);
        }
      }
    } catch (e) {}
  }

  function startLobbyPolling() {
    stopLobbyPolling();
    pollLobbyState();
    state.lobbyPollTimerId = setInterval(pollLobbyState, 850);
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

    // Render occupied player slots
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
          <div class="racer-subtext">${p.carModel ? p.carModel.toUpperCase() : "SPORT"}</div>
        </div>
        <span class="racer-ready-tag ${p.isReady ? "ready" : "waiting"}">
          ${p.isReady ? "KLAR" : "VENTER..."}
        </span>
      `;
      el.racersGrid.appendChild(card);
    });

    // Render empty slots up to maxPlayers (configured 2-4 now, extensible to 16)
    for (let i = players.length; i < state.maxPlayers; i++) {
      const emptyCard = document.createElement("div");
      emptyCard.className = "racer-slot-card empty";
      emptyCard.innerHTML = `
        <div class="racer-slot-num">${i + 1}</div>
        <div class="racer-subtext" style="color:#64748b;">Ledig plass...</div>
      `;
      el.racersGrid.appendChild(emptyCard);
    }

    // Host controls
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

    const track = TRACKS[state.trackId] || TRACKS.grand_prix;
    const myPlayer = (data.players || []).find(p => p.id === state.playerId);
    const mySlot = myPlayer ? myPlayer.slot : 0;

    resetCarToSlot(state.myCar, track, mySlot);

    showView("game");
    startSimulation();
    startRoomSync();
  }

  // =========================================================================
  // SOLO TIME-TRIAL MODE
  // =========================================================================

  function launchSoloTimeTrial() {
    state.mode = "solo";
    state.roomStatus = "racing";
    state.opponentCars = {};
    state.skidmarks = [];
    state.particles = [];

    const track = TRACKS[state.trackId] || TRACKS.grand_prix;
    resetCarToSlot(state.myCar, track, 0);

    showView("game");
    el.countdownOverlay.classList.remove("hidden");
    el.countdownText.textContent = "KJØR! 🏁";
    playBeep(true);
    setTimeout(() => el.countdownOverlay.classList.add("hidden"), 700);

    startSimulation();
  }

  // =========================================================================
  // VICTORY PODIUM MODAL
  // =========================================================================

  function showGameOverPodium(racers) {
    stopSimulation();
    stopRoomSync();

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
        <div class="podium-time">
          ${r.finishTime > 0 ? formatTime(r.finishTime) : "Fullførte"}
        </div>
      `;
      el.podiumStandings.appendChild(row);
    });

    el.modalPodium.classList.remove("hidden");
  }

  // =========================================================================
  // INPUT & CONTROLS BINDINGS
  // =========================================================================

  function initInputHandlers() {
    // Keyboard (Arrows & WASD)
    window.addEventListener("keydown", e => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        // Prevent scrolling with arrows
        e.preventDefault();
      }
      if (e.code === "ArrowUp" || e.code === "KeyW") state.keys.up = true;
      if (e.code === "ArrowDown" || e.code === "KeyS") state.keys.down = true;
      if (e.code === "ArrowLeft" || e.code === "KeyA") state.keys.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") state.keys.right = true;
    });

    window.addEventListener("keyup", e => {
      if (e.code === "ArrowUp" || e.code === "KeyW") state.keys.up = false;
      if (e.code === "ArrowDown" || e.code === "KeyS") state.keys.down = false;
      if (e.code === "ArrowLeft" || e.code === "KeyA") state.keys.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") state.keys.right = false;
    });

    // Mobile Touch Controls
    function bindTouchBtn(btn, keyName) {
      if (!btn) return;
      const setKey = val => {
        state.keys[keyName] = val;
        btn.classList.toggle("active", val);
      };
      btn.addEventListener("touchstart", e => { e.preventDefault(); setKey(true); }, { passive: false });
      btn.addEventListener("touchend", e => { e.preventDefault(); setKey(false); }, { passive: false });
      btn.addEventListener("touchcancel", e => { e.preventDefault(); setKey(false); }, { passive: false });
      btn.addEventListener("mousedown", () => setKey(true));
      btn.addEventListener("mouseup", () => setKey(false));
      btn.addEventListener("mouseleave", () => setKey(false));
    }

    bindTouchBtn(el.btnTouchGas, "up");
    bindTouchBtn(el.btnTouchBrake, "down");
    bindTouchBtn(el.btnTouchLeft, "left");
    bindTouchBtn(el.btnTouchRight, "right");

    // Audio Toggle
    el.btnSoundToggle.addEventListener("click", () => {
      state.soundEnabled = !state.soundEnabled;
      localStorage.setItem("ts_sound", String(state.soundEnabled));
      el.iconSoundOn.classList.toggle("hidden", !state.soundEnabled);
      el.iconSoundOff.classList.toggle("hidden", state.soundEnabled);
      if (state.soundEnabled) playTone(440, 0.1);
    });

    // Driver Profile Name Input
    el.inputDriverName.value = state.driverName;
    el.inputDriverName.addEventListener("input", () => {
      state.driverName = el.inputDriverName.value.trim() || "Sjåfør 1";
      localStorage.setItem("ts_driver_name", state.driverName);
    });

    // Car Model Segmented Control
    el.controlCarModel.querySelectorAll(".seg-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        el.controlCarModel.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.carModel = btn.dataset.car || "sport";
        localStorage.setItem("ts_car_model", state.carModel);
        renderProfileCarPreview();
      });
    });

    // Lobby Mode Tabs
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

    if (el.btnGoToOnlineTab) {
      el.btnGoToOnlineTab.addEventListener("click", () => el.tabOnline.click());
    }

    // Lap Segmented Controls
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

    // Max Players Control
    el.controlMaxPlayers.querySelectorAll(".seg-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        el.controlMaxPlayers.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.maxPlayers = parseInt(btn.dataset.max || "4", 10);
      });
    });

    // Track Selectors
    el.selectTrack.addEventListener("change", () => {
      state.trackId = el.selectTrack.value;
    });
    el.selectSoloTrack.addEventListener("change", () => {
      state.trackId = el.selectSoloTrack.value;
    });

    // Create Race (Host)
    el.btnCreateRace.addEventListener("click", async () => {
      try {
        const resp = await fetch("/api/turbosladd/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hostName: state.driverName,
            color: state.driverColor,
            carModel: state.carModel,
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
            carModel: state.carModel,
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

    // Copy Room Code Button
    el.btnCopyCode.addEventListener("click", () => {
      if (state.roomCode) {
        navigator.clipboard.writeText(state.roomCode);
        playTone(659.25, 0.1);
        el.displayRoomCode.style.color = "#34d399";
        setTimeout(() => {
          el.displayRoomCode.style.color = "#38bdf8";
        }, 800);
      }
    });

    // Toggle Ready in Lounge
    let isReady = false;
    el.btnToggleReady.addEventListener("click", async () => {
      isReady = !isReady;
      el.btnToggleReady.textContent = isReady ? "Klar! (Venter)" : "Jeg er klar!";
      el.btnToggleReady.classList.toggle("btn-orange-accent", isReady);
      try {
        await fetch("/api/turbosladd/ready", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            playerId: state.playerId,
            ready: isReady,
          }),
        });
        pollLobbyState();
      } catch (e) {}
    });

    // Host Start Race Button
    el.btnHostStartRace.addEventListener("click", async () => {
      try {
        const resp = await fetch("/api/turbosladd/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            playerId: state.playerId,
          }),
        });
        const data = await resp.json();
        if (data.ok) {
          pollLobbyState();
        } else {
          alert(data.error || "Kunne ikke starte løpet.");
        }
      } catch (e) {}
    });

    // Leave Room
    el.btnLeaveRoom.addEventListener("click", async () => {
      stopLobbyPolling();
      stopRoomSync();
      try {
        await fetch("/api/turbosladd/leave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            playerId: state.playerId,
          }),
        });
      } catch (e) {}
      state.roomCode = "";
      state.playerId = "";
      showView("lobby");
    });

    // Start Solo Time-Trial
    el.btnStartSolo.addEventListener("click", () => {
      launchSoloTimeTrial();
    });

    // Quit in-game race
    el.btnQuitRace.addEventListener("click", () => {
      if (confirm("Vil du avslutte løpet og gå tilbake til lobbyen?")) {
        showView("lobby");
      }
    });

    // Podium Modal Actions
    el.btnPodiumPlayAgain.addEventListener("click", async () => {
      el.modalPodium.classList.add("hidden");
      if (state.mode === "solo") {
        launchSoloTimeTrial();
      } else if (state.isHost) {
        try {
          await fetch("/api/turbosladd/restart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomCode: state.roomCode,
              playerId: state.playerId,
            }),
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
  // INITIALIZATION
  // =========================================================================

  function init() {
    initColorPalette();
    renderProfileCarPreview();
    initInputHandlers();

    // Check URL parameters for direct room joining (e.g. ?room=TURBO)
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get("room");
    if (roomParam) {
      el.inputRoomCode.value = roomParam.trim().toUpperCase();
      el.tabOnline.click();
    }

    showView("lobby");
  }

  // Run when DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

