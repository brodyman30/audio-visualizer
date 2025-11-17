class AudioVisualizer extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <style>
        .container {
          position: relative;
          width: 220px;
          height: 220px;
        }

        .cover {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 150px;
          height: 150px;
          transform: translate(-50%, -50%);
          z-index: 1;
          cursor: pointer;
        }

        .cover img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }

        .visualizer-circle {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 220px;
          height: 220px;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .bar {
          position: absolute;
          width: 4px;
          height: 40px;
          background: linear-gradient(to top, #8262a9, #fdc259);
          transform-origin: center bottom;
        }
      </style>

      <div class="container">
        <div class="visualizer-circle" id="visualizer-circle">
          ${Array.from({ length: 32 }, () => '<div class="bar"></div>').join('')}
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

    // Position bars radially
    bars.forEach((bar, i) => {
      const angleDeg = (i / bars.length) * 360;
      const angleRad = (angleDeg * Math.PI) / 180;
      const radius = 90;
      const x = Math.cos(angleRad) * radius;
      const y = Math.sin(angleRad) * radius;
      bar.style.left = `${110 + x}px`;
      bar.style.top = `${110 + y}px`;
      bar.style.transform = `rotate(${angleDeg}deg) scaleY(0.5)`;
    });

    function animate() {
      if (isAnimating) return;
      isAnimating = true;

      function loop() {
        analyser.getByteFrequencyData(dataArray);
        const maxIndex = bufferLength - 1;

        bars.forEach((bar, i) => {
          const normalizedIndex = i / bars.length;
          const logIndex = Math.floor(Math.pow(normalizedIndex, 2) * maxIndex);
          const value = dataArray[logIndex] || 0;
          const scale = Math.max(value / 128, 0.5);
          const angleDeg = (i / bars.length) * 360;
          bar.style.transform = `rotate(${angleDeg}deg) scaleY(${scale})`;
        });

        requestAnimationFrame(loop);
      }

      loop();
    }

    function resetBars() {
      bars.forEach((bar, i) => {
        const angleDeg = (i / bars.length) * 360;
        bar.style.transform = `rotate(${angleDeg}deg) scaleY(0.5)`;
      });
    }

    cover.addEventListener('click', () => {
      if (audio.paused) {
        audio.load();
        audio.play();
        audioCtx.resume();
        animate();
      } else {
        audio.pause();
        resetBars();
      }
    });
  }
}

customElements.define('audio-visualizer-mobile', AudioVisualizer);
