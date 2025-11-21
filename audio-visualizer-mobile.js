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
        }
        .cover img {
          width: 100%;
          height: 100%;
          border-radius: 12px;
          object-fit: contain;
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
      </style>

      <div class="container">
        <div class="visualizer-circle" id="visualizer-circle">
          ${Array.from({ length: 48 }, () => '<div class="bar"></div>').join('')}
        </div>
        <div class="cover" id="cover">
          https://static.wixstatic.com/media/eaaa6a_025d2967304a4a619c482e79944f38d9~mv2.png
        </div>
        https://s.radiowave.io/ksdb.mp3</audio>
      </div>
    `;

    const audio = this.querySelector('#audio');
    const cover = this.querySelector('#cover');
    const bars = this.querySelectorAll('#visualizer-circle .bar');

    let audioCtx;
    let analyser;
    let source;
    let isAnimating = false;

    const bufferLength = 128;
    const dataArray = new Uint8Array(bufferLength);

    // Position bars radially
    bars.forEach((bar, i) => {
      const angleDeg = (i / bars.length) * 360;
      bar.style.transform = `rotate(${angleDeg}deg) translateY(-70px) scaleY(0.5)`;
    });

    function animate() {
      if (isAnimating) return;
      isAnimating = true;

      function loop() {
        analyser.getByteFrequencyData(dataArray);
        bars.forEach((bar, i) => {
          let binIdx = Math.floor(i / bars.length * bufferLength);
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

    function initAudioContext() {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source = audioCtx.createMediaElementSource(audio);
        source.connect(audioCtx.destination);
        source.connect(analyser);
      }
    }

    function playAudio() {
      initAudioContext();
      audioCtx.resume().then(() => {
        audio.play().then(() => {
          bars.forEach(bar => bar.style.opacity = '1');
          animate();
        }).catch(err => console.error('Play error:', err));
      });
    }

    function pauseAudio() {
      audio.pause();
      bars.forEach(bar => bar.style.opacity = '0');
      resetBars();
      isAnimating = false;
    }

    // Handle click and touch for iOS
    cover.addEventListener('click', () => {
      if (audio.paused) {
        playAudio();
      } else {
        pauseAudio();
      }
    });

    cover.addEventListener('touchstart', () => {
      if (audio.paused) {
        playAudio();
      } else {
        pauseAudio();
      }
    });
  }
}

customElements.define('audio-visualizer-mobile', AudioVisualizer);
