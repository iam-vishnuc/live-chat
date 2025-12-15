import React, { useState, useEffect, useRef } from "react";

export default function TextChat({ socket, onSkip }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Receive messages
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg) => {
      setMessages(prev => [...prev, { from: "stranger", text: msg, timestamp: new Date() }]);
    };

    const handleError = (errorMsg) => {
      setError(errorMsg);
      setTimeout(() => setError(""), 3000);
    };

    const handlePartnerTyping = () => {
      setIsTyping(true);
    };

    const handlePartnerStopTyping = () => {
      setIsTyping(false);
    };

    const handlePartnerSkipped = () => {
      setMessages(prev => [...prev, { from: "system", text: "Partner skipped", timestamp: new Date() }]);
    };

    const handleClearChat = () => {
      setMessages([]);
    };

    socket.on("message", handleMessage);
    socket.on("error", handleError);
    socket.on("partner-typing", handlePartnerTyping);
    socket.on("partner-stop-typing", handlePartnerStopTyping);
    socket.on("partner-skipped", handlePartnerSkipped);
    socket.on("clear-chat", handleClearChat);

    // Cleanup on unmount
    return () => {
      socket.off("message", handleMessage);
      socket.off("error", handleError);
      socket.off("partner-typing", handlePartnerTyping);
      socket.off("partner-stop-typing", handlePartnerStopTyping);
      socket.off("partner-skipped", handlePartnerSkipped);
      socket.off("clear-chat", handleClearChat);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [socket]);

  // Handle typing indicators
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);

    // Emit typing indicator
    if (value.trim() && socket) {
      socket.emit("typing");

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 1 second of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        if (socket) {
          socket.emit("stop-typing");
        }
      }, 1000);
    }
  };

  // Send message
  const sendMessage = () => {
    const trimmedInput = input.trim();
    if (trimmedInput === "" || !socket) return;
    
    // Emit stop typing
    socket.emit("stop-typing");
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send message
    socket.emit("message", trimmedInput);
    setMessages(prev => [...prev, { from: "me", text: trimmedInput, timestamp: new Date() }]);
    setInput("");
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="chat-container">
      {error && (
        <div className="error-message" style={{ 
          color: "red", 
          padding: "8px", 
          marginBottom: "10px",
          backgroundColor: "#ffe6e6",
          borderRadius: "4px",
          fontSize: "14px"
        }}>
          {error}
        </div>
      )}

      <div className="messages" style={{ 
        flex: 1,
        overflowY: "auto", 
        border: "1px solid #ddd",
        padding: "10px",
        marginBottom: "10px",
        borderRadius: "4px",
        backgroundColor: "#f9f9f9",
        minHeight: 0
      }}>
        {messages.length === 0 ? (
          <p style={{ color: "#999", textAlign: "center", marginTop: "20px" }}>
            No messages yet. Start the conversation!
          </p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={m.from === "me" ? "message-me" : m.from === "system" ? "message-system" : "message-stranger"}
              style={{
                marginBottom: "10px",
                padding: "8px",
                borderRadius: "8px",
                backgroundColor: m.from === "me" ? "#007bff" : m.from === "system" ? "#ff9800" : "#e9ecef",
                color: m.from === "me" ? "white" : m.from === "system" ? "white" : "black",
                textAlign: m.from === "me" ? "right" : "left",
                maxWidth: m.from === "system" ? "100%" : "70%",
                marginLeft: m.from === "me" ? "auto" : m.from === "system" ? "auto" : "0",
                marginRight: m.from === "me" ? "0" : m.from === "system" ? "auto" : "auto"
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                {m.from === "me" ? "You" : m.from === "system" ? "System" : "Stranger"}
              </div>
              <div>{m.text}</div>
              {m.timestamp && (
                <div style={{ 
                  fontSize: "10px", 
                  opacity: 0.7, 
                  marginTop: "4px" 
                }}>
                  {formatTime(m.timestamp)}
                </div>
              )}
            </div>
          ))
        )}
        {isTyping && (
          <div style={{ 
            color: "#999", 
            fontStyle: "italic", 
            padding: "8px" 
          }}>
            Stranger is typing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-box" style={{ 
        display: "flex", 
        gap: "10px",
        alignItems: "center"
      }}>
        {onSkip && (
          <button
            onClick={onSkip}
            className="skip-btn"
            style={{
              padding: "10px 16px",
              backgroundColor: "#ff8c00",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "bold",
              whiteSpace: "nowrap",
              flexShrink: 0
            }}
          >
            Skip
          </button>
        )}
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="Type a message... (Press Enter to send)"
          style={{
            flex: 1,
            padding: "10px",
            border: "1px solid #ddd",
            borderRadius: "4px",
            fontSize: "14px"
          }}
          maxLength={1000}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim()}
          style={{
            padding: "10px 20px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: input.trim() ? "pointer" : "not-allowed",
            opacity: input.trim() ? 1 : 0.5,
            fontSize: "14px",
            fontWeight: "bold",
            flexShrink: 0
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
