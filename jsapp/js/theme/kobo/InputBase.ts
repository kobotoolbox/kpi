import { InputBase } from '@mantine/core'
import classes from './InputBase.module.css'

export const InputBaseThemeKobo = InputBase.extend({
  defaultProps: {
    size: 'md',
    // Let the browser pick the text direction from the user's own content, so
    // RTL answers read correctly in an otherwise LTR interface. Goes through
    // `attributes` because `dir` isn't part of `InputBaseProps`.
    attributes: {
      input: { dir: 'auto' },
    },
    labelProps: {
      className: classes.label,
    },
    classNames: {
      input: classes.input,
      section: classes.section,
    },
  },
})
