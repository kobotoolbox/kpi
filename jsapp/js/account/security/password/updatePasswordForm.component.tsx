import React, {useState} from 'react';
import sessionStore from 'js/stores/session';
import TextBox from 'js/components/common/textBox';
import PasswordStrength from 'js/components/passwordStrength.component';
import {ROOT_URL} from 'js/constants';
import styles from './updatePasswordForm.module.scss';
import Button from 'js/components/common/button';
import {fetchPatch} from 'js/api';
import {endpoints} from 'js/api.endpoints';
import {notify} from 'js/utils';

const FIELD_REQUIRED_ERROR = t('This field is required.');

export default function UpdatePasswordForm() {
  const [isPending, setIsPending] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [currentPasswordError, setCurrentPasswordError] = useState<
    string | undefined
  >();
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordError, setNewPasswordError] = useState<
    string | undefined
  >();
  const [verifyPassword, setVerifyPassword] = useState('');
  const [verifyPasswordError, setVerifyPasswordError] = useState<
    string | undefined
  >();

  async function savePassword() {
    let hasErrors = false;
    setCurrentPasswordError(undefined);
    setNewPasswordError(undefined);
    setVerifyPasswordError(undefined);

    // Any of the three inputs can't be empty
    if (!currentPassword) {
      setCurrentPasswordError(FIELD_REQUIRED_ERROR);
      hasErrors = true;
    }
    if (!newPassword) {
      setNewPasswordError(FIELD_REQUIRED_ERROR);
      hasErrors = true;
    }
    if (!verifyPassword) {
      setVerifyPasswordError(FIELD_REQUIRED_ERROR);
      hasErrors = true;
    }

    // Verify password input must match the new password
    if (newPassword !== verifyPassword) {
      setNewPasswordError(
        t('This field must match the Verify Password field.')
      );
      hasErrors = true;
    }

    if (!hasErrors) {
      setIsPending(true);

      try {
        await fetchPatch(endpoints.ME_URL, {currentPassword, newPassword});
        setIsPending(false);
        setCurrentPassword('');
        setNewPassword('');
        setVerifyPassword('');
        notify(t('changed password successfully'));
      } catch (error) {
        setIsPending(false);
        notify(t('failed to change password'), 'error');
      }
    }
  }

  if (!sessionStore.isLoggedIn) {
    return null;
  }

  return (
    <form className={styles.foo}>
      <div className={styles.row}>
        <TextBox
          customModifiers='on-white'
          label={t('Current Password')}
          type='password'
          errors={currentPasswordError}
          value={currentPassword}
          onChange={setCurrentPassword}
        />

        <a
          className='account-settings-link'
          href={`${ROOT_URL}/accounts/password/reset/`}
        >
          {t('Forgot Password?')}
        </a>
      </div>

      <div className={styles.row}>
        <TextBox
          customModifiers='on-white'
          label={t('New Password')}
          type='password'
          errors={newPasswordError}
          value={newPassword}
          onChange={setNewPassword}
        />

        {newPassword !== '' && <PasswordStrength password={newPassword} />}
      </div>

      <div className={styles.row}>
        <TextBox
          customModifiers='on-white'
          label={t('Verify Password')}
          type='password'
          errors={verifyPasswordError}
          value={verifyPassword}
          onChange={setVerifyPassword}
        />
      </div>

      <div className={styles.row}>
        <Button
          type='full'
          color='blue'
          size='m'
          onClick={savePassword}
          label={t('Save Password')}
          isPending={isPending}
        />
      </div>
    </form>
  );
}
