'use client';

import { AnimatePresence, HTMLMotionProps, motion, useAnimation, Variants } from 'framer-motion';
import { forwardRef, MouseEvent, ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Position, Shadow, Size } from './types/modal';
import { theme } from './themeConfig';
import { cn } from './utils';
import { ZHelperText } from './ZHelperText';
import { SpinnerIcon, XMarkIcon } from './icon';

const THEME = {
  colors: {
    primary: theme.colors.primary,
    error: theme.colors.error,
    errorLight: theme.colors.errorLight,
    overlay: 'var(--color-overlay-modal)',
    white: theme.colors.surface,
    border: theme.colors.border,
    textPrimary: theme.colors.textPrimary,
    textSecondary: theme.colors.textSecondary,
    disabled: 'var(--color-bg-disabled)',
  },
  backdrop: 'bg-[var(--color-overlay-modal)] backdrop-blur-sm',
  container: theme.modalContainer,
  header: {
    border: theme.modalHeaderBorder,
    text: theme.modalHeaderText,
  },
  footer: {
    border: theme.modalFooterBorder,
    bg: theme.modalFooterBg,
  },
  loading: theme.modalLoading,
  closeButton: theme.modalCloseButton,
};

const SIZES: Record<Size, string> = {
  sm: 'w-full max-w-sm',
  md: 'w-full max-w-md',
  lg: 'w-full max-w-lg',
  xl: 'w-full max-w-xl',
  '2xl': 'w-full max-w-2xl',
  '3xl': 'w-full max-w-3xl',
  '4xl': 'w-full max-w-4xl',
  full: 'w-full max-w-[calc(100vw-2rem)]',
};

const SHADOWS: Record<Shadow, string> = {
  none: 'shadow-none',
  sm: 'shadow-sm',
  md: 'shadow',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
  '2xl': 'shadow-2xl',
};

const LAYOUT = {
  padding: {
    overlay: 'p-4',
    header: 'px-6 py-4',
    body: 'p-6',
    footer: 'px-6 py-4',
  },
  rounded: {
    container: 'rounded-xl',
    footer: 'rounded-b-xl',
  },
  button: {
    size: 'h-8 w-8',
    iconSize: 'h-5 w-5',
    marginHeader: '-mr-2',
    positionAbsolute: 'right-4 top-4',
  },
  gap: 'gap-3',
} as const;

const ANIMATION = {
  overlay: {
    duration: 0.2,
    exitDuration: 0.15,
    exitDelay: 0.1,
  },
  modal: {
    scaleHidden: 0.95,
    yHiddenTop: -20,
    yHiddenCenter: 10,
    spring: {
      type: 'spring' as const,
      damping: 25,
      stiffness: 300,
      duration: 0.3,
    },
    exitDuration: 0.15,
  },
  content: {
    xOffset: 10,
    duration: 0.2,
    exitDuration: 0.15,
  },
  shake: {
    xOffset: 6,
    duration: 0.3,
  },
} as const;

const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: ANIMATION.overlay.duration },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: ANIMATION.overlay.exitDuration,
      delay: ANIMATION.overlay.exitDelay,
    },
  },
};

const modalVariants: Variants = {
  hidden: (position: Position) => ({
    opacity: 0,
    scale: ANIMATION.modal.scaleHidden,
    y: position === 'top' ? ANIMATION.modal.yHiddenTop : ANIMATION.modal.yHiddenCenter,
  }),
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: ANIMATION.modal.spring.type,
      damping: ANIMATION.modal.spring.damping,
      stiffness: ANIMATION.modal.spring.stiffness,
      duration: ANIMATION.modal.spring.duration,
    },
  },
  exit: {
    opacity: 0,
    scale: ANIMATION.modal.scaleHidden,
    y: ANIMATION.modal.yHiddenCenter,
    transition: { duration: ANIMATION.modal.exitDuration },
  },
};

const contentVariants: Variants = {
  initial: {
    opacity: 0,
    x: ANIMATION.content.xOffset,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: ANIMATION.content.duration,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    x: -ANIMATION.content.xOffset,
    transition: {
      duration: ANIMATION.content.exitDuration,
      ease: 'easeIn',
    },
  },
};

export interface ZModalProps extends HTMLMotionProps<'div'> {
  isOpen: boolean;
  onClose: () => void;

  header?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;

  error?: string | boolean;
  helpText?: string;

  size?: Size;
  position?: Position;
  shadow?: Shadow;
  fullWidth?: boolean;

  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  loading?: boolean | ReactNode;

  stepKey?: string | number;
  attentionTrigger?: number;

  overlayClassName?: string;
  containerClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  helperClassName?: string;
}

