import React from 'react'
import cx from 'classnames'
import styles from './deletedAttachment.module.scss'

/**
 * Use this in a place that you would normally render attachment things (player,
 * image, etc.), but the attachment is deleted now. We have this silly component
 * so the things are consistent.
 */
export default function DeletedAttachment() {
  return (
    // We include the `deletedAttachment` class name so it's easier to style
    // this for parent component.
    <div className={cx([styles.deletedAttachment, 'deletedAttachment'])}>{t('Deleted')}</div>
  )
}
