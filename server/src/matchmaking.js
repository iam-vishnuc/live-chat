const fs = require('fs');
const path = require('path');

module.exports = function handleMatch(socket, io, waitingUserRef) {
  // Function to attempt matching
  const attemptMatch = () => {
    // #region agent log
    const logPath = path.join(__dirname, '../../..', '.cursor', 'debug.log');
    try {
      fs.appendFileSync(logPath, JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'A',
        location: 'matchmaking.js:6',
        message: 'AttemptMatch entry',
        data: { socketId: socket.id, waitingUserExists: !!waitingUserRef.waitingUser, waitingUserId: waitingUserRef.waitingUser?.id || null, socketHasPartner: !!socket.partner },
        timestamp: Date.now()
      }) + '\n');
    } catch (e) {}
    // #endregion

    if (waitingUserRef.waitingUser && waitingUserRef.waitingUser.id !== socket.id) {
      const partner = waitingUserRef.waitingUser;
      
      // #region agent log
      try {
        fs.appendFileSync(logPath, JSON.stringify({
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'B',
          location: 'matchmaking.js:18',
          message: 'Before partner validation',
          data: { socketId: socket.id, partnerId: partner.id, partnerConnected: partner.connected, partnerHasPartner: !!partner.partner },
          timestamp: Date.now()
        }) + '\n');
      } catch (e) {}
      // #endregion
      
      // Validate that partner socket is still connected
      if (!partner.connected) {
        waitingUserRef.waitingUser = null;
        return false;
      }

      // CRITICAL FIX: Check if partner already has a partner (race condition protection)
      if (partner.partner) {
        // #region agent log
        try {
          fs.appendFileSync(logPath, JSON.stringify({
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'B',
            location: 'matchmaking.js:30',
            message: 'Partner already has a partner - race condition detected',
            data: { socketId: socket.id, partnerId: partner.id, partnerPartner: partner.partner },
            timestamp: Date.now()
          }) + '\n');
        } catch (e) {}
        // #endregion
        // Partner was already matched by another user, clear waiting user and return
        if (waitingUserRef.waitingUser === partner) {
          waitingUserRef.waitingUser = null;
        }
        return false;
      }

      // CRITICAL FIX: Check if current socket already has a partner
      if (socket.partner) {
        // #region agent log
        try {
          fs.appendFileSync(logPath, JSON.stringify({
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'B',
            location: 'matchmaking.js:45',
            message: 'Socket already has a partner - skipping match',
            data: { socketId: socket.id, socketPartner: socket.partner, partnerId: partner.id },
            timestamp: Date.now()
          }) + '\n');
        } catch (e) {}
        // #endregion
        return false;
      }

      // #region agent log
      try {
        fs.appendFileSync(logPath, JSON.stringify({
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'D',
          location: 'matchmaking.js:55',
          message: 'Before atomic matching - setting waitingUserRef to null',
          data: { socketId: socket.id, partnerId: partner.id, partnerHasPartner: !!partner.partner },
          timestamp: Date.now()
        }) + '\n');
      } catch (e) {}
      // #endregion

      // CRITICAL FIX: Atomic operation - set waitingUserRef to null first, then assign partners
      // This prevents another user from seeing the same waiting user
      waitingUserRef.waitingUser = null;

      // Double-check partner still doesn't have a partner (race condition check)
      if (partner.partner) {
        // #region agent log
        try {
          fs.appendFileSync(logPath, JSON.stringify({
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'A',
            location: 'matchmaking.js:68',
            message: 'Race condition detected - partner got matched by another user',
            data: { socketId: socket.id, partnerId: partner.id, partnerPartner: partner.partner },
            timestamp: Date.now()
          }) + '\n');
        } catch (e) {}
        // #endregion
        return false;
      }

      // #region agent log
      try {
        fs.appendFileSync(logPath, JSON.stringify({
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'D',
          location: 'matchmaking.js:78',
          message: 'After setting waitingUserRef to null, before partner assignment',
          data: { socketId: socket.id, partnerId: partner.id, partnerHasPartner: !!partner.partner },
          timestamp: Date.now()
        }) + '\n');
      } catch (e) {}
      // #endregion

      socket.partner = partner.id;
      partner.partner = socket.id;

      // #region agent log
      try {
        fs.appendFileSync(logPath, JSON.stringify({
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'A',
          location: 'matchmaking.js:85',
          message: 'After partner assignment',
          data: { socketId: socket.id, partnerId: partner.id, socketPartner: socket.partner, partnerPartner: partner.partner },
          timestamp: Date.now()
        }) + '\n');
      } catch (e) {}
      // #endregion

      console.log("🔗 MATCHED:");
      console.log("   User 1:", socket.id, "↔️ User 2:", partner.id);
      
      socket.emit("paired", partner.id);
      partner.emit("paired", socket.id);
      return true;
    }
    return false;
  };

  // Handle "join" event - user wants to start chatting
  socket.on("join", () => {
    console.log("📥 Join request from:", socket.id);
    
    // Try to match immediately
    if (!attemptMatch()) {
      // No partner available, add to waiting queue
      waitingUserRef.waitingUser = socket;
      console.log("⏳ User waiting:", socket.id);
      socket.emit("waiting");
    }
  });

  // Also try to match on initial connection (for backward compatibility)
  if (!attemptMatch()) {
    // Don't add to queue on connection, wait for "join" event
    console.log("👤 User connected but not in queue yet:", socket.id);
  }
};
