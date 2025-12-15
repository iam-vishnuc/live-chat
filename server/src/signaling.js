module.exports = function handleSignaling(socket, io) {
    socket.on("offer", (data) => {
      if (socket.partner) io.to(socket.partner).emit("offer", data);
    });
  
    socket.on("answer", (data) => {
      if (socket.partner) io.to(socket.partner).emit("answer", data);
    });
  
    socket.on("ice-candidate", (data) => {
      if (socket.partner) io.to(socket.partner).emit("ice-candidate", data);
    });
  };
  