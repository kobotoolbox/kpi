import React, {useEffect, useState} from 'react';
import sessionStore from 'js/stores/session';
import {EmailResponse, getUserEmails, setUserEmail} from './emailSection.api';
import style from './emailSection.module.scss';
import Button from 'jsapp/js/components/common/button';
import TextBox from 'jsapp/js/components/common/textBox';
import Icon from 'jsapp/js/components/common/icon';

interface EmailState {
  isLoading: boolean;
  emails: EmailResponse[];
  newEmail: string;
}

export default function EmailSection() {
  const [session] = useState(() => sessionStore);

  const [email, setEmail] = useState<EmailState>({
    isLoading: true,
    emails: [],
    newEmail: '',
  });

  useEffect(() => {
    if (email.isLoading) {
      getUserEmails().then((data) => {
        setEmail({
          ...email,
          isLoading: false,
          emails: data.results,
        });
      });
    }
  });

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
        <h2 className={style.title}>Email</h2>
      </div>

      <div className={style.bodySection}>
        {!session.isPending &&
          session.isInitialLoadComplete &&
          'email' in currentAccount && <p>{currentAccount.email}</p>}

        {unverifiedEmail?.email &&
          !session.isPending &&
          session.isInitialLoadComplete &&
          'email' in currentAccount && (
            <div className={style.unverifiedEmail}>
              <Icon name='alert' />

              <p className={style['blurb']}>
                <strong>
                  {t('Check your email ##UNVERIFIED_EMAIL##. ').replace('##UNVERIFIED_EMAIL##', unverifiedEmail.email)}
                </strong>

                {t('A verification link has been sent to confirm your ownership. Once confirmed, this address will replace ##UNVERIFIED_EMAIL##').replace('##UNVERIFIED_EMAIL##', currentAccount.email)}
              </p>
            </div>
          )}
      </div>

      <div className={style.optionsSection}>
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
      </div>
    </div>
  );
}
