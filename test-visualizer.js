class AudioVisualizerMobile extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          height: 100%;
        }

        .player-wrapper {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: 16px;
        }

        .audio-player {
          width: 150px;
          height: 150px;
          cursor: pointer;
        }

        .audio-img {
          width: 100%;
          height: 100%;
          border-radius: 12px;
          object-fit: contain;
        }

        .visualizer {
          display: none;
          flex-direction: row;
          align-items: flex-end;
          justify-content: center;
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

        audio {
          display: none;
        }
      </style>

      <div class="player-wrapper">
        <div class="visualizer" id="visualizer-left">
          <div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div>
        </div>
        <div class="audio-player" id="coverImage">
          <img src="https://static.wixstatic.com/media/eaaa6a_025d2967304a4a619c482e79944f38d9~mv2.png" alt="Cover" class="audio-img" />
        </div>
        <div class="visualizer" id="visualizer-right">
          <div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div>
        </div>
        <audio id="audio" src="https://stream.live.vc.bbcmedia.co.uk/bbc_radio_one" crossorigin="anonymous"></audio>
      </div>
    `;

    const coverImage = this.shadowRoot.getElementById('coverImage');
    const audio = this.shadowRoot.getElementById('audio');
    const bars = this.shadowRoot.querySelectorAll('.bar');
    const visualizers = this.shadowRoot.querySelectorAll('.visualizer');

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;

    const source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let isAnimating = false;

    function animateVisualizer() {
      if (isAnimating) return;
      isAnimating = true;

      function loop() {
        analyser.getByteFrequencyData(dataArray);
        console.log([...dataArray]); // Logs frequency data

        const binsPerBar = Math.floor(bufferLength / bars.length);
        bars.forEach((bar, i) => {
          let sum = 0;
          for (let j = 0; j < binsPerBar; j++) {
            const index = i * binsPerBar + j;
            sum += dataArray[index] || 0;
          }
          const avg = sum / binsPerBar;
          const scale = Math.max(avg / 128, 0.3);
          bar.style.transform = `scaleY(${scale})`;
        });

        requestAnimationFrame(loop);
      }

      loop();
    }

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'BBC Radio 1',
        artist: 'Live Stream',
        album: 'Visualizer Test',
        artwork: [
          {
            src: 'https://static.wixstatic.com/media/eaaa6a_770de7258bcd43a688ec5d83a065e911~mv2.png',
            sizes: '300x300',
            type: 'image/png'
          }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
        audio.play();
        audioCtx.resume();
        visualizers.forEach(v => v.style.display = 'flex');
        animateVisualizer();
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        audio.pause();
      });
    }

    coverImage.addEventListener('click', () => {
      if (audio.paused) {
        audio.play();
        audioCtx.resume();
        visualizers.forEach(v => v.style.display = 'flex');
        animateVisualizer();
      } else {
        audio.pause();
      }
    });
  }
}

customElements.define('test-visualizer', AudioVisualizerMobile);
