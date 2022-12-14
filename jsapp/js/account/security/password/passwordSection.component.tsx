import React from 'react';
import {ACCOUNT_ROUTES} from 'js/account/routes';
import TextBox from 'js/components/common/textBox';
import {PATHS} from 'js/router/routerConstants';
import bem from 'js/bem';
import styles from './passwordSection.module.scss';

const HIDDEN_TOKEN_VALUE = '*'.repeat(10);

export default function PasswordSection() {
  return (
    <div className={styles.root}>
      <div className={styles.securityRowHeader}>
        <h2 className={styles.title}>{t('Password')}</h2>
      </div>

      <bem.FormModal__item m='password'>
        <TextBox
          customModifiers='on-white'
          type='password'
          value={HIDDEN_TOKEN_VALUE}
          readOnly
        />

        <a
          href={`/#${ACCOUNT_ROUTES.CHANGE_PASSWORD}`}
          className='kobo-button kobo-button--blue'
        >
          {t('update')}
        </a>
      </bem.FormModal__item>

      <div className={styles.SecurityRowLink}>
        <a href={PATHS.RESET}>{t('forgot password')}</a>
      </div>
    </div>
  );
}
