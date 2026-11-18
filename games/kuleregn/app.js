/**
 * Kuleregn Tanks - Topp-ned 2D Arkade Stridsvognspill
 *
 * Funksjoner:
 * - 60 FPS HTML5 Canvas med dynamisk kameratracking
 * - WASD for å kjøre stridsvognen (W frem, S revers, A/D sving chassis)
 * - Piltaster (◄ ►) for å rotere og sikte kanontårnet
 * - Mellomrom eller Venstreklikk for å avfyre kanonen med rekyl
 * - Animerte beltespor (tracks) og fargetilpasning til karakterens farge
 * - Karakteren din er vognkommandør med avatar på tårnluken
 * - Flerspiller over nettverk med romkoder og Party Lobby-bro
 * - Kart: Rust (Scrapyard), Gløshaugen Arena, Cyber Hangar
 * - Sanntids Kill Feed, overhead helse/skjold, resultattavle (TAB) og seierspodium
 */

(() => {
  "use strict";

  // =========================================================================
  // PALETTE & WEAPONS SPECIFICATION
  // =========================================================================

  const PALETTE = [
    { color: "#ffd166", name: "Student-gull" },
    { color: "#00b4d8", name: "Fjord-blå" },
    { color: "#ef476f", name: "Samfundet-rød" },
    { color: "#06d6a0", name: "Dragvoll-grønn" },
    { color: "#fb8500", name: "Vors-oransje" },
    { color: "#8338ec", name: "Linjeforening-lilla" },
    { color: "#ff70a6", name: "Neon-rosa" },
    { color: "#a0c4ff", name: "Alve-isblå" },
    { color: "#fadcba", name: "Lys fersken" },
    { color: "#f3c299", name: "Varm gyllen" },
    { color: "#dfa27a", name: "Solbrent" },
    { color: "#8d5b36", name: "Kaffebrun" },
    { color: "#4a2810", name: "Dyp ibenholt" },
    { color: "#f1f5f9", name: "Spøkelseshvit" },
    { color: "#94a3b8", name: "Robot-grå" },
    { color: "#1e293b", name: "Kullsvart" },
  ];

  // =========================================================================
  // TANK CLASSES & STATS SPECIFICATIONS
  // =========================================================================

  const TANK_CONFIGS = {
    light: {
      id: "light",
      name: "Lett stridsvogn",
      badge: "Rask & Smidig",
      desc: "Høy toppfart og hurtigskytende 57mm kanon, men tynnere panser.",
      maxHealth: 75,
      maxShield: 0,
      forwardSpeed: 140,
      reverseSpeed: 85,
      hullTurnSpeed: 1.8,
      turretTurnSpeed: 1.8,
      size: 64,
      radius: 22,
      weapon: {
        id: "cannon_light",
        name: "57mm Lett Hurtigkanon",
        damage: 35,
        fireRate: 0.38,
        bulletSpeed: 1250,
        bulletRange: 1200,
        bulletLife: 1200 / 1250,
        spread: 0.008,
        color: "#38bdf8",
      },
      stats: { speed: 82, armor: 35, damage: 45, fireRate: 85 },
      assets: {
        body: "/games/kuleregn/assets/light/body.png",
        turret: "/games/kuleregn/assets/light/turret.png",
        tracks: "/games/kuleregn/assets/light/tracks_0001.png",
      },
    },
    medium: {
      id: "medium",
      name: "Medium stridsvogn",
      badge: "Balansert allrounder",
      desc: "Klassisk balanse mellom manøvrerbarhet, pansring og ildkraft.",
      maxHealth: 100,
      maxShield: 0,
      forwardSpeed: 110,
      reverseSpeed: 65,
      hullTurnSpeed: 1.35,
      turretTurnSpeed: 1.35,
      size: 64,
      radius: 22,
      weapon: {
        id: "cannon_medium",
        name: "75mm Stridsvognkanon",
        damage: 50,
        fireRate: 0.65,
        bulletSpeed: 1100,
        bulletRange: 1300,
        bulletLife: 1300 / 1100,
        spread: 0.005,
        color: "#ffd166",
      },
      stats: { speed: 65, armor: 60, damage: 65, fireRate: 65 },
      assets: {
        body: "/games/kuleregn/assets/tank/body.png",
        turret: "/games/kuleregn/assets/tank/turret.png",
        tracks: "/games/kuleregn/assets/tank/tracks_0001.png",
      },
    },
    heavy: {
      id: "heavy",
      name: "Tung stridsvogn",
      badge: "Festning",
      desc: "Massiv 152mm haubitser med enorm ildkraft. Tregt tårnsikte og kraftig rekyl.",
      maxHealth: 140,
      maxShield: 0,
      forwardSpeed: 75,
      reverseSpeed: 45,
      hullTurnSpeed: 0.85,
      turretTurnSpeed: 0.65,
      size: 64,
      radius: 22,
      isOneShot: true,
      weapon: {
        id: "cannon_heavy",
        name: "152mm Tung Haubitser (One-shot)",
        damage: 250,
        fireRate: 2.4,
        bulletSpeed: 1050,
        bulletRange: 1500,
        bulletLife: 1500 / 1050,
        spread: 0.002,
        color: "#f43f5e",
      },
      stats: { speed: 40, armor: 100, damage: 100, fireRate: 25 },
      assets: {
        body: "/games/kuleregn/assets/heavy/body.png",
        turret: "/games/kuleregn/assets/heavy/turret.png",
        tracks: "/games/kuleregn/assets/heavy/tracks_0001.png",
      },
    },
  };

  const WEAPONS = {
    cannon: TANK_CONFIGS.medium.weapon,
    cannon_light: TANK_CONFIGS.light.weapon,
    cannon_medium: TANK_CONFIGS.medium.weapon,
    cannon_heavy: TANK_CONFIGS.heavy.weapon,
    light: TANK_CONFIGS.light.weapon,
    medium: TANK_CONFIGS.medium.weapon,
    heavy: TANK_CONFIGS.heavy.weapon,
    assault: TANK_CONFIGS.medium.weapon,
    shotgun: TANK_CONFIGS.medium.weapon,
    sniper: TANK_CONFIGS.medium.weapon,
    rocket: TANK_CONFIGS.medium.weapon,
    pistol: TANK_CONFIGS.medium.weapon,
  };

  // =========================================================================
  // TANK SPRITE ASSETS & DYNAMIC COLOR TINTING
  // =========================================================================

  const TANK_SPRITES = {};
  for (const [tKey, tConf] of Object.entries(TANK_CONFIGS)) {
    const trackSrc = Array.isArray(tConf.assets.tracks) ? tConf.assets.tracks[0] : tConf.assets.tracks;
    const trackImg = new Image();
    TANK_SPRITES[tKey] = {
      body: new Image(),
      turret: new Image(),
      tracks: trackImg,
    };
    TANK_SPRITES[tKey].tracks[0] = trackImg; // Backwards compatibility for array indexing
    const onAssetLoad = () => {
      tintCache.clear();
      triggerAllPreviewsUpdate();
    };
    TANK_SPRITES[tKey].body.onload = onAssetLoad;
    TANK_SPRITES[tKey].turret.onload = onAssetLoad;
    trackImg.onload = onAssetLoad;

    TANK_SPRITES[tKey].body.src = tConf.assets.body;
    TANK_SPRITES[tKey].turret.src = tConf.assets.turret;
    trackImg.src = trackSrc;
  }

  // Backward compatibility alias
  const TANK_ASSETS = TANK_SPRITES.medium;

  const tintCache = new Map();

  function getTintedSprite(img, hexColor) {
    if (!img || !img.complete || img.naturalWidth === 0) return null;
    const color = hexColor || "#ffd166";
    const key = `${img.src}_${color}`;
    if (tintCache.has(key)) return tintCache.get(key);

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(img, 0, 0);

    if (color.startsWith("#") && color.length === 7) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha === 0) continue;
        const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (gray < 25) {
          data[i] = 18;
          data[i + 1] = 22;
          data[i + 2] = 30;
        } else {
          const factor = gray / 217;
          data[i] = Math.min(255, Math.round(r * factor));
          data[i + 1] = Math.min(255, Math.round(g * factor));
          data[i + 2] = Math.min(255, Math.round(b * factor));
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    tintCache.set(key, canvas);
    return canvas;
  }

  // =========================================================================
  // TACTICAL FOV & LINE-OF-SIGHT CONSTANTS
  // =========================================================================

  const FOV_HALF_ANGLE = 1.08; // ~62° each side (124° total forward vision cone)
  const FOV_MAX_DIST = 1350;   // maximum reach of flashlight / sight
  const FOV_CLOSE_RADIUS = 100;// 360° close proximity awareness circle
  const FOV_DARKNESS = "rgba(7, 9, 15, 0.68)"; // Ambient shadow overlay (unseen areas are clearly visible but shaded)

  // =========================================================================
  // ARENA MAPS GENERATION (RUST / GLØSHAUGEN / CYBER HANGAR)
  // =========================================================================

  function buildRustMap() {
    const w = 2200;
    const h = 2200;

    const obstacles = [
      // Outer Perimeter Walls (Scrapyard boundary)
      { x: 0, y: 0, w: w, h: 40, type: "wall" },
      { x: 0, y: h - 40, w: w, h: 40, type: "wall" },
      { x: 0, y: 0, w: 40, h: h, type: "wall" },
      { x: w - 40, y: 0, w: 40, h: h, type: "wall" },

      // ==========================================
      // CENTER RUST TOWER / OIL RIG (Iconic Core)
      // ==========================================
      // 4 heavy steel support pillars
      { x: 970, y: 970, w: 55, h: 55, type: "tower_pillar" },
      { x: 1175, y: 970, w: 55, h: 55, type: "tower_pillar" },
      { x: 970, y: 1175, w: 55, h: 55, type: "tower_pillar" },
      { x: 1175, y: 1175, w: 55, h: 55, type: "tower_pillar" },
      // Tower central shelter crate
      { x: 1060, y: 1060, w: 80, h: 80, type: "crate", label: "RIG-CRATE" },

      // ==========================================
      // SHIPPING CONTAINERS (Corrugated Steel)
      // ==========================================
      // West Blue Container (Classic peek lane)
      { x: 490, y: 980, w: 90, h: 240, type: "container", color: "blue", label: "MSC-702" },
      // East Rust Container (Scrapyard staple)
      { x: 1620, y: 980, w: 90, h: 240, type: "container", color: "rust", label: "TEX-88" },
      // North Olive Military Container
      { x: 980, y: 510, w: 240, h: 90, type: "container", color: "green", label: "MIL-04" },
      // South Dark Steel Container
      { x: 980, y: 1600, w: 240, h: 90, type: "container", color: "dark", label: "HAZ-91" },

      // Staggered Quadrant Containers
      { x: 580, y: 620, w: 200, h: 85, type: "container", color: "rust", label: "CS-RUST" },
      { x: 1420, y: 1495, w: 200, h: 85, type: "container", color: "blue", label: "HAPAG" },
      { x: 1440, y: 620, w: 85, h: 200, type: "container", color: "green", label: "MAERSK" },
      { x: 675, y: 1380, w: 85, h: 200, type: "container", color: "dark", label: "KLINE" },

      // ==========================================
      // INDUSTRIAL PIPELINES
      // ==========================================
      { x: 260, y: 560, w: 40, h: 420, type: "pipe" },
      { x: 1900, y: 1220, w: 40, h: 420, type: "pipe" },
      { x: 1220, y: 260, w: 400, h: 40, type: "pipe" },
      { x: 580, y: 1900, w: 400, h: 40, type: "pipe" },

      // ==========================================
      // CONCRETE BLAST BARRIERS & SANDBAGS
      // ==========================================
      // Sandbags around tower approaches
      { x: 810, y: 840, w: 120, h: 35, type: "sandbags" },
      { x: 1270, y: 840, w: 120, h: 35, type: "sandbags" },
      { x: 810, y: 1325, w: 120, h: 35, type: "sandbags" },
      { x: 1270, y: 1325, w: 120, h: 35, type: "sandbags" },

      // Concrete Blast Barriers
      { x: 380, y: 380, w: 150, h: 35, type: "concrete" },
      { x: 1670, y: 380, w: 150, h: 35, type: "concrete" },
      { x: 380, y: 1785, w: 150, h: 35, type: "concrete" },
      { x: 1670, y: 1785, w: 150, h: 35, type: "concrete" },

      // ==========================================
      // WOODEN CARGO CRATES
      // ==========================================
      { x: 430, y: 1040, w: 50, h: 50, type: "crate" },
      { x: 1720, y: 1110, w: 50, h: 50, type: "crate" },
      { x: 1075, y: 450, w: 50, h: 50, type: "crate" },
      { x: 1075, y: 1700, w: 50, h: 50, type: "crate" },
      { x: 260, y: 1400, w: 60, h: 60, type: "crate" },
      { x: 1880, y: 740, w: 60, h: 60, type: "crate" },
    ];

    const spawns = [
      { x: 180, y: 180 },
      { x: w - 180, y: 180 },
      { x: 180, y: h - 180 },
      { x: w - 180, y: h - 180 },
      { x: w / 2, y: 160 },
      { x: w / 2, y: h - 160 },
      { x: 160, y: h / 2 },
      { x: w - 160, y: h / 2 },
      { x: 420, y: 800 },
      { x: 1780, y: 1400 },
      { x: 780, y: 1780 },
      { x: 1420, y: 420 },
    ];

    // Pickups removed as requested
    const pickups = [];

    // Explosives removed as requested
    const barrels = [];

    return {
      id: "rust",
      name: "Rust (Scrapyard)",
      width: w,
      height: h,
      obstacles,
      spawns,
      pickups,
      barrels,
      bgColor: "#2a180d",
      floorColor: "#936d46",
      gridColor: "#805c38",
      isDesert: true,
    };
  }

  function getMapById(id) {
    if (id === "gloshaugen_arena") return buildGloshaugenArena();
    if (id === "cyber_hangar") return buildCyberHangar();
    return buildRustMap(); // Default map is Rust!
  }

  function buildGloshaugenArena() {
    const w = 2400;
    const h = 1800;

    const obstacles = [
      // Outer Perimeter Boundaries
      { x: 0, y: 0, w: w, h: 40, type: "wall" },
      { x: 0, y: h - 40, w: w, h: 40, type: "wall" },
      { x: 0, y: 0, w: 40, h: h, type: "wall" },
      { x: w - 40, y: 0, w: 40, h: h, type: "wall" },

      // Central Plaza Pillars
      { x: w / 2 - 120, y: h / 2 - 120, w: 60, h: 60, type: "pillar" },
      { x: w / 2 + 60, y: h / 2 - 120, w: 60, h: 60, type: "pillar" },
      { x: w / 2 - 120, y: h / 2 + 60, w: 60, h: 60, type: "pillar" },
      { x: w / 2 + 60, y: h / 2 + 60, w: 60, h: 60, type: "pillar" },

      // Center Low Barrier Cover
      { x: w / 2 - 40, y: h / 2 - 40, w: 80, h: 80, type: "crate" },

      // North-West Corridor Complex
      { x: 260, y: 220, w: 380, h: 35, type: "wall" },
      { x: 605, y: 220, w: 35, h: 260, type: "wall" },
      { x: 260, y: 380, w: 220, h: 35, type: "wall" },
      { x: 380, y: 280, w: 60, h: 60, type: "crate" },

      // North-East Corridor Complex
      { x: w - 640, y: 220, w: 380, h: 35, type: "wall" },
      { x: w - 640, y: 220, w: 35, h: 260, type: "wall" },
      { x: w - 480, y: 380, w: 220, h: 35, type: "wall" },
      { x: w - 440, y: 280, w: 60, h: 60, type: "crate" },

      // South-West Wing
      { x: 260, y: h - 480, w: 35, h: 260, type: "wall" },
      { x: 260, y: h - 255, w: 380, h: 35, type: "wall" },
      { x: 420, y: h - 480, w: 220, h: 35, type: "wall" },
      { x: 380, y: h - 340, w: 60, h: 60, type: "crate" },

      // South-East Wing
      { x: w - 295, y: h - 480, w: 35, h: 260, type: "wall" },
      { x: w - 640, y: h - 255, w: 380, h: 35, type: "wall" },
      { x: w - 640, y: h - 480, w: 220, h: 35, type: "wall" },
      { x: w - 440, y: h - 340, w: 60, h: 60, type: "crate" },

      // Mid-field tactical blocks
      { x: w / 2 - 400, y: h / 2 - 25, w: 180, h: 50, type: "wall" },
      { x: w / 2 + 220, y: h / 2 - 25, w: 180, h: 50, type: "wall" },
      { x: w / 2 - 25, y: h / 2 - 400, w: 50, h: 180, type: "wall" },
      { x: w / 2 - 25, y: h / 2 + 220, w: 50, h: 180, type: "wall" },
    ];

    const spawns = [
      { x: 160, y: 160 },
      { x: w - 160, y: 160 },
      { x: 160, y: h - 160 },
      { x: w - 160, y: h - 160 },
      { x: w / 2, y: 140 },
      { x: w / 2, y: h - 140 },
      { x: 140, y: h / 2 },
      { x: w - 140, y: h / 2 },
      { x: w / 2 - 320, y: h / 2 - 260 },
      { x: w / 2 + 320, y: h / 2 + 260 },
      { x: w / 2 + 320, y: h / 2 - 260 },
      { x: w / 2 - 320, y: h / 2 + 260 },
    ];

    // Pickups removed as requested
    const pickups = [];

    // Explosives removed as requested
    const barrels = [];

    return {
      id: "gloshaugen_arena",
      name: "Gløshaugen Arena",
      width: w,
      height: h,
      obstacles,
      spawns,
      pickups,
      barrels,
      bgColor: "#0f172a",
      floorColor: "#1e293b",
      gridColor: "#334155",
    };
  }

  function buildCyberHangar() {
    const w = 2600;
    const h = 2000;

    const obstacles = [
      { x: 0, y: 0, w: w, h: 40, type: "wall" },
      { x: 0, y: h - 40, w: w, h: 40, type: "wall" },
      { x: 0, y: 0, w: 40, h: h, type: "wall" },
      { x: w - 40, y: 0, w: 40, h: h, type: "wall" },

      // Central Command Bunker
      { x: w / 2 - 160, y: h / 2 - 160, w: 320, h: 40, type: "wall" },
      { x: w / 2 - 160, y: h / 2 + 120, w: 320, h: 40, type: "wall" },
      { x: w / 2 - 160, y: h / 2 - 120, w: 40, h: 80, type: "wall" },
      { x: w / 2 + 120, y: h / 2 - 120, w: 40, h: 80, type: "wall" },
      { x: w / 2 - 160, y: h / 2 + 40, w: 40, h: 80, type: "wall" },
      { x: w / 2 + 120, y: h / 2 + 40, w: 40, h: 80, type: "wall" },

      // Hangars
      { x: 300, y: 260, w: 400, h: 40, type: "wall" },
      { x: 300, y: 260, w: 40, h: 420, type: "wall" },
      { x: 550, y: 400, w: 60, h: 60, type: "crate" },
      { x: 450, y: 520, w: 60, h: 60, type: "crate" },

      { x: w - 700, y: 260, w: 400, h: 40, type: "wall" },
      { x: w - 340, y: 260, w: 40, h: 420, type: "wall" },
      { x: w - 610, y: 400, w: 60, h: 60, type: "crate" },
      { x: w - 510, y: 520, w: 60, h: 60, type: "crate" },

      { x: 300, y: h - 300, w: 400, h: 40, type: "wall" },
      { x: 300, y: h - 680, w: 40, h: 420, type: "wall" },

      { x: w - 700, y: h - 300, w: 400, h: 40, type: "wall" },
      { x: w - 340, y: h - 680, w: 40, h: 420, type: "wall" },

      // Runway Containers
      { x: w / 2 - 450, y: 350, w: 120, h: 60, type: "crate" },
      { x: w / 2 + 330, y: 350, w: 120, h: 60, type: "crate" },
      { x: w / 2 - 450, y: h - 410, w: 120, h: 60, type: "crate" },
      { x: w / 2 + 330, y: h - 410, w: 120, h: 60, type: "crate" },
    ];

    const spawns = [
      { x: 180, y: 180 },
      { x: w - 180, y: 180 },
      { x: 180, y: h - 180 },
      { x: w - 180, y: h - 180 },
      { x: w / 2, y: 200 },
      { x: w / 2, y: h - 200 },
      { x: 180, y: h / 2 },
      { x: w - 180, y: h / 2 },
      { x: w / 2 - 380, y: h / 2 },
      { x: w / 2 + 380, y: h / 2 },
    ];

    // Pickups removed as requested
    const pickups = [];

    // Explosives removed as requested
    const barrels = [];

    return {
      id: "cyber_hangar",
      name: "Cyber Hangar",
      width: w,
      height: h,
      obstacles,
      spawns,
      pickups,
      barrels,
      bgColor: "#090d16",
      floorColor: "#111827",
      gridColor: "#1f2937",
    };
  }

  // =========================================================================
  // AUDIO SYNTHESIZER (WEB AUDIO API)
  // =========================================================================

  let audioCtx = null;
  let soundEnabled = true;

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function playTone(freq, duration, type = "sine", gainVal = 0.2, endFreq = null) {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;

    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      if (endFreq !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(10, endFreq), audioCtx.currentTime + duration);
      }

      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  function playNoise(duration, gainVal = 0.3, lowpassFreq = null) {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;

    try {
      const bufferSize = audioCtx.sampleRate * duration;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = audioCtx.createBufferSource();
      whiteNoise.buffer = buffer;

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

      if (lowpassFreq) {
        const filter = audioCtx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(lowpassFreq, audioCtx.currentTime);
        whiteNoise.connect(filter);
        filter.connect(gain);
      } else {
        whiteNoise.connect(gain);
      }

      gain.connect(audioCtx.destination);
      whiteNoise.start();
    } catch (e) {}
  }

  function playWeaponSound(weaponId) {
    switch (weaponId) {
      case "pistol":
        playTone(550, 0.08, "triangle", 0.35, 120);
        playNoise(0.06, 0.25, 2400);
        break;
      case "shotgun":
        playTone(180, 0.18, "sawtooth", 0.45, 40);
        playNoise(0.22, 0.5, 1800);
        break;
      case "assault":
        playTone(420, 0.07, "sawtooth", 0.3, 160);
        playNoise(0.05, 0.2, 3200);
        break;
      case "sniper":
        playTone(850, 0.25, "triangle", 0.55, 60);
        playNoise(0.3, 0.6, 4500);
        break;
      case "rocket":
        playTone(280, 0.35, "sine", 0.4, 90);
        playNoise(0.4, 0.35, 900);
        break;
    }
  }

  function playHitConfirmation() {
    playTone(880, 0.05, "sine", 0.18);
  }

  function playExplosionSound() {
    playTone(110, 0.45, "sawtooth", 0.6, 25);
    playNoise(0.55, 0.7, 750);
  }

  function playPickupSound(type) {
    if (type === "medkit") {
      playTone(523, 0.08, "sine", 0.25);
      setTimeout(() => playTone(659, 0.12, "sine", 0.25), 80);
    } else if (type === "shield") {
      playTone(440, 0.08, "triangle", 0.25);
      setTimeout(() => playTone(880, 0.14, "triangle", 0.25), 80);
    } else {
      playTone(493, 0.08, "triangle", 0.25);
      setTimeout(() => playTone(784, 0.16, "triangle", 0.3), 90);
    }
  }

  function playKillFanfare() {
    playTone(587, 0.1, "triangle", 0.3);
    setTimeout(() => playTone(880, 0.25, "triangle", 0.35), 110);
  }

  // =========================================================================
  // APPLICATION STATE
  // =========================================================================

  const state = {
    view: "lobby", // "lobby" | "game"
    mode: "ffa",   // "ffa" | "tdm"
    playerTeam: "red", // "red" | "blue"
    roomCode: null,
    playerId: null,
    isHost: false,
    isSolo: false,
    playerName: localStorage.getItem("spillhjornet_player_name") || localStorage.getItem("party_player_name") || localStorage.getItem("kr_player_name") || "Soldat",
    playerColor: localStorage.getItem("kr_player_color") || "#ffd166",
    playerAvatar: localStorage.getItem("party_avatar") || localStorage.getItem("kr_player_avatar") || localStorage.getItem("spillhjornet_character") || "char:h1:c_ffd166:r1:e1:m1",

    selectedWeapon: "cannon",
    roomStatus: "lobby", // "lobby" | "countdown" | "playing" | "finished"
    mapId: "rust",
    currentMap: buildRustMap(),
    scoreLimit: 15,
    timeLimit: 300,
    timeRemaining: 300,
    selectedTank: localStorage.getItem("kuleregn_tank") || "medium",
    turntableAngle: -Math.PI / 2,
    isMyReady: false,
    lobbyPollTimerId: null,

    // Local Player Tank
    player: {
      id: "player_local",
      name: "Soldat",
      color: "#ffd166",
      avatar: "",
      tank: localStorage.getItem("kuleregn_tank") || "medium",
      x: 400,
      y: 400,
      angle: -Math.PI / 2,     // Turret facing angle (pointing UP initially)
      hullAngle: -Math.PI / 2, // Tank chassis facing angle (pointing UP initially)
      trackDistance: 0,
      trackFrame: 0,
      recoilOffset: 0,
      recoilVx: 0,
      recoilVy: 0,
      vx: 0,
      vy: 0,
      speed: 160,
      health: 100,
      shield: 0,
      maxHealth: 100,
      maxShield: 0,
      weapon: "cannon",
      ammo: Infinity,
      fireTimer: 0,
      kills: 0,
      deaths: 0,
      score: 0,
      streak: 0,
      highestStreak: 0,
      invulnerableUntil: 0,
      isDead: false,
      respawnTimer: 0,
    },

    // Opponent Real Players
    opponents: {},

    // Active Projectiles / Bullets
    bullets: [],

    // Explosions & Particles
    particles: [],

    // Tire Skidmarks from Rally Drift
    skidmarks: [],

    // Camera (Zoomed 3x in for closer tank combat)
    camera: { x: 400, y: 400, zoom: 3.0, shake: 0 },

    // Input States (WASD Tank Steering/Throttle, Left/Right/Up Arrows Turret, Space/Click Shoot)
    keys: {
      w: false, a: false, s: false, d: false,
      arrowLeft: false, arrowRight: false, arrowUp: false,
      shoot: false
    },
    mouse: { down: false, screenX: 0, screenY: 0 },

    // Networking
    syncTimerId: null,
    animFrameId: null,
    lastTime: 0,
    killFeed: [],
    seenKillFeedIds: new Set(),
    recentEvents: [],
    recentShots: [],
    seenShotIds: new Set(),
  };

  // =========================================================================
  // DOM ELEMENT REFERENCES
  // =========================================================================

  const el = {
    // Views
    viewLobby: document.getElementById("viewLobby"),
    viewWaitingRoom: document.getElementById("viewWaitingRoom"),
    viewGame: document.getElementById("viewGame"),
    combatCanvas: document.getElementById("combatCanvas"),

    // Header Elements
    btnHeaderBack: document.getElementById("btnHeaderBack"),
    backBtnText: document.getElementById("backBtnText"),
    btnPartyHub: document.getElementById("btnPartyHub"),
    btnSoundToggle: document.getElementById("btnSoundToggle"),
    btnHeaderLeave: document.getElementById("btnHeaderLeave"),
    headGameStatus: document.getElementById("headGameStatus"),
    headClock: document.getElementById("headClock"),
    headTargetScore: document.getElementById("headTargetScore"),

    // Mode Navigation Tabs & Panels
    tabOnline: document.getElementById("tabOnline"),
    tabSolo: document.getElementById("tabSolo"),
    panelOnline: document.getElementById("panelOnline"),
    panelSolo: document.getElementById("panelSolo"),

    // Standard PartyConnect Elements (Nettspill fane)
    inputPartyHostName: document.getElementById("inputPartyHostName"),
    btnCreatePartyRoom: document.getElementById("btnCreatePartyRoom"),
    inputPartyRoomCode: document.getElementById("inputPartyRoomCode"),
    inputPartyJoinName: document.getElementById("inputPartyJoinName"),
    btnJoinPartyRoom: document.getElementById("btnJoinPartyRoom"),

    // Waiting Room & Vehicle Turntable Elements
    displayRoomCode: document.getElementById("displayRoomCode"),
    btnCopyRoomCode: document.getElementById("btnCopyRoomCode"),
    displayWaitingMap: document.getElementById("displayWaitingMap"),
    displayWaitingTarget: document.getElementById("displayWaitingTarget"),
    waitingRoomStatusPill: document.getElementById("waitingRoomStatusPill"),
    wrTurntablePanel: document.getElementById("wrTurntablePanel"),
    btnTankPrev: document.getElementById("btnTankPrev"),
    btnTankNext: document.getElementById("btnTankNext"),
    turntableStage: document.getElementById("turntableStage"),
    canvasVehicleTurntable: document.getElementById("canvasVehicleTurntable"),
    ttStatSpeed: document.getElementById("ttStatSpeed"),
    ttFillSpeed: document.getElementById("ttFillSpeed"),
    ttStatArmor: document.getElementById("ttStatArmor"),
    ttFillArmor: document.getElementById("ttFillArmor"),
    ttStatDamage: document.getElementById("ttStatDamage"),
    ttFillDamage: document.getElementById("ttFillDamage"),
    ttStatRate: document.getElementById("ttStatRate"),
    ttFillRate: document.getElementById("ttFillRate"),
    // Waiting Room Config Bar & Teams
    wrConfigBar: document.getElementById("wrConfigBar"),
    btnModeFFA: document.getElementById("btnModeFFA"),
    btnModeTDM: document.getElementById("btnModeTDM"),
    wrSelectMap: document.getElementById("wrSelectMap"),
    wrRosterTitle: document.getElementById("wrRosterTitle"),
    waitingTeamSplit: document.getElementById("waitingTeamSplit"),
    gridTeamRed: document.getElementById("gridTeamRed"),
    gridTeamBlue: document.getElementById("gridTeamBlue"),
    countTeamRed: document.getElementById("countTeamRed"),
    countTeamBlue: document.getElementById("countTeamBlue"),
    btnSwapTeam: document.getElementById("btnSwapTeam"),
    waitingPlayerCount: document.getElementById("waitingPlayerCount"),
    waitingPlayersGrid: document.getElementById("waitingPlayersGrid"),
    btnToggleReady: document.getElementById("btnToggleReady"),
    btnHostStartMatch: document.getElementById("btnHostStartMatch"),
    btnLeaveWaitingRoom: document.getElementById("btnLeaveWaitingRoom"),

    // Solo Practice Elements
    soloTankPicker: document.getElementById("soloTankPicker"),
    selectSoloMap: document.getElementById("selectSoloMap"),
    btnStartSoloPractice: document.getElementById("btnStartSoloPractice"),

    // In-game HUD Elements (View 2)
    ingameTankDock: document.getElementById("ingameTankDock"),
    hudRankPill: document.getElementById("hudRankPill"),
    minimapCanvas: document.getElementById("minimapCanvas"),
    hudPosNum: document.getElementById("hudPosNum"),
    hudKillsText: document.getElementById("hudKillsText"),
    hudStreakBanner: document.getElementById("hudStreakBanner"),
    hudStreakCount: document.getElementById("hudStreakCount"),
    hudMatchTime: document.getElementById("hudMatchTime"),
    hudTargetSub: document.getElementById("hudTargetSub"),
    killFeedContainer: document.getElementById("killFeedContainer"),
    vitalShieldFill: document.getElementById("vitalShieldFill"),
    vitalShieldNum: document.getElementById("vitalShieldNum"),
    vitalHealthFill: document.getElementById("vitalHealthFill"),
    vitalHealthNum: document.getElementById("vitalHealthNum"),
    weaponHudIcon: document.getElementById("weaponHudIcon"),
    weaponHudName: document.getElementById("weaponHudName"),
    weaponHudType: document.getElementById("weaponHudType"),
    ammoCurrent: document.getElementById("ammoCurrent"),
    ammoLabel: document.getElementById("ammoLabel"),
    pickupToast: document.getElementById("pickupToast"),
    pickupToastIcon: document.getElementById("pickupToastIcon"),
    pickupToastText: document.getElementById("pickupToastText"),
    scoreboardModal: document.getElementById("scoreboardModal"),
    scoreboardBody: document.getElementById("scoreboardBody"),
    sbTargetText: document.getElementById("sbTargetText"),
    lowHealthVignette: document.getElementById("lowHealthVignette"),
    countdownOverlay: document.getElementById("countdownOverlay"),
    countdownText: document.getElementById("countdownText"),

    // Victory Podium Modal
    modalPodium: document.getElementById("modalPodium"),
    podiumTitle: document.getElementById("podiumTitle"),
    podiumDesc: document.getElementById("podiumDesc"),
    podiumStandings: document.getElementById("podiumStandings"),
    btnPodiumReturnLobby: document.getElementById("btnPodiumReturnLobby"),
    btnPodiumReturnGateway: document.getElementById("btnPodiumReturnGateway"),
  };

  // =========================================================================
  // CHARACTER CREATOR INTEGRATION & AVATAR CACHE
  // =========================================================================

  const avatarCanvasCache = new Map();

  function getAvatarCanvas(avatarStr, size = 64) {
    const raw = avatarStr || state.playerAvatar || "char:h1:c_ffd166:r1:e1:m1";
    const key = `${raw}_${size}`;
    if (avatarCanvasCache.has(key)) {
      return avatarCanvasCache.get(key);
    }
    const cvs = document.createElement("canvas");
    cvs.width = size;
    cvs.height = size;
    if (window.CharacterCreator && typeof CharacterCreator.compositeCharacterSync === "function") {
      try {
        CharacterCreator.compositeCharacterSync(cvs, raw);
      } catch (e) {
        console.warn("Avatar composite error:", e);
      }
    }
    avatarCanvasCache.set(key, cvs);
    return cvs;
  }

  function clearAvatarCache() {
    avatarCanvasCache.clear();
  }

  // =========================================================================
  // VIEW SWITCHER & WAITING ROOM CONTROLLER
  // =========================================================================

  let lobbyPollTimer = null;

  function showView(viewName) {
    state.view = viewName;

    if (el.viewLobby) el.viewLobby.classList.toggle("hidden", viewName !== "lobby");
    if (el.viewWaitingRoom) el.viewWaitingRoom.classList.toggle("hidden", viewName !== "waiting");
    if (el.viewGame) el.viewGame.classList.toggle("hidden", viewName !== "game");
    if (el.btnHeaderLeave) el.btnHeaderLeave.classList.toggle("hidden", viewName !== "game");

    if (viewName === "lobby") {
      if (el.headGameStatus) el.headGameStatus.classList.add("hidden");
      if (el.modalPodium) el.modalPodium.classList.add("hidden");
      if (el.startWeaponOverlay) el.startWeaponOverlay.classList.add("hidden");
      if (el.btnHeaderBack) {
        el.btnHeaderBack.href = state.roomCode ? `/party/?room=${encodeURIComponent(state.roomCode)}` : "/party/";
      }
      if (el.backBtnText) {
        el.backBtnText.textContent = state.roomCode ? "Forlat rommet" : "Lounge";
      }
      stopSimulation();
      stopRoomSync();
      stopLobbyPoll();
      stopTurntableLoop();
    } else if (viewName === "waiting") {
      if (el.headGameStatus) el.headGameStatus.classList.add("hidden");
      if (el.modalPodium) el.modalPodium.classList.add("hidden");
      if (el.btnHeaderBack) {
        el.btnHeaderBack.href = state.roomCode ? `/party/?room=${encodeURIComponent(state.roomCode)}` : "/party/";
      }
      if (el.backBtnText) {
        el.backBtnText.textContent = state.isSolo ? "Lounge" : "Forlat rommet";
      }
      stopSimulation();
      stopRoomSync();
      if (!state.isSolo) {
        startLobbyPoll();
      } else {
        stopLobbyPoll();
      }
      startTurntableLoop();
      updateTurntableStatsUI();
      renderTurntablePreview();
    } else if (viewName === "game") {
      if (el.headGameStatus) el.headGameStatus.classList.remove("hidden");
      if (el.modalPodium) el.modalPodium.classList.add("hidden");
      if (el.btnHeaderBack) {
        el.btnHeaderBack.href = "#";
      }
      if (el.backBtnText) {
        el.backBtnText.textContent = state.isSolo ? "Meny" : "Forlat rommet";
      }
      stopLobbyPoll();
      stopTurntableLoop();
      resizeCanvas();
    }
  }

  // =========================================================================
  // TANK PREVIEW RENDERING (Canvas Tank Cards & Hero Showcase)
  // =========================================================================

  function drawFallbackVehiclePreview(ctx, tankType, color, size) {
    ctx.save();
    if (tankType === "heavy") {
      // Heavy Fortress Tank fallback
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(-size * 0.46, -size * 0.44, size * 0.24, size * 0.88);
      ctx.fillRect(size * 0.22, -size * 0.44, size * 0.24, size * 0.88);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-size * 0.32, -size * 0.40, size * 0.64, size * 0.80, 6);
      ctx.fill();
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // 152mm cannon barrel & muzzle brake
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(-size * 0.09, -size * 0.62, size * 0.18, size * 0.45);
      ctx.fillRect(-size * 0.14, -size * 0.65, size * 0.28, size * 0.08);
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = "#334155";
      ctx.fill();
      ctx.stroke();
    } else {
      // Light / Medium tank fallback
      const wTrack = tankType === "light" ? size * 0.16 : size * 0.20;
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(-size * 0.44, -size * 0.42, wTrack, size * 0.84);
      ctx.fillRect(size * 0.44 - wTrack, -size * 0.42, wTrack, size * 0.84);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-size * 0.28, -size * 0.38, size * 0.56, size * 0.76, 5);
      ctx.fill();
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(-size * 0.05, -size * 0.56, size * 0.10, size * 0.4);
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = "#334155";
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function renderTankPreview(canvas, tankType, hexColor, customAngle) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;

    const sprites = TANK_SPRITES[tankType] || TANK_SPRITES.medium;
    const tConf = TANK_CONFIGS[tankType] || TANK_CONFIGS.medium;
    // For rotating turntable (480x390), scale up boldly to ~346px!
    const isRotating = customAngle !== undefined;
    const baseDivider = isRotating ? 72 : 64;
    const targetScale = Math.min(w / baseDivider, h / baseDivider);
    const tankSize = Math.round(64 * (targetScale > 0 ? targetScale : 1));
    const color = hexColor || state.playerColor || "#ffd166";

    ctx.save();
    ctx.translate(w / 2, h / 2);
    const angle = isRotating ? customAngle : -Math.PI / 2;

    // Check if body sprite is tinted & ready
    const bodyImg = getTintedSprite(sprites.body, color);
    if (!bodyImg) {
      // Procedural fallback so preview canvas is NEVER blank while loading!
      ctx.rotate(angle + Math.PI / 2);
      drawFallbackVehiclePreview(ctx, tankType, color, tankSize);
      ctx.restore();
      return;
    }

    // Tracks (Static track sprite)
    const trackImg = sprites.tracks instanceof Image ? sprites.tracks : sprites.tracks?.[0];
    if (trackImg && trackImg.complete && trackImg.naturalWidth > 0) {
      ctx.save();
      ctx.rotate(angle + Math.PI / 2);
      ctx.drawImage(trackImg, -tankSize / 2, -tankSize / 2, tankSize, tankSize);
      ctx.restore();
    }

    // Body
    ctx.save();
    ctx.rotate(angle + Math.PI / 2);
    ctx.drawImage(bodyImg, -tankSize / 2, -tankSize / 2, tankSize, tankSize);
    ctx.restore();

    // Turret
    const turretImg = getTintedSprite(sprites.turret, color);
    if (turretImg) {
      ctx.save();
      ctx.rotate(angle + Math.PI / 2);
      ctx.drawImage(turretImg, -tankSize / 2, -tankSize / 2, tankSize, tankSize);
      ctx.restore();
    }

    ctx.restore();
  }

  // =========================================================================
  // TURNTABLE SELECTOR & VEHICLE STATS UI
  // =========================================================================

  const TANK_ORDER = ["light", "medium", "heavy"];

  const TANK_STATS_UI = {
    light: {
      speedPct: 78,
      speedText: "140",
      armorPct: 35,
      armorText: "75 HP",
      damagePct: 48,
      damageText: "35",
      ratePct: 85,
      rateText: "2.6/s",
    },
    medium: {
      speedPct: 60,
      speedText: "110",
      armorPct: 60,
      armorText: "100 HP",
      damagePct: 65,
      damageText: "50",
      ratePct: 60,
      rateText: "1.5/s",
    },
    heavy: {
      speedPct: 40,
      speedText: "75",
      armorPct: 100,
      armorText: "140 HP",
      damagePct: 100,
      damageText: "250",
      ratePct: 25,
      rateText: "0.4/s",
    },
  };

  function updateTurntableStatsUI(tankType) {
    const t = tankType || state.selectedTank || "medium";
    const info = TANK_STATS_UI[t] || TANK_STATS_UI.medium;

    if (el.ttStatSpeed) el.ttStatSpeed.textContent = info.speedText;
    if (el.ttFillSpeed) el.ttFillSpeed.style.width = `${info.speedPct}%`;

    if (el.ttStatArmor) el.ttStatArmor.textContent = info.armorText;
    if (el.ttFillArmor) el.ttFillArmor.style.width = `${info.armorPct}%`;

    if (el.ttStatDamage) el.ttStatDamage.textContent = info.damageText;
    if (el.ttFillDamage) el.ttFillDamage.style.width = `${info.damagePct}%`;

    if (el.ttStatRate) el.ttStatRate.textContent = info.rateText;
    if (el.ttFillRate) el.ttFillRate.style.width = `${info.ratePct}%`;
  }

  let turntableAnimId = null;
  let lastTurntableTime = performance.now();

  function startTurntableLoop() {
    if (!turntableAnimId) {
      lastTurntableTime = performance.now();
      turntableAnimId = requestAnimationFrame(turntableStep);
    }
  }

  function stopTurntableLoop() {
    if (turntableAnimId) {
      cancelAnimationFrame(turntableAnimId);
      turntableAnimId = null;
    }
  }

  function turntableStep(now) {
    const dt = Math.min((now - lastTurntableTime) / 1000, 0.1);
    lastTurntableTime = now;

    if (state.view === "waiting" && el.canvasVehicleTurntable) {
      // Rotate slowly: ~0.75 rad/s = full 360° rotation in ~8.4s
      state.turntableAngle = (state.turntableAngle + dt * 0.75) % (Math.PI * 2);
      renderTurntablePreview();
    }

    turntableAnimId = requestAnimationFrame(turntableStep);
  }

  function renderTurntablePreview() {
    if (!el.canvasVehicleTurntable) return;
    const chosen = state.selectedTank || "medium";
    const previewColor = state.mode === "tdm"
      ? (state.playerTeam === "blue" ? "#38bdf8" : "#f43f5e")
      : (state.playerColor || "#ffd166");
    renderTankPreview(el.canvasVehicleTurntable, chosen, previewColor, state.turntableAngle);
  }

  function cycleTank(delta) {
    const current = state.selectedTank || "medium";
    let idx = TANK_ORDER.indexOf(current);
    if (idx === -1) idx = 2;
    const nextIdx = (idx + delta + TANK_ORDER.length) % TANK_ORDER.length;
    selectTankInGame(TANK_ORDER[nextIdx]);
    playTone(340, 0.08, "triangle", 0.25);
  }

  function updateHeroWaitingPreview() {
    renderTurntablePreview();
    updateTurntableStatsUI();
  }

  function renderAllTankPreviews() {
    renderTurntablePreview();
    updateTurntableStatsUI();
  }

  function triggerAllPreviewsUpdate() {
    renderAllTankPreviews();
    if (el.waitingPlayersGrid) {
      el.waitingPlayersGrid.querySelectorAll(".wpc-vehicle-canvas").forEach(cvs => {
        const t = cvs.dataset.tank || "medium";
        const col = cvs.dataset.color || "#ffd166";
        renderTankPreview(cvs, t, col);
      });
    }
  }

  function syncTankCardsUI() {
    const chosen = state.selectedTank || "medium";
    updateTurntableStatsUI(chosen);
    renderTurntablePreview();
  }

  function selectTankInGame(tankType) {
    if (!TANK_CONFIGS[tankType]) return;
    // Tank is locked in once the multiplayer match is underway
    if (state.view === "game" && !state.isSolo) return;

    const prevTank = state.selectedTank;
    state.selectedTank = tankType;
    localStorage.setItem("kuleregn_tank", tankType);

    const tConf = TANK_CONFIGS[tankType];
    state.player.tank = tankType;
    state.player.maxHealth = tConf.maxHealth;
    state.player.maxShield = 0;
    state.player.shield = 0;

    if (state.isSolo) {
      // In Skytebane: immediately restore to full health so players can test fresh!
      state.player.health = tConf.maxHealth;
      if (prevTank !== tankType) {
        addMuzzleParticles(state.player.x, state.player.y, state.player.angle, tConf.weapon.color);
        playTone(tConf.id === "heavy" ? 140 : 320, 0.12, "triangle", 0.4);
      }
    } else {
      // In multiplayer: keep current health bounded by new max
      state.player.health = Math.min(state.player.health, tConf.maxHealth);
      if (prevTank !== tankType) {
        playTone(320, 0.08, "sine", 0.3);
      }
      if (state.roomCode && state.playerId) {
        fetch("/api/kuleregn/tank", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            playerId: state.playerId,
            tank: tankType,
          }),
        }).catch(() => {});
      }
    }

    updateTurntableStatsUI(tankType);
    renderTurntablePreview();

    // Immediate local player card tank preview update in waiting room grid
    if (el.waitingPlayersGrid && state.playerId) {
      const myCard = el.waitingPlayersGrid.querySelector(`[data-player-id="${state.playerId}"]`);
      if (myCard) {
        const myVehCvs = myCard.querySelector(".wpc-vehicle-canvas");
        if (myVehCvs) {
          myVehCvs.dataset.tank = tankType;
          renderTankPreview(myVehCvs, tankType, state.playerColor);
        }
      }
    }

    updateWeaponHUD();
    updateVitalsHUD();
  }

  async function selectTank(tankType) {
    selectTankInGame(tankType);
  }

  // =========================================================================
  // MULTIPLAYER LOBBY POLLING & READY STATE
  // =========================================================================

  function startLobbyPoll() {
    if (lobbyPollTimer) clearInterval(lobbyPollTimer);
    pollLobbyState();
    lobbyPollTimer = setInterval(pollLobbyState, 600);
  }

  function stopLobbyPoll() {
    if (lobbyPollTimer) {
      clearInterval(lobbyPollTimer);
      lobbyPollTimer = null;
    }
  }

  async function pollLobbyState() {
    if (state.view !== "waiting" || !state.roomCode) return;

    try {
      const resp = await fetch(`/api/kuleregn/state?roomCode=${encodeURIComponent(state.roomCode)}&playerId=${encodeURIComponent(state.playerId || "")}`);
      const data = await resp.json();
      if (!data || !data.ok) return;

      if (data.status === "countdown" || data.status === "playing") {
        stopLobbyPoll();
        launchOnlineMatch(data);
        return;
      }

      renderWaitingRoomState(data);
    } catch (e) {
      console.warn("Lobby poll error:", e);
    }
  }

  function createPlayerRosterCard(p, isMe) {
    const isReady = Boolean(p.isReady);
    const tankKey = p.tank || "medium";
    const team = p.team || (p.color === "#38bdf8" ? "blue" : "red");
    // In TDM mode, ALL players are strictly the color of their team
    const pColor = state.mode === "tdm" ? (team === "blue" ? "#38bdf8" : "#f43f5e") : (p.color || "#ffd166");
    const pName = p.name || "Soldat";

    const card = document.createElement("div");
    card.dataset.playerId = p.id;
    card.title = `${pName}${isMe ? " (Deg)" : ""}`;
    const teamClass = state.mode === "tdm" ? (team === "blue" ? "is-team-blue" : "is-team-red") : "";
    card.className = `waiting-player-card ${isReady ? "is-ready" : "is-not-ready"} ${teamClass}`;

    const avCanvas = getAvatarCanvas(p.avatar, 36);

    card.innerHTML = `
      <div class="wpc-player-duo">
        <canvas class="wpc-vehicle-canvas" width="148" height="118" data-tank="${escapeHtml(tankKey)}" data-color="${escapeHtml(pColor)}"></canvas>
        <canvas class="wpc-avatar-canvas" width="36" height="36" title="${escapeHtml(pName)}"></canvas>
      </div>
    `;

    const cvs = card.querySelector(".wpc-avatar-canvas");
    if (cvs) {
      if (window.CharacterCreator && typeof CharacterCreator.compositeCharacterSync === "function") {
        try {
          CharacterCreator.compositeCharacterSync(cvs, p.avatar || state.playerAvatar || "");
        } catch (e) {
          const cvsCtx = cvs.getContext("2d");
          if (avCanvas) cvsCtx.drawImage(avCanvas, 0, 0, 36, 36);
        }
      } else if (avCanvas) {
        const cvsCtx = cvs.getContext("2d");
        cvsCtx.imageSmoothingEnabled = false;
        cvsCtx.drawImage(avCanvas, 0, 0, 36, 36);
      }
    }

    const vehCvs = card.querySelector(".wpc-vehicle-canvas");
    if (vehCvs) {
      renderTankPreview(vehCvs, tankKey, pColor);
    }

    return card;
  }

  function updateModeAndTeamUI() {
    const isTDM = state.mode === "tdm";
    if (el.btnModeFFA) el.btnModeFFA.classList.toggle("active", !isTDM);
    if (el.btnModeTDM) el.btnModeTDM.classList.toggle("active", isTDM);

    if (el.btnSwapTeam) {
      el.btnSwapTeam.title = state.playerTeam === "blue" ? "Bytt til Rødt lag" : "Bytt til Blått lag";
    }

    if (el.wrSelectMap && el.wrSelectMap.value !== state.mapId) {
      el.wrSelectMap.value = state.mapId;
    }

    // Host controls permission
    const canConfigure = state.isSolo || state.isHost;
    if (el.btnModeFFA) el.btnModeFFA.disabled = !canConfigure;
    if (el.btnModeTDM) el.btnModeTDM.disabled = !canConfigure;
    if (el.wrSelectMap) el.wrSelectMap.disabled = !canConfigure;
  }

  async function swapTeam() {
    const nextTeam = state.playerTeam === "blue" ? "red" : "blue";
    await setPlayerTeam(nextTeam);
    playTone(360, 0.08, "triangle", 0.3);
  }

  async function setWaitingMode(mode) {
    if (state.mode === mode) return;
    state.mode = mode;
    if (state.mode === "tdm") {
      state.player.team = state.playerTeam || "red";
      state.player.color = state.player.team === "blue" ? "#38bdf8" : "#f43f5e";
    } else {
      state.player.team = null;
      state.player.color = state.playerColor || "#ffd166";
    }
    updateModeAndTeamUI();
    renderTurntablePreview();

    if (state.isSolo) {
      renderSoloWaitingRoom();
      return;
    }

    if (!state.roomCode || !state.playerId) return;
    try {
      await fetch("/api/kuleregn/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          mode: state.mode,
        }),
      });
      pollLobbyState();
    } catch (e) {
      console.warn("setWaitingMode err:", e);
    }
  }

  async function setPlayerTeam(team) {
    state.playerTeam = team;
    state.player.team = team;
    if (state.mode === "tdm") {
      state.player.color = team === "blue" ? "#38bdf8" : "#f43f5e";
    }
    updateModeAndTeamUI();
    renderTurntablePreview();

    if (state.isSolo) {
      renderSoloWaitingRoom();
      return;
    }

    if (!state.roomCode || !state.playerId) return;
    try {
      await fetch("/api/kuleregn/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          team: team,
        }),
      });
      pollLobbyState();
    } catch (e) {
      console.warn("setPlayerTeam err:", e);
    }
  }

  async function setWaitingMap(mapId) {
    state.mapId = mapId;
    state.currentMap = getMapById(mapId);

    if (state.isSolo) {
      return;
    }

    if (!state.roomCode || !state.playerId) return;
    try {
      await fetch("/api/kuleregn/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          mapId: mapId,
        }),
      });
      pollLobbyState();
    } catch (e) {
      console.warn("setWaitingMap err:", e);
    }
  }

  function renderWaitingRoomState(data) {
    if (el.btnLeaveWaitingRoom) {
      el.btnLeaveWaitingRoom.textContent = "◀ FORLAT ROM";
    }
    if (el.displayRoomCode) el.displayRoomCode.textContent = data.roomCode || state.roomCode;
    if (el.displayWaitingMap) {
      const mapObj = getMapById(data.mapId || state.mapId);
      el.displayWaitingMap.textContent = mapObj.name;
    }
    if (el.displayWaitingTarget) {
      el.displayWaitingTarget.textContent = `${data.scoreLimit || state.scoreLimit} drap`;
    }

    // Sync mode and map
    if (data.mode) state.mode = data.mode;
    if (data.mapId) {
      state.mapId = data.mapId;
      state.currentMap = getMapById(data.mapId);
    }

    const players = data.players || [];
    const active = players.filter(p => !p.left);
    if (el.waitingPlayerCount) {
      el.waitingPlayerCount.textContent = `${active.length}/16`;
    }

    const me = players.find(p => p.id === state.playerId || p.isMe);
    if (me) {
      state.isHost = Boolean(me.isHost);
      state.isMyReady = Boolean(me.isReady);
      if (me.team) {
        state.playerTeam = me.team;
        state.player.team = me.team;
      }
      if (me.tank && me.tank !== state.selectedTank) {
        state.selectedTank = me.tank;
        syncTankCardsUI();
      }
      if (me.color && me.color !== state.playerColor) {
        state.playerColor = me.color;
        state.player.color = me.color;
        renderAllTankPreviews();
      }
    }

    updateModeAndTeamUI();

    // Ready toggle button UI
    if (el.btnToggleReady) {
      el.btnToggleReady.classList.toggle("is-ready", state.isMyReady);
      el.btnToggleReady.classList.toggle("is-not-ready", !state.isMyReady);
      const btrLabel = el.btnToggleReady.querySelector(".btr-label");
      if (btrLabel) {
        btrLabel.textContent = state.isMyReady ? "IKKE KLAR" : "JEG ER KLAR";
      }
    }

    // Host Start Button
    if (el.btnHostStartMatch) {
      el.btnHostStartMatch.classList.toggle("hidden", !state.isHost);
    }

    // Status Pill
    const readyCount = active.filter(p => p.isReady).length;
    const allReady = active.length > 0 && readyCount === active.length;
    if (el.waitingRoomStatusPill) {
      if (allReady) {
        el.waitingRoomStatusPill.textContent = "Alle er klare! Kampen starter straks...";
        el.waitingRoomStatusPill.classList.add("ready");
      } else {
        const notReadyCount = active.length - readyCount;
        el.waitingRoomStatusPill.textContent = `Venter på at ${notReadyCount} spiller${notReadyCount > 1 ? "e" : ""} velger tank... (${readyCount}/${active.length})`;
        el.waitingRoomStatusPill.classList.remove("ready");
      }
    }

    // Hero Selected Vehicle Preview
    updateHeroWaitingPreview();

    // Roster rendering: FFA vs TDM
    if (state.mode === "tdm") {
      if (el.waitingPlayersGrid) el.waitingPlayersGrid.classList.add("hidden");
      if (el.waitingTeamSplit) el.waitingTeamSplit.classList.remove("hidden");

      if (el.gridTeamRed) el.gridTeamRed.innerHTML = "";
      if (el.gridTeamBlue) el.gridTeamBlue.innerHTML = "";

      const redPlayers = active.filter(p => p.team === "red" || (!p.team && active.indexOf(p) % 2 === 0));
      const bluePlayers = active.filter(p => p.team === "blue" || (!p.team && active.indexOf(p) % 2 === 1));

      if (el.countTeamRed) el.countTeamRed.textContent = `(${redPlayers.length})`;
      if (el.countTeamBlue) el.countTeamBlue.textContent = `(${bluePlayers.length})`;

      redPlayers.forEach(p => {
        const isMe = Boolean(p.id === state.playerId || p.isMe);
        el.gridTeamRed.appendChild(createPlayerRosterCard(p, isMe));
      });

      bluePlayers.forEach(p => {
        const isMe = Boolean(p.id === state.playerId || p.isMe);
        el.gridTeamBlue.appendChild(createPlayerRosterCard(p, isMe));
      });
    } else {
      // FFA mode
      if (el.waitingTeamSplit) el.waitingTeamSplit.classList.add("hidden");
      if (el.waitingPlayersGrid) {
        el.waitingPlayersGrid.classList.remove("hidden");
        el.waitingPlayersGrid.innerHTML = "";
        active.forEach(p => {
          const isMe = Boolean(p.id === state.playerId || p.isMe);
          el.waitingPlayersGrid.appendChild(createPlayerRosterCard(p, isMe));
        });
      }
    }
  }

  function openSoloTankSelection() {
    state.isSolo = true;
    state.roomCode = null;
    state.playerId = "solo_player";
    const selectedMapId = el.wrSelectMap ? el.wrSelectMap.value : (state.mapId || "rust");
    state.mapId = selectedMapId;
    state.currentMap = getMapById(selectedMapId);
    state.scoreLimit = state.mode === "tdm" ? 15 : 10;
    state.timeLimit = 3600;
    state.timeRemaining = 3600;
    state.roomStatus = "lobby";

    showView("waiting");
    renderSoloWaitingRoom();
  }

  function renderSoloWaitingRoom() {
    if (el.btnLeaveWaitingRoom) {
      el.btnLeaveWaitingRoom.textContent = "◀ TILBAKE";
    }

    if (el.btnToggleReady) {
      el.btnToggleReady.classList.remove("is-ready");
      el.btnToggleReady.classList.add("is-not-ready");
      const btrLabel = el.btnToggleReady.querySelector(".btr-label");
      if (btrLabel) {
        btrLabel.textContent = "START KAMP";
      }
    }

    updateModeAndTeamUI();

    const isTDM = state.mode === "tdm";
    const myTeam = state.playerTeam || "red";
    const oppTeam = myTeam === "red" ? "blue" : "red";

    const meCard = {
      id: "solo_player",
      name: state.playerName || "Soldat",
      tank: state.selectedTank || "medium",
      color: isTDM ? (myTeam === "red" ? "#f43f5e" : "#38bdf8") : (state.playerColor || "#ffd166"),
      avatar: state.playerAvatar || "char:h1:c_ffd166:r1:e1:m1",
      team: myTeam,
      isReady: true,
    };

    if (isTDM) {
      if (el.waitingPlayersGrid) el.waitingPlayersGrid.classList.add("hidden");
      if (el.waitingTeamSplit) el.waitingTeamSplit.classList.remove("hidden");

      if (el.gridTeamRed) el.gridTeamRed.innerHTML = "";
      if (el.gridTeamBlue) el.gridTeamBlue.innerHTML = "";

      const allyCard = {
        id: "solo_ally",
        name: "Alliert-Alfa",
        tank: "medium",
        color: myTeam === "red" ? "#f43f5e" : "#38bdf8",
        avatar: "char:h2:c_38bdf8:r2:e2:m2",
        team: myTeam,
        isReady: true,
      };

      const enemy1 = {
        id: "solo_enemy1",
        name: "Fiende-Alfa",
        tank: "heavy",
        color: oppTeam === "red" ? "#f43f5e" : "#38bdf8",
        avatar: "char:h1:c_f43f5e:r1:e1:m1",
        team: oppTeam,
        isReady: true,
      };

      const enemy2 = {
        id: "solo_enemy2",
        name: "Fiende-Bravo",
        tank: "light",
        color: oppTeam === "red" ? "#f43f5e" : "#38bdf8",
        avatar: "char:h3:c_a855f7:r3:e3:m3",
        team: oppTeam,
        isReady: true,
      };

      if (myTeam === "red") {
        el.gridTeamRed.appendChild(createPlayerRosterCard(meCard, true));
        el.gridTeamRed.appendChild(createPlayerRosterCard(allyCard, false));
        el.gridTeamBlue.appendChild(createPlayerRosterCard(enemy1, false));
        el.gridTeamBlue.appendChild(createPlayerRosterCard(enemy2, false));
      } else {
        el.gridTeamBlue.appendChild(createPlayerRosterCard(meCard, true));
        el.gridTeamBlue.appendChild(createPlayerRosterCard(allyCard, false));
        el.gridTeamRed.appendChild(createPlayerRosterCard(enemy1, false));
        el.gridTeamRed.appendChild(createPlayerRosterCard(enemy2, false));
      }

      if (el.countTeamRed) el.countTeamRed.textContent = "(2)";
      if (el.countTeamBlue) el.countTeamBlue.textContent = "(2)";
      if (el.waitingPlayerCount) el.waitingPlayerCount.textContent = "4/16";
    } else {
      // FFA Solo
      if (el.waitingTeamSplit) el.waitingTeamSplit.classList.add("hidden");
      if (el.waitingPlayersGrid) {
        el.waitingPlayersGrid.classList.remove("hidden");
        el.waitingPlayersGrid.innerHTML = "";
        el.waitingPlayersGrid.appendChild(createPlayerRosterCard(meCard, true));

        const botTargets = [
          { id: "solo_b1", name: "Panser-Alfa", tank: "heavy", color: "#f43f5e", avatar: "char:h1:c_f43f5e:r1:e1:m1", isReady: true },
          { id: "solo_b2", name: "Panser-Bravo", tank: "light", color: "#38bdf8", avatar: "char:h2:c_38bdf8:r2:e2:m2", isReady: true },
          { id: "solo_b3", name: "Panser-Charlie", tank: "medium", color: "#a855f7", avatar: "char:h3:c_a855f7:r3:e3:m3", isReady: true },
          { id: "solo_b4", name: "Panser-Delta", tank: "heavy", color: "#10b981", avatar: "char:h4:c_10b981:r1:e2:m1", isReady: true },
        ];

        botTargets.forEach(b => {
          el.waitingPlayersGrid.appendChild(createPlayerRosterCard(b, false));
        });
      }
      if (el.waitingPlayerCount) el.waitingPlayerCount.textContent = "5/16";
    }

    updateHeroWaitingPreview();
  }

  async function toggleReady() {
    if (state.isSolo) {
      launchSoloPractice();
      return;
    }
    if (!state.roomCode || !state.playerId) return;
    state.isMyReady = !state.isMyReady;

    if (el.btnToggleReady) {
      el.btnToggleReady.classList.toggle("is-ready", state.isMyReady);
      el.btnToggleReady.classList.toggle("is-not-ready", !state.isMyReady);
      const btrLabel = el.btnToggleReady.querySelector(".btr-label");
      if (btrLabel) {
        btrLabel.textContent = state.isMyReady ? "IKKE KLAR" : "JEG ER KLAR";
      }
    }

    try {
      await fetch("/api/kuleregn/ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          ready: state.isMyReady,
        }),
      });
      pollLobbyState();
    } catch (e) {
      console.warn("Toggle ready err:", e);
    }
  }

  async function hostStartMatch() {
    if (!state.roomCode || !state.playerId || !state.isHost) return;
    try {
      const resp = await fetch("/api/kuleregn/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
        }),
      });
      const data = await resp.json();
      if (data && data.ok) {
        pollLobbyState();
      }
    } catch (e) {
      console.warn("Host start err:", e);
    }
  }

  function spawnPlayer(combatant, map) {
    const spawn = map.spawns[Math.floor(Math.random() * map.spawns.length)];
    combatant.x = spawn.x + (Math.random() * 30 - 15);
    combatant.y = spawn.y + (Math.random() * 30 - 15);
    combatant.vx = 0;
    combatant.vy = 0;
    combatant.hullAngle = combatant.hullAngle !== undefined ? combatant.hullAngle : -Math.PI / 2;
    combatant.angle = combatant.angle !== undefined ? combatant.angle : combatant.hullAngle;
    combatant.trackDistance = 0;
    combatant.trackFrame = 0;
    combatant.recoilOffset = 0;
    combatant.recoilVx = 0;
    combatant.recoilVy = 0;

    const tankType = combatant.tank || (combatant === state.player ? state.selectedTank : "medium");
    combatant.tank = tankType;
    const tConf = TANK_CONFIGS[tankType] || TANK_CONFIGS.medium;

    combatant.maxHealth = tConf.maxHealth;
    combatant.maxShield = 0;
    combatant.health = tConf.maxHealth;
    combatant.shield = 0;
    combatant.isDead = false;
    combatant.respawnTimer = 0;
    combatant.weapon = "cannon";
    combatant.ammo = Infinity;
    combatant.invulnerableUntil = performance.now() + 500; // 0.5s brief spawn grace
    if (combatant === state.player) {
      combatant.id = state.playerId || combatant.id || "player_local";
      combatant.name = state.playerName || combatant.name || "Soldat";
      if (state.mode === "tdm") {
        combatant.team = state.playerTeam || combatant.team || "red";
        combatant.color = combatant.team === "blue" ? "#38bdf8" : "#f43f5e";
      } else {
        combatant.color = state.playerColor || combatant.color || "#ffd166";
      }
      combatant.avatar = state.playerAvatar || combatant.avatar || "";
      updateVitalsHUD();
    }

    if (map) {
      applyCombatantMovement(combatant, map, 0);
    }
  }

  function getCombatantById(id) {
    if (!id) return null;
    const myId = state.playerId || state.player.id || "player_local";
    if (id === myId || id === state.playerId || id === state.player.id || id === "player_local" || id === "solo_player") {
      return state.player;
    }
    return state.opponents[id] || null;
  }

  // =========================================================================
  // PHYSICS & COLLISION RESOLUTION (Robust Continuous MTV & Anti-Clipping)
  // =========================================================================

  function resolveCircleRectCollision(cx, cy, r, rect) {
    const minX = rect.x;
    const maxX = rect.x + rect.w;
    const minY = rect.y;
    const maxY = rect.y + rect.h;

    // Check if circle center is strictly inside or on the boundary of the rectangle
    if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
      const distLeft = cx - minX;
      const distRight = maxX - cx;
      const distTop = cy - minY;
      const distBottom = maxY - cy;
      const minDist = Math.min(distLeft, distRight, distTop, distBottom);

      if (minDist === distLeft) {
        return { nx: -1, ny: 0, overlap: distLeft + r };
      } else if (minDist === distRight) {
        return { nx: 1, ny: 0, overlap: distRight + r };
      } else if (minDist === distTop) {
        return { nx: 0, ny: -1, overlap: distTop + r };
      } else {
        return { nx: 0, ny: 1, overlap: distBottom + r };
      }
    }

    // Closest point on the rectangle boundary to the circle center
    const closestX = Math.max(minX, Math.min(cx, maxX));
    const closestY = Math.max(minY, Math.min(cy, maxY));

    const dx = cx - closestX;
    const dy = cy - closestY;
    const distSq = dx * dx + dy * dy;

    if (distSq < r * r) {
      const dist = Math.sqrt(distSq);
      if (dist > 0.0001) {
        return {
          nx: dx / dist,
          ny: dy / dist,
          overlap: r - dist,
        };
      } else {
        return { nx: 1, ny: 0, overlap: r };
      }
    }

    return null;
  }

  function applyCombatantMovement(entity, map, dt) {
    const tConf = TANK_CONFIGS[entity.tank || (entity === state.player ? state.selectedTank : "medium")] || TANK_CONFIGS.medium;
    const r = tConf.radius || 22; // Combatant collision radius per tank type

    // Apply frame velocity displacement
    if (dt > 0) {
      entity.x += entity.vx * dt;
      entity.y += entity.vy * dt;
    }

    if (!map) return;

    // Outer arena boundaries (accounting for 40px outer perimeter wall + radius)
    const minX = 40 + r;
    const maxX = (map.width || 2200) - 40 - r;
    const minY = 40 + r;
    const maxY = (map.height || 2200) - 40 - r;

    // Multi-pass relaxation loop (3 iterations cleanly resolves complex corners and pinch points)
    if (map.obstacles && map.obstacles.length > 0) {
      for (let iter = 0; iter < 3; iter++) {
        let anyResolved = false;

        for (let i = 0; i < map.obstacles.length; i++) {
          const obs = map.obstacles[i];

          // Fast AABB bounding box pre-rejection
          if (
            entity.x + r <= obs.x ||
            entity.x - r >= obs.x + obs.w ||
            entity.y + r <= obs.y ||
            entity.y - r >= obs.y + obs.h
          ) {
            continue;
          }

          const col = resolveCircleRectCollision(entity.x, entity.y, r, obs);
          if (col) {
            anyResolved = true;
            // Push circle out along minimum penetration normal
            entity.x += col.nx * col.overlap;
            entity.y += col.ny * col.overlap;

            // Nullify velocity component directed into the obstacle surface (smooth sliding!)
            const dot = entity.vx * col.nx + entity.vy * col.ny;
            if (dot < 0) {
              entity.vx -= dot * col.nx;
              entity.vy -= dot * col.ny;
            }
          }
        }

        // Clamp inside outer map perimeter
        if (entity.x < minX) {
          entity.x = minX;
          if (entity.vx < 0) entity.vx = 0;
          anyResolved = true;
        } else if (entity.x > maxX) {
          entity.x = maxX;
          if (entity.vx > 0) entity.vx = 0;
          anyResolved = true;
        }

        if (entity.y < minY) {
          entity.y = minY;
          if (entity.vy < 0) entity.vy = 0;
          anyResolved = true;
        } else if (entity.y > maxY) {
          entity.y = maxY;
          if (entity.vy > 0) entity.vy = 0;
          anyResolved = true;
        }

        if (!anyResolved) break;
      }
    } else {
      // Direct boundary clamp if no obstacles
      entity.x = Math.max(minX, Math.min(maxX, entity.x));
      entity.y = Math.max(minY, Math.min(maxY, entity.y));
    }
  }

  function circleCollidesRect(cx, cy, cr, rect) {
    const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
    const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) < (cr * cr);
  }

  function lineIntersectsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
    const midX = (x1 + x2) * 0.5;
    const midY = (y1 + y2) * 0.5;
    if (midX >= rx && midX <= rx + rw && midY >= ry && midY <= ry + rh) return true;
    if (lineIntersectsSegment(x1, y1, x2, y2, rx, ry, rx + rw, ry)) return true;
    if (lineIntersectsSegment(x1, y1, x2, y2, rx + rw, ry, rx + rw, ry + rh)) return true;
    if (lineIntersectsSegment(x1, y1, x2, y2, rx + rw, ry + rh, rx, ry + rh)) return true;
    if (lineIntersectsSegment(x1, y1, x2, y2, rx, ry + rh, rx, ry)) return true;
    return false;
  }

  function lineIntersectsSegment(x1, y1, x2, y2, x3, y3, x4, y4) {
    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(den) < 0.0001) return false;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  function isLineBlockedByObstacles(x1, y1, x2, y2, obstacles) {
    if (!obstacles || obstacles.length === 0) return false;
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      // Fast AABB pre-check
      if (obs.x + obs.w < minX || obs.x > maxX || obs.y + obs.h < minY || obs.y > maxY) {
        continue;
      }
      if (lineIntersectsRect(x1, y1, x2, y2, obs.x, obs.y, obs.w, obs.h)) {
        return true;
      }
    }
    return false;
  }

  // =========================================================================
  // COMBAT & DAMAGE REGISTRATION
  // =========================================================================

  function damageCombatant(victim, damage, killer, weaponId) {
    if (victim.isDead || (victim.lastKilledAt && Date.now() - victim.lastKilledAt < 3000)) return;

    // Resolve killer if missing
    let actualKiller = killer;
    if (!actualKiller && victim !== state.player) {
      actualKiller = state.player;
    }

    // Friendly fire disabled in TDM mode
    if (state.mode === "tdm" && actualKiller && victim) {
      const killerTeam = actualKiller.team || (actualKiller === state.player ? (state.player.team || state.playerTeam) : null);
      const victimTeam = victim.team || (victim === state.player ? (state.player.team || state.playerTeam) : null);
      if (killerTeam && victimTeam && killerTeam === victimTeam) {
        return; // Teammates cannot harm each other
      }
    }

    // Apply damage directly to health (no shield)
    victim.health = Math.max(0, victim.health - damage);
    addDamageSparks(victim.x, victim.y, victim.color);

    if (victim === state.player) {
      state.camera.shake = Math.min(18, state.camera.shake + 6);
      playTone(160, 0.1, "sawtooth", 0.35);
      showDamageFeedback();
    } else if (actualKiller === state.player) {
      playHitConfirmation();
    }

    // Check Death
    if (victim.health <= 0) {
      victim.isDead = true;
      victim.lastKilledAt = Date.now();
      victim.deaths = (victim.deaths || 0) + 1;
      victim.streak = 0;
      victim.respawnTimer = 2.5;

      addDeathExplosion(victim.x, victim.y, victim.color);

      if (actualKiller) {
        actualKiller.kills = (actualKiller.kills || 0) + 1;
        actualKiller.score = (actualKiller.score || 0) + 100;
        actualKiller.streak = (actualKiller.streak || 0) + 1;
        if (actualKiller.streak > (actualKiller.highestStreak || 0)) {
          actualKiller.highestStreak = actualKiller.streak;
        }

        if (actualKiller === state.player) {
          playKillFanfare();
          state.camera.shake = 10;
          if (actualKiller.streak >= 3) {
            triggerStreakBanner(actualKiller.streak);
          }
        }
      }

      const killerName = actualKiller ? (actualKiller.name || (actualKiller === state.player ? (state.playerName || "Soldat") : "Soldat")) : "Omgivelse";
      const killerColor = actualKiller ? (actualKiller.color || (actualKiller === state.player ? (state.playerColor || "#ffd166") : "#ffd166")) : "#94a3b8";
      const killerId = actualKiller ? (actualKiller === state.player ? (state.playerId || "player_local") : actualKiller.id) : (state.playerId || "env");

      const killEventId = `kf_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      state.seenKillFeedIds.add(killEventId);

      // Add to kill feed
      addKillFeedItem({
        id: killEventId,
        killerId: killerId,
        killerName: killerName,
        killerColor: killerColor,
        victimName: victim.name || "Motstander",
        victimColor: victim.color || "#ef4444",
        weapon: weaponId || "cannon",
        timestamp: Date.now(),
      });

      const victimId = (victim === state.player) ? (state.playerId || "player_local") : (victim.id || "victim_unknown");

      // Report event to server if online match and we are involved (attacker OR victim!)
      if (!state.isSolo && (actualKiller === state.player || victim === state.player)) {
        state.recentEvents.push({
          type: "kill",
          clientKillId: killEventId,
          killerId: killerId,
          victimId: victimId,
          weapon: weaponId || "cannon",
        });
      }

      checkMatchVictory();
    } else {
      // Victim took damage but survived - report hit to server
      const victimId = (victim === state.player) ? (state.playerId || "player_local") : (victim.id || "victim_unknown");
      if (!state.isSolo && (actualKiller === state.player || victim === state.player)) {
        const attackerId = actualKiller === state.player ? (state.playerId || "player_local") : (actualKiller ? actualKiller.id : state.playerId);
        state.recentEvents.push({
          type: "hit",
          attackerId: attackerId,
          targetId: victimId,
          damage: damage,
          weapon: weaponId || "cannon",
        });
      }
    }

    updateVitalsHUD();
  }

  function addDamageSparks(x, y, color) {
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 140;
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3.5,
        color: color || "#fde047",
        life: 0.25,
        maxLife: 0.25,
      });
    }
  }

  function addDeathExplosion(x, y, color) {
    playExplosionSound();
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 260;
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 4,
        color: i % 2 === 0 ? color : "#ef4444",
        life: 0.65,
        maxLife: 0.65,
      });
    }
  }

  function addRocketBlast(x, y) {
    playExplosionSound();
    state.camera.shake = Math.min(22, state.camera.shake + 12);
    for (let i = 0; i < 32; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 140 + Math.random() * 320;
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 6 + Math.random() * 5,
        color: i % 3 === 0 ? "#f97316" : (i % 3 === 1 ? "#fbbf24" : "#ef4444"),
        life: 0.75,
        maxLife: 0.75,
      });
    }
  }

  function addMuzzleParticles(x, y, angle, color) {
    for (let i = 0; i < 4; i++) {
      const spd = 60 + Math.random() * 120;
      const spread = (Math.random() - 0.5) * 0.4;
      state.particles.push({
        x, y,
        vx: Math.cos(angle + spread) * spd,
        vy: Math.sin(angle + spread) * spd,
        size: 3,
        color: color || "#fde047",
        life: 0.12,
        maxLife: 0.12,
      });
    }
  }

  function triggerStreakBanner(streak) {
    if (!el.hudStreakBanner) return;
    el.hudStreakCount.textContent = `${streak}x`;
    el.hudStreakBanner.classList.remove("hidden");
    setTimeout(() => {
      if (el.hudStreakBanner) el.hudStreakBanner.classList.add("hidden");
    }, 2800);
  }

  function showDamageFeedback() {
    if (!el.lowHealthVignette) return;
    el.lowHealthVignette.classList.remove("hidden");
    setTimeout(() => {
      if (state.player.health >= 35 && el.lowHealthVignette) {
        el.lowHealthVignette.classList.add("hidden");
      }
    }, 450);
  }

  function checkMatchVictory() {
    if (state.roomStatus !== "playing") return;

    const allCombatants = [state.player, ...Object.values(state.opponents)];

    if (state.mode === "tdm") {
      const redKills = allCombatants.filter(c => (c.team || (c === state.player ? (state.player.team || state.playerTeam) : null)) === "red").reduce((acc, c) => acc + (c.kills || 0), 0);
      const blueKills = allCombatants.filter(c => (c.team || (c === state.player ? (state.player.team || state.playerTeam) : null)) === "blue").reduce((acc, c) => acc + (c.kills || 0), 0);

      if (redKills >= state.scoreLimit || blueKills >= state.scoreLimit) {
        const winningTeam = redKills >= state.scoreLimit ? "red" : "blue";
        endMatchTeam(winningTeam, redKills, blueKills);
      }
      return;
    }

    const topCombatant = allCombatants.slice().sort((a, b) => (b.kills || 0) - (a.kills || 0))[0];

    if (topCombatant && topCombatant.kills >= state.scoreLimit) {
      endMatch(topCombatant);
    }
  }

  function endMatchTeam(winningTeam, redKills, blueKills) {
    state.roomStatus = "finished";
    playTone(523, 0.25, "triangle", 0.4);
    setTimeout(() => playTone(659, 0.35, "triangle", 0.45), 250);
    setTimeout(() => playTone(784, 0.5, "triangle", 0.5), 500);

    showTeamVictoryPodium(winningTeam, redKills, blueKills);
  }

  function showTeamVictoryPodium(winningTeam, redKills, blueKills) {
    if (!el.modalPodium) return;

    const myTeam = state.player.team || state.playerTeam || "red";
    const iWon = winningTeam === myTeam;
    const teamName = winningTeam === "red" ? "LAG RØD" : "LAG BLÅ";

    if (el.podiumTitle) {
      el.podiumTitle.textContent = iWon ? "DITT LAG VANT!" : `${teamName} VANT!`;
    }
    if (el.podiumDesc) {
      el.podiumDesc.textContent = `Sluttstilling: Rød ${redKills} - ${blueKills} Blå (Mål: ${state.scoreLimit} drap).`;
    }

    if (el.podiumStandings) {
      el.podiumStandings.innerHTML = "";
      const all = [state.player, ...Object.values(state.opponents)];
      all.sort((a, b) => (b.kills || 0) - (a.kills || 0) || (a.deaths || 0) - (b.deaths || 0));

      all.forEach((c, idx) => {
        const row = document.createElement("div");
        row.className = "podium-row" + (c === state.player ? " is-me" : "");
        const cTeam = c.team || (c === state.player ? (state.player.team || state.playerTeam) : "red");
        const teamTag = cTeam === "blue" ? '<span style="color:#38bdf8">[BLÅ]</span> ' : '<span style="color:#f43f5e">[RØD]</span> ';
        row.innerHTML = `
          <div class="pr-pos">${idx + 1}.</div>
          <div class="pr-color" style="background:${cTeam === 'blue' ? '#38bdf8' : '#f43f5e'}"></div>
          <div class="pr-name">${teamTag}${escapeHtml(c.name)} ${c === state.player ? ' (Deg)' : ''}</div>
          <div class="pr-stats"><strong>${c.kills || 0}</strong> drap • ${c.deaths || 0} dødsfall</div>
        `;
        el.podiumStandings.appendChild(row);
      });
    }

    el.modalPodium.classList.remove("hidden");
  }

  function endMatch(winner) {
    state.roomStatus = "finished";
    playTone(523, 0.25, "triangle", 0.4);
    setTimeout(() => playTone(659, 0.35, "triangle", 0.45), 250);
    setTimeout(() => playTone(784, 0.5, "triangle", 0.5), 500);

    showVictoryPodium(winner);
  }

  function showVictoryPodium(winner) {
    if (!el.modalPodium) return;

    const isMe = winner && winner.id === (state.playerId || "player_local");
    if (el.podiumTitle) {
      el.podiumTitle.textContent = isMe ? "DU VANT KAMPEN!" : `${winner ? winner.name : 'Vinner'} VANT!`;
    }
    if (el.podiumDesc) {
      el.podiumDesc.textContent = isMe
        ? `Gratulerer! Du dominerte Kuleregn med ${winner.kills} drap.`
        : `${winner ? winner.name : 'Motstanderen'} nådde målet først med ${winner ? winner.kills : 0} drap.`;
    }

    if (el.podiumStandings) {
      el.podiumStandings.innerHTML = "";
      const all = [state.player, ...Object.values(state.opponents)];
      all.sort((a, b) => (b.kills || 0) - (a.kills || 0) || (a.deaths || 0) - (b.deaths || 0));

      all.forEach((c, idx) => {
        const row = document.createElement("div");
        row.className = "podium-row" + (c === state.player ? " is-me" : "");
        row.innerHTML = `
          <div class="pr-pos">${idx + 1}.</div>
          <div class="pr-color" style="background:${c.color || '#ffd166'}"></div>
          <div class="pr-name">${escapeHtml(c.name)} ${c === state.player ? ' (Deg)' : ''}</div>
          <div class="pr-stats"><strong>${c.kills || 0}</strong> drap • ${c.deaths || 0} dødsfall</div>
        `;
        el.podiumStandings.appendChild(row);
      });
    }

    el.modalPodium.classList.remove("hidden");
  }

  function addKillFeedItem(item) {
    const wIcon = WEAPONS[item.weapon] ? (WEAPONS[item.weapon].icon || "▸") : "▸";
    const ts = item.timestamp || (item.time ? item.time * 1000 : Date.now());
    const feedItem = {
      ...item,
      icon: wIcon,
      timestamp: ts,
    };
    state.killFeed.unshift(feedItem);
    if (state.killFeed.length > 6) state.killFeed.pop();

    if (el.killFeedContainer) {
      const div = document.createElement("div");
      div.className = "kill-feed-item";
      if (item.id) div.dataset.id = item.id;
      div.innerHTML = `
        <span class="kf-killer" style="color:${escapeHtml(item.killerColor || '#ffd166')}">${escapeHtml(item.killerName || 'Soldat')}</span>
        <span class="kf-weapon">${escapeHtml(wIcon)}</span>
        <span class="kf-victim" style="color:${escapeHtml(item.victimColor || '#ef4444')}">${escapeHtml(item.victimName || 'Motstander')}</span>
      `;

      // Prepend so newest kill slides in at the top without rebuilding existing elements
      el.killFeedContainer.prepend(div);

      // Cap at 5 messages on screen
      while (el.killFeedContainer.children.length > 5) {
        el.killFeedContainer.lastElementChild.remove();
      }

      // Automatically fade out and remove after 4.5 seconds
      setTimeout(() => {
        div.classList.add("kf-fading");
        setTimeout(() => {
          if (div.parentNode) div.remove();
        }, 400);
      }, 4500);
    }
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= dt;
      if (p.life <= 0) {
        state.particles.splice(i, 1);
      }
    }
  }

  // =========================================================================
  // INPUT HANDLING (WASD DRIVING + ARROWS TURRET + SPACE / CLICK SHOOTING)
  // =========================================================================

  function initInputHandlers() {
    const canvas = el.combatCanvas;

    window.addEventListener("keydown", (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      const k = e.key.toLowerCase();

      // WASD for Tank Driving
      if (k === "w") state.keys.w = true;
      if (k === "a") state.keys.a = true;
      if (k === "s") state.keys.s = true;
      if (k === "d") state.keys.d = true;

      // Left and Right Arrow Keys to pan the turret (or cycle vehicle turntable in waiting room)
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (state.view === "waiting") {
          cycleTank(-1);
        } else {
          state.keys.arrowLeft = true;
        }
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (state.view === "waiting") {
          cycleTank(1);
        } else {
          state.keys.arrowRight = true;
        }
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        state.keys.arrowUp = true;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
      }

      // Space / Enter to Shoot
      if (k === " " || e.key === " " || k === "enter") {
        e.preventDefault();
        state.keys.shoot = true;
        if (state.roomStatus === "playing") {
          firePlayerWeapon();
        }
      }

      if (e.key === "Tab") {
        e.preventDefault();
        if (el.scoreboardModal) el.scoreboardModal.classList.remove("hidden");
        updateScoreboardTable();
      }
    });

    window.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      // WASD for Movement
      if (k === "w") state.keys.w = false;
      if (k === "a") state.keys.a = false;
      if (k === "s") state.keys.s = false;
      if (k === "d") state.keys.d = false;

      // Arrow Keys for Turret Aiming
      if (e.key === "ArrowLeft") state.keys.arrowLeft = false;
      if (e.key === "ArrowRight") state.keys.arrowRight = false;
      if (e.key === "ArrowUp") state.keys.arrowUp = false;
      if (e.key === "ArrowDown") state.keys.arrowDown = false;

      // Space to Shoot
      if (k === " " || e.key === " " || k === "enter") state.keys.shoot = false;

      if (e.key === "Tab") {
        if (el.scoreboardModal) el.scoreboardModal.classList.add("hidden");
      }
    });

    window.addEventListener("mousedown", (e) => {
      if (state.view !== "game") return;
      if (e.button === 0) {
        state.mouse.down = true;
        if (state.roomStatus === "playing") {
          firePlayerWeapon();
        }
      }
    });

    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) {
        state.mouse.down = false;
      }
    });

    window.addEventListener("blur", () => {
      state.mouse.down = false;
      state.keys = { w: false, a: false, s: false, d: false, arrowLeft: false, arrowRight: false, arrowUp: false, shoot: false };
    });

    // Touch Support: Tap canvas to shoot
    if (canvas) {
      canvas.addEventListener("touchstart", () => {
        state.mouse.down = true;
        if (state.roomStatus === "playing") {
          firePlayerWeapon();
        }
      }, { passive: true });
      canvas.addEventListener("touchend", () => {
        state.mouse.down = false;
      });
    }
  }

  function showStartWeaponOverlay() {}
  function hideStartWeaponOverlay() {}

  function selectPlayerWeapon(weaponId, notify = false) {
    state.selectedWeapon = "cannon";
    state.player.weapon = "cannon";
    state.player.ammo = Infinity;
    updateWeaponHUD();
  }

  function renderStartWeaponGrid() {}

  function addCarDriftEffects(p) {
    const cosH = Math.cos(p.hullAngle);
    const sinH = Math.sin(p.hullAngle);
    const rearX = p.x - cosH * 16;
    const rearY = p.y - sinH * 16;
    const rightX = -sinH;
    const rightY = cosH;

    const w1x = rearX - rightX * 12;
    const w1y = rearY - rightY * 12;
    const w2x = rearX + rightX * 12;
    const w2y = rearY + rightY * 12;

    if (!p.lastWheelPos) {
      p.lastWheelPos = { w1x, w1y, w2x, w2y };
    } else {
      const d1 = Math.hypot(w1x - p.lastWheelPos.w1x, w1y - p.lastWheelPos.w1y);
      if (d1 > 4) {
        if (!state.skidmarks) state.skidmarks = [];
        state.skidmarks.push({
          x1: p.lastWheelPos.w1x, y1: p.lastWheelPos.w1y,
          x2: w1x, y2: w1y,
          alpha: 0.42,
          width: 3.5,
        });
        state.skidmarks.push({
          x1: p.lastWheelPos.w2x, y1: p.lastWheelPos.w2y,
          x2: w2x, y2: w2y,
          alpha: 0.42,
          width: 3.5,
        });
        if (state.skidmarks.length > 300) {
          state.skidmarks.splice(0, state.skidmarks.length - 300);
        }
        p.lastWheelPos = { w1x, w1y, w2x, w2y };
      }
    }

    if (Math.random() < 0.45) {
      const sx = Math.random() < 0.5 ? w1x : w2x;
      const sy = Math.random() < 0.5 ? w1y : w2y;
      state.particles.push({
        x: sx + (Math.random() - 0.5) * 4,
        y: sy + (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        size: 5 + Math.random() * 4,
        color: "rgba(235, 235, 240, 0.45)",
        life: 0.35 + Math.random() * 0.2,
        maxLife: 0.55,
      });
    }

    if (Math.random() < 0.08) {
      playTone(520, 0.04, "sawtooth", 0.08);
    }
  }

  function firePlayerWeapon() {
    const p = state.player;
    if (p.isDead || p.fireTimer > 0) return;
    const tConf = TANK_CONFIGS[p.tank || state.selectedTank] || TANK_CONFIGS.medium;
    const w = tConf.weapon;

    // Tactical loadout weapons have unlimited combat ammo
    p.ammo = Infinity;
    p.fireTimer = w.fireRate;

    const myId = state.playerId || p.id || "player_local";
    p.id = myId;
    p.name = state.playerName || p.name || "Soldat";
    if (state.mode === "tdm") {
      p.team = state.playerTeam || p.team || "red";
      p.color = p.team === "blue" ? "#38bdf8" : "#f43f5e";
    } else {
      p.color = state.playerColor || p.color || "#ffd166";
    }

    const barrelDist = 28.5;
    const barrelX = p.x + Math.cos(p.angle) * barrelDist;
    const barrelY = p.y + Math.sin(p.angle) * barrelDist;

    const spreadAngle = (Math.random() - 0.5) * (w.spread || 0.005);
    const bAngle = p.angle + spreadAngle;
    state.bullets.push({
      id: `p_b_${Date.now()}_${Math.random()}`,
      ownerId: myId,
      ownerName: p.name,
      ownerColor: p.color,
      weapon: p.tank || "cannon",
      x: barrelX,
      y: barrelY,
      vx: Math.cos(bAngle) * w.bulletSpeed,
      vy: Math.sin(bAngle) * w.bulletSpeed,
      damage: w.damage,
      life: (w.bulletRange || 1300) / w.bulletSpeed,
      maxLife: (w.bulletRange || 1300) / w.bulletSpeed,
      color: state.mode === "tdm" ? p.color : (w.color || p.color),
      isRocket: false,
    });

    if (!state.isSolo) {
      state.recentShots.push({
        id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        x: barrelX,
        y: barrelY,
        angle: p.angle,
        weapon: p.tank || "cannon",
      });
    }

    addMuzzleParticles(barrelX, barrelY, p.angle, w.color);

    if (tConf.isOneShot || tConf.id === "heavy") {
      // Colossal recoil knockback for heavy one-shot haubitser
      p.vx -= Math.cos(p.angle) * 240;
      p.vy -= Math.sin(p.angle) * 240;
      state.camera.shake = Math.min(26, state.camera.shake + 18);
      // Large fiery muzzle blast particles
      for (let i = 0; i < 16; i++) {
        const spd = 60 + Math.random() * 150;
        const pa = p.angle + (Math.random() - 0.5) * 0.9;
        state.particles.push({
          x: barrelX,
          y: barrelY,
          vx: Math.cos(pa) * spd,
          vy: Math.sin(pa) * spd,
          size: 7 + Math.random() * 6,
          color: Math.random() < 0.4 ? "#f97316" : (Math.random() < 0.7 ? "#ef4444" : "#fbbf24"),
          life: 0.45 + Math.random() * 0.25,
          maxLife: 0.7,
        });
      }
      playTone(72, 0.35, "sawtooth", 0.7);
    } else {
      playTone(tConf.id === "light" ? 360 : 220, 0.12, "square", 0.4);
      state.camera.shake = Math.min(14, state.camera.shake + (tConf.id === "light" ? 2 : 4));
    }

    updateWeaponHUD();
  }

  function updateOpponents(dt, map) {
    for (const opp of Object.values(state.opponents)) {
      if (opp.isDead) {
        if (opp.respawnTimer > 0) {
          opp.respawnTimer = Math.max(0, opp.respawnTimer - dt);
          if (state.isSolo && opp.respawnTimer <= 0) {
            spawnPlayer(opp, map);
          }
        }
        continue;
      }

      // 1. Dead reckoning: project target position forward using opponent velocity
      if (opp.vx !== undefined && opp.vy !== undefined) {
        opp.targetX = (opp.targetX !== undefined ? opp.targetX : opp.x) + opp.vx * dt;
        opp.targetY = (opp.targetY !== undefined ? opp.targetY : opp.y) + opp.vy * dt;
      }

      // 2. Continuous position lerp (buttery smooth 60 FPS glide)
      if (opp.targetX !== undefined && opp.targetY !== undefined) {
        const dx = opp.targetX - opp.x;
        const dy = opp.targetY - opp.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 250) {
          // Snap on huge jump (spawn / teleport)
          opp.x = opp.targetX;
          opp.y = opp.targetY;
        } else if (dist > 0.05) {
          const t = Math.min(1.0, 16 * dt);
          opp.x += dx * t;
          opp.y += dy * t;
        }
      }

      // 3. Shortest-arc turret angle lerp
      if (opp.targetAngle !== undefined) {
        let diff = opp.targetAngle - opp.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        const rotT = Math.min(1.0, 20 * dt);
        opp.angle += diff * rotT;
        while (opp.angle > Math.PI) opp.angle -= Math.PI * 2;
        while (opp.angle < -Math.PI) opp.angle += Math.PI * 2;
      }

      // 4. Shortest-arc hull / vehicle chassis angle lerp (tracked across screens!)
      if (opp.targetHullAngle !== undefined) {
        let hDiff = opp.targetHullAngle - (opp.hullAngle !== undefined ? opp.hullAngle : opp.angle);
        while (hDiff < -Math.PI) hDiff += Math.PI * 2;
        while (hDiff > Math.PI) hDiff -= Math.PI * 2;
        const hullT = Math.min(1.0, 20 * dt);
        opp.hullAngle = (opp.hullAngle !== undefined ? opp.hullAngle : opp.angle) + hDiff * hullT;
        while (opp.hullAngle > Math.PI) opp.hullAngle -= Math.PI * 2;
        while (opp.hullAngle < -Math.PI) opp.hullAngle += Math.PI * 2;
      }
    }
  }

  // =========================================================================
  // MAIN GAME LOOP (60 FPS)
  // =========================================================================

  function gameLoop(timestamp) {
    if (!state.lastTime) state.lastTime = timestamp;
    const dt = Math.min(0.08, (timestamp - state.lastTime) / 1000.0);
    state.lastTime = timestamp;

    try {
      const map = state.currentMap;

      // 1. Update Match Clock
      if (state.roomStatus === "playing") {
        state.timeRemaining = Math.max(0, state.timeRemaining - dt);
        const mins = Math.floor(state.timeRemaining / 60);
        const secs = Math.floor(state.timeRemaining % 60);
        const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        if (el.hudMatchTime) el.hudMatchTime.textContent = timeStr;
        if (el.headClock) el.headClock.textContent = timeStr;

        if (state.timeRemaining <= 0) {
          checkMatchVictory();
        }
      }

      // 2. Update Local Player Physics & Aiming
      updatePlayer(dt, map);

      // 2b. Smooth 60 FPS Opponent Interpolation & Chassis Rotation Tracking
      updateOpponents(dt, map);

      // 3. Update Projectiles & Bullets
      const allCombatants = [state.player, ...Object.values(state.opponents)];
      updateBullets(dt, map, allCombatants);

      // 4. Update Pickups & Explosive Barrels
      updatePickups(dt, map, allCombatants);

      // 5. Update Particles & Screen Shake
      updateParticles(dt);
      if (state.camera.shake > 0) {
        state.camera.shake = Math.max(0, state.camera.shake - dt * 25);
      }

      // 5b. Update Skidmarks Fading
      if (state.skidmarks && state.skidmarks.length > 0) {
        for (let i = state.skidmarks.length - 1; i >= 0; i--) {
          state.skidmarks[i].alpha -= dt * 0.035;
          if (state.skidmarks[i].alpha <= 0.02) {
            state.skidmarks.splice(i, 1);
          }
        }
      }

      // 6. Render Game Canvas
      renderArena(map);

    } catch (err) {
      console.error("Kuleregn loop error:", err);
    }

    state.animFrameId = requestAnimationFrame(gameLoop);
  }

  function startSimulation() {
    if (!state.animFrameId) {
      state.lastTime = performance.now();
      state.animFrameId = requestAnimationFrame(gameLoop);
    }
  }

  function stopSimulation() {
    if (state.animFrameId) {
      cancelAnimationFrame(state.animFrameId);
      state.animFrameId = null;
    }
  }

  function updatePlayer(dt, map) {
    const p = state.player;

    if (p.isDead) {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0) {
        spawnPlayer(p, map);
        updateWeaponHUD();
        if (!state.isSolo) {
          state.recentEvents.push({ type: "respawn" });
        }
      }
      return;
    }

    if (p.fireTimer > 0) p.fireTimer = Math.max(0, p.fireTimer - dt);

    // 1. Vehicle Steering & Throttle with WASD
    const tConf = TANK_CONFIGS[p.tank || state.selectedTank] || TANK_CONFIGS.medium;
    const isDrivingForward = !!state.keys.w;
    const isDrivingReverse = !!state.keys.s;
    const isSteeringLeft = !!state.keys.a;
    const isSteeringRight = !!state.keys.d;
    const steerDir = (isSteeringRight ? 1 : 0) - (isSteeringLeft ? 1 : 0);

    // Classic Tracked Tank Physics (Light, Medium, Heavy)
    const hullTurnSpeed = tConf.hullTurnSpeed;
    if (steerDir !== 0) {
      const dAngle = steerDir * hullTurnSpeed * dt;
      p.hullAngle = (p.hullAngle || 0) + dAngle;
      while (p.hullAngle > Math.PI) p.hullAngle -= Math.PI * 2;
      while (p.hullAngle < -Math.PI) p.hullAngle += Math.PI * 2;

      // Turret turns along with the vehicle hull when steering
      p.angle = (p.angle !== undefined ? p.angle : p.hullAngle) + dAngle;
      while (p.angle > Math.PI) p.angle -= Math.PI * 2;
      while (p.angle < -Math.PI) p.angle += Math.PI * 2;
    }

    let forwardThrottle = 0;
    if (isDrivingForward) forwardThrottle += tConf.forwardSpeed;
    if (isDrivingReverse) forwardThrottle -= tConf.reverseSpeed;

    // Tracked tank direct propulsion with momentum decay
    const targetVx = Math.cos(p.hullAngle) * forwardThrottle;
    const targetVy = Math.sin(p.hullAngle) * forwardThrottle;
    p.vx += (targetVx - p.vx) * Math.min(1.0, dt * 10);
    p.vy += (targetVy - p.vy) * Math.min(1.0, dt * 10);

    // Apply movement & obstacle collisions
    applyCombatantMovement(p, map, dt);

    // 2. Turret Aiming with Arrow Keys (Pure Keyboard Aiming - No Mouse Aiming)
    const turretTurnSpeed = tConf.turretTurnSpeed;
    if (state.keys.arrowLeft || state.keys.arrowRight) {
      const panDir = (state.keys.arrowRight ? 1 : 0) - (state.keys.arrowLeft ? 1 : 0);
      p.angle = (p.angle !== undefined ? p.angle : p.hullAngle) + panDir * turretTurnSpeed * dt;
      while (p.angle > Math.PI) p.angle -= Math.PI * 2;
      while (p.angle < -Math.PI) p.angle += Math.PI * 2;
    } else if (state.keys.arrowUp) {
      // Re-align turret with the tank hull direction
      let diff = p.hullAngle - (p.angle !== undefined ? p.angle : p.hullAngle);
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      const snapSpeed = turretTurnSpeed * 3 * dt;
      if (Math.abs(diff) <= snapSpeed) {
        p.angle = p.hullAngle;
      } else {
        p.angle += Math.sign(diff) * snapSpeed;
      }
    } else if (p.angle === undefined) {
      p.angle = p.hullAngle;
    }

    // 3. Continuous weapon firing when holding mouse or space
    const isShooting = (state.mouse.down || state.keys.shoot) && state.roomStatus === "playing";
    if (isShooting) {
      if (p.fireTimer <= 0) {
        firePlayerWeapon();
      }
    }

    // 4. Camera smoothly tracks player and pans ahead along turret sightline (tight framing at 3x zoom)
    const lookahead = 60;
    const targetCamX = p.x + Math.cos(p.angle) * lookahead;
    const targetCamY = p.y + Math.sin(p.angle) * lookahead;
    state.camera.x += (targetCamX - state.camera.x) * 0.12;
    state.camera.y += (targetCamY - state.camera.y) * 0.12;
  }

  function updateBullets(dt, map, allCombatants) {
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.life -= dt;
      if (b.life <= 0) {
        if (b.isRocket) addRocketBlast(b.x, b.y);
        state.bullets.splice(i, 1);
        continue;
      }

      const prevX = b.x;
      const prevY = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Bullet trail smoke for rocket
      if (b.isRocket && Math.random() < 0.6) {
        state.particles.push({
          x: b.x, y: b.y,
          vx: -b.vx * 0.05 + (Math.random() - 0.5) * 20,
          vy: -b.vy * 0.05 + (Math.random() - 0.5) * 20,
          size: 4,
          color: "#94a3b8",
          life: 0.35,
          maxLife: 0.35,
        });
      }

      // 1. Collision with Arena Obstacles
      let hitWall = false;
      for (const obs of map.obstacles) {
        if (lineIntersectsRect(prevX, prevY, b.x, b.y, obs.x, obs.y, obs.w, obs.h)) {
          hitWall = true;
          break;
        }
      }

      if (hitWall) {
        if (b.isRocket) {
          addRocketBlast(b.x, b.y);
          damageRadius(b.x, b.y, 140, b.damage, b.ownerId, "rocket", allCombatants);
        } else {
          addDamageSparks(b.x, b.y, b.color);
          playTone(280, 0.04, "square", 0.08); // ricochet ping
        }
        state.bullets.splice(i, 1);
        continue;
      }

      // 3. Collision with Combatants
      let hitCombatant = false;
      const myId = state.playerId || state.player.id || "player_local";
      const killer = getCombatantById(b.ownerId);
      const killerTeam = killer ? (killer.team || (killer === state.player ? (state.player.team || state.playerTeam) : null)) : null;

      for (const c of allCombatants) {
        const cId = c.id || (c === state.player ? myId : null);
        if (cId === b.ownerId || c.isDead) continue;

        // Friendly bullets pass through teammates in TDM
        if (state.mode === "tdm") {
          const cTeam = c.team || (c === state.player ? (state.player.team || state.playerTeam) : null);
          if (killerTeam && cTeam && killerTeam === cTeam) {
            continue;
          }
        }

        const tConf = TANK_CONFIGS[c.tank || (c === state.player ? state.selectedTank : "medium")] || TANK_CONFIGS.medium;
        const hitRadius = tConf.radius || 22;
        if (Math.hypot(c.x - b.x, c.y - b.y) <= hitRadius) {
          hitCombatant = true;

          if (b.isRocket) {
            addRocketBlast(b.x, b.y);
            damageRadius(b.x, b.y, 140, b.damage, b.ownerId, "rocket", allCombatants);
          } else {
            damageCombatant(c, b.damage, killer, b.weapon);
          }
          break;
        }
      }

      if (hitCombatant) {
        state.bullets.splice(i, 1);
      }
    }
  }

  function damageRadius(cx, cy, radius, maxDamage, attackerId, weaponId, allCombatants) {
    const attacker = getCombatantById(attackerId);
    const attackerTeam = attacker ? (attacker.team || (attacker === state.player ? (state.player.team || state.playerTeam) : null)) : null;
    for (const c of allCombatants) {
      if (c.isDead) continue;
      if (state.mode === "tdm") {
        const cTeam = c.team || (c === state.player ? (state.player.team || state.playerTeam) : null);
        if (attackerTeam && cTeam && attackerTeam === cTeam) {
          continue;
        }
      }
      const dist = Math.hypot(c.x - cx, c.y - cy);
      if (dist <= radius) {
        const falloff = 1 - (dist / radius);
        const dmg = Math.round(maxDamage * Math.max(0.3, falloff));
        // Knockback impulse
        const angle = Math.atan2(c.y - cy, c.x - cx);
        c.vx += Math.cos(angle) * falloff * 320;
        c.vy += Math.sin(angle) * falloff * 320;
        damageCombatant(c, dmg, attacker, weaponId);
      }
    }
  }

  function updatePickups(dt, map, allCombatants) {
    // Pickups disabled as requested
  }

  function showPickupToast(text) {
    if (!el.pickupToast) return;
    el.pickupToastText.textContent = text;
    el.pickupToast.classList.remove("hidden");
    setTimeout(() => {
      if (el.pickupToast) el.pickupToast.classList.add("hidden");
    }, 2200);
  }

  // =========================================================================
  // ARENA RENDERING & DYNAMIC TACTICAL FOV VISIBILITY
  // =========================================================================

  function normAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function getMapObstacleSegments(map) {
    if (map._segments && map._segmentsMapId === map.id) return map._segments;
    const list = [];
    for (let i = 0; i < map.obstacles.length; i++) {
      const obs = map.obstacles[i];
      list.push({
        x: obs.x, y: obs.y, w: obs.w, h: obs.h,
        segs: [
          { x1: obs.x, y1: obs.y, x2: obs.x + obs.w, y2: obs.y },
          { x1: obs.x + obs.w, y1: obs.y, x2: obs.x + obs.w, y2: obs.y + obs.h },
          { x1: obs.x + obs.w, y1: obs.y + obs.h, x2: obs.x, y2: obs.y + obs.h },
          { x1: obs.x, y1: obs.y + obs.h, x2: obs.x, y2: obs.y }
        ],
        corners: [
          { x: obs.x, y: obs.y },
          { x: obs.x + obs.w, y: obs.y },
          { x: obs.x + obs.w, y: obs.y + obs.h },
          { x: obs.x, y: obs.y + obs.h }
        ]
      });
    }
    map._segments = list;
    map._segmentsMapId = map.id;
    return list;
  }

  function computeVisibilityPolygon(px, py, pAngle, map) {
    const fovHalf = FOV_HALF_ANGLE;
    const maxR = FOV_MAX_DIST;
    const minR = FOV_CLOSE_RADIUS;
    const angles = [];
    const nearbySegs = [];
    const obsList = getMapObstacleSegments(map);

    for (let i = 0; i < obsList.length; i++) {
      const o = obsList[i];
      if (px < o.x - maxR || px > o.x + o.w + maxR ||
          py < o.y - maxR || py > o.y + o.h + maxR) continue;

      for (let s = 0; s < 4; s++) nearbySegs.push(o.segs[s]);

      for (let c = 0; c < 4; c++) {
        const corner = o.corners[c];
        const dist = Math.hypot(corner.x - px, corner.y - py);
        if (dist > maxR) continue;
        const ang = Math.atan2(corner.y - py, corner.x - px);
        angles.push(normAngle(ang - 0.0002));
        angles.push(ang);
        angles.push(normAngle(ang + 0.0002));
      }
    }

    // 360 circle samples every 3 degrees (120 samples) for smooth circular vision boundary
    for (let deg = -180; deg <= 180; deg += 3) {
      angles.push((deg * Math.PI) / 180);
    }
    // FOV cone boundary rays
    angles.push(normAngle(pAngle - fovHalf - 0.0002));
    angles.push(normAngle(pAngle - fovHalf + 0.0002));
    angles.push(normAngle(pAngle + fovHalf - 0.0002));
    angles.push(normAngle(pAngle + fovHalf + 0.0002));

    angles.sort((a, b) => a - b);

    const points = [];
    for (let i = 0; i < angles.length; i++) {
      const a = angles[i];
      const diff = Math.abs(normAngle(a - pAngle));
      const rLimit = diff <= fovHalf ? maxR : minR;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      let minT = rLimit;

      for (let s = 0; s < nearbySegs.length; s++) {
        const seg = nearbySegs[s];
        const vx = seg.x2 - seg.x1;
        const vy = seg.y2 - seg.y1;
        const det = dx * vy - dy * vx;
        if (Math.abs(det) < 0.000001) continue;
        const qx = px - seg.x1;
        const qy = py - seg.y1;
        const u = (dx * qy - dy * qx) / det;
        if (u < 0 || u > 1) continue;
        const t = (vx * qy - vy * qx) / det;
        if (t > 0.001 && t < minT) minT = t;
      }

      points.push({ x: px + dx * minT, y: py + dy * minT });
    }
    return points;
  }

  function renderArena(map) {
    const canvas = el.combatCanvas;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;
    const ctx = canvas.getContext("2d");
    const cw = canvas.width;
    const ch = canvas.height;

    ctx.clearRect(0, 0, cw, ch);

    // Apply Camera translation and screen shake
    ctx.save();
    const shakeX = (Math.random() - 0.5) * state.camera.shake;
    const shakeY = (Math.random() - 0.5) * state.camera.shake;

    ctx.translate(cw / 2 + shakeX, ch / 2 + shakeY);
    ctx.scale(state.camera.zoom, state.camera.zoom);
    ctx.translate(-state.camera.x, -state.camera.y);

    // 1. Arena Floor
    ctx.fillStyle = map.bgColor;
    ctx.fillRect(0, 0, map.width, map.height);

    ctx.fillStyle = map.floorColor;
    ctx.fillRect(40, 40, map.width - 80, map.height - 80);

    // Desert Specific Ground Details (Rust Scrapyard)
    if (map.isDesert) {
      // Concrete foundation pads under containers
      for (const obs of map.obstacles) {
        if (obs.type === "container" || obs.type === "tower_pillar") {
          ctx.fillStyle = "#5c4a39";
          ctx.fillRect(obs.x - 8, obs.y - 8, obs.w + 16, obs.h + 16);
          ctx.strokeStyle = "#4a3c2e";
          ctx.lineWidth = 2;
          ctx.strokeRect(obs.x - 8, obs.y - 8, obs.w + 16, obs.h + 16);
        }
      }

      // Center Rig Concrete Foundation with Hazard Markings
      ctx.fillStyle = "#483829";
      ctx.fillRect(940, 940, 320, 320);
      ctx.strokeStyle = "#382c20";
      ctx.lineWidth = 3;
      ctx.strokeRect(940, 940, 320, 320);

      // Hazard Caution Stripes on Rig Border
      ctx.save();
      ctx.strokeStyle = "#eab308";
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 12]);
      ctx.strokeRect(944, 944, 312, 312);
      ctx.restore();

      // Tire Tracks across desert lanes
      ctx.save();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.09)";
      ctx.lineWidth = 5;
      ctx.setLineDash([14, 10]);
      // West-East central corridor tracks
      ctx.beginPath();
      ctx.moveTo(100, 1100);
      ctx.lineTo(map.width - 100, 1100);
      ctx.moveTo(100, 1115);
      ctx.lineTo(map.width - 100, 1115);
      // North-South tracks
      ctx.moveTo(1100, 100);
      ctx.lineTo(1100, map.height - 100);
      ctx.moveTo(1115, 100);
      ctx.lineTo(1115, map.height - 100);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Floor Grid Markings
    ctx.strokeStyle = map.gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const step = 80;
    for (let x = 40; x <= map.width - 40; x += step) {
      ctx.moveTo(x, 40);
      ctx.lineTo(x, map.height - 40);
    }
    for (let y = 40; y <= map.height - 40; y += step) {
      ctx.moveTo(40, y);
      ctx.lineTo(map.width - 40, y);
    }
    ctx.stroke();

    // 3. Tire Skidmarks on Arena Floor
    if (state.skidmarks && state.skidmarks.length > 0) {
      ctx.save();
      ctx.lineCap = "round";
      for (let i = 0; i < state.skidmarks.length; i++) {
        const sm = state.skidmarks[i];
        ctx.strokeStyle = `rgba(18, 18, 24, ${sm.alpha})`;
        ctx.lineWidth = sm.width || 3.5;
        ctx.beginPath();
        ctx.moveTo(sm.x1, sm.y1);
        ctx.lineTo(sm.x2, sm.y2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 6. Render Map Obstacles (Shipping Containers, Pillars, Pipes, Sandbags, Concrete, Crates)
    for (const obs of map.obstacles) {
      ctx.save();
      if (obs.type === "container") {
        // Shipping Cargo Container
        const colMap = {
          blue: { body: "#1e40af", rib: "#2563eb", border: "#172554" },
          rust: { body: "#9a3412", rib: "#c2410c", border: "#431407" },
          green: { body: "#365314", rib: "#4d7c0f", border: "#142004" },
          dark: { body: "#1e293b", rib: "#334155", border: "#090d16" },
        };
        const cTheme = colMap[obs.color] || colMap.dark;

        ctx.fillStyle = cTheme.body;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

        // Corrugated metal ribs
        ctx.strokeStyle = cTheme.rib;
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (obs.w > obs.h) {
          // Horizontal container -> vertical ribs
          for (let rx = obs.x + 12; rx < obs.x + obs.w - 8; rx += 12) {
            ctx.moveTo(rx, obs.y + 4);
            ctx.lineTo(rx, obs.y + obs.h - 4);
          }
        } else {
          // Vertical container -> horizontal ribs
          for (let ry = obs.y + 12; ry < obs.y + obs.h - 8; ry += 12) {
            ctx.moveTo(obs.x + 4, ry);
            ctx.lineTo(obs.x + obs.w - 4, ry);
          }
        }
        ctx.stroke();

        // Heavy border and corner castings
        ctx.strokeStyle = cTheme.border;
        ctx.lineWidth = 3;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);

        // Stencil Label
        if (obs.label) {
          ctx.save();
          ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
          ctx.font = "900 9px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(obs.label, obs.x + obs.w / 2, obs.y + obs.h / 2);
          ctx.restore();
        }
      } else if (obs.type === "tower_pillar") {
        // Heavy Industrial Steel Column
        ctx.fillStyle = "#262626";
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = "#525252";
        ctx.lineWidth = 3;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        // Bevel center plate
        ctx.fillStyle = "#404040";
        ctx.fillRect(obs.x + 8, obs.y + 8, obs.w - 16, obs.h - 16);
      } else if (obs.type === "pipe") {
        // Industrial Cylindrical Pipeline
        ctx.fillStyle = "#475569";
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        // Pipe ring joints
        ctx.fillStyle = "#334155";
        if (obs.w > obs.h) {
          for (let px = obs.x + 40; px < obs.x + obs.w - 20; px += 50) {
            ctx.fillRect(px, obs.y - 2, 6, obs.h + 4);
          }
        } else {
          for (let py = obs.y + 40; py < obs.y + obs.h - 20; py += 50) {
            ctx.fillRect(obs.x - 2, py, obs.w + 4, 6);
          }
        }
      } else if (obs.type === "sandbags") {
        // Sandbag Barricade
        ctx.fillStyle = "#a1824a";
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = "#785e2f";
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      } else if (obs.type === "concrete") {
        // Concrete Blast Wall
        ctx.fillStyle = "#475569";
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        // Hazard edge stripe
        ctx.fillStyle = "#eab308";
        ctx.fillRect(obs.x + 4, obs.y + 4, Math.min(24, obs.w - 8), 4);
      } else if (obs.type === "crate") {
        // Reinforced Wooden Cargo Crate
        ctx.fillStyle = "#78350f";
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = "#b45309";
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        // Cross brace
        ctx.beginPath();
        ctx.moveTo(obs.x + 2, obs.y + 2);
        ctx.lineTo(obs.x + obs.w - 2, obs.y + obs.h - 2);
        ctx.moveTo(obs.x + obs.w - 2, obs.y + 2);
        ctx.lineTo(obs.x + 2, obs.y + obs.h - 2);
        ctx.strokeStyle = "rgba(180, 83, 9, 0.6)";
        ctx.stroke();
      } else if (obs.type === "pillar") {
        ctx.fillStyle = "#475569";
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 3;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      } else {
        ctx.fillStyle = "#334155";
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      }
      ctx.restore();
    }

    // Center Tower Catwalk Platform (Rust Rig Gantry)
    if (map.id === "rust") {
      ctx.save();
      ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
      ctx.fillRect(990, 990, 220, 220);
      ctx.strokeStyle = "rgba(234, 179, 8, 0.65)";
      ctx.lineWidth = 2;
      ctx.strokeRect(990, 990, 220, 220);
      // Steel mesh diagonal crossbars
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(990, 990); ctx.lineTo(1210, 1210);
      ctx.moveTo(1210, 990); ctx.lineTo(990, 1210);
      ctx.stroke();
      ctx.restore();
    }

    // 6. Tactical FOV Darkness Mask (Darkening all places not seen)
    const p = state.player;
    let poly = null;
    if (!p.isDead) {
      poly = computeVisibilityPolygon(p.x, p.y, p.angle, map);
      if (poly.length >= 3) {
        ctx.save();

        // Fill all unseen areas with deep tactical darkness
        ctx.fillStyle = FOV_DARKNESS;
        ctx.beginPath();
        const pad = 4000;
        ctx.rect(-pad, -pad, map.width + pad * 2, map.height + pad * 2);

        // Visibility polygon cutout
        ctx.moveTo(poly[0].x, poly[0].y);
        for (let i = 1; i < poly.length; i++) {
          ctx.lineTo(poly[i].x, poly[i].y);
        }
        ctx.closePath();
        ctx.fill("evenodd");

        // Subtle tactical flashlight beam illumination inside the lit area
        const fovGrad = ctx.createRadialGradient(p.x, p.y, 15, p.x, p.y, FOV_MAX_DIST);
        fovGrad.addColorStop(0, "rgba(56, 189, 248, 0.16)");
        fovGrad.addColorStop(0.35, "rgba(56, 189, 248, 0.07)");
        fovGrad.addColorStop(0.75, "rgba(56, 189, 248, 0.02)");
        fovGrad.addColorStop(1, "rgba(56, 189, 248, 0)");

        ctx.fillStyle = fovGrad;
        ctx.beginPath();
        ctx.moveTo(poly[0].x, poly[0].y);
        for (let i = 1; i < poly.length; i++) {
          ctx.lineTo(poly[i].x, poly[i].y);
        }
        ctx.closePath();
        ctx.fill();

        // Soft perimeter rim along the FOV sightline boundary
        ctx.strokeStyle = "rgba(56, 189, 248, 0.12)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
      }
    } else {
      // Spectator death overlay
      ctx.save();
      ctx.fillStyle = "rgba(220, 38, 38, 0.22)";
      ctx.fillRect(0, 0, map.width, map.height);
      ctx.restore();
    }

    // 7. Render Bullets & Rocket Trails
    for (const b of state.bullets) {
      ctx.save();
      ctx.beginPath();
      if (b.isRocket) {
        ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#ef4444";
        ctx.fill();
        ctx.strokeStyle = "#f97316";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = b.color || "#fde047";
        ctx.fill();
        ctx.shadowColor = b.color || "#fde047";
        ctx.shadowBlur = 8;
        ctx.stroke();
      }
      ctx.restore();
    }

    // 8. Render Particles
    for (const pt of state.particles) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (pt.life / pt.maxLife), 0, Math.PI * 2);
      ctx.fillStyle = pt.color;
      ctx.fill();
      ctx.restore();
    }

    // 9. Opponent Rendering (Clipped strictly to Visibility Polygon for Realistic Partial Peeking)
    if (!p.isDead && poly && poly.length >= 3) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i].x, poly[i].y);
      }
      ctx.closePath();
      ctx.clip(); // ONLY pixels inside the lit sightline can be rendered!

      for (const opp of Object.values(state.opponents)) {
        if (opp.isDead) continue;
        const d = Math.hypot(opp.x - p.x, opp.y - p.y);
        if (d > FOV_MAX_DIST + 150) continue; // Skip far-away entities for performance

        drawCombatant(ctx, opp, false);
      }
      ctx.restore();
    } else {
      // While dead / spectating, all alive opponents are visible
      for (const opp of Object.values(state.opponents)) {
        if (opp.isDead) continue;
        drawCombatant(ctx, opp, false);
      }
    }

    // 10. Render local player on top
    if (!state.player.isDead) {
      drawCombatant(ctx, state.player, true);
    }

    ctx.restore();

    // 11. Respawn Death Overlay when player is dead
    if (state.player.isDead) {
      ctx.save();
      ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 32px sans-serif";
      ctx.fillText("STRIDSVOGN ØDELAGT!", canvas.width / 2, canvas.height / 2 - 24);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px sans-serif";
      const rem = Math.max(0.1, state.player.respawnTimer || 0).toFixed(1);
      ctx.fillText(`Gjenoppstår om ${rem}s...`, canvas.width / 2, canvas.height / 2 + 20);
      ctx.restore();
    }

    // 12. Render Minimap Radar
    drawMinimap();
  }

  function drawMinimap() {
    const canvas = el.minimapCanvas;
    if (!canvas || !state.currentMap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const map = state.currentMap;
    const mw = canvas.width;
    const mh = canvas.height;

    ctx.clearRect(0, 0, mw, mh);

    // Radar background with subtle tint
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(0, 0, mw, mh);

    const pad = 6;
    const availW = mw - pad * 2;
    const availH = mh - pad * 2;
    const scale = Math.min(availW / map.width, availH / map.height);
    const offsetX = pad + (availW - map.width * scale) / 2;
    const offsetY = pad + (availH - map.height * scale) / 2;

    // Arena map bounds border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
    ctx.lineWidth = 1;
    ctx.strokeRect(offsetX, offsetY, map.width * scale, map.height * scale);

    // Obstacles (walls, crates, containers)
    ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
    for (const obs of map.obstacles) {
      ctx.fillRect(
        offsetX + obs.x * scale,
        offsetY + obs.y * scale,
        Math.max(1, obs.w * scale),
        Math.max(1, obs.h * scale)
      );
    }

    // Alive Opponents
    for (const opp of Object.values(state.opponents)) {
      if (opp.isDead) continue;
      const ox = offsetX + opp.x * scale;
      const oy = offsetY + opp.y * scale;

      ctx.beginPath();
      ctx.arc(ox, oy, 3.5, 0, Math.PI * 2);
      if (state.mode === "tdm") {
        ctx.fillStyle = opp.team === "blue" ? "#38bdf8" : "#f43f5e";
      } else {
        ctx.fillStyle = opp.color || "#f43f5e";
      }
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Local Player Tank
    const p = state.player;
    if (!p.isDead) {
      const px = offsetX + p.x * scale;
      const py = offsetY + p.y * scale;

      // Turret aim vector
      const dirAngle = p.angle !== undefined ? p.angle : p.hullAngle;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(dirAngle) * 9, py + Math.sin(dirAngle) * 9);
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Tank dot
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      if (state.mode === "tdm") {
        ctx.fillStyle = (p.team || state.playerTeam) === "blue" ? "#38bdf8" : "#f43f5e";
      } else {
        ctx.fillStyle = p.color || "#22c55e";
      }
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  function drawCombatant(ctx, c, isMe = false) {
    const now = performance.now();
    const isInvuln = c.invulnerableUntil && now < c.invulnerableUntil;
    const tankType = c.tank || (isMe ? state.selectedTank : "medium");
    const tConf = TANK_CONFIGS[tankType] || TANK_CONFIGS.medium;
    const sprites = TANK_SPRITES[tankType] || TANK_SPRITES.medium;
    const tankSize = 64; // Native 64x64 drawing size (no scaling)
    const hullAngle = c.hullAngle !== undefined ? c.hullAngle : (c.angle !== undefined ? c.angle : -Math.PI / 2);
    const turretAngle = c.angle !== undefined ? c.angle : hullAngle;
    const entityTeam = c.team || (isMe ? (state.player.team || state.playerTeam) : "red");
    const tankColor = state.mode === "tdm"
      ? (entityTeam === "blue" ? "#38bdf8" : "#f43f5e")
      : (c.color || "#ffd166");

    // 1. Soft Drop Shadow under tank chassis (oriented with hullAngle)
    ctx.save();
    ctx.translate(c.x, c.y + 4);
    ctx.rotate(hullAngle);
    ctx.beginPath();
    ctx.ellipse(0, 0, tankSize * 0.44, tankSize * 0.32, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
    ctx.fill();
    ctx.restore();

    // 2. Invulnerability Forcefield Bubble
    if (isInvuln) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(c.x, c.y, tankSize * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(56, 189, 248, 0.22)";
      ctx.fill();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }

    // 3. Tank Tracks (Static track sprite)
    const trackImg = sprites.tracks instanceof Image ? sprites.tracks : sprites.tracks?.[0];
    if (trackImg && trackImg.complete && trackImg.naturalWidth > 0) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(hullAngle + Math.PI / 2);
      ctx.drawImage(trackImg, -tankSize / 2, -tankSize / 2, tankSize, tankSize);
      ctx.restore();
    }

    // 4. Tank Hull / Body (Tinted to character color)
    const bodyImg = getTintedSprite(sprites.body, tankColor);
    if (bodyImg) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(hullAngle + Math.PI / 2);
      ctx.drawImage(bodyImg, -tankSize / 2, -tankSize / 2, tankSize, tankSize);
      ctx.restore();
    } else {
      // Fallback while loading
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(hullAngle);
      ctx.fillStyle = tankColor;
      ctx.fillRect(-tankSize * 0.38, -tankSize * 0.3, tankSize * 0.76, tankSize * 0.6);
      ctx.restore();
    }

    // 5. Tank Turret & Cannon Barrel (Rotated independently along turretAngle)
    const turretImg = getTintedSprite(sprites.turret, tankColor);
    const turretX = c.x;
    const turretY = c.y;

    if (turretImg) {
      ctx.save();
      ctx.translate(turretX, turretY);
      ctx.rotate(turretAngle + Math.PI / 2);
      ctx.drawImage(turretImg, -tankSize / 2, -tankSize / 2, tankSize, tankSize);
      ctx.restore();
    } else {
      // Fallback turret
      ctx.save();
      ctx.translate(turretX, turretY);
      ctx.rotate(turretAngle);
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, -3, 24, 6);
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fillStyle = tankColor;
      ctx.fill();
      ctx.restore();
    }

    // 6. Overhead Name & Vitals Bar (Unrotated)
    ctx.save();
    ctx.translate(c.x, c.y - tankSize * 0.65);

    // Name Tag
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    if (state.mode === "tdm") {
      const cTeam = c.team || (isMe ? (state.player.team || state.playerTeam) : "red");
      const isBlue = cTeam === "blue";
      ctx.fillStyle = isBlue ? "#38bdf8" : "#f43f5e";
      const tag = isBlue ? "[BLÅ] " : "[RØD] ";
      ctx.shadowColor = "rgba(0,0,0,0.85)";
      ctx.shadowBlur = 4;
      ctx.fillText(tag + c.name + (isMe ? " (Deg)" : ""), 0, -4);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = isMe ? "#fde047" : "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,0.85)";
      ctx.shadowBlur = 4;
      ctx.fillText(c.name, 0, -4);
      ctx.shadowBlur = 0;
    }

    // Mini Health Bar over tank
    const barW = 42;
    const barH = 5;
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(-barW / 2, 0, barW, barH);

    const maxHp = c.maxHealth || tConf.maxHealth || 100;
    const hpPct = Math.max(0, Math.min(1, c.health / maxHp));
    ctx.fillStyle = hpPct > 0.4 ? "#22c55e" : "#ef4444";
    ctx.fillRect(-barW / 2, 0, barW * hpPct, barH);

    ctx.restore();
  }

  // =========================================================================
  // HUD UPDATES
  // =========================================================================

  function updateVitalsHUD() {
    const p = state.player;
    const tConf = TANK_CONFIGS[p.tank || state.selectedTank] || TANK_CONFIGS.medium;
    const maxHp = p.maxHealth || tConf.maxHealth || 100;

    const hpPct = Math.max(0, Math.min(100, (p.health / maxHp) * 100));
    if (el.vitalHealthFill) el.vitalHealthFill.style.width = `${hpPct}%`;
    if (el.vitalHealthNum) el.vitalHealthNum.textContent = String(Math.max(0, p.health));

    // Update Rank / Score in Lobby/Match
    const all = [state.player, ...Object.values(state.opponents)];
    if (state.mode === "tdm") {
      const redKills = all.filter(c => (c.team || (c === state.player ? (state.player.team || state.playerTeam) : null)) === "red").reduce((acc, c) => acc + (c.kills || 0), 0);
      const blueKills = all.filter(c => (c.team || (c === state.player ? (state.player.team || state.playerTeam) : null)) === "blue").reduce((acc, c) => acc + (c.kills || 0), 0);
      const myTeam = p.team || state.playerTeam || "red";
      const leading = myTeam === "red" ? (redKills >= blueKills) : (blueKills >= redKills);
      if (el.hudPosNum) el.hudPosNum.textContent = leading ? "1." : "2.";
      if (el.hudKillsText) el.hudKillsText.textContent = `🔴 ${redKills} • 🔵 ${blueKills}`;
      if (el.headTargetScore) el.headTargetScore.textContent = `MÅL: ${state.scoreLimit} DRAP`;
    } else {
      all.sort((a, b) => (b.kills || 0) - (a.kills || 0));
      const myRank = all.findIndex(c => c === state.player) + 1;
      if (el.hudPosNum) el.hudPosNum.textContent = `${myRank}.`;
      if (el.hudKillsText) el.hudKillsText.textContent = `${p.kills}/${state.scoreLimit} drap`;
      if (el.headTargetScore) el.headTargetScore.textContent = `MÅL: ${state.scoreLimit} DRAP`;
    }
  }

  function updateWeaponHUD() {
    const p = state.player;
    const tConf = TANK_CONFIGS[p.tank || state.selectedTank] || TANK_CONFIGS.medium;

    if (el.weaponHudIcon) el.weaponHudIcon.textContent = "💣";
    if (el.weaponHudName) el.weaponHudName.textContent = tConf.weapon.name;
    if (el.weaponHudType) el.weaponHudType.textContent = `${tConf.name} • ${tConf.weapon.damage} Skade`;
    if (el.ammoCurrent) {
      el.ammoCurrent.textContent = "∞";
    }
    if (el.ammoLabel) {
      el.ammoLabel.textContent = "Uendelig";
    }
  }

  function updateScoreboardTable() {
    if (!el.scoreboardBody) return;
    el.scoreboardBody.innerHTML = "";

    const all = [state.player, ...Object.values(state.opponents)];
    all.sort((a, b) => (b.kills || 0) - (a.kills || 0) || (a.deaths || 0) - (b.deaths || 0));

    all.forEach((c, idx) => {
      const tr = document.createElement("tr");
      if (c === state.player) tr.className = "sb-me-row";
      const kd = c.deaths > 0 ? (c.kills / c.deaths).toFixed(1) : c.kills.toFixed(1);
      tr.innerHTML = `
        <td class="sb-col-pos">${idx + 1}</td>
        <td class="sb-col-name">
          <span class="sb-p-dot" style="background:${c.color || '#ffd166'}"></span>
          ${escapeHtml(c.name)} ${c === state.player ? '(Deg)' : ''}
        </td>
        <td class="sb-col-kills">${c.kills || 0}</td>
        <td class="sb-col-deaths">${c.deaths || 0}</td>
        <td class="sb-col-kd">${kd}</td>
        <td class="sb-col-score">${c.score || 0}</td>
      `;
      el.scoreboardBody.appendChild(tr);
    });
  }

  // =========================================================================
  // MULTIPLAYER NETWORKING & ROOM SYNC
  // =========================================================================

  let isSyncing = false;

  function startRoomSync() {
    if (state.syncTimerId) clearInterval(state.syncTimerId);
    state.syncTimerId = setInterval(syncWithServer, 50); // 20 updates per second for tight synchronization
  }

  function stopRoomSync() {
    if (state.syncTimerId) {
      clearInterval(state.syncTimerId);
      state.syncTimerId = null;
    }
    isSyncing = false;
  }

  async function syncWithServer() {
    if (isSyncing || !state.roomCode || !state.playerId || state.isSolo) return;
    isSyncing = true;

    try {
      const payload = {
        roomCode: state.roomCode,
        playerId: state.playerId,
        events: state.recentEvents.slice(),
        shots: state.recentShots.slice(),
        telemetry: {
          x: state.player.x,
          y: state.player.y,
          angle: state.player.angle,
          hullAngle: state.player.hullAngle,
          trackFrame: state.player.trackFrame,
          vx: state.player.vx,
          vy: state.player.vy,
          speed: state.player.speed,
          tank: state.player.tank || state.selectedTank,
          weapon: state.player.weapon,
          avatar: state.playerAvatar,
          color: state.playerColor,
          health: state.player.health,
          shield: state.player.shield,
          isDead: Boolean(state.player.isDead),
        },
      };

      state.recentEvents = [];
      state.recentShots = [];

      const resp = await fetch("/api/kuleregn/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (data && data.ok) {
        if (data.version && state.lastServerVersion && data.version < state.lastServerVersion) {
          // Discard out-of-order packet
          return;
        }
        if (data.version) state.lastServerVersion = data.version;
        handleServerStateUpdate(data);
      }
    } catch (e) {
    } finally {
      isSyncing = false;
    }
  }

  function handleServerStateUpdate(data) {
    const prevStatus = state.roomStatus;
    state.roomStatus = data.status;
    if (data.mode) state.mode = data.mode;
    if (data.teamScores) state.teamScores = data.teamScores;

    if (data.status === "lobby") {
      stopRoomSync();
      stopSimulation();
      showView("waiting");
      renderWaitingRoomState(data);
      return;
    }

    if (data.status === "countdown") {
      el.countdownOverlay?.classList.remove("hidden");
      const rem = Math.ceil(data.countdownRemaining || 3);
      if (el.countdownText) el.countdownText.textContent = rem > 0 ? String(rem) : "KJEMP!";
    } else if (data.status === "playing") {
      if (prevStatus === "countdown") {
        if (el.countdownText) el.countdownText.textContent = "KJEMP!";
        playTone(880, 0.4, "triangle", 0.35);
        setTimeout(() => el.countdownOverlay?.classList.add("hidden"), 600);
      } else {
        el.countdownOverlay?.classList.add("hidden");
      }
    } else if (data.status === "finished") {
      stopRoomSync();
      if (data.mode === "tdm" || state.mode === "tdm") {
        const teamScores = data.teamScores || { red: 0, blue: 0 };
        const winTeam = (teamScores.red || 0) >= (teamScores.blue || 0) ? "red" : "blue";
        showTeamVictoryPodium(winTeam, teamScores.red || 0, teamScores.blue || 0);
      } else {
        const winner = (data.players || [])[0];
        showVictoryPodium(winner);
      }
    }

    // Ingest local player stats from server
    const me = (data.players || []).find(p => p.id === state.playerId);
    if (me) {
      state.player.kills = me.kills || 0;
      state.player.deaths = me.deaths || 0;
      state.player.score = me.score || 0;

      const serverDead = Boolean(me.isDead || (typeof me.health === "number" && me.health <= 0));

      if (serverDead && !state.player.isDead && (!state.player.lastKilledAt || Date.now() - state.player.lastKilledAt > 3000)) {
        state.player.isDead = true;
        state.player.lastKilledAt = Date.now();
        state.player.health = 0;
        state.player.respawnTimer = 2.5;
        addDeathExplosion(state.player.x, state.player.y, state.player.color);
        playTone(120, 0.35, "sawtooth", 0.5);
      } else if (!serverDead && state.player.isDead && state.player.respawnTimer <= 0.2) {
        spawnPlayer(state.player, state.currentMap);
        state.player.health = me.health || 100;
        state.player.shield = 0;
      } else if (!state.player.isDead) {
        // Local player is ALIVE: health can ONLY decrease while alive (no rubber-banding back up!)
        if (typeof me.health === "number" && me.health < state.player.health) {
          state.camera.shake = Math.min(18, state.camera.shake + 6);
          playTone(160, 0.1, "sawtooth", 0.35);
          showDamageFeedback();
          addDamageSparks(state.player.x, state.player.y, state.player.color);
          state.player.health = me.health;
        }
      }
      updateVitalsHUD();
    }

    // Ingest opponent players
    (data.players || []).forEach(p => {
      if (p.id !== state.playerId && !p.isBot) {
        if (!state.opponents[p.id]) {
          state.opponents[p.id] = {
            id: p.id,
            name: p.name,
            team: p.team || "red",
            color: p.color,
            avatar: p.avatar || "",
            tank: p.tank || "medium",
            x: p.x,
            y: p.y,
            targetX: p.x,
            targetY: p.y,
            angle: p.angle,
            targetAngle: p.angle,
            hullAngle: p.hullAngle !== undefined ? p.hullAngle : p.angle,
            targetHullAngle: p.hullAngle !== undefined ? p.hullAngle : p.angle,
            trackFrame: p.trackFrame || 0,
            vx: p.vx || 0,
            vy: p.vy || 0,
            speed: p.speed || 0,
            weapon: p.weapon || "cannon",
            maxHealth: p.maxHealth || 100,
            maxShield: 0,
            health: p.health || 100,
            shield: 0,
            kills: p.kills || 0,
            deaths: p.deaths || 0,
            score: p.score || 0,
            isDead: Boolean(p.isDead || (p.health || 100) <= 0),
          };
        } else {
          const opp = state.opponents[p.id];
          if (p.team) opp.team = p.team;
          if (p.avatar && p.avatar !== opp.avatar) opp.avatar = p.avatar;
          if (p.tank && p.tank !== opp.tank) opp.tank = p.tank;
          opp.color = p.color || opp.color;

          // Target authoritative coordinates for smooth continuous 60fps lerping
          opp.targetX = p.x;
          opp.targetY = p.y;
          opp.targetAngle = p.angle;
          opp.targetHullAngle = p.hullAngle !== undefined ? p.hullAngle : p.angle;
          opp.vx = p.vx || 0;
          opp.vy = p.vy || 0;
          opp.speed = p.speed || 0;

          // If snap distance is huge (e.g. teleport / respawn)
          if (Math.hypot(p.x - opp.x, p.y - opp.y) > 250) {
            opp.x = p.x;
            opp.y = p.y;
            opp.angle = p.angle;
            opp.hullAngle = opp.targetHullAngle;
          }

          if (p.trackFrame !== undefined) {
            opp.trackFrame = p.trackFrame;
          }

          opp.weapon = p.weapon || opp.weapon;
          opp.kills = p.kills || opp.kills;
          opp.deaths = p.deaths || opp.deaths;
          opp.score = p.score || opp.score;

          const serverDead = Boolean(p.isDead || (typeof p.health === "number" && p.health <= 0));

          if ((serverDead || opp.health <= 0) && !opp.isDead && (!opp.lastKilledAt || Date.now() - opp.lastKilledAt > 3000)) {
            opp.isDead = true;
            opp.lastKilledAt = Date.now();
            opp.health = 0;
            opp.respawnTimer = 2.5;
            addDeathExplosion(opp.x, opp.y, opp.color);
          } else if (!serverDead && opp.isDead) {
            // Only resurrect if respawn timer has actually run its course (prevents in-flight packet resurrection)
            if (!opp.respawnTimer || opp.respawnTimer <= 0.2) {
              opp.isDead = false;
              opp.health = p.health || 100;
              opp.shield = 0;
              opp.invulnerableUntil = performance.now() + 500;
            }
          } else if (!opp.isDead) {
            // Opponent is ALIVE: health can ONLY decrease while alive (no rubber-banding back up!)
            if (typeof p.health === "number" && p.health < opp.health) {
              opp.health = p.health;
            }
          }
        }
      }
    });

    // Ingest opponent shots from server
    if (data.recentShots && data.recentShots.length > 0) {
      data.recentShots.forEach(s => {
        if (s.playerId && s.playerId !== state.playerId && !state.seenShotIds.has(s.id)) {
          state.seenShotIds.add(s.id);
          if (state.seenShotIds.size > 200) {
            const first = state.seenShotIds.values().next().value;
            state.seenShotIds.delete(first);
          }
          const opp = state.opponents[s.playerId];
          const oppName = opp ? opp.name : "Motstander";
          const oppColor = state.mode === "tdm"
            ? (opp && opp.team === "blue" ? "#38bdf8" : "#f43f5e")
            : (opp ? opp.color : "#ef4444");
          const w = WEAPONS[s.weapon] || WEAPONS.cannon || WEAPONS.medium || TANK_CONFIGS.medium.weapon;
          const bSpeed = w.bulletSpeed || 1100;
          const bLife = w.bulletLife || ((w.bulletRange || 1300) / bSpeed);
          const bDmg = w.damage || 50;

          for (let i = 0; i < (w.bulletCount || 1); i++) {
            const spreadAngle = (Math.random() - 0.5) * (w.spread || 0.005);
            const bAngle = s.angle + spreadAngle;
            state.bullets.push({
              id: `${s.id}_${i}`,
              ownerId: s.playerId,
              ownerName: oppName,
              ownerColor: oppColor,
              weapon: s.weapon,
              x: s.x,
              y: s.y,
              vx: Math.cos(bAngle) * bSpeed,
              vy: Math.sin(bAngle) * bSpeed,
              damage: bDmg,
              life: bLife,
              maxLife: bLife,
              color: state.mode === "tdm" ? oppColor : (w.color || oppColor),
              isRocket: s.weapon === "rocket",
            });
          }
          addMuzzleParticles(s.x, s.y, s.angle, w.color);
          playWeaponSound(s.weapon);
        }
      });
    }

    // Ingest kill feed if reported by server
    if (data.killFeed && data.killFeed.length > 0) {
      data.killFeed.forEach(kf => {
        const kfId = kf.id;
        if (kfId && state.seenKillFeedIds.has(kfId)) {
          return;
        }

        const myId = state.playerId || state.player.id || "player_local";
        const isMyKill = kf.killerId === myId;
        const resolvedKillerName = (kf.killerName === "Omgivelse" && isMyKill) ? (state.playerName || state.player.name) : kf.killerName;
        const resolvedKillerColor = (kf.killerName === "Omgivelse" && isMyKill) ? (state.playerColor || state.player.color) : kf.killerColor;

        const kfTime = kf.time ? kf.time * 1000 : Date.now();
        const duplicate = state.killFeed.some(existing =>
          (kfId && existing.id === kfId) ||
          (existing.killerName === resolvedKillerName &&
           existing.victimName === kf.victimName &&
           Math.abs((existing.timestamp || 0) - kfTime) < 4000)
        );

        if (kfId) {
          state.seenKillFeedIds.add(kfId);
          if (state.seenKillFeedIds.size > 200) {
            const first = state.seenKillFeedIds.values().next().value;
            state.seenKillFeedIds.delete(first);
          }
        }

        if (!duplicate) {
          addKillFeedItem({
            id: kfId,
            killerId: kf.killerId,
            killerName: resolvedKillerName,
            killerColor: resolvedKillerColor,
            victimName: kf.victimName,
            victimColor: kf.victimColor,
            weapon: kf.weapon,
            timestamp: kfTime,
          });
        }
      });
    }

    // If server reset the room back to lobby, transition local client back to lobby/lounge
    if (data.status === "lobby" && (state.roomStatus === "finished" || state.view === "game")) {
      handleForfeitAndLeave();
    }
  }

  // =========================================================================
  // MATCH LAUNCHERS & NAVIGATION
  // =========================================================================

  function spawnSoloDummies(map) {
    state.opponents = {};
    const center = { x: map.width / 2, y: map.height / 2 };

    if (state.mode === "tdm") {
      const myTeam = state.playerTeam || "red";
      const oppTeam = myTeam === "red" ? "blue" : "red";
      state.player.team = myTeam;
      state.player.color = myTeam === "red" ? "#f43f5e" : "#38bdf8";

      // 1 ally on my team
      const allyColor = myTeam === "red" ? "#f43f5e" : "#38bdf8";
      state.opponents["solo_ally"] = {
        id: "solo_ally",
        name: "Alliert-Alfa",
        team: myTeam,
        color: allyColor,
        avatar: "char:h2:c_38bdf8:r2:e2:m2",
        tank: "medium",
        x: center.x + (myTeam === "red" ? -180 : 180),
        y: center.y - 120,
        angle: 0,
        hullAngle: 0,
        trackFrame: 0,
        trackDistance: 0,
        recoilOffset: 0,
        vx: 0,
        vy: 0,
        speed: 0,
        health: 100,
        shield: 0,
        maxHealth: 100,
        maxShield: 0,
        weapon: "cannon_medium",
        kills: 0,
        deaths: 0,
        score: 0,
        streak: 0,
        highestStreak: 0,
        isDead: false,
        respawnTimer: 0,
        invulnerableUntil: 0,
      };

      // 2 enemies on opposite team
      const enemyColor = oppTeam === "red" ? "#f43f5e" : "#38bdf8";
      const enemies = [
        { id: "solo_enemy1", name: "Fiende-Alfa", offset: { x: (oppTeam === "red" ? -420 : 420), y: -60 }, tank: "heavy", weapon: "cannon_heavy" },
        { id: "solo_enemy2", name: "Fiende-Bravo", offset: { x: (oppTeam === "red" ? -350 : 350), y: 220 }, tank: "light", weapon: "cannon_light" },
      ];

      enemies.forEach(e => {
        state.opponents[e.id] = {
          id: e.id,
          name: e.name,
          team: oppTeam,
          color: enemyColor,
          avatar: "char:h1:c_f43f5e:r1:e1:m1",
          tank: e.tank,
          x: center.x + e.offset.x,
          y: center.y + e.offset.y,
          angle: oppTeam === "red" ? 0 : Math.PI,
          hullAngle: oppTeam === "red" ? 0 : Math.PI,
          trackFrame: 0,
          trackDistance: 0,
          recoilOffset: 0,
          vx: 0,
          vy: 0,
          speed: 0,
          health: 100,
          shield: 0,
          maxHealth: 100,
          maxShield: 0,
          weapon: e.weapon,
          kills: 0,
          deaths: 0,
          score: 0,
          streak: 0,
          highestStreak: 0,
          isDead: false,
          respawnTimer: 0,
          invulnerableUntil: 0,
        };
      });
    } else {
      // FFA mode: 4 target tanks
      state.player.team = null;
      const dummyConfigs = [
        { id: "dummy_1", name: "Panser-Alfa", color: "#f43f5e", avatar: "char:h1:c_f43f5e:r1:e1:m1", offset: { x: -500, y: -60 }, tank: "heavy", weapon: "cannon_heavy", hullAngle: 0.5 },
        { id: "dummy_2", name: "Panser-Bravo", color: "#38bdf8", avatar: "char:h2:c_38bdf8:r2:e2:m2", offset: { x: 480, y: -100 }, tank: "light", weapon: "cannon_light", hullAngle: 2.2 },
        { id: "dummy_3", name: "Panser-Charlie", color: "#a855f7", avatar: "char:h3:c_a855f7:r3:e3:m3", offset: { x: 0, y: -450 }, tank: "medium", weapon: "cannon_medium", hullAngle: -1.2 },
        { id: "dummy_4", name: "Panser-Delta", color: "#10b981", avatar: "char:h4:c_10b981:r1:e2:m1", offset: { x: -220, y: 320 }, tank: "heavy", weapon: "cannon_heavy", hullAngle: -2.8 },
      ];

      dummyConfigs.forEach(d => {
        state.opponents[d.id] = {
          id: d.id,
          name: d.name,
          team: null,
          color: d.color,
          avatar: d.avatar,
          tank: d.tank || "medium",
          x: center.x + d.offset.x,
          y: center.y + d.offset.y,
          angle: d.hullAngle || 0,
          hullAngle: d.hullAngle || 0,
          trackFrame: 0,
          trackDistance: 0,
          recoilOffset: 0,
          vx: 0,
          vy: 0,
          speed: 0,
          health: 100,
          shield: 0,
          maxHealth: 100,
          maxShield: 0,
          weapon: d.weapon || "cannon_medium",
          kills: 0,
          deaths: 0,
          score: 0,
          streak: 0,
          highestStreak: 0,
          isDead: false,
          respawnTimer: 0,
          invulnerableUntil: 0,
        };
      });
    }
  }

  function launchSoloPractice() {
    state.isSolo = true;
    state.roomCode = null;
    state.playerId = "solo_player";
    const selectedMapId = el.wrSelectMap ? el.wrSelectMap.value : (state.mapId || "rust");
    state.mapId = selectedMapId;
    state.currentMap = getMapById(selectedMapId);
    state.scoreLimit = state.mode === "tdm" ? 15 : 10;
    state.timeLimit = 3600;
    state.timeRemaining = 3600;
    state.roomStatus = "playing";

    const tConf = TANK_CONFIGS[state.selectedTank] || TANK_CONFIGS.medium;
    state.player.id = "solo_player";
    state.player.name = state.playerName || "Soldat";
    state.player.team = state.mode === "tdm" ? (state.playerTeam || "red") : null;
    state.player.color = state.mode === "tdm"
      ? (state.player.team === "blue" ? "#38bdf8" : "#f43f5e")
      : (state.playerColor || "#ffd166");
    state.player.avatar = state.playerAvatar || "char:h1:c_ffd166:r1:e1:m1";
    state.player.tank = state.selectedTank;
    state.player.maxHealth = tConf.maxHealth;
    state.player.maxShield = 0;
    state.player.health = tConf.maxHealth;
    state.player.shield = 0;

    spawnPlayer(state.player, state.currentMap);
    state.player.kills = 0;
    state.player.deaths = 0;
    state.player.score = 0;
    state.player.streak = 0;

    state.bullets = [];
    state.particles = [];
    state.killFeed = [];
    state.seenKillFeedIds.clear();
    if (el.killFeedContainer) el.killFeedContainer.innerHTML = "";

    // Spawn shooting practice targets
    spawnSoloDummies(state.currentMap);

    showView("game");
    updateWeaponHUD();
    updateVitalsHUD();

    if (el.countdownOverlay) el.countdownOverlay.classList.add("hidden");
    if (el.btnHeaderBack) {
      el.btnHeaderBack.href = "#";
    }
    if (el.backBtnText) {
      el.backBtnText.textContent = "Meny";
    }

    startSimulation();
  }

  function launchOnlineMatch(data) {
    state.isSolo = false;
    state.roomStatus = data.status || "playing";
    state.mode = data.mode || state.mode || "ffa";
    state.mapId = data.mapId || state.mapId || "rust";
    state.currentMap = getMapById(state.mapId);
    state.scoreLimit = data.scoreLimit || state.scoreLimit;
    state.timeLimit = data.timeLimit || state.timeLimit;
    state.timeRemaining = data.timeRemaining !== undefined ? data.timeRemaining : state.timeLimit;

    state.player.id = state.playerId;
    state.player.name = state.playerName || "Soldat";
    state.player.avatar = state.playerAvatar || "";
    state.player.team = state.mode === "tdm" ? (data.playerTeam || state.playerTeam || "red") : null;
    state.player.color = state.mode === "tdm"
      ? (state.player.team === "blue" ? "#38bdf8" : "#f43f5e")
      : (state.playerColor || "#ffd166");
    spawnPlayer(state.player, state.currentMap);

    state.opponents = {};
    state.bullets = [];
    state.particles = [];
    state.killFeed = [];
    state.seenKillFeedIds.clear();
    if (el.killFeedContainer) el.killFeedContainer.innerHTML = "";

    showView("game");
    updateWeaponHUD();
    updateVitalsHUD();

    if (data.status === "countdown") {
      if (el.countdownOverlay) el.countdownOverlay.classList.remove("hidden");
      const rem = Math.ceil(data.countdownRemaining || 3);
      if (el.countdownText) el.countdownText.textContent = rem > 0 ? String(rem) : "KJEMP!";
    } else {
      if (el.countdownOverlay) el.countdownOverlay.classList.add("hidden");
    }

    startRoomSync();
    startSimulation();
  }

  function handleForfeitAndLeave() {
    stopSimulation();
    stopRoomSync();
    state.killFeed = [];
    state.seenKillFeedIds.clear();
    if (el.killFeedContainer) el.killFeedContainer.innerHTML = "";

    if (state.isSolo) {
      showView("lobby");
      return;
    }

    if (window.PartyBridge && typeof window.PartyBridge.leaveToLounge === "function") {
      window.PartyBridge.leaveToLounge({
        roomCode: state.roomCode,
        playerId: state.playerId,
        beforeLeave: () => {
          if (state.roomCode && state.playerId) {
            try {
              fetch("/api/kuleregn/leave", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                keepalive: true,
                body: JSON.stringify({ roomCode: state.roomCode, playerId: state.playerId, forfeit: true }),
              });
            } catch (_) {}
          }
        },
      });
      return;
    }

    const code = state.roomCode;
    const pid = state.playerId;
    if (code) {
      try {
        fetch("/api/kuleregn/leave", {
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

      state.roomCode = null;
      state.playerId = null;

      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (_) {}

      window.location.replace(`/party/?room=${encodeURIComponent(code)}&player=${encodeURIComponent(pid)}`);
      return;
    }

    showView("lobby");
  }

  function initTabs() {
    const tabs = [
      { btn: el.tabOnline, panel: el.panelOnline },
      { btn: el.tabSolo, panel: el.panelSolo },
    ];
    tabs.forEach(({ btn, panel }) => {
      if (!btn || !panel) return;
      btn.addEventListener("click", () => {
        tabs.forEach(t => {
          t.btn.classList.remove("active");
          t.btn.setAttribute("aria-selected", "false");
          t.panel.classList.add("hidden");
          t.panel.classList.remove("active");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
        panel.classList.remove("hidden");
        panel.classList.add("active");
      });
    });
  }

  async function initPartyBridge() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = (urlParams.get("room") || urlParams.get("code") || urlParams.get("roomCode") || "").trim().toUpperCase();
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

      try {
        const resp = await fetch(`/api/kuleregn/state?roomCode=${encodeURIComponent(roomParam)}&playerId=${encodeURIComponent(playerParam)}`);
        const data = await resp.json();
        if (data && data.ok) {
          state.isHost = Boolean(data.isHost);
          state.mapId = data.mapId || "rust";
          state.scoreLimit = data.scoreLimit || 15;
          state.timeLimit = data.timeLimit || 300;
          state.timeRemaining = data.timeRemaining !== undefined ? data.timeRemaining : (data.timeLimit || 300);

          if (el.btnHeaderBack) {
            el.btnHeaderBack.href = `/party/?room=${encodeURIComponent(roomParam)}`;
          }
          if (el.backBtnText) {
            el.backBtnText.textContent = "Forlat rommet";
          }

          let myPlayer = (data.players || []).find(p => p.id === state.playerId || p.isMe);
          if (!myPlayer && (data.isHost || state.isHost)) {
            myPlayer = (data.players || []).find(p => p.isHost) || (data.players || [])[0];
          }
          if (!myPlayer) {
            const savedName = (state.playerName || "").toLowerCase();
            myPlayer = (data.players || []).find(p => (p.name || "").toLowerCase() === savedName) || (data.players || [])[0];
          }

          if (myPlayer) {
            state.playerId = myPlayer.id;
            state.player.id = myPlayer.id;
            if (myPlayer.name) {
              state.playerName = myPlayer.name;
              state.player.name = myPlayer.name;
            }
            if (myPlayer.color) {
              state.playerColor = myPlayer.color;
              state.player.color = myPlayer.color;
            }
            if (myPlayer.avatar) {
              state.playerAvatar = myPlayer.avatar;
              state.player.avatar = myPlayer.avatar;
            }
            if (myPlayer.tank) {
              state.selectedTank = myPlayer.tank;
            }
          }

          // If room is in lobby, show waiting room!
          if (data.status === "lobby") {
            showView("waiting");
            renderWaitingRoomState(data);
            return;
          }

          launchOnlineMatch(data);
          return;
        } else {
          window.location.href = `/party/?room=${encodeURIComponent(roomParam)}`;
          return;
        }
      } catch (e) {
        console.error("Init online room error:", e);
      }
    }

    showView("lobby");
  }

  // =========================================================================
  // SETUP & EVENT BINDINGS
  // =========================================================================

  function resizeCanvas() {
    const canvas = el.combatCanvas;
    if (!canvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight - 56; // Minus header
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function initUI() {
    window.addEventListener("resize", resizeCanvas);

    // Standard Tab Switching (Nettspill / Solo)
    initTabs();

    // Standardized PartyConnect for "Nettspill" tab
    if (window.PartyConnect) {
      window.PartyConnect.init({
        gameId: "kuleregn",
        createBtnId: "btnCreatePartyRoom",
        joinBtnId: "btnJoinPartyRoom",
        hostInputId: "inputPartyHostName",
        joinInputId: "inputPartyJoinName",
        codeInputId: "inputPartyRoomCode",
      });
    }

    // Waiting Room Turntable Vehicle Selector (Left/Right Arrows & Touch/Click)
    el.btnTankPrev?.addEventListener("click", () => {
      cycleTank(-1);
    });
    el.btnTankNext?.addEventListener("click", () => {
      cycleTank(1);
    });
    el.turntableStage?.addEventListener("click", () => {
      cycleTank(1);
    });

    let touchStartX = 0;
    el.turntableStage?.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches[0]) {
        touchStartX = e.touches[0].clientX;
      }
    }, { passive: true });
    el.turntableStage?.addEventListener("touchend", (e) => {
      if (e.changedTouches && e.changedTouches[0]) {
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(deltaX) > 25) {
          cycleTank(deltaX < 0 ? 1 : -1);
        }
      }
    }, { passive: true });

    // Solo Practice Tank Picker (if present)
    const soloBtns = el.soloTankPicker ? el.soloTankPicker.querySelectorAll(".solo-tank-opt") : [];
    soloBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const tankType = btn.dataset.tank;
        if (tankType) selectTank(tankType);
      });
    });

    // Waiting Room: Game Mode Selector (FFA vs TDM)
    el.btnModeFFA?.addEventListener("click", () => {
      setWaitingMode("ffa");
    });
    el.btnModeTDM?.addEventListener("click", () => {
      setWaitingMode("tdm");
    });

    // Waiting Room: Swap Team Button
    el.btnSwapTeam?.addEventListener("click", () => {
      swapTeam();
    });

    // Waiting Room: Map Selector
    el.wrSelectMap?.addEventListener("change", (e) => {
      setWaitingMap(e.target.value);
    });

    // Waiting Room: Toggle Ready
    el.btnToggleReady?.addEventListener("click", () => {
      toggleReady();
    });

    // Waiting Room: Host Force Start
    el.btnHostStartMatch?.addEventListener("click", () => {
      hostStartMatch();
    });

    // Waiting Room: Copy Room Code
    el.btnCopyRoomCode?.addEventListener("click", () => {
      if (state.roomCode) {
        navigator.clipboard?.writeText(state.roomCode);
        const oldTitle = el.btnCopyRoomCode.title;
        el.btnCopyRoomCode.title = "Kopiert!";
        setTimeout(() => {
          if (el.btnCopyRoomCode) el.btnCopyRoomCode.title = oldTitle;
        }, 1500);
      }
    });

    // Waiting Room: Leave Room Button
    el.btnLeaveWaitingRoom?.addEventListener("click", () => {
      handleForfeitAndLeave();
    });

    // Solo Practice Start Button
    el.btnStartSoloPractice?.addEventListener("click", () => {
      openSoloTankSelection();
    });

    // Sound toggle
    el.btnSoundToggle?.addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      const onSvg = el.btnSoundToggle.querySelector(".sound-icon-on");
      const offSvg = el.btnSoundToggle.querySelector(".sound-icon-off");
      if (onSvg && offSvg) {
        onSvg.classList.toggle("hidden", !soundEnabled);
        offSvg.classList.toggle("hidden", soundEnabled);
      }
    });

    // Header Back button
    el.btnHeaderBack?.addEventListener("click", (e) => {
      if (state.view === "game" || state.view === "waiting" || state.roomCode) {
        e.preventDefault();
        handleForfeitAndLeave();
      }
    });

    // Header Leave button
    el.btnHeaderLeave?.addEventListener("click", () => {
      handleForfeitAndLeave();
    });

    // Party Lobby Hub Button
    el.btnPartyHub?.addEventListener("click", () => {
      window.location.href = "/party/";
    });

    // Podium Return Buttons
    el.btnPodiumReturnLobby?.addEventListener("click", async () => {
      if (el.modalPodium) el.modalPodium.classList.add("hidden");
      if (state.isSolo) {
        openSoloTankSelection();
      } else {
        if (state.roomCode) {
          try {
            await fetch("/api/kuleregn/reset_lobby", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ roomCode: state.roomCode, playerId: state.playerId }),
            });
            showView("waiting");
            return;
          } catch (_) {}
        }
        handleForfeitAndLeave();
      }
    });

    el.btnPodiumReturnGateway?.addEventListener("click", () => {
      if (el.modalPodium) el.modalPodium.classList.add("hidden");
      stopSimulation();
      stopRoomSync();
      stopLobbyPoll();
      showView("lobby");
    });

    // Initial render of tank previews and active selection
    renderAllTankPreviews();
    syncTankCardsUI();
  }

  // =========================================================================
  // BOOTSTRAP INITIALIZATION
  // =========================================================================

  window.addEventListener("DOMContentLoaded", () => {
    initInputHandlers();
    initUI();
    initPartyBridge();
  });
})();
