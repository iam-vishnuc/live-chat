const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// Import modular handlers
const handleMatch = require("./src/matchmaking");
const handleTextChat = require("./src/textChat");
const handleSignaling = require("./src/signaling");
const handleDisconnect = require("./src/disconnect");
const handleSkip = require("./src/skip");

const app = express();
app.use(cors());
app.use(express.static("public")); // serve frontend files

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

// Shared state for waiting user (passed by reference)
const sharedState = {
  waitingUser: null
};

io.on("connection", (socket) => {
  console.log("✅ New connection:", socket.id);
  console.log("   Total connections:", io.sockets.sockets.size);

  // Initialize all handlers with socket, io, and shared state
  handleMatch(socket, io, sharedState);
  handleTextChat(socket, io);
  handleSignaling(socket, io);
  handleDisconnect(socket, io, sharedState);
  handleSkip(socket, io, sharedState);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
