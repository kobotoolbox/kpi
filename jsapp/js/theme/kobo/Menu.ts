import {Menu} from '@mantine/core';
import classes from './Menu.module.css';

declare module '@mantine/core' {
  export interface MenuItemProps {
    variant?: 'danger';
  }
}

export const MenuThemeKobo = Menu.extend({
  classNames: classes,
  vars: (theme) => {
    return {
      dropdown: {
        padding: 0,
        '--popover-shadow': `0 0 6px ${theme.colors.gray[4]}`,
        border: 'none',
      },
      divider: {
        borderColor: theme.colors.gray[6],
      },
      item: {
        fontSize: theme.fontSizes.md
      }
    };
  },
});
