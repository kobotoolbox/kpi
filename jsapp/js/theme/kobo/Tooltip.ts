import { Tooltip } from '@mantine/core'

export const TooltipThemeKobo = Tooltip.extend({
  defaultProps: {
    offset: { mainAxis: 1 },
    position: 'bottom',
    withArrow: true,
    arrowSize: 8,
    zIndex: 2000,
    // arrowPosition: 'center',
  },
  vars: (theme) => {
    return {
      tooltip: {
        '--tooltip-bg': theme.colors.gray[2],
        '--tooltip-color': 'var(--mantine-color-white)',
        '--tooltip-radius': theme.radius.xs,
      },
    }
  },
})
