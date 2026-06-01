// eslint-disable-next-line no-restricted-imports -- Theme extender must import Mantine primitive directly.
import { TagsInput } from '@mantine/core'
import classes from './TagsInput.module.css'

export const TagsInputThemeKobo = TagsInput.extend({
  classNames: classes,
  defaultProps: { size: 'md' },
})
