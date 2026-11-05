/**
 * NTNU Games – Standardized Party Lobby Client Module
 * Provides unified Party creation and joining across all games' "Nettspill" tabs.
 */

(function () {
  "use strict";

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

  async function createParty({ hostName, avatar, preferredGame, btnElement } = {}) {
    const name = (hostName || getSavedName() || "Vert").trim();
    const av = avatar || getSavedAvatar();

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

      if (preferredGame) {
        sessionStorage.setItem("party_preferred_game", preferredGame);
      }

      const dest = `/party/?room=${encodeURIComponent(data.roomCode)}${preferredGame ? `&game=${encodeURIComponent(preferredGame)}` : ""}`;
      window.location.href = dest;
    } catch (err) {
      console.error("Party create error:", err);
      alert("Nettverksfeil ved opprettelse av rom.");
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.textContent = oldText || "Opprett party-rom 🎉";
      }
    }
  }

  async function joinParty({ roomCode, playerName, avatar, btnElement } = {}) {
    const code = (roomCode || "").trim().toUpperCase();
    if (!code) {
      alert("Vennligst skriv inn en 4-bokstavs romkode.");
      return;
    }

    const name = (playerName || getSavedName() || "Spiller").trim();
    const av = avatar || getSavedAvatar();

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
        body: JSON.stringify({ roomCode: code, playerName: name, avatar: av }),
      });
      const data = await resp.json();
      if (!data.ok) {
        alert(data.error || "Fant ikke party-rommet. Sjekk koden og prøv igjen.");
        if (btnElement) {
          btnElement.disabled = false;
          btnElement.textContent = oldText || "Bli med i festen 🚀";
        }
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

      window.location.href = `/party/?room=${encodeURIComponent(data.roomCode)}`;
    } catch (err) {
      console.error("Party join error:", err);
      alert("Nettverksfeil ved tilkobling til rom.");
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.textContent = oldText || "Bli med i festen 🚀";
      }
    }
  }

  function init({
    gameId = "",
    createBtnId = "btnCreatePartyRoom",
    joinBtnId = "btnJoinPartyRoom",
    hostInputId = "inputPartyHostName",
    joinInputId = "inputPartyJoinName",
    codeInputId = "inputPartyRoomCode",
  } = {}) {
    const saved = getSavedName();

    const hostInput = document.getElementById(hostInputId);
    if (hostInput && saved && !hostInput.value) {
      hostInput.value = saved;
    }

    const joinInput = document.getElementById(joinInputId);
    if (joinInput && saved && !joinInput.value) {
      joinInput.value = saved;
    }

    // Keep host and join name inputs in sync if user changes one
    if (hostInput && joinInput) {
      hostInput.addEventListener("input", () => {
        if (!joinInput.value || joinInput.value === hostInput.defaultValue) {
          joinInput.value = hostInput.value;
        }
      });
    }

    const codeInput = document.getElementById(codeInputId);
    if (codeInput) {
      codeInput.addEventListener("input", () => {
        codeInput.value = codeInput.value.toUpperCase().replace(/\s+/g, "");
      });
      codeInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const btn = document.getElementById(joinBtnId);
          if (btn) btn.click();
        }
      });
    }

    const createBtn = document.getElementById(createBtnId);
    if (createBtn) {
      createBtn.addEventListener("click", () => {
        const hostName = hostInput ? hostInput.value : "";
        createParty({ hostName, preferredGame: gameId, btnElement: createBtn });
      });
    }

    const joinBtn = document.getElementById(joinBtnId);
    if (joinBtn) {
      joinBtn.addEventListener("click", () => {
        const roomCode = codeInput ? codeInput.value : "";
        const playerName = joinInput ? joinInput.value : (hostInput ? hostInput.value : "");
        joinParty({ roomCode, playerName, btnElement: joinBtn });
      });
    }
  }

  window.PartyConnect = {
    createParty,
    joinParty,
    init,
    getSavedName,
    getSavedAvatar,
  };

  // Auto-init on DOMContentLoaded if standard IDs are found
  function autoInit() {
    if (document.getElementById("btnCreatePartyRoom") || document.getElementById("btnJoinPartyRoom")) {
      const gameAttr = document.querySelector("[data-game-id]")?.getAttribute("data-game-id") || "";
      init({ gameId: gameAttr });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit);
  } else {
    autoInit();
  }
})();

