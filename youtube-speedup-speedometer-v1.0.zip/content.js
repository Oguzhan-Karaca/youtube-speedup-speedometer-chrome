// YouTube SpeedUp - Chrome Extension
// Main content script

(function() {
  'use strict';

  const SPEED_INCREMENT = 0.25;
  const SPEED_MIN = 0.25;
  const SPEED_MAX = 16;
  const DEFAULT_SPEED = 1.0;
  const STORAGE_KEY = 'youtube_speed';

  let speedometerButton = null;
  let currentSpeed = DEFAULT_SPEED;
  let keepAliveInterval = null;
  let keepAliveTimer = null;

  // Check if extension context is still valid
  function isExtensionContextValid() {
    try {
      return chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local;
    } catch (e) {
      return false;
    }
  }

  // Load saved speed from storage
  function loadSpeed() {
    if (!isExtensionContextValid()) {
      console.log('Extension context not valid, skipping load');
      return;
    }
    
    try {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          return;
        }
        try {
          if (result && result[STORAGE_KEY]) {
            currentSpeed = parseFloat(result[STORAGE_KEY]);
            applySpeed();
          }
        } catch (e) {
          // Ignore parsing errors
        }
      });
    } catch (e) {
      // Extension context invalidated, ignore error
    }
  }

  // Save speed to storage
  function saveSpeed(speed) {
    if (!isExtensionContextValid()) {
      console.log('Extension context not valid, skipping save');
      return;
    }
    
    try {
      chrome.storage.local.set({ [STORAGE_KEY]: speed }, () => {
        if (chrome.runtime.lastError) {
          // Extension context might be invalidated, ignore error
        }
      });
    } catch (e) {
      // Extension context invalidated, ignore error
    }
  }

  // Apply speed to video
  function applySpeed() {
    const video = document.querySelector('video');
    if (video) {
      video.playbackRate = currentSpeed;
      updateSpeedometerDisplay();
    }
  }

  // Update speedometer button display
  function updateSpeedometerDisplay(showTemporarily = false) {
    if (speedometerButton) {
      const speedText = speedometerButton.querySelector('.speed-text');
      if (speedText) {
        speedText.textContent = currentSpeed.toFixed(2); // visual text without 'x'
      }

      // Update aria-label for accessibility
      speedometerButton.setAttribute('aria-label', `Geschwindigkeit: ${currentSpeed.toFixed(2)}x (Klicken zum Zurücksetzen, Mausrad zum Ändern)`);
      speedometerButton.removeAttribute('title');
      
      // Clear any existing timeout
      clearTimeout(speedometerButton._hideSpeedTimeout);
      
      // Show numeric display only temporarily as feedback
      if (showTemporarily) {
        speedometerButton.classList.add('show-speed');
        
        // Auto-hide after delay (1.7 seconds for better feedback visibility)
        speedometerButton._hideSpeedTimeout = setTimeout(() => {
          if (speedometerButton) {
            speedometerButton.classList.remove('show-speed');
          }
        }, 1700);
      } else {
        // Always show icon, never show number unless explicitly requested
        speedometerButton.classList.remove('show-speed');
      }
    }
  }

  // Change speed
  function changeSpeed(delta) {
    let newSpeed = currentSpeed + delta;
    newSpeed = Math.max(SPEED_MIN, Math.min(SPEED_MAX, newSpeed));
    newSpeed = Math.round(newSpeed * 100) / 100; // Round to 2 decimals

    if (newSpeed !== currentSpeed) {
      currentSpeed = newSpeed;
      saveSpeed(currentSpeed);
      applySpeed();
    }
  }

  // Reset speed to default
  function resetSpeed() {
    currentSpeed = DEFAULT_SPEED;
    saveSpeed(currentSpeed);
    applySpeed();
  }

  // Keep controls visible temporarily when scrolling (with manual updates)
  function keepControlsVisibleTemporarily() {
    // Clear existing timers
    if (keepAliveTimer) {
      clearTimeout(keepAliveTimer);
    }
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
    }

    // Start interval to force controls visible + update time/progress manually
    keepAliveInterval = setInterval(() => {
      // Remove autohide class to keep controls visible
      const container = document.querySelector('#movie_player');
      if (container) {
        container.classList.remove('ytp-autohide');
      }

      // Manually update time display (because removing autohide breaks YouTube's updates)
      const video = document.querySelector('video');
      const timeDisplay = document.querySelector('.ytp-time-current');
      
      if (video && timeDisplay) {
        const hours = Math.floor(video.currentTime / 3600);
        let minutes = Math.floor(video.currentTime / 60) - (hours * 60);
        let seconds = Math.round(video.currentTime % 60);
        
        if (seconds < 10) seconds = `0${seconds}`;
        if (hours > 0 && minutes < 10) minutes = `0${minutes}`;
        
        timeDisplay.innerText = `${(hours > 0 ? hours + ':' : '')}${minutes}:${seconds}`;
      }

      // Manually update progress bar
      if (video) {
        const progressBar = document.querySelector('.ytp-play-progress');
        if (progressBar) {
          const percentagePlayed = video.currentTime / video.duration;
          progressBar.style.transform = `scaleX(${percentagePlayed})`;
          progressBar.style.left = '0px';
        }

        // Also update buffer bar
        const bufferedBar = document.querySelector('.ytp-load-progress');
        if (bufferedBar && video.buffered.length > 0) {
          const percentageBuffered = video.buffered.end(0) / video.duration;
          bufferedBar.style.transform = `scaleX(${percentageBuffered})`;
          bufferedBar.style.left = '0px';
        }
      }
    }, 100); // 100ms update interval

    // Stop after 2 seconds of inactivity (gets extended on each wheel event)
    keepAliveTimer = setTimeout(() => {
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
    }, 2000);
  }

  // Create speedometer SVG icon
  function createSpeedometerIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 3334 3334');
    svg.setAttribute('width', '44');
    svg.setAttribute('height', '44');
    svg.classList.add('speedometer-icon');

    svg.innerHTML = `
      <!-- Speedometer arc -->
      <path d="M1065.765,2106.376c-118.847,-105.749 -199.783,-240.465 -232.573,-387.137c-32.79,-146.663 -15.961,-298.693 48.358,-436.847c64.319,-138.158 173.241,-256.243 312.991,-339.323c139.749,-83.08 304.045,-127.424 472.125,-127.424c168.08,0 332.379,44.344 472.129,127.424c139.75,83.08 248.663,201.165 312.982,339.323c64.319,138.154 81.156,290.185 48.364,436.847c-32.792,146.672 -113.725,281.388 -232.57,387.137" style="fill:none;stroke:currentColor;stroke-width:212.96px;stroke-linecap:round;stroke-linejoin:round;"/>
      <!-- Needle -->
      <path d="M1666.667,1666.667l412.067,-371.327" style="fill:none;stroke:currentColor;stroke-width:200.21px;stroke-linecap:round;"/>
    `;

    return svg;
  }

  // Create speedometer button
  function createSpeedometerButton() {
    const button = document.createElement('button');
    button.className = 'ytp-button speedometer-button';
    button.setAttribute('aria-label', 'Geschwindigkeit ändern');

    const icon = createSpeedometerIcon();
    button.appendChild(icon);

    // Add speed text overlay
    const speedText = document.createElement('span');
    speedText.className = 'speed-text';
    speedText.textContent = DEFAULT_SPEED.toFixed(2); // show numeric without 'x' visually
    button.appendChild(speedText);

    // Tooltip shown on hover
    const tooltip = document.createElement('span');
    tooltip.className = 'speed-tooltip';
    tooltip.textContent = 'Scroll to change speed, click to reset';
    button.appendChild(tooltip);

    // Click event - reset to default
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      resetSpeed();
      // Show feedback by temporarily displaying the speed
      updateSpeedometerDisplay(true);
    });

    // Wheel event - change speed
    button.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY < 0 ? SPEED_INCREMENT : -SPEED_INCREMENT;
      changeSpeed(delta);
      updateSpeedometerDisplay(true);
      
      // Keep controls visible while scrolling
      keepControlsVisibleTemporarily();
    }, { passive: false });

    // Keyboard support
    button.addEventListener('keydown', (e) => {
      switch(e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          resetSpeed();
          updateSpeedometerDisplay(true);
          break;
        case 'ArrowUp':
        case 'ArrowRight':
          e.preventDefault();
          changeSpeed(SPEED_INCREMENT);
          updateSpeedometerDisplay(true);
          break;
        case 'ArrowDown':
        case 'ArrowLeft':
          e.preventDefault();
          changeSpeed(-SPEED_INCREMENT);
          updateSpeedometerDisplay(true);
          break;
      }
    });

    return button;
  }

  // Insert speedometer button into YouTube controls
  function insertSpeedometer() {
    // Wait for YouTube player controls to be ready
    const rightControls = document.querySelector('.ytp-right-controls');

    if (!rightControls) {
      return false;
    }

    // Check if speedometer already exists
    if (document.querySelector('.speedometer-button')) {
      return true;
    }

    // Create and insert speedometer button
    speedometerButton = createSpeedometerButton();

    // Insert before settings button or at the beginning of right controls
    const settingsButton = rightControls.querySelector('.ytp-settings-button');
    if (settingsButton && settingsButton.parentNode === rightControls) {
      rightControls.insertBefore(speedometerButton, settingsButton);
    } else if (rightControls.firstChild) {
      rightControls.insertBefore(speedometerButton, rightControls.firstChild);
    } else {
      rightControls.appendChild(speedometerButton);
    }

    updateSpeedometerDisplay();
    console.log('YouTube SpeedUp: Speedometer inserted');
    return true;
  }

  // Initialize extension
  function init() {
    loadSpeed();

    // Try to insert speedometer
    const tryInsert = () => {
      if (insertSpeedometer()) {
        // Speedometer successfully inserted
      } else {
        setTimeout(tryInsert, 500);
      }
    };

    tryInsert();
  }

  // Watch for YouTube navigation (SPA)
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;

      // Check if we're on a video page
      if (location.pathname === '/watch') {
        setTimeout(() => {
          speedometerButton = null;
          init();
        }, 1000);
      }
    }

    // Also check if video element changed
    const video = document.querySelector('video');
    if (video && video.playbackRate !== currentSpeed) {
      applySpeed();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Listen for video element load
  document.addEventListener('loadstart', (e) => {
    if (e.target.tagName === 'VIDEO') {
      setTimeout(() => applySpeed(), 100);
    }
  }, true);

  // Initial load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (keepAliveTimer) {
      clearTimeout(keepAliveTimer);
    }
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
    }
  });
})();
