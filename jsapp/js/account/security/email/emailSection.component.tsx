import React, {useEffect, useState} from 'react';
import sessionStore from 'js/stores/session';
import {
  getUserEmails,
  setUserEmail,
  deleteUnverifiedUserEmails,
} from './emailSection.api';
import type {EmailResponse} from './emailSection.api';
import style from './emailSection.module.scss';
import Button from 'jsapp/js/components/common/button';
import TextBox from 'jsapp/js/components/common/textBox';
import Icon from 'jsapp/js/components/common/icon';
import {formatTime} from 'jsapp/js/utils';

interface EmailState {
  emails: EmailResponse[];
  newEmail: string;
  refreshedEmail: boolean;
  refreshedEmailDate: string;
}

export default function EmailSection() {
  const [session] = useState(() => sessionStore);

  const [email, setEmail] = useState<EmailState>({
    emails: [],
    newEmail: '',
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
    });
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

  const currentAccount = session.currentAccount;
  const unverifiedEmail = email.emails.find(
    (userEmail) => !userEmail.verified && !userEmail.primary
  );

  return (
    <div className={style.root}>
      <div className={style.titleSection}>
        <h2 className={style.title}>{t('Email address')}</h2>
      </div>

      <div className={style.bodySection}>
        {!session.isPending &&
          session.isInitialLoadComplete &&
          'email' in currentAccount && (
            <p className={style.currentEmail}>{currentAccount.email}</p>
          )}

        {unverifiedEmail?.email &&
          !session.isPending &&
          session.isInitialLoadComplete &&
          'email' in currentAccount && (
            <>
              <div className={style.unverifiedEmail}>
                <Icon name='alert' />
                <p className={style['blurb']}>
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

              <div className={style.editEmail}>
                <Button
                  label='Resend'
                  size='m'
                  color='blue'
                  type='frame'
                  onClick={resendNewUserEmail.bind(
                    resendNewUserEmail,
                    unverifiedEmail.email
                  )}
                />
                <Button
                  label='Remove'
                  size='m'
                  color='red'
                  type='frame'
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

      <form
        className={style.optionsSection}
        onSubmit={(e) => {
          e.preventDefault();
          setNewUserEmail(email.newEmail);
        }}
      >
        {/*TODO: Move TextBox into a modal--it messes up the flow of the row right now*/}
        <TextBox
          customModifiers='on-white'
          value={email.newEmail}
          placeholder={t('Type new email address')}
          onChange={onTextFieldChange.bind(onTextFieldChange)}
        />

        <Button
          label='Change'
          size='m'
          color='blue'
          type='frame'
          onClick={setNewUserEmail.bind(setNewUserEmail, email.newEmail)}
        />
      </form>
    </div>
  );
}
