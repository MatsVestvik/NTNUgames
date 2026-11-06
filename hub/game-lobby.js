/**
 * NTNU Games – Standardized Party Lobby Client Module
 * Provides a unified, single-source Party creation and joining tab across ALL games.
 */

(function () {
  "use strict";

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, function (s) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[s];
    });
  }

  function getSavedName() {
    return (
      localStorage.getItem("spillhjornet_player_name") ||
      localStorage.getItem("party_player_name") ||
      sessionStorage.getItem("party_player_name") ||
      ""
    );
  }

  function getSavedAvatar() {
    if (window.CharacterCreator && typeof window.CharacterCreator.getSavedConfigString === "function") {
      return window.CharacterCreator.getSavedConfigString();
    }
    return (
      localStorage.getItem("party_avatar") ||
      sessionStorage.getItem("party_avatar") ||
      "char:h1:c_ffd166:r3:e1:m1"
    );
  }

  function detectGameId(element) {
    if (element) {
      const explicit =
        element.getAttribute("data-party-game") ||
        element.getAttribute("data-game") ||
        element.getAttribute("data-game-id") ||
        element.getAttribute("game");
      if (explicit) return explicit;
    }
    const meta = document.querySelector('meta[name="game-id"]')?.getAttribute("content");
    if (meta) return meta;

    const fromBody =
      document.body?.getAttribute("data-game-id") ||
      document.body?.getAttribute("data-game");
    if (fromBody) return fromBody;

    const fromDoc = document.querySelector("[data-game-id]")?.getAttribute("data-game-id");
    if (fromDoc) return fromDoc;

    // Detect from URL pathname, e.g. /kuleregn/ or /turbosladd/
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length > 0 && parts[0] !== "party" && parts[0] !== "hub") {
      return parts[0].replace(/-/g, "_");
    }
    return "";
  }

  /**
   * Generates the canonical HTML for the standardized "Nettspill" deck.
   */
  function getOnlineDeckHTML(options = {}) {
    const saved = escapeHtml(options.savedName || getSavedName() || "Vert");
    const gameDesc =
      options.gameDesc ||
      "Start et felles party-rom for alle venner på mobil eller PC. I rommet kan du velge og bytte mellom alle spill fritt!";

    return `
<div class="online-lobby-deck">
  <!-- Action Cards: Create vs Join Standardized Party Room -->
  <div class="online-split">
    <!-- Create Party Card -->
    <div class="action-box card-theme-orange">
      <div class="action-box-header">
        <div class="box-badge-row">
          <span class="action-card-badge badge-orange">Romvert</span>
        </div>
        <h3 class="box-title">Opprett party</h3>
        <p class="box-desc">${escapeHtml(gameDesc)}</p>
      </div>

      <div class="action-box-content">
        <div class="form-group">
          <label for="inputPartyHostName">Ditt kallenavn</label>
          <input type="text" id="inputPartyHostName" class="text-input" maxlength="18"
            placeholder="F.eks. Henrik (Vert)" value="${saved}" required />
        </div>
      </div>

      <button type="button" class="primary-btn pulse-glow" id="btnCreatePartyRoom">
        Opprett party-rom 🎉
      </button>
    </div>

    <!-- Join Party Card -->
    <div class="action-box card-theme-purple">
      <div class="action-box-header">
        <div class="box-badge-row">
          <span class="action-card-badge badge-purple">Bli med</span>
        </div>
        <h3 class="box-title">Bli med i party</h3>
        <p class="box-desc">Tast inn 4-bokstavskoden fra storskjermen eller vennen din.</p>
      </div>

      <div class="action-box-content">
        <div class="form-group">
          <label for="inputPartyRoomCode">Romkode (4 bokstaver)</label>
          <input type="text" id="inputPartyRoomCode" class="text-input code-input" maxlength="6"
            placeholder="FEST" autocomplete="off" autocorrect="off" autocapitalize="characters" required />
        </div>

        <div class="form-group">
          <label for="inputPartyJoinName">Ditt kallenavn</label>
          <input type="text" id="inputPartyJoinName" class="text-input" maxlength="18"
            placeholder="F.eks. Spiller" value="${saved === "Vert" ? "Spiller" : saved}" required />
        </div>
      </div>

      <button type="button" class="btn-cyan-accent" id="btnJoinPartyRoom">
        Bli med i festen 🚀
      </button>
    </div>
  </div>
</div>`.trim();
  }

  let isCreating = false;
  let isJoining = false;

  async function createParty({ hostName, avatar, preferredGame, btnElement } = {}) {
    if (isCreating) return;
    isCreating = true;

    const name = (hostName || getSavedName() || "Vert").trim();
    const av = avatar || getSavedAvatar();
    const game = preferredGame || detectGameId();

    let oldText = "";
    if (btnElement) {
      btnElement.disabled = true;
      oldText = btnElement.textContent;
      btnElement.textContent = "Oppretter rom…";
    }

    try {
      const resp = await fetch("/api/party/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostName: name, avatar: av }),
      });
      const data = await resp.json();
      if (!data.ok) {
        alert(data.error || "Kunne ikke opprette party-rom.");
        if (btnElement) {
          btnElement.disabled = false;
          btnElement.textContent = oldText || "Opprett party-rom 🎉";
        }
        isCreating = false;
        return;
      }

      sessionStorage.setItem("party_room_code", data.roomCode);
      sessionStorage.setItem("party_host_token", data.hostToken);
      sessionStorage.setItem("party_player_id", data.playerId);
      sessionStorage.setItem("party_player_name", name);
      sessionStorage.setItem("party_avatar", data.avatar || av);

      localStorage.setItem("party_room_code", data.roomCode);
      localStorage.setItem("party_host_token", data.hostToken);
      localStorage.setItem("party_player_id", data.playerId);
      localStorage.setItem("party_player_name", name);
      localStorage.setItem("party_avatar", data.avatar || av);
      localStorage.setItem("spillhjornet_player_name", name);

      if (game) {
        sessionStorage.setItem("party_preferred_game", game);
      }

      const dest = `/party/?room=${encodeURIComponent(data.roomCode)}${game ? `&game=${encodeURIComponent(game)}` : ""}`;
      window.location.href = dest;
    } catch (err) {
      console.error("Party create error:", err);
      alert("Nettverksfeil ved opprettelse av rom.");
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.textContent = oldText || "Opprett party-rom 🎉";
      }
      isCreating = false;
    }
  }

  async function joinParty({ roomCode, playerName, avatar, btnElement } = {}) {
    if (isJoining) return;
    isJoining = true;

    const code = (roomCode || "").trim().toUpperCase();
    if (!code) {
      alert("Vennligst skriv inn en 4-bokstavs romkode.");
      isJoining = false;
      return;
    }

    const name = (playerName || getSavedName() || "Spiller").trim();
    const av = avatar || getSavedAvatar();
    const existingPid = sessionStorage.getItem("party_player_id") || localStorage.getItem("party_player_id") || "";

    let oldText = "";
    if (btnElement) {
      btnElement.disabled = true;
      oldText = btnElement.textContent;
      btnElement.textContent = "Kobler til…";
    }

    try {
      const resp = await fetch("/api/party/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode: code, playerName: name, avatar: av, playerId: existingPid }),
      });
      const data = await resp.json();
      if (!data.ok) {
        alert(data.error || "Fant ikke party-rommet. Sjekk koden og prøv igjen.");
        if (btnElement) {
          btnElement.disabled = false;
          btnElement.textContent = oldText || "Bli med i festen 🚀";
        }
        isJoining = false;
        return;
      }

      sessionStorage.setItem("party_room_code", data.roomCode);
      sessionStorage.removeItem("party_host_token");
      sessionStorage.setItem("party_player_id", data.playerId);
      sessionStorage.setItem("party_player_name", data.playerName);
      sessionStorage.setItem("party_avatar", data.avatar || av);

      localStorage.setItem("party_room_code", data.roomCode);
      localStorage.removeItem("party_host_token");
      localStorage.setItem("party_player_id", data.playerId);
      localStorage.setItem("party_player_name", data.playerName);
      localStorage.setItem("party_avatar", data.avatar || av);
      localStorage.setItem("spillhjornet_player_name", data.playerName);

      window.location.href = `/party/?room=${encodeURIComponent(data.roomCode)}&player=${encodeURIComponent(data.playerId)}`;
    } catch (err) {
      console.error("Party join error:", err);
      alert("Nettverksfeil ved tilkobling til rom.");
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.textContent = oldText || "Bli med i festen 🚀";
      }
      isJoining = false;
    }
  }

  function mountOnlinePanel(target, options = {}) {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return null;

    const gameId = options.gameId || detectGameId(el);
    const savedName = options.hostName || getSavedName() || "Vert";

    // If not already rendered with party buttons, inject standard template
    if (!el.querySelector("#btnCreatePartyRoom")) {
      el.innerHTML = getOnlineDeckHTML({ ...options, gameId, savedName });
    }

    init({
      gameId,
      createBtnId: options.createBtnId || "btnCreatePartyRoom",
      joinBtnId: options.joinBtnId || "btnJoinPartyRoom",
      hostInputId: options.hostInputId || "inputPartyHostName",
      joinInputId: options.joinInputId || "inputPartyJoinName",
      codeInputId: options.codeInputId || "inputPartyRoomCode",
      container: el,
    });

    return el;
  }

  function init({
    gameId = "",
    createBtnId = "btnCreatePartyRoom",
    joinBtnId = "btnJoinPartyRoom",
    hostInputId = "inputPartyHostName",
    joinInputId = "inputPartyJoinName",
    codeInputId = "inputPartyRoomCode",
    container = document,
  } = {}) {
    const resolvedGame = gameId || detectGameId();
    const saved = getSavedName();

    const hostInput = container.querySelector ? container.querySelector(`#${hostInputId}`) : document.getElementById(hostInputId);
    if (hostInput && saved && !hostInput.value) {
      hostInput.value = saved;
    }

    const joinInput = container.querySelector ? container.querySelector(`#${joinInputId}`) : document.getElementById(joinInputId);
    if (joinInput && saved && !joinInput.value) {
      joinInput.value = saved === "Vert" ? "Spiller" : saved;
    }

    // Keep host and join name inputs in sync if user changes one
    if (hostInput && joinInput && !hostInput.dataset.boundSync) {
      hostInput.dataset.boundSync = "true";
      hostInput.addEventListener("input", () => {
        if (!joinInput.value || joinInput.value === hostInput.defaultValue || joinInput.value === "Spiller" || joinInput.value === "Vert") {
          joinInput.value = hostInput.value;
        }
      });
    }

    const codeInput = container.querySelector ? container.querySelector(`#${codeInputId}`) : document.getElementById(codeInputId);
    if (codeInput && !codeInput.dataset.boundSync) {
      codeInput.dataset.boundSync = "true";
      codeInput.addEventListener("input", () => {
        codeInput.value = codeInput.value.toUpperCase().replace(/\s+/g, "");
      });
      codeInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const btn = container.querySelector ? container.querySelector(`#${joinBtnId}`) : document.getElementById(joinBtnId);
          if (btn) btn.click();
        }
      });
    }

    const createBtn = container.querySelector ? container.querySelector(`#${createBtnId}`) : document.getElementById(createBtnId);
    if (createBtn && !createBtn.dataset.boundPartyConnect) {
      createBtn.dataset.boundPartyConnect = "true";
      createBtn.addEventListener("click", () => {
        const hostName = hostInput ? hostInput.value : "";
        createParty({ hostName, preferredGame: resolvedGame, btnElement: createBtn });
      });
    }

    const joinBtn = container.querySelector ? container.querySelector(`#${joinBtnId}`) : document.getElementById(joinBtnId);
    if (joinBtn && !joinBtn.dataset.boundPartyConnect) {
      joinBtn.dataset.boundPartyConnect = "true";
      joinBtn.addEventListener("click", () => {
        const roomCode = codeInput ? codeInput.value : "";
        const playerName = joinInput ? joinInput.value : (hostInput ? hostInput.value : "");
        joinParty({ roomCode, playerName, btnElement: joinBtn });
      });
    }
  }

  /**
   * Unified Tab Switching Controller for any game with .lobby-tabs and .tab-panel.
   */
  function initTabs(root = document) {
    const tabBars = root.querySelectorAll ? root.querySelectorAll(".lobby-tabs") : [];
    tabBars.forEach((bar) => {
      if (bar.dataset.boundLobbyTabs) return;
      bar.dataset.boundLobbyTabs = "true";

      const card = bar.closest(".lobby-card") || bar.parentElement;
      const tabBtns = Array.from(bar.querySelectorAll(".lobby-tab-btn"));
      const panels = card ? Array.from(card.querySelectorAll(".tab-panel")) : [];

      tabBtns.forEach((btn, idx) => {
        btn.addEventListener("click", () => {
          // Deactivate all tab buttons in this bar
          tabBtns.forEach((b) => {
            b.classList.remove("active");
            b.setAttribute("aria-selected", "false");
          });
          btn.classList.add("active");
          btn.setAttribute("aria-selected", "true");

          // Determine target panel
          let targetPanel = null;
          const targetId = btn.getAttribute("aria-controls") || btn.dataset.tabTarget || btn.dataset.target;
          if (targetId) {
            targetPanel = document.getElementById(targetId.replace(/^#/, ""));
          }
          if (!targetPanel && btn.id) {
            const derivedId = btn.id.replace(/^tab/, "panel");
            targetPanel = document.getElementById(derivedId);
          }
          if (!targetPanel && panels[idx]) {
            targetPanel = panels[idx];
          }

          // Toggle panel visibility
          panels.forEach((p) => {
            p.classList.add("hidden");
            p.classList.remove("active");
          });
          if (targetPanel) {
            targetPanel.classList.remove("hidden");
            targetPanel.classList.add("active");
          }
        });
      });
    });
  }

  const PartyBridge = {
    getSession() {
      const params = new URLSearchParams(window.location.search);
      const roomCode = (
        params.get("room") ||
        params.get("code") ||
        sessionStorage.getItem("party_room_code") ||
        localStorage.getItem("party_room_code") ||
        ""
      ).trim().toUpperCase();
      const playerId = (
        params.get("player") ||
        params.get("playerId") ||
        sessionStorage.getItem("party_player_id") ||
        localStorage.getItem("party_player_id") ||
        ""
      ).trim();
      const hostToken = (
        sessionStorage.getItem("party_host_token") ||
        localStorage.getItem("party_host_token") ||
        ""
      ).trim();
      const playerName = (
        sessionStorage.getItem("party_player_name") ||
        localStorage.getItem("party_player_name") ||
        getSavedName() ||
        "Spiller"
      ).trim();
      const avatar = (
        sessionStorage.getItem("party_avatar") ||
        localStorage.getItem("party_avatar") ||
        getSavedAvatar()
      ).trim();

      return {
        roomCode,
        playerId,
        hostToken,
        playerName,
        avatar,
        isHost: Boolean(hostToken),
      };
    },

    saveSession(data = {}) {
      if (data.roomCode) {
        sessionStorage.setItem("party_room_code", data.roomCode);
        localStorage.setItem("party_room_code", data.roomCode);
      }
      if (data.playerId) {
        sessionStorage.setItem("party_player_id", data.playerId);
        localStorage.setItem("party_player_id", data.playerId);
      }
      if (data.hostToken) {
        sessionStorage.setItem("party_host_token", data.hostToken);
        localStorage.setItem("party_host_token", data.hostToken);
      }
      if (data.playerName) {
        sessionStorage.setItem("party_player_name", data.playerName);
        localStorage.setItem("party_player_name", data.playerName);
      }
      if (data.avatar) {
        sessionStorage.setItem("party_avatar", data.avatar);
        localStorage.setItem("party_avatar", data.avatar);
      }
    },

    leaveToLounge(options = {}) {
      const sess = this.getSession();
      const code = options.roomCode || sess.roomCode;
      const pid = options.playerId || sess.playerId;
      const hostToken = options.hostToken || sess.hostToken;

      if (options.beforeLeave && typeof options.beforeLeave === "function") {
        try {
          options.beforeLeave();
        } catch (_) {}
      }

      if (code) {
        try {
          sessionStorage.setItem("party_just_left", code);
          sessionStorage.setItem("party_room_code", code);
          if (pid) sessionStorage.setItem("party_player_id", pid);
        } catch (_) {}

        try {
          fetch("/api/party/to-lounge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            keepalive: true,
            body: JSON.stringify({ roomCode: code, playerId: pid, hostToken }),
          });
        } catch (_) {}

        window.location.replace(`/party/?room=${encodeURIComponent(code)}&player=${encodeURIComponent(pid)}`);
        return;
      }

      window.location.replace("/party/");
    },

    bindLeaveButton(elem, options = {}) {
      if (!elem || elem.dataset.boundPartyBridgeLeave) return;
      elem.dataset.boundPartyBridgeLeave = "true";
      const handler = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        this.leaveToLounge(options);
      };
      elem.addEventListener("pointerdown", handler);
      elem.addEventListener("click", handler);
    },
  };

  // Define Custom Web Component: <party-online-panel>
  if (typeof customElements !== "undefined" && typeof HTMLElement !== "undefined" && !customElements.get("party-online-panel")) {
    class PartyOnlinePanel extends HTMLElement {
      connectedCallback() {
        const gameId = this.getAttribute("game") || this.getAttribute("data-game") || detectGameId(this);
        mountOnlinePanel(this, { gameId });
      }
    }
    customElements.define("party-online-panel", PartyOnlinePanel);
  }

  window.PartyConnect = {
    createParty,
    joinParty,
    init,
    mount: mountOnlinePanel,
    mountOnlinePanel,
    renderOnlineDeck: getOnlineDeckHTML,
    getOnlineDeckHTML,
    initTabs,
    getSavedName,
    getSavedAvatar,
    detectGameId,
  };

  window.PartyBridge = PartyBridge;

  // Auto-init and mount on DOMContentLoaded
  function autoInit() {
    // 1. Mount any <party-online-panel> or [data-party-panel]
    const declarativePanels = document.querySelectorAll("party-online-panel, [data-party-panel]");
    declarativePanels.forEach((panel) => {
      mountOnlinePanel(panel);
    });

    // 2. Check for empty #panelOnline or #panelLobbyRoom
    const defaultOnlinePanels = document.querySelectorAll("#panelOnline, #panelLobbyRoom");
    defaultOnlinePanels.forEach((panel) => {
      if (!panel.querySelector("#btnCreatePartyRoom")) {
        mountOnlinePanel(panel);
      } else {
        const gameAttr = detectGameId(panel);
        init({ gameId: gameAttr, container: panel });
      }
    });

    // 3. Bind any loose buttons if already in DOM
    if (document.getElementById("btnCreatePartyRoom") || document.getElementById("btnJoinPartyRoom")) {
      const gameAttr = detectGameId();
      init({ gameId: gameAttr });
    }

    // 4. Initialize tab switching
    initTabs();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit);
  } else {
    autoInit();
  }
})();
