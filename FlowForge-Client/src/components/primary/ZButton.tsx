'use client';

import { HTMLMotionProps, motion } from 'framer-motion';
import {
  ElementType,
  forwardRef,
  MouseEvent,
  PointerEvent,
  ReactNode,
  useMemo,
  useState,
} from 'react';
import {
  PressAnimationDuration,
  PressAnimationStrength,
  PressAnimationStyle,
  Shadow,
  Shape,
  Size,
  Variant,
} from './types/button';
import { theme } from './themeConfig';
import { cn } from './utils';
import { RippleEffect } from './ZButtonRipple';
import { SpinnerIcon } from './icon';

interface SizeConfig {
  base: string;
  padding: string;
  gap: string;
  spinner: string;
}

const SIZES: Record<Size, SizeConfig> = {
  xs: {
    base: 'text-xs',
    padding: 'px-4 py-1.5',
    gap: 'gap-1.5',
    spinner: 'h-2 w-2',
  },
  sm: {
    base: 'text-sm',
    padding: 'px-5 py-1.75',
    gap: 'gap-1.75',
    spinner: 'h-3 w-3',
  },
  md: {
    base: 'text-base',
    padding: 'px-6 py-2',
    gap: 'gap-2',
    spinner: 'h-4 w-4',
  },
  lg: {
    base: 'text-lg',
    padding: 'px-7 py-2.25',
    gap: 'gap-2.25',
    spinner: 'h-5 w-5',
  },
  xl: {
    base: 'text-xl',
    padding: 'px-8 py-2.5',
    gap: 'gap-2.5',
    spinner: 'h-6 w-6',
  },
};

const VARIANTS: Record<Variant, string> = {
  primary: theme.buttonPrimary,
  secondary: theme.buttonSecondary,
  tertiary: theme.buttonTertiary,
  ghost: theme.buttonGhost,
};

const SHAPES: Record<Shape, string> = {
  rounded: 'rounded-md',
  square: 'rounded-none',
  pill: 'rounded-full',
};

const SHADOWS: Record<Shadow, string> = {
  none: 'shadow-none',
  sm: 'shadow-sm',
  md: 'shadow',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
};

const SCALE_STRENGTHS: Record<PressAnimationStrength, number> = {
  light: 0.98,
  medium: 0.95,
  strong: 0.9,
};

const SCALE_DURATIONS: Record<PressAnimationDuration, number> = {
  short: 0.1,
  medium: 0.2,
  long: 0.3,
};

type P = Omit<HTMLMotionProps<'button'>, 'onClick'>;
interface ZButtonProps extends P {
  as?: ElementType;
  href?: string;
  target?: string;

  children?: ReactNode;

  variant?: Variant;
  size?: Size;
  shape?: Shape;
  shadow?: Shadow;

  fullWidth?: boolean;

  iconOnly?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;

  loading?: boolean;
  loadingText?: string;
  loadingComponent?: ReactNode;

  pressAnimationStyle?: PressAnimationStyle;
  pressAnimationDuration?: PressAnimationDuration;
  pressAnimationStrength?: PressAnimationStrength;

  onClick?: (e: MouseEvent<HTMLElement>) => void;
}

const ZButton = forwardRef<HTMLElement, ZButtonProps>((props, ref) => {
  const {
    as: Component = 'button',

    children,

    variant = 'primary',
    size = 'md',
    shape = 'rounded',
    shadow = 'none',

    fullWidth = false,

    iconOnly = false,
    iconStart,
    iconEnd,

    loading = false,
    loadingText,
    loadingComponent,

    pressAnimationStyle = 'scale',
    pressAnimationDuration = 'medium',
    pressAnimationStrength = 'medium',

    className,
    disabled,
    type = 'button',
    href,

    onClick,
    onPointerDown,
    ...rest
  } = props;

  const [ripples, setRipples] = useState<{ x: number; y: number; id: number; size: number }[]>([]);

  const isDisabled = disabled || loading;

  const { base: baseCls, padding: paddingCls, gap: gapCls, spinner: spinnerCls } = SIZES[size];
  const variantCls = VARIANTS[variant];
  const shapeCls = SHAPES[shape];
  const shadowCls = SHADOWS[shadow];
  const fullWidthCls = fullWidth ? 'w-full' : '';
  const pressAnimationCls = pressAnimationStyle === 'ripple' ? 'overflow-hidden transform-gpu' : '';

  const baseButtonClasses = cn(
    'relative inline-flex items-center justify-center',
    'whitespace-nowrap select-none',
    'font-medium',
    'outline-none focus-visible:outline-none',
    'focus-visible:ring-2 focus-visible:ring-offset-2 ring-offset-white',
    'transition-colors',
    'disabled:pointer-events-none disabled:opacity-70'
  );

  const classes = cn(
    baseButtonClasses,
    baseCls,
    paddingCls,
    variantCls,
    shapeCls,
    shadowCls,
    fullWidthCls,
    pressAnimationCls,
    className
  );

  const MotionComponent = useMemo(() => motion.create(Component), [Component]);

  const motionProps: HTMLMotionProps<any> =
    !isDisabled && pressAnimationStyle === 'scale'
      ? {
          whileTap: { scale: SCALE_STRENGTHS[pressAnimationStrength] },
          transition: { duration: SCALE_DURATIONS[pressAnimationDuration] },
        }
      : {};

  const Spinner = loadingComponent || <SpinnerIcon className={cn('animate-spin', spinnerCls)} />;

  const content =
    loading && loadingText ? (
      <>
        {Spinner}
        {loadingText}
      </>
    ) : (
      <>
        {loading ? Spinner : iconStart}
        {children}
        {iconEnd}
      </>
    );

  const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (pressAnimationStyle === 'ripple' && !isDisabled) {
      const button = e.currentTarget;
      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      setRipples((prev) => [...prev, { x, y, size, id: Date.now() }]);
    }
    onPointerDown?.(e);
  };

  const handleClick = (e: MouseEvent<HTMLElement>) => {
    if (isDisabled) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  const handleRippleClear = (id: number) => {
    setRipples((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <MotionComponent
      ref={ref}
      type={Component === 'button' ? type : undefined}
      href={isDisabled ? undefined : href}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading}
      className={classes}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      {...motionProps}
      {...rest}
    >
      {pressAnimationStyle === 'ripple' && (
        <RippleEffect
          ripples={ripples}
          duration={pressAnimationDuration}
          strength={pressAnimationStrength}
          onClear={handleRippleClear}
        />
      )}

      <span className={cn('flex items-center relative z-10', gapCls)}>{content}</span>
    </MotionComponent>
  );
});

ZButton.displayName = 'ZButton';

export default ZButton;
