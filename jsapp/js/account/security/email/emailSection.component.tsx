import cx from 'classnames'
import { useState } from 'react'
import securityStyles from '#/account/security/securityRoute.module.scss'
import { MemberRoleEnum } from '#/api/models/memberRoleEnum'
import { type OrvalFetchError, getFieldErrors, onErrorDefaultHandler } from '#/api/onErrorDefaultHandler'
import { useMeEmailsCreate, useMeEmailsList } from '#/api/react-query/user-team-organization-usage'
import { useOrganizationAssumed } from '#/api/useOrganizationAssumed'
import ButtonNew from '#/components/common/ButtonNew'
import TextInput from '#/components/common/TextInput'
import Icon from '#/components/common/icon'
import profileStore from '#/stores/profile'
import { formatTime } from '#/utils'
import styles from './emailSection.module.scss'
import { useRemoveUnverifiedEmails } from './useRemoveUnverifiedEmails'

export default function EmailSection() {
  const [profile] = useState(() => profileStore)

  const [organization] = useOrganizationAssumed()

  const currentAccount = profile.currentAccount
  const initialEmail = 'email' in currentAccount ? currentAccount.email : ''

  /** The address to switch to, starting from the one on the account */
  const [newEmail, setNewEmail] = useState(initialEmail)
  const [fieldErrors, setFieldErrors] = useState<string[]>([])
  /** When the confirmation link was last re-sent */
  const [resentAt, setResentAt] = useState<string | null>(null)

  const emailsQuery = useMeEmailsList()
  const emails = emailsQuery.data?.status === 200 ? emailsQuery.data.data.results : []

  // `fetchWithAuth` throws a `ServerError` wrapping the 400, 403 and 429 bodies, so that is what `onError` gets -
  // not the generated `TError`.
  const createEmail = useMeEmailsCreate<OrvalFetchError>({
    mutation: {
      onError: (error, variables, context) => {
        // Both "Enter a valid email address" and the refusal for SSO accounts arrive under `email`.
        const emailErrors = getFieldErrors(error, 'email')
        if (emailErrors.length > 0) {
          setFieldErrors(emailErrors)
          return
        }
        // Nothing to pin to the field, so fall back to the toast every other Orval call uses.
        // TODO: DEV-1971 catch `code: 'reauthentication_required'` here and walk the user through the listed flows.
        onErrorDefaultHandler(error, variables, context)
      },
    },
  })
  const removeUnverifiedEmails = useRemoveUnverifiedEmails()

  const isBusy = createEmail.isPending || removeUnverifiedEmails.isPending

  /** Replaces the pending address, which the backend then mails a confirmation link to. */
  function changeEmail(address: string) {
    // Clear errors before making an API call
    setFieldErrors([])

    createEmail.mutate({ data: { email: address } })
  }

  function removePendingEmail() {
    removeUnverifiedEmails.mutate(undefined, {
      onSuccess: () => {
        setNewEmail(initialEmail)
        setResentAt(null)
      },
    })
  }

  /**
   * Asks for another confirmation link.
   *
   * Removes the address first: the POST only mails a link when it creates the row, so re-posting on its own would
   * look like it worked and mail nobody.
   */
  async function resendConfirmation(address: string) {
    setResentAt(null)

    try {
      await removeUnverifiedEmails.mutateAsync()
      await createEmail.mutateAsync({ data: { email: address } })
      setResentAt(formatTime(new Date().toUTCString()))
    } catch {
      // Both mutations report their own failures and invalidate the list, so there is nothing to add here.
    }
  }

  function handleSubmit() {
    const emailPattern = /[^@]+@[^@]+\.[^@]+/
    if (emailPattern.test(newEmail)) {
      changeEmail(newEmail)
    } else {
      setFieldErrors([t('Invalid email address')])
    }
  }

  const unverifiedEmail = emails.find((userEmail) => !userEmail.verified && !userEmail.primary)
  const isReady = profile.isInitialLoadComplete && 'email' in currentAccount
  const isSSO =
    profile.isInitialLoadComplete && 'social_accounts' in currentAccount && currentAccount.social_accounts.length >= 1
  const userCanChangeEmail = organization.is_mmo ? organization.request_user_role !== MemberRoleEnum.member : true
  // No editing while an address waits for confirmation.
  const isEditable = isReady && userCanChangeEmail && !unverifiedEmail

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
        {isEditable ? (
          <TextInput
            value={newEmail}
            placeholder={t('Type new email address')}
            onChange={(evt) => setNewEmail(evt.currentTarget.value)}
            type='email'
            w='100%'
            disabled={isSSO}
            error={fieldErrors.join(' ')}
          />
        ) : (
          <div className={styles.emailText}>{initialEmail}</div>
        )}

        {unverifiedEmail?.email && isReady && (
          <>
            <div className={styles.unverifiedEmail}>
              <Icon name='alert' />
              <p className={styles.blurb}>
                <strong>
                  {t('Check your email ##UNVERIFIED_EMAIL##. ').replace('##UNVERIFIED_EMAIL##', unverifiedEmail.email)}
                </strong>

                {t(
                  'A verification link has been sent to confirm your ownership. Once confirmed, this address will replace ##UNVERIFIED_EMAIL##',
                ).replace('##UNVERIFIED_EMAIL##', currentAccount.email)}
              </p>
            </div>

            <div className={styles.unverifiedEmailButtons}>
              <ButtonNew variant='light' disabled={isBusy} onClick={() => resendConfirmation(unverifiedEmail.email)}>
                {t('Resend')}
              </ButtonNew>
              <ButtonNew variant='danger-secondary' disabled={isBusy} onClick={removePendingEmail}>
                {t('Remove')}
              </ButtonNew>
            </div>

            {resentAt && <label>{t('Email was sent again: ##TIMESTAMP##').replace('##TIMESTAMP##', resentAt)}</label>}
          </>
        )}
      </div>
      {userCanChangeEmail && (
        // Stays rendered when empty, to keep the layout.
        <div className={styles.options}>
          {isEditable && (
            <ButtonNew
              variant='filled'
              onClick={handleSubmit}
              disabled={isSSO || newEmail === initialEmail}
              loading={isBusy}
            >
              {t('Change')}
            </ButtonNew>
          )}
        </div>
      )}
    </section>
  )
}
