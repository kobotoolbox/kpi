import type {ReactElement} from 'react';
import React from 'react';
import styles from './centeredMessage.module.scss';

interface CenteredMessageProps {
  message: ReactElement<any, any> | string;
}

/**
 * A centered message component.
 */
export default function CenteredMessage(props: CenteredMessageProps) {
  return (
    <figure className={styles.centeredMessage}>
      <div className={styles.centeredMessageInner}>
        {props.message}
      </div>
    </figure>
  );
}
