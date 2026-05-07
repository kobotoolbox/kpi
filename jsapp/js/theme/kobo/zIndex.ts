/** Numeric z-index values — use in JS/TS theme configs. */
export const KOBO_Z_INDEX = {
  modalOverlay: 3000,
  modal: 4000,
  tooltip: 4100,
  /** Combobox/select dropdowns — must render above modal and tooltips. */
  dropdown: 5000,
} as const

/** CSS `var()` references — use in CSS-in-JS style props. */
export const KOBO_Z_INDEX_CSS_VARS = {
  modalOverlay: 'var(--kobo-z-index-modal-overlay)',
  modal: 'var(--kobo-z-index-modal)',
  tooltip: 'var(--kobo-z-index-tooltip)',
  dropdown: 'var(--kobo-z-index-dropdown)',
} as const
