// Scroll-based Slide Animations for Xozen AI Landing Page
(function() {
  'use strict';

  // Intersection Observer for slide animations
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.2 // Trigger when 20% of section is visible
  };

  const slideObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        // Optional: Unobserve after animation (remove if you want repeating animations)
        // slideObserver.unobserve(entry.target);
      } else {
        // Remove active class when scrolling away (for repeating effect)
        entry.target.classList.remove('active');
      }
    });
  }, observerOptions);

  // Wait for DOM to be ready
  function initSlideAnimations() {
    const slideSections = document.querySelectorAll('.slide-section');
    
    // Observe all slide sections
    slideSections.forEach(section => {
      slideObserver.observe(section);
    });

    // Activate first section immediately
    if (slideSections.length > 0) {
      slideSections[0].classList.add('active');
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSlideAnimations);
  } else {
    initSlideAnimations();
  }

  // Smooth scroll for anchor links
  document.addEventListener('click', (e) => {
    const target = e.target.closest('a[href^="#"]');
    if (!target) return;

    const href = target.getAttribute('href');
    if (href === '#' || !href) return;

    const targetElement = document.querySelector(href);
    if (!targetElement) return;

    e.preventDefault();
    targetElement.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  });
})();
