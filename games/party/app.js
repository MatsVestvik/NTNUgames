/**
 * Party Lounge & Multi-Device Lobby Client
 */

(() => {
  "use strict";

  const MONS = [
    { id: "charbear", name: "Charbear", img: "/assets/mons/charbear.png" },
    { id: "jormundgandr", name: "Jørmungandr", img: "/assets/mons/jormundgandr.png" },
    { id: "pixiu", name: "Pixiu", img: "/assets/mons/pixiu.png" },
    { id: "squitonkey", name: "Squitonkey", img: "/assets/mons/squitonkey.png" },
    { id: "tanuki", name: "Tanuki", img: "/assets/mons/tanuki.png" },
    { id: "totter", name: "Totter", img: "/assets/mons/totter.png" },
  ];

  function getMonImg(avatar) {
    if (window.CharacterCreator && typeof window.CharacterCreator.getAvatarImgSrc === "function") {
      return window.CharacterCreator.getAvatarImgSrc(avatar);
    }
    if (!avatar) return "/assets/mons/charbear.png";
    if (avatar.startsWith("/") || avatar.startsWith("data:") || avatar.endsWith(".png")) return avatar;
    const found = MONS.find(m => m.id === avatar);
    return found ? found.img : `/assets/mons/${avatar}.png`;
  }

  function renderAvatarHtml(avatar, extraClass = "") {
    const src = getMonImg(avatar);
    return `<img src="${src}" alt="Partyfigur" class="player-mon-img ${extraClass}" />`;
  }

  const getInitialAvatar = () => {
    if (window.CharacterCreator && typeof window.CharacterCreator.getSavedConfigString === "function") {
      return window.CharacterCreator.getSavedConfigString();
    }
    return "char:h1:c_ffd166:r3:e1:m1";
  };

  // State
  const state = {
    roomCode: null,
    hostToken: null,
    playerId: null,
    playerName: null,
    avatar: getInitialAvatar(),
    isHost: false,
    version: 0,
    pollTimer: null,
    isPolling: false,
  };

  // Elements
  const el = {
    viewAuth: document.getElementById("viewAuth"),
    viewLobby: document.getElementById("viewLobby"),
    tabJoin: document.getElementById("tabJoin"),
    tabCreate: document.getElementById("tabCreate"),
    contentJoin: document.getElementById("contentJoin"),
    contentCreate: document.getElementById("contentCreate"),
    formJoin: document.getElementById("formJoin"),
    formCreate: document.getElementById("formCreate"),
    inputJoinCode: document.getElementById("inputJoinCode"),
    inputJoinName: document.getElementById("inputJoinName"),
    inputCreateName: document.getElementById("inputCreateName"),
    btnSubmitJoin: document.getElementById("btnSubmitJoin"),
    btnSubmitCreate: document.getElementById("btnSubmitCreate"),

    roomCodeDisplay: document.getElementById("roomCodeDisplay"),
    domainHostDisplay: document.getElementById("domainHostDisplay"),
    btnCopyLink: document.getElementById("btnCopyLink"),
    playersCountNum: document.getElementById("playersCountNum"),
    hostHint: document.getElementById("hostHint"),
    playersGrid: document.getElementById("playersGrid"),
    sectionGameSelector: document.getElementById("sectionGameSelector"),
    playerWaitingBox: document.getElementById("playerWaitingBox"),
    btnStartOrdbombe: document.getElementById("btnStartOrdbombe"),
    selectTimerParty: document.getElementById("selectTimerParty"),
    selectDiffParty: document.getElementById("selectDiffParty"),
    btnStartTegnOgGjett: document.getElementById("btnStartTegnOgGjett"),
    selectTimerDraw: document.getElementById("selectTimerDraw"),
    selectRoundsDraw: document.getElementById("selectRoundsDraw"),
    btnStartSjakk: document.getElementById("btnStartSjakk"),
    selectTimerSjakk: document.getElementById("selectTimerSjakk"),
    btnStartKorridorer: document.getElementById("btnStartKorridorer"),
    btnStartImposter: document.getElementById("btnStartImposter"),
    selectTimerImposter: document.getElementById("selectTimerImposter"),
    btnStartFargekoden: document.getElementById("btnStartFargekoden"),
    selectRoundsFargekoden: document.getElementById("selectRoundsFargekoden"),
    btnStartWavelength: document.getElementById("btnStartWavelength"),
    selectRoundsWavelength: document.getElementById("selectRoundsWavelength"),
    btnStartTurbosladd: document.getElementById("btnStartTurbosladd"),
    selectTrackTurbosladd: document.getElementById("selectTrackTurbosladd"),
    selectLapsTurbosladd: document.getElementById("selectLapsTurbosladd"),
    btnLeaveRoom: document.getElementById("btnLeaveRoom"),
    connStatusText: document.getElementById("connStatusText"),
  };

  let lobbyWidget = null;
  let isSyncingAvatar = false;
  let pendingAvatarSync = null;

  function showToast(msg) {
    let toast = document.getElementById("partyToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "partyToast";
      toast.className = "party-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3200);
  }

  // Tabs switching (Join / Create)
  el.tabJoin.addEventListener("click", () => {
    el.tabJoin.classList.add("active");
    el.tabCreate.classList.remove("active");
    el.contentJoin.classList.remove("hidden");
    el.contentCreate.classList.add("hidden");
  });

  el.tabCreate.addEventListener("click", () => {
    el.tabCreate.classList.add("active");
    el.tabJoin.classList.remove("active");
    el.contentCreate.classList.remove("hidden");
    el.contentJoin.classList.add("hidden");
  });

  // Display domain host in instructions
  if (el.domainHostDisplay) {
    el.domainHostDisplay.textContent = `${window.location.host}/party/`;
  }

  // Create Room Handler
  el.formCreate.addEventListener("submit", async (e) => {
    e.preventDefault();
    const hostName = el.inputCreateName.value.trim() || "Vert";
    el.btnSubmitCreate.disabled = true;
    el.btnSubmitCreate.textContent = "Oppretter rom…";

    try {
      const resp = await fetch("/api/party/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostName: hostName,
          avatar: state.avatar || getInitialAvatar(),
        }),
      });

      const data = await resp.json();
      if (!data.ok) {
        alert(data.error || "Kunne ikke opprette rom.");
        el.btnSubmitCreate.disabled = false;
        el.btnSubmitCreate.textContent = "Opprett rom";
        return;
      }

      state.roomCode = data.roomCode;
      state.hostToken = data.hostToken;
      state.playerId = data.playerId;
      state.playerName = hostName;
      if (data.avatar) state.avatar = data.avatar;
      state.isHost = true;

      saveSession();
      enterLobbyView();
    } catch (err) {
      console.error(err);
      alert("Nettverksfeil ved oppretting av rom.");
    } finally {
      el.btnSubmitCreate.disabled = false;
      el.btnSubmitCreate.textContent = "Opprett rom 🎉";
    }
  });

  // Join Room Handler
  el.formJoin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = el.inputJoinCode.value.trim().toUpperCase();
    const playerName = el.inputJoinName.value.trim() || "Spiller";

    if (!code) {
      alert("Vennligst skriv inn en romkode.");
      return;
    }

    el.btnSubmitJoin.disabled = true;
    el.btnSubmitJoin.textContent = "Kobler til…";

    try {
      const resp = await fetch("/api/party/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: code,
          playerName: playerName,
          avatar: state.avatar || getInitialAvatar(),
        }),
      });

      const data = await resp.json();
      if (!data.ok) {
        alert(data.error || "Fant ikke rommet.");
        el.btnSubmitJoin.disabled = false;
        el.btnSubmitJoin.textContent = "Bli med i festen";
        return;
      }

      state.roomCode = data.roomCode;
      state.hostToken = null;
      state.playerId = data.playerId;
      state.playerName = data.playerName;
      state.avatar = data.avatar || state.avatar;
      state.isHost = false;

      saveSession();
      enterLobbyView();
    } catch (err) {
      console.error(err);
      alert("Nettverksfeil ved tilkobling til rom.");
    } finally {
      el.btnSubmitJoin.disabled = false;
      el.btnSubmitJoin.textContent = "Bli med i festen";
    }
  });

  function saveSession() {
    sessionStorage.setItem("party_room_code", state.roomCode || "");
    sessionStorage.setItem("party_player_id", state.playerId || "");
    sessionStorage.setItem("party_player_name", state.playerName || "");
    sessionStorage.setItem("party_avatar", state.avatar || "");
    if (state.hostToken) {
      sessionStorage.setItem("party_host_token", state.hostToken);
    } else {
      sessionStorage.removeItem("party_host_token");
    }
  }

  function loadSession() {
    const code = sessionStorage.getItem("party_room_code");
    const pId = sessionStorage.getItem("party_player_id");
    const pName = sessionStorage.getItem("party_player_name");
    const av = sessionStorage.getItem("party_avatar");
    const hToken = sessionStorage.getItem("party_host_token");

    if (code && pId) {
      state.roomCode = code;
      state.playerId = pId;
      state.playerName = pName || "Spiller";
      state.avatar = av || getInitialAvatar();
      state.hostToken = hToken || null;
      state.isHost = !!hToken;
      return true;
    }
    return false;
  }

  function enterLobbyView() {
    el.viewAuth.classList.add("hidden");
    el.viewLobby.classList.remove("hidden");

    el.roomCodeDisplay.textContent = state.roomCode;
    el.hostHint.textContent = state.isHost ? "Du er vert 👑" : `Tilkoblet som ${state.playerName}`;

    renderHostVsGuestUI(state.isHost);

    // Update URL without reloading
    const newUrl = `${window.location.pathname}?code=${state.roomCode}`;
    history.replaceState(null, "", newUrl);

    initLobbyCustomizer();
    startPolling();
  }

  function initLobbyCustomizer() {
    const lobbyContainer = document.getElementById("skribblCustomizerLobby");
    if (!window.CharacterCreator || !lobbyContainer) return;
    if (lobbyWidget) return;

    lobbyWidget = window.CharacterCreator.renderSkribblWidget(lobbyContainer, {
      initialConfig: state.avatar,
      showRandomize: true,
      autoSave: true,
      onChange: (encoded, dataUrl, cfg) => {
        state.avatar = encoded;
        saveSession();
        scheduleAvatarSync(encoded);
      },
    });
  }

  function scheduleAvatarSync(avatar) {
    pendingAvatarSync = avatar;
    if (isSyncingAvatar) return;
    doAvatarSync();
  }

  async function doAvatarSync() {
    if (!pendingAvatarSync || !state.roomCode || !state.playerId) return;
    const avToSend = pendingAvatarSync;
    pendingAvatarSync = null;
    isSyncingAvatar = true;

    try {
      const resp = await fetch("/api/party/update-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          avatar: avToSend,
        }),
      });

      const data = await resp.json();
      if (!data.ok) {
        if (data.error) {
          showToast(data.error);
        }
      } else {
        if (data.avatar) {
          state.avatar = data.avatar;
          saveSession();
        }
      }
    } catch (err) {
      console.warn("Avatar sync error:", err);
    } finally {
      isSyncingAvatar = false;
      if (pendingAvatarSync) {
        doAvatarSync();
      }
    }
  }

  // Polling loop to sync room state in real-time
  function startPolling() {
    if (state.isPolling) return;
    state.isPolling = true;

    async function poll() {
      if (!state.roomCode || !state.playerId) return;

      try {
        const url = `/api/party/state?code=${encodeURIComponent(state.roomCode)}&playerId=${encodeURIComponent(state.playerId)}&v=${state.version}`;
        const resp = await fetch(url);

        if (resp.status === 404) {
          // Room expired or deleted
          alert("Party-rommet er ikke lenger tilgjengelig.");
          leaveRoom();
          return;
        }

        const data = await resp.json();
        if (data.ok) {
          if (data.kicked || !data.me) {
            stopPolling();
            if (lobbyWidget) {
              lobbyWidget.destroy();
              lobbyWidget = null;
            }
            sessionStorage.clear();
            state.roomCode = null;
            state.hostToken = null;
            state.playerId = null;
            state.isHost = false;
            el.viewLobby.classList.add("hidden");
            el.viewAuth.classList.remove("hidden");
            history.replaceState(null, "", window.location.pathname);
            showToast("Du ble fjernet fra party-rommet av verten.");
            return;
          }

          state.version = data.version;
          state.isHost = data.isHost;

          updateLobbyUI(data);

          // Check if active game was launched!
          if (data.currentGame === "ordbombe") {
            // Redirect to Ordbombe in room mode!
            const target = `/ordbombe/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`;
            window.location.href = target;
            return;
          }

          if (data.currentGame === "tegn_og_gjett" && data.gameState?.turn_state !== "game_over" && data.gameState?.status !== "game_over") {
            // Redirect to Tegn & Gjett in room mode!
            const target = `/tegn-og-gjett/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`;
            window.location.href = target;
            return;
          }

          if (data.currentGame === "sjakk" && data.gameState?.status !== "finished") {
            // Redirect to Sjakk in room mode!
            const target = `/sjakk/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`;
            window.location.href = target;
            return;
          }

          if (data.currentGame === "korridorer") {
            // Redirect to Korridorer in room mode!
            const target = `/korridorer/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`;
            window.location.href = target;
            return;
          }

          if (data.currentGame === "imposter" && data.gameState?.status !== "round_over") {
            // Redirect to Imposter in room mode!
            const target = `/imposter/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`;
            window.location.href = target;
            return;
          }

          if (data.currentGame === "fargekoden" && data.gameState?.status !== "game_over") {
            // Redirect to Fargekoden in room mode!
            const target = `/fargekoden/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`;
            window.location.href = target;
            return;
          }

          if (data.currentGame === "wavelength" && data.gameState?.status !== "game_over") {
            // Redirect to Wavelength in room mode!
            const target = `/wavelength/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`;
            window.location.href = target;
            return;
          }

          if (data.currentGame === "turbosladd") {
            // Redirect to Turbosladd in room mode!
            const target = `/turbosladd/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`;
            window.location.href = target;
            return;
          }
        }
      } catch (err) {
        console.warn("Poll connection hiccup:", err);
        el.connStatusText.textContent = "Kobler til på nytt…";
      }

      state.pollTimer = setTimeout(poll, 800);
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

  function updateLobbyUI(room) {
    el.connStatusText.textContent = "Live";
    el.playersCountNum.textContent = String(room.playerCount || 1);

    const me = (room.players || []).find((p) => p.id === state.playerId);

    // Calculate colors taken by other players in the room (only 1 player per color)
    const takenColors = {};
    (room.players || []).forEach((p) => {
      if (p.id !== state.playerId && p.color) {
        takenColors[p.color.toLowerCase()] = p.name;
      }
    });

    if (lobbyWidget && typeof lobbyWidget.setDisabledColors === "function") {
      lobbyWidget.setDisabledColors(takenColors);
    }

    // If server resolved/updated our avatar upon room entry
    if (me && me.avatar && me.avatar !== state.avatar) {
      state.avatar = me.avatar;
      saveSession();
      if (lobbyWidget && typeof lobbyWidget.setConfig === "function") {
        lobbyWidget.setConfig(me.avatar, true);
      }
    }

    // If host status changed, update before rendering tiles so kick buttons match
    if (typeof room.isHost === "boolean" && room.isHost !== state.isHost) {
      state.isHost = room.isHost;
      renderHostVsGuestUI(state.isHost);
      el.hostHint.textContent = state.isHost ? "Du er vert 👑" : `Tilkoblet som ${state.playerName}`;
    }

    // Render players grid
    el.playersGrid.innerHTML = "";
    (room.players || []).forEach((p) => {
      const isMe = p.id === state.playerId;
      const canKick = state.isHost && !isMe && !p.isHost;
      const tile = document.createElement("div");
      tile.className = `player-tile ${p.isHost ? "is-host" : ""} ${isMe ? "is-me" : ""}`;
      tile.innerHTML = `
        ${p.isHost ? '<span class="player-crown-badge">VERT</span>' : ''}
        ${isMe ? '<span class="player-me-badge">DEG</span>' : ''}
        ${canKick ? `<button type="button" class="player-kick-btn" title="Fjern ${escapeHtml(p.name)} fra rommet" aria-label="Fjern ${escapeHtml(p.name)}">✕</button>` : ''}
        <div class="player-avatar-circle" style="border-color: ${p.color || '#3b5080'}">${renderAvatarHtml(p.avatar)}</div>
        <div class="player-name-text">${escapeHtml(p.name)}</div>
      `;
      if (canKick) {
        const kickBtn = tile.querySelector(".player-kick-btn");
        if (kickBtn) {
          kickBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (confirm(`Vil du fjerne ${p.name} fra party-rommet?`)) {
              kickPlayer(p.id, p.name);
            }
          });
        }
      }
      el.playersGrid.appendChild(tile);
    });

    // Update games list based on current player count & move disabled games to the bottom
    state.lastPlayerCount = room.playerCount || (room.players ? room.players.length : 1);
    try {
      sessionStorage.setItem("party_player_count", String(state.lastPlayerCount));
    } catch (e) {
      // Ignore
    }
    updatePartyGamesListByPlayerCount(state.lastPlayerCount, state.isHost);
  }

  function updatePartyGamesListByPlayerCount(playerCount, isHost) {
    const container = document.getElementById("lobbyGamesList");
    if (!container) return;

    const cards = Array.from(container.querySelectorAll(".lobby-game-card"));
    const enabledCards = [];
    const disabledCards = [];

    cards.forEach((card) => {
      const minPlayers = parseInt(card.dataset.minPlayers || "2", 10);
      const startBtn = card.querySelector(".start-game-btn");
      const badge = card.querySelector(".lg-card-badge");
      const selects = card.querySelectorAll("select");

      if (badge && !badge.dataset.origText) {
        badge.dataset.origText = badge.textContent.trim();
      }
      if (startBtn && !startBtn.dataset.hostText) {
        startBtn.dataset.hostText = startBtn.textContent.trim();
      }

      const hasEnough = playerCount >= minPlayers;

      if (!hasEnough) {
        card.classList.add("disabled-playable");
        card.classList.remove("active-playable");
        card.style.order = "99";

        if (startBtn) {
          startBtn.disabled = true;
          startBtn.classList.add("disabled-btn");
          startBtn.textContent = `Trenger minst ${minPlayers} spillere`;
        }
        if (badge) {
          badge.className = "lg-card-badge badge-needed";
          badge.textContent = `Trenger ${minPlayers} spillere`;
        }
        selects.forEach((s) => (s.disabled = true));
        disabledCards.push(card);
      } else {
        card.classList.remove("disabled-playable");
        card.classList.add("active-playable");
        card.style.order = "1";

        if (startBtn) {
          startBtn.classList.remove("disabled-btn");
          if (isHost) {
            startBtn.disabled = false;
            startBtn.textContent = startBtn.dataset.hostText || "Start spill";
          } else {
            startBtn.disabled = true;
            startBtn.textContent = "Venter på vert 👑";
          }
        }
        if (badge) {
          badge.className = "lg-card-badge badge-ready";
          badge.textContent = badge.dataset.origText || "Klar til spill";
        }
        selects.forEach((s) => (s.disabled = !isHost));
        enabledCards.push(card);
      }
    });

    // Move disabled games to bottom of the list in DOM
    [...enabledCards, ...disabledCards].forEach((card) => container.appendChild(card));
  }

  async function kickPlayer(targetPlayerId, targetPlayerName) {
    if (!state.isHost || !state.roomCode || !targetPlayerId) return;
    try {
      const resp = await fetch("/api/party/kick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          hostToken: state.hostToken,
          playerId: state.playerId,
          targetPlayerId: targetPlayerId,
        }),
      });
      const data = await resp.json();
      if (data.ok) {
        if (data.state) {
          state.version = data.state.version;
          updateLobbyUI(data.state);
        }
        showToast(`${targetPlayerName || data.kickedName || "Spiller"} ble fjernet fra rommet.`);
      } else if (data.error) {
        showToast(data.error);
      }
    } catch (err) {
      console.warn("Kick player error:", err);
      showToast("Kunne ikke fjerne spilleren.");
    }
  }

  function renderHostVsGuestUI(isHost) {
    el.sectionGameSelector.classList.remove("hidden");
    const sectionHint = document.querySelector("#sectionGameSelector .section-hint");

    if (isHost) {
      el.sectionGameSelector.classList.remove("is-guest-view");
      el.playerWaitingBox.classList.add("hidden");
      if (sectionHint) sectionHint.textContent = "Verten velger spill for hele rommet";
    } else {
      el.sectionGameSelector.classList.add("is-guest-view");
      el.playerWaitingBox.classList.remove("hidden");
      if (sectionHint) sectionHint.textContent = "Tilgjengelige partyspill (Verten velger spill):";
    }

    updatePartyGamesListByPlayerCount(state.lastPlayerCount || 1, isHost);
  }

  // Host launches Ordbombe
  el.btnStartOrdbombe.addEventListener("click", async () => {
    if (!state.isHost || !state.hostToken) return;

    el.btnStartOrdbombe.disabled = true;
    el.btnStartOrdbombe.textContent = "Starter spill…";

    const turnDuration = parseFloat(el.selectTimerParty.value) || 6.0;
    const difficulty = el.selectDiffParty.value || "medium";

    try {
      const resp = await fetch("/api/party/select-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          hostToken: state.hostToken,
          gameId: "ordbombe",
          settings: {
            turnDuration: turnDuration,
            difficulty: difficulty,
          },
        }),
      });

      const data = await resp.json();
      if (!data.ok) {
        alert(data.error || "Kunne ikke starte spillet.");
        el.btnStartOrdbombe.disabled = false;
        el.btnStartOrdbombe.textContent = "Start Ordbombe";
        return;
      }

      // Transition self immediately
      window.location.href = `/ordbombe/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`;
    } catch (err) {
      console.error(err);
      alert("Feil ved start av spill.");
      el.btnStartOrdbombe.disabled = false;
      el.btnStartOrdbombe.textContent = "Start Ordbombe";
    }
  });

  // Host launches Tegn & Gjett
  if (el.btnStartTegnOgGjett) {
    el.btnStartTegnOgGjett.addEventListener("click", async () => {
      if (!state.isHost || !state.hostToken) return;

      el.btnStartTegnOgGjett.disabled = true;
      el.btnStartTegnOgGjett.textContent = "Starter spill…";

      const drawTime = parseInt(el.selectTimerDraw?.value || "80", 10);
      const rounds = parseInt(el.selectRoundsDraw?.value || "3", 10);

      try {
        const resp = await fetch("/api/party/select-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            hostToken: state.hostToken,
            gameId: "tegn_og_gjett",
            settings: {
              drawTime: drawTime,
              rounds: rounds,
            },
          }),
        });

        const data = await resp.json();
        if (!data.ok) {
          alert(data.error || "Kunne ikke starte Tegn & Gjett.");
          el.btnStartTegnOgGjett.disabled = false;
          el.btnStartTegnOgGjett.textContent = "Start Tegn & Gjett";
          return;
        }

        // Transition self immediately
        window.location.href = `/tegn-og-gjett/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`;
      } catch (err) {
        console.error(err);
        alert("Feil ved start av spill.");
        el.btnStartTegnOgGjett.disabled = false;
        el.btnStartTegnOgGjett.textContent = "Start Tegn & Gjett";
      }
    });
  }

  // Host launches Sjakk
  if (el.btnStartSjakk) {
    el.btnStartSjakk.addEventListener("click", async () => {
      if (!state.isHost || !state.hostToken) return;

      el.btnStartSjakk.disabled = true;
      el.btnStartSjakk.textContent = "Starter spill…";

      const timeControl = parseInt(el.selectTimerSjakk?.value || "300", 10);

      try {
        const resp = await fetch("/api/party/select-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            hostToken: state.hostToken,
            gameId: "sjakk",
            settings: {
              timeControl: timeControl,
            },
          }),
        });

        const data = await resp.json();
        if (!data.ok) {
          alert(data.error || "Kunne ikke starte Sjakk.");
          el.btnStartSjakk.disabled = false;
          el.btnStartSjakk.textContent = "Start Sjakk";
          return;
        }

        // Transition self immediately
        window.location.href = `/sjakk/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`;
      } catch (err) {
        console.error(err);
        alert("Feil ved start av spill.");
        el.btnStartSjakk.disabled = false;
        el.btnStartSjakk.textContent = "Start Sjakk";
      }
    });
  }

  // Host launches Korridorer
  if (el.btnStartKorridorer) {
    el.btnStartKorridorer.addEventListener("click", async () => {
      if (!state.isHost || !state.roomCode) return;
      try {
        el.btnStartKorridorer.disabled = true;
        el.btnStartKorridorer.textContent = "Starter spill…";

        const resp = await fetch("/api/party/select-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            hostToken: state.hostToken,
            gameId: "korridorer",
            settings: {},
          }),
        });

        const data = await resp.json();
        if (!data.ok) {
          alert(data.error || "Kunne ikke starte Korridorer.");
          el.btnStartKorridorer.disabled = false;
          el.btnStartKorridorer.textContent = "Start Korridorer";
          return;
        }

        // Transition self immediately
        window.location.href = `/korridorer/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`;
      } catch (err) {
        console.error(err);
        alert("Feil ved start av spill.");
        el.btnStartKorridorer.disabled = false;
        el.btnStartKorridorer.textContent = "Start Korridorer";
      }
    });
  }

  // Host launches Imposter
  if (el.btnStartImposter) {
    el.btnStartImposter.addEventListener("click", async () => {
      if (!state.isHost || !state.roomCode) return;
      const strokeTime = parseInt(el.selectTimerImposter?.value || "25", 10) || 25;
      try {
        el.btnStartImposter.disabled = true;
        el.btnStartImposter.textContent = "Starter spill…";

        const resp = await fetch("/api/party/select-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            hostToken: state.hostToken,
            gameId: "imposter",
            settings: { strokeTime },
          }),
        });

        const data = await resp.json();
        if (!data.ok) {
          alert(data.error || "Kunne ikke starte Imposter.");
          el.btnStartImposter.disabled = false;
          el.btnStartImposter.textContent = "Start Imposter";
          return;
        }

        window.location.href = `/imposter/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`;
      } catch (err) {
        console.error(err);
        alert("Feil ved start av spill.");
        el.btnStartImposter.disabled = false;
        el.btnStartImposter.textContent = "Start Imposter";
      }
    });
  }

  // Host launches Fargekoden
  if (el.btnStartFargekoden) {
    el.btnStartFargekoden.addEventListener("click", async () => {
      if (!state.isHost || !state.roomCode) return;
      const rounds = parseInt(el.selectRoundsFargekoden?.value || "3", 10) || 3;
      try {
        el.btnStartFargekoden.disabled = true;
        el.btnStartFargekoden.textContent = "Starter spill…";

        const resp = await fetch("/api/party/select-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            hostToken: state.hostToken,
            gameId: "fargekoden",
            settings: { rounds },
          }),
        });

        const data = await resp.json();
        if (!data.ok) {
          alert(data.error || "Kunne ikke starte Fargekoden.");
          el.btnStartFargekoden.disabled = false;
          el.btnStartFargekoden.textContent = "Start Fargekoden";
          return;
        }

        window.location.href = `/fargekoden/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`;
      } catch (err) {
        console.error(err);
        alert("Feil ved start av spill.");
        el.btnStartFargekoden.disabled = false;
        el.btnStartFargekoden.textContent = "Start Fargekoden";
      }
    });
  }

  // Host launches Wavelength
  if (el.btnStartWavelength) {
    el.btnStartWavelength.addEventListener("click", async () => {
      if (!state.isHost || !state.roomCode) return;
      const rounds = parseInt(el.selectRoundsWavelength?.value || "7", 10) || 7;
      try {
        el.btnStartWavelength.disabled = true;
        el.btnStartWavelength.textContent = "Starter spill…";

        const resp = await fetch("/api/party/select-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            hostToken: state.hostToken,
            gameId: "wavelength",
            settings: { rounds },
          }),
        });

        const data = await resp.json();
        if (!data.ok) {
          alert(data.error || "Kunne ikke starte Wavelength.");
          el.btnStartWavelength.disabled = false;
          el.btnStartWavelength.textContent = "Start Wavelength";
          return;
        }

        window.location.href = `/wavelength/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`;
      } catch (err) {
        console.error(err);
        alert("Feil ved start av spill.");
        el.btnStartWavelength.disabled = false;
        el.btnStartWavelength.textContent = "Start Wavelength";
      }
    });
  }

  // Host launches Turbosladd
  if (el.btnStartTurbosladd) {
    el.btnStartTurbosladd.addEventListener("click", async () => {
      if (!state.isHost || !state.roomCode) return;
      const laps = parseInt(el.selectLapsTurbosladd?.value || "3", 10) || 3;
      const trackId = el.selectTrackTurbosladd?.value || "grand_prix";
      try {
        el.btnStartTurbosladd.disabled = true;
        el.btnStartTurbosladd.textContent = "Starter løp…";

        const resp = await fetch("/api/party/select-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            hostToken: state.hostToken,
            gameId: "turbosladd",
            settings: { laps, trackId },
          }),
        });

        const data = await resp.json();
        if (!data.ok) {
          alert(data.error || "Kunne ikke starte Turbosladd.");
          el.btnStartTurbosladd.disabled = false;
          el.btnStartTurbosladd.textContent = "Start Turbosladd 🏁";
          return;
        }

        window.location.href = `/turbosladd/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`;
      } catch (err) {
        console.error(err);
        alert("Feil ved start av spill.");
        el.btnStartTurbosladd.disabled = false;
        el.btnStartTurbosladd.textContent = "Start Turbosladd 🏁";
      }
    });
  }

  // Copy invitation link
  el.btnCopyLink.addEventListener("click", async () => {
    const joinUrl = `${window.location.origin}/party/?code=${encodeURIComponent(state.roomCode)}`;
    try {
      await navigator.clipboard.writeText(joinUrl);
      const originalText = el.btnCopyLink.textContent;
      el.btnCopyLink.textContent = "✓ Kopiert!";
      setTimeout(() => el.btnCopyLink.textContent = originalText, 2000);
    } catch (e) {
      prompt("Kopier denne lenken:", joinUrl);
    }
  });

  // Leave room
  async function leaveRoom() {
    stopPolling();
    if (state.roomCode && state.playerId) {
      try {
        await fetch("/api/party/leave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            playerId: state.playerId,
          }),
        });
      } catch (e) { }
    }

    if (lobbyWidget) {
      lobbyWidget.destroy();
      lobbyWidget = null;
    }

    sessionStorage.clear();
    state.roomCode = null;
    state.hostToken = null;
    state.playerId = null;
    state.isHost = false;

    el.viewLobby.classList.add("hidden");
    el.viewAuth.classList.remove("hidden");
    history.replaceState(null, "", window.location.pathname);
  }

  el.btnLeaveRoom.addEventListener("click", () => {
    if (confirm("Er du sikker på at du vil forlate party-rommet?")) {
      leaveRoom();
    }
  });

  // Cheer / reaction button animations
  document.querySelectorAll(".cheer-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      btn.style.transform = "scale(1.4)";
      setTimeout(() => btn.style.transform = "", 200);
    });
  });

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, m => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[m]);
  }

  // Initialization: check query params (?code=ABCD or ?room=ABCD or ?tab=create)
  const urlParams = new URLSearchParams(window.location.search);
  const codeParam = (urlParams.get("code") || urlParams.get("room") || "").trim().toUpperCase();
  const playerParam = (urlParams.get("player") || urlParams.get("playerId") || "").trim();
  const tabParam = (urlParams.get("tab") || urlParams.get("action") || "").trim().toLowerCase();

  if (codeParam && playerParam) {
    sessionStorage.setItem("party_room_code", codeParam);
    sessionStorage.setItem("party_player_id", playerParam);
  }

  const savedName = localStorage.getItem("spillhjornet_player_name") || sessionStorage.getItem("party_player_name") || "";
  if (savedName) {
    if (!el.inputJoinName.value) el.inputJoinName.value = savedName;
    if (!el.inputCreateName.value) el.inputCreateName.value = savedName;
  }

  // Set random character creator figure for Party Lounge header
  const partyHeaderIcon = document.getElementById("partyHeaderIcon");
  if (partyHeaderIcon && window.CharacterCreator) {
    const randomCfg = window.CharacterCreator.getRandomConfig();
    window.CharacterCreator.getDataUrl(randomCfg).then(url => {
      partyHeaderIcon.src = url;
    }).catch(() => {
      partyHeaderIcon.src = window.CharacterCreator.getAvatarImgSrc();
    });
  }

  if (loadSession()) {
    enterLobbyView();
  } else if (codeParam) {
    el.inputJoinCode.value = codeParam;
    el.tabJoin.click();
    el.inputJoinName.focus();
  } else if (tabParam === "create" || tabParam === "opprett") {
    el.tabCreate.click();
    el.inputCreateName.focus();
  }

})();
