import { Stack, Text, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState } from 'react'
import { useAllauthBrowserV1AuthPasswordRequestPost } from '#/api/react-query/authentication-allauth-headless'
import { withAuthFieldError } from '#/auth/AuthFieldError'
import { getGenericAllauthErrorMessage, splitAllauthErrors } from '#/auth/allauthErrors'
import { validateEmailFormat } from '#/auth/authValidation'
import ButtonNew from '#/components/common/ButtonNew'
import TextInput from '#/components/common/TextInput'
import Alert from '#/components/common/alert'

interface ResetPasswordFormValues {
  email: string
}

export interface ResetPasswordFormProps {
  onRequested: () => void
}

/** Asks for the address to mail a reset link to */
export default function ResetPasswordForm({ onRequested }: ResetPasswordFormProps) {
  const form = useForm<ResetPasswordFormValues>({
    // The uncontrolled mode is recommended by Mantine Corp
    mode: 'uncontrolled',
    initialValues: { email: '' },
    validate: { email: validateEmailFormat },
  })

  // Errors that belong to no single input, shown in a banner above the form
  const [formErrors, setFormErrors] = useState<string[]>([])

  const requestReset = useAllauthBrowserV1AuthPasswordRequestPost({
    mutation: {
      // Rejections land here too, not in `onError`: `fetchAllauth` hands back everything below 500 as data.
      onSuccess: (response) => {
        // 200 is the stateless link flow KPI runs. 401 is the same request taken where
        // `ACCOUNT_PASSWORD_RESET_BY_CODE_ENABLED` is on - still mail sent, so the same panel.
        if (response.status === 200 || response.status === 401) {
          onRequested()
          return
        }
        const { fieldErrors, formErrors: bannerErrors } = splitAllauthErrors(response, ['email'])
        form.setErrors(fieldErrors)
        setFormErrors(bannerErrors)
      },
      // Only a 5xx or a dead connection gets here. Kept in the form so the message sits by the button.
      onError: () => setFormErrors([getGenericAllauthErrorMessage()]),
    },
  })

  const handleSubmit = (values: ResetPasswordFormValues) => {
    setFormErrors([])
    requestReset.mutate({ data: { email: values.email.trim() } })
  }

  return (
    <Stack gap='xl'>
      <Stack gap='md'>
        <Title order={1} size='h3'>
          {t('Reset your password')}
        </Title>
        <Text>
          {t("Enter the email address associated with your account and we'll send you a link to reset your password")}
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

      {/* `noValidate` because we want to validate the address ourselves */}
      <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
        <Stack gap='xl'>
          <TextInput
            label={t('Email')}
            type='email'
            autoComplete='email'
            key={form.key('email')}
            {...withAuthFieldError(form.getInputProps('email'))}
            required
          />

          <ButtonNew type='submit' size='lg' fullWidth loading={requestReset.isPending}>
            {t('Reset password')}
          </ButtonNew>
        </Stack>
      </form>
    </Stack>
  )
}
