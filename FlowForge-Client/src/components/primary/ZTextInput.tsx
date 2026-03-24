'use client';

import { motion, useAnimation, Variants } from 'framer-motion';
import {
  ChangeEvent,
  FocusEvent,
  forwardRef,
  InputHTMLAttributes,
  ReactNode,
  Ref,
  TextareaHTMLAttributes,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import { Shadow, Size } from './types/text-input';
import { theme } from './themeConfig';
import { cn } from './utils';
import { ZHelperText } from './ZHelperText';

const THEME = {
  colors: {
    primary: theme.colors.primary,
    primaryRing: 'color-mix(in srgb, var(--color-primary), transparent 80%)',
    error: theme.colors.error,
    errorRing: 'color-mix(in srgb, var(--color-error), transparent 80%)',
    border: theme.colors.border,
    borderHover: theme.colors.borderHover,
    white: theme.colors.surface,
    disabled: 'var(--color-bg-disabled)',
    textPrimary: theme.colors.textPrimary,
    textSecondary: theme.colors.textSecondary,
    textDisabled: theme.colors.textDisabled,
    placeholder: 'var(--color-text-placeholder)',
    icon: theme.colors.textSecondary,
  },
} as const;

interface TextInputSizeConfig {
  text: string;
  padding: string;
  label: string;
  iconPadding: string;
  floatY: number;
  gap: string;
  helperMargin: string;
}

const SIZES: Record<Size, TextInputSizeConfig> = {
  sm: {
    text: 'text-sm',
    padding: 'px-2.5 py-1.5',
    label: 'top-1.5 left-1.5 text-sm',
    iconPadding: '24px',
    floatY: -16,
    gap: 'gap-1.5',
    helperMargin: 'ml-0.5',
  },
  md: {
    text: 'text-base',
    padding: 'px-3 py-2.5',
    label: 'top-2.5 left-2 text-base',
    iconPadding: '28px',
    floatY: -22,
    gap: 'gap-2',
    helperMargin: 'ml-1',
  },
  lg: {
    text: 'text-lg',
    padding: 'px-4 py-3',
    label: 'top-3 left-3 text-lg',
    iconPadding: '32px',
    floatY: -26,
    gap: 'gap-2.5',
    helperMargin: 'ml-1.5',
  },
  xl: {
    text: 'text-xl',
    padding: 'px-5 py-3.5',
    label: 'top-3.5 left-4 text-xl',
    iconPadding: '36px',
    floatY: -28,
    gap: 'gap-3',
    helperMargin: 'ml-2',
  },
};

const SHADOWS: Record<Shadow, string> = {
  none: 'shadow-none',
  sm: 'shadow-sm',
  md: 'shadow',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
};

const SHADOW_VALUES: Record<Shadow, string> = {
  none: '0 0 #0000',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
};

const ANIMATION = {
  labelScale: 0.85,
  labelPadding: '4px',
  ringWidth: '4px',
  shakeDuration: 0.4,
  transitionDuration: 0.2,
  shakeDistance: 4,
};

const LABEL_VARIANTS: Variants = {
  initial: (custom: { paddingStart: string }) => ({
    x: 0,
    y: 0,
    scale: 1,
    paddingLeft: custom.paddingStart,
    color: THEME.colors.textSecondary,
    backgroundColor: 'transparent',
  }),
  float: (custom: { y: number; hasError: boolean; bgColor: string }) => ({
    x: 0,
    y: custom.y,
    scale: ANIMATION.labelScale,
    paddingLeft: ANIMATION.labelPadding,
    backgroundColor: custom.bgColor,
    color: custom.hasError ? THEME.colors.error : THEME.colors.primary,
  }),
};

const BORDER_VARIANTS: Variants = {
  initial: (shadow) => ({
    borderColor: THEME.colors.border,
    boxShadow: shadow,
  }),
  focus: (shadow) => ({
    borderColor: THEME.colors.primary,
    boxShadow: `0px 0px 0px ${ANIMATION.ringWidth} ${THEME.colors.primaryRing}, ${shadow}`,
  }),
  error: (shadow) => ({
    borderColor: THEME.colors.error,
    boxShadow: `0px 0px 0px ${ANIMATION.ringWidth} ${THEME.colors.errorRing}, ${shadow}`,
  }),
  hover: {
    borderColor: THEME.colors.borderHover,
  },
};

const getBorderVariant = (isFocused: boolean, hasError: boolean): 'initial' | 'focus' | 'error' => {
  if (hasError) return 'error';
  if (isFocused) return 'focus';
  return 'initial';
};

const getIconPaddingValue = (hasIcon: boolean, sizeConfig: TextInputSizeConfig): string => {
  return hasIcon ? sizeConfig.iconPadding : ANIMATION.labelPadding;
};

const getInputTextColor = (disabled: boolean): string => {
  return disabled ? theme.inputDisabledText : theme.inputText;
};

const getPlaceholderColor = (): string => {
  return 'placeholder:text-(--color-text-placeholder)';
};

type BaseProps = {
  label?: string;
  error?: string | boolean;
  helpText?: string;

  iconStart?: ReactNode;
  iconEnd?: ReactNode;

  size?: Size;
  shadow?: Shadow;
  fullWidth?: boolean;

  multiline?: boolean;
  rows?: number;

  containerClassName?: string;
};

export type ZTextInputProps = BaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size' | 'onChange' | 'onBlur' | 'onFocus'> & {
    onChange?: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onBlur?: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onFocus?: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  };

