const fs = require('fs');
const path = require('path');

module.exports = function handleSkip(socket, io, waitingUserRef) {
  socket.on("skip", () => {
    // #region agent log
    const logPath = path.join(__dirname, '../../..', '.cursor', 'debug.log');
    try {
      fs.appendFileSync(logPath, JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'E',
        location: 'skip.js:4',
        message: 'Skip event entry',
        data: { socketId: socket.id, hasPartner: !!socket.partner, partnerId: socket.partner || null, waitingUserExists: !!waitingUserRef.waitingUser, waitingUserId: waitingUserRef.waitingUser?.id || null },
        timestamp: Date.now()
      }) + '\n');
    } catch (e) {}
    // #endregion

    if (socket.partner) {
      const oldPartner = socket.partner;
      const partnerSocket = io.sockets.sockets.get(oldPartner);
      
      // Clear chat and notify partner that they've been skipped
      if (partnerSocket) {
        partnerSocket.emit("partner-skipped");
        partnerSocket.emit("clear-chat");
      }
      
      // Clear chat for current user
      socket.emit("clear-chat");
      

      // Notify partner that they've been disconnected (for backward compatibility)
      io.to(oldPartner).emit("partner-disconnected");
      socket.partner = null;
      
      if (partnerSocket) {
        partnerSocket.partner = null;
        
        // Put them in queue or match immediately if someone is waiting
        if (!waitingUserRef.waitingUser) {
          waitingUserRef.waitingUser = partnerSocket;
          partnerSocket.emit("waiting");
        } else {
          // Match immediately if someone is waiting
          const newPartner = waitingUserRef.waitingUser;
          
          // #region agent log
          try {
            fs.appendFileSync(logPath, JSON.stringify({
              sessionId: 'debug-session',
              runId: 'run1',
              hypothesisId: 'C',
              location: 'skip.js:35',
              message: 'Matching old partner with waiting user',
              data: { socketId: socket.id, oldPartnerId: oldPartner, newPartnerId: newPartner.id, newPartnerHasPartner: !!newPartner.partner, partnerSocketHasPartner: !!partnerSocket.partner },
              timestamp: Date.now()
            }) + '\n');
          } catch (e) {}
          // #endregion

          // CRITICAL FIX: Check if waiting user or partner socket already has a partner
          if (newPartner.partner || partnerSocket.partner) {
            // #region agent log
            try {
              fs.appendFileSync(logPath, JSON.stringify({
                sessionId: 'debug-session',
                runId: 'run1',
                hypothesisId: 'C',
                location: 'skip.js:48',
                message: 'Cannot match - one already has partner',
                data: { socketId: socket.id, oldPartnerId: oldPartner, newPartnerId: newPartner.id, newPartnerHasPartner: !!newPartner.partner, partnerSocketHasPartner: !!partnerSocket.partner },
                timestamp: Date.now()
              }) + '\n');
            } catch (e) {}
            // #endregion
            // Put partnerSocket in queue instead
            waitingUserRef.waitingUser = partnerSocket;
            partnerSocket.emit("waiting");
          } else {
            waitingUserRef.waitingUser = null;
            
            partnerSocket.partner = newPartner.id;
            newPartner.partner = partnerSocket.id;
            
            partnerSocket.emit("paired", newPartner.id);
            newPartner.emit("paired", partnerSocket.id);
          }
        }
      }
    }
    
    // Put current user back into queue
    socket.partner = null;
    
    // #region agent log
    try {
      fs.appendFileSync(logPath, JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'E',
        location: 'skip.js:55',
        message: 'Before matching current user',
        data: { socketId: socket.id, waitingUserExists: !!waitingUserRef.waitingUser, waitingUserId: waitingUserRef.waitingUser?.id || null, waitingUserHasPartner: waitingUserRef.waitingUser?.partner || null },
        timestamp: Date.now()
      }) + '\n');
    } catch (e) {}
    // #endregion

    if (!waitingUserRef.waitingUser) {
      waitingUserRef.waitingUser = socket;
      socket.emit("waiting");
    } else {
      // Match immediately if someone is waiting
      const newPartner = waitingUserRef.waitingUser;
      
      // #region agent log
      try {
        fs.appendFileSync(logPath, JSON.stringify({
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'C',
          location: 'skip.js:66',
          message: 'Matching current user with waiting user',
          data: { socketId: socket.id, newPartnerId: newPartner.id, newPartnerHasPartner: !!newPartner.partner, socketHasPartner: !!socket.partner, isSelfMatch: newPartner.id === socket.id },
          timestamp: Date.now()
        }) + '\n');
      } catch (e) {}
      // #endregion

      // CRITICAL FIX: Prevent matching with self (double skip protection)
      if (newPartner.id === socket.id) {
        // #region agent log
        try {
          fs.appendFileSync(logPath, JSON.stringify({
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'F',
            location: 'skip.js:75',
            message: 'Prevented self-match - user is already in waiting queue',
            data: { socketId: socket.id },
            timestamp: Date.now()
          }) + '\n');
        } catch (e) {}
        // #endregion
        // User is already in queue, just emit waiting again
        socket.emit("waiting");
        return;
      }

      // CRITICAL FIX: Check if waiting user or current socket already has a partner
      if (newPartner.partner || socket.partner) {
        // #region agent log
        try {
          fs.appendFileSync(logPath, JSON.stringify({
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'C',
            location: 'skip.js:90',
            message: 'Cannot match - one already has partner',
            data: { socketId: socket.id, newPartnerId: newPartner.id, newPartnerHasPartner: !!newPartner.partner, socketHasPartner: !!socket.partner },
            timestamp: Date.now()
          }) + '\n');
        } catch (e) {}
        // #endregion
        // Put socket in queue instead
        waitingUserRef.waitingUser = socket;
        socket.emit("waiting");
      } else {
        waitingUserRef.waitingUser = null;
        
        socket.partner = newPartner.id;
        newPartner.partner = socket.id;
        
        socket.emit("paired", newPartner.id);
        newPartner.emit("paired", socket.id);
      }
    }
  });
};

