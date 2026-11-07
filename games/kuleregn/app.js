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

  const WEAPONS = {
    assault: {
      id: "assault",
      name: "Autokanon (AR-47)",
      type: "Helautomatisk",
      icon: "⚡",
      damage: 17,
      fireRate: 0.11, // ~9 rps
      startingAmmo: Infinity,
      bulletSpeed: 980,
      bulletLife: 1.15,
      spread: 0.06,
      bulletCount: 1,
      isAutomatic: true,
      recoilKick: 4,
      screenShake: 2,
      color: "#38bdf8",
      length: 28,
      barrelWidth: 5,
      slot: "1",
      desc: "Hurtigskytende autokanon med solid skade",
      dps: "155 DPS",
    },
    shotgun: {
      id: "shotgun",
      name: "Flak-kanon (SPAS-12)",
      type: "Sprenghagl",
      icon: "💥",
      damage: 18, // 18 x 6 = 108 maks
      fireRate: 0.65,
      startingAmmo: Infinity,
      bulletSpeed: 780,
      bulletLife: 0.65,
      spread: 0.22,
      bulletCount: 6,
      isAutomatic: false,
      recoilKick: 9,
      screenShake: 5,
      color: "#fb923c",
      length: 26,
      barrelWidth: 6,
      slot: "2",
      desc: "Massiv nærkampskade med 6 flak-splinter",
      dps: "108 Maks",
    },
    sniper: {
      id: "sniper",
      name: "Panserbryter (AWP Railgun)",
      type: "Bolt-action",
      icon: "🎯",
      damage: 85,
      fireRate: 0.85,
      startingAmmo: Infinity,
      bulletSpeed: 1500,
      bulletLife: 1.2,
      spread: 0.012,
      bulletCount: 1,
      isAutomatic: false,
      recoilKick: 14,
      screenShake: 7,
      color: "#a855f7",
      length: 36,
      barrelWidth: 4,
      slot: "3",
      desc: "Lynrask panserbrytende granat med lasersikte",
      dps: "85 Skade",
    },
    rocket: {
      id: "rocket",
      name: "HE-Rakettkanon (RPG)",
      type: "Eksplosiv",
      icon: "🚀",
      damage: 115,
      splashRadius: 140,
      fireRate: 1.2,
      startingAmmo: Infinity,
      bulletSpeed: 520,
      bulletLife: 2.2,
      spread: 0.02,
      bulletCount: 1,
      isAutomatic: false,
      recoilKick: 16,
      screenShake: 12,
      color: "#ef4444",
      length: 32,
      barrelWidth: 8,
      slot: "4",
      desc: "Flatestøt og kraftig eksplosjonsradius",
      dps: "115 AOE",
    },
    pistol: {
      id: "pistol",
      name: "Standard Stridsvognkanon",
      type: "Halvautomatisk",
      icon: "🛡️",
      damage: 22,
      fireRate: 0.22,
      startingAmmo: Infinity,
      bulletSpeed: 900,
      bulletLife: 1.1,
      spread: 0.035,
      bulletCount: 1,
      isAutomatic: false,
      recoilKick: 3,
      screenShake: 2,
      color: "#fde047",
      length: 18,
      barrelWidth: 4,
      slot: "5",
      desc: "Presis og pålitelig standardkanon",
      dps: "100 DPS",
    },
  };

  // =========================================================================
  // TANK SPRITE ASSETS & DYNAMIC COLOR TINTING
  // =========================================================================

  const TANK_ASSET_PATHS = {
    body: "/games/kuleregn/assets/tank/body.png",
    turret: "/games/kuleregn/assets/tank/turret.png",
    tracks: [
      "/games/kuleregn/assets/tank/tracks_0001.png",
      "/games/kuleregn/assets/tank/tracks_0002.png",
      "/games/kuleregn/assets/tank/tracks_0003.png",
    ],
  };

  const TANK_ASSETS = {
    body: new Image(),
    turret: new Image(),
    tracks: [new Image(), new Image(), new Image()],
  };

  TANK_ASSETS.body.src = TANK_ASSET_PATHS.body;
  TANK_ASSETS.turret.src = TANK_ASSET_PATHS.turret;
  TANK_ASSETS.tracks[0].src = TANK_ASSET_PATHS.tracks[0];
  TANK_ASSETS.tracks[1].src = TANK_ASSET_PATHS.tracks[1];
  TANK_ASSETS.tracks[2].src = TANK_ASSET_PATHS.tracks[2];

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

    // Tactical medkits & kevlar shields only (NO weapon pickups)
    const pickups = [
      { id: "rust_med_1", type: "medkit", x: 340, y: 1100, respawnSec: 15, timer: 0 },
      { id: "rust_med_2", type: "medkit", x: w - 340, y: 1100, respawnSec: 15, timer: 0 },
      { id: "rust_shd_1", type: "shield", x: 1100, y: 340, respawnSec: 20, timer: 0 },
      { id: "rust_shd_2", type: "shield", x: 1100, y: h - 340, respawnSec: 20, timer: 0 },
    ];

    // Red Explosive Barrels (☣)
    const barrels = [
      { id: "rust_bar_1", x: 915, y: 915, r: 16, hp: 35 },
      { id: "rust_bar_2", x: 1285, y: 915, r: 16, hp: 35 },
      { id: "rust_bar_3", x: 915, y: 1285, r: 16, hp: 35 },
      { id: "rust_bar_4", x: 1285, y: 1285, r: 16, hp: 35 },
      { id: "rust_bar_5", x: 550, y: 930, r: 16, hp: 35 },
      { id: "rust_bar_6", x: 1650, y: 1270, r: 16, hp: 35 },
      { id: "rust_bar_7", x: 1100, y: 720, r: 16, hp: 35 },
      { id: "rust_bar_8", x: 1100, y: 1480, r: 16, hp: 35 },
    ];

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

    const pickups = [
      { id: "pk_medkit_1", type: "medkit", x: 180, y: h / 2 - 200, respawnSec: 15, timer: 0 },
      { id: "pk_medkit_2", type: "medkit", x: w - 180, y: h / 2 + 200, respawnSec: 15, timer: 0 },
      { id: "pk_shield_1", type: "shield", x: w / 2 - 260, y: h / 2 + 20, respawnSec: 20, timer: 0 },
      { id: "pk_shield_2", type: "shield", x: w / 2 + 260, y: h / 2 - 20, respawnSec: 20, timer: 0 },
    ];

    const barrels = [
      { id: "bar_1", x: w / 2 - 180, y: h / 2 - 180, r: 16, hp: 40 },
      { id: "bar_2", x: w / 2 + 180, y: h / 2 - 180, r: 16, hp: 40 },
      { id: "bar_3", x: w / 2 - 180, y: h / 2 + 180, r: 16, hp: 40 },
      { id: "bar_4", x: w / 2 + 180, y: h / 2 + 180, r: 16, hp: 40 },
      { id: "bar_5", x: 500, y: h - 400, r: 16, hp: 40 },
      { id: "bar_6", x: w - 500, y: 400, r: 16, hp: 40 },
    ];

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

    const pickups = [
      { id: "ch_pk_med_1", type: "medkit", x: w / 2 - 250, y: h / 2, respawnSec: 15, timer: 0 },
      { id: "ch_pk_med_2", type: "medkit", x: w / 2 + 250, y: h / 2, respawnSec: 15, timer: 0 },
      { id: "ch_pk_shd_1", type: "shield", x: w / 2, y: h / 2 - 240, respawnSec: 20, timer: 0 },
      { id: "ch_pk_shd_2", type: "shield", x: w / 2, y: h / 2 + 240, respawnSec: 20, timer: 0 },
    ];

    const barrels = [
      { id: "ch_bar_1", x: w / 2 - 220, y: h / 2 - 220, r: 16, hp: 40 },
      { id: "ch_bar_2", x: w / 2 + 220, y: h / 2 - 220, r: 16, hp: 40 },
      { id: "ch_bar_3", x: w / 2 - 220, y: h / 2 + 220, r: 16, hp: 40 },
      { id: "ch_bar_4", x: w / 2 + 220, y: h / 2 + 220, r: 16, hp: 40 },
      { id: "ch_bar_5", x: 260, y: h / 2, r: 16, hp: 40 },
      { id: "ch_bar_6", x: w - 260, y: h / 2, r: 16, hp: 40 },
    ];

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
    mode: "ffa",   // "ffa"
    roomCode: null,
    playerId: null,
    isHost: false,
    isSolo: false,
    playerName: localStorage.getItem("spillhjornet_player_name") || localStorage.getItem("party_player_name") || localStorage.getItem("kr_player_name") || "Soldat",
    playerColor: localStorage.getItem("kr_player_color") || "#ffd166",
    playerAvatar: localStorage.getItem("party_avatar") || localStorage.getItem("kr_player_avatar") || localStorage.getItem("spillhjornet_character") || "char:h1:c_ffd166:r1:e1:m1",

    selectedWeapon: localStorage.getItem("kr_selected_weapon") || "assault",
    roomStatus: "lobby", // "lobby" | "countdown" | "playing" | "finished"
    mapId: "rust",
    currentMap: buildRustMap(),
    scoreLimit: 15,
    timeLimit: 300,
    timeRemaining: 300,

    // Local Player Tank
    player: {
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
      speed: 220,
      health: 100,
      shield: 25,
      maxHealth: 100,
      maxShield: 100,
      weapon: localStorage.getItem("kr_selected_weapon") || "assault",
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

    // Camera
    camera: { x: 400, y: 400, zoom: 1.0, shake: 0 },

    // Input States (WASD Tank Steering/Throttle, Left/Right Arrows Turret, Space/Click Shoot)
    keys: {
      w: false, a: false, s: false, d: false,
      arrowLeft: false, arrowRight: false,
      shoot: false
    },
    lastTurnAngle: 0,
    mouse: { down: false, screenX: 0, screenY: 0, hasMoved: false },

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
    // Views
    viewLobby: document.getElementById("viewLobby"),
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

    // In-game Start Weapon Modal Elements (Choose Gun when game starts)
    startWeaponOverlay: document.getElementById("startWeaponOverlay"),
    startWeaponGrid: document.getElementById("startWeaponGrid"),
    btnConfirmStartWeapon: document.getElementById("btnConfirmStartWeapon"),
    quickWeaponBar: document.getElementById("quickWeaponBar"),
    hudFovBadge: document.getElementById("hudFovBadge"),

    // Solo Practice Elements
    selectSoloMap: document.getElementById("selectSoloMap"),
    btnStartSoloPractice: document.getElementById("btnStartSoloPractice"),

    // In-game HUD Elements (View 2)
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
  // VIEW SWITCHER
  // =========================================================================

  function showView(viewName) {
    state.view = viewName;

    if (el.viewLobby) el.viewLobby.classList.toggle("hidden", viewName !== "lobby");
    if (el.viewGame) el.viewGame.classList.toggle("hidden", viewName !== "game");
    if (el.btnHeaderLeave) el.btnHeaderLeave.classList.toggle("hidden", viewName !== "game");

    if (viewName === "lobby") {
      if (el.headGameStatus) el.headGameStatus.classList.add("hidden");
      if (el.modalPodium) el.modalPodium.classList.add("hidden");
      if (el.startWeaponOverlay) el.startWeaponOverlay.classList.add("hidden");
      if (el.btnHeaderBack) {
        el.btnHeaderBack.href = "/";
      }
      if (el.backBtnText) {
        el.backBtnText.textContent = "Hub";
      }
      stopSimulation();
      stopRoomSync();
    } else if (viewName === "game") {
      if (el.headGameStatus) el.headGameStatus.classList.remove("hidden");
      if (el.modalPodium) el.modalPodium.classList.add("hidden");
      resizeCanvas();
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
    combatant.health = combatant.maxHealth || 100;
    combatant.shield = 25;
    combatant.isDead = false;
    combatant.respawnTimer = 0;
    combatant.weapon = combatant.chosenWeapon || state.selectedWeapon || "assault";
    combatant.ammo = Infinity;
    combatant.invulnerableUntil = performance.now() + 2500; // 2.5s spawn shield
  }

  // =========================================================================
  // PHYSICS & COLLISION
  // =========================================================================

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

      // Report event to server if involved
      if (victim === state.player || (state.isHost && killer === state.player)) {
        state.recentEvents.push({
          type: "kill",
          killerId: killer ? killer.id : "env",
          victimId: victim.id,
          weapon: weaponId || "pistol",
        });
      }

      checkMatchVictory();
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
    const topCombatant = allCombatants.slice().sort((a, b) => (b.kills || 0) - (a.kills || 0))[0];

    if (topCombatant && topCombatant.kills >= state.scoreLimit) {
      endMatch(topCombatant);
    }
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
      el.podiumTitle.textContent = isMe ? "🏆 DU VANT KAMPEN!" : `👑 ${winner ? winner.name : 'Vinner'} VANT!`;
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
    const wIcon = WEAPONS[item.weapon] ? WEAPONS[item.weapon].icon : "🔫";
    state.killFeed.unshift({
      ...item,
      icon: wIcon,
      timestamp: performance.now(),
    });
    if (state.killFeed.length > 5) state.killFeed.pop();

    if (el.killFeedContainer) {
      el.killFeedContainer.innerHTML = "";
      state.killFeed.forEach(kf => {
        const div = document.createElement("div");
        div.className = "kill-feed-item";
        div.innerHTML = `
          <span class="kf-killer" style="color:${kf.killerColor}">${escapeHtml(kf.killerName)}</span>
          <span class="kf-weapon">${kf.icon}</span>
          <span class="kf-victim" style="color:${kf.victimColor}">${escapeHtml(kf.victimName)}</span>
        `;
        el.killFeedContainer.appendChild(div);
      });
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
  // INPUT HANDLING (WASD / ARROWS + SPACE / MOUSE AIMING & SHOOTING)
  // =========================================================================

  function initInputHandlers() {
    const canvas = el.combatCanvas;

    function updateMousePos(e) {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : null);
      const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : null);
      if (clientX == null || clientY == null) return;

      const scaleX = canvas.width / (rect.width || 1);
      const scaleY = canvas.height / (rect.height || 1);
      state.mouse.screenX = (clientX - rect.left) * scaleX;
      state.mouse.screenY = (clientY - rect.top) * scaleY;
      state.mouse.hasMoved = true;
    }

    window.addEventListener("mousemove", updateMousePos);
    window.addEventListener("touchmove", updateMousePos, { passive: true });

    window.addEventListener("keydown", (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      const k = e.key.toLowerCase();

      // If start weapon modal is open:
      if (el.startWeaponOverlay && !el.startWeaponOverlay.classList.contains("hidden")) {
        if (k === "1" || k === "2" || k === "3" || k === "4" || k === "5") {
          const mapW = { "1": "assault", "2": "shotgun", "3": "sniper", "4": "rocket", "5": "pistol" };
          selectPlayerWeapon(mapW[k]);
          return;
        }
        if (k === " " || e.key === " " || k === "enter" || k === "escape") {
          e.preventDefault();
          hideStartWeaponOverlay();
          return;
        }
      }

      // WASD for Movement
      if (k === "w") { state.keys.w = true; hideStartWeaponOverlay(); }
      if (k === "a") { state.keys.a = true; hideStartWeaponOverlay(); }
      if (k === "s") { state.keys.s = true; hideStartWeaponOverlay(); }
      if (k === "d") { state.keys.d = true; hideStartWeaponOverlay(); }

      // Left and Right Arrow Keys ONLY to pan the view
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        state.keys.arrowLeft = true;
        state.mouse.hasMoved = false;
        hideStartWeaponOverlay();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        state.keys.arrowRight = true;
        state.mouse.hasMoved = false;
        hideStartWeaponOverlay();
      }
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
      }

      // Space / Enter to Shoot
      if (k === " " || e.key === " " || k === "enter") {
        e.preventDefault();
        hideStartWeaponOverlay();
        state.keys.shoot = true;
        if (state.roomStatus === "playing") {
          firePlayerWeapon();
        }
      }

      if (k === "1") selectPlayerWeapon("assault");
      if (k === "2") selectPlayerWeapon("shotgun");
      if (k === "3") selectPlayerWeapon("sniper");
      if (k === "4") selectPlayerWeapon("rocket");
      if (k === "5") selectPlayerWeapon("pistol");

      if (k === "b") {
        if (el.startWeaponOverlay && el.startWeaponOverlay.classList.contains("hidden")) {
          showStartWeaponOverlay();
        } else {
          hideStartWeaponOverlay();
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

      // Left and Right Arrow Keys to pan the view
      if (e.key === "ArrowLeft") state.keys.arrowLeft = false;
      if (e.key === "ArrowRight") state.keys.arrowRight = false;
      if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();

      // Space to Shoot
      if (k === " " || e.key === " " || k === "enter") state.keys.shoot = false;

      if (e.key === "Tab") {
        if (el.scoreboardModal) el.scoreboardModal.classList.add("hidden");
      }
    });

    window.addEventListener("mousedown", (e) => {
      if (state.view !== "game") return;
      updateMousePos(e);
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
      state.keys = { w: false, a: false, s: false, d: false, shoot: false };
    });

    // Touch Support: Tap canvas to shoot
    if (canvas) {
      canvas.addEventListener("touchstart", (e) => {
        updateMousePos(e);
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

  function showStartWeaponOverlay() {
    renderStartWeaponGrid();
    if (el.startWeaponOverlay) {
      el.startWeaponOverlay.classList.remove("hidden");
    }
  }

  function hideStartWeaponOverlay() {
    if (el.startWeaponOverlay) {
      el.startWeaponOverlay.classList.add("hidden");
    }
  }

  function selectPlayerWeapon(weaponId, notify = true) {
    if (!WEAPONS[weaponId]) return;
    state.selectedWeapon = weaponId;
    localStorage.setItem("kr_selected_weapon", weaponId);
    state.player.weapon = weaponId;
    state.player.ammo = Infinity;
    const w = WEAPONS[weaponId];
    if (notify) {
      showPickupToast(`${w.icon} Valgt: ${w.name}`);
      playTone(520, 0.08, "triangle", 0.3);
    }
    updateWeaponHUD();
    renderStartWeaponGrid();
  }

  function renderStartWeaponGrid() {
    if (!el.startWeaponGrid) return;
    el.startWeaponGrid.innerHTML = "";

    const weaponsList = [
      WEAPONS.assault,
      WEAPONS.shotgun,
      WEAPONS.sniper,
      WEAPONS.rocket,
      WEAPONS.pistol,
    ];

    weaponsList.forEach(w => {
      const isSelected = (state.selectedWeapon === w.id);
      const card = document.createElement("div");
      card.className = `sw-card ${isSelected ? "selected" : ""}`;
      card.dataset.weapon = w.id;

      card.innerHTML = `
        <span class="sw-hotkey">${w.slot}</span>
        <span class="sw-icon">${w.icon}</span>
        <span class="sw-name">${w.name}</span>
        <span class="sw-type">${w.type}</span>
        <span class="sw-stat">${w.dps || w.damage + " dmg"}</span>
        <span class="sw-badge">✓ VALGT</span>
      `;

      card.addEventListener("click", () => {
        selectPlayerWeapon(w.id, true);
      });

      el.startWeaponGrid.appendChild(card);
    });
  }

  function firePlayerWeapon() {
    const p = state.player;
    if (p.isDead || p.fireTimer > 0) return;
    const w = WEAPONS[p.weapon] || WEAPONS.assault;

    // Tactical loadout weapons have unlimited combat ammo
    p.ammo = Infinity;
    p.fireTimer = w.fireRate;

    // Tank turret recoil kick & hull impulse
    p.recoilOffset = Math.min(10, (p.recoilOffset || 0) + (w.recoilKick > 8 ? 8 : 6));
    p.recoilVx = (p.recoilVx || 0) - Math.cos(p.angle) * w.recoilKick * 7;
    p.recoilVy = (p.recoilVy || 0) - Math.sin(p.angle) * w.recoilKick * 7;
    state.camera.shake = Math.min(18, state.camera.shake + w.screenShake);

    const barrelDist = 26;
    const barrelX = p.x + Math.cos(p.angle) * barrelDist;
    const barrelY = p.y + Math.sin(p.angle) * barrelDist;

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

      // 2b. If Solo Practice, update target dummies respawn
      if (state.isSolo) {
        for (const opp of Object.values(state.opponents)) {
          if (opp.isDead) {
            opp.respawnTimer -= dt;
            if (opp.respawnTimer <= 0) {
              spawnPlayer(opp, map);
            }
          }
        }
      }

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
      }
      return;
    }

    if (p.fireTimer > 0) p.fireTimer = Math.max(0, p.fireTimer - dt);

    // Recoil recovery for turret kick
    if (p.recoilOffset > 0) {
      p.recoilOffset = Math.max(0, p.recoilOffset - dt * 26);
    }

    // 1. Tank Hull Steering & Driving with WASD
    const isDrivingForward = !!state.keys.w;
    const isDrivingReverse = !!state.keys.s;
    const isSteeringLeft = !!state.keys.a;
    const isSteeringRight = !!state.keys.d;

    // Turn hull with A (left) and D (right)
    const hullTurnSpeed = 3.6; // rad/s
    const steerDir = (isSteeringRight ? 1 : 0) - (isSteeringLeft ? 1 : 0);
    if (steerDir !== 0) {
      p.hullAngle = (p.hullAngle || 0) + steerDir * hullTurnSpeed * dt;
      while (p.hullAngle > Math.PI) p.hullAngle -= Math.PI * 2;
      while (p.hullAngle < -Math.PI) p.hullAngle += Math.PI * 2;
    }

    // Drive forward / reverse along hullAngle
    let forwardThrottle = 0;
    if (isDrivingForward) forwardThrottle += 220;
    if (isDrivingReverse) forwardThrottle -= 130;

    // Animate tracks when driving or steering
    if (forwardThrottle !== 0 || steerDir !== 0) {
      const treadSpeed = forwardThrottle !== 0 ? Math.abs(forwardThrottle) : 120;
      p.trackDistance = (p.trackDistance || 0) + treadSpeed * dt;
      p.trackFrame = Math.floor(p.trackDistance / 10) % 3;
    }

    // Combine drive velocity with shooting recoil momentum
    const driveVx = Math.cos(p.hullAngle) * forwardThrottle;
    const driveVy = Math.sin(p.hullAngle) * forwardThrottle;
    p.vx = driveVx + (p.recoilVx || 0);
    p.vy = driveVy + (p.recoilVy || 0);
    if (p.recoilVx) p.recoilVx *= Math.pow(0.005, dt);
    if (p.recoilVy) p.recoilVy *= Math.pow(0.005, dt);

    // Apply movement & obstacle collisions
    applyCombatantMovement(p, map, dt);

    // 2. Turret Aiming with Arrow Keys (Left & Right)
    const turretTurnSpeed = 4.4; // rad/s
    if (state.keys.arrowLeft || state.keys.arrowRight) {
      const panDir = (state.keys.arrowRight ? 1 : 0) - (state.keys.arrowLeft ? 1 : 0);
      p.angle += panDir * turretTurnSpeed * dt;
      while (p.angle > Math.PI) p.angle -= Math.PI * 2;
      while (p.angle < -Math.PI) p.angle += Math.PI * 2;
      state.lastTurnAngle = p.angle;
    } else if (state.mouse.hasMoved && el.combatCanvas) {
      // Mouse cursor aiming
      const cw = el.combatCanvas.width;
      const ch = el.combatCanvas.height;
      const pScreenX = cw / 2 + (p.x - state.camera.x) * state.camera.zoom;
      const pScreenY = ch / 2 + (p.y - state.camera.y) * state.camera.zoom;
      p.angle = Math.atan2(state.mouse.screenY - pScreenY, state.mouse.screenX - pScreenX);
      state.lastTurnAngle = p.angle;
    } else if (state.lastTurnAngle !== undefined) {
      p.angle = state.lastTurnAngle;
    } else {
      p.angle = p.hullAngle;
    }

    // 3. Continuous weapon firing when holding mouse or space
    const isShooting = (state.mouse.down || state.keys.shoot) && state.roomStatus === "playing";
    if (isShooting) {
      const w = WEAPONS[p.weapon] || WEAPONS.pistol;
      if (w.isAutomatic || p.fireTimer <= 0) {
        firePlayerWeapon();
      }
    }

    // 4. Camera smoothly tracks player and pans ahead along turret sightline
    const lookahead = 90;
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

    // 3. Render Pickups (medkits and shields)
    const nowTime = performance.now() / 1000;
    for (const pItem of map.pickups) {
      if (pItem.timer > 0) continue;
      const bob = Math.sin(nowTime * 3 + pItem.x) * 4;
      const rot = nowTime * 1.5;

      ctx.save();
      ctx.translate(pItem.x, pItem.y + bob);

      // Glow circle
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fillStyle = pItem.type === "medkit" ? "rgba(34, 197, 94, 0.25)" : "rgba(6, 182, 212, 0.25)";
      ctx.fill();

      // Crate box
      ctx.rotate(rot);
      ctx.fillStyle = pItem.type === "medkit" ? "#16a34a" : "#0284c7";
      ctx.fillRect(-14, -14, 28, 28);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(-14, -14, 28, 28);

      ctx.restore();

      // Overhead Pickup Label
      ctx.save();
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#000000";
      ctx.shadowBlur = 4;
      const label = pItem.type === "medkit" ? "❤️ MEDKIT" : "🛡️ SKJOLD";
      ctx.fillText(label, pItem.x, pItem.y + 28);
      ctx.restore();
    }

    // 5. Render Explosive Barrels
    for (const b of map.barrels) {
      if (b.hp <= 0) continue;
      ctx.save();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = "#b91c1c";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#fca5a5";
      ctx.stroke();

      // Hazard Stripes
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fef08a";
      ctx.fillText("☣", b.x, b.y);
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
  }

  function drawCombatant(ctx, c, isMe = false) {
    const now = performance.now();
    const isInvuln = c.invulnerableUntil && now < c.invulnerableUntil;
    const tankSize = 58;
    const hullAngle = c.hullAngle !== undefined ? c.hullAngle : (c.angle !== undefined ? c.angle : -Math.PI / 2);
    const turretAngle = c.angle !== undefined ? c.angle : hullAngle;
    const tankColor = c.color || "#ffd166";

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
      ctx.arc(c.x, c.y, 34, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(56, 189, 248, 0.22)";
      ctx.fill();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }

    // 3. Tank Tracks (Caterpillar Treads - animated frame 0, 1, or 2)
    const frameIdx = Math.abs(c.trackFrame || 0) % 3;
    const trackImg = TANK_ASSETS.tracks[frameIdx];
    if (trackImg && trackImg.complete && trackImg.naturalWidth > 0) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(hullAngle + Math.PI / 2);
      ctx.drawImage(trackImg, -tankSize / 2, -tankSize / 2, tankSize, tankSize);
      ctx.restore();
    }

    // 4. Tank Hull / Body (Tinted to character color)
    const bodyImg = getTintedSprite(TANK_ASSETS.body, tankColor);
    if (bodyImg) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(hullAngle + Math.PI / 2);
      ctx.drawImage(bodyImg, -tankSize / 2, -tankSize / 2, tankSize, tankSize);

      // Clean subtle indicator ring for local player
      if (isMe) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-tankSize * 0.34, -tankSize * 0.42, tankSize * 0.68, tankSize * 0.84);
      }
      ctx.restore();
    } else {
      // Fallback while loading
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(hullAngle);
      ctx.fillStyle = tankColor;
      ctx.fillRect(-22, -18, 44, 36);
      ctx.restore();
    }

    // 5. Tank Turret & Cannon Barrel (Rotated independently along turretAngle)
    const turretImg = getTintedSprite(TANK_ASSETS.turret, tankColor);
    const recoil = c.recoilOffset || 0;
    const turretX = c.x - Math.cos(turretAngle) * recoil;
    const turretY = c.y - Math.sin(turretAngle) * recoil;

    // Laser Sight for Sniper / Cannon
    if (c.weapon === "sniper") {
      ctx.save();
      ctx.strokeStyle = isMe ? "rgba(244, 63, 94, 0.65)" : "rgba(239, 68, 68, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      const tipX = turretX + Math.cos(turretAngle) * 26;
      const tipY = turretY + Math.sin(turretAngle) * 26;
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX + Math.cos(turretAngle) * 650, tipY + Math.sin(turretAngle) * 650);
      ctx.stroke();
      ctx.restore();
    }

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

    // Mini Commander Cupola / Hatch Badge
    const charCvs = getAvatarCanvas(c.avatar || state.playerAvatar, 48);
    if (charCvs) {
      ctx.save();
      ctx.translate(turretX, turretY);
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(charCvs, -8, -8, 16, 16);
      ctx.restore();
      ctx.save();
      ctx.translate(turretX, turretY);
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // 6. Overhead Name & Vitals Bar (Unrotated)
    ctx.save();
    ctx.translate(c.x, c.y - 38);

    // Name Tag
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = isMe ? "#fde047" : "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 4;
    ctx.fillText(c.name, 0, -4);
    ctx.shadowBlur = 0;

    // Mini Health & Shield Bars
    const barW = 42;
    const barH = 5;
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(-barW / 2, 0, barW, barH);

    const hpPct = Math.max(0, c.health / 100);
    ctx.fillStyle = hpPct > 0.4 ? "#22c55e" : "#ef4444";
    ctx.fillRect(-barW / 2, 0, barW * hpPct, barH);

    if (c.shield > 0) {
      const shdPct = Math.max(0, c.shield / 100);
      ctx.fillStyle = "#06b6d4";
      ctx.fillRect(-barW / 2, -3, barW * shdPct, 2.5);
    }

    ctx.restore();
  }

  // =========================================================================
  // HUD UPDATES
  // =========================================================================

  function updateVitalsHUD() {
    const p = state.player;
    if (el.vitalHealthFill) el.vitalHealthFill.style.width = `${Math.max(0, p.health)}%`;
    if (el.vitalHealthNum) el.vitalHealthNum.textContent = String(Math.max(0, p.health));

    if (el.vitalShieldFill) el.vitalShieldFill.style.width = `${Math.max(0, p.shield)}%`;
    if (el.vitalShieldNum) el.vitalShieldNum.textContent = String(Math.max(0, p.shield));

    // Update Rank in Lobby/Match
    const all = [state.player, ...Object.values(state.opponents)];
    all.sort((a, b) => (b.kills || 0) - (a.kills || 0));
    const myRank = all.findIndex(c => c === state.player) + 1;
    if (el.hudPosNum) el.hudPosNum.textContent = `${myRank}.`;
    if (el.hudKillsText) el.hudKillsText.textContent = `${p.kills}/${state.scoreLimit} drap`;
  }

  function updateWeaponHUD() {
    const p = state.player;
    const w = WEAPONS[p.weapon] || WEAPONS.assault;

    if (el.weaponHudIcon) el.weaponHudIcon.textContent = w.icon;
    if (el.weaponHudName) el.weaponHudName.textContent = w.name;
    if (el.weaponHudType) el.weaponHudType.textContent = w.type;
    if (el.ammoCurrent) {
      el.ammoCurrent.textContent = "∞";
    }
    if (el.ammoLabel) {
      el.ammoLabel.textContent = "Uendelig";
    }

    // Synchronize quick weapon buttons highlight in HUD
    if (el.quickWeaponBar) {
      const btns = el.quickWeaponBar.querySelectorAll(".qw-btn");
      btns.forEach(btn => {
        if (btn.dataset.weapon === p.weapon) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
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

  function startRoomSync() {
    if (state.syncTimerId) clearInterval(state.syncTimerId);
    state.syncTimerId = setInterval(syncWithServer, 80); // ~12 updates per second
  }

  function stopRoomSync() {
    if (state.syncTimerId) {
      clearInterval(state.syncTimerId);
      state.syncTimerId = null;
    }
  }

  async function syncWithServer() {
    if (!state.roomCode || !state.playerId || state.isSolo) return;

    try {
      const payload = {
        roomCode: state.roomCode,
        playerId: state.playerId,
        events: state.recentEvents.slice(),
        telemetry: {
          x: state.player.x,
          y: state.player.y,
          angle: state.player.angle,
          hullAngle: state.player.hullAngle,
          trackFrame: state.player.trackFrame,
          vx: state.player.vx,
          vy: state.player.vy,
          speed: state.player.speed,
          weapon: state.player.weapon,
          health: state.player.health,
          shield: state.player.shield,
          avatar: state.playerAvatar,
          color: state.playerColor,
        },
      };

      state.recentEvents = [];

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
      el.countdownOverlay?.classList.remove("hidden");
      const rem = Math.ceil(data.countdownRemaining || 3);
      if (el.countdownText) el.countdownText.textContent = rem > 0 ? String(rem) : "KJEMP! 💥";
    } else if (data.status === "playing") {
      if (prevStatus === "countdown") {
        if (el.countdownText) el.countdownText.textContent = "KJEMP! 💥";
        playTone(880, 0.4, "triangle", 0.35);
        setTimeout(() => el.countdownOverlay?.classList.add("hidden"), 600);
      } else {
        el.countdownOverlay?.classList.add("hidden");
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
            avatar: p.avatar || "",
            x: p.x,
            y: p.y,
            angle: p.angle,
            hullAngle: p.hullAngle !== undefined ? p.hullAngle : p.angle,
            trackFrame: p.trackFrame || 0,
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
          if (p.avatar && p.avatar !== opp.avatar) opp.avatar = p.avatar;
          opp.color = p.color || opp.color;
          opp.x += (p.x - opp.x) * 0.32;
          opp.y += (p.y - opp.y) * 0.32;
          let diff = p.angle - opp.angle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          opp.angle += diff * 0.32;

          if (p.hullAngle !== undefined) {
            let hDiff = p.hullAngle - (opp.hullAngle || opp.angle);
            while (hDiff < -Math.PI) hDiff += Math.PI * 2;
            while (hDiff > Math.PI) hDiff -= Math.PI * 2;
            opp.hullAngle = (opp.hullAngle || opp.angle) + hDiff * 0.32;
          }
          if (p.trackFrame !== undefined) {
            opp.trackFrame = p.trackFrame;
          }

          opp.weapon = p.weapon || opp.weapon;
          opp.health = p.health;
          opp.shield = p.shield;
          opp.kills = p.kills || opp.kills;
          opp.deaths = p.deaths || opp.deaths;
          opp.score = p.score || opp.score;
          opp.isDead = (p.health || 100) <= 0;
        }
      }
    });

    // Ingest kill feed if reported by server
    if (data.killFeed && data.killFeed.length > 0) {
      data.killFeed.forEach(kf => {
        const exists = state.killFeed.some(existing =>
          existing.killerName === kf.killerName && existing.victimName === kf.victimName
        );
        if (!exists) {
          addKillFeedItem(kf);
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
    const dummyConfigs = map.id === "rust" ? [
      { id: "dummy_1", name: "Panser-Alfa 🎯", color: "#f43f5e", avatar: "char:h1:c_f43f5e:r1:e1:m1", offset: { x: -620, y: -40 }, weapon: "shotgun", hullAngle: 0.5 },
      { id: "dummy_2", name: "Panser-Bravo 🎯", color: "#38bdf8", avatar: "char:h2:c_38bdf8:r2:e2:m2", offset: { x: 540, y: -100 }, weapon: "sniper", hullAngle: 2.2 },
      { id: "dummy_3", name: "Panser-Charlie 🎯", color: "#a855f7", avatar: "char:h3:c_a855f7:r3:e3:m3", offset: { x: 0, y: -590 }, weapon: "assault", hullAngle: -1.2 },
      { id: "dummy_4", name: "Panser-Delta 🎯", color: "#10b981", avatar: "char:h4:c_10b981:r1:e2:m1", offset: { x: -260, y: 320 }, weapon: "rocket", hullAngle: -2.8 },
    ] : [
      { id: "dummy_1", name: "Panser-Alfa 🎯", color: "#f43f5e", avatar: "char:h1:c_f43f5e:r1:e1:m1", offset: { x: -140, y: -100 }, weapon: "shotgun", hullAngle: 0.8 },
      { id: "dummy_2", name: "Panser-Bravo 🎯", color: "#38bdf8", avatar: "char:h2:c_38bdf8:r2:e2:m2", offset: { x: 140, y: -100 }, weapon: "sniper", hullAngle: -1.8 },
      { id: "dummy_3", name: "Panser-Charlie 🎯", color: "#a855f7", avatar: "char:h3:c_a855f7:r3:e3:m3", offset: { x: 0, y: 140 }, weapon: "assault", hullAngle: 2.5 },
    ];

    dummyConfigs.forEach(d => {
      state.opponents[d.id] = {
        id: d.id,
        name: d.name,
        color: d.color,
        avatar: d.avatar,
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
        shield: 25,
        maxHealth: 100,
        maxShield: 100,
        weapon: d.weapon || "assault",
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

  function launchSoloPractice() {
    state.isSolo = true;
    state.roomCode = null;
    state.playerId = "solo_player";
    const selectedMapId = el.selectSoloMap ? el.selectSoloMap.value : "rust";
    state.mapId = selectedMapId;
    state.currentMap = getMapById(selectedMapId);
    state.scoreLimit = 999;
    state.timeLimit = 3600;
    state.timeRemaining = 3600;
    state.roomStatus = "playing";

    // Spawn player with chosen loadout
    spawnPlayer(state.player, state.currentMap);
    state.player.name = state.playerName || "Soldat";
    state.player.color = state.playerColor || "#ffd166";
    state.player.avatar = state.playerAvatar || "char:h1:c_ffd166:r1:e1:m1";
    state.player.kills = 0;
    state.player.deaths = 0;
    state.player.score = 0;
    state.player.streak = 0;

    state.bullets = [];
    state.particles = [];

    // Spawn shooting practice targets
    spawnSoloDummies(state.currentMap);

    showView("game");
    updateWeaponHUD();
    updateVitalsHUD();
    showStartWeaponOverlay();

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
    state.mapId = data.mapId || state.mapId || "rust";
    state.currentMap = getMapById(state.mapId);
    state.scoreLimit = data.scoreLimit || state.scoreLimit;
    state.timeLimit = data.timeLimit || state.timeLimit;
    state.timeRemaining = data.timeRemaining !== undefined ? data.timeRemaining : state.timeLimit;

    spawnPlayer(state.player, state.currentMap);
    state.player.name = state.playerName;
    state.player.color = state.playerColor;
    state.player.avatar = state.playerAvatar;

    state.opponents = {};
    state.bullets = [];
    state.particles = [];

    showView("game");
    updateWeaponHUD();
    updateVitalsHUD();
    showStartWeaponOverlay();

    if (data.status === "countdown") {
      if (el.countdownOverlay) el.countdownOverlay.classList.remove("hidden");
      const rem = Math.ceil(data.countdownRemaining || 3);
      if (el.countdownText) el.countdownText.textContent = rem > 0 ? String(rem) : "KJEMP! 💥";
    } else {
      if (el.countdownOverlay) el.countdownOverlay.classList.add("hidden");
    }

    startRoomSync();
    startSimulation();
  }

  function handleForfeitAndLeave() {
    stopSimulation();
    stopRoomSync();

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
            el.backBtnText.textContent = "Lounge";
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
            if (myPlayer.name) state.playerName = myPlayer.name;
            if (myPlayer.color) state.playerColor = myPlayer.color;
            if (myPlayer.avatar) state.playerAvatar = myPlayer.avatar;
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

    // In-game Start Weapon Modal confirmation button
    el.btnConfirmStartWeapon?.addEventListener("click", () => {
      hideStartWeaponOverlay();
    });

    // In-game Quick Weapon Bar click handlers
    if (el.quickWeaponBar) {
      el.quickWeaponBar.addEventListener("click", (e) => {
        const btn = e.target.closest(".qw-btn");
        if (btn && btn.dataset.weapon) {
          selectPlayerWeapon(btn.dataset.weapon, true);
        }
      });
    }

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

    // Solo Practice Start Button
    el.btnStartSoloPractice?.addEventListener("click", () => {
      launchSoloPractice();
    });

    // Sound toggle
    el.btnSoundToggle?.addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      el.btnSoundToggle.textContent = soundEnabled ? "🔊" : "🔇";
    });

    // Header Back button
    el.btnHeaderBack?.addEventListener("click", (e) => {
      if (state.view === "game") {
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
    el.btnPodiumReturnLobby?.addEventListener("click", () => {
      if (el.modalPodium) el.modalPodium.classList.add("hidden");
      if (state.isSolo) {
        launchSoloPractice();
      } else {
        handleForfeitAndLeave();
      }
    });

    el.btnPodiumReturnGateway?.addEventListener("click", () => {
      if (el.modalPodium) el.modalPodium.classList.add("hidden");
      stopSimulation();
      stopRoomSync();
      showView("lobby");
    });
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
