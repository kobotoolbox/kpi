import {Table} from '@mantine/core';

export const TableThemeKobo = Table.extend({
  defaultProps: {
    withTableBorder: true,
    // Disabled default row borders, because `borderCollapse` override broke
    // them, and they will be added in some custom way.
    withRowBorders: false,
    captionSide: 'top',
  },
  vars: (theme) => {
    return {
      table: {
        '--table-border-color': theme.colors.gray[7],
      },
    };
  },
});
