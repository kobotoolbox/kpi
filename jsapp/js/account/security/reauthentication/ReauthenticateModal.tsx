import { Group, Stack, Text } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState } from 'react'
import MfaCodeInput from '#/auth/MfaCodeInput'
import { getGenericAllauthErrorMessage } from '#/auth/allauthErrors'
import { validatePassword, validateRequiredField } from '#/auth/authValidation'
import ButtonNew from '#/components/common/ButtonNew'
import ModalNew from '#/components/common/ModalNew'
import PasswordInput from '#/components/common/PasswordInput'
import Alert from '#/components/common/alert'
import { CredentialRejection, useReauthenticate } from './reauthentication.api'
import type { ReauthenticationAsk } from './reauthentication.utils'

interface ReauthenticateFormValues {
  password: string
  /** A token from the authenticator app or a recovery code */
  code: string
}

interface ReauthenticateModalProps {
  ask: ReauthenticationAsk
  /** Says what the confirmation is for */
  description: string
  /** The caller retries the refused request here */
  onReauthenticated: () => void
  onClose: () => void
}

/**
 * Asks for the credentials a sensitive request was refused for, in place, so whatever was typed into the page
 * survives. SSO-only accounts get just the code field, as they have no password.
 */
export default function ReauthenticateModal({
  ask,
  description,
  onReauthenticated,
  onClose,
}: ReauthenticateModalProps) {
  const reauthenticate = useReauthenticate()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<ReauthenticateFormValues>({
    mode: 'uncontrolled',
    initialValues: { password: '', code: '' },
    validate: {
      password: (value) => (ask.isPasswordNeeded ? validatePassword(value) : null),
      code: (value) => (ask.isCodeNeeded ? validateRequiredField(value) : null),
    },
  })

  function handleSubmit({ password, code }: ReauthenticateFormValues) {
    setFormError(null)
    reauthenticate.mutate(
      {
        password: ask.isPasswordNeeded ? password : undefined,
        code: ask.isCodeNeeded ? code.trim() : undefined,
      },
      {
        onSuccess: onReauthenticated,
        onError: (error) => {
          if (!(error instanceof CredentialRejection)) {
            setFormError(getGenericAllauthErrorMessage())
          } else if (error.field) {
            form.setFieldError(error.field, error.message)
          } else {
            setFormError(error.message)
          }
        },
      },
    )
  }

  return (
    <ModalNew opened onClose={onClose} title={t("Confirm it's you")} size='md'>
      <Stack>
        <Text>{description}</Text>

        <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
          <Stack>
            {formError && (
              <Alert type='error' iconName='alert'>
                {formError}
              </Alert>
            )}

            {ask.isPasswordNeeded && (
              <PasswordInput
                label={t('Password')}
                autoComplete='current-password'
                data-autofocus
                key={form.key('password')}
                {...form.getInputProps('password')}
              />
            )}

            {ask.isCodeNeeded && (
              <MfaCodeInput
                data-autofocus={!ask.isPasswordNeeded || undefined}
                key={form.key('code')}
                {...form.getInputProps('code')}
              />
            )}

            <Group justify='flex-end'>
              <ButtonNew type='button' size='md' variant='light' onClick={onClose}>
                {t('Cancel')}
              </ButtonNew>
              <ButtonNew type='submit' size='md' loading={reauthenticate.isPending}>
                {t('Confirm')}
              </ButtonNew>
            </Group>
          </Stack>
        </form>
      </Stack>
    </ModalNew>
  )
}
