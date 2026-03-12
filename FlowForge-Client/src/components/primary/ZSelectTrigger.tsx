'use client'

import { ForwardedRef, forwardRef, KeyboardEvent, MouseEvent, ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { theme } from "./themeConfig"
import { cn } from "./utils"
import { ChevronDownIcon, XMarkIcon } from "./icon"

type Size = "sm" | "md" | "lg" | "xl"
type Shadow = "none" | "sm" | "md" | "lg" | "xl"

interface TriggerSizeConfig {
  height: string
  py: string
  text: string
  padding: string
}

const SIZES: Record<Size, TriggerSizeConfig> = {
  sm: { height: "min-h-9", py: "py-1", text: "text-sm", padding: "pl-3 pr-8" },
  md: { height: "min-h-10", py: "py-2", text: "text-sm", padding: "pl-3 pr-10" },
  lg: { height: "min-h-11", py: "py-2", text: "text-base", padding: "pl-3 pr-10" },
  xl: { height: "min-h-12", py: "py-3", text: "text-lg", padding: "pl-3 pr-12" }
}

const SHADOWS: Record<Shadow, string> = {
  none: "shadow-none",
  sm: "shadow-sm",
  md: "shadow",
  lg: "shadow-lg",
  xl: "shadow-xl"
}

const ANIMATION = {
  tag: {
    duration: 0.1,
    scale: {
      initial: 0.8,
      exit: 0.5,
      normal: 1
    }
  },
  icon: {
    duration: 0.2
  }
} as const

const LAYOUT = {
  trigger: {
    padding: {
      iconStart: "pl-10",
      chevron: "pr-2"
    },
    gap: "gap-1.5"
  },
  tag: {
    padding: "px-2 py-0.5",
    gap: "gap-1",
    marginLeft: "-ml-1"
  },
  icon: {
    chevron: "h-5 w-5",
    remove: "h-3 w-3",
    start: "pl-3"
  },
  placeholder: {
    marginLeft: "ml-1"
  }
} as const

export interface ZSelectTriggerProps<T extends string | number> {
  id?: string
  isOpen: boolean
  disabled?: boolean
  isError?: boolean
  size?: Size
  shadow?: Shadow
  iconStart?: ReactNode
  multiple?: boolean
  placeholder?: string
  className?: string

  selectedValues: T[]
  getLabel: (val: T) => string

  onToggle: () => void
  onRemove: (value: T, e: MouseEvent) => void
  onKeyDown: (e: KeyboardEvent) => void
}

const ZSelectTriggerInner = <T extends string | number>(props: ZSelectTriggerProps<T>, ref: ForwardedRef<HTMLDivElement>) => {
  const {
    id,
    isOpen,
    disabled,
    isError,
    size = "md",
    shadow = "none",
    iconStart,
    multiple,
    placeholder,
    className,
    selectedValues,
    getLabel,
    onToggle,
    onRemove,
    onKeyDown
  } = props

  const config = SIZES[size]

  const triggerClasses = cn(
    "relative w-full cursor-default rounded-md border text-left transition-all",
    "focus:outline-none focus:ring-2 focus:ring-offset-0",
    theme.selectBg,
    disabled
      ? cn("cursor-not-allowed", theme.selectDisabledBg, theme.selectDisabledText, theme.selectDisabledBorder)
      : "cursor-pointer",
    isError
      ? "border-red-300 ring-red-300 focus:ring-red-500 text-red-900"
      : "border-pink-200 dark:border-pink-900 ring-pink-200 dark:ring-pink-900 focus:ring-pink-500 hover:border-pink-300 dark:hover:border-pink-700",
    isOpen && !isError && "ring-2 ring-pink-500 border-pink-500",

    config.height,
    config.py,
    config.text,
    config.padding,
    SHADOWS[shadow],
    iconStart && !multiple ? LAYOUT.trigger.padding.iconStart : "",
    multiple ? cn("h-auto flex flex-wrap items-center", LAYOUT.trigger.gap) : "",
    className
  )

  const renderTriggerContent = () => {
    if (multiple) {
      return (
        <div className={cn("flex flex-wrap w-full", LAYOUT.tag.marginLeft, LAYOUT.trigger.gap)}>
          <AnimatePresence mode="popLayout">
            {selectedValues.map((val) => (
              <motion.span
                layout
                initial={{ opacity: 0, scale: ANIMATION.tag.scale.initial }}
                animate={{ opacity: 1, scale: ANIMATION.tag.scale.normal }}
                exit={{ opacity: 0, scale: ANIMATION.tag.scale.exit }}
                transition={{ duration: ANIMATION.tag.duration }}
                key={val}
                className={cn(
                  "inline-flex items-center rounded text-xs font-medium",
                  theme.selectTag,
                  LAYOUT.tag.gap,
                  LAYOUT.tag.padding
                )}
              >
                {getLabel(val)}
                <button
                  type="button"
                  onClick={(e) => onRemove(val, e)}
                  disabled={disabled}
                  className="hover:text-pink-900 focus:outline-none"
                >
                  <XMarkIcon className={LAYOUT.icon.remove} />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
          {selectedValues.length === 0 && (
            <span className={cn(theme.selectPlaceholder, LAYOUT.placeholder.marginLeft)}>{placeholder}</span>
          )}
        </div>
      )
    }

    const hasValue = selectedValues.length > 0
    return (
      <span className={cn("block truncate", !hasValue && theme.selectPlaceholder)}>
        {hasValue ? getLabel(selectedValues[0]) : placeholder}
      </span>
    )
  }

  return (
    <div
      id={id}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      role="combobox"
      className={triggerClasses}
      onClick={onToggle}
      onKeyDown={onKeyDown}
      ref={ref}
    >
      {iconStart && !multiple && (
        <span
          className={cn(
            "absolute inset-y-0 left-0 flex items-center pointer-events-none",
            theme.selectIconColor,
            LAYOUT.icon.start
          )}
        >
          {iconStart}
        </span>
      )}

      {renderTriggerContent()}

      <span className={cn("absolute inset-y-0 right-0 flex items-center pointer-events-none", LAYOUT.trigger.padding.chevron)}>
        <ChevronDownIcon
          className={cn(
            theme.selectIconColor,
            "transition-transform",
            LAYOUT.icon.chevron,
            `duration-${Math.round(ANIMATION.icon.duration * 1000)}`,
            isOpen && "transform rotate-180"
          )}
        />
      </span>
    </div>
  )
}

export const ZSelectTrigger = forwardRef(ZSelectTriggerInner) as <T extends string | number>(
  props: ZSelectTriggerProps<T> & { ref?: ForwardedRef<HTMLDivElement> }
) => ReturnType<typeof ZSelectTriggerInner>
