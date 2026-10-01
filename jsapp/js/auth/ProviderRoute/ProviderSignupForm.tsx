import { Checkbox, Stack, Text, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState } from 'react'
import { useAllauthBrowserV1AuthProviderSignupPost } from '#/api/react-query/authentication-allauth-headless'
import { withAuthFieldError } from '#/auth/AuthFieldError'
import { validateTermsOfService, validateUsername } from '#/auth/RegisterRoute/registerValidation'
import { getGenericAllauthErrorMessage, isPendingEmailVerification, splitAllauthErrors } from '#/auth/allauthErrors'
import { validateEmailFormat } from '#/auth/authValidation'
import { legalSentence } from '#/auth/legalAgreement'
import ButtonNew from '#/components/common/ButtonNew'
import TextInput from '#/components/common/TextInput'
import Alert from '#/components/common/alert'

/** What the provider may already have told us, and what this form therefore starts filled in with. */
export interface ProviderSignupPrefill {
  email: string
  username: string
}

interface ProviderSignupFormValues extends ProviderSignupPrefill {
  termsOfService: boolean
}

/**
 * The field names allauth may name in an error's `param`. `terms_of_service` is left out on purpose: our input
 * is called `termsOfService`, so such an error goes to the banner rather than nowhere.
 */
const SERVER_KNOWN_FIELDS: ReadonlyArray<keyof ProviderSignupFormValues> = ['email', 'username']

/** How far the signup got, for the route to turn into a panel. */
export type ProviderSignupOutcome =
  /** The account exists and the session with it: nothing left to confirm. */
  | { kind: 'authenticated' }
  /** The account exists and allauth mailed a confirmation link to the address that was submitted. */
  | { kind: 'emailVerificationRequired'; email: string }
  /** allauth is no longer holding the provider account this form was filling in the gaps for. */
  | { kind: 'flowExpired' }

export interface ProviderSignupFormProps {
  /** The provider's display name, for the line saying which account this is being connected to. */
  providerName: string
  /** Blank where the provider told us nothing, which is what this form exists to fill in. */
  initialValues: ProviderSignupPrefill
  termsOfServiceUrl: string | null | undefined
  privacyPolicyUrl: string | null | undefined
  /** Blocks submitting until `/environment` loads, since the legal agreement comes from it */
  isConfigurationPending: boolean
  onOutcome: (outcome: ProviderSignupOutcome) => void
}

/**
 * The gaps in what the provider told us about someone, asked for once.
 *
 * No password field: the provider is the credential. No profile fields either - this endpoint stores nothing
 * beyond the credentials and the agreement, and the rest of a profile is collected after logging in.
 */
export default function ProviderSignupForm({
  providerName,
  initialValues,
  termsOfServiceUrl,
  privacyPolicyUrl,
  isConfigurationPending,
  onOutcome,
}: ProviderSignupFormProps) {
  const legalLabel = legalSentence(termsOfServiceUrl, privacyPolicyUrl)

  const form = useForm<ProviderSignupFormValues>({
    // The uncontrolled mode is recommended by Mantine Corp
    mode: 'uncontrolled',
    initialValues: { ...initialValues, termsOfService: false },
    validate: {
      // No managed-domain check, unlike `RegisterForm`: signing up through SSO is what that check asks for.
      email: validateEmailFormat,
      username: validateUsername,
      // No checkbox to tick when there is no legal document. Mantine reads these rules fresh on every render,
      // so this follows the label once `/environment` lands.
      termsOfService: legalLabel ? validateTermsOfService : undefined,
    },
  })

  // Errors that belong to no single input, shown in a banner above the form.
  const [formErrors, setFormErrors] = useState<string[]>([])

  const signup = useAllauthBrowserV1AuthProviderSignupPost({
    mutation: {
      // Rejections land here too, not in `onError`: allauth signals with status codes, so `fetchAllauth`
      // hands back every answer below 500 as data for us to read.
      onSuccess: (response, variables) => {
        // The usual outcome, unlike a password signup: `SOCIALACCOUNT_EMAIL_VERIFICATION` defaults to `none`,
        // so the provider having vouched for the address is enough.
        if (response.status === 200 && response.data.meta.is_authenticated) {
          onOutcome({ kind: 'authenticated' })
          return
        }
        // A deployment that does verify provider addresses answers 401 with a pending `verify_email` flow.
        if (isPendingEmailVerification(response)) {
          onOutcome({ kind: 'emailVerificationRequired', email: variables.data.email })
          return
        }
        // The half-finished signup this form belongs to is gone: its session expired, or another tab finished
        // or abandoned it.
        if (response.status === 409) {
          onOutcome({ kind: 'flowExpired' })
          return
        }
        const { fieldErrors, formErrors: bannerErrors } = splitAllauthErrors(response, SERVER_KNOWN_FIELDS)
        form.setErrors(fieldErrors)
        setFormErrors(bannerErrors)
      },
      // Only a 5xx or a dead connection gets this far. Shown here rather than left to the global toast, so
      // the message sits next to the button that failed.
      onError: () => setFormErrors([getGenericAllauthErrorMessage()]),
    },
  })

  const handleSubmit = (values: ProviderSignupFormValues) => {
    // The button below is disabled while we wait, but better be safe and check here too
    if (isConfigurationPending) {
      return
    }

    setFormErrors([])

    signup.mutate({
      data: {
        email: values.email.trim(),
        username: values.username.trim(),
        // Servers publishing a Terms of Service reject a signup without this, provider signups included.
        // Where there is nothing to agree to, the server drops the field and ignores this.
        terms_of_service: values.termsOfService,
      },
    })
  }

  return (
    <Stack gap='xl'>
      <Stack gap='xs'>
        <Title order={1} size='h3'>
          {t('Create your account')}
        </Title>
        {/* Says which account is about to be connected, so an unexpected provider is visible before typing. */}
        <Text>
          {t('Finish setting up your KoboToolbox account, connected to your ##provider## account.').replace(
            '##provider##',
            () => providerName,
          )}
        </Text>
      </Stack>

      {formErrors.length > 0 && (
        <Alert type='error' iconName='alert'>
          <Stack gap='xxs'>
            {formErrors.map((message) => (
              <Text key={message} inherit>
                {message}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}

      {/* `noValidate` because we want to validate email ourselves */}
      <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
        <Stack gap='xl'>
          <Stack gap='sm'>
            <TextInput
              label={t('Email')}
              type='email'
              autoComplete='email'
              key={form.key('email')}
              {...withAuthFieldError(form.getInputProps('email'))}
              required
            />
            <TextInput
              label={t('Username')}
              autoComplete='username'
              key={form.key('username')}
              {...withAuthFieldError(form.getInputProps('username'))}
              required
            />
          </Stack>

          {legalLabel && (
            <Checkbox
              label={legalLabel}
              key={form.key('termsOfService')}
              {...withAuthFieldError(form.getInputProps('termsOfService', { type: 'checkbox' }))}
            />
          )}

          <ButtonNew
            type='submit'
            size='lg'
            fullWidth
            rightIcon='arrow-right'
            loading={isConfigurationPending || signup.isPending}
          >
            {t('Continue')}
          </ButtonNew>
        </Stack>
      </form>
    </Stack>
  )
}
