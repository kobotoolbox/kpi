import { PasswordInput } from '@mantine/core'
// PasswordInput doesn't render through InputBase, so it misses InputBaseThemeKobo.
// Copy those defaults here (reusing the InputBase classes) so it matches TextInput.
// Focus styles come from focusRing.css via .mantine-PasswordInput-input.
import classes from './InputBase.module.css'

export const PasswordInputThemeKobo = PasswordInput.extend({
  defaultProps: {
    size: 'md',
    dir: 'auto',
    labelProps: {
      className: classes.label,
    },
    visibilityToggleButtonProps: {
      variant: 'transparent',
      tabIndex: 0,
      'aria-label': t('Toggle password visibility'),
    },
    classNames: {
      input: classes.input,
      section: classes.section,
      visibilityToggle: classes.visibilityToggle,
    },
  },
})
