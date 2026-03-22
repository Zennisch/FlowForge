'use client';

import { HTMLMotionProps, motion } from 'framer-motion';
import { ElementType, forwardRef, ReactNode, useMemo } from 'react';
import {
  TextAlign,
  TextColor,
  TextElement,
  TextSize,
  TextTransform,
  TextVariant,
  TextWeight,
} from './types/text';
import { cn } from './utils';

const TEXT_COLORS = {
  default: 'text-[var(--color-text-primary)]',
  primary: 'text-[var(--color-primary)]',
  secondary: 'text-[var(--color-text-secondary)]',
  success: 'text-[var(--color-success)]',
  warning: 'text-[var(--color-warning)]',
  error: 'text-[var(--color-error)]',
  muted: 'text-[var(--color-text-disabled)]',
} as const;

interface SizeConfig {
  fontSize: string;
  lineHeight: string;
  letterSpacing: string;
}

const VARIANTS: Record<TextVariant, Partial<Record<TextSize, SizeConfig>>> = {
  heading: {
    xs: {
      fontSize: 'text-xl',
      lineHeight: 'leading-7',
      letterSpacing: 'tracking-tight',
    },
    sm: {
      fontSize: 'text-2xl',
      lineHeight: 'leading-8',
      letterSpacing: 'tracking-tight',
    },
    md: {
      fontSize: 'text-3xl',
      lineHeight: 'leading-9',
      letterSpacing: 'tracking-tight',
    },
    lg: {
      fontSize: 'text-4xl',
      lineHeight: 'leading-10',
      letterSpacing: 'tracking-tight',
    },
    xl: {
      fontSize: 'text-5xl',
      lineHeight: 'leading-none',
      letterSpacing: 'tracking-tight',
    },
    '2xl': {
      fontSize: 'text-6xl',
      lineHeight: 'leading-none',
      letterSpacing: 'tracking-tight',
    },
    '3xl': {
      fontSize: 'text-7xl',
      lineHeight: 'leading-none',
      letterSpacing: 'tracking-tight',
    },
  },
  subheading: {
    xs: {
      fontSize: 'text-base',
      lineHeight: 'leading-6',
      letterSpacing: 'tracking-normal',
    },
    sm: {
      fontSize: 'text-lg',
      lineHeight: 'leading-7',
      letterSpacing: 'tracking-normal',
    },
    md: {
      fontSize: 'text-xl',
      lineHeight: 'leading-7',
      letterSpacing: 'tracking-normal',
    },
    lg: {
      fontSize: 'text-2xl',
      lineHeight: 'leading-8',
      letterSpacing: 'tracking-normal',
    },
    xl: {
      fontSize: 'text-3xl',
      lineHeight: 'leading-9',
      letterSpacing: 'tracking-normal',
    },
    '2xl': {
      fontSize: 'text-4xl',
      lineHeight: 'leading-10',
      letterSpacing: 'tracking-normal',
    },
    '3xl': {
      fontSize: 'text-5xl',
      lineHeight: 'leading-none',
      letterSpacing: 'tracking-normal',
    },
  },
  body: {
    xs: {
      fontSize: 'text-xs',
      lineHeight: 'leading-4',
      letterSpacing: 'tracking-normal',
    },
    sm: {
      fontSize: 'text-sm',
      lineHeight: 'leading-5',
      letterSpacing: 'tracking-normal',
    },
    md: {
      fontSize: 'text-base',
      lineHeight: 'leading-6',
      letterSpacing: 'tracking-normal',
    },
    lg: {
      fontSize: 'text-lg',
      lineHeight: 'leading-7',
      letterSpacing: 'tracking-normal',
    },
    xl: {
      fontSize: 'text-xl',
      lineHeight: 'leading-7',
      letterSpacing: 'tracking-normal',
    },
  },
  caption: {
    xs: {
      fontSize: 'text-xs',
      lineHeight: 'leading-4',
      letterSpacing: 'tracking-wide',
    },
    sm: {
      fontSize: 'text-sm',
      lineHeight: 'leading-5',
      letterSpacing: 'tracking-wide',
    },
    md: {
      fontSize: 'text-base',
      lineHeight: 'leading-6',
      letterSpacing: 'tracking-wide',
    },
  },
  label: {
    xs: {
      fontSize: 'text-xs',
      lineHeight: 'leading-4',
      letterSpacing: 'tracking-wide',
    },
    sm: {
      fontSize: 'text-sm',
      lineHeight: 'leading-5',
      letterSpacing: 'tracking-wide',
    },
    md: {
      fontSize: 'text-base',
      lineHeight: 'leading-6',
      letterSpacing: 'tracking-wide',
    },
  },
  overline: {
    xs: {
      fontSize: 'text-xs',
      lineHeight: 'leading-4',
      letterSpacing: 'tracking-widest',
    },
    sm: {
      fontSize: 'text-sm',
      lineHeight: 'leading-5',
      letterSpacing: 'tracking-widest',
    },
    md: {
      fontSize: 'text-base',
      lineHeight: 'leading-6',
      letterSpacing: 'tracking-widest',
    },
  },
};

