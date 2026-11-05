/**
 * Turbosladd - Top-down 2D Racing & Drifting Game Engine
 * Features:
 * - Single standardized high-performance drift car with custom paint
 * - Addictive, responsive drift physics: slide easily around every corner
 * - Counter-steering stabilization, tire smoke, rubber skid marks & drift turbo boost
 * - High-performance pre-rendered offscreen track caching for solid 60 FPS
 * - Multi-device synchronization over /api/turbosladd/sync and Party Lounge bridge
 * - Immediate camera centering with forward look-ahead
 * - Highly responsive keyboard controls (Arrows for P1 / Solo / Online, WASD for P2)
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

  // Single Standardized Drift Car Spec: Responsive, realistic acceleration & drifty on ice
  const CAR_SPEC = {
    name: "Turbosladd GT",
    accel: 420, // Noticeably slower, heavier acceleration giving true momentum
    maxSpeed: 520,
    reverseSpeed: 180,
    turnSpeed: 3.8,
  };

  // =========================================================================
  // =========================================================================
  // PROCEDURAL FORMEL 1 GRAND PRIX TRACK GENERATOR
  // =========================================================================

  function createF1Rng(seed) {
    let s = (typeof seed === "number" ? seed : hashString(String(seed))) >>> 0;
    if (s === 0) s = 12345;
    return function() {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return hash >>> 0;
  }

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

  function generateSmoothTrack(rawPoints, samplesPerSegment = 20) {
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

  function doLinesIntersect(p1, p2, p3, p4) {
    function ccw(A, B, C) {
      return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
    }
    return (ccw(p1, p3, p4) !== ccw(p2, p3, p4)) && (ccw(p1, p2, p3) !== ccw(p1, p2, p4));
  }

  function distToSegmentSquared(p, v, w) {
    const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
    if (l2 === 0) return (p.x - v.x) * (p.x - v.x) + (p.y - v.y) * (p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = v.x + t * (w.x - v.x);
    const projY = v.y + t * (w.y - v.y);
    return (p.x - projX) * (p.x - projX) + (p.y - projY) * (p.y - projY);
  }

  function checkTrackValid(rawPoints, minSeparation = 180) {
    const n = rawPoints.length;
    for (let i = 0; i < n; i++) {
      const a1 = rawPoints[i];
      const a2 = rawPoints[(i + 1) % n];
      for (let j = i + 2; j < n; j++) {
        if ((i === 0 && j === n - 1) || Math.abs(i - j) <= 1) continue;
        const b1 = rawPoints[j];
        const b2 = rawPoints[(j + 1) % n];
        if (doLinesIntersect(a1, a2, b1, b2)) return false;
      }
    }

    const minSepSq = minSeparation * minSeparation;
    for (let i = 0; i < n; i++) {
      const p = rawPoints[i];
      for (let j = 0; j < n; j++) {
        if (j === i || j === (i - 1 + n) % n || j === (i + 1) % n) continue;
        const v = rawPoints[j];
        const w = rawPoints[(j + 1) % n];
        if (distToSegmentSquared(p, v, w) < minSepSq) return false;
      }
    }

    return true;
  }

  function attemptGenerateF1Points(seed, worldW = 4000, worldH = 2600, archetype = null) {
    const rng = createF1Rng(seed);
    const cx = worldW * 0.5;
    const cy = worldH * 0.5;

    const arc = archetype !== null ? archetype : Math.floor(rng() * 5);
    const numCorners = 15 + Math.floor(rng() * 5);
    const rawPoints = [];

    const baseRadiusX = (worldW * 0.36) + (rng() - 0.5) * 100;
    const baseRadiusY = (worldH * 0.34) + (rng() - 0.5) * 80;

    for (let i = 0; i < numCorners; i++) {
      const frac = i / numCorners;
      const ang = (Math.PI * 0.5) - (frac * Math.PI * 2);
      let rx = baseRadiusX;
      let ry = baseRadiusY;

      if (arc === 0) { // Monza: Flat top and bottom straights, chicanes
        if (Math.abs(Math.sin(ang)) > 0.4) ry *= 0.84;
        if (Math.sin(ang) < -0.3 && Math.cos(ang) < -0.2) rx *= 0.85;
      } else if (arc === 1) { // Silverstone: Sweeping aerodynamic curves
        rx += Math.sin(ang * 3) * 120;
        ry += Math.cos(ang * 2) * 90;
      } else if (arc === 2) { // Spa: Kemmel straight, infield Pouhon/Bruxelles
        if (Math.cos(ang) > 0.1) rx *= 1.12;
        if (Math.sin(ang) < -0.2 && Math.cos(ang) < -0.1) { rx *= 0.78; ry *= 0.82; }
      } else if (arc === 3) { // Red Bull Ring: Compact, steep uphill corners
        rx *= 0.88;
        ry *= 0.90;
        if (Math.cos(ang) < -0.3) rx *= 1.1;
      } else if (arc === 4) { // Suzuka: S-curves and hairpin
        rx += Math.sin(ang * 4) * 110;
        ry += Math.cos(ang * 3) * 80;
      }

      const noise = (rng() - 0.5) * 80;
      rx += noise;
      ry += noise * 0.7;

      const px = Math.round(cx + Math.cos(ang) * rx);
      const py = Math.round(cy + Math.sin(ang) * ry);
      rawPoints.push({ x: px, y: py });
    }

    const bottomY = Math.min(worldH - 260, Math.max(rawPoints[0].y, rawPoints[numCorners - 1].y));
    const straightLength = 950 + Math.floor(rng() * 250);
    const startX = cx - straightLength * 0.25;
    const endX = cx + straightLength * 0.45;
    const entryX = cx - straightLength * 0.55;

    rawPoints[0] = { x: Math.round(startX), y: Math.round(bottomY) }; // Finish line
    rawPoints[1] = { x: Math.round(endX), y: Math.round(bottomY) };   // T1 braking zone

    const last = numCorners - 1;
    const prev = numCorners - 2;
    rawPoints[last] = { x: Math.round(entryX), y: Math.round(bottomY) }; // Straight entry
    rawPoints[prev] = { x: Math.round(entryX - 160), y: Math.round(bottomY - 140) }; // Final turn entry

    for (let i = 0; i < rawPoints.length; i++) {
      rawPoints[i].x = Math.max(220, Math.min(worldW - 220, rawPoints[i].x));
      rawPoints[i].y = Math.max(220, Math.min(worldH - 220, rawPoints[i].y));
    }

    return rawPoints;
  }

  function generateF1RawPoints(seed, worldW = 4000, worldH = 2600, archetype = null) {
    let curSeed = seed;
    for (let attempt = 0; attempt < 25; attempt++) {
      const pts = attemptGenerateF1Points(curSeed, worldW, worldH, archetype);
      if (checkTrackValid(pts, 170)) {
        return pts;
      }
      curSeed = (curSeed * 1664525 + 1013904223) >>> 0;
    }
    return attemptGenerateF1Points(seed, worldW, worldH, archetype);
  }

  function generateF1Scenery(track) {
    const rng = createF1Rng(track.seed || 12345);
    const pts = track.points;
    const rw = track.roadWidth;
    const halfRoad = rw * 0.5;
    const kerbW = 26;
    const trees = [];
    const rocks = [];
    const grandstands = [];
    const distanceBoards = [];

    // 1. Grandstands along the main straight (Start/Finish straightaway)
    const p0 = track.rawPoints[0];
    const p1 = track.rawPoints[1];
    const straightDx = p1.x - p0.x;
    const straightDy = p1.y - p0.y;
    const straightLen = Math.hypot(straightDx, straightDy) || 1;
    const straightNx = -straightDy / straightLen;
    const straightNy = straightDx / straightLen;

    // Pit Straight Grandstands on outfield (south side of track)
    for (let offset = -350; offset <= 350; offset += 180) {
      grandstands.push({
        x: Math.round(p0.x + (straightDx / straightLen) * offset + straightNx * (halfRoad + kerbW + 75)),
        y: Math.round(p0.y + (straightDy / straightLen) * offset + straightNy * (halfRoad + kerbW + 75)),
        angle: Math.atan2(straightDy, straightDx),
        length: 150,
        rows: 5,
      });
    }

    // 2. 150m, 100m, 50m Brake Marker Boards before heavy braking zones
    for (let i = 0; i < track.rawPoints.length; i++) {
      const cpPrev = track.rawPoints[(i - 1 + track.rawPoints.length) % track.rawPoints.length];
      const cpCur = track.rawPoints[i];
      const cpNext = track.rawPoints[(i + 1) % track.rawPoints.length];
      const d1x = cpCur.x - cpPrev.x;
      const d1y = cpCur.y - cpPrev.y;
      const d2x = cpNext.x - cpCur.x;
      const d2y = cpNext.y - cpCur.y;
      const angleChange = Math.abs(Math.atan2(d1x * d2y - d1y * d2x, d1x * d2x + d1y * d2y));

      if (angleChange > 0.75) {
        const segLen = Math.hypot(d1x, d1y) || 1;
        const fwdX = d1x / segLen;
        const fwdY = d1y / segLen;
        const nrmX = -fwdY;
        const nrmY = fwdX;

        [150, 100, 50].forEach(dist => {
          distanceBoards.push({
            x: Math.round(cpCur.x - fwdX * (dist * 1.6) + nrmX * (halfRoad + kerbW + 18)),
            y: Math.round(cpCur.y - fwdY * (dist * 1.6) + nrmY * (halfRoad + kerbW + 18)),
            angle: Math.atan2(d1y, d1x),
            distance: dist,
          });
        });
      }
    }

    // 3. Parkland trees & boulders along outer wilderness perimeter
    for (let x = 100; x < track.worldWidth - 100; x += 180) {
      for (let y = 100; y < track.worldHeight - 100; y += 180) {
        const rx = x + (rng() - 0.5) * 110;
        const ry = y + (rng() - 0.5) * 110;
        let minDist = Infinity;
        for (let i = 0; i < pts.length; i += 6) {
          const d = Math.hypot(rx - pts[i].x, ry - pts[i].y);
          if (d < minDist) minDist = d;
        }

        if (minDist > halfRoad + kerbW + 150 && minDist < 900) {
          if (rng() > 0.35) {
            trees.push({
              x: Math.round(rx),
              y: Math.round(ry),
              tile: rng() > 0.5 ? 1 : 0,
              size: 75 + Math.floor(rng() * 45),
            });
          } else {
            rocks.push({
              x: Math.round(rx),
              y: Math.round(ry),
              tile: rng() > 0.5 ? 1 : 0,
              size: 32 + Math.floor(rng() * 26),
            });
          }
        }
      }
    }

    return { trees, rocks, grandstands, distanceBoards };
  }

  function createF1Track(id, name, seed, archetype = null, roadWidth = 175) {
    const worldWidth = 4000;
    const worldHeight = 2600;
    const rawPoints = generateF1RawPoints(seed, worldWidth, worldHeight, archetype);
    const smoothPoints = generateSmoothTrack(rawPoints, 20);
    const n = smoothPoints.length;
    const halfRoad = roadWidth * 0.5;
    const kerbWidth = 26;

    // Curvature & Kerb placement
    const kerbs = [];
    for (let i = 0; i < n; i++) {
      const pPrev = smoothPoints[(i - 1 + n) % n];
      const pCur = smoothPoints[i];
      const pNext = smoothPoints[(i + 1) % n];

      const dx1 = pCur.x - pPrev.x;
      const dy1 = pCur.y - pPrev.y;
      const len1 = Math.hypot(dx1, dy1) || 1;

      const dx2 = pNext.x - pCur.x;
      const dy2 = pNext.y - pCur.y;
      const len2 = Math.hypot(dx2, dy2) || 1;

      const nx = -dy2 / len2;
      const ny = dx2 / len2;

      const cross = (dx1 * dy2 - dy1 * dx2) / (len1 * len2);

      if (Math.abs(cross) > 0.016) {
        const turnSign = Math.sign(cross);
        const isRed = Math.floor(i / 2) % 2 === 0;

        // Inside apex kerb
        kerbs.push({
          x: pCur.x - nx * turnSign * (halfRoad + kerbWidth * 0.5),
          y: pCur.y - ny * turnSign * (halfRoad + kerbWidth * 0.5),
          nx: nx * turnSign,
          ny: ny * turnSign,
          isRed,
          side: "inside",
        });

        // Outside exit kerb
        kerbs.push({
          x: pCur.x + nx * turnSign * (halfRoad + kerbWidth * 0.5),
          y: pCur.y + ny * turnSign * (halfRoad + kerbWidth * 0.5),
          nx: -nx * turnSign,
          ny: -ny * turnSign,
          isRed: !isRed,
          side: "outside",
        });
      }
    }

    // Infield Anti-Shortcut Barriers
    const infieldBarriers = [];
    const rawN = rawPoints.length;
    for (let i = 0; i < rawN; i++) {
      const p1 = rawPoints[i];
      const p2 = rawPoints[(i + 1) % rawN];
      const mid1 = { x: (p1.x + p2.x) * 0.5, y: (p1.y + p2.y) * 0.5 };

      for (let j = i + 2; j < rawN; j++) {
        if ((i === 0 && j === rawN - 1) || Math.abs(i - j) <= 1) continue;
        const q1 = rawPoints[j];
        const q2 = rawPoints[(j + 1) % rawN];
        const mid2 = { x: (q1.x + q2.x) * 0.5, y: (q1.y + q2.y) * 0.5 };

        const dist = Math.hypot(mid1.x - mid2.x, mid1.y - mid2.y);
        if (dist < 460 && dist > roadWidth + 50) {
          infieldBarriers.push({
            x1: Math.round((p1.x + q2.x) * 0.5),
            y1: Math.round((p1.y + q2.y) * 0.5),
            x2: Math.round((p2.x + q1.x) * 0.5),
            y2: Math.round((p2.y + q1.y) * 0.5),
          });
        }
      }
    }

    const track = {
      id,
      name,
      seed,
      worldWidth,
      worldHeight,
      roadWidth,
      kerbWidth,
      rawPoints,
      points: smoothPoints,
      checkpoints: rawPoints,
      totalPoints: smoothPoints.length,
      kerbs,
      infieldBarriers,
    };

    track.scenery = generateF1Scenery(track);
    return track;
  }

  const TRACK_PRESETS = {
    f1_random: { name: "Tilfeldig F1 GP 🎲", seed: null, arc: null },
    f1_monza: { name: "Monza Autodromo (F1)", seed: 1922, arc: 0 },
    f1_silverstone: { name: "Silverstone Circuit (F1)", seed: 1950, arc: 1 },
    f1_spa: { name: "Spa-Francorchamps (F1)", seed: 1925, arc: 2 },
    f1_redbull: { name: "Red Bull Ring (F1)", seed: 1970, arc: 3 },
    f1_suzuka: { name: "Suzuka Circuit (F1)", seed: 1962, arc: 4 },
    grand_prix: { name: "Monza Autodromo (F1)", seed: 1922, arc: 0 },
    fjord_drift: { name: "Spa-Francorchamps (F1)", seed: 1925, arc: 2 },
  };

  const trackCache = {};

  function getTrack(trackId, seed = null) {
    const tid = TRACK_PRESETS[trackId] ? trackId : "f1_random";
    const preset = TRACK_PRESETS[tid] || TRACK_PRESETS.f1_random;
    const finalSeed = (tid === "f1_random" && seed) ? seed : (preset.seed || seed || 42819);
    const cacheKey = `${tid}_${finalSeed}`;

    if (!trackCache[cacheKey]) {
      trackCache[cacheKey] = createF1Track(tid, preset.name, finalSeed, preset.arc, 175);
    }
    return trackCache[cacheKey];
  }

  const TRACKS = new Proxy({}, {
    get: (target, prop) => getTrack(prop, state.trackSeed)
  });

  // Staggered starting grid slots on the spacious F1 start straightaway (1–16 players)
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
      const distBack = 65 + row * 65;
      const lateralOffset = side * 38;

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
    mode: "online", // "online" | "solo" | "splitscreen"
    driverName: localStorage.getItem("ts_driver_name") || "Sjåfør 1",
    driverColor: localStorage.getItem("ts_driver_color") || PALETTE[0].color,
    driverAvatar: "",

    roomCode: "",
    playerId: "",
    hostToken: "",
    isHost: false,
    trackId: "f1_random",
    trackSeed: Math.floor(Math.random() * 90000) + 10000,
    laps: 3,
    maxPlayers: 4,

    roomStatus: "lobby", // "lobby" | "countdown" | "racing" | "finished"
    players: [],

    myCar: {
      x: 1200,
      y: 1500,
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

    // Splitscreen 2-Player Local State
    splitP1: {
      name: "Spiller 1",
      color: "#ef4444",
    },
    splitP2: {
      name: "Spiller 2",
      color: "#06b6d4",
    },
    splitLaps: 3,
    car1: null,
    car2: null,
    cam1: { x: 1200, y: 1500, zoom: 1.15 },
    cam2: { x: 1200, y: 1500, zoom: 1.15 },
    keysP1: { up: false, down: false, left: false, right: false },
    keysP2: { up: false, down: false, left: false, right: false },
    splitFinishTimeout: null,
    soloFinishTimer: null,

    opponentCars: {},
    camera: { x: 1200, y: 1500, zoom: 1.25 },
    skidmarks: [],
    particles: [],

    keys: { up: false, down: false, left: false, right: false },

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
    viewGame: document.getElementById("viewGame"),

    // Lobby
    tabOnline: document.getElementById("tabOnline"),
    tabSolo: document.getElementById("tabSolo"),
    tabSplitscreen: document.getElementById("tabSplitscreen"),
    panelOnline: document.getElementById("panelOnline"),
    panelSolo: document.getElementById("panelSolo"),
    panelSplitscreen: document.getElementById("panelSplitscreen"),
    btnGoToOnlineTab: document.getElementById("btnGoToOnlineTab"),

    selectSoloTrack: document.getElementById("selectSoloTrack"),
    btnRegenSoloTrack: document.getElementById("btnRegenSoloTrack"),
    controlSoloLaps: document.getElementById("controlSoloLaps"),
    btnStartSolo: document.getElementById("btnStartSolo"),

    // Splitscreen Local 2-Player Controls
    inputSplitP1Name: document.getElementById("inputSplitP1Name"),
    inputSplitP2Name: document.getElementById("inputSplitP2Name"),
    splitP1Colors: document.getElementById("splitP1Colors"),
    splitP2Colors: document.getElementById("splitP2Colors"),
    selectSplitTrack: document.getElementById("selectSplitTrack"),
    btnRegenSplitTrack: document.getElementById("btnRegenSplitTrack"),
    controlSplitLaps: document.getElementById("controlSplitLaps"),
    btnStartSplitscreen: document.getElementById("btnStartSplitscreen"),

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
    countdownOverlay: document.getElementById("countdownOverlay"),
    countdownText: document.getElementById("countdownText"),

    // Podium Modal
    modalPodium: document.getElementById("modalPodium"),
    podiumTitle: document.getElementById("podiumTitle"),
    podiumDesc: document.getElementById("podiumDesc"),
    podiumStandings: document.getElementById("podiumStandings"),
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
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220 + Math.random() * 80, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);
      gain.gain.setValueAtTime(0.055, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(state.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
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

  let lastKerbTick = 0;
  function playKerbRumble() {
    if (!state.soundEnabled) return;
    const now = performance.now();
    if (now - lastKerbTick < 70) return;
    lastKerbTick = now;
    playTone(105 + Math.random() * 25, 0.04, "square", 0.07);
  }

  // =========================================================================
  // VIEW NAVIGATION
  // =========================================================================

  function showView(viewName) {
    if (el.viewLobby) el.viewLobby.classList.add("hidden");
    if (el.viewGame) el.viewGame.classList.add("hidden");

    if (viewName === "game") {
      if (el.viewGame) el.viewGame.classList.remove("hidden");
      // Only keep 1 leave button in race: hide left back button
      if (el.btnHeaderBack) el.btnHeaderBack.classList.add("hidden");
      if (el.btnHeaderLeave) {
        el.btnHeaderLeave.classList.remove("hidden");
        el.btnHeaderLeave.textContent = "Forlat løp";
      }
      resizeCanvas();
      startEngineSound();
    } else {
      // Main Turbosladd Lobby
      if (el.viewLobby) el.viewLobby.classList.remove("hidden");
      if (el.btnHeaderBack) {
        el.btnHeaderBack.classList.remove("hidden");
        el.btnHeaderBack.href = "/";
      }
      if (el.backBtnText) el.backBtnText.textContent = "Hub";
      if (el.btnHeaderLeave) el.btnHeaderLeave.classList.add("hidden");
      stopEngineSound();
      stopSimulation();
      stopRoomSync();
      stopLobbyPolling();
    }
  }

  // =========================================================================
  // CAR MODEL SPRITE & DYNAMIC COLOR TINTING
  // =========================================================================

  const baseCarImage = new Image();
  baseCarImage.src = "/bil.png";
  const tintedCarCache = new Map();

  function hexToRgb(hex) {
    if (!hex) return { r: 56, g: 189, b: 248 };
    let c = String(hex).replace("#", "");
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    const num = parseInt(c, 16);
    if (isNaN(num)) return { r: 56, g: 189, b: 248 };
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }

  function getTintedCarCanvas(colorHex) {
    const key = (colorHex || "#ef4444").toLowerCase();
    if (tintedCarCache.has(key)) {
      return tintedCarCache.get(key);
    }
    if (!baseCarImage.complete || baseCarImage.naturalWidth === 0) {
      return null;
    }

    const w = baseCarImage.naturalWidth || 64;
    const h = baseCarImage.naturalHeight || 64;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(baseCarImage, 0, 0);

    try {
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      const target = hexToRgb(key);

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 20) continue;

        // Black outlines and performance tires remain black
        if (r === 0 && g === 0 && b === 0) continue;

        // Yellow headlights remain yellow
        if (r > 200 && g > 200 && b < 50) continue;

        // Cockpit window glass remains blueish
        if (b > r && b > g) continue;

        // Greyscale car body: tint to driver color with highlight/shadow shading
        const lum = (r + g + b) / (3.0 * 255.0);
        data[i] = Math.min(255, Math.round(target.r * lum * 1.15));
        data[i + 1] = Math.min(255, Math.round(target.g * lum * 1.15));
        data[i + 2] = Math.min(255, Math.round(target.b * lum * 1.15));
      }

      ctx.putImageData(imgData, 0, 0);
      tintedCarCache.set(key, canvas);
      return canvas;
    } catch (e) {
      return canvas;
    }
  }

  baseCarImage.onload = () => {
    tintedCarCache.clear();
    renderProfileCarPreview();
    renderLoungeCarPreview();
  };

  // =========================================================================
  // DIRT RALLY TILESET & SPRITE ASSETS (Trees & Rocks)
  // =========================================================================

  const tilemapImage = new Image();
  tilemapImage.src = "/turbosladd/map_assets_tilemap.png";
  let treeCanopyCanvas = null;
  let treeShadowCanvas = null;

  function initTilemapAssets() {
    if (!tilemapImage.complete || tilemapImage.naturalWidth === 0) return;
    try {
      const w = tilemapImage.naturalWidth || 32;
      const h = tilemapImage.naturalHeight || 32;

      // 1. Canopy canvas: only foliage (alpha >= 200) for overhead drawing above cars
      treeCanopyCanvas = document.createElement("canvas");
      treeCanopyCanvas.width = 32;
      treeCanopyCanvas.height = 16;
      const cCtx = treeCanopyCanvas.getContext("2d");
      cCtx.drawImage(tilemapImage, 0, 0);
      const cData = cCtx.getImageData(0, 0, 32, 16);
      for (let i = 0; i < cData.data.length; i += 4) {
        if (cData.data[i + 3] < 200) {
          cData.data[i + 3] = 0; // Strip ground shadows from the overhead canopy layer
        }
      }
      cCtx.putImageData(cData, 0, 0);

      // 2. Tree ground shadow canvas
      treeShadowCanvas = document.createElement("canvas");
      treeShadowCanvas.width = 32;
      treeShadowCanvas.height = 16;
      const sCtx = treeShadowCanvas.getContext("2d");
      sCtx.drawImage(tilemapImage, 0, 0);
      const sData = sCtx.getImageData(0, 0, 32, 16);
      for (let i = 0; i < sData.data.length; i += 4) {
        if (sData.data[i + 3] >= 200) {
          sData.data[i + 3] = 0;
        } else if (sData.data[i + 3] > 0) {
          sData.data[i + 3] = Math.min(255, Math.round(sData.data[i + 3] * 1.6));
        }
      }
      sCtx.putImageData(sData, 0, 0);

      // Invalidate offscreen track canvas so scenery re-renders
      cachedTrackId = null;
      cachedTrackCanvas = null;
    } catch (e) {
      console.warn("Tilemap asset init warning:", e);
    }
  }

  tilemapImage.onload = () => {
    initTilemapAssets();
  };
  if (tilemapImage.complete) {
    initTilemapAssets();
  }

  function drawCarOnCanvas(ctx, cx, cy, angle, color, scale = 1.0, steerInput = 0, isBraking = false) {
    ctx.save();
    ctx.translate(cx, cy);

    // bil.png points UP. Angle = 0 in game physics points RIGHT.
    // Rotate 90 deg so the sprite's nose points along car.angle.
    ctx.rotate(angle + Math.PI / 2);
    ctx.scale(scale, scale);

    const sprite = getTintedCarCanvas(color);
    if (sprite) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, -32, -32, 64, 64);
    } else {
      // Clean fallback placeholder while image loads
      ctx.fillStyle = color || "#ef4444";
      ctx.beginPath();
      ctx.roundRect(-15, -25, 30, 50, 5);
      ctx.fill();
    }

    // Rear glowing brake lights when braking
    if (isBraking) {
      ctx.fillStyle = "#ff2222";
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 8;
      ctx.fillRect(-14, 23, 6, 4);
      ctx.fillRect(8, 23, 6, 4);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  function extractCharacterColor(avatarId, fallbackColor = "#ef4444") {
    if (!avatarId) return fallbackColor;
    if (typeof CharacterCreator !== "undefined" && typeof CharacterCreator.parseConfig === "function") {
      try {
        const cfg = CharacterCreator.parseConfig(avatarId);
        if (cfg && cfg.headColor) return cfg.headColor;
      } catch (e) {}
    }
    const str = String(avatarId).trim();
    if (str.startsWith("char:")) {
      for (const part of str.slice(5).split(":")) {
        if (part.startsWith("c_")) return "#" + part.slice(2).toLowerCase();
        if (part.startsWith("c") && !part.startsWith("char")) return "#" + part.slice(1).toLowerCase();
      }
    }
    if (str.startsWith("#") && (str.length === 4 || str.length === 7)) return str.toLowerCase();
    return fallbackColor;
  }

  let selectedAvatar = null;
  let selectedAvatarStr = "";

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

    // Draw car model facing upwards in preview with driver's active tint
    drawCarOnCanvas(ctx, canvas.width / 2, canvas.height / 2, -Math.PI / 2, state.driverColor, 1.25, 0);
  }

  function renderLoungeCarPreview() {
    const canvas = el.loungeCarPreviewCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
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

    // In lounge, display the car tinted with driver's assigned/chosen color
    drawCarOnCanvas(ctx, canvas.width / 2, canvas.height / 2, -Math.PI / 2, state.driverColor || "#ef4444", 1.15, 0);

    if (el.loungeCarColorName) {
      const match = PALETTE.find(p => p.color.toLowerCase() === (state.driverColor || "").toLowerCase());
      el.loungeCarColorName.textContent = match ? match.name : "Valgt lakk";
      el.loungeCarColorName.style.color = state.driverColor || "#38bdf8";
    }
  }

  function renderLoungeColorPalette(players = []) {
    if (!el.loungeColorPalette) return;
    el.loungeColorPalette.innerHTML = "";

    // Map of taken colors by OTHER active players in the room
    const takenByOthers = new Map();
    (players || []).forEach(p => {
      if (p.id !== state.playerId && p.color) {
        takenByOthers.set(p.color.toLowerCase(), p.name || "En annen spiller");
      }
    });

    PALETTE.forEach(item => {
      const isSelected = item.color.toLowerCase() === (state.driverColor || "").toLowerCase();
      const takenBy = takenByOthers.get(item.color.toLowerCase());
      const isTaken = Boolean(takenBy);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lcpc-swatch" +
        (isSelected ? " active" : "") +
        (isTaken ? " taken" : "");
      btn.style.setProperty("--swatch-color", item.color);
      btn.style.backgroundColor = item.color;

      if (isTaken) {
        btn.title = `${item.name} (Tatt av ${takenBy})`;
        btn.disabled = true;
      } else if (isSelected) {
        btn.title = `${item.name} (Din valgte farge)`;
      } else {
        btn.title = `Velg ${item.name}`;
        btn.addEventListener("click", () => handleSelectLobbyColor(item.color));
      }

      el.loungeColorPalette.appendChild(btn);
    });
  }

  async function handleSelectLobbyColor(newColor) {
    if (!state.roomCode || !state.playerId) return;
    if (state.driverColor && state.driverColor.toLowerCase() === newColor.toLowerCase()) return;

    try {
      const res = await fetch("/api/turbosladd/color", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          color: newColor,
        }),
      });
      const data = await res.json();
      if (data && data.ok) {
        state.driverColor = newColor;
        localStorage.setItem("ts_driver_color", newColor);
        renderLoungeCarPreview();
        pollLobbyState();
      } else {
        alert(data.error || "Fargen er dessverre opptatt av en annen sjåfør.");
      }
    } catch (err) {
      console.error("Feil ved endring av lakkfarge:", err);
    }
  }

  function updateDriverProfileUI() {
    // 1. Character avatar circular preview image
    if (el.onlineAvatarPreview && typeof CharacterCreator !== "undefined") {
      el.onlineAvatarPreview.src = CharacterCreator.getAvatarImgSrc(selectedAvatarStr);
    }

    // 2. Refresh car preview canvas
    renderProfileCarPreview();

    // 3. Update text color display
    if (el.carColorNameDisplay) {
      const match = PALETTE.find(p => p.color.toLowerCase() === state.driverColor.toLowerCase());
      el.carColorNameDisplay.textContent = match ? match.name : "Valgt lakk";
      el.carColorNameDisplay.style.color = state.driverColor;
    }

    // 4. Quick color swatches (matching character creator head colors)
    if (el.cpwQuickColors) {
      el.cpwQuickColors.innerHTML = "";
      const colors = (typeof CharacterCreator !== "undefined" && CharacterCreator.HEAD_COLORS)
        ? CharacterCreator.HEAD_COLORS.slice(0, 10).map(c => ({ color: c.hex, name: c.name }))
        : PALETTE.slice(0, 10);

      colors.forEach(col => {
        const sw = document.createElement("button");
        sw.type = "button";
        sw.className = "cpw-quick-swatch" + (col.color.toLowerCase() === state.driverColor.toLowerCase() ? " active" : "");
        sw.style.backgroundColor = col.color;
        sw.title = col.name;
        sw.addEventListener("click", () => {
          state.driverColor = col.color;
          localStorage.setItem("ts_driver_color", col.color);
          if (typeof CharacterCreator !== "undefined" && selectedAvatar) {
            selectedAvatar.headColor = col.color;
            selectedAvatarStr = CharacterCreator.saveCharacter(selectedAvatar);
          }
          updateDriverProfileUI();
        });
        el.cpwQuickColors.appendChild(sw);
      });
    }
  }

  function openCharCreatorModal() {
    if (typeof CharacterCreator === "undefined") return;
    CharacterCreator.openModal({
      initialConfig: selectedAvatarStr,
      onSave: (newCfg) => {
        selectedAvatar = newCfg;
        selectedAvatarStr = CharacterCreator.encodeConfig(newCfg);
        if (newCfg.headColor) {
          state.driverColor = newCfg.headColor;
          localStorage.setItem("ts_driver_color", newCfg.headColor);
        }
        updateDriverProfileUI();
      },
    });
  }

  function initCharacterProfile() {
    const savedPartyAvatar = sessionStorage.getItem("party_avatar") || localStorage.getItem("party_avatar");
    if (savedPartyAvatar) {
      selectedAvatarStr = savedPartyAvatar;
      const c = extractCharacterColor(savedPartyAvatar);
      if (c) {
        state.driverColor = c;
        localStorage.setItem("ts_driver_color", c);
      }
    } else if (typeof CharacterCreator !== "undefined") {
      selectedAvatar = CharacterCreator.getSavedCharacter();
      selectedAvatarStr = CharacterCreator.encodeConfig(selectedAvatar);
      if (selectedAvatar && selectedAvatar.headColor) {
        state.driverColor = selectedAvatar.headColor;
        localStorage.setItem("ts_driver_color", state.driverColor);
      }
    } else {
      state.driverColor = localStorage.getItem("ts_driver_color") || PALETTE[0].color;
    }

    const savedName = (
      sessionStorage.getItem("party_player_name") ||
      localStorage.getItem("party_player_name") ||
      localStorage.getItem("spillhjornet_player_name") ||
      localStorage.getItem("ts_driver_name") ||
      "Sjåfør 1"
    );
    state.driverName = savedName;
    if (el.inputHostName) el.inputHostName.value = savedName;
    if (el.inputJoinName) el.inputJoinName.value = savedName;
    updateDriverProfileUI();
  }

  // =========================================================================
  // ENHANCED DRIFT PHYSICS & SIMULATION
  // =========================================================================

  function createCarState(slotIndex, track) {
    const slots = getStartGridSlots(track, 16);
    const slot = slots[slotIndex % slots.length];
    return {
      x: slot.x,
      y: slot.y,
      angle: slot.angle,
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
      lapStartTime: performance.now(),
      raceStartTime: performance.now(),
    };
  }

  function resetCarToSlot(car, track, slotIndex) {
    const fresh = createCarState(slotIndex, track);
    Object.assign(car, fresh);

    // Immediately snap camera to the car
    state.camera.x = fresh.x;
    state.camera.y = fresh.y;
    state.camera.zoom = 1.25;
  }

  function resolveCarCarCollision(c1, c2) {
    if (!c1 || !c2) return;
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const dist = Math.hypot(dx, dy);
    const minDist = 36;
    if (dist < minDist && dist > 0.001) {
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = 0.5 * (minDist - dist);
      c1.x -= nx * overlap;
      c1.y -= ny * overlap;
      c2.x += nx * overlap;
      c2.y += ny * overlap;

      const rvx = c1.vx - c2.vx;
      const rvy = c1.vy - c2.vy;
      const velAlongNormal = rvx * nx + rvy * ny;
      if (velAlongNormal > 0) {
        const impulse = 1.35 * velAlongNormal;
        c1.vx -= impulse * 0.5 * nx;
        c1.vy -= impulse * 0.5 * ny;
        c2.vx += impulse * 0.5 * nx;
        c2.vy += impulse * 0.5 * ny;
        addSparkParticles((c1.x + c2.x) * 0.5, (c1.y + c2.y) * 0.5);
        playTone(180, 0.09, "sawtooth", 0.25);
      }
    }
  }

  function updateCarPhysics(car, track, dt) {
    const throttle = car.accelInput;
    const brake = car.brakeInput;
    const steer = car.steerInput;

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
    // 2. Tapping brake while steering at speed
    const isSlidingOnIce = (absSlip > 0.18 && speed > 35) ||
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

    // Surface detection & driving physics (Asphalt, Kerbs, Run-off / "The Grey", Grass)
    const closest = getClosestPointOnTrack(car.x, car.y, track);
    const toTrackX = closest.x - car.x;
    const toTrackY = closest.y - car.y;
    const trackDist = Math.hypot(toTrackX, toTrackY);
    const halfRoad = track.roadWidth * 0.5;
    const kerbWidth = track.kerbWidth || 26;
    const runoffWidth = 90; // The grey asphalt run-off buffer outside kerbs

    const onAsphalt = trackDist <= halfRoad;
    const onKerb = !onAsphalt && trackDist <= halfRoad + kerbWidth;
    const onRunoff = !onAsphalt && !onKerb && trackDist <= halfRoad + kerbWidth + runoffWidth;
    const onGrass = trackDist > halfRoad + kerbWidth + runoffWidth;

    // Lateral grip retention according to surface
    const latRetention = onGrass ? 0.91 : (onRunoff ? 0.94 : (isSlidingOnIce ? 0.978 : 0.88));
    let newVLateral = vLateral * Math.pow(latRetention, dt * 60);

    // Forward drive & slide braking on surface
    let newVForward = vForward;

    if (onKerb) {
      // Drivable at full speed! Tactile rumble vibration & subtle curb tick
      if (car.speed > 35) {
        playKerbRumble();
      }
    } else if (onRunoff) {
      // Drivable on the grey run-off area! Slightly looser lateral grip, smooth racing
      newVLateral *= Math.pow(0.96, dt * 60);
      if (Math.abs(newVLateral) > 25 && Math.random() < 0.2) {
        addRallyDustParticle(car);
      }
    } else if (onGrass) {
      // Drivable on grass! Smooth rolling deceleration & grass particles
      newVForward *= Math.pow(0.93, dt * 60);
      newVLateral *= Math.pow(0.92, dt * 60);
      if (Math.abs(newVForward) > 270) {
        newVForward -= Math.sign(newVForward) * 350 * dt;
      }
      if (car.speed > 20) {
        addGrassParticle(car);
      }
    }

    const effectiveEnginePower = onGrass ? (enginePower * 0.55) : (onRunoff ? enginePower * 0.88 : enginePower);
    const effectiveMaxSpeed = onGrass ? Math.min(maxSpeed, 270) : maxSpeed;

    if (throttle > 0 && newVForward < effectiveMaxSpeed) {
      newVForward += throttle * effectiveEnginePower * dt;
    }
    if (brake > 0) {
      if (newVForward > 15) {
        newVForward *= Math.pow(0.965, dt * 60);
        newVLateral *= Math.pow(0.965, dt * 60);
        newVForward -= brake * effectiveEnginePower * 0.35 * dt;
      } else if (newVForward > -CAR_SPEC.reverseSpeed) {
        newVForward -= brake * effectiveEnginePower * 0.7 * dt;
      }
    }

    // Rolling drag: low on asphalt/kerb (0.996), mild on grey runoff (0.988), higher on grass (0.93)
    const rollingDrag = onGrass ? 0.93 : (onRunoff ? 0.988 : (onKerb ? 0.994 : 0.996));
    newVForward *= Math.pow(rollingDrag, dt * 60);

    car.vx = newVForward * forwardX + newVLateral * rightX;
    car.vy = newVForward * forwardY + newVLateral * rightY;

    if (!Number.isFinite(car.vx)) car.vx = 0;
    if (!Number.isFinite(car.vy)) car.vy = 0;

    // 1. Solid Outer Runoff Barriers (F1 Armco Crash Barrier)
    const wallCollisionDist = halfRoad + kerbWidth + 140;

    if (trackDist > wallCollisionDist) {
      const d = trackDist || 1;
      const nx = toTrackX / d;
      const ny = toTrackY / d;

      // Keep car firmly inside outer run-off barrier
      car.x = closest.x - nx * wallCollisionDist;
      car.y = closest.y - ny * wallCollisionDist;

      // Normal velocity component towards track
      const dot = car.vx * nx + car.vy * ny;
      if (dot < 0) {
        car.vx = (car.vx - 1.5 * dot * nx) * 0.72;
        car.vy = (car.vy - 1.5 * dot * ny) * 0.72;
        const now = performance.now();
        if (!car.lastWallHit || now - car.lastWallHit > 120) {
          car.lastWallHit = now;
          playTone(150, 0.12, "sawtooth", 0.32);
          addSparkParticles(car.x, car.y);
        }
      }
    }

    // 2. Infield Anti-Shortcut Barriers (Block cutting straight across grass infields!)
    if (track.infieldBarriers && track.infieldBarriers.length > 0) {
      for (let b = 0; b < track.infieldBarriers.length; b++) {
        const bar = track.infieldBarriers[b];
        const bcp = getClosestPointOnSegment(car.x, car.y, { x: bar.x1, y: bar.y1 }, { x: bar.x2, y: bar.y2 });
        const toBarX = car.x - bcp.x;
        const toBarY = car.y - bcp.y;
        const barDist = Math.hypot(toBarX, toBarY);
        const barRadius = 22;

        if (barDist < barRadius) {
          let bnx = toBarX;
          let bny = toBarY;
          if (barDist < 0.001) {
            bnx = 1;
            bny = 0;
          } else {
            bnx /= barDist;
            bny /= barDist;
          }

          car.x = bcp.x + bnx * barRadius;
          car.y = bcp.y + bny * barRadius;

          const bDot = car.vx * bnx + car.vy * bny;
          if (bDot < 0) {
            car.vx = (car.vx - 1.6 * bDot * bnx) * 0.7;
            car.vy = (car.vy - 1.6 * bDot * bny) * 0.7;
            const now = performance.now();
            if (!car.lastBarrierHit || now - car.lastBarrierHit > 120) {
              car.lastBarrierHit = now;
              playTone(160, 0.14, "sawtooth", 0.35);
              addSparkParticles(car.x, car.y);
            }
          }
        }
      }
    }

    // 3. World Boundary Limits
    const wWidth = track.worldWidth || 4000;
    const wHeight = track.worldHeight || 2600;
    car.x = Math.max(60, Math.min(wWidth - 60, car.x));
    car.y = Math.max(60, Math.min(wHeight - 60, car.y));

    car.x += car.vx * dt;
    car.y += car.vy * dt;

    if (!Number.isFinite(car.x) || !Number.isFinite(car.y)) {
      car.x = track.rawPoints[0].x;
      car.y = track.rawPoints[0].y;
      car.vx = 0;
      car.vy = 0;
    }

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
    for (let i = 0; i < pts.length; i += 2) {
      const pA = pts[i];
      const pB = pts[(i + 2) % pts.length];
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

    if (nextIdx === 0) {
      // Crossing Finish Line (checkpoint 0)
      // Car MUST have passed all preceding checkpoints (car.checkpoint === cps.length - 1)
      if (car.checkpoint === cps.length - 1) {
        const p0 = cps[0];
        const p1 = cps[1];
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const len = Math.hypot(dx, dy) || 1;
        const forwardX = dx / len;
        const forwardY = dy / len;
        const rightX = -forwardY;
        const rightY = forwardX;

        // Position relative to start/finish line center p0
        const toCarX = car.x - p0.x;
        const toCarY = car.y - p0.y;
        const forwardDist = toCarX * forwardX + toCarY * forwardY;
        const lateralDist = Math.abs(toCarX * rightX + toCarY * rightY);

        // Check if car actually reaches or crosses the checkered line:
        // forwardDist >= -24: front reaches the checkered line
        // forwardDist <= 160: within reasonable window past the finish line
        // lateralDist <= track.roadWidth * 0.85: within track limits / kerbs
        if (forwardDist >= -24 && forwardDist <= 160 && lateralDist <= track.roadWidth * 0.85) {
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
        }
      }
    } else {
      // Intermediate checkpoints
      const nextCp = cps[nextIdx];
      const dist = Math.hypot(car.x - nextCp.x, car.y - nextCp.y);
      if (dist < track.roadWidth * 1.35) {
        if (nextIdx === car.checkpoint + 1) {
          car.checkpoint = nextIdx;
        }
      }
    }
  }

  // =========================================================================
  // PARTICLES & SKIDMARKS (F1 Tarmac & Grass Style)
  // =========================================================================

  function addGrassParticle(car) {
    const rightX = -Math.sin(car.angle);
    const rightY = Math.cos(car.angle);
    const backX = -Math.cos(car.angle) * 16;
    const backY = -Math.sin(car.angle) * 16;

    [-9, 9].forEach(sideOffset => {
      const startX = car.x + backX + rightX * sideOffset;
      const startY = car.y + backY + rightY * sideOffset;
      const sprayAngle = Math.atan2(car.vy || 1, car.vx || 1) + Math.PI + (Math.random() - 0.5) * 0.9;
      const spraySpeed = (car.speed * 0.22) + 16 + Math.random() * 40;

      const grassColors = [
        "rgba(52, 168, 83,",
        "rgba(34, 197, 94,",
        "rgba(22, 101, 52,",
        "rgba(21, 128, 61,",
        "rgba(40, 26, 15,"
      ];
      const col = grassColors[Math.floor(Math.random() * grassColors.length)];

      state.particles.push({
        x: startX + (Math.random() - 0.5) * 4,
        y: startY + (Math.random() - 0.5) * 4,
        vx: Math.cos(sprayAngle) * spraySpeed + (Math.random() - 0.5) * 12,
        vy: Math.sin(sprayAngle) * spraySpeed + (Math.random() - 0.5) * 12,
        size: 3 + Math.random() * 4,
        alpha: 0.9,
        decay: 1.8,
        color: col,
      });
    });
  }

  function addSkidmark(car) {
    const rightX = -Math.sin(car.angle);
    const rightY = Math.cos(car.angle);
    const backX = -Math.cos(car.angle) * 16;
    const backY = -Math.sin(car.angle) * 16;

    // Packed dirt tire ruts
    state.skidmarks.push({ x: car.x + backX - rightX * 11, y: car.y + backY - rightY * 11, alpha: 0.72 });
    state.skidmarks.push({ x: car.x + backX + rightX * 11, y: car.y + backY + rightY * 11, alpha: 0.72 });

    if (state.skidmarks.length > 700) {
      state.skidmarks.splice(0, 60);
    }
  }

  function addRallyDustParticle(car) {
    const rightX = -Math.sin(car.angle);
    const rightY = Math.cos(car.angle);
    const backX = -Math.cos(car.angle) * 16;
    const backY = -Math.sin(car.angle) * 16;

    // Both left and right rear tires throw up chunky dirt dust clouds & flying gravel
    [-10, 10].forEach(sideOffset => {
      const startX = car.x + backX + rightX * sideOffset;
      const startY = car.y + backY + rightY * sideOffset;
      const sprayAngle = Math.atan2(car.vy || 1, car.vx || 1) + Math.PI + (Math.random() - 0.5) * 0.85;
      const spraySpeed = (car.speed * 0.28) + 24 + Math.random() * 50;

      // Earthy rally dust tones: tan, light ochre, dirt clay, and coarse gravel
      const dustColors = [
        "rgba(214, 168, 120,",
        "rgba(186, 138, 92,",
        "rgba(142, 94, 48,",
        "rgba(92, 58, 30,"
      ];
      const col = dustColors[Math.floor(Math.random() * dustColors.length)];

      state.particles.push({
        x: startX + (Math.random() - 0.5) * 5,
        y: startY + (Math.random() - 0.5) * 5,
        vx: Math.cos(sprayAngle) * spraySpeed + (Math.random() - 0.5) * 15,
        vy: Math.sin(sprayAngle) * spraySpeed + (Math.random() - 0.5) * 15,
        size: 3 + Math.random() * 5,
        alpha: 0.88,
        decay: 1.4,
        color: col,
      });

      // Occasional flying gravel pebble
      if (Math.random() < 0.35) {
        const pAngle = sprayAngle + (Math.random() - 0.5) * 0.6;
        const pSpeed = spraySpeed * 1.35;
        state.particles.push({
          x: startX,
          y: startY,
          vx: Math.cos(pAngle) * pSpeed,
          vy: Math.sin(pAngle) * pSpeed,
          size: 2,
          alpha: 1.0,
          decay: 2.2,
          color: "rgba(50, 32, 18,",
        });
      }
    });
  }

  const addIceSprayParticle = addRallyDustParticle;
  const addSmokeParticle = addRallyDustParticle;

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
        size: 4.5 + Math.random() * 5.5,
        alpha: 0.95,
        decay: 2.1,
        color: Math.random() > 0.35 ? "rgba(249, 115, 22," : "rgba(251, 191, 36,",
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
    if (state.particles.length > 350) {
      state.particles.splice(0, state.particles.length - 350);
    }
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
  // PRE-RENDERED OFFSCREEN FORMULA 1 TRACK CACHING (Solid 60 FPS)
  // =========================================================================

  let cachedTrackKey = null;
  let cachedTrackCanvas = null;

  function renderTrackToOffscreen(track) {
    const pts = track.points;
    const rw = track.roadWidth || 175;
    const halfRoad = rw * 0.5;
    const kerbW = track.kerbWidth || 26;
    const worldW = track.worldWidth || 4000;
    const worldH = track.worldHeight || 2600;

    const canvas = document.createElement("canvas");
    canvas.width = worldW;
    canvas.height = worldH;
    const ctx = canvas.getContext("2d");

    // 1. Lush Manicured F1 Racecourse Emerald Lawn
    ctx.fillStyle = "#1b431e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Alternating Lawn-Mowing Stripes across outfield & infield
    for (let x = 0; x < canvas.width; x += 120) {
      if ((Math.floor(x / 120)) % 2 === 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
        ctx.fillRect(x, 0, 120, canvas.height);
      }
    }

    // 3. Procedural turf & grass flecks
    const bgRng = createF1Rng(track.seed || 12345);
    for (let i = 0; i < 3000; i++) {
      const px = Math.floor(bgRng() * canvas.width);
      const py = Math.floor(bgRng() * canvas.height);
      const roll = bgRng();
      if (roll < 0.4) {
        ctx.fillStyle = "#153818";
      } else if (roll < 0.75) {
        ctx.fillStyle = "#225325";
      } else {
        ctx.fillStyle = "#2a632e";
      }
      const sz = Math.floor(bgRng() * 3) * 2 + 2;
      ctx.fillRect(px, py, sz, sz);
    }

    // 4. Closed track loop path
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();

    // 5. Outer Run-off Area (Asphalt run-off buffer outside curves)
    ctx.lineWidth = rw + 2 * (kerbW + 140);
    ctx.strokeStyle = "rgba(15, 23, 42, 0.7)";
    ctx.stroke();

    ctx.lineWidth = rw + 2 * (kerbW + 90);
    ctx.strokeStyle = "#2d333b"; // Dark asphalt run-off
    ctx.stroke();

    // 6. Outer Armco Crash Barrier (Wall perimeter)
    // Shadow
    ctx.lineWidth = rw + 2 * (kerbW + 140) + 12;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
    ctx.stroke();

    // Steel Barrier Beam
    ctx.lineWidth = rw + 2 * (kerbW + 140) + 6;
    ctx.strokeStyle = "#475569";
    ctx.stroke();

    // Galvanized Rail Top Highlight
    ctx.lineWidth = rw + 2 * (kerbW + 140) + 2;
    ctx.strokeStyle = "#94a3b8";
    ctx.stroke();

    // 7. Infield Anti-Shortcut Barriers
    if (track.infieldBarriers && track.infieldBarriers.length > 0) {
      track.infieldBarriers.forEach(b => {
        // Barrier shadow
        ctx.lineWidth = 14;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
        ctx.beginPath();
        ctx.moveTo(b.x1 + 3, b.y1 + 4);
        ctx.lineTo(b.x2 + 3, b.y2 + 4);
        ctx.stroke();

        // Steel barrier body
        ctx.lineWidth = 10;
        ctx.strokeStyle = "#334155";
        ctx.beginPath();
        ctx.moveTo(b.x1, b.y1);
        ctx.lineTo(b.x2, b.y2);
        ctx.stroke();

        // Top rail highlight
        ctx.lineWidth = 6;
        ctx.strokeStyle = "#94a3b8";
        ctx.stroke();

        // Warning Hazard Stripes
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#ef4444";
        ctx.setLineDash([16, 16]);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // 8. Red & White Rumble Kerbs ("de røde og hvite delene")
    if (track.kerbs && track.kerbs.length > 0) {
      track.kerbs.forEach(k => {
        ctx.save();
        ctx.translate(k.x, k.y);
        ctx.rotate(Math.atan2(k.ny, k.nx));
        // Alternating red and white curb block
        ctx.fillStyle = k.isRed ? "#dc2626" : "#f8fafc";
        ctx.fillRect(-11, -kerbW * 0.5, 22, kerbW);

        // 3D rumble strip bevel shadow & highlight
        ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
        ctx.fillRect(-11, kerbW * 0.5 - 3, 22, 3);
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.fillRect(-11, -kerbW * 0.5, 22, 3);
        ctx.restore();
      });
    }

    // 9. Main Circuit Asphalt / Tarmac
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();

    // Outer White Track Limit Boundary Lines
    ctx.lineWidth = rw;
    ctx.strokeStyle = "#f8fafc";
    ctx.stroke();

    // Dark Smooth Tarmac Surface
    ctx.lineWidth = rw - 6;
    ctx.strokeStyle = "#23262d";
    ctx.stroke();

    // Subtle Racing Line Rubber Groove
    ctx.lineWidth = rw * 0.42;
    ctx.strokeStyle = "#1b1d24";
    ctx.stroke();

    // Fine asphalt texture grains
    for (let i = 0; i < pts.length; i += 3) {
      const pt = pts[i];
      for (let s = 0; s < 4; s++) {
        const offX = (bgRng() - 0.5) * (rw * 0.85);
        const offY = (bgRng() - 0.5) * (rw * 0.85);
        ctx.fillStyle = bgRng() > 0.5 ? "#181a20" : "#2f343e";
        const sz = bgRng() > 0.8 ? 3 : 2;
        ctx.fillRect(Math.round(pt.x + offX), Math.round(pt.y + offY), sz, sz);
      }
    }

    // 10. Starting Grid Boxes (Slots 1..16 along the Main Straight)
    const slots = getStartGridSlots(track, 16);
    slots.forEach((s, idx) => {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.strokeStyle = "rgba(248, 250, 252, 0.85)";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-26, -18, 52, 36);
      ctx.fillStyle = "#fbbf24";
      ctx.font = "900 13px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(idx + 1), -18, 0);
      ctx.restore();
    });

    // 11. Checkered Start / Finish Line
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
        ctx.fillStyle = (c + r) % 2 === 0 ? "#ffffff" : "#111827";
        ctx.fillRect(-28 + c * boxSize, -halfW + r * boxSize, boxSize, boxSize);
      }
    }

    // 12. Formula 1 Overhead Start/Finish Gantry & Pit Wall
    // Gantry Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(-22, -halfW - 32, 44, rw + 64);

    // Gantry Pillars
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(-18, -halfW - 30, 36, 22);
    ctx.fillRect(-18, halfW + 8, 36, 22);

    ctx.fillStyle = "#475569";
    ctx.fillRect(-16, -halfW - 28, 32, 18);
    ctx.fillRect(-16, halfW + 10, 32, 18);

    // Overhead Gantry Span Truss
    ctx.fillStyle = "#334155";
    ctx.fillRect(-12, -halfW - 10, 24, rw + 20);

    // 5 Red Starting Lights on Gantry
    for (let light = 0; light < 5; light++) {
      const ly = -32 + light * 16;
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(-8, ly - 6, 16, 12);
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(0, ly, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // 13. Pit Wall along inside of Main Straight with Sponsor Hoardings
    ctx.save();
    ctx.translate(p0.x, p0.y);
    ctx.rotate(angle);
    const pitWallY = -halfW - 12;
    ctx.fillStyle = "#475569";
    ctx.fillRect(-500, pitWallY - 14, 1000, 14);
    ctx.fillStyle = "#0284c7";
    ctx.fillRect(-480, pitWallY - 12, 220, 10);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 8px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("FORMEL 1 GRAND PRIX", -370, pitWallY - 7);

    ctx.fillStyle = "#ea580c";
    ctx.fillRect(-220, pitWallY - 12, 200, 10);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("TURBOSLADD SPEEDWAY", -120, pitWallY - 7);

    ctx.fillStyle = "#16a34a";
    ctx.fillRect(20, pitWallY - 12, 220, 10);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("NTNU RACING CLUB", 130, pitWallY - 7);

    ctx.fillStyle = "#7c3aed";
    ctx.fillRect(280, pitWallY - 12, 180, 10);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("DEEP DRIFT", 370, pitWallY - 7);
    ctx.restore();

    // 14. Brake Marker Boards (150m, 100m, 50m)
    if (track.scenery && track.scenery.distanceBoards) {
      track.scenery.distanceBoards.forEach(b => {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.angle);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-12, -7, 24, 14);
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-12, -7, 24, 14);
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(b.distance), 0, 1);
        ctx.restore();
      });
    }

    // 15. Grandstands along Main Straight
    if (track.scenery && track.scenery.grandstands) {
      track.scenery.grandstands.forEach(g => {
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.angle);
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fillRect(-g.length * 0.5 + 4, -20, g.length, 44);
        ctx.fillStyle = "#334155";
        ctx.fillRect(-g.length * 0.5, -24, g.length, 42);
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(-g.length * 0.5 + 2, -22, g.length - 4, 38);
        const crowdCols = ["#ef4444", "#38bdf8", "#fbbf24", "#22c55e", "#ffffff", "#f97316"];
        for (let r = 0; r < 4; r++) {
          for (let c = -g.length * 0.5 + 8; c < g.length * 0.5 - 8; c += 7) {
            ctx.fillStyle = crowdCols[(Math.floor(c * 17 + r * 31) >>> 0) % crowdCols.length];
            ctx.fillRect(c, -20 + r * 9, 4, 4);
          }
        }
        ctx.restore();
      });
    }

    // 16. Parkland Trees & Boulders
    if (tilemapImage.complete && track.scenery && track.scenery.rocks) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      for (let i = 0; i < track.scenery.rocks.length; i++) {
        const r = track.scenery.rocks[i];
        const sx = r.tile === 1 ? 16 : 0;
        const halfSize = r.size * 0.5;
        ctx.drawImage(tilemapImage, sx, 16, 16, 16, Math.round(r.x - halfSize), Math.round(r.y - halfSize), r.size, r.size);
      }
      ctx.restore();
    }

    if (treeShadowCanvas && track.scenery && track.scenery.trees) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < track.scenery.trees.length; i++) {
        const t = track.scenery.trees[i];
        const sx = t.tile === 1 ? 16 : 0;
        const halfSize = t.size * 0.5;
        ctx.drawImage(treeShadowCanvas, sx, 0, 16, 16, Math.round(t.x - halfSize), Math.round(t.y - halfSize), t.size, t.size);
      }
      ctx.restore();
    }

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
    const key = `${track.id}_${track.seed || "0"}`;
    if (cachedTrackKey !== key || !cachedTrackCanvas) {
      cachedTrackCanvas = renderTrackToOffscreen(track);
      cachedTrackKey = key;
    }
    ctx.drawImage(cachedTrackCanvas, 0, 0);
  }

  function drawSkidmarks(ctx) {
    if (!state.skidmarks.length) return;
    for (let i = 0; i < state.skidmarks.length; i++) {
      const sm = state.skidmarks[i];
      ctx.fillStyle = "rgba(42, 24, 10, " + ((sm.alpha || 0.6) * 0.75) + ")";
      // Chunky pixel rut block
      ctx.fillRect(Math.round(sm.x - 3), Math.round(sm.y - 3), 6, 6);
    }
  }

  function drawParticles(ctx) {
    for (let i = 0; i < state.particles.length; i++) {
      const p = state.particles[i];
      ctx.fillStyle = p.color + p.alpha + ")";
      const s = Math.max(2, Math.round(p.size * 2));
      // Crisp pixel-art square dust & pebbles
      ctx.fillRect(Math.round(p.x - s * 0.5), Math.round(p.y - s * 0.5), s, s);
    }
  }

  function drawTreeCanopies(ctx, track) {
    if (!track || !track.scenery || !track.scenery.trees) return;
    const img = treeCanopyCanvas || (tilemapImage.complete ? tilemapImage : null);
    if (!img) return;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const trees = track.scenery.trees;
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      const sx = t.tile === 1 ? 16 : 0;
      const halfSize = t.size * 0.5;
      // Foliage canopy drawn overhead so cars drive UNDER overhanging branches!
      ctx.drawImage(img, sx, 0, 16, 16, Math.round(t.x - halfSize), Math.round(t.y - halfSize), t.size, t.size);
    }
    ctx.restore();
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

    const worldW = track.worldWidth || 4000;
    const worldH = track.worldHeight || 2600;
    const scale = Math.min((canvas.width - 16) / worldW, (canvas.height - 16) / worldH);
    const offsetX = (canvas.width - worldW * scale) / 2;
    const offsetY = (canvas.height - worldH * scale) / 2;

    // Grass infield background
    ctx.fillStyle = "#163417";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Infield anti-shortcut barriers
    if (track.infieldBarriers && track.infieldBarriers.length > 0) {
      ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
      ctx.lineWidth = 2;
      track.infieldBarriers.forEach(b => {
        ctx.beginPath();
        ctx.moveTo(offsetX + b.x1 * scale, offsetY + b.y1 * scale);
        ctx.lineTo(offsetX + b.x2 * scale, offsetY + b.y2 * scale);
        ctx.stroke();
      });
    }

    // Asphalt track ribbon
    const pts = track.points;
    ctx.beginPath();
    ctx.moveTo(offsetX + pts[0].x * scale, offsetY + pts[0].y * scale);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(offsetX + pts[i].x * scale, offsetY + pts[i].y * scale);
    }
    ctx.closePath();
    ctx.lineWidth = Math.max(3, Math.round((track.roadWidth || 175) * scale));
    ctx.strokeStyle = "#374151";
    ctx.stroke();

    // White racing line guide
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.stroke();

    // Start / Finish line marker
    const p0 = track.rawPoints[0];
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(offsetX + p0.x * scale, offsetY + p0.y * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();

    allCars.forEach(c => {
      ctx.fillStyle = c.color || "#38bdf8";
      ctx.beginPath();
      ctx.arc(offsetX + c.x * scale, offsetY + c.y * scale, c.isMe ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
      if (c.isMe) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.8;
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
    if (el.hudLapText) {
      el.hudLapText.textContent = state.myCar.finished ? "MÅL! 🏁" : `${state.myCar.lap}/${state.laps}`;
    }

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
        el.driftMeterLabel.textContent = `🏎️ RALLY SLADD! ${pct}%`;
        el.driftMeterWrap.style.boxShadow = "0 0 12px rgba(56, 189, 248, 0.8)";
      } else {
        el.driftMeterLabel.textContent = "RALLY SLADD BOOST";
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

  function drawSplitscreenHUD(ctx, vx, vy, vw, vh, car, name, color, playerNum, totalLaps) {
    ctx.save();
    // Top-left player badge
    const badgeX = vx + 16;
    const badgeY = vy + 14;
    const ctrlLabel = playerNum === 1 ? "WASD" : "Piltaster";
    ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, 220, 42, 8);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Player name & color dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(badgeX + 16, badgeY + 16, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`P${playerNum} (${ctrlLabel}): ${name}`, badgeX + 28, badgeY + 16);

    // Lap badge or finish status
    if (car.finished) {
      ctx.fillStyle = "#22c55e";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(`MÅL! 🏁 ${formatTime(car.finishTime)}`, badgeX + 28, badgeY + 31);
    } else {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(`Runde: `, badgeX + 28, badgeY + 31);
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`${car.lap}/${totalLaps}`, badgeX + 72, badgeY + 31);
    }

    // Top-right Speedometer
    const speedX = vx + vw - 120;
    const speedY = vy + 14;
    ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
    ctx.beginPath();
    ctx.roundRect(speedX, speedY, 104, 42, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const kmh = Math.round(car.speed * 0.48);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px Courier New, monospace";
    ctx.textAlign = "right";
    ctx.fillText(String(kmh), speedX + 64, speedY + 22);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 10px sans-serif";
    ctx.fillText("km/t", speedX + 96, speedY + 22);

    // Bottom-center Drift Boost Meter
    const barW = Math.min(220, Math.max(130, vw * 0.32));
    const barH = 12;
    const barX = vx + (vw - barW) / 2;
    const barY = vy + vh - 22;

    ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
    ctx.beginPath();
    ctx.roundRect(barX - 2, barY - 2, barW + 4, barH + 4, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const pct = Math.max(0, Math.min(1, car.driftBoostCharge));
    if (pct > 0) {
      ctx.fillStyle = car.turboTimer > 0
        ? "#f97316"
        : (pct > 0.75 ? "#fbbf24" : "#38bdf8");
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * pct, barH, 4);
      ctx.fill();
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(car.turboTimer > 0 ? "TURBO BOOST!" : (car.isDrifting ? "RALLY SLADD" : "DRIFT BOOST"), barX + barW / 2, barY + 9);

    // Splitscreen Winner / Finish Banner Overlay
    if (car.finished) {
      ctx.save();
      const bannerH = 74;
      const bannerY = vy + (vh - bannerH) / 2;
      ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
      ctx.fillRect(vx, bannerY, vw, bannerH);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(vx, bannerY, vw, bannerH);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 22px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🏁 FULLFØRT!", vx + vw / 2, bannerY + 24);

      ctx.font = "bold 13px sans-serif";
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`Tid: ${formatTime(car.finishTime)}  •  Beste: ${formatTime(car.bestLap)}`, vx + vw / 2, bannerY + 52);
      ctx.restore();
    }

    ctx.restore();
  }

  function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min(0.08, (timestamp - lastTime) / 1000.0);
    lastTime = timestamp;

    try {
      const track = getTrack(state.trackId, state.trackSeed);

      if (state.mode === "splitscreen" && state.car1 && state.car2) {
        // Player 1 inputs (WASD for LEFT screen)
        if (state.car1.finished) {
          state.car1.accelInput = 0;
          state.car1.brakeInput = 0.3;
          state.car1.steerInput = 0;
        } else {
          state.car1.accelInput = state.keysP1.up ? 1 : 0;
          state.car1.brakeInput = state.keysP1.down ? 1 : 0;
          state.car1.steerInput = (state.keysP1.right ? 1 : 0) - (state.keysP1.left ? 1 : 0);
        }

        // Player 2 inputs (Arrows for RIGHT screen)
        if (state.car2.finished) {
          state.car2.accelInput = 0;
          state.car2.brakeInput = 0.3;
          state.car2.steerInput = 0;
        } else {
          state.car2.accelInput = state.keysP2.up ? 1 : 0;
          state.car2.brakeInput = state.keysP2.down ? 1 : 0;
          state.car2.steerInput = (state.keysP2.right ? 1 : 0) - (state.keysP2.left ? 1 : 0);
        }

        updateCarPhysics(state.car1, track, dt);
        updateCarPhysics(state.car2, track, dt);
        resolveCarCarCollision(state.car1, state.car2);

        const maxSpd = Math.max(state.car1.speed, state.car2.speed);
        const maxThrottle = Math.max(state.car1.accelInput, state.car2.accelInput);
        updateEngineAudio(maxSpd, maxThrottle);

        updateParticles(dt);

        resizeCanvas();
        const canvas = el.raceCanvas;
        if (canvas && canvas.width > 0 && canvas.height > 0) {
          const ctx = canvas.getContext("2d");
          const w = canvas.width;
          const h = canvas.height;
          const halfW = Math.floor(w / 2);

          // P1 camera update
          const look1 = Math.min(100, state.car1.speed * 0.28);
          state.cam1.x += (state.car1.x + Math.cos(state.car1.angle) * look1 - state.cam1.x) * 0.16;
          state.cam1.y += (state.car1.y + Math.sin(state.car1.angle) * look1 - state.cam1.y) * 0.16;

          // P2 camera update
          const look2 = Math.min(100, state.car2.speed * 0.28);
          state.cam2.x += (state.car2.x + Math.cos(state.car2.angle) * look2 - state.cam2.x) * 0.16;
          state.cam2.y += (state.car2.y + Math.sin(state.car2.angle) * look2 - state.cam2.y) * 0.16;

          // --- VIEWPORT 1 (PLAYER 1 - VENSTRE HALVDEL) ---
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, halfW, h);
          ctx.clip();
          ctx.fillStyle = "#193218";
          ctx.fillRect(0, 0, halfW, h);

          ctx.save();
          ctx.translate(halfW / 2, h / 2);
          ctx.scale(state.cam1.zoom, state.cam1.zoom);
          ctx.translate(-state.cam1.x, -state.cam1.y);

          drawTexturedTrack(ctx, track);
          drawSkidmarks(ctx);
          drawParticles(ctx); // Under bilene!

          drawPlayerCar(ctx, state.car2, state.splitP2.color, state.splitP2.name, false);
          drawPlayerCar(ctx, state.car1, state.splitP1.color, state.splitP1.name, true);
          drawTreeCanopies(ctx, track); // Bilene kjører under tretoppene!
          ctx.restore();

          drawSplitscreenHUD(ctx, 0, 0, halfW, h, state.car1, state.splitP1.name, state.splitP1.color, 1, state.laps);
          ctx.restore();

          // --- VIEWPORT 2 (PLAYER 2 - HØYRE HALVDEL) ---
          ctx.save();
          ctx.beginPath();
          ctx.rect(halfW, 0, w - halfW, h);
          ctx.clip();
          ctx.fillStyle = "#193218";
          ctx.fillRect(halfW, 0, w - halfW, h);

          ctx.save();
          ctx.translate(halfW + (w - halfW) / 2, h / 2);
          ctx.scale(state.cam2.zoom, state.cam2.zoom);
          ctx.translate(-state.cam2.x, -state.cam2.y);

          drawTexturedTrack(ctx, track);
          drawSkidmarks(ctx);
          drawParticles(ctx); // Under bilene!

          drawPlayerCar(ctx, state.car1, state.splitP1.color, state.splitP1.name, false);
          drawPlayerCar(ctx, state.car2, state.splitP2.color, state.splitP2.name, true);
          drawTreeCanopies(ctx, track); // Bilene kjører under tretoppene!
          ctx.restore();

          drawSplitscreenHUD(ctx, halfW, 0, w - halfW, h, state.car2, state.splitP2.name, state.splitP2.color, 2, state.laps);
          ctx.restore();

          // --- VERTIKAL NEON DELELINJE (MIDTEN) ---
          ctx.save();
          ctx.fillStyle = "#38bdf8";
          ctx.shadowColor = "#38bdf8";
          ctx.shadowBlur = 10;
          ctx.fillRect(halfW - 2, 0, 4, h);
          ctx.shadowBlur = 0;
          ctx.restore();
        }

        // Splitscreen race finished handling: sisteplass trenger ikke komme i mål
        if (state.car1.finished || state.car2.finished) {
          if (!state.splitFinishTriggered) {
            state.splitFinishTriggered = true;
            setTimeout(() => {
              const racers = [
                { name: state.splitP1.name, color: state.splitP1.color, finishTime: state.car1.finishTime, bestLap: state.car1.bestLap, lap: state.car1.lap, finished: state.car1.finished },
                { name: state.splitP2.name, color: state.splitP2.color, finishTime: state.car2.finishTime, bestLap: state.car2.bestLap, lap: state.car2.lap, finished: state.car2.finished },
              ];
              racers.sort((a, b) => {
                if (a.finished && b.finished) return a.finishTime - b.finishTime;
                if (a.finished) return -1;
                if (b.finished) return 1;
                if (a.lap !== b.lap) return b.lap - a.lap;
                return (a.finishTime || 9999) - (b.finishTime || 9999);
              });
              showGameOverPodium(racers);
            }, 800);
          }
          return;
        }
      } else {
        // Normal Singleplayer / Online Mode
        if (state.myCar.finished) {
          state.myCar.accelInput = 0;
          state.myCar.brakeInput = 0.25;
          state.myCar.steerInput = 0;
        } else if (state.mode === "solo" || state.roomStatus === "racing") {
          state.myCar.accelInput = state.keys.up ? 1 : 0;
          state.myCar.brakeInput = state.keys.down ? 1 : 0;
          state.myCar.steerInput = (state.keys.right ? 1 : 0) - (state.keys.left ? 1 : 0);
        } else if (state.roomStatus === "countdown") {
          // Allow steering & wheel angling before green flag
          state.myCar.accelInput = 0;
          state.myCar.brakeInput = 0;
          state.myCar.steerInput = (state.keys.right ? 1 : 0) - (state.keys.left ? 1 : 0);
        } else {
          state.myCar.accelInput = 0;
          state.myCar.brakeInput = 0.5;
          state.myCar.steerInput = 0;
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
          ctx.fillStyle = "#193218";
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
          drawParticles(ctx); // EFFECTS STRICTLY UNDER CARS!

          const allMinimapCars = [];
          Object.values(state.opponentCars).forEach(opp => {
            drawPlayerCar(ctx, opp, opp.color, opp.name, false);
            allMinimapCars.push({ x: opp.x, y: opp.y, color: opp.color, isMe: false });
          });

          drawPlayerCar(ctx, state.myCar, state.driverColor, state.driverName, true);
          allMinimapCars.push({ x: state.myCar.x, y: state.myCar.y, color: state.driverColor, isMe: true });

          // Bilene kjører under tretoppene!
          drawTreeCanopies(ctx, track);

          ctx.restore();

          drawMinimap(track, allMinimapCars);

          // Finish banner overlay for Solo / Online mode
          if (state.myCar.finished) {
            ctx.save();
            const bannerH = 76;
            const bannerY = (canvas.height - bannerH) / 2;
            ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
            ctx.fillRect(0, bannerY, canvas.width, bannerH);
            ctx.strokeStyle = state.driverColor || "#38bdf8";
            ctx.lineWidth = 2;
            ctx.strokeRect(0, bannerY, canvas.width, bannerH);

            ctx.fillStyle = "#ffffff";
            ctx.font = "900 24px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("🏁 FULLFØRT!", canvas.width / 2, bannerY + 26);

            ctx.font = "bold 13px sans-serif";
            ctx.fillStyle = "#38bdf8";
            ctx.fillText(`Tid: ${formatTime(state.myCar.finishTime)}  •  Beste runde: ${formatTime(state.myCar.bestLap)}`, canvas.width / 2, bannerY + 54);
            ctx.restore();
          }
        }

        updateHUD(track);

        if (state.mode === "solo" && state.myCar.finished) {
          if (!state.soloFinishTimer) {
            state.soloFinishTimer = setTimeout(() => {
              state.soloFinishTimer = null;
              showGameOverPodium([
                { name: state.driverName, color: state.driverColor, finishTime: state.myCar.finishTime, bestLap: state.myCar.bestLap, lap: state.myCar.lap, finished: true },
              ]);
            }, 1200);
          }
        }
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
      const standings = (data.players || []).slice().sort((a, b) => {
        const aForfeit = !!(a.forfeit || a.left);
        const bForfeit = !!(b.forfeit || b.left);
        if (aForfeit && !bForfeit) return 1;
        if (!aForfeit && bForfeit) return -1;
        if (a.finished && b.finished) return (a.finishTime || 0) - (b.finishTime || 0);
        if (a.finished) return -1;
        if (b.finished) return 1;
        if ((a.lap || 1) !== (b.lap || 1)) return (b.lap || 1) - (a.lap || 1);
        return (b.checkpoint || 0) - (a.checkpoint || 0);
      });
      showGameOverPodium(standings);
    }

    (data.players || []).forEach(p => {
      if (p.id !== state.playerId) {
        const color = p.color || (p.avatar ? extractCharacterColor(p.avatar) : "#ef4444");
        if (!state.opponentCars[p.id]) {
          state.opponentCars[p.id] = {
            id: p.id,
            name: p.name,
            color: color,
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
          opp.color = color;
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
        state.trackId = data.trackId || "f1_random";
        if (data.trackSeed) state.trackSeed = data.trackSeed;
        state.laps = data.laps || 3;
        state.maxPlayers = data.maxPlayers || 4;
        state.players = data.players || [];

        // Sync driverColor if server assigned or updated our color
        const me = (data.players || []).find(p => p.id === state.playerId);
        if (me && me.color && me.color.toLowerCase() !== (state.driverColor || "").toLowerCase()) {
          state.driverColor = me.color;
          localStorage.setItem("ts_driver_color", me.color);
        }

        renderLoungeRacers(data.players);
        renderLoungeColorPalette(data.players);
        renderLoungeCarPreview();
        updateLoungeSettingsUI();

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
      const avatarSrc = (typeof CharacterCreator !== "undefined" && p.avatar)
        ? CharacterCreator.getAvatarImgSrc(p.avatar)
        : "";
      const color = p.color || (p.avatar ? extractCharacterColor(p.avatar) : "#ef4444");

      const avatarHtml = avatarSrc
        ? `<div class="avatar-circle-preview" style="width:38px;height:38px;"><img src="${avatarSrc}" alt="${escapeHtml(p.name)}" /></div>`
        : `<div class="racer-car-icon-wrap" style="background:${color};"><span style="font-size:1.1rem;">🏎️</span></div>`;

      card.innerHTML = `
        <div class="racer-slot-num">${idx + 1}</div>
        ${avatarHtml}
        <div class="racer-info-wrap">
          <div class="racer-name" style="display:flex;align-items:center;gap:0.4rem;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color};"></span>
            <span>${escapeHtml(p.name)}${p.isHost ? " (Vert 👑)" : ""}</span>
          </div>
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
        <div class="racer-subtext" style="color:#64748b;">Ledig startspor...</div>
      `;
      el.racersGrid.appendChild(emptyCard);
    }

    if (state.isHost) {
      el.btnHostStartRace.classList.remove("hidden");
    } else {
      el.btnHostStartRace.classList.add("hidden");
    }
  }

  function launchSplitscreenRace() {
    state.mode = "splitscreen";
    state.roomStatus = "racing";
    state.skidmarks = [];
    state.particles = [];
    state.splitFinishTriggered = false;
    state.keysP1 = { up: false, down: false, left: false, right: false };
    state.keysP2 = { up: false, down: false, left: false, right: false };

    // Explicitly synchronize track and laps from Splitscreen UI
    if (el.selectSplitTrack) {
      state.trackId = el.selectSplitTrack.value || state.trackId || "f1_random";
    }
    if (el.controlSplitLaps) {
      const activeBtn = el.controlSplitLaps.querySelector(".seg-btn.active");
      if (activeBtn && activeBtn.dataset.laps) {
        state.splitLaps = parseInt(activeBtn.dataset.laps, 10) || 3;
      }
    }
    state.laps = state.splitLaps || 3;

    const track = getTrack(state.trackId, state.trackSeed);
    state.car1 = createCarState(0, track);
    state.car2 = createCarState(1, track);
    state.cam1 = { x: state.car1.x, y: state.car1.y, zoom: 1.15 };
    state.cam2 = { x: state.car2.x, y: state.car2.y, zoom: 1.15 };

    showView("game");
    resizeCanvas();
    if (el.raceCanvas) el.raceCanvas.focus();

    el.countdownOverlay.classList.remove("hidden");
    el.countdownText.textContent = "KJØR! 🏁";
    playTone(880, 0.4, "triangle", 0.3);
    setTimeout(() => el.countdownOverlay.classList.add("hidden"), 700);

    startSimulation();
  }

  function launchOnlineRace(data) {
    state.mode = "online";
    state.roomStatus = data.status || "countdown";
    state.opponentCars = {};
    state.skidmarks = [];
    state.particles = [];
    state.keys = { up: false, down: false, left: false, right: false };

    if (data.trackId) state.trackId = data.trackId;
    if (data.trackSeed) state.trackSeed = data.trackSeed;
    if (data.laps) state.laps = Number(data.laps) || state.laps || 3;

    const track = getTrack(state.trackId, state.trackSeed);
    let myPlayer = (data.players || []).find(p => p.id === state.playerId || p.isMe);
    if (!myPlayer && (data.isHost || state.isHost)) {
      myPlayer = (data.players || []).find(p => p.isHost) || (data.players || [])[0];
    }
    if (!myPlayer) {
      const myName = (state.driverName || "").toLowerCase();
      myPlayer = (data.players || []).find(p => (p.name || "").toLowerCase() === myName) || (data.players || [])[0];
    }
    const mySlot = myPlayer ? myPlayer.slot : 0;
    if (myPlayer) {
      state.playerId = myPlayer.id;
      if (myPlayer.color) {
        state.driverColor = myPlayer.color;
      } else if (myPlayer.avatar) {
        state.driverColor = extractCharacterColor(myPlayer.avatar, state.driverColor);
      }
      if (myPlayer.name) {
        state.driverName = myPlayer.name;
      }
      localStorage.setItem("ts_driver_color", state.driverColor);
    }

    resetCarToSlot(state.myCar, track, mySlot);

    showView("game");
    resizeCanvas();
    if (el.raceCanvas) el.raceCanvas.focus();

    if (state.roomStatus === "countdown") {
      if (el.countdownOverlay) el.countdownOverlay.classList.remove("hidden");
      const rem = Math.ceil(data.countdownRemaining || 3);
      if (el.countdownText) el.countdownText.textContent = rem > 0 ? String(rem) : "KJØR!";

      // Fallback timer ensures car is unlocked even on network hiccup
      const waitMs = Math.max(1000, ((data.countdownRemaining || 3) * 1000) + 200);
      setTimeout(() => {
        if (state.roomStatus === "countdown") {
          state.roomStatus = "racing";
          if (el.countdownText) el.countdownText.textContent = "KJØR! 🏁";
          playTone(880, 0.4, "triangle", 0.3);
          setTimeout(() => {
            if (el.countdownOverlay) el.countdownOverlay.classList.add("hidden");
          }, 700);
        }
      }, waitMs);
    } else {
      if (el.countdownOverlay) el.countdownOverlay.classList.add("hidden");
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
    state.keys = { up: false, down: false, left: false, right: false };

    if (state.soloFinishTimer) {
      clearTimeout(state.soloFinishTimer);
      state.soloFinishTimer = null;
    }

    // Explicitly synchronize track and laps from Solo UI
    if (el.selectSoloTrack) {
      state.trackId = el.selectSoloTrack.value || state.trackId || "f1_random";
    }
    if (el.controlSoloLaps) {
      const activeBtn = el.controlSoloLaps.querySelector(".seg-btn.active");
      if (activeBtn && activeBtn.dataset.laps) {
        state.laps = parseInt(activeBtn.dataset.laps, 10) || 3;
      }
    }

    const track = getTrack(state.trackId, state.trackSeed);
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
    if (el.podiumDesc) {
      const allOthersGaveUp = racers.length >= 2 && racers.slice(1).every(r => r.forfeit || r.left);
      if (allOthersGaveUp) {
        el.podiumDesc.textContent = "Motstanderen ga opp! Du vant løpet! 🏆";
      } else {
        el.podiumDesc.textContent = "Løpet er fullført. Her er resultatlisten:";
      }
    }

    racers.forEach((r, idx) => {
      const row = document.createElement("div");
      row.className = "podium-row" + (idx === 0 ? " rank-1" : "");
      const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;
      let timeText = "";
      if (r.forfeit || r.left) {
        timeText = "Ga opp";
      } else if (r.finished && r.finishTime > 0) {
        timeText = formatTime(r.finishTime);
      } else if (idx === 0) {
        timeText = "Vinner!";
      } else if (r.lap && r.lap > 1) {
        timeText = `Runde ${r.lap}`;
      } else {
        timeText = "Ikke i mål";
      }
      row.innerHTML = `
        <div class="podium-left">
          <span class="podium-medal">${medal}</span>
          <span class="podium-color-dot" style="background:${r.color || '#38bdf8'};"></span>
          <span class="podium-name">${escapeHtml(r.name)}</span>
        </div>
        <div class="podium-time">${timeText}</div>
      `;
      el.podiumStandings.appendChild(row);
    });

    el.modalPodium.classList.remove("hidden");
  }

  // =========================================================================
  // LOUNGE SETTINGS (Decided in lobby by host, synced to all players)
  // =========================================================================

  function updateLoungeSettingsUI() {
    const trackNames = {
      f1_random: "Tilfeldig F1 GP 🎲",
      f1_monza: "Monza Autodromo (F1)",
      f1_silverstone: "Silverstone Circuit (F1)",
      f1_spa: "Spa-Francorchamps (F1)",
      f1_redbull: "Red Bull Ring (F1)",
      f1_suzuka: "Suzuka Circuit (F1)",
      grand_prix: "Monza Autodromo (F1)",
      fjord_drift: "Spa-Francorchamps (F1)",
    };
    if (el.loungeTrackName) {
      el.loungeTrackName.textContent = trackNames[state.trackId] || state.trackId;
    }
    if (el.loungeLapsBadge) {
      el.loungeLapsBadge.textContent = `${state.laps} runder`;
    }

    if (el.loungeSelectTrack) {
      el.loungeSelectTrack.value = state.trackId;
      el.loungeSelectTrack.disabled = !state.isHost;
      el.loungeSelectTrack.style.cursor = state.isHost ? "pointer" : "not-allowed";
      el.loungeSelectTrack.style.opacity = state.isHost ? "1" : "0.75";
    }

    if (el.loungeControlLaps) {
      const lapBtns = el.loungeControlLaps.querySelectorAll(".seg-btn");
      lapBtns.forEach(btn => {
        const btnLaps = parseInt(btn.dataset.laps, 10);
        btn.classList.toggle("active", btnLaps === state.laps);
        btn.disabled = !state.isHost;
        btn.style.opacity = state.isHost ? "1" : (btnLaps === state.laps ? "1" : "0.45");
        btn.style.cursor = state.isHost ? "pointer" : "not-allowed";
      });
    }

    if (el.loungeHostOnlyHint) {
      if (state.isHost) {
        el.loungeHostOnlyHint.textContent = "Du er romvert (du bestemmer bane & runder)";
        el.loungeHostOnlyHint.classList.add("is-host");
      } else {
        el.loungeHostOnlyHint.textContent = "Venter på romvertens valg";
        el.loungeHostOnlyHint.classList.remove("is-host");
      }
    }
  }

  async function sendLoungeSettingsUpdate(trackId, laps, trackSeed) {
    if (!state.isHost || !state.roomCode) return;
    try {
      const body = {
        roomCode: state.roomCode,
        playerId: state.playerId,
        trackId: trackId !== undefined ? trackId : state.trackId,
        laps: laps !== undefined ? laps : state.laps,
      };
      if (trackSeed !== undefined) body.trackSeed = trackSeed;

      const resp = await fetch("/api/turbosladd/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (data && data.ok) {
        if (data.trackId) state.trackId = data.trackId;
        if (data.trackSeed) state.trackSeed = data.trackSeed;
        if (data.laps) state.laps = data.laps;
        updateLoungeSettingsUI();
      }
    } catch (err) {
      console.warn("Failed to update settings:", err);
    }
  }

  // =========================================================================
  // INPUT HANDLERS (Keys & Buttons)
  // =========================================================================

  function initInputHandlers() {
    function handleKey(e, isDown) {
      const k = e.key;
      const c = e.code;

      if (state.mode === "splitscreen") {
        let matched = false;
        // Player 1 controls (WASD keys for LEFT screen)
        if (k === "w" || k === "W" || c === "KeyW") { state.keysP1.up = isDown; matched = true; }
        if (k === "s" || k === "S" || c === "KeyS") { state.keysP1.down = isDown; matched = true; }
        if (k === "a" || k === "A" || c === "KeyA") { state.keysP1.left = isDown; matched = true; }
        if (k === "d" || k === "D" || c === "KeyD") { state.keysP1.right = isDown; matched = true; }

        // Player 2 controls (Arrow keys for RIGHT screen)
        if (k === "ArrowUp" || c === "ArrowUp") { state.keysP2.up = isDown; matched = true; }
        if (k === "ArrowDown" || c === "ArrowDown") { state.keysP2.down = isDown; matched = true; }
        if (k === "ArrowLeft" || c === "ArrowLeft") { state.keysP2.left = isDown; matched = true; }
        if (k === "ArrowRight" || c === "ArrowRight") { state.keysP2.right = isDown; matched = true; }

        if (matched && !el.viewGame.classList.contains("hidden")) {
          e.preventDefault();
        }
      } else {
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

        if (matched && !el.viewGame.classList.contains("hidden")) {
          e.preventDefault();
        }
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
        state.keys = { up: false, down: false, left: false, right: false };
        state.keysP1 = { up: false, down: false, left: false, right: false };
        state.keysP2 = { up: false, down: false, left: false, right: false };
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

    // Name inputs
    if (el.inputHostName) {
      el.inputHostName.value = state.driverName;
      el.inputHostName.addEventListener("input", () => {
        state.driverName = el.inputHostName.value.trim() || "Sjåfør 1";
        localStorage.setItem("ts_driver_name", state.driverName);
      });
    }
    if (el.inputJoinName) {
      el.inputJoinName.value = state.driverName === "Sjåfør 1" ? "Sjåfør 2" : state.driverName;
      el.inputJoinName.addEventListener("input", () => {
        state.driverName = el.inputJoinName.value.trim() || "Sjåfør 2";
        localStorage.setItem("ts_driver_name", state.driverName);
      });
    }

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

    // In-Lobby Lounge Race Settings (Controlled by host, synced to all guests)
    if (el.loungeSelectTrack) {
      el.loungeSelectTrack.addEventListener("change", () => {
        sendLoungeSettingsUpdate(el.loungeSelectTrack.value, undefined);
      });
    }

    if (el.loungeControlLaps) {
      el.loungeControlLaps.querySelectorAll(".seg-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          if (!state.isHost) return;
          const laps = parseInt(btn.dataset.laps || "3", 10);
          sendLoungeSettingsUpdate(undefined, laps);
        });
      });
    }

    // Solo track & lap buttons
    if (el.btnRegenSoloTrack) {
      el.btnRegenSoloTrack.addEventListener("click", () => {
        state.trackSeed = Math.floor(Math.random() * 90000) + 10000;
        state.trackId = "f1_random";
        if (el.selectSoloTrack) el.selectSoloTrack.value = "f1_random";
        playTone(660, 0.1, "triangle", 0.2);
        el.btnRegenSoloTrack.textContent = "✓ Ny bane!";
        setTimeout(() => { if (el.btnRegenSoloTrack) el.btnRegenSoloTrack.textContent = "🎲 Ny bane"; }, 750);
      });
    }

    if (el.btnRegenSplitTrack) {
      el.btnRegenSplitTrack.addEventListener("click", () => {
        state.trackSeed = Math.floor(Math.random() * 90000) + 10000;
        state.trackId = "f1_random";
        if (el.selectSplitTrack) el.selectSplitTrack.value = "f1_random";
        playTone(660, 0.1, "triangle", 0.2);
        el.btnRegenSplitTrack.textContent = "✓ Ny bane!";
        setTimeout(() => { if (el.btnRegenSplitTrack) el.btnRegenSplitTrack.textContent = "🎲 Ny bane"; }, 750);
      });
    }

    if (el.controlSoloLaps) {
      el.controlSoloLaps.querySelectorAll(".seg-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          el.controlSoloLaps.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          state.laps = parseInt(btn.dataset.laps || "3", 10);
        });
      });
    }

    // Splitscreen Local Setup
    if (el.splitP1Colors) {
      el.splitP1Colors.querySelectorAll(".spc-color-dot").forEach(dot => {
        dot.addEventListener("click", () => {
          el.splitP1Colors.querySelectorAll(".spc-color-dot").forEach(d => d.classList.remove("active"));
          dot.classList.add("active");
          state.splitP1.color = dot.dataset.color;
        });
      });
    }
    if (el.splitP2Colors) {
      el.splitP2Colors.querySelectorAll(".spc-color-dot").forEach(dot => {
        dot.addEventListener("click", () => {
          el.splitP2Colors.querySelectorAll(".spc-color-dot").forEach(d => d.classList.remove("active"));
          dot.classList.add("active");
          state.splitP2.color = dot.dataset.color;
        });
      });
    }
    if (el.controlSplitLaps) {
      el.controlSplitLaps.querySelectorAll(".seg-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          el.controlSplitLaps.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          state.splitLaps = parseInt(btn.dataset.laps || "3", 10);
        });
      });
    }
    if (el.btnStartSplitscreen) {
      el.btnStartSplitscreen.addEventListener("click", () => {
        state.splitP1.name = (el.inputSplitP1Name && el.inputSplitP1Name.value.trim()) || "Spiller 1";
        state.splitP2.name = (el.inputSplitP2Name && el.inputSplitP2Name.value.trim()) || "Spiller 2";
        if (el.selectSplitTrack) state.trackId = el.selectSplitTrack.value;
        launchSplitscreenRace();
      });
    }

    if (el.selectSoloTrack) {
      el.selectSoloTrack.addEventListener("change", () => {
        state.trackId = el.selectSoloTrack.value;
      });
    }

    // Create Race (Host)
    if (el.btnCreateRace) {
      el.btnCreateRace.addEventListener("click", async () => {
        try {
          const hostName = (el.inputHostName && el.inputHostName.value.trim()) || state.driverName || "Sjåfør 1";
          state.driverName = hostName;
          localStorage.setItem("ts_driver_name", hostName);

          const resp = await fetch("/api/turbosladd/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              hostName: hostName,
              color: state.driverColor,
              avatar: selectedAvatarStr,
              trackId: state.trackId || "f1_random",
              trackSeed: state.trackSeed,
              laps: state.laps || 3,
              maxPlayers: 16,
            }),
          });
          const data = await resp.json();
          if (data.ok) {
            state.roomCode = data.roomCode;
            state.playerId = data.playerId;
            state.hostToken = data.hostToken;
            state.isHost = true;
            if (data.color) {
              state.driverColor = data.color;
              localStorage.setItem("ts_driver_color", data.color);
            }
            if (el.displayRoomCode) el.displayRoomCode.textContent = data.roomCode;
            showView("room");
            updateLoungeSettingsUI();
            startLobbyPolling();
          } else {
            alert(data.error || "Kunne ikke opprette rom.");
          }
        } catch (err) {
          alert("Nettverksfeil ved oppretting av rom.");
        }
      });
    }

    // Join Race
    if (el.btnJoinRace) {
      el.btnJoinRace.addEventListener("click", async () => {
        const code = el.inputRoomCode ? el.inputRoomCode.value.trim().toUpperCase() : "";
        if (!code) {
          alert("Skriv inn en romkode.");
          return;
        }
        const playerName = (el.inputJoinName && el.inputJoinName.value.trim()) || state.driverName || "Sjåfør 2";
        state.driverName = playerName;
        localStorage.setItem("ts_driver_name", playerName);

        try {
          const resp = await fetch("/api/turbosladd/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomCode: code,
              playerName: playerName,
              color: state.driverColor,
              avatar: selectedAvatarStr,
            }),
          });
          const data = await resp.json();
          if (data.ok) {
            state.roomCode = data.roomCode;
            state.playerId = data.playerId;
            state.isHost = false;
            state.trackId = data.trackId || "f1_random";
            if (data.trackSeed) state.trackSeed = data.trackSeed;
            state.laps = data.laps || 3;
            if (data.color) {
              state.driverColor = data.color;
              localStorage.setItem("ts_driver_color", data.color);
            }
            if (el.displayRoomCode) el.displayRoomCode.textContent = data.roomCode;
            showView("room");
            updateLoungeSettingsUI();
            startLobbyPolling();
          } else {
            alert(data.error || "Kunne ikke koble til rom.");
          }
        } catch (err) {
          alert("Nettverksfeil ved tilkobling til rom.");
        }
      });
    }

    // Copy code button
    if (el.btnCopyCode) {
      el.btnCopyCode.addEventListener("click", () => {
        if (state.roomCode && el.displayRoomCode) {
          navigator.clipboard.writeText(state.roomCode);
          el.displayRoomCode.style.color = "#34d399";
          setTimeout(() => { if (el.displayRoomCode) el.displayRoomCode.style.color = "#38bdf8"; }, 800);
        }
      });
    }

    // Toggle Ready
    if (el.btnToggleReady) {
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
    }

    // Host Start Race
    if (el.btnHostStartRace) {
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
    }

    // Single Direct Exit/Forfeit Handler
    function handleForfeitAndLeave() {
      stopEngineSound();
      stopSimulation();
      stopRoomSync();
      stopLobbyPolling();

      const code = state.roomCode;
      const pid = state.playerId;

      if (code) {
        if (window.PartyBridge) {
          window.PartyBridge.leaveToLounge({
            roomCode: code,
            playerId: pid,
            beforeLeave: () => {
              try {
                fetch("/api/turbosladd/leave", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  keepalive: true,
                  body: JSON.stringify({ roomCode: code, playerId: pid, forfeit: true }),
                });
              } catch (_) {}
            },
          });
          return;
        }

        try {
          fetch("/api/turbosladd/leave", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            keepalive: true,
            body: JSON.stringify({ roomCode: code, playerId: pid, forfeit: true }),
          });
          fetch("/api/party/to-lounge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            keepalive: true,
            body: JSON.stringify({ roomCode: code, playerId: pid }),
          });
        } catch (_) {}

        state.roomCode = "";
        state.playerId = "";

        try {
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (_) {}

        window.location.replace(`/party/?room=${encodeURIComponent(code)}&player=${encodeURIComponent(pid)}`);
        return;
      }

      showView("lobby");
    }

    if (el.btnHeaderLeave) {
      el.btnHeaderLeave.addEventListener("click", () => {
        handleForfeitAndLeave();
      });
    }

    if (el.btnHeaderBack) {
      el.btnHeaderBack.addEventListener("click", (e) => {
        if (el.viewGame && !el.viewGame.classList.contains("hidden")) {
          e.preventDefault();
          handleForfeitAndLeave();
        }
      });
    }

    // Start Solo Time-Trial
    if (el.btnStartSolo) {
      el.btnStartSolo.addEventListener("click", () => {
        launchSoloTimeTrial();
      });
    }

    // Podium: return to lobby
    if (el.btnPodiumReturnLobby) {
      el.btnPodiumReturnLobby.addEventListener("click", () => {
        if (el.modalPodium) el.modalPodium.classList.add("hidden");
        handleForfeitAndLeave();
      });
    }

    if (window.PartyConnect) {
      window.PartyConnect.init({
        gameId: "turbosladd",
        createBtnId: "btnCreatePartyRoom",
        joinBtnId: "btnJoinPartyRoom",
        hostInputId: "inputPartyHostName",
        joinInputId: "inputPartyJoinName",
        codeInputId: "inputPartyRoomCode",
      });
    }
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
    initCharacterProfile();
    renderProfileCarPreview();
    initInputHandlers();

    // Check URL parameters for Party Lounge / direct link
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = (urlParams.get("room") || urlParams.get("code") || "").trim().toUpperCase();
    const playerParam = (
      urlParams.get("player") ||
      urlParams.get("playerId") ||
      sessionStorage.getItem("party_player_id") ||
      localStorage.getItem("party_player_id") ||
      ""
    ).trim();

    if (roomParam) {
      state.roomCode = roomParam;
      state.playerId = playerParam;
      if (el.inputRoomCode) el.inputRoomCode.value = roomParam;
      if (el.displayRoomCode) el.displayRoomCode.textContent = roomParam;

      // Check if room already exists on server
      try {
        const resp = await fetch(`/api/turbosladd/state?room=${encodeURIComponent(roomParam)}&player=${encodeURIComponent(playerParam)}`);
        const data = await resp.json();
        if (data && data.ok) {
          state.isHost = Boolean(data.isHost);
          state.trackId = data.trackId || "f1_random";
          if (data.trackSeed) state.trackSeed = data.trackSeed;
          state.laps = data.laps || 3;
          state.maxPlayers = data.maxPlayers || 16;
          state.players = data.players || [];

          // If coming from Party Lounge, link Back button to party lounge
          if (el.btnHeaderBack) {
            el.btnHeaderBack.href = `/party/?room=${encodeURIComponent(roomParam)}`;
          }
          if (el.backBtnText) {
            el.backBtnText.textContent = "Lounge";
          }

          // Match player identity and assign car color from character
          let myPlayer = (data.players || []).find(p => p.id === state.playerId || p.isMe);
          if (!myPlayer && (data.isHost || state.isHost)) {
            myPlayer = (data.players || []).find(p => p.isHost) || (data.players || [])[0];
          }
          if (!myPlayer) {
            const savedName = (state.driverName || "").toLowerCase();
            myPlayer = (data.players || []).find(p => (p.name || "").toLowerCase() === savedName) || (data.players || [])[0];
          }
          if (myPlayer) {
            state.playerId = myPlayer.id;
            if (myPlayer.color) {
              state.driverColor = myPlayer.color;
            } else if (myPlayer.avatar) {
              state.driverColor = extractCharacterColor(myPlayer.avatar, state.driverColor);
            }
            if (myPlayer.name) {
              state.driverName = myPlayer.name;
            }
            localStorage.setItem("ts_driver_color", state.driverColor);
          }

          if (data.status === "countdown" || data.status === "racing" || data.status === "lobby") {
            launchOnlineRace(data);
            return;
          } else {
            // Room is in party lounge stage or finished - redirect to central party room!
            window.location.href = `/party/?room=${encodeURIComponent(roomParam)}`;
            return;
          }
        } else {
          // If room doesn't exist in turbosladd, redirect to party lounge
          window.location.href = `/party/?room=${encodeURIComponent(roomParam)}`;
          return;
        }
      } catch (e) {
        console.error("Init online room error:", e);
      }

      // If room didn't exist yet, open online tab with code prefilled
      if (el.tabOnline) el.tabOnline.click();
    }

    showView("lobby");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
