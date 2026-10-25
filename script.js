/**
 * Elena Moore Massages — Interactive Scripts
 * - Theme toggle
 * - Fixed (always-visible) navbar scroll styling + smooth scroll
 * - Gallery lightbox with prev/next
 * - Live review form + 24h review grid
 */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const API_URL = '/api/reviews';
  const html = document.documentElement;

  /* ---------------- Theme ---------------- */
  const themeToggle = document.getElementById('themeToggle');

  function applyTheme(theme) {
    if (theme === 'dark' || theme === 'light') {
      html.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
    }
  }

  (function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved) applyTheme(saved);
    setTimeout(() => html.classList.remove('preload'), 80);
  })();

  if (themeToggle) {
    themeToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const current = html.getAttribute('data-theme') || 'dark';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  /* ---------------- Nav (always visible) ---------------- */
  const nav = document.getElementById('mainNav');
  const navLinks = document.getElementById('navLinks');

  window.addEventListener('scroll', () => {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* ---------------- Reveal on scroll ---------------- */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('visible');
        revealObserver.unobserve(en.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll(
    '.service-card, .price-card, .digital-item, .testimonial-card, .gallery-item, .philosophy-text, .philosophy-img, .contact-card, .comment-form-container'
  ).forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = Math.min(i * 0.04, 0.4) + 's';
    revealObserver.observe(el);
  });

  /* ---------------- Gallery lightbox ---------------- */
  const galleryImgs = Array.from(document.querySelectorAll('.gallery-item img'));
  let currentIdx = -1;
  let lightboxEl = null;

  function buildLightbox() {
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = `
      <button class="lightbox-close" aria-label="Close">&times;</button>
      <button class="lightbox-nav prev" aria-label="Previous">&#10094;</button>
      <img class="lightbox-img" alt="">
      <button class="lightbox-nav next" aria-label="Next">&#10095;</button>
    `;
    document.body.appendChild(lb);
    lb.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    lb.querySelector('.prev').addEventListener('click', (e) => { e.stopPropagation(); showLightbox(currentIdx - 1); });
    lb.querySelector('.next').addEventListener('click', (e) => { e.stopPropagation(); showLightbox(currentIdx + 1); });
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
    return lb;
  }

  function showLightbox(idx) {
    if (!galleryImgs.length) return;
    currentIdx = (idx + galleryImgs.length) % galleryImgs.length;
    const img = galleryImgs[currentIdx];
    if (!lightboxEl) {
      lightboxEl = buildLightbox();
      document.body.classList.add('no-scroll');
    }
    const lbImg = lightboxEl.querySelector('.lightbox-img');
    lbImg.src = img.src;
    lbImg.alt = img.alt || '';
    requestAnimationFrame(() => lightboxEl.classList.add('open'));
  }

  function closeLightbox() {
    if (!lightboxEl) return;
    lightboxEl.classList.remove('open');
    document.body.classList.remove('no-scroll');
    const el = lightboxEl;
    lightboxEl = null;
    setTimeout(() => el.remove(), 250);
  }

  galleryImgs.forEach((img, i) => {
    const fig = img.closest('.gallery-item');
    if (fig) fig.addEventListener('click', () => showLightbox(i));
  });

  document.addEventListener('keydown', (e) => {
    if (!lightboxEl) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showLightbox(currentIdx - 1);
    if (e.key === 'ArrowRight') showLightbox(currentIdx + 1);
  });

  /* ---------------- Star rating ---------------- */
  const stars = Array.from(document.querySelectorAll('#starRating span'));
  const ratingInput = document.getElementById('ratingValue');
  let currentRating = 0;

  function paintStars(v) {
    stars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.value, 10) <= v));
  }
  stars.forEach(star => {
    star.addEventListener('mouseenter', () => paintStars(parseInt(star.dataset.value, 10)));
    star.addEventListener('click', () => {
      currentRating = parseInt(star.dataset.value, 10);
      if (ratingInput) ratingInput.value = currentRating;
      paintStars(currentRating);
    });
  });
  const starWrap = document.getElementById('starRating');
  if (starWrap) starWrap.addEventListener('mouseleave', () => paintStars(currentRating));

  /* ---------------- Reviews ---------------- */
  const recentGrid = document.getElementById('recentReviews');
  const form = document.getElementById('reviewForm');
  const formStatus = document.getElementById('formStatus');

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }
  function initials(name) {
    return String(name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }
  function relTime(createdAt) {
    if (!createdAt) return '';
    const diff = Date.now() - createdAt;
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Just now';
    if (min < 60) return min + ' min ago';
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + (hr === 1 ? ' hour ago' : ' hours ago');
    return 'Over a day ago';
  }

  function makeCard(r) {
    const card = document.createElement('article');
    card.className = 'testimonial-card live';
    card.style.opacity = '0';
    card.style.transform = 'translateY(16px)';
    const filled = '★'.repeat(r.rating);
    const empty = '☆'.repeat(5 - r.rating);
    const when = relTime(r.createdAt) || r.date || '';
    card.innerHTML = `
      <div class="testimonial-stars">${filled}${empty}</div>
      <p class="testimonial-text">"${escapeHtml(r.text)}"</p>
      <div class="testimonial-author">
        <div class="testimonial-avatar">${escapeHtml(initials(r.name))}</div>
        <div>
          <div class="testimonial-name">${escapeHtml(r.name)}</div>
          <div class="testimonial-date">${escapeHtml(when)} · ${escapeHtml(r.service)}</div>
        </div>
      </div>
    `;
    requestAnimationFrame(() => {
      card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    });
    return card;
  }

  const emptyStateHTML = '<div class="reviews-empty">No recent reviews. Be the first to share your experience — your story stays live for 24&nbsp;hours.</div>';

  async function loadReviews() {
    if (!recentGrid) return;
    try {
      const res = await fetch(API_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('bad status');
      const list = await res.json();
      recentGrid.innerHTML = '';
      if (!Array.isArray(list) || list.length === 0) {
        recentGrid.innerHTML = emptyStateHTML;
        return;
      }
      list.forEach(r => recentGrid.appendChild(makeCard(r)));
    } catch (err) {
      try {
        const local = JSON.parse(localStorage.getItem('elenaMooreReviews') || '[]');
        recentGrid.innerHTML = '';
        if (!local.length) { recentGrid.innerHTML = emptyStateHTML; return; }
        local.forEach(r => recentGrid.appendChild(makeCard(r)));
      } catch (e) {
        recentGrid.innerHTML = '<div class="reviews-empty">Reviews are unavailable right now.</div>';
      }
    }
  }

  function showFormStatus(msg, type) {
    if (!formStatus) return;
    formStatus.textContent = msg;
    formStatus.className = 'form-status ' + (type || '');
    if (type === 'success') {
      setTimeout(() => {
        if (formStatus.textContent === msg) {
          formStatus.textContent = '';
          formStatus.className = 'form-status';
        }
      }, 4200);
    }
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('reviewName').value.trim();
      const service = document.getElementById('reviewService').value;
      const text = document.getElementById('reviewText').value.trim();
      const rating = parseInt(document.getElementById('ratingValue').value, 10) || 0;

      if (!name || !service || !text) return showFormStatus('Please fill in all fields.', 'error');
      if (rating < 1) return showFormStatus('Please select a star rating.', 'error');

      const payload = { name, service, text, rating };

      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('submit failed');
        const saved = await res.json();

        if (recentGrid) {
          if (recentGrid.querySelector('.reviews-empty')) recentGrid.innerHTML = '';
          recentGrid.insertBefore(makeCard(saved), recentGrid.firstChild);
        }
        showFormStatus('Thank you! Your review is live for 24 hours.', 'success');
      } catch (err) {
        const local = JSON.parse(localStorage.getItem('elenaMooreReviews') || '[]');
        const fallback = {
          ...payload,
          id: 'local-' + Date.now(),
          createdAt: Date.now(),
          date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
        };
        local.unshift(fallback);
        localStorage.setItem('elenaMooreReviews', JSON.stringify(local.slice(0, 50)));

        if (recentGrid) {
          if (recentGrid.querySelector('.reviews-empty')) recentGrid.innerHTML = '';
          recentGrid.insertBefore(makeCard(fallback), recentGrid.firstChild);
        }
        showFormStatus('Saved locally — it will display for you until the server is available.', 'success');
      }

      form.reset();
      currentRating = 0;
      if (ratingInput) ratingInput.value = 0;
      paintStars(0);
    });
  }

  loadReviews();
  setInterval(loadReviews, 5 * 60 * 1000); // refresh every 5 min to drop expired ones
});