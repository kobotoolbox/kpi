/** Numeric z-index values — use in JS/TS theme configs. */
export const KOBO_Z_INDEX = {
  accountMenu: 1101,
  modalOverlay: 3000,
  modal: 4000,
  tooltip: 4100,
  /** Overlay for a confirmation/nested modal opened on top of a regular modal. */
  nestedModalOverlay: 4500,
  /** Confirmation/nested modal opened on top of a regular modal. */
  nestedModal: 4600,
  /** Combobox/select dropdowns — must render above modal and tooltips. */
  dropdown: 5000,
} as const

/** CSS `var()` references — use in CSS-in-JS style props. */
export const KOBO_Z_INDEX_CSS_VARS = {
  modalOverlay: 'var(--kobo-z-index-modal-overlay)',
  modal: 'var(--kobo-z-index-modal)',
  tooltip: 'var(--kobo-z-index-tooltip)',
  nestedModalOverlay: 'var(--kobo-z-index-nested-modal-overlay)',
  nestedModal: 'var(--kobo-z-index-nested-modal)',
  dropdown: 'var(--kobo-z-index-dropdown)',
} as const
