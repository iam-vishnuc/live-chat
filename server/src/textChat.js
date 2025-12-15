module.exports = function handleTextChat(socket, io) {
  // Maximum message length to prevent abuse
  const MAX_MESSAGE_LENGTH = 1000;

  // Handle incoming text messages
  socket.on("message", (msg) => {
    // Validate message
    if (!msg || typeof msg !== "string") {
      socket.emit("error", "Invalid message format");
      return;
    }

    // Trim and validate message length
    const trimmedMsg = msg.trim();
    if (trimmedMsg.length === 0) {
      return; // Silently ignore empty messages
    }

    if (trimmedMsg.length > MAX_MESSAGE_LENGTH) {
      socket.emit("error", `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }

    // Check if user has a partner
    if (!socket.partner) {
      socket.emit("error", "No partner connected");
      return;
    }

    // Check if partner socket still exists
    const partnerSocket = io.sockets.sockets.get(socket.partner);
    if (!partnerSocket) {
      socket.emit("error", "Partner disconnected");
      socket.partner = null;
      return;
    }

    // Forward message to partner
    try {
      io.to(socket.partner).emit("message", trimmedMsg);
      console.log(`Message from ${socket.id} to ${socket.partner}: ${trimmedMsg.substring(0, 50)}...`);
    } catch (error) {
      console.error("Error sending message:", error);
      socket.emit("error", "Failed to send message");
    }
  });

  // Handle typing indicators
  socket.on("typing", () => {
    if (socket.partner) {
      io.to(socket.partner).emit("partner-typing");
    }
  });

  socket.on("stop-typing", () => {
    if (socket.partner) {
      io.to(socket.partner).emit("partner-stop-typing");
    }
  });
};
  