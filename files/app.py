"""
Rock Paper Scissors - Backend API
Flask server handling game logic, AI, history, and achievements.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import random
import sqlite3
import json
import os
import time
from datetime import datetime
from collections import Counter

app = Flask(__name__)
CORS(app)

DB_PATH = os.path.join(os.path.dirname(__file__), "game.db")

# ─────────────────────────────────────────────
# DATABASE SETUP
# ─────────────────────────────────────────────

def init_db():
    """Initialize SQLite database with required tables."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mode TEXT NOT NULL,
            player1_move TEXT NOT NULL,
            player2_move TEXT NOT NULL,
            result TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            session_id TEXT
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            mode TEXT NOT NULL,
            player1_score INTEGER DEFAULT 0,
            player2_score INTEGER DEFAULT 0,
            draws INTEGER DEFAULT 0,
            rounds INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS achievements (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            icon TEXT NOT NULL,
            unlocked INTEGER DEFAULT 0,
            unlocked_at TEXT
        )
    """)

    # Seed achievements
    achievements = [
        ("first_win",     "First Blood",       "Win your very first game",             "🏆", 0, None),
        ("win_streak_3",  "Hat Trick",          "Win 3 games in a row",                 "🔥", 0, None),
        ("win_streak_5",  "On Fire",            "Win 5 games in a row",                 "⚡", 0, None),
        ("win_streak_10", "Unstoppable",        "Win 10 games in a row",                "💎", 0, None),
        ("play_10",       "Getting Warmed Up",  "Play 10 total rounds",                 "🎮", 0, None),
        ("play_50",       "Veteran",            "Play 50 total rounds",                 "⚔️",  0, None),
        ("play_100",      "Legend",             "Play 100 total rounds",                "👑", 0, None),
        ("scissors_fan",  "Scissors Fanatic",   "Win 10 times using Scissors",          "✂️",  0, None),
        ("rock_solid",    "Rock Solid",         "Win 10 times using Rock",              "🪨", 0, None),
        ("paper_master",  "Paper Master",       "Win 10 times using Paper",             "📄", 0, None),
        ("draw_5",        "Peacekeeper",        "Draw 5 games in a row",                "🤝", 0, None),
        ("comeback",      "Comeback Kid",       "Win after losing 3 in a row",          "🌟", 0, None),
    ]
    c.executemany(
        "INSERT OR IGNORE INTO achievements VALUES (?,?,?,?,?,?)",
        achievements
    )

    conn.commit()
    conn.close()


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ─────────────────────────────────────────────
# GAME LOGIC
# ─────────────────────────────────────────────

MOVES   = ["rock", "paper", "scissors"]
BEATS   = {"rock": "scissors", "scissors": "paper", "paper": "rock"}
EMOJI   = {"rock": "🪨", "paper": "📄", "scissors": "✂️"}

# AI state (in-memory per difficulty)
ai_state = {
    "move_history": [],   # player's past moves
    "win_streak":   0,
    "lose_streak":  0,
}


def determine_result(p1: str, p2: str) -> str:
    """Return 'win', 'lose', or 'draw' from player1's perspective."""
    if p1 == p2:
        return "draw"
    return "win" if BEATS[p1] == p2 else "lose"


def ai_move(difficulty: str = "medium") -> str:
    """
    Generate an AI move based on difficulty:
      easy   – pure random
      medium – 40% exploit player patterns, 60% random
      hard   – 70% exploit player patterns, 30% random
    """
    history = ai_state["move_history"]

    if difficulty == "easy" or len(history) < 3:
        return random.choice(MOVES)

    exploit_chance = 0.4 if difficulty == "medium" else 0.7

    if random.random() < exploit_chance:
        # Predict player's next move based on frequency
        freq  = Counter(history[-10:])          # last 10 moves
        predicted = freq.most_common(1)[0][0]   # most frequent
        return BEATS_BY[predicted]              # pick the move that beats it
    else:
        return random.choice(MOVES)

# move that beats a given move
BEATS_BY = {m: [k for k, v in BEATS.items() if v == m][0] for m in MOVES}


