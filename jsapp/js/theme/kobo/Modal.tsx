import {Modal} from '@mantine/core';
import Icon from 'jsapp/js/components/common/icon';
import classes from './Modal.module.css';

export const ModalThemeKobo = Modal.extend({
  defaultProps: {
    closeButtonProps: {
      icon: <Icon name='close' />,
    },
    overlayProps: {
      backgroundOpacity: 0.5,
      color: 'var(--mantine-color-blue-9)',
      zIndex: 3000,
    },
    zIndex: 4000,
  },
  classNames: classes,
});
