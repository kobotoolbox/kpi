// Libraries
import React from 'react';

// Partial components
import {NavLink} from 'react-router-dom';
import Button from 'jsapp/js/components/common/button';

// Constants
import {PATHS} from 'js/router/routerConstants';
import {ACCOUNT_ROUTES} from 'js/account/routes.constants';

// Styles
import styles from './passwordSection.module.scss';
import securityStyles from 'js/account/security/securityRoute.module.scss';

const HIDDEN_TOKEN_VALUE = '● '.repeat(10);

export default function PasswordSection() {
  return (
    <section className={securityStyles.securitySection}>
      <div className={securityStyles.securitySectionTitle}>
        <h2 className={securityStyles.securitySectionTitleText}>{t('Password')}</h2>
      </div>

      <div className={securityStyles.securitySectionBody}>
        <p className={styles.passwordDisplay}>{HIDDEN_TOKEN_VALUE}</p>
      </div>

      <div className={styles.options}>
        <a href={PATHS.RESET}>
          <Button
            label={t('forgot password')}
            size='m'
            type='text'
          />
        </a>

        <NavLink to={`${ACCOUNT_ROUTES.CHANGE_PASSWORD}`}>
          <Button
            label={t('Update')}
            size='m'
            type='primary'
            onClick={() => {
              /*TODO: Handle NavLink and Button*/
            }}
          />
        </NavLink>
      </div>
    </section>
  );
}
