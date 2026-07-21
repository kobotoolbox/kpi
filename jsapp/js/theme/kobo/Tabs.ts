import type { TabsVariant } from '@mantine/core'
// eslint-disable-next-line no-restricted-imports -- Theme extender must import Mantine primitive directly.
import { Tabs } from '@mantine/core'
import classes from './Tabs.module.css'

// Allow Kobo's built-in variants plus our custom "bubble" variant.
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
  vars: (theme, props) => {
    return {
      root: {
        '--tab-border-color': theme.colors.gray[6],

        ...(props.variant === 'default' && {
          '--tabs-color': theme.colors.blue[5],
          '--tab-color': theme.colors.gray[2],
          '--tab-hover-color': 'transparent',
        }),

        ...(props.variant === 'pills' && {
          '--tabs-color': theme.colors.blue[5],
          '--tabs-text-color': theme.colors.gray[9],
          '--tab-color': theme.colors.gray[2],
          '--tab-hover-color': theme.colors.gray[8],
        }),

        ...(props.variant === 'bubble' && {
          '--tabs-color': theme.colors.blue[9],
          '--tabs-text-color': theme.colors.blue[5],
          '--tab-color': theme.colors.gray[2],
          '--tab-hover-color': theme.colors.gray[8],
        }),
      },
    }
  },
})
