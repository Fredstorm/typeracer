const serverUrl = window.TYPERACER_SERVER_URL || undefined;
const socket = io(serverUrl, { transports: ["websocket", "polling"] });

const screens = {
  join: document.getElementById("join-screen"),
  lobby: document.getElementById("lobby-screen"),
  race: document.getElementById("race-screen"),
  results: document.getElementById("results-screen"),
};

const joinForm = document.getElementById("join-form");
const playerNameInput = document.getElementById("player-name");
const roomCodeInput = document.getElementById("room-code");
const createBtn = document.getElementById("create-btn");
const joinError = document.getElementById("join-error");
const lobbyCode = document.getElementById("lobby-code");
const copyCodeBtn = document.getElementById("copy-code-btn");
const playerList = document.getElementById("player-list");
const startBtn = document.getElementById("start-btn");
const leaveBtn = document.getElementById("leave-btn");
const countdownEl = document.getElementById("countdown");
const paragraphDisplay = document.getElementById("paragraph-display");
const typingInput = document.getElementById("typing-input");
const statWpm = document.getElementById("stat-wpm");
const statAccuracy = document.getElementById("stat-accuracy");
const statProgress = document.getElementById("stat-progress");
const standingsList = document.getElementById("standings-list");
const winnerText = document.getElementById("winner-text");
const resultsList = document.getElementById("results-list");
const playAgainBtn = document.getElementById("play-again-btn");

let state = {
  room: null,
  playerId: null,
  isHost: false,
  paragraph: "",
  mode: "strict",
  raceStarted: false,
  raceLocked: false,
};

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle("hidden", key !== name);
  });
}

function getSelectedMode() {
  return document.querySelector('input[name="mode"]:checked').value;
}

function showError(message) {
  joinError.textContent = message;
  joinError.classList.remove("hidden");
}

function clearError() {
  joinError.textContent = "";
  joinError.classList.add("hidden");
}

function getPlayerName() {
  const name = playerNameInput.value.trim();
  if (!name) {
    showError("Please enter your name.");
    return null;
  }
  clearError();
  return name;
}

createBtn.addEventListener("click", () => {
  const name = getPlayerName();
  if (!name) return;
  state.mode = getSelectedMode();
  socket.emit("create-room", { playerName: name, mode: state.mode });
});

joinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = getPlayerName();
  if (!name) return;

  const roomId = roomCodeInput.value.trim().toUpperCase();
  if (!roomId) {
    showError("Enter a room code to join.");
    return;
  }

  state.mode = getSelectedMode();
  socket.emit("join-room", { roomId, playerName: name, mode: state.mode });
});

copyCodeBtn.addEventListener("click", async () => {
  if (!state.room) return;
  await navigator.clipboard.writeText(state.room.id);
  copyCodeBtn.textContent = "Copied!";
  setTimeout(() => {
    copyCodeBtn.textContent = "Copy code";
  }, 1500);
});

startBtn.addEventListener("click", () => {
  socket.emit("start-race");
});

leaveBtn.addEventListener("click", () => {
  location.reload();
});

playAgainBtn.addEventListener("click", () => {
  location.reload();
});

socket.on("connect", () => {
  clearError();
});

socket.on("connect_error", () => {
  if (serverUrl) {
    showError("Cannot reach the game server. Make sure the backend is deployed and running.");
  }
});

socket.on("error", ({ message }) => {
  showError(message);
});

socket.on("room-joined", ({ room, playerId, isHost }) => {
  state.room = room;
  state.playerId = playerId;
  state.isHost = isHost;

  lobbyCode.textContent = room.id;
  renderLobby(room);
  startBtn.classList.toggle("hidden", !isHost);
  showScreen("lobby");
});

socket.on("room-updated", ({ room }) => {
  state.room = room;
  renderLobby(room);
});

socket.on("race-started", ({ paragraph, room }) => {
  state.room = room;
  state.paragraph = paragraph;
  state.raceStarted = false;
  state.raceLocked = true;

  showScreen("race");
  renderStandings(room);
  typingInput.value = "";
  typingInput.disabled = true;
  typingInput.placeholder = "Get ready...";
  renderParagraph("");

  runCountdown(() => {
    state.raceStarted = true;
    state.raceLocked = false;
    typingInput.disabled = false;
    typingInput.placeholder = "Start typing...";
    typingInput.focus();
  });
});

socket.on("race-update", ({ room }) => {
  state.room = room;
  renderStandings(room);
  updateSelfStats(room);
});

socket.on("race-finished", ({ winnerId, winnerName, room }) => {
  state.room = room;
  state.raceLocked = true;
  typingInput.disabled = true;

  const youWon = winnerId === state.playerId;
  winnerText.textContent = youWon ? "You won the race!" : `${winnerName} won the race!`;
  renderResults(room);
  showScreen("results");
});

