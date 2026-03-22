'use client';

import { AnimatePresence, motion, Variants } from 'framer-motion';
import { KeyboardEvent, RefObject, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { theme } from './themeConfig';
import { cn } from './utils';
import { ZSelectItem } from './ZSelect';
import { ZSelectOption } from './ZSelectOption';
import { SpinnerIcon, SearchIcon } from './icon';

const ANIMATION = {
  dropdown: {
    duration: {
      enter: 0.2,
      exit: 0.15,
    },
    scale: {
      hidden: 0.95,
      visible: 1,
    },
    y: {
      hidden: -10,
      visible: 0,
    },
  },
} as const;

const LAYOUT = {
  list: {
    zIndex: 9999,
    maxHeight: 'max-h-60',
    padding: 'py-1',
  },
  search: {
    container: 'p-2',
    input: 'py-1.5 pl-8 pr-3',
    iconLeft: 'pl-2',
  },
  icon: {
    search: 'h-4 w-4',
    loading: 'h-4 w-4',
  },
  emptyState: {
    padding: 'py-2 px-3',
  },
  loading: {
    gap: 'gap-2',
  },
} as const;

const dropdownVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: ANIMATION.dropdown.scale.hidden,
    y: ANIMATION.dropdown.y.hidden,
    transition: { duration: ANIMATION.dropdown.duration.exit, ease: 'easeIn' },
  },
  visible: {
    opacity: 1,
    scale: ANIMATION.dropdown.scale.visible,
    y: ANIMATION.dropdown.y.visible,
    transition: { duration: ANIMATION.dropdown.duration.enter, ease: 'easeOut' },
  },
};

interface ZSelectListProps<T extends string | number> {
  isOpen: boolean;
  disabled?: boolean;
  coords: { left: number; top: number; width: number };

  searchable: boolean;
  searchQuery: string;
  onSearchChange?: (query: string) => void;
  onKeyDown: (e: KeyboardEvent) => void;

  isLoading: boolean;
  options: ZSelectItem<T>[];
  focusedIndex: number;
  multiple: boolean;
  selectedValues: T[];
  listRef: RefObject<HTMLUListElement | null>;

  onSelect: (value: T) => void;
}

export const ZSelectList = <T extends string | number>({
  isOpen,
  disabled,
  coords,
  searchable,
  searchQuery,
  onSearchChange,
  onKeyDown,
  isLoading,
  options,
  focusedIndex,
  multiple,
  selectedValues,
  listRef,
  onSelect,
}: ZSelectListProps<T>) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && searchable) {
      const frameId = requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
      return () => cancelAnimationFrame(frameId);
    }
    return;
  }, [isOpen, searchable]);

  useEffect(() => {
    if (!isOpen || focusedIndex < 0 || !listRef.current) return;
    const list = listRef.current;
    const optionsItems = list.querySelectorAll('li[role="option"]');
    const activeItem = optionsItems[focusedIndex] as HTMLElement;
    if (activeItem) {
      if (focusedIndex === 0) {
        list.scrollTop = 0;
      } else {
        activeItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedIndex, isOpen]);

  const isSelected = (val: T) => selectedValues.includes(val);

  return createPortal(
    <AnimatePresence>
      {!disabled && isOpen && (
        <motion.ul
          ref={listRef}
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={dropdownVariants}
          style={{
            position: 'fixed',
            left: coords.left,
            top: coords.top,
            width: coords.width,
            zIndex: LAYOUT.list.zIndex,
          }}
          className={cn(
            'overflow-auto rounded-md text-base shadow-lg ring-1 ring-black/10 dark:ring-slate-600/50 focus:outline-none sm:text-sm origin-top',
            theme.selectBg,
            theme.selectScrollbar,
            LAYOUT.list.padding,
            LAYOUT.list.maxHeight
          )}
          role="listbox"
          tabIndex={-1}
        >
          {searchable && (
            <li
              className={cn(
                'sticky top-0 z-10',
                theme.selectBg,
                theme.selectSearchBorder,
                LAYOUT.search.container
              )}
            >
              <div className="relative">
                <span
                  className={cn(
                    'absolute inset-y-0 left-0 flex items-center',
                    theme.selectIconColor,
                    LAYOUT.search.iconLeft
                  )}
                >
                  <SearchIcon className={LAYOUT.icon.search} />
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  className={cn(
                    'w-full rounded border text-sm',
                    theme.selectSearchInput,
                    LAYOUT.search.input
                  )}
                  placeholder="Search..."
                  value={searchQuery}
                  onKeyDown={onKeyDown}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </li>
          )}

          {isLoading ? (
            <div
              className={cn(
                theme.selectEmptyText,
                'text-sm text-center flex justify-center items-center',
                LAYOUT.emptyState.padding,
                LAYOUT.loading.gap
              )}
            >
              <SpinnerIcon className={cn('animate-spin', LAYOUT.icon.loading)} />
              <span>Loading...</span>
            </div>
          ) : options.length === 0 ? (
            <div
              className={cn(
                theme.selectEmptyText,
                'text-sm text-center',
                LAYOUT.emptyState.padding
              )}
            >
              No options found
            </div>
          ) : (
            options.map((option, index) => (
              <ZSelectOption
                key={option.value}
                option={option}
                isSelected={isSelected(option.value)}
                isFocused={index === focusedIndex}
                multiple={multiple}
                onSelect={onSelect}
              />
            ))
          )}
        </motion.ul>
      )}
    </AnimatePresence>,
    document.body
  );
};
