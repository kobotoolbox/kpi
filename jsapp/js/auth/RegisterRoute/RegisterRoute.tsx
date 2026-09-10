import { Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import DocumentTitle from 'react-document-title'
import AuthCard from '#/auth/AuthContainer/AuthCard'
import { useAuthConfiguration } from '#/auth/AuthContainer/useAuthConfiguration'
import ButtonNew from '#/components/common/ButtonNew'
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

/** The ending on a deployment that doesn't verify addresses: the account is made and already signed in. */
function AccountReadyPanel() {
  return (
    <Stack gap='md' ta='center'>
      <Title order={1} size='h3'>
        {t('Your account is ready')}
      </Title>
      <Text>{t('Your account is active. You are signed in and ready to go.')}</Text>
      {/* A plain link, not a router one: leaving `/auth` means loading the logged in app. */}
      <ButtonNew component='a' href='/' size='lg' fullWidth>
        {t('Continue to KoboToolbox')}
      </ButtonNew>
    </Stack>
  )
}

interface ConfigurationErrorPanelProps {
  onRetry: () => void
  isRetrying: boolean
}

/**
 * Shown when `/environment` never arrived. Without it we don't know which legal documents to ask about,
 * which email domains have to use SSO, or whether sign up is open at all - and the signup endpoint does
 * not re-check any of that, so a form built on the missing answers would quietly drop those rules.
 */
function ConfigurationErrorPanel({ onRetry, isRetrying }: ConfigurationErrorPanelProps) {
  return (
    <Stack gap='md' ta='center'>
      <Title order={1} size='h3'>
        {t('Sign up is temporarily unavailable')}
      </Title>
      {/* Deliberately generic: the failed request already raised a toast carrying the server's own message. */}
      <Text>{t('We could not load the sign up form. Please check your connection and try again.')}</Text>
      <ButtonNew size='lg' fullWidth loading={isRetrying} onClick={onRetry}>
        {t('Retry')}
      </ButtonNew>
    </Stack>
  )
}

/** What the server did with the new account, and so which panel takes the form's place. */
type SignupOutcome = { kind: 'verificationPending'; email: string } | { kind: 'signedIn' }

/**
 * Registration screen: on success the card swaps the form for whichever ending the server gave us, in
 * place, no route change.
 *
 * The signup POST needs the `csrftoken` cookie, and nothing here has to fetch it: these are hash routes,
 * so `index.html` has already loaded and rendered `{% csrf_token %}`, which is what sets it.
 */
export default function RegisterRoute() {
  const { data, isPending, isError, isFetching, refetch } = useAuthConfiguration()
  const [outcome, setOutcome] = useState<SignupOutcome | null>(null)

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
    // `!data` matters as much as `isError`: a failed background refetch leaves the last good response in
    // place, and swapping a half filled form for this panel over a blip would throw that typing away.
    if (isError && !data) {
      return (
        <AuthCard>
          <ConfigurationErrorPanel onRetry={() => refetch()} isRetrying={isFetching} />
        </AuthCard>
      )
    }
    if (isRegistrationClosed) {
      return (
        <AuthCard>
          <SignupClosedPanel />
        </AuthCard>
      )
    }
    if (outcome !== null) {
      return (
        <AuthCard>
          {outcome.kind === 'signedIn' ? <AccountReadyPanel /> : <CheckInboxPanel email={outcome.email} />}
        </AuthCard>
      )
    }
    return (
      <AuthCard
        aside={hasSupportingContent ? <RegisterAside imageUrl={supportingImageUrl} text={supportingText} /> : undefined}
      >
        <RegisterForm
          socialApps={data?.socialApps}
          userMetadataFields={data?.userMetadataFields}
          sectorChoices={data?.sectorChoices}
          countryChoices={data?.countryChoices}
          termsOfServiceUrl={data?.termsOfServiceUrl}
          privacyPolicyUrl={data?.privacyPolicyUrl}
          isConfigurationPending={isPending}
          onVerificationPending={(email) => setOutcome({ kind: 'verificationPending', email })}
          onSignedIn={() => setOutcome({ kind: 'signedIn' })}
        />
      </AuthCard>
    )
  }

  return <DocumentTitle title={`${t('Create an account')} | KoboToolbox`}>{renderCard()}</DocumentTitle>
}
