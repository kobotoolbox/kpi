import { Image, Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import DocumentTitle from 'react-document-title'
import AuthAside, { shouldRenderAuthAside } from '#/auth/AuthContainer/AuthAside'
import AuthCard from '#/auth/AuthContainer/AuthCard'
import AuthServerBrand from '#/auth/AuthContainer/AuthServerBrand'
import { useAuthEnvironment } from '#/auth/AuthContainer/useAuthEnvironment'
import MfaForm, { type MfaOutcome } from '#/auth/MfaForm/MfaForm'
import ResendVerificationLink from '#/auth/ResendVerificationLink'
import { getUrlForNextRoute, goToPage } from '#/auth/nextUrl'
import { useNextRoute } from '#/auth/useNextRoute'
import ButtonNew from '#/components/common/ButtonNew'
import { PATHS } from '#/router/routerConstants'
import { isPlainClick } from '#/utils'
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
function AlreadyLoggedInPanel({ continueUrl }: { continueUrl: string }) {
  return (
    <Stack gap='md' ta='center'>
      <Title order={1} size='h3'>
        {t('You are already logged in')}
      </Title>
      <Text>{t('There is nothing to sign in to - your session is still good.')}</Text>
      {/* A plain link, not a router one: leaving `/auth` means loading the logged in app, which the `href` alone would
          not do here - see `goToPage`. Modified clicks are left alone, since those open a document of their own. */}
      <ButtonNew
        component='a'
        href={continueUrl}
        onClick={(event) => {
          if (isPlainClick(event)) {
            event.preventDefault()
            goToPage(continueUrl)
          }
        }}
        size='lg'
        fullWidth
      >
        {t('Continue to KoboToolbox')}
      </ButtonNew>
    </Stack>
  )
}

/** Right credentials, unconfirmed address. Nothing was mailed, so the panel offers a new link. */
function EmailVerificationRequiredPanel() {
  const [linkRequested, setLinkRequested] = useState(false)

  return (
    <Stack gap='md' ta='center'>
      <Image src={emailEnvelopeIllustration} alt='' maw={190} mx='auto' />

      <Title order={1} size='h3'>
        {t('Confirm your email address')}
      </Title>

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
  onAuthenticated?: (url: string) => void
}

/** Sign-in screen: on success the card swaps the form for whichever ending the server gave us without route change */
export default function LoginRoute({ onAuthenticated }: LoginRouteProps) {
  // Page frame only - logo, aside, legal links. Failing it costs decoration, nothing more.
  const { data: environment } = useAuthEnvironment()
  const [outcome, setOutcome] = useState<LoginOutcome | MfaOutcome | null>(null)

  // Where signing in leads
  const destinationUrl = getUrlForNextRoute(useNextRoute())

  function handleOutcome(next: LoginOutcome | MfaOutcome) {
    setOutcome(next)
    if (next.kind === 'authenticated') {
      if (onAuthenticated) {
        onAuthenticated(destinationUrl)
      } else {
        goToPage(destinationUrl)
      }
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
    // Same rule as the aside: only on the cards that still hold a form.
    const brand = <AuthServerBrand authConfiguration={environment?.authConfiguration} />

    // Not an ending: the password was accepted and there is a second factor still to fill in.
    if (outcome?.kind === 'mfaRequired') {
      return (
        <AuthCard aside={aside}>
          {brand}
          <MfaForm onOutcome={handleOutcome} />
        </AuthCard>
      )
    }
    if (outcome !== null) {
      return (
        <AuthCard>
          {outcome.kind === 'authenticated' && <SigningInPanel />}
          {outcome.kind === 'alreadyAuthenticated' && <AlreadyLoggedInPanel continueUrl={destinationUrl} />}
          {outcome.kind === 'emailVerificationRequired' && <EmailVerificationRequiredPanel />}
          {outcome.kind === 'mfaExpired' && <MfaExpiredPanel onRestart={() => setOutcome(null)} />}
          {outcome.kind === 'unsupportedStep' && <AnotherStepRequiredPanel />}
        </AuthCard>
      )
    }
    return (
      <AuthCard aside={aside}>
        {brand}
        <LoginForm
          socialApps={environment?.socialApps}
          // Only a definite "no" hides the signup link - the same setting the signup screen itself goes by, so
          // nothing is hidden over a `/environment` that is slow or broken.
          isRegistrationClosed={environment?.registrationOpen === false}
          onOutcome={handleOutcome}
        />
      </AuthCard>
    )
  }

  return <DocumentTitle title={`${t('Log in')} | KoboToolbox`}>{renderCard()}</DocumentTitle>
}
