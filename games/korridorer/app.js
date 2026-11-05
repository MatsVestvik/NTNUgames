/**
 * Korridorer – Taktisk labyrintduell for 2–4 spillere (Quoridor)
 * Complete game engine, Web Audio effects, Local Pass & Play,
 * Solo vs AI bots, and real-time party room multiplayer.
 */

(() => {
  "use strict";

  // Available Mons Character Sprites in NTNU Games
  const MONS = [
    { id: "charbear", name: "Charbear", desc: "Ildbjørn", img: "/assets/mons/charbear.png" },
    { id: "jormundgandr", name: "Jørmungandr", desc: "Midgardsorm", img: "/assets/mons/jormundgandr.png" },
    { id: "pixiu", name: "Pixiu", desc: "Gulløve", img: "/assets/mons/pixiu.png" },
    { id: "squitonkey", name: "Squitonkey", desc: "Blekksprutape", img: "/assets/mons/squitonkey.png" },
    { id: "tanuki", name: "Tanuki", desc: "Mårhund", img: "/assets/mons/tanuki.png" },
    { id: "totter", name: "Totter", desc: "Elveoter", img: "/assets/mons/totter.png" },
  ];

  function getMonImg(avatarId) {
    if (typeof CharacterCreator !== "undefined") {
      return CharacterCreator.getAvatarImgSrc(avatarId);
    }
    if (!avatarId) return "/assets/mons/charbear.png";
    if (avatarId.startsWith("/") || avatarId.startsWith("data:")) return avatarId;
    const found = MONS.find(m => m.id === avatarId);
    return found ? found.img : `/assets/mons/${avatarId}.png`;
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

  // Player configuration defaults for up to 16 slots
  const PLAYER_DEFAULTS = [
    { slot: 0, color: "#ef4444", colorName: "Rød", start: [8, 4], goalDesc: "Nå rad 0 (øverst)", goalFn: (r, c) => r === 0, defaultAvatar: "charbear", defaultName: "Spiller 1" },
    { slot: 1, color: "#06b6d4", colorName: "Cyan", start: [0, 4], goalDesc: "Nå rad 8 (nederst)", goalFn: (r, c) => r === 8, defaultAvatar: "jormundgandr", defaultName: "Spiller 2" },
    { slot: 2, color: "#10b981", colorName: "Grønn", start: [5, 0], goalDesc: "Nå sentrum (rute 5, 5)", goalFn: (r, c) => r === 5 && c === 5, defaultAvatar: "tanuki", defaultName: "Spiller 3" },
    { slot: 3, color: "#a855f7", colorName: "Lilla", start: [5, 10], goalDesc: "Nå sentrum (rute 5, 5)", goalFn: (r, c) => r === 5 && c === 5, defaultAvatar: "squitonkey", defaultName: "Spiller 4" },
    { slot: 4, color: "#f59e0b", colorName: "Oransje", start: [10, 3], goalDesc: "Nå sentrum (rute 5, 5)", goalFn: (r, c) => r === 5 && c === 5, defaultAvatar: "pixiu", defaultName: "Spiller 5" },
    { slot: 5, color: "#ec4899", colorName: "Rosa", start: [0, 7], goalDesc: "Nå sentrum (rute 5, 5)", goalFn: (r, c) => r === 5 && c === 5, defaultAvatar: "totter", defaultName: "Spiller 6" },
    { slot: 6, color: "#3b82f6", colorName: "Blå", start: [3, 0], goalDesc: "Nå sentrum (rute 5, 5)", goalFn: (r, c) => r === 5 && c === 5, defaultAvatar: "charbear", defaultName: "Spiller 7" },
    { slot: 7, color: "#eab308", colorName: "Gul", start: [7, 10], goalDesc: "Nå sentrum (rute 5, 5)", goalFn: (r, c) => r === 5 && c === 5, defaultAvatar: "jormundgandr", defaultName: "Spiller 8" },
    { slot: 8, color: "#14b8a6", colorName: "Turkis", start: [10, 7], goalDesc: "Nå sentrum (rute 5, 5)", goalFn: (r, c) => r === 5 && c === 5, defaultAvatar: "tanuki", defaultName: "Spiller 9" },
    { slot: 9, color: "#f97316", colorName: "Korall", start: [0, 3], goalDesc: "Nå sentrum (rute 5, 5)", goalFn: (r, c) => r === 5 && c === 5, defaultAvatar: "squitonkey", defaultName: "Spiller 10" },
    { slot: 10, color: "#8b5cf6", colorName: "Indigo", start: [7, 0], goalDesc: "Nå sentrum (rute 5, 5)", goalFn: (r, c) => r === 5 && c === 5, defaultAvatar: "pixiu", defaultName: "Spiller 11" },
    { slot: 11, color: "#84cc16", colorName: "Lime", start: [3, 10], goalDesc: "Nå sentrum (rute 5, 5)", goalFn: (r, c) => r === 5 && c === 5, defaultAvatar: "totter", defaultName: "Spiller 12" },
    { slot: 12, color: "#f43f5e", colorName: "Rubin", start: [10, 1], goalDesc: "Nå sentrum (rute 5, 5)", goalFn: (r, c) => r === 5 && c === 5, defaultAvatar: "charbear", defaultName: "Spiller 13" },
    { slot: 13, color: "#0ea5e9", colorName: "Himmelblå", start: [0, 9], goalDesc: "Nå sentrum (rute 5, 5)", goalFn: (r, c) => r === 5 && c === 5, defaultAvatar: "jormundgandr", defaultName: "Spiller 14" },
    { slot: 14, color: "#d946ef", colorName: "Magentarosa", start: [1, 0], goalDesc: "Nå sentrum (rute 5, 5)", goalFn: (r, c) => r === 5 && c === 5, defaultAvatar: "tanuki", defaultName: "Spiller 15" },
    { slot: 15, color: "#22c55e", colorName: "Smaragd", start: [9, 10], goalDesc: "Nå sentrum (rute 5, 5)", goalFn: (r, c) => r === 5 && c === 5, defaultAvatar: "squitonkey", defaultName: "Spiller 16" },
  ];

  function getBoardSize() {
    return state.players && state.players.length > 2 ? 11 : 9;
  }

  function getPlayerStartPos(idx, numPlayers) {
    if (numPlayers > 2) {
      // 11x11 board: center is (5, 5), max index is 10
      const starts = [
        [10, 5], [0, 5], [5, 0], [5, 10],
        [10, 3], [0, 7], [3, 0], [7, 10],
        [10, 7], [0, 3], [7, 0], [3, 10],
        [10, 1], [0, 9], [1, 0], [9, 10],
      ];
      return starts[idx % starts.length] || [10, 5];
    }
    // 9x9 board for 2 players
    return idx === 0 ? [8, 4] : [0, 4];
  }

  function getPlayerGoalFn(idx) {
    const isMulti = state.players && state.players.length > 2;
    if (isMulti) {
      const mid = 5; // center of 11x11
      return (r, c) => r === mid && c === mid;
    }
    return idx === 0 ? (r, c) => r === 0 : (r, c) => r === 8;
  }

  // --- Web Audio Synthesizer ---
  const soundEngine = {
    ctx: null,
    enabled: true,

    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume();
      }
    },

    playPawnMove() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(320, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(160, this.ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.08);
      } catch (_) {}
    },

    playWallPlace() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(140, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
      } catch (_) {}
    },

    playWallRotate() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(540, this.ctx.currentTime);
        osc.frequency.setValueAtTime(680, this.ctx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.08);
      } catch (_) {}
    },

    playInvalid() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(130, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.14);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.14);
      } catch (_) {}
    },

    playTurn() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, this.ctx.currentTime + 0.07); // A5
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.18);
      } catch (_) {}
    },

    playVictory() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);
          gain.gain.setValueAtTime(0.3, now + idx * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.3);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + idx * 0.1);
          osc.stop(now + idx * 0.1 + 0.3);
        });
      } catch (_) {}
    },

    playReaction() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(420, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(740, this.ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
      } catch (_) {}
    },
  };

  // --- Quoridor Core Rules & Logic Engine ---
  function inBounds(r, c) {
    const sz = getBoardSize();
    return r >= 0 && r < sz && c >= 0 && c < sz;
  }

  function isPassageBlocked(r1, c1, r2, c2, wallsSet) {
    if (!inBounds(r2, c2)) return true;
    if (r2 === r1 - 1 && c2 === c1) {
      // North
      return wallsSet.has(`${r1 - 1},${c1 - 1},H`) || wallsSet.has(`${r1 - 1},${c1},H`);
    } else if (r2 === r1 + 1 && c2 === c1) {
      // South
      return wallsSet.has(`${r1},${c1 - 1},H`) || wallsSet.has(`${r1},${c1},H`);
    } else if (r2 === r1 && c2 === c1 - 1) {
      // West
      return wallsSet.has(`${r1 - 1},${c1 - 1},V`) || wallsSet.has(`${r1},${c1 - 1},V`);
    } else if (r2 === r1 && c2 === c1 + 1) {
      // East
      return wallsSet.has(`${r1 - 1},${c1},V`) || wallsSet.has(`${r1},${c1},V`);
    }
    return true;
  }

  function getValidPawnMoves(currPos, allPlayersPos, wallsSet) {
    const [r, c] = currPos;
    const moves = [];
    const directions = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];

    const occupied = new Set(
      allPlayersPos.filter(([pr, pc]) => !(pr === r && pc === c)).map(([pr, pc]) => `${pr},${pc}`)
    );

    for (const [dr, dc] of directions) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc) || isPassageBlocked(r, c, nr, nc, wallsSet)) continue;

      if (!occupied.has(`${nr},${nc}`)) {
        moves.push([nr, nc]);
      } else {
        // Adjacent square has an opponent -> check jumps
        const br = nr + dr;
        const bc = nc + dc;
        const canStraightJump =
          inBounds(br, bc) && !isPassageBlocked(nr, nc, br, bc, wallsSet) && !occupied.has(`${br},${bc}`);

        if (canStraightJump) {
          moves.push([br, bc]);
        } else {
          // Behind is blocked -> diagonal jumps
          const perpDirs = [
            [-dc, dr],
            [dc, -dr],
          ];
          for (const [pdr, pdc] of perpDirs) {
            const drDiag = nr + pdr;
            const dcDiag = nc + pdc;
            if (
              inBounds(drDiag, dcDiag) &&
              !isPassageBlocked(nr, nc, drDiag, dcDiag, wallsSet) &&
              !occupied.has(`${drDiag},${dcDiag}`)
            ) {
              moves.push([drDiag, dcDiag]);
            }
          }
        }
      }
    }

    // Return unique sorted moves
    const seen = new Set();
    const result = [];
    for (const m of moves) {
      const key = `${m[0]},${m[1]}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(m);
      }
    }
    return result;
  }

  function hasPathToGoal(startPos, goalFn, wallsSet) {
    const queue = [startPos];
    const visited = new Set([`${startPos[0]},${startPos[1]}`]);

    while (queue.length > 0) {
      const [cr, cc] = queue.shift();
      if (goalFn(cr, cc)) return true;

      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const nr = cr + dr;
        const nc = cc + dc;
        const key = `${nr},${nc}`;
        if (inBounds(nr, nc) && !visited.has(key)) {
          if (!isPassageBlocked(cr, cc, nr, nc, wallsSet)) {
            visited.add(key);
            queue.push([nr, nc]);
          }
        }
      }
    }
    return false;
  }

  function getShortestPathDistance(startPos, goalFn, wallsSet) {
    const queue = [[startPos[0], startPos[1], 0]];
    const visited = new Set([`${startPos[0]},${startPos[1]}`]);

    while (queue.length > 0) {
      const [cr, cc, dist] = queue.shift();
      if (goalFn(cr, cc)) return dist;

      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const nr = cr + dr;
        const nc = cc + dc;
        const key = `${nr},${nc}`;
        if (inBounds(nr, nc) && !visited.has(key)) {
          if (!isPassageBlocked(cr, cc, nr, nc, wallsSet)) {
            visited.add(key);
            queue.push([nr, nc, dist + 1]);
          }
        }
      }
    }
    return 999; // unreachable
  }

  function validateWallPlacement(r, c, orientation, wallsList, activePlayers) {
    const sz = getBoardSize();
    const maxSlot = sz - 2;
    if (r < 0 || r > maxSlot || c < 0 || c > maxSlot) {
      return { ok: false, error: `Vegg må være innenfor brettets ${maxSlot + 1}x${maxSlot + 1} kryss.` };
    }

    // Check collisions with existing walls
    for (const w of wallsList) {
      if (w.orientation === orientation) {
        if (orientation === "H" && w.r === r && Math.abs(w.c - c) <= 1) {
          return { ok: false, error: "Overlapper med en eksisterende horisontal vegg." };
        } else if (orientation === "V" && w.c === c && Math.abs(w.r - r) <= 1) {
          return { ok: false, error: "Overlapper med en eksisterende vertikal vegg." };
        }
      } else {
        if (w.r === r && w.c === c) {
          return { ok: false, error: "Vegger kan ikke krysse hverandre i midten." };
        }
      }
    }

    // Build candidate walls set
    const candidateSet = new Set(wallsList.map(w => `${w.r},${w.c},${w.orientation}`));
    candidateSet.add(`${r},${c},${orientation}`);

    // BFS path check for ALL players
    for (let i = 0; i < activePlayers.length; i++) {
      const p = activePlayers[i];
      const goalFn = getPlayerGoalFn(i);
      if (!hasPathToGoal(p.pos, goalFn, candidateSet)) {
        return { ok: false, error: `Blokkerer alle veier til målet for ${p.name}!` };
      }
    }

    return { ok: true };
  }

  // --- Client State ---
  const state = {
    mode: "online", // 'online', 'local', 'bot'
    gameActive: false,
    roomCode: null,
    playerId: null,
    playerIndex: 0,
    isHost: false,
    role: "p1", // 'p1', 'p2', 'p3', 'p4', 'spectator'
    pollTimer: null,
    lastPolledVersion: 0,

    // UI state
    actionState: "pawn", // 'pawn' or 'wall'
    wallOrientation: "H", // 'H' or 'V'
    hoveredBorder: null, // { r, c, orientation }
    hoveredIntersection: null, // [r, c] legacy compatibility
    stagedWall: null, // null or { r, c, orientation }

    // Active Match State
    players: [],
    walls: [],
    currentTurn: 0,
    winner: null,
    turnCount: 0,
    chatMessages: [],

    // Bot Config
    botDifficulty: "hard", // 'easy' or 'hard'
    isBotThinking: false,
  };

  // Saved preferences in localStorage
  const savedName = localStorage.getItem("korridorer_player_name") || localStorage.getItem("party_player_name") || "";
  const initialChar = (typeof CharacterCreator !== "undefined")
    ? CharacterCreator.getSavedCharacter()
    : { head: 1, headColor: "#f3c299", hair: 1, eyes: 1, brows: 1, nose: 1, mouth: 1 };
  const initialEncodedChar = (typeof CharacterCreator !== "undefined")
    ? CharacterCreator.encodeConfig(initialChar)
    : "char:h1:c_f3c299:r1:e1:b1:n1:m1";

  let selectedCreateAvatar = localStorage.getItem("korridorer_character") || localStorage.getItem("korridorer_avatar") || initialEncodedChar;
  if (!selectedCreateAvatar.startsWith("char:") && !selectedCreateAvatar.startsWith("data:")) {
    selectedCreateAvatar = initialEncodedChar;
  }
  let selectedJoinAvatar = selectedCreateAvatar;
  let selectedBotAvatar = selectedCreateAvatar;
  let createMaxPlayers = 4;
  let localPlayersCount = 2;
  let botPlayersCount = 2;

  // Local Pass & Play temporary player settings
  const localConfig = Array.from({ length: 16 }, (_, idx) => {
    if (idx === 0) return { name: savedName || "Spiller 1", avatar: selectedCreateAvatar };
    const defaultAvatars = [
      "char:h1:c_06d6a0:r2:e2:m2",
      "char:h1:c_ef476f:r3:e3:m3",
      "char:h1:c_8338ec:r1:e1:m1",
      "char:h2:c_f59e0b:r1:e2:m1",
      "char:h2:c_ec4899:r2:e1:m3",
      "char:h3:c_3b82f6:r3:e3:m2",
      "char:h3:c_eab308:r1:e1:m2",
    ];
    return {
      name: `Spiller ${idx + 1}`,
      avatar: defaultAvatars[(idx - 1) % defaultAvatars.length],
    };
  });

  // DOM Elements
  const el = {
    viewLobby: document.getElementById("viewLobby"),
    viewWaitingRoom: document.getElementById("viewWaitingRoom"),
    viewGame: document.getElementById("viewGame"),

    // Header
    btnAudioToggle: document.getElementById("btnAudioToggle"),
    audioIcon: document.getElementById("audioIcon"),
    btnRulesModal: document.getElementById("btnRulesModal"),
    btnLeaveRoomHeader: document.getElementById("btnLeaveRoomHeader"),

    // Lobby Tabs
    tabOnline: document.getElementById("tabOnline"),
    tabLocal: document.getElementById("tabLocal"),
    tabBot: document.getElementById("tabBot"),
    panelOnline: document.getElementById("panelOnline"),
    panelLocal: document.getElementById("panelLocal"),
    panelBot: document.getElementById("panelBot"),

    // Online Lobby Form & Character Widget
    createPlayerName: document.getElementById("createPlayerName"),
    onlineAvatarPreview: document.getElementById("onlineAvatarPreview"),
    btnPreviewAvatarClick: document.getElementById("btnPreviewAvatarClick"),
    btnOpenCharCreator: document.getElementById("btnOpenCharCreator"),
    btnQuickRandomChar: document.getElementById("btnQuickRandomChar"),
    cpwQuickColors: document.getElementById("cpwQuickColors"),
    pickerCreateSprite: document.getElementById("pickerCreateSprite"),
    controlPlayerCount: document.getElementById("controlPlayerCount"),
    btnSubmitCreate: document.getElementById("btnSubmitCreate"),

    joinRoomCode: document.getElementById("joinRoomCode"),
    joinPlayerName: document.getElementById("joinPlayerName"),
    pickerJoinSprite: document.getElementById("pickerJoinSprite"),
    btnSubmitJoin: document.getElementById("btnSubmitJoin"),

    // Waiting Room
    dispRoomCode: document.getElementById("dispRoomCode"),
    dispWaitingSubtitle: document.getElementById("dispWaitingSubtitle"),
    containerWaitingSlots: document.getElementById("containerWaitingSlots"),
    btnHostStartOnline: document.getElementById("btnHostStartOnline"),
    btnAddBotOnline: document.getElementById("btnAddBotOnline"),
    dispHostHint: document.getElementById("dispHostHint"),
    btnCopyInviteLink: document.getElementById("btnCopyInviteLink"),

    // Local Tab
    controlLocalCount: document.getElementById("controlLocalCount"),
    localPlayersList: document.getElementById("localPlayersList"),
    btnStartLocal: document.getElementById("btnStartLocal"),

    // Bot Tab
    botPlayerName: document.getElementById("botPlayerName"),
    botAvatarPreview: document.getElementById("botAvatarPreview"),
    btnPreviewAvatarBotClick: document.getElementById("btnPreviewAvatarBotClick"),
    btnOpenCharCreatorBot: document.getElementById("btnOpenCharCreatorBot"),
    btnRandomCharBot: document.getElementById("btnRandomCharBot"),
    pickerBotSprite: document.getElementById("pickerBotSprite"),
    controlBotCount: document.getElementById("controlBotCount"),
    controlBotDiff: document.getElementById("controlBotDiff"),
    btnStartBot: document.getElementById("btnStartBot"),

    // Game Arena
    turnAnnouncer: document.getElementById("turnAnnouncer"),
    turnPawnImg: document.getElementById("turnPawnImg"),
    turnLabel: document.getElementById("turnLabel"),
    turnSub: document.getElementById("turnSub"),
    btnModePawn: document.getElementById("btnModePawn"),
    btnModeWall: document.getElementById("btnModeWall"),
    btnRotateWall: document.getElementById("btnRotateWall"),
    btnWallsCount: document.getElementById("btnWallsCount"),
    labelOrientation: document.getElementById("labelOrientation"),

    colPlayersLeft: document.getElementById("colPlayersLeft"),
    colPlayersRight: document.getElementById("colPlayersRight"),

    boardWrapper: document.getElementById("boardWrapper"),
    boardCells: document.getElementById("boardCells"),
    boardWallsLayer: document.getElementById("boardWallsLayer"),
    boardGroovesLayer: document.getElementById("boardGroovesLayer"),
    goalNorth: document.getElementById("goalNorth"),
    goalSouth: document.getElementById("goalSouth"),
    goalWest: document.getElementById("goalWest"),
    goalEast: document.getElementById("goalEast"),

    // Floating On-Board Wall Toolbar & Tooltip
    floatingWallToolbar: document.getElementById("floatingWallToolbar"),
    btnFloatRotate: document.getElementById("btnFloatRotate"),
    btnFloatConfirm: document.getElementById("btnFloatConfirm"),
    btnFloatCancel: document.getElementById("btnFloatCancel"),
    ghostWallTooltip: document.getElementById("ghostWallTooltip"),

    // Ergonomic Action Command Dock
    gameActionDock: document.getElementById("gameActionDock"),
    btnDockPawn: document.getElementById("btnDockPawn"),
    btnDockWall: document.getElementById("btnDockWall"),
    btnDockRotate: document.getElementById("btnDockRotate"),
    dockWallsLeft: document.getElementById("dockWallsLeft"),
    dockRotateTitle: document.getElementById("dockRotateTitle"),
    dockRotateBadge: document.getElementById("dockRotateBadge"),

    btnRestartGame: document.getElementById("btnRestartGame"),
    btnBackToLobby: document.getElementById("btnBackToLobby"),
    chatToastContainer: document.getElementById("chatToastContainer"),

    // Modals
    modalRules: document.getElementById("modalRules"),
    btnCloseRules: document.getElementById("btnCloseRules"),
    btnDismissRules: document.getElementById("btnDismissRules"),

    modalVictory: document.getElementById("modalVictory"),
    victoryWinnerImg: document.getElementById("victoryWinnerImg"),
    victoryTitle: document.getElementById("victoryTitle"),
    victoryDesc: document.getElementById("victoryDesc"),
    statTurnCount: document.getElementById("statTurnCount"),
    statWallsPlaced: document.getElementById("statWallsPlaced"),
    btnVictoryRematch: document.getElementById("btnVictoryRematch"),
    btnVictoryLounge: document.getElementById("btnVictoryLounge"),
    btnVictoryLobby: document.getElementById("btnVictoryLobby"),
  };

  // --- Initial Setup & Event Listeners ---
  function init() {
    // Populate stored names
    if (savedName) {
      if (el.createPlayerName) el.createPlayerName.value = savedName;
      if (el.joinPlayerName) el.joinPlayerName.value = savedName;
      if (el.botPlayerName) el.botPlayerName.value = savedName;
    }

    // Initialize & update character previews
    updateCharacterPreviews();

    // Event listeners for character creation
    if (el.btnOpenCharCreator) {
      el.btnOpenCharCreator.addEventListener("click", () => openCharacterCreatorModal());
    }
    if (el.btnPreviewAvatarClick) {
      el.btnPreviewAvatarClick.addEventListener("click", () => openCharacterCreatorModal());
    }
    if (el.btnQuickRandomChar) {
      el.btnQuickRandomChar.addEventListener("click", () => randomizePlayerCharacter());
    }

    if (el.btnOpenCharCreatorBot) {
      el.btnOpenCharCreatorBot.addEventListener("click", () => openCharacterCreatorModal());
    }
    if (el.btnPreviewAvatarBotClick) {
      el.btnPreviewAvatarBotClick.addEventListener("click", () => openCharacterCreatorModal());
    }
    if (el.btnRandomCharBot) {
      el.btnRandomCharBot.addEventListener("click", () => randomizePlayerCharacter());
    }

    // Keep name inputs synced
    if (el.createPlayerName) {
      el.createPlayerName.addEventListener("input", e => {
        const val = e.target.value;
        if (el.joinPlayerName) el.joinPlayerName.value = val;
        localStorage.setItem("korridorer_player_name", val);
      });
    }

    // Global event listener when character is updated anywhere
    window.addEventListener("spillhjornet:characterUpdated", e => {
      if (e.detail && e.detail.encoded) {
        selectedCreateAvatar = e.detail.encoded;
        selectedJoinAvatar = e.detail.encoded;
        selectedBotAvatar = e.detail.encoded;
        localConfig[0].avatar = e.detail.encoded;
        updateCharacterPreviews();
        renderLocalPlayersSetup();
      }
    });

    renderLocalPlayersSetup();
    renderBoardBaseGrid();

    setupUIEventListeners();
    checkUrlQueryParams();
  }

  // Update Character Previews across views and quick swatches
  function updateCharacterPreviews() {
    const src = getMonImg(selectedCreateAvatar);
    if (el.onlineAvatarPreview) el.onlineAvatarPreview.src = src;
    if (el.botAvatarPreview) el.botAvatarPreview.src = getMonImg(selectedBotAvatar);

    // Populate quick color swatches
    if (el.cpwQuickColors && typeof CharacterCreator !== "undefined") {
      el.cpwQuickColors.innerHTML = "";
      const currentCfg = CharacterCreator.parseConfig(selectedCreateAvatar);
      CharacterCreator.HEAD_COLORS.slice(0, 10).forEach(col => {
        const sw = document.createElement("button");
        sw.type = "button";
        sw.className = `cpw-quick-swatch ${col.hex.toLowerCase() === currentCfg.headColor.toLowerCase() ? "active" : ""}`;
        sw.style.backgroundColor = col.hex;
        sw.title = col.name;
        sw.addEventListener("click", () => {
          currentCfg.headColor = col.hex;
          const encoded = CharacterCreator.saveCharacter(currentCfg);
          selectedCreateAvatar = encoded;
          selectedJoinAvatar = encoded;
          selectedBotAvatar = encoded;
          localConfig[0].avatar = encoded;
          updateCharacterPreviews();
          renderLocalPlayersSetup();
          soundEngine.playPawnMove();
        });
        el.cpwQuickColors.appendChild(sw);
      });
    }
  }

  // Open Full Character Creator Modal
  function openCharacterCreatorModal(onSavedCallback) {
    if (typeof CharacterCreator === "undefined") return;
    CharacterCreator.openModal({
      initialConfig: selectedCreateAvatar,
      onSave: (newCfg, dataUrl) => {
        const encoded = CharacterCreator.encodeConfig(newCfg);
        selectedCreateAvatar = encoded;
        selectedJoinAvatar = encoded;
        selectedBotAvatar = encoded;
        localConfig[0].avatar = encoded;
        updateCharacterPreviews();
        renderLocalPlayersSetup();
        soundEngine.playWallRotate();
        if (onSavedCallback) onSavedCallback(encoded);
      }
    });
  }

  // Quick Randomize Player Character
  function randomizePlayerCharacter() {
    if (typeof CharacterCreator === "undefined") return;
    const rnd = CharacterCreator.getRandomConfig();
    const encoded = CharacterCreator.saveCharacter(rnd);
    selectedCreateAvatar = encoded;
    selectedJoinAvatar = encoded;
    selectedBotAvatar = encoded;
    localConfig[0].avatar = encoded;
    updateCharacterPreviews();
    renderLocalPlayersSetup();
    soundEngine.playWallRotate();
  }

  // Render Sprite Picker Chips (Legacy fallback)
  function renderSpritePicker(container, selectedId, onSelect) {
    if (!container) return;
    container.innerHTML = "";
  }

  // Render Local Pass & Play Configuration Rows with Character Customizer
  function renderLocalPlayersSetup() {
    if (!el.localPlayersList) return;
    el.localPlayersList.innerHTML = "";

    for (let i = 0; i < localPlayersCount; i++) {
      const cfg = PLAYER_DEFAULTS[i];
      const pData = localConfig[i];
      const row = document.createElement("div");
      row.className = "local-player-row";

      row.innerHTML = `
        <span class="local-p-badge" style="background:${cfg.color};">P${i + 1}</span>
        <button type="button" class="local-p-avatar-btn" id="btnLocalAvatarP${i}" title="Tilpass figur for Spiller ${i + 1}">
          <img src="${getMonImg(pData.avatar)}" class="local-p-avatar-img" id="imgLocalAvatarP${i}" alt="Figur" />
        </button>
        <input type="text" class="local-p-input" id="inputLocalNameP${i}" maxlength="18" value="${pData.name}" placeholder="${cfg.defaultName}" />
        <button type="button" class="btn-local-random" id="btnLocalRandomP${i}" title="Tilfeldig figur">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"></circle><circle cx="15.5" cy="15.5" r="1.5" fill="currentColor"></circle><circle cx="15.5" cy="8.5" r="1.5" fill="currentColor"></circle><circle cx="8.5" cy="15.5" r="1.5" fill="currentColor"></circle><circle cx="12" cy="12" r="1.5" fill="currentColor"></circle></svg>
        </button>
      `;

      // Open character creator on avatar click
      const btnAv = row.querySelector(`#btnLocalAvatarP${i}`);
      const imgAv = row.querySelector(`#imgLocalAvatarP${i}`);
      btnAv.addEventListener("click", () => {
        if (typeof CharacterCreator !== "undefined") {
          CharacterCreator.openModal({
            initialConfig: pData.avatar,
            title: `Tilpass figur: Spiller ${i + 1}`,
            onSave: (newCfg, dataUrl) => {
              const enc = CharacterCreator.encodeConfig(newCfg);
              pData.avatar = enc;
              imgAv.src = dataUrl || getMonImg(enc);
              if (i === 0) {
                selectedCreateAvatar = enc;
                selectedJoinAvatar = enc;
                selectedBotAvatar = enc;
                updateCharacterPreviews();
              }
              soundEngine.playWallRotate();
            }
          });
        }
      });

      // Quick randomizer for local player
      const btnRnd = row.querySelector(`#btnLocalRandomP${i}`);
      btnRnd.addEventListener("click", () => {
        if (typeof CharacterCreator !== "undefined") {
          const rnd = CharacterCreator.getRandomConfig();
          const enc = CharacterCreator.encodeConfig(rnd);
          pData.avatar = enc;
          imgAv.src = getMonImg(enc);
          if (i === 0) {
            selectedCreateAvatar = enc;
            selectedJoinAvatar = enc;
            selectedBotAvatar = enc;
            updateCharacterPreviews();
          }
          soundEngine.playWallRotate();
        }
      });

      // Name change listener
      const inputName = row.querySelector(`#inputLocalNameP${i}`);
      inputName.addEventListener("input", e => {
        pData.name = e.target.value.trim() || cfg.defaultName;
        if (i === 0) {
          if (el.createPlayerName) el.createPlayerName.value = pData.name;
          if (el.joinPlayerName) el.joinPlayerName.value = pData.name;
          localStorage.setItem("korridorer_player_name", pData.name);
        }
      });

      el.localPlayersList.appendChild(row);
    }
  }

  let currentGridSize = 0;

  function ensureBoardGridSize() {
    const desiredSize = getBoardSize();
    if (currentGridSize !== desiredSize) {
      renderBoardBaseGrid(desiredSize);
      currentGridSize = desiredSize;
    }
  }

  // Render static board cells and border slots based on board size (9x9 for 2p, 11x11 for >2p)
  function renderBoardBaseGrid(size) {
    if (!el.boardCells || !el.boardGroovesLayer) return;
    const sz = size || getBoardSize();
    currentGridSize = sz;

    if (el.boardWrapper) {
      el.boardWrapper.style.setProperty("--board-size", sz);
      el.boardWrapper.style.setProperty("--board-gap", sz > 9 ? "6px" : "8px");
    }

    el.boardCells.innerHTML = "";
    el.boardGroovesLayer.innerHTML = "";

    // Cells: sz rows x sz columns
    for (let r = 0; r < sz; r++) {
      for (let c = 0; c < sz; c++) {
        const cell = document.createElement("div");
        cell.className = "board-cell";
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.id = `cell_${r}_${c}`;

        cell.addEventListener("click", () => onCellClicked(r, c));
        el.boardCells.appendChild(cell);
      }
    }

    // Horizontal border slots (r: 0 to sz-2, c: 0 to sz-2)
    for (let r = 0; r < sz - 1; r++) {
      for (let c = 0; c < sz - 1; c++) {
        const slotH = document.createElement("div");
        slotH.className = "border-slot border-slot-h";
        slotH.dataset.r = r;
        slotH.dataset.c = c;
        slotH.dataset.orientation = "H";
        slotH.style.top = `${((r + 1) / sz) * 100}%`;
        slotH.style.left = `${(c / sz) * 100}%`;
        slotH.style.width = `${(2 / sz) * 100}%`;

        slotH.addEventListener("mouseenter", () => onBorderHover(r, c, "H"));
        slotH.addEventListener("mouseleave", () => onBorderLeave(r, c, "H"));
        slotH.addEventListener("click", () => onBorderClick(r, c, "H"));
        el.boardGroovesLayer.appendChild(slotH);
      }
    }

    // Vertical border slots (r: 0 to sz-2, c: 0 to sz-2)
    for (let r = 0; r < sz - 1; r++) {
      for (let c = 0; c < sz - 1; c++) {
        const slotV = document.createElement("div");
        slotV.className = "border-slot border-slot-v";
        slotV.dataset.r = r;
        slotV.dataset.c = c;
        slotV.dataset.orientation = "V";
        slotV.style.left = `${((c + 1) / sz) * 100}%`;
        slotV.style.top = `${(r / sz) * 100}%`;
        slotV.style.height = `${(2 / sz) * 100}%`;

        slotV.addEventListener("mouseenter", () => onBorderHover(r, c, "V"));
        slotV.addEventListener("mouseleave", () => onBorderLeave(r, c, "V"));
        slotV.addEventListener("click", () => onBorderClick(r, c, "V"));
        el.boardGroovesLayer.appendChild(slotV);
      }
    }
  }

  function updateAudioIcon() {
    if (!el.audioIcon) return;
    el.audioIcon.innerHTML = soundEngine.enabled
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`;
  }

  // --- UI Event Listeners ---
  function setupUIEventListeners() {
    // Audio Toggle
    el.btnAudioToggle.addEventListener("click", () => {
      soundEngine.enabled = !soundEngine.enabled;
      updateAudioIcon();
    });
    updateAudioIcon();

    // Rules Modal
    el.btnRulesModal.addEventListener("click", () => el.modalRules.classList.remove("hidden"));
    el.btnCloseRules.addEventListener("click", () => el.modalRules.classList.add("hidden"));
    el.btnDismissRules.addEventListener("click", () => el.modalRules.classList.add("hidden"));
    el.modalRules.addEventListener("click", e => {
      if (e.target === el.modalRules) el.modalRules.classList.add("hidden");
    });

    // Header Leave Room
    el.btnLeaveRoomHeader.addEventListener("click", () => {
      leaveToLobby();
    });

    // Lobby Tabs Switching
    el.tabOnline.addEventListener("click", () => switchLobbyTab("online"));
    el.tabLocal.addEventListener("click", () => switchLobbyTab("local"));
    el.tabBot.addEventListener("click", () => switchLobbyTab("bot"));

    // Helper to wire a player-count-picker (slider + +/- buttons + direct number input)
    function bindPlayerCountPicker(container, initialVal, onChange) {
      if (!container) return;
      const slider = container.querySelector(".pcp-slider");
      const numInput = container.querySelector(".pcp-number-input");
      const stepBtns = container.querySelectorAll(".pcp-step-btn");

      function applyCount(rawVal, commitInput = true) {
        const parsed = parseInt(rawVal, 10);
        if (Number.isNaN(parsed)) return;
        const clamped = Math.max(2, Math.min(16, parsed));
        if (slider) slider.value = String(clamped);
        if (numInput && commitInput) numInput.value = String(clamped);
        onChange(clamped);
      }

      if (slider) {
        slider.value = String(initialVal);
        slider.addEventListener("input", () => applyCount(slider.value, true));
      }
      if (numInput) {
        numInput.value = String(initialVal);
        numInput.addEventListener("input", () => {
          const v = parseInt(numInput.value, 10);
          if (!Number.isNaN(v) && v >= 2 && v <= 16) {
            if (slider) slider.value = String(v);
            onChange(v);
          }
        });
        numInput.addEventListener("change", () => applyCount(numInput.value, true));
        numInput.addEventListener("blur", () => applyCount(numInput.value || initialVal, true));
      }
      stepBtns.forEach(btn => {
        btn.addEventListener("click", () => {
          const step = parseInt(btn.dataset.step || "0", 10);
          const current = parseInt((numInput && numInput.value) || (slider && slider.value) || initialVal, 10) || initialVal;
          applyCount(current + step, true);
        });
      });
    }

    // Online Mode Controls
    bindPlayerCountPicker(el.controlPlayerCount, createMaxPlayers, val => {
      createMaxPlayers = val;
    });

    el.btnSubmitCreate.addEventListener("click", handleCreateOnlineRoom);
    el.btnSubmitJoin.addEventListener("click", handleJoinOnlineRoom);
    el.btnCopyInviteLink.addEventListener("click", handleCopyInviteLink);
    el.btnHostStartOnline.addEventListener("click", handleHostStartOnline);
    if (el.btnAddBotOnline) {
      el.btnAddBotOnline.addEventListener("click", handleAddBotOnline);
    }

    // Local Mode Controls
    bindPlayerCountPicker(el.controlLocalCount, localPlayersCount, val => {
      localPlayersCount = val;
      renderLocalPlayersSetup();
    });
    el.btnStartLocal.addEventListener("click", handleStartLocalGame);

    // Bot Mode Controls
    bindPlayerCountPicker(el.controlBotCount, botPlayersCount, val => {
      botPlayersCount = val;
    });

    el.controlBotDiff.querySelectorAll(".seg-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        el.controlBotDiff.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.botDifficulty = btn.dataset.diff;
      });
    });
    el.btnStartBot.addEventListener("click", handleStartBotGame);

    // In-Game Mode Toggles (if present)
    if (el.btnModePawn) el.btnModePawn.addEventListener("click", () => setActionState("pawn"));
    if (el.btnModeWall) el.btnModeWall.addEventListener("click", () => setActionState("wall"));
    if (el.btnRotateWall) el.btnRotateWall.addEventListener("click", toggleWallOrientation);

    // Ergonomic Action Command Dock Listeners (if present)
    if (el.btnDockPawn) el.btnDockPawn.addEventListener("click", () => setActionState("pawn"));
    if (el.btnDockWall) el.btnDockWall.addEventListener("click", () => setActionState("wall"));
    if (el.btnDockRotate) el.btnDockRotate.addEventListener("click", toggleWallOrientation);

    // Floating On-Board Wall Toolbar Buttons
    if (el.btnFloatRotate) {
      el.btnFloatRotate.addEventListener("click", e => {
        e.stopPropagation();
        toggleWallOrientation();
      });
    }
    if (el.btnFloatConfirm) {
      el.btnFloatConfirm.addEventListener("click", e => {
        e.stopPropagation();
        confirmStagedWall();
      });
    }
    if (el.btnFloatCancel) {
      el.btnFloatCancel.addEventListener("click", e => {
        e.stopPropagation();
        clearStagedWall();
      });
    }

    // Board Wrapper right-click & wheel rotation, and outside click to cancel
    if (el.boardWrapper) {
      el.boardWrapper.addEventListener("contextmenu", e => {
        e.preventDefault();
        toggleWallOrientation();
      });

      let lastWheelTime = 0;
      el.boardWrapper.addEventListener("wheel", () => {
        const now = Date.now();
        if (now - lastWheelTime > 160) {
          lastWheelTime = now;
          toggleWallOrientation();
        }
      }, { passive: true });

      el.boardWrapper.addEventListener("click", e => {
        if (e.target === el.boardWrapper || e.target === el.boardWallsLayer || e.target === el.boardGroovesLayer) {
          clearStagedWall();
        }
      });
    }

    // Keyboard Shortcuts (Arrow keys / WASD for pawn movement, R for rotation, V for mode toggle, Enter to confirm staged wall)
    window.addEventListener("keydown", e => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if (e.key === "Enter") {
        if (state.stagedWall) {
          e.preventDefault();
          confirmStagedWall();
          return;
        }
      }

      if (e.key === "r" || e.key === "R" || e.code === "Space") {
        e.preventDefault();
        toggleWallOrientation();
        return;
      }

      if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        setActionState(state.actionState === "pawn" ? "wall" : "pawn");
        return;
      }

      if (e.key === "Escape") {
        el.modalRules.classList.add("hidden");
        el.modalVictory.classList.add("hidden");
        clearStagedWall();
        return;
      }

      // Arrow keys / WASD for pawn movement
      if (state.gameActive) {
        const isMyTurn =
          state.mode === "online"
            ? state.playerIndex === state.currentTurn
            : state.mode === "bot"
            ? state.currentTurn === 0
            : true;

        if (isMyTurn) {
          const curPlayer = state.players[state.currentTurn];
          if (curPlayer) {
            let dir = null;
            if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") dir = [-1, 0];
            else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") dir = [1, 0];
            else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") dir = [0, -1];
            else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") dir = [0, 1];

            if (dir) {
              e.preventDefault();
              const wallsSet = new Set(state.walls.map(w => `${w.r},${w.c},${w.orientation}`));
              const allPos = state.players.map(p => p.pos);
              const validMoves = getValidPawnMoves(curPlayer.pos, allPos, wallsSet);

              const [dr, dc] = dir;
              const [cr, cc] = curPlayer.pos;
              // Check single step or jump 2 steps in that direction
              const target = validMoves.find(
                ([mr, mc]) => (mr === cr + dr && mc === cc + dc) || (mr === cr + dr * 2 && mc === cc + dc * 2)
              );
              if (target) {
                commitPawnMove(target[0], target[1]);
              } else {
                soundEngine.playInvalid();
              }
            }
          }
        }
      }
    });

    // In-Game Reactions
    document.querySelectorAll(".reaction-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const msg = btn.dataset.msg || btn.dataset.emoji || btn.textContent.trim();
        if (msg) sendReaction(msg);
      });
    });

    // In-Game Footer Controls
    el.btnRestartGame.addEventListener("click", handleRequestRematch);
    el.btnBackToLobby.addEventListener("click", leaveToLobby);

    // Victory Modal Buttons
    el.btnVictoryRematch.addEventListener("click", () => {
      el.modalVictory.classList.add("hidden");
      handleRequestRematch();
    });
    if (el.btnVictoryLounge) {
      el.btnVictoryLounge.addEventListener("click", () => {
        el.modalVictory.classList.add("hidden");
        leaveToLobby();
      });
    }
    el.btnVictoryLobby.addEventListener("click", () => {
      el.modalVictory.classList.add("hidden");
      leaveToLobby();
    });
  }

  function switchLobbyTab(tabName) {
    [el.tabOnline, el.tabLocal, el.tabBot].forEach(b => b.classList.remove("active"));
    [el.panelOnline, el.panelLocal, el.panelBot].forEach(p => p.classList.add("hidden"));

    if (tabName === "online") {
      el.tabOnline.classList.add("active");
      el.panelOnline.classList.remove("hidden");
    } else if (tabName === "local") {
      el.tabLocal.classList.add("active");
      el.panelLocal.classList.remove("hidden");
    } else if (tabName === "bot") {
      el.tabBot.classList.add("active");
      el.panelBot.classList.remove("hidden");
    }
  }

  function checkUrlQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room") || params.get("code");
    const playerParam = params.get("player");

    if (roomParam) {
      const code = roomParam.trim().toUpperCase();
      if (el.joinRoomCode) el.joinRoomCode.value = code;

      if (playerParam) {
        // Direct launch from Party Lounge bridge!
        state.mode = "online";
        state.roomCode = code;
        state.playerId = playerParam;
        sessionStorage.setItem("party_room_code", code);
        sessionStorage.setItem("party_player_id", playerParam);
        if (el.btnLeaveRoomHeader) {
          el.btnLeaveRoomHeader.textContent = "‹ Lounge";
        }
        startOnlineRoomPolling();
      } else {
        switchLobbyTab("online");
      }
    }
  }

  // --- ONLINE MULTIPLAYER HANDLERS ---
  async function handleCreateOnlineRoom() {
    const name = el.createPlayerName.value.trim() || "Spiller 1";
    localStorage.setItem("korridorer_player_name", name);

    if (window.PartyConnect) {
      window.PartyConnect.createParty({
        hostName: name,
        avatar: selectedCreateAvatar,
        preferredGame: "korridorer",
        btnElement: el.btnSubmitCreate,
      });
      return;
    }

    el.btnSubmitCreate.disabled = true;
    el.btnSubmitCreate.textContent = "Oppretter rom…";

    try {
      const resp = await fetch("/api/korridorer/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostName: name,
          avatar: selectedCreateAvatar,
          maxPlayers: createMaxPlayers,
        }),
      });

      const data = await resp.json();
      if (!data.ok) {
        alert(data.error || "Kunne ikke opprette rom.");
        el.btnSubmitCreate.disabled = false;
        el.btnSubmitCreate.textContent = "Opprett rom";
        return;
      }

      state.mode = "online";
      state.roomCode = data.roomCode;
      state.playerId = data.playerId;
      state.playerIndex = 0;
      state.isHost = true;
      state.role = "p1";

      startOnlineRoomPolling();
    } catch (err) {
      console.error(err);
      alert("Nettverksfeil ved opprettelse av rom.");
      el.btnSubmitCreate.disabled = false;
      el.btnSubmitCreate.textContent = "Opprett rom";
    }
  }

  async function handleJoinOnlineRoom() {
    const code = el.joinRoomCode.value.trim().toUpperCase();
    const name = (el.createPlayerName ? el.createPlayerName.value.trim() : "") || el.joinPlayerName.value.trim() || "Spiller";

    if (!code) {
      alert("Vennligst skriv inn en 4-bokstavs romkode.");
      return;
    }

    localStorage.setItem("korridorer_player_name", name);

    if (window.PartyConnect) {
      window.PartyConnect.joinParty({
        roomCode: code,
        playerName: name,
        avatar: selectedCreateAvatar || selectedJoinAvatar,
        btnElement: el.btnSubmitJoin,
      });
      return;
    }

    el.btnSubmitJoin.disabled = true;
    el.btnSubmitJoin.textContent = "Kobler til…";

    try {
      const resp = await fetch("/api/korridorer/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: code,
          playerName: name,
          avatar: selectedJoinAvatar,
        }),
      });

      const data = await resp.json();
      if (!data.ok) {
        alert(data.error || "Kunne ikke bli med i rommet.");
        el.btnSubmitJoin.disabled = false;
        el.btnSubmitJoin.textContent = "Koble til parti";
        return;
      }

      state.mode = "online";
      state.roomCode = data.roomCode;
      state.playerId = data.playerId;
      state.playerIndex = data.playerIndex || 0;
      state.isHost = Boolean(data.isHost);
      state.role = data.role || "p2";

      startOnlineRoomPolling();
    } catch (err) {
      console.error(err);
      alert("Nettverksfeil ved tilkobling til rom.");
      el.btnSubmitJoin.disabled = false;
      el.btnSubmitJoin.textContent = "Koble til parti";
    }
  }

  function handleCopyInviteLink() {
    const joinUrl = `${window.location.origin}/korridorer/?room=${encodeURIComponent(state.roomCode)}`;
    navigator.clipboard
      .writeText(joinUrl)
      .then(() => {
        const orig = el.btnCopyInviteLink.textContent;
        el.btnCopyInviteLink.textContent = "Kopiert!";
        setTimeout(() => (el.btnCopyInviteLink.textContent = orig), 2000);
      })
      .catch(() => alert(`Kopier denne lenken: ${joinUrl}`));
  }

  async function handleHostStartOnline() {
    if (!state.isHost || !state.roomCode) return;
    el.btnHostStartOnline.disabled = true;
    el.btnHostStartOnline.textContent = "Starter spill…";

    try {
      const resp = await fetch("/api/korridorer/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
        }),
      });
      const data = await resp.json();
      if (!data.ok) {
        alert(data.error || "Kunne ikke starte spill.");
        el.btnHostStartOnline.disabled = false;
        el.btnHostStartOnline.textContent = "Start spill nå";
      } else if (data.state) {
        syncOnlineState(data.state);
      }
    } catch (err) {
      console.error(err);
      el.btnHostStartOnline.disabled = false;
      el.btnHostStartOnline.textContent = "Start spill nå";
    }
  }

  async function handleAddBotOnline() {
    if (!state.isHost || !state.roomCode) return;
    if (el.btnAddBotOnline) {
      el.btnAddBotOnline.disabled = true;
      el.btnAddBotOnline.textContent = "Legger til…";
    }

    try {
      const resp = await fetch("/api/korridorer/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
        }),
      });
      const data = await resp.json();
      if (!data.ok) {
        alert(data.error || "Kunne ikke legge til bot.");
      } else if (data.state) {
        syncOnlineState(data.state);
      }
    } catch (err) {
      console.error(err);
      alert("Nettverksfeil ved tilføyelse av bot.");
    } finally {
      if (el.btnAddBotOnline) {
        el.btnAddBotOnline.disabled = false;
        el.btnAddBotOnline.textContent = "+ Legg til bot";
      }
    }
  }

  function startOnlineRoomPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);

    el.btnLeaveRoomHeader.classList.remove("hidden");

    async function poll() {
      if (!state.roomCode) return;
      try {
        const url = `/api/korridorer/state?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId || "")}`;
        const resp = await fetch(url);
        if (!resp.ok) return;

        const data = await resp.json();
        if (data.ok) {
          syncOnlineState(data);
        }
      } catch (err) {
        console.warn("Polling hiccup:", err);
      }
    }

    state.pollTimer = setInterval(poll, 750);
    poll();
  }

  function syncOnlineState(data) {
    const prevTurn = state.currentTurn;
    const prevStatus = state.gameActive;

    state.players = data.players || [];
    state.walls = data.walls || [];
    state.currentTurn = data.currentTurn || 0;
    state.winner = data.winner;
    state.role = data.myRole || "spectator";
    state.playerIndex = typeof data.myIndex === "number" ? data.myIndex : 0;
    if (data.boardSize) state.boardSize = data.boardSize;

    // Chat messages check
    if (Array.isArray(data.chatMessages) && data.chatMessages.length > state.chatMessages.length) {
      const newMessages = data.chatMessages.slice(state.chatMessages.length);
      newMessages.forEach(msg => showChatToast(msg));
      state.chatMessages = data.chatMessages;
    }

    if (data.status === "waiting") {
      state.gameActive = false;
      showView("waiting");
      renderWaitingRoomSlots(data);
    } else if (data.status === "active") {
      state.gameActive = true;
      showView("game");
      renderGameBoard();

      // Play chime when turn changes to user
      if (prevStatus && prevTurn !== state.currentTurn && state.playerIndex === state.currentTurn) {
        soundEngine.playTurn();
      }
    } else if (data.status === "finished") {
      state.gameActive = false;
      renderGameBoard();
      if (data.winner) {
        showVictoryModal(data.winner);
      }
    }
  }

  function renderWaitingRoomSlots(data) {
    el.dispRoomCode.textContent = data.roomCode;
    el.containerWaitingSlots.innerHTML = "";

    const max = data.maxPlayers || 16;
    el.containerWaitingSlots.classList.toggle("many-players", max > 6);
    for (let i = 0; i < max; i++) {
      const p = data.players[i];
      const card = document.createElement("div");

      if (p) {
        card.className = "player-slot-card occupied";
        card.innerHTML = `
          <div class="slot-avatar-wrap" style="border-color:${p.color};">
            <img src="${getMonImg(p.avatar)}" class="slot-avatar-img" alt="${p.name}" />
          </div>
          <span class="slot-name">${p.name}</span>
          <span class="slot-role-tag" style="color:${p.color};">${p.isHost ? "Romvert (P1)" : `P${i + 1}`}</span>
        `;
      } else {
        card.className = "player-slot-card slot-empty";
        card.innerHTML = `
          <div class="slot-empty-icon">--</div>
          <span class="slot-name" style="color:var(--text-muted);">Ledig plass</span>
          <span class="slot-role-tag">Venter…</span>
        `;
      }
      el.containerWaitingSlots.appendChild(card);
    }

    // Host Start Button state
    if (state.isHost) {
      el.btnHostStartOnline.style.display = "block";
      el.dispHostHint.style.display = "block";
      if (el.btnAddBotOnline) {
        el.btnAddBotOnline.style.display = data.players.length >= max ? "none" : "block";
      }
      el.btnHostStartOnline.disabled = false;
      if (data.players.length >= 2) {
        el.btnHostStartOnline.textContent = `Start spill nå (${data.players.length} spillere)`;
        el.dispHostHint.textContent = "Klar til start! Eller legg til flere spillere/boter.";
      } else {
        el.btnHostStartOnline.textContent = "Start spill nå (med bot)";
        el.dispHostHint.textContent = "Du kan invitere en venn, eller starte med en datastyrt motstander.";
      }
    } else {
      el.btnHostStartOnline.style.display = "none";
      if (el.btnAddBotOnline) el.btnAddBotOnline.style.display = "none";
      el.dispHostHint.textContent = "Venter på at romverten skal starte partiet…";
    }
  }

  // --- LOCAL PASS & PLAY HANDLERS ---
  function handleStartLocalGame() {
    state.mode = "local";
    state.roomCode = null;
    state.playerId = "local_p0";
    state.currentTurn = 0;
    state.winner = null;
    state.walls = [];
    state.turnCount = 0;

    const count = localPlayersCount;
    state.players = [];
    for (let i = 0; i < count; i++) {
      const cfg = PLAYER_DEFAULTS[i];
      const pData = localConfig[i] || {};
      state.players.push({
        id: `local_p${i}`,
        name: pData.name || cfg.defaultName,
        avatar: pData.avatar || cfg.defaultAvatar,
        color: extractCharacterColor(pData.avatar, cfg.color),
        colorName: cfg.colorName,
        pos: getPlayerStartPos(i, count),
        walls: 999,
        isHost: i === 0,
      });
    }

    state.gameActive = true;
    clearStagedWall();
    setActionState("pawn");

    el.btnLeaveRoomHeader.classList.remove("hidden");
    showView("game");
    renderGameBoard();
    soundEngine.playTurn();
  }

  // --- SOLO VS BOT HANDLERS ---
  function handleStartBotGame() {
    state.mode = "bot";
    state.roomCode = null;
    state.playerId = "player_human";
    state.currentTurn = 0;
    state.winner = null;
    state.walls = [];
    state.turnCount = 0;
    state.isBotThinking = false;

    const humanName = el.botPlayerName ? (el.botPlayerName.value.trim() || "Mester") : "Mester";
    localStorage.setItem("korridorer_player_name", humanName);

    const count = botPlayersCount;

    state.players = [
      {
        id: "player_human",
        name: humanName,
        avatar: selectedBotAvatar,
        color: extractCharacterColor(selectedBotAvatar, PLAYER_DEFAULTS[0].color),
        colorName: PLAYER_DEFAULTS[0].colorName,
        pos: getPlayerStartPos(0, count),
        walls: 999,
        isHost: true,
      },
    ];

    const botAvatars = [
      "char:h1:c_06d6a0:r2:e2:m2",
      "char:h1:c_ffd166:r3:e3:m3",
      "char:h1:c_ef476f:r1:e1:m1",
      "char:h1:c_8338ec:r3:e2:m3",
      "char:h2:c_f59e0b:r1:e2:m1",
      "char:h2:c_ec4899:r2:e1:m3",
      "char:h3:c_3b82f6:r3:e3:m2",
      "char:h3:c_eab308:r1:e1:m2",
    ];
    const botNames = [
      "Bot Sigurd", "Bot Freja", "Bot Thor", "Bot Odin",
      "Bot Loke", "Bot Balder", "Bot Frigg", "Bot Tyr",
      "Bot Idunn", "Bot Brage", "Bot Heimdall", "Bot Njord",
      "Bot Skade", "Bot Vidar", "Bot Vale",
    ];

    for (let i = 1; i < count; i++) {
      const cfg = PLAYER_DEFAULTS[i % PLAYER_DEFAULTS.length];
      const av = botAvatars[(i - 1) % botAvatars.length];
      state.players.push({
        id: `bot_${i}`,
        name: botNames[(i - 1) % botNames.length],
        avatar: av,
        color: cfg.color,
        colorName: cfg.colorName,
        pos: getPlayerStartPos(i, count),
        walls: 999,
        isHost: false,
        isBot: true,
      });
    }

    state.gameActive = true;
    clearStagedWall();
    setActionState("pawn");

    el.btnLeaveRoomHeader.classList.remove("hidden");
    showView("game");
    renderGameBoard();
    soundEngine.playTurn();
  }

  // --- BOT AI DECISION ENGINE ---
  function triggerBotTurnIfNeeded() {
    if (state.mode !== "bot" || !state.gameActive || state.isBotThinking) return;

    const curPlayer = state.players[state.currentTurn];
    if (!curPlayer || !curPlayer.isBot) return;

    state.isBotThinking = true;
    el.turnLabel.textContent = `${curPlayer.name} tenker…`;

    setTimeout(() => {
      executeBotMove(curPlayer);
      state.isBotThinking = false;
    }, Math.floor(Math.random() * 400) + 600);
  }

  function executeBotMove(botPlayer) {
    const sz = getBoardSize();
    const maxSlot = sz - 2;
    const wallsSet = new Set(state.walls.map(w => `${w.r},${w.c},${w.orientation}`));
    const allPos = state.players.map(p => p.pos);
    const validMoves = getValidPawnMoves(botPlayer.pos, allPos, wallsSet);
    const botGoalFn = getPlayerGoalFn(state.currentTurn);

    // Check if bot can win immediately with pawn move
    for (const [mr, mc] of validMoves) {
      if (botGoalFn(mr, mc)) {
        commitPawnMove(mr, mc);
        return;
      }
    }

    // Evaluate Human's distance vs Bot's distance
    const humanPlayer = state.players[0];
    const humanGoalFn = getPlayerGoalFn(0);
    const humanDist = getShortestPathDistance(humanPlayer.pos, humanGoalFn, wallsSet);
    const botDist = getShortestPathDistance(botPlayer.pos, botGoalFn, wallsSet);

    let placedWall = false;

    // Tactical Wall Consideration: If human is getting uncomfortably close
    if (humanDist <= 3 || (humanDist < botDist && state.botDifficulty === "hard")) {
      // Find candidate walls near human
      const hr = humanPlayer.pos[0];
      const hc = humanPlayer.pos[1];
      const candidateIntersections = [
        [hr, hc - 1, "H"],
        [hr, hc, "H"],
        [hr - 1, hc, "V"],
        [hr, hc, "V"],
        [hr - 1, hc - 1, "H"],
        [hr, hc - 1, "V"],
      ];

      for (const [cwr, cwc, cori] of candidateIntersections) {
        if (cwr >= 0 && cwr <= maxSlot && cwc >= 0 && cwc <= maxSlot) {
          const val = validateWallPlacement(cwr, cwc, cori, state.walls, state.players);
          if (val.ok) {
            // Check if placing this wall actually increases human distance
            const testSet = new Set(wallsSet);
            testSet.add(`${cwr},${cwc},${cori}`);
            const newHumanDist = getShortestPathDistance(humanPlayer.pos, humanGoalFn, testSet);
            const newBotDist = getShortestPathDistance(botPlayer.pos, botGoalFn, testSet);

            if (newHumanDist > humanDist && newBotDist < 900) {
              commitWallPlacement(cwr, cwc, cori);
              placedWall = true;
              break;
            }
          }
        }
      }
    }

    if (!placedWall) {
      // Advance along pawn shortest path
      let bestMove = validMoves[0];
      let bestDist = 999;

      for (const m of validMoves) {
        const d = getShortestPathDistance(m, botGoalFn, wallsSet);
        if (d < bestDist) {
          bestDist = d;
          bestMove = m;
        }
      }

      if (bestMove) {
        commitPawnMove(bestMove[0], bestMove[1]);
      }
    }
  }

  // --- GAMEPLAY INTERACTIONS (Pawn Moves & Wall Placements) ---
  function updateOrientationUI() {
    const isH = state.wallOrientation === "H";
    const label = isH ? "Horisontal" : "Vertikal";
    if (el.labelOrientation) el.labelOrientation.textContent = label;
    if (el.dockRotateTitle) el.dockRotateTitle.textContent = `Retning: ${label}`;
    if (el.dockRotateBadge) el.dockRotateBadge.textContent = label.toUpperCase();
  }

  function toggleWallOrientation() {
    state.wallOrientation = state.wallOrientation === "H" ? "V" : "H";
    updateOrientationUI();
    soundEngine.playWallRotate();

    if (state.hoveredBorder) {
      state.hoveredBorder.orientation = state.wallOrientation;
      onBorderHover(state.hoveredBorder.r, state.hoveredBorder.c, state.wallOrientation);
    } else if (state.stagedWall) {
      state.stagedWall.orientation = state.wallOrientation;
      updateStagedWallView();
    } else if (state.hoveredIntersection) {
      onGrooveHover(state.hoveredIntersection[0], state.hoveredIntersection[1]);
    }
  }

  function showGhostWallTooltip(msg, r, c, orientation = "H", isStaged = false) {
    if (!el.ghostWallTooltip) return;
    el.ghostWallTooltip.textContent = msg;
    const sz = getBoardSize();
    const topPct = orientation === "H" ? ((r + 1) / sz) * 100 : (r / sz) * 100 + (1 / sz) * 100;
    const leftPct = orientation === "H" ? (c / sz) * 100 + (1 / sz) * 100 : ((c + 1) / sz) * 100;
    el.ghostWallTooltip.style.top = `${topPct}%`;
    el.ghostWallTooltip.style.left = `${leftPct}%`;

    if (r === 0) {
      el.ghostWallTooltip.style.transform = isStaged ? "translate(-50%, 120%)" : "translate(-50%, 60%)";
    } else {
      el.ghostWallTooltip.style.transform = isStaged ? "translate(-50%, -200%)" : "translate(-50%, -150%)";
    }
    el.ghostWallTooltip.classList.remove("hidden");
  }

  function hideGhostWallTooltip() {
    if (el.ghostWallTooltip) el.ghostWallTooltip.classList.add("hidden");
  }

  function stageWall(r, c, orientation) {
    state.stagedWall = { r, c, orientation: orientation || state.wallOrientation };
    updateStagedWallView();
  }

  function clearStagedWall() {
    state.stagedWall = null;
    if (el.floatingWallToolbar) el.floatingWallToolbar.classList.add("hidden");
    hideGhostWallTooltip();
    clearGhostWall();
  }

  function updateStagedWallView() {
    if (!state.stagedWall) {
      clearStagedWall();
      return;
    }
    const { r, c, orientation } = state.stagedWall;
    renderGhostWall(r, c, orientation, true);

    const val = validateWallPlacement(r, c, orientation, state.walls, state.players);
    if (!val.ok) {
      showGhostWallTooltip(val.error || "Ugyldig veggplassering", r, c, orientation, true);
      if (el.btnFloatConfirm) {
        el.btnFloatConfirm.disabled = true;
      }
    } else {
      hideGhostWallTooltip();
      if (el.btnFloatConfirm) {
        el.btnFloatConfirm.disabled = false;
      }
    }

    if (el.floatingWallToolbar) {
      const sz = getBoardSize();
      const topPct = ((r + 1) / sz) * 100;
      const leftPct = ((c + 1) / sz) * 100;
      el.floatingWallToolbar.style.top = `${topPct}%`;
      el.floatingWallToolbar.style.left = `${leftPct}%`;

      if (r === 0) {
        el.floatingWallToolbar.style.transform = "translate(-50%, 60%)";
      } else {
        el.floatingWallToolbar.style.transform = "translate(-50%, -140%)";
      }
      el.floatingWallToolbar.classList.remove("hidden");
    }
  }

  function confirmStagedWall() {
    if (!state.stagedWall) return;
    const { r, c, orientation } = state.stagedWall;
    const val = validateWallPlacement(r, c, orientation, state.walls, state.players);
    if (!val.ok) {
      soundEngine.playInvalid();
      showGhostWallTooltip(val.error || "Ugyldig vegg", r, c, orientation, true);
      return;
    }
    commitWallPlacement(r, c, orientation);
    clearStagedWall();
  }

  function setActionState(action) {
    state.actionState = action;
    if (el.btnModePawn) el.btnModePawn.classList.toggle("active", action === "pawn");
    if (el.btnModeWall) el.btnModeWall.classList.toggle("active", action === "wall");
    if (el.btnDockPawn) el.btnDockPawn.classList.toggle("active", action === "pawn");
    if (el.btnDockWall) el.btnDockWall.classList.toggle("active", action === "wall");

    if (el.boardWrapper) {
      el.boardWrapper.classList.toggle("wall-mode-active", action === "wall");
    }

    if (action === "pawn") {
      clearStagedWall();
    }

    renderBoardHighlights();
  }

  function onCellClicked(r, c) {
    if (!state.gameActive) return;

    // Check if it's user's turn
    if (state.mode === "online") {
      if (state.role === "spectator" || state.playerIndex !== state.currentTurn) return;
    } else if (state.mode === "bot") {
      if (state.currentTurn !== 0) return;
    }

    const curPlayer = state.players[state.currentTurn];
    if (!curPlayer) return;

    // If clicking own pawn: ensure pawn move mode and clear staged wall
    if (curPlayer.pos[0] === r && curPlayer.pos[1] === c) {
      clearStagedWall();
      setActionState("pawn");
      soundEngine.playTurn();
      return;
    }

    const wallsSet = new Set(state.walls.map(w => `${w.r},${w.c},${w.orientation}`));
    const allPos = state.players.map(p => p.pos);
    const validMoves = getValidPawnMoves(curPlayer.pos, allPos, wallsSet);

    const isValid = validMoves.some(([mr, mc]) => mr === r && mc === c);
    if (isValid) {
      clearStagedWall();
      if (state.actionState !== "pawn") {
        setActionState("pawn");
      }
      commitPawnMove(r, c);
    } else {
      if (state.stagedWall) {
        clearStagedWall();
      } else if (state.actionState === "pawn") {
        soundEngine.playInvalid();
      }
    }
  }

  function onBorderHover(r, c, orientation) {
    if (!state.gameActive) return;
    state.hoveredBorder = { r, c, orientation };
    state.hoveredIntersection = [r, c];
    state.wallOrientation = orientation;
    updateOrientationUI();

    if (state.stagedWall) return;

    const curPlayer = state.players[state.currentTurn];
    if (!curPlayer) return;

    renderGhostWall(r, c, orientation, false);

    const val = validateWallPlacement(r, c, orientation, state.walls, state.players);
    if (!val.ok) {
      showGhostWallTooltip(val.error, r, c, orientation, false);
    } else {
      hideGhostWallTooltip();
    }
  }

  function onBorderLeave(r, c, orientation) {
    if (
      state.hoveredBorder &&
      state.hoveredBorder.r === r &&
      state.hoveredBorder.c === c &&
      state.hoveredBorder.orientation === orientation
    ) {
      state.hoveredBorder = null;
    }
    if (state.hoveredIntersection && state.hoveredIntersection[0] === r && state.hoveredIntersection[1] === c) {
      state.hoveredIntersection = null;
    }
    if (!state.stagedWall) {
      clearGhostWall();
      hideGhostWallTooltip();
    }
  }

  function onBorderClick(r, c, orientation) {
    if (!state.gameActive) return;

    // Check if it's user's turn
    if (state.mode === "online") {
      if (state.role === "spectator" || state.playerIndex !== state.currentTurn) return;
    } else if (state.mode === "bot") {
      if (state.currentTurn !== 0) return;
    }

    const curPlayer = state.players[state.currentTurn];
    if (!curPlayer) return;

    // Direct placement on border!
    const val = validateWallPlacement(r, c, orientation, state.walls, state.players);
    if (!val.ok) {
      soundEngine.playInvalid();
      showGhostWallTooltip(val.error || "Ugyldig vegg", r, c, orientation, false);
      return;
    }

    if (state.actionState !== "wall") {
      setActionState("wall");
    }

    commitWallPlacement(r, c, orientation);
  }

  function onGrooveHover(r, c) {
    onBorderHover(r, c, state.wallOrientation);
  }

  function onGrooveLeave(r, c) {
    onBorderLeave(r, c, state.wallOrientation);
  }

  function onGrooveClick(r, c) {
    onBorderClick(r, c, state.wallOrientation);
  }

  // Commit Pawn Move (Dispatch online or apply locally)
  async function commitPawnMove(r, c) {
    soundEngine.playPawnMove();
    clearStagedWall();

    if (state.mode === "online") {
      try {
        const resp = await fetch("/api/korridorer/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            playerId: state.playerId,
            r: r,
            c: c,
          }),
        });
        const data = await resp.json();
        if (data.ok && data.state) {
          syncOnlineState(data.state);
        } else {
          soundEngine.playInvalid();
          alert(data.error || "Ugyldig trekk.");
        }
      } catch (err) {
        console.error(err);
      }
      return;
    }

    // Local / Bot mode
    const curPlayer = state.players[state.currentTurn];
    curPlayer.pos = [r, c];
    state.turnCount++;

    // Check victory
    const goalFn = getPlayerGoalFn(state.currentTurn);
    if (goalFn(r, c)) {
      state.gameActive = false;
      state.winner = curPlayer;
      renderGameBoard();
      showVictoryModal(curPlayer);
      return;
    }

    // Next turn
    state.currentTurn = (state.currentTurn + 1) % state.players.length;
    renderGameBoard();
    soundEngine.playTurn();
    triggerBotTurnIfNeeded();
  }

  // Commit Wall Placement (Dispatch online or apply locally)
  async function commitWallPlacement(r, c, orientation) {
    soundEngine.playWallPlace();
    clearStagedWall();

    if (state.mode === "online") {
      try {
        const resp = await fetch("/api/korridorer/wall", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            playerId: state.playerId,
            r: r,
            c: c,
            orientation: orientation,
          }),
        });
        const data = await resp.json();
        if (data.ok && data.state) {
          syncOnlineState(data.state);
        } else {
          soundEngine.playInvalid();
          alert(data.error || "Ugyldig vegg.");
        }
      } catch (err) {
        console.error(err);
      }
      return;
    }

    // Local / Bot mode
    const curPlayer = state.players[state.currentTurn];
    curPlayer.wallsPlaced = (curPlayer.wallsPlaced || 0) + 1;
    state.walls.push({
      r: r,
      c: c,
      orientation: orientation,
      owner: curPlayer.id,
      color: curPlayer.color,
    });
    state.turnCount++;

    // Next turn
    state.currentTurn = (state.currentTurn + 1) % state.players.length;
    renderGameBoard();
    soundEngine.playTurn();
    triggerBotTurnIfNeeded();
  }

  // --- RENDERING ARENA & BOARD ---
  function renderGameBoard() {
    ensureBoardGridSize();
    renderTopStatusBar();
    renderPlayersSideCards();
    renderBoardWalls();
    renderBoardPawns();
    renderBoardHighlights();
    renderEndzones();
  }

  function renderTopStatusBar() {
    const curPlayer = state.players[state.currentTurn];
    if (!curPlayer) return;

    el.turnPawnImg.src = getMonImg(curPlayer.avatar);
    if (el.btnWallsCount) el.btnWallsCount.textContent = curPlayer.walls;
    if (el.dockWallsLeft) el.dockWallsLeft.textContent = curPlayer.walls;
    updateOrientationUI();

    if (state.mode === "online") {
      if (state.role === "spectator") {
        el.turnLabel.textContent = `${curPlayer.name}s tur`;
        el.turnSub.textContent = "Du er tilskuer.";
      } else if (state.playerIndex === state.currentTurn) {
        el.turnLabel.textContent = "DIN TUR!";
        el.turnSub.textContent = "Klikk en rute for å flytte, eller en kantlinje for å bygge vegg.";
      } else {
        el.turnLabel.textContent = `${curPlayer.name}s tur`;
        el.turnSub.textContent = "Venter på trekk…";
      }
    } else if (state.mode === "bot") {
      if (state.currentTurn === 0) {
        el.turnLabel.textContent = "DIN TUR!";
        el.turnSub.textContent = "Klikk en rute for å flytte, eller en kantlinje for å bygge vegg.";
      } else {
        el.turnLabel.textContent = `${curPlayer.name} tenker…`;
        el.turnSub.textContent = "Datamaskinen beregner neste trekk…";
      }
    } else {
      el.turnLabel.textContent = `${curPlayer.name}s tur`;
      el.turnSub.textContent = "Klikk en rute for å flytte, eller en kantlinje for å bygge vegg.";
    }
  }

  function renderPlayersSideCards() {
    el.colPlayersLeft.innerHTML = "";
    el.colPlayersRight.innerHTML = "";
    const manyPlayers = state.players.length > 6;
    el.colPlayersLeft.classList.toggle("many-players", manyPlayers);
    el.colPlayersRight.classList.toggle("many-players", manyPlayers);

    state.players.forEach((p, idx) => {
      const isTurn = idx === state.currentTurn;
      const card = document.createElement("div");
      card.className = `player-game-card ${isTurn ? "active-turn" : ""}`;
      card.id = `playerCard_${idx}`;

      card.innerHTML = `
        <div class="pg-header">
          <div class="pg-avatar-wrap">
            <img src="${getMonImg(p.avatar)}" class="pg-avatar-img" alt="${p.name}" />
          </div>
          <div class="pg-info">
            <span class="pg-name">${p.name}</span>
          </div>
        </div>
      `;

      if (idx % 2 === 0) {
        el.colPlayersLeft.appendChild(card);
      } else {
        el.colPlayersRight.appendChild(card);
      }
    });
  }

  function renderBoardPawns() {
    // Remove existing pawns
    document.querySelectorAll(".pawn-token").forEach(pt => pt.remove());

    state.players.forEach((p, idx) => {
      const [r, c] = p.pos;
      const cell = document.getElementById(`cell_${r}_${c}`);
      if (!cell) return;

      const pawn = document.createElement("div");
      const isTurn = idx === state.currentTurn;
      pawn.className = `pawn-token ${isTurn ? "active-turn" : ""}`;

      pawn.innerHTML = `
        <img src="${getMonImg(p.avatar)}" alt="${p.name}" />
      `;

      cell.appendChild(pawn);
    });
  }

  function renderBoardWalls() {
    el.boardWallsLayer.innerHTML = "";
    const sz = getBoardSize();

    // Placed walls
    state.walls.forEach(w => {
      const wall = document.createElement("div");
      wall.className = `placed-wall wall-${w.orientation.toLowerCase()}`;

      // Calculate position and dimension based on board size
      const r = w.r;
      const c = w.c;

      if (w.orientation === "H") {
        wall.style.top = `${((r + 1) / sz) * 100}%`;
        wall.style.left = `${(c / sz) * 100}%`;
        wall.style.width = `${(2 / sz) * 100}%`;
      } else {
        wall.style.left = `${((c + 1) / sz) * 100}%`;
        wall.style.top = `${(r / sz) * 100}%`;
        wall.style.height = `${(2 / sz) * 100}%`;
      }

      // Wall color matches the placing player's character color
      const ownerPlayer = state.players.find(p => p.id === w.owner);
      const wallColor = w.color || (ownerPlayer ? ownerPlayer.color : null) || "#f59e0b";
      wall.style.backgroundColor = wallColor;
      wall.style.boxShadow = `0 3px 8px rgba(0, 0, 0, 0.6), 0 0 10px ${wallColor}88`;

      el.boardWallsLayer.appendChild(wall);
    });
  }

  function renderBoardHighlights() {
    // Clear previous cell highlights
    document.querySelectorAll(".board-cell").forEach(cell => {
      cell.classList.remove("valid-move");
      const ghost = cell.querySelector(".ghost-preview-pawn");
      if (ghost) ghost.remove();
    });

    if (!state.gameActive) return;

    // Check if it's user's turn
    const isMyTurn =
      state.mode === "online"
        ? state.playerIndex === state.currentTurn
        : state.mode === "bot"
        ? state.currentTurn === 0
        : true;

    if (!isMyTurn) return;

    const curPlayer = state.players[state.currentTurn];
    if (!curPlayer || !curPlayer.pos) return;
    const wallsSet = new Set(state.walls.map(w => `${w.r},${w.c},${w.orientation}`));
    const allPos = state.players.map(p => p.pos);
    const validMoves = getValidPawnMoves(curPlayer.pos, allPos, wallsSet);

    validMoves.forEach(([r, c]) => {
      const cell = document.getElementById(`cell_${r}_${c}`);
      if (cell) {
        cell.classList.add("valid-move");

        // Hover ghost pawn inside
        const ghost = document.createElement("img");
        ghost.src = getMonImg(curPlayer.avatar);
        ghost.className = "ghost-preview-pawn pawn-token";
        ghost.style.position = "absolute";
        ghost.style.inset = "8px";
        ghost.style.pointerEvents = "none";

        cell.appendChild(ghost);
      }
    });
  }

  function renderEndzones() {
    if (!state.players || state.players.length === 0) return;
    const sz = getBoardSize();
    const isMulti = state.players.length > 2;

    if (isMulti) {
      // 3 or 4 players: Center square (mid, mid) is the common goal!
      if (el.goalNorth) el.goalNorth.style.display = "none";
      if (el.goalSouth) el.goalSouth.style.display = "none";
      if (el.goalEast) el.goalEast.style.display = "none";
      if (el.goalWest) el.goalWest.style.display = "none";

      const mid = Math.floor(sz / 2);

      document.querySelectorAll(".board-cell").forEach(cell => {
        const r = parseInt(cell.dataset.r, 10);
        const c = parseInt(cell.dataset.c, 10);

        cell.classList.remove("my-endzone-cell", "opponent-endzone-cell");
        cell.style.removeProperty("--endzone-color");

        if (r === mid && c === mid) {
          cell.classList.add("common-goal-cell");
          if (!cell.querySelector(".common-goal-indicator")) {
            const ind = document.createElement("div");
            ind.className = "common-goal-indicator";
            ind.title = "Felles målrute";
            ind.innerHTML = `<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
            cell.appendChild(ind);
          }
        } else {
          cell.classList.remove("common-goal-cell");
          const ind = cell.querySelector(".common-goal-indicator");
          if (ind) ind.remove();
        }
      });
      return;
    }

    // 2-player mode: Standard 9x9 opposite edge endzones
    const myIdx = (state.mode === "online" ? state.playerIndex : (state.mode === "bot" ? 0 : state.currentTurn));
    const p1 = state.players[0];
    const p2 = state.players[1];

    if (el.goalNorth && p1) {
      el.goalNorth.style.display = "block";
      el.goalNorth.style.setProperty("--goal-color", p1.color);
      el.goalNorth.style.background = `linear-gradient(90deg, transparent 5%, ${p1.color} 50%, transparent 95%)`;
      el.goalNorth.innerHTML = "";
    }

    if (el.goalSouth && p2) {
      el.goalSouth.style.display = "block";
      el.goalSouth.style.setProperty("--goal-color", p2.color);
      el.goalSouth.style.background = `linear-gradient(90deg, transparent 5%, ${p2.color} 50%, transparent 95%)`;
      el.goalSouth.innerHTML = "";
    }

    if (el.goalEast) el.goalEast.style.display = "none";
    if (el.goalWest) el.goalWest.style.display = "none";

    document.querySelectorAll(".board-cell").forEach(cell => {
      const r = parseInt(cell.dataset.r, 10);
      const c = parseInt(cell.dataset.c, 10);

      cell.classList.remove("common-goal-cell", "my-endzone-cell", "opponent-endzone-cell");
      cell.style.removeProperty("--endzone-color");
      const ind = cell.querySelector(".common-goal-indicator");
      if (ind) ind.remove();

      let goalIdx = -1;
      if (r === 0) goalIdx = 0;
      else if (r === sz - 1) goalIdx = 1;

      if (goalIdx !== -1 && state.players[goalIdx]) {
        const gp = state.players[goalIdx];
        cell.style.setProperty("--endzone-color", gp.color);
        if (goalIdx === myIdx) {
          cell.classList.add("my-endzone-cell");
        } else {
          cell.classList.add("opponent-endzone-cell");
        }
      }
    });
  }

  function renderGhostWall(r, c, orientation, isStaged = false) {
    clearGhostWall();

    const val = validateWallPlacement(r, c, orientation, state.walls, state.players);
    const ghost = document.createElement("div");
    ghost.id = "activeGhostWall";
    ghost.className = `ghost-wall ${val.ok ? "valid" : "invalid"} ${isStaged ? "staged" : ""} wall-${orientation.toLowerCase()}`;

    const curPlayer = state.players[state.currentTurn] || state.players[0];
    const playerColor = curPlayer ? curPlayer.color : "#f59e0b";

    if (val.ok) {
      ghost.style.backgroundColor = playerColor;
      ghost.style.boxShadow = `0 0 16px ${playerColor}, 0 0 8px rgba(255, 255, 255, 0.8)`;
      ghost.style.border = `1px solid #ffffff`;
    }

    const sz = getBoardSize();
    if (orientation === "H") {
      ghost.style.top = `${((r + 1) / sz) * 100}%`;
      ghost.style.left = `${(c / sz) * 100}%`;
      ghost.style.width = `${(2 / sz) * 100}%`;
    } else {
      ghost.style.left = `${((c + 1) / sz) * 100}%`;
      ghost.style.top = `${(r / sz) * 100}%`;
      ghost.style.height = `${(2 / sz) * 100}%`;
    }

    el.boardWallsLayer.appendChild(ghost);
  }

  function clearGhostWall() {
    const existing = document.getElementById("activeGhostWall");
    if (existing) existing.remove();
  }

  // --- REACTIONS & CHAT ---
  async function sendReaction(emoji) {
    soundEngine.playReaction();

    if (state.mode === "online") {
      try {
        await fetch("/api/korridorer/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            playerId: state.playerId,
            message: emoji,
          }),
        });
      } catch (err) {
        console.error(err);
      }
    } else {
      const curPlayer = state.players[state.currentTurn];
      showChatToast({
        sender: curPlayer ? curPlayer.name : "Deg",
        avatar: curPlayer ? curPlayer.avatar : "charbear",
        text: emoji,
      });
    }
  }

  function showChatToast(msg) {
    if (!el.chatToastContainer) return;
    const toast = document.createElement("div");
    toast.className = "chat-bubble-toast";
    toast.innerHTML = `
      <img src="${getMonImg(msg.avatar)}" class="chat-bubble-img" alt="" />
      <span class="chat-bubble-sender">${msg.sender}:</span>
      <span class="chat-bubble-text">${msg.text}</span>
    `;
    el.chatToastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // --- VICTORY & REMATCH ---
  function showVictoryModal(winner) {
    soundEngine.playVictory();
    el.victoryWinnerImg.src = getMonImg(winner.avatar);
    el.victoryTitle.textContent = `${winner.name} Vinner!`;
    if (state.players && state.players.length > 2) {
      el.victoryDesc.textContent = `Gratulerer! ${winner.name} nådde fellesmålet i midten først og vant partiet!`;
    } else {
      el.victoryDesc.textContent = `Gratulerer! ${winner.name} manøvrerte monsteret sitt i mål over brettet!`;
    }

    el.statTurnCount.textContent = state.turnCount;
    el.statWallsPlaced.textContent = state.walls.length;

    if (el.btnVictoryLounge && el.btnVictoryLobby) {
      const isParty = Boolean(state.roomCode || sessionStorage.getItem("party_room_code"));
      el.btnVictoryLounge.classList.toggle("hidden", !isParty);
      el.btnVictoryLobby.classList.toggle("hidden", isParty);
    }

    el.modalVictory.classList.remove("hidden");
  }

  async function handleRequestRematch() {
    if (state.mode === "online") {
      try {
        const resp = await fetch("/api/korridorer/rematch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            playerId: state.playerId,
          }),
        });
        const data = await resp.json();
        if (data.ok && data.state) {
          syncOnlineState(data.state);
        }
      } catch (err) {
        console.error(err);
      }
    } else if (state.mode === "local") {
      handleStartLocalGame();
    } else if (state.mode === "bot") {
      handleStartBotGame();
    }
  }

  async function leaveToLobby() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = null;
    const code = state.roomCode || sessionStorage.getItem("party_room_code");
    const playerId = state.playerId || sessionStorage.getItem("party_player_id");
    state.roomCode = null;
    state.gameActive = false;
    state.winner = null;
    clearStagedWall();

    if (code) {
      if (window.PartyBridge) {
        window.PartyBridge.leaveToLounge({
          roomCode: code,
          playerId: playerId || "",
        });
        return;
      }
      try {
        await fetch("/api/party/to-lounge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            roomCode: code,
            playerId: playerId || "",
          }),
        });
      } catch (_) {}
      window.location.replace(`/party/?room=${encodeURIComponent(code)}&player=${encodeURIComponent(playerId || "")}`);
      return;
    }

    // Remove ?room query param without full page reload
    window.history.replaceState({}, document.title, window.location.pathname);
    el.btnLeaveRoomHeader.classList.add("hidden");
    showView("lobby");
  }

  function showView(viewName) {
    el.viewLobby.classList.add("hidden");
    el.viewWaitingRoom.classList.add("hidden");
    el.viewGame.classList.add("hidden");

    if (viewName === "lobby") {
      el.viewLobby.classList.remove("hidden");
    } else if (viewName === "waiting") {
      el.viewWaitingRoom.classList.remove("hidden");
    } else if (viewName === "game") {
      el.viewGame.classList.remove("hidden");
    }
  }

  // Run on startup
  window.addEventListener("DOMContentLoaded", init);
})();
