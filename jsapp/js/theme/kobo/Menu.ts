// eslint-disable-next-line no-restricted-imports -- Theme extender must import Mantine primitive directly.
import { Menu } from '@mantine/core'
import classes from './Menu.module.css'
import { KOBO_Z_INDEX } from './zIndex'

declare module '@mantine/core' {
  export interface MenuItemProps {
    variant?: 'danger'
  }
}

export const MenuThemeKobo = Menu.extend({
  classNames: classes,
  defaultProps: {
    // Dropdowns render into `<body>`, so Mantine's default (300) hides them behind
    // a modal or a fullscreen view (`.form-view--fullscreen` is 1051).
    zIndex: KOBO_Z_INDEX.dropdown,
  },
  vars: (theme) => {
    return {
      dropdown: {
        '--menu-item-hover': theme.colors.gray[8],
        '--menu-item-color': theme.colors.gray[1],
      },
    }
  },
})
