import React from 'react';
import MfaSection from './mfa/mfaSection.component';
import PasswordSection from './password/passwordSection.component';
import style from './securityRoute.module.scss';

export default function securityRoute() {
  return (
    <div className={style['security-section']}>
      <h1>Security</h1>
      <PasswordSection />
      <MfaSection />
    </div>
  );
}
