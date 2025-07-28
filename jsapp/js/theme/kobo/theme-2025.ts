// Updated Mantine Theme for 2025 Design Guidelines
// This extends the existing theme structure with new 2025 colors

import { createTheme, rem } from '@mantine/core'
import { ActionIconThemeKobo } from './ActionIcon'
import { AlertThemeKobo } from './Alert'
import { ButtonThemeKobo } from './Button'
import { DividerThemeKobo } from './Divider'
import { InputBaseThemeKobo } from './InputBase'
import { LoaderThemeKobo } from './Loader'
import { MenuThemeKobo } from './Menu'
import { ModalThemeKobo } from './Modal'
import { SelectThemeKobo } from './Select'
import { TableThemeKobo } from './Table'
import { TooltipThemeKobo } from './Tooltip'

// 2025 Color Definitions - Best practice modern colors
const colors2025 = {
  // Primary Blue Palette - Modern brand color
  primaryBlue: [
    'hsl(214, 100%, 97%)', // 50 - #f0f9ff
    'hsl(214, 95%, 93%)',  // 100 - #e0f2fe
    'hsl(213, 97%, 87%)',  // 200 - #bae6fd
    'hsl(212, 96%, 78%)',  // 300 - #7dd3fc
    'hsl(213, 94%, 68%)',  // 400 - #38bdf8
    'hsl(199, 89%, 48%)',  // 500 - #0ea5e9 - Main primary color
    'hsl(200, 98%, 39%)',  // 600 - #0284c7
    'hsl(201, 96%, 32%)',  // 700 - #0369a1
    'hsl(201, 90%, 27%)',  // 800 - #075985
    'hsl(202, 80%, 24%)',  // 900 - #0c4a6e
  ],

  // Secondary Teal Palette
  secondaryTeal: [
    'hsl(166, 76%, 97%)',  // 50 - #f0fdfa
    'hsl(167, 85%, 89%)',  // 100 - #ccfbf1
    'hsl(168, 84%, 78%)',  // 200 - #99f6e4
    'hsl(171, 77%, 64%)',  // 300 - #5eead4
    'hsl(172, 66%, 50%)',  // 400 - #2dd4bf
    'hsl(173, 80%, 40%)',  // 500 - #14b8a6 - Base secondary color
    'hsl(175, 84%, 32%)',  // 600 - #0d9488
    'hsl(175, 77%, 26%)',  // 700 - #0f766e
    'hsl(176, 69%, 22%)',  // 800 - #115e59
    'hsl(176, 61%, 19%)',  // 900 - #134e4a
  ],

  // Accent Purple Palette
  accentPurple: [
    'hsl(270, 100%, 98%)', // 50 - #faf5ff
    'hsl(269, 100%, 95%)', // 100 - #f3e8ff
    'hsl(269, 100%, 92%)', // 200 - #e9d5ff
    'hsl(268, 100%, 86%)', // 300 - #d8b4fe
    'hsl(270, 95%, 75%)',  // 400 - #c084fc
    'hsl(271, 91%, 65%)',  // 500 - #a855f7 - Base accent color
    'hsl(271, 81%, 56%)',  // 600 - #9333ea
    'hsl(272, 72%, 47%)',  // 700 - #7c3aed
    'hsl(273, 67%, 39%)',  // 800 - #6d28d9
    'hsl(274, 66%, 32%)',  // 900 - #581c87
  ],

  // Semantic Colors
  success: [
    'hsl(138, 76%, 97%)',  // 50 - #f0fdf4
    'hsl(141, 84%, 93%)',  // 100 - #dcfce7
    'hsl(141, 79%, 85%)',  // 200 - #bbf7d0
    'hsl(142, 77%, 73%)',  // 300 - #86efac
    'hsl(142, 69%, 58%)',  // 400 - #4ade80
    'hsl(142, 71%, 45%)',  // 500 - #22c55e - Base success color
    'hsl(142, 76%, 36%)',  // 600 - #16a34a
    'hsl(142, 72%, 29%)',  // 700 - #15803d
    'hsl(143, 64%, 24%)',  // 800 - #166534
    'hsl(144, 61%, 20%)',  // 900 - #14532d
  ],

  warning: [
    'hsl(48, 100%, 96%)',  // 50 - #fffbeb
    'hsl(48, 96%, 89%)',   // 100 - #fef3c7
    'hsl(48, 97%, 77%)',   // 200 - #fde68a
    'hsl(46, 97%, 65%)',   // 300 - #fcd34d
    'hsl(43, 96%, 56%)',   // 400 - #fbbf24
    'hsl(38, 92%, 50%)',   // 500 - #f59e0b - Base warning color
    'hsl(32, 95%, 44%)',   // 600 - #d97706
    'hsl(26, 90%, 37%)',   // 700 - #b45309
    'hsl(23, 83%, 31%)',   // 800 - #92400e
    'hsl(22, 78%, 26%)',   // 900 - #78350f
  ],

  error: [
    'hsl(0, 86%, 97%)',    // 50 - #fef2f2
    'hsl(0, 93%, 94%)',    // 100 - #fee2e2
    'hsl(0, 96%, 89%)',    // 200 - #fecaca
    'hsl(0, 94%, 82%)',    // 300 - #fca5a5
    'hsl(0, 91%, 71%)',    // 400 - #f87171
    'hsl(0, 84%, 60%)',    // 500 - #ef4444 - Base error color
    'hsl(0, 72%, 51%)',    // 600 - #dc2626
    'hsl(0, 74%, 42%)',    // 700 - #b91c1c
    'hsl(0, 70%, 35%)',    // 800 - #991b1b
    'hsl(0, 63%, 31%)',    // 900 - #7f1d1d
  ],

  info: [
    'hsl(204, 100%, 97%)', // 50 - #eff6ff
    'hsl(204, 94%, 94%)',  // 100 - #dbeafe
    'hsl(201, 94%, 86%)',  // 200 - #bfdbfe
    'hsl(199, 95%, 74%)',  // 300 - #93c5fd
    'hsl(198, 93%, 60%)',  // 400 - #60a5fa
    'hsl(198, 89%, 48%)',  // 500 - #3b82f6 - Base info color
    'hsl(221, 83%, 53%)',  // 600 - #2563eb
    'hsl(224, 76%, 48%)',  // 700 - #1d4ed8
    'hsl(226, 71%, 40%)',  // 800 - #1e40af
    'hsl(224, 64%, 33%)',  // 900 - #1e3a8a
  ],

  // Updated Neutral Gray Palette
  neutral: [
    'hsl(0, 0%, 100%)',    // 0 - #ffffff - Pure white
    'hsl(210, 20%, 98%)',  // 50 - #f8fafc - Lightest gray
    'hsl(214, 15%, 91%)',  // 100 - #e2e8f0 - Very light gray
    'hsl(213, 13%, 83%)',  // 200 - #cbd5e1 - Light gray
    'hsl(212, 11%, 74%)',  // 300 - #94a3b8 - Medium light gray
    'hsl(215, 14%, 58%)',  // 400 - #64748b - Medium gray
    'hsl(215, 16%, 47%)',  // 500 - #475569 - Base gray
    'hsl(215, 19%, 35%)',  // 600 - #334155 - Medium dark gray
    'hsl(215, 25%, 27%)',  // 700 - #1e293b - Dark gray
    'hsl(217, 33%, 17%)',  // 800 - #0f172a - Very dark gray
    'hsl(222, 84%, 5%)',   // 900 - #020617 - Near black
  ],
}

