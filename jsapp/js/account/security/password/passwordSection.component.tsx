import React from 'react';
import {ACCOUNT_ROUTES} from 'js/account/routes';
import TextBox from 'js/components/common/textBox';
import {PATHS} from 'js/router/routerConstants';
import Button from 'jsapp/js/components/common/button';
import styles from './passwordSection.module.scss';
import {NavLink} from 'react-router-dom';

const HIDDEN_TOKEN_VALUE = '*'.repeat(10);

export default function PasswordSection() {
  return (
    <div className={styles.root}>
      <div className={styles.titleSection}>
        <h2 className={styles.title}>{t('Password')}</h2>
      </div>

      <div className={styles.bodySection}>
        <TextBox
          customModifiers='on-white'
          type='password'
          value={HIDDEN_TOKEN_VALUE}
          readOnly
        />
      </div>

      <div className={styles.optionsSection}>
        <a href={PATHS.RESET}>{t('forgot password')}</a>

        <NavLink to={`${ACCOUNT_ROUTES.CHANGE_PASSWORD}`} className={styles.passwordLink}>
          <Button
            label='Update'
            size='m'
            color='blue'
            type='frame'
            onClick={() => {/*TODO: Handle NavLink and Button*/}}
          />
        </NavLink>
      </div>
    </div>
  );
}
