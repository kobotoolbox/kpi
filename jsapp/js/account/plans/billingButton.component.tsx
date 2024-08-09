import cx from 'classnames';
import type {ButtonProps, ButtonType} from 'js/components/common/button';
import Button from 'js/components/common/button';
import React from 'react';
import styles from './billingButton.module.scss';

/**
 * The base button component that's used on the Plans/Add-ons pages.
 * This component exists to unify styling; other buttons on the billing
 * page that need reusable logic extend this component.
 */
export default function BillingButton(props: Partial<ButtonProps>) {
  let buttonType: ButtonType = 'primary';
  if (props.type) {
    buttonType = props.type;
  }

  return (
    <Button
      type={buttonType}
      size='l'
      {...props}
      className={cx([styles.button, props.className])}
      isFullWidth
    />
  );
}
