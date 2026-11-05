/**
 * Imposter (Tegn-Imposter / Fake Artist) - Client Application
 * Features:
 * - 3+ players receive a secret word in a shared category, except 1 Imposter who gets a related decoy word.
 * - Turn-based 1-stroke drawing: each player draws exactly one continuous line per stroke round.
 * - After each stroke round, players discuss & vote on who the Imposter is (or vote for another stroke round).
 * - The Imposter can guess the Crew's word anytime (2 attempts) or gets 1 final 20s guess if voted out!
 */

(function () {
  "use strict";

  const urlParams = new URLSearchParams(window.location.search);
  const roomCodeParam = (urlParams.get("room") || urlParams.get("code") || sessionStorage.getItem("party_room_code") || localStorage.getItem("party_room_code") || "").trim().toUpperCase();
  const playerIdParam = (urlParams.get("player") || urlParams.get("playerId") || sessionStorage.getItem("party_player_id") || localStorage.getItem("party_player_id") || "").trim();
  const hostTokenParam = (localStorage.getItem("party_host_token") || "").trim();

  const PALETTE_COLORS = [
    "#111827", "#ef4444", "#f97316", "#eab308",
    "#84cc16", "#10b981", "#06b6d4", "#3b82f6",
    "#8b5cf6", "#ec4899", "#8d5b36", "#f3c299",
  ];

  const state = {
    roomCode: roomCodeParam,
    playerId: playerIdParam,
    hostToken: hostTokenParam,
    isHost: false,
    version: -1,
    matchNumber: 0,
    lastActionId: 0,
    pollTimer: null,
    drawSyncTimer: null,
    isPolling: false,

    // Game state
    turnState: "drawing", // "drawing", "voting", "imposter_last_chance", "round_over"
    strokeRound: 1,
    isDrawer: false,
    isImposter: false,
    myWord: "",
    category: "",
    activeDrawerId: null,
    activeDrawerName: "",
    timeRemaining: 25,
    imposterGuessesLeft: 2,
    myVote: null,
    voteCounts: {},
    votedPlayerIds: [],
    players: [],

    // Drawing state (1 continuous stroke per turn)
    currentColor: "#ef4444",
    currentSize: 8,
    hasAutoColoredForTurn: false,
    isDrawing: false,
    hasCommittedStrokeThisTurn: false,
    currentStrokePoints: [],
    lastSentIndex: 0,
    unsentActions: [],
    isFlushingDraw: false,

    // Chat tracking
    lastChatMessageId: 0,
    renderedMessageIds: new Set(),

    // Audio
    soundEnabled: localStorage.getItem("tegn_sound") !== "false",
    audioCtx: null,
  };

  const el = {
    btnBack: document.getElementById("btnBack"),
    backBtnText: document.getElementById("backBtnText"),
    roundIndicator: document.getElementById("roundIndicator"),
    roleWordBanner: document.getElementById("roleWordBanner"),
    myRoleBadge: document.getElementById("myRoleBadge"),
    myCategoryLabel: document.getElementById("myCategoryLabel"),
    mySecretWord: document.getElementById("mySecretWord"),
    timerBubble: document.getElementById("timerBubble"),
    timerText: document.getElementById("timerText"),
    btnSoundToggle: document.getElementById("btnSoundToggle"),

    playersCountBadge: document.getElementById("playersCountBadge"),
    playersList: document.getElementById("playersList"),

    turnStatusStrip: document.getElementById("turnStatusStrip"),
    turnStatusDot: document.getElementById("turnStatusDot"),
    turnStatusText: document.getElementById("turnStatusText"),
    btnPassStroke: document.getElementById("btnPassStroke"),

    canvasViewportWrap: document.getElementById("canvasViewportWrap"),
    canvas: document.getElementById("paintCanvas"),

    lastChanceOverlay: document.getElementById("lastChanceOverlay"),
    lcTitle: document.getElementById("lcTitle"),
    lcSubtitle: document.getElementById("lcSubtitle"),
    lcGuessForm: document.getElementById("lcGuessForm"),
    lcGuessInput: document.getElementById("lcGuessInput"),

    votingPanel: document.getElementById("votingPanel"),
    voteProgressBadge: document.getElementById("voteProgressBadge"),
    voteCandidatesGrid: document.getElementById("voteCandidatesGrid"),

    drawingToolbar: document.getElementById("drawingToolbar"),
    strokeRuleHint: document.getElementById("strokeRuleHint"),
    colorsPalette: document.getElementById("colorsPalette"),
    brushSizesGroup: document.getElementById("brushSizesGroup"),

    imposterGuessBox: document.getElementById("imposterGuessBox"),
    imposterAttemptsBadge: document.getElementById("imposterAttemptsBadge"),
    imposterGuessForm: document.getElementById("imposterGuessForm"),
    imposterGuessInput: document.getElementById("imposterGuessInput"),
    btnSubmitImposterGuess: document.getElementById("btnSubmitImposterGuess"),

    chatMessagesContainer: document.getElementById("chatMessagesContainer"),
    chatForm: document.getElementById("chatForm"),
    chatInput: document.getElementById("chatInput"),

    modalRoundOver: document.getElementById("modalRoundOver"),
    roWinnerBadge: document.getElementById("roWinnerBadge"),
    roTitle: document.getElementById("roTitle"),
    roReason: document.getElementById("roReason"),
    roCrewWord: document.getElementById("roCrewWord"),
    roImposterWord: document.getElementById("roImposterWord"),
    roImposterIdentity: document.getElementById("roImposterIdentity"),
    btnNextRound: document.getElementById("btnNextRound"),
    btnReturnLobby: document.getElementById("btnReturnLobby"),
  };

  const ctx = el.canvas.getContext("2d", { willReadFrequently: true });
  clearCanvasLocally("#ffffff");

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
  // Audio Helpers
  // =========================================================================
  function getAudioContext() {
    if (!state.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) state.audioCtx = new AudioCtx();
    }
    if (state.audioCtx && state.audioCtx.state === "suspended") {
      state.audioCtx.resume();
    }
    return state.audioCtx;
  }

  function playTone(freq, duration = 0.12, type = "sine", gainVal = 0.14) {
    if (!state.soundEnabled) return;
    try {
      const ac = getAudioContext();
      if (!ac) return;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      gain.gain.setValueAtTime(gainVal, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + duration);
    } catch (e) {}
  }

  function updateSoundButton() {
    el.btnSoundToggle.textContent = state.soundEnabled ? "Lyd på" : "Lyd av";
    localStorage.setItem("tegn_sound", String(state.soundEnabled));
  }

  el.btnSoundToggle.addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    updateSoundButton();
    if (state.soundEnabled) playTone(659.25, 0.12);
  });
  updateSoundButton();

  // =========================================================================
  // Palette & Brush Sizes
  // =========================================================================
  function initPalette() {
    el.colorsPalette.innerHTML = "";
    PALETTE_COLORS.forEach(color => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `color-swatch-btn ${color.toLowerCase() === state.currentColor.toLowerCase() ? "active" : ""}`;
      btn.style.backgroundColor = color;
      btn.dataset.color = color;
      btn.addEventListener("click", () => {
        setActiveColor(color);
      });
      el.colorsPalette.appendChild(btn);
    });
  }

  function setActiveColor(color) {
    if (!color) return;
    state.currentColor = color;
    el.colorsPalette.querySelectorAll(".color-swatch-btn").forEach(b => {
      b.classList.toggle("active", (b.dataset.color || "").toLowerCase() === color.toLowerCase());
    });
  }

  el.brushSizesGroup.querySelectorAll(".size-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.currentSize = parseInt(btn.dataset.size, 10) || 8;
      el.brushSizesGroup.querySelectorAll(".size-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  initPalette();

  // =========================================================================
  // Canvas Rendering & 1-Stroke Drawing Engine
  // =========================================================================
  function clearCanvasLocally(bgColor = "#ffffff") {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, el.canvas.width, el.canvas.height);
  }

  function drawStrokeSegment(points, color, size) {
    if (!points || points.length === 0) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color || "#111827";
    ctx.lineWidth = size || 8;

    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0][0], points[0][1], (size || 8) / 2, 0, Math.PI * 2);
      ctx.fillStyle = color || "#111827";
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.stroke();
    ctx.restore();
  }

  function applyDrawAction(act) {
    if (!act) return;
    if (act.type === "clear") {
      clearCanvasLocally(act.color || "#ffffff");
    } else if (act.type === "stroke") {
      drawStrokeSegment(act.points, act.color, act.size);
    }
  }

  function getCanvasCoords(e) {
    const rect = el.canvas.getBoundingClientRect();
    const scaleX = el.canvas.width / rect.width;
    const scaleY = el.canvas.height / rect.height;
    return [
      Math.round((e.clientX - rect.left) * scaleX),
      Math.round((e.clientY - rect.top) * scaleY),
    ];
  }

  function canDrawNow() {
    return (
      state.turnState === "drawing" &&
      state.isDrawer &&
      !state.hasCommittedStrokeThisTurn
    );
  }

  el.canvas.addEventListener("pointerdown", e => {
    if (!canDrawNow()) return;
    e.preventDefault();
    el.canvas.setPointerCapture(e.pointerId);
    state.isDrawing = true;
    const pt = getCanvasCoords(e);
    state.currentStrokePoints = [pt];
    state.lastSentIndex = 0;
    drawStrokeSegment([pt], state.currentColor, state.currentSize);
  });

  el.canvas.addEventListener("pointermove", e => {
    if (!state.isDrawing) return;
    e.preventDefault();
    const pt = getCanvasCoords(e);
    const prev = state.currentStrokePoints[state.currentStrokePoints.length - 1];
    state.currentStrokePoints.push(pt);
    drawStrokeSegment([prev, pt], state.currentColor, state.currentSize);

    if (state.currentStrokePoints.length - state.lastSentIndex >= 6) {
      queueCurrentStrokeSegment(false);
    }
  });

  function finishUserStroke() {
    if (!state.isDrawing) return;
    state.isDrawing = false;
    state.hasCommittedStrokeThisTurn = true;
    queueCurrentStrokeSegment(true);
    flushDrawActions(true);
    playTone(523.25, 0.12, "triangle", 0.15);
  }

  el.canvas.addEventListener("pointerup", () => finishUserStroke());
  el.canvas.addEventListener("pointercancel", () => finishUserStroke());

  function queueCurrentStrokeSegment(isFinal) {
    const pts = state.currentStrokePoints.slice(Math.max(0, state.lastSentIndex - 1));
    state.lastSentIndex = state.currentStrokePoints.length;
    if (pts.length > 0) {
      state.unsentActions.push({
        type: "stroke",
        color: state.currentColor,
        size: state.currentSize,
        points: pts,
      });
    }
    if (isFinal) {
      state.currentStrokePoints = [];
      state.lastSentIndex = 0;
    }
  }

  async function flushDrawActions(finishStroke = false) {
    if (!state.roomCode || !state.playerId) return;
    if (state.unsentActions.length === 0 && !finishStroke) return;

    const batch = state.unsentActions.splice(0, state.unsentActions.length);
    try {
      const resp = await fetch("/api/imposter/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          action: batch.length > 0 ? "draw" : "finish_stroke",
          actions: batch,
          finishStroke: Boolean(finishStroke),
        }),
      });
      const data = await resp.json();
      if (data.ok && typeof data.lastActionId === "number") {
        state.lastActionId = Math.max(state.lastActionId, data.lastActionId);
      }
      if (finishStroke) {
        pollRoomState();
      }
    } catch (err) {
      console.warn("Flush draw error:", err);
    }
  }

  el.btnPassStroke.addEventListener("click", async () => {
    if (!state.isDrawer || state.turnState !== "drawing") return;
    state.hasCommittedStrokeThisTurn = true;
    await flushDrawActions(true);
  });

  // =========================================================================
  // Voting, Imposter Guessing & Chat Actions
  // =========================================================================
  async function submitVote(targetId) {
    if (state.turnState !== "voting") return;
    state.myVote = targetId;
    playTone(659.25, 0.1, "sine", 0.14);
    try {
      await fetch("/api/imposter/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          action: "vote",
          targetId: targetId,
        }),
      });
      pollRoomState();
    } catch (err) {
      console.warn("Vote error:", err);
    }
  }

  async function submitImposterWordGuess(guessText) {
    const clean = (guessText || "").trim();
    if (!clean) return;
    try {
      const resp = await fetch("/api/imposter/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          action: "imposter_guess",
          guess: clean,
        }),
      });
      const data = await resp.json();
      if (!data.ok && data.error) {
        alert(data.error);
      } else if (Array.isArray(data.chatMessages)) {
        renderChatMessages(data.chatMessages);
      }
      pollRoomState();
    } catch (err) {
      console.warn("Imposter guess error:", err);
    }
  }

  el.imposterGuessForm.addEventListener("submit", e => {
    e.preventDefault();
    const val = el.imposterGuessInput.value.trim();
    if (!val) return;
    el.imposterGuessInput.value = "";
    submitImposterWordGuess(val);
  });

  el.lcGuessForm.addEventListener("submit", e => {
    e.preventDefault();
    const val = el.lcGuessInput.value.trim();
    if (!val) return;
    el.lcGuessInput.value = "";
    submitImposterWordGuess(val);
  });

  el.chatForm.addEventListener("submit", async e => {
    e.preventDefault();
    const text = el.chatInput.value.trim();
    if (!text) return;
    el.chatInput.value = "";
    try {
      const resp = await fetch("/api/imposter/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          action: "chat",
          text: text,
        }),
      });
      const data = await resp.json();
      if (data.ok && Array.isArray(data.chatMessages)) {
        renderChatMessages(data.chatMessages);
      }
    } catch (err) {
      console.warn("Chat send error:", err);
    }
  });

  el.btnNextRound.addEventListener("click", async () => {
    try {
      await fetch("/api/imposter/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          hostToken: state.hostToken,
          action: "next_round",
        }),
      });
      pollRoomState();
    } catch (err) {
      console.warn(err);
    }
  });

  async function returnToLounge() {
    if (window.PartyBridge) {
      window.PartyBridge.leaveToLounge({
        roomCode: state.roomCode,
        playerId: state.playerId,
        hostToken: state.hostToken,
      });
      return;
    }
    try {
      await fetch("/api/party/to-lounge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          hostToken: state.hostToken,
        }),
      });
    } catch (e) {}
    window.location.replace(`/party/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`);
  }

  el.btnReturnLobby.addEventListener("click", returnToLounge);
  el.btnBack.addEventListener("click", e => {
    e.preventDefault();
    returnToLounge();
  });

  // =========================================================================
  // UI Rendering
  // =========================================================================
  function updateUI(roomData) {
    const gs = roomData.gameState || {};
    state.isHost = Boolean(roomData.isHost);
    state.players = roomData.players || [];

    // Detect new match -> reset canvas & chat state
    const matchNum = gs.match_number || 1;
    if (matchNum !== state.matchNumber) {
      state.matchNumber = matchNum;
      state.lastActionId = 0;
      state.hasCommittedStrokeThisTurn = false;
      state.hasAutoColoredForTurn = false;
      state.renderedMessageIds.clear();
      state.lastChatMessageId = 0;
      el.chatMessagesContainer.innerHTML = "";
      clearCanvasLocally("#ffffff");
      syncCanvasStrokes(true);
    }

    const prevDrawer = state.activeDrawerId;
    const prevRound = state.strokeRound;
    state.turnState = gs.turn_state || "drawing";
    state.strokeRound = gs.stroke_round || 1;
    state.activeDrawerId = gs.active_drawer_id;
    state.activeDrawerName = gs.active_drawer_name || "Spiller";
    state.isDrawer = Boolean(gs.is_drawer);
    state.isImposter = Boolean(gs.is_imposter);
    state.myWord = gs.my_word || "???";
    state.category = gs.category || "Kategori";
    state.timeRemaining = Math.ceil(gs.time_remaining || 0);
    state.imposterGuessesLeft = typeof gs.imposter_guesses_left === "number" ? gs.imposter_guesses_left : 2;
    state.myVote = gs.my_vote || null;
    state.voteCounts = gs.vote_counts || {};
    state.votedPlayerIds = gs.voted_player_ids || [];

    if (prevDrawer !== state.activeDrawerId || prevRound !== state.strokeRound) {
      state.hasCommittedStrokeThisTurn = Boolean(gs.has_drawn_in_turn);
      if (state.isDrawer && roomData.me && roomData.me.color) {
        setActiveColor(roomData.me.color);
      }
      if (state.isDrawer && state.turnState === "drawing") {
        playTone(659.25, 0.16, "triangle", 0.18);
      }
    }

    // Header Role & Word Banner
    el.roundIndicator.textContent = `Strekrunde ${state.strokeRound}`;
    el.timerText.textContent = String(state.timeRemaining);
    el.myCategoryLabel.textContent = `Kategori: ${state.category}`;

    if (state.isImposter) {
      el.roleWordBanner.classList.add("is-imposter");
      el.roleWordBanner.classList.remove("is-crew");
      el.myRoleBadge.className = "role-badge imposter";
      el.myRoleBadge.textContent = "IMPOSTER";
      el.mySecretWord.textContent = `Dekkord: ${state.myWord.toUpperCase()}`;
    } else {
      el.roleWordBanner.classList.add("is-crew");
      el.roleWordBanner.classList.remove("is-imposter");
      el.myRoleBadge.className = "role-badge crew";
      el.myRoleBadge.textContent = "CREW";
      el.mySecretWord.textContent = state.myWord.toUpperCase();
    }

    // Turn Status Strip & Toolbar
    if (state.turnState === "drawing") {
      if (state.isDrawer) {
        el.turnStatusStrip.classList.add("my-turn");
        el.turnStatusDot.style.background = "#fbbf24";
        el.turnStatusText.textContent = "DIN TUR! Tegn én sammenhengende strek på lerretet.";
        el.btnPassStroke.classList.remove("hidden");
        el.drawingToolbar.classList.remove("disabled");
      } else {
        el.turnStatusStrip.classList.remove("my-turn");
        el.turnStatusDot.style.background = "#38bdf8";
        el.turnStatusText.textContent = `${state.activeDrawerName} tegner sin ene strek…`;
        el.btnPassStroke.classList.add("hidden");
        el.drawingToolbar.classList.add("disabled");
      }
    } else if (state.turnState === "voting") {
      el.turnStatusStrip.classList.remove("my-turn");
      el.turnStatusDot.style.background = "#a855f7";
      el.turnStatusText.textContent = "AVSTEMNING! Hvem tegnet mistenkelig? Stem under lerretet!";
      el.btnPassStroke.classList.add("hidden");
      el.drawingToolbar.classList.add("disabled");
    } else if (state.turnState === "imposter_last_chance") {
      el.turnStatusStrip.classList.remove("my-turn");
      el.turnStatusDot.style.background = "#ef4444";
      el.turnStatusText.textContent = "Imposteren ble avslørt og har ett siste forsøk på å gjette Crew-ordet!";
      el.btnPassStroke.classList.add("hidden");
      el.drawingToolbar.classList.add("disabled");
    }

    // Imposter Secret Word Guess Box (Right Panel)
    if (state.isImposter && (state.turnState === "drawing" || state.turnState === "voting")) {
      el.imposterGuessBox.classList.remove("hidden");
      el.imposterAttemptsBadge.textContent = `${state.imposterGuessesLeft} forsøk igjen`;
      el.btnSubmitImposterGuess.disabled = state.imposterGuessesLeft <= 0;
      el.imposterGuessInput.disabled = state.imposterGuessesLeft <= 0;
    } else {
      el.imposterGuessBox.classList.add("hidden");
    }

    // Voting Panel
    if (state.turnState === "voting") {
      el.votingPanel.classList.remove("hidden");
      renderVotingCandidates();
    } else {
      el.votingPanel.classList.add("hidden");
    }

    // Last Chance Overlay
    if (state.turnState === "imposter_last_chance") {
      el.lastChanceOverlay.classList.remove("hidden");
      const impName = gs.imposter_name || "Imposteren";
      el.lcTitle.textContent = `${impName} ble avslørt som Imposter!`;
      if (state.isImposter) {
        el.lcSubtitle.textContent = "Du ble stemt ut! Men gjetter du Crew-ordet nå innen 20 sekunder, stjeler du seieren!";
        el.lcGuessForm.classList.remove("hidden");
      } else {
        el.lcSubtitle.textContent = `Venter i spenning… Klarer ${impName} å gjette Crew-ordet før tiden går ut?`;
        el.lcGuessForm.classList.add("hidden");
      }
    } else {
      el.lastChanceOverlay.classList.add("hidden");
    }

    // Round Over Modal
    if (state.turnState === "round_over") {
      el.modalRoundOver.classList.add("active");
      const crewWon = gs.winner_team === "crew";
      el.roWinnerBadge.className = `ro-winner-badge ${crewWon ? "crew-won" : "imposter-won"}`;
      el.roWinnerBadge.textContent = crewWon ? "CREW VANT RUNDEN!" : "IMPOSTEREN VANT RUNDEN!";
      el.roTitle.textContent = crewWon ? "Imposteren ble beseiret!" : "Imposteren lurte alle!";
      el.roReason.textContent = gs.win_reason || "";
      el.roCrewWord.textContent = (gs.crew_word || "").toUpperCase();
      el.roImposterWord.textContent = (gs.imposter_word || "").toUpperCase();
      const impName = gs.imposter_name || "Ukjent";
      const impAv = getAvatarSrc(gs.imposter_avatar);
      el.roImposterIdentity.innerHTML = `
        <img src="${impAv}" alt="" style="width: 38px; height: 38px; image-rendering: pixelated;" />
        <span>Imposteren var <strong style="color: #fca5a5;">${escapeHtml(impName)}</strong></span>
      `;
    } else {
      el.modalRoundOver.classList.remove("active");
    }

    renderPlayersLeaderboard(gs);
    if (Array.isArray(gs.chat_messages)) {
      renderChatMessages(gs.chat_messages);
    }
  }

  function renderPlayersLeaderboard(gs) {
    const turnOrder = gs.turn_order || state.players.map(p => p.id);
    const pMap = {};
    state.players.forEach(p => { pMap[p.id] = p; });

    el.playersCountBadge.textContent = String(state.players.length);
    el.playersList.innerHTML = "";

    turnOrder.forEach((pid, idx) => {
      const p = pMap[pid];
      if (!p) return;
      const isTurn = state.turnState === "drawing" && pid === state.activeDrawerId;
      const hasVoted = state.turnState === "voting" && state.votedPlayerIds.includes(pid);
      const row = document.createElement("div");
      row.className = `player-row ${isTurn ? "active-drawer" : ""}`;
      row.innerHTML = `
        <div class="player-rank">#${idx + 1}</div>
        <img src="${getAvatarSrc(p.avatar)}" class="player-avatar" alt="" />
        <div class="player-info">
          <div class="player-name" style="display:flex;align-items:center;gap:0.35rem;">
            <span class="player-color-swatch" style="background:${p.color || "#ffd166"};"></span>
            <span>${escapeHtml(p.name)}${pid === state.playerId ? " (Deg)" : ""}</span>
          </div>
          <div class="player-score">${p.score || 0} poeng</div>
        </div>
        <div class="player-status-icon">
          ${isTurn ? "Tegner" : hasVoted ? "Stemt" : ""}
        </div>
      `;
      el.playersList.appendChild(row);
    });
  }

  function renderVotingCandidates() {
    el.voteProgressBadge.textContent = `${state.votedPlayerIds.length} / ${state.players.length} har stemt`;
    el.voteCandidatesGrid.innerHTML = "";

    state.players.forEach(p => {
      const count = state.voteCounts[p.id] || 0;
      const isSelected = state.myVote === p.id;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `vote-candidate-btn ${isSelected ? "selected" : ""}`;
      btn.innerHTML = `
        <div class="vote-candidate-left">
          <span class="player-color-swatch" style="background:${p.color || "#ffd166"};"></span>
          <span class="vote-candidate-name">${escapeHtml(p.name)}</span>
        </div>
        <span class="vote-count-pill">${count}</span>
      `;
      btn.addEventListener("click", () => submitVote(p.id));
      el.voteCandidatesGrid.appendChild(btn);
    });

    // Skip / Draw another stroke round button
    const skipCount = state.voteCounts["skip"] || 0;
    const skipBtn = document.createElement("button");
    skipBtn.type = "button";
    skipBtn.className = `vote-candidate-btn skip-vote-btn ${state.myVote === "skip" ? "selected" : ""}`;
    skipBtn.innerHTML = `
      <div class="vote-candidate-left">
        <span>Ny runde med streker</span>
      </div>
      <span class="vote-count-pill">${skipCount}</span>
    `;
    skipBtn.addEventListener("click", () => submitVote("skip"));
    el.voteCandidatesGrid.appendChild(skipBtn);
  }

  function renderChatMessages(messages) {
    if (!Array.isArray(messages)) return;
    const latestId = messages.length > 0 ? (messages[messages.length - 1].id || 0) : 0;
    if (latestId === state.lastChatMessageId && messages.length > 0) return;
    state.lastChatMessageId = latestId;

    let added = false;
    messages.forEach(msg => {
      const mid = msg.id || `${msg.timestamp}_${msg.sender}`;
      if (state.renderedMessageIds.has(mid)) return;
      state.renderedMessageIds.add(mid);
      added = true;

      const div = document.createElement("div");
      if (msg.type === "system" || msg.type === "system_highlight" || msg.type === "winner") {
        div.className = `chat-msg system-msg ${msg.type === "winner" ? "correct-msg" : ""}`;
        div.textContent = msg.text;
      } else {
        div.className = "chat-msg";
        div.innerHTML = `<strong style="color:${escapeHtml(msg.senderColor || "#ffd166")};">${escapeHtml(msg.sender)}:</strong> ${escapeHtml(msg.text)}`;
      }
      el.chatMessagesContainer.appendChild(div);
    });

    if (added) {
      el.chatMessagesContainer.scrollTop = el.chatMessagesContainer.scrollHeight;
    }
  }

  // =========================================================================
  // Polling & Draw Synchronization
  // =========================================================================
  async function syncCanvasStrokes(fullRedraw = false) {
    if (!state.roomCode) return;
    const since = fullRedraw ? 0 : state.lastActionId;
    try {
      const resp = await fetch(`/api/imposter/draw-sync?code=${encodeURIComponent(state.roomCode)}&since=${since}`);
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.ok && Array.isArray(data.actions)) {
        if (fullRedraw) clearCanvasLocally("#ffffff");
        data.actions.forEach(act => {
          // Avoid double-drawing our own active stroke while pen is down
          if (state.isDrawing && act.drawerId === state.playerId && act.id > state.lastActionId) {
            state.lastActionId = Math.max(state.lastActionId, act.id || 0);
            return;
          }
          applyDrawAction(act);
          state.lastActionId = Math.max(state.lastActionId, act.id || 0);
        });
      }
    } catch (e) {}
  }

  async function pollRoomState() {
    if (!state.roomCode) return;
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
      updateUI(data);
    } catch (e) {}
  }

  function startLoops() {
    if (!state.roomCode || !state.playerId) {
      window.location.href = "/party/";
      return;
    }
    pollRoomState();
    syncCanvasStrokes(true);
    state.pollTimer = setInterval(pollRoomState, 700);
    state.drawSyncTimer = setInterval(() => syncCanvasStrokes(false), 350);
  }

  startLoops();
})();

