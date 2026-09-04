import { Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import DocumentTitle from 'react-document-title'
import AuthCard from '#/auth/AuthContainer/AuthCard'
import { useAuthConfiguration } from '#/auth/AuthContainer/useAuthConfiguration'
import CheckInboxPanel from './CheckInboxPanel'
import RegisterAside from './RegisterAside'
import RegisterForm from './RegisterForm'

function SignupClosedPanel() {
  return (
    <Stack gap='md'>
      <Title order={1} size='h3'>
        {t('Sign up closed')}
      </Title>
      <Text>{t('We are sorry, but the sign up is currently closed')}</Text>
    </Stack>
  )
}

/**
 * Registration screen: on success the card swaps the form for `CheckInboxPanel` in place, no route change.
 *
 * The signup POST needs the `csrftoken` cookie, and nothing here has to fetch it: these are hash routes,
 * so `index.html` has already loaded and rendered `{% csrf_token %}`, which is what sets it.
 */
export default function RegisterRoute() {
  const { data } = useAuthConfiguration()
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)

  // Assume registration is open until `/environment` says otherwise, so a slow response does not leave
  // the card empty. The server rejects a closed signup with a 403 regardless.
  const isRegistrationClosed = data?.registrationOpen === false

  const supportingImageUrl = data?.authConfiguration.supporting_image_url
  const supportingText = data?.authConfiguration.supporting_text
  // Decided here, not inside `RegisterAside`: `AuthCard` opens the column for any truthy `aside`, so an
  // aside that renders nothing would still widen the card and draw the divider. The accepted cost is a
  // card that starts one column wide and grows once `/environment` lands.
  const hasSupportingContent = Boolean(supportingImageUrl) || Boolean(supportingText)

  function renderCard() {
    if (isRegistrationClosed) {
      return (
        <AuthCard>
          <SignupClosedPanel />
        </AuthCard>
      )
    }
    if (registeredEmail !== null) {
      // No supporting column here: it exists to help someone decide to sign up, and they have.
      return (
        <AuthCard>
          <CheckInboxPanel email={registeredEmail} />
        </AuthCard>
      )
    }
    return (
      <AuthCard
        aside={hasSupportingContent ? <RegisterAside imageUrl={supportingImageUrl} text={supportingText} /> : undefined}
      >
        <RegisterForm
          socialApps={data?.socialApps}
          termsOfServiceUrl={data?.termsOfServiceUrl}
          privacyPolicyUrl={data?.privacyPolicyUrl}
          onRegistered={setRegisteredEmail}
        />
      </AuthCard>
    )
  }

  return <DocumentTitle title={`${t('Create an account')} | KoboToolbox`}>{renderCard()}</DocumentTitle>
}
