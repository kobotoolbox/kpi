import React from 'react';
import cx from 'classnames';
import {ButtonToIconMap} from 'js/components/common/button';
import styles from './badge.module.scss';
import type {IconName} from 'jsapp/fonts/k-icons';
import Icon from './icon';
import type {IconSize} from './icon';

export type BadgeColor =
  | 'light-storm'
  | 'light-amber'
  | 'light-blue'
  | 'light-red'
  | 'light-teal';
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
  /**
   * Use it to ensure that the badge will always be display in whole. Without
   * this (the default behaviour) the badge will take as much space as it gets,
   * and hide overflowing content with ellipsis.
   */
  disableShortening?: boolean;
}

export default function Badge(props: BadgeProps) {
  return (
    <div
      className={cx([
        styles.root,
        styles[`color-${props.color}`],
        styles[`size-${props.size}`],
      ], {[styles.disableShortening]: props.disableShortening})}
    >
      {props.icon && (
        <Icon
          size={ButtonToIconMap.get(props.size)}
          className={styles.icon}
          name={props.icon}
        />
      )}
      <span className={styles.label}>{props.label}</span>
    </div>
  );
}
