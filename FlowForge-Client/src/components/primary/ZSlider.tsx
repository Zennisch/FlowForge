'use client'

import { motion, Transition } from "framer-motion"
import { ChangeEvent, FocusEvent, forwardRef, InputHTMLAttributes, useId, useRef, useState } from "react"
import { LabelPlacement, Shadow, Size } from "./types/slider"
import { cn } from "./utils"
import { ZHelperText } from "./ZHelperText"
import { theme } from "./themeConfig"

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
    track: theme.colors.border,
    trackFill: theme.colors.primary,
    trackFillError: theme.colors.error
  }
} as const

interface SliderSizeConfig {
  trackHeight: string
  thumbSize: number
  text: string
  gap: string
  height: string
}

const SIZES: Record<Size, SliderSizeConfig> = {
  sm: {
    trackHeight: "h-1.5",
    thumbSize: 12,
    text: "text-sm",
    gap: "gap-1",
    height: "h-4"
  },
  md: {
    trackHeight: "h-2",
    thumbSize: 16,
    text: "text-base",
    gap: "gap-1.25",
    height: "h-5"
  },
  lg: {
    trackHeight: "h-3",
    thumbSize: 24,
    text: "text-lg",
    gap: "gap-1.5",
    height: "h-6"
  }
}

const SHADOWS: Record<Shadow, string> = {
  none: "shadow-none",
  sm: "shadow-sm",
  md: "shadow",
  lg: "shadow-lg"
}

const ANIMATION = {
  duration: {
    drag: 0,
    jump: 0.2,
    scale: 0.1,
    shadow: 0.2
  },
  scale: {
    pressed: 1.15,
    focused: 1.05,
    normal: 1
  }
}

const FOCUS_RING_STYLE = {
  normal: `0 0 0 4px color-mix(in srgb, var(--color-primary), transparent 80%)`,
  error: `0 0 0 4px color-mix(in srgb, var(--color-error), transparent 80%)`
}

const DEFAULT_SHADOW = "0 1px 3px 0 rgb(0 0 0 / 0.1)"

const getTrackFillColor = (hasError: boolean): string => {
  return hasError ? THEME.colors.trackFillError : THEME.colors.trackFill
}

const getThumbBorderColor = (hasError: boolean): string => {
  return hasError ? "border-red-600" : "border-pink-600"
}

const getThumbScale = (isPressed: boolean, isFocused: boolean): number => {
  if (isPressed) return ANIMATION.scale.pressed
  if (isFocused) return ANIMATION.scale.focused
  return ANIMATION.scale.normal
}

const getThumbShadow = (isFocused: boolean, hasError: boolean): string => {
  if (!isFocused) return DEFAULT_SHADOW
  return hasError ? FOCUS_RING_STYLE.error : FOCUS_RING_STYLE.normal
}

const getTextColor = (hasError: boolean): string => {
  return hasError ? "text-red-600" : "text-slate-900"
}

const getValueTextColor = (hasError: boolean): string => {
  return hasError ? "text-red-600" : "text-slate-700 dark:text-slate-300"
}

const getHelperTextAlignment = (labelPlacement: LabelPlacement): string => {
  return labelPlacement === "left" ? "text-right" : ""
}

interface ZSliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "onChange" | "value" | "defaultValue"> {
  label?: string
  labelPlacement?: LabelPlacement

  error?: string | boolean
  helpText?: string

  min?: number
  max?: number
  step?: number

  value?: number
  defaultValue?: number

  size?: Size
  shadow?: Shadow
  fullWidth?: boolean
  showValue?: boolean

  valueFormatter?: (value: number) => string
  onChange?: (value: number) => void
  containerClassName?: string
}

