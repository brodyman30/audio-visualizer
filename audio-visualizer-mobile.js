/**
 * Audio Visualizer - Full Circle
 * Bars mirrored so both halves animate identically
 */
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
          transition: transform 0.2s ease;
        }
        .cover:active {
          transform: translate(-50%, -50%) scale(0.95);
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
      </style>

      <div class="container">
        <div class="visualizer-circle" id="visualizer-circle">
          ${Array.from({ length: 48 }, () => '<div class="bar"></div>').join('')}
        </div>
        <div class="cover" id="cover">
          <img src="https://static.wixstatic.com/media/eaaa6a_025d2967304a4a619c482e79944f38d9~mv2.png" alt="Cover" />
        </div>
        <audio id="audio" src="https://s.radiowave.io/ksdb.mp3" crossorigin="anonymous" playsinline></audio>
      </div>
    `;

    const audio = this.querySelector('#audio');
    const cover = this.querySelector('#cover');
    const bars = this.querySelectorAll('#visualizer-circle .bar');

    let audioCtx, analyser, source;
    let animationFrameId = null;
    let isSourceConnected = false;
    const bufferLength = 256;
    const dataArray = new Uint8Array(bufferLength);

    // Position bars radially around full circle
    bars.forEach((bar, i) => {
      const angleDeg = (i / bars.length) * 360;
      bar.style.transform = `rotate(${angleDeg}deg) translateY(-70px) scaleY(0.5)`;
    });

    function animate() {
      if (document.hidden) {
        animationFrameId = null;
        return;
      }
      if (!analyser) return;

      analyser.getByteFrequencyData(dataArray);

      bars.forEach((bar, i) => {
        // ✅ Mirror bins: use only first half of spectrum
        const binIdx = Math.floor((i / bars.length) * (bufferLength / 2));
        const value = dataArray[binIdx] || 0;
        const scale = Math.max(value / 128, 0.5);
        const angleDeg = (i / bars.length) * 360;
        bar.style.transform = `rotate(${angleDeg}deg) translateY(-70px) scaleY(${scale})`;
      });

      animationFrameId = requestAnimationFrame(animate);
    }

    function startVisualizer() {
      if (!animationFrameId && !document.hidden) {
        animate();
      }
    }

    function stopVisualizer() {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    }

    function resetBars() {
      bars.forEach((bar, i) => {
        const angleDeg = (i / bars.length) * 360;
        bar.style.transform = `rotate(${angleDeg}deg) translateY(-70px) scaleY(0.5)`;
      });
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopVisualizer();
      } else {
        if (!audio.paused) startVisualizer();
      }
    });

    cover.addEventListener('click', async () => {
      try {
        if (!audioCtx) {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          analyser = audioCtx.createAnalyser();
          analyser.fftSize = 512;
        }

        if (!isSourceConnected) {
          if (typeof audio.captureStream === 'function') {
            const stream = audio.captureStream();
            source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
          } else {
            source = audioCtx.createMediaElementSource(audio);
            source.connect(analyser);
            source.connect(audioCtx.destination);
          }
          isSourceConnected = true;
        }

        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        if (audio.paused) {
          await audio.play();
          bars.forEach(bar => (bar.style.opacity = '1'));
          if (!document.hidden) startVisualizer();

          if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: 'Wildcat 91.9',
              artist: 'You Belong.',
              album: 'Live Stream',
              artwork: [
                {
                  src: 'https://static.wixstatic.com/media/eaaa6a_025d2967304a4a619c482e79944f38d9~mv2.png',
                  sizes: '512x512',
                  type: 'image/png'
                }
              ]
            });

            navigator.mediaSession.setActionHandler('play', async () => {
              await audio.play();
              if (audioCtx.state === 'suspended') await audioCtx.resume();
              bars.forEach(bar => (bar.style.opacity = '1'));
              if (!document.hidden) startVisualizer();
            });

            navigator.mediaSession.setActionHandler('pause', () => {
              audio.pause();
              bars.forEach(bar => (bar.style.opacity = '0'));
              stopVisualizer();
              resetBars();
            });
          }
        } else {
          audio.pause();
          bars.forEach(bar => (bar.style.opacity = '0'));
          stopVisualizer();
          resetBars();
        }
      } catch (error) {
        console.error('❌ Error in audio playback:', error.message);
      }
    });

    this.disconnectedCallback = () => {
      stopVisualizer();
      if (audioCtx) audioCtx.close();
    };
  }
}

customElements.define('audio-visualizer-mobile', AudioVisualizer);
