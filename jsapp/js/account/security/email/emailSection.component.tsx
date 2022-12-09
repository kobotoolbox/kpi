import React, {useEffect, useState} from 'react';
import sessionStore from 'js/stores/session';
import { EmailResponse, getUserEmails, setUserEmail } from './emailSection.api';
import style from './emailSection.module.scss'
import Button from 'jsapp/js/components/common/button';
import TextBox from 'jsapp/js/components/common/textBox';

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
  function getUnverifiedEmail(): EmailResponse | undefined {
    return email.emails.find((userEmail) => !userEmail.verified);
  }

  return (
    <div className={style['email-section']}>
      <h2>Email</h2>
      {!session.isPending &&
        session.isInitialLoadComplete &&
        'email' in currentAccount && (
          <h2>{currentAccount.email}</h2>
      )}
      {getUnverifiedEmail() && (
        <div>
          <h2>Unverified email</h2>
          <h2>{getUnverifiedEmail()?.email}</h2>
        </div>
      )}
      <TextBox
        customModifiers='on-white'
        label={t('New email')}
        value={email.newEmail}
        placeholder={t(
          'Type new email address'
        )}
        onChange={onTextFieldChange.bind(onTextFieldChange)}
      />
      <Button
        label='Change'
        size='l'
        color='blue'
        type='frame'
        onClick={setNewUserEmail.bind(setNewUserEmail, email.newEmail)}
      />
    </div>
  );
}
