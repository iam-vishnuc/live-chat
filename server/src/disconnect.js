module.exports = function handleDisconnect(socket, io, waitingUserRef) {
    socket.on("disconnect", () => {
      console.log("❌ Disconnected:", socket.id);
      console.log("   Remaining connections:", io.sockets.sockets.size);
  
      if (waitingUserRef.waitingUser === socket) {
        waitingUserRef.waitingUser = null;
        console.log("   Removed from waiting queue");
      }
  
      if (socket.partner) {
        console.log("   Notifying partner:", socket.partner);
        const partnerSocket = io.sockets.sockets.get(socket.partner);
        if (partnerSocket) {
          // Clean up partner's reference
          partnerSocket.partner = null;
          // Clear chat for partner
          partnerSocket.emit("clear-chat");
        }
        io.to(socket.partner).emit("partner-disconnected");
      }
    });
  };
  