const ZTextInput = forwardRef<HTMLInputElement | HTMLTextAreaElement, ZTextInputProps>(
  (props, ref) => {
    const {
      label,
      error,
      helpText,

      iconStart,
      iconEnd,

      size = 'md',
      shadow = 'none',
      fullWidth = false,

      multiline = false,
      rows = 3,

      containerClassName,
      className,
      id,
      value,
      defaultValue,
      disabled,
      placeholder,
      onChange,
      onFocus,
      onBlur,
      ...rest
    } = props;

    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helpId = `${inputId}-help`;

    const [isFocused, setIsFocused] = useState(false);
    const [internalValue, setInternalValue] = useState(defaultValue || '');

    const isControlled = value !== undefined;
    const actualValue = isControlled ? value : internalValue;
    const hasError = !!error;

    const hasValue = actualValue !== '' && actualValue !== null && actualValue !== undefined;
    const shouldFloat = isFocused || hasValue || !!placeholder;

    const controls = useAnimation();

    useEffect(() => {
      if (hasError) {
        const dist = ANIMATION.shakeDistance;
        controls.start({
          x: [0, -dist, dist, -dist, dist, 0],
          transition: { duration: ANIMATION.shakeDuration },
        });
      }
    }, [hasError, controls]);

    const handleFocus = (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!isControlled) {
        setInternalValue(e.target.value);
      }
      onChange?.(e);
    };

    const sizeConfig = SIZES[size];
    const shadowCls = SHADOWS[shadow];
    const shadowValue = SHADOW_VALUES[shadow];

    const borderVariantState = getBorderVariant(isFocused, hasError);
    const iconPaddingValue = getIconPaddingValue(!!iconStart, sizeConfig);

    const widthCls = fullWidth ? 'w-full' : 'max-w-md w-auto';
    const disabledCls = disabled ? 'opacity-50 cursor-not-allowed' : '';
    const disabledBgCls = disabled ? theme.inputDisabledBg : theme.inputBg;

    const containerClasses = cn('relative mt-3 mb-3', widthCls, containerClassName);

    const wrapperClasses = cn(
      'relative flex items-center rounded-lg border',
      disabledBgCls,
      sizeConfig.gap,
      sizeConfig.padding,
      shadowCls,
      disabledCls
    );

    const inputBaseClasses = cn(
      'w-full bg-transparent outline-none disabled:cursor-not-allowed resize-none z-10',
      sizeConfig.text,
      getInputTextColor(!!disabled),
      getPlaceholderColor(),
      className
    );

    const labelClasses = cn(
      'absolute pointer-events-none bg-transparent px-1 font-medium origin-top-left whitespace-nowrap z-20',
      sizeConfig.label
    );

    const iconClasses = cn(
      'shrink-0 flex items-center justify-center relative z-20',
      disabled ? theme.inputIconColorDisabled : theme.inputIconColor
    );

    const labelCustom = useMemo(
      () => ({
        y: sizeConfig.floatY,
        hasError,
        bgColor: 'var(--zui-surface)',
        paddingStart: iconPaddingValue,
      }),
      [sizeConfig.floatY, hasError, iconPaddingValue]
    );

    return (
      <div className={containerClasses}>
        <motion.div animate={controls}>
          <motion.div
            className={wrapperClasses}
            variants={BORDER_VARIANTS}
            initial="initial"
            custom={shadowValue}
            animate={borderVariantState}
            whileHover={!isFocused && !hasError && !disabled ? 'hover' : undefined}
            transition={{ duration: ANIMATION.transitionDuration }}
          >
            {iconStart && <div className={iconClasses}>{iconStart}</div>}

            {multiline ? (
              <textarea
                ref={ref as Ref<HTMLTextAreaElement>}
                id={inputId}
                value={actualValue}
                onChange={handleChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                disabled={disabled}
                placeholder={placeholder}
                rows={rows}
                className={cn(inputBaseClasses, 'block')}
                aria-invalid={hasError}
                aria-describedby={hasError ? errorId : helpText ? helpId : undefined}
                {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
              />
            ) : (
              <input
                ref={ref as Ref<HTMLInputElement>}
                type="text"
                id={inputId}
                value={actualValue}
                onChange={handleChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                disabled={disabled}
                placeholder={placeholder}
                className={inputBaseClasses}
                aria-invalid={hasError}
                aria-describedby={hasError ? errorId : helpText ? helpId : undefined}
                {...(rest as InputHTMLAttributes<HTMLInputElement>)}
              />
            )}

            {iconEnd && <div className={iconClasses}>{iconEnd}</div>}

            {label && (
              <motion.label
                htmlFor={inputId}
                className={labelClasses}
                variants={LABEL_VARIANTS}
                initial="initial"
                animate={shouldFloat ? 'float' : 'initial'}
                custom={labelCustom}
                transition={{ duration: ANIMATION.transitionDuration, ease: 'easeOut' }}
              >
                {label}
              </motion.label>
            )}
          </motion.div>
        </motion.div>

        <ZHelperText
          error={error}
          helpText={helpText}
          errorId={errorId}
          helpId={helpId}
          className={sizeConfig.helperMargin}
        />
      </div>
    );
  }
);

ZTextInput.displayName = 'ZTextInput';

export default ZTextInput;
