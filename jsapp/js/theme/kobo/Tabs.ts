// eslint-disable-next-line no-restricted-imports -- Theme extender must import Mantine primitive directly.
import { Tabs } from '@mantine/core'
import type { TabsVariant } from '@mantine/core'
import classes from './Tabs.module.css'

type TabsVariantCustom = 'bubbles'

declare module '@mantine/core' {
  export interface TabsProps {
    variant?: TabsVariant | TabsVariantCustom
  }
}

export const TabsThemeKobo = Tabs.extend({
  classNames: classes,
  defaultProps: {
    variant: 'default',
  },
})
