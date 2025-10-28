import { ThemeIcon, rem } from '@mantine/core'

export const ThemeIconThemeKobo = ThemeIcon.extend({
  vars: (theme, props) => {
    return {
      root: {
        '--ti-size-sm': rem(28),
        '--ti-size-md': rem(32),
        '--ti-size-lg': rem(38),

        ...(props.variant === 'light' && {
          '--ti-color': theme.colors.blue[4],
          '--ti-bg': theme.colors.blue[9],
        }),
        ...(props.variant === 'light-teal' && {
          '--ti-color': theme.colors.teal[4],
          '--ti-bg': theme.colors.teal[6],
        }),
        ...(props.variant === 'transparent' && {
          '--ti-color': theme.colors.blue[4],
        }),
        ...(props.variant === 'danger' && {
          '--ti-color': 'var(--mantine-color-white)',
          '--ti-bg': theme.colors.red[6],
        }),
        ...(props.variant === 'danger-secondary' && {
          '--ti-color': theme.colors.red[5],
          '--ti-bg': theme.colors.red[9],
        }),
      },
    }
  },
})
