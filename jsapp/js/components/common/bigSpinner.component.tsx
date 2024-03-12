import React from 'react';
import styles from './bigSpinner.module.scss';

/** Displays an animated blue spinner - for white backgrounds only. */
export default function BigSpinner() {
  return (
    <span className={styles.bigSpinner}/>
  );
}
