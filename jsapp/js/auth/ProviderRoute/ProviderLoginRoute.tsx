import { Stack, Text, Title } from '@mantine/core'
import DocumentTitle from 'react-document-title'
import { Link, useParams } from 'react-router-dom'
import { ServerError } from '#/api/ServerError'
import { getSocialAppsRetrieveQueryKey, useSocialAppsRetrieve } from '#/api/react-query/configuration'
import AuthCard from '#/auth/AuthContainer/AuthCard'
import ButtonNew from '#/components/common/ButtonNew'
import { AUTH_ROUTES } from '#/router/routerConstants'
import ProviderRedirectButton from './ProviderRedirectButton'

/** Waiting on the provider lookup, which is the first thing this screen does. */
function LoadingPanel() {
  return (
    <Stack gap='md' ta='center'>
      <Title order={1} size='h3'>
        {t('Log in')}
      </Title>
      <Text>{t('One moment, we are looking up your login provider…')}</Text>
    </Stack>
  )
}

/**
 * A `provider_id` no configured provider answers to - a typo in a hand-passed link, or a provider since
 * removed. The wording stops short of blaming the link, because those two give the same 404.
 */
function ProviderNotFoundPanel() {
  return (
    <Stack gap='md' ta='center'>
      <Title order={1} size='h3'>
        {t('Login provider not found')}
      </Title>
      <Text>
        {t('This login link does not match any provider on this server. Please check the link, or ask for a new one.')}
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

/** A 5xx or a dead connection says nothing about the provider, so this offers a retry, not "not found". */
function LookupErrorPanel({ onRetry, isRetrying }: LookupErrorPanelProps) {
  return (
    <Stack gap='md' ta='center'>
      <Title order={1} size='h3'>
        {t('Something went wrong')}
      </Title>
      {/* Deliberately generic: the failed request already raised a toast carrying the server's own message. */}
      <Text>{t('We could not look up your login provider. Please check your connection and try again.')}</Text>
      <ButtonNew size='lg' fullWidth loading={isRetrying} onClick={onRetry}>
        {t('Retry')}
      </ButtonNew>
    </Stack>
  )
}

interface ConfirmPanelProps {
  providerId: string
  /** The provider's display name, as the server has it configured. */
  providerName: string
}

/** The provider resolved. Nothing happens until the button is clicked - see {@link ProviderRedirectButton}. */
function ConfirmPanel({ providerId, providerName }: ConfirmPanelProps) {
  return (
    <Stack gap='xl'>
      <Stack gap='xs'>
        <Title order={1} size='h3'>
          {/* Substituted rather than interpolated, so translators get one stable string per screen. */}
          {t('Log in with ##provider##').replace('##provider##', () => providerName)}
        </Title>
        <Text>
          {t('Log in to KoboToolbox with your ##provider## account').replace('##provider##', () => providerName)}
        </Text>
      </Stack>

      <Stack gap='xs'>
        <ProviderRedirectButton providerId={providerId} size='lg' fullWidth>
          {t('Log in')}
        </ProviderRedirectButton>
        <ButtonNew component={Link} to={AUTH_ROUTES.LOGIN} variant='transparent' size='lg' fullWidth>
          {t('Go back')}
        </ButtonNew>
      </Stack>
    </Stack>
  )
}

/**
 * Where a single sign-on link lands: confirms which provider is about to be used, then hands the browser over.
 *
 * The link only varies by `provider_id`, so turning that id into a name is the whole job. The endpoint
 * resolves hidden providers (`is_public = False`) as well as public ones, through the same adapter allauth's
 * redirect uses - so a name here means the handshake will start.
 */
export default function ProviderLoginRoute() {
  const { providerId = '' } = useParams<{ providerId: string }>()

  // Keyed on the id so a new link starts fresh, instead of showing the previous provider's answer while its
  // own request is still in flight.
  return <ProviderLoginPanels key={providerId} providerId={providerId} />
}

/**
 * Whether a failed lookup was the endpoint saying no provider answers to that id.
 *
 * Unlike the allauth endpoints, this one goes through `fetchWithAuth`, which throws on anything but a 2xx.
 * So the 404 arrives as an error and the status has to be read back off it.
 */
function isProviderNotFound(error: unknown): boolean {
  return error instanceof ServerError && error.response.status === 404
}

function ProviderLoginPanels({ providerId }: { providerId: string }) {
  const socialApp = useSocialAppsRetrieve(providerId, {
    query: {
      // The same key the hook would have defaulted to; the generated options type asks for it outright.
      queryKey: getSocialAppsRetrieveQueryKey(providerId),
      // A 404 is an answer about the provider, not a transport failure - retrying it only delays the panel.
      retry: false,
    },
  })

  function renderPanel() {
    // The route requires the segment, so an empty id should be impossible - but it would leave the query
    // disabled and the loading panel up forever, so treat it as a bad link.
    if (!providerId || isProviderNotFound(socialApp.error)) {
      return <ProviderNotFoundPanel />
    }
    if (socialApp.isError) {
      return <LookupErrorPanel onRetry={() => socialApp.refetch()} isRetrying={socialApp.isFetching} />
    }
    // Nothing but a 200 gets this far - the rest threw - so this means the request is still in flight.
    if (socialApp.data?.status !== 200) {
      return <LoadingPanel />
    }
    return <ConfirmPanel providerId={socialApp.data.data.provider_id} providerName={socialApp.data.data.name} />
  }

  return (
    <DocumentTitle title={`${t('Log in')} | KoboToolbox`}>
      <AuthCard>{renderPanel()}</AuthCard>
    </DocumentTitle>
  )
}
