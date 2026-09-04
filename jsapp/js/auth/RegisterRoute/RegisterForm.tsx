import { Anchor, Checkbox, Stack, Text, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState } from 'react'
import type { SignupBody } from '#/api/models/signupBody'
import type { SocialApp } from '#/api/models/socialApp'
import { useAllauthBrowserV1AuthSignupPost } from '#/api/react-query/authentication-allauth-headless'
import { withAuthFieldError } from '#/auth/AuthFieldError'
import { isPendingEmailVerification, splitAllauthErrors } from '#/auth/allauthErrors'
import ButtonNew from '#/components/common/ButtonNew'
import PasswordInput from '#/components/common/PasswordInput'
import TextInput from '#/components/common/TextInput'
import Alert from '#/components/common/alert'
import { PATHS } from '#/router/routerConstants'
import {
  validateEmail,
  validateFullName,
  validatePassword,
  validatePasswordConfirm,
  validateTermsOfService,
  validateUsername,
} from './registerValidation'

interface RegisterFormValues {
  name: string
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

/** Turns every `[...]` marker into a link, taking the URLs in the order they are given. */
function withLegalLinks(sentence: string, urls: string[]) {
  // Splitting on a capturing group alternates plain text and bracketed label, so the labels are the odd
  // entries and take one URL each.
  return sentence.split(/\[([^\]]+)\]/).map((part, index) =>
    index % 2 ? (
      <Anchor key={part} href={urls[Math.floor(index / 2)]} target='_blank' rel='noopener noreferrer' inherit>
        {part}
      </Anchor>
    ) : (
      part
    ),
  )
}

/**
 * The label for the Terms of Service checkbox, or `null` when the server configures neither - if nothing to agree
 * we don't display the checkbox.
 */
function legalSentence(termsOfServiceUrl: string | null | undefined, privacyPolicyUrl: string | null | undefined) {
  if (termsOfServiceUrl && privacyPolicyUrl) {
    return withLegalLinks(t('I agree with the [Terms of Service] and [Privacy Policy]'), [
      termsOfServiceUrl,
      privacyPolicyUrl,
    ])
  }
  if (termsOfServiceUrl) {
    return withLegalLinks(t('I agree with the [Terms of Service]'), [termsOfServiceUrl])
  }
  if (privacyPolicyUrl) {
    return withLegalLinks(t('I agree with the [Privacy Policy]'), [privacyPolicyUrl])
  }
  return null
}

export interface RegisterFormProps {
  /** From `/api/v2/environment/`. Used to spot an email domain that has to sign in through SSO. */
  socialApps: SocialApp[] | undefined
  termsOfServiceUrl: string | null | undefined
  privacyPolicyUrl: string | null | undefined
  /** Called with the submitted address once the account exists and the activation email is on its way. */
  onRegistered: (email: string) => void
}

export default function RegisterForm({
  socialApps,
  termsOfServiceUrl,
  privacyPolicyUrl,
  onRegistered,
}: RegisterFormProps) {
  const legalLabel = legalSentence(termsOfServiceUrl, privacyPolicyUrl)

  const form = useForm<RegisterFormValues>({
    // The uncontrolled mode is recommended by Mantine Corp
    mode: 'uncontrolled',
    initialValues: {
      name: '',
      email: '',
      username: '',
      password: '',
      passwordConfirm: '',
      newsletterSubscription: false,
      termsOfService: false,
    },
    validate: {
      name: validateFullName,
      email: (value) => validateEmail(value, socialApps),
      username: validateUsername,
      password: validatePassword,
      passwordConfirm: (value, values) => validatePasswordConfirm(value, values.password),
      // No checkbox to tick when there is no legal document, so nothing to require. Mantine reads these
      // rules fresh on every render, so this follows the label once `/environment` lands.
      termsOfService: legalLabel ? validateTermsOfService : undefined,
    },
  })

  // Errors that belong to no single input, shown in a banner above the form.
  const [formErrors, setFormErrors] = useState<string[]>([])

  const signup = useAllauthBrowserV1AuthSignupPost({
    mutation: {
      onSuccess: (_response, variables) => {
        // A 2xx only happens where a deployment sets `ACCOUNT_EMAIL_VERIFICATION` to `none` or
        // `optional`: the account is created and already logged in, with nothing left to confirm.
        // We pass email (to show the inbox) screen anyway.
        onRegistered(variables.data.email)
      },
      onError: (error, variables) => {
        // With verification mandatory (the KPI default) a successful signup answers 401, and the
        // fetch mutator throws on every non-2xx, so success arrives here.
        if (isPendingEmailVerification(error)) {
          onRegistered(variables.data.email)
          return
        }
        // Passing any `onError` also suppresses the global toast, which would double up on these
        // inline messages.
        const { fieldErrors, formErrors: bannerErrors } = splitAllauthErrors(error, SERVER_KNOWN_FIELDS)
        form.setErrors(fieldErrors)
        setFormErrors(bannerErrors)
      },
    },
  })

  const handleSubmit = (values: RegisterFormValues) => {
    setFormErrors([])
    // `SignupBody` is only `{email, username, password}` today. Backend needs to update the Orval types (and Backend
    // code?)
    const body = {
      email: values.email.trim(),
      username: values.username.trim(),
      password: values.password,
      name: values.name.trim(),
      newsletter_subscription: values.newsletterSubscription,
      terms_of_service: values.termsOfService,
    } as SignupBody

    signup.mutate({ data: body })
  }

  return (
    <Stack gap='xl'>
      <Title order={1} size='h3'>
        {t('Create an account')}
      </Title>

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
            <Checkbox
              label={t('KoboToolbox news and features')}
              key={form.key('newsletterSubscription')}
              {...withAuthFieldError(form.getInputProps('newsletterSubscription', { type: 'checkbox' }))}
            />
            {legalLabel && (
              <Checkbox
                label={legalLabel}
                key={form.key('termsOfService')}
                {...withAuthFieldError(form.getInputProps('termsOfService', { type: 'checkbox' }))}
              />
            )}
          </Stack>

          <ButtonNew type='submit' size='lg' fullWidth loading={signup.isPending}>
            {t('Continue')}
          </ButtonNew>
        </Stack>
      </form>

      <Text size='sm' ta='center'>
        {t('Already have an account?')}&nbsp;
        <Anchor href={PATHS.LOGIN} inherit>
          {t('Log in')}
        </Anchor>
      </Text>
    </Stack>
  )
}
