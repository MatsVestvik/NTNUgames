/**
 * Wavelength (Bølgelengde) - 2-Player Cooperative Psychic Dial Game
 * NTNU Games Client Application
 */

(() => {
  "use strict";

  // --- SOUND EFFECTS (Web Audio API Synthesizer) ---
  class SoundEffects {
    constructor() {
      this.ctx = null;
      this.enabled = localStorage.getItem("wavelength_sound") !== "false";
    }

    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume();
      }
    }

    toggle() {
      this.enabled = !this.enabled;
      localStorage.setItem("wavelength_sound", this.enabled ? "true" : "false");
      return this.enabled;
    }

    tick() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.035);
    }

    clueSend() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0.12, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.28);
      });
    }

    shutterOpen() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.35);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    }

    bullseye() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Majestic golden chord: C5 - E5 - G5 - C6
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(f, now + i * 0.06);
        gain.gain.setValueAtTime(0.2, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.75);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.8);
      });
    }

    scoreHit() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.2);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.32);
    }

    miss() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.3);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    }
  }

  const sfx = new SoundEffects();

  // --- CONFETTI PARTICLE SYSTEM ---
  class Confetti {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.particles = [];
      this.animId = null;
      this.resize();
      window.addEventListener("resize", () => this.resize());
    }

    resize() {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }

    fire() {
      this.particles = [];
      const colors = ["#ffd166", "#f72585", "#06d6a0", "#00b4d8", "#ffffff", "#fb8500"];
      for (let i = 0; i < 90; i++) {
        this.particles.push({
          x: this.canvas.width / 2 + (Math.random() - 0.5) * 120,
          y: this.canvas.height * 0.45,
          vx: (Math.random() - 0.5) * 14,
          vy: -Math.random() * 12 - 4,
          size: Math.random() * 7 + 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          rotSpeed: (Math.random() - 0.5) * 10,
          alpha: 1,
        });
      }
      if (!this.animId) this.loop();
    }

    loop() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // gravity
        p.vx *= 0.98;
        p.rotation += p.rotSpeed;
        p.alpha -= 0.012;

        if (p.alpha <= 0) {
          this.particles.splice(i, 1);
          continue;
        }

        this.ctx.save();
        this.ctx.globalAlpha = Math.max(0, p.alpha);
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate((p.rotation * Math.PI) / 180);
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        this.ctx.restore();
      }

      if (this.particles.length > 0) {
        this.animId = requestAnimationFrame(() => this.loop());
      } else {
        this.animId = null;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
  }

  // --- LOCAL CARDS FALLBACK DATA ---
  const LOCAL_CARDS = [
    { left: "Mild mat", right: "Sterk mat", category: "Mat & Drikke" },
    { left: "Kaldt", right: "Varmt", category: "Hverdag" },
    { left: "Billig", right: "Dyrt", category: "Hverdag" },
    { left: "Stille", right: "Bråkete", category: "Hverdag" },
    { left: "Sunt", right: "Usunt", category: "Mat & Drikke" },
    { left: "Søtt", right: "Surt", category: "Mat & Drikke" },
    { left: "Lett fag", right: "Vanskelig fag", category: "Studentliv" },
    { left: "Rolig kveld", right: "Vill fest", category: "Studentliv" },
    { left: "Myk", right: "Hard", category: "Hverdag" },
    { left: "God lukt", right: "Vond lukt", category: "Hverdag" },
    { left: "Dårlig film", right: "Bra film", category: "Underholdning" },
    { left: "Ubrukelig superkraft", right: "Beste superkraft", category: "Underholdning" },
    { left: "Kjedelig hobby", right: "Morsom hobby", category: "Underholdning" },
    { left: "Snill", right: "Slem", category: "Personlighet" },
    { left: "Umoden", right: "Voksen", category: "Personlighet" },
    { left: "Trygt dyr", right: "Farlig dyr", category: "Dyr & Natur" },
    { left: "Lite skummelt dyr", right: "Livsfarlig dyr", category: "Dyr & Natur" },
    { left: "Treg", right: "Rask", category: "Hverdag" },
    { left: "Stygt", right: "Pent", category: "Meninger" },
    { left: "Kjedelig samtale", right: "Spennende samtale", category: "Meninger" },
    { left: "Undervurdert", right: "Overvurdert", category: "Meninger" },
    { left: "Dårlig vane", right: "God vane", category: "Meninger" },
    { left: "Flaut øyeblikk", right: "Stolt øyeblikk", category: "Personlighet" },
    { left: "Avslappende", right: "Stressende", category: "Meninger" }
  ];

  function getLocalCard() {
    const c = LOCAL_CARDS[Math.floor(Math.random() * LOCAL_CARDS.length)];
    if (Math.random() < 0.5) {
      return { left: c.right, right: c.left, category: c.category };
    }
    return Object.assign({}, c);
  }

  // --- DOM ELEMENTS ---
  const el = {
    viewLobby: document.getElementById("viewLobby"),
    viewGame: document.getElementById("viewGame"),
    btnLeaveRoom: document.getElementById("btnLeaveRoom"),

    tabLobbyLocal: document.getElementById("tabLobbyLocal"),
    tabLobbyRoom: document.getElementById("tabLobbyRoom"),
    panelLobbyLocal: document.getElementById("panelLobbyLocal"),
    panelLobbyRoom: document.getElementById("panelLobbyRoom"),

    controlLocalRounds: document.getElementById("controlLocalRounds"),
    btnStartLocalMatch: document.getElementById("btnStartLocalMatch"),

    inputHostNameLobby: document.getElementById("inputHostNameLobby"),
    controlOnlineRounds: document.getElementById("controlOnlineRounds"),
    btnSubmitCreateLobby: document.getElementById("btnSubmitCreateLobby"),

    inputRoomCodeLobby: document.getElementById("inputRoomCodeLobby"),
    inputJoinNameLobby: document.getElementById("inputJoinNameLobby"),
    btnSubmitJoinLobby: document.getElementById("btnSubmitJoinLobby"),

    btnBack: document.getElementById("btnBack"),
    btnSoundToggle: document.getElementById("btnSoundToggle"),
    soundIcon: document.getElementById("soundIcon"),
    btnHelp: document.getElementById("btnHelp"),
    tabLocal: document.getElementById("tabLocal"),
    tabRoom: document.getElementById("tabRoom"),
    roomPill: document.getElementById("roomPill"),
    roomPillCode: document.getElementById("roomPillCode"),
    btnCopyRoomLink: document.getElementById("btnCopyRoomLink"),

    roundIndicator: document.getElementById("roundIndicator"),
    roundDotsTray: document.getElementById("roundDotsTray"),
    scoreIndicator: document.getElementById("scoreIndicator"),

    leftCardText: document.getElementById("leftCardText"),
    rightCardText: document.getElementById("rightCardText"),
    categoryBadge: document.getElementById("categoryBadge"),

    clueBanner: document.getElementById("clueBanner"),
    clueBannerLabel: document.getElementById("clueBannerLabel"),
    clueBannerText: document.getElementById("clueBannerText"),

    dialFrameWrap: document.getElementById("dialFrameWrap"),
    dialSvg: document.getElementById("dialSvg"),
    dialTickMarks: document.getElementById("dialTickMarks"),
    targetWedgeGroup: document.getElementById("targetWedgeGroup"),
    wedgeOuter: document.getElementById("wedgeOuter"),
    wedgeInner: document.getElementById("wedgeInner"),
    wedgeBullseye: document.getElementById("wedgeBullseye"),
    wedgeLabelsGroup: document.getElementById("wedgeLabelsGroup"),
    dialShutter: document.getElementById("dialShutter"),
    dialHitArea: document.getElementById("dialHitArea"),
    needleGroup: document.getElementById("needleGroup"),

    dialNudgeBar: document.getElementById("dialNudgeBar"),
    btnNudgeLeft: document.getElementById("btnNudgeLeft"),
    btnNudgeRight: document.getElementById("btnNudgeRight"),
    dialSlider: document.getElementById("dialSlider"),

    privacyGateCard: document.getElementById("privacyGateCard"),
    privacyGateTitle: document.getElementById("privacyGateTitle"),
    privacyGateDesc: document.getElementById("privacyGateDesc"),
    btnPrivacyReveal: document.getElementById("btnPrivacyReveal"),

    clueFormWrap: document.getElementById("clueFormWrap"),
    clueForm: document.getElementById("clueForm"),
    clueInput: document.getElementById("clueInput"),
    btnSubmitClue: document.getElementById("btnSubmitClue"),

    guesserActionWrap: document.getElementById("guesserActionWrap"),
    btnLockDial: document.getElementById("btnLockDial"),

    roomWaitingCard: document.getElementById("roomWaitingCard"),
    roomWaitingTitle: document.getElementById("roomWaitingTitle"),
    roomWaitingDesc: document.getElementById("roomWaitingDesc"),

    revealCard: document.getElementById("revealCard"),
    revealPointsBadge: document.getElementById("revealPointsBadge"),
    revealHeadline: document.getElementById("revealHeadline"),
    revealDiffText: document.getElementById("revealDiffText"),
    btnNextRound: document.getElementById("btnNextRound"),

    gameOverCard: document.getElementById("gameOverCard"),
    goBadgeIcon: document.getElementById("goBadgeIcon"),
    goScoreNumber: document.getElementById("goScoreNumber"),
    goSynergyTitle: document.getElementById("goSynergyTitle"),
    goSynergyDesc: document.getElementById("goSynergyDesc"),
    btnRestart: document.getElementById("btnRestart"),
    btnBackToLounge: document.getElementById("btnBackToLounge"),

    btnToggleHistory: document.getElementById("btnToggleHistory"),
    historyCard: document.getElementById("historyCard"),
    historyList: document.getElementById("historyList"),

    rulesModal: document.getElementById("rulesModal"),
    btnCloseRules: document.getElementById("btnCloseRules"),
    confettiCanvas: document.getElementById("confettiCanvas"),
  };

  const confetti = new Confetti(el.confettiCanvas);

  // --- GAME STATE ---
  const state = {
    mode: "local", // "local" (pass & play) or "room" (online party)
    roomCode: "",
    playerId: "",
    isHost: false,
    version: -1,
    isPolling: false,
    pollTimer: null,

    // Local match state
    selectedLocalRounds: 7,
    selectedOnlineRounds: 7,
    currentRound: 1,
    totalRounds: 7,
    teamScore: 0,
    psychicPlayerNum: 1, // 1 or 2
    localPhase: "privacy_gate", // "privacy_gate", "giving_clue", "guessing", "revealed", "game_over"

    card: getLocalCard(),
    targetVal: 0.5,
    dialVal: 0.5,
    clue: "",
    lastPoints: 0,
    lastFeedback: "",
    roundHistory: [],

    // Needle drag state
    isDraggingNeedle: false,
    lastTickVal: 0.5,
  };

  // --- SVG DIAL DRAWING & MATH ---
  const CX = 260;
  const CY = 240;
  const RADIUS = 200;

  function renderTickMarks() {
    el.dialTickMarks.innerHTML = "";
    // Subtle, clean reference notches: 45°, 90° (center neutral), 135°
    [45, 90, 135].forEach((deg) => {
      const rad = (deg * Math.PI) / 180;
      const isCenter = deg === 90;
      const len = isCenter ? 8 : 4;
      const x1 = CX + (RADIUS - len) * Math.cos(rad);
      const y1 = CY - (RADIUS - len) * Math.sin(rad);
      const x2 = CX + (RADIUS + len) * Math.cos(rad);
      const y2 = CY - (RADIUS + len) * Math.sin(rad);

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", x1.toFixed(1));
      line.setAttribute("y1", y1.toFixed(1));
      line.setAttribute("x2", x2.toFixed(1));
      line.setAttribute("y2", y2.toFixed(1));
      line.setAttribute("stroke-width", isCenter ? "2" : "1");
      line.setAttribute("stroke", isCenter ? "#64748b" : "#334155");
      el.dialTickMarks.appendChild(line);
    });
  }

  function polarToCartesian(deg) {
    const rad = (deg * Math.PI) / 180;
    return {
      x: CX + RADIUS * Math.cos(rad),
      y: CY - RADIUS * Math.sin(rad),
    };
  }

  function describeSector(valStart, valEnd, rIn = 177, rOut = 223) {
    const vS = Math.max(0, Math.min(1, valStart));
    const vE = Math.max(0, Math.min(1, valEnd));
    if (vS >= vE) return "";

    const degStart = (1 - vS) * 180;
    const degEnd = (1 - vE) * 180;
    const radS = (degStart * Math.PI) / 180;
    const radE = (degEnd * Math.PI) / 180;

    const ox1 = CX + rOut * Math.cos(radS);
    const oy1 = CY - rOut * Math.sin(radS);
    const ox2 = CX + rOut * Math.cos(radE);
    const oy2 = CY - rOut * Math.sin(radE);

    const ix1 = CX + rIn * Math.cos(radS);
    const iy1 = CY - rIn * Math.sin(radS);
    const ix2 = CX + rIn * Math.cos(radE);
    const iy2 = CY - rIn * Math.sin(radE);

    return `M ${ox1.toFixed(2)} ${oy1.toFixed(2)} A ${rOut} ${rOut} 0 0 1 ${ox2.toFixed(2)} ${oy2.toFixed(2)} L ${ix2.toFixed(2)} ${iy2.toFixed(2)} A ${rIn} ${rIn} 0 0 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)} Z`;
  }

  function hideTargetWedges() {
    if (el.targetWedgeGroup) {
      el.targetWedgeGroup.style.display = "none";
      el.targetWedgeGroup.classList.add("is-hidden");
      el.targetWedgeGroup.setAttribute("visibility", "hidden");
    }
    if (el.wedgeOuter) el.wedgeOuter.setAttribute("d", "");
    if (el.wedgeInner) el.wedgeInner.setAttribute("d", "");
    if (el.wedgeBullseye) el.wedgeBullseye.setAttribute("d", "");
    if (el.wedgeLabelsGroup) el.wedgeLabelsGroup.innerHTML = "";
  }

  function showTargetWedges(targetVal) {
    if (typeof targetVal !== "number" || isNaN(targetVal)) {
      hideTargetWedges();
      return;
    }

    if (el.targetWedgeGroup) {
      el.targetWedgeGroup.style.display = "";
      el.targetWedgeGroup.classList.remove("is-hidden");
      el.targetWedgeGroup.setAttribute("visibility", "visible");
    }

    // Outer 2pt zone: +/- 0.120
    const outerD = describeSector(targetVal - 0.120, targetVal + 0.120);
    // Inner 3pt zone: +/- 0.065
    const innerD = describeSector(targetVal - 0.065, targetVal + 0.065);
    // Bullseye 4pt zone: +/- 0.025
    const bullseyeD = describeSector(targetVal - 0.025, targetVal + 0.025);

    if (el.wedgeOuter) el.wedgeOuter.setAttribute("d", outerD);
    if (el.wedgeInner) el.wedgeInner.setAttribute("d", innerD);
    if (el.wedgeBullseye) el.wedgeBullseye.setAttribute("d", bullseyeD);

    // Wedge score numbers (2, 3, 4, 3, 2)
    if (el.wedgeLabelsGroup) {
      el.wedgeLabelsGroup.innerHTML = "";
      const labels = [
        { text: "2", val: targetVal - 0.0925 },
        { text: "3", val: targetVal - 0.0450 },
        { text: "4", val: targetVal },
        { text: "3", val: targetVal + 0.0450 },
        { text: "2", val: targetVal + 0.0925 },
      ];

      const rMid = 200;
      labels.forEach(({ text, val }) => {
        if (val < 0.01 || val > 0.99) return;
        const deg = (1 - val) * 180;
        const rad = (deg * Math.PI) / 180;
        const tx = CX + rMid * Math.cos(rad);
        const ty = CY - rMid * Math.sin(rad);

        const txtEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
        txtEl.setAttribute("x", tx.toFixed(2));
        txtEl.setAttribute("y", ty.toFixed(2));
        txtEl.setAttribute("text-anchor", "middle");
        txtEl.setAttribute("dominant-baseline", "central");
        txtEl.setAttribute("fill", "#0f172a");
        txtEl.setAttribute("font-size", text === "4" ? "14" : "11");
        txtEl.setAttribute("font-weight", "900");
        txtEl.setAttribute("font-family", "system-ui, -apple-system, sans-serif");
        txtEl.textContent = text;
        el.wedgeLabelsGroup.appendChild(txtEl);
      });
    }
  }

  function setNeedleVal(val, triggerSound = true) {
    const clamped = Math.max(0, Math.min(1, val));
    state.dialVal = clamped;

    // Angle rotation for needle: 0.5 is 0 deg (straight up), 0 is -90 deg, 1 is +90 deg
    const rotDeg = (clamped - 0.5) * 180;
    el.needleGroup.setAttribute("transform", `rotate(${rotDeg.toFixed(2)} ${CX} ${CY})`);

    // Sync fine-tune slider
    const sliderVal = Math.round(clamped * 1000);
    if (Math.abs(parseInt(el.dialSlider.value, 10) - sliderVal) > 2) {
      el.dialSlider.value = sliderVal;
    }

    // Tick sound if moved enough
    if (triggerSound && Math.abs(clamped - state.lastTickVal) > 0.035) {
      sfx.tick();
      state.lastTickVal = clamped;
    }
  }

  function setShutterOpen(isOpen) {
    if (isOpen) {
      el.dialShutter.classList.remove("shutter-closed");
      el.dialShutter.classList.add("shutter-open");
      el.dialShutter.style.display = "none";
    } else {
      el.dialShutter.classList.remove("shutter-open");
      el.dialShutter.classList.add("shutter-closed");
      el.dialShutter.style.display = "";
    }
  }

  // --- TOUCH & DRAG NEEDLE CONTROLS ---
  function getValFromPointerEvent(e) {
    const rect = el.dialFrameWrap.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    // SVG coordinates scaled to element bounding rect
    const scaleX = 520 / rect.width;
    const scaleY = 270 / rect.height;

    const svgX = (clientX - rect.left) * scaleX;
    const svgY = (clientY - rect.top) * scaleY;

    const dx = svgX - CX;
    const dy = svgY - CY;

    // Angle above center (-dy is positive upward)
    let deg = (Math.atan2(-dy, dx) * 180) / Math.PI;
    if (deg < 0) {
      deg = dx >= 0 ? 0 : 180;
    }

    // Deg 180 is 0.0, deg 0 is 1.0
    const val = 1.0 - deg / 180;
    return Math.max(0, Math.min(1, val));
  }

  function initDialPointerEvents() {
    function onPointerDown(e) {
      // Allow dragging only during guess phase (or in local when guessing)
      const canDrag =
        (state.mode === "local" && state.localPhase === "guessing") ||
        (state.mode === "room" && el.guesserActionWrap.classList.contains("hidden") === false);

      if (!canDrag) return;

      state.isDraggingNeedle = true;
      document.body.classList.add("is-dragging");
      const val = getValFromPointerEvent(e);
      setNeedleVal(val);
      syncDialToServer(val);
    }

    function onPointerMove(e) {
      if (!state.isDraggingNeedle) return;
      e.preventDefault();
      const val = getValFromPointerEvent(e);
      setNeedleVal(val);
      syncDialToServer(val);
    }

    function onPointerUp() {
      if (state.isDraggingNeedle) {
        state.isDraggingNeedle = false;
        document.body.classList.remove("is-dragging");
        syncDialToServer(state.dialVal, true);
      }
    }

    el.dialFrameWrap.addEventListener("mousedown", onPointerDown);
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);

    el.dialFrameWrap.addEventListener("touchstart", onPointerDown, { passive: false });
    window.addEventListener("touchmove", onPointerMove, { passive: false });
    window.addEventListener("touchend", onPointerUp);
    window.addEventListener("touchcancel", onPointerUp);

    // Slider input change
    el.dialSlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10) / 1000;
      setNeedleVal(val);
      syncDialToServer(val);
    });

    // Nudge buttons
    el.btnNudgeLeft.addEventListener("click", () => {
      const val = Math.max(0, state.dialVal - 0.02);
      setNeedleVal(val);
      syncDialToServer(val, true);
    });

    el.btnNudgeRight.addEventListener("click", () => {
      const val = Math.min(1, state.dialVal + 0.02);
      setNeedleVal(val);
      syncDialToServer(val, true);
    });
  }

  let dialSyncTimeout = null;
  function syncDialToServer(val, immediate = false) {
    if (state.mode !== "room" || !state.roomCode) return;
    if (dialSyncTimeout) clearTimeout(dialSyncTimeout);

    const send = async () => {
      try {
        await fetch("/api/wavelength/dial", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            playerId: state.playerId,
            dialVal: val,
          }),
        });
      } catch (err) {
        console.warn("Dial sync error:", err);
      }
    };

    if (immediate) {
      send();
    } else {
      dialSyncTimeout = setTimeout(send, 80);
    }
  }

  // --- LOCAL 1-DEVICE PASS & PLAY FLOW ---

  function startLocalMatch(customRounds) {
    state.mode = "local";
    state.currentRound = 1;
    state.totalRounds = customRounds || state.selectedLocalRounds || 7;
    state.teamScore = 0;
    state.psychicPlayerNum = 1;
    state.roundHistory = [];
    setupLocalRound();
  }

  function setupLocalRound() {
    state.card = getLocalCard();
    state.targetVal = roundNumber(0.12 + Math.random() * 0.76, 4);
    state.dialVal = 0.5;
    state.clue = "";
    state.localPhase = "privacy_gate";

    updateRoundRibbon();
    updateCardUI(state.card);
    setNeedleVal(0.5, false);
    hideTargetWedges(); // Target is completely cleared and hidden!
    setShutterOpen(false); // Closed initially

    // Hide clue banner & forms
    el.clueBanner.classList.add("hidden");
    el.clueFormWrap.classList.add("hidden");
    el.guesserActionWrap.classList.add("hidden");
    el.revealCard.classList.add("hidden");
    el.gameOverCard.classList.add("hidden");
    el.roomWaitingCard.classList.add("hidden");

    // Show privacy screen
    el.privacyGateCard.classList.remove("hidden");
    const otherPlayerNum = state.psychicPlayerNum === 1 ? 2 : 1;
    el.privacyGateTitle.textContent = `Spiller ${state.psychicPlayerNum} er Telepaten!`;
    el.privacyGateDesc.textContent = `Snu skjermen bort fra Spiller ${otherPlayerNum}. Bare Spiller ${state.psychicPlayerNum} skal se målskiven.`;
  }

  // Step 1: Telepath unmasks target and prepares to write clue
  el.btnPrivacyReveal.addEventListener("click", () => {
    sfx.shutterOpen();
    showTargetWedges(state.targetVal); // Draw and reveal target for Telepath
    setShutterOpen(true); // Open shutter so Telepath can see secret target
    el.privacyGateCard.classList.add("hidden");
    el.clueFormWrap.classList.remove("hidden");
    el.clueInput.value = "";
    el.clueInput.focus();
  });

  // Step 2: Telepath submits clue -> pass phone to Guesser
  el.clueForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = el.clueInput.value.trim();
    if (!val) return;

    if (state.mode === "local") {
      state.clue = val;
      state.localPhase = "guessing";
      sfx.clueSend();

      // Completely remove and hide target wedges before passing phone to Guesser!
      hideTargetWedges();
      setShutterOpen(false);

      el.clueFormWrap.classList.add("hidden");
      el.clueBanner.classList.remove("hidden");
      el.clueBannerLabel.textContent = `Ledetråd fra Spiller ${state.psychicPlayerNum}`;
      el.clueBannerText.textContent = `«${val}»`;

      const guesserNum = state.psychicPlayerNum === 1 ? 2 : 1;
      el.guesserActionWrap.classList.remove("hidden");
      el.btnLockDial.querySelector("span").textContent = `Spiller ${guesserNum}: Lås inn svar`;
    } else {
      sendRoomClue(val);
    }
  });

  // Step 3: Guesser locks in dial -> Reveal & Score
  el.btnLockDial.addEventListener("click", () => {
    if (state.mode === "local") {
      evaluateLocalReveal();
    } else {
      sendRoomLock();
    }
  });

  function evaluateLocalReveal() {
    state.localPhase = "revealed";
    sfx.shutterOpen();
    showTargetWedges(state.targetVal); // Draw and reveal target for both players!
    setShutterOpen(true); // Reveal target!

    const diff = Math.abs(state.dialVal - state.targetVal);
    let pts = 0;
    let headline = "";

    if (diff <= 0.025) {
      pts = 4;
      headline = "BULLSEYE! Perfekt!";
      sfx.bullseye();
      confetti.fire();
    } else if (diff <= 0.065) {
      pts = 3;
      headline = "3 POENG! Kjempenært!";
      sfx.scoreHit();
    } else if (diff <= 0.120) {
      pts = 2;
      headline = "2 POENG! Godkjent!";
      sfx.scoreHit();
    } else {
      pts = 0;
      headline = "0 POENG! Bom!";
      sfx.miss();
    }

    state.teamScore += pts;
    state.lastPoints = pts;
    state.lastFeedback = headline;

    const guesserNum = state.psychicPlayerNum === 1 ? 2 : 1;
    const historyEntry = {
      round: state.currentRound,
      card: state.card,
      clue: state.clue,
      targetVal: state.targetVal,
      dialVal: state.dialVal,
      diff: diff,
      points: pts,
      psychicName: `Spiller ${state.psychicPlayerNum}`,
      guesserName: `Spiller ${guesserNum}`,
    };
    state.roundHistory.push(historyEntry);

    updateRoundRibbon();
    renderHistory();

    // Show Reveal Card
    el.guesserActionWrap.classList.add("hidden");
    el.revealCard.className = `reveal-card pts-${pts}`;
    el.revealCard.classList.remove("hidden");
    el.revealPointsBadge.textContent = `+${pts} POENG`;
    el.revealHeadline.textContent = headline;
    const diffPct = (diff * 100).toFixed(1);
    el.revealDiffText.textContent = `Pekeren traff ${diffPct}% unna målets sentrum.`;
  }

  // Step 4: Advance to next round or Game Over
  el.btnNextRound.addEventListener("click", () => {
    if (state.mode === "local") {
      if (state.currentRound >= state.totalRounds) {
        showLocalGameOver();
      } else {
        state.currentRound++;
        // Swap psychic player (1 -> 2 -> 1)
        state.psychicPlayerNum = state.psychicPlayerNum === 1 ? 2 : 1;
        setupLocalRound();
      }
    } else {
      sendRoomNextRound();
    }
  });

  function showLocalGameOver() {
    state.localPhase = "game_over";
    el.revealCard.classList.add("hidden");
    el.clueBanner.classList.add("hidden");
    el.gameOverCard.classList.remove("hidden");

    el.goScoreNumber.textContent = `${state.teamScore} / ${state.totalRounds * 4}`;
    const pct = state.teamScore / (state.totalRounds * 4);
    let title = "";
    let desc = "";

    if (pct >= 0.88) {
      title = "Kosmisk telepati!";
      desc = "Dere deler én felles bevissthet! Skremmende samkjørte hjerner.";
      confetti.fire();
    } else if (pct >= 0.70) {
      title = "Telepatiske mestere!";
      desc = "Fantastisk intuisjon! Dere leser hverandre som en åpen bok.";
      confetti.fire();
    } else if (pct >= 0.50) {
      title = "Klar FM-frekvens!";
      desc = "Stort sett på samme bølgelengde! Et solid og samkjørt lag.";
    } else if (pct >= 0.28) {
      title = "Skurrende signaler!";
      desc = "Noe statisk støy på linja, men dere fant hverandre innimellom.";
    } else {
      title = "To forskjellige galakser!";
      desc = "Dere tenker fullstendig ulikt, men herregud så gøy det var å prøve!";
    }

    el.goBadgeIcon.textContent = "";
    el.goSynergyTitle.textContent = title;
    el.goSynergyDesc.textContent = desc;
  }

  el.btnRestart.addEventListener("click", () => {
    if (state.mode === "local") {
      startLocalMatch();
    } else {
      sendRoomRestart();
    }
  });

  // --- ONLINE PARTY ROOM MULTIPLAYER ---

  function showView(viewName) {
    if (!el.viewLobby || !el.viewGame) return;
    if (viewName === "lobby") {
      el.viewLobby.classList.remove("hidden");
      el.viewGame.classList.add("hidden");
      if (el.btnLeaveRoom) el.btnLeaveRoom.classList.add("hidden");
      stopPolling();
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

    if (el.controlLocalRounds) {
      el.controlLocalRounds.querySelectorAll(".seg-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          el.controlLocalRounds.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          state.selectedLocalRounds = parseInt(btn.dataset.rounds, 10) || 7;
        });
      });
    }

    if (el.controlOnlineRounds) {
      el.controlOnlineRounds.querySelectorAll(".seg-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          el.controlOnlineRounds.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          state.selectedOnlineRounds = parseInt(btn.dataset.rounds, 10) || 7;
        });
      });
    }

    if (el.btnStartLocalMatch) {
      el.btnStartLocalMatch.addEventListener("click", () => {
        setMode("local");
        startLocalMatch(state.selectedLocalRounds);
        showView("game");
      });
    }

    if (window.PartyConnect) {
      window.PartyConnect.init({
        gameId: "wavelength",
        createBtnId: "btnCreatePartyRoom",
        joinBtnId: "btnJoinPartyRoom",
        hostInputId: "inputPartyHostName",
        joinInputId: "inputPartyJoinName",
        codeInputId: "inputPartyRoomCode",
      });
    }

    if (el.btnSubmitCreateLobby) {
      el.btnSubmitCreateLobby.addEventListener("click", async () => {
        const hostName = (el.inputHostNameLobby ? el.inputHostNameLobby.value : "").trim() || "Spiller 1";
        const rounds = state.selectedOnlineRounds || 7;
        await createRoomOnline(hostName, rounds);
      });
    }

    if (el.btnSubmitJoinLobby) {
      el.btnSubmitJoinLobby.addEventListener("click", async () => {
        const code = (el.inputRoomCodeLobby ? el.inputRoomCodeLobby.value : "").trim().toUpperCase();
        const name = (el.inputJoinNameLobby ? el.inputJoinNameLobby.value : "").trim() || "Spiller 2";
        if (!code) {
          alert("Skriv inn en romkode.");
          return;
        }
        await joinRoomOnline(code, name);
      });
    }

    if (el.btnLeaveRoom) {
      el.btnLeaveRoom.addEventListener("click", () => {
        returnToLounge();
      });
    }
  }

  async function checkUrlParamsAndInit() {
    initLobbyTabs();

    const params = new URLSearchParams(window.location.search);
    const code = (params.get("room") || params.get("code") || "").trim().toUpperCase();
    const playerId = (params.get("player") || params.get("playerId") || "").trim();

    if (code) {
      // Direct room join / lounge launch!
      setMode("room");
      state.roomCode = code;
      state.playerId = playerId;
      el.roomPillCode.textContent = code;
      el.roomPill.classList.remove("hidden");
      showView("game");

      if (!state.playerId) {
        // Prompt name or auto-join as guest
        const guestName = sessionStorage.getItem("player_name") || "Gjest";
        await joinRoomOnline(code, guestName);
      } else {
        startPolling();
      }
    } else {
      showView("lobby");
    }
  }

  function setMode(mode) {
    state.mode = mode;
    if (mode === "local") {
      if (el.tabLocal) el.tabLocal.classList.add("active");
      if (el.tabRoom) el.tabRoom.classList.remove("active");
      el.roomPill.classList.add("hidden");
      stopPolling();
    } else {
      if (el.tabRoom) el.tabRoom.classList.add("active");
      if (el.tabLocal) el.tabLocal.classList.remove("active");
      el.roomPill.classList.remove("hidden");
    }
  }

  async function createRoomOnline(hostName, rounds) {
    const validHost = hostName || sessionStorage.getItem("player_name") || "Spiller 1";
    const validRounds = rounds || state.selectedOnlineRounds || 7;
    if (el.btnSubmitCreateLobby) {
      el.btnSubmitCreateLobby.disabled = true;
      el.btnSubmitCreateLobby.textContent = "Oppretter rom…";
    }

    try {
      const resp = await fetch("/api/wavelength/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostName: validHost, rounds: validRounds }),
      });
      const data = await resp.json();
      if (data.ok) {
        state.roomCode = data.roomCode;
        state.playerId = data.playerId;
        state.isHost = true;
        setMode("room");
        el.roomPillCode.textContent = state.roomCode;
        el.roomPill.classList.remove("hidden");
        // Update URL cleanly without reload
        window.history.replaceState({}, "", `/wavelength/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`);
        showView("game");
        startPolling();
      }
    } catch (e) {
      console.error("Room create error:", e);
      alert("Kunne ikke opprette rom.");
    } finally {
      if (el.btnSubmitCreateLobby) {
        el.btnSubmitCreateLobby.disabled = false;
        el.btnSubmitCreateLobby.textContent = "Opprett Wavelength-rom";
      }
    }
  }

  async function joinRoomOnline(code, name) {
    const validName = name || "Spiller 2";
    if (el.btnSubmitJoinLobby) {
      el.btnSubmitJoinLobby.disabled = true;
      el.btnSubmitJoinLobby.textContent = "Kobler til…";
    }

    try {
      const resp = await fetch("/api/wavelength/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode: code, playerName: validName }),
      });
      const data = await resp.json();
      if (data.ok) {
        state.playerId = data.playerId;
        state.isHost = data.isHost;
        state.roomCode = code;
        setMode("room");
        el.roomPillCode.textContent = code;
        el.roomPill.classList.remove("hidden");
        window.history.replaceState({}, "", `/wavelength/?room=${encodeURIComponent(code)}&player=${encodeURIComponent(state.playerId)}`);
        showView("game");
        startPolling();
      } else {
        alert(data.error || "Kunne ikke bli med i rommet.");
      }
    } catch (e) {
      console.error("Room join error:", e);
      alert("Nettverksfeil ved tilkobling til rom.");
    } finally {
      if (el.btnSubmitJoinLobby) {
        el.btnSubmitJoinLobby.disabled = false;
        el.btnSubmitJoinLobby.textContent = "Koble til rom";
      }
    }
  }

  function startPolling() {
    stopPolling();
    state.isPolling = true;

    async function poll() {
      if (!state.isPolling || !state.roomCode) return;
      try {
        const resp = await fetch(`/api/wavelength/state?code=${encodeURIComponent(state.roomCode)}&playerId=${encodeURIComponent(state.playerId)}&v=${state.version}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.ok) {
            applyRoomState(data);
          }
        }
      } catch (err) {
        console.warn("Poll hiccup:", err);
      }
      state.pollTimer = setTimeout(poll, 600);
    }

    poll();
  }

  function stopPolling() {
    state.isPolling = false;
    if (state.pollTimer) {
      clearTimeout(state.pollTimer);
      state.pollTimer = null;
    }
  }

  function applyRoomState(data) {
    state.version = data.version;
    state.currentRound = data.currentRound;
    state.totalRounds = data.totalRounds;
    state.teamScore = data.teamScore;
    state.card = data.card || state.card;
    state.clue = data.clue || "";
    state.roundHistory = data.roundHistory || [];

    updateRoundRibbon();
    updateCardUI(state.card);
    renderHistory();

    const isPsychic = Boolean(data.isPsychic);
    const isGuesser = Boolean(data.isGuesser);
    const status = data.status; // "waiting", "giving_clue", "guessing", "revealed", "game_over"

    // If needle isn't being actively dragged locally, sync to remote needle
    if (!state.isDraggingNeedle && typeof data.dialVal === "number") {
      setNeedleVal(data.dialVal, false);
    }

    // Target visibility
    const shouldShowTarget = Boolean(
      typeof data.targetVal === "number" &&
      (data.isRevealed || (status === "giving_clue" && isPsychic) || status === "game_over")
    );

    if (shouldShowTarget) {
      showTargetWedges(data.targetVal);
      setShutterOpen(true);
    } else {
      hideTargetWedges();
      setShutterOpen(false);
    }

    // Hide all action cards first
    el.privacyGateCard.classList.add("hidden");
    el.clueFormWrap.classList.add("hidden");
    el.guesserActionWrap.classList.add("hidden");
    el.roomWaitingCard.classList.add("hidden");
    el.revealCard.classList.add("hidden");
    el.gameOverCard.classList.add("hidden");

    // Clue banner
    if (data.clue) {
      el.clueBanner.classList.remove("hidden");
      el.clueBannerLabel.textContent = `Ledetråd fra ${data.psychicName}`;
      el.clueBannerText.textContent = `«${data.clue}»`;
    } else {
      el.clueBanner.classList.add("hidden");
    }

    if (status === "waiting") {
      el.roomWaitingCard.classList.remove("hidden");
      el.roomWaitingTitle.textContent = "Venter på medspiller…";
      el.roomWaitingDesc.textContent = `Del romkoden ${state.roomCode} med en venn for å starte partiet!`;
    } else if (status === "giving_clue") {
      if (isPsychic) {
        el.clueFormWrap.classList.remove("hidden");
      } else {
        el.roomWaitingCard.classList.remove("hidden");
        el.roomWaitingTitle.textContent = `${data.psychicName} tenker…`;
        el.roomWaitingDesc.textContent = "Telepaten ser det hemmelige målet og skriver en ledetråd.";
      }
    } else if (status === "guessing") {
      if (isGuesser) {
        el.guesserActionWrap.classList.remove("hidden");
        el.btnLockDial.querySelector("span").textContent = "Lås inn peker & Avslør!";
      } else {
        el.roomWaitingCard.classList.remove("hidden");
        el.roomWaitingTitle.textContent = `${data.guesserName} stiller inn hjulet…`;
        el.roomWaitingDesc.textContent = "Gjettespilleren vrir nålen til ledetråden din.";
      }
    } else if (status === "revealed") {
      el.revealCard.className = `reveal-card pts-${data.lastRoundPoints || 0}`;
      el.revealCard.classList.remove("hidden");
      el.revealPointsBadge.textContent = `+${data.lastRoundPoints || 0} POENG`;
      el.revealHeadline.textContent = data.lastRoundFeedback || "Avslørt!";
      const lastR = data.roundHistory && data.roundHistory[data.roundHistory.length - 1];
      if (lastR) {
        const pct = (lastR.diff * 100).toFixed(1);
        el.revealDiffText.textContent = `Pekeren traff ${pct}% unna målets sentrum.`;
      }
      if (data.lastRoundPoints === 4) confetti.fire();
    } else if (status === "game_over") {
      el.gameOverCard.classList.remove("hidden");
      el.goScoreNumber.textContent = `${data.teamScore} / ${data.maxPossibleScore}`;
      if (data.synergyRating) {
        el.goSynergyTitle.textContent = data.synergyRating.title;
        el.goSynergyDesc.textContent = data.synergyRating.desc;
      }
    }
  }

  async function sendRoomClue(clue) {
    try {
      const resp = await fetch("/api/wavelength/clue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          clue: clue,
        }),
      });
      const data = await resp.json();
      if (!data.ok) alert(data.error || "Feil ved innsending av ledetråd.");
      else sfx.clueSend();
    } catch (e) {
      console.error(e);
    }
  }

  async function sendRoomLock() {
    try {
      const resp = await fetch("/api/wavelength/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
        }),
      });
      const data = await resp.json();
      if (!data.ok) alert(data.error || "Kunne ikke låse inn.");
    } catch (e) {
      console.error(e);
    }
  }

  async function sendRoomNextRound() {
    try {
      const resp = await fetch("/api/wavelength/next-round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
        }),
      });
      const data = await resp.json();
      if (!data.ok) alert(data.error || "Kunne ikke starte neste runde.");
    } catch (e) {
      console.error(e);
    }
  }

  async function sendRoomRestart() {
    try {
      await fetch("/api/wavelength/restart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode: state.roomCode }),
      });
    } catch (e) {
      console.error(e);
    }
  }

  // --- UI HELPER FUNCTIONS ---

  function updateRoundRibbon() {
    el.roundIndicator.textContent = `${state.currentRound} / ${state.totalRounds}`;
    el.scoreIndicator.textContent = `${state.teamScore} poeng`;

    // Update round dots
    el.roundDotsTray.innerHTML = "";
    for (let r = 1; r <= state.totalRounds; r++) {
      const dot = document.createElement("span");
      dot.className = "round-dot";
      if (r === state.currentRound) dot.classList.add("current");
      if (r < state.currentRound) dot.classList.add("scored");
      el.roundDotsTray.appendChild(dot);
    }
  }

  function updateCardUI(card) {
    if (!card) return;
    el.leftCardText.textContent = card.left;
    el.rightCardText.textContent = card.right;
    el.categoryBadge.textContent = card.category || "Hverdag & Meninger";
  }

  function renderHistory() {
    if (!state.roundHistory || state.roundHistory.length === 0) {
      el.historyList.innerHTML = "<p style='color: var(--wl-text-muted); font-size: 0.85rem;'>Ingen runder spilt enda.</p>";
      return;
    }

    el.historyList.innerHTML = state.roundHistory
      .map(
        (h) => `
        <div class="history-item">
          <div>
            <strong>Runde ${h.round}:</strong> «${h.clue}»<br/>
            <span style="font-size: 0.78rem; color: var(--wl-text-muted);">
              ${h.card.left} ── ${h.card.right}
            </span>
          </div>
          <div style="font-weight: 900; color: ${h.points === 4 ? "var(--wl-gold)" : h.points > 0 ? "var(--wl-teal)" : "#94a3b8"};">
            +${h.points}p
          </div>
        </div>
      `
      )
      .join("");
  }

  function roundNumber(num, dec = 2) {
    const factor = Math.pow(10, dec);
    return Math.round(num * factor) / factor;
  }

  // --- HEADER & MODAL CONTROLS ---

  async function returnToLounge() {
    stopPolling();
    if (state.mode === "room" && state.roomCode) {
      const code = state.roomCode;
      const pid = state.playerId || sessionStorage.getItem("party_player_id") || "";
      const hostToken = state.hostToken || sessionStorage.getItem("party_host_token") || "";
      try {
        await fetch("/api/party/to-lounge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomCode: code, playerId: pid, hostToken: hostToken }),
        });
      } catch (e) {}
      window.location.href = `/party/?room=${encodeURIComponent(code)}&player=${encodeURIComponent(pid)}`;
      return;
    }
    showView("lobby");
  }

  el.btnBack.addEventListener("click", () => {
    if (state.mode === "room" && state.roomCode) {
      returnToLounge();
    } else if (document.referrer && document.referrer.includes("/party/")) {
      window.location.href = "/party/";
    } else {
      window.location.href = "/";
    }
  });

  el.btnBackToLounge.addEventListener("click", () => {
    returnToLounge();
  });

  el.btnSoundToggle.addEventListener("click", () => {
    const on = sfx.toggle();
    el.soundIcon.textContent = on ? "Lyd på" : "Lyd av";
  });

  el.btnHelp.addEventListener("click", () => {
    el.rulesModal.classList.remove("hidden");
  });

  el.btnCloseRules.addEventListener("click", () => {
    el.rulesModal.classList.add("hidden");
  });

  el.rulesModal.addEventListener("click", (e) => {
    if (e.target === el.rulesModal) el.rulesModal.classList.add("hidden");
  });

  el.btnToggleHistory.addEventListener("click", () => {
    el.historyCard.classList.toggle("hidden");
  });

  el.btnCopyRoomLink.addEventListener("click", async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      el.btnCopyRoomLink.textContent = "Kopiert!";
      setTimeout(() => (el.btnCopyRoomLink.textContent = "Kopier"), 1800);
    } catch (e) {
      prompt("Kopier lenken:", url);
    }
  });

  // --- INITIALIZATION ---
  renderTickMarks();
  initDialPointerEvents();
  el.soundIcon.textContent = sfx.enabled ? "Lyd på" : "Lyd av";
  checkUrlParamsAndInit();
})();

