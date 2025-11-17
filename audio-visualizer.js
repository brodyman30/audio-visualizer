class AudioVisualizer extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <style>
        .container {
          position: relative;
          width: 250px;
          height: 250px;
          margin: 0 auto;

        }

        .cover {
          position: absolute;
          top: 58%;
          left: 50%;
          width: 250px;
          height: 250px;
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
          height: 35px; /* slightly taller to match larger visualizer */
          background: linear-gradient(to top, #8262a9, #fdc259);
          transform-origin: center bottom;
          opacity: 0;
          transition: opacity 0.3s ease;
          border-radius: 50px;
        }
      </style>

      <div class="container">
        <div class="visualizer-circle" id="visualizer-circle">
          ${Array.from({ length: 72 }, () => '<div class="bar"></div>').join('')}
        </div>
        <div class="cover" id="cover">
          <img src="https://static.wixstatic.com/media/eaaa6a_025d2967304a4a619c482e79944f38d9~mv2.png" alt="Cover" />
        </div>
        <audio id="audio" src="https://s.radiowave.io/ksdb.mp3" crossorigin="anonymous"></audio>
      </div>
    `;

    const audio = this.querySelector('#audio');
    const cover = this.querySelector('#cover');
    const bars = this.querySelectorAll('#visualizer-circle .bar');
    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;

    const source = audioCtx.createMediaElementSource(audio);
    source.connect(audioCtx.destination);
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let isAnimating = false;

    // Bars positioned radially from center, with larger offset for bigger image
    const radius = 110; // radius from center to outline match cover (slightly less than half container)
    bars.forEach((bar, i) => {
      const angleDeg = (i / bars.length) * 360;
      bar.style.transform = `rotate(${angleDeg}deg) translateY(-${radius}px) scaleY(0.5)`;
    });

    function animate() {
      if (isAnimating) return;
      isAnimating = true;

      function loop() {
        analyser.getByteFrequencyData(dataArray);

        bars.forEach((bar, i) => {
          let binIdx = Math.floor(i / bars.length * bufferLength);
          if (binIdx >= bufferLength / 2) {
            binIdx = bufferLength - binIdx - 1;
          }
          const value = dataArray[binIdx] || 0;
          const scale = Math.max(value / 128, 0.5);
          const angleDeg = (i / bars.length) * 360;
          bar.style.transform = `rotate(${angleDeg}deg) translateY(-${radius}px) scaleY(${scale})`;
        });

        requestAnimationFrame(loop);
      }

      loop();
    }

    function resetBars() {
      bars.forEach((bar, i) => {
        const angleDeg = (i / bars.length) * 360;
        bar.style.transform = `rotate(${angleDeg}deg) translateY(-${radius}px) scaleY(0.5)`;
      });
    }

    cover.addEventListener('click', () => {
      if (audio.paused) {
        audio.load();
        audio.play();
        audioCtx.resume();
        bars.forEach(bar => {
          bar.style.opacity = '1';
        });
        animate();
      } else {
        audio.pause();
        bars.forEach(bar => {
          bar.style.opacity = '0';
        });
        resetBars();
      }
    });
  }
}

customElements.define('audio-visualizer', AudioVisualizer);

