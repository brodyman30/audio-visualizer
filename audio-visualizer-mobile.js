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
      </style>

      <div class="container">
        <div class="visualizer-circle" id="visualizer-circle">
          ${Array.from({ length: 48 }, () => '<div class="bar"></div>').join('')}
        </div>
        <div class="cover" id="cover">
          <img src="https://static.wixstatic.com/media/eaaa6a_025d2967304a4a619c482e79944f38d9~mv2.png" alt="Cover" />
        </div>
        <!-- ✅ playsinline ensures iOS background audio -->
        <audio id="audio" src="https://s.radiowave.io/ksdb.mp3" crossorigin="anonymous" playsinline></audio>
      </div>
    `;

    const audio = this.querySelector('#audio');
    const cover = this.querySelector('#cover');
    const bars = this.querySelectorAll('#visualizer-circle .bar');

    let audioCtx, analyser, source;
    let isAnimating = false;
    let isSourceConnected = false;
    let usesCaptureStream = false; // Track which method we're using
    const bufferLength = 128;
    const dataArray = new Uint8Array(bufferLength);

    // Position bars radially
    bars.forEach((bar, i) => {
      const angleDeg = (i / bars.length) * 360;
      bar.style.transform = `rotate(${angleDeg}deg) translateY(-70px) scaleY(0.5)`;
    });

    function animate() {
      if (isAnimating || !analyser) return;
      isAnimating = true;

      function loop() {
        analyser.getByteFrequencyData(dataArray);
        bars.forEach((bar, i) => {
          let binIdx = Math.floor(i / bars.length * bufferLength);
          if (binIdx >= bufferLength / 2) binIdx = bufferLength - binIdx - 1;
          const value = dataArray[binIdx] || 0;
          const scale = Math.max(value / 128, 0.5);
          const angleDeg = (i / bars.length) * 360;
          bar.style.transform = `rotate(${angleDeg}deg) translateY(-70px) scaleY(${scale})`;
        });
        requestAnimationFrame(loop);
      }
      loop();
    }

    function resetBars() {
      bars.forEach((bar, i) => {
        const angleDeg = (i / bars.length) * 360;
        bar.style.transform = `rotate(${angleDeg}deg) translateY(-70px) scaleY(0.5)`;
      });
    }

    cover.addEventListener('click', async () => {
      try {
        // ✅ Initialize AudioContext only once
        if (!audioCtx) {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
        }

        // ✅ Create and connect source only once - SAFARI COMPATIBLE
        if (!isSourceConnected) {
          try {
            // Use createMediaElementSource instead of captureStream
            // This works on ALL browsers including Safari (iOS and macOS)
            source = audioCtx.createMediaElementSource(audio);
            source.connect(analyser);
            // ✅ CRITICAL: Connect analyser to destination so audio plays
            analyser.connect(audioCtx.destination);
            isSourceConnected = true;
          } catch (error) {
            console.error('Error connecting audio source:', error);
            // Fallback: audio will play but visualizer won't work
          }
        }

        // ✅ Resume AudioContext if suspended (required on iOS)
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        if (audio.paused) {
          await audio.play(); // ✅ audio element drives playback
          bars.forEach(bar => (bar.style.opacity = '1'));
          animate();

          // ✅ Media Session metadata and handlers
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
              animate();
            });

            navigator.mediaSession.setActionHandler('pause', () => {
              audio.pause();
              bars.forEach(bar => (bar.style.opacity = '0'));
              resetBars();
            });
          }
        } else {
          audio.pause();
          bars.forEach(bar => (bar.style.opacity = '0'));
          resetBars();
        }
      } catch (error) {
        console.error('Error in audio playback:', error);
      }
    });
  }
}

customElements.define('audio-visualizer-mobile', AudioVisualizer);
