class AudioVisualizerMobile extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <style>
        @font-face {
          font-family: 'Polymath';
          src: url('Polymath-LightIt.woff2') format('woff2');
          font-weight: 300;
          font-style: italic;
          font-display: swap;
        }

        .av-m-root {
          position: fixed;
          top: 0; left: 0;
          width: 100vw;
          height: 100dvh;
          height: 100vh;
          background: #000;
          border-radius: 0;
          overflow: hidden;
          font-family: 'Polymath', 'Courier New', monospace;
        }

        /* Scanlines overlay */
        .av-m-root::after {
          content: '';
          position: absolute; inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.18) 2px,
            rgba(0,0,0,0.18) 4px
          );
          pointer-events: none;
          z-index: 6;
        }

        #av-m-bg, #av-m-canvas {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
        }
        #av-m-bg     { z-index: 0; }
        #av-m-canvas { z-index: 1; pointer-events: none; }

        /* Logo */
        .av-m-logo {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 140px; height: 140px;
          z-index: 4;
          cursor: pointer;
          border-radius: 50%;
          transition: transform 0.2s ease;
        }
        .av-m-logo:active { transform: translate(-50%, -50%) scale(0.93); }
        .av-m-logo.playing {
          animation: av-m-pulse 2s ease-in-out infinite;
        }
        .av-m-logo img {
          width: 100%; height: 100%;
          object-fit: contain;
          pointer-events: none;
          display: block;
        }
        @keyframes av-m-pulse {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(130,98,169,0.6)); }
          50%       { filter: drop-shadow(0 0 12px rgba(130,98,169,0.9)); }
        }

        /* Station label */
        .av-m-station {
          position: fixed;
          bottom: max(24px, env(safe-area-inset-bottom, 24px));
          left: max(24px, env(safe-area-inset-left, 24px));
          font-size: 11px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.3);
          pointer-events: none;
          z-index: 5;
        }

        /* Hint */
        .av-m-hint {
          position: fixed;
          bottom: max(24px, env(safe-area-inset-bottom, 24px));
          right: max(24px, env(safe-area-inset-right, 24px));
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.3);
          pointer-events: none;
          z-index: 5;
          white-space: nowrap;
          transition: opacity 0.4s ease;
        }
      </style>

      <div class="av-m-root" id="av-m-root">
        <canvas id="av-m-bg"></canvas>
        <canvas id="av-m-canvas"></canvas>

        <div class="av-m-logo" id="av-m-logo">
          <img src="https://static.wixstatic.com/media/eaaa6a_025d2967304a4a619c482e79944f38d9~mv2.png" alt="Wildcat 91.9" />
        </div>

        <div class="av-m-station">WILDCAT 91.9 · LIVE</div>
        <div class="av-m-hint" id="av-m-hint">TAP TO PLAY</div>

        <!-- Primary: plain audio for background-safe playback on iOS -->
        <audio id="av-m-audio" src="https://s.radiowave.io/ksdb.mp3"
               crossorigin="anonymous" playsinline></audio>
        <!-- Analyser tap: muted clone fed into AudioContext for visualizer only -->
        <audio id="av-m-tap" src="https://s.radiowave.io/ksdb.mp3"
               crossorigin="anonymous" playsinline muted></audio>
      </div>
    `;

    const root       = this.querySelector('#av-m-root');
    const audio      = this.querySelector('#av-m-audio');
    const audioTap   = this.querySelector('#av-m-tap');
    const logo       = this.querySelector('#av-m-logo');
    const hint       = this.querySelector('#av-m-hint');
    const bgCanvas   = this.querySelector('#av-m-bg');
    const mainCanvas = this.querySelector('#av-m-canvas');

    let W = window.innerWidth, H = window.innerHeight;
    function resize() {
      W = bgCanvas.width  = mainCanvas.width  = window.innerWidth;
      H = bgCanvas.height = mainCanvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Inject scroll lock into host page
    if (!document.getElementById('av-m-scroll-lock')) {
      const s = document.createElement('style');
      s.id = 'av-m-scroll-lock';
      s.textContent = 'html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;position:fixed;touch-action:none;}';
      document.head.appendChild(s);
    }

    const bgCtx  = bgCanvas.getContext('2d');
    const ctx    = mainCanvas.getContext('2d');

    /* ── Media Session ── */
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'You Belong.', artist: 'Wildcat 91.9', album: 'Live Stream',
        artwork: [{ src: 'https://static.wixstatic.com/media/eaaa6a_025d2967304a4a619c482e79944f38d9~mv2.png', sizes: '512x512', type: 'image/png' }]
      });
      navigator.mediaSession.setActionHandler('play',  () => { audio.play(); audioTap.play().catch(()=>{}); });
      navigator.mediaSession.setActionHandler('pause', () => { audio.pause(); audioTap.pause(); });
    }

    /* ── Audio setup ──
       iOS won't keep AudioContext alive in background, but plain <audio> will.
       Solution: primary <audio> plays unmuted via system pipeline (background-safe).
       Muted <audio> tap feeds the AudioContext analyser for visuals only. ── */
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser  = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.55;
    // Wire the MUTED tap into AudioContext — never the primary audio element
    const tapSrc = audioCtx.createMediaElementSource(audioTap);
    tapSrc.connect(analyser);
    // No connect to destination — it's muted, we don't want to hear it
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const waveData = new Uint8Array(analyser.fftSize);

    /* ── State ── */
    let rafId     = null;
    let isPlaying = false;
    let bgHue     = 260;

    /* ── Background: slow hue-shifting radial gradient ── */
    function drawBg(energy) {
      bgHue = (bgHue + 0.03) % 360;
      const pulse = 0.04 + energy * 0.08;
      bgCtx.fillStyle = '#000';
      bgCtx.fillRect(0, 0, W, H);
      const grad = bgCtx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W * 0.7);
      grad.addColorStop(0,   `hsla(${bgHue}, 60%, 12%, ${pulse})`);
      grad.addColorStop(0.5, `hsla(${bgHue + 30}, 50%, 8%, ${pulse * 0.5})`);
      grad.addColorStop(1,   'transparent');
      bgCtx.fillStyle = grad;
      bgCtx.fillRect(0, 0, W, H);
    }

    /* ── Waveform: 3 layered oscilloscope waves ── */
    const WAVES = [
      { rgba: '130,98,169', alpha: 0.55, lw: 1.2, yOff: -18 }, // purple upper
      { rgba: '253,194,89', alpha: 0.85, lw: 1.8, yOff:   0 }, // yellow center
      { rgba: '130,98,169', alpha: 0.40, lw: 1.0, yOff:  18 }, // purple lower
    ];
    let wavePhase = 0;

    function drawWaveform(energy) {
      analyser.getByteTimeDomainData(waveData);
      ctx.clearRect(0, 0, W, H);

      const amp   = 0.28 + energy * 0.18; // gentler movement on small screen
      wavePhase  += 0.012;

      WAVES.forEach(({ rgba, alpha, lw, yOff }) => {
        ctx.beginPath();
        ctx.lineWidth   = lw;
        ctx.strokeStyle = `rgba(${rgba}, ${alpha})`;
        ctx.shadowColor = `rgba(${rgba}, 0.5)`;
        ctx.shadowBlur  = 6;

        const slice = W / (waveData.length - 1);
        for (let i = 0; i < waveData.length; i++) {
          const raw  = (waveData[i] / 128) - 1;
          const wave = raw * amp * H * 0.22;
          const drift = Math.sin(i * 0.012 + wavePhase + yOff * 0.04) * 3 * energy;
          const x = i * slice;
          const y = H / 2 + yOff + wave + drift;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      });
    }

    /* ── Animation loop ── */
    function loop() {
      rafId = requestAnimationFrame(loop);
      analyser.getByteFrequencyData(freqData);
      const energy = (() => {
        const end = Math.floor(analyser.frequencyBinCount * 0.5);
        let s = 0; for (let i = 0; i < end; i++) s += freqData[i];
        return s / (end * 255);
      })();
      drawBg(energy);
      drawWaveform(energy);
    }

    function startViz() {
      isPlaying = true;
      if (!rafId) loop();
    }

    function stopViz() {
      isPlaying = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      ctx.clearRect(0, 0, W, H);
      bgCtx.fillStyle = '#000';
      bgCtx.fillRect(0, 0, W, H);
    }

    /* ── Click / tap handler ── */
    logo.addEventListener('click', () => {
      if (audio.paused) {
        // Reset both streams to live edge
        audio.src    = 'https://s.radiowave.io/ksdb.mp3';
        audioTap.src = 'https://s.radiowave.io/ksdb.mp3';
        audio.load();    audioTap.load();
        audio.play();    audioTap.play();
        audioCtx.resume();
        logo.classList.add('playing');
        hint.style.opacity = '0';
        startViz();
      } else {
        audio.pause();    audioTap.pause();
        logo.classList.remove('playing');
        hint.style.opacity = '1';
        stopViz();
      }
    });

    /* ── Visibility: pause animations when minimized, keep audio alive ── */
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Pause animation + muted tap (no point analysing in background)
        // Primary audio keeps playing via native wrapper
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        audioTap.pause();
      } else {
        // App foregrounded
        if (!audio.paused) {
          if (isIOS) {
            // iOS: force pause/play cycle on primary to restore audio pipeline
            audio.pause();
            audio.play().catch(() => {});
          }
          // Resume tap + AudioContext for visualizer
          audioTap.src = 'https://s.radiowave.io/ksdb.mp3';
          audioTap.load();
          audioTap.play().catch(() => {});
          if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
            audioCtx.resume();
          }
          if (!rafId) loop();
        }
      }
    });
  }
}

customElements.define('audio-visualizer-mobile', AudioVisualizerMobile);
