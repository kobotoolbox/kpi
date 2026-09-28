import { Stack, Text, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState } from 'react'
import type { ProviderSignupBody } from '#/api/models/providerSignupBody'
import { useAllauthBrowserV1AuthProviderSignupPost } from '#/api/react-query/authentication-allauth-headless'
import { withAuthFieldError } from '#/auth/AuthFieldError'
import { validateFullName, validateUsername } from '#/auth/RegisterRoute/registerValidation'
import { getGenericAllauthErrorMessage, isPendingEmailVerification, splitAllauthErrors } from '#/auth/allauthErrors'
import { validateEmailFormat } from '#/auth/authValidation'
import ButtonNew from '#/components/common/ButtonNew'
import TextInput from '#/components/common/TextInput'
import Alert from '#/components/common/alert'

interface ProviderSignupFormValues {
  name: string
  email: string
  username: string
}

/**
 * The field names allauth may name in an error's `param`. `name` is not among them - the endpoint never
 * reads it, see the TODO in {@link handleSubmit}.
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
  /** What the provider told us, as far as it goes. Blank where it told us nothing. */
  initialValues: ProviderSignupFormValues
  onOutcome: (outcome: ProviderSignupOutcome) => void
}

/**
 * The gaps in what the provider told us about someone, asked for once.
 *
 * No password field: the provider is the credential, and allauth creates the account with an unusable
 * password. That is also why `RegisterForm` is no use here - it is mostly passwords and the legal agreement,
 * none of which this endpoint reads.
 */
export default function ProviderSignupForm({ providerName, initialValues, onOutcome }: ProviderSignupFormProps) {
  const form = useForm<ProviderSignupFormValues>({
    // The uncontrolled mode is recommended by Mantine Corp
    mode: 'uncontrolled',
    initialValues,
    validate: {
      name: validateFullName,
      // No managed-domain check, unlike `RegisterForm`: signing up through SSO is what that check asks for.
      email: validateEmailFormat,
      username: validateUsername,
    },
  })

  // Errors that belong to no single input, shown in a banner above the form.
  const [formErrors, setFormErrors] = useState<string[]>([])

  const signup = useAllauthBrowserV1AuthProviderSignupPost({
    mutation: {
      // Rejections land here too, not in `onError`: allauth signals with status codes, so `fetchAllauth`
      // hands back every answer below 500 as data for us to read.
      onSuccess: (response, variables) => {
        if (response.status === 200 && response.data.meta.is_authenticated) {
          onOutcome({ kind: 'authenticated' })
          return
        }
        // With verification mandatory (the KPI default) success arrives as a 401 with a pending `verify_email`
        // flow - an address from a provider is not a confirmed address.
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
    setFormErrors([])

    // TODO: allauth's provider signup only reads `{email, username}`, so `name` is sent and quietly dropped
    // and the generated body type has no room for it. The cast goes away with DEV-2807, the same fix
    // `RegisterForm` is waiting on.
    const body = {
      email: values.email.trim(),
      username: values.username.trim(),
      name: values.name.trim(),
    } as ProviderSignupBody

    signup.mutate({ data: body })
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
              label={t('Full name')}
              autoComplete='name'
              key={form.key('name')}
              {...withAuthFieldError(form.getInputProps('name'))}
              required
            />
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

          <ButtonNew type='submit' size='lg' fullWidth rightIcon='arrow-right' loading={signup.isPending}>
            {t('Continue')}
          </ButtonNew>
        </Stack>
      </form>
    </Stack>
  )
}
