import React from 'react';
import cx from 'classnames';
import styles from './avatar.module.scss';

export type AvatarSize = 'l' | 'm' | 's';

/**
 * A simple function that generates hsl color from given string. Saturation and
 * lightness is not random, just the hue.
 */
function stringToHSL(string: string, saturation: number, lightness: number) {
  let hash = 0;
  for (let i = 0; i < string.length; i++) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return `hsl(${(hash % 360)}, ${saturation}%, ${lightness}%)`;
}

interface AvatarProps {
  /**
   * First letter of the username would be used as avatar. Whole username would
   * be used to generate the color of the avatar.
   */
  username: string;
  /**
   * Username is not being displayed by default.
   */
  isUsernameVisible?: boolean;
  size: AvatarSize;
}

export default function Avatar(props: AvatarProps) {
  return (
    <div className={cx(styles.avatar, styles[`avatar-size-${props.size}`])}>
      <div
        className={styles.initials}
        style={{backgroundColor: `${stringToHSL(props.username, 80, 40)}`}}
      >
        {props.username.charAt(0)}
      </div>

      {props.isUsernameVisible &&
        <label>{props.username}</label>
      }
    </div>
  );
}
