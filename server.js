const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { createRoom, getRoom, joinRoom, removePlayer, startRace, updateProgress } = require("./game/rooms");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
  : true;

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

if (process.env.SERVE_STATIC !== "false") {
  app.use(express.static(path.join(__dirname, "public")));
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

io.on("connection", (socket) => {
  let currentRoomId = null;
  let playerId = null;

  socket.on("create-room", ({ playerName, mode }) => {
    const { room, player } = createRoom(playerName, mode, socket.id);
    currentRoomId = room.id;
    playerId = player.id;

    socket.join(room.id);
    socket.emit("room-joined", { room: sanitizeRoom(room), playerId: player.id, isHost: true });
  });

  socket.on("join-room", ({ roomId, playerName, mode }) => {
    const room = getRoom(roomId);
    if (!room) {
      socket.emit("error", { message: "Room not found. Check the code and try again." });
      return;
    }
    if (room.status !== "lobby") {
      socket.emit("error", { message: "This race has already started." });
      return;
    }

    const player = joinRoom(room, playerName, mode, socket.id);
    if (!player) {
      socket.emit("error", { message: "Room is full (max 8 players)." });
      return;
    }

    currentRoomId = room.id;
    playerId = player.id;

    socket.join(room.id);
    socket.emit("room-joined", { room: sanitizeRoom(room), playerId: player.id, isHost: false });
    io.to(room.id).emit("room-updated", { room: sanitizeRoom(room) });
  });

  socket.on("start-race", () => {
    const room = getRoom(currentRoomId);
    if (!room || room.hostId !== playerId) return;
    if (room.players.length < 2) {
      socket.emit("error", { message: "Need at least 2 players to start." });
      return;
    }

    const started = startRace(room);
    io.to(room.id).emit("race-started", {
      paragraph: started.paragraph,
      startedAt: started.startedAt,
      room: sanitizeRoom(started),
    });
  });

  socket.on("progress", ({ typedText }) => {
    const room = getRoom(currentRoomId);
    if (!room || room.status !== "racing" || !playerId) return;

    const result = updateProgress(room, playerId, typedText);
    if (!result) return;

    io.to(room.id).emit("race-update", {
      room: sanitizeRoom(room),
      lastUpdate: result,
    });

    if (result.finished && !room.winnerId) {
      room.winnerId = playerId;
      room.status = "finished";
      io.to(room.id).emit("race-finished", {
        winnerId: playerId,
        winnerName: result.playerName,
        room: sanitizeRoom(room),
      });
    }
  });

  socket.on("disconnect", () => {
    if (!currentRoomId || !playerId) return;

    const room = getRoom(currentRoomId);
    if (!room) return;

    removePlayer(room, playerId);

    if (room.players.length === 0) {
      return;
    }

    if (room.status === "racing" && room.players.every((p) => p.finished)) {
      room.status = "finished";
    }

    io.to(room.id).emit("room-updated", { room: sanitizeRoom(room) });
  });
});

function sanitizeRoom(room) {
  return {
    id: room.id,
    hostId: room.hostId,
    status: room.status,
    winnerId: room.winnerId,
    paragraph: room.status === "racing" || room.status === "finished" ? room.paragraph : null,
    startedAt: room.startedAt,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      mode: p.mode,
      progress: p.progress,
      wpm: p.wpm,
      accuracy: p.accuracy,
      finished: p.finished,
      finishTime: p.finishTime,
      rank: p.rank,
    })),
  };
}

server.listen(PORT, () => {
  console.log(`TypeRacer running at http://localhost:${PORT}`);
});
