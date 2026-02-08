import { useRef, useCallback } from 'react';

const SWIPE_THRESHOLD = 75; // minimum px to count as swipe
const MAX_VERTICAL_RATIO = 0.5; // max vertical movement relative to horizontal

export default function useSwipeGesture({ onSwipeLeft, onSwipeRight } = {}) {
  const touchStart = useRef(null);

  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (!touchStart.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Only trigger if horizontal movement is dominant and exceeds threshold
    if (absDeltaX >= SWIPE_THRESHOLD && absDeltaY / absDeltaX < MAX_VERTICAL_RATIO) {
      if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      } else if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      }
    }

    touchStart.current = null;
  }, [onSwipeLeft, onSwipeRight]);

  return { handleTouchStart, handleTouchEnd };
}
