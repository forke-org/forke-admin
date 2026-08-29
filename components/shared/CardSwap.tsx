'use client';

/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import React, {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  ReactElement,
  ReactNode,
  RefObject,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { gsap } from 'gsap';

export interface CardSwapProps {
  width?: number | string;
  height?: number | string;
  cardDistance?: number;
  verticalDistance?: number;
  delay?: number;
  pauseOnHover?: boolean;
  onCardClick?: (idx: number) => void;
  skewAmount?: number;
  easing?: 'linear' | 'elastic';
  children: ReactNode;
  activeIndex: number;
  onActiveIndexChange: (idx: number) => void;
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  customClass?: string;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(({ customClass, ...rest }, ref) => (
  <div
    ref={ref}
    {...rest}
    className={`absolute top-1/2 left-1/2 rounded-2xl border border-white/5 bg-[#0c0c0f] [will-change:transform] ${customClass ?? ''} ${rest.className ?? ''}`.trim()}
  />
));
Card.displayName = 'Card';

type CardRef = RefObject<HTMLDivElement | null>;
interface Slot {
  x: number;
  y: number;
  scale: number;
  zIndex: number;
  opacity: number;
}

// 2D Skewed layout: stack goes top-right in 2D using translation offsets and scale
const makeSlot = (i: number, distX: number, distY: number, total: number): Slot => {
  // Show only 3 cards in the visible stack at any time
  const isVisible = i < 3;
  return {
    x: i * distX,
    y: -i * distY,
    scale: isVisible ? 1 - i * 0.04 : 0.8,
    zIndex: total - i,
    opacity: isVisible ? 1 : 0
  };
};

const placeNow = (el: HTMLElement, slot: Slot, skew: number) =>
  gsap.set(el, {
    x: slot.x,
    y: slot.y,
    scale: slot.scale,
    xPercent: -50,
    yPercent: -50,
    skewY: skew,
    opacity: slot.opacity,
    transformOrigin: 'center center',
    zIndex: slot.zIndex,
    force3D: false
  });

const CardSwap: React.FC<CardSwapProps> = ({
  width = 780,
  height = 420,
  cardDistance = 60,
  verticalDistance = 70,
  delay = 3500,
  pauseOnHover = false,
  onCardClick,
  skewAmount = 6,
  easing = 'elastic',
  children,
  activeIndex,
  onActiveIndexChange
}) => {
  const childArr = useMemo(() => Children.toArray(children) as ReactElement<CardProps>[], [children]);
  const refs = useMemo<CardRef[]>(() => childArr.map(() => React.createRef<HTMLDivElement>()), [childArr.length]);

  const order = useRef<number[]>(Array.from({ length: childArr.length }, (_, i) => i));
  const isAnimating = useRef<boolean>(false);
  const isHovered = useRef<boolean>(false);

  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const intervalRef = useRef<number>(0);
  const container = useRef<HTMLDivElement>(null);

  const numericWidth = typeof width === 'number' ? width : parseInt(String(width)) || 780;

  const [responsiveDistances, setResponsiveDistances] = useState({ distX: cardDistance, distY: verticalDistance });
  // On phones the card flips to a portrait (vertical) shape; desktop keeps the wide landscape card.
  const [isMobileCard, setIsMobileCard] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const w = window.innerWidth;
      if (w < 480) {
        setResponsiveDistances({ distX: 30, distY: 35 });
        setIsMobileCard(true);
      } else if (w < 768) {
        setResponsiveDistances({ distX: 40, distY: 45 });
        setIsMobileCard(true);
      } else {
        setResponsiveDistances({ distX: cardDistance, distY: verticalDistance });
        setIsMobileCard(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [cardDistance, verticalDistance]);

  // Portrait dimensions for mobile, landscape for desktop
  const cardWidth = isMobileCard ? 360 : width;
  const cardHeight = isMobileCard ? 420 : height;

  // Initialize positioning on mount / change of props
  useEffect(() => {
    const total = refs.length;
    
    const indexInOrder = order.current.indexOf(activeIndex);
    if (indexInOrder !== -1 && indexInOrder !== 0) {
      order.current = [
        ...order.current.slice(indexInOrder),
        ...order.current.slice(0, indexInOrder)
      ];
    }

    refs.forEach((r, i) => {
      if (r.current) {
        const slotIdx = order.current.indexOf(i);
        placeNow(r.current, makeSlot(slotIdx, responsiveDistances.distX, responsiveDistances.distY, total), skewAmount);
      }
    });
  }, [responsiveDistances, skewAmount, refs.length]);

  // Transition handler
  useEffect(() => {
    const targetIdx = activeIndex;
    const currentFrontIdx = order.current[0];
    if (targetIdx === currentFrontIdx) return; // Already front

    const targetPos = order.current.indexOf(targetIdx);
    if (targetPos === -1) return;

    const newOrder = [...order.current.slice(targetPos), ...order.current.slice(0, targetPos)];
    const total = refs.length;

    isAnimating.current = true;
    const tl = gsap.timeline({
      onComplete: () => {
        order.current = newOrder;
        isAnimating.current = false;
      }
    });
    tlRef.current = tl;

    const prevFrontIdx = currentFrontIdx;
    
    newOrder.forEach((cardIdx, newSlotIdx) => {
      const el = refs[cardIdx].current;
      if (!el) return;

      const prevSlotIdx = order.current.indexOf(cardIdx);
      const targetSlot = makeSlot(newSlotIdx, responsiveDistances.distX, responsiveDistances.distY, total);

      if (cardIdx === prevFrontIdx) {
        // --- FALL AND GO BACK ANIMATION ---
        // 1. Fall down straight, fading out
        tl.to(el, {
          y: '+=500',
          scale: 0.9,
          opacity: 0,
          skewY: skewAmount,
          duration: 0.65,
          ease: 'power2.in'
        }, 0);

        // 2. Flip zIndex to the lowest value at the bottom of the fall
        tl.call(() => {
          gsap.set(el, { zIndex: targetSlot.zIndex });
        }, undefined, 0.65);

        // 3. Return from below to the back slot position
        tl.to(el, {
          x: targetSlot.x,
          y: targetSlot.y,
          scale: targetSlot.scale,
          opacity: targetSlot.opacity,
          skewY: skewAmount,
          duration: 0.75,
          ease: 'power2.out'
        }, 0.65);

      } else {
        // --- PROMOTE REMAINING CARDS ---
        if (newSlotIdx < prevSlotIdx) {
          // Slide forward smoothly
          tl.to(el, {
            x: targetSlot.x,
            y: targetSlot.y,
            scale: targetSlot.scale,
            opacity: targetSlot.opacity,
            skewY: skewAmount,
            duration: 0.8,
            ease: 'power3.out'
          }, 0.2); // slight delay after front card begins falling

          // Update zIndex halfway
          tl.call(() => {
            gsap.set(el, { zIndex: targetSlot.zIndex });
          }, undefined, 0.45);
        } else {
          // Slide back quietly (if during manual jump)
          tl.to(el, {
            x: targetSlot.x,
            y: targetSlot.y,
            scale: targetSlot.scale,
            opacity: targetSlot.opacity,
            zIndex: targetSlot.zIndex,
            skewY: skewAmount,
            duration: 0.6,
            ease: 'power2.inOut'
          }, 0);
        }
      }
    });

    return () => {
      tl.kill();
    };
  }, [activeIndex, responsiveDistances, refs, numericWidth, skewAmount]);

  // Autoplay Timer loop
  useEffect(() => {
    const startTimer = () => {
      return window.setInterval(() => {
        if (isAnimating.current || (pauseOnHover && isHovered.current)) return;
        const nextIdx = order.current[1]; // next card to front
        onActiveIndexChange(nextIdx);
      }, delay);
    };

    intervalRef.current = startTimer();

    if (pauseOnHover) {
      const handleMouseEnter = () => {
        isHovered.current = true;
        tlRef.current?.pause();
      };

      const handleMouseLeave = () => {
        isHovered.current = false;
        tlRef.current?.play();
      };

      const containerEl = container.current;
      if (containerEl) {
        containerEl.addEventListener('mouseenter', handleMouseEnter);
        containerEl.addEventListener('mouseleave', handleMouseLeave);
      }

      return () => {
        clearInterval(intervalRef.current);
        if (containerEl) {
          containerEl.removeEventListener('mouseenter', handleMouseEnter);
          containerEl.removeEventListener('mouseleave', handleMouseLeave);
        }
      };
    }

    return () => {
      clearInterval(intervalRef.current);
    };
  }, [delay, pauseOnHover, onActiveIndexChange]);

  const rendered = childArr.map((child, i) => {
    if (!isValidElement<CardProps>(child)) return child;

    const isActive = i === activeIndex;

    return cloneElement(child, {
      key: i,
      ref: refs[i],
      style: {
        width: cardWidth,
        height: cardHeight,
        ...(child.props.style ?? {})
      },
      onClick: (e) => {
        child.props.onClick?.(e as React.MouseEvent<HTMLDivElement>);
        onCardClick?.(i);
        onActiveIndexChange(i);
      },
      className: `${child.props.className ?? ''} transition-colors duration-500 ${
        isActive 
          ? 'cursor-default pointer-events-auto border-accent/40 shadow-[0_20px_50px_rgba(255,122,0,0.15),_inset_0_1px_0_rgba(255,122,0,0.15)] bg-[#0c0c0f]' 
          : 'cursor-pointer pointer-events-auto border-white/5 bg-[#0c0c0f] hover:border-white/20'
      }`
    } as CardProps & React.RefAttributes<HTMLDivElement>);
  });

  return (
    <div
      ref={container}
      className="absolute top-1/2 lg:right-0 lg:left-auto lg:translate-x-[44%] lg:-translate-y-[36%] min-[1920px]:translate-x-[30%] left-1/2 -translate-x-1/2 -translate-y-[30%] right-auto origin-center overflow-visible transition-all duration-300 max-[1024px]:scale-[0.85] max-[768px]:scale-[0.78] max-[480px]:scale-[0.74] max-[380px]:scale-[0.64]"
      style={{ width: cardWidth, height: cardHeight }}
    >
      {rendered}
    </div>
  );
};

export default CardSwap;
