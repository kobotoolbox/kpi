import React from 'react'

import { observer } from 'mobx-react-lite'
import LoadingSpinner from '#/components/common/loadingSpinner'
import envStore from '#/envStore'
import AccessLogsSection from './accessLogs/accessLogsSection.component'
import ApiTokenSection from './apiToken/apiTokenSection.component'
import EmailSection from './email/emailSection.component'
import MfaSection from './mfa/mfaSection.component'
import PasswordSection from './password/passwordSection.component'
import styles from './securityRoute.module.scss'
import SsoSection from './sso/ssoSection.component'

export default observer(function securityRoute() {
  if (!envStore.isReady) {
    return <LoadingSpinner />
  }

  return (
    <div className={styles.securityRouteRoot}>
      <header className={styles.securityHeader}>
        <h2 className={styles.securityHeaderText}>{t('Security')}</h2>
      </header>

      <PasswordSection />

      <EmailSection />

      <ApiTokenSection />

      <MfaSection />

      <SsoSection />

      <AccessLogsSection />
    </div>
  )
})
