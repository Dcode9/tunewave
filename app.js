/**
 * TuneWave - iTunes Music Searcher & Streamer
 * Fully client-side engine leveraging the Apple iTunes Search & Lookup API
 */

(function () {
  'use strict';

  // --- State Management ---
  const state = {
    query: '',
    media: 'music',
    entity: 'song',
    country: 'US',
    limit: 50,
    allowExplicit: true,
    
    results: [],
    queue: [],
    currentTrackIndex: -1,
    isPlaying: false,
    isMuted: false,
    volume: 0.8,
    repeatMode: 'all', // 'none' | 'all' | 'one'
    isShuffled: false,
    favorites: new Set(JSON.parse(localStorage.getItem('tunewave_favs') || '[]')),
    
    audioContext: null,
    analyser: null,
    audioSource: null,
    visualizerActive: false
  };

  // --- DOM Elements ---
  const searchInput = document.getElementById('search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  const searchSpinner = document.getElementById('search-spinner');
  const countrySelect = document.getElementById('country-select');
  const limitSelect = document.getElementById('limit-select');
  const explicitToggle = document.getElementById('explicit-toggle');
  const queueToggleBtn = document.getElementById('queue-toggle-btn');
  const queueCountBadge = document.getElementById('queue-count');
  
  const entityTabs = document.getElementById('entity-tabs');
  const quickTags = document.getElementById('quick-tags');
  
  const tracksGrid = document.getElementById('tracks-grid');
  const emptyState = document.getElementById('empty-state');
  const loadingState = document.getElementById('loading-state');
  const statusText = document.getElementById('status-text');
  const statusMeta = document.getElementById('status-meta');
  
  const queueDrawer = document.getElementById('queue-drawer');
  const queueList = document.getElementById('queue-list');
  const drawerQueueCount = document.getElementById('drawer-queue-count');
  const clearQueueBtn = document.getElementById('clear-queue-btn');
  const closeDrawerBtn = document.getElementById('close-drawer-btn');
  
  const audioElement = document.getElementById('audio-engine');
  const playerThumb = document.getElementById('player-thumb');
  const playerThumbWrapper = document.getElementById('player-thumb-wrapper');
  const playerTitle = document.getElementById('player-title');
  const playerArtist = document.getElementById('player-artist');
  const playerExplicitTag = document.getElementById('player-explicit-tag');
  const playerHeartBtn = document.getElementById('player-heart-btn');
  const playerStoreLink = document.getElementById('player-store-link');
  
  const ctrlPlay = document.getElementById('ctrl-play');
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  const ctrlPrev = document.getElementById('ctrl-prev');
  const ctrlNext = document.getElementById('ctrl-next');
  const ctrlRepeat = document.getElementById('ctrl-repeat');
  const repeatOneIndicator = document.getElementById('repeat-one-indicator');
  const ctrlShuffle = document.getElementById('ctrl-shuffle');
  
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const progressThumb = document.getElementById('progress-thumb');
  const timeCurrent = document.getElementById('time-current');
  const timeTotal = document.getElementById('time-total');
  
  const volBtn = document.getElementById('vol-btn');
  const iconVolHigh = document.getElementById('icon-vol-high');
  const iconVolMuted = document.getElementById('icon-vol-muted');
  const volumeSlider = document.getElementById('volume-slider');
  const visualizerCanvas = document.getElementById('visualizer-canvas');
  const ambientAura = document.getElementById('ambient-aura');

  // Modals
  const infoModal = document.getElementById('info-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalArtImg = document.getElementById('modal-art-img');
  const modalHdLink = document.getElementById('modal-hd-link');
  const modalGenre = document.getElementById('modal-genre');
  const modalTrackTitle = document.getElementById('modal-track-title');
  const modalArtistName = document.getElementById('modal-artist-name');
  const modalAlbumName = document.getElementById('modal-album-name');
  const modalRelease = document.getElementById('modal-release');
  const modalDuration = document.getElementById('modal-duration');
  const modalPrice = document.getElementById('modal-price');
  const modalId = document.getElementById('modal-id');
  const modalDesc = document.getElementById('modal-desc');
  const modalPlayBtn = document.getElementById('modal-play-btn');
  const modalAppleLink = document.getElementById('modal-apple-link');

  const videoModal = document.getElementById('video-modal');
  const videoModalCloseBtn = document.getElementById('video-modal-close-btn');
  const videoModalTitle = document.getElementById('video-modal-title');
  const previewVideo = document.getElementById('preview-video');

  // Debounce utility
  let searchTimer = null;

  // --- Helper Functions ---
  function getHighResArtwork(url, size = 600) {
    if (!url) return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 24 24"%3E%3Crect width="24" height="24" fill="%231a202c"/%3E%3C/svg%3E';
    return url.replace(/\/\d+x\d+bb\./, `/${size}x${size}bb.`);
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  function formatMilliseconds(ms) {
    if (!ms) return '--:--';
    return formatTime(ms / 1000);
  }

  function formatYear(dateStr) {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).getFullYear() || 'N/A';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // --- API Search Implementation ---
  async function performSearch(query = state.query) {
    state.query = query.trim();
    if (!state.query) {
      tracksGrid.innerHTML = '';
      emptyState.classList.remove('hidden');
      loadingState.classList.add('hidden');
      statusText.textContent = 'Ready to stream. Search an artist, song, or album above.';
      statusMeta.textContent = '';
      return;
    }

    emptyState.classList.add('hidden');
    loadingState.classList.remove('hidden');
    searchSpinner.classList.add('active');
    searchClearBtn.classList.remove('hidden');

    const params = new URLSearchParams({
      term: state.query,
      media: state.media,
      entity: state.entity,
      country: state.country,
      limit: state.limit.toString(),
      explicit: state.allowExplicit ? 'Yes' : 'No'
    });

    const endpoint = `https://itunes.apple.com/search?${params.toString()}`;
    const startTime = performance.now();

    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`iTunes API HTTP ${response.status}`);
      }
      const data = await response.json();
      const elapsed = Math.round(performance.now() - startTime);

      state.results = data.results || [];
      renderResults(state.results);

      statusText.textContent = `Found ${state.results.length} results for "${state.query}"`;
      statusMeta.textContent = `${elapsed}ms • Store: ${state.country} • Entity: ${state.entity}`;
    } catch (err) {
      console.error('iTunes API Fetch Error:', err);
      statusText.textContent = `Error querying iTunes API: ${err.message}`;
      statusMeta.textContent = 'Please check network connection or retry';
      tracksGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-illustration">⚠️</div>
          <h2>Search Failed</h2>
          <p>${escapeHtml(err.message)}</p>
        </div>
      `;
    } finally {
      loadingState.classList.add('hidden');
      searchSpinner.classList.remove('active');
    }
  }

  // --- Render Results ---
  function renderResults(tracks) {
    if (!tracks || tracks.length === 0) {
      tracksGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-illustration">🔍</div>
          <h2>No matching items found</h2>
          <p>Try searching for a different track title, artist name, or adjust storefront filter.</p>
        </div>
      `;
      return;
    }

    const currentTrack = state.queue[state.currentTrackIndex];

    tracksGrid.innerHTML = tracks.map((item, idx) => {
      const isSong = item.kind === 'song';
      const isVideo = item.kind === 'music-video' || item.kind === 'feature-movie';
      const isPodcast = item.kind === 'podcast' || item.wrapperType === 'podcastEpisode';
      const isAudiobook = item.wrapperType === 'audiobook';

      const title = item.trackName || item.collectionName || item.artistName || 'Untitled';
      const artist = item.artistName || 'Unknown Artist';
      const album = item.collectionName || (isPodcast ? 'Podcast' : '');
      const artwork = getHighResArtwork(item.artworkUrl100 || item.artworkUrl60 || item.artworkUrl600, 400);
      const isExplicit = item.trackExplicitness === 'explicit' || item.collectionExplicitness === 'explicit';
      const hasPreview = Boolean(item.previewUrl || item.episodeUrl);
      const isCurrentPlaying = currentTrack && (currentTrack.trackId === item.trackId || (item.trackId && currentTrack.trackId === item.trackId));

      return `
        <div class="track-card ${isCurrentPlaying && state.isPlaying ? 'is-playing' : ''}" data-index="${idx}">
          <div class="art-container">
            <img class="card-art" src="${artwork}" alt="${escapeHtml(title)}" loading="lazy">
            
            <div class="art-overlay">
              ${hasPreview ? `
                <button class="overlay-play-btn" data-action="play" data-index="${idx}" title="${isVideo ? 'Play Video' : 'Stream Preview'}">
                  ${isVideo ? '🎬' : '▶'}
                </button>
              ` : `
                <a href="${item.trackViewUrl || item.collectionViewUrl || '#'}" target="_blank" class="overlay-play-btn" title="Open Store">
                  ↗
                </a>
              `}
              <button class="overlay-info-btn" data-action="info" data-index="${idx}" title="Inspect Details">
                ℹ
              </button>
            </div>

            ${isCurrentPlaying && state.isPlaying ? `
              <div class="card-equalizer">
                <span class="eq-bar"></span>
                <span class="eq-bar"></span>
                <span class="eq-bar"></span>
                <span class="eq-bar"></span>
              </div>
            ` : ''}
          </div>

          <div class="card-details">
            <div class="card-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
            <div class="card-artist" title="${escapeHtml(artist)}">${escapeHtml(artist)}</div>
            ${album ? `<div class="card-album" title="${escapeHtml(album)}">${escapeHtml(album)}</div>` : ''}
          </div>

          <div class="card-footer">
            <div class="card-badge-row">
              <span class="genre-tag">${escapeHtml(item.primaryGenreName || 'Music')}</span>
              ${isExplicit ? '<span class="card-explicit">E</span>' : ''}
            </div>
            ${hasPreview ? `
              <button class="add-queue-btn" data-action="queue" data-index="${idx}" title="Add to playback queue">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // --- Playback Engine ---
  function playTrack(track, fromQueue = false) {
    if (!track) return;
    const streamUrl = track.previewUrl || track.episodeUrl;

    // Handle music video previews (MP4/M4V)
    if (track.kind === 'music-video' || track.kind === 'feature-movie') {
      openVideoModal(track);
      return;
    }

    if (!streamUrl) {
      alert(`No audio stream available for "${track.trackName || track.collectionName}". Opening Apple Music page.`);
      if (track.trackViewUrl || track.collectionViewUrl) {
        window.open(track.trackViewUrl || track.collectionViewUrl, '_blank');
      }
      return;
    }

    // If played directly from results and not queue, build queue starting here
    if (!fromQueue) {
      state.queue = [...state.results.filter(t => t.previewUrl || t.episodeUrl)];
      state.currentTrackIndex = state.queue.findIndex(t => (t.trackId && t.trackId === track.trackId) || t.previewUrl === streamUrl);
      if (state.currentTrackIndex === -1) {
        state.queue.unshift(track);
        state.currentTrackIndex = 0;
      }
    }

    updateQueueUI();

    audioElement.src = streamUrl;
    audioElement.volume = state.volume;
    
    // Play with promise handling
    const playPromise = audioElement.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        state.isPlaying = true;
        updatePlayerUI(track);
        initAudioVisualizer();
        renderResults(state.results);
      }).catch(err => {
        console.warn('Audio playback was prevented:', err);
      });
    }

    updatePlayerUI(track);
  }

  function updatePlayerUI(track) {
    if (!track) return;

    const title = track.trackName || track.collectionName || 'Unknown Title';
    const artist = track.artistName || 'Unknown Artist';
    const artwork = getHighResArtwork(track.artworkUrl100 || track.artworkUrl60 || track.artworkUrl600, 300);
    const isExplicit = track.trackExplicitness === 'explicit' || track.collectionExplicitness === 'explicit';

    playerTitle.textContent = title;
    playerArtist.textContent = artist;
    playerThumb.src = artwork;

    if (isExplicit) {
      playerExplicitTag.classList.remove('hidden');
    } else {
      playerExplicitTag.classList.add('hidden');
    }

    const trackIdStr = String(track.trackId || track.collectionId);
    if (state.favorites.has(trackIdStr)) {
      playerHeartBtn.classList.add('active');
      playerHeartBtn.textContent = '♥';
    } else {
      playerHeartBtn.classList.remove('active');
      playerHeartBtn.textContent = '♡';
    }

    playerStoreLink.href = track.trackViewUrl || track.collectionViewUrl || track.artistViewUrl || '#';

    // Update ambient aura color dynamically based on title hash for dynamic vibe
    const hue = Math.abs(hashString(title + artist)) % 360;
    ambientAura.style.background = `radial-gradient(circle, hsla(${hue}, 80%, 60%, 0.22) 0%, hsla(${(hue + 60) % 360}, 75%, 55%, 0.12) 40%, transparent 75%)`;

    // Toggle Play/Pause Icons
    if (state.isPlaying) {
      iconPlay.classList.add('hidden');
      iconPause.classList.remove('hidden');
    } else {
      iconPlay.classList.remove('hidden');
      iconPause.classList.add('hidden');
    }
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  function togglePlayPause() {
    if (!audioElement.src) {
      // Pick first track from results if available
      const playable = state.results.find(t => t.previewUrl || t.episodeUrl);
      if (playable) {
        playTrack(playable);
      }
      return;
    }

    if (audioElement.paused) {
      audioElement.play().then(() => {
        state.isPlaying = true;
        updatePlayerUI(state.queue[state.currentTrackIndex]);
        renderResults(state.results);
      }).catch(console.error);
    } else {
      audioElement.pause();
      state.isPlaying = false;
      updatePlayerUI(state.queue[state.currentTrackIndex]);
      renderResults(state.results);
    }
  }

  function playNextTrack() {
    if (state.queue.length === 0) return;

    if (state.isShuffled) {
      state.currentTrackIndex = Math.floor(Math.random() * state.queue.length);
    } else {
      if (state.currentTrackIndex < state.queue.length - 1) {
        state.currentTrackIndex++;
      } else {
        if (state.repeatMode === 'all') {
          state.currentTrackIndex = 0;
        } else {
          // End of queue
          state.isPlaying = false;
          updatePlayerUI(state.queue[state.currentTrackIndex]);
          renderResults(state.results);
          return;
        }
      }
    }

    playTrack(state.queue[state.currentTrackIndex], true);
  }

  function playPrevTrack() {
    if (state.queue.length === 0) return;

    // If > 3 seconds in, restart track
    if (audioElement.currentTime > 3) {
      audioElement.currentTime = 0;
      return;
    }

    if (state.currentTrackIndex > 0) {
      state.currentTrackIndex--;
    } else {
      state.currentTrackIndex = state.queue.length - 1;
    }

    playTrack(state.queue[state.currentTrackIndex], true);
  }

  // --- Queue Management ---
  function addToQueue(track) {
    if (!track.previewUrl && !track.episodeUrl) return;
    state.queue.push(track);
    updateQueueUI();
  }

  function removeFromQueue(index, e) {
    if (e) e.stopPropagation();
    state.queue.splice(index, 1);
    if (index === state.currentTrackIndex) {
      if (state.queue.length > 0) {
        playTrack(state.queue[Math.min(index, state.queue.length - 1)], true);
      } else {
        audioElement.pause();
        audioElement.src = '';
        state.isPlaying = false;
        state.currentTrackIndex = -1;
      }
    } else if (index < state.currentTrackIndex) {
      state.currentTrackIndex--;
    }
    updateQueueUI();
    renderResults(state.results);
  }

  function updateQueueUI() {
    queueCountBadge.textContent = state.queue.length;
    drawerQueueCount.textContent = `(${state.queue.length} tracks)`;

    queueList.innerHTML = state.queue.map((track, i) => {
      const title = track.trackName || track.collectionName || 'Untitled';
      const artist = track.artistName || 'Unknown';
      const artwork = getHighResArtwork(track.artworkUrl100 || track.artworkUrl60, 100);
      const isActive = i === state.currentTrackIndex;

      return `
        <div class="queue-item ${isActive ? 'active' : ''}" data-queue-idx="${i}">
          <img class="queue-item-thumb" src="${artwork}" alt="${escapeHtml(title)}">
          <div class="queue-item-info">
            <div class="queue-item-title">${escapeHtml(title)}</div>
            <div class="queue-item-artist">${escapeHtml(artist)}</div>
          </div>
          <button class="queue-item-remove" data-action="remove-queue" data-queue-idx="${i}" title="Remove track">×</button>
        </div>
      `;
    }).join('');
  }

  // --- Web Audio Spectrum Visualizer ---
  function initAudioVisualizer() {
    if (state.visualizerActive) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      if (!state.audioContext) {
        state.audioContext = new AudioContext();
      }

      if (state.audioContext.state === 'suspended') {
        state.audioContext.resume();
      }

      if (!state.audioSource) {
        state.analyser = state.audioContext.createAnalyser();
        state.analyser.fftSize = 64;
        state.analyser.smoothingTimeConstant = 0.8;

        state.audioSource = state.audioContext.createMediaElementSource(audioElement);
        state.audioSource.connect(state.analyser);
        state.analyser.connect(state.audioContext.destination);
      }

      state.visualizerActive = true;
      drawVisualizer();
    } catch (err) {
      console.warn('Direct Web Audio API CORS routing bypassed, falling back to dynamic audio waves:', err);
      // Run visualizer fallback
      state.visualizerActive = true;
      drawVisualizerFallback();
    }
  }

  function drawVisualizer() {
    if (!state.visualizerActive) return;
    requestAnimationFrame(drawVisualizer);

    const canvas = visualizerCanvas;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (!state.isPlaying || !state.analyser) {
      // Idle line
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(0, height / 2 - 1, width, 2);
      return;
    }

    const bufferLength = state.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    state.analyser.getByteFrequencyData(dataArray);

    const barWidth = (width / bufferLength) * 1.8;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * height;
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, '#fa2d48');
      gradient.addColorStop(0.6, '#d946ef');
      gradient.addColorStop(1, '#38bdf8');

      ctx.fillStyle = gradient;
      ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
      x += barWidth;
    }
  }

  function drawVisualizerFallback() {
    const canvas = visualizerCanvas;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    let tick = 0;

    function renderFallback() {
      requestAnimationFrame(renderFallback);
      ctx.clearRect(0, 0, width, height);

      const numBars = 16;
      const barWidth = width / numBars - 2;

      for (let i = 0; i < numBars; i++) {
        let barHeight = 2;
        if (state.isPlaying) {
          barHeight = Math.max(3, Math.sin(tick * 0.1 + i * 0.4) * (height * 0.4) + Math.cos(tick * 0.08 - i * 0.2) * (height * 0.3) + height * 0.3);
        }

        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#fa2d48');
        gradient.addColorStop(1, '#6366f1');

        ctx.fillStyle = gradient;
        ctx.fillRect(i * (barWidth + 2), height - barHeight, barWidth, barHeight);
      }

      if (state.isPlaying) tick++;
    }

    renderFallback();
  }

  // --- Info Modal Details ---
  function openInfoModal(track) {
    if (!track) return;

    const title = track.trackName || track.collectionName || 'Untitled';
    const artist = track.artistName || 'Unknown Artist';
    const album = track.collectionName || 'Single / Collection';
    const rawArtwork = track.artworkUrl100 || track.artworkUrl60 || track.artworkUrl600;
    const highResArtwork = getHighResArtwork(rawArtwork, 1200);

    modalArtImg.src = getHighResArtwork(rawArtwork, 600);
    modalHdLink.href = highResArtwork;
    modalGenre.textContent = track.primaryGenreName || 'Music';
    modalTrackTitle.textContent = title;
    modalArtistName.textContent = artist;
    modalAlbumName.textContent = album;
    modalRelease.textContent = formatYear(track.releaseDate);
    modalDuration.textContent = formatMilliseconds(track.trackTimeMillis);
    modalPrice.textContent = track.trackPrice ? `$${track.trackPrice} ${track.currency || ''}` : (track.collectionPrice ? `$${track.collectionPrice}` : 'Free / Album');
    modalId.textContent = track.trackId || track.collectionId || track.artistId || '--';
    modalDesc.innerHTML = track.description || track.shortDescription || `Preview available via the official iTunes Store API database. Copyright ${track.artistName}.`;
    modalAppleLink.href = track.trackViewUrl || track.collectionViewUrl || track.artistViewUrl || '#';

    modalPlayBtn.onclick = () => {
      playTrack(track);
      infoModal.classList.add('hidden');
    };

    infoModal.classList.remove('hidden');
  }

  // --- Video Modal Details ---
  function openVideoModal(track) {
    if (!track.previewUrl) return;
    videoModalTitle.textContent = `${track.artistName} - ${track.trackName}`;
    previewVideo.src = track.previewUrl;
    previewVideo.play().catch(console.warn);
    videoModal.classList.remove('hidden');
  }

  function closeVideoModal() {
    previewVideo.pause();
    previewVideo.src = '';
    videoModal.classList.add('hidden');
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    // Search input with debouncing
    searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        performSearch(val);
      }, 350);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (searchTimer) clearTimeout(searchTimer);
        performSearch(searchInput.value);
      }
    });

    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchClearBtn.classList.add('hidden');
      performSearch('');
      searchInput.focus();
    });

    // Country selection
    countrySelect.addEventListener('change', (e) => {
      state.country = e.target.value;
      if (state.query) performSearch();
    });

    // Limit selection
    limitSelect.addEventListener('change', (e) => {
      state.limit = parseInt(e.target.value, 10);
      if (state.query) performSearch();
    });

    // Explicit Toggle
    explicitToggle.addEventListener('click', () => {
      state.allowExplicit = !state.allowExplicit;
      explicitToggle.classList.toggle('active', state.allowExplicit);
      explicitToggle.title = state.allowExplicit ? 'Explicit content allowed' : 'Clean content only';
      if (state.query) performSearch();
    });

    // Entity Navigation Tabs
    entityTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.entity-tab');
      if (!tab) return;

      document.querySelectorAll('.entity-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      state.entity = tab.dataset.entity;
      state.media = tab.dataset.media;

      if (state.query) {
        performSearch();
      }
    });

    // Quick trending discovery tags
    quickTags.addEventListener('click', (e) => {
      const chip = e.target.closest('.quick-chip');
      if (!chip) return;
      searchInput.value = chip.dataset.term;
      performSearch(chip.dataset.term);
    });

    // Tracks Grid Interaction (Delegation)
    tracksGrid.addEventListener('click', (e) => {
      const playBtn = e.target.closest('[data-action="play"]');
      const infoBtn = e.target.closest('[data-action="info"]');
      const queueBtn = e.target.closest('[data-action="queue"]');
      const card = e.target.closest('.track-card');

      if (playBtn) {
        const idx = parseInt(playBtn.dataset.index, 10);
        playTrack(state.results[idx]);
        return;
      }

      if (infoBtn) {
        const idx = parseInt(infoBtn.dataset.index, 10);
        openInfoModal(state.results[idx]);
        return;
      }

      if (queueBtn) {
        const idx = parseInt(queueBtn.dataset.index, 10);
        addToQueue(state.results[idx]);
        // Visual feedback
        queueBtn.style.color = '#38bdf8';
        setTimeout(() => queueBtn.style.color = '', 300);
        return;
      }

      if (card) {
        const idx = parseInt(card.dataset.index, 10);
        playTrack(state.results[idx]);
      }
    });

    // Audio Element Event Handlers
    audioElement.addEventListener('timeupdate', () => {
      const current = audioElement.currentTime;
      const duration = audioElement.duration || 30;
      timeCurrent.textContent = formatTime(current);
      timeTotal.textContent = formatTime(duration);

      const percent = (current / duration) * 100;
      progressBar.style.width = `${percent}%`;
      progressThumb.style.left = `${percent}%`;
    });

    audioElement.addEventListener('ended', () => {
      if (state.repeatMode === 'one') {
        audioElement.currentTime = 0;
        audioElement.play();
      } else {
        playNextTrack();
      }
    });

    audioElement.addEventListener('play', () => {
      state.isPlaying = true;
      updatePlayerUI(state.queue[state.currentTrackIndex]);
      renderResults(state.results);
    });

    audioElement.addEventListener('pause', () => {
      state.isPlaying = false;
      updatePlayerUI(state.queue[state.currentTrackIndex]);
      renderResults(state.results);
    });

    // Controls
    ctrlPlay.addEventListener('click', togglePlayPause);
    ctrlNext.addEventListener('click', playNextTrack);
    ctrlPrev.addEventListener('click', playPrevTrack);

    ctrlRepeat.addEventListener('click', () => {
      if (state.repeatMode === 'all') {
        state.repeatMode = 'one';
        ctrlRepeat.classList.add('active');
        repeatOneIndicator.classList.remove('hidden');
      } else if (state.repeatMode === 'one') {
        state.repeatMode = 'none';
        ctrlRepeat.classList.remove('active');
        repeatOneIndicator.classList.add('hidden');
      } else {
        state.repeatMode = 'all';
        ctrlRepeat.classList.add('active');
        repeatOneIndicator.classList.add('hidden');
      }
    });

    ctrlShuffle.addEventListener('click', () => {
      state.isShuffled = !state.isShuffled;
      ctrlShuffle.classList.toggle('active', state.isShuffled);
    });

    // Scrubber click & drag
    progressContainer.addEventListener('click', (e) => {
      const rect = progressContainer.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const percent = Math.max(0, Math.min(1, clickX / width));
      const duration = audioElement.duration || 30;
      audioElement.currentTime = percent * duration;
    });

    // Volume Slider & Mute
    volumeSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state.volume = val;
      audioElement.volume = val;
      state.isMuted = val === 0;
      updateVolumeUI();
    });

    volBtn.addEventListener('click', () => {
      if (state.isMuted) {
        state.isMuted = false;
        audioElement.volume = state.volume > 0 ? state.volume : 0.8;
        volumeSlider.value = audioElement.volume;
      } else {
        state.isMuted = true;
        audioElement.volume = 0;
        volumeSlider.value = 0;
      }
      updateVolumeUI();
    });

    function updateVolumeUI() {
      if (state.isMuted || audioElement.volume === 0) {
        iconVolHigh.classList.add('hidden');
        iconVolMuted.classList.remove('hidden');
      } else {
        iconVolHigh.classList.remove('hidden');
        iconVolMuted.classList.add('hidden');
      }
    }

    // Favorite button
    playerHeartBtn.addEventListener('click', () => {
      const currentTrack = state.queue[state.currentTrackIndex];
      if (!currentTrack) return;
      const id = String(currentTrack.trackId || currentTrack.collectionId);

      if (state.favorites.has(id)) {
        state.favorites.delete(id);
        playerHeartBtn.classList.remove('active');
        playerHeartBtn.textContent = '♡';
      } else {
        state.favorites.add(id);
        playerHeartBtn.classList.add('active');
        playerHeartBtn.textContent = '♥';
      }
      localStorage.setItem('tunewave_favs', JSON.stringify([...state.favorites]));
    });

    // Thumbnail zoom trigger
    playerThumbWrapper.addEventListener('click', () => {
      const currentTrack = state.queue[state.currentTrackIndex];
      if (currentTrack) {
        openInfoModal(currentTrack);
      }
    });

    // Queue Drawer toggling
    queueToggleBtn.addEventListener('click', () => {
      queueDrawer.classList.toggle('hidden');
    });

    closeDrawerBtn.addEventListener('click', () => {
      queueDrawer.classList.add('hidden');
    });

    clearQueueBtn.addEventListener('click', () => {
      state.queue = [];
      state.currentTrackIndex = -1;
      audioElement.pause();
      audioElement.src = '';
      state.isPlaying = false;
      updateQueueUI();
      renderResults(state.results);
    });

    queueList.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('[data-action="remove-queue"]');
      const item = e.target.closest('.queue-item');

      if (removeBtn) {
        const idx = parseInt(removeBtn.dataset.queueIdx, 10);
        removeFromQueue(idx, e);
        return;
      }

      if (item) {
        const idx = parseInt(item.dataset.queueIdx, 10);
        state.currentTrackIndex = idx;
        playTrack(state.queue[idx], true);
      }
    });

    // Modals Close handlers
    modalCloseBtn.addEventListener('click', () => {
      infoModal.classList.add('hidden');
    });

    infoModal.addEventListener('click', (e) => {
      if (e.target === infoModal) {
        infoModal.classList.add('hidden');
      }
    });

    videoModalCloseBtn.addEventListener('click', closeVideoModal);
    videoModal.addEventListener('click', (e) => {
      if (e.target === videoModal) {
        closeVideoModal();
      }
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Don't trigger if user is typing in the search bar
      if (document.activeElement === searchInput) {
        if (e.key === 'Escape') {
          searchInput.blur();
        }
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowRight':
          audioElement.currentTime = Math.min(audioElement.duration || 30, audioElement.currentTime + 5);
          break;
        case 'ArrowLeft':
          audioElement.currentTime = Math.max(0, audioElement.currentTime - 5);
          break;
        case 'KeyN':
          playNextTrack();
          break;
        case 'KeyP':
          playPrevTrack();
          break;
        case 'KeyM':
          volBtn.click();
          break;
        case 'KeyS':
          ctrlShuffle.click();
          break;
        case 'KeyR':
          ctrlRepeat.click();
          break;
        case 'Slash':
          e.preventDefault();
          searchInput.focus();
          break;
        case 'Escape':
          infoModal.classList.add('hidden');
          closeVideoModal();
          queueDrawer.classList.add('hidden');
          break;
      }
    });
  }

  // --- Initial Boot ---
  function init() {
    setupEventListeners();
    // Default search for a premier hit to showcase the interface immediately
    performSearch('Daft Punk');
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