export const themeKobo2025 = createTheme({
  primaryColor: 'primaryBlue',
  colors: {
    // Map new 2025 colors to Mantine color system
    primaryBlue: colors2025.primaryBlue,
    secondaryTeal: colors2025.secondaryTeal,
    accentPurple: colors2025.accentPurple,
    
    // Semantic colors
    success: colors2025.success,
    warning: colors2025.warning,
    error: colors2025.error,
    info: colors2025.info,
    
    // Updated neutrals (replaces old gray system)
    neutral: colors2025.neutral,
    
    // Legacy color mappings for backward compatibility
    // These map old color names to new 2025 equivalents
    gray: colors2025.neutral, // Map old gray to new neutral
    blue: colors2025.primaryBlue, // Map old blue to new primary
    teal: colors2025.secondaryTeal, // Map old teal to new secondary
    red: colors2025.error, // Map old red to new error
    amber: colors2025.warning, // Map old amber to new warning
  },

  // Typography (unchanged from existing)
  scale: 16 / 14,
  fontFamily: '"Roboto", sans-serif',
  fontFamilyMonospace: 'Roboto Mono, monospace',
  fontSizes: {
    xs: rem(12),
    sm: rem(13),
    md: rem(14),
    lg: rem(16),
    xl: rem(18),
  },
  lineHeights: {},
  headings: {
    fontWeight: '500',
  },

  defaultRadius: 'md',
  radius: {
    xs: '2px',
    sm: '4px',
    md: '6px',
    lg: '10px',
    xl: '14px',
  },

  // Component themes (inherit from existing but can be customized for 2025)
  components: {
    ActionIcon: ActionIconThemeKobo,
    Alert: AlertThemeKobo,
    Button: ButtonThemeKobo,
    InputBase: InputBaseThemeKobo,
    Loader: LoaderThemeKobo,
    Menu: MenuThemeKobo,
    Modal: ModalThemeKobo,
    Select: SelectThemeKobo,
    Tooltip: TooltipThemeKobo,
    Table: TableThemeKobo,
    Divider: DividerThemeKobo,
  },
})

