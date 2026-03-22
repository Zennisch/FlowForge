'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { PressAnimationDuration, PressAnimationStrength } from './types/button';

const RIPPLE_OPACITIES: Record<PressAnimationStrength, number> = {
  light: 0.2,
  medium: 0.35,
  strong: 0.5,
};

const RIPPLE_DURATIONS: Record<PressAnimationDuration, number> = {
  short: 0.6,
  medium: 1,
  long: 1.5,
};

interface RippleEffectProps {
  ripples: any[];
  duration?: PressAnimationDuration;
  strength?: PressAnimationStrength;
  onClear: (id: number) => void;
}

export const RippleEffect = ({
  ripples,
  duration = 'medium',
  strength = 'medium',
  onClear,
}: RippleEffectProps) => (
  <span className="absolute inset-0 overflow-hidden rounded-[inherit] pointer-events-none z-0">
    <AnimatePresence>
      {ripples.map((ripple) => (
        <motion.span
          key={ripple.id}
          initial={{ scale: 0, opacity: RIPPLE_OPACITIES[strength] }}
          animate={{ scale: 2.5, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: RIPPLE_DURATIONS[duration] }}
          style={{
            position: 'absolute',
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
            borderRadius: '50%',
            backgroundColor: 'currentColor',
          }}
          onAnimationComplete={() => onClear(ripple.id)}
        />
      ))}
    </AnimatePresence>
  </span>
);
