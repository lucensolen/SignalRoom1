// AUDIO REACTIVE ENGINE
// Attaches to window.SignalAudio

(function () {
  const SignalAudio = {
    ctx: null,
    analyser: null,
    source: null,
    data: null,
    rafId: null,
    active: false,
    level: 0,

    async start(onLevelChange) {
      if (this.active) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn("SignalAudio: getUserMedia not supported.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: false,
        });

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = this.ctx || new AudioContext();
        this.source = this.ctx.createMediaStreamSource(stream);
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 1024;
        const bufferLength = this.analyser.frequencyBinCount;
        this.data = new Uint8Array(bufferLength);

        this.source.connect(this.analyser);
        this.active = true;

        const loop = () => {
          if (!this.active) return;
          this.analyser.getByteFrequencyData(this.data);
          let sum = 0;
          const len = this.data.length;
          for (let i = 0; i < len; i++) sum += this.data[i];
          const avg = len ? sum / len : 0;
          const norm = Math.min(1, Math.max(0, (avg - 20) / 120));
          this.level = norm;
          if (typeof onLevelChange === "function") onLevelChange(norm);
          this.rafId = requestAnimationFrame(loop);
        };
        loop();
      } catch (err) {
        console.warn("SignalAudio: mic access denied or failed.", err);
      }
    },

    stop() {
      this.active = false;
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = null;
      // Do not fully close AudioContext to keep mobile-friendly.
    },
  };

  window.SignalAudio = SignalAudio;
})();
