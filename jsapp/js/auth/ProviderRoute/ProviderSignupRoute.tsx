import { Stack, Text, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import DocumentTitle from 'react-document-title'
import { Link, useLocation } from 'react-router-dom'
import type { ProviderSignupResponseData } from '#/api/models/providerSignupResponseData'
import {
  getAllauthBrowserV1AuthProviderSignupGetQueryKey,
  getAllauthBrowserV1AuthSessionGetQueryKey,
  useAllauthBrowserV1AuthProviderSignupGet,
  useAllauthBrowserV1AuthSessionGet,
} from '#/api/react-query/authentication-allauth-headless'
import AuthAside, { shouldRenderAuthAside } from '#/auth/AuthContainer/AuthAside'
import AuthCard from '#/auth/AuthContainer/AuthCard'
import { useAuthEnvironment } from '#/auth/AuthContainer/useAuthEnvironment'
import CheckInboxPanel from '#/auth/RegisterRoute/CheckInboxPanel'
import ButtonNew from '#/components/common/ButtonNew'
import Alert from '#/components/common/alert'
import { ROOT_URL } from '#/constants'
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
 * One panel for three causes, because a 409 is all the server tells us - a failed handshake, a signup already
 * finished in another tab, or an expired session. All three end back at the login screen anyway.
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

/** A 5xx or a dead connection. The signup is probably still pending, so retry rather than start over. */
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
 * Hoisted so the effect below can depend on it without refiring on every render. `ROOT_URL`, not `/`, so a
 * prefixed instance lands in its own app. The `next` the callback carries back is ignored until the resolver
 * on the PR stacked above this one arrives to replace this default.
 */
const goToApp = () => window.location.assign(`${ROOT_URL}/`)

/**
 * Where a single sign-on handshake comes back to - `callback_url` in {@link getProviderCallbackUrl}.
 *
 * allauth tells us nothing on arrival, so the state has to be asked for: `GET auth/provider/signup` answers
 * with a pending account whose gaps need filling, or a 409. A failed handshake lands here too, with an
 * `?error=` and nothing pending.
 */
export default function ProviderSignupRoute({ onAuthenticated = goToApp }: ProviderSignupRouteProps) {
  const { search } = useLocation()
  const { data: environment, isPending: isEnvironmentPending } = useAuthEnvironment()
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
  const nothingPending = pendingSignup.data === null

  // A sign-on *login* that worked comes back here with nothing pending too, so the 409 above cannot tell
  // "already in" from "the flow died". An `?error=` rules a success out, so those skip the lookup.
  const isLoginPossiblyComplete = nothingPending && !errorCode
  const session = useAllauthBrowserV1AuthSessionGet<boolean>({
    query: {
      // The same key the hook would have defaulted to; the generated options type asks for it outright.
      queryKey: getAllauthBrowserV1AuthSessionGetQueryKey(),
      enabled: isLoginPossiblyComplete,
      // A 401 is allauth's way of saying "nobody is logged in" - an answer, not a failure to retry.
      retry: false,
      refetchOnWindowFocus: false,
      select: (response) => response.status === 200 && response.data.meta.is_authenticated,
    },
  })
  const isSignedIn = session.data === true
  // Not `isPending`: a disabled query stays pending for good. A failed check counts as decided - there is
  // nothing better to do with it than the login screen.
  const isSessionUndecided = isLoginPossiblyComplete && session.data === undefined && !session.isError

  // Leaving for the app is a side effect, so it cannot happen while rendering the panel that announces it.
  useEffect(() => {
    if (isSignedIn) {
      onAuthenticated()
    }
  }, [isSignedIn, onAuthenticated])

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

    // Either this form just created the session, or the login that came back here already had one.
    if (outcome?.kind === 'authenticated' || isSignedIn) {
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
    // Nothing pending and no session yet to rule out, so keep waiting rather than calling the flow dead.
    if (isSessionUndecided) {
      return (
        <AuthCard>
          <LoadingPanel />
        </AuthCard>
      )
    }
    // The flow going away under a filled in form ends the same way as never having had one.
    if (outcome?.kind === 'flowExpired' || nothingPending) {
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
            // The provider may have handed over several addresses; only the primary one belongs here.
            email: email.find((address) => address.primary)?.email ?? email[0]?.email ?? '',
            username: user.username,
          }}
          termsOfServiceUrl={environment?.termsOfServiceUrl}
          privacyPolicyUrl={environment?.privacyPolicyUrl}
          isConfigurationPending={isEnvironmentPending}
          onOutcome={handleOutcome}
        />
      </AuthCard>
    )
  }

  return <DocumentTitle title={`${t('Create your account')} | KoboToolbox`}>{renderCard()}</DocumentTitle>
}
