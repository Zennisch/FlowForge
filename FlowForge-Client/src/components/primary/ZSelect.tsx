'use client'

import { HTMLMotionProps, motion } from "framer-motion"
import {
  ForwardedRef,
  forwardRef,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react"
import { LabelPlacement, Shadow, Size } from "./types/select"
import { theme } from "./themeConfig"
import { cn } from "./utils"
import { ZHelperText } from "./ZHelperText"
import { ZSelectList } from "./ZSelectList"
import { ZSelectTrigger } from "./ZSelectTrigger"

export interface ZSelectItem<T extends string | number> {
  label: string
  value: T
  disabled?: boolean
  icon?: ReactNode
}

const LAYOUT = {
  dropdown: {
    offset: 8,
    defaultWidth: "w-64",
    labelMinWidth: "min-w-[120px]",
    helperMarginLeft: "ml-34"
  },
  gap: {
    top: "gap-1.5",
    left: "gap-4"
  }
} as const

const getSelectedValuesArray = <T,>(value: T | T[] | undefined): T[] => {
  if (Array.isArray(value)) return value
  if (value !== undefined) return [value]
  return []
}

const getOptionLabel = <T extends string | number>(options: ZSelectItem<T>[], value: T): string => {
  return options.find((o) => o.value === value)?.label || String(value)
}

const getLabelTextColor = (hasError: boolean, disabled: boolean): string => {
  if (hasError) return theme.controlLabelError
  if (disabled) return theme.textDisabled
  return theme.textPrimary
}

interface ZSelectProps<T extends string | number> extends Omit<HTMLMotionProps<"div">, "onChange" | "defaultValue" | "value"> {
  label?: string
  labelPlacement?: LabelPlacement

  options?: ZSelectItem<T>[]
  value?: T | T[]
  defaultValue?: T | T[]
  placeholder?: string

  error?: string | boolean
  helpText?: string

  iconStart?: ReactNode

  size?: Size
  shadow?: Shadow
  fullWidth?: boolean

  searchable?: boolean
  multiple?: boolean
  isLoading?: boolean

  containerClassName?: string
  disabled?: boolean

  onChange?: (value: T | T[]) => void
  onSearchChange?: (query: string) => void
}

const ZSelectComponent = <T extends string | number>(props: ZSelectProps<T>, ref: ForwardedRef<HTMLDivElement>) => {
  const {
    label,
    labelPlacement = "top",

    options = [],
    value,
    defaultValue,
    placeholder = "Select an option",

    error,
    helpText,

    iconStart,

    size = "md",
    shadow = "none",
    fullWidth = false,

    searchable = false,
    multiple = false,
    isLoading = false,

    className,
    containerClassName,
    id,
    disabled,

    onChange,
    onSearchChange,
    ...rest
  } = props

  const generatedId = useId()
  const selectId = id || generatedId
  const errorId = `${selectId}-error`
  const helpId = `${selectId}-help`

  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [focusedIndex, setFocusedIndex] = useState(-1)

  const [internalValue, setInternalValue] = useState<T | T[] | undefined>(
    defaultValue !== undefined ? defaultValue : multiple ? [] : undefined
  )
  const isControlled = value !== undefined
  const currentValue = isControlled ? value : internalValue

  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [coords, setCoords] = useState({ left: 0, top: 0, width: 0 })

  const isError = !!error

  useImperativeHandle(ref, () => containerRef.current as HTMLDivElement)

  useEffect(() => {
    if (!isOpen) return

    const updatePosition = () => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        setCoords({
          left: rect.left,
          top: rect.bottom + LAYOUT.dropdown.offset,
          width: rect.width
        })
      }
    }

    updatePosition()
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        listRef.current &&
        !listRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
        setSearchQuery("")
        setFocusedIndex(-1)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(0)
    }
  }, [isOpen])

  const selectedValues = useMemo(() => getSelectedValuesArray(currentValue), [currentValue])

  const handleSelect = (optionValue: T) => {
    if (multiple) {
      let newValue: T[] = []
      const currentArray = (Array.isArray(currentValue) ? currentValue : []) as T[]

      if (currentArray.includes(optionValue)) {
        newValue = currentArray.filter((v) => v !== optionValue)
      } else {
        newValue = [...currentArray, optionValue]
      }

      if (!isControlled) {
        setInternalValue(newValue)
      }
      onChange?.(newValue)
    } else {
      if (!isControlled) {
        setInternalValue(optionValue)
      }
      onChange?.(optionValue)
      setIsOpen(false)
      setSearchQuery("")
    }
  }

  const removeValue = (valToRemove: T, e: MouseEvent) => {
    e.stopPropagation()
    if (multiple && Array.isArray(currentValue)) {
      const currentArray = currentValue as T[]
      const newValue = currentArray.filter((v) => v !== valToRemove)
      if (!isControlled) {
        setInternalValue(newValue)
      }
      onChange?.(newValue)
    }
  }

  const filteredOptions = useMemo(() => {
    if (onSearchChange) return options
    return options.filter((opt) => opt.label.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [options, searchQuery, onSearchChange])

  const handleKeyDown = (e: KeyboardEvent) => {
    if (disabled) return

    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        if (filteredOptions.length > 0) {
          setFocusedIndex((prev) => (prev + 1) % filteredOptions.length)
        }
        break
      case "ArrowUp":
        e.preventDefault()
        if (filteredOptions.length > 0) {
          setFocusedIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length)
        }
        break
      case "Enter":
        e.preventDefault()
        if (filteredOptions.length > 0 && focusedIndex >= 0 && !filteredOptions[focusedIndex].disabled) {
          handleSelect(filteredOptions[focusedIndex].value)
        }
        break
      case "Escape":
        e.preventDefault()
        setIsOpen(false)
        break
      case "Tab":
        setIsOpen(false)
        break
    }
  }

  const getLabel = (val: T) => getOptionLabel(options, val)

  const containerClasses = cn(
    "relative flex",
    labelPlacement === "top" ? `flex-col ${LAYOUT.gap.top}` : `flex-row items-baseline ${LAYOUT.gap.left}`,
    fullWidth ? "w-full" : "w-auto",
    containerClassName
  )

  const labelClasses = cn(
    "block text-sm font-medium leading-6",
    getLabelTextColor(isError, disabled || false),
    disabled && "opacity-50 cursor-not-allowed",
    labelPlacement === "left" && LAYOUT.dropdown.labelMinWidth
  )

  const wrapperClasses = cn(
    "relative",
    fullWidth ? "w-full" : LAYOUT.dropdown.defaultWidth,
    labelPlacement === "left" && "flex-1"
  )

  return (
    <motion.div className={containerClasses} ref={containerRef} {...rest}>
      {label && (
        <label className={labelClasses} onClick={() => !disabled && setIsOpen(!isOpen)}>
          {label}
        </label>
      )}

      <div className={wrapperClasses}>
        <ZSelectTrigger
          ref={triggerRef}
          id={selectId}
          isOpen={isOpen}
          disabled={disabled}
          isError={isError}
          size={size}
          shadow={shadow}
          iconStart={iconStart}
          multiple={multiple}
          placeholder={placeholder}
          className={className}
          selectedValues={selectedValues}
          getLabel={getLabel}
          onToggle={() => !disabled && setIsOpen(!isOpen)}
          onRemove={removeValue}
          onKeyDown={handleKeyDown}
        />

        <ZSelectList
          isOpen={isOpen}
          disabled={disabled}
          coords={coords}
          searchable={searchable}
          searchQuery={searchQuery}
          onSearchChange={(q) => {
            setSearchQuery(q)
            onSearchChange?.(q)
          }}
          onKeyDown={handleKeyDown}
          isLoading={isLoading}
          options={filteredOptions}
          focusedIndex={focusedIndex}
          multiple={multiple || false}
          selectedValues={selectedValues}
          listRef={listRef}
          onSelect={handleSelect}
        />
      </div>

      <ZHelperText
        error={error}
        helpText={helpText}
        errorId={errorId}
        helpId={helpId}
        className={cn(labelPlacement === "left" && LAYOUT.dropdown.helperMarginLeft)}
      />
    </motion.div>
  )
}

ZSelectComponent.displayName = "ZSelect"

const ZSelect = forwardRef(ZSelectComponent) as <T extends string | number>(
  props: ZSelectProps<T> & { ref?: ForwardedRef<HTMLDivElement> }
) => ReturnType<typeof ZSelectComponent>

export default ZSelect
