class AudioVisualizer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <style>
        .player-wrapper {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .audio-player {
          position: relative;
          width: 250px;
          height: 250px;
          cursor: pointer;
        }

        .audio-img {
          width: 100%;
          height: 100%;
          border-radius: 12px;
        }

        .visualizer {
          display: flex;
          flex-direction: row;
          justify-content: center;
          gap: 4px;
          height: 200px;
        }

        .bar {
          width: 8px;
          background: linear-gradient(to top, #8262a9, #fdc259);
          border-radius: 4px;
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
          <img src="https://static.wixstatic.com/media/eaaa6a_5dce43e4f7564dba9701da64b842d743.png" alt="Cover" class="audio-img" />
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

    coverImage.addEventListener('click', () => {
      if (audio.paused) {
        audio.play();
        bars.forEach(bar => bar.style.animationPlayState = 'running');

        // ✅ Set MediaSession metadata after playback starts
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: 'Wildcat 91.9',
            artist: 'Listen Live!',
            album: 'You Belong!',
            artwork: [
              {
                src: this.shadowRoot.querySelector('.audio-img').src,
                sizes: '300x300',
                type: 'image/png'
              }
            ]
          });

          navigator.mediaSession.setActionHandler('play', () => {
            audio.play();
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

customElements.define('audio-visualizer', AudioVisualizer);
