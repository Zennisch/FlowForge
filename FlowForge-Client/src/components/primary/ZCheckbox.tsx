'use client'

import { AnimatePresence, motion, Variants } from "framer-motion"
import { ChangeEvent, forwardRef, InputHTMLAttributes, ReactNode, useEffect, useId, useRef, useState } from "react"
import { LabelPlacement, Shadow, Size } from "./types/checkbox"
import { theme } from "./themeConfig"
import { cn } from "./utils"
import { ZHelperText } from "./ZHelperText"
import { AnimatedCheckIcon, AnimatedIndeterminateIcon } from "./icon"

const THEME = {
  colors: {
    primary: theme.colors.primary,
    primaryHover: theme.colors.primaryHover,
    error: theme.colors.error,
    errorLight: theme.colors.errorLight,
    border: theme.colors.border,
    borderHover: theme.colors.borderHover,
    white: "var(--zui-surface)",
    disabled: "var(--color-text-disabled)",
    textPrimary: theme.colors.textPrimary,
    textDisabled: theme.colors.textDisabled
  }
} as const

interface CheckboxSizeConfig {
  box: string
  text: string
  gap: string
}

const SIZES: Record<Size, CheckboxSizeConfig> = {
  sm: {
    box: "h-4 w-4 rounded",
    text: "text-sm",
    gap: "gap-1"
  },
  md: {
    box: "h-5 w-5 rounded",
    text: "text-base",
    gap: "gap-1.5"
  },
  lg: {
    box: "h-6 w-6 rounded",
    text: "text-lg",
    gap: "gap-2"
  }
}

const SHADOWS: Record<Shadow, string> = {
  none: "shadow-none",
  sm: "shadow-sm",
  md: "shadow",
  lg: "shadow-lg"
}

const BOX_VARIANTS: Variants = {
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

const PRIMARY_RING = "color-mix(in srgb, var(--color-primary), transparent 60%)"
const ERROR_RING = "color-mix(in srgb, var(--color-error), transparent 60%)"

const FOCUS_RING_STYLE = {
  normal: `0 0 0 2px ${THEME.colors.white}, 0 0 0 4px ${PRIMARY_RING}`,
  error: `0 0 0 2px ${THEME.colors.white}, 0 0 0 4px ${ERROR_RING}`
}

const getVariantState = (
  checked: boolean,
  indeterminate: boolean,
  hasError: boolean
): "unchecked" | "checked" | "error" | "errorChecked" => {
  if (hasError) {
    return checked || indeterminate ? "errorChecked" : "error"
  }
  return checked || indeterminate ? "checked" : "unchecked"
}

const getFocusRingStyle = (isFocused: boolean, hasError: boolean): string | undefined => {
  if (!isFocused) return undefined
  return hasError ? FOCUS_RING_STYLE.error : FOCUS_RING_STYLE.normal
}

interface ZCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "onChange"> {
  label?: ReactNode
  labelPlacement?: LabelPlacement

  checked?: boolean
  indeterminate?: boolean

  error?: boolean | string
  helpText?: string

  size?: Size
  shadow?: Shadow

  containerClassName?: string

  onChange?: (checked: boolean, event: ChangeEvent<HTMLInputElement>) => void
}

const ZCheckbox = forwardRef<HTMLInputElement, ZCheckboxProps>((props, ref) => {
  const {
    label,
    labelPlacement = "right",

    checked,
    defaultChecked,
    indeterminate = false,

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

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  const { box: boxCls, text: textCls, gap: gapCls } = SIZES[size]
  const shadowCls = SHADOWS[shadow]

  const placementCls = labelPlacement === "left" ? "flex-row-reverse" : "flex-row"
  const disabledCls = disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
  const labelColorCls = hasError ? theme.controlLabelError : theme.controlLabelColor
  const boxBgCls = disabled ? theme.controlDisabledBg : theme.controlBg

  const containerClasses = cn("relative inline-flex items-center", placementCls, gapCls, containerClassName)

  const labelClasses = cn("select-none font-medium", textCls, disabledCls, labelColorCls)

  const boxClasses = cn(
    "flex items-center justify-center border transition-shadow",
    boxCls,
    shadowCls,
    boxBgCls,
    disabledCls,
    className
  )

  const variantState = getVariantState(isChecked, indeterminate, hasError)
  const focusRingStyle = getFocusRingStyle(isFocused, hasError)

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (disabled) return
    if (!isControlled) {
      setInternalChecked(e.target.checked)
    }
    onChange?.(e.target.checked, e)
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    onFocus?.(e)
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false)
    onBlur?.(e)
  }

  const handleBoxClick = () => {
    inputRef.current?.click()
  }

  return (
    <div className="flex flex-col">
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
            className={boxClasses}
            variants={BOX_VARIANTS}
            initial={false}
            animate={variantState}
            whileTap={!disabled ? "tap" : undefined}
            transition={{ duration: 0.15 }}
            onClick={handleBoxClick}
            style={focusRingStyle ? { boxShadow: focusRingStyle } : undefined}
          >
            <AnimatePresence mode="wait">
              {indeterminate ? (
                <AnimatedIndeterminateIcon key="indeterminate" className="text-white" />
              ) : isChecked ? (
                <AnimatedCheckIcon key="checked" className="text-white" />
              ) : null}
            </AnimatePresence>
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

ZCheckbox.displayName = "ZCheckbox"

export default ZCheckbox
