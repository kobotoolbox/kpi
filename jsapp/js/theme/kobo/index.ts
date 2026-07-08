import { createTheme, rem } from '@mantine/core'
import type { CSSVariablesResolver } from '@mantine/core'
import { ActionIconThemeKobo } from './ActionIcon'
import { AlertThemeKobo } from './Alert'
import { AutocompleteThemeKobo } from './Autocomplete'
import { ButtonThemeKobo } from './Button'
import { CheckboxThemeKobo } from './Checkbox'
import { CloseButtonThemeKobo } from './CloseButton'
import { DividerThemeKobo } from './Divider'
import { DropzoneThemeKobo } from './Dropzone'
import { InputBaseThemeKobo } from './InputBase'
import { LoaderThemeKobo } from './Loader'
import { MenuThemeKobo } from './Menu'
import { ModalThemeKobo } from './Modal'
import { MultiSelectThemeKobo } from './MultiSelect'
import { NotificationThemeKobo } from './Notification'
import { NumberInputThemeKobo } from './NumberInput'
import { PaperThemeKobo } from './Paper'
import { PillThemeKobo } from './Pill'
import { RadioThemeKobo } from './Radio'
import { SelectThemeKobo } from './Select'
import { TableThemeKobo } from './Table'
import { TabsThemeKobo } from './Tabs'
import { TagsInputThemeKobo } from './TagsInput'
import { TextareaThemeKobo } from './Textarea'
import { ThemeIconThemeKobo } from './ThemeIcon'
import { TooltipThemeKobo } from './Tooltip'
import { KOBO_Z_INDEX, KOBO_Z_INDEX_CSS_VARS } from './zIndex'

export const cssVariablesResolverKobo: CSSVariablesResolver = () => {
  return {
    variables: {
      '--kobo-z-index-modal-overlay': String(KOBO_Z_INDEX.modalOverlay),
      '--kobo-z-index-modal': String(KOBO_Z_INDEX.modal),
      '--kobo-z-index-tooltip': String(KOBO_Z_INDEX.tooltip),
      '--kobo-z-index-nested-modal-overlay': String(KOBO_Z_INDEX.nestedModalOverlay),
      '--kobo-z-index-nested-modal': String(KOBO_Z_INDEX.nestedModal),
      '--kobo-z-index-dropdown': String(KOBO_Z_INDEX.dropdown),
      '--kobo-focus-ring-color': 'var(--mantine-primary-color-filled)',
      '--kobo-focus-ring-color-danger': 'var(--mantine-color-red-6)',
      '--kobo-focus-ring-width': '2px',
      '--kobo-focus-ring-offset': '2px',
      '--kobo-focus-ring': 'var(--kobo-focus-ring-width) solid var(--kobo-focus-ring-color)',
    },
    light: {},
    dark: {},
  }
}

