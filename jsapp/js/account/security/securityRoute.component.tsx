// Libraries
import React from 'react';

// Partial components
import MfaSection from './mfa/mfaSection.component';
import PasswordSection from './password/passwordSection.component';
import EmailSection from './email/emailSection.component';
import ApiTokenSection from './apiToken/apiTokenSection.component';
import SsoSection from './sso/ssoSection.component';
import AccessLogsSection from './accessLogs/accessLogsSection.component';

// Styles
import styles from './securityRoute.module.scss';

export default function securityRoute() {
  return (
    <div className={styles.securityRouteRoot}>
      <header className={styles.securityHeader}>
        <h2 className={styles.securityHeaderText}>
          {t('Security')}
        </h2>
      </header>

      <PasswordSection />

      <EmailSection />

      <ApiTokenSection />

      <MfaSection />

      <SsoSection />

      <AccessLogsSection />
    </div>
  );
}
