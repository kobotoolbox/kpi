import React from 'react';
import Icon from '../components/common/icon';
import UpdatePasswordForm from 'js/account/security/password/updatePasswordForm.component';
import styles from './invalidatedPassword.module.scss';

export default function InvalidatedPassword() {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Icon name='alert' size='l' color='red' />
        <h1>{t('Temporary Access Restriction: Password Update Required')}</h1>
      </header>

      <p className={styles.message}>{t('Access to the app has been temporarily restricted due to a weak password. To regain access and ensure the security of your data, please update your password promptly.')}</p>

      <footer className={styles.footer}>
        <UpdatePasswordForm />
      </footer>
    </div>
  );
}
