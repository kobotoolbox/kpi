import { Image, Stack, Text, Title } from '@mantine/core'
import { type ReactNode, useState } from 'react'
import DocumentTitle from 'react-document-title'
import AuthAside, { shouldRenderAuthAside } from '#/auth/AuthContainer/AuthAside'
import AuthCard from '#/auth/AuthContainer/AuthCard'
import { useAuthEnvironment } from '#/auth/AuthContainer/useAuthEnvironment'
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
 * Right credentials, unconfirmed address - allauth mailed a fresh link while handling the attempt. The
 * version where we know the address, because it was the credential.
 */
function EmailVerificationRequiredPanel({ email }: { email: string }) {
  return (
    <EmailVerificationFrame>
      <Stack gap='xxs'>
        <Text>{t('Your account is not active yet. We sent a verification link to the address on record:')}</Text>
        <Text fw={500}>{email}</Text>
      </Stack>

      <Text>{t("Be sure to check your spam folder if you don't see it within a few minutes.")}</Text>

      <ResendVerificationLink label={t('Request new link')} email={email} />
    </EmailVerificationFrame>
  )
}

/** The same ending after a username login: allauth never says which address it mailed, so a resend has to ask. */
function EmailVerificationRequiredWithoutAddressPanel() {
  const [linkRequested, setLinkRequested] = useState(false)

  return (
    <EmailVerificationFrame>
      <Text>{t('Your account is not active yet. We sent a verification link to the address on your account.')}</Text>

      <Text>{t("Be sure to check your spam folder if you don't see it within a few minutes.")}</Text>

      {linkRequested ? (
        // Vague on purpose: the address typed in was never checked against an account.
        <Text>{t('If an account exists for that email address, another verification link is on its way to it.')}</Text>
      ) : (
        <>
          <Text>{t('To have another link sent, enter the email address your account uses:')}</Text>
          {/* No address to hand it, so it asks for one. */}
          <ResendVerificationLink label={t('Request new link')} onSent={() => setLinkRequested(true)} />
        </>
      )}
    </EmailVerificationFrame>
  )
}

/**
 * allauth accepted the password and then asked for a step that is not built yet.
 * TODO: ask for the code here instead, once DEV-1857 builds that screen.
 */
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
  const [outcome, setOutcome] = useState<LoginOutcome | null>(null)
  const credential = getLoginCredential(allauth.data?.login_methods)

  function handleOutcome(next: LoginOutcome) {
    setOutcome(next)
    if (next.kind === 'authenticated') {
      onAuthenticated()
    }
  }

  function renderCard() {
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
      <AuthCard
        aside={
          shouldRenderAuthAside(environment?.authConfiguration) && (
            <AuthAside
              imageUrl={environment?.authConfiguration.supporting_image_url}
              text={environment?.authConfiguration.supporting_text}
            />
          )
        }
      >
        {/* The credential may still be on its way; the form keeps submitting blocked until it lands. */}
        <LoginForm
          credential={credential ?? 'username'}
          isConfigurationPending={allauth.isPending}
          onOutcome={handleOutcome}
        />
      </AuthCard>
    )
  }

  return <DocumentTitle title={`${t('Log in')} | KoboToolbox`}>{renderCard()}</DocumentTitle>
}
