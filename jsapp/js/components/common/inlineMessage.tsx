import './inlineMessage.scss'

import React from 'react'

import cx from 'classnames'
import Icon from '#/components/common/icon'
import type { IconName } from '#/k-icons'

/** Influences the background color and the icon color */
export type InlineMessageType = 'default' | 'error' | 'success' | 'warning' | 'info'

interface InlineMessageProps {
  type: InlineMessageType
  message: React.ReactNode
  icon?: IconName
  /** Additional class names. */
  className?: string
  'data-cy'?: string
}

/**
 * An inline message component. It's a rounded corners box with a background and
 * an optional icon displayed on the left side.
 */
export default function InlineMessage(props: InlineMessageProps) {
  return (
    <figure className={cx(['k-inline-message', `k-inline-message--type-${props.type}`, props.className])}>
      {props.icon && <Icon name={props.icon} size='m' />}

      <p className='k-inline-message__message' data-cy={props['data-cy']}>
        {props.message}
      </p>
    </figure>
  )
}
