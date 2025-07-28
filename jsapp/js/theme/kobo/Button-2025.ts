// Example: Updating the Button Component to use 2025 Design Guidelines
// File: jsapp/js/theme/kobo/Button-2025.ts

import { Button } from '@mantine/core'
import classes from './Button-2025.module.css'

declare module '@mantine/core' {
  export interface ButtonProps {
    /**
     * Button variant following 2025 design guidelines
     * @default 'filled'
     */
    variant?: 'filled' | 'light' | 'outline' | 'transparent' | 'danger' | 'danger-secondary' | 'success' | 'warning'
  }
}

export const ButtonThemeKobo2025 = Button.extend({
  classNames: classes,
  vars: (theme, props) => {
    return {
      root: {
        // 2025 Design Guidelines Button Implementation
        '--button-height': props.size === 'xs' ? '28px' : 
                          props.size === 'sm' ? '32px' : 
                          props.size === 'md' ? '40px' : 
                          props.size === 'lg' ? '48px' : '40px',
        
        '--button-padding': props.size === 'xs' ? '0 12px' : 
                           props.size === 'sm' ? '0 16px' : 
                           props.size === 'md' ? '0 24px' : 
                           props.size === 'lg' ? '0 32px' : '0 24px',

        // Primary variant (main brand color)
        ...(props.variant === 'filled' && {
          '--button-bg': theme.colors.primaryBlue[5],
          '--button-hover': theme.colors.primaryBlue[6],
          '--button-active': theme.colors.primaryBlue[7],
          '--button-color': theme.colors.neutral[0],
          '--button-bd': theme.colors.primaryBlue[5],
        }),

        // Secondary variant (secondary brand color)
        ...(props.variant === 'light' && {
          '--button-bg': theme.colors.secondaryTeal[5],
          '--button-hover': theme.colors.secondaryTeal[6],
          '--button-active': theme.colors.secondaryTeal[7],
          '--button-color': theme.colors.neutral[0],
          '--button-bd': theme.colors.secondaryTeal[5],
        }),

        // Outline variant
        ...(props.variant === 'outline' && {
          '--button-bg': 'transparent',
          '--button-hover': theme.colors.primaryBlue[0],
          '--button-active': theme.colors.primaryBlue[1],
          '--button-color': theme.colors.primaryBlue[5],
          '--button-bd': theme.colors.primaryBlue[5],
        }),

        // Transparent/ghost variant
        ...(props.variant === 'transparent' && {
          '--button-bg': 'transparent',
          '--button-hover': theme.colors.primaryBlue[0],
          '--button-active': theme.colors.primaryBlue[1],
          '--button-color': theme.colors.primaryBlue[5],
          '--button-bd': 'transparent',
        }),

        // Success variant
        ...(props.variant === 'success' && {
          '--button-bg': theme.colors.success[5],
          '--button-hover': theme.colors.success[6],
          '--button-active': theme.colors.success[7],
          '--button-color': theme.colors.neutral[0],
          '--button-bd': theme.colors.success[5],
        }),

        // Warning variant
        ...(props.variant === 'warning' && {
          '--button-bg': theme.colors.warning[5],
          '--button-hover': theme.colors.warning[6],
          '--button-active': theme.colors.warning[7],
          '--button-color': theme.colors.neutral[9],
          '--button-bd': theme.colors.warning[5],
        }),

        // Danger variant (destructive actions)
        ...(props.variant === 'danger' && {
          '--button-bg': theme.colors.error[5],
          '--button-hover': theme.colors.error[6],
          '--button-active': theme.colors.error[7],
          '--button-color': theme.colors.neutral[0],
          '--button-bd': theme.colors.error[5],
        }),

        // Danger secondary variant
        ...(props.variant === 'danger-secondary' && {
          '--button-bg': 'transparent',
          '--button-hover': theme.colors.error[0],
          '--button-active': theme.colors.error[1],
          '--button-color': theme.colors.error[5],
          '--button-bd': theme.colors.error[5],
        }),
      },
    }
  },
})
