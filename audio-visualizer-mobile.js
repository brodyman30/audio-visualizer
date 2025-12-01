/**
 * Audio Visualizer - Fixed for ALL Devices
 * Full circle with mirrored bars on left and right
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
          <!-- Left side bars (0-47) -->
          ${Array.from({ length: 48 }, () => '<div class="bar"></div>').join('')}
          <!-- Right side bars (48-95) -->
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
    const bufferLength = 128;
    const dataArray = new Uint8Array(bufferLength);

    // Position bars radially - FULL 360 degrees
    bars.forEach((bar, i) => {
      // Left side: bars 0-47 (angles 90 to 270)
      // Right side: bars 48-95 (angles 270 to 450, which is -90 to 90)
      let angleDeg;
      if (i < 48) {
        // Left side: 90 to 270 degrees
        angleDeg = 90 + (i / 48) * 180;
      } else {
        // Right side: 270 to 450 degrees (or -90 to 90)
        angleDeg = 270 + ((i - 48) / 48) * 180;
      }
      bar.style.transform = `rotate(${angleDeg}deg) translateY(-70px) scaleY(0.5)`;
    });

    function animate() {
      // Only animate if page is visible (screen is on)
      if (document.hidden) {
        animationFrameId = null;
        return;
      }

      if (!analyser) return;

      analyser.getByteFrequencyData(dataArray);
      bars.forEach((bar, i) => {
        let binIdx;
        let angleDeg;
        
        if (i < 48) {
          // Left side bars - use first half of frequency data
          binIdx = Math.floor((i / 48) * (bufferLength / 2));
          angleDeg = 90 + (i / 48) * 180;
        } else {
          // Right side bars - use second half of frequency data (mirrored)
          const rightIndex = i - 48;
          binIdx = Math.floor((rightIndex / 48) * (bufferLength / 2)) + (bufferLength / 2);
          angleDeg = 270 + ((i - 48) / 48) * 180;
        }

        const value = dataArray[binIdx] || 0;
        const scale = Math.max(value / 128, 0.5);
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
        let angleDeg;
        if (i < 48) {
          angleDeg = 90 + (i / 48) * 180;
        } else {
          angleDeg = 270 + ((i - 48) / 48) * 180;
        }
        bar.style.transform = `rotate(${angleDeg}deg) translateY(-70px) scaleY(0.5)`;
      });
    }

    // Handle visibility changes - pause visualizer when screen is off, but keep audio playing
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopVisualizer();
        console.log('🌙 Screen off - visualizer paused, audio continues');
      } else {
        if (!audio.paused) {
          startVisualizer();
          console.log('☀️ Screen on - visualizer resumed');
        }
      }
    });

    cover.addEventListener('click', async () => {
      try {
        // Initialize AudioContext only once
        if (!audioCtx) {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          console.log('✅ AudioContext initialized');
        }

        // Create and connect source only once
        if (!isSourceConnected) {
          try {
            // Check if captureStream is available (Chrome/Firefox)
            if (typeof audio.captureStream === 'function') {
              const stream = audio.captureStream();
              source = audioCtx.createMediaStreamSource(stream);
              source.connect(analyser);
              analyser.connect(audioCtx.destination);
              console.log('✅ Using captureStream (Chrome/Firefox)');
            } else {
              // Safari fallback: createMediaElementSource
              source = audioCtx.createMediaElementSource(audio);
              source.connect(analyser);
              analyser.connect(audioCtx.destination);
              console.log('✅ Using createMediaElementSource (Safari)');
            }
            isSourceConnected = true;
          } catch (error) {
            console.error('❌ Error connecting audio source:', error.message);
            return;
          }
        }

        // Resume AudioContext if suspended
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
          console.log('✅ AudioContext resumed');
        }

        if (audio.paused) {
          // PLAY
          await audio.play();
          bars.forEach(bar => (bar.style.opacity = '1'));
          
          if (!document.hidden) {
            startVisualizer();
          }

          console.log('▶️ Playing');

          // Media Session API
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
              bars.forEach(bar => (bar.style.opacity = '1'));
              if (!document.hidden) {
                startVisualizer();
              }
              console.log('▶️ Resumed from lock screen');
            });

            navigator.mediaSession.setActionHandler('pause', () => {
              audio.pause();
              bars.forEach(bar => (bar.style.opacity = '0'));
              stopVisualizer();
              resetBars();
              console.log('⏸ Paused from lock screen');
            });
          }
        } else {
          // PAUSE
          audio.pause();
          bars.forEach(bar => (bar.style.opacity = '0'));
          stopVisualizer();
          resetBars();
          console.log('⏸ Paused');
        }
      } catch (error) {
        console.error('❌ Error in audio playback:', error.message);
      }
    });

    // Clean up on disconnect
    this.disconnectedCallback = () => {
      stopVisualizer();
      if (audioCtx) {
        audioCtx.close();
      }
    };
  }
}

customElements.define('audio-visualizer-mobile', AudioVisualizer);

