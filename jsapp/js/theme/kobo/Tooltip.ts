import { Tooltip } from '@mantine/core'
import { KOBO_Z_INDEX } from './zIndex'

export const TooltipThemeKobo = Tooltip.extend({
  defaultProps: {
    offset: { mainAxis: -4 },
    zIndex: KOBO_Z_INDEX.tooltip,
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
    }
  },
})
