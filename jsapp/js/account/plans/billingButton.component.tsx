import React from 'react'

import cx from 'classnames'
import type { ButtonProps, ButtonType } from '#/components/common/button'
import Button from '#/components/common/button'
import styles from './billingButton.module.scss'

/**
 * The base button component that's used on the Plans/Add-ons pages.
 * This component exists to unify styling; other buttons on the billing
 * page that need reusable logic extend this component.
 * @deprecated Use new mantine buttons and do not abstract them like this component attempts to do
 */
export default function BillingButton(props: Partial<ButtonProps>) {
  let buttonType: ButtonType = 'primary'
  if (props.type) {
    buttonType = props.type
  }

  return <Button type={buttonType} size='l' {...props} className={cx([styles.button, props.className])} />
}
