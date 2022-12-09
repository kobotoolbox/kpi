import React from 'react';
import MfaSection from './mfa/mfaSection.component';
import PasswordSection from './password/passwordSection.component';
import ApiTokenSection from './apiToken/apiTokenSection.component';
import SsoSection from './sso/ssoSection.component';
import style from './securityRoute.module.scss';

export default function securityRoute() {
  return (
    <div className={style['security-section']}>
      <h1>Security</h1>
      <PasswordSection />
      <ApiTokenSection />
      <MfaSection />
      <SsoSection />
    </div>
  );
}
