import React from 'react';
import classNames from 'classnames';
import {ButtonToIconMap} from 'js/components/common/button';
import styles from './badge.module.scss';
import type {IconName} from 'jsapp/fonts/k-icons';
import Icon from './icon';
import type {IconSize} from './icon';

export type BadgeColor = 'cloud' | 'light-amber' | 'light-blue' | 'light-teal';
export type BadgeSize = 'l' | 'm' | 's';

export const BadgeToIconMap: Map<BadgeSize, IconSize> = new Map();
BadgeToIconMap.set('l', 'm');
BadgeToIconMap.set('m', 's');
BadgeToIconMap.set('s', 'xs');

interface BadgeProps {
  color: BadgeColor;
  size: BadgeSize;
  icon?: IconName;
  label: React.ReactNode;
}

export default function Badge(props: BadgeProps) {
  return (
    <div className={classNames([
      styles.root,
      styles[`color-${props.color}`],
      styles[`size-${props.size}`],
    ])}>
      {props.icon &&
        <Icon
          size={ButtonToIconMap.get(props.size)}
          classNames={[styles.icon]}
          name={props.icon}
        />
      }
      <label className={styles.label}>{props.label}</label>
    </div>
  );
}
