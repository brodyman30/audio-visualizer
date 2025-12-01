class AudioVisualizer extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <style>
        /* Container */
        .container {
          position: relative;
          width: 220px;
          height: 220px;
          overflow: visible;
        }

        /* Logo (always visible) */
        .logo {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 150px;
          height: 150px;
          transform: translate(-50%, -50%);
          z-index: 2;
          cursor: pointer;
        }

        .logo img {
          width: 100%;
          height: 100%;
          border-radius: 12px;
          object-fit: contain;
          pointer-events: none;
        }

        /* Bar visualizer (Android/desktop path) */
        .visualizer-circle {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
        }

        .bar {
          position: absolute;
          top: 58%;
          left: 50%;
          width: 4px;
          height: 30px;
          background: linear-gradient(to top, #8262a9, #fdc259);
          transform-origin: center bottom;
          opacity: 0;
          transition: opacity 0.3s ease;
          border-radius: 50px;
        }

        /* Lightning bolts (iOS path) */
        #bolts {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 0;
        }

        .bolt {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 40px;
          height: 40px;
          opacity: 0;
          transform: translate(-50%, -50%);
        }

        .bolt img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 0 6px #fdc259);
        }

        /* Glow pulse animation */
        @keyframes lightningPulse {
          0%   { opacity: 0; filter: drop-shadow(0 0 2px #fdc259); }
          30%  { opacity: 1; filter: drop-shadow(0 0 12px #fdc259); }
          60%  { opacity: 1; filter: drop-shadow(0 0 20px #fdc259); }
          100% { opacity: 0; filter: drop-shadow(0 0 2px #fdc259); }
        }
      </style>

      <div class="container">
        <!-- Bars (Android/desktop) -->
        <div class="visualizer-circle" id="visualizer-circle">
          ${Array.from({ length: 48 }, () => '<div class="bar"></div>').join('')}
        </div>

        <!-- Logo (always visible) -->
        <div class="logo" id="logo">
          <img src="https://static.wixstatic.com/media/eaaa6a_025d2967304a4a619c482e79944f38d9~mv2.png" alt="Logo" />
        </div>

        <!-- Audio -->
        <audio id="audio" src="https://s.radiowave.io/ksdb.mp3" crossorigin="anonymous" playsinline></audio>

        <!-- Bolts (iOS) -->
        <div id="bolts">
          ${Array.from({ length: 6 }, () => `
            <div class="bolt">
              <img src="https://static.wixstatic.com/shapes/eaaa6a_3307af24f68941bfaa446785b9f2b16a.svg" />
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const audio = this.querySelector('#audio');
    const logo = this.querySelector('#logo');
    const bars = this.querySelectorAll('#visualizer-circle .bar');
    const bolts = this.querySelectorAll('#bolts .bolt');

    // Platform detection
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    // State
    let audioCtx = null;
    let analyser = null;
    let androidLoopId = null;
    let iosIntervalId = null;

    // Pre-position bars radially
    bars.forEach((bar, i) => {
      const angleDeg = (i / bars.length) * 360;
      bar.style.transform = `rotate(${angleDeg}deg) translateY(-70px) scaleY(0.5)`;
    });

    // Android/desktop visualizer loop
    const bufferLength = 128;
    const dataArray = new Uint8Array(bufferLength);

    function startAndroidVisualizer() {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;

        const source = audioCtx.createMediaElementSource(audio);
        source.connect(analyser);
        source.connect(audioCtx.destination);
      }

      bars.forEach(bar => (bar.style.opacity = '1'));

      function loop() {
        analyser.getByteFrequencyData(dataArray);

        const halfBars = bars.length / 2;
        bars.forEach((bar, i) => {
          const binIdx = Math.floor((i % halfBars) / halfBars * (bufferLength / 2));
          const value = dataArray[binIdx] || 0;
          const scale = Math.max(value / 128, 0.5);
          const angleDeg = (i / bars.length) * 360;
          bar.style.transform = `rotate(${angleDeg}deg) translateY(-70px) scaleY(${scale})`;
        });

        androidLoopId = requestAnimationFrame(loop);
      }

      loop();
    }

    // iOS lightning bolts
    function shootBolt(bolt) {
      const angle = Math.random() * 360;
      const distance = 80; // how far bolts travel outward
      bolt.style.transform = `translate(-50%, -50%) rotate(${angle}deg) translateY(-${distance}px)`;
      bolt.style.opacity = 1;

      const img = bolt.querySelector('img');
      img.style.animation = 'none';
      img.offsetHeight; // force reflow
      img.style.animation = 'lightningPulse 0.3s ease-in-out';

      setTimeout(() => (bolt.style.opacity = 0), 300);
    }

    function startIOSBolts() {
      if (iosIntervalId) return;
      iosIntervalId = setInterval(() => {
        const bolt = bolts[Math.floor(Math.random() * bolts.length)];
        shootBolt(bolt);
      }, 500);
    }

    function stopIOSBolts() {
      if (!iosIntervalId) return;
      clearInterval(iosIntervalId);
      iosIntervalId = null;
      bolts.forEach(b => (b.style.opacity = 0));
    }

    // Pause cleanup
    function pauseCleanup() {
      bars.forEach(bar => (bar.style.opacity = '0'));
      if (androidLoopId) {
        cancelAnimationFrame(androidLoopId);
        androidLoopId = null;
      }
      stopIOSBolts();
    }

    // Play/pause toggle
    logo.addEventListener('click', async () => {
      if (audio.paused) {
        await audio.play();

        if (isIOS) {
          startIOSBolts();
        } else {
          if (audioCtx && audioCtx.state === 'suspended') {
            await audioCtx.resume();
          }
          startAndroidVisualizer();
        }
      } else {
        audio.pause();
        pauseCleanup();
      }
    });
  }
}

customElements.define('audio-visualizer-mobile', AudioVisualizer);
