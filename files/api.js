/**
 * api.js — REST API client for the Python Flask backend.
 * All methods return parsed JSON or throw on error.
 */

const API = (() => {
  // Detect if running inside Electron or a browser
  const BASE_URL = "http://localhost:5000";

  async function request(method, path, body = null) {
    const opts = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE_URL}${path}`, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  return {
    /** Check if the backend is alive */
    health: () => request("GET", "/health"),

    /** Create a new game session */
    newSession: (mode) => request("POST", "/session/new", { mode }),

    /**
     * Play a round.
     * @param {string} sessionId
     * @param {string} player1Move  rock | paper | scissors
     * @param {string} mode         pvc | pvp
     * @param {string} difficulty   easy | medium | hard
     * @param {string} [player2Move] (pvp only)
     */
    play: (sessionId, player1Move, mode = "pvc", difficulty = "medium", player2Move = null) => {
      const body = { session_id: sessionId, player1_move: player1Move, mode, difficulty };
      if (player2Move) body.player2_move = player2Move;
      return request("POST", "/play", body);
    },

    /**
     * Fetch match history.
     * @param {string} [sessionId]
     * @param {number} [limit]
     */
    history: (sessionId = null, limit = 50) => {
      const qs = new URLSearchParams({ limit });
      if (sessionId) qs.set("session_id", sessionId);
      return request("GET", `/history?${qs}`);
    },

    /**
     * Reset scores for a session (or all).
     * @param {string} [sessionId]
     */
    reset: (sessionId = null) => {
      const body = sessionId ? { session_id: sessionId } : {};
      return request("POST", "/reset", body);
    },

    /** Fetch all achievements */
    achievements: () => request("GET", "/achievements"),

    /** Fetch global stats */
    stats: () => request("GET", "/stats"),
  };
})();
