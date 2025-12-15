import React, { useState, useEffect, useRef } from "react";
import VideoChat from "./components/VideoChat";
import TextChat from "./components/TextChat";
import { io } from "socket.io-client";
import "./App.css";

// Create a single socket instance for the whole app
// For local testing, use: http://localhost:5000
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";
const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

function App() {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Click 'Start Chat' to begin.");
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [partnerId, setPartnerId] = useState(null);
  const [mySocketId, setMySocketId] = useState(null);
  const videoChatRef = useRef(null);

  // Socket connection status
  useEffect(() => {
    socket.on("connect", () => {
      setSocketConnected(true);
      setMySocketId(socket.id);
      console.log("✅ Socket connected to:", socket.io.uri);
      console.log("✅ Socket ID:", socket.id);
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
      setMySocketId(null);
      console.log("❌ Socket disconnected");
    });

    socket.on("connect_error", (error) => {
      console.error("❌ Connection error:", error.message);
      setStatus("❌ Failed to connect to server. Check if server is running.");
    });

    // Check initial connection status
    if (socket.connected) {
      setSocketConnected(true);
      setMySocketId(socket.id);
      console.log("✅ Socket already connected:", socket.id);
    }

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
    };
  }, []);

  // Listen for partner events
  useEffect(() => {
    socket.on("waiting", () => {
      setStatus("⏳ Waiting for a partner...");
      setPartnerId(null);
      console.log("⏳ Waiting for partner...");
    });

    socket.on("paired", (partnerSocketId) => {
      setStatus("✅ Connected to a stranger!");
      setPartnerId(partnerSocketId);
      console.log("✅ Paired with partner:", partnerSocketId);
      console.log("Your Socket ID:", socket.id);
      console.log("Partner Socket ID:", partnerSocketId);
    });

    socket.on("partner-disconnected", () => {
      setStatus("⚠️ Partner disconnected. Reconnecting...");
      setPartnerId(null);
      console.log("⚠️ Partner disconnected");
    });

    // Cleanup on unmount
    return () => {
      socket.off("waiting");
      socket.off("paired");
      socket.off("partner-disconnected");
    };
  }, []);

  // Start chat
  const startChat = () => {
    if (!socketConnected) {
      console.error("❌ Socket not connected! Cannot start chat.");
      setStatus("❌ Not connected to server. Please refresh.");
      return;
    }
    
    setConnected(true);
    console.log("🚀 Starting chat, emitting 'join' event...");
    socket.emit("join"); // Signal backend that user wants to join queue
  };

  // Skip partner
  const handleSkip = () => {
    setStatus("Skipping current partner...");
    socket.emit("skip");
  };

  // Toggle video
  const toggleVideo = () => {
    if (videoChatRef.current) {
      videoChatRef.current.toggleVideo();
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (videoChatRef.current) {
      videoChatRef.current.toggleAudio();
    }
  };

  return (
    <div className="container">
      <nav className="navbar">
        <h1 className="navbar-title">Live Chat</h1>
        <div className="navbar-controls">
          {connected && (
            <div className="media-controls">
              <button
                className={`media-btn ${isVideoEnabled ? 'enabled' : 'disabled'}`}
                onClick={toggleVideo}
                title={isVideoEnabled ? "Turn off video" : "Turn on video"}
              >
                {isVideoEnabled ? "📹" : "📹"}
                <span>{isVideoEnabled ? "Video On" : "Video Off"}</span>
              </button>
              <button
                className={`media-btn ${isAudioEnabled ? 'enabled' : 'disabled'}`}
                onClick={toggleAudio}
                title={isAudioEnabled ? "Turn off audio" : "Turn on audio"}
              >
                {isAudioEnabled ? "🎤" : "🎤"}
                <span>{isAudioEnabled ? "Audio On" : "Audio Off"}</span>
              </button>
            </div>
          )}
          <div className="status-container">
            <p className="status">{status}</p>
            {connected && (
              <div className="connection-info">
                <span className={`connection-dot ${socketConnected ? 'connected' : 'disconnected'}`}></span>
                <span className="socket-info">
                  {socketConnected ? 'Connected' : 'Disconnected'}
                </span>
                {partnerId && (
                  <span className="partner-info">
                    | Partner: {partnerId.substring(0, 8)}...
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {!connected && (
        <div className="start-button-container">
          {!socketConnected && (
            <p style={{ color: "#dc3545", marginBottom: "10px" }}>
              ⚠️ Not connected to server. Please wait...
            </p>
          )}
          <button 
            className="start-btn" 
            onClick={startChat}
            disabled={!socketConnected}
            style={{ opacity: socketConnected ? 1 : 0.5, cursor: socketConnected ? "pointer" : "not-allowed" }}
          >
            Start Chat
          </button>
        </div>
      )}

      {connected && (
        <>
          <div className="chat-layout">
            <div className="video-section">
              <VideoChat 
                socket={socket} 
                ref={videoChatRef}
                onVideoToggle={setIsVideoEnabled}
                onAudioToggle={setIsAudioEnabled}
              />
            </div>
            <div className="chat-section">
              <TextChat socket={socket} onSkip={handleSkip} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
