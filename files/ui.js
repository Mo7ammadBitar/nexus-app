/**
 * ui.js — UI helpers: screen transitions, modals, toasts, etc.
 */

const UI = (() => {
  // ── SCREEN NAVIGATION ──────────────────────────────
  let currentScreen = "screen-home";

  function showScreen(id) {
    const prev = document.getElementById(currentScreen);
    const next = document.getElementById(id);
    if (!next || id === currentScreen) return;

    prev?.classList.add("exit");
    setTimeout(() => {
      prev?.classList.remove("active", "exit");
    }, 350);

    next.classList.add("active");
    currentScreen = id;
    Sounds.navigate();
  }

  // ── MODALS ─────────────────────────────────────────
  function openModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove("hidden");
      Sounds.navigate();
    }
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  }

  // Close on overlay click
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // Close buttons
  document.querySelectorAll(".modal-close").forEach(btn => {
    btn.addEventListener("click", () => closeModal(btn.dataset.modal));
  });

  // ── ACHIEVEMENT TOAST ──────────────────────────────
  let toastTimeout = null;

  function showAchievementToast(ach) {
    const toast = document.getElementById("achievement-toast");
    document.getElementById("at-icon").textContent = ach.icon;
    document.getElementById("at-name").textContent = ach.name;
    document.getElementById("at-desc").textContent = ach.description;

    toast.classList.remove("hidden");
    Sounds.achievement();

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.add("hidden"), 4000);
  }

  // ── RESULT FLASH ──────────────────────────────────
  function flashResult(result) {
    const div = document.createElement("div");
    div.className = `result-flash ${result}`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 500);
  }

  // ── SCORE BUMP ANIMATION ──────────────────────────
  function bumpScore(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("bump");
    void el.offsetWidth; // reflow
    el.classList.add("bump");
    setTimeout(() => el.classList.remove("bump"), 500);
  }

  // ── CHOICE DISPLAY UPDATE ─────────────────────────
  function setChoiceDisplay(side, emoji, name, state = "") {
    // side: "p1" | "p2"
    const display = document.getElementById(`${side}-display`);
    const emojiEl = document.getElementById(`${side}-emoji`);
    const nameEl  = document.getElementById(`${side}-name`);

    // Remove old states
    display.classList.remove("win-state", "lose-state", "draw-state", "revealed");

    emojiEl.textContent = emoji;
    nameEl.textContent  = name;

    // Trigger reveal animation
    void display.offsetWidth;
    display.classList.add("revealed");
    if (state) display.classList.add(`${state}-state`);
  }

  // ── RESULT BANNER ─────────────────────────────────
  function setResultBanner(text, cls = "") {
    const banner = document.getElementById("result-banner");
    const textEl = document.getElementById("result-text");
    banner.className = `result-banner ${cls}`;
    textEl.textContent = text;
  }

  // ── RECENT ROUNDS ─────────────────────────────────
  let roundCounter = 0;

  function addRecentRound(p1Emoji, p2Emoji, result) {
    roundCounter++;
    const list = document.getElementById("rr-list");

    // Remove empty state
    const empty = list.querySelector(".rr-empty");
    if (empty) empty.remove();

    const item = document.createElement("div");
    item.className = "rr-item";
    item.innerHTML = `
      <span class="rr-num">#${roundCounter}</span>
      <span class="rr-moves">${p1Emoji} vs ${p2Emoji}</span>
      <span class="rr-result ${result}">${result.toUpperCase()}</span>
    `;
    list.prepend(item);

    // Trim to last 5
    while (list.children.length > 5) list.lastChild.remove();
  }

  function clearRecentRounds() {
    roundCounter = 0;
    const list = document.getElementById("rr-list");
    list.innerHTML = '<div class="rr-empty">No rounds yet — make your move!</div>';
  }

  // ── SCOREBOARD UPDATE ─────────────────────────────
  function updateScoreboard(session) {
    const p1 = document.getElementById("score-p1");
    const p2 = document.getElementById("score-p2");
    const dr = document.getElementById("score-draws");
    const rn = document.getElementById("round-num");

    if (parseInt(p1.textContent) !== session.player1_score) bumpScore("score-p1");
    if (parseInt(p2.textContent) !== session.player2_score) bumpScore("score-p2");

    p1.textContent = session.player1_score;
    p2.textContent = session.player2_score;
    dr.textContent = session.draws;
    rn.textContent = session.rounds + 1;
  }

  // ── HISTORY MODAL ─────────────────────────────────
  async function loadHistory(sessionId) {
    const body = document.getElementById("history-body");
    body.innerHTML = '<div class="loading-spinner"></div>';
    openModal("modal-history");

    try {
      const { matches } = await API.history(sessionId, 50);
      if (!matches.length) {
        body.innerHTML = '<p style="text-align:center;color:var(--text3);padding:32px">No history yet.</p>';
        return;
      }
      body.innerHTML = matches.map(m => {
        const dt = new Date(m.timestamp).toLocaleTimeString();
        return `
          <div class="history-item">
            <span class="hi-moves">${m.player1_emoji} <span class="hi-vs">vs</span> ${m.player2_emoji}</span>
            <span class="hi-result ${m.result}">${m.result.toUpperCase()}</span>
            <span class="hi-time">${dt}</span>
          </div>
        `;
      }).join("");
    } catch (e) {
      body.innerHTML = `<p style="color:var(--lose);text-align:center;padding:20px">Error: ${e.message}</p>`;
    }
  }

  // ── ACHIEVEMENTS MODAL ────────────────────────────
  async function loadAchievements() {
    const body = document.getElementById("achievements-body");
    body.innerHTML = '<div class="loading-spinner"></div>';
    openModal("modal-achievements");

    try {
      const { achievements } = await API.achievements();
      const unlocked = achievements.filter(a => a.unlocked);
      const locked   = achievements.filter(a => !a.unlocked);

      body.innerHTML = `
        <p style="font-size:12px;color:var(--text2);margin-bottom:14px;">
          ${unlocked.length} / ${achievements.length} unlocked
        </p>
        <div class="ach-grid">
          ${[...unlocked, ...locked].map(a => `
            <div class="ach-card ${a.unlocked ? "unlocked" : "locked"}">
              <div class="ach-icon">${a.icon}</div>
              <div class="ach-info">
                <div class="ach-name">${a.name}</div>
                <div class="ach-desc">${a.description}</div>
              </div>
            </div>
          `).join("")}
        </div>
      `;
    } catch (e) {
      body.innerHTML = `<p style="color:var(--lose);text-align:center;padding:20px">Error: ${e.message}</p>`;
    }
  }

  // ── HOME STATS ────────────────────────────────────
  async function refreshHomeStats() {
    try {
      const s = await API.stats();
      document.getElementById("hs-wins").textContent   = s.wins;
      document.getElementById("hs-losses").textContent = s.losses;
      document.getElementById("hs-draws").textContent  = s.draws;
      document.getElementById("hs-rate").textContent   = `${s.win_rate}%`;
    } catch (e) { /* backend not ready yet */ }
  }

  // ── OFFLINE BANNER ────────────────────────────────
  function showOfflineBanner() {
    document.getElementById("offline-banner").classList.remove("hidden");
    setTimeout(() => document.getElementById("offline-banner").classList.add("hidden"), 4000);
  }

  // ── THEME ─────────────────────────────────────────
  function setTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    document.getElementById("btn-theme").textContent = t === "dark" ? "🌙" : "☀️";
    localStorage.setItem("rps-theme", t);
  }

  function loadTheme() {
    const saved = localStorage.getItem("rps-theme") || "dark";
    setTheme(saved);
    const ctrl = document.getElementById("theme-control");
    ctrl.querySelectorAll(".seg-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.val === saved);
    });
  }

  return {
    showScreen, openModal, closeModal,
    showAchievementToast, flashResult,
    setChoiceDisplay, setResultBanner,
    addRecentRound, clearRecentRounds,
    updateScoreboard,
    loadHistory, loadAchievements, refreshHomeStats,
    showOfflineBanner, setTheme, loadTheme,
  };
})();
