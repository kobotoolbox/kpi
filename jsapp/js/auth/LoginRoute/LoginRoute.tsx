import { Image, Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import DocumentTitle from 'react-document-title'
import AuthAside, { shouldRenderAuthAside } from '#/auth/AuthContainer/AuthAside'
import AuthCard from '#/auth/AuthContainer/AuthCard'
import { useAuthConfiguration } from '#/auth/AuthContainer/useAuthConfiguration'
import MfaForm, { type MfaOutcome } from '#/auth/MfaForm/MfaForm'
import ResendVerificationLink from '#/auth/ResendVerificationLink'
import ButtonNew from '#/components/common/ButtonNew'
import { PATHS } from '#/router/routerConstants'
import emailEnvelopeIllustration from '../../../img/email-envelope-illustration.svg'
import LoginForm, { type LoginOutcome } from './LoginForm'

/** Fills the card while the browser loads the app, so the form does not sit there looking unsubmitted. */
function SigningInPanel() {
  return (
    <Stack gap='md' ta='center'>
      <Title order={1} size='h3'>
        {t('Signing you in…')}
      </Title>
      <Text>{t('One moment, we are taking you to your projects.')}</Text>
    </Stack>
  )
}

/** A session was there all along - another tab signed in, or the back button landed here. */
function AlreadyLoggedInPanel() {
  return (
    <Stack gap='md' ta='center'>
      <Title order={1} size='h3'>
        {t('You are already logged in')}
      </Title>
      <Text>{t('There is nothing to sign in to - your session is still good.')}</Text>
      {/* A plain link, not a router one: leaving `/accounts` means loading the logged in app. */}
      <ButtonNew component='a' href='/' size='lg' fullWidth>
        {t('Continue to KoboToolbox')}
      </ButtonNew>
    </Stack>
  )
}

/**
 * The credentials were right, but the address on the account was never confirmed. allauth mailed a fresh
 * link while handling the attempt.
 */
function EmailVerificationRequiredPanel({ email }: { email?: string }) {
  return (
    <Stack gap='md' ta='center'>
      <Image src={emailEnvelopeIllustration} alt='' maw={190} mx='auto' />

      <Title order={1} size='h3'>
        {t('Confirm your email address')}
      </Title>

      <Stack gap='xxs'>
        <Text>{t('Your account is not active yet. We sent a verification link to the address on record:')}</Text>
        {/* Only on a server that signs in by address. With a username we never learn which one it is. */}
        {email && <Text fw={500}>{email}</Text>}
      </Stack>

      <Text>{t("Be sure to check your spam folder if you don't see it within a few minutes.")}</Text>

      <ResendVerificationLink label={t('Request new link')} email={email} />
    </Stack>
  )
}

/**
 * The code was asked for and then the sign-in it belonged to went away - the session holding it expired, or
 * another tab finished or abandoned the attempt. The password has to go in again.
 */
function MfaExpiredPanel({ onRestart }: { onRestart: () => void }) {
  return (
    <Stack gap='md' ta='center'>
      <Title order={1} size='h3'>
        {t('Your login attempt has expired')}
      </Title>
      <Text>{t('This login attempt is no longer valid. Please log in again.')}</Text>
      <ButtonNew size='lg' fullWidth onClick={onRestart}>
        {t('Back to login')}
      </ButtonNew>
    </Stack>
  )
}

/** allauth accepted the password and then asked for a step that is not built yet - verifying a phone, say. */
function AnotherStepRequiredPanel() {
  return (
    <Stack gap='md' ta='center'>
      <Title order={1} size='h3'>
        {t('One more step')}
      </Title>
      <Text>{t('This account needs an extra verification step, which is not available on this page yet.')}</Text>
      <ButtonNew component='a' href={PATHS.MFA_AUTHENTICATE} size='lg' fullWidth>
        {t('Continue signing in')}
      </ButtonNew>
    </Stack>
  )
}

export interface LoginRouteProps {
  /** What to do once the session exists */
  onAuthenticated?: () => void
}

/** Sign-in screen: on success the card swaps the form for whichever ending the server gave us without route change */
export default function LoginRoute({ onAuthenticated = () => window.location.assign('/') }: LoginRouteProps) {
  const { data, isPending } = useAuthConfiguration()
  const [outcome, setOutcome] = useState<LoginOutcome | MfaOutcome | null>(null)
  const isUsernameAccepted = data?.allowLoginWithUsername ?? true

  function handleOutcome(next: LoginOutcome | MfaOutcome) {
    setOutcome(next)
    if (next.kind === 'authenticated') {
      onAuthenticated()
    }
  }

  function renderCard() {
    // The supporting column belongs to the states that still have a form ahead of them, so it does not
    // vanish halfway through signing in and then come back.
    const aside = shouldRenderAuthAside(data?.authConfiguration) && (
      <AuthAside
        imageUrl={data?.authConfiguration.supporting_image_url}
        text={data?.authConfiguration.supporting_text}
      />
    )

    // Not an ending: the password was accepted and there is a second factor still to fill in.
    if (outcome?.kind === 'mfaRequired') {
      return (
        <AuthCard aside={aside}>
          <MfaForm onOutcome={handleOutcome} />
        </AuthCard>
      )
    }
    if (outcome !== null) {
      return (
        <AuthCard>
          {outcome.kind === 'authenticated' && <SigningInPanel />}
          {outcome.kind === 'alreadyAuthenticated' && <AlreadyLoggedInPanel />}
          {outcome.kind === 'emailVerificationRequired' && <EmailVerificationRequiredPanel email={outcome.email} />}
          {outcome.kind === 'mfaExpired' && <MfaExpiredPanel onRestart={() => setOutcome(null)} />}
          {outcome.kind === 'unsupportedStep' && <AnotherStepRequiredPanel />}
        </AuthCard>
      )
    }
    return (
      <AuthCard aside={aside}>
        <LoginForm
          isUsernameAccepted={isUsernameAccepted}
          isConfigurationPending={isPending}
          onOutcome={handleOutcome}
        />
      </AuthCard>
    )
  }

  return <DocumentTitle title={`${t('Log in')} | KoboToolbox`}>{renderCard()}</DocumentTitle>
}
