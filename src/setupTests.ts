import '@testing-library/jest-dom';

// Mock WebGL and related things that jsdom doesn't support
if (typeof window !== 'undefined') {
  global.AudioContext = class {
    createGain() { return { connect: () => {}, gain: { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, setTargetAtTime: () => {} } }; }
    createMediaElementSource() { return { connect: () => {} }; }
    createOscillator() { return { type: '', frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {}, start: () => {}, stop: () => {} }; }
    createBuffer() { return { getChannelData: () => new Float32Array() }; }
    createBufferSource() { return { buffer: null, connect: () => {}, start: () => {}, stop: () => {} }; }
    createBiquadFilter() { return { type: '', frequency: { value: 0 }, connect: () => {} }; }
    get currentTime() { return 0; }
    get sampleRate() { return 44100; }
    get destination() { return {}; }
  } as any;
  
  (window as any).HTMLMediaElement.prototype.play = () => Promise.resolve();
  (window as any).HTMLMediaElement.prototype.pause = () => {};
}