def check_achievements(session_id: str) -> list:
    """Check and unlock any newly earned achievements. Returns list of newly unlocked."""
    conn  = get_db()
    c     = conn.cursor()
    newly = []

    # Aggregate session data
    c.execute("SELECT * FROM sessions WHERE id=?", (session_id,))
    sess = c.fetchone()
    if not sess:
        conn.close()
        return []

    c.execute("SELECT * FROM matches WHERE session_id=? ORDER BY id DESC", (session_id,))
    matches = c.fetchall()

    total_rounds  = sess["rounds"]
    p1_wins       = sess["player1_score"]
    current_win_streak   = 0
    current_lose_streak  = 0
    current_draw_streak  = 0

    # Calculate current streak
    for m in matches:
        if m["result"] == "win":
            current_win_streak += 1
            current_draw_streak = 0
            current_lose_streak = 0
        elif m["result"] == "lose":
            current_lose_streak += 1
            current_win_streak  = 0
            current_draw_streak = 0
        elif m["result"] == "draw":
            current_draw_streak += 1
            current_win_streak  = 0
            current_lose_streak = 0
        else:
            break

    # Move-specific wins
    scissors_wins = sum(1 for m in matches if m["result"] == "win" and m["player1_move"] == "scissors")
    rock_wins     = sum(1 for m in matches if m["result"] == "win" and m["player1_move"] == "rock")
    paper_wins    = sum(1 for m in matches if m["result"] == "win" and m["player1_move"] == "paper")

    checks = {
        "first_win":     p1_wins >= 1,
        "win_streak_3":  current_win_streak >= 3,
        "win_streak_5":  current_win_streak >= 5,
        "win_streak_10": current_win_streak >= 10,
        "play_10":       total_rounds >= 10,
        "play_50":       total_rounds >= 50,
        "play_100":      total_rounds >= 100,
        "scissors_fan":  scissors_wins >= 10,
        "rock_solid":    rock_wins >= 10,
        "paper_master":  paper_wins >= 10,
        "draw_5":        current_draw_streak >= 5,
        "comeback":      current_lose_streak == 0 and len(matches) >= 4 and
                         all(m["result"] == "lose" for m in matches[1:4]) and
                         matches[0]["result"] == "win",
    }

    now = datetime.utcnow().isoformat()
    for ach_id, earned in checks.items():
        if earned:
            c.execute("SELECT unlocked FROM achievements WHERE id=?", (ach_id,))
            row = c.fetchone()
            if row and not row["unlocked"]:
                c.execute(
                    "UPDATE achievements SET unlocked=1, unlocked_at=? WHERE id=?",
                    (now, ach_id)
                )
                c.execute("SELECT * FROM achievements WHERE id=?", (ach_id,))
                newly.append(dict(c.fetchone()))

    conn.commit()
    conn.close()
    return newly


# ─────────────────────────────────────────────
# API ENDPOINTS
# ─────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "timestamp": datetime.utcnow().isoformat()})


@app.route("/session/new", methods=["POST"])
def new_session():
    """Create a new game session."""
    data    = request.get_json(silent=True) or {}
    mode    = data.get("mode", "pvc")          # pvc | pvp
    sess_id = f"sess_{int(time.time()*1000)}"
    now     = datetime.utcnow().isoformat()

    conn = get_db()
    conn.execute(
        "INSERT INTO sessions VALUES (?,?,0,0,0,0,?,?)",
        (sess_id, mode, now, now)
    )
    conn.commit()
    conn.close()

    # Reset AI state for new session
    ai_state["move_history"] = []
    ai_state["win_streak"]   = 0
    ai_state["lose_streak"]  = 0

    return jsonify({"session_id": sess_id, "mode": mode})


@app.route("/play", methods=["POST"])
def play():
    """
    Process a round.
    Body: { session_id, player1_move, player2_move (pvp only), difficulty, mode }
    """
    data = request.get_json(silent=True) or {}

    session_id  = data.get("session_id", "default")
    p1_move     = data.get("player1_move", "").lower().strip()
    mode        = data.get("mode", "pvc")
    difficulty  = data.get("difficulty", "medium")

    # Validate move
    if p1_move not in MOVES:
        return jsonify({"error": f"Invalid move '{p1_move}'. Choose rock, paper, or scissors."}), 400

    # Determine player2 move
    if mode == "pvc":
        p2_move = ai_move(difficulty)
        ai_state["move_history"].append(p1_move)   # record player history for AI
    elif mode == "pvp":
        p2_move = data.get("player2_move", "").lower().strip()
        if p2_move not in MOVES:
            return jsonify({"error": "Invalid player2_move"}), 400
    else:
        return jsonify({"error": "Invalid mode"}), 400

    result  = determine_result(p1_move, p2_move)
    now     = datetime.utcnow().isoformat()

    conn = get_db()
    # Save match
    conn.execute(
        "INSERT INTO matches (mode, player1_move, player2_move, result, timestamp, session_id) VALUES (?,?,?,?,?,?)",
        (mode, p1_move, p2_move, result, now, session_id)
    )

    # Update session scores
    if result == "win":
        conn.execute("UPDATE sessions SET player1_score=player1_score+1, rounds=rounds+1, updated_at=? WHERE id=?", (now, session_id))
        ai_state["win_streak"]  += 1
        ai_state["lose_streak"]  = 0
    elif result == "lose":
        conn.execute("UPDATE sessions SET player2_score=player2_score+1, rounds=rounds+1, updated_at=? WHERE id=?", (now, session_id))
        ai_state["lose_streak"] += 1
        ai_state["win_streak"]   = 0
    else:
        conn.execute("UPDATE sessions SET draws=draws+1, rounds=rounds+1, updated_at=? WHERE id=?", (now, session_id))

    conn.commit()

    # Fetch updated session
    sess = dict(conn.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone())
    conn.close()

    # Check achievements
    new_achievements = check_achievements(session_id)

    return jsonify({
        "player1_move":    p1_move,
        "player2_move":    p2_move,
        "result":          result,
        "player1_emoji":   EMOJI[p1_move],
        "player2_emoji":   EMOJI[p2_move],
        "session":         sess,
        "new_achievements": new_achievements,
        "result_text":     {
            "win":  "You Win! 🎉",
            "lose": "You Lose! 😔",
            "draw": "It's a Draw! 🤝"
        }[result]
    })


