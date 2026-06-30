const PARAGRAPHS = [
  "The quick brown fox jumps over the lazy dog while the sun sets behind distant hills. Every keystroke brings you closer to the finish line in this friendly typing competition.",
  "Programming is the art of telling another human being what one wants the computer to do. Clear thinking leads to clear code, and clear code leads to fewer bugs in production.",
  "A journey of a thousand miles begins with a single step. Practice makes perfect, and every mistake is simply another opportunity to learn something new about yourself.",
  "In the middle of difficulty lies opportunity. Great typists are not born overnight; they are forged through patience, repetition, and the willingness to improve one word at a time.",
  "The best way to predict the future is to invent it. Speed without accuracy is hollow, but accuracy without speed will never win a race against determined opponents.",
  "To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment. Type with confidence, race with heart, and never fear a misplaced letter.",
  "Success is not final, failure is not fatal: it is the courage to continue that counts. Keep your fingers on the home row and your eyes on the text ahead of you.",
  "It does not matter how slowly you go as long as you do not stop. In relaxed mode, every character counts toward the finish, even when your spelling wanders off course.",
];

function randomParagraph() {
  return PARAGRAPHS[Math.floor(Math.random() * PARAGRAPHS.length)];
}

function generateRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 5; i += 1) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function createPlayer(name, mode, socketId) {
  return {
    id: cryptoRandomId(),
    name: name.trim().slice(0, 20) || "Player",
    mode,
    socketId,
    progress: 0,
    wpm: 0,
    accuracy: 100,
    finished: false,
    finishTime: null,
    rank: null,
    typedText: "",
  };
}

function cryptoRandomId() {
  return Math.random().toString(36).slice(2, 10);
}

const rooms = new Map();

function createRoom(playerName, mode, socketId) {
  let roomId = generateRoomId();
  while (rooms.has(roomId)) {
    roomId = generateRoomId();
  }

  const host = createPlayer(playerName, mode, socketId);
  const room = {
    id: roomId,
    hostId: host.id,
    status: "lobby",
    players: [host],
    paragraph: null,
    startedAt: null,
    winnerId: null,
  };

  rooms.set(roomId, room);
  return { room, player: host };
}

function getRoom(roomId) {
  return rooms.get((roomId || "").toUpperCase()) || null;
}

function joinRoom(room, playerName, mode, socketId) {
  if (room.players.length >= 8) return null;

  const player = createPlayer(playerName, mode, socketId);
  room.players.push(player);
  return player;
}

function removePlayer(room, playerId) {
  room.players = room.players.filter((p) => p.id !== playerId);
  if (room.players.length === 0) {
    rooms.delete(room.id);
    return;
  }
  if (room.hostId === playerId) {
    room.hostId = room.players[0].id;
  }
}

function startRace(room) {
  room.status = "racing";
  room.paragraph = randomParagraph();
  room.startedAt = Date.now();
  room.winnerId = null;

  for (const player of room.players) {
    player.progress = 0;
    player.wpm = 0;
    player.accuracy = 100;
    player.finished = false;
    player.finishTime = null;
    player.rank = null;
    player.typedText = "";
  }

  return room;
}

function strictProgress(paragraph, typedText) {
  let matched = 0;
  for (let i = 0; i < typedText.length; i += 1) {
    if (typedText[i] === paragraph[i]) {
      matched += 1;
    } else {
      break;
    }
  }

  const correctChars = matched;
  const totalTyped = typedText.length;
  const accuracy = totalTyped === 0 ? 100 : Math.round((correctChars / totalTyped) * 100);
  const finished = typedText === paragraph;

  return {
    progress: Math.round((matched / paragraph.length) * 100),
    matched,
    accuracy,
    finished,
  };
}

function forgivingProgress(paragraph, typedText) {
  const typed = typedText.length;
  const limit = paragraph.length;
  const progressChars = Math.min(typed, limit);

  let correct = 0;
  for (let i = 0; i < progressChars; i += 1) {
    if (typedText[i] === paragraph[i]) correct += 1;
  }

  const accuracy = progressChars === 0 ? 100 : Math.round((correct / progressChars) * 100);
  const finished = typed >= limit;

  return {
    progress: Math.round((progressChars / limit) * 100),
    matched: progressChars,
    accuracy,
    finished,
  };
}

function calculateWpm(matchedChars, elapsedMs) {
  if (elapsedMs <= 0) return 0;
  const minutes = elapsedMs / 60000;
  const words = matchedChars / 5;
  return Math.round(words / minutes);
}

function updateProgress(room, playerId, typedText) {
  const player = room.players.find((p) => p.id === playerId);
  if (!player || player.finished) return null;

  player.typedText = typedText;

  const stats =
    player.mode === "strict"
      ? strictProgress(room.paragraph, typedText)
      : forgivingProgress(room.paragraph, typedText);

  player.progress = stats.progress;
  player.accuracy = stats.accuracy;

  const elapsed = Date.now() - room.startedAt;
  player.wpm = calculateWpm(stats.matched, elapsed);

  if (stats.finished) {
    player.finished = true;
    player.finishTime = elapsed;
    const finishedCount = room.players.filter((p) => p.finished).length;
    player.rank = finishedCount;
  }

  return {
    playerId: player.id,
    playerName: player.name,
    finished: stats.finished,
    progress: player.progress,
    wpm: player.wpm,
    accuracy: player.accuracy,
  };
}

module.exports = {
  createRoom,
  getRoom,
  joinRoom,
  removePlayer,
  startRace,
  updateProgress,
};
