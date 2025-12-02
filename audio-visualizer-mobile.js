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

        /* Anchor bolts to logo’s top-right corner (logo is 150x150) */
        .bolt {
          position: absolute;
          top: calc(58% - 75px);
          left: calc(50% + 75px);
          width: 40px;
          height: 40px;
          opacity: 0;
          transform: translate(-50%, -50%);
        }

        /* Inner wrapper lets us add an image orientation offset independently */
        .bolt-inner {
          width: 100%;
          height: 100%;
          transform: rotate(calc(var(--angle, 0deg) + var(--imgOffset, 0deg)));
        }

        .bolt img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 0 12px #fdc259);
          display: block;
        }

        /* Move strictly along rotated X axis (parallel to motion) */
        @keyframes boltShoot {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0);
          }
          60% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(var(--angle)) translateX(var(--d1));
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) rotate(var(--angle)) translateX(var(--d2));
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
              <div class="bolt-inner">
                <img class="bolt-img" src="https://static.wixstatic.com/media/eaaa6a_0ce7ee88c3894941bcb1da72a58d1c0e~mv2.png" />
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const audio = this.querySelector('#audio');
    const logo = this.querySelector('#logo');
    const bars = this.querySelectorAll('#visualizer-circle .bar');
    const bolts = this.querySelectorAll('#bolts .bolt');
    const boltImgs = this.querySelectorAll('.bolt-img');
    const boltInners = this.querySelectorAll('.bolt-inner');

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

    /* Compute image orientation offset so longest side points outward */
    const imgOffsets = new Map();
    boltImgs.forEach((img, idx) => {
      if (img.complete) {
        const offset = img.naturalWidth >= img.naturalHeight ? 0 : 90; // long side horizontal=0°, vertical=90°
        imgOffsets.set(idx, offset);
        boltInners[idx].style.setProperty('--imgOffset', `${offset}deg`);
      } else {
        img.addEventListener('load', () => {
          const offset = img.naturalWidth >= img.naturalHeight ? 0 : 90;
          imgOffsets.set(idx, offset);
          boltInners[idx].style.setProperty('--imgOffset', `${offset}deg`);
        });
      }
    });

    function shootBolt(bolt, idx) {
      // Angle the flight away from the logo (spread −70° to +20°; bias upward/right)
      const angle = Math.floor(Math.random() * 90 - 70);
      const d1 = Math.floor(Math.random() * 60 + 60);
      const d2 = d1 + Math.floor(Math.random() * 60 + 40);

      // Set flight variables
      bolt.style.setProperty('--angle', `${angle}deg`);
      bolt.style.setProperty('--d1', `${d1}px`);
      bolt.style.setProperty('--d2', `${d2}px`);

      // Ensure the inner wrapper includes image orientation offset
      const offset = imgOffsets.get(idx) ?? 0;
      const inner = bolt.querySelector('.bolt-inner');
      inner.style.setProperty('--imgOffset', `${offset}deg`);

      // Fire animation
      bolt.style.animation = 'none';
      bolt.offsetHeight;
      bolt.style.animation = 'boltShoot 1.1s ease-out forwards';
    }

    function startIOSBolts() {
      if (iosIntervalId) return;
      iosIntervalId = setInterval(() => {
        const i = Math.floor(Math.random() * bolts.length);
        shootBolt(bolts[i], i);
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










