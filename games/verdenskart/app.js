(() => {
  "use strict";

  // =========================================================================
  // AUDIO SYNTHESIZER (WEB AUDIO API - ZERO DEPENDENCY)
  // =========================================================================
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playChime(freqs = [523.25, 659.25, 783.99], type = "sine", duration = 0.25) {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.05);

        gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + idx * 0.05 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.05 + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.05);
        osc.stop(ctx.currentTime + idx * 0.05 + duration + 0.05);
      });
    } catch (e) {}
  }

  function playFoundSound() {
    playChime([523.25, 659.25, 1046.5], "triangle", 0.28); // C5, E5, C6
  }

  function playDuplicateSound() {
    playChime([329.63, 261.63], "sine", 0.18); // E4, C4
  }

  function playFanfareSound() {
    playChime([523.25, 659.25, 783.99, 1046.5, 1318.5], "triangle", 0.45);
  }

  // =========================================================================
  // AVATAR RESOLVER (CHARACTER CREATOR PIXEL ART)
  // =========================================================================
  function getPlayerAvatarImgSrc(avatarStr) {
    if (window.CharacterCreator && typeof window.CharacterCreator.getAvatarImgSrc === "function") {
      try {
        const src = window.CharacterCreator.getAvatarImgSrc(avatarStr);
        if (src) return src;
      } catch (e) {}
    }
    if (!avatarStr || avatarStr === "charbear") return "/assets/mons/charbear.png";
    if (avatarStr.startsWith("/") || avatarStr.startsWith("data:")) return avatarStr;
    return "/assets/mons/charbear.png";
  }

  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================
  const state = {
    roomCode: null,
    playerId: null,
    playerName: "Spiller",
    playerColor: "#38bdf8",
    playerAvatar: "char:h1:c_ffd166:r1:e1:m1",
    playerTeam: "red",
    isHost: false,
    status: "lobby", // "lobby", "playing", "finished"
    mode: "ffa", // "ffa", "coop", "team"
    region: "all",
    discovered: {}, // cid -> discoveryRecord
    renderedColors: new Map(), // cid -> hex color
    feed: [],
    players: [],
    leaderboard: [],
    countries: [], // list from countries.json
    countriesById: {},
    aliasToId: {},
    lastVersion: -1,
    pathMap: new Map(), // cid -> SVGPathElement
    pollTimer: null,
  };

  const DEPENDENT_PATHS = {
    dk: ["gl", "fo"],
    fr: ["gf"],
    us: ["pr"],
    no: ["sj"],
    ma: ["eh"],
  };

  // Fixed world map viewBox (1010 x 666 space)
  const MAP_VIEWBOX = "0 0 1010 666";

  // DOM Elements
  const el = {};

  function cacheElements() {
    el.viewLobby = document.getElementById("viewLobby");
    el.viewGame = document.getElementById("viewGame");
    el.btnHeaderBack = document.getElementById("btnHeaderBack");
    el.backBtnText = document.getElementById("backBtnText");
    el.labelGameMode = document.getElementById("labelGameMode");
    el.textProgress = document.getElementById("textProgress");
    el.textPercent = document.getElementById("textPercent");
    el.progressFillBar = document.getElementById("progressFillBar");
    el.btnGiveUp = document.getElementById("btnGiveUp");

    // Lobby
    el.lobbyRoomCode = document.getElementById("lobbyRoomCode");
    el.lobbyPlayerCount = document.getElementById("lobbyPlayerCount");
    el.lobbyPlayersGrid = document.getElementById("lobbyPlayersGrid");
    el.lobbySettingsPanel = document.getElementById("lobbySettingsPanel");
    el.selectMode = document.getElementById("selectMode");
    el.selectRegion = document.getElementById("selectRegion");
    el.btnStartGame = document.getElementById("btnStartGame");

    // Game
    el.inputCountry = document.getElementById("inputCountry");
    el.btnClearInput = document.getElementById("btnClearInput");
    el.guessFlashBadge = document.getElementById("guessFlashBadge");
    el.gfFlag = document.getElementById("gfFlag");
    el.gfName = document.getElementById("gfName");
    el.gfBonus = document.getElementById("gfBonus");

    // Map
    el.mapViewport = document.getElementById("mapViewport");
    el.svgCanvas = document.getElementById("svgCanvas");
    el.mapLoadingState = document.getElementById("mapLoadingState");
    el.mapTooltip = document.getElementById("mapTooltip");
    el.ttFlag = document.getElementById("ttFlag");
    el.ttTitle = document.getElementById("ttTitle");
    el.ttSub = document.getElementById("ttSub");
    el.ttClaim = document.getElementById("ttClaim");

    // Sidebar
    el.vkSidebar = document.getElementById("vkSidebar");
    el.sidePlayerCountBadge = document.getElementById("sidePlayerCountBadge");
    el.leaderboardList = document.getElementById("leaderboardList");
    el.feedStream = document.getElementById("feedStream");
    el.continentBreakdown = document.getElementById("continentBreakdown");

    // Modals
    el.modalCountryList = document.getElementById("modalCountryList");
    el.btnCloseCountryList = document.getElementById("btnCloseCountryList");
    el.modalSearchFilter = document.getElementById("modalSearchFilter");
    el.modalCountryGrid = document.getElementById("modalCountryGrid");
    el.modalFilterPills = document.querySelectorAll(".vk-filter-btn[data-filter]");
    el.cntAll = document.getElementById("cntAll");
    el.cntFound = document.getElementById("cntFound");
    el.cntMissing = document.getElementById("cntMissing");

    // Victory
    el.modalVictory = document.getElementById("modalVictory");
    el.victoryHeading = document.getElementById("victoryHeading");
    el.victorySubtitle = document.getElementById("victorySubtitle");
    el.vStatFound = document.getElementById("vStatFound");
    el.vStatPercent = document.getElementById("vStatPercent");
    el.victoryPodiumList = document.getElementById("victoryPodiumList");
    el.btnVictoryViewFasit = document.getElementById("btnVictoryViewFasit");
    el.btnVictoryPlayAgain = document.getElementById("btnVictoryPlayAgain");
  }

  // =========================================================================
  // NORMALIZATION FOR GUESS MATCHING
  // =========================================================================
  function stripAccents(str) {
    if (!str) return "";
    str = str.replace(/[æÆ]/g, "ae").replace(/[øØ]/g, "o").replace(/[åÅ]/g, "a");
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function normalizeInput(raw) {
    if (!raw) return "";
    return raw.toLowerCase().trim().replace(/[\s\-_'\.\,\/]+/g, " ");
  }

  function normalizeStrict(raw) {
    return stripAccents(normalizeInput(raw)).replace(/[^a-z0-9]/g, "");
  }

  // =========================================================================
  // LOAD DATA & SVG MAP
  // =========================================================================
  async function loadCountryData() {
    try {
      const resp = await fetch("/verdenskart/data/countries.json");
      const list = await resp.json();
      state.countries = list;
      list.forEach(c => {
        const cid = c.id.toLowerCase();
        state.countriesById[cid] = c;

        // Populate alias lookup
        [c.name_no, c.name_en, ...(c.aliases || [])].forEach(a => {
          if (!a) return;
          state.aliasToId[normalizeInput(a)] = cid;
          state.aliasToId[normalizeStrict(a)] = cid;
        });
      });
      renderContinentBreakdown();
    } catch (e) {
      console.error("Could not load countries.json:", e);
    }
  }

  async function loadWorldSvg() {
    try {
      const resp = await fetch("/verdenskart/assets/world_map.svg");
      const svgText = await resp.text();
      if (el.svgCanvas) {
        el.svgCanvas.innerHTML = svgText;
        const svgEl = el.svgCanvas.querySelector("svg");
        if (svgEl) {
          svgEl.setAttribute("viewBox", MAP_VIEWBOX);
          svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
          cacheSvgPaths(svgEl);
          initSvgInteractions();
        }
      }
    } catch (e) {
      console.error("Could not load world_map.svg:", e);
      if (el.mapLoadingState) {
        el.mapLoadingState.innerHTML = `<span style="color:#ef4444;">Kunne ikke laste kartet. Prøv å oppdatere siden.</span>`;
      }
    }
  }

  function cacheSvgPaths(svgEl) {
    state.pathMap.clear();
    const paths = svgEl.querySelectorAll("path[id]");
    paths.forEach(p => {
      state.pathMap.set(p.id.toLowerCase(), p);
    });
  }

  function clearAllCountryPaths() {
    state.pathMap.forEach(path => {
      path.style.fill = "";
      path.classList.remove("discovered", "just-discovered");
    });
  }

  function fillCountryPath(cid, color, isJustDiscovered = false) {
    const pathIds = [cid, ...(DEPENDENT_PATHS[cid] || [])];
    pathIds.forEach(id => {
      const path = state.pathMap.get(id);
      if (path) {
        path.style.fill = color;
        path.classList.add("discovered");
        if (isJustDiscovered) {
          path.classList.add("just-discovered");
          setTimeout(() => path.classList.remove("just-discovered"), 700);
        }
      }
    });
  }

  function initSvgInteractions() {
    const vp = el.mapViewport;
    if (!vp) return;

    // Hover tooltip tracking on discovered countries only
    vp.addEventListener("pointermove", handleHoverTooltip);
    vp.addEventListener("pointerleave", hideTooltip);
  }

  // =========================================================================
  // TOOLTIP CONTROLLER (STRICTLY DISCOVERED COUNTRIES ONLY - NO SPOILERS)
  // =========================================================================
  function handleHoverTooltip(e) {
    if (!el.mapTooltip) return;
    const targetPath = e.target.closest("path[id]");
    if (!targetPath) {
      hideTooltip();
      return;
    }

    const cid = targetPath.id.toLowerCase();
    const disc = state.discovered[cid];

    // CRITICAL: NEVER REVEAL UNDISCOVERED COUNTRIES!
    if (!disc) {
      hideTooltip();
      return;
    }

    const country = state.countriesById[cid];
    if (!country) {
      hideTooltip();
      return;
    }

    el.ttFlag.textContent = country.flag || "🌍";
    el.ttTitle.textContent = country.name_no || country.name_en;
    el.ttSub.textContent = `Hovedstad: ${country.capital || "–"} • ${country.continent}`;
    el.ttClaim.textContent = `✓ Funnet av ${disc.playerName}!`;
    el.ttClaim.style.color = disc.playerColor || "#10b981";
    el.ttClaim.classList.remove("hidden");

    // Position tooltip using GPU translate3d
    const vpRect = el.mapViewport.getBoundingClientRect();
    const x = e.clientX - vpRect.left;
    const y = e.clientY - vpRect.top;
    el.mapTooltip.style.transform = `translate3d(${x}px, ${y - 14}px, 0) translate(-50%, -100%)`;
    el.mapTooltip.classList.remove("hidden");
  }

  function hideTooltip() {
    if (el.mapTooltip) el.mapTooltip.classList.add("hidden");
  }

  // =========================================================================
  // TYPING & GUESS HANDLING (FAST & FIXED MAP)
  // =========================================================================
  function initInputHandler() {
    if (!el.inputCountry) return;

    el.inputCountry.addEventListener("input", () => {
      const val = el.inputCountry.value;
      if (el.btnClearInput) {
        el.btnClearInput.classList.toggle("hidden", !val);
      }
      checkAndSubmitGuess(val);
    });

    el.inputCountry.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        checkAndSubmitGuess(el.inputCountry.value, true);
      }
    });

    if (el.btnClearInput) {
      el.btnClearInput.addEventListener("click", () => {
        el.inputCountry.value = "";
        el.btnClearInput.classList.add("hidden");
        el.inputCountry.focus();
      });
    }
  }

  let lastCheckedVal = "";

  async function checkAndSubmitGuess(textRaw, forceEnter = false) {
    const text = normalizeInput(textRaw);
    if (!text || text.length < 2) return;
    if (text === lastCheckedVal && !forceEnter) return;

    // Check against local cache
    const strict = normalizeStrict(text);
    const matchedCid = state.aliasToId[text] || state.aliasToId[strict];

    if (!matchedCid) {
      return;
    }

    const country = state.countriesById[matchedCid];
    if (!country) return;

    // Region filter check
    if (state.region !== "all" && country.continent.toLowerCase() !== state.region.toLowerCase()) {
      return;
    }

    lastCheckedVal = text;

    // Clear input field immediately for snappy game feel
    el.inputCountry.value = "";
    if (el.btnClearInput) el.btnClearInput.classList.add("hidden");

    // 1. Check if already discovered
    if (state.discovered[matchedCid]) {
      const disc = state.discovered[matchedCid];
      showFlashBadge(country.flag, country.name_no, `Funnet av ${disc.playerName}`, true);
      playDuplicateSound();
      return;
    }

    // 2. Optimistic local update using the player's true assigned color!
    let claimColor = state.playerColor;
    if (state.mode === "team") {
      claimColor = state.playerTeam === "blue" ? "#38bdf8" : "#ef4444";
    }

    const discoveryRecord = {
      countryId: matchedCid,
      countryName: country.name_no,
      countryNameEn: country.name_en,
      flag: country.flag,
      continent: country.continent,
      capital: country.capital,
      playerId: state.playerId,
      playerName: state.playerName,
      playerColor: claimColor,
      playerAvatar: state.playerAvatar,
      timestamp: Date.now() / 1000,
    };

    state.discovered[matchedCid] = discoveryRecord;
    state.renderedColors.set(matchedCid, claimColor);
    fillCountryPath(matchedCid, claimColor, true);
    showFlashBadge(country.flag, country.name_no, "+1", false);
    playFoundSound();
    updateProgressUI();

    // 3. Send to Server for 1-16 player sync
    if (state.roomCode) {
      try {
        const resp = await fetch("/api/verdenskart/guess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            playerId: state.playerId,
            text: textRaw,
          }),
        });
        const data = await resp.json();
        if (data && data.ok) {
          if (data.status === "new") {
            const count = data.totalDiscovered || Object.keys(state.discovered).length;
            if (count === 50 || count === 100 || count === 150 || count === 197) {
              playFanfareSound();
            }
          }
        }
      } catch (err) {
        console.warn("Guess error:", err);
      }
    }
  }

  function showFlashBadge(flag, name, bonusText, isDuplicate = false) {
    if (!el.guessFlashBadge) return;
    el.gfFlag.textContent = flag || "🌍";
    el.gfName.textContent = name;
    el.gfBonus.textContent = bonusText;

    el.guessFlashBadge.classList.toggle("duplicate", isDuplicate);
    el.guessFlashBadge.classList.remove("hidden");

    clearTimeout(el.guessFlashBadge._timer);
    el.guessFlashBadge._timer = setTimeout(() => {
      el.guessFlashBadge.classList.add("hidden");
    }, 1800);
  }

  // =========================================================================
  // PROGRESS, LEADERBOARD & STATS UI
  // =========================================================================
  function updateProgressUI() {
    const total = state.region === "all" ? 197 : (state.countries.filter(c => c.continent.toLowerCase() === state.region.toLowerCase()).length || 197);
    const count = Object.keys(state.discovered).length;
    const percent = ((count / total) * 100).toFixed(1);

    if (el.textProgress) el.textProgress.textContent = `${count} / ${total}`;
    if (el.textPercent) el.textPercent.textContent = `(${percent}%)`;
    if (el.progressFillBar) el.progressFillBar.style.width = `${percent}%`;

    renderContinentBreakdown();
  }

  function renderLeaderboard(players = state.players) {
    if (!el.leaderboardList) return;

    const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
    el.leaderboardList.innerHTML = sorted.map((p, idx) => {
      const isMe = p.id === state.playerId;
      const rankMedal = idx === 0 ? "🥇" : (idx === 1 ? "🥈" : (idx === 2 ? "🥉" : `${idx + 1}.`));
      const avSrc = getPlayerAvatarImgSrc(p.avatar);
      return `
        <div class="vk-lb-row ${isMe ? 'me' : ''}">
          <div class="lb-player-info">
            <span class="lb-rank">${rankMedal}</span>
            <div class="lb-avatar-frame" style="border-color:${p.color || '#38bdf8'}; background:${p.color || '#38bdf8'}22;">
              <img src="${avSrc}" class="lb-avatar-img" alt="${escapeHtml(p.name)}" />
            </div>
            <span class="lb-name">${escapeHtml(p.name)}</span>
          </div>
          <span class="lb-score-pill" style="color:${p.color || '#38bdf8'};">
            ${p.score || 0}
          </span>
        </div>
      `;
    }).join("");

    if (el.sidePlayerCountBadge) {
      el.sidePlayerCountBadge.textContent = `${players.length} ${players.length === 1 ? 'spiller' : 'spillere'}`;
    }
  }

  function renderFeed(feedItems = state.feed) {
    if (!el.feedStream) return;
    el.feedStream.innerHTML = feedItems.slice(-15).reverse().map(item => {
      const avSrc = getPlayerAvatarImgSrc(item.avatar);
      return `
        <div class="vk-feed-item">
          <img src="${avSrc}" class="feed-avatar-img" style="border-color:${item.color || '#38bdf8'};" alt="" />
          <span class="feed-name" style="color:${item.color || '#38bdf8'};">${escapeHtml(item.playerName)}</span>
          <span>fant</span>
          <span class="feed-flag">${item.flag || "🌍"}</span>
          <span class="feed-country">${escapeHtml(item.countryName)}</span>
        </div>
      `;
    }).join("");
  }

  function renderContinentBreakdown() {
    if (!el.continentBreakdown || !state.countries.length) return;

    const continents = ["Europa", "Asia", "Afrika", "Amerika", "Oseania"];
    const counts = {};
    const totals = {};

    continents.forEach(c => {
      counts[c] = 0;
      totals[c] = state.countries.filter(item => item.continent === c).length;
    });

    Object.values(state.discovered).forEach(d => {
      if (counts[d.continent] !== undefined) {
        counts[d.continent]++;
      }
    });

    el.continentBreakdown.innerHTML = continents.map(c => {
      const cur = counts[c];
      const tot = totals[c];
      const pct = tot > 0 ? Math.round((cur / tot) * 100) : 0;
      return `
        <div class="cont-row">
          <div class="cont-row-head">
            <span>${c}</span>
            <span>${cur}/${tot} (${pct}%)</span>
          </div>
          <div class="cont-bar-track">
            <div class="cont-bar-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    }).join("");
  }

  // =========================================================================
  // FASIT & COUNTRY LIST MODAL
  // =========================================================================
  function initModals() {
    if (el.btnCloseCountryList) {
      el.btnCloseCountryList.addEventListener("click", () => {
        el.modalCountryList.close();
      });
    }
    if (el.btnVictoryViewFasit) {
      el.btnVictoryViewFasit.addEventListener("click", () => {
        el.modalVictory.close();
        openCountryListModal("missing");
      });
    }
    if (el.btnVictoryPlayAgain) {
      el.btnVictoryPlayAgain.addEventListener("click", async () => {
        el.modalVictory.close();
        if (state.roomCode) {
          await fetch("/api/verdenskart/restart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomCode: state.roomCode, playerId: state.playerId }),
          });
          await pollRoomState();
        } else {
          // Solo restart
          state.discovered = {};
          state.renderedColors.clear();
          clearAllCountryPaths();
          updateProgressUI();
          showView("game");
        }
      });
    }

    // Give Up / Forfeit Button
    if (el.btnGiveUp) {
      el.btnGiveUp.addEventListener("click", async () => {
        if (!confirm("Vil du gi opp runden og se fasiten over alle land?")) return;

        if (state.roomCode) {
          try {
            await fetch("/api/verdenskart/give_up", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                roomCode: state.roomCode,
                playerId: state.playerId,
              }),
            });
            await pollRoomState();
          } catch (e) {
            console.warn("Give up error:", e);
            showGameOverView();
          }
        } else {
          showGameOverView();
        }
      });
    }

    // Modal search
    if (el.modalSearchFilter) {
      el.modalSearchFilter.addEventListener("input", () => {
        renderModalCountryGrid();
      });
    }

    // Modal filter buttons
    if (el.modalFilterPills) {
      el.modalFilterPills.forEach(btn => {
        btn.addEventListener("click", () => {
          el.modalFilterPills.forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          renderModalCountryGrid();
        });
      });
    }
  }

  function openCountryListModal(defaultFilter = "all") {
    if (el.modalFilterPills) {
      el.modalFilterPills.forEach(b => {
        b.classList.toggle("active", b.dataset.filter === defaultFilter);
      });
    }
    if (el.modalSearchFilter) el.modalSearchFilter.value = "";
    renderModalCountryGrid();
    el.modalCountryList.showModal();
  }

  function renderModalCountryGrid() {
    if (!el.modalCountryGrid) return;

    const query = (el.modalSearchFilter ? el.modalSearchFilter.value : "").toLowerCase().trim();
    const activeFilterBtn = document.querySelector(".vk-filter-btn.active");
    const filter = activeFilterBtn ? activeFilterBtn.dataset.filter : "all";

    const all = state.countries;
    const foundCount = Object.keys(state.discovered).length;
    const missingCount = all.length - foundCount;

    if (el.cntAll) el.cntAll.textContent = all.length;
    if (el.cntFound) el.cntFound.textContent = foundCount;
    if (el.cntMissing) el.cntMissing.textContent = missingCount;

    const filtered = all.filter(c => {
      const isFound = Boolean(state.discovered[c.id.toLowerCase()]);
      if (filter === "found" && !isFound) return false;
      if (filter === "missing" && isFound) return false;
      if (query) {
        const matchesName = (c.name_no || "").toLowerCase().includes(query) || (c.name_en || "").toLowerCase().includes(query);
        const matchesCap = (c.capital || "").toLowerCase().includes(query);
        return matchesName || matchesCap;
      }
      return true;
    });

    el.modalCountryGrid.innerHTML = filtered.map(c => {
      const isFound = Boolean(state.discovered[c.id.toLowerCase()]);
      const disc = state.discovered[c.id.toLowerCase()];
      return `
        <div class="vk-c-card ${isFound ? 'found' : 'missing'}" data-cid="${c.id}">
          <span class="c-flag">${c.flag || "🌍"}</span>
          <div class="c-info">
            <span class="c-name">${c.name_no}</span>
            <span class="c-cap">${isFound ? `✓ ${disc.playerName}` : c.capital || c.continent}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  // =========================================================================
  // GAME OVER / VICTORY MODAL
  // =========================================================================
  function showGameOverView() {
    state.status = "finished";
    const total = state.region === "all" ? 197 : (state.countries.filter(c => c.continent.toLowerCase() === state.region.toLowerCase()).length || 197);
    const count = Object.keys(state.discovered).length;
    const percent = ((count / total) * 100).toFixed(1);

    if (el.vStatFound) el.vStatFound.textContent = `${count} / ${total}`;
    if (el.vStatPercent) el.vStatPercent.textContent = `${percent}%`;

    if (el.victorySubtitle) {
      el.victorySubtitle.textContent = `Dere fant ${count} av ${total} land (${percent}%)!`;
    }

    // Render podium with avatars
    if (el.victoryPodiumList) {
      const sorted = [...state.players].sort((a, b) => (b.score || 0) - (a.score || 0));
      el.victoryPodiumList.innerHTML = sorted.map((p, idx) => {
        const avSrc = getPlayerAvatarImgSrc(p.avatar);
        return `
          <div class="vk-lb-row" style="margin-bottom:0.4rem;">
            <div class="lb-player-info">
              <span class="lb-rank">${idx === 0 ? "🥇 Vinner" : (idx === 1 ? "🥈 2. plass" : `${idx + 1}.`)}</span>
              <div class="lb-avatar-frame" style="border-color:${p.color || '#38bdf8'}; background:${p.color || '#38bdf8'}22;">
                <img src="${avSrc}" class="lb-avatar-img" alt="${escapeHtml(p.name)}" />
              </div>
              <span class="lb-name">${escapeHtml(p.name)}</span>
            </div>
            <span class="lb-score-pill" style="color:${p.color || '#38bdf8'};">
              ${p.score || 0} land (${total > 0 ? Math.round((p.score / total) * 100) : 0}%)
            </span>
          </div>
        `;
      }).join("");
    }

    playFanfareSound();
    el.modalVictory.showModal();
  }

  // =========================================================================
  // HIGH-PERFORMANCE SERVER SYNC & ROOM POLLING
  // =========================================================================
  async function pollRoomState() {
    if (!state.roomCode) return;
    try {
      const resp = await fetch(`/api/verdenskart/state?roomCode=${encodeURIComponent(state.roomCode)}&playerId=${encodeURIComponent(state.playerId || "")}`);
      const data = await resp.json();
      if (!data || !data.ok) return;

      // Update current player info from server if available
      if (data.me) {
        state.playerId = data.me.id || state.playerId;
        state.playerName = data.me.name || state.playerName;
        state.playerColor = data.me.color || state.playerColor;
        state.playerAvatar = data.me.avatar || state.playerAvatar;
        state.playerTeam = data.me.team || state.playerTeam;
        state.isHost = Boolean(data.me.is_host);
      }

      // Zero-lag optimization: if version and status haven't changed, skip DOM re-renders!
      if (data.version === state.lastVersion && data.status === state.status) {
        return;
      }
      state.lastVersion = data.version;

      state.status = data.status;
      state.mode = data.mode || state.mode;
      state.region = data.region || state.region;
      state.players = data.players || [];
      state.feed = data.feed || [];
      state.isHost = Boolean(data.isHost);

      // Handle round restart from server
      const newDiscovered = data.discovered || {};
      if (state.status === "playing" && Object.keys(newDiscovered).length === 0 && state.renderedColors.size > 0) {
        state.renderedColors.clear();
        clearAllCountryPaths();
        if (el.modalVictory.open) {
          el.modalVictory.close();
        }
      }

      // Exact color sync: every country gets the exact color of the player who claimed it
      let hasNewDiscoveries = false;
      for (const [cid, record] of Object.entries(newDiscovered)) {
        const assignedColor = record.playerColor || "#10b981";
        const curColor = state.renderedColors.get(cid);
        if (curColor !== assignedColor) {
          state.renderedColors.set(cid, assignedColor);
          fillCountryPath(cid, assignedColor, false);
          hasNewDiscoveries = true;
        }
      }
      state.discovered = newDiscovered;

      if (hasNewDiscoveries) {
        updateProgressUI();
      }

      renderLeaderboard(data.leaderboard || state.players);
      renderFeed(state.feed);

      // Handle Views
      if (state.status === "lobby") {
        showView("lobby");
        renderLobbyUI(data);
      } else if (state.status === "playing") {
        showView("game");
      } else if (state.status === "finished") {
        if (!el.modalVictory.open) {
          showGameOverView();
        }
      }
    } catch (err) {
      console.warn("Poll state error:", err);
    }
  }

  function renderLobbyUI(data) {
    if (el.lobbyRoomCode) el.lobbyRoomCode.textContent = state.roomCode;
    if (el.lobbyPlayerCount) el.lobbyPlayerCount.textContent = (data.players || []).length;

    if (el.lobbyPlayersGrid) {
      el.lobbyPlayersGrid.innerHTML = (data.players || []).map(p => {
        const avSrc = getPlayerAvatarImgSrc(p.avatar);
        return `
          <div class="vk-player-card ${p.is_host ? 'is-host' : ''}">
            <div class="vk-player-avatar-frame" style="border-color:${p.color || '#38bdf8'}; background:${p.color || '#38bdf8'}22;">
              <img src="${avSrc}" class="vk-player-avatar-img" alt="${escapeHtml(p.name)}" />
            </div>
            <span class="vk-player-name">${escapeHtml(p.name)} ${p.is_host ? '👑' : ''}</span>
          </div>
        `;
      }).join("");
    }

    if (el.lobbySettingsPanel) {
      el.lobbySettingsPanel.style.display = state.isHost ? "grid" : "none";
    }
    if (el.btnStartGame) {
      el.btnStartGame.style.display = state.isHost ? "block" : "none";
    }
  }

  function showView(viewName) {
    if (el.viewLobby) el.viewLobby.classList.toggle("hidden", viewName !== "lobby");
    if (el.viewGame) el.viewGame.classList.toggle("hidden", viewName !== "game");

    if (viewName === "game" && el.inputCountry) {
      el.inputCountry.focus();
    }
  }

  // =========================================================================
  // PARTY BRIDGE & INIT
  // =========================================================================
  async function initPartyBridge() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = (urlParams.get("room") || urlParams.get("code") || urlParams.get("roomCode") || "").trim().toUpperCase();
    const playerParam = (urlParams.get("player") || urlParams.get("playerId") || sessionStorage.getItem("party_player_id") || "").trim();

    if (roomParam) {
      state.roomCode = roomParam;
      state.playerId = playerParam;

      if (el.btnHeaderBack) {
        el.btnHeaderBack.href = `/party/?room=${encodeURIComponent(roomParam)}`;
      }
      if (el.backBtnText) {
        el.backBtnText.textContent = "Lounge";
      }
      const victoryLoungeBtn = document.getElementById("btnVictoryBackLounge");
      if (victoryLoungeBtn) {
        victoryLoungeBtn.href = `/party/?room=${encodeURIComponent(roomParam)}`;
        victoryLoungeBtn.textContent = "Tilbake til Party Lounge";
      }

      // Initial state fetch
      await pollRoomState();

      // Start polling
      clearInterval(state.pollTimer);
      state.pollTimer = setInterval(pollRoomState, 450);
    } else {
      // Local Solo Training Practice Mode
      state.status = "playing";
      showView("game");
      if (el.labelGameMode) el.labelGameMode.textContent = "Solo Trening";
    }
  }

  function initHostControls() {
    if (el.btnStartGame) {
      el.btnStartGame.addEventListener("click", async () => {
        if (!state.roomCode || !state.playerId) return;
        const mode = el.selectMode ? el.selectMode.value : "ffa";
        const region = el.selectRegion ? el.selectRegion.value : "all";

        await fetch("/api/verdenskart/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            playerId: state.playerId,
            mode: mode,
            timeLimit: 0, // No timer limit
            region: region,
          }),
        });

        pollRoomState();
      });
    }

    if (el.selectMode) {
      el.selectMode.addEventListener("change", updateLobbySettings);
    }
    if (el.selectRegion) {
      el.selectRegion.addEventListener("change", updateLobbySettings);
    }
  }

  async function updateLobbySettings() {
    if (!state.roomCode || !state.isHost) return;
    await fetch("/api/verdenskart/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomCode: state.roomCode,
        playerId: state.playerId,
        mode: el.selectMode ? el.selectMode.value : "ffa",
        timeLimit: 0,
        region: el.selectRegion ? el.selectRegion.value : "all",
      }),
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  // =========================================================================
  // BOOTSTRAP
  // =========================================================================
  window.addEventListener("DOMContentLoaded", async () => {
    cacheElements();
    initInputHandler();
    initModals();
    initHostControls();

    await loadCountryData();
    await loadWorldSvg();
    await initPartyBridge();
  });
})();
