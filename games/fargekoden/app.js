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
  const roomCodeParam = (urlParams.get("room") || urlParams.get("code") || sessionStorage.getItem("party_room_code") || "").trim().toUpperCase();
  const playerIdParam = (urlParams.get("player") || urlParams.get("playerId") || sessionStorage.getItem("party_player_id") || "").trim();
  const hostTokenParam = (localStorage.getItem("party_host_token") || "").trim();

  const SOLO_CHALLENGES = [
    { clue1: "Jordbær", clue2: "Modent bær", r: 7, c: 29 },
    { clue1: "Solsikke", clue2: "Sommerblomst", r: 6, c: 4 },
    { clue1: "Furu", clue2: "Mørk skog", r: 12, c: 11 },
    { clue1: "Lavendel", clue2: "Fransk duft", r: 3, c: 22 },
    { clue1: "Flamingo", clue2: "Tropisk fugl", r: 4, c: 27 },
    { clue1: "Isbre", clue2: "Kaldt vann", r: 3, c: 16 },
    { clue1: "Gresskar", clue2: "Halloween-lykt", r: 7, c: 2 },
    { clue1: "Midnatt", clue2: "Dyp nattehimmel", r: 13, c: 20 },
    { clue1: "osean", clue2: "Dypt hav", r: 10, c: 18 },
    { clue1: "Lime", clue2: "Sur sitrus", r: 6, c: 8 },
    { clue1: "Plomme", clue2: "Mørk frukt", r: 12, c: 24 },
    { clue1: "Fersken", clue2: "Myk frukt", r: 3, c: 2 },
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

    // Solo state
    soloScore: 0,
    soloRound: 1,
    soloStep: 1,
    soloTarget: [7, 29],

    soundEnabled: localStorage.getItem("tegn_sound") !== "false",
    audioCtx: null,
  };

  const el = {
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

    fkModeBar: document.getElementById("fkModeBar"),
    tabPassAndPlay: document.getElementById("tabPassAndPlay"),
    tabSolo: document.getElementById("tabSolo"),
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
    if (!state.isSolo && state.isGiver && state.turnState === "giving_clue_1" && r >= 1 && r <= 14 && c >= 1 && c <= 28) {
      state.targetPos = [r, c];
      playTone(587.33, 0.1, "triangle", 0.14);
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
      if (state.localSubMode === "pass_and_play") {
        handlePassAndPlayPlaceMarker(r, c);
      } else {
        handleSoloPlaceMarker(r, c);
      }
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
        const cell = cellElements[r][c];
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
      startSoloRound();
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
    if (state.isSolo) {
      window.location.href = "/";
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
    window.location.href = `/party/?room=${encodeURIComponent(state.roomCode)}`;
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
    state.players.forEach(p => {
      const isGiver = p.id === state.activeGiverId;
      const row = document.createElement("div");
      row.className = `fk-player-row ${isGiver ? "active-giver" : ""}`;
      row.innerHTML = `
        <img src="${getAvatarSrc(p.avatar)}" class="fk-player-avatar" alt="" />
        <div class="fk-player-info">
          <div class="fk-player-name">
            <span class="fk-player-dot" style="background:${p.color || "#ffd166"};"></span>
            <span>${escapeHtml(p.name)}${p.id === state.playerId ? " (Deg)" : ""}</span>
          </div>
          <div class="fk-player-score">${p.score || 0} poeng</div>
        </div>
        <span class="fk-player-tag">${isGiver ? "Hintgiver" : ""}</span>
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
  // Standalone Pass & Play (2 spillere på 1 enhet) & Solo Mode
  // =========================================================================
  function initPassAndPlayMode() {
    state.localSubMode = "pass_and_play";
    if (el.tabPassAndPlay) el.tabPassAndPlay.classList.add("active");
    if (el.tabSolo) el.tabSolo.classList.remove("active");
    el.backBtnText.textContent = "Hub";
    el.timerBubble.classList.add("hidden");

    state.players = [
      { id: "p1", name: "Spiller 1", color: "#38bdf8", avatar: "charbear", score: 0 },
      { id: "p2", name: "Spiller 2", color: "#f43f5e", avatar: "pixiu", score: 0 },
    ];
    state.currentRound = 1;
    state.totalRounds = 4;
    startPassAndPlayRound();
  }

  function startPassAndPlayRound() {
    const giverIdx = (state.currentRound - 1) % 2;
    state.activeGiverId = state.players[giverIdx].id;
    state.activeGiverName = state.players[giverIdx].name;
    state.isGiver = true;

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
    el.statusText.textContent = `${state.activeGiverName}: Velg en målfarge under og tast inn 1 ord som hint!`;

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

    const giverIdx = (state.currentRound - 1) % 2;
    const guesserIdx = 1 - giverIdx;
    const guesserName = state.players[guesserIdx].name;

    el.statusText.textContent = `Send enheten til ${guesserName}! Klikk på fargebrettet for å plassere 1. brikke for «${clue.toUpperCase()}».`;
    renderBoardHighlightsAndMarkers();
  }

  function handlePassAndPlaySubmitClue2(clue) {
    state.clue2 = clue;
    state.turnState = "guessing_2";
    state.isGiver = false;
    el.giverDock.classList.add("hidden");
    el.clue2Chip.classList.remove("muted");
    el.clue2Text.textContent = `«${clue.toUpperCase()}»`;

    const giverIdx = (state.currentRound - 1) % 2;
    const guesserIdx = 1 - giverIdx;
    const guesserName = state.players[guesserIdx].name;

    el.statusText.textContent = `Send enheten til ${guesserName}! Klikk på fargebrettet for å plassere 2. brikke.`;
    renderBoardHighlightsAndMarkers();
  }

  function handlePassAndPlaySkipClue2() {
    scorePassAndPlayTurn();
  }

  function handlePassAndPlayPlaceMarker(r, c) {
    const giverIdx = (state.currentRound - 1) % 2;
    const guesserIdx = 1 - giverIdx;
    const guesser = state.players[guesserIdx];

    if (state.turnState === "guessing_1") {
      state.markers.push({
        playerId: guesser.id,
        playerName: guesser.name,
        playerColor: guesser.color,
        r,
        c,
        guessRound: 1,
        points: 0,
      });

      state.turnState = "giving_clue_2";
      state.isGiver = true;
      el.giverDock.classList.remove("hidden");
      el.giverStep1.classList.add("hidden");
      el.giverStep2.classList.remove("hidden");
      el.statusText.textContent = `Send enheten tilbake til ${state.activeGiverName}! Gi et 2. hint (maks 2 ord) – eller vis fasit nå.`;
      renderBoardHighlightsAndMarkers();
    } else if (state.turnState === "guessing_2") {
      state.markers.push({
        playerId: guesser.id,
        playerName: guesser.name,
        playerColor: guesser.color,
        r,
        c,
        guessRound: 2,
        points: 0,
      });
      scorePassAndPlayTurn();
    }
  }

  function scorePassAndPlayTurn() {
    const giverIdx = (state.currentRound - 1) % 2;
    const guesserIdx = 1 - giverIdx;
    const [tr, tc] = state.targetPos;

    let guesserPts = 0;
    let giverBonus = 0;

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
      guesserPts += pts;
    });

    state.players[guesserIdx].score += guesserPts;
    state.players[giverIdx].score += giverBonus;
    state.turnState = "turn_recap";

    el.giverDock.classList.add("hidden");
    el.statusText.textContent = `Blinken var ${getCoordLabel(tr, tc)}! ${state.players[guesserIdx].name} fikk +${guesserPts}p, ${state.activeGiverName} fikk +${giverBonus}p som hintgiver!`;
    el.btnSoloNext.textContent = state.currentRound < state.totalRounds ? "Neste runde →" : "Se resultat!";
    el.btnSoloNext.classList.remove("hidden");
    renderSidebarPlayers();
    renderBoardHighlightsAndMarkers();
  }

  function initSoloMode() {
    state.localSubMode = "solo";
    if (el.tabSolo) el.tabSolo.classList.add("active");
    if (el.tabPassAndPlay) el.tabPassAndPlay.classList.remove("active");
    el.backBtnText.textContent = "Hub";
    el.timerBubble.classList.add("hidden");
    state.players = [
      { id: "solo", name: localStorage.getItem("party_player_name") || "Spiller 1", color: "#38bdf8", avatar: localStorage.getItem("ntnu_char_config") || "charbear", score: 0 }
    ];
    startSoloRound();
  }

  function startSoloRound() {
    const ch = SOLO_CHALLENGES[(state.soloRound - 1) % SOLO_CHALLENGES.length];
    state.soloTarget = [ch.r, ch.c];
    state.targetPos = [ch.r, ch.c];
    state.clue1 = ch.clue1;
    state.clue2 = "";
    state.markers = [];
    state.turnState = "guessing_1";
    state.isGiver = false;

    el.btnSoloNext.classList.add("hidden");
    el.btnSoloNext.textContent = "Neste oppgave →";
    el.roundIndicator.textContent = `Oppgave ${state.soloRound}`;
    el.clue1Text.textContent = `«${state.clue1.toUpperCase()}»`;
    el.clue2Chip.classList.add("muted");
    el.clue2Text.textContent = "—";
    el.statusText.textContent = `Solo-modus: Klikk på fargebrettet for å plassere din 1. brikke for hintet «${state.clue1.toUpperCase()}»!`;

    renderSidebarPlayers();
    renderBoardHighlightsAndMarkers();
  }

  function handleSoloPlaceMarker(r, c) {
    const ch = SOLO_CHALLENGES[(state.soloRound - 1) % SOLO_CHALLENGES.length];
    if (state.turnState === "guessing_1") {
      state.markers.push({
        playerId: "solo",
        playerName: state.players[0].name,
        playerColor: "#38bdf8",
        r,
        c,
        guessRound: 1,
        points: 0,
      });
      state.clue2 = ch.clue2;
      state.turnState = "guessing_2";
      el.clue2Chip.classList.remove("muted");
      el.clue2Text.textContent = `«${state.clue2.toUpperCase()}»`;
      el.statusText.textContent = `2. hint er «${state.clue2.toUpperCase()}»! Plasser din 2. brikke på fargebrettet.`;
      renderBoardHighlightsAndMarkers();
    } else if (state.turnState === "guessing_2") {
      state.markers.push({
        playerId: "solo",
        playerName: state.players[0].name,
        playerColor: "#38bdf8",
        r,
        c,
        guessRound: 2,
        points: 0,
      });

      const [tr, tc] = state.soloTarget;
      let turnPts = 0;
      state.markers.forEach(m => {
        const dist = Math.max(Math.abs(m.r - tr), Math.abs(m.c - tc));
        const pts = dist === 0 ? 3 : dist === 1 ? 2 : dist === 2 ? 1 : 0;
        m.points = pts;
        turnPts += pts;
      });
      state.players[0].score += turnPts;
      state.turnState = "turn_recap";
      el.statusText.textContent = `Blinken var ${getCoordLabel(tr, tc)}! Du fikk +${turnPts} poeng denne runden!`;
      el.btnSoloNext.textContent = "Neste oppgave →";
      el.btnSoloNext.classList.remove("hidden");
      renderSidebarPlayers();
      renderBoardHighlightsAndMarkers();
    }
  }

  el.btnSoloNext.addEventListener("click", () => {
    if (state.localSubMode === "pass_and_play") {
      if (state.currentRound < state.totalRounds) {
        state.currentRound++;
        startPassAndPlayRound();
      } else {
        showGameOverModal(state.players.slice().sort((a, b) => b.score - a.score));
      }
    } else {
      state.soloRound++;
      startSoloRound();
    }
  });

  if (el.tabPassAndPlay) {
    el.tabPassAndPlay.addEventListener("click", () => {
      initPassAndPlayMode();
    });
  }
  if (el.tabSolo) {
    el.tabSolo.addEventListener("click", () => {
      initSoloMode();
    });
  }

  buildBoardDOM();
  if (state.isSolo) {
    initPassAndPlayMode();
  } else {
    if (el.fkModeBar) el.fkModeBar.style.display = "none";
    pollRoomState();
    state.pollTimer = setInterval(pollRoomState, 750);
  }
})();

