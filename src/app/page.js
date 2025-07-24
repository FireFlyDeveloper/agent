'use client';

import React, { useEffect, useRef, useState } from 'react';

const MicStream = () => {
  const wsRef = useRef(null);
  const micAudioCtxRef = useRef(null);
  const playAudioCtxRef = useRef(null);
  const workletNodeRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;
  const isMountedRef = useRef(false);
  
  // UI States
  const [isListening, setIsListening] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState("Ani is resting...");
  const [isProcessing, setIsProcessing] = useState(false);
  const [liquidAnim, setLiquidAnim] = useState(false);
  const [orbScale, setOrbScale] = useState(1);
  const [orbColor, setOrbColor] = useState('bg-white/10');
  const [messageOpacity, setMessageOpacity] = useState(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (wsRef.current) wsRef.current.close();
    if (micAudioCtxRef.current) micAudioCtxRef.current.close();
    if (playAudioCtxRef.current) playAudioCtxRef.current.close();
    setIsConnected(false);
    setIsListening(false);
  };

  const animateStateChange = (newMessage, newColor, newScale, isLiquid) => {
    setMessageOpacity(0);
    setTimeout(() => {
      if (!isMountedRef.current) return;
      setAssistantMessage(newMessage);
      setOrbColor(newColor);
      setLiquidAnim(isLiquid);
      setOrbScale(newScale * 0.95);
      setTimeout(() => {
        if (isMountedRef.current) setOrbScale(newScale);
      }, 150);
      setTimeout(() => {
        if (isMountedRef.current) setMessageOpacity(1);
      }, 100);
    }, 200);
  };

  const setupWebSocket = () => {
    if (!isMountedRef.current) return;
    wsRef.current = new WebSocket('wss://192.168.100.99:3300/ws');
    
    wsRef.current.binaryType = 'arraybuffer';

    wsRef.current.onopen = () => {
      setIsConnected(true);
      reconnectAttemptRef.current = 0;
      animateStateChange("Ani is ready...", 'bg-white/10', 1, false);
    };

    wsRef.current.onclose = () => {
      setIsConnected(false);
      setIsListening(false);
      if (reconnectAttemptRef.current < maxReconnectAttempts) {
        reconnectAttemptRef.current++;
        animateStateChange("Reconnecting...", 'bg-gray-900/30', 1, false);
        setTimeout(setupWebSocket, reconnectDelay);
      } else {
        animateStateChange("Ani disconnected", 'bg-gray-900/30', 1, false);
      }
    };

    wsRef.current.onerror = () => {
      animateStateChange("Connection error", 'bg-gray-900/30', 1, false);
    };

    wsRef.current.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        // Text messages: DETECTED, STOPPED, TRANSCRIPT...
        const msg = event.data;
        if (msg === "DETECTED") {
          setIsListening(true);
          animateStateChange("Ani is listening...", 'bg-cyan-400/20', 1.05, true);
        } else if (msg === "STOPPED") {
          setIsListening(false);
          animateStateChange("Ani is thinking...", 'bg-purple-400/20', 1.02, false);
          setIsProcessing(true);
          // reset UI after a moment
          setTimeout(() => {
            if (isMountedRef.current) {
              setIsProcessing(false);
              animateStateChange("Ani is ready...", 'bg-white/10', 1, false);
            }
          }, 2000);
        } else if (msg.startsWith("TRANSCRIPT: ")) {
          // you might display it if needed
          // const text = msg.replace("TRANSCRIPT: ", "");
        } else if (msg === "NO_TRANSCRIPT") {
          // handle no-transcript...
        }
      } else {
        // Binary audio frame (raw PCM int16 @ 24000 Hz)
        const arrayBuffer = event.data;
        const int16 = new Int16Array(arrayBuffer);
        // convert to float32 in [-1,1]
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / 32768;
        }
        // create or reuse playback context
        const playCtx = playAudioCtxRef.current
          ?? new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        playAudioCtxRef.current = playCtx;

        // build AudioBuffer
        const buffer = playCtx.createBuffer(1, float32.length, 24000);
        buffer.copyToChannel(float32, 0, 0);

        // play it
        const src = playCtx.createBufferSource();
        src.buffer = buffer;
        src.connect(playCtx.destination);
        src.start();
      }
    };
  };

  const startStreaming = async () => {
    try {
      if (isConnected && isListening) return;
      animateStateChange("Ani waking up...", 'bg-amber-400/20', 1.03, false);
      setupWebSocket();
      
      // setup mic capture
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });
      micAudioCtxRef.current = audioCtx;
      await audioCtx.audioWorklet.addModule('/audioProcessor.js');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      const source = audioCtx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioCtx, 'audio-processor');
      workletNodeRef.current = workletNode;
      workletNode.port.onmessage = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(e.data);
        }
      };
      source.connect(workletNode);
      workletNode.connect(audioCtx.destination);
    } catch (error) {
      animateStateChange("Mic error", 'bg-red-400/20', 1, false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      {/* Liquid Orb Container */}
      <div 
        className={`relative w-32 h-32 rounded-full border backdrop-blur-lg shadow-lg transition-all duration-300 ${
          isConnected ? 'border-cyan-400/50' : 'border-gray-600/30'
        } ${liquidAnim ? 'animate-liquid' : ''}`}
        onClick={startStreaming}
        style={{
          transform: `scale(${orbScale})`,
          background: isConnected ? 'radial-gradient(circle, rgba(16,24,39,0.3) 0%, rgba(6,182,212,0.1) 100%)' : 'radial-gradient(circle, rgba(16,24,39,0.3) 0%, rgba(75,85,99,0.1) 100%)'
        }}
      >
        {/* Liquid Animation Elements */}
        {liquidAnim && (
          <>
            <div className="absolute top-1/4 left-1/4 w-8 h-8 bg-cyan-400/40 rounded-full animate-liquid-move-1 transition-all duration-700"></div>
            <div className="absolute bottom-1/3 right-1/3 w-6 h-6 bg-cyan-300/30 rounded-full animate-liquid-move-2 transition-all duration-700"></div>
            <div className="absolute top-1/3 right-1/4 w-5 h-5 bg-cyan-200/20 rounded-full animate-liquid-move-3 transition-all duration-700"></div>
          </>
        )}

        {/* Core Orb */}
        <div className={`absolute inset-6 rounded-full flex items-center justify-center transition-all duration-500 ${orbColor}`}>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-10 w-10 transition-all duration-300 ${
              isListening 
                ? 'text-cyan-300 scale-110' 
                : isProcessing 
                  ? 'text-purple-300 scale-105' 
                  : 'text-white/80 scale-100'
            }`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={isListening ? 2 : (isProcessing ? 1.8 : 1.5)} 
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" 
            />
          </svg>
        </div>

        {/* Status Pulse */}
        {isConnected && (
          <div className={`absolute inset-0 rounded-full border ${
            isListening 
              ? 'border-cyan-300/60' 
              : isProcessing 
                ? 'border-purple-300/50' 
                : 'border-cyan-500/30'
          } animate-ping opacity-0 transition-all duration-700`}></div>
        )}

        {/* Message Bubble */}
        <div 
          className={`absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 px-4 py-2 rounded-lg bg-black/80 backdrop-blur-sm text-white text-center text-sm max-w-xs transition-all duration-300`}
          style={{ opacity: messageOpacity }}
        >
          {assistantMessage}
          <div className="absolute bottom-0 left-1/2 w-3 h-3 bg-black/80 transform rotate-45 -mb-1 -translate-x-1/2 transition-all duration-300"></div>
        </div>
      </div>

      {/* Custom Animations */}
      <style jsx>{`
        @keyframes liquid {
          0%, 100% { border-radius: 60% 40% 30% 70%/60% 30% 70% 40%; }
          50% { border-radius: 30% 60% 70% 40%/50% 60% 30% 60%; }
        }
        @keyframes liquid-move-1 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.6; }
          50% { transform: translate(10px, 5px) scale(1.1); opacity: 0.9; }
        }
        @keyframes liquid-move-2 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.4; }
          50% { transform: translate(-5px, 8px) scale(1.05); opacity: 0.7; }
        }
        @keyframes liquid-move-3 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
          50% { transform: translate(5px, -5px) scale(1.03); opacity: 0.5; }
        }
        .animate-liquid {
          animation: liquid 8s ease-in-out infinite;
        }
        .animate-liquid-move-1 {
          animation: liquid-move-1 7s ease-in-out infinite;
        }
        .animate-liquid-move-2 {
          animation: liquid-move-2 5s ease-in-out infinite;
        }
        .animate-liquid-move-3 {
          animation: liquid-move-3 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default MicStream;