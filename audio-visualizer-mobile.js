class AudioVisualizer extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <style>
        .container {
          position: relative;
          width: 220px;
          height: 220px;
        }

        .logo {
          position: absolute;
          top: 58%;
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

        .visualizer-circle,
        #bolts {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        .bar {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 4px;
          height: 30px;
          background: linear-gradient(to top, #8262a9, #fdc259);
          transform-origin: center bottom;
          opacity: 0;
          transition: opacity 0.3s ease;
          border-radius: 50px;
        }

        /* Anchor bolts to logo’s top-right corner (logo: 150x150) */
        .bolt {
          position: absolute;
          top: calc(58% - 75px);
          left: calc(50% + 75px);
          width: 40px;
          height: 40px;
          opacity: 0;
          transform: translate(-50%, -50%);
        }

        .bolt img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
          filter: drop-shadow(0 0 12px #fdc259);
        }

        /* Single transform chain:
           translate -> rotate(angle + imgOffset) -> translateX(distance) */
        @keyframes boltShoot {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(calc(var(--angle) + var(--imgOffset, 0deg))) translateX(0);
          }
          60% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(calc(var(--angle) + var(--imgOffset, 0deg))) translateX(var(--d1));
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) rotate(calc(var(--angle) + var(--imgOffset, 0deg))) translateX(var(--d2));
          }
        }
      </style>

      <div class="container">
        <div class="visualizer-circle" id="visualizer-circle">
          ${Array.from({ length: 48 }, () => '<div class="bar"></div>').join('')}
        </div>

        <div class="logo" id="logo">
          <img src="https://static.wixstatic.com/media/eaaa6a_025d2967304a4a619c482e79944f38d9~mv2.png" alt="Logo" />
        </div>

        <audio id="audio" src="https://s.radiowave.io/ksdb.mp3" crossorigin="anonymous" playsinline></audio>

        <div id="bolts">
          ${Array.from({ length: 6 }, () => `
            <div class="bolt">
              <img src="https://static.wixstatic.com/media/eaaa6a_0ce7ee88c3894941bcb1da72a58d1c0e~mv2.png" />
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const audio = this.querySelector('#audio');
    const logo = this.querySelector('#logo');
    const bars = this.querySelectorAll('#visualizer-circle .bar');
    const bolts = this.querySelectorAll('#bolts .bolt');

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    let audioCtx = null;
    let analyser = null;
    let androidLoopId = null;
    let iosIntervalId = null;

    /* Media Session */
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'You Belong.',
        artist: 'Wildcat 91.9',
        album: 'Live Stream',
        artwork: [
          { src: 'https://static.wixstatic.com/media/eaaa6a_025d2967304a4a619c482e79944f38d9~mv2.png', sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => audio.play());
      navigator.mediaSession.setActionHandler('pause', () => audio.pause());
    }

    /* Bars layout */
    bars.forEach((bar, i) => {
      const angleDeg = (i / bars.length) * 360;
      bar.style.transform = `rotate(${angleDeg}deg) translateY(-70px) scaleY(0.5)`;
    });

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

    /* Per-bolt image offset: ensure longest side points outward */
    bolts.forEach(bolt => {
      const img = bolt.querySelector('img');
      const setOffset = () => {
        const offset = img.naturalWidth >= img.naturalHeight ? '0deg' : '90deg';
        bolt.style.setProperty('--imgOffset', offset);
      };
      if (img.complete) setOffset();
      else img.addEventListener('load', setOffset);
    });

    /* Shoot bolt strictly along rotated X axis (parallel motion) */
    function shootBolt(bolt) {
      // Flight angle spread (−60° to +60°)
      const angle = Math.floor(Math.random() * 120 - 60);
      // Distances
      const d1 = Math.floor(Math.random() * 60 + 60);
      const d2 = d1 + Math.floor(Math.random() * 60 + 40);

      bolt.style.setProperty('--angle', `${angle}deg`);
      bolt.style.setProperty('--d1', `${d1}px`);
      bolt.style.setProperty('--d2', `${d2}px`);

      // Clean animation retrigger
      bolt.style.animation = 'none';
      bolt.offsetHeight;
      bolt.style.animation = 'boltShoot 1.1s ease-out forwards';

      // Ensure opacity resets after animation completes
      bolt.addEventListener('animationend', () => {
        bolt.style.opacity = '0';
        bolt.style.animation = 'none';
      }, { once: true });
    }

    function startIOSBolts() {
      if (iosIntervalId) return;
      iosIntervalId = setInterval(() => {
        const bolt = bolts[Math.floor(Math.random() * bolts.length)];
        shootBolt(bolt);
      }, Math.floor(Math.random() * 300 + 380)); // 380–680ms cadence
    }

    function stopIOSBolts() {
      if (!iosIntervalId) return;
      clearInterval(iosIntervalId);
      iosIntervalId = null;
      bolts.forEach(b => (b.style.opacity = 0));
    }

    function pauseCleanup() {
      bars.forEach(bar => (bar.style.opacity = '0'));
      if (androidLoopId) {
        cancelAnimationFrame(androidLoopId);
        androidLoopId = null;
      }
      stopIOSBolts();
    }

    /* Play/pause handler */
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











