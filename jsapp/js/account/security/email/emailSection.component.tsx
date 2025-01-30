// Libraries
import React, {useEffect, useState} from 'react';
import cx from 'classnames';

// Stores and email related
import sessionStore from 'js/stores/session';
import {
  getUserEmails,
  setUserEmail,
  deleteUnverifiedUserEmails,
} from './emailSection.api';
import type {EmailResponse} from './emailSection.api';
import {useOrganizationQuery} from '../../organization/organizationQuery';

// Partial components
import Button from 'jsapp/js/components/common/button';
import TextBox from 'jsapp/js/components/common/textBox';
import Icon from 'jsapp/js/components/common/icon';

// Utils
import {formatTime, notify} from 'js/utils';

// Styles
import styles from './emailSection.module.scss';
import securityStyles from 'js/account/security/securityRoute.module.scss';

interface EmailState {
  emails: EmailResponse[];
  newEmail: string;
  refreshedEmail: boolean;
  refreshedEmailDate: string;
}

export default function EmailSection() {
  const [session] = useState(() => sessionStore);

  const orgQuery = useOrganizationQuery();

  let initialEmail = '';
  if ('email' in session.currentAccount) {
    initialEmail = session.currentAccount.email;
  }

  const [email, setEmail] = useState<EmailState>({
    emails: [],
    newEmail: initialEmail,
    refreshedEmail: false,
    refreshedEmailDate: '',
  });

  useEffect(() => {
    getUserEmails().then((data) => {
      setEmail({
        ...email,
        emails: data.results,
      });
    });
  }, []);

  function setNewUserEmail(newEmail: string) {
    setUserEmail(newEmail).then(() => {
      getUserEmails().then((data) => {
        setEmail({
          ...email,
          emails: data.results,
          newEmail: '',
        });
      });
    }, () => {/* Avoid crashing app when 500 error happens */});
  }

  function deleteNewUserEmail() {
    deleteUnverifiedUserEmails().then(() => {
      getUserEmails().then((data) => {
        setEmail({
          ...email,
          emails: data.results,
          newEmail: '',
          refreshedEmail: false,
        });
      });
    });
  }

  function resendNewUserEmail(unverfiedEmail: string) {
    setEmail({
      ...email,
      refreshedEmail: false,
    });

    deleteUnverifiedUserEmails().then(() => {
      setUserEmail(unverfiedEmail).then(() => {
        setEmail({
          ...email,
          refreshedEmail: true,
          refreshedEmailDate: formatTime(new Date().toUTCString()),
        });
      });
    });
  }

  function onTextFieldChange(value: string) {
    setEmail({
      ...email,
      newEmail: value,
    });
  }

  function handleSubmit() {
    const emailPattern = /[^@]+@[^@]+\.[^@]+/;
    if (!emailPattern.test(email.newEmail)) {
      notify.error('Invalid email address');
    } else {
      setNewUserEmail(email.newEmail);
    }
  }

  const currentAccount = session.currentAccount;
  const unverifiedEmail = email.emails.find(
    (userEmail) => !userEmail.verified && !userEmail.primary
  );
  const isReady = session.isInitialLoadComplete && 'email' in currentAccount;
  const userCanChangeEmail = orgQuery.data?.is_mmo
    ? orgQuery.data.request_user_role !== 'member'
    : true;

  return (
    <section className={securityStyles.securitySection}>
      <div className={securityStyles.securitySectionTitle}>
        <h2 className={securityStyles.securitySectionTitleText}>{t('Email address')}</h2>
      </div>

      <div
        className={cx([
          securityStyles.securitySectionBody,
          userCanChangeEmail ? styles.body : styles.emailUpdateDisabled,
        ])}
      >
        {isReady && userCanChangeEmail ? (
          <TextBox
            value={email.newEmail}
            placeholder={t('Type new email address')}
            onChange={onTextFieldChange.bind(onTextFieldChange)}
            type='email'
          />
        ) : (
          <div className={styles.emailText}>{email.newEmail}</div>
        )}

        {unverifiedEmail?.email && isReady && (
          <>
            <div className={styles.unverifiedEmail}>
              <Icon name='alert' />
              <p className={styles.blurb}>
                <strong>
                  {t('Check your email ##UNVERIFIED_EMAIL##. ').replace(
                    '##UNVERIFIED_EMAIL##',
                    unverifiedEmail.email
                  )}
                </strong>

                {t(
                  'A verification link has been sent to confirm your ownership. Once confirmed, this address will replace ##UNVERIFIED_EMAIL##'
                ).replace('##UNVERIFIED_EMAIL##', currentAccount.email)}
              </p>
            </div>

            <div className={styles.unverifiedEmailButtons}>
              <Button
                label='Resend'
                size='m'
                type='secondary'
                onClick={resendNewUserEmail.bind(
                  resendNewUserEmail,
                  unverifiedEmail.email
                )}
              />
              <Button
                label='Remove'
                size='m'
                type='secondary-danger'
                onClick={deleteNewUserEmail}
              />
            </div>

            {email.refreshedEmail && (
              <label>
                {t('Email was sent again: ##TIMESTAMP##').replace(
                  '##TIMESTAMP##',
                  email.refreshedEmailDate
                )}
              </label>
            )}
          </>
        )}
      </div>
      {userCanChangeEmail && (
        <div className={styles.options}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            <Button
              label='Change'
              size='m'
              type='primary'
              onClick={handleSubmit}
            />
          </form>
        </div>
      )}
    </section>
  );
}
