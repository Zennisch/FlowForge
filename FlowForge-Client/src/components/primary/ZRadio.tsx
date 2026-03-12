'use client'

import { motion, Variants } from "framer-motion"
import { ChangeEvent, forwardRef, InputHTMLAttributes, ReactNode, useId, useRef, useState } from "react"
import { LabelPlacement, Shadow, Size } from "./types/radio"
import { theme } from "./themeConfig"
import { cn } from "./utils"
import { ZHelperText } from "./ZHelperText"

const THEME = {
  colors: {
    primary: theme.colors.primary,
    primaryHover: theme.colors.primaryHover,
    error: theme.colors.error,
    errorLight: theme.colors.errorLight,
    errorText: theme.colors.textPrimary,
    border: theme.colors.border,
    borderHover: theme.colors.borderHover,
    white: theme.colors.surface,
    disabled: "var(--color-bg-disabled)",
    textPrimary: theme.colors.textPrimary,
    textDisabled: theme.colors.textDisabled
  }
} as const

interface RadioSizeConfig {
  radio: string
  dot: string
  text: string
  gap: string
}

const SIZES: Record<Size, RadioSizeConfig> = {
  sm: {
    radio: "h-4 w-4",
    dot: "h-2 w-2",
    text: "text-sm",
    gap: "gap-0.5"
  },
  md: {
    radio: "h-5 w-5",
    dot: "h-2.5 w-2.5",
    text: "text-base",
    gap: "gap-1"
  },
  lg: {
    radio: "h-6 w-6",
    dot: "h-3 w-3",
    text: "text-lg",
    gap: "gap-1.5"
  }
}

const SHADOWS: Record<Shadow, string> = {
  none: "shadow-none",
  sm: "shadow-sm",
  md: "shadow",
  lg: "shadow-lg"
}

const RADIO_VARIANTS: Variants = {
  unchecked: {
    borderColor: THEME.colors.border,
    backgroundColor: "var(--zui-surface)",
    scale: 1
  },
  checked: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.primary,
    scale: 1
  },
  error: {
    borderColor: THEME.colors.error,
    backgroundColor: THEME.colors.errorLight,
    scale: 1
  },
  errorChecked: {
    borderColor: THEME.colors.error,
    backgroundColor: THEME.colors.error,
    scale: 1
  },
  tap: {
    scale: 0.9
  }
}

const DOT_VARIANTS: Variants = {
  unchecked: {
    scale: 0,
    opacity: 0
  },
  checked: {
    scale: 1,
    opacity: 1
  }
}

const PRIMARY_RING = "color-mix(in srgb, var(--color-primary), transparent 60%)"
const ERROR_RING = "color-mix(in srgb, var(--color-error), transparent 60%)"

const FOCUS_RING_STYLE = {
  normal: `0 0 0 2px ${THEME.colors.white}, 0 0 0 4px ${PRIMARY_RING}`,
  error: `0 0 0 2px ${THEME.colors.white}, 0 0 0 4px ${ERROR_RING}`
}

const getVariantState = (checked: boolean, hasError: boolean): "unchecked" | "checked" | "error" | "errorChecked" => {
  if (hasError) {
    return checked ? "errorChecked" : "error"
  }
  return checked ? "checked" : "unchecked"
}

const getDotVariantState = (checked: boolean): "unchecked" | "checked" => {
  return checked ? "checked" : "unchecked"
}

const getFocusRingStyle = (isFocused: boolean, hasError: boolean): string | undefined => {
  if (!isFocused) return undefined
  return hasError ? FOCUS_RING_STYLE.error : FOCUS_RING_STYLE.normal
}

interface ZRadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "onChange"> {
  label?: ReactNode
  labelPlacement?: LabelPlacement

  checked?: boolean

  error?: boolean | string
  helpText?: string

  size?: Size
  shadow?: Shadow

  containerClassName?: string

  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
}

const ZRadio = forwardRef<HTMLInputElement, ZRadioProps>((props, ref) => {
  const {
    label,
    labelPlacement = "right",

    checked,
    defaultChecked,

    error,
    helpText,

    size = "md",
    shadow = "none",

    disabled,
    className,
    containerClassName,
    id,
    value,

    onChange,
    onFocus,
    onBlur,
    ...rest
  } = props

  const inputRef = useRef<HTMLInputElement>(null)
  const generatedId = useId()
  const inputId = id || generatedId
  const errorId = `${inputId}-error`
  const helpId = `${inputId}-help`

  const [internalChecked, setInternalChecked] = useState(defaultChecked ?? false)
  const [isFocused, setIsFocused] = useState(false)

  const isControlled = checked !== undefined
  const isChecked = isControlled ? checked : internalChecked
  const hasError = !!error

  const { radio: radioCls, dot: dotCls, text: textCls, gap: gapCls } = SIZES[size]
  const shadowCls = SHADOWS[shadow]

  const placementCls = labelPlacement === "left" ? "flex-row-reverse justify-end" : "flex-row"
  const disabledCls = disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
  const labelColorCls = hasError ? theme.controlLabelError : theme.controlLabelColor
  const radioBgCls = disabled ? theme.controlDisabledBg : theme.controlBg

  const containerClasses = cn("flex items-center", placementCls, gapCls, containerClassName)

  const labelClasses = cn("select-none font-medium", textCls, disabledCls, labelColorCls)

  const radioClasses = cn(
    "flex items-center justify-center rounded-full border transition-shadow",
    radioCls,
    shadowCls,
    radioBgCls,
    disabledCls,
    className
  )

  const variantState = getVariantState(isChecked, hasError)
  const dotVariantState = getDotVariantState(isChecked)
  const focusRingStyle = getFocusRingStyle(isFocused, hasError)

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (disabled) return
    if (!isControlled) {
      setInternalChecked(e.target.checked)
    }
    onChange?.(e)
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    onFocus?.(e)
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false)
    onBlur?.(e)
  }

  const handleRadioClick = () => {
    inputRef.current?.click()
  }

  return (
    <div className="flex flex-col w-max">
      <div className={containerClasses}>
        <div className="relative flex items-center justify-center">
          <input
            ref={ref || inputRef}
            type="radio"
            id={inputId}
            className="peer sr-only"
            checked={isChecked}
            disabled={disabled}
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            aria-invalid={hasError}
            aria-describedby={error ? errorId : helpText ? helpId : undefined}
            {...rest}
          />

          <motion.div
            className={radioClasses}
            variants={RADIO_VARIANTS}
            initial={false}
            animate={variantState}
            whileTap={!disabled ? "tap" : undefined}
            transition={{ duration: 0.15 }}
            onClick={handleRadioClick}
            style={focusRingStyle ? { boxShadow: focusRingStyle } : undefined}
          >
            <motion.div
              className={cn("bg-white rounded-full pointer-events-none", dotCls)}
              variants={DOT_VARIANTS}
              initial={false}
              animate={dotVariantState}
              transition={{ duration: 0.2, ease: "easeOut" }}
            />
          </motion.div>
        </div>

        {label && (
          <label htmlFor={inputId} className={labelClasses}>
            {label}
          </label>
        )}
      </div>

      <ZHelperText
        error={error}
        helpText={helpText}
        errorId={errorId}
        helpId={helpId}
        textSize="xs"
        defaultErrorMessage="Selection required"
        className={labelPlacement === "left" ? "text-right" : ""}
      />
    </div>
  )
})

ZRadio.displayName = "ZRadio"

export default ZRadio
