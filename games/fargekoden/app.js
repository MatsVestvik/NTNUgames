/**
 * Fargekoden (Hues and Cues) - Client Application
 * 16 rows (A-P) x 30 columns (1-30) = 480 unique color swatches.
 * Supports Party Lounge multiplayer AND standalone Solo mode.
 */

(function () {
  "use strict";

  const ROWS = 16;
  const COLS = 30;
  const ROW_LETTERS = "ABCDEFGHIJKLMNOP";

  const urlParams = new URLSearchParams(window.location.search);
  const roomCodeParam = (urlParams.get("room") || urlParams.get("code") || "").trim().toUpperCase();
  const playerIdParam = (urlParams.get("player") || urlParams.get("playerId") || (roomCodeParam ? sessionStorage.getItem("party_player_id") : "") || "").trim();
  const hostTokenParam = (roomCodeParam ? (localStorage.getItem("party_host_token") || "") : "").trim();

  const PASS_AND_PLAY_PALETTE = [
    { color: "#38bdf8", avatar: "charbear" },     // Cyan
    { color: "#f43f5e", avatar: "pixiu" },        // Rose / Red
    { color: "#10b981", avatar: "fenrir" },       // Emerald
    { color: "#fbbf24", avatar: "jormundgandr" }, // Amber / Gold
    { color: "#a855f7", avatar: "sleipnir" },     // Purple
    { color: "#f97316", avatar: "kraken" },       // Orange
    { color: "#06b6d4", avatar: "nattmare" },     // Teal
    { color: "#ec4899", avatar: "troll" },        // Pink
    { color: "#84cc16", avatar: "charbear" },     // Lime
    { color: "#6366f1", avatar: "pixiu" },        // Indigo
    { color: "#e11d48", avatar: "fenrir" },       // Crimson
    { color: "#14b8a6", avatar: "jormundgandr" }, // Turquoise
    { color: "#d946ef", avatar: "sleipnir" },     // Fuchsia
    { color: "#eab308", avatar: "kraken" },       // Yellow
    { color: "#3b82f6", avatar: "nattmare" },     // Blue
    { color: "#22c55e", avatar: "troll" },        // Green
  ];

  const state = {
    isSolo: !roomCodeParam || !playerIdParam,
    roomCode: roomCodeParam,
    playerId: playerIdParam,
    hostToken: hostTokenParam,
    isHost: false,
    version: -1,
    pollTimer: null,

    turnState: "giving_clue_1",
    isGiver: false,
    hasPlacedThisStep: false,
    activeGiverId: null,
    activeGiverName: "Spiller",
    currentRound: 1,
    totalRounds: 1,
    timeRemaining: 30,
    candidates: [],
    targetPos: null,
    clue1: "",
    clue2: "",
    markers: [],
    players: [],

    // Multi-player Pass & Play
    localSubMode: "pass_and_play",
    passAndPlayPlayerCount: 3,
    passAndPlayRoundRule: "2_per_player",
    guesserQueue: [],
    currentGuesserIndex: 0,

    soundEnabled: localStorage.getItem("tegn_sound") !== "false",
    audioCtx: null,
  };

  const el = {
    viewLobby: document.getElementById("viewLobby"),
    viewGame: document.getElementById("viewGame"),
    btnLeaveRoom: document.getElementById("btnLeaveRoom"),

    tabLobbyLocal: document.getElementById("tabLobbyLocal"),
    tabLobbyRoom: document.getElementById("tabLobbyRoom"),
    panelLobbyLocal: document.getElementById("panelLobbyLocal"),
    panelLobbyRoom: document.getElementById("panelLobbyRoom"),

    controlFkPlayerCount: document.getElementById("controlFkPlayerCount"),
    localPlayersNamesGrid: document.getElementById("localPlayersNamesGrid"),
    controlFkRounds: document.getElementById("controlFkRounds"),
    btnStartFkLocal: document.getElementById("btnStartFkLocal"),
    inputFkRoomCode: document.getElementById("inputFkRoomCode"),
    btnSubmitJoinFkRoom: document.getElementById("btnSubmitJoinFkRoom"),

    btnBack: document.getElementById("btnBack"),
    backBtnText: document.getElementById("backBtnText"),
    roundIndicator: document.getElementById("roundIndicator"),
    clue1Chip: document.getElementById("clue1Chip"),
    clue1Text: document.getElementById("clue1Text"),
    clue2Chip: document.getElementById("clue2Chip"),
    clue2Text: document.getElementById("clue2Text"),
    timerBubble: document.getElementById("timerBubble"),
    timerText: document.getElementById("timerText"),
    btnSoundToggle: document.getElementById("btnSoundToggle"),

    playersCountBadge: document.getElementById("playersCountBadge"),
    playersList: document.getElementById("playersList"),
    magSwatch: document.getElementById("magSwatch"),
    magCoord: document.getElementById("magCoord"),
    magHint: document.getElementById("magHint"),

    statusText: document.getElementById("statusText"),
    btnNextTurnNow: document.getElementById("btnNextTurnNow"),
    btnSoloNext: document.getElementById("btnSoloNext"),

    giverDock: document.getElementById("giverDock"),
    giverStep1: document.getElementById("giverStep1"),
    giverStep2: document.getElementById("giverStep2"),
    candidatesRow: document.getElementById("candidatesRow"),
    formClue1: document.getElementById("formClue1"),
    inputClue1: document.getElementById("inputClue1"),
    formClue2: document.getElementById("formClue2"),
    inputClue2: document.getElementById("inputClue2"),
    btnSkipClue2: document.getElementById("btnSkipClue2"),

    colHeaders: document.getElementById("colHeaders"),
    rowHeaders: document.getElementById("rowHeaders"),
    colorGrid: document.getElementById("colorGrid"),

    modalGameOver: document.getElementById("modalGameOver"),
    podiumContainer: document.getElementById("podiumContainer"),
    btnPlayAgain: document.getElementById("btnPlayAgain"),
    btnReturnLobby: document.getElementById("btnReturnLobby"),
  };

  // =========================================================================
  // Deterministic 16x30 Color Spectrum Math
  // =========================================================================
  function getCellColor(r, c) {
    const hue = (c * 12) % 360;
    const lightness = Math.round(86 - (r * (66 / 15)));
    const sat = Math.round(94 - Math.abs(r - 7.5) * 2.1);
    return `hsl(${hue}, ${sat}%, ${lightness}%)`;
  }

  function getCoordLabel(r, c) {
    return `${ROW_LETTERS[r] || "A"}${String(c + 1).padStart(2, "0")}`;
  }

  function getAvatarSrc(avatarStr) {
    if (window.CharacterCreator && typeof window.CharacterCreator.getAvatarImgSrc === "function") {
      return window.CharacterCreator.getAvatarImgSrc(avatarStr || "charbear");
    }
    return "/assets/mons/charbear.png";
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // =========================================================================
  // Audio
  // =========================================================================
  function playTone(freq, duration = 0.12, type = "sine", gainVal = 0.14) {
    if (!state.soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!state.audioCtx && AudioCtx) state.audioCtx = new AudioCtx();
      if (!state.audioCtx) return;
      if (state.audioCtx.state === "suspended") state.audioCtx.resume();
      const osc = state.audioCtx.createOscillator();
      const gain = state.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, state.audioCtx.currentTime);
      gain.gain.setValueAtTime(gainVal, state.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, state.audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(state.audioCtx.destination);
      osc.start();
      osc.stop(state.audioCtx.currentTime + duration);
    } catch (e) {}
  }

  function updateSoundBtn() {
    el.btnSoundToggle.textContent = state.soundEnabled ? "Lyd på" : "Lyd av";
    localStorage.setItem("tegn_sound", String(state.soundEnabled));
  }

  el.btnSoundToggle.addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    updateSoundBtn();
    if (state.soundEnabled) playTone(659.25, 0.12);
  });
  updateSoundBtn();

  // =========================================================================
  // Build 16x30 Color Grid DOM
  // =========================================================================
  const cellElements = [];

  function buildBoardDOM() {
    el.colHeaders.innerHTML = "";
    for (let c = 0; c < COLS; c++) {
      const lbl = document.createElement("div");
      lbl.className = "fk-col-lbl";
      lbl.textContent = String(c + 1);
      el.colHeaders.appendChild(lbl);
    }

    el.rowHeaders.innerHTML = "";
    for (let r = 0; r < ROWS; r++) {
      const lbl = document.createElement("div");
      lbl.className = "fk-row-lbl";
      lbl.textContent = ROW_LETTERS[r];
      el.rowHeaders.appendChild(lbl);
    }

    el.colorGrid.innerHTML = "";
    for (let r = 0; r < ROWS; r++) {
      const rowArr = [];
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement("div");
        cell.className = "fk-cell";
        const color = getCellColor(r, c);
        cell.style.backgroundColor = color;
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        cell.title = getCoordLabel(r, c);

        cell.addEventListener("mouseenter", () => {
          el.magSwatch.style.background = color;
          el.magCoord.textContent = getCoordLabel(r, c);
          el.magHint.textContent = canPlaceMarkerNow() ? "Klikk for å plassere brikke" : "Fargenyanse";
        });

        cell.addEventListener("click", () => onCellClick(r, c));
        el.colorGrid.appendChild(cell);
        rowArr.push(cell);
      }
      cellElements.push(rowArr);
    }
  }

  function canPlaceMarkerNow() {
    if (state.isSolo) {
      return state.turnState === "guessing_1" || state.turnState === "guessing_2";
    }
    return (
      (state.turnState === "guessing_1" || state.turnState === "guessing_2") &&
      (!state.isGiver || state.players.length === 1) &&
      !state.hasPlacedThisStep
    );
  }

  async function onCellClick(r, c) {
    const color = getCellColor(r, c);
    el.magSwatch.style.background = color;
    el.magCoord.textContent = getCoordLabel(r, c);

    // If Cue Giver clicks any square during giving_clue_1, let them pick that square as target!
    if (state.isGiver && state.turnState === "giving_clue_1" && r >= 1 && r <= 14 && c >= 1 && c <= 28) {
      state.targetPos = [r, c];
      playTone(587.33, 0.1, "triangle", 0.14);
      renderCandidateButtons();
      renderBoardHighlightsAndMarkers();
      if (!state.isSolo) {
        try {
          await fetch("/api/fargekoden/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomCode: state.roomCode,
              playerId: state.playerId,
              action: "select_candidate",
              r,
              c,
            }),
          });
        } catch (e) {}
      }
      return;
    }

    if (!canPlaceMarkerNow()) return;

    // Prevent placing on an already occupied square
    if (state.markers.some(m => m.r === r && m.c === c)) {
      playTone(220, 0.15, "sawtooth", 0.15);
      return;
    }

    playTone(659.25, 0.12, "triangle", 0.16);

    if (state.isSolo) {
      handlePassAndPlayPlaceMarker(r, c);
      return;
    }

    state.hasPlacedThisStep = true;
    try {
      const resp = await fetch("/api/fargekoden/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          action: "place_marker",
          r,
          c,
        }),
      });
      const data = await resp.json();
      if (!data.ok) {
        state.hasPlacedThisStep = false;
        if (data.error) alert(data.error);
      }
      pollRoomState();
    } catch (err) {
      state.hasPlacedThisStep = false;
    }
  }

  // =========================================================================
  // Render Board Highlights (3x3 Frame) & Markers
  // =========================================================================
  function renderBoardHighlightsAndMarkers() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = cellElements[r] ? cellElements[r][c] : null;
        if (!cell) continue;
        cell.classList.remove("target-bullseye", "frame-3x3", "frame-5x5");
        cell.innerHTML = "";
      }
    }

    const showTarget =
      (state.isGiver && state.targetPos) ||
      ((state.turnState === "turn_recap" || state.turnState === "game_over") && state.targetPos);

    if (showTarget && state.targetPos) {
      const [tr, tc] = state.targetPos;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = tr + dr;
          const nc = tc + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
            const dist = Math.max(Math.abs(dr), Math.abs(dc));
            const cell = cellElements[nr][nc];
            if (dist === 0) {
              cell.classList.add("target-bullseye");
            } else if (dist === 1) {
              cell.classList.add("frame-3x3");
            } else if (dist === 2 && (state.turnState === "turn_recap" || state.turnState === "game_over")) {
              cell.classList.add("frame-5x5");
            }
          }
        }
      }
    }

    const isRevealed = state.turnState === "turn_recap" || state.turnState === "game_over";
    state.markers.forEach(m => {
      if (m.r >= 0 && m.r < ROWS && m.c >= 0 && m.c < COLS) {
        const cell = cellElements[m.r][m.c];
        cell.innerHTML = "";
        const token = document.createElement("div");
        token.className = "fk-marker";
        token.style.backgroundColor = m.playerColor || "#f59e0b";
        token.title = `${m.playerName} (Brikke ${m.guessRound || 1})`;
        const initial = (m.playerName || "S").charAt(0).toUpperCase();
        token.textContent = `${initial}${m.guessRound || ""}`;

        if (isRevealed && typeof m.points === "number" && m.points > 0) {
          const ptsBadge = document.createElement("span");
          ptsBadge.className = "fk-marker-pts";
          ptsBadge.textContent = `+${m.points}`;
          token.appendChild(ptsBadge);
        }
        cell.appendChild(token);
      }
    });
  }

  // =========================================================================
  // Cue Giver Actions
  // =========================================================================
  function renderCandidateButtons() {
    el.candidatesRow.innerHTML = "";
    const cands = state.candidates || [];
    cands.forEach(([r, c]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const isSelected = state.targetPos && state.targetPos[0] === r && state.targetPos[1] === c;
      btn.className = `fk-candidate-btn ${isSelected ? "active" : ""}`;
      const color = getCellColor(r, c);
      btn.innerHTML = `
        <span class="fk-candidate-swatch" style="background:${color};"></span>
        <span>${getCoordLabel(r, c)}</span>
      `;
      btn.addEventListener("click", async () => {
        state.targetPos = [r, c];
        renderCandidateButtons();
        renderBoardHighlightsAndMarkers();
        try {
          await fetch("/api/fargekoden/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomCode: state.roomCode,
              playerId: state.playerId,
              action: "select_candidate",
              r,
              c,
            }),
          });
        } catch (e) {}
      });
      el.candidatesRow.appendChild(btn);
    });
  }

  el.formClue1.addEventListener("submit", async e => {
    e.preventDefault();
    const clue = el.inputClue1.value.trim();
    if (!clue) return;
    if (clue.split(/\s+/).length > 1) {
      alert("Første hint kan bare være ETT ord!");
      return;
    }
    el.inputClue1.value = "";
    if (state.isSolo && state.localSubMode === "pass_and_play") {
      handlePassAndPlaySubmitClue1(clue);
      return;
    }
    try {
      const body = {
        roomCode: state.roomCode,
        playerId: state.playerId,
        action: "submit_clue_1",
        clue,
      };
      if (state.targetPos) {
        body.r = state.targetPos[0];
        body.c = state.targetPos[1];
      }
      const resp = await fetch("/api/fargekoden/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!data.ok && data.error) {
        alert(data.error);
        return;
      }
      el.inputClue1.value = "";
      pollRoomState();
    } catch (err) {}
  });

  el.formClue2.addEventListener("submit", async e => {
    e.preventDefault();
    const clue = el.inputClue2.value.trim();
    if (!clue) return;
    if (clue.split(/\s+/).length > 2) {
      alert("Andre hint kan være maks TO ord!");
      return;
    }
    el.inputClue2.value = "";
    if (state.isSolo && state.localSubMode === "pass_and_play") {
      handlePassAndPlaySubmitClue2(clue);
      return;
    }
    try {
      const resp = await fetch("/api/fargekoden/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          action: "submit_clue_2",
          clue,
        }),
      });
      const data = await resp.json();
      if (!data.ok && data.error) {
        alert(data.error);
        return;
      }
      pollRoomState();
    } catch (err) {}
  });

  el.btnSkipClue2.addEventListener("click", async () => {
    if (state.isSolo && state.localSubMode === "pass_and_play") {
      handlePassAndPlaySkipClue2();
      return;
    }
    try {
      await fetch("/api/fargekoden/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          action: "skip_clue_2",
        }),
      });
      pollRoomState();
    } catch (e) {}
  });

  el.btnNextTurnNow.addEventListener("click", async () => {
    try {
      await fetch("/api/fargekoden/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          action: "next_turn",
        }),
      });
      pollRoomState();
    } catch (e) {}
  });

  el.btnPlayAgain.addEventListener("click", async () => {
    if (state.isSolo) {
      el.modalGameOver.classList.add("hidden");
      initPassAndPlayMode();
      return;
    }
    try {
      await fetch("/api/fargekoden/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          hostToken: state.hostToken,
          action: "restart",
        }),
      });
      pollRoomState();
    } catch (e) {}
  });

  async function returnToLounge() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
    if (state.isSolo || !state.roomCode) {
      showView("lobby");
      return;
    }
    try {
      await fetch("/api/party/to-lounge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          hostToken: state.hostToken,
        }),
      });
    } catch (e) {}
    window.location.href = `/party/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`;
  }

  el.btnReturnLobby.addEventListener("click", returnToLounge);
  el.btnBack.addEventListener("click", e => {
    e.preventDefault();
    returnToLounge();
  });

  // =========================================================================
  // Sync Multiplayer UI
  // =========================================================================
  function updateMultiplayerUI(roomData) {
    const gs = roomData.gameState || {};
    state.isHost = Boolean(roomData.isHost);
    state.players = roomData.players || [];
    state.turnState = gs.turn_state || "giving_clue_1";
    state.isGiver = Boolean(gs.is_giver);
    state.hasPlacedThisStep = Boolean(gs.has_placed_this_step);
    state.activeGiverId = gs.active_giver_id;
    state.activeGiverName = gs.active_giver_name || "Hintgiver";
    state.currentRound = gs.current_round || 1;
    state.totalRounds = gs.total_rounds || 1;
    state.timeRemaining = Math.ceil(gs.time_remaining || 0);
    state.candidates = gs.candidates || [];
    state.targetPos = gs.target_pos || null;
    state.clue1 = gs.clue_1 || "";
    state.clue2 = gs.clue_2 || "";
    state.markers = gs.markers || [];

    el.roundIndicator.textContent = `Runde ${state.currentRound}/${state.totalRounds}`;
    el.timerText.textContent = String(state.timeRemaining);

    // Clues Banner
    el.clue1Text.textContent = state.clue1 ? `«${state.clue1.toUpperCase()}»` : "Venter på 1. hint…";
    if (state.clue2) {
      el.clue2Chip.classList.remove("muted");
      el.clue2Text.textContent = `«${state.clue2.toUpperCase()}»`;
    } else {
      el.clue2Chip.classList.add("muted");
      el.clue2Text.textContent = "—";
    }

    // Giver Dock & Status Bar
    el.btnNextTurnNow.classList.toggle("hidden", state.turnState !== "turn_recap");

    if (state.turnState === "giving_clue_1") {
      if (state.isGiver) {
        el.giverDock.classList.remove("hidden");
        el.giverStep1.classList.remove("hidden");
        el.giverStep2.classList.add("hidden");
        renderCandidateButtons();
        el.statusText.textContent = "DIN TUR SOM HINTGIVER: Velg en målfarge og skriv ett ord som hint.";
      } else {
        el.giverDock.classList.add("hidden");
        el.statusText.textContent = `${state.activeGiverName} velger en hemmelig farge og skriver sitt første hint (1 ord)…`;
      }
    } else if (state.turnState === "guessing_1") {
      el.giverDock.classList.add("hidden");
      if (state.isGiver && state.players.length > 1) {
        el.statusText.textContent = `Spillerne plasserer sin 1. brikke basert på «${state.clue1.toUpperCase()}»…`;
      } else if (state.hasPlacedThisStep) {
        el.statusText.textContent = "1. brikke er plassert! Venter på de andre spillerne…";
      } else {
        el.statusText.textContent = `Klikk på fargebrettet for å plassere din 1. brikke for hintet «${state.clue1.toUpperCase()}»!`;
      }
    } else if (state.turnState === "giving_clue_2") {
      if (state.isGiver) {
        el.giverDock.classList.remove("hidden");
        el.giverStep1.classList.add("hidden");
        el.giverStep2.classList.remove("hidden");
        el.statusText.textContent = "Gi et 2. hint (maks 2 ord) for å lede spillerne nærmere blinken – eller vis fasit nå!";
      } else {
        el.giverDock.classList.add("hidden");
        el.statusText.textContent = `${state.activeGiverName} vurderer brikkene og skriver et 2. hint (opptil 2 ord)…`;
      }
    } else if (state.turnState === "guessing_2") {
      el.giverDock.classList.add("hidden");
      if (state.isGiver && state.players.length > 1) {
        el.statusText.textContent = `Spillerne plasserer sin 2. brikke basert på «${state.clue2.toUpperCase()}»…`;
      } else if (state.hasPlacedThisStep) {
        el.statusText.textContent = "2. brikke er plassert! Venter på avsløring av 3×3-rammen…";
      } else {
        el.statusText.textContent = `Klikk på fargebrettet for å plassere din 2. brikke (${state.clue1.toUpperCase()} → ${state.clue2.toUpperCase()})!`;
      }
    } else if (state.turnState === "turn_recap") {
      el.giverDock.classList.add("hidden");
      const [tr, tc] = state.targetPos || [0, 0];
      const coord = getCoordLabel(tr, tc);
      const bonus = gs.last_turn_summary ? gs.last_turn_summary.giverBonus : 0;
      el.statusText.textContent = `Blinken var ${coord}! 3×3-rammen er vist på brettet (${state.activeGiverName} fikk +${bonus}p som hintgiver).`;
    } else if (state.turnState === "game_over") {
      el.giverDock.classList.add("hidden");
      showGameOverModal(gs.podium || []);
    }

    if (state.turnState !== "game_over") {
      el.modalGameOver.classList.add("hidden");
    }

    renderSidebarPlayers();
    renderBoardHighlightsAndMarkers();
  }

  function renderSidebarPlayers() {
    el.playersCountBadge.textContent = String(state.players.length);
    el.playersList.innerHTML = "";
    const activeGuesser = (state.localSubMode === "pass_and_play" && (state.turnState === "guessing_1" || state.turnState === "guessing_2"))
      ? state.guesserQueue[state.currentGuesserIndex]
      : null;

    state.players.forEach(p => {
      const isGiver = p.id === state.activeGiverId;
      const isTurn = activeGuesser && activeGuesser.id === p.id;
      const row = document.createElement("div");
      row.className = `fk-player-row ${isGiver ? "active-giver" : ""} ${isTurn ? "active-turn" : ""}`;
      row.innerHTML = `
        <img src="${getAvatarSrc(p.avatar)}" class="fk-player-avatar" alt="" />
        <div class="fk-player-info">
          <div class="fk-player-name">
            <span class="fk-player-dot" style="background:${p.color || "#ffd166"};"></span>
            <span>${escapeHtml(p.name)}${p.id === state.playerId ? " (Deg)" : ""}</span>
          </div>
          <div class="fk-player-score">${p.score || 0} poeng</div>
        </div>
        <span class="fk-player-tag ${isTurn ? "active-turn" : ""}">${isGiver ? "Hintgiver" : (isTurn ? "Gjett nå!" : "")}</span>
      `;
      el.playersList.appendChild(row);
    });
  }

  function showGameOverModal(podium) {
    el.modalGameOver.classList.remove("hidden");
    el.podiumContainer.innerHTML = "";
    const ranks = ["1.", "2.", "3."];
    podium.forEach((p, i) => {
      const item = document.createElement("div");
      item.className = "fk-podium-item";
      item.innerHTML = `
        <span>${ranks[i] || `${i + 1}.`} ${escapeHtml(p.name)}</span>
        <span style="color:#fbbf24;">${p.score} poeng</span>
      `;
      el.podiumContainer.appendChild(item);
    });
  }

  async function pollRoomState() {
    if (state.isSolo) return;
    try {
      const resp = await fetch(`/api/party/state?code=${encodeURIComponent(state.roomCode)}&playerId=${encodeURIComponent(state.playerId)}&v=${state.version}`);
      if (!resp.ok) return;
      const data = await resp.json();
      if (!data.ok) return;

      if (data.kicked) {
        window.location.href = "/party/";
        return;
      }
      if (!data.currentGame) {
        window.location.href = `/party/?room=${encodeURIComponent(state.roomCode)}`;
        return;
      }
      state.version = data.version;
      updateMultiplayerUI(data);
    } catch (e) {}
  }

  // =========================================================================
  // Standalone Pass & Play (2–16 spillere på 1 enhet)
  // =========================================================================
  function renderLocalPlayersNamesGrid(count) {
    if (!el.localPlayersNamesGrid) return;
    const existing = [];
    el.localPlayersNamesGrid.querySelectorAll(".fk-name-field").forEach((inp) => {
      existing.push(inp.value.trim());
    });

    el.localPlayersNamesGrid.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const pal = PASS_AND_PLAY_PALETTE[i % PASS_AND_PLAY_PALETTE.length];
      const prev = existing[i];
      const defaultVal = `Spiller ${i + 1}`;
      const val = prev && prev.length ? prev : defaultVal;
      const item = document.createElement("div");
      item.className = "fk-name-input-item";
      item.innerHTML = `
        <span class="fk-name-color-dot" style="background:${pal.color};"></span>
        <input type="text" class="fk-name-field" id="fkPlayerName_${i}" maxlength="16" placeholder="${defaultVal}" value="${escapeHtml(val)}" />
      `;
      el.localPlayersNamesGrid.appendChild(item);
    }
  }

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

  function initPassAndPlayMode() {
    state.localSubMode = "pass_and_play";
    el.backBtnText.textContent = "Hub";
    el.timerBubble.classList.add("hidden");

    const count = state.passAndPlayPlayerCount || 3;
    state.players = [];
    for (let i = 0; i < count; i++) {
      const inputEl = document.getElementById(`fkPlayerName_${i}`);
      const name = (inputEl ? inputEl.value.trim() : "") || `Spiller ${i + 1}`;
      const pal = PASS_AND_PLAY_PALETTE[i % PASS_AND_PLAY_PALETTE.length];
      state.players.push({
        id: `p${i + 1}`,
        name,
        color: pal.color,
        avatar: pal.avatar,
        score: 0,
      });
    }

    if (state.passAndPlayRoundRule === "1_per_player") {
      state.totalRounds = state.players.length * 1;
    } else if (state.passAndPlayRoundRule === "2_per_player") {
      state.totalRounds = state.players.length * 2;
    } else {
      state.totalRounds = 4;
    }

    state.currentRound = 1;
    startPassAndPlayRound();
  }

  function startPassAndPlayRound() {
    const giverIdx = (state.currentRound - 1) % state.players.length;
    const giver = state.players[giverIdx];
    state.activeGiverId = giver.id;
    state.activeGiverName = giver.name;
    state.isGiver = true;
    state.guesserQueue = state.players.filter((_, idx) => idx !== giverIdx);
    state.currentGuesserIndex = 0;

    // Pick 4 random candidate colors
    const colBuckets = [
      Math.floor(2 + Math.random() * 6),
      Math.floor(8 + Math.random() * 7),
      Math.floor(15 + Math.random() * 7),
      Math.floor(22 + Math.random() * 6),
    ];
    state.candidates = colBuckets.map(c => [Math.floor(2 + Math.random() * 12), c]);
    state.targetPos = state.candidates[0];

    state.clue1 = "";
    state.clue2 = "";
    state.markers = [];
    state.turnState = "giving_clue_1";

    el.btnSoloNext.classList.add("hidden");
    el.roundIndicator.textContent = `Runde ${state.currentRound} / ${state.totalRounds}`;
    el.clue1Chip.classList.remove("muted");
    el.clue1Text.textContent = "Venter på hint…";
    el.clue2Chip.classList.add("muted");
    el.clue2Text.textContent = "—";
    el.statusText.textContent = `Send enheten til ${state.activeGiverName}! Velg hemmelig målfarge og skriv inn 1 ord som hint!`;

    el.giverDock.classList.remove("hidden");
    el.giverStep1.classList.remove("hidden");
    el.giverStep2.classList.add("hidden");
    renderCandidateButtons();

    renderSidebarPlayers();
    renderBoardHighlightsAndMarkers();
  }

  function handlePassAndPlaySubmitClue1(clue) {
    state.clue1 = clue;
    state.turnState = "guessing_1";
    state.isGiver = false;
    el.giverDock.classList.add("hidden");
    el.clue1Text.textContent = `«${clue.toUpperCase()}»`;

    state.currentGuesserIndex = 0;
    const currentGuesser = state.guesserQueue[0];
    el.statusText.textContent = `Send enheten til ${currentGuesser.name}! Plasser 1. brikke for «${clue.toUpperCase()}».`;
    renderSidebarPlayers();
    renderBoardHighlightsAndMarkers();
  }

  function handlePassAndPlaySubmitClue2(clue) {
    state.clue2 = clue;
    state.turnState = "guessing_2";
    state.isGiver = false;
    el.giverDock.classList.add("hidden");
    el.clue2Chip.classList.remove("muted");
    el.clue2Text.textContent = `«${clue.toUpperCase()}»`;

    state.currentGuesserIndex = 0;
    const currentGuesser = state.guesserQueue[0];
    el.statusText.textContent = `Send enheten til ${currentGuesser.name}! Plasser 2. brikke for «${clue.toUpperCase()}».`;
    renderSidebarPlayers();
    renderBoardHighlightsAndMarkers();
  }

  function handlePassAndPlaySkipClue2() {
    scorePassAndPlayTurn();
  }

  function handlePassAndPlayPlaceMarker(r, c) {
    const currentGuesser = state.guesserQueue[state.currentGuesserIndex];
    if (!currentGuesser) return;

    if (state.turnState === "guessing_1") {
      state.markers.push({
        playerId: currentGuesser.id,
        playerName: currentGuesser.name,
        playerColor: currentGuesser.color,
        r,
        c,
        guessRound: 1,
        points: 0,
      });

      state.currentGuesserIndex++;
      if (state.currentGuesserIndex < state.guesserQueue.length) {
        const nextGuesser = state.guesserQueue[state.currentGuesserIndex];
        el.statusText.textContent = `Send enheten til ${nextGuesser.name}! Plasser 1. brikke for «${state.clue1.toUpperCase()}».`;
        renderSidebarPlayers();
        renderBoardHighlightsAndMarkers();
      } else {
        // All guessers placed 1st marker! Hand back to Hintgiver for Clue 2
        state.turnState = "giving_clue_2";
        state.isGiver = true;
        el.giverDock.classList.remove("hidden");
        el.giverStep1.classList.add("hidden");
        el.giverStep2.classList.remove("hidden");
        el.statusText.textContent = `Send enheten tilbake til ${state.activeGiverName}! Gi et 2. hint (maks 2 ord) – eller vis fasit nå.`;
        renderSidebarPlayers();
        renderBoardHighlightsAndMarkers();
      }
    } else if (state.turnState === "guessing_2") {
      state.markers.push({
        playerId: currentGuesser.id,
        playerName: currentGuesser.name,
        playerColor: currentGuesser.color,
        r,
        c,
        guessRound: 2,
        points: 0,
      });

      state.currentGuesserIndex++;
      if (state.currentGuesserIndex < state.guesserQueue.length) {
        const nextGuesser = state.guesserQueue[state.currentGuesserIndex];
        el.statusText.textContent = `Send enheten til ${nextGuesser.name}! Plasser 2. brikke for «${state.clue2.toUpperCase()}».`;
        renderSidebarPlayers();
        renderBoardHighlightsAndMarkers();
      } else {
        scorePassAndPlayTurn();
      }
    }
  }

  function scorePassAndPlayTurn() {
    const giverIdx = (state.currentRound - 1) % state.players.length;
    const giver = state.players[giverIdx];
    const [tr, tc] = state.targetPos;

    let giverBonus = 0;
    const pointsMap = {};
    state.players.forEach(p => { pointsMap[p.id] = 0; });

    state.markers.forEach(m => {
      const dist = Math.max(Math.abs(m.r - tr), Math.abs(m.c - tc));
      let pts = 0;
      if (dist === 0) {
        pts = 3;
        giverBonus += 1;
      } else if (dist === 1) {
        pts = 2;
        giverBonus += 1;
      } else if (dist === 2) {
        pts = 1;
      }
      m.points = pts;
      pointsMap[m.playerId] = (pointsMap[m.playerId] || 0) + pts;
    });

    state.players.forEach(p => {
      p.score += (pointsMap[p.id] || 0);
    });
    giver.score += giverBonus;

    state.turnState = "turn_recap";
    el.giverDock.classList.add("hidden");
    el.statusText.textContent = `Blinken var ${getCoordLabel(tr, tc)}! Hintgiver ${giver.name} fikk +${giverBonus}p i bonus.`;
    el.btnSoloNext.textContent = state.currentRound < state.totalRounds ? "Neste runde →" : "Se sluttresultat! 🏆";
    el.btnSoloNext.classList.remove("hidden");
    renderSidebarPlayers();
    renderBoardHighlightsAndMarkers();
  }

  el.btnSoloNext.addEventListener("click", () => {
    if (state.localSubMode === "pass_and_play") {
      if (state.currentRound < state.totalRounds) {
        state.currentRound++;
        startPassAndPlayRound();
      } else {
        const podium = state.players.slice().sort((a, b) => b.score - a.score);
        showGameOverModal(podium);
      }
    }
  });

  function showView(viewName) {
    if (!el.viewLobby || !el.viewGame) return;
    if (viewName === "lobby") {
      el.viewLobby.classList.remove("hidden");
      el.viewGame.classList.add("hidden");
      if (el.btnLeaveRoom) el.btnLeaveRoom.classList.add("hidden");
      if (state.pollTimer) {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
      }
    } else if (viewName === "game") {
      el.viewLobby.classList.add("hidden");
      el.viewGame.classList.remove("hidden");
      if (el.btnLeaveRoom) el.btnLeaveRoom.classList.remove("hidden");
    }
  }

  function initLobbyTabs() {
    const tabs = [
      { btn: el.tabLobbyLocal, panel: el.panelLobbyLocal },
      { btn: el.tabLobbyRoom, panel: el.panelLobbyRoom },
    ];

    tabs.forEach(({ btn, panel }) => {
      if (!btn || !panel) return;
      btn.addEventListener("click", () => {
        tabs.forEach((t) => {
          if (t.btn) {
            t.btn.classList.remove("active");
            t.btn.setAttribute("aria-selected", "false");
          }
          if (t.panel) t.panel.classList.add("hidden");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
        panel.classList.remove("hidden");
      });
    });

    // Wire up player count picker and initial player names grid
    bindPlayerCountPicker(el.controlFkPlayerCount, state.passAndPlayPlayerCount, val => {
      state.passAndPlayPlayerCount = val;
      renderLocalPlayersNamesGrid(val);
    });
    renderLocalPlayersNamesGrid(state.passAndPlayPlayerCount);

    if (el.controlFkRounds) {
      el.controlFkRounds.querySelectorAll(".seg-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          el.controlFkRounds.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          state.passAndPlayRoundRule = btn.dataset.rounds || "2_per_player";
        });
      });
    }

    if (window.PartyConnect) {
      window.PartyConnect.init({
        gameId: "fargekoden",
        createBtnId: "btnCreatePartyRoom",
        joinBtnId: "btnJoinPartyRoom",
        hostInputId: "inputPartyHostName",
        joinInputId: "inputPartyJoinName",
        codeInputId: "inputPartyRoomCode",
      });
    }

    if (el.btnStartFkLocal) {
      el.btnStartFkLocal.addEventListener("click", () => {
        initPassAndPlayMode();
        showView("game");
      });
    }

    if (el.btnSubmitJoinFkRoom) {
      el.btnSubmitJoinFkRoom.addEventListener("click", () => {
        const code = (el.inputFkRoomCode ? el.inputFkRoomCode.value : "").trim().toUpperCase();
        if (!code) {
          alert("Skriv inn en romkode.");
          return;
        }
        window.location.href = `/party/?room=${encodeURIComponent(code)}`;
      });
    }

    if (el.btnLeaveRoom) {
      el.btnLeaveRoom.addEventListener("click", () => {
        returnToLounge();
      });
    }
  }

  buildBoardDOM();
  initLobbyTabs();

  if (roomCodeParam && playerIdParam) {
    if (el.fkModeBar) el.fkModeBar.style.display = "none";
    showView("game");
    pollRoomState();
    state.pollTimer = setInterval(pollRoomState, 750);
  } else if (roomCodeParam) {
    if (el.inputFkRoomCode) el.inputFkRoomCode.value = roomCodeParam;
    if (el.tabLobbyRoom) el.tabLobbyRoom.click();
    showView("lobby");
  } else {
    showView("lobby");
  }
})();

