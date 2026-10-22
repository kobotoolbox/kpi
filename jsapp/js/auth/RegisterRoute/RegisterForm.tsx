import { Anchor, Checkbox, Stack, Text, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { MetadataField } from '#/api/models/metadataField'
import type { SignupBody } from '#/api/models/signupBody'
import type { SocialApp } from '#/api/models/socialApp'
import { useAllauthBrowserV1AuthSignupPost } from '#/api/react-query/authentication-allauth-headless'
import { withAuthFieldError } from '#/auth/AuthFieldError'
import ProviderLoginButtons from '#/auth/ProviderRoute/ProviderLoginButtons'
import { getGenericAllauthErrorMessage, isPendingEmailVerification, splitAllauthErrors } from '#/auth/allauthErrors'
import { validatePassword, validatePasswordConfirm } from '#/auth/authValidation'
import { TermsOfServiceCheckbox } from '#/auth/legalAgreement'
import ButtonNew from '#/components/common/ButtonNew'
import PasswordInput from '#/components/common/PasswordInput'
import TextInput from '#/components/common/TextInput'
import Alert from '#/components/common/alert'
import { AUTH_ROUTES } from '#/router/routerConstants'
import { validateEmail, validateRequiredCheckbox, validateUsername } from './registerValidation'

interface RegisterFormValues {
  email: string
  username: string
  password: string
  passwordConfirm: string
  newsletterSubscription: boolean
  termsOfService: boolean
}

/**
 * The form field names allauth may name in an error's `param`. The rest of our fields have no
 * counterpart on the endpoint, so an error can never point at them.
 */
const SERVER_KNOWN_FIELDS: ReadonlyArray<keyof RegisterFormValues> = ['email', 'username', 'password']

export interface RegisterFormProps {
  /** From `/api/v2/environment/`. SSO providers to offer, and the email domains that must use them. */
  socialApps: SocialApp[] | undefined
  /**
   * The newsletter entry of `USER_METADATA_FIELDS`, from `/api/v2/environment/`. Without one the server
   * drops the field from signup, so there is no checkbox to show.
   */
  newsletterField: MetadataField | undefined
  /** Whether the server requires the legal agreement, and so whether there is a checkbox at all. */
  isTermsOfServiceRequired: boolean | undefined
  termsOfServiceUrl: string | null | undefined
  privacyPolicyUrl: string | null | undefined
  /** Blocks submitting until `/environment` loads */
  isConfigurationPending: boolean
  /** Called with the submitted address once the account exists and the activation email is on its way. */
  onVerificationPending: (email: string) => void
  /** Called instead when the account came back signed in, so there is no address to confirm. */
  onSignedIn: () => void
}

/**
 * Signup asks for the least it can: the credentials, the newsletter opt in and the legal agreement. The
 * rest of the profile fields an instance configures through `USER_METADATA_FIELDS` are collected after
 * logging in, so nobody has to fill in a page of details before they have an account. That includes the
 * full name: the headless endpoint has no field for it, so asking here would only mean asking twice.
 */
export default function RegisterForm({
  socialApps,
  newsletterField,
  isTermsOfServiceRequired,
  termsOfServiceUrl,
  privacyPolicyUrl,
  isConfigurationPending,
  onVerificationPending,
  onSignedIn,
}: RegisterFormProps) {
  const form = useForm<RegisterFormValues>({
    // The uncontrolled mode is recommended by Mantine Corp
    mode: 'uncontrolled',
    initialValues: {
      email: '',
      username: '',
      password: '',
      passwordConfirm: '',
      newsletterSubscription: false,
      termsOfService: false,
    },
    validate: {
      email: (value) => validateEmail(value, socialApps),
      username: validateUsername,
      password: validatePassword,
      passwordConfirm: (value, values) => validatePasswordConfirm(value, values.password),
      // No checkbox to tick where the server asks for no agreement, so nothing to require. Mantine reads
      // these rules fresh on every render, so this follows the checkbox once `/environment` lands.
      termsOfService: isTermsOfServiceRequired ? validateRequiredCheckbox : undefined,
      // An administrator can make the opt in mandatory, odd as that is, and the server then enforces it.
      newsletterSubscription: newsletterField?.required ? validateRequiredCheckbox : undefined,
    },
  })

  // Errors that belong to no single input, shown in a banner above the form.
  const [formErrors, setFormErrors] = useState<string[]>([])

  const signup = useAllauthBrowserV1AuthSignupPost({
    mutation: {
      // Rejections land here too, not in `onError`: allauth signals with status codes, so `fetchAllauth`
      // hands back every answer below 500 as data for us to read.
      onSuccess: (response, variables) => {
        // A 200 only happens where a deployment sets `ACCOUNT_EMAIL_VERIFICATION` to `none` or
        // `optional`: allauth signs the new account in and answers with the session, so asking for a
        // confirmation nobody sent would strand someone who is already in.
        if (response.status === 200 && response.data.meta.is_authenticated) {
          onSignedIn()
          return
        }
        // With verification mandatory (the KPI default) the success is a 401 with a pending
        // `verify_email` flow.
        if (isPendingEmailVerification(response)) {
          onVerificationPending(variables.data.email)
          return
        }
        const { fieldErrors, formErrors: bannerErrors } = splitAllauthErrors(response, SERVER_KNOWN_FIELDS)
        form.setErrors(fieldErrors)
        setFormErrors(bannerErrors)
      },
      // Only a 5xx or a dead connection gets this far. Handling it here rather than leaving it to the
      // global toast keeps the message next to the button that just failed.
      onError: () => setFormErrors([getGenericAllauthErrorMessage()]),
    },
  })

  const handleSubmit = (values: RegisterFormValues) => {
    // The button below is disabled while we wait, but better be safe and check here too
    if (isConfigurationPending) {
      return
    }

    setFormErrors([])

    const body: SignupBody = {
      email: values.email.trim(),
      username: values.username.trim(),
      password: values.password,
      newsletter_subscription: values.newsletterSubscription,
      terms_of_service: values.termsOfService,
    }

    signup.mutate({ data: body })
  }

  return (
    <Stack gap='xl'>
      <Title order={1} size='h3'>
        {t('Create your account')}
      </Title>

      <ProviderLoginButtons socialApps={socialApps} variant='light' />

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
            <PasswordInput
              label={t('Password')}
              autoComplete='new-password'
              key={form.key('password')}
              {...withAuthFieldError(form.getInputProps('password'))}
              required
            />
            <PasswordInput
              label={t('Confirm password')}
              autoComplete='new-password'
              key={form.key('passwordConfirm')}
              {...withAuthFieldError(form.getInputProps('passwordConfirm'))}
              required
            />
          </Stack>

          <Stack gap='sm'>
            {newsletterField && (
              <Checkbox
                label={newsletterField.label}
                key={form.key('newsletterSubscription')}
                {...withAuthFieldError(form.getInputProps('newsletterSubscription', { type: 'checkbox' }))}
              />
            )}
            <TermsOfServiceCheckbox
              isRequired={isTermsOfServiceRequired}
              termsOfServiceUrl={termsOfServiceUrl}
              privacyPolicyUrl={privacyPolicyUrl}
              key={form.key('termsOfService')}
              {...withAuthFieldError(form.getInputProps('termsOfService', { type: 'checkbox' }))}
            />
          </Stack>

          <ButtonNew type='submit' size='lg' fullWidth loading={isConfigurationPending || signup.isPending}>
            {t('Continue')}
          </ButtonNew>
        </Stack>
      </form>

      <Text size='sm' ta='center'>
        {t('Already have an account?')}&nbsp;
        <Anchor component={Link} to={AUTH_ROUTES.LOGIN} inherit>
          {t('Log in')}
        </Anchor>
      </Text>
    </Stack>
  )
}
