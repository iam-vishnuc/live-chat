import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";

const VideoChat = forwardRef(({ socket, onVideoToggle, onAudioToggle }, ref) => {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const peer = useRef(null);
  const localStream = useRef(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [error, setError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");

  // Cleanup function
  const cleanup = () => {
    // Stop all tracks
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        track.stop();
      });
      localStream.current = null;
    }

    // Close peer connection
    if (peer.current) {
      peer.current.close();
      peer.current = null;
    }

    // Clear video sources
    if (localVideo.current) {
      localVideo.current.srcObject = null;
    }
    if (remoteVideo.current) {
      remoteVideo.current.srcObject = null;
    }
  };

  // Initialize WebRTC
  useEffect(() => {
    if (!socket) return;

    let isMounted = true;

    async function init() {
      try {
        // 1. Get camera + microphone
        try {
          localStream.current = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          });

          if (!isMounted) {
            cleanup();
            return;
          }

          if (localVideo.current) {
            localVideo.current.srcObject = localStream.current;
          }
        } catch (err) {
          console.error("Error accessing media devices:", err);
          setError("Could not access camera/microphone. Please check permissions.");
          setConnectionStatus("Media access denied");
          return;
        }

        // 2. Create peer connection
        peer.current = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" }
          ]
        });

        // 3. Add local tracks
        localStream.current.getTracks().forEach(track => {
          if (peer.current && localStream.current) {
            peer.current.addTrack(track, localStream.current);
          }
        });

        // 4. Handle connection state changes
        peer.current.onconnectionstatechange = () => {
          if (peer.current) {
            setConnectionStatus(peer.current.connectionState);
            if (peer.current.connectionState === "failed") {
              setError("Connection failed. Please try again.");
            }
          }
        };

        // 5. When remote video arrives
        peer.current.ontrack = (event) => {
          if (remoteVideo.current && event.streams[0]) {
            remoteVideo.current.srcObject = event.streams[0];
            setConnectionStatus("Connected");
          }
        };

        // 6. Send ICE candidates
        peer.current.onicecandidate = (event) => {
          if (event.candidate && socket) {
            socket.emit("ice-candidate", event.candidate);
          }
        };

        // 7. Handle ICE connection state
        peer.current.oniceconnectionstatechange = () => {
          if (peer.current) {
            if (peer.current.iceConnectionState === "disconnected" || 
                peer.current.iceConnectionState === "failed") {
              setConnectionStatus("Disconnected");
            }
          }
        };

        // Socket event handlers
        const handlePaired = async () => {
          if (!peer.current) return;
          try {
            const offer = await peer.current.createOffer();
            await peer.current.setLocalDescription(offer);
            if (socket) {
              socket.emit("offer", offer);
            }
            setConnectionStatus("Connecting...");
          } catch (err) {
            console.error("Error creating offer:", err);
            setError("Failed to create connection offer");
          }
        };

        const handleOffer = async (offer) => {
          if (!peer.current) return;
          try {
            await peer.current.setRemoteDescription(offer);
            const answer = await peer.current.createAnswer();
            await peer.current.setLocalDescription(answer);
            if (socket) {
              socket.emit("answer", answer);
            }
            setConnectionStatus("Connecting...");
          } catch (err) {
            console.error("Error handling offer:", err);
            setError("Failed to handle connection offer");
          }
        };

        const handleAnswer = async (answer) => {
          if (!peer.current) return;
          try {
            await peer.current.setRemoteDescription(answer);
          } catch (err) {
            console.error("Error handling answer:", err);
            setError("Failed to handle connection answer");
          }
        };

        const handleIceCandidate = async (candidate) => {
          if (!peer.current) return;
          try {
            await peer.current.addIceCandidate(candidate);
          } catch (err) {
            console.error("ICE Error:", err);
            // Don't show error for ICE candidates as they're common
          }
        };

        const handlePartnerDisconnected = () => {
          setConnectionStatus("Partner disconnected");
          cleanup();
          // Reinitialize for new connection
          setTimeout(() => {
            if (isMounted) {
              init();
            }
          }, 1000);
        };

        // Register socket event listeners
        socket.on("paired", handlePaired);
        socket.on("offer", handleOffer);
        socket.on("answer", handleAnswer);
        socket.on("ice-candidate", handleIceCandidate);
        socket.on("partner-disconnected", handlePartnerDisconnected);

        // Cleanup function
        return () => {
          socket.off("paired", handlePaired);
          socket.off("offer", handleOffer);
          socket.off("answer", handleAnswer);
          socket.off("ice-candidate", handleIceCandidate);
          socket.off("partner-disconnected", handlePartnerDisconnected);
        };
      } catch (err) {
        console.error("Initialization error:", err);
        setError("Failed to initialize video chat");
        setConnectionStatus("Error");
      }
    }

    init();

    // Cleanup on unmount
    return () => {
      isMounted = false;
      cleanup();
    };
  }, [socket]);

  // Toggle video
  const toggleVideo = () => {
    if (localStream.current) {
      const videoTrack = localStream.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        if (onVideoToggle) {
          onVideoToggle(videoTrack.enabled);
        }
      }
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        if (onAudioToggle) {
          onAudioToggle(audioTrack.enabled);
        }
      }
    }
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    toggleVideo,
    toggleAudio
  }));

  return (
    <div className="video-container" style={{ 
      position: "relative",
      height: "100%",
      borderRadius: "8px",
      overflow: "hidden",
      backgroundColor: "#000",
      display: "flex",
      flexDirection: "column"
    }}>
      {error && (
        <div style={{
          position: "absolute",
          top: "10px",
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "rgba(255, 0, 0, 0.8)",
          color: "white",
          padding: "8px 16px",
          borderRadius: "4px",
          zIndex: 10,
          fontSize: "14px"
        }}>
          {error}
        </div>
      )}

      <div style={{
        position: "absolute",
        top: "10px",
        right: "10px",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        color: "white",
        padding: "4px 8px",
        borderRadius: "4px",
        fontSize: "12px",
        zIndex: 10
      }}>
        {connectionStatus}
      </div>

      <div className="video-grid-container" style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        minHeight: 0,
        padding: "10px"
      }}>
        {/* Top section - Partner/Stranger video */}
        <div className="video-square" style={{ 
          position: "relative", 
          backgroundColor: "#1a1a1a",
          width: "400px",
          height: "400px",
          maxWidth: "100%",
          aspectRatio: "1 / 1"
        }}>
          <video
            ref={remoteVideo}
            autoPlay
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover"
            }}
          />
          <div style={{
            position: "absolute",
            bottom: "10px",
            left: "10px",
            color: "white",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "12px"
          }}>
            Stranger
          </div>
          {!remoteVideo.current?.srcObject && (
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              color: "#999",
              textAlign: "center",
              fontSize: "16px"
            }}>
              Waiting for partner...
            </div>
          )}
        </div>

        {/* Bottom section - Your video */}
        <div className="video-square" style={{ 
          position: "relative", 
          backgroundColor: "#1a1a1a",
          width: "400px",
          height: "400px",
          maxWidth: "100%",
          aspectRatio: "1 / 1"
        }}>
          <video
            ref={localVideo}
            autoPlay
            muted
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover"
            }}
          />
          <div style={{
            position: "absolute",
            bottom: "10px",
            left: "10px",
            color: "white",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "12px"
          }}>
            You
          </div>
        </div>
      </div>

    </div>
  );
});

VideoChat.displayName = 'VideoChat';

export default VideoChat;
