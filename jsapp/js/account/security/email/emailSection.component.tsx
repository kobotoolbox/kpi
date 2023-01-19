import React, {useEffect, useState} from 'react';
import sessionStore from 'js/stores/session';
import {deleteUnverifiedUserEmails, EmailResponse} from './emailSection.api';
import {getUserEmails, setUserEmail} from './emailSection.api';
import style from './emailSection.module.scss';
import Button from 'jsapp/js/components/common/button';
import TextBox from 'jsapp/js/components/common/textBox';
import Icon from 'jsapp/js/components/common/icon';

interface EmailState {
  emails: EmailResponse[];
  newEmail: string;
}

export default function EmailSection() {
  const [session] = useState(() => sessionStore);

  const [email, setEmail] = useState<EmailState>({
    emails: [],
    newEmail: '',
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
        });
      });
    });
  }

  function resendNewUserEmail(unverfiedEmail: string) {
    deleteUnverifiedUserEmails().then(() => {
      setUserEmail(unverfiedEmail).then(() => {
        // TODO: Add a toast here
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
  const unverifiedEmail = email.emails.find((userEmail) => !userEmail.verified && !userEmail.primary);

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
