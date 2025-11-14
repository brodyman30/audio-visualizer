class TestVisualizer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <style>
        .container {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .cover {
          width: 150px;
          height: 150px;
          cursor: pointer;
        }

        .cover img {
          width: 100%;
          height: 100%;
          border-radius: 12px;
          object-fit: cover;
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
          transform: scaleY(0.3);
      
        }
      </style>

      <div class="container">
        <div class="visualizer" id="visualizer">
          ${'<div class="bar"></div>'.repeat(10)}
        </div>
        <div class="cover" id="cover">
          <img src="https://static.wixstatic.com/media/eaaa6a_025d2967304a4a619c482e79944f38d9~mv2.png" alt="Cover" />
        </div>
        <audio id="audio" src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" crossorigin="anonymous"></audio>
      </div>
    `;

    const audio = this.shadowRoot.getElementById('audio');
    const cover = this.shadowRoot.getElementById('cover');
    const bars = this.shadowRoot.querySelectorAll('.bar');
    const visualizer = this.shadowRoot.getElementById('visualizer');

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;

    const source = audioCtx.createMediaElementSource(audio);
    source.connect(audioCtx.destination); // 🔊 sound output
    source.connect(analyser);             // 📊 visualizer input

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let isAnimating = false;

    function animate() {
      if (isAnimating) return;
      isAnimating = true;

      function loop() {
        analyser.getByteFrequencyData(dataArray);
        const binsPerBar = Math.floor(bufferLength / bars.length);

        bars.forEach((bar, i) => {
          let sum = 0;
          for (let j = 0; j < binsPerBar; j++) {
            sum += dataArray[i * binsPerBar + j] || 0;
          }
          const avg = sum / binsPerBar;
          const scale = Math.max(avg / 128, 0.3);
          bar.style.transform = `scaleY(${scale})`;
        });

        requestAnimationFrame(loop);
      }

      loop();
    }

    cover.addEventListener('click', () => {
      audio.play();
      audioCtx.resume();
      visualizer.style.display = 'flex';
      animate();
    });
  }
}

customElements.define('test-visualizer', TestVisualizer);
