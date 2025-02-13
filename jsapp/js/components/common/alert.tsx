import {Alert as AlertMantine} from '@mantine/core';
import type {AlertProps as AlertPropsMantine} from '@mantine/core/lib/components';
import Icon from './icon';
import type {IconName} from 'jsapp/fonts/k-icons';
import {forwardRef} from 'react';

export type AlertType = 'default' | 'error' | 'success' | 'warning' | 'info';

// We only use the Mantine variant 'light', so we omit the prop here.
// We also remove the color prop in favor of a custom 'type' prop, since we are setting
// the component colors by hand instead of using Mantine's color handling 
export interface AlertProps extends Omit<AlertPropsMantine, 'icon' | 'variant' | 'color'> {
  iconName?: IconName;
  type: AlertType;
}

const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({iconName, ...props}, ref) => {
    const icon = iconName ? <Icon name={iconName} size='m' /> : null;
    return <AlertMantine {...props} icon={icon} ref={ref} />;
  }
);

export default Alert;
