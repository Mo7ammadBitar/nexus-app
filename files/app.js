/**
 * app.js — Application bootstrap.
 * Wires up all UI interactions and initializes the app.
 */

document.addEventListener("DOMContentLoaded", async () => {

  // ── LOAD SAVED PREFERENCES ─────────────────────────
  UI.loadTheme();

  const savedSound = localStorage.getItem("rps-sound");
  if (savedSound !== null) {
    const on = savedSound === "true";
    Sounds.setEnabled(on);
    document.getElementById("sound-toggle").checked = on;
    document.getElementById("btn-sound").textContent = on ? "🔊" : "🔇";
  }

  const savedDiff = localStorage.getItem("rps-difficulty") || "medium";
  Game.setDifficulty(savedDiff);
  document.querySelectorAll("#difficulty-control .seg-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.val === savedDiff);
  });

  // ── CHECK BACKEND ──────────────────────────────────
  try {
    await API.health();
    await UI.refreshHomeStats();
  } catch (e) {
    UI.showOfflineBanner();
    console.warn("Backend not reachable. Start it with: python3 backend/app.py");
  }

  // ── HOME SCREEN ────────────────────────────────────
  document.getElementById("btn-pvc").addEventListener("click", () => {
    Sounds.click();
    Game.startGame("pvc");
  });

  document.getElementById("btn-pvp").addEventListener("click", () => {
    Sounds.click();
    Game.startGame("pvp");
  });

  // ── GAME SCREEN ────────────────────────────────────
  document.querySelectorAll(".move-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      Game.onMove(btn.dataset.move);
    });
  });

  document.getElementById("btn-back").addEventListener("click", () => {
    Sounds.navigate();
    UI.showScreen("screen-home");
    UI.refreshHomeStats();
  });

  document.getElementById("btn-reset").addEventListener("click", () => {
    Sounds.click();
    Game.resetSession();
  });

  // ── TITLEBAR BUTTONS ───────────────────────────────

  // Theme toggle
  document.getElementById("btn-theme").addEventListener("click", () => {
    const cur  = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    UI.setTheme(next);
    Sounds.click();
    // Sync settings panel
    document.querySelectorAll("#theme-control .seg-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.val === next);
    });
  });

  // Sound toggle (quick)
  document.getElementById("btn-sound").addEventListener("click", () => {
    const newVal = !Sounds.isEnabled();
    Sounds.setEnabled(newVal);
    document.getElementById("btn-sound").textContent   = newVal ? "🔊" : "🔇";
    document.getElementById("sound-toggle").checked    = newVal;
    localStorage.setItem("rps-sound", newVal);
    if (newVal) Sounds.click();
  });

  // History
  document.getElementById("btn-history").addEventListener("click", () => {
    Sounds.click();
    UI.loadHistory(Game.getSessionId());
  });

  // Achievements
  document.getElementById("btn-achiev").addEventListener("click", () => {
    Sounds.click();
    UI.loadAchievements();
  });

  // Settings
  document.getElementById("btn-settings").addEventListener("click", () => {
    Sounds.click();
    UI.openModal("modal-settings");
  });

  // ── SETTINGS PANEL ─────────────────────────────────

  // Difficulty segmented control
  document.querySelectorAll("#difficulty-control .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#difficulty-control .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      Game.setDifficulty(btn.dataset.val);
      localStorage.setItem("rps-difficulty", btn.dataset.val);
      Sounds.click();
    });
  });

  // Sound toggle (settings panel)
  document.getElementById("sound-toggle").addEventListener("change", (e) => {
    Sounds.setEnabled(e.target.checked);
    document.getElementById("btn-sound").textContent = e.target.checked ? "🔊" : "🔇";
    localStorage.setItem("rps-sound", e.target.checked);
  });

  // Theme segmented control (settings panel)
  document.querySelectorAll("#theme-control .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#theme-control .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      UI.setTheme(btn.dataset.val);
      Sounds.click();
    });
  });

  // ── KEYBOARD SHORTCUTS ─────────────────────────────
  document.addEventListener("keydown", (e) => {
    // Move shortcuts in game screen
    if (document.getElementById("screen-game").classList.contains("active")) {
      if (e.key === "1" || e.key.toLowerCase() === "r") Game.onMove("rock");
      if (e.key === "2" || e.key.toLowerCase() === "p") Game.onMove("paper");
      if (e.key === "3" || e.key.toLowerCase() === "s") Game.onMove("scissors");
      if (e.key === "Escape") {
        UI.showScreen("screen-home");
        UI.refreshHomeStats();
      }
    }
    // Close modals with Escape
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay:not(.hidden)").forEach(m => {
        UI.closeModal(m.id);
      });
    }
  });

  // ── PERIODIC STATS REFRESH ─────────────────────────
  setInterval(() => {
    if (document.getElementById("screen-home").classList.contains("active")) {
      UI.refreshHomeStats();
    }
  }, 10000);

});
