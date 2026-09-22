import type { ButtonVariant } from '@mantine/core'
// eslint-disable-next-line no-restricted-imports -- Theme extender must import Mantine primitive directly.
import { Button, rem } from '@mantine/core'
import classes from './Button.module.css'

type ButtonVariantCustom =
  | Extract<ButtonVariant, 'filled' | 'light' | 'outline' | 'transparent'>
  | 'danger'
  | 'danger-secondary'
  | 'danger-transparent'

declare module '@mantine/core' {
  export interface ButtonProps {
    variant?: ButtonVariantCustom
    // size?: ... // Can override ButtonFactory subset of ButtonProps only. TODO: Figure out how to forbid unused sizes.
  }
}

export const ButtonThemeKobo = Button.extend({
  classNames: classes,
  defaultProps: {
    variant: 'filled',
    // Keep in sync with `DEFAULT_SIZE` in components/common/ButtonNew.tsx, which
    // needs the same value to pick an icon size.
    size: 'md',
  },
  vars: (theme, props) => {
    return {
      root: {
        // Heights and paddings come from our Figma designs. Keep heights in sync with
        // `min-width` in Button.module.css, which stops narrow buttons from going
        // taller than wide. Vertical padding is implied by the height — no var for it.
        '--button-height-sm': rem(28),
        '--button-height-md': rem(34),
        '--button-height-lg': rem(40),
        '--button-padding-x-sm': rem(14),
        '--button-padding-x-md': rem(18),
        '--button-padding-x-lg': rem(22),
        '--button-bd': '0',

        // TODO: Consider standardizing global colors, or using them in a more standard way.
        ...(props.variant === 'filled' && {
          '--button-hover': theme.colors.blue[5],
        }),
        ...(props.variant === 'light' && {
          '--button-color': theme.colors.blue[5],
          '--button-bg': theme.colors.blue[9],
          '--button-hover': theme.colors.blue[8],
        }),
        ...(props.variant === 'outline' && {
          '--button-bg': theme.colors.gray[9],
          '--button-bd': '1px solid var(--mantine-color-gray-6)',
          '--button-color': theme.colors.gray[2],
          '--button-hover': theme.colors.gray[7],
        }),
        ...(props.variant === 'transparent' && {
          '--button-color': theme.colors.blue[4],
          '--button-hover-color': theme.colors.blue[3],
        }),
        ...(props.variant === 'danger' && {
          '--button-color': 'var(--mantine-color-white)',
          '--button-bg': theme.colors.red[6],
          '--button-hover': theme.colors.red[5],
        }),
        ...(props.variant === 'danger-secondary' && {
          '--button-color': theme.colors.red[6],
          '--button-bg': theme.colors.red[9],
          '--button-hover': theme.colors.red[8],
        }),
        ...(props.variant === 'danger-transparent' && {
          '--button-color': theme.colors.red[6],
          '--button-hover-color': theme.colors.red[4],
          '--button-bg': 'transparent',
          '--button-hover': 'transparent',
        }),
      },
    }
  },
})
