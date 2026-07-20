import { Textarea } from '@mantine/core'
import classes from './InputBase.module.css'

// Textarea renders InputBase internally and uses the shared Kobo input theme.
// Focus styles are applied globally via focusRing.css targeting .mantine-Textarea-input
export const TextareaThemeKobo = Textarea.extend({
  defaultProps: {
    size: 'md',
  },
  classNames: classes,
})
