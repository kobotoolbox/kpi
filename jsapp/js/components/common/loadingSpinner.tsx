import React from 'react';
import cx from 'classnames';
import styles from './loadingSpinner.module.scss';
import Icon from 'js/components/common/icon';

export type LoadingSpinnerType = 'regular' | 'big';

interface LoadingSpinnerProps {
  /** Changes the looks of the spinner animation. */
  type?: LoadingSpinnerType;
  /**
   * There is a default message if nothing is provided. If you want to hide
   * the message completely, pass `false`.
   */
  message?: string | boolean;
  'data-cy'?: string;
  /** Additional class names. */
  className?: string;
}

/**
 * Displays a spinner animation above a customizable yet optional message.
 */
export default function LoadingSpinner(props: LoadingSpinnerProps) {
  const spinnerType: LoadingSpinnerType = props.type || 'regular';
  const message = props.message || t('loading…');

  return (
    <div
      className={cx({
        // HACK: we need a literal `loadingSpinner` here for some old code
        // places that display `<LoadingSpinner>` directly inside
        // `<bem.FormView>`, see `_kobo.form-view.scss` for details.
        // DO NOT USE, if needed go for the custom `className` prop.
        loadingSpinner: true,
        [styles.loading]: true,
        [styles.loadingTypeRegular]: spinnerType === 'regular',
        [styles.loadingHasDefaultMessage]: props.message === undefined,
      }, props.className)}
      data-cy={props['data-cy']}
    >
      <div className={styles.loadingInner}>
        {spinnerType === 'regular' && (
          <Icon name='spinner' size='xl' className='k-spin' />
        )}

        {spinnerType === 'big' && <span className={styles.bigSpinner} />}

        {props.message !== false && (
          <span className={styles.loadingMessage}>{message}</span>
        )}
      </div>
    </div>
  );
}