const ZModal = forwardRef<HTMLDivElement, ZModalProps>((props, ref) => {
  const {
    isOpen,
    onClose,

    header,
    footer,
    children,

    error,
    helpText,

    size = 'md',
    position = 'center',
    shadow = 'xl',
    fullWidth = false,

    showCloseButton = true,
    closeOnBackdropClick = true,
    closeOnEscape = true,
    loading = false,

    stepKey,
    attentionTrigger = 0,

    overlayClassName,
    containerClassName,
    headerClassName,
    bodyClassName,
    footerClassName,
    helperClassName,
    className,
    id,
    ...rest
  } = props;

  const generatedId = useId();
  const modalId = id || generatedId;
  const errorId = `${modalId}-error`;
  const helpId = `${modalId}-help`;

  const [mounted, setMounted] = useState(false);
  const controls = useAnimation();
  const isFirstRender = useRef(true);

  const hasError = !!error;
  const hasLoading = !!loading;
  const sizeCls = SIZES[size];
  const shadowCls = SHADOWS[shadow];

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (isOpen && closeOnEscape && e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (attentionTrigger > 0 && isOpen) {
      const x = ANIMATION.shake.xOffset;
      controls.start({
        x: [0, -x, x, -x, x, 0],
        transition: {
          type: 'tween',
          duration: ANIMATION.shake.duration,
        },
      });
    }
  }, [attentionTrigger, controls, isOpen]);

  const handleBackdropClick = (e: MouseEvent) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  const widthCls = fullWidth ? 'w-full' : 'w-auto';
  const loadingIsCustom = typeof loading !== 'boolean';

  const overlayClasses = cn(
    'fixed inset-0 z-50 grid place-items-center overflow-y-auto overflow-x-hidden',
    LAYOUT.padding.overlay,
    position === 'top' ? 'items-start pt-16' : '',
    overlayClassName
  );

  const containerClasses = cn(
    'relative text-left',
    widthCls,
    sizeCls,
    THEME.container,
    LAYOUT.rounded.container,
    shadowCls,
    containerClassName,
    className
  );

  const headerClasses = cn(
    'flex items-center justify-between',
    THEME.header.border,
    LAYOUT.padding.header,
    headerClassName
  );

  const bodyClasses = cn(LAYOUT.padding.body, bodyClassName);

  const footerClasses = cn(
    'flex items-center justify-end',
    LAYOUT.gap,
    THEME.footer.border,
    THEME.footer.bg,
    LAYOUT.padding.footer,
    LAYOUT.rounded.footer,
    footerClassName
  );

  const loadingClasses = cn(
    'absolute inset-0 z-20 flex items-center justify-center',
    LAYOUT.rounded.container,
    THEME.loading
  );

  const closeButtonClasses = cn(
    'inline-flex items-center justify-center rounded-md',
    LAYOUT.button.size,
    THEME.closeButton
  );

  const closeButtonAbsoluteClasses = cn(
    closeButtonClasses,
    'absolute z-10',
    LAYOUT.button.positionAbsolute
  );

  if (!mounted) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div
          className={overlayClasses}
          aria-modal="true"
          role="dialog"
          aria-labelledby={header ? `${modalId}-title` : undefined}
          aria-describedby={hasError ? errorId : helpText ? helpId : undefined}
          onClick={handleBackdropClick}
        >
          <motion.div
            className={cn('fixed inset-0 -z-10', THEME.backdrop)}
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          />

          <motion.div
            ref={ref}
            id={modalId}
            custom={position}
            variants={modalVariants}
            initial="hidden"
            animate={controls}
            whileInView="visible"
            exit="exit"
            className={containerClasses}
            onClick={(e) => e.stopPropagation()}
            {...rest}
          >
            <AnimatePresence>
              {hasLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={loadingClasses}
                >
                  {loadingIsCustom ? (
                    loading
                  ) : (
                    <SpinnerIcon className="h-8 w-8 animate-spin text-indigo-600" />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {header && (
              <div className={headerClasses}>
                <div
                  id={`${modalId}-title`}
                  className={cn('text-lg font-semibold leading-6', THEME.header.text)}
                >
                  {header}
                </div>
                {showCloseButton && !hasLoading && (
                  <button
                    type="button"
                    className={cn(closeButtonClasses, LAYOUT.button.marginHeader)}
                    onClick={onClose}
                    aria-label="Close modal"
                  >
                    <XMarkIcon className={LAYOUT.button.iconSize} />
                  </button>
                )}
              </div>
            )}

            {!header && showCloseButton && !hasLoading && (
              <button
                type="button"
                className={closeButtonAbsoluteClasses}
                onClick={onClose}
                aria-label="Close modal"
              >
                <XMarkIcon className={LAYOUT.button.iconSize} />
              </button>
            )}

            <div className={bodyClasses}>
              {stepKey !== undefined ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={stepKey}
                    variants={contentVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    {children}
                  </motion.div>
                </AnimatePresence>
              ) : (
                children
              )}

              {(error || helpText) && (
                <ZHelperText
                  error={error}
                  helpText={helpText}
                  errorId={errorId}
                  helpId={helpId}
                  textSize="sm"
                  defaultErrorMessage="Please review the form"
                  className={cn('mt-4', helperClassName)}
                />
              )}
            </div>

            {footer && <div className={footerClasses}>{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
});

ZModal.displayName = 'ZModal';

export default ZModal;