const WEIGHTS: Record<TextWeight, string> = {
  light: 'font-light',
  regular: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
  extrabold: 'font-extrabold',
};

const ALIGNS: Record<TextAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
  justify: 'text-justify',
};

const TRANSFORMS: Record<TextTransform, string> = {
  none: 'normal-case',
  uppercase: 'uppercase',
  lowercase: 'lowercase',
  capitalize: 'capitalize',
};

const DEFAULT_ELEMENTS: Record<TextVariant, TextElement> = {
  heading: 'h2',
  subheading: 'h3',
  body: 'p',
  caption: 'span',
  label: 'label',
  overline: 'span',
};

const DEFAULT_WEIGHTS: Record<TextVariant, TextWeight> = {
  heading: 'bold',
  subheading: 'semibold',
  body: 'regular',
  caption: 'regular',
  label: 'medium',
  overline: 'medium',
};

type P = Omit<HTMLMotionProps<'div'>, 'color'>;

interface ZTextProps extends P {
  as?: TextElement | ElementType;
  children?: ReactNode;

  variant?: TextVariant;
  size?: TextSize;
  weight?: TextWeight;
  color?: TextColor;

  align?: TextAlign;
  transform?: TextTransform;

  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;

  truncate?: boolean | number;
  noWrap?: boolean;

  htmlFor?: string;
}

const ZText = forwardRef<HTMLElement, ZTextProps>((props, ref) => {
  const {
    as,
    children,

    variant = 'body',
    size = 'md',
    weight,
    color = 'default',

    align = 'left',
    transform = 'none',

    italic = false,
    underline = false,
    strikethrough = false,

    truncate = false,
    noWrap = false,

    className,
    htmlFor,
    ...rest
  } = props;

  const Component = as || DEFAULT_ELEMENTS[variant];
  const actualWeight = weight || DEFAULT_WEIGHTS[variant];

  const variantConfig = VARIANTS[variant]?.[size];
  const fontSizeCls = variantConfig?.fontSize || VARIANTS.body.md?.fontSize || 'text-base';
  const lineHeightCls = variantConfig?.lineHeight || VARIANTS.body.md?.lineHeight || 'leading-6';
  const letterSpacingCls =
    variantConfig?.letterSpacing || VARIANTS.body.md?.letterSpacing || 'tracking-normal';

  const colorCls = TEXT_COLORS[color];
  const weightCls = WEIGHTS[actualWeight];
  const alignCls = ALIGNS[align];
  const transformCls = TRANSFORMS[transform];

  const italicCls = italic ? 'italic' : '';
  const underlineCls = underline ? 'underline' : '';
  const strikethroughCls = strikethrough ? 'line-through' : '';
  const noWrapCls = noWrap ? 'whitespace-nowrap' : '';

  const truncateCls = (() => {
    if (truncate === true) return 'truncate';
    if (truncate === 1) return 'line-clamp-1';
    if (truncate === 2) return 'line-clamp-2';
    if (truncate === 3) return 'line-clamp-3';
    if (truncate === 4) return 'line-clamp-4';
    if (truncate === 5) return 'line-clamp-5';
    if (truncate === 6) return 'line-clamp-6';
    return '';
  })();

  const MotionComponent = useMemo(() => motion.create(Component), [Component]);

  const classes = cn(
    fontSizeCls,
    lineHeightCls,
    letterSpacingCls,
    colorCls,
    weightCls,
    alignCls,
    transformCls,
    italicCls,
    underlineCls,
    strikethroughCls,
    truncateCls,
    noWrapCls,
    className
  );

  return (
    <MotionComponent ref={ref} htmlFor={htmlFor} className={classes} {...rest}>
      {children}
    </MotionComponent>
  );
});

ZText.displayName = 'ZText';

export default ZText;
