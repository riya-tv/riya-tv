/**
 * Riya TV Live Broadcast - Mobile Application Client
 * Replicates /var/www/nanbateam/app/riya native Android experience
 * Dynamically populated via API with 10 req/min rate limit protection
 */

(function () {
  'use strict';

  // --- Default Fallback State (used while API loads or if rate limited) ---
  const DEFAULT_CONFIG = {
    stationName: 'Riya TV',
    stationCode: 'riyatv',
    logo: 'https://public.nanbateam.com/banners/banner_3_1792744814_6a41014d.png',
    mobile: '+91 97877 90707',
    website: 'https://riya.tv.nanbateam.com',
    poweredByUrl: 'https://www.nanbateam.com',
    liveStreamUrl: 'https://riya.live.tv.nanbateam.com/live/stream/index.m3u8',
    disclaimer: 'Official Riya TV 24x7 Live Streaming by NanbaTeam',
    banners: [
      { id: 8, poster: 'https://public.nanbateam.com/posters/1.jpg', fallback: 'assets/images/posters/1.jpg', link: '#' },
      { id: 9, poster: 'https://public.nanbateam.com/posters/2.jpg', fallback: 'assets/images/posters/2.jpg', link: '#' },
      { id: 10, poster: 'https://public.nanbateam.com/posters/3.jpg', fallback: 'assets/images/posters/3.jpg', link: '#' },
      { id: 11, poster: 'https://public.nanbateam.com/posters/4.jpg', fallback: 'assets/images/posters/4.jpg', link: '#' }
    ],
    social: {
      whatsapp: 'https://wa.me/919787790707',
      youtube: 'https://youtube.com/@candyriyaz',
      instagram: 'https://www.instagram.com/candyriyaz',
      facebook: 'https://www.facebook.com/profile.php?id=100069303665112',
      twitter: 'https://x.com/candyriyaz',
      website: 'https://riya.tv.nanbateam.com'
    }
  };

  let currentConfig = Object.assign({}, DEFAULT_CONFIG);
  let hlsInstance = null;
  let retryTimer = null;
  let carouselInterval = null;
  let currentSlideIndex = 0;
  let isCarouselPaused = false;
  let touchStartX = 0;
  let touchEndX = 0;

  // --- DOM Elements Cache ---
  const DOM = {
    video: document.getElementById('playerVideo'),
    playerCard: document.getElementById('playerCard'),
    headerLogo: document.getElementById('headerLogo'),
    unmuteOverlay: document.getElementById('unmuteOverlay'),
    unmuteBtn: document.getElementById('unmuteBtn'),
    statusOverlay: document.getElementById('statusOverlay'),
    statusMessage: document.getElementById('statusMessage'),
    playerBadge: document.getElementById('playerBadge'),
    playerBadgeText: document.getElementById('playerBadgeText'),
    playToggleBtn: document.getElementById('playToggleBtn'),
    muteToggleBtn: document.getElementById('muteToggleBtn'),
    reloadBtn: document.getElementById('reloadBtn'),
    fullscreenBtn: document.getElementById('fullscreenBtn'),
    carouselTrack: document.getElementById('carouselTrack'),
    carouselIndicators: document.getElementById('carouselIndicators'),
    carouselPrev: document.getElementById('carouselPrev'),
    carouselNext: document.getElementById('carouselNext'),
    carouselViewport: document.getElementById('carouselViewport'),
    adCapsuleBtn: document.getElementById('adCapsuleBtn'),
    adNumberTxt: document.getElementById('adNumberTxt'),
    poweredByBrand: document.getElementById('poweredByBrand'),
    disclaimerTxt: document.getElementById('disclaimerTxt'),
    adLightboxModal: document.getElementById('adLightboxModal'),
    adLightboxBackdrop: document.getElementById('adLightboxBackdrop'),
    adLightboxImage: document.getElementById('adLightboxImage'),
    adLightboxClose: document.getElementById('adLightboxClose')
  };

  let isSwiping = false;

  // --- 1. Dynamic API Loader (Fetches Stream, Social Links, Phone, Banners) ---
  function fetchStationData() {
    // If running on riya.tv.nanbateam.com, try local proxy first. On external domains (e.g. www.riyatv.in, GitHub Pages), query API gateway directly.
    const isLocalProxy = window.location.hostname === 'riya.tv.nanbateam.com';
    const apiEndpoints = isLocalProxy
      ? ['/tv/riyatv', 'https://api.nanbateam.com/tv/riyatv']
      : ['https://api.nanbateam.com/tv/riyatv', '/tv/riyatv'];

    function tryFetch(index) {
      if (index >= apiEndpoints.length) {
        console.log('[API] Using local cached station state.');
        applyStationData(DEFAULT_CONFIG);
        return;
      }

      fetch(apiEndpoints[index], { cache: 'no-cache' })
        .then(res => {
          if (res.status === 429) {
            console.warn('[Security] API rate limit reached (10 req/min). Maintaining active playback.');
            applyStationData(currentConfig);
            return null;
          }
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(result => {
          if (result && result.data) {
            updateConfigFromApi(result.data);
          } else if (result !== null) {
            tryFetch(index + 1);
          }
        })
        .catch(() => {
          tryFetch(index + 1);
        });
    }

    tryFetch(0);
  }

  function updateConfigFromApi(data) {
    if (data.name) currentConfig.stationName = data.name;
    if (data.mobile) currentConfig.mobile = data.mobile;
    if (data.website) currentConfig.website = data.website;
    if (data.disclaimer) currentConfig.disclaimer = data.disclaimer;

    // Live Stream Link from API
    if (data.live) {
      const prevLive = currentConfig.liveStreamUrl;
      currentConfig.liveStreamUrl = data.live;
      // If stream link changed, reconnect player
      if (prevLive !== data.live) {
        initVideoPlayer(data.live);
      }
    }

    // Social Media Links from API
    if (Array.isArray(data.tv_social_medias)) {
      data.tv_social_medias.forEach(item => {
        const code = (item.code || '').trim().toLowerCase();
        if (code && item.link) {
          if (code === 'whatsapp') {
            if (item.link === 'https://wa.me/' || item.link === 'https://wa.me') {
              const cleanMobile = (data.mobile || currentConfig.mobile).replace(/[^0-9]/g, '');
              currentConfig.social.whatsapp = `https://wa.me/${cleanMobile}`;
            } else {
              currentConfig.social.whatsapp = item.link;
            }
          } else if (currentConfig.social[code] !== undefined) {
            currentConfig.social[code] = item.link;
          }
        }
      });
    }

    // Dynamic Advertising Banners from API
    const rawAds = data.tv_ads || data.tvAds || [];
    if (Array.isArray(rawAds) && rawAds.length > 0) {
      const activeAds = rawAds.filter(ad => ad.status !== 0);
      if (activeAds.length > 0) {
        currentConfig.banners = activeAds.map(ad => {
          let posterUrl = ad.poster || '';
          let fallbackUrl = 'assets/images/posters/1.jpg';
          if (posterUrl.startsWith('http://') || posterUrl.startsWith('https://')) {
            const urlParts = posterUrl.split('/');
            const filename = urlParts[urlParts.length - 1];
            fallbackUrl = `assets/images/posters/${filename}`;
          } else {
            const cleanPath = posterUrl.replace(/^\/+/, '');
            fallbackUrl = `assets/images/${cleanPath}`;
            posterUrl = `https://public.nanbateam.com/${cleanPath}`;
          }
          return {
            id: ad.id,
            poster: posterUrl,
            fallback: fallbackUrl,
            link: '#'
          };
        });
      }
    }

    applyStationData(currentConfig);
  }

  function applyStationData(cfg) {
    // Header Logo
    if (DOM.headerLogo) {
      DOM.headerLogo.src = cfg.logo;
    }

    // Contact Number in Advertisement Pill
    if (DOM.adNumberTxt && cfg.mobile) {
      DOM.adNumberTxt.textContent = `Contact : ${cfg.mobile}`;
    }
    if (DOM.adCapsuleBtn && cfg.mobile) {
      const cleanPhone = cfg.mobile.replace(/[^0-9+]/g, '');
      DOM.adCapsuleBtn.href = `tel:${cleanPhone}`;
    }

    // Disclaimer
    if (DOM.disclaimerTxt && cfg.disclaimer) {
      DOM.disclaimerTxt.textContent = cfg.disclaimer;
    }

    // Powered by link (always redirects to www.nanbateam.com)
    if (DOM.poweredByBrand) {
      DOM.poweredByBrand.href = cfg.poweredByUrl || 'https://www.nanbateam.com';
    }

    // Social Links
    for (const [platform, link] of Object.entries(cfg.social)) {
      const el = document.getElementById(`social_${platform}`);
      if (el && link) {
        el.href = link;
      }
    }

    // Render Banners in Carousel
    renderBanners(cfg.banners);
  }

  // --- 2. Banner Carousel Slider (The_slide_timer emulation) ---
  function renderBanners(banners) {
    if (!DOM.carouselTrack || !banners || banners.length === 0) return;

    DOM.carouselTrack.innerHTML = '';
    if (DOM.carouselIndicators) DOM.carouselIndicators.innerHTML = '';

    banners.forEach((banner, idx) => {
      const slide = document.createElement('div');
      slide.className = `banner-slide ${idx === 0 ? 'active' : ''}`;
      slide.dataset.index = idx;

      const fallbackSrc = banner.fallback || 'assets/images/posters/1.jpg';
      slide.innerHTML = `
        <img src="${banner.poster}" alt="" class="slide-backdrop" aria-hidden="true" onerror="this.onerror=null; this.src='${fallbackSrc}';">
        <img src="${banner.poster}" alt="Sponsored Banner ${idx + 1}" class="slide-image" onerror="this.onerror=null; this.src='${fallbackSrc}';">
      `;

      DOM.carouselTrack.appendChild(slide);

      if (DOM.carouselIndicators) {
        const dot = document.createElement('span');
        dot.className = `indicator-dot ${idx === 0 ? 'active' : ''}`;
        dot.dataset.index = idx;
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          goToSlide(idx);
        });
        DOM.carouselIndicators.appendChild(dot);
      }
    });

    const hasMultiple = banners.length > 1;
    if (DOM.carouselPrev) DOM.carouselPrev.style.display = hasMultiple ? 'flex' : 'none';
    if (DOM.carouselNext) DOM.carouselNext.style.display = hasMultiple ? 'flex' : 'none';
    if (DOM.carouselIndicators) DOM.carouselIndicators.style.display = hasMultiple ? 'flex' : 'none';

    currentSlideIndex = 0;
    startCarouselAutoPlay();
  }

  function goToSlide(index) {
    const slides = DOM.carouselTrack.querySelectorAll('.banner-slide');
    const dots = DOM.carouselIndicators ? DOM.carouselIndicators.querySelectorAll('.indicator-dot') : [];
    if (slides.length <= 1) return;

    currentSlideIndex = (index + slides.length) % slides.length;

    slides.forEach((slide, idx) => {
      slide.classList.toggle('active', idx === currentSlideIndex);
    });

    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === currentSlideIndex);
    });
  }

  function nextSlide() {
    goToSlide(currentSlideIndex + 1);
  }

  function prevSlide() {
    goToSlide(currentSlideIndex - 1);
  }

  function startCarouselAutoPlay() {
    stopCarouselAutoPlay();
    if (!currentConfig.banners || currentConfig.banners.length <= 1) return;
    carouselInterval = setInterval(() => {
      if (!isCarouselPaused) {
        nextSlide();
      }
    }, 3000); // 3000ms timer matching Android app
  }

  function stopCarouselAutoPlay() {
    if (carouselInterval) {
      clearInterval(carouselInterval);
      carouselInterval = null;
    }
  }

  function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
    isCarouselPaused = true;
    isSwiping = false;
  }

  function handleTouchEnd(e) {
    touchEndX = e.changedTouches[0].screenX;
    isCarouselPaused = false;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 30) {
      isSwiping = true;
      if (diff > 0) nextSlide();
      else prevSlide();
    } else {
      isSwiping = false;
    }
  }

  // --- 2b. Fullsize Advertisement Lightbox ---
  function openAdLightbox(imageSrc) {
    if (!DOM.adLightboxModal || !DOM.adLightboxImage || !imageSrc) return;
    DOM.adLightboxImage.src = imageSrc;
    DOM.adLightboxModal.classList.add('active');
    isCarouselPaused = true;
    document.body.style.overflow = 'hidden';
  }

  function closeAdLightbox() {
    if (!DOM.adLightboxModal) return;
    DOM.adLightboxModal.classList.remove('active');
    isCarouselPaused = false;
    document.body.style.overflow = '';
  }

  // --- 3. Live Stream Video Engine ---
  function initVideoPlayer(streamUrl) {
    const video = DOM.video;
    if (!video) return;

    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }

    setPlayerStatus('connecting', 'Connecting to Live Feed...');
    const resolvedUrl = streamUrl || currentConfig.liveStreamUrl;

    if (window.Hls && window.Hls.isSupported()) {
      if (hlsInstance) {
        hlsInstance.destroy();
      }

      hlsInstance = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 20,
        maxBufferLength: 8,
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 10,
        manifestLoadingRetryDelay: 1000
      });

      hlsInstance.loadSource(resolvedUrl);
      hlsInstance.attachMedia(video);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        setPlayerStatus('live', '1080p • LIVE');
        attemptAutoplay();
      });

      hlsInstance.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setPlayerStatus('offline', 'Network reconnecting...');
              hlsInstance.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setPlayerStatus('offline', 'Media resyncing...');
              hlsInstance.recoverMediaError();
              break;
            default:
              setPlayerStatus('offline', 'Waiting for Broadcast Feed...');
              hlsInstance.destroy();
              retryTimer = setTimeout(() => initVideoPlayer(resolvedUrl), 3500);
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Apple HLS (iOS Safari)
      video.src = resolvedUrl;
      video.addEventListener('loadedmetadata', () => {
        setPlayerStatus('live', '1080p • LIVE');
        attemptAutoplay();
      }, { once: true });

      video.addEventListener('error', () => {
        setPlayerStatus('offline', 'Reconnecting to stream...');
        retryTimer = setTimeout(() => initVideoPlayer(resolvedUrl), 4000);
      }, { once: true });
    }
  }

  function attemptAutoplay() {
    const video = DOM.video;
    if (!video) return;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          DOM.unmuteOverlay.classList.remove('active');
          updatePlayPauseIcon(true);
        })
        .catch(() => {
          video.muted = true;
          video.play()
            .then(() => {
              DOM.unmuteOverlay.classList.add('active');
              updatePlayPauseIcon(true);
              updateMuteIcon(true);
            })
            .catch(() => {});
        });
    }
  }

  function setPlayerStatus(state, message) {
    if (!DOM.playerBadge) return;

    DOM.playerBadge.className = `player-badge ${state}`;
    if (DOM.playerBadgeText) {
      DOM.playerBadgeText.textContent = state === 'live' ? '1080p • LIVE' : (state === 'connecting' ? 'Connecting...' : 'Broadcast Offline');
    }

    if (state === 'offline' || state === 'connecting') {
      DOM.statusOverlay.classList.add('active');
      DOM.statusMessage.textContent = message;
    } else {
      DOM.statusOverlay.classList.remove('active');
    }
  }

  function togglePlay() {
    const video = DOM.video;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => updatePlayPauseIcon(true)).catch(() => {});
    } else {
      video.pause();
      updatePlayPauseIcon(false);
    }
  }

  function toggleMute() {
    const video = DOM.video;
    if (!video) return;

    video.muted = !video.muted;
    updateMuteIcon(video.muted);
    if (!video.muted) {
      DOM.unmuteOverlay.classList.remove('active');
    }
  }

  function updatePlayPauseIcon(isPlaying) {
    if (!DOM.playToggleBtn) return;
    DOM.playToggleBtn.innerHTML = isPlaying
      ? `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
  }

  function updateMuteIcon(isMuted) {
    if (!DOM.muteToggleBtn) return;
    DOM.muteToggleBtn.innerHTML = isMuted
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
  }

  function toggleFullscreen() {
    const card = DOM.playerCard || DOM.video;
    if (!card) return;

    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (card.requestFullscreen) card.requestFullscreen();
      else if (card.webkitRequestFullscreen) card.webkitRequestFullscreen();
      else if (DOM.video.webkitEnterFullscreen) DOM.video.webkitEnterFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  }

  // --- 4. Event Listeners ---
  function initEvents() {
    if (DOM.unmuteBtn) {
      DOM.unmuteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (DOM.video) {
          DOM.video.muted = false;
          updateMuteIcon(false);
          DOM.unmuteOverlay.classList.remove('active');
        }
      });
    }

    if (DOM.unmuteOverlay) {
      DOM.unmuteOverlay.addEventListener('click', () => {
        if (DOM.video) {
          DOM.video.muted = false;
          updateMuteIcon(false);
          DOM.unmuteOverlay.classList.remove('active');
        }
      });
    }

    if (DOM.playToggleBtn) DOM.playToggleBtn.addEventListener('click', togglePlay);
    if (DOM.muteToggleBtn) DOM.muteToggleBtn.addEventListener('click', toggleMute);
    if (DOM.reloadBtn) DOM.reloadBtn.addEventListener('click', () => initVideoPlayer());
    if (DOM.fullscreenBtn) DOM.fullscreenBtn.addEventListener('click', toggleFullscreen);

    if (DOM.carouselPrev) DOM.carouselPrev.addEventListener('click', (e) => { e.stopPropagation(); prevSlide(); });
    if (DOM.carouselNext) DOM.carouselNext.addEventListener('click', (e) => { e.stopPropagation(); nextSlide(); });

    if (DOM.carouselViewport) {
      DOM.carouselViewport.addEventListener('mouseenter', () => { isCarouselPaused = true; });
      DOM.carouselViewport.addEventListener('mouseleave', () => { isCarouselPaused = false; });
      DOM.carouselViewport.addEventListener('touchstart', handleTouchStart, { passive: true });
      DOM.carouselViewport.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    // Click banner to open full size lightbox
    if (DOM.carouselTrack) {
      DOM.carouselTrack.addEventListener('click', (e) => {
        if (isSwiping) {
          isSwiping = false;
          return;
        }
        if (e.target.closest('.slide-arrow') || e.target.closest('.indicator-dot')) return;
        const activeSlide = DOM.carouselTrack.querySelector('.banner-slide.active');
        if (activeSlide) {
          const img = activeSlide.querySelector('.slide-image');
          if (img && img.src) {
            openAdLightbox(img.src);
          }
        }
      });
    }

    // Lightbox close handlers
    if (DOM.adLightboxClose) {
      DOM.adLightboxClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAdLightbox();
      });
    }

    if (DOM.adLightboxBackdrop) {
      DOM.adLightboxBackdrop.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAdLightbox();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        closeAdLightbox();
      }
    });
  }

  // --- Bootstrap ---
  window.addEventListener('DOMContentLoaded', () => {
    initEvents();
    renderBanners(DEFAULT_CONFIG.banners);
    initVideoPlayer();
    fetchStationData();
  });

})();
