import {Table} from '@mantine/core';

export const TableThemeKobo = Table.extend({
  defaultProps: {
    withTableBorder: true,
    // Disabled default row borders, because `borderCollapse` override broke
    // them, and they will be added in some custom way.
    withRowBorders: false,
    captionSide: 'top',
  },
  styles: (theme) => {
    return {
      table: {
        backgroundColor: theme.colors.gray[9],
        borderCollapse: 'separate',
        borderRadius: theme.radius.md,
      },
      thead: {
        backgroundColor: theme.colors.gray[8],
      },
      th: {
        fontSize: theme.fontSizes.sm,
        color: theme.colors.gray[2],
        fontWeight: '400',
      },
      td: {
        fontSize: theme.fontSizes.md,
        borderTopWidth: '1px',
        borderTopColor: theme.colors.gray[7],
        borderTopStyle: 'solid',
      },
    };
  },
  vars: (theme) => {
    return {
      table: {
        '--table-border-color': theme.colors.gray[7],
      },
    };
  },
});
