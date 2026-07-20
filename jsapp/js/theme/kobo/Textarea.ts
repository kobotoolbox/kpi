import { Textarea } from '@mantine/core'
import classes from './Textarea.module.css'

// Textarea renders InputBase internally and uses static class names.
// Focus styles are applied globally via focusRing.css targeting .mantine-Textarea-input
export const TextareaThemeKobo = Textarea.extend({
  defaultProps: {
    size: 'md',
  },
  classNames: classes,
})
