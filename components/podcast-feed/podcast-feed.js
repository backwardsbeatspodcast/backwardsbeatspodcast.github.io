// podcast-feed.js
class PodcastFeed extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.episodes = [];
    this.displayedCount = 0;
    this.initialLoad = 10;
    this.loadIncrement = 5;
    this.loading = false;
    this.allLoaded = false;
  }

  static get observedAttributes() {
    return ['feed-url', 'initial-load'];
  }

  connectedCallback() {
    this.feedUrl = this.getAttribute('feed-url');
    this.initialLoad = parseInt(this.getAttribute('initial-load')) || 10;
    this.render();
    this.loadFeed();
    this.setupInfiniteScroll();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
        }

        .feed-container {
          width: 100%;
        }

        .episode-list {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .episode-item {
          display: flex;
          gap: 1.5rem;
          padding: 1.5rem;
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 0.5rem;
          transition: all 0.2s;
        }

        .episode-item:hover {
          border-color: var(--border-hover-color, #9ca3af);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .episode-artwork {
          flex-shrink: 0;
          width: 120px;
          height: 120px;
          border-radius: 0.375rem;
          overflow: hidden;
          background: var(--artwork-bg, #f3f4f6);
        }

        .episode-artwork img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .episode-content {
          flex: 1;
          min-width: 0;
        }

        .episode-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0 0 0.5rem 0;
          line-height: 1.4;
        }

        .episode-title a {
          color: var(--title-color, #111827);
          text-decoration: none;
        }

        .episode-title a:hover {
          color: var(--title-hover-color, #4b5563);
        }

        .episode-meta {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          font-size: 0.875rem;
          color: var(--meta-color, #6b7280);
          margin-bottom: 0.75rem;
        }

        .episode-date,
        .episode-duration {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .episode-player {
          width: 100%;
          margin-bottom: 1rem;
        }

        .episode-description {
          color: var(--description-color, #4b5563);
          line-height: 1.6;
          position: relative;
        }

        .episode-description.collapsed {
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .episode-description p {
          margin: 0 0 0.5rem 0;
        }

        .episode-description a {
          color: var(--link-color, #2563eb);
          text-decoration: underline;
        }

        .episode-description a:hover {
          color: var(--link-hover-color, #1d4ed8);
        }

        .expand-toggle {
          background: none;
          border: none;
          color: var(--link-color, #2563eb);
          cursor: pointer;
          padding: 0.5rem 0 0 0;
          font-size: 0.875rem;
          font-weight: 500;
          text-decoration: underline;
        }

        .expand-toggle:hover {
          color: var(--link-hover-color, #1d4ed8);
        }

        .episode-player audio {
          width: 100%;
          height: 40px;
        }

        .loading-spinner {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 2rem;
          color: var(--spinner-color, #6b7280);
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--spinner-bg, #e5e7eb);
          border-top-color: var(--spinner-color, #6b7280);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-message {
          padding: 1.5rem;
          background: var(--error-bg, #fef2f2);
          border: 1px solid var(--error-border, #fecaca);
          border-radius: 0.5rem;
          color: var(--error-color, #991b1b);
        }

        .load-more-trigger {
          height: 20px;
          margin: 2rem 0;
        }

        .all-loaded-message {
          text-align: center;
          padding: 2rem;
          color: var(--meta-color, #6b7280);
          font-style: italic;
        }

        @media (max-width: 640px) {
          .episode-item {
            flex-direction: column;
            gap: 1rem;
          }

          .episode-artwork {
            width: 100%;
            height: 200px;
          }
        }
      </style>

      <div class="feed-container">
        <div class="episode-list" id="episodeList"></div>
        <div class="loading-spinner" id="initialLoader">
          <div class="spinner"></div>
        </div>
        <div class="load-more-trigger" id="loadMoreTrigger"></div>
        <div class="loading-spinner" id="loadingMore" style="display: none;">
          <div class="spinner"></div>
        </div>
        <div class="all-loaded-message" id="allLoaded" style="display: none;">
          All episodes loaded
        </div>
        <div class="error-message" id="errorMessage" style="display: none;"></div>
      </div>
    `;
  }

  async loadFeed() {
    try {
      const response = await fetch(this.feedUrl);
      const text = await response.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'text/xml');

      const items = xml.querySelectorAll('item');
      this.episodes = Array.from(items).map(item => this.parseEpisode(item));

      this.shadowRoot.getElementById('initialLoader').style.display = 'none';
      this.displayEpisodes(this.initialLoad);
    } catch (error) {
      this.showError('Failed to load podcast feed. Please try again later.');
      console.error('Feed loading error:', error);
    }
  }

  parseEpisode(item) {
    const getTextContent = (tagName) => {
      const el = item.querySelector(tagName);
      return el ? el.textContent : '';
    };

    const getImageUrl = () => {
      const itunesImage = item.querySelector('image');
      if (itunesImage) return itunesImage.getAttribute('href');
      
      const enclosure = item.querySelector('enclosure[type^="image"]');
      if (enclosure) return enclosure.getAttribute('url');

      const channel = item.closest('channel');
      const channelImage = channel?.querySelector('image url');
      return channelImage ? channelImage.textContent : '';
    };

    const getAudioUrl = () => {
      const enclosure = item.querySelector('enclosure[type^="audio"]');
      return enclosure ? enclosure.getAttribute('url') : '';
    };

    const getDuration = () => {
      const duration = getTextContent('duration');
      if (!duration) return '';
      
      const parts = duration.split(':');
      if (parts.length === 3) {
        const [h, m, s] = parts;
        return `${h}h ${m}m`;
      } else if (parts.length === 2) {
        const [m, s] = parts;
        return `${m}m`;
      }
      return duration;
    };

    const formatDate = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    };

    return {
      title: getTextContent('title'),
      link: getTextContent('link'),
      description: getTextContent('description'),
      pubDate: formatDate(getTextContent('pubDate')),
      duration: getDuration(),
      imageUrl: getImageUrl(),
      audioUrl: getAudioUrl()
    };
  }

  displayEpisodes(count) {
    const episodeList = this.shadowRoot.getElementById('episodeList');
    const endIndex = Math.min(this.displayedCount + count, this.episodes.length);

    for (let i = this.displayedCount; i < endIndex; i++) {
      const episode = this.episodes[i];
      const episodeEl = this.createEpisodeElement(episode);
      episodeList.appendChild(episodeEl);
    }

    this.displayedCount = endIndex;

    if (this.displayedCount >= this.episodes.length) {
      this.allLoaded = true;
      this.shadowRoot.getElementById('loadMoreTrigger').style.display = 'none';
      this.shadowRoot.getElementById('allLoaded').style.display = 'block';
    }
  }

  createEpisodeElement(episode) {
    const article = document.createElement('article');
    article.className = 'episode-item';

    const sanitizeHTML = (html) => {
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      
      // Remove script tags and event handlers
      const scripts = tmp.querySelectorAll('script');
      scripts.forEach(script => script.remove());
      
      // Remove inline event handlers
      const allElements = tmp.querySelectorAll('*');
      allElements.forEach(el => {
        Array.from(el.attributes).forEach(attr => {
          if (attr.name.startsWith('on')) {
            el.removeAttribute(attr.name);
          }
        });
        
        // Ensure links open in new tab
        if (el.tagName === 'A') {
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
        }
      });
      
      return tmp.innerHTML;
    };

    const descriptionId = `desc-${Math.random().toString(36).substr(2, 9)}`;

    article.innerHTML = `
      ${episode.imageUrl ? `
        <div class="episode-artwork">
          <img src="${episode.imageUrl}" alt="${episode.title}" loading="lazy">
        </div>
      ` : ''}
      <div class="episode-content">
        <h2 class="episode-title">
          ${episode.link ? `<a href="${episode.link}" target="_blank" rel="noopener">${episode.title}</a>` : episode.title}
        </h2>
        <div class="episode-meta">
          ${episode.pubDate ? `<span class="episode-date">📅 ${episode.pubDate}</span>` : ''}
          ${episode.duration ? `<span class="episode-duration">⏱️ ${episode.duration}</span>` : ''}
        </div>
        ${episode.audioUrl ? `
          <div class="episode-player">
            <audio controls preload="none">
              <source src="${episode.audioUrl}" type="audio/mpeg">
              Your browser does not support the audio element.
            </audio>
          </div>
        ` : ''}
        ${episode.description ? `
          <div class="episode-description collapsed" id="${descriptionId}">
            ${sanitizeHTML(episode.description)}
          </div>
          <button class="expand-toggle" data-target="${descriptionId}">
            Show more
          </button>
        ` : ''}
      </div>
    `;

    // Add event listener for expand/collapse
    const toggleBtn = article.querySelector('.expand-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        const descEl = article.querySelector(`#${e.target.dataset.target}`);
        const isCollapsed = descEl.classList.contains('collapsed');
        
        if (isCollapsed) {
          descEl.classList.remove('collapsed');
          e.target.textContent = 'Show less';
        } else {
          descEl.classList.add('collapsed');
          e.target.textContent = 'Show more';
        }
      });
    }

    return article;
  }

  setupInfiniteScroll() {
    const trigger = this.shadowRoot.getElementById('loadMoreTrigger');
    const loadingMore = this.shadowRoot.getElementById('loadingMore');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.loading && !this.allLoaded) {
          this.loading = true;
          loadingMore.style.display = 'flex';

          setTimeout(() => {
            this.displayEpisodes(this.loadIncrement);
            this.loading = false;
            loadingMore.style.display = 'none';
          }, 500);
        }
      });
    }, { threshold: 0.1 });

    observer.observe(trigger);
  }

  showError(message) {
    const errorEl = this.shadowRoot.getElementById('errorMessage');
    const initialLoader = this.shadowRoot.getElementById('initialLoader');
    
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    initialLoader.style.display = 'none';
  }
}

customElements.define('podcast-feed', PodcastFeed);
