export const theme = {
  // ── Colors (CSS Variables) ──────────────────────────────────────────────
  // Used for JS/Framer Motion animations where Tailwind classes can't be used directly
  colors: {
    primary: 'var(--color-primary)',
    primaryHover: 'var(--color-primary-hover)',
    error: 'var(--color-error)',
    errorLight: 'var(--color-error-light)',
    border: 'var(--color-border)',
    borderHover: 'var(--color-border-hover)',
    textPrimary: 'var(--color-text-primary)',
    textSecondary: 'var(--color-text-secondary)',
    textDisabled: 'var(--color-text-disabled)',
    surface: 'var(--zui-surface)',
  },

  // ── Surfaces & Backgrounds ──────────────────────────────────────────────
  surface: 'bg-white dark:bg-slate-800',
  surfaceSubtle: 'bg-slate-50/50 dark:bg-slate-900/50',
  pageBg: 'bg-gray-50/50 dark:bg-slate-950',

  // ── Borders ──────────────────────────────────────────────────────────────
  borderSubtle: 'border-slate-100 dark:border-slate-700',

  // ── Text ─────────────────────────────────────────────────────────────────
  textPrimary: 'text-slate-900 dark:text-slate-100',
  textSecondary: 'text-slate-600 dark:text-slate-400',
  textMuted: 'text-slate-500 dark:text-slate-400',
  textDisabled: 'text-slate-400 dark:text-slate-500',

  // ── ZModal ────────────────────────────────────────────────────────────────
  modalContainer:
    'bg-white dark:bg-slate-800 ring-1 ring-slate-900/5 dark:ring-slate-700/30 shadow-2xl',
  modalHeaderBorder: 'border-b border-slate-100 dark:border-slate-700',
  modalHeaderText: 'text-slate-900 dark:text-slate-100',
  modalFooterBorder: 'border-t border-slate-100 dark:border-slate-700',
  modalFooterBg: 'bg-slate-50/50 dark:bg-slate-900/50',
  modalLoading: 'bg-white/60 dark:bg-slate-800/60 backdrop-blur-[2px]',
  modalCloseButton:
    'bg-transparent text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-(--color-primary) focus:ring-offset-2 transition-colors',

  // ── ZButton ───────────────────────────────────────────────────────────────
  buttonPrimary:
    'bg-(--color-primary) text-white hover:bg-(--color-primary-hover) focus-visible:ring-(--color-primary)',
  buttonSecondary:
    'bg-white dark:bg-slate-800 text-(--color-primary) border border-(--color-border) hover:bg-sky-50/70 dark:hover:bg-sky-950/25 focus-visible:ring-(--color-primary)',
  buttonTertiary:
    'bg-sky-100 dark:bg-sky-950/35 text-sky-900 dark:text-sky-300 hover:bg-sky-200 dark:hover:bg-sky-950/55 focus-visible:ring-(--color-primary)',
  buttonGhost:
    'bg-transparent text-(--color-primary) hover:bg-sky-50/60 dark:hover:bg-sky-950/25 focus-visible:ring-(--color-primary)',

  // ── ZTextInput ────────────────────────────────────────────────────────────
  inputBg: 'bg-white dark:bg-slate-800',
  inputDisabledBg: 'bg-slate-50 dark:bg-slate-900',
  inputText: 'text-slate-900 dark:text-slate-100',
  inputDisabledText: 'text-slate-400 dark:text-slate-500',
  inputIconColor: 'text-slate-500 dark:text-slate-400',
  inputIconColorDisabled: 'text-slate-400 dark:text-slate-600',

  // ── ZRadio / ZCheckbox / ZSwitch labels & boxes ───────────────────────────
  controlLabelColor: 'text-slate-700 dark:text-slate-300',
  controlLabelError: 'text-red-900 dark:text-red-400',
  controlLabelColorSwitch: 'text-slate-900 dark:text-slate-100',
  controlBg: 'bg-white dark:bg-slate-800',
  controlDisabledBg: 'bg-slate-100 dark:bg-slate-700',

  // ── ZHelperText ───────────────────────────────────────────────────────────
  helperDefault: 'font-normal text-slate-500 dark:text-slate-400',

  // ── ZSelect ───────────────────────────────────────────────────────────────
  selectBg: 'bg-white dark:bg-slate-800',
  selectDisabledBg: 'bg-slate-50 dark:bg-slate-900',
  selectDisabledText: 'text-slate-500 dark:text-slate-400',
  selectDisabledBorder: 'ring-slate-200 dark:ring-slate-700 border-slate-200 dark:border-slate-700',
  selectLabelColor: 'text-slate-900 dark:text-slate-100',
  selectTag:
    'bg-sky-100/80 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-900/70',
  selectPlaceholder: 'text-slate-400 dark:text-slate-500',
  selectIconColor: 'text-slate-400 dark:text-slate-500',
  selectSearchBorder: 'border-b border-slate-100 dark:border-slate-700',
  selectSearchInput:
    'text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600 bg-transparent dark:bg-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-(--color-primary) focus:border-(--color-primary)',
  selectEmptyText: 'text-slate-500 dark:text-slate-400',
  selectOptionDefault: 'text-slate-900 dark:text-slate-100',
  selectOptionHover:
    'hover:bg-sky-50 dark:hover:bg-sky-950/50 hover:text-sky-900 dark:hover:text-sky-300',
  selectOptionSelected:
    'bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-300 font-medium',
  selectOptionSelectedMulti: 'bg-sky-50/50 dark:bg-sky-950/30',
  selectOptionFocused: 'bg-sky-50 dark:bg-sky-950/50 text-sky-900 dark:text-sky-300',
  selectOptionCheckboxUnchecked:
    'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700',
  selectScrollbar:
    'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-sky-200 dark:scrollbar-thumb-sky-900/70 hover:scrollbar-thumb-sky-300 dark:hover:scrollbar-thumb-sky-800',

  // ── Danbooru shared ────────────────────────────────────────────────────────
  radioGroupBg: 'bg-sky-100/80 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/70',
  sectionLabel: 'text-xs font-medium text-sky-400 uppercase tracking-wider',
  sectionTitle:
    'text-xs font-semibold text-sky-400 uppercase tracking-wider border-b border-sky-100 dark:border-sky-900/70',
  sidebarBg: 'bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700',

  // ── PostModal ──────────────────────────────────────────────────────────────
  postHeaderBg:
    'bg-linear-to-r from-sky-50 via-cyan-50 to-blue-50 dark:from-sky-950/40 dark:via-cyan-950/30 dark:to-blue-950/40',
  postHeaderBorder: 'border-b border-sky-100/80 dark:border-sky-900/50',
  postInfoPanelBg: 'bg-white dark:bg-slate-800',
  metaRowBorder: 'border-b border-sky-50 dark:border-sky-900/40 last:border-0',
  metaValue: 'text-gray-700 dark:text-slate-300',

  // ── TagSection ─────────────────────────────────────────────────────────────
  tagGeneral:
    'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-900/70 hover:bg-sky-100 dark:hover:bg-sky-900/40',
  tagArtist:
    'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/70 hover:bg-rose-100 dark:hover:bg-rose-900/40',
  tagCopyright:
    'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-900/70 hover:bg-violet-100 dark:hover:bg-violet-900/40',
  tagCharacter:
    'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/70 hover:bg-emerald-100 dark:hover:bg-emerald-900/40',
  tagMeta:
    'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/70 hover:bg-amber-100 dark:hover:bg-amber-900/40',
} as const;
