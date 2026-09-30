import { Stack, Text, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState } from 'react'
import { useAllauthBrowserV1AuthPasswordResetPost } from '#/api/react-query/authentication-allauth-headless'
import { withAuthFieldError } from '#/auth/AuthFieldError'
import { getGenericAllauthErrorMessage, splitAllauthErrors } from '#/auth/allauthErrors'
import { validatePassword, validatePasswordConfirm, validateRequiredField } from '#/auth/authValidation'
import ButtonNew from '#/components/common/ButtonNew'
import PasswordInput from '#/components/common/PasswordInput'
import TextInput from '#/components/common/TextInput'
import Alert from '#/components/common/alert'

interface NewPasswordFormValues {
  /** Only asked for when no link key arrived - see {@link NewPasswordFormProps.resetKey} */
  code: string
  password: string
  passwordConfirm: string
}

/** How the reset ended, for the route to turn into a panel */
export type NewPasswordOutcome =
  /** The password was changed, and allauth signed the account in on its way out */
  | { kind: 'changedAndSignedIn' }
  /** The password was changed and nobody is signed in, which is the KPI default */
  | { kind: 'changed' }
  /** The key stopped being usable between loading this form and submitting it */
  | { kind: 'keyRejected' }
  /** A session appeared while this form was open - allauth will not reset a password behind one */
  | { kind: 'alreadyAuthenticated' }

/** Fields allauth may name in `param` */
const SERVER_KNOWN_FIELDS = ['password', 'key'] as const

export interface NewPasswordFormProps {
  /**
   * The key from the link in the reset email, posted alongside the new password. Left out on a server running
   * `ACCOUNT_PASSWORD_RESET_BY_CODE_ENABLED`, which mails a code instead: then this form asks for it, and the
   * code goes where the key would have. Nothing checks it up front - allowed attempts are few, and this POST
   * is one, so spending another to look the code up first could leave nothing to reset with.
   */
  resetKey?: string
  onOutcome: (outcome: NewPasswordOutcome) => void
}

/** Picks the new password. With a link the route has already checked the key, so only the typing is left. */
export default function NewPasswordForm({ resetKey, onOutcome }: NewPasswordFormProps) {
  const collectsCode = resetKey === undefined

  const form = useForm<NewPasswordFormValues>({
    // The uncontrolled mode is recommended by Mantine Corp
    mode: 'uncontrolled',
    initialValues: { code: '', password: '', passwordConfirm: '' },
    validate: {
      code: (value) => (collectsCode ? validateRequiredField(value) : null),
      password: validatePassword,
      passwordConfirm: (value, values) => validatePasswordConfirm(value, values.password),
    },
  })

  // Errors that belong to no single input, shown in a banner above the form
  const [formErrors, setFormErrors] = useState<string[]>([])

  const resetPassword = useAllauthBrowserV1AuthPasswordResetPost({
    mutation: {
      // Rejections land here too, not in `onError`: `fetchAllauth` hands back everything below 500 as data.
      onSuccess: (response) => {
        // 200 means `ACCOUNT_LOGIN_ON_PASSWORD_RESET` is on. Off - the KPI default - allauth answers 401:
        // the password changed, there is just no session to show for it.
        if (response.status === 200) {
          onOutcome({ kind: 'changedAndSignedIn' })
          return
        }
        if (response.status === 401) {
          onOutcome({ kind: 'changed' })
          return
        }
        if (response.status === 409) {
          onOutcome({ kind: 'alreadyAuthenticated' })
          return
        }
        const { fieldErrors, formErrors: bannerErrors } = splitAllauthErrors(response, SERVER_KNOWN_FIELDS)
        if (fieldErrors.key) {
          // A typed code can simply be wrong, and correcting it here beats sending someone back for another
          // email. A link's key cannot be corrected, so that one ends the attempt.
          if (collectsCode) {
            form.setFieldError('code', t('That code is not valid or has expired. Check your email and try again.'))
            return
          }
          // The key expired while the form sat open
          onOutcome({ kind: 'keyRejected' })
          return
        }
        form.setErrors(fieldErrors)
        setFormErrors(bannerErrors)
      },
      // Only a 5xx or a dead connection gets here. Kept in the form so the message sits by the button.
      onError: () => setFormErrors([getGenericAllauthErrorMessage()]),
    },
  })

  const handleSubmit = (values: NewPasswordFormValues) => {
    setFormErrors([])
    // A code is the reset key on servers that mail one, so it posts under the same name.
    resetPassword.mutate({ data: { key: resetKey ?? values.code.trim(), password: values.password } })
  }

  return (
    <Stack gap='xl'>
      <Stack gap='md'>
        <Title order={1} size='h3'>
          {t('Create new password')}
        </Title>
        {collectsCode && <Text>{t('Enter the code from the password reset email, then pick a new password.')}</Text>}
        <Text>{t("Your password can't be too similar to your other personal information.")}</Text>
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

      <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
        <Stack gap='xl'>
          {collectsCode && (
            <TextInput
              label={t('Password reset code')}
              autoComplete='one-time-code'
              key={form.key('code')}
              {...withAuthFieldError(form.getInputProps('code'))}
              required
            />
          )}

          <Stack gap='sm'>
            <PasswordInput
              label={t('New password')}
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

          <ButtonNew type='submit' size='lg' fullWidth loading={resetPassword.isPending}>
            {t('Change password')}
          </ButtonNew>
        </Stack>
      </form>
    </Stack>
  )
}
