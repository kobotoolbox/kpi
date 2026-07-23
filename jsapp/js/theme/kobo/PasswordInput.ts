import { PasswordInput } from '@mantine/core'
import classes from './InputBase.module.css'

export const PasswordInputThemeKobo = PasswordInput.extend({
  defaultProps: {
    size: 'md',
  },
  classNames: {
    input: classes.input,
    innerInput: classes.input,
    section: classes.section,
    visibilityToggle: classes.visibilityToggle,
  },
})
