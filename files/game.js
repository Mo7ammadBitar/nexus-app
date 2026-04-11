/**
 * game.js — Core game state machine.
 * Handles PvC and PvP flows, round processing, and result rendering.
 */

const Game = (() => {
  // ── STATE ──────────────────────────────────────────
  let state = {
    mode:       "pvc",       // pvc | pvp
    difficulty: "medium",    // easy | medium | hard
    sessionId:  null,
    pvpStep:    1,           // 1 = p1's turn, 2 = p2's turn (pvp only)
    p1TmpMove:  null,        // p1's stored move (pvp)
    locked:     false,       // prevent double-click
  };

  // ── INIT ──────────────────────────────────────────
  async function startGame(mode) {
    state.mode      = mode;
    state.pvpStep   = 1;
    state.p1TmpMove = null;
    state.locked    = false;

    UI.clearRecentRounds();

    // Reset displays
    UI.setChoiceDisplay("p1", "❓", "Waiting…");
    UI.setChoiceDisplay("p2", "❓", "Waiting…");
    UI.setResultBanner("Make your move!", "");

    // Labels
    document.getElementById("label-p1").textContent = "You";
    document.getElementById("label-p2").textContent = mode === "pvc" ? "CPU" : "P2";
    document.getElementById("game-mode-badge").textContent = mode === "pvc" ? "vs Computer" : "vs Player";

    // Create backend session
    try {
      const { session_id } = await API.newSession(mode);
      state.sessionId = session_id;
    } catch (e) {
      UI.showOfflineBanner();
      state.sessionId = `local_${Date.now()}`;
    }

    // Scoreboard
    document.getElementById("score-p1").textContent    = "0";
    document.getElementById("score-p2").textContent    = "0";
    document.getElementById("score-draws").textContent = "0";
    document.getElementById("round-num").textContent   = "1";

    // PvP UI
    const pvpPrompt = document.getElementById("pvp-prompt");
    const pvpSteps  = document.getElementById("pvp-steps");
    if (mode === "pvp") {
      pvpPrompt.classList.remove("hidden");
      pvpSteps.classList.remove("hidden");
      setPvpStep(1);
    } else {
      pvpPrompt.classList.add("hidden");
      pvpSteps.classList.add("hidden");
    }

    setButtonsEnabled(true);
    UI.showScreen("screen-game");
  }

  // ── PVP STEP ──────────────────────────────────────
  function setPvpStep(step) {
    state.pvpStep = step;
    document.getElementById("pvp-step-1").className = `pvp-step ${step === 1 ? "active" : "done"}`;
    document.getElementById("pvp-step-2").className = `pvp-step ${step === 2 ? "active" : step > 2 ? "done" : ""}`;
    document.getElementById("pvp-prompt-text").textContent =
      step === 1 ? "Player 1: make your secret move" : "Player 2: make your secret move";
  }

  // ── MOVE HANDLER ──────────────────────────────────
  async function onMove(move) {
    if (state.locked) return;

    Sounds.select();

    // Highlight selected button
    document.querySelectorAll(".move-btn").forEach(b => {
      b.classList.toggle("selected", b.dataset.move === move);
    });

    if (state.mode === "pvc") {
      await playRound(move, null);
    } else {
      await handlePvpMove(move);
    }
  }

  async function handlePvpMove(move) {
    if (state.pvpStep === 1) {
      // Store P1's move, ask for P2
      state.p1TmpMove = move;
      UI.setChoiceDisplay("p1", "🤫", "Chosen!");
      UI.setResultBanner("P1 locked in — P2's turn!", "");
      setPvpStep(2);

      // Brief lock then re-enable
      setButtonsEnabled(false);
      setTimeout(() => {
        document.querySelectorAll(".move-btn").forEach(b => b.classList.remove("selected"));
        setButtonsEnabled(true);
      }, 600);
    } else {
      // P2 has moved — play the round
      await playRound(state.p1TmpMove, move);
      state.p1TmpMove = null;
      setPvpStep(1);
    }
  }

  // ── PLAY ROUND ────────────────────────────────────
  async function playRound(p1Move, p2Move) {
    state.locked = true;
    setButtonsEnabled(false);

    // Show spinning animations while waiting
    UI.setChoiceDisplay("p1", "⏳", "Thinking…");
    UI.setChoiceDisplay("p2", "⏳", "Thinking…");
    UI.setResultBanner("…", "");

    try {
      const data = await API.play(
        state.sessionId, p1Move, state.mode, state.difficulty, p2Move
      );

      // Short suspense delay
      await delay(350);

      // Reveal choices
      const p1State = data.result === "win" ? "win" : data.result === "lose" ? "lose" : "draw";
      const p2State = data.result === "lose" ? "win" : data.result === "win" ? "lose" : "draw";

      UI.setChoiceDisplay("p1", data.player1_emoji, capitalize(data.player1_move), p1State);
      UI.setChoiceDisplay("p2", data.player2_emoji, capitalize(data.player2_move), p2State);

      // Result banner
      UI.setResultBanner(data.result_text, data.result);
      UI.flashResult(data.result);

      // Sound
      if (data.result === "win")       Sounds.win();
      else if (data.result === "lose") Sounds.lose();
      else                             Sounds.draw();

      // Update scoreboard
      UI.updateScoreboard(data.session);

      // Recent rounds
      UI.addRecentRound(data.player1_emoji, data.player2_emoji, data.result);

      // Achievements
      if (data.new_achievements?.length) {
        data.new_achievements.forEach((a, i) => {
          setTimeout(() => UI.showAchievementToast(a), i * 1200);
        });
      }

      // Re-enable after result shown
      await delay(800);

    } catch (e) {
      UI.showOfflineBanner();
      UI.setResultBanner("Connection error", "");
      console.error("Play error:", e);
    }

    // Reset UI for next round
    document.querySelectorAll(".move-btn").forEach(b => b.classList.remove("selected"));

    if (state.mode === "pvp") setPvpStep(1);

    state.locked = false;
    setButtonsEnabled(true);
  }

  // ── RESET ─────────────────────────────────────────
  async function resetSession() {
    if (!confirm("Reset scores and history for this session?")) return;

    Sounds.reset();
    try {
      await API.reset(state.sessionId);
    } catch (e) { /* offline */ }

    // Re-init (same mode)
    await startGame(state.mode);
  }

  // ── HELPERS ──────────────────────────────────────
  function setButtonsEnabled(enabled) {
    document.querySelectorAll(".move-btn").forEach(b => (b.disabled = !enabled));
  }

  function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  function setDifficulty(d) { state.difficulty = d; }

  function getSessionId() { return state.sessionId; }

  return {
    startGame, onMove, resetSession,
    setDifficulty, getSessionId,
  };
})();
