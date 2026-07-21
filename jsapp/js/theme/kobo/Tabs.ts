import type { TabsVariant } from '@mantine/core'
import { Tabs } from '@mantine/core'
import classes from './Tabs.module.css'

type TabsVariantCustom = Extract<TabsVariant, 'default' | 'pills'> | 'bubble'
type TabsSizeCustom = 'sm' | 'md' | 'lg'

declare module '@mantine/core' {
  export interface TabsProps {
    variant?: TabsVariantCustom
    size?: TabsSizeCustom
  }
}

export const TabsThemeKobo = Tabs.extend({
  classNames: classes,
  defaultProps: {
    variant: 'default',
    size: 'sm',
  },
})
