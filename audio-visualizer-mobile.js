class AudioVisualizer extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <style>
        .container {
          position: relative;
          width: 220px;
          height: 220px;
          overflow: visible;
        }
        .cover {
          position: absolute;
          top: 58%;
          left: 50%;
          width: 150px;
          height: 150px;
          z-index: 1;
          cursor: pointer;
          transform: translate(-50%, -50%);
          -webkit-tap-highlight-color: transparent;
        }
        .cover img {
          width: 100%;
          height: 100%;
          border-radius: 12px;
          object-fit: contain;
          pointer-events: none;
        }
        .visualizer-circle {
          position: absolute;
          top: 0;
          left: 0;
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
        .overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.6);
          color: #fff;
          font-size: 14px;
          text-align: center;
          border-radius: 12px;
          z-index: 2;
          padding: 10px;
        }
        .overlay button {
          margin-top: 10px;
          padding: 6px 12px;
          background: #fdc259;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          color: #000;
        }
      </style>

      <div class="container">
        <div class="visualizer-circle" id="visualizer-circle">
          ${Array.from({ length: 48 }, () => '<div class="bar"></div>').join('')}
        </div>
        <div class="cover" id="cover">
          <img src="https://static.wixstatic.com/media/eaaa6a_025d2967304a4a619c482e79944f38d9~mv2.png" alt="Cover" />
        </div>
        <audio id="audio" src="https://s.radiowave.io/ksdb.mp3" crossorigin="anonymous" playsinline></audio>
        <div class="overlay" id="overlay" style="display:none;">
          <div>Visualizer not available on this device</div>
          <button id="dismiss">Dismiss</button>
        </div>
      </div>
    `;

    const audio = this.querySelector('#audio');
    const cover = this.querySelector('#cover');
    const bars = this.querySelectorAll('#visualizer-circle .bar');
    const overlay = this.querySelector('#overlay');
    const dismissBtn = this.querySelector('#dismiss');

    let audioCtx, analyser;
    const bufferLength = 128;
    const dataArray = new Uint8Array(bufferLength);

    // Position bars radially
    bars.forEach((bar, i) => {
      const angleDeg = (i / bars.length) * 360;
      bar.style.transform = `rotate(${angleDeg}deg) translateY(-70px) scaleY(0.5)`;
    });

    function animate() {
      if (!analyser) {
        overlay.style.display = 'flex';
        return;
      }
      overlay.style.display = 'none';

      function loop() {
        if (document.hidden) return;
        analyser.getByteFrequencyData(dataArray);

        const halfBars = bars.length / 2;
        bars.forEach((bar, i) => {
          const binIdx = Math.floor((i % halfBars) / halfBars * (bufferLength / 2));
          const value = dataArray[binIdx] || 0;
          const scale = Math.max(value / 128, 0.5);
          const angleDeg = (i / bars.length) * 360;
          bar.style.transform = `rotate(${angleDeg}deg) translateY(-70px) scaleY(${scale})`;
        });

        requestAnimationFrame(loop);
      }
      loop();
    }

    function resetBars() {
      bars.forEach((bar, i) => {
        const angleDeg = (i / bars.length) * 360;
        bar.style.transform = `rotate(${angleDeg}deg) translateY(-70px) scaleY(0.5)`;
      });
    }

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !audio.paused && analyser) {
        animate();
      }
    });

    cover.addEventListener('click', async () => {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;

        if (typeof audio.captureStream === 'function') {
          try {
            const stream = audio.captureStream();
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
          } catch (e) {
            analyser = null;
            overlay.style.display = 'flex';
          }
        } else {
          analyser = null;
          overlay.style.display = 'flex';
        }
      }

      if (audioCtx && audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      if (audio.paused) {
        await audio.play();
        bars.forEach(bar => (bar.style.opacity = '1'));
        if (analyser && !document.hidden) animate();
      } else {
        audio.pause();
        bars.forEach(bar => (bar.style.opacity = '0'));
        resetBars();
      }
    });

    // Dismiss overlay
    dismissBtn.addEventListener('click', () => {
      overlay.style.display = 'none';
    });
  }
}

customElements.define('audio-visualizer-mobile', AudioVisualizer);
