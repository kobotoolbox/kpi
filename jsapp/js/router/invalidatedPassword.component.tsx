import React, {useState} from 'react';
import Icon from 'js/components/common/icon';
import Button from 'js/components/common/button';
import UpdatePasswordForm from 'js/account/security/password/updatePasswordForm.component';
import styles from './invalidatedPassword.module.scss';
import BasicLayout from './basicLayout.component';

/**
 * This is a route blocker component to be used for accounts marked by admin
 * as having insecure passwords. It is meant to be displayed for every possible
 * route - to block users from using the app befor taking action.
 */
export default function InvalidatedPassword() {
  const [isFormVisible, setIsFormVisible] = useState(false);

  function onSuccess() {
    window.location.reload();
  }

  return (
    <BasicLayout>
      <div className={styles.root}>
        <header className={styles.header}>
          <Icon name='warning' size='l' color='mid-red' />
          <h1>{t('Temporary Access Restriction: Password Update Required')}</h1>
        </header>

        <p className={styles.message}>
          {t(
            'You must update your password before proceeding. Please do so promptly to ensure the security of your data.'
          )}
        </p>

        <footer className={styles.footer}>
          {!isFormVisible && (
            <Button
              size='l'
              label={t('Update password')}
              type='primary'
              onClick={() => setIsFormVisible(!isFormVisible)}
            />
          )}

          {isFormVisible && <UpdatePasswordForm onSuccess={onSuccess} />}
        </footer>
      </div>
    </BasicLayout>
  );
}
