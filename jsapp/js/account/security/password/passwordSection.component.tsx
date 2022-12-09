import React from 'react';
import {ACCOUNT_ROUTES} from 'js/account/routes';
import TextBox from 'js/components/common/textBox';
import {PATHS} from 'js/router/routerConstants';
import styles from './passwordSection.module.scss';

const HIDDEN_TOKEN_VALUE = '*'.repeat(10);

export default function PasswordSection () {
  return (
    <div className={styles.root}>
      <div className={styles.securityRowHeader}>
        <div className={styles.title}>
          {t('Password')}
        </div>
      </div>
      <div className={styles.securityRowDescription}>
      <TextBox
        customModifiers='on-white'
        type='password'
        value={HIDDEN_TOKEN_VALUE}
        readOnly
      />
      </div>
      <div className={styles.SecurityRowLink}>
        <a 
          href={PATHS.RESET}
        >
          {t('forgot password')}
        </a>
      </div>
      <div className={styles.securityRowButton}>
        <a
          href={`/#${ACCOUNT_ROUTES.CHANGE_PASSWORD}`}
          className='kobo-button kobo-button--blue'
        >
          {t('update')}
        </a>
      </div>

    </div>
  );
}