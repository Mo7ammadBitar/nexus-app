# ⚡ Rock Paper Scissors Pro

A professional desktop Rock-Paper-Scissors game built with **Electron.js** (frontend) and **Python Flask** (backend).

---

## 📁 Project Structure

```
rps-game/
├── backend/
│   ├── app.py              # Flask API server
│   ├── requirements.txt    # Python dependencies
│   └── game.db             # SQLite database (auto-created)
├── frontend/
│   ├── main.js             # Electron main process
│   ├── preload.js          # Secure IPC bridge
│   ├── index.html          # Main app window
│   ├── css/
│   │   └── styles.css      # Full UI styles
│   ├── js/
│   │   ├── sounds.js       # Web Audio sound effects
│   │   ├── api.js          # REST API client
│   │   ├── ui.js           # UI helpers & transitions
│   │   ├── game.js         # Game state machine
│   │   └── app.js          # App bootstrap & event wiring
│   └── assets/
│       └── icons/          # App icons (add icon.png here)
├── package.json
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+ — https://nodejs.org
- **Python 3.8+** — https://python.org

---

### Step 1 — Install Python dependencies

```bash
cd rps-game
pip3 install -r backend/requirements.txt
```

---

### Step 2 — Install Node.js dependencies

```bash
npm install
```

---

### Step 3 — Start the Python backend

Open a terminal and run:

```bash
python3 backend/app.py
```

You should see:
```
🎮 RPS Backend running on http://localhost:5000
```

---

### Step 4 — Launch the Electron app

In a **second** terminal:

```bash
npm start
```

---

## 🎮 How to Play

### vs Computer
- Click **vs Computer** on the home screen
- Choose Rock, Paper, or Scissors
- The AI adapts to your patterns on Medium/Hard

### vs Player (Local)
- Click **vs Player** on the home screen
- Player 1 picks secretly, then hands off to Player 2
- Cover the screen between turns for a fair game!

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `1` or `R` | Play Rock |
| `2` or `P` | Play Paper |
| `3` or `S` | Play Scissors |
| `Esc` | Back to home |

---

## 🔧 API Reference

The backend runs on `http://localhost:5000`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Backend health check |
| POST | `/session/new` | Create a game session |
| POST | `/play` | Submit a move & get result |
| GET | `/history` | Match history |
| POST | `/reset` | Reset scores |
| GET | `/achievements` | List all achievements |
| GET | `/stats` | Global statistics |

---

## 🏆 Achievements

| Achievement | Condition |
|-------------|-----------|
| First Blood | Win your first game |
| Hat Trick | Win 3 in a row |
| On Fire | Win 5 in a row |
| Unstoppable | Win 10 in a row |
| Veteran | Play 50 rounds |
| Legend | Play 100 rounds |
| Rock Solid | Win 10 times with Rock |
| Paper Master | Win 10 times with Paper |
| Scissors Fanatic | Win 10 times with Scissors |
| Peacekeeper | Draw 5 times in a row |
| Comeback Kid | Win after losing 3 in a row |

---

## ⚙️ Settings

- **Difficulty**: Easy (random AI) / Medium (40% pattern) / Hard (70% pattern)
- **Sound Effects**: Toggle on/off
- **Theme**: Dark / Light

---

## 🛠️ Development

Run with DevTools open:
```bash
npm run dev
```

Run only the backend:
```bash
npm run backend
```

---

## 📦 Building for Distribution

Install electron-builder:
```bash
npm install --save-dev electron-builder
```

Add to `package.json`:
```json
"build": {
  "appId": "com.rps.pro",
  "mac": { "target": "dmg" },
  "win": { "target": "nsis" },
  "linux": { "target": "AppImage" }
}
```

Then run:
```bash
npx electron-builder
```
