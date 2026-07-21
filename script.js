/**
 * Elena Moore Massages — Wellness Sanctuary
 * Interactive Scripts
 */

(function() {
  'use strict';

  /* ============================================
     THEME TOGGLE
     ============================================ */
  const themeToggle = document.getElementById('themeToggle');
  const html = document.documentElement;

  function setTheme(theme) {
    if (theme === 'dark' || theme === 'light') {
      html.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
    }
  }

  function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved) {
      setTheme(saved);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
    // Remove preload class after a brief delay to enable transitions
    setTimeout(() => {
      html.classList.remove('preload');
    }, 100);
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = html.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      setTheme(next);
    });
  }

  // Listen for system changes
  window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', e => {
      if (!localStorage.getItem('theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    });

  initTheme();

  /* ============================================
     PRICE CARD CLICK → CONTACT
     ============================================ */
  const priceCards = document.querySelectorAll('.price-card');
  const reviewService = document.getElementById('reviewService');

  priceCards.forEach(card => {
    card.addEventListener('click', function(e) {
      // Don't intercept if user is middle-clicking or ctrl/cmd+clicking
      if (e.ctrlKey || e.metaKey || e.button !== 0) return;

      const pkg = this.dataset.package;
      if (pkg && reviewService) {
        // Store selected package in sessionStorage for form prefill
        sessionStorage.setItem('selectedPackage', pkg);
      }
    });
  });

  // Prefill service select if coming from pricing
  if (reviewService && sessionStorage.getItem('selectedPackage')) {
    const pkg = sessionStorage.getItem('selectedPackage');
    // Try to match or add as custom option
    let matched = false;
    Array.from(reviewService.options).forEach(opt => {
      if (opt.value && pkg.toLowerCase().includes(opt.value.toLowerCase())) {
        reviewService.value = opt.value;
        matched = true;
      }
    });
    if (!matched) {
      // Add the package as a new option
      const newOpt = document.createElement('option');
      newOpt.value = pkg;
      newOpt.textContent = pkg;
      reviewService.insertBefore(newOpt, reviewService.options[1]);
      reviewService.value = pkg;
    }
    sessionStorage.removeItem('selectedPackage');
  }

  /* ============================================
     STAR RATING
     ============================================ */
  const stars = document.querySelectorAll('#starRating span');
  const ratingInput = document.getElementById('ratingValue');
  let currentRating = 0;

  if (stars.length > 0) {
    stars.forEach(star => {
      star.addEventListener('click', () => {
        const val = parseInt(star.dataset.value);
        currentRating = val;
        ratingInput.value = val;
        updateStars(val);
      });

      star.addEventListener('mouseenter', () => {
        updateStars(parseInt(star.dataset.value));
      });
    });

    document.getElementById('starRating').addEventListener('mouseleave', () => {
      updateStars(currentRating);
    });
  }

  function updateStars(val) {
    stars.forEach(s => {
      s.classList.toggle('active', parseInt(s.dataset.value) <= val);
    });
  }

  /* ============================================
     REVIEW FORM SUBMISSION — SHARED BACKEND
     ============================================ */
  const API_URL = '/api/reviews'; // Vercel Edge Function endpoint
  const reviewForm = document.getElementById('reviewForm');

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function createReviewCard(review, prepend = false) {
    const initials = review.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    const filledStars = '&#9733;'.repeat(review.rating);
    const emptyStars = '&#9734;'.repeat(5 - review.rating);
    const dateStr = review.date || new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });

    const card = document.createElement('div');
    card.className = 'testimonial-card';
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    card.innerHTML = `
      <div class="testimonial-stars">${filledStars}${emptyStars}</div>
      <p class="testimonial-text">"${escapeHtml(review.text)}"</p>
      <div class="testimonial-author">
        <div class="testimonial-avatar">${initials}</div>
        <div>
          <div class="testimonial-name">${escapeHtml(review.name)}</div>
          <div class="testimonial-date">${dateStr} &middot; ${escapeHtml(review.service)}</div>
        </div>
      </div>
    `;

    const grid = document.getElementById('testimonialsGrid');
    if (prepend) {
      grid.insertBefore(card, grid.firstChild);
    } else {
      grid.appendChild(card);
    }

    requestAnimationFrame(() => {
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    });

    return card;
  }

  async function submitReview(review) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(review)
      });
      if (!response.ok) throw new Error('Failed to submit');
      return await response.json();
    } catch (err) {
      console.warn('Backend unavailable, using localStorage fallback:', err);
      // Fallback to localStorage
      try {
        const reviews = JSON.parse(localStorage.getItem('elenaMooreReviews') || '[]');
        reviews.unshift(review);
        localStorage.setItem('elenaMooreReviews', JSON.stringify(reviews.slice(0, 50)));
      } catch (e) {}
      return review;
    }
  }

  async function loadReviews() {
    const grid = document.getElementById('testimonialsGrid');
    if (!grid) return;
    if (grid.dataset.loaded) return;
    grid.dataset.loaded = 'true';

    try {
      const response = await fetch(API_URL);
      if (response.ok) {
        const reviews = await response.json();
        reviews.forEach(review => createReviewCard(review));
        return;
      }
    } catch (err) {
      console.warn('Could not load from backend, trying localStorage:', err);
    }

    // Fallback to localStorage
    try {
      const reviews = JSON.parse(localStorage.getItem('elenaMooreReviews') || '[]');
      reviews.forEach(review => createReviewCard(review));
    } catch (e) {}
  }

  if (reviewForm) {
    reviewForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      const name = document.getElementById('reviewName').value.trim();
      const service = document.getElementById('reviewService').value;
      const text = document.getElementById('reviewText').value.trim();
      const rating = parseInt(document.getElementById('ratingValue').value) || 5;

      if (!name || !service || !text) {
        alert('Please fill in all fields.');
        return;
      }

      if (rating === 0) {
        alert('Please select a star rating.');
        return;
      }

      const review = {
        name,
        service,
        text,
        rating,
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
      };

      // Show immediately while submitting
      const card = createReviewCard(review, true);

      // Submit to backend
      await submitReview(review);

      // Reset form
      this.reset();
      currentRating = 0;
      updateStars(0);

      // Scroll to new review
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  loadReviews();

  /* ============================================
     SMOOTH SCROLL
     ============================================ */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      // Close mobile menu
      document.getElementById('navLinks').classList.remove('open');
    });
  });

  /* ============================================
     NAV SCROLL EFFECT
     ============================================ */
  const nav = document.getElementById('mainNav');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;

    if (currentScroll > 80) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
  });

  /* ============================================
     MOBILE NAV TOGGLE
     ============================================ */
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
  }

  /* ============================================
     SCROLL REVEAL ANIMATION
     ============================================ */
  const revealElements = document.querySelectorAll(
    '.service-card, .price-card, .digital-item, .testimonial-card, .gallery-item, .philosophy-text, .philosophy-img'
  );

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  revealElements.forEach((el, index) => {
    el.classList.add('reveal');
    el.style.transitionDelay = `${index * 0.05}s`;
    revealObserver.observe(el);
  });

  /* ============================================
     GALLERY LIGHTBOX
     ============================================ */
  const galleryItems = document.querySelectorAll('.gallery-item');

  galleryItems.forEach(item => {
    item.addEventListener('click', () => {
      const img = item.querySelector('img');
      if (!img) return;

      // Create lightbox
      const lightbox = document.createElement('div');
      lightbox.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: rgba(0,0,0,0.92);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: zoom-out;
        opacity: 0;
        transition: opacity 0.3s ease;
      `;

      const lightboxImg = document.createElement('img');
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightboxImg.style.cssText = `
        max-width: 90vw;
        max-height: 90vh;
        object-fit: contain;
        border-radius: 4px;
        transform: scale(0.95);
        transition: transform 0.3s ease;
      `;

      lightbox.appendChild(lightboxImg);
      document.body.appendChild(lightbox);

      requestAnimationFrame(() => {
        lightbox.style.opacity = '1';
        lightboxImg.style.transform = 'scale(1)';
      });

      lightbox.addEventListener('click', () => {
        lightbox.style.opacity = '0';
        lightboxImg.style.transform = 'scale(0.95)';
        setTimeout(() => lightbox.remove(), 300);
      });
    });
  });

})();
