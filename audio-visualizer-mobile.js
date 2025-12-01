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
        .bolt {
          position: absolute;
          bottom: 50%;
          left: 50%;
          width: 2px;
          height: 60px;
          background: linear-gradient(to top, #fdc259, #fff);
          opacity: 0;
          transform-origin: bottom center;
          border-radius: 2px;
          box-shadow: 0 0 8px #fdc259;
        }
      </style>

      <div class="container">
        <div class="visualizer-circle" id="visualizer-circle">
          ${Array.from({ length: 48 }, () => '<div class="bar"></div>').join('')}
        </div>
        <div class="cover" id="cover">
          <img src="https://static.wixstatic.com/media/eaaa6a_025d2967304a4a619c482e79944f38d9~mv2.png" alt="Tower" />
        </div>
        <audio id="audio" src="https://s.radiowave.io/ksdb.mp3" crossorigin="anonymous" playsinline></audio>
        <div id="bolts">
          ${Array.from({ length: 6 }, () => '<div class="bolt"></div>').join('')}
        </div>
      </div>
    `;

    const audio = this.querySelector('#audio');
    const cover = this.querySelector('#cover');
    const bars = this.querySelectorAll('#visualizer-circle .bar');
    const bolts = this.querySelectorAll('#bolts .bolt');

    let audioCtx, analyser;
    const bufferLength = 128;
    const dataArray = new Uint8Array(bufferLength);

    // Platform detection
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isAndroid = /Android/.test(navigator.userAgent);

    // Position bars radially
    bars.forEach((bar, i) => {
      const angleDeg = (i / bars.length) * 360;
      bar.style.transform = `rotate(${angleDeg}deg) translateY(-70px) scaleY(0.5)`;
    });

    // Lightning bolt animation for iOS
    function shootBolt(bolt) {
      const angle = Math.random() * 360;
      bolt.style.transform = `rotate(${angle}deg) translateY(-40px)`;
      bolt.style.opacity = 1;
      setTimeout(() => (bolt.style.opacity = 0), 300);
    }
    function iosLoop() {
      setInterval(() => {
        const bolt = bolts[Math.floor(Math.random() * bolts.length)];
        shootBolt(bolt);
      }, 500);
    }

    // Bar visualizer animation for Android
    function androidLoop() {
      analyser.getByteFrequencyData(dataArray);
      const halfBars = bars.length / 2;
      bars.forEach((bar, i) => {
        const binIdx = Math.floor((i % halfBars) / halfBars * (bufferLength / 2));
        const value = dataArray[binIdx] || 0;
        const scale = Math.max(value / 128, 0.5);
        const angleDeg = (i / bars.length) * 360;
        bar.style.transform = `rotate(${angleDeg}deg) translateY(-70px) scaleY(${scale})`;
      });
      requestAnimationFrame(androidLoop);
    }

    cover.addEventListener('click', async () => {
      if (audio.paused) {
        await audio.play();

        if (isIOS) {
          iosLoop(); // run lightning bolts
        } else if (isAndroid) {
          if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            const source = audioCtx.createMediaElementSource(audio);
            source.connect(analyser);
            source.connect(audioCtx.destination);
          }
          androidLoop(); // run analyser bars
        }
      } else {
        audio.pause();
      }
    });
  }
}

customElements.define('audio-visualizer-mobile', AudioVisualizer);
