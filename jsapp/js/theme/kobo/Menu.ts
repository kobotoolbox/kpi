import { Menu } from '@mantine/core'
import classes from './Menu.module.css'

declare module '@mantine/core' {
  export interface MenuItemProps {
    variant?: 'danger'
  }
}

export const MenuThemeKobo = Menu.extend({
  classNames: classes,
  vars: (theme) => {
    return {
      dropdown: {
        '--menu-item-hover': theme.colors.gray[8],
        '--menu-item-color': theme.colors.gray[1],
      },
    }
  },
})
