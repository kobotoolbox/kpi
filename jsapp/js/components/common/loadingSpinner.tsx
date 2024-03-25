import React from 'react';
import cx from 'classnames';
import styles from './loadingSpinner.module.scss';
import Icon from 'js/components/common/icon';

export type LoadingSpinnerType = 'regular' | 'big';

interface LoadingSpinnerProps {
  type?: LoadingSpinnerType;
  message?: string;
  /**
   * Most of the times we want a message, either custom or default one, but
   * sometimes we want just the spinner. We need a boolean to hide it, because
   * component has a fallback message.
   */
  hideMessage?: boolean;
  'data-cy'?: string;
}

export default function LoadingSpinner(props: LoadingSpinnerProps) {
  const spinnerType: LoadingSpinnerType = props.type || 'regular';

  const message = props.message || t('loading…');

  return (
    <div
      className={cx({
        [styles.loading]: true,
        [styles.loadingTypeRegular]: spinnerType === 'regular',
        [styles.loadingHasDefaultMessage]: !props.hideMessage && !props.message,
      })}
      data-cy={props['data-cy']}
    >
      <div className={styles.loadingInner}>
        {spinnerType === 'regular' && (
          <Icon name='spinner' size='xl' classNames={['k-spin']} />
        )}

        {spinnerType === 'big' && (
          <span className={styles.bigSpinner} />
        )}

        {!props.hideMessage && (
          <span className={styles.loadingMessage}>{message}</span>
        )}
      </div>
    </div>
  );
}
