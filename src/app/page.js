'use client';

import React, { useEffect, useRef, useState } from 'react';

const MicStream = () => {
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;
  const isMountedRef = useRef(false);
  
  // UI States
  const [isListening, setIsListening] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState("Hi, I'm Ani. Click below to start!");
  const [isProcessing, setIsProcessing] = useState(false);
  const [pulseAnimation, setPulseAnimation] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (wsRef.current) wsRef.current.close();
    if (audioContextRef.current) audioContextRef.current.close();
    setIsConnected(false);
    setIsListening(false);
  };

  const setupWebSocket = () => {
    if (!isMountedRef.current) return;

    wsRef.current = new WebSocket('wss://192.168.100.99:3000/ws');

    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      reconnectAttemptRef.current = 0;
      setAssistantMessage("Connected! Say 'Hey Ani' to wake me up.");
    };

    wsRef.current.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      setIsConnected(false);
      setIsListening(false);
      if (reconnectAttemptRef.current < maxReconnectAttempts) {
        reconnectAttemptRef.current += 1;
        setAssistantMessage(`Reconnecting... (${reconnectAttemptRef.current}/${maxReconnectAttempts})`);
        setTimeout(setupWebSocket, reconnectDelay);
      } else {
        setAssistantMessage("Connection failed. Please try again later.");
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setAssistantMessage("Connection error. Trying to reconnect...");
    };

    wsRef.current.onmessage = (event) => {
      const message = event.data;
      console.log('Received:', message);
      
      if (message === "DETECTED") {
        setIsListening(true);
        setPulseAnimation(true);
        setAssistantMessage("I'm listening... How can I help?");
      } 
      else if (message === "STOPPED") {
        setIsListening(false);
        setPulseAnimation(false);
        setIsProcessing(true);
        setAssistantMessage("Processing your request...");
        
        // Simulate processing completion after 2 seconds
        setTimeout(() => {
          if (isMountedRef.current) {
            setIsProcessing(false);
            setAssistantMessage("Ready for your next request. Say 'Hey Ani' again.");
          }
        }, 2000);
      }
    };
  };

  const startStreaming = async () => {
    try {
      if (isConnected && isListening) {
        setAssistantMessage("Already listening...");
        return;
      }

      setAssistantMessage("Initializing...");
      setupWebSocket();
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });
      audioContextRef.current = audioContext;
      
      await audioContext.audioWorklet.addModule('/audioProcessor.js');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      
      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');
      workletNodeRef.current = workletNode;
      
      workletNode.port.onmessage = (event) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(event.data);
        }
      };
      
      source.connect(workletNode);
      workletNode.connect(audioContext.destination);
      
      setAssistantMessage("Ready! Say 'Hey Ani' to wake me up.");
    } catch (error) {
      console.error('Error:', error);
      setAssistantMessage("Error initializing microphone. Please check permissions.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-800 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-3xl shadow-xl overflow-hidden border border-white/20">
        {/* Assistant Header */}
        <div className="bg-black/20 p-6 flex items-center space-x-4 border-b border-white/10">
          <div className={`relative ${pulseAnimation ? 'animate-pulse' : ''}`}>
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            {isListening && (
              <div className="absolute -inset-1 rounded-full border-2 border-cyan-300 animate-ping opacity-75"></div>
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Ani</h2>
            <p className="text-sm text-white/80">Your Personal Virtual Assistant</p>
          </div>
        </div>

        {/* Assistant Status */}
        <div className="p-6 space-y-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
            <span className="text-sm text-white/80">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Assistant Message Bubble */}
          <div className="bg-black/20 rounded-2xl p-4 min-h-20 flex items-center">
            <p className="text-white">
              {isProcessing ? (
                <span className="flex items-center space-x-2">
                  <span className="inline-block w-2 h-2 bg-white rounded-full animate-bounce"></span>
                  <span className="inline-block w-2 h-2 bg-white rounded-full animate-bounce delay-100"></span>
                  <span className="inline-block w-2 h-2 bg-white rounded-full animate-bounce delay-200"></span>
                </span>
              ) : (
                assistantMessage
              )}
            </p>
          </div>

          {/* Mic Button */}
          <button
            onClick={startStreaming}
            disabled={isProcessing}
            className={`w-full py-3 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all duration-300 ${
              isListening 
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : isConnected 
                  ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                  : 'bg-gray-500 cursor-not-allowed text-white/50'
            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isListening ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
                <span>Listening... (Click to stop)</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
                <span>{isConnected ? 'Start Listening' : 'Connect'}</span>
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="bg-black/20 p-3 text-center text-xs text-white/50 border-t border-white/10">
          Ani Assistant v1.0 • Managing your work, school, and schedules
        </div>
      </div>
    </div>
  );
};

export default MicStream;