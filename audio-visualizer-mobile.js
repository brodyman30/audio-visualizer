class AudioVisualizer extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <style>
        .container {
          position: relative;
          width: 220px;
          height: 220px;
        }

        /* Centered logo */
        .logo {
          position: absolute;
          top: 50%;
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

        /* Bars and bolts share same center */
        .visualizer-circle,
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

        .bolt {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 40px;
          height: 40px;
          opacity: 0;
          transform: translate(-50%, -50%);
        }

        .bolt img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 0 6px #fdc259);
        }

        @keyframes lightningPulse {
          0%   { opacity: 0; filter: drop-shadow(0 0 2px #fdc259); }
          30%  { opacity: 1; filter: drop-shadow(0 0 12px #fdc259); }
          60%  { opacity: 1; filter: drop-shadow(0 0 20px #fdc259); }
          100% { opacity: 0; filter: drop-shadow(0 0 2px #fdc259); }
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
              <img src="https://static.wixstatic.com/shapes/eaaa6a_3307af24f68941bfaa446785b9f2b16a.svg" />
            </div>
          `).join('')}
        </div>
      </div>
    `;
    // JS logic unchanged...
  }
}
customElements.define('audio-visualizer-mobile', AudioVisualizer);


