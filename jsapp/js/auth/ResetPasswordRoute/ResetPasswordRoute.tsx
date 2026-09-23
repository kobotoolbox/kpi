import { Image, Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import DocumentTitle from 'react-document-title'
import AuthAside, { shouldRenderAuthAside } from '#/auth/AuthContainer/AuthAside'
import AuthCard from '#/auth/AuthContainer/AuthCard'
import { useAuthConfiguration } from '#/auth/AuthContainer/useAuthConfiguration'
import emailEnvelopeIllustration from '../../../img/email-envelope-illustration.svg'
import ResetPasswordForm from './ResetPasswordForm'

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
  const { data } = useAuthConfiguration()
  const [isRequested, setIsRequested] = useState(false)

  function renderCard() {
    if (isRequested) {
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
        <ResetPasswordForm onRequested={() => setIsRequested(true)} />
      </AuthCard>
    )
  }

  return <DocumentTitle title={`${t('Reset your password')} | KoboToolbox`}>{renderCard()}</DocumentTitle>
}
