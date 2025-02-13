import React, {useState, useEffect} from 'react';
import sessionStore from 'js/stores/session';
import TextBox from 'js/components/common/textBox';
import PasswordStrength from 'js/components/passwordStrength.component';
import {ROOT_URL} from 'js/constants';
import styles from './updatePasswordForm.module.scss';
import Button from 'js/components/common/button';
import {fetchPatch} from 'js/api';
import {endpoints} from 'js/api.endpoints';
import {notify} from 'js/utils';
import envStore from 'js/envStore';
import type {FailResponse} from 'js/dataInterface';
import classnames from 'classnames';
import {when} from 'mobx';

const FIELD_REQUIRED_ERROR = t('This field is required.');

interface UpdatePasswordFormProps {
  /**
   * Allows doing some actions when password is updated successfully. Regardless
   * of this being used, a success toast notification will be displayed.
   */
  onSuccess?: () => void;
}

export default function UpdatePasswordForm(props: UpdatePasswordFormProps) {
  const [isPending, setIsPending] = useState(false);
  const [isEnvStoreReady, setIsEnvStoreReady] = useState(envStore.isReady);

  const [currentPassword, setCurrentPassword] = useState('');
  const [currentPasswordError, setCurrentPasswordError] = useState<
    string[] | undefined
  >();
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordError, setNewPasswordError] = useState<
    string[] | undefined
  >();
  const [verifyPassword, setVerifyPassword] = useState('');
  const [verifyPasswordError, setVerifyPasswordError] = useState<
    string[] | undefined
  >();

  useEffect(() => {
    when(() => envStore.isReady).then(() => setIsEnvStoreReady(true));
  }, []);

  async function savePassword() {
    let hasErrors = false;
    setCurrentPasswordError(undefined);
    setNewPasswordError(undefined);
    setVerifyPasswordError(undefined);

    // Any of the three inputs can't be empty
    if (!currentPassword) {
      setCurrentPasswordError([FIELD_REQUIRED_ERROR]);
      hasErrors = true;
    }
    if (!newPassword) {
      setNewPasswordError([FIELD_REQUIRED_ERROR]);
      hasErrors = true;
    }
    if (!verifyPassword) {
      setVerifyPasswordError([FIELD_REQUIRED_ERROR]);
      hasErrors = true;
    }

    // Verify password input must match the new password
    if (newPassword !== verifyPassword) {
      setVerifyPasswordError([t("Passwords don't match")]);
      hasErrors = true;
    }

    if (!hasErrors) {
      setIsPending(true);

      try {
        await fetchPatch(endpoints.ME_URL, {
          current_password: currentPassword,
          new_password: newPassword,
        }, {notifyAboutError: false});
        setIsPending(false);
        setCurrentPassword('');
        setNewPassword('');
        setVerifyPassword('');
        notify(t('changed password successfully'));
        if (typeof props.onSuccess === 'function') {
          props.onSuccess();
        }
      } catch (error) {
        const errorObj = error as FailResponse;

        if (errorObj.responseJSON?.current_password) {
          if (typeof errorObj.responseJSON.current_password === 'string') {
            setCurrentPasswordError([errorObj.responseJSON.current_password]);
          } else {
            setCurrentPasswordError(errorObj.responseJSON.current_password);
          }
        }
        if (errorObj.responseJSON?.new_password) {
          if (typeof errorObj.responseJSON.new_password === 'string') {
            setNewPasswordError([errorObj.responseJSON.new_password]);
          } else {
            setNewPasswordError(errorObj.responseJSON.new_password);
          }
        }

        setIsPending(false);
        notify(t('failed to change password'), 'error');
      }
    }
  }

  function submitPasswordForm(evt: React.FormEvent<HTMLFormElement>) {
    evt.preventDefault();
    savePassword();
  }

  if (!sessionStore.isLoggedIn || !isEnvStoreReady) {
    return null;
  }

  return (
    <form className={styles.root} onSubmit={submitPasswordForm}>
      {envStore.data.enable_custom_password_guidance_text && (
        <div
          className={classnames([styles.row, styles.guidanceText])}
          dangerouslySetInnerHTML={{
            __html: envStore.data.custom_password_localized_help_text,
          }}
        />
      )}

      <div className={styles.row}>
        <TextBox
          label={t('Current Password')}
          type='password'
          errors={currentPasswordError}
          value={currentPassword}
          onChange={setCurrentPassword}
        />

        <a
          className={styles.forgotLink}
          href={`${ROOT_URL}/accounts/password/reset/`}
        >
          {t('Forgot Password?')}
        </a>
      </div>

      <div className={styles.row}>
        <TextBox
          label={t('New Password')}
          type='password'
          errors={newPasswordError}
          value={newPassword}
          onChange={setNewPassword}
        />

        {envStore.isReady &&
          envStore.data.enable_password_entropy_meter &&
          newPassword !== '' && <PasswordStrength password={newPassword} />}
      </div>

      <div className={styles.row}>
        <TextBox
          label={t('Verify Password')}
          type='password'
          errors={verifyPasswordError}
          value={verifyPassword}
          onChange={setVerifyPassword}
        />
      </div>

      <div className={styles.row}>
        <Button
          type='primary'
          size='l'
          label={t('Save Password')}
          isSubmit
          isPending={isPending}
        />
      </div>
    </form>
  );
}
