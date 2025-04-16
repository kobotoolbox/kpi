import { Menu } from '@mantine/core'
import classes from './Menu.module.css'

declare module '@mantine/core' {
  export interface MenuItemProps {
    variant?: 'danger'
  }
}

export const MenuThemeKobo = Menu.extend({
  classNames: classes,
})
