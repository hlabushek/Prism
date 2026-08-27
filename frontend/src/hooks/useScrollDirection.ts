import { useState, useEffect } from 'react';

export function useScrollDirection(threshold: number = 8) {
  const [isScrollingDown, setIsScrollingDown] = useState(false);

  useEffect(() => {
    let lastScrollY = window.pageYOffset || document.documentElement.scrollTop;
    let ticking = false;

    const updateScrollDir = () => {
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;

      // Always show when near the very top of the page
      if (scrollY <= 40) {
        setIsScrollingDown(false);
        lastScrollY = scrollY;
        ticking = false;
        return;
      }

      const delta = scrollY - lastScrollY;

      // Only toggle if scroll delta exceeds threshold
      if (Math.abs(delta) >= threshold) {
        setIsScrollingDown(delta > 0);
        lastScrollY = scrollY;
      }

      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollDir);
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return isScrollingDown;
}
