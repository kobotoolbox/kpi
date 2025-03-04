import React, { useState, useEffect } from 'react'

import cx from 'classnames'
import Icon from '#/components/common/icon'
import sessionStore from '#/stores/session'
import { useSafeUsernameStorageKey } from '../hooks/useSafeUsernameStorageKey'
import styles from './newFeatureDialog.module.scss'

interface NewFeatureDialogProps {
  children: React.ReactNode
  /** Custom CSS for positioning root element. */
  rootClass?: string
  /** Custom CSS for positioning pointer element. */
  pointerClass?: string
  /** Custom CSS for positioning dialog element. */
  dialogClass?: string
  /**
   * Used to differentiate between dialogs for different features.
   * Tip: Use the feature name. It's added to the end of the localstorage key.
   * If two or more dialogs have the same featureKey, clicking one should dismiss all of them
   * for the current and future sessions of the presently logged-in user.
   */
  featureKey: string
  content: string
  supportArticle?: string
  /**
   * Manually disable the dialog. Useful if there are more than one for the
   * same feature on screen.
   */
  disabled?: boolean
}

/*
 * Custom dialog compoennt used to highlight new features. Must adjust poisiton
 * manually with a class prop.
 *
 * Styling tip: use rootClass, pointerClass, and/or dialogClass to change the position
 * of the dialog box to suit your needs.
 * - Adjusting `left` in pointerClass will move the ^ left/right
 * - Adjusting `margin-top` in dialogClass will move the dialog (and the pointer) up/down
 */
export default function NewFeatureDialog({
  children,
  rootClass = '',
  pointerClass = '',
  dialogClass = '',
  featureKey,
  content,
  supportArticle,
  disabled = false,
}: NewFeatureDialogProps) {
  const [showDialog, setShowDialog] = useState<boolean>(false)
  const username = sessionStore.currentAccount.username
  const localStorageKey = useSafeUsernameStorageKey(`kpiDialogStatus-${featureKey}`, username)

  /*
   * Show the dialog if we have a key to check and localstorage has an entry for this
   * user/feature combination, hide it otherwise
   */
  useEffect(() => {
    const dialogStatus = localStorageKey && localStorage.getItem(localStorageKey)
    setShowDialog(!dialogStatus)
  }, [disabled, localStorageKey])

  // Close the dialog box and store that we've closed it
  function closeDialog() {
    if (localStorageKey) {
      localStorage.setItem(localStorageKey, 'shown')
      setShowDialog(false)
    }
  }

  return (
    <div className={cx(styles.root, rootClass)}>
      <div className={styles.wrapper}>{children}</div>
      {showDialog && !disabled && (
        <div className={cx(styles.dialog, dialogClass)}>
          <div className={cx(styles.pointer, pointerClass)} />
          <div className={styles.header}>
            {t('New feature')}
            <button className={styles.closeButton} onClick={closeDialog}>
              <Icon name='close' size='m' />
            </button>
          </div>
          <div>
            {content}
            &nbsp;
            {supportArticle && (
              <a href={supportArticle} target='_blank' className={styles.support}>
                {t('Learn more')}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
