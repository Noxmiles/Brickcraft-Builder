export const AudioEngine = {
  ctx: null as AudioContext | null,
  masterGain: null as GainNode | null,
  sfxGain: null as GainNode | null,
  ambientGain: null as GainNode | null,
  musicGain: null as GainNode | null,
  
  // Music tracks
  musicAudio: null as HTMLAudioElement | null,
  ambientAudio: null as HTMLAudioElement | null,
  musicTracks: [
    '/music/midnight-jazz-cafe.mp3',
    '/music/rainy-afternoon-chords.mp3',
    '/music/rainy-day-contemplation.mp3'
  ],
  currentTrackIndex: 0,
  isInitialized: false,
  
  init() {
    if (this.isInitialized) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.ambientGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      
      this.masterGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.masterGain);
      this.ambientGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      
      // Initialize internal gains to 0. React state will bring them up.
      this.ambientGain.gain.value = 0;
      this.musicGain.gain.value = 0;

      this.setupWind();
      this.setupMusic();
      this.isInitialized = true;
    } catch (e) {
      console.warn("Audio Context failed to initialize", e);
    }
  },

  setupMusic() {
    if (!this.ctx || !this.musicGain) return;
    this.musicAudio = new Audio();
    this.musicAudio.crossOrigin = "anonymous";
    const source = this.ctx.createMediaElementSource(this.musicAudio);
    source.connect(this.musicGain);

    this.musicAudio.onended = () => {
      this.playNextTrack();
    };
  },

  playNextTrack() {
    if (!this.musicAudio) return;
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.musicTracks.length;
    this.musicAudio.src = this.musicTracks[this.currentTrackIndex];
    this.musicAudio.play().catch(() => {});
  },

  setupWind() {
    if (!this.ctx || !this.ambientGain) return;
    this.ambientAudio = new Audio('/music/freesound_community-windy-forest-32853.mp3');
    this.ambientAudio.crossOrigin = "anonymous";
    this.ambientAudio.loop = true;
    const source = this.ctx.createMediaElementSource(this.ambientAudio);
    source.connect(this.ambientGain);
  },

  playClick() {
    if (!this.isInitialized) return;
    if (this.ctx?.state === 'suspended') this.ctx.resume();
    if (!this.ctx || !this.sfxGain) return;
    
    const t = this.ctx.currentTime + 0.01;
    
    // Impact 1: Depth/Thud
    const osc1 = this.ctx.createOscillator();
    const g1 = this.ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(150, t);
    osc1.frequency.exponentialRampToValueAtTime(45, t + 0.05);
    g1.gain.setValueAtTime(0.25, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc1.connect(g1);
    g1.connect(this.sfxGain);

    // Impact 2: Sharp plastic click
    const bufSize = this.ctx.sampleRate * 0.02;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    for(let i=0; i<bufSize; i++) buf.getChannelData(0)[i] = (Math.random() * 2 - 1) * 0.3;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 3200;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.22, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.018);
    noise.connect(filter);
    filter.connect(ng);
    ng.connect(this.sfxGain);

    osc1.start(t);
    noise.start(t);
    osc1.stop(t + 0.05);
    noise.stop(t + 0.02);
  },

  playPop() {
    if (!this.isInitialized || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime + 0.01;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.08);
  },

  playShot(damage: number) {
    if (!this.isInitialized || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime + 0.01;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    if (damage >= 100) {
      // Heavy cannon - very deep sound
      osc.type = 'square';
      osc.frequency.setValueAtTime(80, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.15);
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    } else {
      // Rapid shredder - lighter pop
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.05);
      g.gain.setValueAtTime(0.1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    }

    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.2);
  },

  setSfxVolume(v: number) { 
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(v, this.ctx?.currentTime || 0, 0.1); 
  },
  setAmbientVolume(v: number) { 
    if (this.ambientGain) this.ambientGain.gain.setTargetAtTime(v, this.ctx?.currentTime || 0, 0.1);
    if (v > 0 && this.ambientAudio && this.ambientAudio.paused) {
      this.ambientAudio.play().catch(() => {});
    } else if (v === 0 && this.ambientAudio) {
      this.ambientAudio.pause();
    }
  },
  setMusicVolume(v: number) { 
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(v, this.ctx?.currentTime || 0, 0.1);
    
    if (v > 0 && this.musicAudio && this.musicAudio.paused) {
      if (!this.musicAudio.src) {
        this.musicAudio.src = this.musicTracks[this.currentTrackIndex];
      }
      this.musicAudio.play().catch(() => {});
    } else if (v === 0 && this.musicAudio) {
      this.musicAudio.pause();
    }
  }
};
