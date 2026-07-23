import { PasswordInput } from '@mantine/core'
// PasswordInput doesn't render through InputBase, so it misses InputBaseThemeKobo.
// Copy those defaults here (reusing the InputBase classes) so it matches TextInput.
// Focus styles come from focusRing.css via .mantine-PasswordInput-input.
import classes from './InputBase.module.css'

export const PasswordInputThemeKobo = PasswordInput.extend({
  defaultProps: {
    size: 'md',
    labelProps: {
      className: classes.label,
    },
    visibilityToggleButtonProps: {
      variant: 'transparent',
    },
    classNames: {
      input: classes.input,
      section: classes.section,
    },
  },
})
