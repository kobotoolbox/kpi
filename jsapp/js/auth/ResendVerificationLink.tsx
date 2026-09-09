import { Stack, Text } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState } from 'react'
import { ServerError } from '#/api/ServerError'
import type { ErrorValidation } from '#/api/models/errorValidation'
import { type OrvalFetchError, getApiErrorMessage } from '#/api/onErrorDefaultHandler'
import { useEmailConfirmationsCreate } from '#/api/react-query/user-team-organization-usage'
import { withAuthFieldError } from '#/auth/AuthFieldError'
import { validateEmail } from '#/auth/RegisterRoute/registerValidation'
import ButtonNew from '#/components/common/ButtonNew'
import TextInput from '#/components/common/TextInput'
import Alert from '#/components/common/alert'

interface ResendVerificationLinkValues {
  email: string
}

export interface ResendVerificationLinkProps {
  /** Button wording, because each screen phrases the offer differently. */
  label: string
  /** Left out when we have no address to send to, and then we show a field to type one into. */
  email?: string
  /**
   * Called once the request has gone through. Screens that answer with a panel of their own pass this,
   * and then nothing is rendered here; without it the server's confirmation appears in place.
   */
  onSent?: () => void
}

/** Pulls the field error out of a 400, which the serializer reports as `{email: [message]}`. */
function getEmailFieldMessage(error: OrvalFetchError): string | null {
  if (!(error instanceof ServerError)) {
    return null
  }
  const message = (error.parsedResponse as ErrorValidation | undefined)?.email?.[0]
  return typeof message === 'string' ? message : null
}

/**
 * Asks for another confirmation email, either straight away or once an address has been typed in.
 *
 * Nothing here says whether the address is registered. The endpoint answers the same way for an address
 * nobody holds, and the copy around it is written to keep it that way.
 */
export default function ResendVerificationLink({ label, email, onSent }: ResendVerificationLinkProps) {
  const [sent, setSent] = useState(false)
  // For failures that belong to no field, like the throttle.
  const [requestError, setRequestError] = useState<string | null>(null)

  const form = useForm<ResendVerificationLinkValues>({
    // Uncontrolled: the input below needs `key={form.key('email')}` or it stops re-rendering on change
    mode: 'uncontrolled',
    initialValues: { email: email ?? '' },
    validate: { email: (value) => validateEmail(value, undefined) },
  })

  // The generated `TError` describes the 400 and 429 bodies, but this endpoint goes through
  // `fetchWithAuth`, which throws a `ServerError` wrapping them - so that is what `onError` really gets.
  const request = useEmailConfirmationsCreate<OrvalFetchError>({
    mutation: {
      onSuccess: () => (onSent ? onSent() : setSent(true)),
      // Handled here rather than by the default toast, so the message sits next to the button that failed.
      onError: (error) => {
        const fieldMessage = getEmailFieldMessage(error)
        // With no field on screen there is nowhere to put a field error, so it goes in the banner.
        if (fieldMessage && email === undefined) {
          form.setErrors({ email: fieldMessage })
          return
        }
        setRequestError(getApiErrorMessage(error) || t('Something went wrong. Please try again later.'))
      },
    },
  })

  const send = (address: string) => {
    setRequestError(null)
    request.mutate({ data: { email: address } })
  }

  function renderControl() {
    if (sent) {
      // Shown as the server wrote it: the wording is deliberately vague about whether the address is
      // registered, and rephrasing it here risks giving that away.
      const detail = request.data?.status === 200 ? request.data.data.detail : null
      return <Text>{detail || t('Check your inbox for a new confirmation link.')}</Text>
    }

    // An address we were handed needs no field, just the offer to send to it again.
    if (email !== undefined) {
      return (
        <ButtonNew size='lg' fullWidth loading={request.isPending} onClick={() => send(email)}>
          {label}
        </ButtonNew>
      )
    }

    return (
      // `noValidate` because we want to validate email ourselves
      <form onSubmit={form.onSubmit((values) => send(values.email.trim()))} noValidate>
        <Stack gap='md'>
          <TextInput
            placeholder={t('Email')}
            aria-label={t('Email')}
            type='email'
            autoComplete='email'
            key={form.key('email')}
            {...withAuthFieldError(form.getInputProps('email'))}
            required
          />
          <ButtonNew type='submit' size='lg' fullWidth loading={request.isPending}>
            {label}
          </ButtonNew>
        </Stack>
      </form>
    )
  }

  return (
    <Stack gap='md'>
      {requestError && (
        <Alert type='error' iconName='alert'>
          {requestError}
        </Alert>
      )}
      {renderControl()}
    </Stack>
  )
}
