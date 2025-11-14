<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Audio Visualizer</title>
  <style>
    /* 🔊 Floating Mute/Unmute Toggle */
    #audio-toggle {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(to top, #8262a9, #fdc259);
      color: white;
      font-size: 20px;
      padding: 10px 14px;
      border-radius: 50%;
      cursor: grab;
      opacity: 0.2;
      transition: opacity 0.3s ease;
      z-index: 9999;
      user-select: none;
    }

    #audio-toggle:hover {
      opacity: 1;
    }
  </style>
</head>
<body>
  <!-- ✅ Global audio element (persistent across pages) -->
  <div id="audio-root">
    <audio id="global-audio" src="https://s.radiowave.io/ksdb.mp3" autoplay loop crossorigin="anonymous"></audio>
  </div>

  <!-- ✅ Floating mute/unmute toggle -->
  <div id="audio-toggle" title="Toggle Audio">🔊</div>

  <!-- ✅ Your custom visualizer -->
  <audio-visualizer></audio-visualizer>

  <script>
    // ✅ Floating toggle logic
    document.addEventListener('DOMContentLoaded', () => {
      const audio = document.getElementById('global-audio');
      const toggle = document.getElementById('audio-toggle');

      // Ensure audio plays after first user interaction
      document.addEventListener('click', () => {
        if (audio && audio.paused) {
          audio.play();
        }
      }, { once: true });

      // Toggle mute/unmute
      toggle.addEventListener('click', () => {
        if (!audio) return;
        audio.muted = !audio.muted;
        toggle.textContent = audio.muted ? '🔇' : '🔊';
      });

      // Set initial icon
      toggle.textContent = audio.muted ? '🔇' : '🔊';

      // Drag logic
      let isDragging = false;
      let offsetX, offsetY;

      toggle.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - toggle.offsetLeft;
        offsetY = e.clientY - toggle.offsetTop;
        toggle.style.cursor = 'grabbing';
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        toggle.style.left = `${e.clientX - offsetX}px`;
        toggle.style.top = `${e.clientY - offsetY}px`;
        toggle.style.bottom = 'auto';
        toggle.style.right = 'auto';
      });

      document.addEventListener('mouseup', () => {
        isDragging = false;
        toggle.style.cursor = 'grab';
      });
    });

    // ✅ Custom Element: AudioVisualizer
    class AudioVisualizer extends HTMLElement {
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

            .container {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 16px;
            }

            .cover {
              width: 250px;
              height: 250px;
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
              ${'<div class="bar"></div>'.repeat(8)}
            </div>
            <div class="cover" id="cover">
              <img src="https://static.wixstatic.com/media/eaaa6a_025d2967304a4a619c482e79944f38d9~mv2.png" alt="Cover" />
            </div>
            <div class="visualizer" id="visualizer-right">
              ${'<div class="bar"></div>'.repeat(8)}
            </div>
          </div>
        `;

        const audio = document.getElementById('global-audio'); // ✅ Use global audio
        const cover = this.shadowRoot.getElementById('cover');
        const leftBars = this.shadowRoot.querySelectorAll('#visualizer-left .bar');
        const rightBars = this.shadowRoot.querySelectorAll('#visualizer-right .bar');
        const visualizers = this.shadowRoot.querySelectorAll('.visualizer');

        const audioCtx = window._audioCtx || new AudioContext();
        window._audioCtx = audioCtx;

        const analyser = window._analyser || audioCtx.createAnalyser();
        window._analyser = analyser;
        analyser.fftSize = 256;

        if (!window._audioConnected) {
          const source = audioCtx.createMediaElementSource(audio);
          source.connect(audioCtx.destination);
          source.connect(analyser);
          window._audioConnected = true;
        }

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        let isAnimating = false;

        function animate() {
          if (isAnimating) return;
          isAnimating = true;

          function loop() {
            if (!isAnimating) return;

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
            audio.play();
            audioCtx.resume();
            visualizers.forEach(v => v.style.display = 'flex');
            animate();
          } else {
            audio.pause();
            isAnimating = false;
            resetBars();
          }
        });

        // ✅ Auto-resume visualizer if audio is already playing
        if (!audio.paused) {
          visualizers.forEach(v => v.style.display = 'flex');
          animate();
        }
      }
    }

    customElements.define('audio-visualizer', AudioVisualizer);
  </script>
</body>
</html>

customElements.define('audio-visualizer', AudioVisualizer);
