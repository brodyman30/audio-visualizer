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
        @font-face {
          font-family: 'Polymath';
          src: url('Polymath-Bold.woff2') format('woff2');
          font-weight: 700;
          font-style: normal;
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
          font-weight: 300;
          font-style: italic;
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
          font-weight: 300;
          font-style: italic;
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
          font-weight: 300;
          font-style: italic;
          font-size: 13px; letter-spacing: 0.18em; text-transform: uppercase;
          pointer-events: none;
        }
        .av-hint {
          position: fixed;
          bottom: max(28px, env(safe-area-inset-bottom, 28px));
          right: max(28px, env(safe-area-inset-right, 28px));
          z-index: 10; color: rgba(255,255,255,0.3);
          font-family: 'Polymath', 'Courier New', monospace;
          font-weight: 300;
          font-style: italic;
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

    /* ── Stars (drifting field above the horizon) ── */
    const PCNT = 420;
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

    /* ── YOU BELONG mode state (declared early: resize() rebuilds the trace) ── */
    let ybFlash = 0;

    /* ── Canvas size — DPI-aware so thin lines stay crisp on retina/4K ── */
    let W = window.innerWidth, H = window.innerHeight;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      [bgCanvas, mainCanvas].forEach(c => {
        c.width  = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
        c.style.width  = W + 'px';
        c.style.height = H + 'px';
      });
      // Draw in CSS pixels; the backing store handles the extra resolution
      bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
      // 10–55% of bins = low-mid through upper-mid (snare, guitar, alt/rock crunch)
      const start = Math.floor(analyser.frequencyBinCount * 0.10);
      const end   = Math.floor(analyser.frequencyBinCount * 0.55);
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
      // Blend bass + mids — gives alt/rock equal weight to rap/pop
      const e = Math.max(bass, mid * 0.9);
      beatHist.push(e); beatHist.shift();
      const avg = beatHist.reduce((a, b) => a + b, 0) / beatHist.length;
      const now = performance.now();
      // Adaptive multiplier: scales down as avg energy rises (metal/rock)
      const multiplier = avg > 0.18 ? 1.08 : avg > 0.10 ? 1.12 : 1.16;
      if (e > avg * multiplier && e > 0.018 && now - lastBeat > 170) {
        lastBeat = now; return true;
      }
      return false;
    }

    /* ── Mode cycling (time-based) ── */
    const MODES    = ['WAVEFORM', 'YOU BELONG', 'RADIAL BLOOM'];
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
      resetYouBelong();
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
       MODE 1 — YOU BELONG
       A wall of vertical lines moving in unison on a slow wave,
       with the words carved through as negative space — the
       letters are the gaps where the lines drop out. The audio
       swells the wall. Logo centered as play/pause.
    ══════════════════════════════════════════ */

    let ybFontReady = false;
    if (document.fonts && document.fonts.load) {
      document.fonts.load('700 100px Polymath').then(() => { ybFontReady = true; });
      document.fonts.ready.then(() => { ybFontReady = true; });
    } else {
      ybFontReady = true;
    }

    function resetYouBelong() { ybFlash = 0; }

    /* Rasterize "YOU BELONG" once into a mask we can test per-column.
       For each x we store the y-ranges that are INSIDE a letter, so the
       wall lines know where to drop out. */
    let ybMask = null, ybMaskW = 0, ybMaskH = 0;
    let ybScroll = 0;

    let ybWinW = 0, ybBuiltW = 0, ybBuiltH = 0, ybBuiltFont = null;
    const YB_PERIOD = 3.4;   // marquee period, in screen widths
                             // (bigger = longer blank gap between passes;
                             //  scroll speed is unchanged)

    function buildWallMask() {
      // window = how much of the mask is visible on screen at once
      const win = 1400;
      const MW  = Math.round(win * YB_PERIOD);
      const MH  = Math.max(2, Math.round(win * (H / W)));

      const off = document.createElement('canvas');
      off.width = MW; off.height = MH;
      const o = off.getContext('2d', { willReadFrequently: true });

      const size = MH * 0.091;
      o.font = `700 ${size}px Polymath, "Courier New", monospace`;
      o.textAlign = 'center';
      o.textBaseline = 'middle';
      o.fillStyle = '#fff';
      // Drawn once in the real Polymath Bold cut; the empty space around it
      // becomes the gap between repeats as the marquee wraps.
      o.fillText('YOU BELONG', MW / 2, MH / 2);

      const data = o.getImageData(0, 0, MW, MH).data;

      // For each column, record EVERY run of glyph pixels as [start,end]
      // (normalized 0..1). Multiple runs preserve the counters in O, E, G, B.
      const cols = new Array(MW);
      for (let x = 0; x < MW; x++) {
        const runs = [];
        let inRun = false, runStart = 0;
        for (let y = 0; y < MH; y++) {
          const on = data[(y * MW + x) * 4 + 3] > 110;
          if (on && !inRun) { inRun = true; runStart = y; }
          else if (!on && inRun) { inRun = false; runs.push([runStart / MH, (y - 1) / MH]); }
        }
        if (inRun) runs.push([runStart / MH, (MH - 1) / MH]);
        cols[x] = runs;
      }
      ybMask = cols; ybMaskW = MW; ybMaskH = MH; ybWinW = win;
      ybBuiltW = W; ybBuiltH = H; ybBuiltFont = ybFontReady;
    }

    function drawYouBelong(energy, isBeat) {
      ctx.clearRect(0, 0, W, H);
      if (!ybMask || ybBuiltW !== W || ybBuiltH !== H || ybBuiltFont !== ybFontReady) buildWallMask();

      const time = performance.now() * 0.001;
      if (isBeat) ybFlash = 1;
      ybFlash *= 0.88;

      // marquee: words travel left to right across the wall
      ybScroll = (time * ybWinW * 0.16) % ybMaskW;

      const bins = Math.floor(freqData.length * 0.6);

      /* ── The wall of vertical lines ── */
      // The words occupy a band across the middle of the screen.
      const bandW = W;
      const bandH = H;
      const bandX = 0;
      const bandY = 0;

      const COLS   = Math.floor(bandW / 7);   // line density
      const colW   = bandW / COLS;
      const lineH  = bandH * 0.30;            // resting line height
      const cx     = W / 2;

      ctx.save();
      ctx.lineCap = 'round';

      for (let i = 0; i < COLS; i++) {
        const fx = i / (COLS - 1);
        const sx = bandX + fx * bandW;

        // Broad shape: the whole wall breathes in unison ...
        const t   = Math.min(Math.abs(sx - cx) / cx, 1);
        const idx = Math.min(Math.floor(Math.pow(t, 1.5) * (bins - 1)), bins - 1);
        const v   = Math.pow(freqData[idx] / 255, 1.4);
        const wave = Math.sin(time * 1.6 + fx * 5.5) * 0.5 + 0.5;   // 0..1 in unison

        // ... layered with faster, out-of-phase harmonics and a fixed
        // per-column offset so neighbouring bars never match exactly.
        // Without these the wall reads as flat rectangular slabs.
        const h2 = Math.sin(time * 2.7  - fx * 17.0 + 1.3) * 0.5 + 0.5;
        const h3 = Math.sin(time * 4.1  + fx * 39.0 + 2.9) * 0.5 + 0.5;
        const detail = h2 * 0.55 + h3 * 0.45;

        // deterministic per-column jitter (hash of the index)
        const jitter = (Math.sin(i * 12.9898) * 43758.5453) % 1;
        const jit = (jitter < 0 ? jitter + 1 : jitter);

        // a nearby spectrum bin adds spiky, per-bar audio detail
        const fine = Math.pow(freqData[(idx * 7 + i * 3) % bins] / 255, 1.6);

        const swell = wave * 0.26 + v * 0.62
                    + detail * 0.20 + jit * 0.14 + fine * 0.30
                    + ybFlash * 0.3;

        // glyph mask for this column, shifted by the marquee scroll and
        // wrapped so the wordmark travels continuously across the wall
        let mc = Math.floor(fx * ybWinW - ybScroll) % ybMaskW;
        if (mc < 0) mc += ybMaskW;

        // line vertical extent, centered on the band
        const h = lineH * (0.547 + swell * 0.567);
        const yTop = bandY + (bandH - h) / 2;
        const yBot = yTop + h;

        // Purple is the base; only the tallest, most energetic bars tip
        // into yellow, so the wall reads as purple with yellow accents.
        const mix = Math.pow(Math.min(swell * 0.72, 1), 1.9);
        const r = Math.round(130 + 123 * mix);
        const g = Math.round(98  + 96  * mix);
        const b = Math.round(169 - 80  * mix);
        const a = 0.28 + swell * 0.5;
        const lw = 2.0 + swell * 1.9;

        ctx.strokeStyle = `rgba(${r},${g},${b},${a.toFixed(3)})`;
        ctx.lineWidth   = lw;
        ctx.shadowColor = `rgba(${r},${g},${b},0.6)`;
        ctx.shadowBlur  = 4 + swell * 10;

        const runs = ybMask[mc] || [];
        const gap  = 3 + swell * 6;

        if (!runs.length) {
          ctx.beginPath();
          ctx.moveTo(sx, yTop);
          ctx.lineTo(sx, yBot);
          ctx.stroke();
        } else {
          // Walk down the column drawing the spaces BETWEEN glyph runs,
          // so letter counters (holes in O/E/G/B) stay filled with lines.
          let cursor = yTop;
          for (let ri = 0; ri < runs.length; ri++) {
            const rTop = bandY + runs[ri][0] * bandH - gap;
            const rBot = bandY + runs[ri][1] * bandH + gap;
            if (rTop > cursor) {
              ctx.beginPath();
              ctx.moveTo(sx, cursor);
              ctx.lineTo(sx, Math.min(rTop, yBot));
              ctx.stroke();
            }
            cursor = Math.max(cursor, rBot);
            if (cursor > yBot) break;
          }
          if (cursor < yBot) {
            ctx.beginPath();
            ctx.moveTo(sx, cursor);
            ctx.lineTo(sx, yBot);
            ctx.stroke();
          }
        }
      }
      ctx.shadowBlur = 0;
      ctx.restore();
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
      const cx = W / 2;
      const cy = H / 2 + 9;
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
      else if (mode === 1) drawYouBelong(energy, isBeat);
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

    /* ── Desktop keyboard controls ── */
    function jumpToMode(n) {
      if (n === mode) return;
      mode = n;
      modeLabel.textContent = MODES[mode];
      modeStart = performance.now();
      wavePhase  = 0;
      particles  = buildParticles();
      bloomRings = [];
      resetYouBelong();
      doTransition();
    }

    document.addEventListener('keydown', e => {
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      switch (e.key) {
        case ' ':
        case 'Spacebar':
          e.preventDefault(); logo.click(); break;
        case '1': jumpToMode(0); break;
        case '2': jumpToMode(1); break;
        case '3': jumpToMode(2); break;
        case 'ArrowRight': nextMode(); break;
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