@app.route("/history", methods=["GET"])
def history():
    """Return match history, optionally filtered by session."""
    session_id = request.args.get("session_id")
    limit      = int(request.args.get("limit", 50))

    conn = get_db()
    if session_id:
        rows = conn.execute(
            "SELECT * FROM matches WHERE session_id=? ORDER BY id DESC LIMIT ?",
            (session_id, limit)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM matches ORDER BY id DESC LIMIT ?",
            (limit,)
        ).fetchall()
    conn.close()

    matches = []
    for r in rows:
        m = dict(r)
        m["player1_emoji"] = EMOJI.get(m["player1_move"], "?")
        m["player2_emoji"] = EMOJI.get(m["player2_move"], "?")
        matches.append(m)

    return jsonify({"matches": matches, "count": len(matches)})


@app.route("/reset", methods=["POST"])
def reset():
    """Reset scores for a session (or all if no session_id given)."""
    data       = request.get_json(silent=True) or {}
    session_id = data.get("session_id")
    now        = datetime.utcnow().isoformat()

    conn = get_db()
    if session_id:
        conn.execute(
            "UPDATE sessions SET player1_score=0, player2_score=0, draws=0, rounds=0, updated_at=? WHERE id=?",
            (now, session_id)
        )
        conn.execute("DELETE FROM matches WHERE session_id=?", (session_id,))
    else:
        conn.execute("UPDATE sessions SET player1_score=0, player2_score=0, draws=0, rounds=0, updated_at=?", (now,))
        conn.execute("DELETE FROM matches")

    conn.commit()
    conn.close()

    ai_state["move_history"] = []
    ai_state["win_streak"]   = 0
    ai_state["lose_streak"]  = 0

    return jsonify({"success": True, "message": "Scores reset successfully"})


@app.route("/achievements", methods=["GET"])
def achievements():
    """Return all achievements with unlock status."""
    conn  = get_db()
    rows  = conn.execute("SELECT * FROM achievements ORDER BY unlocked DESC, id ASC").fetchall()
    conn.close()
    return jsonify({"achievements": [dict(r) for r in rows]})


@app.route("/achievements/reset", methods=["POST"])
def reset_achievements():
    """Reset all achievements (for testing)."""
    conn = get_db()
    conn.execute("UPDATE achievements SET unlocked=0, unlocked_at=NULL")
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@app.route("/stats", methods=["GET"])
def stats():
    """Return global game statistics."""
    conn = get_db()

    total = conn.execute("SELECT COUNT(*) FROM matches").fetchone()[0]
    wins  = conn.execute("SELECT COUNT(*) FROM matches WHERE result='win'").fetchone()[0]
    loses = conn.execute("SELECT COUNT(*) FROM matches WHERE result='lose'").fetchone()[0]
    draws = conn.execute("SELECT COUNT(*) FROM matches WHERE result='draw'").fetchone()[0]

    move_counts = {}
    for move in MOVES:
        move_counts[move] = conn.execute(
            "SELECT COUNT(*) FROM matches WHERE player1_move=?", (move,)
        ).fetchone()[0]

    conn.close()

    win_rate = round((wins / total * 100), 1) if total > 0 else 0

    return jsonify({
        "total_games": total,
        "wins":        wins,
        "losses":      loses,
        "draws":       draws,
        "win_rate":    win_rate,
        "move_counts": move_counts,
    })


# ─────────────────────────────────────────────
# STARTUP
# ─────────────────────────────────────────────

if __name__ == "__main__":
    init_db()
    print("🎮 RPS Backend running on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=False)
