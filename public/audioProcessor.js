class AudioProcessor extends AudioWorkletProcessor {
  process(inputs, _outputs) {
    const input = inputs[0];
    if (input.length > 0) {
      const inputData = input[0];
      const int16Data = new Int16Array(inputData.length);
      
      // Convert Float32 to Int16
      for (let i = 0; i < inputData.length; i++) {
        int16Data[i] = Math.min(32767, Math.max(-32768, inputData[i] * 32767));
      }
      
      // Send to main thread
      this.port.postMessage(int16Data.buffer, [int16Data.buffer]);
    }
    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);