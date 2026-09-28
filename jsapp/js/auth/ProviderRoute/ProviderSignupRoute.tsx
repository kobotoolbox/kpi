import { Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import DocumentTitle from 'react-document-title'
import { Link, useLocation } from 'react-router-dom'
import type { ProviderSignupResponseData } from '#/api/models/providerSignupResponseData'
import {
  getAllauthBrowserV1AuthProviderSignupGetQueryKey,
  useAllauthBrowserV1AuthProviderSignupGet,
} from '#/api/react-query/authentication-allauth-headless'
import AuthAside, { shouldRenderAuthAside } from '#/auth/AuthContainer/AuthAside'
import AuthCard from '#/auth/AuthContainer/AuthCard'
import { useAuthEnvironment } from '#/auth/AuthContainer/useAuthEnvironment'
import CheckInboxPanel from '#/auth/RegisterRoute/CheckInboxPanel'
import ButtonNew from '#/components/common/ButtonNew'
import Alert from '#/components/common/alert'
import { AUTH_ROUTES } from '#/router/routerConstants'
import ProviderSignupForm, { type ProviderSignupOutcome } from './ProviderSignupForm'
import { getProviderRedirectErrorMessage, readProviderRedirectError } from './providerRedirect'

/** Waiting on the lookup that says whether a provider signup is pending, and what the provider gave us. */
function LoadingPanel() {
  return (
    <Stack gap='md' ta='center'>
      <Title order={1} size='h3'>
        {t('Create your account')}
      </Title>
      <Text>{t('One moment, we are finishing your login…')}</Text>
    </Stack>
  )
}

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

interface NothingPendingPanelProps {
  /** allauth's `?error=` code, when the handshake is what failed rather than simply having finished. */
  errorCode: string | null
}

/**
 * Nothing to fill in: allauth is not holding a provider signup.
 *
 * One panel for three causes, because a 409 is all the server tells us - the handshake failed, the signup
 * already finished in some tab, or the session holding it expired. An `?error=` narrows it down when there
 * is one, and all three end back at the login screen either way.
 */
function NothingPendingPanel({ errorCode }: NothingPendingPanelProps) {
  return (
    <Stack gap='md' ta='center'>
      <Title order={1} size='h3'>
        {t('Your login attempt has expired')}
      </Title>
      <Text>
        {errorCode
          ? getProviderRedirectErrorMessage(errorCode)
          : t('This login attempt is no longer valid. Please log in again.')}
      </Text>
      <ButtonNew component={Link} to={AUTH_ROUTES.LOGIN} size='lg' fullWidth>
        {t('Back to login')}
      </ButtonNew>
    </Stack>
  )
}

interface LookupErrorPanelProps {
  onRetry: () => void
  isRetrying: boolean
}

/**
 * A 5xx or a dead connection. The pending signup is probably still there, so offer a retry rather than
 * sending someone back through a handshake they already finished.
 */
function LookupErrorPanel({ onRetry, isRetrying }: LookupErrorPanelProps) {
  return (
    <Stack gap='md' ta='center'>
      <Title order={1} size='h3'>
        {t('Something went wrong')}
      </Title>
      {/* Deliberately generic: the failed request already raised a toast carrying the server's own message. */}
      <Text>{t('We could not finish your login. Please check your connection and try again.')}</Text>
      <ButtonNew size='lg' fullWidth loading={isRetrying} onClick={onRetry}>
        {t('Retry')}
      </ButtonNew>
    </Stack>
  )
}

export interface ProviderSignupRouteProps {
  /** What to do once the session exists */
  onAuthenticated?: () => void
}

/**
 * Where a single sign-on handshake comes back to - `callback_url` in {@link getProviderCallbackUrl}.
 *
 * With allauth the frontend has to ask what state it is in rather than being told. After the provider round
 * trip we may already be signed in, or a signup may be pending because the provider gave us too little.
 * `GET auth/provider/signup` answers both at once: the pending account and what it knows, or a 409. A failed
 * handshake lands here too, with an `?error=` and nothing pending.
 */
export default function ProviderSignupRoute({
  onAuthenticated = () => window.location.assign('/'),
}: ProviderSignupRouteProps) {
  const { search } = useLocation()
  const { data: environment } = useAuthEnvironment()
  const [outcome, setOutcome] = useState<ProviderSignupOutcome | null>(null)

  const errorCode = readProviderRedirectError(window.location.search, search)

  // Explicit `TData`, or `select`'s narrowing is lost and the hook hands back the raw response.
  const pendingSignup = useAllauthBrowserV1AuthProviderSignupGet<ProviderSignupResponseData | null>({
    query: {
      // The same key the hook would have defaulted to; the generated options type asks for it outright.
      queryKey: getAllauthBrowserV1AuthProviderSignupGetQueryKey(),
      // A 409 is an answer about the flow, not a transport failure - retrying it only delays the panel.
      retry: false,
      // Refetching mid-form would throw away what was typed for the provider's values.
      refetchOnWindowFocus: false,
      // allauth hands the 409 back as data, so this is where "nothing pending" is decided.
      select: (response) => (response.status === 200 ? response.data.data : null),
    },
  })

  function handleOutcome(next: ProviderSignupOutcome) {
    setOutcome(next)
    if (next.kind === 'authenticated') {
      onAuthenticated()
    }
  }

  function renderCard() {
    // Only the form gets the supporting column, so it does not flash away and back between panels.
    const aside = shouldRenderAuthAside(environment?.authConfiguration) && (
      <AuthAside
        imageUrl={environment?.authConfiguration.supporting_image_url}
        text={environment?.authConfiguration.supporting_text}
      />
    )

    if (outcome?.kind === 'authenticated') {
      return (
        <AuthCard>
          <SigningInPanel />
        </AuthCard>
      )
    }
    if (outcome?.kind === 'emailVerificationRequired') {
      return (
        <AuthCard>
          <CheckInboxPanel email={outcome.email} />
        </AuthCard>
      )
    }
    // The flow going away under a filled in form ends the same way as never having had one.
    if (outcome?.kind === 'flowExpired' || pendingSignup.data === null) {
      return (
        <AuthCard>
          <NothingPendingPanel errorCode={errorCode} />
        </AuthCard>
      )
    }
    if (pendingSignup.isError && !pendingSignup.data) {
      return (
        <AuthCard>
          <LookupErrorPanel onRetry={() => pendingSignup.refetch()} isRetrying={pendingSignup.isFetching} />
        </AuthCard>
      )
    }
    // `null` is handled above, so anything falsy left means the request is still in flight.
    if (!pendingSignup.data) {
      return (
        <AuthCard>
          <LoadingPanel />
        </AuthCard>
      )
    }

    const { account, user, email } = pendingSignup.data

    return (
      <AuthCard aside={aside}>
        {/* A failed second attempt, in another tab say. The form still matters, so this goes above it. */}
        {errorCode && (
          <Alert type='error' iconName='alert' mb='xl'>
            {getProviderRedirectErrorMessage(errorCode)}
          </Alert>
        )}
        <ProviderSignupForm
          providerName={account.provider.name}
          initialValues={{
            // allauth derives `display` from the provider account: a real name where there was one, an
            // account handle where there was not.
            name: account.display,
            // The provider may have handed over several addresses; only the primary one belongs here.
            email: email.find((address) => address.primary)?.email ?? email[0]?.email ?? '',
            username: user.username,
          }}
          onOutcome={handleOutcome}
        />
      </AuthCard>
    )
  }

  return <DocumentTitle title={`${t('Create your account')} | KoboToolbox`}>{renderCard()}</DocumentTitle>
}
