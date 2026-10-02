import { useEffect, useRef, useState } from 'react';
import { cursorInteractionState } from '@/lib/cursorState';

/**
 * Premium Kinetic Cursor Component
 * Replaces default cursor on desktop with a minimal, responsive kinetic cursor.
 * Features:
 * - Inner solid dark-green dot (#064E3B)
 * - Outer forest-green ring (#14532D) with subtle mint glow
 * - Inertial lag and velocity-based directional stretch
 * - Interactive element hover expansions (buttons, links, inputs, cards)
 * - Click compression and elastic spring-back
 * - Synchronized magnetic attraction with 3D vertex proximity (<180px & <60px snap)
 * - Subtle 3-point trailing nodes that disappear when stationary
 * - Zero React re-renders during motion (100% requestAnimationFrame & GPU transform driven)
 */
export function KineticCursor() {
  const [isEnabled, setIsEnabled] = useState(false);

  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const trailRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // Enable only for desktop fine-pointer devices (not touch/coarse)
    const finePointerQuery = window.matchMedia('(pointer: fine)');
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const checkEnabled = () => {
      const active = finePointerQuery.matches && !reducedMotionQuery.matches;
      setIsEnabled(active);

      if (active) {
        document.documentElement.classList.add('kinetic-cursor-active');
      } else {
        document.documentElement.classList.remove('kinetic-cursor-active');
      }
    };

    checkEnabled();
    finePointerQuery.addEventListener('change', checkEnabled);
    reducedMotionQuery.addEventListener('change', checkEnabled);

    return () => {
      document.documentElement.classList.remove('kinetic-cursor-active');
      finePointerQuery.removeEventListener('change', checkEnabled);
      reducedMotionQuery.removeEventListener('change', checkEnabled);
    };
  }, []);

  useEffect(() => {
    if (!isEnabled) return;

    // Direct animation coordinates (zero React state updates)
    let mouseX = -100;
    let mouseY = -100;
    let hasMoved = false;

    // Smoothed positions
    let dotX = -100;
    let dotY = -100;
    let ringX = -100;
    let ringY = -100;

    // Previous positions for velocity
    let prevRingX = -100;
    let prevRingY = -100;

    // Smooth sizes and opacities
    let currentRingSize = 28;
    let currentDotSize = 5;
    let currentRingOpacity = 0.65;
    let clickScale = 1.0;

    // Context hover states
    let isHoveringInteractive = false;
    let isHoveringCard = false;
    let isMouseDown = false;

    // Trailing points (3 tiny nodes)
    const trail = [
      { x: -100, y: -100 },
      { x: -100, y: -100 },
      { x: -100, y: -100 },
    ];

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (!hasMoved) {
        hasMoved = true;
        dotX = mouseX;
        dotY = mouseY;
        ringX = mouseX;
        ringY = mouseY;
        prevRingX = mouseX;
        prevRingY = mouseY;
        for (const t of trail) {
          t.x = mouseX;
          t.y = mouseY;
        }
      }

      // Check hovered element
      const target = e.target as HTMLElement | null;
      if (target) {
        const interactive = target.closest('button, a, input, select, textarea, [role="button"], label, [data-cursor="interactive"]');
        const card = target.closest('[data-card], .rounded-2xl, article, [role="region"]');
        isHoveringInteractive = Boolean(interactive);
        isHoveringCard = Boolean(card && !interactive);
      }
    };

    const onPointerDown = () => {
      isMouseDown = true;
    };

    const onPointerUp = () => {
      isMouseDown = false;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });

    let animId: number;

    const renderLoop = () => {
      if (!hasMoved) {
        animId = requestAnimationFrame(renderLoop);
        return;
      }

      // 1. 3D Vertex Proximity & Magnetic Snap
      const {
        nearestVertexX,
        nearestVertexY,
        nearestVertexDistance,
        isNearVertex,
        isSnappedVertex,
      } = cursorInteractionState;

      let targetDotX = mouseX;
      let targetDotY = mouseY;

      // Magnetic snap: when cursor is very close (< 60px) to a 3D vertex
      if (isSnappedVertex && nearestVertexDistance > 0.1) {
        const snapFactor = Math.max(0, 1 - nearestVertexDistance / 60) * 0.15;
        const visualOffsetX = (nearestVertexX - mouseX) * snapFactor;
        const visualOffsetY = (nearestVertexY - mouseY) * snapFactor;
        // Clamp maximum visual cursor offset to 14px
        const maxOffset = 14;
        const offsetDist = Math.hypot(visualOffsetX, visualOffsetY);
        if (offsetDist > maxOffset) {
          const ratio = maxOffset / offsetDist;
          targetDotX += visualOffsetX * ratio;
          targetDotY += visualOffsetY * ratio;
        } else {
          targetDotX += visualOffsetX;
          targetDotY += visualOffsetY;
        }
      }

      // 2. Target Sizing based on Context & 3D Proximity
      let targetRingSize = 28;
      let targetDotSize = 5;
      let targetRingOpacity = 0.65;

      if (isNearVertex) {
        // Vertex attraction expands the ring and strengthens inner dot
        const normDist = Math.max(0, 1 - nearestVertexDistance / 180);
        targetRingSize = 28 + normDist * 12; // 28px -> 40px
        targetDotSize = 5 + normDist * 3; // 5px -> 8px
        targetRingOpacity = 0.65 + normDist * 0.30; // 0.65 -> 0.95
      } else if (isHoveringInteractive) {
        targetRingSize = 38;
        targetDotSize = 3.5;
        targetRingOpacity = 0.90;
      } else if (isHoveringCard) {
        targetRingSize = 31;
        targetDotSize = 5;
        targetRingOpacity = 0.75;
      }

      // Click scale animation (0.82 on down, springs back to 1.0)
      const targetClickScale = isMouseDown ? 0.82 : 1.0;
      clickScale += (targetClickScale - clickScale) * 0.22;

      // Smooth size transitions
      currentRingSize += (targetRingSize - currentRingSize) * 0.18;
      currentDotSize += (targetDotSize - currentDotSize) * 0.22;
      currentRingOpacity += (targetRingOpacity - currentRingOpacity) * 0.18;

      // 3. Smooth Kinetic Movement (Inner dot fast, outer ring inertial lag)
      dotX += (targetDotX - dotX) * 0.42;
      dotY += (targetDotY - dotY) * 0.42;

      ringX += (targetDotX - ringX) * 0.16;
      ringY += (targetDotY - ringY) * 0.16;

      // 4. Velocity-based Directional Stretch for Outer Ring
      const vx = ringX - prevRingX;
      const vy = ringY - prevRingY;
      const speed = Math.hypot(vx, vy);
      prevRingX = ringX;
      prevRingY = ringY;

      let stretchX = 1;
      let stretchY = 1;
      let angle = 0;

      if (speed > 0.4) {
        stretchX = Math.min(1.35, 1 + speed * 0.016);
        stretchY = Math.max(0.75, 1 / stretchX);
        angle = Math.atan2(vy, vx) * (180 / Math.PI);
      }

      // 5. Update DOM Elements directly via GPU-accelerated transforms
      if (dotRef.current) {
        const dotRadius = (currentDotSize * clickScale) / 2;
        dotRef.current.style.transform = `translate3d(${dotX - dotRadius}px, ${dotY - dotRadius}px, 0)`;
        dotRef.current.style.width = `${currentDotSize * clickScale}px`;
        dotRef.current.style.height = `${currentDotSize * clickScale}px`;
      }

      if (ringRef.current) {
        const ringRadius = (currentRingSize * clickScale) / 2;
        ringRef.current.style.transform = `translate3d(${ringX - ringRadius}px, ${ringY - ringRadius}px, 0) rotate(${angle}deg) scale(${stretchX * clickScale}, ${stretchY * clickScale})`;
        ringRef.current.style.width = `${currentRingSize}px`;
        ringRef.current.style.height = `${currentRingSize}px`;
        ringRef.current.style.opacity = currentRingOpacity.toFixed(2);
      }

      // 6. Update Kinetic Trailing Nodes (fades when stationary)
      const trailOpacity = Math.min(1, Math.max(0, (speed - 0.5) / 4));
      trail[0].x += (dotX - trail[0].x) * 0.36;
      trail[0].y += (dotY - trail[0].y) * 0.36;
      trail[1].x += (trail[0].x - trail[1].x) * 0.30;
      trail[1].y += (trail[0].y - trail[1].y) * 0.30;
      trail[2].x += (trail[1].x - trail[2].x) * 0.25;
      trail[2].y += (trail[1].y - trail[2].y) * 0.25;

      for (let i = 0; i < trailRefs.current.length; i++) {
        const node = trailRefs.current[i];
        if (node) {
          const pt = trail[i];
          const nodeRadius = 1.5;
          node.style.transform = `translate3d(${pt.x - nodeRadius}px, ${pt.y - nodeRadius}px, 0)`;
          node.style.opacity = (trailOpacity * (0.16 - i * 0.04)).toFixed(3);
        }
      }

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [isEnabled]);

  if (!isEnabled) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none select-none z-[99999] overflow-hidden"
      aria-hidden="true"
    >
      {/* 3 Kinetic Trail Dots */}
      <div
        ref={(el) => {
          trailRefs.current[0] = el;
        }}
        className="absolute top-0 left-0 w-[3px] h-[3px] rounded-full bg-[#166534] will-change-transform opacity-0 pointer-events-none"
      />
      <div
        ref={(el) => {
          trailRefs.current[1] = el;
        }}
        className="absolute top-0 left-0 w-[2.5px] h-[2.5px] rounded-full bg-[#166534] will-change-transform opacity-0 pointer-events-none"
      />
      <div
        ref={(el) => {
          trailRefs.current[2] = el;
        }}
        className="absolute top-0 left-0 w-[2px] h-[2px] rounded-full bg-[#166534] will-change-transform opacity-0 pointer-events-none"
      />

      {/* Outer Forest-Green Kinetic Ring */}
      <div
        ref={ringRef}
        className="absolute top-0 left-0 rounded-full border-[1.5px] border-[#14532D] will-change-transform pointer-events-none"
        style={{
          boxShadow: '0 0 10px rgba(20, 83, 45, 0.14), inset 0 0 4px rgba(20, 83, 45, 0.05)',
          transition: 'width 0.12s ease-out, height 0.12s ease-out',
        }}
      />

      {/* Inner Solid Dark-Green Dot */}
      <div
        ref={dotRef}
        className="absolute top-0 left-0 rounded-full bg-[#064E3B] will-change-transform pointer-events-none"
        style={{
          boxShadow: '0 0 4px rgba(6, 78, 59, 0.35)',
        }}
      />
    </div>
  );
}
