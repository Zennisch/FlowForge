'use client';

import { cn } from './utils';
import { theme } from './themeConfig';
import { ZSelectItem } from './ZSelect';
import { AnimatedCheckIcon } from './icon';

export interface ZSelectOptionProps<T extends string | number> {
  option: ZSelectItem<T>;
  isSelected: boolean;
  isFocused: boolean;
  multiple: boolean;
  onSelect: (value: T) => void;
}

const LAYOUT = {
  container: 'py-2.5 pl-3 pr-9',
  checkIconPadding: 'pr-3',
  contentGap: 'gap-2',
  icons: {
    checkboxBox: 'h-4 w-4',
    checkboxCheck: 'h-3 w-3',
    singleCheck: 'h-5 w-5',
  },
};

export const ZSelectOption = <T extends string | number>({
  option,
  isSelected,
  isFocused,
  multiple,
  onSelect,
}: ZSelectOptionProps<T>) => {
  return (
    <li
      className={cn(
        'relative cursor-default select-none transition-colors',
        LAYOUT.container,
        option.disabled
          ? 'opacity-50 cursor-not-allowed'
          : cn('cursor-pointer', theme.selectOptionHover),
        isSelected && !multiple ? theme.selectOptionSelected : theme.selectOptionDefault,
        isSelected && multiple ? theme.selectOptionSelectedMulti : '',
        isFocused && !option.disabled ? theme.selectOptionFocused : ''
      )}
      role="option"
      aria-selected={isSelected}
      onClick={(e) => {
        e.stopPropagation();
        !option.disabled && onSelect(option.value);
      }}
    >
      <div className={cn('flex items-center', LAYOUT.contentGap)}>
        {multiple && (
          <div
            className={cn(
              'flex shrink-0 items-center justify-center rounded border transition-colors',
              LAYOUT.icons.checkboxBox,
              isSelected
                ? 'bg-(--color-primary) border-(--color-primary) text-white'
                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
            )}
          >
            {isSelected && <AnimatedCheckIcon className={LAYOUT.icons.checkboxCheck} />}
          </div>
        )}

        {option.icon && <span className="text-slate-400 dark:text-slate-500">{option.icon}</span>}
        <span className="block truncate">{option.label}</span>
      </div>

      {isSelected && !multiple && (
        <span
          className={cn(
            'absolute inset-y-0 right-0 flex items-center text-(--color-primary)',
            LAYOUT.checkIconPadding
          )}
        >
          <AnimatedCheckIcon className={LAYOUT.icons.singleCheck} />
        </span>
      )}
    </li>
  );
};
