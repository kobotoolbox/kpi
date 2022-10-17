import React from 'react';
import type {IconNames} from 'jsapp/fonts/k-icons';
import bem, {makeBem} from 'js/bem';
import Icon from 'jsapp/js/components/common/icon';

bem.KoboModal__header = makeBem(bem.KoboModal, 'header', 'header');
bem.KoboModal__headerIcon = makeBem(bem.KoboModal, 'header-icon', 'span');

export type KoboModalHeaderIconColors = 'blue' | 'red';

interface KoboModalHeaderProps {
  /** Optional icon displayed on the left of the title. */
  icon?: IconNames;
  /** Color of the optional icon. Defaults to "blue". */
  iconColor?: KoboModalHeaderIconColors;
  children: React.ReactNode;
}

export default function KoboModalHeader(props: KoboModalHeaderProps) {
  return (
    <bem.KoboModal__header>
      {props.icon &&
        <bem.KoboModal__headerIcon m={props.iconColor || 'blue'}>
          <Icon name={props.icon} size='s'/>
        </bem.KoboModal__headerIcon>
      }
      {props.children}
    </bem.KoboModal__header>
  );
}
