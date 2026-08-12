// eslint-disable-next-line no-restricted-imports -- Theme extender must import Mantine primitive directly.
import { Pill } from '@mantine/core'
import classes from './Pill.module.css'

type PillVariantCustom = 'gray-light' | 'amber-light'

declare module '@mantine/core' {
  export interface PillProps {
    variant?: PillVariantCustom
  }
}

export const PillThemeKobo = Pill.extend({
  classNames: classes,
  defaultProps: {
    variant: 'gray-light',
  },
})
