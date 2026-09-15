import { ScrollArea } from '@mantine/core'
import classes from './ScrollArea.module.css'

export const ScrollAreaThemeKobo = ScrollArea.extend({
  classNames: classes,
  defaultProps: { offsetScrollbars: true },
})
