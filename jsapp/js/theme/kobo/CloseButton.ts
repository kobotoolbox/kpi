import { CloseButton, rem } from '@mantine/core'
import classes from './CloseButton.module.css'

export const CloseButtonThemeKobo = CloseButton.extend({
  defaultProps: {
    variant: 'transparent',
  },
  classNames: classes,
  vars: (theme) => {
    return {
      root: {
        '--cb-size': rem(20),
        '--cb-icon-size': rem(20),
        '--cb-color': theme.colors.gray[4],
        '--cb-hover-color': theme.colors.blue[5],
      },
    }
  },
})
