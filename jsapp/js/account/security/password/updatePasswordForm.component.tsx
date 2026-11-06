import React, { useState, useEffect } from 'react'

import classnames from 'classnames'
import { when } from 'mobx'
import { useMfaStatus } from '#/account/security/mfa/mfa.api'
import { fetchPatch } from '#/api'
import { endpoints } from '#/api.endpoints'
import ButtonNew from '#/components/common/ButtonNew'
import PasswordInput from '#/components/common/PasswordInput'
import TextInput from '#/components/common/TextInput'
import PasswordStrength from '#/components/passwordStrength.component'
import { ROOT_URL } from '#/constants'
import type { FailResponse } from '#/dataInterface'
import envStore from '#/envStore'
import { FeatureFlag, useFeatureFlag } from '#/featureFlags'
import profileStore from '#/stores/profile'
import { notify } from '#/utils'
import styles from './updatePasswordForm.module.scss'

const FIELD_REQUIRED_ERROR = t('This field is required.')

/** The backend sends either one message or a list */
function toErrorList(error: string[] | string | undefined) {
  return typeof error === 'string' ? [error] : error
}

interface UpdatePasswordFormProps {
  /**
   * Allows doing some actions when password is updated successfully. Regardless
   * of this being used, a success toast notification will be displayed.
   */
  onSuccess?: () => void
}

export default function UpdatePasswordForm(props: UpdatePasswordFormProps) {
  const [isPending, setIsPending] = useState(false)
  const [isEnvStoreReady, setIsEnvStoreReady] = useState(envStore.isReady)

  const [currentPassword, setCurrentPassword] = useState('')
  const [currentPasswordError, setCurrentPasswordError] = useState<string[] | undefined>()
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordError, setNewPasswordError] = useState<string[] | undefined>()
  const [verifyPassword, setVerifyPassword] = useState('')
  const [verifyPasswordError, setVerifyPasswordError] = useState<string[] | undefined>()
  /** A token or recovery code, asked for when 2FA is on */
  const [mfaCode, setMfaCode] = useState('')
  const [mfaCodeError, setMfaCodeError] = useState<string[] | undefined>()
  /** The backend asked for a code, so the field shows even with the flag off or no 2FA status */
  const [wasCodeAsked, setWasCodeAsked] = useState(false)

  const isAuthRedesignEnabled = useFeatureFlag(FeatureFlag.authRedesignEnabled)
  const { data: mfaStatus } = useMfaStatus()
  // Upfront only behind the flag until DEV-3258 makes the backend require the code
  const isCodeNeeded = (isAuthRedesignEnabled && Boolean(mfaStatus?.isActive)) || wasCodeAsked

  useEffect(() => {
    when(() => envStore.isReady).then(() => setIsEnvStoreReady(true))
  }, [])

  async function savePassword() {
    let hasErrors = false
    setCurrentPasswordError(undefined)
    setNewPasswordError(undefined)
    setVerifyPasswordError(undefined)
    setMfaCodeError(undefined)

    // None of the inputs can be empty
    if (!currentPassword) {
      setCurrentPasswordError([FIELD_REQUIRED_ERROR])
      hasErrors = true
    }
    if (!newPassword) {
      setNewPasswordError([FIELD_REQUIRED_ERROR])
      hasErrors = true
    }
    if (!verifyPassword) {
      setVerifyPasswordError([FIELD_REQUIRED_ERROR])
      hasErrors = true
    }
    if (isCodeNeeded && !mfaCode.trim()) {
      setMfaCodeError([FIELD_REQUIRED_ERROR])
      hasErrors = true
    }

    // Verify password input must match the new password
    if (newPassword !== verifyPassword) {
      setVerifyPasswordError([t("Passwords don't match")])
      hasErrors = true
    }

    if (!hasErrors) {
      setIsPending(true)

      try {
        await fetchPatch(
          endpoints.ME_URL,
          {
            current_password: currentPassword,
            new_password: newPassword,
            ...(isCodeNeeded && { mfa_code: mfaCode.trim() }),
          },
          { notifyAboutError: false },
        )
        setIsPending(false)
        setCurrentPassword('')
        setNewPassword('')
        setVerifyPassword('')
        setMfaCode('')
        notify(t('changed password successfully'))
        if (typeof props.onSuccess === 'function') {
          props.onSuccess()
        }
      } catch (error) {
        const errorObj = error as FailResponse

        setCurrentPasswordError(toErrorList(errorObj.responseJSON?.current_password))
        setNewPasswordError(toErrorList(errorObj.responseJSON?.new_password))
        setMfaCodeError(toErrorList(errorObj.responseJSON?.mfa_code))
        if (errorObj.responseJSON?.mfa_code) {
          setWasCodeAsked(true)
        }

        setIsPending(false)
        notify(t('failed to change password'), 'error')
      }
    }
  }

  function submitPasswordForm(evt: React.FormEvent<HTMLFormElement>) {
    evt.preventDefault()
    savePassword()
  }

  if (!profileStore.isLoggedIn || !isEnvStoreReady) {
    return null
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
        <PasswordInput
          label={t('Current Password')}
          error={currentPasswordError?.join(' ')}
          value={currentPassword}
          onChange={(evt) => setCurrentPassword(evt.currentTarget.value)}
        />

        <a className={styles.forgotLink} href={`${ROOT_URL}/accounts/password/reset/`}>
          {t('Forgot Password?')}
        </a>
      </div>

      <div className={styles.row}>
        <PasswordInput
          label={t('New Password')}
          error={newPasswordError?.join(' ')}
          value={newPassword}
          onChange={(evt) => setNewPassword(evt.currentTarget.value)}
        />

        {envStore.isReady && envStore.data.enable_password_entropy_meter && newPassword !== '' && (
          <PasswordStrength password={newPassword} />
        )}
      </div>

      <div className={styles.row}>
        <PasswordInput
          label={t('Verify Password')}
          error={verifyPasswordError?.join(' ')}
          value={verifyPassword}
          onChange={(evt) => setVerifyPassword(evt.currentTarget.value)}
        />
      </div>

      {/* Last, so the token is typed right before it is sent and has no time to expire */}
      {isCodeNeeded && (
        <div className={styles.row}>
          <TextInput
            label={t('Two-factor authentication code')}
            placeholder={t('Enter token or backup code')}
            error={mfaCodeError?.join(' ')}
            value={mfaCode}
            onChange={(evt) => setMfaCode(evt.currentTarget.value)}
            autoComplete='one-time-code'
            // Not `numeric`: a recovery code has letters too
            inputMode='text'
          />
        </div>
      )}

      <div className={styles.row}>
        <ButtonNew variant='filled' size='lg' type='submit' loading={isPending}>
          {t('Save Password')}
        </ButtonNew>
      </div>
    </form>
  )
}
