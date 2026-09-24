import { Anchor, Stack, Text, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FlowId } from '#/api/models/flowId'
import type { LoginBody } from '#/api/models/loginBody'
import { useAllauthBrowserV1AuthLoginPost } from '#/api/react-query/authentication-allauth-headless'
import { withAuthFieldError } from '#/auth/AuthFieldError'
import { getGenericAllauthErrorMessage, getPendingFlowIds, splitAllauthErrors } from '#/auth/allauthErrors'
import { getRequiredFieldMessage, validateRequiredField } from '#/auth/authValidation'
import ButtonNew from '#/components/common/ButtonNew'
import PasswordInput from '#/components/common/PasswordInput'
import TextInput from '#/components/common/TextInput'
import Alert from '#/components/common/alert'
import { AUTH_ROUTES } from '#/router/routerConstants'
import styles from './LoginForm.module.scss'

interface LoginFormValues {
  /** Username or email address, depending on what the server accepts */
  identifier: string
  password: string
}

/** How far the sign-in got, for the route to turn into a panel. */
export type LoginOutcome =
  /** Credentials accepted and the session exists. */
  | { kind: 'authenticated' }
  /** A session was already there, so there was nothing to sign in to. */
  | { kind: 'alreadyAuthenticated' }
  /**
   * Right credentials, unconfirmed address. `email` is only known on a server that signs in by address - with
   * a username there is nothing to prefill the resend with.
   */
  | { kind: 'emailVerificationRequired'; email?: string }
  /** Credentials accepted, and allauth wants a one-time code before it hands out the session. */
  | { kind: 'mfaRequired' }
  /** Credentials accepted, but allauth wants a step this screen cannot show yet. */
  | { kind: 'unsupportedStep' }

/** Moves the credential error onto the input that shows it */
function withIdentifierError(fieldErrors: Record<string, string>, credentialParam: string) {
  const { [credentialParam]: credentialError, ...rest } = fieldErrors
  return credentialError ? { ...rest, identifier: credentialError } : rest
}

export interface LoginFormProps {
  isUsernameAccepted: boolean
  /** Blocks submitting until `/environment` loads */
  isConfigurationPending: boolean
  onOutcome: (outcome: LoginOutcome) => void
}

/** Credentials and nothing else. Password recovery, single sign-on etc. all live elsewhere */
export default function LoginForm({ isUsernameAccepted, isConfigurationPending, onOutcome }: LoginFormProps) {
  // The name allauth reads the credential from, and the one it reports errors about.
  const credentialParam = isUsernameAccepted ? 'username' : 'email'

  const form = useForm<LoginFormValues>({
    // The uncontrolled mode is recommended by Mantine Corp
    mode: 'uncontrolled',
    initialValues: { identifier: '', password: '' },
    validate: {
      identifier: validateRequiredField,
      // Untrimmed, because spaces are a legitimate part of a password
      password: (value) => (value ? null : getRequiredFieldMessage()),
    },
  })

  // Errors that belong to no single input, shown in a banner above the form
  const [formErrors, setFormErrors] = useState<string[]>([])

  const login = useAllauthBrowserV1AuthLoginPost({
    mutation: {
      // Rejections land here too, not in `onError`: allauth signals with status codes, so `fetchAllauth`
      // hands back every answer below 500 as data for us to read.
      onSuccess: (response, variables) => {
        if (response.status === 200 && response.data.meta.is_authenticated) {
          onOutcome({ kind: 'authenticated' })
          return
        }
        // A 409 means a session was already in place
        if (response.status === 409) {
          onOutcome({ kind: 'alreadyAuthenticated' })
          return
        }
        // The credentials were right, and allauth is asking for one more thing before it hands out a session
        const pendingFlowIds = getPendingFlowIds(response)
        if (pendingFlowIds.includes(FlowId.verify_email)) {
          // `ACCOUNT_EMAIL_VERIFICATION = 'mandatory'`, the KPI default: allauth's `EmailVerificationStage` has already
          // mailed a fresh link by the time we get here.
          onOutcome({
            kind: 'emailVerificationRequired',
            email: 'email' in variables.data ? variables.data.email : undefined,
          })
          return
        }
        if (pendingFlowIds.includes(FlowId.mfa_authenticate)) {
          onOutcome({ kind: 'mfaRequired' })
          return
        }
        if (pendingFlowIds.length > 0) {
          onOutcome({ kind: 'unsupportedStep' })
          return
        }
        const { fieldErrors, formErrors: bannerErrors } = splitAllauthErrors(response, [credentialParam, 'password'])
        form.setErrors(withIdentifierError(fieldErrors, credentialParam))
        setFormErrors(bannerErrors)
      },
      // Only a 5xx or a dead connection gets this far. Handling it here rather than leaving it to the
      // global toast keeps the message next to the button that just failed.
      onError: () => setFormErrors([getGenericAllauthErrorMessage()]),
    },
  })

  const handleSubmit = (values: LoginFormValues) => {
    // The button below is disabled while we wait, but better be safe and check here too
    if (isConfigurationPending) {
      return
    }

    setFormErrors([])

    const identifier = values.identifier.trim()
    const body = (
      isUsernameAccepted
        ? { username: identifier, password: values.password }
        : { email: identifier, password: values.password }
    ) satisfies LoginBody

    login.mutate({ data: body })
  }

  return (
    <Stack gap='xl'>
      <Title order={1} size='h3'>
        {t('Log into your account')}
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

      {/* `noValidate` so an address the browser dislikes still reaches the server */}
      <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
        <Stack gap='xl'>
          <Stack gap='sm'>
            <TextInput
              label={isUsernameAccepted ? t('Username') : t('Email')}
              type={isUsernameAccepted ? 'text' : 'email'}
              autoComplete={isUsernameAccepted ? 'username' : 'email'}
              key={form.key('identifier')}
              {...withAuthFieldError(form.getInputProps('identifier'))}
              required
            />

            {/* The recovery link belongs on the label's line, but outside the label */}
            <div className={styles.passwordField}>
              <PasswordInput
                label={t('Password')}
                autoComplete='current-password'
                key={form.key('password')}
                {...withAuthFieldError(form.getInputProps('password'))}
                required
              />
              <Anchor className={styles.forgotPasswordLink} component={Link} to={AUTH_ROUTES.RESET_PASSWORD} size='sm'>
                {t('Forgot password?')}
              </Anchor>
            </div>
          </Stack>

          <ButtonNew type='submit' size='lg' fullWidth loading={isConfigurationPending || login.isPending}>
            {t('Log in')}
          </ButtonNew>
        </Stack>
      </form>

      {/* TODO: the single sign-on providers from `social_apps` go here, in DEV-1853. */}

      <Text size='sm' ta='center'>
        {t('New user?')}&nbsp;
        <Anchor component={Link} to={AUTH_ROUTES.SIGNUP} inherit>
          {t('Create an account')}
        </Anchor>
      </Text>
    </Stack>
  )
}
