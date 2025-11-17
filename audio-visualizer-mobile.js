class AudioVisualizer extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <style>
        .container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
        }

        .cover {
          width: 150px;
          height: 150px;
          flex-shrink: 0;
          cursor: pointer;
        }

        .cover img {
          width: 100%;
          height: 100%;
          border-radius: 12px;
          object-fit: contain;
        }

        .visualizer {
          display: none;
          flex-direction: row;
          align-items: flex-end;
          gap: 4px;
          height: 100px;
        }

        .bar {
          width: 6px;
          height: 60px;
          background: linear-gradient(to top, #8262a9, #fdc259);
          border-radius: 3px;
          transform: scaleY(1);
        }
      </style>

      <div class="container">
        <div class="visualizer" id="visualizer-left">
          ${'<div class="bar"></div>'.repeat(10)}
        </div>
        <div class="cover" id="cover">
          <img src="https://static.wixstatic.com/media/eaaa6a_025d2967304a4a619c482e79944f38d9~mv2.png" alt="Cover" />
        </div>
        <div class="visualizer" id="visualizer-right">
          ${'<div class="bar"></div>'.repeat(10)}
        </div>
        <audio id="audio" src="https://s.radiowave.io/ksdb.mp3" crossorigin="anonymous"></audio>
      </div>
    `;

    const audio = this.querySelector('#audio');
    const cover = this.querySelector('#cover');
    const leftBars = this.querySelectorAll('#visualizer-left .bar');
    const rightBars = this.querySelectorAll('#visualizer-right .bar');
    const visualizers = this.querySelectorAll('.visualizer');

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;

    const source = audioCtx.createMediaElementSource(audio);
    source.connect(audioCtx.destination);
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let isAnimating = false;

    function animate() {
      if (isAnimating) return;
      isAnimating = true;

      function loop() {
        analyser.getByteFrequencyData(dataArray);
        const allBars = [...leftBars, ...rightBars];
        const totalBars = allBars.length;
        const maxIndex = bufferLength - 1;

        allBars.forEach((bar, i) => {
          const normalizedIndex = i / totalBars;
          const logIndex = Math.floor(Math.pow(normalizedIndex, 2) * maxIndex);
          const value = dataArray[logIndex] || 0;
          const scale = Math.max(value / 128, 0.5);
          bar.style.transform = `scaleY(${scale})`;
        });

        requestAnimationFrame(loop);
      }

      loop();
    }

    function resetBars() {
      const allBars = [...leftBars, ...rightBars];
      allBars.forEach(bar => {
        bar.style.transform = 'scaleY(0.5)';
      });
    }

    cover.addEventListener('click', () => {
      if (audio.paused) {
        audio.load();
        audio.play();
        audioCtx.resume();
        visualizers.forEach(v => v.style.display = 'flex');
        animate();
      } else {
        audio.pause();
        resetBars();
      }
    });
  }
}

customElements.define('audio-visualizer-mobile', AudioVisualizer);