typingInput.addEventListener("input", () => {
  if (!state.raceStarted || state.raceLocked) return;

  let typed = typingInput.value;

  if (state.mode === "strict") {
    typed = enforceStrictInput(typed);
    if (typingInput.value !== typed) {
      typingInput.value = typed;
    }
  }

  renderParagraph(typed);
  updateSelfStatsFromInput(typed);
  socket.emit("progress", { typedText: typed });
});

typingInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
  }
});

function enforceStrictInput(typed) {
  const paragraph = state.paragraph;
  let result = "";

  for (let i = 0; i < typed.length; i += 1) {
    if (typed[i] === paragraph[i]) {
      result += typed[i];
    } else {
      break;
    }
  }

  return result;
}

function runCountdown(onDone) {
  let count = 3;
  countdownEl.classList.remove("hidden");
  countdownEl.textContent = count;

  const timer = setInterval(() => {
    count -= 1;
    if (count > 0) {
      countdownEl.textContent = count;
      return;
    }

    clearInterval(timer);
    countdownEl.textContent = "Go!";
    setTimeout(() => {
      countdownEl.classList.add("hidden");
      onDone();
    }, 450);
  }, 800);
}

function renderLobby(room) {
  playerList.innerHTML = room.players
    .map(
      (player) => `
      <li>
        <span class="player-name">${escapeHtml(player.name)}${player.id === state.playerId ? " (you)" : ""}</span>
        <span class="badge ${player.mode}">${player.mode === "strict" ? "Strict" : "Relaxed"}</span>
        <span class="player-stats">${player.id === room.hostId ? "Host" : "Ready"}</span>
      </li>
    `
    )
    .join("");
}

function renderStandings(room) {
  const sorted = [...room.players].sort((a, b) => {
    if (a.finished && b.finished) return (a.rank || 99) - (b.rank || 99);
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progress - a.progress;
  });

  standingsList.innerHTML = sorted
    .map(
      (player) => `
      <li>
        <span class="player-name">${escapeHtml(player.name)}</span>
        <div class="progress-bar"><div class="progress-fill" style="width:${player.progress}%"></div></div>
        <span class="player-stats">${player.finished ? `#${player.rank} · ${formatTime(player.finishTime)}` : `${player.wpm} WPM`}</span>
      </li>
    `
    )
    .join("");
}

function renderResults(room) {
  const sorted = [...room.players].sort((a, b) => {
    if (a.finished && b.finished) return (a.rank || 99) - (b.rank || 99);
    return b.progress - a.progress;
  });

  resultsList.innerHTML = sorted
    .map(
      (player) => `
      <li>
        <span class="player-name">${escapeHtml(player.name)}${player.id === state.playerId ? " (you)" : ""}</span>
        <span class="badge ${player.mode}">${player.mode === "strict" ? "Strict" : "Relaxed"}</span>
        <span class="player-stats">${
          player.finished
            ? `#${player.rank} · ${player.wpm} WPM · ${player.accuracy}%`
            : `${player.progress}% · DNF`
        }</span>
      </li>
    `
    )
    .join("");
}

function renderParagraph(typed) {
  const paragraph = state.paragraph;
  if (!paragraph) {
    paragraphDisplay.innerHTML = "";
    return;
  }

  const chars = [];

  for (let i = 0; i < paragraph.length; i += 1) {
    let className = "char pending";

    if (i < typed.length) {
      className = typed[i] === paragraph[i] ? "char correct" : "char wrong";
    } else if (i === typed.length) {
      className = "char current";
    }

    chars.push(`<span class="${className}">${escapeHtml(paragraph[i])}</span>`);
  }

  paragraphDisplay.innerHTML = chars.join("");
}

function updateSelfStats(room) {
  const me = room.players.find((p) => p.id === state.playerId);
  if (!me) return;

  statWpm.textContent = String(me.wpm);
  statAccuracy.textContent = `${me.accuracy}%`;
  statProgress.textContent = `${me.progress}%`;
}

function updateSelfStatsFromInput(typed) {
  const paragraph = state.paragraph;
  if (!paragraph) return;

  let progress;
  let accuracy;

  if (state.mode === "strict") {
    progress = Math.round((typed.length / paragraph.length) * 100);
    accuracy = typed.length === 0 ? 100 : 100;
  } else {
    const len = Math.min(typed.length, paragraph.length);
    let correct = 0;
    for (let i = 0; i < len; i += 1) {
      if (typed[i] === paragraph[i]) correct += 1;
    }
    progress = Math.round((len / paragraph.length) * 100);
    accuracy = len === 0 ? 100 : Math.round((correct / len) * 100);
  }

  statProgress.textContent = `${progress}%`;
  statAccuracy.textContent = `${accuracy}%`;
}

function formatTime(ms) {
  if (!ms && ms !== 0) return "--";
  return `${(ms / 1000).toFixed(1)}s`;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
