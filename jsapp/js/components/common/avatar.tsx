import {stringToColor} from 'jsapp/js/utils';
import React from 'react';
import styles from './avatar.module.scss';

interface AvatarProps {
  username: string;
}

export default function Avatar(props: AvatarProps) {
  return (
    <div className={styles.root}>
      <div className={styles.initials} style={{background: `#${stringToColor(props.username)}`}}>
        {props.username.charAt(0)}
      </div>

      <label>{props.username}</label>
    </div>
  );
}