const ZSlider = forwardRef<HTMLInputElement, ZSliderProps>((props, ref) => {
  const {
    label,
    labelPlacement = "right",

    min = 0,
    max = 100,
    step = 1,
    value,
    defaultValue,

    error,
    helpText,

    size = "md",
    shadow = "none",
    fullWidth = false,
    showValue = false,
    disabled = false,

    className,
    containerClassName,
    id,

    onChange,
    valueFormatter = (val) => val.toString(),
    onFocus,
    onBlur,
    ...rest
  } = props

  const generatedId = useId()
  const sliderId = id || generatedId
  const errorId = `${sliderId}-error`
  const helpId = `${sliderId}-help`

  const [internalValue, setInternalValue] = useState<number>(defaultValue ?? min)
  const [isDragging, setIsDragging] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isPressed, setIsPressed] = useState(false)
  const isPressedRef = useRef(false)

  const isControlled = value !== undefined
  const currentValue = isControlled ? value : internalValue
  const hasError = !!error

  const sizeConfig = SIZES[size]
  const shadowCls = SHADOWS[shadow]
  const percentage = ((currentValue - min) / (max - min)) * 100

  const placementCls = labelPlacement === "left" ? "flex-row-reverse justify-between" : "flex-row justify-between"
  const disabledCls = disabled ? "opacity-50 cursor-not-allowed" : ""
  const widthCls = fullWidth ? "w-full" : "w-64"

  const containerClasses = cn("flex flex-col relative touch-none", widthCls, disabledCls, sizeConfig.gap, containerClassName)

  const labelClasses = cn("block font-medium leading-6", sizeConfig.text, getTextColor(hasError))

  const trackClasses = cn("absolute w-full rounded-full bg-slate-200 overflow-hidden", sizeConfig.trackHeight)

  const thumbClasses = cn(
    "absolute top-1/2 -translate-y-1/2 bg-white rounded-full border flex items-center justify-center pointer-events-none z-10",
    getThumbBorderColor(hasError),
    shadowCls
  )

  const inputClasses = cn("absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 m-0 p-0 appearance-none")

  const valueTextClasses = cn("text-sm font-medium tabular-nums", getValueTextColor(hasError))

  const helperAlignment = getHelperTextAlignment(labelPlacement)
  const thumbScale = getThumbScale(isPressed, isFocused)
  const thumbShadow = getThumbShadow(isFocused, hasError)
  const trackFillColor = getTrackFillColor(hasError)

  const transitionSettings: Transition = isDragging
    ? { type: "tween", duration: ANIMATION.duration.drag }
    : { type: "tween", ease: "easeOut", duration: ANIMATION.duration.jump }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value)
    if (!isControlled) {
      setInternalValue(newValue)
    }
    onChange?.(newValue)
  }

  const handlePointerDown = () => {
    setIsPressed(true)
    isPressedRef.current = true
  }

  const handlePointerUp = () => {
    setIsPressed(false)
    setIsDragging(false)
    isPressedRef.current = false
  }

  const handlePointerMove = () => {
    if (isPressedRef.current && !isDragging) {
      setIsDragging(true)
    }
  }

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    onFocus?.(e)
  }

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    setIsFocused(false)
    onBlur?.(e)
  }

  return (
    <div className={containerClasses}>
      {label && (
        <div className={cn("flex items-center", placementCls)}>
          <label htmlFor={sliderId} className={labelClasses}>
            {label}
          </label>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className={cn("relative flex items-center select-none flex-1", sizeConfig.height, className)}>
          <div className={trackClasses}>
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: trackFillColor }}
              initial={false}
              animate={{ width: `${percentage}%` }}
              transition={transitionSettings}
            />
          </div>

          <motion.div
            className={thumbClasses}
            style={{
              left: `${percentage}%`,
              width: sizeConfig.thumbSize,
              height: sizeConfig.thumbSize,
              x: "-50%"
            }}
            initial={false}
            animate={{
              scale: thumbScale,
              boxShadow: thumbShadow
            }}
            transition={{
              left: transitionSettings,
              scale: { duration: ANIMATION.duration.scale },
              boxShadow: { duration: ANIMATION.duration.shadow }
            }}
          />

          <input
            ref={ref}
            id={sliderId}
            type="range"
            min={min}
            max={max}
            step={step}
            value={currentValue}
            disabled={disabled}
            onChange={handleChange}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerMove={handlePointerMove}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={inputClasses}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : helpText ? helpId : undefined}
            {...rest}
          />
        </div>
        {showValue && <span className={valueTextClasses}>{valueFormatter(currentValue)}</span>}
      </div>

      <ZHelperText
        error={error}
        helpText={helpText}
        errorId={errorId}
        helpId={helpId}
        textSize="xs"
        defaultErrorMessage="Invalid value"
        className={helperAlignment}
      />
    </div>
  )
})

ZSlider.displayName = "ZSlider"

export default ZSlider
