import {createTheme, rem} from '@mantine/core';
import {ButtonThemeKobo} from './Button';
import {TableThemeKobo} from './Table';
import {TooltipThemeKobo} from './Tooltip';
import { MenuThemeKobo } from './menu';

export const themeKobo = createTheme({
  primaryColor: 'blue',
  colors: {
    gray: [
      'hsl(225deg 17% 14%)', // [0] #1e212a, $kobo-gray-900, (accessible) our black, very very rare, only use if necessary for contrast
      'hsl(225deg 16% 24%)', // [1] #333847, $kobo-gray-800, (accessible) active text, important text, text on background, top navigation background
      'hsl(226deg 16% 42%)', // [2] #5a627d, $kobo-gray-700, (accessible) default text, inactive text, options text, buttons text, tabs text, notifications background, hover for popups and dropdowns
      'hsl(225deg 16% 58%)', // [3] #828ba5, $kobo-gray-600, (readable) clickable icons on hover
      'hsl(226deg 16% 70%)', // [4] #a6acbf, $kobo-gray-500, icons default (clickable), arrows and indicators default
      'hsl(228deg 16% 82%)', // [5] #cacdd9, $kobo-gray-400, inactive icons, some decorative icons
      'hsl(227deg 18% 90%)', // [6] #e1e3ea, $kobo-gray-300, scroll bars, table lines, dividers, background of clickable icons on hover when also in a highlighted table row
      'hsl(228deg 16% 94%)', // [7] #edeef2, $kobo-gray-200, default light background, icons on hover, sidebar menu, table headings, …
      'hsl(240deg 20% 98%)', // [8] #f9f9fb, $kobo-gray-100, table row highlight on hover
      'hsl(0deg 0% 100%)', // [9] #ffffff, white background
    ],
    blue: [
      '#000',
      '#000',
      '#000',
      '#000',
      'hsl(207deg 77% 32%)', // #135991,
      'hsl(207deg 77% 43%)', // #1977c2,
      'hsl(207deg 90% 54%)', // #2095f3,
      'hsl(207deg 90% 77%)', // #8fcaf9, (previously $kobo-alt-blue)
      'hsl(207deg 88% 91%)', // #d2e9fc, (previously $kobo-mid-blue)
      'hsl(206deg 84% 95%)', // #e8f4fd, (previously $kobo-light-blue)
    ],
    teal: [
      '#000',
      '#000',
      'hsl(185deg 57% 25%)', // #1b5e64
      'hsl(185deg 57% 35%)', // #26838c
      'hsl(185deg 57% 57%)', // #52c5d0
      'hsl(186deg 57% 75%)', // #9bdde4
      'hsl(185deg 58% 85%)', // #c3ebef
      'hsl(188deg 60% 95%)', // #ebf8fa
      '#000',
      '#000',
    ],
    red: [
      '#000',
      '#000',
      '#000',
      '#000',
      '#000',
      'hsl(0deg 100% 26%)', // #850000
      'hsl(0deg 100% 31%)', // #9d0000
      'hsl(0deg 100% 75%)', // #ff8080
      'hsl(0deg 100% 90%)', // #ffcccc
      'hsl(0deg 100% 96%)', // #ffe9e9
    ],
  },

  // Typography
  scale: 16 / 14, // Because old ways set base font to 14px instead of standard 16px.
  fontFamily: '"Roboto", sans-serif',
  fontFamilyMonospace: 'Roboto Mono, monospace',
  fontSizes: {
    xs: rem(11), // TODO: For now implied from button sizes.
    sm: rem(13), // TODO: For now implied from button sizes.
    md: rem(14), // TODO: For now implied from button sizes.
    lg: rem(16),
    xl: rem(18),
  },
  lineHeights: {
  },
  headings: {
    fontWeight: '500',
  },
  // headings: {
  //   fontFamily: '"Roboto", sans-serif',
  // },

  defaultRadius: 'md',
  radius: {
    xs: '2px',
    sm: '4px',
    md: '6px',
    lg: '10px',
    xl: '14px',
  },

  components: {
    Button: ButtonThemeKobo,
    Menu: MenuThemeKobo,
    Tooltip: TooltipThemeKobo,
    Table: TableThemeKobo,
  },
});
