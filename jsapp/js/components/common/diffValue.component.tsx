import React from 'react';
import cx from 'classnames';
import styles from './diffValue.module.scss';

interface DiffValueProps {
  before: React.ReactNode;
  after: React.ReactNode;
  isInline?: boolean;
}

/**
 * This component displays a diff of two pieces of text. One (`before`) is red
 * and has a strikethrough, and the other (`after`) is green.
 *
 * TODO (some ideas for future):
 * - Allow passing just the `before`, so that this could be used more
 *   organically
 * - Introduce some more complex way of showing the partial differences between
 *   two pieces of text
 */
export default function DiffValue(props: DiffValueProps) {
  return (
    <span className={cx(styles.root, {[styles.isInline]: props.isInline})}>
      <span className={styles.before}>{props.before}</span>
      <span className={styles.after}>{props.after}</span>
    </span>
  );
}
