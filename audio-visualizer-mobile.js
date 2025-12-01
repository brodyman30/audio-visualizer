/**
 * Audio Visualizer - Optimal Solution for ALL Devices
 * 
 * Features:
 * - Visualizer animates when screen is ON (all devices including iOS)
 * - Audio continues when screen is OFF (background playback)
 * - Lock screen controls work on iOS
 * - Visualizer pauses when not visible (saves battery)
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

    // Position bars radially
    bars.forEach((bar, i) => {
      const angleDeg = (i / bars.length) * 360;
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
        let binIdx = Math.floor(i / bars.length * bufferLength);
        if (binIdx >= bufferLength / 2) binIdx = bufferLength - binIdx - 1;
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

    // Handle visibility changes - pause visualizer when screen is off, but keep audio playing
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Screen is off/tab is hidden - stop visualizer animation (save battery)
        stopVisualizer();
        console.log('🌙 Screen off - visualizer paused, audio continues');
      } else {
        // Screen is on/tab is visible - resume visualizer if audio is playing
        if (!audio.paused) {
          startVisualizer();
          console.log('☀️ Screen on - visualizer resumed');
        }
      }
    });

    cover.addEventListener('click', async () => {
      try {
        // ✅ Initialize AudioContext only once
        if (!audioCtx) {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
        }

        // ✅ Create and connect source only once
        if (!isSourceConnected) {
          try {
            // Try captureStream first (Chrome/Firefox - best approach)
            if (typeof audio.captureStream === 'function') {
              const stream = audio.captureStream();
              source = audioCtx.createMediaStreamSource(stream);
              source.connect(analyser);
              console.log('✅ Using captureStream - optimal method');
            } else {
              // Safari path - createMediaElementSource
              // Audio will play in background via Media Session API
              source = audioCtx.createMediaElementSource(audio);
              source.connect(analyser);
              analyser.connect(audioCtx.destination);
              console.log('✅ Using createMediaElementSource - Safari mode');
            }
            isSourceConnected = true;
          } catch (error) {
            console.error('Error connecting audio source:', error);
          }
        }

        // ✅ Resume AudioContext if suspended
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        if (audio.paused) {
          await audio.play();
          bars.forEach(bar => (bar.style.opacity = '1'));
          
          // Start visualizer only if screen is on
          if (!document.hidden) {
            startVisualizer();
          }

          // ✅ Media Session API - enables lock screen controls and background playback
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
        console.error('Error in audio playback:', error);
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
