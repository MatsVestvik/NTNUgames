(() => {
  "use strict";

  const STORAGE_PREFIX = "kattfisking_daily_v1_";

  // Lock to dark theme permanently
  document.documentElement.setAttribute("data-theme", "dark");

  // Date formatting in Norwegian
  const dateBadge = document.getElementById("hubDateBadge");
  const today = new Date();
  const dateFormatted = today.toLocaleDateString("no-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  if (dateBadge) {
    // Capitalize first letter of weekday
    dateBadge.textContent = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);
  }

  // ISO date for checking localStorage: YYYY-MM-DD
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayIso = `${yyyy}-${mm}-${dd}`;

  // 1. Check Kattfisking completion & score indicator
  const cardKattfisking = document.getElementById("cardKattfisking");
  const kattfiskingStatus = document.getElementById("kattfiskingStatus");
  const kattfiskingBtn = document.getElementById("kattfiskingBtn");
  const kattfiskingPlayedBadge = document.getElementById("kattfiskingPlayedBadge");
  const kattfiskingScoreBadge = document.getElementById("kattfiskingScoreBadge");

  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + todayIso);
    if (raw) {
      const data = JSON.parse(raw);
      const isFinished = Boolean(
        data && (data.submittedToServer || (Array.isArray(data.progress) && data.progress.length > 0 && data.progress.every(p => p.status !== "pending")))
      );
      if (isFinished) {
        const solved = (data.progress || []).filter(p => p.status === "solved" || p.status === "half").length;
        const total = (data.progress || []).length || 5;

        if (cardKattfisking) {
          cardKattfisking.classList.add("daily-played");
          cardKattfisking.href = "/kattfisking/?result=1";
        }
        if (kattfiskingPlayedBadge) {
          kattfiskingPlayedBadge.classList.remove("hidden");
          if (kattfiskingScoreBadge) kattfiskingScoreBadge.textContent = `${solved}/${total}`;
        }
        if (kattfiskingStatus) {
          kattfiskingStatus.textContent = `✓ Spilt i dag (${solved}/${total} riktige)`;
          kattfiskingStatus.classList.add("completed");
        }
        if (kattfiskingBtn) {
          kattfiskingBtn.textContent = "Se resultat →";
        }
      }
    }
  } catch (e) {
    console.warn("Could not check local storage for kattfisking progress", e);
  }

  // 2. Check Mer eller Mindre Completion and Status
  const cardMerMindre = document.getElementById("cardMerMindre");
  const merMindreStatus = document.getElementById("merMindreStatus");
  const merMindreBtn = document.getElementById("merMindreBtn");
  const merMindrePlayedBadge = document.getElementById("merMindrePlayedBadge");
  const merMindreScoreBadge = document.getElementById("merMindreScoreBadge");

  try {
    const rawMM25 = localStorage.getItem("mer_eller_mindre_25_daily_" + todayIso) || localStorage.getItem("mer_eller_mindre_daily_" + todayIso);
    if (rawMM25) {
      const dataMM = JSON.parse(rawMM25);
      if (dataMM && typeof dataMM.score === "number") {
        const maxScore = dataMM.total || 25;
        const score = dataMM.score;

        if (cardMerMindre) {
          cardMerMindre.classList.add("daily-played");
          cardMerMindre.href = "/mer-eller-mindre/?result=1";
        }
        if (merMindrePlayedBadge) {
          merMindrePlayedBadge.classList.remove("hidden");
          if (merMindreScoreBadge) merMindreScoreBadge.textContent = `${score}/${maxScore}`;
        }
        if (merMindreStatus) {
          merMindreStatus.textContent = `✓ Spilt i dag (${score}/${maxScore} poeng)`;
          merMindreStatus.classList.add("completed");
        }
        if (merMindreBtn) {
          merMindreBtn.textContent = "Se resultat →";
        }
      }
    } else {
      const hs = localStorage.getItem("mer_eller_mindre_25_highscore") || localStorage.getItem("mer_eller_mindre_highscore");
      if (hs && merMindreStatus) {
        merMindreStatus.textContent = `Beste: ${hs} poeng`;
      }
    }
  } catch (e) {
    console.warn("Could not check mer eller mindre progress", e);
  }

  // Check Ordbombe Highscore & Party Status
  const ordbombeStatus = document.getElementById("ordbombeStatus");
  try {
    const obHs = localStorage.getItem("ordbombe_highscore");
    if (obHs && parseInt(obHs, 10) > 0) {
      const score = parseInt(obHs, 10);
      if (ordbombeStatus) {
        ordbombeStatus.textContent = `Beste solo: ${score} ord`;
      }
    }
  } catch (e) {
    console.warn("Could not check ordbombe progress", e);
  }

  // Category quick filter tabs
  const tabButtons = document.querySelectorAll(".hub-tab-btn[data-filter]");
  const sections = document.querySelectorAll(".game-category-section");
  const allGameCards = document.querySelectorAll(".game-card");
  const grids = document.querySelectorAll(".games-grid");

  // Record original order and text for all cards
  grids.forEach(grid => {
    const cards = Array.from(grid.querySelectorAll(".game-card"));
    cards.forEach((card, idx) => {
      card.dataset.origOrder = String(idx);
      const btn = card.querySelector(".card-btn");
      if (btn) btn.dataset.origBtnText = btn.textContent;
    });
  });

  // Hub Toast notification for disabled games
  function showHubToast(msg) {
    let toast = document.getElementById("hubToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "hubToast";
      toast.className = "hub-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2500);
  }

  // Intercept clicks on disabled cards
  allGameCards.forEach(card => {
    card.addEventListener("click", (e) => {
      if (card.classList.contains("card-disabled-players")) {
        e.preventDefault();
        e.stopPropagation();
        const min = card.dataset.minPlayers || "2";
        showHubToast(`Dette spillet krever minst ${min} spillere.`);
      }
    });
  });

  // Filter and move disabled cards to the bottom based on player count
  let currentSelectedPlayers = "all";

  function applyPlayerCountFilter(count) {
    currentSelectedPlayers = count;
    grids.forEach(grid => {
      const cards = Array.from(grid.querySelectorAll(".game-card"));
      const enabledCards = [];
      const disabledCards = [];

      cards.forEach(card => {
        const min = parseInt(card.dataset.minPlayers || "1", 10);
        const btn = card.querySelector(".card-btn");
        const tagsGroup = card.querySelector(".card-tags-group");

        const isPassAndPlay = Boolean(card.dataset.tags && card.dataset.tags.includes("pass-and-play"));
        const isDisabled = !isPassAndPlay && (count !== "all" && parseInt(count, 10) < min);

        if (isDisabled) {
          card.classList.add("card-disabled-players");
          card.style.order = "99";
          if (btn) {
            btn.textContent = `Trenger ${min} spillere`;
          }
          if (tagsGroup && !tagsGroup.querySelector(".tag-needed-players")) {
            const badge = document.createElement("span");
            badge.className = "card-tag tag-needed-players";
            badge.textContent = `Trenger ${min} spillere`;
            tagsGroup.appendChild(badge);
          }
          disabledCards.push(card);
        } else {
          card.classList.remove("card-disabled-players");
          card.style.order = "1";
          if (btn && btn.dataset.origBtnText) {
            btn.textContent = btn.dataset.origBtnText;
          }
          if (tagsGroup) {
            const neededBadge = tagsGroup.querySelector(".tag-needed-players");
            if (neededBadge) neededBadge.remove();
          }
          enabledCards.push(card);
        }
      });

      // Preserve relative original order within enabled and disabled groups
      enabledCards.sort((a, b) => parseInt(a.dataset.origOrder || "0", 10) - parseInt(b.dataset.origOrder || "0", 10));
      disabledCards.sort((a, b) => parseInt(a.dataset.origOrder || "0", 10) - parseInt(b.dataset.origOrder || "0", 10));

      // Physically re-append in DOM: enabled first, disabled at bottom
      [...enabledCards, ...disabledCards].forEach(c => grid.appendChild(c));
    });
  }

  // Player count filter pill buttons
  const playerFilterButtons = document.querySelectorAll(".hub-player-btn[data-player-count]");
  playerFilterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const count = btn.dataset.playerCount;
      playerFilterButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      try {
        localStorage.setItem("ntnu_hub_player_filter", count);
      } catch (e) {}
      applyPlayerCountFilter(count);
    });
  });

  // Init player filter
  let initialPlayerCount = "all";
  try {
    const partyRoom = sessionStorage.getItem("party_room_code");
    const partyCount = sessionStorage.getItem("party_player_count");
    const savedFilter = localStorage.getItem("ntnu_hub_player_filter");
    if (partyRoom && partyCount) {
      initialPlayerCount = parseInt(partyCount, 10) >= 3 ? "3" : String(partyCount);
    } else if (savedFilter) {
      initialPlayerCount = savedFilter;
    }
  } catch (e) {}

  if (initialPlayerCount !== "all") {
    const targetBtn = document.querySelector(`.hub-player-btn[data-player-count="${initialPlayerCount}"]`);
    if (targetBtn) {
      playerFilterButtons.forEach(b => b.classList.remove("active"));
      targetBtn.classList.add("active");
    }
  }
  applyPlayerCountFilter(initialPlayerCount);

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const filter = btn.dataset.filter;
      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // Reset individual game cards
      allGameCards.forEach(card => card.classList.remove("hidden"));

      sections.forEach(sec => {
        const secCat = sec.dataset.sectionCategory;
        if (filter === "pass-and-play") {
          if (secCat === "party") {
            sec.classList.remove("hidden");
            allGameCards.forEach(card => {
              const hasTag = card.dataset.tags && card.dataset.tags.includes("pass-and-play");
              if (hasTag) {
                card.classList.remove("hidden");
              } else {
                card.classList.add("hidden");
              }
            });
          } else {
            sec.classList.add("hidden");
          }
        } else if (filter === "all" || secCat === filter) {
          sec.classList.remove("hidden");
          sec.style.opacity = "0";
          sec.style.transform = "translateY(8px)";
          setTimeout(() => {
            sec.style.transition = "opacity 0.25s ease, transform 0.25s ease";
            sec.style.opacity = "1";
            sec.style.transform = "translateY(0)";
          }, 10);
        } else {
          sec.classList.add("hidden");
        }
      });
    });
  });

  // Party Lounge Random Figure with Character Creator
  const plBannerIconImg = document.getElementById("plBannerIconImg");

  async function updatePartyLoungeAvatar() {
    if (typeof CharacterCreator === "undefined") return;
    try {
      const randomCfg = CharacterCreator.getRandomConfig();
      const dataUrl = await CharacterCreator.getDataUrl(randomCfg);
      if (plBannerIconImg) {
        plBannerIconImg.src = dataUrl;
        plBannerIconImg.style.opacity = "1";
      }
    } catch (e) {
      console.warn("Could not generate random figure for party lounge:", e);
    }
  }

  if (typeof CharacterCreator !== "undefined") {
    updatePartyLoungeAvatar();
  } else {
    window.addEventListener("DOMContentLoaded", updatePartyLoungeAvatar);
  }

  if (plBannerIconImg) {
    plBannerIconImg.style.cursor = "pointer";
    plBannerIconImg.title = "Tilfeldig spillfigur (klikk for ny figur!)";
    plBannerIconImg.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      plBannerIconImg.style.transform = "scale(0.85) rotate(12deg)";
      setTimeout(() => {
        plBannerIconImg.style.transform = "";
        updatePartyLoungeAvatar();
      }, 150);
    });
  }
})();
