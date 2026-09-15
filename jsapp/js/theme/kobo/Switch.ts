import { Switch } from '@mantine/core'
import classes from './Switch.module.css'

export const SwitchThemeKobo = Switch.extend({
  classNames: classes,
  defaultProps: {
    size: 'md',
    // We signal state with the track colour and thumb position, no dot inside the thumb.
    withThumbIndicator: false,
  },
})
