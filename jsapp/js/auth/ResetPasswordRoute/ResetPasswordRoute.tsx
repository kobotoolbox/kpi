import { Image, Stack, Text, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import DocumentTitle from 'react-document-title'
import { useNavigate } from 'react-router-dom'
import {
  getAllauthBrowserV1AuthPasswordResetGetQueryKey,
  getAllauthBrowserV1AuthPasswordResetGetQueryOptions,
} from '#/api/react-query/authentication-allauth-headless'
import AuthAside, { shouldRenderAuthAside } from '#/auth/AuthContainer/AuthAside'
import AuthCard from '#/auth/AuthContainer/AuthCard'
import { useAuthEnvironment } from '#/auth/AuthContainer/useAuthEnvironment'
import { withAuthFieldError } from '#/auth/AuthFieldError'
import { getGenericAllauthErrorMessage } from '#/auth/allauthErrors'
import { validateRequiredField } from '#/auth/authValidation'
import ButtonNew from '#/components/common/ButtonNew'
import TextInput from '#/components/common/TextInput'
import { AUTH_ROUTES } from '#/router/routerConstants'
import emailEnvelopeIllustration from '../../../img/email-envelope-illustration.svg'
import ResetPasswordForm, { type PasswordResetDelivery } from './ResetPasswordForm'

/** Never names the address, like allauth: "no such account" would make this a way of finding who has one */
function EmailSentPanel() {
  return (
    <Stack gap='md' ta='center'>
      <Image src={emailEnvelopeIllustration} alt='' maw={190} mx='auto' />

      <Title order={1} size='h3'>
        {t('Email has been sent')}
      </Title>

      <Text>
        {t(
          'Your request has been received. If the email address you entered corresponds to an account on this service, a message has been sent with password reset instructions.',
        )}
      </Text>

      <Text>
        {t(
          "If you don't receive an email, your account might be registered under a different address, or you might have entered your address incorrectly",
        )}
      </Text>
    </Stack>
  )
}

/**
 * `ACCOUNT_PASSWORD_RESET_BY_CODE_ENABLED` mails a code where the default mails a link. The code *is* the reset key,
 * so collecting it and going to `NewPasswordRoute` reaches the same screen the link would have.
 */
function CodeEntryPanel() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isChecking, setIsChecking] = useState(false)
  const form = useForm<{ code: string }>({
    mode: 'uncontrolled',
    initialValues: { code: '' },
    validate: { code: validateRequiredField },
  })

  /**
   * Checks the code before moving on, so a mistyped one comes back to this field instead of ending up on the
   * dead-end panel meant for spent links. allauth only allows a few attempts, so restarting is expensive.
   */
  const handleSubmit = async ({ code }: { code: string }) => {
    const resetKey = code.trim()
    setIsChecking(true)
    try {
      const response = await queryClient.fetchQuery(
        getAllauthBrowserV1AuthPasswordResetGetQueryOptions({
          // allauth takes the key - the code, on this server - in a header rather than the URL
          request: { headers: { 'X-Password-Reset-Key': resetKey } },
          // The key `NewPasswordRoute` reads, so it carries on from this lookup rather than spending a second attempt
          query: { queryKey: [...getAllauthBrowserV1AuthPasswordResetGetQueryKey(), resetKey], retry: false },
        }),
      )
      // 409 is about the session rather than the code, and the next screen has the panel that explains it.
      if (response.status === 200 || response.status === 409) {
        navigate(AUTH_ROUTES.NEW_PASSWORD.replace(':key', encodeURIComponent(resetKey)))
        return
      }
      form.setFieldError('code', t('That code is not valid or has expired. Check your email and try again.'))
    } catch {
      // Only a 5xx or a dead connection gets here, neither of which says anything about the code.
      form.setFieldError('code', getGenericAllauthErrorMessage())
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <Stack gap='xl'>
      <Stack gap='md'>
        <Title order={1} size='h3'>
          {t('Enter your reset code')}
        </Title>
        {/* Still conditional, so this does not become a way of finding who has an account */}
        <Text>
          {t(
            'If the email address you entered corresponds to an account on this service, a message has been sent with a password reset code.',
          )}
        </Text>
      </Stack>

      <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
        <Stack gap='xl'>
          <TextInput
            label={t('Password reset code')}
            autoComplete='one-time-code'
            key={form.key('code')}
            {...withAuthFieldError(form.getInputProps('code'))}
            required
          />

          <ButtonNew type='submit' size='lg' fullWidth loading={isChecking}>
            {t('Continue')}
          </ButtonNew>
        </Stack>
      </form>
    </Stack>
  )
}

/** First half of password recovery: the address to mail a link to. Picking new password happens on `NewPasswordRoute`. */
export default function ResetPasswordRoute() {
  const { data } = useAuthEnvironment()
  const [delivery, setDelivery] = useState<PasswordResetDelivery | null>(null)

  function renderCard() {
    if (delivery === 'link') {
      return (
        <AuthCard>
          <EmailSentPanel />
        </AuthCard>
      )
    }
    // The supporting column stays on the states that still have a form in them, so it does not disappear
    // mid-recovery and then come back on the next screen.
    const aside = shouldRenderAuthAside(data?.authConfiguration) && (
      <AuthAside
        imageUrl={data?.authConfiguration.supporting_image_url}
        text={data?.authConfiguration.supporting_text}
      />
    )
    return (
      <AuthCard aside={aside}>
        {delivery === 'code' ? <CodeEntryPanel /> : <ResetPasswordForm onRequested={setDelivery} />}
      </AuthCard>
    )
  }

  return <DocumentTitle title={`${t('Reset your password')} | KoboToolbox`}>{renderCard()}</DocumentTitle>
}
