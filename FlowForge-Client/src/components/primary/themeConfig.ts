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
  surface: 'bg-(--color-surface-base)',
  surfaceSubtle: 'bg-(--color-surface-muted)',
  pageBg: 'bg-(--shell-canvas-bg)',

  // ── Borders ──────────────────────────────────────────────────────────────
  borderSubtle: 'border-(--color-border-subtle)',

  // ── Text ─────────────────────────────────────────────────────────────────
  textPrimary: 'text-(--color-text-primary)',
  textSecondary: 'text-(--color-text-secondary)',
  textMuted: 'text-(--color-text-placeholder)',
  textDisabled: 'text-(--color-text-disabled)',

  // ── ZModal ────────────────────────────────────────────────────────────────
  modalContainer: 'bg-(--color-surface-raised) ring-1 ring-(--color-border-subtle) shadow-2xl',
  modalHeaderBorder: 'border-b border-(--color-border-subtle)',
  modalHeaderText: 'text-(--color-text-primary)',
  modalFooterBorder: 'border-t border-(--color-border-subtle)',
  modalFooterBg: 'bg-(--color-surface-muted)',
  modalLoading: 'bg-(--color-surface-base)/70 backdrop-blur-[2px]',
  modalCloseButton:
    'bg-transparent text-(--color-text-secondary) hover:bg-(--color-surface-hover) hover:text-(--color-text-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary) focus:ring-offset-2 focus:ring-offset-(--color-surface-raised) transition-colors',

  // ── ZButton ───────────────────────────────────────────────────────────────
  buttonPrimary:
    'bg-(--color-primary) text-white hover:bg-(--color-primary-hover) focus-visible:ring-(--color-primary)',
  buttonSecondary:
    'bg-(--color-surface-raised) text-(--color-primary) border border-(--color-border) hover:bg-(--color-surface-hover) focus-visible:ring-(--color-primary)',
  buttonTertiary:
    'bg-(--color-surface-hover) text-(--color-text-primary) hover:bg-(--color-surface-active) focus-visible:ring-(--color-primary)',
  buttonGhost:
    'bg-transparent text-(--color-primary) hover:bg-(--color-surface-hover) focus-visible:ring-(--color-primary)',

  // ── ZTextInput ────────────────────────────────────────────────────────────
  inputBg: 'bg-(--color-surface-raised)',
  inputDisabledBg: 'bg-(--color-bg-disabled)',
  inputText: 'text-(--color-text-primary)',
  inputDisabledText: 'text-(--color-text-disabled)',
  inputIconColor: 'text-(--color-text-secondary)',
  inputIconColorDisabled: 'text-(--color-text-disabled)',

  // ── ZRadio / ZCheckbox / ZSwitch labels & boxes ───────────────────────────
  controlLabelColor: 'text-(--color-text-secondary)',
  controlLabelError: 'text-(--color-error)',
  controlLabelColorSwitch: 'text-(--color-text-primary)',
  controlBg: 'bg-(--color-surface-raised)',
  controlDisabledBg: 'bg-(--color-bg-disabled)',

  // ── ZHelperText ───────────────────────────────────────────────────────────
  helperDefault: 'font-normal text-(--color-text-secondary)',

  // ── ZSelect ───────────────────────────────────────────────────────────────
  selectBg: 'bg-(--color-surface-raised)',
  selectDisabledBg: 'bg-(--color-bg-disabled)',
  selectDisabledText: 'text-(--color-text-disabled)',
  selectDisabledBorder: 'ring-(--color-border-subtle) border-(--color-border-subtle)',
  selectLabelColor: 'text-(--color-text-primary)',
  selectTag: 'bg-(--color-surface-hover) text-(--color-primary) border border-(--color-border)',
  selectPlaceholder: 'text-(--color-text-placeholder)',
  selectIconColor: 'text-(--color-text-secondary)',
  selectSearchBorder: 'border-b border-(--color-border-subtle)',
  selectSearchInput:
    'text-(--color-text-primary) border-(--color-border) bg-transparent placeholder:text-(--color-text-placeholder) focus:outline-none focus:ring-1 focus:ring-(--color-primary) focus:border-(--color-primary)',
  selectEmptyText: 'text-(--color-text-secondary)',
  selectOptionDefault: 'text-(--color-text-primary)',
  selectOptionHover: 'hover:bg-(--color-surface-hover) hover:text-(--color-text-primary)',
  selectOptionSelected: 'bg-(--color-surface-active) text-(--color-primary) font-medium',
  selectOptionSelectedMulti: 'bg-(--color-surface-hover)',
  selectOptionFocused: 'bg-(--color-surface-hover) text-(--color-text-primary)',
  selectOptionCheckboxUnchecked: 'border-(--color-border) bg-(--color-surface-raised)',
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
