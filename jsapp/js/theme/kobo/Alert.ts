import { Alert } from '@mantine/core'
import type { AlertType } from '#/components/common/alert'
import classes from './Alert.module.css'

declare module '@mantine/core' {
  export interface AlertProps {
    type: AlertType
  }
}

export const AlertThemeKobo = Alert.extend({
  classNames: classes,
  vars: (theme, props) => {
    return {
      root: {
        ...(props.type === 'default' && {
          '--alert-bg': theme.colors.gray[7],
          '--alert-color': theme.colors.gray[4],
        }),
        ...(props.type === 'error' && {
          '--alert-bg': theme.colors.red[9],
          '--alert-color': theme.colors.red[7],
        }),
        ...(props.type === 'info' && {
          '--alert-bg': theme.colors.blue[9],
          '--alert-color': theme.colors.blue[6],
        }),
        ...(props.type === 'success' && {
          '--alert-bg': theme.colors.teal[6],
          '--alert-color': theme.colors.teal[4],
        }),
        ...(props.type === 'warning' && {
          '--alert-bg': theme.colors.amber[7],
          '--alert-color': theme.colors.amber[6],
        }),
      },
    }
  },
})
