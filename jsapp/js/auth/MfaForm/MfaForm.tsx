import { Stack, Text, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState } from 'react'
import { FlowId } from '#/api/models/flowId'
import { useAllauthBrowserV1Auth2faAuthenticatePost } from '#/api/react-query/authentication-allauth-headless'
import { useAuthConfiguration } from '#/auth/AuthContainer/useAuthConfiguration'
import { withAuthFieldError } from '#/auth/AuthFieldError'
import { getGenericAllauthErrorMessage, getPendingFlowIds, splitAllauthErrors } from '#/auth/allauthErrors'
import { validateRequiredField } from '#/auth/authValidation'
import ButtonNew from '#/components/common/ButtonNew'
import TextInput from '#/components/common/TextInput'
import Alert from '#/components/common/alert'
import { replaceSupportEmail } from '#/textUtils'

interface MfaFormValues {
  /** A token from the authenticator app or a backup code */
  code: string
}

export type MfaOutcome =
  /** The code checked out, and the session allauth was holding back now exists */
  | { kind: 'authenticated' }
  /** allauth is no longer waiting on a code, so the half-finished sign-in this belonged to is gone */
  | { kind: 'mfaExpired' }

/** What `MFA_CODE_LENGTH` defaults to, and what the copy says until `/environment` lands */
const DEFAULT_CODE_LENGTH = 6

/**
 * What to do when the authenticator app is out of reach. Replaces the form rather than opening beside it, and the way
 * back is the only thing on it.
 */
function VerificationIssuesPanel({ onGoBack }: { onGoBack: () => void }) {
  return (
    <Stack gap='xl'>
      <Stack gap='md'>
        <Title order={1} size='h3'>
          {t('Verification issues')}
        </Title>

        <Text>
          {replaceSupportEmail(
            t(
              "If you cannot access your authenticator app, please enter one of your backup codes instead. If you don't have those either, contact help@kobotoolbox.org for help.",
            ),
          )}
        </Text>
      </Stack>

      <ButtonNew size='lg' fullWidth onClick={onGoBack}>
        {t('Go back')}
      </ButtonNew>
    </Stack>
  )
}

export interface MfaFormProps {
  onOutcome: (outcome: MfaOutcome) => void
}

/**
 * The second factor, asked for once a password has been accepted: allauth is holding the session back until it gets
 * a one-time token or a backup code.
 *
 * Takes the place of the credentials form rather than living on a route of its own, because the pending flow
 * is in the allauth session and not in the URL - there is no address that could be opened to get here.
 */
export default function MfaForm({ onOutcome }: MfaFormProps) {
  const { data } = useAuthConfiguration()
  const [isShowingIssues, setIsShowingIssues] = useState(false)

  const form = useForm<MfaFormValues>({
    // The uncontrolled mode is recommended by Mantine Corp
    mode: 'uncontrolled',
    initialValues: { code: '' },
    validate: { code: validateRequiredField },
  })

  // Errors that belong to no single input, shown in a banner above the form
  const [formErrors, setFormErrors] = useState<string[]>([])

  const authenticate = useAllauthBrowserV1Auth2faAuthenticatePost({
    mutation: {
      // Rejections land here too, not in `onError`: `fetchAllauth` hands back everything below 500 as data.
      onSuccess: (response) => {
        if (response.status === 200 && response.data.meta.is_authenticated) {
          onOutcome({ kind: 'authenticated' })
          return
        }
        // A 401 that no longer lists `mfa_authenticate` means allauth has stopped waiting for a code, so no code could
        // be right any more. A refused code is a 400 instead, and leaves the flow pending.
        if (response.status === 401 && !getPendingFlowIds(response).includes(FlowId.mfa_authenticate)) {
          onOutcome({ kind: 'mfaExpired' })
          return
        }
        const { fieldErrors, formErrors: bannerErrors } = splitAllauthErrors(response, ['code'])
        form.setErrors(fieldErrors)
        setFormErrors(bannerErrors)
      },
      // Only a 5xx or a dead connection gets here. Kept in the form so the message sits by the button.
      onError: () => setFormErrors([getGenericAllauthErrorMessage()]),
    },
  })

  const handleSubmit = (values: MfaFormValues) => {
    setFormErrors([])
    authenticate.mutate({ data: { code: values.code.trim() } })
  }

  if (isShowingIssues) {
    return <VerificationIssuesPanel onGoBack={() => setIsShowingIssues(false)} />
  }

  return (
    <Stack gap='xl'>
      <Stack gap='md'>
        <Title order={1} size='h3'>
          {t('Please enter your verification token or backup code')}
        </Title>

        <Text>
          {t(
            'Use the ##number##-character token displayed by your authenticator app or one of your backup codes.',
          ).replace('##number##', String(data?.mfaCodeLength ?? DEFAULT_CODE_LENGTH))}
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

      {/* `noValidate` so no browser rule ends up between a backup code and the server that knows its shape */}
      <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
        <Stack gap='xl'>
          <TextInput
            label={t('Code')}
            placeholder={t('Enter token or backup code')}
            // Lets a password manager or a phone hand over the code it just saw
            autoComplete='one-time-code'
            // Not `numeric`: a backup code is not all digits, and a keypad would hide the letters
            inputMode='text'
            autoFocus
            key={form.key('code')}
            {...withAuthFieldError(form.getInputProps('code'))}
            required
          />

          <Stack gap='xs'>
            <ButtonNew type='submit' size='lg' fullWidth loading={authenticate.isPending}>
              {t('Continue')}
            </ButtonNew>

            {/* Inside the form so it keeps its place in the tab order, hence the explicit `type` */}
            <ButtonNew type='button' variant='transparent' size='lg' fullWidth onClick={() => setIsShowingIssues(true)}>
              {t('Problem with token?')}
            </ButtonNew>
          </Stack>
        </Stack>
      </form>
    </Stack>
  )
}
