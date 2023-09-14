import React, {useState} from 'react';
import Icon from 'js/components/common/icon';
import Button from 'js/components/common/button';
import UpdatePasswordForm from 'js/account/security/password/updatePasswordForm.component';
import MainHeaderBase from 'js/components/header/mainHeaderBase.component';
import styles from './invalidatedPassword.module.scss';
import DocumentTitle from 'react-document-title';
import bem from 'js/bem';
import MainHeaderLogo from 'js/components/header/mainHeaderLogo.component';
import AccountMenu from 'js/components/header/accountMenu';
import {Tracking} from './useTracking';
import ToasterConfig from '../toasterConfig';

/**
 * This is a route blocker component to be used for accounts marked by admin
 * as having insecure passwords. It is meant to be displayed for every possible
 * route - to force user to update the password.
 */
export default function InvalidatedPassword() {
  const [isFormVisible, setIsFormVisible] = useState(false);

  function onSuccess() {
    window.location.reload();
  }

  return (
    <DocumentTitle title='KoboToolbox'>
      <>
        <Tracking />
        <ToasterConfig />
        <div className='header-stretch-bg' />

        <bem.PageWrapper className='mdl-layout mdl-layout--fixed-header'>
          <MainHeaderBase>
            <MainHeaderLogo />
            <AccountMenu />
          </MainHeaderBase>

          <bem.PageWrapper__content className='mdl-layout__content'>
            <div className={styles.root}>
              <header className={styles.header}>
                <Icon name='warning' size='l' color='red' />
                <h1>
                  {t('Temporary Access Restriction: Password Update Required')}
                </h1>
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
                    color='blue'
                    label={t('Update password')}
                    type='full'
                    onClick={() => setIsFormVisible(!isFormVisible)}
                  />
                )}

                {isFormVisible && <UpdatePasswordForm onSuccess={onSuccess} />}
              </footer>
            </div>
          </bem.PageWrapper__content>
        </bem.PageWrapper>
      </>
    </DocumentTitle>
  );
}
