import React from 'react'

import { observer } from 'mobx-react'
import Button from '#/components/common/button'
import sessionStore from '#/stores/session'

import styles from './modulePanelPage.module.scss'
import { canAccessModule } from './modulesConfig'

interface ModulePanelPageProps {
  moduleId: string
  moduleLabel: string
  panelId: string
  panelLabel: string
}

const ModulePanelPage = observer(function ModulePanelPage(props: ModulePanelPageProps) {
  const extraDetails =
    'extra_details' in sessionStore.currentAccount ? sessionStore.currentAccount.extra_details : undefined

  const hasAccess = canAccessModule(extraDetails, props.moduleId)
  const isPaymentPending = extraDetails?.payment_status === 'pending'
  const isPersonalAccount = extraDetails?.account_type === 'personal'

  if (!hasAccess) {
    return (
      <div className={styles.container}>
        <h1>{props.moduleLabel}</h1>
        <div className={styles.message}>
          <p>
            {isPaymentPending
              ? t('Your organizational subscription is almost ready. Confirm the payment to unlock this module.')
              : isPersonalAccount
                ? t('This module is available only to organizational accounts.')
                : t('This module is currently unavailable.')}
          </p>
          {isPaymentPending && (
            <div className={styles.actions}>
              <Button
                type='primary'
                size='l'
                label={t('Go to payment confirmation')}
                onClick={() => {
                  window.location.href = '/accounts/organizational-payment/'
                }}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h1>{props.moduleLabel}</h1>
      <h2>{props.panelLabel}</h2>
      <div className={styles.placeholder} aria-hidden='true' />
    </div>
  )
})

export default ModulePanelPage
