import { Stack } from '@mantine/core'
import { useForm } from '@mantine/form'
import { withAuthFieldError } from '#/auth/AuthFieldError'
import { validateEmail } from '#/auth/RegisterRoute/registerValidation'
import ButtonNew from '#/components/common/ButtonNew'
import TextInput from '#/components/common/TextInput'

interface ResendVerificationLinkValues {
  email: string
}

export interface ResendVerificationLinkProps {
  /** Wording for the button. The screens offering a new link each ask for it differently. */
  label: string
  /**
   * If not provided, we show an input and ask for the address - an expired link says nothing about who
   * followed it.
   */
  email?: string
}

/**
 * Asks for another confirmation email: the button, plus a field for the address when we don't have one.
 *
 * TODO: A placeholder: validation and layout are real, submitting sends nothing.
 * TODO: Backend is building an endpoint in kobotoolbox/kpi#7532 - use it when ready.
 * TODO: will be throttled with EMAIL_CONFIRMATION_REQUESTS_PER_HOUR setting, so when 429 is returned,
 * we need a message to appear.
 * TODO: the endpoint answers the same 200 for a registered and an unknown address, on purpose, so a
 * typed-in one can't be told the mail went out. A known `email` is already awaiting confirmation and can.
 */
export default function ResendVerificationLink({ label, email }: ResendVerificationLinkProps) {
  const form = useForm<ResendVerificationLinkValues>({
    // Uncontrolled: the input below needs `key={form.key('email')}` or it stops re-rendering on change
    mode: 'uncontrolled',
    initialValues: { email: email ?? '' },
    validate: { email: (value) => validateEmail(value, undefined) },
  })

  const handleSubmit = (_values: ResendVerificationLinkValues) => {
    // Nothing to send to yet - see the TODOs above
  }

  return (
    // `noValidate` because we want to validate email ourselves
    <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
      <Stack gap='md'>
        {email === undefined && (
          <TextInput
            placeholder={t('Email')}
            aria-label={t('Email')}
            type='email'
            autoComplete='email'
            key={form.key('email')}
            {...withAuthFieldError(form.getInputProps('email'))}
            required
          />
        )}
        <ButtonNew type='submit' size='lg' fullWidth>
          {label}
        </ButtonNew>
      </Stack>
    </form>
  )
}
