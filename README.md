# TypeRacer

Multiplayer typing race for 2–8 players. Everyone gets the same paragraph; first to finish wins.

## Modes

- **Strict** — For skilled typists. Every character must match exactly (spelling, punctuation, spaces). Wrong keys do not advance.
- **Relaxed** — For beginners. Typos are allowed; progress is based on how many characters you type. Reach the end to finish.

Players pick their mode when joining, so a room can mix strict and relaxed racers.

## Run locally

```bash
cd C:\Users\frede\dev\typeracer
npm install
npm start
```

Open **http://localhost:3000** in two browser tabs (or two devices on the same network using your machine's IP).

## How to play

1. Enter your name and choose **Strict** or **Relaxed**.
2. Click **Create Room** and share the 5-letter code, or **Join Room** with a friend's code.
3. The host starts the race when at least 2 players are in the lobby.
4. Type the paragraph as fast as you can. First finisher wins.

## Host online (GitHub Pages + Render)

GitHub Pages only serves static files. Real-time multiplayer needs a small Node.js backend for WebSockets, so the setup is:

| Part | Host | What it does |
|------|------|--------------|
| Frontend | **GitHub Pages** | HTML, CSS, JS — the game UI |
| Backend | **Render** (free) | Socket.IO game server |

### 1. Push the repo to GitHub

Create a new repo on GitHub (e.g. `typeracer`), then from this folder:

```bash
git init
git add .
git commit -m "Initial TypeRacer multiplayer game"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/typeracer.git
git push -u origin main
```

### 2. Deploy the backend on Render

1. Sign in at [render.com](https://render.com) with GitHub.
2. **New → Blueprint** and connect your `typeracer` repo (Render reads `render.yaml`).
3. After deploy, copy your service URL, e.g. `https://typeracer-api.onrender.com`.
4. In Render → your service → **Environment**, add:

   | Key | Value |
   |-----|-------|
   | `CLIENT_ORIGIN` | `https://YOUR_USERNAME.github.io` |

   If the repo is not a user site, use the project URL: `https://YOUR_USERNAME.github.io/typeracer` (no trailing slash).

### 3. Configure GitHub Pages

1. On GitHub: **Settings → Secrets and variables → Actions → Variables**.
2. Add variable **`TYPERACER_SERVER_URL`** = your Render URL (e.g. `https://typeracer-api.onrender.com`).
3. **Settings → Pages → Build and deployment**:
   - Source: **GitHub Actions**
4. Push to `main` (or run the **Deploy to GitHub Pages** workflow manually).

Your site will be at:

- `https://YOUR_USERNAME.github.io/typeracer/` (project repo), or
- `https://YOUR_USERNAME.github.io/` (if the repo is named `YOUR_USERNAME.github.io`)

### 4. Verify

1. Open the GitHub Pages URL in two tabs.
2. Create a room in one tab, join with the code in the other.
3. If you see “Cannot reach the game server”, check `TYPERACER_SERVER_URL` and that Render shows the service as **Live**.

### Optional: build static files locally

```bash
TYPERACER_SERVER_URL=https://typeracer-api.onrender.com npm run build:pages
```

Output goes to `docs/` (used by the GitHub Action; not committed).

## Tech

- Node.js + Express
- Socket.IO for real-time rooms and progress
- Vanilla HTML/CSS/JS frontend
- GitHub Actions for Pages deploy
