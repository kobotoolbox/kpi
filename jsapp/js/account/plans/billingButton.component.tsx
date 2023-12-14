import type {ButtonProps} from 'js/components/common/button';
import Button from 'js/components/common/button';
import React from 'react';
import {button} from './billingButton.module.scss';

/**
 * The base button component that's used on the Plans/Add-ons pages.
 * This component exists to unify styling; other buttons on the billing
 * page that need reusable logic extend this component.
 */
export default function BillingButton(props: Partial<ButtonProps>) {
  return (
    <Button
      type='full'
      color='blue'
      size='l'
      {...props}
      classNames={props.classNames ? [button, ...props.classNames] : [button]}
    />
  );
}
