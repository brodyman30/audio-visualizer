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
          width: 250px;
          height: 250px;
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
          animation: pulse 1s infinite ease-in-out;
          animation-play-state: paused;
        }

        .bar:nth-child(2) { animation-delay: 0.1s; }
        .bar:nth-child(3) { animation-delay: 0.2s; }
        .bar:nth-child(4) { animation-delay: 0.3s; }
        .bar:nth-child(5) { animation-delay: 0.4s; }

        @keyframes pulse {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
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
        <audio id="audio" src="https://s.radiowave.io/ksdb.mp3"></audio>
      </div>
    `;

    const coverImage = this.shadowRoot.getElementById('coverImage');
    const audio = this.shadowRoot.getElementById('audio');
    const bars = this.shadowRoot.querySelectorAll('.bar');
    const visualizers = this.shadowRoot.querySelectorAll('.visualizer');

    coverImage.addEventListener('click', () => {
      if (audio.paused) {
        audio.play();
        visualizers.forEach(v => v.style.display = 'flex');
        bars.forEach(bar => bar.style.animationPlayState = 'running');

        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: 'Wildcat 91.9',
            artist: 'Listen Live!',
            album: 'You Belong!',
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
            visualizers.forEach(v => v.style.display = 'flex');
            bars.forEach(bar => bar.style.animationPlayState = 'running');
          });

          navigator.mediaSession.setActionHandler('pause', () => {
            audio.pause();
            bars.forEach(bar => bar.style.animationPlayState = 'paused');
          });
        }
      } else {
        audio.pause();
        bars.forEach(bar => bar.style.animationPlayState = 'paused');
      }
    });
  }
}

customElements.define('audio-visualizer', AudioVisualizerMobile);