// Utility function to get semantic color values
export const getSemanticColor = (type: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info', shade: number = 500) => {
  const colorMap = {
    primary: colors2025.primaryBlue,
    secondary: colors2025.secondaryTeal,
    success: colors2025.success,
    warning: colors2025.warning,
    error: colors2025.error,
    info: colors2025.info,
  }
  
  const shadeIndex = Math.floor(shade / 100)
  return colorMap[type][shadeIndex] || colorMap[type][5] // Fallback to base color (500)
}

// CSS custom properties helper for dynamic theming
export const cssCustomProperties = {
  // Primary
  '--kobo-primary': colors2025.primaryBlue[5],
  '--kobo-primary-hover': colors2025.primaryBlue[6],
  '--kobo-primary-active': colors2025.primaryBlue[7],
  '--kobo-primary-light': colors2025.primaryBlue[1],
  '--kobo-primary-dark': colors2025.primaryBlue[8],

  // Secondary
  '--kobo-secondary': colors2025.secondaryTeal[5],
  '--kobo-secondary-hover': colors2025.secondaryTeal[6],
  '--kobo-secondary-active': colors2025.secondaryTeal[7],
  '--kobo-secondary-light': colors2025.secondaryTeal[1],
  '--kobo-secondary-dark': colors2025.secondaryTeal[8],

  // Semantic
  '--kobo-success': colors2025.success[5],
  '--kobo-success-light': colors2025.success[1],
  '--kobo-success-dark': colors2025.success[7],

  '--kobo-warning': colors2025.warning[5],
  '--kobo-warning-light': colors2025.warning[1],
  '--kobo-warning-dark': colors2025.warning[7],

  '--kobo-error': colors2025.error[5],
  '--kobo-error-light': colors2025.error[1],
  '--kobo-error-dark': colors2025.error[7],

  '--kobo-info': colors2025.info[5],
  '--kobo-info-light': colors2025.info[1],
  '--kobo-info-dark': colors2025.info[7],

  // Text
  '--kobo-text-primary': colors2025.neutral[9],
  '--kobo-text-secondary': colors2025.neutral[7],
  '--kobo-text-tertiary': colors2025.neutral[5],
  '--kobo-text-disabled': colors2025.neutral[4],
  '--kobo-text-inverse': colors2025.neutral[0],

  // Backgrounds
  '--kobo-bg-primary': colors2025.neutral[0],
  '--kobo-bg-secondary': colors2025.neutral[1],
  '--kobo-bg-tertiary': colors2025.neutral[2],

  // Borders
  '--kobo-border-primary': colors2025.neutral[3],
  '--kobo-border-secondary': colors2025.neutral[2],
  '--kobo-border-focus': colors2025.primaryBlue[5],
}
