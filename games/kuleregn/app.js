/**
 * Kuleregn - Modern Top-Down 2D Shooter Engine (WASD + Mouse)
 *
 * Features:
 * - 60 FPS HTML5 Canvas top-down shooter with dynamic camera tracking
 * - WASD 8-directional normalized movement + Tactical Dash (Space/Shift)
 * - Mouse cursor aiming with dynamic laser crosshair & recoil spread
 * - Weapon Arsenal: P-99 Pistol, SPAS-12 Shotgun, AR-47 Assault Rifle, AWP Sniper, RPG Rocket Launcher
 * - Map pickups: Floating rotating weapon crates, +40 Medkits, +50 Shields, Explosive Red Barrels
 * - Full AI Bot simulation (Patrol, Hunt, Combat strafe, Seek medkits) for instant solo play
 * - Multi-device synchronization over /api/kuleregn/sync & Party Lobby bridge
 * - Procedural Web Audio synthesizer (zero audio assets needed: gunshot, blast, rocket, reload, hits)
 * - Real-time Kill Feed, Overhead Vitals, Tab Leaderboard, and Victory Podium
 */

(() => {
  "use strict";

  // =========================================================================
  // CONSTANTS & WEAPONS SPECIFICATION
  // =========================================================================

  const PALETTE = [
    { color: "#ef4444", name: "Karmosin Rød" },
    { color: "#38bdf8", name: "Himmelblå" },
    { color: "#10b981", name: "Smaragdgrønn" },
    { color: "#fbbf24", name: "Solgul" },
    { color: "#a855f7", name: "Neon Lilla" },
    { color: "#f97316", name: "Ild Oransje" },
    { color: "#ec4899", name: "Cyber Rosa" },
    { color: "#06b6d4", name: "Turkis" },
    { color: "#84cc16", name: "Giftgrønn" },
    { color: "#6366f1", name: "Indigo Blå" },
    { color: "#14b8a6", name: "Teal Frost" },
    { color: "#d946ef", name: "Fuchsia" },
    { color: "#eab308", name: "Gull Pokal" },
    { color: "#3b82f6", name: "Kongeblå" },
    { color: "#f43f5e", name: "Rubin" },
    { color: "#22c55e", name: "Militærgrønn" },
  ];

  const WEAPONS = {
    pistol: {
      id: "pistol",
      name: "P-99 Pistol",
      type: "Semi-automatisk",
      icon: "🔫",
      damage: 22,
      fireRate: 0.22,
      magSize: 12,
      reloadTime: 1.1,
      bulletSpeed: 900,
      bulletLife: 1.1,
      spread: 0.035,
      bulletCount: 1,
      isAutomatic: false,
      ammoReserve: Infinity,
      recoilKick: 4,
      screenShake: 2,
      color: "#fde047",
      length: 18,
      barrelWidth: 4,
    },
    shotgun: {
      id: "shotgun",
      name: "SPAS-12 Hagle",
      type: "Pumpehagle",
      icon: "💥",
      damage: 18, // 18 x 6 = 108 max
      fireRate: 0.75,
      magSize: 6,
      reloadTime: 1.8,
      bulletSpeed: 780,
      bulletLife: 0.65,
      spread: 0.22,
      bulletCount: 6,
      isAutomatic: false,
      ammoReserve: 24,
      recoilKick: 12,
      screenShake: 6,
      color: "#fb923c",
      length: 26,
      barrelWidth: 6,
    },
    assault: {
      id: "assault",
      name: "AR-47 Maskingevær",
      type: "Helautomatisk",
      icon: "⚡",
      damage: 17,
      fireRate: 0.11, // ~9 rps
      magSize: 30,
      reloadTime: 1.5,
      bulletSpeed: 980,
      bulletLife: 1.15,
      spread: 0.07,
      bulletCount: 1,
      isAutomatic: true,
      ammoReserve: 90,
      recoilKick: 5,
      screenShake: 3,
      color: "#38bdf8",
      length: 28,
      barrelWidth: 5,
    },
    sniper: {
      id: "sniper",
      name: "AWP Skarpskytter",
      type: "Bolt-action",
      icon: "🎯",
      damage: 85,
      fireRate: 1.25,
      magSize: 5,
      reloadTime: 2.2,
      bulletSpeed: 1500,
      bulletLife: 1.2,
      spread: 0.012,
      bulletCount: 1,
      isAutomatic: false,
      ammoReserve: 15,
      recoilKick: 16,
      screenShake: 8,
      color: "#a855f7",
      length: 36,
      barrelWidth: 4,
    },
    rocket: {
      id: "rocket",
      name: "RPG Rakettkaster",
      type: "Eksplosiv",
      icon: "🚀",
      damage: 115,
      splashRadius: 140,
      fireRate: 1.5,
      magSize: 2,
      reloadTime: 2.5,
      bulletSpeed: 520,
      bulletLife: 2.2,
      spread: 0.02,
      bulletCount: 1,
      isAutomatic: false,
      ammoReserve: 4,
      recoilKick: 20,
      screenShake: 14,
      color: "#ef4444",
      length: 32,
      barrelWidth: 8,
    },
  };

  // =========================================================================
  // ARENA MAP GENERATION & SPECIFICATION
  // =========================================================================

  function buildGloshaugenArena() {
    const w = 2400;
    const h = 1800;

    // Obstacle rectangles: [x, y, width, height, type]
    // type: 'wall' | 'crate' | 'pillar' | 'barrel'
    const obstacles = [
      // Outer Perimeter Boundaries
      { x: 0, y: 0, w: w, h: 40, type: "wall" },
      { x: 0, y: h - 40, w: w, h: 40, type: "wall" },
      { x: 0, y: 0, w: 40, h: h, type: "wall" },
      { x: w - 40, y: 0, w: 40, h: h, type: "wall" },

      // Central Plaza Pillars & Fountain
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

      // South-West Library Wing
      { x: 260, y: h - 480, w: 35, h: 260, type: "wall" },
      { x: 260, y: h - 255, w: 380, h: 35, type: "wall" },
      { x: 420, y: h - 480, w: 220, h: 35, type: "wall" },
      { x: 380, y: h - 340, w: 60, h: 60, type: "crate" },

      // South-East Lab Wing
      { x: w - 295, y: h - 480, w: 35, h: 260, type: "wall" },
      { x: w - 640, y: h - 255, w: 380, h: 35, type: "wall" },
      { x: w - 640, y: h - 480, w: 220, h: 35, type: "wall" },
      { x: w - 440, y: h - 340, w: 60, h: 60, type: "crate" },

      // Mid-field Concrete Barricades
      { x: w / 2 - 380, y: h / 2 - 35, w: 180, h: 70, type: "wall" },
      { x: w / 2 + 200, y: h / 2 - 35, w: 180, h: 70, type: "wall" },
      { x: w / 2 - 35, y: 260, w: 70, h: 180, type: "wall" },
      { x: w / 2 - 35, y: h - 440, w: 70, h: 180, type: "wall" },

      // Metal Shipping Containers / Heavy Crates
      { x: 800, y: 650, w: 110, h: 70, type: "crate" },
      { x: w - 910, y: 650, w: 110, h: 70, type: "crate" },
      { x: 800, y: h - 720, w: 110, h: 70, type: "crate" },
      { x: w - 910, y: h - 720, w: 110, h: 70, type: "crate" },
    ];

    // Explosive Red Barrels (shoot to explode!)
    const barrels = [
      { id: "b1", x: 480, y: 320, r: 18, hp: 35 },
      { id: "b2", x: w - 480, y: 320, r: 18, hp: 35 },
      { id: "b3", x: 480, y: h - 320, r: 18, hp: 35 },
      { id: "b4", x: w - 480, y: h - 320, r: 18, hp: 35 },
      { id: "b5", x: w / 2 - 240, y: h / 2 - 240, r: 18, hp: 35 },
      { id: "b6", x: w / 2 + 240, y: h / 2 + 240, r: 18, hp: 35 },
    ];

    // Pickups (weapon crates, medkits, shields)
    const pickups = [
      // Weapons
      { id: "p_shotgun_1", type: "shotgun", x: w / 2, y: 160, respawnSec: 18, timer: 0 },
      { id: "p_shotgun_2", type: "shotgun", x: w / 2, y: h - 160, respawnSec: 18, timer: 0 },
      { id: "p_assault_1", type: "assault", x: 180, y: h / 2, respawnSec: 22, timer: 0 },
      { id: "p_assault_2", type: "assault", x: w - 180, y: h / 2, respawnSec: 22, timer: 0 },
      { id: "p_sniper_1", type: "sniper", x: w / 2 - 420, y: 320, respawnSec: 28, timer: 0 },
      { id: "p_sniper_2", type: "sniper", x: w / 2 + 420, y: h - 320, respawnSec: 28, timer: 0 },
      { id: "p_rocket_1", type: "rocket", x: w / 2, y: h / 2, respawnSec: 32, timer: 0 },

      // Health kits (+40 HP)
      { id: "p_med_1", type: "medkit", x: 180, y: 180, respawnSec: 16, timer: 0 },
      { id: "p_med_2", type: "medkit", x: w - 180, y: 180, respawnSec: 16, timer: 0 },
      { id: "p_med_3", type: "medkit", x: 180, y: h - 180, respawnSec: 16, timer: 0 },
      { id: "p_med_4", type: "medkit", x: w - 180, y: h - 180, respawnSec: 16, timer: 0 },

      // Kevlar Shields (+50 Shield)
      { id: "p_shd_1", type: "shield", x: w / 2 - 320, y: h / 2 + 220, respawnSec: 20, timer: 0 },
      { id: "p_shd_2", type: "shield", x: w / 2 + 320, y: h / 2 - 220, respawnSec: 20, timer: 0 },
    ];

    // Spawn points
    const spawns = [
      { x: 160, y: 320 },
      { x: w - 160, y: 320 },
      { x: 160, y: h - 320 },
      { x: w - 160, y: h - 320 },
      { x: w / 2 - 360, y: 160 },
      { x: w / 2 + 360, y: 160 },
      { x: w / 2 - 360, y: h - 160 },
      { x: w / 2 + 360, y: h - 160 },
      { x: 340, y: h / 2 },
      { x: w - 340, y: h / 2 },
      { x: w / 2 - 200, y: h / 2 - 380 },
      { x: w / 2 + 200, y: h / 2 + 380 },
    ];

    return {
      id: "gloshaugen_arena",
      name: "Gløshaugen Arena",
      width: w,
      height: h,
      obstacles,
      barrels,
      pickups,
      spawns,
      theme: "campus",
      floorColor: "#172033",
      gridColor: "rgba(255, 255, 255, 0.04)",
      wallColor: "#334155",
      wallBorder: "#475569",
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

      // Rows of Industrial Cargo Shipping Containers
      { x: 300, y: 300, w: 220, h: 80, type: "crate" },
      { x: 300, y: 550, w: 220, h: 80, type: "crate" },
      { x: 300, y: 800, w: 220, h: 80, type: "crate" },

      { x: w - 520, y: 300, w: 220, h: 80, type: "crate" },
      { x: w - 520, y: 550, w: 220, h: 80, type: "crate" },
      { x: w - 520, y: 800, w: 220, h: 80, type: "crate" },

      { x: 300, y: h - 380, w: 220, h: 80, type: "crate" },
      { x: 300, y: h - 630, w: 220, h: 80, type: "crate" },

      { x: w - 520, y: h - 380, w: 220, h: 80, type: "crate" },
      { x: w - 520, y: h - 630, w: 220, h: 80, type: "crate" },

      // Center Launch Pad Walls
      { x: w / 2 - 350, y: h / 2 - 220, w: 180, h: 40, type: "wall" },
      { x: w / 2 + 170, y: h / 2 - 220, w: 180, h: 40, type: "wall" },
      { x: w / 2 - 350, y: h / 2 + 180, w: 180, h: 40, type: "wall" },
      { x: w / 2 + 170, y: h / 2 + 180, w: 180, h: 40, type: "wall" },

      // Heavy pillars
      { x: w / 2 - 60, y: h / 2 - 60, w: 120, h: 120, type: "pillar" },
      { x: 800, y: h / 2 - 40, w: 80, h: 80, type: "pillar" },
      { x: w - 880, y: h / 2 - 40, w: 80, h: 80, type: "pillar" },
    ];

    const barrels = [
      { id: "cb1", x: 560, y: 420, r: 18, hp: 35 },
      { id: "cb2", x: w - 560, y: 420, r: 18, hp: 35 },
      { id: "cb3", x: 560, y: h - 420, r: 18, hp: 35 },
      { id: "cb4", x: w - 560, y: h - 420, r: 18, hp: 35 },
      { id: "cb5", x: w / 2, y: h / 2 - 300, r: 18, hp: 35 },
      { id: "cb6", x: w / 2, y: h / 2 + 300, r: 18, hp: 35 },
    ];

    const pickups = [
      { id: "ch_assault_1", type: "assault", x: w / 2, y: 180, respawnSec: 22, timer: 0 },
      { id: "ch_assault_2", type: "assault", x: w / 2, y: h - 180, respawnSec: 22, timer: 0 },
      { id: "ch_shotgun_1", type: "shotgun", x: 180, y: h / 2, respawnSec: 18, timer: 0 },
      { id: "ch_shotgun_2", type: "shotgun", x: w - 180, y: h / 2, respawnSec: 18, timer: 0 },
      { id: "ch_rocket_1", type: "rocket", x: w / 2 - 180, y: h / 2, respawnSec: 35, timer: 0 },
      { id: "ch_sniper_1", type: "sniper", x: w / 2 + 180, y: h / 2, respawnSec: 30, timer: 0 },
      { id: "ch_med_1", type: "medkit", x: 650, y: 400, respawnSec: 16, timer: 0 },
      { id: "ch_med_2", type: "medkit", x: w - 650, y: h - 400, respawnSec: 16, timer: 0 },
      { id: "ch_shd_1", type: "shield", x: 650, y: h - 400, respawnSec: 20, timer: 0 },
      { id: "ch_shd_2", type: "shield", x: w - 650, y: 400, respawnSec: 20, timer: 0 },
    ];

    const spawns = [
      { x: 180, y: 200 },
      { x: w - 180, y: 200 },
      { x: 180, y: h - 200 },
      { x: w - 180, y: h - 200 },
      { x: w / 2 - 400, y: 240 },
      { x: w / 2 + 400, y: 240 },
      { x: w / 2 - 400, y: h - 240 },
      { x: w / 2 + 400, y: h - 240 },
      { x: 400, y: h / 2 },
      { x: w - 400, y: h / 2 },
    ];

    return {
      id: "cyber_hangar",
      name: "Cyber Hangar",
      width: w,
      height: h,
      obstacles,
      barrels,
      pickups,
      spawns,
      theme: "cyber",
      floorColor: "#0f172a",
      gridColor: "rgba(56, 189, 248, 0.05)",
      wallColor: "#1e293b",
      wallBorder: "#0284c7",
    };
  }

  // =========================================================================
  // AUDIO SYNTHESIZER (PROCEDURAL WEB AUDIO API)
  // =========================================================================

  let audioCtx = null;
  let soundEnabled = true;

  function initAudio() {
    if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioCtx();
    }
  }

  function playTone(freq, duration, type = "sine", gainVal = 0.2, freqSlide = null) {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      if (audioCtx.state === "suspended") audioCtx.resume();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      if (freqSlide) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqSlide), audioCtx.currentTime + duration);
      }

      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  function playNoise(duration, gainVal = 0.25, lowpassFreq = null) {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      if (audioCtx.state === "suspended") audioCtx.resume();

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
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

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

  function playReloadSound() {
    playTone(400, 0.06, "square", 0.15);
    setTimeout(() => playTone(650, 0.08, "triangle", 0.2), 180);
  }

  function playDashSound() {
    playTone(320, 0.14, "sine", 0.25, 680);
    playNoise(0.12, 0.15, 1500);
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
    mode: "ffa",   // "ffa"
    subMode: "solo", // "solo" | "online"
    roomCode: null,
    playerId: null,
    playerName: localStorage.getItem("kr_player_name") || "Soldat",
    playerColor: localStorage.getItem("kr_player_color") || "#ef4444",
    playerAvatar: localStorage.getItem("ts_driver_avatar") || localStorage.getItem("ntnu_avatar_config") || "",

    isHost: false,
    roomStatus: "lobby", // "lobby" | "countdown" | "playing" | "finished"
    mapId: "gloshaugen_arena",
    currentMap: buildGloshaugenArena(),
    scoreLimit: 15,
    timeLimit: 300,
    timeRemaining: 300,
    botCount: 3,

    // Local Player Character
    player: {
      x: 400,
      y: 400,
      angle: 0,
      vx: 0,
      vy: 0,
      speed: 260,
      dashCooldown: 0,
      isDashing: false,
      dashTimer: 0,
      health: 100,
      shield: 25,
      maxHealth: 100,
      maxShield: 100,
      weapon: "pistol",
      ammo: 12,
      reserveAmmo: Infinity,
      fireTimer: 0,
      isReloading: false,
      reloadTimer: 0,
      kills: 0,
      deaths: 0,
      score: 0,
      streak: 0,
      highestStreak: 0,
      invulnerableUntil: 0,
      isDead: false,
      respawnTimer: 0,
    },

    // Opponent Real Players & AI Bots
    opponents: {},
    bots: [],

    // Active Projectiles / Bullets
    bullets: [],

    // Explosions & Particles
    particles: [],

    // Camera & Screen Shake
    camera: { x: 400, y: 400, zoom: 1.0, shake: 0 },

    // Input States
    keys: { w: false, a: false, s: false, d: false, shift: false, space: false },
    mouse: { x: 0, y: 0, worldX: 0, worldY: 0, down: false },

    // Networking
    syncTimerId: null,
    animFrameId: null,
    lastTime: 0,
    killFeed: [],
    recentEvents: [],
  };

  // =========================================================================
  // DOM ELEMENT REFERENCES
  // =========================================================================

  const el = {
    viewLobby: document.getElementById("viewLobby"),
    viewGame: document.getElementById("viewGame"),
    combatCanvas: document.getElementById("combatCanvas"),

    // Header Elements
    btnHeaderBack: document.getElementById("btnHeaderBack"),
    btnPartyHub: document.getElementById("btnPartyHub"),
    btnSoundToggle: document.getElementById("btnSoundToggle"),
    btnProfileTrigger: document.getElementById("btnProfileTrigger"),
    headerPlayerName: document.getElementById("headerPlayerName"),
    headerAvatarMini: document.getElementById("headerAvatarMini"),
    headGameStatus: document.getElementById("headGameStatus"),
    headClock: document.getElementById("headClock"),
    headTargetScore: document.getElementById("headTargetScore"),

    // Lobby Elements
    playerAvatarCanvas: document.getElementById("playerAvatarCanvas"),
    btnOpenCharacterCreator: document.getElementById("btnOpenCharacterCreator"),
    inputPlayerName: document.getElementById("inputPlayerName"),
    colorPaletteRow: document.getElementById("colorPaletteRow"),

    tabBtnSolo: document.getElementById("tabBtnSolo"),
    tabBtnHost: document.getElementById("tabBtnHost"),
    tabBtnJoin: document.getElementById("tabBtnJoin"),
    tabPaneSolo: document.getElementById("tabPaneSolo"),
    tabPaneHost: document.getElementById("tabPaneHost"),
    tabPaneJoin: document.getElementById("tabPaneJoin"),

    selectSoloMap: document.getElementById("selectSoloMap"),
    selectSoloBots: document.getElementById("selectSoloBots"),
    selectSoloScoreLimit: document.getElementById("selectSoloScoreLimit"),
    selectSoloTimeLimit: document.getElementById("selectSoloTimeLimit"),
    btnStartSolo: document.getElementById("btnStartSolo"),

    selectHostMap: document.getElementById("selectHostMap"),
    selectHostBots: document.getElementById("selectHostBots"),
    selectHostScoreLimit: document.getElementById("selectHostScoreLimit"),
    selectHostTimeLimit: document.getElementById("selectHostTimeLimit"),
    btnCreateRoom: document.getElementById("btnCreateRoom"),

    inputJoinRoomCode: document.getElementById("inputJoinRoomCode"),
    btnJoinRoom: document.getElementById("btnJoinRoom"),

    // In-game Standby Overlay
    inGameStandby: document.getElementById("inGameStandby"),
    standbyMapBadge: document.getElementById("standbyMapBadge"),
    standbyRoomCodePill: document.getElementById("standbyRoomCodePill"),
    standbyRoomCodeText: document.getElementById("standbyRoomCodeText"),
    standbyWaitingText: document.getElementById("standbyWaitingText"),
    standbyPlayersList: document.getElementById("standbyPlayersList"),
    btnToggleReady: document.getElementById("btnToggleReady"),
    btnHostForceStart: document.getElementById("btnHostForceStart"),
    btnLeaveGame: document.getElementById("btnLeaveGame"),

    // In-game HUD
    hudRankPill: document.getElementById("hudRankPill"),
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
    dashBarFill: document.getElementById("dashBarFill"),
    weaponHudIcon: document.getElementById("weaponHudIcon"),
    weaponHudName: document.getElementById("weaponHudName"),
    weaponHudType: document.getElementById("weaponHudType"),
    ammoCurrent: document.getElementById("ammoCurrent"),
    ammoReserve: document.getElementById("ammoReserve"),
    reloadPrompt: document.getElementById("reloadPrompt"),
    reloadProgressBar: document.getElementById("reloadProgressBar"),
    reloadBarFill: document.getElementById("reloadBarFill"),
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
    btnPodiumPlayAgain: document.getElementById("btnPodiumPlayAgain"),
    btnPodiumReturnLobby: document.getElementById("btnPodiumReturnLobby"),
  };

  // =========================================================================
  // CHARACTER PROFILE RENDERING
  // =========================================================================

  function renderAvatarToCanvas(canvas, avatarStr, colorHex) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const cw = canvas.width;
    const ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    if (window.CharacterCreator && typeof CharacterCreator.renderAvatarToCanvas === "function") {
      try {
        const rendered = CharacterCreator.renderAvatarToCanvas(canvas, avatarStr);
        if (rendered) return;
      } catch (e) {}
    }

    // High quality tactical circular soldier preview
    ctx.save();
    ctx.translate(cw / 2, ch / 2);

    // Torso armor
    ctx.fillStyle = colorHex || "#ef4444";
    ctx.beginPath();
    ctx.ellipse(0, 10, 24, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    // Helmet / Head
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(0, -6, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = colorHex || "#ef4444";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Tactical Visor / Eyes
    ctx.fillStyle = "#38bdf8";
    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur = 8;
    ctx.fillRect(-10, -8, 20, 6);
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  function updateProfileUI() {
    if (el.headerPlayerName) el.headerPlayerName.textContent = state.playerName;
    if (el.inputPlayerName) el.inputPlayerName.value = state.playerName;

    renderAvatarToCanvas(el.playerAvatarCanvas, state.playerAvatar, state.playerColor);
    renderAvatarToCanvas(el.headerAvatarMini, state.playerAvatar, state.playerColor);
  }

  function initPaletteSwatches() {
    if (!el.colorPaletteRow) return;
    el.colorPaletteRow.innerHTML = "";
    PALETTE.forEach(item => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "color-dot-btn" + (item.color.toLowerCase() === state.playerColor.toLowerCase() ? " active" : "");
      btn.style.backgroundColor = item.color;
      btn.style.color = item.color;
      btn.title = item.name;
      btn.addEventListener("click", () => {
        el.colorPaletteRow.querySelectorAll(".color-dot-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.playerColor = item.color;
        localStorage.setItem("kr_player_color", item.color);
        updateProfileUI();

        if (state.subMode === "online" && state.roomCode && state.playerId) {
          fetch("/api/kuleregn/color", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomCode: state.roomCode, playerId: state.playerId, color: item.color }),
          }).catch(() => {});
        }
      });
      el.colorPaletteRow.appendChild(btn);
    });
  }

  // =========================================================================
  // VIEW SWITCHER
  // =========================================================================

  function showView(viewName) {
    state.view = viewName;
    if (viewName === "lobby") {
      el.viewLobby.classList.remove("hidden");
      el.viewGame.classList.add("hidden");
      el.headGameStatus.classList.add("hidden");
      stopSimulation();
      stopRoomSync();
    } else if (viewName === "game") {
      el.viewLobby.classList.add("hidden");
      el.viewGame.classList.remove("hidden");
      el.headGameStatus.classList.remove("hidden");
      resizeCanvas();
    }
  }

  function showTab(tabId) {
    [el.tabBtnSolo, el.tabBtnHost, el.tabBtnJoin].forEach(b => b && b.classList.remove("active"));
    [el.tabPaneSolo, el.tabPaneHost, el.tabPaneJoin].forEach(p => p && p.classList.remove("active"));

    if (tabId === "solo") {
      el.tabBtnSolo.classList.add("active");
      el.tabPaneSolo.classList.add("active");
    } else if (tabId === "host") {
      el.tabBtnHost.classList.add("active");
      el.tabPaneHost.classList.add("active");
    } else if (tabId === "join") {
      el.tabBtnJoin.classList.add("active");
      el.tabPaneJoin.classList.add("active");
      if (el.inputJoinRoomCode) el.inputJoinRoomCode.focus();
    }
  }

  // =========================================================================
  // BOT SIMULATION LOGIC
  // =========================================================================

  const BOT_NAMES = [
    "Bot Ola", "Bot Kari", "Bot Markus", "Bot Ingrid",
    "Bot Henrik", "Bot Silje", "Bot Jonas", "Bot Astrid",
  ];

  function createBot(slotIndex, map) {
    const spawn = map.spawns[slotIndex % map.spawns.length];
    const pal = PALETTE[(slotIndex + 3) % PALETTE.length];
    return {
      id: `bot_${slotIndex + 1}`,
      name: BOT_NAMES[slotIndex % BOT_NAMES.length],
      color: pal.color,
      avatar: "",
      isBot: true,
      x: spawn.x + (Math.random() * 40 - 20),
      y: spawn.y + (Math.random() * 40 - 20),
      angle: Math.random() * Math.PI * 2,
      vx: 0,
      vy: 0,
      speed: 245,
      health: 100,
      shield: 25,
      maxHealth: 100,
      maxShield: 100,
      weapon: "pistol",
      ammo: 12,
      fireTimer: 0,
      isReloading: false,
      kills: 0,
      deaths: 0,
      score: 0,
      streak: 0,
      invulnerableUntil: 0,
      isDead: false,
      respawnTimer: 0,
      state: "patrol", // "patrol" | "combat" | "seek_item"
      targetX: spawn.x,
      targetY: spawn.y,
      aiReactionTimer: Math.random() * 0.4,
      aiStrafeDir: Math.random() < 0.5 ? 1 : -1,
      aiStrafeTimer: 0,
    };
  }

  function spawnPlayerOrBot(combatant, map) {
    const spawn = map.spawns[Math.floor(Math.random() * map.spawns.length)];
    combatant.x = spawn.x + (Math.random() * 30 - 15);
    combatant.y = spawn.y + (Math.random() * 30 - 15);
    combatant.vx = 0;
    combatant.vy = 0;
    combatant.health = combatant.maxHealth || 100;
    combatant.shield = 25;
    combatant.isDead = false;
    combatant.respawnTimer = 0;
    combatant.weapon = "pistol";
    combatant.ammo = WEAPONS.pistol.magSize;
    combatant.isReloading = false;
    combatant.invulnerableUntil = performance.now() + 2500; // 2.5s spawn shield
  }

  function updateBotAI(bot, dt, allTargets, map) {
    if (bot.isDead) {
      bot.respawnTimer -= dt;
      if (bot.respawnTimer <= 0) {
        spawnPlayerOrBot(bot, map);
      }
      return;
    }

    bot.aiReactionTimer -= dt;
    bot.aiStrafeTimer -= dt;

    if (bot.aiStrafeTimer <= 0) {
      bot.aiStrafeTimer = 0.8 + Math.random() * 1.2;
      bot.aiStrafeDir = Math.random() < 0.5 ? 1 : -1;
    }

    // 1. Target acquisition: find nearest visible enemy combatant
    let nearestTarget = null;
    let nearestDist = 950;

    for (const t of allTargets) {
      if (t.id === bot.id || t.isDead) continue;
      const dist = Math.hypot(t.x - bot.x, t.y - bot.y);
      if (dist < nearestDist) {
        // Line-of-sight check against arena obstacles
        if (!hasLineOfSightObstacle(bot.x, bot.y, t.x, t.y, map.obstacles)) {
          nearestDist = dist;
          nearestTarget = t;
        }
      }
    }

    // 2. Seeking medkits/shields when low on health
    if (bot.health < 45) {
      const activeMedkit = map.pickups.find(p => p.type === "medkit" && p.timer <= 0);
      if (activeMedkit) {
        const medDist = Math.hypot(activeMedkit.x - bot.x, activeMedkit.y - bot.y);
        if (medDist < 600) {
          bot.targetX = activeMedkit.x;
          bot.targetY = activeMedkit.y;
          bot.state = "seek_item";
        }
      }
    }

    // 3. State execution
    if (nearestTarget && bot.state !== "seek_item") {
      bot.state = "combat";
      // Aim towards target with slight human spread
      const targetAngle = Math.atan2(nearestTarget.y - bot.y, nearestTarget.x - bot.x);
      let diff = targetAngle - bot.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      bot.angle += diff * Math.min(1.0, 10 * dt);

      // Strafe and maintain optimal range (250-450px)
      const optimalRange = bot.weapon === "shotgun" ? 180 : 360;
      let moveAngle = targetAngle;
      if (nearestDist < optimalRange * 0.7) {
        moveAngle += Math.PI; // back up
      } else if (nearestDist > optimalRange * 1.3) {
        moveAngle = targetAngle; // close in
      } else {
        moveAngle += (Math.PI / 2) * bot.aiStrafeDir; // strafe sideways!
      }

      bot.vx = Math.cos(moveAngle) * bot.speed;
      bot.vy = Math.sin(moveAngle) * bot.speed;

      // Fire weapon
      if (Math.abs(diff) < 0.35 && bot.aiReactionTimer <= 0) {
        botFireWeapon(bot);
      }
    } else {
      // Patrol wander
      if (Math.hypot(bot.targetX - bot.x, bot.targetY - bot.y) < 60 || Math.random() < 0.01) {
        const randSpawn = map.spawns[Math.floor(Math.random() * map.spawns.length)];
        bot.targetX = randSpawn.x;
        bot.targetY = randSpawn.y;
      }
      const wanderAngle = Math.atan2(bot.targetY - bot.y, bot.targetX - bot.x);
      bot.angle += (wanderAngle - bot.angle) * Math.min(1.0, 6 * dt);
      bot.vx = Math.cos(wanderAngle) * (bot.speed * 0.75);
      bot.vy = Math.sin(wanderAngle) * (bot.speed * 0.75);
    }

    // Move & collide
    applyCombatantMovement(bot, map, dt);

    // Bot reload when empty
    if (bot.ammo <= 0 && !bot.isReloading) {
      botReload(bot);
    }
  }

  function botFireWeapon(bot) {
    if (bot.isReloading || bot.fireTimer > 0) return;
    const w = WEAPONS[bot.weapon] || WEAPONS.pistol;

    if (bot.ammo <= 0) {
      botReload(bot);
      return;
    }

    bot.ammo--;
    bot.fireTimer = w.fireRate;

    // Fire bullets
    const barrelX = bot.x + Math.cos(bot.angle) * w.length;
    const barrelY = bot.y + Math.sin(bot.angle) * w.length;

    for (let i = 0; i < w.bulletCount; i++) {
      const spreadAngle = (Math.random() - 0.5) * w.spread;
      const bAngle = bot.angle + spreadAngle;
      state.bullets.push({
        id: `b_${Date.now()}_${Math.random()}`,
        ownerId: bot.id,
        ownerName: bot.name,
        ownerColor: bot.color,
        weapon: bot.weapon,
        x: barrelX,
        y: barrelY,
        vx: Math.cos(bAngle) * w.bulletSpeed,
        vy: Math.sin(bAngle) * w.bulletSpeed,
        damage: w.damage,
        life: w.bulletLife,
        maxLife: w.bulletLife,
        color: w.color,
        isRocket: bot.weapon === "rocket",
      });
    }

    addMuzzleParticles(barrelX, barrelY, bot.angle, w.color);
    if (Math.hypot(bot.x - state.player.x, bot.y - state.player.y) < 1200) {
      playWeaponSound(bot.weapon);
    }
  }

  function botReload(bot) {
    const w = WEAPONS[bot.weapon] || WEAPONS.pistol;
    bot.isReloading = true;
    setTimeout(() => {
      bot.ammo = w.magSize;
      bot.isReloading = false;
    }, w.reloadTime * 1000);
  }

  // =========================================================================
  // PHYSICS, RAYCASTING & COLLISION
  // =========================================================================

  function hasLineOfSightObstacle(x1, y1, x2, y2, obstacles) {
    for (const obs of obstacles) {
      if (lineIntersectsRect(x1, y1, x2, y2, obs.x, obs.y, obs.w, obs.h)) {
        return true;
      }
    }
    return false;
  }

  function lineIntersectsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
    // Check 4 segment borders of rectangle
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

  function applyCombatantMovement(entity, map, dt) {
    const r = 20; // Combatant collision radius

    // Move X
    entity.x += entity.vx * dt;
    for (const obs of map.obstacles) {
      if (circleCollidesRect(entity.x, entity.y, r, obs)) {
        if (entity.vx > 0) entity.x = obs.x - r;
        else if (entity.vx < 0) entity.x = obs.x + obs.w + r;
        entity.vx = 0;
      }
    }

    // Move Y
    entity.y += entity.vy * dt;
    for (const obs of map.obstacles) {
      if (circleCollidesRect(entity.x, entity.y, r, obs)) {
        if (entity.vy > 0) entity.y = obs.y - r;
        else if (entity.vy < 0) entity.y = obs.y + obs.h + r;
        entity.vy = 0;
      }
    }

    // Keep firmly inside map bounds
    entity.x = Math.max(r + 40, Math.min(map.width - r - 40, entity.x));
    entity.y = Math.max(r + 40, Math.min(map.height - r - 40, entity.y));
  }

  function circleCollidesRect(cx, cy, cr, rect) {
    const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
    const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) < (cr * cr);
  }

  // =========================================================================
  // COMBAT & DAMAGE REGISTRATION
  // =========================================================================

  function damageCombatant(victim, damage, killer, weaponId) {
    if (victim.isDead) return;
    const now = performance.now();
    if (victim.invulnerableUntil && now < victim.invulnerableUntil) return;

    // Shield absorbs damage first
    let remaining = damage;
    if (victim.shield > 0) {
      if (victim.shield >= remaining) {
        victim.shield -= remaining;
        remaining = 0;
      } else {
        remaining -= victim.shield;
        victim.shield = 0;
      }
    }

    victim.health = Math.max(0, victim.health - remaining);
    addDamageSparks(victim.x, victim.y, victim.color);

    if (victim === state.player) {
      state.camera.shake = Math.min(18, state.camera.shake + 6);
      playTone(160, 0.1, "sawtooth", 0.35);
      showDamageFeedback();
    } else if (killer === state.player) {
      playHitConfirmation();
    }

    // Check Death
    if (victim.health <= 0) {
      victim.isDead = true;
      victim.deaths++;
      victim.streak = 0;
      victim.respawnTimer = 2.5;

      addDeathExplosion(victim.x, victim.y, victim.color);

      if (killer) {
        killer.kills++;
        killer.score += 100;
        killer.streak++;
        if (killer.streak > killer.highestStreak) killer.highestStreak = killer.streak;

        if (killer === state.player) {
          playKillFanfare();
          state.camera.shake = 10;
          if (killer.streak >= 3) {
            triggerStreakBanner(killer.streak);
          }
        }
      }

      // Add to kill feed
      addKillFeedItem({
        killerName: killer ? killer.name : "Omgivelse",
        killerColor: killer ? killer.color : "#94a3b8",
        victimName: victim.name,
        victimColor: victim.color,
        weapon: weaponId || "pistol",
      });

      // Check Match End Condition
      checkMatchVictory();
    }
  }

  function addKillFeedItem(item) {
    state.killFeed.push(item);
    if (state.killFeed.length > 6) state.killFeed.shift();

    if (!el.killFeedContainer) return;
    const div = document.createElement("div");
    div.className = "kill-feed-item";
    const wSpec = WEAPONS[item.weapon] || WEAPONS.pistol;
    div.innerHTML = `
      <span class="kfi-killer" style="color:${item.killerColor}">${escapeHtml(item.killerName)}</span>
      <span class="kfi-weapon-icon">${wSpec.icon}</span>
      <span class="kfi-victim" style="color:${item.victimColor}">${escapeHtml(item.victimName)}</span>
    `;
    el.killFeedContainer.appendChild(div);
    setTimeout(() => {
      div.style.transition = "opacity 0.4s ease, transform 0.4s ease";
      div.style.opacity = "0";
      div.style.transform = "translateX(20px)";
      setTimeout(() => div.remove(), 400);
    }, 4500);
  }

  function triggerStreakBanner(count) {
    if (!el.hudStreakBanner) return;
    el.hudStreakCount.textContent = `${count}x`;
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

    const allCombatants = [state.player, ...state.bots, ...Object.values(state.opponents)];
    const topCombatant = allCombatants.slice().sort((a, b) => b.kills - a.kills)[0];

    if (topCombatant && topCombatant.kills >= state.scoreLimit) {
      endMatch(topCombatant);
    }
  }

  function endMatch(winner) {
    state.roomStatus = "finished";
    playTone(523, 0.25, "triangle", 0.4);
    setTimeout(() => playTone(659, 0.35, "triangle", 0.45), 250);
    setTimeout(() => playTone(784, 0.6, "triangle", 0.5), 550);

    // 3.5s finish delay before showing victory podium
    setTimeout(() => {
      showVictoryPodium(winner);
    }, 3500);
  }

  function showVictoryPodium(winner) {
    stopSimulation();
    stopRoomSync();

    const all = [state.player, ...state.bots, ...Object.values(state.opponents)];
    all.sort((a, b) => {
      if (b.kills !== a.kills) return b.kills - a.kills;
      return a.deaths - b.deaths;
    });

    if (el.podiumTitle) {
      el.podiumTitle.textContent = winner === state.player ? "DU VANT KAMPEN! 🏆" : `${winner.name} VANT! 🥇`;
    }
    if (el.podiumDesc) {
      el.podiumDesc.textContent = `Første soldat til å nå ${state.scoreLimit} eliminasjoner i Free-For-All!`;
    }

    if (el.podiumStandings) {
      el.podiumStandings.innerHTML = "";
      all.forEach((c, idx) => {
        const row = document.createElement("div");
        row.className = `podium-row rank-${idx + 1}` + (c === state.player ? " is-me" : "");
        row.innerHTML = `
          <div style="display:flex;align-items:center;gap:0.75rem;">
            <strong style="font-size:1.1rem;color:${idx === 0 ? '#fbbf24' : idx === 1 ? '#cbd5e1' : idx === 2 ? '#d97706' : '#64748b'};">${idx + 1}.</strong>
            <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${c.color};"></span>
            <span style="font-weight:800;color:#fff;">${escapeHtml(c.name)}${c === state.player ? ' (Deg)' : ''}</span>
          </div>
          <div style="display:flex;align-items:center;gap:1.25rem;">
            <span style="color:#34d399;font-weight:800;">${c.kills} drap</span>
            <span style="color:#f87171;font-weight:700;">${c.deaths} død</span>
            <span style="color:#fbbf24;font-weight:900;">${c.score} p</span>
          </div>
        `;
        el.podiumStandings.appendChild(row);
      });
    }

    if (el.modalPodium) el.modalPodium.classList.remove("hidden");
  }

  // =========================================================================
  // PARTICLES & SPECIAL EFFECTS
  // =========================================================================

  function addMuzzleParticles(x, y, angle, color) {
    for (let i = 0; i < 6; i++) {
      const spd = 60 + Math.random() * 120;
      const spread = (Math.random() - 0.5) * 0.6;
      state.particles.push({
        x, y,
        vx: Math.cos(angle + spread) * spd,
        vy: Math.sin(angle + spread) * spd,
        life: 0.12 + Math.random() * 0.08,
        maxLife: 0.2,
        size: 3 + Math.random() * 2,
        color: color || "#fde047",
      });
    }
  }

  function addDamageSparks(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 50 + Math.random() * 160;
      state.particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.2 + Math.random() * 0.15,
        maxLife: 0.35,
        size: 2.5 + Math.random() * 2.5,
        color: color || "#ef4444",
      });
    }
  }

  function addDeathExplosion(x, y, color) {
    for (let i = 0; i < 24; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 80 + Math.random() * 240;
      state.particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.35 + Math.random() * 0.3,
        maxLife: 0.65,
        size: 4 + Math.random() * 4,
        color: i % 2 === 0 ? color : "#fb923c",
      });
    }
  }

  function addRocketBlast(x, y) {
    playExplosionSound();
    state.camera.shake = Math.min(22, state.camera.shake + 14);

    for (let i = 0; i < 35; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 90 + Math.random() * 320;
      state.particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
        size: 5 + Math.random() * 6,
        color: i % 3 === 0 ? "#ef4444" : i % 3 === 1 ? "#f97316" : "#fbbf24",
      });
    }
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.85, dt * 60);
      p.vy *= Math.pow(0.85, dt * 60);
    }
  }

  // =========================================================================
  // USER INPUT & INTERACTION
  // =========================================================================

  function initInputHandlers() {
    window.addEventListener("keydown", (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      const k = e.key.toLowerCase();

      if (k === "w" || e.key === "ArrowUp") state.keys.w = true;
      if (k === "a" || e.key === "ArrowLeft") state.keys.a = true;
      if (k === "s" || e.key === "ArrowDown") state.keys.s = true;
      if (k === "d" || e.key === "ArrowRight") state.keys.d = true;
      if (e.key === "Shift" || k === " ") {
        state.keys.space = true;
        triggerTacticalDash();
      }
      if (k === "r") {
        reloadPlayerWeapon();
      }
      if (e.key === "Tab") {
        e.preventDefault();
        if (el.scoreboardModal) el.scoreboardModal.classList.remove("hidden");
        updateScoreboardTable();
      }
    });

    window.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      if (k === "w" || e.key === "ArrowUp") state.keys.w = false;
      if (k === "a" || e.key === "ArrowLeft") state.keys.a = false;
      if (k === "s" || e.key === "ArrowDown") state.keys.s = false;
      if (k === "d" || e.key === "ArrowRight") state.keys.d = false;
      if (e.key === "Shift" || k === " ") state.keys.space = false;
      if (e.key === "Tab") {
        if (el.scoreboardModal) el.scoreboardModal.classList.add("hidden");
      }
    });

    window.addEventListener("mousemove", (e) => {
      state.mouse.x = e.clientX;
      state.mouse.y = e.clientY;
    });

    window.addEventListener("mousedown", (e) => {
      if (state.view !== "game") return;
      if (e.button === 0) {
        state.mouse.down = true;
      }
    });

    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) {
        state.mouse.down = false;
      }
    });

    // Touch Support for Mobile Aiming / Shooting
    const canvas = el.combatCanvas;
    if (canvas) {
      canvas.addEventListener("touchstart", (e) => {
        if (e.touches.length > 0) {
          state.mouse.down = true;
          state.mouse.x = e.touches[0].clientX;
          state.mouse.y = e.touches[0].clientY;
        }
      }, { passive: false });
      canvas.addEventListener("touchmove", (e) => {
        if (e.touches.length > 0) {
          state.mouse.x = e.touches[0].clientX;
          state.mouse.y = e.touches[0].clientY;
        }
      }, { passive: false });
      canvas.addEventListener("touchend", () => {
        state.mouse.down = false;
      });
    }
  }

  function triggerTacticalDash() {
    const p = state.player;
    if (p.isDead || p.dashCooldown > 0) return;

    let dx = (state.keys.d ? 1 : 0) - (state.keys.a ? 1 : 0);
    let dy = (state.keys.s ? 1 : 0) - (state.keys.w ? 1 : 0);
    if (dx === 0 && dy === 0) {
      // Dash towards aim direction if not pressing movement keys
      dx = Math.cos(p.angle);
      dy = Math.sin(p.angle);
    } else {
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
    }

    p.isDashing = true;
    p.dashTimer = 0.22;
    p.dashCooldown = 2.2; // 2.2s cooldown
    p.vx = dx * 680;
    p.vy = dy * 680;

    playDashSound();
    for (let i = 0; i < 8; i++) {
      state.particles.push({
        x: p.x, y: p.y,
        vx: -dx * 80 + (Math.random() - 0.5) * 60,
        vy: -dy * 80 + (Math.random() - 0.5) * 60,
        life: 0.2, maxLife: 0.2, size: 4, color: "#38bdf8",
      });
    }
  }

  function firePlayerWeapon() {
    const p = state.player;
    if (p.isDead || p.isReloading || p.fireTimer > 0) return;
    const w = WEAPONS[p.weapon] || WEAPONS.pistol;

    if (p.ammo <= 0) {
      reloadPlayerWeapon();
      playTone(320, 0.04, "square", 0.15); // empty click
      return;
    }

    p.ammo--;
    p.fireTimer = w.fireRate;

    // Recoil kick on player
    p.vx -= Math.cos(p.angle) * w.recoilKick * 14;
    p.vy -= Math.sin(p.angle) * w.recoilKick * 14;
    state.camera.shake = Math.min(20, state.camera.shake + w.screenShake);

    const barrelX = p.x + Math.cos(p.angle) * w.length;
    const barrelY = p.y + Math.sin(p.angle) * w.length;

    for (let i = 0; i < w.bulletCount; i++) {
      const spreadAngle = (Math.random() - 0.5) * w.spread;
      const bAngle = p.angle + spreadAngle;
      state.bullets.push({
        id: `p_b_${Date.now()}_${Math.random()}`,
        ownerId: state.playerId || "player_local",
        ownerName: state.playerName,
        ownerColor: state.playerColor,
        weapon: p.weapon,
        x: barrelX,
        y: barrelY,
        vx: Math.cos(bAngle) * w.bulletSpeed,
        vy: Math.sin(bAngle) * w.bulletSpeed,
        damage: w.damage,
        life: w.bulletLife,
        maxLife: w.bulletLife,
        color: w.color,
        isRocket: p.weapon === "rocket",
      });
    }

    addMuzzleParticles(barrelX, barrelY, p.angle, w.color);
    playWeaponSound(p.weapon);
    updateWeaponHUD();
  }

  function reloadPlayerWeapon() {
    const p = state.player;
    const w = WEAPONS[p.weapon] || WEAPONS.pistol;
    if (p.isDead || p.isReloading || p.ammo >= w.magSize || p.reserveAmmo <= 0) return;

    p.isReloading = true;
    p.reloadTimer = w.reloadTime;
    playReloadSound();

    if (el.reloadProgressBar) el.reloadProgressBar.classList.remove("hidden");
    if (el.reloadBarFill) el.reloadBarFill.style.width = "0%";
    if (el.reloadPrompt) el.reloadPrompt.textContent = "Lader om...";
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

      // 3. Update AI Bots
      const allCombatants = [state.player, ...state.bots, ...Object.values(state.opponents)];
      for (const bot of state.bots) {
        updateBotAI(bot, dt, allCombatants, map);
      }

      // 4. Update Projectiles & Bullets
      updateBullets(dt, map, allCombatants);

      // 5. Update Pickups & Explosive Barrels
      updatePickups(dt, map, allCombatants);

      // 6. Update Particles & Screen Shake
      updateParticles(dt);
      if (state.camera.shake > 0) {
        state.camera.shake = Math.max(0, state.camera.shake - dt * 25);
      }

      // 7. Render Game Canvas
      renderArena(map);

      // 8. Update HUD Elements
      updateVitalsHUD();
    } catch (err) {
      console.error("Kuleregn loop error:", err);
    }

    state.animFrameId = requestAnimationFrame(gameLoop);
  }

  function updatePlayer(dt, map) {
    const p = state.player;

    if (p.isDead) {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0) {
        spawnPlayerOrBot(p, map);
        updateWeaponHUD();
      }
      return;
    }

    // Cooldowns
    if (p.dashCooldown > 0) {
      p.dashCooldown = Math.max(0, p.dashCooldown - dt);
      if (el.dashBarFill) {
        const pct = Math.min(100, ((2.2 - p.dashCooldown) / 2.2) * 100);
        el.dashBarFill.style.width = `${pct}%`;
      }
    }
    if (p.fireTimer > 0) p.fireTimer = Math.max(0, p.fireTimer - dt);

    // Reload Progress
    if (p.isReloading) {
      p.reloadTimer -= dt;
      const w = WEAPONS[p.weapon] || WEAPONS.pistol;
      const progress = Math.min(100, (1 - p.reloadTimer / w.reloadTime) * 100);
      if (el.reloadBarFill) el.reloadBarFill.style.width = `${progress}%`;

      if (p.reloadTimer <= 0) {
        const needed = w.magSize - p.ammo;
        const available = Math.min(needed, p.reserveAmmo);
        p.ammo += available;
        if (p.reserveAmmo !== Infinity) p.reserveAmmo -= available;
        p.isReloading = false;
        if (el.reloadProgressBar) el.reloadProgressBar.classList.add("hidden");
        updateWeaponHUD();
      }
    }

    // Aiming towards mouse world coordinate
    const canvas = el.combatCanvas;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const mouseScreenX = state.mouse.x - rect.left;
      const mouseScreenY = state.mouse.y - rect.top;
      state.mouse.worldX = (mouseScreenX - canvas.width / 2) / state.camera.zoom + state.camera.x;
      state.mouse.worldY = (mouseScreenY - canvas.height / 2) / state.camera.zoom + state.camera.y;
      p.angle = Math.atan2(state.mouse.worldY - p.y, state.mouse.worldX - p.x);
    }

    // Movement (WASD with normalized vector)
    if (p.isDashing) {
      p.dashTimer -= dt;
      if (p.dashTimer <= 0) {
        p.isDashing = false;
      }
    } else {
      let mx = (state.keys.d ? 1 : 0) - (state.keys.a ? 1 : 0);
      let my = (state.keys.s ? 1 : 0) - (state.keys.w ? 1 : 0);
      if (mx !== 0 && my !== 0) {
        mx *= 0.7071;
        my *= 0.7071;
      }
      p.vx = mx * p.speed;
      p.vy = my * p.speed;
    }

    applyCombatantMovement(p, map, dt);

    // Continuous weapon firing when holding mouse
    if (state.mouse.down && state.roomStatus === "playing") {
      const w = WEAPONS[p.weapon] || WEAPONS.pistol;
      if (w.isAutomatic || p.fireTimer <= 0) {
        firePlayerWeapon();
      }
    }

    // Camera follow player smoothly
    const lookahead = 75;
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

      // Rocket smoke trail
      if (b.isRocket && Math.random() < 0.6) {
        state.particles.push({
          x: b.x, y: b.y,
          vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30,
          life: 0.35, maxLife: 0.35, size: 5, color: "#64748b",
        });
      }

      // 1. Collision with Obstacle Walls
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

      // 2. Collision with Explosive Barrels
      let hitBarrel = false;
      for (const barrel of map.barrels) {
        if (barrel.hp > 0 && Math.hypot(barrel.x - b.x, barrel.y - b.y) <= barrel.r + 4) {
          hitBarrel = true;
          barrel.hp -= b.damage;
          addDamageSparks(barrel.x, barrel.y, "#ef4444");
          if (barrel.hp <= 0) {
            addRocketBlast(barrel.x, barrel.y);
            damageRadius(barrel.x, barrel.y, 180, 120, b.ownerId, "barrel", allCombatants);
          }
          break;
        }
      }
      if (hitBarrel) {
        state.bullets.splice(i, 1);
        continue;
      }

      // 3. Collision with Combatants
      let hitCombatant = false;
      for (const c of allCombatants) {
        if (c.id === b.ownerId || c.isDead) continue;
        if (Math.hypot(c.x - b.x, c.y - b.y) <= 22) {
          hitCombatant = true;
          const killer = allCombatants.find(k => k.id === b.ownerId);

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
    const attacker = allCombatants.find(a => a.id === attackerId);
    for (const c of allCombatants) {
      if (c.isDead) continue;
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
    for (const p of map.pickups) {
      if (p.timer > 0) {
        p.timer = Math.max(0, p.timer - dt);
        continue;
      }

      // Check pickup collection
      for (const c of allCombatants) {
        if (c.isDead) continue;
        if (Math.hypot(c.x - p.x, c.y - p.y) <= 32) {
          let collected = false;

          if (p.type === "medkit") {
            if (c.health < c.maxHealth) {
              c.health = Math.min(c.maxHealth, c.health + 40);
              collected = true;
              if (c === state.player) showPickupToast("❤️ +40 Helse!");
            }
          } else if (p.type === "shield") {
            if (c.shield < c.maxShield) {
              c.shield = Math.min(c.maxShield, c.shield + 50);
              collected = true;
              if (c === state.player) showPickupToast("🛡️ +50 Kevlar Skjold!");
            }
          } else if (WEAPONS[p.type]) {
            // Weapon crate pickup
            const newW = WEAPONS[p.type];
            c.weapon = p.type;
            c.ammo = newW.magSize;
            c.reserveAmmo = newW.ammoReserve;
            c.isReloading = false;
            collected = true;
            if (c === state.player) {
              showPickupToast(`${newW.icon} Plukket opp ${newW.name}!`);
              updateWeaponHUD();
            }
          }

          if (collected) {
            p.timer = p.respawnSec;
            playPickupSound(p.type);
            addMuzzleParticles(p.x, p.y, 0, "#10b981");
            break;
          }
        }
      }
    }
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
  // ARENA RENDERING
  // =========================================================================

  function renderArena(map) {
    const canvas = el.combatCanvas;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;
    const ctx = canvas.getContext("2d");
    const cw = canvas.width;
    const ch = canvas.height;

    ctx.clearRect(0, 0, cw, ch);

    ctx.save();
    // Camera transform with screen shake
    ctx.translate(cw / 2, ch / 2);
    ctx.scale(state.camera.zoom, state.camera.zoom);

    const shakeX = (Math.random() - 0.5) * state.camera.shake;
    const shakeY = (Math.random() - 0.5) * state.camera.shake;
    ctx.translate(-state.camera.x + shakeX, -state.camera.y + shakeY);

    // 1. Arena Floor & Tactical Grid
    ctx.fillStyle = map.floorColor;
    ctx.fillRect(0, 0, map.width, map.height);

    ctx.strokeStyle = map.gridColor;
    ctx.lineWidth = 1;
    const gridStep = 80;
    ctx.beginPath();
    for (let x = 0; x <= map.width; x += gridStep) {
      ctx.moveTo(x, 0); ctx.lineTo(x, map.height);
    }
    for (let y = 0; y <= map.height; y += gridStep) {
      ctx.moveTo(0, y); ctx.lineTo(map.width, y);
    }
    ctx.stroke();

    // 2. Pickups (Floating weapon icons & Medkits)
    const timeNow = performance.now() / 1000;
    for (const p of map.pickups) {
      if (p.timer > 0) continue;
      const bob = Math.sin(timeNow * 4 + p.x) * 4;

      ctx.save();
      ctx.translate(p.x, p.y + bob);

      // Rotating glow circle
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fillStyle = p.type === "medkit" ? "rgba(34, 197, 94, 0.2)" : p.type === "shield" ? "rgba(6, 182, 212, 0.2)" : "rgba(251, 191, 36, 0.2)";
      ctx.fill();
      ctx.strokeStyle = p.type === "medkit" ? "#22c55e" : p.type === "shield" ? "#06b6d4" : "#fbbf24";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Icon
      ctx.font = "20px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const icon = p.type === "medkit" ? "❤️" : p.type === "shield" ? "🛡️" : (WEAPONS[p.type] ? WEAPONS[p.type].icon : "📦");
      ctx.fillText(icon, 0, 0);
      ctx.restore();
    }

    // 3. Obstacles (Walls, Crates, Pillars)
    for (const obs of map.obstacles) {
      ctx.save();
      if (obs.type === "wall") {
        ctx.fillStyle = map.wallColor;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = map.wallBorder;
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      } else if (obs.type === "crate") {
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        // Diagonal crate reinforcement cross
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y); ctx.lineTo(obs.x + obs.w, obs.y + obs.h);
        ctx.moveTo(obs.x + obs.w, obs.y); ctx.lineTo(obs.x, obs.y + obs.h);
        ctx.stroke();
      } else if (obs.type === "pillar") {
        ctx.fillStyle = "#334155";
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 3;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      }
      ctx.restore();
    }

    // 4. Explosive Barrels
    for (const barrel of map.barrels) {
      if (barrel.hp <= 0) continue;
      ctx.save();
      ctx.translate(barrel.x, barrel.y);
      ctx.beginPath();
      ctx.arc(0, 0, barrel.r, 0, Math.PI * 2);
      ctx.fillStyle = "#dc2626";
      ctx.fill();
      ctx.strokeStyle = "#fca5a5";
      ctx.lineWidth = 2;
      ctx.stroke();
      // Hazard symbol
      ctx.fillStyle = "#ffffff";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("☣", 0, 0);
      ctx.restore();
    }

    // 5. Active Bullets
    for (const b of state.bullets) {
      ctx.save();
      ctx.strokeStyle = b.color || "#fde047";
      ctx.lineWidth = b.isRocket ? 5 : 3;
      ctx.shadowColor = b.color || "#fde047";
      ctx.shadowBlur = b.isRocket ? 12 : 6;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - (b.vx * 0.04), b.y - (b.vy * 0.04));
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // 6. Particles
    for (const p of state.particles) {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 7. Render Combatants (Bots & Opponents first, Player on top)
    for (const bot of state.bots) {
      if (!bot.isDead) drawCombatant(ctx, bot);
    }
    for (const opp of Object.values(state.opponents)) {
      if (!opp.isDead) drawCombatant(ctx, opp);
    }
    if (!state.player.isDead) {
      drawCombatant(ctx, state.player, true);
    }

    ctx.restore();

    // 8. Custom In-Canvas Crosshair at Mouse Location
    drawInteractiveCrosshair(ctx, state.mouse.x, state.mouse.y);
  }

  function drawCombatant(ctx, c, isMe = false) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);

    const now = performance.now();
    const isInvuln = c.invulnerableUntil && now < c.invulnerableUntil;

    // Invulnerability forcefield bubble
    if (isInvuln) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(56, 189, 248, 0.25)";
      ctx.fill();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }

    // Weapon Barrel & Hands
    const w = WEAPONS[c.weapon] || WEAPONS.pistol;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(8, -w.barrelWidth / 2, w.length, w.barrelWidth);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(8, -w.barrelWidth / 2, w.length, w.barrelWidth);

    // Sniper Laser Sight (when aiming sniper)
    if (c.weapon === "sniper") {
      ctx.save();
      ctx.strokeStyle = isMe ? "rgba(244, 63, 94, 0.55)" : "rgba(239, 68, 68, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(w.length + 8, 0);
      ctx.lineTo(w.length + 650, 0);
      ctx.stroke();
      ctx.restore();
    }

    // Hands holding weapon
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.arc(14, -10, 6, 0, Math.PI * 2);
    ctx.arc(20, 6, 6, 0, Math.PI * 2);
    ctx.fill();

    // Soldier Body Armor (Circular torso)
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fillStyle = c.color;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = isMe ? "#ffffff" : "rgba(0,0,0,0.4)";
    ctx.stroke();

    // Helmet / Head
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fillStyle = "#0f172a";
    ctx.fill();

    // Visor / Eyes pointing forward
    ctx.fillStyle = isMe ? "#38bdf8" : "#fbbf24";
    ctx.fillRect(5, -4, 6, 8);

    ctx.restore();

    // Overhead Name & Vitals Bar (Unrotated)
    ctx.save();
    ctx.translate(c.x, c.y - 36);

    // Name Tag
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = isMe ? "#fde047" : "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 4;
    ctx.fillText(c.name, 0, -4);
    ctx.shadowBlur = 0;

    // Mini Health & Shield Bars
    const barW = 38;
    const barH = 5;
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(-barW / 2, 0, barW, barH);

    const hpPct = Math.max(0, c.health / 100);
    ctx.fillStyle = hpPct > 0.4 ? "#22c55e" : "#ef4444";
    ctx.fillRect(-barW / 2, 0, barW * hpPct, barH);

    // Shield Bar (on top of HP bar if shield exists)
    if (c.shield > 0) {
      const shdPct = Math.max(0, c.shield / 100);
      ctx.fillStyle = "#06b6d4";
      ctx.fillRect(-barW / 2, -3, barW * shdPct, 2.5);
    }

    ctx.restore();
  }

  function drawInteractiveCrosshair(ctx, mx, my) {
    ctx.save();
    const p = state.player;
    const w = WEAPONS[p.weapon] || WEAPONS.pistol;
    const spreadOffset = 10 + (p.isDashing ? 12 : Math.hypot(p.vx, p.vy) > 20 ? 6 : 0);

    ctx.strokeStyle = p.health < 35 ? "#ef4444" : "#38bdf8";
    ctx.lineWidth = 2;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 6;

    // Center dot
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // 4 reticle lines
    ctx.beginPath();
    ctx.moveTo(mx - spreadOffset - 8, my); ctx.lineTo(mx - spreadOffset, my);
    ctx.moveTo(mx + spreadOffset, my); ctx.lineTo(mx + spreadOffset + 8, my);
    ctx.moveTo(mx, my - spreadOffset - 8); ctx.lineTo(mx, my - spreadOffset);
    ctx.moveTo(mx, my + spreadOffset); ctx.lineTo(mx, my + spreadOffset + 8);
    ctx.stroke();

    ctx.restore();
  }

  // =========================================================================
  // HUD UPDATES
  // =========================================================================

  function updateVitalsHUD() {
    const p = state.player;
    if (el.vitalHealthNum) el.vitalHealthNum.textContent = String(Math.round(p.health));
    if (el.vitalShieldNum) el.vitalShieldNum.textContent = String(Math.round(p.shield));

    if (el.vitalHealthFill) {
      el.vitalHealthFill.style.width = `${Math.max(0, Math.min(100, p.health))}%`;
      el.vitalHealthFill.classList.toggle("low-hp", p.health < 35);
    }
    if (el.vitalShieldFill) {
      el.vitalShieldFill.style.width = `${Math.max(0, Math.min(100, p.shield))}%`;
    }

    // Rank & Kills
    const all = [state.player, ...state.bots, ...Object.values(state.opponents)];
    all.sort((a, b) => b.kills - a.kills);
    const myRank = all.findIndex(c => c === state.player) + 1;
    if (el.hudPosNum) el.hudPosNum.textContent = `${myRank}.`;
    if (el.hudKillsText) el.hudKillsText.textContent = `${p.kills}/${state.scoreLimit} drap`;
  }

  function updateWeaponHUD() {
    const p = state.player;
    const w = WEAPONS[p.weapon] || WEAPONS.pistol;

    if (el.weaponHudIcon) el.weaponHudIcon.textContent = w.icon;
    if (el.weaponHudName) el.weaponHudName.textContent = w.name;
    if (el.weaponHudType) el.weaponHudType.textContent = w.type;
    if (el.ammoCurrent) el.ammoCurrent.textContent = String(p.ammo);
    if (el.ammoReserve) el.ammoReserve.textContent = p.reserveAmmo === Infinity ? "∞" : String(p.reserveAmmo);
    if (el.reloadPrompt) {
      el.reloadPrompt.textContent = p.ammo === 0 ? "TOMT! Trykk [R]" : "Trykk [R] for å lade";
    }
  }

  function updateScoreboardTable() {
    if (!el.scoreboardBody) return;
    el.scoreboardBody.innerHTML = "";

    const all = [state.player, ...state.bots, ...Object.values(state.opponents)];
    all.sort((a, b) => {
      if (b.kills !== a.kills) return b.kills - a.kills;
      return a.deaths - b.deaths;
    });

    all.forEach((c, idx) => {
      const kd = c.deaths > 0 ? (c.kills / c.deaths).toFixed(1) : c.kills.toFixed(1);
      const tr = document.createElement("tr");
      if (c === state.player) tr.className = "is-me";
      tr.innerHTML = `
        <td class="col-rank">${idx + 1}</td>
        <td class="col-name" style="display:flex;align-items:center;gap:0.4rem;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.color};"></span>
          <span>${escapeHtml(c.name)}${c === state.player ? ' (Deg)' : ''}</span>
        </td>
        <td class="col-kills">${c.kills}</td>
        <td class="col-deaths">${c.deaths}</td>
        <td class="col-kd">${kd}</td>
        <td class="col-score">${c.score}</td>
      `;
      el.scoreboardBody.appendChild(tr);
    });
  }

  // =========================================================================
  // MULTIPLAYER NETWORKING & ROOM SYNC
  // =========================================================================

  async function syncTelemetryWithServer() {
    if (!state.roomCode || !state.playerId || state.roomStatus === "lobby") return;

    try {
      const payload = {
        roomCode: state.roomCode,
        playerId: state.playerId,
        telemetry: {
          x: state.player.x,
          y: state.player.y,
          angle: state.player.angle,
          vx: state.player.vx,
          vy: state.player.vy,
          speed: state.player.speed,
          weapon: state.player.weapon,
          health: state.player.health,
          shield: state.player.shield,
          isReloading: state.player.isReloading,
        },
      };

      // Host also uploads simulated bots state
      if (state.isHost && state.bots.length > 0) {
        payload.telemetry.bots = state.bots.map(b => ({
          id: b.id,
          name: b.name,
          color: b.color,
          x: b.x,
          y: b.y,
          angle: b.angle,
          vx: b.vx,
          vy: b.vy,
          speed: b.speed,
          weapon: b.weapon,
          health: b.health,
          shield: b.shield,
          kills: b.kills,
          deaths: b.deaths,
          score: b.score,
        }));
      }

      const resp = await fetch("/api/kuleregn/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      el.countdownText.textContent = rem > 0 ? String(rem) : "KJEMP! 💥";
    } else if (data.status === "playing") {
      if (prevStatus === "countdown") {
        el.countdownText.textContent = "KJEMP! 💥";
        playTone(880, 0.4, "triangle", 0.35);
        setTimeout(() => el.countdownOverlay.classList.add("hidden"), 600);
      } else {
        el.countdownOverlay.classList.add("hidden");
      }
    } else if (data.status === "finished") {
      stopRoomSync();
      const winner = (data.players || [])[0];
      showVictoryPodium(winner);
    }

    // Ingest opponent players
    (data.players || []).forEach(p => {
      if (p.id !== state.playerId && !p.isBot) {
        if (!state.opponents[p.id]) {
          state.opponents[p.id] = {
            id: p.id,
            name: p.name,
            color: p.color,
            x: p.x,
            y: p.y,
            angle: p.angle,
            vx: p.vx,
            vy: p.vy,
            speed: p.speed,
            weapon: p.weapon || "pistol",
            health: p.health || 100,
            shield: p.shield || 25,
            kills: p.kills || 0,
            deaths: p.deaths || 0,
            score: p.score || 0,
            isDead: (p.health || 100) <= 0,
          };
        } else {
          const opp = state.opponents[p.id];
          opp.x += (p.x - opp.x) * 0.32;
          opp.y += (p.y - opp.y) * 0.32;
          let diff = p.angle - opp.angle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          opp.angle += diff * 0.32;
          opp.weapon = p.weapon || opp.weapon;
          opp.health = p.health;
          opp.shield = p.shield;
          opp.kills = p.kills;
          opp.deaths = p.deaths;
          opp.score = p.score;
          opp.isDead = p.health <= 0;
        }
      }
    });

    updateStandbyUI(data.players || []);
  }

  function startRoomSync() {
    stopRoomSync();
    state.syncTimerId = setInterval(syncTelemetryWithServer, 55); // 18 Hz
  }

  function stopRoomSync() {
    if (state.syncTimerId) {
      clearInterval(state.syncTimerId);
      state.syncTimerId = null;
    }
  }

  function startSimulation() {
    stopSimulation();
    state.lastTime = 0;
    state.animFrameId = requestAnimationFrame(gameLoop);
  }

  function stopSimulation() {
    if (state.animFrameId) {
      cancelAnimationFrame(state.animFrameId);
      state.animFrameId = null;
    }
  }

  function updateStandbyUI(players) {
    if (!el.standbyPlayersList) return;
    el.standbyPlayersList.innerHTML = "";
    const active = players.filter(p => !p.left && !p.forfeit);

    active.forEach(p => {
      const badge = document.createElement("div");
      badge.className = "igs-player-badge" + (p.isReady ? " is-ready" : "");
      badge.innerHTML = `
        <div style="display:flex;align-items:center;gap:0.4rem;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};"></span>
          <span>${escapeHtml(p.name)}${p.id === state.playerId ? ' (Deg)' : ''}</span>
        </div>
        <span style="font-size:0.75rem;color:${p.isReady ? '#34d399' : '#94a3b8'};">${p.isReady ? 'KLAR ✓' : 'Venter...'}</span>
      `;
      el.standbyPlayersList.appendChild(badge);
    });

    const readyCount = active.filter(p => p.isReady).length;
    if (el.standbyWaitingText) {
      el.standbyWaitingText.textContent = `${readyCount}/${active.length} spillere er klare til kamp.`;
    }

    if (el.btnHostForceStart) {
      if (state.isHost) el.btnHostForceStart.classList.remove("hidden");
      else el.btnHostForceStart.classList.add("hidden");
    }
  }

  // =========================================================================
  // MATCH LAUNCHERS: SOLO & MULTIPLAYER
  // =========================================================================

  function launchSoloMatch() {
    state.subMode = "solo";
    state.mapId = el.selectSoloMap?.value || "gloshaugen_arena";
    state.currentMap = state.mapId === "cyber_hangar" ? buildCyberHangar() : buildGloshaugenArena();
    state.scoreLimit = parseInt(el.selectSoloScoreLimit?.value || "15", 10) || 15;
    state.timeLimit = parseInt(el.selectSoloTimeLimit?.value || "300", 10) || 300;
    state.timeRemaining = state.timeLimit;
    state.botCount = parseInt(el.selectSoloBots?.value || "3", 10) || 3;
    state.roomStatus = "playing";

    // Setup player
    spawnPlayerOrBot(state.player, state.currentMap);
    state.player.name = state.playerName;
    state.player.color = state.playerColor;
    state.player.kills = 0;
    state.player.deaths = 0;
    state.player.score = 0;
    state.player.streak = 0;

    // Setup Bots
    state.bots = [];
    for (let i = 0; i < state.botCount; i++) {
      state.bots.push(createBot(i, state.currentMap));
    }
    state.opponents = {};
    state.bullets = [];
    state.particles = [];
    state.killFeed = [];

    if (el.inGameStandby) el.inGameStandby.classList.add("hidden");
    if (el.headTargetScore) el.headTargetScore.textContent = `Første til ${state.scoreLimit} drap`;
    if (el.hudTargetSub) el.hudTargetSub.textContent = `Mål: ${state.scoreLimit} drap`;

    showView("game");
    updateWeaponHUD();
    updateVitalsHUD();

    // 3-2-1 Countdown before action starts
    runCountdown(() => {
      startSimulation();
    });
  }

  async function createOnlineRoom() {
    state.subMode = "online";
    const mapId = el.selectHostMap?.value || "gloshaugen_arena";
    const scoreLimit = parseInt(el.selectHostScoreLimit?.value || "15", 10) || 15;
    const timeLimit = parseInt(el.selectHostTimeLimit?.value || "300", 10) || 300;
    const botCount = parseInt(el.selectHostBots?.value || "2", 10) || 2;

    try {
      const resp = await fetch("/api/kuleregn/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostName: state.playerName,
          color: state.playerColor,
          avatar: state.playerAvatar,
          mapId,
          scoreLimit,
          timeLimit,
          botCount,
          mode: "ffa",
        }),
      });
      const data = await resp.json();
      if (data.ok) {
        state.isHost = true;
        state.roomCode = data.roomCode;
        state.playerId = data.playerId;
        state.mapId = data.mapId;
        state.currentMap = state.mapId === "cyber_hangar" ? buildCyberHangar() : buildGloshaugenArena();
        state.scoreLimit = data.scoreLimit;
        state.timeLimit = data.timeLimit;
        state.timeRemaining = data.timeLimit;
        state.botCount = data.botCount;

        enterOnlineLobby(data);
      } else {
        alert(data.error || "Kunne ikke opprette rom.");
      }
    } catch (e) {
      alert("Feil ved tilkobling til server.");
    }
  }

  async function joinOnlineRoom(codeToJoin) {
    state.subMode = "online";
    const code = (codeToJoin || el.inputJoinRoomCode?.value || "").trim().toUpperCase();
    if (!code || code.length < 3) {
      alert("Vennligst skriv inn en gyldig romkode.");
      return;
    }

    try {
      const resp = await fetch("/api/kuleregn/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: code,
          playerName: state.playerName,
          color: state.playerColor,
          avatar: state.playerAvatar,
        }),
      });
      const data = await resp.json();
      if (data.ok) {
        state.isHost = false;
        state.roomCode = data.roomCode;
        state.playerId = data.playerId;
        state.mapId = data.mapId;
        state.currentMap = state.mapId === "cyber_hangar" ? buildCyberHangar() : buildGloshaugenArena();
        state.scoreLimit = data.scoreLimit;
        state.timeLimit = data.timeLimit;
        state.timeRemaining = data.timeLimit;
        state.botCount = data.botCount;

        enterOnlineLobby(data);
      } else {
        alert(data.error || "Kunne ikke bli med i rommet.");
      }
    } catch (e) {
      alert("Feil ved tilkobling til rommet.");
    }
  }

  function enterOnlineLobby(data) {
    state.roomStatus = "lobby";
    spawnPlayerOrBot(state.player, state.currentMap);
    state.player.name = state.playerName;
    state.player.color = state.playerColor;

    // If host and bot count > 0, generate bots
    state.bots = [];
    if (state.isHost && state.botCount > 0) {
      for (let i = 0; i < state.botCount; i++) {
        state.bots.push(createBot(i, state.currentMap));
      }
    }

    state.opponents = {};
    state.bullets = [];
    state.particles = [];

    if (el.standbyRoomCodeText) el.standbyRoomCodeText.textContent = state.roomCode;
    if (el.standbyMapBadge) el.standbyMapBadge.textContent = state.currentMap.name;
    if (el.inGameStandby) el.inGameStandby.classList.remove("hidden");

    showView("game");
    updateWeaponHUD();
    updateVitalsHUD();

    startRoomSync();
    startSimulation();
  }

  let countdownTimer = null;
  function runCountdown(callback) {
    if (countdownTimer) clearInterval(countdownTimer);
    if (el.countdownOverlay) el.countdownOverlay.classList.remove("hidden");
    let count = 3;
    if (el.countdownText) el.countdownText.textContent = "3";
    playTone(440, 0.15, "triangle", 0.35);

    countdownTimer = setInterval(() => {
      count--;
      if (count > 0) {
        if (el.countdownText) el.countdownText.textContent = String(count);
        playTone(440, 0.15, "triangle", 0.35);
      } else if (count === 0) {
        if (el.countdownText) el.countdownText.textContent = "KJEMP! 💥";
        playTone(880, 0.45, "triangle", 0.4);
      } else {
        clearInterval(countdownTimer);
        countdownTimer = null;
        if (el.countdownOverlay) el.countdownOverlay.classList.add("hidden");
        state.roomStatus = "playing";
        if (callback) callback();
      }
    }, 900);
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

    // Tab buttons
    el.tabBtnSolo?.addEventListener("click", () => showTab("solo"));
    el.tabBtnHost?.addEventListener("click", () => showTab("host"));
    el.tabBtnJoin?.addEventListener("click", () => showTab("join"));

    // Launch buttons
    el.btnStartSolo?.addEventListener("click", launchSoloMatch);
    el.btnCreateRoom?.addEventListener("click", createOnlineRoom);
    el.btnJoinRoom?.addEventListener("click", () => joinOnlineRoom());

    // In-game Standby Ready & Start buttons
    el.btnToggleReady?.addEventListener("click", async () => {
      const isReadyNow = !el.btnToggleReady.classList.contains("ready-active");
      el.btnToggleReady.classList.toggle("ready-active", isReadyNow);
      el.btnToggleReady.textContent = isReadyNow ? "Klar! ✓" : "Jeg er Klar! 👍";

      if (state.subMode === "online" && state.roomCode && state.playerId) {
        try {
          await fetch("/api/kuleregn/ready", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomCode: state.roomCode, playerId: state.playerId, ready: isReadyNow }),
          });
        } catch (e) {}
      }
    });

    el.btnHostForceStart?.addEventListener("click", async () => {
      if (state.subMode === "online" && state.roomCode && state.playerId) {
        try {
          await fetch("/api/kuleregn/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomCode: state.roomCode, playerId: state.playerId }),
          });
        } catch (e) {}
      }
    });

    el.btnLeaveGame?.addEventListener("click", () => {
      if (confirm("Vil du forlate kampen og gå tilbake til menyen?")) {
        showView("lobby");
      }
    });

    // Sound toggle
    el.btnSoundToggle?.addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      el.btnSoundToggle.textContent = soundEnabled ? "🔊" : "🔇";
    });

    // Name change
    el.inputPlayerName?.addEventListener("input", (e) => {
      const val = e.target.value.trim() || "Spiller";
      state.playerName = val;
      localStorage.setItem("kr_player_name", val);
      updateProfileUI();
    });

    // Character Creator Modal Trigger
    const openCharCreator = () => {
      if (window.CharacterCreator && typeof CharacterCreator.openModal === "function") {
        CharacterCreator.openModal({
          initialConfig: state.playerAvatar,
          onSave: (newConfig) => {
            state.playerAvatar = newConfig;
            localStorage.setItem("ts_driver_avatar", newConfig);
            localStorage.setItem("ntnu_avatar_config", newConfig);
            updateProfileUI();
          },
        });
      }
    };
    el.btnOpenCharacterCreator?.addEventListener("click", openCharCreator);
    el.btnProfileTrigger?.addEventListener("click", openCharCreator);

    // Party Lobby Hub Button
    el.btnPartyHub?.addEventListener("click", () => {
      window.location.href = "/party/";
    });

    // Podium Buttons
    el.btnPodiumPlayAgain?.addEventListener("click", () => {
      if (el.modalPodium) el.modalPodium.classList.add("hidden");
      if (state.subMode === "solo") {
        launchSoloMatch();
      } else {
        showView("lobby");
      }
    });

    el.btnPodiumReturnLobby?.addEventListener("click", () => {
      if (el.modalPodium) el.modalPodium.classList.add("hidden");
      showView("lobby");
    });

    // Copy room code pill
    el.standbyRoomCodePill?.addEventListener("click", () => {
      if (state.roomCode) {
        navigator.clipboard.writeText(state.roomCode);
        if (el.standbyRoomCodeText) {
          el.standbyRoomCodeText.textContent = "KOPIERT!";
          setTimeout(() => {
            if (el.standbyRoomCodeText) el.standbyRoomCodeText.textContent = state.roomCode;
          }, 1200);
        }
      }
    });

    // URL Query parameters (e.g. from Party Lobby or Invite: ?room=KULE&player=p_1234)
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room") || params.get("code");
    if (roomParam) {
      setTimeout(() => {
        joinOnlineRoom(roomParam);
      }, 300);
    }
  }

  // =========================================================================
  // BOOTSTRAP INITIALIZATION
  // =========================================================================

  window.addEventListener("DOMContentLoaded", () => {
    initPaletteSwatches();
    updateProfileUI();
    initInputHandlers();
    initUI();
    showView("lobby");
  });
})();
