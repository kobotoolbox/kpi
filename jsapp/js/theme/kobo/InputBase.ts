import { InputBase } from '@mantine/core'
import classes from './InputBase.module.css'

export const InputBaseThemeKobo = InputBase.extend({
  defaultProps: {
    size: 'md',
    classNames: {
      input: classes.input,
      section: classes.section,
      label: classes.label,
    },
  },
})
