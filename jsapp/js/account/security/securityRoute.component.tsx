import React from 'react';
import MfaSection from './mfa/mfaSection.component';
import PasswordSection from './password/passwordSection.component';
import EmailSection from './email/emailSection.component';
import ApiTokenSection from './apiToken/apiTokenSection.component';
import SsoSection from './sso/ssoSection.component';
import style from './securityRoute.module.scss';
// import AccessLogSection from './accessLog/accessLog.component';
import AccessLogSection from './accessLog/refactoredAccessLog.component';

export default function securityRoute() {
  return (
    <div className={style['security-section']}>
      <h1>{t('Security')}</h1>
      <PasswordSection />
      <EmailSection />
      <ApiTokenSection />
      <MfaSection />
      <SsoSection />
      <AccessLogSection />
    </div>
  );
}
