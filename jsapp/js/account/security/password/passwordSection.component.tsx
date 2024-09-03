import React from 'react';
import {PATHS} from 'js/router/routerConstants';
import Button from 'jsapp/js/components/common/button';
import styles from './passwordSection.module.scss';
import {NavLink} from 'react-router-dom';
import {ACCOUNT_ROUTES} from 'js/account/routes.constants';

const HIDDEN_TOKEN_VALUE = '● '.repeat(10);

export default function PasswordSection() {
  return (
    <div className={styles.root}>
      <div className={styles.titleSection}>
        <h2 className={styles.title}>{t('Password')}</h2>
      </div>

      <div className={styles.bodySection}>
        <p className={styles.passwordDisplay}>{HIDDEN_TOKEN_VALUE}</p>
      </div>

      <div className={styles.optionsSection}>
        <a href={PATHS.RESET}>{t('forgot password')}</a>

        <NavLink to={`${ACCOUNT_ROUTES.CHANGE_PASSWORD}`}>
          <Button
            label='Update'
            size='m'
            type='secondary'
            onClick={() => {
              /*TODO: Handle NavLink and Button*/
            }}
          />
        </NavLink>
      </div>
    </div>
  );
}
