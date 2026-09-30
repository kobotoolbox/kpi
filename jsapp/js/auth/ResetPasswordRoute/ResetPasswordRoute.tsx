import { Image, Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import DocumentTitle from 'react-document-title'
import { useNavigate } from 'react-router-dom'
import AuthAside, { shouldRenderAuthAside } from '#/auth/AuthContainer/AuthAside'
import AuthCard from '#/auth/AuthContainer/AuthCard'
import { useAuthEnvironment } from '#/auth/AuthContainer/useAuthEnvironment'
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

/** First half of password recovery: the address to mail a link to. Picking new password happens on `NewPasswordRoute`. */
export default function ResetPasswordRoute() {
  const { data } = useAuthEnvironment()
  const navigate = useNavigate()
  const [isEmailSent, setIsEmailSent] = useState(false)

  // A code has to be typed somewhere, and the screen that sets the new password is where it is worth anything.
  const handleRequested = (delivery: PasswordResetDelivery) =>
    delivery === 'code' ? navigate(AUTH_ROUTES.RESET_PASSWORD_CODE) : setIsEmailSent(true)

  function renderCard() {
    if (isEmailSent) {
      return (
        <AuthCard>
          <EmailSentPanel />
        </AuthCard>
      )
    }
    return (
      <AuthCard
        aside={
          shouldRenderAuthAside(data?.authConfiguration) && (
            <AuthAside
              imageUrl={data?.authConfiguration.supporting_image_url}
              text={data?.authConfiguration.supporting_text}
            />
          )
        }
      >
        <ResetPasswordForm onRequested={handleRequested} />
      </AuthCard>
    )
  }

  return <DocumentTitle title={`${t('Reset your password')} | KoboToolbox`}>{renderCard()}</DocumentTitle>
}
