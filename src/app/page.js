'use client';

import React, { useEffect, useRef } from 'react';

const MicStream = () => {
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const startStreaming = async () => {
    try {
      // Initialize WebSocket
      wsRef.current = new WebSocket('ws://192.168.100.99:3000/ws');
      
      // Setup audio context and worklet
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });
      audioContextRef.current = audioContext;
      
      // Register and load the worklet processor
      await audioContext.audioWorklet.addModule('/audioProcessor.js');
      
      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      
      // Create nodes
      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');
      workletNodeRef.current = workletNode;
      
      // Handle messages from worklet
      workletNode.port.onmessage = (event) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(event.data);
        }
      };
      
      // Connect nodes
      source.connect(workletNode);
      workletNode.connect(audioContext.destination);
      
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div>
      <button onClick={startStreaming}>Start Streaming</button>
    </div>
  );
};

export default MicStream;