export const themeKobo = createTheme({
  focusRing: 'auto',
  primaryColor: 'blue',
  colors: {
    gray: [
      'hsl(225, 17%, 14%)', // [0] #1e212a, $kobo-gray-900, (accessible) our black, very very rare, only use if necessary for contrast
      'hsl(225, 16%, 24%)', // [1] #333847, $kobo-gray-800, (accessible) active text, important text, text on background, top navigation background
      'hsl(226, 16%, 42%)', // [2] #5a627d, $kobo-gray-700, (accessible) default text, inactive text, options text, buttons text, tabs text, notifications background, hover for popups and dropdowns
      'hsl(225, 16%, 58%)', // [3] #828ba5, $kobo-gray-600, (readable) clickable icons on hover
      'hsl(226, 16%, 70%)', // [4] #a6acbf, $kobo-gray-500, icons default (clickable), arrows and indicators default
      'hsl(228, 16%, 82%)', // [5] #cacdd9, $kobo-gray-400, inactive icons, some decorative icons
      'hsl(227, 18%, 90%)', // [6] #e1e3ea, $kobo-gray-300, scroll bars, table lines, dividers, background of clickable icons on hover when also in a highlighted table row
      'hsl(228, 16%, 94%)', // [7] #edeef2, $kobo-gray-200, default light background, icons on hover, sidebar menu, table headings, …
      'hsl(240, 20%, 98%)', // [8] #f9f9fb, $kobo-gray-100, table row highlight on hover
      'hsl(0, 0%, 100%)', // [9] #ffffff, white background
    ],
    blue: [
      '#000', // [0]
      '#000', // [1]
      '#000', // [2]
      'hsl(210, 100%, 22%)', // [3] #00386F,
      'hsl(207, 77%, 32%)', // [4] #135991,
      'hsl(207, 77%, 43%)', // [5] #1977c2,
      'hsl(207, 90%, 54%)', // [6] #2095f3,
      'hsl(207, 90%, 77%)', // [7] #8fcaf9, (previously $kobo-alt-blue)
      'hsl(207, 88%, 91%)', // [8] #d2e9fc, (previously $kobo-mid-blue)
      'hsl(206, 84%, 95%)', // [9] #e8f4fd, (previously $kobo-light-blue)
    ],
    teal: [
      '#000', // [0]
      '#000', // [1]
      'hsl(185, 57%, 25%)', // [2] #1b5e64
      'hsl(185, 57%, 35%)', // [3] #26838c
      'hsl(185, 57%, 57%)', // [4] #52c5d0
      'hsl(186, 57%, 75%)', // [5] #9bdde4
      'hsl(185, 58%, 85%)', // [6] #c3ebef
      'hsl(188, 60%, 95%)', // [7] #ebf8fa
      '#000', // [8]
      '#000', // [9]
    ],
    red: [
      '#000', // [0]
      '#000', // [1]
      '#000', // [2]
      '#000', // [3]
      'hsl(0, 68%, 22%)', // [4] #601212;
      'hsl(0, 100%, 26%)', // [5] #850000
      'hsl(0, 100%, 31%)', // [6] #9d0000
      'hsl(0, 100%, 75%)', // [7] #ff8080
      'hsl(0, 100%, 90%)', // [8] #ffcccc
      'hsl(0, 100%, 96%)', // [9] #ffe9e9
    ],
    amber: [
      'hsl(28, 100%, 15%)', // [0]
      'hsl(29, 100%, 22%)', // [1] approx $kobo-dark-amber
      'hsl(29, 100%, 29%)', // [2]
      'hsl(29, 100%, 36%)', // [3]
      'hsl(29, 100%, 43%)', // [4]
      'hsl(36, 100%, 60%)', // [5]
      'hsl(36, 100%, 70%)', // [6] approx $kobo-amber
      'hsl(36, 100%, 80%)', // [7]
      'hsl(36, 100%, 90%)', // [8] $kobo-light-amber
      'hsl(41, 100%, 95%)', // [9]
    ],
  },

  // Typography
  scale: 16 / 14, // Because old ways set base font to 14px instead of standard 16px.
  fontFamily: '"Roboto", sans-serif',
  fontFamilyMonospace: 'Roboto Mono, monospace',
  fontSizes: {
    xs: rem(12),
    sm: rem(13), // TODO: For now implied from button sizes.
    md: rem(14), // TODO: For now implied from button sizes.
    lg: rem(16),
    xl: rem(18),
  },
  // Kobo uses 20+ different line-heights in different units. TODO: standardize and use mantine config.
  lineHeights: {},
  headings: {
    fontWeight: '500',
  },
  // headings: {
  //   fontFamily: '"Roboto", sans-serif',
  // },

  defaultRadius: 'md',
  radius: {
    xs: '2px',
    sm: '4px',
    md: '6px',
    lg: '10px',
    xl: '14px',
  },

  spacing: {
    xxs: '8px',
  },

  other: {
    zIndex: KOBO_Z_INDEX,
    zIndexCssVars: KOBO_Z_INDEX_CSS_VARS,
  },

  components: {
    ActionIcon: ActionIconThemeKobo,
    Alert: AlertThemeKobo,
    Button: ButtonThemeKobo,
    CloseButton: CloseButtonThemeKobo,
    InputBase: InputBaseThemeKobo,
    Loader: LoaderThemeKobo,
    Menu: MenuThemeKobo,
    Modal: ModalThemeKobo,
    MultiSelect: MultiSelectThemeKobo,
    Select: SelectThemeKobo,
    Tooltip: TooltipThemeKobo,
    Table: TableThemeKobo,
    Divider: DividerThemeKobo,
    Dropzone: DropzoneThemeKobo,
    TagsInput: TagsInputThemeKobo,
    Tabs: TabsThemeKobo,
    ThemeIcon: ThemeIconThemeKobo,
    NumberInput: NumberInputThemeKobo,
    Textarea: TextareaThemeKobo,
    Paper: PaperThemeKobo,
    Pill: PillThemeKobo,
    Checkbox: CheckboxThemeKobo,
    Radio: RadioThemeKobo,
    Notification: NotificationThemeKobo,
    Autocomplete: AutocompleteThemeKobo,
  },
})
