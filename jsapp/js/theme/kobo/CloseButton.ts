import { CloseButton, rem } from '@mantine/core'
import classes from './CloseButton.module.css'

export const CloseButtonThemeKobo = CloseButton.extend({
  classNames: classes,
  vars: (theme) => {
    return {
      root: {
        '--cb-size': rem(32),
        '--cb-color': theme.colors.gray[4],
        '--cb-hover-color': theme.colors.blue[5],
        '--cb-hover-bg': theme.colors.gray[8],
      },
    }
  },
})
