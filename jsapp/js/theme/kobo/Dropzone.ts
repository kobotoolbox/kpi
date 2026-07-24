import { Dropzone } from '@mantine/dropzone'
import classes from './Dropzone.module.css'

export const DropzoneThemeKobo = Dropzone.extend({
  classNames: {
    root: classes.root,
  },
  defaultProps: {
    radius: 'sm',
    p: 'lg',
  },
})
