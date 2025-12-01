/**
 * Audio Visualizer with iOS Background Audio Priority
 * 
 * This version prioritizes background audio playback on iOS over visualizer functionality.
 * On iOS Safari, you can choose:
 * 1. Visualizer works, but background audio may not work (createMediaElementSource)
 * 2. Background audio works, but visualizer doesn't animate (original approach)
 * 
 * This version tries to detect and use the best approach for each browser.
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
        <!-- ✅ Optimized for iOS background audio -->
        <audio id="audio" src="https://s.radiowave.io/ksdb.mp3" crossorigin="anonymous" playsinline></audio>
      </div>
    `;

    const audio = this.querySelector('#audio');
    const cover = this.querySelector('#cover');
    const bars = this.querySelectorAll('#visualizer-circle .bar');

    let audioCtx, analyser, source;
    let isAnimating = false;
    let isSourceConnected = false;
    let visualizerEnabled = true; // Can be disabled if issues detected
    const bufferLength = 128;
    const dataArray = new Uint8Array(bufferLength);

    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // Position bars radially
    bars.forEach((bar, i) => {
      const angleDeg = (i / bars.length) * 360;
      bar.style.transform = `rotate(${angleDeg}deg) translateY(-70px) scaleY(0.5)`;
    });

    function animate() {
      if (isAnimating || !analyser || !visualizerEnabled) return;
      isAnimating = true;

      function loop() {
        if (!visualizerEnabled) {
          isAnimating = false;
          return;
        }
        
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

        // ✅ Create and connect source - iOS background audio optimized
        if (!isSourceConnected && visualizerEnabled) {
          try {
            // For iOS Safari: Only try captureStream if available
            // If not available, skip visualizer to preserve background audio
            if (typeof audio.captureStream === 'function') {
              // Chrome/Firefox/Edge - full visualizer + background audio
              const stream = audio.captureStream();
              source = audioCtx.createMediaStreamSource(stream);
              source.connect(analyser);
              console.log('✅ Using captureStream - full visualizer + background audio');
            } else if (!isIOS || !isSafari) {
              // Desktop Safari - visualizer works, background might be limited
              source = audioCtx.createMediaElementSource(audio);
              source.connect(analyser);
              analyser.connect(audioCtx.destination);
              console.log('⚠️ Using createMediaElementSource - visualizer works');
            } else {
              // iOS Safari - prioritize background audio over visualizer
              console.log('ℹ️ iOS Safari detected - background audio prioritized, visualizer disabled');
              visualizerEnabled = false;
              bars.forEach(bar => bar.style.opacity = '0.3'); // Show static bars
            }
            isSourceConnected = true;
          } catch (error) {
            console.error('Error connecting audio source:', error);
            visualizerEnabled = false;
          }
        }

        // ✅ Resume AudioContext if suspended (required on iOS)
        if (audioCtx && audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        if (audio.paused) {
          await audio.play(); // ✅ audio element drives playback
          
          if (visualizerEnabled) {
            bars.forEach(bar => (bar.style.opacity = '1'));
            animate();
          } else {
            bars.forEach(bar => (bar.style.opacity = '0.3')); // Static bars for iOS
          }

          // ✅ Media Session API for lock screen controls and background playback
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
              if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();
              if (visualizerEnabled) {
                bars.forEach(bar => (bar.style.opacity = '1'));
                animate();
              }
            });

            navigator.mediaSession.setActionHandler('pause', () => {
              audio.pause();
              if (visualizerEnabled) {
                bars.forEach(bar => (bar.style.opacity = '0'));
              } else {
                bars.forEach(bar => (bar.style.opacity = '0.3'));
              }
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

    // Monitor audio playback for debugging
    audio.addEventListener('play', () => console.log('▶️ Audio playing'));
    audio.addEventListener('pause', () => console.log('⏸️ Audio paused'));
    audio.addEventListener('error', (e) => console.error('❌ Audio error:', e));
  }
}

customElements.define('audio-visualizer-mobile', AudioVisualizer);
