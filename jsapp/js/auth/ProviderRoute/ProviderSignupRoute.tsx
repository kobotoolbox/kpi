import { Stack, Text, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import DocumentTitle from 'react-document-title'
import { Link, useLocation } from 'react-router-dom'
import { FlowId } from '#/api/models/flowId'
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
import MfaForm, { type MfaOutcome } from '#/auth/MfaForm/MfaForm'
import CheckInboxPanel from '#/auth/RegisterRoute/CheckInboxPanel'
import { getPendingFlowIds } from '#/auth/allauthErrors'
import { getUrlForNextRoute } from '#/auth/nextUrl'
import { useNextRoute } from '#/auth/useNextRoute'
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

/** A 5xx or a dead connection on either lookup. Nothing is lost yet, so retry rather than start over. */
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

interface ConfigurationErrorPanelProps {
  onRetry: () => void
  isRetrying: boolean
}

/**
 * Shown when `/environment` never arrived. It is what says which legal documents have to be agreed to, and
 * the signup endpoint does not re-check that - a form built without it would offer no checkbox and then be
 * rejected for not having ticked one.
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

/**
 * What the session lookup makes of a handshake that left nothing pending.
 *
 * A 401 does not simply mean nobody is signed in: allauth answers the same way while it is holding a login
 * back for one more step, which is what an account with two-factor authentication on gets.
 */
type SessionState =
  /** A 200: an account was there already and the sign-on login finished it. */
  | { kind: 'authenticated' }
  /** A 401 with `mfa_authenticate` pending: the provider checked out, the second factor has not. */
  | { kind: 'mfaRequired' }
  /** A 401 with no session to be had from here, whether or not allauth is holding anything. */
  | { kind: 'anonymous' }

export interface ProviderSignupRouteProps {
  /** What to do once the session exists, handed the URL to leave for */
  onAuthenticated?: (url: string) => void
}

/** Hoisted so the effect below can depend on it without refiring on every render */
const goToPage = (url: string) => window.location.assign(url)

/**
 * Where a single sign-on handshake comes back to - `callback_url` in {@link getProviderCallbackUrl}.
 *
 * allauth tells us nothing on arrival, so the state has to be asked for: `GET auth/provider/signup` answers
 * with a pending account whose gaps need filling, or a 409. A failed handshake lands here too, with an
 * `?error=` and nothing pending.
 */
export default function ProviderSignupRoute({ onAuthenticated = goToPage }: ProviderSignupRouteProps) {
  const { search } = useLocation()
  const {
    data: environment,
    isPending: isEnvironmentPending,
    isError: isEnvironmentError,
    isFetching: isEnvironmentFetching,
    refetch: refetchEnvironment,
  } = useAuthEnvironment()
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
  const session = useAllauthBrowserV1AuthSessionGet<SessionState>({
    query: {
      // The same key the hook would have defaulted to; the generated options type asks for it outright.
      queryKey: getAllauthBrowserV1AuthSessionGetQueryKey(),
      enabled: isLoginPossiblyComplete,
      // A 401 is allauth's way of saying "no session yet" - an answer, not a failure to retry.
      retry: false,
      refetchOnWindowFocus: false,
      select: (response): SessionState => {
        if (response.status === 200 && response.data.meta.is_authenticated) {
          return { kind: 'authenticated' }
        }
        // A pending code means the handshake worked and allauth is holding the login back, which must not be
        // read as the attempt having expired. Any other held step has no screen here yet, so it falls through
        // to the panel below until one arrives.
        if (getPendingFlowIds(response).includes(FlowId.mfa_authenticate)) {
          return { kind: 'mfaRequired' }
        }
        return { kind: 'anonymous' }
      },
    },
  })
  const sessionState = session.data
  const isSignedIn = sessionState?.kind === 'authenticated'
  // Not `isPending`: a disabled query stays pending for good.
  const isSessionUndecided = isLoginPossiblyComplete && sessionState === undefined && !session.isError
  // A 5xx or a dead connection leaves "are they already signed in?" unanswered, which is not the same as a no.
  const isSessionLookupFailed = isLoginPossiblyComplete && session.isError

  // The `next` allauth carried back through `callback_url`, or the app root.
  const destinationUrl = getUrlForNextRoute(useNextRoute())

  // Leaving for the app is a side effect, so it cannot happen while rendering the panel that announces it.
  useEffect(() => {
    if (isSignedIn) {
      onAuthenticated(destinationUrl)
    }
  }, [isSignedIn, onAuthenticated, destinationUrl])

  function handleOutcome(next: ProviderSignupOutcome) {
    setOutcome(next)
    if (next.kind === 'authenticated') {
      onAuthenticated(destinationUrl)
    }
  }

  /**
   * `mfaExpired` becomes `flowExpired` here: unlike the login screen there is no password step on this one to
   * send anyone back to, so allauth dropping the held login simply ends the flow.
   */
  function handleMfaOutcome(next: MfaOutcome) {
    handleOutcome(next.kind === 'authenticated' ? { kind: 'authenticated' } : { kind: 'flowExpired' })
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
    // Someone whose login worked must not be told it expired on the strength of a request that failed.
    if (isSessionLookupFailed) {
      return (
        <AuthCard>
          <LookupErrorPanel onRetry={() => session.refetch()} isRetrying={session.isFetching} />
        </AuthCard>
      )
    }
    // Has to come above `nothingPending`, which is true here too: nothing is pending to sign up because the
    // account exists already, and its login is only waiting on a code. The `outcome` guard is what lets an
    // expired code reach the panel below instead of landing back on this form.
    if (sessionState?.kind === 'mfaRequired' && outcome === null) {
      return (
        <AuthCard aside={aside}>
          <MfaForm onOutcome={handleMfaOutcome} />
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
    // `!environment` matters as much as the error: a failed background refetch leaves the last good response
    // in place, and swapping a half filled form for this panel over a blip would throw that typing away.
    if (isEnvironmentError && !environment) {
      return (
        <AuthCard>
          <ConfigurationErrorPanel onRetry={() => refetchEnvironment()} isRetrying={isEnvironmentFetching} />
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
