import { Anchor, Stack, Text, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { type ReactNode, useState } from 'react'
import { Link } from 'react-router-dom'
import { FlowId } from '#/api/models/flowId'
import type { LoginBody } from '#/api/models/loginBody'
import type { SocialApp } from '#/api/models/socialApp'
import { useAllauthBrowserV1AuthLoginPost } from '#/api/react-query/authentication-allauth-headless'
import { withAuthFieldError } from '#/auth/AuthFieldError'
import ProviderLoginButtons from '#/auth/ProviderRoute/ProviderLoginButtons'
import { getGenericAllauthErrorMessage, getPendingFlowIds, splitAllauthErrors } from '#/auth/allauthErrors'
import { getRequiredFieldMessage, validateRequiredField } from '#/auth/authValidation'
import ButtonNew from '#/components/common/ButtonNew'
import PasswordInput from '#/components/common/PasswordInput'
import TextInput from '#/components/common/TextInput'
import Alert from '#/components/common/alert'
import { AUTH_ROUTES } from '#/router/routerConstants'
import styles from './LoginForm.module.scss'

interface LoginFormValues {
  username: string
  password: string
}

/** How far the sign-in got, for the route to turn into a panel. */
export type LoginOutcome =
  /** Credentials accepted and the session exists. */
  | { kind: 'authenticated' }
  /** Right credentials, unconfirmed address. */
  | { kind: 'emailVerificationRequired' }
  /** Credentials accepted, and allauth wants a one-time code before it hands out the session. */
  | { kind: 'mfaRequired' }
  /** Credentials accepted, but allauth wants a step this screen cannot show yet. */
  | { kind: 'unsupportedStep' }

export interface LoginFormProps {
  /** From `/api/v2/environment/`. The single sign-on providers this server advertises, if any. */
  socialApps: SocialApp[] | undefined
  /** Drops the signup link: with signup closed there is only a dead end behind it */
  isRegistrationClosed?: boolean
  /** Shown at the top, since it applies to the SSO buttons too */
  notice?: ReactNode
  onOutcome: (outcome: LoginOutcome) => void
}

/** The single sign-on providers, then the credentials. Password recovery etc. live elsewhere */
export default function LoginForm({ socialApps, isRegistrationClosed = false, notice, onOutcome }: LoginFormProps) {
  // SSO buttons take the primary look when there are any
  const hasProviders = Boolean(socialApps?.length)

  const form = useForm<LoginFormValues>({
    // The uncontrolled mode is recommended by Mantine Corp
    mode: 'uncontrolled',
    initialValues: { username: '', password: '' },
    validate: {
      username: validateRequiredField,
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
      onSuccess: (response) => {
        if (response.status === 200 && response.data.meta.is_authenticated) {
          onOutcome({ kind: 'authenticated' })
          return
        }
        // The credentials were right, and allauth is asking for one more thing before it hands out a session
        const pendingFlowIds = getPendingFlowIds(response)
        if (pendingFlowIds.includes(FlowId.verify_email)) {
          // `ACCOUNT_EMAIL_VERIFICATION = 'mandatory'`, the KPI default. Nothing was mailed - our
          // `AccountAdapter` declines allauth's resend on a headless login - so the panel has to offer one.
          onOutcome({ kind: 'emailVerificationRequired' })
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
        const { fieldErrors, formErrors: bannerErrors } = splitAllauthErrors(response, ['username', 'password'])
        form.setErrors(fieldErrors)
        setFormErrors(bannerErrors)
      },
      // Only a 5xx or a dead connection gets this far. Handling it here rather than leaving it to the
      // global toast keeps the message next to the button that just failed.
      onError: () => setFormErrors([getGenericAllauthErrorMessage()]),
    },
  })

  const handleSubmit = (values: LoginFormValues) => {
    setFormErrors([])
    const body = { username: values.username.trim(), password: values.password } satisfies LoginBody
    login.mutate({ data: body })
  }

  return (
    <Stack gap='xl'>
      {notice}

      <ProviderLoginButtons socialApps={socialApps} variant='filled' />

      <Title order={1} size='h3'>
        {t('Log in or create an account')}
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

      {/* Shows our field errors instead of the browser's popups */}
      <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
        <Stack gap='xl'>
          <Stack gap='sm'>
            <TextInput
              label={t('Username')}
              autoComplete='username'
              key={form.key('username')}
              {...withAuthFieldError(form.getInputProps('username'))}
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

          <ButtonNew
            variant={hasProviders ? 'light' : 'filled'}
            type='submit'
            size='lg'
            fullWidth
            loading={login.isPending}
          >
            {t('Log in')}
          </ButtonNew>
        </Stack>
      </form>

      {!isRegistrationClosed && (
        <Text size='sm' ta='center'>
          {t('New user?')}&nbsp;
          <Anchor component={Link} to={AUTH_ROUTES.SIGNUP} inherit>
            {t('Create an account')}
          </Anchor>
        </Text>
      )}
    </Stack>
  )
}
