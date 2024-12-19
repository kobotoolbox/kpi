import {Tooltip} from '@mantine/core';

export const TooltipThemeKobo = Tooltip.extend({
  defaultProps: {
    offset: {mainAxis: -4},
    position: 'bottom',
    withArrow: true,
    arrowSize: 8,
    // arrowPosition: 'center',
  },
  vars: (theme) => {
    return {
      tooltip: {
        '--tooltip-bg': theme.colors.gray[2],
        '--tooltip-color': 'var(--mantine-color-white)',
        '--tooltip-radius': theme.radius.xs,
      },
    };
  },

});
