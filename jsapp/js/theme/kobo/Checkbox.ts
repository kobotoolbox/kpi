// eslint-disable-next-line no-restricted-imports -- The theme extends the Mantine component itself
import { Checkbox } from '@mantine/core'
import classes from './Checkbox.module.css'

export const CheckboxThemeKobo = Checkbox.extend({
  classNames: classes,
  defaultProps: { size: 'md' },
})
