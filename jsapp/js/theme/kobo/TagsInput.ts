import { TagsInput } from '@mantine/core'
import classes from './TagsInput.module.css'

export const TagsInputThemeKobo = TagsInput.extend({
  classNames: classes,
  defaultProps: {size: 'md'}
})
