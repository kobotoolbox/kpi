import { Divider } from '@mantine/core'
import classes from './Divider.module.css'

export const DividerThemeKobo = Divider.extend({
  classNames: classes,
  defaultProps: {
    color: 'gray.5',
  },
})
