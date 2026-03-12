'use client'

import { motion, Variants } from "framer-motion"
import { ChangeEvent, forwardRef, InputHTMLAttributes, ReactNode, useId, useRef, useState } from "react"
import { cn } from "./utils"
import { theme } from "./themeConfig"
import { ZHelperText } from "./ZHelperText"
import { LabelPlacement, Shadow, Size } from "./types/switch"

const THEME = {
  colors: {
    primary: theme.colors.primary,
    primaryHover: theme.colors.primaryHover,
    error: theme.colors.error,
    errorLight: theme.colors.errorLight,
    border: theme.colors.border,
    borderHover: theme.colors.borderHover,
    white: theme.colors.surface,
    disabled: "var(--color-bg-disabled)",
    textPrimary: theme.colors.textPrimary,
    textDisabled: theme.colors.textDisabled,
    unchecked: theme.colors.border
  }
} as const

interface SwitchSizeConfig {
  track: string
  thumb: string
  label: string
  gap: string
}

const SIZES: Record<Size, SwitchSizeConfig> = {
  sm: {
    track: "w-7 h-4",
    thumb: "w-3 h-3",
    label: "text-sm",
    gap: "gap-1"
  },
  md: {
    track: "w-11 h-6",
    thumb: "w-5 h-5",
    label: "text-base",
    gap: "gap-1.5"
  },
  lg: {
    track: "w-14 h-7",
    thumb: "w-6 h-6",
    label: "text-lg",
    gap: "gap-2"
  }
}

const SHADOWS: Record<Shadow, string> = {
  none: "shadow-none",
  sm: "shadow-sm",
  md: "shadow",
  lg: "shadow-lg"
}

const ANIMATION = {
  duration: 0.2,
  ease: "easeOut" as const,
  type: "tween" as const
}

const THUMB_TRANSLATE_X: Record<Size, number> = {
  sm: 12,
  md: 20,
  lg: 28
}

const TRACK_VARIANTS: Variants = {
  unchecked: {
    backgroundColor: THEME.colors.unchecked
  },
  checked: {
    backgroundColor: THEME.colors.primary
  },
  error: {
    backgroundColor: THEME.colors.unchecked
  },
  errorChecked: {
    backgroundColor: THEME.colors.error
  },
  tap: {
    scale: 0.98
  }
}

const THUMB_VARIANTS = (translateX: number): Variants => ({
  unchecked: {
    x: 0
  },
  checked: {
    x: translateX
  }
})

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

const getThumbVariantState = (checked: boolean): "checked" | "unchecked" => {
  return checked ? "checked" : "unchecked"
}

const getFocusRingStyle = (isFocused: boolean, hasError: boolean): string | undefined => {
  if (!isFocused) return undefined
  return hasError ? FOCUS_RING_STYLE.error : FOCUS_RING_STYLE.normal
}

const getHelperTextAlignment = (labelPlacement: LabelPlacement): string => {
  return labelPlacement === "left" ? "text-right" : ""
}

export interface ZSwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "onChange"> {
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

const ZSwitch = forwardRef<HTMLInputElement, ZSwitchProps>((props, ref) => {
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

  const sizeConfig = SIZES[size]
  const shadowCls = SHADOWS[shadow]
  const translateX = THUMB_TRANSLATE_X[size]

  const placementCls = labelPlacement === "left" ? "flex-row-reverse" : "flex-row"
  const disabledCls = disabled ? "opacity-50 cursor-not-allowed" : ""
  const labelColorCls = hasError ? theme.controlLabelError : theme.controlLabelColorSwitch

  const containerClasses = cn("inline-flex items-center align-middle", placementCls, sizeConfig.gap, containerClassName)

  const trackClasses = cn(
    "relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent",
    "focus:outline-none transition-shadow",
    sizeConfig.track,
    shadowCls,
    className
  )

  const thumbClasses = cn("pointer-events-none inline-block rounded-full bg-white shadow-sm ring-0", sizeConfig.thumb)

  const labelClasses = cn(
    "select-none cursor-pointer font-medium",
    sizeConfig.label,
    disabled && "cursor-not-allowed",
    labelColorCls
  )

  const variantState = getVariantState(isChecked, hasError)
  const thumbVariantState = getThumbVariantState(isChecked)
  const focusRingStyle = getFocusRingStyle(isFocused, hasError)
  const helperAlignment = getHelperTextAlignment(labelPlacement)

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

  const handleTrackClick = () => {
    if (disabled) return
    const input = ref && typeof ref !== "function" ? ref.current : inputRef.current
    input?.click()
  }

  return (
    <div className={cn("flex flex-col", disabledCls)}>
      <div className={containerClasses}>
        <div className="relative flex items-center">
          <input
            ref={ref || inputRef}
            type="checkbox"
            id={inputId}
            className="peer sr-only"
            checked={isChecked}
            disabled={disabled}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            aria-invalid={hasError}
            aria-describedby={error ? errorId : helpText ? helpId : undefined}
            {...rest}
          />

          <motion.div
            className={trackClasses}
            variants={TRACK_VARIANTS}
            initial={false}
            animate={variantState}
            whileTap={!disabled ? "tap" : undefined}
            transition={ANIMATION}
            onClick={handleTrackClick}
            style={{ boxShadow: focusRingStyle }}
          >
            <span className="sr-only">{label || "Switch"}</span>

            <motion.span
              className={thumbClasses}
              variants={THUMB_VARIANTS(translateX)}
              initial={false}
              animate={thumbVariantState}
              transition={ANIMATION}
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
        className={helperAlignment}
      />
    </div>
  )
})

ZSwitch.displayName = "ZSwitch"

export default ZSwitch
