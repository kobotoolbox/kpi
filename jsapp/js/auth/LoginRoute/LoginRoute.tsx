import { Image, Stack, Text, Title } from '@mantine/core'
import { type ReactNode, useState } from 'react'
import DocumentTitle from 'react-document-title'
import AuthAside, { shouldRenderAuthAside } from '#/auth/AuthContainer/AuthAside'
import AuthCard from '#/auth/AuthContainer/AuthCard'
import { useAuthEnvironment } from '#/auth/AuthContainer/useAuthEnvironment'
import MfaForm, { type MfaOutcome } from '#/auth/MfaForm/MfaForm'
import ResendVerificationLink from '#/auth/ResendVerificationLink'
import { useAllauthConfiguration } from '#/auth/useAllauthConfiguration'
import ButtonNew from '#/components/common/ButtonNew'
import { PATHS } from '#/router/routerConstants'
import emailEnvelopeIllustration from '../../../img/email-envelope-illustration.svg'
import LoginForm, { type LoginOutcome } from './LoginForm'
import { getLoginCredential } from './loginCredential'

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
      {/* A plain link, not a router one: leaving `/auth` means loading the logged in app. */}
      <ButtonNew component='a' href='/' size='lg' fullWidth>
        {t('Continue to KoboToolbox')}
      </ButtonNew>
    </Stack>
  )
}

/** Shared framing for the two verification endings - same illustration and heading, different copy. */
function EmailVerificationFrame({ children }: { children: ReactNode }) {
  return (
    <Stack gap='md' ta='center'>
      <Image src={emailEnvelopeIllustration} alt='' maw={190} mx='auto' />

      <Title order={1} size='h3'>
        {t('Confirm your email address')}
      </Title>

      {children}
    </Stack>
  )
}

/**
 * Right credentials, unconfirmed address. Nothing was mailed just now, so the copy points at the link from
 * signup and treats a new one as the way out. The version where we know the address, because it was the
 * credential.
 */
function EmailVerificationRequiredPanel({ email }: { email: string }) {
  const [linkRequested, setLinkRequested] = useState(false)

  return (
    <EmailVerificationFrame>
      <Stack gap='xxs'>
        <Text>{t('Your account is not active yet. Activate it with the verification link we sent to:')}</Text>
        <Text fw={500}>{email}</Text>
      </Stack>

      {/* A 200 means the request was taken, not that any mail arrived - delivery failures answer the same way. */}
      {linkRequested ? (
        <Text>{t('A new link has been requested. Give it a few minutes, then try again if nothing arrives.')}</Text>
      ) : (
        <Text>{t('Check your spam folder too. Links expire, so request a new one if yours no longer works.')}</Text>
      )}

      {/* Stays put after a request, since that is the only way back from mail that never shows up. */}
      <ResendVerificationLink label={t('Request new link')} email={email} onSent={() => setLinkRequested(true)} />
    </EmailVerificationFrame>
  )
}

/** The same ending after a username login: allauth never says which address it used, so a resend has to ask. */
function EmailVerificationRequiredWithoutAddressPanel() {
  const [linkRequested, setLinkRequested] = useState(false)

  return (
    <EmailVerificationFrame>
      <Text>
        {t(
          'Your account is not active yet. Activate it with the verification link we sent to the email address on your account - check your spam folder too.',
        )}
      </Text>

      {/* Hedged twice over: the address was never checked against an account, and a 200 is not a delivery. */}
      {linkRequested ? (
        <Text>
          {t(
            'If an account uses that address, a new link has been requested for it. Give it a few minutes, then try again if nothing arrives.',
          )}
        </Text>
      ) : (
        <Text>{t('Links expire. To get a new one, enter the email address your account uses:')}</Text>
      )}

      {/* No address to hand it, so it asks for one - and stays for a second go if no mail turns up. */}
      <ResendVerificationLink label={t('Request new link')} onSent={() => setLinkRequested(true)} />
    </EmailVerificationFrame>
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

interface ConfigurationErrorPanelProps {
  onRetry: () => void
  isRetrying: boolean
}

/**
 * Shown when allauth's settings never arrived, or named no credential this form can ask for. Username and
 * address post under different names and the endpoint reads only one, so a guess would lock out every
 * account on half the deployments.
 */
function ConfigurationErrorPanel({ onRetry, isRetrying }: ConfigurationErrorPanelProps) {
  return (
    <Stack gap='md' ta='center'>
      <Title order={1} size='h3'>
        {t('Logging in is temporarily unavailable')}
      </Title>
      {/* Generic on purpose: the failed request already toasted the server's own message. */}
      <Text>{t('We could not load the login form. Please check your connection and try again.')}</Text>
      <ButtonNew size='lg' fullWidth loading={isRetrying} onClick={onRetry}>
        {t('Retry')}
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
  // Page frame only - logo, aside, legal links. Failing it costs decoration, nothing more.
  const { data: environment } = useAuthEnvironment()
  // allauth's settings, which decide the credential.
  const allauth = useAllauthConfiguration()
  const [outcome, setOutcome] = useState<LoginOutcome | MfaOutcome | null>(null)
  const credential = getLoginCredential(allauth.data?.login_methods)

  function handleOutcome(next: LoginOutcome | MfaOutcome) {
    setOutcome(next)
    if (next.kind === 'authenticated') {
      onAuthenticated()
    }
  }

  function renderCard() {
    // The supporting column belongs to the states that still have a form ahead of them, so it does not
    // vanish halfway through signing in and then come back.
    const aside = shouldRenderAuthAside(environment?.authConfiguration) && (
      <AuthAside
        imageUrl={environment?.authConfiguration.supporting_image_url}
        text={environment?.authConfiguration.supporting_text}
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
          {/* allauth names the address only when it was the credential. */}
          {outcome.kind === 'emailVerificationRequired' &&
            (outcome.email ? (
              <EmailVerificationRequiredPanel email={outcome.email} />
            ) : (
              <EmailVerificationRequiredWithoutAddressPanel />
            ))}
          {outcome.kind === 'mfaExpired' && <MfaExpiredPanel onRestart={() => setOutcome(null)} />}
          {outcome.kind === 'unsupportedStep' && <AnotherStepRequiredPanel />}
        </AuthCard>
      )
    }
    // Pending is not unusable, and neither is a failed refetch with good cached data - swapping a half
    // filled form for this panel over a blip would throw the typing away.
    if (credential === null && !allauth.isPending) {
      return (
        <AuthCard>
          <ConfigurationErrorPanel onRetry={() => allauth.refetch()} isRetrying={allauth.isFetching} />
        </AuthCard>
      )
    }
    return (
      <AuthCard aside={aside}>
        {/* The credential may still be on its way; the form keeps submitting blocked until it lands. */}
        <LoginForm
          credential={credential ?? 'username'}
          socialApps={environment?.socialApps}
          isConfigurationPending={allauth.isPending}
          onOutcome={handleOutcome}
        />
      </AuthCard>
    )
  }

  return <DocumentTitle title={`${t('Log in')} | KoboToolbox`}>{renderCard()}</DocumentTitle>
}
