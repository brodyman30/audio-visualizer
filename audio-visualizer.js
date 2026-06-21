class AudioVisualizer extends HTMLElement {
  connectedCallback() {
    // Lock the host page to prevent scrolling
    const lockStyle = document.createElement('style');
    lockStyle.id = 'av-scroll-lock';
    lockStyle.textContent = 'html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;}';
    if (!document.getElementById('av-scroll-lock')) {
      document.head.appendChild(lockStyle);
    }

    this.innerHTML = `
      <style>
        @font-face {
          font-family: 'Polymath';
          src: url('Polymath-LightIt.woff2') format('woff2');
          font-weight: 300;
          font-style: italic;
          font-display: swap;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        :host, .av-root {
          display: block;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background: #000;
          font-family: 'Polymath', 'Courier New', monospace;
        }

        #av-bg-canvas,
        #av-main-canvas {
          position: fixed;
          top: 0; left: 0;
          width: 100%; height: 100%;
          pointer-events: none;
        }
        #av-bg-canvas   { z-index: 0; }
        #av-main-canvas { z-index: 1; }

        /* Scanlines */
        .av-vhs-overlay {
          position: fixed; top: 0; left: 0;
          width: 100%; height: 100%;
          pointer-events: none; z-index: 5;
        }
        .av-vhs-overlay::before {
          content: ''; position: absolute; inset: 0;
          background: repeating-linear-gradient(
            to bottom,
            transparent 0px, transparent 2px,
            rgba(0,0,0,0.14) 2px, rgba(0,0,0,0.14) 4px
          );
        }
        .av-vhs-overlay::after {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.7) 100%);
        }

        /* Film grain */
        .av-grain {
          position: fixed; top: -50%; left: -50%;
          width: 200%; height: 200%;
          pointer-events: none; z-index: 4; opacity: 0.05;
          animation: av-grain 0.14s steps(1) infinite;
        }
        @keyframes av-grain {
          0%   { transform: translate(0,0); }
          25%  { transform: translate(-3%,-2%); }
          50%  { transform: translate(2%, 3%); }
          75%  { transform: translate(-1%, 1%); }
          100% { transform: translate(3%,-1%); }
        }

        /* Mode label + timer bar */
        .av-mode-label {
          position: fixed; top: 22px; left: 28px;
          z-index: 10; color: rgba(255,255,255,0.5);
          font-family: 'Polymath', 'Courier New', monospace;
          font-size: 13px; letter-spacing: 0.18em; text-transform: uppercase;
          pointer-events: none; display: none;
        }
        .av-timer-wrap {
          position: fixed; top: 40px; left: 28px;
          width: 120px; height: 2px; z-index: 10;
          background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;
          pointer-events: none;
        }
        .av-timer-bar {
          height: 100%; width: 0%;
          background: linear-gradient(to right, #8262a9, #fdc259);
          border-radius: 2px;
        }

        /* Station / hint */
        .av-station {
          position: fixed;
          bottom: max(28px, env(safe-area-inset-bottom, 28px));
          left: max(28px, env(safe-area-inset-left, 28px));
          z-index: 10; color: rgba(255,255,255,0.3);
          font-family: 'Polymath', 'Courier New', monospace;
          font-size: 13px; letter-spacing: 0.18em; text-transform: uppercase;
          pointer-events: none;
        }
        .av-hint {
          position: fixed;
          bottom: max(28px, env(safe-area-inset-bottom, 28px));
          right: max(28px, env(safe-area-inset-right, 28px));
          z-index: 10; color: rgba(255,255,255,0.3);
          font-family: 'Polymath', 'Courier New', monospace;
          font-size: 13px; letter-spacing: 0.18em; text-transform: uppercase;
          pointer-events: none;
        }

        /* Center logo */
        .av-logo {
          position: fixed; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          z-index: 8; cursor: pointer;
          width: 180px; height: 180px;
        }
        .av-logo img {
          width: 100%; height: 100%; object-fit: contain; border-radius: 14px;
          filter: drop-shadow(0 0 18px rgba(253,194,89,0.5))
                  drop-shadow(0 0 40px rgba(130,98,169,0.35));
        }
        .av-logo.playing img {
          animation: av-pulse 2.8s ease-in-out infinite;
        }
        @keyframes av-pulse {
          0%,100% {
            filter: drop-shadow(0 0 14px rgba(253,194,89,0.45))
                    drop-shadow(0 0 32px rgba(130,98,169,0.3));
          }
          50% {
            filter: drop-shadow(0 0 30px rgba(253,194,89,0.9))
                    drop-shadow(0 0 65px rgba(130,98,169,0.7));
          }
        }

        /* Beat flash */
        .av-flash {
          position: fixed; inset: 0; z-index: 3; pointer-events: none;
          opacity: 0;
          background: radial-gradient(ellipse at center, rgba(253,194,89,0.08) 0%, transparent 70%);
        }

        /* Glitch bar */
        .av-glitch {
          position: fixed; left: 0; width: 100%; height: 2px;
          background: rgba(255,255,255,0.6); z-index: 6;
          pointer-events: none; opacity: 0; mix-blend-mode: screen;
        }
      </style>

      <div class="av-root">
        <svg class="av-grain" xmlns="http://www.w3.org/2000/svg">
          <filter id="av-n">
            <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/>
            <feColorMatrix type="saturate" values="0"/>
          </filter>
          <rect width="100%" height="100%" filter="url(#av-n)"/>
        </svg>

        <canvas id="av-bg-canvas"></canvas>
        <canvas id="av-main-canvas"></canvas>
        <div class="av-vhs-overlay"></div>
        <div class="av-flash"  id="av-flash"></div>
        <div class="av-glitch" id="av-glitch"></div>

        <div class="av-mode-label" id="av-mode-label">WAVEFORM</div>
        <div class="av-timer-wrap"><div class="av-timer-bar" id="av-timer-bar"></div></div>

        <div class="av-station">WILDCAT 91.9 · LIVE</div>
        <div class="av-hint" id="av-hint">CLICK TO PLAY</div>

        <div class="av-logo" id="av-logo">
          <img src="https://static.wixstatic.com/media/eaaa6a_025d2967304a4a619c482e79944f38d9~mv2.png" alt="Wildcat 91.9"/>
        </div>

        <audio id="av-audio" src="https://s.radiowave.io/ksdb.mp3" crossorigin="anonymous"></audio>
      </div>
    `;

    /* ── Refs ── */
    const audio      = this.querySelector('#av-audio');
    const logo       = this.querySelector('#av-logo');
    const modeLabel  = this.querySelector('#av-mode-label');
    const hint       = this.querySelector('#av-hint');
    const flash      = this.querySelector('#av-flash');
    const glitch     = this.querySelector('#av-glitch');
    const timerBar   = this.querySelector('#av-timer-bar');
    const bgCanvas   = this.querySelector('#av-bg-canvas');
    const mainCanvas = this.querySelector('#av-main-canvas');
    const bgCtx      = bgCanvas.getContext('2d');
    const ctx        = mainCanvas.getContext('2d');

    /* ── Stars (static background for galaxy mode) ── */
    const PCNT = 300;
    let particles = [];
    function buildParticles() {
      return Array.from({ length: PCNT }, () => ({
        x:  Math.random() * window.innerWidth,
        y:  Math.random() * window.innerHeight,
        sz: Math.random() * 1.4 + 0.2,
        ba: Math.random() * 0.5 + 0.15,
        tw: Math.random() * Math.PI * 2,   // twinkle phase
        ts: Math.random() * 0.03 + 0.01,   // twinkle speed
      }));
    }
    particles = buildParticles();

    /* ── Canvas size ── */
    let W = window.innerWidth, H = window.innerHeight;
    function resize() {
      W = bgCanvas.width = mainCanvas.width = window.innerWidth;
      H = bgCanvas.height = mainCanvas.height = window.innerHeight;
      particles = buildParticles();
    }
    resize();
    window.addEventListener('resize', resize);

    /* ── Audio — set up immediately like the original, not inside click ── */
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser  = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.55;  // less smoothing = sharper transients
    const src = audioCtx.createMediaElementSource(audio);
    src.connect(analyser);
    src.connect(audioCtx.destination);
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const waveData = new Uint8Array(analyser.fftSize);

    /* ── Media session ── */
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'You Belong.', artist: 'Wildcat 91.9', album: 'Live Stream',
        artwork: [{ src: 'https://static.wixstatic.com/media/eaaa6a_025d2967304a4a619c482e79944f38d9~mv2.png', sizes: '512x512', type: 'image/png' }]
      });
      navigator.mediaSession.setActionHandler('play',  () => audio.play());
      navigator.mediaSession.setActionHandler('pause', () => audio.pause());
    }

    /* ── Beat detection ── */
    const beatHist = new Array(43).fill(0); // longer window = stabler adaptive baseline
    let lastBeat   = 0;

    function bassEnergy() {
      // Bottom 15% = sub-bass + bass + low-mid (catches rap, pop)
      const end = Math.floor(analyser.frequencyBinCount * 0.15);
      let s = 0; for (let i = 0; i < end; i++) s += freqData[i];
      return s / (end * 255);
    }
    function midEnergy() {
      // 15–40% of bins = low-mid + mid (snare, guitar attack, metal punch)
      const start = Math.floor(analyser.frequencyBinCount * 0.15);
      const end   = Math.floor(analyser.frequencyBinCount * 0.40);
      let s = 0; for (let i = start; i < end; i++) s += freqData[i];
      return s / ((end - start) * 255);
    }
    function fullEnergy() {
      const end = Math.floor(analyser.frequencyBinCount * 0.5);
      let s = 0; for (let i = 0; i < end; i++) s += freqData[i];
      return s / (end * 255);
    }
    function detectBeat() {
      const bass = bassEnergy();
      const mid  = midEnergy();
      // Use whichever is stronger — bass for rap/pop, mid for metal/rock
      const e = Math.max(bass, mid * 0.85);
      beatHist.push(e); beatHist.shift();
      const avg = beatHist.reduce((a, b) => a + b, 0) / beatHist.length;
      const now = performance.now();
      // Adaptive multiplier: high-energy genres (metal) get a lower bar (1.12)
      // low-energy genres (acoustic) keep sensitivity (1.18)
      const multiplier = avg > 0.15 ? 1.12 : 1.18;
      if (e > avg * multiplier && e > 0.025 && now - lastBeat > 180) {
        lastBeat = now; return true;
      }
      return false;
    }

    /* ── Mode cycling (time-based) ── */
    const MODES    = ['WAVEFORM', 'PARTICLES', 'RADIAL BLOOM'];
    const MODE_MS  = 20000;
    let mode       = 0;
    let modeStart  = 0;
    let inTransition = false;

    function nextMode() {
      if (inTransition) return;
      inTransition = true;
      mode = (mode + 1) % MODES.length;
      modeLabel.textContent = MODES[mode];
      modeStart = performance.now();
      wavePhase   = 0;
      particles   = buildParticles();
      bloomRings  = [];
      doTransition();
    }

    function doTransition() {
      // Hard white flash
      flash.style.background = 'rgba(255,255,255,0.85)';
      flash.style.transition = 'none';
      flash.style.opacity = '1';
      setTimeout(() => {
        flash.style.transition = 'opacity 0.35s ease-out';
        flash.style.opacity = '0';
      }, 60);
      setTimeout(() => {
        flash.style.background = 'radial-gradient(ellipse at center, rgba(253,194,89,0.08) 0%, transparent 70%)';
        flash.style.transition = 'none';
      }, 420);
      // Rapid thick glitch bars
      let n = 0;
      (function bar() {
        glitch.style.top     = Math.random() * 100 + '%';
        glitch.style.height  = (Math.random() * 8 + 2) + 'px';
        glitch.style.opacity = (Math.random() * 0.7 + 0.3).toString();
        setTimeout(() => {
          glitch.style.opacity = '0';
          if (++n < 9) setTimeout(bar, 35 + Math.random() * 45);
          else { glitch.style.height = '2px'; inTransition = false; }
        }, 22 + Math.random() * 30);
      })();
      // Mode label pulses yellow
      modeLabel.style.color = '#fdc259';
      modeLabel.style.opacity = '1';
      setTimeout(() => { modeLabel.style.color = 'rgba(255,255,255,0.5)'; }, 500);
    }

    function doFlash() {
      flash.style.opacity = '1';
      setTimeout(() => { flash.style.opacity = '0'; }, 80);
    }

    /* ── Background ── */
    let bgHue = 260;
    function drawBg(energy) {
      bgHue = (bgHue + 0.05 + energy * 0.2) % 360;
      const h2 = (bgHue + 45) % 360;
      const g  = bgCtx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W, H) * 0.75);
      g.addColorStop(0,    `hsla(${bgHue},50%,6%,1)`);
      g.addColorStop(0.55, `hsla(${h2},42%,3%,1)`);
      g.addColorStop(1,    `hsla(0,0%,0%,1)`);
      bgCtx.fillStyle = g;
      bgCtx.fillRect(0, 0, W, H);
    }

    /* ══════════════════════════════════════════
       MODE 0 — WAVEFORM
    ══════════════════════════════════════════ */
    let wavePhase = 0;

    function drawWaveform(energy) {
      analyser.getByteTimeDomainData(waveData);
      ctx.clearRect(0, 0, W, H);
      wavePhase += 0.003 + energy * 0.007;

      // Brand colors: purple outer lines, yellow center — purple/yellow/purple top-to-bottom
      const layers = [
        { y: -H * 0.14,  a: 0.55, rgb: '130,98,169',  shadow: 'rgba(130,98,169,0.6)', lw: 1.5, amp: 0.16 },
        { y: 0,          a: 0.9,  rgb: '253,194,89',  shadow: 'rgba(253,194,89,0.7)', lw: 2.4, amp: 0.26 },
        { y:  H * 0.14,  a: 0.3,  rgb: '130,98,169',  shadow: 'rgba(130,98,169,0.4)', lw: 1.2, amp: 0.16 },
      ];

      layers.forEach(l => {
        const alpha = l.a * (0.5 + energy * 0.6);
        const slice = W / (waveData.length - 1);

        ctx.beginPath();
        for (let i = 0; i < waveData.length; i++) {
          const v = (waveData[i] / 128.0) - 1;
          const y = H/2 + l.y + v * H * l.amp;
          i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * slice, y);
        }
        ctx.strokeStyle = `rgba(${l.rgb},${alpha})`;
        ctx.lineWidth   = l.lw * (1 + energy * 0.5);
        ctx.shadowColor = l.shadow;
        ctx.shadowBlur  = 8 + energy * 16;
        ctx.lineJoin    = 'round';
        ctx.stroke();
        ctx.shadowBlur  = 0;
      });
    }

    /* ══════════════════════════════════════════
       MODE 1 — PARTICLES
    ══════════════════════════════════════════ */
    // Galaxy mode — orbital ring definitions (rx/ry as fraction of min(W,H)*0.5)
    const ORBITALS = [
      { rx: 0.38, ry: 0.07, tilt: -0.18, rot: 0.0, spd: 0.00030, vel: 0.00030, rgb: '130,98,169',  lw: 1.6, baseAlpha: 0.55 },
      { rx: 0.52, ry: 0.10, tilt:  0.22, rot: 1.1, spd: 0.00022, vel: 0.00022, rgb: '253,194,89',  lw: 1.2, baseAlpha: 0.40 },
      { rx: 0.65, ry: 0.13, tilt: -0.10, rot: 2.3, spd: 0.00016, vel: 0.00016, rgb: '130,98,169',  lw: 1.0, baseAlpha: 0.30 },
      { rx: 0.78, ry: 0.16, tilt:  0.30, rot: 0.7, spd: 0.00010, vel: 0.00010, rgb: '180,140,220', lw: 0.8, baseAlpha: 0.20 },
      { rx: 0.90, ry: 0.19, tilt: -0.25, rot: 1.9, spd: 0.00007, vel: 0.00007, rgb: '253,194,89',  lw: 0.7, baseAlpha: 0.15 },
    ];
    let gBeatFlash = 0;

    function drawParticles(energy, isBeat) {
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2 + 9;
      const R  = Math.min(W, H) * 0.5;

      if (isBeat) {
        gBeatFlash = 1.0;
        // Kick each orbital to ~8x its base speed; they coast back down
        ORBITALS.forEach(o => { o.vel = o.spd * 8 * (1 + energy * 4); });
      }
      gBeatFlash *= 0.84;
      // Decay orbital velocity back toward base speed each frame
      ORBITALS.forEach(o => { o.vel += (o.spd - o.vel) * 0.06; });

      // Nebula glow
      const nebA = 0.06 + energy * 0.10 + gBeatFlash * 0.08;
      const neb  = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.1);
      neb.addColorStop(0,   `rgba(80,40,130,${nebA.toFixed(3)})`);
      neb.addColorStop(0.5, `rgba(40,10,80,${(nebA*0.5).toFixed(3)})`);
      neb.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, W, H);

      // Star field — static, twinkle with energy
      particles.forEach(p => {
        p.tw += p.ts;
        const tw = 0.5 + 0.5 * Math.sin(p.tw) + energy * 0.3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220,210,255,${Math.min(p.ba * tw, 1).toFixed(3)})`;
        ctx.fill();
      });

      // Orbital rings
      ORBITALS.forEach(o => {
        o.rot += o.vel;
        const rx = o.rx * R;
        const ry = o.ry * R;
        const a  = Math.min(o.baseAlpha + energy * 0.15 + gBeatFlash * 0.8, 1);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(o.tilt + o.rot);
        ctx.beginPath();
        for (let t = 0; t <= Math.PI * 2 + 0.01; t += 0.03) {
          const x = Math.cos(t) * rx;
          const y = Math.sin(t) * ry;
          t < 0.03 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(${o.rgb},${a.toFixed(3)})`;
        ctx.lineWidth   = o.lw + energy * 1.0 + gBeatFlash * 3.5;
        ctx.shadowColor = `rgba(${o.rgb},${(a * 0.9).toFixed(3)})`;
        ctx.shadowBlur  = 8 + energy * 10 + gBeatFlash * 28;
        ctx.stroke();
        ctx.shadowBlur  = 0;
        ctx.restore();
      });

      // Beat expanding ring from logo center
      if (isBeat) spawnRing(energy, true);

      bloomRings = bloomRings.filter(r => r.alpha > 0.015);
      bloomRings.forEach(r => {
        r.r     += r.spd;
        r.alpha *= 0.965;
        r.spd   *= 0.995;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r.rgb},${r.alpha})`;
        ctx.lineWidth   = r.lw;
        ctx.shadowColor = `rgba(${r.rgb},${r.alpha * 0.8})`;
        ctx.shadowBlur  = 14;
        ctx.stroke();
        ctx.shadowBlur  = 0;
        ctx.restore();
      });
    }

    /* ══════════════════════════════════════════
       MODE 2 — RADIAL BLOOM
    ══════════════════════════════════════════ */
    let bloomRings = [], bloomHue = 280, bloomRot = 0;

    function spawnRing(energy, beat) {
      // Alternate purple / yellow
      const isPurple = bloomRings.length % 2 === 0;
      bloomRings.push({
        r: 92, alpha: 0.85,
        rgb:  isPurple ? '130,98,169' : '253,194,89',
        lw:   beat ? 2.2 + energy * 2.5 : 1 + energy * 1.2,
        pet:  beat ? Math.floor(Math.random() * 4 + 4) : 0,
        pa:   14 + energy * 50,
        spd:  1.6 + energy * 2.5,
      });
    }

    function drawBloom(energy, isBeat) {
      bloomHue = (bloomHue + 0.12 + energy * 0.55) % 360;
      bloomRot += 0.003 + energy * 0.016;
      ctx.clearRect(0, 0, W, H);

      // Offset cy down by ~9px to align with the visual center of the logo circle
      // (the logo image is 350x393 — antenna sticks above, shifting the circle center down)
      const cx = mainCanvas.width / 2;
      const cy = mainCanvas.height / 2 + 9;
      const base = 75;
      const bins = Math.min(freqData.length, 160);

      if (isBeat) { spawnRing(energy, true); spawnRing(energy, true); }
      else if (Math.random() < 0.03 + energy * 0.08) spawnRing(energy, false);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(bloomRot);

      // Alternating purple/yellow bars
      for (let i = 0; i < bins; i++) {
        const angle    = (i / bins) * Math.PI * 2;
        const freq     = freqData[i] / 255;
        const len      = base * 0.2 + freq * base * 1.3;
        // All bars purple
        const col    = `rgba(130,98,169,${0.5 + freq * 0.5})`;
        const shadow = 'rgba(130,98,169,0.6)';

        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * base,      Math.sin(angle) * base);
        ctx.lineTo(Math.cos(angle) * (base+len), Math.sin(angle) * (base+len));
        ctx.strokeStyle = col;
        ctx.lineWidth   = 1.4 + freq * 1.8;
        ctx.shadowColor = shadow;
        ctx.shadowBlur  = 3 + freq * 8;
        ctx.stroke();
        ctx.shadowBlur  = 0;
      }
      ctx.restore();

      bloomRings = bloomRings.filter(r => r.alpha > 0.015);
      bloomRings.forEach(r => {
        r.r     += r.spd;
        r.alpha *= 0.965;
        r.spd   *= 0.995;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.beginPath();

        if (r.pet > 0) {
          for (let a = 0; a <= Math.PI * 2 + 0.05; a += 0.035) {
            const petR = r.r + r.pa * Math.abs(Math.sin(r.pet * a * 0.5));
            const x = Math.cos(a + bloomRot) * petR;
            const y = Math.sin(a + bloomRot) * petR;
            a < 0.04 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.closePath();
        } else {
          ctx.arc(0, 0, r.r, 0, Math.PI * 2);
        }

        ctx.strokeStyle = `rgba(${r.rgb},${r.alpha})`;
        ctx.lineWidth   = r.lw;
        ctx.shadowColor = `rgba(${r.rgb},${r.alpha * 0.8})`;
        ctx.shadowBlur  = 14;
        ctx.stroke();
        ctx.restore();
        ctx.shadowBlur = 0;
      });
    }

    /* ══════════════════════════════════════════
       MAIN LOOP
    ══════════════════════════════════════════ */
    let rafId     = null;
    let isPlaying = false;

    function loop() {
      if (!isPlaying) return;
      rafId = requestAnimationFrame(loop);

      analyser.getByteFrequencyData(freqData);

      const energy = fullEnergy();
      const isBeat = detectBeat();
      if (isBeat) doFlash();

      const elapsed = performance.now() - modeStart;
      timerBar.style.width = Math.min(elapsed / MODE_MS, 1) * 100 + '%';
      if (elapsed >= MODE_MS && !inTransition) nextMode();

      drawBg(energy);
      if      (mode === 0) drawWaveform(energy);
      else if (mode === 1) drawParticles(energy, isBeat);
      else if (mode === 2) drawBloom(energy, isBeat);
    }

    function startViz() {
      isPlaying = true;
      modeStart = performance.now();
      if (!rafId) loop();
    }

    function stopViz() {
      isPlaying = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      ctx.clearRect(0, 0, W, H);
      bgCtx.fillStyle = '#000';
      bgCtx.fillRect(0, 0, W, H);
      timerBar.style.width = '0%';
    }

    /* ── Click handler — same pattern as original (sync, no async/await) ── */
    logo.addEventListener('click', () => {
      if (audio.paused) {
        // Reset src to reconnect to live edge, never resume from cached position
        audio.src = 'https://s.radiowave.io/ksdb.mp3';
        audio.load();
        audio.play();
        audioCtx.resume();
        logo.classList.add('playing');
        hint.style.opacity = '0';
        modeLabel.textContent = MODES[0];
        mode = 0;
        startViz();
      } else {
        audio.pause();
        logo.classList.remove('playing');
        hint.style.opacity = '1';
        stopViz();
      }
    });

    /* ── Visibility — pause animation when app is minimized, keep audio alive ── */
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // App backgrounded: cancel animation loop to save CPU/GPU
        // Audio keeps playing — the native app wrapper handles background audio
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      } else {
        // App foregrounded: resume AudioContext (iOS suspends it when backgrounded)
        if (audioCtx.state === 'suspended') audioCtx.resume();
        // Restart animation loop if audio is still playing
        if (!audio.paused && !rafId) {
          modeStart = performance.now(); // reset timer so mode doesn't instantly skip
          loop();
        }
      }
    });
  }
}

customElements.define('audio-visualizer', AudioVisualizer);
