'use client'

import { AnimatePresence, motion } from "framer-motion"
import { theme } from "./themeConfig"
import { cn } from "./utils"

type TextSize = "xs" | "sm" | "base"

const SIZES: Record<TextSize, string> = {
  xs: "text-xs mt-0.5",
  sm: "text-sm mt-1",
  base: "text-base mt-1.5"
}

const ANIMATION_CONFIG = {
  initial: { opacity: 0, height: 0, y: -5 },
  animate: { opacity: 1, height: "auto", y: 0 },
  exit: { opacity: 0, height: 0, y: -5 },
  transition: { duration: 0.2 }
}

const THEME = {
  default: theme.helperDefault,
  error: theme.controlLabelError
}

interface ZHelperTextProps {
  error?: boolean | string
  helpText?: string
  errorId?: string
  helpId?: string
  className?: string
  textSize?: TextSize
  defaultErrorMessage?: string
}

const HelperTextContent = ({ isError, message, id, size }) => {
  const themeCls = isError ? THEME.error : THEME.default
  const sizeCls = SIZES[size]

  return (
    <p className={cn(themeCls, sizeCls)} id={id}>
      {message}
    </p>
  )
}

export const ZHelperText = ({
  error,
  helpText,
  errorId,
  helpId,
  className,
  textSize = "sm",
  defaultErrorMessage = "Invalid input"
}: ZHelperTextProps) => {
  const isError = !!error
  const errorMessage = typeof error === "string" ? error : defaultErrorMessage

  return (
    <AnimatePresence mode="wait">
      {(isError || helpText) && (
        <motion.div
          key={isError ? "error" : "help"}
          initial={ANIMATION_CONFIG.initial}
          animate={ANIMATION_CONFIG.animate}
          exit={ANIMATION_CONFIG.exit}
          transition={ANIMATION_CONFIG.transition}
          className={cn("overflow-hidden", className)}
        >
          <HelperTextContent
            isError={isError}
            message={isError ? errorMessage : helpText}
            id={isError ? errorId : helpId}
            size={textSize}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
